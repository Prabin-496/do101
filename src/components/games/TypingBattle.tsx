"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import type { DataConnection, Peer } from "peerjs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { CopyButton } from "@/components/ui/CopyButton";
import { ErrorState, InfoNote, Progress, Stat } from "@/components/ui/Feedback";
import { ShareResult } from "./ShareResult";
import { computeTypingStats, generateTypingText } from "@/lib/games/typing";
import {
  BATTLE_WORDS,
  COUNTDOWN_MS,
  explainPeerError,
  makeRoomCode,
  normalizeRoomCode,
  peerIdFor,
  type BattleMessage,
} from "@/lib/games/battle";
import { SITE } from "@/lib/site";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";
import { cn } from "@/lib/utils/cn";
import { celebrate } from "@/lib/celebrate";

type Screen = "menu" | "lobby" | "countdown" | "racing" | "finished";
type Conn = "idle" | "connecting" | "waiting" | "connected" | "lost";

interface Opponent {
  name: string;
  chars: number;
  wpm: number;
  accuracy: number;
  finished: boolean;
  finalWpm?: number;
  finalAccuracy?: number;
  elapsed?: number;
}

const EMPTY_OPPONENT: Opponent = {
  name: "Opponent",
  chars: 0,
  wpm: 0,
  accuracy: 100,
  finished: false,
};

