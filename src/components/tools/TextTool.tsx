"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Textarea, Input, Select, Toggle, Label } from "@/components/ui/Field";
import { ErrorState, Stat } from "@/components/ui/Feedback";
import {
  defaultOptions,
  type OptionValue,
  type TextToolConfig,
} from "@/lib/tools/text-tool-config";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";
import { cn } from "@/lib/utils/cn";

/**
 * One component behind every "paste text in, get text out" tool.
 *
 * Each tool supplies a config with its own options, transform and copy, so the
 * pages stay genuinely different while the interaction, accessibility and
 * error handling are identical everywhere.
 */
export function TextTool({ config }: { config: TextToolConfig }) {
  const [input, setInput] = React.useState("");
  const [options, setOptions] = React.useState<Record<string, OptionValue>>(() =>
    defaultOptions(config),
  );

  const result = React.useMemo(() => {
    if (!input) return { output: "", stats: [] };
    try {
      return config.transform(input, options);
    } catch (err) {
      return {
        output: "",
        error: err instanceof Error ? err.message : "That input could not be processed.",
      };
    }
  }, [input, options, config]);

  const completed = React.useRef(false);
  React.useEffect(() => {
    if (!completed.current && result.output) {
      completed.current = true;
      track("tool_complete", { tool: config.id });
      recordCompletion(5);
    }
  }, [result.output, config.id]);

  const visibleOptions = (config.options ?? []).filter(
    (option) => !option.showWhen || options[option.showWhen.id] === option.showWhen.equals,
  );

  const setOption = (id: string, value: OptionValue) =>
    setOptions((prev) => ({ ...prev, [id]: value }));

  const download = () => {
    const blob = new Blob([result.output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `do101-${config.id}.${result.extension ?? "txt"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const minHeight = config.minHeight ?? 220;

  return (
    <div className="space-y-4">
      {config.note ? (
        <p className="rounded-2xl bg-[var(--panel)] px-4 py-3 text-sm font-semibold">
          {config.note}
        </p>
      ) : null}

      {visibleOptions.length ? (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
            Options
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleOptions.map((option) => {
              if (option.type === "toggle") {
                return (
                  <Toggle
                    key={option.id}
                    checked={Boolean(options[option.id])}
                    onChange={(v) => setOption(option.id, v)}
                    label={option.label}
                    description={option.description}
                  />
                );
              }
              return (
                <div key={option.id}>
                  <Label htmlFor={`opt-${option.id}`}>{option.label}</Label>
                  {option.type === "select" ? (
                    <Select
                      id={`opt-${option.id}`}
                      value={String(options[option.id])}
                      onChange={(e) => setOption(option.id, e.target.value)}
                    >
                      {option.choices?.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      id={`opt-${option.id}`}
                      type={option.type === "number" ? "number" : "text"}
                      min={option.min}
                      max={option.max}
                      value={String(options[option.id])}
                      placeholder={option.placeholder}
                      onChange={(e) =>
                        setOption(
                          option.id,
                          option.type === "number" ? Number(e.target.value) : e.target.value,
                        )
                      }
                    />
                  )}
                  {option.description ? (
                    <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                      {option.description}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="tt-input"
              className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
            >
              {config.inputLabel}
            </label>
            {config.sample ? (
              <button
                type="button"
                onClick={() => setInput(config.sample!)}
                className="text-xs font-extrabold uppercase tracking-wide text-[var(--sky)] hover:underline"
              >
                Load sample
              </button>
            ) : null}
          </div>
          <Textarea
            id="tt-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={config.placeholder}
            className={cn(config.monoInput && "font-mono text-sm")}
            style={{ minHeight }}
          />
        </div>

        <div>
          <label
            htmlFor="tt-output"
            className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            {config.outputLabel}
          </label>
          <Textarea
            id="tt-output"
            value={result.output}
            readOnly
            placeholder="The result appears here as you type."
            className={cn("bg-[var(--panel)]", config.monoOutput && "font-mono text-sm")}
            style={{ minHeight }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <CopyButton
          value={result.output}
          label="Copy result"
          tone="grass"
          size="md"
          disabled={!result.output}
        />
        <Button tone="sky" onClick={download} disabled={!result.output}>
          Download
        </Button>
        <Button
          tone="panel"
          onClick={() => setInput(result.output)}
          disabled={!result.output || result.output === input}
        >
          Use as input
        </Button>
        <Button tone="ghost" onClick={() => setInput("")} disabled={!input}>
          Clear
        </Button>
      </div>

      {result.error ? <ErrorState message={result.error} /> : null}

      {result.stats?.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {result.stats.map((stat) => (
            <Stat key={stat.label} label={stat.label} value={stat.value} tone="sky" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
