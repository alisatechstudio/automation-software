import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { AppCollection, AppDatabase } from './types.js';

export interface MySqlConfig {
  host?: string;
  port?: number;
  socketPath?: string;
  user: string;
  password?: string;
  database: string;
}

export const ALL_COLLECTIONS = [
  'facebook_pages',
  'rss_sources',
  'news_articles',
  'jobs',
  'post_logs',
  'reel_logs',
  'story_logs',
  'youtube_upload_logs',
  'youtube_channels',
  'facebook_groups',
  'group_share_logs',
  'gdrive_reel_configs',
  'tiktok_upload_logs',
  'settings',
];

function toSqlDateTime(date: Date): string {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function restoreDates(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        obj[key] = parsed;
      }
    } else if (typeof val === 'object' && val !== null) {
      restoreDates(val);
    }
  }
  return obj;
}

function rowToDoc<T = any>(row: any): T | null {
  if (!row) return null;
  let doc: any = null;
  try {
    doc = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  } catch {
    doc = {};
  }
  if (!doc) doc = {};
  if (!doc._id) doc._id = row._id;
  restoreDates(doc);
  return doc as T;
}

export function matchesFilter(doc: any, filter: any): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;

  for (const key of Object.keys(filter)) {
    const expected = filter[key];

    if (key === '$or' && Array.isArray(expected)) {
      if (!expected.some((sub) => matchesFilter(doc, sub))) return false;
      continue;
    }
    if (key === '$and' && Array.isArray(expected)) {
      if (!expected.every((sub) => matchesFilter(doc, sub))) return false;
      continue;
    }

    const actual = doc ? doc[key] : undefined;

    if (expected !== null && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$ne' in expected && actual === expected.$ne) return false;
      if ('$eq' in expected && actual !== expected.$eq) return false;
      if ('$in' in expected && Array.isArray(expected.$in) && !expected.$in.includes(actual)) return false;
      if ('$nin' in expected && Array.isArray(expected.$nin) && expected.$nin.includes(actual)) return false;
      if ('$exists' in expected) {
        const exists = actual !== undefined;
        if (Boolean(expected.$exists) !== exists) return false;
      }
      if ('$gt' in expected) {
        const a = actual instanceof Date ? actual.getTime() : actual;
        const e = expected.$gt instanceof Date ? expected.$gt.getTime() : expected.$gt;
        if (!(a > e)) return false;
      }
      if ('$gte' in expected) {
        const a = actual instanceof Date ? actual.getTime() : actual;
        const e = expected.$gte instanceof Date ? expected.$gte.getTime() : expected.$gte;
        if (!(a >= e)) return false;
      }
      if ('$lt' in expected) {
        const a = actual instanceof Date ? actual.getTime() : actual;
        const e = expected.$lt instanceof Date ? expected.$lt.getTime() : expected.$lt;
        if (!(a < e)) return false;
      }
      if ('$lte' in expected) {
        const a = actual instanceof Date ? actual.getTime() : actual;
        const e = expected.$lte instanceof Date ? expected.$lte.getTime() : expected.$lte;
        if (!(a <= e)) return false;
      }
    } else {
      if (expected instanceof Date) {
        const a = actual instanceof Date ? actual.getTime() : new Date(actual).getTime();
        if (a !== expected.getTime()) return false;
      } else if (actual !== expected) {
        return false;
      }
    }
  }

  return true;
}

export function applyUpdate(doc: any, update: any, isInsert: boolean = false): any {
  if (!update) return doc;

  if (isInsert && update.$setOnInsert) {
    for (const k of Object.keys(update.$setOnInsert)) {
      doc[k] = update.$setOnInsert[k];
    }
  }

  if (update.$set) {
    for (const k of Object.keys(update.$set)) {
      doc[k] = update.$set[k];
    }
  }

  if (update.$inc) {
    for (const k of Object.keys(update.$inc)) {
      doc[k] = (doc[k] || 0) + update.$inc[k];
    }
  }

  if (update.$unset) {
    for (const k of Object.keys(update.$unset)) {
      delete doc[k];
    }
  }

  if (!update.$set && !update.$inc && !update.$unset && !update.$setOnInsert) {
    Object.assign(doc, update);
  }

  doc.updatedAt = new Date();
  return doc;
}

