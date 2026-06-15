import type { DefaultSession } from "next-auth";

// Добавляем user.id в тип сессии (по умолчанию его там нет).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
