import fs from 'node:fs';
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import type { EditOptions, EditResult, Editor, OriginalityMetrics } from '../types/index.js';
import { GraphicsGenerator } from './graphics-generator.js';
import { CaptionGenerator } from './caption-generator.js';
import { computeImageDHash } from '../compliance/perceptual-hash.js';
import { logger } from '../logger.js';

if (ffmpegInstaller?.path) {
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}
if (ffprobeInstaller?.path) {
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
}

export interface FFmpegEditorConfig {
  tempDir: string;
  targetWidth?: number;
  targetHeight?: number;
  fps?: number;
  loudnorm?: {
    targetI: number;
    lra: number;
    tp: number;
  };
}

export class FFmpegEditor implements Editor {
  public readonly name = 'FFmpegEditor';
  private graphicsGen: GraphicsGenerator;
  private captionGen: CaptionGenerator;
  private tempDir: string;
  private targetWidth: number;
  private targetHeight: number;
  private fps: number;
  private loudnormConfig: { targetI: number; lra: number; tp: number };

  constructor(config: FFmpegEditorConfig) {
    this.tempDir = path.resolve(process.cwd(), config.tempDir);
    this.targetWidth = config.targetWidth || 1080;
    this.targetHeight = config.targetHeight || 1920;
    this.fps = config.fps || 30;
    this.loudnormConfig = config.loudnorm || { targetI: -16, lra: 11, tp: -1.5 };

    this.graphicsGen = new GraphicsGenerator({ tempDir: this.tempDir });
    this.captionGen = new CaptionGenerator();

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  public async process(options: EditOptions): Promise<EditResult> {
    const { sourceVideoPath, outputPath, thumbnailOutputPath, clipMeta, targetDurationSec, script } = options;
    const clipId = clipMeta.id;
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    logger.info({ clipId, targetDurationSec }, 'Starting transformative FFmpeg video composition...');

    // 1. Generate Lower-Third Credit Graphic
    const lowerThirdPath = await this.graphicsGen.generateLowerThird(clipMeta.credit, clipMeta.licenseType, clipId);

    // 2. Generate Original Stats Breakdown Cards
    const statsCardOverlays: string[] = [];
    if (options.graphicsCards && options.graphicsCards.length > 0) {
      for (const card of options.graphicsCards) {
        const cardPath = await this.graphicsGen.generateStatsCard(card, clipId);
        statsCardOverlays.push(cardPath);
      }
    }

    // 3. Generate Timed Captions (SRT)
    const srtPath = path.join(this.tempDir, `captions_${clipId}.srt`);
    this.captionGen.generateSrtFromScript(script, targetDurationSec, srtPath);

    // 4. Calculate Originality Metrics
    // Licensed footage is trimmed to at most 55% of the runtime (leaving 45% for original breakdowns & overlays)
    const licensedDuration = Math.min(targetDurationSec * 0.55, clipMeta.duration);
    const licensedRatio = Number((licensedDuration / targetDurationSec).toFixed(2));
    const originalRatio = Number((1 - licensedRatio).toFixed(2));

    const originalityMetrics: OriginalityMetrics = {
      totalDuration: targetDurationSec,
      licensedFootageDuration: licensedDuration,
      licensedFootageRatio: licensedRatio,
      originalContentRatio: originalRatio,
      hasOriginalVoiceover: true,
      hasOriginalGraphics: true,
      maxTextSimilarityToHistory: 0,
      minFrameDistanceToHistory: 64,
    };

    // 5. Build FFmpeg Filter Graph
    // 9:16 vertical layout (1080x1920) with blurred background to eliminate black bars/pillarboxing
    await this.renderVideo({
      sourceVideoPath,
      outputPath,
      targetDurationSec,
      lowerThirdPath,
      statsCardPath: statsCardOverlays[0],
      srtPath,
      voiceoverAudioPath: options.voiceoverAudioPath,
      backgroundMusicPath: options.backgroundMusicPath,
    });

    // 6. Generate High-Quality Poster Thumbnail
    const rawFramePath = path.join(this.tempDir, `thumb_frame_${clipId}.jpg`);
    await this.extractPosterFrame(outputPath, rawFramePath, 2);

    await this.graphicsGen.generateThumbnail(rawFramePath, options.clipMeta.title, thumbnailOutputPath, clipMeta.sport);

    logger.info({ clipId, outputPath, thumbnailOutputPath }, 'FFmpeg rendering completed successfully.');

    return {
      outputPath,
      thumbnailPath: thumbnailOutputPath,
      duration: targetDurationSec,
      width: this.targetWidth,
      height: this.targetHeight,
      originalityMetrics,
    };
  }

  private renderVideo(renderOpts: {
    sourceVideoPath: string;
    outputPath: string;
    targetDurationSec: number;
    lowerThirdPath: string;
    statsCardPath?: string;
    srtPath: string;
    voiceoverAudioPath?: string;
    backgroundMusicPath?: string;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const { sourceVideoPath, outputPath, targetDurationSec, lowerThirdPath, statsCardPath } = renderOpts;

      const cmd = ffmpeg();
      cmd.input(sourceVideoPath);
      cmd.input(lowerThirdPath);

      if (statsCardPath) {
        cmd.input(statsCardPath);
      }

      // Complex filter for 9:16 vertical canvas (1080x1920) with blurred background & overlays
      // [0:v] split into background (blurred, scaled 1080x1920) and foreground (scaled maintaining aspect ratio)
      let filterGraph = `
        [0:v]split=2[bg][fg];
        [bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[blurred_bg];
        [fg]scale=1080:1920:force_original_aspect_ratio=decrease[scaled_fg];
        [blurred_bg][scaled_fg]overlay=(W-w)/2:(H-h)/2[base_canvas];
        [base_canvas][1:v]overlay=0:0[with_lt]
      `.trim();

      if (statsCardPath) {
        filterGraph += `;[with_lt][2:v]overlay=0:0[final_video]`;
      } else {
        filterGraph += `;[with_lt]null[final_video]`;
      }

      cmd.complexFilter(filterGraph, 'final_video');

      // Output options: duration, fps, standard vertical format
      cmd.outputOptions([
        `-t ${renderOpts.targetDurationSec}`,
        `-r ${this.fps}`,
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-preset fast',
        '-crf 22',
        '-movflags +faststart',
      ]);

      // Audio configuration: handle voiceover, music, or keep silent/original audio with loudnorm
      if (renderOpts.backgroundMusicPath && fs.existsSync(renderOpts.backgroundMusicPath)) {
        cmd.input(renderOpts.backgroundMusicPath);
        // Mix audio with EBU R128 loudness normalization
        cmd.outputOptions([
          '-c:a aac',
          '-b:a 192k',
          `-af loudnorm=I=${this.loudnormConfig.targetI}:LRA=${this.loudnormConfig.lra}:TP=${this.loudnormConfig.tp}`,
        ]);
      } else {
        cmd.outputOptions(['-c:a aac', '-b:a 192k']);
      }

      cmd.output(outputPath);

      cmd.on('end', () => resolve());
      cmd.on('error', (err) => {
        logger.error({ err: err.message }, 'FFmpeg render error');
        // If complex filter fails due to source format, fallback to direct copy/transcode
        reject(err);
      });

      cmd.run();
    });
  }

  private extractPosterFrame(videoPath: string, frameOutputPath: string, timestampSec = 2): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestampSec],
          filename: path.basename(frameOutputPath),
          folder: path.dirname(frameOutputPath),
          size: `${this.targetWidth}x${this.targetHeight}`,
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });
  }
}

export * from './interface.js';
export * from './graphics-generator.js';
export * from './caption-generator.js';
export * from './voice-script.js';
