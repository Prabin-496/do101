"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { isoDate } from "@/lib/worktools/dates";
import { downloadBlob, fileName, readSheetRows, toXlsx } from "@/lib/worktools/export";
import {
  followUpFor, followUpMessage, leadsFromRows, leadsToRows, LEAD_HEADER, STAGE_MAP, STAGES, type Lead, type Stage,
} from "@/lib/worktools/followup";
import { writeLocal } from "@/lib/utils/storage";
import { useLocalValue } from "@/lib/utils/use-local";
import { cn } from "@/lib/utils/cn";
import { CopyText, ExportBar, HowItWorks, useToday } from "./shared";

const DRAFT_KEY = "worktools:followup-draft";
const NO_LEADS: Lead[] = [];

const SAMPLE: Lead[] = [
  { id: "a", name: "Dana Whitfield", company: "Northwind", email: "dana@example.com", stage: "proposal", lastContact: null, attempts: 1, nextStep: "a call to go through the pricing", notes: "Wants annual billing", owner: "" },
  { id: "b", name: "Kenji Mori", company: "Sakura Foods", email: "kenji@example.com", stage: "contacted", lastContact: null, attempts: 2, nextStep: "", notes: "", owner: "" },
  { id: "c", name: "Leah Stone", company: "Brightline", email: "leah@example.com", stage: "meeting", lastContact: null, attempts: 0, nextStep: "sending a tailored demo", notes: "", owner: "" },
  { id: "d", name: "Omar Haddad", company: "Atlas Co", email: "", stage: "new", lastContact: null, attempts: 0, nextStep: "", notes: "Inbound from website", owner: "" },
];

/**
 * A follow-up list kept in your own Excel file: load it, see who is overdue,
 * send the drafted message, log it, and save the file again.
 */
