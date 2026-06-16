"use client";

import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────
// РЕДАКТИРУЙ ЗДЕСЬ: содержимое команд about/projects/skills/contact/social.
// ─────────────────────────────────────────────────────────────────────
const CONTENT = {
  about: [
    "someone who builds things and prefers the command line.",
    "this is a personal terminal — quiet, fast, intentionally sparse.",
    "type `skills` to see what I work with.",
  ],
  projects: [
    "terminal-site   — this very place (Next.js · Prisma · 2FA)",
    "…               — more, eventually.",
  ],
  skills: [
    "web      next.js · react · node · tailwind",
    "infra    docker · postgres · nginx · linux",
  ],
  // Приватность: личный email тут не показываем. Хочешь связь — заведи
  // отдельный публичный адрес (напр. hi@klebold.xyz) и впиши сюда.
  contact: [
    { text: "no public inbox yet. find me through `social`." },
  ],
  social: [
    { text: "github    github.com/proxyl3av3r", href: "https://github.com/proxyl3av3r" },
  ],
};

type Line = { text: string; tone?: string; href?: string };

const PROMPT = "guest@klebold.xyz:~$";

const BANNER: Line[] = [
  { text: "klebold.xyz — interactive shell", tone: "text-accent" },
  { text: "type `help` to list commands. try `neofetch`, `theme amber`, `matrix`.", tone: "text-fg-dim" },
];

const THEMES = ["green", "amber", "mono", "ice"];

const NEOFETCH = String.raw`
   _    _      _           _     _
  | | _| | ___| |__   ___ | | __| |
  | |/ / |/ _ \ '_ \ / _ \| |/ _\` |
  |   <| |  __/ |_) | (_) | | (_| |
  |_|\_\_|\___|_.__/ \___/|_|\__,_|
`;

