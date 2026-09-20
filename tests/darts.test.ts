import { describe, it, expect } from "vitest";
import { BEDS, NUMBERS, PAINT, VIEW, clampAim, point } from "@/lib/games/dartboard";
import {
  DARTS_PER_TURN,
  MAX_PLAYERS,
  START_SCORE,
  addPlayer,
  checkoutRoute,
  createGame,
  currentPlayer,
  dropPlayer,
  endTurn,
  isTurnOver,
  nextLeg,
  scoreAt,
  sectorAt,
  setConnected,
  standings,
  startLeg,
  threeDartAverage,
  throwDart,
  turnTotal,
  type DartsState,
} from "@/lib/games/darts";

/** A point at `degrees` clockwise from the top, `r` out from the bullseye. */
function at(degrees: number, r: number): [number, number] {
  const rad = (degrees * Math.PI) / 180;
  return [r * Math.sin(rad), -r * Math.cos(rad)];
}

const TOP = 0;

describe("board geometry", () => {
  it("puts 20 at the top and reads clockwise", () => {
    expect(sectorAt(...at(TOP, 0.5))).toBe(20);
    expect(sectorAt(...at(90, 0.5))).toBe(6);
    expect(sectorAt(...at(180, 0.5))).toBe(3);
    expect(sectorAt(...at(270, 0.5))).toBe(11);
  });

  it("keeps a sector across its whole 18 degree wedge", () => {
    expect(sectorAt(...at(-8, 0.5))).toBe(20);
    expect(sectorAt(...at(8, 0.5))).toBe(20);
    expect(sectorAt(...at(10, 0.5))).toBe(1);
  });

  it("scores the bullseye and the outer bull", () => {
    expect(scoreAt(0, 0)).toMatchObject({ value: 50, ring: "bull", label: "Bull" });
    expect(scoreAt(...at(TOP, 0.07))).toMatchObject({ value: 25, ring: "outer-bull" });
  });

  it("scores singles, trebles and doubles at the right radii", () => {
    expect(scoreAt(...at(TOP, 0.3))).toMatchObject({ value: 20, ring: "single", label: "20" });
    expect(scoreAt(...at(TOP, 0.6))).toMatchObject({ value: 60, ring: "triple", label: "T20" });
    expect(scoreAt(...at(TOP, 0.8))).toMatchObject({ value: 20, ring: "single" });
    expect(scoreAt(...at(TOP, 0.98))).toMatchObject({ value: 40, ring: "double", label: "D20" });
  });

  it("scores nothing outside the double ring", () => {
    expect(scoreAt(...at(TOP, 1.05))).toMatchObject({ value: 0, ring: "miss", label: "Miss" });
  });
});

/* ----------------------------- helpers ----------------------------- */

function twoPlayerLeg(remainings: number[], doubleOut = true): DartsState {
  let state = createGame(doubleOut);
  remainings.forEach((_, i) => {
    state = addPlayer(state, `p${i}`, `Player ${i + 1}`);
  });
  state = startLeg(state);
  return {
    ...state,
    players: state.players.map((p, i) => ({ ...p, remaining: remainings[i] })),
    turnStart: remainings[0],
  };
}

/** Throws at a named target, e.g. "T20". */
function throwAt(state: DartsState, target: string): DartsState {
  if (target === "Bull") return throwDart(state, 0, 0);
  if (target === "25") return throwDart(state, ...at(TOP, 0.07));
  if (target === "Miss") return throwDart(state, ...at(TOP, 1.2));
  const ring = target[0];
  const n = Number(ring === "T" || ring === "D" ? target.slice(1) : target);
  const degrees = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5].indexOf(n) * 18;
  const r = ring === "T" ? 0.6 : ring === "D" ? 0.98 : 0.3;
  return throwDart(state, ...at(degrees, r));
}

/* ----------------------------- the game ----------------------------- */

describe("joining a room", () => {
  it("caps the room at five players", () => {
    let state = createGame();
    for (let i = 0; i < 8; i++) state = addPlayer(state, `p${i}`, "Sam");
    expect(state.players).toHaveLength(MAX_PLAYERS);
  });

  it("never adds the same player twice", () => {
    let state = addPlayer(createGame(), "p1", "Sam");
    state = addPlayer(state, "p1", "Sam");
    expect(state.players).toHaveLength(1);
  });

  it("tells two players with the same name apart", () => {
    let state = addPlayer(createGame(), "p1", "Sam");
    state = addPlayer(state, "p2", "Sam");
    expect(state.players.map((p) => p.name)).toEqual(["Sam", "Sam 2"]);
  });

  it("falls back to a usable name when someone enters nothing", () => {
    expect(addPlayer(createGame(), "p1", "   ").players[0].name).toBe("Player");
  });

  it("removes a player in the lobby but only marks them away mid-leg", () => {
    let state = addPlayer(addPlayer(createGame(), "p1", "A"), "p2", "B");
    expect(dropPlayer(state, "p1").players).toHaveLength(1);

    state = startLeg(state);
    const mid = dropPlayer(state, "p1");
    expect(mid.players).toHaveLength(2);
    expect(mid.players[0].connected).toBe(false);
  });
});

