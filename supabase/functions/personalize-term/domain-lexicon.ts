// Practice vocabulary for the learner's own field.
//
// The claim gate needs to know when a sentence talks about how the learner's
// workplace works. It builds that vocabulary from two sources:
//   1. the learner's profile text (job, roles, background, interests,
//      heritage), so any profession is covered at least by its own words, and
//   2. the broad field lexicons below, switched on when the profile mentions
//      one of the field's trigger words.
//
// The lexicons are general descriptions of each field. They were written on
// 2026-11-03, after the 2026-10-30 run was read, so results on that run are
// development results (see docs/verification.md).
//
// Pure module: no Deno globals, no network imports.

import { containsPhrase, contentWords, words } from './claim-text.ts';

export interface FieldLexicon {
  field: string;
  /** Any of these in the profile switches the field on. */
  triggers: string[];
  /** Single words and phrases that signal the field in a rendering. */
  terms: string[];
}

export const FIELD_LEXICONS: readonly FieldLexicon[] = [
  {
    field: 'healthcare',
    triggers: [
      'nurse', 'nursing', 'rn', 'lpn', 'hospital', 'clinic', 'clinical', 'clinician', 'physician', 'doctor',
      'pharmacist', 'pharmacy', 'pharmd', 'medical', 'patient', 'icu', 'med-surg', 'medical-surgical',
      'paramedic', 'emt', 'therapist', 'dentist', 'dental', 'caregiver', 'midwife', 'surgeon',
    ],
    // Single words that also have a common software meaning are left out on
    // purpose (see AMBIGUOUS_TECH_WORDS), so a sentence about software is not
    // mistaken for one about the clinic.
    terms: [
      'patient', 'chart', 'charting', 'ehr', 'emr', 'mar', 'ward', 'bedside', 'sbar', 'census', 'huddle', 'pump',
      'med', 'meds', 'medication', 'dose', 'dosing', 'titrate', 'prescription', 'prescriber', 'rx', 'refill',
      'dispense', 'dispensing', 'dispensed', 'vial', 'pharmacy', 'pharmacist', 'technician', 'pbm', 'adjudicate',
      'adjudication', 'formulary', 'dur', 'pdmp', 'narcotic', 'counseling', 'immunization', 'vaccine', 'clinic',
      'physician', 'nurse', 'discharge', 'diagnosis', 'allergy', 'vitals', 'infusion', 'barcode', 'bcma',
      'insurance', 'payer', 'copay', 'drug', 'compounding', 'will-call', 'drive-thru', 'prior authorization',
      'prior auth', 'controlled substance', 'c-ii', 'break-the-glass', 'break the glass', 'charge nurse',
      'code blue', 'rapid response', 'drug interaction', 'lab result', 'pharmacy tech', 'prescription transfer',
      'medication administration', 'medical record', 'patient record', 'health record', 'float nurse',
      'float pool', 'medication list', 'nursing unit',
      // Ambiguous words in phrases where they only have the field meaning.
      'pharmacy store', 'store manager', 'your store', 'their store', 'another store', 'other store',
      'each store', 'pharmacy chain', 'chain pharmacy', 'chain store', 'your unit', 'their unit', 'own unit',
      'my unit', 'our unit', 'insurance claim', 'pharmacy claim', 'claim system', 'claim rejection',
      'rejected claim', 'script label', 'prescription label', 'rx label', 'pharmacy label', 'dispensing label',
      'medication label', 'drug label', 'day shift', 'night shift', 'shift change', 'your shift',
      'pump alarm', 'alarm fatigue', 'bed alarm', 'monitor alarm', 'patient admission', 'ward admission',
      'triage nurse', 'shift handoff', 'nurse handoff', 'bedside handoff', 'medication order',
      'healthcare provider', 'care provider', 'patient transfer', 'pill count', 'narcotic count',
      'fill queue', 'verification queue', 'pharmacy queue', 'new script', 'filled script',
    ],
  },
  {
    field: 'education',
    triggers: [
      'teacher', 'teaching', 'school', 'district', 'student', 'classroom', 'principal', 'professor', 'faculty',
      'educator', 'tutor', 'curriculum', 'instructor', 'college', 'university',
    ],
    terms: [
      'student', 'gradebook', 'grade', 'grading', 'lms', 'roster', 'district', 'classroom', 'syllabus',
      'semester', 'attendance', 'iep', 'homework', 'teacher', 'school', 'superintendent', 'enrollment',
      'lesson plan', 'unit plan', 'report card', 'lab report', 'school principal', 'parent conference',
    ],
  },
  {
    field: 'finance',
    triggers: [
      'accountant', 'accounting', 'bank', 'banking', 'finance', 'financial', 'auditor', 'actuary', 'cpa',
      'bookkeeper', 'treasury', 'loan', 'underwriter', 'insurance',
    ],
    terms: [
      'ledger', 'invoice', 'receivable', 'payable', 'month-end', 'gaap', 'loan', 'underwriting', 'teller',
      'deposit', 'general ledger', 'journal entry', 'balance sheet', 'insurance claim', 'bank reconciliation',
    ],
  },
  {
    field: 'legal',
    triggers: ['lawyer', 'attorney', 'paralegal', 'legal', 'counsel', 'court', 'judge'],
    terms: ['docket', 'deposition', 'court', 'statute', 'counsel', 'subpoena', 'court filing', 'contract clause'],
  },
  {
    field: 'trades',
    triggers: [
      'plumber', 'electrician', 'carpenter', 'mechanic', 'welder', 'contractor', 'hvac', 'construction',
      'machinist', 'warehouse', 'logistics',
    ],
    terms: ['valve', 'forklift', 'shipment', 'pallet', 'warehouse', 'job site', 'work order', 'building inspection'],
  },
];

