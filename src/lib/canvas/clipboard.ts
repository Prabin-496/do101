/**
 * Copy and paste.
 *
 * A copied selection carries the edges that run *between* the copied nodes,
 * so pasting a two-box-and-an-arrow group gives you the arrow too, while an
 * edge to something left behind is dropped rather than dangling. The work is
 * done by `cloneElements`, which duplicate uses as well, so both routes
 * behave identically.
 */
import {
  addElements,
  cloneElements,
  nodeIndex,
  unionBounds,
  type Board,
  type Element,
  type Point,
} from "./model";

export interface Clip {
  elements: Element[];
}

export function copySelection(board: Board, ids: string[]): Clip | null {
  const wanted = new Set(ids);
  const picked = board.elements.filter((el) => wanted.has(el.id));
  if (!picked.length) return null;

  const nodes = new Set(picked.filter((el) => el.type === "node").map((el) => el.id));
  const elements = picked.filter(
    (el) => el.type !== "edge" || (nodes.has(el.from) && nodes.has(el.to)),
  );
  if (!elements.length) return null;

  // Deep-ish copies, so later edits to the board cannot reach into the clip.
  return { elements: elements.map((el) => ({ ...el })) };
}

export interface PasteResult {
  board: Board;
  ids: string[];
}

/**
 * Pastes a clip.
 *
 * With a point, the group lands with its top-left corner there — what you
 * expect from "paste here" on a right-click. Without one it is nudged clear
 * of the original so the copy is visible.
 */
export function pasteClip(board: Board, clip: Clip, at?: Point, offset = 24): PasteResult {
  if (!clip.elements.length) return { board, ids: [] };

  let dx = offset;
  let dy = offset;
  if (at) {
    const box = unionBounds(clip.elements, 0, nodeIndex(clip.elements));
    if (box) {
      dx = at.x - box.x;
      dy = at.y - box.y;
    }
  }

  const copies = cloneElements(clip.elements, dx, dy);
  return { board: addElements(board, copies), ids: copies.map((el) => el.id) };
}
