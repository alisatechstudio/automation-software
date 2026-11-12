import { IsomorphicEdgeTTS } from 'edge-tts-universal';
import { SynthesisOptions } from './types.js';

/**
 * EdgeTtsService — free, high-quality TTS via Microsoft Edge neural voices.
 *
 * Uses `edge-tts-universal` (IsomorphicEdgeTTS) with no API key required.
 * Bengali voice : bn-BD-PradeepNeural  (native male, news-category, clear)
 * English voice : en-US-GuyNeural      (deep, authoritative male)
 *
 * Acts as tier-2 fallback between Puter.js and Gemini API in the provider chain.
 */
export class EdgeTtsService {
  public static readonly BENGALI_MALE_VOICE = 'bn-BD-PradeepNeural';
  public static readonly ENGLISH_MALE_VOICE  = 'en-US-GuyNeural';

  /** Heuristic: >40% of chars are non-ASCII → treat as Bengali */
  private isBengali(text: string): boolean {
    const nonAscii = (text.match(/[^\x00-\x7F]/g) || []).length;
    return nonAscii / text.length > 0.4;
  }

  public async synthesize(
    text: string,
    options?: SynthesisOptions
  ): Promise<Buffer | null> {
    const cleanText = (text || '').trim();
    if (!cleanText) return null;

    const voice =
      options?.voice ||
      (this.isBengali(cleanText)
        ? EdgeTtsService.BENGALI_MALE_VOICE
        : EdgeTtsService.ENGLISH_MALE_VOICE);

    console.log(`[EdgeTTS] 🎙️ Synthesizing with ${voice}: "${cleanText.substring(0, 60)}..."`);

    try {
      const tts = new IsomorphicEdgeTTS(cleanText, voice);
      const result = await tts.synthesize();

      const blob: Blob = result.audio;
      if (!blob || blob.size < 500) {
        console.warn(`[EdgeTTS] Audio blob too small or empty (${blob?.size ?? 0} bytes)`);
        return null;
      }

      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`[EdgeTTS] ✅ Synthesis success: ${buffer.length} bytes, voice: ${voice}`);
      return buffer;
    } catch (err: any) {
      console.warn(`[EdgeTTS] Synthesis error: ${err.message || err}`);
      return null;
    }
  }

  public async testConnection(): Promise<{ available: boolean; message: string; provider?: string }> {
    try {
      // Test with a short Bengali sentence
      const audio = await this.synthesize('সংবাদ পরীক্ষা।');
      if (audio && audio.length > 500) {
        return {
          available: true,
          provider: `Edge TTS (${EdgeTtsService.BENGALI_MALE_VOICE})`,
          message: `Edge TTS ready — Bengali: ${EdgeTtsService.BENGALI_MALE_VOICE}, English: ${EdgeTtsService.ENGLISH_MALE_VOICE}`,
        };
      }
      return {
        available: false,
        provider: 'Edge TTS',
        message: 'Edge TTS synthesis returned empty. Check internet connectivity.',
      };
    } catch (err: any) {
      return {
        available: false,
        provider: 'Edge TTS',
        message: `Edge TTS error: ${err.message || err}`,
      };
    }
  }
}
