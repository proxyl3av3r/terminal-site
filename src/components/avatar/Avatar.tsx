import { COLORS, BGS, type AvatarConfig } from "@/lib/avatar";

// Псевдо-3D SVG-рендер аватара по конфигу. Без состояния — server-friendly,
// используется везде (чат, скорборд, игра, профиль). Объём даётся градиентами,
// бликом и тенью; анимация (effect) — CSS-классами из globals.css.
//
// ID градиентов/клипов уникальны по конфигу: одинаковые конфиги делят id
// (безвредно — определения идентичны), разные получают разные id (нет коллизий
// между несколькими inline-SVG на одной странице).

// ── цветовые помощники (чистые, работают на сервере) ──
function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function shade(hex: string, amt: number) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const mix = (c: number) => (amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  return `#${[mix(r), mix(g), mix(b)].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")}`;
}
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export default function Avatar({
  config,
  size = 40,
}: {
  config: AvatarConfig;
  size?: number;
}) {
  const color = COLORS[config.color]?.value ?? "#39ff14";
  const bg = BGS[config.bg]?.value ?? "#101010";
  const dark = shade(color, -0.4);
  const light = shade(color, 0.42);

  const uid = "av" + hashStr(`${color}|${bg}|${config.head}|${config.effect}`);
  const headGrad = `${uid}h`;
  const bgGrad = `${uid}b`;
  const gloss = `${uid}g`;
  const clip = `${uid}c`;

  const eff = config.effect;
  // анимация всего робота (парение) / отдельных частей (моргание)
  const robotClass = eff === 4 ? "av-anim-float" : eff === 5 ? "av-anim-holo" : "";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="avatar"
      className="shrink-0 rounded-md"
    >
      <defs>
        <linearGradient id={headGrad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={light} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
        <radialGradient id={bgGrad} cx="50%" cy="36%" r="80%">
          <stop offset="0%" stopColor={shade(bg, 0.22)} />
          <stop offset="100%" stopColor={shade(bg, -0.3)} />
        </radialGradient>
        <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <clipPath id={clip}>
          <HeadShape variant={config.head} fill="#000" />
        </clipPath>
      </defs>

      <rect width="100" height="100" rx="14" fill={`url(#${bgGrad})`} />

      {/* свечение-аура (effect: свечение / голограмма) */}
      {(eff === 1 || eff === 5) && (
        <g className="av-anim-glow" style={{ transformOrigin: "center", transformBox: "fill-box" } as React.CSSProperties}>
          <HeadShape variant={config.head} fill={color} opacity={0.5} blur />
        </g>
      )}

      <g className={robotClass} style={{ transformOrigin: "center", transformBox: "fill-box" } as React.CSSProperties}>
        <Antenna variant={config.antenna} color={color} dark={dark} />

        {/* корпус: градиент + тёмная обводка */}
        <HeadShape variant={config.head} fill={`url(#${headGrad})`} stroke={dark} />

        {/* глянцевый блик сверху (клипуется по форме) */}
        <g clipPath={`url(#${clip})`}>
          <ellipse cx="42" cy="33" rx="26" ry="14" fill={`url(#${gloss})`} opacity={0.5} />
          {/* скан-линии (effect) */}
          {eff === 2 && <ScanLines color={shade(bg, -0.1)} />}
          {/* голограмма — лёгкий цветной отлив */}
          {eff === 5 && <rect x="0" y="0" width="100" height="100" fill={light} opacity={0.12} />}
        </g>

        {/* черты лица */}
        <g
          className={eff === 3 ? "av-anim-blink" : ""}
          style={{ transformOrigin: "50px 46px", transformBox: "view-box" } as React.CSSProperties}
        >
          <Eyes variant={config.eyes} cut={bg} glow={color} />
        </g>
        <Mouth variant={config.mouth} cut={bg} />
      </g>
    </svg>
  );
}

// ── форма корпуса (общая геометрия для clip и видимой заливки) ──
function HeadShape({
  variant,
  fill,
  stroke,
  opacity,
  blur,
}: {
  variant: number;
  fill: string;
  stroke?: string;
  opacity?: number;
  blur?: boolean;
}) {
  const p = {
    fill,
    stroke,
    strokeWidth: stroke ? 2 : 0,
    opacity,
    style: blur ? ({ filter: "blur(4px)" } as React.CSSProperties) : undefined,
  };
  switch (variant) {
    case 1: // круг
      return <circle cx={50} cy={50} r={29} {...p} />;
    case 2: // гекс
      return <polygon points="50,21 76,35 76,65 50,79 24,65 24,35" {...p} />;
    case 3: // щит
      return <path d="M24 31 Q24 24 31 24 H69 Q76 24 76 31 V52 Q76 71 50 80 Q24 71 24 52 Z" {...p} />;
    case 4: // широкий
      return <rect x={15} y={30} width={70} height={42} rx={16} {...p} />;
    case 5: // узкий
      return <rect x={30} y={19} width={40} height={62} rx={14} {...p} />;
    default: // классический скруглённый квадрат
      return <rect x={22} y={24} width={56} height={52} rx={14} {...p} />;
  }
}

