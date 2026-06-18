"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getGameSocket } from "@/lib/socket";
import Avatar from "@/components/avatar/Avatar";
import { parseAvatar } from "@/lib/avatar";
import GameCanvas from "@/components/game/GameCanvas";
import GameFinale from "@/components/game/GameFinale";

interface PlayerV {
  id: string;
  username: string;
  avatar: string | null;
  score: number;
  online: boolean;
  guessed: boolean;
  drawing: boolean;
  isHost: boolean;
  awarded: number;
}
type Status = "lobby" | "choosing" | "playing" | "roundend" | "gameover";
interface GameState {
  code: string;
  status: Status;
  round: number;
  totalRounds: number;
  hostId: string;
  drawerId: string | null;
  players: PlayerV[];
  word: string | null;
  maskedWord: string | null;
  wordLength: number;
  turnEndsAt: number;
  canDraw: boolean;
}
interface Msg {
  tone: "sys" | "reveal" | "correct" | "guessed" | "user";
  text: string;
  from?: string;
  at: number;
}

const COLORS = ["#111111", "#ffffff", "#e23636", "#ff8c00", "#39ff14", "#1f8fff", "#a855f7", "#8b5a2b"];
const SIZES: { label: string; v: number }[] = [
  { label: "S", v: 0.006 },
  { label: "M", v: 0.013 },
  { label: "L", v: 0.024 },
];
const ROUND_CHOICES = [2, 3, 4, 5, 6];

