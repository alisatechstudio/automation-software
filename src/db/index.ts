import fs from 'fs';
import { MongoClient, MongoClientOptions } from 'mongodb';
import { attachDatabasePool } from '@vercel/functions';
import { config } from '../config/env.js';
import { MySqlDatabase } from './mysql.js';
import { FileDatabase } from './file-db.js';
import { AppDatabase } from './types.js';

let mongoClient: MongoClient | null = null;
let mysqlInstance: MySqlDatabase | null = null;
let dbInstance: any = null;
let isConnected = false;
let lastError: string | null = null;
let activeDbType: 'mysql' | 'mongodb' = config.DB_TYPE;

export function isDbConnected(): boolean {
  return isConnected && !!dbInstance;
}

export function isMongoConnected(): boolean {
  return isDbConnected();
}

export function getLastDbError(): string | null {
  return lastError;
}

export function getLastMongoError(): string | null {
  return lastError;
}

export function getDatabase(): AppDatabase {
  if (!dbInstance) {
    throw new Error(
      `[Database] Database not connected. Last error: ${lastError || 'No connection established'}. Please verify database credentials in .env.`
    );
  }
  return dbInstance;
}

export function setDatabaseInstance(db: any): void {
  dbInstance = db;
  isConnected = !!db;
}

export async function initMySql(): Promise<any> {
  const candidates: Array<{ label: string; config: import('./mysql.js').MySqlConfig }> = [];

  // 1. Explicitly configured socket path from .env (if any)
  if (process.env.MYSQL_SOCKET) {
    candidates.push({
      label: `Unix socket "${process.env.MYSQL_SOCKET}"`,
      config: {
        socketPath: process.env.MYSQL_SOCKET,
        user: config.MYSQL_USER,
        password: config.MYSQL_PASSWORD,
        database: config.MYSQL_DATABASE,
      },
    });
  }

  // 2. Standard cPanel / CloudLinux / CentOS socket paths
  const standardSockets = [
    '/var/lib/mysql/mysql.sock', // Standard cPanel & CloudLinux CageFS socket
    '/tmp/mysql.sock',           // MariaDB / standard Unix
    '/var/run/mysqld/mysqld.sock', // Ubuntu / Debian
  ];

  for (const sock of standardSockets) {
    if (fs.existsSync(sock)) {
      candidates.push({
        label: `cPanel socket "${sock}"`,
        config: {
          socketPath: sock,
          user: config.MYSQL_USER,
          password: config.MYSQL_PASSWORD,
          database: config.MYSQL_DATABASE,
        },
      });
    }
  }

  // 3. TCP candidates (127.0.0.1 and localhost)
  const hostsToTry = [
    config.MYSQL_HOST || '127.0.0.1',
    '127.0.0.1',
    'localhost',
  ];
  const uniqueHosts = Array.from(new Set(hostsToTry));
  for (const host of uniqueHosts) {
    candidates.push({
      label: `TCP ${host}:${config.MYSQL_PORT}`,
      config: {
        host,
        port: config.MYSQL_PORT,
        user: config.MYSQL_USER,
        password: config.MYSQL_PASSWORD,
        database: config.MYSQL_DATABASE,
      },
    });
  }

  let lastConnectErr: any = null;
  let mysqlDb: MySqlDatabase | null = null;
  let connectedVia = '';

  for (const candidate of candidates) {
    try {
      console.log(
        `[MySQL] Attempting connection to "${config.MYSQL_DATABASE}" via ${candidate.label} (User: ${config.MYSQL_USER})...`
      );

      const candidateDb = new MySqlDatabase(candidate.config);

      // Verify connection by running SELECT 1
      await candidateDb.pool.query('SELECT 1');
      console.log(`[MySQL] ✓ Connected successfully to MySQL database "${config.MYSQL_DATABASE}" via ${candidate.label}!`);
      mysqlDb = candidateDb;
      connectedVia = candidate.label;
      break;
    } catch (err: any) {
      // Socket file not existing or ECONNREFUSED are expected when scanning candidates
      lastConnectErr = err;
    }
  }

  if (!mysqlDb) {
    throw lastConnectErr || new Error('Failed to connect to MySQL database via Unix socket or TCP');
  }

  // Ensure all 12 tables exist
  console.log(`[MySQL] Initializing and verifying 12 database tables in MySQL (${connectedVia})...`);
  await mysqlDb.initializeTables();
  console.log('[MySQL] ✓ All 12 tables verified and ready in MySQL!');

  mysqlInstance = mysqlDb;
  dbInstance = mysqlDb;
  isConnected = true;
  lastError = null;
  activeDbType = 'mysql';

  return dbInstance;
}

