"use client";

import { useCallback, useRef, useState } from "react";

// Промис-подтверждение через внутристраничную модалку. Нужно потому, что
// нативный window.confirm() — no-op в in-app/webview браузерах (Telegram и т.п.),
// из-за чего действия «молча» не срабатывали.
//
// Использование:
//   const { confirm, dialog } = useConfirm();
//   if (!(await confirm("delete this?", { danger: true }))) return;
//   ...
//   return (<>{dialog} ...</>);
export function useConfirm() {
  const [state, setState] = useState<{
    message: string;
    confirmLabel: string;
    danger: boolean;
  } | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (message: string, opts?: { danger?: boolean; confirmLabel?: string }) => {
      setState({
        message,
        danger: opts?.danger ?? false,
        confirmLabel: opts?.confirmLabel ?? "ok",
      });
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
      });
    },
    [],
  );

  const close = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setState(null);
  }, []);

  const dialog = state ? (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && close(false)}
    >
      <div className="w-[min(92vw,360px)] rounded-lg border border-white/10 bg-bg-soft p-5">
        <p className="font-mono text-sm text-fg">{state.message}</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => close(false)}
            className="flex-1 rounded border border-white/15 py-2 font-mono text-xs text-fg-dim hover:text-fg"
          >
            cancel
          </button>
          <button
            onClick={() => close(true)}
            className={`flex-1 rounded py-2 font-mono text-xs ${
              state.danger
                ? "border border-danger/50 bg-danger/10 text-danger"
                : "bg-accent text-bg"
            }`}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
