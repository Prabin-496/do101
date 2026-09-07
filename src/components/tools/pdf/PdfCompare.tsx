"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Field";
import { ErrorState, EmptyState, Progress, Stat, SuccessNote } from "@/components/ui/Feedback";
import { loadPdf, PdfError, type LoadedPdf } from "@/lib/pdf/engine";
import { extractPdfText } from "@/lib/pdf/render";
import { diffWords, diffSummary } from "@/lib/text/diff";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

interface Side {
  file: LoadedPdf;
  size: number;
  text: string;
}

export function PdfCompare() {
  const [left, setLeft] = React.useState<Side | null>(null);
  const [right, setRight] = React.useState<Side | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"left" | "right" | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [ignoreCase, setIgnoreCase] = React.useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = React.useState(true);

  const load = async (files: File[], side: "left" | "right") => {
    const file = files[0];
    if (!file) return;
    setError(null);
    setBusy(side);
    setProgress(0);
    try {
      const loaded = await loadPdf(file);
      const { pages, hasText } = await extractPdfText(loaded.bytes, (done, total) =>
        setProgress((done / total) * 100),
      );
      if (!hasText) {
        throw new PdfError(
          `${file.name} has no text layer — it is a scan. Compare needs readable text, so run it through PDF OCR first.`,
        );
      }
      const value: Side = {
        file: loaded,
        size: file.size,
        text: pages.map((p) => p.text).join("\n\n"),
      };
      if (side === "left") setLeft(value);
      else setRight(value);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "That PDF could not be read.");
    } finally {
      setBusy(null);
    }
  };

  const parts = React.useMemo(
    () =>
      left && right
        ? diffWords(left.text, right.text, { ignoreCase, ignoreWhitespace })
        : [],
    [left, right, ignoreCase, ignoreWhitespace],
  );
  const summary = React.useMemo(() => diffSummary(parts), [parts]);

  React.useEffect(() => {
    if (parts.length) {
      track("tool_complete", { tool: "pdf-compare" });
      recordCompletion(15);
    }
  }, [parts.length]);

  const slot = (side: "left" | "right", value: Side | null, label: string) => (
    <div>
      <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
      {value ? (
        <Card className="flex items-center justify-between gap-3 p-4">
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold">📄 {value.file.name}</span>
            <span className="text-xs font-semibold text-[var(--muted)]">
              {value.file.pageCount} pages · {formatBytes(value.size)}
            </span>
          </span>
          <Button
            size="sm"
            tone="ghost"
            onClick={() => (side === "left" ? setLeft(null) : setRight(null))}
          >
            Replace
          </Button>
        </Card>
      ) : (
        <FileDrop
          onFiles={(files) => load(files, side)}
          accept="application/pdf,.pdf"
          multiple={false}
          icon="📄"
          title={`Drop the ${label.toLowerCase()}`}
          hint="Read on your device"
          disabled={busy !== null}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {slot("left", left, "Original document")}
        {slot("right", right, "Revised document")}
      </div>

      {busy ? <Progress value={progress} tone="cherry" label="Reading text" /> : null}
      {error ? <ErrorState message={error} /> : null}

      {left && right ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle checked={ignoreCase} onChange={setIgnoreCase} label="Ignore capitalisation" />
            <Toggle
              checked={ignoreWhitespace}
              onChange={setIgnoreWhitespace}
              label="Ignore whitespace differences"
              description="Recommended — PDF line wrapping differs between exports."
            />
          </div>

          {summary.identical ? (
            <SuccessNote>The text of these two documents is identical.</SuccessNote>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Added" value={summary.added} tone="grass" />
                <Stat label="Removed" value={summary.removed} tone="cherry" />
                <Stat label="Unchanged" value={summary.unchanged} />
              </div>

              <Card className="p-5">
                <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  Differences
                </h3>
                <p className="do-scroll max-h-[520px] overflow-auto whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">
                  {parts.map((part, i) =>
                    part.op === "equal" ? (
                      <span key={i}>{part.value}</span>
                    ) : part.op === "insert" ? (
                      <ins
                        key={i}
                        className="rounded bg-[var(--grass-soft)] px-0.5 font-bold text-[var(--grass-dark)] no-underline dark:text-[var(--grass)]"
                      >
                        {part.value}
                      </ins>
                    ) : (
                      <del
                        key={i}
                        className="rounded bg-[var(--cherry-soft)] px-0.5 font-bold text-[var(--cherry-dark)] dark:text-[var(--cherry)]"
                      >
                        {part.value}
                      </del>
                    ),
                  )}
                </p>
              </Card>
            </>
          )}

          <p className="text-xs font-semibold text-[var(--muted)]">
            This compares the <strong>text</strong> of the two documents. Images, formatting and
            layout changes are not detected.
          </p>
        </>
      ) : (
        <EmptyState
          icon="🔍"
          title="Add both documents"
          description="Drop the original and the revised PDF above to see exactly which words changed."
        />
      )}
    </div>
  );
}
