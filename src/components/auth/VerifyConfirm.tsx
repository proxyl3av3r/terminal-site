"use client";

import { useEffect, useRef, useState } from "react";

type State = "working" | "success" | "expired" | "invalid" | "ratelimited" | "network";

const COPY: Record<Exclude<State, "working">, { text: string; tone: string }> = {
  success: { text: "email verified ✓ you can sign in now.", tone: "text-accent" },
  expired: { text: "link expired. register again to get a fresh one.", tone: "text-danger" },
  invalid: { text: "invalid or already-used link.", tone: "text-danger" },
  ratelimited: { text: "too many attempts. wait a bit and try again.", tone: "text-danger" },
  network: { text: "network hiccup. reload this page to retry.", tone: "text-accent-amber" },
};

export default function VerifyConfirm({ token, email }: { token: string; email: string }) {
  const [state, setState] = useState<State>("working");
  const ran = useRef(false); // защита от двойного запуска (StrictMode / повторный рендер)

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token || !email) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, email }),
        });
        const data = await res.json().catch(() => ({}));
        setState((data.status as State) ?? (res.ok ? "success" : "invalid"));
      } catch {
        setState("network");
      }
    })();
  }, [token, email]);

  return (
    <div className="rounded-lg border border-white/10 bg-bg-soft/50 p-6 font-mono">
      <div className="mb-4 text-sm text-accent">klebold.xyz :: auth</div>
      <div className="text-sm">
        <span className="text-accent">$</span> verify --email
      </div>

      <p className="mt-4 text-sm">
        {state === "working" ? (
          <span className="text-fg-dim">
            confirming<span className="animate-blink">_</span>
          </span>
        ) : (
          <span className={COPY[state].tone}>{COPY[state].text}</span>
        )}
      </p>

      {state === "success" && (
        <a
          href="/"
          className="mt-5 inline-block rounded bg-accent px-4 py-2 text-sm text-bg"
        >
          → open terminal &amp; sign in
        </a>
      )}
      {(state === "expired" || state === "invalid") && (
        <a href="/" className="mt-5 inline-block text-sm text-accent underline">
          ← back to terminal
        </a>
      )}
    </div>
  );
}
