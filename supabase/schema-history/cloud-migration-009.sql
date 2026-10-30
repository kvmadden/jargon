-- jargon Stage B3 — 27 more curated anchor terms for the git-cli path (paste-ready)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds 27 difficulty-1 anchor terms covering the most-used Git + CLI verbs/concepts.
-- All curated, reviewed by the curator on 2026-05-04. Idempotent — `on conflict (id) do nothing`
-- so re-runs are safe. Voice matches the existing 21 anchors (git-commit template).
--
-- Dictionary count after this migration:
--   git-cli:       3 → 19  (3 existing + 16 new git-* terms)
--   cli only (still git-cli path): 11 new terminal/shell terms
--   total:         21 → 48
--
-- Cross-references: every related_terms / prerequisites / stretch_term id resolves
-- to one of the original 21 anchors or one of these 27. The CHECK constraint on
-- multiple_choice_distractors (length = 3) is honored by every row.

insert into terms (
  id, term, pronunciation, path, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── git-cli: git verbs (16) ──────────────────────────────────
('git-branch', 'branch', null, 'git-cli', 1,
 'A separate line of development that lets you work on changes without touching the main code.',
 'A branch is a movable pointer to a series of commits. You start a branch off the main code, do whatever experimental or in-progress work you want, and the main branch stays untouched until you decide to merge. Most teams keep one long-lived main branch and spin off short-lived feature branches.',
 'I''ll spin up a branch for the new login flow so I don''t break anything on main.',
 'Claude Code constantly creates branches before risky work. When dev family says "what branch are you on?" they''re asking which parallel line of work you''re editing — knowing the term means you can answer without scrambling.',
 ARRAY['git-commit','git-merge','git-checkout']::text[],
 ARRAY['git-commit']::text[],
 'git-rebase',
 ARRAY[
   'A backup copy of the entire repository',
   'A tag marking a released version of the code',
   'A folder inside a project that holds related files'
 ]::text[],
 'I''ll spin up a ___ for the new login flow so I don''t break anything on main.',
 'Use ''branch'' in a sentence about working on a feature without disturbing the main code.',
 'curated', 'curator', '2026-05-04'),

('git-merge', 'merge', null, 'git-cli', 1,
 'Combining the changes from one branch into another, usually pulling a feature into main.',
 'A merge takes the work from one branch and folds it into another, creating a merge commit that ties the two histories together. If both branches changed the same lines in different ways, you get a merge conflict you have to resolve by hand before the merge completes.',
 'Once the PR is approved I''ll merge it into main and delete the branch.',
 'Every PR ends in a merge. Knowing what merge means closes the loop on the whole branch → commit → push → PR → merge cycle that Claude Code runs through every working session.',
 ARRAY['git-branch','git-pr','git-conflict']::text[],
 ARRAY['git-branch','git-commit']::text[],
 'git-rebase',
 ARRAY[
   'Deleting a branch you no longer need',
   'Copying a repository onto your own machine',
   'Renaming a file in version control'
 ]::text[],
 'Once the PR is approved I''ll ___ it into main and delete the branch.',
 'Use ''merge'' in a sentence about combining a finished feature branch into the main code.',
 'curated', 'curator', '2026-05-04'),

('git-pull', 'pull', null, 'git-cli', 1,
 'Downloading the latest commits from a remote and folding them into your current branch.',
 'A pull is really two operations stitched together: it fetches the new commits from the remote, then merges them into the branch you''re on. It''s how you get up to date with whatever your teammates (or your other laptop) have pushed since you last synced.',
 'Pull before you start working — main moved a lot since yesterday.',
 'When your other machine is missing the latest, the answer is almost always "I forgot to pull." This is the receiving end of push, and getting fluent in the pair makes sync conversations land.',
 ARRAY['git-push','git-fetch','git-merge']::text[],
 ARRAY['git-commit','git-push']::text[],
 null,
 ARRAY[
   'Deleting all uncommitted changes in a working directory',
   'Reverting the most recent commit',
   'Asking a teammate to review your code'
 ]::text[],
 '___ before you start working — main moved a lot since yesterday.',
 'Use ''pull'' in a sentence about getting your local copy up to date with a remote.',
 'curated', 'curator', '2026-05-04'),

('git-fetch', 'fetch', null, 'git-cli', 1,
 'Downloading new commits from a remote without merging them into your branch yet.',
 'A fetch grabs the latest history from the remote and updates your local view of what''s on the remote — but it does NOT touch the branch you''re working on. It''s the safer cousin of pull: you can see what changed before deciding to merge.',
 'Let me fetch first so I can see what landed on main before I rebase.',
 'When Claude Code says "fetching origin" in a status line, this is what''s happening. Knowing the difference between fetch (download only) and pull (download + merge) keeps you out of accidental-merge trouble.',
 ARRAY['git-pull','git-remote','git-merge']::text[],
 ARRAY['git-commit']::text[],
 'git-rebase',
 ARRAY[
   'Combining two branches into one',
   'Saving uncommitted changes to a temporary stack',
   'Creating a new branch from the current commit'
 ]::text[],
 'Let me ___ first so I can see what landed on main before I rebase.',
 'Use ''fetch'' in a sentence about checking what changed on a remote before merging.',
 'curated', 'curator', '2026-05-04'),

('git-clone', 'clone', null, 'git-cli', 1,
 'Downloading a full copy of a remote repository onto your machine for the first time.',
 'A clone pulls down the entire history of a repo — every commit, every branch — and sets up the remote pointer so future pushes and pulls know where to go. It''s how you start working on a project you didn''t create yourself.',
 'I cloned the repo last night but I haven''t opened it in the editor yet.',
 'Every new project starts with a clone. When dev family says "just clone the repo," they mean run one command and the whole codebase lands on your laptop, history and all.',
 ARRAY['git-fork','git-remote','git-pull']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'Creating a new branch off the current commit',
   'Making a backup copy of a single file',
   'Forking a repo into your own GitHub account'
 ]::text[],
 'I ___ the repo last night but I haven''t opened it in the editor yet.',
 'Use ''clone'' in a sentence about getting a project onto your machine for the first time.',
 'curated', 'curator', '2026-05-04'),

