"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Toggle } from "@/components/ui/Field";
import { InfoNote } from "@/components/ui/Feedback";
import { annotate, type Token } from "@/lib/japanese/annotate";
import { hasJapanese, isKanji, typingSteps, typingString } from "@/lib/japanese/kana";
import { KANJI_MAP, type KanjiEntry } from "@/lib/japanese/dictionary";
import {
  TranslationError, cached, describeMatch, translate, worthTranslating,
  type Direction, type TranslationResult,
} from "@/lib/japanese/translate";
import { useIsHydrated } from "@/lib/utils/use-local";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

/** How long to wait after the last keystroke before asking for a translation. */
const DEBOUNCE_MS = 700;

const SOURCE_UNDERLINE: Record<Token["source"], string> = {
  word: "border-[var(--grass)]",
  kana: "border-[var(--sky)]",
  kanji: "border-dashed border-[var(--fire)]",
  unknown: "border-dashed border-[var(--cherry)]",
  other: "border-transparent",
};

const SOURCE_NOTE: Record<Token["source"], string> = {
  word: "Known word — this reading is reliable.",
  kana: "Kana reads exactly as written.",
  kanji: "Single kanji read on its own. Inside a compound it is often read differently.",
  unknown: "Not in the bundled vocabulary, so no reading is shown rather than a guess.",
  other: "",
};

/** How you would actually type this token on a Japanese IME. */
function typingHint(token: Token): { keys: string; convert: boolean } {
  const hasKanji = [...token.surface].some(isKanji);
  const source = hasKanji ? token.reading : token.surface;
  return { keys: source ? typingString(source) : "", convert: hasKanji };
}

