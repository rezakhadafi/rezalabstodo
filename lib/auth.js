// Lapisan autentikasi — login sederhana untuk pemilik aplikasi.
// Password di-hash dengan scrypt (node:crypto bawaan Node.js) dan tidak
// pernah disimpan dalam bentuk polos. Sesi berupa token acak yang disimpan
// di cookie httpOnly dan dicatat di tabel sessions (SQLite yang sama).
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

export function countUsers() {
  const db = getDb();
  return db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
}

export function createUser(username, password) {
  const { salt, hash } = hashPassword(password);
  const now = new Date().toISOString();
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)"
    )
    .run(username, hash, salt, now);
  return { id: result.lastInsertRowid, username };
}

export function findUserByUsername(username) {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) || null;
}

export function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = getDb();
  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
  ).run(token, userId, expires.toISOString(), now.toISOString());
  return { token, expires };
}

// Ambil pengguna dari cookie sesi pada request; null bila tidak ada / kedaluwarsa.
export function getSessionUser(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT users.id, users.username FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ? AND sessions.expires_at > ?`
    )
    .get(token, new Date().toISOString());
  if (!row) return null;
  return { id: row.id, username: row.username };
}

export function deleteSession(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
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