describe("throwing", () => {
  it("subtracts the dart from the thrower's score", () => {
    const state = throwAt(twoPlayerLeg([START_SCORE, START_SCORE]), "T20");
    expect(state.players[0].remaining).toBe(241);
    expect(state.players[1].remaining).toBe(START_SCORE);
  });

  it("ends the turn after three darts", () => {
    let state = twoPlayerLeg([START_SCORE, START_SCORE]);
    for (let i = 0; i < DARTS_PER_TURN; i++) state = throwAt(state, "20");
    expect(isTurnOver(state)).toBe(true);
    expect(state.players[0].remaining).toBe(241);
  });

  it("ignores a fourth dart until the turn is handed over", () => {
    let state = twoPlayerLeg([START_SCORE, START_SCORE]);
    for (let i = 0; i < 4; i++) state = throwAt(state, "20");
    expect(state.throws).toHaveLength(DARTS_PER_TURN);
  });

  it("counts a miss as a dart but no score", () => {
    const state = throwAt(twoPlayerLeg([START_SCORE, START_SCORE]), "Miss");
    expect(state.players[0].remaining).toBe(START_SCORE);
    expect(state.players[0].darts).toBe(1);
  });

  it("passes the darts to the next player", () => {
    let state = twoPlayerLeg([100, 100]);
    state = endTurn(throwAt(state, "20"));
    expect(currentPlayer(state)?.id).toBe("p1");
    expect(state.turnStart).toBe(100);
    expect(state.throws).toEqual([]);
  });

  it("skips a player who has left the room", () => {
    let state = twoPlayerLeg([100, 100, 100]);
    state = setConnected(state, "p1", false);
    state = endTurn(state);
    expect(currentPlayer(state)?.id).toBe("p2");
  });
});

describe("busting", () => {
  it("busts when the dart would go below zero, and restores the score", () => {
    let state = twoPlayerLeg([30, 301]);
    state = throwAt(state, "T20");
    expect(state.busted).toBe(true);
    expect(state.players[0].remaining).toBe(30);
    expect(isTurnOver(state)).toBe(true);
  });

  it("busts on leaving exactly one when a double is needed", () => {
    const state = throwAt(twoPlayerLeg([21, 301]), "20");
    expect(state.busted).toBe(true);
    expect(state.players[0].remaining).toBe(21);
  });

  it("busts on reaching zero without a double", () => {
    const state = throwAt(twoPlayerLeg([20, 301]), "20");
    expect(state.busted).toBe(true);
    expect(state.winner).toBeNull();
  });

  it("allows a straight finish when double-out is off", () => {
    const state = throwAt(twoPlayerLeg([20, 301], false), "20");
    expect(state.winner).toBe("p0");
  });

  it("restores the whole turn, not just the busting dart", () => {
    let state = twoPlayerLeg([100, 301]);
    state = throwAt(state, "20"); // 80
    state = throwAt(state, "T20"); // 20
    state = throwAt(state, "T20"); // would be -40
    expect(state.busted).toBe(true);
    expect(state.players[0].remaining).toBe(100);
  });

  it("counts busted darts as darts thrown", () => {
    const state = throwAt(twoPlayerLeg([10, 301]), "T20");
    expect(state.players[0].darts).toBe(1);
    expect(turnTotal(state.throws)).toBe(0);
  });
});

describe("checking out", () => {
  it("wins the leg on a double that lands exactly on zero", () => {
    const state = throwAt(twoPlayerLeg([40, 301]), "D20");
    expect(state.winner).toBe("p0");
    expect(state.phase).toBe("over");
    expect(state.players[0].legs).toBe(1);
  });

  it("accepts the bullseye as a double", () => {
    expect(throwAt(twoPlayerLeg([50, 301]), "Bull").winner).toBe("p0");
  });

  it("ranks everyone else by what they had left", () => {
    const state = throwAt(twoPlayerLeg([40, 120, 60]), "D20");
    expect(standings(state).map((p) => p.id)).toEqual(["p0", "p2", "p1"]);
    expect(state.players.map((p) => p.place)).toEqual([1, 3, 2]);
  });

  it("rotates who throws first in the next leg", () => {
    const state = nextLeg(throwAt(twoPlayerLeg([40, 301]), "D20"));
    expect(state.starter).toBe(1);
    expect(state.turn).toBe(1);
    expect(state.players.every((p) => p.remaining === START_SCORE)).toBe(true);
    expect(state.players[0].legs).toBe(1);
    expect(state.leg).toBe(2);
  });
});

