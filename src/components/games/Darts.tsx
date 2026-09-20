"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import type { DataConnection, Peer } from "peerjs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Toggle } from "@/components/ui/Field";
import { CopyButton } from "@/components/ui/CopyButton";
import { ErrorState, InfoNote, Stat } from "@/components/ui/Feedback";
import { DartBoard } from "./DartBoard";
import { ShareResult } from "./ShareResult";
import {
  DARTS_PER_TURN,
  MAX_PLAYERS,
  START_SCORE,
  addPlayer,
  checkoutRoute,
  createGame,
  currentPlayer,
  dartsLeft,
  endTurn,
  isTurnOver,
  nextLeg,
  standings,
  startLeg,
  threeDartAverage,
  throwDart,
  turnTotal,
  type DartsPlayer,
  type DartsState,
} from "@/lib/games/darts";
import {
  TURN_HANDOVER_MS,
  applyGuestMessage,
  dartsPeerId,
  explainDartsError,
  explainRejection,
  guestLeft,
  isDartsMessage,
  makeRoomCode,
  normalizeRoomCode,
  type DartsMessage,
  type GuestMessage,
  type HostMessage,
} from "@/lib/games/darts-room";
import { SITE } from "@/lib/site";
import { track } from "@/lib/analytics";
import { recordCompletion, saveBest } from "@/lib/gamify";
import { celebrate } from "@/lib/celebrate";
import { cn } from "@/lib/utils/cn";

type Status = "idle" | "connecting" | "open" | "lost";

const HOST_ID = "host";
const TONES = ["cherry", "sky", "grass", "grape", "fire"] as const;

