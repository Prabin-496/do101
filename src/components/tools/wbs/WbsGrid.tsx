"use client";

import * as React from "react";
import { Input, Select } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";
import { formatValue, isNumericField } from "@/lib/wbs/fields";
import type { FieldValue, WbsDoc, WbsField, WbsRow } from "@/lib/wbs/model";

/**
 * The work breakdown as a spreadsheet.
 *
 * This is the primary view, and it is deliberately a table: one row per task,
 * the hierarchy carried by the WBS Number column rather than by a picture.
 * Columns are pinned on the left, resizable, and in the same order they leave
 * in — what is on screen is what lands in the workbook.
 */

/** Roughly the width of a character in the sheet, used to trade px for the
 * character widths Excel wants. */
const CHAR_PX = 8;
const GRIP_WIDTH = 26;

export interface GridHandlers {
  onSelect: (id: string) => void;
  onName: (id: string, name: string) => void;
  onValue: (id: string, fieldId: string, value: FieldValue) => void;
  onToggle: (id: string) => void;
  onKeyDown: (id: string, event: React.KeyboardEvent) => void;
  /** Drag and drop: put `id` before or after `targetId`. */
  onReorder: (id: string, targetId: string, position: "before" | "after") => void;
  onResizeField: (fieldId: string, chars: number) => void;
  onResizeColumn: (column: "code" | "name", px: number) => void;
}

function ResizeHandle({ onDrag, label }: { onDrag: (deltaPx: number) => void; label: string }) {
  const from = React.useRef(0);
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        from.current = event.clientX;
        (event.target as HTMLElement).setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!(event.target as HTMLElement).hasPointerCapture?.(event.pointerId)) return;
        const delta = event.clientX - from.current;
        if (Math.abs(delta) < 2) return;
        from.current = event.clientX;
        onDrag(delta);
      }}
      onPointerUp={(event) =>
        (event.target as HTMLElement).releasePointerCapture?.(event.pointerId)
      }
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        onDrag(event.key === "ArrowRight" ? 16 : -16);
      }}
      className="absolute inset-y-0 right-0 w-2 cursor-col-resize touch-none select-none hover:bg-[var(--sky)]/40 focus-visible:bg-[var(--sky)]/60"
    />
  );
}

function CellInput({
  row,
  field,
  doc,
  onValue,
}: {
  row: WbsRow;
  field: WbsField;
  doc: WbsDoc;
  onValue: GridHandlers["onValue"];
}) {
  const value = row.values[field.id] ?? null;
  // A computed column, and a rolled-up total on a summary row, are read only:
  // a figure you could type over would quietly stop matching its inputs.
  const derived = Boolean(field.computed) || (row.isSummary && field.rollup !== "none");

  if (derived) {
    const text = formatValue(value, field, doc.settings);
    return (
      <span
        className={cn(
          "block truncate px-2 py-1 text-xs font-extrabold text-[var(--muted)]",
          field.computed?.kind === "timeline"
            ? "font-mono tracking-tight text-[var(--ink)]"
            : "text-right",
        )}
        title={
          field.computed
            ? `${field.label} is worked out from the dates`
            : `Rolled up from the tasks beneath`
        }
      >
        {text || "—"}
      </span>
    );
  }

  const own = row.own[field.id] ?? null;

  if (field.type === "select") {
    return (
      <Select
        aria-label={`${field.label} for ${row.name || row.code}`}
        className="h-8 w-full min-w-0 px-2 py-1 text-xs"
        value={typeof own === "string" ? own : ""}
        onChange={(event) => onValue(row.id, field.id, event.target.value || null)}
      >
        <option value="">—</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    );
  }

  const type = field.type === "date" ? "date" : isNumericField(field) ? "number" : "text";

  return (
    <Input
      aria-label={`${field.label} for ${row.name || row.code}`}
      className={cn("h-8 w-full min-w-0 px-2 py-1 text-xs", isNumericField(field) && "text-right")}
      type={type}
      inputMode={isNumericField(field) ? "decimal" : undefined}
      step={field.type === "currency" ? "0.01" : undefined}
      min={field.type === "percent" ? 0 : undefined}
      max={field.type === "percent" ? 100 : undefined}
      value={own === null ? "" : String(own)}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === "") return onValue(row.id, field.id, null);
        onValue(row.id, field.id, isNumericField(field) ? Number(raw) : raw);
      }}
    />
  );
}

