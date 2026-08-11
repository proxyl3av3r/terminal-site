"use client";

import { useEffect, useState } from "react";

// Режим фона главной: дождь-матрица, космос, или их комбо. Хранится в
// localStorage (как тема), меняется командой `bg` из CLI, слушается через
// событие "bg-change".
export type BgMode = "rain" | "space";
export const BG_MODES: BgMode[] = ["rain", "space"];
export const DEFAULT_BG: BgMode = "rain";

export function readBgMode(): BgMode {
  if (typeof window === "undefined") return DEFAULT_BG;
  const v = localStorage.getItem("bg");
  return v === "rain" || v === "space" ? v : DEFAULT_BG;
}

export function useBgMode(): BgMode {
  const [mode, setMode] = useState<BgMode>(DEFAULT_BG);
  useEffect(() => {
    setMode(readBgMode());
    const on = () => setMode(readBgMode());
    window.addEventListener("bg-change", on);
    return () => window.removeEventListener("bg-change", on);
  }, []);
  return mode;
}