export function Darts() {
  const searchParams = useSearchParams();

  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [isHost, setIsHost] = React.useState(false);
  const [room, setRoom] = React.useState("");
  const [joinCode, setJoinCode] = React.useState(() =>
    normalizeRoomCode(searchParams.get("room") ?? ""),
  );
  const [name, setName] = React.useState("");
  const [state, setState] = React.useState<DartsState>(() => createGame());
  const [myId, setMyId] = React.useState(HOST_ID);
  const [inRoom, setInRoom] = React.useState(false);
  const [newBest, setNewBest] = React.useState(false);

  const peerRef = React.useRef<Peer | null>(null);
  /** Host: every guest still on the line, keyed by player id. */
  const guestsRef = React.useRef(new Map<string, DataConnection>());
  /** Guest: the single line back to the host. */
  const hostConnRef = React.useRef<DataConnection | null>(null);
  const isHostRef = React.useRef(false);
  const stateRef = React.useRef(state);
  const myIdRef = React.useRef(HOST_ID);
  const nameRef = React.useRef("");

  React.useEffect(() => {
    nameRef.current = name;
  }, [name]);

  /* ----------------------------- plumbing ----------------------------- */

  const broadcast = React.useCallback((message: HostMessage, except?: string) => {
    for (const [id, conn] of guestsRef.current) {
      if (id === except || !conn.open) continue;
      try {
        conn.send(message);
      } catch {
        /* the channel closed mid-send; its close handler cleans up */
      }
    }
  }, []);

  /** The single place game state changes: the host writes, everyone hears. */
  const commit = React.useCallback(
    (next: DartsState) => {
      const previous = stateRef.current;
      stateRef.current = next;
      setState(next);
      if (isHostRef.current) broadcast({ type: "state", state: next });

      // A leg has just been won, for whoever is reading this screen.
      if (previous.phase === "playing" && next.phase === "over" && next.winner) {
        recordCompletion(18);
        track("game_complete", { game: "darts", players: next.players.length });
        const mine = next.players.find((p) => p.id === myIdRef.current);
        if (next.winner === myIdRef.current && mine) {
          setNewBest(saveBest("darts", mine.darts, false));
          void celebrate();
        } else {
          setNewBest(false);
        }
      }
    },
    [broadcast],
  );

  const sendToHost = React.useCallback((message: GuestMessage) => {
    const conn = hostConnRef.current;
    if (!conn?.open) return;
    try {
      conn.send(message);
    } catch {
      /* reported by the close handler */
    }
  }, []);

  const teardown = React.useCallback(() => {
    for (const conn of guestsRef.current.values()) conn.close();
    guestsRef.current.clear();
    hostConnRef.current?.close();
    hostConnRef.current = null;
    peerRef.current?.destroy();
    peerRef.current = null;
  }, []);

  React.useEffect(() => () => teardown(), [teardown]);

  /* ------------------------------ hosting ------------------------------ */

  const handleGuestMessage = React.useCallback(
    (conn: DataConnection, raw: unknown) => {
      const decision = applyGuestMessage(stateRef.current, conn.peer, raw);
      if (decision.seated) guestsRef.current.set(conn.peer, conn);
      if (decision.reply && conn.open) conn.send(decision.reply);
      if (decision.state !== stateRef.current) commit(decision.state);
    },
    [commit],
  );

  const handleGuestGone = React.useCallback(
    (peerId: string) => {
      guestsRef.current.delete(peerId);
      const next = guestLeft(stateRef.current, peerId);
      if (next !== stateRef.current) commit(next);
    },
    [commit],
  );

  const createRoom = React.useCallback(async () => {
    setError(null);
    setStatus("connecting");
    setIsHost(true);
    isHostRef.current = true;
    setMyId(HOST_ID);
    myIdRef.current = HOST_ID;

    const code = makeRoomCode();
    setRoom(code);

    try {
      const { Peer: PeerCtor } = await import("peerjs");
      const peer = new PeerCtor(dartsPeerId(code), { debug: 0 });
      peerRef.current = peer;

      peer.on("open", () => {
        setStatus("open");
        setInRoom(true);
        commit(addPlayer(createGame(true), HOST_ID, nameRef.current || "Host"));
        track("game_start", { game: "darts", role: "host" });
      });

      peer.on("connection", (conn) => {
        conn.on("data", (raw) => handleGuestMessage(conn, raw));
        conn.on("close", () => handleGuestGone(conn.peer));
        conn.on("error", () => handleGuestGone(conn.peer));
      });

      peer.on("error", (err: { type?: string }) => {
        setStatus("lost");
        setError(explainDartsError(err?.type ?? ""));
      });
    } catch {
      setStatus("lost");
      setError("Darts could not load its connection library. Check your network and try again.");
    }
  }, [commit, handleGuestMessage, handleGuestGone]);

  /* ------------------------------ joining ------------------------------ */

  const joinRoom = React.useCallback(
    async (rawCode: string) => {
      const code = normalizeRoomCode(rawCode);
      if (code.length < 4) {
        setError("Room codes are five characters, like ABC12.");
        return;
      }
      setError(null);
      setStatus("connecting");
      setIsHost(false);
      isHostRef.current = false;
      setRoom(code);

      try {
        const { Peer: PeerCtor } = await import("peerjs");
        const peer = new PeerCtor({ debug: 0 });
        peerRef.current = peer;

        peer.on("open", () => {
          const conn = peer.connect(dartsPeerId(code), { reliable: true });
          hostConnRef.current = conn;

          conn.on("open", () => {
            setStatus("open");
            conn.send({ type: "join", name: nameRef.current || "Player" } satisfies GuestMessage);
            track("game_start", { game: "darts", role: "guest" });
          });

          conn.on("data", (raw) => {
            if (!isDartsMessage(raw)) return;
            const message = raw as DartsMessage;
            if (message.type === "welcome") {
              setMyId(message.youId);
              myIdRef.current = message.youId;
              setInRoom(true);
              commit(message.state);
            } else if (message.type === "state") {
              commit(message.state);
            } else if (message.type === "rejected") {
              setStatus("lost");
              setError(explainRejection(message.reason));
              teardown();
            }
          });

          conn.on("close", () => {
            setStatus("lost");
            setError("The host closed the room, so the game has ended.");
          });

          conn.on("error", () => {
            setStatus("lost");
            setError("The connection to the host dropped.");
          });
        });

        peer.on("error", (err: { type?: string }) => {
          setStatus("lost");
          setError(explainDartsError(err?.type ?? ""));
        });
      } catch {
        setStatus("lost");
        setError("Darts could not load its connection library. Check your network and try again.");
      }
    },
    [commit, teardown],
  );

  /* ---------------------------- the game loop ---------------------------- */

  const thrower = currentPlayer(state);
  const myTurn = state.phase === "playing" && thrower?.id === myId && !isTurnOver(state);

  // The host holds the darts for a beat so everyone sees the finished turn.
  React.useEffect(() => {
    if (!isHost || state.phase !== "playing" || !isTurnOver(state)) return;
    const id = window.setTimeout(() => commit(endTurn(stateRef.current)), TURN_HANDOVER_MS);
    return () => window.clearTimeout(id);
  }, [isHost, state, commit]);

  const handleThrow = React.useCallback(
    (x: number, y: number) => {
      if (!myTurn) return;
      if (isHostRef.current) commit(throwDart(stateRef.current, x, y));
      else sendToHost({ type: "throw", x, y });
    },
    [myTurn, commit, sendToHost],
  );

  const leave = () => {
    teardown();
    setInRoom(false);
    setStatus("idle");
    setError(null);
    setRoom("");
    setIsHost(false);
    isHostRef.current = false;
    const fresh = createGame();
    stateRef.current = fresh;
    setState(fresh);
  };

  const roomLink = room ? `${SITE.url}/games/darts?room=${room}` : "";

  /* ------------------------------- screens ------------------------------- */

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
        onReset={leave}
      />
    );
  }

  const checkout =
    state.phase === "playing" && thrower
      ? checkoutRoute(thrower.remaining, dartsLeft(state), state.doubleOut)
      : null;

  return (
    <div className="space-y-4">
      <RoomHeader
        room={room}
        roomLink={roomLink}
        isHost={isHost}
        status={status}
        leg={state.leg}
        phase={state.phase}
        onLeave={leave}
      />

      {error && status === "lost" ? <ErrorState message={error} /> : null}

      <Scoreboard state={state} myId={myId} />

      {state.phase === "lobby" ? (
        <Lobby
          state={state}
          isHost={isHost}
          roomLink={roomLink}
          room={room}
          onToggleDoubleOut={(v) => commit({ ...stateRef.current, doubleOut: v })}
          onStart={() => commit(startLeg(stateRef.current))}
        />
      ) : null}

      {state.phase === "playing" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,34rem)_minmax(0,20rem)] lg:justify-center">
          <Card className="p-4 sm:p-6">
            <DartBoard
              active={myTurn}
              throws={state.throws}
              onThrow={handleThrow}
              idleHint={
                isTurnOver(state)
                  ? "Turn over — passing the darts."
                  : `${thrower?.name ?? "Someone else"} is throwing.`
              }
            />
          </Card>
          <TurnPanel state={state} myTurn={myTurn} thrower={thrower} checkout={checkout} />
        </div>
      ) : null}

      {state.phase === "over" ? (
        <LegResult
          state={state}
          myId={myId}
          isHost={isHost}
          newBest={newBest}
          onNextLeg={() => commit(nextLeg(stateRef.current))}
          onLobby={() => commit({ ...stateRef.current, phase: "lobby" })}
        />
      ) : null}

      <InfoNote icon="📡">
        Every throw travels straight between the players&rsquo; browsers over WebRTC. DO101 keeps no
        game server and no database, so the room exists only while the host&rsquo;s tab is open.
      </InfoNote>
    </div>
  );
}

