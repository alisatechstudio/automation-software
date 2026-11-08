import path from 'path';

export const TEMPLATES = {
  CANVA_BDNEWS: 'template-canva-bdnews',
  SQUARE_BREAKING: 'template-square-breaking',
  SQUARE_EDITORIAL: 'template-square-editorial',
  LANDSCAPE_STANDARD: 'template-landscape-standard',
  TRENDING_NEWS_BREAKING: 'template-trendingnews-breaking',
  TRENDING_NEWS_EDITORIAL: 'template-trendingnews-editorial',
  TRENDING_NEWS_VIRAL: 'template-trendingnews-viral',
  TRENDING_NEWS_LANDSCAPE: 'template-trendingnews-landscape',
} as const;

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  filename: string;
}

export const AVAILABLE_TEMPLATES: Record<string, TemplateDefinition> = {
  'template-trendingnews-breaking': {
    id: 'template-trendingnews-breaking',
    name: 'Trending News World - Breaking News (1080x1080)',
    description: 'High impact USA cable news broadcast style: live badge, framed photo, pristine white headline card, and trendingnews.world branding',
    width: 1080,
    height: 1080,
    filename: 'template-trendingnews-breaking.html',
  },
  'template-trendingnews-editorial': {
    id: 'template-trendingnews-editorial',
    name: 'Trending News World - US & Politics Editorial (1080x1080)',
    description: 'Authoritative dark obsidian editorial design for US Politics, White House, Congress, Economy, and Global Affairs',
    width: 1080,
    height: 1080,
    filename: 'template-trendingnews-editorial.html',
  },
  'template-trendingnews-viral': {
    id: 'template-trendingnews-viral',
    name: 'Trending News World - Viral Spotlight (1080x1080)',
    description: 'Vibrant modern social card engineered for viral explore algorithms: neon gradients, high-contrast typography, and trending hashtags',
    width: 1080,
    height: 1080,
    filename: 'template-trendingnews-viral.html',
  },
  'template-trendingnews-landscape': {
    id: 'template-trendingnews-landscape',
    name: 'Trending News World - Landscape Social Share (1200x630)',
    description: 'Standard 1.91:1 Facebook link/photo share ratio with side-by-side hero photo and auto-fit English headline',
    width: 1200,
    height: 630,
    filename: 'template-trendingnews-landscape.html',
  },
  'template-canva-bdnews': {
    id: 'template-canva-bdnews',
    name: 'BD News 24/7 Red (Canva Replica)',
    description: 'Exact replica of BD News 24/7 Canva design: framed photo, circular logo, red headline card, and ribbon',
    width: 1080,
    height: 1080,
    filename: 'template-canva-bdnews.html',
  },
  'template-square-breaking': {
    id: 'template-square-breaking',
    name: 'Square Breaking News (1080x1080)',
    description: 'High impact red header, photo overlay, bold headline auto-fit for Instagram & Facebook',
    width: 1080,
    height: 1080,
    filename: 'template-square-breaking.html',
  },
  'template-square-editorial': {
    id: 'template-square-editorial',
    name: 'Square Editorial Modern (1080x1080)',
    description: 'Clean modern dark editorial design with category badge and publication date',
    width: 1080,
    height: 1080,
    filename: 'template-square-editorial.html',
  },
  'template-landscape-standard': {
    id: 'template-landscape-standard',
    name: 'Landscape Social Share (1200x630)',
    description: 'Facebook link-preview 1.91:1 aspect ratio with side-by-side photo and auto-fit typography',
    width: 1200,
    height: 630,
    filename: 'template-landscape-standard.html',
  },
};

export interface ReelTemplateDefinition {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  aspectRatio: '1:1' | '9:16';
  badgeColor: string;
}

export const REEL_THEME_KEYS = [
  'auto-category',
  'cat-bangladesh',
  'cat-politics',
  'cat-economy',
  'cat-international',
  'cat-sports',
  'cat-technology',
  'cat-entertainment',
  'cat-opinion',
  'cat-religion',
  'cat-education',
  'cat-job',
  'cat-lifestyle',
  'cat-todays-match',
  'rolling',
  'viral-gradient',
  'studio-red',
  'breaking-bold',
  'dark-cinema',
  'vertical-916',
] as const;

