// Конфиг и опции аватара. Часть вариантов «заперта» под игровые очки (Фаза 5):
// locked показываем, но выбрать нельзя без разблокировки.
//
// ВАЖНО (обратная совместимость): сохранённые конфиги хранят ИНДЕКСЫ опций, а
// разблокировки — ключи вида "color:4". Поэтому существующие опции НЕЛЬЗЯ
// переупорядочивать — только дописывать в конец массива. Новые категории
// (head/antenna/effect) имеют индекс 0 = «классика/нет», чтобы старые аватары
// (без этих полей) рендерились по-прежнему.

export interface AvatarConfig {
  bg: number;
  color: number;
  eyes: number;
  mouth: number;
  head: number; // форма корпуса/головы
  antenna: number; // тип антенны
  effect: number; // эффект/анимация (0 = нет)
}

export interface Option {
  // для цветов/фона — hex; для остального — индекс варианта рендера
  value: string;
  free: boolean;
  cost?: number; // очков для разблокировки
  label?: string; // подпись в редакторе
}

// ── Цвета (0..6 — существующие, дальше дописаны) ──
export const COLORS: Option[] = [
  { value: "#39ff14", free: true },
  { value: "#ffb000", free: true },
  { value: "#5ac8ff", free: true },
  { value: "#c8c8c8", free: true },
  { value: "#ff5c8a", free: true }, // было premium → теперь free (больше выбора)
  { value: "#b06bff", free: false, cost: 80 },
  { value: "#ffffff", free: false, cost: 120 },
  // дописанные:
  { value: "#ff6b35", free: true },
  { value: "#00e5c0", free: true },
  { value: "#ff2d8a", free: true },
  { value: "#ffd700", free: false, cost: 60 }, // золото
  { value: "#ff2d2d", free: false, cost: 90 }, // багровый
];

// ── Фон (radial-градиент строится от этого цвета в Avatar.tsx) ──
export const BGS: Option[] = [
  { value: "#101010", free: true },
  { value: "#1a1a1a", free: true },
  { value: "#0a1f12", free: true },
  { value: "#1f1405", free: false, cost: 40 },
  // дописанные:
  { value: "#0a0f24", free: true }, // глубокий синий
  { value: "#180a24", free: true }, // глубокий фиолет
  { value: "#001a16", free: true }, // глубокий бирюзовый
  { value: "#240a0a", free: false, cost: 50 }, // глубокий красный
];

// ── Глаза ──
export const EYES: Option[] = [
  { value: "0", free: true, label: "точки" },
  { value: "1", free: true, label: "квадраты" },
  { value: "2", free: true, label: "прищур" },
  { value: "3", free: true, label: "звёзды" }, // было premium → теперь free (фикс «не открывается»)
  // дописанные:
  { value: "4", free: true, label: "радость" },
  { value: "5", free: true, label: "визор" },
  { value: "6", free: true, label: "сонные" },
  { value: "7", free: false, cost: 70, label: "сердца" },
];

// ── Рот ──
export const MOUTHS: Option[] = [
  { value: "0", free: true, label: "линия" },
  { value: "1", free: true, label: "улыбка" },
  { value: "2", free: true, label: "зубы" },
  { value: "3", free: true, label: "«о»" }, // было premium → теперь free (фикс «4-й рот»)
  // дописанные:
  { value: "4", free: true, label: "грусть" },
  { value: "5", free: true, label: "ухмылка" },
  { value: "6", free: true, label: "крик" },
  { value: "7", free: false, cost: 60, label: "кот :3" },
];

// ── Форма головы/корпуса (НОВОЕ; 0 = классика) ──
export const HEADS: Option[] = [
  { value: "0", free: true, label: "квадрат" },
  { value: "1", free: true, label: "круг" },
  { value: "2", free: true, label: "гекс" },
  { value: "3", free: true, label: "щит" },
  { value: "4", free: true, label: "широкий" },
  { value: "5", free: false, cost: 70, label: "узкий" },
];

