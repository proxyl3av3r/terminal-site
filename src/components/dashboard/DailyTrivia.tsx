"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Ежедневная тривия на дашборде: 5 вопросов, +N очков за правильный.
// Вопросы/проверка — на сервере (/api/trivia), клиент лишь показывает.

type Q = { q: string; options: string[] };
type Phase = "loading" | "intro" | "playing" | "result";

export default function DailyTrivia() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [ppc, setPpc] = useState(5);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const [correct, setCorrect] = useState<number[] | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [reward, setReward] = useState(0);
  const [already, setAlready] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/trivia");
        const d = await res.json();
        if (!d.ok) return setPhase("intro");
        setQuestions(d.questions);
        setPpc(d.pointsPerCorrect ?? 5);
        if (d.played) {
          setScore(d.score);
          setCorrect(d.answers ?? null);
          setAlready(true);
          setPhase("result");
        } else {
          setPhase("intro");
        }
      } catch {
        setPhase("intro");
      }
    })();
  }, []);

  function start() {
    setPicks([]);
    setIdx(0);
    setPhase("playing");
  }

  function choose(opt: number) {
    if (busy) return;
    const next = [...picks];
    next[idx] = opt;
    setPicks(next);
    if (idx + 1 < questions.length) {
      setTimeout(() => setIdx((i) => i + 1), 140);
    } else {
      void submit(next);
    }
  }

  async function submit(finalPicks: number[]) {
    setBusy(true);
    try {
      const res = await fetch("/api/trivia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalPicks }),
      });
      const d = await res.json();
      if (d.ok) {
        setScore(d.score);
        setReward(d.reward ?? 0);
        setCorrect(d.answers ?? null);
        setAlready(!!d.already);
        setPhase("result");
        if ((d.reward ?? 0) > 0) router.refresh();
      }
    } catch {
      /* оставим на playing — можно попробовать ещё */
    } finally {
      setBusy(false);
    }
  }

  const Card = ({ children }: { children: React.ReactNode }) => (
    <section className="rounded-lg border border-white/10 bg-bg-soft/50 p-4">
      <h2 className="mb-3 font-mono text-sm text-fg-dim">
        <span className="text-accent">$</span> daily trivia
      </h2>
      {children}
    </section>
  );

  if (phase === "loading") {
    return (
      <Card>
        <p className="font-mono text-xs text-fg-dim">loading…</p>
      </Card>
    );
  }

  if (phase === "intro") {
    return (
      <Card>
        <p className="text-sm text-fg">
          {questions.length} questions on security &amp; code. <span className="text-accent">+{ppc} pts</span> per correct answer.
        </p>
        <button
          onClick={start}
          className="mt-3 rounded bg-accent px-4 py-2 font-mono text-sm text-bg transition-opacity hover:opacity-90"
        >
          &gt; start
        </button>
      </Card>
    );
  }

  if (phase === "playing") {
    const q = questions[idx];
    return (
      <Card>
        <div className="mb-2 font-mono text-[11px] text-fg-dim">
          question {idx + 1} / {questions.length}
        </div>
        <p className="mb-3 text-sm text-fg">{q.q}</p>
        <div className="grid gap-2">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={busy}
              className="rounded border border-white/10 bg-black/30 px-3 py-2 text-left font-mono text-sm text-fg transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              <span className="text-fg-dim">{String.fromCharCode(97 + i)})</span> {opt}
            </button>
          ))}
        </div>
        {busy && <p className="mt-2 font-mono text-xs text-fg-dim">checking…</p>}
      </Card>
    );
  }

  // result
  return (
    <Card>
      <p className="text-sm">
        <span className="text-accent">{score}</span> / {questions.length} correct
        {reward > 0 && <span className="text-accent"> · +{reward} pts</span>}
        {already && <span className="text-accent-amber"> · already played today</span>}
      </p>

      {correct && (
        <div className="mt-3 space-y-2">
          {questions.map((q, qi) => {
            const right = correct[qi];
            const mine = picks[qi];
            return (
              <div key={qi} className="rounded border border-white/10 bg-black/20 p-2.5">
                <div className="mb-1 font-mono text-xs text-fg-dim">{q.q}</div>
                {q.options.map((opt, oi) => {
                  const isRight = oi === right;
                  const isMineWrong = mine !== undefined && oi === mine && mine !== right;
                  return (
                    <div
                      key={oi}
                      className={`font-mono text-xs ${
                        isRight ? "text-accent" : isMineWrong ? "text-danger line-through" : "text-fg-dim"
                      }`}
                    >
                      {isRight ? "✓ " : isMineWrong ? "✗ " : "  "}
                      {opt}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 font-mono text-[11px] text-fg-dim">come back tomorrow for a fresh set.</p>
    </Card>
  );
}