export const REEL_TEMPLATES: Record<string, ReelTemplateDefinition> = {
  'auto-category': {
    id: 'auto-category',
    name: '⚡ Auto-Category (ক্যাটাগরি অনুযায়ী অটোমেটিক থিম ও সাউন্ড)',
    description: 'Smart AI Matching: Automatically detects bdnews.site category (13 categories) and applies tailored visual theme and audio profile',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#e11d48',
  },
  'cat-bangladesh': {
    id: 'cat-bangladesh',
    name: '🇧🇩 বাংলাদেশ (জাতীয় সংবাদ - গাঢ় সবুজ ও লাল)',
    description: '1080x1080 Square: Patriotic emerald & crimson theme, live badge, framed photo, bold Bengali card',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#059669',
  },
  'cat-politics': {
    id: 'cat-politics',
    name: '🏛️ রাজনীতি (পলিটিক্স - রয়্যাল বার্গান্ডি ও গোল্ড)',
    description: '1080x1080 Square: Authoritative political breaking theme, golden alert badge, heavy bass broadcast fanfare',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#b91c1c',
  },
  'cat-economy': {
    id: 'cat-economy',
    name: '📈 অর্থনীতি (ব্যবসা ও বাণিজ্য - মিডনাইট ব্লু ও টিল)',
    description: '1080x1080 Square: Financial markets & business theme, emerald green badge, modern crisp pulse audio',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#0284c7',
  },
  'cat-international': {
    id: 'cat-international',
    name: '🌐 আন্তর্জাতিক (বিশ্ব সংবাদ - সানসেট ভায়োলেট মেশ)',
    description: '1080x1080 Square: Global world affairs theme, yellow badge, expansive world broadcast reverb sound',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#7c3aed',
  },
  'cat-sports': {
    id: 'cat-sports',
    name: '⚽ খেলাধুলা (স্পোর্টস - স্যাফায়ার ও স্পোর্টস অরেঞ্জ)',
    description: '1080x1080 Square: High-octane stadium sports theme, orange badge, upbeat energetic sports fanfare',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#ea580c',
  },
  'cat-technology': {
    id: 'cat-technology',
    name: '💻 তথ্যপ্রযুক্তি (টেকনোলজি - সাইবার সায়ান ও অবসিডিয়ান)',
    description: '1080x1080 Square: Futuristic cyber innovation theme, electric cyan badge, electronic tech resonance sound',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#06b6d4',
  },
  'cat-entertainment': {
    id: 'cat-entertainment',
    name: '🎬 বিনোদন (শোবিজ - গ্ল্যামার ম্যাজেন্টা ও ভেলভেট)',
    description: '1080x1080 Square: Celebrity & cinema theme, neon fuchsia badge, lively upbeat pop showbiz shimmer sound',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#db2777',
  },
  'cat-opinion': {
    name: '✍️ মতামত (সম্পাদকীয় ও কলাম - স্লিক চারকোল)',
    id: 'cat-opinion',
    description: '1080x1080 Square: Thought-provoking editorial column theme, ochre gold badge, thoughtful orchestral sound',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#d97706',
  },
  'cat-religion': {
    id: 'cat-religion',
    name: '🕌 ধর্ম (ইসলাম ও ধর্মীয় সংবাদ - গোল্ডেন এমারেল্ড)',
    description: '1080x1080 Square: Dignified spiritual serene theme, radiant gold badge, peaceful acoustic sound',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#ca8a04',
  },
  'cat-education': {
    id: 'cat-education',
    name: '🎓 শিক্ষা (ক্যাম্পাস ও পড়াশোনা - স্কাই ব্লু ও কোবাল্ট)',
    description: '1080x1080 Square: Academic campus & students theme, cerulean badge, bright inspiring melodic audio',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#2563eb',
  },
  'cat-job': {
    id: 'cat-job',
    name: '💼 চাকরি (নিয়োগ ও ক্যারিয়ার - সাকসেস টিল ও স্টিল)',
    description: '1080x1080 Square: Career opportunities theme, mint green badge, confident forward-moving beat',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#059669',
  },
  'cat-lifestyle': {
    id: 'cat-lifestyle',
    name: '🌿 জীবনযাপন (স্বাস্থ্য ও লাইফস্টাইল - কোরাল ও রোজ)',
    description: '1080x1080 Square: Health & living theme, warm coral badge, light friendly lifestyle ambiance',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#f97316',
  },
  'cat-todays-match': {
    id: 'cat-todays-match',
    name: '🔥 আজকের খেলা / বিশেষ সংবাদ (হাই এলার্ট)',
    description: '1080x1080 Square: Pulse-pounding match day & urgent alert theme, fiery gold badge, maximum overdrive sound',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#dc2626',
  },
  'rolling': {
    id: 'rolling',
    name: '🔄 Rolling Rotation (সবগুলো ঘুরিয়ে ঘুরিয়ে)',
    description: 'Cycles dynamically through categories and visual themes automatically on every post',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#8b5cf6',
  },
  'studio-red': {
    id: 'studio-red',
    name: 'BD News 24/7 Red (Canva Replica Studio)',
    description: '1080x1080 Square: Classic Canva studio red gradient, framed photo, circular logo, white lower-third card',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#dc2626',
  },
  'breaking-bold': {
    id: 'breaking-bold',
    name: 'Breaking News TV Flash (ব্রেকিং নিউজ)',
    description: '1080x1080 Square: High urgency TV alert, animated breaking ticker, bold red & black straps with gold accent',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#eab308',
  },
  'dark-cinema': {
    id: 'dark-cinema',
    name: 'Cinematic Dark Cyber (বিবিসি / রয়টার্স স্টাইল)',
    description: '1080x1080 Square: Premium obsidian & neon cyan aesthetic, widescreen photo, glowing glassmorphic card',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#06b6d4',
  },
  'viral-gradient': {
    id: 'viral-gradient',
    name: 'Viral Social Mesh (ভাইরাল সোশ্যাল গ্র্যাডিয়েন্ট)',
    description: '1080x1080 Square: Modern sunset violet/rose mesh gradient, floating photo, high-contrast viral card',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    badgeColor: '#ec4899',
  },
  'vertical-916': {
    id: 'vertical-916',
    name: 'Vertical Fullscreen Reel (9:16 মোবাইল ফুলস্ক্রিন)',
    description: '1080x1920 Fullscreen: Native smartphone vertical reel format, massive centered photo & bottom overlay headline',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    badgeColor: '#10b981',
  },
};

/**
 * Resolves bdnews.site category names (Bangla or English slug) to the matching category theme ID
 */
export function resolveCategoryTheme(categoryName?: string): string {
  if (!categoryName) return 'cat-international';
  const c = categoryName.toLowerCase().trim();
  if (c.includes('রাজনীতি') || c.includes('politic')) return 'cat-politics';
  if (c.includes('অর্থনীতি') || c.includes('বাণিজ্য') || c.includes('econom') || c.includes('business')) return 'cat-economy';
  if (c.includes('আন্তর্জাতিক') || c.includes('বিশ্ব') || c.includes('internat') || c.includes('world')) return 'cat-international';
  if (c.includes('খেলা') || c.includes('sport')) return 'cat-sports';
  if (c.includes('তথ্যপ্রযুক্তি') || c.includes('প্রযুক্তি') || c.includes('tech')) return 'cat-technology';
  if (c.includes('বিনোদন') || c.includes('সিনেমা') || c.includes('নাটক') || c.includes('entertain')) return 'cat-entertainment';
  if (c.includes('মতামত') || c.includes('কলাম') || c.includes('opinion') || c.includes('editorial')) return 'cat-opinion';
  if (c.includes('ধর্ম') || c.includes('ইসলাম') || c.includes('relig')) return 'cat-religion';
  if (c.includes('শিক্ষা') || c.includes('ক্যাম্পাস') || c.includes('ভর্তি') || c.includes('educat')) return 'cat-education';
  if (c.includes('চাকরি') || c.includes('নিয়োগ') || c.includes('job') || c.includes('career')) return 'cat-job';
  if (c.includes('জীবনযাপন') || c.includes('স্বাস্থ্য') || c.includes('লাইফস্টাইল') || c.includes('lifestyle') || c.includes('health')) return 'cat-lifestyle';
  if (c.includes('আজকের খেলা') || c.includes('ম্যাচ') || c.includes('match') || c.includes('ব্রেকিং') || c.includes('জরুরি')) return 'cat-todays-match';
  return 'cat-bangladesh';
}

/**
 * High-performing category-specific viral hashtags for all 13 categories on bdnews.site.
 * Optimized for Facebook Reels & Instagram Explore algorithms.
 */
