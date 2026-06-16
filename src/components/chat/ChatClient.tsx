"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Avatar from "@/components/avatar/Avatar";
import { parseAvatar } from "@/lib/avatar";
import { imageToAscii } from "@/lib/ascii";
import { getChatSocket } from "@/lib/socket";

interface PublicUser {
  username: string | null;
  shortId: string | null;
  avatar: string | null;
}
interface Conversation {
  id: string;
  isGroup: boolean;
  name: string | null;
  members: PublicUser[];
  last: { body: string; kind: string; createdAt: string; senderId: string } | null;
}
interface Message {
  id: string;
  kind: string;
  body: string;
  createdAt: string;
  senderId: string;
  sender: PublicUser;
}
interface ChatRequest {
  id: string;
  isGroup: boolean;
  name: string | null;
  from: PublicUser[];
  last: { body: string; kind: string; createdAt: string } | null;
}

const seedOf = (u: PublicUser) => u.shortId ?? u.username ?? "anon";
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const titleOf = (c: Conversation) =>
  c.isGroup
    ? c.name ?? "group"
    : c.members[0]?.username
      ? `@${c.members[0].username}`
      : "unknown";

export default function ChatClient({
  meId,
  meUsername,
}: {
  meId: string;
  meUsername: string;
}) {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [tab, setTab] = useState<"chats" | "requests">("chats");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [showNew, setShowNew] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true); // юзер сейчас внизу переписки?

  // Realtime: presence (кто онлайн в активной комнате) и «typing…» собеседника.
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [peerTyping, setPeerTyping] = useState(false);
  const activeIdRef = useRef<string | null>(null); // для замыканий в обработчиках сокета
  const typingSentRef = useRef(0); // когда последний раз слали typing:true
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConvos = useCallback(async () => {
    const res = await fetch("/api/chat/conversations");
    const data = await res.json();
    if (data.ok) setConvos(data.conversations);
  }, []);

  const loadRequests = useCallback(async () => {
    const res = await fetch("/api/chat/requests");
    const data = await res.json();
    if (data.ok) setRequests(data.requests);
  }, []);

  async function respond(id: string, action: "accept" | "decline") {
    const res = await fetch(`/api/chat/requests/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!data.ok) return;
    await Promise.all([loadRequests(), loadConvos()]);
    if (action === "accept") {
      setTab("chats");
      setActiveId(id);
    }
  }

  const loadMessages = useCallback(async (id: string) => {
    const res = await fetch(`/api/chat/conversations/${id}/messages`);
    const data = await res.json();
    if (!data.ok) return;
    // Не пересоздаём массив, если ничего не изменилось — иначе лишний ре-рендер
    // и ненужная прокрутка во время набора текста.
    setMessages((prev) => {
      const next: Message[] = data.messages;
      if (
        prev.length === next.length &&
        prev[prev.length - 1]?.id === next[next.length - 1]?.id
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  // Список диалогов и запросов: мгновенно — через сокет (ниже), а это —
  // первичная загрузка + редкий страховочный fallback (было 6с).
  useEffect(() => {
    loadConvos();
    loadRequests();
    const i = setInterval(() => {
      loadConvos();
      loadRequests();
    }, 20000);
    return () => clearInterval(i);
  }, [loadConvos, loadRequests]);

  // ── Realtime: подписка на события сокета (один раз) ──
  useEffect(() => {
    const socket = getChatSocket();

    // Новое сообщение в открытой переписке → перечитать (заодно отметит read).
    const onMessage = (p: { conversationId?: string }) => {
      if (p?.conversationId && p.conversationId === activeIdRef.current) {
        loadMessages(p.conversationId);
      }
    };
    const onBump = () => loadConvos();
    const onRequest = () => loadRequests();
    const onRemoved = (p: { conversationId?: string }) => {
      if (p?.conversationId && p.conversationId === activeIdRef.current) {
        setActiveId(null);
      }
      loadConvos();
      loadRequests();
    };
    const onPresence = (p: { conversationId?: string; userId?: string; online?: boolean }) => {
      if (!p?.userId || p.conversationId !== activeIdRef.current) return;
      setOnlineIds((prev) => {
        const next = new Set(prev);
        if (p.online) next.add(p.userId!);
        else next.delete(p.userId!);
        return next;
      });
    };
    const onTyping = (p: { conversationId?: string; userId?: string; typing?: boolean }) => {
      if (p?.conversationId !== activeIdRef.current || p.userId === meId) return;
      setPeerTyping(!!p.typing);
      if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current);
      if (p.typing) {
        // авто-сброс на случай потери события «перестал печатать»
        peerTypingTimer.current = setTimeout(() => setPeerTyping(false), 5000);
      }
    };
    // На (ре)коннект — заново войти в комнату активной переписки.
    const onConnect = () => {
      const id = activeIdRef.current;
      if (!id) return;
      socket.emit("conv:join", { conversationId: id }, (ack?: { ok?: boolean; online?: string[] }) => {
        if (ack?.ok && Array.isArray(ack.online)) setOnlineIds(new Set(ack.online));
      });
    };

    socket.on("message", onMessage);
    socket.on("conversation:bump", onBump);
    socket.on("request:new", onRequest);
    socket.on("conversation:removed", onRemoved);
    socket.on("presence", onPresence);
    socket.on("typing", onTyping);
    socket.on("connect", onConnect);
    return () => {
      socket.off("message", onMessage);
      socket.off("conversation:bump", onBump);
      socket.off("request:new", onRequest);
      socket.off("conversation:removed", onRemoved);
      socket.off("presence", onPresence);
      socket.off("typing", onTyping);
      socket.off("connect", onConnect);
    };
  }, [loadConvos, loadRequests, loadMessages, meId]);

  // Смена активной переписки: вход/выход из комнаты, presence/typing, fallback.
  useEffect(() => {
    activeIdRef.current = activeId;
    setPeerTyping(false);
    setOnlineIds(new Set());
    if (!activeId) return;
    atBottomRef.current = true;
    loadMessages(activeId);

    const socket = getChatSocket();
    socket.emit(
      "conv:join",
      { conversationId: activeId },
      (ack?: { ok?: boolean; online?: string[] }) => {
        if (ack?.ok && Array.isArray(ack.online)) setOnlineIds(new Set(ack.online));
      },
    );

    // Страховочный fallback (было 3с) — на случай простоя realtime.
    const i = setInterval(() => loadMessages(activeId), 25000);
    return () => {
      clearInterval(i);
      socket.emit("conv:leave", { conversationId: activeId });
    };
  }, [activeId, loadMessages]);

  // Прокрутка вниз ТОЛЬКО если юзер уже был внизу (не таскаем при чтении вверху).
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Сообщить собеседнику, что печатаю (не чаще раза в ~1.5с) + авто-стоп.
  function emitTyping() {
    const cid = activeIdRef.current;
    if (!cid) return;
    const socket = getChatSocket();
    const now = Date.now();
    if (now - typingSentRef.current > 1500) {
      typingSentRef.current = now;
      socket.emit("typing", { conversationId: cid, typing: true });
    }
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => {
      typingSentRef.current = 0;
      socket.emit("typing", { conversationId: cid, typing: false });
    }, 2500);
  }

  function stopTyping() {
    const cid = activeIdRef.current;
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    if (typingSentRef.current && cid) {
      getChatSocket().emit("typing", { conversationId: cid, typing: false });
    }
    typingSentRef.current = 0;
  }

  async function sendBody(kind: "text" | "ascii", body: string) {
    if (!activeId) return;
    stopTyping();
    atBottomRef.current = true; // своё сообщение — всегда к низу
    const res = await fetch(`/api/chat/conversations/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, body }),
    });
    const data = await res.json();
    if (data.ok) setMessages((m) => [...m, data.message]);
    else if (data.error) alert(data.error);
    loadConvos();
  }

  function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    sendBody("text", body);
  }

  // Картинка → ASCII (в браузере) → отправка как ascii-сообщение.
  async function sendImage(file: File) {
    try {
      const ascii = await imageToAscii(file, 72);
      await sendBody("ascii", ascii);
    } catch {
      alert("could not process the image");
    }
  }

  const active = convos.find((c) => c.id === activeId);
  // onlineIds включает меня (я в комнате) — для статуса собеседника исключаем.
  const othersOnline = [...onlineIds].filter((id) => id !== meId);

  return (
    <div className="flex h-[calc(100dvh-10rem)] overflow-hidden rounded-lg border border-white/10 bg-bg-soft/40 md:h-[calc(100vh-8rem)]">
      {/* ── список диалогов / запросов (на мобиле прячется при открытом чате) ── */}
      <div className={`${activeId ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-white/10 md:w-64`}>
        <div className="flex items-center gap-1 border-b border-white/10 px-2 py-2">
          <button
            onClick={() => setTab("chats")}
            className={`rounded px-2 py-1 font-mono text-xs ${tab === "chats" ? "bg-accent/15 text-accent" : "text-fg-dim hover:text-fg"}`}
          >
            chats
          </button>
          <button
            onClick={() => setTab("requests")}
            className={`flex items-center gap-1 rounded px-2 py-1 font-mono text-xs ${tab === "requests" ? "bg-accent/15 text-accent" : "text-fg-dim hover:text-fg"}`}
          >
            requests
            {requests.length > 0 && (
              <span className="rounded-full bg-accent-amber px-1.5 text-[10px] font-bold text-bg">
                {requests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="ml-auto rounded border border-white/15 px-2 py-0.5 font-mono text-xs text-fg-dim hover:text-accent"
          >
            + new
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "chats" ? (
            <>
              {convos.length === 0 && (
                <p className="p-3 text-xs text-fg-dim">no chats yet. press + new</p>
              )}
              {convos.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                    activeId === c.id ? "bg-accent/10" : "hover:bg-white/5"
                  }`}
                >
                  {!c.isGroup && c.members[0] && (
                    <Avatar config={parseAvatar(c.members[0].avatar, seedOf(c.members[0]))} size={32} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm text-fg">{titleOf(c)}</div>
                    <div className="truncate text-xs text-fg-dim">
                      {c.last ? (c.last.kind === "ascii" ? "[ascii image]" : c.last.body) : "—"}
                    </div>
                  </div>
                </button>
              ))}
            </>
          ) : (
            <>
              {requests.length === 0 && (
                <p className="p-3 text-xs text-fg-dim">no incoming requests</p>
              )}
              {requests.map((r) => (
                <div key={r.id} className="border-b border-white/5 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {r.from[0] && (
                      <Avatar config={parseAvatar(r.from[0].avatar, seedOf(r.from[0]))} size={32} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-sm text-fg">
                        @{r.from[0]?.username ?? "user"}
                      </div>
                      <div className="truncate text-xs text-fg-dim">
                        {r.last ? (r.last.kind === "ascii" ? "[ascii image]" : r.last.body) : "wants to chat"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => respond(r.id, "accept")}
                      className="flex-1 rounded bg-accent py-1 font-mono text-xs text-bg"
                    >
                      accept
                    </button>
                    <button
                      onClick={() => respond(r.id, "decline")}
                      className="flex-1 rounded border border-danger/40 py-1 font-mono text-xs text-danger hover:bg-danger/10"
                    >
                      decline
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── окно сообщений (на мобиле занимает весь экран при открытом чате) ── */}
      <div className={`${activeId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {!active ? (
          <div className="grid flex-1 place-items-center px-4 text-center text-sm text-fg-dim">
            select a chat or start a new one
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5 font-mono text-sm text-fg md:px-4">
              <button
                onClick={() => setActiveId(null)}
                aria-label="back"
                className="text-fg-dim hover:text-fg md:hidden"
              >
                ‹
              </button>
              <span>{titleOf(active)}</span>
              {!active.isGroup && othersOnline.length > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-accent">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  online
                </span>
              )}
              {active.isGroup && (
                <span className="ml-2 text-xs text-fg-dim">
                  {active.members.length + 1} members
                  {othersOnline.length > 0 && ` · ${othersOnline.length} online`}
                </span>
              )}
              {peerTyping && (
                <span className="ml-auto animate-pulse text-[11px] text-fg-dim">
                  typing…
                </span>
              )}
            </div>

            <div
              ref={listRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                atBottomRef.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
              className="flex-1 space-y-1 overflow-y-auto px-4 py-3"
            >
              {messages.map((m, i) => {
                const mine = m.senderId === meId;
                // Начало «группы» — когда отправитель сменился (или прошло >5 мин).
                const prev = messages[i - 1];
                const groupStart =
                  !prev ||
                  prev.senderId !== m.senderId ||
                  +new Date(m.createdAt) - +new Date(prev.createdAt) > 5 * 60_000;

                return (
                  <div
                    key={m.id}
                    className={`flex gap-2 ${mine ? "flex-row-reverse" : ""} ${groupStart ? "mt-3" : ""}`}
                  >
                    {/* колонка аватара: показываем только в начале группы */}
                    <div className="w-7 shrink-0">
                      {groupStart && (
                        <Avatar config={parseAvatar(m.sender.avatar, seedOf(m.sender))} size={28} />
                      )}
                    </div>
                    <div className={`min-w-0 max-w-[75%] ${mine ? "text-right" : ""}`}>
                      {groupStart && (
                        <div className="mb-0.5 flex items-center gap-2 font-mono text-[11px] text-fg-dim">
                          <span className={mine ? "text-accent" : "text-fg"}>
                            @{mine ? "you" : m.sender.username ?? "user"}
                          </span>
                          <span>{fmtTime(m.createdAt)}</span>
                        </div>
                      )}
                      {m.kind === "ascii" ? (
                        <pre className="inline-block overflow-x-auto rounded bg-black/40 p-2 text-left font-mono text-accent" style={{ fontSize: "5px", lineHeight: "5px" }}>
                          {m.body}
                        </pre>
                      ) : (
                        <div className={`inline-block whitespace-pre-wrap break-words rounded-lg px-3 py-1.5 text-left text-sm ${mine ? "bg-accent/15 text-fg" : "bg-white/5 text-fg"}`}>
                          {m.body}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="attach image as ASCII"
                className="shrink-0 font-mono text-base text-fg-dim hover:text-accent"
                title="send image as ASCII"
              >
                ▤
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) sendImage(f);
                  e.target.value = "";
                }}
              />
              <input
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  emitTyping();
                }}
                placeholder="message…"
                maxLength={2000}
                className="flex-1 bg-transparent text-sm text-fg caret-accent outline-none"
              />
              <button type="submit" className="rounded bg-accent px-3 py-1.5 font-mono text-xs text-bg">
                send
              </button>
            </form>
          </>
        )}
      </div>

      {showNew && (
        <NewChat
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            setActiveId(id);
            loadConvos();
          }}
        />
      )}
    </div>
  );
}

// ── Поиск и старт нового диалога ──
function NewChat({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<(PublicUser & { id: string }) | null | "none">(null);
  const [busy, setBusy] = useState(false);

  async function lookup() {
    setFound(null);
    if (q.trim().length < 3) return;
    const res = await fetch(`/api/users/lookup?q=${encodeURIComponent(q.trim())}`);
    const data = await res.json();
    setFound(data.user ?? "none");
  }

  async function start(targetUserId: string) {
    setBusy(true);
    const res = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.ok) onCreated(data.id);
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[min(92vw,420px)] rounded-lg border border-white/10 bg-bg-soft p-5">
        <div className="mb-3 font-mono text-sm text-accent">$ new chat</div>
        <p className="mb-2 text-xs text-fg-dim">find by @username, #123456 or email</p>
        <div className="flex gap-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="@nick"
            className="flex-1 rounded border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-fg outline-none focus:border-accent"
          />
          <button onClick={lookup} className="rounded border border-white/15 px-3 py-2 font-mono text-xs text-fg-dim hover:text-fg">
            find
          </button>
        </div>

        {found === "none" && <p className="mt-3 text-xs text-danger">no user found</p>}
        {found && found !== "none" && (
          <button
            onClick={() => start(found.id)}
            disabled={busy}
            className="mt-3 flex w-full items-center gap-2 rounded border border-white/10 p-2 hover:border-accent/40 disabled:opacity-50"
          >
            <Avatar config={parseAvatar(found.avatar, seedOf(found))} size={32} />
            <span className="font-mono text-sm text-fg">@{found.username ?? "user"}</span>
            <span className="ml-auto font-mono text-xs text-accent">start →</span>
          </button>
        )}
      </div>
    </div>
  );
}
