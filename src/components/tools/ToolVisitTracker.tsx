"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { readLocal, writeLocal, STORAGE_KEYS } from "@/lib/utils/storage";

/** Records the visit in local "recent tools" and fires an analytics event. */
export function ToolVisitTracker({ id }: { id: string }) {
  useEffect(() => {
    track("tool_open", { tool: id });
    const recent = readLocal<string[]>(STORAGE_KEYS.recent, []);
    const next = [id, ...recent.filter((r) => r !== id)].slice(0, 12);
    writeLocal(STORAGE_KEYS.recent, next);
  }, [id]);

  return null;
}
