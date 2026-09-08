"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea, Label, Slider } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Stat, EmptyState, InfoNote } from "@/components/ui/Feedback";
import { compare } from "@/lib/writing/similarity";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

/** Renders a document with its matched passages highlighted. */
function Highlighted({
  text,
  spans,
  active,
  onSelect,
}: {
  text: string;
  spans: Array<{ start: number; end: number; key: number }>;
  active: number | null;
  onSelect: (key: number) => void;
}) {
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const span of ordered) {
    if (span.start < cursor) continue;
    if (span.start > cursor) parts.push(text.slice(cursor, span.start));
    parts.push(
      <mark
        key={span.key}
        onClick={() => onSelect(span.key)}
        className={cn(
          "cursor-pointer rounded px-0.5",
          active === span.key
            ? "bg-[var(--sun)] text-[var(--ink)]"
            : "bg-[var(--fire-soft)] text-[var(--ink)]",
        )}
      >
        {text.slice(span.start, span.end)}
      </mark>,
    );
    cursor = span.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return (
    <p className="do-scroll max-h-[320px] overflow-auto whitespace-pre-wrap text-sm font-semibold leading-relaxed">
      {parts}
    </p>
  );
}

export function SimilarityChecker() {
  const [a, setA] = React.useState("");
  const [b, setB] = React.useState("");
  const [size, setSize] = React.useState(5);
  const [active, setActive] = React.useState<number | null>(null);
  const reported = React.useRef(false);

  const deferredA = React.useDeferredValue(a);
  const deferredB = React.useDeferredValue(b);

  const report = React.useMemo(
    () => compare(deferredA, deferredB, { shingleSize: size }),
    [deferredA, deferredB, size],
  );

  React.useEffect(() => {
    if (!reported.current && report.passages.length > 0) {
      reported.current = true;
      track("tool_complete", { tool: "text-similarity-checker" });
    }
  }, [report.passages.length]);

  const ready = deferredA.trim().length > 0 && deferredB.trim().length > 0;

  const spansA = report.passages.map((passage, index) => ({
    start: passage.aStart, end: passage.aEnd, key: index,
  }));
  const spansB = report.passages.map((passage, index) => ({
    start: passage.bStart, end: passage.bEnd, key: index,
  }));

  const tone =
    report.containment >= 40 ? "cherry" : report.containment >= 15 ? "fire" : "grass";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Label htmlFor="sc-a">Your text</Label>
          <Textarea
            id="sc-a"
            value={a}
            onChange={(event) => setA(event.target.value)}
            placeholder="Paste your draft here."
            className="min-h-[200px]"
          />
        </Card>
        <Card>
          <Label htmlFor="sc-b">The source to compare against</Label>
          <Textarea
            id="sc-b"
            value={b}
            onChange={(event) => setB(event.target.value)}
            placeholder="Paste the article, book extract or classmate's text you want to check against."
            className="min-h-[200px]"
          />
        </Card>
      </div>

      <Card className="p-5">
        <Label htmlFor="sc-size" hint={`${size} words`}>
          How long a run counts as a match
        </Label>
        <Slider
          id="sc-size"
          min={3}
          max={10}
          step={1}
          value={size}
          onChange={(event) => setSize(Number(event.target.value))}
        />
        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
          Shorter settings catch more paraphrasing but also more coincidence — any
          two essays on the same topic share four-word runs. Five is a sensible default.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          tone="ghost"
          onClick={() => { setA(""); setB(""); setActive(null); }}
          disabled={!a && !b}
        >
          Clear both
        </Button>
      </div>

      {!ready ? (
        <EmptyState
          icon="🔍"
          title="Paste both texts"
          description="This compares the two documents you provide. It cannot search the web — see the note below."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Overlap"
              value={`${report.containment}%`}
              tone={tone}
              hint="of your text found in the source"
            />
            <Stat label="Shared passages" value={String(report.passages.length)} tone="sky" />
            <Stat
              label="Longest run"
              value={`${report.passages[0]?.words ?? 0}`}
              tone="grape"
              hint="matching words in a row"
            />
            <Stat label="Two-way overlap" value={`${report.jaccard}%`} hint="Jaccard" />
          </div>

          <Card className={cn("p-5", `border-2 border-[var(--${tone})]`)}>
            <p className="text-base font-extrabold">{report.verdict}</p>
          </Card>

          {report.passages.length > 0 ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <p className="mb-2 text-sm font-extrabold">Your text</p>
                  <Highlighted text={deferredA} spans={spansA} active={active} onSelect={setActive} />
                </Card>
                <Card className="p-5">
                  <p className="mb-2 text-sm font-extrabold">The source</p>
                  <Highlighted text={deferredB} spans={spansB} active={active} onSelect={setActive} />
                </Card>
              </div>

              <Card className="p-5">
                <p className="text-sm font-extrabold">Matching passages, longest first</p>
                <ol className="mt-3 space-y-2">
                  {report.passages.slice(0, 30).map((passage, index) => (
                    <li key={index}>
                      <button
                        type="button"
                        onClick={() => setActive(index === active ? null : index)}
                        className={cn(
                          "w-full rounded-2xl border-2 p-3 text-left transition",
                          active === index
                            ? "border-[var(--sun)] bg-[var(--sun-soft)]"
                            : "border-[var(--border)]",
                        )}
                      >
                        <span className="mr-2 rounded-full bg-[var(--panel)] px-2 py-0.5 text-xs font-extrabold">
                          {passage.words} words
                        </span>
                        <span className="text-sm font-semibold">
                          &ldquo;{passage.text.slice(0, 200)}{passage.text.length > 200 ? "…" : ""}&rdquo;
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </Card>
            </>
          ) : null}
        </>
      )}

      <InfoNote icon="🔍">
        <strong className="font-extrabold">This is not a web plagiarism scan.</strong>{" "}
        It compares the two texts you paste in, and only those. Checking a draft
        against everything ever published needs a crawled index of the whole web,
        which no free browser tool has — so rather than pretend, this does the job it
        genuinely can: showing you exactly which passages you have reused from a
        source you already have, so you can quote and cite them properly.
      </InfoNote>
    </div>
  );
}
