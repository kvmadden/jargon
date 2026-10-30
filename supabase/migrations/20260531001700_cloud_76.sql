-- jargon Stage B+1.36 - math/logic/computation foundations literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 15 coding-domain terms for practical computation literacy:
-- booleans, sets, graphs, nodes, edges, trees, complexity, Big O,
-- probability, distributions, entropy, optimization, constraints,
-- state machines, and Turing completeness.
--
-- Scope:
--   - terms rows only
--   - coding domain only
--   - no profile/rendering cache rewrites
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

('math-boolean', 'boolean', null, 'systems', 'coding', 1,
 'A true-or-false value used in logic and code.',
 'A boolean is a value with only two possible states: true or false. Code uses booleans for conditions, feature flags, permissions, test results, and any decision that branches one way or another. A checkbox, an allowlist match, and "is this test passing?" can all become booleans.',
 'The feature flag stored a boolean that decided whether the new lesson screen was visible.',
 'Boolean is the yes-or-no word underneath many technical decisions. It helps you hear when a system is making a crisp binary choice rather than weighing a fuzzy score.',
 ARRAY['code-conditional','sec-permission','qa-unit-test','math-state-machine']::text[],
 ARRAY[]::text[],
 'code-conditional',
 ARRAY[
   'A named checkpoint on a product roadmap',
   'A database index for faster lookups',
   'A list of numbers representing meaning'
 ]::text[],
 'The feature flag stored a ___ that decided whether the new lesson screen was visible.',
 'Use ''boolean'' in a sentence about a true-or-false software decision.',
 'curated', 'curator', '2026-05-26'),

('math-set', 'set', null, 'systems', 'coding', 1,
 'A collection where each value appears only once.',
 'A set is a collection of unique items. Sets are useful when the question is membership: is this user allowlisted, has this term been seen, which IDs appear in both lists, or which values are missing? The order matters less than whether an item belongs.',
 'The app used a set of mastered term IDs so each term appeared only once.',
 'Set is the uniqueness-and-membership word. It helps you understand why engineers talk about intersections, unions, and deduping instead of only arrays or lists.',
 ARRAY['code-array','data-primary-key','math-graph','math-boolean']::text[],
 ARRAY['code-array']::text[],
 'math-graph',
 ARRAY[
   'A generated build artifact',
   'A running operating-system process',
   'A model score between zero and one'
 ]::text[],
 'The app used a ___ of mastered term IDs so each term appeared only once.',
 'Use ''set'' in a sentence about unique values or membership.',
 'curated', 'curator', '2026-05-26'),

('math-graph', 'graph', null, 'systems', 'coding', 2,
 'A structure made of nodes connected by edges.',
 'A graph models relationships. The nodes are things, and the edges are connections between them. Social networks, dependency maps, route maps, knowledge graphs, file imports, and prerequisite chains can all be represented as graphs.',
 'The concept atlas is a graph of terms connected by prerequisite and neighbor links.',
 'Graph is the relationship-map word. It helps you understand how software represents networks of people, files, routes, concepts, and dependencies.',
 ARRAY['math-node','math-edge','math-tree','code-module']::text[],
 ARRAY['math-set']::text[],
 'math-node',
 ARRAY[
   'A true-or-false value used in code',
   'A one-time database repair operation',
   'A browser security boundary'
 ]::text[],
 'The concept atlas is a ___ of terms connected by prerequisite and neighbor links.',
 'Use ''graph'' in a sentence about connected things.',
 'curated', 'curator', '2026-05-26'),

('math-node', 'node', null, 'systems', 'coding', 2,
 'One point or item inside a graph or tree.',
 'A node is one item in a connected structure. In a social graph, a node might be a person. In a dependency graph, it might be a package. In a tree, it might be one folder, term, or decision point.',
 'Each term in the atlas is a node with links to nearby concepts.',
 'Node is the "one thing in the map" word. It helps you follow graph, tree, network, and architecture talk without losing the unit being discussed.',
 ARRAY['math-graph','math-edge','math-tree','net-router']::text[],
 ARRAY['math-graph']::text[],
 'math-edge',
 ARRAY[
   'The amount of memory a process uses',
   'A customer account in a CRM',
   'A server response status number'
 ]::text[],
 'Each term in the atlas is a ___ with links to nearby concepts.',
 'Use ''node'' in a sentence about one point in a graph or tree.',
 'curated', 'curator', '2026-05-26'),