export const CATEGORY_VIRAL_HASHTAGS: Record<string, string[]> = {
  'cat-bangladesh': [
    '#Bangladesh',
    '#BanglaNews',
    '#Dhaka',
    '#NationalNews',
    '#বাংলাদেশ',
    '#সারাদেশ',
    '#খবর',
    '#জাতীয়সংবাদ',
    '#BDNews',
  ],
  'cat-politics': [
    '#Politics',
    '#BangladeshPolitics',
    '#PoliticalNews',
    '#রাজনীতি',
    '#জাতীয়সংবাদ',
    '#রাজনৈতিকখবর',
    '#PoliticalReels',
    '#নির্বাচন',
  ],
  'cat-economy': [
    '#Economy',
    '#BusinessNews',
    '#MarketUpdate',
    '#Finance',
    '#অর্থনীতি',
    '#বাণিজ্য',
    '#টাকা',
    '#শেয়ারবাজার',
    '#BusinessReels',
  ],
  'cat-international': [
    '#InternationalNews',
    '#WorldNews',
    '#GlobalNews',
    '#BreakingAlert',
    '#আন্তর্জাতিক',
    '#বিশ্বসংবাদ',
    '#WorldUpdate',
    '#GlobalReels',
  ],
  'cat-sports': [
    '#SportsNews',
    '#Cricket',
    '#Football',
    '#SportsReels',
    '#Tigers',
    '#খেলাধুলা',
    '#ক্রিকেট',
    '#ফুটবল',
    '#BCB',
  ],
  'cat-technology': [
    '#TechNews',
    '#Technology',
    '#Innovation',
    '#AI',
    '#TechReels',
    '#Gadgets',
    '#তথ্যপ্রযুক্তি',
    '#প্রযুক্তি',
  ],
  'cat-entertainment': [
    '#Entertainment',
    '#Dhallywood',
    '#Cinema',
    '#Showbiz',
    '#Natok',
    '#MovieNews',
    '#বিনোদন',
    '#নাটক',
  ],
  'cat-opinion': [
    '#Opinion',
    '#Editorial',
    '#Analysis',
    '#Column',
    '#মতামত',
    '#সম্পাদকীয়',
    '#কলাম',
    '#বিশ্লেষণ',
  ],
  'cat-religion': [
    '#Islamic',
    '#Islam',
    '#IslamicReels',
    '#Faith',
    '#Religion',
    '#ধর্ম',
    '#ইসলাম',
    '#দ্বীন',
    '#IslamicReminder',
  ],
  'cat-education': [
    '#Education',
    '#Campus',
    '#Admission',
    '#University',
    '#HSC',
    '#শিক্ষা',
    '#ভর্তিপরীক্ষা',
    '#ক্যাম্পাস',
    '#StudentLife',
  ],
  'cat-job': [
    '#Jobs',
    '#Career',
    '#GovtJob',
    '#Chakri',
    '#BCS',
    '#JobNews',
    '#নিয়োগ',
    '#চাকরি',
    '#ক্যারিয়ার',
  ],
  'cat-lifestyle': [
    '#Lifestyle',
    '#HealthTips',
    '#Wellness',
    '#Living',
    '#স্বাস্থ্য',
    '#জীবনযাপন',
    '#টিপস',
    '#HealthyLiving',
  ],
  'cat-todays-match': [
    '#MatchDay',
    '#LiveMatch',
    '#BreakingAlert',
    '#SportsLive',
    '#UrgentNews',
    '#আজকেরখেলা',
    '#জরুরিসংবাদ',
    '#ব্রেকিংনিউজ',
  ],
};

/**
 * Core Meta Reels viral discovery tags that feed into Facebook & Instagram Reels algorithm
 */
export const CORE_VIRAL_REEL_TAGS = [
  '#reels',
  '#fbreels',
  '#viralreels',
  '#reelsfb',
  '#trending',
  '#viral',
  '#foryou',
];

/**
 * High-authority breaking news distribution hooks
 */
export const NEWS_VIRAL_HOOK_TAGS = [
  '#BreakingNews',
  '#BanglaNews',
  '#ViralNews',
  '#Bangladesh',
  '#NewsUpdate',
  '#খবর',
];

/**
 * Dynamic entity extractor for viral trending topics
 */
