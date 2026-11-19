import crypto from 'crypto';
import { getDatabase } from '../../db/index.js';
import { FacebookGroup, GroupShareLog, GroupShareRecord, NewsArticle, FacebookPage } from '../../db/schema.js';
import { FacebookGraphClient } from './client.js';
import { config } from '../../config/env.js';

export class GroupShareService {
  private fbClient: FacebookGraphClient;

  constructor(fbClient?: FacebookGraphClient) {
    this.fbClient = fbClient || new FacebookGraphClient();
  }

  /**
   * Evaluates if a given news article is relevant to a specific Facebook group
   * Matches by wildcard ('*' or 'all'), exact/partial category match, or keyword presence in title/summary.
   */
  public isArticleRelevantToGroup(article: NewsArticle, group: FacebookGroup): boolean {
    if (!group.isActive || !group.autoShare) {
      return false;
    }

    // If categories are empty or contain wildcard '*' / 'all', it matches every article
    if (
      !group.categories ||
      group.categories.length === 0 ||
      group.categories.some((c) => c === '*' || c.toLowerCase() === 'all')
    ) {
      return true;
    }

    const cleanArticleCategory = (article.category || '').trim().toLowerCase();
    const articleText = `${article.title} ${article.description || ''}`.toLowerCase();

    for (const rawFilter of group.categories) {
      const filter = rawFilter.trim().toLowerCase();
      if (!filter) continue;

      // 1. Direct Category Match (e.g. "রাজনীতি", "খেলাধুলা", "বিশেষ খবর")
      if (cleanArticleCategory && (cleanArticleCategory === filter || cleanArticleCategory.includes(filter))) {
        return true;
      }

      // 2. Keyword/Entity Search in Title or Description
      if (articleText.includes(filter)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Automatically shares a newly published page post to all relevant Facebook groups.
   * Includes anti-ban jitter delays and comprehensive logging.
   */
  public async autoShareArticle(
    article: NewsArticle,
    page: FacebookPage,
    postId: string,
    photoId?: string
  ): Promise<GroupShareRecord[]> {
    const db = getDatabase();
    const groupsCol = db.collection<FacebookGroup>('facebook_groups');
    const shareLogsCol = db.collection<GroupShareLog>('group_shares');

    // Fetch all active auto-share groups
    const candidateGroups = await groupsCol
      .find({
        isActive: true,
        autoShare: true,
      })
      .toArray();

    if (candidateGroups.length === 0) {
      console.log(`[GroupShareService] No active auto-share groups configured.`);
      return [];
    }

    // Filter to relevant groups
    const relevantGroups = candidateGroups.filter((group) =>
      this.isArticleRelevantToGroup(article, group)
    );

    if (relevantGroups.length === 0) {
      console.log(
        `[GroupShareService] Article "${article.title.substring(0, 40)}..." (Cat: ${article.category || 'N/A'}) does not match any configured group criteria.`
      );
      return [];
    }

    console.log(
      `[GroupShareService] Found ${relevantGroups.length} relevant group(s) for article "${article.title.substring(0, 40)}...":`,
      relevantGroups.map((g) => `${g.name} (${g._id})`)
    );

    // Build Post URL for sharing
    // Graph API feed accepts either direct post URL or photo permalink
    const cleanPostIdPart = postId.includes('_') ? postId.split('_')[1] : postId;
    const postUrl = `https://www.facebook.com/${page._id}/posts/${cleanPostIdPart}`;

    const results: GroupShareRecord[] = [];

    for (let i = 0; i < relevantGroups.length; i++) {
      const group = relevantGroups[i];

      // Anti-ban delay: Sleep 2-4 seconds between consecutive group shares
      if (i > 0 && !config.DRY_RUN) {
        const jitterMs = Math.floor(Math.random() * 2000) + 2000;
        console.log(`[GroupShareService] Anti-spam delay: waiting ${jitterMs}ms before sharing to next group (${group.name})...`);
        await new Promise((resolve) => setTimeout(resolve, jitterMs));
      }

      const tokenToUse = (group.accessToken && group.accessToken.trim()) ? group.accessToken.trim() : page.accessToken;
      const shareMessage = `🔴 ${article.title}\n\nবিস্তারিত পড়ুন প্রথম কমেন্টে: ${article.link}`;

      try {
        console.log(`[GroupShareService] Sharing post to group "${group.name}" (${group._id})...`);
        const { shareId } = await this.fbClient.shareToGroup(
          group._id,
          tokenToUse,
          postUrl,
          shareMessage,
          config.DRY_RUN
        );

        const record: GroupShareRecord = {
          groupId: group._id,
          groupName: group.name,
          fbSharePostId: shareId,
          status: 'success',
          sharedAt: new Date(),
        };
        results.push(record);

        // Record persistent log in group_shares
        await shareLogsCol.insertOne({
          _id: crypto.randomUUID(),
          articleId: article._id,
          articleTitle: article.title,
          pageId: page._id,
          groupId: group._id,
          groupName: group.name,
          postUrl,
          fbSharePostId: shareId,
          status: 'success',
          createdAt: new Date(),
        } as any);

        console.log(`✓ [GroupShareService] Successfully shared to group "${group.name}" (Share ID: ${shareId})`);
      } catch (err: any) {
        const errorMsg = err.message || String(err);
        console.warn(`[GroupShareService] Warning: Failed to share to group "${group.name}" (${group._id}):`, errorMsg);

        const record: GroupShareRecord = {
          groupId: group._id,
          groupName: group.name,
          status: 'failed',
          errorMessage: errorMsg,
          sharedAt: new Date(),
        };
        results.push(record);

        await shareLogsCol.insertOne({
          _id: crypto.randomUUID(),
          articleId: article._id,
          articleTitle: article.title,
          pageId: page._id,
          groupId: group._id,
          groupName: group.name,
          postUrl,
          status: 'failed',
          errorMessage: errorMsg,
          createdAt: new Date(),
        } as any);
      }
    }

    return results;
  }

  /**
   * Manually trigger a test share to a specific Facebook group
   */
  public async shareToSpecificGroup(
    groupId: string,
    article: NewsArticle,
    page: FacebookPage,
    postId: string
  ): Promise<GroupShareRecord> {
    const db = getDatabase();
    const groupsCol = db.collection<FacebookGroup>('facebook_groups');
    const group = await groupsCol.findOne({ _id: groupId });

    if (!group) {
      throw new Error(`Facebook Group with ID ${groupId} not found in database.`);
    }

    const cleanPostIdPart = postId.includes('_') ? postId.split('_')[1] : postId;
    const postUrl = `https://www.facebook.com/${page._id}/posts/${cleanPostIdPart}`;
    const tokenToUse = (group.accessToken && group.accessToken.trim()) ? group.accessToken.trim() : page.accessToken;
    const shareMessage = `🔴 ${article.title}\n\nবিস্তারিত পড়ুন প্রথম কমেন্টে: ${article.link}`;

    try {
      const { shareId } = await this.fbClient.shareToGroup(
        group._id,
        tokenToUse,
        postUrl,
        shareMessage,
        config.DRY_RUN
      );

      const record: GroupShareRecord = {
        groupId: group._id,
        groupName: group.name,
        fbSharePostId: shareId,
        status: 'success',
        sharedAt: new Date(),
      };

      const shareLogsCol = db.collection<GroupShareLog>('group_shares');
      await shareLogsCol.insertOne({
        _id: crypto.randomUUID(),
        articleId: article._id,
        articleTitle: article.title,
        pageId: page._id,
        groupId: group._id,
        groupName: group.name,
        postUrl,
        fbSharePostId: shareId,
        status: 'success',
        createdAt: new Date(),
      } as any);

      return record;
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      return {
        groupId: group._id,
        groupName: group.name,
        status: 'failed',
        errorMessage: errorMsg,
        sharedAt: new Date(),
      };
    }
  }
}
