// The app bar (Kevin, 2026-11-03): search and feedback live in a bar at the
// top of the page at every size, never in buttons floating over the content.
//
// The splash, welcome and public atlas screens show no bar. Onboarding and the
// gift screens keep their own centered wordmark, so the bar there shows only
// the two buttons.
const NO_BAR = [/^\/$/, /^\/welcome\/?$/, /^\/atlas\/?$/];
const OWN_WORDMARK = [/^\/onboarding(\/|$)/, /^\/gift(\/|$)/];

export function showsAppBar(pathname: string): boolean {
  return !NO_BAR.some((pattern) => pattern.test(pathname));
}

export function appBarShowsWordmark(pathname: string): boolean {
  return !OWN_WORDMARK.some((pattern) => pattern.test(pathname));
}
