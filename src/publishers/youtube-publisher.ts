import fs from 'node:fs';
import { google, type youtube_v3 } from 'googleapis';
import type { Publisher, PublishOptions } from './interface.js';
import type { PublishResult } from '../types/index.js';
import { withExponentialBackoff } from './backoff.js';
import { logger } from '../logger.js';

export interface YouTubePublisherConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  defaultPrivacyStatus?: 'private' | 'public' | 'unlisted';
}

export class YouTubePublisher implements Publisher {
  public readonly target = 'YOUTUBE' as const;
  private youtubeClient: youtube_v3.Youtube | null = null;
  private privacyStatus: 'private' | 'public' | 'unlisted';

  constructor(config: YouTubePublisherConfig) {
    this.privacyStatus = config.defaultPrivacyStatus || 'public';

    if (config.clientId && config.clientSecret && config.refreshToken) {
      const oauth2Client = new google.auth.OAuth2(config.clientId, config.clientSecret);
      oauth2Client.setCredentials({ refresh_token: config.refreshToken });
      this.youtubeClient = google.youtube({ version: 'v3', auth: oauth2Client });
    }
  }

  public async publish(options: PublishOptions): Promise<PublishResult> {
    const { video, isDryRun, scheduledPublishTime } = options;

    logger.info({ title: video.title, isDryRun }, '[YouTubePublisher] Preparing upload...');

    if (isDryRun) {
      logger.info({ title: video.title }, '[DRY_RUN] YouTube upload simulated successfully (no bytes uploaded).');
      return {
        target: 'YOUTUBE',
        status: 'SKIPPED_DRY_RUN',
        externalId: `dry_run_yt_${Date.now()}`,
        externalUrl: 'https://youtube.com/shorts/dry_run_preview',
        publishedAt: new Date().toISOString(),
      };
    }

    if (!this.youtubeClient) {
      throw new Error('YouTube API credentials (client ID, client secret, refresh token) are not configured.');
    }

    if (!fs.existsSync(video.videoPath)) {
      throw new Error(`Video file not found at ${video.videoPath}`);
    }

    const fileSize = fs.statSync(video.videoPath).size;

    return await withExponentialBackoff(
      async () => {
        const statusConfig: youtube_v3.Schema$VideoStatus = {
          privacyStatus: scheduledPublishTime ? 'private' : this.privacyStatus,
          selfDeclaredMadeForKids: false,
          containsSyntheticMedia: video.containsSyntheticMedia,
        };

        if (scheduledPublishTime) {
          statusConfig.publishAt = scheduledPublishTime.toISOString();
        }

        const res = await this.youtubeClient!.videos.insert({
          part: ['snippet', 'status'],
          requestBody: {
            snippet: {
              title: video.title.slice(0, 100),
              description: video.description,
              tags: video.tags.slice(0, 15),
              categoryId: '17', // Sports category ID
              defaultLanguage: 'en',
            },
            status: statusConfig,
          },
          media: {
            body: fs.createReadStream(video.videoPath),
          },
        });

        const videoId = res.data.id;
        if (!videoId) {
          throw new Error('YouTube did not return a valid video ID.');
        }

        // Set custom thumbnail if available
        if (video.thumbnailPath && fs.existsSync(video.thumbnailPath)) {
          try {
            await this.youtubeClient!.thumbnails.set({
              videoId,
              media: {
                body: fs.createReadStream(video.thumbnailPath),
              },
            });
            logger.info({ videoId }, 'Custom thumbnail uploaded to YouTube.');
          } catch (thumbErr: any) {
            logger.warn({ videoId, err: thumbErr.message }, 'Failed uploading custom thumbnail; continuing.');
          }
        }

        const externalUrl = `https://youtube.com/shorts/${videoId}`;
        logger.info({ videoId, externalUrl }, 'YouTube video published successfully!');

        return {
          target: 'YOUTUBE',
          status: 'SUCCESS',
          externalId: videoId,
          externalUrl,
          publishedAt: new Date().toISOString(),
        };
      },
      { platformName: 'YouTube' }
    );
  }
}
