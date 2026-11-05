import { config } from '../../config/env.js';

export interface PublishResult {
  photoId: string;
  postId: string;
  commentId?: string;
  isDryRun: boolean;
}

export class FacebookGraphClient {
  private apiVersion: string;

  constructor(apiVersion: string = 'v21.0') {
    this.apiVersion = apiVersion;
  }

  /**
   * Formats the Facebook photo caption (Headline + Short Summary + Hashtags, NO link)
   */
  public formatCaption(
    headline: string,
    summary: string,
    hashtags: string = config.DEFAULT_HASHTAGS,
    template: string = config.DEFAULT_CAPTION_FORMAT
  ): string {
    // Truncate summary if excessively long (keep under 280 chars)
    let cleanSummary = summary.trim();
    if (cleanSummary.length > 280) {
      cleanSummary = cleanSummary.substring(0, 277).trim() + '...';
    }

    return template
      .replace('{headline}', headline.trim())
      .replace('{summary}', cleanSummary)
      .replace('{hashtags}', hashtags.trim())
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Formats the first comment containing the news link
   */
  public formatComment(
    newsUrl: string,
    template: string = config.DEFAULT_COMMENT_FORMAT
  ): string {
    return template.replace('{url}', newsUrl.trim()).trim();
  }

  /**
   * Publishes an image with caption to Facebook Page via POST /{page-id}/photos
   */
  public async publishPhoto(
    pageId: string,
    accessToken: string,
    imageBuffer: Buffer,
    caption: string,
    dryRun: boolean = config.DRY_RUN
  ): Promise<{ photoId: string; postId: string }> {
    if (dryRun) {
      const mockPhotoId = `dryrun_photo_${Date.now()}`;
      const mockPostId = `${pageId}_${mockPhotoId}`;
      console.log(`[FacebookClient - DRY RUN] Simulated photo publish to page ${pageId}:`);
      console.log(`  Caption:\n${caption.split('\n').map((l) => '    ' + l).join('\n')}`);
      console.log(`  Image size: ${imageBuffer.length} bytes`);
      return { photoId: mockPhotoId, postId: mockPostId };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${pageId}/photos`;

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' });
    formData.append('source', blob, 'news_card.jpg');
    formData.append('caption', caption);
    formData.append('published', 'true');
    formData.append('access_token', accessToken);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json() as any;

    if (!response.ok || data.error) {
      this.handleGraphError(data.error, `Photo publish to ${pageId} failed`);
    }

    const photoId = data.id;
    // Graph API might return post_id directly, or we fall back to photo ID
    const postId = data.post_id || `${pageId}_${photoId}`;

    return { photoId, postId };
  }

  /**
   * Publishes a comment with the news link to the created Facebook post
   */
  public async publishComment(
    targetPostId: string,
    accessToken: string,
    commentText: string,
    dryRun: boolean = config.DRY_RUN
  ): Promise<{ commentId: string }> {
    if (dryRun) {
      const mockCommentId = `dryrun_comment_${Date.now()}`;
      console.log(`[FacebookClient - DRY RUN] Simulated comment on post ${targetPostId}:`);
      console.log(`  Comment: "${commentText}"`);
      return { commentId: mockCommentId };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${targetPostId}/comments`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: commentText,
        access_token: accessToken,
      }),
    });

    const data = await response.json() as any;

    if (!response.ok || data.error) {
      this.handleGraphError(data.error, `Comment publish on ${targetPostId} failed`);
    }

    return { commentId: data.id };
  }

  /**
   * Shares a post link with caption to a Facebook Group feed via POST /{group-id}/feed
   */
  public async shareToGroup(
    groupId: string,
    accessToken: string,
    postUrl: string,
    message: string,
    dryRun: boolean = config.DRY_RUN
  ): Promise<{ shareId: string }> {
    if (dryRun) {
      const mockShareId = `${groupId}_dryrun_share_${Date.now()}`;
      console.log(`[FacebookClient - DRY RUN] Simulated share to group ${groupId}:`);
      console.log(`  Message: ${message}`);
      console.log(`  Link: ${postUrl}`);
      return { shareId: mockShareId };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${groupId}/feed`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        link: postUrl,
        access_token: accessToken,
      }),
    });

    const data = (await response.json()) as any;

    if (!response.ok || data.error) {
      this.handleGraphError(data.error, `Share to group ${groupId} failed`);
    }

    return { shareId: data.id };
  }

  /**
   * Fetches groups linked to or managed by a Facebook Page or User token
   */
  public async getLinkedGroups(
    targetId: string,
    accessToken: string
  ): Promise<Array<{ id: string; name: string; privacy?: string }>> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${targetId}/groups?fields=id,name,privacy&access_token=${encodeURIComponent(
        accessToken
      )}`;
      const response = await fetch(url);
      const data = (await response.json()) as any;

      if (!response.ok || data.error) {
        console.warn(`[FacebookClient] Could not fetch groups for ${targetId}:`, data.error?.message);
        return [];
      }

      return (data.data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        privacy: item.privacy,
      }));
    } catch (e: any) {
      console.warn(`[FacebookClient] Error fetching groups:`, e.message);
      return [];
    }
  }

  /**
   * Validates access to a Facebook Group using an access token
   */
  public async validateGroupAccess(
    groupId: string,
    accessToken: string
  ): Promise<{ isValid: boolean; name?: string; privacy?: string; error?: string }> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${groupId}?fields=id,name,privacy&access_token=${encodeURIComponent(
        accessToken
      )}`;
      const response = await fetch(url);
      const data = (await response.json()) as any;

      if (!response.ok || data.error) {
        return {
          isValid: false,
          error: data.error?.message || `Group ${groupId} access denied (Code ${data.error?.code})`,
        };
      }

      return {
        isValid: true,
        name: data.name,
        privacy: data.privacy,
      };
    } catch (err: any) {
      return {
        isValid: false,
        error: err.message || 'Network error checking group access',
      };
    }
  }

  /**
   * Helper that parses Facebook Graph API errors and throws meaningful errors
   */
  private handleGraphError(error: any, contextMessage: string): never {
    const code = error?.code;
    const subcode = error?.error_subcode;
    const message = error?.message || 'Unknown Graph API Error';
    const type = error?.type || 'OAuthException';

    let errorClassification = 'FACEBOOK_API_ERROR';

    if (code === 190) {
      errorClassification = 'TOKEN_EXPIRED_OR_INVALID';
    } else if (code === 4 || code === 17 || code === 32 || code === 613) {
      errorClassification = 'RATE_LIMIT_EXCEEDED';
    } else if (code === 200 || code === 10) {
      errorClassification = 'PERMISSION_DENIED';
    }

    const fullError = new Error(
      `[${errorClassification}] ${contextMessage}: (Code ${code}, Subcode ${subcode}) ${message}`
    );
    (fullError as any).graphError = error;
    (fullError as any).code = code;
    (fullError as any).classification = errorClassification;

    throw fullError;
  }
}
