"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Input, Textarea, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ErrorState, EmptyState, SuccessNote } from "@/components/ui/Feedback";
import { runRegex, REGEX_CHEATSHEET, MAX_MATCHES } from "@/lib/dev/regex";
import { cn } from "@/lib/utils/cn";
import { track } from "@/lib/analytics";

const FLAGS = [
  { id: "g", label: "g", title: "Global — find every match" },
  { id: "i", label: "i", title: "Case insensitive" },
  { id: "m", label: "m", title: "Multiline — ^ and $ match each line" },
  { id: "s", label: "s", title: "Dot matches newlines" },
  { id: "u", label: "u", title: "Unicode" },
  { id: "y", label: "y", title: "Sticky — match from lastIndex only" },
];

export function RegexTester() {
  const [pattern, setPattern] = React.useState("\\b\\w+@\\w+\\.\\w{2,}\\b");
  const [flags, setFlags] = React.useState("g");
  const [text, setText] = React.useState(
    "Email hello@do101.online or support@example.com for help. Not an email: hello@localhost",
  );

  const result = React.useMemo(() => runRegex(pattern, flags, text), [pattern, flags, text]);

  React.useEffect(() => {
    if (result.ok && result.matches.length) track("tool_complete", { tool: "regex-tester" });
  }, [result]);

  const highlighted = React.useMemo(() => {
    if (!result.ok || !result.matches.length) return null;
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    result.matches.forEach((m, i) => {
      if (m.index > cursor) nodes.push(<span key={`t${i}`}>{text.slice(cursor, m.index)}</span>);
      nodes.push(
        <mark
          key={`m${i}`}
          className="rounded bg-[var(--sun)] px-0.5 font-bold text-[#22303c]"
        >
          {m.match || "∅"}
        </mark>,
      );
      cursor = m.index + (m.match.length || 0);
    });
    if (cursor < text.length) nodes.push(<span key="tail">{text.slice(cursor)}</span>);
    return nodes;
  }, [result, text]);

  const toggleFlag = (flag: string) =>
    setFlags((f) => (f.includes(flag) ? f.replace(flag, "") : f + flag));

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <Label htmlFor="regex-pattern">Pattern</Label>
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-[var(--muted)]">/</span>
          <Input
            id="regex-pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="\\d{3}-\\d{4}"
            className="font-mono"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <span className="text-lg font-extrabold text-[var(--muted)]">/{flags}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FLAGS.map((flag) => (
            <button
              key={flag.id}
              type="button"
              title={flag.title}
              aria-pressed={flags.includes(flag.id)}
              onClick={() => toggleFlag(flag.id)}
              className={cn(
                "h-10 w-10 rounded-xl border-2 font-mono text-sm font-extrabold transition-colors",
                flags.includes(flag.id)
                  ? "border-[var(--grass)] bg-[var(--grass-soft)] text-[var(--grass-dark)] dark:text-[var(--grass)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--panel)]",
              )}
            >
              {flag.label}
            </button>
          ))}
        </div>
      </Card>

      <div>
        <Label htmlFor="regex-text">Test string</Label>
        <Textarea
          id="regex-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the text you want to search…"
          className="min-h-[160px] font-mono text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          tone="ghost"
          onClick={() => {
            setPattern("");
            setText("");
          }}
        >
          Clear
        </Button>
      </div>

      {!result.ok ? <ErrorState title="Invalid pattern" message={result.error} /> : null}

      {result.ok && pattern ? (
        result.matches.length ? (
          <>
            <SuccessNote>
              {result.matches.length} match{result.matches.length === 1 ? "" : "es"}
              {result.truncated ? ` (showing the first ${MAX_MATCHES})` : ""}
            </SuccessNote>

            <Card className="p-5">
              <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Highlighted
              </h3>
              <p className="do-scroll max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">
                {highlighted}
              </p>
            </Card>

            <Card className="overflow-hidden">
              <h3 className="border-b-2 border-[var(--border)] px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Matches
              </h3>
              <div className="do-scroll max-h-80 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[var(--panel)]">
                    <tr className="border-b-2 border-[var(--border)]">
                      <th scope="col" className="px-4 py-2 font-extrabold">#</th>
                      <th scope="col" className="px-4 py-2 font-extrabold">Match</th>
                      <th scope="col" className="px-4 py-2 font-extrabold">Index</th>
                      <th scope="col" className="px-4 py-2 font-extrabold">Groups</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.matches.map((m, i) => (
                      <tr key={i} className="border-b border-[var(--border)]">
                        <td className="px-4 py-2 font-bold text-[var(--muted)]">{i + 1}</td>
                        <td className="break-all px-4 py-2 font-mono font-bold">{m.match}</td>
                        <td className="px-4 py-2 font-mono text-[var(--muted)]">{m.index}</td>
                        <td className="px-4 py-2 font-mono text-xs text-[var(--muted)]">
                          {m.groups.length
                            ? m.groups
                                .map((g) => `${g.name}: ${g.value ?? "—"}`)
                                .join(" · ")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : (
          <EmptyState
            icon="🕵️"
            title="No matches yet"
            description="The pattern is valid but nothing in the test string matched it."
          />
        )
      ) : null}

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
          Cheat sheet
        </h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          {REGEX_CHEATSHEET.map((item) => (
            <div key={item.token} className="flex gap-3 rounded-xl bg-[var(--panel)] px-3 py-2">
              <dt className="w-24 shrink-0 font-mono text-sm font-extrabold">{item.token}</dt>
              <dd className="text-xs font-semibold text-[var(--muted)]">{item.meaning}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
