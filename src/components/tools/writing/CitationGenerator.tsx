"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Stat, InfoNote } from "@/components/ui/Feedback";
import {
  LIST_HEADING, SOURCE_LABELS, STYLE_LABELS, formatCitation, sortReferences,
  toHtml, toPlainText,
  type Author, type CitationStyle, type Source, type SourceType,
} from "@/lib/writing/citations";
import { useLocalValue } from "@/lib/utils/use-local";
import { writeLocal } from "@/lib/utils/storage";
import { track } from "@/lib/analytics";

const STORAGE_KEY = "citations";

const EMPTY: Source = {
  type: "journal", authors: [{ family: "", given: "" }], title: "",
  container: "", publisher: "", year: "", volume: "", issue: "", pages: "",
  url: "", doi: "", city: "", edition: "", accessed: "", month: "", day: "",
  institution: "",
};

/** Which fields matter for which source type, so the form stays short. */
const FIELDS: Record<SourceType, Array<keyof Source>> = {
  book: ["title", "publisher", "city", "edition", "year", "url"],
  chapter: ["title", "container", "editors", "publisher", "pages", "year"],
  journal: ["title", "container", "volume", "issue", "pages", "year", "doi", "url"],
  website: ["title", "container", "year", "month", "day", "url", "accessed"],
  newspaper: ["title", "container", "year", "month", "day", "pages", "url"],
  thesis: ["title", "institution", "city", "year", "url"],
  report: ["title", "publisher", "city", "year", "url"],
  video: ["title", "container", "year", "month", "day", "url"],
  conference: ["title", "container", "city", "pages", "year", "doi"],
};

const FIELD_LABELS: Partial<Record<keyof Source, { label: string; hint?: string; placeholder?: string }>> = {
  title: { label: "Title", placeholder: "Title of the article, book or page" },
  container: { label: "Published in", hint: "journal, book, website or newspaper" },
  publisher: { label: "Publisher" },
  city: { label: "City", hint: "publisher's location" },
  edition: { label: "Edition", placeholder: "2nd" },
  year: { label: "Year", placeholder: "2024" },
  month: { label: "Month", placeholder: "1–12" },
  day: { label: "Day", placeholder: "1–31" },
  volume: { label: "Volume" },
  issue: { label: "Issue" },
  pages: { label: "Pages", placeholder: "145-170" },
  url: { label: "URL" },
  doi: { label: "DOI", hint: "preferred over a URL" },
  accessed: { label: "Date accessed", placeholder: "3 September 2026" },
  institution: { label: "Institution" },
};

interface Saved extends Source {
  id: string;
}

