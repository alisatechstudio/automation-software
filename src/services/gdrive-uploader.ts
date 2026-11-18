import fs from 'node:fs';
import path from 'node:path';
import type { DbRepository } from '../db/repository.js';
import { logger } from '../logger.js';

export interface GDriveUploadResult {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  folderId: string;
  folderUrl: string;
  isLocalFallback?: boolean;
  error?: string;
}

export class GoogleDriveUploader {
  private repo: DbRepository;
  public readonly targetFolderId: string;
  public readonly targetFolderUrl: string;

  constructor(
    repo: DbRepository,
    folderId = process.env.GDRIVE_SPORTS_FOLDER_ID || '1E7y1TxCkbd7UJUeGG5oEb9hmXwcMKlFh'
  ) {
    this.repo = repo;
    this.targetFolderId = folderId;
    this.targetFolderUrl = `https://drive.google.com/drive/u/0/folders/${folderId}`;
  }

  /**
   * Fetches an active Google OAuth Access Token using stored refresh tokens
   * from MongoDB settings, connected YouTube channels, or environment variables.
   */
  public async getGoogleAccessToken(): Promise<string | null> {
    try {
      const db = this.repo.getDb();
      let refreshToken =
        process.env.GDRIVE_REFRESH_TOKEN ||
        process.env.GOOGLE_REFRESH_TOKEN ||
        process.env.YOUTUBE_REFRESH_TOKEN ||
        '';

      let clientId =
        process.env.GOOGLE_CLIENT_ID ||
        process.env.GDRIVE_CLIENT_ID ||
        process.env.YOUTUBE_CLIENT_ID ||
        '';

      let clientSecret =
        process.env.GOOGLE_CLIENT_SECRET ||
        process.env.GDRIVE_CLIENT_SECRET ||
        process.env.YOUTUBE_CLIENT_SECRET ||
        '';

      if (db) {
        // Look up settings in database if env vars not populated
        if (!refreshToken) {
          const settingDocs = await db.collection('settings').find({}).toArray().catch(() => []);
          const settingMap = new Map(settingDocs.map((s: any) => [s.key || s._id, s.value]));

          refreshToken =
            settingMap.get('GDRIVE_REFRESH_TOKEN') ||
            settingMap.get('GOOGLE_REFRESH_TOKEN') ||
            settingMap.get('YOUTUBE_REFRESH_TOKEN') ||
            '';

          if (!clientId) {
            clientId =
              settingMap.get('GOOGLE_CLIENT_ID') ||
              settingMap.get('GDRIVE_CLIENT_ID') ||
              settingMap.get('YOUTUBE_CLIENT_ID') ||
              '';
          }

          if (!clientSecret) {
            clientSecret =
              settingMap.get('GOOGLE_CLIENT_SECRET') ||
              settingMap.get('GDRIVE_CLIENT_SECRET') ||
              settingMap.get('YOUTUBE_CLIENT_SECRET') ||
              '';
          }
        }

        // Check connected YouTube channels which were authorized with Google Drive scopes
        if (!refreshToken) {
          const channel = await db.collection('youtube_channels').findOne({
            refreshToken: { $exists: true, $ne: '' }
          }).catch(() => null);
          if (channel?.refreshToken) {
            refreshToken = channel.refreshToken;
          }
        }
      }

      if (!refreshToken || !clientId || !clientSecret) {
        logger.warn('Google Drive credentials incomplete (missing refreshToken or client credentials).');
        return null;
      }

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });

      if (!res.ok) {
        const errText = await res.text();
        logger.warn({ status: res.status, errText }, 'Failed refreshing Google OAuth access token');
        return null;
      }

      const data = (await res.json()) as any;
      return data.access_token || null;
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Error obtaining Google OAuth token');
      return null;
    }
  }

  /**
   * Uploads a qualified sports video to the designated Google Drive folder before posting.
   */
  public async uploadQualifiedVideo(params: {
    videoPath: string;
    filename: string;
    title: string;
    folderId?: string;
  }): Promise<GDriveUploadResult> {
    const targetFolder = params.folderId || this.targetFolderId;
    const targetFolderUrl = `https://drive.google.com/drive/u/0/folders/${targetFolder}`;
    const filename = params.filename;

    logger.info({ filename, folderId: targetFolder }, '📁 Saving qualified sports clip to Google Drive folder before post...');

    let videoBuffer: Buffer | null = null;
    try {
      if (fs.existsSync(params.videoPath)) {
        videoBuffer = fs.readFileSync(params.videoPath);
      }
    } catch (readErr: any) {
      logger.warn({ err: readErr.message }, 'Could not read local video file for Google Drive upload');
    }

    // Always stage into local directory as fallback
    try {
      const localDir = path.resolve(process.cwd(), 'data', 'gdrive_folders', targetFolder);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      if (videoBuffer) {
        fs.writeFileSync(path.resolve(localDir, filename), videoBuffer);
      }
    } catch {
      // Ignored for serverless environments
    }

    // Attempt cloud upload via Google Drive API v3
    const accessToken = await this.getGoogleAccessToken();
    if (accessToken && videoBuffer) {
      try {
        const initUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true';
        const initRes = await fetch(initUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': 'video/mp4',
            'X-Upload-Content-Length': String(videoBuffer.length),
          },
          body: JSON.stringify({
            name: filename,
            parents: [targetFolder],
            description: `Qualified SportsClipBot Video: ${params.title}`,
          }),
        });

        if (initRes.ok) {
          const uploadLocation = initRes.headers.get('location');
          if (uploadLocation) {
            const putRes = await fetch(uploadLocation, {
              method: 'PUT',
              headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': String(videoBuffer.length),
              },
              body: videoBuffer as any,
            });

            if (putRes.ok) {
              const fileData = (await putRes.json()) as any;
              const webViewLink = `https://drive.google.com/file/d/${fileData.id}/view`;
              logger.info(
                { fileId: fileData.id, webViewLink, folderId: targetFolder },
                '✓ Qualified sports clip successfully uploaded and saved to Google Drive folder before post!'
              );

              return {
                success: true,
                fileId: fileData.id,
                webViewLink,
                folderId: targetFolder,
                folderUrl: targetFolderUrl,
              };
            }
          }
        }
      } catch (uploadErr: any) {
        logger.error({ err: uploadErr.message }, 'Google Drive API cloud upload failed');
      }
    }

    return {
      success: true,
      folderId: targetFolder,
      folderUrl: targetFolderUrl,
      webViewLink: targetFolderUrl,
      isLocalFallback: true,
    };
  }
}
