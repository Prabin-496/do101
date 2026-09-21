"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { isoDate } from "@/lib/worktools/dates";
import { downloadBlob, fileName, toDocx } from "@/lib/worktools/export";
import { buildSop, sopToDoc, sopToMarkdown, type Sop, type SopStep } from "@/lib/worktools/sop";
import { CopyText, ExportBar, HowItWorks, TextSource, useToday } from "./shared";

const SAMPLE = `Before you start, you need admin access to the Billing Portal and the finance shared drive.
First, log in to the Billing Portal. Then open the Reports page and choose last month.
Make sure the currency is set to JPY — the default is USD.
Click Export and save the CSV to the finance shared drive.
If the export is empty, contact the finance team before going any further.
Next, open the reconciliation sheet and paste the CSV into the Raw tab.
Check that the totals match the bank statement. Never edit the Raw tab by hand.
Finally, email the sheet to your manager for approval by the 5th of the month.`;

/**
 * Rough notes on how something is done, into a numbered SOP with warnings and
 * decision points pulled out — editable, then downloaded as a Word document.
 */
export function SopBuilder() {
  const now = useToday();
  const [notes, setNotes] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [owner, setOwner] = React.useState("");
  const [version, setVersion] = React.useState("1.0");
  const [edited, setEdited] = React.useState<Sop | null>(null);

  const [source, setSource] = React.useState(notes + title);
  if (source !== notes + title) {
    setSource(notes + title);
    setEdited(null);
  }

  const built = React.useMemo(() => (notes.trim() ? buildSop(notes, title) : null), [notes, title]);
  const sop = edited ?? built;
  const meta = { owner, version, date: now ? isoDate(now) : "" };
  const update = (patch: Partial<Sop>) => sop && setEdited({ ...sop, ...patch });
  const updateStep = (id: string, patch: Partial<SopStep>) => sop && update({ steps: sop.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const move = (index: number, by: number) => {
    if (!sop) return;
    const steps = [...sop.steps];
    const [step] = steps.splice(index, 1);
    steps.splice(Math.max(0, Math.min(steps.length, index + by)), 0, step);
    update({ steps });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2"><Label htmlFor="sop-title">Procedure name</Label><Input id="sop-title" value={title} placeholder="e.g. Month-end billing export" onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label htmlFor="sop-owner">Owner</Label><Input id="sop-owner" value={owner} placeholder="Team or name" onChange={(e) => setOwner(e.target.value)} /></div>
          <div><Label htmlFor="sop-version">Version</Label><Input id="sop-version" value={version} onChange={(e) => setVersion(e.target.value)} /></div>
        </div>
      </div>

      <TextSource
        id="sop-notes"
        label="Describe the process, however it comes out"
        value={notes}
        onChange={setNotes}
        sample={SAMPLE}
        rows={10}
        placeholder={"Write it the way you would explain it to a new colleague:\n\nFirst log in to the portal, then open Reports and pick last month. Make sure the currency is JPY. If it's empty, ask finance…"}
        hint="Steps are split at &quot;then&quot;, &quot;next&quot;, &quot;after that&quot;, &quot;次に&quot; and new lines. Warnings (&quot;make sure&quot;, &quot;never&quot;) and conditions (&quot;if…&quot;) are attached to the step they belong to."
      />

      {sop ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="sop-purpose" hint="optional">Purpose</Label><Textarea id="sop-purpose" rows={2} value={sop.purpose} placeholder="Why this procedure exists" onChange={(e) => update({ purpose: e.target.value })} /></div>
            <div><Label htmlFor="sop-scope" hint="optional">Scope</Label><Textarea id="sop-scope" rows={2} value={sop.scope} placeholder="Who does it and when" onChange={(e) => update({ scope: e.target.value })} /></div>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-3">
            {[["Before you start", sop.prerequisites], ["Roles", sop.roles], ["Systems", sop.systems]].map(([label, list]) => (
              <div key={label as string} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">{label as string}</p>
                <p className="mt-1 font-semibold">{(list as string[]).length ? (list as string[]).join(" · ") : <span className="text-[var(--muted)]">None found</span>}</p>
              </div>
            ))}
          </div>

          <ol className="space-y-2">
            {sop.steps.map((step, i) => (
              <li key={step.id} className="rounded-2xl border-2 border-[var(--border)] p-3">
                <div className="flex items-start gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--grass)] text-sm font-extrabold text-white">{i + 1}</span>
                  <Input value={step.text} onChange={(e) => updateStep(step.id, { text: e.target.value })} aria-label={`Step ${i + 1}`} className="!py-1.5 font-semibold" />
                  <div className="flex shrink-0 gap-1">
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-lg px-2 py-1 hover:bg-[var(--panel)] disabled:opacity-30">↑</button>
                    <button type="button" aria-label="Move down" disabled={i === sop.steps.length - 1} onClick={() => move(i, 1)} className="rounded-lg px-2 py-1 hover:bg-[var(--panel)] disabled:opacity-30">↓</button>
                    <button type="button" aria-label="Remove step" onClick={() => update({ steps: sop.steps.filter((s) => s.id !== step.id) })} className="rounded-lg px-2 py-1 text-[var(--muted)] hover:bg-[var(--panel)]">✕</button>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 pl-10 sm:grid-cols-3">
                  <Input value={step.role ?? ""} placeholder="Who (optional)" onChange={(e) => updateStep(step.id, { role: e.target.value || null })} aria-label="Who does this step" className="!py-1 text-xs" />
                  <Input value={step.warnings.join("; ")} placeholder="⚠ Warning (optional)" onChange={(e) => updateStep(step.id, { warnings: e.target.value ? e.target.value.split(/;\s*/) : [] })} aria-label="Warning" className="!py-1 text-xs" />
                  <Input value={step.decision ?? ""} placeholder="↳ If… then… (optional)" onChange={(e) => updateStep(step.id, { decision: e.target.value || null })} aria-label="Decision point" className="!py-1 text-xs" />
                </div>
              </li>
            ))}
          </ol>
          <Button tone="ghost" size="sm" onClick={() => update({ steps: [...sop.steps, { id: `s${Date.now()}`, text: "", warnings: [], decision: null, role: null }] })}>+ Add a step</Button>

          <ExportBar
            disabled={sop.steps.length === 0}
            actions={[
              { label: "Word document", icon: "📝", run: async () => downloadBlob(await toDocx(sopToDoc(sop, meta), { title: sop.title, creator: owner || "DO101" }), fileName(`SOP ${sop.title}`, "docx")) },
            ]}
            note="A formatted SOP with an owner and version block, roles, prerequisites, a numbered procedure table and a revision history."
          />
          <CopyText text={sopToMarkdown(sop, meta)} label="Copy as Markdown (for Notion, Confluence, GitHub)" />
        </>
      ) : null}

      <HowItWorks>
        <p>
          Your notes are split into steps at sentence breaks and sequence words. Sentences that are only a warning
          (&ldquo;make sure…&rdquo;, &ldquo;never…&rdquo;, &ldquo;必ず…&rdquo;) are attached to the step before them, as are conditions (&ldquo;if the export is
          empty…&rdquo;). Things mentioned before the first step as requirements become prerequisites. Roles and systems are
          picked out from the words used.
        </p>
        <p>
          It works from text — it cannot watch a screen recording, which would need an AI service. Every step is
          editable and reorderable before you download, and nothing leaves your browser.
        </p>
      </HowItWorks>
    </div>
  );
}
