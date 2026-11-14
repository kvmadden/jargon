# Verifier v2: results (2026-11-13)

**Headline: a two-family consensus verifier (Claude Opus 5.5 and Gemini 3.8 Flash must both object) caught all 5 errors the original verifier approved, with 3 false alarms in 37 on the development set, and the held-out test could not run because the locked Part B set can no longer be found.**

```
Development set, 50 items (5 confirmed misses, 37 proposed correct)

                                   known misses   false alarms
v1 original, 10/30                 ·····  0/5      1/37
v2, Opus 4.7, lenient       it0    ✓✓✓✓·  4/5      2/37
v2, Grok                    it0    ✓✓✓✓×  4/5     34/37
v2, Opus 5.5, lenient       it3    ✓✓✓✓✓  5/5     18/37
v3 two-pass, Opus 5.5       it4    ✓✓✓✓✓  5/5      5/37
v2, Gemini Flash            it5    ✓✓✓✓✓  5/5     10/37
FROZEN: it4 AND it5         it6    ✓✓✓✓✓  5/5      3/37   target: ≥4/5 and ≤3/37
```

## The frozen rule

Fail an explanation only when both verifiers fail it:
- **v3 on claude-opus-5-5.** Pass one extracts typed claims. Pass two checks each claim against a 15-fact reference list and general knowledge, with an abstain option.
- **v2 on Gemini 3.8 Flash (High), lenient rule.** A single pass extracts claims, and the explanation fails on a wrong claim or no expert sign-off.

If either verdict is missing or abstains, the rule abstains, so a broken call can never pass an explanation. The rule is frozen with prompt hashes in [`FROZEN-RULE.json`](FROZEN-RULE.json), and a test fails if any frozen prompt changes.

## Development set table (all runs)

`node eval/verifier-v2/score.ts` prints this table and writes `results/summary.json`. "Flawed" and "false alarms" use proposed labels.

| run | known misses | flawed caught | false alarms | on 7 reported correct |
|---|---|---|---|---|
| v1 original (stored 10/30 verdicts) | 0/5 | 1/13 | 1/37 | 0/7 |
| v1 rerun, claude-opus-4-7 | 0/5 | 0/13 | 1/37 | 0/7 |
| it0 v2, claude-opus-4-7, primary | 5/5 | 12/13 | 15/37 | 6/7 |
| it0 v2, claude-opus-4-7, lenient | 4/5 | 8/13 | 2/37 | 1/7 |
| it0 v2, grok-4.7-build, primary (4 no verdict) | 4/5 | 11/13 | 34/37 | 7/7 |
| it3 v2, claude-opus-5-5, lenient | 5/5 | 13/13 | 18/37 | 2/7 |
| it4 v3, claude-opus-5-5 | 5/5 | 13/13 | 5/37 | 0/7 |
| it5 v2, Gemini 3.8 Flash, lenient | 5/5 | 12/13 | 10/37 | 3/7 |
| **it6 frozen consensus (it4 AND it5)** | **5/5** | **12/13** | **3/37** | **0/7** |

Every iteration, including the smoke-only it2a and it2b and the offline rule search in it1, is in [`ITERATIONS.jsonl`](ITERATIONS.jsonl).

What the iterations showed:
1. **The claim rubric is what finds the misses.** The original verifier passed all 5 both times. Every v2 and v3 run on a capable model caught at least 4.
2. **Each model alone is either too strict or too lenient.** Opus 5.5 signs off on almost nothing, and Grok on nothing. In the two-pass design, Opus 4.7 excused real errors as "imprecise" even when its own reasons named the error.
3. **Requiring two families to agree cuts the false alarms.** v3 on Opus 5.5 and Gemini Flash disagreed on most of their false alarms but agreed on all 5 known misses.
4. **The remaining errors.** The 3 consensus false alarms are aid-accuracy (pharmacist), sys-payload (pharmacist) and sec-mfa (teacher). The one flawed item it passes is bi-calculated-column (pharmacist).

## Part B (held-out): not run

- **The set is missing.** The locked Part B set (345 renderings, manifest sha256 `9294113…0995` in `eval/fresh-blind-set/lock.json`) was staged in a session scratchpad that no longer exists. The evidence folder of the 11/3 pass keeps only request hashes and verdicts. Searches of the evidence drive, the working folders and the file index found no copy.
- **No expert labels are on record.** The repository applies no amendment from Kevin's 30-item clinical review, so Part B has no labels Kevin ruled on.
- **No numbers exist.** With no renderings, not even a flag rate could be produced. The frozen rule was not run, and nothing was scored. Finding a copy (checked against the manifest hash) or recording the set as lost is queued as an agent task. It also blocks the pre-registered scoring of the original 11/3 pass.

## Limits

- **Dev-set numbers are optimistic by construction.** The rule was chosen after searching 6 decision rules and 2 combinations on these 50 items. The rubric was written after reading the 5 misses. The reference list leaves out every fact behind those misses, and a test enforces that.
- **The labels are noisy.** 45 of the 50 labels are proposals by Claude, the family behind one of the two verifiers. Some objections counted as false alarms are defensible, for example that fall rates need patient-days. The labels were frozen before any run (hash checked by a test) and were not changed after seeing verdicts.
- **No outside expert has checked anything.** Only the 5 known misses carry an expert ruling.

## How it ran

Calls went one at a time through subscription CLIs, with no metered key. Claude calls ran through `claude -p` and reported `apiKeySource: none` on every call. Gemini ran through `agy` on the Google login, and Grok through the grok.com login. The runner removes metered-key variables from the environment and pauses whenever the 1-minute load is over 150. Runs ran in visible terminal tabs with saved logs.

```sh
node eval/verifier-v2/run-verifiers.ts --arm v3-claude --model claude-opus-5-5 --tag <name>
node eval/verifier-v2/run-verifiers.ts --arm v2-gemini --tag <name>
node eval/verifier-v2/score.ts
```
