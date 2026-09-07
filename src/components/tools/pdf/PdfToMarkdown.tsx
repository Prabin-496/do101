"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea, Toggle } from "@/components/ui/Field";
import { CopyButton } from "@/components/ui/CopyButton";
import { ErrorState, EmptyState, InfoNote, Progress, Stat } from "@/components/ui/Feedback";
import { usePdfFiles } from "./usePdfFile";
import { extractPdfText } from "@/lib/pdf/render";
import { pagesToMarkdown } from "@/lib/pdf/to-markdown";
import { downloadBytes, PdfError } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

export function PdfToMarkdown() {
  const { files, error, setError, loading, add, reset } = usePdfFiles(false);
  const [markdown, setMarkdown] = React.useState("");
  const [stats, setStats] = React.useState<{ headings: number; listItems: number } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [pageBreaks, setPageBreaks] = React.useState(true);
  const [detectHeadings, setDetectHeadings] = React.useState(true);
  const [detectLists, setDetectLists] = React.useState(true);

  const file = files[0];

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMarkdown("");
    setProgress(0);
    try {
      const { pages, hasText } = await extractPdfText(file.bytes, (done, total) =>
        setProgress((done / total) * 100),
      );
      if (!hasText) {
        throw new PdfError(
          "This PDF has no text layer — it is a scan. Run it through PDF OCR first, then convert the text.",
        );
      }
      const result = pagesToMarkdown(pages, { pageBreaks, detectHeadings, detectLists });
      setMarkdown(result.markdown);
      setStats({ headings: result.headings, listItems: result.listItems });
      track("tool_complete", { tool: "pdf-to-markdown" });
      recordCompletion(15);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "The document could not be converted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <InfoNote icon="ℹ️">
        Headings and lists are inferred from the <em>shape</em> of each line — short lines without
        terminal punctuation, numbered sections, ALL-CAPS titles and bullet markers. A PDF&rsquo;s
        text layer does not reliably expose font sizes, so treat the result as a very good first
        draft rather than a perfect structural conversion.
      </InfoNote>

      {!file ? (
        <FileDrop
          onFiles={add}
          accept="application/pdf,.pdf"
          multiple={false}
          icon="⬇️"
          title="Drop your PDF here"
          hint="Converted on your device · nothing is uploaded"
        />
      ) : null}

      {loading ? <p className="text-sm font-extrabold text-[var(--muted)]">Reading…</p> : null}
      {error ? <ErrorState message={error} /> : null}

      {file ? (
        <>
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-extrabold">
                📄 {file.name} · {file.pageCount} pages · {formatBytes(file.size)}
              </p>
              <Button
                size="sm"
                tone="ghost"
                onClick={() => {
                  reset();
                  setMarkdown("");
                }}
              >
                Choose another
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Toggle checked={detectHeadings} onChange={setDetectHeadings} label="Detect headings" />
              <Toggle checked={detectLists} onChange={setDetectLists} label="Detect lists" />
              <Toggle
                checked={pageBreaks}
                onChange={setPageBreaks}
                label="Rule between pages"
                description="Inserts --- at each page break."
              />
            </div>

            <div className="mt-4">
              <Button tone="cherry" onClick={run} disabled={busy}>
                {busy ? "Converting…" : "Convert to Markdown"}
              </Button>
            </div>

            {busy ? (
              <Progress className="mt-4" value={progress} tone="cherry" label="Reading pages" />
            ) : null}
          </Card>

          {markdown ? (
            <>
              {stats ? (
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Headings found" value={stats.headings} tone="cherry" />
                  <Stat label="List items" value={stats.listItems} tone="grass" />
                  <Stat label="Characters" value={markdown.length.toLocaleString()} tone="sky" />
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="md-out"
                  className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
                >
                  Markdown
                </label>
                <Textarea
                  id="md-out"
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  className="min-h-[340px] bg-[var(--panel)] font-mono text-sm"
                />
                <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                  Editable — tidy anything the heuristics got wrong before you copy it.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <CopyButton value={markdown} label="Copy Markdown" tone="grass" size="md" />
                <Button
                  tone="panel"
                  onClick={() =>
                    downloadBytes(
                      new TextEncoder().encode(markdown),
                      `${file.name.replace(/\.pdf$/i, "")}.md`,
                      "text/markdown;charset=utf-8",
                    )
                  }
                >
                  Download .md
                </Button>
              </div>
            </>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="⬇️"
          title="No PDF yet"
          description="Add a PDF to turn it into Markdown for your notes, docs or a repository."
        />
      )}
    </div>
  );
}
