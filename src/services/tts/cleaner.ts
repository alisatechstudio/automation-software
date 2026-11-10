/**
 * Cleans and formats RSS feed descriptions for natural television news speech.
 * Strips HTML tags, trims photo captions/bylines, and preserves the full description
 * (up to ~80 words) to comfortably fit within a 30-second video reel.
 */
export function cleanSpeechScript(description?: string, headline?: string): string {
  const raw = (description || '').trim();
  const fallbackHeadline = (headline || '').trim();

  // 1. Strip HTML tags
  let clean = raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');

  // 2. Decode HTML entities
  clean = clean
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&zwnj;|&zwj;/gi, '');

  // 3. Remove URLs, photo credits, and RSS boilerplate snippets
  clean = clean
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\((?:ছবি|ফাইল ছবি|সংগৃহীত|প্রতিনিধি|ছবি:)[^)]*\)/gi, '')
    .replace(/\((?:Photo|File Photo|Reuters|AFP|AP|Source)[^)]*\)/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If description is empty or too short, speak the headline
  if (!clean || clean.length < 15) {
    return fallbackHeadline;
  }

  // 4. For a 30-second reel, natural news delivery accommodates up to ~75-85 words (~450 characters).
  // If the description is within this range, read out the complete description intact!
  const words = clean.split(/\s+/);
  if (words.length <= 80) {
    return clean;
  }

  // If description is extraordinarily long (e.g. full article body), preserve full sentences up to ~80 words
  const sentences = clean.split(/([।?!.])/);
  let spokenScript = '';
  for (let i = 0; i < sentences.length; i += 2) {
    const candidate = (spokenScript ? spokenScript + ' ' : '') + sentences[i] + (sentences[i + 1] || '');
    if (candidate.split(/\s+/).length <= 80) {
      spokenScript = candidate;
    } else {
      break;
    }
  }

  if (!spokenScript.trim()) {
    spokenScript = words.slice(0, 75).join(' ') + '...';
  }

  return spokenScript.trim() || fallbackHeadline;
}

