"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { ErrorState, SuccessNote } from "@/components/ui/Feedback";
import {
  addElements,
  duplicateElements,
  emptyBoard,
  emptyDoc,
  newId,
  nodeIndex,
  patchElements,
  removeElements,
  reorderElements,
  translateElement,
  updateBoard,
  type Board,
  type Doc,
  type Element,
  type ImageEl,
  type Point,
  type ShapeKind,
  type Tool,
} from "@/lib/canvas/model";
import { boardBounds } from "@/lib/canvas/export";
import { CanvasParseError, parseCanvasFile } from "@/lib/canvas/parse";
import { copySelection, pasteClip, type Clip } from "@/lib/canvas/clipboard";
import { TEMPLATES, templateById } from "@/lib/canvas/templates";
import {
  copyPngToClipboard,
  downloadAllPng,
  downloadJson,
  downloadPng,
  downloadSvg,
  imageToElementSource,
} from "@/lib/canvas/download";
import { readLocal, tryWriteLocal } from "@/lib/utils/storage";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";
import { useHistory } from "../useHistory";
import { CanvasStage, clampZoom, type Viewport } from "./CanvasStage";
import { CanvasInspector } from "./CanvasInspector";
import { CanvasPalette, DRAW_TOOLS, SHAPE_KEYS, ShapeThumb, isNodeTool } from "./CanvasPalette";
import { CanvasContextMenu, type MenuItem } from "./ContextMenu";
import { DEFAULT_STYLES, type Styles } from "./styles";
import { cn } from "@/lib/utils/cn";

const STORAGE_KEY = "canvas";
/** What the two tools this one replaced autosaved under. */
const LEGACY_KEYS = ["whiteboard", "diagram-maker"];

/**
 * `.do-input` is unlayered CSS with `width: 100%`, so a Tailwind `w-auto`
 * utility loses to it. Inline styles are the reliable way to make a toolbar
 * dropdown compact.
 */
const TOOLBAR_SELECT: React.CSSProperties = {
  width: "auto",
  height: "2.25rem",
  padding: "0 2rem 0 0.75rem",
  fontSize: "0.75rem",
};

