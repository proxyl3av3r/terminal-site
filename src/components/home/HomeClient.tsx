"use client";

import { useEffect, useState } from "react";
import MatrixRain from "@/components/canvas/MatrixRain";
import HeroTypewriter from "@/components/home/HeroTypewriter";
import SecretTrigger from "@/components/home/SecretTrigger";
import TerminalConsole from "@/components/terminal/TerminalConsole";

// Тексты статуса по итогу верификации email (?verified=... из API).
const VERIFY_MSG: Record<string, { text: string; tone: string }> = {
  success: { text: "email подтверждён. теперь можно войти: access _", tone: "text-accent" },
  expired: { text: "ссылка истекла. зарегистрируйтесь заново.", tone: "text-danger" },
  invalid: { text: "ссылка недействительна.", tone: "text-danger" },
  ratelimited: { text: "слишком много попыток, подождите.", tone: "text-danger" },
};

export default function HomeClient({ verified }: { verified?: string }) {
  const [open, setOpen] = useState(false);
  const status = verified ? VERIFY_MSG[verified] : undefined;

  // Скрытая «горячая клавиша»: набрать `~` или нажать Ctrl+`  — тоже откроет вход.
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

      <main className="relative flex min-h-screen flex-col justify-center px-6 sm:px-12 lg:px-24">
        <div className="max-w-2xl">
          <p className="mb-4 text-xs uppercase tracking-[0.3em] text-fg-dim">
            yourname.dev
          </p>

          <HeroTypewriter
            className="text-2xl text-fg sm:text-3xl lg:text-4xl"
            lines={[
              "$ whoami",
              "> разработчик. строю системы.",
              "> добро пожаловать в терминал.",
            ]}
          />

          <p className="mt-8 max-w-md text-sm leading-relaxed text-fg-dim">
            Личное пространство в эстетике командной строки. Тихо, чисто,
            по делу. Где-то здесь спрятан вход.
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