export const VIRAL_HEADLINE_ENTITIES: Array<{
  patterns: (string | RegExp)[];
  tags: string[];
}> = [
  // USA & Global leaders, politicians & institutions
  {
    patterns: [/ট্রাম্প/i, /ডোনাল্ড ট্রাম্প/i, /\btrump\b/i, /\bdonald trump\b/i],
    tags: ['#Trump', '#DonaldTrump', '#USA', '#USPolitics'],
  },
  {
    patterns: [/\bvance\b/i, /\bjd vance\b/i, /ভ্যান্স/i],
    tags: ['#JDVance', '#USPolitics', '#WhiteHouse'],
  },
  {
    patterns: [/বাইডেন/i, /হোয়াইট হাউস/i, /হোয়াইট হাউস/i, /\bbiden\b/i, /\bjoe biden\b/i, /\bwhite house\b/i],
    tags: ['#JoeBiden', '#WhiteHouse', '#USA', '#USPolitics'],
  },
  {
    patterns: [/\bkamala\b/i, /\bharris\b/i, /\bkamala harris\b/i, /হ্যারিস/i],
    tags: ['#KamalaHarris', '#Democrats', '#USPolitics'],
  },
  {
    patterns: [/\bobama\b/i, /\bbarack obama\b/i, /ওবামা/i],
    tags: ['#Obama', '#BarackObama', '#USPolitics'],
  },
  {
    patterns: [/\bcongress\b/i, /\bsenate\b/i, /\bcapitol hill\b/i, /\bhouse of reps\b/i, /কংগ্রেস/i, /সিনেট/i],
    tags: ['#Congress', '#Senate', '#CapitolHill', '#USPolitics'],
  },
  {
    patterns: [/\bsupreme court\b/i, /\bscotus\b/i, /সুপ্রিম কোর্ট/i],
    tags: ['#SupremeCourt', '#SCOTUS', '#LegalNews'],
  },
  {
    patterns: [/\bfbi\b/i, /\bdoj\b/i, /\bpentagon\b/i, /\bsecret service\b/i, /পেন্টাগন/i],
    tags: ['#FBI', '#DOJ', '#Pentagon', '#NationalSecurity'],
  },
  {
    patterns: [/\bdesantis\b/i, /\bnewsom\b/i, /\brfk jr\b/i, /\bkennedy\b/i, /\bramaswamy\b/i],
    tags: ['#USPolitics', '#Politics', '#USA'],
  },

  // US Tech Giants, AI & Business Titans
  {
    patterns: [/\belon musk\b/i, /\bmusk\b/i, /\btesla\b/i, /\bspacex\b/i, /ইলন মাস্ক/i, /মাস্ক/i],
    tags: ['#ElonMusk', '#Tesla', '#SpaceX', '#TechNews'],
  },
  {
    patterns: [/\bopenai\b/i, /\bchatgpt\b/i, /\bsam altman\b/i, /\bartificial intelligence\b/i, /\bai\b/i],
    tags: ['#OpenAI', '#ChatGPT', '#AI', '#ArtificialIntelligence'],
  },
  {
    patterns: [/\bapple\b/i, /\biphone\b/i, /\btim cook\b/i],
    tags: ['#Apple', '#iPhone', '#TechNews'],
  },
  {
    patterns: [/\bnvidia\b/i, /\bjensen huang\b/i],
    tags: ['#Nvidia', '#AIChips', '#TechNews'],
  },
  {
    patterns: [/\bgoogle\b/i, /\balphabet\b/i, /\bsundar pichai\b/i],
    tags: ['#Google', '#TechNews', '#AI'],
  },
  {
    patterns: [/\bmicrosoft\b/i, /\bbill gates\b/i, /\bsatya nadella\b/i],
    tags: ['#Microsoft', '#TechNews'],
  },
  {
    patterns: [/\bmeta\b/i, /\bmark zuckerberg\b/i, /\bzuckerberg\b/i],
    tags: ['#Meta', '#MarkZuckerberg', '#TechNews'],
  },
  {
    patterns: [/\bbitcoin\b/i, /\bcrypto\b/i, /\bbtc\b/i, /\bethereum\b/i],
    tags: ['#Bitcoin', '#Crypto', '#Finance'],
  },

  // US Economy, Wall Street & Finance
  {
    patterns: [/\bfederal reserve\b/i, /\bthe fed\b/i, /\bjerome powell\b/i, /\bwall street\b/i, /\bdow jones\b/i, /\bs&p\b/i, /\bnasdaq\b/i],
    tags: ['#WallStreet', '#FederalReserve', '#Economy', '#StockMarket'],
  },
  {
    patterns: [/\binflation\b/i, /\binterest rate\b/i, /\btariff\b/i, /\btariffs\b/i, /\btrade war\b/i],
    tags: ['#Inflation', '#Economy', '#BusinessNews', '#USEconomy'],
  },

  // US Sports, NFL & NBA
  {
    patterns: [/\bnfl\b/i, /\bsuper bowl\b/i, /\bpatrick mahomes\b/i, /\btravis kelce\b/i, /\bquarterback\b/i],
    tags: ['#NFL', '#SuperBowl', '#Football', '#Sports'],
  },
  {
    patterns: [/\bnba\b/i, /\blebron\b/i, /\blebron james\b/i, /\bsteph curry\b/i, /\bbasketball\b/i],
    tags: ['#NBA', '#Basketball', '#Sports'],
  },
  {
    patterns: [/\bmlb\b/i, /\bworld series\b/i, /\bbaseball\b/i],
    tags: ['#MLB', '#Baseball', '#Sports'],
  },
  {
    patterns: [/\bufc\b/i, /\bmma\b/i, /\bdana white\b/i],
    tags: ['#UFC', '#MMA', '#Fighting'],
  },

  // US Pop Culture & Entertainment
  {
    patterns: [/\btaylor swift\b/i, /\bswifties\b/i, /\beras tour\b/i],
    tags: ['#TaylorSwift', '#Swifties', '#PopCulture'],
  },
  {
    patterns: [/\bhollywood\b/i, /\boscars\b/i, /\bgrammys\b/i, /\bnetflix\b/i, /\bdisney\b/i, /\bbox office\b/i],
    tags: ['#Hollywood', '#Entertainment', '#CelebrityNews', '#Movies'],
  },
  {
    patterns: [/\bnasa\b/i, /\bspace\b/i, /\bastronomy\b/i, /\bjames webb\b/i],
    tags: ['#NASA', '#Space', '#Science'],
  },
  {
    patterns: [/\bhurricane\b/i, /\btornado\b/i, /\bwildfire\b/i, /\bsevere storm\b/i, /\bblizzard\b/i],
    tags: ['#SevereWeather', '#WeatherAlert', '#Emergency', '#USNews'],
  },

  // International Geopolitics
  {
    patterns: [/পুতিন/i, /রাশিয়া/i, /রাশিয়া/i, /\bputin\b/i, /\brussia\b/i, /ক্রেমলিন/i],
    tags: ['#Putin', '#Russia', '#WorldPolitics'],
  },
  {
    patterns: [/ইউক্রেন/i, /জেলেনস্কি/i, /\bukraine\b/i, /\bzelensky\b/i],
    tags: ['#Ukraine', '#UkraineWar', '#WorldNews'],
  },
  {
    patterns: [/ফিলিস্তিন/i, /প্যালেস্টাইন/i, /গাজা/i, /\bpalestine\b/i, /\bgaza\b/i, /হামাস/i],
    tags: ['#Palestine', '#FreePalestine', '#Gaza'],
  },
  {
    patterns: [/ইসরায়েল/i, /ইসরাইল/i, /ইজরায়েল/i, /নেতানিয়াহু/i, /\bisrael\b/i, /\bnetanyahu\b/i],
    tags: ['#Israel', '#MiddleEast'],
  },
  {
    patterns: [/ইরান/i, /তেহরান/i, /\biran\b/i, /\btehran\b/i],
    tags: ['#Iran', '#MiddleEast'],
  },
  {
    patterns: [/ভারত/i, /মোদি/i, /মোদীর/i, /দিল্লি/i, /\bindia\b/i, /\bmodi\b/i],
    tags: ['#India', '#Modi'],
  },
  {
    patterns: [/পাকিস্তান/i, /ইসলামাবাদ/i, /লাহোর/i, /\bpakistan\b/i],
    tags: ['#Pakistan'],
  },
  {
    patterns: [/চীন/i, /বেইজিং/i, /জিনপিং/i, /\bchina\b/i, /\bbeijing\b/i],
    tags: ['#China', '#Asia'],
  },

  // Bangladesh Key Figures & Governance
  {
    patterns: [/ইউনূস/i, /ড\. ইউনূস/i, /উপদেষ্টা/i, /অন্তর্বর্তী/i, /\byunus\b/i],
    tags: ['#DrYunus', '#InterimGovt', '#Bangladesh'],
  },
  {
    patterns: [/বিএনপি/i, /তারেক রহমান/i, /খালেদা জিয়া/i, /\bbnp\b/i],
    tags: ['#BNP', '#BangladeshPolitics', '#TariqueRahman'],
  },
  {
    patterns: [/আওয়ামী/i, /আওয়ামী/i, /শেখ হাসিনা/i, /\bawami\b/i, /\bhasina\b/i],
    tags: ['#AwamiLeague', '#BangladeshPolitics'],
  },
  {
    patterns: [/জামায়াত/i, /শিবির/i, /\bjamaat\b/i],
    tags: ['#BangladeshPolitics'],
  },
  {
    patterns: [/নির্বাচন/i, /ভোট/i, /ইসি/i, /ব্যালট/i, /\belection\b/i, /\bvote\b/i],
    tags: ['#Election', '#BangladeshElection', '#Vote'],
  },

  // Sports Stars & Competitions
  {
    patterns: [/মেসি/i, /\bmessi\b/i, /লিওনেল মেসি/i],
    tags: ['#Messi', '#LionelMessi', '#Football'],
  },
  {
    patterns: [/রোনালদো/i, /\bronaldo\b/i, /সিআরসেভেন/i, /\bcr7\b/i],
    tags: ['#Ronaldo', '#CristianoRonaldo', '#Football'],
  },
  {
    patterns: [/নেইমার/i, /\bneymar\b/i, /এমবাপ্পে/i, /\bmbappe\b/i],
    tags: ['#Football', '#Soccer'],
  },
  {
    patterns: [/সাকিব/i, /সাকিব আল হাসান/i, /\bshakib\b/i],
    tags: ['#ShakibAlHasan', '#Cricket', '#Tigers'],
  },
  {
    patterns: [/তামিম/i, /মুশফিক/i, /মাহমুদুল্লাহ/i, /শান্ত/i, /মিরাজ/i, /তাসকিন/i, /মুস্তাফিজ/i],
    tags: ['#BangladeshCricket', '#Tigers', '#Cricket'],
  },
  {
    patterns: [/বিসিবি/i, /\bbcb\b/i, /টাইগার/i, /বিপিএল/i, /\bbpl\b/i],
    tags: ['#BCB', '#BangladeshCricket', '#BPL'],
  },
  {
    patterns: [/বিশ্বকাপ/i, /\bworld cup\b/i, /চ্যাম্পিয়ন্স ট্রফি/i, /\bchampions trophy\b/i],
    tags: ['#WorldCup', '#CricketWorldCup'],
  },

  // Education & Admissions
  {
    patterns: [/মেডিকেল/i, /মেডিক্যাল/i, /এমবিবিএস/i, /ভর্তি পরীক্ষা/i, /\bmedical admission\b/i, /\bmbbs\b/i],
    tags: ['#MedicalAdmission', '#MBBS', '#MedicalExam'],
  },
  {
    patterns: [/বিসিএস/i, /পিএসসি/i, /\bbcs\b/i, /\bbpsc\b/i],
    tags: ['#BCS', '#BPSC', '#GovtJob'],
  },
  {
    patterns: [/এইচএসসি/i, /এসএসসি/i, /দাখিল/i, /\bhsc\b/i, /\bssc\b/i],
    tags: ['#HSC', '#SSC', '#BoardExam'],
  },
  {
    patterns: [/বুয়েট/i, /বুয়েট/i, /ঢাবি/i, /ঢাকা বিশ্ববিদ্যালয়/i, /\bbuet\b/i],
    tags: ['#BUET', '#DhakaUniversity', '#Admission'],
  },

  // Economy, Finance & Infrastructure
  {
    patterns: [/স্বর্ণ/i, /সোনা/i, /সোনার দাম/i, /\bgold price\b/i, /\bgold\b/i],
    tags: ['#GoldPrice', '#স্বর্ণেরদাম', '#Economy'],
  },
  {
    patterns: [/ডলার/i, /রিজার্ভ/i, /বাংলাদেশ ব্যাংক/i, /\bdollar\b/i, /\bbank\b/i],
    tags: ['#DollarRate', '#BangladeshBank', '#EconomyUpdate'],
  },
  {
    patterns: [/মেট্রোরেল/i, /মেট্রো রেল/i, /\bmetro rail\b/i, /\bmetrorail\b/i],
    tags: ['#MetroRail', '#DhakaMetroRail', '#Dhaka'],
  },
  {
    patterns: [/পদ্মা সেতু/i, /কর্ণফুলী টানেল/i, /টানেল/i],
    tags: ['#Bangladesh', '#Development'],
  },

  // Natural events, weather & emergencies
  {
    patterns: [/ঘূর্ণিঝড়/i, /ঘূর্ণিঝড়/i, /বন্যা/i, /বৃষ্টি/i, /শৈত্যপ্রবাহ/i, /তাপপ্রবাহ/i, /\bweather\b/i, /\bcyclone\b/i],
    tags: ['#WeatherUpdate', '#BangladeshWeather', '#আবহাওয়া'],
  },
  {
    patterns: [/ভূমিকম্প/i, /\bearthquake\b/i],
    tags: ['#Earthquake', '#Emergency'],
  },
  {
    patterns: [/আগুন/i, /অগ্নিকাণ্ড/i, /সড়ক দুর্ঘটনা/i, /নিহত/i, /আহত/i, /\baccident\b/i, /\bfire\b/i],
    tags: ['#Emergency', '#Alert', '#AccidentNews'],
  },
];

