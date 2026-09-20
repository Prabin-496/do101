"use client";

import * as React from "react";
import {
  DIRECTIONS,
  DIRECTION_PORT,
  addElements,
  clampNode,
  drawOrder,
  edgeGeometry,
  elementsInRect,
  hitTest,
  inheritedStyle,
  newId,
  nodeIndex,
  nodeSize,
  normalizeRect,
  patchElements,
  removeElements,
  scaleElement,
  snap,
  spawnConnected,
  translateElement,
  unionBounds,
  updateBoard,
  type Board,
  type Direction,
  type Doc,
  type EdgeEl,
  type Element,
  type LineEl,
  type NodeEl,
  type Point,
  type Rect,
  type ShapeKind,
  type StrokeEl,
  type TextEl,
  type Tool,
} from "@/lib/canvas/model";
import { shouldSample, simplifyPoints, strokePath } from "@/lib/canvas/stroke";
import {
  FONT_STACK,
  NOTE_PADDING,
  PAPER_INK,
  PAPER_PATTERN,
  arrowColors,
  arrowHead,
  arrowSize,
  dashArray,
  edgeLabelWidth,
  fontFor,
  inkPath,
  isNoteLike,
  labelRows,
  linePath,
  markerId,
  nodeDetailPath,
  nodePath,
  strokeOpacity,
  textRows,
} from "@/lib/canvas/render";
import { snapToShapes, type Guide } from "@/lib/diagram/align";
import type { History } from "../useHistory";
import { isNodeTool } from "./CanvasPalette";
import type { Styles } from "./styles";
import { cn } from "@/lib/utils/cn";

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** Eight handles for a single node, four corners for anything else. */
export type NodeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export type Corner = "nw" | "ne" | "se" | "sw";

type Gesture =
  | { kind: "ink"; el: StrokeEl }
  | { kind: "line"; el: LineEl; from: Point }
  | { kind: "node"; el: NodeEl; from: Point; moved: boolean }
  | { kind: "erase"; ids: Set<string>; before: Doc }
  // `before` is the document as it was when the gesture started, so a whole
  // drag collapses into a single undo step.
  | { kind: "move"; ids: string[]; from: Point; before: Doc; originals: Element[] }
  | { kind: "scale"; handle: Corner; start: Rect; before: Doc; originals: Element[] }
  | { kind: "resize"; id: string; handle: NodeHandle; start: Rect; from: Point; before: Doc }
  | {
      kind: "connect";
      from: string;
      fromPort: ReturnType<() => (typeof DIRECTION_PORT)[Direction]>;
      /** Set when the gesture began on a direction arrow, which can also spawn. */
      direction: Direction | null;
      at: Point;
      over: string | null;
      moved: boolean;
    }
  | { kind: "marquee"; from: Point; to: Point }
  | { kind: "pan"; fromScreen: Point; fromView: Point };

interface LaserPoint extends Point {
  at: number;
}

/** How long a laser trail stays on screen. */
const LASER_MS = 1100;
/** How close two edges must be, in screen pixels, before they snap together. */
const SNAP_PIXELS = 6;
/** Pointer travel, in screen pixels, that turns a click into a drag. */
const DRAG_THRESHOLD = 5;

const HANDLE_CURSOR: Record<NodeHandle, string> = {
  nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize",
  n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
};

const LIVE_MARKER = "live-arrow";

export interface StageProps {
  history: History<Doc>;
  boardId: string;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  styles: Styles;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
  view: Viewport;
  onViewChange: (view: Viewport) => void;
  onSize?: (size: { w: number; h: number }) => void;
  /** Handed the files from a drop or a paste, with where they landed. */
  onFiles: (files: File[], at: Point) => void;
  onContextMenu?: (at: Point, screen: Point, target: Element | null) => void;
  /** The element whose text is being typed, if any. */
  editing: string | null;
  onEditingChange: (id: string | null) => void;
  /** A shape being dragged in from the palette. */
  paletteDrag: ShapeKind | null;
  onPaletteDragEnd: () => void;
}

