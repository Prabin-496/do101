import Link from "next/link";

export interface Crumb {
  name: string;
  href: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold text-[var(--muted)]">
        {items.map((item, i) => (
          <li key={item.href} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden>›</span> : null}
            {i === items.length - 1 ? (
              <span aria-current="page" className="text-[var(--ink)]">
                {item.name}
              </span>
            ) : (
              <Link href={item.href} className="hover:text-[var(--ink)] hover:underline">
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
