// The learner fields jargon personalizes for (Kevin's ruling, 2026-11-03).
// A personalized lesson is offered only for these fields, and only for a term
// that has a vetted comparison in the analogy bank for the field. The same
// file lives at src/lib/learner-fields.ts and
// supabase/functions/_shared/learner-fields.ts, and a test keeps the two
// byte-identical. Pure functions only, no imports.

export type LearnerFieldId = 'nurse' | 'pharmacist' | 'pharmacy_technician' | 'teacher';

export interface LearnerField {
  id: LearnerFieldId;
  /** Shown in the UI, in sentence case. */
  label: string;
  /** Matched against the profile, most specific field first. */
  patterns: RegExp[];
}

// Order matters: "pharmacy technician" is checked before "pharmacist".
export const SUPPORTED_FIELDS: readonly LearnerField[] = [
  {
    id: 'pharmacy_technician',
    label: 'Pharmacy technician',
    patterns: [/\bpharmacy (?:tech|techs|technician|technicians)\b/i, /\bcpht\b/i, /\brx tech\b/i],
  },
  { id: 'pharmacist', label: 'Pharmacist', patterns: [/\bpharmacists?\b/i, /\bpharm\.?d\b/i] },
  { id: 'nurse', label: 'Nurse', patterns: [/\bnurses?\b/i, /\bnursing\b/i, /\b(?:rn|lpn|lvn|bsn)\b/i] },
  { id: 'teacher', label: 'Teacher', patterns: [/\bteachers?\b/i, /\bteaching\b/i, /\beducators?\b/i] },
];

export interface FieldProfile {
  job?: string | null;
  roles?: string[] | null;
  background_text?: string | null;
}

function match(text: string): LearnerFieldId | null {
  for (const f of SUPPORTED_FIELDS) if (f.patterns.some((p) => p.test(text))) return f.id;
  return null;
}

/**
 * The learner's field, read from the job first, then roles and background.
 * A pharmacist whose role is "trains new pharmacy technicians" is a pharmacist,
 * because the job decides before the roles are read.
 */
export function learnerFieldFor(profile: FieldProfile | null | undefined): LearnerFieldId | null {
  if (!profile) return null;
  return match(profile.job ?? '') ?? match([...(profile.roles ?? []), profile.background_text ?? ''].join(' '));
}

/** The label for a field id, or null. */
export function learnerFieldLabel(id: string | null | undefined): string | null {
  return SUPPORTED_FIELDS.find((f) => f.id === id)?.label ?? null;
}
