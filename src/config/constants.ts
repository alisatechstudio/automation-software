import path from 'path';

export const TEMPLATES = {
  CANVA_BDNEWS: 'template-canva-bdnews',
  SQUARE_BREAKING: 'template-square-breaking',
  SQUARE_EDITORIAL: 'template-square-editorial',
  LANDSCAPE_STANDARD: 'template-landscape-standard',
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
  // World leaders & geopolitical figures
  {
    patterns: [/ট্রাম্প/i, /ডোনাল্ড ট্রাম্প/i, /\btrump\b/i, /\bdonald trump\b/i],
    tags: ['#Trump', '#DonaldTrump', '#USA'],
  },
  {
    patterns: [/পুতিন/i, /রাশিয়া/i, /রাশিয়া/i, /\bputin\b/i, /\brussia\b/i, /ক্রেমলিন/i],
    tags: ['#Putin', '#Russia', '#WorldPolitics'],
  },
  {
    patterns: [/ইউক্রেন/i, /জেলেনস্কি/i, /\bukraine\b/i, /\bzelensky\b/i],
    tags: ['#Ukraine', '#UkraineWar', '#WorldNews'],
  },
  {
    patterns: [/বাইডেন/i, /হোয়াইট হাউস/i, /হোয়াইট হাউস/i, /\bbiden\b/i, /\bwhite house\b/i],
    tags: ['#JoeBiden', '#WhiteHouse', '#USA'],
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
}

/**
 * Intelligent viral hashtag generator for Facebook Reels.
 * Synthesizes dynamic headline entities, category precision tags, universal Reels discovery tags,
 * and high-authority news hooks with strict case-insensitive deduplication and formatting.
 * Guaranteed 10-14 high-impact tags to maximize algorithmic distribution without spam penalties.
 */
export function generateViralReelHashtags(options?: GenerateViralHashtagsOptions): string {
  const targetCount = options?.targetCount ?? 12;
  const headline = (options?.headline || '').trim();
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
  const targetCount = options?.targetCount ?? 8;
  const headline = (options?.headline || '').trim();
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

  // Core YouTube Shorts tags
  pushTag('#Shorts');
  pushTag('#YouTubeShorts');
  pushTag('#Viral');
  pushTag('#Trending');

  // Headline entities
  if (headline) {
    for (const entity of VIRAL_HEADLINE_ENTITIES) {
      if (entity.patterns.some((p) => (typeof p === 'string' ? headline.toLowerCase().includes(p.toLowerCase()) : p.test(headline)))) {
        if (entity.tags[0]) pushTag(entity.tags[0]);
      }
    }
  }

  // Category tags
  const categoryTags = CATEGORY_VIRAL_HASHTAGS[categoryId] || [];
  for (const t of categoryTags.slice(0, 2)) {
    pushTag(t);
  }

  // User tags / News hooks
  if (userTagsRaw) {
    for (const t of userTagsRaw.split(/\s+/).filter(Boolean)) {
      pushTag(t);
    }
  }
  pushTag('#BanglaNews');
  pushTag('#Bangladesh');

  return selectedTags.slice(0, targetCount).join(' ');
}



