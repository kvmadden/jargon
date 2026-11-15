// Analogies a named subject-matter expert reviewed and approved.
//
// The claim gate holds every analogy into a learner's own field, because this
// pipeline has no evidence about how a given hospital, pharmacy or school
// works. An analogy listed here clears that hold for its term: the gate lets a
// sentence through when it contains the approved anchor phrase.
//
// The list starts empty on purpose. Add an entry only after a reviewer in the
// learner's field has read the full analogy, and record who and when. Held
// rewrites are logged with final_status 'held-needs-review' and the gate
// findings in personalize_log.gate_result, which is the review queue.
//
// Pure module: no Deno globals, no network imports.

import type { ApprovedAnalogy } from './claim-gate.ts';

export const APPROVED_ANALOGIES: readonly ApprovedAnalogy[] = [];
