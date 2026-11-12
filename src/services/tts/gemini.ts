import { config } from '../../config/env.js';
import { getDbSetting } from '../settings.js';
import { SynthesisOptions } from './types.js';

export class GeminiTtsService {
  private static readonly GEMINI_TTS_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';

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
      console.warn('[GeminiTTS] No GEMINI_API_KEY configured');
      return null;
    }

    // Charon voice configuration
    const voiceName = options?.voice || 'Charon';
    const instructions = options?.instructions || 'Speak in a confident, authoritative, clear, and professional male television news broadcast voice.';

    console.log(`[GeminiTTS] 🎙️ Synthesizing with Gemini TTS (voice: ${voiceName}) for: "${cleanText.substring(0, 40)}..."`);

    try {
      const response = await fetch(`${GeminiTtsService.GEMINI_TTS_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: cleanText }]
          }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName
                }
              }
            }
          }
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.warn(`[GeminiTTS] HTTP ${response.status}: ${errText.substring(0, 200)}`);
        return null;
      }

      const data = await response.json();
      
      // Extract base64 audio from response
      const audioData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        return Buffer.from(audioData, 'base64');
      }

      console.warn('[GeminiTTS] No audio data in response');
      return null;
    } catch (err: any) {
      console.warn(`[GeminiTTS] Synthesis error: ${err.message}`);
      return null;
    }
  }

  public async testConnection(): Promise<{ available: boolean; message: string; provider?: string }> {
    const apiKey =
      (await getDbSetting('GEMINI_API_KEY')) ||
      process.env.GEMINI_API_KEY ||
      config.GEMINI_API_KEY ||
      '';

    if (!apiKey) {
      return {
        available: false,
        message: 'No GEMINI_API_KEY configured. Get one at https://aistudio.google.com/apikey',
      };
    }

    try {
      const audio = await this.synthesize('Testing Gemini text to speech with Charon voice.');
      if (audio && audio.length > 500) {
        return {
          available: true,
          provider: 'Google AI Studio (Gemini TTS - Charon)',
          message: 'Gemini TTS is connected! Charon voice is ready.',
        };
      }
      return {
        available: false,
        provider: 'Google AI Studio',
        message: 'API key is set, but synthesis returned empty.',
      };
    } catch (err: any) {
      return {
        available: false,
        provider: 'Google AI Studio',
        message: `Gemini TTS error: ${err.message || err}`,
      };
    }
  }
}