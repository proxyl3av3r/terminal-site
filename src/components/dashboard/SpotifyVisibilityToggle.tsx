"use client";

import { useState } from "react";

// Тумблер: показывать ли «now playing» из Spotify на публичном профиле.
export default function SpotifyVisibilityToggle({
  initialEnabled,
  connected,
}: {
  initialEnabled: boolean;
  connected: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !enabled;
    setEnabled(next); // оптимистично
    setBusy(true);
    try {
      const res = await fetch("/api/profile/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicSpotify: next }),
      });
      if (!res.ok) setEnabled(!next); // откат
    } catch {
      setEnabled(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-mono text-sm text-fg">now playing on profile</div>
        <p className="mt-0.5 text-xs text-fg-dim">
          {connected
            ? "show your current Spotify track on your public /u/ page"
            : "connect Spotify on the dashboard first"}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={busy || !connected}
        role="switch"
        aria-checked={enabled}
        aria-label="toggle now playing on public profile"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
          enabled ? "bg-accent" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg transition-transform ${
            enabled ? "translate-x-[1.375rem]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
