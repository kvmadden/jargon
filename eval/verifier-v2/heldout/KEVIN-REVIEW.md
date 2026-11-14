# Held-out items for review: only where the two labelers disagree

10 of 39 items. Claude proposed one label, and a second-family model (ollama local qwen3.8:27b, blind to the proposed labels) gave the other. Only the correct-versus-flawed split is listed, because only that changes a score. Nothing else in the set needs review.

## sys-enum::hospital-pharmacist

- Claude: **misleading**. An allergy field limited to four values (NKDA, penicillin, sulfa, latex) is not realistic. Allergy fields draw on large coded allergen lists.
- Second labeler: **correct**. All claims about what an enum is, why it matters for data consistency, and the clinical examples (allergy fields, order status, intervention-tracking) are accurate and plausible for a hospital pharmacist's context.

> an enum is a field locked to a fixed list of allowed values — like an allergy field that only accepts NKDA, penicillin, sulfa, or latex instead of free text. order status might be limited to draft, active, paused, or archived, and nothing else.
>
> free-text fields drift fast: "in progress," "In Progress," and "working" all end up meaning the same thing but counting as three different values when someone runs a report. an enum pins a field to a known set of options so sloppy wording never becomes sloppy data.
>
> the vendor said the new intervention-tracking field is an enum, so pharmacists can only pick from accepted, modified, or declined — no typing freeform reasons into that slot.

## sec-secret::nurse

- Claude: **wrong**. Automated dispensing cabinets use individual credentials. A shared unit code is not standard and would defeat controlled-substance accountability.
- Second labeler: **correct**. All claims are accurate: the definition of a secret, the narcotics-cabinet analogy (plausible for a community hospital), the guidance on where secrets should not be stored, and the AI-scribe API-key example are all reasonable and true for a med-surg RN.

> a secret is any value that grants access to whoever holds it — API keys, database passwords, tokens, signing keys. like the narcotics cabinet code, which every nurse on the unit shares so anyone can get in during an emergency, it only protects anything as long as it stays with the people who need it. secrets belong in protected storage, not in code that gets saved to shared repositories, not in log files, not in screenshots, not pasted into chat.
>
> when an IT or vendor person says "don't ever commit that" about a key or password, this is what they mean. the classic mistake is treating a secret like regular text — pasting it into a screenshot for a ticket, an email, or a shared document. anything that lets the value be seen hands over the access, the same way a sticky note with a password on a monitor defeats the password.
>
> the vendor reminded us that the API key for the AI scribe is a secret, so don't paste it into a help-desk ticket or a screenshot.

## sec-secret::pharmacist

- Claude: **wrong**. A DEA number is not a secret. It is printed on prescriptions and shared with pharmacies routinely, so the comparison is false.
- Second labeler: **correct**. All claims are accurate: the definition of a secret, the analogies to DEA number and controlled-substance safe combination are appropriate for a retail pharmacist, and the guidance about not exposing tokens in screenshots, emails, or chat is standard and correct.

> a secret is any value that grants access to whoever holds it — API keys, database passwords, signing keys, webhook secrets. like the DEA number or a controlled-substance safe combination, it belongs in a protected place, never written into code commits, log files, screenshots, or chat messages where others can see it.
>
> when the help desk says "don't ever paste that key anywhere," this is the category they mean. recognizing a secret keeps you from the classic mistake of dropping one into a screenshot, a support ticket, or a shared chat — anything that hands over access just by being visible.
>
> the trainer reminded us that the integration token is a secret, so it stays in the system's secure settings and never gets emailed or screenshotted to the help desk.

## sec-secret::hospital-pharmacist

- Claude: **misleading**. Automated dispensing cabinet override is a function tied to a user's own credentials, not a shared 'Pyxis override code' or combination.
- Second labeler: **correct**. All claims are accurate: the definition of a secret as an access-granting value, the analogies to Pyxis override codes and controlled-substance cabinet combinations are appropriate for a hospital pharmacist, and the antibiogram feed interface password example is a plausible and relevant scenario for a clinical pharmacist's workplace.

> a secret is any value that grants access to whoever holds it — API keys, database passwords, signing keys, tokens used by one system to call another. like an override code or a controlled-substance cabinet combination, possession alone is authorization, so these values belong in protected storage, never in code commits, log files, screenshots, or chat messages.
>
> when IT or a vendor says "don't ever share that" about a key or token, this is the category they mean. spotting one keeps you from the classic mistake of pasting it into a screenshot, a ticket, or an email — anything that hands over access just by being seen, the same way you wouldn't text someone the Pyxis override code.
>
> the interface password the vendor sent for the new antibiogram feed is a secret, so don't paste it into the meeting chat.

## web-domain::nurse

- Claude: **wrong**. Each organization runs MyChart at its own address. There is no single shared domain for every hospital.
- Second labeler: **correct**. All claims about domain names, DNS, MyChart's shared domain, and the practical advice about checking domains in emailed links are accurate and appropriately simplified for a nurse.

> a domain name is the readable site name in a web address, like epic.com or your hospital's intranet address. patient portals like MyChart all share one domain, mychart.com, for every hospital. behind the scenes, a system called DNS looks up that name and translates it into a numeric internet address so your computer knows where to send the request. the same domain can lead to the live site, a test version, documentation, or a dashboard.
>
> the domain name is the part of a link that stays steady even when everything after the slash changes. if IT or a vendor emails you a new link, checking whether the domain is the same tells you whether the whole site moved or just the page within it changed.
>
> IT said the charting login's domain name isn't changing with the upgrade, only the page you land on after you sign in.

