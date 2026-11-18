import type { LoadedConfig } from '../config/index.js';
import type { ProcessedVideo, PublishResult } from '../types/index.js';
import type { DbRepository } from '../db/repository.js';
import { YouTubePublisher } from './youtube-publisher.js';
import { FacebookPublisher } from './facebook-publisher.js';
import { logger } from '../logger.js';

export class PublisherOrchestrator {
  private youtube?: YouTubePublisher;
  private facebook?: FacebookPublisher;
  private repo: DbRepository;
  private isDryRun: boolean;

  constructor(loaded: LoadedConfig, repo: DbRepository) {
    this.repo = repo;
    this.isDryRun = loaded.isDryRun;

    if (loaded.config.publishing.youtube.enabled) {
      this.youtube = new YouTubePublisher({
        clientId: loaded.env.YOUTUBE_CLIENT_ID,
        clientSecret: loaded.env.YOUTUBE_CLIENT_SECRET,
        refreshToken: loaded.env.YOUTUBE_REFRESH_TOKEN,
        defaultPrivacyStatus: loaded.config.publishing.youtube.privacyStatus,
      });
    }

    if (loaded.config.publishing.facebook.enabled) {
      this.facebook = new FacebookPublisher({
        pageId: loaded.env.FACEBOOK_PAGE_ID,
        pageAccessToken: loaded.env.FACEBOOK_PAGE_ACCESS_TOKEN,
      });
    }
  }

  public async publishVideo(video: ProcessedVideo): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

    // Verify pipeline is not paused
    const { isPaused, reason } = await this.repo.isPipelinePaused();
    if (isPaused) {
      logger.warn({ reason }, 'Pipeline is paused. Skipping publication.');
      return [];
    }

    // 1. YouTube
    if (this.youtube) {
      try {
        const res = await this.youtube.publish({
          video,
          isDryRun: this.isDryRun,
        });
        results.push(res);
        await this.repo.recordPublishResult(video.id, res);
      } catch (err: any) {
        logger.error({ platform: 'YOUTUBE', err: err.message }, 'Failed publishing to YouTube');
        const failRes: PublishResult = {
          target: 'YOUTUBE',
          status: 'FAILED',
          error: err.message,
        };
        results.push(failRes);
        await this.repo.recordPublishResult(video.id, failRes);
      }
    }

    // 2. Facebook
    if (this.facebook) {
      try {
        const res = await this.facebook.publish({
          video,
          isDryRun: this.isDryRun,
        });
        results.push(res);
        await this.repo.recordPublishResult(video.id, res);
      } catch (err: any) {
        logger.error({ platform: 'FACEBOOK', err: err.message }, 'Failed publishing to Facebook');
        const failRes: PublishResult = {
          target: 'FACEBOOK',
          status: 'FAILED',
          error: err.message,
        };
        results.push(failRes);
        await this.repo.recordPublishResult(video.id, failRes);
      }
    }

    return results;
  }
}

export * from './interface.js';
export * from './backoff.js';
export * from './youtube-publisher.js';
export * from './facebook-publisher.js';
