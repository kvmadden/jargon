# Verifier v2: results on the 50-item gold set (2026-11-13)

**Headline: a checker that pulls out each factual claim and asks whether a pharmacist would sign off caught 5 of the 5 errors the original checker approved (it caught 0 of 5), but only on the same model family, and how many correct explanations it wrongly flags (2 or 15 of 37, depending on the decision rule) waits on Kevin's labels.**

```
Known misses caught (5 confirmed wrong by Kevin Madden, PharmD)
v1 original, 10/30          ·····   0 of 5
v1 rerun, today             ·····   0 of 5
v2 same model, primary      ✓✓✓✓✓   5 of 5   false alarms 15 of 37
v2 same model, lenient      ✓✓✓✓·   4 of 5   false alarms  2 of 37
v2 Grok, primary            ✓✓✓✓×   4 of 5   false alarms 34 of 37   (× = no verdict)
```

## The table

Labels: 5 items are confirmed by Kevin. The other 45 carry **proposed** labels (an AI read, not ground truth), so every column except the first is provisional.

| verifier | known misses caught | all flawed caught (13, provisional) | false alarms on proposed-correct (37, provisional) | false alarms on the 7 Kevin reportedly judged correct | no verdict |
|---|---|---|---|---|---|
| v1 original (stored 10/30 verdicts) | 0/5 | 1/13 | 1/37 | 0/7 | 0 |
| v1 rerun today, same prompt and model | 0/5 | 0/13 | 1/37 | 0/7 | 0 |
| **v2, same model as v1, primary rule** | **5/5** | 12/13 | 15/37 | 6/7 | 0 |
| **v2, same model as v1, lenient rule** | **4/5** | 8/13 | 2/37 | 1/7 | 0 |
| v2, Grok, primary rule | 4/5 | 11/13 | 34/37 | 7/7 | 4 |
| v2, Grok, lenient rule | 4/5 | 11/13 | 33/37 | 7/7 | 4 |

Both decision rules were written into `lib.ts` and committed (0f513c2) before any scored call:
- **primary:** fail if any claim is wrong or misleading, or the expert would not sign off.
- **lenient:** fail only if a claim is wrong or the expert would not sign off.

## What it means

1. **The rubric is what helps, not the second family.** Every v1 verdict on the 5 known misses was a pass, both on 10/30 and today. On the same model, v2 found the exact error in each one: the unit-only chart access claim, the claim that staging is wired to real claims, store-scoped patient profiles, a "signed script label", and the prescription-transfer comparison.
2. **The primary rule is too strict to ship.** Its false alarms are pedantic "misleading" calls on ordinary workplace details (whether a staff pharmacist would see claims-system release notes, for example). It also flags 6 of the 7 explanations Kevin reportedly judged correct.
3. **The lenient rule is the candidate.** It caught 4 of 5 known misses with 2 false alarms (sec-mfa for the nurse and cloud-alert for the pharmacist). It missed the OAuth prescription-transfer miss, which it rated misleading while the expert still signed off.
4. **Grok is not a usable verifier at this rubric.** It said "no sign-off" on nearly everything, including "Claude, ChatGPT, Gemini, and Llama are all LLMs". It passed none of the 5 known misses (4 fails, 1 no verdict). 17 of its 50 first calls returned no verdict, and one retry recovered 13. In the 4 that failed twice, almost all output tokens were reasoning, so no answer came back. That cause is inferred, because the first run did not save the CLI output, and the fixed runner saved only its tail.

## Limits, stated plainly

- **Not an independent family.** The best result runs on the same model that wrote the explanations and ran v1.
- **In-sample.** The claim types were designed after reading the 5 misses. The prompt names none of them, but it is still tuned on the set it is scored on.
- **The proposed labels are Claude's.** The model family that labeled the set also wrote the rubric and ran the best arm.
- **The real held-out test has not been run.** The locked Part B blind set in `eval/fresh-blind-set/` was not touched, and it is scored once, after Kevin's form.
- **The v1 rerun used `claude -p`, not the API.** That means no max_tokens or temperature control. It still reproduced 0 of 5.

## How it ran

| arm | path | model reported | calls | median time | metered spend |
|---|---|---|---|---|---|
| v1 rerun | `claude -p`, Claude subscription | claude-opus-4-7 | 50 | 9 s | $0 (apiKeySource none on every call) |
| v2 same model | `claude -p`, Claude subscription | claude-opus-4-7 | 50 | 23 s | $0 (apiKeySource none on every call) |
| v2 Grok | `grok` CLI, X subscription (grok.com login) | grok-4.7-build | 67 (50 + 17 retries) | 140 s | $0 expected, no API key in env |

The CLIs print notional token prices ($1.56, $3.88 and $7.42). Those prices are not charges. Claude auth is verified per call. For Grok, the login and the absence of a key are verified, and that the plan does not bill per token is inferred. The Gemini sub-pools (Flash, Hydrogen) were out of quota until about 11/15, the Argon pool was skipped under the no-bulk ruling, and the OpenAI pool was out until 11/14. Calls ran one at a time. A load check before each call paused the run whenever the 1-minute load went over 150.

Reproduce:

```sh
node eval/verifier-v2/build-gold.mjs        # same 50 items, deterministic
node eval/verifier-v2/run-verifiers.ts --arm v2-claude
node eval/verifier-v2/score.ts              # table and results/summary.json
```

## What still needs Kevin

1. **Label 45 items** in `gold/confirm.json`. Set `kevin_label` on each, and the scorer picks it up. The 7 items with a `prior_ruling` were recorded as correct on the unmerged PR #1 branch from a task brief, so they need confirming here.
2. **The 2 lenient false alarms and the 5 proposed misleading items** decide the real false-alarm rate. Start with those: sec-mfa (nurse), cloud-alert (pharmacist), sys-http-header (pharmacist), sys-payload (nurse), aid-parameters (pharmacist), sys-http-response (pharmacist) and ai-llm (pharmacist).
3. **Decide whether v2 lenient runs on the Part B blind set.** That is the only out-of-sample test available.
