import type { ToolFaq } from "@/lib/tools/types";

export function Faq({ items, title = "Frequently asked questions" }: { items: ToolFaq[]; title?: string }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="mb-4 text-xl sm:text-2xl">
        {title}
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <details
            key={item.q}
            className="do-card group px-5 py-4 [&[open]]:border-[var(--border-strong)]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-extrabold">
              {item.q}
              <span
                aria-hidden
                className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-45"
              >
                ＋
              </span>
            </summary>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-[var(--muted)]">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
