"use client";

import * as React from "react";
import { Input, Label } from "@/components/ui/Field";
import { catchUp, catchUpDoc, SIGNAL_LABELS } from "@/lib/worktools/catchup";
import { formatDue, isoDate } from "@/lib/worktools/dates";
import { downloadBlob, fileName, toDocx, toIcs, toXlsx } from "@/lib/worktools/export";
import { itemsEvents, itemsSheets } from "@/lib/worktools/item-export";
import { parseMessages } from "@/lib/worktools/messages";
import { ExportBar, HowItWorks, TextSource, useToday } from "./shared";

const SAMPLE = `[2026-09-10 09:00] Tom: Morning all, coffee machine is fixed.
[2026-09-15 10:02] Priya Nair: Hi all — the client demo is postponed to Oct 2.
[2026-09-15 11:30] Sam Ortiz: Alex, can you review the Q4 budget by Friday? Finance needs it before close.
[2026-09-16 14:10] Lee: We decided to switch the newsletter to monthly.
[2026-09-16 15:45] Ken: Lunch was great today
[2026-09-17 09:20] Priya Nair: @channel new expense policy: receipts over ¥5,000 need manager approval from next week.
[2026-09-17 16:00] Mei: Alex, do you still have the login for the analytics dashboard?
[2026-09-18 12:00] Sam Ortiz: Outage on the payments page this morning — resolved at 11:40, post-mortem on Tuesday.`;

/**
 * Back from time off: the messages that matter to you, ranked, with the
 * reasons — so you read the ten that count before the three hundred that do not.
 */
export function CatchUp() {
  const now = useToday();
  const [text, setText] = React.useState("");
  const [me, setMe] = React.useState("");
  const [since, setSince] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);

  const messages = React.useMemo(() => parseMessages(text), [text]);
  const result = React.useMemo(
    () => (now ? catchUp(messages, { me, since: since || null, now }) : null),
    [messages, me, since, now],
  );
  const highlights = result ? (showAll ? result.highlights : result.highlights.slice(0, 10)) : [];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="cu-me" hint="recommended">Your name</Label>
          <Input id="cu-me" value={me} placeholder="e.g. Alex" onChange={(e) => setMe(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cu-since" hint="optional">Away since</Label>
          <Input id="cu-since" type="date" value={since} max={now ? isoDate(now) : undefined} onChange={(e) => setSince(e.target.value)} />
        </div>
      </div>

      <TextSource
        id="cu-text"
        label="Messages from while you were away"
        value={text}
        onChange={setText}
        sample={SAMPLE}
        rows={12}
        placeholder={"Paste a channel, a chat export or a pile of emails.\n\nTimestamped lines let the date filter work:\n[2026-09-15 10:02] Priya: the demo moved to Oct 2"}
      />

      {result && text.trim() ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Messages read", result.considered],
              ["Need you", result.forYou.length],
              ["Decisions", result.decisions.length],
              ["Deadlines", result.deadlines.length],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl bg-[var(--panel)] px-3 py-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">{label}</p>
                <p className="text-2xl font-extrabold tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          {since && result.undated > 0 ? (
            <p className="rounded-2xl border-2 border-[var(--fire)] bg-[var(--fire-soft)] px-4 py-3 text-xs font-semibold">
              {result.undated} message{result.undated === 1 ? " has" : "s have"} no date, so the &ldquo;away since&rdquo; filter left {result.undated === 1 ? "it" : "them"} out.
              Clear the date to include everything.
            </p>
          ) : null}

          {result.forYou.length > 0 ? (
            <section>
              <h3 className="mb-2 text-base font-extrabold">🙋 Needs you</h3>
              <ul className="space-y-1.5">
                {result.forYou.map((i) => (
                  <li key={i.id} className="rounded-2xl border-2 border-[var(--grass)] bg-[var(--grass-soft)] px-4 py-2 text-sm font-semibold">
                    {i.title}
                    <span className="block text-xs text-[var(--muted)]">
                      from {i.speaker ?? "someone"}{i.due ? ` · ${formatDue(i.due, now!)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {result.decisions.length > 0 ? (
            <section>
              <h3 className="mb-2 text-base font-extrabold">✅ Decided while you were away</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm font-semibold">
                {result.decisions.map((d) => <li key={d.id}>{d.title} <span className="text-[var(--muted)]">— {d.speaker ?? "someone"}</span></li>)}
              </ul>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-base font-extrabold">📬 Most important messages</h3>
            {highlights.length === 0 ? (
              <p className="text-sm font-semibold text-[var(--muted)]">Nothing stood out. Everything here looks like routine chatter.</p>
            ) : (
              <ol className="space-y-2">
                {highlights.map((h) => (
                  <li key={`${h.message.line}`} className="rounded-2xl border-2 border-[var(--border)] px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-extrabold">
                        {h.message.speaker ?? "Someone"}
                        {h.message.timeText ? <span className="ml-2 text-xs font-semibold text-[var(--muted)]">{h.message.timeText}</span> : null}
                      </p>
                      <span className="text-xs font-extrabold tabular-nums text-[var(--muted)]">score {h.score}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{h.message.text}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {h.signals.map((s) => (
                        <span key={s} className="rounded-md bg-[var(--panel-2)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--muted)]">{SIGNAL_LABELS[s]}</span>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {result.highlights.length > 10 ? (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-extrabold underline">
                {showAll ? "Show the top 10 only" : `Show all ${result.highlights.length}`}
              </button>
            ) : null}
            {result.considered - result.highlights.length > 0 ? (
              <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                {result.considered - result.highlights.length} message{result.considered - result.highlights.length === 1 ? "" : "s"} had nothing that needed you — safe to skim or skip.
              </p>
            ) : null}
          </section>

          <ExportBar
            disabled={result.considered === 0}
            actions={[
              { label: "Word digest", icon: "📝", run: async () => downloadBlob(await toDocx(catchUpDoc(result, { me, since: since || null }), { title: "What I missed" }), fileName("what i missed", "docx")) },
              { label: "Excel tasks", icon: "📊", run: async () => downloadBlob(await toXlsx(itemsSheets(result.highlights.flatMap((h) => h.items))), fileName("catch-up tasks", "xlsx")) },
              { label: "Deadlines to calendar", icon: "📅", run: () => downloadBlob(toIcs(itemsEvents(result.deadlines)), fileName("catch-up deadlines", "ics")) },
            ]}
          />
        </>
      ) : null}

      <HowItWorks>
        <p>
          Every message is scored on signals: it names you (+5), asks you something (+4), records a decision (+3), sets a
          deadline (+3), announces a change like a postponement or outage (+3), is marked urgent (+2), or goes to everyone
          (+2). The score and the reasons are shown on each message, so you can see why it ranked where it did.
        </p>
        <p>
          It does not summarise in its own words — that would need an AI service. It chooses and orders the messages
          themselves, which means nothing is paraphrased wrongly. Nothing you paste leaves your browser.
        </p>
      </HowItWorks>
    </div>
  );
}
