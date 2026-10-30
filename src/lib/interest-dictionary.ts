// 500-term curated interest dictionary for jargon's profile capture.
// Used by the wizard interests step + Settings ProfileForm. NOT a hard
// allowlist — users can still add any free-form interest by hitting
// enter on text not in the dictionary. The dictionary just powers the
// autocomplete suggestions.
//
// Organized by category for maintainability. Categories aren't surfaced
// to the user — search results don't filter by category.
//
// Casing: dictionary entries carry their canonical case (proper nouns
// like NFL, K-pop, Premier League stay capitalized; common nouns like
// cooking, hiking, knitting stay lowercase). The autocomplete preserves
// dictionary case on tap. Free-form additions preserve whatever the
// user typed. Dedupe in the wizard / form is case-insensitive.
//
// Ordering: alphabetical, case-insensitive — search results are filtered
// from this in O(n), then ranked startsWith-first then includes-second.
// At ~500 entries, no need for a trie / fuzzy matcher yet.

const RAW_INTERESTS: readonly string[] = [
  // ── Sports (~80) ──────────────────────────────────────────────────────
  'fitness', 'football', 'NFL', 'college football', 'NBA', 'college basketball', 'WNBA',
  'MLB', 'college baseball', 'NHL', 'soccer', 'Premier League',
  'La Liga', 'Bundesliga', 'Serie A', 'MLS', 'Champions League',
  'World Cup', 'international soccer', 'F1', 'NASCAR', 'IndyCar',
  'MotoGP', 'rally racing', 'drag racing', 'karting', 'MMA',
  'UFC', 'boxing', 'pro wrestling', 'jiu-jitsu', 'karate',
  'taekwondo', 'judo', 'fencing', 'archery', 'shooting sports',
  'golf', 'PGA Tour', 'LPGA', 'tennis', 'pickleball',
  'table tennis', 'badminton', 'squash', 'racquetball', 'volleyball',
  'beach volleyball', 'lacrosse', 'rugby', 'cricket', 'gymnastics',
  'figure skating', 'speed skating', 'swimming', 'diving', 'water polo',
  'rowing', 'sailing', 'surfing', 'kitesurfing', 'windsurfing',
  'wakeboarding', 'paddleboarding', 'kayaking', 'canoeing', 'whitewater rafting',
  'skiing', 'snowboarding', 'cross-country skiing', 'skateboarding', 'BMX',
  'rock climbing', 'bouldering', 'cycling', 'mountain biking',
  'gravel cycling', 'road cycling', 'running', 'trail running', 'marathon running',
  'ultramarathon', 'triathlon', 'Ironman', 'CrossFit', 'powerlifting',
  'Olympic weightlifting', 'bodybuilding', 'yoga', 'pilates', 'barre',
  'spin', 'rowing machine', 'hyrox', 'orienteering', 'parkour',
  'fishing', 'fly fishing', 'bass fishing', 'deep sea fishing', 'ice fishing',
  'hunting', 'bow hunting', 'duck hunting', 'fantasy football', 'sports betting',
  // ── Food & cooking (~50) ──────────────────────────────────────────────
  'food', 'cooking', 'baking', 'sourdough', 'bread-making', 'pasta-making',
  'pizza-making', 'BBQ', 'grilling', 'smoking meat', 'cast iron cooking',
  'sous vide', 'meal prep', 'cake decorating', 'pastry', 'chocolate making',
  'cheese-making', 'fermentation', 'pickling', 'canning', 'preserving',
  'brewing beer', 'home brewing', 'winemaking', 'wine tasting', 'whiskey',
  'bourbon', 'scotch', 'tequila', 'mezcal', 'rum',
  'mixology', 'cocktails', 'craft beer', 'natural wine', 'sake',
  'espresso', 'coffee', 'pour-over coffee', 'specialty coffee', 'tea',
  'matcha', 'Italian cuisine', 'Mexican cuisine', 'Thai cuisine', 'Vietnamese cuisine',
  'Indian cuisine', 'Chinese cuisine', 'Japanese cuisine', 'Korean cuisine', 'Mediterranean cuisine',
  'Cajun cuisine', 'Southern cooking', 'soul food', 'Ethiopian cuisine', 'Middle Eastern cuisine',
  'French cuisine', 'Caribbean cuisine', 'Filipino cuisine', 'farm-to-table', 'foraging',
  'plant-based eating', 'vegan cooking', 'vegetarian cooking', 'keto', 'paleo',
  // ── Music (~40) ───────────────────────────────────────────────────────
  'rock', 'classic rock', 'indie rock', 'alternative rock', 'punk',
  'metal', 'heavy metal', 'jazz', 'classical music', 'opera',
  'hip-hop', 'rap', 'R&B', 'soul', 'blues',
  'country', 'bluegrass', 'folk', 'Americana', 'pop',
  'EDM', 'house music', 'techno', 'drum and bass', 'dubstep',
  'K-pop', 'J-pop', 'Latin music', 'reggaeton', 'salsa',
  'reggae', 'ska', 'guitar', 'electric guitar', 'acoustic guitar',
  'piano', 'violin', 'cello', 'drums', 'bass guitar',
  'ukulele', 'banjo', 'mandolin', 'harmonica', 'saxophone',
  'singing', 'songwriting', 'producing music', 'DJing', 'turntablism',
  'choir', 'a cappella', 'marching band', 'orchestra', 'vinyl collecting',
  // ── Movies & TV (~30) ─────────────────────────────────────────────────
  'movies', 'film', 'TV', 'streaming TV', 'sci-fi',
  'fantasy', 'horror', 'comedy', 'drama', 'action movies',
  'thriller', 'documentary', 'true crime', 'period drama', 'Westerns',
  'film noir', 'foreign films', 'indie film', 'silent films', 'animation',
  'anime', 'K-drama', 'Marvel', 'DC', 'Star Wars',
  'Star Trek', 'Lord of the Rings', 'Harry Potter', 'A24', 'Criterion Collection',
  'reality TV', 'sitcoms', 'late night TV', 'sketch comedy',
  // ── Gaming (~30) ──────────────────────────────────────────────────────
  'gaming', 'Nintendo', 'PlayStation', 'Xbox', 'PC gaming',
  'Steam', 'MMO', 'World of Warcraft', 'Final Fantasy', 'FPS games',
  'Call of Duty', 'Counter-Strike', 'Valorant', 'Apex Legends', 'RPGs',
  'JRPGs', 'indie games', 'retro gaming', 'arcade games', 'speedrunning',
  'Zelda', 'Mario', 'Pokémon', 'Minecraft', 'Roblox',
  'Fortnite', 'Animal Crossing', 'Dark Souls', 'Elden Ring', 'Stardew Valley',
  'board games', 'tabletop games', 'Magic the Gathering', 'D&D', 'Warhammer',
  'chess', 'poker', 'Texas hold em', 'puzzle games', 'esports',
  // ── Outdoors (~25) ────────────────────────────────────────────────────
  'hiking', 'backpacking', 'thru-hiking', 'camping', 'car camping',
  'glamping', 'RV life', 'vanlife', 'overlanding', 'national parks',
  'state parks', 'road trips', 'mountaineering', 'scuba diving', 'snorkeling',
  'free diving', 'birdwatching', 'stargazing', 'astrophotography', 'caving',
  'canyoneering', 'foraging mushrooms', 'wild edibles', 'survival skills', 'bushcraft',
  // ── Hobbies & crafts (~40) ────────────────────────────────────────────
  'woodworking', 'metalworking', 'blacksmithing', 'leatherworking', 'knife-making',
  'knitting', 'crocheting', 'sewing', 'embroidery', 'cross-stitch',
  'quilting', 'macrame', 'weaving', 'painting', 'oil painting',
  'acrylic painting', 'watercolor', 'drawing', 'sketching', 'inking',
  'comics', 'graphic novels', 'ceramics', 'pottery', 'sculpture',
  'glass blowing', 'stained glass', 'jewelry making', 'soap making', 'candle making',
  'calligraphy', 'hand lettering', 'photography', 'film photography', 'street photography',
  'portrait photography', 'landscape photography', 'videography', 'filmmaking', 'drone flying',
  'gardening', 'vegetable gardening', 'flower gardening', 'houseplants', 'succulents',
  'bonsai', 'orchids', 'beekeeping', 'urban farming', 'composting',
  // ── Tech (~30) ────────────────────────────────────────────────────────
  'programming', 'coding', 'web development', 'frontend development', 'backend development',
  'mobile development', 'iOS development', 'Android development', 'AI', 'machine learning',
  'data science', 'cybersecurity', 'ethical hacking', 'sysadmin', 'DevOps',
  'cloud computing', 'blockchain', 'crypto', 'NFTs', 'IoT',
  'hardware hacking', 'robotics', '3D printing', 'electronics', 'Arduino',
  'Raspberry Pi', 'retrocomputing', 'mechanical keyboards', 'custom PC builds', 'home networking',
  'smart home', 'home automation', 'ham radio', 'open source', 'self-hosting',
  // ── Finance (~15) ─────────────────────────────────────────────────────
  'investing', 'stocks', 'options trading', 'real estate investing', 'rental properties',
  'retirement planning', 'FIRE movement', 'budgeting', 'frugal living', 'side hustles',
  'entrepreneurship', 'startups', 'personal finance', 'financial independence', 'index funds',
  // ── Cars / vehicles (~25) ─────────────────────────────────────────────
  'cars', 'classic cars', 'muscle cars', 'JDM cars', 'sports cars',
  'supercars', 'EVs', 'Tesla', 'hot rods', 'car restoration',
  'auto detailing', 'track days', 'autocross', 'motorcycles', 'sport bikes',
  'cruisers', 'dual-sport motorcycles', 'adventure motorcycles', 'cafe racers', 'trucks',
  'pickup trucks', 'off-roading', 'Jeep', 'overland builds', 'ATVs',
  // ── Pets & animals (~15) ──────────────────────────────────────────────
  'dogs', 'puppies', 'cats', 'kittens', 'birds',
  'parrots', 'fish', 'aquariums', 'reef tanks', 'aquascaping',
  'reptiles', 'snakes', 'lizards', 'exotic pets', 'horses',
  // ── Travel (~20) ──────────────────────────────────────────────────────
  'travel', 'international travel', 'domestic travel', 'backpacking through Europe', 'cruises',
  'all-inclusive resorts', 'food tourism', 'eco-tourism', 'Europe', 'Asia',
  'Southeast Asia', 'Japan travel', 'South America', 'Africa', 'Caribbean',
  'Pacific Northwest', 'Southwest US', 'national park road trips', 'budget travel', 'luxury travel',
  // ── History / culture (~25) ───────────────────────────────────────────
  'history', 'ancient history', 'medieval history', 'military history', 'naval history',
  'American history', 'European history', 'world history', 'archaeology', 'anthropology',
  'mythology', 'Greek mythology', 'Norse mythology', 'Egyptian mythology', 'philosophy',
  'geography', 'cartography', 'maps', 'genealogy', 'antiques',
  'collectibles', 'stamp collecting', 'coin collecting', 'vintage', 'mid-century modern',
  // ── Family (~10) ──────────────────────────────────────────────────────
  'parenting', 'grandparenting', 'homeschooling', 'kids sports', 'family game nights',
  'multigenerational living', 'adoption', 'fostering', 'special needs parenting', 'family travel',
  // ── Faith & spirituality (~10) ────────────────────────────────────────
  'meditation', 'mindfulness', 'Christianity', 'Catholicism', 'Judaism',
  'Islam', 'Buddhism', 'Hinduism', 'atheism', 'contemplative practice',
  // ── Politics / news / podcasts (~15) ──────────────────────────────────
  'politics', 'US politics', 'global politics', 'current events', 'journalism',
  'foreign affairs', 'NPR', 'Pod Save America', 'The Daily', 'Joe Rogan',
  'Lex Fridman', 'Tim Ferriss', 'Hard Fork', 'Substack', 'newsletters',
  // ── Science (~15) ─────────────────────────────────────────────────────
  'astronomy', 'space exploration', 'biology', 'chemistry', 'physics',
  'geology', 'ecology', 'oceanography', 'paleontology', 'neuroscience',
  'evolutionary biology', 'climate science', 'quantum physics', 'genetics', 'microbiology',
  // ── Arts & performance (~15) ──────────────────────────────────────────
  'visual art', 'theater', 'musical theater', 'standup comedy', 'improv',
  'dance', 'ballet', 'jazz dance', 'tap dance', 'ballroom dance',
  'swing dance', 'salsa dancing', 'classical concerts', 'museum-going', 'gallery hopping',
  // ── Books & reading (~15) ─────────────────────────────────────────────
  'reading', 'fiction', 'sci-fi novels', 'fantasy novels', 'mystery novels',
  'thrillers', 'romance novels', 'literary fiction', 'historical fiction', 'memoirs',
  'biographies', 'self-help books', 'business books', 'poetry', 'audiobooks',
];