('git-fork', 'fork', null, 'git-cli', 1,
 'Making your own server-side copy of someone else''s repo, usually so you can change it independently.',
 'A fork lives on a hosting service like GitHub — it''s a full copy of a repo under your account, with its own URL and its own permissions. You typically fork a project you don''t have write access to, make changes in your fork, then open a PR back to the original.',
 'I forked the open-source library so I could patch the bug and send a PR upstream.',
 'Open-source contributions almost always start with a fork. When dev family talks about "sending a fix upstream," the fork is what they used to make the change in the first place.',
 ARRAY['git-clone','git-pr','git-remote']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A local branch off the main line of development',
   'A snapshot saved before a risky operation',
   'A duplicate file with a slightly different name'
 ]::text[],
 'I ___ the open-source library so I could patch the bug and send a PR upstream.',
 'Use ''fork'' in a sentence about making your own copy of someone else''s project.',
 'curated', 'curator', '2026-05-04'),

('git-diff', 'diff', null, 'git-cli', 1,
 'A line-by-line view of what changed between two versions of code.',
 'A diff shows what was added, removed, or modified between two snapshots — usually your working changes versus the last commit, or one commit versus another. Lines starting with `+` are additions, `-` are removals. It''s the universal format for reviewing code changes.',
 'Take a quick look at the diff before I commit — I want a second pair of eyes on the regex.',
 'Every code review is a diff review. When Claude Code says "here''s the diff" before applying a change, knowing the term means you can read the proposal instead of bracing for a surprise.',
 ARRAY['git-commit','git-pr','git-log']::text[],
 ARRAY['git-commit']::text[],
 null,
 ARRAY[
   'A list of files in a directory',
   'A backup of the repository before a merge',
   'A configuration file describing build steps'
 ]::text[],
 'Take a quick look at the ___ before I commit — I want a second pair of eyes on the regex.',
 'Use ''diff'' in a sentence about reviewing what changed in some code.',
 'curated', 'curator', '2026-05-04'),