/* ------------------------------ menu ------------------------------ */

function MenuScreen({
  name,
  setName,
  joinCode,
  setJoinCode,
  onCreate,
  onJoin,
  busy,
  error,
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
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <Label htmlFor="darts-name" hint="shown to the other players">
          Your name
        </Label>
        <Input
          id="darts-name"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 14))}
          placeholder="Alex"
          maxLength={14}
          autoComplete="off"
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col p-6">
          <span aria-hidden className="do-bob text-4xl">
            🎯
          </span>
          <h2 className="mt-3 text-xl">Start a game</h2>
          <p className="mt-1 flex-1 text-sm font-semibold text-[var(--muted)]">
            You get a room code. Share it and up to four friends can join the same board.
          </p>
          <Button tone="cherry" size="lg" className="mt-4" onClick={onCreate} disabled={busy}>
            {busy ? "Opening the room…" : "Create room"}
          </Button>
        </Card>

        <Card className="flex flex-col p-6">
          <span aria-hidden className="text-4xl">
            🎟️
          </span>
          <h2 className="mt-3 text-xl">Join with a code</h2>
          <p className="mt-1 flex-1 text-sm font-semibold text-[var(--muted)]">
            Got a code from whoever started the game? Type it here.
          </p>
          <div className="mt-4 flex gap-2">
            <label htmlFor="darts-code" className="sr-only">
              Room code
            </label>
            <Input
              id="darts-code"
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

      <Card className="p-5">
        <h2 className="text-lg">How 301 works</h2>
        <ul className="mt-2 space-y-1.5 text-sm font-semibold text-[var(--muted)]">
          <li>🎯 Everyone starts on {START_SCORE} and throws three darts a turn.</li>
          <li>➖ Whatever you hit comes off your score. Trebles count three times, doubles twice.</li>
          <li>🎪 Land on zero exactly to win the leg — on a double, unless the host turns that off.</li>
          <li>💥 Go below zero, or land on one, and the whole turn is wiped: that is a bust.</li>
        </ul>
      </Card>
    </div>
  );
}

