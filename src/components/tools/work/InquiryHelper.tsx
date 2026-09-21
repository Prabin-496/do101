"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { downloadBlob, fileName, readSheetRows, toDocx, toXlsx } from "@/lib/worktools/export";
import {
  composeReply, detectName, faqsFromRows, faqsToRows, INDUSTRIES, isJapanese, matchInquiry, placeholders, STARTER_FAQS,
  type FaqEntry, type Industry,
} from "@/lib/worktools/inquiry";
import { writeLocal } from "@/lib/utils/storage";
import { useLocalValue } from "@/lib/utils/use-local";
import { Chip, ChipRow } from "../trading/shared";
import { CopyText, ExportBar, HowItWorks, TextSource } from "./shared";

const FAQ_KEY = "worktools:faq-draft";
const NO_FAQ: FaqEntry[] = [];

const SAMPLE = `Hello,

I'm Anna Kowalski and we're thinking of staying 3 nights in October.
What time is check-in? Is there somewhere to leave our car?
Also, is breakfast included in the price? And can we bring our dog?

Thanks!
Anna`;

/**
 * Your own FAQ, kept in an Excel file, answering incoming customer questions —
 * and saying "we'll check" rather than guessing where it has no answer.
 */
export function InquiryHelper() {
  const faqs = useLocalValue<FaqEntry[]>(FAQ_KEY, NO_FAQ);
  const setFaqs = (next: FaqEntry[]) => writeLocal(FAQ_KEY, next);
  const [inquiry, setInquiry] = React.useState("");
  const [business, setBusiness] = React.useState("");
  const [signer, setSigner] = React.useState("");
  const [tone, setTone] = React.useState<"formal" | "friendly">("friendly");
  const [industry, setIndustry] = React.useState<Industry>("tourism");
  const [replyEdit, setReplyEdit] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const language = isJapanese(inquiry) ? "ja" : "en";
  const matches = React.useMemo(() => (inquiry.trim() && faqs.length ? matchInquiry(inquiry, faqs) : []), [inquiry, faqs]);
  const customerName = detectName(inquiry) ?? "";
  const composed = matches.length ? composeReply(matches, { customerName, business, signer, tone, language }) : "";

  // A new inquiry, or a new set of answers, replaces any hand edits to the reply.
  const key = composed;
  const [lastKey, setLastKey] = React.useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setReplyEdit(null);
  }
  const reply = replyEdit ?? composed;
  const unfilled = placeholders(reply);

  const updateFaq = (id: string, patch: Partial<FaqEntry>) => setFaqs(faqs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const addFaq = (question = "") => setFaqs([...faqs, { id: `f${Date.now()}`, question, answer: "", keywords: "" }]);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const loaded = faqsFromRows(await readSheetRows(file));
      if (!loaded.length) throw new Error("empty");
      setFaqs(loaded);
    } catch {
      setError("No FAQ rows found. The first row should be headings: Question, Answer, Keywords.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-base font-extrabold">1. Your answers</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-56">
            <Label htmlFor="iq-industry">Start from a template</Label>
            <Select id="iq-industry" value={industry} onChange={(e) => setIndustry(e.target.value as Industry)}>
              {INDUSTRIES.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </Select>
          </div>
          <Button tone="panel" onClick={() => { if (!faqs.length || window.confirm("Replace your current answers with the template?")) setFaqs(STARTER_FAQS[industry].map((f) => ({ ...f }))); }}>Load template</Button>
          <Button tone="panel" onClick={() => fileRef.current?.click()}>Open FAQ file (.xlsx)</Button>
          <Button tone="ghost" onClick={() => addFaq()}>+ Add a question</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.ods" className="sr-only" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        {error ? <p className="text-sm font-semibold text-[var(--cherry-dark)]">{error}</p> : null}
        {faqs.length ? (
          <>
            <p className="rounded-2xl border-2 border-[var(--sun)] bg-[var(--sun-soft)] px-4 py-2 text-xs font-semibold">
              Replace everything in [square brackets] with your real details. Templates contain placeholders, not facts about your business.
            </p>
            <details className="rounded-2xl border-2 border-[var(--border)] px-4 py-3">
              <summary className="cursor-pointer text-sm font-extrabold">Edit your {faqs.length} answers</summary>
              <ul className="mt-3 space-y-3">
                {faqs.map((f) => (
                  <li key={f.id} className="space-y-1.5 rounded-xl bg-[var(--panel)] p-3">
                    <div className="flex gap-2">
                      <Input value={f.question} placeholder="Question customers ask" onChange={(e) => updateFaq(f.id, { question: e.target.value })} aria-label="Question" className="!py-1.5 font-extrabold" />
                      <button type="button" aria-label="Remove" onClick={() => setFaqs(faqs.filter((x) => x.id !== f.id))} className="rounded-lg px-2 text-[var(--muted)] hover:bg-[var(--panel-2)]">✕</button>
                    </div>
                    <Textarea value={f.answer} rows={2} placeholder="Your answer" onChange={(e) => updateFaq(f.id, { answer: e.target.value })} aria-label="Answer" className="!min-h-0 text-sm" />
                    <Input value={f.keywords} placeholder="Other words people use, comma-separated" onChange={(e) => updateFaq(f.id, { keywords: e.target.value })} aria-label="Keywords" className="!py-1 text-xs" />
                  </li>
                ))}
              </ul>
            </details>
            <ExportBar
              actions={[
                { label: "Save FAQ as Excel", icon: "📊", run: async () => downloadBlob(await toXlsx([{ name: "FAQ", rows: faqsToRows(faqs), widths: [40, 80, 40] }]), fileName(`faq ${business}`, "xlsx")) },
                { label: "FAQ page for your website (Word)", icon: "📝", run: async () => downloadBlob(await toDocx([{ type: "title", text: `${business || "Our"} — Frequently asked questions` }, ...faqs.flatMap((f) => [{ type: "heading" as const, text: f.question, level: 2 as const }, { type: "paragraph" as const, text: f.answer }])], { title: "FAQ" }), fileName(`faq page ${business}`, "docx")) },
              ]}
              note="The Excel file is where your answers live. Open it here next time and they are all back."
            />
          </>
        ) : null}
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-extrabold">2. The customer&rsquo;s message</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="iq-business">Business name</Label><Input id="iq-business" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="e.g. Sakura Inn" /></div>
          <div><Label htmlFor="iq-signer">Sign as</Label><Input id="iq-signer" value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="e.g. Mei, Front desk" /></div>
          <div>
            <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">Tone</p>
            <ChipRow ariaLabel="Tone">
              <Chip active={tone === "friendly"} onClick={() => setTone("friendly")}>Friendly</Chip>
              <Chip active={tone === "formal"} onClick={() => setTone("formal")}>Formal</Chip>
            </ChipRow>
          </div>
        </div>
        <TextSource
          id="iq-text"
          label="Inquiry"
          value={inquiry}
          onChange={(v) => { setInquiry(v); if (!faqs.length && v === SAMPLE) setFaqs(STARTER_FAQS.tourism.map((f) => ({ ...f }))); }}
          sample={SAMPLE}
          rows={8}
          placeholder="Paste an email, a booking-site message or a DM. English and Japanese both work — a Japanese inquiry gets a Japanese reply."
        />
        {inquiry.trim() && !faqs.length ? <p className="text-sm font-semibold text-[var(--muted)]">Load a template or your FAQ file above to match this against.</p> : null}
      </section>

      {matches.length ? (
        <section className="space-y-3">
          <h3 className="text-base font-extrabold">3. The reply</h3>
          <ul className="space-y-1.5">
            {matches.map((m, i) => (
              <li key={i} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border-2 border-[var(--border)] px-3 py-2 text-sm">
                <span className="font-semibold">“{m.question}”</span>
                {m.entry ? (
                  <span className="text-xs font-extrabold text-[var(--grass-dark)] dark:text-[var(--grass)]">→ {m.entry.question} · {Math.round(m.confidence * 100)}% match</span>
                ) : (
                  <span className="flex items-center gap-2 text-xs font-extrabold text-[var(--fire-dark)]">
                    No answer yet — the reply says you will check
                    <button type="button" className="underline" onClick={() => addFaq(m.question)}>Add to FAQ</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <Textarea value={reply} rows={14} onChange={(e) => setReplyEdit(e.target.value)} aria-label="Reply" className="text-sm" />
          {unfilled.length ? (
            <p className="rounded-2xl border-2 border-[var(--cherry)] bg-[var(--cherry-soft)] px-4 py-2 text-xs font-extrabold">
              Still a placeholder in this reply: {unfilled.slice(0, 4).join(", ")}{unfilled.length > 4 ? "…" : ""}. Fill it in before sending.
            </p>
          ) : null}
          <CopyText text={reply} label="Copy reply" />
        </section>
      ) : null}

      <HowItWorks>
        <p>
          The message is split into its questions, and each is matched against your answers by the words it shares
          with them, plus common synonyms — &ldquo;car&rdquo; finds your parking answer, &ldquo;how much&rdquo; your prices. The match percentage
          shows how much of the question an answer covers. Below the threshold, nothing is guessed: the reply says
          you will check, and you can add that question to your FAQ in one click.
        </p>
        <p>
          Your answers are stored in the Excel file you save, with a working copy in this browser. Nothing is sent to
          DO101, and the replies are yours to edit before sending.
        </p>
      </HowItWorks>
    </div>
  );
}