('git-stash', 'stash', null, 'git-cli', 1,
 'Tucking your in-progress changes into a temporary stack so you can switch contexts without committing.',
 'A stash captures everything you''ve modified but not yet committed and stores it aside, leaving your working directory clean. You can switch branches, do something urgent, then pop the stash back to resume exactly where you left off.',
 'Let me stash this real quick — I need to switch branches and look at the bug report.',
 'Stash is the "hold this for a sec" of Git. When Claude Code or a teammate says "I stashed it," they paused work without losing it — knowing the term means you understand mid-task context switches.',
 ARRAY['git-branch','git-checkout','git-commit']::text[],
 ARRAY['git-commit','git-branch']::text[],
 null,
 ARRAY[
   'Permanently deleting your uncommitted changes',
   'Pushing your work to a private remote',
   'Tagging the current commit with a version number'
 ]::text[],
 'Let me ___ this real quick — I need to switch branches and look at the bug report.',
 'Use ''stash'' in a sentence about temporarily setting aside in-progress work.',
 'curated', 'curator', '2026-05-04'),

('git-log', 'log', null, 'git-cli', 1,
 'The chronological list of commits on a branch, with messages, authors, and timestamps.',
 'The log is the project''s memory. Each entry shows who committed what, when, and the message they wrote. You scroll through it to see how a piece of code got the way it is, or to find the commit where something broke.',
 'Check the log — I want to see who last touched the auth code.',
 'When something mysteriously broke, the log is where you investigate. Hearing "let me check the log" or "git log says..." in a debugging session means someone is reading the project''s history.',
 ARRAY['git-commit','git-diff','git-head']::text[],
 ARRAY['git-commit']::text[],
 null,
 ARRAY[
   'A file recording errors at runtime',
   'A list of currently open branches',
   'A queue of pending pull requests'
 ]::text[],
 'Check the ___ — I want to see who last touched the auth code.',
 'Use ''log'' in a sentence about looking through a project''s commit history.',
 'curated', 'curator', '2026-05-04'),

('git-rebase', 'rebase', 'REE-base', 'git-cli', 1,
 'Replaying your branch''s commits on top of a newer version of another branch to get a clean history.',
 'A rebase rewinds your commits, updates your branch to start from the latest tip of (usually) main, then re-applies your commits one at a time on top. The result is a linear history with no merge commit — like you''d started your branch from the up-to-date code in the first place.',
 'I''m going to rebase onto main before opening the PR so the history stays clean.',
 'Rebase is one of the words you''ll hear constantly in Claude Code sessions and from dev family. It''s the cleaner alternative to merging in updates from main, and knowing the term unlocks a whole layer of "history hygiene" conversations.',
 ARRAY['git-merge','git-branch','git-conflict']::text[],
 ARRAY['git-commit','git-branch','git-merge']::text[],
 null,
 ARRAY[
   'Resetting your branch back to a previous commit',
   'Renaming a branch on the remote',
   'Squashing several commits into one'
 ]::text[],
 'I''m going to ___ onto main before opening the PR so the history stays clean.',
 'Use ''rebase'' in a sentence about updating your branch with the latest changes from main.',
 'curated', 'curator', '2026-05-04'),

('git-conflict', 'merge conflict', null, 'git-cli', 1,
 'When two branches changed the same lines in different ways, forcing you to pick which version wins.',
 'A merge conflict happens when Git can''t automatically reconcile two sets of changes — say, you and a teammate both edited the same function. Git marks the conflicting lines with `<<<<<<<` and `>>>>>>>` and waits for you to decide what the final code should look like, then commit the resolution.',
 'I hit a merge conflict in the auth file — give me 10 minutes to sort it out.',
 'Conflicts are unavoidable on any team. When Claude Code or dev family says "I''m resolving conflicts," knowing what that means saves you from picturing literal arguments.',
 ARRAY['git-merge','git-rebase','git-branch']::text[],
 ARRAY['git-merge','git-branch']::text[],
 null,
 ARRAY[
   'A bug introduced by combining two pieces of code',
   'A permission error when pushing to a remote',
   'A test that fails after a rebase'
 ]::text[],
 'I hit a ___ in the auth file — give me 10 minutes to sort it out.',
 'Use ''merge conflict'' in a sentence about Git not knowing how to combine two sets of edits.',
 'curated', 'curator', '2026-05-04'),