/* ---------------------------- room furniture ---------------------------- */

function RoomHeader({
  room,
  roomLink,
  isHost,
  status,
  leg,
  phase,
  onLeave,
}: {
  room: string;
  roomLink: string;
  isHost: boolean;
  status: Status;
  leg: number;
  phase: DartsState["phase"];
  onLeave: () => void;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
            Room code
          </p>
          <p className="font-mono text-3xl font-extrabold tracking-[0.2em]">{room}</p>
        </div>
        <div className="hidden sm:block">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
            {phase === "lobby" ? "Status" : "Leg"}
          </p>
          <p className="text-xl font-extrabold">
            {phase === "lobby" ? (status === "open" ? "Open" : "Connecting…") : leg}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={room} label="Copy code" tone="panel" size="sm" />
        {isHost ? <CopyButton value={roomLink} label="Copy invite link" tone="sky" size="sm" /> : null}
        <Button tone="ghost" size="sm" onClick={onLeave}>
          Leave
        </Button>
      </div>
    </Card>
  );
}

function Scoreboard({ state, myId }: { state: DartsState; myId: string }) {
  return (
    <div
      className={cn(
        "grid gap-3",
        state.players.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
      )}
    >
      {state.players.map((player, i) => (
        <PlayerCard
          key={player.id}
          player={player}
          tone={TONES[i % TONES.length]}
          throwing={state.phase === "playing" && state.players[state.turn]?.id === player.id}
          isMe={player.id === myId}
          phase={state.phase}
        />
      ))}
    </div>
  );
}