export function TypingBattle() {
  const searchParams = useSearchParams();

  const [screen, setScreen] = React.useState<Screen>("menu");
  const [conn, setConn] = React.useState<Conn>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [isHost, setIsHost] = React.useState(false);
  const [room, setRoom] = React.useState("");
  const [joinCode, setJoinCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [opponent, setOpponent] = React.useState<Opponent>(EMPTY_OPPONENT);

  const [text, setText] = React.useState("");
  const [typed, setTyped] = React.useState("");
  const [countdown, setCountdown] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const [myFinal, setMyFinal] = React.useState<{ wpm: number; accuracy: number; elapsed: number } | null>(
    null,
  );

  const peerRef = React.useRef<Peer | null>(null);
  const connRef = React.useRef<DataConnection | null>(null);
  const startAtRef = React.useRef(0);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const lastSent = React.useRef(0);
  const textRef = React.useRef("");
  const finishedRef = React.useRef(false);

  React.useEffect(() => {
    textRef.current = text;
  }, [text]);

  const send = React.useCallback((message: BattleMessage) => {
    const c = connRef.current;
    if (c?.open) {
      try {
        c.send(message);
      } catch {
        /* the channel closed mid-send; the close handler reports it */
      }
    }
  }, []);

  const teardown = React.useCallback(() => {
    connRef.current?.close();
    peerRef.current?.destroy();
    connRef.current = null;
    peerRef.current = null;
  }, []);

  React.useEffect(() => () => teardown(), [teardown]);

  /* ------------------------------ connection ------------------------------ */

  const beginRace = React.useCallback((seed: number, startAt: number) => {
    setText(generateTypingText(BATTLE_WORDS, seed));
    setTyped("");
    setMyFinal(null);
    finishedRef.current = false;
    setOpponent((o) => ({ ...o, chars: 0, wpm: 0, accuracy: 100, finished: false }));
    startAtRef.current = startAt;
    setScreen("countdown");
  }, []);

  const wireConnection = React.useCallback(
    (c: DataConnection, host: boolean) => {
      connRef.current = c;

      c.on("open", () => {
        setConn("connected");
        setError(null);
        send({ type: "hello", name: name.trim() || (host ? "Host" : "Challenger") });
        setScreen("lobby");
      });

      c.on("data", (raw) => {
        const message = raw as BattleMessage;
        if (!message || typeof message !== "object") return;

        if (message.type === "hello") {
          setOpponent((o) => ({ ...o, name: message.name || "Opponent" }));
        } else if (message.type === "start") {
          beginRace(message.seed, message.startAt);
        } else if (message.type === "progress") {
          setOpponent((o) => ({
            ...o,
            chars: message.chars,
            wpm: message.wpm,
            accuracy: message.accuracy,
          }));
        } else if (message.type === "finish") {
          setOpponent((o) => ({
            ...o,
            finished: true,
            finalWpm: message.wpm,
            finalAccuracy: message.accuracy,
            elapsed: message.elapsed,
            chars: textRef.current.length,
          }));
        } else if (message.type === "rematch") {
          setScreen("lobby");
          setTyped("");
          setMyFinal(null);
          finishedRef.current = false;
          setOpponent((o) => ({ ...o, chars: 0, wpm: 0, accuracy: 100, finished: false }));
        }
      });

      c.on("close", () => {
        setConn("lost");
        setError("Your opponent left the race.");
      });

      c.on("error", () => {
        setConn("lost");
        setError("The peer-to-peer connection dropped.");
      });
    },
    [beginRace, name, send],
  );

  const createRoom = React.useCallback(async () => {
    setError(null);
    setConn("connecting");
    setIsHost(true);
    const code = makeRoomCode();
    setRoom(code);

    try {
      const { Peer: PeerCtor } = await import("peerjs");
      const peer = new PeerCtor(peerIdFor(code), { debug: 0 });
      peerRef.current = peer;

      peer.on("open", () => {
        setConn("waiting");
        setScreen("lobby");
        track("game_start", { game: "typing-battle", role: "host" });
      });

      peer.on("connection", (c) => {
        // One race at a time: politely refuse a second challenger.
        if (connRef.current?.open) {
          c.on("open", () => c.close());
          return;
        }
        wireConnection(c, true);
      });

      peer.on("error", (err: { type?: string }) => {
        setConn("lost");
        setError(explainPeerError(err?.type ?? ""));
      });
    } catch {
      setConn("lost");
      setError("Typing Battle could not load its connection library. Check your network and retry.");
    }
  }, [wireConnection]);

  const joinRoom = React.useCallback(
    async (rawCode: string) => {
      const code = normalizeRoomCode(rawCode);
      if (code.length < 4) {
        setError("Room codes are five characters, like ABC12.");
        return;
      }
      setError(null);
      setConn("connecting");
      setIsHost(false);
      setRoom(code);

      try {
        const { Peer: PeerCtor } = await import("peerjs");
        const peer = new PeerCtor({ debug: 0 });
        peerRef.current = peer;

        peer.on("open", () => {
          const c = peer.connect(peerIdFor(code), { reliable: true });
          wireConnection(c, false);
          track("game_start", { game: "typing-battle", role: "guest" });
        });

        peer.on("error", (err: { type?: string }) => {
          setConn("lost");
          setError(explainPeerError(err?.type ?? ""));
        });
      } catch {
        setConn("lost");
        setError("Typing Battle could not load its connection library. Check your network and retry.");
      }
    },
    [wireConnection],
  );

  // Auto-join when arriving from a shared link.
  const autoJoined = React.useRef(false);
  React.useEffect(() => {
    const code = searchParams.get("room");
    if (code && !autoJoined.current) {
      autoJoined.current = true;
      setJoinCode(normalizeRoomCode(code));
      void joinRoom(code);
    }
  }, [searchParams, joinRoom]);

  /* -------------------------------- race -------------------------------- */

  const startRace = () => {
    const seed = Math.floor(Math.random() * 1_000_000);
    const startAt = Date.now() + COUNTDOWN_MS;
    send({ type: "start", seed, startAt });
    beginRace(seed, startAt);
  };

  React.useEffect(() => {
    if (screen !== "countdown") return;
    const id = window.setInterval(() => {
      const left = startAtRef.current - Date.now();
      setCountdown(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0) {
        window.clearInterval(id);
        setScreen("racing");
        window.setTimeout(() => inputRef.current?.focus(), 60);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [screen]);

  React.useEffect(() => {
    if (screen !== "racing") return;
    const id = window.setInterval(() => {
      setElapsed((Date.now() - startAtRef.current) / 1000);
    }, 200);
    return () => window.clearInterval(id);
  }, [screen]);

  const myStats = React.useMemo(
    () => computeTypingStats(text, typed, Math.max(0.5, elapsed)),
    [text, typed, elapsed],
  );

  const finishRace = React.useCallback(
    (finalTyped: string) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const seconds = (Date.now() - startAtRef.current) / 1000;
      const stats = computeTypingStats(text, finalTyped, seconds);
      const final = {
        wpm: Math.round(stats.wpm),
        accuracy: Number(stats.accuracy.toFixed(1)),
        elapsed: Number(seconds.toFixed(1)),
      };
      setMyFinal(final);
      send({ type: "finish", ...final });
      setScreen("finished");
      recordCompletion(20);
      track("game_complete", { game: "typing-battle", wpm: final.wpm });
    },
    [text, send],
  );

  const onType = (value: string) => {
    if (screen !== "racing" || value.length > text.length) return;
    setTyped(value);

    const now = Date.now();
    if (now - lastSent.current > 200) {
      lastSent.current = now;
      const seconds = Math.max(0.5, (now - startAtRef.current) / 1000);
      const stats = computeTypingStats(text, value, seconds);
      send({
        type: "progress",
        chars: value.length,
        wpm: Math.round(stats.wpm),
        accuracy: Number(stats.accuracy.toFixed(1)),
      });
    }

    if (value.length === text.length) finishRace(value);
  };

  const leave = () => {
    teardown();
    setScreen("menu");
    setConn("idle");
    setError(null);
    setRoom("");
    setOpponent(EMPTY_OPPONENT);
    setTyped("");
    setMyFinal(null);
    finishedRef.current = false;
  };

  const wonRace =
    myFinal && opponent.finished && opponent.elapsed !== undefined
      ? myFinal.elapsed < opponent.elapsed
      : null;

  React.useEffect(() => {
    if (screen === "finished" && wonRace === true) void celebrate();
  }, [screen, wonRace]);

  const roomLink = room ? `${SITE.url}/games/typing-battle?room=${room}` : "";
  const myProgress = text ? (typed.length / text.length) * 100 : 0;
  const oppProgress = text ? (opponent.chars / text.length) * 100 : 0;

  /* ------------------------------- screens ------------------------------- */

  if (screen === "menu") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="flex flex-col p-6">
            <span aria-hidden className="do-bob text-4xl">
              🏁
            </span>
            <h2 className="mt-3 text-xl">Create a room</h2>
            <p className="mt-1 flex-1 text-sm font-semibold text-[var(--muted)]">
              You get a code and a link. Send it to a friend and the race starts when they arrive.
            </p>
            <Button tone="cherry" size="lg" className="mt-4" onClick={createRoom}>
              Create room
            </Button>
          </Card>

          <Card className="flex flex-col p-6">
            <span aria-hidden className="text-4xl">
              🎟️
            </span>
            <h2 className="mt-3 text-xl">Join a room</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
              Got a code from a friend? Type it here.
            </p>
            <div className="mt-4 flex gap-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
                placeholder="ABC12"
                aria-label="Room code"
                className="text-center font-mono text-lg uppercase tracking-[0.3em]"
                maxLength={8}
              />
              <Button tone="sky" onClick={() => joinRoom(joinCode)} disabled={joinCode.length < 4}>
                Join
              </Button>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <Label htmlFor="battle-name" hint="optional">
            Your display name
          </Label>
          <Input
            id="battle-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="Speedy fingers"
            maxLength={20}
          />
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
            Only your opponent sees this. It is sent directly to their browser, not to DO101.
          </p>
        </Card>

        {error ? <ErrorState message={error} action={<Button tone="panel" onClick={leave}>Start over</Button>} /> : null}

        <InfoNote icon="📡">
          Typing Battle uses a direct peer-to-peer WebRTC connection. A free public signalling
          service is used only to introduce the two browsers — DO101 runs no game server, so a room
          lives only while the host&rsquo;s tab is open.
        </InfoNote>
      </div>
    );
  }

  if (screen === "lobby") {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
            Room code
          </p>
          <p className="mt-1 font-mono text-5xl font-extrabold tracking-[0.2em]">{room}</p>

          {isHost ? (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <CopyButton value={roomLink} label="Copy invite link" tone="sky" size="md" />
              <CopyButton value={room} label="Copy code" tone="panel" size="md" />
            </div>
          ) : null}

          <div className="mt-6">
            {conn === "connected" ? (
              <p className="do-pop rounded-2xl bg-[var(--grass-soft)] px-4 py-3 text-base font-extrabold text-[var(--grass-dark)] dark:text-[var(--grass)]">
                ✅ {opponent.name} is connected
              </p>
            ) : conn === "waiting" || conn === "connecting" ? (
              <p className="rounded-2xl bg-[var(--panel)] px-4 py-3 text-base font-extrabold text-[var(--muted)]">
                <span className="do-bob inline-block">⏳</span>{" "}
                {conn === "connecting"
                  ? "Connecting…"
                  : "Waiting for your opponent to join. Nobody is connected yet."}
              </p>
            ) : (
              <p className="rounded-2xl bg-[var(--cherry-soft)] px-4 py-3 text-base font-extrabold">
                Connection lost.
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {isHost ? (
              <Button
                tone="cherry"
                size="lg"
                onClick={startRace}
                disabled={conn !== "connected"}
                title={conn !== "connected" ? "Waiting for an opponent to join" : undefined}
              >
                Start the race
              </Button>
            ) : conn === "connected" ? (
              <p className="text-sm font-extrabold text-[var(--muted)]">
                Waiting for the host to start…
              </p>
            ) : null}
            <Button tone="ghost" onClick={leave}>
              Leave room
            </Button>
          </div>
        </Card>

        {error ? <ErrorState message={error} /> : null}

        <InfoNote icon="🔒">
          Keystrokes travel straight between the two browsers. DO101 never sees them.
        </InfoNote>
      </div>
    );
  }

  if (screen === "countdown") {
    return (
      <Card className="flex h-80 flex-col items-center justify-center bg-[var(--cherry-soft)] text-center">
        <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
          Get ready
        </p>
        <p key={countdown} className="do-pop text-8xl font-extrabold">
          {countdown > 0 ? countdown : "GO!"}
        </p>
        <p className="mt-2 text-sm font-extrabold text-[var(--muted)]">
          You and {opponent.name} get exactly the same text.
        </p>
      </Card>
    );
  }

  if (screen === "racing") {
    return (
      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <div>
            <div className="mb-1 flex justify-between text-sm font-extrabold">
              <span>You</span>
              <span className="tabular-nums">
                {Math.round(myStats.wpm)} WPM · {myStats.accuracy.toFixed(0)}%
              </span>
            </div>
            <Progress value={myProgress} tone="grass" />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm font-extrabold">
              <span>{opponent.name}</span>
              <span className="tabular-nums">
                {conn === "lost" ? "disconnected" : `${opponent.wpm} WPM · ${opponent.accuracy.toFixed(0)}%`}
              </span>
            </div>
            <Progress value={oppProgress} tone="cherry" />
          </div>
        </Card>

        {conn === "lost" ? (
          <ErrorState
            title="Opponent disconnected"
            message="They left or lost connection. You can finish your run — your own score still counts."
          />
        ) : null}

        <Card className="relative cursor-text p-5 sm:p-7" onClick={() => inputRef.current?.focus()}>
          <p
            className="do-scroll max-h-56 overflow-y-auto break-words font-mono text-lg leading-relaxed sm:text-xl"
            aria-hidden
          >
            {text.split("").map((char, i) => {
              const isTyped = i < typed.length;
              const correct = isTyped && typed[i] === char;
              return (
                <span
                  key={i}
                  className={cn(
                    isTyped
                      ? correct
                        ? "text-[var(--grass)]"
                        : "rounded bg-[var(--cherry-soft)] text-[var(--cherry)]"
                      : "text-[var(--muted)]",
                    i === typed.length && "border-l-2 border-[var(--sky)]",
                  )}
                >
                  {char}
                </span>
              );
            })}
          </p>
          <label htmlFor="battle-input" className="sr-only">
            Type the racing text
          </label>
          <textarea
            id="battle-input"
            ref={inputRef}
            value={typed}
            onChange={(e) => onType(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="absolute inset-0 h-full w-full resize-none rounded-2xl bg-transparent p-5 font-mono text-lg text-transparent caret-transparent outline-none sm:p-7 sm:text-xl"
          />
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Time" value={`${elapsed.toFixed(1)}s`} tone="fire" />
          <Stat label="Your WPM" value={Math.round(myStats.wpm)} tone="grass" />
          <Stat label="Their WPM" value={conn === "lost" ? "—" : opponent.wpm} tone="cherry" />
        </div>

        <Button tone="ghost" onClick={() => finishRace(typed)}>
          Give up and see my score
        </Button>
      </div>
    );
  }

  // finished
  const iWon = wonRace;

  return (
    <div className="space-y-4">
      <Card
        className="do-pop p-6 text-center"
        style={{
          background:
            iWon === null
              ? "var(--panel)"
              : iWon
                ? "var(--grass-soft)"
                : "var(--cherry-soft)",
        }}
      >
        <p className="text-4xl font-extrabold">
          {iWon === null ? "Race finished" : iWon ? "🏆 You win!" : "😤 They got you"}
        </p>
        {!opponent.finished && conn === "connected" ? (
          <p className="mt-2 text-sm font-extrabold text-[var(--muted)]">
            Waiting for {opponent.name} to finish…
          </p>
        ) : null}
        {conn === "lost" ? (
          <p className="mt-2 text-sm font-extrabold text-[var(--muted)]">
            Your opponent disconnected, so there is no winner for this race.
          </p>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[var(--bg)] p-4">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
              You
            </p>
            <p className="text-4xl font-extrabold tabular-nums">{myFinal?.wpm ?? 0}</p>
            <p className="text-sm font-extrabold text-[var(--muted)]">
              WPM · {myFinal?.accuracy ?? 0}% · {myFinal?.elapsed ?? 0}s
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--bg)] p-4">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
              {opponent.name}
            </p>
            <p className="text-4xl font-extrabold tabular-nums">
              {opponent.finished ? opponent.finalWpm : "—"}
            </p>
            <p className="text-sm font-extrabold text-[var(--muted)]">
              {opponent.finished
                ? `WPM · ${opponent.finalAccuracy}% · ${opponent.elapsed}s`
                : "Still typing"}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <ShareResult
            gameId="typing-battle"
            text={
              iWon
                ? `I won a live typing race with ${myFinal?.wpm} WPM on DO101. Think you can beat me?`
                : `I scored ${myFinal?.wpm} WPM in a live typing race on DO101. Race me!`
            }
            url="/games/typing-battle"
          />
          <div className="flex flex-wrap justify-center gap-2">
            {conn === "connected" ? (
              <Button
                tone="grass"
                onClick={() => {
                  send({ type: "rematch" });
                  setScreen("lobby");
                  setTyped("");
                  setMyFinal(null);
                  finishedRef.current = false;
                  setOpponent((o) => ({ ...o, chars: 0, wpm: 0, accuracy: 100, finished: false }));
                }}
              >
                Rematch
              </Button>
            ) : null}
            <Button tone="panel" onClick={leave}>
              New room
            </Button>
          </div>
        </div>
      </Card>

      {error ? <ErrorState message={error} /> : null}
    </div>
  );
}
