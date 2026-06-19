"use client";

import { useState } from "react";

// Заметная кнопка «копировать ссылку» на публичном профиле. Профиль публичный —
// поэтому кнопка должна бросаться в глаза. Fallback: если clipboard недоступен
// (http/старый webview) — выделяем ссылку текстом, чтобы скопировать вручную.
export default function ProfileShareButton({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/u/${username}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard заблокирован — покажем ссылку для ручного копирования
      setShown(true);
    }
  }

  return (
    <div className="mt-5">
      <button
        onClick={copy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 font-mono text-sm text-bg transition-opacity hover:opacity-90"
      >
        {copied ? "link copied ✓" : "🔗 copy profile link"}
      </button>
      {shown && (
        <p
          className="mt-2 select-all break-all rounded border border-white/10 bg-black/40 px-3 py-2 text-center font-mono text-xs text-accent"
          onClick={(e) => {
            const r = document.createRange();
            r.selectNodeContents(e.currentTarget);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(r);
          }}
        >
          {`https://klebold.xyz/u/${username}`}
        </p>
      )}
    </div>
  );
}
