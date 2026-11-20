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

const ATLAS_DEFAULT_URI =
  'mongodb+srv://Vercel-Admin-atlas-copper-notebook:BNp8pQVDocNKaDwL@atlas-copper-notebook.0czlcmy.mongodb.net/?retryWrites=true&w=majority';

export async function initDatabase(
  uri = process.env.MONGODB_URI ||
    process.env.MONGODB_URL ||
    process.env.MONGO_URL ||
    (process.env.DATABASE_URL?.startsWith('mongodb') ? process.env.DATABASE_URL : '') ||
    ATLAS_DEFAULT_URI,
  dbName = process.env.MONGODB_DB_NAME || 'news_automation'
): Promise<Db> {
  // If already connected with the same instance and not reconnecting
  if (dbInstance && clientInstance) {
    return dbInstance;
  }

  try {
    const client = new MongoClient(uri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });

    await client.connect();
    const db = client.db(dbName);

    logger.info({ dbName }, 'Connected to MongoDB successfully. Initializing indexes...');

    // Initialize indexes gracefully without throwing if an index with different options already exists
    const indexPromises = [
      db.collection('rss_sources').createIndex({ isActive: 1 }).catch((e) => {
        logger.warn({ index: 'isActive_1', err: e.message }, 'Index creation notice');
      }),
      db.collection('news_articles').createIndex({ guid: 1 }).catch((e) => {
        logger.warn({ index: 'guid_1', err: e.message }, 'Index creation notice');
      }),
      db.collection('news_articles').createIndex({ link: 1 }).catch((e) => {
        logger.warn({ index: 'link_1', err: e.message }, 'Index creation notice');
      }),
      db.collection('news_articles').createIndex({ status: 1 }).catch((e) => {
        logger.warn({ index: 'status_1', err: e.message }, 'Index creation notice');
      }),
      db.collection('news_articles').createIndex({ createdAt: -1 }).catch((e) => {
        logger.warn({ index: 'createdAt_-1', err: e.message }, 'Index creation notice');
      }),
    ];
    await Promise.all(indexPromises);

    clientInstance = client;
    dbInstance = db;
    lastDbError = null;
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
