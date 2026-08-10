// «This day in hacker history» — курируемая база событий по кибербезу,
// хакерству и истории вычислений. Локальная и client-safe: никаких внешних
// API (их нельзя отфильтровать под тему). Дата — "MM-DD" (месяц-день).
// Тон — по делу, но с лёгкой ухмылкой. Пополняется вручную.

export interface HistEvent {
  md: string; // "MM-DD"
  year: number;
  text: string;
}

export const HACKER_HISTORY: HistEvent[] = [
  { md: "10-29", year: 1969, text: "First ARPANET message sent. They typed 'LOGIN' — the system crashed after 'LO'. The internet's first two letters were also its first bug." },
  { md: "11-02", year: 1988, text: "The Morris Worm hits ~10% of the internet. Written 'to gauge its size', it became the first felony conviction under the CFAA." },
  { md: "08-25", year: 1991, text: "Linus Torvalds announces Linux: 'just a hobby, won't be big and professional like GNU'. It now runs most of the planet." },
  { md: "02-16", year: 1978, text: "CBBS goes online — the first public bulletin board system. Dial-up before dial-up was cool." },
  { md: "03-12", year: 1989, text: "Tim Berners-Lee circulates 'Information Management: A Proposal'. His boss's note: 'vague but exciting'. That's the World Wide Web." },
  { md: "05-05", year: 2000, text: "The ILOVEYOU worm spreads worldwide via a love-letter attachment. Turns out social engineering beats firewalls." },
  { md: "03-26", year: 1999, text: "The Melissa macro virus spreads through Word docs and email, forcing companies to shut down mail servers." },
  { md: "01-25", year: 2003, text: "SQL Slammer infects ~75,000 hosts in 10 minutes — one 376-byte UDP packet, no disk write. Patch existed for 6 months." },
  { md: "04-07", year: 2014, text: "Heartbleed disclosed: a missing bounds check in OpenSSL let anyone read server memory. Two bytes of validation would have stopped it." },
  { md: "05-12", year: 2017, text: "WannaCry ransomware sweeps 150+ countries using a leaked NSA exploit. Stopped almost by accident via a $10 killswitch domain." },
  { md: "06-27", year: 2017, text: "NotPetya masquerades as ransomware but just destroys. ~$10B in damage — the costliest cyberattack in history." },
  { md: "12-09", year: 2021, text: "Log4Shell (Log4j) goes public: a logging library that executes attacker code from a string. The internet patched all weekend." },
  { md: "09-07", year: 2017, text: "Equifax discloses a breach of 147M people, traced to an unpatched Apache Struts flaw. The patch had been out for months." },
  { md: "05-07", year: 2021, text: "Colonial Pipeline shut down by ransomware; the entry point was a single leaked VPN password with no 2FA. (See why we did that lecture?)" },
  { md: "11-24", year: 2014, text: "Sony Pictures is hacked and gutted — unreleased films, salaries and emails leaked. A masterclass in why segmentation matters." },
  { md: "06-05", year: 2013, text: "The Guardian publishes the first Snowden documents. Mass surveillance becomes dinner-table conversation overnight." },
  { md: "10-12", year: 2011, text: "Dennis Ritchie's death is announced. He gave us C and co-created Unix — the quiet foundation under almost everything you use." },
  { md: "09-27", year: 1983, text: "Richard Stallman announces the GNU Project: a free operating system, and the idea that software freedom is worth fighting for." },
  { md: "12-03", year: 1992, text: "The first SMS is sent: 'Merry Christmas'. Nobody imagined it would one day carry your 2FA codes." },
  { md: "02-15", year: 1995, text: "Kevin Mitnick is arrested after a long hunt. He'd later note most of his tricks were social engineering, not code." },
  { md: "07-15", year: 2010, text: "Stuxnet surfaces — malware that physically wrecked Iranian centrifuges. The moment cyberweapons got real." },
  { md: "08-11", year: 2003, text: "The Blaster worm spreads, taunting 'billy gates why do you make this possible?' and rebooting Windows machines on loop." },
  { md: "04-01", year: 1990, text: "RFC 1149 published: 'IP over Avian Carriers' — the internet standard for sending packets by pigeon. Yes, it was later tested." },
  { md: "12-25", year: 1990, text: "Berners-Lee runs the first successful HTTP client↔server exchange. The web quietly says its first 'hello'." },
  { md: "04-03", year: 1973, text: "Martin Cooper makes the first handheld mobile call — to a rival, to gloat. The pocket supercomputer starts here." },
  { md: "07-16", year: 2001, text: "Code Red worm defaces sites with 'Hacked By Chinese!' and probes for more — an early taste of internet-scale automation." },
];

// События на конкретный день. Если на сегодня ничего нет — вернём одно из
// архива, помеченное как «from the archives», чтобы команда всегда что-то отдавала.
export function hackerHistoryFor(date: Date = new Date()): { onThisDay: boolean; events: HistEvent[] } {
  const md = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const today = HACKER_HISTORY.filter((e) => e.md === md).sort((a, b) => a.year - b.year);
  if (today.length) return { onThisDay: true, events: today };
  const rnd = HACKER_HISTORY[Math.floor(Math.random() * HACKER_HISTORY.length)];
  return { onThisDay: false, events: [rnd] };
}