('math-edge', 'edge', null, 'systems', 'coding', 2,
 'A connection between two nodes in a graph.',
 'An edge is the relationship line between two nodes. It can mean follows, imports, depends on, connects to, links to, or routes toward, depending on the graph. Edges are what turn a pile of items into a relationship map.',
 'The prerequisite edge connected "embedding" to "RAG" in the learning map.',
 'Edge is the connection word. It helps you understand whether a system is discussing the things themselves or the relationships between them.',
 ARRAY['math-graph','math-node','math-tree','arch-dependency-injection']::text[],
 ARRAY['math-node']::text[],
 'math-tree',
 ARRAY[
   'The server code that runs near a user',
   'A reusable block of code with inputs',
   'A named business milestone'
 ]::text[],
 'The prerequisite ___ connected "embedding" to "RAG" in the learning map.',
 'Use ''edge'' in a sentence about a connection between two nodes.',
 'curated', 'curator', '2026-05-26'),

('math-tree', 'tree', null, 'systems', 'coding', 2,
 'A hierarchy where nodes branch downward from a root.',
 'A tree is a special graph with hierarchy and no loops. Filesystems, menus, document outlines, parse trees, comment threads, and decision trees all use this shape: one root, branches, and leaves.',
 'The settings page used a tree of sections, subsections, and fields.',
 'Tree is the hierarchy word. It helps you understand why engineers distinguish parent, child, root, branch, and leaf relationships.',
 ARRAY['math-graph','math-node','math-edge','os-filesystem']::text[],
 ARRAY['math-node','math-edge']::text[],
 'math-complexity',
 ARRAY[
   'A table query that combines related rows',
   'A service-level reliability target',
   'A list that allows duplicate values'
 ]::text[],
 'The settings page used a ___ of sections, subsections, and fields.',
 'Use ''tree'' in a sentence about a hierarchy of nodes.',
 'curated', 'curator', '2026-05-26'),

('math-complexity', 'complexity', null, 'systems', 'coding', 2,
 'How an algorithm''s work grows as the input grows.',
 'Complexity describes how much time or memory an algorithm needs as the input gets bigger. A solution that feels instant for 10 items can become unusable for 10 million items. Complexity is why engineers care about growth rate, not only whether code works on a tiny example.',
 'The first search worked on 50 terms, but its complexity became a problem at 50,000 terms.',
 'Complexity is the scaling-cost word. It helps you understand why engineers rewrite code that already works: sometimes the small version works and the large version falls apart.',
 ARRAY['math-big-o','code-algorithm','math-optimization','hw-cpu']::text[],
 ARRAY['code-algorithm']::text[],
 'math-big-o',
 ARRAY[
   'A formal document describing system interfaces',
   'A managed login flow across work apps',
   'A collection of unique values'
 ]::text[],
 'The first search worked on 50 terms, but its ___ became a problem at 50,000 terms.',
 'Use ''complexity'' in a sentence about how work grows with input size.',
 'curated', 'curator', '2026-05-26'),

