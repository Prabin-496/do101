"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import type { DataConnection, MediaConnection, Peer } from "peerjs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Toggle } from "@/components/ui/Field";
import { CopyButton } from "@/components/ui/CopyButton";
import { ErrorState, InfoNote } from "@/components/ui/Feedback";
import { TalkButton } from "./TalkButton";
import {
  MAX_MEMBERS,
  MAX_NAME_LENGTH,
  addMember,
  applyGuestMessage,
  cleanName,
  explainRejection,
  explainTalkieError,
  isTalkieMessage,
  makeRoomCode,
  normalizeRoomCode,
  peersToDial,
  removeMember,
  setTalking,
  staleConnections,
  talkiePeerId,
  type GuestMessage,
  type HostMessage,
  type Member,
  type TalkieMessage,
} from "@/lib/talkie/protocol";
import {
  capBitrate,
  closeMicrophone,
  describeMicError,
  meterValue,
  openMicrophone,
  rmsLevel,
  setTransmitting,
  smoothLevel,
  supportsVoiceChat,
} from "@/lib/talkie/audio";
import { SITE } from "@/lib/site";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

type Status = "idle" | "connecting" | "open" | "lost";
/** How a single audio connection to one other person is getting on. */
type Link = "connecting" | "live" | "failed";

const TONES = ["cherry", "sky", "grass", "grape", "fire", "sun"] as const;

/** Browser support is fixed for the life of the page; nothing to subscribe to. */
const NO_SUBSCRIBE = () => () => {};

