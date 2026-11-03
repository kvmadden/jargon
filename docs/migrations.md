# Migrations added by the evaluation work

Kevin approved the first four migrations on 2026-11-03. The fifth, term expansions, is new in this round and still needs his approval. They go to production only after the pull requests merge. Each one is safe to run more than once, and a SQL test runs each one twice against the real earlier migrations (`npm run test:sql`).

| Migration | What it does | Why it is safe to rerun | SQL test |
| --- | --- | --- | --- |
| `20261103000000_personalize_log_v10.sql` | Adds prompt_version, profile_version, model, needs_review, gate_result and call_details to personalize_log, allows the 16 statuses the function writes (including skipped-unsupported-field and skipped-no-analogy from prompt version 11), and adds two indexes | `add column if not exists`, `drop constraint if exists` before `add constraint`, `create index if not exists` | `test_personalize_log_v10.sql` |
| `20261103000100_canonical_corrections.sql` | Corrects three canonical entries (staging and the live payment account, calculated-column totals, model parameter counts), in the shortened wording Kevin asked for, and removes cached renderings of those three terms | Each update applies only while the original wrong text is still there, so a second run or a later curator edit changes nothing | `test_canonical_corrections.sql` |
| `20261103000200_hide_unreviewed_generated_terms.sql` | Hides terms written by the ingest model from learners until a person sets reviewed_at | `drop policy if exists` before `create policy`, `create index if not exists` | `test_unreviewed_generated_terms.sql` |
| `20261103000300_ingestion_log_failure_pass.sql` | Lets ingestion_log record failure_pass 'pass1', 'insert' and 'budget' | `drop constraint if exists` before `add constraint` | `test_ingestion_log_failure_pass.sql` |
| `20261103000400_term_expansions.sql` | Adds an expansion column to terms and fills it for 147 seed terms: what each abbreviation, initialism, acronym or clipped word stands for, or a flag that a name only looks like one. Generated from `supabase/term-expansions.json` | `add column if not exists`, and each update sets the same value again | `test_term_expansions.sql` |

## Applying them

Apply in file-name order, after the pull requests merge, with the usual `supabase db push`. Apply them before deploying the personalize-term function, because the new function reads `terms.expansion` and would fail on a database without that column.

The v10 migration was edited after Kevin's approval, to allow the two prompt version 11 statuses (skipped-unsupported-field and skipped-no-analogy). Without them the function's log rows for those requests would be rejected.

## Undoing them

- `personalize_log_v10`: the new columns can stay. To undo the status list, restore the constraint from `20260722000300_spend_cap_log_status.sql`.
- `canonical_corrections`: the original text is in the migration itself, as the guard of each update.
- `hide_unreviewed_generated_terms`: the undo steps are in the file's header comment.
- `ingestion_log_failure_pass`: restore the earlier constraint list, after deleting or relabeling rows that use the new values.
- `term_expansions`: `alter table terms drop column expansion`. The app shows no expansion line when the column is empty.
