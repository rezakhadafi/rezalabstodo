import { NextResponse } from "next/server";
import { countUsers, getSessionUser } from "@/lib/auth";

// GET /api/auth/me — status sesi: apakah akun sudah dibuat & siapa yang login.
export async function GET(request) {
  const user = await getSessionUser(request);
  return NextResponse.json({
    setupNeeded: (await countUsers()) === 0,
    user: user ? { username: user.username } : null,
  });
}