('math-big-o', 'Big O', 'big oh', 'systems', 'coding', 3,
 'Notation for describing how an algorithm scales as input grows.',
 'Big O is the shorthand engineers use for growth rate. O(1) means roughly constant work. O(n) grows with the number of items. O(n squared) grows much faster because each new item can multiply the work. Big O ignores tiny details and focuses on the shape of scaling.',
 'The duplicate check changed from O(n squared) to O(n), so it stayed fast on a large seed file.',
 'Big O is the scaling-shape word. It helps you understand why "works" is not always enough; the question is whether it still works when the input gets large.',
 ARRAY['math-complexity','code-algorithm','math-optimization','data-index']::text[],
 ARRAY['math-complexity']::text[],
 'math-optimization',
 ARRAY[
   'A security model that verifies every request',
   'A model output forced into JSON',
   'A customer relationship management system'
 ]::text[],
 'The duplicate check changed from ___ to O(n), so it stayed fast on a large seed file.',
 'Use ''Big O'' in a sentence about algorithm scaling.',
 'curated', 'curator', '2026-05-26'),

('math-probability', 'probability', null, 'systems', 'coding', 1,
 'A measure of how likely something is to happen.',
 'Probability is a way to talk about uncertainty with numbers. A probability near zero is unlikely. A probability near one is likely. Models, risk systems, spam filters, forecasts, and experiments all use probability when the answer is not guaranteed.',
 'The classifier returned a high probability that the uploaded image was a receipt.',
 'Probability is the uncertainty-number word. It helps you hear when a system is making a likely guess rather than stating a fact.',
 ARRAY['math-distribution','ml-classification','ml-precision','qa-flaky-test']::text[],
 ARRAY[]::text[],
 'math-distribution',
 ARRAY[
   'A graph connection between two nodes',
   'A browser value sent with requests',
   'A code bundle produced by a build'
 ]::text[],
 'The classifier returned a high ___ that the uploaded image was a receipt.',
 'Use ''probability'' in a sentence about likelihood under uncertainty.',
 'curated', 'curator', '2026-05-26'),

('math-distribution', 'distribution', null, 'systems', 'coding', 2,
 'The shape of possible values and how often they occur.',
 'A distribution describes which values can happen and how common each one is. Response times, user ages, model scores, errors per day, and test durations all have distributions. Averages can hide the shape; distributions show whether values cluster, spread out, or have rare extremes.',
 'The average load time looked fine, but the distribution showed some users waiting ten seconds.',
 'Distribution is the shape-of-values word. It helps you ask what is happening across the whole group instead of trusting one average.',
 ARRAY['math-probability','cloud-metric','qa-slo','ml-validation-set']::text[],
 ARRAY['math-probability']::text[],
 'math-entropy',
 ARRAY[
   'A hierarchy of nodes from a root',
   'A one-way fingerprint of data',
   'A function input supplied at call time'
 ]::text[],
 'The average load time looked fine, but the ___ showed some users waiting ten seconds.',
 'Use ''distribution'' in a sentence about the shape of possible values.',
 'curated', 'curator', '2026-05-26'),

('math-entropy', 'entropy', null, 'systems', 'coding', 3,
 'A measure of uncertainty, surprise, or information content.',
 'Entropy measures how unpredictable something is. A fair coin has more entropy than a coin that almost always lands heads. In computing and AI, entropy shows up in compression, randomness, decision trees, passwords, uncertainty, and model output diversity.',
 'The password generator needed enough entropy that attackers could not guess the result.',
 'Entropy is the uncertainty-and-information word. It helps you connect randomness, compression, security, and model confidence without treating them as separate magic tricks.',
 ARRAY['math-probability','math-distribution','sec-secret','ml-loss-function']::text[],
 ARRAY['math-probability']::text[],
 'math-optimization',
 ARRAY[
   'The official system that owns a business record',
   'A branch replayed onto a newer base',
   'A route path inside a web app'
 ]::text[],
 'The password generator needed enough ___ that attackers could not guess the result.',
 'Use ''entropy'' in a sentence about uncertainty or information content.',
 'curated', 'curator', '2026-05-26'),

