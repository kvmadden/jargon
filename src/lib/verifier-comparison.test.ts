import { describe, it, expect } from 'vitest'
import { readFileSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildFrozenInputs, ollamaChat, runComparison } from '../../eval/lib/verifier-comparison'
import { main } from '../../eval/compare-verifiers-ollama'
import { PASS2_SYSTEM_PROMPT } from '../../supabase/functions/personalize-term/prompts'

const evalDir = resolve(__dirname, '../../eval')
const read = (p: string) => readFileSync(join(evalDir, p), 'utf8')
const history = read('results/2026-10-30.jsonl')
const passVerdict = history.trim().split('\n').map(l => JSON.parse(l)).find(r => r.pass1_verdict?.overall === 'pass').pass1_verdict
const failVerdict = { ...passVerdict, technical_accuracy_preserved: { result: 'fail', reasoning: 'mock model rejects' }, overall: 'fail' }
const plainRendering = { long_definition: 'a plain technical explanation.', why_it_matters: 'it helps in meetings.', example_in_sentence: 'we reviewed the plain explanation.' }

const sources = {
  heldoutRaw: read('data/heldout-v1.json'),
  heldoutSha256: '7f10a0a5a2341d0146950724f038a26c20facea757534a6d166355fc85a6f95b',
  historyRaw: history,
  contexts: JSON.parse(read('data/verifier-comparison-contexts-v1.json')),
  terms: JSON.parse(read('data/terms.json')).terms,
  profiles: JSON.parse(read('data/profiles.json')).profiles,
  expertFiles: [JSON.parse(read('data/expert-confirmed-misses.json')), JSON.parse(read('data/expert-adjudication-2026-11-01.json'))],
}

// Mock Ollama /api/chat. The verifier verdict is chosen by a rule on the request,
// never by the arm, because the arm is not visible in the request.
type Rule = (user: string) => string
function mockOllama(verify: Rule, regenerate: Rule = () => JSON.stringify(plainRendering), status = 200) {
  const requests: { url: string; body: any }[] = []
  const fetchImpl = (async (url: string, init: any) => {
    const body = JSON.parse(init.body)
    requests.push({ url, body })
    if (status !== 200) return new Response('boom', { status })
    const [system, user] = body.messages.map((m: any) => m.content)
    const content = system === PASS2_SYSTEM_PROMPT ? verify(user) : regenerate(user)
    return new Response(JSON.stringify({ message: { role: 'assistant', content } }), { status: 200 })
  }) as unknown as typeof fetch
  return { fetchImpl, requests }
}
const chatFor = (fetchImpl: typeof fetch) => ollamaChat({ baseUrl: 'http://ollama.test:11434/', model: 'mock:1b', temperature: 0, seed: 1, timeoutMs: 1000, fetchImpl })
const heldout = (ids: string[]) => buildFrozenInputs(sources, ['heldout']).filter(i => ids.includes(i.id))

describe('frozen inputs', () => {
  it('builds 24 held-out and 78 historical inputs with unchanged labels', () => {
    const inputs = buildFrozenInputs(sources, ['heldout', 'historical'])
    const h = inputs.filter(i => i.set === 'heldout')
    const past = inputs.filter(i => i.set === 'historical')
    expect(h).toHaveLength(24)
    expect(h.filter(i => i.label === 'incorrect')).toHaveLength(12)
    expect(past).toHaveLength(78)
    expect(past.filter(i => i.label === 'incorrect')).toHaveLength(5)
    expect(past.filter(i => i.label === 'correct')).toHaveLength(7)
    expect(past.filter(i => i.label === 'unlabeled')).toHaveLength(66)
  })

  it('refuses a changed held-out set', () => {
    expect(() => buildFrozenInputs({ ...sources, heldoutRaw: sources.heldoutRaw + ' ' }, ['heldout'])).toThrow(/changed/)
  })
})

