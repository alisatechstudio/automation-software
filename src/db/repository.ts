import crypto from 'node:crypto';
import type { Db, Collection } from 'mongodb';
import { getDatabase } from './index.js';
import type {
  ApprovalRecord,
  ApprovalStatus,
  ClipMeta,
  ComplianceCheckResult,
  ComplianceReport,
  MonitoringEvent,
  ProcessedVideo,
  PublishResult,
  PublishTarget,
} from '../types/index.js';

export interface AuditLogDoc {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  details: string | null;
  created_at: string;
}

export class DbRepository {
  private db?: Db;
  // In-memory fallback stores for testing or offline execution
  private inMemoryStores: Map<string, Map<string, any>> = new Map();

  constructor(customDb?: Db) {
    if (customDb) {
      this.db = customDb;
    } else {
      try {
        this.db = getDatabase();
      } catch {
        // Fallback to in-memory store if MongoDB not yet initialized (e.g. unit tests)
      }
    }
  }

  public getDb(): Db | undefined {
    if (!this.db) {
      try {
        this.db = getDatabase();
      } catch {
        // Not initialized yet
      }
    }
    return this.db;
  }

  private getCollection(name: string): Collection | null {
    if (this.db) {
      return this.db.collection(name);
    }
    return null;
  }

  private getMemStore(name: string): Map<string, any> {
    if (!this.inMemoryStores.has(name)) {
      this.inMemoryStores.set(name, new Map());
    }
    return this.inMemoryStores.get(name)!;
  }

  // --- Audit Logging ---
  public async logAudit(
    entityType: string,
    entityId: string,
    action: string,
    actor: string,
    details?: Record<string, unknown> | string
  ): Promise<void> {
    const detailsStr = typeof details === 'string' ? details : details ? JSON.stringify(details) : null;
    const doc: AuditLogDoc = {
      id: crypto.randomUUID(),
      entity_type: entityType,
      entity_id: entityId,
      action,
      actor,
      details: detailsStr,
      created_at: new Date().toISOString(),
    };

    const coll = this.getCollection('audit_log');
    if (coll) {
      await coll.insertOne({ ...doc, _id: doc.id as any });
    } else {
      this.getMemStore('audit_log').set(doc.id, doc);
    }
  }

  public async getRecentAuditLogs(limit = 100): Promise<AuditLogDoc[]> {
    const coll = this.getCollection('audit_log');
    if (coll) {
      const docs = await coll.find().sort({ created_at: -1 }).limit(limit).toArray();
      return docs.map((d: any) => ({
        id: d.id || String(d._id),
        entity_type: d.entity_type,
        entity_id: d.entity_id,
        action: d.action,
        actor: d.actor,
        details: d.details,
        created_at: d.created_at,
      }));
    }

    const items = Array.from(this.getMemStore('audit_log').values());
    return items.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  }

  // --- Clips ---
  public async saveClip(clip: ClipMeta): Promise<void> {
    const doc = {
      _id: clip.id as any,
      id: clip.id,
      title: clip.title,
      url: clip.url,
      license_type: clip.licenseType,
      license_proof_url: clip.licenseProofUrl,
      credit: clip.credit,
      published_at: typeof clip.publishedAt === 'string' ? clip.publishedAt : new Date(clip.publishedAt).toISOString(),
      sport: clip.sport,
      duration: clip.duration,
      source_name: clip.sourceName,
      local_file_path: clip.localFilePath || null,
      raw_metadata_json: clip.rawMetadata ? JSON.stringify(clip.rawMetadata) : null,
      status: 'INGESTED',
      created_at: new Date().toISOString(),
    };

    const coll = this.getCollection('clips');
    if (coll) {
      await coll.updateOne(
        { _id: clip.id as any },
        {
          $set: {
            title: doc.title,
            url: doc.url,
            license_type: doc.license_type,
            license_proof_url: doc.license_proof_url,
            credit: doc.credit,
            sport: doc.sport,
            duration: doc.duration,
          },
          $setOnInsert: {
            status: doc.status,
            source_name: doc.source_name,
            local_file_path: doc.local_file_path,
            raw_metadata_json: doc.raw_metadata_json,
            published_at: doc.published_at,
            created_at: doc.created_at,
          },
        },
        { upsert: true }
      );
    } else {
      const existing = this.getMemStore('clips').get(clip.id);
      this.getMemStore('clips').set(clip.id, {
        ...existing,
        ...doc,
        status: existing?.status || 'INGESTED',
      });
    }

    await this.logAudit('CLIP', clip.id, 'INGESTED', clip.sourceName, { title: clip.title, license: clip.licenseType });
  }

