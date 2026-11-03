// Analogy bank: one comparison per term and learner field, written to be read
// word for word inside a personalized lesson (Kevin's ruling, 2026-11-03: at
// least one analogy, metaphor, simile or comparison per lesson page, or the
// personalized lesson is not offered).
//
// An entry counts only when a person has vetted it: status 'vetted' with
// vettedBy and vettedAt filled in. Every entry below is a draft written by
// Claude, so until someone reviews them no personalized lesson is offered,
// and the learner sees the canonical lesson with the reason.
//
// Drafts are written as obvious comparisons built from everyday objects in the
// field (a printed sheet, a hall pass), not as claims about how a workplace
// runs. None uses a restriction word (only, never, cannot), which the claim
// gate would hold. A test checks the form of every entry.
//
// To vet an entry: read it, fix it if needed, set status to 'vetted' and fill
// in vettedBy and vettedAt. Review at most about 20 at a time.

import type { LearnerFieldId } from './learner-fields.ts';

export interface AnalogyEntry {
  termId: string;
  field: LearnerFieldId;
  /** The full sentence, used verbatim in the lesson. */
  comparison: string;
  status: 'draft' | 'vetted';
  draftedBy: string;
  vettedBy?: string;
  vettedAt?: string;
}

const DRAFT = 'Claude (Opus 5.5), 2026-11-03';

export const ANALOGY_BANK: readonly AnalogyEntry[] = [
  // bi-rls
  { termId: 'bi-rls', field: 'nurse', comparison: 'RLS is like cutting one printed assignment sheet into strips, so each nurse holds the strip with their own patients.', status: 'draft', draftedBy: DRAFT },
  { termId: 'bi-rls', field: 'pharmacist', comparison: 'RLS is like printing one fill report and handing each store the pages for its own prescriptions.', status: 'draft', draftedBy: DRAFT },
  { termId: 'bi-rls', field: 'pharmacy_technician', comparison: 'RLS is like giving each workstation a copy of the same fill list, folded so it shows that workstation’s prescriptions.', status: 'draft', draftedBy: DRAFT },
  { termId: 'bi-rls', field: 'teacher', comparison: 'RLS is like printing one gradebook and handing each teacher the pages for their own classes.', status: 'draft', draftedBy: DRAFT },
  // sys-jwt
  { termId: 'sys-jwt', field: 'nurse', comparison: 'A JWT is like a signed order: anyone can read it, and the signature tells you who wrote it.', status: 'draft', draftedBy: DRAFT },
  { termId: 'sys-jwt', field: 'pharmacist', comparison: 'A JWT is like a signed prescription: anyone can read it, and the signature tells you who issued it.', status: 'draft', draftedBy: DRAFT },
  { termId: 'sys-jwt', field: 'pharmacy_technician', comparison: 'A JWT is like a signed prescription that reaches your station: you can read it, and the signature tells you who issued it.', status: 'draft', draftedBy: DRAFT },
  { termId: 'sys-jwt', field: 'teacher', comparison: 'A JWT is like a signed hall pass: anyone can read it, and the signature tells you which teacher issued it.', status: 'draft', draftedBy: DRAFT },
  // cloud-environment
  { termId: 'cloud-environment', field: 'nurse', comparison: 'Environments are like the skills lab and the real unit: you practice on a mannequin in the lab before you care for real patients.', status: 'draft', draftedBy: DRAFT },
  { termId: 'cloud-environment', field: 'pharmacist', comparison: 'Environments are like a training pharmacy and a live one: you practice the workflow with test prescriptions before you fill real ones.', status: 'draft', draftedBy: DRAFT },
  { termId: 'cloud-environment', field: 'pharmacy_technician', comparison: 'Environments are like a practice station and the live counter: you learn the steps with test prescriptions before you fill real ones.', status: 'draft', draftedBy: DRAFT },
  { termId: 'cloud-environment', field: 'teacher', comparison: 'Environments are like a rehearsal and the real class: you try the lesson with colleagues before you teach it to students.', status: 'draft', draftedBy: DRAFT },
  // sec-mfa
  { termId: 'sec-mfa', field: 'nurse', comparison: 'MFA is like checking two patient identifiers instead of one: two different checks make a mix-up less likely.', status: 'draft', draftedBy: DRAFT },
  { termId: 'sec-mfa', field: 'pharmacist', comparison: 'MFA is like confirming two patient identifiers at pickup: two different checks make a mix-up less likely than one.', status: 'draft', draftedBy: DRAFT },
  { termId: 'sec-mfa', field: 'pharmacy_technician', comparison: 'MFA is like confirming two patient identifiers at the counter: two different checks catch more mix-ups than one.', status: 'draft', draftedBy: DRAFT },
  { termId: 'sec-mfa', field: 'teacher', comparison: 'MFA is like a field trip form that needs both a parent signature and a phone call: two different proofs instead of one.', status: 'draft', draftedBy: DRAFT },
  // data-join
  { termId: 'data-join', field: 'nurse', comparison: 'A join is like matching a list of lab results to a list of patients by record number, so each result lands next to the right patient.', status: 'draft', draftedBy: DRAFT },
  { termId: 'data-join', field: 'pharmacist', comparison: 'A join is like matching a fill log to a patient list by patient number, so each fill sits next to the right patient.', status: 'draft', draftedBy: DRAFT },
  { termId: 'data-join', field: 'pharmacy_technician', comparison: 'A join is like matching a stack of labels to a bag list by prescription number, so each label lands with the right bag.', status: 'draft', draftedBy: DRAFT },
  { termId: 'data-join', field: 'teacher', comparison: 'A join is like matching an attendance list to a grade list by student number, so each grade sits next to the right student.', status: 'draft', draftedBy: DRAFT },
];

/** The vetted comparison for a term and field, or null. Drafts never count. */
export function vettedAnalogyFor(
  termId: string,
  field: LearnerFieldId | null,
  bank: readonly AnalogyEntry[] = ANALOGY_BANK,
): AnalogyEntry | null {
  if (!field) return null;
  return (
    bank.find(
      (e) =>
        e.termId === termId &&
        e.field === field &&
        e.status === 'vetted' &&
        typeof e.vettedBy === 'string' &&
        e.vettedBy.trim().length > 0 &&
        typeof e.vettedAt === 'string' &&
        /^\d{4}-\d{2}-\d{2}/.test(e.vettedAt),
    ) ?? null
  );
}
