import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";

import { db } from "@/lib/db";
import { verifyTOTP } from "@/lib/2fa";
import { authConfig } from "@/lib/auth.config";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// ── Кастомные ошибки входа ────────────────────────────────────────────
// В Auth.js v5 у CredentialsSignin есть поле `code`, которое долетает до
// клиента (result.error). По нему фронт-терминал понимает, что показать.

class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}
class EmailNotVerified extends CredentialsSignin {
  code = "email_not_verified";
}
class TwoFactorRequired extends CredentialsSignin {
  code = "2fa_required";
}
class InvalidTwoFactor extends CredentialsSignin {
  code = "invalid_2fa";
}
class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

// Фиктивный argon2-хеш для выравнивания времени ответа, когда аккаунта нет:
// иначе «нет юзера» возвращается мгновенно, а «есть, но неверный пароль» —
// после медленного argon2.verify, что выдаёт существование аккаунта (timing-
// enumeration). Считаем один раз лениво и кешируем.
let dummyHashP: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  if (!dummyHashP) {
    dummyHashP = argon2.hash("timing-equalizer-not-a-real-password", {
      type: argon2.argon2id,
    });
  }
  return dummyHashP;
}

/**
 * Проверка второго фактора при входе: сначала TOTP, затем — одноразовые
 * backup-коды. Использованный backup-код помечается usedAt (повторно нельзя).
 */
async function verifySecondFactor(
  userId: string,
  secret: string,
  code: string,
): Promise<boolean> {
  const normalized = code.replace(/\s+/g, "");

  // 1) TOTP из приложения-аутентификатора
  if (verifyTOTP(normalized, secret)) return true;

  // 2) backup-код (формат хранится хешем argon2). Перебираем неиспользованные.
  const candidates = await db.backupCode.findMany({
    where: { userId, usedAt: null },
  });
  for (const bc of candidates) {
    if (await argon2.verify(bc.codeHash, normalized)) {
      await db.backupCode.update({
        where: { id: bc.id },
        data: { usedAt: new Date() },
      });
      return true;
    }
  }
  return false;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "email", type: "email" },
        password: { label: "password", type: "password" },
        totp: { label: "totp", type: "text" },
      },
      async authorize(creds, request) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        const totp = String(creds?.totp ?? "");

        // ── Анти-брутфорс: лимит попыток входа по IP и по email ──
        // (До этого вход не лимитировался — можно было перебирать пароли и
        // 6-значные TOTP-коды без ограничений.)
        const ip = request ? clientIp(request as unknown as Request) : "unknown";
        if (!rateLimit(`login:ip:${ip}`, 30, 15 * 60 * 1000).success) {
          throw new TooManyAttempts();
        }
        if (email && !rateLimit(`login:email:${email}`, 10, 15 * 60 * 1000).success) {
          throw new TooManyAttempts();
        }

        if (!email || !password) throw new InvalidCredentials();

        const user = await db.user.findUnique({ where: { email } });
        // Один и тот же отказ при «нет юзера» и «неверный пароль» — чтобы не
        // раскрывать существование аккаунта. Когда юзера нет, всё равно гоняем
        // argon2.verify по фиктивному хешу: выравниваем время ответа (timing).
        if (!user?.passwordHash) {
          await argon2.verify(await dummyHash(), password).catch(() => {});
          throw new InvalidCredentials();
        }

        const ok = await argon2.verify(user.passwordHash, password);
        if (!ok) throw new InvalidCredentials();

        if (!user.emailVerified) throw new EmailNotVerified();

        if (user.twoFactorEnabled && user.twoFactorSecret) {
          if (!totp) throw new TwoFactorRequired();
          const valid = await verifySecondFactor(
            user.id,
            user.twoFactorSecret,
            totp,
          );
          if (!valid) throw new InvalidTwoFactor();
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
