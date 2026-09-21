"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { downloadBlob, fileName, toCsv, toIcs, toXlsx } from "@/lib/worktools/export";
import { itemsCsvRows, itemsEvents, itemsSheets } from "@/lib/worktools/item-export";
import { extractItems, sortByUrgency, type WorkItem } from "@/lib/worktools/items";
import { parseMessages } from "@/lib/worktools/messages";
import { Chip, ChipRow } from "../trading/shared";
import { blankItem, CopyText, ExportBar, HowItWorks, ItemsTable, TextSource, useToday } from "./shared";

const SAMPLE = `From: Dana Whitfield <dana@northwind.com>
Date: Mon, 21 Sep 2026 08:12:00
Subject: Q4 renewal

Hi Alex,

Thanks for the call. Could you send the revised quote by Wednesday? Please also include the onboarding timeline.
We decided to go with the annual plan.

Dana

From: Sam Ortiz <sam@ourteam.com>
Date: Mon, 21 Sep 2026 09:40:00
Subject: Re: website

Alex, can you review the new pricing page before Thursday's release? It's urgent — legal flagged the refund wording.
I'll fix the footer links today.

From: Priya Nair <priya@ourteam.com>
Date: Mon, 21 Sep 2026 10:05:00
Subject: offsite

Hi all, please book your train tickets for the offsite by end of month.`;

/**
 * Commitments buried in email and chat, pulled out into one prioritised list —
 * with what was asked of you at the top.
 */
export function TaskExtractor() {
  const now = useToday();
  const [text, setText] = React.useState("");
  const [me, setMe] = React.useState("");
  const [filter, setFilter] = React.useState<"mine" | "all">("all");
  const [edited, setEdited] = React.useState<WorkItem[] | null>(null);

  const [source, setSource] = React.useState(text + me);
  if (source !== text + me) {
    setSource(text + me);
    setEdited(null);
  }

  const messages = React.useMemo(() => parseMessages(text), [text]);
  const extracted = React.useMemo(
    () => (now ? sortByUrgency(extractItems(messages, { now, me }), now).filter((i) => i.kind !== "decision") : []),
    [messages, now, me],
  );
  const items = edited ?? extracted;
  const shown = filter === "mine" ? items.filter((i) => i.forMe) : items;
  const mine = items.filter((i) => i.forMe && !i.done).length;
  const owners = [...new Set(items.map((i) => i.owner).filter((o): o is string => Boolean(o)))];

  const plannerText = items
    .filter((i) => i.kind === "action" && !i.done && (filter === "all" || i.forMe))
    .map((i) => `${i.title}${i.priority === "high" ? " !!" : i.priority === "low" ? " !low" : ""}${i.due ? ` by ${i.due}` : ""}`)
    .join("\n");

  return (
    <div className="space-y-5">
      <div className="max-w-sm">
        <Label htmlFor="te-me" hint="recommended">Your name</Label>
        <Input id="te-me" value={me} placeholder="So requests to you rise to the top" onChange={(e) => setMe(e.target.value)} />
      </div>

      <TextSource
        id="te-text"
        label="Emails or chat messages"
        value={text}
        onChange={setText}
        sample={SAMPLE}
        rows={12}
        placeholder={"Paste an email thread, a Slack or Teams channel, or a chat export.\n\nEmail headers (From: / Date: / Subject:) and chat formats like\n[2026-09-21 10:02] Sam: can you review the PR?\nare recognised."}
        hint="Paste as many messages as you like. Quoted replies (lines starting with >) are skipped so tasks are not counted twice."
      />

      {text.trim() && now ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-extrabold">
              {items.length} task{items.length === 1 ? "" : "s"} found{me ? ` · ${mine} for you` : ""} · most urgent first
            </p>
            <ChipRow ariaLabel="Filter">
              <Chip active={filter === "all"} onClick={() => setFilter("all")}>Everything</Chip>
              <Chip active={filter === "mine"} onClick={() => setFilter("mine")}>Only mine</Chip>
            </ChipRow>
          </div>

          <ItemsTable
            items={shown}
            onChange={(next) => setEdited(filter === "mine" ? [...items.filter((i) => !i.forMe), ...next] : next)}
            now={now}
            owners={owners}
            empty={filter === "mine" ? (me ? `Nothing addressed to ${me} was found.` : "Enter your name above to see what is yours.") : "No tasks found. Requests (\"can you…\", \"please…\") and commitments (\"I'll…\") are what it looks for."}
          />
          <Button tone="ghost" size="sm" onClick={() => setEdited([...items, { ...blankItem(), forMe: filter === "mine" }])}>+ Add one by hand</Button>

          <ExportBar
            disabled={items.length === 0}
            actions={[
              { label: "Excel task list", icon: "📊", run: async () => downloadBlob(await toXlsx(itemsSheets(items)), fileName("tasks from messages", "xlsx")) },
              { label: "Deadlines to calendar", icon: "📅", run: () => downloadBlob(toIcs(itemsEvents(items)), fileName("task deadlines", "ics")) },
              { label: "CSV", icon: "🧾", run: () => downloadBlob(toCsv(itemsCsvRows(items)), fileName("tasks from messages", "csv")) },
            ]}
          />
          {plannerText ? (
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[var(--muted)]">
              <CopyText text={plannerText} label="Copy for the Daily Planner" />
              <span>
                Paste into the <Link href="/tools/daily-planner" className="underline">Daily Work Planner</Link> to fit these into your day.
              </span>
            </div>
          ) : null}
        </>
      ) : null}

      <HowItWorks>
        <p>
          Messages are split by sender using email headers or chat formats, then each sentence is checked for requests
          (&ldquo;could you…&rdquo;, &ldquo;please…&rdquo;, &ldquo;〜お願いします&rdquo;), commitments (&ldquo;I&rsquo;ll…&rdquo;) and instructions. Priority comes from
          words like &ldquo;urgent&rdquo; or &ldquo;ASAP&rdquo; and from how soon the deadline is.
        </p>
        <p>
          Nothing connects to your mailbox or Slack — you paste what you want checked, and it never leaves this page.
          Rules miss unusual phrasing, so check the list and add anything it missed before exporting.
        </p>
      </HowItWorks>
    </div>
  );
}
