/**
 * Darts 301 — board geometry, scoring and the leg state machine.
 *
 * Everything here is a pure function over a plain state object. The host's
 * browser owns the one true state, applies each throw and broadcasts the
 * result; guests only ever render what they are sent. Keeping the rules out
 * of React means the awkward parts — busts, double-out, checkout routes —
 * are testable without a dartboard.
 */

/** Sector numbers clockwise from the top. 20 is at 12 o'clock. */
export const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

/**
 * Ring radii from a regulation board (in mm), normalised so that 1.0 is the
 * outer edge of the double ring — the scoring edge of the board.
 */
export const RADIUS = {
  bull: 6.35 / 170,
  outerBull: 15.9 / 170,
  tripleInner: 99 / 170,
  tripleOuter: 107 / 170,
  doubleInner: 162 / 170,
  doubleOuter: 1,
} as const;

export type Ring = "miss" | "single" | "triple" | "double" | "outer-bull" | "bull";

export interface DartHit {
  /** The sector number, 25 for either bull, 0 for a miss. */
  sector: number;
  ring: Ring;
  value: number;
  /** How a darts player says it: "T20", "D16", "Bull", "5", "Miss". */
  label: string;
}

export const MISS: DartHit = { sector: 0, ring: "miss", value: 0, label: "Miss" };

/** Which sector a point falls in. x right, y down, origin at the bullseye. */
export function sectorAt(x: number, y: number): number {
  const degrees = (Math.atan2(x, -y) * 180) / Math.PI;
  const index = Math.round(((degrees % 360) + 360) % 360 / 18) % 20;
  return SECTORS[index];
}

/** Scores a landing point in board space, where radius 1 is the board edge. */
export function scoreAt(x: number, y: number): DartHit {
  const r = Math.hypot(x, y);
  if (r > RADIUS.doubleOuter) return MISS;
  if (r <= RADIUS.bull) return { sector: 25, ring: "bull", value: 50, label: "Bull" };
  if (r <= RADIUS.outerBull) return { sector: 25, ring: "outer-bull", value: 25, label: "25" };

  const sector = sectorAt(x, y);
  if (r <= RADIUS.tripleInner) return { sector, ring: "single", value: sector, label: `${sector}` };
  if (r <= RADIUS.tripleOuter)
    return { sector, ring: "triple", value: sector * 3, label: `T${sector}` };
  if (r <= RADIUS.doubleInner) return { sector, ring: "single", value: sector, label: `${sector}` };
  return { sector, ring: "double", value: sector * 2, label: `D${sector}` };
}

/** A dart that finishes a leg must land on a double, or in the bullseye. */
export function isDoubleOutHit(hit: DartHit): boolean {
  return hit.ring === "double" || hit.ring === "bull";
}

/* ------------------------------ game state ------------------------------ */

export const START_SCORE = 301;
export const DARTS_PER_TURN = 3;
export const MAX_PLAYERS = 5;

export interface DartsPlayer {
  id: string;
  name: string;
  /** Points left in the current leg. */
  remaining: number;
  /** Legs won since the room opened. */
  legs: number;
  /** Darts thrown in the current leg, including busted ones. */
  darts: number;
  connected: boolean;
  /** Finishing position once the leg is over, 1 for the winner. */
  place: number | null;
}

export interface ThrowRecord {
  x: number;
  y: number;
  hit: DartHit;
  /** True when this dart broke the turn rather than counting. */
  bust: boolean;
}

export type DartsPhase = "lobby" | "playing" | "over";

export interface DartsState {
  phase: DartsPhase;
  /** Whether a leg must be finished on a double. */
  doubleOut: boolean;
  players: DartsPlayer[];
  /** Index into players of whoever is at the oche. */
  turn: number;
  /** The darts thrown so far in the current turn. */
  throws: ThrowRecord[];
  /** The thrower's score before this turn, restored on a bust. */
  turnStart: number;
  busted: boolean;
  winner: string | null;
  leg: number;
  /** Index of the player who throws first this leg — rotates each leg. */
  starter: number;
}

