"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Select, Slider } from "@/components/ui/Field";
import { ErrorState, EmptyState, Progress, SuccessNote } from "@/components/ui/Feedback";
import {
  imagesToPdf,
  downloadBytes,
  PdfError,
  type PageSize,
  type PageOrientation,
} from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

interface Slot {
  id: string;
  file: File;
  url: string;
}

export function ImagesToPdf({
  accept = "image/*",
  label = "images",
}: {
  accept?: string;
  label?: string;
}) {
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [pageSize, setPageSize] = React.useState<PageSize>("a4");
  const [orientation, setOrientation] = React.useState<PageOrientation>("auto");
  const [margin, setMargin] = React.useState(24);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Uint8Array | null>(null);

  const slotsRef = React.useRef<Slot[]>([]);
  React.useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);
  React.useEffect(() => () => slotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  const add = (files: File[]) => {
    setError(null);
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length !== files.length) {
      setError("Some of those files were not images and were skipped.");
    }
    setSlots((prev) => [
      ...prev,
      ...images.map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
  };

  const remove = (id: string) =>
    setSlots((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((s) => s.id !== id);
    });

  const move = (id: string, direction: -1 | 1) =>
    setSlots((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const run = async () => {
    if (!slots.length) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const bytes = await imagesToPdf(
        slots.map((s) => s.file),
        { pageSize, orientation, margin: pageSize === "fit" ? 0 : margin },
      );
      setResult(bytes);
      track("tool_complete", { tool: "images-to-pdf", images: slots.length });
      recordCompletion(15);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "The PDF could not be built.");
    } finally {
      setBusy(false);
    }
  };

  const totalSize = slots.reduce((n, s) => n + s.file.size, 0);

  return (
    <div className="space-y-4">
      <FileDrop
        onFiles={add}
        accept={accept}
        multiple
        icon="🖼️"
        title={slots.length ? `Add more ${label}` : `Drop your ${label} here`}
        hint="One image per page, in the order shown · nothing is uploaded"
        disabled={busy}
      />

      {error ? <ErrorState message={error} /> : null}

      {slots.length ? (
        <>
          <Card className="p-5">
            <p className="mb-4 text-sm font-extrabold">
              {slots.length} image{slots.length === 1 ? "" : "s"} · {formatBytes(totalSize)} →{" "}
              {slots.length} page{slots.length === 1 ? "" : "s"}
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="page-size">Page size</Label>
                <Select
                  id="page-size"
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as PageSize)}
                >
                  <option value="a4">A4</option>
                  <option value="letter">US Letter</option>
                  <option value="fit">Fit each image exactly</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="orientation">Orientation</Label>
                <Select
                  id="orientation"
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as PageOrientation)}
                  disabled={pageSize === "fit"}
                >
                  <option value="auto">Match each image</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="margin" hint={`${margin}pt`}>
                  Margin
                </Label>
                <Slider
                  id="margin"
                  min={0}
                  max={72}
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  disabled={pageSize === "fit"}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button tone="cherry" onClick={run} disabled={busy}>
                {busy ? "Building…" : "Create PDF"}
              </Button>
              <Button
                tone="ghost"
                onClick={() => {
                  slots.forEach((s) => URL.revokeObjectURL(s.url));
                  setSlots([]);
                  setResult(null);
                }}
                disabled={busy}
              >
                Reset
              </Button>
            </div>

            {busy ? <Progress className="mt-4" value={70} tone="cherry" label="Building PDF" /> : null}
          </Card>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {slots.map((slot, i) => (
              <li key={slot.id}>
                <Card className="p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slot.url}
                    alt={slot.file.name}
                    loading="lazy"
                    className="h-32 w-full rounded-xl border-2 border-[var(--border)] object-cover"
                  />
                  <p className="mt-2 truncate text-center text-xs font-extrabold">
                    {i + 1}. {slot.file.name}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <Button
                      size="sm"
                      tone="panel"
                      className="flex-1"
                      aria-label={`Move ${slot.file.name} earlier`}
                      disabled={i === 0}
                      onClick={() => move(slot.id, -1)}
                    >
                      ←
                    </Button>
                    <Button
                      size="sm"
                      tone="panel"
                      className="flex-1"
                      aria-label={`Move ${slot.file.name} later`}
                      disabled={i === slots.length - 1}
                      onClick={() => move(slot.id, 1)}
                    >
                      →
                    </Button>
                    <Button
                      size="sm"
                      tone="ghost"
                      aria-label={`Remove ${slot.file.name}`}
                      onClick={() => remove(slot.id)}
                    >
                      ✕
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {result ? (
            <Card className="do-pop space-y-3 bg-[var(--grass-soft)] p-5">
              <SuccessNote>
                PDF ready — {slots.length} page{slots.length === 1 ? "" : "s"},{" "}
                {formatBytes(result.length)}.
              </SuccessNote>
              <Button tone="grass" onClick={() => downloadBytes(result, "do101-images.pdf")}>
                Download PDF
              </Button>
            </Card>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="🖼️"
          title={`No ${label} yet`}
          description="Add images and they become the pages of a single PDF, in the order you set."
        />
      )}
    </div>
  );
}