/**
 * One word, stacked: reading on top, the word itself, then romaji and meaning.
 *
 * Reading the four rows downwards is the whole point — someone who cannot read
 * kanji can still follow the sentence, and picks up the reading by seeing it
 * sitting directly above the character every time.
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
        {token.surface.trim() ? token.surface : " "}
      </span>
    );
  }

  const showReading = token.reading && token.reading !== token.surface;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      title={SOURCE_NOTE[token.source]}
      className={cn(
        "flex min-w-0 flex-col items-center rounded-xl px-1.5 py-1 transition",
        active ? "bg-[var(--sun-soft)]" : "hover:bg-[var(--panel)]",
      )}
    >
      <span className="h-4 text-[11px] font-bold leading-none text-[var(--muted)]" lang="ja">
        {showReading ? token.reading : " "}
      </span>
      <span
        className={cn("mt-1 border-b-2 pb-0.5 text-2xl font-extrabold leading-tight", SOURCE_UNDERLINE[token.source])}
        lang="ja"
      >
        {token.surface}
      </span>
      <span className="mt-1 text-xs font-bold lowercase leading-none text-[var(--sky-dark)] dark:text-[var(--sky)]">
        {token.romaji || "?"}
      </span>
      <span className="mt-1 max-w-[9rem] truncate text-[10px] font-semibold leading-none text-[var(--muted)]">
        {token.meaning ?? " "}
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
  // The result is stored with the request that produced it, so "is a
  // translation outstanding?" is derived rather than tracked as its own flag
  // that could drift out of step with the request.
  const [payload, setPayload] = React.useState<{ key: string; result: TranslationResult } | null>(null);
  const [error, setError] = React.useState<{ key: string; message: string; retryable: boolean } | null>(null);
  const [live, setLive] = React.useState(true);
  const [manualNonce, setManualNonce] = React.useState(0);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [speaking, setSpeaking] = React.useState(false);

  const hydrated = useIsHydrated();
  const reported = React.useRef(false);

  // Wait for a pause in typing. Every keystroke would otherwise be a request,
  // and the free service counts words against a daily quota.
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(input), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [input]);

  const requestText = debounced.trim();
  const requestKey =
    requestText && worthTranslating(requestText, direction) ? `${direction}|${requestText}` : "";

  React.useEffect(() => {
    if (!requestKey) return;
    if (!live && manualNonce === 0) return;

    const controller = new AbortController();
    let cancelled = false;

    translate(requestText, direction, controller.signal)
      .then((translated) => {
        if (cancelled) return;
        setPayload({ key: requestKey, result: translated });
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
            : {
                key: requestKey,
                message: "Could not reach the translation service.",
                retryable: true,
              },
        );
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey, requestText, direction, live, manualNonce]);

  // The previous translation stays on screen, dimmed, while the next one is
  // fetched. Blanking the box on every keystroke makes live translation feel
  // broken even when it is working.
  const result = payload?.result ?? null;
  const fresh = payload?.key === requestKey;
  const activeError = error?.key === requestKey ? error : null;
  const busy =
    requestKey !== "" && !fresh && !activeError && (live || manualNonce > 0) && !cached(requestText, direction);

  // The Japanese half of the pair, wherever it currently sits.
  const japanese = direction === "en-ja" ? result?.text ?? "" : input;
  const reading = React.useMemo(() => (japanese ? annotate(japanese) : null), [japanese]);

  const kanji = React.useMemo(() => {
    const seen = new Set<string>();
    const found: KanjiEntry[] = [];
    for (const char of japanese) {
      if (!isKanji(char) || seen.has(char)) continue;
      seen.add(char);
      const entry = KANJI_MAP.get(char);
      if (entry) found.push(entry);
    }
    return found;
  }, [japanese]);

  const keystrokes = React.useMemo(
    () => (reading?.hiragana ? typingString(reading.hiragana) : ""),
    [reading],
  );

  const selectedToken = selected !== null ? reading?.tokens[selected] ?? null : null;

  const canSpeak = hydrated && typeof window !== "undefined" && "speechSynthesis" in window;

  function speak() {
    if (!canSpeak || !japanese) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(japanese);
    utterance.lang = "ja-JP";
    utterance.rate = 0.85;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function swap() {
    const next: Direction = direction === "en-ja" ? "ja-en" : "en-ja";
    const carried = result?.text ?? "";
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

  const confidence = result ? describeMatch(result.match) : null;
  const pending = input.trim() !== debounced.trim() && input.trim().length > 0;
  const outputText = result?.text ?? "";

  return (
    <div className="space-y-4">
      {/* Direction */}
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

      {/* The two boxes, each with its romaji directly underneath. */}
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
                ? "Start typing in English — the Japanese appears as you type."
                : "日本語を入力してください。"
            }
            className="do-scroll min-h-[150px] w-full resize-y bg-transparent p-4 text-xl font-extrabold leading-relaxed outline-none placeholder:text-base placeholder:font-semibold placeholder:text-[var(--muted)]"
          />
          {/* Romaji under the Japanese box, exactly where you would look for it. */}
          {direction === "ja-en" && reading?.romaji ? (
            <p className="border-t-2 border-[var(--border)] px-4 py-2.5 text-sm font-bold lowercase text-[var(--muted)]">
              {reading.romaji}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 border-t-2 border-[var(--border)] px-3 py-2">
            <span className="text-xs font-bold text-[var(--muted)]">
              {input.trim() ? `${input.trim().length} characters` : " "}
            </span>
            <span className="flex-1" />
            {input ? (
              <Button size="sm" tone="ghost" onClick={() => changeInput("")}>Clear</Button>
            ) : null}
          </div>
        </Card>

        <Card className="flex flex-col bg-[var(--panel)] p-0">
          <div className="min-h-[150px] flex-1 p-4">
            {outputText ? (
              <p
                className={cn(
                  "text-xl font-extrabold leading-relaxed transition-opacity",
                  fresh ? "opacity-100" : "opacity-45",
                )}
                lang={direction === "en-ja" ? "ja" : "en"}
              >
                {outputText}
              </p>
            ) : (
              <p className="text-base font-semibold text-[var(--muted)]">
                {busy ? "Translating…" : "The translation appears here as you type."}
              </p>
            )}
          </div>

          {/* Romaji under the Japanese output, the way Google Translate shows it. */}
          {direction === "en-ja" && reading?.romaji ? (
            <p className="border-t-2 border-[var(--border)] px-4 py-2.5 text-sm font-bold lowercase text-[var(--muted)]">
              {reading.romaji}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t-2 border-[var(--border)] px-3 py-2">
            {busy || pending ? (
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--muted)]">
                <span className="size-2 animate-pulse rounded-full bg-[var(--sky)]" aria-hidden />
                {busy ? "Translating" : "…"}
              </span>
            ) : confidence && outputText && fresh ? (
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-extrabold", `bg-[var(--${confidence.tone}-soft)]`)}>
                {confidence.label}
              </span>
            ) : null}
            <span className="flex-1" />
            {canSpeak && japanese ? (
              <Button size="sm" tone="sky" onClick={speak} disabled={speaking}>
                {speaking ? "🔊…" : "🔊 Hear it"}
              </Button>
            ) : null}
            {outputText ? <CopyButton value={outputText} label="Copy" /> : null}
          </div>
        </Card>
      </div>

      {/* Live status and controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Toggle
          checked={live}
          onChange={(value) => {
            setLive(value);
            if (value) setManualNonce(0);
          }}
          label="Translate as I type"
          description="Turn this off to translate only when you press the button — useful on a slow connection."
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
        </p>
      ) : null}

      {/* Word by word */}
      {reading && reading.tokens.length > 0 ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-extrabold">Word by word</p>
            <p className="text-xs font-semibold text-[var(--muted)]">
              Reading on top · word · how to say it · what it means
            </p>
          </div>

          <div className="do-scroll mt-3 flex flex-wrap items-end gap-1 overflow-x-auto pb-1">
            {reading.tokens.map((token, index) => (
              <TokenColumn
                key={index}
                token={token}
                active={selected === index}
                onSelect={() => setSelected(selected === index ? null : index)}
              />
            ))}
          </div>

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
                {selectedToken.romaji || "reading unknown"}
              </p>
              {selectedToken.meaning ? (
                <p className="mt-1 text-sm font-semibold">{selectedToken.meaning}</p>
              ) : null}
              <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                {SOURCE_NOTE[selectedToken.source]}
              </p>

              {(() => {
                const hint = typingHint(selectedToken);
                if (!hint.keys) return null;
                return (
                  <p className="mt-3 text-sm font-bold">
                    <span className="text-[var(--muted)]">Type </span>
                    <span className="rounded-lg border-2 border-[var(--border-strong)] bg-[var(--bg)] px-2 py-1 font-mono lowercase">
                      {hint.keys}
                    </span>
                    {hint.convert ? (
                      <span className="text-[var(--muted)]"> then press space to convert it</span>
                    ) : null}
                  </p>
                );
              })()}

              {selectedToken.kanji && selectedToken.kanji.length > 0 ? (
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
              <span className="inline-block h-0.5 w-4 bg-[var(--fire)]" /> single kanji, approximate
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-[var(--cherry)]" /> not in the vocabulary
            </li>
          </ul>
        </Card>
      ) : null}

      {/* Scripts */}
      {reading && japanese ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["Hiragana", reading.hiragana, "grass", "ja"],
            ["Katakana", reading.katakana, "sky", "ja"],
            ["Romaji", reading.romaji, "grape", "en"],
          ] as const).map(([label, value, tone, lang]) => (
            <Card key={label} className={cn("p-4", `bg-[var(--${tone}-soft)]`)}>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                {label}
              </p>
              <p
                className={cn("mt-1 break-words text-lg font-extrabold", label === "Romaji" && "lowercase")}
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

      {/* Kanji in the sentence */}
      {kanji.length > 0 ? (
        <Card className="p-4">
          <p className="text-sm font-extrabold">
            Kanji in this sentence <span className="text-[var(--muted)]">({kanji.length})</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
            On readings come from Chinese and appear in compound words; kun readings are the
            native Japanese ones, used when the kanji stands alone.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {kanji.map((entry) => (
              <KanjiCard key={entry.kanji} entry={entry} />
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Typing the whole thing */}
      {keystrokes ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-extrabold">How to type the whole sentence</p>
            <CopyButton value={keystrokes} label="Copy keystrokes" />
          </div>
          <p className="mt-2 break-words rounded-2xl bg-[var(--panel)] px-4 py-3 font-mono text-base font-bold lowercase">
            {keystrokes}
          </p>
          <ul className="do-scroll mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {typingSteps(reading!.hiragana).slice(0, 60).map((step, index) => (
              <li
                key={index}
                className="shrink-0 rounded-xl border-2 border-[var(--border)] px-2.5 py-1.5 text-center"
                title={step.note}
              >
                <span className="block text-base font-extrabold" lang="ja">{step.kana}</span>
                <span className="block font-mono text-[11px] font-bold lowercase text-[var(--sky-dark)] dark:text-[var(--sky)]">
                  {step.keys || "␣"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-semibold text-[var(--muted)]">
            Switch to the Japanese IME first — Control+Space on macOS, Windows+Space on Windows —
            then type these letters. Where the sentence has kanji, type the reading and press
            space to convert. F7 forces katakana, F6 forces hiragana.
          </p>
        </Card>
      ) : null}

      {reading && (reading.unknown.length > 0 || reading.tokens.some((t) => t.source === "kanji")) ? (
        <p className="rounded-2xl bg-[var(--sun-soft)] px-4 py-3 text-sm font-semibold">
          Some readings above are approximate. A kanji read on its own often takes a different
          reading inside a compound word, and the bundled vocabulary covers common words rather
          than the whole language. Anything underlined in red was left unread rather than guessed.
        </p>
      ) : null}

      <InfoNote icon="🌐">
        <strong className="font-extrabold">Translation is the one part that leaves your browser.</strong>{" "}
        A translation model is far too large to run in a page, so the text you type is sent to
        MyMemory, a free public service, once you pause typing. Results are reused when you retype
        the same phrase, so live translation stays within the free quota — but your text does reach
        them, so do not paste anything confidential. The readings, romaji, kanji breakdown and
        typing guide all run on your device and keep working if that service is unavailable.
      </InfoNote>
    </div>
  );
}
