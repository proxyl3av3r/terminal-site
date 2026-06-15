"use client";

import { useEffect, useState } from "react";
import MatrixRain from "@/components/canvas/MatrixRain";
import HeroTypewriter from "@/components/home/HeroTypewriter";
import SecretTrigger from "@/components/home/SecretTrigger";
import TerminalConsole from "@/components/terminal/TerminalConsole";

// Status text after email verification (?verified=... from the API).
const VERIFY_MSG: Record<string, { text: string; tone: string }> = {
  success: { text: "email verified. you can sign in now: access _", tone: "text-accent" },
  expired: { text: "link expired. please register again.", tone: "text-danger" },
  invalid: { text: "invalid link.", tone: "text-danger" },
  ratelimited: { text: "too many attempts, please wait.", tone: "text-danger" },
};

export default function HomeClient({ verified }: { verified?: string }) {
  const [open, setOpen] = useState(false);
  const status = verified ? VERIFY_MSG[verified] : undefined;

  // Hidden hotkey: Ctrl/Cmd + ` also opens the console.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "`" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <MatrixRain />

      <main className="relative z-10 flex min-h-screen flex-col justify-center px-6 sm:px-12 lg:px-24">
        <div className="max-w-2xl">
          <p className="mb-4 text-xs uppercase tracking-[0.3em] text-fg-dim">
            klebold.xyz
          </p>

          <HeroTypewriter
            className="text-2xl text-fg sm:text-3xl lg:text-4xl"
            lines={[
              "$ whoami",
              "> developer. i build systems.",
              "> welcome to the terminal.",
            ]}
          />

          <p className="mt-8 max-w-md text-sm leading-relaxed text-fg-dim">
            A personal space in command-line aesthetics. Quiet, clean, to the
            point. The entrance is hidden somewhere here.
          </p>

          {status && (
            <p className={`mt-6 text-sm ${status.tone}`}>{status.text}</p>
          )}
        </div>
      </main>

      <SecretTrigger onOpen={() => setOpen(true)} />

      {open && <TerminalConsole onClose={() => setOpen(false)} />}
    </>
  );
}
