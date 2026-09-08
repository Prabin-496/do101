"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Stat, EmptyState, InfoNote } from "@/components/ui/Feedback";
import { Toggle } from "@/components/ui/Field";
import {
  CATEGORY_LABEL, applyConfidentFixes, check,
  type IssueCategory, type Severity, type WritingIssue,
} from "@/lib/writing/rules";
import { describeReadingEase, readability } from "@/lib/writing/readability";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

const SEVERITY_STYLE: Record<Severity, { chip: string; underline: string; label: string }> = {
  error: {
    chip: "bg-[var(--cherry-soft)] text-[var(--cherry-dark)] dark:text-[var(--cherry)]",
    underline: "do-mark-error",
    label: "Mistake",
  },
  warning: {
    chip: "bg-[var(--fire-soft)] text-[var(--fire-dark)] dark:text-[var(--fire)]",
    underline: "do-mark-warning",
    label: "Check this",
  },
  suggestion: {
    chip: "bg-[var(--sky-soft)] text-[var(--sky-dark)] dark:text-[var(--sky)]",
    underline: "do-mark-suggestion",
    label: "Could be better",
  },
};

const CATEGORY_ICON: Record<IssueCategory, string> = {
  spelling: "🔤",
  grammar: "📐",
  punctuation: "❗",
  clarity: "💡",
  concision: "✂️",
  style: "🎨",
};

const SAMPLE = `Due to the fact that the experiment was conducted over a very short period of time, the results should be treated with alot of caution. The data was collected from 40 participants, and there own reports suggest that they didnt always follow the instructions carefully. In order to acheive a more reliable result, a future study would need to run for longer and it would need to check that participants actually understood what they were being asked to do, which is something the current design did not verify at any point .`;

