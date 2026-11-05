import fs from 'fs';
import path from 'path';
import { getDatabase } from './index.js';

export function runMigrations(): void {
  const db = getDatabase();

  // Ensure migration tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('[Migrator] No migrations directory found at', migrationsDir);
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const appliedRows = db
    .prepare('SELECT name FROM schema_migrations')
    .all() as { name: string }[];
  const appliedNames = new Set(appliedRows.map((r) => r.name));

  for (const file of files) {
    if (!appliedNames.has(file)) {
      console.log(`[Migrator] Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      const executeTransaction = db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
      });

      executeTransaction();
      console.log(`[Migrator] Successfully applied ${file}`);
    }
  }
}

