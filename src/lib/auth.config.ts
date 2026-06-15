import type { NextAuthConfig } from "next-auth";

// Edge-safe часть конфига Auth.js: НИКАКИХ argon2/Prisma здесь — этот файл
// импортируется в middleware, который крутится в Edge-рантайме.
// Тяжёлый credentials-провайдер добавляется в src/lib/auth.ts.
export const authConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/", // вход — через терминальный оверлей на главной
  },
  providers: [], // заполняется в auth.ts
  callbacks: {
    // Защита роутов. Вызывается и из middleware (по matcher).
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const onDashboard = request.nextUrl.pathname.startsWith("/dashboard");
      if (onDashboard) return isLoggedIn; // не залогинен → редирект на signIn
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id as string;
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
