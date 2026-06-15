"use client";

import { useState } from "react";

// UI включения/отключения 2FA. Шаги:
//   disabled → [setup] → показ QR+ключа → ввод кода → [confirm] → backup-коды
//   enabled  → перевыпуск backup-кодов / отключение по коду
type Stage = "idle" | "setup" | "enabled";

export default function TwoFactorSetup({ initialEnabled }: { initialEnabled: boolean }) {
  const [stage, setStage] = useState<Stage>(initialEnabled ? "enabled" : "idle");
  const [qr, setQr] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState<string>("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(url: string, body?: object) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ошибка");
        return null;
      }
      return data;
    } catch {
      setError("сеть недоступна");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function startSetup() {
    const data = await post("/api/2fa/setup");
    if (data) {
      setQr(data.qr);
      setManualKey(data.manualKey);
      setStage("setup");
    }
  }

  async function confirm() {
    const data = await post("/api/2fa/confirm", { code });
    if (data) {
      setBackupCodes(data.backupCodes);
      setCode("");
      setStage("enabled");
    }
  }

  async function regenerate() {
    const data = await post("/api/backup-codes");
    if (data) setBackupCodes(data.backupCodes);
  }

  async function disable() {
    const data = await post("/api/2fa/disable", { code });
    if (data) {
      setStage("idle");
      setQr(null);
      setManualKey("");
      setBackupCodes(null);
      setCode("");
    }
  }

  return (
    <section className="rounded-lg border border-white/10 bg-bg-soft/50 p-5">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-mono text-sm text-fg">two-factor auth</h2>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
            stage === "enabled" ? "bg-accent/15 text-accent" : "bg-white/5 text-fg-dim"
          }`}
        >
          {stage === "enabled" ? "on" : "off"}
        </span>
      </div>
      <p className="mb-4 text-xs text-fg-dim">
        TOTP-коды совместимы с Google Authenticator и Bitwarden.
      </p>

      {error && <p className="mb-3 text-xs text-danger">⚠ {error}</p>}

      {/* ── ВЫКЛЮЧЕНО ── */}
      {stage === "idle" && (
        <button
          onClick={startSetup}
          disabled={busy}
          className="rounded bg-accent px-4 py-2 font-mono text-sm text-bg disabled:opacity-50"
        >
          &gt; включить 2FA
        </button>
      )}

      {/* ── НАСТРОЙКА: QR + ключ + код ── */}
      {stage === "setup" && (
        <div className="space-y-4">
          <p className="text-xs text-fg-dim">
            1. отсканируйте QR или внесите ключ вручную:
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {qr && (
              <img
                src={qr}
                alt="QR-код 2FA"
                className="h-40 w-40 rounded border border-white/10"
              />
            )}
            <div className="space-y-2">
              <p className="text-xs text-fg-dim">ключ для ручного ввода:</p>
              <code className="block break-all rounded bg-black/40 p-2 font-mono text-xs text-accent-amber">
                {manualKey}
              </code>
            </div>
          </div>

          <p className="text-xs text-fg-dim">2. введите код из приложения:</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              className="w-32 rounded border border-white/10 bg-black/40 px-3 py-2 font-mono tracking-widest text-fg outline-none focus:border-accent"
            />
            <button
              onClick={confirm}
              disabled={busy || code.length < 6}
              className="rounded bg-accent px-4 py-2 font-mono text-sm text-bg disabled:opacity-50"
            >
              подтвердить
            </button>
          </div>
        </div>
      )}

      {/* ── ВКЛЮЧЕНО: backup-коды + управление ── */}
      {stage === "enabled" && (
        <div className="space-y-4">
          <p className="text-xs text-accent">✓ двухфакторная защита активна</p>

          {backupCodes && (
            <div className="rounded border border-accent-amber/30 bg-black/40 p-3">
              <p className="mb-2 text-xs text-accent-amber">
                сохраните backup-коды — показываются один раз, каждый одноразовый:
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm text-fg">
                {backupCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={regenerate}
              disabled={busy}
              className="rounded border border-white/15 px-3 py-1.5 font-mono text-xs text-fg-dim hover:text-fg disabled:opacity-50"
            >
              перевыпустить backup-коды
            </button>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="mb-2 text-xs text-fg-dim">
              отключить 2FA (требуется текущий код):
            </p>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                className="w-32 rounded border border-white/10 bg-black/40 px-3 py-2 font-mono tracking-widest text-fg outline-none focus:border-danger"
              />
              <button
                onClick={disable}
                disabled={busy || code.length < 6}
                className="rounded border border-danger/40 px-4 py-2 font-mono text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
              >
                отключить
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
