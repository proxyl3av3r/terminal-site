"use client";

// Discreet but findable entrance. A subtle "access _" pill in the corner that
// brightens on hover. Visible enough to click, quiet enough to stay tasteful.
export default function SecretTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-label="open sign-in console"
      className="group fixed bottom-5 right-6 z-30 flex items-center gap-1.5 rounded-md border border-white/10 bg-bg-soft/60 px-3 py-1.5 font-mono text-xs text-fg-dim backdrop-blur-sm transition-colors hover:border-accent/40 hover:text-accent focus:border-accent/40 focus:text-accent focus:outline-none"
    >
      <span className="text-accent/70 group-hover:text-accent">$</span>
      <span>access</span>
      <span className="animate-blink text-accent">_</span>
    </button>
  );
}
