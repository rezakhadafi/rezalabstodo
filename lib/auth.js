// Lapisan autentikasi — login sederhana untuk pemilik aplikasi.
// Password di-hash dengan scrypt (node:crypto bawaan Node.js) dan tidak
// pernah disimpan dalam bentuk polos. Sesi berupa token acak yang disimpan
// di cookie httpOnly dan dicatat di tabel sessions.
// Semua akses database asinkron (lib/db.js) supaya bisa memakai Turso.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getDb } from "./db";

export const SESSION_COOKIE = "todo_session";
const SESSION_DAYS = 30;

// Hash password dengan garam acak per pengguna (format simpan: hex).
export function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

export function verifyPassword(password, saltHex, hashHex) {
  const { hash } = hashPassword(password, saltHex);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(hashHex, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isValidUsername(value) {
  return typeof value === "string" && /^[a-z0-9._]{3,30}$/.test(value);
}

export async function countUsers() {
  const db = await getDb();
  const res = await db.execute({ sql: "SELECT COUNT(*) AS n FROM users" });
  return res.rows[0].n;
}

export async function createUser(username, password) {
  const { salt, hash } = hashPassword(password);
  const now = new Date().toISOString();
  const db = await getDb();
  const res = await db.execute({
    sql: "INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)",
    args: [username, hash, salt, now],
  });
  return { id: Number(res.lastInsertRowid), username };
}

export async function findUserByUsername(username) {
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT * FROM users WHERE username = ?",
    args: [username],
  });
  return res.rows[0] || null;
}

export async function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = await getDb();
  await db.execute({
    sql: "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    args: [token, userId, expires.toISOString(), now.toISOString()],
  });
  return { token, expires };
}

// Ambil pengguna dari cookie sesi pada request; null bila tidak ada / kedaluwarsa.
export async function getSessionUser(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT users.id, users.username FROM sessions
          JOIN users ON users.id = sessions.user_id
          WHERE sessions.token = ? AND sessions.expires_at > ?`,
    args: [token, new Date().toISOString()],
  });
  const row = res.rows[0];
  if (!row) return null;
  return { id: Number(row.id), username: row.username };
}

export async function deleteSession(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.execute({
      sql: "DELETE FROM sessions WHERE token = ?",
      args: [token],
    });
  }
}

export function sessionCookieOptions(expires) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}
