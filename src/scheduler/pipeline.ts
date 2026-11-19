import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type { DbRepository } from '../db/repository.js';
import type { LoadedConfig } from '../config/index.js';
import { ComplianceGate } from '../compliance/gate.js';
import { FFmpegEditor } from '../editor/ffmpeg-editor.js';
import { VoiceScriptGenerator } from '../editor/voice-script.js';
import { fetchFromAllSources, createSources } from '../sources/index.js';
import { computeImageDHash } from '../compliance/perceptual-hash.js';
import { GoogleDriveUploader } from '../services/gdrive-uploader.js';
import type { TelegramApprovalBot } from '../approval/telegram-bot.js';
import type { ClipMeta, ProcessedVideo } from '../types/index.js';
import { logger } from '../logger.js';

export class SportsClipPipeline {
  private repo: DbRepository;
  private config: LoadedConfig;
  private gate: ComplianceGate;
  private editor: FFmpegEditor;
  private scriptGen: VoiceScriptGenerator;
  private gdriveUploader: GoogleDriveUploader;
  private telegramBot?: TelegramApprovalBot;

  constructor(
    repo: DbRepository,
    config: LoadedConfig,
    telegramBot?: TelegramApprovalBot
  ) {
    this.repo = repo;
    this.config = config;
    this.telegramBot = telegramBot;

    this.gate = new ComplianceGate(repo, config);
    this.editor = new FFmpegEditor({
      tempDir: config.config.app.tempDir,
      targetWidth: config.config.editor.targetWidth,
      targetHeight: config.config.editor.targetHeight,
      fps: config.config.editor.fps,
      loudnorm: config.config.editor.loudnorm,
    });
    this.scriptGen = new VoiceScriptGenerator(config.env.ANTHROPIC_API_KEY);
    this.gdriveUploader = new GoogleDriveUploader(
      repo,
      process.env.GDRIVE_SPORTS_FOLDER_ID || '1E7y1TxCkbd7UJUeGG5oEb9hmXwcMKlFh'
    );
  }

