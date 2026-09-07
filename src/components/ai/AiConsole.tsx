"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { CopyButton } from "@/components/ui/CopyButton";
import { ErrorState, InfoNote } from "@/components/ui/Feedback";
import { AI_TOOL_MAP, executeAiTool, type AiToolResult } from "@/lib/ai/tool-runtime";
import { TOOL_MAP } from "@/lib/tools/tool-registry";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

interface Turn {
  id: string;
  question: string;
  status: "thinking" | "running" | "done" | "error";
  /** What the router said it was going to do. Never a claim about a result. */
  plan?: string;
  toolName?: string;
  result?: AiToolResult;
  error?: string;
  navigateTo?: string;
  source?: "rules" | "model";
}

const EXAMPLES = [
  "What is 15% of 480?",
  'Format this JSON: {"a":1,"b":[2,3]}',
  "Decode this base64: RE8xMDEgaXMgZnJlZQ==",
  "Count the words in: the quick brown fox jumps over the lazy dog",
  "Generate 5 uuids",
  "Compress an image under 200kb",
];

export function AiConsole() {
  const [input, setInput] = React.useState("");
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [busy, setBusy] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const ask = React.useCallback(async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setTurns((t) => [...t, { id, question: text, status: "thinking" }]);
    setInput("");
    setBusy(true);
    track("ai_request", { length: text.length });

    const update = (patch: Partial<Turn>) =>
      setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)));

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = (await response.json()) as {
        tool?: string | null;
        args?: Record<string, string | number>;
        message?: string;
        source?: "rules" | "model";
        error?: string;
      };

      if (!response.ok || data.error) {
        update({ status: "error", error: data.error ?? "The assistant is unavailable." });
        return;
      }

      if (!data.tool) {
        update({ status: "done", plan: data.message, source: data.source });
        return;
      }

      const definition = AI_TOOL_MAP[data.tool];
      if (!definition) {
        update({ status: "error", error: "That tool does not exist on DO101." });
        return;
      }

      const registryTool = TOOL_MAP[definition.toolId];

      if (definition.kind === "navigate") {
        update({
          status: "done",
          plan: data.message,
          toolName: registryTool?.name ?? definition.name,
          navigateTo: registryTool?.route ?? "/tools",
          source: data.source,
        });
        return;
      }

      update({
        status: "running",
        plan: data.message,
        toolName: registryTool?.name ?? definition.name,
        source: data.source,
      });

      // The tool runs here, in the browser, using the same code the tool page
      // uses. Whatever it returns is what gets displayed — nothing is narrated.
      const result = await executeAiTool(data.tool, data.args ?? {});
      update({
        status: result.error ? "error" : "done",
        result,
        error: result.error,
        navigateTo: registryTool?.route,
      });
    } catch {
      update({
        status: "error",
        error: "Could not reach the router. Every tool still works on its own page.",
      });
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return (
    <div className="space-y-4">
      {turns.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
            Try one of these
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => ask(example)}
                className="rounded-xl border-2 border-[var(--border)] px-3 py-2 text-left text-sm font-bold transition-colors hover:bg-[var(--panel)]"
              >
                {example}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="space-y-4">
        {turns.map((turn) => (
          <div key={turn.id} className="space-y-2">
            <div className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[var(--sky)] px-4 py-3 text-sm font-bold text-white">
                {turn.question}
              </p>
            </div>

            <Card className="do-rise p-4">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--grass-soft)] text-base"
                >
                  🤖
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  {turn.status === "thinking" ? (
                    <p className="text-sm font-extrabold text-[var(--muted)]">
                      Choosing a tool…
                    </p>
                  ) : null}

                  {turn.plan ? (
                    <p className="text-sm font-bold">{turn.plan}</p>
                  ) : null}

                  {turn.status === "running" ? (
                    <p className="text-sm font-extrabold text-[var(--muted)]">
                      Running {turn.toolName}…
                    </p>
                  ) : null}

                  {turn.error ? (
                    <ErrorState title="The tool could not run" message={turn.error} />
                  ) : null}

                  {turn.result && !turn.result.error ? (
                    <>
                      <div className="rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-4">
                        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
                          Output from {turn.toolName}
                        </p>
                        <pre
                          className={cn(
                            "do-scroll max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm",
                            turn.result.mono ? "font-mono" : "font-semibold",
                          )}
                        >
                          {turn.result.output}
                        </pre>
                      </div>

                      {turn.result.facts?.length ? (
                        <dl className="grid gap-1.5 sm:grid-cols-2">
                          {turn.result.facts.map((fact) => (
                            <div
                              key={fact.label}
                              className="flex gap-2 rounded-xl bg-[var(--panel)] px-3 py-2 text-xs"
                            >
                              <dt className="font-extrabold">{fact.label}:</dt>
                              <dd className="font-semibold text-[var(--muted)]">{fact.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <CopyButton value={turn.result.output} label="Copy output" />
                        {turn.navigateTo ? (
                          <Link href={turn.navigateTo} className="do-btn do-btn-ghost px-3.5 py-2 text-xs">
                            Open {turn.toolName}
                          </Link>
                        ) : null}
                      </div>
                    </>
                  ) : null}

                  {turn.navigateTo && !turn.result ? (
                    <Link
                      href={turn.navigateTo}
                      className="do-btn [--btn-bg:var(--grass)] [--btn-shadow:var(--grass-dark)] [--btn-fg:#fff] px-5 py-3 text-sm"
                    >
                      Open {turn.toolName}
                    </Link>
                  ) : null}

                  {turn.source ? (
                    <p className="text-[11px] font-bold text-[var(--muted)]">
                      {turn.source === "rules"
                        ? "Routed by DO101's built-in rules — no AI model was called."
                        : "Routed by the AI model; the tool itself ran in your browser."}
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <Card className="p-4">
        <label htmlFor="ai-input" className="sr-only">
          Ask DO101 AI
        </label>
        <Textarea
          id="ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              ask(input);
            }
          }}
          placeholder="Tell DO101 what you want to do — “format this JSON”, “what is 15% of 480”, “generate 5 uuids”…"
          className="min-h-[110px] border-0"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--muted)]">
            ⌘/Ctrl + Enter to send · your text is only sent to route the request
          </p>
          <div className="flex gap-2">
            {turns.length ? (
              <Button tone="ghost" onClick={() => setTurns([])}>
                Clear
              </Button>
            ) : null}
            <Button tone="grass" onClick={() => ask(input)} disabled={busy || !input.trim()}>
              {busy ? "Working…" : "Send"}
            </Button>
          </div>
        </div>
      </Card>

      <InfoNote icon="🧭">
        DO101 AI only picks which tool to run. The tool then runs in your browser and you see its
        real output — the assistant never writes a result itself, so it cannot tell you something
        the tool did not actually produce.
      </InfoNote>
    </div>
  );
}
