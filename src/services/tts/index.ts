import { EdgeTtsService } from './edge-tts.js';
import { SynthesisOptions, TtsConnectionStatus } from './types.js';

/**
 * UnifiedTtsService — Standard TTS facade for video reel voiceover narration.
 * Uses EdgeTtsService for high-fidelity news presenter neural voices (Bengali & English).
 */
export class UnifiedTtsService {
  private edgeTts: EdgeTtsService;

  constructor() {
    this.edgeTts = new EdgeTtsService();
  }

  public cleanDescription(description?: string, headline?: string): string {
    return this.edgeTts.cleanDescription(description, headline);
  }

  public async synthesize(
    text: string,
    options?: SynthesisOptions
  ): Promise<Buffer | null> {
    return this.edgeTts.synthesize(text, options);
  }

  public async testConnection(): Promise<TtsConnectionStatus> {
    return this.edgeTts.testConnection();
  }
}

export { EdgeTtsService };
export * from './types.js';
export * from './cleaner.js';