function sortDocuments(docs: any[], sortObj: any): any[] {
  if (!sortObj || Object.keys(sortObj).length === 0) return docs;
  const sortKeys = Object.keys(sortObj);

  return docs.sort((a, b) => {
    for (const key of sortKeys) {
      const dir = sortObj[key] === -1 || sortObj[key] === 'desc' ? -1 : 1;
      let valA = a ? a[key] : undefined;
      let valB = b ? b[key] : undefined;

      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();

      if (valA === valB) continue;
      if (valA === undefined || valA === null) return 1 * dir;
      if (valB === undefined || valB === null) return -1 * dir;

      if (valA > valB) return 1 * dir;
      if (valA < valB) return -1 * dir;
    }
    return 0;
  });
}

export class MySqlCursor<T = any> {
  private sortObj: any = null;
  private limitNum: number = 0;
  private skipNum: number = 0;
  private projObj: any = null;

  constructor(
    private col: MySqlCollection<T>,
    private filter: any = {}
  ) {}

  public project(projObj: any): this {
    this.projObj = projObj;
    return this;
  }

  public sort(sortObj: any): this {
    this.sortObj = sortObj;
    return this;
  }

  public limit(num: number): this {
    this.limitNum = num;
    return this;
  }

  public skip(num: number): this {
    this.skipNum = num;
    return this;
  }

  public async toArray(): Promise<T[]> {
    return this.col._executeFind(this.filter, this.sortObj, this.limitNum, this.skipNum, this.projObj);
  }
}

export class MySqlCollection<T = any> implements AppCollection<T> {
  constructor(
    public readonly tableName: string,
    private db: MySqlDatabase
  ) {}

  public async createIndex(keys: any, options?: any): Promise<string> {
    // MySQL handles primary key and index on createdAt.
    return 'ok';
  }

  public async findOne(filter: any = {}, options?: { sort?: any }): Promise<T | null> {
    // Fast path: direct lookup by _id if single primary key equality query
    if (filter && filter._id && typeof filter._id === 'string' && Object.keys(filter).length === 1) {
      const [rows]: any = await this.db.pool.query(
        `SELECT data FROM \`${this.tableName}\` WHERE \`_id\` = ? LIMIT 1`,
        [filter._id]
      );
      if (rows && rows.length > 0) {
        return rowToDoc<T>(rows[0]);
      }
      return null;
    }

    const docs = await this._executeFind(filter, options?.sort || null, 1, 0);
    return docs.length > 0 ? docs[0] : null;
  }

  public find(filter: any = {}): MySqlCursor<T> {
    return new MySqlCursor<T>(this, filter);
  }

  public async countDocuments(filter: any = {}): Promise<number> {
    if (!filter || Object.keys(filter).length === 0) {
      const [rows]: any = await this.db.pool.query(`SELECT COUNT(*) as cnt FROM \`${this.tableName}\``);
      return Number(rows[0]?.cnt || 0);
    }
    const docs = await this._executeFind(filter, null, 0, 0);
    return docs.length;
  }

  public async insertOne(doc: any): Promise<{ insertedId: string; acknowledged: boolean }> {
    if (!doc._id) {
      doc._id = crypto.randomUUID();
    }
    if (!doc.createdAt) {
      doc.createdAt = new Date();
    }
    doc.updatedAt = new Date();

    const createdSql = toSqlDateTime(doc.createdAt);
    const updatedSql = toSqlDateTime(doc.updatedAt);
    const jsonStr = JSON.stringify(doc);

    await this.db.pool.query(
      `INSERT INTO \`${this.tableName}\` (\`_id\`, \`data\`, \`createdAt\`, \`updatedAt\`) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE \`data\` = VALUES(\`data\`), \`updatedAt\` = VALUES(\`updatedAt\`)`,
      [doc._id, jsonStr, createdSql, updatedSql]
    );

    return { insertedId: doc._id, acknowledged: true };
  }

