import { checkBlocklist } from './blocklist.js';
import type { ClipMeta, Source } from '../types/index.js';
import { logger } from '../logger.js';

export abstract class BaseSource implements Source {
  public abstract readonly name: string;
  protected blocklist: string[];
  protected licensedAgreements: string[];

  constructor(blocklist: string[] = [], licensedAgreements: string[] = []) {
    this.blocklist = blocklist;
    this.licensedAgreements = licensedAgreements;
  }

  public abstract fetchRecent(): Promise<ClipMeta[]>;

  /**
   * Evaluates a candidate clip against the hard blocklist and minimum sanity checks.
   * Clips that fail are rejected immediately at the ingestion boundary.
   */
  protected validateCandidate(clip: ClipMeta): { isValid: boolean; rejectReason?: string } {
    // 1. License Evidence Check
    if (!clip.licenseProofUrl || clip.licenseProofUrl.trim() === '') {
      return {
        isValid: false,
        rejectReason: `Clip "${clip.title}" rejected: missing required license proof URL/evidence.`,
      };
    }

    // 2. Reject Non-Commercial licenses immediately
    const licenseUpper = clip.licenseType.toUpperCase();
    if (licenseUpper.includes('NC') || licenseUpper.includes('NONCOMMERCIAL') || licenseUpper.includes('NON-COMMERCIAL')) {
      return {
        isValid: false,
        rejectReason: `Clip "${clip.title}" rejected: Non-commercial license "${clip.licenseType}" is not permitted for monetized content.`,
      };
    }

    // 3. Blocklist Check (Broadcasters, Leagues, Teams)
    const textToScan = `${clip.title} ${clip.credit} ${clip.sport} ${JSON.stringify(clip.rawMetadata || {})}`;
    const blockCheck = checkBlocklist(textToScan, this.blocklist, this.licensedAgreements);

    if (blockCheck.isBlocked) {
      return {
        isValid: false,
        rejectReason: blockCheck.reason,
      };
    }

    // 4. Duration Check (Must be >= 5 seconds to be viable)
    if (clip.duration > 0 && clip.duration < 5) {
      return {
        isValid: false,
        rejectReason: `Clip "${clip.title}" duration (${clip.duration}s) is too short (min 5s required).`,
      };
    }

    return { isValid: true };
  }

  protected filterCandidates(candidates: ClipMeta[]): ClipMeta[] {
    const passed: ClipMeta[] = [];

    for (const clip of candidates) {
      const validation = this.validateCandidate(clip);
      if (validation.isValid) {
        passed.push(clip);
      } else {
        logger.warn(
          { source: this.name, clipId: clip.id, title: clip.title, reason: validation.rejectReason },
          'Candidate clip rejected at ingestion boundary'
        );
      }
    }

    return passed;
  }
}
