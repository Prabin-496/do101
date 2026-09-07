import Link from "next/link";

export function Logo({ href = "/", showTagline = false }: { href?: string; showTagline?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-xl" aria-label="DO101 home">
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--grass)] text-sm font-extrabold text-white shadow-[0_3px_0_var(--grass-dark)]"
      >
        DO
      </span>
      <span className="leading-none">
        <span className="block text-lg font-extrabold tracking-tight">DO101</span>
        {showTagline ? (
          <span className="block text-[11px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
            Do more. Simply.
          </span>
        ) : null}
      </span>
    </Link>
  );
}
