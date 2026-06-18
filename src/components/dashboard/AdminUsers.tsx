"use client";

import { useCallback, useEffect, useState } from "react";
import Badges from "@/components/badges/Badges";
import { MANUAL_BADGES } from "@/lib/badges";

interface AdminUser {
  id: string;
  email: string;
  username: string | null;
  shortId: string | null;
  verified: boolean;
  twoFactor: boolean;
  points: number;
  createdAt: string;
  badges: string[];
  messages: number;
  chats: number;
  isAdmin: boolean;
  isSelf: boolean;
}
interface Stats {
  total: number;
  verified: number;
  twoFactor: number;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Модалки вместо нативных prompt()/confirm() — те не работают в in-app браузерах.
  const [ptsTarget, setPtsTarget] = useState<AdminUser | null>(null);
  const [ptsInput, setPtsInput] = useState("");
  const [delTarget, setDelTarget] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const data = await res.json();
    if (data.ok) {
      setUsers(data.users);
      setStats(data.stats);
    } else {
      setError("not authorized");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleBadge(u: AdminUser, key: string) {
    const action = u.badges.includes(key) ? "revoke" : "grant";
    setBusyId(u.id);
    await fetch(`/api/admin/users/${u.id}/badges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, action }),
    }).catch(() => {});
    setBusyId(null);
    load();
  }

  // Начислить/списать очки. amount может быть отрицательным.
  async function applyPoints(amount: number) {
    const u = ptsTarget;
    if (!u || !Number.isFinite(amount) || amount === 0) return;
    setBusyId(u.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        // Берём очки из ответа — без зависимости от кэша/повторной загрузки.
        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, points: data.points } : x)));
        setPtsTarget(null);
        setPtsInput("");
      } else {
        setError(data.error ?? `не удалось изменить очки (${res.status})`);
      }
    } catch {
      setError("сеть недоступна");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    const u = delTarget;
    if (!u) return;
    setBusyId(u.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setDelTarget(null);
        load();
      } else {
        setError(data.error ?? "delete failed");
      }
    } catch {
      setError("сеть недоступна");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-mono text-xl text-fg">
        <span className="text-accent">$</span> admin --users
      </h1>
      <p className="mt-1 text-sm text-fg-dim">manage accounts. handle with care.</p>

      {stats && (
        <div className="mt-4 grid grid-cols-3 gap-2 font-mono">
          {[
            { label: "users", value: stats.total },
            { label: "verified", value: stats.verified },
            { label: "2fa on", value: stats.twoFactor },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-white/10 bg-bg-soft/40 p-3">
              <div className="text-2xl text-accent">{s.value}</div>
              <div className="text-xs text-fg-dim">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-3 font-mono text-xs text-danger">{error}</p>}

      <div className="mt-5 space-y-1.5">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 rounded-lg border border-white/10 bg-bg-soft/30 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-mono text-sm text-fg">
                  {u.username ? `@${u.username}` : "(no nick)"}
                </span>
                {u.shortId && <span className="font-mono text-[11px] text-fg-dim">#{u.shortId}</span>}
                <Badges keys={u.badges} size={13} />
                {u.isAdmin && (
                  <span className="rounded bg-accent/15 px-1.5 font-mono text-[10px] text-accent">admin</span>
                )}
                {!u.verified && (
                  <span className="rounded bg-accent-amber/15 px-1.5 font-mono text-[10px] text-accent-amber">
                    unverified
                  </span>
                )}
                {u.twoFactor && (
                  <span className="rounded bg-white/10 px-1.5 font-mono text-[10px] text-fg-dim">2fa</span>
                )}
              </div>
              <div className="truncate font-mono text-xs text-fg-dim">{u.email}</div>
              <div className="mt-0.5 font-mono text-[11px] text-fg-dim">
                {u.messages} msg · {u.chats} chats · {u.points} pts · joined {fmtDate(u.createdAt)}
              </div>
              {/* выдача именных значков */}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {MANUAL_BADGES.map((b) => {
                  const has = u.badges.includes(b.key);
                  return (
                    <button
                      key={b.key}
                      onClick={() => toggleBadge(u, b.key)}
                      disabled={busyId === u.id}
                      title={b.desc}
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] disabled:opacity-40 ${
                        has
                          ? "border-accent/50 text-accent"
                          : "border-white/15 text-fg-dim hover:text-fg"
                      }`}
                    >
                      {has ? "✓ " : "+ "}
                      {b.label}
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    setPtsTarget(u);
                    setPtsInput("");
                    setError(null);
                  }}
                  disabled={busyId === u.id}
                  title="grant or deduct points"
                  className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-fg-dim hover:text-accent disabled:opacity-40"
                >
                  ± pts
                </button>
              </div>
            </div>

