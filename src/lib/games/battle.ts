/**
 * Typing Battle wire protocol.
 *
 * The connection itself is shared with the other peer-to-peer games and
 * lives in ./room — see the note there on why a room has no server behind it.
 */

import { describePeerError, roomPeerId } from "@/lib/p2p/room";

export { makeRoomCode, normalizeRoomCode } from "@/lib/p2p/room";

export type BattleMessage =
  | { type: "hello"; name: string }
  | { type: "start"; seed: number; startAt: number }
  | { type: "progress"; chars: number; wpm: number; accuracy: number }
  | { type: "finish"; wpm: number; accuracy: number; elapsed: number }
  | { type: "rematch" };

export const BATTLE_PREFIX = "do101-battle-";
export const BATTLE_WORDS = 45;
export const COUNTDOWN_MS = 4000;

export function peerIdFor(code: string): string {
  return roomPeerId(BATTLE_PREFIX, code);
}

/** Human-readable explanations for the PeerJS error types we can hit. */
export function explainPeerError(type: string): string {
  return describePeerError(type, "Typing Battle");
}
