import { MongoClient, type Db } from 'mongodb';
import { logger } from '../logger.js';

let clientInstance: MongoClient | null = null;
let dbInstance: Db | null = null;
let lastDbError: string | null = null;

export function isDbConnected(): boolean {
  return !!dbInstance;
}

export function getLastDbError(): string | null {
  return lastDbError;
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

    await Promise.all([
      db.collection('rss_sources').createIndex({ isActive: 1 }),
      db.collection('news_articles').createIndex({ guid: 1 }),
      db.collection('news_articles').createIndex({ link: 1 }),
      db.collection('news_articles').createIndex({ status: 1 }),
      db.collection('news_articles').createIndex({ createdAt: -1 }),
    ]);

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
