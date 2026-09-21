"use client";

import { useTheme } from "next-themes";
import { useIsHydrated } from "@/lib/utils/use-local";

const OPTIONS = [
  { id: "light", icon: "☀️", label: "Light" },
  { id: "dark", icon: "🌙", label: "Dark" },
  { id: "system", icon: "🖥️", label: "System" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useIsHydrated();

  const cycle = () => {
    const index = OPTIONS.findIndex((o) => o.id === (theme ?? "system"));
    setTheme(OPTIONS[(index + 1) % OPTIONS.length].id);
  };

  const current = OPTIONS.find((o) => o.id === (theme ?? "system")) ?? OPTIONS[2];

  // The stored choice only exists in the browser, so the server render and the
  // first client render both have to show the system default. Every attribute
  // here comes from the same value: one of them disagreeing is a hydration
  // mismatch, which is what happened when only the icon and the label were
  // guarded and the title was not.
  const shown = mounted ? current : OPTIONS[2];

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${shown.label} — click to change`}
      aria-label={`Change theme. Current theme: ${shown.label}`}
      className="grid h-10 w-10 place-items-center rounded-xl border-2 border-[var(--border)] text-base transition-colors hover:bg-[var(--panel)]"
    >
      <span aria-hidden>{shown.icon}</span>
    </button>
  );
}
