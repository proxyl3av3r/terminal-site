import { db } from "@/lib/db";

export const MAX_TEXT = 2000;
export const MAX_ASCII = 12000;

/** Статус участия (accepted/pending) или null, если не участник. */
export async function memberState(
  conversationId: string,
  userId: string,
): Promise<string | null> {
  const m = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { state: true },
  });
  return m?.state ?? null;
}

/** Состоит ли пользователь в диалоге (любой статус). */
export async function isMember(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  return (await memberState(conversationId, userId)) !== null;
}

/**
 * Найти существующий DM двух пользователей или создать новый как ЗАПРОС.
 * initiator — accepted, target — pending (пока не примет, общаться нельзя).
 * `created` = true, если диалог только что создан (тогда target получит запрос).
 */
export async function findOrCreateDM(
  initiator: string,
  target: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await db.conversation.findFirst({
    where: {
      isGroup: false,
      AND: [
        { members: { some: { userId: initiator } } },
        { members: { some: { userId: target } } },
      ],
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const convo = await db.conversation.create({
    data: {
      isGroup: false,
      members: {
        create: [
          { userId: initiator, state: "accepted" },
          { userId: target, state: "pending" },
        ],
      },
    },
    select: { id: true },
  });
  return { id: convo.id, created: true };
}
