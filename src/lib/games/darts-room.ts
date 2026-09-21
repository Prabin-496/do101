/**
 * Darts 301 wire protocol.
 *
 * The host's browser is the referee: it holds the one true game state,
 * applies every throw and broadcasts the whole state back out. Guests send
 * intent ("I threw here") and render whatever comes back, so nobody can
 * disagree about the score and there is nothing to reconcile.
 *
 * The state is a few hundred bytes, so sending all of it beats sending
 * deltas — there is no version where a dropped packet leaves two players
 * looking at different scoreboards.
 */

import {
  MAX_PLAYERS,
  addPlayer,
  currentPlayer,
  dropPlayer,
  endTurn,
  isTurnOver,
  setConnected,
  throwDart,
  type DartsState,
} from "./darts";
import { describePeerError, roomPeerId } from "@/lib/p2p/room";

export { makeRoomCode, normalizeRoomCode } from "@/lib/p2p/room";

export const DARTS_PREFIX = "do101-darts-";

/** How long everyone sees the finished turn before the darts move on. */
export const TURN_HANDOVER_MS = 1800;

export type GuestMessage =
  | { type: "join"; name: string }
  | { type: "throw"; x: number; y: number };

export type HostMessage =
  | { type: "welcome"; youId: string; state: DartsState }
  | { type: "state"; state: DartsState }
  | { type: "rejected"; reason: RejectReason };

export type DartsMessage = GuestMessage | HostMessage;

export type RejectReason = "full" | "in-progress";

export function dartsPeerId(code: string): string {
  return roomPeerId(DARTS_PREFIX, code);
}

export function explainDartsError(type: string): string {
  return describePeerError(type, "Darts 301");
}

export function explainRejection(reason: RejectReason): string {
  return reason === "full"
    ? "That room is full — five players are already at the oche."
    : "That game is already under way. Ask the host to start a new leg, then join again.";
}

/** Guards against a malformed or hostile message arriving over the wire. */
export function isDartsMessage(value: unknown): value is DartsMessage {
  return typeof value === "object" && value !== null && typeof (value as DartsMessage).type === "string";
}

/* ------------------------------ refereeing ------------------------------ */

export interface HostDecision {
  /** The state the host should now hold — unchanged if nothing was allowed. */
  state: DartsState;
  /** A message for the guest who sent this one, if they are owed an answer. */
  reply?: HostMessage;
  /** True once this guest is a player, so the host should keep their line open. */
  seated?: boolean;
}

/**
 * The referee. Everything a guest may ask for goes through here, so the rules
 * about who can throw when live next to the rules about what a throw is worth
 * — and can be tested without a second browser.
 */
export function applyGuestMessage(
  state: DartsState,
  peerId: string,
  raw: unknown,
): HostDecision {
  if (!isDartsMessage(raw)) return { state };
  const message = raw as DartsMessage;

  if (message.type === "join") {
    const rejoining = state.players.some((p) => p.id === peerId);
    if (state.phase === "playing" && !rejoining) {
      return { state, reply: { type: "rejected", reason: "in-progress" } };
    }
    if (!rejoining && state.players.length >= MAX_PLAYERS) {
      return { state, reply: { type: "rejected", reason: "full" } };
    }
    const name = typeof message.name === "string" ? message.name : "Player";
    const next = rejoining ? setConnected(state, peerId, true) : addPlayer(state, peerId, name);
    return { state: next, seated: true, reply: { type: "welcome", youId: peerId, state: next } };
  }

  if (message.type === "throw") {
    // Only the player at the oche throws, only on their own turn, only numbers.
    if (state.phase !== "playing" || isTurnOver(state)) return { state };
    if (currentPlayer(state)?.id !== peerId) return { state };
    if (!Number.isFinite(message.x) || !Number.isFinite(message.y)) return { state };
    return { state: throwDart(state, message.x, message.y) };
  }

  return { state };
}

/** Someone closed their tab: drop them, and move on if it was their throw. */
export function guestLeft(state: DartsState, peerId: string): DartsState {
  if (!state.players.some((p) => p.id === peerId)) return state;
  const wasThrowing = currentPlayer(state)?.id === peerId;
  const next = dropPlayer(state, peerId);
  return wasThrowing && next.phase === "playing" ? endTurn(next) : next;
}
