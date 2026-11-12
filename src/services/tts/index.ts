import { GeminiTtsService } from './gemini.js';
import { cleanSpeechScript } from './cleaner.js';
import { SynthesisOptions, TtsConnectionStatus } from './types.js';

export { SynthesisOptions, TtsConnectionStatus } from './types.js';
export { GeminiTtsService } from './gemini.js';
export { cleanSpeechScript } from './cleaner.js';

/**
 * UnifiedTtsService — Dedicated to Google Gemini API using the authoritative Charon voice.
 * All other TTS providers have been removed as requested.
 */
export class UnifiedTtsService {
  private geminiService = new GeminiTtsService();

  /**
   * Preprocesses and formats description/headline text into natural news broadcast speech.
   */
  public cleanDescription(description?: string, headline?: string): string {
    return cleanSpeechScript(description, headline);
  }

  /**
   * Synthesizes audio exclusively using the Google Gemini API with the Charon voice.
   */
  public async synthesize(
    text: string,
    options?: SynthesisOptions
  ): Promise<Buffer | null> {
    const cleanText = (text || '').trim();
    if (!cleanText) return null;

    console.log('[UnifiedTTS] 🎙️ Synthesizing voiceover exclusively via Gemini API (Charon)...');
    return this.geminiService.synthesize(cleanText, options);
  }

  /**
   * Tests connection to Google Gemini API (Charon voice).
   */
  public async testConnection(): Promise<TtsConnectionStatus> {
    const status = await this.geminiService.testConnection();
    return {
      available: status.available,
      activeProvider: status.provider || 'Google Gemini API (Charon)',
      voice: GeminiTtsService.DEFAULT_VOICE,
      model: GeminiTtsService.DEFAULT_MODEL,
      message: status.message,
    };
  }
}
