"use client";

import * as React from "react";
import { Input, Label, Select } from "@/components/ui/Field";
import { isoDate } from "@/lib/worktools/dates";
import { downloadBlob, fileName, toDocx, toXlsx } from "@/lib/worktools/export";
import { parseLog, reportDoc, reportSheets, reportText, STATUS_LABELS, summarise, type EntryStatus, type LogEntry } from "@/lib/worktools/report";
import { Chip, ChipRow } from "../trading/shared";
import { CopyText, ExportBar, HowItWorks, TextSource, useToday } from "./shared";

const SAMPLE = `Monday
#web fixed the checkout timeout bug (2h)
#web working on the new pricing page 1.5h
reviewed Sam's PR for the search filter #web 30m
#ops waiting on legal for the vendor contract

Tuesday
#ops renewed the SSL certificates (45m)
#web pricing page — drafting copy with marketing (2h)
customer call with Northwind about onboarding 1h
tomorrow: finish the pricing page and send for review
TODO: book the offsite venue`;

/**
 * A work log in whatever shape you keep it, turned into a stand-up or weekly
 * report — sorted, grouped by project, with the hours added up.
 */
export function ReportGenerator() {
  const now = useToday();
  const [log, setLog] = React.useState("");
  const [name, setName] = React.useState("");
  const [team, setTeam] = React.useState("");
  const [kind, setKind] = React.useState<"daily" | "weekly">("weekly");
  const [edited, setEdited] = React.useState<LogEntry[] | null>(null);

  const [source, setSource] = React.useState(log);
  if (source !== log) {
    setSource(log);
    setEdited(null);
  }

  const parsed = React.useMemo(() => (now && log.trim() ? parseLog(log, now) : []), [log, now]);
  const entries = edited ?? parsed;
  const options = { kind, name, team, date: now ? isoDate(now) : "" };
  const summary = summarise(entries);
  const text = entries.length ? reportText(entries, options) : "";
  const update = (id: string, patch: Partial<LogEntry>) => setEdited(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label htmlFor="rp-name">Your name</Label><Input id="rp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ana" /></div>
        <div><Label htmlFor="rp-team" hint="optional">Team</Label><Input id="rp-team" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="e.g. Web team" /></div>
        <div>
          <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">Report</p>
          <ChipRow ariaLabel="Report type">
            <Chip active={kind === "daily"} onClick={() => setKind("daily")}>Daily stand-up</Chip>
            <Chip active={kind === "weekly"} onClick={() => setKind("weekly")}>Weekly report</Chip>
          </ChipRow>
        </div>
      </div>

      <TextSource
        id="rp-log"
        label="Your work log or notes"
        value={log}
        onChange={setLog}
        sample={SAMPLE}
        rows={12}
        placeholder={"One thing per line, however you write it:\n\nMonday\n#web fixed login bug (2h)\nwaiting on legal for contract\ntomorrow: finish the deck"}
        hint="Tag projects with #name, [Name] or 'Name — …'. Hours like (2h) or 45m are added up. Day headings (Monday, 2026-09-21) date the lines below them."
      />

      {entries.length ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(["done", "progress", "blocked", "next"] as EntryStatus[]).map((s) => (
              <div key={s} className="rounded-2xl bg-[var(--panel)] px-3 py-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">{STATUS_LABELS[s]}</p>
                <p className="text-2xl font-extrabold tabular-nums">{summary.counts[s]}</p>
              </div>
            ))}
            <div className="rounded-2xl bg-[var(--panel)] px-3 py-2">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">Time logged</p>
              <p className="text-2xl font-extrabold tabular-nums">{summary.minutes ? `${(summary.minutes / 60).toFixed(1)}h` : "—"}</p>
            </div>
          </div>

          <details className="rounded-2xl border-2 border-[var(--border)] px-4 py-3" open>
            <summary className="cursor-pointer text-sm font-extrabold">Check how each line was read ({entries.length})</summary>
            <div className="do-scroll mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  <tr><th className="py-1">Status</th><th className="py-1">Project</th><th className="py-1">Entry</th><th className="py-1">Min</th></tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-[var(--border)]">
                      <td className="py-1 pr-2">
                        <Select value={e.status} onChange={(ev) => update(e.id, { status: ev.target.value as EntryStatus })} className="!py-1 text-xs" aria-label="Status">
                          {(Object.keys(STATUS_LABELS) as EntryStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                        </Select>
                      </td>
                      <td className="py-1 pr-2"><Input value={e.project ?? ""} placeholder="General" onChange={(ev) => update(e.id, { project: ev.target.value || null })} className="!py-1 text-xs" aria-label="Project" /></td>
                      <td className="py-1 pr-2"><Input value={e.text} onChange={(ev) => update(e.id, { text: ev.target.value })} className="!py-1 text-xs" aria-label="Entry" /></td>
                      <td className="w-20 py-1"><Input type="number" value={e.minutes ?? ""} onChange={(ev) => update(e.id, { minutes: ev.target.value ? Number(ev.target.value) : null })} className="!py-1 text-xs" aria-label="Minutes" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <section>
            <h3 className="mb-2 text-base font-extrabold">Your report</h3>
            <pre className="do-scroll max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-4 text-sm">{text}</pre>
            <div className="mt-2"><CopyText text={text} label="Copy for Slack, Teams or email" /></div>
          </section>

          <ExportBar
            actions={[
              { label: "Word report", icon: "📝", run: async () => downloadBlob(await toDocx(reportDoc(entries, options), { title: kind === "daily" ? "Daily update" : "Weekly report", creator: name || "DO101" }), fileName(`${kind} report ${name}`, "docx")) },
              { label: "Excel log", icon: "📊", run: async () => downloadBlob(await toXlsx(reportSheets(entries)), fileName(`work log ${name}`, "xlsx")) },
            ]}
          />
        </>
      ) : null}

      <HowItWorks>
        <p>
          Each line is sorted by its words: &ldquo;fixed&rdquo;, &ldquo;sent&rdquo;, &ldquo;完了&rdquo; mean done; &ldquo;working on&rdquo;, &ldquo;対応中&rdquo; in progress;
          &ldquo;waiting on&rdquo;, &ldquo;blocked&rdquo;, &ldquo;待ち&rdquo; blocked; &ldquo;tomorrow&rdquo;, &ldquo;TODO&rdquo; next. Anything it cannot place stays a note — it
          never invents what you did. Check the table and change any status before you download.
        </p>
      </HowItWorks>
    </div>
  );
}