('git-remote', 'remote', null, 'git-cli', 1,
 'A named pointer to a copy of your repository hosted somewhere else — usually GitHub.',
 'A remote is just a URL with a nickname. Most repos have one called `origin` (the place you cloned from). You push to and pull from remotes — they''re how your local repo stays in sync with the team''s shared copy and with services like GitHub.',
 'I added a second remote pointing at the fork so I can push to both places.',
 'When Claude Code says "pushing to remote" or dev family asks "is it on the remote yet?" this is the named server-side copy they mean. Knowing the term separates "saved locally" from "available to others."',
 ARRAY['git-origin','git-push','git-fetch']::text[],
 ARRAY['git-clone']::text[],
 null,
 ARRAY[
   'A branch that has not yet been merged',
   'A folder synced via a cloud-storage service',
   'A computer used to access a server over SSH'
 ]::text[],
 'I added a second ___ pointing at the fork so I can push to both places.',
 'Use ''remote'' in a sentence about a server-side copy of your repository.',
 'curated', 'curator', '2026-05-04'),

('git-origin', 'origin', null, 'git-cli', 1,
 'The default name Git gives to the remote you originally cloned from.',
 '`origin` isn''t magic — it''s just the conventional nickname Git assigns to the first remote you set up. When you `git push` with no arguments, you''re pushing to origin. Repos can have other remotes too, but origin is almost always the team''s canonical copy.',
 'Push to origin when you''re ready and I''ll pull it down on the laptop.',
 'You''ll see "origin/main" in Claude Code output and in tutorials constantly. It just means "the main branch as it exists on the place I cloned from" — once that clicks, half the Git output reads cleaner.',
 ARRAY['git-remote','git-push','git-pull']::text[],
 ARRAY['git-clone','git-remote']::text[],
 null,
 ARRAY[
   'The first commit ever made in a repository',
   'The branch a feature was originally created from',
   'The user who first opened a pull request'
 ]::text[],
 'Push to ___ when you''re ready and I''ll pull it down on the laptop.',
 'Use ''origin'' in a sentence about the default remote of your repository.',
 'curated', 'curator', '2026-05-04'),

('git-head', 'HEAD', 'head', 'git-cli', 1,
 'A pointer to the commit you''re currently sitting on — usually the tip of your active branch.',
 'HEAD is Git''s way of saying "you are here." It points to the latest commit on your current branch most of the time, but if you check out a specific commit by hash, HEAD points there instead (a state called "detached HEAD"). Most Git commands are implicitly about HEAD.',
 'If you reset to HEAD~1 you''ll move back one commit — make sure you stash first.',
 'HEAD shows up in nearly every Git error message and tutorial. Knowing it''s just "where you are right now" makes a lot of cryptic-looking output suddenly readable.',
 ARRAY['git-commit','git-branch','git-checkout']::text[],
 ARRAY['git-commit','git-branch']::text[],
 null,
 ARRAY[
   'The first commit in the repository',
   'The maintainer of the main branch',
   'The header section of a configuration file'
 ]::text[],
 'If you reset to ___~1 you''ll move back one commit — make sure you stash first.',
 'Use ''HEAD'' in a sentence about the commit you''re currently checked out on.',
 'curated', 'curator', '2026-05-04'),

('git-tag', 'tag', null, 'git-cli', 1,
 'A permanent label attached to a specific commit, usually to mark a released version.',
 'A tag is like a sticky note on a commit — it doesn''t move when new commits land. Most teams tag release commits with a version number (`v1.0.0`, `v1.0.1`) so they can always jump back to exactly the code that shipped.',
 'Tag this commit v1.0.0 so we can roll back to it if the deploy goes sideways.',
 'When dev family talks about "the v2.3 tag" or Claude Code says "tagged release," this is the marker they mean. Tags are how versions stay findable in a project''s history forever.',
 ARRAY['git-commit','git-log','dev-deploy']::text[],
 ARRAY['git-commit']::text[],
 null,
 ARRAY[
   'A label applied to a pull request to categorize it',
   'A keyword embedded in a commit message',
   'A user mentioned in a code-review comment'
 ]::text[],
 'Add a ___ on this commit, v1.0.0, so we can roll back to it if the deploy goes sideways.',
 'Use ''tag'' in a sentence about marking a release in your project history.',
 'curated', 'curator', '2026-05-04'),

