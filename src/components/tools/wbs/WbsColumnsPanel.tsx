"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Field";
import { InfoNote } from "@/components/ui/Feedback";
import { FIELD_TYPES, ROLLUPS, newField } from "@/lib/wbs/fields";
import type { FieldType, WbsField } from "@/lib/wbs/model";

/**
 * Column editor.
 *
 * Columns are the customisable part of the tool: the built-in ones can be
 * renamed, retyped, reordered and hidden, and new ones behave identically —
 * including in the roll-ups and in the exported workbook.
 */
export function WbsColumnsPanel({
  fields,
  onChange,
}: {
  fields: WbsField[];
  onChange: (fields: WbsField[]) => void;
}) {
  const [label, setLabel] = React.useState("");
  const [type, setType] = React.useState<FieldType>("text");

  function patch(id: string, changes: Partial<WbsField>) {
    onChange(fields.map((field) => (field.id === id ? { ...field, ...changes } : field)));
  }

  function move(id: string, delta: -1 | 1) {
    const index = fields.findIndex((field) => field.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add() {
    const name = label.trim();
    if (!name) return;
    onChange([...fields, newField(name, type, fields.map((field) => field.id))]);
    setLabel("");
    setType("text");
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 text-base">Add a column</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <Label htmlFor="wbs-new-column">Column name</Label>
            <Input
              id="wbs-new-column"
              value={label}
              placeholder="Contractor, Phase, Unit cost…"
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add();
                }
              }}
            />
          </div>
          <div className="min-w-[9rem]">
            <Label htmlFor="wbs-new-type">Type</Label>
            <Select
              id="wbs-new-type"
              value={type}
              onChange={(event) => setType(event.target.value as FieldType)}
            >
              {FIELD_TYPES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={add} disabled={!label.trim()}>
            Add column
          </Button>
        </div>
        <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
          {FIELD_TYPES.find((entry) => entry.id === type)?.hint}
        </p>
      </Card>

      <InfoNote>
        Hidden columns keep their data — they are left out of the grid and the export, and come
        back untouched when you show them again.
      </InfoNote>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <Card key={field.id} className="p-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[10rem] flex-1">
                <Label htmlFor={`wbs-label-${field.id}`}>Name</Label>
                <Input
                  id={`wbs-label-${field.id}`}
                  value={field.label}
                  onChange={(event) => patch(field.id, { label: event.target.value })}
                />
              </div>
              <div className="min-w-[8rem]">
                <Label htmlFor={`wbs-type-${field.id}`}>Type</Label>
                <Select
                  id={`wbs-type-${field.id}`}
                  value={field.type}
                  onChange={(event) => {
                    const next = event.target.value as FieldType;
                    patch(field.id, {
                      type: next,
                      options: next === "select" ? (field.options ?? ["Option A"]) : field.options,
                      rollup:
                        next === "text" || next === "select"
                          ? "none"
                          : field.rollup === "none"
                            ? "sum"
                            : field.rollup,
                    });
                  }}
                >
                  {FIELD_TYPES.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="min-w-[10rem]">
                <Label htmlFor={`wbs-rollup-${field.id}`} hint="on summary rows">
                  Roll-up
                </Label>
                <Select
                  id={`wbs-rollup-${field.id}`}
                  value={field.rollup}
                  onChange={(event) =>
                    patch(field.id, { rollup: event.target.value as WbsField["rollup"] })
                  }
                >
                  {ROLLUPS.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-24">
                <Label htmlFor={`wbs-width-${field.id}`} hint="chars">
                  Width
                </Label>
                <Input
                  id={`wbs-width-${field.id}`}
                  type="number"
                  min={4}
                  max={80}
                  value={field.width}
                  onChange={(event) =>
                    patch(field.id, { width: Math.max(4, Number(event.target.value) || 12) })
                  }
                />
              </div>
            </div>

            {field.type === "select" ? (
              <div className="mt-3">
                <Label htmlFor={`wbs-options-${field.id}`} hint="one per line">
                  Choices
                </Label>
                <Input
                  id={`wbs-options-${field.id}`}
                  value={(field.options ?? []).join(", ")}
                  placeholder="Not started, In progress, Done"
                  onChange={(event) =>
                    patch(field.id, {
                      options: event.target.value
                        .split(",")
                        .map((option) => option.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                tone={field.visible ? "panel" : "grass"}
                onClick={() => patch(field.id, { visible: !field.visible })}
              >
                {field.visible ? "Hide" : "Show"}
              </Button>
              <Button
                size="sm"
                tone="panel"
                onClick={() => move(field.id, -1)}
                disabled={index === 0}
                aria-label={`Move ${field.label} left`}
              >
                ← Earlier
              </Button>
              <Button
                size="sm"
                tone="panel"
                onClick={() => move(field.id, 1)}
                disabled={index === fields.length - 1}
                aria-label={`Move ${field.label} right`}
              >
                Later →
              </Button>
              {field.builtin ? (
                <span className="text-xs font-bold text-[var(--muted)]">Built-in column</span>
              ) : (
                <Button
                  size="sm"
                  tone="cherry"
                  onClick={() => onChange(fields.filter((entry) => entry.id !== field.id))}
                >
                  Delete
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
