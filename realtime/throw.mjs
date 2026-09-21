// ─────────────────────────────────────────────────────────────────────
// «Бросок жестом» (/throw). Отдельный namespace «/throw» на том же
// Socket.IO сервере, что и чат/игра — переиспользуем контейнер и
// nginx-проксирование /socket.io/, новых сервисов не заводим.
//
// В отличие от «/game» — здесь НЕТ аутентификации: комната анонимная,
// вход только по короткому id из QR. Состояние только в памяти,
// в БД ничего не пишем. Комната живёт максимум IDLE_TTL_MS с момента
// последней активности; если из неё все вышли — сносим раньше
// (EMPTY_GRACE_MS), не дожидаясь полного простоя.
//
// Роли: ровно один «sender» (ноутбук, создатель комнаты — роль даётся
// только через throw:create, перехватить её по id нельзя) и до
// MAX_RECEIVERS «receiver» (телефоны, входят по id через throw:join).
// Сервер — только релей: бросок с ноутбука долетает до выбранного по
// направлению телефона, бросок с телефона всегда летит обратно на ноутбук.
// ─────────────────────────────────────────────────────────────────────

const IDLE_TTL_MS = 30 * 60 * 1000; // авто-удаление после 30 мин простоя
const EMPTY_GRACE_MS = 2 * 60 * 1000; // пустую комнату сносим раньше
const MAX_ROOMS = 2000; // защита от исчерпания памяти анонимными комнатами
const MAX_RECEIVERS = 6;
const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // без похожих 0/o/1/l/i
const ID_LEN = 8;
const POSITIONS = ["right", "left", "top", "bottom"];
const EDGES = new Set(POSITIONS);

const rooms = new Map(); // id -> room

const rnd = (n) => Math.floor(Math.random() * n);

function genRoomId() {
  let id;
  do {
    id = Array.from({ length: ID_LEN }, () => ID_ALPHABET[rnd(ID_ALPHABET.length)]).join("");
  } while (rooms.has(id));
  return id;
}

function genPeerId() {
  return Array.from({ length: 10 }, () => ID_ALPHABET[rnd(ID_ALPHABET.length)]).join("");
}

// Per-socket sliding-window лимит на событие (анти-флуд).
function rateOk(socket, name, limit, windowMs) {
  const now = Date.now();
  socket.data.rl = socket.data.rl || {};
  const arr = (socket.data.rl[name] || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    socket.data.rl[name] = arr;
    return false;
  }
  arr.push(now);
  socket.data.rl[name] = arr;
  return true;
}

