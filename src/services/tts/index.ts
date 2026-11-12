import { config } from '../../config/env.js';
import { getDbSetting } from '../settings.js';
import { PuterTtsService } from './puter.js';
import { HuggingFaceTtsService } from './huggingface.js';
import { cleanSpeechScript } from './cleaner.js';
import { SynthesisOptions, TtsConnectionStatus } from './types.js';

export { SynthesisOptions, TtsConnectionStatus } from './types.js';
export { PuterTtsService } from './puter.js';
export { HuggingFaceTtsService } from './huggingface.js';
export { cleanSpeechScript } from './cleaner.js';

export class UnifiedTtsService {
  private puterService = new PuterTtsService();
  private hfService = new HuggingFaceTtsService();

  /**
   * Preprocesses and formats description text to natural news broadcast speech
   */
  public cleanDescription(description?: string, headline?: string): string {
    return cleanSpeechScript(description, headline);
  }

  /**
   * Synthesizes audio using the configured TTS provider:
   * 1. Puter.js (Gemini TTS - Charon voice) if PUTER_AUTH_TOKEN is configured
   * 2. Hugging Face (Facebook MMS-TTS) if HF_AUTH_TOKEN is configured
   */
  public async synthesize(
    text: string,
    options?: SynthesisOptions
  ): Promise<Buffer | null> {
    const cleanText = (text || '').trim();
    if (!cleanText) return null;

    const ttsProvider =
      (await getDbSetting('TTS_PROVIDER')) ||
      config.TTS_PROVIDER ||
      'auto';

    if (ttsProvider === 'off' || ttsProvider === 'disabled') {
      return null;
    }

    const puterToken =
      (await getDbSetting('PUTER_AUTH_TOKEN')) ||
      process.env.PUTER_AUTH_TOKEN ||
      config.PUTER_AUTH_TOKEN ||
      '';

    const hfToken =
      (await getDbSetting('HF_AUTH_TOKEN')) ||
      process.env.HF_AUTH_TOKEN ||
      config.HF_AUTH_TOKEN ||
      '';

    // 1. Puter.js Provider (Charon voice) - primary if token available
    if ((ttsProvider === 'puter' || (ttsProvider === 'auto' && puterToken)) && puterToken) {
      try {
        const audio = await this.puterService.synthesize(cleanText, options);
        if (audio && audio.length > 500) {
          return audio;
        }
      } catch (err: any) {
        console.warn(`[UnifiedTTS] Puter TTS (Charon) failed: ${err.message}. Falling back to MMS-TTS...`);
      }
    }

    // 2. Hugging Face Provider (MMS-TTS) - fallback
    if ((ttsProvider === 'huggingface' || (ttsProvider === 'auto' && hfToken)) && hfToken) {
      try {
        const audio = await this.hfService.synthesize(cleanText, options);
        if (audio && audio.length > 500) {
          return audio;
        }
      } catch (err: any) {
        console.warn(`[UnifiedTTS] Hugging Face MMS-TTS failed: ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Tests all available providers and reports the active TTS status
   */
  public async testConnection(): Promise<TtsConnectionStatus> {
    const puterStatus = await this.puterService.testConnection();
    const hfStatus = await this.hfService.testConnection();

    const puterToken =
      (await getDbSetting('PUTER_AUTH_TOKEN')) ||
      process.env.PUTER_AUTH_TOKEN ||
      config.PUTER_AUTH_TOKEN ||
      '';

    const hfToken =
      (await getDbSetting('HF_AUTH_TOKEN')) ||
      process.env.HF_AUTH_TOKEN ||
      config.HF_AUTH_TOKEN ||
      '';

    let activeProvider = 'None';
    let message = 'No TTS configured.';

    if (puterStatus.available) {
      activeProvider = 'Puter.js (Gemini TTS - Charon)';
      message = 'Connected to Puter.js! Charon voice (male news anchor) is ready.';
    } else if (hfStatus.available) {
      activeProvider = 'Hugging Face (Facebook MMS-TTS)';
      message = 'Connected to Hugging Face MMS-TTS. Using single-speaker models.';
    } else if (puterToken) {
      activeProvider = 'Puter.js (Configured, verifying token...)';
      message = puterStatus.message;
    } else if (hfToken) {
      activeProvider = 'Hugging Face (Configured, verifying token...)';
      message = hfStatus.message;
    }

    return {
      available: puterStatus.available || hfStatus.available,
      activeProvider,
      message,
      providers: {
        puter: puterStatus.available,
        huggingface: hfStatus.available,
      },
    };
  }
}