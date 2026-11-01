# Verifier evaluation: what changed and what remains unknown

This experiment is for product and clinical AI readers assessing whether an output checker deserves trust. The application teaches technical vocabulary. It does not produce clinical summaries or advice.

## Original evidence stays intact

The 2026-10-30 run generated 79 items, accepted 78 and fell back once on a parse failure. Claude reviewed all outputs. Kevin Madden, PharmD, confirmed the five flagged errors as wrong. The supplied expert confirmation is recorded in `eval/data/expert-confirmed-misses.json` with its provenance. The remaining 73 accepted outputs have not had domain-expert adjudication. Five of 78 is a lower bound on errors, not measured accuracy.

The JSONL, review file, metadata and summary from that run are unchanged. The summary's original statement that human confirmation was pending is historical. Confirmation is recorded in the README and the assignment for this work, not retroactively written into those artifacts.

## Failure analysis

| Known miss | Failure mode | Added check |
| --- | --- | --- |
| Nurse RLS | Invented unit-based chart restriction presented as normal practice | Hold clinical access claims without evidence |
| Pharmacist RLS | Store-scoped queues conflated with shared patient profiles | Same access policy |
| JWT | Invented signed, tamper-evident prescription label | Hold clinical credential and artifact claims |
| OAuth | Invented patient login to a dispensing chart | Same credential policy |
| Environment | Staging described as the only real claims connection despite the definition of production | Hold unsupported staging exclusivity |

The LLM's explanations repeated or rationalized the wrong claims. More confident reasoning was not independent evidence. Four misses used analogies. The fifth sat in an example sentence, so the check examines all three fields and ignores the model's own analogy flag.

## Intervention and protocol

A small deterministic check supplements the existing model verifier. It holds sentences combining clinical context with access or credential language, and sentences combining staging, exclusivity and a real connection. These are abstention triggers, not proof that a sentence is false. The check enters the existing bounded regeneration path with actionable feedback. The same check runs on the retry. An unchanged rejected retry falls back to canonical text. It adds no model call to the existing maximum and no network request of its own. Prompt/cache version is bumped to 10 in both required locations.

The policy intentionally sacrifices some personalization. It cannot validate arbitrary medical or technical claims. Its wording-based matching misses paraphrases and unrelated errors, and it can reject negations and fictional examples. Those are measured below. No tuning followed held-out evaluation.

The 24-item synthetic challenge set was generated and committed in `46d879b` before implementation in `62925e1`. Seed `20261031` shuffles author-written cases, it does not randomly sample the world. The generator, labels and generated file are committed. SHA-256: `7f10a0a5a2341d0146950724f038a26c20facea757534a6d166355fc85a6f95b`. This is a frozen development challenge set, not an independently authored or expert-adjudicated clinical benchmark. Its overlap with the known failure families limits generalization claims.

## Results

No paid API was called. These results measure the added deterministic policy. They do not measure new LLM verdicts, regenerated outputs, latency, spend, deployment or end-to-end post-change accuracy.

| Historical accepted-output replay | Before | With added policy |
| --- | ---: | ---: |
| Saved accepted outputs examined | 78 | 78 |
| Expert-confirmed wrong outputs allowed through | 5 | 0 |
| Additional outputs held, without expert adjudication | 0 | 7 |
| Confirmed false rejections | Unknown | Unknown |

Twelve of 78 saved accepted outputs are held. The seven additional holds must be adjudicated before calling this an improvement in overall quality. They may include useful explanations lost to a conservative rule. Zero known misses remaining is not zero actual errors. This replay stops at the decision to hold and cannot predict whether regeneration will succeed.

| Frozen synthetic challenge, added-policy ablation | Policy absent | Policy present |
| --- | ---: | ---: |
| Incorrect author-labeled items allowed through, out of 12 | 12 | 4 |
| Correct author-labeled items rejected, out of 12 | 0 | 4 |

The absent-policy column means the supplemental rule does nothing. It is not a result for the original LLM verifier. Before and after LLM results on this new set are **not measured**. Reporting them as measured would fabricate a baseline. The no-paid-API constraint blocks a faithful rerun of the original API-based verifier on the held-out set.

### Every held-out miss

- `heldout-12`: every medication interaction is harmless if the dose is low enough.
- `heldout-09`: two passwords count as two independent authentication factors.
- `heldout-11`: an idempotent request must produce a different result every time it is repeated.
- `heldout-10`: a JWT encrypts its payload so nobody can read the claims.

These errors are outside the rule's scope. The original LLM might reject them, but that has not been measured here.

### Every new synthetic false rejection

- `heldout-21`: in this fictional hospital demo, row-level security hides records outside the assigned unit.
- `heldout-20`: a prescription label is not a signed authentication token.
- `heldout-22`: a toy pharmacy application gives each patient a login to a fictional chart.
- `heldout-19`: do not assume a hospital system only shows charts from your unit.

### Additional historical holds needing expert review

Punctuation is normalized below for readability. The replay artifact retains the exact original strings.