export default function GameClient({ meId }: { meId: string }) {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [choices, setChoices] = useState<string[] | null>(null);
  const [hint, setHint] = useState<{ level: string; text: string } | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [sizeNorm, setSizeNorm] = useState(SIZES[1].v);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const joinRoom = useCallback((code: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("game:join", { code }, (ack?: { ok?: boolean; error?: string }) => {
      if (ack?.ok) {
        setError(null);
        window.history.replaceState(null, "", `/dashboard/game?room=${code}`);
      } else {
        setError(ack?.error ?? "не удалось войти");
      }
    });
  }, []);

  // Подключение к сокету и подписка на события (один раз).
  useEffect(() => {
    const socket = getGameSocket();
    socketRef.current = socket;

    const onState = (s: GameState) => {
      setState(s);
      if (s.status !== "choosing" || s.drawerId !== meId) setChoices(null);
    };
    const onChat = (m: Msg) => setMessages((prev) => [...prev.slice(-120), m]);
    const onChoices = (p: { words: string[] }) => setChoices(p.words);
    const onHint = (h: { level: string; text: string }) => {
      setHint(h);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setHint(null), 2500);
    };

    socket.on("game:state", onState);
    socket.on("game:chat", onChat);
    socket.on("game:choices", onChoices);
    socket.on("game:hint", onHint);

    // Авто-вход по ?room=КОД из ссылки-приглашения.
    const param = new URLSearchParams(window.location.search).get("room");
    if (param) joinRoom(param.toUpperCase());

    return () => {
      socket.off("game:state", onState);
      socket.off("game:chat", onChat);
      socket.off("game:choices", onChoices);
      socket.off("game:hint", onHint);
    };
  }, [meId, joinRoom]);

  // Тикаем секундомер только во время хода.
  useEffect(() => {
    if (state?.status !== "playing") return;
    const i = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(i);
  }, [state?.status]);

  // Авто-скролл чата вниз.
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function createRoom() {
    const socket = socketRef.current;
    socket?.emit("game:create", null, (ack?: { ok?: boolean; code?: string }) => {
      if (ack?.ok && ack.code) joinRoom(ack.code);
    });
  }
  function leaveRoom() {
    socketRef.current?.emit("game:leave");
    setState(null);
    setMessages([]);
    setChoices(null);
    window.history.replaceState(null, "", "/dashboard/game");
  }
  const startGame = () =>
    socketRef.current?.emit("game:start", { rounds: state?.totalRounds });
  const setRounds = (r: number) => socketRef.current?.emit("game:setrounds", { rounds: r });
  const choose = (word: string) => {
    socketRef.current?.emit("game:choose", { word });
    setChoices(null);
  };
  const clearCanvas = () => socketRef.current?.emit("game:clear");
  function sendGuess() {
    const t = text.trim();
    if (!t) return;
    socketRef.current?.emit("game:guess", { text: t });
    setText("");
  }
  const shareLink = useCallback(() => {
    if (!state) return;
    const url = `${window.location.origin}/dashboard/game?room=${state.code}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [state]);

  // ── Лендинг (ещё не в комнате) ──
  if (!state) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="font-mono text-xl text-fg">
          <span className="text-accent">$</span> рисуй и угадывай
        </h1>
        <p className="mt-1 text-sm text-fg-dim">
          один рисует — остальные угадывают. реалтайм, по коду комнаты.
        </p>

        <div className="mt-6 space-y-4 rounded-lg border border-white/10 bg-bg-soft/50 p-5">
          <button
            onClick={createRoom}
            className="w-full rounded bg-accent py-2.5 font-mono text-sm text-bg"
          >
            создать комнату
          </button>
          <div className="flex items-center gap-2 text-xs text-fg-dim">
            <span className="h-px flex-1 bg-white/10" /> или войти <span className="h-px flex-1 bg-white/10" />
          </div>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinCode.trim() && joinRoom(joinCode.trim())}
              placeholder="КОД КОМНАТЫ"
              maxLength={6}
              className="flex-1 rounded border border-white/10 bg-black/40 px-3 py-2 text-center font-mono text-sm uppercase tracking-widest text-fg outline-none focus:border-accent"
            />
            <button
              onClick={() => joinCode.trim() && joinRoom(joinCode.trim())}
              className="rounded border border-white/15 px-4 py-2 font-mono text-sm text-fg-dim hover:text-fg"
            >
              войти
            </button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </div>
    );
  }

  // ── В комнате ──
  const amDrawer = state.drawerId === meId;
  const me = state.players.find((p) => p.id === meId);
  const iGuessed = !!me?.guessed;
  const playing = state.status === "playing";
  const isHost = state.hostId === meId;
  const secondsLeft = playing ? Math.max(0, Math.ceil((state.turnEndsAt - now) / 1000)) : 0;
  const drawer = state.players.find((p) => p.id === state.drawerId);
  const canType = !(playing && (amDrawer || iGuessed));
  const wordDisplay = state.word ?? state.maskedWord ?? "";

  return (
    <div className="mx-auto max-w-5xl">
      {/* шапка комнаты */}
      <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-sm">
        <span className="text-accent">$</span>
        <span className="text-fg">рисуй и угадывай</span>
        <button
          onClick={shareLink}
          title="скопировать ссылку-приглашение"
          className="rounded border border-white/15 px-2 py-0.5 text-xs text-fg-dim hover:text-accent"
        >
          комната {state.code} {copied ? "· скопировано ✓" : "· поделиться"}
        </button>
        <span className="text-xs text-fg-dim">
          раунд {Math.min(state.round, state.totalRounds)}/{state.totalRounds}
        </span>
        <button
          onClick={leaveRoom}
          className="ml-auto rounded border border-danger/40 px-2 py-0.5 text-xs text-danger hover:bg-danger/10"
        >
          выйти
        </button>
      </div>

      {state.status === "gameover" ? (
        <GameFinale
          players={state.players}
          meId={meId}
          isHost={isHost}
          totalRounds={state.totalRounds}
          onSetRounds={setRounds}
          onRestart={startGame}
          onShare={shareLink}
          copied={copied}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
          {/* центр: статус-бар + холст + тулбар */}
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-3 rounded-lg border border-white/10 bg-bg-soft/40 px-3 py-2">
              <div className="min-w-0 flex-1">
                {playing ? (
                  <div className="truncate font-mono text-lg tracking-[0.3em] text-fg">
                    {wordDisplay}
                  </div>
                ) : (
                  <div className="truncate font-mono text-sm text-fg-dim">
                    {state.status === "lobby"
                      ? "ждём в лобби"
                      : state.status === "choosing"
                        ? amDrawer
                          ? "выбери слово…"
                          : `${drawer?.username ?? "кто-то"} выбирает…`
                        : `слово было «${state.word ?? "?"}»`}
                  </div>
                )}
                {playing && (
                  <div className="font-mono text-[11px] text-fg-dim">
                    {amDrawer ? "ты рисуешь" : `${drawer?.username ?? ""} рисует · ${state.wordLength} букв`}
                  </div>
                )}
              </div>
              {playing && (
                <div className={`shrink-0 font-mono text-xl ${secondsLeft <= 10 ? "text-danger" : "text-accent"}`}>
                  {secondsLeft}с
                </div>
              )}
            </div>

            <div className="relative">
              <GameCanvas socket={socketRef.current!} canDraw={state.canDraw} color={color} sizeNorm={sizeNorm} />

              {hint && (
                <div className="pointer-events-none absolute right-2 top-2 rounded bg-black/70 px-2 py-1 font-mono text-xs text-accent-amber">
                  {hint.text}
                </div>
              )}

              {/* выбор слова (рисующему) */}
              {choices && amDrawer && state.status === "choosing" && (
                <div className="absolute inset-0 grid place-items-center rounded-lg bg-black/70">
                  <div className="text-center">
                    <div className="mb-3 font-mono text-sm text-fg-dim">выбери слово для рисунка</div>
                    <div className="flex flex-wrap justify-center gap-2 px-2">
                      {choices.map((w) => (
                        <button
                          key={w}
                          onClick={() => choose(w)}
                          className="rounded border border-accent/40 bg-bg-soft px-4 py-2 font-mono text-sm text-accent hover:bg-accent/10"
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* лобби — оверлей со стартом и выбором раундов */}
              {state.status === "lobby" && (
                <div className="absolute inset-0 grid place-items-center rounded-lg bg-black/75 px-4 text-center">
                  <div>
                    <div className="mb-2 font-mono text-sm text-fg">лобби</div>
                    <p className="mb-4 text-xs text-fg-dim">
                      {state.players.length < 2
                        ? "пришли ссылку друзьям — нужно 2+ игрока"
                        : isHost
                          ? "все в сборе? выбери раунды и запускай."
                          : "ждём, пока хост начнёт…"}
                    </p>
                    {isHost && (
                      <div className="mb-4 flex items-center justify-center gap-2 font-mono text-xs text-fg-dim">
                        раундов:
                        {ROUND_CHOICES.map((r) => (
                          <button
                            key={r}
                            onClick={() => setRounds(r)}
                            className={`h-7 w-7 rounded ${state.totalRounds === r ? "bg-accent text-bg" : "border border-white/15 text-fg-dim hover:text-fg"}`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                    {isHost ? (
                      <button
                        onClick={startGame}
                        disabled={state.players.filter((p) => p.online).length < 2}
                        className="rounded bg-accent px-5 py-2 font-mono text-sm text-bg disabled:opacity-40"
                      >
                        начать игру
                      </button>
                    ) : (
                      <button
                        onClick={shareLink}
                        className="rounded border border-white/15 px-4 py-2 font-mono text-xs text-fg-dim hover:text-accent"
                      >
                        {copied ? "ссылка скопирована ✓" : "позвать друзей"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* тулбар рисующего */}
            {state.canDraw && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-bg-soft/40 px-3 py-2">
                <div className="flex gap-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      aria-label={`цвет ${c}`}
                      className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-accent" : "border-white/20"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="ml-1 flex gap-1">
                  {SIZES.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setSizeNorm(s.v)}
                      className={`h-6 w-7 rounded font-mono text-xs ${sizeNorm === s.v ? "bg-accent text-bg" : "border border-white/15 text-fg-dim"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={clearCanvas}
                  className="ml-auto rounded border border-white/15 px-3 py-1 font-mono text-xs text-fg-dim hover:text-danger"
                >
                  очистить
                </button>
              </div>
            )}
          </div>

          {/* сайдбар: игроки + чат */}
          <div className="flex min-h-0 flex-col gap-3">
            <div className="rounded-lg border border-white/10 bg-bg-soft/40 p-2">
              <div className="mb-1 px-1 font-mono text-[11px] text-fg-dim">игроки</div>
              <div className="space-y-0.5">
                {state.players.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 rounded px-1.5 py-1 ${p.drawing ? "bg-accent/10" : ""} ${p.online ? "" : "opacity-40"}`}
                  >
                    <Avatar config={parseAvatar(p.avatar, p.username)} size={20} />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg">
                      {p.username}
                      {p.id === meId && " (ты)"}
                    </span>
                    {p.drawing && <span title="рисует">✎</span>}
                    {p.guessed && <span className="text-accent" title="угадал">✓</span>}
                    {p.isHost && <span className="text-accent-amber" title="хост">★</span>}
                    <span className="font-mono text-xs text-accent-amber">{p.score}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex min-h-[12rem] flex-1 flex-col rounded-lg border border-white/10 bg-bg-soft/40">
              <div ref={chatRef} className="flex-1 space-y-0.5 overflow-y-auto p-2 text-xs">
                {messages.map((m, i) => (
                  <div key={i} className="break-words">
                    {m.tone === "user" || m.tone === "guessed" ? (
                      <span className={m.tone === "guessed" ? "text-accent" : "text-fg"}>
                        <span className="text-fg-dim">{m.from}:</span> {m.text}
                      </span>
                    ) : (
                      <span
                        className={
                          m.tone === "correct"
                            ? "text-accent"
                            : m.tone === "reveal"
                              ? "text-accent-amber"
                              : "text-fg-dim"
                        }
                      >
                        {m.text}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendGuess();
                }}
                className="border-t border-white/10 p-1.5"
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={!canType}
                  placeholder={
                    amDrawer && playing
                      ? "ты рисуешь…"
                      : iGuessed && playing
                        ? "ты угадал! 🎉"
                        : "введи догадку"
                  }
                  maxLength={120}
                  className="w-full rounded bg-black/40 px-2 py-1.5 font-mono text-xs text-fg outline-none focus:bg-black/60 disabled:opacity-50"
                />
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
