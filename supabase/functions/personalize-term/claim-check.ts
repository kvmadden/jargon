import type { ParsedRendering, VerifierVerdict } from './prompts.ts'

// Supplemental abstention policy, not a factual classifier. Clinical access and
// credential analogies need domain evidence that this pipeline does not have.
// Check all three fields, regardless of the model's uses_analogy self-report.
// Deliberately conservative: negations and fictional systems can also be held.
const clinicalDomain = /\b(hospital|nurs\w*|pharmac\w*|patient\w*|prescri\w*|dispens\w*|charts?|ehr|script\s+labels?)\b/i
const accessOrCredential = /\b(open|view|see|sees|show|shows|hide|hides|access|login|logins|password|passwords|signed|signature|tamper[\w-]*)\b/i

export function checkCandidateClaims(candidate: ParsedRendering): string[] {
  const reasons = new Set<string>()
  for (const text of Object.values(candidate)) {
    for (const sentence of text.split(/[.!?\n]+/)) {
      if (clinicalDomain.test(sentence) && accessOrCredential.test(sentence)) {
        reasons.add('claim check: clinical access or credential claims require domain evidence unavailable here. Rewrite without this analogy or workflow claim.')
      }
      if (/\bstaging\b/i.test(sentence) && /\bonly\b/i.test(sentence)
        && /\bconnect\w*\b/i.test(sentence) && /\breal\b/i.test(sentence)) {
        reasons.add('claim check: staging described as the exclusive connection to a real system. Remove the unsupported exclusivity and preserve the production versus testing distinction.')
      }
    }
  }
  return [...reasons]
}

export function applyClaimCheck(candidate: ParsedRendering, verdict: VerifierVerdict): VerifierVerdict {
  const reasons = checkCandidateClaims(candidate)
  if (reasons.length === 0) return verdict
  return {
    ...verdict,
    technical_accuracy_preserved: {
      result: 'fail',
      reasoning: [verdict.technical_accuracy_preserved.reasoning, ...reasons].join(' '),
    },
    overall: 'fail',
  }
}

// Shared by the Edge Function and the network eval runner. A failed check enters
// the existing one-retry path. The retry is subject to the identical policy.
export function claimCheckedParser(candidate: ParsedRendering, parse: (raw: string) => VerifierVerdict | null) {
  return (raw: string): VerifierVerdict | null => {
    const verdict = parse(raw)
    return verdict ? applyClaimCheck(candidate, verdict) : null
  }
}
