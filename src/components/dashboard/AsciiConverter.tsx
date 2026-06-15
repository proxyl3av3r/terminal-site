"use client";

import { useRef, useState } from "react";

// Картинка → ASCII. Полностью клиентская обработка: файл читается в браузере
// через canvas, НА СЕРВЕР НЕ ОТПРАВЛЯЕТСЯ и нигде не хранится.
const RAMP = "@%#*+=-:. "; // тёмный → светлый

export default function AsciiConverter() {
  const [ascii, setAscii] = useState("");
  const [width, setWidth] = useState(100);
  const [invert, setInvert] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lastImg = useRef<HTMLImageElement | null>(null);

  function render(img: HTMLImageElement, cols: number, inv: boolean) {
    // Высота с поправкой на «вытянутость» моноширинного символа (~0.5).
    const rows = Math.max(1, Math.round((img.height / img.width) * cols * 0.5));
    const canvas = document.createElement("canvas");
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, cols, rows);
    const { data } = ctx.getImageData(0, 0, cols, rows);

    const ramp = inv ? [...RAMP].reverse().join("") : RAMP;
    let out = "";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        // яркость по luma + учёт альфа-канала (прозрачное = светлое)
        const a = data[i + 3] / 255;
        const lum =
          (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        const v = lum * a + (1 - a);
        const idx = Math.min(ramp.length - 1, Math.floor(v * (ramp.length - 1)));
        out += ramp[idx];
      }
      out += "\n";
    }
    setAscii(out);
  }

  function onFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      lastImg.current = img;
      render(img, width, invert);
      URL.revokeObjectURL(url); // освобождаем память сразу
    };
    img.src = url;
  }

  function reRender(nextWidth: number, nextInvert: boolean) {
    if (lastImg.current) render(lastImg.current, nextWidth, nextInvert);
  }

  async function copy() {
    await navigator.clipboard.writeText(ascii);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const blob = new Blob([ascii], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (fileName ?? "image").replace(/\.[^.]+$/, "") + ".txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-fg-dim">
        🔒 обработка идёт в браузере — изображение не загружается на сервер и
        нигде не сохраняется.
      </p>

      {/* зона загрузки */}
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-bg-soft/40 px-6 py-10 text-center transition-colors hover:border-accent/40"
      >
        <span className="font-mono text-sm text-fg">
          {fileName ?? "drop an image here, or click to choose"}
        </span>
        <span className="text-xs text-fg-dim">png · jpg · webp · gif</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </label>

      {/* контролы */}
      <div className="flex flex-wrap items-center gap-5">
        <label className="flex items-center gap-2 text-xs text-fg-dim">
          width
          <input
            type="range"
            min={40}
            max={200}
            step={10}
            value={width}
            onChange={(e) => {
              const w = Number(e.target.value);
              setWidth(w);
              reRender(w, invert);
            }}
            className="accent-accent"
          />
          <span className="w-8 font-mono text-fg">{width}</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-fg-dim">
          <input
            type="checkbox"
            checked={invert}
            onChange={(e) => {
              setInvert(e.target.checked);
              reRender(width, e.target.checked);
            }}
            className="accent-accent"
          />
          invert
        </label>
        {ascii && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={copy}
              className="rounded border border-white/15 px-3 py-1.5 font-mono text-xs text-fg-dim hover:text-fg"
            >
              {copied ? "copied ✓" : "copy"}
            </button>
            <button
              onClick={download}
              className="rounded border border-white/15 px-3 py-1.5 font-mono text-xs text-fg-dim hover:text-fg"
            >
              download .txt
            </button>
          </div>
        )}
      </div>

      {/* результат */}
      {ascii && (
        <div className="overflow-auto rounded-lg border border-white/10 bg-black/50 p-3">
          <pre className="font-mono text-accent" style={{ fontSize: "5px", lineHeight: "5px" }}>
            {ascii}
          </pre>
        </div>
      )}
    </div>
  );
}
