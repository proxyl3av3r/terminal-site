"use client";

import Avatar from "@/components/avatar/Avatar";
import { parseAvatar } from "@/lib/avatar";

export interface FinalePlayer {
  id: string;
  username: string;
  avatar: string | null;
  score: number;
  awarded: number;
}

// Экран финала: подиум топ-3, полная таблица результатов и «трибуна» —
// все участники как зрители на стойке, в эстетике сайта.
export default function GameFinale({
  players,
  meId,
  isHost,
  totalRounds,
  onSetRounds,
  onRestart,
  onShare,
  copied,
}: {
  players: FinalePlayer[];
  meId: string;
  isHost: boolean;
  totalRounds: number;
  onSetRounds: (r: number) => void;
  onRestart: () => void;
  onShare: () => void;
  copied: boolean;
}) {
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const top3 = ranked.slice(0, 3);
  // Порядок пьедестала: 2-е слева, 1-е по центру, 3-е справа.
  const podium = [top3[1], top3[0], top3[2]].filter(Boolean) as FinalePlayer[];
  const pedestalH = (rank: number) => (rank === 1 ? "h-20" : rank === 2 ? "h-14" : "h-10");
  const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉");

  return (
    <div className="rounded-xl border border-white/10 bg-bg-soft/50 p-5 sm:p-7">
      <div className="text-center font-mono">
        <div className="text-lg text-accent">🏆 игра окончена</div>
        {ranked[0] && (
          <div className="mt-0.5 text-xs text-fg-dim">
            победитель — <span className="text-fg">{ranked[0].username}</span>
          </div>
        )}
      </div>

      {/* ── подиум ── */}
      <div className="mt-6 flex items-end justify-center gap-3 sm:gap-5">
        {podium.map((p) => {
          const rank = ranked.indexOf(p) + 1;
          return (
            <div key={p.id} className="flex w-20 flex-col items-center sm:w-24">
              <div className="mb-1 text-xl">{medal(rank)}</div>
              <div className="relative">
                <Avatar config={parseAvatar(p.avatar, p.username)} size={rank === 1 ? 64 : 52} />
              </div>
              <div className="mt-1 max-w-full truncate font-mono text-xs text-fg">{p.username}</div>
              <div className="font-mono text-[11px] text-accent-amber">{p.score} очк.</div>
              {p.awarded > 0 && (
                <div className="font-mono text-[10px] text-accent">+{p.awarded} pts</div>
              )}
              <div
                className={`mt-1 grid w-full place-items-center rounded-t border border-b-0 border-white/15 bg-gradient-to-b from-accent/15 to-transparent font-mono text-sm text-fg-dim ${pedestalH(rank)}`}
              >
                {rank}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── полная таблица результатов ── */}
      <div className="mx-auto mt-6 max-w-md overflow-hidden rounded-lg border border-white/10">
        <div className="border-b border-white/10 bg-black/30 px-3 py-1.5 font-mono text-[11px] text-fg-dim">
          $ итоги
        </div>
        {ranked.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 border-b border-white/5 px-3 py-1.5 last:border-0 ${p.id === meId ? "bg-accent/5" : ""}`}
          >
            <span className="w-5 text-right font-mono text-xs text-fg-dim">{i + 1}</span>
            <Avatar config={parseAvatar(p.avatar, p.username)} size={22} />
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg">
              {p.username}
              {p.id === meId && " (ты)"}
            </span>
            {p.awarded > 0 && (
              <span className="font-mono text-[11px] text-accent">+{p.awarded}</span>
            )}
            <span className="w-12 text-right font-mono text-xs text-accent-amber">{p.score}</span>
          </div>
        ))}
      </div>

      {/* ── «трибуна»: все участники как зрители ── */}
      <div className="mt-6">
        <div className="mb-1 text-center font-mono text-[11px] text-fg-dim">трибуна</div>
        <div className="flex flex-wrap items-end justify-center gap-x-4 gap-y-2 rounded-lg border border-white/10 bg-black/20 px-3 pt-3">
          {ranked.map((p) => (
            <div key={p.id} className="flex w-14 flex-col items-center">
              <Avatar config={parseAvatar(p.avatar, p.username)} size={30} />
              <span className="mt-0.5 max-w-full truncate font-mono text-[10px] text-fg-dim">
                {p.username}
              </span>
            </div>
          ))}
          {/* «скамья» трибуны */}
          <div className="mt-2 h-2 w-full rounded-b bg-gradient-to-b from-white/10 to-transparent" />
        </div>
      </div>

      {/* ── управление ── */}
      <div className="mt-6 flex flex-col items-center gap-3">
        {isHost ? (
          <>
            <div className="flex items-center gap-2 font-mono text-xs text-fg-dim">
              раундов:
              {[2, 3, 4, 5, 6].map((r) => (
                <button
                  key={r}
                  onClick={() => onSetRounds(r)}
                  className={`h-7 w-7 rounded ${totalRounds === r ? "bg-accent text-bg" : "border border-white/15 text-fg-dim hover:text-fg"}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={onRestart}
              className="rounded bg-accent px-6 py-2 font-mono text-sm text-bg"
            >
              играть снова
            </button>
          </>
        ) : (
          <button
            onClick={onShare}
            className="rounded border border-white/15 px-4 py-2 font-mono text-xs text-fg-dim hover:text-accent"
          >
            {copied ? "ссылка скопирована ✓" : "позвать друзей"}
          </button>
        )}
      </div>
    </div>
  );
}