export interface GenerateViralHashtagsOptions {
  category?: string;
  headline?: string;
  userTags?: string;
  targetCount?: number; // Default: 12 (recommended 10-14 for Meta Reels)
  isEnglish?: boolean;
}

/**
 * Detects whether a string is predominantly in English rather than Bengali
 */
export function isEnglishText(text?: string): boolean {
  if (!text) return false;
  const bengaliCount = (text.match(/[\u0980-\u09FF]/g) || []).length;
  const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
  return latinCount > bengaliCount;
}

/**
 * Resolves category for Trending News World (USA & International audience)
 */
export function resolveUSACategory(categoryName?: string, headline?: string): string {
  const cat = (categoryName || '').toLowerCase().trim();
  const hl = (headline || '').toLowerCase().trim();

  // 1. Direct Category Match (highest priority)
  if (cat) {
    if (/politic|white house|congress|senate|election|\bgop\b|democrat/i.test(cat)) return 'politics';
    if (/tech|technology|\bai\b|silicon|gadget|cyber|crypto/i.test(cat)) return 'technology';
    if (/econom|business|market|finance|wall street|\bfed\b/i.test(cat)) return 'economy';
    if (/sport|nfl|nba|mlb|football|soccer|ufc/i.test(cat)) return 'sports';
    if (/entertain|celebrity|hollywood|movie|cinema|music/i.test(cat)) return 'entertainment';
    if (/science|space|nasa|health|medical|climate/i.test(cat)) return 'science';
    if (/crime|justice|law|police|legal/i.test(cat)) return 'crime';
    if (/lifestyle|living|wellness|travel|food/i.test(cat)) return 'lifestyle';
    if (/world|internat|foreign|global/i.test(cat)) return 'world';
  }

  // 2. Headline Keyword Resolution
  if (/politic|white house|congress|senate|election|\bvote\b|republican|democrat|\bgop\b|biden|trump|vance|harris|scotus|\bcourt\b|\bgov\b/i.test(hl)) {
    return 'politics';
  }
  if (/tech|technology|\bai\b|artificial intelligence|silicon|gadget|apple|google|microsoft|nvidia|openai|crypto|bitcoin|software|cyber/i.test(hl)) {
    return 'technology';
  }
  if (/econom|business|market|stock|wall street|inflation|\bfed\b|federal reserve|finance|\bbank\b|dollar|tariff|trade/i.test(hl)) {
    return 'economy';
  }
  if (/sport|nfl|nba|mlb|football|soccer|basketball|super bowl|athlete|ufc|fifa|chiefs|mahomes/i.test(hl)) {
    return 'sports';
  }
  if (/entertain|celebrity|hollywood|movie|cinema|actor|music|song|album|taylor swift|billboard|oscar|grammy/i.test(hl)) {
    return 'entertainment';
  }
  if (/science|space|nasa|health|medical|disease|virus|climate|environment/i.test(hl)) {
    return 'science';
  }
  if (/crime|police|shooting|fbi|\bcourt\b|arrest|jail|investigation|murder|fire|accident|crash/i.test(hl)) {
    return 'crime';
  }
  if (/ukraine|russia|israel|gaza|middle east|china|iran|nato|\bun\b|europe|asia|geopolit|foreign/i.test(hl)) {
    return 'world';
  }
  if (/lifestyle|wellness|living|food|travel|style/i.test(hl)) {
    return 'lifestyle';
  }

  return 'general';
}

