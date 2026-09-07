"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Select, Textarea } from "@/components/ui/Field";
import { CopyButton } from "@/components/ui/CopyButton";
import { ErrorState, EmptyState, InfoNote, Progress, Stat } from "@/components/ui/Feedback";
import {
  recognizeImages,
  describeStage,
  OCR_LANGUAGES,
  OcrError,
  type OcrPageResult,
} from "@/lib/ocr/engine";
import { renderPdfPages } from "@/lib/pdf/render";
import { loadPdf, downloadBytes, PdfError } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

const MAX_OCR_PAGES = 20;

export function OcrTool({ source }: { source: "image" | "pdf" }) {
  const [language, setLanguage] = React.useState("eng");
  const [busy, setBusy] = React.useState(false);
  const [stage, setStage] = React.useState("");
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<OcrPageResult[] | null>(null);
  const [fileName, setFileName] = React.useState("");

  const combined = React.useMemo(
    () =>
      results
        ? results
            .map((r) => (results.length > 1 ? `--- ${r.label} ---\n${r.text}` : r.text))
            .join("\n\n")
        : "",
    [results],
  );

  const averageConfidence = results?.length
    ? Math.round(results.reduce((n, r) => n + r.confidence, 0) / results.length)
    : 0;

  const run = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    setResults(null);
    setProgress(0);
    setFileName(file.name);

    try {
      let sources: Array<{ label: string; image: Blob | string }> = [];
      let cleanup: string[] = [];

      if (source === "pdf") {
        const loaded = await loadPdf(file);
        if (loaded.pageCount > MAX_OCR_PAGES) {
          throw new PdfError(
            `This PDF has ${loaded.pageCount} pages. OCR is capped at ${MAX_OCR_PAGES} pages per run so the browser stays responsive — split the file first and run it in batches.`,
          );
        }
        setStage("Rendering pages…");
        const rendered = await renderPdfPages(loaded.bytes, {
          scale: 2.5, // OCR is much more accurate above 150 DPI.
          format: "image/png",
          onProgress: (done, total) => setProgress((done / total) * 30),
        });
        cleanup = rendered.map((p) => p.url);
        sources = rendered.map((p) => ({ label: `Page ${p.page}`, image: p.blob }));
      } else {
        if (!file.type.startsWith("image/")) {
          throw new OcrError(`${file.name} is not an image.`);
        }
        sources = [{ label: file.name, image: file }];
      }

      const recognised = await recognizeImages(sources, {
        language,
        onProgress: (info) => {
          setStage(describeStage(info.stage));
          const base = source === "pdf" ? 30 : 0;
          const span = 100 - base;
          const perPage = info.total ? span / info.total : span;
          const done = Math.max(0, info.page - 1) * perPage;
          setProgress(base + done + perPage * (info.progress || 0));
        },
      });

      cleanup.forEach((url) => URL.revokeObjectURL(url));
      setResults(recognised);
      track("tool_complete", { tool: source === "pdf" ? "pdf-ocr" : "image-to-text", language });
      recordCompletion(20);
    } catch (err) {
      setError(
        err instanceof OcrError || err instanceof PdfError
          ? err.message
          : "Text recognition failed. Try a clearer or smaller image.",
      );
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  return (
    <div className="space-y-4">
      <InfoNote icon="📥">
        The first run downloads the OCR engine and your chosen language model —{" "}
        <strong>about 12–15 MB</strong> — from a public CDN, then your browser caches it. The
        recognition itself happens on your device: the {source === "pdf" ? "PDF" : "image"} is never
        uploaded.
      </InfoNote>

      <Card className="p-5">
        <div className="max-w-sm">
          <Label htmlFor="ocr-lang">Language of the text</Label>
          <Select
            id="ocr-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={busy}
          >
            {OCR_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
            Picking the right language makes a large difference to accuracy.
          </p>
        </div>
      </Card>

      <FileDrop
        onFiles={run}
        accept={source === "pdf" ? "application/pdf,.pdf" : "image/*"}
        multiple={false}
        icon={source === "pdf" ? "📄" : "🔍"}
        title={source === "pdf" ? "Drop a scanned PDF" : "Drop an image with text"}
        hint={
          source === "pdf"
            ? `Up to ${MAX_OCR_PAGES} pages per run · nothing is uploaded`
            : "Photos, screenshots and scans · nothing is uploaded"
        }
        disabled={busy}
      />

      {busy ? (
        <Card className="space-y-3 p-5">
          <p className="text-sm font-extrabold">{stage || "Working…"}</p>
          <Progress value={progress} tone="grape" />
          <p className="text-xs font-semibold text-[var(--muted)]">
            The first run is the slow one — after that the model is cached.
          </p>
        </Card>
      ) : null}

      {error ? <ErrorState message={error} /> : null}

      {results ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Pages read" value={results.length} tone="grape" />
            <Stat
              label="Confidence"
              value={`${averageConfidence}%`}
              tone={averageConfidence >= 80 ? "grass" : averageConfidence >= 60 ? "fire" : "cherry"}
            />
            <Stat label="Characters" value={combined.length.toLocaleString()} tone="sky" />
          </div>

          {averageConfidence < 70 ? (
            <p className="rounded-2xl bg-[var(--sun-soft)] px-4 py-3 text-sm font-bold">
              ⚠️ Confidence is low ({averageConfidence}%), so expect mistakes. OCR works best on
              straight, high-contrast, well-lit text. A sharper scan or the correct language usually
              helps more than anything else.
            </p>
          ) : null}

          <div>
            <label
              htmlFor="ocr-out"
              className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
            >
              Recognised text
            </label>
            <Textarea
              id="ocr-out"
              value={combined}
              readOnly
              className="min-h-[280px] bg-[var(--panel)] font-mono text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton value={combined} label="Copy text" tone="grass" size="md" />
            <Button
              tone="panel"
              onClick={() =>
                downloadBytes(
                  new TextEncoder().encode(combined),
                  `${fileName.replace(/\.[^.]+$/, "")}-ocr.txt`,
                  "text/plain;charset=utf-8",
                )
              }
            >
              Download .txt
            </Button>
          </div>

          <p className="text-xs font-semibold text-[var(--muted)]">
            Recognised {formatBytes(new TextEncoder().encode(combined).length)} of text. Always
            proofread OCR output before relying on it.
          </p>
        </>
      ) : null}

      {!results && !busy && !error ? (
        <EmptyState
          icon={source === "pdf" ? "📄" : "🔍"}
          title="Nothing read yet"
          description={
            source === "pdf"
              ? "Add a scanned PDF and its pages are read as text."
              : "Add a photo or screenshot and the words in it become copyable text."
          }
        />
      ) : null}
    </div>
  );
}