describe("checkout routes", () => {
  it("suggests the classic nine-dart finishes", () => {
    expect(checkoutRoute(170, 3, true)).toEqual(["T20", "T20", "Bull"]);
    expect(checkoutRoute(167, 3, true)).toEqual(["T20", "T19", "Bull"]);
    expect(checkoutRoute(40, 3, true)).toEqual(["D20"]);
    expect(checkoutRoute(32, 1, true)).toEqual(["D16"]);
  });

  it("knows the scores that cannot be finished", () => {
    expect(checkoutRoute(169, 3, true)).toBeNull();
    expect(checkoutRoute(168, 3, true)).toBeNull();
    expect(checkoutRoute(171, 3, true)).toBeNull();
    expect(checkoutRoute(3, 1, true)).toBeNull();
  });

  it("never leaves a score of one when a double is needed", () => {
    for (let score = 2; score <= 170; score++) {
      const route = checkoutRoute(score, 3, true);
      if (!route) continue;
      expect(route[route.length - 1]).toMatch(/^(D\d+|Bull)$/);
    }
  });

  it("always adds up to the score it is checking out", () => {
    const value = (label: string) =>
      label === "Bull" ? 50 : label === "25" ? 25
      : label.startsWith("T") ? Number(label.slice(1)) * 3
      : label.startsWith("D") ? Number(label.slice(1)) * 2
      : Number(label);

    for (let score = 2; score <= 170; score++) {
      const route = checkoutRoute(score, 3, true);
      if (!route) continue;
      expect(route.reduce((sum, label) => sum + value(label), 0)).toBe(score);
    }
  });

  it("finishes on any single-dart number when double-out is off", () => {
    expect(checkoutRoute(60, 1, false)).toEqual(["T20"]);
    expect(checkoutRoute(7, 1, false)).toEqual(["7"]);
    // 21 needs a double-out player to set up first; straight out it is one dart.
    expect(checkoutRoute(21, 1, false)).toEqual(["T7"]);
    expect(checkoutRoute(21, 1, true)).toBeNull();
  });

  it("gives up when there are not enough darts", () => {
    expect(checkoutRoute(170, 2, true)).toBeNull();
    expect(checkoutRoute(0, 3, true)).toBeNull();
  });
});

describe("statistics", () => {
  it("averages points per three darts", () => {
    let state = twoPlayerLeg([START_SCORE, START_SCORE]);
    state = throwAt(state, "T20");
    state = throwAt(state, "T20");
    state = throwAt(state, "T20");
    expect(threeDartAverage(state.players[0])).toBe(180);
  });

  it("reports zero before anyone has thrown", () => {
    expect(threeDartAverage(twoPlayerLeg([301, 301]).players[0])).toBe(0);
  });
});

describe("the board as drawn", () => {
  it("paints a bed for every band of every sector", () => {
    expect(BEDS).toHaveLength(20 * 4);
    expect(NUMBERS.map((n) => n.sector)).toEqual([
      20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
    ]);
  });

  it("scores every painted bed as the colour under it promises", () => {
    // The invariant that matters: what you can see is what you score.
    BEDS.forEach((bed, i) => {
      const [r0, r1] = bed.band;
      const middle = (r0 + r1) / 2;
      const angle = Math.floor(i / 4) * 18;
      const hit = scoreAt(...point(middle, angle));

      expect(hit.sector, bed.d).toBe(bed.sector);
      if (bed.fill === PAINT.red || bed.fill === PAINT.green) {
        // Ring beds: the inner one trebles, the outer one doubles.
        expect(hit.ring).toBe(r1 > 0.9 ? "double" : "triple");
      } else {
        expect(hit.ring).toBe("single");
      }
    });
  });

  it("keeps every bed inside the viewBox", () => {
    for (const { x, y } of NUMBERS) {
      expect(Math.abs(x)).toBeLessThan(VIEW);
      expect(Math.abs(y)).toBeLessThan(VIEW);
    }
  });

  it("holds an aim point on the board", () => {
    expect(clampAim(0.5, 0)).toEqual({ x: 0.5, y: 0 });
    const far = clampAim(9, 0);
    expect(far.x).toBeCloseTo(1.02, 6);
    expect(Math.hypot(...Object.values(clampAim(-4, 4)) as [number, number])).toBeCloseTo(1.02, 6);
  });
});
