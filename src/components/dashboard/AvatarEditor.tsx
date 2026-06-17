"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/avatar/Avatar";
import {
  COLORS,
  BGS,
  EYES,
  MOUTHS,
  CAT_OPTIONS,
  isUnlocked,
  type AvatarConfig,
  type AvatarCat,
  type Option,
} from "@/lib/avatar";

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
      setMsg({ text: `need ${cost} pts to unlock (you have ${points})`, ok: false });
      return;
    }
    if (!confirm(`unlock this option for ${cost} pts?`)) return;
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
        setMsg({ text: "unlocked ✓", ok: true });
        router.refresh(); // обновить баланс в других местах (дашборд/шапка)
      } else {
        setMsg({ text: data.error ?? "could not unlock", ok: false });
      }
    } catch {
      setMsg({ text: "network unavailable", ok: false });
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
        setMsg({ text: "saved ✓", ok: true });
        router.refresh();
      } else {
        setMsg({ text: data.error ?? "error", ok: false });
      }
    } catch {
      setMsg({ text: "network unavailable", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      {/* превью */}
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-xl border border-white/10 bg-bg-soft/50 p-4">
          <Avatar config={cfg} size={140} />
        </div>
        <div className="font-mono text-xs text-fg-dim">
          balance: <span className="text-accent-amber">{points}</span> pts
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="w-full rounded bg-accent px-4 py-2 font-mono text-sm text-bg disabled:opacity-50"
        >
          {busy ? "…" : "> save avatar"}
        </button>
        {msg && (
          <p className={`text-center text-xs ${msg.ok ? "text-accent" : "text-danger"}`}>
            {msg.text}
          </p>
        )}
      </div>

      {/* опции */}
      <div className="flex-1 space-y-5">
        <Swatches label="color" cat="color" options={COLORS} active={cfg.color} unlocks={unlocks} points={points} onChoose={choose} />
        <Swatches label="background" cat="bg" options={BGS} active={cfg.bg} unlocks={unlocks} points={points} onChoose={choose} />
        <Picker label="eyes" cat="eyes" options={EYES} active={cfg.eyes} unlocks={unlocks} points={points} onChoose={choose} render={(i) => `eyes ${i + 1}`} />
        <Picker label="mouth" cat="mouth" options={MOUTHS} active={cfg.mouth} unlocks={unlocks} points={points} onChoose={choose} render={(i) => `mouth ${i + 1}`} />
      </div>
    </div>
  );
}

interface PickProps {
  label: string;
  cat: AvatarCat;
  options: Option[];
  active: number;
  unlocks: string[];
  points: number;
  onChoose: (cat: AvatarCat, i: number) => void;
}

function Swatches({ label, cat, options, active, unlocks, points, onChoose }: PickProps) {
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
              title={owned ? "" : `locked · ${o.cost} pts`}
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

function Picker({
  label,
  cat,
  options,
  active,
  unlocks,
  points,
  onChoose,
  render,
}: PickProps & { render: (i: number) => string }) {
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
              title={owned ? "" : `locked · ${o.cost} pts`}
              className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
                active === i
                  ? "border-accent text-accent"
                  : "border-white/15 text-fg-dim hover:text-fg"
              } ${owned ? "" : affordable ? "opacity-70" : "opacity-30"}`}
            >
              {owned ? render(i) : `🔒 ${o.cost}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
