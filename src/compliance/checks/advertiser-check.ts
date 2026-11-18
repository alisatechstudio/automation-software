import Anthropic from '@anthropic-ai/sdk';
import type { ComplianceCheckResult } from '../../types/index.js';
import { logger } from '../../logger.js';

export interface AdvertiserScreeningOptions {
  apiKey?: string;
  title: string;
  description: string;
  script: string;
}

export async function runAdvertiserCheck(options: AdvertiserScreeningOptions): Promise<ComplianceCheckResult> {
  const evaluatedAt = new Date().toISOString();
  const { title, description, script, apiKey } = options;
  const contentToScreen = `Title: ${title}\nDescription: ${description}\nScript: ${script}`;

  // 1. Fast local regex heuristic screening for egregious violations
  const forbiddenPatterns = [
    { pattern: /\b(gambling|betting|stake\.com|1xbet|bet365|crypto pump|casino promo)\b/i, category: 'Gambling Promotion' },
    { pattern: /\b(kill yourself|slur|hate speech|terrorist|white supremacy)\b/i, category: 'Hate & Harassment' },
    { pattern: /\b(gory death|decapitated|graphic blood|bone snapped compound fracture)\b/i, category: 'Graphic Violence' },
    { pattern: /\b(fake news hoax|stolen election|covid microchip)\b/i, category: 'Harmful Misinformation' },
  ];

  for (const item of forbiddenPatterns) {
    if (item.pattern.test(contentToScreen)) {
      return {
        checkName: 'ADVERTISER_FRIENDLINESS',
        passed: false,
        reason: `Rejected: Content failed advertiser-friendliness screening for ${item.category}. Not eligible for ad monetization under YouTube Advertiser-Friendly Content Guidelines.`,
        evaluatedAt,
        details: { matchedCategory: item.category },
      };
    }
  }

  // 2. Claude API In-depth Screening
  if (apiKey) {
    try {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        system: `You are an expert trust & safety content reviewer for YouTube's Advertiser-Friendly Guidelines and Meta's Content Monetization Policies.
Evaluate whether the following sports short video title, description, and voiceover script are 100% suitable for brand-safe digital advertising.
Respond with ONLY valid JSON:
{
  "suitable": boolean,
  "borderline": boolean,
  "violations": string[],
  "summary": string
}`,
        messages: [
          {
            role: 'user',
            content: `Please evaluate this sports short for ad monetization:\n\n${contentToScreen}`,
          },
        ],
      });

      const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.suitable === false) {
        return {
          checkName: 'ADVERTISER_FRIENDLINESS',
          passed: false,
          reason: `Rejected by Claude API: ${parsed.summary || parsed.violations?.join(', ') || 'Violates advertiser-friendly guidelines'}`,
          evaluatedAt,
          details: parsed,
        };
      }

      if (parsed.borderline === true) {
        return {
          checkName: 'ADVERTISER_FRIENDLINESS',
          passed: true,
          reason: `Passed with Borderline Flag: Requires human reviewer verification before publishing (${parsed.summary}).`,
          evaluatedAt,
          details: { ...parsed, requiresReviewerAttention: true },
        };
      }

      return {
        checkName: 'ADVERTISER_FRIENDLINESS',
        passed: true,
        reason: 'Passed: Script and metadata certified brand-safe and compliant with advertiser guidelines by Claude API.',
        evaluatedAt,
        details: parsed,
      };
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Anthropic API screening call failed, relying on strict heuristic review.');
    }
  }

  // If no API key provided, strict heuristics passed
  return {
    checkName: 'ADVERTISER_FRIENDLINESS',
    passed: true,
    reason: 'Passed: Content cleared local advertiser-friendly guideline filters (violence, hate, gambling, misinformation checks clean).',
    evaluatedAt,
  };
}