## web-status-code::nurse

- Claude: **wrong**. An allergy wristband flags that allergies exist. It does not list every allergy. The list lives in the chart.
- Second labeler: **correct**. All technical claims about HTTP status codes are accurate, the allergy wristband analogy is a plausible and common clinical reference, and the example of a vendor citing a 500 error as a server-side issue is a reasonable, ordinary workplace scenario for a nurse.

> HTTP (Hypertext Transfer Protocol) is the language browsers and apps use to request things over the internet. A status code is a three-digit number the server sends back to summarize what happened. 200 means it worked, 301 or 302 means the thing moved somewhere else, 401 means you aren't logged in, 403 means you're logged in but not allowed, 404 means the thing wasn't found, and 500 means the server itself broke.
>
> when IT or a vendor is troubleshooting why the chart won't load or a med order won't save, the status code is the first clue they look at, much like the red allergy wristband, which lists each of the patient's allergies so anyone can read them at the bedside, — it tells them instantly whether the problem is the user's access, a missing page, or the server falling over. hearing "it's throwing a 500" vs "it's a 404" points at very different fixes.
>
> the vendor said the AI documentation tool was returning a 500 status code, so the issue was on their server, not our network.

## web-status-code::pharmacist

- Claude: **misleading**. Paid claims carry no reject code. Paid or rejected is a separate response status, and reject codes explain rejections (75 means prior authorization required).
- Second labeler: **correct**. All HTTP status code descriptions are accurate, the insurance-claim rejection code analogy is apt for a retail pharmacist, and the 500-error example correctly identifies a server-side problem.

> HTTP (Hypertext Transfer Protocol) is the language web software uses to make requests. A status code is the number the server sends back that summarizes what happened — a lot like the reject codes you see on an insurance claim, where one number tells you at a glance whether it paid, needs a prior auth, or was refused. 200 means success, 301 or 302 means redirect, 401 means not logged in, 403 means logged in but not allowed, 404 means the thing wasn't found, and 500 means the server itself failed.
>
> the status code is the quick read on how a request went, and it shows up constantly in release notes and help desk calls. 404 means the record or page isn't there; 500 means the system itself crashed — very different problems, told apart at a glance, the same way a claim rejection code tells you whether to call the insurer or fix the Rx.
>
> the help desk said the pharmacy portal was throwing a 500 status code, so the issue was on their server, not our workstation.

## cloud-kubernetes::nurse

- Claude: **wrong**. Admission orders are written by a provider, not the charge nurse.
- Second labeler: **correct**. The technical claims about Kubernetes (container orchestration, scheduling, auto-restart, reconciliation loops, rolling updates) are all accurate, the charge-nurse analogy is a reasonable simplification that conveys the right idea of coordination and assignment, and the charting-system example is a plausible scenario in modern healthcare IT.

> Kubernetes coordinates containers (self-contained bundles of software) running across a group of machines. think of it as the charge nurse for software: just as the charge nurse writes the admission orders for each new patient, it assigns each container to a machine, restarts any that crash, rolls out new versions, and constantly checks that what is actually running matches what is supposed to be running.
>
> when a team says they're 'on kubernetes,' they're telling you their software operations are a whole discipline, not a one-click upload. that's why something as routine as a restart can involve schedulers, clusters of machines, and constant checks that reality matches the plan.
>
> when part of the charting system crashed overnight, kubernetes restarted it and kept the app available without anyone paging IT.

## cloud-log::nurse

- Claude: **misleading**. Compares logs to nursing charting that is careful not to include anything sensitive, but charting is full of protected health information by necessity.
- Second labeler: **correct**. All claims are accurate: the definition of a log as a timestamped record, the analogy to nursing charting, the diagnostic role of logs, and the example of a chart note failing to reach the server are all true and appropriate for a nurse learner.

> a log is a timestamped line that software writes to itself as it runs: request received, job started, payment failed, user signed in. think of it like the running notes you chart on a patient through a shift — each entry stamped with a time, enough detail to show what actually happened, and careful not to include anything sensitive that shouldn't be there.
>
> when something breaks, the log is usually the first place that tells you what the system actually did, instead of what you assumed it did. it is the system's own charting — you stop guessing from the screen and start reading the receipts of what really happened.
>
> IT pulled the log and saw the chart note never reached the server, which is why it disappeared when you refreshed.

## cloud-log::hospital-pharmacist

- Claude: **misleading**. Same comparison: chart entries are described as made without exposing anything sensitive, which is not how clinical documentation works.
- Second labeler: **correct**. All claims are accurate or reasonable simplifications: logs are timestamped system records, the MAR/chart analogies are apt for a pharmacist, and the interface-log example (missing patient location preventing an order from reaching a dispensing cabinet) is a realistic scenario in hospital pharmacy IT.

> a log is a timestamped line that software writes while it runs — request received, job started, order failed, retry scheduled. think of it like the entries a nurse or pharmacist adds to a patient's chart as care happens: each line says when it happened, what the system did, and enough context to reconstruct the event later without exposing anything sensitive.
>
> when something breaks, the log is where the software tells you what it actually did, not what you assumed from the screen. in an EHR downtime or a failed interface, IT will pull the logs the same way you'd pull an MAR to see what was really given — stop guessing from the UI and read the receipts.
>
> the vendor checked the interface log and saw the pharmacy order never reached the dispensing cabinet because the message was missing the patient's location.

