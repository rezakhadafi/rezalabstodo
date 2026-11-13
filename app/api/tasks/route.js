import { NextResponse } from "next/server";
import { getDb, isValidDate, isValidPriority, toTask } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// Semua endpoint tugas butuh login.
async function requireAuth(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });
  }
  return null;
}

// GET /api/tasks?date=YYYY-MM-DD — daftar tugas pada tanggal tersebut.
export async function GET(request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (date && !isValidDate(date)) {
    return NextResponse.json(
      { error: "Parameter date harus berformat YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const taskDate = date || new Date().toISOString().slice(0, 10);
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT * FROM tasks WHERE task_date = ? ORDER BY completed ASC, created_at DESC",
    args: [taskDate],
  });

  return NextResponse.json({ tasks: res.rows.map(toTask) });
}

// POST /api/tasks — tambah tugas baru.
// Body: { title, priority?, task_date? }
export async function POST(request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Judul tugas wajib diisi." }, { status: 400 });
  }
  if (title.length > 500) {
    return NextResponse.json(
      { error: "Judul tugas maksimal 500 karakter." },
      { status: 400 }
    );
  }

  const priority = body.priority ?? "normal";
  if (!isValidPriority(priority)) {
    return NextResponse.json(
      { error: "Prioritas harus salah satu dari: rendah, normal, tinggi." },
      { status: 400 }
    );
  }

  const taskDate = body.task_date ?? new Date().toISOString().slice(0, 10);
  if (!isValidDate(taskDate)) {
    return NextResponse.json(
      { error: "task_date harus berformat YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const db = await getDb();
  const inserted = await db.execute({
    sql: "INSERT INTO tasks (title, priority, completed, completed_at, task_date, created_at, updated_at) VALUES (?, ?, 0, NULL, ?, ?, ?)",
    args: [title, priority, taskDate, now, now],
  });

  const row = await db.execute({
    sql: "SELECT * FROM tasks WHERE id = ?",
    args: [Number(inserted.lastInsertRowid)],
  });
  return NextResponse.json({ task: toTask(row.rows[0]) }, { status: 201 });
}