  public async getClip(id: string): Promise<(ClipMeta & { status: string; local_file_path?: string }) | null> {
    const coll = this.getCollection('clips');
    let row: any = null;
    if (coll) {
      row = await coll.findOne({ _id: id as any });
    } else {
      row = this.getMemStore('clips').get(id);
    }

    if (!row) return null;

    return {
      id: row.id || row._id,
      title: row.title,
      url: row.url,
      licenseType: row.license_type,
      licenseProofUrl: row.license_proof_url,
      credit: row.credit,
      publishedAt: row.published_at,
      sport: row.sport,
      duration: row.duration,
      sourceName: row.source_name,
      localFilePath: row.local_file_path,
      rawMetadata: row.raw_metadata_json ? JSON.parse(row.raw_metadata_json) : undefined,
      status: row.status,
    };
  }

  public async updateClipStatus(clipId: string, status: string, reason?: string): Promise<void> {
    const coll = this.getCollection('clips');
    if (coll) {
      await coll.updateOne({ _id: clipId as any }, { $set: { status, updated_at: new Date().toISOString() } });
    } else {
      const clip = this.getMemStore('clips').get(clipId);
      if (clip) {
        clip.status = status;
      }
    }
    await this.logAudit('CLIP', clipId, 'STATUS_UPDATED', 'SYSTEM', { status, reason });
  }

  public async getClipsByStatus(status: string, limit = 50): Promise<ClipMeta[]> {
    let rows: any[] = [];
    const coll = this.getCollection('clips');
    if (coll) {
      rows = await coll.find({ status }).sort({ created_at: -1 }).limit(limit).toArray();
    } else {
      rows = Array.from(this.getMemStore('clips').values())
        .filter((c) => c.status === status)
        .slice(0, limit);
    }

    return rows.map((r) => ({
      id: r.id || r._id,
      title: r.title,
      url: r.url,
      licenseType: r.license_type,
      licenseProofUrl: r.license_proof_url,
      credit: r.credit,
      publishedAt: r.published_at,
      sport: r.sport,
      duration: r.duration,
      sourceName: r.source_name,
      localFilePath: r.local_file_path,
    }));
  }

  // --- License Evidence ---
  public async saveLicenseEvidence(evidence: {
    clipId: string;
    licenseType: string;
    proofUrl: string;
    isCommercialAllowed: boolean;
    attributionRequired: boolean;
    attributionText: string;
    notes?: string;
    rawEvidence?: Record<string, unknown>;
  }): Promise<void> {
    const id = crypto.randomUUID();
    const doc = {
      _id: id as any,
      clip_id: evidence.clipId,
      license_type: evidence.licenseType,
      proof_url: evidence.proofUrl,
      verified_at: new Date().toISOString(),
      is_commercial_allowed: evidence.isCommercialAllowed ? 1 : 0,
      attribution_required: evidence.attributionRequired ? 1 : 0,
      attribution_text: evidence.attributionText,
      notes: evidence.notes || null,
      raw_evidence_json: evidence.rawEvidence ? JSON.stringify(evidence.rawEvidence) : null,
      created_at: new Date().toISOString(),
    };

    const coll = this.getCollection('license_evidence');
    if (coll) {
      await coll.insertOne(doc);
    } else {
      this.getMemStore('license_evidence').set(id, doc);
    }

    await this.logAudit('LICENSE_EVIDENCE', evidence.clipId, 'RECORDED', 'COMPLIANCE_GATE', {
      licenseType: evidence.licenseType,
      isCommercialAllowed: evidence.isCommercialAllowed,
    });
  }

  public async getLicenseEvidence(clipId: string): Promise<any> {
    const coll = this.getCollection('license_evidence');
    if (coll) {
      return await coll.findOne({ clip_id: clipId }, { sort: { verified_at: -1 } });
    }
    const list = Array.from(this.getMemStore('license_evidence').values()).filter((e) => e.clip_id === clipId);
    return list[list.length - 1] || null;
  }

