# klebold.xyz — контекст проекта (handoff для нового чата)

Личный именной сайт в эстетике homebrew-терминала + соц-функции (мессенджер,
аватары, игры). Этот файл — полный контекст, чтобы продолжить в новом чате.

---

## Координаты

- **Домен:** `klebold.xyz` (DNS — Cloudflare; A-запись должна быть **DNS only / серое облако** для certbot)
- **Репозиторий:** `github.com/proxyl3av3r/terminal-site` (на VPS remote по HTTPS)
- **Локально (Mac):** `/Users/borys.korliakov/Documents/Claude/terminal-site`
- **VPS:** `~/terminal-site` (root@vps-bed5c1e6). 2 vCPU, 1.9 GB RAM, +2 GB swap. На VPS крутятся ещё проекты (tgbot, linkcatcher, striketech) — память общая.
- **Почта:** Resend, домен `send.klebold.xyz` верифицирован. From: `klebold.xyz <noreply@send.klebold.xyz>`.
- **Spotify:** приложение в **dev-mode** (макс 25 whitelisted аккаунтов в User Management).

## Стек
Next.js **14.2.35** (App Router, TS) · Prisma + Postgres · Auth.js v5 (**JWT-сессии**) ·
argon2 · otplib (2FA TOTP) · nodemailer (SMTP/Resend) · Tailwind v3 · Docker (output: **standalone**).

## Рабочий процесс (ВАЖНО)
Код пишется на Mac. Я (ассистент) редактирую файлы напрямую, проверяю `npx tsc --noEmit`.
Деплой:
```bash
# Mac
cd /Users/borys.korliakov/Documents/Claude/terminal-site
git add -A && git commit -m "…" && git push
# VPS
cd ~/terminal-site && git pull && docker compose up -d --build
```
Миграции применяет сервис `migrate` в docker-compose автоматически.
`.env` — только на VPS (в git его нет, gitignored).

## Env-переменные (.env на VPS)
`POSTGRES_USER/PASSWORD/DB`, `DATABASE_URL` (host=`db`), `AUTH_SECRET`, `AUTH_URL=https://klebold.xyz`,
`SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM`, `SITE_NAME`, `TOKEN_ENC_KEY` (AES для Spotify-токенов),
`SPOTIFY_CLIENT_ID/SECRET/REDIRECT_URI`, `REALTIME_SECRET` (общий секрет app↔realtime, `openssl rand -hex 32`).
App также получает `REALTIME_INTERNAL_URL` (= `http://realtime:4000`, задаётся в docker-compose).

---

## Что уже сделано

**Главная (публичная):** canvas «matrix» (тема-зависимый цвет, реакция на курсор, `matrix`-буст),
typewriter-заголовок, публичный CLI (`about/projects/skills/contact/social/neofetch/whoami/theme/
sound/matrix/login/...`), easter eggs (`sudo`, Konami-код), темы (green/amber/mono/ice, localStorage,
применяются инлайн-скриптом до отрисовки), звук клавиш, boot-анимация (первый визит), секретный вход
`$ access _`, тапабельные команды-чипы (для мобилы), параллакс.

**Auth:** регистрация + верификация email (Resend), вход, **2FA** (TOTP + 10 backup-кодов),
**сброс пароля** (`forgot`/`reset`). Credentials + argon2id, JWT-сессии, анти-enumeration, rate-limit.
Терминальная консоль входа (`TerminalConsole`) — многошаговый REPL.

**Dashboard** (защищён middleware + серверная проверка):
- Профиль: `username` (уникальный) + `shortId` (6 цифр) — для приглашений.
- Аватар: кастомный SVG-«робот» (цвет/фон/глаза/рот), часть опций locked под очки (`points`).
- `img2ascii`: картинка → ASCII (в браузере, на сервер не уходит).
- Settings: профиль + 2FA setup/disable/backup-коды.
- Spotify now-playing (per-user, refresh-токен **шифруется** AES-256-GCM в БД, scope только
  `user-read-currently-playing`, CSRF на callback).
- Виджеты: online-счётчик (in-memory presence), эквалайзер (декоративный).

**Чат (мессенджер):**
- DM и группы (`Conversation`/`ConversationMember`/`Message`). Создание групп — из модалки
  `NewChat` (режим group: имя + участники), в списке у групп иконка-заглушка `#`.
- **Система запросов:** новый DM = pending у получателя; вкладка `requests` → accept/decline;
  писать нельзя пока не accepted.
- Сообщения: text + **ASCII-картинки** (кнопка `▤`, конверт в браузере, хранится текстом).
- Бейдж непрочитанных (+ запросы) на пункте chat.
- Поиск по `@нику`/`#id`/email (без утечки чужой почты).
- **Realtime (Socket.IO):** мгновенная доставка, **онлайн-статус** (зелёная точка/`N online`),
  **«typing…»**. Отдельный контейнер `realtime` (см. ниже). Поллинг остался редким
  страховочным fallback (диалоги 20с, активная переписка 25с, бейдж 30с). Умная
  авто-прокрутка (только если внизу).

