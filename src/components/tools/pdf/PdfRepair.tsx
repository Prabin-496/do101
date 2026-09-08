"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { ErrorState, EmptyState, InfoNote, Stat, SuccessNote } from "@/components/ui/Feedback";
import { repairPdf, downloadBytes, pdfName, PdfError, MAX_PDF_BYTES, type RepairReport } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

export function PdfRepair() {
  const [name, setName] = React.useState("");
  const [size, setSize] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [report, setReport] = React.useState<RepairReport | null>(null);

  /** Loaded directly: a damaged file is exactly what the normal loader rejects. */
  const run = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    setReport(null);
    setName(file.name);
    setSize(file.size);

    if (file.size > MAX_PDF_BYTES) {
      setError(`${file.name} is larger than the 100 MB limit.`);
      return;
    }

    setBusy(true);
    try {
      const result = await repairPdf(await file.arrayBuffer());
      setReport(result);
      track("tool_complete", { tool: "pdf-repair", pages: result.pages });
      recordCompletion(15);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "This file could not be recovered.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <InfoNote icon="🩹">
        <strong>Recovery, not magic.</strong> This re-parses the file loosely and rebuilds a clean
        document from whatever pages survive. It fixes broken cross-reference tables, stray bytes and
        malformed objects. It <strong>cannot invent data that is genuinely missing</strong> — if a
        page&rsquo;s content was lost before you got the file, no tool will bring it back.
      </InfoNote>

      <FileDrop
        onFiles={run}
        accept="application/pdf,.pdf"
        multiple={false}
        icon="🩹"
        title="Drop the damaged PDF"
        hint="Repaired on your device · nothing is uploaded"
        disabled={busy}
      />

      {busy ? <p className="text-sm font-extrabold text-[var(--muted)]">Attempting recovery…</p> : null}
      {error ? (
        <ErrorState
          title="Could not recover this file"
          message={error}
          action={
            <p className="text-xs font-semibold text-[var(--muted)]">
              If the file was downloaded or emailed, try fetching a fresh copy — a truncated
              download is the most common cause and it cannot be repaired from this end.
            </p>
          }
        />
      ) : null}

      {report ? (
        <>
          <SuccessNote>{report.note}</SuccessNote>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Pages recovered" value={report.pages} tone="grass" />
            <Stat label="Original size" value={formatBytes(size)} />
            <Stat label="Rebuilt size" value={formatBytes(report.bytes.length)} tone="sky" />
          </div>
          <p className="rounded-2xl bg-[var(--panel)] px-4 py-3 text-sm font-semibold">
            Open the repaired file and check every page before you rely on it. Keep the original
            until you have.
          </p>
          <Button tone="grass" onClick={() => downloadBytes(report.bytes, pdfName(name, "repaired"))}>
            Download repaired PDF
          </Button>
        </>
      ) : null}

      {!report && !busy && !error ? (
        <EmptyState
          icon="🩹"
          title="No file yet"
          description="Add a PDF that will not open and DO101 will try to rebuild it from what it can read."
        />
      ) : null}
    </div>
  );
}
