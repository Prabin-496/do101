import { describe, it, expect } from "vitest";
import {
  MAX_MEMBERS,
  MAX_NAME_LENGTH,
  TALKIE_PREFIX,
  addMember,
  applyGuestMessage,
  cleanName,
  explainRejection,
  explainTalkieError,
  isRoomFull,
  isTalkieMessage,
  normalizeRoomCode,
  peersToDial,
  removeMember,
  setTalking,
  staleConnections,
  talkiePeerId,
  type Member,
} from "@/lib/talkie/protocol";
import {
  MAX_AUDIO_BITRATE,
  MIC_CONSTRAINTS,
  describeMicError,
  isAudible,
  isTransmitting,
  meterValue,
  rmsLevel,
  setTransmitting,
  smoothLevel,
} from "@/lib/talkie/audio";

const roster = (...names: string[]): Member[] =>
  names.reduce<Member[]>((members, name, i) => addMember(members, `peer-${i}`, name), []);

/** A roster where the named people are listeners with no microphone. */
const rosterWithListeners = (names: string[], listeners: string[]): Member[] =>
  names.reduce<Member[]>(
    (members, name, i) => addMember(members, `peer-${i}`, name, !listeners.includes(name)),
    [],
  );

describe("room addressing", () => {
  it("namespaces peer ids so a talkie room never collides with a game room", () => {
    expect(talkiePeerId("ABC12")).toBe(`${TALKIE_PREFIX}ABC12`);
    expect(talkiePeerId("ABC12")).not.toBe("do101-darts-ABC12");
  });

  it("normalises a code typed with spaces or lower case", () => {
    expect(normalizeRoomCode(" ab-c12 ")).toBe("ABC12");
  });

  it("explains failures in plain language", () => {
    expect(explainTalkieError("peer-unavailable")).toMatch(/no one is hosting/i);
    expect(explainTalkieError("browser-incompatible")).toMatch(/TalkieGenZ/);
    expect(explainRejection("full")).toMatch(/full/i);
  });
});

describe("names", () => {
  it("falls back when a name is missing or not text", () => {
    expect(cleanName("")).toBe("Someone");
    expect(cleanName(undefined)).toBe("Someone");
    expect(cleanName(42)).toBe("Someone");
    expect(cleanName("   ")).toBe("Someone");
  });

  it("strips control characters that would break everyone's list", () => {
    expect(cleanName("Sa\u0000m\u001b")).toBe("Sam");
    expect(cleanName("line\nbreak")).toBe("linebreak");
  });

  it("caps an over-long name", () => {
    expect(cleanName("x".repeat(80))).toHaveLength(MAX_NAME_LENGTH);
  });

  it("tells two people with the same name apart", () => {
    expect(roster("Sam", "Sam", "Sam").map((m) => m.name)).toEqual(["Sam", "Sam 2", "Sam 3"]);
  });
});

describe("the roster", () => {
  it("never adds the same peer twice", () => {
    const members = addMember(roster("Sam"), "peer-0", "Sam again");
    expect(members).toHaveLength(1);
  });

  it("removes a peer, and says nothing changed when there was none", () => {
    const members = roster("Sam", "Alex");
    expect(removeMember(members, "peer-0")).toHaveLength(1);
    expect(removeMember(members, "ghost")).toBe(members);
  });

  it("flags who is talking, and keeps the same array when nothing changed", () => {
    const members = roster("Sam", "Alex");
    const talking = setTalking(members, "peer-1", true);
    expect(talking[1].talking).toBe(true);
    expect(talking[0].talking).toBe(false);
    expect(setTalking(talking, "peer-1", true)).toBe(talking);
    expect(setTalking(members, "ghost", true)).toBe(members);
  });

  it("knows when the room is full", () => {
    const names = Array.from({ length: MAX_MEMBERS }, (_, i) => `P${i}`);
    expect(isRoomFull(roster(...names))).toBe(true);
    expect(isRoomFull(roster(...names.slice(1)))).toBe(false);
  });
});

