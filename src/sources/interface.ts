import type { ClipMeta, Source } from '../types/index.js';

export type { ClipMeta, Source };

export interface SourcePlugin extends Source {
  readonly id: string;
  readonly isEnabled: boolean;
  init?(): Promise<void>;
}
