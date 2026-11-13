import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  countUsers,
  createSession,
  createUser,
  isValidUsername,
  sessionCookieOptions,
} from "@/lib/auth";

// POST /api/auth/setup — buat akun pemilik pertama.
// Hanya boleh saat belum ada pengguna sama sekali; setelah itu jalurnya
// ditutup (403) dan pembuatan akun baru tidak dimungkinkan lewat API.
// Body: { username, password, confirm }
export async function POST(request) {
  if ((await countUsers()) > 0) {
    return NextResponse.json(
      { error: "Akun sudah dibuat. Silakan login." },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON." }, { status: 400 });
  }

  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirm = typeof body.confirm === "string" ? body.confirm : "";

  if (!isValidUsername(username)) {
    return NextResponse.json(
      {
        error:
          "Username 3–30 karakter: huruf kecil, angka, titik, atau garis bawah.",
      },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password minimal 8 karakter." },
      { status: 400 }
    );
  }
  if (password !== confirm) {
    return NextResponse.json(
      { error: "Konfirmasi password tidak sama." },
      { status: 400 }
    );
  }

  const user = await createUser(username, password);
  const session = await createSession(user.id);
  const res = NextResponse.json(
    { user: { username: user.username } },
    { status: 201 }
  );
  res.cookies.set(
    SESSION_COOKIE,
    session.token,
    sessionCookieOptions(session.expires)
  );
  return res;
}
