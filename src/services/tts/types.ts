export interface SynthesisOptions {
  voice?: string;
  speed?: number;
  isEnglish?: boolean;
  provider?: string;
  model?: string;
  instructions?: string;
}

export interface TtsConnectionStatus {
  available: boolean;
  activeProvider: string;
  model?: string;
  voice?: string;
  message: string;
  providers?: {
    puter: boolean;
    huggingface: boolean;
  };
}

