"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Stat, EmptyState, InfoNote } from "@/components/ui/Feedback";
import { Tabs } from "@/components/ui/Tabs";
import {
  MODE_LABELS, rewrite, splitSuggestions, synonymOptions, type RewriteMode,
} from "@/lib/writing/rewrite";
import { findPassiveVoice } from "@/lib/writing/rules";
import { track } from "@/lib/analytics";

const MODES: RewriteMode[] = ["concise", "formal", "simple", "active"];

export function Paraphraser() {
  const [text, setText] = React.useState("");
  const [mode, setMode] = React.useState<RewriteMode>("concise");
  const [rejected, setRejected] = React.useState<string[]>([]);
  const reported = React.useRef(false);

  const deferred = React.useDeferredValue(text);

  const result = React.useMemo(() => rewrite(deferred, mode), [deferred, mode]);

  // Rejected edits are re-applied in reverse so the original wording comes back
  // without disturbing the offsets of the edits that were kept.
  const output = React.useMemo(() => {
    if (rejected.length === 0) return result.text;
    let working = deferred;
    const keep = result.changes.filter((c) => !rejected.includes(`${c.start}-${c.end}`));
    for (const change of [...keep].sort((a, b) => b.start - a.start)) {
      working =
        working.slice(0, change.start) +
        (change.to === "" ? "" : change.to) +
        working.slice(change.end);
    }
    return working.replace(/ {2,}/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
  }, [deferred, result, rejected]);

  const passive = React.useMemo(
    () => (mode === "active" ? findPassiveVoice(deferred) : []),
    [deferred, mode],
  );
  const splits = React.useMemo(
    () => (mode === "simple" ? splitSuggestions(deferred) : []),
    [deferred, mode],
  );
  const synonyms = React.useMemo(
    () => (mode === "formal" || mode === "concise" ? synonymOptions(deferred).slice(0, 12) : []),
    [deferred, mode],
  );

  React.useEffect(() => {
    if (!reported.current && result.changes.length > 0) {
      reported.current = true;
      track("tool_complete", { tool: "paraphrasing-tool" });
    }
  }, [result.changes.length]);

  const saved = result.wordsBefore - result.wordsAfter;

  return (
    <div className="space-y-4">
      <Tabs
        ariaLabel="Rewriting mode"
        value={mode}
        onChange={(id) => {
          setMode(id as RewriteMode);
          setRejected([]);
        }}
        items={MODES.map((m) => ({ id: m, label: MODE_LABELS[m].name }))}
      />
      <p className="px-1 text-sm font-semibold text-[var(--muted)]">{MODE_LABELS[mode].blurb}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <label htmlFor="pp-in" className="sr-only">Your text</label>
          <Textarea
            id="pp-in"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setRejected([]);
            }}
            placeholder="Paste a paragraph you want to tighten up."
            className="min-h-[260px] rounded-2xl border-0 focus:border-0"
          />
        </Card>

        <Card className="flex min-h-[260px] flex-col">
          {mode === "active" ? (
            <p className="p-1 text-sm font-semibold text-[var(--muted)]">
              Active voice needs to know who performed the action, which only you know.
              This mode lists every passive construction so you can decide.
            </p>
          ) : output ? (
            <p className="do-scroll flex-1 overflow-auto whitespace-pre-wrap p-1 text-[0.95rem] font-semibold leading-relaxed">
              {output}
            </p>
          ) : (
            <p className="p-1 text-sm font-semibold text-[var(--muted)]">
              The rewritten version appears here.
            </p>
          )}
        </Card>
      </div>

      {mode !== "active" ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Words before" value={String(result.wordsBefore)} tone="sky" />
            <Stat label="Words after" value={String(result.wordsAfter)} tone="grass" />
            <Stat
              label="Saved"
              value={saved > 0 ? `−${saved}` : "0"}
              tone={saved > 0 ? "grass" : "ink"}
              hint={result.wordsBefore ? `${Math.round((saved / result.wordsBefore) * 100)}% shorter` : undefined}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton value={output} label="Copy rewritten text" disabled={!output} />
            <Button tone="ghost" onClick={() => setText(output)} disabled={!output || output === deferred}>
              Replace my text with it
            </Button>
            <Button tone="ghost" onClick={() => { setText(""); setRejected([]); }} disabled={!text}>
              Clear
            </Button>
          </div>
        </>
      ) : null}

      {result.changes.length > 0 ? (
        <Card className="p-5">
          <p className="text-sm font-extrabold">
            {result.changes.length} edit{result.changes.length === 1 ? "" : "s"} — untick any you disagree with
          </p>
          <ul className="mt-3 space-y-2">
            {result.changes.map((change) => {
              const key = `${change.start}-${change.end}`;
              const off = rejected.includes(key);
              return (
                <li key={key}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-[var(--border)] p-3">
                    <input
                      type="checkbox"
                      checked={!off}
                      onChange={() =>
                        setRejected((current) =>
                          current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
                        )
                      }
                      className="mt-1 size-4 accent-[var(--grass)]"
                    />
                    <span className="min-w-0 flex-1 text-sm font-semibold">
                      <span className="line-through decoration-[var(--cherry)] decoration-2">
                        {change.from}
                      </span>
                      <span aria-hidden className="mx-2 text-[var(--muted)]">→</span>
                      <span className="font-extrabold text-[var(--grass-dark)] dark:text-[var(--grass)]">
                        {change.to === "" ? "(removed)" : change.to}
                      </span>
                      <span className="mt-0.5 block text-xs font-bold text-[var(--muted)]">
                        {change.reason}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {passive.length > 0 ? (
        <Card className="p-5">
          <p className="text-sm font-extrabold">{passive.length} passive construction{passive.length === 1 ? "" : "s"}</p>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
            Ask &ldquo;who did this?&rdquo; and put that answer at the front of the sentence.
            Passive voice is fine in a methods section, where the method matters more than the person.
          </p>
          <ul className="mt-3 space-y-2">
            {passive.slice(0, 25).map((issue) => (
              <li key={issue.id} className="rounded-2xl border-2 border-[var(--border)] p-3 text-sm font-semibold">
                <span className="rounded-full bg-[var(--sky-soft)] px-2 py-0.5 font-mono text-xs font-extrabold">
                  {issue.matched}
                </span>
                <span className="ml-2 text-[var(--muted)]">
                  {deferred.slice(Math.max(0, issue.start - 40), issue.start)}
                  <strong className="text-[var(--ink)]">{issue.matched}</strong>
                  {deferred.slice(issue.end, issue.end + 60)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {splits.length > 0 ? (
        <Card className="p-5">
          <p className="text-sm font-extrabold">Sentences worth splitting</p>
          <ul className="mt-3 space-y-2">
            {splits.map((suggestion, index) => (
              <li key={index} className="rounded-2xl border-2 border-[var(--border)] p-3">
                <p className="text-xs font-extrabold text-[var(--fire-dark)] dark:text-[var(--fire)]">
                  {suggestion.advice}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                  {suggestion.sentence.slice(0, 240)}{suggestion.sentence.length > 240 ? "…" : ""}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {synonyms.length > 0 ? (
        <Card className="p-5">
          <p className="text-sm font-extrabold">Alternative wordings</p>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
            Swap these in only where the alternative genuinely fits. A synonym that is
            close but not right is worse than the plain word you started with.
          </p>
          <ul className="mt-3 space-y-2">
            {synonyms.map((suggestion) => (
              <li key={suggestion.start} className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <span className="rounded-full bg-[var(--panel)] px-2.5 py-1 font-extrabold">
                  {suggestion.sentence}
                </span>
                <span aria-hidden className="text-[var(--muted)]">→</span>
                {suggestion.options.map((option) => (
                  <span key={option} className="rounded-full border-2 border-[var(--border)] px-2.5 py-1">
                    {option}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {!text.trim() ? (
        <EmptyState
          icon="✂️"
          title="Paste a paragraph"
          description="Pick a mode above and every edit will be listed so you can accept or reject it one by one."
        />
      ) : null}

      <InfoNote icon="✍️">
        <strong className="font-extrabold">This rewrites wording, not ideas.</strong>{" "}
        Every change is a substitution from a fixed list — a long phrase for a short
        one, a noun phrase for the verb inside it — and each one is shown to you.
        It will not restate an argument in genuinely new words, and it is not a way
        to pass someone else&rsquo;s writing off as your own: if the ideas are not
        yours, they still need a citation.
      </InfoNote>
    </div>
  );
}
