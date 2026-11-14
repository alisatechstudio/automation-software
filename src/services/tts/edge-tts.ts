import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { EdgeTTS } from 'node-edge-tts';
// @ts-ignore
import { WebSocket } from 'ws';
// @ts-ignore
import {
  TRUSTED_CLIENT_TOKEN,
  generateSecMsGecToken_V2,
  SEC_MS_GEC_VERSION_V2,
  CHROMIUM_FULL_VERSION,
} from 'node-edge-tts/dist/drm.js';
// @ts-ignore
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SynthesisOptions, TtsConnectionStatus } from './types.js';
import { cleanSpeechScript } from './cleaner.js';

// Patch node-edge-tts WebSocket connection to avoid 429 errors caused by mismatched host header
(EdgeTTS.prototype as any)._connectWebSocket = async function (): Promise<any> {
  const wsConnect = new WebSocket(
    `wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${generateSecMsGecToken_V2()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION_V2}`,
    {
      origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      headers: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0 Safari/537.36 Edg/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0`,
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      agent: this.proxy ? new HttpsProxyAgent(this.proxy) : undefined,
    }
  );

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out while connecting to Edge TTS'));
      wsConnect.terminate();
    }, this.timeout || 15000);

    const onOpen = () => {
      clearTimeout(timeout);
      resolve(wsConnect);
    };
    const onError = (error: any) => {
      clearTimeout(timeout);
      reject(error);
    };
    const onClose = () => {
      clearTimeout(timeout);
      wsConnect.off('open', onOpen);
      wsConnect.off('error', onError);
      reject(new Error('WebSocket closed before the connection was established'));
    };

    wsConnect.once('open', onOpen);
    wsConnect.on('error', onError);
    wsConnect.once('close', onClose);
  });
};

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

    console.log(`[EdgeTTS] 🎙️ Synthesizing (${voice}): "${cleanText.substring(0, 50)}..."`);

    // Retry loop (up to 2 attempts)
    for (let attempt = 1; attempt <= 2; attempt++) {
      const tempFile = path.join(tempDir, `edge_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp3`);
      try {
        const tts = new EdgeTTS({
          voice,
          lang: isEn ? 'en-US' : 'bn-BD',
          outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
          timeout: 15000,
        });

        await tts.ttsPromise(cleanText, tempFile);

        if (!fs.existsSync(tempFile)) {
          console.warn(`[EdgeTTS] Attempt ${attempt}: Temp output file not created`);
          continue;
        }

        const buffer = fs.readFileSync(tempFile);
        try {
          fs.unlinkSync(tempFile);
        } catch (_) {}

        if (buffer.length < 500) {
          console.warn(`[EdgeTTS] Attempt ${attempt}: Generated buffer too small (${buffer.length} bytes)`);
          continue;
        }

        console.log(`[EdgeTTS] ✅ Voiceover generated successfully (${buffer.length} bytes, voice: ${voice})`);
        return buffer;
      } catch (err: any) {
        console.warn(`[EdgeTTS] Attempt ${attempt} failed: ${err.message || err}`);
        if (fs.existsSync(tempFile)) {
          try { fs.unlinkSync(tempFile); } catch (_) {}
        }
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }

    console.warn(`[EdgeTTS] ❌ All synthesis attempts failed for voice: ${voice}`);
    return null;
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
