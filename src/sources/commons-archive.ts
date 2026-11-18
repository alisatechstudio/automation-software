import { BaseSource } from './base.js';
import type { ClipMeta } from '../types/index.js';
import { logger } from '../logger.js';

export interface CommonsArchiveOptions {
  categories?: string[];
  blocklist?: string[];
  licensedAgreements?: string[];
}

export class CommonsArchiveSource extends BaseSource {
  public readonly name = 'CommonsArchiveSource';
  private categories: string[];

  constructor(options: CommonsArchiveOptions = {}) {
    super(options.blocklist, options.licensedAgreements);
    this.categories = options.categories || ['Athletics', 'Cycling', 'Gymnastics', 'Swimming'];
  }

  public async fetchRecent(): Promise<ClipMeta[]> {
    const candidates: ClipMeta[] = [];

    for (const category of this.categories) {
      try {
        const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtitle=Category:${encodeURIComponent(
          category
        )}&cmtype=file&cmlimit=10&origin=*`;

        const res = await fetch(url, { headers: { 'User-Agent': 'SportsClipBot/1.0 (sportsclipbot@example.com)' } });
        if (!res.ok) continue;

        const data = (await res.json()) as any;
        const members = data?.query?.categorymembers || [];

        for (const member of members) {
          const title = member.title;
          if (!title || !title.toLowerCase().match(/\.(webm|ogv|mp4)$/)) continue;

          // Fetch file imageinfo & extmetadata for license
          const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata&titles=${encodeURIComponent(
            title
          )}&origin=*`;

          const infoRes = await fetch(infoUrl, {
            headers: { 'User-Agent': 'SportsClipBot/1.0 (sportsclipbot@example.com)' },
          });
          if (!infoRes.ok) continue;

          const infoData = (await infoRes.json()) as any;
          const pages = infoData?.query?.pages || {};
          const page = Object.values(pages)[0] as any;
          const imgInfo = page?.imageinfo?.[0];
          if (!imgInfo) continue;

          const extMeta = imgInfo.extmetadata || {};
          const licenseShort = extMeta.LicenseShortName?.value || extMeta.License?.value || '';
          const artist = extMeta.Artist?.value?.replace(/<[^>]*>/g, '') || 'Wikimedia Contributor';
          const credit = extMeta.Credit?.value?.replace(/<[^>]*>/g, '') || artist;
          const fileUrl = imgInfo.url;
          const descriptionUrl = imgInfo.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`;

          // Strict Commercial License Validation: reject NonCommercial
          const licUpper = licenseShort.toUpperCase();
          if (licUpper.includes('NC') || licUpper.includes('NON-COMMERCIAL') || licUpper.includes('NONCOMMERCIAL')) {
            logger.info({ title, license: licenseShort }, 'Rejecting Wikimedia clip: Non-Commercial license.');
            continue;
          }

          let normalizedLicense = 'CC_BY';
          if (licUpper.includes('CC0') || licUpper.includes('PUBLIC DOMAIN') || licUpper.includes('PD')) {
            normalizedLicense = 'CC0';
          }

          candidates.push({
            id: `wm_${member.pageid || Buffer.from(title).toString('hex').slice(0, 12)}`,
            title: title.replace(/^File:/, '').replace(/\.[^/.]+$/, ''),
            url: fileUrl,
            licenseType: normalizedLicense,
            licenseProofUrl: descriptionUrl,
            credit: `Footage from Wikimedia Commons: "${title}" by ${artist} (${licenseShort})`,
            publishedAt: extMeta.DateTimeOriginal?.value || new Date().toISOString(),
            sport: category,
            duration: 25,
            sourceName: this.name,
            rawMetadata: {
              licenseShort,
              artist,
              descriptionUrl,
            },
          });
        }
      } catch (err: any) {
        logger.error({ source: this.name, category, err: err.message }, 'Failed to fetch Wikimedia clips');
      }
    }

    return this.filterCandidates(candidates);
  }
}