// Sort alphabetically (case-insensitive). Stable sort across runtimes.
export const INTEREST_DICTIONARY: readonly string[] = [...RAW_INTERESTS].sort(
  (a, b) => a.toLowerCase().localeCompare(b.toLowerCase()),
);

/**
 * Search the dictionary for autocomplete suggestions.
 *
 * Ranking: startsWith matches first, then includes matches. Case-insensitive
 * compare, but the original (cased) dictionary entry is what gets returned.
 * Results capped at `limit` (default 10) — the dropdown shouldn't blow past
 * a tap-friendly height at 390×844.
 *
 * Optional `excludeLower` skips entries that are already in the user's
 * picked list (compare on lowercased value), so the dropdown doesn't surface
 * duplicates.
 */
export function searchInterests(
  query: string,
  opts?: { excludeLower?: ReadonlySet<string>; limit?: number },
): string[] {
  if (typeof query !== 'string') return [];
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const limit = opts?.limit ?? 10;
  const safeLimit = typeof limit !== 'number' || isNaN(limit) || limit < 0 ? 10 : Math.floor(limit);
  const exclude = opts?.excludeLower;
  const hasExclude = exclude && typeof exclude.has === 'function';
  const startsWith: string[] = [];
  const includes: string[] = [];
  for (const entry of INTEREST_DICTIONARY) {
    const lower = entry.toLowerCase();
    if (hasExclude && exclude.has(lower)) continue;
    if (lower.startsWith(q)) {
      startsWith.push(entry);
    } else if (lower.includes(q)) {
      includes.push(entry);
    }
    if (startsWith.length >= safeLimit) break;
  }
  return [...startsWith, ...includes].slice(0, safeLimit);
}
