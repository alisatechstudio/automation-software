import fs from 'fs';
import path from 'path';
import { config } from '../../config/env.js';
import { initDatabase } from '../../db/index.js';

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

export interface DriveConnectionStatus {
  success: boolean;
  tokenValid: boolean;
  folderAccessible: boolean;
  folderName?: string;
  folderId?: string;
  error?: string;
}

export class GoogleDriveUploader {
  private cachedAccessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  public lastAuthError: string | null = null;
  public lastUploadError: string | null = null;

  public clearCache(): void {
    this.cachedAccessToken = null;
    this.tokenExpiresAt = 0;
  }

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
   * Dynamically resolves OAuth credentials from MongoDB settings collection or environment
   */
  public async getCredentials(): Promise<{
    clientId: string | null;
    clientSecret: string | null;
    refreshToken: string | null;
  }> {
    let clientId = config.GOOGLE_CLIENT_ID || null;
    let clientSecret = config.GOOGLE_CLIENT_SECRET || null;
    let refreshToken = config.GOOGLE_REFRESH_TOKEN || null;

    try {
      const db = await initDatabase().catch(() => null);
      if (db) {
        const settingsCol = db.collection('settings');

        // Check for refresh token in DB with strict priority (GDRIVE > GOOGLE > YOUTUBE)
        const priorityTokenKeys = [
          'GDRIVE_REFRESH_TOKEN',
          'GOOGLE_REFRESH_TOKEN',
          'YOUTUBE_REFRESH_TOKEN',
        ];

        for (const tokenKey of priorityTokenKeys) {
          const doc = await settingsCol.findOne({
            $or: [{ _id: tokenKey as any }, { key: tokenKey }],
          });
          const val = (doc?.value || doc?.refreshToken || '').trim();
          if (val && val.startsWith('1//')) {
            refreshToken = val;
            break;
          }
        }

        // Check for client id / secret in DB
        const clientDocs = await settingsCol
          .find({
            $or: [
              { _id: 'GOOGLE_CLIENT_ID' as any },
              { _id: 'YOUTUBE_CLIENT_ID' as any },
              { _id: 'GOOGLE_CLIENT_SECRET' as any },
              { _id: 'YOUTUBE_CLIENT_SECRET' as any },
              { key: 'GOOGLE_CLIENT_ID' },
              { key: 'YOUTUBE_CLIENT_ID' },
              { key: 'GOOGLE_CLIENT_SECRET' },
              { key: 'YOUTUBE_CLIENT_SECRET' },
            ],
          })
          .toArray();

        for (const doc of clientDocs) {
          const id = String(doc._id || doc.key);
          const val = (doc.value || '').trim();
          if (val) {
            if (id.includes('CLIENT_ID') && !clientId) clientId = val;
            if (id.includes('CLIENT_SECRET') && !clientSecret) clientSecret = val;
          }
        }
      }
    } catch (e: any) {
      console.warn(`[GoogleDriveUploader] Note resolving dynamic settings: ${e.message}`);
    }

    return { clientId, clientSecret, refreshToken };
  }

  /**
   * Refreshes and returns an OAuth access token for Google APIs
   */
  public async getAccessToken(): Promise<string | null> {
    if (this.cachedAccessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedAccessToken;
    }

    const { clientId, clientSecret, refreshToken } = await this.getCredentials();

    if (!clientId || !clientSecret || !refreshToken) {
      this.lastAuthError = 'Missing Google OAuth credentials (client ID, client secret, or refresh token).';
      console.warn(`[GoogleDriveUploader] ${this.lastAuthError}`);
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
        this.lastAuthError = `Google OAuth Token Error (${res.status}): ${errText}`;
        console.warn(`[GoogleDriveUploader] Token refresh failed: ${this.lastAuthError}`);
        return null;
      }

      const data = (await res.json()) as any;
      if (data.access_token) {
        this.cachedAccessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
        this.lastAuthError = null;
        return this.cachedAccessToken;
      }
    } catch (err: any) {
      this.lastAuthError = `Network error obtaining Google access token: ${err.message}`;
      console.warn(`[GoogleDriveUploader] ${this.lastAuthError}`);
    }

