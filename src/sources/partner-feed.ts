import { BaseSource } from './base.js';
import type { ClipMeta } from '../types/index.js';
import { logger } from '../logger.js';

export interface PartnerFeedConfig {
  name: string;
  url: string;
  licenseType: 'LICENSED_PARTNER';
  licenseTerms: string;
  agreementId: string;
}

export interface PartnerFeedOptions {
  feeds: PartnerFeedConfig[];
  blocklist?: string[];
}

export class PartnerFeedSource extends BaseSource {
  public readonly name = 'PartnerFeedSource';
  private feeds: PartnerFeedConfig[];

  constructor(options: PartnerFeedOptions) {
    const agreementNames = options.feeds.map((f) => f.name);
    super(options.blocklist, agreementNames);
    this.feeds = options.feeds;
  }

  public async fetchRecent(): Promise<ClipMeta[]> {
    const candidates: ClipMeta[] = [];

    for (const feed of this.feeds) {
      try {
        const res = await fetch(feed.url, { headers: { 'User-Agent': 'SportsClipBot/1.0' } });
        if (!res.ok) {
          logger.warn({ feed: feed.name, status: res.status }, 'Failed to fetch partner feed');
          continue;
        }

        const data = (await res.json()) as any;
        const items = Array.isArray(data) ? data : data.items || data.clips || [];

        for (const item of items) {
          if (!item.url && !item.videoUrl) continue;

          candidates.push({
            id: `partner_${feed.agreementId}_${item.id || item.title || Date.now()}`,
            title: item.title || `Licensed footage from ${feed.name}`,
            url: item.videoUrl || item.url,
            licenseType: 'LICENSED_PARTNER',
            licenseProofUrl: `partner-agreement://${feed.agreementId}`,
            credit: `Footage licensed from ${feed.name} under Agreement #${feed.agreementId}`,
            publishedAt: item.publishedAt || new Date().toISOString(),
            sport: item.sport || 'Sports',
            duration: item.duration || 30,
            sourceName: this.name,
            rawMetadata: {
              partnerName: feed.name,
              agreementId: feed.agreementId,
              licenseTerms: feed.licenseTerms,
              feedUrl: feed.url,
            },
          });
        }
      } catch (err: any) {
        logger.error({ feed: feed.name, err: err.message }, 'Error ingesting from partner feed');
      }
    }

    return this.filterCandidates(candidates);
  }
}
