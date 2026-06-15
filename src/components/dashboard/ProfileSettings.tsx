"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileSettings({
  initialUsername,
  initialShortId,
}: {
  initialUsername: string | null;
  initialShortId: string | null;
}) {
  const [username, setUsername] = useState(initialUsername ?? "");
  const [shortId, setShortId] = useState(initialShortId);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function save() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (res.ok) {
        setShortId(data.shortId);
        setMsg({ text: "saved ✓", ok: true });
        router.refresh();
      } else {
        setMsg({ text: data.error ?? "error", ok: false });
      }
    } catch {
      setMsg({ text: "network unavailable", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-white/10 bg-bg-soft/50 p-5">
      <h2 className="mb-1 font-mono text-sm text-fg">profile</h2>
      <p className="mb-4 text-xs text-fg-dim">
        your public handle and short id — others use these to invite you.
      </p>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-fg-dim">username</label>
          <div className="flex items-center gap-2">
            <span className="text-fg-dim">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="your_nick"
              maxLength={20}
              className="w-56 rounded border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-fg outline-none focus:border-accent"
            />
            <button
              onClick={save}
              disabled={busy || username.length < 3}
              className="rounded bg-accent px-4 py-2 font-mono text-sm text-bg disabled:opacity-50"
            >
              save
            </button>
          </div>
          <p className="mt-1 text-[11px] text-fg-dim">
            3–20 chars · a–z, 0–9, underscore
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs text-fg-dim">short id</label>
          <code className="rounded bg-black/40 px-3 py-1.5 font-mono text-sm text-accent-amber">
            {shortId ?? "— (assigned when you pick a username)"}
          </code>
        </div>

        {msg && (
          <p className={`text-xs ${msg.ok ? "text-accent" : "text-danger"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </section>
  );
}
