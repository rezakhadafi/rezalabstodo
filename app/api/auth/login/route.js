import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSession,
  findUserByUsername,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";

// POST /api/auth/login — masuk dengan username & password.
// Body: { username, password }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON." }, { status: 400 });
  }

  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  // Pesan error sengaja generik agar tidak membocorkan username mana yang ada.
  const user = findUserByUsername(username);
  if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
    return NextResponse.json(
      { error: "Username atau password salah." },
      { status: 401 }
    );
  }

  const session = createSession(user.id);
  const res = NextResponse.json({ user: { username: user.username } });
  res.cookies.set(
    SESSION_COOKIE,
    session.token,
    sessionCookieOptions(session.expires)
  );
  return res;
}