export function TalkieGenZ() {
  const searchParams = useSearchParams();

  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [micError, setMicError] = React.useState<string | null>(null);
  const [inRoom, setInRoom] = React.useState(false);
  const [room, setRoom] = React.useState("");
  const [joinCode, setJoinCode] = React.useState(() =>
    normalizeRoomCode(searchParams.get("room") ?? ""),
  );
  const [name, setName] = React.useState("");
  const [members, setMembers] = React.useState<Member[]>([]);
  const [myId, setMyId] = React.useState("");
  const [talking, setTalkingState] = React.useState(false);
  const [level, setLevel] = React.useState(0);
  const [handsFree, setHandsFree] = React.useState(false);
  const [listening, setListening] = React.useState(true);
  const [streams, setStreams] = React.useState<Map<string, MediaStream>>(new Map());
  const [links, setLinks] = React.useState<Map<string, Link>>(new Map());

  const peerRef = React.useRef<Peer | null>(null);
  const micRef = React.useRef<MediaStream | null>(null);
  /** Host: the control line to each guest. Guest: just the one to the host. */
  const guestsRef = React.useRef(new Map<string, DataConnection>());
  const hostConnRef = React.useRef<DataConnection | null>(null);
  /** One audio connection per other person in the room. */
  const callsRef = React.useRef(new Map<string, MediaConnection>());
  const isHostRef = React.useRef(false);
  const membersRef = React.useRef<Member[]>([]);
  const myIdRef = React.useRef("");
  const nameRef = React.useRef("");
  const canTalkRef = React.useRef(false);

  React.useEffect(() => {
    nameRef.current = name;
  }, [name]);

  /**
   * Whether this browser can do voice at all. Read through an external
   * store because `navigator` does not exist during server rendering, and
   * the answer never changes once the page is running.
   */
  const supported = React.useSyncExternalStore(
    NO_SUBSCRIBE,
    supportsVoiceChat,
    () => true,
  );

  /* ------------------------------ plumbing ------------------------------ */

  const publishRoster = React.useCallback((next: Member[]) => {
    for (const [id, conn] of guestsRef.current) {
      if (!conn.open) continue;
      try {
        conn.send({ type: "roster", you: id, members: next } satisfies HostMessage);
      } catch {
        /* the channel closed mid-send; its close handler cleans up */
      }
    }
  }, []);

  const sendToHost = React.useCallback((message: GuestMessage) => {
    const conn = hostConnRef.current;
    if (!conn?.open) return;
    try {
      conn.send(message);
    } catch {
      /* reported by the close handler */
    }
  }, []);

  const dropCall = React.useCallback((peerId: string) => {
    callsRef.current.get(peerId)?.close();
    callsRef.current.delete(peerId);
    setStreams((prev) => {
      if (!prev.has(peerId)) return prev;
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
    setLinks((prev) => {
      if (!prev.has(peerId)) return prev;
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  const wireCall = React.useCallback(
    (call: MediaConnection) => {
      callsRef.current.set(call.peer, call);
      setLinks((prev) => new Map(prev).set(call.peer, "connecting"));

      call.on("stream", (stream) => {
        setStreams((prev) => new Map(prev).set(call.peer, stream));
      });
      call.on("close", () => dropCall(call.peer));
      call.on("error", () => dropCall(call.peer));

      // Watching ICE directly is the only honest way to tell "still trying"
      // from "this pair of networks will not connect at all".
      const connection = call.peerConnection;
      if (!connection) return;
      void capBitrate(connection);
      const onChange = () => {
        const state = connection.iceConnectionState;
        setLinks((prev) =>
          new Map(prev).set(
            call.peer,
            state === "connected" || state === "completed"
              ? "live"
              : state === "failed"
                ? "failed"
                : "connecting",
          ),
        );
      };
      connection.addEventListener("iceconnectionstatechange", onChange);
      onChange();
    },
    [dropCall],
  );

  /** Opens exactly the audio connections the roster says are missing. */
  const reconcileAudio = React.useCallback(
    (next: Member[]) => {
      const peer = peerRef.current;
      const me = myIdRef.current;
      if (!peer || !me) return;

      for (const id of staleConnections(next, [...callsRef.current.keys()])) dropCall(id);

      for (const id of peersToDial(me, next, new Set(callsRef.current.keys()))) {
        const mic = micRef.current;
        if (!mic) continue; // Listeners never dial; they are called instead.
        try {
          wireCall(peer.call(id, mic));
        } catch {
          setLinks((prev) => new Map(prev).set(id, "failed"));
        }
      }
    },
    [dropCall, wireCall],
  );

  /** The one place the roster changes: the host writes, everyone hears. */
  const commitMembers = React.useCallback(
    (next: Member[]) => {
      membersRef.current = next;
      setMembers(next);
      if (isHostRef.current) publishRoster(next);
      reconcileAudio(next);
    },
    [publishRoster, reconcileAudio],
  );

  const teardown = React.useCallback(() => {
    for (const call of callsRef.current.values()) call.close();
    callsRef.current.clear();
    for (const conn of guestsRef.current.values()) conn.close();
    guestsRef.current.clear();
    hostConnRef.current?.close();
    hostConnRef.current = null;
    peerRef.current?.destroy();
    peerRef.current = null;
    closeMicrophone(micRef.current);
    micRef.current = null;
    canTalkRef.current = false;
  }, []);

  React.useEffect(() => () => teardown(), [teardown]);

  /* ---------------------------- the microphone ---------------------------- */

  /** Opens the microphone muted. A refusal costs you the mic, not the room. */
  const prepareMic = React.useCallback(async (): Promise<boolean> => {
    setMicError(null);
    try {
      micRef.current = await openMicrophone();
      canTalkRef.current = true;
      return true;
    } catch (err) {
      micRef.current = null;
      canTalkRef.current = false;
      setMicError(describeMicError(err));
      return false;
    }
  }, []);

  const stopTalking = React.useCallback(() => {
    setTransmitting(micRef.current, false);
    setTalkingState(false);
    setLevel(0);
    if (isHostRef.current) commitMembers(setTalking(membersRef.current, myIdRef.current, false));
    else sendToHost({ type: "talking", on: false });
  }, [commitMembers, sendToHost]);

  const startTalking = React.useCallback(() => {
    if (!micRef.current) return;
    setTransmitting(micRef.current, true);
    setTalkingState(true);
    if (isHostRef.current) commitMembers(setTalking(membersRef.current, myIdRef.current, true));
    else sendToHost({ type: "talking", on: true });
  }, [commitMembers, sendToHost]);

  // Tabbing away, hiding the page or losing the window must never leave a
  // microphone live. This is the safety net behind the button's own.
  React.useEffect(() => {
    if (!talking) return;
    const stop = () => stopTalking();
    const onHide = () => {
      if (document.visibilityState === "hidden") stop();
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [talking, stopTalking]);

  // A level meter, running only while the microphone is actually open.
  React.useEffect(() => {
    const mic = micRef.current;
    if (!talking || !mic) return;

    let frame = 0;
    let context: AudioContext | null = null;
    let smoothed = 0;
    try {
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(mic).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);

      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        smoothed = smoothLevel(smoothed, rmsLevel(samples));
        setLevel(meterValue(smoothed));
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    } catch {
      /* no meter, but the microphone itself is unaffected */
    }

    return () => {
      cancelAnimationFrame(frame);
      void context?.close();
    };
  }, [talking]);

  /* ------------------------------- hosting ------------------------------- */

  const handleGuestMessage = React.useCallback(
    (conn: DataConnection, raw: unknown) => {
      const decision = applyGuestMessage(membersRef.current, conn.peer, raw);
      if (decision.admitted) guestsRef.current.set(conn.peer, conn);
      if (decision.reply && conn.open) conn.send(decision.reply);
      if (decision.broadcast) commitMembers(decision.members);
      else if (decision.admitted && conn.open) {
        conn.send({ type: "roster", you: conn.peer, members: membersRef.current } satisfies HostMessage);
      }
    },
    [commitMembers],
  );

  const handleGuestGone = React.useCallback(
    (peerId: string) => {
      guestsRef.current.delete(peerId);
      dropCall(peerId);
      const next = removeMember(membersRef.current, peerId);
      if (next !== membersRef.current) commitMembers(next);
    },
    [commitMembers, dropCall],
  );

  const createRoom = React.useCallback(async () => {
    setError(null);
    setStatus("connecting");
    isHostRef.current = true;

    // The microphone is asked for before anything connects, so a refusal
    // never happens halfway into somebody else's conversation.
    const canTalk = await prepareMic();
    const code = makeRoomCode();
    setRoom(code);

    try {
      const { Peer: PeerCtor } = await import("peerjs");
      const peer = new PeerCtor(talkiePeerId(code), { debug: 0 });
      peerRef.current = peer;

      peer.on("open", (id) => {
        setMyId(id);
        myIdRef.current = id;
        setStatus("open");
        setInRoom(true);
        commitMembers(addMember([], id, nameRef.current || "Host", canTalk));
        track("tool_complete", { tool: "talkie-genz", role: "host" });
      });

      peer.on("connection", (conn) => {
        conn.on("data", (raw) => handleGuestMessage(conn, raw));
        conn.on("close", () => handleGuestGone(conn.peer));
        conn.on("error", () => handleGuestGone(conn.peer));
      });

      peer.on("call", (call) => {
        call.answer(micRef.current ?? undefined);
        wireCall(call);
      });

      peer.on("error", (err: { type?: string }) => {
        setStatus("lost");
        setError(explainTalkieError(err?.type ?? ""));
      });
    } catch {
      setStatus("lost");
      setError("TalkieGenZ could not load its connection library. Check your network and retry.");
    }
  }, [prepareMic, commitMembers, handleGuestMessage, handleGuestGone, wireCall]);

  /* ------------------------------- joining ------------------------------- */

  const joinRoom = React.useCallback(
    async (rawCode: string) => {
      const code = normalizeRoomCode(rawCode);
      if (code.length < 4) {
        setError("Room codes are five characters, like ABC12.");
        return;
      }
      setError(null);
      setStatus("connecting");
      isHostRef.current = false;
      setRoom(code);

      const canTalk = await prepareMic();

      try {
        const { Peer: PeerCtor } = await import("peerjs");
        const peer = new PeerCtor({ debug: 0 });
        peerRef.current = peer;

        peer.on("open", () => {
          const conn = peer.connect(talkiePeerId(code), { reliable: true });
          hostConnRef.current = conn;

          conn.on("open", () => {
            setStatus("open");
            conn.send({
              type: "join",
              name: cleanName(nameRef.current, "Guest"),
              canTalk,
            } satisfies GuestMessage);
            track("tool_complete", { tool: "talkie-genz", role: "guest" });
          });

          conn.on("data", (raw) => {
            if (!isTalkieMessage(raw)) return;
            const message = raw as TalkieMessage;
            if (message.type === "roster") {
              setMyId(message.you);
              myIdRef.current = message.you;
              setInRoom(true);
              commitMembers(message.members);
            } else if (message.type === "rejected") {
              setStatus("lost");
              setError(explainRejection(message.reason));
              teardown();
            }
          });

          conn.on("close", () => {
            setStatus("lost");
            setError("The host closed the room, so everyone has been hung up on.");
          });
          conn.on("error", () => {
            setStatus("lost");
            setError("The connection to the host dropped.");
          });
        });

        peer.on("call", (call) => {
          call.answer(micRef.current ?? undefined);
          wireCall(call);
        });

        peer.on("error", (err: { type?: string }) => {
          setStatus("lost");
          setError(explainTalkieError(err?.type ?? ""));
        });
      } catch {
        setStatus("lost");
        setError("TalkieGenZ could not load its connection library. Check your network and retry.");
      }
    },
    [prepareMic, commitMembers, teardown, wireCall],
  );

  const leave = React.useCallback(() => {
    teardown();
    setInRoom(false);
    setStatus("idle");
    setError(null);
    setMicError(null);
    setRoom("");
    setMembers([]);
    membersRef.current = [];
    setMyId("");
    myIdRef.current = "";
    setTalkingState(false);
    setLevel(0);
    setStreams(new Map());
    setLinks(new Map());
  }, [teardown]);

  /* ------------------------------- screens ------------------------------- */

  if (!supported) {
    return (
      <ErrorState
        title="This browser cannot do voice"
        message="TalkieGenZ needs WebRTC and a microphone, which this browser does not offer. A current Chrome, Edge, Firefox or Safari will work — and the page must be on https, which it is."
      />
    );
  }

  if (!inRoom) {
    return (
      <MenuScreen
        name={name}
        setName={setName}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        onCreate={createRoom}
        onJoin={() => joinRoom(joinCode)}
        busy={status === "connecting"}
        error={error}
        micError={micError}
        onReset={leave}
      />
    );
  }

  const me = members.find((m) => m.id === myId) ?? null;
  const others = members.filter((m) => m.id !== myId);
  const canTalk = me?.canTalk ?? false;
  const roomLink = room ? `${SITE.url}/tools/talkie-genz?room=${room}` : "";
  const failed = others.filter((m) => links.get(m.id) === "failed");

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
            Room code
          </p>
          <p className="font-mono text-3xl font-extrabold tracking-[0.2em]">{room}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton value={room} label="Copy code" tone="panel" size="sm" />
          <CopyButton value={roomLink} label="Copy invite link" tone="sky" size="sm" />
          <Button tone="ghost" size="sm" onClick={leave}>
            Leave
          </Button>
        </div>
      </Card>

      {error && status === "lost" ? <ErrorState message={error} /> : null}

      {micError ? (
        <ErrorState
          title="You are in the room, but only listening"
          message={`${micError} You can hear everyone, and they can see you are here. To talk, leave and come back once the microphone is allowed.`}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <Card className="p-6">
          <TalkButton
            ready={canTalk}
            talking={talking}
            level={level}
            handsFree={handsFree}
            onStart={startTalking}
            onStop={stopTalking}
            hint={
              !canTalk
                ? "No microphone — you are listening only"
                : others.length === 0
                  ? "Nobody else is here yet, but your mic is ready"
                  : "Your microphone is off"
            }
          />

          <div className="mt-6 space-y-3">
            <Toggle
              checked={handsFree}
              onChange={(on) => {
                if (talking) stopTalking();
                setHandsFree(on);
              }}
              label="Hands-free"
              description="Tap once to start talking and once to stop, instead of holding the button down."
            />
            <Toggle
              checked={listening}
              onChange={setListening}
              label="Listen to the room"
              description="Turn this off to mute everyone without leaving. Nobody is told."
            />
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg">In the room</h2>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                {members.length} of {MAX_MEMBERS}
              </p>
            </div>
            <ul className="space-y-2">
              {members.map((member, i) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  tone={TONES[i % TONES.length]}
                  isMe={member.id === myId}
                  link={member.id === myId ? null : (links.get(member.id) ?? "connecting")}
                  isHostSeat={i === 0}
                />
              ))}
            </ul>

            {others.length === 0 ? (
              <p className="mt-3 rounded-2xl bg-[var(--panel)] px-4 py-3 text-sm font-extrabold text-[var(--muted)]">
                <span className="do-bob inline-block">📻</span> Send the code{" "}
                <span className="font-mono">{room}</span> to a friend. Up to {MAX_MEMBERS - 1} people
                can join you.
              </p>
            ) : null}
          </Card>

          {failed.length ? (
            <ErrorState
              title={
                failed.length === 1
                  ? `No voice link to ${failed[0].name}`
                  : `No voice link to ${failed.length} people`
              }
              message="Your two networks refused a direct connection, which some company firewalls and mobile networks do. Everything else in the room still works, and this is not something DO101 can fix from here — a different network or a phone's own data usually connects."
            />
          ) : null}

          <InfoNote icon="🔒">
            Voice goes straight from browser to browser. DO101 has no voice server, records nothing
            and stores nothing — close the tab and the room stops existing.
          </InfoNote>
        </div>
      </div>

      {/* The room, heard. Muting is done here rather than by hanging up. */}
      <div className="sr-only">
        {[...streams].map(([id, stream]) => (
          <RemoteAudio key={id} stream={stream} muted={!listening} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- pieces ------------------------------- */

function RemoteAudio({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const ref = React.useRef<HTMLAudioElement>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.srcObject = stream;
    // Autoplay is allowed here because joining a room was a deliberate tap.
    void element.play().catch(() => {});
    return () => {
      element.srcObject = null;
    };
  }, [stream]);

  return <audio ref={ref} autoPlay playsInline muted={muted} />;
}

function MemberRow({
  member,
  tone,
  isMe,
  link,
  isHostSeat,
}: {
  member: Member;
  tone: (typeof TONES)[number];
  isMe: boolean;
  link: Link | null;
  isHostSeat: boolean;
}) {
  const state = !member.canTalk
    ? "listening only"
    : link === "failed"
      ? "could not connect"
      : link === "connecting"
        ? "connecting…"
        : member.talking
          ? "talking"
          : "listening";

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors",
        member.talking ? "bg-[var(--grass-soft)]" : "bg-[var(--panel)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full text-base font-extrabold text-white",
          member.talking && "do-pop",
        )}
        style={{
          background: `var(--${tone})`,
          boxShadow: member.talking ? `0 0 0 4px var(--${tone}-soft)` : undefined,
        }}
      >
        {member.name.slice(0, 1).toUpperCase()}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-extrabold">{member.name}</span>
          {isMe ? <span className="text-xs font-extrabold text-[var(--muted)]">(you)</span> : null}
          {isHostSeat ? (
            <span className="rounded-full bg-[var(--panel-2)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              host
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "block text-xs font-extrabold uppercase tracking-wider",
            link === "failed" ? "text-[var(--cherry)]" : "text-[var(--muted)]",
          )}
        >
          {member.talking ? "🔴 " : ""}
          {state}
        </span>
      </span>
    </li>
  );
}

function MenuScreen({
  name,
  setName,
  joinCode,
  setJoinCode,
  onCreate,
  onJoin,
  busy,
  error,
  micError,
  onReset,
}: {
  name: string;
  setName: (v: string) => void;
  joinCode: string;
  setJoinCode: (v: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  busy: boolean;
  error: string | null;
  micError: string | null;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <Label htmlFor="talkie-name" hint="the others see this">
          Your name
        </Label>
        <Input
          id="talkie-name"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
          placeholder="Alex"
          maxLength={MAX_NAME_LENGTH}
          autoComplete="off"
        />
        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
          It is sent straight to the other people in the room and never to DO101.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col p-6">
          <span aria-hidden className="do-bob text-4xl">
            📻
          </span>
          <h2 className="mt-3 text-xl">Start a channel</h2>
          <p className="mt-1 flex-1 text-sm font-semibold text-[var(--muted)]">
            You get a short code. Share it and up to {MAX_MEMBERS - 1} friends can talk with you.
          </p>
          <Button tone="cherry" size="lg" className="mt-4" onClick={onCreate} disabled={busy}>
            {busy ? "Opening the channel…" : "Create channel"}
          </Button>
        </Card>

        <Card className="flex flex-col p-6">
          <span aria-hidden className="text-4xl">
            🎟️
          </span>
          <h2 className="mt-3 text-xl">Join a channel</h2>
          <p className="mt-1 flex-1 text-sm font-semibold text-[var(--muted)]">
            Got a code from a friend? Type it in and you are on the air.
          </p>
          <div className="mt-4 flex gap-2">
            <label htmlFor="talkie-code" className="sr-only">
              Channel code
            </label>
            <Input
              id="talkie-code"
              value={joinCode}
              onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && joinCode.length >= 4) onJoin();
              }}
              placeholder="ABC12"
              className="text-center font-mono text-lg uppercase tracking-[0.3em]"
              maxLength={8}
              autoComplete="off"
            />
            <Button tone="sky" onClick={onJoin} disabled={joinCode.length < 4 || busy}>
              Join
            </Button>
          </div>
        </Card>
      </div>

      {error ? (
        <ErrorState
          message={error}
          action={
            <Button tone="panel" onClick={onReset}>
              Start over
            </Button>
          }
        />
      ) : null}

      {micError ? <ErrorState title="The microphone was not available" message={micError} /> : null}

      <Card className="p-5">
        <h2 className="text-lg">What happens when you press the button</h2>
        <ul className="mt-2 space-y-1.5 text-sm font-semibold text-[var(--muted)]">
          <li>🎙️ Your browser asks for the microphone once, and opens it muted.</li>
          <li>👂 While you are not holding the button, nothing leaves your device.</li>
          <li>📡 Holding it sends your voice straight to each person in the room.</li>
          <li>🚫 Nothing is recorded, uploaded or kept — there is nowhere for it to go.</li>
        </ul>
      </Card>
    </div>
  );
}