  // --- Compliance Checks & Reports ---
  public async recordComplianceCheck(clipId: string, check: ComplianceCheckResult): Promise<void> {
    const id = crypto.randomUUID();
    const doc = {
      _id: id as any,
      clip_id: clipId,
      check_name: check.checkName,
      passed: check.passed ? 1 : 0,
      score: check.score !== undefined ? check.score : null,
      reason: check.reason,
      details_json: check.details ? JSON.stringify(check.details) : null,
      evaluated_at: check.evaluatedAt,
    };

    const coll = this.getCollection('compliance_checks');
    if (coll) {
      await coll.insertOne(doc);
    } else {
      this.getMemStore('compliance_checks').set(id, doc);
    }
  }

  public async saveComplianceReport(report: ComplianceReport): Promise<void> {
    const coll = this.getCollection('compliance_reports');
    const doc = {
      _id: report.clipId as any,
      clip_id: report.clipId,
      passed: report.passed ? 1 : 0,
      summary: report.summary,
      evaluated_at: report.evaluatedAt,
      checks: report.checks,
    };

    if (coll) {
      await coll.updateOne({ _id: report.clipId as any }, { $set: doc }, { upsert: true });
    } else {
      this.getMemStore('compliance_reports').set(report.clipId, doc);
    }

    for (const check of report.checks) {
      await this.recordComplianceCheck(report.clipId, check);
    }

    await this.logAudit('COMPLIANCE_REPORT', report.clipId, report.passed ? 'PASSED' : 'REJECTED', 'COMPLIANCE_GATE', {
      summary: report.summary,
      totalChecks: report.checks.length,
    });
  }

  public async getComplianceReport(clipId: string): Promise<ComplianceReport | null> {
    const coll = this.getCollection('compliance_reports');
    let row: any = null;
    if (coll) {
      row = await coll.findOne({ _id: clipId as any });
    } else {
      row = this.getMemStore('compliance_reports').get(clipId);
    }

    if (!row) return null;

    return {
      clipId: row.clip_id,
      passed: Boolean(row.passed),
      summary: row.summary,
      evaluatedAt: row.evaluated_at,
      checks: row.checks || [],
    };
  }

  // --- Processed Videos & Historical lookups ---
  public async saveProcessedVideo(
    video: ProcessedVideo & { perceptualHash?: string; originalityRatio: number }
  ): Promise<void> {
    const doc = {
      _id: video.id as any,
      id: video.id,
      clip_id: video.sourceClipId,
      video_path: video.videoPath,
      thumbnail_path: video.thumbnailPath,
      duration: video.duration,
      title: video.title,
      description: video.description,
      tags_json: JSON.stringify(video.tags),
      script: video.script,
      perceptual_hash: video.perceptualHash || null,
      contains_synthetic_media: video.containsSyntheticMedia ? 1 : 0,
      self_declared_made_for_kids: video.selfDeclaredMadeForKids ? 1 : 0,
      originality_ratio: video.originalityRatio,
      created_at: new Date().toISOString(),
    };

    const coll = this.getCollection('processed_videos');
    if (coll) {
      await coll.insertOne(doc);
    } else {
      this.getMemStore('processed_videos').set(video.id, doc);
    }

    await this.createApproval(video.id);
    await this.logAudit('PROCESSED_VIDEO', video.id, 'CREATED', 'EDITOR', {
      title: video.title,
      duration: video.duration,
    });
  }

  public async getProcessedVideo(id: string): Promise<any> {
    const coll = this.getCollection('processed_videos');
    if (coll) {
      return await coll.findOne({ _id: id as any });
    }
    return this.getMemStore('processed_videos').get(id) || null;
  }

  public async getAllHistoricalScripts(): Promise<Array<{ id: string; script: string; title: string }>> {
    const coll = this.getCollection('processed_videos');
    if (coll) {
      const docs = await coll.find({}, { projection: { id: 1, script: 1, title: 1 } }).sort({ created_at: -1 }).limit(500).toArray();
      return docs.map((d: any) => ({ id: d.id || String(d._id), script: d.script, title: d.title }));
    }
    return Array.from(this.getMemStore('processed_videos').values()).map((v) => ({
      id: v.id,
      script: v.script,
      title: v.title,
    }));
  }

  public async getAllHistoricalHashes(): Promise<Array<{ id: string; perceptual_hash: string }>> {
    const coll = this.getCollection('processed_videos');
    if (coll) {
      const docs = await coll
        .find({ perceptual_hash: { $ne: null } }, { projection: { id: 1, perceptual_hash: 1 } })
        .sort({ created_at: -1 })
        .limit(500)
        .toArray();
      return docs.map((d: any) => ({ id: d.id || String(d._id), perceptual_hash: d.perceptual_hash }));
    }
    return Array.from(this.getMemStore('processed_videos').values())
      .filter((v) => v.perceptual_hash)
      .map((v) => ({ id: v.id, perceptual_hash: v.perceptual_hash }));
  }

