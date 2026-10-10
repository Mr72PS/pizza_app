/* SQLite im Volume: eine Datei, WAL-Modus, Schema nach Abschnitt 5 der Übergabe. */
import Database from 'better-sqlite3';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  disabled INTEGER NOT NULL DEFAULT 0,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by INTEGER
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by INTEGER
);
CREATE TABLE IF NOT EXISTS event_photos (
  event_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, photo_id)
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/* Früher gab es genau ein Foto pro Event in der Tabelle photos. Die Zeilen ziehen einmalig um, die Dateien bleiben, wo sie sind.
   Die alte Tabelle fällt im selben Schritt weg, sonst käme ein später gelöschtes Foto beim nächsten Start zurück. */
function fotosUmstellen(db) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'photos'").get()) return;
  db.transaction(() => {
    db.exec("INSERT OR IGNORE INTO event_photos (event_id, photo_id, filename, created_at) SELECT event_id, 'erstes', filename, created_at FROM photos");
    db.exec('DROP TABLE photos');
  })();
}

export function openDb(dataDir) {
  mkdirSync(join(dataDir, 'fotos'), {recursive: true});
  const db = new Database(join(dataDir, 'pizza_app.sqlite'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  fotosUmstellen(db);
  return db;
}

export function getMeta(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : fallback;
}

export function setMeta(db, key, value) {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
}
