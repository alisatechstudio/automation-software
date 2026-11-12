import { config } from '../../config/env.js';
import { getDbSetting } from '../settings.js';
import { HuggingFaceTtsService } from './huggingface.js';
import { FreeBroadcastTtsService } from './free-tts.js';
import { cleanSpeechScript } from './cleaner.js';
import { SynthesisOptions, TtsConnectionStatus } from './types.js';

export { SynthesisOptions, TtsConnectionStatus } from './types.js';
export { HuggingFaceTtsService } from './huggingface.js';
export { FreeBroadcastTtsService } from './free-tts.js';
export { cleanSpeechScript } from './cleaner.js';

export class UnifiedTtsService {
  private hfService = new HuggingFaceTtsService();
  private freeService = new FreeBroadcastTtsService();

  /**
   * Preprocesses and formats description text to natural news broadcast speech
   */
  public cleanDescription(description?: string, headline?: string): string {
    return cleanSpeechScript(description, headline);
  }

  /**
   * Synthesizes audio using the configured TTS provider:
   * 1. Hugging Face (Free TTS Models) if HF_AUTH_TOKEN is configured
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

    const hfToken =
      (await getDbSetting('HF_AUTH_TOKEN')) ||
      process.env.HF_AUTH_TOKEN ||
      config.HF_AUTH_TOKEN ||
      '';

    // 1. Hugging Face Provider (if explicit or auto with token)
    if (ttsProvider === 'huggingface' || (ttsProvider === 'auto' && hfToken)) {
      try {
        const audio = await this.hfService.synthesize(cleanText, options);
        if (audio && audio.length > 500) {
          return audio;
        }
      } catch (err: any) {
        console.warn(`[UnifiedTTS] Hugging Face TTS failed: ${err.message}. Falling back to broadcast TTS...`);
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
    const hfStatus = await this.hfService.testConnection();
    const freeStatus = await this.freeService.testConnection();

    const hfToken =
      (await getDbSetting('HF_AUTH_TOKEN')) ||
      process.env.HF_AUTH_TOKEN ||
      config.HF_AUTH_TOKEN ||
      '';

    let activeProvider = 'Free Broadcast TTS (Zero-Config)';
    let message = 'Using free broadcast voiceover. Set HF_AUTH_TOKEN for AI voices.';

    if (hfStatus.available) {
      activeProvider = 'Hugging Face (Free TTS Models)';
      message = 'Connected to Hugging Face! Free AI voiceover is ready.';
    } else if (hfToken) {
      activeProvider = 'Hugging Face (Configured, verifying token...)';
      message = hfStatus.message;
    }

    return {
      available: true,
      activeProvider,
      message,
      providers: {
        huggingface: hfStatus.available,
        freeFallback: freeStatus.available,
      },
    };
  }
}
