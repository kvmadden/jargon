// Which screens get the desktop app bar (Kevin, 2026-11-03: on a laptop,
// search and feedback live inside the layout, not floating over the page).
//
// A few focused flows keep their own header: the splash and welcome
// screens, onboarding, sending or opening a gift, and the public atlas. They
// show no app bar, so on those screens the floating search and feedback
// buttons stay at every size. Everywhere else the app bar holds them on a
// laptop or desktop, and the floating buttons are for phones only.
const OWN_CHROME = [/^\/$/, /^\/welcome\/?$/, /^\/onboarding(\/|$)/, /^\/gift(\/|$)/, /^\/atlas\/?$/];

export function showsDesktopAppBar(pathname: string): boolean {
  return !OWN_CHROME.some((pattern) => pattern.test(pathname));
}

/** Class for a floating button: hidden on desktop only where the app bar replaces it. */
export function floatingButtonDesktopClass(pathname: string): string {
  return showsDesktopAppBar(pathname) ? 'lg:hidden' : '';
}
