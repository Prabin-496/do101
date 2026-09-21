"use client";

import * as React from "react";
import { Input, Label, Textarea, Toggle } from "@/components/ui/Field";
import { isoDate } from "@/lib/worktools/dates";
import { downloadBlob, fileName, parseIcs, toDocx, toIcs, toXlsx } from "@/lib/worktools/export";
import {
  buildPlan, DEFAULT_SETTINGS, parseEvents, parseTaskList, toMinutes, type Block, type PlanSettings,
} from "@/lib/worktools/planner";
import { cn } from "@/lib/utils/cn";
import { NumberField } from "../trading/shared";
import { CopyText, ExportBar, HowItWorks, useToday } from "./shared";

const SAMPLE_TASKS = `Write the Q4 budget proposal (2h) !! by Friday
Review Sam's pull request (45m)
Reply to client emails (30m)
Prepare slides for Thursday (1.5h)
Update the project tracker 15m
Research new CRM options (1h) !low
Book flights for the offsite 20m`;

const SAMPLE_EVENTS = `10:00-10:30 Team standup
14:00-15:00 Client call`;

const KIND_STYLE: Record<Block["kind"], string> = {
  task: "border-[var(--grass)] bg-[var(--grass-soft)]",
  event: "border-[var(--sky)] bg-[var(--sky-soft)]",
  lunch: "border-[var(--sun)] bg-[var(--sun-soft)]",
  break: "border-[var(--border)] bg-[var(--panel)]",
  free: "border-dashed border-[var(--border)] bg-transparent",
};

const hm = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;

/**
 * Tasks and meetings in, a realistic day out — including the honest list of
 * what did not fit.
 */
