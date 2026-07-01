"use client";

import { useEffect, useRef, useState } from "react";
import MatrixRain from "@/components/canvas/MatrixRain";
import HeroTypewriter from "@/components/home/HeroTypewriter";
import SecretTrigger from "@/components/home/SecretTrigger";
import PublicCLI from "@/components/home/PublicCLI";
import BootSequence from "@/components/home/BootSequence";
import TerminalConsole from "@/components/terminal/TerminalConsole";

// Status text after email verification (?verified=... from the API).
const VERIFY_MSG: Record<string, { text: string; tone: string }> = {
  success: { text: "email verified. you can sign in now: type login", tone: "text-accent" },
  expired: { text: "link expired. please register again.", tone: "text-danger" },
  invalid: { text: "invalid link.", tone: "text-danger" },
  ratelimited: { text: "too many attempts, please wait.", tone: "text-danger" },
};

type AuthCmd = "login" | "register" | "forgot";

export default function HomeClient({ verified }: { verified?: string }) {
  const [booting, setBooting] = useState(true);
  // Консоль открыта? + какой сценарий предзадан (undefined = меню: выбор команды).
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [authCmd, setAuthCmd] = useState<AuthCmd | undefined>(undefined);
  const openConsole = (cmd?: AuthCmd) => {
    setAuthCmd(cmd);
    setConsoleOpen(true);
  };
  const status = verified ? VERIFY_MSG[verified] : undefined;
  const heroRef = useRef<HTMLDivElement>(null);

  // Boot-анимация только при первом визите.
  useEffect(() => {
    if (localStorage.getItem("booted") === "1") setBooting(false);
  }, []);

  // Hidden hotkey: Ctrl/Cmd + ` opens the secure console.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "`" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        openConsole(); // меню — пусть выберет login/register/forgot
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Лёгкий параллакс-наклон контента за курсором (отключён при reduced-motion).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = heroRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rx = (e.clientY / window.innerHeight - 0.5) * -3;
      const ry = (e.clientX / window.innerWidth - 0.5) * 3;
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [booting]);

  if (booting) {
    return (
      <BootSequence
        onDone={() => {
          localStorage.setItem("booted", "1");
          setBooting(false);
        }}
      />
    );
  }

  return (
    <>
      <MatrixRain />

      <main className="relative z-10 flex min-h-screen flex-col justify-center px-6 py-16 sm:px-12 lg:px-24">
        <div ref={heroRef} className="max-w-2xl transition-transform duration-200 ease-out">
          <p className="mb-4 text-xs uppercase tracking-[0.3em] text-fg-dim">
            bash-app.com
          </p>

          <HeroTypewriter
            className="text-2xl text-fg sm:text-3xl lg:text-4xl"
            lines={[
              "$ whoami",
              "> developer. i build systems.",
              "> welcome to the terminal.",
            ]}
          />

          {status && (
            <p className={`mt-6 text-sm ${status.tone}`}>{status.text}</p>
          )}

          <PublicCLI onAuth={(cmd) => openConsole(cmd)} />
        </div>
      </main>

      <SecretTrigger onOpen={() => openConsole()} />

      {consoleOpen && (
        <TerminalConsole
          initialCommand={authCmd}
          onClose={() => setConsoleOpen(false)}
        />
      )}
    </>
  );
}
