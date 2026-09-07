"use client";

import Link from "next/link";
import { TOOL_MAP } from "@/lib/tools/tool-registry";
import type { Tool } from "@/lib/tools/types";
import { removeLocal, STORAGE_KEYS } from "@/lib/utils/storage";
import { useLocalValue } from "@/lib/utils/use-local";

/** Renders only when this device actually has history. Never a fake list. */
export function RecentTools() {
  const recent = useLocalValue<string[]>(STORAGE_KEYS.recent, []);
  const tools = recent
    .map((id) => TOOL_MAP[id])
    .filter((t): t is Tool => Boolean(t))
    .slice(0, 6);

  if (!tools.length) return null;

  return (
    <section aria-labelledby="recent-heading" className="mb-14">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 id="recent-heading" className="text-2xl sm:text-3xl">
            Jump back in
          </h2>
          <p className="text-sm font-semibold text-[var(--muted)]">
            Saved on this device only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => removeLocal(STORAGE_KEYS.recent)}
          className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)] underline hover:text-[var(--ink)]"
        >
          Clear
        </button>
      </div>
      <div className="do-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {tools.map((tool) => (
          <Link
            key={tool.id}
            href={tool.route}
            className="do-card do-card-hover flex min-w-[160px] shrink-0 items-center gap-2 p-3"
          >
            <span aria-hidden className="text-xl">
              {tool.icon}
            </span>
            <span className="truncate text-sm font-extrabold">{tool.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