**Мобильная адаптация:** десктоп — сайдбар; мобила — верхняя плашка + нижний таб-бар; чат
одно-панельный с «назад»; viewport/theme-color; iOS-zoom фикс (поля 16px на мобиле); safe-area.

**Безопасность:** CSP + HSTS + X-Frame/nosniff/COOP, rate-limiting, argon2, шифрование Spotify-токенов,
проверка участия в чатах, секреты только в .env. Контейнер от непривилегированного юзера.

---

## Ключевые решения и подводные камни
- **JWT-сессии** (не БД): credentials-провайдер Auth.js не умеет DB-сессии. Таблицы `Session`/`Account`
  в схеме есть, но не используются.
- **Realtime для чата — РЕАЛИЗОВАНО:** свой WebSocket (Socket.IO) отдельным контейнером `realtime`
  за Nginx (`location /socket.io/` → `:4000`, идёт ДО `location /`). Архитектура: REST остаётся
  источником истины (запись/валидация/rate-limit в Next-ручках), после записи app дёргает внутренний
  `POST /emit` realtime-сервиса (по `REALTIME_SECRET`), тот рассылает по комнатам. Комнаты:
  `user:<id>` (список/бейджи/запросы) и `conv:<id>` (сообщения/typing/presence). Аутентификация
  сокета — декод next-auth JWT из cookie (`@auth/core/jwt`, salt = имя cookie). Сервис тонкий: без
  Next/Prisma, `pg` только для проверки членства при входе в комнату. Presence «scoped» к открытым
  диалогам (privacy). **Игра (Фаза 4)** переиспользует этот же сервис. Swap добавлен под запас памяти.
- **ASCII-картинки** хранятся текстом (никакого бинаря на сервере). Лимиты: text 2000, ascii 12000.
- **next.config** — только `.mjs` (на Next 14 `.ts` не поддерживается). argon2 в
  `experimental.serverComponentsExternalPackages`.
- **Dockerfile:** в runner-стадии явно копируется `node_modules/argon2` (standalone-трассировка
  пропускает нативный `.node`). `output: "standalone"`.
- **Миграции** писались вручную (SQL) — локальной БД нет; имена папок с таймстампом, чтобы шли
  после `0_init`. Prisma client после правки схемы: `DATABASE_URL=… npx prisma generate` из папки проекта.
- **Темы:** `--accent` как RGB-каналы в CSS, tailwind `accent: rgb(var(--accent)/<alpha>)`.
- Был мусорный вложенный `terminal-site/` (gitlink) — удалён. `tsconfig.tsbuildinfo` в gitignore.
- Cloudflare-прокси у A-записи может ломать certbot и (с VPN) Spotify OAuth.

---

## Роадмап (что дальше)
1. ✅ ~~**3c — WebSocket realtime**~~ — СДЕЛАНО (Socket.IO, контейнер `realtime`, typing, онлайн-статус,
   мгновенная доставка). Деплой: добавить `REALTIME_SECRET` в `.env` на VPS + обновить nginx-конфиг
   (`location /socket.io/`). Подробности — в «Ключевых решениях».
2. **Стикеры** — набор готовых ASCII-артов (эмодзи уже работают как юникод-текст).
3. ✅ ~~**UI создания групп**~~ — СДЕЛАНО (в модалке `NewChat` переключатель direct/group: имя +
   выбор участников по @нику/#id/email, чипы участников). Бэкенд `isGroup` был готов; группы
   создаются сразу как accepted (без запроса), участники получают realtime-`bump`.
4. **Фаза 4 — игра рисовалка-угадайка:** комнаты по ссылке/id, холст с цветами, чат сбоку, логика
   слова, подсказки «горячо/холодно». Realtime — переиспользовать сервис `realtime/` (добавить
   game-namespace/события, источник истины — также Next-ручки или сам сервис).
5. **Фаза 5 — очки и разблокировки:** победы дают `points` → открывают locked-опции аватара
   (в `lib/avatar.ts` у опций есть `cost`).
6. **Серверный харденинг (осталось):** SSH только по ключу (добавить ключ Windows-машины перед
   отключением пароля!), fail2ban, `ufw enable`, unattended-upgrades, опц. Cloudflare-прокси.

## Структура (основное)
```
src/app/            — страницы (home, dashboard/*, api/*)
src/components/      — home/, terminal/, chat/, dashboard/, avatar/, canvas/
src/lib/            — auth, db, email, tokens, 2fa, ratelimit, crypto, spotify,
                      profile, avatar, chat, ascii, realtime (server→socket),
                      socket (client singleton socket.io-client)
realtime/           — отдельный Socket.IO-сервис (server.mjs, Dockerfile) — свой контейнер
prisma/             — schema.prisma + migrations/
Dockerfile, docker-compose.yml, deploy/nginx.conf.example, DEPLOY.md
```
Деплой и «руками» — см. `DEPLOY.md`.
