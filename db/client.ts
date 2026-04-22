import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

const sqlite = openDatabaseSync('habittracker.db');

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

export const db = drizzle(sqlite);
