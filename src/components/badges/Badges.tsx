import { BADGES, sortBadgeKeys } from "@/lib/badges";

// Компактный ряд значков рядом с ником. Презентационный — годится и на сервере,
// и в клиентских компонентах. keys — массив ключей значков пользователя.
export default function Badges({
  keys,
  size = 12,
}: {
  keys: string[] | undefined | null;
  size?: number;
}) {
  const list = sortBadgeKeys(keys ?? []);
  if (list.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {list.map((k) => {
        const b = BADGES[k];
        return (
          <span
            key={k}
            title={`${b.label} — ${b.desc}`}
            aria-label={b.label}
            className="font-mono leading-none"
            style={{ color: b.color, fontSize: size }}
          >
            {b.glyph}
          </span>
        );
      })}
    </span>
  );
}