export async function initMongo(): Promise<any> {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URL || config.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI environment variable is missing.');
  }

  console.log(`[MongoDB] Connecting with pool to ${maskUri(uri)}...`);

  const options: MongoClientOptions = {
    appName: 'devrel.vercel.integration',
    maxIdleTimeMS: 5000,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  };

  const client = new MongoClient(uri, options);
  await client.connect();

  try {
    attachDatabasePool(client);
  } catch (e) {
    // Non-fatal in non-serverless
  }

  const db = client.db(config.MONGODB_DB_NAME);

  console.log('[MongoDB] Ensuring indexes across collections...');
  const articlesCol = db.collection('news_articles');
  await articlesCol.createIndex({ guid: 1 }, { unique: true }).catch(() => {});
  await articlesCol.createIndex({ link: 1 }, { unique: true }).catch(() => {});
  await articlesCol.createIndex({ pubDate: -1 }).catch(() => {});
  await articlesCol.createIndex({ status: 1 }).catch(() => {});

  const jobsCol = db.collection('jobs');
  await jobsCol.createIndex({ status: 1, runAt: 1 }).catch(() => {});
  await jobsCol.createIndex({ articleId: 1 }).catch(() => {});

  const logsCol = db.collection('post_logs');
  await logsCol.createIndex({ articleId: 1 }).catch(() => {});
  await logsCol.createIndex({ pageId: 1, status: 1, createdAt: -1 }).catch(() => {});

  const sourcesCol = db.collection('rss_sources');
  await sourcesCol.createIndex({ url: 1 }, { unique: true }).catch(() => {});

  mongoClient = client;
  dbInstance = db;
  isConnected = true;
  lastError = null;
  activeDbType = 'mongodb';
  console.log('[MongoDB] Database initialized and indexed successfully.');

  return dbInstance;
}

export async function initDatabase(): Promise<any> {
  const dbType = config.DB_TYPE;
  let activeDb: any = null;

  if (dbType === 'mysql') {
    try {
      activeDb = await initMySql();
    } catch (mysqlErr: any) {
      console.warn(`[Database] MySQL connection failed: ${mysqlErr.message}. Checking MongoDB fallback...`);
      if (config.MONGODB_URI) {
        try {
          activeDb = await initMongo();
        } catch (mErr: any) {
          lastError = `MySQL error: ${mysqlErr.message} | Mongo error: ${mErr.message}`;
        }
      } else {
        lastError = `MySQL Error: ${mysqlErr.message}`;
      }
    }
  } else {
    try {
      activeDb = await initMongo();
    } catch (mongoErr: any) {
      console.warn(`[Database] MongoDB connection failed: ${mongoErr.message}. Checking MySQL fallback...`);
      if (config.MYSQL_DATABASE) {
        try {
          activeDb = await initMySql();
        } catch (myErr: any) {
          lastError = `Mongo error: ${mongoErr.message} | MySQL error: ${myErr.message}`;
        }
      } else {
        lastError = `MongoDB Error: ${mongoErr.message}`;
      }
    }
  }

  if (activeDb) {
    try {
      const { refreshDbSettings } = await import('../services/settings.js');
      await refreshDbSettings(true);
    } catch {}
    return activeDb;
  }

  console.warn(`[Database] Remote database unavailable (${lastError}). Initializing persistent local file database fallback...`);
  const fileDb = new FileDatabase();
  dbInstance = fileDb;
  isConnected = true;
  lastError = null;
  activeDbType = 'mysql';

  try {
    const { refreshDbSettings } = await import('../services/settings.js');
    await refreshDbSettings(true);
  } catch {}

  return fileDb;
}

export async function initMongoDb(): Promise<any> {
  return initDatabase();
}

export async function closeDatabase(): Promise<void> {
  if (mysqlInstance) {
    try {
      await mysqlInstance.close();
    } catch {}
    mysqlInstance = null;
  }
  if (mongoClient) {
    try {
      await mongoClient.close();
    } catch {}
    mongoClient = null;
  }
  dbInstance = null;
  isConnected = false;
  console.log('[Database] Disconnected from database.');
}

function maskUri(uri: string): string {
  try {
    return uri.replace(/:([^@]+)@/, ':****@');
  } catch {
    return 'mongodb://***';
  }
}

export default dbInstance;

export {
  refreshDbSettings,
  getDbSetting,
  getDbSettingSync,
  getDbSettingBool,
  getDbSettingBoolSync,
  getDbSettingNumber,
  isDbDryRun,
  isDbDryRunSync,
  setDbSetting,
  setManyDbSettings,
  getAllDbSettings,
  invalidateSettingsCache,
} from '../services/settings.js';