export function CitationGenerator() {
  const [style, setStyle] = React.useState<CitationStyle>("apa");
  const [source, setSource] = React.useState<Source>(EMPTY);
  const saved = useLocalValue<Saved[]>(STORAGE_KEY, []);
  const [copiedAll, setCopiedAll] = React.useState(false);
  const reported = React.useRef(false);

  const citation = React.useMemo(() => formatCitation(source, style), [source, style]);
  const ready = source.title.trim().length > 0;

  React.useEffect(() => {
    if (!reported.current && ready) {
      reported.current = true;
      track("tool_complete", { tool: "citation-generator" });
    }
  }, [ready]);

  function update<K extends keyof Source>(key: K, value: Source[K]) {
    setSource((current) => ({ ...current, [key]: value }));
  }

  function updateAuthor(index: number, patch: Partial<Author>) {
    setSource((current) => ({
      ...current,
      authors: current.authors.map((author, i) => (i === index ? { ...author, ...patch } : author)),
    }));
  }

  function addToList() {
    if (!ready) return;
    const entry: Saved = { ...source, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    writeLocal(STORAGE_KEY, [...saved, entry]);
    setSource({ ...EMPTY, type: source.type });
  }

  const sortedList = React.useMemo(() => sortReferences(saved, style) as Saved[], [saved, style]);

  /** Copies with formatting so italics survive a paste into a word processor. */
  async function copyRich(html: string, plain: string, onDone: () => void) {
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      onDone();
    } catch {
      // A denied clipboard permission is not worth an error state; the text is
      // on screen and selectable either way.
    }
  }

  const fields = FIELDS[source.type].filter((field) => field !== "editors");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="cg-style">Citation style</Label>
          <Select
            id="cg-style"
            value={style}
            onChange={(event) => setStyle(event.target.value as CitationStyle)}
          >
            {(Object.keys(STYLE_LABELS) as CitationStyle[]).map((key) => (
              <option key={key} value={key}>{STYLE_LABELS[key]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="cg-type">Source type</Label>
          <Select
            id="cg-type"
            value={source.type}
            onChange={(event) => update("type", event.target.value as SourceType)}
          >
            {(Object.keys(SOURCE_LABELS) as SourceType[]).map((key) => (
              <option key={key} value={key}>{SOURCE_LABELS[key]}</option>
            ))}
          </Select>
        </div>
      </div>

      <Card className="p-5">
        <p className="text-sm font-extrabold">Authors</p>
        <ul className="mt-3 space-y-2">
          {source.authors.map((author, index) => (
            <li key={index} className="flex flex-wrap items-end gap-2">
              {author.organisation ? (
                <div className="min-w-[200px] flex-1">
                  <Label htmlFor={`cg-org-${index}`}>Organisation</Label>
                  <Input
                    id={`cg-org-${index}`}
                    value={author.given}
                    onChange={(event) => updateAuthor(index, { given: event.target.value })}
                    placeholder="World Health Organization"
                  />
                </div>
              ) : (
                <>
                  <div className="min-w-[140px] flex-1">
                    <Label htmlFor={`cg-given-${index}`}>First name(s)</Label>
                    <Input
                      id={`cg-given-${index}`}
                      value={author.given}
                      onChange={(event) => updateAuthor(index, { given: event.target.value })}
                      placeholder="Jane A."
                    />
                  </div>
                  <div className="min-w-[140px] flex-1">
                    <Label htmlFor={`cg-family-${index}`}>Surname</Label>
                    <Input
                      id={`cg-family-${index}`}
                      value={author.family}
                      onChange={(event) => updateAuthor(index, { family: event.target.value })}
                      placeholder="Smith"
                    />
                  </div>
                </>
              )}
              <Button
                size="sm"
                tone="ghost"
                onClick={() => updateAuthor(index, { organisation: !author.organisation })}
              >
                {author.organisation ? "A person" : "An organisation"}
              </Button>
              {source.authors.length > 1 ? (
                <Button
                  size="sm"
                  tone="ghost"
                  aria-label={`Remove author ${index + 1}`}
                  onClick={() =>
                    setSource((current) => ({
                      ...current,
                      authors: current.authors.filter((_, i) => i !== index),
                    }))
                  }
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <Button
          size="sm"
          tone="panel"
          className="mt-3"
          onClick={() =>
            setSource((current) => ({ ...current, authors: [...current.authors, { family: "", given: "" }] }))
          }
        >
          Add author
        </Button>
      </Card>

      <Card className="p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => {
            const meta = FIELD_LABELS[field];
            if (!meta) return null;
            return (
              <div key={field} className={field === "title" ? "sm:col-span-2" : undefined}>
                <Label htmlFor={`cg-${field}`} hint={meta.hint}>{meta.label}</Label>
                <Input
                  id={`cg-${field}`}
                  value={(source[field] as string) ?? ""}
                  onChange={(event) => update(field, event.target.value as Source[typeof field])}
                  placeholder={meta.placeholder}
                  inputMode={field === "year" || field === "month" || field === "day" ? "numeric" : undefined}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {ready ? (
        <Card className="p-5">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
            {STYLE_LABELS[style]} — reference list entry
          </p>
          <p
            className="mt-2 text-base font-semibold leading-relaxed"
            style={{ textIndent: "-2rem", paddingLeft: "2rem" }}
          >
            {citation.reference.map((segment, index) =>
              segment.italic ? <em key={index}>{segment.text}</em> : <span key={index}>{segment.text}</span>,
            )}
          </p>

          <p className="mt-4 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
            In-text citation
          </p>
          <p className="mt-1 font-mono text-sm font-bold">{citation.inText}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                copyRich(toHtml(citation.reference), toPlainText(citation.reference), () => {})
              }
            >
              Copy reference
            </Button>
            <Button
              size="sm"
              tone="sky"
              onClick={() => navigator.clipboard?.writeText(citation.inText).catch(() => {})}
            >
              Copy in-text
            </Button>
            <Button size="sm" tone="grape" onClick={addToList}>
              Add to my list
            </Button>
          </div>

          {citation.warnings.length > 0 ? (
            <ul className="mt-4 space-y-1">
              {citation.warnings.map((warning) => (
                <li key={warning} className="flex gap-2 text-sm font-semibold text-[var(--muted)]">
                  <span aria-hidden>•</span>
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : (
        <InfoNote icon="📚">
          Fill in at least the title and the citation will build as you type. Every
          field is optional — the formatter leaves out anything you have not given
          and tells you what the style would normally expect.
        </InfoNote>
      )}

      {saved.length > 0 ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-extrabold">
              {LIST_HEADING[style]} ({saved.length})
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const entries = sortedList.map((entry) => formatCitation(entry, style));
                  const html = `<p>${entries.map((c) => toHtml(c.reference)).join("</p><p>")}</p>`;
                  const plain = entries.map((c) => toPlainText(c.reference)).join("\n\n");
                  copyRich(html, plain, () => setCopiedAll(true));
                }}
              >
                {copiedAll ? "Copied ✓" : "Copy whole list"}
              </Button>
              <Button size="sm" tone="ghost" onClick={() => writeLocal(STORAGE_KEY, [])}>
                Clear list
              </Button>
            </div>
          </div>

          <Stat
            className="mt-3"
            label="Saved on this device only"
            value={`${saved.length} source${saved.length === 1 ? "" : "s"}`}
            hint="never uploaded"
            tone="grass"
          />

          <ol className="mt-4 space-y-3">
            {sortedList.map((entry, index) => {
              const formatted = formatCitation(entry, style);
              return (
                <li key={entry.id} className="flex items-start gap-3">
                  <span className="mt-1 shrink-0 text-xs font-extrabold text-[var(--muted)]">
                    {index + 1}.
                  </span>
                  <p className="min-w-0 flex-1 text-sm font-semibold leading-relaxed">
                    {formatted.reference.map((segment, i) =>
                      segment.italic ? <em key={i}>{segment.text}</em> : <span key={i}>{segment.text}</span>,
                    )}
                  </p>
                  <Button
                    size="sm"
                    tone="ghost"
                    aria-label={`Remove source ${index + 1}`}
                    onClick={() => writeLocal(STORAGE_KEY, saved.filter((s) => s.id !== entry.id))}
                  >
                    ✕
                  </Button>
                </li>
              );
            })}
          </ol>
        </Card>
      ) : null}

      <InfoNote icon="📖">
        <strong className="font-extrabold">Check the output before you submit it.</strong>{" "}
        These formatters follow the published rules for each style, but styles have
        edge cases — corporate authors, missing dates, translated works — and your
        department may have its own house variation. The generator is a fast first
        draft, not a substitute for your course&rsquo;s referencing guide.
      </InfoNote>
    </div>
  );
}
