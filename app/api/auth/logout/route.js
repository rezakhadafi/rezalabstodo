import { NextResponse } from "next/server";
import { SESSION_COOKIE, deleteSession } from "@/lib/auth";

// POST /api/auth/logout — hapus sesi & cookie.
export async function POST(request) {
  deleteSession(request);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
