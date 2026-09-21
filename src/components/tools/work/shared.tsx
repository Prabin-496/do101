"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { formatDue } from "@/lib/worktools/dates";
import type { ItemKind, Priority, WorkItem } from "@/lib/worktools/items";
import { cn } from "@/lib/utils/cn";

/* ------------------------------ today's date ------------------------------ */

let today: Date | null = null;
let dayTimer: number | null = null;
const dayListeners = new Set<() => void>();

function subscribeDay(onChange: () => void): () => void {
  dayListeners.add(onChange);
  if (dayTimer === null) {
    today = new Date();
    // Checked once a minute; listeners only hear about it when the date changes.
    dayTimer = window.setInterval(() => {
      const next = new Date();
      if (!today || next.toDateString() !== today.toDateString()) {
        today = next;
        for (const listener of dayListeners) listener();
      }
    }, 60_000);
  }
  return () => {
    dayListeners.delete(onChange);
    if (dayListeners.size === 0 && dayTimer !== null) {
      window.clearInterval(dayTimer);
      dayTimer = null;
    }
  };
}

/**
 * Today, as far as the visitor's own calendar is concerned. Null on the server
 * and the first client render, so both agree; the real date arrives after.
 * Changes once a day, not once a second, so results are not recomputed.
 */
export function useToday(): Date | null {
  return React.useSyncExternalStore(subscribeDay, () => today, () => null);
}

/* ------------------------------- text input ------------------------------- */

const TEXT_TYPES = ".txt,.md,.vtt,.srt,.csv,.eml,.log,.json,.html,.htm,.docx";

/** Pulls the plain text out of a file: Word via mammoth, everything else as text. */
export async function readTextFile(file: File): Promise<string> {
  if (/\.docx$/i.test(file.name)) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return value;
  }
  const text = await file.text();
  if (/\.html?$/i.test(file.name)) {
    const doc = new DOMParser().parseFromString(text, "text/html");
    return doc.body?.innerText ?? doc.body?.textContent ?? text;
  }
  // SubRip subtitles: drop the cue numbers and timings, keep what was said.
  if (/\.srt$/i.test(file.name)) {
    return text.replace(/^\d+\s*$/gm, "").replace(/^\d{2}:\d{2}:\d{2},\d{3}\s*-->.*$/gm, "").replace(/\n{2,}/g, "\n").trim();
  }
  return text;
}

