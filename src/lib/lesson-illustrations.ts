// Small diagrams for lessons where a picture helps (Kevin's ruling,
// 2026-11-03). Each is drawn in code by ConceptIllustration from the steps
// below: boxes and arrows, never a generated image. A term without an entry
// gets no illustration.

export interface LessonIllustration {
  /** 'flow': steps left to right. 'filter': one source narrowed to what each viewer sees. */
  kind: 'flow' | 'filter';
  /** Short labels in sentence case, 2 to 4 of them, 20 characters or fewer. */
  steps: string[];
  /** Read by screen readers instead of the drawing. */
  description: string;
}

export const LESSON_ILLUSTRATIONS: Readonly<Record<string, LessonIllustration>> = {
  'bi-rls': {
    kind: 'filter',
    steps: ['One report', 'Rules per viewer', 'Each sees their rows'],
    description: 'One report goes through rules for each viewer, so each viewer sees their own rows.',
  },
  'cloud-environment': {
    kind: 'flow',
    steps: ['Local', 'Preview', 'Staging', 'Production'],
    description: 'Code moves from local to preview to staging to production.',
  },
  'cloud-deploy': {
    kind: 'flow',
    steps: ['Code', 'Build', 'Deploy', 'Running app'],
    description: 'Code is built, then deployed, and then it runs.',
  },
  'sys-jwt': {
    kind: 'flow',
    steps: ['Sign in', 'Token signed', 'Token sent', 'Signature checked'],
    description: 'After sign in, the server signs a token. The app sends it with each request, and the server checks the signature.',
  },
  'sec-mfa': {
    kind: 'flow',
    steps: ['Password', 'Second proof', 'Access'],
    description: 'A password and a second, different proof are both needed before access.',
  },
  'data-join': {
    kind: 'flow',
    steps: ['Table A', 'Matching key', 'Table B', 'Combined rows'],
    description: 'Rows from two tables are matched on a shared key and combined.',
  },
  'sec-oauth': {
    kind: 'flow',
    steps: ['App', 'Sign-in provider', 'Token to app'],
    description: 'The app sends you to a sign-in provider, which sends a token back to the app. The app never sees your password.',
  },
};

export function illustrationFor(termId: string | null | undefined): LessonIllustration | null {
  return termId ? LESSON_ILLUSTRATIONS[termId] ?? null : null;
}
