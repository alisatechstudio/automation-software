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
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
    formData.append('source', blob, 'news_post.png');
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
