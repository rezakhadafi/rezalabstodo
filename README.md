# To Do List Harian

Aplikasi web sederhana untuk mengelola tugas harian, dibuat dengan **Next.js (App Router)** dan **SQLite**. Desain biru-putih, responsif (mobile-first), dengan animasi, dan siap dipasang sebagai PWA (Progressive Web App).

## Fitur

- Daftar tugas per hari dengan navigasi **Kemarin / Hari ini / Besok**
- Tambah tugas dengan prioritas **Rendah / Normal / Tinggi**
- Centang selesai (dengan cap waktu selesai)
- Edit dan hapus tugas
- Saringan **Semua / Aktif / Selesai**
- Tombol **Bersihkan yang selesai**
- Banner untuk memindahkan tugas kemarin yang belum selesai ke hari ini
- Ring progres harian + confetti saat semua tugas selesai
- PWA: bisa dipasang di layar utama (manifest + service worker sederhana)

> **Catatan ikon PWA:** manifest memakai `icon.svg`. Ikon PNG 192/512 (yang
> disyaratkan sebagian browser untuk instalasi penuh) tidak disertakan di repo
> karena push snapshot GitHub hanya menerima file teks. Bila perlu, generate
> secara lokal dengan `python3 scripts/generate-icons.py` (butuh Pillow), lalu
> tambahkan entrinya ke `public/manifest.webmanifest`.

## Cara Menjalankan

```bash
npm install
npm run dev      # mode pengembangan di http://localhost:3000
```

Untuk produksi:

```bash
npm run build
npm start        # berjalan di http://localhost:3000
```

## Penyimpanan (SQLite)

Semua tugas tersimpan permanen di database SQLite pada file **`data/todo.db`**. File ini **dibuat otomatis** saat server pertama kali menerima request API — tidak perlu setup manual. File `.db` sengaja tidak di-commit ke repo (lihat `.gitignore`).

### Mengatur lokasi database (`SQLITE_PATH`)

Lokasi file database bisa diatur lewat environment variable **`SQLITE_PATH`**:

```bash
SQLITE_PATH=/tmp/uji-todo.db npm start
```

Aturan penentuan lokasi (di `lib/db.js`):

1. Kalau `SQLITE_PATH` diset, pakai path itu.
2. Kalau tidak, dan berjalan di **Vercel** (Vercel otomatis men-set `VERCEL=1`), pakai **`/tmp/todo.db`** — filesystem deployment Vercel read-only kecuali `/tmp`, jadi folder `data/` tidak bisa dibuat di sana.
3. Kalau tidak, pakai `data/todo.db` (perilaku lokal, tidak berubah).

> **Data di `/tmp` bersifat sementara (ephemeral):** di Vercel, isi `/tmp` bisa hilang saat instance serverless didaur ulang. Jadi deploy Vercel membuat aplikasi jalan tanpa error, tapi tugas bisa hilang sewaktu-waktu. Untuk penyimpanan yang tahan lama di cloud, gunakan database terkelola (lihat catatan di bawah).

Skema tabel `tasks`:

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | INTEGER PRIMARY KEY AUTOINCREMENT | ID tugas |
| title | TEXT NOT NULL | Judul tugas |
| priority | TEXT DEFAULT 'normal' | `rendah` / `normal` / `tinggi` |
| completed | INTEGER DEFAULT 0 | 0 = aktif, 1 = selesai |
| completed_at | TEXT | Waktu selesai (ISO), null bila belum selesai |
| task_date | TEXT | Tanggal tugas (YYYY-MM-DD) |
| created_at | TEXT | Waktu dibuat (ISO) |
| updated_at | TEXT | Waktu terakhir diubah (ISO) |

Akses database hanya lewat API routes (`app/api/tasks/route.js` dan `app/api/tasks/[id]/route.js`) menggunakan SQLite bawaan Node.js (`node:sqlite`, `DatabaseSync`) dengan prepared statements.

## Catatan Penting: SQLite dan Hosting

SQLite menyimpan data di file lokal, jadi **butuh disk yang persisten**:

- **Lokal / VPS / server sendiri:** cocok — file `data/todo.db` bertahan selama disk tidak dihapus.
- **Hosting serverless (mis. Vercel):** aplikasi sudah disiapkan agar jalan — saat `VERCEL=1`, database otomatis memakai `/tmp/todo.db` karena filesystem deployment read-only kecuali `/tmp`. Tapi file di `/tmp` **tidak persisten** antar-invocation dan bisa hilang saat instance didaur ulang atau redeploy. Jadi kalau di-deploy ke Vercel, tugas bisa hilang sewaktu-waktu. Untuk penyimpanan yang tahan lama di cloud, jalankan aplikasi ini di VPS/server, atau ganti lapisan penyimpanan dengan database terkelola (mis. Turso / Postgres / Vercel Postgres).
