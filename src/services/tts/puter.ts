import { config } from '../../config/env.js';
import { getDbSetting } from '../settings.js';
import { SynthesisOptions } from './types.js';

export class PuterTtsService {
  private puterInstance: any = null;

  /**
   * Lazily loads and configures the @heyputer/puter.js instance with the active Puter Auth Token.
   */
  private async getPuterClient(token: string): Promise<any> {
    if (!this.puterInstance) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { puter } = await import('@heyputer/puter.js');
        puter.quiet = true;
        this.puterInstance = puter;
      } catch (err: any) {
        console.warn(`[PuterTTS] Could not import @heyputer/puter.js: ${err.message}`);
        return null;
      }
    }

    if (this.puterInstance && token) {
      try {
        this.puterInstance.setAuthToken(token);
      } catch (e) {}
    }

    return this.puterInstance;
  }

  /**
   * Synthesizes audio using Puter.js Text-to-Speech API.
   * Supports Google Gemini TTS, Speechify, xAI (Grok), and AWS Polly without individual provider API keys.
   */
  public async synthesize(
    text: string,
    options?: SynthesisOptions
  ): Promise<Buffer | null> {
    const cleanText = (text || '').trim();
    if (!cleanText) return null;

    const token =
      (await getDbSetting('PUTER_AUTH_TOKEN')) ||
      process.env.PUTER_AUTH_TOKEN ||
      config.PUTER_AUTH_TOKEN ||
      '';

    if (!token) {
      return null;
    }

    const provider =
      options?.provider ||
      (await getDbSetting('PUTER_TTS_PROVIDER')) ||
      config.PUTER_TTS_PROVIDER ||
      'gemini';

    const model =
      options?.model ||
      (await getDbSetting('PUTER_TTS_MODEL')) ||
      config.PUTER_TTS_MODEL ||
      (provider === 'gemini' ? 'gemini-3.8-flash-tts' : provider === 'speechify' ? 'simba-3.2' : undefined);

    const defaultVoice = provider === 'speechify' ? 'geffen_32' : provider === 'xai' ? 'eve' : 'Puck';
    const voice =
      options?.voice ||
      (await getDbSetting('PUTER_TTS_VOICE')) ||
      config.PUTER_TTS_VOICE ||
      defaultVoice;

    const instructions =
      options?.instructions ||
      (await getDbSetting('PUTER_TTS_INSTRUCTIONS')) ||
      config.PUTER_TTS_INSTRUCTIONS ||
      'Speak in a clear, engaging television news broadcast style.';

    console.log(`[PuterTTS] 🎙️ Calling Puter.js TTS (Provider: ${provider}, Model: ${model || 'default'}, Voice: ${voice}) for: "${cleanText.substring(0, 40)}..."`);

    // 1. Try via @heyputer/puter.js SDK
    try {
      const puter = await this.getPuterClient(token);
      if (puter && puter.ai && typeof puter.ai.txt2speech === 'function') {
        const ttsOptions: Record<string, any> = {
          provider: provider,
          voice: voice,
        };
        if (model) ttsOptions.model = model;
        if (provider === 'gemini' && instructions) ttsOptions.instructions = instructions;

        const audioResult = await puter.ai.txt2speech(cleanText, ttsOptions);
        const buffer = await this.extractAudioBuffer(audioResult);
        if (buffer && buffer.length > 500) {
          return buffer;
        }
      }
    } catch (sdkErr: any) {
      console.warn(`[PuterTTS] SDK attempt error (${sdkErr.message || sdkErr}). Falling back to direct API...`);
    }

    // 2. Direct HTTP REST API fallback to https://api.puter.com/drivers/call
    try {
      return await this.synthesizeWithRestApi(cleanText, token, {
        provider,
        model,
        voice,
        instructions,
      });
    } catch (restErr: any) {
      console.warn(`[PuterTTS] REST API error: ${restErr.message || restErr}`);
      return null;
    }
  }

  /**
   * Directly invokes Puter's core driver endpoint (https://api.puter.com/drivers/call)
   */
  private async synthesizeWithRestApi(
    text: string,
    token: string,
    params: { provider: string; model?: string; voice?: string; instructions?: string }
  ): Promise<Buffer | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    const bodyPayload: Record<string, any> = {
      interface: 'puter-tts',
      driver: 'ai-tts',
      test_mode: false,
      method: 'synthesize',
      args: {
        text: text,
        provider: params.provider,
        voice: params.voice,
      },
      auth_token: token,
    };
    if (params.model) bodyPayload.args.model = params.model;
    if (params.provider === 'gemini' && params.instructions) {
      bodyPayload.args.instructions = params.instructions;
    }

    const response = await fetch('https://api.puter.com/drivers/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`[PuterTTS - REST] HTTP ${response.status}: ${errText.substring(0, 150)}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('audio') || contentType.includes('octet-stream')) {
      const ab = await response.arrayBuffer();
      return Buffer.from(ab);
    }

    const jsonText = await response.text();
    try {
      const data = JSON.parse(jsonText);
      return await this.extractAudioBuffer(data);
    } catch {
      if (jsonText.startsWith('data:audio/')) {
        return this.dataUrlToBuffer(jsonText);
      }
    }

    return null;
  }

  /**
   * Helper that converts Puter.js audio output (Data URL, Audio Element, Blob URL, Object) into a Node Buffer
   */
  private async extractAudioBuffer(audioOutput: any): Promise<Buffer | null> {
    if (!audioOutput) return null;

    if (Buffer.isBuffer(audioOutput)) {
      return audioOutput;
    }

    if (audioOutput instanceof ArrayBuffer) {
      return Buffer.from(audioOutput);
    }

    if (typeof audioOutput === 'string') {
      if (audioOutput.startsWith('data:audio/')) {
        return this.dataUrlToBuffer(audioOutput);
      }
      if (audioOutput.startsWith('http://') || audioOutput.startsWith('https://')) {
        const res = await fetch(audioOutput);
        if (res.ok) {
          return Buffer.from(await res.arrayBuffer());
        }
      }
    }

    // Puter HTMLAudioElement wrapper
    const src = audioOutput.src || (typeof audioOutput.toString === 'function' ? audioOutput.toString() : '');
    if (typeof src === 'string' && src.startsWith('data:audio/')) {
      return this.dataUrlToBuffer(src);
    }
    if (typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'))) {
      const res = await fetch(src);
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    }

    // Direct audio data fields
    if (audioOutput.audio && typeof audioOutput.audio === 'string') {
      return this.extractAudioBuffer(audioOutput.audio);
    }

    return null;
  }

  private dataUrlToBuffer(dataUrl: string): Buffer | null {
    try {
      const commaIndex = dataUrl.indexOf(',');
      if (commaIndex === -1) return null;
      const base64 = dataUrl.substring(commaIndex + 1);
      return Buffer.from(base64, 'base64');
    } catch {
      return null;
    }
  }

  /**
   * Tests connectivity to Puter.js TTS with active token.
   */
  public async testConnection(): Promise<{ available: boolean; message: string; provider?: string }> {
    const token =
      (await getDbSetting('PUTER_AUTH_TOKEN')) ||
      process.env.PUTER_AUTH_TOKEN ||
      config.PUTER_AUTH_TOKEN ||
      '';

    if (!token) {
      return {
        available: false,
        message: 'No PUTER_AUTH_TOKEN configured. Get a free API token in 10 seconds at https://puter.com/dashboard#account.',
      };
    }

    try {
      const audio = await this.synthesize('Testing Puter.js text to speech.');
      if (audio && audio.length > 500) {
        return {
          available: true,
          provider: 'Puter.js (Unlimited Free TTS)',
          message: 'Puter.js TTS is connected and synthesizing audio successfully!',
        };
      }
      return {
        available: false,
        provider: 'Puter.js',
        message: 'Puter API token is set, but the synthesis request returned empty. Please check your token validity.',
      };
    } catch (err: any) {
      return {
        available: false,
        provider: 'Puter.js',
        message: `Puter.js error: ${err.message || err}`,
      };
    }
  }
}

