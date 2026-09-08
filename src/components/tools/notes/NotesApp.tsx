"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EmptyState, InfoNote } from "@/components/ui/Feedback";
import {
  NOTES_KEY, NOTE_COLOURS, derivedTitle, fromMarkdown, newNote, preview,
  searchNotes, sortNotes, toMarkdown, wordCount, type Note, type NoteColour,
} from "@/lib/notes/store";
import { useLocalValue, useIsHydrated } from "@/lib/utils/use-local";
import { writeLocal } from "@/lib/utils/storage";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

const COLOUR_CLASS: Record<NoteColour, string> = {
  plain: "bg-[var(--panel)]",
  sun: "bg-[var(--sun-soft)]",
  grass: "bg-[var(--grass-soft)]",
  sky: "bg-[var(--sky-soft)]",
  grape: "bg-[var(--grape-soft)]",
  fire: "bg-[var(--fire-soft)]",
  cherry: "bg-[var(--cherry-soft)]",
};

function when(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function NotesApp({ compact = false }: { compact?: boolean }) {
  const stored = useLocalValue<Note[]>(NOTES_KEY, []);
  const hydrated = useIsHydrated();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const reported = React.useRef(false);

  const notes = React.useMemo(() => sortNotes(stored), [stored]);
  const visible = React.useMemo(() => searchNotes(notes, query), [notes, query]);
  const active = notes.find((note) => note.id === activeId) ?? null;

  function persist(next: Note[]) {
    writeLocal(NOTES_KEY, next);
    setSaved(true);
    if (!reported.current) {
      reported.current = true;
      track("tool_complete", { tool: "notes" });
    }
  }

  // The "saved" flash is transient feedback, not state anything depends on.
  React.useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 1200);
    return () => window.clearTimeout(timer);
  }, [saved]);

  function create() {
    const note = newNote();
    persist([note, ...stored]);
    setActiveId(note.id);
    setQuery("");
  }

  function update(id: string, patch: Partial<Note>) {
    persist(
      stored.map((note) => (note.id === id ? { ...note, ...patch, updated: Date.now() } : note)),
    );
  }

  function remove(id: string) {
    persist(stored.filter((note) => note.id !== id));
    if (activeId === id) setActiveId(null);
    setConfirmDelete(null);
  }

  function download() {
    const blob = new Blob([toMarkdown(stored)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `do101-notes-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(file: File) {
    const text = await file.text();
    const imported = fromMarkdown(text);
    if (imported.length === 0) return;
    persist([...imported, ...stored]);
    setActiveId(imported[0].id);
  }

  if (!hydrated) {
    // localStorage is unreadable during the server render, so the first paint
    // shows the frame rather than an empty state that would flash and change.
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-bold text-[var(--muted)]">Opening your notes…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={create}>New note</Button>
        <div className="min-w-[160px] flex-1">
          <label htmlFor="nt-search" className="sr-only">Search notes</label>
          <Input
            id="nt-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${notes.length} note${notes.length === 1 ? "" : "s"}…`}
            type="search"
          />
        </div>
        {saved ? (
          <span className="do-pop rounded-full bg-[var(--grass-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--grass-dark)] dark:text-[var(--grass)]">
            Saved ✓
          </span>
        ) : null}
      </div>

      <div className={cn("grid gap-4", compact ? "" : "lg:grid-cols-[minmax(0,320px)_1fr]")}>
        <div className="space-y-2">
          {visible.length === 0 ? (
            <EmptyState
              icon="🗒️"
              title={notes.length === 0 ? "No notes yet" : "Nothing matches"}
              description={
                notes.length === 0
                  ? "Notes are saved in this browser, on this device. No account, no server."
                  : "Try a different search."
              }
              action={notes.length === 0 ? <Button onClick={create}>Write your first note</Button> : undefined}
            />
          ) : (
            <ul className="do-scroll max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {visible.map((note) => (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(note.id)}
                    aria-current={note.id === activeId}
                    className={cn(
                      "w-full rounded-2xl border-2 p-3 text-left transition",
                      COLOUR_CLASS[note.colour],
                      note.id === activeId
                        ? "border-[var(--sky)]"
                        : "border-[var(--border)] hover:border-[var(--border-strong)]",
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-extrabold">
                        {note.pinned ? <span aria-label="Pinned">📌 </span> : null}
                        {derivedTitle(note)}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold text-[var(--muted)]">
                        {when(note.updated)}
                      </span>
                    </span>
                    {preview(note) ? (
                      <span className="mt-1 block truncate text-xs font-semibold text-[var(--muted)]">
                        {preview(note)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {active ? (
          <Card className={cn("flex flex-col p-4", COLOUR_CLASS[active.colour])}>
            <label htmlFor="nt-title" className="sr-only">Note title</label>
            <Input
              id="nt-title"
              value={active.title}
              onChange={(event) => update(active.id, { title: event.target.value })}
              placeholder="Title (optional — the first line is used otherwise)"
              className="border-0 bg-transparent text-lg font-extrabold focus:border-0"
            />
            <label htmlFor="nt-body" className="sr-only">Note</label>
            <Textarea
              id="nt-body"
              value={active.body}
              onChange={(event) => update(active.id, { body: event.target.value })}
              placeholder="Start writing. Everything saves as you type."
              className="mt-2 min-h-[320px] flex-1 border-0 bg-transparent focus:border-0"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t-2 border-[var(--border)] pt-3">
              <span className="text-xs font-bold text-[var(--muted)]">
                {wordCount(active.body)} words · edited {when(active.updated)}
              </span>
              <span className="flex-1" />
              <div className="flex gap-1" role="group" aria-label="Note colour">
                {NOTE_COLOURS.map((colour) => (
                  <button
                    key={colour}
                    type="button"
                    aria-label={`${colour} background`}
                    aria-pressed={active.colour === colour}
                    onClick={() => update(active.id, { colour })}
                    className={cn(
                      "size-6 rounded-full border-2",
                      COLOUR_CLASS[colour],
                      active.colour === colour ? "border-[var(--ink)]" : "border-[var(--border)]",
                    )}
                  />
                ))}
              </div>
              <Button
                size="sm"
                tone="panel"
                onClick={() => update(active.id, { pinned: !active.pinned })}
              >
                {active.pinned ? "Unpin" : "Pin"}
              </Button>
              <CopyButton value={active.body} label="Copy" disabled={!active.body} />
              {confirmDelete === active.id ? (
                <>
                  <Button size="sm" tone="cherry" onClick={() => remove(active.id)}>
                    Delete for good
                  </Button>
                  <Button size="sm" tone="ghost" onClick={() => setConfirmDelete(null)}>
                    Keep it
                  </Button>
                </>
              ) : (
                <Button size="sm" tone="ghost" onClick={() => setConfirmDelete(active.id)}>
                  Delete
                </Button>
              )}
            </div>
          </Card>
        ) : notes.length > 0 ? (
          <Card className="flex items-center justify-center p-10">
            <p className="text-sm font-bold text-[var(--muted)]">
              Pick a note on the left, or start a new one.
            </p>
          </Card>
        ) : null}
      </div>

      {notes.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" tone="panel" onClick={download}>
            Download all as Markdown
          </Button>
          <Button size="sm" tone="panel" onClick={() => fileRef.current?.click()}>
            Import a Markdown file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.txt,text/plain,text/markdown"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = "";
            }}
          />
        </div>
      ) : null}

      <InfoNote icon="💾">
        <strong className="font-extrabold">Your notes are stored in this browser only.</strong>{" "}
        There is no account and no server, which is what makes this free to run and
        private by construction — but it also means the notes live on this device, in
        this browser. They will not appear on your phone, and clearing your browsing
        data will delete them. Download the Markdown file if you want a backup or want
        to move them somewhere else.
      </InfoNote>
    </div>
  );
}