('git-checkout', 'checkout', null, 'git-cli', 1,
 'Switching the files in your working directory to match a different branch or commit.',
 '`git checkout` moves you between snapshots — to another branch, to a specific commit, or even just to restore a single file to a previous state. (Newer Git also offers `git switch` and `git restore` for these jobs separately, but checkout is still everywhere in tutorials and old habits.)',
 'Checkout the feature branch and tell me if the bug repros there too.',
 'You hear "checkout" in nearly every Git conversation. Knowing it''s how you change which version of the code you''re looking at unlocks the entire branch-switching workflow.',
 ARRAY['git-branch','git-head','git-stash']::text[],
 ARRAY['git-branch']::text[],
 null,
 ARRAY[
   'Logging out of your Git account on a remote',
   'Marking a pull request as ready for review',
   'Downloading a release from a hosting service'
 ]::text[],
 '___ the feature branch and tell me if the bug repros there too.',
 'Use ''checkout'' in a sentence about switching to a different branch.',
 'curated', 'curator', '2026-05-04'),

-- ─── git-cli: terminal / shell (11) ───────────────────────────
('cli-terminal', 'terminal', null, 'git-cli', 1,
 'The text-based window where you type commands directly to your computer.',
 'A terminal is the application that gives you a text prompt — Terminal.app on macOS, iTerm, Windows Terminal. You type a command, hit enter, and the computer runs it and prints the output. Underneath the terminal is a shell (like bash or zsh) that actually interprets what you typed.',
 'Open a new terminal tab and run the dev server there so the build keeps going.',
 'Claude Code lives in the terminal. Every "type this in your terminal" instruction assumes you know what one is — having the word locked makes you fluent in any tutorial.',
 ARRAY['cli-bash','cli-cd','cc-claude-code']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A graphical file browser like Finder',
   'A web browser tab used for development',
   'A monitor connected to a remote server'
 ]::text[],
 'Open a new ___ tab and run the dev server there so the build keeps going.',
 'Use ''terminal'' in a sentence about where you type commands on your computer.',
 'curated', 'curator', '2026-05-04'),

('cli-bash', 'bash', null, 'git-cli', 1,
 'A common shell program that interprets the commands you type in a terminal.',
 'Bash (Bourne Again SHell) is the default shell on most Linux servers and was the default on macOS until 2019, when Apple switched to zsh. They''re close cousins — most commands work the same in both. When someone says "run this in bash," they almost always just mean "run this in your terminal."',
 'That install script is bash, so it should work on the Mac without any tweaks.',
 'Tutorials, deploy scripts, and Claude Code instructions are written for bash by default. Knowing the term means you can tell when something needs a real shell vs. a Windows-flavored alternative.',
 ARRAY['cli-terminal','cli-cd','cli-pipe']::text[],
 ARRAY['cli-terminal']::text[],
 null,
 ARRAY[
   'A programming language used for web backends',
   'A package manager for installing developer tools',
   'A graphical text editor for code'
 ]::text[],
 'That install script is ___, so it should work on the Mac without any tweaks.',
 'Use ''bash'' in a sentence about the shell program running your commands.',
 'curated', 'curator', '2026-05-04'),

('cli-cd', 'cd', 'C-D', 'git-cli', 1,
 'The command that changes which folder your terminal is currently working in.',
 '`cd` stands for "change directory." You give it a path — `cd src`, `cd ..` to go up one level, `cd ~` for your home folder — and your terminal session moves there. Almost every other command (`ls`, `cat`, `git`) operates on whatever folder you''re currently `cd`''d into.',
 'cd into the project folder before you run npm install or it''ll grab the wrong package.json.',
 'Every multi-step terminal walkthrough starts with `cd somewhere`. Recognizing it on sight means you''re never confused about why a command failed because Claude Code was in the wrong folder.',
 ARRAY['cli-terminal','cli-ls','cli-bash']::text[],
 ARRAY['cli-terminal']::text[],
 null,
 ARRAY[
   'A command that copies files between folders',
   'A command that prints the current date',
   'A command that creates a new directory'
 ]::text[],
 '___ into the project folder before you run npm install or it''ll grab the wrong package.json.',
 'Use ''cd'' in a sentence about moving to a different folder in the terminal.',
 'curated', 'curator', '2026-05-04'),

