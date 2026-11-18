import { BaseSource } from './base.js';
import type { ClipMeta } from '../types/index.js';
import { logger } from '../logger.js';

export interface PixabayOptions {
  apiKey?: string;
  searchSports?: string[];
  blocklist?: string[];
  licensedAgreements?: string[];
}

export class PixabaySource extends BaseSource {
  public readonly name = 'PixabaySource';
  private apiKey?: string;
  private searchSports: string[];

  constructor(options: PixabayOptions) {
    super(options.blocklist, options.licensedAgreements);
    this.apiKey = options.apiKey;
    this.searchSports = options.searchSports || ['soccer', 'tennis', 'boxing', 'running'];
  }

  public async fetchRecent(): Promise<ClipMeta[]> {
    if (!this.apiKey) {
      logger.info({ source: this.name }, 'Pixabay API key not provided. Skipping.');
      return [];
    }

    const candidates: ClipMeta[] = [];

    for (const sport of this.searchSports) {
      try {
        const url = `https://pixabay.com/api/videos/?key=${this.apiKey}&q=${encodeURIComponent(sport)}&video_type=all&per_page=5`;
        const res = await fetch(url);

        if (!res.ok) {
          logger.warn({ source: this.name, status: res.status }, 'Pixabay API returned non-OK response');
          continue;
        }

        const data = (await res.json()) as any;
        const hits = data.hits || [];

        for (const hit of hits) {
          const videos = hit.videos || {};
          const mediumOrSmall = videos.medium || videos.small || videos.large;
          if (!mediumOrSmall?.url) continue;

          candidates.push({
            id: `pixabay_${hit.id}`,
            title: `${sport} action footage (Pixabay #${hit.id})`,
            url: mediumOrSmall.url,
            licenseType: 'PIXABAY',
            licenseProofUrl: hit.pageURL || 'https://pixabay.com/service/license-summary/',
            credit: `Video footage provided by Pixabay contributor: ${hit.user || 'Contributor'} via Pixabay`,
            publishedAt: new Date().toISOString(),
            sport: sport,
            duration: hit.duration || 20,
            sourceName: this.name,
            rawMetadata: {
              pixabayId: hit.id,
              user: hit.user,
              pageURL: hit.pageURL,
              license: 'Pixabay Content License (commercial use allowed)',
            },
          });
        }
      } catch (err: any) {
        logger.error({ source: this.name, sport, err: err.message }, 'Error fetching Pixabay videos');
      }
    }

    return this.filterCandidates(candidates);
  }
}
