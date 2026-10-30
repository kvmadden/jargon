-- Jargon Stage B3 — 27 more curated anchor terms for the agile path
-- All difficulty 1, all curated, reviewed by the curator on 2026-05-04.
-- Voice matches the existing 3 agile anchors (agile-sprint / agile-standup /
-- agile-ticket template) — translator-not-professor: name what the thing IS
-- (event / role / artifact) in plain English, ground "why_it_matters" in
-- (a) following Claude Code OR (b) talking to dev family who throw these
-- terms at the owner daily. Process vocab matters because devs use it as
-- compressed shorthand.
--
-- Idempotent: `on conflict (id) do nothing` so re-runs don't fail and don't
-- overwrite anything an upstream cloud migration already inserted.
--
-- Dictionary count after this migration:
--   agile: 3 → 30  (3 existing + 27 new)
--   total: 156 → 183
--
-- Distractor strategy: each row's three distractors describe OTHER agile
-- concepts (or adjacent process artifacts) so a half-knowledgeable learner
-- gets tricked. For role acronyms (PO/SM/PM/EM) the distractors describe the
-- OTHER roles in the same family — same neighborhood, distinct jobs.
--
-- Cross-references: every related_terms / prerequisites / stretch_term id
-- resolves to one of the existing 156 anchors or one of these 27. Rich
-- internal cross-linking inside the path:
--   • agile-sprint ↔ agile-planning ↔ agile-standup ↔ agile-retro ↔ agile-velocity (sprint cycle family)
--   • agile-scrum ↔ agile-kanban ↔ agile-waterfall (methodology contrast)
--   • agile-backlog ↔ agile-grooming ↔ agile-story ↔ agile-epic ↔ agile-story-points (backlog family)
--   • agile-po ↔ agile-sm ↔ agile-pm ↔ agile-em (roles family)
--   • agile-squad ↔ agile-tribe (org hierarchy)
--   • agile-roadmap ↔ agile-milestone ↔ agile-release (planning horizon family)
--   • agile-iteration ↔ agile-sprint (time-unit pair)
--   • agile-ceremony is the umbrella over standup/retro/planning/grooming/demo
--   • agile-wip ↔ agile-wip-limit (work-in-progress pair)
--
-- Cross-path notes:
--   • agile-ticket is the unit; ent-jira / ent-linear / ent-asana are the tools that store tickets.
--   • agile-code-review happens on git-pr — the PR is the artifact, the review is the activity.