export function WbsGrid({
  doc,
  rows,
  fields,
  selectedId,
  focusId,
  handlers,
  height = 520,
}: {
  doc: WbsDoc;
  rows: WbsRow[];
  fields: WbsField[];
  selectedId: string | null;
  focusId: string | null;
  handlers: GridHandlers;
  height?: number;
}) {
  const inputs = React.useRef(new Map<string, HTMLInputElement>());
  const [drag, setDrag] = React.useState<{
    id: string;
    targetId: string | null;
    position: "before" | "after";
  } | null>(null);

  React.useEffect(() => {
    if (!focusId) return;
    const input = inputs.current.get(focusId);
    input?.focus();
    input?.select();
  }, [focusId]);

  const codeWidth = doc.settings.codeWidth;
  const nameWidth = doc.settings.nameWidth;
  const nameLeft = GRIP_WIDTH + codeWidth;

  /** The row under the pointer, and which side of it the drop lands on. */
  function dropAt(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY)?.closest("[data-row-id]");
    if (!(element instanceof HTMLElement)) return null;
    const targetId = element.dataset.rowId;
    if (!targetId) return null;
    const box = element.getBoundingClientRect();
    return { targetId, position: clientY < box.top + box.height / 2 ? "before" : "after" } as const;
  }

  const pinned = "sticky z-20";

  return (
    <div
      className="do-scroll overflow-auto rounded-2xl border-2 border-[var(--border)]"
      style={{ maxHeight: height }}
    >
      <table className="w-max border-collapse text-sm" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: GRIP_WIDTH }} />
          <col style={{ width: codeWidth }} />
          <col style={{ width: nameWidth }} />
          {fields.map((field) => (
            <col key={field.id} style={{ width: field.width * CHAR_PX }} />
          ))}
        </colgroup>

        <thead>
          <tr>
            <th
              className={cn(pinned, "left-0 top-0 z-40 border-b-2 border-[var(--border)] bg-[var(--panel)]")}
            >
              <span className="sr-only">Reorder</span>
            </th>
            <th
              className={cn(
                pinned,
                "top-0 z-40 border-b-2 border-r border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-left text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]",
              )}
              style={{ left: GRIP_WIDTH }}
            >
              <span className="relative block">
                WBS Number
                <ResizeHandle
                  label="the WBS Number column"
                  onDrag={(delta) => handlers.onResizeColumn("code", codeWidth + delta)}
                />
              </span>
            </th>
            <th
              className={cn(
                pinned,
                "top-0 z-40 border-b-2 border-r border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-left text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]",
              )}
              style={{ left: nameLeft }}
            >
              <span className="relative block">
                Task Title
                <ResizeHandle
                  label="the Task Title column"
                  onDrag={(delta) => handlers.onResizeColumn("name", nameWidth + delta)}
                />
              </span>
            </th>
            {fields.map((field) => (
              <th
                key={field.id}
                className="sticky top-0 z-30 border-b-2 border-[var(--border)] bg-[var(--panel)] px-2 py-2 text-left text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
              >
                <span className="relative block truncate" title={field.label}>
                  {field.label}
                  <ResizeHandle
                    label={`the ${field.label} column`}
                    onDrag={(delta) =>
                      handlers.onResizeField(
                        field.id,
                        Math.round(field.width + delta / CHAR_PX),
                      )
                    }
                  />
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const selected = row.id === selectedId;
            const dropping = drag?.targetId === row.id ? drag.position : null;
            const background = selected
              ? "bg-[var(--sky-soft)]"
              : row.isSummary
                ? "bg-[var(--panel)]"
                : "bg-[var(--bg)]";
            return (
              <tr
                key={row.id}
                data-row-id={row.id}
                onFocusCapture={() => handlers.onSelect(row.id)}
                className={cn(
                  "border-b border-[var(--border)]",
                  background,
                  drag?.id === row.id && "opacity-40",
                  dropping === "before" && "border-t-2 border-t-[var(--sky)]",
                  dropping === "after" && "border-b-2 border-b-[var(--sky)]",
                )}
              >
                <td className={cn(pinned, "left-0 z-10 px-0", background)}>
                  <button
                    type="button"
                    aria-label={`Move ${row.name || row.code}`}
                    className="grid h-8 w-full cursor-grab touch-none place-items-center text-[var(--muted)] hover:text-[var(--ink)]"
                    onPointerDown={(event) => {
                      (event.target as HTMLElement).setPointerCapture(event.pointerId);
                      handlers.onSelect(row.id);
                      setDrag({ id: row.id, targetId: null, position: "after" });
                    }}
                    onPointerMove={(event) => {
                      if (!drag) return;
                      const at = dropAt(event.clientX, event.clientY);
                      if (!at || at.targetId === drag.id) return;
                      if (at.targetId === drag.targetId && at.position === drag.position) return;
                      setDrag({ ...drag, targetId: at.targetId, position: at.position });
                    }}
                    onPointerUp={(event) => {
                      (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
                      if (drag?.targetId) {
                        handlers.onReorder(drag.id, drag.targetId, drag.position);
                      }
                      setDrag(null);
                    }}
                    onPointerCancel={() => setDrag(null)}
                  >
                    ⠿
                  </button>
                </td>

                <th
                  scope="row"
                  className={cn(pinned, "z-10 border-r border-[var(--border)] px-2 text-left font-normal", background)}
                  style={{ left: GRIP_WIDTH }}
                >
                  <div className="flex items-center gap-1">
                    {row.isSummary ? (
                      <button
                        type="button"
                        onClick={() => handlers.onToggle(row.id)}
                        aria-expanded={!row.collapsed}
                        aria-label={`${row.collapsed ? "Expand" : "Collapse"} ${row.name || row.code}`}
                        className="grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] text-[var(--muted)] hover:bg-[var(--border)]"
                      >
                        {row.collapsed ? "▶" : "▼"}
                      </button>
                    ) : (
                      <span className="w-5 shrink-0" aria-hidden />
                    )}
                    <span className="truncate font-mono text-xs font-bold tabular-nums">
                      {row.code}
                    </span>
                  </div>
                </th>

                <td
                  className={cn(pinned, "z-10 border-r border-[var(--border)] px-1", background)}
                  style={{ left: nameLeft }}
                >
                  <Input
                    ref={(element) => {
                      if (element) inputs.current.set(row.id, element);
                      else inputs.current.delete(row.id);
                    }}
                    aria-label={`Title of task ${row.code}`}
                    className={cn(
                      "h-8 w-full min-w-0 border-transparent bg-transparent px-2 py-1 text-sm",
                      row.isSummary && "font-extrabold",
                    )}
                    style={{ paddingLeft: 8 + (row.level - 1) * 14 }}
                    value={row.name}
                    placeholder="Untitled task"
                    onChange={(event) => handlers.onName(row.id, event.target.value)}
                    onKeyDown={(event) => handlers.onKeyDown(row.id, event)}
                    onFocus={() => handlers.onSelect(row.id)}
                  />
                </td>

                {fields.map((field) => (
                  <td key={field.id} className="px-1 py-0.5 align-middle">
                    <CellInput row={row} field={field} doc={doc} onValue={handlers.onValue} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
