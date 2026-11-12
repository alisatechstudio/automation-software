import { config } from '../../config/env.js';
import { getDbSetting } from '../settings.js';
import { SynthesisOptions } from './types.js';

export class HuggingFaceTtsService {
  private static readonly HF_API_URL = 'https://api-inference.huggingface.co/models';
  private static readonly HIGGS_AUDIO_V2_MODEL = 'bosonai/higgs-audio-v2';
  private static readonly HIGGS_AUDIO_V2_EN_MODEL = 'bosonai/higgs-audio-v2-en';

  // Higgs Audio v2 supported voices (from model card)
  private static readonly HIGGS_VOICES = [
    'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer',  // OpenAI-compatible
    'male', 'female',  // Generic
  ];

  /**
   * Synthesizes audio using Hugging Face Inference API with Higgs Audio v2.
   * High-quality multilingual TTS with voice selection.
   */
  public async synthesize(
    text: string,
    options?: SynthesisOptions
  ): Promise<Buffer | null> {
    const cleanText = (text || '').trim();
    if (!cleanText) return null;

    const token =
      (await getDbSetting('HF_AUTH_TOKEN')) ||
      process.env.HF_AUTH_TOKEN ||
      config.HF_AUTH_TOKEN ||
      '';

    if (!token) {
      console.warn('[HuggingFaceTTS] No HF_AUTH_TOKEN configured');
      return null;
    }

    // Default to English Higgs model, but allow override
    const isEnglish = options?.isEnglish ?? true;
    const model = options?.model === 'higgs-v2' 
      ? HuggingFaceTtsService.HIGGS_AUDIO_V2_MODEL 
      : HuggingFaceTtsService.HIGGS_AUDIO_V2_EN_MODEL;

    // Default to onyx (deep male) for news broadcast
    let voice = options?.voice || 'onyx';
    if (!HuggingFaceTtsService.HIGGS_VOICES.includes(voice.toLowerCase())) {
      console.warn(`[HuggingFaceTTS] Voice "${voice}" not in known Higgs voices: ${HuggingFaceTtsService.HIGGS_VOICES.join(', ')}. Using onyx.`);
      voice = 'onyx';
    }

    console.log(`[HuggingFaceTTS] 🎙️ Synthesizing with ${model} (voice: ${voice}) for: "${cleanText.substring(0, 40)}..."`);

    try {
      const audioBuffer = await this.callInferenceAPI(cleanText, model, token, voice);
      if (audioBuffer && audioBuffer.length > 500) {
        return audioBuffer;
      }
    } catch (err: any) {
      console.warn(`[HuggingFaceTTS] Synthesis error: ${err.message}`);
    }

    return null;
  }

  private async callInferenceAPI(text: string, model: string, token: string, voice?: string): Promise<Buffer | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      // Build request body - Higgs Audio supports voice parameter
      const body: Record<string, any> = { inputs: text };
      if (voice) {
        body.parameters = { voice };
      }

      const response = await fetch(`${HuggingFaceTtsService.HF_API_URL}/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.warn(`[HuggingFaceTTS] HTTP ${response.status}: ${errText.substring(0, 200)}`);
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('audio') || contentType.includes('octet-stream') || contentType.includes('wav')) {
        const ab = await response.arrayBuffer();
        return Buffer.from(ab);
      }

      const jsonText = await response.text();
      try {
        const data = JSON.parse(jsonText);
        if (data.error) {
          console.warn(`[HuggingFaceTTS] API Error: ${data.error}`);
          return null;
        }
      } catch {
        // Not JSON, might be binary
      }

      return null;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.warn('[HuggingFaceTTS] Request timeout');
      }
      throw err;
    }
  }

  /**
   * Tests connectivity to Hugging Face Inference API.
   */
  public async testConnection(): Promise<{ available: boolean; message: string; provider?: string }> {
    const token =
      (await getDbSetting('HF_AUTH_TOKEN')) ||
      process.env.HF_AUTH_TOKEN ||
      config.HF_AUTH_TOKEN ||
      '';

    if (!token) {
      return {
        available: false,
        message: 'No HF_AUTH_TOKEN configured. Get a free token at https://huggingface.co/settings/tokens',
      };
    }

    try {
      const audio = await this.synthesize('Testing Hugging Face text to speech.');
      if (audio && audio.length > 500) {
        return {
          available: true,
          provider: 'Hugging Face (Higgs Audio v2)',
          message: 'Hugging Face Higgs Audio v2 TTS is connected and synthesizing audio successfully!',
        };
      }
      return {
        available: false,
        provider: 'Hugging Face',
        message: 'HF token is set, but synthesis returned empty. Check token validity and model availability.',
      };
    } catch (err: any) {
      return {
        available: false,
        provider: 'Hugging Face',
        message: `Hugging Face error: ${err.message || err}`,
      };
    }
  }
}