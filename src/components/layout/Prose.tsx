import type * as React from "react";

/** Shared reading column for the legal and informational pages. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5 text-base font-semibold leading-relaxed text-[var(--muted)] [&_a]:font-extrabold [&_a]:text-[var(--ink)] [&_a]:underline [&_h2]:pt-4 [&_h2]:text-2xl [&_h2]:text-[var(--ink)] [&_h3]:pt-2 [&_h3]:text-xl [&_h3]:text-[var(--ink)] [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-[var(--ink)] [&_ul]:space-y-2">
      {children}
    </div>
  );
}

export function PageHeader({ title, lead }: { title: string; lead: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl sm:text-4xl">{title}</h1>
      <p className="mt-2 text-base font-semibold text-[var(--muted)]">{lead}</p>
    </header>
  );
}
