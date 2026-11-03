\set ON_ERROR_STOP on

-- Applies the canonical corrections migration to a fixture holding the old
-- text, plus one entry a curator edited afterwards. Run by scripts/test-sql.sh.
create table terms (
  id text primary key,
  long_definition text,
  example_in_sentence text,
  why_it_matters text,
  fill_in_blank_sentence text
);
create table user_term_renderings (user_id uuid, term_id text);

insert into terms values ('aid-parameters', 'When you see a model described as "70B" or "405B," that "B" means billion parameters. Parameters are the internal settings a model fine-tuned during training — billions of tiny adjustments that together encode what it knows. More parameters generally mean better answers but slower responses and higher cost per inference. The biggest open-weight models (Llama 405B) and frontier models (Claude, GPT-5) are both in the hundreds of billions of parameters.', 'Llama 3 70B has 70 billion parameters — smaller than Claude but small enough to run on a laptop.', 'Reading product names like "GPT-5", "Claude Opus 4.7", "Gemini 2.5 Pro", or "Llama 405B" makes more sense once you know that the "B" is billions of parameters. It is the simplest rough comparison of model heft, even though parameters alone do not tell you everything about quality.', 'unchanged');
insert into terms values ('bi-calculated-column', 'unchanged', 'unchanged', 'a calculated column is figured out once per row and frozen into the table, unlike a measure that recalculates with filters. mixing them up is a classic Power BI mistake — using a column where you needed a measure gives you totals that won''t move when you slice.', 'unchanged');
insert into terms values ('cloud-environment', 'unchanged', 'the bug only shows up in the staging environment because that''s the only place pointed at the real payment provider.', 'unchanged', 'the bug only shows up in the staging ___ because that''s the only place pointed at the real payment provider.');
-- A curator already rewrote this one, so the migration must not touch it.
insert into terms values ('curator-edited', 'x', 'x', 'x', 'x');
insert into user_term_renderings values ('11111111-1111-1111-1111-111111111111', 'cloud-environment'), ('11111111-1111-1111-1111-111111111111', 'sec-mfa');

\ir ../migrations/20261103000100_canonical_corrections.sql

do $$
declare n int;
begin

  select count(*) into n from terms where id = 'cloud-environment' and example_in_sentence = 'The bug shows up in staging but not in production, since staging uses a test payment account.';
  if n <> 1 then raise exception 'not corrected: cloud-environment.example_in_sentence'; end if;
  select count(*) into n from terms where id = 'cloud-environment' and fill_in_blank_sentence = 'The bug shows up in the staging ___ but not in production, since staging uses a test payment account.';
  if n <> 1 then raise exception 'not corrected: cloud-environment.fill_in_blank_sentence'; end if;
  select count(*) into n from terms where id = 'aid-parameters' and long_definition = 'When a model is called "70B" or "405B," the "B" means billions of parameters. Parameters are the numbers a model learns in training. More parameters usually mean better answers but slower, costlier responses. Anthropic and OpenAI do not publish counts for Claude or GPT-5.';
  if n <> 1 then raise exception 'not corrected: aid-parameters.long_definition'; end if;
  select count(*) into n from terms where id = 'aid-parameters' and example_in_sentence = 'Llama 3 70B has 70 billion parameters, so it needs a machine with a lot of memory.';
  if n <> 1 then raise exception 'not corrected: aid-parameters.example_in_sentence'; end if;
  select count(*) into n from terms where id = 'aid-parameters' and why_it_matters = 'Names like "Llama 3 70B" make sense once you know the "B" means billions of parameters. Size gives a rough sense of a model''s power and cost, but it does not tell you everything about quality.';
  if n <> 1 then raise exception 'not corrected: aid-parameters.why_it_matters'; end if;
  select count(*) into n from terms where long_definition = 'unchanged' or example_in_sentence = 'unchanged';
  if n < 1 then raise exception 'fixture lost its untouched fields'; end if;
  select count(*) into n from user_term_renderings where term_id = 'cloud-environment';
  if n <> 0 then raise exception 'stale rendering of a corrected term kept'; end if;
  select count(*) into n from user_term_renderings where term_id = 'sec-mfa';
  if n <> 1 then raise exception 'rendering of an unrelated term removed'; end if;
end $$;
\echo 'canonical corrections: ok'

-- The corrected bi-calculated-column text applied on the first run.
do $$
declare n int;
begin
  select count(*) into n from terms where id = 'bi-calculated-column'
    and why_it_matters like 'A calculated column is worked out once per row and stored.%';
  if n <> 1 then raise exception 'not corrected: bi-calculated-column.why_it_matters'; end if;
end $$;

-- A curator then edits the entry. Running the migration again must keep the edit.
update terms set why_it_matters = 'a curator rewrote this sentence' where id = 'bi-calculated-column';
\ir ../migrations/20261103000100_canonical_corrections.sql
do $$
declare n int;
begin
  select count(*) into n from terms where id = 'bi-calculated-column' and why_it_matters = 'a curator rewrote this sentence';
  if n <> 1 then raise exception 'overwrote a curator edit'; end if;
end $$;
\echo 'canonical corrections: curator edit kept'
