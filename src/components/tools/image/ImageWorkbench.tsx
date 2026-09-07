"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Input, Select, Slider, Toggle } from "@/components/ui/Field";
import { EmptyState, ErrorState, Progress } from "@/components/ui/Feedback";
import { Tabs } from "@/components/ui/Tabs";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";
import {
  compressImage,
  drawToBlob,
  downloadBlob,
  loadImage,
  replaceExtension,
  FORMAT_EXT,
  FORMAT_LABEL,
  ImageToolError,
  isHeic,
  WARN_IMAGE_BYTES,
  type LoadedImage,
  type OutputFormat,
} from "@/lib/image/process";

export type WorkbenchMode = "compress" | "resize" | "convert";

interface Item {
  id: string;
  file: File;
  image: LoadedImage;
  previewUrl: string;
  output?: { blob: Blob; url: string; width: number; height: number; quality?: number };
  error?: string;
  status: "ready" | "working" | "done" | "error";
}

const FORMATS: OutputFormat[] = ["image/jpeg", "image/png", "image/webp"];

export function ImageWorkbench({
  mode,
  toolId,
  fixedFormat,
  accept = "image/*",
  dropTitle,
}: {
  mode: WorkbenchMode;
  toolId: string;
  fixedFormat?: OutputFormat;
  accept?: string;
  dropTitle?: string;
}) {
  const [items, setItems] = React.useState<Item[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  // Compress settings
  const [compressMode, setCompressMode] = React.useState<"quality" | "target">("quality");
  const [quality, setQuality] = React.useState(75);
  const [targetKb, setTargetKb] = React.useState(200);

  // Resize settings
  const [resizeBy, setResizeBy] = React.useState<"pixels" | "percent">("pixels");
  const [width, setWidth] = React.useState<string>("");
  const [height, setHeight] = React.useState<string>("");
  const [percent, setPercent] = React.useState(50);
  const [lockRatio, setLockRatio] = React.useState(true);

  const [format, setFormat] = React.useState<OutputFormat>(fixedFormat ?? "image/jpeg");
  const [background, setBackground] = React.useState("#ffffff");

  const first = items[0];

  React.useEffect(() => {
    if (mode === "resize" && first && !width && !height) {
      setWidth(String(first.image.width));
      setHeight(String(first.image.height));
    }
  }, [first, mode, width, height]);

  // Object URLs must be revoked on unmount, and the cleanup has to see the
  // items that exist *then* — not the empty array from the first render.
  const itemsRef = React.useRef<Item[]>([]);
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  React.useEffect(
    () => () => {
      itemsRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
        if (item.output) URL.revokeObjectURL(item.output.url);
        item.image.bitmap.close?.();
      });
    },
    [],
  );

  const addFiles = async (files: File[]) => {
    setLoadError(null);
    const next: Item[] = [];
    for (const file of files.slice(0, 20)) {
      try {
        const image = await loadImage(file);
        next.push({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          image,
          previewUrl: URL.createObjectURL(file),
          status: "ready",
        });
      } catch (err) {
        setLoadError(
          err instanceof ImageToolError ? err.message : `${file.name} could not be opened.`,
        );
      }
    }
    if (next.length) setItems((prev) => [...prev, ...next]);
  };

  const reset = () => {
    items.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
      if (item.output) URL.revokeObjectURL(item.output.url);
      item.image.bitmap.close?.();
    });
    setItems([]);
    setLoadError(null);
    setProgress(0);
    setWidth("");
    setHeight("");
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        if (target.output) URL.revokeObjectURL(target.output.url);
        target.image.bitmap.close?.();
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const onWidthChange = (value: string) => {
    setWidth(value);
    if (lockRatio && first) {
      const w = Number(value);
      if (w > 0) setHeight(String(Math.round((w / first.image.width) * first.image.height)));
    }
  };

  const onHeightChange = (value: string) => {
    setHeight(value);
    if (lockRatio && first) {
      const h = Number(value);
      if (h > 0) setWidth(String(Math.round((h / first.image.height) * first.image.width)));
    }
  };

  const run = async () => {
    if (!items.length || busy) return;
    setBusy(true);
    setProgress(0);
    const total = items.length;
    let index = 0;

    for (const item of items) {
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, status: "working", error: undefined } : p)),
      );
      try {
        let blob: Blob;
        let outWidth = item.image.width;
        let outHeight = item.image.height;
        let usedQuality: number | undefined;

        if (mode === "compress") {
          const result = await compressImage(item.image, {
            format,
            quality: quality / 100,
            targetBytes: compressMode === "target" ? targetKb * 1024 : undefined,
          });
          blob = result.blob;
          outWidth = result.width;
          outHeight = result.height;
          usedQuality = result.quality;
          if (compressMode === "target" && !result.reachedTarget) {
            setItems((prev) =>
              prev.map((p) =>
                p.id === item.id
                  ? {
                      ...p,
                      error: `Could not reach ${targetKb} KB even at the lowest quality. Try resizing the image first.`,
                    }
                  : p,
              ),
            );
          }
        } else if (mode === "resize") {
          if (resizeBy === "percent") {
            outWidth = Math.max(1, Math.round((item.image.width * percent) / 100));
            outHeight = Math.max(1, Math.round((item.image.height * percent) / 100));
          } else {
            const w = Number(width) || item.image.width;
            const h = Number(height) || item.image.height;
            outWidth = Math.max(1, Math.round(w));
            outHeight = Math.max(1, Math.round(h));
          }
          blob = await drawToBlob(item.image.bitmap, {
            width: outWidth,
            height: outHeight,
            format,
            quality: quality / 100,
            background,
          });
        } else {
          blob = await drawToBlob(item.image.bitmap, {
            width: item.image.width,
            height: item.image.height,
            format,
            quality: quality / 100,
            background,
          });
        }

        const url = URL.createObjectURL(blob);
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? {
                  ...p,
                  status: "done",
                  output: { blob, url, width: outWidth, height: outHeight, quality: usedQuality },
                }
              : p,
          ),
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? {
                  ...p,
                  status: "error",
                  error: err instanceof Error ? err.message : "Processing failed.",
                }
              : p,
          ),
        );
      }
      index++;
      setProgress((index / total) * 100);
    }

    setBusy(false);
    track("tool_complete", { tool: toolId, count: total });
    recordCompletion(10);
  };

  const downloadAll = () => {
    items.forEach((item, i) => {
      if (!item.output) return;
      setTimeout(
        () => downloadBlob(item.output!.blob, replaceExtension(item.file.name, FORMAT_EXT[format])),
        i * 250,
      );
    });
  };

  const doneCount = items.filter((i) => i.output).length;
  const totalIn = items.reduce((n, i) => n + i.file.size, 0);
  const totalOut = items.reduce((n, i) => n + (i.output?.blob.size ?? 0), 0);
  const savedPct = totalIn && totalOut ? ((totalIn - totalOut) / totalIn) * 100 : 0;
  const bigFile = items.some((i) => i.file.size > WARN_IMAGE_BYTES);
  const hasHeic = items.some((i) => isHeic(i.file));

  const actionLabel =
    mode === "compress" ? "Compress" : mode === "resize" ? "Resize" : `Convert to ${FORMAT_LABEL[format]}`;

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <FileDrop
          onFiles={addFiles}
          accept={accept}
          title={dropTitle ?? "Drop your images here"}
          hint="JPG, PNG or WebP · up to 25 MB each · nothing is uploaded"
        />
      ) : null}

      {loadError ? <ErrorState message={loadError} title="Could not open that file" /> : null}

      {items.length > 0 ? (
        <>
          <Card className="p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {mode === "compress" ? (
                <div className="sm:col-span-2">
                  <Tabs
                    ariaLabel="Compression mode"
                    value={compressMode}
                    onChange={(v) => setCompressMode(v as "quality" | "target")}
                    items={[
                      { id: "quality", label: "Quality" },
                      { id: "target", label: "Target size" },
                    ]}
                  />
                </div>
              ) : null}

              {mode === "compress" && compressMode === "target" ? (
                <div>
                  <Label htmlFor="target-kb">Target size (KB)</Label>
                  <Input
                    id="target-kb"
                    type="number"
                    min={5}
                    max={20000}
                    value={targetKb}
                    onChange={(e) => setTargetKb(Math.max(5, Number(e.target.value) || 5))}
                  />
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                    DO101 re-encodes at several quality levels and keeps the best one that fits.
                  </p>
                </div>
              ) : null}

              {(mode === "compress" && compressMode === "quality") ||
              (mode !== "compress" && format !== "image/png") ? (
                <div>
                  <Label htmlFor="quality" hint={`${quality}%`}>
                    Quality
                  </Label>
                  <Slider
                    id="quality"
                    min={5}
                    max={100}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                  />
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                    70–80% keeps photos looking sharp at a fraction of the size.
                  </p>
                </div>
              ) : null}

              {mode === "resize" ? (
                <>
                  <div className="sm:col-span-2">
                    <Tabs
                      ariaLabel="Resize mode"
                      value={resizeBy}
                      onChange={(v) => setResizeBy(v as "pixels" | "percent")}
                      items={[
                        { id: "pixels", label: "By pixels" },
                        { id: "percent", label: "By percentage" },
                      ]}
                    />
                  </div>
                  {resizeBy === "pixels" ? (
                    <>
                      <div>
                        <Label htmlFor="width">Width (px)</Label>
                        <Input
                          id="width"
                          type="number"
                          min={1}
                          value={width}
                          onChange={(e) => onWidthChange(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="height">Height (px)</Label>
                        <Input
                          id="height"
                          type="number"
                          min={1}
                          value={height}
                          onChange={(e) => onHeightChange(e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Toggle
                          checked={lockRatio}
                          onChange={setLockRatio}
                          label="Lock aspect ratio"
                          description="Keeps the image from stretching."
                        />
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-2">
                      <Label htmlFor="percent" hint={`${percent}%`}>
                        Scale
                      </Label>
                      <Slider
                        id="percent"
                        min={5}
                        max={200}
                        value={percent}
                        onChange={(e) => setPercent(Number(e.target.value))}
                      />
                      {first ? (
                        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                          {first.image.width}×{first.image.height} →{" "}
                          {Math.round((first.image.width * percent) / 100)}×
                          {Math.round((first.image.height * percent) / 100)} px
                        </p>
                      ) : null}
                    </div>
                  )}
                </>
              ) : null}

              {!fixedFormat ? (
                <div>
                  <Label htmlFor="format">Output format</Label>
                  <Select
                    id="format"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as OutputFormat)}
                  >
                    {FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {FORMAT_LABEL[f]}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              {format === "image/jpeg" ? (
                <div>
                  <Label htmlFor="bg">Background for transparency</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="bg"
                      type="color"
                      value={background}
                      onChange={(e) => setBackground(e.target.value)}
                      className="h-12 w-14 cursor-pointer rounded-xl border-2 border-[var(--border)] bg-transparent"
                    />
                    <span className="text-xs font-semibold text-[var(--muted)]">
                      JPG has no transparency, so clear pixels get this colour.
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {hasHeic ? (
              <p className="mt-4 rounded-xl bg-[var(--sky-soft)] px-3 py-2 text-xs font-bold">
                📱 HEIC detected. No browser decodes Apple&rsquo;s HEIC natively, so DO101 loads a
                WebAssembly decoder for it — the first one takes a moment longer.
              </p>
            ) : null}

            {bigFile ? (
              <p className="mt-4 rounded-xl bg-[var(--sun-soft)] px-3 py-2 text-xs font-bold text-[var(--ink)]">
                ⚠️ One of these files is over 8 MB. Processing may take a few seconds and use a lot
                of memory on older phones.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={run} disabled={busy} tone="grass">
                {busy ? "Working…" : actionLabel}
              </Button>
              {doneCount > 0 ? (
                <Button onClick={downloadAll} tone="sky">
                  Download {doneCount > 1 ? `all (${doneCount})` : ""}
                </Button>
              ) : null}
              <Button onClick={reset} tone="ghost" disabled={busy}>
                Reset
              </Button>
            </div>

            {busy ? <Progress className="mt-4" value={progress} label="Processing" /> : null}
          </Card>

          {doneCount > 1 ? (
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm font-extrabold">
                {doneCount} images · {formatBytes(totalIn)} → {formatBytes(totalOut)}
              </p>
              <p
                className="text-sm font-extrabold"
                style={{ color: savedPct > 0 ? "var(--grass)" : "var(--fire)" }}
              >
                {savedPct > 0 ? `${savedPct.toFixed(0)}% smaller` : `${Math.abs(savedPct).toFixed(0)}% larger`}
              </p>
            </Card>
          ) : null}

          <div className="space-y-3">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                format={format}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>

          <FileDrop
            onFiles={addFiles}
            accept={accept}
            title="Add more images"
            icon="➕"
            hint="Up to 20 at a time"
            disabled={busy}
          />
        </>
      ) : null}

      {items.length === 0 && !loadError ? (
        <EmptyState
          icon="📥"
          title="No image yet"
          description="Add a picture above and the controls will appear right here."
        />
      ) : null}
    </div>
  );
}

function ItemRow({
  item,
  format,
  onRemove,
}: {
  item: Item;
  format: OutputFormat;
  onRemove: () => void;
}) {
  const saved = item.output ? item.file.size - item.output.blob.size : 0;
  const savedPct = item.output ? (saved / item.file.size) * 100 : 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 sm:w-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.output?.url ?? item.previewUrl}
            alt={`Preview of ${item.file.name}`}
            className="h-20 w-20 shrink-0 rounded-xl border-2 border-[var(--border)] object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold">{item.file.name}</p>
            <p className="text-xs font-semibold text-[var(--muted)]">
              {item.image.width}×{item.image.height} px · {formatBytes(item.file.size)}
            </p>
            {item.output ? (
              <p className="text-xs font-extrabold text-[var(--grass)]">
                → {item.output.width}×{item.output.height} px · {formatBytes(item.output.blob.size)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          {item.output ? (
            <span
              className="rounded-xl px-3 py-1.5 text-xs font-extrabold"
              style={{
                background: savedPct >= 0 ? "var(--grass-soft)" : "var(--fire-soft)",
                color: savedPct >= 0 ? "var(--grass-dark)" : "var(--fire-dark)",
              }}
            >
              {savedPct >= 0
                ? `${savedPct.toFixed(0)}% smaller`
                : `${Math.abs(savedPct).toFixed(0)}% larger`}
            </span>
          ) : null}
          {item.status === "working" ? (
            <span className="text-xs font-extrabold text-[var(--muted)]">Working…</span>
          ) : null}
          {item.output ? (
            <Button
              size="sm"
              tone="grass"
              onClick={() =>
                downloadBlob(item.output!.blob, replaceExtension(item.file.name, FORMAT_EXT[format]))
              }
            >
              Download
            </Button>
          ) : null}
          <Button size="sm" tone="ghost" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>

      {item.error ? (
        <p className="border-t-2 border-[var(--border)] bg-[var(--cherry-soft)] px-4 py-2 text-xs font-bold text-[var(--ink)]">
          {item.error}
        </p>
      ) : null}
    </Card>
  );
}