// ── Антенна (НОВОЕ; 0 = классика) ──
export const ANTENNAS: Option[] = [
  { value: "0", free: true, label: "одна" },
  { value: "1", free: true, label: "двойная" },
  { value: "2", free: true, label: "нет" },
  { value: "3", free: true, label: "сердце" },
  { value: "4", free: false, cost: 40, label: "молния" },
];

// ── Эффект/анимация (НОВОЕ; 0 = нет) ──
export const EFFECTS: Option[] = [
  { value: "0", free: true, label: "нет" },
  { value: "1", free: true, label: "свечение" },
  { value: "2", free: true, label: "скан-линии" },
  { value: "3", free: true, label: "моргание" },
  { value: "4", free: true, label: "парение" },
  { value: "5", free: false, cost: 100, label: "голограмма" },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Детерминированный дефолтный аватар из id (только free-опции; effect=нет). */
export function defaultAvatar(seed: string): AvatarConfig {
  const h = hash(seed);
  const fc = (arr: Option[]) => arr.filter((o) => o.free).length;
  return {
    color: h % fc(COLORS),
    bg: (h >> 3) % fc(BGS),
    eyes: (h >> 6) % fc(EYES),
    mouth: (h >> 9) % fc(MOUTHS),
    head: (h >> 12) % fc(HEADS),
    antenna: (h >> 15) % fc(ANTENNAS),
    effect: 0,
  };
}

/** Разобрать JSON-конфиг (или дефолт от seed при null/ошибке). */
export function parseAvatar(json: string | null, seed: string): AvatarConfig {
  if (!json) return defaultAvatar(seed);
  try {
    const c = JSON.parse(json) as Partial<AvatarConfig>;
    return clamp(c);
  } catch {
    return defaultAvatar(seed);
  }
}

function idx(n: unknown, len: number): number {
  const v = Number(n);
  return Number.isInteger(v) && v >= 0 && v < len ? v : 0;
}

function clamp(c: Partial<AvatarConfig>): AvatarConfig {
  return {
    color: idx(c.color, COLORS.length),
    bg: idx(c.bg, BGS.length),
    eyes: idx(c.eyes, EYES.length),
    mouth: idx(c.mouth, MOUTHS.length),
    head: idx(c.head, HEADS.length),
    antenna: idx(c.antenna, ANTENNAS.length),
    effect: idx(c.effect, EFFECTS.length),
  };
}

// ── Разблокировки за баллы ────────────────────────────────────────────
export type AvatarCat = "color" | "bg" | "eyes" | "mouth" | "head" | "antenna" | "effect";

export const CAT_OPTIONS: Record<AvatarCat, Option[]> = {
  color: COLORS,
  bg: BGS,
  eyes: EYES,
  mouth: MOUTHS,
  head: HEADS,
  antenna: ANTENNAS,
  effect: EFFECTS,
};

/** Ключ опции для хранения в User.unlocks, напр. "color:4". */
export const optionKey = (cat: AvatarCat, index: number) => `${cat}:${index}`;

/** Опция доступна: либо free, либо её ключ есть в unlocks. */
export function isUnlocked(
  cat: AvatarCat,
  index: number,
  unlocks: string[],
): boolean {
  const o = CAT_OPTIONS[cat][index];
  if (!o) return false;
  return o.free || unlocks.includes(optionKey(cat, index));
}

/**
 * Проверка, что все выбранные опции доступны (free или разблокированы за баллы).
 * Возвращает null если ок, иначе текст ошибки.
 */
export function validateUnlocked(c: AvatarConfig, unlocks: string[] = []): string | null {
  const cats: AvatarCat[] = ["color", "bg", "eyes", "mouth", "head", "antenna", "effect"];
  for (const cat of cats) {
    if (!isUnlocked(cat, c[cat], unlocks)) return `опция «${cat}» заблокирована`;
  }
  return null;
}
