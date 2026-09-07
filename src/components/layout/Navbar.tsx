"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCommandPalette } from "./CommandPalette";
import { ThemeToggle } from "./ThemeToggle";
import { StreakBadge } from "./StreakBadge";
import { Logo } from "./Logo";
import { ToolsMenu } from "./ToolsMenu";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/tools", label: "Tools", icon: "🧰" },
  { href: "/tools/pdf", label: "PDF", icon: "📄" },
  { href: "/news", label: "News", icon: "📰" },
  { href: "/calculators", label: "Calculators", icon: "🧮" },
  { href: "/games", label: "Games", icon: "🎮" },
  { href: "/ai", label: "AI", icon: "🤖" },
  { href: "/about", label: "About", icon: "💡" },
];

/**
 * On desktop the Tools menu already covers the categories, so the header keeps
 * only the destinations that are not inside it. The mobile menu lists all of them.
 */
const DESKTOP_LINKS = LINKS.filter((l) => !l.href.startsWith("/tools"));

export function Navbar() {
  const pathname = usePathname();
  const { open } = useCommandPalette();
  // Storing the route the menu was opened on closes it automatically on
  // navigation, with no effect and no stale-open flash.
  const [openedOn, setOpenedOn] = React.useState<string | null>(null);
  const menuOpen = openedOn === pathname;

  return (
    <header className="sticky top-0 z-40 border-b-2 border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4"
      >
        <Logo />

        <ul className="ml-2 hidden items-center gap-1 md:flex">
          <li>
            <ToolsMenu active={pathname.startsWith("/tools")} />
          </li>
          {DESKTOP_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-extrabold uppercase tracking-wide transition-colors",
                    active
                      ? "bg-[var(--panel)] text-[var(--ink)]"
                      : "text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <StreakBadge />
          <button
            type="button"
            onClick={open}
            aria-label="Search tools (Command or Control + K)"
            className="flex h-10 items-center gap-2 rounded-xl border-2 border-[var(--border)] px-3 text-sm font-bold text-[var(--muted)] transition-colors hover:bg-[var(--panel)]"
          >
            <span aria-hidden>🔎</span>
            <span className="hidden lg:inline">Search tools</span>
            <kbd className="hidden rounded-md bg-[var(--panel)] px-1.5 py-0.5 text-[10px] font-extrabold lg:inline">
              ⌘K
            </kbd>
          </button>
          <ThemeToggle />
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setOpenedOn(menuOpen ? null : pathname)}
            className="grid h-10 w-10 place-items-center rounded-xl border-2 border-[var(--border)] md:hidden"
          >
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
            <span aria-hidden>{menuOpen ? "✕" : "☰"}</span>
          </button>
        </div>
      </nav>

      {menuOpen ? (
        <div id="mobile-menu" className="border-t-2 border-[var(--border)] bg-[var(--bg)] md:hidden">
          <ul className="mx-auto grid max-w-6xl gap-1 px-4 py-3">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-extrabold hover:bg-[var(--panel)]"
                >
                  <span aria-hidden>{link.icon}</span>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
