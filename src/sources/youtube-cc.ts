import { google, type youtube_v3 } from 'googleapis';
import { BaseSource } from './base.js';
import type { ClipMeta } from '../types/index.js';
import { logger } from '../logger.js';

export interface YouTubeCCOptions {
  apiKey?: string;
  queries: string[];
  maxResults?: number;
  blocklist?: string[];
  licensedAgreements?: string[];
}

export class YouTubeCCSource extends BaseSource {
  public readonly name = 'YouTubeCCSource';
  private youtube: youtube_v3.Youtube | null = null;
  private queries: string[];
  private maxResults: number;

  constructor(options: YouTubeCCOptions) {
    super(options.blocklist, options.licensedAgreements);
    this.queries = options.queries.length > 0 ? options.queries : ['amateur skate tricks creative commons', 'workout fitness cc-by'];
    this.maxResults = options.maxResults || 5;

    if (options.apiKey) {
      this.youtube = google.youtube({ version: 'v3', auth: options.apiKey });
    }
  }

  public async fetchRecent(): Promise<ClipMeta[]> {
    if (!this.youtube) {
      logger.info({ source: this.name }, 'YouTube API client not initialized (missing API key). Skipping.');
      return [];
    }

    const candidates: ClipMeta[] = [];

    for (const query of this.queries) {
      try {
        const searchRes = await this.youtube.search.list({
          part: ['snippet'],
          q: query,
          videoLicense: 'creativeCommon', // Strictly CC only
          type: ['video'],
          videoDuration: 'short', // Shorts / under 4 minutes
          maxResults: this.maxResults,
        });

        const items = searchRes.data.items || [];
        for (const item of items) {
          const videoId = item.id?.videoId;
          if (!videoId) continue;

          const snippet = item.snippet;
          if (!snippet) continue;

          const title = snippet.title || 'Creative Commons Sports Clip';
          const channelTitle = snippet.channelTitle || 'Unknown Creator';
          const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

          candidates.push({
            id: `yt_cc_${videoId}`,
            title,
            url: videoUrl,
            licenseType: 'CC_BY',
            licenseProofUrl: videoUrl, // YouTube CC metadata verifiable on watch page
            credit: `Original footage: "${title}" by ${channelTitle} (Licensed under Creative Commons Attribution CC-BY)`,
            publishedAt: snippet.publishedAt || new Date().toISOString(),
            sport: 'Sports',
            duration: 30, // approximate for shorts, refined during download/probe
            sourceName: this.name,
            rawMetadata: {
              videoId,
              channelTitle,
              channelId: snippet.channelId,
              description: snippet.description,
            },
          });
        }
      } catch (err: any) {
        logger.error({ source: this.name, query, err: err.message }, 'Failed to fetch YouTube CC videos');
      }
    }

    return this.filterCandidates(candidates);
  }
}