export const USA_CATEGORY_VIRAL_HASHTAGS: Record<string, string[]> = {
  politics: [
    '#USPolitics',
    '#Politics',
    '#WhiteHouse',
    '#Congress',
    '#Senate',
    '#CapitolHill',
    '#GOP',
    '#Democrats',
    '#Election',
    '#PoliticalNews',
    '#SCOTUS',
  ],
  world: [
    '#WorldNews',
    '#InternationalNews',
    '#GlobalNews',
    '#Geopolitics',
    '#ForeignAffairs',
    '#GlobalUpdate',
    '#BreakingWorld',
    '#Diplomacy',
  ],
  economy: [
    '#BusinessNews',
    '#Economy',
    '#WallStreet',
    '#Finance',
    '#StockMarket',
    '#Inflation',
    '#FederalReserve',
    '#Investing',
    '#MarketWatch',
    '#Crypto',
  ],
  technology: [
    '#TechNews',
    '#Technology',
    '#AI',
    '#ArtificialIntelligence',
    '#Innovation',
    '#SiliconValley',
    '#BigTech',
    '#TechUpdate',
    '#Gadgets',
  ],
  entertainment: [
    '#Entertainment',
    '#Hollywood',
    '#CelebrityNews',
    '#PopCulture',
    '#Showbiz',
    '#Movies',
    '#MusicNews',
    '#Cinema',
  ],
  sports: [
    '#SportsNews',
    '#Sports',
    '#NFL',
    '#NBA',
    '#MLB',
    '#SuperBowl',
    '#Football',
    '#Basketball',
    '#Soccer',
  ],
  science: [
    '#Science',
    '#Space',
    '#NASA',
    '#HealthNews',
    '#MedicalNews',
    '#ClimateChange',
    '#Environment',
  ],
  crime: [
    '#BreakingAlert',
    '#CrimeNews',
    '#Investigation',
    '#Justice',
    '#LawAndOrder',
    '#Police',
    '#LegalNews',
  ],
  lifestyle: [
    '#Lifestyle',
    '#HealthTips',
    '#Wellness',
    '#Culture',
    '#HumanInterest',
    '#TrendingNow',
  ],
  general: [
    '#TrendingNewsWorld',
    '#USNews',
    '#BreakingNews',
    '#WorldNews',
    '#NewsAlert',
    '#DailyNews',
    '#HeadlineNews',
  ],
};

export const CORE_USA_NEWS_TAGS = [
  '#TrendingNewsWorld',
  '#USNews',
  '#BreakingNews',
  '#WorldNews',
  '#TrendingNews',
  '#NewsUpdate',
  '#USA',
  '#DailyNews',
  '#Headlines',
];

/**
 * Intelligent viral hashtag generator for Trending News World (USA & International).
 * Automatically tuned for USA Meta algorithm discovery (Facebook Feed & Reels).
 */
