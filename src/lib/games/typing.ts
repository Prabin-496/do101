export interface TypingStats {
  wpm: number;
  rawWpm: number;
  cpm: number;
  accuracy: number;
  correctChars: number;
  incorrectChars: number;
  totalTyped: number;
}

const CHARS_PER_WORD = 5;

/**
 * Standard WPM: five correct characters count as one word.
 * Raw WPM counts everything typed, right or wrong.
 */
export function computeTypingStats(
  target: string,
  typed: string,
  elapsedSeconds: number,
): TypingStats {
  let correct = 0;
  for (let i = 0; i < typed.length; i++) {
    if (i < target.length && typed[i] === target[i]) correct++;
  }
  const incorrect = typed.length - correct;
  const minutes = elapsedSeconds > 0 ? elapsedSeconds / 60 : 0;

  return {
    wpm: minutes > 0 ? correct / CHARS_PER_WORD / minutes : 0,
    rawWpm: minutes > 0 ? typed.length / CHARS_PER_WORD / minutes : 0,
    cpm: minutes > 0 ? correct / minutes : 0,
    accuracy: typed.length > 0 ? (correct / typed.length) * 100 : 100,
    correctChars: correct,
    incorrectChars: incorrect,
    totalTyped: typed.length,
  };
}

export const TYPING_DURATIONS = [15, 30, 60] as const;
export type TypingDuration = (typeof TYPING_DURATIONS)[number] | number;

const WORD_POOL = [
  "time","people","way","year","work","day","thing","world","life","hand","part","child","eye","woman","place","case","point","government","company","number","group","problem","fact","water","month","book","light","money","story","result","study","idea","music","market","food","level","paper","state","door","school","power","game","line","end","member","law","car","city","name","team","minute","idea","kind","head","house","service","friend","father","hour","art","war","history","party","reason","research","girl","guy","moment","air","teacher","force","education","foot","boy","age","policy","process","music","market","sense","nation","plan","college","interest","death","course","someone","experience","behind","reach","local","sure","face","door","cut","already","during","field","huge","happy","hope","floor","rather","enough","almost","travel","system","program","question","during","without","again","place","great","little","right","think","around","every","large","small","under","while","never","before","between","should","because","people","through","different","following","important","children","example","together","possible","actually","business","building","national","personal","standard","training","language","computer","internet","software","keyboard","practice","attention","progress","quickly","simple","common","natural","modern","future","record","design","effort","result","choose","strong","bright","forward","balance","journey","evening","morning","weather","picture","science","perfect","present","support","control","develop","imagine","measure","organize","perform","protect","realize",
];

const SENTENCES = [
  "The quick brown fox jumps over the lazy dog while the rest of the field watches in silence.",
  "Practice makes progress, and progress is what turns a slow start into a steady rhythm.",
  "Good typing is less about raw speed and more about keeping a clean, even pace under pressure.",
  "Every keyboard has a rhythm of its own, and the best typists learn to listen for it.",
  "Small daily habits compound into results that look like talent from the outside.",
  "Focus on accuracy first; speed arrives quietly once your fingers stop guessing.",
  "A calm mind and a light touch will beat brute force on almost any keyboard.",
  "Read one word ahead of the one you are typing and the sentence starts to flow.",
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic text for a given seed — Typing Battle relies on both
 * players generating byte-identical text from the shared room seed.
 *
 * A word pool can be passed in for languages other than English; the default
 * keeps every existing caller, including the battle handshake, unchanged.
 */
export function generateTypingText(
  wordCount = 60,
  seed?: number,
  pool: string[] = WORD_POOL,
): string {
  const rand = seed === undefined ? Math.random : mulberry32(seed);
  const source = pool.length > 0 ? pool : WORD_POOL;
  const words: string[] = [];
  while (words.length < wordCount) {
    words.push(source[Math.floor(rand() * source.length)]);
  }
  return words.join(" ");
}

export function generateSentenceText(seed?: number): string {
  const rand = seed === undefined ? Math.random : mulberry32(seed);
  const picked: string[] = [];
  const pool = [...SENTENCES];
  while (pool.length && picked.length < 3) {
    picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return picked.join(" ");
}

export function typingGrade(wpm: number): { label: string; blurb: string } {
  if (wpm >= 100) return { label: "Elite", blurb: "Top-tier speed. Genuinely rare." };
  if (wpm >= 80) return { label: "Very fast", blurb: "Well above professional typing speed." };
  if (wpm >= 60) return { label: "Fast", blurb: "Comfortably faster than most people." };
  if (wpm >= 40) return { label: "Average", blurb: "Right around the adult average." };
  if (wpm >= 25) return { label: "Getting there", blurb: "Keep practising — accuracy first." };
  return { label: "Warming up", blurb: "Slow and accurate beats fast and messy." };
}