    return null;
  }

  /**
   * Tests token validity and folder accessibility
   */
  public async testConnection(targetFolderId?: string): Promise<DriveConnectionStatus> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return {
        success: false,
        tokenValid: false,
        folderAccessible: false,
        error: this.lastAuthError || 'Failed to obtain access token. Refresh token may be expired or revoked.',
      };
    }

    const folderId = this.extractFolderId(targetFolderId || config.GDRIVE_FOLDER_ID || '');
    if (!folderId) {
      return {
        success: true,
        tokenValid: true,
        folderAccessible: false,
        error: 'Google Drive access token is active, but no folder ID was provided to verify.',
      };
    }

    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,capabilities`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          tokenValid: true,
          folderAccessible: false,
          folderId,
          error: `Folder verification failed (${res.status}): ${errText}`,
        };
      }

      const folderData = (await res.json()) as any;
      return {
        success: true,
        tokenValid: true,
        folderAccessible: true,
        folderId,
        folderName: folderData.name || 'Target Folder',
      };
    } catch (err: any) {
      return {
        success: false,
        tokenValid: true,
        folderAccessible: false,
        folderId,
        error: `Folder inspection error: ${err.message}`,
      };
    }
  }

  /**
   * Uploads video to target Google Drive folder.
   * If OAuth fails or upload fails, returns success: false with detailed error.
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

    // Always stage into local directory as safety fallback
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

    // Dry Run Simulation
    if (config.DRY_RUN) {
      const dryRunId = `dryrun_${Buffer.from(filename).toString('hex').slice(0, 16)}`;
      console.log(`[GoogleDriveUploader] (DRY_RUN) Simulating upload for "${filename}"`);
      return {
        success: true,
        fileId: dryRunId,
        filename,
        webViewLink: `/local/${cleanFolderId}/${filename}`,
        isLocalFallback: true,
      };
    }

    // Check Access Token
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      const authErr =
        this.lastAuthError ||
        'Google Drive OAuth token refresh failed. Please check or refresh your GDRIVE_REFRESH_TOKEN.';
      console.error(`[GoogleDriveUploader] ❌ Cannot upload to Drive: ${authErr}`);
      return {
        success: false,
        filename,
        error: authErr,
        isLocalFallback: true,
        fileId: `local_${Buffer.from(filename).toString('hex').slice(0, 16)}`,
        webViewLink: `/local/${cleanFolderId}/${filename}`,
      };
    }

    // Upload via Google Drive API v3 (Resumable Upload)
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

      if (!initRes.ok) {
        const errBody = await initRes.text();
        const uploadErr = `Drive resumable upload init failed (${initRes.status}): ${errBody}`;
        this.lastUploadError = uploadErr;
        console.error(`[GoogleDriveUploader] ❌ ${uploadErr}`);
        return {
          success: false,
          filename,
          error: uploadErr,
          isLocalFallback: true,
          fileId: `local_${Buffer.from(filename).toString('hex').slice(0, 16)}`,
          webViewLink: `/local/${cleanFolderId}/${filename}`,
        };
      }

      const uploadLocation = initRes.headers.get('location');
      if (!uploadLocation) {
        const uploadErr = 'Drive upload error: Missing resumable upload location header.';
        this.lastUploadError = uploadErr;
        console.error(`[GoogleDriveUploader] ❌ ${uploadErr}`);
        return {
          success: false,
          filename,
          error: uploadErr,
          isLocalFallback: true,
          fileId: `local_${Buffer.from(filename).toString('hex').slice(0, 16)}`,
          webViewLink: `/local/${cleanFolderId}/${filename}`,
        };
      }

      // Attempt upload with automatic retry for resilience against network glitches
      let uploadSuccess = false;
      let lastPutError = '';
      let fileData: any = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          if (attempt > 1) {
            console.log(
              `[GoogleDriveUploader] 🔄 Retrying Drive upload for "${filename}" (attempt ${attempt}/2)...`
            );
            await new Promise((r) => setTimeout(r, 2000));
          }

          const putRes = await fetch(uploadLocation, {
            method: 'PUT',
            headers: {
              'Content-Type': mimeType,
            },
            body: options.videoBuffer as any,
            // @ts-ignore
            duplex: 'half',
          });

          if (putRes.ok) {
            fileData = (await putRes.json().catch(() => ({}))) as any;
            uploadSuccess = true;
            break;
          } else {
            const putErr = await putRes.text();
            lastPutError = `Drive upload binary PUT failed (${putRes.status}): ${putErr}`;
          }
        } catch (netErr: any) {
          console.error('[GoogleDriveUploader] PUT netErr:', netErr?.message, 'cause:', netErr?.cause);
          lastPutError = `Drive PUT network error: ${netErr.message} (${netErr?.cause?.message || netErr?.cause || ''})`;
        }
      }

      if (uploadSuccess && fileData?.id) {
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
      } else {
        this.lastUploadError = lastPutError || 'Drive upload failed after retries';
        console.error(`[GoogleDriveUploader] ❌ ${this.lastUploadError}`);
        return {
          success: false,
          filename,
          error: this.lastUploadError,
          isLocalFallback: true,
          fileId: `local_${Buffer.from(filename).toString('hex').slice(0, 16)}`,
          webViewLink: `/local/${cleanFolderId}/${filename}`,
        };
      }
    } catch (uploadErr: any) {
      this.lastUploadError = uploadErr.message;
      console.error(`[GoogleDriveUploader] Drive API upload exception: ${uploadErr.message}`);
      return {
        success: false,
        filename,
        error: `Drive API upload error: ${uploadErr.message}`,
        isLocalFallback: true,
        fileId: `local_${Buffer.from(filename).toString('hex').slice(0, 16)}`,
        webViewLink: `/local/${cleanFolderId}/${filename}`,
      };
    }
  }
}
