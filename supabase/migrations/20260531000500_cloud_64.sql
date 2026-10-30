-- jargon Stage B+1.24 — pronunciation cleanup for initialisms (paste-ready)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds missing say-it hints for existing curated terms that include visible
-- initialisms. Local seed mirror updated in supabase/seed.sql.

update terms
set pronunciation = 'M-C-P server'
where id = 'cc-mcp-server';

update terms
set pronunciation = 'M-C-P client'
where id = 'cc-mcp-client';

update terms
set pronunciation = 'code review / P-R review'
where id = 'agile-code-review';

update terms
set pronunciation = 'A-P-I gateway'
where id = 'sys-api-gateway';

update terms
set pronunciation = 'stacked P-R'
where id = 'ent-stacked-pr';

update terms
set pronunciation = 'draft P-R'
where id = 'ent-draft-pr';

update terms
set pronunciation = 'visual Q-A'
where id = 'agile-visual-qa';
