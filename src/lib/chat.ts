import { db } from "@/lib/db";

export const MAX_TEXT = 2000;
export const MAX_ASCII = 12000;

/** Состоит ли пользователь в диалоге (доступ к чтению/записи). */
export async function isMember(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const m = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
  return !!m;
}

/**
 * Найти существующий DM двух пользователей или создать новый.
 * DM — не группа, ровно 2 участника.
 */
export async function findOrCreateDM(
  a: string,
  b: string,
): Promise<string> {
  // Кандидаты: непgroup-диалоги, где есть оба.
  const existing = await db.conversation.findFirst({
    where: {
      isGroup: false,
      AND: [
        { members: { some: { userId: a } } },
        { members: { some: { userId: b } } },
      ],
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const convo = await db.conversation.create({
    data: {
      isGroup: false,
      members: { create: [{ userId: a }, { userId: b }] },
    },
    select: { id: true },
  });
  return convo.id;
}
