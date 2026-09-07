"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Input, Textarea, Select, Toggle, Label } from "@/components/ui/Field";
import { ErrorState } from "@/components/ui/Feedback";
import {
  defaultFieldValues,
  type FieldValue,
  type FormToolConfig,
} from "@/lib/tools/form-tool-config";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";
import { cn } from "@/lib/utils/cn";

/**
 * One component behind every "fill in a form, get generated code" tool —
 * meta tags, structured data, robots files, passwords, colour palettes.
 * Each tool supplies its own fields, generator and preview.
 */
export function FormTool({ config }: { config: FormToolConfig }) {
  const [values, setValues] = React.useState<Record<string, FieldValue>>(() =>
    defaultFieldValues(config),
  );

  const result = React.useMemo(() => {
    try {
      return config.generate(values);
    } catch (err) {
      return {
        output: "",
        error: err instanceof Error ? err.message : "That input could not be used.",
      };
    }
  }, [values, config]);

  const completed = React.useRef(false);
  React.useEffect(() => {
    if (!completed.current && result.output) {
      completed.current = true;
      track("tool_complete", { tool: config.id });
      recordCompletion(5);
    }
  }, [result.output, config.id]);

  const set = (id: string, value: FieldValue) =>
    setValues((prev) => ({ ...prev, [id]: value }));

  const visible = config.fields.filter(
    (field) => !field.showWhen || values[field.showWhen.id] === field.showWhen.equals,
  );

  const download = () => {
    const blob = new Blob([result.output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `do101-${config.id}.${result.extension ?? "txt"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="space-y-4">
      {config.note ? (
        <p className="rounded-2xl bg-[var(--panel)] px-4 py-3 text-sm font-semibold">
          {config.note}
        </p>
      ) : null}

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((field) => {
            const value = values[field.id];
            const length = typeof value === "string" ? value.length : 0;
            const overLimit = field.limit ? length > field.limit : false;

            if (field.type === "toggle") {
              return (
                <div key={field.id} className={cn(field.wide && "sm:col-span-2")}>
                  <Toggle
                    checked={Boolean(value)}
                    onChange={(v) => set(field.id, v)}
                    label={field.label}
                    description={field.description}
                  />
                </div>
              );
            }

            return (
              <div key={field.id} className={cn((field.wide || field.type === "textarea") && "sm:col-span-2")}>
                <Label
                  htmlFor={`f-${field.id}`}
                  hint={field.limit ? `${length}/${field.limit}` : undefined}
                >
                  {field.label}
                </Label>

                {field.type === "textarea" ? (
                  <Textarea
                    id={`f-${field.id}`}
                    value={String(value)}
                    placeholder={field.placeholder}
                    onChange={(e) => set(field.id, e.target.value)}
                    className="min-h-[110px]"
                  />
                ) : field.type === "select" ? (
                  <Select
                    id={`f-${field.id}`}
                    value={String(value)}
                    onChange={(e) => set(field.id, e.target.value)}
                  >
                    {field.choices?.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </Select>
                ) : field.type === "color" ? (
                  <div className="flex items-center gap-2">
                    <input
                      id={`f-${field.id}`}
                      type="color"
                      value={String(value)}
                      onChange={(e) => set(field.id, e.target.value)}
                      className="h-12 w-16 cursor-pointer rounded-xl border-2 border-[var(--border)] bg-transparent"
                    />
                    <Input
                      aria-label={`${field.label} hex value`}
                      value={String(value)}
                      onChange={(e) => set(field.id, e.target.value)}
                      className="font-mono"
                    />
                  </div>
                ) : (
                  <Input
                    id={`f-${field.id}`}
                    type={
                      field.type === "number"
                        ? "number"
                        : field.type === "date"
                          ? "date"
                          : field.type === "time"
                            ? "time"
                            : "text"
                    }
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={String(value)}
                    placeholder={field.placeholder}
                    onChange={(e) =>
                      set(field.id, field.type === "number" ? Number(e.target.value) : e.target.value)
                    }
                    className={cn(overLimit && "border-[var(--cherry)]")}
                  />
                )}

                {field.description ? (
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                    {field.description}
                  </p>
                ) : null}
                {overLimit ? (
                  <p className="mt-1 text-xs font-extrabold text-[var(--cherry)]">
                    {length - field.limit!} characters over the recommended limit.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <Button tone="ghost" onClick={() => setValues(defaultFieldValues(config))}>
            Reset fields
          </Button>
        </div>
      </Card>

      {result.error ? <ErrorState message={result.error} /> : null}

      {result.preview ? <div>{result.preview}</div> : null}

      {result.output ? (
        <>
          <div>
            <label
              htmlFor="form-output"
              className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
            >
              {config.outputLabel}
            </label>
            <Textarea
              id="form-output"
              value={result.output}
              readOnly
              className="min-h-[200px] bg-[var(--panel)] font-mono text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton value={result.output} label="Copy" tone="grass" size="md" />
            <Button tone="sky" onClick={download}>
              Download
            </Button>
          </div>
        </>
      ) : null}

      {result.facts?.length ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {result.facts.map((fact) => (
            <div
              key={fact.label}
              className="flex gap-2 rounded-xl bg-[var(--panel)] px-3 py-2 text-sm"
            >
              <dt className="font-extrabold">{fact.label}:</dt>
              <dd className="font-semibold text-[var(--muted)]">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