('math-optimization', 'optimization', null, 'systems', 'coding', 2,
 'Searching for the best available solution under constraints.',
 'Optimization means improving a solution toward a goal: faster, cheaper, more accurate, less memory, more revenue, lower risk, or better user experience. Real optimization usually has constraints, so the best answer is not abstractly perfect; it is best under the limits that matter.',
 'The team treated onboarding as an optimization problem: reduce confusion without hiding important choices.',
 'Optimization is the better-under-limits word. It helps you hear when engineers are not just polishing, but choosing a target and improving against it.',
 ARRAY['math-constraint','math-complexity','math-big-o','ml-loss-function']::text[],
 ARRAY['math-constraint']::text[],
 'math-constraint',
 ARRAY[
   'A browser rule for cross-origin requests',
   'A table column that points to another row',
   'A generated bundle from a build'
 ]::text[],
 'The team treated onboarding as an ___ problem: reduce confusion without hiding important choices.',
 'Use ''optimization'' in a sentence about improving toward a goal under limits.',
 'curated', 'curator', '2026-05-26'),

('math-constraint', 'constraint', null, 'systems', 'coding', 1,
 'A rule or limit that restricts which solutions are allowed.',
 'A constraint is a limit the solution must respect. It might be budget, time, data shape, screen size, privacy, performance, safety, or an engineering rule. Constraints are not always bad; they make the problem real enough to solve.',
 'Mobile screen width was the constraint that forced the lesson layout to become simpler.',
 'Constraint is the limit word. It helps you turn "why can''t we just..." into a concrete discussion about what rule, cost, or boundary is doing the limiting.',
 ARRAY['se-constraint','math-optimization','prod-acceptance-criteria','math-state-machine']::text[],
 ARRAY[]::text[],
 'math-optimization',
 ARRAY[
   'A database row that stores one record',
   'A human review after an incident',
   'A generated image stored in a bucket'
 ]::text[],
 'Mobile screen width was the ___ that forced the lesson layout to become simpler.',
 'Use ''constraint'' in a sentence about a limit a solution must respect.',
 'curated', 'curator', '2026-05-26'),

('math-state-machine', 'state machine', null, 'systems', 'coding', 3,
 'A model of allowed states and transitions between them.',
 'A state machine describes the allowed states something can be in and the events that move it between those states. An invite can be pending, accepted, expired, or revoked. A lesson can be unseen, learning, due for review, or mastered. State machines prevent impossible combinations.',
 'The invite flow used a state machine so an expired invite could not also be accepted.',
 'State machine is the lifecycle-and-transition word. It helps you understand why engineers define allowed states instead of juggling many loose booleans.',
 ARRAY['math-boolean','prod-acceptance-criteria','se-lifecycle','code-conditional']::text[],
 ARRAY['math-boolean']::text[],
 'math-turing-complete',
 ARRAY[
   'A model score distribution',
   'A packet route through the internet',
   'A contract between two APIs'
 ]::text[],
 'The invite flow used a ___ so an expired invite could not also be accepted.',
 'Use ''state machine'' in a sentence about allowed states and transitions.',
 'curated', 'curator', '2026-05-26'),

('math-turing-complete', 'Turing complete', null, 'systems', 'coding', 3,
 'Able to express any computation a general computer can run.',
 'Turing complete describes a system powerful enough to express general computation, given enough time and memory. Many programming languages are Turing complete. Some configuration formats intentionally are not, because unrestricted computation can make systems harder to predict, secure, or terminate.',
 'The workflow language was not Turing complete on purpose, so users could not create endless programs inside it.',
 'Turing complete is the "can this compute anything?" phrase. It helps you understand why engineers sometimes celebrate expressive power and sometimes deliberately avoid it.',
 ARRAY['code-algorithm','math-state-machine','os-process','math-complexity']::text[],
 ARRAY['code-algorithm','math-state-machine']::text[],
 'math-complexity',
 ARRAY[
   'A probability score close to one',
   'A row-level access rule in a database',
   'A named checkpoint for release planning'
 ]::text[],
 'The workflow language was not ___ on purpose, so users could not create endless programs inside it.',
 'Use ''Turing complete'' in a sentence about general computation power.',
 'curated', 'curator', '2026-05-26')

on conflict (id) do nothing;

update terms
set pronunciation = 'big oh'
where id = 'math-big-o';
