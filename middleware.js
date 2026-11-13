import { NextResponse } from "next/server";

// Penjaga rute: halaman utama (/) dan API tugas (/api/tasks/*) butuh login.
// Middleware berjalan di Edge runtime sehingga tidak bisa membaca SQLite —
// di sini hanya dicek keberadaan cookie sesi; validasi token yang sebenarnya
// dilakukan di tiap API route lewat lib/auth.js. Bila cookie tidak ada,
// halaman diarahkan ke /login dan API menjawab 401.
const SESSION_COOKIE = "todo_session";

export function middleware(request) {
  const { pathname } = request.nextUrl;
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/api/tasks")) {
    return NextResponse.json(
      { error: "Silakan login dulu." },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/api/tasks/:path*"],
};
