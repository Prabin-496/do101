import Link from "next/link";
import type { Tool } from "@/lib/tools/types";
import { cn } from "@/lib/utils/cn";

const ACCENT_BG: Record<Tool["accent"], string> = {
  grass: "bg-[var(--grass-soft)] text-[var(--grass-dark)] dark:text-[var(--grass)]",
  sky: "bg-[var(--sky-soft)] text-[var(--sky-dark)] dark:text-[var(--sky)]",
  grape: "bg-[var(--grape-soft)] text-[var(--grape-dark)] dark:text-[var(--grape)]",
  fire: "bg-[var(--fire-soft)] text-[var(--fire-dark)] dark:text-[var(--fire)]",
  sun: "bg-[var(--sun-soft)] text-[var(--sun-dark)] dark:text-[var(--sun)]",
  cherry: "bg-[var(--cherry-soft)] text-[var(--cherry-dark)] dark:text-[var(--cherry)]",
};

export function ToolCard({ tool, compact = false }: { tool: Tool; compact?: boolean }) {
  return (
    <Link
      href={tool.route}
      className="do-card do-card-hover group flex h-full flex-col gap-3 p-4 focus-visible:outline-offset-4"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl font-extrabold",
            ACCENT_BG[tool.accent],
          )}
        >
          {tool.icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-extrabold">{tool.name}</span>
          {tool.browserOnly ? (
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--muted)]">
              Runs in your browser
            </span>
          ) : null}
        </span>
      </div>
      {!compact ? (
        <p className="text-sm font-semibold leading-snug text-[var(--muted)]">{tool.short}</p>
      ) : null}
    </Link>
  );
}

export function ToolGrid({ tools, compact }: { tools: Tool[]; compact?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} compact={compact} />
      ))}
    </div>
  );
}
