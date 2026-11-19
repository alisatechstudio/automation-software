import type { LoadedConfig } from '../config/index.js';
import type { ClipMeta, Source } from '../types/index.js';
import { WatchedFolderSource } from './watched-folder.js';
import { YouTubeCCSource } from './youtube-cc.js';
import { CommonsArchiveSource } from './commons-archive.js';
import { PexelsSource } from './pexels.js';
import { PixabaySource } from './pixabay.js';
import { PartnerFeedSource } from './partner-feed.js';
import { logger } from '../logger.js';

export function createSources(loaded: LoadedConfig): Source[] {
  const { config, env } = loaded;
  const sources: Source[] = [];
  const blocklist = config.compliance.blocklist;
  const licensedAgreements = config.sources.partnerFeeds.map((f) => f.name);

  // 1. Pixabay (High quality licensed commercial stock sports video)
  const pixabayKey = env.PIXABAY_API_KEY || process.env.PIXABAY_API_KEY;
  if (config.sources.pixabay.enabled && pixabayKey) {
    sources.push(
      new PixabaySource({
        apiKey: pixabayKey,
        searchSports: config.sources.pixabay.searchSports,
        blocklist,
        licensedAgreements,
      })
    );
  }

  // 2. Pexels
  const pexelsKey = env.PEXELS_API_KEY || process.env.PEXELS_API_KEY;
  if (config.sources.pexels.enabled && pexelsKey) {
    sources.push(
      new PexelsSource({
        apiKey: pexelsKey,
        searchSports: config.sources.pexels.searchSports,
        blocklist,
        licensedAgreements,
      })
    );
  }

  // 3. Wikimedia Commons / Internet Archive
  if (config.sources.commonsArchive.enabled) {
    sources.push(
      new CommonsArchiveSource({
        categories: config.sources.commonsArchive.defaultCategories,
        blocklist,
        licensedAgreements,
      })
    );
  }

  // 4. Watched Inbox Folder
  if (config.sources.watchedFolder.enabled) {
    sources.push(
      new WatchedFolderSource({
        inboxPath: config.sources.watchedFolder.path,
        requirePermissionFile: config.sources.watchedFolder.requirePermissionFile,
        blocklist,
        licensedAgreements,
      })
    );
  }

  // 5. YouTube Creative Commons
  if (config.sources.youtubeCc.enabled) {
    sources.push(
      new YouTubeCCSource({
        apiKey: env.YOUTUBE_CLIENT_ID ? undefined : undefined,
        queries: config.sources.youtubeCc.queries,
        maxResults: config.sources.youtubeCc.maxResults,
        blocklist,
        licensedAgreements,
      })
    );
  }

  // 6. Configured Partner Feeds
  if (config.sources.partnerFeeds.length > 0) {
    sources.push(
      new PartnerFeedSource({
        feeds: config.sources.partnerFeeds,
        blocklist,
      })
    );
  }

  return sources;
}

export async function fetchFromAllSources(sources: Source[]): Promise<ClipMeta[]> {
  const allClips: ClipMeta[] = [];
  const seenIds = new Set<string>();

  for (const source of sources) {
    try {
      logger.info({ source: source.name }, 'Fetching clips from source...');
      const clips = await source.fetchRecent();
      logger.info({ source: source.name, count: clips.length }, 'Fetched clips');

      for (const clip of clips) {
        if (!seenIds.has(clip.id)) {
          seenIds.add(clip.id);
          allClips.push(clip);
        }
      }
    } catch (err: any) {
      logger.error({ source: source.name, err: err.message }, 'Failed fetching from source');
    }
  }

  return allClips;
}

export * from './interface.js';
export * from './base.js';
export * from './blocklist.js';
export * from './watched-folder.js';
export * from './youtube-cc.js';
export * from './commons-archive.js';
export * from './pexels.js';
export * from './pixabay.js';
export * from './partner-feed.js';