('cli-ls', 'ls', 'L-S', 'git-cli', 1,
 'The command that lists the files and folders in your current directory.',
 '`ls` is short for "list." Run by itself it prints the names of everything in the current folder. Common flags: `ls -a` shows hidden files (the ones that start with a dot), `ls -l` shows sizes and permissions in a long format.',
 'ls the build folder and make sure the assets actually got copied over.',
 'Every terminal session starts with figuring out what''s here. Knowing `ls` means you can verify Claude Code put the right files in the right place without reaching for Finder.',
 ARRAY['cli-cd','cli-cat','cli-terminal']::text[],
 ARRAY['cli-terminal']::text[],
 null,
 ARRAY[
   'A command that opens a file in an editor',
   'A command that searches for text in files',
   'A command that deletes a file'
 ]::text[],
 '___ the build folder and make sure the assets actually got copied over.',
 'Use ''ls'' in a sentence about checking what''s inside a folder from the terminal.',
 'curated', 'curator', '2026-05-04'),

('cli-grep', 'grep', null, 'git-cli', 1,
 'A command that searches for a pattern of text inside files and prints the matching lines.',
 '`grep` takes a pattern and one or more files (or piped input) and shows you every line that matches. It''s the default tool for "find me everywhere this string appears." Add `-r` to recurse into folders, `-i` to ignore case, `-n` to show line numbers.',
 'grep for the API key in the codebase to make sure it isn''t hardcoded anywhere.',
 'You''ll see grep in nearly every debug session. When Claude Code says "let me grep the repo for that," knowing the verb means you understand it''s doing a fast text search across files.',
 ARRAY['cli-cat','cli-pipe','cli-bash']::text[],
 ARRAY['cli-terminal']::text[],
 null,
 ARRAY[
   'A command that compresses files into an archive',
   'A command that monitors network traffic',
   'A command that sorts lines alphabetically'
 ]::text[],
 '___ for the API key in the codebase to make sure it isn''t hardcoded anywhere.',
 'Use ''grep'' in a sentence about searching for text across files.',
 'curated', 'curator', '2026-05-04'),

('cli-pipe', 'pipe', null, 'git-cli', 1,
 'The `|` character that sends the output of one command into the input of another.',
 'A pipe glues commands together: `ls | grep test` lists the current folder and feeds that list into grep, which prints only the matching lines. Pipes are what makes the terminal feel like Lego — small commands compose into powerful one-liners.',
 'Pipe the log into grep so we only see the error lines.',
 'Pipes are the punctuation of the shell. Once you can read `command-a | command-b | command-c` as "feed a into b into c," half of intimidating-looking terminal commands become legible.',
 ARRAY['cli-grep','cli-bash','cli-cat']::text[],
 ARRAY['cli-terminal','cli-bash']::text[],
 null,
 ARRAY[
   'A command that runs another command with admin privileges',
   'A configuration file that defines build steps',
   'A symbol that comments out a line of code'
 ]::text[],
 '___ the log into grep so we only see the error lines.',
 'Use ''pipe'' in a sentence about chaining two commands together in the terminal.',
 'curated', 'curator', '2026-05-04'),

('cli-sudo', 'sudo', 'SOO-doo', 'git-cli', 1,
 'The command that runs another command with administrator privileges.',
 '`sudo` stands for "superuser do." You prefix any command with it when the action requires elevated permissions — installing system software, editing protected files, restarting services. The terminal will prompt for your password the first time in a session.',
 'You''ll need sudo to install Homebrew on a fresh Mac.',
 'Anytime Claude Code or a tutorial says "run with sudo," there''s a permission gate involved. Knowing the word keeps you from getting stuck on a "permission denied" error.',
 ARRAY['cli-bash','cli-terminal']::text[],
 ARRAY['cli-terminal']::text[],
 null,
 ARRAY[
   'A command that suspends a running process',
   'A command that displays the current user''s name',
   'A command that schedules a task to run later'
 ]::text[],
 'You''ll need ___ to install Homebrew on a fresh Mac.',
 'Use ''sudo'' in a sentence about running a command that needs admin permissions.',
 'curated', 'curator', '2026-05-04'),

