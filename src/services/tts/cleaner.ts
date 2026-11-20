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
    return fallbackHeadline.slice(0, 80);
  }

  // Snappy news script: keep first 1-2 punchy sentences (max 80 chars) for ~3-4 seconds voiceover
  const sentences = clean.split(/(?<=[।!?.\n])\s+/);
  let concise = '';
  for (const s of sentences) {
    if ((concise + ' ' + s).trim().length <= 80) {
      concise = (concise + ' ' + s).trim();
    } else {
      break;
    }
  }
  if (!concise || concise.length < 15) {
    concise = clean.slice(0, 80).trim();
  }

  return concise || fallbackHeadline.slice(0, 80);
}