insert into terms (
  id, term, pronunciation, path, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── agile: methodologies (3) ──────────────────────────────────
('agile-scrum', 'scrum', null, 'agile', 1,
 'The most common flavor of agile — fixed-length sprints, daily standups, defined roles, regular ceremonies.',
 'Scrum is a specific recipe inside the broader "agile" idea. Teams work in 1–4 week sprints, hold a daily standup, plan at the start of each sprint, demo at the end, then retro on what worked. There''s a product owner, a scrum master, and the dev team. Most companies that say "we''re agile" actually mean "we do scrum."',
 'Our team runs scrum — two-week sprints, standup at 10, retro every other Friday.',
 'When dev family says "in scrum we…" they''re assuming you know the recipe. Knowing the term lets you separate scrum (one specific method) from agile (the umbrella idea).',
 ARRAY['agile-kanban','agile-sprint','agile-ceremony']::text[],
 ARRAY['agile-sprint']::text[],
 'agile-kanban',
 ARRAY[
   'A continuous-flow method with no sprints and a board of WIP-limited columns',
   'A traditional approach where you finish all design before any coding starts',
   'A 15-minute daily team check-in covering yesterday, today, and blockers'
 ]::text[],
 'Our team runs ___ — two-week sprints, standup at 10, retro every other Friday.',
 'Use ''scrum'' in a sentence about a team running fixed-length sprints with regular ceremonies.',
 'curated', 'curator', '2026-05-04'),

('agile-kanban', 'kanban', 'KAHN-bahn', 'agile', 1,
 'A flavor of agile with no sprints — work flows continuously across a board of columns with WIP limits.',
 'Kanban skips the sprint cadence entirely. Instead you have a board (To Do → In Progress → Review → Done), a cap on how many things can sit in each column at once (the WIP limit), and you pull the next ticket whenever you finish one. Great for support teams, ops teams, anyone whose work arrives unpredictably.',
 'We moved the support team off scrum to kanban — the sprint pretend-planning was killing them.',
 'When dev family says "we''re kanban, not scrum," they mean continuous flow, not sprints. Knowing the term means you understand the second-most-common process and why some teams pick it.',
 ARRAY['agile-scrum','agile-wip-limit','agile-wip']::text[],
 ARRAY['agile-scrum']::text[],
 'agile-wip-limit',
 ARRAY[
   'A method where work is planned in fixed-length two-week sprints',
   'A diagramming tool used to map dependencies between teams',
   'A meeting where the team reflects on the previous sprint'
 ]::text[],
 'We moved the support team off scrum to ___ — the sprint pretend-planning was killing them.',
 'Use ''kanban'' in a sentence about a team using a continuous-flow board instead of sprints.',
 'curated', 'curator', '2026-05-04'),

('agile-waterfall', 'waterfall', null, 'agile', 1,
 'The opposite of agile — finish all the design, then all the coding, then all the testing, in one big sequential flow.',
 'Waterfall is the pre-agile default: gather all requirements, write a giant spec, design everything, build everything, test everything, ship. Each phase finishes before the next starts, like water falling from one pool to the next. Great for projects where requirements truly can''t change (regulated hardware, certain government work). Painful for software, where requirements always change.',
 'The contractor still works waterfall — six months of requirements docs before a single line of code.',
 'When dev family says "that''s a waterfall org" or "we''re trying to move from waterfall to agile," this is the contrast they''re drawing. Knowing the term is how you understand WHY agile exists in the first place.',
 ARRAY['agile-scrum','agile-kanban','agile-roadmap']::text[],
 ARRAY['agile-scrum']::text[],
 null,
 ARRAY[
   'A method where the team works in two-week iterations with daily standups',
   'A board that visualizes work in progress across columns',
   'A process where small batches of work ship continuously to production'
 ]::text[],
 'The contractor still works ___ — six months of requirements docs before a single line of code.',
 'Use ''waterfall'' in a sentence about a sequential, non-agile development process.',
 'curated', 'curator', '2026-05-04'),

-- ─── agile: sprint cycle ceremonies (4) ────────────────────────
('agile-planning', 'sprint planning', null, 'agile', 1,
 'The meeting at the start of a sprint where the team picks which tickets to commit to over the next two weeks.',
 'Sprint planning is when the team looks at the top of the backlog, debates what they can realistically finish in the upcoming sprint, and pulls those tickets in. The product owner explains priorities; engineers point or estimate; everyone leaves with a clear slate of work. Usually 1–2 hours per week of sprint length.',
 'Let''s groom the backlog before sprint planning Friday so the meeting doesn''t drag.',
 'When dev family says "I''ve got planning at 2," they mean this exact meeting. Knowing the term means you understand how a team decides what they''re actually going to build for the next two weeks.',
 ARRAY['agile-sprint','agile-grooming','agile-backlog']::text[],
 ARRAY['agile-sprint']::text[],
 'agile-grooming',
 ARRAY[
   'A daily meeting where the team shares yesterday, today, and blockers',
   'A meeting at the end of the sprint where the team reflects on what went well',
   'A session where the team shows finished work to stakeholders'
 ]::text[],
 'Let''s groom the backlog before ___ Friday so the meeting doesn''t drag.',
 'Use ''sprint planning'' in a sentence about deciding what work gets done in the next sprint.',
 'curated', 'curator', '2026-05-04'),

('agile-retro', 'retro / retrospective', null, 'agile', 1,
 'The meeting at the end of a sprint where the team talks about what worked, what didn''t, and what to change.',
 'A retro (short for retrospective) is the team''s blameless post-mortem on the sprint that just ended. Common format: what went well, what didn''t, what to try next. The output is a small list of process changes the team commits to for the next sprint. Held every 1–4 weeks depending on sprint length.',
 'Bring it up at retro on Friday — that''s where we fix process stuff.',
 'When dev family says "save it for retro," this is the meeting. Knowing the term means you understand the one ceremony explicitly designed to make the team better over time.',
 ARRAY['agile-sprint','agile-planning','agile-ceremony']::text[],
 ARRAY['agile-sprint']::text[],
 'agile-velocity',
 ARRAY[
   'A meeting at the start of a sprint where work is committed for the next two weeks',
   'A daily 15-minute check-in covering yesterday, today, and blockers',
   'A meeting where finished features are demoed to product stakeholders'
 ]::text[],
 'Bring it up at ___ on Friday — that''s where we fix process stuff.',
 'Use ''retro'' in a sentence about reflecting on a finished sprint.',
 'curated', 'curator', '2026-05-04'),

('agile-demo', 'demo', null, 'agile', 1,
 'The meeting where the team shows off finished work to stakeholders or the wider org.',
 'A demo (sometimes called a sprint review or showcase) is where the team walks through what shipped during the sprint. PMs, designers, leadership, sometimes customers, watch the actual feature in action. It''s the proof point — "look, this is real and it works" — and a chance for stakeholders to react before the team commits to the next slice.',
 'Save the date — Wednesday demo, we''re showing the new onboarding flow.',
 'When dev family says "I''m presenting at demo Friday," this is the meeting. Knowing the term means you understand how engineering work surfaces back to non-engineers.',
 ARRAY['agile-sprint','agile-retro','agile-ceremony']::text[],
 ARRAY['agile-sprint']::text[],
 null,
 ARRAY[
   'A meeting to plan which tickets to pull into the upcoming sprint',
   'A retrospective meeting after a sprint ends',
   'A daily standup where blockers are surfaced'
 ]::text[],
 'Save the date — Wednesday ___, we''re showing the new onboarding flow.',
 'Use ''demo'' in a sentence about showing finished work to stakeholders at the end of a sprint.',
 'curated', 'curator', '2026-05-04'),

('agile-grooming', 'grooming / refinement', null, 'agile', 1,
 'The meeting where the team cleans up the backlog — clarifying tickets, splitting big ones, estimating, killing dead ones.',
 'Grooming (also called backlog refinement) is the housekeeping ceremony. The team walks through the top of the backlog and makes sure each ticket is actually ready to be worked: the description is clear, acceptance criteria are sharp, the work is small enough to fit in a sprint, and there''s a rough estimate. A well-groomed backlog makes sprint planning take 20 minutes instead of 2 hours.',
 'We need to take this to grooming — the description''s too vague to point.',
 'When dev family says "we need to take this to grooming" or "the backlog needs grooming," this is the activity. Knowing the term means you understand the difference between a messy backlog and a ready one.',
 ARRAY['agile-backlog','agile-planning','agile-story-points']::text[],
 ARRAY['agile-backlog']::text[],
 'agile-story-points',
 ARRAY[
   'A meeting where finished work is shown to stakeholders',
   'A meeting at the end of a sprint to discuss what went well and what didn''t',
   'A daily check-in covering yesterday, today, and blockers'
 ]::text[],
 'We need to take this to ___ — the description''s too vague to point.',
 'Use ''grooming'' or ''refinement'' in a sentence about prepping the backlog before sprint planning.',
 'curated', 'curator', '2026-05-04'),

-- ─── agile: backlog artifacts (5) ──────────────────────────────
('agile-backlog', 'backlog', null, 'agile', 1,
 'The prioritized list of every ticket the team might work on, ordered by what matters most.',
 'The backlog is the master to-do list. Tickets at the top are the most urgent or valuable — those are what get pulled into the next sprint. Tickets at the bottom are "someday maybe." The product owner is responsible for keeping it ordered. A healthy backlog has the top groomed and ready, the middle roughed in, and the bottom intentionally messy.',
 'Drop it in the backlog and we''ll prioritize it next planning.',
 'Every "where does this idea go?" conversation ends with "the backlog." Knowing the term means you understand the central artifact of agile work — the queue everything flows through.',
 ARRAY['agile-grooming','agile-story','agile-po']::text[],
 ARRAY['agile-ticket']::text[],
 'agile-grooming',
 ARRAY[
   'A burndown chart showing remaining work over a sprint',
   'A board that displays tickets actively in progress',
   'The roadmap of releases planned for the next quarter'
 ]::text[],
 'Drop it in the ___ and we''ll prioritize it next planning.',
 'Use ''backlog'' in a sentence about where new ideas or tickets get tracked for later.',
 'curated', 'curator', '2026-05-04'),

('agile-story', 'user story', null, 'agile', 1,
 'A ticket written from the user''s perspective — "as a [user], I want [thing] so that [outcome]."',
 'A user story is a specific format for writing tickets, framed around who needs the feature and why. The classic shape is "as a pharmacy tech, I want to filter by waiting time so that I can prioritize urgent fills." The format forces you to write the WHY before the HOW. Stories live in the backlog; engineers turn them into tasks.',
 'Can you rewrite that as a user story? I want to know who actually needs this.',
 'When dev family says "what''s the story here?" or "let''s write the story," this is the format. Knowing the term means you understand the dominant shape of a well-written agile ticket.',
 ARRAY['agile-ticket','agile-epic','agile-backlog']::text[],
 ARRAY['agile-ticket']::text[],
 'agile-epic',
 ARRAY[
   'A large piece of work that spans multiple sprints and contains many smaller tickets',
   'An estimate of how much effort a ticket will take',
   'A bug report describing broken behavior'
 ]::text[],
 'Can you rewrite that as a user ___? I want to know who actually needs this.',
 'Use ''user story'' in a sentence about a ticket written from the user''s point of view.',
 'curated', 'curator', '2026-05-04'),

('agile-epic', 'epic', null, 'agile', 1,
 'A big chunk of work too large for one sprint — usually broken down into many smaller stories.',
 'An epic is a container for related work. "Redesign onboarding" is an epic — it spans weeks, contains a dozen user stories, touches multiple teams. You don''t work on an epic directly; you work on the stories inside it. Roadmaps usually list epics, not individual tickets.',
 'The auth-rewrite epic has 18 stories under it — we''ll burn through it across three sprints.',
 'When dev family says "that''s its own epic" they mean it''s too big for one sprint. Knowing the term lets you tell the difference between a one-ticket task and a months-long initiative.',
 ARRAY['agile-story','agile-ticket','agile-roadmap']::text[],
 ARRAY['agile-story']::text[],
 'agile-roadmap',
 ARRAY[
   'A ticket written from the user''s perspective with a who/what/why format',
   'A scoring system for estimating ticket effort',
   'A daily standup format where everyone shares blockers'
 ]::text[],
 'The auth-rewrite ___ has 18 stories under it — we''ll burn through it across three sprints.',
 'Use ''epic'' in a sentence about a large initiative made up of many smaller tickets.',
 'curated', 'curator', '2026-05-04'),

('agile-story-points', 'story points', null, 'agile', 1,
 'A relative-effort estimate for a ticket — usually a Fibonacci number (1, 2, 3, 5, 8) instead of hours.',
 'Story points let the team estimate effort without committing to clock time. A 1-pointer is trivial; a 5-pointer is a real chunk of work; a 13 should probably be split. Teams use Fibonacci to force coarser distinctions — there''s no 4 or 6, so you can''t agonize over fine differences. Estimates are relative to the team, not transferable between teams.',
 'It''s a 5 — too risky to call it a 3, not big enough to be an 8.',
 'When dev family says "what''d you point that?" or "it''s a 3-pointer," this is the unit. Knowing the term means you can follow estimation conversations and understand why nobody talks in hours.',
 ARRAY['agile-story','agile-velocity','agile-grooming']::text[],
 ARRAY['agile-story']::text[],
 'agile-velocity',
 ARRAY[
   'The total hours a developer is expected to work each week',
   'A score for how many bugs a feature has produced in production',
   'A measure of how many tickets a team finishes per sprint'
 ]::text[],
 'It''s a 5 — too risky to call it a 3, not big enough to be an 8 ___.',
 'Use ''story points'' in a sentence about estimating how much effort a ticket will take.',
 'curated', 'curator', '2026-05-04'),

('agile-velocity', 'velocity', null, 'agile', 1,
 'How many story points the team finishes in an average sprint — used to predict what you can commit to next.',
 'Velocity is the team''s historical throughput, averaged over the last few sprints. If a team finishes 30 points per sprint on average, planning the next sprint at 50 points is asking for a slip. Velocity is for the team to use internally — comparing velocity between teams is meaningless because story points are team-relative.',
 'Our velocity dropped to 22 last sprint after Mateo went on PTO — let''s plan accordingly.',
 'When dev family says "what''s your velocity?" they mean this average. Knowing the term means you understand how teams realistically forecast — and why "we''ll get to it next sprint" sometimes really does mean six weeks.',
 ARRAY['agile-story-points','agile-sprint','agile-planning']::text[],
 ARRAY['agile-story-points']::text[],
 null,
 ARRAY[
   'How fast each individual API request finishes',
   'The number of bugs found per sprint',
   'The number of meetings the team attends each week'
 ]::text[],
 'Our ___ dropped to 22 last sprint after Mateo went on PTO — let''s plan accordingly.',
 'Use ''velocity'' in a sentence about how much work a team can finish per sprint.',
 'curated', 'curator', '2026-05-04'),

-- ─── agile: roles (4) ──────────────────────────────────────────
('agile-po', 'PO (product owner)', 'P-O', 'agile', 1,
 'Product Owner — owns the backlog. Decides what the team builds next and in what order.',
 'The PO is the single person who can say yes or no to a ticket landing in the next sprint. They write or approve the user stories, set priorities, and answer "what does done look like?" In scrum the PO is the voice of the customer inside the team. Often a more tactical sub-role under a broader product manager — though many small teams use the titles interchangeably.',
 'Ping the PO before you change the acceptance criteria — she owns the backlog.',
 'When dev family says "I need to talk to the PO," this role is who they mean. Knowing the term means you can tell the PO (owns the backlog) apart from the PM (owns the product vision).',
 ARRAY['agile-pm','agile-backlog','agile-story']::text[],
 ARRAY['agile-backlog']::text[],
 'agile-pm',
 ARRAY[
   'The person who runs the standups and removes blockers for the team',
   'The person responsible for the team''s technical direction and engineering hires',
   'The senior product leader who owns the long-term product vision and roadmap'
 ]::text[],
 'Ping the ___ before you change the acceptance criteria — she owns the backlog.',
 'Use ''PO'' in a sentence about the person who decides what the team builds next.',
 'curated', 'curator', '2026-05-04'),

('agile-sm', 'SM (scrum master)', 'S-M', 'agile', 1,
 'Scrum Master — runs the ceremonies and unblocks the team. The process coach, not a manager.',
 'The SM owns the scrum process itself: schedules standups, runs retros, removes blockers, shields the team from outside chaos. They don''t assign work and they don''t evaluate performance — they''re a coach for HOW the team works, not WHAT the team works on. In small companies the SM hat is often worn part-time by an EM or senior engineer.',
 'She''s our SM — she runs the standups and chases down anyone blocking us.',
 'When dev family says "the SM will sort that out," this is the role. Knowing the term means you understand who actually owns the process — and why they''re distinct from the PO who owns the work.',
 ARRAY['agile-po','agile-em','agile-ceremony']::text[],
 ARRAY['agile-ceremony']::text[],
 'agile-em',
 ARRAY[
   'The person who owns the backlog and decides what gets built next',
   'The senior product leader who sets long-term product vision',
   'The people manager responsible for engineering hiring and career growth'
 ]::text[],
 'She''s our ___ — she runs the standups and chases down anyone blocking us.',
 'Use ''SM'' in a sentence about the person who runs scrum ceremonies and unblocks the team.',
 'curated', 'curator', '2026-05-04'),

('agile-pm', 'PM (product manager)', 'P-M', 'agile', 1,
 'Product Manager — owns the WHAT. Decides what the product should become and why.',
 'The PM sets the product vision, defines the strategy, owns the roadmap, and prioritizes across epics. They talk to customers, write the briefs, work with design, and make tradeoff calls about what NOT to build. PM is broader than PO — a PM thinks in quarters and roadmaps; a PO thinks in sprints and stories. In small companies one person wears both hats.',
 'The PM wants to know if we can hit the milestone — go check the roadmap.',
 'When dev family says "the PM is pushing for…" they mean this role. Knowing the term means you can tell PM (owns the WHAT to build) apart from EM (leads HOW the team builds it).',
 ARRAY['agile-po','agile-em','agile-roadmap']::text[],
 ARRAY['agile-po']::text[],
 'agile-em',
 ARRAY[
   'The engineering leader who manages the team''s people and technical direction',
   'The tactical role inside scrum who owns the day-to-day backlog ordering',
   'The process coach who runs standups and removes blockers'
 ]::text[],
 'The ___ wants to know if we can hit the milestone — go check the roadmap.',
 'Use ''PM'' in a sentence about the person who owns the product vision and roadmap.',
 'curated', 'curator', '2026-05-04'),

('agile-em', 'EM (engineering manager)', 'E-M', 'agile', 1,
 'Engineering Manager — owns the HOW. Leads the engineering team''s people, hiring, and technical direction.',
 'The EM is the people manager for the engineers. They run 1:1s, own hiring, do performance reviews, mentor on growth, and partner with the PM to translate product priorities into engineering execution. EM owns the team''s health and capacity; PM owns what the team builds. In tiny teams the founder or tech lead doubles as EM.',
 'Talk to the EM about headcount — she''s the one who can fight for another engineer.',
 'When dev family says "I need to loop in my EM," this is the role. Knowing the term means you understand who actually manages the humans on an engineering team — distinct from the PM (product) and the SM (process).',
 ARRAY['agile-pm','agile-po','agile-sm']::text[],
 ARRAY['agile-pm']::text[],
 'agile-pm',
 ARRAY[
   'The person who owns the product vision and decides what to build',
   'The tactical role who owns backlog priority sprint by sprint',
   'The scrum process coach who runs standups and retros'
 ]::text[],
 'Talk to the ___ about headcount — she''s the one who can fight for another engineer.',
 'Use ''EM'' in a sentence about the person who manages an engineering team''s people.',
 'curated', 'curator', '2026-05-04'),

-- ─── agile: code review activity (1) ───────────────────────────
('agile-code-review', 'code review / PR review', null, 'agile', 1,
 'The activity of reading a teammate''s pull request, leaving comments, and approving or requesting changes before it merges.',
 'Code review happens on every PR at any serious team. A reviewer reads the diff, asks questions, suggests improvements, and either approves or blocks the merge. Good reviews catch bugs, share knowledge, and keep the codebase consistent. Bad ones devolve into nitpicking. Most companies require at least one approved review before code lands on the main branch.',
 'I left some comments on your PR — quick code review, mostly nits, one blocker.',
 'When dev family says "doing code review" or "waiting on a review," this is the activity. Cross-path with git-pr — the PR is the artifact, the review is the conversation that happens on it.',
 ARRAY['git-pr','agile-ticket','agile-ceremony']::text[],
 ARRAY['git-pr']::text[],
 null,
 ARRAY[
   'A meeting to plan which tickets to pull into the next sprint',
   'An automated test that runs every time code is pushed',
   'A live demo of finished features to stakeholders'
 ]::text[],
 'I left some comments on your PR — quick ___, mostly nits, one blocker.',
 'Use ''code review'' in a sentence about reading a teammate''s PR before it merges.',
 'curated', 'curator', '2026-05-04'),

-- ─── agile: flow & state (4) ───────────────────────────────────
('agile-blocker', 'blocker', null, 'agile', 1,
 'Anything stopping a ticket from moving forward — a missing decision, a broken dependency, a person you''re waiting on.',
 'A blocker is the thing keeping you from finishing your work. The classic standup format explicitly asks for blockers because surfacing them early is how the team unsticks each other. A "hard blocker" can''t be worked around; a "soft blocker" slows you down but you can keep going. The SM''s job is to chase down whoever owns each blocker.',
 'I''m blocked on the API spec — can''t finish until design lands.',
 'When dev family says "what''s your blocker?" or "I''m blocked on X," this is the term. Knowing it means you understand the most important thing to surface in a standup.',
 ARRAY['agile-standup','agile-sm','agile-wip']::text[],
 ARRAY['agile-standup']::text[],
 null,
 ARRAY[
   'A bug that crashes the app for end users',
   'A meeting that runs over its scheduled time',
   'A feature that''s been deprioritized for the next quarter'
 ]::text[],
 'I''m ___ on the API spec — can''t finish until design lands.',
 'Use ''blocker'' in a sentence about something stopping you from finishing a ticket.',
 'curated', 'curator', '2026-05-04'),

('agile-wip', 'WIP (work in progress)', 'W-I-P', 'agile', 1,
 'Anything you''ve started but haven''t finished — open tickets sitting in the In Progress column.',
 'WIP is everything currently in flight: tickets pulled off the backlog, branches not yet merged, PRs awaiting review. High WIP is a warning sign — it means the team has too many things half-done and not enough things actually shipped. The agile mantra "stop starting, start finishing" is about cutting WIP.',
 'My WIP is too high right now — I need to ship two of these before I pull a new ticket.',
 'When dev family says "lower your WIP" or "what''s your WIP look like?" this is the term. Knowing it means you understand why finishing one thing usually beats starting three.',
 ARRAY['agile-wip-limit','agile-blocker','agile-kanban']::text[],
 ARRAY['agile-ticket']::text[],
 'agile-wip-limit',
 ARRAY[
   'The total number of tickets in the backlog',
   'A list of features planned for the next release',
   'The number of meetings on the team''s calendar this week'
 ]::text[],
 'My ___ is too high right now — I need to ship two of these before I pull a new ticket.',
 'Use ''WIP'' in a sentence about the work you''ve started but haven''t finished yet.',
 'curated', 'curator', '2026-05-04'),

('agile-wip-limit', 'WIP limit', null, 'agile', 1,
 'A cap on how many tickets can sit in any column of the board at once — forces the team to finish before starting new work.',
 'WIP limits are kanban''s magic trick. If "In Progress" is capped at 5, the 6th ticket can''t be pulled until one of the 5 finishes — which forces the team to focus on shipping rather than starting. Limits get tuned over time: too low and people sit idle, too high and everything gets half-done. Some scrum teams adopt WIP limits without going full kanban.',
 'We dropped the In Progress WIP limit from 8 to 4 and shipped twice as much.',
 'When dev family says "we hit the WIP limit," this is the cap. Knowing it means you understand the lever kanban teams pull to actually finish work.',
 ARRAY['agile-wip','agile-kanban','agile-velocity']::text[],
 ARRAY['agile-wip','agile-kanban']::text[],
 null,
 ARRAY[
   'A budget for how much money a feature can cost to build',
   'A maximum number of bugs allowed in production at one time',
   'A cap on how many people can be in the standup meeting'
 ]::text[],
 'We dropped the In Progress ___ from 8 to 4 and shipped twice as much.',
 'Use ''WIP limit'' in a sentence about capping how many tickets can be in flight at once.',
 'curated', 'curator', '2026-05-04'),

('agile-ceremony', 'ceremony', null, 'agile', 1,
 'The umbrella term for any of agile''s recurring meetings — standup, planning, retro, grooming, demo.',
 'Ceremony is what the agile world calls its scheduled rituals. Each one has a fixed cadence, a fixed format, and a fixed purpose. People sometimes complain that a team is "too ceremony-heavy" — meaning the meetings are eating the work. The SM owns scheduling and running the ceremonies; the team owns showing up and engaging.',
 'We''ve got too many ceremonies — let''s drop the mid-sprint check-in.',
 'When dev family says "we should make this a ceremony" or "skip the ceremony," this is the umbrella. Knowing it gives you the vocabulary to talk about agile meetings in the abstract.',
 ARRAY['agile-standup','agile-retro','agile-planning']::text[],
 ARRAY['agile-standup']::text[],
 'agile-sm',
 ARRAY[
   'A formal release announcement to customers',
   'A milestone celebration after a major launch',
   'A code review meeting between two engineers'
 ]::text[],
 'We''ve got too many ___ — let''s drop the mid-sprint check-in.',
 'Use ''ceremony'' in a sentence about agile''s recurring meetings as a category.',
 'curated', 'curator', '2026-05-04'),

-- ─── agile: org structure (2) ──────────────────────────────────
('agile-squad', 'squad / pod', null, 'agile', 1,
 'A small cross-functional team — engineers, designer, PM — that owns one product area end-to-end.',
 'Squads (also called pods) are the basic unit of org structure at companies like Spotify, Atlassian, and most modern tech orgs. A squad has 5–10 people, mixes the disciplines needed to ship (engineering, design, product, sometimes data), and owns one slice of the product. Squads are durable — they stick together across many sprints, building deep ownership.',
 'The growth squad ships their own experiments without waiting on anyone else.',
 'When dev family says "I''m on the payments squad" or "our pod is small," this is the org unit. Knowing the term means you understand how modern tech companies actually slice up their teams.',
 ARRAY['agile-tribe','agile-em','agile-pm']::text[],
 ARRAY['agile-em']::text[],
 'agile-tribe',
 ARRAY[
   'A monthly company-wide meeting',
   'A larger group of teams that share a leadership chain',
   'A short-term task force assembled to fix a single bug'
 ]::text[],
 'The growth ___ ships their own experiments without waiting on anyone else.',
 'Use ''squad'' or ''pod'' in a sentence about a small cross-functional team that owns a product area.',
 'curated', 'curator', '2026-05-04'),

('agile-tribe', 'tribe', null, 'agile', 1,
 'A group of related squads that share a broader mission — usually 30–150 people under one director.',
 'Tribe is the next layer up from squad in the Spotify-style org model. Multiple squads working on related stuff (all of payments, all of growth) roll up into one tribe with shared leadership, shared roadmap, and shared rituals. Tribes are how a company keeps squads autonomous while still aligning on big bets. Not every company uses the word — some say "group," "domain," or just "department."',
 'The whole payments tribe is at offsite next week — three squads, about 40 people.',
 'When dev family says "our tribe is restructuring" or "the platform tribe owns that," this is the layer. Knowing the term means you can read modern tech-org charts without getting lost.',
 ARRAY['agile-squad','agile-em','agile-pm']::text[],
 ARRAY['agile-squad']::text[],
 null,
 ARRAY[
   'A small cross-functional team of 5–10 people who own one product area',
   'A short-lived group formed for a single sprint',
   'A user-research panel for testing prototypes'
 ]::text[],
 'The whole payments ___ is at offsite next week — three squads, about 40 people.',
 'Use ''tribe'' in a sentence about a group of related squads sharing leadership and mission.',
 'curated', 'curator', '2026-05-04'),

-- ─── agile: planning horizons (3) ──────────────────────────────
('agile-roadmap', 'roadmap', null, 'agile', 1,
 'A high-level plan of what the product will become over the next quarter, half, or year — usually a list of epics by time bucket.',
 'A roadmap is the long-view companion to the backlog. Where the backlog is "next sprint, in priority order," the roadmap is "next quarter, big themes." It''s usually visual — swimlanes by team, columns by quarter, epics in cells. Roadmaps are aspirational: they shift as priorities change, customers complain, or surprises hit. The PM owns it.',
 'Push it to the Q3 roadmap — we''re not getting to it this quarter.',
 'When dev family says "it''s on the roadmap" or "the roadmap shifted," this is the artifact. Knowing the term means you can talk about what a product will become months out, not just what ships next sprint.',
 ARRAY['agile-milestone','agile-release','agile-pm']::text[],
 ARRAY['agile-pm']::text[],
 'agile-milestone',
 ARRAY[
   'The prioritized list of every ticket the team might work on',
   'A daily meeting covering yesterday, today, and blockers',
   'A specific date a feature must ship by'
 ]::text[],
 'Push it to the Q3 ___ — we''re not getting to it this quarter.',
 'Use ''roadmap'' in a sentence about the long-term plan for a product.',
 'curated', 'curator', '2026-05-04'),

('agile-milestone', 'milestone', null, 'agile', 1,
 'A specific date or marker on the roadmap that something needs to be true by — a launch, a beta, a contract deadline.',
 'A milestone is a fixed point you''re aiming for. "Beta available May 1." "Compliance audit by end of Q2." "GA launch tied to the conference keynote." Milestones drive prioritization — when one is approaching, the team pulls in everything that has to be true by that date. Missing a milestone is a real event; hitting one usually triggers the next phase of work.',
 'The PM wants to know if we can hit the milestone — go check the roadmap.',
 'When dev family says "we''ve got a milestone in two weeks" or "this is a hard milestone," this is the marker. Knowing the term means you understand how teams pace work toward fixed deadlines.',
 ARRAY['agile-roadmap','agile-release','agile-pm']::text[],
 ARRAY['agile-roadmap']::text[],
 'agile-release',
 ARRAY[
   'A daily standup on a recurring schedule',
   'A retrospective held at the end of every sprint',
   'A long-running list of all the team''s tickets in priority order'
 ]::text[],
 'The PM wants to know if we can hit the ___ — go check the roadmap.',
 'Use ''milestone'' in a sentence about a fixed date the team is targeting.',
 'curated', 'curator', '2026-05-04'),

('agile-release', 'release', null, 'agile', 1,
 'A bundle of finished work pushed out to users — could be a hotfix, a feature batch, or a major launch.',
 'A release is when work crosses the line from "shipped to production" to "available to users" (sometimes those happen together, sometimes there''s a gap behind a feature flag). Releases can be tiny (a release every PR, a.k.a. continuous deployment) or huge (a quarterly batch with a marketing push). Many teams have a separate "release manager" or release ceremony to coordinate the bigger ones.',
 'We''re cutting a release Friday — anything not merged by Wednesday gets pushed to next week.',
 'When dev family says "in the next release" or "we''re prepping a release," this is the bundle. Knowing the term means you can follow shipping conversations and understand the difference between "merged" and "released."',
 ARRAY['agile-roadmap','agile-milestone','dev-deploy']::text[],
 ARRAY['agile-milestone']::text[],
 null,
 ARRAY[
   'A pull request opened for review',
   'A meeting to plan the next sprint',
   'A burndown chart for an active sprint'
 ]::text[],
 'We''re cutting a ___ Friday — anything not merged by Wednesday gets pushed to next week.',
 'Use ''release'' in a sentence about pushing a bundle of finished work out to users.',
 'curated', 'curator', '2026-05-04'),

-- ─── agile: time units (1) ─────────────────────────────────────
('agile-iteration', 'iteration', null, 'agile', 1,
 'Generic word for one round of "plan → build → review" — a sprint is a specific kind of iteration.',
 'Iteration is the abstract version of sprint. Some teams say sprint (scrum vocabulary, fixed length), some say iteration (Linear''s default term, sometimes flexible length), some say cycle. They all mean the same thing: the unit of repeating work. "We''ll get to it next iteration" and "we''ll get to it next sprint" are interchangeable.',
 'Bumping that to next iteration — we ran out of room this round.',
 'When dev family says "next iteration" or a tool like Linear talks about "Cycle 14," this is the unit. Knowing it means you can follow teams that don''t use the strict scrum vocabulary.',
 ARRAY['agile-sprint','agile-velocity','agile-planning']::text[],
 ARRAY['agile-sprint']::text[],
 null,
 ARRAY[
   'A retrospective held at the end of a sprint',
   'A long-term roadmap covering the next quarter',
   'A daily 15-minute standup meeting'
 ]::text[],
 'Bumping that to next ___ — we ran out of room this round.',
 'Use ''iteration'' in a sentence about one round of planning, building, and reviewing.',
 'curated', 'curator', '2026-05-04')

on conflict (id) do nothing;