- `excel-pivot-table::nurse`: a PivotTable takes a big spreadsheet of raw data and lets you summarize it by dragging field names into row, column, value, and filter boxes. you pick what to group by and what to count, sum, or average, and Excel builds the summary table for you without you writing any formulas. when you have thousands of rows , think a year of patient admissions or medication scans , and someone in a meeting asks "how many falls per unit per month," a PivotTable gets you the answer in a few clicks instead of counting by hand or writing a formula for every cell. it is the fastest way to turn a data dump into something you can actually talk about. the quality nurse pulled the fall data into a PivotTable to show rates by unit and shift at the staff meeting.
- `sec-mfa::pharmacist`: MFA stands for multi-factor authentication. logging in takes two or more kinds of proof, like a password plus a code from an authenticator app, a tap on your phone, a hardware key, or a fingerprint. if someone steals one piece, they still can't get in without the other. it's the same reason a C-II dispense needs more than one check , one safeguard isn't enough on something that matters. when the help desk says they're enabling MFA on the pharmacy system, they mean your password alone will no longer get you in, and that's on purpose. after the last software update, signing into the pharmacy system uses MFA, so i enter my password and then approve a prompt on my phone.
- `sec-mfa::nurse`: MFA stands for multi-factor authentication. logging in takes two or more kinds of proof , usually a password plus something else like a code from an app, a tap on your phone, a physical key fob, or a fingerprint. that way if one piece gets stolen, the account still holds. this is why badging into the EHR sometimes also pings your phone, or why your bank texts a code after the right password. when IT says a system is MFA-protected, they mean one leaked password isn't enough to get in , an attacker would also need your phone or fingerprint. IT turned on MFA for remote chart access, so logging in from home now needs my password plus a code from the app on my phone.
- `fabric-data-pipeline::pharmacist`: a data pipeline in Fabric is a set of automated steps that copies, moves, or reshapes data from one system to another on a schedule. it handles repeatable work like pulling records out of one database, cleaning them up, and loading them into another place where they can be reported on. a pipeline is the scheduled plumbing that shuffles data between systems so nobody is exporting spreadsheets by hand every night. when the help desk mentions "the nightly load" or "the overnight job," they mean a pipeline running on its own while the store is closed. the data pipeline pulls prescription fill records from the dispensing system into the reporting database every night so the morning dashboards are ready before open.
- `sec-oauth::nurse`: OAuth is a standard way for one service to let another service sign you in or access your data without you handing over your actual password. the app bounces you to a trusted sign-in service like Google or Microsoft, you log in there, and that service hands back a token , a short-lived pass that proves who you are to the app. every "sign in with Google" or "sign in with Microsoft" button on the hospital's new tools is doing this behind the scenes. when IT talks about a login that redirects you to the Microsoft page and then back into the charting app, OAuth is the rulebook making that handoff work , and the reason the vendor app never sees your actual hospital password. IT said the new documentation tool will use OAuth so we can sign in with our hospital Microsoft account instead of creating a separate login.
- `sec-rbac::nurse`: RBAC stands for role-based access control. Instead of deciding permissions one person at a time, the system defines roles , like how your EHR gives nurses, physicians, pharmacists, and unit clerks each a different set of things they can see and do , and every user gets assigned a role that carries those permissions. RBAC is the standard pattern in admin tools, dashboards, enterprise software, and cloud consoles. when an access conversation starts going in circles , who can chart what, why is this person locked out , naming RBAC gets everyone on the same page. once you hear it in a vendor meeting, you know access is being handed out by role, not person by person, so the fix is usually 'change their role' or 'adjust what the role allows,' not a one-off override. the vendor explained that the new AI documentation tool uses RBAC, so nurses, residents, and attendings each see a different set of actions when they open a note.
- `data-join::nurse`: a join combines rows from two separate tables by matching them on a shared piece of information. think of how the EHR links a patient's room number to their full chart: the room assignment list and the patient chart live in different places, but they share a patient ID, so the system can pull them together into one view. databases store information in slim, separate tables to avoid repeating data , one table for patients, another for medications, another for vitals. a join is what stitches them back together so a single screen can show the patient's name next to their current meds and latest vitals. almost every useful EHR screen is built on joins happening behind the scenes. the vendor explained that the new dashboard runs a join to show each patient's name alongside their pending orders, instead of making the nurse open two screens.

Full candidates, row-level decisions, reasons and input hashes are in [the replay artifact](../../eval/results/claim-check-replay-v1.json). Every historical candidate is preserved there, including unchanged acceptances. Original five examples and review notes remain in [the original review](../../eval/results/2026-10-30-review.json).

## Reproduce without spending

Use Node 24 and the checked-in lockfile.

```sh
npm ci
node eval/build-heldout.mjs
node eval/replay-claim-check.ts
npm test -- src/lib/personalize-claim-check.test.ts src/lib/prompt-version-sync.test.ts
npm run pre-deploy
```

The replay enforces the frozen set hash. Do not alter that set to improve results. A later verifier revision needs a new preregistered hold-out. The existing network runner imports the same checked parser for both verifier passes, but it was not invoked here.

## What carries over to clinical summaries

The transferable practice is to retain the source and output, collect expert labels, classify errors, separate development cases from frozen challenges, and measure false acceptance alongside false rejection. A clinical summary checker would need source-grounded checks for omissions, negation, dose, timing and unsupported conclusions. A fluent explanation of a verdict cannot substitute for evidence in the source record.

This experiment has five pharmacist-confirmed negative labels, not a full clinical gold set. All new examples are fictional. A credible next evaluation needs blinded domain-expert adjudication of every accepted and rejected item, a new independently authored challenge set, and both verifier versions run against identical frozen candidates. Measure reviewer workload and lost useful summaries as well as caught errors. Canonical content also needs review because a checker anchored to a wrong source can endorse that error. The two previously noted seed errors remain out of scope.

## Release decision

Reviewable implementation and offline evidence are available. This is not evidence to deploy or advertise an accuracy gain. Release remains blocked on faithful model before/after runs and domain-expert review of the seven additional historical holds. No deployment or merge was performed.

## November 1 review follow-up

The calendar refill defect is fixed with frozen local-month regression tests. PostgreSQL 17 ACL checks were rerun using the available local toolchain. The original verification record above remains historical. See [review-fix verification](review-fixes.md) for current commands and results, and [release decisions](release-decisions.md) for the unresolved expert review and authorized inference gates. Both PRs remain HOLD.
