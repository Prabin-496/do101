"use client";

import * as React from "react";
import { loadPdf, PdfError, WARN_PDF_BYTES, type LoadedPdf } from "@/lib/pdf/engine";

export interface PdfSlot extends LoadedPdf {
  id: string;
  size: number;
}

/** Shared loading state for every PDF tool: one file, or an ordered list. */
export function usePdfFiles(multiple = false) {
  const [files, setFiles] = React.useState<PdfSlot[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const add = React.useCallback(
    async (incoming: File[]) => {
      setError(null);
      setLoading(true);
      const accepted: PdfSlot[] = [];
      try {
        for (const file of incoming) {
          if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
            setError(`${file.name} is not a PDF.`);
            continue;
          }
          try {
            const loaded = await loadPdf(file);
            accepted.push({
              ...loaded,
              id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
              size: file.size,
            });
          } catch (err) {
            setError(err instanceof PdfError ? err.message : `${file.name} could not be opened.`);
          }
        }
      } finally {
        setLoading(false);
      }
      if (accepted.length) {
        setFiles((prev) => (multiple ? [...prev, ...accepted] : accepted.slice(-1)));
      }
    },
    [multiple],
  );

  const remove = React.useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const move = React.useCallback((id: string, direction: -1 | 1) => {
    setFiles((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const reset = React.useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  const isLarge = files.some((f) => f.size > WARN_PDF_BYTES);

  return { files, error, setError, loading, add, remove, move, reset, isLarge };
}
