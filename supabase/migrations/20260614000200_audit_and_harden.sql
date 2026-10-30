-- jargon Stage B+1.47 — Audit and Harden Database SQL
-- Fix referential integrity gaps, correct dangling references, and align domain path invariants.

-- 1. Refile legacy B3 terms with path 'ai-ml' to 'ai-engineering'
update terms
set path = 'ai-engineering'
where path = 'ai-ml';

-- 2. Correct dangling stretch_term references by setting them to NULL
update terms
set stretch_term = null
where stretch_term in (
  'cloud-cron',
  'bi-filter-context',
  'bi-app',
  'excel-xlookup',
  'bi-directquery',
  'fabric-spark-job',
  'fw-tailwind',
  'fw-swiftui',
  'ml-training-data',
  'copilot-knowledge-source',
  'copilot-connector',
  'ml-model'
);

-- 3. Repoint dangling stretch_term references from deleted duplicate terms to surviving ones
update terms
set stretch_term = 'data-transaction'
where stretch_term = 'sys-transaction';

update terms
set stretch_term = 'data-backfill'
where stretch_term = 'sys-backfill';

update terms
set stretch_term = 'web-status-code'
where stretch_term = 'sys-status-code';

update terms
set stretch_term = 'sys-http-header'
where stretch_term = 'web-header';

-- 4. Correct dangling related_terms arrays (remove invalid or cross-domain elements)
update terms
set related_terms = array_remove(related_terms, 'ml-supervised-learning')
where id = 'ml-label';

update terms
set related_terms = array_remove(related_terms, 'ml-prediction')
where id in ('ml-feature', 'ml-inference');

update terms
set related_terms = array_remove(related_terms, 'aid-rag')
where id = 'ai-rag';

update terms
set related_terms = array_remove(related_terms, 'ml-feature')
where id = 'ai-embedding';

update terms
set related_terms = array_remove(related_terms, 'aid-embedding')
where id = 'ai-embedding';

update terms
set related_terms = array_remove(related_terms, 'aid-evals')
where id = 'ai-evals';

update terms
set related_terms = array_remove(related_terms, 'aid-guardrails')
where id = 'ai-guardrails';

update terms
set related_terms = array_remove(related_terms, 'aid-tool-call')
where id = 'ai-tool-call';

update terms
set related_terms = array_remove(related_terms, 'aid-vector-database')
where id = 'ai-vector-store';

-- 5. Add referential integrity constraints
-- A. Ensure stretch_term must exist in the terms table (on delete set null)
alter table terms
  add constraint fk_terms_stretch_term foreign key (stretch_term) references terms(id) on delete set null;

-- B. Ensure personalize_log rows are cleaned up when users or terms are deleted
alter table personalize_log
  add constraint fk_personalize_log_user foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint fk_personalize_log_term foreign key (term_id) references terms(id) on delete cascade;

-- 6. Add check constraints for domain/path consistency and non-negativity
-- A. Enforce that domain='ai' iff the path belongs to the AI domain taxonomy
alter table terms
  add constraint terms_domain_path_check check (
    (domain = 'ai' and path in ('ai-foundations','ai-tools','ai-prompting','ai-products','ai-evaluation','ai-policy')) or
    (domain = 'coding' and path in (
      'git-cli','dev-concepts','enterprise','claude-code','ai-engineering','agile','systems',
      'programming','dev-tooling','dev-workflow','web-api','databases','computing','networking',
      'security','architecture','systems-engineering','cloud-devops','qa-reliability','math-logic',
      'tech-stack','enterprise-platforms','data-analytics'
    ))
  );

-- B. Enforce non-negativity check constraints on streak_log
alter table streak_log
  add constraint streak_log_lessons_completed_check check (lessons_completed >= 0),
  add constraint streak_log_xp_earned_check check (xp_earned >= 0);

-- C. Enforce check constraints on user_progress metrics
alter table user_progress
  add constraint user_progress_correct_count_check check (correct_count >= 0),
  add constraint user_progress_incorrect_count_check check (incorrect_count >= 0),
  add constraint user_progress_ease_factor_check check (ease_factor > 0.0),
  add constraint user_progress_lapse_count_check check (lapse_count >= 0);
