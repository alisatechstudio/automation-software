import { BaseSource } from './base.js';
import type { ClipMeta } from '../types/index.js';
import { logger } from '../logger.js';

export interface PexelsOptions {
  apiKey?: string;
  searchSports?: string[];
  blocklist?: string[];
  licensedAgreements?: string[];
}

export class PexelsSource extends BaseSource {
  public readonly name = 'PexelsSource';
  private apiKey?: string;
  private searchSports: string[];

  constructor(options: PexelsOptions) {
    super(options.blocklist, options.licensedAgreements);
    this.apiKey = options.apiKey;
    this.searchSports = options.searchSports || ['basketball', 'running', 'athletics', 'cycling'];
  }

  public async fetchRecent(): Promise<ClipMeta[]> {
    if (!this.apiKey) {
      logger.info({ source: this.name }, 'Pexels API key not provided. Skipping.');
      return [];
    }

    const candidates: ClipMeta[] = [];

    for (const sport of this.searchSports) {
      try {
        const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(sport)}&orientation=portrait&size=medium&per_page=5`;
        const res = await fetch(url, {
          headers: {
            Authorization: this.apiKey,
          },
        });

        if (!res.ok) {
          logger.warn({ source: this.name, status: res.status }, 'Pexels API returned non-OK response');
          continue;
        }

        const data = (await res.json()) as any;
        const videos = data.videos || [];

        for (const video of videos) {
          // Select suitable HD/SD MP4 file
          const files = video.video_files || [];
          const bestFile = files.find((f: any) => f.quality === 'hd' && f.file_type === 'video/mp4') || files[0];
          if (!bestFile) continue;

          candidates.push({
            id: `pexels_${video.id}`,
            title: `${sport} highlight clip (Pexels #${video.id})`,
            url: bestFile.link,
            licenseType: 'PEXELS',
            licenseProofUrl: video.url || 'https://www.pexels.com/license/',
            credit: `Video footage provided by Pexels creator: ${video.user?.name || 'Creator'} (${video.user?.url || 'https://www.pexels.com'})`,
            publishedAt: new Date().toISOString(),
            sport: sport,
            duration: video.duration || 20,
            sourceName: this.name,
            rawMetadata: {
              pexelsId: video.id,
              photographer: video.user?.name,
              photographerUrl: video.user?.url,
              license: 'Pexels Commercial License (Free to use, attribution appreciated)',
            },
          });
        }
      } catch (err: any) {
        logger.error({ source: this.name, sport, err: err.message }, 'Error fetching Pexels videos');
      }
    }

    return this.filterCandidates(candidates);
  }
}
