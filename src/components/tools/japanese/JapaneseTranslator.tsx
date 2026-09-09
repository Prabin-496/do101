"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Toggle } from "@/components/ui/Field";
import { InfoNote } from "@/components/ui/Feedback";
import {
  SOURCE_NOTES, analyse, type Analysis, type Token,
} from "@/lib/japanese/annotate";
import { hasJapanese, typingString } from "@/lib/japanese/kana";
import { checkPoliteness } from "@/lib/japanese/politeness";
import type { KanjiEntry } from "@/lib/japanese/dictionary";
import {
  TranslationError, cached, describeMatch, translateEachLine,
  type Direction, type LineTranslation,
} from "@/lib/japanese/translate";
import { useIsHydrated } from "@/lib/utils/use-local";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

/** How long to wait after the last keystroke before asking for a translation. */
const DEBOUNCE_MS = 700;

const SOURCE_UNDERLINE: Record<Token["source"], string> = {
  word: "border-[var(--grass)]",
  inflected: "border-[var(--grass)]",
  compound: "border-dashed border-[var(--fire)]",
  kanji: "border-dashed border-[var(--fire)]",
  kana: "border-[var(--sky)]",
  particle: "border-[var(--grape)]",
  unresolved: "border-dashed border-[var(--cherry)]",
  other: "border-transparent",
};

/** One line of input, its translation, and the analysis of the Japanese half. */
interface Segment {
  source: string;
  translated: string;
  japanese: string;
  analysis: Analysis;
  match: number;
  /** Set when the plain-form translation was rewritten into polite form. */
  politeFrom?: string;
}

/**
 * One word, stacked: reading on top, the word, then how to say it and what it
 * means. Reading the four rows downwards is the point — someone who cannot read
 * kanji can still follow the sentence, and picks the reading up by seeing it
 * sitting above the character every time.
 */
function TokenColumn({
  token,
  active,
  onSelect,
}: {
  token: Token;
  active: boolean;
  onSelect: () => void;
}) {
  if (token.source === "other") {
    return (
      <span className="self-end pb-6 text-xl font-extrabold text-[var(--muted)]" aria-hidden>
        {token.surface.trim() ? token.surface : " "}
      </span>
    );
  }

  const showReading = token.reading && token.reading !== token.surface;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      title={SOURCE_NOTES[token.source]}
      className={cn(
        "flex min-w-0 flex-col items-center rounded-xl px-1.5 py-1 transition",
        active ? "bg-[var(--sun-soft)]" : "hover:bg-[var(--panel)]",
      )}
    >
      <span className="h-4 text-[11px] font-bold leading-none text-[var(--muted)]" lang="ja">
        {showReading ? token.reading : " "}
      </span>
      <span
        className={cn(
          "mt-1 border-b-2 pb-0.5 text-2xl font-extrabold leading-tight",
          SOURCE_UNDERLINE[token.source],
        )}
        lang="ja"
      >
        {token.surface}
      </span>
      <span className="mt-1 text-xs font-bold lowercase leading-none text-[var(--sky-dark)] dark:text-[var(--sky)]">
        {token.romaji || "?"}
      </span>
      <span className="mt-1 max-w-[9rem] truncate text-[10px] font-semibold leading-none text-[var(--muted)]">
        {token.meaning ?? " "}
      </span>
    </button>
  );
}