const finite = (v, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Зажимаем скорости/вращение в разумный диапазон — это просто числа,
// летящие в relay, но лучше не пускать в эфир NaN/Infinity/огромные значения.
function sanitizeThrow(raw) {
  if (!raw || typeof raw !== "object") return null;
  const exitEdge = EDGES.has(raw.exitEdge) ? raw.exitEdge : null;
  return {
    objectId: String(raw.objectId ?? "").slice(0, 64) || "ball",
    vx: clamp(finite(raw.vx), -8000, 8000),
    vy: clamp(finite(raw.vy), -8000, 8000),
    spin: clamp(finite(raw.spin), -50, 50),
    color: /^#?[0-9a-fA-F]{3,8}$/.test(String(raw.color ?? "")) ? String(raw.color).slice(0, 7) : "#39ff14",
    exitEdge,
    pos: clamp(finite(raw.pos, 0.5), 0, 1),
    targetId: raw.targetId ? String(raw.targetId).slice(0, 32) : null,
  };
}

function touch(room) {
  room.lastActivity = Date.now();
  if (room.idleTimer) clearTimeout(room.idleTimer);
  room.idleTimer = setTimeout(() => deleteRoom(room), IDLE_TTL_MS);
}

function deleteRoom(room) {
  if (room.idleTimer) clearTimeout(room.idleTimer);
  if (room.emptyTimer) clearTimeout(room.emptyTimer);
  rooms.delete(room.id);
}

function scheduleEmptyCheck(room) {
  if (room.emptyTimer) {
    clearTimeout(room.emptyTimer);
    room.emptyTimer = null;
  }
  if (!room.sender && room.receivers.size === 0) {
    room.emptyTimer = setTimeout(() => deleteRoom(room), EMPTY_GRACE_MS);
  }
}

function peerList(room) {
  return [...room.receivers.values()].map((r) => ({ id: r.id, position: r.position }));
}

function nextPosition(room) {
  const used = new Set([...room.receivers.values()].map((r) => r.position));
  return POSITIONS.find((p) => !used.has(p)) ?? POSITIONS[room.receivers.size % POSITIONS.length];
}

function pickTarget(room, { targetId, exitEdge }) {
  if (targetId) {
    const exact = room.receivers.get(targetId);
    if (exact) return exact;
  }
  const candidates = [...room.receivers.values()];
  if (!candidates.length) return null;
  if (exitEdge) {
    const byEdge = candidates.find((r) => r.position === exitEdge);
    if (byEdge) return byEdge;
  }
  return candidates[0];
}

export function attachThrow(io) {
  const nsp = io.of("/throw");

  // Аутентификация не нужна — просто присваиваем анонимный peerId.
  nsp.use((socket, next) => {
    socket.data.peerId = genPeerId();
    next();
  });

  nsp.on("connection", (socket) => {
    let roomId = null;
    let role = null; // "sender" | "receiver"

    const getRoom = () => (roomId ? rooms.get(roomId) : null);

    // Ноутбук: создать комнату, стать в ней sender'ом.
    socket.on("throw:create", (_p, ack) => {
      if (typeof ack !== "function") return;
      if (roomId) return ack({ ok: false, error: "already_in_room" });
      if (rooms.size >= MAX_ROOMS) return ack({ ok: false, error: "server_busy" });

      const id = genRoomId();
      const room = {
        id,
        sender: null,
        receivers: new Map(),
        lastActivity: Date.now(),
        idleTimer: null,
        emptyTimer: null,
      };
      rooms.set(id, room);
      room.sender = socket.id;
      roomId = id;
      role = "sender";
      socket.join(`throw:${id}`);
      touch(room);
      ack({ ok: true, id });
    });

    // Телефон: войти в существующую комнату по id из QR.
    socket.on("throw:join", (raw, ack) => {
      if (typeof ack !== "function") return;
      if (roomId) return ack({ ok: false, error: "already_in_room" });
      const id = String(raw?.id ?? "").toLowerCase().trim();
      const room = rooms.get(id);
      if (!room) return ack({ ok: false, error: "not_found" });
      if (room.receivers.size >= MAX_RECEIVERS) return ack({ ok: false, error: "room_full" });

      roomId = id;
      role = "receiver";
      const peerId = socket.data.peerId;
      const position = nextPosition(room);
      room.receivers.set(peerId, { id: peerId, socketId: socket.id, position });
      socket.join(`throw:${id}`);
      if (room.emptyTimer) {
        clearTimeout(room.emptyTimer);
        room.emptyTimer = null;
      }
      touch(room);

      ack({ ok: true, id, peerId, position });
      if (room.sender) nsp.to(room.sender).emit("throw:peer-list", peerList(room));
    });

    // Ноутбук расставляет телефоны по сторонам (UI drag/выбор).
    socket.on("throw:arrange", (raw) => {
      const room = getRoom();
      if (!room || role !== "sender") return;
      const positions = raw?.positions;
      if (!positions || typeof positions !== "object") return;
      for (const [peerId, pos] of Object.entries(positions)) {
        if (!EDGES.has(pos)) continue;
        const r = room.receivers.get(peerId);
        if (r) r.position = pos;
      }
      touch(room);
      nsp.to(room.sender).emit("throw:peer-list", peerList(room));
    });

    // Бросок — с любой стороны. С ноутбука летит к выбранному телефону
    // (по direction/exitEdge или явному targetId), с телефона — всегда
    // обратно на ноутбук.
    socket.on("throw:throw", (raw) => {
      const room = getRoom();
      if (!room || !role) return;
      if (!rateOk(socket, "throw", 20, 5000)) return;
      const payload = sanitizeThrow(raw);
      if (!payload) return;
      touch(room);

      if (role === "sender") {
        const target = pickTarget(room, payload);
        if (!target) return; // некому кидать — телефон ещё не подключился
        nsp.to(target.socketId).emit("throw:incoming", { ...payload, from: "sender", at: Date.now() });
      } else {
        if (!room.sender) return;
        nsp.to(room.sender).emit("throw:incoming", { ...payload, from: socket.data.peerId, at: Date.now() });
      }
    });

    // Подтверждение поимки — чисто косметический фидбек отправителю.
    socket.on("throw:catch", (raw) => {
      const room = getRoom();
      if (!room || !role) return;
      touch(room);
      const objectId = String(raw?.objectId ?? "").slice(0, 64);
      if (role === "sender") {
        const target = pickTarget(room, sanitizeThrow(raw) ?? {});
        if (target) nsp.to(target.socketId).emit("throw:caught", { objectId });
      } else if (room.sender) {
        nsp.to(room.sender).emit("throw:caught", { objectId });
      }
    });

    function leave() {
      const room = getRoom();
      if (!room) return;
      if (role === "sender") {
        room.sender = null;
        nsp.to(`throw:${room.id}`).emit("throw:peer-left", { role: "sender" });
      } else if (role === "receiver") {
        room.receivers.delete(socket.data.peerId);
        if (room.sender) nsp.to(room.sender).emit("throw:peer-list", peerList(room));
      }
      scheduleEmptyCheck(room);
      socket.leave(`throw:${room.id}`);
      roomId = null;
      role = null;
    }

    socket.on("throw:leave", leave);
    socket.on("disconnect", leave);
  });
}
