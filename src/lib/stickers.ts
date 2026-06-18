// Готовые ASCII/kaomoji-стикеры для чата. Чистые данные (client-safe).
// Отправляются как обычное ascii-сообщение (kind="ascii") — отдельной миграции
// не требуют. Рендер в чате адаптивный: узкие арты (стикеры/каомодзи) —
// читаемым кеглем, широкие (конверт картинки в ASCII) — мелким 5px (см. isSticker).

export interface Sticker {
  name: string;
  art: string;
}

// Порог ширины: всё уже этого — рисуем крупно как стикер, иначе мелко как картинку.
export const STICKER_MAX_WIDTH = 30;

// Самая длинная строка тела сообщения (в «символах»; для выбора кегля хватает).
function maxLineWidth(body: string): number {
  let max = 0;
  for (const line of body.split("\n")) {
    if (line.length > max) max = line.length;
  }
  return max;
}

// Узкое ascii-сообщение считаем «стикером» → рисуем читаемым кеглем.
export function isSticker(body: string): boolean {
  return maxLineWidth(body) <= STICKER_MAX_WIDTH;
}

export const STICKERS: Sticker[] = [
  { name: "shrug", art: "¯\\_(ツ)_/¯" },
  { name: "flip", art: "(╯°□°)╯︵ ┻━┻" },
  { name: "unflip", art: "┬─┬ ノ( ゜-゜ノ)" },
  { name: "lenny", art: "( ͡° ͜ʖ ͡°)" },
  { name: "happy", art: "(✿◕‿◕)" },
  { name: "sad", art: "(｡•́︿•̀｡)" },
  { name: "love", art: "(♡°▽°♡)" },
  { name: "cool", art: "(⌐■_■)" },
  { name: "wave", art: "( ﾟ◡ﾟ)/" },
  { name: "yay", art: "\\(^▽^)/" },
  { name: "wink", art: "(^_-)≡☆" },
  { name: "dead", art: "(x_x)" },
  { name: "star", art: "｡:ﾟ★彡 ✧" },
  { name: "cat", art: " /\\_/\\\n( o.o )\n > ^ <" },
  { name: "bear", art: "ʕ•ᴥ•ʔ" },
  { name: "fish", art: "><(((°>" },
  {
    name: "heart",
    art: " ,d88b.d88b,\n88888888888888\n`8888888888888'\n  `Y888888Y'\n    `Y88Y'\n      `'",
  },
  {
    name: "skull",
    art: "  _____\n /     \\\n| () () |\n \\  ^  /\n  |||||\n  |||||",
  },
  {
    name: "fire",
    art: "    )\n   )\\\n  /  )\n  \\_(/\n  (_)",
  },
  {
    name: "coffee",
    art: "  ( (\n   ) )\n ........\n |      |]\n  \\    /\n   `--'",
  },
  {
    name: "rip",
    art: "   ___\n  /   \\\n | RIP |\n |     |\n_|_____|_",
  },
  {
    name: "ok",
    art: " _\n( )\n |\\\n | \\\n(╹◡╹)b",
  },
];
