"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

// Терминальная «консоль входа». REPL: команды login / register / help / clear.
// Многошаговые сценарии (email → password → [2FA code]) ведёт стейт-машина flow.

type Tone = "out" | "in" | "ok" | "err" | "dim" | "accent";
interface Line {
  text: string;
  tone: Tone;
}

type Flow =
  | null
  | { cmd: "login"; step: "email" | "password" | "totp"; email?: string; password?: string }
  | { cmd: "register"; step: "email" | "password"; email?: string }
  | { cmd: "forgot"; step: "email" };

const toneClass: Record<Tone, string> = {
  out: "text-fg",
  in: "text-fg-dim",
  ok: "text-accent",
  err: "text-danger",
  dim: "text-fg-dim",
  accent: "text-accent-amber",
};

const BANNER: Line[] = [
  { text: "auth-console v1.0 — secure access", tone: "accent" },
  { text: "commands: login · register · forgot · help · clear · exit", tone: "dim" },
];

export default function TerminalConsole({
  onClose,
  initialCommand,
}: {
  onClose: () => void;
  initialCommand?: "login" | "register" | "forgot";
}) {
  const [lines, setLines] = useState<Line[]>(BANNER);
  const [flow, setFlow] = useState<Flow>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const masked = flow?.step === "password";
  const prompt =
    flow?.cmd === "login" && flow.step === "totp"
      ? "2fa-code>"
      : flow?.step === "email"
        ? "email>"
        : flow?.step === "password"
          ? "password>"
          : "$";

  const push = (text: string, tone: Tone = "out") =>
    setLines((l) => [...l, { text, tone }]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [busy, flow]);

  // Авто-запуск команды, если консоль открыта из публичного CLI (login/register…).
  const ranInitial = useRef(false);
  useEffect(() => {
    if (initialCommand && !ranInitial.current) {
      ranInitial.current = true;
      submit(initialCommand);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  // Esc — закрыть.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(raw: string) {
    const input = raw.trim();
    // Эхо ввода (пароль маскируем).
    push(`${prompt} ${masked ? "•".repeat(Math.min(input.length, 12)) : input}`, "in");
    setValue("");
    if (!input && !flow) return;

    if (flow) return advanceFlow(input);

    // Команды верхнего уровня
    switch (input.toLowerCase()) {
      case "help":
        push("login     — sign in");
        push("register  — create an account (email will be sent)");
        push("forgot    — reset a forgotten password");
        push("clear     — clear the console");
        push("exit      — close the console (Esc)");
        break;
      case "clear":
        setLines(BANNER);
        break;
      case "exit":
        onClose();
        break;
      case "login":
        setFlow({ cmd: "login", step: "email" });
        push("sign in. enter email:", "dim");
        break;
      case "register":
        setFlow({ cmd: "register", step: "email" });
        push("register. enter email:", "dim");
        break;
      case "forgot":
        setFlow({ cmd: "forgot", step: "email" });
        push("password reset. enter your account email:", "dim");
        break;
      default:
        push(`command not found: ${input}. type help`, "err");
    }
  }

  async function advanceFlow(input: string) {
    if (!flow) return;

    // ── СБРОС ПАРОЛЯ ─────────────────────────────────────────────
    if (flow.cmd === "forgot") {
      setBusy(true);
      try {
        const res = await fetch("/api/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: input }),
        });
        const data = await res.json();
        if (res.ok) {
          push(data.message ?? "if the account exists, a reset link was sent.", "ok");
          push("open the link from the email to set a new password", "dim");
        } else {
          push(data.error ?? "error", "err");
        }
      } catch {
        push("network unavailable, try again later", "err");
      } finally {
        setBusy(false);
        setFlow(null);
      }
      return;
    }

    // ── РЕГИСТРАЦИЯ ──────────────────────────────────────────────
    if (flow.cmd === "register") {
      if (flow.step === "email") {
        setFlow({ ...flow, step: "password", email: input });
        push("choose a password (min. 8 chars):", "dim");
        return;
      }
      // step password → request to API
      setBusy(true);
      try {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: flow.email, password: input }),
        });
        const data = await res.json();
        if (res.ok) {
          push(data.message ?? "email sent. check your inbox.", "ok");
          push("once confirmed, come back and type login", "dim");
        } else {
          push(data.error ?? "registration error", "err");
        }
      } catch {
        push("network unavailable, try again later", "err");
      } finally {
        setBusy(false);
        setFlow(null);
      }
      return;
    }

    // ── ВХОД ─────────────────────────────────────────────────────
    if (flow.cmd === "login") {
      if (flow.step === "email") {
        setFlow({ ...flow, step: "password", email: input });
        push("enter password:", "dim");
        return;
      }
      if (flow.step === "password") {
        // attemptLogin сам решит: успех → редирект, 2FA → переведёт flow в
        // step "totp" (сохранив email+password), ошибка → сбросит flow.
        await attemptLogin(flow.email!, input, undefined);
        return;
      }
      if (flow.step === "totp") {
        await attemptLogin(flow.email!, flow.password!, input);
        return;
      }
    }
  }

  async function attemptLogin(email: string, password: string, totp?: string) {
    setBusy(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        totp: totp ?? "",
        redirect: false,
      });
      const code = (res as { code?: string; error?: string } | undefined);
      const err = code?.code || code?.error || null;

      if (!err) {
        push("access granted. loading dashboard…", "ok");
        router.push("/dashboard");
        router.refresh();
        return;
      }
      if (err.includes("2fa_required")) {
        push("two-factor protection is enabled.", "accent");
        push("enter the 6-digit code from your app (or a backup code):", "dim");
        setFlow({ cmd: "login", step: "totp", email, password });
        return;
      }
      if (err.includes("invalid_2fa")) {
        push("invalid 2FA code, try again:", "err");
        return; // stay on the totp step
      }
      if (err.includes("email_not_verified")) {
        push("email not verified. check the link in your inbox.", "err");
        setFlow(null);
        return;
      }
      push("invalid email or password", "err");
      setFlow(null);
    } catch {
      push("network unavailable, try again later", "err");
      setFlow(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[min(92vw,640px)] overflow-hidden rounded-lg border border-white/10 bg-bg-soft/95 shadow-[0_0_60px_rgba(57,255,20,0.08)]">
        {/* шапка окна */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-danger/80" />
          <span className="h-3 w-3 rounded-full bg-accent-amber/80" />
          <span className="h-3 w-3 rounded-full bg-accent/80" />
          <span className="ml-2 text-xs text-fg-dim">~/auth — zsh</span>
          <button
            onClick={onClose}
            className="ml-auto text-xs text-fg-dim hover:text-fg"
            aria-label="закрыть"
          >
            [esc]
          </button>
        </div>

        {/* поток вывода */}
        <div ref={scrollRef} className="h-[44vh] overflow-y-auto px-4 py-3 text-sm">
          {lines.map((l, i) => (
            <div key={i} className={`whitespace-pre-wrap ${toneClass[l.tone]}`}>
              {l.text}
            </div>
          ))}
        </div>

        {/* строка ввода */}
        <form
          className="flex items-center gap-2 border-t border-white/10 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) submit(value);
          }}
        >
          <span className="select-none text-accent">{prompt}</span>
          <input
            ref={inputRef}
            type={masked ? "password" : "text"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
            autoComplete={masked ? "current-password" : "off"}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-fg caret-accent outline-none placeholder:text-fg-dim"
            placeholder={busy ? "…" : ""}
          />
        </form>
      </div>
    </div>
  );
}