  // --- Approvals in MongoDB ---
  public async createApproval(videoId: string): Promise<string> {
    const id = crypto.randomUUID();
    const doc = {
      _id: id as any,
      id,
      video_id: videoId,
      status: 'PENDING' as ApprovalStatus,
      created_at: new Date().toISOString(),
    };

    const coll = this.getCollection('approvals');
    if (coll) {
      await coll.insertOne(doc);
    } else {
      this.getMemStore('approvals').set(id, doc);
    }

    await this.logAudit('APPROVAL', videoId, 'AWAITING_REVIEW', 'SYSTEM');
    return id;
  }

  public async getPendingApprovals(): Promise<
    Array<{
      approval_id: string;
      video_id: string;
      clip_id: string;
      video_path: string;
      thumbnail_path: string;
      title: string;
      description: string;
      script: string;
      duration: number;
      originality_ratio: number;
      license_type: string;
      license_proof_url: string;
      credit: string;
      compliance_summary: string;
      created_at: string;
    }>
  > {
    const coll = this.getCollection('approvals');
    if (coll) {
      const pipeline = [
        { $match: { status: 'PENDING' } },
        {
          $lookup: {
            from: 'processed_videos',
            localField: 'video_id',
            foreignField: '_id',
            as: 'video',
          },
        },
        { $unwind: '$video' },
        {
          $lookup: {
            from: 'clips',
            localField: 'video.clip_id',
            foreignField: '_id',
            as: 'clip',
          },
        },
        { $unwind: '$clip' },
        {
          $lookup: {
            from: 'compliance_reports',
            localField: 'clip._id',
            foreignField: '_id',
            as: 'report',
          },
        },
        {
          $project: {
            approval_id: '$id',
            video_id: '$video_id',
            clip_id: '$video.clip_id',
            video_path: '$video.video_path',
            thumbnail_path: '$video.thumbnail_path',
            title: '$video.title',
            description: '$video.description',
            script: '$video.script',
            duration: '$video.duration',
            originality_ratio: '$video.originality_ratio',
            license_type: '$clip.license_type',
            license_proof_url: '$clip.license_proof_url',
            credit: '$clip.credit',
            compliance_summary: { $ifNull: [{ $arrayElemAt: ['$report.summary', 0] }, 'Compliance passed'] },
            created_at: '$created_at',
          },
        },
        { $sort: { created_at: 1 } },
      ];

      return (await coll.aggregate(pipeline).toArray()) as any;
    }

    // In-memory fallback
    const pendingList = Array.from(this.getMemStore('approvals').values()).filter((a) => a.status === 'PENDING');
    const results: any[] = [];

    for (const app of pendingList) {
      const video = this.getMemStore('processed_videos').get(app.video_id);
      if (!video) continue;
      const clip = this.getMemStore('clips').get(video.clip_id);
      const report = this.getMemStore('compliance_reports').get(video.clip_id);

      results.push({
        approval_id: app.id || app._id,
        video_id: app.video_id,
        clip_id: video.clip_id,
        video_path: video.video_path,
        thumbnail_path: video.thumbnail_path,
        title: video.title,
        description: video.description,
        script: video.script,
        duration: video.duration,
        originality_ratio: video.originality_ratio,
        license_type: clip?.license_type || 'LICENSED',
        license_proof_url: clip?.license_proof_url || '',
        credit: clip?.credit || '',
        compliance_summary: report?.summary || 'Compliance passed',
        created_at: app.created_at,
      });
    }

    return results;
  }

  public async resolveApproval(
    videoId: string,
    status: 'APPROVED' | 'REJECTED',
    reviewer: string,
    notes?: string
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const coll = this.getCollection('approvals');

    let modified = false;
    if (coll) {
      const res = await coll.updateOne(
        { video_id: videoId, status: 'PENDING' },
        {
          $set: {
            status,
            reviewed_by: reviewer,
            reviewed_at: now,
            notes: notes || null,
          },
        }
      );
      modified = res.modifiedCount > 0;
    } else {
      for (const app of this.getMemStore('approvals').values()) {
        if (app.video_id === videoId && app.status === 'PENDING') {
          app.status = status;
          app.reviewed_by = reviewer;
          app.reviewed_at = now;
          app.notes = notes || null;
          modified = true;
          break;
        }
      }
    }

    if (modified) {
      const video = await this.getProcessedVideo(videoId);
      if (video?.clip_id) {
        await this.updateClipStatus(video.clip_id, status === 'APPROVED' ? 'APPROVED' : 'REJECTED');
      }
      await this.logAudit('APPROVAL', videoId, status, reviewer, { notes });
      return true;
    }

    return false;
  }

