/**
 * TalkieGenZ: who is in the room, and who is allowed to hear whom.
 *
 * The shape of the thing: one person hosts, and every guest holds a data
 * connection to that host. The host is the only one who knows the whole
 * room, so it publishes the roster and relays "I am talking" flags — those
 * are a few bytes each and nobody notices a second hop.
 *
 * Voice does not work that way. Audio goes straight between every pair of
 * browsers, a full mesh, because routing it through the host would double
 * the delay and make one person's upload carry the whole room. That is also
 * what keeps DO101 out of the conversation entirely: there is no server in
 * the audio path to record anything, because there is no server at all.
 */

import { describePeerError, roomPeerId } from "@/lib/p2p/room";

export { makeRoomCode, normalizeRoomCode } from "@/lib/p2p/room";

export const TALKIE_PREFIX = "do101-talkie-";

/**
 * Six voices, including the host.
 *
 * In a mesh, whoever is talking uploads one copy of their audio per other
 * person in the room. At the capped bitrate that is about 24 kbps each, so
 * a full room costs a talker roughly 120 kbps up — fine on mobile data.
 * Doubling the room would double that, and the phone at the back of the
 * room is the one that would suffer.
 */
export const MAX_MEMBERS = 6;

export const MAX_NAME_LENGTH = 14;

export interface Member {
  /** The peer id, which is also the address audio is dialled on. */
  id: string;
  name: string;
  /** True while they are holding their talk button down. */
  talking: boolean;
  /**
   * False for somebody with no working microphone, who is here to listen.
   * A blocked permission should cost you the room, not your seat in it.
   */
  canTalk: boolean;
}

export type GuestMessage =
  | { type: "join"; name: string; canTalk: boolean }
  | { type: "talking"; on: boolean };

export type HostMessage =
  | { type: "roster"; you: string; members: Member[] }
  | { type: "rejected"; reason: RejectReason };

export type TalkieMessage = GuestMessage | HostMessage;

export type RejectReason = "full";

export function talkiePeerId(code: string): string {
  return roomPeerId(TALKIE_PREFIX, code);
}

export function explainTalkieError(type: string): string {
  return describePeerError(type, "TalkieGenZ");
}

export function explainRejection(reason: RejectReason): string {
  return reason === "full"
    ? `That room is full. TalkieGenZ rooms hold ${MAX_MEMBERS} people, so that everybody's phone can keep up.`
    : "The host turned the join down.";
}

/** Guards against a malformed or hostile message arriving over the wire. */
export function isTalkieMessage(value: unknown): value is TalkieMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as TalkieMessage).type === "string"
  );
}

/* ------------------------------ the roster ------------------------------ */

export function cleanName(raw: unknown, fallback = "Someone"): string {
  if (typeof raw !== "string") return fallback;
  // Control characters would let a name break the layout of everyone's list.
  const trimmed = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return trimmed.slice(0, MAX_NAME_LENGTH) || fallback;
}

/** Two people called Sam should still be able to tell each other apart. */
function uniqueName(members: Member[], wanted: string): string {
  if (!members.some((m) => m.name === wanted)) return wanted;
  for (let n = 2; n < 10; n++) {
    const candidate = `${wanted} ${n}`;
    if (!members.some((m) => m.name === candidate)) return candidate;
  }
  return wanted;
}

export function addMember(
  members: Member[],
  id: string,
  name: unknown,
  canTalk: unknown = true,
): Member[] {
  if (members.some((m) => m.id === id)) return members;
  return [
    ...members,
    { id, name: uniqueName(members, cleanName(name)), talking: false, canTalk: canTalk !== false },
  ];
}

export function removeMember(members: Member[], id: string): Member[] {
  return members.some((m) => m.id === id) ? members.filter((m) => m.id !== id) : members;
}

export function setTalking(members: Member[], id: string, on: boolean): Member[] {
  // Somebody with no microphone cannot be talking, whatever they claim.
  if (!members.some((m) => m.id === id && m.talking !== on && (m.canTalk || !on))) return members;
  return members.map((m) => (m.id === id ? { ...m, talking: on } : m));
}

export function isRoomFull(members: Member[]): boolean {
  return members.length >= MAX_MEMBERS;
}

/**
 * Which peers this browser should dial for audio.
 *
 * Every pair needs exactly one caller, or both sides ring at once and the
 * connection gets set up twice. Two rules settle it, and everyone can apply
 * them alone from the same roster without agreeing anything first:
 *
 * 1. Listeners never dial. They have no audio to offer, so they wait to be
 *    called and answer without a microphone — a one-way connection.
 * 2. Between two people who can talk, the smaller peer id dials.
 *
 * Which leaves two listeners never connecting to each other at all. That is
 * correct: neither has anything to send, so the connection would carry
 * silence in both directions.
 */
export function peersToDial(
  myId: string,
  members: Member[],
  alreadyConnected: ReadonlySet<string>,
): string[] {
  const me = members.find((m) => m.id === myId);
  if (!me?.canTalk) return [];
  return members
    .filter(
      (m) =>
        m.id !== myId && !alreadyConnected.has(m.id) && (!m.canTalk || myId < m.id),
    )
    .map((m) => m.id);
}

/** Audio connections that are no longer anybody in the room: hang them up. */
export function staleConnections(
  members: Member[],
  connected: Iterable<string>,
): string[] {
  const present = new Set(members.map((m) => m.id));
  return [...connected].filter((id) => !present.has(id));
}

/* ------------------------------ refereeing ------------------------------ */

export interface HostDecision {
  members: Member[];
  reply?: HostMessage;
  /** True once this guest is in the room, so the host keeps their line open. */
  admitted?: boolean;
  /** True when every guest needs to hear about this, not just the sender. */
  broadcast?: boolean;
}

/**
 * Everything a guest may ask the host for. Kept pure so the rules about who
 * is in the room can be tested without six browsers and six microphones.
 */
export function applyGuestMessage(
  members: Member[],
  peerId: string,
  raw: unknown,
): HostDecision {
  if (!isTalkieMessage(raw)) return { members };
  const message = raw as TalkieMessage;

  if (message.type === "join") {
    const rejoining = members.some((m) => m.id === peerId);
    if (!rejoining && isRoomFull(members)) {
      return { members, reply: { type: "rejected", reason: "full" } };
    }
    const next = rejoining ? members : addMember(members, peerId, message.name, message.canTalk);
    return { members: next, admitted: true, broadcast: true };
  }

  if (message.type === "talking") {
    if (typeof message.on !== "boolean") return { members };
    if (!members.some((m) => m.id === peerId)) return { members };
    // A listener claiming to be talking is either confused or lying.
    if (message.on && !members.find((m) => m.id === peerId)?.canTalk) return { members };
    const next = setTalking(members, peerId, message.on);
    return next === members ? { members } : { members: next, broadcast: true };
  }

  return { members };
}
