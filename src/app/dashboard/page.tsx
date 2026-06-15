// Главный экран панели — пока пустой каркас с местами под будущие модули.
export default function DashboardPage() {
  const modules = [
    { name: "notes", desc: "заметки / журнал", soon: true },
    { name: "links", desc: "приватные ссылки", soon: true },
    { name: "metrics", desc: "статистика сайта", soon: true },
    { name: "files", desc: "хранилище", soon: true },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <h1 className="font-mono text-xl text-fg">
          <span className="text-accent">$</span> dashboard
        </h1>
        <p className="mt-1 text-sm text-fg-dim">
          добро пожаловать. модули появятся здесь по мере готовности.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {modules.map((m) => (
          <div
            key={m.name}
            className="rounded-lg border border-white/10 bg-bg-soft/50 p-4 transition-colors hover:border-accent/30"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-fg">{m.name}</span>
              {m.soon && (
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-fg-dim">
                  soon
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-fg-dim">{m.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
