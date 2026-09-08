import { describe, it, expect } from "vitest";
import {
  generateMathProblem,
  scramble,
  pickWord,
  generateColorRound,
  pickCells,
  SCRAMBLE_WORDS,
} from "@/lib/games/puzzles";
import {
  emptyBoard,
  slideRow,
  move,
  canMove,
  addRandomTile,
  emptyCells,
  highestTile,
  hasWon,
  newGame,
  type Board,
} from "@/lib/games/2048";

/** Deterministic generator so every assertion is reproducible. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("maths problems", () => {
  it("never asks for a negative answer", () => {
    const random = seeded(7);
    for (let level = 0; level < 60; level++) {
      const problem = generateMathProblem(level, random);
      expect(problem.answer, problem.question).toBeGreaterThanOrEqual(0);
    }
  });

  it("only produces whole-number divisions", () => {
    const random = seeded(11);
    let divisions = 0;
    for (let i = 0; i < 400; i++) {
      const problem = generateMathProblem(25, random);
      if (problem.operator === "÷") {
        divisions++;
        expect(Number.isInteger(problem.answer), problem.question).toBe(true);
      }
    }
    expect(divisions).toBeGreaterThan(0);
  });

  it("asks only addition and subtraction at the start", () => {
    const random = seeded(3);
    for (let i = 0; i < 50; i++) {
      expect(["+", "−"]).toContain(generateMathProblem(0, random).operator);
    }
  });

  it("states a question that evaluates to its answer", () => {
    const random = seeded(5);
    for (let i = 0; i < 200; i++) {
      const { question, answer } = generateMathProblem(20, random);
      const [left, operator, right] = question.split(" ");
      const a = Number(left);
      const b = Number(right);
      const computed =
        operator === "+" ? a + b : operator === "−" ? a - b : operator === "×" ? a * b : a / b;
      expect(computed, question).toBe(answer);
    }
  });
});

describe("word scramble", () => {
  it("never returns the original word", () => {
    const random = seeded(13);
    for (const word of SCRAMBLE_WORDS) {
      expect(scramble(word, random)).not.toBe(word);
    }
  });

  it("keeps exactly the same letters", () => {
    const random = seeded(17);
    for (const word of SCRAMBLE_WORDS.slice(0, 20)) {
      expect([...scramble(word, random)].sort().join("")).toBe([...word].sort().join(""));
    }
  });

  it("leaves a single character alone", () => {
    expect(scramble("a")).toBe("a");
  });

  it("picks words from the list", () => {
    const random = seeded(23);
    for (let i = 0; i < 30; i++) expect(SCRAMBLE_WORDS).toContain(pickWord(random));
  });
});

describe("colour rounds", () => {
  it("grows the grid and shrinks the difference as levels rise", () => {
    const random = seeded(29);
    const early = generateColorRound(0, random);
    const late = generateColorRound(20, random);
    expect(late.size).toBeGreaterThan(early.size);
    expect(late.size).toBeLessThanOrEqual(8);
  });

  it("always places the odd tile inside the grid", () => {
    const random = seeded(31);
    for (let level = 0; level < 40; level++) {
      const round = generateColorRound(level, random);
      expect(round.oddIndex).toBeGreaterThanOrEqual(0);
      expect(round.oddIndex).toBeLessThan(round.size * round.size);
    }
  });

  it("keeps the odd colour distinguishable from the base", () => {
    const random = seeded(37);
    for (let level = 0; level < 40; level++) {
      const round = generateColorRound(level, random);
      expect(round.oddColor).not.toBe(round.baseColor);
    }
  });
});

describe("cell picking", () => {
  it("returns the requested number of distinct cells", () => {
    const random = seeded(41);
    const cells = pickCells(5, 8, random);
    expect(cells).toHaveLength(8);
    expect(new Set(cells).size).toBe(8);
    cells.forEach((cell) => expect(cell).toBeLessThan(25));
  });

  it("never asks for more cells than the grid holds", () => {
    expect(pickCells(2, 99, seeded(43))).toHaveLength(4);
  });
});

describe("2048 row collapsing", () => {
  it("slides tiles to the left", () => {
    expect(slideRow([0, 2, 0, 4]).row).toEqual([2, 4, 0, 0]);
  });

  it("merges an equal pair and scores it", () => {
    const result = slideRow([2, 2, 0, 0]);
    expect(result.row).toEqual([4, 0, 0, 0]);
    expect(result.gained).toBe(4);
  });

  it("does not merge a tile twice in one move", () => {
    // The classic bug: this must be [4,4], never [8].
    expect(slideRow([2, 2, 4, 0]).row).toEqual([4, 4, 0, 0]);
    expect(slideRow([4, 4, 4, 4]).row).toEqual([8, 8, 0, 0]);
  });

  it("merges the leading pair when three match", () => {
    expect(slideRow([2, 2, 2, 0]).row).toEqual([4, 2, 0, 0]);
  });

  it("leaves a row that cannot merge untouched", () => {
    const result = slideRow([2, 4, 8, 16]);
    expect(result.row).toEqual([2, 4, 8, 16]);
    expect(result.gained).toBe(0);
  });
});

describe("2048 moves", () => {
  const board: Board = [
    [2, 0, 0, 2],
    [4, 4, 0, 0],
    [0, 0, 0, 0],
    [8, 0, 8, 0],
  ];

  it("collapses correctly in each direction", () => {
    expect(move(board, "left").board[0]).toEqual([4, 0, 0, 0]);
    expect(move(board, "right").board[0]).toEqual([0, 0, 0, 4]);
    expect(move(board, "left").board[3]).toEqual([16, 0, 0, 0]);
  });

  it("reports no move when nothing shifts", () => {
    const stuck: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(move(stuck, "left").moved).toBe(false);
    expect(move(stuck, "up").moved).toBe(false);
  });

  it("scores the sum of every tile it creates", () => {
    expect(move(board, "left").gained).toBe(4 + 8 + 16);
  });

  it("preserves the board size", () => {
    const result = move(board, "up").board;
    expect(result).toHaveLength(4);
    result.forEach((row) => expect(row).toHaveLength(4));
  });
});

describe("2048 game state", () => {
  it("is playable while an empty cell remains", () => {
    expect(canMove(emptyBoard())).toBe(true);
  });

  it("is playable on a full board while neighbours match", () => {
    const full: Board = [
      [2, 2, 4, 8],
      [4, 8, 16, 32],
      [2, 4, 8, 16],
      [4, 8, 16, 32],
    ];
    expect(canMove(full)).toBe(true);
  });

  it("is over when the board is full with no matching neighbours", () => {
    const dead: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(canMove(dead)).toBe(false);
  });

  it("starts with exactly two tiles", () => {
    const board = newGame(seeded(47));
    expect(emptyCells(board)).toHaveLength(14);
  });

  it("only ever adds a 2 or a 4", () => {
    const random = seeded(53);
    let board = emptyBoard();
    for (let i = 0; i < 16; i++) board = addRandomTile(board, random);
    board.flat().forEach((value) => expect([2, 4]).toContain(value));
  });

  it("recognises a win at 2048", () => {
    const board = emptyBoard();
    board[0][0] = 2048;
    expect(hasWon(board)).toBe(true);
    expect(highestTile(board)).toBe(2048);
    expect(hasWon(emptyBoard())).toBe(false);
  });
});
