import fs from 'fs';
import path from 'path';
import { config } from '../../config/env.js';

export interface DriveUploadOptions {
  folderId: string;
  videoBuffer: Buffer;
  filename: string;
  mimeType?: string;
}

export interface DriveUploadResult {
  success: boolean;
  fileId?: string;
  filename: string;
  webViewLink?: string;
  isLocalFallback?: boolean;
  error?: string;
}

export class GoogleDriveUploader {
  private cachedAccessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  /**
   * Extracts clean Google Drive folder ID from URL or raw ID
   */
  public extractFolderId(input: string): string {
    const trimmed = (input || '').trim();
    if (!trimmed) return '';

    if (/^(https?:\/\/|www\.|drive\.google\.com)/i.test(trimmed)) {
      const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_\-]+)/i);
      if (folderMatch && folderMatch[1]) return folderMatch[1];

      const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_\-]+)/i);
      if (dMatch && dMatch[1]) return dMatch[1];

      const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_\-]+)/i);
      if (idParamMatch && idParamMatch[1]) return idParamMatch[1];

      return '';
    }

    return trimmed.replace(/[^a-zA-Z0-9_\-]/g, '') || trimmed;
  }

  /**
   * Refreshes and returns an OAuth access token for Google APIs
   */
  public async getAccessToken(): Promise<string | null> {
    if (this.cachedAccessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedAccessToken;
    }

    const clientId = config.GOOGLE_CLIENT_ID;
    const clientSecret = config.GOOGLE_CLIENT_SECRET;
    const refreshToken = config.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return null;
    }

    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[GoogleDriveUploader] Token refresh failed (${res.status}): ${errText}`);
        return null;
      }

      const data = (await res.json()) as any;
      if (data.access_token) {
        this.cachedAccessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
        return this.cachedAccessToken;
      }
    } catch (err: any) {
      console.warn(`[GoogleDriveUploader] Error obtaining access token: ${err.message}`);
    }

    return null;
  }

  /**
   * Uploads video to target Google Drive folder (with local fallback caching)
   */
  public async uploadVideo(options: DriveUploadOptions): Promise<DriveUploadResult> {
    const cleanFolderId = this.extractFolderId(options.folderId || config.GDRIVE_FOLDER_ID || '');
    const mimeType = options.mimeType || 'video/mp4';
    const filename = options.filename;

    if (!cleanFolderId) {
      return {
        success: false,
        filename,
        error: 'Target Google Drive folder ID is missing or invalid.',
      };
    }

    // Always stage into local directory as persistent safety fallback
    const localDir = path.join(config.DATA_DIR, 'gdrive_folders', cleanFolderId);
    let localSaved = false;
    try {
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      const localFilePath = path.join(localDir, filename);
      fs.writeFileSync(localFilePath, options.videoBuffer);
      localSaved = true;
    } catch (fsErr: any) {
      console.warn(`[GoogleDriveUploader] Note staging local fallback video: ${fsErr.message}`);
    }

    // 1. If Google OAuth is configured, upload via Drive API v3
    const accessToken = await this.getAccessToken();
    if (accessToken && !config.DRY_RUN) {
      try {
        console.log(
          `[GoogleDriveUploader] ☁️ Uploading "${filename}" (${options.videoBuffer.length} bytes) to Google Drive folder "${cleanFolderId}"...`
        );

        const initUrl =
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true';
        const isRealDriveFolder = !cleanFolderId.startsWith('folder_') && cleanFolderId.length > 10;

        const initRes = await fetch(initUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': mimeType,
            'X-Upload-Content-Length': String(options.videoBuffer.length),
          },
          body: JSON.stringify({
            name: filename,
            ...(isRealDriveFolder ? { parents: [cleanFolderId] } : {}),
          }),
        });

        if (initRes.ok) {
          const uploadLocation = initRes.headers.get('location');
          if (uploadLocation) {
            const putRes = await fetch(uploadLocation, {
              method: 'PUT',
              headers: {
                'Content-Type': mimeType,
                'Content-Length': String(options.videoBuffer.length),
              },
              body: options.videoBuffer as any,
            });

            if (putRes.ok) {
              const fileData = (await putRes.json().catch(() => ({}))) as any;
              console.log(
                `✓ [GoogleDriveUploader] Video "${filename}" uploaded to Google Drive! File ID: ${fileData.id}`
              );
              return {
                success: true,
                fileId: fileData.id,
                filename,
                webViewLink: `https://drive.google.com/file/d/${fileData.id}/view`,
                isLocalFallback: false,
              };
            }
          }
        }
      } catch (uploadErr: any) {
        console.warn(`[GoogleDriveUploader] Drive API upload error: ${uploadErr.message}. Fallback to local storage.`);
      }
    }

    // Fallback ID when offline or DRY_RUN
    const fallbackFileId = `local_${Buffer.from(filename).toString('hex').slice(0, 16)}`;
    console.log(
      `[GoogleDriveUploader] ✓ Staged reel in folder "${cleanFolderId}" (Local Fallback: ${localSaved}, ID: ${fallbackFileId})`
    );

    return {
      success: true,
      fileId: fallbackFileId,
      filename,
      isLocalFallback: true,
      webViewLink: `/local/${cleanFolderId}/${filename}`,
    };
  }
}