export function generateTrendingNewsHashtags(options?: GenerateViralHashtagsOptions): string {
  const targetCount = options?.targetCount ?? 20;
  const headline = (options?.headline || '').trim();
  const usaCategory = resolveUSACategory(options?.category, headline);
  const userTagsRaw = (options?.userTags || '').trim();

  const selectedTags: string[] = [];
  const seen = new Set<string>();

  const pushTag = (raw: string) => {
    if (!raw) return;
    let tag = raw.trim();
    if (!tag.startsWith('#')) {
      tag = '#' + tag;
    }
    tag = '#' + tag.substring(1).replace(/[\s\.,;:!?'"(){}\[\]\\\/]/g, '');
    if (tag.length <= 1) return;

    const lower = tag.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      selectedTags.push(tag);
    }
  };

  // 1. Dynamic Trending Entities from Headline (Trump, Elon Musk, Wall Street, etc.)
  if (headline) {
    const entityMatches: string[] = [];
    for (const entity of VIRAL_HEADLINE_ENTITIES) {
      const matched = entity.patterns.some((p) => {
        if (typeof p === 'string') {
          return headline.toLowerCase().includes(p.toLowerCase());
        }
        return p.test(headline);
      });
      if (matched) {
        if (entity.tags[0]) entityMatches.push(entity.tags[0]);
        if (entity.tags[1]) entityMatches.push(entity.tags[1]);
      }
    }
    for (const t of entityMatches.slice(0, 4)) {
      pushTag(t);
    }
  }

  // 2. Category-Specific USA News Tags
  const categoryTags = USA_CATEGORY_VIRAL_HASHTAGS[usaCategory] || USA_CATEGORY_VIRAL_HASHTAGS['general'];
  for (const t of categoryTags.slice(0, 4)) {
    pushTag(t);
  }

  // 3. User configured tags (from DB settings) - filter out Bangladesh/Bengali regional tags
  if (userTagsRaw) {
    for (const t of userTagsRaw.split(/\s+/).filter(Boolean)) {
      const lower = t.toLowerCase();
      if (
        /[\u0980-\u09FF]/.test(t) ||
        lower.includes('bangla') ||
        lower.includes('bangladesh') ||
        lower.includes('bdnews') ||
        lower === '#bd' ||
        lower === 'bd'
      ) {
        continue;
      }
      pushTag(t);
    }
  }

  // 4. Core USA News Distribution Tags
  for (const t of CORE_USA_NEWS_TAGS.slice(0, 3)) {
    pushTag(t);
  }

  // 5. Core Algorithmic Discovery Tags (reels, trending, viral)
  for (const t of CORE_VIRAL_REEL_TAGS) {
    pushTag(t);
  }

  // 6. Remaining category tags if still under limit
  for (const t of categoryTags) {
    pushTag(t);
  }

  const finalLimit = Math.max(10, Math.min(30, targetCount));
  return selectedTags.slice(0, finalLimit).join(' ');
}

/**
 * Intelligent viral hashtag generator for Facebook Reels.
 * Synthesizes dynamic headline entities, category precision tags, universal Reels discovery tags,
 * and high-authority news hooks with strict case-insensitive deduplication and formatting.
 * Guaranteed 10-14 high-impact tags to maximize algorithmic distribution without spam penalties.
 */
export function generateViralReelHashtags(options?: GenerateViralHashtagsOptions): string {
  const headline = (options?.headline || '').trim();
  const category = (options?.category || '').trim();
  const isEnglish = options?.isEnglish || isEnglishText(headline) || isEnglishText(category);

  // If content is in English or explicitly set, route to USA/International hashtag engine
  if (isEnglish) {
    return generateTrendingNewsHashtags(options);
  }

  const targetCount = options?.targetCount ?? 12;
  const categoryId = resolveCategoryTheme(options?.category);
  const userTagsRaw = (options?.userTags || '').trim();

  const selectedTags: string[] = [];
  const seen = new Set<string>();

  const pushTag = (raw: string) => {
    if (!raw) return;
    let tag = raw.trim();
    if (!tag.startsWith('#')) {
      tag = '#' + tag;
    }
    // Remove unwanted punctuation/spaces from tag body
    tag = '#' + tag.substring(1).replace(/[\s\.,;:!?'"(){}\[\]\\\/]/g, '');
    if (tag.length <= 1) return;

    const lower = tag.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      selectedTags.push(tag);
    }
  };

  // 1. Dynamic Trending Entities from Headline (highest relevance & search surge)
  if (headline) {
    const entityMatches: string[] = [];
    for (const entity of VIRAL_HEADLINE_ENTITIES) {
      const matched = entity.patterns.some((p) => {
        if (typeof p === 'string') {
          return headline.toLowerCase().includes(p.toLowerCase());
        }
        return p.test(headline);
      });
      if (matched) {
        if (entity.tags[0]) entityMatches.push(entity.tags[0]);
        if (entity.tags[1]) entityMatches.push(entity.tags[1]);
      }
    }
    for (const t of entityMatches.slice(0, 4)) {
      pushTag(t);
    }
  }

  // 2. Category-Specific Viral Tags (ensures Meta's topic graph classifies correctly)
  let categoryTags = [...(CATEGORY_VIRAL_HASHTAGS[categoryId] || CATEGORY_VIRAL_HASHTAGS['cat-bangladesh'] || [])];
  
  // Sports category sub-tuning: Football vs Cricket
  if (categoryId === 'cat-sports') {
    const isFootball = /ফুটবল|মেসি|রোনালদো|নেইমার|বার্সেলোনা|রিয়াল মাদ্রিদ|চ্যাম্পিয়ন্স লিগ|football|fifa/i.test(headline);
    const isCricket = /ক্রিকেট|সাকিব|তামিম|মুশফিক|টাইগার|বিসিবি|বিপিএল|cricket|bpl|bcb/i.test(headline);
    if (isFootball) {
      categoryTags = ['#Football', '#FootballReels', '#SportsNews', '#খেলাধুলা', '#ফুটবল', '#SportsReels'];
    } else if (isCricket) {
      categoryTags = ['#Cricket', '#CricketReels', '#BangladeshCricket', '#Tigers', '#BCB', '#খেলাধুলা', '#ক্রিকেট'];
    }
  }

  for (const t of categoryTags.slice(0, 3)) {
    pushTag(t);
  }

  // 3. User configured tags (from DB settings)
  if (userTagsRaw) {
    const tokens = userTagsRaw.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      pushTag(t);
    }
  }

  // 4. High-Authority News Discovery Hooks
  for (const t of NEWS_VIRAL_HOOK_TAGS.slice(0, 3)) {
    pushTag(t);
  }

  // 5. Core Algorithmic Reels Discovery Tags (guarantees feed indexing)
  for (const t of CORE_VIRAL_REEL_TAGS) {
    pushTag(t);
  }

  // 6. Remaining Category Tags (if still under target count)
  for (const t of categoryTags) {
    pushTag(t);
  }

  // Trim to target count (optimal Meta sweet spot: 10-14 tags)
  const finalLimit = Math.max(10, Math.min(14, targetCount));
  return selectedTags.slice(0, finalLimit).join(' ');
}

/**
 * Intelligent viral hashtag generator for YouTube Shorts
 */
export function generateViralShortsHashtags(options?: GenerateViralHashtagsOptions): string {
  const targetCount = options?.targetCount ?? 22;
  const headline = (options?.headline || '').trim();
  const isEnglish = options?.isEnglish || isEnglishText(headline) || isEnglishText(options?.category);
  const categoryId = resolveCategoryTheme(options?.category);
  const userTagsRaw = (options?.userTags || '').trim();

  const selectedTags: string[] = [];
  const seen = new Set<string>();

  const pushTag = (raw: string) => {
    if (!raw) return;
    let tag = raw.trim();
    if (!tag.startsWith('#')) tag = '#' + tag;
    tag = '#' + tag.substring(1).replace(/[\s\.,;:!?'"(){}\[\]\\\/]/g, '');
    if (tag.length <= 1) return;
    const lower = tag.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      selectedTags.push(tag);
    }
  };

  // 1. Core YouTube Shorts high-velocity viral tags (Algorithm triggers)
  pushTag('#Shorts');
  pushTag('#YouTubeShorts');
  pushTag('#Viral');
  pushTag('#Trending');
  pushTag('#FYP');
  pushTag('#ViralShorts');
  pushTag('#ShortsFeed');
  pushTag('#ShortsViral');
  pushTag('#Explore');
  pushTag('#ViralVideo');

  // 2. Dynamic Headline Entities (Celebrities, Leaders, Locations)
  if (headline) {
    for (const entity of VIRAL_HEADLINE_ENTITIES) {
      if (entity.patterns.some((p) => (typeof p === 'string' ? headline.toLowerCase().includes(p.toLowerCase()) : p.test(headline)))) {
        if (entity.tags[0]) pushTag(entity.tags[0]);
        if (entity.tags[1]) pushTag(entity.tags[1]);
      }
    }
  }

  // 3. High-traffic News and Regional Viral Tags
  if (isEnglish) {
    pushTag('#News');
    pushTag('#BreakingNews');
    pushTag('#TrendingNews');
    pushTag('#WorldNews');
    pushTag('#USNews');
    pushTag('#DailyNews');
    pushTag('#Headlines');
    pushTag('#TrendingNewsWorld');

    const usaCategory = resolveUSACategory(options?.category, headline);
    const categoryTags = USA_CATEGORY_VIRAL_HASHTAGS[usaCategory] || USA_CATEGORY_VIRAL_HASHTAGS['general'];
    for (const t of categoryTags) {
      pushTag(t);
    }
  } else {
    pushTag('#বাংলাখবর');
    pushTag('#খবর');
    pushTag('#সংবাদ');
    pushTag('#ব্রেকিংনিউজ');
    pushTag('#বাংলাদেশ');
    pushTag('#BDNews');
    pushTag('#Bangladesh');
    pushTag('#BanglaNews');
    pushTag('#NewsUpdate');
    pushTag('#সরাসরি');

    const categoryTags = CATEGORY_VIRAL_HASHTAGS[categoryId] || [];
    for (const t of categoryTags) {
      pushTag(t);
    }
  }

  // 4. User tags / News hooks
  if (userTagsRaw) {
    for (const t of userTagsRaw.split(/\s+/).filter(Boolean)) {
      pushTag(t);
    }
  }

  return selectedTags.slice(0, targetCount).join(' ');
}

export interface GenerateGDriveHashtagsOptions {
  videoTitle?: string;
  channelName?: string;
  category?: string;
  userTags?: string;
  targetCount?: number;
  isEnglish?: boolean;
}

/**
 * Intelligent viral hashtag generator specifically engineered for Google Drive video Reels.
 * - Extracts hashtags from video filenames
 * - Accurately detects niche/topic from channel name or video title (Sports, Comedy, Tech, Motivation, Gaming, Food, Travel, Islamic, etc.)
 * - NEVER defaults to unrelated Bangladesh breaking news tags unless the video is actually news
 * - Guarantees 10-14 high-impact Meta Reels discovery tags (#reels, #fbreels, #viralreels, etc.)
 */
export function generateGDriveReelHashtags(options?: GenerateGDriveHashtagsOptions): string {
  const targetCount = options?.targetCount ?? 12;
  const title = (options?.videoTitle || '').trim();
  const channel = (options?.channelName || '').trim();
  const combined = `${title} ${channel}`.toLowerCase();
  const userTagsRaw = (options?.userTags || '').trim();

  const isEnglish =
    Boolean(options?.isEnglish) ||
    channel.toLowerCase().includes('trending') ||
    channel.toLowerCase().includes('world') ||
    channel.toLowerCase().includes('english') ||
    channel.toLowerCase().includes('alisa') ||
    isEnglishText(title);

  const selectedTags: string[] = [];
  const seen = new Set<string>();

  const pushTag = (raw: string) => {
    if (!raw) return;
    let tag = raw.trim();
    if (!tag.startsWith('#')) {
      tag = '#' + tag;
    }
    // Clean tag body
    tag = '#' + tag.substring(1).replace(/[\s\.,;:!?'"(){}\[\]\\\/]/g, '');
    if (tag.length <= 1) return;

    // Filter Bengali tags out of English posts
    if (isEnglish) {
      const lower = tag.toLowerCase();
      if (
        /[\u0980-\u09FF]/.test(tag) ||
        lower.includes('bangla') ||
        lower.includes('bangladesh') ||
        lower.includes('bdnews') ||
        lower === '#bd' ||
        lower === 'bd'
      ) {
        return;
      }
    }

    const lower = tag.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      selectedTags.push(tag);
    }
  };

  // 1. User specified tags or tags extracted from filename (highest priority)
  if (userTagsRaw) {
    const tokens = userTagsRaw.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      pushTag(t);
    }
  }

  // 2. Specific Celebrity / Athlete / Entity detection
  for (const entity of VIRAL_HEADLINE_ENTITIES) {
    const matched = entity.patterns.some((p) => {
      if (typeof p === 'string') {
        return combined.includes(p.toLowerCase());
      }
      return p.test(combined);
    });
    if (matched) {
      for (const t of entity.tags.slice(0, 2)) {
        pushTag(t);
      }
    }
  }

  // 3. Resolve Niche / Category
  let category = (options?.category || '').toLowerCase().trim();
  if (!category || category === 'auto' || category === 'general') {
    // Auto-detect niche from title & channel name
    if (/football|messi|ronaldo|fifa|goal|barca|real madrid|neymar|mbappe|ফুটবল|গোল/i.test(combined)) {
      category = 'football';
    } else if (/cricket|shakib|tamim|bpl|ipl|t20|world cup|batsman|bowler|wicket|ক্রিকেট|বিপিএল/i.test(combined)) {
      category = 'cricket';
    } else if (/sport|fitness|gym|workout|athlete|match|খেলা|দৌড়/i.test(combined)) {
      category = 'sports';
    } else if (/funny|comedy|meme|prank|laugh|joke|lol|fun|humor|হাসি|মজা/i.test(combined)) {
      category = 'comedy';
    } else if (/tech|technology|ai|artificial intelligence|gadget|software|coding|phone|laptop|robot|প্রযুক্তি/i.test(combined)) {
      category = 'technology';
    } else if (/motivation|inspire|mindset|success|wealth|life lessons|advice|অনুপ্রেরণা|সফলতা/i.test(combined)) {
      category = 'motivation';
    } else if (/islam|islamic|waz|quran|nasheed|hadith|namaz|dua|azhari|ওয়াজ|ইসলাম|কোরআন/i.test(combined)) {
      category = 'islamic';
    } else if (/food|recipe|cooking|kitchen|chef|delicious|street food|cake|biryani|রান্না|রেসিপি/i.test(combined)) {
      category = 'food';
    } else if (/game|gaming|gamer|gameplay|pubg|freefire|minecraft|gta|esports|গেম/i.test(combined)) {
      category = 'gaming';
    } else if (/travel|tour|nature|adventure|beach|mountain|explore|trip|ভ্রমণ|ট্যুর/i.test(combined)) {
      category = 'travel';
    } else if (/entertainment|movie|cinema|actor|actress|natok|drama|dance|song|গান|নাটক|সিনেমা/i.test(combined)) {
      category = 'entertainment';
    } else if (/news|breaking|bnp|awami|yunus|election|update|সংবাদ|খবর|ব্রেকিং/i.test(combined)) {
      category = 'news';
    } else {
      category = 'viral';
    }
  }

  // 4. Topic-specific hashtags based on detected/selected category
  const topicTags: Record<string, string[]> = {
    football: ['#Football', '#FootballReels', '#Soccer', '#Goals', '#CR7', '#Messi', '#SportsReels', '#FootballSkills'],
    cricket: ['#Cricket', '#CricketReels', '#CricketLover', '#Tigers', '#BPL', '#IPL', '#SportsReels', '#CricketFans'],
    sports: ['#Sports', '#SportsReels', '#Fitness', '#Workout', '#Athlete', '#FitLife', '#SportsVideo'],
    comedy: isEnglish
      ? ['#Funny', '#Comedy', '#ComedyReels', '#Memes', '#FunnyVideos', '#Humor', '#Laugh', '#Jokes']
      : ['#Funny', '#Comedy', '#ComedyReels', '#Memes', '#FunnyVideos', '#Humor', '#Laugh', '#Jokes', '#মজারভিডিও'],
    technology: ['#Tech', '#Technology', '#TechReels', '#Gadgets', '#AI', '#Innovation', '#TechNews', '#SmartTech'],
    motivation: ['#Motivation', '#Inspiration', '#Mindset', '#Success', '#DailyMotivation', '#Lifestyle', '#Quotes', '#FitnessMotivation'],
    islamic: isEnglish
      ? ['#Islamic', '#IslamicReels', '#Islam', '#Deen', '#Quran', '#IslamicReminder', '#Muslim', '#Sunnah']
      : ['#Islamic', '#IslamicReels', '#Islam', '#Deen', '#Quran', '#IslamicReminder', '#Muslim', '#ওয়াজ', '#Sunnah'],
    food: isEnglish
      ? ['#Food', '#Foodie', '#Cooking', '#Recipe', '#FoodReels', '#Delicious', '#StreetFood', '#FoodLover']
      : ['#Food', '#Foodie', '#Cooking', '#Recipe', '#FoodReels', '#Delicious', '#StreetFood', '#FoodLover', '#রান্না'],
    gaming: ['#Gaming', '#Gamer', '#Gameplay', '#GamingReels', '#FreeFire', '#PUBG', '#GamingCommunity', '#VideoGames'],
    travel: ['#Travel', '#TravelReels', '#Nature', '#Adventure', '#Wanderlust', '#Explore', '#TravelGram', '#BeautifulPlaces'],
    entertainment: isEnglish
      ? ['#Entertainment', '#EntertainmentReels', '#Cinema', '#Drama', '#ViralClips', '#Showbiz', '#MovieClips']
      : ['#Entertainment', '#EntertainmentReels', '#Cinema', '#Drama', '#ViralClips', '#Showbiz', '#নাটক', '#MovieClips'],
    news: isEnglish
      ? ['#News', '#BreakingNews', '#WorldNews', '#USNews', '#CurrentAffairs', '#NewsUpdate', '#TrendingNews', '#Headlines']
      : ['#News', '#BreakingNews', '#BanglaNews', '#CurrentAffairs', '#NewsUpdate', '#Bangladesh', '#খবর'],
    viral: ['#Viral', '#Trending', '#Explore', '#ViralVideo', '#ViralReels', '#ForYouPage', '#ExplorePage'],
  };

  const matchedTopicTags = topicTags[category] || topicTags['viral'];
  for (const t of matchedTopicTags.slice(0, 4)) {
    pushTag(t);
  }

  // 5. Core Algorithmic Facebook & Meta Reels Discovery Tags
  const coreReelTags = [
    '#reels',
    '#fbreels',
    '#viralreels',
    '#reelsfb',
    '#reelsvideo',
    '#trending',
    '#viral',
    '#foryou',
    '#fyp',
  ];
  for (const t of coreReelTags) {
    pushTag(t);
  }

  // 6. Fill with remaining topic tags if needed
  for (const t of matchedTopicTags) {
    pushTag(t);
  }

  const finalLimit = Math.max(10, Math.min(14, targetCount));
  return selectedTags.slice(0, finalLimit).join(' ');
}



