"use client";

// Скрытый, но находимый вход. По умолчанию — тусклый мигающий курсор `_`.
// При наведении мягко подсвечивается и показывает namёк-подсказку.

export default function SecretTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-label="открыть консоль входа"
      className="group fixed bottom-5 right-6 z-30 font-mono text-sm text-fg-dim/40 transition-colors hover:text-accent focus:text-accent focus:outline-none"
    >
      <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus:opacity-100">
        access&nbsp;
      </span>
      <span className="animate-blink">_</span>
    </button>
  );
}
