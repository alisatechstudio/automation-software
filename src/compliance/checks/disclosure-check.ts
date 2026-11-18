import type { ComplianceCheckResult } from '../../types/index.js';

export interface DisclosureCheckOptions {
  usesAiVoiceOrVisuals: boolean;
  containsSyntheticMedia: boolean;
  selfDeclaredMadeForKids: boolean;
  description: string;
}

export function runDisclosureCheck(options: DisclosureCheckOptions): ComplianceCheckResult {
  const evaluatedAt = new Date().toISOString();
  const { usesAiVoiceOrVisuals, containsSyntheticMedia, selfDeclaredMadeForKids, description } = options;

  // 1. YouTube Synthetic Content Policy Compliance
  if (usesAiVoiceOrVisuals && !containsSyntheticMedia) {
    return {
      checkName: 'DISCLOSURE',
      passed: false,
      reason: 'Rejected: AI voice or digitally altered visuals are present, but containsSyntheticMedia flag is false. YouTube requires explicit disclosure of synthetic/altered media.',
      evaluatedAt,
    };
  }

  // 2. Synthetic content disclosure text in description
  if (usesAiVoiceOrVisuals) {
    const descLower = description.toLowerCase();
    const hasDisclosureNotice =
      descLower.includes('altered or synthetic') ||
      descLower.includes('synthetic media') ||
      descLower.includes('generated digitally') ||
      descLower.includes('ai voice');

    if (!hasDisclosureNotice) {
      return {
        checkName: 'DISCLOSURE',
        passed: false,
        reason: 'Rejected: Description is missing the mandatory disclosure notice for synthetic/AI-assisted commentary.',
        evaluatedAt,
      };
    }
  }

  // 3. Children's Online Privacy Protection Act (COPPA) check
  if (selfDeclaredMadeForKids === true) {
    return {
      checkName: 'DISCLOSURE',
      passed: false,
      reason: 'Rejected: General sports analysis is not targeted exclusively at children. Declaring madeForKids inappropriately disables comments and ad monetization.',
      evaluatedAt,
    };
  }

  return {
    checkName: 'DISCLOSURE',
    passed: true,
    reason: 'Passed: Disclosure flags are fully compliant with YouTube synthetic media policies and COPPA requirements.',
    evaluatedAt,
    details: {
      containsSyntheticMedia,
      selfDeclaredMadeForKids,
      usesAiVoiceOrVisuals,
    },
  };
}
