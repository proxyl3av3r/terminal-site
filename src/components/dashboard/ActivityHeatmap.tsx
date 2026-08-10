import type { HeatData, HeatCell } from "@/lib/activity";

// Граф активности в стиле GitHub-контриб: колонки — недели, строки — дни недели,
// зелёная интенсивность = сколько действий в день. Презентационный, без хуков —
// используется и на дашборде, и на публичном профиле (шаринг через профиль).

const DAY_MS = 86_400_000;

function level(count: number): string {
  if (count <= 0) return "bg-white/5";
  if (count <= 2) return "bg-accent/25";
  if (count <= 4) return "bg-accent/50";
  if (count <= 6) return "bg-accent/75";
  return "bg-accent";
}

function fmt(day: number): string {
  return new Date(day * DAY_MS).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ActivityHeatmap({
  data,
  streak,
  title = "activity",
}: {
  data: HeatData;
  streak?: number;
  title?: string;
}) {
  const { cells, total, activeDays, best } = data;

  // Выравниваем сетку: добиваем пустышками до понедельника-старта недели.
  const lead = cells.length ? new Date(cells[0].day * DAY_MS).getUTCDay() : 0;
  const slots: (HeatCell | null)[] = [...Array(lead).fill(null), ...cells];
  const weeks: (HeatCell | null)[][] = [];
  for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7));

  return (
    <section className="rounded-lg border border-white/10 bg-bg-soft/50 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-sm text-fg-dim">
          <span className="text-accent">$</span> {title}
        </h2>
        <div className="font-mono text-[11px] text-fg-dim">
          {total} actions · {activeDays} active days · best streak {best}
          {typeof streak === "number" ? ` · current ${streak}🔥` : ""}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }).map((_, di) => {
                const cell = week[di];
                if (!cell) return <div key={di} className="h-3 w-3" />;
                return (
                  <div
                    key={di}
                    title={`${fmt(cell.day)}: ${cell.count} ${cell.count === 1 ? "action" : "actions"}`}
                    className={`h-3 w-3 rounded-[2px] ${level(cell.count)}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-fg-dim">
        <span>less</span>
        <span className="h-3 w-3 rounded-[2px] bg-white/5" />
        <span className="h-3 w-3 rounded-[2px] bg-accent/25" />
        <span className="h-3 w-3 rounded-[2px] bg-accent/50" />
        <span className="h-3 w-3 rounded-[2px] bg-accent/75" />
        <span className="h-3 w-3 rounded-[2px] bg-accent" />
        <span>more</span>
      </div>
    </section>
  );
}
