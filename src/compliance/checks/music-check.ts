import fs from 'node:fs';
import type { ComplianceCheckResult } from '../../types/index.js';
import { verifyMusicTrack } from '../acoustic-fingerprint.js';

export async function runMusicCheck(
  musicFilePath?: string,
  acoustIdApiKey?: string
): Promise<ComplianceCheckResult> {
  const evaluatedAt = new Date().toISOString();

  // If no background music is used, it automatically passes
  if (!musicFilePath) {
    return {
      checkName: 'MUSIC',
      passed: true,
      reason: 'Passed: No external background music track attached (voiceover only).',
      evaluatedAt,
    };
  }

  if (!fs.existsSync(musicFilePath)) {
    return {
      checkName: 'MUSIC',
      passed: false,
      reason: `Rejected: Specified background music track does not exist at ${musicFilePath}`,
      evaluatedAt,
      details: { musicFilePath },
    };
  }

  const matchResult = await verifyMusicTrack(musicFilePath, acoustIdApiKey);

  if (matchResult.hasCommercialMatch) {
    return {
      checkName: 'MUSIC',
      passed: false,
      reason: `Rejected: Commercial copyright match detected! Track matches "${matchResult.matchTitle}" by "${matchResult.matchArtist}" on AcoustID. Only 100% royalty-free or owned music is allowed.`,
      evaluatedAt,
      details: {
        musicFilePath,
        matchTitle: matchResult.matchTitle,
        matchArtist: matchResult.matchArtist,
        score: matchResult.acoustidScore,
      },
    };
  }

  return {
    checkName: 'MUSIC',
    passed: true,
    reason: `Passed: Music track verified as royalty-free. ${matchResult.notes}`,
    evaluatedAt,
    details: {
      musicFilePath,
      fingerprinted: matchResult.fingerprinted,
    },
  };
}
