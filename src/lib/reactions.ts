// Эмодзи-реакции на сообщения чата. Белый список + агрегация (client-safe,
// шарится клиентом и сервером — сервер валидирует emoji по этому списку,
// чтобы в БД не попадал произвольный текст).

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🔥", "😮", "😢", "🙏", "💀"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isAllowedReaction(emoji: string): boolean {
  return (REACTION_EMOJIS as readonly string[]).includes(emoji);
}

export interface RawReaction {
  emoji: string;
  userId: string;
}
export interface ReactionAgg {
  emoji: string;
  count: number;
  mine: boolean; // среди реакций есть моя
}

/** Свернуть сырые реакции в счётчики по эмодзи (в порядке REACTION_EMOJIS). */
export function aggregateReactions(
  reactions: RawReaction[],
  meId: string,
): ReactionAgg[] {
  const map = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const cur = map.get(r.emoji) ?? { count: 0, mine: false };
    cur.count++;
    if (r.userId === meId) cur.mine = true;
    map.set(r.emoji, cur);
  }
  return REACTION_EMOJIS.filter((e) => map.has(e)).map((e) => ({
    emoji: e,
    count: map.get(e)!.count,
    mine: map.get(e)!.mine,
  }));
}
