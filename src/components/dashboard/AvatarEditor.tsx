"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/avatar/Avatar";
import {
  COLORS,
  BGS,
  EYES,
  MOUTHS,
  type AvatarConfig,
  type Option,
} from "@/lib/avatar";

export default function AvatarEditor({ initial }: { initial: AvatarConfig }) {
  const [cfg, setCfg] = useState<AvatarConfig>(initial);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const set = (k: keyof AvatarConfig, v: number) =>
    setCfg((c) => ({ ...c, [k]: v }));

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
        <button
          onClick={save}
          disabled={busy}
          className="w-full rounded bg-accent px-4 py-2 font-mono text-sm text-bg disabled:opacity-50"
        >
          {busy ? "…" : "> save avatar"}
        </button>
        {msg && (
          <p className={`text-xs ${msg.ok ? "text-accent" : "text-danger"}`}>
            {msg.text}
          </p>
        )}
      </div>

      {/* опции */}
      <div className="flex-1 space-y-5">
        <Swatches label="color" options={COLORS} active={cfg.color} onPick={(i) => set("color", i)} />
        <Swatches label="background" options={BGS} active={cfg.bg} onPick={(i) => set("bg", i)} />
        <Picker label="eyes" options={EYES} active={cfg.eyes} onPick={(i) => set("eyes", i)} render={(i) => `eyes ${i + 1}`} />
        <Picker label="mouth" options={MOUTHS} active={cfg.mouth} onPick={(i) => set("mouth", i)} render={(i) => `mouth ${i + 1}`} />
      </div>
    </div>
  );
}

function Swatches({
  label,
  options,
  active,
  onPick,
}: {
  label: string;
  options: Option[];
  active: number;
  onPick: (i: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-xs text-fg-dim">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o, i) => (
          <button
            key={i}
            disabled={!o.free}
            onClick={() => onPick(i)}
            title={o.free ? "" : `locked · ${o.cost} pts`}
            className={`relative h-8 w-8 rounded-md border transition-transform ${
              active === i ? "border-accent scale-110" : "border-white/15"
            } ${o.free ? "" : "opacity-40"}`}
            style={{ background: o.value }}
          >
            {!o.free && <span className="absolute inset-0 grid place-items-center text-[10px]">🔒</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Picker({
  label,
  options,
  active,
  onPick,
  render,
}: {
  label: string;
  options: Option[];
  active: number;
  onPick: (i: number) => void;
  render: (i: number) => string;
}) {
  return (
    <div>
      <div className="mb-2 text-xs text-fg-dim">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o, i) => (
          <button
            key={i}
            disabled={!o.free}
            onClick={() => onPick(i)}
            title={o.free ? "" : `locked · ${o.cost} pts`}
            className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
              active === i
                ? "border-accent text-accent"
                : "border-white/15 text-fg-dim hover:text-fg"
            } ${o.free ? "" : "opacity-40"}`}
          >
            {o.free ? render(i) : `🔒 ${o.cost}`}
          </button>
        ))}
      </div>
    </div>
  );
}
