/**
 * Generators for the quick-fire games: arithmetic, word scrambles and the
 * colour-discrimination grid. Pure, seedable and unit tested, because a
 * generator that can produce an impossible puzzle is a bug players cannot
 * work around.
 */

/* --------------------------------- maths --------------------------------- */

export type MathOperator = "+" | "−" | "×" | "÷";

export interface MathProblem {
  question: string;
  answer: number;
  operator: MathOperator;
}

/**
 * Difficulty climbs with the streak. Division is always constructed from a
 * known product, so the answer is a whole number every time.
 */
export function generateMathProblem(level: number, random: () => number = Math.random): MathProblem {
  const tier = Math.min(4, Math.floor(level / 5));
  const operators: MathOperator[] =
    tier === 0 ? ["+", "−"] : tier === 1 ? ["+", "−", "×"] : ["+", "−", "×", "÷"];
  const operator = operators[Math.floor(random() * operators.length)];

  const pick = (max: number) => 2 + Math.floor(random() * max);

  switch (operator) {
    case "+": {
      const range = [10, 40, 90, 200, 500][tier];
      const a = pick(range);
      const b = pick(range);
      return { question: `${a} + ${b}`, answer: a + b, operator };
    }
    case "−": {
      const range = [10, 40, 90, 200, 500][tier];
      const a = pick(range);
      const b = pick(range);
      // Ordered so the answer is never negative.
      const [big, small] = a >= b ? [a, b] : [b, a];
      return { question: `${big} − ${small}`, answer: big - small, operator };
    }
    case "×": {
      const range = [5, 9, 12, 15, 20][tier];
      const a = pick(range);
      const b = pick(range);
      return { question: `${a} × ${b}`, answer: a * b, operator };
    }
    default: {
      const range = [5, 9, 12, 15, 20][tier];
      const divisor = pick(range);
      const quotient = pick(range);
      const dividend = divisor * quotient;
      return { question: `${dividend} ÷ ${divisor}`, answer: quotient, operator };
    }
  }
}

/* ------------------------------- word games ------------------------------- */

export const SCRAMBLE_WORDS = [
  "planet", "rocket", "garden", "silver", "window", "coffee", "bridge", "candle",
  "forest", "island", "jungle", "market", "orange", "pencil", "purple", "rabbit",
  "school", "summer", "travel", "winter", "yellow", "animal", "basket", "camera",
  "danger", "energy", "family", "guitar", "helmet", "insect", "jacket", "kitten",
  "ladder", "magnet", "napkin", "office", "parrot", "puzzle", "ribbon", "saddle",
  "temple", "tunnel", "velvet", "walnut", "anchor", "breeze", "cactus", "dragon",
  "eleven", "fabric", "gravel", "harbor", "indigo", "kettle", "lizard", "meadow",
  "mirror", "needle", "orchid", "pillow", "quartz", "rocket", "shadow", "thread",
  "violin", "wallet", "zephyr", "bottle", "canyon", "desert", "engine", "flower",
];

/** Shuffles a word, guaranteeing the result differs from the original. */
export function scramble(word: string, random: () => number = Math.random): string {
  if (word.length < 2) return word;
  const letters = [...word];

  for (let attempt = 0; attempt < 12; attempt++) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    const candidate = letters.join("");
    if (candidate !== word) return candidate;
  }

  // A word of all-identical letters cannot be scrambled; swap and accept it.
  [letters[0], letters[letters.length - 1]] = [letters[letters.length - 1], letters[0]];
  return letters.join("");
}

export function pickWord(random: () => number = Math.random): string {
  return SCRAMBLE_WORDS[Math.floor(random() * SCRAMBLE_WORDS.length)];
}

/* ----------------------------- colour vision ----------------------------- */

export interface ColorRound {
  /** Tiles per side. */
  size: number;
  /** Index of the tile that differs. */
  oddIndex: number;
  baseColor: string;
  oddColor: string;
}

/**
 * Builds a grid where one tile is a slightly different shade.
 * The grid grows and the difference shrinks as the level rises, so the game
 * gets harder in two dimensions at once.
 */
export function generateColorRound(level: number, random: () => number = Math.random): ColorRound {
  const size = Math.min(8, 2 + Math.floor(level / 3));
  // Difference falls from a very obvious 42 towards 3, which is near the limit
  // of what a typical screen and eye can separate.
  const difference = Math.max(3, Math.round(42 * Math.pow(0.86, level)));

  const hue = Math.floor(random() * 360);
  const saturation = 55 + Math.floor(random() * 25);
  const lightness = 45 + Math.floor(random() * 20);

  return {
    size,
    oddIndex: Math.floor(random() * size * size),
    baseColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
    oddColor: `hsl(${hue} ${saturation}% ${Math.min(92, lightness + difference / 2)}%)`,
  };
}

/* ------------------------------ visual memory ----------------------------- */

/** Picks `count` distinct cells from a size×size grid. */
export function pickCells(size: number, count: number, random: () => number = Math.random): number[] {
  const total = size * size;
  const safeCount = Math.min(count, total);
  const chosen = new Set<number>();
  while (chosen.size < safeCount) chosen.add(Math.floor(random() * total));
  return [...chosen];
}

/* --------------------------------- grading -------------------------------- */

export function gradeReaction(ms: number): string {
  if (ms < 150) return "Lightning";
  if (ms < 200) return "Very fast";
  if (ms < 260) return "Fast";
  if (ms < 340) return "Average";
  return "Room to improve";
}

export function gradeLevel(level: number, average: number): string {
  if (level >= average * 1.6) return "Exceptional";
  if (level >= average * 1.2) return "Well above average";
  if (level >= average * 0.85) return "About average";
  return "Keep practising";
}
