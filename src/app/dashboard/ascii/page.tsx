import AsciiConverter from "@/components/dashboard/AsciiConverter";

export default function AsciiPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-mono text-xl text-fg">
          <span className="text-accent">$</span> img2ascii
        </h1>
        <p className="mt-1 text-sm text-fg-dim">
          turn any image into ASCII art — locally, in your browser.
        </p>
      </header>

      <AsciiConverter />
    </div>
  );
}
