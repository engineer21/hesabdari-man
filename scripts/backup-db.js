import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync, backup } from 'node:sqlite';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dbPath = process.env.DB_PATH || path.join(root, 'data', 'accounting.sqlite');
if (!fs.existsSync(dbPath)) throw new Error('Database does not exist: ' + dbPath);
const backupDir = process.env.BACKUP_DIR || path.join(root, 'backups');
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(backupDir, `accounting-${stamp}.sqlite`);
const db = new DatabaseSync(dbPath);
try {
  await backup(db, target);
  console.log(`SQLite backup saved: ${target}`);
} finally {
  db.close();
}
