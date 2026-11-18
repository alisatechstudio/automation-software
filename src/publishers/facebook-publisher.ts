import fs from 'node:fs';
import type { Publisher, PublishOptions } from './interface.js';
import type { PublishResult } from '../types/index.js';
import { withExponentialBackoff } from './backoff.js';
import { logger } from '../logger.js';

export interface FacebookPublisherConfig {
  pageId?: string;
  pageAccessToken?: string;
  apiVersion?: string;
}

export class FacebookPublisher implements Publisher {
  public readonly target = 'FACEBOOK' as const;
  private pageId?: string;
  private pageAccessToken?: string;
  private apiVersion: string;

  constructor(config: FacebookPublisherConfig) {
    this.pageId = config.pageId;
    this.pageAccessToken = config.pageAccessToken;
    this.apiVersion = config.apiVersion || 'v21.0';
  }

  public async publish(options: PublishOptions): Promise<PublishResult> {
    const { video, isDryRun } = options;

    logger.info({ title: video.title, isDryRun }, '[FacebookPublisher] Preparing Reel publication...');

    if (isDryRun) {
      logger.info({ title: video.title }, '[DRY_RUN] Facebook Reel upload simulated successfully.');
      return {
        target: 'FACEBOOK',
        status: 'SKIPPED_DRY_RUN',
        externalId: `dry_run_fb_${Date.now()}`,
        externalUrl: 'https://facebook.com/reel/dry_run_preview',
        publishedAt: new Date().toISOString(),
      };
    }

    if (!this.pageId || !this.pageAccessToken) {
      throw new Error('Facebook Page ID and Page Access Token must be configured.');
    }

    if (!fs.existsSync(video.videoPath)) {
      throw new Error(`Video file not found at ${video.videoPath}`);
    }

    const fileBuffer = fs.readFileSync(video.videoPath);
    const fileSize = fileBuffer.length;

    return await withExponentialBackoff(
      async () => {
        // --- Phase 1: Start upload session ---
        logger.info({ pageId: this.pageId }, 'Phase 1: Starting Facebook video_reels session...');
        const initUrl = `https://graph.facebook.com/${this.apiVersion}/${this.pageId}/video_reels`;
        const initRes = await fetch(initUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            upload_phase: 'start',
            access_token: this.pageAccessToken,
          }),
        });

        const initData = (await initRes.json()) as any;
        if (!initRes.ok || initData.error || !initData.video_id) {
          throw new Error(`video_reels start failed: ${initData.error?.message || 'unknown error'}`);
        }

        const videoId = initData.video_id;
        const uploadUrl = initData.upload_url || `https://rupload.facebook.com/video-upload/${this.apiVersion}/${videoId}`;

        // --- Phase 2: Transfer binary chunk ---
        logger.info({ videoId, bytes: fileSize }, 'Phase 2: Transferring video binary...');
        const transferRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `OAuth ${this.pageAccessToken}`,
            offset: '0',
            file_size: String(fileSize),
            'Content-Type': 'application/octet-stream',
          },
          body: fileBuffer,
        });

        const transferData = (await transferRes.json()) as any;
        if (!transferRes.ok || transferData.error) {
          throw new Error(`video_reels transfer failed: ${transferData.error?.message || 'unknown error'}`);
        }

        // --- Phase 3: Finish Reel Publication ---
        logger.info({ videoId }, 'Phase 3: Finalizing Facebook Reel publication...');
        const finishRes = await fetch(initUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            upload_phase: 'finish',
            video_id: videoId,
            video_state: 'PUBLISHED',
            description: `${video.title}\n\n${video.description}`,
            access_token: this.pageAccessToken,
          }),
        });

        const finishData = (await finishRes.json()) as any;
        if (!finishRes.ok || finishData.error) {
          throw new Error(`video_reels finish failed: ${finishData.error?.message || 'unknown error'}`);
        }

        // --- Phase 4: Status Polling ---
        await this.pollVideoStatus(videoId);

        const externalUrl = `https://www.facebook.com/reel/${videoId}`;
        logger.info({ videoId, externalUrl }, 'Facebook Reel successfully published!');

        return {
          target: 'FACEBOOK',
          status: 'SUCCESS',
          externalId: videoId,
          externalUrl,
          publishedAt: new Date().toISOString(),
        };
      },
      { platformName: 'Facebook' }
    );
  }

  private async pollVideoStatus(videoId: string, maxAttempts = 6, intervalMs = 2000): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const url = `https://graph.facebook.com/${this.apiVersion}/${videoId}?fields=status&access_token=${this.pageAccessToken}`;
        const res = await fetch(url);
        const data = (await res.json()) as any;

        const videoStatus = data.status?.video_status;
        logger.debug({ videoId, attempt, videoStatus }, 'Polled Facebook video processing status');

        if (videoStatus === 'ready' || videoStatus === 'processing_complete') {
          return;
        }
        if (videoStatus === 'error') {
          throw new Error(`Facebook reported processing error for video ${videoId}`);
        }
      } catch (err: any) {
        if (err.message.includes('processing error')) throw err;
      }
      await new Promise((res) => setTimeout(res, intervalMs));
    }
  }
}