describe('paired verifier comparison through a mocked Ollama endpoint', () => {
  it('sends identical verify requests for both arms to the configured endpoint', async () => {
    const { fetchImpl, requests } = mockOllama(() => JSON.stringify(passVerdict))
    await runComparison(chatFor(fetchImpl), heldout(['heldout-13']), [])
    expect(requests).toHaveLength(2)
    expect(requests[0].url).toBe('http://ollama.test:11434/api/chat')
    expect(requests[0].body).toEqual(requests[1].body)
    expect(requests[0].body).toMatchObject({ model: 'mock:1b', stream: false, options: { temperature: 0, seed: 1, num_predict: 700 } })
  })

  it('records a false acceptance for the original and a hold, regeneration and acceptance for the candidate', async () => {
    const { fetchImpl } = mockOllama(() => JSON.stringify(passVerdict))
    const { rows, summary } = await runComparison(chatFor(fetchImpl), heldout(['heldout-01']), [])
    const { original, candidate } = rows[0].arms
    expect(original).toMatchObject({ first_verdict: 'pass', regenerated: false, final_outcome: 'accepted_frozen_candidate' })
    expect(candidate).toMatchObject({ first_verdict: 'fail', regenerated: true, regeneration: 'parsed', retry_verdict: 'pass', final_outcome: 'accepted_regenerated' })
    expect(candidate.first_claim_check_reasons[0]).toMatch(/^claim check:/)
    expect(summary.heldout.original.false_acceptances).toEqual(['heldout-01'])
    expect(summary.heldout.candidate.false_acceptances).toEqual([])
    expect(summary.heldout.candidate.true_rejections).toEqual(['heldout-01'])
    expect(summary.heldout.candidate.accepted_after_regeneration).toEqual(['heldout-01'])
    expect(summary.heldout.first_verdict_disagreements).toEqual(['heldout-01'])
  })

  it('records a false rejection and canonical fallback when the candidate holds a correct item twice', async () => {
    const { fetchImpl } = mockOllama(() => JSON.stringify(passVerdict), () => JSON.stringify({ ...plainRendering, long_definition: 'in a fictional hospital demo, nurses see only their unit.' }))
    const { rows, summary } = await runComparison(chatFor(fetchImpl), heldout(['heldout-21']), [])
    expect(rows[0].arms.candidate).toMatchObject({ first_verdict: 'fail', retry_verdict: 'fail', final_outcome: 'fell_back_to_canonical', fallback_reason: 'reverify-fail' })
    expect(summary.heldout.candidate.false_rejections).toEqual(['heldout-21'])
    expect(summary.heldout.candidate.fallbacks).toEqual(['heldout-21'])
    expect(summary.heldout.original.true_acceptances).toEqual(['heldout-21'])
  })

  it('counts model rejections for both arms and unparseable output as neither acceptance nor rejection', async () => {
    const { fetchImpl } = mockOllama(user => (user.includes('two passwords') ? 'not json' : JSON.stringify(failVerdict)), () => 'still not json')
    const { rows, summary } = await runComparison(chatFor(fetchImpl), heldout(['heldout-09', 'heldout-15']), [])
    const s = summary.heldout
    for (const arm of ['original', 'candidate'] as const) {
      expect(s[arm].unparseable_or_error).toEqual(['heldout-09'])
      expect(s[arm].false_rejections).toEqual(['heldout-15'])
      expect(s[arm].false_acceptances).toEqual([])
      expect(s[arm].fallbacks.sort()).toEqual(['heldout-09', 'heldout-15'])
    }
    const failed = rows.find(r => r.input.id === 'heldout-15')!.arms.original
    expect(failed).toMatchObject({ regenerated: true, regeneration: 'unparseable', fallback_reason: 'regenerate-unparseable' })
  })

  it('maps endpoint errors to fallback with the error recorded', async () => {
    const { fetchImpl } = mockOllama(() => '', undefined, 500)
    const { rows, summary } = await runComparison(chatFor(fetchImpl), heldout(['heldout-13']), [])
    expect(rows[0].arms.original).toMatchObject({ first_verdict: 'error', final_outcome: 'fell_back_to_canonical', fallback_reason: 'verify-error' })
    expect(rows[0].arms.original.error_text).toMatch(/http 500/)
    expect(summary.heldout.original.unparseable_or_error).toEqual(['heldout-13'])
  })

  it('times out a slow endpoint', async () => {
    const slow = ((_: string, init: any) => new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as unknown as typeof fetch
    const chat = ollamaChat({ baseUrl: 'http://x', model: 'm', temperature: 0, seed: 1, timeoutMs: 20, fetchImpl: slow })
    await expect(chat({ system: 's', user: 'u', maxTokens: 1 })).rejects.toThrow(/timeout after 20 ms/)
  })
})

describe('compare-verifiers-ollama main', () => {
  it('writes labeled results marked as a local substitute and refuses to overwrite them', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'verifier-compare-'))
    const out = pathToFileURL(dir + '/')
    const env = { OLLAMA_BASE_URL: 'http://ollama.test:11434', OLLAMA_MODEL: 'mock:1b', COMPARE_SETS: 'heldout', COMPARE_TAG: 'test' }
    const { fetchImpl } = mockOllama(() => JSON.stringify(passVerdict))
    const { result, rows } = await main(env, fetchImpl, out)
    expect(rows).toHaveLength(24)
    expect(result.status).toMatch(/local substitute/)
    expect(result.substitute_model).toBe('mock:1b')
    expect(result.shipped_model_not_used).not.toBe('mock:1b')
    expect(result.frozen_inputs.count).toBe(24)
    // Model always passes: original accepts all 12 incorrect, candidate catches 8 and holds 4 correct.
    expect(result.summary.heldout.original.false_acceptances).toHaveLength(12)
    expect(result.summary.heldout.candidate.false_acceptances).toHaveLength(4)
    expect(result.summary.heldout.candidate.false_rejections).toHaveLength(4)
    expect(readdirSync(dir).sort()).toEqual(['test-ollama-verifier-comparison-mock-1b.json', 'test-ollama-verifier-comparison-mock-1b.jsonl'])
    await expect(main(env, fetchImpl, out)).rejects.toThrow(/already exist/)
  })

  it('defaults to a small local model and the local Ollama port', async () => {
    const { config } = await import('../../eval/compare-verifiers-ollama')
    expect(config({})).toMatchObject({ baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2:3b', temperature: 0, sets: ['heldout', 'historical'] })
    expect(() => config({ COMPARE_SETS: 'nope' })).toThrow(/Unknown set/)
  })
})
