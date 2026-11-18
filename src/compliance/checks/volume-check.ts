import type { ComplianceCheckResult, PublishTarget } from '../../types/index.js';

export interface VolumeCheckOptions {
  platform: PublishTarget;
  publishedTodayCount: number;
  dailyCap?: number;
}

export function runVolumeCheck(options: VolumeCheckOptions): ComplianceCheckResult {
  const evaluatedAt = new Date().toISOString();
  const { platform, publishedTodayCount } = options;
  const dailyCap = options.dailyCap ?? 3;

  if (publishedTodayCount >= dailyCap) {
    return {
      checkName: 'VOLUME',
      passed: false,
      score: publishedTodayCount,
      reason: `Rejected: Daily posting cap reached for ${platform} (${publishedTodayCount}/${dailyCap} posts today). Throttled to maintain quality signals and prevent spam penalties under platform rate limit guidelines.`,
      evaluatedAt,
      details: { platform, publishedTodayCount, dailyCap },
    };
  }

  return {
    checkName: 'VOLUME',
    passed: true,
    score: publishedTodayCount,
    reason: `Passed: Daily posting volume within safe threshold (${publishedTodayCount}/${dailyCap} posts today for ${platform}).`,
    evaluatedAt,
    details: { platform, publishedTodayCount, dailyCap },
  };
}
