import { SynthesisOptions } from './types.js';

export class FreeBroadcastTtsService {
  /**
   * Synthesizes audio using zero-config broadcast TTS (supports both Bengali & English).
   * Automatically segments long paragraphs into natural sentence chunks and concatenates
   * the audio frames into a single MP3 Buffer.
   */
  public async synthesize(
    text: string,
    options?: SynthesisOptions
  ): Promise<Buffer | null> {
    const cleanText = (text || '').trim();
    if (!cleanText) return null;

    const lang = options?.isEnglish ? 'en' : 'bn';
    const chunks = this.splitIntoChunks(cleanText, 140);
    if (!chunks.length) return null;

    const audioBuffers: Buffer[] = [];

    for (const chunk of chunks) {
      try {
        const buf = await this.fetchAudioChunk(chunk, lang);
        if (buf && buf.length > 0) {
          audioBuffers.push(buf);
        }
      } catch (err: any) {
        console.warn(`[FreeBroadcastTTS] Chunk fetch error: ${err.message}`);
      }
    }

    if (!audioBuffers.length) return null;
    return Buffer.concat(audioBuffers);
  }

  private async fetchAudioChunk(text: string, lang: string): Promise<Buffer | null> {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  /**
   * Splits text into natural sentence or punctuation bounded segments <= maxLen
   */
  private splitIntoChunks(text: string, maxLen: number): string[] {
    const pieces = text.split(/([।?!,;\n]+)/);
    const result: string[] = [];
    let current = '';

    for (let i = 0; i < pieces.length; i += 2) {
      const segment = (pieces[i] || '') + (pieces[i + 1] || '');
      if (!segment.trim()) continue;

      if ((current + segment).length <= maxLen) {
        current += segment;
      } else {
        if (current.trim()) result.push(current.trim());
        if (segment.length > maxLen) {
          // Break by words
          const words = segment.split(/\s+/);
          let sub = '';
          for (const word of words) {
            if ((sub + ' ' + word).length <= maxLen) {
              sub += (sub ? ' ' : '') + word;
            } else {
              if (sub.trim()) result.push(sub.trim());
              sub = word;
            }
          }
          if (sub.trim()) current = sub;
        } else {
          current = segment;
        }
      }
    }

    if (current.trim()) {
      result.push(current.trim());
    }

    return result;
  }

  public async testConnection(): Promise<{ available: boolean; message: string; provider: string }> {
    try {
      const buf = await this.fetchAudioChunk('Test', 'en');
      if (buf && buf.length > 500) {
        return {
          available: true,
          provider: 'Free Broadcast TTS (Zero-Config)',
          message: 'Zero-config Broadcast TTS is online and available for instant speech synthesis!',
        };
      }
      return {
        available: false,
        provider: 'Free Broadcast TTS',
        message: 'Free Broadcast TTS endpoint did not return expected audio.',
      };
    } catch (err: any) {
      return {
        available: false,
        provider: 'Free Broadcast TTS',
        message: `Free Broadcast TTS error: ${err.message}`,
      };
    }
  }
}

