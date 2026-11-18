import type { ComplianceCheckResult } from '../../types/index.js';

export interface MetadataCheckOptions {
  title: string;
  description: string;
  tags: string[];
  creditText: string;
}

export function runMetadataCheck(options: MetadataCheckOptions): ComplianceCheckResult {
  const evaluatedAt = new Date().toISOString();
  const { title, description, tags, creditText } = options;

  // 1. Title Checks: length and clickbait screening
  if (!title || title.trim().length < 5) {
    return {
      checkName: 'METADATA_HONESTY',
      passed: false,
      reason: 'Rejected: Title is missing or too short (minimum 5 characters).',
      evaluatedAt,
    };
  }

  if (title.length > 100) {
    return {
      checkName: 'METADATA_HONESTY',
      passed: false,
      reason: 'Rejected: Title exceeds 100 characters, risking truncation and spam flagging.',
      evaluatedAt,
    };
  }

  // Deceptive Clickbait patterns penalized by YouTube & Facebook
  const clickbaitRegex = /\b(you won't believe|will blow your mind|shocking secret|died today|gone wrong gone sexual|miracle cure|100% real no fake)\b/i;
  if (clickbaitRegex.test(title)) {
    return {
      checkName: 'METADATA_HONESTY',
      passed: false,
      reason: 'Rejected: Deceptive clickbait pattern detected in title. Violates YouTube Inauthentic Content and Facebook Clickbait policies.',
      evaluatedAt,
      details: { title },
    };
  }

  // Excessive uppercase check (e.g. "SHOCKING GOAL MUST WATCH NOW OMG")
  const letters = title.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 15) {
    const uppercaseCount = letters.split('').filter((c) => c === c.toUpperCase()).length;
    if (uppercaseCount / letters.length > 0.75) {
      return {
        checkName: 'METADATA_HONESTY',
        passed: false,
        reason: 'Rejected: Excessive capitalization in title (violates YouTube title style and spam policies).',
        evaluatedAt,
      };
    }
  }

  // 2. Tag Stuffing Check
  if (tags.length > 15) {
    return {
      checkName: 'METADATA_HONESTY',
      passed: false,
      reason: `Rejected: Tag stuffing detected (${tags.length} tags). Maximum permitted is 15 targeted tags to comply with YouTube Metadata policies.`,
      evaluatedAt,
      details: { tagCount: tags.length },
    };
  }

  // 3. Attribution in Description Check
  const descLower = description.toLowerCase();
  const hasFootageCredit =
    descLower.includes('footage') ||
    descLower.includes('licensed from') ||
    descLower.includes('credit') ||
    descLower.includes('source:');

  if (!hasFootageCredit && creditText.trim().length > 0) {
    return {
      checkName: 'METADATA_HONESTY',
      passed: false,
      reason: 'Rejected: Mandatory copyright attribution credit is missing from video description.',
      evaluatedAt,
    };
  }

  return {
    checkName: 'METADATA_HONESTY',
    passed: true,
    reason: 'Passed: Title is honest and accurate, tags adhere to anti-spam limits, and attribution credit is embedded in description.',
    evaluatedAt,
    details: { titleLength: title.length, tagCount: tags.length },
  };
}