export function DailyPlanner() {
  const now = useToday();
  const [tasksText, setTasksText] = React.useState("");
  const [eventsText, setEventsText] = React.useState("");
  const [settings, setSettings] = React.useState<PlanSettings>(DEFAULT_SETTINGS);
  const [icsNote, setIcsNote] = React.useState<string | null>(null);
  const [planDate, setPlanDate] = React.useState<string | null>(null);
  const icsRef = React.useRef<HTMLInputElement>(null);

  const date = planDate ?? (now ? isoDate(now) : "");
  // Files are named for the day being planned, which is not always today.
  const planDay = React.useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    return y ? new Date(y, m - 1, d, 12) : undefined;
  }, [date]);
  const set = <K extends keyof PlanSettings>(key: K, value: PlanSettings[K]) => setSettings((s) => ({ ...s, [key]: value }));

  const plan = React.useMemo(() => {
    if (!now || !tasksText.trim()) return null;
    const tasks = parseTaskList(tasksText, now, settings.defaultMinutes);
    return buildPlan(tasks, parseEvents(eventsText), settings, now);
  }, [tasksText, eventsText, settings, now]);

  const importIcs = async (file: File | undefined) => {
    if (!file) return;
    const events = parseIcs(await file.text()).filter((e) => e.date === date && e.start);
    if (events.length === 0) {
      setIcsNote(`No timed events on ${date} in that file.`);
      return;
    }
    const lines = events.map((e) => `${e.start}-${e.end ?? e.start} ${e.title}`).join("\n");
    setEventsText((current) => (current.trim() ? `${current.trim()}\n${lines}` : lines));
    setIcsNote(`Added ${events.length} event${events.length === 1 ? "" : "s"} from ${file.name}.`);
  };

  const planText = plan
    ? [`Plan for ${date}`, "", ...plan.blocks.map((b) => `${b.start}–${b.end}  ${b.kind === "task" ? "" : `[${b.kind}] `}${b.title}${b.part ? ` (part ${b.part.index}/${b.part.total})` : ""}`), ...(plan.unscheduled.length ? ["", "Does not fit today:", ...plan.unscheduled.map((t) => `• ${t.title} (${t.minutes}m)`)] : [])].join("\n")
    : "";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <label htmlFor="dp-tasks" className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">Tasks, one per line</label>
            <button type="button" className="text-xs font-extrabold underline" onClick={() => { setTasksText(SAMPLE_TASKS); setEventsText(SAMPLE_EVENTS); }}>Try an example</button>
          </div>
          <Textarea
            id="dp-tasks"
            rows={10}
            value={tasksText}
            onChange={(e) => setTasksText(e.target.value)}
            placeholder={"Write the proposal (2h) !! by Friday\nReply to emails 30m\nResearch tools (1h) !low"}
            className="font-mono text-sm"
          />
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
            Add a time like <code>(2h)</code> or <code>45m</code>, <code>!!</code> for urgent, <code>!low</code> for nice-to-have, and a deadline like &ldquo;by Friday&rdquo;.
          </p>
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <label htmlFor="dp-events" className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">Meetings you already have</label>
            <button type="button" className="text-xs font-extrabold underline" onClick={() => icsRef.current?.click()}>Import a calendar file (.ics)</button>
          </div>
          <input ref={icsRef} type="file" accept=".ics,text/calendar" className="sr-only" onChange={(e) => { void importIcs(e.target.files?.[0]); e.target.value = ""; }} />
          <Textarea
            id="dp-events"
            rows={10}
            value={eventsText}
            onChange={(e) => setEventsText(e.target.value)}
            placeholder={"10:00-10:30 Standup\n14:00-15:00 Client call"}
            className="font-mono text-sm"
          />
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
            {icsNote ?? "Export a .ics from Google Calendar, Outlook or Apple Calendar to import your real meetings — the file is read here and never uploaded."}
          </p>
        </div>
      </div>

      <details className="rounded-2xl border-2 border-[var(--border)] px-4 py-3">
        <summary className="cursor-pointer text-sm font-extrabold">Working day settings</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label htmlFor="dp-date">Plan for</Label><Input id="dp-date" type="date" value={date} onChange={(e) => setPlanDate(e.target.value || null)} /></div>
          <div><Label htmlFor="dp-start">Start</Label><Input id="dp-start" type="time" value={settings.dayStart} onChange={(e) => set("dayStart", e.target.value)} /></div>
          <div><Label htmlFor="dp-end">Finish</Label><Input id="dp-end" type="time" value={settings.dayEnd} onChange={(e) => set("dayEnd", e.target.value)} /></div>
          <div><Label htmlFor="dp-lunch">Lunch at</Label><Input id="dp-lunch" type="time" value={settings.lunchStart} onChange={(e) => set("lunchStart", e.target.value)} /></div>
          <NumberField label="Lunch length" value={settings.lunchMinutes} min={0} max={180} step={5} onChange={(v) => set("lunchMinutes", v)} suffix="min" />
          <NumberField label="Break after" value={settings.breakEvery} min={25} max={240} step={5} onChange={(v) => set("breakEvery", v)} suffix="min" />
          <NumberField label="Break length" value={settings.breakMinutes} min={0} max={30} onChange={(v) => set("breakMinutes", v)} suffix="min" />
          <NumberField label="Keep unplanned" value={settings.bufferPercent} min={0} max={60} step={5} hint="for interruptions" onChange={(v) => set("bufferPercent", v)} suffix="%" />
        </div>
        <div className="mt-3 max-w-md">
          <Toggle checked={settings.deepWorkFirst} onChange={(v) => set("deepWorkFirst", v)} label="Long, focused tasks first" description="Hour-plus tasks go into the morning, before energy runs down." />
        </div>
      </details>

      {plan ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Work requested", hm(plan.requested)],
              ["Room for it", hm(plan.capacity)],
              ["Planned", hm(plan.planned)],
              ["Does not fit", plan.overflow ? hm(plan.overflow) : "Nothing"],
            ].map(([label, value], i) => (
              <div key={label} className={cn("rounded-2xl px-3 py-2", i === 3 && plan.overflow ? "bg-[var(--cherry-soft)]" : "bg-[var(--panel)]")}>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">{label}</p>
                <p className="text-xl font-extrabold tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          {plan.warnings.length ? (
            <ul className="space-y-1 rounded-2xl border-2 border-[var(--fire)] bg-[var(--fire-soft)] px-4 py-3 text-xs font-semibold">
              {plan.warnings.map((w) => <li key={w}>⚠️ {w}</li>)}
            </ul>
          ) : null}

          <ol className="space-y-1.5" aria-label={`Plan for ${date}`}>
            {plan.blocks.map((b, i) => (
              <li
                key={i}
                className={cn("flex gap-3 rounded-xl border-2 px-3 py-2", KIND_STYLE[b.kind])}
                style={{ minHeight: Math.max(36, Math.min(120, (toMinutes(b.end) - toMinutes(b.start)) * 0.8)) }}
              >
                <span className="w-24 shrink-0 text-xs font-extrabold tabular-nums text-[var(--muted)]">{b.start}–{b.end}</span>
                <span className={cn("text-sm", b.kind === "task" ? "font-extrabold" : "font-semibold text-[var(--muted)]")}>
                  {b.title}
                  {b.part ? <span className="ml-2 text-xs font-semibold text-[var(--muted)]">part {b.part.index} of {b.part.total}</span> : null}
                  {b.priority === "high" ? <span className="ml-2 rounded bg-[var(--cherry-soft)] px-1.5 text-[10px] font-extrabold text-[var(--cherry-dark)]">URGENT</span> : null}
                </span>
              </li>
            ))}
          </ol>

          {plan.unscheduled.length ? (
            <section>
              <h3 className="mb-2 text-base font-extrabold">Does not fit today</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm font-semibold">
                {plan.unscheduled.map((t) => <li key={t.id}>{t.title} <span className="text-[var(--muted)]">— {t.minutes} min left</span></li>)}
              </ul>
            </section>
          ) : null}

          <ExportBar
            actions={[
              {
                label: "Add plan to calendar",
                icon: "📅",
                run: () => downloadBlob(toIcs(plan.blocks.filter((b) => b.kind === "task").map((b) => ({ title: b.title, date, start: b.start, minutes: toMinutes(b.end) - toMinutes(b.start) }))), fileName("day plan", "ics", planDay)),
              },
              {
                label: "Excel",
                icon: "📊",
                run: async () => downloadBlob(await toXlsx([
                  { name: "Plan", rows: [["Start", "End", "Type", "What"], ...plan.blocks.map((b) => [b.start, b.end, b.kind, b.title])] },
                  { name: "Not today", rows: [["Task", "Minutes left", "Priority", "Due"], ...plan.unscheduled.map((t) => [t.title, t.minutes, t.priority, t.due ?? ""])] },
                ]), fileName("day plan", "xlsx", planDay)),
              },
              {
                label: "Word (printable)",
                icon: "📝",
                run: async () => downloadBlob(await toDocx([
                  { type: "title", text: `Plan for ${date}` },
                  { type: "table", rows: [["Time", "What"], ...plan.blocks.map((b) => [`${b.start}–${b.end}`, `${b.kind === "task" ? "☐ " : ""}${b.title}`])], widths: [1800, 7200] },
                  ...(plan.unscheduled.length ? [{ type: "heading" as const, text: "Does not fit today", level: 2 as const }, { type: "bullets" as const, items: plan.unscheduled.map((t) => t.title) }] : []),
                ], { title: `Plan for ${date}` }), fileName("day plan", "docx", planDay)),
              },
            ]}
            note="The calendar file adds only your task blocks, so importing it will not duplicate the meetings you already have."
          />
          <CopyText text={planText} label="Copy plan as text" />
        </>
      ) : null}

      <HowItWorks>
        <p>
          Meetings and lunch are placed first. The free time left is reduced by your &ldquo;keep unplanned&rdquo; share — every
          day has interruptions — and tasks fill the rest in order: anything due today, then urgent, then by deadline,
          with long tasks first if you ask for that. Tasks too long for one gap are split around meetings, and a break
          goes in after each long stretch of focus.
        </p>
        <p>
          It does not read your calendar account — you import a calendar file or type your meetings, and nothing leaves
          your browser. Whatever does not fit is listed, not squeezed in: a plan you cannot follow is worse than none.
        </p>
      </HowItWorks>
    </div>
  );
}