function PlayerCard({
  player,
  tone,
  throwing,
  isMe,
  phase,
}: {
  player: DartsPlayer;
  tone: (typeof TONES)[number];
  throwing: boolean;
  isMe: boolean;
  phase: DartsState["phase"];
}) {
  return (
    <div
      className={cn(
        "do-card relative overflow-hidden p-3 transition-transform",
        throwing && "-translate-y-0.5",
        !player.connected && "opacity-55",
      )}
      style={
        throwing
          ? { background: `var(--${tone}-soft)`, boxShadow: `0 0 0 3px var(--${tone})` }
          : undefined
      }
    >
      <div className="flex items-baseline justify-between gap-1">
        <p className="truncate text-sm font-extrabold">
          {player.name}
          {isMe ? <span className="text-[var(--muted)]"> (you)</span> : null}
        </p>
        {player.legs > 0 ? (
          <span className="shrink-0 text-xs font-extrabold text-[var(--muted)]">
            🏆 {player.legs}
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-4xl font-extrabold tabular-nums" style={{ color: `var(--${tone})` }}>
        {player.remaining}
      </p>

      <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
        {!player.connected
          ? "away"
          : phase === "lobby"
            ? "ready"
            : `${player.darts} dart${player.darts === 1 ? "" : "s"} · ${threeDartAverage(player).toFixed(1)} avg`}
      </p>

      {throwing ? (
        <p className="mt-1 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: `var(--${tone})` }}>
          ● throwing
        </p>
      ) : null}
    </div>
  );
}

function Lobby({
  state,
  isHost,
  room,
  roomLink,
  onToggleDoubleOut,
  onStart,
}: {
  state: DartsState;
  isHost: boolean;
  room: string;
  roomLink: string;
  onToggleDoubleOut: (v: boolean) => void;
  onStart: () => void;
}) {
  const free = MAX_PLAYERS - state.players.length;
  return (
    <Card className="p-6 text-center">
      <h2 className="text-xl">
        {state.players.length === 1
          ? "Waiting for players to join"
          : `${state.players.length} players at the oche`}
      </h2>
      <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
        {free > 0
          ? `Share the code ${room} — room for ${free} more.`
          : "The room is full. Throw!"}
      </p>

      <div className="mx-auto mt-5 max-w-sm space-y-4">
        {isHost ? (
          <>
            <Toggle
              checked={state.doubleOut}
              onChange={onToggleDoubleOut}
              label="Finish on a double"
              description="The proper 301 rule: the winning dart must land in a double or the bullseye. Turn it off for a gentler game."
            />
            <div className="flex flex-wrap justify-center gap-2">
              <CopyButton value={roomLink} label="Copy invite link" tone="panel" size="md" />
              <Button
                tone="cherry"
                size="lg"
                onClick={onStart}
                disabled={state.players.length < 1}
              >
                {state.players.length > 1 ? "Start the leg" : "Practise solo"}
              </Button>
            </div>
          </>
        ) : (
          <p className="rounded-2xl bg-[var(--panel)] px-4 py-3 text-base font-extrabold text-[var(--muted)]">
            <span className="do-bob inline-block">🎯</span> You&rsquo;re in. Waiting for the host to
            start the leg
            {state.doubleOut ? " — finishes must be on a double." : " — any finish counts."}
          </p>
        )}
      </div>
    </Card>
  );
}

function TurnPanel({
  state,
  myTurn,
  thrower,
  checkout,
}: {
  state: DartsState;
  myTurn: boolean;
  thrower: DartsPlayer | null;
  checkout: string[] | null;
}) {
  const slots = Array.from({ length: DARTS_PER_TURN }, (_, i) => state.throws[i] ?? null);
  return (
    <div className="space-y-3">
      <Card
        className={cn("p-4 text-center", myTurn && "do-pop")}
        style={myTurn ? { background: "var(--grass-soft)" } : undefined}
      >
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
          At the oche
        </p>
        <p className="text-2xl font-extrabold">{myTurn ? "Your turn" : (thrower?.name ?? "—")}</p>
        <p className="mt-1 text-sm font-extrabold text-[var(--muted)]">
          {thrower ? `${thrower.remaining} to go` : ""}
        </p>
      </Card>

      <Card className="p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
          This turn
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {slots.map((slot, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl px-2 py-3 text-center text-lg font-extrabold tabular-nums",
                slot ? "text-[var(--ink)]" : "text-[var(--muted)]",
              )}
              style={{
                background: slot?.bust
                  ? "var(--cherry-soft)"
                  : slot
                    ? "var(--panel-2)"
                    : "var(--panel)",
              }}
            >
              {slot ? slot.hit.label : "–"}
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-sm font-extrabold text-[var(--muted)]">
          {state.busted ? "💥 Bust — the score goes back" : `Scored ${turnTotal(state.throws)}`}
        </p>
      </Card>

      {checkout ? (
        <Card className="p-4" style={{ background: "var(--sun-soft)" }}>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--muted)]">
            Way out
          </p>
          <p className="mt-1 text-lg font-extrabold">{checkout.join(" → ")}</p>
          <p className="text-xs font-semibold text-[var(--muted)]">
            One way to finish from {thrower?.remaining} with {dartsLeft(state)} dart
            {dartsLeft(state) === 1 ? "" : "s"}.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function LegResult({
  state,
  myId,
  isHost,
  newBest,
  onNextLeg,
  onLobby,
}: {
  state: DartsState;
  myId: string;
  isHost: boolean;
  newBest: boolean;
  onNextLeg: () => void;
  onLobby: () => void;
}) {
  const table = standings(state);
  const winner = state.players.find((p) => p.id === state.winner);
  const iWon = state.winner === myId;
  const me = state.players.find((p) => p.id === myId);

  return (
    <Card
      className="do-pop p-6 text-center"
      style={{ background: iWon ? "var(--grass-soft)" : "var(--panel)" }}
    >
      <p className="text-4xl font-extrabold">
        {iWon ? "🏆 You took the leg!" : `🎯 ${winner?.name ?? "Someone"} wins the leg`}
      </p>
      {newBest ? (
        <p className="mt-1 text-sm font-extrabold text-[var(--grass-dark)] dark:text-[var(--grass)]">
          🎉 Your fastest checkout yet — {me?.darts} darts.
        </p>
      ) : null}

      <div className="mx-auto mt-5 max-w-md space-y-2">
        {table.map((player, i) => (
          <div
            key={player.id}
            className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--bg)] px-4 py-2.5 text-left"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-sm font-extrabold text-[var(--muted)]">
                {["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`}
              </span>
              <span className="truncate font-extrabold">{player.name}</span>
            </span>
            <span className="shrink-0 text-sm font-extrabold tabular-nums text-[var(--muted)]">
              {player.remaining === 0 ? `out in ${player.darts} darts` : `${player.remaining} left`}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Legs won" value={me?.legs ?? 0} tone="sun" />
        <Stat label="Your darts" value={me?.darts ?? 0} tone="sky" />
        <Stat
          label="Your average"
          value={me ? threeDartAverage(me).toFixed(1) : "0.0"}
          tone="grass"
          hint="per 3 darts"
        />
      </div>

      <div className="mt-6 space-y-3">
        <ShareResult
          gameId="darts"
          text={
            iWon
              ? `I checked out 301 in ${me?.darts} darts on DO101 Darts. Your turn.`
              : `Just played a live game of 301 darts on DO101 — no sign-up, just a room code.`
          }
          url="/games/darts"
        />
        {isHost ? (
          <div className="flex flex-wrap justify-center gap-2">
            <Button tone="grass" size="lg" onClick={onNextLeg}>
              Next leg
            </Button>
            <Button tone="panel" onClick={onLobby}>
              Back to the lobby
            </Button>
          </div>
        ) : (
          <p className="text-sm font-extrabold text-[var(--muted)]">
            Waiting for the host to start the next leg…
          </p>
        )}
      </div>
    </Card>
  );
}
