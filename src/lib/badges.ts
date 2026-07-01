// Реестр значков/ачивок. Чистый модуль (без БД) — импортится и клиентом
// (для отображения), и сервером (для выдачи через lib/award.ts).
//   kind "achievement" — выдаётся автоматически за действие, даёт points.
//   kind "manual"      — выдаёт супер-админ из админки (developer / first-member).

export type BadgeKind = "achievement" | "manual";

export interface BadgeDef {
  key: string;
  label: string;
  glyph: string; // короткий символ рядом с ником
  color: string; // цвет значка (hex)
  points: number; // начисляется при первой выдаче (для manual = 0)
  kind: BadgeKind;
  desc: string; // тултип / описание
}

export const BADGES: Record<string, BadgeDef> = {
  // ── ручные (выдаёт админ) ──
  developer: {
    key: "developer",
    label: "developer",
    glyph: "</>",
    color: "#39ff14",
    points: 0,
    kind: "manual",
    desc: "core developer of bash-app.com",
  },
  "first-member": {
    key: "first-member",
    label: "first member",
    glyph: "★",
    color: "#ffb000",
    points: 0,
    kind: "manual",
    desc: "one of the first real members",
  },

  // ── ачивки (авто) ──
  verified: {
    key: "verified",
    label: "verified",
    glyph: "✓",
    color: "#39ff14",
    points: 5,
    kind: "achievement",
    desc: "confirmed email",
  },
  nickname: {
    key: "nickname",
    label: "named",
    glyph: "@",
    color: "#7fd1ff",
    points: 5,
    kind: "achievement",
    desc: "picked a username",
  },
  avatar: {
    key: "avatar",
    label: "face",
    glyph: "☺",
    color: "#ff8bd1",
    points: 10,
    kind: "achievement",
    desc: "customized the avatar",
  },
  "two-factor": {
    key: "two-factor",
    label: "secured",
    glyph: "⚿",
    color: "#ffb000",
    points: 15,
    kind: "achievement",
    desc: "enabled two-factor auth",
  },
  spotify: {
    key: "spotify",
    label: "tuned in",
    glyph: "♪",
    color: "#1db954",
    points: 10,
    kind: "achievement",
    desc: "connected Spotify",
  },
  "first-message": {
    key: "first-message",
    label: "hello world",
    glyph: "✉",
    color: "#7fd1ff",
    points: 5,
    kind: "achievement",
    desc: "sent the first message",
  },
  "group-founder": {
    key: "group-founder",
    label: "founder",
    glyph: "#",
    color: "#c8a6ff",
    points: 10,
    kind: "achievement",
    desc: "created a group or channel",
  },
};

export const badgeDef = (key: string): BadgeDef | undefined => BADGES[key];

// Порядок отображения: ручные значки впереди, затем по убыванию «веса».
const ORDER = ["developer", "first-member"];
export function sortBadgeKeys(keys: string[]): string[] {
  return [...keys]
    .filter((k) => BADGES[k])
    .sort((a, b) => {
      const ia = ORDER.indexOf(a);
      const ib = ORDER.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return BADGES[b].points - BADGES[a].points;
    });
}

export const MANUAL_BADGES = Object.values(BADGES).filter((b) => b.kind === "manual");
