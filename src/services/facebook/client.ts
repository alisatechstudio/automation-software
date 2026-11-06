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
   * Shares a published Facebook Page post to a Facebook Group via POST /{group-id}/feed
   */
  public async shareToGroup(
    groupId: string,
    accessToken: string,
    postUrl: string,
    message: string,
    dryRun: boolean = config.DRY_RUN
  ): Promise<{ sharePostId: string; shareId: string }> {
    if (dryRun) {
      const mockShareId = `${groupId}_dryrun_share_${Date.now()}`;
      console.log(`[FacebookClient - DRY RUN] Simulated share to Group ${groupId}:`);
      console.log(`  Link: ${postUrl}`);
      console.log(`  Message: ${message}`);
      return { sharePostId: mockShareId, shareId: mockShareId };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${groupId}/feed`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        link: postUrl,
        message,
        access_token: accessToken,
      }),
    });

    const data = (await response.json()) as any;

    if (!response.ok || data.error) {
      this.handleGraphError(data.error, `Share to Group ${groupId} failed`);
    }

    return { sharePostId: data.id, shareId: data.id };
  }

  /**
   * Publishes an MP4 video as a Facebook Reel (or Page Video) using Meta Graph API.
   * Uses the official 3-phase Reels upload session:
   * 1. POST /{page-id}/video_reels (upload_phase: 'start')
   * 2. POST {upload_url} with binary stream
   * 3. POST /{page-id}/video_reels (upload_phase: 'finish', video_state: 'PUBLISHED')
   * With resilient automatic fallback to POST https://graph-video.facebook.com/{apiVersion}/{page-id}/videos.
   */
  public async publishReel(
    pageId: string,
    accessToken: string,
    videoBuffer: Buffer,
    description: string,
    title?: string,
    dryRun: boolean = config.DRY_RUN
  ): Promise<{ videoId: string; postId: string }> {
    if (dryRun) {
      const mockVideoId = `dryrun_reel_${Date.now()}`;
      const mockPostId = `${pageId}_${mockVideoId}`;
      console.log(`[FacebookClient - DRY RUN] Simulated Reel publish to page ${pageId}:`);
      console.log(`  Title: ${title}`);
      console.log(`  Description: ${description}`);
      console.log(`  Video size: ${videoBuffer.length} bytes`);
      return { videoId: mockVideoId, postId: mockPostId };
    }

    let reelApiError: string | null = null;

    // Strategy 1: Official Meta 3-phase Reels Publishing API
    try {
      console.log(`[FacebookClient] Phase 1: Initializing Reel upload session for page ${pageId}...`);
      const initUrl = `https://graph.facebook.com/${this.apiVersion}/${pageId}/video_reels`;

      const initParams = new URLSearchParams();
      initParams.append('upload_phase', 'start');
      initParams.append('access_token', accessToken);

      const initRes = await fetch(initUrl, {
        method: 'POST',
        body: initParams,
      });

      const initData = (await initRes.json()) as any;
      console.log(`[FacebookClient] Phase 1 response status: ${initRes.status}`, JSON.stringify(initData));

      if (!initRes.ok || initData.error || !initData.video_id || !initData.upload_url) {
        const errorDetail = initData.error?.message || `HTTP ${initRes.status}`;
        throw new Error(`video_reels start failed: ${errorDetail} (code ${initData.error?.code || 'none'})`);
      }

      const videoId = initData.video_id;
      const uploadUrl = initData.upload_url;
      console.log(`[FacebookClient] Phase 2: Uploading video binary (${videoBuffer.length} bytes) to ${uploadUrl}...`);

      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `OAuth ${accessToken}`,
          offset: '0',
          file_size: String(videoBuffer.length),
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(videoBuffer),
      });

      let uploadData: any = {};
      try {
        uploadData = await uploadRes.json();
      } catch {
        // Some Meta upload handlers return text or empty JSON
      }
      console.log(`[FacebookClient] Phase 2 response status: ${uploadRes.status}`, JSON.stringify(uploadData));

      if (!uploadRes.ok || uploadData.error) {
        throw new Error(`Reel binary upload failed (${uploadRes.status}): ${uploadData.error?.message || uploadRes.statusText}`);
      }

      console.log(`[FacebookClient] Phase 3: Finalizing Reel publication...`);
      const finishParams = new URLSearchParams();
      finishParams.append('upload_phase', 'finish');
      finishParams.append('video_id', videoId);
      finishParams.append('video_state', 'PUBLISHED');
      finishParams.append('description', description);
      if (title) finishParams.append('title', title);
      finishParams.append('access_token', accessToken);

      const finishRes = await fetch(initUrl, {
        method: 'POST',
        body: finishParams,
      });

      const finishData = (await finishRes.json()) as any;
      console.log(`[FacebookClient] Phase 3 response status: ${finishRes.status}`, JSON.stringify(finishData));

      if (!finishRes.ok || finishData.error || finishData.success === false) {
        throw new Error(`Reel publish finalization failed (${finishRes.status}): ${finishData.error?.message || finishRes.statusText}`);
      }

      const postId = finishData.post_id || `${pageId}_${videoId}`;
      console.log(`✓ [FacebookClient] Reel published successfully via Reels API! Video ID: ${videoId}, Post ID: ${postId}`);
      return { videoId, postId };
    } catch (reelsApiErr: any) {
      reelApiError = reelsApiErr.message;
      console.warn(`[FacebookClient] Reels API error: ${reelApiError}. Executing fallback to graph-video.facebook.com...`);
    }

    // Strategy 2: Resilient Fallback to graph-video.facebook.com/{pageId}/videos
    console.log(`[FacebookClient] Fallback: Publishing video via POST https://graph-video.facebook.com/${this.apiVersion}/${pageId}/videos...`);
    const fallbackUrl = `https://graph-video.facebook.com/${this.apiVersion}/${pageId}/videos`;
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(videoBuffer)], { type: 'video/mp4' });
    formData.append('source', blob, 'news_reel.mp4');
    formData.append('description', description);
    if (title) formData.append('title', title);
    formData.append('published', 'true');
    formData.append('access_token', accessToken);

    const fbRes = await fetch(fallbackUrl, {
      method: 'POST',
      body: formData,
    });

    const fbData = (await fbRes.json()) as any;
    console.log(`[FacebookClient] Fallback response status: ${fbRes.status}`, JSON.stringify(fbData));

    if (!fbRes.ok || fbData.error) {
      const compositeMsg = `Page Videos API failed: ${fbData.error?.message || fbRes.statusText}${reelApiError ? ` | Reels API also failed: ${reelApiError}` : ''}`;
      this.handleGraphError(fbData.error || { message: compositeMsg }, compositeMsg);
    }

    const videoId = fbData.id;
    const postId = fbData.post_id || `${pageId}_${videoId}`;
    console.log(`✓ [FacebookClient] Video published successfully via graph-video fallback! Video ID: ${videoId}, Post ID: ${postId}`);
    return { videoId, postId };
  }

  /**
   * Publishes a photo to Facebook Page Stories (NOT to the feed).
   * 1. Uploads photo as unpublished: POST /{page-id}/photos with published=false
   * 2. Publishes to Page Stories: POST /{page-id}/photo_stories with photo_id
   */
  public async publishPhotoStory(
    pageId: string,
    accessToken: string,
    imageBuffer: Buffer,
    dryRun: boolean = config.DRY_RUN
  ): Promise<{ photoId: string; storyId: string }> {
    if (dryRun) {
      const mockPhotoId = `dryrun_photo_${Date.now()}`;
      const mockStoryId = `dryrun_story_${Date.now()}`;
      console.log(`[FacebookClient - DRY RUN] Simulated photo story publish to page ${pageId}`);
      console.log(`  Image size: ${imageBuffer.length} bytes`);
      return { photoId: mockPhotoId, storyId: mockStoryId };
    }

    // Step 1: Upload photo as unpublished (will NOT appear on page feed)
    console.log(`[FacebookClient] Uploading photo for story (unpublished) to page ${pageId}...`);
    const uploadUrl = `https://graph.facebook.com/${this.apiVersion}/${pageId}/photos`;
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' });
    formData.append('source', blob, 'story_poster.jpg');
    formData.append('published', 'false');
    formData.append('access_token', accessToken);

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const uploadData = (await uploadRes.json()) as any;
    if (!uploadRes.ok || uploadData.error) {
      this.handleGraphError(uploadData.error, `Photo story upload (step 1) to ${pageId} failed`);
    }

    const photoId = uploadData.id;
    if (!photoId) {
      throw new Error(`Failed to obtain photo_id for story on page ${pageId}`);
    }

    // Step 2: Publish photo to Facebook Page Stories
    console.log(`[FacebookClient] Publishing photo ${photoId} to Page Stories via POST /${pageId}/photo_stories...`);
    const storyUrl = `https://graph.facebook.com/${this.apiVersion}/${pageId}/photo_stories`;
    const storyParams = new URLSearchParams();
    storyParams.append('photo_id', photoId);
    storyParams.append('access_token', accessToken);

    const storyRes = await fetch(storyUrl, {
      method: 'POST',
      body: storyParams,
    });

    const storyData = (await storyRes.json()) as any;
    if (!storyRes.ok || storyData.error) {
      this.handleGraphError(storyData.error, `Publish photo to stories (step 2) for ${pageId} failed`);
    }

    const storyId = storyData.id || storyData.post_id || photoId;
    console.log(`✓ [FacebookClient] Photo published to Page Stories successfully! Photo ID: ${photoId}, Story ID: ${storyId}`);
    return { photoId, storyId };
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
