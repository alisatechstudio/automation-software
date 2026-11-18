import type { ProcessedVideo, PublishResult, PublishTarget } from '../types/index.js';

export interface PublishOptions {
  video: ProcessedVideo;
  isDryRun: boolean;
  scheduledPublishTime?: Date;
}

export interface Publisher {
  readonly target: PublishTarget;
  publish(options: PublishOptions): Promise<PublishResult>;
}