/** A kanji with everything needed to read, understand and type it. */
function KanjiCard({ entry }: { entry: KanjiEntry }) {
  const kun = entry.kun[0]?.replace(/[.-].*$/, "") ?? "";
  return (
    <li className="rounded-2xl border-2 border-[var(--border)] p-3">
      <div className="flex items-start gap-3">
        <span className="text-4xl font-black leading-none" lang="ja">{entry.kanji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">{entry.meaning}</p>
          {entry.on.length > 0 ? (
            <p className="mt-1 text-xs font-bold text-[var(--muted)]">
              <span className="text-[var(--grape-dark)] dark:text-[var(--grape)]">On</span>{" "}
              <span lang="ja">{entry.on.join("、")}</span>
              <span className="ml-1 lowercase">
                ({entry.on.map((reading) => typingString(reading)).join(", ")})
              </span>
            </p>
          ) : null}
          {entry.kun.length > 0 ? (
            <p className="text-xs font-bold text-[var(--muted)]">
              <span className="text-[var(--grass-dark)] dark:text-[var(--grass)]">Kun</span>{" "}
              <span lang="ja">{entry.kun.join("、")}</span>
              <span className="ml-1 lowercase">
                ({entry.kun.map((reading) => typingString(reading)).join(", ")})
              </span>
            </p>
          ) : null}
          {kun ? (
            <p className="mt-1.5 text-[11px] font-bold">
              <span className="rounded bg-[var(--panel)] px-1.5 py-0.5 font-mono lowercase">
                {typingString(kun)}
              </span>{" "}
              <span className="text-[var(--muted)]">then space to convert</span>
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function JapaneseTranslator() {
  const [direction, setDirection] = React.useState<Direction>("en-ja");
  const [input, setInput] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [payload, setPayload] = React.useState<{ key: string; lines: LineTranslation[] } | null>(null);
  const [error, setError] = React.useState<{ key: string; message: string; retryable: boolean } | null>(null);
  const [live, setLive] = React.useState(true);
  const [manualNonce, setManualNonce] = React.useState(0);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [speaking, setSpeaking] = React.useState(false);
  // Machine translation often returns the plain form, which is wrong for
  // almost everything a learner is actually writing. Standard polite Japanese
  // is the default, with the original one click away.
  const [preferPolite, setPreferPolite] = React.useState(true);

  const hydrated = useIsHydrated();
  const reported = React.useRef(false);

  // Wait for a pause in typing. Every keystroke would otherwise be a request,
  // and the free service counts words against a daily quota.
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(input), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [input]);

  const requestText = debounced.replace(/\s+$/, "");
  const requestKey = requestText.trim() ? `${direction}|${requestText}` : "";

  React.useEffect(() => {
    if (!requestKey) return;
    if (!live && manualNonce === 0) return;

    const controller = new AbortController();
    let cancelled = false;

    translateEachLine(requestText, direction, controller.signal)
      .then((lines) => {
        if (cancelled) return;
        setPayload({ key: requestKey, lines });
        setError(null);
        if (!reported.current) {
          reported.current = true;
          track("tool_complete", { tool: "japanese-translator" });
        }
      })
      .catch((caught: unknown) => {
        if (cancelled || (caught as Error)?.name === "AbortError") return;
        setError(
          caught instanceof TranslationError
            ? { key: requestKey, message: caught.message, retryable: caught.retryable }
            : { key: requestKey, message: "Could not reach the translation service.", retryable: true },
        );
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey, requestText, direction, live, manualNonce]);

  const fresh = payload?.key === requestKey;
  const activeError = error?.key === requestKey ? error : null;
  const busy =
    requestKey !== "" &&
    !fresh &&
    !activeError &&
    (live || manualNonce > 0) &&
    !cached(requestText.split("\n")[0]?.trim() ?? "", direction);

  /**
   * One segment per line. The analysis always runs on the Japanese half,
   * whichever box that currently is, and it runs locally — so the readings,
   * romaji and typing guide are there even when the translation is not.
   */
  const segments = React.useMemo<Segment[]>(() => {
    if (direction === "ja-en") {
      // The Japanese is what the reader typed, so analyse it live regardless of
      // whether a translation has come back yet.
      return input.split("\n").map((line, index) => {
        const translated = payload?.lines[index];
        return {
          source: line,
          translated: translated?.result?.text ?? "",
          japanese: line,
          analysis: analyse(line),
          match: translated?.result?.match ?? 0,
        };
      });
    }

    return (payload?.lines ?? []).map((line) => {
      const raw = line.result?.text ?? "";
      const politeness = raw ? checkPoliteness(raw) : null;
      const rewritten =
        preferPolite && politeness?.register === "plain" && politeness.polite
          ? politeness.polite
          : null;
      const japanese = rewritten ?? raw;
      return {
        source: line.source,
        translated: japanese,
        japanese,
        analysis: analyse(japanese),
        match: line.result?.match ?? 0,
        politeFrom: rewritten ? raw : undefined,
      };
    });
  }, [direction, input, payload, preferPolite]);

  const filled = segments.filter((s) => s.japanese.trim());
  const allKanji = React.useMemo(() => {
    const seen = new Set<string>();
    const out: KanjiEntry[] = [];
    for (const segment of filled) {
      for (const entry of segment.analysis.kanji) {
        if (seen.has(entry.kanji)) continue;
        seen.add(entry.kanji);
        out.push(entry);
      }
    }
    return out;
  }, [filled]);

  const wholeJapanese = filled.map((s) => s.japanese).join("\n");
  const wholeRomaji = filled.map((s) => s.analysis.romaji).join("\n");
  const wholeHiragana = filled.map((s) => s.analysis.hiragana).join("\n");
  const wholeKatakana = filled.map((s) => s.analysis.katakana).join("\n");
  const wholeTyping = filled.map((s) => s.analysis.typing).join("\n");
  const unresolved = [...new Set(filled.flatMap((s) => s.analysis.unresolved))];
  const approximate = filled.some((s) => s.analysis.tokens.some((t) => t.confidence === "approximate"));

  const selectedToken = React.useMemo(() => {
    if (!selected) return null;
    const [line, position] = selected.split(":").map(Number);
    return segments[line]?.analysis.tokens[position] ?? null;
  }, [selected, segments]);

  const canSpeak = hydrated && typeof window !== "undefined" && "speechSynthesis" in window;

  function speak() {
    if (!canSpeak || !wholeJapanese) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(wholeJapanese);
    utterance.lang = "ja-JP";
    utterance.rate = 0.85;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function swap() {
    const next: Direction = direction === "en-ja" ? "ja-en" : "en-ja";
    const carried = payload?.lines.map((l) => l.result?.text ?? "").join("\n").trim() ?? "";
    setDirection(next);
    setSelected(null);
    setError(null);
    if (carried) {
      setInput(carried);
      setDebounced("");
      setPayload(null);
    }
  }

  function changeInput(value: string) {
    setInput(value);
    setSelected(null);
    if (!value.trim()) {
      setPayload(null);
      setError(null);
      setDebounced("");
    }
  }

  const inputIsJapanese = hasJapanese(input);
  const wrongWay =
    input.trim().length > 2 &&
    ((direction === "ja-en" && !inputIsJapanese) || (direction === "en-ja" && inputIsJapanese));

  const lineCount = input.split("\n").filter((l) => l.trim()).length;
  const adjusted = filled.map((s) => s.politeFrom).filter((v): v is string => Boolean(v));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <span className="rounded-2xl border-2 border-[var(--border)] px-4 py-2 text-sm font-extrabold">
          {direction === "en-ja" ? "English" : "日本語"}
        </span>
        <Button size="sm" tone="panel" onClick={swap} aria-label="Swap translation direction">
          ⇄
        </Button>
        <span className="rounded-2xl border-2 border-[var(--border)] px-4 py-2 text-sm font-extrabold">
          {direction === "en-ja" ? "日本語" : "English"}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="flex flex-col p-0">
          <label htmlFor="jt-in" className="sr-only">Text to translate</label>
          <textarea
            id="jt-in"
            value={input}
            onChange={(event) => changeInput(event.target.value)}
            spellCheck={false}
            lang={direction === "en-ja" ? "en" : "ja"}
            placeholder={
              direction === "en-ja"
                ? "Start typing in English — the Japanese appears as you type.\nShift+Enter starts a new line, translated on its own."
                : "日本語を入力してください。"
            }
            className="do-scroll min-h-[150px] w-full resize-y bg-transparent p-4 text-xl font-extrabold leading-relaxed outline-none placeholder:text-base placeholder:font-semibold placeholder:text-[var(--muted)]"
          />
          {direction === "ja-en" && wholeRomaji ? (
            <p className="whitespace-pre-wrap border-t-2 border-[var(--border)] px-4 py-2.5 text-sm font-bold lowercase text-[var(--muted)]">
              {wholeRomaji}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 border-t-2 border-[var(--border)] px-3 py-2">
            <span className="text-xs font-bold text-[var(--muted)]">
              {lineCount > 1 ? `${lineCount} lines, each translated on its own` : " "}
            </span>
            <span className="flex-1" />
            {input ? (
              <Button size="sm" tone="ghost" onClick={() => changeInput("")}>Clear</Button>
            ) : null}
          </div>
        </Card>

        <Card className="flex flex-col bg-[var(--panel)] p-0">
          <div className="min-h-[150px] flex-1 space-y-3 p-4">
            {filled.length > 0 ? (
              filled.map((segment, index) => (
                <div key={index} className={cn("transition-opacity", fresh ? "opacity-100" : "opacity-45")}>
                  <p
                    className="text-xl font-extrabold leading-relaxed"
                    lang={direction === "en-ja" ? "ja" : "en"}
                  >
                    {segment.translated || (direction === "ja-en" ? "…" : "")}
                  </p>
                  {/* Romaji directly beneath its own line, as Google Translate shows it. */}
                  {direction === "en-ja" && segment.analysis.romaji ? (
                    <p className="mt-1 text-sm font-bold lowercase text-[var(--muted)]">
                      {segment.analysis.romaji}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-base font-semibold text-[var(--muted)]">
                {busy ? "Translating…" : "The translation appears here as you type."}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t-2 border-[var(--border)] px-3 py-2">
            {busy ? (
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--muted)]">
                <span className="size-2 animate-pulse rounded-full bg-[var(--sky)]" aria-hidden />
                Translating
              </span>
            ) : fresh && filled.length > 0 ? (
              (() => {
                const worst = Math.min(...filled.map((s) => s.match));
                const confidence = describeMatch(worst);
                return (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                      `bg-[var(--${confidence.tone}-soft)]`,
                    )}
                  >
                    {confidence.label}
                  </span>
                );
              })()
            ) : null}
            <span className="flex-1" />
            {canSpeak && wholeJapanese ? (
              <Button size="sm" tone="sky" onClick={speak} disabled={speaking}>
                {speaking ? "🔊…" : "🔊 Hear it"}
              </Button>
            ) : null}
            {filled.length > 0 ? (
              <CopyButton value={filled.map((s) => s.translated).join("\n")} label="Copy" />
            ) : null}
          </div>
        </Card>
      </div>

      {adjusted.length > 0 ? (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[var(--grass)] bg-[var(--grass-soft)] px-4 py-3 text-sm font-semibold">
          <span aria-hidden>🎩</span>
          <span>
            <strong className="font-extrabold">Adjusted to standard polite Japanese.</strong>{" "}
            The translation came back in plain form
            {adjusted.length === 1 ? "" : ` on ${adjusted.length} lines`} — fine between friends,
            but not for an email, a form or anyone you have just met. Original:{" "}
            <span lang="ja" className="font-bold">{adjusted[0]}</span>
          </span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Toggle
          checked={preferPolite}
          onChange={setPreferPolite}
          label="Standard polite Japanese"
          description="Rewrites a plain-form translation into ですます form. Turn off to see exactly what the service returned."
        />
        <Toggle
          checked={live}
          onChange={(value) => {
            setLive(value);
            if (value) setManualNonce(0);
          }}
          label="Translate as I type"
          description="Off translates only when you press the button. Each line is always translated on its own, never together."
        />
        {!live ? (
          <Button
            size="sm"
            onClick={() => {
              setDebounced(input);
              setManualNonce((n) => n + 1);
            }}
            disabled={!input.trim()}
          >
            Translate now
          </Button>
        ) : null}
      </div>

      {wrongWay ? (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[var(--fire)] bg-[var(--fire-soft)] px-4 py-3 text-sm font-bold">
          <span aria-hidden>💡</span>
          That looks like {inputIsJapanese ? "Japanese" : "English"}.
          <button type="button" onClick={swap} className="underline underline-offset-2">
            Swap the direction
          </button>
        </p>
      ) : null}

      {activeError ? (
        <p
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[var(--cherry)] bg-[var(--cherry-soft)] px-4 py-3 text-sm font-bold"
        >
          <span aria-hidden>⚠️</span>
          {activeError.message}
          {activeError.retryable ? (
            <button
              type="button"
              onClick={() => setManualNonce((n) => n + 1)}
              className="underline underline-offset-2"
            >
              Try again
            </button>
          ) : null}
          <span className="w-full text-xs font-semibold">
            The readings, romaji and typing guide below still work — they run on your device.
          </span>
        </p>
      ) : null}

      {filled.length > 0 ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-extrabold">Word by word</p>
            <p className="text-xs font-semibold text-[var(--muted)]">
              Reading on top · word · how to say it · what it means
            </p>
          </div>

          {filled.map((segment, lineIndex) => (
            <div key={lineIndex} className={cn(lineIndex > 0 && "mt-4 border-t-2 border-[var(--border)] pt-4")}>
              <div className="do-scroll flex flex-wrap items-end gap-1 overflow-x-auto pb-1">
                {segment.analysis.tokens.map((token, position) => (
                  <TokenColumn
                    key={position}
                    token={token}
                    active={selected === `${segments.indexOf(segment)}:${position}`}
                    onSelect={() => {
                      const id = `${segments.indexOf(segment)}:${position}`;
                      setSelected(selected === id ? null : id);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}

          {selectedToken ? (
            <div className="mt-3 rounded-2xl border-2 border-[var(--sun)] bg-[var(--sun-soft)] p-4">
              <p className="text-2xl font-black" lang="ja">
                {selectedToken.surface}
                {selectedToken.reading && selectedToken.reading !== selectedToken.surface ? (
                  <span className="ml-2 text-base font-extrabold text-[var(--muted)]">
                    {selectedToken.reading}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-sm font-bold lowercase text-[var(--sky-dark)] dark:text-[var(--sky)]">
                {selectedToken.romaji}
              </p>
              {selectedToken.meaning ? (
                <p className="mt-1 text-sm font-semibold">{selectedToken.meaning}</p>
              ) : null}
              <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                {SOURCE_NOTES[selectedToken.source]}
              </p>

              {selectedToken.typing ? (
                <p className="mt-3 text-sm font-bold">
                  <span className="text-[var(--muted)]">Type </span>
                  <span className="rounded-lg border-2 border-[var(--border-strong)] bg-[var(--bg)] px-2 py-1 font-mono lowercase">
                    {selectedToken.typing}
                  </span>
                  {selectedToken.needsConversion ? (
                    <span className="text-[var(--muted)]"> then press space to convert it</span>
                  ) : null}
                </p>
              ) : null}

              {selectedToken.kanji.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {selectedToken.kanji.map((entry) => (
                    <KanjiCard key={entry.kanji} entry={entry} />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
              Tap any word for its readings, meaning and the keys you would press to type it.
            </p>
          )}

          <ul className="mt-4 flex flex-wrap gap-3 border-t-2 border-[var(--border)] pt-3 text-[11px] font-bold text-[var(--muted)]">
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-[var(--grass)]" /> known word
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-[var(--sky)]" /> kana, exact
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-[var(--grape)]" /> particle
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-[var(--fire)]" /> read from the kanji, approximate
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-[var(--cherry)]" /> no reading found
            </li>
          </ul>
        </Card>
      ) : null}

      {wholeJapanese ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["Hiragana", wholeHiragana, "grass", "ja"],
            ["Katakana", wholeKatakana, "sky", "ja"],
            ["Romaji", wholeRomaji, "grape", "en"],
          ] as const).map(([label, value, tone, lang]) => (
            <Card key={label} className={cn("p-4", `bg-[var(--${tone}-soft)]`)}>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                {label}
              </p>
              <p
                className={cn(
                  "mt-1 whitespace-pre-wrap break-words text-lg font-extrabold",
                  label === "Romaji" && "lowercase",
                )}
                lang={lang}
              >
                {value || "—"}
              </p>
              <div className="mt-2">
                <CopyButton value={value} label="Copy" disabled={!value} />
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {allKanji.length > 0 ? (
        <Card className="p-4">
          <p className="text-sm font-extrabold">
            Kanji in this text <span className="text-[var(--muted)]">({allKanji.length})</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
            On readings came from Chinese and are used in compound words; kun readings are the
            native Japanese ones, used when the kanji stands alone. That is why 新入社員 is read
            shin-nyuu-sha-in rather than with the kun readings of its four characters.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {allKanji.map((entry) => (
              <KanjiCard key={entry.kanji} entry={entry} />
            ))}
          </ul>
        </Card>
      ) : null}

      {wholeTyping ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-extrabold">How to type it</p>
            <CopyButton value={wholeTyping} label="Copy keystrokes" />
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-[var(--panel)] px-4 py-3 font-mono text-base font-bold lowercase">
            {wholeTyping}
          </p>
          <p className="mt-3 text-sm font-semibold text-[var(--muted)]">
            Switch to the Japanese IME first — Control+Space on macOS, Windows+Space on Windows —
            then type these letters. Where the sentence has kanji, type the reading and press
            space to convert. F7 forces katakana, F6 forces hiragana.
          </p>
        </Card>
      ) : null}

      {unresolved.length > 0 ? (
        <p className="rounded-2xl border-2 border-[var(--cherry)] bg-[var(--cherry-soft)] px-4 py-3 text-sm font-semibold">
          <strong className="font-extrabold">No reading found for </strong>
          <span lang="ja" className="text-lg font-black">{unresolved.join("、")}</span>. These are
          shown as ? in the romaji rather than left as kanji, so the pronunciation line never
          contains characters you came here unable to read.
        </p>
      ) : approximate ? (
        <p className="rounded-2xl bg-[var(--sun-soft)] px-4 py-3 text-sm font-semibold">
          Some readings above are marked approximate. Those are compounds not in the bundled
          vocabulary, read from the on&rsquo;yomi of each kanji — usually right, but compounds
          sometimes shift sound, as 学校 does in becoming gakkou rather than gakukou.
        </p>
      ) : null}

      <InfoNote icon="🌐">
        <strong className="font-extrabold">Translation is the one part that leaves your browser.</strong>{" "}
        A translation model is far too large to run in a page, so each line is sent to MyMemory, a
        free public service, once you pause typing — one line at a time, never joined together.
        Results are reused when you retype the same phrase, so live translation stays within the
        free quota. Your text does reach them, so do not paste anything confidential. The readings,
        romaji, kanji breakdown and typing guide all run on your device and keep working if that
        service is unavailable.
      </InfoNote>
    </div>
  );
}
