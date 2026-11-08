import { NextResponse } from "next/server";
import { getDb, isValidDate, isValidPriority, toTask } from "@/lib/db";

function getId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// PATCH /api/tasks/:id — ubah tugas.
// Body boleh berisi: { title?, priority?, completed?, task_date? }
export async function PATCH(request, { params }) {
  const id = getId(params);
  if (id === null) {
    return NextResponse.json({ error: "ID tugas tidak valid." }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON." }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  if (!existing) {
    return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  }

  const updates = {};
  if (body.title !== undefined) {
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
    updates.title = title;
  }
  if (body.priority !== undefined) {
    if (!isValidPriority(body.priority)) {
      return NextResponse.json(
        { error: "Prioritas harus salah satu dari: rendah, normal, tinggi." },
        { status: 400 }
      );
    }
    updates.priority = body.priority;
  }
  if (body.task_date !== undefined) {
    if (!isValidDate(body.task_date)) {
      return NextResponse.json(
        { error: "task_date harus berformat YYYY-MM-DD." },
        { status: 400 }
      );
    }
    updates.task_date = body.task_date;
  }

  let completedChanged = false;
  if (body.completed !== undefined) {
    if (typeof body.completed !== "boolean") {
      return NextResponse.json(
        { error: "completed harus boolean." },
        { status: 400 }
      );
    }
    updates.completed = body.completed ? 1 : 0;
    // Cap waktu selesai: diisi saat dicentang, dikosongkan saat dibuka lagi.
    updates.completed_at = body.completed ? new Date().toISOString() : null;
    completedChanged = true;
  }

  if (Object.keys(updates).length === 0 && !completedChanged) {
    return NextResponse.json({ task: toTask(existing) });
  }

  const now = new Date().toISOString();
  const sets = Object.keys(updates).map((key) => `${key} = ?`).join(", ");
  const values = Object.values(updates);
  db.prepare(`UPDATE tasks SET ${sets}, updated_at = ? WHERE id = ?`).run(
    ...values,
    now,
    id
  );

  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  return NextResponse.json({ task: toTask(row) });
}

// DELETE /api/tasks/:id — hapus tugas.
export async function DELETE(request, { params }) {
  const id = getId(params);
  if (id === null) {
    return NextResponse.json({ error: "ID tugas tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  if (result.changes === 0) {
    return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
