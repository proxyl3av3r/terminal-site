// Логика ежедневного бонуса — без БД (шарится сервером и роутом claim).

// Номер UTC-суток (для сравнения «сегодня / вчера»).
export const dayNum = (d: Date): number =>
  Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000);

// Награда за день стрика: 10 в первый день, +5 за каждый следующий, потолок 50.
export const claimReward = (streak: number): number => Math.min(10 + (streak - 1) * 5, 50);

// Можно ли забрать бонус сейчас (последний раз — не сегодня).
export const canClaim = (lastClaimAt: Date | null): boolean =>
  !lastClaimAt || dayNum(lastClaimAt) !== dayNum(new Date());
