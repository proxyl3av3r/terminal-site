"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QRPanel({ url }: { url: string | null }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url) {
      setQr(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#39ff14", light: "#0a0a0a" } })
      .then((d) => !cancelled && setQr(d))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [url]);

  const copy = () => {
    if (!url) return;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-white/10 bg-bg-soft/70 p-4">
      <div className="flex h-[220px] w-[220px] items-center justify-center rounded bg-bg">
        {qr ? (
          // data: URL — не требует next/image
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR-код комнаты" width={220} height={220} />
        ) : (
          <span className="text-xs text-fg-dim">генерирую QR…</span>
        )}
      </div>
      <button
        onClick={copy}
        disabled={!url}
        className="w-full rounded border border-white/10 bg-bg py-1.5 font-mono text-xs text-fg-dim hover:text-accent disabled:opacity-40"
      >
        {copied ? "скопировано ✓" : url ? url.replace(/^https?:\/\//, "") : "…"}
      </button>
      <p className="text-center text-xs text-fg-dim">
        отсканируй телефоном — откроется приём в этой же комнате
      </p>
    </div>
  );
}
