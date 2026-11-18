import type { ClipMeta, ComplianceCheckResult } from '../../types/index.js';

export const ALLOWED_COMMERCIAL_LICENSES = new Set([
  'OWNED_PERMISSION',
  'CC0',
  'CC_BY',
  'PEXELS',
  'PIXABAY',
  'LICENSED_PARTNER',
]);

export const DISALLOWED_NC_LICENSES = [
  'CC_BY_NC',
  'CC_BY_NC_SA',
  'CC_BY_NC_ND',
  'NC',
  'NON-COMMERCIAL',
  'NONCOMMERCIAL',
  'ALL_RIGHTS_RESERVED',
  'UNKNOWN',
];

export function runLicenseCheck(clip: ClipMeta): ComplianceCheckResult {
  const evaluatedAt = new Date().toISOString();
  const lic = (clip.licenseType || '').trim().toUpperCase();

  // 1. Evidence Check
  if (!clip.licenseProofUrl || clip.licenseProofUrl.trim() === '') {
    return {
      checkName: 'LICENSE',
      passed: false,
      reason: 'Rejected: No license evidence or permission proof URL on file.',
      evaluatedAt,
      details: { clipId: clip.id, licenseType: clip.licenseType },
    };
  }

  // 2. Reject Non-Commercial Licenses
  for (const nc of DISALLOWED_NC_LICENSES) {
    if (lic === nc || lic.includes('NC') || lic.includes('NON-COMMERCIAL') || lic.includes('NONCOMMERCIAL')) {
      return {
        checkName: 'LICENSE',
        passed: false,
        reason: `Rejected: License "${clip.licenseType}" prohibits commercial use (Non-Commercial / NC). Not eligible for YouTube Partner Program or Facebook Monetization.`,
        evaluatedAt,
        details: { clipId: clip.id, licenseType: clip.licenseType, disallowedMatch: nc },
      };
    }
  }

  // 3. Verify Allowed Commercial License
  if (!ALLOWED_COMMERCIAL_LICENSES.has(lic)) {
    return {
      checkName: 'LICENSE',
      passed: false,
      reason: `Rejected: Unrecognized or unverified license type "${clip.licenseType}". Must be one of: ${Array.from(ALLOWED_COMMERCIAL_LICENSES).join(', ')}.`,
      evaluatedAt,
      details: { clipId: clip.id, licenseType: clip.licenseType },
    };
  }

  // 4. Attribution Check
  if (!clip.credit || clip.credit.trim().length < 5) {
    return {
      checkName: 'LICENSE',
      passed: false,
      reason: 'Rejected: Insufficient attribution credit. Proper copyright holder attribution is mandatory.',
      evaluatedAt,
      details: { clipId: clip.id, credit: clip.credit },
    };
  }

  return {
    checkName: 'LICENSE',
    passed: true,
    reason: `Passed: Commercial license verified (${clip.licenseType}) with evidence on file and attribution ready.`,
    evaluatedAt,
    details: {
      licenseType: clip.licenseType,
      proofUrl: clip.licenseProofUrl,
      credit: clip.credit,
    },
  };
}
