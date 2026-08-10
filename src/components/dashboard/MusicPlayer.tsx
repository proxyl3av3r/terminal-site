"use client";

import { useEffect, useRef, useState } from "react";

// Плавающий мини-плеер: интернет-радио + Audius. Смонтирован в layout дашборда,
// поэтому звук продолжается при переходах между разделами. Списки берём с
// нашего /api/music, сам поток <audio> тянет напрямую (CSP media-src https:).

type Track = { title: string; subtitle: string; stream: string };
type Tab = "radio" | "audius";

const GENRES = ["lofi", "synthwave", "chillhop", "jazz", "ambient", "chiptune", "phonk"];

export default function MusicPlayer() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("radio");
  const [items, setItems] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [vol, setVol] = useState(0.7);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = vol;
  }, [vol]);

  async function load(params: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/music?${params}`);
      const d = await res.json();
      setItems(d.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // первый список при открытии
  useEffect(() => {
    if (open && items.length === 0 && !loading) load("src=radio&tag=lofi");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function play(t: Track) {
    setCurrent(t);
    const a = audioRef.current;
    if (!a) return;
    a.src = t.stream;
    a.volume = vol;
    a.play().catch(() => setPlaying(false));
  }

  function toggle() {
    const a = audioRef.current;
    if (!a || !current) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (tab === "audius") load(`src=audius&q=${encodeURIComponent(q)}`);
    else load(`src=radio&q=${encodeURIComponent(q)}`);
  }

  return (
    <>
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="open music"
          className="fixed bottom-24 left-4 z-40 flex max-w-[60vw] items-center gap-2 rounded-lg border border-accent/40 bg-bg/90 px-3.5 py-2 font-mono text-sm text-fg shadow-lg backdrop-blur transition-colors hover:border-accent hover:text-accent md:bottom-6 md:left-6"
        >
          <span className={`text-accent ${playing ? "animate-pulse" : ""}`}>♪</span>
          <span className="truncate">{current && playing ? current.title : "music"}</span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 sm:items-end sm:justify-start sm:p-4 md:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-accent/30 bg-bg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <div className="flex gap-1 font-mono text-xs">
                {(["radio", "audius"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTab(t);
                      setItems([]);
                      if (t === "radio") load("src=radio&tag=lofi");
                    }}
                    className={`rounded px-2 py-1 ${tab === t ? "bg-accent text-bg" : "text-fg-dim hover:text-fg"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button onClick={() => setOpen(false)} className="px-2 font-mono text-fg-dim hover:text-danger" aria-label="close">
                ×
              </button>
            </header>

            {/* поиск / жанры */}
            <div className="space-y-2 border-b border-white/10 px-3 py-2">
              <form onSubmit={search} className="flex gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={tab === "audius" ? "search tracks…" : "search stations…"}
                  className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-sm text-fg outline-none focus:border-accent"
                />
                <button className="rounded bg-accent px-3 font-mono text-sm text-bg">go</button>
              </form>
              {tab === "radio" && (
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      onClick={() => load(`src=radio&tag=${g}`)}
                      className="rounded-full border border-white/10 px-2.5 py-0.5 font-mono text-[11px] text-fg-dim hover:border-accent hover:text-accent"
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* список */}
            <div className="flex-1 overflow-auto px-2 py-1.5">
              {loading && <p className="p-2 font-mono text-xs text-fg-dim">loading…</p>}
              {!loading && items.length === 0 && (
                <p className="p-2 font-mono text-xs text-fg-dim">
                  {tab === "audius" ? "search for a track above." : "nothing here — try another genre."}
                </p>
              )}
              {items.map((t, i) => {
                const active = current?.stream === t.stream;
                return (
                  <button
                    key={i}
                    onClick={() => play(t)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-sm ${
                      active ? "bg-accent/10 text-accent" : "text-fg hover:bg-white/5"
                    }`}
                  >
                    <span className="shrink-0 text-accent">{active && playing ? "▮▮" : "▶"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{t.title}</span>
                      <span className="block truncate text-[11px] text-fg-dim">{t.subtitle}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* now playing / контролы */}
            <footer className="flex items-center gap-3 border-t border-white/10 px-3 py-2">
              <button
                onClick={toggle}
                disabled={!current}
                className="rounded bg-accent px-3 py-1.5 font-mono text-sm text-bg disabled:opacity-40"
              >
                {playing ? "pause" : "play"}
              </button>
              <div className="min-w-0 flex-1 font-mono text-[11px] text-fg-dim">
                {current ? <span className="truncate">{current.title}</span> : "nothing playing"}
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={vol}
                onChange={(e) => setVol(Number(e.target.value))}
                aria-label="volume"
                className="w-20 accent-accent"
              />
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
