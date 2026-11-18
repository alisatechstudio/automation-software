import type { DbRepository } from '../db/repository.js';
import type { ProcessedVideo } from '../types/index.js';
import type { PublisherOrchestrator } from '../publishers/index.js';
import { logger } from '../logger.js';

export class ApprovalManager {
  private repo: DbRepository;
  private publisher?: PublisherOrchestrator;

  constructor(repo: DbRepository, publisher?: PublisherOrchestrator) {
    this.repo = repo;
    this.publisher = publisher;
  }

  public setPublisher(publisher: PublisherOrchestrator): void {
    this.publisher = publisher;
  }

  /**
   * Approves a video. Only approved videos can publish.
   */
  public async approve(videoId: string, reviewer: string, notes?: string): Promise<{ success: boolean; message: string }> {
    logger.info({ videoId, reviewer }, 'Approving video for publication...');

    const resolved = await this.repo.resolveApproval(videoId, 'APPROVED', reviewer, notes);
    if (!resolved) {
      return { success: false, message: 'Approval record not found or already resolved.' };
    }

    // Publish if publisher orchestrator is connected
    if (this.publisher) {
      const videoRow = await this.repo.getProcessedVideo(videoId);
      if (videoRow) {
        const video: ProcessedVideo = {
          id: videoRow.id,
          sourceClipId: videoRow.clip_id,
          videoPath: videoRow.video_path,
          thumbnailPath: videoRow.thumbnail_path,
          duration: videoRow.duration,
          title: videoRow.title,
          description: videoRow.description,
          tags: JSON.parse(videoRow.tags_json || '[]'),
          script: videoRow.script,
          containsSyntheticMedia: Boolean(videoRow.contains_synthetic_media),
          selfDeclaredMadeForKids: Boolean(videoRow.self_declared_made_for_kids),
          aspectRatio: '9:16',
          width: 1080,
          height: 1920,
          complianceReport: {
            clipId: videoRow.clip_id,
            passed: true,
            checks: [],
            summary: 'Pre-approved by human reviewer',
            evaluatedAt: new Date().toISOString(),
          },
          createdAt: videoRow.created_at,
        };

        const results = await this.publisher.publishVideo(video);
        logger.info({ videoId, results }, 'Post-approval publish completed.');
        return { success: true, message: `Approved by ${reviewer}. Published to ${results.length} platform(s).` };
      }
    }

    return { success: true, message: `Approved by ${reviewer}. Queued for publisher.` };
  }

  /**
   * Rejects a video. Prevents publication and moves to rejected queue.
   */
  public async reject(videoId: string, reviewer: string, reason?: string): Promise<{ success: boolean; message: string }> {
    logger.info({ videoId, reviewer, reason }, 'Rejecting video...');
    const resolved = await this.repo.resolveApproval(videoId, 'REJECTED', reviewer, reason);
    if (!resolved) {
      return { success: false, message: 'Approval record not found or already resolved.' };
    }

    return { success: true, message: `Video #${videoId} rejected by ${reviewer}.` };
  }

  public async getPendingReviewList(): Promise<any[]> {
    return await this.repo.getPendingApprovals();
  }
}
