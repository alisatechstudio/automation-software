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
    const sport = clip.sport || 'Athletics';
    const cleanTitle = clip.title.slice(0, 45);

    const scriptTemplates = [
      {
        title: `${sport} Biomechanics: Kinetic Chain & Power`,
        script: `In this ${sport} breakdown of "${cleanTitle}", study how the kinetic chain delivers maximum explosive force. Force production originates from the lower body drive, transfers through the stabilized core, and culminates in a flawless terminal release. Slow-motion analysis reveals why micro-adjustments in balance make all the difference at high velocity.`,
        description: `Biomechanical analysis and kinetic chain breakdown of ${sport} form in "${clip.title}". Examining force production, posture, and technical discipline.`,
        tags: [sport, 'Biomechanics', 'SportsScience', 'KineticChain', 'AthleticPerformance'],
        cards: [
          { title: 'KINETIC TRANSFER', statOrFact: 'Lower-Body Force to Core', subtitle: 'Optimal rotational power sequencing', startTime: 2, duration: 8 },
          { title: 'TECHNICAL FOCUS', statOrFact: 'Balance & Center of Mass', subtitle: 'Micro-adjustments at terminal velocity', startTime: 12, duration: 8 },
        ],
      },
      {
        title: `${sport} Mastery: Tactical Timing & Execution`,
        script: `Observing elite ${sport} competition highlights how crucial split-second anticipation is. Watch how the athlete positions their center of gravity right before committing to the movement in "${cleanTitle}". This tactical patience forces opponents out of position and opens up prime scoring lanes. That level of spatial awareness takes thousands of hours to master.`,
        description: `Tactical breakdown and spatial analysis of ${sport} execution in "${clip.title}". Exploring defensive anticipation, timing, and positional strategy.`,
        tags: [sport, 'TacticalAnalysis', 'SportsStrategy', 'Anticipation', 'ProAthletics'],
        cards: [
          { title: 'SPATIAL AWARENESS', statOrFact: 'Anticipation & Deceleration', subtitle: 'Creating positional advantage', startTime: 2, duration: 8 },
          { title: 'TACTICAL DISCIPLINE', statOrFact: 'Center of Gravity Control', subtitle: 'Patience before explosive commitment', startTime: 12, duration: 8 },
        ],
      },
      {
        title: `${sport} Technical Breakdown: Footwork & Leverage`,
        script: `Analyzing the athletic mechanics here in ${sport}: note the immaculate footwork and angular leverage on display. By establishing a wide, planted base during the setup in "${cleanTitle}", the athlete maintains total control under pressure. When we dissect the deceleration phase, notice how the joints absorb impact cleanly to avoid wasted energy.`,
        description: `Technical analysis of footwork, ground force reaction, and leverage in ${sport} ("${clip.title}"). Breaking down deceleration and balance.`,
        tags: [sport, 'FootworkDrills', 'Leverage', 'FormAnalysis', 'SportsMechanics'],
        cards: [
          { title: 'GROUND REACTION FORCE', statOrFact: 'Angular Leverage Base', subtitle: 'Wide planted stance under pressure', startTime: 2, duration: 8 },
          { title: 'ENERGY CONSERVATION', statOrFact: 'Clean Deceleration Phase', subtitle: 'Minimizing joint stress & fatigue', startTime: 12, duration: 8 },
        ],
      },
      {
        title: `${sport} Performance Review: Reaction Speed & Form`,
        script: `High-velocity ${sport} demands near-instantaneous neural processing. In this sequence from "${cleanTitle}", the response time between stimulus detection and physical execution is virtually instantaneous. Notice how posture remains aligned throughout the movement, preventing mechanical breakdown when fatigue sets in. That is championship-caliber conditioning.`,
        description: `Performance analysis of reaction speed and postural alignment during high-intensity ${sport} in "${clip.title}".`,
        tags: [sport, 'ReactionTime', 'Conditioning', 'PerformanceReview', 'Shorts'],
        cards: [
          { title: 'NEURAL PROCESSING', statOrFact: 'Sub-Second Stimulus Response', subtitle: 'Elite reaction timing under pressure', startTime: 2, duration: 8 },
          { title: 'POSTURAL INTEGRITY', statOrFact: 'Spine & Core Neutrality', subtitle: 'Preventing fatigue-induced breakdown', startTime: 12, duration: 8 },
        ],
      },
    ];

    // Pick template based on clip ID hash to ensure diversity across candidate clips
    let hash = 0;
    for (let i = 0; i < clip.id.length; i++) {
      hash = (hash * 31 + clip.id.charCodeAt(i)) & 0xffffffff;
    }
    const selected = scriptTemplates[Math.abs(hash) % scriptTemplates.length];

    return {
      title: selected.title,
      script: selected.script,
      description: selected.description,
      tags: selected.tags,
      graphicsCards: selected.cards,
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
