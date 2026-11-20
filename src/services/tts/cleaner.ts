export function cleanSpeechScript(description?: string, headline?: string): string {
  const raw = (description || '').trim();
  const fallbackHeadline = (headline || '').trim();

  let clean = raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');

  clean = clean
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&zwnj;|&zwj;/gi, '');

  clean = clean
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\((?:ছবি|ফাইল ছবি|সংগৃহীত|প্রতিনিধি|ছবি:)[^)]*\)/gi, '')
    .replace(/\((?:Photo|File Photo|Reuters|AFP|AP|Source)[^)]*\)/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean || clean.length < 15) {
    return fallbackHeadline;
  }

  // Preserve complete description from RSS. If text exceptionally exceeds 500 characters
  // (e.g. if the full article body was provided instead of a summary), keep complete sentences up to 500 characters.
  if (clean.length > 500) {
    const sentences = clean.split(/(?<=[।!?.\n])\s+/);
    let concise = '';
    for (const s of sentences) {
      if ((concise + ' ' + s).trim().length <= 500) {
        concise = (concise + ' ' + s).trim();
      } else {
        break;
      }
    }
    if (concise && concise.length >= 30) {
      return concise;
    }
    return clean.slice(0, 500).trim();
  }

  return clean;
}