export function CanvasStage(props: StageProps) {
  const {
    history, boardId, tool, onToolChange, styles, selection, onSelectionChange,
    view, onViewChange, onSize, onFiles, onContextMenu, editing, onEditingChange,
    paletteDrag, onPaletteDragEnd,
  } = props;

  const doc = history.present;
  const board = doc.boards.find((b) => b.id === boardId) ?? doc.boards[0];

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [size, setSize] = React.useState({ w: 900, h: 560 });
  const [gesture, setGesture] = React.useState<Gesture | null>(null);
  const [laser, setLaser] = React.useState<LaserPoint[]>([]);
  const [guides, setGuides] = React.useState<Guide[]>([]);
  const [hover, setHover] = React.useState<string | null>(null);
  const [spacePan, setSpacePan] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [dropAt, setDropAt] = React.useState<Point | null>(null);

  const index = React.useMemo(() => nodeIndex(board.elements), [board.elements]);
  const selectedSet = React.useMemo(() => new Set(selection), [selection]);

  // The SVG scales with its container, so the viewBox needs the pixel size.
  React.useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      const next = { w: Math.max(200, box.width), h: Math.max(200, box.height) };
      setSize(next);
      onSize?.(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onSize]);

  // Holding space turns the pointer into a hand, as in every canvas app.
  React.useEffect(() => {
    function down(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        setSpacePan(true);
      }
    }
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePan(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // The laser trail fades on its own, so it needs a frame loop while it exists.
  React.useEffect(() => {
    if (!laser.length) return;
    let frame = 0;
    const tick = () => {
      const now = performance.now();
      setLaser((points) => points.filter((p) => now - p.at < LASER_MS));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [laser.length]);

  const toWorld = React.useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: view.x + (event.clientX - rect.left) / view.zoom,
        y: view.y + (event.clientY - rect.top) / view.zoom,
      };
    },
    [view],
  );

  const toScreen = React.useCallback(
    (p: Point): Point => ({ x: (p.x - view.x) * view.zoom, y: (p.y - view.y) * view.zoom }),
    [view],
  );

  /** A grab tolerance that stays the same size on screen at any zoom. */
  const grab = 6 / view.zoom;

  const editBoard = React.useCallback(
    (change: (board: Board) => Board, mode: "commit" | "preview" = "commit") => {
      const apply = (d: Doc) => updateBoard(d, board.id, change);
      if (mode === "commit") history.commit(apply);
      else history.preview(apply);
    },
    [history, board.id],
  );

  /* ------------------------- dropping in from the palette ------------------------- */

  const placeNode = React.useCallback(
    (kind: ShapeKind, at: Point, box?: Rect): string => {
      const look = kind === "note"
        ? { fill: styles.note.fill, textColor: styles.note.textColor, fontSize: styles.note.fontSize, stroke: "transparent", strokeWidth: 0 }
        : styles.node;
      const size = nodeSize(kind);
      const rect = box ?? {
        x: snap(at.x - size.w / 2, board.grid),
        y: snap(at.y - size.h / 2, board.grid),
        w: size.w,
        h: size.h,
      };
      const node: NodeEl = {
        id: newId("n"),
        type: "node",
        kind,
        ...rect,
        text: "",
        fill: look.fill,
        stroke: look.stroke,
        strokeWidth: look.strokeWidth,
        dash: kind === "note" ? "solid" : styles.node.dash,
        fontSize: look.fontSize,
        textColor: look.textColor,
        bold: kind === "note" ? false : styles.node.bold,
      };
      editBoard((b) => addElements(b, [node]));
      onSelectionChange([node.id]);
      onEditingChange(node.id);
      return node.id;
    },
    [board.grid, editBoard, onEditingChange, onSelectionChange, styles],
  );

  React.useEffect(() => {
    if (!paletteDrag) return;
    function inside(event: PointerEvent): boolean {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return false;
      return (
        event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom
      );
    }
    function move(event: PointerEvent) {
      setDropAt(inside(event) ? toWorld(event) : null);
    }
    function up(event: PointerEvent) {
      if (inside(event) && paletteDrag) {
        placeNode(paletteDrag, toWorld(event));
        onToolChange("select");
      }
      onPaletteDragEnd();
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      // Cleared on the way out, so the next drag cannot flash the old spot.
      setDropAt(null);
    };
  }, [paletteDrag, toWorld, onPaletteDragEnd, placeNode, onToolChange]);

  /* -------------------------------- creating -------------------------------- */

  function beginInk(at: Point, kind: "pen" | "highlighter"): Gesture {
    const look = kind === "pen" ? styles.pen : styles.highlighter;
    return {
      kind: "ink",
      el: { id: newId("k"), type: "stroke", kind, points: [at], color: look.color, width: look.width },
    };
  }

  function beginLine(at: Point, arrow: boolean): Gesture {
    return {
      kind: "line",
      from: at,
      el: {
        id: newId("l"),
        type: "line",
        from: at,
        to: at,
        color: styles.line.color,
        width: styles.line.width,
        dash: styles.line.dash,
        arrowStart: arrow ? styles.line.arrowStart : false,
        arrowEnd: arrow ? styles.line.arrowEnd : false,
      },
    };
  }

  function beginNode(at: Point, kind: ShapeKind): Gesture {
    const look = kind === "note"
      ? { fill: styles.note.fill, textColor: styles.note.textColor, fontSize: styles.note.fontSize, stroke: "transparent", strokeWidth: 0 }
      : styles.node;
    return {
      kind: "node",
      from: at,
      moved: false,
      el: {
        id: newId("n"),
        type: "node",
        kind,
        x: at.x,
        y: at.y,
        w: 0,
        h: 0,
        text: "",
        fill: look.fill,
        stroke: look.stroke,
        strokeWidth: look.strokeWidth,
        dash: kind === "note" ? "solid" : styles.node.dash,
        fontSize: look.fontSize,
        textColor: look.textColor,
        bold: kind === "note" ? false : styles.node.bold,
      },
    };
  }

  function placeText(at: Point) {
    const el: TextEl = {
      id: newId("t"),
      type: "text",
      x: at.x,
      y: at.y,
      w: 240,
      h: styles.text.size * 1.3,
      text: "",
      color: styles.text.color,
      size: styles.text.size,
      bold: styles.text.bold,
    };
    editBoard((b) => addElements(b, [el]));
    onSelectionChange([el.id]);
    onEditingChange(el.id);
    onToolChange("select");
  }

  /* -------------------------------- pointer -------------------------------- */

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button === 1 || spacePan || (event.button === 0 && (event.metaKey || event.ctrlKey))) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setGesture({
        kind: "pan",
        fromScreen: { x: event.clientX, y: event.clientY },
        fromView: { x: view.x, y: view.y },
      });
      return;
    }
    if (event.button !== 0) return;

    const at = toWorld(event);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (isNodeTool(tool)) {
      setGesture(beginNode(at, tool.node));
      return;
    }

    switch (tool) {
      case "pen":
      case "highlighter":
        setGesture(beginInk(at, tool));
        return;
      case "laser":
        setLaser((points) => [...points, { ...at, at: performance.now() }]);
        setGesture({
          kind: "ink",
          el: { id: "laser", type: "stroke", kind: "pen", points: [at], color: "#ff4b4b", width: 4 },
        });
        return;
      case "eraser": {
        const hit = hitTest(board.elements, at, styles.eraserSize / 2, index);
        setGesture({ kind: "erase", ids: new Set(hit ? [hit.id] : []), before: doc });
        return;
      }
      case "line":
      case "arrow":
        setGesture(beginLine(at, tool === "arrow"));
        return;
      case "text":
        placeText(at);
        return;
      default:
        break;
    }

    // Select.
    const hit = hitTest(board.elements, at, grab, index);
    if (hit) {
      const next = event.shiftKey
        ? selectedSet.has(hit.id)
          ? selection.filter((id) => id !== hit.id)
          : [...selection, hit.id]
        : selectedSet.has(hit.id)
          ? selection
          : [hit.id];
      onSelectionChange(next);
      const wanted = new Set(next);
      setGesture({
        kind: "move",
        ids: next,
        from: at,
        before: doc,
        originals: board.elements.filter((el) => wanted.has(el.id)).map((el) => ({ ...el })),
      });
      return;
    }

    if (!event.shiftKey) onSelectionChange([]);
    onEditingChange(null);
    setGesture({ kind: "marquee", from: at, to: at });
  }

  /**
   * Moving a selection.
   *
   * Nodes are pulled onto the grid and onto their neighbours' edges; ink and
   * pictures move freely, because a sketch that jumps to a grid feels broken.
   */
  function moveSelection(g: Extract<Gesture, { kind: "move" }>, at: Point, shiftKey: boolean) {
    let dx = at.x - g.from.x;
    let dy = at.y - g.from.y;

    // Shift locks the move to whichever axis the pointer has travelled furthest.
    if (shiftKey) {
      if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
      else dx = 0;
    }

    const hasNode = g.originals.some((el) => el.type === "node");
    let aligned = false;

    if (hasNode) {
      const moving = unionBounds(
        g.originals.map((el) => translateElement(el, dx, dy)),
        0,
        index,
      );
      const others = board.elements
        .filter((el): el is NodeEl => el.type === "node" && !g.ids.includes(el.id))
        .map((el): Rect => ({ x: el.x, y: el.y, w: el.w, h: el.h }));

      if (moving) {
        const snapped = snapToShapes(moving, others, SNAP_PIXELS / view.zoom);
        aligned = snapped.guides.length > 0;
        setGuides(snapped.guides);
        if (aligned) {
          dx += snapped.dx;
          dy += snapped.dy;
        } else if (board.grid > 0) {
          // A guide wins over the grid, otherwise the grid pulls it back off.
          dx += snap(moving.x, board.grid) - moving.x;
          dy += snap(moving.y, board.grid) - moving.y;
        }
      }
    }

    const byId = new Map(g.originals.map((el) => [el.id, el]));
    editBoard(
      (b) => ({
        ...b,
        elements: b.elements.map((el) => {
          const original = byId.get(el.id);
          return original ? translateElement(original, dx, dy) : el;
        }),
      }),
      "preview",
    );
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!gesture) {
      if (tool === "select") {
        const hit = hitTest(board.elements, toWorld(event), grab, index);
        setHover(hit && hit.type === "node" ? hit.id : null);
      }
      return;
    }

    if (gesture.kind === "pan") {
      onViewChange({
        ...view,
        x: gesture.fromView.x - (event.clientX - gesture.fromScreen.x) / view.zoom,
        y: gesture.fromView.y - (event.clientY - gesture.fromScreen.y) / view.zoom,
      });
      return;
    }

    const at = toWorld(event);

    switch (gesture.kind) {
      case "ink": {
        const last = gesture.el.points[gesture.el.points.length - 1];
        if (!shouldSample(last, at, 1.6 / view.zoom)) return;
        if (tool === "laser") {
          setLaser((points) => [...points, { ...at, at: performance.now() }]);
          return;
        }
        setGesture({ ...gesture, el: { ...gesture.el, points: [...gesture.el.points, at] } });
        return;
      }

      case "line": {
        // Shift snaps a line to the nearest 45°, which is what makes hand-drawn
        // arrows line up with each other.
        const to = event.shiftKey ? snapAngle(gesture.from, at) : at;
        setGesture({ ...gesture, el: { ...gesture.el, to } });
        return;
      }

      case "node": {
        const box = normalizeRect(gesture.from, at);
        const square = event.shiftKey ? Math.max(box.w, box.h) : 0;
        const moved =
          gesture.moved || Math.hypot(at.x - gesture.from.x, at.y - gesture.from.y) * view.zoom > DRAG_THRESHOLD;
        setGesture({
          ...gesture,
          moved,
          el: {
            ...gesture.el,
            x: at.x < gesture.from.x && square ? gesture.from.x - square : box.x,
            y: at.y < gesture.from.y && square ? gesture.from.y - square : box.y,
            w: square || box.w,
            h: square || box.h,
          },
        });
        return;
      }

      case "erase": {
        const hit = hitTest(board.elements, at, styles.eraserSize / 2, index);
        if (hit && !gesture.ids.has(hit.id)) {
          const ids = new Set(gesture.ids);
          ids.add(hit.id);
          setGesture({ ...gesture, ids });
        }
        return;
      }

      case "move":
        moveSelection(gesture, at, event.shiftKey);
        return;

      case "resize": {
        const next = resizeNode(gesture.start, gesture.handle, at, gesture.from, board.grid, event.shiftKey);
        editBoard(
          (b) => ({
            ...b,
            elements: b.elements.map((el) => (el.id === gesture.id ? { ...el, ...next } : el)),
          }),
          "preview",
        );
        return;
      }

      case "scale": {
        const to = scaleBox(gesture.start, gesture.handle, at, event.shiftKey);
        const originals = gesture.originals;
        editBoard(
          (b) => ({
            ...b,
            elements: b.elements.map((el) => {
              const original = originals.find((o) => o.id === el.id);
              return original ? scaleElement(original, gesture.start, to) : el;
            }),
          }),
          "preview",
        );
        return;
      }

      case "connect": {
        const over = hitTest(board.elements, at, grab, index);
        const travelled = Math.hypot(at.x - gesture.at.x, at.y - gesture.at.y) * view.zoom;
        setGesture({
          ...gesture,
          at,
          over: over && over.type === "node" && over.id !== gesture.from ? over.id : null,
          moved: gesture.moved || travelled > DRAG_THRESHOLD,
        });
        return;
      }

      default:
        setGesture({ ...gesture, to: at });
    }
  }

  function finishConnect(g: Extract<Gesture, { kind: "connect" }>) {
    // A click on a direction arrow, with no drag, adds a node that way.
    if (!g.moved && g.direction) {
      // Worked out here rather than inside the updater: React runs an updater
      // when it processes the update, which is after this function has
      // returned, so an id collected in there would never arrive in time.
      const result = spawnConnected(board, g.from, g.direction);
      if (!result) return;
      editBoard(() => result.board);
      onSelectionChange([result.id]);
      onEditingChange(result.id);
      return;
    }

    if (g.over) {
      const target = g.over;
      const exists = board.elements.some(
        (el) => el.type === "edge" && el.from === g.from && el.to === target,
      );
      if (exists) return;
      const edge: EdgeEl = {
        id: newId("c"),
        type: "edge",
        from: g.from,
        to: target,
        fromPort: g.fromPort,
        toPort: "auto",
        label: "",
        ...styles.edge,
      };
      editBoard((b) => addElements(b, [edge]));
      onSelectionChange([edge.id]);
      return;
    }

    // Dropped on empty space: make the node that was clearly wanted there.
    if (!g.moved) return;
    const source = index.get(g.from);
    if (!source) return;

    const kind = source.kind === "diamond" ? "rounded" : source.kind;
    const size = nodeSize(kind);
    const node: NodeEl = {
      ...source,
      ...inheritedStyle(source),
      id: newId("n"),
      kind,
      text: "",
      x: snap(g.at.x - size.w / 2, board.grid),
      y: snap(g.at.y - size.h / 2, board.grid),
      w: size.w,
      h: size.h,
    };
    const edge: EdgeEl = {
      id: newId("c"),
      type: "edge",
      from: g.from,
      to: node.id,
      fromPort: g.fromPort,
      toPort: "auto",
      label: "",
      ...styles.edge,
    };
    editBoard((b) => addElements(b, [node, edge]));
    onSelectionChange([node.id]);
    onEditingChange(node.id);
  }

  function onPointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (!gesture) return;
    setGuides([]);

    switch (gesture.kind) {
      case "ink":
        if (tool !== "laser") {
          // Simplifying at the end keeps the file small without making the
          // line lag while it is being drawn.
          const points = simplifyPoints(gesture.el.points, 0.5 / view.zoom);
          if (points.length) editBoard((b) => addElements(b, [{ ...gesture.el, points }]));
        }
        break;

      case "line": {
        const el = gesture.el;
        // A stray click should not leave an invisible speck on the board.
        if (Math.hypot(el.to.x - el.from.x, el.to.y - el.from.y) > 4) {
          editBoard((b) => addElements(b, [el]));
          onSelectionChange([el.id]);
        }
        onToolChange("select");
        break;
      }

      case "node": {
        const el = gesture.el;
        // A click places the shape at its natural size; a drag sizes it.
        if (gesture.moved && el.w > 8 && el.h > 8) {
          const sized: NodeEl = {
            ...el,
            x: snap(el.x, board.grid),
            y: snap(el.y, board.grid),
            w: clampNode(el.w),
            h: clampNode(el.h),
          };
          editBoard((b) => addElements(b, [sized]));
          onSelectionChange([sized.id]);
          onEditingChange(sized.id);
        } else {
          placeNode(el.kind, gesture.from);
        }
        onToolChange("select");
        break;
      }

      case "erase":
        if (gesture.ids.size) {
          const ids = [...gesture.ids];
          editBoard((b) => removeElements(b, ids));
        }
        break;

      case "move":
      case "resize":
      case "scale":
        history.seal(gesture.before);
        break;

      case "connect":
        finishConnect(gesture);
        break;

      case "marquee": {
        const box = normalizeRect(gesture.from, gesture.to);
        if (box.w > 4 || box.h > 4) {
          const inside = elementsInRect(board.elements, box, index).map((el) => el.id);
          onSelectionChange(event.shiftKey ? [...new Set([...selection, ...inside])] : inside);
        }
        break;
      }

      default:
        break;
    }

    setGesture(null);
  }

  function onWheel(event: React.WheelEvent<SVGSVGElement>) {
    if (!event.ctrlKey && !event.metaKey) {
      onViewChange({ ...view, x: view.x + event.deltaX / view.zoom, y: view.y + event.deltaY / view.zoom });
      return;
    }
    // Ctrl/⌘ + wheel zooms about the pointer, like every map and canvas app.
    const anchor = toWorld(event);
    const zoom = clampZoom(view.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1));
    onViewChange({
      zoom,
      x: anchor.x - (anchor.x - view.x) * (view.zoom / zoom),
      y: anchor.y - (anchor.y - view.y) * (view.zoom / zoom),
    });
  }

  /* -------------------------------- rendering ------------------------------- */

  const selected = board.elements.filter((el) => selectedSet.has(el.id));
  const singleNode = selected.length === 1 && selected[0].type === "node" ? selected[0] : null;
  const onlyEdges = selected.length > 0 && selected.every((el) => el.type === "edge");
  const frameBox =
    singleNode || onlyEdges || !selected.length ? null : unionBounds(selected, 6 / view.zoom, index);

  // While a link is being dragged the source keeps its arrows, so the element
  // under the pointer is never unmounted mid-gesture.
  const arrowTarget =
    gesture?.kind === "connect"
      ? index.get(gesture.from) ?? null
      : gesture
        ? null
        : (singleNode ?? (hover ? index.get(hover) ?? null : null));

  const editingEl = editing ? board.elements.find((el) => el.id === editing) ?? null : null;
  const erasing = gesture?.kind === "erase" ? gesture.ids : null;

  const cursor =
    gesture?.kind === "pan" || spacePan
      ? gesture?.kind === "pan"
        ? "cursor-grabbing"
        : "cursor-grab"
      : tool === "select"
        ? "cursor-default"
        : tool === "eraser"
          ? "cursor-cell"
          : tool === "text"
            ? "cursor-text"
            : "cursor-crosshair";

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative h-full min-h-[340px] w-full overflow-hidden rounded-2xl border-2",
        dragOver ? "border-[var(--grass)]" : "border-[var(--border)]",
      )}
      style={{ background: board.paperColor }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length) onFiles(files, toWorld(event));
      }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${view.x} ${view.y} ${size.w / view.zoom} ${size.h / view.zoom}`}
        className={cn("block touch-none", cursor)}
        onPointerDown={onPointerDown}
        // The default mousedown action moves focus, which blurred — and so
        // closed — a text box opened by that very click.
        onMouseDown={(event) => event.preventDefault()}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onContextMenu={(event) => {
          if (!onContextMenu) return;
          event.preventDefault();
          const rect = wrapRef.current?.getBoundingClientRect();
          if (!rect) return;
          const at = toWorld(event);
          onContextMenu(
            at,
            { x: event.clientX - rect.left, y: event.clientY - rect.top },
            hitTest(board.elements, at, grab, index),
          );
        }}
        role="application"
        aria-label={`Canvas — ${board.name}, ${board.elements.length} items`}
      >
        <Paper board={board} view={view} size={size} />

        <defs>
          {arrowColors(board.elements).map((color) => (
            <marker
              key={color}
              id={markerId(color, LIVE_MARKER)}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          ))}
        </defs>

        {drawOrder(board.elements).map((el) => (
          <ElementView
            key={el.id}
            el={el}
            index={index}
            selected={selectedSet.has(el.id)}
            dimmed={erasing?.has(el.id) ?? false}
            hidden={el.id === editing}
            zoom={view.zoom}
            onDoubleClick={() => onEditingChange(el.id)}
          />
        ))}

        {/* The gesture in progress is drawn on top and is not in the document yet. */}
        {gesture?.kind === "ink" && tool !== "laser" ? (
          <ElementView el={gesture.el} index={index} zoom={view.zoom} />
        ) : null}
        {gesture?.kind === "line" ? <ElementView el={gesture.el} index={index} zoom={view.zoom} /> : null}
        {gesture?.kind === "node" && gesture.moved ? (
          <ElementView el={gesture.el} index={index} zoom={view.zoom} />
        ) : null}

        {guides.map((guide, i) => (
          <line
            key={i}
            x1={guide.axis === "x" ? guide.at : guide.from}
            y1={guide.axis === "x" ? guide.from : guide.at}
            x2={guide.axis === "x" ? guide.at : guide.to}
            y2={guide.axis === "x" ? guide.to : guide.at}
            stroke="var(--grape)"
            strokeWidth={1 / view.zoom}
            strokeDasharray={`${4 / view.zoom} ${3 / view.zoom}`}
            pointerEvents="none"
          />
        ))}

        {arrowTarget && tool === "select" && !editing ? (
          <DirectionArrows
            node={arrowTarget}
            zoom={view.zoom}
            activeDirection={gesture?.kind === "connect" ? gesture.direction : null}
            onStart={(direction, event) => {
              event.stopPropagation();
              event.preventDefault();
              svgRef.current?.setPointerCapture(event.pointerId);
              setGesture({
                kind: "connect",
                from: arrowTarget.id,
                fromPort: DIRECTION_PORT[direction],
                direction,
                at: toWorld(event),
                over: null,
                moved: false,
              });
            }}
          />
        ) : null}

        {singleNode && !editing ? (
          <NodeHandles
            node={singleNode}
            zoom={view.zoom}
            onStart={(handle, event) => {
              event.stopPropagation();
              event.preventDefault();
              svgRef.current?.setPointerCapture(event.pointerId);
              setGesture({
                kind: "resize",
                id: singleNode.id,
                handle,
                start: { x: singleNode.x, y: singleNode.y, w: singleNode.w, h: singleNode.h },
                from: toWorld(event),
                before: doc,
              });
            }}
          />
        ) : null}

        {frameBox && !editing ? (
          <SelectionFrame
            box={frameBox}
            zoom={view.zoom}
            onStart={(handle, event) => {
              event.stopPropagation();
              event.preventDefault();
              svgRef.current?.setPointerCapture(event.pointerId);
              setGesture({
                kind: "scale",
                handle,
                start: frameBox,
                before: doc,
                originals: selected.map((el) => ({ ...el })),
              });
            }}
          />
        ) : null}

        {gesture?.kind === "connect" && gesture.moved ? (
          <ConnectPreview gesture={gesture} index={index} zoom={view.zoom} />
        ) : null}

        {gesture?.kind === "marquee" ? (
          <Marquee box={normalizeRect(gesture.from, gesture.to)} zoom={view.zoom} />
        ) : null}

        {paletteDrag && dropAt ? <DropPreview kind={paletteDrag} at={dropAt} zoom={view.zoom} /> : null}

        {laser.length ? <LaserTrail points={laser} zoom={view.zoom} /> : null}
      </svg>

      {editingEl && editingEl.type === "edge" ? (
        <EdgeLabelEditor
          key={editingEl.id}
          edge={editingEl}
          index={index}
          toScreen={toScreen}
          onDone={(label) => {
            const id = editingEl.id;
            editBoard((b) => patchElements(b, [id], (el) => ({ ...el, label }) as Element));
            onEditingChange(null);
          }}
        />
      ) : null}

      {editingEl && (editingEl.type === "node" || editingEl.type === "text") ? (
        <TextEditor
          key={editingEl.id}
          el={editingEl}
          screen={toScreen({ x: editingEl.x, y: editingEl.y })}
          zoom={view.zoom}
          onDone={(text) => {
            const id = editingEl.id;
            // An empty free-text box left behind would be an invisible click target.
            if (!text.trim() && editingEl.type === "text") {
              editBoard((b) => removeElements(b, [id]));
              onSelectionChange([]);
            } else {
              editBoard((b) => patchElements(b, [id], (el) => ({ ...el, text }) as Element));
            }
            onEditingChange(null);
          }}
        />
      ) : null}

      {dragOver ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[var(--grass-soft)]/60">
          <p className="rounded-2xl bg-[var(--bg)] px-4 py-2 text-sm font-extrabold">Drop the picture here</p>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------- pieces --------------------------------- */

function Paper({
  board,
  view,
  size,
}: {
  board: Board;
  view: Viewport;
  size: { w: number; h: number };
}) {
  if (board.paper === "plain") return null;
  const spec = PAPER_PATTERN[board.paper];
  const id = `do101-live-paper-${board.paper}`;
  return (
    <>
      <defs>
        <pattern id={id} width={spec.size} height={spec.size} patternUnits="userSpaceOnUse">
          {spec.path ? (
            <path d={spec.path} fill="none" stroke={PAPER_INK} strokeWidth={1} />
          ) : (
            <circle cx={2} cy={2} r={spec.dot} fill={PAPER_INK} />
          )}
        </pattern>
      </defs>
      <rect
        x={view.x}
        y={view.y}
        width={size.w / view.zoom}
        height={size.h / view.zoom}
        fill={`url(#${id})`}
      />
    </>
  );
}