  /**
   * Runs the complete ingestion, transformation, compliance evaluation, and review submission workflow.
   */
  public async runCycle(): Promise<{ ingested: number; processed: number; submittedForApproval: number }> {
    const { isPaused, reason } = await this.repo.isPipelinePaused();
    if (isPaused) {
      logger.warn({ reason }, 'Pipeline cycle skipped: System is in PAUSED state.');
      return { ingested: 0, processed: 0, submittedForApproval: 0 };
    }

    logger.info('--- Starting SportsClipBot Automated Pipeline Cycle ---');

    // 1. Sourcing
    const sources = createSources(this.config);
    const candidateClips = await fetchFromAllSources(sources);
    logger.info({ count: candidateClips.length }, 'Discovered candidate clips from licensed sources');

    let processedCount = 0;
    let submittedCount = 0;

    for (const clip of candidateClips) {
      // Check if clip has already been processed or rejected
      const existing = await this.repo.getClip(clip.id);
      if (existing && ['COMPLIANCE_PASSED', 'COMPLIANCE_FAILED', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED'].includes(existing.status)) {
        continue;
      }

      await this.repo.saveClip(clip);

      // Verify and download/locate video file
      const videoPath = clip.localFilePath || clip.url;
      if (!videoPath.startsWith('file://') && !videoPath.includes('/') && !videoPath.includes('\\')) {
        continue;
      }

      let cleanFilePath = videoPath.replace(/^file:\/\//, '');

      // Download remote asset to temp file if HTTP/HTTPS
      if (cleanFilePath.startsWith('http://') || cleanFilePath.startsWith('https://')) {
        try {
          const configuredTemp = this.config.config.app.tempDir || './data/temp';
          let tempDir = path.isAbsolute(configuredTemp) ? configuredTemp : path.resolve(process.cwd(), configuredTemp);
          try {
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
          } catch {
            tempDir = path.join(os.tmpdir(), 'sports_clip_bot_temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
          }
          const parsedUrl = new URL(cleanFilePath);
          const ext = path.extname(parsedUrl.pathname) || '.mp4';
          const localDest = path.join(tempDir, `remote_${clip.id}${ext}`);
          if (!fs.existsSync(localDest) || fs.statSync(localDest).size === 0) {
            logger.info({ clipId: clip.id, url: cleanFilePath }, 'Downloading remote video asset...');
            const r = await fetch(cleanFilePath);
            if (r.ok) {
              const buf = Buffer.from(await r.arrayBuffer());
              fs.writeFileSync(localDest, buf);
              cleanFilePath = localDest;
            }
          } else {
            cleanFilePath = localDest;
          }
        } catch (dlErr: any) {
          logger.warn({ clipId: clip.id, err: dlErr.message }, 'Could not pre-download remote asset; using URL directly.');
        }
      }

      try {
        const success = await this.processSingleClip(clip, cleanFilePath);
        processedCount++;
        if (success) submittedCount++;
      } catch (err: any) {
        logger.error({ clipId: clip.id, err: err.message }, 'Failed processing clip through pipeline');
        await this.repo.updateClipStatus(clip.id, 'ERROR', err.message);
      }
    }

    return {
      ingested: candidateClips.length,
      processed: processedCount,
      submittedForApproval: submittedCount,
    };
  }

  public async processSingleClip(clip: ClipMeta, localSourceVideoPath: string): Promise<boolean> {
    const targetDuration = Math.min(
      Math.max(clip.duration, this.config.config.compliance.minDurationSec),
      this.config.config.compliance.maxDurationSec
    );

    // 1. Generate Voiceover Script & Original Graphics metadata
    logger.info({ clipId: clip.id }, 'Generating original script and breakdown cards via Claude API...');
    const scriptData = await this.scriptGen.generateScript(clip, targetDuration);

    // 2. Prepare file paths safely (with /tmp fallback for serverless read-only environments)
    const videoId = `video_${clip.id}_${Date.now()}`;
    const configuredOut = this.config.config.app.outputDir || './data/output';
    let outDir = path.isAbsolute(configuredOut) ? configuredOut : path.resolve(process.cwd(), configuredOut);
    try {
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    } catch {
      outDir = path.join(os.tmpdir(), 'sports_clip_bot_output');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    }
    const outputVideoPath = path.join(outDir, `${videoId}.mp4`);
    const outputThumbPath = path.join(outDir, `${videoId}_thumb.jpg`);

    // 3. Render Transformative Video (9:16 vertical, graphics, captions, lower-third, loudnorm)
    const editResult = await this.editor.process({
      sourceVideoPath: localSourceVideoPath,
      outputPath: outputVideoPath,
      thumbnailOutputPath: outputThumbPath,
      targetDurationSec: targetDuration,
      clipMeta: clip,
      script: scriptData.script,
      graphicsCards: scriptData.graphicsCards,
    });

    // 4. Compute Visual Perceptual Hash of generated thumbnail
    const pHash = await computeImageDHash(outputThumbPath);

    // 5. Build full description with mandatory disclosure & credit
    const formattedDescription = [
      scriptData.description,
      '',
      `Original Footage Licensed From: ${clip.credit}`,
      `License Type: ${clip.licenseType}`,
      `License Evidence Reference: ${clip.licenseProofUrl}`,
      '',
      'Altered or synthetic content: Sound or visuals were significantly edited or generated digitally.',
      'Educational sports analysis and biomechanics breakdown.',
      '',
      scriptData.tags.map((t) => `#${t.replace(/\s+/g, '')}`).join(' '),
    ].join('\n');

    // 6. Run Strict Compliance Gate (All 9 checks!)
    const report = await this.gate.evaluate({
      clip,
      width: editResult.width,
      height: editResult.height,
      duration: editResult.duration,
      title: scriptData.title,
      description: formattedDescription,
      tags: scriptData.tags,
      script: scriptData.script,
      perceptualHash: pHash,
      metrics: editResult.originalityMetrics,
      usesAiVoiceOrVisuals: true,
      containsSyntheticMedia: true,
      selfDeclaredMadeForKids: false,
      targetPlatform: 'YOUTUBE',
    });

    if (!report.passed) {
      logger.warn({ clipId: clip.id, summary: report.summary }, 'Video rejected by Compliance Gate. Cannot publish.');
      return false;
    }

    // 6B. Save qualified video to Google Drive folder before post
    logger.info({ videoId, clipId: clip.id }, '✓ Clip qualified by Compliance Gate! Staging video into Google Drive folder before post...');
    const gdriveUpload = await this.gdriveUploader.uploadQualifiedVideo({
      videoPath: outputVideoPath,
      filename: `${videoId}.mp4`,
      title: scriptData.title,
    });

    // 7. Save Processed Video & Create Pending Approval
    const processedVideo: ProcessedVideo & { perceptualHash: string; originalityRatio: number } = {
      id: videoId,
      sourceClipId: clip.id,
      videoPath: outputVideoPath,
      thumbnailPath: outputThumbPath,
      duration: editResult.duration,
      title: scriptData.title,
      description: formattedDescription,
      tags: scriptData.tags,
      script: scriptData.script,
      perceptualHash: pHash,
      containsSyntheticMedia: true,
      selfDeclaredMadeForKids: false,
      originalityRatio: editResult.originalityMetrics.originalContentRatio,
      aspectRatio: '9:16',
      width: editResult.width,
      height: editResult.height,
      gdriveFileId: gdriveUpload.fileId,
      gdriveWebViewLink: gdriveUpload.webViewLink,
      gdriveFolderId: gdriveUpload.folderId,
      gdriveFolderUrl: gdriveUpload.folderUrl,
      complianceReport: report,
      createdAt: new Date().toISOString(),
    };

    await this.repo.saveProcessedVideo(processedVideo);
    await this.repo.updateClipStatus(clip.id, 'PENDING_APPROVAL');

    // 8. Submit to Telegram Approval Bot if active
    if (this.telegramBot) {
      await this.telegramBot.sendApprovalRequest({
        videoId,
        title: scriptData.title,
        duration: editResult.duration,
        originalityRatio: editResult.originalityMetrics.originalContentRatio,
        licenseType: clip.licenseType,
        licenseProofUrl: clip.licenseProofUrl,
        credit: clip.credit,
        complianceSummary: report.summary,
        script: scriptData.script,
        thumbnailPath: outputThumbPath,
      });
    }

    logger.info({ videoId }, 'Video successfully queued for mandatory human approval.');
    return true;
  }
}
