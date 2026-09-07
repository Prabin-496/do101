"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Tabs } from "@/components/ui/Tabs";
import { ErrorState } from "@/components/ui/Feedback";
import { encodeUrl, decodeUrl, parseQueryString } from "@/lib/dev/encoding";
import { track } from "@/lib/analytics";

export function UrlTool({ initialMode = "encode" }: { initialMode?: "encode" | "decode" }) {
  const [mode, setMode] = React.useState<"encode" | "decode">(initialMode);
  const [encodeMode, setEncodeMode] = React.useState<"component" | "uri">("component");
  const [input, setInput] = React.useState("");

  const { output, error } = React.useMemo(() => {
    if (!input.trim()) return { output: "", error: null as string | null };
    try {
      return {
        output: mode === "encode" ? encodeUrl(input, encodeMode) : decodeUrl(input),
        error: null,
      };
    } catch {
      return {
        output: "",
        error:
          "This string could not be decoded. A % must be followed by two hex digits — look for a stray % in the text.",
      };
    }
  }, [input, mode, encodeMode]);

  const parsed = React.useMemo(
    () => (mode === "decode" && output ? parseQueryString(output) : null),
    [mode, output],
  );

  return (
    <div className="space-y-4">
      <Tabs
        ariaLabel="URL mode"
        value={mode}
        onChange={(v) => setMode(v as "encode" | "decode")}
        items={[
          { id: "encode", label: "Encode →" },
          { id: "decode", label: "← Decode" },
        ]}
      />

      {mode === "encode" ? (
        <Tabs
          ariaLabel="Encoding style"
          value={encodeMode}
          onChange={(v) => setEncodeMode(v as "component" | "uri")}
          items={[
            { id: "component", label: "Component (a single value)" },
            { id: "uri", label: "Full URI (keeps / ? & =)" },
          ]}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label
            htmlFor="url-in"
            className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            {mode === "encode" ? "Plain text or URL" : "Encoded URL"}
          </label>
          <Textarea
            id="url-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "encode"
                ? "https://example.com/search?q=hello world"
                : "https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dhello%20world"
            }
            className="min-h-[180px] font-mono text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="url-out"
            className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            Result
          </label>
          <Textarea
            id="url-out"
            value={output}
            readOnly
            placeholder="The result appears here."
            className="min-h-[180px] bg-[var(--panel)] font-mono text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <CopyButton
          value={output}
          label="Copy result"
          tone="grass"
          size="md"
          disabled={!output}
          onCopied={() => track("tool_complete", { tool: `url-${mode}` })}
        />
        <Button
          tone="sky"
          onClick={() => {
            setInput(output);
            setMode(mode === "encode" ? "decode" : "encode");
          }}
          disabled={!output}
        >
          Send result back
        </Button>
        <Button tone="ghost" onClick={() => setInput("")} disabled={!input}>
          Clear
        </Button>
      </div>

      {error ? <ErrorState message={error} /> : null}

      {parsed && parsed.params.length ? (
        <Card className="overflow-hidden">
          <h3 className="border-b-2 border-[var(--border)] px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
            Query parameters
          </h3>
          <div className="do-scroll overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--border)] bg-[var(--panel)]">
                  <th scope="col" className="px-5 py-2 font-extrabold">
                    Key
                  </th>
                  <th scope="col" className="px-5 py-2 font-extrabold">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {parsed.params.map((param, i) => (
                  <tr key={`${param.key}-${i}`} className="border-b border-[var(--border)]">
                    <td className="px-5 py-2 font-mono font-bold">{param.key}</td>
                    <td className="break-all px-5 py-2 font-mono text-[var(--muted)]">
                      {param.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
