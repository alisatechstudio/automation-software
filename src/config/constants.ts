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


