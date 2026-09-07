import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils/cn";

/**
 * Ad placeholder. Nothing is rendered unless NEXT_PUBLIC_ADSENSE_CLIENT and a
 * slot id are configured, so development and un-approved deployments stay clean.
 * Slots sit between content sections — never next to primary actions, never
 * styled to look like a button.
 */
export function AdSlot({
  slot,
  format = "auto",
  className,
  label = "Advertisement",
}: {
  slot?: string;
  format?: string;
  className?: string;
  label?: string;
}) {
  const enabled = Boolean(SITE.adsenseClient && slot);

  if (!enabled) {
    if (process.env.NODE_ENV === "production") return null;
    return (
      <div
        className={cn(
          "flex min-h-[90px] items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]",
          className,
        )}
      >
        Ad slot (disabled — no publisher id)
      </div>
    );
  }

  return (
    <aside className={cn("my-2", className)} aria-label={label}>
      <p className="mb-1 text-center text-[10px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
        {label}
      </p>
      <ins
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={SITE.adsenseClient}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
