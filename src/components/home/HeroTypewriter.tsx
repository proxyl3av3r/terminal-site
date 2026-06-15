"use client";

import { useEffect, useState } from "react";

// Печатает поочерёдно строки, как ввод в терминал. Мигающий курсор — всегда.
// При prefers-reduced-motion показывает финальный текст сразу.

interface Props {
  lines: string[];
  className?: string;
}

export default function HeroTypewriter({ lines, className }: Props) {
  const full = lines.join("\n");
  const [shown, setShown] = useState("");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(full);
      return;
    }

    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i++;
      setShown(full.slice(0, i));
      if (i < full.length) {
        // случайный джиттер — печать «живая», паузы на переносах строк
        const ch = full[i - 1];
        const delay = ch === "\n" ? 320 : 28 + Math.random() * 55;
        timer = setTimeout(tick, delay);
      }
    };
    timer = setTimeout(tick, 450);
    return () => clearTimeout(timer);
  }, [full]);

  return (
    <pre
      className={`whitespace-pre-wrap font-mono leading-relaxed ${className ?? ""}`}
    >
      {shown}
      <span className="ml-0.5 inline-block w-[0.6ch] animate-blink bg-accent align-baseline text-transparent">
        _
      </span>
    </pre>
  );
}
