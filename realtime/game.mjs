// ─────────────────────────────────────────────────────────────────────
// Игра «рисовалка-угадайка» (skribbl-подобная) поверх того же Socket.IO.
// Отдельный namespace «/game». Состояние комнат — ТОЛЬКО в памяти (эфемерно):
// рисунки/слова не пишем в БД, это снимает нагрузку и миграции. Аутентификация
// рукопожатия — та же cookie next-auth, что и у чата.
//
// Источник истины по ходу партии — этот сервис: он держит слово (секрет для
// угадывающих), таймеры, очки и порядок ходов; клиентам рассылает только то,
// что им положено видеть (угадывающим — маску слова, не само слово).
// ─────────────────────────────────────────────────────────────────────

import { GAME_WORDS } from "./words.mjs";

const TURN_SECONDS = 75; // длительность хода
const ROUNDEND_SECONDS = 6; // пауза между ходами (показ слова/очков)
const CHOOSE_SECONDS = 15; // сколько даём рисующему на выбор слова
const WORD_CHOICES = 3;
const TOTAL_ROUNDS = 3; // дефолт; хост может выбрать в лобби
const MIN_ROUNDS = 1;
const MAX_ROUNDS = 8;
const MAX_PLAYERS = 12;
const MAX_STROKE_OPS = 8000; // потолок операций рисования в ходе (память)
const EMPTY_ROOM_TTL = 60_000; // удалить комнату, если все ушли, через минуту

const rooms = new Map(); // code -> room

// ── утилиты ───────────────────────────────────────────────────────────
const rnd = (n) => Math.floor(Math.random() * n);

function genCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без похожих 0/O/1/I
  let code;
  do {
    code = Array.from({ length: 4 }, () => alphabet[rnd(alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function pickWords(n) {
  const pool = [...GAME_WORDS];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(rnd(pool.length), 1)[0]);
  return out;
}

// Расстояние Левенштейна — для подсказок «горячо/холодно».
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return dp[n];
}

const normalizeGuess = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// Per-socket sliding-window лимит на событие (анти-флуд внутри комнаты).
// Возвращает true, если событие в пределах лимита.
function sockLimit(socket, name, limit, windowMs) {
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

// Маска слова: открытые буквы + «_», пробелы/неалфавитные символы видны.
function maskWord(word, revealed) {
  const idxs = [];
  for (let i = 0; i < word.length; i++) if (/[a-zа-яё0-9]/i.test(word[i])) idxs.push(i);
  const show = new Set(idxs.slice(0, revealed));
  let out = "";
  for (let i = 0; i < word.length; i++) {
    if (word[i] === " ") out += "  ";
    else if (!/[a-zа-яё0-9]/i.test(word[i])) out += word[i];
    else out += show.has(i) ? word[i] : "_";
  }
  return out;
}

// ── снимок состояния для конкретного игрока ───────────────────────────
function playersView(room) {
  return [...room.players.values()]
    .map((p) => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      score: p.score,
      online: p.sockets.size > 0,
      guessed: room.guessedThisRound.has(p.id),
      drawing: p.id === room.drawerId,
      isHost: p.id === room.hostId,
      awarded: room.awards ? room.awards.get(p.id) ?? 0 : 0, // начислено points (на финале)
    }))
    .sort((a, b) => b.score - a.score);
}

function stateFor(room, userId) {
  const iAmDrawer = userId === room.drawerId;
  const iGuessed = room.guessedThisRound.has(userId);
  // Полное слово видят рисующий и уже угадавшие; и всегда на показе результата.
  const revealWord = iAmDrawer || iGuessed || room.status === "roundend" || room.status === "gameover";
  return {
    code: room.code,
    status: room.status,
    round: room.round,
    totalRounds: room.totalRounds,
    hostId: room.hostId,
    drawerId: room.drawerId,
    players: playersView(room),
    word: revealWord ? room.word : null,
    maskedWord: room.word ? maskWord(room.word, iAmDrawer || iGuessed ? room.word.length : room.revealed) : null,
    wordLength: room.word ? room.word.length : 0,
    turnEndsAt: room.turnEndsAt,
    canDraw: iAmDrawer && room.status === "playing",
  };
}

export function attachGame(io, { pool, userIdFromCookie }) {
  const nsp = io.of("/game");

  // Данные публичного профиля для скорборда (ник/аватар).
  async function getPublicUser(userId) {
    try {
      const { rows } = await pool.query(
        `SELECT username, avatar, "shortId" FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      const u = rows[0];
      return {
        username: u?.username ?? "anon",
        avatar: u?.avatar ?? null,
        shortId: u?.shortId ?? null,
      };
    } catch {
      return { username: "anon", avatar: null, shortId: null };
    }
  }

  // Рассылка персонализированного состояния каждому сокету комнаты.
  function broadcastState(room) {
    for (const p of room.players.values()) {
      for (const sid of p.sockets) {
        nsp.to(sid).emit("game:state", stateFor(room, p.id));
      }
    }
  }

  function sysMessage(room, text, tone = "sys") {
    nsp.to(`room:${room.code}`).emit("game:chat", { tone, text, at: Date.now() });
  }

  function clearTimers(room) {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    if (room.chooseTimer) clearTimeout(room.chooseTimer);
    if (room.revealTimer) clearInterval(room.revealTimer);
    room.turnTimer = room.chooseTimer = room.revealTimer = null;
  }

  function deleteRoom(room) {
    clearTimers(room);
    if (room.emptyTimer) clearTimeout(room.emptyTimer);
    rooms.delete(room.code);
  }

  // ── жизненный цикл хода ──────────────────────────────────────────────
  function beginTurn(room) {
    clearTimers(room);
    room.guessedThisRound = new Set();
    room.strokes = [];
    room.revealed = 0;
    room.word = null;
    room.status = "choosing";

    const order = room.order;
    if (room.turnIndex >= order.length) {
      room.turnIndex = 0;
      room.round += 1;
    }
    if (room.round > room.totalRounds) return endGame(room);

    // Найти следующего ПРИСУТСТВУЮЩЕГО игрока как рисующего.
    let tries = 0;
    while (tries < order.length) {
      const cand = order[room.turnIndex];
      const p = room.players.get(cand);
      if (p && p.sockets.size > 0) break;
      room.turnIndex += 1;
      tries += 1;
      if (room.turnIndex >= order.length) {
        room.turnIndex = 0;
        room.round += 1;
        if (room.round > room.totalRounds) return endGame(room);
      }
    }
    const drawerId = order[room.turnIndex];
    const drawer = room.players.get(drawerId);
    if (!drawer || drawer.sockets.size === 0) {
      // некому рисовать — заканчиваем
      return endGame(room);
    }
    room.drawerId = drawerId;
    room.choices = pickWords(WORD_CHOICES);

    nsp.to(`room:${room.code}`).emit("game:clear");
    broadcastState(room);
    sysMessage(room, `${drawer.username} выбирает слово…`);
    // Предложить слова рисующему.
    for (const sid of drawer.sockets) {
      nsp.to(sid).emit("game:choices", { words: room.choices });
    }
    // Не выбрал за CHOOSE_SECONDS — берём первое.
    room.chooseTimer = setTimeout(() => {
      if (room.status === "choosing") startDrawing(room, room.choices[0]);
    }, CHOOSE_SECONDS * 1000);
  }

  function startDrawing(room, word) {
    if (!word) return;
    clearTimers(room);
    room.word = word;
    room.status = "playing";
    room.revealed = 0;
    room.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
    broadcastState(room);
    sysMessage(room, "рисуй! остальные — угадывайте в чате.");

    room.turnTimer = setTimeout(() => endTurn(room, "time"), TURN_SECONDS * 1000);

    // Постепенно открываем буквы (до половины слова) во второй половине хода.
    const letters = room.word.replace(/[^a-zа-яё0-9]/gi, "").length;
    const maxReveal = Math.max(0, Math.floor(letters / 2));
    room.revealTimer = setInterval(() => {
      if (room.status !== "playing") return;
      const left = room.turnEndsAt - Date.now();
      const elapsedFrac = 1 - left / (TURN_SECONDS * 1000);
      const target = Math.min(maxReveal, Math.floor(elapsedFrac * 2 * maxReveal));
      if (target > room.revealed) {
        room.revealed = target;
        broadcastState(room);
      }
    }, 3000);
  }

  function everyoneGuessed(room) {
    const eligible = [...room.players.values()].filter(
      (p) => p.id !== room.drawerId && p.sockets.size > 0,
    );
    return eligible.length > 0 && eligible.every((p) => room.guessedThisRound.has(p.id));
  }

  function endTurn(room, reason) {
    if (room.status !== "playing") return;
    clearTimers(room);
    room.status = "roundend";
    const drawer = room.players.get(room.drawerId);
    sysMessage(
      room,
      reason === "all"
        ? `все угадали! слово было «${room.word}»`
        : `время вышло! слово было «${room.word}»`,
      "reveal",
    );
    if (drawer) sysMessage(room, `${drawer.username} рисовал «${room.word}»`);
    broadcastState(room);

    room.turnIndex += 1;
    room.turnTimer = setTimeout(() => beginTurn(room), ROUNDEND_SECONDS * 1000);
  }

  // Начислить реальные User.points по итогам партии (Фаза 5). База — за
  // внутриигровой счёт, плюс бонус за топ-3. Пишем прямо в БД (pg есть в сервисе).
  async function awardPoints(room) {
    const ranked = playersView(room).filter((p) => p.score > 0); // уже отсортированы по убыванию
    const bonus = [20, 10, 5];
    const awards = new Map();
    for (let i = 0; i < ranked.length; i++) {
      const total = Math.round(ranked[i].score / 10) + (i < bonus.length ? bonus[i] : 0);
      if (total > 0) awards.set(ranked[i].id, total);
    }
    room.awards = awards;
    for (const [userId, pts] of awards) {
      try {
        await pool.query(`UPDATE users SET points = points + $1 WHERE id = $2`, [pts, userId]);
      } catch (e) {
        console.error("[game] award points failed:", e.message);
      }
    }
  }

  async function endGame(room) {
    clearTimers(room);
    room.status = "gameover";
    room.drawerId = null;
    room.word = null;
    await awardPoints(room); // заполнит room.awards до рассылки финала
    const winner = playersView(room)[0];
    broadcastState(room);
    if (winner && winner.score > 0) {
      sysMessage(room, `игра окончена — победил ${winner.username}: ${winner.score} очк.! 🏆`, "reveal");
    } else {
      sysMessage(room, "игра окончена", "reveal");
    }
  }

  // ── аутентификация namespace ─────────────────────────────────────────
  nsp.use(async (socket, next) => {
    const userId = await userIdFromCookie(socket.handshake.headers.cookie);
    if (!userId) return next(new Error("unauthorized"));
    socket.data.userId = userId;
    const prof = await getPublicUser(userId);
    socket.data.profile = prof;
    next();
  });

  nsp.on("connection", (socket) => {
    const userId = socket.data.userId;
    const profile = socket.data.profile;
    let joinedCode = null;

    function getRoom() {
      return joinedCode ? rooms.get(joinedCode) : null;
    }

    // Создать комнату → вернуть код.
    socket.on("game:create", (_p, ack) => {
      const code = genCode();
      const room = {
        code,
        hostId: userId,
        players: new Map(),
        order: [],
        status: "lobby",
        round: 1,
        totalRounds: TOTAL_ROUNDS,
        turnIndex: 0,
        drawerId: null,
        word: null,
        choices: [],
        revealed: 0,
        guessedThisRound: new Set(),
        strokes: [],
        turnEndsAt: 0,
        turnTimer: null,
        chooseTimer: null,
        revealTimer: null,
        emptyTimer: null,
      };
      rooms.set(code, room);
      if (typeof ack === "function") ack({ ok: true, code });
    });

    // Войти в комнату по коду.
    socket.on("game:join", (raw, ack) => {
      const code = String(raw?.code ?? "").toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) {
        if (typeof ack === "function") ack({ ok: false, error: "комната не найдена" });
        return;
      }
      const existing = room.players.get(userId);
      if (!existing && room.players.size >= MAX_PLAYERS) {
        if (typeof ack === "function") ack({ ok: false, error: "комната заполнена" });
        return;
      }
      if (room.emptyTimer) {
        clearTimeout(room.emptyTimer);
        room.emptyTimer = null;
      }
      joinedCode = code;
      socket.join(`room:${code}`);

      let player = existing;
      if (!player) {
        player = {
          id: userId,
          username: profile.username,
          avatar: profile.avatar,
          score: 0,
          sockets: new Set(),
        };
        room.players.set(userId, player);
        // Новых игроков ставим в конец очереди ходов.
        if (!room.order.includes(userId)) room.order.push(userId);
        sysMessage(room, `${player.username} зашёл`);
      }
      player.sockets.add(socket.id);

      if (typeof ack === "function") ack({ ok: true, code });
      // Догрузить текущий рисунок присоединившемуся.
      if (room.strokes.length) socket.emit("game:strokes", room.strokes);
      broadcastState(room);
    });

    // Хост запускает партию. Может задать число раундов { rounds }.
    socket.on("game:start", (raw) => {
      const room = getRoom();
      if (!room || room.hostId !== userId) return;
      const present = [...room.players.values()].filter((p) => p.sockets.size > 0);
      if (present.length < 2) {
        socket.emit("game:chat", { tone: "sys", text: "нужно минимум 2 игрока", at: Date.now() });
        return;
      }
      if (room.status !== "lobby" && room.status !== "gameover") return;
      // Сброс на новую партию.
      const rounds = Math.round(Number(raw?.rounds));
      room.totalRounds = Number.isFinite(rounds)
        ? Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, rounds))
        : room.totalRounds || TOTAL_ROUNDS;
      for (const p of room.players.values()) p.score = 0;
      room.awards = null;
      room.order = [...room.players.keys()];
      room.round = 1;
      room.turnIndex = 0;
      beginTurn(room);
    });

    // Хост меняет число раундов в лобби (для всех видно).
    socket.on("game:setrounds", (raw) => {
      const room = getRoom();
      if (!room || room.hostId !== userId) return;
      if (room.status !== "lobby" && room.status !== "gameover") return;
      const rounds = Math.round(Number(raw?.rounds));
      if (!Number.isFinite(rounds)) return;
      room.totalRounds = Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, rounds));
      broadcastState(room);
    });

    // Рисующий выбрал слово.
    socket.on("game:choose", (raw) => {
      const room = getRoom();
      if (!room || room.status !== "choosing" || room.drawerId !== userId) return;
      const word = String(raw?.word ?? "");
      if (!room.choices.includes(word)) return;
      startDrawing(room, word);
    });

    // Операция рисования (только текущий рисующий). Реле остальным + копим.
    socket.on("game:draw", (op) => {
      const room = getRoom();
      if (!room || room.status !== "playing" || room.drawerId !== userId) return;
      if (!op || typeof op !== "object") return;
      // Анти-флуд: ~160 операций/сек хватает для плавной линии, но режет спам.
      if (!sockLimit(socket, "draw", 800, 5000)) return;
      if (room.strokes.length < MAX_STROKE_OPS) room.strokes.push(op);
      socket.to(`room:${room.code}`).emit("game:draw", op);
    });

    // Очистить холст (рисующий).
    socket.on("game:clear", () => {
      const room = getRoom();
      if (!room || room.status !== "playing" || room.drawerId !== userId) return;
      room.strokes = [];
      nsp.to(`room:${room.code}`).emit("game:clear");
    });

    // Догадка/чат во время игры.
    socket.on("game:guess", (raw) => {
      const room = getRoom();
      if (!room) return;
      // Анти-флуд чата/догадок: не больше 12 сообщений за 5с на сокет.
      if (!sockLimit(socket, "guess", 12, 5000)) return;
      const text = String(raw?.text ?? "").slice(0, 120);
      if (!text.trim()) return;
      const player = room.players.get(userId);
      if (!player) return;

      // Рисующий и уже угадавшие не «угадывают» — это обычный чат.
      const canGuess =
        room.status === "playing" &&
        userId !== room.drawerId &&
        !room.guessedThisRound.has(userId);

      if (canGuess) {
        const guess = normalizeGuess(text);
        const answer = normalizeGuess(room.word);
        if (guess === answer) {
          room.guessedThisRound.add(userId);
          // Очки: больше за скорость; рисующему — за каждого угадавшего.
          const left = Math.max(0, room.turnEndsAt - Date.now());
          const frac = left / (TURN_SECONDS * 1000);
          player.score += Math.round(50 + 250 * frac);
          const drawer = room.players.get(room.drawerId);
          if (drawer) drawer.score += 25;
          sysMessage(room, `${player.username} угадал слово! ✅`, "correct");
          broadcastState(room);
          if (everyoneGuessed(room)) endTurn(room, "all");
          return;
        }
        // Подсказка «горячо/холодно» — только самому угадывающему.
        const dist = levenshtein(guess, answer);
        const ratio = dist / Math.max(answer.length, 1);
        if (ratio <= 0.25 || (guess.length >= 3 && answer.includes(guess))) {
          socket.emit("game:hint", { level: "hot", text: "🔥 очень близко!" });
        } else if (ratio <= 0.5) {
          socket.emit("game:hint", { level: "warm", text: "теплее…" });
        }
      }

      // Обычное сообщение в чат комнаты.
      nsp.to(`room:${room.code}`).emit("game:chat", {
        tone: room.guessedThisRound.has(userId) ? "guessed" : "user",
        from: player.username,
        text,
        at: Date.now(),
      });
    });

    // Покинуть комнату / отключиться.
    function leave() {
      const room = getRoom();
      if (!room) return;
      const player = room.players.get(userId);
      if (player) {
        player.sockets.delete(socket.id);
        if (player.sockets.size === 0) {
          // Если рисующий ушёл — завершаем ход.
          if (room.drawerId === userId && room.status === "playing") {
            sysMessage(room, `${player.username} (рисующий) вышел`);
            endTurn(room, "time");
          } else {
            sysMessage(room, `${player.username} вышел`);
          }
          // Хост ушёл — передать первому присутствующему.
          if (room.hostId === userId) {
            const next = [...room.players.values()].find((p) => p.sockets.size > 0);
            if (next) room.hostId = next.id;
          }
          broadcastState(room);
        }
      }
      // Никого онлайн — отложенно удалить комнату.
      const anyOnline = [...room.players.values()].some((p) => p.sockets.size > 0);
      if (!anyOnline) {
        room.emptyTimer = setTimeout(() => deleteRoom(room), EMPTY_ROOM_TTL);
      }
      socket.leave(`room:${room.code}`);
      joinedCode = null;
    }

    socket.on("game:leave", leave);
    socket.on("disconnect", leave);
  });
}
