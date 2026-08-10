"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { hackerHistoryFor } from "@/lib/hackerHistory";

// Внутренний («после входа») терминал-хаб: управление профилем, навигация по
// разделам и бесплатные API-фишки. Команды login/register сюда НЕ входят —
// они не актуальны после входа.

type Line = { text: string; tone?: string };

const THEMES = ["green", "amber", "mono", "ice"];
const NAV: Record<string, string> = {
  home: "/dashboard",
  chat: "/dashboard/chat",
  game: "/dashboard/game",
  avatar: "/dashboard/avatar",
  ascii: "/dashboard/ascii",
  settings: "/dashboard/settings",
};
const FORTUNES = [
  "There are two hard things in CS: cache invalidation, naming things, and off-by-one errors.",
  "It's not a bug — it's an undocumented feature.",
  "Weeks of coding can save you hours of planning.",
  "The best backup is the one you tested restoring.",
  "A password on a sticky note is still two-factor: something you have, something everyone sees.",
  "Rubber duck says: read the error message. All of it.",
  "'It works on my machine' — ship the machine, then.",
  "Security is like an onion: layers, and it makes people cry.",
];
const TOOL_CMDS = ["joke", "advice", "weather", "iss", "define", "whereami"];

export default function DashTerminal({
  username,
  shortId,
  points,
}: {
  username: string | null;
  shortId: string | null;
  points: number;
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const hist = useRef<string[]>([]);
  const histIdx = useRef(-1);
  const bannered = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const prompt = `${username ?? "user"}@bash-app:~$`;

  const push = (text: string, tone?: string) => setLines((l) => [...l, { text, tone }]);
  const pushMany = (arr: Line[]) => setLines((l) => [...l, ...arr]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines, open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      if (!bannered.current) {
        bannered.current = true;
        pushMany([
          { text: "bash-app.com :: authenticated shell", tone: "text-accent" },
          {
            text: `logged in as ${username ? "@" + username : "(no username yet)"}${shortId ? " · #" + shortId : ""}`,
            tone: "text-fg-dim",
          },
          { text: "type `help` for commands.", tone: "text-fg-dim" },
        ]);
      }
    }
  }, [open, username, shortId]);

  async function tool(cmd: string, arg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tools?cmd=${cmd}&arg=${encodeURIComponent(arg)}`);
      const data = await res.json();
      push(data.text ?? "…", data.ok ? "text-fg" : "text-danger");
    } catch {
      push("network unavailable", "text-danger");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function navTo(key: string) {
    const href = NAV[key];
    if (!href) {
      push(`unknown section: ${key}. try: ${Object.keys(NAV).join(" · ")}`, "text-danger");
      return;
    }
    push(`→ opening ${key}`, "text-accent");
    setOpen(false);
    router.push(href);
  }

  function help() {
    pushMany([
      { text: "commands:", tone: "text-accent" },
      { text: "  profile   open your public profile", tone: "text-fg-dim" },
      { text: "  avatar · settings · chat · game · ascii · home   — jump to section", tone: "text-fg-dim" },
      { text: "  open <section>   same, explicit", tone: "text-fg-dim" },
      { text: "  claim     grab your daily points", tone: "text-fg-dim" },
      { text: "  theme [green|amber|mono|ice]", tone: "text-fg-dim" },
      { text: "  today · history   this day in hacker history", tone: "text-fg-dim" },
      { text: "  weather [city] · whereami · iss   the world around you", tone: "text-fg-dim" },
      { text: "  joke · advice · fortune · define <word>", tone: "text-fg-dim" },
      { text: "  whoami · clear · logout", tone: "text-fg-dim" },
    ]);
  }

  async function run(raw: string) {
    const line = raw.trim();
    push(`${prompt} ${line}`, "text-fg");
    if (!line) return;
    hist.current.unshift(line);
    histIdx.current = -1;
    const [cmdRaw, ...rest] = line.split(/\s+/);
    const cmd = cmdRaw.toLowerCase();
    const arg = rest.join(" ");

    if (cmd === "help" || cmd === "?") return help();
    if (cmd === "clear" || cmd === "cls") return setLines([]);
    if (cmd === "whoami")
      return push(
        `${username ? "@" + username : "(no username)"}${shortId ? " · #" + shortId : ""} · ${points} pts`,
        "text-accent",
      );
    if (cmd === "logout" || cmd === "exit") {
      push("signing out…", "text-fg-dim");
      return void signOut({ redirectTo: "/" });
    }
    if (cmd === "profile") {
      if (!username) return push("set a username first: `settings`", "text-accent-amber");
      push(`→ @${username}`, "text-accent");
      setOpen(false);
      return router.push(`/u/${username}`);
    }
    if (cmd === "open") return navTo(arg.toLowerCase());
    if (NAV[cmd]) return navTo(cmd);

    if (cmd === "theme") {
      if (!arg) return push(`current: ${document.documentElement.dataset.theme ?? "green"} · options: ${THEMES.join(" · ")}`, "text-fg-dim");
      if (!THEMES.includes(arg)) return push(`unknown theme: ${arg}`, "text-danger");
      document.documentElement.dataset.theme = arg;
      localStorage.setItem("theme", arg);
      window.dispatchEvent(new CustomEvent("theme-change"));
      return push(`theme → ${arg}`, "text-accent");
    }

    if (cmd === "claim") {
      setBusy(true);
      try {
        const res = await fetch("/api/claim", { method: "POST" });
        const d = await res.json();
        if (d.ok) push(`+${d.reward} pts · streak ${d.streak} · total ${d.points}`, "text-accent");
        else push(d.error ?? "already claimed today", "text-accent-amber");
      } catch {
        push("network unavailable", "text-danger");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (cmd === "today" || cmd === "history") {
      const { onThisDay, events } = hackerHistoryFor();
      push(onThisDay ? "this day in hacker history:" : "nothing logged today — from the archives:", "text-accent");
      events.forEach((e) => push(`  ${e.year} — ${e.text}`, "text-fg-dim"));
      return;
    }

    if (cmd === "fortune") return push(FORTUNES[Math.floor(Math.random() * FORTUNES.length)], "text-fg");

    if (TOOL_CMDS.includes(cmd)) return void tool(cmd, arg);

    push(`command not found: ${cmd}. type \`help\`.`, "text-danger");
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (hist.current.length) {
        histIdx.current = Math.min(histIdx.current + 1, hist.current.length - 1);
        setInput(hist.current[histIdx.current]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      histIdx.current = Math.max(histIdx.current - 1, -1);
      setInput(histIdx.current < 0 ? "" : hist.current[histIdx.current]);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const v = input;
    setInput("");
    void run(v);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="open terminal"
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-lg border border-accent/40 bg-bg/90 px-3.5 py-2 font-mono text-sm text-fg shadow-lg backdrop-blur transition-colors hover:border-accent hover:text-accent md:bottom-6 md:right-6"
        >
          <span className="text-accent">▸_</span> terminal
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 sm:items-end sm:justify-end sm:p-4 md:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[75vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-accent/30 bg-bg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <span className="font-mono text-xs text-fg-dim">
                <span className="text-accent">●</span> {prompt}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="rounded px-2 font-mono text-fg-dim hover:text-danger"
                aria-label="close"
              >
                ×
              </button>
            </header>

            <div ref={bodyRef} className="flex-1 space-y-0.5 overflow-auto px-3 py-2 font-mono text-[13px] leading-relaxed">
              {lines.map((l, k) => (
                <div key={k} className={`whitespace-pre-wrap break-words ${l.tone ?? "text-fg"}`}>
                  {l.text}
                </div>
              ))}
              {busy && <div className="text-fg-dim">…</div>}
            </div>

            <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
              <span className="shrink-0 font-mono text-sm text-accent">{prompt}</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={busy}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                className="min-w-0 flex-1 bg-transparent font-mono text-sm text-fg outline-none placeholder:text-fg-dim disabled:opacity-50"
                placeholder={busy ? "…" : "type a command…"}
              />
            </form>
          </div>
        </div>
      )}
    </>
  );
}
