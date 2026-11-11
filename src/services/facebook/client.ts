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
   * Formats the first comment containing the news link with a high-CTR Call-To-Action (CTA)
   */
  public formatComment(
    newsUrl: string,
    template: string = config.DEFAULT_COMMENT_FORMAT,
    isEnglish?: boolean
  ): string {
    const cleanUrl = (newsUrl || '').trim();
    if (!cleanUrl) return '';

    const effectiveIsEnglish =
      isEnglish !== undefined
        ? isEnglish
        : cleanUrl.includes('trendingnews') || /^[a-zA-Z0-9\s.,!?'":;\-_#@$%&*()]+$/.test(template);

    // If a custom template is provided (and is not just the legacy default placeholder)
    if (template && (template.includes('{url}') || template.includes('{website}'))) {
      if (effectiveIsEnglish && template.includes('বিস্তারিত')) {
        return `🌐 Read the full story & live updates here:\n👉 ${cleanUrl}`;
      }
      if (template === 'বিস্তারিত পড়ুন: {url}') {
        return `🌐 বিস্তারিত পড়ুন:\n👉 ${cleanUrl}`;
      }
      return template
        .replace(/\{url\}/g, cleanUrl)
        .replace(/\{website\}/g, cleanUrl)
        .trim();
    }

    if (effectiveIsEnglish) {
      return template && template !== 'Read the full story here: {url}'
        ? `${template.trim()}\n👉 ${cleanUrl}`
        : `🌐 Read the full story & live updates here:\n👉 ${cleanUrl}`;
    }

    return template && template !== 'বিস্তারিত পড়ুন: {url}'
      ? `${template.trim()}\n👉 ${cleanUrl}`
      : `🌐 সম্পূর্ণ প্রতিবেদন ও লাইভ আপডেট পড়তে ভিজিট করুন:\n👉 ${cleanUrl}`;
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
   * Queries Meta Graph API to check the encoding and publication status of a video/reel.
   * Returns readiness state, video_status, and any error message.
   */
  public async checkVideoStatus(
    videoId: string,
    accessToken: string
  ): Promise<{ isReady: boolean; status?: string; error?: string }> {
    try {
      const cleanId = videoId.includes('_') ? videoId.split('_').pop()! : videoId;
      const url = `https://graph.facebook.com/${this.apiVersion}/${cleanId}?fields=status&access_token=${encodeURIComponent(accessToken)}`;
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (!res.ok || data.error) {
        return { isReady: false, error: data.error?.message || `HTTP ${res.status}` };
      }
      const videoStatus = (data.status?.video_status || '').toLowerCase();
      const publishingStatus = (data.status?.publishing_phase?.status || '').toLowerCase();
      const processingStatus = (data.status?.processing_phase?.status || '').toLowerCase();

      // Video is ready if video_status is 'ready' or publishing_phase is 'complete'
      const isReady =
        videoStatus === 'ready' ||
        publishingStatus === 'complete' ||
        (!data.status && Boolean(data.id));

      return {
        isReady,
        status: videoStatus || publishingStatus || processingStatus || 'ready',
      };
    } catch (err: any) {
      return { isReady: false, error: err.message };
    }
  }

  /**
   * Publishes a comment with the news link to the created Facebook post or video reel.
   * Features intelligent candidate ID resolution (handles both composite page_post and native video IDs),
   * proactive video readiness polling, form-urlencoded payload dispatch, and resilient exponential retry backoff.
   */
  public async publishComment(
    targetPostId: string,
    accessToken: string,
    commentText: string,
    dryRun: boolean = config.DRY_RUN,
    alternateId?: string
  ): Promise<{ commentId: string }> {
    const cleanComment = (commentText || '').trim();
    if (!cleanComment) {
      console.warn(`[FacebookClient] publishComment skipped: commentText is empty.`);
      return { commentId: '' };
    }

    if (dryRun) {
      const mockCommentId = `dryrun_comment_${Date.now()}`;
      console.log(`[FacebookClient - DRY RUN] Simulated comment on post ${targetPostId}:`);
      console.log(`  Comment: "${cleanComment}"`);
      return { commentId: mockCommentId };
    }

    // Build ordered list of candidate target IDs.
    // For Facebook Reels and Videos, Meta's comment edge expects the direct numeric video ID!
    // Composite pageId_videoId only works on page feed photo/status posts.
    const candidates: string[] = [];
    const addCandidate = (id?: string | null) => {
      if (id && typeof id === 'string') {
        const clean = id.trim();
        if (clean && !candidates.includes(clean)) candidates.push(clean);
      }
    };

    // Extract sub-IDs (the numeric ID after underscore)
    const rawTarget = targetPostId && targetPostId.includes('_') ? targetPostId.split('_').pop() : targetPostId;
    const rawAlternate = alternateId && alternateId.includes('_') ? alternateId.split('_').pop() : alternateId;

    // Prioritize pure numeric IDs first (direct video object nodes for Reels)
    addCandidate(rawTarget);
    addCandidate(rawAlternate);
    // Then direct passed IDs
    addCandidate(targetPostId);
    addCandidate(alternateId);

    console.log(`[FacebookClient] Target comment candidates for Reel/Post: [${candidates.join(', ')}]`);

    let lastError: any = null;
    const maxAttempts = 6;
    const backoffSchedule = [4000, 6000, 8000, 10000, 12000, 15000];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      for (const candidateId of candidates) {
        try {
          // If candidate is a pure numeric ID (likely a video reel), check status on early attempts
          const isNumeric = /^\d+$/.test(candidateId);
          if (isNumeric && attempt <= 2) {
            const statusCheck = await this.checkVideoStatus(candidateId, accessToken);
            if (!statusCheck.isReady && (statusCheck.status === 'processing' || statusCheck.status === 'in_progress')) {
              console.log(`[FacebookClient] ⏳ Meta is currently transcoding Reel ${candidateId} (status: "${statusCheck.status}"). Waiting for video readiness...`);
              break; // Wait for next backoff cycle
            }
          }

          const url = `https://graph.facebook.com/${this.apiVersion}/${candidateId}/comments?access_token=${encodeURIComponent(accessToken)}`;
          console.log(`[FacebookClient] Attempting to publish first comment on ${candidateId} (attempt ${attempt}/${maxAttempts})...`);

          const bodyParams = new URLSearchParams({
            message: cleanComment,
            access_token: accessToken,
          });

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: bodyParams.toString(),
          });

          const data = (await response.json()) as any;

          if (response.ok && data.id && !data.error) {
            console.log(`✓ [FacebookClient] First comment published successfully on ${candidateId}! Comment ID: ${data.id}`);
            return { commentId: data.id };
          }

          lastError = data.error || { message: `HTTP ${response.status}: ${JSON.stringify(data)}` };
          const errMsg = (data.error?.message || '').toLowerCase();
          const isProcessing =
            errMsg.includes('unpublished video') ||
            errMsg.includes('does not exist') ||
            errMsg.includes('cannot be loaded') ||
            data.error?.code === 100;

          if (isProcessing) {
            console.log(`[FacebookClient] ⏳ Reel is still being processed/indexed by Meta on ${candidateId}. Waiting for video readiness...`);
          } else {
            console.warn(`[FacebookClient] Comment attempt on ${candidateId} note: ${lastError.message || JSON.stringify(lastError)}`);
          }
        } catch (netErr: any) {
          lastError = netErr;
          console.warn(`[FacebookClient] Network error posting comment to ${candidateId}:`, netErr.message);
        }
      }

      if (attempt < maxAttempts) {
        const waitMs = backoffSchedule[attempt - 1] || 10000;
        console.log(`[FacebookClient] Waiting ${waitMs / 1000}s for Meta video readiness before retrying comment (attempt ${attempt + 1}/${maxAttempts})...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }

    console.warn(`[FacebookClient] First comment could not be confirmed on ${targetPostId} after ${maxAttempts} attempts:`, lastError?.message || JSON.stringify(lastError));
    return { commentId: '' };
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

      const initRes = await fetch(initUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          upload_phase: 'start',
          access_token: accessToken,
        }),
      });

      const initData = (await initRes.json()) as any;
      console.log(`[FacebookClient] Phase 1 response status: ${initRes.status}`, JSON.stringify(initData));

      if (!initRes.ok || initData.error || !initData.video_id) {
        const errorDetail = initData.error?.message || `HTTP ${initRes.status}`;
        throw new Error(`video_reels start failed: ${errorDetail} (code ${initData.error?.code || 'none'})`);
      }

      const videoId = initData.video_id;
      const uploadUrl = initData.upload_url || `https://rupload.facebook.com/video-upload/${this.apiVersion}/${videoId}`;
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
      const finishPayload: any = {
        upload_phase: 'finish',
        video_id: videoId,
        video_state: 'PUBLISHED',
        description: description,
        access_token: accessToken,
      };
      if (title) finishPayload.title = title;

      const finishRes = await fetch(initUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finishPayload),
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

    // Strategy 2: Official Meta 3-Phase Resumable Video Upload API
    console.log(`[FacebookClient] Fallback: Publishing video via Meta Resumable Video API (https://graph-video.facebook.com/${this.apiVersion}/${pageId}/videos)...`);
    try {
      return await this.publishVideoResumable(pageId, accessToken, videoBuffer, description, title, dryRun);
    } catch (resumableErr: any) {
      const compositeMsg = `Page Videos API failed: ${resumableErr.message}${reelApiError ? ` | Reels API also failed: ${reelApiError}` : ''}`;
      this.handleGraphError(resumableErr?.graphError || { message: compositeMsg }, compositeMsg);
    }
  }

  /**
   * Publishes a video/reel to a Facebook Page using Meta's official 3-phase Resumable Video Upload API:
   * 1. upload_phase=start    -> receives upload_session_id & video_id
   * 2. upload_phase=transfer -> transfers binary video_file_chunk
   * 3. upload_phase=finish   -> finalizes title, description, and publishes
   * 
   * Requires only: pages_manage_posts, pages_read_engagement, pages_show_list
   */
  public async publishVideoResumable(
    pageId: string,
    accessToken: string,
    videoBuffer: Buffer,
    description: string,
    title?: string,
    dryRun: boolean = config.DRY_RUN
  ): Promise<{ videoId: string; postId: string }> {
    if (dryRun) {
      const mockVideoId = `dryrun_vid_${Date.now()}`;
      return { videoId: mockVideoId, postId: `${pageId}_${mockVideoId}` };
    }

    const videoApiUrl = `https://graph-video.facebook.com/${this.apiVersion}/${pageId}/videos`;

    // 1. Phase 1: Start upload session
    console.log(`[FacebookClient] Resumable Video Upload - Phase 1: Initializing session for page ${pageId}...`);
    const startParams = new URLSearchParams();
    startParams.append('upload_phase', 'start');
    startParams.append('file_size', String(videoBuffer.length));
    startParams.append('access_token', accessToken);

    const startRes = await fetch(videoApiUrl, {
      method: 'POST',
      body: startParams,
    });
    const startData = (await startRes.json()) as any;
    console.log(`[FacebookClient] Phase 1 response status: ${startRes.status}`, JSON.stringify(startData));

    if (!startRes.ok || startData.error || !startData.upload_session_id) {
      const err = new Error(`Video upload start failed: ${startData.error?.message || startRes.statusText}`);
      (err as any).graphError = startData.error;
      throw err;
    }

    const uploadSessionId = startData.upload_session_id;
    const initialVideoId = startData.video_id;

    // 2. Phase 2: Transfer binary chunk
    console.log(`[FacebookClient] Resumable Video Upload - Phase 2: Transferring video chunk (${videoBuffer.length} bytes, session ${uploadSessionId})...`);
    const formData = new FormData();
    formData.append('upload_phase', 'transfer');
    formData.append('upload_session_id', uploadSessionId);
    formData.append('start_offset', startData.start_offset || '0');
    formData.append('access_token', accessToken);

    const blob = new Blob([new Uint8Array(videoBuffer)], { type: 'video/mp4' });
    formData.append('video_file_chunk', blob, 'news_reel.mp4');

    const transferRes = await fetch(videoApiUrl, {
      method: 'POST',
      body: formData,
    });
    const transferData = (await transferRes.json()) as any;
    console.log(`[FacebookClient] Phase 2 response status: ${transferRes.status}`, JSON.stringify(transferData));

    if (!transferRes.ok || transferData.error) {
      const err = new Error(`Video chunk transfer failed: ${transferData.error?.message || transferRes.statusText}`);
      (err as any).graphError = transferData.error;
      throw err;
    }

    // 3. Phase 3: Finalize and publish video
    console.log(`[FacebookClient] Resumable Video Upload - Phase 3: Finalizing publication...`);
    const finishParams = new URLSearchParams();
    finishParams.append('upload_phase', 'finish');
    finishParams.append('upload_session_id', uploadSessionId);
    finishParams.append('description', description);
    if (title) finishParams.append('title', title);
    finishParams.append('access_token', accessToken);

    const finishRes = await fetch(videoApiUrl, {
      method: 'POST',
      body: finishParams,
    });
    const finishData = (await finishRes.json()) as any;
    console.log(`[FacebookClient] Phase 3 response status: ${finishRes.status}`, JSON.stringify(finishData));

    if (!finishRes.ok || finishData.error) {
      const err = new Error(`Video publication finalization failed: ${finishData.error?.message || finishRes.statusText}`);
      (err as any).graphError = finishData.error;
      throw err;
    }

    const videoId = finishData.id || initialVideoId;
    const postId = finishData.post_id || `${pageId}_${videoId}`;
    console.log(`✓ [FacebookClient] Video/Reel published successfully via Resumable Video API! Video ID: ${videoId}, Post ID: ${postId}`);
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
