import { db } from "@/lib/db";
import { dayNum } from "@/lib/daily";

// Инкремент активности за сегодня (UTC-сутки). Идемпотентно по (userId, day).
// Fire-and-forget на вызове: активность не критична, не должна ронять запрос.
export async function bumpActivity(userId: string, date: Date = new Date()): Promise<void> {
  const day = dayNum(date);
  try {
    await db.activityDay.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch {
    // молча — граф активности не стоит того, чтобы падал основной экшен
  }
}

export interface HeatCell {
  day: number; // номер UTC-суток
  count: number;
}

export interface HeatData {
  cells: HeatCell[];
  total: number; // всего действий за период
  activeDays: number; // сколько дней с активностью
  best: number; // самый длинный отрезок активных дней подряд
}

// Карта активности за последние `days` дней (включая сегодня), по возрастанию.
// Пустые дни заполняются нулями, чтобы сетка была ровной.
export async function activityMap(userId: string, days = 133): Promise<HeatData> {
  const today = dayNum(new Date());
  const from = today - days + 1;
  const rows = await db.activityDay.findMany({
    where: { userId, day: { gte: from } },
    select: { day: true, count: true },
  });
  const byDay = new Map(rows.map((r) => [r.day, r.count]));

  const cells: HeatCell[] = [];
  let total = 0;
  let activeDays = 0;
  let best = 0;
  let run = 0;
  for (let d = from; d <= today; d++) {
    const count = byDay.get(d) ?? 0;
    cells.push({ day: d, count });
    total += count;
    if (count > 0) {
      activeDays++;
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return { cells, total, activeDays, best };
}
