"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { isoDate } from "@/lib/worktools/dates";
import { downloadBlob, fileName, toCsv, toDocx, toIcs, toXlsx } from "@/lib/worktools/export";
import { followUpEmail, itemsCsvRows, itemsEvents, itemsSheets, minutesDoc } from "@/lib/worktools/item-export";
import { extractItems, groupByOwner, sortByUrgency, type WorkItem } from "@/lib/worktools/items";
import { parseMessages } from "@/lib/worktools/messages";
import { blankItem, CopyText, ExportBar, HowItWorks, ItemsTable, TextSource, useToday } from "./shared";

const SAMPLE = `Priya: Thanks everyone. Main topic is the October launch.
Tom: We agreed to launch on October 1 instead of September 25.
Priya: Tom, can you update the launch checklist by Friday?
Tom: Sure. I'll also send the press release draft to legal tomorrow.
Mei: I'll book the photographer for the product shots.
Priya: Mei, please confirm the budget with finance by end of week — it's urgent.
Ken: Who is handling the customer email?
Priya: Ken to draft the customer announcement by next Monday.
Mei: Do we still need the Japanese translation?
Priya: Action: renew the domain before it expires on Sep 30.`;

/**
 * Meeting notes or a transcript in; decisions, owned tasks and a follow-up
 * email out. Every result is editable before it is downloaded, because the
 * rules that find them are good but not psychic.
 */