function ElementView({
  el,
  index,
  zoom,
  selected = false,
  dimmed = false,
  hidden = false,
  onDoubleClick,
}: {
  el: Element;
  index: Map<string, NodeEl>;
  zoom: number;
  selected?: boolean;
  dimmed?: boolean;
  hidden?: boolean;
  onDoubleClick?: () => void;
}) {
  const opacity = dimmed ? 0.25 : 1;
  const common = {
    opacity,
    onDoubleClick: onDoubleClick
      ? (event: React.MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          onDoubleClick();
        }
      : undefined,
  };

  switch (el.type) {
    case "stroke":
      return (
        <g {...common}>
          <path
            d={inkPath(el)}
            fill="none"
            stroke={el.color}
            strokeWidth={el.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={strokeOpacity(el)}
          />
          {selected ? (
            <path
              d={inkPath(el)}
              fill="none"
              stroke="var(--sky)"
              strokeWidth={el.width + 4 / zoom}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.3}
              pointerEvents="none"
            />
          ) : null}
        </g>
      );

    case "line": {
      const head = arrowSize(el.width);
      return (
        <g {...common}>
          <path
            d={linePath(el)}
            fill="none"
            stroke={selected ? "var(--sky)" : el.color}
            strokeWidth={el.width}
            strokeLinecap="round"
            strokeDasharray={dashArray(el.dash, el.width)}
          />
          {el.arrowEnd ? (
            <path
              d={arrowHead(el.to, el.from, head)}
              fill="none"
              stroke={selected ? "var(--sky)" : el.color}
              strokeWidth={el.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {el.arrowStart ? (
            <path
              d={arrowHead(el.from, el.to, head)}
              fill="none"
              stroke={selected ? "var(--sky)" : el.color}
              strokeWidth={el.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </g>
      );
    }

    case "node":
      return <NodeView node={el} selected={selected} hidden={hidden} common={common} />;

    case "edge":
      return <EdgeView edge={el} index={index} selected={selected} hidden={hidden} zoom={zoom} common={common} />;

    case "text":
      return hidden ? null : (
        <g {...common}>
          <text
            x={el.x}
            y={el.y}
            fontFamily={FONT_STACK}
            fontSize={el.size}
            fontWeight={el.bold ? 700 : 500}
            fill={el.color}
            style={{ userSelect: "none", whiteSpace: "pre" }}
          >
            {textRows(el.text, el.size).map((row, i) => (
              <tspan key={i} x={el.x} dy={row.dy}>
                {row.line || " "}
              </tspan>
            ))}
          </text>
        </g>
      );

    case "image":
      return (
        <image
          {...common}
          x={el.x}
          y={el.y}
          width={el.w}
          height={el.h}
          href={el.href}
          preserveAspectRatio="none"
        />
      );
  }
}

function NodeView({
  node,
  selected,
  hidden,
  common,
}: {
  node: NodeEl;
  selected: boolean;
  hidden: boolean;
  common: { opacity: number; onDoubleClick?: (event: React.MouseEvent) => void };
}) {
  const stroke = node.stroke === "transparent" ? "none" : node.stroke;
  const detail = nodeDetailPath(node);
  const label = hidden ? null : labelRows(node);
  const centred = !isNoteLike(node.kind);

  return (
    <g {...common}>
      <path
        d={nodePath(node)}
        fill={node.fill}
        stroke={stroke}
        strokeWidth={node.strokeWidth}
        strokeLinejoin="round"
        strokeDasharray={stroke === "none" ? undefined : dashArray(node.dash, Math.max(1, node.strokeWidth))}
      />
      {detail ? (
        <path
          d={detail}
          fill="none"
          stroke={isNoteLike(node.kind) ? "rgba(0,0,0,0.12)" : stroke}
          strokeWidth={isNoteLike(node.kind) ? 1 : node.strokeWidth}
        />
      ) : null}
      {label ? (
        <text
          x={label.rows[0].x}
          y={label.y}
          fontFamily={fontFor(node.kind)}
          fontSize={node.fontSize}
          fontWeight={node.bold ? 700 : 500}
          fill={node.textColor}
          textAnchor={centred ? "middle" : undefined}
          dominantBaseline={centred ? "middle" : undefined}
          style={{ userSelect: "none", whiteSpace: "pre" }}
        >
          {label.rows.map((row, i) => (
            <tspan key={i} x={row.x} dy={row.dy}>
              {row.line || " "}
            </tspan>
          ))}
        </text>
      ) : null}
      {selected ? (
        <rect
          x={node.x - 3}
          y={node.y - 3}
          width={node.w + 6}
          height={node.h + 6}
          fill="none"
          stroke="var(--sky)"
          strokeWidth={2}
          strokeDasharray="6 4"
          rx={6}
          pointerEvents="none"
        />
      ) : null}
    </g>
  );
}

function EdgeView({
  edge,
  index,
  selected,
  hidden,
  zoom,
  common,
}: {
  edge: EdgeEl;
  index: Map<string, NodeEl>;
  selected: boolean;
  hidden: boolean;
  zoom: number;
  common: { opacity: number; onDoubleClick?: (event: React.MouseEvent) => void };
}) {
  const geo = edgeGeometry(edge, index);
  if (!geo) return null;
  const marker = markerId(edge.stroke, LIVE_MARKER);
  const labelWidth = edgeLabelWidth(edge.label);

  return (
    <g {...common}>
      {/* A fat invisible copy makes a 2px line easy to hit with a finger. */}
      <path d={geo.path} fill="none" stroke="transparent" strokeWidth={Math.max(14, 14 / zoom)} />
      <path
        d={geo.path}
        fill="none"
        stroke={selected ? "var(--sky)" : edge.stroke}
        strokeWidth={edge.strokeWidth + (selected ? 1 : 0)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashArray(edge.dash, edge.strokeWidth)}
        markerEnd={edge.endArrow ? `url(#${marker})` : undefined}
        markerStart={edge.startArrow ? `url(#${marker})` : undefined}
      />
      {edge.label.trim() && !hidden ? (
        <>
          <rect
            x={geo.mid.x - labelWidth / 2}
            y={geo.mid.y - 11}
            width={labelWidth}
            height={22}
            rx={6}
            fill="var(--bg)"
            fillOpacity={0.88}
          />
          <text
            x={geo.mid.x}
            y={geo.mid.y}
            fontFamily={FONT_STACK}
            fontSize={12}
            fontWeight={600}
            fill={edge.stroke}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ userSelect: "none" }}
          >
            {edge.label}
          </text>
        </>
      ) : null}
      {selected ? (
        <circle cx={geo.mid.x} cy={geo.mid.y} r={4 / zoom} fill="var(--sky)" pointerEvents="none" />
      ) : null}
    </g>
  );
}

/**
 * The four quick-add arrows.
 *
 * This is the interaction that makes a diagram tool feel fast: click one and
 * a connected shape appears that way; drag it onto another shape to join
 * them, or onto empty space to create and join in one gesture.
 */
function DirectionArrows({
  node,
  zoom,
  activeDirection,
  onStart,
}: {
  node: NodeEl;
  zoom: number;
  activeDirection: Direction | null;
  onStart: (direction: Direction, event: React.PointerEvent<SVGGElement>) => void;
}) {
  const gap = 26 / zoom;
  const r = 10 / zoom;

  return (
    <g>
      {DIRECTIONS.map((direction) => {
        const at = arrowCenter(node, direction, gap + r);
        const active = activeDirection === direction;
        return (
          <g key={direction} onPointerDown={(event) => onStart(direction, event)} className="cursor-crosshair">
            <circle cx={at.x} cy={at.y} r={r * 1.6} fill="transparent" />
            <circle
              cx={at.x}
              cy={at.y}
              r={r}
              fill={active ? "var(--sky)" : "var(--sky-soft)"}
              stroke="var(--sky)"
              strokeWidth={1.5 / zoom}
              opacity={0.95}
            />
            <path
              d={chevron(at, direction, r * 0.45)}
              fill="none"
              stroke={active ? "#fff" : "var(--sky-dark)"}
              strokeWidth={2 / zoom}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
            <title>Click to add a connected shape, or drag to link one</title>
          </g>
        );
      })}
    </g>
  );
}

function arrowCenter(rect: Rect, direction: Direction, distance: number): Point {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  switch (direction) {
    case "up":
      return { x: cx, y: rect.y - distance };
    case "down":
      return { x: cx, y: rect.y + rect.h + distance };
    case "left":
      return { x: rect.x - distance, y: cy };
    case "right":
      return { x: rect.x + rect.w + distance, y: cy };
  }
}

/** A small chevron pointing the way the arrow will grow. */
function chevron(at: Point, direction: Direction, s: number): string {
  const { x, y } = at;
  switch (direction) {
    case "up":
      return `M ${x - s} ${y + s / 2} L ${x} ${y - s / 2} L ${x + s} ${y + s / 2}`;
    case "down":
      return `M ${x - s} ${y - s / 2} L ${x} ${y + s / 2} L ${x + s} ${y - s / 2}`;
    case "left":
      return `M ${x + s / 2} ${y - s} L ${x - s / 2} ${y} L ${x + s / 2} ${y + s}`;
    case "right":
      return `M ${x - s / 2} ${y - s} L ${x + s / 2} ${y} L ${x - s / 2} ${y + s}`;
  }
}

/** Eight handles, for the precise resizing a single shape deserves. */
function NodeHandles({
  node,
  zoom,
  onStart,
}: {
  node: NodeEl;
  zoom: number;
  onStart: (handle: NodeHandle, event: React.PointerEvent<SVGRectElement>) => void;
}) {
  const s = 8 / zoom;
  const positions: [NodeHandle, number, number][] = [
    ["nw", node.x, node.y],
    ["n", node.x + node.w / 2, node.y],
    ["ne", node.x + node.w, node.y],
    ["e", node.x + node.w, node.y + node.h / 2],
    ["se", node.x + node.w, node.y + node.h],
    ["s", node.x + node.w / 2, node.y + node.h],
    ["sw", node.x, node.y + node.h],
    ["w", node.x, node.y + node.h / 2],
  ];
  return (
    <g>
      {positions.map(([handle, x, y]) => (
        <rect
          key={handle}
          x={x - s / 2}
          y={y - s / 2}
          width={s}
          height={s}
          fill="#fff"
          stroke="var(--sky)"
          strokeWidth={1.5 / zoom}
          style={{ cursor: HANDLE_CURSOR[handle] }}
          onPointerDown={(event) => onStart(handle, event)}
        />
      ))}
    </g>
  );
}

/** Four corners around a mixed selection, which scales as one object. */
function SelectionFrame({
  box,
  zoom,
  onStart,
}: {
  box: Rect;
  zoom: number;
  onStart: (handle: Corner, event: React.PointerEvent<SVGRectElement>) => void;
}) {
  const s = 9 / zoom;
  const corners: [Corner, number, number][] = [
    ["nw", box.x, box.y],
    ["ne", box.x + box.w, box.y],
    ["se", box.x + box.w, box.y + box.h],
    ["sw", box.x, box.y + box.h],
  ];
  const cursors: Record<Corner, string> = {
    nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize",
  };
  return (
    <g>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        fill="none"
        stroke="var(--sky)"
        strokeWidth={1.5 / zoom}
        strokeDasharray={`${5 / zoom} ${4 / zoom}`}
        pointerEvents="none"
      />
      {corners.map(([handle, x, y]) => (
        <rect
          key={handle}
          x={x - s / 2}
          y={y - s / 2}
          width={s}
          height={s}
          fill="#fff"
          stroke="var(--sky)"
          strokeWidth={1.5 / zoom}
          style={{ cursor: cursors[handle] }}
          onPointerDown={(event) => onStart(handle, event)}
        />
      ))}
    </g>
  );
}

function ConnectPreview({
  gesture,
  index,
  zoom,
}: {
  gesture: Extract<Gesture, { kind: "connect" }>;
  index: Map<string, NodeEl>;
  zoom: number;
}) {
  const source = index.get(gesture.from);
  if (!source) return null;
  const start = arrowCenter(source, gesture.direction ?? "right", 4 / zoom);
  const target = gesture.over ? index.get(gesture.over) : null;

  return (
    <g pointerEvents="none">
      <path
        d={`M ${start.x} ${start.y} L ${gesture.at.x} ${gesture.at.y}`}
        stroke="var(--sky)"
        strokeWidth={2 / zoom}
        strokeDasharray={`${6 / zoom} ${4 / zoom}`}
        fill="none"
      />
      {target ? (
        <rect
          x={target.x - 4}
          y={target.y - 4}
          width={target.w + 8}
          height={target.h + 8}
          fill="none"
          stroke="var(--grass)"
          strokeWidth={2 / zoom}
          rx={6}
        />
      ) : (
        <circle cx={gesture.at.x} cy={gesture.at.y} r={5 / zoom} fill="var(--sky)" />
      )}
    </g>
  );
}

/** The outline that follows the pointer while a shape comes off the palette. */
function DropPreview({ kind, at, zoom }: { kind: ShapeKind; at: Point; zoom: number }) {
  const size = nodeSize(kind);
  const box = { x: at.x - size.w / 2, y: at.y - size.h / 2, w: size.w, h: size.h };
  return (
    <g pointerEvents="none" opacity={0.7}>
      <path
        d={nodePath({ ...box, kind })}
        fill="var(--sky-soft)"
        stroke="var(--sky)"
        strokeWidth={2 / zoom}
        strokeDasharray={`${6 / zoom} ${4 / zoom}`}
        strokeLinejoin="round"
      />
    </g>
  );
}

function Marquee({ box, zoom }: { box: Rect; zoom: number }) {
  return (
    <rect
      x={box.x}
      y={box.y}
      width={box.w}
      height={box.h}
      fill="var(--sky)"
      fillOpacity={0.12}
      stroke="var(--sky)"
      strokeWidth={1 / zoom}
      pointerEvents="none"
    />
  );
}

/** The pointer trail: bright, soft-edged and gone in about a second. */
function LaserTrail({ points, zoom }: { points: LaserPoint[]; zoom: number }) {
  // The frame loop that owns this state has already dropped the stale points,
  // so rendering is a pure function of what it was handed.
  if (points.length < 2) return null;
  const path = strokePath(points);
  const tip = points[points.length - 1];
  return (
    <g pointerEvents="none">
      <path d={path} fill="none" stroke="#ff4b4b" strokeWidth={14 / zoom} strokeLinecap="round" opacity={0.25} />
      <path d={path} fill="none" stroke="#ff4b4b" strokeWidth={5 / zoom} strokeLinecap="round" opacity={0.85} />
      <circle cx={tip.x} cy={tip.y} r={6 / zoom} fill="#ff4b4b" />
    </g>
  );
}

/**
 * An overlaid textarea, because SVG has no editable text.
 *
 * It is sized and positioned to sit exactly where the label will land, so
 * typing does not make the shape jump about underneath.
 */
function TextEditor({
  el,
  screen,
  zoom,
  onDone,
}: {
  el: NodeEl | TextEl;
  screen: Point;
  zoom: number;
  onDone: (text: string) => void;
}) {
  const [value, setValue] = React.useState(el.text);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  /**
   * The editor is opened from inside a click, and the browser finishes that
   * click by moving focus itself — which fired `blur` and closed the box
   * before a single key could be typed. Blur only counts once it has focus.
   */
  const live = React.useRef(false);

  React.useEffect(() => {
    const focus = () => {
      ref.current?.focus();
      ref.current?.select();
    };
    focus();
    // One retry on the next frame, for the browsers that finish their own
    // focus handling after ours.
    const frame = requestAnimationFrame(() => {
      if (document.activeElement !== ref.current) focus();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const isNode = el.type === "node";
  const note = isNode && isNoteLike(el.kind);
  const pad = note ? NOTE_PADDING * zoom : 0;
  const fontSize = (isNode ? el.fontSize : el.size) * zoom;

  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={note ? "Write a note…" : isNode ? "Label…" : "Type…"}
      onChange={(e) => setValue(e.target.value)}
      onFocus={() => {
        live.current = true;
      }}
      onBlur={() => {
        if (live.current) onDone(value);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onDone(el.text);
        // Shift+Enter adds a line; Enter alone finishes, as in every board app.
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onDone(value);
        }
      }}
      className={cn(
        "do-scroll absolute resize-none rounded-lg border-2 border-[var(--sky)] bg-[var(--bg)] p-1 font-semibold text-[var(--ink)] outline-none",
        isNode && !note && "text-center",
      )}
      style={{
        left: screen.x + pad,
        top: screen.y + pad,
        width: Math.max(80, el.w * zoom - pad * 2),
        height: Math.max(32, el.h * zoom - pad * 2),
        fontSize,
        fontFamily: isNode ? fontFor(el.kind) : FONT_STACK,
        lineHeight: 1.3,
        color: isNode ? el.textColor : el.color,
      }}
      aria-label={note ? "Note text" : isNode ? "Shape label" : "Text"}
    />
  );
}

/** The same idea for the small label that sits on a connector. */
function EdgeLabelEditor({
  edge,
  index,
  toScreen,
  onDone,
}: {
  edge: EdgeEl;
  index: Map<string, NodeEl>;
  toScreen: (p: Point) => Point;
  onDone: (label: string) => void;
}) {
  const [value, setValue] = React.useState(edge.label);
  const ref = React.useRef<HTMLInputElement>(null);
  const live = React.useRef(false);

  React.useEffect(() => {
    const focus = () => {
      ref.current?.focus();
      ref.current?.select();
    };
    focus();
    const frame = requestAnimationFrame(() => {
      if (document.activeElement !== ref.current) focus();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const geo = edgeGeometry(edge, index);
  if (!geo) return null;
  const mid = toScreen(geo.mid);

  return (
    <input
      ref={ref}
      value={value}
      placeholder="label"
      onChange={(e) => setValue(e.target.value)}
      onFocus={() => {
        live.current = true;
      }}
      onBlur={() => {
        if (live.current) onDone(value);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onDone(edge.label);
        if (e.key === "Enter") {
          e.preventDefault();
          onDone(value);
        }
      }}
      className="absolute w-28 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-[var(--sky)] bg-[var(--bg)] px-2 py-1 text-center text-xs font-extrabold text-[var(--ink)] outline-none"
      style={{ left: mid.x, top: mid.y }}
      aria-label="Connector label"
    />
  );
}

/* --------------------------------- geometry -------------------------------- */

export function clampZoom(zoom: number): number {
  return Math.min(5, Math.max(0.1, Math.round(zoom * 100) / 100));
}

/** Snaps a dragged line to the nearest 45°. */
function snapAngle(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
}

/**
 * Resizing one node from any of its eight handles.
 *
 * Each handle moves only the edges it touches; the opposite edge is pinned,
 * which is what stops a box from sliding away as it is resized.
 */
function resizeNode(
  start: Rect,
  handle: NodeHandle,
  world: Point,
  from: Point,
  grid: number,
  keepRatio: boolean,
): Rect {
  const dx = world.x - from.x;
  const dy = world.y - from.y;
  let { x, y, w, h } = start;

  if (handle.includes("e")) w = clampNode(snap(start.w + dx, grid));
  if (handle.includes("s")) h = clampNode(snap(start.h + dy, grid));
  if (handle.includes("w")) {
    const right = start.x + start.w;
    x = snap(Math.min(start.x + dx, right - 24), grid);
    w = clampNode(right - x);
  }
  if (handle.includes("n")) {
    const bottom = start.y + start.h;
    y = snap(Math.min(start.y + dy, bottom - 24), grid);
    h = clampNode(bottom - y);
  }

  if (keepRatio && start.w > 0 && start.h > 0) {
    const ratio = start.w / start.h;
    if (handle === "n" || handle === "s") w = clampNode(h * ratio);
    else h = clampNode(w / ratio);
  }

  return { x, y, w, h };
}

/**
 * Scaling a whole selection from a corner.
 *
 * The opposite corner is pinned, which is what stops a group from sliding
 * away as it is resized.
 */
function scaleBox(start: Rect, handle: Corner, at: Point, keepRatio: boolean): Rect {
  const right = start.x + start.w;
  const bottom = start.y + start.h;
  const anchor = {
    x: handle === "nw" || handle === "sw" ? right : start.x,
    y: handle === "nw" || handle === "ne" ? bottom : start.y,
  };

  let w = Math.abs(at.x - anchor.x);
  let h = Math.abs(at.y - anchor.y);
  if (keepRatio && start.w > 0 && start.h > 0) {
    const ratio = start.w / start.h;
    if (w / Math.max(h, 0.001) > ratio) h = w / ratio;
    else w = h * ratio;
  }

  return {
    x: Math.min(anchor.x, at.x < anchor.x ? anchor.x - w : anchor.x),
    y: Math.min(anchor.y, at.y < anchor.y ? anchor.y - h : anchor.y),
    w: Math.max(1, w),
    h: Math.max(1, h),
  };
}
