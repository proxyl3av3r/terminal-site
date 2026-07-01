// ─────────────────────────────────────────────────────────────────────
// Realtime-сервис чата bash-app.com (Socket.IO).
//
// Зачем отдельный контейнер: Next.js (standalone) не держит долгоживущих
// WS-соединений, а память на VPS общая. Этот процесс — тонкий: только
// fan-out событий, онлайн-статус и «печатает…». Источник истины (запись
// сообщений, rate-limit, валидация) остаётся в Next REST-ручках.
//
// Поток:
//   • Клиент подключается с той же cookie next-auth → декодим JWT → userId.
//   • Комнаты:  user:<id>  — личные уведомления (бейджи, список, запросы)
//               conv:<id>  — конкретный диалог (сообщения, typing, presence)
//   • Next после записи в БД дёргает POST /emit (по REALTIME_SECRET) и мы
//     рассылаем событие в нужные комнаты.
// ─────────────────────────────────────────────────────────────────────

import http from "node:http";
import { Server } from "socket.io";
import { parse as parseCookie } from "cookie";
import { decode } from "@auth/core/jwt";
import pg from "pg";
import { attachGame } from "./game.mjs";

const PORT = Number(process.env.PORT || 4000);
const AUTH_SECRET = process.env.AUTH_SECRET;
const REALTIME_SECRET = process.env.REALTIME_SECRET;

if (!AUTH_SECRET) {
  console.error("[realtime] FATAL: AUTH_SECRET не задан");
  process.exit(1);
}
if (!REALTIME_SECRET) {
  console.error("[realtime] FATAL: REALTIME_SECRET не задан");
  process.exit(1);
}

// Пул к Postgres — только для проверки членства в диалоге при входе в комнату.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
});

// Имена cookie сессии next-auth: secure (https) и обычный (локалка/http).
// salt при decode ДОЛЖЕН совпадать с именем cookie, из которого взят токен.
const COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
];

/** Достаём userId из cookie next-auth (или null). */
async function userIdFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const jar = parseCookie(cookieHeader);
  for (const name of COOKIE_NAMES) {
    const token = jar[name];
    if (!token) continue;
    try {
      const payload = await decode({ token, secret: AUTH_SECRET, salt: name });
      const id = payload?.id ?? payload?.sub;
      if (id) return String(id);
    } catch {
      // не тот ключ/просрочено — пробуем следующее имя
    }
  }
  return null;
}

/** accepted-член диалога? (pending/нет-записи → false) */
async function isAcceptedMember(conversationId, userId) {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM conversation_members
        WHERE "conversationId" = $1 AND "userId" = $2 AND state = 'accepted'
        LIMIT 1`,
      [conversationId, userId],
    );
    return rows.length > 0;
  } catch (e) {
    console.error("[realtime] membership check failed:", e.message);
    return false;
  }
}

// ── HTTP-сервер: /health и внутренний /emit (для Next) ────────────────
const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  if (req.method === "POST" && req.url === "/emit") {
    if (req.headers["x-realtime-secret"] !== REALTIME_SECRET) {
      res.writeHead(403).end();
      return;
    }
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 2_000_000) req.destroy(); // защита от мусора
    });
    req.on("end", () => {
      try {
        const { rooms, event, payload } = JSON.parse(raw || "{}");
        if (Array.isArray(rooms) && typeof event === "string") {
          for (const room of rooms) io.to(room).emit(event, payload);
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400).end();
      }
    });
    return;
  }

  res.writeHead(404).end();
});

const io = new Server(server, {
  path: "/socket.io",
  // Тот же ориджин (Nginx) — CORS не нужен. serveClient выключаем: клиент
  // тянет socket.io-client из бандла Next, а не с этого сервиса.
  serveClient: false,
});

// ── Аутентификация рукопожатия ────────────────────────────────────────
io.use(async (socket, next) => {
  const userId = await userIdFromCookie(socket.handshake.headers.cookie);
  if (!userId) return next(new Error("unauthorized"));
  socket.data.userId = userId;
  next();
});

/** Есть ли у пользователя ДРУГОЙ (не excludeId) сокет в этой комнате. */
function userHasOtherSocketInRoom(room, userId, excludeId) {
  const ids = io.sockets.adapter.rooms.get(room);
  if (!ids) return false;
  for (const sid of ids) {
    if (sid === excludeId) continue;
    if (io.sockets.sockets.get(sid)?.data.userId === userId) return true;
  }
  return false;
}

/** Множество userId, реально присутствующих в комнате прямо сейчас. */
function onlineUserIdsInRoom(room) {
  const ids = io.sockets.adapter.rooms.get(room);
  const out = new Set();
  if (ids) {
    for (const sid of ids) {
      const uid = io.sockets.sockets.get(sid)?.data.userId;
      if (uid) out.add(uid);
    }
  }
  return [...out];
}

// Игра «рисовалка-угадайка» — отдельный namespace «/game» (см. game.mjs).
attachGame(io, { pool, userIdFromCookie });

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  // Личная комната для адресных уведомлений (список диалогов, запросы, бейдж).
  socket.join(`user:${userId}`);

  // Войти в комнату диалога (открыли переписку). Проверяем членство по БД.
  socket.on("conv:join", async (raw, ack) => {
    const conversationId = String(raw?.conversationId ?? "");
    if (!conversationId) return;
    if (!(await isAcceptedMember(conversationId, userId))) {
      if (typeof ack === "function") ack({ ok: false });
      return;
    }
    const room = `conv:${conversationId}`;
    socket.join(room);
    // Остальным в комнате — что я онлайн; мне в ответ — кто уже онлайн.
    socket.to(room).emit("presence", { conversationId, userId, online: true });
    if (typeof ack === "function") {
      ack({ ok: true, online: onlineUserIdsInRoom(room) });
    }
  });

  // Покинуть комнату диалога (закрыли переписку).
  socket.on("conv:leave", (raw) => {
    const conversationId = String(raw?.conversationId ?? "");
    if (!conversationId) return;
    const room = `conv:${conversationId}`;
    socket.leave(room);
    if (!userHasOtherSocketInRoom(room, userId, socket.id)) {
      socket.to(room).emit("presence", { conversationId, userId, online: false });
    }
  });

  // «печатает…» — просто реле остальным в комнате (членство уже проверено join'ом).
  socket.on("typing", (raw) => {
    const conversationId = String(raw?.conversationId ?? "");
    if (!conversationId || !socket.rooms.has(`conv:${conversationId}`)) return;
    socket
      .to(`conv:${conversationId}`)
      .emit("typing", { conversationId, userId, typing: !!raw?.typing });
  });

  // Перед отключением гасим онлайн-статус в тех conv-комнатах, где это был
  // последний сокет пользователя.
  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (!room.startsWith("conv:")) continue;
      if (!userHasOtherSocketInRoom(room, userId, socket.id)) {
        const conversationId = room.slice(5);
        socket.to(room).emit("presence", { conversationId, userId, online: false });
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`[realtime] socket.io слушает :${PORT}`);
});

// Аккуратное завершение (docker stop) — закрываем соединения и пул.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`[realtime] ${sig} — завершаюсь`);
    io.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
