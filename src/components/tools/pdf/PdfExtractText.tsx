"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea, Toggle } from "@/components/ui/Field";
import { CopyButton } from "@/components/ui/CopyButton";
import { ErrorState, EmptyState, Progress, InfoNote, Stat } from "@/components/ui/Feedback";
import { usePdfFiles } from "./usePdfFile";
import { extractPdfText, type ExtractedPage } from "@/lib/pdf/render";
import { downloadBytes, PdfError } from "@/lib/pdf/engine";
import { textToDocx, docxName } from "@/lib/pdf/to-word";
import { formatBytes } from "@/lib/utils/format";
import { analyzeText } from "@/lib/text/stats";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

export function PdfExtractText({ target }: { target: "text" | "word" }) {
  const { files, error, setError, loading, add, reset } = usePdfFiles(false);
  const [pages, setPages] = React.useState<ExtractedPage[] | null>(null);
  const [hasText, setHasText] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [pageMarkers, setPageMarkers] = React.useState(target === "text");
  const [pageBreaks, setPageBreaks] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);

  const file = files[0];

  const combined = React.useMemo(() => {
    if (!pages) return "";
    return pages
      .map((p) => (pageMarkers ? `--- Page ${p.page} ---\n${p.text}` : p.text))
      .join("\n\n");
  }, [pages, pageMarkers]);

  const stats = React.useMemo(() => (combined ? analyzeText(combined) : null), [combined]);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setPages(null);
    setProgress(0);
    try {
      const result = await extractPdfText(file.bytes, (done, total) =>
        setProgress((done / total) * 100),
      );
      setPages(result.pages);
      setHasText(result.hasText);
      track("tool_complete", { tool: target === "word" ? "pdf-to-word" : "pdf-to-text" });
      recordCompletion(15);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "The text could not be extracted.");
    } finally {
      setBusy(false);
    }
  };

  const downloadTxt = () => {
    downloadBytes(
      new TextEncoder().encode(combined),
      `${file!.name.replace(/\.pdf$/i, "")}.txt`,
      "text/plain;charset=utf-8",
    );
  };

  const downloadDocx = async () => {
    if (!pages || !file) return;
    setExporting(true);
    try {
      const blob = await textToDocx(pages, {
        title: file.name.replace(/\.pdf$/i, ""),
        pageBreaks,
      });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      downloadBytes(
        bytes,
        docxName(file.name),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      track("tool_complete", { tool: "pdf-to-word", action: "download-docx" });
    } catch {
      setError("The Word document could not be built.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {target === "word" ? (
        <InfoNote icon="ℹ️">
          <strong>This is a text conversion, not a layout conversion.</strong> Paragraphs and page
          breaks are preserved, so the result is fully editable in Word. Columns, tables, images,
          fonts and exact positioning are <em>not</em> reproduced. For a text-heavy document that is
          usually exactly what you want; for a designed brochure it is not.
        </InfoNote>
      ) : null}

      {!file ? (
        <FileDrop
          onFiles={add}
          accept="application/pdf,.pdf"
          multiple={false}
          icon={target === "word" ? "📝" : "🔤"}
          title="Drop your PDF here"
          hint="Read on your device · nothing is uploaded"
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
                  setPages(null);
                }}
              >
                Choose another
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {target === "text" ? (
                <Toggle
                  checked={pageMarkers}
                  onChange={setPageMarkers}
                  label="Mark page boundaries"
                  description="Inserts --- Page n --- between pages."
                />
              ) : (
                <Toggle
                  checked={pageBreaks}
                  onChange={setPageBreaks}
                  label="Keep page breaks"
                  description="Starts each PDF page on a new Word page."
                />
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button tone="cherry" onClick={run} disabled={busy}>
                {busy ? "Extracting…" : target === "word" ? "Convert to Word" : "Extract text"}
              </Button>
            </div>

            {busy ? (
              <Progress className="mt-4" value={progress} tone="cherry" label="Reading pages" />
            ) : null}
          </Card>

          {pages && !hasText ? (
            <ErrorState
              title="No text layer found"
              message="Every page in this PDF came back empty, which means it is a scan — a picture of a document rather than text. Use the PDF OCR tool instead: it reads the words out of the image."
              action={
                <a
                  href="/tools/pdf-ocr"
                  className="do-btn [--btn-bg:var(--cherry)] [--btn-shadow:var(--cherry-dark)] [--btn-fg:#fff] px-4 py-2 text-xs"
                >
                  Open PDF OCR
                </a>
              }
            />
          ) : null}

          {pages && hasText ? (
            <>
              {stats ? (
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Pages" value={pages.length} tone="cherry" />
                  <Stat label="Words" value={stats.words.toLocaleString()} tone="grass" />
                  <Stat label="Characters" value={stats.characters.toLocaleString()} tone="sky" />
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="pdf-text"
                  className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
                >
                  Extracted text
                </label>
                <Textarea
                  id="pdf-text"
                  value={combined}
                  readOnly
                  className="min-h-[320px] bg-[var(--panel)] font-mono text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {target === "word" ? (
                  <Button tone="grass" onClick={downloadDocx} disabled={exporting}>
                    {exporting ? "Building…" : "Download .docx"}
                  </Button>
                ) : null}
                <Button tone={target === "word" ? "panel" : "grass"} onClick={downloadTxt}>
                  Download .txt
                </Button>
                <CopyButton value={combined} label="Copy all text" tone="panel" size="md" />
              </div>
            </>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={target === "word" ? "📝" : "🔤"}
          title="No PDF yet"
          description={
            target === "word"
              ? "Add a PDF to turn its text into an editable Word document."
              : "Add a PDF to pull out its text layer."
          }
        />
      )}
    </div>
  );
}