export default function PublicCLI({
  onAuth,
}: {
  onAuth: (cmd: "login" | "register" | "forgot") => void;
}) {
  const [lines, setLines] = useState<Line[]>(BANNER);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const push = (text: string, tone?: string, href?: string) =>
    setLines((l) => [...l, { text, tone, href }]);
  const pushLines = (arr: Line[]) => setLines((l) => [...l, ...arr]);

  // Восстановить тему/звук из localStorage.
  useEffect(() => {
    const t = localStorage.getItem("theme");
    if (t && THEMES.includes(t)) document.documentElement.dataset.theme = t;
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  // Konami-код → matrix-boost + пасхалка.
  useEffect(() => {
    const seq = [
      "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
      "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a",
    ];
    let pos = 0;
    const onKey = (e: KeyboardEvent) => {
      pos = e.key === seq[pos] ? pos + 1 : 0;
      if (pos === seq.length) {
        pos = 0;
        window.dispatchEvent(new CustomEvent("matrix-boost"));
        push("↑↑↓↓←→←→ba — cheat activated. the matrix intensifies.", "text-accent-amber");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function clickSound() {
    if (localStorage.getItem("sound") !== "on") return;
    try {
      if (!audioRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        audioRef.current = new Ctor();
      }
      const ctx = audioRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 480 + Math.random() * 120;
      g.gain.setValueAtTime(0.04, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.03);
    } catch {
      /* no-op */
    }
  }

  function setTheme(name?: string) {
    if (!name) {
      push(`current: ${document.documentElement.dataset.theme ?? "green"}. options: ${THEMES.join(" · ")}`, "text-fg-dim");
      return;
    }
    if (!THEMES.includes(name)) {
      push(`unknown theme: ${name}. options: ${THEMES.join(" · ")}`, "text-danger");
      return;
    }
    document.documentElement.dataset.theme = name;
    localStorage.setItem("theme", name);
    window.dispatchEvent(new CustomEvent("theme-change"));
    push(`theme → ${name}`, "text-accent");
  }

  function setSound(arg?: string) {
    if (arg !== "on" && arg !== "off") {
      const cur = localStorage.getItem("sound") === "on" ? "on" : "off";
      push(`sound is ${cur}. usage: sound on | sound off`, "text-fg-dim");
      return;
    }
    localStorage.setItem("sound", arg);
    push(`keyboard sound → ${arg}`, "text-accent");
  }

  function run(raw: string) {
    const input = raw.trim();
    push(`${PROMPT} ${input}`, "text-fg-dim");
    if (input) setHistory((h) => [...h, input]);
    setHIdx(-1);
    if (!input) return;

    const [cmd, ...rest] = input.split(/\s+/);
    const arg = rest.join(" ");

    switch (cmd.toLowerCase()) {
      case "help":
        pushLines([
          { text: "about      — who I am" },
          { text: "projects   — what I've built" },
          { text: "skills     — the stack" },
          { text: "contact    — reach me" },
          { text: "social     — find me online" },
          { text: "neofetch   — system card" },
          { text: "theme      — green | amber | mono | ice" },
          { text: "sound      — on | off (keyboard clicks)" },
          { text: "matrix     — intensify the background" },
          { text: "login      — open the secure console" },
          { text: "clear      — clear the screen" },
        ]);
        break;
      case "about": pushLines(CONTENT.about.map((t) => ({ text: t }))); break;
      case "projects": pushLines(CONTENT.projects.map((t) => ({ text: t }))); break;
      case "skills": pushLines(CONTENT.skills.map((t) => ({ text: t }))); break;
      case "contact": pushLines(CONTENT.contact); break;
      case "social": pushLines(CONTENT.social); break;
      case "neofetch":
        push(NEOFETCH, "text-accent");
        pushLines([
          { text: "host      klebold.xyz" },
          { text: "os        terminal-os (web)" },
          { text: "shell     guest-sh 1.0" },
          { text: "theme     " + (document.documentElement.dataset.theme ?? "green") },
          { text: "uptime    since you opened this tab" },
          { text: "stack     next.js · prisma · postgres" },
        ]);
        break;
      case "theme": setTheme(arg || undefined); break;
      case "sound": setSound(arg || undefined); break;
      case "matrix":
        window.dispatchEvent(new CustomEvent("matrix-boost"));
        push("entering the matrix…", "text-accent");
        break;
      case "whoami": push("guest — just a visitor (for now)", "text-fg"); break;
      case "date": push(new Date().toString()); break;
      case "echo": push(arg); break;
      case "history":
        pushLines(history.map((h, i) => ({ text: `${i + 1}  ${h}`, tone: "text-fg-dim" })));
        break;
      case "banner": pushLines(BANNER); break;
      case "clear": setLines([]); break;
      case "login": onAuth("login"); push("opening secure console…", "text-fg-dim"); break;
      case "register": onAuth("register"); push("opening secure console…", "text-fg-dim"); break;
      case "forgot": onAuth("forgot"); push("opening secure console…", "text-fg-dim"); break;
      case "sudo":
        if (/rm\s+-rf\s+\//.test(arg)) {
          push("nice try. permission denied — and the universe thanks you.", "text-danger");
        } else {
          push("guest is not in the sudoers file. this incident will be reported. 😏", "text-danger");
        }
        break;
      case "exit": push("there's no escape. this is your terminal now.", "text-fg-dim"); break;
      default:
        push(`command not found: ${cmd}. type help`, "text-danger");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    clickSound();
    if (e.key === "Enter") {
      run(value);
      setValue("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const idx = hIdx < 0 ? history.length - 1 : Math.max(0, hIdx - 1);
      setHIdx(idx);
      setValue(history[idx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hIdx < 0) return;
      const idx = hIdx + 1;
      if (idx >= history.length) {
        setHIdx(-1);
        setValue("");
      } else {
        setHIdx(idx);
        setValue(history[idx]);
      }
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="mt-8 max-w-2xl cursor-text font-mono text-sm"
    >
      <div className="space-y-0.5">
        {lines.map((l, i) =>
          l.href ? (
            <a
              key={i}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block whitespace-pre-wrap text-accent underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {l.text}
            </a>
          ) : (
            <div key={i} className={`whitespace-pre-wrap ${l.tone ?? "text-fg"}`}>
              {l.text}
            </div>
          ),
        )}
      </div>

      <div className="mt-1 flex items-center gap-2">
        <span className="shrink-0 select-none text-accent">{PROMPT}</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="terminal input"
          className="flex-1 bg-transparent text-fg caret-accent outline-none"
        />
      </div>

      {/* быстрые команды-чипы — удобно тапать на мобиле, без печати */}
      <div className="mt-3 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
        {["about", "projects", "skills", "social", "neofetch", "login"].map((c) => (
          <button
            key={c}
            onClick={() => run(c)}
            className="rounded border border-white/10 bg-bg-soft/60 px-2.5 py-1 text-xs text-fg-dim transition-colors hover:border-accent/40 hover:text-accent"
          >
            {c}
          </button>
        ))}
      </div>
      <div ref={endRef} />
    </div>
  );
}
