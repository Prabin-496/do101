"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Field";
import { ErrorState, EmptyState, SuccessNote } from "@/components/ui/Feedback";
import { usePdfFiles } from "./usePdfFile";
import { parsePageRanges, describeSelection, invertSelection } from "@/lib/pdf/pages";
import {
  selectPages,
  deletePages,
  rotatePages,
  downloadBytes,
  pdfName,
  PdfError,
  type Rotation,
} from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

export type PageMode = "extract" | "delete" | "rotate" | "reorder";

const COPY: Record<
  PageMode,
  { label: string; hint: string; action: string; suffix: string; placeholder: string }
> = {
  extract: {
    label: "Pages to keep",
    hint: "Everything else is discarded.",
    action: "Extract pages",
    suffix: "extracted",
    placeholder: "1-3, 7",
  },
  delete: {
    label: "Pages to delete",
    hint: "Everything else is kept, in its original order.",
    action: "Delete pages",
    suffix: "trimmed",
    placeholder: "2, 5-6",
  },
  rotate: {
    label: "Pages to rotate",
    hint: "Leave as “all” to turn the whole document.",
    action: "Rotate pages",
    suffix: "rotated",
    placeholder: "all",
  },
  reorder: {
    label: "New page order",
    hint: "List the pages in the order you want them. Any page you leave out is dropped.",
    action: "Reorder pages",
    suffix: "reordered",
    placeholder: "3, 1, 2, 4-8",
  },
};

export function PdfPageTool({ mode }: { mode: PageMode }) {
  const { files, error, setError, loading, add, reset } = usePdfFiles(false);
  const [ranges, setRanges] = React.useState(mode === "rotate" ? "all" : "");
  const [turn, setTurn] = React.useState<Rotation>(90);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ bytes: Uint8Array; pages: number } | null>(null);

  const file = files[0];
  const copy = COPY[mode];

  const parsed = React.useMemo(
    () => (file ? parsePageRanges(ranges, file.pageCount) : null),
    [ranges, file],
  );

  // "Delete" and "extract" describe opposite halves of the same selection.
  const resulting = React.useMemo(() => {
    if (!file || !parsed || parsed.error) return null;
    return mode === "delete" ? invertSelection(parsed.indices, file.pageCount) : parsed.indices;
  }, [file, parsed, mode]);

  const run = async () => {
    if (!file || !parsed || parsed.error) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      let bytes: Uint8Array;
      if (mode === "delete") {
        bytes = await deletePages(file.bytes, parsed.indices);
      } else if (mode === "rotate") {
        bytes = await rotatePages(file.bytes, parsed.indices, turn);
      } else {
        bytes = await selectPages(file.bytes, parsed.indices);
      }
      setResult({ bytes, pages: mode === "rotate" ? file.pageCount : (resulting?.length ?? 0) });
      track("tool_complete", { tool: `pdf-${mode}` });
      recordCompletion(10);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "That operation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {!file ? (
        <FileDrop
          onFiles={add}
          accept="application/pdf,.pdf"
          multiple={false}
          icon="📄"
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
                📄 {file.name} · {file.pageCount} page{file.pageCount === 1 ? "" : "s"} ·{" "}
                {formatBytes(file.size)}
              </p>
              <Button
                size="sm"
                tone="ghost"
                onClick={() => {
                  reset();
                  setResult(null);
                }}
              >
                Choose another
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className={mode === "rotate" ? "" : "sm:col-span-2"}>
                <Label htmlFor="ranges" hint={`1–${file.pageCount}`}>
                  {copy.label}
                </Label>
                <Input
                  id="ranges"
                  value={ranges}
                  onChange={(e) => setRanges(e.target.value)}
                  placeholder={copy.placeholder}
                  aria-describedby="ranges-help"
                />
                <p id="ranges-help" className="mt-1 text-xs font-semibold text-[var(--muted)]">
                  {copy.hint} Accepts <code className="font-mono">1</code>,{" "}
                  <code className="font-mono">2-5</code>, <code className="font-mono">8-</code>, and
                  the words <code className="font-mono">all</code>,{" "}
                  <code className="font-mono">odd</code>, <code className="font-mono">even</code>,{" "}
                  <code className="font-mono">last</code>.
                </p>
              </div>

              {mode === "rotate" ? (
                <div>
                  <Label htmlFor="turn">Rotation</Label>
                  <Select
                    id="turn"
                    value={String(turn)}
                    onChange={(e) => setTurn(Number(e.target.value) as Rotation)}
                  >
                    <option value="90">90° clockwise</option>
                    <option value="180">180° upside down</option>
                    <option value="270">90° anticlockwise</option>
                  </Select>
                </div>
              ) : null}
            </div>

            {parsed?.error && ranges ? (
              <p className="mt-3 rounded-xl bg-[var(--cherry-soft)] px-3 py-2 text-sm font-bold">
                {parsed.error}
              </p>
            ) : null}

            {resulting && !parsed?.error ? (
              <p className="mt-3 rounded-xl bg-[var(--sky-soft)] px-3 py-2 text-sm font-bold">
                {mode === "rotate"
                  ? `Rotating page${parsed!.indices.length === 1 ? "" : "s"} ${describeSelection(parsed!.indices)} by ${turn}°.`
                  : resulting.length === 0
                    ? "That leaves no pages at all."
                    : `Result: ${resulting.length} page${resulting.length === 1 ? "" : "s"} — ${describeSelection(resulting)}.`}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                tone="cherry"
                onClick={run}
                disabled={busy || !parsed || Boolean(parsed.error) || resulting?.length === 0}
              >
                {busy ? "Working…" : copy.action}
              </Button>
              <Button tone="ghost" onClick={() => setRanges(mode === "rotate" ? "all" : "")}>
                Clear
              </Button>
            </div>
          </Card>

          {result ? (
            <Card className="do-pop space-y-3 bg-[var(--grass-soft)] p-5">
              <SuccessNote>
                Done — {result.pages} page{result.pages === 1 ? "" : "s"},{" "}
                {formatBytes(result.bytes.length)}.
              </SuccessNote>
              <Button
                tone="grass"
                onClick={() => downloadBytes(result.bytes, pdfName(file.name, copy.suffix))}
              >
                Download PDF
              </Button>
            </Card>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="📄"
          title="No PDF yet"
          description="Add a PDF and the page controls appear here."
        />
      )}
    </div>
  );
}
