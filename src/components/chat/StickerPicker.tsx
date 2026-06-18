"use client";

import { useEffect, useRef } from "react";
import { STICKERS } from "@/lib/stickers";

// Поповер с набором готовых ASCII-стикеров. Клик → отправка как ascii-сообщение.
export default function StickerPicker({
  onPick,
  onClose,
}: {
  onPick: (art: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне поповера и по Esc.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-2 z-30 mb-2 w-[min(88vw,320px)] rounded-lg border border-white/10 bg-bg-soft p-2 shadow-xl"
    >
      <div className="mb-1.5 px-1 font-mono text-[11px] text-fg-dim">$ stickers</div>
      <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto">
        {STICKERS.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => {
              onPick(s.art);
              onClose();
            }}
            title={s.name}
            className="grid h-16 place-items-center rounded border border-white/10 bg-black/30 hover:border-accent/50 hover:bg-accent/10"
          >
            <pre className="pointer-events-none select-none font-mono text-accent" style={{ fontSize: "9px", lineHeight: "10px" }}>
              {s.art}
            </pre>
          </button>
        ))}
      </div>
    </div>
  );
}
