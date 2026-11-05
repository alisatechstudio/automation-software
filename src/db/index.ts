import { MongoClient, Db } from 'mongodb';
import { config } from '../config/env.js';

let client: MongoClient | null = null;
let dbInstance: Db | null = null;

export async function getMongoClient(): Promise<MongoClient> {
  if (!client) {
    client = new MongoClient(config.MONGODB_URI, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
    });
    await client.connect();
    console.log('[MongoDB] Connected successfully to MongoDB host');
  }
  return client;
}

export function getDatabase(): Db {
  if (!dbInstance) {
    if (!client) {
      throw new Error('[MongoDB] Database not initialized. Call initMongoDb() first.');
    }
    dbInstance = client.db(config.MONGODB_DB_NAME);
  }
  return dbInstance;
}

export async function initMongoDb(): Promise<Db> {
  const mongoClient = await getMongoClient();
  const db = mongoClient.db(config.MONGODB_DB_NAME);
  dbInstance = db;

  // Ensure collections and indexes are provisioned
  const collections = await db.listCollections().toArray();
  const collectionNames = new Set(collections.map((c) => c.name));

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

  console.log('[MongoDB] Database initialized and indexed.');
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    dbInstance = null;
    console.log('[MongoDB] Disconnected from MongoDB.');
  }
}
