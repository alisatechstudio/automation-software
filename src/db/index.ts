import { MongoClient, type Db } from 'mongodb';
import { logger } from '../logger.js';

let clientInstance: MongoClient | null = null;
let dbInstance: Db | null = null;
let lastDbError: string | null = null;

export function isDbConnected(): boolean {
  return !!dbInstance;
}

export function isMongoConnected(): boolean {
  return !!dbInstance;
}

export function getLastDbError(): string | null {
  return lastDbError;
}

export function getLastMongoError(): string | null {
  return lastDbError;
}

export function setDatabaseInstance(db: any): void {
  dbInstance = db;
}

export async function initMongoDb(
  uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  dbName = process.env.MONGODB_DB_NAME || 'news_automation'
): Promise<Db> {
  return initDatabase(uri, dbName);
}

export async function initDatabase(
  uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  dbName = process.env.MONGODB_DB_NAME || 'news_automation'
): Promise<Db> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    const client = new MongoClient(uri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    const db = client.db(dbName);

    logger.info({ dbName }, 'Connected to MongoDB successfully. Initializing indexes...');

    // Initialize required indexes for performance & deduplication lookups
    await Promise.all([
      db.collection('clips').createIndex({ status: 1 }),
      db.collection('clips').createIndex({ created_at: -1 }),
      db.collection('compliance_checks').createIndex({ clip_id: 1 }),
      db.collection('compliance_reports').createIndex({ clip_id: 1 }, { unique: true }),
      db.collection('processed_videos').createIndex({ clip_id: 1 }),
      db.collection('processed_videos').createIndex({ created_at: -1 }),
      db.collection('approvals').createIndex({ video_id: 1 }),
      db.collection('approvals').createIndex({ status: 1 }),
      db.collection('published_posts').createIndex({ platform: 1, published_at: -1 }),
      db.collection('published_posts').createIndex({ video_id: 1 }),
      db.collection('monitoring_events').createIndex({ detected_at: -1 }),
      db.collection('audit_log').createIndex({ entity_type: 1, entity_id: 1 }),
      db.collection('audit_log').createIndex({ created_at: -1 }),
    ]);

    // Ensure default pipeline state document
    await db.collection('pipeline_state').updateOne(
      { _id: 'pipeline_control' as any },
      {
        $setOnInsert: {
          is_paused: false,
          pause_reason: '',
          updated_at: new Date(),
        },
      },
      { upsert: true }
    );

    clientInstance = client;
    dbInstance = db;
    return dbInstance;
  } catch (err: any) {
    lastDbError = err.message;
    logger.error({ err: err.message, uri }, 'Failed connecting to MongoDB');
    throw err;
  }
}

export function getDatabase(): Db {
  if (!dbInstance) {
    throw new Error('MongoDB database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (clientInstance) {
    await clientInstance.close();
    clientInstance = null;
    dbInstance = null;
    logger.info('MongoDB connection closed.');
  }
}