describe("who dials whom", () => {
  it("gives every pair exactly one caller", () => {
    const members = roster("A", "B", "C", "D");
    const ids = members.map((m) => m.id);
    const calls = new Set<string>();

    for (const me of ids) {
      for (const them of peersToDial(me, members, new Set())) {
        calls.add([me, them].sort().join("↔"));
      }
    }
    // Four people make six pairs, and each is dialled once.
    expect(calls.size).toBe(6);
  });

  it("never dials yourself", () => {
    const members = roster("A", "B");
    expect(peersToDial("peer-0", members, new Set())).not.toContain("peer-0");
  });

  it("does not dial someone already connected", () => {
    const members = roster("A", "B", "C");
    expect(peersToDial("peer-0", members, new Set(["peer-1"]))).toEqual(["peer-2"]);
  });

  it("settles a simultaneous join without both sides ringing", () => {
    const members = roster("A", "B");
    const [a, b] = members.map((m) => m.id);
    const aDials = peersToDial(a, members, new Set());
    const bDials = peersToDial(b, members, new Set());
    expect(aDials.length + bDials.length).toBe(1);
  });

  it("never asks a listener to dial", () => {
    const members = rosterWithListeners(["A", "B", "C"], ["A"]);
    expect(peersToDial("peer-0", members, new Set())).toEqual([]);
  });

  it("has a talker dial a listener whichever way the ids fall", () => {
    // "peer-2" sorts after "peer-0", so the id rule alone would not dial it.
    const members = rosterWithListeners(["A", "B", "C"], ["A"]);
    expect(peersToDial("peer-1", members, new Set())).toContain("peer-0");
    expect(peersToDial("peer-2", members, new Set())).toContain("peer-0");
  });

  it("leaves two listeners unconnected, since neither has anything to send", () => {
    const members = rosterWithListeners(["A", "B"], ["A", "B"]);
    expect(peersToDial("peer-0", members, new Set())).toEqual([]);
    expect(peersToDial("peer-1", members, new Set())).toEqual([]);
  });

  it("still gives every talking pair exactly one caller when listeners are mixed in", () => {
    const members = rosterWithListeners(["A", "B", "C", "D"], ["B"]);
    const calls = new Map<string, number>();
    for (const me of members.map((m) => m.id)) {
      for (const them of peersToDial(me, members, new Set())) {
        const pair = [me, them].sort().join("↔");
        calls.set(pair, (calls.get(pair) ?? 0) + 1);
      }
    }
    // Three talkers make three pairs, and each reaches the one listener once.
    expect([...calls.values()].every((n) => n === 1)).toBe(true);
    expect(calls.size).toBe(6);
  });

  it("hangs up on audio connections to people who have left", () => {
    const members = roster("A", "B");
    expect(staleConnections(members, ["peer-0", "peer-9"])).toEqual(["peer-9"]);
    expect(staleConnections(members, ["peer-0", "peer-1"])).toEqual([]);
  });
});

describe("guarding the wire", () => {
  it("recognises only objects with a type", () => {
    expect(isTalkieMessage({ type: "join", name: "Sam" })).toBe(true);
    expect(isTalkieMessage(null)).toBe(false);
    expect(isTalkieMessage("join")).toBe(false);
  });

  it("ignores anything it does not understand", () => {
    const members = roster("Sam");
    for (const junk of ["nonsense", null, { type: "kick", id: "peer-0" }]) {
      expect(applyGuestMessage(members, "peer-1", junk).members).toBe(members);
    }
  });
});

describe("letting people in", () => {
  it("admits a guest and tells the room", () => {
    const decision = applyGuestMessage(roster("Host"), "peer-9", { type: "join", name: "Sam", canTalk: true });
    expect(decision.admitted).toBe(true);
    expect(decision.broadcast).toBe(true);
    expect(decision.members.map((m) => m.name)).toEqual(["Host", "Sam"]);
  });

  it("turns away one voice too many", () => {
    const full = roster(...Array.from({ length: MAX_MEMBERS }, (_, i) => `P${i}`));
    const decision = applyGuestMessage(full, "peer-99", { type: "join", name: "Late", canTalk: true });
    expect(decision.reply).toEqual({ type: "rejected", reason: "full" });
    expect(decision.members).toBe(full);
  });

  it("lets somebody who is already in rejoin without taking a second slot", () => {
    const members = roster("Host", "Sam");
    const decision = applyGuestMessage(members, "peer-1", { type: "join", name: "Sam", canTalk: true });
    expect(decision.admitted).toBe(true);
    expect(decision.members).toHaveLength(2);
  });

  it("survives a join with a name that is not a string", () => {
    const decision = applyGuestMessage(roster("Host"), "peer-9", { type: "join", name: { x: 1 }, canTalk: true });
    expect(decision.members[1].name).toBe("Someone");
  });

  it("seats somebody whose microphone was blocked as a listener", () => {
    const decision = applyGuestMessage(roster("Host"), "peer-9", {
      type: "join",
      name: "Sam",
      canTalk: false,
    });
    expect(decision.admitted).toBe(true);
    expect(decision.members[1]).toMatchObject({ name: "Sam", canTalk: false });
  });
});

