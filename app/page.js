"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PRIORITIES = [
  { value: "rendah", label: "Rendah" },
  { value: "normal", label: "Normal" },
  { value: "tinggi", label: "Tinggi" },
];

const CONFETTI_COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#f59e0b", "#16a34a", "#f472b6"];

// Tanggal lokal YYYY-MM-DD dari objek Date (tanpa geser zona waktu UTC).
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDate(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return toDateKey(date);
}

function formatLong(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

function formatTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function Home() {
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [dateKey, setDateKey] = useState(todayKey);
  const [tasks, setTasks] = useState([]);
  const [yesterdayOpen, setYesterdayOpen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("semua");
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("normal");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("normal");
  const [removingId, setRemovingId] = useState(null);
  const [toast, setToast] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const toastTimer = useRef(null);
  const prevAllDone = useRef(false);

  const showToast = useCallback((message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);

  const fetchTasks = useCallback(async (key) => {
    try {
      const res = await fetch(`/api/tasks?date=${key}`);
      const data = await res.json();
      return data.tasks || [];
    } catch {
      return [];
    }
  }, []);

  const loadDay = useCallback(
    async (key) => {
      setLoading(true);
      const [dayTasks, prevTasks] = await Promise.all([
        fetchTasks(key),
        fetchTasks(shiftDate(key, -1)),
      ]);
      setTasks(dayTasks);
      setYesterdayOpen(prevTasks.filter((t) => !t.completed));
      setLoading(false);
    },
    [fetchTasks]
  );

  useEffect(() => {
    loadDay(dateKey);
  }, [dateKey, loadDay]);

  // Daftarkan service worker PWA (gagal diam-diam bila tidak didukung).
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const doneCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progress = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
  const allDone = totalCount > 0 && doneCount === totalCount;

  // Confetti sekali saat semua tugas hari ini selesai.
  useEffect(() => {
    if (allDone && !prevAllDone.current) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3200);
      return () => clearTimeout(timer);
    }
    prevAllDone.current = allDone;
  }, [allDone]);

  const confettiPieces = useMemo(() => {
    if (!showConfetti) return [];
    return Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2.2 + Math.random() * 1.4,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: Math.random() * 360,
    }));
  }, [showConfetti]);

  const filteredTasks = tasks.filter((t) => {
    if (filter === "aktif") return !t.completed;
    if (filter === "selesai") return t.completed;
    return true;
  });

  async function handleAdd(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, priority: newPriority, task_date: dateKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Gagal menambah tugas.");
        return;
      }
      setTasks((prev) => [data.task, ...prev]);
      setNewTitle("");
      setNewPriority("normal");
    } catch {
      showToast("Tidak bisa terhubung ke server.");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(task) {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Gagal mengubah tugas.");
        return;
      }
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)));
    } catch {
      showToast("Tidak bisa terhubung ke server.");
    }
  }

  async function handleDelete(task) {
    setRemovingId(task.id);
    // Beri waktu animasi keluar sebelum benar-benar menghapus.
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
        if (!res.ok) {
          showToast("Gagal menghapus tugas.");
          setRemovingId(null);
          return;
        }
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        setRemovingId(null);
        showToast("Tugas dihapus.");
      } catch {
        setRemovingId(null);
        showToast("Tidak bisa terhubung ke server.");
      }
    }, 280);
  }

  async function handleSaveEdit(task) {
    const title = editTitle.trim();
    if (!title) {
      showToast("Judul tugas wajib diisi.");
      return;
    }
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, priority: editPriority }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Gagal menyimpan perubahan.");
        return;
      }
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)));
      setEditingId(null);
    } catch {
      showToast("Tidak bisa terhubung ke server.");
    }
  }

  async function handleClearCompleted() {
    const done = tasks.filter((t) => t.completed);
    if (done.length === 0) return;
    try {
      await Promise.all(
        done.map((t) => fetch(`/api/tasks/${t.id}`, { method: "DELETE" }))
      );
      setTasks((prev) => prev.filter((t) => !t.completed));
      showToast(`${done.length} tugas selesai dibersihkan.`);
    } catch {
      showToast("Tidak bisa terhubung ke server.");
    }
  }

  async function handleCarryOver() {
    if (yesterdayOpen.length === 0) return;
    try {
      await Promise.all(
        yesterdayOpen.map((t) =>
          fetch(`/api/tasks/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task_date: dateKey }),
          })
        )
      );
      const moved = yesterdayOpen.length;
      setYesterdayOpen([]);
      await loadDay(dateKey);
      showToast(`${moved} tugas dipindahkan ke hari ini.`);
    } catch {
      showToast("Tidak bisa terhubung ke server.");
    }
  }

  const isToday = dateKey === todayKey;
  const dateLabel = isToday ? "Hari ini" : dateKey < todayKey ? "Kemarin" : "Besok";
  const ringRadius = 30;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <div className="progress-ring" aria-label={`Progres ${progress}%`}>
            <svg width="76" height="76" viewBox="0 0 76 76">
              <circle className="ring-bg" cx="38" cy="38" r={ringRadius} />
              <circle
                className="ring-fg"
                cx="38"
                cy="38"
                r={ringRadius}
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringCircumference - (progress / 100) * ringCircumference}
              />
            </svg>
            <span className="ring-label">{progress}%</span>
          </div>
          <div className="header-text">
            <h1>To Do List Harian</h1>
            <p>
              {doneCount} dari {totalCount} tugas selesai
              {allDone && totalCount > 0 ? " — semua beres!" : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="card date-nav" aria-label="Navigasi tanggal">
          <button className="nav-btn" onClick={() => setDateKey(shiftDate(dateKey, -1))}>
            ‹ Kemarin
          </button>
          <div className="date-label">
            <strong>{dateLabel}</strong>
            <span>{formatLong(dateKey)}</span>
          </div>
          {isToday ? (
            <button className="nav-btn" onClick={() => setDateKey(shiftDate(dateKey, 1))}>
              Besok ›
            </button>
          ) : (
            <button className="nav-btn today-btn" onClick={() => setDateKey(todayKey)}>
              Hari ini
            </button>
          )}
        </section>

        {isToday && yesterdayOpen.length > 0 && (
          <div className="carry-banner" role="status">
            <p>
              Masih ada {yesterdayOpen.length} tugas kemarin yang belum selesai.
            </p>
            <button onClick={handleCarryOver}>Pindahkan ke hari ini</button>
          </div>
        )}

        <section className="card">
          <form className="add-form" onSubmit={handleAdd}>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tulis tugas hari ini..."
              aria-label="Judul tugas baru"
              maxLength={500}
            />
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              aria-label="Prioritas tugas baru"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary" disabled={adding}>
              + Tambah
            </button>
          </form>
        </section>

        <section className="card">
          <div className="toolbar">
            <div className="filters" role="group" aria-label="Saringan tugas">
              {[
                { value: "semua", label: `Semua (${totalCount})` },
                { value: "aktif", label: `Aktif (${totalCount - doneCount})` },
                { value: "selesai", label: `Selesai (${doneCount})` },
              ].map((f) => (
                <button
                  key={f.value}
                  className={filter === f.value ? "active" : ""}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {doneCount > 0 && (
              <button className="clear-btn" onClick={handleClearCompleted}>
                Bersihkan yang selesai
              </button>
            )}
          </div>

          <div className="progress-bar" aria-hidden="true">
            <div style={{ width: `${progress}%` }} />
          </div>

          {loading ? (
            <div className="empty-state">
              <p>Memuat tugas...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">
                ✓
              </span>
              <p>
                {filter === "semua"
                  ? "Belum ada tugas hari ini. Tambahkan tugas pertamamu di atas!"
                  : filter === "aktif"
                    ? "Tidak ada tugas aktif. Semua sudah selesai!"
                    : "Belum ada tugas yang selesai."}
              </p>
            </div>
          ) : (
            <ul className="task-list">
              {filteredTasks.map((task, index) => {
                const isEditing = editingId === task.id;
                const priorityLabel =
                  PRIORITIES.find((p) => p.value === task.priority)?.label ||
                  task.priority;
                return (
                  <li
                    key={task.id}
                    className={`task-item ${task.completed ? "done" : ""} ${
                      removingId === task.id ? "removing" : ""
                    }`}
                    style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
                  >
                    <button
                      className={`checkbox ${task.completed ? "checked" : ""}`}
                      onClick={() => handleToggle(task)}
                      aria-label={
                        task.completed
                          ? "Tandai belum selesai"
                          : "Tandai selesai"
                      }
                      aria-pressed={task.completed}
                    >
                      {task.completed ? "✓" : ""}
                    </button>

                    <div className="task-body">
                      {isEditing ? (
                        <div className="edit-row">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            maxLength={500}
                            aria-label="Edit judul tugas"
                            autoFocus
                          />
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value)}
                            aria-label="Edit prioritas"
                          >
                            {PRIORITIES.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                          <button
                            className="save-btn"
                            onClick={() => handleSaveEdit(task)}
                          >
                            Simpan
                          </button>
                          <button
                            className="cancel-btn"
                            onClick={() => setEditingId(null)}
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="task-title">{task.title}</div>
                          <div className="task-meta">
                            <span className={`priority ${task.priority}`}>
                              {priorityLabel}
                            </span>
                            {task.completed && task.completed_at && (
                              <span>
                                Selesai pukul {formatTime(task.completed_at)}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="task-actions">
                        <button
                          className="icon-btn"
                          onClick={() => {
                            setEditingId(task.id);
                            setEditTitle(task.title);
                            setEditPriority(task.priority);
                          }}
                          aria-label="Edit tugas"
                        >
                          Edit
                        </button>
                        <button
                          className="icon-btn danger"
                          onClick={() => handleDelete(task)}
                          aria-label="Hapus tugas"
                        >
                          Hapus
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="footer-note">
          Tugas tersimpan otomatis di database SQLite di server.
        </p>
      </main>

      {showConfetti && (
        <div className="confetti-layer" aria-hidden="true">
          {confettiPieces.map((piece) => (
            <span
              key={piece.id}
              className="confetti-piece"
              style={{
                left: `${piece.left}%`,
                backgroundColor: piece.color,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
                transform: `rotate(${piece.rotate}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
