import { config } from '../../config/env.js';
import { getDbSetting } from '../settings.js';
import { SynthesisOptions } from './types.js';

export class HuggingFaceTtsService {
  private static readonly HF_API_URL = 'https://api-inference.huggingface.co/models';
  private static readonly MMS_ENGLISH_MODEL = 'facebook/mms-tts-eng';
  private static readonly MMS_BENGALI_MODEL = 'facebook/mms-tts-ben';
  private static readonly MMS_HINDI_MODEL = 'facebook/mms-tts-hin';
  private static readonly OMNIVOICE_BENGALI_MODEL = 'sawon19/omnivoice-bengali';

  /**
   * Synthesizes audio using Hugging Face Inference API with Facebook MMS-TTS and OmniVoice.
   * Supports English, Bengali (MMS + OmniVoice), and Hindi. Single-speaker models (no voice selection).
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

    console.log(`[HuggingFaceTTS] Token found (${token.substring(0, 20)}...), attempting synthesis...`);

    // Select model based on language and options
    const isEnglish = options?.isEnglish ?? true;
    let model: string;
    
    if (options?.model === 'mms-hin') {
      model = HuggingFaceTtsService.MMS_HINDI_MODEL;
    } else if (options?.model === 'mms-ben') {
      model = HuggingFaceTtsService.MMS_BENGALI_MODEL;
    } else if (options?.model === 'omnivoice-ben') {
      model = HuggingFaceTtsService.OMNIVOICE_BENGALI_MODEL;
    } else {
      model = isEnglish ? HuggingFaceTtsService.MMS_ENGLISH_MODEL : HuggingFaceTtsService.MMS_BENGALI_MODEL;
    }

    console.log(`[HuggingFaceTTS] 🎙️ Synthesizing with ${model} for: "${cleanText.substring(0, 40)}..."`);

    try {
      const audioBuffer = await this.callInferenceAPI(cleanText, model, token);
      if (audioBuffer && audioBuffer.length > 500) {
        console.log(`[HuggingFaceTTS] Synthesis success: ${audioBuffer.length} bytes`);
        return audioBuffer;
      } else {
        console.warn('[HuggingFaceTTS] Synthesis returned empty/invalid audio');
      }
    } catch (err: any) {
      console.warn(`[HuggingFaceTTS] Synthesis error: ${err.message}`);
    }

    return null;
  }

  private async callInferenceAPI(text: string, model: string, token: string): Promise<Buffer | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      console.log(`[HuggingFaceTTS] Calling HF Inference API for ${model}...`);
      const response = await fetch(`${HuggingFaceTtsService.HF_API_URL}/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.warn(`[HuggingFaceTTS] HTTP ${response.status}: ${errText.substring(0, 200)}`);
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      console.log(`[HuggingFaceTTS] Response content-type: ${contentType}`);
      if (contentType.includes('audio') || contentType.includes('octet-stream') || contentType.includes('wav')) {
        const ab = await response.arrayBuffer();
        return Buffer.from(ab);
      }

      const jsonText = await response.text();
      console.log(`[HuggingFaceTTS] Response (non-audio): ${jsonText.substring(0, 300)}`);
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
          provider: 'Hugging Face (Facebook MMS-TTS)',
          message: 'Hugging Face MMS-TTS is connected and synthesizing audio successfully!',
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