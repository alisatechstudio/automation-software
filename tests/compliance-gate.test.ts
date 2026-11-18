import { describe, it, expect, beforeEach } from 'vitest';
import { ComplianceGate } from '../src/compliance/gate.js';
import { DbRepository } from '../src/db/repository.js';
import type { LoadedConfig } from '../src/config/index.js';
import type { ClipMeta, OriginalityMetrics } from '../src/types/index.js';

describe('Compliance Gate Orchestrator Integration Tests (MongoDB Repository)', () => {
  let repo: DbRepository;
  let gate: ComplianceGate;
  let mockConfig: LoadedConfig;

  const validClip: ClipMeta = {
    id: 'clip_integration_001',
    title: 'Basketball Free Throw Mechanics Analysis',
    url: 'file:///path/to/valid_clip.mp4',
    licenseType: 'OWNED_PERMISSION',
    licenseProofUrl: 'file:///path/to/permission_agreement.pdf',
    credit: 'Footage provided with written permission by Coach Dave',
    publishedAt: new Date().toISOString(),
    sport: 'Basketball',
    duration: 30,
    sourceName: 'WatchedFolderSource',
  };

  const validMetrics: OriginalityMetrics = {
    totalDuration: 30,
    licensedFootageDuration: 15,
    licensedFootageRatio: 0.5,
    originalContentRatio: 0.5,
    hasOriginalVoiceover: true,
    hasOriginalGraphics: true,
    maxTextSimilarityToHistory: 0.1,
    minFrameDistanceToHistory: 40,
  };

  beforeEach(async () => {
    // Uses clean document repository store
    repo = new DbRepository();

    mockConfig = {
      isDryRun: true,
      env: {
        NODE_ENV: 'test',
        PORT: 3000,
        DRY_RUN: true,
        MONGODB_URI: 'mongodb://127.0.0.1:27017',
        MONGODB_DB_NAME: 'sports_clip_bot_test',
        DASHBOARD_ADMIN_USER: 'admin',
        DASHBOARD_ADMIN_PASSWORD: 'password',
        SESSION_SECRET: 'test-secret',
      },
      config: {
        app: {
          name: 'SportsClipBot',
          dataDir: './data',
          inboxDir: './data/inbox',
          musicDir: './data/music',
          outputDir: './data/output',
          tempDir: './data/temp',
        },
        originality: {
          maxLicensedFootageRatio: 0.6,
          minOriginalContentRatio: 0.4,
          maxTextSimilarityThreshold: 0.65,
          minFrameHammingDistance: 10,
          requireVoiceover: true,
          requireGraphics: true,
        },
        compliance: {
          dailyCapPerPlatform: 3,
          minDurationSec: 15,
          maxDurationSec: 45,
          requireCommercialLicense: true,
          blockNonCommercial: true,
          blocklist: ['espn', 'nba'],
        },
        sources: {} as any,
        editor: {} as any,
        publishing: {
          dryRun: true,
          youtube: { enabled: true, privacyStatus: 'public', defaultTags: [] },
          facebook: { enabled: true, defaultTags: [] },
        },
        monitoring: {
          pollIntervalMinutes: 30,
          autoPauseOnStrikeOrClaim: true,
          notifyAdminOnEvent: true,
        },
        approval: {
          mandatoryReview: true,
          telegramEnabled: true,
          dashboardEnabled: true,
        },
      },
    };

    gate = new ComplianceGate(repo, mockConfig);
    await repo.saveClip(validClip);
  });

  it('should PASS all 9 checks when video and metadata meet all monetization requirements', async () => {
    const report = await gate.evaluate({
      clip: validClip,
      width: 1080,
      height: 1920,
      duration: 30,
      title: 'Free Throw Arc & Release Mechanics',
      description: 'Educational sports analysis breakdown. Original footage licensed from Coach Dave. Altered or synthetic content: Sound or visuals were significantly edited or generated digitally.',
      tags: ['Basketball', 'ShootingMechanics', 'Shorts'],
      script: 'Observe the wrist flexion and consistent release point in this shot.',
      metrics: validMetrics,
      usesAiVoiceOrVisuals: true,
      containsSyntheticMedia: true,
      selfDeclaredMadeForKids: false,
      targetPlatform: 'YOUTUBE',
    });

    expect(report.passed).toBe(true);
    expect(report.checks).toHaveLength(9);
    expect(report.summary).toContain('All 9 compliance checks passed');

    // Verify database record
    const updatedClip = await repo.getClip(validClip.id);
    expect(updatedClip?.status).toBe('COMPLIANCE_PASSED');

    const savedReport = await repo.getComplianceReport(validClip.id);
    expect(savedReport?.passed).toBe(true);
  });

  it('should REJECT if format is horizontal (16:9) instead of vertical (9:16)', async () => {
    const report = await gate.evaluate({
      clip: validClip,
      width: 1920,
      height: 1080, // Horizontal!
      duration: 30,
      title: 'Free Throw Arc & Release Mechanics',
      description: 'Breakdown. Original footage licensed from Coach Dave. Altered or synthetic content included.',
      tags: ['Basketball'],
      script: 'Observe the wrist flexion.',
      metrics: validMetrics,
      usesAiVoiceOrVisuals: true,
      containsSyntheticMedia: true,
      selfDeclaredMadeForKids: false,
      targetPlatform: 'YOUTUBE',
    });

    expect(report.passed).toBe(false);
    const formatCheck = report.checks.find((c) => c.checkName === 'FORMAT');
    expect(formatCheck?.passed).toBe(false);
    expect(formatCheck?.reason).toContain('not 9:16 vertical');

    const updatedClip = await repo.getClip(validClip.id);
    expect(updatedClip?.status).toBe('COMPLIANCE_FAILED');
  });

  it('should REJECT if advertiser-friendliness check fails (e.g. gambling/betting promotion)', async () => {
    const report = await gate.evaluate({
      clip: validClip,
      width: 1080,
      height: 1920,
      duration: 30,
      title: 'Best 1XBET Gambling Betting Promo Odds for Basketball',
      description: 'Betting promotion. Altered or synthetic content included.',
      tags: ['Betting'],
      script: 'Use promo code on 1xbet for free betting coins.',
      metrics: validMetrics,
      usesAiVoiceOrVisuals: true,
      containsSyntheticMedia: true,
      selfDeclaredMadeForKids: false,
      targetPlatform: 'YOUTUBE',
    });

    expect(report.passed).toBe(false);
    const adCheck = report.checks.find((c) => c.checkName === 'ADVERTISER_FRIENDLINESS');
    expect(adCheck?.passed).toBe(false);
    expect(adCheck?.reason).toContain('Gambling Promotion');
  });

  it('should REJECT if platform daily posting volume cap is reached', async () => {
    // Record 3 published posts today for YouTube
    await repo.recordPublishResult('vid_1', { target: 'YOUTUBE', status: 'SUCCESS' });
    await repo.recordPublishResult('vid_2', { target: 'YOUTUBE', status: 'SUCCESS' });
    await repo.recordPublishResult('vid_3', { target: 'YOUTUBE', status: 'SUCCESS' });

    const report = await gate.evaluate({
      clip: validClip,
      width: 1080,
      height: 1920,
      duration: 30,
      title: 'Valid Title for Fourth Video',
      description: 'Valid description. Original footage licensed from Coach Dave. Altered or synthetic content.',
      tags: ['Basketball'],
      script: 'Valid script.',
      metrics: validMetrics,
      usesAiVoiceOrVisuals: true,
      containsSyntheticMedia: true,
      selfDeclaredMadeForKids: false,
      targetPlatform: 'YOUTUBE',
    });

    expect(report.passed).toBe(false);
    const volumeCheck = report.checks.find((c) => c.checkName === 'VOLUME');
    expect(volumeCheck?.passed).toBe(false);
    expect(volumeCheck?.reason).toContain('Daily posting cap reached for YOUTUBE');
  });
});