  public async insertMany(docs: any[]): Promise<{ insertedCount: number; acknowledged: boolean }> {
    for (const doc of docs) {
      await this.insertOne(doc);
    }
    return { insertedCount: docs.length, acknowledged: true };
  }

  public async updateOne(
    filter: any,
    update: any,
    options?: { upsert?: boolean }
  ): Promise<{ matchedCount: number; modifiedCount: number; upsertedCount?: number; acknowledged: boolean }> {
    const existing = await this.findOne(filter);

    if (!existing) {
      if (options?.upsert) {
        const newDoc: any = { _id: filter._id || crypto.randomUUID(), createdAt: new Date() };
        for (const k of Object.keys(filter)) {
          if (!k.startsWith('$')) newDoc[k] = filter[k];
        }
        applyUpdate(newDoc, update, true);
        await this.insertOne(newDoc);
        return { matchedCount: 0, modifiedCount: 1, upsertedCount: 1, acknowledged: true };
      }
      return { matchedCount: 0, modifiedCount: 0, acknowledged: true };
    }

    applyUpdate(existing, update, false);
    const jsonStr = JSON.stringify(existing);
    const updatedSql = toSqlDateTime((existing as any).updatedAt || new Date());

    await this.db.pool.query(
      `UPDATE \`${this.tableName}\` SET \`data\` = ?, \`updatedAt\` = ? WHERE \`_id\` = ?`,
      [jsonStr, updatedSql, (existing as any)._id]
    );

    return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
  }

  public async updateMany(
    filter: any,
    update: any
  ): Promise<{ matchedCount: number; modifiedCount: number; acknowledged: boolean }> {
    const docs = await this._executeFind(filter, null, 0, 0);

    for (const doc of docs) {
      applyUpdate(doc, update, false);
      const jsonStr = JSON.stringify(doc);
      const updatedSql = toSqlDateTime((doc as any).updatedAt || new Date());
      await this.db.pool.query(
        `UPDATE \`${this.tableName}\` SET \`data\` = ?, \`updatedAt\` = ? WHERE \`_id\` = ?`,
        [jsonStr, updatedSql, (doc as any)._id]
      );
    }

    return { matchedCount: docs.length, modifiedCount: docs.length, acknowledged: true };
  }

  public async deleteOne(filter: any): Promise<{ deletedCount: number; acknowledged: boolean }> {
    if (filter && filter._id && typeof filter._id === 'string' && Object.keys(filter).length === 1) {
      const [res]: any = await this.db.pool.query(
        `DELETE FROM \`${this.tableName}\` WHERE \`_id\` = ? LIMIT 1`,
        [filter._id]
      );
      return { deletedCount: res.affectedRows || 0, acknowledged: true };
    }

    const doc = await this.findOne(filter);
    if (doc && (doc as any)._id) {
      const [res]: any = await this.db.pool.query(
        `DELETE FROM \`${this.tableName}\` WHERE \`_id\` = ? LIMIT 1`,
        [(doc as any)._id]
      );
      return { deletedCount: res.affectedRows || 0, acknowledged: true };
    }

    return { deletedCount: 0, acknowledged: true };
  }

  public async deleteMany(filter: any): Promise<{ deletedCount: number; acknowledged: boolean }> {
    if (!filter || Object.keys(filter).length === 0) {
      const [res]: any = await this.db.pool.query(`DELETE FROM \`${this.tableName}\``);
      return { deletedCount: res.affectedRows || 0, acknowledged: true };
    }

    const docs = await this._executeFind(filter, null, 0, 0);
    let count = 0;
    for (const doc of docs) {
      if ((doc as any)._id) {
        const [res]: any = await this.db.pool.query(
          `DELETE FROM \`${this.tableName}\` WHERE \`_id\` = ?`,
          [(doc as any)._id]
        );
        count += res.affectedRows || 0;
      }
    }
    return { deletedCount: count, acknowledged: true };
  }

