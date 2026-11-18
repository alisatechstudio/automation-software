import type {
  ClipMeta,
  ComplianceCheckResult,
  ComplianceReport,
  OriginalityMetrics,
  PublishTarget,
} from '../types/index.js';
import type { DbRepository } from '../db/repository.js';
import type { LoadedConfig } from '../config/index.js';
import { runLicenseCheck } from './checks/license-check.js';
import { runMusicCheck } from './checks/music-check.js';
import { runWatermarkCheck } from './checks/watermark-check.js';
import { runOriginalityCheck } from './checks/originality-check.js';
import { runAdvertiserCheck } from './checks/advertiser-check.js';
import { runMetadataCheck } from './checks/metadata-check.js';
import { runDisclosureCheck } from './checks/disclosure-check.js';
import { runFormatCheck } from './checks/format-check.js';
import { runVolumeCheck } from './checks/volume-check.js';
import { logger } from '../logger.js';

export interface GateEvaluationInput {
  clip: ClipMeta;
  width: number;
  height: number;
  duration: number;
  title: string;
  description: string;
  tags: string[];
  script: string;
  perceptualHash?: string;
  metrics: OriginalityMetrics;
  musicFilePath?: string;
  sampleFrameBuffers?: Buffer[];
  usesAiVoiceOrVisuals: boolean;
  containsSyntheticMedia: boolean;
  selfDeclaredMadeForKids: boolean;
  targetPlatform?: PublishTarget;
}

export class ComplianceGate {
  private repo: DbRepository;
  private config: LoadedConfig;

  constructor(repo: DbRepository, config: LoadedConfig) {
    this.repo = repo;
    this.config = config;
  }

  public async evaluate(input: GateEvaluationInput): Promise<ComplianceReport> {
    const evaluatedAt = new Date().toISOString();
    const checks: ComplianceCheckResult[] = [];
    const { config, env } = this.config;

    logger.info({ clipId: input.clip.id, title: input.title }, 'Evaluating candidate through strict Compliance Gate...');

    // 1. License Check
    const licenseResult = runLicenseCheck(input.clip);
    checks.push(licenseResult);

    // 2. Music Check (Royalty-free & AcoustID match check)
    const musicResult = await runMusicCheck(input.musicFilePath, env.ACOUSTID_API_KEY);
    checks.push(musicResult);

    // 3. Watermark / Logo Detection Check
    const watermarkResult = await runWatermarkCheck({
      framePathsOrBuffers: input.sampleFrameBuffers,
    });
    checks.push(watermarkResult);

    // 4. Originality Check (Ratio <= 60% + Uniqueness against history)
    const historicalScripts = await this.repo.getAllHistoricalScripts();
    const historicalHashes = await this.repo.getAllHistoricalHashes();

    const originalityResult = runOriginalityCheck({
      metrics: input.metrics,
      candidateScript: input.script,
      candidatePerceptualHash: input.perceptualHash,
      historicalScripts,
      historicalHashes,
      maxLicensedRatio: config.originality.maxLicensedFootageRatio,
      maxTextSimilarityThreshold: config.originality.maxTextSimilarityThreshold,
      minHammingDistanceThreshold: config.originality.minFrameHammingDistance,
    });
    checks.push(originalityResult);

    // 5. Advertiser-Friendliness Check (Claude API screening)
    const advertiserResult = await runAdvertiserCheck({
      apiKey: env.ANTHROPIC_API_KEY,
      title: input.title,
      description: input.description,
      script: input.script,
    });
    checks.push(advertiserResult);

    // 6. Metadata Honesty Check
    const metadataResult = runMetadataCheck({
      title: input.title,
      description: input.description,
      tags: input.tags,
      creditText: input.clip.credit,
    });
    checks.push(metadataResult);

    // 7. Disclosure Check (Altered/Synthetic Media & COPPA)
    const disclosureResult = runDisclosureCheck({
      usesAiVoiceOrVisuals: input.usesAiVoiceOrVisuals,
      containsSyntheticMedia: input.containsSyntheticMedia,
      selfDeclaredMadeForKids: input.selfDeclaredMadeForKids,
      description: input.description,
    });
    checks.push(disclosureResult);

    // 8. Format Check (9:16 vertical, 15-45s duration)
    const formatResult = runFormatCheck({
      width: input.width,
      height: input.height,
      duration: input.duration,
      minDuration: config.compliance.minDurationSec,
      maxDuration: config.compliance.maxDurationSec,
    });
    checks.push(formatResult);

    // 9. Volume Check (Daily cap check for target platform)
    const platform = input.targetPlatform || 'YOUTUBE';
    const publishedToday = await this.repo.getCountPublishedToday(platform);
    const volumeResult = runVolumeCheck({
      platform,
      publishedTodayCount: publishedToday,
      dailyCap: config.compliance.dailyCapPerPlatform,
    });
    checks.push(volumeResult);

    // Aggregate Pass / Fail: ALL checks must pass!
    const failedChecks = checks.filter((c) => !c.passed);
    const passed = failedChecks.length === 0;

    let summary = '';
    if (passed) {
      summary = `All 9 compliance checks passed successfully! Video meets all YouTube and Facebook monetization guidelines.`;
    } else {
      const failureReasons = failedChecks.map((f) => `[${f.checkName}]: ${f.reason}`).join('; ');
      summary = `Compliance Gate REJECTED: ${failedChecks.length} check(s) failed: ${failureReasons}`;
    }

    const report: ComplianceReport = {
      clipId: input.clip.id,
      passed,
      checks,
      summary,
      evaluatedAt,
    };

    // Persist full report and checks in MongoDB
    await this.repo.saveComplianceReport(report);

    // Update clip status
    if (passed) {
      await this.repo.updateClipStatus(input.clip.id, 'COMPLIANCE_PASSED', summary);
      logger.info({ clipId: input.clip.id }, 'Compliance Gate PASSED for clip.');
    } else {
      await this.repo.updateClipStatus(input.clip.id, 'COMPLIANCE_FAILED', summary);
      logger.warn({ clipId: input.clip.id, failedChecks: failedChecks.map((f) => f.checkName) }, 'Compliance Gate REJECTED clip.');
    }

    return report;
  }
}

export * from './checks/license-check.js';
export * from './checks/music-check.js';
export * from './checks/watermark-check.js';
export * from './checks/originality-check.js';
export * from './checks/advertiser-check.js';
export * from './checks/metadata-check.js';
export * from './checks/disclosure-check.js';
export * from './checks/format-check.js';
export * from './checks/volume-check.js';
export * from './perceptual-hash.js';
export * from './acoustic-fingerprint.js';
