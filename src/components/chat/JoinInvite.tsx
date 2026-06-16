"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Preview {
  kind: string;
  name: string | null;
  memberCount: number;
  alreadyMember: boolean;
}

export default function JoinInvite({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/invite/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (data.ok) setPreview(data.chat);
      else setError(data.error ?? "invalid link");
    } catch {
      setError("network error");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function join() {
    setBusy(true);
    const res = await fetch(`/api/chat/invite/${encodeURIComponent(token)}`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (data.ok) router.push("/dashboard/chat");
    else setError(data.error ?? "could not join");
  }

  return (
    <div className="rounded-lg border border-white/10 bg-bg-soft/40 p-6 font-mono">
      <div className="mb-4 text-sm text-accent">$ join invite</div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {!error && !preview && <p className="text-sm text-fg-dim">resolving link…</p>}

      {preview && (
        <>
          <div className="mb-1 flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/40 text-accent">
              {preview.kind === "channel" ? "📡" : "#"}
            </span>
            <div>
              <div className="text-base text-fg">{preview.name ?? preview.kind}</div>
              <div className="text-xs text-fg-dim">
                {preview.kind} · {preview.memberCount} members
              </div>
            </div>
          </div>

          <button
            onClick={join}
            disabled={busy}
            className="mt-5 w-full rounded bg-accent py-2 text-sm text-bg disabled:opacity-50"
          >
            {preview.alreadyMember ? "open chat" : preview.kind === "channel" ? "subscribe" : "join"}
          </button>
        </>
      )}
    </div>
  );
}
