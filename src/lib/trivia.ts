// Ежедневная тривия по теме кибербеза/программирования.
// Источники: курируемый банк (ниже) + Open Trivia DB (категория «Computers»).
// Набор дня строится на сервере и хранится в TriviaDaily — ответы клиенту не
// уходят, счёт считает сервер.

export interface TQuestion {
  q: string;
  options: string[];
  answer: number; // индекс правильного в options
  src?: "bank" | "otdb";
}

export const POINTS_PER_CORRECT = 5;
export const DAILY_COUNT = 5;
export const BANK_PER_DAY = 3; // из своего банка, остальное — OTDB (с фолбэком на банк)

// Курируемый банк. answer — индекс правильного варианта (набор перемешивается
// при сборке дня, так что позиция значения не имеет).
const BANK: TQuestion[] = [
  { q: "What does HTTPS add on top of HTTP?", options: ["Encryption via TLS", "Faster page loads", "Better SEO", "Built-in ad blocking"], answer: 0 },
  { q: "A password 'salt' primarily defends against…", options: ["Precomputed rainbow tables", "SQL injection", "DDoS floods", "Phishing emails"], answer: 0 },
  { q: "Which HTTP status code means 'Too Many Requests'?", options: ["429", "404", "500", "302"], answer: 0 },
  { q: "XSS is an attack that…", options: ["Injects scripts into a page", "Overflows a buffer", "Intercepts Wi-Fi", "Guesses passwords"], answer: 0 },
  { q: "What does 2FA stand for?", options: ["Two-factor authentication", "Two-file access", "Fast file authorization", "Firewall access"], answer: 0 },
  { q: "Default port for HTTPS?", options: ["443", "80", "22", "25"], answer: 0 },
  { q: "The Content-Security-Policy header mainly helps against…", options: ["Cross-site scripting (XSS)", "Slow DNS", "Disk failure", "Weak Wi-Fi"], answer: 0 },
  { q: "argon2 and bcrypt are examples of…", options: ["Password hashing algorithms", "Symmetric ciphers", "Compression formats", "Databases"], answer: 0 },
  { q: "SQL injection targets…", options: ["Database queries", "GPU drivers", "CSS styles", "DNS records"], answer: 0 },
  { q: "Which protocol secures remote shell access?", options: ["SSH", "FTP", "Telnet", "SMTP"], answer: 0 },
  { q: "Phishing is best described as…", options: ["Social engineering for credentials", "A port scan", "A hashing method", "A firewall rule"], answer: 0 },
  { q: "The Morris Worm (1988) is famous as…", options: ["One of the first internet worms", "The first ransomware", "The first web browser", "The first VPN"], answer: 0 },
  { q: "What does DDoS stand for?", options: ["Distributed Denial of Service", "Dynamic DNS over SSL", "Direct Data on Server", "Double Data of Service"], answer: 0 },
  { q: "In 'zero-day', the zero refers to…", options: ["Days the vendor had to patch it", "Cost in dollars", "Number of victims", "A severity score"], answer: 0 },
  { q: "Which is a symmetric encryption algorithm?", options: ["AES", "RSA", "SHA-256", "ECDSA"], answer: 0 },
  { q: "The cookie flag that hides a cookie from JavaScript is…", options: ["HttpOnly", "Secure", "SameSite", "Path"], answer: 0 },
  { q: "A hash collision means…", options: ["Two inputs share the same hash", "A network loop", "A git merge conflict", "A cache miss"], answer: 0 },
  { q: "Heartbleed (2014) was a bug in which library?", options: ["OpenSSL", "OpenSSH", "OpenVPN", "OpenLDAP"], answer: 0 },
  { q: "What does RCE stand for?", options: ["Remote Code Execution", "Rapid Cache Eviction", "Random Clock Error", "Root Certificate Exchange"], answer: 0 },
  { q: "The C language and Unix are credited to…", options: ["Dennis Ritchie & Ken Thompson", "Linus Torvalds", "Guido van Rossum", "Tim Berners-Lee"], answer: 0 },
  { q: "Rate limiting mainly prevents…", options: ["Brute-force and abuse", "Memory leaks", "Typos", "Slow DNS"], answer: 0 },
  { q: "Which of these is NOT a hash function?", options: ["AES", "MD5", "SHA-1", "SHA-256"], answer: 0 },
  { q: "HSTS tells the browser to…", options: ["Only use HTTPS for this site", "Cache images longer", "Block cookies", "Prefetch DNS"], answer: 0 },
  { q: "Linux was first announced in 1991 by…", options: ["Linus Torvalds", "Richard Stallman", "Dennis Ritchie", "Bill Gates"], answer: 0 },
];

// ── детерминированный ГПСЧ по seed (для стабильного выбора вопросов дня) ──
function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Перемешать варианты вопроса (и обновить индекс ответа).
function shuffleOptions(qn: TQuestion): TQuestion {
  const correct = qn.options[qn.answer];
  const opts = shuffle(qn.options);
  return { ...qn, options: opts, answer: opts.indexOf(correct) };
}

// ── Open Trivia DB (категория 18 = Science: Computers), без ключа ──
function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

async function fetchOtdb(n: number): Promise<TQuestion[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(
      `https://opentdb.com/api.php?amount=${n}&category=18&type=multiple&encode=url3986`,
      { signal: ctrl.signal, headers: { "User-Agent": "bash-app.com trivia" } },
    );
    if (!res.ok) throw new Error(`otdb ${res.status}`);
    const data = await res.json();
    if (data.response_code !== 0 || !Array.isArray(data.results)) throw new Error("otdb empty");
    return data.results.map((r: any): TQuestion => {
      const correct = decode(r.correct_answer);
      const incorrect = (r.incorrect_answers as string[]).map(decode);
      const options = shuffle([correct, ...incorrect]);
      return { q: decode(r.question), options, answer: options.indexOf(correct), src: "otdb" };
    });
  } finally {
    clearTimeout(timer);
  }
}

// Собрать набор дня: часть из банка (детерминированно по дню) + часть из OTDB.
// Если OTDB недоступен — добираем из банка. Результат кладётся в TriviaDaily.
export async function buildDailySet(day: number): Promise<TQuestion[]> {
  const rand = rng(day);
  const order = shuffle(
    BANK.map((_, i) => i),
    rand,
  );
  const bankPicks = order.slice(0, DAILY_COUNT).map((i) => ({ ...BANK[i], src: "bank" as const }));

  const set: TQuestion[] = bankPicks.slice(0, BANK_PER_DAY).map(shuffleOptions);

  try {
    const otdb = await fetchOtdb(DAILY_COUNT - BANK_PER_DAY);
    set.push(...otdb);
  } catch {
    // OTDB недоступен — добираем из банка
  }
  let idx = BANK_PER_DAY;
  while (set.length < DAILY_COUNT && idx < bankPicks.length) {
    set.push(shuffleOptions(bankPicks[idx++]));
  }
  return set.slice(0, DAILY_COUNT);
}

export function scoreAnswers(questions: TQuestion[], answers: number[]): number {
  return questions.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0);
}
