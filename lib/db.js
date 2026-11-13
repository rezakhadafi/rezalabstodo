// Lapisan akses SQLite — satu instance DatabaseSync per proses.
// Memakai SQLite bawaan Node.js (node:sqlite), tanpa dependensi native.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// Penentuan path file database SQLite:
// 1. Kalau env SQLITE_PATH diset, pakai itu.
// 2. Kalau tidak, dan berjalan di Vercel (Vercel otomatis men-set VERCEL=1),
//    pakai /tmp/todo.db — filesystem deployment Vercel read-only kecuali /tmp,
//    jadi folder data/ tidak bisa dibuat di sana.
// 3. Kalau tidak, pakai data/todo.db (perilaku lokal, tidak berubah).
// Catatan: data di /tmp bersifat sementara (ephemeral) — bisa hilang saat
// Vercel mendaur ulang instance serverless. Untuk penyimpanan tahan lama
// di cloud, gunakan database terkelola.
const dbPath = process.env.SQLITE_PATH
  ? process.env.SQLITE_PATH
  : process.env.VERCEL
    ? "/tmp/todo.db"
    : path.join(process.cwd(), "data", "todo.db");

let db = null;

export function getDb() {
  if (db) return db;

  // Buat folder parent bila perlu (tidak perlu untuk /tmp yang sudah ada).
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      task_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_task_date ON tasks(task_date);
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  `);

  return db;
}

const VALID_PRIORITIES = new Set(["rendah", "normal", "tinggi"]);

export function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidPriority(value) {
  return VALID_PRIORITIES.has(value);
}

// Ubah baris DB (completed 0/1) menjadi objek JSON API (completed boolean).
export function toTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    priority: row.priority,
    completed: row.completed === 1,
    completed_at: row.completed_at,
    task_date: row.task_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