function Antenna({ variant, color, dark }: { variant: number; color: string; dark: string }) {
  switch (variant) {
    case 1: // двойная
      return (
        <>
          <rect x="36" y="12" width="3" height="11" fill={color} transform="rotate(-12 37 17)" />
          <circle cx="35" cy="11" r="3.5" fill={color} stroke={dark} strokeWidth="0.5" />
          <rect x="61" y="12" width="3" height="11" fill={color} transform="rotate(12 63 17)" />
          <circle cx="65" cy="11" r="3.5" fill={color} stroke={dark} strokeWidth="0.5" />
        </>
      );
    case 2: // нет
      return null;
    case 3: // сердце
      return (
        <>
          <rect x="48" y="12" width="4" height="10" fill={color} />
          <path d="M50 6 C48 2 42 3 42 8 C42 12 50 16 50 16 C50 16 58 12 58 8 C58 3 52 2 50 6 Z" fill={color} />
        </>
      );
    case 4: // молния
      return (
        <>
          <rect x="48" y="13" width="4" height="9" fill={color} />
          <polygon points="52,2 44,12 49,12 47,20 56,9 51,9" fill={color} stroke={dark} strokeWidth="0.5" />
        </>
      );
    default: // классическая одиночная
      return (
        <>
          <rect x="48" y="10" width="4" height="12" fill={color} />
          <circle cx="50" cy="9" r="4" fill={color} stroke={dark} strokeWidth="0.5" />
        </>
      );
  }
}

function Eyes({ variant, cut, glow }: { variant: number; cut: string; glow: string }) {
  const y = 46;
  switch (variant) {
    case 1: // квадраты
      return (
        <>
          <rect x="35" y={y - 5} width="10" height="10" rx="2" fill={cut} />
          <rect x="55" y={y - 5} width="10" height="10" rx="2" fill={cut} />
        </>
      );
    case 2: // прищур
      return (
        <>
          <path d={`M36 ${y - 5} L44 ${y} L36 ${y + 5}`} stroke={cut} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d={`M64 ${y - 5} L56 ${y} L64 ${y + 5}`} stroke={cut} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case 3: // звёзды
      return (
        <>
          <path d={`M40 ${y - 6} l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1z`} fill={cut} />
          <path d={`M60 ${y - 6} l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1z`} fill={cut} />
        </>
      );
    case 4: // радость ^^
      return (
        <>
          <path d={`M34 ${y + 2} L40 ${y - 4} L46 ${y + 2}`} stroke={cut} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M54 ${y + 2} L60 ${y - 4} L66 ${y + 2}`} stroke={cut} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 5: // визор (один экран с подсветкой)
      return (
        <>
          <rect x="32" y={y - 5} width="36" height="10" rx="5" fill={cut} />
          <rect x="36" y={y - 1} width="28" height="2" rx="1" fill={glow} opacity="0.8" />
        </>
      );
    case 6: // сонные (полузакрытые)
      return (
        <>
          <rect x="35" y={y} width="10" height="3" rx="1.5" fill={cut} />
          <rect x="55" y={y} width="10" height="3" rx="1.5" fill={cut} />
        </>
      );
    case 7: // сердца
      return (
        <>
          <path d={`M40 ${y - 3} C38.5 ${y - 6} 34 ${y - 5} 34 ${y - 1} C34 ${y + 2} 40 ${y + 5} 40 ${y + 5} C40 ${y + 5} 46 ${y + 2} 46 ${y - 1} C46 ${y - 5} 41.5 ${y - 6} 40 ${y - 3} Z`} fill={cut} />
          <path d={`M60 ${y - 3} C58.5 ${y - 6} 54 ${y - 5} 54 ${y - 1} C54 ${y + 2} 60 ${y + 5} 60 ${y + 5} C60 ${y + 5} 66 ${y + 2} 66 ${y - 1} C66 ${y - 5} 61.5 ${y - 6} 60 ${y - 3} Z`} fill={cut} />
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
  const y = 63;
  switch (variant) {
    case 1: // улыбка
      return <path d={`M38 ${y} Q50 ${y + 10} 62 ${y}`} stroke={cut} strokeWidth="4" fill="none" strokeLinecap="round" />;
    case 2: // зубы
      return (
        <>
          <rect x="38" y={y - 3} width="24" height="8" rx="2" fill={cut} />
          <rect x="44" y={y - 3} width="2" height="8" fill="rgba(0,0,0,0.4)" />
          <rect x="50" y={y - 3} width="2" height="8" fill="rgba(0,0,0,0.4)" />
          <rect x="56" y={y - 3} width="2" height="8" fill="rgba(0,0,0,0.4)" />
        </>
      );
    case 3: // «о»
      return <circle cx="50" cy={y + 1} r="6" fill={cut} />;
    case 4: // грусть
      return <path d={`M38 ${y + 6} Q50 ${y - 4} 62 ${y + 6}`} stroke={cut} strokeWidth="4" fill="none" strokeLinecap="round" />;
    case 5: // ухмылка
      return <path d={`M38 ${y + 1} Q50 ${y + 8} 60 ${y - 3}`} stroke={cut} strokeWidth="4" fill="none" strokeLinecap="round" />;
    case 6: // крик (большой овал)
      return <ellipse cx="50" cy={y + 2} rx="8" ry="10" fill={cut} />;
    case 7: // кот :3
      return (
        <path d={`M40 ${y} Q45 ${y + 6} 50 ${y} Q55 ${y + 6} 60 ${y}`} stroke={cut} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      );
    default: // нейтральная линия
      return <rect x="40" y={y} width="20" height="4" rx="2" fill={cut} />;
  }
}

// горизонтальные «скан-линии» CRT, ползут вниз (анимация через класс)
function ScanLines({ color }: { color: string }) {
  return (
    <g className="av-anim-scan" style={{ transformBox: "fill-box" } as React.CSSProperties}>
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x="0" y={i * 12} width="100" height="3" fill={color} opacity={0.18} />
      ))}
    </g>
  );
}
