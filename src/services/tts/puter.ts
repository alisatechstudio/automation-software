import { config } from '../../config/env.js';
import { getDbSetting } from '../settings.js';
import { SynthesisOptions } from './types.js';

/**
 * Resolves TTS provider config from DB settings → process.env → app config defaults.
 * Default chain: openai / gpt-4o-mini-tts / onyx  (working, male, news anchor quality)
 */
async function resolveTtsConfig(): Promise<{
  token: string;
  provider: string;
  model: string;
  voice: string;
  instructions: string;
}> {
  const token =
    (await getDbSetting('PUTER_AUTH_TOKEN')) ||
    process.env.PUTER_AUTH_TOKEN ||
    config.PUTER_AUTH_TOKEN ||
    '';

  const provider =
    (await getDbSetting('PUTER_TTS_PROVIDER')) ||
    process.env.PUTER_TTS_PROVIDER ||
    'openai';

  const model =
    (await getDbSetting('PUTER_TTS_MODEL')) ||
    process.env.PUTER_TTS_MODEL ||
    'gpt-4o-mini-tts';

  const voice =
    (await getDbSetting('PUTER_TTS_VOICE')) ||
    process.env.PUTER_TTS_VOICE ||
    'onyx';

  const instructions =
    (await getDbSetting('PUTER_TTS_INSTRUCTIONS')) ||
    process.env.PUTER_TTS_INSTRUCTIONS ||
    'Speak in a confident, authoritative, clear, and professional male Bangladeshi television news broadcast voice.';

  return { token, provider, model, voice, instructions };
}

export class PuterTtsService {
  private puterInstance: any = null;

  private async getPuterClient(token: string): Promise<any> {
    if (!this.puterInstance) {
      try {
        const { puter } = await import('@heyputer/puter.js');
        puter.quiet = true;
        this.puterInstance = puter;
        console.log('[PuterTTS] Successfully loaded @heyputer/puter.js');
      } catch (err: any) {
        console.warn(`[PuterTTS] Could not import @heyputer/puter.js: ${err.message}`);
        return null;
      }
    }

    if (this.puterInstance && token) {
      try {
        this.puterInstance.setAuthToken(token);
      } catch (e) {
        console.warn('[PuterTTS] Failed to set auth token:', e);
      }
    }

    return this.puterInstance;
  }

  public async synthesize(
    text: string,
    options?: SynthesisOptions
  ): Promise<Buffer | null> {
    const cleanText = (text || '').trim();
    if (!cleanText) return null;

    const { token, provider, model, voice: defaultVoice, instructions } = await resolveTtsConfig();
    const voice = options?.voice || defaultVoice;
    const speakInstructions = options?.instructions || instructions;

    if (!token) {
      console.warn('[PuterTTS] No PUTER_AUTH_TOKEN found');
      return null;
    }

    console.log(`[PuterTTS] Token found (${token.substring(0, 20)}...), provider: ${provider}, model: ${model}, voice: ${voice}`);
    console.log(`[PuterTTS] 🎙️ Synthesizing: "${cleanText.substring(0, 60)}..."`);

    // 1. Try via @heyputer/puter.js SDK
    try {
      const puter = await this.getPuterClient(token);
      if (puter && puter.ai && typeof puter.ai.txt2speech === 'function') {
        const ttsOptions: Record<string, any> = { provider, voice, model };
        if (provider === 'openai') ttsOptions.instructions = speakInstructions;
        if (provider === 'gemini') ttsOptions.instructions = speakInstructions;

        console.log('[PuterTTS] Attempting SDK synthesis...');
        const audioResult = await puter.ai.txt2speech(cleanText, ttsOptions);
        const buffer = await this.extractAudioBuffer(audioResult);
        if (buffer && buffer.length > 500) {
          console.log(`[PuterTTS] SDK synthesis success: ${buffer.length} bytes`);
          return buffer;
        }
        console.warn('[PuterTTS] SDK returned empty/invalid audio, falling back to REST API...');
      } else {
        console.warn('[PuterTTS] SDK not available or txt2speech not a function');
      }
    } catch (sdkErr: any) {
      console.warn(`[PuterTTS] SDK error: ${sdkErr.message || sdkErr}. Falling back to REST API...`);
    }

    // 2. REST API fallback
    try {
      console.log('[PuterTTS] Attempting REST API synthesis...');
      const restBuf = await this.synthesizeWithRestApi(cleanText, token, {
        provider,
        model,
        voice,
        instructions: speakInstructions,
      });
      if (restBuf && restBuf.length > 500) {
        console.log(`[PuterTTS] REST API synthesis success: ${restBuf.length} bytes`);
        return restBuf;
      }
      console.warn('[PuterTTS] REST API returned empty/invalid audio');
    } catch (restErr: any) {
      console.warn(`[PuterTTS] REST API error: ${restErr.message || restErr}`);
    }

    console.warn('[PuterTTS] All synthesis attempts failed');
    return null;
  }

