"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/avatar/Avatar";
import {
  COLORS,
  BGS,
  CAT_OPTIONS,
  isUnlocked,
  type AvatarConfig,
  type AvatarCat,
  type Option,
} from "@/lib/avatar";

// Категории с превью-аватарками (показываем вариант на текущем конфиге).
const PREVIEW_CATS: { cat: AvatarCat; label: string }[] = [
  { cat: "head", label: "форма" },
  { cat: "eyes", label: "глаза" },
  { cat: "mouth", label: "рот" },
  { cat: "antenna", label: "антенна" },
  { cat: "effect", label: "эффект" },
];

export default function AvatarEditor({
  initial,
  points: initialPoints,
  unlocks: initialUnlocks,
}: {
  initial: AvatarConfig;
  points: number;
  unlocks: string[];
}) {
  const [cfg, setCfg] = useState<AvatarConfig>(initial);
  const [points, setPoints] = useState(initialPoints);
  const [unlocks, setUnlocks] = useState<string[]>(initialUnlocks);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const set = (k: AvatarCat, v: number) => setCfg((c) => ({ ...c, [k]: v }));

  // Клик по опции: разблокированную — выбираем; платную — пытаемся купить.
  async function choose(cat: AvatarCat, i: number) {
    setMsg(null);
    if (isUnlocked(cat, i, unlocks)) {
      set(cat, i);
      return;
    }
    const cost = CAT_OPTIONS[cat][i]?.cost ?? 0;
    if (points < cost) {
      setMsg({ text: `нужно ${cost} очк. для разблокировки (у тебя ${points})`, ok: false });
      return;
    }
    if (!confirm(`разблокировать за ${cost} очк.?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/avatar/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cat, index: i }),
      });
      const data = await res.json();
      if (data.ok) {
        setPoints(data.points);
        setUnlocks(data.unlocks);
        set(cat, i);
        setMsg({ text: "разблокировано ✓", ok: true });
        router.refresh();
      } else {
        setMsg({ text: data.error ?? "не удалось разблокировать", ok: false });
      }
    } catch {
      setMsg({ text: "сеть недоступна", ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: "сохранено ✓", ok: true });
        router.refresh();
      } else {
        setMsg({ text: data.error ?? "ошибка", ok: false });
      }
    } catch {
      setMsg({ text: "сеть недоступна", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      {/* превью */}
      <div className="flex flex-col items-center gap-3 sm:sticky sm:top-4 sm:self-start">
        <div className="rounded-xl border border-white/10 bg-bg-soft/50 p-4">
          <Avatar config={cfg} size={140} />
        </div>
        <div className="font-mono text-xs text-fg-dim">
          баланс: <span className="text-accent-amber">{points}</span> очк.
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="w-full rounded bg-accent px-4 py-2 font-mono text-sm text-bg disabled:opacity-50"
        >
          {busy ? "…" : "> сохранить аватар"}
        </button>
        {msg && (
          <p className={`text-center text-xs ${msg.ok ? "text-accent" : "text-danger"}`}>
            {msg.text}
          </p>
        )}
      </div>

      {/* опции */}
      <div className="flex-1 space-y-5">
        <Swatches label="цвет" cat="color" options={COLORS} active={cfg.color} unlocks={unlocks} points={points} onChoose={choose} />
        <Swatches label="фон" cat="bg" options={BGS} active={cfg.bg} unlocks={unlocks} points={points} onChoose={choose} />
        {PREVIEW_CATS.map(({ cat, label }) => (
          <PreviewRow
            key={cat}
            label={label}
            cat={cat}
            cfg={cfg}
            active={cfg[cat]}
            unlocks={unlocks}
            points={points}
            onChoose={choose}
          />
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  cat: AvatarCat;
  active: number;
  unlocks: string[];
  points: number;
  onChoose: (cat: AvatarCat, i: number) => void;
}

function Swatches({
  label,
  cat,
  options,
  active,
  unlocks,
  points,
  onChoose,
}: RowProps & { options: Option[] }) {
  return (
    <div>
      <div className="mb-2 text-xs text-fg-dim">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o, i) => {
          const owned = isUnlocked(cat, i, unlocks);
          const affordable = owned || points >= (o.cost ?? 0);
          return (
            <button
              key={i}
              onClick={() => onChoose(cat, i)}
              title={owned ? "" : `закрыто · ${o.cost} очк.`}
              className={`relative h-8 w-8 rounded-md border transition-transform ${
                active === i ? "scale-110 border-accent" : "border-white/15"
              } ${owned ? "" : affordable ? "opacity-70" : "opacity-30"}`}
              style={{ background: o.value }}
            >
              {!owned && (
                <span className="absolute inset-0 grid place-items-center text-[10px]">🔒</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Ряд опций с живым превью: каждый вариант рисуется на текущем конфиге.
function PreviewRow({ label, cat, cfg, active, unlocks, points, onChoose }: RowProps & { cfg: AvatarConfig }) {
  const options = CAT_OPTIONS[cat];
  return (
    <div>
      <div className="mb-2 text-xs text-fg-dim">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o, i) => {
          const owned = isUnlocked(cat, i, unlocks);
          const affordable = owned || points >= (o.cost ?? 0);
          return (
            <button
              key={i}
              onClick={() => onChoose(cat, i)}
              title={o.label ?? `${cat} ${i + 1}`}
              className={`relative flex flex-col items-center gap-1 rounded-lg border p-1 transition-colors ${
                active === i ? "border-accent bg-accent/10" : "border-white/15 hover:border-white/30"
              } ${owned ? "" : affordable ? "opacity-80" : "opacity-40"}`}
            >
              <span className="relative">
                <Avatar config={{ ...cfg, [cat]: i }} size={44} />
                {!owned && (
                  <span className="absolute inset-0 grid place-items-center rounded-md bg-black/55 text-xs">
                    🔒
                  </span>
                )}
              </span>
              <span className="font-mono text-[10px] text-fg-dim">
                {owned ? o.label ?? i + 1 : o.cost}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