export function CanvasTool() {
  const history = useHistory<Doc>(React.useMemo(() => emptyDoc(), []));
  const doc = history.present;

  const [boardId, setBoardId] = React.useState(doc.boards[0].id);
  const [tool, setTool] = React.useState<Tool>("select");
  const [styles, setStyles] = React.useState<Styles>(DEFAULT_STYLES);
  const [selection, setSelection] = React.useState<string[]>([]);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [view, setView] = React.useState<Viewport>({ x: -60, y: -60, zoom: 1 });
  const [canvasSize, setCanvasSize] = React.useState({ w: 900, h: 560 });
  const [error, setError] = React.useState<string | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [pngScale, setPngScale] = React.useState(2);
  const [clip, setClip] = React.useState<Clip | null>(null);
  const [menu, setMenu] = React.useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [paletteDrag, setPaletteDrag] = React.useState<ShapeKind | null>(null);
  const [ghost, setGhost] = React.useState<Point | null>(null);

  const fileRef = React.useRef<HTMLInputElement>(null);
  const imageRef = React.useRef<HTMLInputElement>(null);
  const restored = React.useRef(false);
  const completed = React.useRef(false);
  const quotaWarned = React.useRef(false);

  const board = doc.boards.find((b) => b.id === boardId) ?? doc.boards[0];
  const selected = React.useMemo(
    () => board.elements.filter((el) => selection.includes(el.id)),
    [board.elements, selection],
  );

  const onSize = React.useCallback((size: { w: number; h: number }) => setCanvasSize(size), []);

  function note(message: string) {
    setError(null);
    setFlash(message);
    if (!completed.current) {
      completed.current = true;
      track("tool_complete", { tool: "canvas" });
      recordCompletion();
    }
  }

  React.useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 2400);
    return () => window.clearTimeout(timer);
  }, [flash]);

  /* ------------------------------- persistence ------------------------------ */

  // Restoring has to wait for the client: the server render must stay stable.
  React.useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    // Whatever was left open in the whiteboard or the diagram editor is
    // carried over the first time this tool runs, so a merge costs nobody
    // their work in progress.
    const keys = [STORAGE_KEY, ...LEGACY_KEYS];
    for (const key of keys) {
      const saved = readLocal<unknown>(key, null);
      if (!saved) continue;
      try {
        history.reset(parseCanvasFile(JSON.stringify(saved)));
        // No need to pick a board: `board` falls back to the first one
        // whenever the remembered id is not in the restored document.
        return;
      } catch {
        // A corrupted autosave should never block the tool from opening.
      }
    }
  }, [history]);

  React.useEffect(() => {
    if (!restored.current) return;
    const timer = window.setTimeout(() => {
      const ok = tryWriteLocal(STORAGE_KEY, doc);
      // Pictures are held inside the document, so a big board can genuinely
      // outgrow the browser's quota. Say so once rather than losing work quietly.
      if (!ok && !quotaWarned.current) {
        quotaWarned.current = true;
        setError(
          "This canvas is now too large for your browser to keep automatically — press Save to download a copy so you do not lose it.",
        );
      }
      if (ok) quotaWarned.current = false;
    }, 600);
    return () => window.clearTimeout(timer);
  }, [doc]);

  /* --------------------------------- editing -------------------------------- */

  const editBoard = React.useCallback(
    (change: (board: Board) => Board) => history.commit((d) => updateBoard(d, board.id, change)),
    [history, board.id],
  );

  const deleteSelection = React.useCallback(() => {
    if (!selection.length) return;
    const ids = selection;
    editBoard((b) => removeElements(b, ids));
    setSelection([]);
    setEditing(null);
  }, [editBoard, selection]);

  const duplicateSelection = React.useCallback(() => {
    if (!selection.length) return;
    // Worked out here rather than inside the updater: React runs an updater
    // when it processes the update, which is after this function has
    // returned, so ids collected in there would still be empty.
    const result = duplicateElements(board, selection);
    history.commit((d) => updateBoard(d, board.id, () => result.board));
    setSelection(result.ids);
  }, [history, board, selection]);

  const copy = React.useCallback(() => {
    const copied = copySelection(board, selection);
    if (!copied) return;
    setClip(copied);
    const n = copied.elements.length;
    setFlash(`Copied ${n} item${n === 1 ? "" : "s"}.`);
  }, [board, selection]);

  const cut = React.useCallback(() => {
    const copied = copySelection(board, selection);
    if (!copied) return;
    setClip(copied);
    deleteSelection();
  }, [board, selection, deleteSelection]);

  const paste = React.useCallback(
    (at?: Point) => {
      if (!clip?.elements.length) return;
      const result = pasteClip(board, clip, at);
      history.commit((d) => updateBoard(d, board.id, () => result.board));
      setSelection(result.ids);
      setTool("select");
    },
    [clip, history, board],
  );

  const patchSelection = React.useCallback(
    (change: (el: Element) => Element) => editBoard((b) => patchElements(b, selection, change)),
    [editBoard, selection],
  );

  const reorder = React.useCallback(
    (to: "front" | "forward" | "backward" | "back") =>
      editBoard((b) => reorderElements(b, selection, to)),
    [editBoard, selection],
  );

  const nudge = React.useCallback(
    (dx: number, dy: number) => {
      if (!selection.length) return;
      const ids = new Set(selection);
      editBoard((b) => ({
        ...b,
        elements: b.elements.map((el) => (ids.has(el.id) ? translateElement(el, dx, dy) : el)),
      }));
    },
    [editBoard, selection],
  );

  const fitToView = React.useCallback(() => {
    const box = boardBounds(board, 48);
    const zoom = clampZoom(Math.min(canvasSize.w / box.w, canvasSize.h / box.h));
    setView({
      zoom,
      x: box.x + box.w / 2 - canvasSize.w / zoom / 2,
      y: box.y + box.h / 2 - canvasSize.h / zoom / 2,
    });
  }, [board, canvasSize]);

  /* --------------------------------- images --------------------------------- */

  const addImages = React.useCallback(
    async (files: File[], at: Point) => {
      const pictures = files.filter((f) => f.type.startsWith("image/"));
      if (!pictures.length) return;
      setBusy(true);
      try {
        const added: ImageEl[] = [];
        let offset = 0;
        for (const file of pictures.slice(0, 8)) {
          const { href, w, h } = await imageToElementSource(file);
          // Dropped pictures land centred on the pointer, stacked slightly.
          added.push({
            id: newId("i"),
            type: "image",
            x: at.x - w / 2 + offset,
            y: at.y - h / 2 + offset,
            w,
            h,
            href,
            alt: file.name.slice(0, 120),
          });
          offset += 24;
        }
        editBoard((b) => addElements(b, added));
        setSelection(added.map((a) => a.id));
        setTool("select");
        note(`Added ${added.length} picture${added.length === 1 ? "" : "s"}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "That picture could not be added.");
      } finally {
        setBusy(false);
      }
    },
    [editBoard],
  );

  const centreOfBoard = React.useCallback((): Point => {
    const box = boardBounds(board, 0);
    return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  }, [board]);

  // Pasting: a picture from the system clipboard, or elements copied here.
  React.useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length) {
        event.preventDefault();
        void addImages(files, centreOfBoard());
        return;
      }
      if (clip?.elements.length) {
        event.preventDefault();
        paste();
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addImages, centreOfBoard, clip, paste]);

  /* -------------------------------- shortcuts ------------------------------- */

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // Never steal a key from a field the visitor is typing in.
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (mod && key === "y") { event.preventDefault(); history.redo(); return; }
      if (mod && key === "c") { event.preventDefault(); copy(); return; }
      if (mod && key === "x") { event.preventDefault(); cut(); return; }
      if (mod && key === "d") { event.preventDefault(); duplicateSelection(); return; }
      if (mod && key === "a") {
        event.preventDefault();
        setSelection(board.elements.map((el) => el.id));
        setTool("select");
        return;
      }
      // ⌘V is handled by the paste listener, which also catches screenshots.
      if (mod) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
        return;
      }
      if (event.key === "Escape") {
        setSelection([]);
        setEditing(null);
        setTool("select");
        setMenu(null);
        return;
      }
      if (event.key === "Enter" && selection.length === 1) {
        event.preventDefault();
        setEditing(selection[0]);
        return;
      }

      const shape = (Object.keys(SHAPE_KEYS) as ShapeKind[]).find(
        (kind) => SHAPE_KEYS[kind]?.toLowerCase() === key,
      );
      if (shape) {
        setTool({ node: shape });
        return;
      }
      const draw = DRAW_TOOLS.find((t) => t.key.toLowerCase() === key);
      if (draw) {
        setTool(draw.tool);
        return;
      }

      const step = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowUp") { event.preventDefault(); nudge(0, -step); }
      if (event.key === "ArrowDown") { event.preventDefault(); nudge(0, step); }
      if (event.key === "ArrowLeft") { event.preventDefault(); nudge(-step, 0); }
      if (event.key === "ArrowRight") { event.preventDefault(); nudge(step, 0); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [history, board.elements, selection, copy, cut, duplicateSelection, deleteSelection, nudge]);

  /* ------------------------------ palette drag ------------------------------ */

  function startShapeDrag(kind: ShapeKind, event: React.PointerEvent) {
    setPaletteDrag(kind);
    setGhost({ x: event.clientX, y: event.clientY });
  }

  React.useEffect(() => {
    if (!paletteDrag) return;
    const move = (event: PointerEvent) => setGhost({ x: event.clientX, y: event.clientY });
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [paletteDrag]);

  const endShapeDrag = React.useCallback(() => {
    setPaletteDrag(null);
    setGhost(null);
  }, []);

  /* ---------------------------------- boards -------------------------------- */

  function addBoard() {
    const next = emptyBoard(`Board ${doc.boards.length + 1}`);
    history.commit((d) => ({ ...d, boards: [...d.boards, next] }));
    setBoardId(next.id);
    setSelection([]);
  }

  function duplicateBoard() {
    // Ids are remapped, so the copy's connectors point at the copied shapes
    // rather than back at the originals.
    const copyBoard: Board = {
      ...board,
      id: newId("b"),
      name: `${board.name} copy`,
      elements: duplicateElements(board, board.elements.map((el) => el.id), 0).board.elements.slice(
        board.elements.length,
      ),
    };
    history.commit((d) => {
      const index = d.boards.findIndex((b) => b.id === board.id);
      const boards = [...d.boards];
      boards.splice(index + 1, 0, copyBoard);
      return { ...d, boards };
    });
    setBoardId(copyBoard.id);
    setSelection([]);
  }

  function deleteBoard(id: string) {
    if (doc.boards.length === 1) {
      // The last board is emptied rather than removed: there has to be
      // something to draw on.
      history.commit((d) => updateBoard(d, id, (b) => ({ ...b, elements: [] })));
      setSelection([]);
      return;
    }
    const index = doc.boards.findIndex((b) => b.id === id);
    history.commit((d) => ({ ...d, boards: d.boards.filter((b) => b.id !== id) }));
    const fallback = doc.boards[index === 0 ? 1 : index - 1];
    if (id === board.id) setBoardId(fallback.id);
    setSelection([]);
  }

  /* ------------------------------ files in and out ---------------------------- */

  async function withBusy(what: () => Promise<void>) {
    setBusy(true);
    try {
      await what();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  function importFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const loaded = parseCanvasFile(String(reader.result ?? ""));
        history.reset(loaded);
        setBoardId(loaded.boards[0].id);
        setSelection([]);
        setError(null);
        setFlash(`Opened “${loaded.name}”.`);
      } catch (err) {
        setError(
          err instanceof CanvasParseError
            ? err.message
            : "That file could not be opened as a canvas.",
        );
      }
    };
    reader.onerror = () => setError("That file could not be read.");
    reader.readAsText(file);
  }

  /** A template replaces what is on the current board, never the whole file. */
  function applyTemplate(id: string) {
    const template = templateById(id);
    if (!template) return;
    const built = template.build();
    history.commit((d) =>
      updateBoard(d, board.id, (b) => ({
        ...b,
        name: b.elements.length ? b.name : built.name,
        paper: built.paper,
        paperColor: built.paperColor,
        grid: built.grid,
        elements: built.elements,
      })),
    );
    setSelection([]);
    setTool("select");
  }

  /* ------------------------------- context menu ------------------------------ */

  function openMenu(at: Point, screen: Point, target: Element | null) {
    if (target && !selection.includes(target.id)) setSelection([target.id]);
    const ids = target && !selection.includes(target.id) ? [target.id] : selection;

    const items: MenuItem[] = target
      ? [
          {
            label: target.type === "edge" ? "Add a label" : "Edit text",
            hint: "Enter",
            onSelect: () => setEditing(target.id),
            disabled: target.type === "image" || target.type === "stroke" || target.type === "line",
          },
          { label: "Copy", hint: "⌘C", onSelect: copy },
          { label: "Cut", hint: "⌘X", onSelect: cut },
          { label: "Duplicate", hint: "⌘D", onSelect: duplicateSelection },
          { label: "Bring to front", onSelect: () => editBoard((b) => reorderElements(b, ids, "front")) },
          { label: "Send to back", onSelect: () => editBoard((b) => reorderElements(b, ids, "back")) },
          {
            label: "Delete",
            hint: "⌫",
            onSelect: () => {
              editBoard((b) => removeElements(b, ids));
              setSelection([]);
            },
            danger: true,
          },
        ]
      : [
          { label: "Paste here", hint: "⌘V", onSelect: () => paste(at), disabled: !clip?.elements.length },
          {
            label: "Select everything",
            hint: "⌘A",
            onSelect: () => {
              setSelection(board.elements.map((el) => el.id));
              setTool("select");
            },
          },
          { label: "Add a picture", onSelect: () => imageRef.current?.click() },
          {
            label: "Clear this board",
            onSelect: () => {
              editBoard((b) => ({ ...b, elements: [] }));
              setSelection([]);
            },
            danger: true,
          },
        ];
    setMenu({ x: screen.x, y: screen.y, items });
  }

  /* --------------------------------- render --------------------------------- */

  const zoomPercent = Math.round(view.zoom * 100);
  const nodeCount = React.useMemo(() => nodeIndex(board.elements).size, [board.elements]);

  const hint = isNodeTool(tool)
    ? "Click the canvas to drop the shape, or drag to size it as you place it."
    : tool === "select"
      ? "Hover a shape and click a blue arrow to add the next one · drag an arrow onto another shape to link them · right-click for more"
      : tool === "laser"
        ? "Drag to point things out. The trail fades on its own and is never saved."
        : `Drag on the canvas to draw. Press V to go back to selecting.`;

  const palette = (horizontal: boolean) => (
    <CanvasPalette
      tool={tool}
      onTool={setTool}
      onShapeDragStart={startShapeDrag}
      onPickImage={() => imageRef.current?.click()}
      horizontal={horizontal}
    />
  );

  return (
    <div className="space-y-3">
      {/* -------------------------------- toolbar ------------------------------- */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-2">
        <Button tone="panel" size="sm" onClick={history.undo} disabled={!history.canUndo}>
          ↶ Undo
        </Button>
        <Button tone="panel" size="sm" onClick={history.redo} disabled={!history.canRedo}>
          ↷ Redo
        </Button>

        <span className="mx-1 h-6 w-px bg-[var(--border)]" aria-hidden />

        <Button
          tone="panel"
          size="sm"
          onClick={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom / 1.2) }))}
          aria-label="Zoom out"
        >
          −
        </Button>
        <span className="min-w-[3.5rem] text-center text-xs font-extrabold tabular-nums text-[var(--muted)]">
          {zoomPercent}%
        </span>
        <Button
          tone="panel"
          size="sm"
          onClick={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom * 1.2) }))}
          aria-label="Zoom in"
        >
          +
        </Button>
        <Button tone="panel" size="sm" onClick={fitToView}>
          Fit
        </Button>

        <span className="mx-1 h-6 w-px bg-[var(--border)]" aria-hidden />

        <Select
          value=""
          onChange={(e) => {
            if (e.target.value) applyTemplate(e.target.value);
            e.target.value = "";
          }}
          style={TOOLBAR_SELECT}
          aria-label="Start from a template"
        >
          <option value="">Templates…</option>
          {TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.icon} {template.name}
            </option>
          ))}
        </Select>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importFile(file);
              e.target.value = "";
            }}
          />
          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) void addImages(files, centreOfBoard());
              e.target.value = "";
            }}
          />
          <Button tone="panel" size="sm" onClick={() => fileRef.current?.click()}>
            Open file
          </Button>
          <Select
            value={String(pngScale)}
            onChange={(e) => setPngScale(Number(e.target.value))}
            style={TOOLBAR_SELECT}
            aria-label="PNG resolution"
          >
            <option value="1">1× PNG</option>
            <option value="2">2× PNG</option>
            <option value="3">3× PNG</option>
            <option value="4">4× PNG</option>
          </Select>
          <Button
            tone="panel"
            size="sm"
            disabled={busy}
            onClick={() =>
              withBusy(async () => {
                await copyPngToClipboard(board, pngScale);
                note("Board copied — paste it anywhere.");
              })
            }
          >
            Copy
          </Button>
          <Button
            tone="sky"
            size="sm"
            onClick={() => {
              downloadSvg(board);
              note("SVG downloaded.");
            }}
          >
            SVG
          </Button>
          <Button
            tone="panel"
            size="sm"
            onClick={() => {
              downloadJson(doc);
              note("Saved a re-editable copy of every board.");
            }}
          >
            Save
          </Button>
          {doc.boards.length > 1 ? (
            <Button
              tone="panel"
              size="sm"
              disabled={busy}
              onClick={() =>
                withBusy(async () => {
                  const n = await downloadAllPng(doc, pngScale);
                  note(`Zipped ${n} board${n === 1 ? "" : "s"} as PNGs.`);
                })
              }
            >
              All as ZIP
            </Button>
          ) : null}
          <Button
            tone="grass"
            size="sm"
            disabled={busy}
            onClick={() =>
              withBusy(async () => {
                await downloadPng(board, pngScale);
                note(`PNG downloaded at ${pngScale}× size.`);
              })
            }
          >
            {busy ? "Working…" : "Download PNG"}
          </Button>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {flash ? <SuccessNote>{flash}</SuccessNote> : null}

      <div className="lg:hidden">{palette(true)}</div>

      <div className="grid h-[min(76vh,800px)] min-h-[460px] grid-cols-1 gap-3 lg:grid-cols-[152px_minmax(0,1fr)_282px]">
        <div className="hidden min-h-0 lg:block">{palette(false)}</div>

        <div className="relative flex min-h-0 min-w-0 flex-col gap-2">
          <CanvasStage
            history={history}
            boardId={board.id}
            tool={tool}
            onToolChange={setTool}
            styles={styles}
            selection={selection}
            onSelectionChange={setSelection}
            view={view}
            onViewChange={setView}
            onSize={onSize}
            onFiles={(files, at) => void addImages(files, at)}
            onContextMenu={openMenu}
            editing={editing}
            onEditingChange={setEditing}
            paletteDrag={paletteDrag}
            onPaletteDragEnd={endShapeDrag}
          />
          {menu ? (
            <CanvasContextMenu
              x={menu.x}
              y={menu.y}
              bounds={canvasSize}
              items={menu.items}
              onClose={() => setMenu(null)}
            />
          ) : null}

          {/* ------------------------------ boards ----------------------------- */}
          <div className="do-scroll flex shrink-0 items-center gap-1.5 overflow-x-auto rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-1.5">
            {doc.boards.map((b, i) => (
              <div key={b.id} className="flex shrink-0 items-center">
                {renaming === b.id ? (
                  <input
                    autoFocus
                    defaultValue={b.name}
                    onBlur={(e) => {
                      const name = e.target.value.trim() || b.name;
                      history.commit((d) => updateBoard(d, b.id, (x) => ({ ...x, name })));
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    className="w-32 rounded-xl border-2 border-[var(--sky)] bg-[var(--bg)] px-2 py-1.5 text-xs font-extrabold outline-none"
                    aria-label="Board name"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (b.id === board.id) setRenaming(b.id);
                      else {
                        setBoardId(b.id);
                        setSelection([]);
                      }
                    }}
                    title={b.id === boardId ? "Click again to rename" : `Go to ${b.name}`}
                    aria-current={b.id === board.id}
                    className={cn(
                      "rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold transition-colors",
                      b.id === board.id
                        ? "border-[var(--sky)] bg-[var(--sky-soft)]"
                        : "border-transparent text-[var(--muted)] hover:bg-[var(--bg)]",
                    )}
                  >
                    <span className="tabular-nums opacity-60">{i + 1}.</span> {b.name}
                  </button>
                )}
              </div>
            ))}
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <Button tone="panel" size="sm" onClick={addBoard}>
                + Board
              </Button>
              <Button tone="panel" size="sm" onClick={duplicateBoard}>
                Duplicate
              </Button>
              <Button tone="panel" size="sm" onClick={() => deleteBoard(board.id)}>
                {doc.boards.length === 1 ? "Clear" : "Delete"}
              </Button>
            </div>
          </div>
        </div>

        <div className="do-scroll min-h-0 overflow-y-auto lg:pr-1">
          <CanvasInspector
            board={board}
            docName={doc.name}
            selection={selected}
            tool={tool}
            styles={styles}
            onStyles={setStyles}
            onPatch={patchSelection}
            onReorder={reorder}
            onDuplicate={duplicateSelection}
            onDelete={deleteSelection}
            onEditText={setEditing}
            onBoard={(patch) => history.commit((d) => updateBoard(d, board.id, (b) => ({ ...b, ...patch })))}
            onDocName={(name) => history.commit((d) => ({ ...d, name }))}
          />
        </div>
      </div>

      <p className="text-xs font-semibold text-[var(--muted)]">
        {hint} · {nodeCount} shape{nodeCount === 1 ? "" : "s"} on this board · space or ⌘/Ctrl + drag
        to pan · ⌘/Ctrl + scroll to zoom
      </p>

      {/* The shape that follows the pointer while it is dragged off the palette. */}
      {paletteDrag && ghost ? (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 opacity-80"
          style={{ left: ghost.x, top: ghost.y }}
        >
          <ShapeThumb kind={paletteDrag} className="h-12 w-20 drop-shadow" />
        </div>
      ) : null}
    </div>
  );
}
