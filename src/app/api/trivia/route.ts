import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayNum } from "@/lib/daily";
import { bumpActivity } from "@/lib/activity";
import { errText } from "@/lib/log";
import { buildDailySet, scoreAnswers, POINTS_PER_CORRECT, type TQuestion } from "@/lib/trivia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Достать (или создать) набор вопросов на сегодня. Гонку на создании гасим
// повторным чтением: PK по day не даст двух строк.
async function getOrCreateDaily(day: number): Promise<TQuestion[]> {
  const existing = await db.triviaDaily.findUnique({ where: { day } });
  if (existing) return existing.questions as unknown as TQuestion[];
  const questions = await buildDailySet(day);
  try {
    await db.triviaDaily.create({
      data: { day, questions: questions as unknown as Prisma.InputJsonValue },
    });
  } catch {
    const again = await db.triviaDaily.findUnique({ where: { day } });
    if (again) return again.questions as unknown as TQuestion[];
  }
  return questions;
}

// GET — вопросы дня БЕЗ правильных ответов (+ статус игрока).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const day = dayNum(new Date());
  try {
    const questions = await getOrCreateDaily(day);
    const result = await db.triviaResult.findUnique({
      where: { userId_day: { userId: session.user.id, day } },
    });
    return NextResponse.json({
      ok: true,
      played: !!result,
      score: result?.score ?? null,
      total: questions.length,
      pointsPerCorrect: POINTS_PER_CORRECT,
      questions: questions.map((q) => ({ q: q.q, options: q.options })),
      // ответы отдаём только тому, кто уже сыграл — для разбора
      answers: result ? questions.map((q) => q.answer) : undefined,
    });
  } catch (err) {
    console.error("trivia GET failed:", errText(err));
    return NextResponse.json({ ok: false, error: "trivia unavailable" }, { status: 500 });
  }
}

// POST — прислать ответы, сервер считает счёт и начисляет очки (один раз в день).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const day = dayNum(new Date());

  let body: { answers?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }
  const answers = Array.isArray(body.answers)
    ? body.answers.map((n) => Number(n))
    : [];

  try {
    const questions = await getOrCreateDaily(day);

    // Уже играл сегодня — возвращаем прежний результат, без повторного начисления.
    const prev = await db.triviaResult.findUnique({ where: { userId_day: { userId, day } } });
    if (prev) {
      return NextResponse.json({
        ok: true,
        already: true,
        score: prev.score,
        total: questions.length,
        reward: 0,
        answers: questions.map((q) => q.answer),
      });
    }

    const score = scoreAnswers(questions, answers);
    const reward = score * POINTS_PER_CORRECT;

    // Создание результата + начисление в одной транзакции. Уникальность
    // (userId,day) при гонке уронит create → откат, начисления не будет.
    try {
      await db.$transaction([
        db.triviaResult.create({ data: { userId, day, score } }),
        db.user.update({ where: { id: userId }, data: { points: { increment: reward } } }),
      ]);
    } catch {
      const ex = await db.triviaResult.findUnique({ where: { userId_day: { userId, day } } });
      return NextResponse.json({
        ok: true,
        already: true,
        score: ex?.score ?? score,
        total: questions.length,
        reward: 0,
        answers: questions.map((q) => q.answer),
      });
    }

    if (score > 0) void bumpActivity(userId);

    return NextResponse.json({
      ok: true,
      score,
      total: questions.length,
      reward,
      answers: questions.map((q) => q.answer),
    });
  } catch (err) {
    console.error("trivia POST failed:", errText(err));
    return NextResponse.json({ ok: false, error: "trivia unavailable" }, { status: 500 });
  }
}
