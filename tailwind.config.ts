import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // палитра homebrew-терминала
        bg: "#0a0a0a",
        "bg-soft": "#101010",
        fg: "#c8c8c8",
        "fg-dim": "#6a6a6a",
        accent: "rgb(var(--accent) / <alpha-value>)", // тема-зависимый акцент
        "accent-amber": "#ffb000", // янтарный (статичный)
        danger: "#ff3b30",
      },
      fontFamily: {
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "Berkeley Mono",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      animation: {
        blink: "blink 1s step-end infinite",
        flicker: "flicker 3s linear infinite",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        flicker: {
          "0%, 18%, 22%, 25%, 53%, 57%, 100%": { opacity: "1" },
          "20%, 24%, 55%": { opacity: "0.4" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