  public async findOneAndUpdate(
    filter: any,
    update: any,
    options?: { sort?: any; returnDocument?: 'before' | 'after'; upsert?: boolean }
  ): Promise<T | null> {
    const existing = await this.findOne(filter, { sort: options?.sort });

    if (!existing) {
      if (options?.upsert) {
        const newDoc: any = { _id: filter._id || crypto.randomUUID(), createdAt: new Date() };
        for (const k of Object.keys(filter)) {
          if (!k.startsWith('$')) newDoc[k] = filter[k];
        }
        applyUpdate(newDoc, update, true);
        await this.insertOne(newDoc);
        return newDoc;
      }
      return null;
    }

    const beforeDoc = JSON.parse(JSON.stringify(existing));
    applyUpdate(existing, update, false);

    const jsonStr = JSON.stringify(existing);
    const updatedSql = toSqlDateTime((existing as any).updatedAt || new Date());

    await this.db.pool.query(
      `UPDATE \`${this.tableName}\` SET \`data\` = ?, \`updatedAt\` = ? WHERE \`_id\` = ?`,
      [jsonStr, updatedSql, (existing as any)._id]
    );

    return options?.returnDocument === 'after' ? existing : beforeDoc;
  }

  public aggregate<R = any>(pipeline: any[]): { toArray(): Promise<R[]> } {
    return {
      toArray: async (): Promise<R[]> => {
        let results: any[] = await this._executeFind({}, null, 0, 0);

        for (const stage of pipeline) {
          if (stage.$match) {
            results = results.filter((d) => matchesFilter(d, stage.$match));
          } else if (stage.$lookup) {
            const { from, localField, foreignField, as } = stage.$lookup;
            const foreignCol = this.db.collection(from);
            const foreignDocs = await foreignCol.find({}).toArray();

            for (const item of results) {
              const matched = foreignDocs.filter((f: any) => f[foreignField] === item[localField]);
              item[as] = matched;
            }
          } else if (stage.$project) {
            const proj = stage.$project;
            results = results.map((item) => {
              const out: any = {};
              for (const key of Object.keys(proj)) {
                const rule = proj[key];
                if (rule === 1) {
                  out[key] = item[key];
                } else if (typeof rule === 'string' && rule.startsWith('$')) {
                  const srcKey = rule.slice(1);
                  out[key] = item[srcKey];
                } else if (rule && typeof rule === 'object' && rule.$arrayElemAt) {
                  const [arrPath, idx] = rule.$arrayElemAt;
                  if (typeof arrPath === 'string' && arrPath.startsWith('$')) {
                    const parts = arrPath.slice(1).split('.');
                    let curr = item;
                    for (const p of parts) {
                      if (Array.isArray(curr)) {
                        curr = curr.map((c: any) => (c ? c[p] : undefined));
                      } else {
                        curr = curr ? curr[p] : undefined;
                      }
                    }
                    out[key] = Array.isArray(curr) ? curr[idx] : undefined;
                  }
                } else {
                  out[key] = rule;
                }
              }
              return out;
            });
          } else if (stage.$group) {
            const groupDef = stage.$group;
            const groups = new Map<any, any>();

            for (const item of results) {
              let groupKey: any;
              if (typeof groupDef._id === 'string' && groupDef._id.startsWith('$')) {
                groupKey = item[groupDef._id.slice(1)];
              } else {
                groupKey = groupDef._id;
              }

              if (!groups.has(groupKey)) {
                groups.set(groupKey, { _id: groupKey, count: 0 });
              }

              const g = groups.get(groupKey);
              if (groupDef.count && groupDef.count.$sum) {
                g.count += groupDef.count.$sum;
              } else {
                g.count += 1;
              }
            }

            results = Array.from(groups.values());
          } else if (stage.$sort) {
            results = sortDocuments(results, stage.$sort);
          } else if (stage.$limit) {
            results = results.slice(0, stage.$limit);
          } else if (stage.$skip) {
            results = results.slice(stage.$skip);
          }
        }

        return results as R[];
      },
    };
  }

