"use client";

import * as React from "react";
import type { SheetGrid } from "@/lib/wbs/grid";

/**
 * The sheet as it will be downloaded.
 *
 * Built from the same grid the .xlsx is written from, so this is not an
 * impression of the export — it is the export, minus the file.
 */
export function WbsSheetPreview({
  grid,
  limit = 14,
  className = "",
}: {
  /** Built once by the caller, which also needs it for the downloads. */
  grid: SheetGrid;
  /** Rows to show. The whole sheet is shown when this is 0. */
  limit?: number;
  className?: string;
}) {
  const rows = limit > 0 ? grid.rows.slice(0, limit) : grid.rows;

  return (
    <div className={className}>
      <div className="do-scroll overflow-auto rounded-2xl border-2 border-[var(--border)]">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--panel)]">
              {grid.columns.map((column) => (
                <th
                  key={column.key}
                  className="sticky top-0 whitespace-nowrap border-b-2 border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-left font-extrabold uppercase tracking-wider text-[var(--muted)]"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={grid.source[index]?.id ?? index}
                className={`border-b border-[var(--border)] ${
                  grid.source[index]?.isSummary ? "bg-[var(--panel)]" : ""
                }`}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={grid.columns[cellIndex]?.key ?? cellIndex}
                    className={`whitespace-pre px-3 py-1.5 font-semibold ${
                      cell.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {cell.formula ? <span title={`=${cell.formula}`}>{cell.text}</span> : cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {limit > 0 && grid.rows.length > rows.length ? (
        <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
          Showing the first {rows.length} rows. The download has all {grid.rows.length}.
        </p>
      ) : null}
    </div>
  );
}
