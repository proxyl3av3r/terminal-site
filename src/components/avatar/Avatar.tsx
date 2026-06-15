import { COLORS, BGS, type AvatarConfig } from "@/lib/avatar";

// Чистый SVG-рендер аватара по конфигу. Без состояния — используется везде
// (сайдбар, редактор, позже мессенджер/игра). Черты «вырезаны» цветом фона.
export default function Avatar({
  config,
  size = 40,
}: {
  config: AvatarConfig;
  size?: number;
}) {
  const color = COLORS[config.color]?.value ?? "#39ff14";
  const bg = BGS[config.bg]?.value ?? "#101010";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="avatar"
      className="shrink-0 rounded-md"
    >
      <rect width="100" height="100" rx="14" fill={bg} />
      {/* антенна */}
      <rect x="48" y="10" width="4" height="10" fill={color} />
      <circle cx="50" cy="9" r="4" fill={color} />
      {/* голова */}
      <rect x="22" y="22" width="56" height="54" rx="14" fill={color} />
      <Eyes variant={config.eyes} cut={bg} />
      <Mouth variant={config.mouth} cut={bg} />
    </svg>
  );
}

function Eyes({ variant, cut }: { variant: number; cut: string }) {
  const y = 44;
  switch (variant) {
    case 1: // квадраты
      return (
        <>
          <rect x="35" y={y - 5} width="10" height="10" fill={cut} />
          <rect x="55" y={y - 5} width="10" height="10" fill={cut} />
        </>
      );
    case 2: // прищур ">  <"
      return (
        <>
          <path d={`M36 ${y - 5} L44 ${y} L36 ${y + 5}`} stroke={cut} strokeWidth="3" fill="none" />
          <path d={`M64 ${y - 5} L56 ${y} L64 ${y + 5}`} stroke={cut} strokeWidth="3" fill="none" />
        </>
      );
    case 3: // звёздные (locked-вариант)
      return (
        <>
          <path d={`M40 ${y - 6} l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1z`} fill={cut} />
          <path d={`M60 ${y - 6} l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1z`} fill={cut} />
        </>
      );
    default: // точки
      return (
        <>
          <circle cx="40" cy={y} r="5" fill={cut} />
          <circle cx="60" cy={y} r="5" fill={cut} />
        </>
      );
  }
}

function Mouth({ variant, cut }: { variant: number; cut: string }) {
  const y = 62;
  switch (variant) {
    case 1: // улыбка
      return <path d={`M38 ${y} Q50 ${y + 10} 62 ${y}`} stroke={cut} strokeWidth="4" fill="none" strokeLinecap="round" />;
    case 2: // решётка (зубы)
      return (
        <>
          <rect x="38" y={y - 3} width="24" height="8" fill={cut} />
          <rect x="44" y={y - 3} width="2" height="8" fill="rgba(0,0,0,0.4)" />
          <rect x="50" y={y - 3} width="2" height="8" fill="rgba(0,0,0,0.4)" />
          <rect x="56" y={y - 3} width="2" height="8" fill="rgba(0,0,0,0.4)" />
        </>
      );
    case 3: // «o» (locked-вариант)
      return <circle cx="50" cy={y + 1} r="6" fill={cut} />;
    default: // нейтральная линия
      return <rect x="40" y={y} width="20" height="4" rx="2" fill={cut} />;
  }
}
