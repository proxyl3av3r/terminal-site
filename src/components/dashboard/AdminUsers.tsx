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

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
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

  async function remove(u: AdminUser) {
    if (!confirm(`delete ${u.email}? this removes their account, messages and chats. cannot be undone.`)) {
      return;
    }
    setBusyId(u.id);
    setError(null);
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (data.ok) load();
    else setError(data.error ?? "delete failed");
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
              </div>
            </div>

            {u.isSelf ? (
              <span className="shrink-0 font-mono text-[11px] text-fg-dim">you</span>
            ) : (
              <button
                onClick={() => remove(u)}
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
    </div>
  );
}
