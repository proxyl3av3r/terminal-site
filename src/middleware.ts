import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Лёгкий инстанс Auth.js только для проверки токена в Edge-рантайме.
// Логика «пускать/не пускать» — в callbacks.authorized (auth.config.ts).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Защищаем раздел панели. API-ручки 2FA проверяют сессию сами (отдают 401).
  matcher: ["/dashboard/:path*"],
};
