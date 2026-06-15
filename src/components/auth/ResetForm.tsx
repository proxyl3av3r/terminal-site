"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Терминальная форма установки нового пароля. Токен/email приходят из query.
export default function ResetForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const invalid = !token || !email;

  async function submit() {
    setMsg(null);
    if (password.length < 8) {
      setMsg({ text: "password must be at least 8 characters", ok: false });
      return;
    }
    if (password !== confirm) {
      setMsg({ text: "passwords do not match", ok: false });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        setMsg({ text: data.message ?? "password updated.", ok: true });
      } else {
        setMsg({ text: data.error ?? "error", ok: false });
      }
    } catch {
      setMsg({ text: "network unavailable, try again later", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-[min(92vw,520px)] overflow-hidden rounded-lg border border-white/10 bg-bg-soft/95 shadow-[0_0_60px_rgba(57,255,20,0.08)]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-danger/80" />
        <span className="h-3 w-3 rounded-full bg-accent-amber/80" />
        <span className="h-3 w-3 rounded-full bg-accent/80" />
        <span className="ml-2 text-xs text-fg-dim">~/auth — passwd</span>
      </div>

      <div className="space-y-4 px-5 py-5 text-sm">
        <p className="text-accent-amber">$ passwd --reset</p>

        {invalid ? (
          <p className="text-danger">invalid link — token or email missing.</p>
        ) : done ? (
          <>
            <p className="text-accent">{msg?.text}</p>
            <button
              onClick={() => router.push("/")}
              className="rounded bg-accent px-4 py-2 font-mono text-sm text-bg"
            >
              &gt; back to home
            </button>
          </>
        ) : (
          <>
            <p className="text-fg-dim">
              account: <span className="text-fg">{email}</span>
            </p>

            <div className="space-y-2">
              <label className="block text-xs text-fg-dim">new password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 font-mono text-fg outline-none focus:border-accent"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs text-fg-dim">confirm password:</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !busy && submit()}
                className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 font-mono text-fg outline-none focus:border-accent"
              />
            </div>

            {msg && (
              <p className={msg.ok ? "text-accent" : "text-danger"}>{msg.text}</p>
            )}

            <button
              onClick={submit}
              disabled={busy}
              className="rounded bg-accent px-4 py-2 font-mono text-sm text-bg disabled:opacity-50"
            >
              {busy ? "…" : "> set new password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
