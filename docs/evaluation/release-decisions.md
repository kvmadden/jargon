# Outstanding release decisions after the October 31 review

Both PR #1 and dependent PR #2 remain HOLD. The offline UI includes the production verifier change. Keep the stack together and do not merge either PR until the following gates are met. This preserves the requested branch order rather than splitting the UI into a new experiment.

## Expert adjudication

Kevin or another domain expert must review these seven additional historical holds. No new expert labels were supplied during this fix. All seven remain unadjudicated. The candidates and policy reasons are preserved in [the unchanged replay](../../eval/results/claim-check-replay-v1.json), keyed by these IDs.

| Saved candidate ID | Expert decision | Required evidence |
| --- | --- | --- |
| `excel-pivot-table::nurse` | Pending | Reviewer, date, correctness of each claim, rationale and whether the hold loses useful personalization |
| `sec-mfa::pharmacist` | Pending | Reviewer, date, correctness of each claim, rationale and whether the hold loses useful personalization |
| `sec-mfa::nurse` | Pending | Reviewer, date, correctness of each claim, rationale and whether the hold loses useful personalization |
| `fabric-data-pipeline::pharmacist` | Pending | Reviewer, date, correctness of each claim, rationale and whether the hold loses useful personalization |
| `sec-oauth::nurse` | Pending | Reviewer, date, correctness of each claim, rationale and whether the hold loses useful personalization |
| `sec-rbac::nurse` | Pending | Reviewer, date, correctness of each claim, rationale and whether the hold loses useful personalization |
| `data-join::nurse` | Pending | Reviewer, date, correctness of each claim, rationale and whether the hold loses useful personalization |

Review the full candidate against its original source and fictional learner profile. Record whether the candidate is correct, incorrect or uncertain separately from whether the abstention policy should hold it. An automated policy decision is not an expert truth label. Do not infer positive labels for the other outputs.

## Faithful model comparison

Kevin must authorize an inference path for the unchanged original verifier and the candidate verifier, or provide authorized results. The current instruction forbids spending. No API request, credential lookup or substitute-model evaluation was performed.

Use identical frozen inputs and candidates for both paths, preserving the original verifier prompt and settings. Retain the 24-item set and its labels unchanged. Publish each verdict, false acceptance, false rejection, regeneration result and retry or canonical-fallback outcome, including failures and unknowns. Separate historical replay from newly generated model evidence. Do not describe the deterministic holds as measured model improvement.

Local tests, a successful build and PostgreSQL ACL checks cannot satisfy either release gate. No hosted inference, Deno deployment or head-matched preview is certified by these fixes.