export function createGame(doubleOut = true): DartsState {
  return {
    phase: "lobby",
    doubleOut,
    players: [],
    turn: 0,
    throws: [],
    turnStart: START_SCORE,
    busted: false,
    winner: null,
    leg: 1,
    starter: 0,
  };
}

/** Two people called Sam in one room should still be told apart. */
function uniqueName(players: DartsPlayer[], wanted: string): string {
  const base = wanted.trim().slice(0, 14) || "Player";
  if (!players.some((p) => p.name === base)) return base;
  for (let n = 2; n < 10; n++) {
    const candidate = `${base} ${n}`;
    if (!players.some((p) => p.name === candidate)) return candidate;
  }
  return base;
}

export function addPlayer(state: DartsState, id: string, name: string): DartsState {
  if (state.players.some((p) => p.id === id)) return state;
  if (state.players.length >= MAX_PLAYERS) return state;
  const player: DartsPlayer = {
    id,
    name: uniqueName(state.players, name),
    remaining: START_SCORE,
    legs: 0,
    darts: 0,
    connected: true,
    place: null,
  };
  return { ...state, players: [...state.players, player] };
}

export function setConnected(state: DartsState, id: string, connected: boolean): DartsState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === id ? { ...p, connected } : p)),
  };
}

/**
 * Drops a player. During a leg they are only marked away, because removing
 * them would shuffle every other player's turn out from under them.
 */
export function dropPlayer(state: DartsState, id: string): DartsState {
  if (state.phase !== "lobby") return setConnected(state, id, false);
  const index = state.players.findIndex((p) => p.id === id);
  if (index === -1) return state;
  const players = state.players.filter((p) => p.id !== id);
  const shift = (n: number) => (index < n ? n - 1 : n);
  return {
    ...state,
    players,
    turn: players.length ? shift(state.turn) % players.length : 0,
    starter: players.length ? shift(state.starter) % players.length : 0,
  };
}

export function startLeg(state: DartsState): DartsState {
  if (!state.players.length) return state;
  const starter = state.starter % state.players.length;
  return {
    ...state,
    phase: "playing",
    players: state.players.map((p) => ({
      ...p,
      remaining: START_SCORE,
      darts: 0,
      place: null,
    })),
    turn: starter,
    throws: [],
    turnStart: START_SCORE,
    busted: false,
    winner: null,
  };
}

/** Starts the next leg, with the throw rotating to the next player. */
export function nextLeg(state: DartsState): DartsState {
  if (!state.players.length) return state;
  return startLeg({
    ...state,
    leg: state.leg + 1,
    starter: (state.starter + 1) % state.players.length,
  });
}

export function currentPlayer(state: DartsState): DartsPlayer | null {
  return state.players[state.turn] ?? null;
}

/** True when the thrower has no darts left — three thrown, a bust, or a win. */
export function isTurnOver(state: DartsState): boolean {
  if (state.phase !== "playing") return true;
  return state.busted || state.winner !== null || state.throws.length >= DARTS_PER_TURN;
}

export function dartsLeft(state: DartsState): number {
  return Math.max(0, DARTS_PER_TURN - state.throws.length);
}

/** What the darts thrown this turn are worth, ignoring a bust. */
export function turnTotal(throws: ThrowRecord[]): number {
  return throws.reduce((sum, t) => sum + (t.bust ? 0 : t.hit.value), 0);
}

/**
 * Applies one dart for whoever is at the oche.
 *
 * A turn breaks — "bust" — when the dart would take the score below zero, or
 * to exactly one, or to zero on something other than a double while
 * double-out is on. A bust puts the score back to where the turn started.
 */
export function throwDart(state: DartsState, x: number, y: number): DartsState {
  if (state.phase !== "playing" || isTurnOver(state)) return state;
  const player = currentPlayer(state);
  if (!player) return state;

  const hit = scoreAt(x, y);
  const next = player.remaining - hit.value;
  const bust =
    next < 0 ||
    (state.doubleOut && next === 1) ||
    (state.doubleOut && next === 0 && !isDoubleOutHit(hit));

  const remaining = bust ? state.turnStart : next;
  const players = state.players.map((p) =>
    p.id === player.id ? { ...p, remaining, darts: p.darts + 1 } : p,
  );

  const after: DartsState = {
    ...state,
    players,
    throws: [...state.throws, { x, y, hit, bust }],
    busted: bust,
  };

  return remaining === 0 ? finishLeg(after, player.id) : after;
}

