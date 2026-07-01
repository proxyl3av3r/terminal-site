"use client";

import { useEffect, useState } from "react";

// Фейковая загрузка системы при первом визите (один раз — флаг в localStorage).
// Пропускается по клику/клавише и при prefers-reduced-motion.
const STEPS = [
  "booting bash-app.com …",
  "[  OK  ] mounting /dev/self",
  "[  OK  ] starting display manager",
  "[  OK  ] loading matrix renderer",
  "[  OK  ] initializing auth subsystem",
  "[  OK  ] establishing secure channel",
  "[  OK  ] welcome.",
];

export default function BootSequence({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState<string[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onDone();
      return;
    }

    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setShown(STEPS.slice(0, i + 1));
      i++;
      if (i < STEPS.length) {
        timer = setTimeout(tick, 230 + Math.random() * 160);
      } else {
        timer = setTimeout(onDone, 650);
      }
    };
    timer = setTimeout(tick, 200);

    const skip = () => onDone();
    window.addEventListener("keydown", skip);
    window.addEventListener("click", skip);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("click", skip);
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg">
      <div className="w-[min(92vw,520px)] font-mono text-sm">
        {shown.map((s, i) => (
          <div
            key={i}
            className={
              s.startsWith("[  OK  ]")
                ? "text-fg"
                : "mb-1 text-accent"
            }
          >
            {s.startsWith("[  OK  ]") ? (
              <>
                <span className="text-accent">[  OK  ]</span>
                {s.slice(8)}
              </>
            ) : (
              s
            )}
          </div>
        ))}
        <span className="animate-blink text-accent">_</span>
      </div>
    </div>
  );
}
