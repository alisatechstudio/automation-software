import { config } from '../../config/env.js';
import { getDbSetting } from '../settings.js';
import { PuterTtsService } from './puter.js';
import { GeminiTtsService } from './gemini.js';
import { HuggingFaceTtsService } from './huggingface.js';
import { cleanSpeechScript } from './cleaner.js';
import { SynthesisOptions, TtsConnectionStatus } from './types.js';

export { SynthesisOptions, TtsConnectionStatus } from './types.js';
export { PuterTtsService } from './puter.js';
export { GeminiTtsService } from './gemini.js';
export { HuggingFaceTtsService } from './huggingface.js';
export { cleanSpeechScript } from './cleaner.js';

export class UnifiedTtsService {
  private puterService = new PuterTtsService();
  private geminiService = new GeminiTtsService();
  private hfService = new HuggingFaceTtsService();

  /**
   * Preprocesses and formats description text to natural news broadcast speech
   */
  public cleanDescription(description?: string, headline?: string): string {
    return cleanSpeechScript(description, headline);
  }

  /**
   * Synthesizes audio using the configured TTS provider chain:
   * 1. Puter.js (Gemini TTS - Charon voice) if PUTER_AUTH_TOKEN is configured
   * 2. Google AI Studio (Gemini TTS - Charon voice) if GEMINI_API_KEY is configured
   * 3. Hugging Face (Facebook MMS-TTS) if HF_AUTH_TOKEN is configured
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

    const geminiKey =
      (await getDbSetting('GEMINI_API_KEY')) ||
      process.env.GEMINI_API_KEY ||
      config.GEMINI_API_KEY ||
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
        console.warn(`[UnifiedTTS] Puter TTS (Charon) failed: ${err.message}. Falling back to Gemini API...`);
      }
    }

    // 2. Google AI Studio (Gemini API) - Charon voice
    if ((ttsProvider === 'gemini' || (ttsProvider === 'auto' && geminiKey)) && geminiKey) {
      try {
        const audio = await this.geminiService.synthesize(cleanText, options);
        if (audio && audio.length > 500) {
          return audio;
        }
      } catch (err: any) {
        console.warn(`[UnifiedTTS] Gemini API TTS (Charon) failed: ${err.message}. Falling back to MMS-TTS...`);
      }
    }

    // 3. Hugging Face Provider (MMS-TTS) - fallback
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
    const geminiStatus = await this.geminiService.testConnection();
    const hfStatus = await this.hfService.testConnection();

    const puterToken =
      (await getDbSetting('PUTER_AUTH_TOKEN')) ||
      process.env.PUTER_AUTH_TOKEN ||
      config.PUTER_AUTH_TOKEN ||
      '';

    const geminiKey =
      (await getDbSetting('GEMINI_API_KEY')) ||
      process.env.GEMINI_API_KEY ||
      config.GEMINI_API_KEY ||
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
    } else if (geminiStatus.available) {
      activeProvider = 'Google AI Studio (Gemini TTS - Charon)';
      message = 'Connected to Google AI Studio! Charon voice (male news anchor) is ready.';
    } else if (hfStatus.available) {
      activeProvider = 'Hugging Face (Facebook MMS-TTS)';
      message = 'Connected to Hugging Face MMS-TTS. Using single-speaker models.';
    } else if (puterToken) {
      activeProvider = 'Puter.js (Configured, verifying token...)';
      message = puterStatus.message;
    } else if (geminiKey) {
      activeProvider = 'Google AI Studio (Configured, verifying key...)';
      message = geminiStatus.message;
    } else if (hfToken) {
      activeProvider = 'Hugging Face (Configured, verifying token...)';
      message = hfStatus.message;
    }

    return {
      available: puterStatus.available || geminiStatus.available || hfStatus.available,
      activeProvider,
      message,
      providers: {
        puter: puterStatus.available,
        gemini: geminiStatus.available,
        huggingface: hfStatus.available,
      },
    };
  }
}