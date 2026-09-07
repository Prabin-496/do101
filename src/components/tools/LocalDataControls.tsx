"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { clearAllLocal, STORAGE_KEYS } from "@/lib/utils/storage";
import { useLocalValue } from "@/lib/utils/use-local";
import type { StreakState } from "@/lib/gamify";

/** Lets a visitor see and wipe everything DO101 has stored on their device. */
export function LocalDataControls() {
  const recent = useLocalValue<string[]>(STORAGE_KEYS.recent, []);
  const xp = useLocalValue<number>(STORAGE_KEYS.xp, 0);
  const streak = useLocalValue<StreakState>(STORAGE_KEYS.streak, {
    lastActive: "",
    current: 0,
    best: 0,
  });
  const [cleared, setCleared] = React.useState(false);

  return (
    <Card className="p-5">
      <h3 className="text-lg">Your local data</h3>
      <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
        Everything DO101 stores lives in this browser only. Nothing here has been sent to a server.
      </p>

      <ul className="mt-4 space-y-1 text-sm font-bold">
        <li>Recent tools remembered: {recent.length}</li>
        <li>XP earned on this device: {xp}</li>
        <li>
          Current streak: {streak.current} day{streak.current === 1 ? "" : "s"}
        </li>
        <li>Personal bests: stored per game</li>
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          tone="cherry"
          onClick={() => {
            clearAllLocal();
            setCleared(true);
          }}
        >
          Erase all local data
        </Button>
        {cleared ? (
          <span role="status" className="text-sm font-extrabold text-[var(--grass)]">
            Cleared from this browser.
          </span>
        ) : null}
      </div>
    </Card>
  );
}
