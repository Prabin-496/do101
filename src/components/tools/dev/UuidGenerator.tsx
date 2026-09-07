"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { generateUuids, MAX_UUIDS, type UuidFormat } from "@/lib/dev/uuid";
import { track } from "@/lib/analytics";

export function UuidGenerator() {
  const [count, setCount] = React.useState(5);
  const [format, setFormat] = React.useState<UuidFormat>("standard");
  const [uuids, setUuids] = React.useState<string[]>([]);

  const generate = React.useCallback(() => {
    setUuids(generateUuids(count, format));
    track("tool_complete", { tool: "uuid-generator", count });
  }, [count, format]);

  // UUIDs are random, so they can only be produced in the browser: the server
  // and the first client render must agree, and they agree on "none yet".
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only randomness
  React.useEffect(() => setUuids(generateUuids(5, "standard")), []);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="uuid-count" hint={`max ${MAX_UUIDS}`}>
              How many
            </Label>
            <Input
              id="uuid-count"
              type="number"
              min={1}
              max={MAX_UUIDS}
              value={count}
              onChange={(e) =>
                setCount(Math.max(1, Math.min(MAX_UUIDS, Number(e.target.value) || 1)))
              }
            />
          </div>
          <div>
            <Label htmlFor="uuid-format">Format</Label>
            <Select
              id="uuid-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as UuidFormat)}
            >
              <option value="standard">Standard (lowercase)</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="no-dashes">No dashes</option>
              <option value="braces">{"{Braces}"}</option>
            </Select>
          </div>
          <Button onClick={generate} tone="grass" size="lg" className="w-full sm:w-auto">
            Generate
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <CopyButton
          value={() => uuids.join("\n")}
          label={`Copy all (${uuids.length})`}
          tone="sky"
          size="md"
          disabled={!uuids.length}
        />
        <Button
          tone="panel"
          onClick={() => {
            const blob = new Blob([uuids.join("\n")], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "uuids.txt";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
          }}
          disabled={!uuids.length}
        >
          Download .txt
        </Button>
      </div>

      <Card className="do-scroll max-h-[420px] overflow-y-auto p-2">
        <ul>
          {uuids.map((uuid, i) => (
            <li
              key={`${uuid}-${i}`}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-[var(--panel)]"
            >
              <code className="truncate font-mono text-sm font-bold">{uuid}</code>
              <CopyButton value={uuid} label="Copy" copiedLabel="✓" size="sm" />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
