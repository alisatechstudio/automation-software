import { describe, it, expect } from 'vitest';
import { YouTubePublisher } from '../src/publishers/youtube-publisher.js';
import { FacebookPublisher } from '../src/publishers/facebook-publisher.js';
import { withExponentialBackoff, QuotaExceededError } from '../src/publishers/backoff.js';
import type { ProcessedVideo } from '../src/types/index.js';

describe('Publishers & DRY_RUN Mode', () => {
  const dummyVideo: ProcessedVideo = {
    id: 'vid_test_dryrun_01',
    sourceClipId: 'clip_01',
    videoPath: './data/output/sample.mp4',
    thumbnailPath: './data/output/sample_thumb.jpg',
    duration: 30,
    title: 'Dry Run Sports Analysis',
    description: 'Dry run test description with footage credit',
    tags: ['Sports'],
    script: 'Sample script',
    containsSyntheticMedia: true,
    selfDeclaredMadeForKids: false,
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    complianceReport: {
      clipId: 'clip_01',
      passed: true,
      checks: [],
      summary: 'Passed',
      evaluatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };

  it('should cleanly simulate YouTube upload when isDryRun is true', async () => {
    const publisher = new YouTubePublisher({});
    const result = await publisher.publish({
      video: dummyVideo,
      isDryRun: true,
    });

    expect(result.status).toBe('SKIPPED_DRY_RUN');
    expect(result.target).toBe('YOUTUBE');
    expect(result.externalUrl).toContain('youtube.com/shorts');
  });

  it('should cleanly simulate Facebook Reel upload when isDryRun is true', async () => {
    const publisher = new FacebookPublisher({});
    const result = await publisher.publish({
      video: dummyVideo,
      isDryRun: true,
    });

    expect(result.status).toBe('SKIPPED_DRY_RUN');
    expect(result.target).toBe('FACEBOOK');
    expect(result.externalUrl).toContain('facebook.com/reel');
  });

  it('should retry transient errors with exponential backoff and detect quota exhaustion', async () => {
    let callCount = 0;
    const transientOp = async () => {
      callCount++;
      if (callCount < 2) {
        throw new Error('Temporary socket hang up');
      }
      return 'recovered';
    };

    const res = await withExponentialBackoff(transientOp, { maxRetries: 3, initialDelayMs: 10 });
    expect(res).toBe('recovered');
    expect(callCount).toBe(2);

    // Test quota exceeded detection
    const quotaOp = async () => {
      throw new Error('User has exceeded quotaExceeded limit for videos.insert');
    };

    await expect(withExponentialBackoff(quotaOp, { maxRetries: 3, initialDelayMs: 10 })).rejects.toThrow(
      QuotaExceededError
    );
  });
});
