/**
 * 2048 board logic.
 *
 * Pure and unit tested, because the merge rule has one subtlety everybody gets
 * wrong: a tile that has just merged cannot merge again in the same move. So
 * a row of [2,2,4] slid left gives [4,4] — not [8].
 */

export type Cell = number;
export type Board = Cell[][];
export type Direction = "up" | "down" | "left" | "right";

export const SIZE = 4;
export const WIN_VALUE = 2048;

export function emptyBoard(size = SIZE): Board {
  return Array.from({ length: size }, () => Array<number>(size).fill(0));
}

export function emptyCells(board: Board): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  board.forEach((row, y) =>
    row.forEach((value, x) => {
      if (value === 0) cells.push([y, x]);
    }),
  );
  return cells;
}

/** Adds a tile: 2 nine times out of ten, 4 the tenth. */
export function addRandomTile(board: Board, random: () => number = Math.random): Board {
  const cells = emptyCells(board);
  if (!cells.length) return board;
  const [y, x] = cells[Math.floor(random() * cells.length)];
  const next = board.map((row) => [...row]);
  next[y][x] = random() < 0.9 ? 2 : 4;
  return next;
}

export function newGame(random: () => number = Math.random): Board {
  return addRandomTile(addRandomTile(emptyBoard(), random), random);
}

/**
 * Collapses one row to the left. Returned separately so the tests can target
 * the merge rule directly rather than through a whole board move.
 */
export function slideRow(row: Cell[]): { row: Cell[]; gained: number } {
  const filled = row.filter((value) => value !== 0);
  const out: Cell[] = [];
  let gained = 0;

  for (let i = 0; i < filled.length; i++) {
    if (filled[i] === filled[i + 1]) {
      const merged = filled[i] * 2;
      out.push(merged);
      gained += merged;
      i++; // Skip the partner, so the new tile cannot merge again this move.
    } else {
      out.push(filled[i]);
    }
  }

  while (out.length < row.length) out.push(0);
  return { row: out, gained };
}

function rotate(board: Board): Board {
  const size = board.length;
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => board[size - 1 - x][y]),
  );
}

/** Rotations needed to turn a direction into "slide left", and back again. */
const TURNS: Record<Direction, number> = { left: 0, up: 3, right: 2, down: 1 };

export interface MoveResult {
  board: Board;
  gained: number;
  /** False when nothing shifted, so no new tile should appear. */
  moved: boolean;
}

export function move(board: Board, direction: Direction): MoveResult {
  let working = board.map((row) => [...row]);
  for (let i = 0; i < TURNS[direction]; i++) working = rotate(working);

  let gained = 0;
  const slid = working.map((row) => {
    const result = slideRow(row);
    gained += result.gained;
    return result.row;
  });

  let restored = slid;
  for (let i = 0; i < (4 - TURNS[direction]) % 4; i++) restored = rotate(restored);

  const moved = JSON.stringify(restored) !== JSON.stringify(board);
  return { board: restored, gained, moved };
}

export function canMove(board: Board): boolean {
  if (emptyCells(board).length > 0) return true;
  // A full board is still playable while any neighbours match.
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board.length; x++) {
      const value = board[y][x];
      if (x + 1 < board.length && board[y][x + 1] === value) return true;
      if (y + 1 < board.length && board[y + 1][x] === value) return true;
    }
  }
  return false;
}

export function highestTile(board: Board): number {
  return Math.max(...board.flat());
}

export function hasWon(board: Board): boolean {
  return highestTile(board) >= WIN_VALUE;
}

/** Tile colours, warming as the value climbs. */
export const TILE_STYLES: Record<number, { bg: string; fg: string }> = {
  2: { bg: "#eef2f4", fg: "#5b6b76" },
  4: { bg: "#dcecd8", fg: "#3f6b41" },
  8: { bg: "#ffd9a8", fg: "#7a4a12" },
  16: { bg: "#ffbf7a", fg: "#6e3c07" },
  32: { bg: "#ff9f6b", fg: "#ffffff" },
  64: { bg: "#ff7a4d", fg: "#ffffff" },
  128: { bg: "#ffcf5c", fg: "#5c4300" },
  256: { bg: "#ffc22e", fg: "#5c4300" },
  512: { bg: "#ffb400", fg: "#4a3600" },
  1024: { bg: "#b45cff", fg: "#ffffff" },
  2048: { bg: "#4cc93f", fg: "#ffffff" },
  4096: { bg: "#22b8f0", fg: "#ffffff" },
  8192: { bg: "#ff4b4b", fg: "#ffffff" },
};

export function tileStyle(value: number) {
  return TILE_STYLES[value] ?? { bg: "#22303c", fg: "#ffffff" };
}