  public async _executeFind(
    filter: any,
    sortObj: any,
    limitNum: number,
    skipNum: number,
    projObj?: any
  ): Promise<T[]> {
    let rows: any[] = [];

    // Direct primary key optimization
    if (filter && filter._id && typeof filter._id === 'string' && Object.keys(filter).length === 1) {
      const [r]: any = await this.db.pool.query(
        `SELECT data FROM \`${this.tableName}\` WHERE \`_id\` = ?`,
        [filter._id]
      );
      rows = r;
    } else {
      const [r]: any = await this.db.pool.query(
        `SELECT data FROM \`${this.tableName}\``
      );
      rows = r;
    }

    let docs = rows.map((r) => rowToDoc<T>(r)).filter(Boolean) as T[];

    if (filter && Object.keys(filter).length > 0) {
      docs = docs.filter((d) => matchesFilter(d, filter));
    }

    if (sortObj && Object.keys(sortObj).length > 0) {
      docs = sortDocuments(docs, sortObj);
    }

    if (skipNum > 0) {
      docs = docs.slice(skipNum);
    }

    if (limitNum > 0) {
      docs = docs.slice(0, limitNum);
    }

    if (projObj && Object.keys(projObj).length > 0) {
      docs = docs.map((item: any) => {
        const out: any = {};
        for (const key of Object.keys(projObj)) {
          const rule = projObj[key];
          if (rule === 1) {
            out[key] = item[key];
          } else if (typeof rule === 'string' && rule.startsWith('$')) {
            const srcKey = rule.slice(1);
            out[key] = item[srcKey];
          } else {
            out[key] = rule;
          }
        }
        return out;
      }) as T[];
    }

    return docs;
  }
}

export class MySqlDatabase implements AppDatabase {
  public pool: mysql.Pool;
  private collections = new Map<string, MySqlCollection>();

  constructor(config: MySqlConfig) {
    const poolConfig: mysql.PoolOptions = {
      user: config.user,
      password: config.password || '',
      database: config.database,
      waitForConnections: true,
      connectionLimit: 3,
      queueLimit: 0,
      connectTimeout: 5000,
      charset: 'utf8mb4',
    };

    if (config.socketPath) {
      poolConfig.socketPath = config.socketPath;
    } else {
      poolConfig.host = config.host || '127.0.0.1';
      poolConfig.port = config.port || 3306;
    }

    this.pool = mysql.createPool(poolConfig);

    // Guard against unhandled error events emitted by the pool
    try {
      const rawPool = (this.pool as any).pool || this.pool;
      if (rawPool && typeof rawPool.on === 'function') {
        rawPool.on('error', (err: any) => {
          console.error('[MySQL Pool Error]', err?.message || err);
        });
      }
    } catch {}
  }

  public collection<T = any>(name: string): MySqlCollection<T> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MySqlCollection<T>(name, this));
    }
    return this.collections.get(name) as MySqlCollection<T>;
  }

  public async command(cmd: any): Promise<any> {
    if (cmd && cmd.ping) {
      await this.pool.query('SELECT 1');
      return { ok: 1 };
    }
    return { ok: 1 };
  }

  public async initializeTables(): Promise<void> {
    for (const table of ALL_COLLECTIONS) {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS \`${table}\` (
          \`_id\` VARCHAR(191) NOT NULL PRIMARY KEY,
          \`data\` LONGTEXT NOT NULL,
          \`createdAt\` DATETIME NULL,
          \`updatedAt\` DATETIME NULL,
          INDEX \`idx_created\` (\`createdAt\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
