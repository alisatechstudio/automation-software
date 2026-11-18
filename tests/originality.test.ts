import { describe, it, expect } from 'vitest';
import { runOriginalityCheck } from '../src/compliance/checks/originality-check.js';
import type { OriginalityMetrics } from '../src/types/index.js';

describe('Compliance Gate: Originality & Transformative Value-Add Check', () => {
  const validMetrics: OriginalityMetrics = {
    totalDuration: 30,
    licensedFootageDuration: 15, // 50% licensed (< 60%)
    licensedFootageRatio: 0.5,
    originalContentRatio: 0.5,
    hasOriginalVoiceover: true,
    hasOriginalGraphics: true,
    maxTextSimilarityToHistory: 0.2,
    minFrameDistanceToHistory: 35,
  };

  const sampleScript = 'In this technical sprint breakdown, observe the ankle stiffness and ground reaction force during early acceleration.';

  it('should PASS when licensed footage is under 60% and transformative elements are present', () => {
    const result = runOriginalityCheck({
      metrics: validMetrics,
      candidateScript: sampleScript,
      historicalScripts: [],
      historicalHashes: [],
      maxLicensedRatio: 0.6,
    });

    expect(result.passed).toBe(true);
    expect(result.checkName).toBe('ORIGINALITY');
    expect(result.reason).toContain('Transformative value-add confirmed');
  });

  it('should REJECT when licensed footage exceeds 60% of total runtime', () => {
    const excessiveLicensedMetrics: OriginalityMetrics = {
      ...validMetrics,
      licensedFootageDuration: 24, // 80% licensed
      licensedFootageRatio: 0.8,
      originalContentRatio: 0.2,
    };

    const result = runOriginalityCheck({
      metrics: excessiveLicensedMetrics,
      candidateScript: sampleScript,
      historicalScripts: [],
      historicalHashes: [],
      maxLicensedRatio: 0.6,
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('exceeds allowed maximum (60%)');
  });

  it('should REJECT when original narration/voiceover is missing', () => {
    const noVoiceMetrics: OriginalityMetrics = {
      ...validMetrics,
      hasOriginalVoiceover: false,
    };

    const result = runOriginalityCheck({
      metrics: noVoiceMetrics,
      candidateScript: sampleScript,
      historicalScripts: [],
      historicalHashes: [],
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Original narration/voiceover commentary is required');
  });

  it('should REJECT when original graphics overlays are missing', () => {
    const noGraphicsMetrics: OriginalityMetrics = {
      ...validMetrics,
      hasOriginalGraphics: false,
    };

    const result = runOriginalityCheck({
      metrics: noGraphicsMetrics,
      candidateScript: sampleScript,
      historicalScripts: [],
      historicalHashes: [],
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Original on-screen graphics');
  });

  it('should REJECT when script is near-identical to a historical script (templated duplicate)', () => {
    const historicalScripts = [
      {
        id: 'hist_video_101',
        title: 'Sprint Analysis 1',
        script: sampleScript, // 100% match
      },
    ];

    const result = runOriginalityCheck({
      metrics: validMetrics,
      candidateScript: sampleScript,
      historicalScripts,
      historicalHashes: [],
      maxTextSimilarityThreshold: 0.65,
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Script is near-identical to previous video #hist_video_101');
  });

  it('should REJECT when candidate visual perceptual hash is too close to a previous video', () => {
    const candidateHash = 'f0f0f0f0f0f0f0f0';
    const nearIdenticalHash = 'f0f0f0f0f0f0f0f1'; // Hamming distance = 1 (< 10)

    const result = runOriginalityCheck({
      metrics: validMetrics,
      candidateScript: sampleScript,
      candidatePerceptualHash: candidateHash,
      historicalScripts: [],
      historicalHashes: [{ id: 'hist_video_202', perceptual_hash: nearIdenticalHash }],
      minHammingDistanceThreshold: 10,
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Visual perceptual hash is too close to previous video #hist_video_202');
  });
});
