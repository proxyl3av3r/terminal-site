// Чистая логика ролей и прав — БЕЗ доступа к БД, чтобы импортировалась и на
// клиенте (ChatClient/ManagePanel), и на сервере (роуты через lib/chat).
//   owner(3) > admin(2) > moderator(1) > member(0)

export type Role = "owner" | "admin" | "moderator" | "member";
export type ChatKind = "dm" | "group" | "channel";

const RANK: Record<string, number> = { owner: 3, admin: 2, moderator: 1, member: 0 };
export const rank = (r: string): number => RANK[r] ?? 0;

// Роли, которые можно назначать через UI (owner — только передачей владения).
export const ASSIGNABLE_ROLES: Role[] = ["admin", "moderator", "member"];

/** Можно ли писать в чат с такой ролью. В канале — только moderator+. */
export const canPost = (kind: string, role: string): boolean =>
  kind === "channel" ? rank(role) >= RANK.moderator : true;

/** Переименовать / менять настройки чата. */
export const canRename = (role: string): boolean => rank(role) >= RANK.admin;

/** Добавлять участников / управлять invite-ссылкой. */
export const canManage = (role: string): boolean => rank(role) >= RANK.admin;

/** Удалить чат целиком: DM — любой участник; группа/канал — только owner. */
export const canDeleteConversation = (kind: string, role: string): boolean =>
  kind === "dm" ? true : role === "owner";

/** Кикнуть участника: actor строго выше target по рангу, target — не owner. */
export const canRemoveMember = (actorRole: string, targetRole: string): boolean =>
  rank(actorRole) >= RANK.moderator &&
  rank(actorRole) > rank(targetRole) &&
  targetRole !== "owner";

/** Сменить роль target на newRole. Передача владения — отдельным путём. */
export const canSetRole = (
  actorRole: string,
  targetRole: string,
  newRole: string,
): boolean => {
  if (targetRole === "owner" || newRole === "owner") return false; // только transfer
  if (!(newRole in RANK)) return false;
  if (actorRole === "owner") return true; // owner назначает любые не-owner роли
  if (actorRole === "admin")
    return rank(targetRole) < RANK.admin && rank(newRole) <= RANK.moderator;
  return false;
};

/** Удалить сообщение: своё — всегда; чужое — moderator+. */
export const canDeleteMessage = (role: string, isOwn: boolean): boolean =>
  isOwn || rank(role) >= RANK.moderator;
