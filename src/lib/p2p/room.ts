/**
 * Shared plumbing for DO101's peer-to-peer rooms.
 *
 * Browsers talk directly to each other over WebRTC. A free public PeerJS
 * broker is used only to exchange connection details; nothing that happens
 * in a room passes through a DO101 server, and there is no database keeping
 * rooms alive — a room exists while the host's tab is open.
 *
 * Used by Typing Battle, Darts 301 and TalkieGenZ.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1

export function makeRoomCode(length = 5): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

/** Namespaces a code per game, so two DO101 rooms can share a code safely. */
export function roomPeerId(prefix: string, code: string): string {
  return `${prefix}${code}`;
}

/** Human-readable explanations for the PeerJS error types we can hit. */
export function describePeerError(type: string, feature = "this game"): string {
  switch (type) {
    case "unavailable-id":
      return "That room code is already in use. Create a new room to get a fresh code.";
    case "peer-unavailable":
      return "No one is hosting that room. The code may be wrong, or the host may have closed their tab.";
    case "network":
      return "Lost contact with the signalling server. Check your connection and try again.";
    case "server-error":
      return "The public signalling service is not responding right now. Please try again in a moment.";
    case "browser-incompatible":
      return `This browser does not support the WebRTC data channels ${feature} needs.`;
    case "webrtc":
      return "The peer-to-peer connection failed. Strict firewalls and some mobile networks block it.";
    case "disconnected":
      return "Disconnected from the signalling server.";
    default:
      return "The connection failed. Try creating a new room.";
  }
}