  // --- Publishing & Daily Limits in MongoDB ---
  public async getCountPublishedToday(platform: PublishTarget): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const coll = this.getCollection('published_posts');
    if (coll) {
      return await coll.countDocuments({
        platform,
        status: { $in: ['SUCCESS', 'SKIPPED_DRY_RUN'] },
        published_at: { $gte: startOfDay.toISOString() },
      });
    }

    const items = Array.from(this.getMemStore('published_posts').values()).filter(
      (p) =>
        p.platform === platform &&
        ['SUCCESS', 'SKIPPED_DRY_RUN'].includes(p.status) &&
        p.published_at >= startOfDay.toISOString()
    );
    return items.length;
  }

  public async recordPublishResult(videoId: string, result: PublishResult): Promise<void> {
    const id = crypto.randomUUID();
    const doc = {
      _id: id as any,
      id,
      video_id: videoId,
      platform: result.target,
      external_id: result.externalId || null,
      external_url: result.externalUrl || null,
      status: result.status,
      error: result.error || null,
      published_at: result.publishedAt || new Date().toISOString(),
    };

    const coll = this.getCollection('published_posts');
    if (coll) {
      await coll.insertOne(doc);
    } else {
      this.getMemStore('published_posts').set(id, doc);
    }

    await this.logAudit('PUBLISH', videoId, result.status, result.target, {
      externalId: result.externalId,
      error: result.error,
    });
  }

  public async getPublishedPosts(limit = 50): Promise<any[]> {
    const coll = this.getCollection('published_posts');
    if (coll) {
      return await coll.find().sort({ published_at: -1 }).limit(limit).toArray();
    }
    const items = Array.from(this.getMemStore('published_posts').values());
    return items.sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, limit);
  }

  // --- Monitoring & Pipeline State in MongoDB ---
  public async recordMonitoringEvent(event: MonitoringEvent): Promise<void> {
    const coll = this.getCollection('monitoring_events');
    const doc = {
      _id: event.id as any,
      ...event,
    };

    if (coll) {
      await coll.insertOne(doc);
    } else {
      this.getMemStore('monitoring_events').set(event.id, doc);
    }

    await this.logAudit('MONITORING', event.externalId, event.eventType, event.platform, {
      severity: event.severity,
      details: event.details,
    });
  }

  public async getMonitoringEvents(limit = 50): Promise<any[]> {
    const coll = this.getCollection('monitoring_events');
    if (coll) {
      return await coll.find().sort({ detected_at: -1 }).limit(limit).toArray();
    }
    const items = Array.from(this.getMemStore('monitoring_events').values());
    return items.sort((a, b) => b.detected_at.localeCompare(a.detected_at)).slice(0, limit);
  }

  public async isPipelinePaused(): Promise<{ isPaused: boolean; reason: string }> {
    const coll = this.getCollection('pipeline_state');
    if (coll) {
      const doc: any = await coll.findOne({ _id: 'pipeline_control' as any });
      return {
        isPaused: Boolean(doc?.is_paused),
        reason: doc?.pause_reason || '',
      };
    }
    const state = this.getMemStore('pipeline_state').get('pipeline_control');
    return {
      isPaused: Boolean(state?.is_paused),
      reason: state?.pause_reason || '',
    };
  }

  public async setPipelinePaused(paused: boolean, reason: string, actor = 'SYSTEM'): Promise<void> {
    const coll = this.getCollection('pipeline_state');
    if (coll) {
      await coll.updateOne(
        { _id: 'pipeline_control' as any },
        {
          $set: {
            is_paused: paused,
            pause_reason: reason,
            updated_at: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    } else {
      this.getMemStore('pipeline_state').set('pipeline_control', {
        is_paused: paused,
        pause_reason: reason,
        updated_at: new Date().toISOString(),
      });
    }

    await this.logAudit('PIPELINE', 'STATE', paused ? 'PAUSED' : 'RESUMED', actor, { reason });
  }
}
