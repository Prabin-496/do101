"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState, EmptyState, SuccessNote, Progress } from "@/components/ui/Feedback";
import { PdfFileList } from "./PdfFileList";
import { usePdfFiles } from "./usePdfFile";
import { mergePdfs, downloadBytes, PdfError } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

export function PdfMerge() {
  const { files, error, setError, loading, add, remove, move, reset, isLarge } = usePdfFiles(true);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ bytes: Uint8Array; pages: number } | null>(null);

  const totalPages = files.reduce((n, f) => n + f.pageCount, 0);
  const totalSize = files.reduce((n, f) => n + f.size, 0);

  const run = async () => {
    if (files.length < 2) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const bytes = await mergePdfs(files.map((f) => ({ bytes: f.bytes })));
      setResult({ bytes, pages: totalPages });
      track("tool_complete", { tool: "pdf-merge", files: files.length });
      recordCompletion(15);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "The documents could not be merged.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <FileDrop
        onFiles={add}
        accept="application/pdf,.pdf"
        multiple
        icon="📄"
        title={files.length ? "Add more PDFs" : "Drop your PDFs here"}
        hint="They are combined in the order shown below · nothing is uploaded"
        disabled={busy}
      />

      {loading ? (
        <p className="text-sm font-extrabold text-[var(--muted)]">Reading documents…</p>
      ) : null}
      {error ? <ErrorState message={error} /> : null}

      {files.length ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-extrabold">
              {files.length} file{files.length === 1 ? "" : "s"} · {totalPages} pages ·{" "}
              {formatBytes(totalSize)}
            </p>
            <p className="text-xs font-semibold text-[var(--muted)]">
              Use ↑ ↓ to set the order
            </p>
          </div>

          <PdfFileList files={files} onRemove={remove} onMove={move} reorderable />

          {isLarge ? (
            <p className="rounded-xl bg-[var(--sun-soft)] px-3 py-2 text-xs font-bold">
              ⚠️ One of these files is over 25 MB. Merging may take a few seconds and use a lot of
              memory on older phones.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button tone="cherry" onClick={run} disabled={busy || files.length < 2}>
              {busy ? "Merging…" : `Merge ${files.length} PDFs`}
            </Button>
            <Button
              tone="ghost"
              onClick={() => {
                reset();
                setResult(null);
              }}
              disabled={busy}
            >
              Reset
            </Button>
          </div>

          {files.length === 1 ? (
            <p className="text-sm font-semibold text-[var(--muted)]">
              Add at least one more PDF to merge.
            </p>
          ) : null}

          {busy ? <Progress value={60} tone="cherry" label="Merging" /> : null}

          {result ? (
            <Card className="do-pop space-y-3 bg-[var(--grass-soft)] p-5">
              <SuccessNote>
                Merged into one PDF — {result.pages} pages, {formatBytes(result.bytes.length)}.
              </SuccessNote>
              <Button
                tone="grass"
                onClick={() => downloadBytes(result.bytes, "do101-merged.pdf")}
              >
                Download merged PDF
              </Button>
            </Card>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="📄"
          title="No PDFs added yet"
          description="Add two or more PDFs and they will be joined into a single document, in the order you choose."
        />
      )}
    </div>
  );
}
