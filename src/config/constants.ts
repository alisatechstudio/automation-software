export function isEnglishText(text?: string): boolean {
  if (!text) return false;
  const bengaliCount = (text.match(/[\u0980-\u09FF]/g) || []).length;
  const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
  return latinCount > bengaliCount;
}

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

export interface GenerateViralHashtagsOptions {
  category?: string;
  headline?: string;
  targetCount?: number;
  userTags?: string;
  isEnglish?: boolean;
}

export function generateTrendingNewsHashtags(options?: GenerateViralHashtagsOptions): string {
  const targetCount = options?.targetCount ?? 15;
  const baseTags = [
    '#Shorts',
    '#TrendingNews',
    '#BreakingNews',
    '#ViralNews',
    '#WorldNews',
    '#NewsUpdate',
    '#Headlines',
    '#TopStories',
    '#CurrentAffairs',
    '#DailyNews',
    '#USANews',
    '#Trending',
    '#Viral',
    '#FYP',
    '#Explore',
  ];

  const userTags = (options?.userTags || '')
    .split(/\s+/)
    .filter((t) => t.startsWith('#'));

  const combined = Array.from(new Set([...userTags, ...baseTags]));
  return combined.slice(0, targetCount).join(' ');
}

export function generateViralReelHashtags(options?: GenerateViralHashtagsOptions): string {
  const headline = (options?.headline || '').trim();
  const isEnglish = options?.isEnglish || isEnglishText(headline) || isEnglishText(options?.category);

  if (isEnglish) {
    return generateTrendingNewsHashtags(options);
  }

  const targetCount = options?.targetCount ?? 15;
  const baseTags = [
    '#Shorts',
    '#রিলস',
    '#ব্রেকিংনিউজ',
    '#বাংলাদেশ',
    '#খবর',
    '#আজকেরখবর',
    '#ভাইরালভিডিও',
    '#bdnews',
    '#banglanews',
    '#viralreels',
    '#trending',
    '#newsupdate',
    '#bangladesh',
    '#fbreels',
    '#reelsvideo',
  ];

  const userTags = (options?.userTags || '')
    .split(/\s+/)
    .filter((t) => t.startsWith('#'));

  const combined = Array.from(new Set([...userTags, ...baseTags]));
  return combined.slice(0, targetCount).join(' ');
}

export function generateViralShortsHashtags(options?: GenerateViralHashtagsOptions): string {
  return generateViralReelHashtags(options);
}
