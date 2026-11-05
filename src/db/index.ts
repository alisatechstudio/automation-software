import { MongoClient, MongoClientOptions, Db } from 'mongodb';
import { attachDatabasePool } from '@vercel/functions';
import { config } from '../config/env.js';

let client: MongoClient | null = null;
let dbInstance: Db | null = null;
let isConnected = false;
let lastError: string | null = null;

export function isMongoConnected(): boolean {
  return isConnected && !!client;
}

export function getLastMongoError(): string | null {
  return lastError;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!client) {
    const uri = process.env.MONGODB_URI || config.MONGODB_URI;
    console.log(`[MongoDB] Connecting with Vercel Integration pool to ${maskUri(uri)}...`);

    const options: MongoClientOptions = {
      appName: 'devrel.vercel.integration',
      maxIdleTimeMS: 5000,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    };

    const newClient = new MongoClient(uri, options);

    // Attach the client to ensure proper cleanup on Vercel function suspension
    try {
      attachDatabasePool(newClient);
    } catch (e) {
      // Non-fatal in non-serverless environments
    }

    await newClient.connect();
    client = newClient;
    isConnected = true;
    lastError = null;
    console.log('[MongoDB] Connected successfully to MongoDB host (Vercel Integration Pool Active)');
  }
  return client;
}

export function getDatabase(): Db {
  if (!dbInstance) {
    if (!client) {
      throw new Error(
        `[MongoDB] Database not connected. Last error: ${lastError || 'No connection established'}. Please verify MONGODB_URI in Vercel environment variables.`
      );
    }
    dbInstance = client.db(config.MONGODB_DB_NAME);
  }
  return dbInstance;
}

export async function initMongoDb(): Promise<Db | null> {
  try {
    const mongoClient = await getMongoClient();
    const db = mongoClient.db(config.MONGODB_DB_NAME);
    dbInstance = db;
    isConnected = true;
    lastError = null;

    console.log('[MongoDB] Ensuring indexes across collections...');

    // 1. news_articles indexes
    const articlesCol = db.collection('news_articles');
    await articlesCol.createIndex({ guid: 1 }, { unique: true });
    await articlesCol.createIndex({ link: 1 }, { unique: true });
    await articlesCol.createIndex({ pubDate: -1 });
    await articlesCol.createIndex({ status: 1 });

    // 2. jobs indexes
    const jobsCol = db.collection('jobs');
    await jobsCol.createIndex({ status: 1, runAt: 1 });
    await jobsCol.createIndex({ articleId: 1 });

    // 3. post_logs indexes
    const logsCol = db.collection('post_logs');
    await logsCol.createIndex({ articleId: 1 });
    await logsCol.createIndex({ pageId: 1, status: 1, createdAt: -1 });
    await logsCol.createIndex({ createdAt: -1 });

    // 4. rss_sources index
    const sourcesCol = db.collection('rss_sources');
    await sourcesCol.createIndex({ url: 1 }, { unique: true });

    console.log('[MongoDB] Database initialized and indexed successfully.');
    return db;
  } catch (err: any) {
    isConnected = false;
    lastError = err.message || String(err);
    client = null;
    dbInstance = null;
    console.error(`[MongoDB] Connection failed: ${lastError}`);
    console.warn(
      '⚠️ [MongoDB] Server will start in setup mode. Please ensure MONGODB_URI is configured in Vercel Project Settings and MongoDB Atlas IP Access allows 0.0.0.0/0.'
    );
    return null;
  }
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    try {
      await client.close();
    } catch {
      // Ignore close errors during shutdown
    }
    client = null;
    dbInstance = null;
    isConnected = false;
    console.log('[MongoDB] Disconnected from MongoDB.');
  }
}

function maskUri(uri: string): string {
  try {
    return uri.replace(/:([^@]+)@/, ':****@');
  } catch {
    return 'mongodb://***';
  }
}

export default client;
