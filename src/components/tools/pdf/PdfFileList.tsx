"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatBytes } from "@/lib/utils/format";
import type { PdfSlot } from "./usePdfFile";

export function PdfFileList({
  files,
  onRemove,
  onMove,
  reorderable = false,
}: {
  files: PdfSlot[];
  onRemove: (id: string) => void;
  onMove?: (id: string, direction: -1 | 1) => void;
  reorderable?: boolean;
}) {
  if (!files.length) return null;

  return (
    <ul className="space-y-2">
      {files.map((file, i) => (
        <li key={file.id}>
          <Card className="flex flex-wrap items-center gap-3 p-3">
            <span
              aria-hidden
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--cherry-soft)] text-lg"
            >
              📄
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold">{file.name}</span>
              <span className="block text-xs font-semibold text-[var(--muted)]">
                {file.pageCount} page{file.pageCount === 1 ? "" : "s"} · {formatBytes(file.size)}
              </span>
            </span>

            {reorderable && onMove ? (
              <span className="flex gap-1">
                <Button
                  size="sm"
                  tone="panel"
                  aria-label={`Move ${file.name} up`}
                  disabled={i === 0}
                  onClick={() => onMove(file.id, -1)}
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  tone="panel"
                  aria-label={`Move ${file.name} down`}
                  disabled={i === files.length - 1}
                  onClick={() => onMove(file.id, 1)}
                >
                  ↓
                </Button>
              </span>
            ) : null}

            <Button size="sm" tone="ghost" onClick={() => onRemove(file.id)}>
              Remove
            </Button>
          </Card>
        </li>
      ))}
    </ul>
  );
}
