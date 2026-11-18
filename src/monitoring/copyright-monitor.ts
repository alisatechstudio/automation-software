import crypto from 'node:crypto';
import { google, type youtube_v3 } from 'googleapis';
import type { DbRepository } from '../db/repository.js';
import type { LoadedConfig } from '../config/index.js';
import type { MonitoringEvent } from '../types/index.js';
import { logger } from '../logger.js';

export class CopyrightMonitor {
  private repo: DbRepository;
  private config: LoadedConfig;
  private youtube?: youtube_v3.Youtube;

  constructor(repo: DbRepository, config: LoadedConfig) {
    this.repo = repo;
    this.config = config;

    const { env } = config;
    if (env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET && env.YOUTUBE_REFRESH_TOKEN) {
      const oauth2Client = new google.auth.OAuth2(env.YOUTUBE_CLIENT_ID, env.YOUTUBE_CLIENT_SECRET);
      oauth2Client.setCredentials({ refresh_token: env.YOUTUBE_REFRESH_TOKEN });
      this.youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    }
  }

  /**
   * Polls YouTube and Facebook for copyright claims, Content ID matches, or policy strikes.
   */
  public async pollPublishedPosts(): Promise<MonitoringEvent[]> {
    const published = await this.repo.getPublishedPosts(30);
    const events: MonitoringEvent[] = [];

    for (const post of published) {
      if (post.status !== 'SUCCESS' || !post.external_id) continue;

      if (post.platform === 'YOUTUBE' && this.youtube) {
        const event = await this.checkYouTubeVideo(post.external_id);
        if (event) events.push(event);
      } else if (post.platform === 'FACEBOOK') {
        const event = await this.checkFacebookVideo(post.external_id);
        if (event) events.push(event);
      }
    }

    return events;
  }

  private async checkYouTubeVideo(videoId: string): Promise<MonitoringEvent | null> {
    try {
      const res = await this.youtube!.videos.list({
        part: ['status', 'contentDetails'],
        id: [videoId],
      });

      const item = res.data.items?.[0];
      if (!item) return null;

      const rejectionReason = item.status?.rejectionReason;
      if (rejectionReason) {
        const event: MonitoringEvent = {
          id: crypto.randomUUID(),
          platform: 'YOUTUBE',
          externalId: videoId,
          eventType: 'STRIKE',
          details: `YouTube video rejected/flagged: ${rejectionReason}`,
          severity: 'CRITICAL',
          detectedAt: new Date().toISOString(),
        };

        this.handleCriticalEvent(event);
        return event;
      }

      // Check Content ID or restriction indicators
      const contentDetails = item.contentDetails;
      if (contentDetails?.regionRestriction?.blocked?.length) {
        const event: MonitoringEvent = {
          id: crypto.randomUUID(),
          platform: 'YOUTUBE',
          externalId: videoId,
          eventType: 'CONTENT_ID_MATCH',
          details: `Regional restriction active on video: blocked in ${contentDetails.regionRestriction.blocked.join(', ')}`,
          severity: 'WARNING',
          detectedAt: new Date().toISOString(),
        };

        this.handleCriticalEvent(event);
        return event;
      }
    } catch (err: any) {
      logger.error({ videoId, err: err.message }, 'Failed checking YouTube video status in CopyrightMonitor');
    }

    return null;
  }

  private async checkFacebookVideo(videoId: string): Promise<MonitoringEvent | null> {
    const { env } = this.config;
    if (!env.FACEBOOK_PAGE_ACCESS_TOKEN) return null;

    try {
      const url = `https://graph.facebook.com/v21.0/${videoId}?fields=copyright_monitoring_status,status&access_token=${env.FACEBOOK_PAGE_ACCESS_TOKEN}`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const data = (await res.json()) as any;
      const copyrightStatus = data.copyright_monitoring_status;

      if (copyrightStatus && copyrightStatus !== 'matching_completed_no_match') {
        const event: MonitoringEvent = {
          id: crypto.randomUUID(),
          platform: 'FACEBOOK',
          externalId: videoId,
          eventType: 'COPYRIGHT_CLAIM',
          details: `Facebook copyright monitoring status: ${JSON.stringify(copyrightStatus)}`,
          severity: 'CRITICAL',
          detectedAt: new Date().toISOString(),
        };

        this.handleCriticalEvent(event);
        return event;
      }
    } catch (err: any) {
      logger.error({ videoId, err: err.message }, 'Failed checking Facebook video status in CopyrightMonitor');
    }

    return null;
  }

  private async handleCriticalEvent(event: MonitoringEvent): Promise<void> {
    logger.warn({ event }, 'CRITICAL MONITORING EVENT DETECTED!');
    await this.repo.recordMonitoringEvent(event);

    if (this.config.config.monitoring.autoPauseOnStrikeOrClaim) {
      await this.repo.setPipelinePaused(true, `Emergency pipeline shutdown triggered by ${event.platform} ${event.eventType}: ${event.details}`);
      logger.error('EMERGENCY: Automation pipeline has been PAUSED to prevent account strikes.');
    }
  }
}
