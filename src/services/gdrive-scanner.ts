import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.js';

export interface GDriveVideoItem {
  id: string;
  name: string;
  cleanTitle: string;
  sizeBytes: number;
  sizeMb: string;
  mimeType: string;
  modifiedTime: string;
  isPosted: boolean;
  webViewLink?: string;
  thumbnailLink?: string;
  isLocalFallback?: boolean;
}

export interface GDriveScanResult {
  channelId?: string;
  channelName?: string;
  folderId: string;
  folderUrl: string;
  totalVideos: number;
  postedCount: number;
  pendingCount: number;
  videos: GDriveVideoItem[];
  error?: string;
}

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi']);

/**
 * Extracts Google Drive Folder ID from a URL or raw ID
 */
export function extractFolderId(input: string): string {
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
 * Formats a filename into a clean, human-readable title
 */
export function cleanVideoTitle(filename: string): string {
  let title = filename;
  const extIdx = title.lastIndexOf('.');
  if (extIdx !== -1) {
    title = title.substring(0, extIdx);
  }
  title = title.replace(/#[a-zA-Z0-9_\u0980-\u09FF]+/g, '').trim();
  title = title.replace(/^[\d\-_.]+\s*[-_.]*\s*/, '');
  title = title.replace(/[-_.]+/g, ' ').trim();
  if (title === title.toLowerCase()) {
    title = title.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return title || filename;
}

/**
 * Scans a Google Drive folder using either an API Key or OAuth Access Token.
 * Also scans local fallback directory data/gdrive_folders/<folderId> if available.
 */
export async function scanGoogleDriveFolder(params: {
  folderUrlOrId: string;
  apiKey?: string;
  accessToken?: string | null;
  postedVideoIds?: string[];
}): Promise<GDriveScanResult> {
  const rawInput = (params.folderUrlOrId || '').trim();
  const folderId = extractFolderId(rawInput);
  const folderUrl = folderId ? `https://drive.google.com/drive/u/0/folders/${folderId}` : rawInput;

  if (!folderId) {
    return {
      folderId: '',
      folderUrl: rawInput,
      totalVideos: 0,
      postedCount: 0,
      pendingCount: 0,
      videos: [],
      error: 'Please enter a valid Google Drive folder link or folder ID.',
    };
  }

  const postedSet = new Set(params.postedVideoIds || []);
  const videoList: GDriveVideoItem[] = [];
  let driveError: string | undefined;

  // 1. Scan Google Drive API v3 (Separate API Key and OAuth Bearer token - NEVER send both together)
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent('files(id,name,size,mimeType,createdTime,modifiedTime,webViewLink,thumbnailLink)');
  const baseApiUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  let driveRes: Response | null = null;

  // A. Prefer API Key first if available (without Authorization header)
  if (params.apiKey) {
    try {
      const keyUrl = `${baseApiUrl}&key=${encodeURIComponent(params.apiKey)}`;
      const res = await fetch(keyUrl);
      if (res.ok) {
        driveRes = res;
      } else {
        const errJson = (await res.json().catch(() => null)) as any;
        driveError = errJson?.error?.message || `Google Drive API Key error (HTTP ${res.status})`;
      }
    } catch (e: any) {
      driveError = `Drive API fetch failed: ${e.message}`;
    }
  }

  // B. Fallback to OAuth Access Token if API key is not present or failed (without key param)
  if (!driveRes && params.accessToken) {
    try {
      const res = await fetch(baseApiUrl, {
        headers: { Authorization: `Bearer ${params.accessToken}` },
      });
      if (res.ok) {
        driveRes = res;
        driveError = undefined; // Cleared since OAuth succeeded
      } else {
        const errJson = (await res.json().catch(() => null)) as any;
        const msg = errJson?.error?.message || `Google Drive OAuth error (HTTP ${res.status})`;
        if (!driveError) driveError = msg;
      }
    } catch (e: any) {
      if (!driveError) driveError = `Drive OAuth fetch failed: ${e.message}`;
    }
  }

  if (driveRes && driveRes.ok) {
    try {
      const data = (await driveRes.json()) as any;
      const rawFiles: any[] = data.files || [];
      for (const f of rawFiles) {
        const ext = path.extname(f.name || '').toLowerCase();
        const isVideoMime = (f.mimeType || '').startsWith('video/');
        if (!isVideoMime && !VIDEO_EXTENSIONS.has(ext)) {
          continue;
        }

        const sizeBytes = Number(f.size || 0);
        videoList.push({
          id: f.id,
          name: f.name,
          cleanTitle: cleanVideoTitle(f.name),
          sizeBytes,
          sizeMb: (sizeBytes / (1024 * 1024)).toFixed(1),
          mimeType: f.mimeType || 'video/mp4',
          modifiedTime: f.modifiedTime || f.createdTime || new Date().toISOString(),
          isPosted: postedSet.has(f.id),
          webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
          thumbnailLink: f.thumbnailLink,
        });
      }
    } catch (parseErr: any) {
      driveError = `Error parsing Google Drive file list: ${parseErr.message}`;
    }
  }

  // 2. Scan Local Fallback directory if on filesystem
  try {
    const localDir = path.resolve(process.cwd(), 'data', 'gdrive_folders', folderId);
    if (fs.existsSync(localDir)) {
      const localFiles = fs.readdirSync(localDir);
      for (const lf of localFiles) {
        const ext = path.extname(lf).toLowerCase();
        if (!VIDEO_EXTENSIONS.has(ext)) continue;

        const localId = `local_${lf}`;
        // Avoid duplicates if already discovered from cloud
        if (videoList.some((v) => v.name === lf)) continue;

        const stat = fs.statSync(path.join(localDir, lf));
        videoList.push({
          id: localId,
          name: lf,
          cleanTitle: cleanVideoTitle(lf),
          sizeBytes: stat.size,
          sizeMb: (stat.size / (1024 * 1024)).toFixed(1),
          mimeType: 'video/mp4',
          modifiedTime: stat.mtime.toISOString(),
          isPosted: postedSet.has(localId) || postedSet.has(lf),
          webViewLink: folderUrl,
          isLocalFallback: true,
        });
      }
    }
  } catch {
    // Ignore filesystem errors in serverless environments
  }

  const postedCount = videoList.filter((v) => v.isPosted).length;
  const pendingCount = videoList.length - postedCount;

  return {
    folderId,
    folderUrl,
    totalVideos: videoList.length,
    postedCount,
    pendingCount,
    videos: videoList,
    error: videoList.length === 0 && driveError ? driveError : undefined,
  };
}
