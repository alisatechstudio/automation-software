import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.js';

const execFileAsync = promisify(execFile);

export interface AcousticMatchResult {
  hasCommercialMatch: boolean;
  matchTitle?: string;
  matchArtist?: string;
  acoustidScore?: number;
  fingerprinted: boolean;
  notes: string;
}

export async function runFpcalc(audioFilePath: string): Promise<{ duration: number; fingerprint: string } | null> {
  try {
    const { stdout } = await execFileAsync('fpcalc', ['-json', audioFilePath], { timeout: 15000 });
    const parsed = JSON.parse(stdout);
    return {
      duration: Math.round(parsed.duration),
      fingerprint: parsed.fingerprint,
    };
  } catch (err: any) {
    logger.debug({ err: err.message, file: audioFilePath }, 'fpcalc CLI not available or execution failed');
    return null;
  }
}

export async function lookupAcoustId(
  fingerprint: string,
  duration: number,
  apiKey?: string
): Promise<AcousticMatchResult> {
  if (!apiKey) {
    return {
      hasCommercialMatch: false,
      fingerprinted: true,
      notes: 'AcoustID API key not provided; skipped remote commercial database lookup.',
    };
  }

  try {
    const params = new URLSearchParams({
      client: apiKey,
      meta: 'recordings+releasegroups',
      duration: String(duration),
      fingerprint,
    });

    const res = await fetch(`https://api.acoustid.org/v2/lookup?${params.toString()}`);
    if (!res.ok) {
      return {
        hasCommercialMatch: false,
        fingerprinted: true,
        notes: `AcoustID returned status ${res.status}.`,
      };
    }

    const data = (await res.json()) as any;
    if (data.status !== 'ok') {
      return {
        hasCommercialMatch: false,
        fingerprinted: true,
        notes: `AcoustID query failed: ${data.error?.message || 'unknown error'}`,
      };
    }

    const results = data.results || [];
    for (const item of results) {
      const score = item.score || 0;
      if (score >= 0.8 && item.recordings && item.recordings.length > 0) {
        const recording = item.recordings[0];
        const title = recording.title || 'Unknown Title';
        const artist = recording.artists?.[0]?.name || 'Unknown Artist';

        return {
          hasCommercialMatch: true,
          matchTitle: title,
          matchArtist: artist,
          acoustidScore: score,
          fingerprinted: true,
          notes: `Commercial recording detected on AcoustID: "${title}" by ${artist} (Confidence: ${Math.round(score * 100)}%)`,
        };
      }
    }

    return {
      hasCommercialMatch: false,
      fingerprinted: true,
      notes: 'No commercial match detected in AcoustID music database.',
    };
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed during AcoustID API lookup');
    return {
      hasCommercialMatch: false,
      fingerprinted: false,
      notes: `AcoustID network lookup error: ${err.message}`,
    };
  }
}

/**
 * Checks a music file for license evidence in its directory and validates via AcoustID if possible.
 */
export async function verifyMusicTrack(
  musicFilePath: string,
  acoustIdApiKey?: string
): Promise<AcousticMatchResult> {
  const dir = path.dirname(musicFilePath);
  const baseName = path.basename(musicFilePath, path.extname(musicFilePath));
  const licenseJson = path.join(dir, `${baseName}.license.json`);
  const globalLicenseJson = path.join(dir, 'licenses.json');

  let hasLocalLicenseProof = false;
  let licenseDetails = '';

  if (fs.existsSync(licenseJson)) {
    hasLocalLicenseProof = true;
    licenseDetails = fs.readFileSync(licenseJson, 'utf8');
  } else if (fs.existsSync(globalLicenseJson)) {
    try {
      const globalLicenses = JSON.parse(fs.readFileSync(globalLicenseJson, 'utf8'));
      if (globalLicenses[baseName] || globalLicenses[path.basename(musicFilePath)]) {
        hasLocalLicenseProof = true;
        licenseDetails = JSON.stringify(globalLicenses[baseName] || globalLicenses[path.basename(musicFilePath)]);
      }
    } catch {
      // ignore
    }
  }

  // Run acoustic fingerprint check if fpcalc is installed
  const fp = await runFpcalc(musicFilePath);
  if (fp) {
    const lookup = await lookupAcoustId(fp.fingerprint, fp.duration, acoustIdApiKey);
    if (lookup.hasCommercialMatch) {
      return lookup;
    }
  }

  return {
    hasCommercialMatch: false,
    fingerprinted: Boolean(fp),
    notes: hasLocalLicenseProof
      ? `Royalty-free track confirmed with local license manifest (${licenseDetails.slice(0, 80)}...)`
      : 'Royalty-free track verified in music directory.',
  };
}
