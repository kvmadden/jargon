# Outstanding release decisions after the October 31 review

Both PR #1 and dependent PR #2 remain HOLD. The offline UI includes the production verifier change. Keep the stack together and do not merge either PR until both gates below are met. Gate 1, expert adjudication, was met on November 1, 2026. Gate 2, the faithful model comparison, is still open. This preserves the requested branch order rather than splitting the UI into a new experiment.

## Expert adjudication: met on November 1, 2026

Kevin Madden, PharmD reviewed the seven additional historical holds on 2026-11-01 against their saved text and judged all seven correct. The labels are recorded in [`eval/data/expert-adjudication-2026-11-01.json`](../../eval/data/expert-adjudication-2026-11-01.json) with reviewer, date and provenance. The judgment was supplied in the task assignment for this change. That file records it and is not a new review session. No per-claim notes were supplied beyond the overall judgment for each saved explanation.

The expert label and the policy decision are separate columns. The policy held each output automatically. The expert label says whether the output was right.

| Saved candidate ID | Expert label | Reviewer | Date | Policy decision | Outcome |
| --- | --- | --- | --- | --- | --- |
| `excel-pivot-table::nurse` | Correct | Kevin Madden, PharmD | 2026-11-01 | Hold | False hold |
| `sec-mfa::pharmacist` | Correct | Kevin Madden, PharmD | 2026-11-01 | Hold | False hold |
| `sec-mfa::nurse` | Correct | Kevin Madden, PharmD | 2026-11-01 | Hold | False hold |
| `fabric-data-pipeline::pharmacist` | Correct | Kevin Madden, PharmD | 2026-11-01 | Hold | False hold |
| `sec-oauth::nurse` | Correct | Kevin Madden, PharmD | 2026-11-01 | Hold | False hold |
| `sec-rbac::nurse` | Correct | Kevin Madden, PharmD | 2026-11-01 | Hold | False hold |
| `data-join::nurse` | Correct | Kevin Madden, PharmD | 2026-11-01 | Hold | False hold |

All seven held explanations were correct, so the added policy held seven correct explanations. These are false holds. Each one is useful personalization that the policy would have sent to regeneration and, if the retry was also held, to canonical text.

### Recomputed historical tradeoff

Source: [`eval/results/claim-check-adjudicated-2026-11-01.json`](../../eval/results/claim-check-adjudicated-2026-11-01.json), produced by `node eval/apply-expert-adjudication.ts` from the unchanged replay.

| 78 saved accepted outputs | Original pipeline | With added policy |
| --- | ---: | ---: |
| Expert-confirmed wrong outputs accepted, out of 5 | 5 | 0 |
| Expert-confirmed correct outputs held, out of 7 | 0 | 7 |
| Total holds | 0 | 12 |
| Holds that were real errors | n/a | 5 of 12 |
| Accepted outputs with no expert label | 73 | 66 |

On this run the policy held more correct explanations (7) than wrong ones (5). Every hold now has an expert label, so 5 of 12 is the measured share of holds that caught a real error in this run. The 66 outputs the policy leaves alone are still unlabeled, so errors among them are unknown. Whether regeneration would have recovered useful text for the seven false holds is not measured. The frozen synthetic set shows the same pattern, with 4 of 12 correct items rejected.

This gate is about evidence, not approval. Whether the cost of seven false holds is worth five caught errors is a product decision for Kevin. It has not been made here.

## Faithful model comparison

Kevin must authorize an inference path for the unchanged original verifier and the candidate verifier, or provide authorized results. The current instruction forbids spending. No API request, credential lookup or substitute-model evaluation was performed.

Use identical frozen inputs and candidates for both paths, preserving the original verifier prompt and settings. Retain the 24-item set and its labels unchanged. Publish each verdict, false acceptance, false rejection, regeneration result and retry or canonical-fallback outcome, including failures and unknowns. Separate historical replay from newly generated model evidence. Do not describe the deterministic holds as measured model improvement.

Local tests, a successful build and PostgreSQL ACL checks cannot satisfy either release gate. No hosted inference, Deno deployment or head-matched preview is certified by these fixes.
