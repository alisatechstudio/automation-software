/**
 * Hard blocklist for broadcasters, leagues, and professional sports teams.
 * Ingestion from these sources is strictly prohibited unless an explicit license agreement is present in config.
 */

export const DEFAULT_BLOCKLIST = [
  // Major Broadcasters & Networks
  'espn',
  'sky sports',
  'skysports',
  'nbc sports',
  'bbc sport',
  'fox sports',
  'dazn',
  'tnt sports',
  'bt sport',
  'star sports',
  'sony ten',
  'sony six',
  'sony sports',
  'eurosport',
  'cbs sports',
  'bein sports',
  'canal+',
  'super sport',
  'supersport',

  // International Leagues & Federations
  'fifa',
  'uefa',
  'premier league',
  'epl',
  'la liga',
  'serie a',
  'bundesliga',
  'ligue 1',
  'major league soccer',
  'mls',
  'nba',
  'wnba',
  'nfl',
  'mlb',
  'nhl',
  'formula 1',
  'f1',
  'formula one',
  'icc',
  'bcci',
  'olympics',
  'ioc',
  'wwe',
  'aew',
  'ufc',
  'one championship',
  'bellator',
  'pga tour',
  'atp tour',
  'wta',
  'nascar',

  // Well-known Teams / Franchises
  'real madrid',
  'barcelona',
  'manchester united',
  'manchester city',
  'liverpool fc',
  'arsenal',
  'chelsea fc',
  'bayern munich',
  'psg',
  'juventus',
  'lakers',
  'golden state warriors',
  'boston celtics',
  'kansas city chiefs',
  'dallas cowboys',
  'new york yankees',

  // Social watermark / clip ripping platforms
  'tiktok',
  'reels rip',
  'watermarked',
];

export interface BlocklistCheckResult {
  isBlocked: boolean;
  matchedEntity?: string;
  reason?: string;
}

export function checkBlocklist(
  textToCheck: string,
  customBlocklist: string[] = DEFAULT_BLOCKLIST,
  licensedAgreements: string[] = []
): BlocklistCheckResult {
  const normalized = textToCheck.toLowerCase();

  for (const item of customBlocklist) {
    const itemNorm = item.toLowerCase().trim();
    if (!itemNorm) continue;

    // Check if the entity is mentioned as a whole token or exact boundary
    const regex = new RegExp(`\\b${escapeRegExp(itemNorm)}\\b`, 'i');
    if (regex.test(normalized) || normalized.includes(itemNorm)) {
      // Check if there is an explicit licensed partner agreement overriding this block
      const isLicensed = licensedAgreements.some(
        (agreement) => agreement.toLowerCase() === itemNorm || normalized.includes(agreement.toLowerCase())
      );

      if (isLicensed) {
        continue; // Permitted under valid license agreement
      }

      return {
        isBlocked: true,
        matchedEntity: item,
        reason: `Matched blocklisted sports broadcaster/league/team: "${item}". Ingestion prohibited without verified license agreement.`,
      };
    }
  }

  return { isBlocked: false };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