describe("push to talk over the wire", () => {
  it("raises and lowers the flag for the peer who sent it", () => {
    const members = roster("Host", "Sam");
    const on = applyGuestMessage(members, "peer-1", { type: "talking", on: true });
    expect(on.members[1].talking).toBe(true);
    expect(on.broadcast).toBe(true);

    const off = applyGuestMessage(on.members, "peer-1", { type: "talking", on: false });
    expect(off.members[1].talking).toBe(false);
  });

  it("refuses a flag from somebody who is not in the room", () => {
    const members = roster("Host");
    expect(applyGuestMessage(members, "stranger", { type: "talking", on: true }).members).toBe(members);
  });

  it("refuses a talking flag from a listener with no microphone", () => {
    const members = rosterWithListeners(["Host", "Sam"], ["Sam"]);
    expect(applyGuestMessage(members, "peer-1", { type: "talking", on: true }).members).toBe(members);
  });

  it("refuses a flag that is not a yes or a no", () => {
    const members = roster("Host", "Sam");
    expect(applyGuestMessage(members, "peer-1", { type: "talking", on: "yes" }).members).toBe(members);
  });

  it("says nothing when the flag has not changed", () => {
    const members = roster("Host", "Sam");
    expect(applyGuestMessage(members, "peer-1", { type: "talking", on: false }).broadcast).toBeFalsy();
  });
});

/* ------------------------------- audio ------------------------------- */

describe("the microphone", () => {
  it("asks for one channel of processed voice and no camera", () => {
    const audio = MIC_CONSTRAINTS.audio as MediaTrackConstraints;
    expect(MIC_CONSTRAINTS.video).toBe(false);
    expect(audio.channelCount).toBe(1);
    expect(audio.echoCancellation).toBe(true);
    expect(audio.noiseSuppression).toBe(true);
  });

  it("caps the bitrate low enough for a full room on mobile data", () => {
    // Whoever is talking sends one copy per listener.
    expect(MAX_AUDIO_BITRATE * (MAX_MEMBERS - 1)).toBeLessThanOrEqual(128_000);
  });

  it("switches transmission on and off without touching the connection", () => {
    const track = { kind: "audio", enabled: true, stop() {} };
    const stream = { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;

    setTransmitting(stream, false);
    expect(track.enabled).toBe(false);
    expect(isTransmitting(stream)).toBe(false);

    setTransmitting(stream, true);
    expect(isTransmitting(stream)).toBe(true);
  });

  it("does not fall over when there is no microphone at all", () => {
    expect(() => setTransmitting(null, true)).not.toThrow();
    expect(isTransmitting(null)).toBe(false);
  });

  it("explains every way a browser refuses a microphone", () => {
    expect(describeMicError({ name: "NotAllowedError" })).toMatch(/blocked the microphone/i);
    expect(describeMicError({ name: "NotFoundError" })).toMatch(/no microphone/i);
    expect(describeMicError({ name: "NotReadableError" })).toMatch(/another app/i);
    expect(describeMicError(new Error("boom"))).toMatch(/could not be opened/i);
  });
});

describe("the level meter", () => {
  const wave = (amplitude: number, length = 128) =>
    Array.from({ length }, (_, i) => 128 + Math.round(Math.sin((i / length) * Math.PI * 8) * amplitude));

  it("reads silence as nothing", () => {
    expect(rmsLevel(new Array(128).fill(128))).toBe(0);
    expect(rmsLevel([])).toBe(0);
  });

  it("rises with loudness", () => {
    const quiet = rmsLevel(wave(6));
    const loud = rmsLevel(wave(60));
    expect(loud).toBeGreaterThan(quiet);
    expect(loud).toBeLessThanOrEqual(1);
  });

  it("keeps the drawn meter inside its bar", () => {
    expect(meterValue(0)).toBe(0);
    expect(meterValue(5)).toBe(1);
    expect(meterValue(0.1)).toBeGreaterThan(0.1);
  });

  it("jumps up and eases down", () => {
    expect(smoothLevel(0.1, 0.9)).toBe(0.9);
    const falling = smoothLevel(0.9, 0);
    expect(falling).toBeLessThan(0.9);
    expect(falling).toBeGreaterThan(0);
  });

  it("knows speech from room noise", () => {
    expect(isAudible(rmsLevel(wave(40)))).toBe(true);
    expect(isAudible(rmsLevel(wave(1)))).toBe(false);
  });
});
