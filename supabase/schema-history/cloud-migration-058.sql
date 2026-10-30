-- jargon Stage B+1.19 - Agent Suite naming cleanup for Claude Code anchors
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Fixes two current-data strings that still called the development agent
-- suite "Madden Team". Active display name is Agent Suite.
--
-- Scope:
--   - terms.why_it_matters for cc-agent
--   - terms.why_it_matters for cc-task-tool
--   - personalized rendering cache rows for those same terms only when the
--     cached text still contains the retired phrase
--
-- Does NOT rewrite historical migrations or personalize_log audit history.
--
-- IDEMPOTENT: guarded by id + old phrase checks.

update terms
set why_it_matters =
  'You already use Agent Suite: a set of specialized coding agents such as spec-writer, ui-designer, react-builder, code-reviewer, qa-tester, visual-qa, build-order-agent, invoke-subagent-agent, skill-creator-agent, hallucination-tripwire-agent, monitor-instead-of-poll-agent, and anonymous-feedback-honest-agent. Knowing what "agent" means here makes the orchestration model click.'
where id = 'cc-agent'
  and why_it_matters like '%Madden Team%';

update terms
set why_it_matters =
  'Whenever Agent Suite agents get invoked, the main Claude is using the Task tool to spawn them. Knowing the term connects "the agent ran" to a specific mechanism.'
where id = 'cc-task-tool'
  and why_it_matters like '%Madden Team%';

delete from user_term_renderings
where term_id in ('cc-agent', 'cc-task-tool')
  and (
    long_definition like '%Madden Team%'
    or why_it_matters like '%Madden Team%'
    or example_in_sentence like '%Madden Team%'
  );

-- Verify after apply:
-- select id, why_it_matters
-- from terms
-- where id in ('cc-agent', 'cc-task-tool')
--   and why_it_matters like '%Madden Team%';