            {u.isSelf ? (
              <span className="shrink-0 font-mono text-[11px] text-fg-dim">you</span>
            ) : (
              <button
                onClick={() => {
                  setDelTarget(u);
                  setError(null);
                }}
                disabled={busyId === u.id || u.isAdmin}
                title={u.isAdmin ? "can't delete another admin" : "delete account"}
                className="shrink-0 rounded border border-danger/40 px-2.5 py-1 font-mono text-xs text-danger hover:bg-danger/10 disabled:opacity-30"
              >
                {busyId === u.id ? "…" : "delete"}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* модалка очков (вместо prompt) */}
      {ptsTarget && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && setPtsTarget(null)}
        >
          <div className="w-[min(92vw,360px)] rounded-lg border border-white/10 bg-bg-soft p-5">
            <div className="font-mono text-sm text-fg">очки · {ptsTarget.username ? `@${ptsTarget.username}` : ptsTarget.email}</div>
            <div className="mt-1 font-mono text-xs text-fg-dim">
              сейчас: <span className="text-accent-amber">{ptsTarget.points}</span> pts
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[100, 500, 1000, -100].map((n) => (
                <button
                  key={n}
                  onClick={() => applyPoints(n)}
                  disabled={busyId === ptsTarget.id}
                  className="rounded border border-white/15 px-2.5 py-1 font-mono text-xs text-fg-dim hover:text-accent disabled:opacity-40"
                >
                  {n > 0 ? `+${n}` : n}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={ptsInput}
                onChange={(e) => setPtsInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyPoints(parseInt(ptsInput, 10))}
                inputMode="numeric"
                placeholder="напр. 1000 или -50"
                className="flex-1 rounded border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-fg outline-none focus:border-accent"
              />
              <button
                onClick={() => applyPoints(parseInt(ptsInput, 10))}
                disabled={busyId === ptsTarget.id || !ptsInput.trim()}
                className="rounded bg-accent px-3 py-2 font-mono text-xs text-bg disabled:opacity-40"
              >
                {busyId === ptsTarget.id ? "…" : "применить"}
              </button>
            </div>
            {error && <p className="mt-2 font-mono text-xs text-danger">{error}</p>}
            <button
              onClick={() => setPtsTarget(null)}
              className="mt-3 w-full rounded border border-white/10 py-1.5 font-mono text-xs text-fg-dim hover:text-fg"
            >
              закрыть
            </button>
          </div>
        </div>
      )}

      {/* модалка удаления (вместо confirm) */}
      {delTarget && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && setDelTarget(null)}
        >
          <div className="w-[min(92vw,360px)] rounded-lg border border-white/10 bg-bg-soft p-5">
            <div className="font-mono text-sm text-danger">удалить аккаунт?</div>
            <p className="mt-2 text-xs text-fg-dim">
              {delTarget.email} — снесёт учётку, сообщения и чаты. отменить нельзя.
            </p>
            {error && <p className="mt-2 font-mono text-xs text-danger">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDelTarget(null)}
                disabled={busyId === delTarget.id}
                className="flex-1 rounded border border-white/15 py-2 font-mono text-xs text-fg-dim hover:text-fg disabled:opacity-50"
              >
                отмена
              </button>
              <button
                onClick={confirmDelete}
                disabled={busyId === delTarget.id}
                className="flex-1 rounded border border-danger/50 bg-danger/10 py-2 font-mono text-xs text-danger disabled:opacity-50"
              >
                {busyId === delTarget.id ? "…" : "удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
