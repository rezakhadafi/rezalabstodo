"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Halaman login — tampilannya mengikuti aplikasi: header gradien biru,
// kartu putih, tombol biru, animasi masuk. Bila belum ada akun sama sekali,
// halaman ini berubah menjadi form "Buat Akun" (setup sekali di awal).
export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState("loading"); // loading | setup | login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.user) {
          router.replace("/");
          return;
        }
        setStatus(data.setupNeeded ? "setup" : "login");
      } catch {
        setError("Tidak bisa terhubung ke server.");
        setStatus("login");
      }
    })();
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (status === "setup" && password !== confirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        status === "setup" ? "/api/auth/setup" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            status === "setup"
              ? { username, password, confirm }
              : { username, password }
          ),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal masuk.");
        return;
      }
      router.replace("/");
    } catch {
      setError("Tidak bisa terhubung ke server.");
    } finally {
      setBusy(false);
    }
  }

  const isSetup = status === "setup";

  return (
    <>
      <header className="header">
        <div className="header-inner auth-header-inner">
          <div className="header-text">
            <h1>To Do List Harian</h1>
            <p>
              {isSetup
                ? "Buat akun pemilik aplikasinya dulu."
                : "Masuk untuk melihat tugasmu."}
            </p>
          </div>
        </div>
      </header>

      <main className="auth-wrap">
        <section className="card auth-card" aria-label={isSetup ? "Buat akun" : "Login"}>
          {status === "loading" ? (
            <div className="auth-loading">
              <p>Memuat...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 className="auth-title">
                {isSetup ? "Buat Akun" : "Masuk"}
              </h2>
              <p className="auth-subtitle">
                {isSetup
                  ? "Akun ini dibuat sekali di awal dan jadi satu-satunya akun pemilik."
                  : "Selamat datang kembali!"}
              </p>

              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="mis. reza"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  maxLength={30}
                  required
                />
              </div>

              <div className="auth-field">
                <label htmlFor="password">Password</label>
                <div className="password-row">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSetup ? "Minimal 8 karakter" : "Passwordmu"}
                    autoComplete={isSetup ? "new-password" : "current-password"}
                    minLength={isSetup ? 8 : undefined}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? "Sembunyi" : "Lihat"}
                  </button>
                </div>
              </div>

              {isSetup && (
                <div className="auth-field">
                  <label htmlFor="confirm">Konfirmasi Password</label>
                  <input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Ulangi password"
                    autoComplete="new-password"
                    required
                  />
                </div>
              )}

              <button type="submit" className="btn-primary auth-btn" disabled={busy}>
                {busy
                  ? "Memproses..."
                  : isSetup
                    ? "Buat Akun & Masuk"
                    : "Masuk"}
              </button>

              <p className="auth-note">
                {isSetup
                  ? "Setelah akun dibuat, halaman ini hanya menampilkan form login. Simpan passwordmu baik-baik — tidak ada fitur lupa password."
                  : "Lupa password? Akun ini tidak punya fitur reset — hubungi pemilik server untuk menghapus akun di database."}
              </p>
            </form>
          )}
        </section>
      </main>
    </>
  );
}
