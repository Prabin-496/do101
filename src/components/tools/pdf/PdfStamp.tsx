"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Select, Slider, Toggle } from "@/components/ui/Field";
import { ErrorState, EmptyState, SuccessNote } from "@/components/ui/Feedback";
import { usePdfFiles } from "./usePdfFile";
import {
  addWatermark,
  addPageNumbers,
  downloadBytes,
  pdfName,
  PdfError,
  type NumberPosition,
} from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

export function PdfStamp({ mode }: { mode: "watermark" | "numbers" }) {
  const { files, error, setError, loading, add, reset } = usePdfFiles(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Uint8Array | null>(null);

  // Watermark settings
  const [text, setText] = React.useState("CONFIDENTIAL");
  const [opacity, setOpacity] = React.useState(20);
  const [fontSize, setFontSize] = React.useState(56);
  const [color, setColor] = React.useState("#ff4b4b");
  const [diagonal, setDiagonal] = React.useState(true);

  // Page number settings
  const [position, setPosition] = React.useState<NumberPosition>("bottom-center");
  const [startAt, setStartAt] = React.useState(1);
  const [format, setFormat] = React.useState("{n}");
  const [numberSize, setNumberSize] = React.useState(11);

  const file = files[0];

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const bytes =
        mode === "watermark"
          ? await addWatermark(file.bytes, {
              text,
              opacity: opacity / 100,
              fontSize,
              color: hexToRgb(color),
              diagonal,
            })
          : await addPageNumbers(file.bytes, {
              position,
              startAt,
              format,
              fontSize: numberSize,
            });
      setResult(bytes);
      track("tool_complete", { tool: `pdf-${mode}` });
      recordCompletion(10);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "That could not be applied.");
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
          icon={mode === "watermark" ? "💧" : "🔢"}
          title="Drop your PDF here"
          hint="Stamped on your device · nothing is uploaded"
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
                  setResult(null);
                }}
              >
                Choose another
              </Button>
            </div>

            {mode === "watermark" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="wm-text">Watermark text</Label>
                  <Input
                    id="wm-text"
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 60))}
                    maxLength={60}
                    placeholder="CONFIDENTIAL"
                  />
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                    Uses the standard Helvetica font, so Latin characters only.
                  </p>
                </div>
                <div>
                  <Label htmlFor="wm-opacity" hint={`${opacity}%`}>
                    Opacity
                  </Label>
                  <Slider
                    id="wm-opacity"
                    min={5}
                    max={100}
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="wm-size" hint={`${fontSize}pt`}>
                    Size
                  </Label>
                  <Slider
                    id="wm-size"
                    min={12}
                    max={140}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="wm-color">Colour</Label>
                  <input
                    id="wm-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-12 w-full cursor-pointer rounded-xl border-2 border-[var(--border)] bg-transparent"
                  />
                </div>
                <div className="flex items-end">
                  <Toggle
                    checked={diagonal}
                    onChange={setDiagonal}
                    label="Diagonal"
                    description="45° across the page."
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pn-position">Position</Label>
                  <Select
                    id="pn-position"
                    value={position}
                    onChange={(e) => setPosition(e.target.value as NumberPosition)}
                  >
                    <option value="bottom-center">Bottom centre</option>
                    <option value="bottom-right">Bottom right</option>
                    <option value="bottom-left">Bottom left</option>
                    <option value="top-right">Top right</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pn-format">Format</Label>
                  <Select id="pn-format" value={format} onChange={(e) => setFormat(e.target.value)}>
                    <option value="{n}">1</option>
                    <option value="- {n} -">- 1 -</option>
                    <option value="Page {n}">Page 1</option>
                    <option value="{n} / {total}">1 / {file.pageCount}</option>
                    <option value="Page {n} of {total}">Page 1 of {file.pageCount}</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pn-start">Start numbering at</Label>
                  <Input
                    id="pn-start"
                    type="number"
                    min={0}
                    value={startAt}
                    onChange={(e) => setStartAt(Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="pn-size" hint={`${numberSize}pt`}>
                    Text size
                  </Label>
                  <Slider
                    id="pn-size"
                    min={7}
                    max={24}
                    value={numberSize}
                    onChange={(e) => setNumberSize(Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                tone="cherry"
                onClick={run}
                disabled={busy || (mode === "watermark" && !text.trim())}
              >
                {busy
                  ? "Applying…"
                  : mode === "watermark"
                    ? "Add watermark"
                    : "Add page numbers"}
              </Button>
            </div>
          </Card>

          {result ? (
            <Card className="do-pop space-y-3 bg-[var(--grass-soft)] p-5">
              <SuccessNote>Applied to all {file.pageCount} pages.</SuccessNote>
              <Button
                tone="grass"
                onClick={() =>
                  downloadBytes(result, pdfName(file.name, mode === "watermark" ? "watermarked" : "numbered"))
                }
              >
                Download PDF
              </Button>
            </Card>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={mode === "watermark" ? "💧" : "🔢"}
          title="No PDF yet"
          description={
            mode === "watermark"
              ? "Add a PDF to stamp text across every page."
              : "Add a PDF to number every page."
          }
        />
      )}
    </div>
  );
}
