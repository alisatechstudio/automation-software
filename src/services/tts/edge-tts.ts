import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { EdgeTTS } from 'node-edge-tts';
import { SynthesisOptions, TtsConnectionStatus } from './types.js';
import { cleanSpeechScript } from './cleaner.js';

/**
 * EdgeTtsService — High-quality, natural neural voice narration powered by Microsoft Edge TTS.
 * 
 * Complies with YouTube & Meta monetization policies by providing real, expressive neural speech
 * reading the news story rather than silent cards with background music.
 *
 * Bengali default: bn-BD-PradeepNeural (crisp, professional news presenter)
 * English default: en-US-GuyNeural (authoritative, clear news broadcast)
 */
export class EdgeTtsService {
  public static readonly BENGALI_VOICE = 'bn-BD-PradeepNeural';
  public static readonly ENGLISH_VOICE = 'en-US-GuyNeural';

  private isBengali(text: string): boolean {
    const nonAscii = (text.match(/[^\x00-\x7F]/g) || []).length;
    return nonAscii / text.length > 0.4;
  }

  public cleanDescription(description?: string, headline?: string): string {
    return cleanSpeechScript(description, headline);
  }

  public async synthesize(
    text: string,
    options?: SynthesisOptions
  ): Promise<Buffer | null> {
    const cleanText = (text || '').trim();
    if (!cleanText) return null;

    const isEn = options?.isEnglish !== undefined ? options.isEnglish : !this.isBengali(cleanText);
    const voice = options?.voice || (isEn ? EdgeTtsService.ENGLISH_VOICE : EdgeTtsService.BENGALI_VOICE);

    const tempDir = process.env.VERCEL ? '/tmp' : os.tmpdir();
    const tempFile = path.join(tempDir, `edge_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp3`);

    console.log(`[EdgeTTS] 🎙️ Synthesizing (${voice}): "${cleanText.substring(0, 50)}..."`);

    try {
      const tts = new EdgeTTS({
        voice,
        lang: isEn ? 'en-US' : 'bn-BD',
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
        timeout: 15000,
      });

      await tts.ttsPromise(cleanText, tempFile);

      if (!fs.existsSync(tempFile)) {
        console.warn('[EdgeTTS] Temp output file not created');
        return null;
      }

      const buffer = fs.readFileSync(tempFile);
      try {
        fs.unlinkSync(tempFile);
      } catch (_) {}

      if (buffer.length < 500) {
        console.warn(`[EdgeTTS] Generated audio buffer too small (${buffer.length} bytes)`);
        return null;
      }

      console.log(`[EdgeTTS] ✅ Voiceover generated successfully (${buffer.length} bytes, voice: ${voice})`);
      return buffer;
    } catch (err: any) {
      console.warn(`[EdgeTTS] Synthesis failed: ${err.message || err}`);
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch (_) {}
      }
      return null;
    }
  }

  public async testConnection(): Promise<TtsConnectionStatus> {
    try {
      const audio = await this.synthesize('এটি সংবাদ পরীক্ষার একটি বার্তা।', {
        voice: EdgeTtsService.BENGALI_VOICE,
        isEnglish: false,
      });

      if (audio && audio.length > 500) {
        return {
          available: true,
          activeProvider: 'Edge TTS',
          voice: EdgeTtsService.BENGALI_VOICE,
          message: 'Microsoft Edge Neural TTS is active and generating speech.',
        };
      }

      return {
        available: false,
        activeProvider: 'Edge TTS',
        message: 'Edge TTS synthesis returned empty buffer.',
      };
    } catch (err: any) {
      return {
        available: false,
        activeProvider: 'Edge TTS',
        message: `Edge TTS connection error: ${err.message || err}`,
      };
    }
  }
}