export function MeetingActions() {
  const now = useToday();
  const [text, setText] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [me, setMe] = React.useState("");
  const [view, setView] = React.useState("action");
  const [edited, setEdited] = React.useState<WorkItem[] | null>(null);

  // New text means new results; any hand edits belong to the old text.
  const [source, setSource] = React.useState(text + me);
  if (source !== text + me) {
    setSource(text + me);
    setEdited(null);
  }

  const messages = React.useMemo(() => parseMessages(text), [text]);
  const extracted = React.useMemo(
    () => (now ? sortByUrgency(extractItems(messages, { now, me, allQuestions: true }), now) : []),
    [messages, now, me],
  );
  const items = edited ?? extracted;
  const attendees = [...new Set(messages.map((m) => m.speaker).filter((s): s is string => Boolean(s)))];
  const owners = [...new Set([...attendees, ...items.map((i) => i.owner).filter((o): o is string => Boolean(o))])];
  const date = now ? isoDate(now) : "";
  const meta = { title: title || "Meeting", date, attendees };

  const byKind = (kind: WorkItem["kind"]) => items.filter((i) => i.kind === kind);
  const setKind = (kind: WorkItem["kind"], next: WorkItem[]) => setEdited([...items.filter((i) => i.kind !== kind), ...next]);
  const actions = byKind("action");

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="mt-title">Meeting name</Label>
          <Input id="mt-title" value={title} placeholder="e.g. Launch planning" onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="mt-me" hint="optional">Your name</Label>
          <Input id="mt-me" value={me} placeholder="Highlights what is yours" onChange={(e) => setMe(e.target.value)} />
        </div>
      </div>

      <TextSource
        id="mt-text"
        label="Meeting notes or transcript"
        value={text}
        onChange={setText}
        sample={SAMPLE}
        rows={12}
        placeholder={"Paste notes or a transcript. Speaker names help:\n\nPriya: Tom, can you update the checklist by Friday?\nTom: Sure, I'll send it tomorrow.\nAction: book the room"}
        hint="Works with Zoom, Teams and Google Meet transcripts (.vtt), plain minutes, and English or Japanese. Read in your browser — nothing is uploaded."
      />

      {text.trim() ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Action items", actions.length, "action"],
              ["Decisions", byKind("decision").length, "decision"],
              ["Open questions", byKind("question").length, "question"],
            ].map(([label, count, id]) => (
              <button
                key={id as string}
                type="button"
                onClick={() => setView(id as string)}
                className={`rounded-2xl border-2 px-3 py-2 text-left ${view === id ? "border-[var(--grass)] bg-[var(--grass-soft)]" : "border-[var(--border)] bg-[var(--panel)]"}`}
              >
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">{label}</p>
                <p className="text-2xl font-extrabold tabular-nums">{count}</p>
              </button>
            ))}
          </div>

          {actions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {[...groupByOwner(actions.filter((a) => !a.done))].map(([owner, list]) => (
                <span key={owner} className="rounded-xl bg-[var(--panel)] px-3 py-1 text-xs font-extrabold">
                  {owner} · {list.length}
                </span>
              ))}
            </div>
          ) : null}

          <Tabs
            ariaLabel="Result type"
            value={view}
            onChange={setView}
            items={[
              { id: "action", label: "Action items" },
              { id: "decision", label: "Decisions" },
              { id: "question", label: "Open questions" },
              { id: "email", label: "Follow-up email" },
            ]}
          />

          {view === "email" ? (
            <div className="space-y-2">
              <pre className="do-scroll max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-4 text-sm">
                {followUpEmail(items, meta)}
              </pre>
              <CopyText text={followUpEmail(items, meta)} label="Copy email" />
            </div>
          ) : now ? (
            <div className="space-y-2">
              <ItemsTable
                items={byKind(view as WorkItem["kind"])}
                onChange={(next) => setKind(view as WorkItem["kind"], next)}
                now={now}
                owners={owners}
                empty={view === "action" ? "No action items found. Try phrases like \"can you…\", \"I'll…\" or \"Action:\"." : "None found."}
              />
              <Button tone="ghost" size="sm" onClick={() => setKind(view as WorkItem["kind"], [...byKind(view as WorkItem["kind"]), blankItem(view as WorkItem["kind"])])}>
                + Add one by hand
              </Button>
            </div>
          ) : null}

          <ExportBar
            disabled={items.length === 0}
            actions={[
              { label: "Excel tracker", icon: "📊", run: async () => downloadBlob(await toXlsx(itemsSheets(items)), fileName(`${meta.title} actions`, "xlsx")) },
              { label: "Word minutes", icon: "📝", run: async () => downloadBlob(await toDocx(minutesDoc(items, meta), { title: meta.title }), fileName(`${meta.title} minutes`, "docx")) },
              { label: "Deadlines to calendar", icon: "📅", run: () => downloadBlob(toIcs(itemsEvents(items)), fileName(`${meta.title} deadlines`, "ics")) },
              { label: "CSV", icon: "🧾", run: () => downloadBlob(toCsv(itemsCsvRows(items)), fileName(`${meta.title} actions`, "csv")) },
            ]}
            note={`The calendar file adds ${itemsEvents(items).length} dated task${itemsEvents(items).length === 1 ? "" : "s"} to Google Calendar, Outlook or Apple Calendar. Nothing is kept by DO101 — the file is the record.`}
          />
        </>
      ) : null}

      <HowItWorks>
        <p>
          Each sentence is checked against plain rules: is it marked (&ldquo;Action:&rdquo;, &ldquo;TODO&rdquo;, a checkbox), does someone commit
          (&ldquo;I&rsquo;ll send…&rdquo;, &ldquo;〜します&rdquo;), ask (&ldquo;can you…&rdquo;, &ldquo;please…&rdquo;, &ldquo;〜お願いします&rdquo;), or record a decision
          (&ldquo;we agreed…&rdquo;). Owners come from who spoke, who was named or @mentioned, and deadlines from phrases like
          &ldquo;by Friday&rdquo;, &ldquo;EOD&rdquo; or &ldquo;明日まで&rdquo;. Open &ldquo;Why this was picked out&rdquo; on any row to see the rule.
        </p>
        <p>
          It is not AI, so it runs instantly, free, and without your notes leaving the browser. The trade-off: it will
          miss tasks phrased in ways it has no rule for, and occasionally pick up a sentence that only sounds like a task.
          Everything is editable before you download it, and you can add rows by hand.
        </p>
      </HowItWorks>
    </div>
  );
}