/** Ends the leg: the checkout takes first place, everyone else ranks by score. */
function finishLeg(state: DartsState, winnerId: string): DartsState {
  const others = state.players
    .filter((p) => p.id !== winnerId)
    .sort((a, b) => a.remaining - b.remaining || a.darts - b.darts);

  const place = new Map<string, number>([[winnerId, 1]]);
  others.forEach((p, i) => place.set(p.id, i + 2));

  return {
    ...state,
    phase: "over",
    winner: winnerId,
    players: state.players.map((p) => ({
      ...p,
      legs: p.id === winnerId ? p.legs + 1 : p.legs,
      place: place.get(p.id) ?? null,
    })),
  };
}

/** Hands the darts to the next player who is still in the room. */
export function endTurn(state: DartsState): DartsState {
  if (state.phase !== "playing" || !state.players.length) return state;
  let turn = state.turn;
  for (let i = 1; i <= state.players.length; i++) {
    const candidate = (state.turn + i) % state.players.length;
    if (state.players[candidate].connected) {
      turn = candidate;
      break;
    }
  }
  return {
    ...state,
    turn,
    throws: [],
    busted: false,
    turnStart: state.players[turn]?.remaining ?? START_SCORE,
  };
}

/* ---------------------------- checkout routes ---------------------------- */

interface Candidate {
  label: string;
  value: number;
}

/** Setup darts, in the order a player would actually try them. */
const SETUP: Candidate[] = (() => {
  const list: Candidate[] = [];
  for (let n = 20; n >= 1; n--) list.push({ label: `T${n}`, value: n * 3 });
  list.push({ label: "Bull", value: 50 }, { label: "25", value: 25 });
  for (let n = 20; n >= 1; n--) list.push({ label: `${n}`, value: n });
  for (let n = 20; n >= 1; n--) list.push({ label: `D${n}`, value: n * 2 });
  return list;
})();

/** The single dart that finishes from here, if there is one. */
function finisher(remaining: number, doubleOut: boolean): string | null {
  if (doubleOut) {
    if (remaining === 50) return "Bull";
    if (remaining <= 40 && remaining % 2 === 0) return `D${remaining / 2}`;
    return null;
  }
  if (remaining <= 20) return `${remaining}`;
  if (remaining === 25) return "25";
  if (remaining <= 40 && remaining % 2 === 0) return `D${remaining / 2}`;
  if (remaining === 50) return "Bull";
  if (remaining <= 60 && remaining % 3 === 0) return `T${remaining / 3}`;
  return null;
}

/**
 * A suggested way out, e.g. 170 → T20, T20, Bull. Returns null when the
 * score cannot be checked out with the darts left, which is itself useful:
 * it is why 169 is a number darts players groan at.
 */
export function checkoutRoute(
  remaining: number,
  darts: number,
  doubleOut: boolean,
): string[] | null {
  if (remaining <= 0 || darts <= 0) return null;

  const single = finisher(remaining, doubleOut);
  if (single) return [single];
  if (darts <= 1) return null;

  for (const candidate of SETUP) {
    const left = remaining - candidate.value;
    if (left <= 0) continue;
    if (doubleOut && left === 1) continue;
    const rest = checkoutRoute(left, darts - 1, doubleOut);
    if (rest) return [candidate.label, ...rest];
  }
  return null;
}

/* -------------------------------- stats -------------------------------- */

/** The standard darts average: points per three darts thrown this leg. */
export function threeDartAverage(player: DartsPlayer): number {
  if (!player.darts) return 0;
  return ((START_SCORE - player.remaining) / player.darts) * 3;
}

/** Players ordered for the scoreboard: by finishing place, then by score. */
export function standings(state: DartsState): DartsPlayer[] {
  return [...state.players].sort((a, b) => {
    if (a.place && b.place) return a.place - b.place;
    if (a.place) return -1;
    if (b.place) return 1;
    return a.remaining - b.remaining || a.darts - b.darts;
  });
}
