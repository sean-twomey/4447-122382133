import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

const sqlite = openDatabaseSync('habittracker.db');

// Add a column if it doesn't exist 
function addColumnIfMissing(tableName: string, columnName: string, columnDefinition: string) {
  const columns = sqlite.getAllSync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  const hasColumn = columns.some((column) => column.name === columnName);

  if (hasColumn) return;

  sqlite.execSync(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition};`);
}

sqlite.execSync(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    email      TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id      INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id INTEGER NOT NULL,
    name    TEXT NOT NULL,
    colour  TEXT NOT NULL,
    icon    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS habits (
    id          INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id     INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS habit_logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    habit_id  INTEGER NOT NULL,
    date      TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    count     INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS targets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    habit_id   INTEGER NOT NULL,
    period     TEXT NOT NULL,
    goal_count INTEGER NOT NULL
  );
`);

addColumnIfMissing('habit_logs', 'notes', 'notes TEXT');

export const db = drizzle(sqlite);