  private async synthesizeWithRestApi(
    text: string,
    token: string,
    params: { provider: string; model?: string; voice?: string; instructions?: string }
  ): Promise<Buffer | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const bodyPayload: Record<string, any> = {
      interface: 'puter-tts',
      driver: 'ai-tts',
      test_mode: false,
      method: 'synthesize',
      args: {
        text,
        provider: params.provider,
        voice: params.voice,
      },
      auth_token: token,
    };
    if (params.model) bodyPayload.args.model = params.model;
    // instructions supported by openai and gemini providers
    if ((params.provider === 'openai' || params.provider === 'gemini') && params.instructions) {
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
      console.warn(`[PuterTTS - REST] HTTP ${response.status}: ${errText.substring(0, 200)}`);
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

  private async extractAudioBuffer(audioOutput: any): Promise<Buffer | null> {
    if (!audioOutput) return null;

    if (Buffer.isBuffer(audioOutput)) return audioOutput;
    if (audioOutput instanceof ArrayBuffer) return Buffer.from(audioOutput);

    if (typeof audioOutput === 'string') {
      if (audioOutput.startsWith('data:audio/')) return this.dataUrlToBuffer(audioOutput);
      if (audioOutput.startsWith('http://') || audioOutput.startsWith('https://')) {
        const res = await fetch(audioOutput);
        if (res.ok) return Buffer.from(await res.arrayBuffer());
      }
    }

    const src =
      audioOutput.src ||
      (typeof audioOutput.toString === 'function' ? audioOutput.toString() : '');
    if (typeof src === 'string' && src.startsWith('data:audio/')) return this.dataUrlToBuffer(src);
    if (typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'))) {
      const res = await fetch(src);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    }

    if (audioOutput.audio && typeof audioOutput.audio === 'string') {
      return this.extractAudioBuffer(audioOutput.audio);
    }

    return null;
  }

  private dataUrlToBuffer(dataUrl: string): Buffer | null {
    try {
      const commaIndex = dataUrl.indexOf(',');
      if (commaIndex === -1) return null;
      return Buffer.from(dataUrl.substring(commaIndex + 1), 'base64');
    } catch {
      return null;
    }
  }

  public async testConnection(): Promise<{ available: boolean; message: string; provider?: string }> {
    const { token, provider, voice } = await resolveTtsConfig();

    if (!token) {
      return {
        available: false,
        message: 'No PUTER_AUTH_TOKEN configured. Get a free API token at https://puter.com/dashboard#account.',
      };
    }

    try {
      const audio = await this.synthesize('Testing text to speech for news broadcast.');
      if (audio && audio.length > 500) {
        return {
          available: true,
          provider: `Puter.js (${provider} - ${voice})`,
          message: `Puter.js TTS is connected! ${voice} voice (${provider}) is ready.`,
        };
      }
      return {
        available: false,
        provider: `Puter.js (${provider})`,
        message: 'Puter API token is set, but synthesis returned empty.',
      };
    } catch (err: any) {
      return {
        available: false,
        provider: `Puter.js (${provider})`,
        message: `Puter.js error: ${err.message || err}`,
      };
    }
  }
}
