"use client";

import * as React from "react";
import { Input } from "@/components/ui/Field";
import { FileDrop } from "@/components/ui/FileDrop";
import { bestSentences, chunk, highlight, SearchIndex, type SearchDoc } from "@/lib/worktools/search";
import { CopyText, HowItWorks, readTextFile } from "./shared";

interface Loaded extends SearchDoc {
  size: number;
  passages: number;
  note?: string;
}

async function extract(file: File): Promise<{ text: string; note?: string }> {
  if (/\.pdf$/i.test(file.name)) {
    const { extractPdfText } = await import("@/lib/pdf/render");
    const { pages, hasText } = await extractPdfText(await file.arrayBuffer());
    return {
      text: pages.map((p) => `[Page ${p.page}]\n${p.text}`).join("\n\n"),
      note: hasText ? undefined : "No text layer — a scan. Run it through the PDF OCR tool first.",
    };
  }
  if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
    const { readWorkbook } = await import("@/lib/docs/spreadsheet");
    const sheets = await readWorkbook(file);
    return { text: sheets.map((s) => `[${s.name}]\n${s.rows.map((r) => r.join(" | ")).join("\n")}`).join("\n\n") };
  }
  return { text: await readTextFile(file) };
}

/**
 * Search across your own files without uploading them: PDFs, Word documents,
 * spreadsheets and notes, indexed in this tab and forgotten when you close it.
 */
export function DocumentSearch() {
  const [docs, setDocs] = React.useState<Loaded[]>([]);
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [only, setOnly] = React.useState<string | null>(null);

  const index = React.useMemo(() => new SearchIndex(docs.filter((d) => !only || d.id === only).flatMap((d) => chunk(d))), [docs, only]);
  const hits = React.useMemo(() => (query.trim() ? index.search(query, 12) : []), [index, query]);
  const top = hits[0];
  const answer = top ? bestSentences(top.passage.text, top.matched, 2) : [];

  const add = async (files: File[]) => {
    const failed: string[] = [];
    const added: Loaded[] = [];
    for (const file of files) {
      setBusy(file.name);
      try {
        const { text, note } = await extract(file);
        const doc: SearchDoc = { id: `${file.name}-${file.size}-${file.lastModified}`, title: file.name, text };
        added.push({ ...doc, size: file.size, passages: chunk(doc).length, note });
      } catch {
        failed.push(`${file.name} could not be read.`);
      }
    }
    setBusy(null);
    setErrors(failed);
    setDocs((current) => [...current.filter((d) => !added.some((a) => a.id === d.id)), ...added]);
  };

  return (
    <div className="space-y-5">
      <FileDrop
        onFiles={(files) => void add(files)}
        accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls,.ods,.html,.htm,.json,.eml,.log"
        multiple
        title="Drop the files you want to search"
        icon="🔎"
        hint="PDF, Word, Excel, CSV, text, Markdown and HTML. Read in this tab only — nothing is uploaded, and closing the tab forgets them."
        disabled={busy !== null}
      />
      {busy ? <p className="text-sm font-semibold text-[var(--muted)]">Reading {busy}…</p> : null}
      {errors.map((e) => <p key={e} className="text-sm font-semibold text-[var(--cherry-dark)]">{e}</p>)}

      {docs.length ? (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setOnly(null)} className={`rounded-xl border-2 px-3 py-1 text-xs font-extrabold ${only === null ? "border-[var(--grass)] bg-[var(--grass-soft)]" : "border-[var(--border)]"}`}>
              All {docs.length} files
            </button>
            {docs.map((d) => (
              <span key={d.id} className={`flex items-center gap-1 rounded-xl border-2 px-3 py-1 text-xs font-extrabold ${only === d.id ? "border-[var(--grass)] bg-[var(--grass-soft)]" : "border-[var(--border)]"}`}>
                <button type="button" onClick={() => setOnly(only === d.id ? null : d.id)} title={d.note ?? `${d.passages} passages`}>
                  {d.note ? "⚠️ " : ""}{d.title}
                </button>
                <button type="button" aria-label={`Remove ${d.title}`} onClick={() => setDocs(docs.filter((x) => x.id !== d.id))} className="text-[var(--muted)]">✕</button>
              </span>
            ))}
          </div>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={'Ask or search: "hotel limit", refund policy, "late invoices" -draft'}
            className="text-lg"
            aria-label="Search your files"
            autoFocus
          />

          {query.trim() ? (
            hits.length ? (
              <>
                {answer.length ? (
                  <div className="rounded-2xl border-2 border-[var(--grass)] bg-[var(--grass-soft)] px-4 py-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">Best match, quoted from {top.passage.title}</p>
                    <p className="mt-1 text-sm font-semibold">{answer.join(" ")}</p>
                    <div className="mt-2"><CopyText text={`${answer.join(" ")}\n— ${top.passage.title}`} label="Copy with source" /></div>
                  </div>
                ) : null}
                <ol className="space-y-2">
                  {hits.map((hit, i) => (
                    <li key={`${hit.passage.docId}-${hit.passage.index}-${i}`} className="rounded-2xl border-2 border-[var(--border)] px-4 py-3">
                      <p className="text-xs font-extrabold text-[var(--muted)]">
                        {hit.passage.title} · passage {hit.passage.index + 1} · relevance {hit.score.toFixed(1)}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">
                        {highlight(hit.passage.text.slice(0, 700), hit.matched).map((part, k) =>
                          part.hit ? <mark key={k} className="rounded bg-[var(--sun-soft)] px-0.5 font-extrabold text-[var(--ink)]">{part.text}</mark> : <React.Fragment key={k}>{part.text}</React.Fragment>,
                        )}
                        {hit.passage.text.length > 700 ? "…" : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-sm font-semibold text-[var(--muted)]">Nothing matched. Try fewer or different words — related forms (&ldquo;invoicing&rdquo; / &ldquo;invoice&rdquo;) are matched automatically.</p>
            )
          ) : (
            <p className="text-xs font-semibold text-[var(--muted)]">{docs.reduce((a, d) => a + d.passages, 0)} passages indexed, in this tab only.</p>
          )}
        </>
      ) : null}

      <HowItWorks>
        <p>
          Each file is read in your browser and split into passages of a few sentences. Your search is ranked with BM25 —
          the method behind most search engines — so rarer, more specific words count for more. English words match
          their other forms, and Japanese is searched by overlapping character pairs. Use &quot;quotes&quot; for an exact phrase
          and a minus sign to exclude a word.
        </p>
        <p>
          The highlighted &ldquo;best match&rdquo; is quoted from your file, not written by an AI, so it cannot make anything up —
          but it also cannot combine facts from two places into one answer. Scanned PDFs need OCR first. Nothing is
          uploaded or stored: close the tab and the index is gone.
        </p>
      </HowItWorks>
    </div>
  );
}
