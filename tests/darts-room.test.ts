import { describe, it, expect } from "vitest";
import {
  DARTS_PREFIX,
  applyGuestMessage,
  dartsPeerId,
  explainDartsError,
  explainRejection,
  guestLeft,
  isDartsMessage,
  normalizeRoomCode,
} from "@/lib/games/darts-room";
import {
  MAX_PLAYERS,
  START_SCORE,
  addPlayer,
  createGame,
  currentPlayer,
  endTurn,
  isTurnOver,
  startLeg,
  type DartsState,
} from "@/lib/games/darts";

/** A point `r` out from the bullseye at `degrees` clockwise from the top. */
function point(degrees: number, r: number): [number, number] {
  const a = (degrees * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
}

const SECTOR_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

/** Coordinates for a called shot such as "T20" or "D16". */
function shot(target: string): [number, number] {
  if (target === "Bull") return [0, 0];
  const ring = target[0];
  const n = Number(ring === "T" || ring === "D" ? target.slice(1) : target);
  const r = ring === "T" ? 0.6 : ring === "D" ? 0.98 : 0.3;
  return point(SECTOR_ORDER.indexOf(n) * 18, r);
}

function roomWith(...names: string[]): DartsState {
  let state = createGame(true);
  state = addPlayer(state, "host", "Host");
  names.forEach((name, i) => {
    state = addPlayer(state, `guest${i + 1}`, name);
  });
  return state;
}

describe("room addressing", () => {
  it("namespaces peer ids so darts rooms never collide with other games", () => {
    expect(dartsPeerId("ABC12")).toBe(`${DARTS_PREFIX}ABC12`);
    expect(dartsPeerId("ABC12")).not.toBe("do101-battle-ABC12");
  });

  it("normalises a code typed with spaces or lower case", () => {
    expect(normalizeRoomCode(" ab-c12 ")).toBe("ABC12");
  });

  it("explains connection failures in plain language", () => {
    expect(explainDartsError("peer-unavailable")).toMatch(/no one is hosting/i);
    expect(explainDartsError("browser-incompatible")).toMatch(/Darts 301/);
    expect(explainRejection("full")).toMatch(/full/i);
    expect(explainRejection("in-progress")).toMatch(/already under way/i);
  });
});

describe("guarding the wire", () => {
  it("recognises only objects with a type", () => {
    expect(isDartsMessage({ type: "join", name: "Sam" })).toBe(true);
    expect(isDartsMessage(null)).toBe(false);
    expect(isDartsMessage("join")).toBe(false);
    expect(isDartsMessage({ name: "Sam" })).toBe(false);
  });

  it("ignores anything it does not understand", () => {
    const state = roomWith("Sam");
    expect(applyGuestMessage(state, "guest1", "nonsense").state).toBe(state);
    expect(applyGuestMessage(state, "guest1", { type: "resign" }).state).toBe(state);
    expect(applyGuestMessage(state, "guest1", null).state).toBe(state);
  });
});

describe("joining a room", () => {
  it("seats a guest and welcomes them with the current state", () => {
    const { state, reply, seated } = applyGuestMessage(roomWith(), "guest1", {
      type: "join",
      name: "Sam",
    });
    expect(seated).toBe(true);
    expect(state.players.map((p) => p.name)).toEqual(["Host", "Sam"]);
    expect(reply).toMatchObject({ type: "welcome", youId: "guest1" });
    expect(reply?.type === "welcome" && reply.state.players).toHaveLength(2);
  });

  it("turns away a sixth player", () => {
    const full = roomWith("A", "B", "C", "D");
    expect(full.players).toHaveLength(MAX_PLAYERS);
    const { state, reply } = applyGuestMessage(full, "guest5", { type: "join", name: "E" });
    expect(reply).toEqual({ type: "rejected", reason: "full" });
    expect(state).toBe(full);
  });

  it("turns away a newcomer once the leg is under way", () => {
    const playing = startLeg(roomWith("Sam"));
    const { reply } = applyGuestMessage(playing, "guest2", { type: "join", name: "Late" });
    expect(reply).toEqual({ type: "rejected", reason: "in-progress" });
  });

  it("lets a player who dropped out rejoin the leg they were in", () => {
    const playing = startLeg(roomWith("Sam"));
    const gone = guestLeft(playing, "guest1");
    expect(gone.players[1].connected).toBe(false);

    const { state, reply } = applyGuestMessage(gone, "guest1", { type: "join", name: "Sam" });
    expect(reply?.type).toBe("welcome");
    expect(state.players).toHaveLength(2);
    expect(state.players[1].connected).toBe(true);
  });

  it("survives a join with a name that is not a string", () => {
    const { state } = applyGuestMessage(roomWith(), "guest1", { type: "join", name: 42 });
    expect(state.players[1].name).toBe("Player");
  });
});

describe("refereeing throws", () => {
  it("accepts a throw from the player at the oche", () => {
    let state = startLeg(roomWith("Sam"));
    state = endTurn(state); // hand the darts to the guest
    expect(currentPlayer(state)?.id).toBe("guest1");

    const [x, y] = shot("T20");
    const after = applyGuestMessage(state, "guest1", { type: "throw", x, y }).state;
    expect(after.players[1].remaining).toBe(START_SCORE - 60);
  });

  it("ignores a throw from somebody else's turn", () => {
    const state = startLeg(roomWith("Sam")); // the host is throwing
    const [x, y] = shot("T20");
    expect(applyGuestMessage(state, "guest1", { type: "throw", x, y }).state).toBe(state);
  });

  it("ignores a throw before the leg starts", () => {
    const state = roomWith("Sam");
    const [x, y] = shot("T20");
    expect(applyGuestMessage(state, "guest1", { type: "throw", x, y }).state).toBe(state);
  });

  it("ignores a fourth dart while the turn is being handed over", () => {
    let state = endTurn(startLeg(roomWith("Sam")));
    const [x, y] = shot("20");
    for (let i = 0; i < 3; i++) {
      state = applyGuestMessage(state, "guest1", { type: "throw", x, y }).state;
    }
    expect(isTurnOver(state)).toBe(true);
    expect(applyGuestMessage(state, "guest1", { type: "throw", x, y }).state).toBe(state);
  });

  it("ignores coordinates that are not real numbers", () => {
    const state = endTurn(startLeg(roomWith("Sam")));
    for (const bad of [{ x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: "0", y: 0 }]) {
      expect(applyGuestMessage(state, "guest1", { type: "throw", ...bad }).state).toBe(state);
    }
  });
});

describe("leaving", () => {
  it("passes the darts on when the thrower disappears", () => {
    const state = startLeg(roomWith("Sam", "Alex"));
    expect(currentPlayer(state)?.id).toBe("host");
    const after = guestLeft(state, "host");
    expect(after.players[0].connected).toBe(false);
    expect(currentPlayer(after)?.id).toBe("guest1");
  });

  it("leaves the turn alone when somebody else drops out", () => {
    const state = startLeg(roomWith("Sam", "Alex"));
    const after = guestLeft(state, "guest2");
    expect(currentPlayer(after)?.id).toBe("host");
  });

  it("does nothing for a peer who was never a player", () => {
    const state = startLeg(roomWith("Sam"));
    expect(guestLeft(state, "stranger")).toBe(state);
  });
});

describe("a whole leg over the wire", () => {
  it("runs three players round the board until somebody checks out", () => {
    // The host is the referee; guests only ever send intent.
    let host = roomWith("Sam", "Alex");
    host = startLeg(host);

    /** Plays one turn for whoever is at the oche, as that player would. */
    const playTurn = (...targets: string[]) => {
      const id = currentPlayer(host)!.id;
      for (const target of targets) {
        const [x, y] = shot(target);
        host = id === "host"
          ? applyGuestMessage(host, "host", { type: "throw", x, y }).state
          : applyGuestMessage(host, id, { type: "throw", x, y }).state;
      }
      if (host.phase === "playing") host = endTurn(host);
    };

    playTurn("T20", "T20", "T20"); // host: 301 → 121
    playTurn("20", "20", "20"); // Sam: 301 → 241
    playTurn("T19", "T19", "19"); // Alex: 301 → 168

    expect(host.players.map((p) => p.remaining)).toEqual([121, 241, 168]);
    expect(currentPlayer(host)?.id).toBe("host");

    playTurn("T20", "1", "D20"); // host: 121 → 61 → 60 → 20, no checkout yet
    expect(host.players[0].remaining).toBe(20);

    playTurn("20", "20", "20"); // Sam: 241 → 181
    playTurn("T20", "T20", "T20"); // Alex: 168 → 48, then a third treble busts it
    expect(host.players[2].remaining).toBe(168);

    playTurn("D10"); // host checks out from 20
    expect(host.phase).toBe("over");
    expect(host.winner).toBe("host");
    expect(host.players[0].remaining).toBe(0);
    expect(host.players[0].legs).toBe(1);
    expect(host.players.map((p) => p.place)).toEqual([1, 3, 2]);
  });

  it("refuses every throw once the leg is won", () => {
    let host = startLeg(roomWith("Sam"));
    host = { ...host, players: host.players.map((p) => ({ ...p, remaining: 40 })), turnStart: 40 };
    const [dx, dy] = shot("D20");
    host = applyGuestMessage(host, "host", { type: "throw", x: dx, y: dy }).state;
    expect(host.phase).toBe("over");

    const [x, y] = shot("T20");
    expect(applyGuestMessage(host, "guest1", { type: "throw", x, y }).state).toBe(host);
  });
});
