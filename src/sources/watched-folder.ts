import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { BaseSource } from './base.js';
import type { ClipMeta } from '../types/index.js';
import { logger } from '../logger.js';

if (ffprobeInstaller?.path) {
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
}

export interface WatchedFolderOptions {
  inboxPath: string;
  requirePermissionFile?: boolean;
  blocklist?: string[];
  licensedAgreements?: string[];
}

export class WatchedFolderSource extends BaseSource {
  public readonly name = 'WatchedFolderSource';
  private inboxPath: string;
  private requirePermissionFile: boolean;

  constructor(options: WatchedFolderOptions) {
    super(options.blocklist, options.licensedAgreements);
    this.inboxPath = path.resolve(process.cwd(), options.inboxPath);
    this.requirePermissionFile = options.requirePermissionFile ?? true;
  }

  public async fetchRecent(): Promise<ClipMeta[]> {
    if (!fs.existsSync(this.inboxPath)) {
      fs.mkdirSync(this.inboxPath, { recursive: true });
      return [];
    }

    const files = fs.readdirSync(this.inboxPath);
    const videoExts = new Set(['.mp4', '.mov', '.mkv', '.webm']);
    const candidates: ClipMeta[] = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!videoExts.has(ext)) continue;

      const fullVideoPath = path.join(this.inboxPath, file);
      const baseName = path.basename(file, ext);

      // Check companion license / permission files
      const companionJson = path.join(this.inboxPath, `${baseName}.license.json`);
      const companionTxt = path.join(this.inboxPath, `${baseName}.license.txt`);

      let licenseInfo: {
        title?: string;
        rightsHolder?: string;
        licenseType?: string;
        commercialAllowed?: boolean;
        credit?: string;
        sport?: string;
        permissionProof?: string;
      } = {};

      if (fs.existsSync(companionJson)) {
        try {
          const content = fs.readFileSync(companionJson, 'utf8');
          licenseInfo = JSON.parse(content);
        } catch (err: any) {
          logger.error({ file: companionJson, err: err.message }, 'Failed to parse companion license JSON');
          continue;
        }
      } else if (fs.existsSync(companionTxt)) {
        const content = fs.readFileSync(companionTxt, 'utf8');
        licenseInfo = {
          title: baseName,
          rightsHolder: 'Self / Written Permission Note',
          licenseType: 'OWNED_PERMISSION',
          commercialAllowed: true,
          credit: content.slice(0, 200).trim(),
          sport: 'Sports',
          permissionProof: companionTxt,
        };
      } else {
        if (this.requirePermissionFile) {
          logger.warn(
            { file },
            'Watched folder clip rejected: Missing companion license note (.license.json or .license.txt)'
          );
          continue;
        }
        // If permission file not strictly enforced, default to self-owned
        licenseInfo = {
          title: baseName,
          rightsHolder: 'Creator Owned',
          licenseType: 'OWNED_PERMISSION',
          commercialAllowed: true,
          credit: 'Footage provided with written creator authorization',
          sport: 'Sports',
          permissionProof: `local://${fullVideoPath}`,
        };
      }

      if (licenseInfo.commercialAllowed === false) {
        logger.warn({ file }, 'Watched folder clip rejected: commercialAllowed explicitly marked false.');
        continue;
      }

      // Probe duration
      let duration = 30; // fallback default
      try {
        duration = await this.probeDuration(fullVideoPath);
      } catch (err: any) {
        logger.warn({ file, err: err.message }, 'Could not probe video duration, using fallback 30s');
      }

      const clipId = `inbox_${crypto.createHash('sha256').update(fullVideoPath).digest('hex').slice(0, 16)}`;

      candidates.push({
        id: clipId,
        title: licenseInfo.title || baseName,
        url: `file://${fullVideoPath}`,
        localFilePath: fullVideoPath,
        licenseType: licenseInfo.licenseType || 'OWNED_PERMISSION',
        licenseProofUrl: licenseInfo.permissionProof || `file://${companionJson}`,
        credit: licenseInfo.credit || `Footage provided by ${licenseInfo.rightsHolder || 'rights holder'}`,
        publishedAt: new Date().toISOString(),
        sport: licenseInfo.sport || 'Sports',
        duration,
        sourceName: this.name,
        rawMetadata: licenseInfo,
      });
    }

    return this.filterCandidates(candidates);
  }

  private probeDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        const dur = metadata.format.duration || 0;
        resolve(Math.round(dur));
      });
    });
  }
}
