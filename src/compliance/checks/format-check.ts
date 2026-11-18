import type { ComplianceCheckResult } from '../../types/index.js';

export interface FormatCheckOptions {
  width: number;
  height: number;
  duration: number; // seconds
  minDuration?: number;
  maxDuration?: number;
}

export function runFormatCheck(options: FormatCheckOptions): ComplianceCheckResult {
  const evaluatedAt = new Date().toISOString();
  const { width, height, duration } = options;
  const minDuration = options.minDuration ?? 15;
  const maxDuration = options.maxDuration ?? 45;

  // 1. Duration check
  if (duration < minDuration) {
    return {
      checkName: 'FORMAT',
      passed: false,
      score: duration,
      reason: `Rejected: Video duration (${Math.round(duration)}s) is below minimum threshold (${minDuration}s) for engaging Short/Reel content.`,
      evaluatedAt,
      details: { duration, minDuration },
    };
  }

  if (duration > 60) {
    return {
      checkName: 'FORMAT',
      passed: false,
      score: duration,
      reason: `Rejected: Video duration (${Math.round(duration)}s) exceeds 60s maximum hard limit for YouTube Shorts and Instagram/Facebook vertical Reels.`,
      evaluatedAt,
      details: { duration, maxDuration: 60 },
    };
  }

  if (duration > maxDuration) {
    return {
      checkName: 'FORMAT',
      passed: false,
      score: duration,
      reason: `Rejected: Video duration (${Math.round(duration)}s) exceeds target configured maximum (${maxDuration}s).`,
      evaluatedAt,
      details: { duration, maxDuration },
    };
  }

  // 2. Aspect Ratio & Resolution Check (Must be 9:16 vertical, target 1080x1920)
  const ratio = width / height;
  const targetRatio = 9 / 16; // 0.5625

  if (Math.abs(ratio - targetRatio) > 0.05) {
    return {
      checkName: 'FORMAT',
      passed: false,
      reason: `Rejected: Video aspect ratio (${width}x${height}, ratio: ${ratio.toFixed(2)}) is not 9:16 vertical. Pillarboxed or horizontal videos are disqualified from Shorts/Reels feeds.`,
      evaluatedAt,
      details: { width, height, ratio, targetRatio },
    };
  }

  if (width < 720 || height < 1280) {
    return {
      checkName: 'FORMAT',
      passed: false,
      reason: `Rejected: Video resolution (${width}x${height}) is too low (minimum 720x1280 required, target 1080x1920). Low quality video will not be monetized.`,
      evaluatedAt,
      details: { width, height },
    };
  }

  return {
    checkName: 'FORMAT',
    passed: true,
    reason: `Passed: Video format is 100% compliant (9:16 vertical, ${width}x${height}, ${Math.round(duration)}s duration).`,
    evaluatedAt,
    details: { width, height, duration },
  };
}
