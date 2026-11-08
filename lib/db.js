// Lapisan akses SQLite — satu instance DatabaseSync per proses.
// Memakai SQLite bawaan Node.js (node:sqlite), tanpa dependensi native.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "todo.db");

let db = null;

export function getDb() {
  if (db) return db;

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
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