export function FollowUpTracker() {
  const now = useToday();
  // A working copy lives in this browser so a refresh does not lose your place;
  // the Excel file you download is the real record.
  const leads = useLocalValue<Lead[]>(DRAFT_KEY, NO_LEADS);
  const setLeads = (next: Lead[]) => writeLocal(DRAFT_KEY, next);
  const [sender, setSender] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const update = (id: string, patch: Partial<Lead>) => setLeads(leads.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const ranked = now
    ? [...leads].sort((a, b) => {
        const fa = followUpFor(a, now);
        const fb = followUpFor(b, now);
        const order = { overdue: 0, today: 1, "no-date": 2, upcoming: 3, closed: 4 };
        return order[fa.state] - order[fb.state] || (fa.days ?? 99) - (fb.days ?? 99);
      })
    : leads;
  const due = now ? leads.filter((l) => ["overdue", "today"].includes(followUpFor(l, now).state)).length : 0;

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const imported = leadsFromRows(await readSheetRows(file));
      if (imported.length === 0) throw new Error("empty");
      setLeads(imported);
    } catch {
      setError("That file has no leads this tool can read. The first row should be headings like Name, Company, Stage, Last contact.");
    }
  };

  const loadSample = () => {
    if (!now) return;
    const back = (days: number) => isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12));
    setLeads(SAMPLE.map((l, i) => ({ ...l, lastContact: [back(6), back(5), back(1), null][i] })));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => fileRef.current?.click()}>Open your leads file (.xlsx / .csv)</Button>
        <Button tone="panel" onClick={loadSample}>Try an example</Button>
        <Button tone="panel" onClick={() => setLeads([...leads, { id: `l${Date.now()}`, name: "", company: "", email: "", stage: "new", lastContact: null, attempts: 0, nextStep: "", notes: "", owner: "" }])}>+ Add a lead</Button>
        {leads.length ? <Button tone="ghost" onClick={() => { if (window.confirm("Clear the list from this browser? Download the Excel file first if you want to keep it.")) setLeads([]); }}>Clear</Button> : null}
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.ods" className="sr-only" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {error ? <p className="text-sm font-semibold text-[var(--cherry-dark)]">{error}</p> : null}
      <p className="text-xs font-semibold text-[var(--muted)]">
        Columns are matched by their headings ({LEAD_HEADER.slice(0, 9).join(", ")}), in English or Japanese. The file is read in your browser — nothing is uploaded.
      </p>

      {leads.length && now ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm font-extrabold">{due} follow-up{due === 1 ? "" : "s"} due now · {leads.length} lead{leads.length === 1 ? "" : "s"}</p>
            <div className="w-64"><Label htmlFor="fu-sender">Sign messages as</Label><Input id="fu-sender" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="Your name" /></div>
          </div>

          <ul className="space-y-2">
            {ranked.map((lead) => {
              const f = followUpFor(lead, now);
              const draft = followUpMessage(lead, sender, now);
              const open = openId === lead.id;
              return (
                <li key={lead.id} className={cn("rounded-2xl border-2 p-3", f.state === "overdue" ? "border-[var(--cherry)]" : f.state === "today" ? "border-[var(--fire)]" : "border-[var(--border)]")}>
                  <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_0.8fr_auto] sm:items-end">
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={lead.name} placeholder="Name" onChange={(e) => update(lead.id, { name: e.target.value })} aria-label="Name" className="!py-1.5 font-extrabold" />
                      <Input value={lead.company} placeholder="Company" onChange={(e) => update(lead.id, { company: e.target.value })} aria-label="Company" className="!py-1.5" />
                    </div>
                    <Select value={lead.stage} onChange={(e) => update(lead.id, { stage: e.target.value as Stage })} aria-label="Stage" className="!py-1.5">
                      {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </Select>
                    <Input type="date" value={lead.lastContact ?? ""} onChange={(e) => update(lead.id, { lastContact: e.target.value || null })} aria-label="Last contact" className="!py-1.5" />
                    <p className={cn("text-xs font-extrabold", f.state === "overdue" ? "text-[var(--cherry-dark)] dark:text-[var(--cherry)]" : "text-[var(--muted)]")}>
                      {f.state === "overdue" ? `Overdue ${-(f.days ?? 0)} day${f.days === -1 ? "" : "s"}` : f.state === "today" ? "Follow up today" : f.state === "upcoming" ? `In ${f.days} day${f.days === 1 ? "" : "s"}` : f.state === "closed" ? "Closed" : "Add last contact"}
                    </p>
                    <Button tone={open ? "grass" : "panel"} size="sm" disabled={f.state === "closed"} onClick={() => setOpenId(open ? null : lead.id)}>
                      {open ? "Hide" : "Message"}
                    </Button>
                  </div>
                  <Input value={lead.nextStep} placeholder="Next step (used in the message)" onChange={(e) => update(lead.id, { nextStep: e.target.value })} aria-label="Next step" className="mt-2 !py-1 text-xs" />
                  {open ? (
                    <div className="mt-3 space-y-2 rounded-xl bg-[var(--panel)] p-3">
                      <p className="text-xs font-semibold text-[var(--muted)]">{STAGE_MAP[lead.stage].meaning} Attempt {lead.attempts + 1}.</p>
                      <p className="text-sm font-extrabold">Subject: {draft.subject}</p>
                      <pre className="whitespace-pre-wrap text-sm">{draft.body}</pre>
                      <div className="flex flex-wrap gap-2">
                        <CopyText text={`Subject: ${draft.subject}\n\n${draft.body}`} label="Copy message" />
                        {lead.email ? (
                          <a className="do-btn rounded-xl px-3.5 py-2 text-xs [--btn-bg:var(--panel)] [--btn-fg:var(--ink)] [--btn-shadow:var(--border-strong)]" href={`mailto:${lead.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}>
                            Open in email app
                          </a>
                        ) : null}
                        <Button tone="grass" size="sm" onClick={() => { update(lead.id, { lastContact: isoDate(now), attempts: lead.attempts + 1, stage: lead.stage === "new" ? "contacted" : lead.stage }); setOpenId(null); }}>
                          I sent it — log today
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <ExportBar
            actions={[{ label: "Save as Excel", icon: "📊", run: async () => downloadBlob(await toXlsx([{ name: "Leads", rows: leadsToRows(leads, now) }]), fileName("leads follow-up", "xlsx")) }]}
            note="Save after each session. Next time, open that file here and everything — stages, dates, attempts — carries on. DO101 keeps no copy; your browser keeps a working draft only until you clear it."
          />
        </>
      ) : null}

      <HowItWorks>
        <p>
          Each stage has a follow-up rhythm — a new lead the next day, a sent proposal after four days, a nurture lead
          monthly — and the gap widens after unanswered attempts so you persist without pestering. After five
          unanswered attempts it drafts a polite &ldquo;should I close your file?&rdquo; message instead, which often gets a reply.
        </p>
        <p>
          There is no CRM and no database: your leads live in the Excel file you download. It cannot see your inbox,
          so logging &ldquo;I sent it&rdquo; is what moves a lead on.
        </p>
      </HowItWorks>
    </div>
  );
}
