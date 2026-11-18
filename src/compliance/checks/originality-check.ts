import type { ComplianceCheckResult, OriginalityMetrics } from '../../types/index.js';
import { calculateTextSimilarity, hammingDistanceHex } from '../perceptual-hash.js';

export interface OriginalityCheckOptions {
  metrics: OriginalityMetrics;
  candidateScript: string;
  candidatePerceptualHash?: string;
  historicalScripts: Array<{ id: string; script: string; title: string }>;
  historicalHashes: Array<{ id: string; perceptual_hash: string }>;
  maxLicensedRatio?: number; // default 0.60 (60%)
  maxTextSimilarityThreshold?: number; // default 0.65
  minHammingDistanceThreshold?: number; // default 10
}

export function runOriginalityCheck(options: OriginalityCheckOptions): ComplianceCheckResult {
  const evaluatedAt = new Date().toISOString();
  const maxLicensedRatio = options.maxLicensedRatio ?? 0.6;
  const maxTextSimilarity = options.maxTextSimilarityThreshold ?? 0.65;
  const minHammingDist = options.minHammingDistanceThreshold ?? 10;
  const { metrics, candidateScript, candidatePerceptualHash } = options;

  // 1. Ratio Check: licensed footage must be at most maxLicensedRatio (default 60%)
  if (metrics.licensedFootageRatio > maxLicensedRatio) {
    return {
      checkName: 'ORIGINALITY',
      passed: false,
      score: metrics.licensedFootageRatio,
      reason: `Rejected: Licensed footage ratio (${Math.round(metrics.licensedFootageRatio * 100)}%) exceeds allowed maximum (${Math.round(maxLicensedRatio * 100)}%). YouTube/Facebook reused content policy requires at least ${Math.round((1 - maxLicensedRatio) * 100)}% transformative original material.`,
      evaluatedAt,
      details: {
        licensedFootageDuration: metrics.licensedFootageDuration,
        totalDuration: metrics.totalDuration,
        licensedFootageRatio: metrics.licensedFootageRatio,
        maxAllowed: maxLicensedRatio,
      },
    };
  }

  // 2. Original Voiceover & Graphics Requirement
  if (!metrics.hasOriginalVoiceover) {
    return {
      checkName: 'ORIGINALITY',
      passed: false,
      reason: 'Rejected: Original narration/voiceover commentary is required to satisfy transformative value-add guidelines.',
      evaluatedAt,
    };
  }

  if (!metrics.hasOriginalGraphics) {
    return {
      checkName: 'ORIGINALITY',
      passed: false,
      reason: 'Rejected: Original on-screen graphics (stats cards, breakdown overlays, or explainer text) are required.',
      evaluatedAt,
    };
  }

  // 3. Text Uniqueness / Templated Duplicate Check
  let highestTextSim = 0;
  let matchingScriptId: string | undefined;

  for (const hist of options.historicalScripts) {
    const sim = calculateTextSimilarity(candidateScript, hist.script);
    if (sim > highestTextSim) {
      highestTextSim = sim;
      matchingScriptId = hist.id;
    }
  }

  if (highestTextSim > maxTextSimilarity) {
    return {
      checkName: 'ORIGINALITY',
      passed: false,
      score: highestTextSim,
      reason: `Rejected: Script is near-identical to previous video #${matchingScriptId} (${Math.round(highestTextSim * 100)}% text similarity, max allowed is ${Math.round(maxTextSimilarity * 100)}%). Repetitive templated scripts are penalized under YouTube Inauthentic Content policies.`,
      evaluatedAt,
      details: { highestSimilarity: highestTextSim, matchingId: matchingScriptId },
    };
  }

  // 4. Perceptual Visual Hash Uniqueness Check
  if (candidatePerceptualHash) {
    let lowestDistance = 64;
    let duplicateVideoId: string | undefined;

    for (const hist of options.historicalHashes) {
      if (!hist.perceptual_hash) continue;
      const dist = hammingDistanceHex(candidatePerceptualHash, hist.perceptual_hash);
      if (dist < lowestDistance) {
        lowestDistance = dist;
        duplicateVideoId = hist.id;
      }
    }

    if (lowestDistance < minHammingDist) {
      return {
        checkName: 'ORIGINALITY',
        passed: false,
        score: lowestDistance,
        reason: `Rejected: Visual perceptual hash is too close to previous video #${duplicateVideoId} (Hamming distance: ${lowestDistance}, minimum required: ${minHammingDist}). Duplicate or near-identical visuals violate platform uniqueness policies.`,
        evaluatedAt,
        details: { lowestDistance, duplicateVideoId },
      };
    }
  }

  return {
    checkName: 'ORIGINALITY',
    passed: true,
    score: metrics.originalContentRatio,
    reason: `Passed: Transformative value-add confirmed! Original content ratio: ${Math.round(metrics.originalContentRatio * 100)}%, original narration + graphics included, uniqueness verified against publishing history.`,
    evaluatedAt,
    details: {
      originalContentRatio: metrics.originalContentRatio,
      licensedFootageRatio: metrics.licensedFootageRatio,
      highestTextSimilarity: highestTextSim,
    },
  };
}
