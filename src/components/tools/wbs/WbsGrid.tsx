"use client";

import * as React from "react";
import { Input, Select } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";
import { formatValue, isNumericField } from "@/lib/wbs/fields";
import type { FieldValue, WbsDoc, WbsField, WbsRow } from "@/lib/wbs/model";

/**
 * The editable outline.
 *
 * It is a spreadsheet on purpose: the columns on screen are the columns in the
 * download, in the same order. Summary rows show their rolled-up value as read
 * only text, because a total that could be typed over would quietly stop
 * matching the work packages underneath it.
 */

export interface GridHandlers {
  onSelect: (id: string) => void;
  onName: (id: string, name: string) => void;
  onValue: (id: string, fieldId: string, value: FieldValue) => void;
  onToggle: (id: string) => void;
  onKeyDown: (id: string, event: React.KeyboardEvent) => void;
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
  const derived = row.isSummary && field.rollup !== "none";
  const value = row.values[field.id] ?? null;

  if (derived) {
    return (
      <span
        className="block truncate px-2 py-1 text-right text-xs font-extrabold text-[var(--muted)]"
        title={`Rolled up from ${row.name || "this branch"}`}
      >
        {formatValue(value, field, doc.settings) || "—"}
      </span>
    );
  }

  const own = row.own[field.id] ?? null;

  if (field.type === "select") {
    return (
      <Select
        aria-label={`${field.label} for ${row.name || row.code}`}
        className="h-9 min-w-[7rem] px-2 py-1 text-xs"
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
      className={cn(
        "h-9 min-w-[6rem] px-2 py-1 text-xs",
        isNumericField(field) && "text-right",
      )}
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
}: {
  doc: WbsDoc;
  rows: WbsRow[];
  fields: WbsField[];
  selectedId: string | null;
  focusId: string | null;
  handlers: GridHandlers;
}) {
  const inputs = React.useRef(new Map<string, HTMLInputElement>());

  React.useEffect(() => {
    if (!focusId) return;
    const input = inputs.current.get(focusId);
    input?.focus();
    input?.select();
  }, [focusId]);

  return (
    <div className="do-scroll overflow-x-auto rounded-2xl border-2 border-[var(--border)]">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 min-w-[16rem] border-b-2 border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-left text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Task
            </th>
            {fields.map((field) => (
              <th
                key={field.id}
                className="border-b-2 border-[var(--border)] bg-[var(--panel)] px-2 py-2 text-left text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
              >
                {field.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = row.id === selectedId;
            const background = selected
              ? "bg-[var(--sky-soft)]"
              : row.isSummary
                ? "bg-[var(--panel)]"
                : "bg-[var(--bg)]";
            return (
              <tr
                key={row.id}
                onFocusCapture={() => handlers.onSelect(row.id)}
                className={cn("border-b border-[var(--border)]", background)}
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 px-2 py-1 text-left font-normal",
                    background,
                  )}
                >
                  <div
                    className="flex items-center gap-1"
                    style={{ paddingLeft: `${(row.level - 1) * 16}px` }}
                  >
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
                    <span className="shrink-0 font-mono text-[11px] font-bold text-[var(--muted)]">
                      {row.code}
                    </span>
                    <Input
                      ref={(element) => {
                        if (element) inputs.current.set(row.id, element);
                        else inputs.current.delete(row.id);
                      }}
                      aria-label={`Name of task ${row.code}`}
                      className={cn(
                        "h-9 min-w-[10rem] flex-1 border-transparent bg-transparent px-2 py-1 text-sm",
                        row.isSummary && "font-extrabold",
                      )}
                      value={row.name}
                      placeholder="Untitled task"
                      onChange={(event) => handlers.onName(row.id, event.target.value)}
                      onKeyDown={(event) => handlers.onKeyDown(row.id, event)}
                      onFocus={() => handlers.onSelect(row.id)}
                    />
                  </div>
                </th>
                {fields.map((field) => (
                  <td key={field.id} className="px-1 py-1 align-middle">
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
