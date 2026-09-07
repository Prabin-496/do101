"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Tabs } from "@/components/ui/Tabs";
import { ErrorState, Stat } from "@/components/ui/Feedback";
import { describeTimestamp, dateToTimestamp, type TimestampUnit } from "@/lib/dev/timestamp";
import { track } from "@/lib/analytics";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-2.5 last:border-0">
      <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <span className="flex items-center gap-2">
        <code className="font-mono text-sm font-bold">{value}</code>
        <CopyButton value={value} label="Copy" copiedLabel="✓" size="sm" />
      </span>
    </div>
  );
}

export function TimestampConverter() {
  const [mode, setMode] = React.useState<"toDate" | "toTimestamp">("toDate");
  const [raw, setRaw] = React.useState("");
  const [unit, setUnit] = React.useState<TimestampUnit | "auto">("auto");
  const [dateValue, setDateValue] = React.useState("");
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const info = React.useMemo(() => {
    if (mode === "toDate") {
      const n = Number(raw.trim());
      if (!raw.trim() || Number.isNaN(n)) return null;
      return describeTimestamp(n, unit === "auto" ? undefined : unit);
    }
    return dateToTimestamp(dateValue);
  }, [mode, raw, unit, dateValue]);

  const invalid =
    (mode === "toDate" && raw.trim() !== "" && info === null) ||
    (mode === "toTimestamp" && dateValue !== "" && info === null);

  React.useEffect(() => {
    if (info) track("tool_complete", { tool: "timestamp-converter" });
  }, [info]);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
            Current Unix time
          </p>
          <p className="font-mono text-2xl font-extrabold tabular-nums">
            {Math.floor(now / 1000)}
          </p>
        </div>
        <div className="flex gap-2">
          <CopyButton value={String(Math.floor(now / 1000))} label="Copy seconds" />
          <CopyButton value={String(now)} label="Copy ms" />
        </div>
      </Card>

      <Tabs
        ariaLabel="Conversion direction"
        value={mode}
        onChange={(v) => setMode(v as "toDate" | "toTimestamp")}
        items={[
          { id: "toDate", label: "Timestamp → Date" },
          { id: "toTimestamp", label: "Date → Timestamp" },
        ]}
      />

      <Card className="p-5">
        {mode === "toDate" ? (
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div>
              <Label htmlFor="ts-in">Unix timestamp</Label>
              <Input
                id="ts-in"
                inputMode="numeric"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="1735689600"
                className="font-mono"
              />
            </div>
            <div>
              <Label htmlFor="ts-unit">Unit</Label>
              <Select
                id="ts-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as TimestampUnit | "auto")}
              >
                <option value="auto">Detect automatically</option>
                <option value="seconds">Seconds</option>
                <option value="milliseconds">Milliseconds</option>
              </Select>
            </div>
          </div>
        ) : (
          <div>
            <Label htmlFor="date-in">Date and time</Label>
            <Input
              id="date-in"
              type="datetime-local"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            tone="sky"
            onClick={() => {
              if (mode === "toDate") setRaw(String(Math.floor(Date.now() / 1000)));
              else {
                const d = new Date();
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                setDateValue(d.toISOString().slice(0, 16));
              }
            }}
          >
            Use now
          </Button>
          <Button
            tone="ghost"
            onClick={() => {
              setRaw("");
              setDateValue("");
            }}
            disabled={!raw && !dateValue}
          >
            Clear
          </Button>
        </div>
      </Card>

      {invalid ? (
        <ErrorState message="That is not a date this converter can read. Try a plain number of seconds or milliseconds." />
      ) : null}

      {info ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Seconds" value={info.seconds} tone="grass" />
            <Stat label="Milliseconds" value={info.milliseconds} tone="sky" />
          </div>
          <Card className="p-5">
            <p className="mb-2 text-sm font-extrabold text-[var(--grass)]">{info.relative}</p>
            <Row label="Local time" value={info.local} />
            <Row label="UTC" value={info.utc} />
            <Row label="ISO 8601" value={info.iso} />
            <Row label="Day of week" value={info.dayOfWeek} />
            {mode === "toDate" ? (
              <p className="pt-3 text-xs font-semibold text-[var(--muted)]">
                Interpreted as <strong>{info.unit}</strong>
                {unit === "auto" ? " (detected from the number's size)" : ""}.
              </p>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}
