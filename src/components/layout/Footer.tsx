import Link from "next/link";
import { Logo } from "./Logo";
import { SITE } from "@/lib/site";

const COLUMNS: Array<{ title: string; links: Array<{ href: string; label: string }> }> = [
  {
    title: "Tools",
    links: [
      { href: "/tools", label: "All tools" },
      { href: "/tools/image-compressor", label: "Image Compressor" },
      { href: "/tools/json-formatter", label: "JSON Formatter" },
      { href: "/tools/word-counter", label: "Word Counter" },
      { href: "/tools/qr-generator", label: "QR Generator" },
    ],
  },
  {
    title: "Play",
    links: [
      { href: "/games", label: "All games" },
      { href: "/games/typing-test", label: "Typing Speed Test" },
      { href: "/games/typing-battle", label: "Typing Battle" },
      { href: "/games/reaction-test", label: "Reaction Time" },
      { href: "/games/memory-test", label: "Memory Test" },
    ],
  },
  {
    title: "DO101",
    links: [
      { href: "/about", label: "About" },
      { href: "/ai", label: "DO101 AI" },
      { href: "/calculators", label: "Calculators" },
      { href: "/contact", label: "Contact" },
      { href: "/sitemap.xml", label: "Sitemap" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy#local-data", label: "Your local data" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t-2 border-[var(--border)] bg-[var(--panel)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Logo showTagline />
            <p className="mt-3 max-w-xs text-sm font-semibold text-[var(--muted)]">
              Free tools, fast answers, and fun challenges — most of them running right inside your
              browser.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="mb-3 text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
                {column.title}
              </h2>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm font-bold text-[var(--ink)] hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t-2 border-[var(--border)] pt-6 text-sm font-semibold text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} DO101. All rights reserved.</p>
          <p>{SITE.url.replace(/^https?:\/\//, "")}</p>
        </div>
      </div>
    </footer>
  );
}
