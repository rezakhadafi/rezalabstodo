// Service worker: halaman & API selalu dari jaringan dulu (supaya update
// aplikasi langsung terlihat), aset statis boleh dari cache.
// Naikkan CACHE_NAME setiap kali mengubah strategi cache agar cache lama terhapus.
const CACHE_NAME = "todo-harian-v2";
const CORE_ASSETS = ["/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigasi halaman & API: jaringan dulu, cache hanya saat offline.
  // Ini yang membuat halaman login langsung muncul setelah deploy —
  // versi lama memakai cache-first untuk "/" sehingga halaman lama
  // tersimpan di browser dan tidak pernah diperbarui.
  if (request.mode === "navigate" || url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Aset statis (JS/CSS/gambar): cache dulu, lalu jaringan.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return res;
        })
    )
  );
});