/**
 * Words that name something in a learner's field but also have an everyday
 * software meaning: a data store, JWT claims, a UI label, a unit test, a
 * parent commit, an alarm in a monitoring tool, a Kubernetes admission
 * controller, bug triage, a WHERE clause, an LLM judge. Matching them as field
 * words held correct technical sentences (review round 2). They are never
 * field words, whether they come from a lexicon or from the profile. The cost:
 * a field claim worded only with these words is not recognized as one.
 */
export const AMBIGUOUS_TECH_WORDS: ReadonlySet<string> = new Set(
  [
    'store', 'claim', 'label', 'unit', 'chain', 'parent', 'shift', 'alarm', 'admission', 'triage', 'handoff',
    'hand-off', 'clause', 'filing', 'premium', 'rubric', 'principal', 'judge', 'reconcile', 'reconciliation',
    'blueprint', 'record', 'order', 'script', 'tech', 'provider', 'transfer', 'count', 'code', 'queue',
  ].map((w) => words(w)[0] ?? w),
);

// Profile words that say little about the learner's field, or that also have a
// common software meaning, are not treated as field vocabulary.
const GENERIC_PROFILE_WORDS = new Set([
  'background', 'programming', 'comfortable', 'experience', 'includes', 'include', 'including', 'daily',
  'several', 'eight', 'eleven', 'fourteen', 'years', 'staff', 'neighborhood', 'community', 'public',
  'shift', 'hour', 'hours', 'twelve', 'month', 'months', 'graduate', 'graduates', 'trains', 'train',
  'training', 'sits', 'coaches', 'coach', 'precepts', 'report', 'reports', 'team', 'teams', 'people',
  'record', 'records', 'running', 'administration', 'electronic', 'system', 'systems', 'software', 'data',
  'network', 'access', 'server', 'program', 'process', 'service', 'services', 'health', 'charge',
  'registered', 'learning', 'management', 'technology', 'committee', 'email', 'emails', 'online', 'course',
  'courses', 'continuing', 'education', 'meeting', 'meetings', 'vendor', 'tools', 'tool', 'review',
  'verification', 'counts', 'claims', 'rejections', 'environmental', 'science', 'plans', 'writes',
  'prior', 'utilization', 'retail',
].map((w) => words(w)[0] ?? w));

/** Profile fields that describe the learner's own field (not where they meet terms, not their goals). */
export interface DomainProfile {
  job?: string | null;
  roles?: string[] | null;
  background_text?: string | null;
  interests?: string[] | null;
  heritage?: string | null;
}

export interface LearnerLexicon {
  /** Lowercased single words from the profile and the switched-on field lexicons. */
  words: Set<string>;
  /** Lowercased multi-word phrases from the switched-on field lexicons. */
  phrases: string[];
  /** Field lexicons switched on by the profile. */
  fields: string[];
}

/**
 * Build the learner's practice vocabulary. Words the canonical entry also uses
 * are kept: a new sentence can use them to make a new claim about the field.
 * The gate checks per sentence whether a sentence only restates the canonical
 * entry (claim-gate.ts).
 */
export function buildLearnerLexicon(profile: DomainProfile): LearnerLexicon {
  const workText = [profile.job ?? '', ...(profile.roles ?? []), profile.background_text ?? '', profile.heritage ?? ''].join(' ');
  const interests = (profile.interests ?? []).map((i) => i.toLowerCase().trim()).filter((i) => i.length > 0);
  const triggerWords = new Set(words([workText, ...interests].join(' ')));

  // Triggers go through the same tokenizer as the profile, so "logistics"
  // matches a profile that says "logistics".
  const fields = FIELD_LEXICONS.filter((lex) => lex.triggers.some((t) => triggerWords.has(words(t)[0] ?? t)));
  const wordSet = new Set<string>();
  const phrases: string[] = [];
  const usable = (w: string) => !AMBIGUOUS_TECH_WORDS.has(w);

  // The learner's own words for their work: specific (5+ letters) and not generic.
  for (const w of contentWords(workText)) {
    if (w.length >= 5 && !GENERIC_PROFILE_WORDS.has(w) && usable(w)) wordSet.add(w);
  }
  // Interests are matched as whole phrases ("trail running", "baking bread"),
  // and single-word interests only when they are specific (6+ letters).
  for (const interest of interests) {
    if (/\s/.test(interest)) phrases.push(interest);
    else if (interest.length >= 6) wordSet.add(words(interest)[0] ?? interest);
  }
  for (const lex of fields) {
    for (const term of lex.terms) {
      const t = term.toLowerCase();
      if (/\s/.test(t)) {
        phrases.push(t);
      } else {
        const normalized = words(t)[0] ?? t;
        if (usable(normalized)) wordSet.add(normalized);
      }
    }
  }
  return { words: wordSet, phrases, fields: fields.map((f) => f.field) };
}

/**
 * The learner-field words and phrases a sentence uses. Phrases match as whole
 * words in order, so "art history" does not match inside "smart history".
 * Hyphenated compounds are also read part by part, so "drug-interaction
 * pop-up" matches "drug" and the phrase "drug interaction".
 */
export function learnerFieldMentions(sentence: string, lexicon: LearnerLexicon): string[] {
  const found = new Set<string>();
  for (const w of words(sentence)) {
    if (lexicon.words.has(w)) found.add(w);
    if (w.includes('-')) for (const part of words(w.replace(/-/g, ' '))) if (lexicon.words.has(part)) found.add(part);
  }
  for (const p of lexicon.phrases) if (containsPhrase(sentence, p)) found.add(p);
  return [...found];
}
