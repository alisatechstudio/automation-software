/**
 * SportsClipBot - Domain Types & Interfaces
 */

export type LicenseType =
  | 'OWNED_PERMISSION'
  | 'CC0'
  | 'CC_BY'
  | 'PEXELS'
  | 'PIXABAY'
  | 'LICENSED_PARTNER';

export type NonCommercialLicenseType =
  | 'CC_BY_NC'
  | 'CC_BY_NC_SA'
  | 'CC_BY_NC_ND'
  | 'ALL_RIGHTS_RESERVED'
  | 'UNKNOWN_LICENSE';

export interface ClipMeta {
  id: string;
  title: string;
  url: string;
  licenseType: LicenseType | string;
  licenseProofUrl: string;
  credit: string;
  publishedAt: string;
  sport: string;
  duration: number; // in seconds
  sourceName: string;
  rawMetadata?: Record<string, unknown>;
  localFilePath?: string;
}

export interface Source {
  name: string;
  fetchRecent(): Promise<ClipMeta[]>;
}

export type ComplianceCheckName =
  | 'LICENSE'
  | 'MUSIC'
  | 'WATERMARK'
  | 'ORIGINALITY'
  | 'ADVERTISER_FRIENDLINESS'
  | 'METADATA_HONESTY'
  | 'DISCLOSURE'
  | 'FORMAT'
  | 'VOLUME';

export interface ComplianceCheckResult {
  checkName: ComplianceCheckName;
  passed: boolean;
  score?: number;
  reason: string;
  details?: Record<string, unknown>;
  evaluatedAt: string;
}

export interface ComplianceReport {
  clipId: string;
  passed: boolean;
  checks: ComplianceCheckResult[];
  summary: string;
  evaluatedAt: string;
}

export interface OriginalityMetrics {
  totalDuration: number;
  licensedFootageDuration: number;
  licensedFootageRatio: number; // e.g. 0.55 (<= 0.60)
  originalContentRatio: number; // e.g. 0.45 (>= 0.40)
  hasOriginalVoiceover: boolean;
  hasOriginalGraphics: boolean;
  maxTextSimilarityToHistory: number; // 0 to 1
  minFrameDistanceToHistory: number; // perceptual hash distance (higher = more unique)
}

export interface ProcessedVideo {
  id: string;
  sourceClipId: string;
  videoPath: string;
  thumbnailPath: string;
  duration: number;
  title: string;
  description: string;
  tags: string[];
  script: string;
  containsSyntheticMedia: boolean;
  selfDeclaredMadeForKids: boolean;
  complianceReport: ComplianceReport;
  aspectRatio: '9:16';
  width: number;
  height: number;
  createdAt: string;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ApprovalRecord {
  id: string;
  videoId: string;
  status: ApprovalStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export type PublishTarget = 'YOUTUBE' | 'FACEBOOK';

export interface PublishResult {
  target: PublishTarget;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED_DRY_RUN';
  externalId?: string;
  externalUrl?: string;
  publishedAt?: string;
  error?: string;
}

export interface EditGraphicCard {
  title: string;
  statOrFact: string;
  subtitle?: string;
  startTime: number;
  duration: number;
}

export interface EditOptions {
  sourceVideoPath: string;
  outputPath: string;
  thumbnailOutputPath: string;
  targetDurationSec: number;
  clipMeta: ClipMeta;
  script: string;
  voiceoverAudioPath?: string;
  backgroundMusicPath?: string;
  graphicsCards?: EditGraphicCard[];
  captionsSrtPath?: string;
  channelLogoPath?: string;
}

export interface EditResult {
  outputPath: string;
  thumbnailPath: string;
  duration: number;
  width: number;
  height: number;
  originalityMetrics: OriginalityMetrics;
}

export interface Editor {
  name: string;
  process(options: EditOptions): Promise<EditResult>;
}

export interface MonitoringEvent {
  id: string;
  platform: PublishTarget;
  externalId: string;
  eventType: 'COPYRIGHT_CLAIM' | 'CONTENT_ID_MATCH' | 'STRIKE' | 'DEMONETIZATION' | 'POLICY_WARNING' | 'HEALTHY';
  details: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  detectedAt: string;
}