export function TextSource({
  id,
  label,
  value,
  onChange,
  placeholder,
  sample,
  rows = 10,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  sample?: string;
  rows?: number;
  hint?: string;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const load = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      onChange(await readTextFile(file));
    } catch {
      setError(`${file.name} could not be read. Try saving it as .txt or .docx.`);
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
          {label}
        </label>
        <div className="flex flex-wrap gap-2">
          {sample ? (
            <button type="button" className="text-xs font-extrabold underline" onClick={() => onChange(sample)}>
              Try an example
            </button>
          ) : null}
          <button type="button" className="text-xs font-extrabold underline" onClick={() => fileRef.current?.click()}>
            Open a file
          </button>
          {value ? (
            <button type="button" className="text-xs font-extrabold text-[var(--muted)] underline" onClick={() => onChange("")}>
              Clear
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={TEXT_TYPES}
        className="sr-only"
        onChange={(e) => {
          void load(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void load(e.dataTransfer.files?.[0]);
        }}
        className={cn("font-mono text-sm", dragging && "border-[var(--grass)] bg-[var(--grass-soft)]")}
      />
      <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
        {error ?? hint ?? "Paste text, or drop a .txt, .docx, .vtt or .srt file. It is read in your browser — nothing is uploaded."}
      </p>
    </div>
  );
}

/* ---------------------------- editable results ---------------------------- */

const PRIORITY_STYLE: Record<Priority, string> = {
  high: "bg-[var(--cherry-soft)] text-[var(--cherry-dark)] dark:text-[var(--cherry)]",
  medium: "bg-[var(--sun-soft)] text-[var(--ink)]",
  low: "bg-[var(--panel-2)] text-[var(--muted)]",
};

const KIND_LABEL: Record<ItemKind, string> = { action: "Action", decision: "Decision", question: "Question" };

export function ItemsTable({
  items,
  onChange,
  now,
  owners,
  empty,
}: {
  items: WorkItem[];
  onChange: (items: WorkItem[]) => void;
  now: Date;
  owners: string[];
  empty: string;
}) {
  const update = (id: string, patch: Partial<WorkItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const listId = React.useId();

  if (items.length === 0) {
    return <p className="rounded-2xl bg-[var(--panel)] px-4 py-6 text-center text-sm font-semibold text-[var(--muted)]">{empty}</p>;
  }

  return (
    <div className="do-scroll overflow-x-auto rounded-2xl border-2 border-[var(--border)]">
      <datalist id={listId}>
        {owners.map((o) => <option key={o} value={o} />)}
      </datalist>
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-[var(--panel)] text-left text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
          <tr>
            <th className="w-8 px-2 py-2" aria-label="Done" />
            <th className="px-2 py-2">What</th>
            <th className="w-36 px-2 py-2">Owner</th>
            <th className="w-40 px-2 py-2">Due</th>
            <th className="w-32 px-2 py-2">Priority</th>
            <th className="w-10 px-2 py-2" aria-label="Remove" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={cn("border-t border-[var(--border)] align-top", item.done && "opacity-50")}>
              <td className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) => update(item.id, { done: e.target.checked })}
                  aria-label={`Mark "${item.title}" done`}
                  className="mt-2 h-4 w-4 accent-[var(--grass)]"
                />
              </td>
              <td className="px-2 py-2">
                <div className="flex items-start gap-2">
                  {item.kind !== "action" ? (
                    <span className="mt-2 shrink-0 rounded-md bg-[var(--sky-soft)] px-1.5 text-[10px] font-extrabold uppercase text-[var(--sky-dark)]">
                      {KIND_LABEL[item.kind]}
                    </span>
                  ) : null}
                  <input
                    value={item.title}
                    onChange={(e) => update(item.id, { title: e.target.value })}
                    className="do-input !py-1.5 text-sm font-semibold"
                    aria-label="Task"
                  />
                </div>
                <details className="mt-1 text-xs text-[var(--muted)]">
                  <summary className="cursor-pointer font-semibold">
                    Why this was picked out{item.forMe ? " · for you" : ""}
                  </summary>
                  <p className="mt-1 font-semibold">{item.reason}</p>
                  <p className="mt-1 italic">“{item.source}”{item.speaker ? ` — ${item.speaker}` : ""}, line {item.line}</p>
                </details>
              </td>
              <td className="px-2 py-2">
                <input
                  value={item.owner ?? ""}
                  list={listId}
                  placeholder="Unassigned"
                  onChange={(e) => update(item.id, { owner: e.target.value || null })}
                  className="do-input !py-1.5 text-sm"
                  aria-label="Owner"
                />
              </td>
              <td className="px-2 py-2">
                <input
                  type="date"
                  value={item.due ?? ""}
                  onChange={(e) => update(item.id, { due: e.target.value || null })}
                  className="do-input !py-1.5 text-sm"
                  aria-label="Due date"
                />
                {item.due ? <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">{formatDue(item.due, now)}</p> : null}
              </td>
              <td className="px-2 py-2">
                <select
                  value={item.priority}
                  onChange={(e) => update(item.id, { priority: e.target.value as Priority })}
                  className={cn("do-input !py-1.5 text-sm font-extrabold", PRIORITY_STYLE[item.priority])}
                  aria-label="Priority"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </td>
              <td className="px-2 py-2">
                <button
                  type="button"
                  onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                  className="mt-1.5 rounded-lg px-2 py-1 text-[var(--muted)] hover:bg-[var(--panel)]"
                  aria-label={`Remove "${item.title}"`}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function blankItem(kind: ItemKind = "action"): WorkItem {
  return {
    id: `new-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    title: "",
    owner: null,
    due: null,
    dueTime: null,
    dueText: null,
    priority: "medium",
    reason: "Added by hand.",
    source: "",
    speaker: null,
    line: 0,
    time: null,
    forMe: false,
    done: false,
  };
}

/* --------------------------------- export --------------------------------- */

export interface ExportAction {
  label: string;
  icon: string;
  run: () => Promise<void> | void;
}

/** One row of download buttons. The file is the only copy — nothing is kept here. */
export function ExportBar({ actions, disabled, note }: { actions: ExportAction[]; disabled?: boolean; note?: string }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            tone="panel"
            size="sm"
            disabled={disabled || busy !== null}
            onClick={async () => {
              setBusy(action.label);
              setError(null);
              try {
                await action.run();
              } catch {
                setError(`${action.label} could not be created. Please try again.`);
              } finally {
                setBusy(null);
              }
            }}
          >
            <span aria-hidden className="mr-1">{action.icon}</span>
            {busy === action.label ? "Preparing…" : action.label}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
        {error ?? note ?? "Your file is created in this browser and saved to your device. DO101 keeps no copy."}
      </p>
    </div>
  );
}

export function CopyText({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      tone="panel"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked — the text is still on screen to select */
        }
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

export function HowItWorks({ children }: { children: React.ReactNode }) {
  return (
    <details className="rounded-2xl border-2 border-[var(--border)] px-4 py-3 text-sm">
      <summary className="cursor-pointer font-extrabold">How this works, and what it cannot do</summary>
      <div className="mt-2 space-y-2 text-xs font-semibold text-[var(--muted)]">{children}</div>
    </details>
  );
}
