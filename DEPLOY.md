# Развёртывание

Два режима: **локальная разработка** и **прод на VPS (Docker + Nginx)**.

---

## 0. Что понадобится подготовить руками

| Что | Зачем |
|---|---|
| Postgres | хранит пользователей, токены, 2FA |
| Gmail App Password | отправка писем верификации |
| `AUTH_SECRET` | подпись сессий |

---

## 1. Локальная разработка (на Mac)

### 1.1. Postgres локально
Самый простой путь — поднять только БД через Docker:
```bash
docker run --name pg-terminal -e POSTGRES_USER=terminal \
  -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=terminal_site \
  -p 5432:5432 -d postgres:16-alpine
```
(или используйте уже установленный Postgres).

### 1.2. .env
```bash
cp .env.example .env
```
Заполни:
- `DATABASE_URL` — для локали с **localhost**:
  `postgresql://terminal:devpass@localhost:5432/terminal_site?schema=public`
- `AUTH_SECRET` — сгенерируй: `openssl rand -hex 32`
- `AUTH_URL="http://localhost:3000"`
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` — см. раздел 3.

### 1.3. Зависимости, миграции, запуск
```bash
npm install
npx prisma migrate dev      # создаст таблицы + применит миграцию
npm run dev                 # http://localhost:3000
```

### 1.4. Проверка вживую
1. Открой главную → найди `_` внизу справа (или Ctrl+`) → консоль.
2. `register` → email + пароль → проверь почту → перейди по ссылке.
3. `login` → войдёшь в `/dashboard`.
4. `settings` → включи 2FA (QR в Google Authenticator/Bitwarden) → сохрани backup-коды.
5. Выйди, войди снова — теперь спросит код 2FA.

---

## 2. Postgres на VPS

Вариант по умолчанию — **Postgres в docker-compose** (поднимается сам, раздел 5).
Отдельно ставить ничего не нужно: сервис `db` создаст БД и том `pgdata`.

> Если у тебя уже есть внешний Postgres — не запускай сервис `db`, просто
> укажи его адрес в `DATABASE_URL` (host = IP/домен БД, а не `db`).

---

## 3. Gmail App Password (для SMTP)

1. Включи **2-Step Verification**: https://myaccount.google.com/security
2. Открой **App passwords**: https://myaccount.google.com/apppasswords
3. Создай пароль (название любое, напр. `terminal-site`) → получишь **16 символов**.
4. Впиши в `.env`:
   - `GMAIL_USER="твой@gmail.com"`
   - `GMAIL_APP_PASSWORD="те самые 16 символов без пробелов"`

> Обычный пароль аккаунта НЕ подойдёт — нужен именно App Password.

---

## 4. Заливка в git (когда скажешь «закидываем»)

```bash
cd terminal-site
git init
git add .
git commit -m "init: terminal site"
git remote add origin git@github.com:ТВОЙ_ЛОГИН/terminal-site.git
git push -u origin main
```
`.env` в `.gitignore` — секреты в репозиторий **не уйдут** (это правильно).

---

## 5. Прод на VPS (Docker + Nginx)

### 5.1. На VPS установить Docker
```bash
curl -fsSL https://get.docker.com | sh
```

### 5.2. Забрать код и настроить .env
```bash
git clone git@github.com:ТВОЙ_ЛОГИН/terminal-site.git
cd terminal-site
cp .env.example .env
nano .env
```
В прод-`.env`:
- `POSTGRES_PASSWORD` — сильный пароль.
- `DATABASE_URL` — host = **`db`** (имя сервиса), тот же пароль:
  `postgresql://terminal:ПАРОЛЬ@db:5432/terminal_site?schema=public`
- `AUTH_SECRET` — новый `openssl rand -hex 32`.
- `AUTH_URL="https://твой-домен"`.
- `GMAIL_*`, `SITE_NAME`.

### 5.3. Запуск
```bash
docker compose up -d --build
```
Что произойдёт: поднимется Postgres → сервис `migrate` применит миграции →
стартует `app` на `127.0.0.1:3000` (наружу не торчит).

Проверка: `docker compose ps`, логи — `docker compose logs -f app`.

### 5.4. Nginx + HTTPS
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/yourname.dev
# отредактируй домен в файле, затем:
sudo ln -s /etc/nginx/sites-available/yourname.dev /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourname.dev -d www.yourname.dev
```
certbot сам пропишет пути к сертификатам и настроит автопродление.

### 5.5. Обновление после изменений
```bash
git pull
docker compose up -d --build
```
Новые миграции применятся автоматически сервисом `migrate`.

---

## Шпаргалка команд

| Действие | Команда |
|---|---|
| Локальный запуск | `npm run dev` |
| Создать миграцию | `npx prisma migrate dev --name <имя>` |
| Посмотреть БД | `npx prisma studio` |
| Прод: старт/обновление | `docker compose up -d --build` |
| Прод: логи | `docker compose logs -f app` |
| Прод: стоп | `docker compose down` |
