// Stage B+1.11 — lived-icons allowlist (curated Phosphor icon set).
//
// "Lived icons" is a strip of 1-3 Phosphor flat-art icons that visually
// represent a user's world. Auto-picked by Opus 4.7 from the user's profile
// (job, interests, heritage, roles, freeform background, relationship) and
// rendered next to the wordmark in the home header + at the top of the
// gift-accept preview card.
//
// WHY A HAND-CURATED ALLOWLIST:
//   Iconify's Phosphor catalog has ~9000 icons. Letting Opus pick freely
//   gives us inconsistent line weights, half-empty visual themes, and the
//   occasional unflattering metaphor. A curated allowlist:
//     - Keeps the strip visually cohesive (one icon family, one weight)
//     - Caps the model's degrees of freedom so renders stay flat-art
//     - Lets us audit + own every icon that ships in the UI
//     - Server-side validation rejects any pick outside this set, so the
//       allowlist is also the enforcement boundary — no need to trust the
//       LLM's discipline
//
// MIRROR OF THE DENO SIDE:
//   `supabase/functions/_shared/lived-icons-allowlist.ts` is the
//   server-side mirror. Both files MUST stay byte-identical for the
//   `LIVED_ICONS_ALLOWLIST` slug list. When you add or remove a slug
//   here, mirror the change there. There is no pre-deploy gate enforcing
//   parity yet — at single-user scale we eat the manual sync; if more
//   than 2 of these updates ship in a row, lift one into pre-deploy.mjs
//   (count + literal-string match between the two files).
//
// SLUG FORMAT:
//   Phosphor `regular` weight only — the `iconUrl()` helper in
//   src/lib/domains.ts prepends `ph:` set name + the Iconify CDN host.
//   No -fill / -duotone / -bold suffixes (those would mix weights into
//   the strip).

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
  'tree',
  'leaf',
  'plant',
  'sun',
  'desktop',
  'code',
  'terminal-window',
  'shopping-cart',
  'cash-register',
  'storefront',
  'chef-hat',
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
  'users-three',
  'users-four',
  'house',
  'house-line',
  'heart',
  'hands-praying',
  'dog',
  'cat',
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
  'city',
  'farm',
  'lighthouse',
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
  'football',
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
  'barbell',
  'guitar',
  'piano-keys',
  'music-notes',
  'headphones',
  'microphone-stage',
  'vinyl-record',
  'book-open',
  'books',
  'newspaper',
  'binoculars',
  'butterfly',
  'bird',
  'campfire',
  'tent',
  'puzzle-piece',
  'game-controller',
  'television',
  'film-reel',
  'martini',
  'beer-stein',
  'coffee',
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
  'apple-logo',
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
  'flower-lotus',
  'star',

  // ─── other vibes / mood ─────────────────────────────────────
  'wine',
  'rocket-launch',
  'lightning',
  'fire',
  'wind',
  'cloud',
  'cloud-sun',
  'hand-waving',
  'sparkle',
  'gift',
  'crown',
  'medal',
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

const ALLOWED: Set<string> = new Set(LIVED_ICONS_ALLOWLIST);

/** Maximum icons in a strip. Server-side cap; client-side defense too. */
export const LIVED_ICON_MAX = 3;

/**
 * Filter an array of slugs down to the allowlist + dedupe + cap. Mirrors
 * the Deno-side `validateLivedIcons` so client + server can share a
 * single mental model. Order-preserving so Opus's ranking comes through.
 */
export function validateLivedIcons(picks: unknown, max: number = LIVED_ICON_MAX): string[] {
  if (!Array.isArray(picks)) return [];
  const safeMax = typeof max !== 'number' || isNaN(max) || max < 0 ? LIVED_ICON_MAX : Math.floor(max);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of picks) {
    if (typeof raw !== 'string') continue;
    const slug = raw.trim().toLowerCase();
    if (!ALLOWED.has(slug)) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length >= safeMax) break;
  }
  return out;
}
