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

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${current.label} — click to change`}
      aria-label={`Change theme. Current theme: ${mounted ? current.label : "system"}`}
      className="grid h-10 w-10 place-items-center rounded-xl border-2 border-[var(--border)] text-base transition-colors hover:bg-[var(--panel)]"
    >
      <span aria-hidden>{mounted ? current.icon : "🖥️"}</span>
    </button>
  );
}
