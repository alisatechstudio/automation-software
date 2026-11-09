/**
 * Cleans and formats RSS feed descriptions for natural television news speech.
 * Strips HTML tags, trims photo captions/bylines, and extracts the primary
 * 1-2 sentences (~35-45 words) to fit comfortably within an 18-second video reel.
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

  // 4. Truncate to first 1-2 complete sentences or ~40 words so speech fits the reel duration
  const sentences = clean.split(/([।?!.])/);
  let spokenScript = '';

  if (sentences.length >= 2) {
    spokenScript = (sentences[0] + (sentences[1] || '') + (sentences[2] ? ' ' + sentences[2] + (sentences[3] || '') : '')).trim();
  } else {
    spokenScript = clean;
  }

  // Guard against excessively long descriptions: limit to ~45 words max
  const words = spokenScript.split(/\s+/);
  if (words.length > 45) {
    spokenScript = words.slice(0, 42).join(' ') + '...';
  }

  return spokenScript.trim() || fallbackHeadline;
}

