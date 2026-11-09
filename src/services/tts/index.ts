import { config } from '../../config/env.js';
import { getDbSetting } from '../settings.js';
import { PuterTtsService } from './puter.js';
import { FreeBroadcastTtsService } from './free-tts.js';
import { cleanSpeechScript } from './cleaner.js';
import { SynthesisOptions, TtsConnectionStatus } from './types.js';

export { SynthesisOptions, TtsConnectionStatus } from './types.js';
export { PuterTtsService } from './puter.js';
export { FreeBroadcastTtsService } from './free-tts.js';
export { cleanSpeechScript } from './cleaner.js';

export class UnifiedTtsService {
  private puterService = new PuterTtsService();
  private freeService = new FreeBroadcastTtsService();

  /**
   * Preprocesses and formats description text to natural news broadcast speech
   */
  public cleanDescription(description?: string, headline?: string): string {
    return cleanSpeechScript(description, headline);
  }

  /**
   * Synthesizes audio using the configured TTS provider:
   * 1. Puter.js (Gemini TTS / Speechify / xAI / AWS Polly) if PUTER_AUTH_TOKEN is configured
   * 2. Zero-config Free Broadcast TTS as instant fallback
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

    // 1. Puter.js Provider (if explicit or auto with token)
    if (ttsProvider === 'puter' || (ttsProvider === 'auto' && puterToken)) {
      try {
        const audio = await this.puterService.synthesize(cleanText, options);
        if (audio && audio.length > 500) {
          return audio;
        }
      } catch (err: any) {
        console.warn(`[UnifiedTTS] Puter TTS failed: ${err.message}. Falling back to broadcast TTS...`);
      }
    }

    // 2. Zero-Config Free Broadcast TTS Fallback
    try {
      console.log(`[UnifiedTTS] 📢 Using Zero-Config Broadcast TTS fallback for: "${cleanText.substring(0, 35)}..."`);
      const audio = await this.freeService.synthesize(cleanText, options);
      if (audio && audio.length > 500) {
        return audio;
      }
    } catch (err: any) {
      console.warn(`[UnifiedTTS] Free Broadcast TTS error: ${err.message}`);
    }

    return null;
  }

  /**
   * Tests all available providers and reports the active TTS status
   */
  public async testConnection(): Promise<TtsConnectionStatus> {
    const puterStatus = await this.puterService.testConnection();
    const freeStatus = await this.freeService.testConnection();

    const puterToken =
      (await getDbSetting('PUTER_AUTH_TOKEN')) ||
      process.env.PUTER_AUTH_TOKEN ||
      config.PUTER_AUTH_TOKEN ||
      '';

    let activeProvider = 'Free Broadcast TTS (Zero-Config)';
    let message = 'Using free broadcast voiceover. Set PUTER_AUTH_TOKEN for studio AI voices.';

    if (puterStatus.available) {
      activeProvider = 'Puter.js (Gemini / Speechify / xAI)';
      message = 'Connected to Puter.js! High-quality AI voiceover is ready.';
    } else if (puterToken) {
      activeProvider = 'Puter.js (Configured, verifying token...)';
      message = puterStatus.message;
    }

    return {
      available: true,
      activeProvider,
      message,
      providers: {
        puter: puterStatus.available,
        freeFallback: freeStatus.available,
      },
    };
  }
}
