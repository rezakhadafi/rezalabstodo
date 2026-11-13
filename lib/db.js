// Lapisan akses database — dua mode, antarmuka seragam & asinkron:
//   getDb() -> klien dengan execute({ sql, args }) -> { rows, lastInsertRowid, changes }
//
// 1. Turso (libSQL) — bila TURSO_DATABASE_URL + TURSO_AUTH_TOKEN diset.
//    Dipakai di Vercel supaya SEMUA instance serverless berbagi satu database.
//    Tanpa ini, tiap instance punya /tmp sendiri: akun & tugas yang dibuat di
//    satu instance tidak terlihat di instance lain — login yang baru berhasil
//    pun mental kembali ke /login saat request berikutnya jatuh di instance
//    lain (terbukti 13 Nov 2026: 1 dari 20 request paralel ke /api/auth/me
//    menjawab setupNeeded:true, sisanya false).
// 2. SQLite lokal (node:sqlite) — bila env di atas tidak diset.
//    Perilaku `npm run dev` tidak berubah; data di data/todo.db (atau
//    SQLITE_PATH, atau /tmp/todo.db saat VERCEL=1).
//
// Skema TETAP sama di kedua mode (tabel tasks, users, sessions).
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
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
`;

export function isTursoMode() {
  return Boolean(
    process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN
  );
}

// ---- Mode lokal: bungkus DatabaseSync agar punya execute() asinkron ----
let localClient = null;

function getLocalClient() {
  if (localClient) return localClient;

  // Penentuan path file database SQLite:
  // 1. Kalau env SQLITE_PATH diset, pakai itu.
  // 2. Kalau tidak, dan berjalan di Vercel (Vercel otomatis men-set VERCEL=1),
  //    pakai /tmp/todo.db — filesystem deployment Vercel read-only kecuali /tmp.
  // 3. Kalau tidak, pakai data/todo.db (perilaku lokal, tidak berubah).
  // Catatan: data di /tmp bersifat sementara (ephemeral) dan TIDAK dibagi
  // antar instance serverless — untuk penyimpanan tahan lama & konsisten,
  // gunakan Turso (lihat isTursoMode di atas).
  const dbPath = process.env.SQLITE_PATH
    ? process.env.SQLITE_PATH
    : process.env.VERCEL
      ? "/tmp/todo.db"
      : path.join(process.cwd(), "data", "todo.db");

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);

  localClient = {
    async execute({ sql, args = [] }) {
      const stmt = db.prepare(sql);
      if (/^\s*SELECT/i.test(sql)) {
        return { rows: stmt.all(...args) };
      }
      const info = stmt.run(...args);
      return {
        rows: [],
        lastInsertRowid: info.lastInsertRowid,
        changes: info.changes,
      };
    },
  };
  return localClient;
}

// ---- Mode Turso: @libsql/client, dinormalisasi ke antarmuka yang sama ----
let tursoClient = null;

async function getTursoClient() {
  if (tursoClient) return tursoClient;

  const { createClient } = await import("@libsql/client");
  const raw = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // libSQL mengeksekusi satu statement per panggilan.
  for (const statement of SCHEMA.split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    await raw.execute(statement);
  }

  tursoClient = {
    async execute({ sql, args = [] }) {
      const res = await raw.execute({ sql, args });
      return {
        rows: res.rows,
        lastInsertRowid: res.lastInsertRowid,
        // libSQL menamai ini rowsAffected; samakan dengan nama lokal.
        changes: res.rowsAffected,
      };
    },
  };
  return tursoClient;
}

export async function getDb() {
  if (isTursoMode()) return getTursoClient();
  return getLocalClient();
}

const VALID_PRIORITIES = new Set(["rendah", "normal", "tinggi"]);

export function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidPriority(value) {
  return VALID_PRIORITIES.has(value);
}

// Ubah baris DB (completed 0/1) menjadi objek JSON API (completed boolean).
// Baris dari libSQL bisa membawa id bigint — normalisasi di sini.
export function toTask(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    title: row.title,
    priority: row.priority,
    completed: row.completed === 1,
    completed_at: row.completed_at,
    task_date: row.task_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