('cli-cat', 'cat', null, 'git-cli', 1,
 'A command that prints the contents of a file straight to the terminal.',
 '`cat` is short for "concatenate." Give it a filename and it dumps the whole file to your screen. Hand it multiple filenames and it prints them back-to-back. It''s the fastest way to peek at a small text file without opening an editor.',
 'cat the .env file and make sure the Supabase URL is the production one.',
 'When Claude Code or a tutorial says "cat this file to check it," they''re asking you to print it to the terminal. The verb is one of the most-used in any walkthrough.',
 ARRAY['cli-ls','cli-grep','cli-pipe']::text[],
 ARRAY['cli-terminal']::text[],
 null,
 ARRAY[
   'A command that creates an empty file',
   'A command that copies a file to a new location',
   'A command that compresses a file'
 ]::text[],
 '___ the .env file and make sure the Supabase URL is the production one.',
 'Use ''cat'' in a sentence about printing a file''s contents to the terminal.',
 'curated', 'curator', '2026-05-04'),

('cli-mv', 'mv', 'M-V', 'git-cli', 1,
 'The command that moves or renames a file or folder.',
 '`mv` is short for "move." `mv old.txt new.txt` renames the file; `mv file.txt subfolder/` moves it into another folder. There''s no separate rename command — renaming is just moving to a new name in the same place.',
 'mv the old config out of the src folder so the build stops picking it up.',
 'Tutorials and Claude Code use mv constantly to rearrange project files. Knowing it covers both move AND rename means you''re not surprised when it shows up in either context.',
 ARRAY['cli-cd','cli-rm','cli-ls']::text[],
 ARRAY['cli-terminal']::text[],
 null,
 ARRAY[
   'A command that creates a backup of a file',
   'A command that compares two files line by line',
   'A command that shows the size of a file'
 ]::text[],
 '___ the old config out of the src folder so the build stops picking it up.',
 'Use ''mv'' in a sentence about moving or renaming a file in the terminal.',
 'curated', 'curator', '2026-05-04'),

('cli-rm', 'rm', 'R-M', 'git-cli', 1,
 'The command that deletes a file or folder — permanently, with no trash.',
 '`rm` stands for "remove." `rm file.txt` deletes one file. `rm -r folder/` recursively deletes a folder and everything inside it. There''s no recycle bin: once it''s gone, it''s gone, which is why `rm -rf` (force, recursive) is famous as a command to be careful with.',
 'rm the old build folder before you run a fresh install.',
 'When Claude Code says "I removed the file" or a tutorial says "rm the dist directory," knowing the command keeps you alert that there''s no undo. Critical for following destructive steps without panic.',
 ARRAY['cli-mv','cli-ls','cli-cd']::text[],
 ARRAY['cli-terminal']::text[],
 null,
 ARRAY[
   'A command that moves a file to the system trash',
   'A command that renames a file in place',
   'A command that hides a file from listings'
 ]::text[],
 '___ the old build folder before you run a fresh install.',
 'Use ''rm'' in a sentence about deleting a file from the terminal.',
 'curated', 'curator', '2026-05-04'),

('cli-manpage', 'man (manpage)', 'man page', 'git-cli', 1,
 'The built-in manual for a command-line tool — type `man <command>` to read it.',
 'A manpage (short for manual page) is documentation that ships with most UNIX tools. Run `man ls` and you get a screenful explaining every flag, every option, every quirk. It''s how developers look things up offline before there was Stack Overflow, and it still works.',
 'Check the man page for grep — there''s a flag to ignore case if you want it.',
 'When Claude Code or dev family says "RTFM" or "the man page covers it," this is what they''re pointing at. Knowing it exists means you have a built-in answer for "what does this flag do?" on your own machine.',
 ARRAY['cli-bash','cli-grep','cli-terminal']::text[],
 ARRAY['cli-terminal','cli-bash']::text[],
 null,
 ARRAY[
   'A README file packaged with a tool',
   'A help message printed when a command errors',
   'A wiki page hosted on GitHub'
 ]::text[],
 'Check the ___ for grep — there''s a flag to ignore case if you want it.',
 'Use ''man page'' in a sentence about reading the built-in docs for a command.',
 'curated', 'curator', '2026-05-04')

on conflict (id) do nothing;
