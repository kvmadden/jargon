// Shared "lived icons" allowlist for the gift-compose Edge Function.
//
// What this is:
//   A tight, hand-curated set of Phosphor icon slugs (set: 'ph') that Opus
//   may pick from when drafting a recipient's "lived icons" strip — the 1-3
//   icons that visually represent their world. Anything outside this list
//   is dropped server-side. Keeps the strip visually cohesive (one icon
//   family, one weight) and prevents Opus from inventing slugs that 404 at
//   render time.
//
// Why a curated list:
//   1) Brand cohesion — the home header + gift-accept splash render these as
//      `<DomainIcon set="ph">` style chips. Mixing icon families would shred
//      the look.
//   2) Render safety — Phosphor's catalog has ~9,000 icons. Half of them
//      don't exist in the `regular` weight or have unusual slug formats.
//      The allowlist guarantees every pick will resolve.
//   3) Opus latency — giving Opus the finite list as inline JSON keeps the
//      Pass 1 prompt short and the response token-cheap.
//
// Themes covered:
//   The list is grouped (visually only — Opus sees the flat union) by the
//   profile axes that drive personalization: work, family + relationships,
//   place + heritage, hobbies + sports, food, faith, and "other vibes."
//   Each slug verified against https://phosphoricons.com/ at the
//   `regular` weight (no -fill / -duotone / -bold suffixes — those would
//   mix weights into the strip).
//
// Editing this list:
//   - Add or remove slugs freely; the validator filters Opus's output
//     against this set, so a missing slug just means Opus can't pick it.
//   - DO NOT add suffixed variants (-bold, -fill, -duotone, etc.). The
//     home renderer always uses ph-regular for visual consistency.
//   - When adding, verify the slug at https://phosphoricons.com/?q=<slug>
//     before shipping; misspellings cause silent render failures.

export const LIVED_ICONS_ALLOWLIST: readonly string[] = [
  // ─── work / careers ────────────────────────────────────────
  'briefcase',
  'stethoscope',
  'syringe',
  'pill',
  'first-aid',
  'microscope',
  'flask',
  'test-tube',
  'gavel',
  'scales',
  'chalkboard',
  'student',
  'graduation-cap',
  'pencil-line',
  'paint-brush',
  'palette',
  'camera',
  'film-slate',
  'hammer',
  'wrench',
  'screwdriver',
  'truck',
  'tractor',
  'tree',                 // arborist, forestry, ecology
  'leaf',                 // biologist, gardener
  'plant',
  'sun',                  // outdoor work
  'desktop',              // office worker
  'code',                 // engineer
  'terminal-window',
  'shopping-cart',        // retail
  'cash-register',
  'storefront',
  'chef-hat',             // chef, cooking
  'cooking-pot',
  'oven',
  'coins',
  'bank',
  'credit-card',
  'trend-up',
  'trend-down',
  'target',
  'cardholder',
  'envelope',
  'files',
  'notebook',
  'handshake',
  'cpu',
  'database',
  'robot',
  'wifi-high',
  'gear',
  'atom',
  'feather',
  'pen',
  'book',
  'speaker-high',
  'microphone',
  'scissors',
  'coat-hanger',
  'bell',
  'broom',
  'package',
  'ruler',
  'plugs',
  'magnet',
  'shield',
  'shield-check',
  'siren',
  'detective',
  'heartbeat',
  'heart-straight',
  'brain',

  // ─── family / roles ────────────────────────────────────────
  'baby',
  'baby-carriage',
  'users-three',          // family
  'users-four',
  'house',                // home / parent
  'house-line',
  'heart',
  'hands-praying',        // faith / care
  'dog',
  'cat',                  // pet owner
  'fish',
  'rabbit',
  'horse',
  'cow',
  'bug',
  'paw-print',

  // ─── place / heritage / travel ─────────────────────────────
  'globe',
  'compass',
  'map-pin',
  'airplane',
  'airplane-tilt',
  'mountains',
  'island',
  'city',                 // urban
  'farm',                 // rural
  'lighthouse',           // coastal
  'sailboat',
  'tree-palm',
  'tree-evergreen',
  'cactus',
  'snowflake',
  'waves',
  'rainbow',
  'umbrella',
  'map-trifold',
  'train',
  'bus',
  'car',
  'ticket',
  'suitcase',

  // ─── hobbies / sports / interests ──────────────────────────
  'football',             // (american)
  'soccer-ball',
  'basketball',
  'baseball',
  'tennis-ball',
  'golf',
  'volleyball',
  'bicycle',
  'person-simple-bike',
  'person-simple-run',
  'person-simple-walk',
  'person-simple-hike',
  'person-simple-ski',
  'person-simple-swim',
  'person-simple-throw',
  'barbell',              // gym / fitness
  'guitar',
  'piano-keys',
  'music-notes',
  'headphones',
  'microphone-stage',
  'vinyl-record',
  'book-open',            // reader
  'books',                // collector / scholar
  'newspaper',
  'binoculars',           // birding / observation
  'butterfly',
  'bird',
  'campfire',
  'tent',
  'puzzle-piece',         // puzzles / problem-solving
  'game-controller',      // gamer
  'television',           // tv / film
  'film-reel',
  'martini',              // drinks / nightlife
  'beer-stein',
  'coffee',               // coffee culture
  'tea-bag',
  'dice-five',
  'cards',
  'poker-chip',
  'cassette-tape',
  'magic-wand',
  'armchair',
  'bed',
  'key',
  'couch',

  // ─── food / cuisine ────────────────────────────────────────
  'bowl-food',
  'bread',
  'pizza',
  'hamburger',
  'cake',
  'ice-cream',
  'cookie',
  'apple-logo',           // apple device + apple fruit
  'orange',
  'pepper',
  'carrot',
  'avocado',
  'cherries',
  'coffee-bean',
  'egg',
  'bowl-steam',
  'cheese',
  'popcorn',
  'brandy',

  // ─── faith / philosophy ─────────────────────────────────────
  'cross',
  'star-of-david',
  'yin-yang',
  'flower-lotus',         // mindfulness / yoga
  'star',                 // wonder / aspiration

  // ─── other vibes / mood ─────────────────────────────────────
  'wine',
  'rocket-launch',        // ambitious / startup
  'lightning',            // energy
  'fire',                 // passion
  'wind',
  'cloud',
  'cloud-sun',
  'hand-waving',          // greeting
  'sparkle',              // delight
  'gift',
  'crown',                // royalty / leadership
  'medal',                // achievement
  'trophy',
  'moon-stars',
  'sun-dim',
  'peace',
  'smiley',
  'skull',
  'alien',
  'ghost',
  'anchor',
  'balloon',
] as const;

const ALLOWED = new Set<string>(LIVED_ICONS_ALLOWLIST);

/**
 * Filter an arbitrary string array down to slugs in the allowlist.
 * Dedupe (preserving first occurrence) and cap at `max` items. Used by
 * the compose-gift-profile Edge Function to validate Opus's pick before
 * persisting.
 *
 * Aliased as `sanitizeLivedIcons` because that's the name the shared
 * `profile-shape.ts` module imports it under (#5's lived-icons feature
 * settled on that naming convention).
 */
export function sanitizeLivedIcons(picks: unknown, max = 3): string[] {
  if (!Array.isArray(picks)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of picks) {
    if (typeof raw !== 'string') continue;
    const slug = raw.trim().toLowerCase();
    if (!ALLOWED.has(slug)) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length >= max) break;
  }
  return out;
}

/** Back-compat alias matching the original name in this module. */
export const validateLivedIcons = sanitizeLivedIcons;
