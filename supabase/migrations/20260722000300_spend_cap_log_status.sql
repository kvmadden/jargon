-- Allow the spend guard's 'skipped-over-cap' status in the 6 *_log final_status
-- CHECK constraints. Over-cap runtime was already safe (the guard skips the model
-- and returns the fallback); this lets the audit row actually persist instead of
-- being rejected (23514) + swallowed. Each ALTER re-adds the exact existing values
-- plus 'skipped-over-cap'. (grade_sentence_log + lesson_question_log use free-form
-- `status text`, no constraint change needed.)

alter table compose_gift_log drop constraint compose_gift_log_final_status_check;
alter table compose_gift_log add constraint compose_gift_log_final_status_check
  check (final_status = any (array['success-high','success-medium','success-low','fallback-empty-input','fallback-pass1-parse','fallback-pass1-anthropic-error','fallback-pass1-timeout','fallback-no-anthropic-key','skipped-over-cap']));

alter table etymology_generation_log drop constraint etymology_generation_log_final_status_check;
alter table etymology_generation_log add constraint etymology_generation_log_final_status_check
  check (final_status = any (array['success-verified','success-retry-verified','fallback-pass1-parse','fallback-pass2-parse','fallback-pass2-fail-no-retry','fallback-pass2-retry-parse','fallback-anthropic-error','fallback-timeout','skipped-over-cap']));

alter table job_followup_log drop constraint job_followup_log_final_status_check;
alter table job_followup_log add constraint job_followup_log_final_status_check
  check (final_status = any (array['success','success-empty','fallback-empty-input','fallback-parse','fallback-anthropic-error','fallback-timeout','skipped-over-cap']));

alter table lived_icon_generation_log drop constraint lived_icon_generation_log_final_status_check;
alter table lived_icon_generation_log add constraint lived_icon_generation_log_final_status_check
  check (final_status = any (array['success','fallback-empty','fallback-parse','fallback-anthropic-error','fallback-gemini-error','fallback-storage-error','fallback-rate-limited','fallback-timeout','skipped-over-cap']));

alter table personalize_log drop constraint personalize_log_final_status_check;
alter table personalize_log add constraint personalize_log_final_status_check
  check (final_status = any (array['cached','fallback-no-profile','fallback-pass1-parse','fallback-pass2-parse','fallback-pass2-fail','fallback-pass3-parse','fallback-pass2-retry-fail','fallback-anthropic-error','fallback-timeout','skipped-over-cap']));

alter table pick_lived_icons_log drop constraint pick_lived_icons_log_final_status_check;
alter table pick_lived_icons_log add constraint pick_lived_icons_log_final_status_check
  check (final_status = any (array['success','fallback-empty','fallback-parse','fallback-anthropic-error','fallback-timeout','skipped-over-cap']));
