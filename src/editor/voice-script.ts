import Anthropic from '@anthropic-ai/sdk';
import type { ClipMeta, EditGraphicCard } from '../types/index.js';
import { logger } from '../logger.js';

export interface ScriptGenerationResult {
  title: string;
  script: string;
  description: string;
  tags: string[];
  graphicsCards: EditGraphicCard[];
}

export class VoiceScriptGenerator {
  private anthropic?: Anthropic;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  public async generateScript(clip: ClipMeta, targetDurationSec = 30): Promise<ScriptGenerationResult> {
    if (this.anthropic) {
      try {
        const prompt = `You are a professional sports analyst producing an original, transformative short-form sports video (15-45 seconds).
The user is providing licensed sports footage of: "${clip.title}" (${clip.sport}).
To satisfy YouTube Partner Program and Facebook Content Monetization policies, raw reposting is strictly forbidden.
You must provide substantial original value: commentary on athletic mechanics, tactical breakdown, historical context, or statistics.

Return a JSON object ONLY with the following structure:
{
  "title": "Engaging, honest, non-clickbait title (max 70 chars)",
  "script": "Narration commentary explaining key technical details, stats, or breakdown (around 40-70 words for ~${targetDurationSec} seconds). Do not include stage directions.",
  "description": "Educational summary of the analysis, including sport context.",
  "tags": ["3 to 8 relevant sports tags"],
  "graphicsCards": [
    {
      "title": "KEY STAT or TACTICAL NOTE",
      "statOrFact": "Short prominent statistic or rule explanation",
      "subtitle": "Additional context line",
      "startTime": 2,
      "duration": 6
    },
    {
      "title": "ANALYST TAKEAWAY",
      "statOrFact": "Mechanics or history takeaway",
      "subtitle": "Closing insight",
      "startTime": 12,
      "duration": 6
    }
  ]
}`;

        const response = await this.anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);

        return {
          title: parsed.title || `${clip.sport} Analysis: ${clip.title}`,
          script: parsed.script,
          description: parsed.description,
          tags: parsed.tags || [clip.sport, 'SportsAnalysis', 'Athletics'],
          graphicsCards: parsed.graphicsCards || this.getDefaultGraphicsCards(clip),
        };
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Claude script generation failed, falling back to curated template.');
      }
    }

    // Curated high-value analytical fallback
    return this.generateFallbackScript(clip, targetDurationSec);
  }

  private generateFallbackScript(clip: ClipMeta, targetDurationSec: number): ScriptGenerationResult {
    const sport = clip.sport || 'Sports';
    const script = `In this ${sport} breakdown, notice the exact biomechanical execution and timing displayed right here. Achieving this level of precision requires intense core stabilization, kinetic chain transfer, and split-second reaction speed. When analyzed in slow motion, the technical consistency separates elite athletes from amateurs. That is what peak performance looks like.`;

    const description = `In-depth technical breakdown and analysis of ${sport} execution in "${clip.title}". Examining form, speed, and athletic mechanics.`;

    const tags = [sport, 'SportsScience', 'PerformanceAnalysis', 'Biomechanics', 'Shorts'];

    return {
      title: `${sport} Mechanics Breakdown: Form & Precision`,
      script,
      description,
      tags,
      graphicsCards: this.getDefaultGraphicsCards(clip),
    };
  }

  private getDefaultGraphicsCards(clip: ClipMeta): EditGraphicCard[] {
    return [
      {
        title: 'BIOMECHANICS ANALYSIS',
        statOrFact: 'Kinetic Chain Transfer & Core Stability',
        subtitle: 'Key technical phase during peak athletic execution',
        startTime: 2,
        duration: 8,
      },
      {
        title: 'PERFORMANCE INSIGHT',
        statOrFact: 'High-Velocity Reaction Timing',
        subtitle: 'Transformative educational sports review',
        startTime: 14,
        duration: 8,
      },
    ];
  }
}
