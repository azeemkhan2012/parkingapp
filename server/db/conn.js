import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

// Needed because you're using ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Safely resolve to db path
const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = await open({
  filename: dbPath,
  driver: sqlite3.Database,
});

export default db;
