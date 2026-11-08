import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AppCollection, AppDatabase } from './types.js';
import { matchesFilter, applyUpdate, sortDocuments } from './mysql.js';
import { config } from '../config/env.js';

export class FileCollection<T = any> implements AppCollection<T> {
  private filePath: string;
  private memoryDocs: any[] = [];
  private isLoaded: boolean = false;

  constructor(public readonly tableName: string, private baseDir: string) {
    this.filePath = path.join(this.baseDir, `${tableName}.json`);
    this.ensureLoaded();
  }

  private ensureLoaded(): void {
    if (this.isLoaded) return;
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.memoryDocs = JSON.parse(raw);
      } else {
        this.memoryDocs = [];
      }
    } catch {
      this.memoryDocs = [];
    }
    this.isLoaded = true;
  }

  private persist(): void {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.memoryDocs, null, 2), 'utf8');
    } catch (err: any) {
      console.warn(`[FileCollection] Error saving ${this.tableName}:`, err.message);
    }
  }

  public async createIndex(): Promise<string> {
    return 'ok';
  }

  public async findOne(filter: any = {}, options?: { sort?: any }): Promise<T | null> {
    this.ensureLoaded();
    let docs = this.memoryDocs.filter((d) => matchesFilter(d, filter));
    if (options?.sort) {
      docs = sortDocuments(docs, options.sort);
    }
    return docs.length > 0 ? (JSON.parse(JSON.stringify(docs[0])) as T) : null;
  }

  public find(filter: any = {}): any {
    this.ensureLoaded();
    let docs = this.memoryDocs.filter((d) => matchesFilter(d, filter));
    let sortObj: any = null;
    let limitNum = 0;
    let skipNum = 0;
    let projObj: any = null;

    const cursor = {
      sort: (s: any) => {
        sortObj = s;
        return cursor;
      },
      limit: (l: number) => {
        limitNum = l;
        return cursor;
      },
      skip: (sk: number) => {
        skipNum = sk;
        return cursor;
      },
      project: (p: any) => {
        projObj = p;
        return cursor;
      },
      toArray: async (): Promise<T[]> => {
        let result = [...docs];
        if (sortObj) result = sortDocuments(result, sortObj);
        if (skipNum > 0) result = result.slice(skipNum);
        if (limitNum > 0) result = result.slice(0, limitNum);
        if (projObj) {
          result = result.map((item: any) => {
            const out: any = {};
            for (const key of Object.keys(projObj)) {
              if (projObj[key] === 1) out[key] = item[key];
            }
            return out;
          });
        }
        return JSON.parse(JSON.stringify(result));
      },
    };

    return cursor;
  }

  public async countDocuments(filter: any = {}): Promise<number> {
    this.ensureLoaded();
    return this.memoryDocs.filter((d) => matchesFilter(d, filter)).length;
  }

  public async insertOne(doc: any): Promise<{ insertedId: string; acknowledged: boolean }> {
    this.ensureLoaded();
    if (!doc._id) doc._id = crypto.randomUUID();
    if (!doc.createdAt) doc.createdAt = new Date();
    doc.updatedAt = new Date();

    const cloned = JSON.parse(JSON.stringify(doc));
    // Check if _id exists -> update, else insert
    const idx = this.memoryDocs.findIndex((d) => d._id === doc._id);
    if (idx >= 0) {
      this.memoryDocs[idx] = cloned;
    } else {
      this.memoryDocs.push(cloned);
    }
    this.persist();
    return { insertedId: doc._id, acknowledged: true };
  }

  public async insertMany(docs: any[]): Promise<{ insertedCount: number; acknowledged: boolean }> {
    for (const d of docs) {
      await this.insertOne(d);
    }
    return { insertedCount: docs.length, acknowledged: true };
  }

  public async updateOne(
    filter: any,
    update: any,
    options?: { upsert?: boolean }
  ): Promise<any> {
    this.ensureLoaded();
    const idx = this.memoryDocs.findIndex((d) => matchesFilter(d, filter));
    if (idx >= 0) {
      applyUpdate(this.memoryDocs[idx], update, false);
      this.memoryDocs[idx].updatedAt = new Date();
      this.persist();
      return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
    }
    if (options?.upsert) {
      const newDoc: any = { _id: filter._id || crypto.randomUUID(), createdAt: new Date() };
      for (const k of Object.keys(filter)) {
        if (!k.startsWith('$')) newDoc[k] = filter[k];
      }
      applyUpdate(newDoc, update, true);
      newDoc.updatedAt = new Date();
      this.memoryDocs.push(newDoc);
      this.persist();
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1, acknowledged: true };
    }
    return { matchedCount: 0, modifiedCount: 0, acknowledged: true };
  }

  public async updateMany(filter: any, update: any): Promise<any> {
    this.ensureLoaded();
    let modCount = 0;
    for (const doc of this.memoryDocs) {
      if (matchesFilter(doc, filter)) {
        applyUpdate(doc, update, false);
        doc.updatedAt = new Date();
        modCount++;
      }
    }
    if (modCount > 0) this.persist();
    return { matchedCount: modCount, modifiedCount: modCount, acknowledged: true };
  }

  public async deleteOne(filter: any): Promise<any> {
    this.ensureLoaded();
    const idx = this.memoryDocs.findIndex((d) => matchesFilter(d, filter));
    if (idx >= 0) {
      this.memoryDocs.splice(idx, 1);
      this.persist();
      return { deletedCount: 1, acknowledged: true };
    }
    return { deletedCount: 0, acknowledged: true };
  }

  public async deleteMany(filter: any): Promise<any> {
    this.ensureLoaded();
    const initialLen = this.memoryDocs.length;
    this.memoryDocs = this.memoryDocs.filter((d) => !matchesFilter(d, filter));
    const deletedCount = initialLen - this.memoryDocs.length;
    if (deletedCount > 0) this.persist();
    return { deletedCount, acknowledged: true };
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
    const before = JSON.parse(JSON.stringify(existing));
    await this.updateOne(filter, update);
    const after = await this.findOne({ _id: (existing as any)._id });
    return options?.returnDocument === 'after' ? after : before;
  }

  public aggregate<R = any>(pipeline: any[]): { toArray(): Promise<R[]> } {
    return {
      toArray: async () => {
        return (await this.find({}).toArray()) as any;
      },
    };
  }
}

export class FileDatabase implements AppDatabase {
  private collections = new Map<string, FileCollection>();
  private baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.join(config.DATA_DIR, 'db');
  }

  public collection<T = any>(name: string): AppCollection<T> {
    let col = this.collections.get(name);
    if (!col) {
      col = new FileCollection(name, this.baseDir);
      this.collections.set(name, col);
    }
    return col as AppCollection<T>;
  }

  public async command(cmd: any): Promise<any> {
    return { ok: 1 };
  }
}
