import { config } from '../../config/env.js';
import { getDbSetting } from '../settings.js';
import { PuterTtsService } from './puter.js';
import { EdgeTtsService } from './edge-tts.js';
import { GeminiTtsService } from './gemini.js';
import { HuggingFaceTtsService } from './huggingface.js';
import { cleanSpeechScript } from './cleaner.js';
import { SynthesisOptions, TtsConnectionStatus } from './types.js';

export { SynthesisOptions, TtsConnectionStatus } from './types.js';
export { PuterTtsService } from './puter.js';
export { EdgeTtsService } from './edge-tts.js';
export { GeminiTtsService } from './gemini.js';
export { HuggingFaceTtsService } from './huggingface.js';
export { cleanSpeechScript } from './cleaner.js';

export class UnifiedTtsService {
  private puterService  = new PuterTtsService();
  private edgeService   = new EdgeTtsService();
  private geminiService = new GeminiTtsService();
  private hfService     = new HuggingFaceTtsService();

  /**
   * Preprocesses description text to natural news broadcast speech.
   */
  public cleanDescription(description?: string, headline?: string): string {
    return cleanSpeechScript(description, headline);
  }

  /**
   * Synthesizes audio using the configured TTS provider chain:
   *
   * 1. Puter.js  — OpenAI gpt-4o-mini-tts / onyx  (male news anchor, requires PUTER_AUTH_TOKEN)
   * 2. Edge TTS  — Microsoft bn-BD-PradeepNeural   (free, native Bengali male, no key needed)
   * 3. Gemini API— Gemini 2.5 Flash TTS / Charon   (requires GEMINI_API_KEY)
   * 4. Hugging Face MMS-TTS                        (requires HF_AUTH_TOKEN)
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

    console.log(`[UnifiedTTS] Provider setting: ${ttsProvider}`);

    if (ttsProvider === 'off' || ttsProvider === 'disabled') return null;

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

    console.log(
      `[UnifiedTTS] Tokens — Puter: ${puterToken ? 'YES' : 'NO'}, Gemini: ${geminiKey ? 'YES' : 'NO'}, HF: ${hfToken ? 'YES' : 'NO'}`
    );

    // ── Tier 1: Puter.js (OpenAI onyx) ──────────────────────────────────────
    if ((ttsProvider === 'puter' || (ttsProvider === 'auto' && puterToken)) && puterToken) {
      console.log('[UnifiedTTS] 🎙️ Trying Puter.js (OpenAI onyx)...');
      try {
        const audio = await this.puterService.synthesize(cleanText, options);
        if (audio && audio.length > 500) {
          console.log('[UnifiedTTS] ✅ Puter.js success!');
          return audio;
        }
        console.warn('[UnifiedTTS] Puter.js returned no audio, trying Edge TTS...');
      } catch (err: any) {
        console.warn(`[UnifiedTTS] Puter.js failed: ${err.message}. Trying Edge TTS...`);
      }
    }

    // ── Tier 2: Edge TTS (free, bn-BD-PradeepNeural) ────────────────────────
    if (ttsProvider === 'edge' || ttsProvider === 'auto') {
      console.log('[UnifiedTTS] 🎙️ Trying Edge TTS (bn-BD-PradeepNeural)...');
      try {
        const audio = await this.edgeService.synthesize(cleanText, options);
        if (audio && audio.length > 500) {
          console.log('[UnifiedTTS] ✅ Edge TTS success!');
          return audio;
        }
        console.warn('[UnifiedTTS] Edge TTS returned no audio, trying Gemini API...');
      } catch (err: any) {
        console.warn(`[UnifiedTTS] Edge TTS failed: ${err.message}. Trying Gemini API...`);
      }
    }

    // ── Tier 3: Google AI Studio (Gemini TTS — Charon) ──────────────────────
    if ((ttsProvider === 'gemini' || (ttsProvider === 'auto' && geminiKey)) && geminiKey) {
      console.log('[UnifiedTTS] 🎙️ Trying Google AI Studio (Gemini TTS / Charon)...');
      try {
        const audio = await this.geminiService.synthesize(cleanText, options);
        if (audio && audio.length > 500) {
          console.log('[UnifiedTTS] ✅ Gemini API success!');
          return audio;
        }
        console.warn('[UnifiedTTS] Gemini API returned no audio, trying Hugging Face...');
      } catch (err: any) {
        console.warn(`[UnifiedTTS] Gemini API failed: ${err.message}. Trying Hugging Face...`);
      }
    }

    // ── Tier 4: Hugging Face MMS-TTS ────────────────────────────────────────
    if ((ttsProvider === 'huggingface' || (ttsProvider === 'auto' && hfToken)) && hfToken) {
      console.log('[UnifiedTTS] 🎙️ Trying Hugging Face (MMS-TTS)...');
      try {
        const audio = await this.hfService.synthesize(cleanText, options);
        if (audio && audio.length > 500) {
          console.log('[UnifiedTTS] ✅ Hugging Face success!');
          return audio;
        }
        console.warn('[UnifiedTTS] Hugging Face returned no audio');
      } catch (err: any) {
        console.warn(`[UnifiedTTS] Hugging Face failed: ${err.message}`);
      }
    }

    console.warn('[UnifiedTTS] ❌ All TTS providers failed or unavailable');
    return null;
  }

  /**
   * Tests all available providers and reports TTS status.
   */
  public async testConnection(): Promise<TtsConnectionStatus> {
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

    const [puterStatus, edgeStatus, geminiStatus, hfStatus] = await Promise.all([
      this.puterService.testConnection(),
      this.edgeService.testConnection(),
      this.geminiService.testConnection(),
      this.hfService.testConnection(),
    ]);

    let activeProvider = 'None';
    let message = 'No TTS configured.';

    if (puterStatus.available) {
      activeProvider = puterStatus.provider || 'Puter.js (OpenAI onyx)';
      message = 'Connected to Puter.js! OpenAI onyx voice (male news anchor) is ready.';
    } else if (edgeStatus.available) {
      activeProvider = edgeStatus.provider || 'Edge TTS (bn-BD-PradeepNeural)';
      message = 'Connected to Edge TTS! Native Bengali male voice is ready.';
    } else if (geminiStatus.available) {
      activeProvider = geminiStatus.provider || 'Google AI Studio (Gemini TTS — Charon)';
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
    } else {
      activeProvider = 'Edge TTS';
      message = edgeStatus.message;
    }

    return {
      available: puterStatus.available || edgeStatus.available || geminiStatus.available || hfStatus.available,
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
