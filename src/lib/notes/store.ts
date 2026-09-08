/**
 * Note storage.
 *
 * Notes live in the browser's localStorage and nowhere else. There is no
 * account, no sync and no server, which is what makes the tool free to run —
 * and it is also the limitation the interface has to be honest about: the notes
 * belong to this browser on this device, and clearing site data deletes them.
 */

export interface Note {
  id: string;
  title: string;
  body: string;
  /** Epoch milliseconds. */
  created: number;
  updated: number;
  pinned: boolean;
  colour: NoteColour;
}

export type NoteColour = "plain" | "sun" | "grass" | "sky" | "grape" | "fire" | "cherry";

export const NOTE_COLOURS: NoteColour[] = ["plain", "sun", "grass", "sky", "grape", "fire", "cherry"];

export const NOTES_KEY = "notes";

export function newNote(): Note {
  const now = Date.now();
  return {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    body: "",
    created: now,
    updated: now,
    pinned: false,
    colour: "plain",
  };
}

/** Pinned first, then most recently edited. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updated - a.updated;
  });
}

export function searchNotes(notes: Note[], query: string): Note[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return notes;
  return notes.filter(
    (note) =>
      note.title.toLowerCase().includes(needle) || note.body.toLowerCase().includes(needle),
  );
}

/** First non-empty line, used when a note has no title of its own. */
export function derivedTitle(note: Note): string {
  if (note.title.trim()) return note.title.trim();
  const line = note.body.split("\n").find((l) => l.trim());
  return line ? line.trim().slice(0, 60) : "Untitled note";
}

export function preview(note: Note): string {
  const body = note.title.trim() ? note.body : note.body.split("\n").slice(1).join(" ");
  return body.replace(/\s+/g, " ").trim().slice(0, 120);
}

export function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

/** A stable, human-readable export of everything stored. */
export function toMarkdown(notes: Note[]): string {
  return sortNotes(notes)
    .map((note) => {
      const date = new Date(note.updated).toISOString().slice(0, 10);
      return `# ${derivedTitle(note)}\n\n_Last edited ${date}_\n\n${note.body}\n`;
    })
    .join("\n---\n\n");
}

/** Parses an export back, so a note file can move between devices by hand. */
export function fromMarkdown(text: string): Note[] {
  return text
    .split(/\n---\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const note = newNote();
      const lines = block.split("\n");
      if (lines[0]?.startsWith("# ")) {
        note.title = lines[0].slice(2).trim();
        note.body = lines
          .slice(1)
          .join("\n")
          .replace(/^\s*_Last edited [\d-]+_\s*/, "")
          .trim();
      } else {
        note.body = block;
      }
      return note;
    });
}
