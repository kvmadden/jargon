-- jargon Stage B+1.18 — fix mangled em-dash encoding across term content
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Problem: 90 rows in `terms` have a 7-byte sequence where an em dash (—)
--   should be (3 bytes). The string is U+201A (‚) + U+00C4 (Ä) + U+00EE (î).
--   The proper character is U+2014 (—).
--
-- Using chr() function calls so the SQL source is PURE ASCII and survives
-- any paste / dashboard encoding round-trip. Postgres evaluates chr()
-- server-side. 100% reliable.
--
-- Idempotent.

-- Helper note: build the broken sequence and the fix as expressions.
--   broken = chr(8218) || chr(196) || chr(238)   -- 'low9-quote + A-umlaut + i-circumflex'
--   fixed  = chr(8212)                            -- proper em dash —

-- 1. Scalar text columns
update terms set
  one_line_definition    = replace(one_line_definition,    chr(8218) || chr(196) || chr(238), chr(8212)),
  long_definition        = replace(long_definition,        chr(8218) || chr(196) || chr(238), chr(8212)),
  example_in_sentence    = replace(example_in_sentence,    chr(8218) || chr(196) || chr(238), chr(8212)),
  why_it_matters         = replace(why_it_matters,         chr(8218) || chr(196) || chr(238), chr(8212)),
  fill_in_blank_sentence = replace(coalesce(fill_in_blank_sentence, ''), chr(8218) || chr(196) || chr(238), chr(8212)),
  use_in_sentence_prompt = replace(use_in_sentence_prompt, chr(8218) || chr(196) || chr(238), chr(8212))
where one_line_definition    like '%' || chr(8218) || chr(196) || chr(238) || '%'
   or long_definition        like '%' || chr(8218) || chr(196) || chr(238) || '%'
   or example_in_sentence    like '%' || chr(8218) || chr(196) || chr(238) || '%'
   or why_it_matters         like '%' || chr(8218) || chr(196) || chr(238) || '%'
   or coalesce(fill_in_blank_sentence, '') like '%' || chr(8218) || chr(196) || chr(238) || '%'
   or use_in_sentence_prompt like '%' || chr(8218) || chr(196) || chr(238) || '%';

-- 2. Distractor array
update terms set
  multiple_choice_distractors = (
    select array_agg(replace(elem, chr(8218) || chr(196) || chr(238), chr(8212)))
    from unnest(multiple_choice_distractors) as elem
  )
where array_to_string(multiple_choice_distractors, '|') like '%' || chr(8218) || chr(196) || chr(238) || '%';

-- 3. Verify (run separately to confirm 0 remaining):
-- select count(*) from terms where one_line_definition like '%' || chr(8218) || chr(196) || chr(238) || '%';