/** Splits the text into runs so matched spans can be underlined in place. */
function buildSegments(text: string, issues: WritingIssue[]) {
  const segments: Array<{ text: string; issue?: WritingIssue }> = [];
  let cursor = 0;
  for (const issue of issues) {
    if (issue.start < cursor) continue;
    if (issue.start > cursor) segments.push({ text: text.slice(cursor, issue.start) });
    segments.push({ text: text.slice(issue.start, issue.end), issue });
    cursor = issue.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

export function WritingChecker() {
  const [text, setText] = React.useState("");
  const [formal, setFormal] = React.useState(true);
  const [muted, setMuted] = React.useState<IssueCategory[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [dismissed, setDismissed] = React.useState<string[]>([]);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const reported = React.useRef(false);

  // Analysis runs against a deferred copy so typing never stutters on a long essay.
  const deferred = React.useDeferredValue(text);
  const analysing = deferred !== text;

  const allIssues = React.useMemo(() => check(deferred, { formal }), [deferred, formal]);
  const issues = React.useMemo(
    () => allIssues.filter((i) => !muted.includes(i.category) && !dismissed.includes(i.id)),
    [allIssues, muted, dismissed],
  );
  const scores = React.useMemo(() => readability(deferred), [deferred]);
  const segments = React.useMemo(() => buildSegments(deferred, issues), [deferred, issues]);

  React.useEffect(() => {
    if (!reported.current && deferred.trim().split(/\s+/).length > 30) {
      reported.current = true;
      track("tool_complete", { tool: "grammar-checker" });
    }
  }, [deferred]);

  const counts = React.useMemo(() => {
    const byCategory = new Map<IssueCategory, number>();
    for (const issue of allIssues) {
      if (dismissed.includes(issue.id)) continue;
      byCategory.set(issue.category, (byCategory.get(issue.category) ?? 0) + 1);
    }
    return byCategory;
  }, [allIssues, dismissed]);

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const suggestions = issues.filter((i) => i.severity === "suggestion").length;

  function replaceRange(issue: WritingIssue, replacement: string) {
    setText((current) => current.slice(0, issue.start) + replacement + current.slice(issue.end));
    setSelected(null);
    // Offsets after this point shift, so previously dismissed ids no longer apply.
    setDismissed([]);
  }

  function fixEverythingSafe() {
    const result = applyConfidentFixes(text, allIssues);
    if (result.applied === 0) return;
    setText(result.text);
    setDismissed([]);
    setSelected(null);
  }

  function focusIssue(issue: WritingIssue) {
    setSelected(issue.id === selected ? null : issue.id);
    const node = textareaRef.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(issue.start, issue.end);
  }

  const safeFixes = allIssues.filter(
    (i) => i.severity === "error" && i.replacements.length === 1 && !dismissed.includes(i.id),
  ).length;

  const grouped = React.useMemo(() => {
    const order: IssueCategory[] = ["spelling", "grammar", "punctuation", "clarity", "concision", "style"];
    return order
      .map((category) => ({ category, items: issues.filter((i) => i.category === category) }))
      .filter((group) => group.items.length > 0);
  }, [issues]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Mistakes" value={String(errors)} tone={errors ? "cherry" : "grass"} />
        <Stat label="Worth checking" value={String(warnings)} tone={warnings ? "fire" : "grass"} />
        <Stat label="Suggestions" value={String(suggestions)} tone="sky" />
        <Stat
          label="Reading ease"
          value={scores ? String(Math.round(scores.fleschReadingEase)) : "—"}
          tone="grape"
          hint={scores ? describeReadingEase(scores.fleschReadingEase).label : "needs 10+ words"}
        />
      </div>

      <Card className="p-0">
        <div className="relative">
          {/* The overlay carries the highlights; the textarea sits on top of it,
              transparent apart from the caret, so selection and typing behave
              exactly as they normally would. */}
          <div
            ref={overlayRef}
            aria-hidden
            className="do-editor-layer do-scroll pointer-events-none absolute inset-0 overflow-hidden"
          >
            {segments.map((segment, index) =>
              segment.issue ? (
                <mark
                  key={`${segment.issue.id}-${index}`}
                  className={cn(
                    "do-mark",
                    SEVERITY_STYLE[segment.issue.severity].underline,
                    selected === segment.issue.id && "do-mark-active",
                  )}
                >
                  {segment.text}
                </mark>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
            {/* Trailing newline keeps the last line scrollable in step with the textarea. */}
            {"\n"}
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            spellCheck={false}
            onChange={(event) => setText(event.target.value)}
            onScroll={(event) => {
              const overlay = overlayRef.current;
              if (overlay) {
                overlay.scrollTop = event.currentTarget.scrollTop;
                overlay.scrollLeft = event.currentTarget.scrollLeft;
              }
            }}
            placeholder="Paste your essay, report or assignment here. Everything is checked inside your browser — nothing is uploaded."
            aria-label="Text to check"
            aria-describedby="wr-status"
            className="do-editor-layer do-scroll relative w-full resize-y bg-transparent text-transparent caret-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
          />
        </div>
      </Card>

      <p id="wr-status" role="status" aria-live="polite" className="sr-only">
        {analysing
          ? "Checking."
          : `${errors} mistakes, ${warnings} to check, ${suggestions} suggestions.`}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={fixEverythingSafe} disabled={safeFixes === 0}>
          {safeFixes > 0 ? `Fix ${safeFixes} clear mistake${safeFixes === 1 ? "" : "s"}` : "Nothing to auto-fix"}
        </Button>
        <CopyButton value={text} label="Copy text" disabled={!text} />
        <Button tone="ghost" onClick={() => setText(SAMPLE)} disabled={!!text}>
          Try an example
        </Button>
        <Button
          tone="ghost"
          onClick={() => {
            setText("");
            setDismissed([]);
            setSelected(null);
          }}
          disabled={!text}
        >
          Clear
        </Button>
      </div>

      <Card className="p-4">
        <Toggle
          checked={formal}
          onChange={setFormal}
          label="Academic writing"
          description="Adds checks that only matter in formal work, such as flagging contractions."
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_LABEL) as IssueCategory[]).map((category) => {
            const off = muted.includes(category);
            const count = counts.get(category) ?? 0;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={!off}
                onClick={() =>
                  setMuted((current) =>
                    current.includes(category)
                      ? current.filter((c) => c !== category)
                      : [...current, category],
                  )
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-extrabold transition",
                  off
                    ? "border-[var(--border)] text-[var(--muted)] line-through"
                    : "border-[var(--border-strong)] text-[var(--ink)]",
                )}
              >
                <span aria-hidden>{CATEGORY_ICON[category]}</span>
                {CATEGORY_LABEL[category]}
                <span className="rounded-full bg-[var(--panel)] px-1.5">{count}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {text.trim() === "" ? (
        <EmptyState
          icon="📝"
          title="Paste something to check"
          description="Spelling, grammar, punctuation, clarity and concision, all checked in this tab. Nothing leaves your device."
        />
      ) : issues.length === 0 ? (
        <Card className="p-6 text-center">
          <span className="do-bob text-4xl" aria-hidden>🎉</span>
          <p className="mt-3 text-base font-extrabold">Nothing flagged</p>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
            No issues from the checks that are switched on. That is not the same as
            perfect — a rule-based checker cannot judge whether your argument works.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <Card key={group.category} className="p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-extrabold">
                <span aria-hidden>{CATEGORY_ICON[group.category]}</span>
                {CATEGORY_LABEL[group.category]}
                <span className="text-[var(--muted)]">({group.items.length})</span>
              </p>
              <ul className="space-y-2">
                {group.items.slice(0, 40).map((issue) => (
                  <li key={issue.id}>
                    <div
                      className={cn(
                        "rounded-2xl border-2 p-3 transition",
                        selected === issue.id
                          ? "border-[var(--sky)] bg-[var(--sky-soft)]"
                          : "border-[var(--border)]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => focusIssue(issue)}
                        className="flex w-full items-start gap-2 text-left"
                        aria-expanded={selected === issue.id}
                      >
                        <span
                          className={cn(
                            "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
                            SEVERITY_STYLE[issue.severity].chip,
                          )}
                        >
                          {SEVERITY_STYLE[issue.severity].label}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold">{issue.message}</span>
                          <span className="mt-0.5 block truncate font-mono text-xs text-[var(--muted)]">
                            …{issue.matched.slice(0, 80)}…
                          </span>
                        </span>
                      </button>

                      {selected === issue.id ? (
                        <div className="mt-3 space-y-3 border-t-2 border-[var(--border)] pt-3">
                          <p className="text-sm font-semibold text-[var(--muted)]">{issue.explain}</p>
                          {issue.replacements.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {issue.replacements.map((replacement, index) => (
                                <Button
                                  key={index}
                                  size="sm"
                                  tone="grass"
                                  onClick={() => replaceRange(issue, replacement)}
                                >
                                  {replacement === ""
                                    ? "Delete it"
                                    : `Use "${replacement.trim() || replacement}"`}
                                </Button>
                              ))}
                              <Button
                                size="sm"
                                tone="ghost"
                                onClick={() => setDismissed((d) => [...d, issue.id])}
                              >
                                Ignore
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <span className="text-xs font-bold text-[var(--muted)]">
                                This one needs your judgement — there is no single correct rewrite.
                              </span>
                              <Button
                                size="sm"
                                tone="ghost"
                                onClick={() => setDismissed((d) => [...d, issue.id])}
                              >
                                Ignore
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              {group.items.length > 40 ? (
                <p className="mt-2 text-xs font-bold text-[var(--muted)]">
                  Showing the first 40 of {group.items.length}. Fix these and the rest will re-sort.
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <InfoNote icon="🔎">
        <strong className="font-extrabold">What this tool can and cannot do.</strong>{" "}
        It matches patterns — misspellings, punctuation, agreement, wordy phrasing,
        passive voice. It does not parse sentences or understand meaning, so it will
        miss mistakes that need context, and some suggestions will not suit your
        sentence. Treat every suggestion as a prompt to look again, not an instruction.
      </InfoNote>
    </div>
  );
}
