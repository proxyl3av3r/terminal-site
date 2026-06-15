// Auth.js монтирует свои эндпоинты (signin/signout/session/csrf/callback)
// сюда. Логика — в src/lib/auth.ts.
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
