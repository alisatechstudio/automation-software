import { config } from '../../config/env.js';
import { getDbSetting } from '../settings.js';
import { SynthesisOptions } from './types.js';

/**
 * Wraps raw linear PCM audio into a valid RIFF/WAVE container
 * so standard media decoders and FFmpeg can read it directly.
 */
function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitDepth = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  header.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * GeminiTtsService — Exclusive text-to-speech service powered by Google Gemini API
 * using the authoritative male news anchor voice "Charon".
 */
export class GeminiTtsService {
  public static readonly DEFAULT_VOICE = 'Charon';
  public static readonly DEFAULT_MODEL = 'gemini-2.5-flash-preview-tts';
  public static readonly MODELS: string[] = [
    'gemini-2.5-pro-preview-tts',      // Pro model - higher rate limits
    'gemini-2.5-flash-preview-tts',     // Flash model - default
    'gemini-2.0-flash-preview-tts',     // Fallback model
  ];
  private static readonly API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

  /**
   * Synthesizes natural news voiceover using the Gemini API Charon voice.
   */
  public async synthesize(
    text: string,
    options?: SynthesisOptions
  ): Promise<Buffer | null> {
    const cleanText = (text || '').trim();
    if (!cleanText) return null;

    const apiKey =
      (await getDbSetting('GEMINI_API_KEY')) ||
      process.env.GEMINI_API_KEY ||
      config.GEMINI_API_KEY ||
      '';

    if (!apiKey) {
      console.warn('[GeminiTTS] No GEMINI_API_KEY configured. Please set GEMINI_API_KEY in .env or settings.');
      return null;
    }

    const voice = GeminiTtsService.DEFAULT_VOICE; // Exclusively Charon

    // Determine model list - use custom model if specified, otherwise use full chain
    const customModel =
      (await getDbSetting('GEMINI_TTS_MODEL')) ||
      process.env.GEMINI_TTS_MODEL ||
      '';
    const models = customModel ? [customModel] : GeminiTtsService.MODELS;

    console.log(`[GeminiTTS] 🎙️ Trying model chain: ${models.join(' → ')} (voice: ${voice})`);

    // Prompt directive instructs the model to read verbatim as a news broadcast
    const promptText = `Read aloud the following text verbatim as a professional news broadcast:\n${cleanText}`;

    const requestPayload = {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
        },
      },
    };

    // Try each model in order with fallback
    for (const model of models) {
      const endpoint = `${GeminiTtsService.API_BASE}/${model}:generateContent?key=${apiKey}`;

      try {
        console.log(`[GeminiTTS] Attempting model: ${model} for: "${cleanText.substring(0, 50)}..."`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestPayload),
          signal: AbortSignal.timeout(35000),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          // Check for rate limit or quota errors - continue to next model
          if (response.status === 429 || response.status === 403 || errText.includes('quota') || errText.includes('limit')) {
            console.warn(`[GeminiTTS] Model ${model} rate-limited/quota exceeded: ${errText.substring(0, 200)}. Trying next model...`);
            continue;
          }
          console.warn(`[GeminiTTS] Model ${model} HTTP ${response.status}: ${errText.substring(0, 250)}. Trying next model...`);
          continue;
        }

        const data = await response.json();
        const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

        if (!inlineData?.data) {
          console.warn(`[GeminiTTS] Model ${model} returned no audio data`);
          continue;
        }

        const rawBuffer = Buffer.from(inlineData.data, 'base64');
        const mimeType = String(inlineData.mimeType || '');
        console.log(`[GeminiTTS] Model ${model} success: ${rawBuffer.length} bytes, mimeType: "${mimeType}"`);

        // Check if it already has a media container header (RIFF, ID3, OggS, etc.)
        const isRiff = rawBuffer.length > 4 && rawBuffer.toString('ascii', 0, 4) === 'RIFF';
        const isMp3 =
          rawBuffer.length > 3 &&
          (rawBuffer.toString('ascii', 0, 3) === 'ID3' ||
            (rawBuffer[0] === 0xff && (rawBuffer[1] & 0xe0) === 0xe0));
        const isOgg = rawBuffer.length > 4 && rawBuffer.toString('ascii', 0, 4) === 'OggS';

        if (isRiff || isMp3 || isOgg) {
          return rawBuffer;
        }

        // If mimeType is PCM or lacks a container, wrap into a standard WAV header
        let sampleRate = 24000;
        const rateMatch = mimeType.match(/rate=(\d+)/i);
        if (rateMatch && rateMatch[1]) {
          sampleRate = parseInt(rateMatch[1], 10);
        }

        const wavBuffer = pcmToWav(rawBuffer, sampleRate, 1, 16);
        console.log(`[GeminiTTS] ✅ Packaged PCM audio to WAV (${wavBuffer.length} bytes, ${sampleRate}Hz) via ${model}`);
        return wavBuffer;
      } catch (err: any) {
        console.warn(`[GeminiTTS] Model ${model} failed: ${err.message || err}. Trying next model...`);
        continue;
      }
    }

    console.warn('[GeminiTTS] All models in chain failed or exhausted');
    return null;
  }

  /**
   * Validates connectivity and verifies the GEMINI_API_KEY with the Charon voice.
   */
  public async testConnection(): Promise<{ available: boolean; message: string; provider?: string }> {
    const apiKey =
      (await getDbSetting('GEMINI_API_KEY')) ||
      process.env.GEMINI_API_KEY ||
      config.GEMINI_API_KEY ||
      '';

    if (!apiKey) {
      return {
        available: false,
        provider: 'Google Gemini API (Charon)',
        message: 'No GEMINI_API_KEY configured. Please set GEMINI_API_KEY in .env or Settings.',
      };
    }

    try {
      const audio = await this.synthesize('সংবাদ উপস্থাপনা পরীক্ষা। Testing news broadcast.');
      if (audio && audio.length > 500) {
        return {
          available: true,
          provider: 'Google Gemini API (Charon)',
          message: 'Connected to Gemini API! Charon voice (authoritative male news anchor) is ready.',
        };
      }
      return {
        available: false,
        provider: 'Google Gemini API (Charon)',
        message: 'GEMINI_API_KEY is configured, but audio generation returned empty.',
      };
    } catch (err: any) {
      return {
        available: false,
        provider: 'Google Gemini API (Charon)',
        message: `Gemini API error: ${err.message || err}`,
      };
    }
  }
}
