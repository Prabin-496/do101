"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { ErrorState, InfoNote } from "@/components/ui/Feedback";
import { annotate, type Token } from "@/lib/japanese/annotate";
import { hasJapanese, typingSteps } from "@/lib/japanese/kana";
import {
  TranslationError, describeMatch, translate,
  type Direction, type TranslationResult,
} from "@/lib/japanese/translate";
import { useIsHydrated } from "@/lib/utils/use-local";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";

const SOURCE_STYLE: Record<Token["source"], string> = {
  word: "border-[var(--grass)]",
  kana: "border-[var(--sky)]",
  kanji: "border-[var(--fire)] border-dashed",
  unknown: "border-[var(--cherry)] border-dashed",
  other: "border-transparent",
};

const SOURCE_NOTE: Record<Token["source"], string> = {
  word: "From the bundled vocabulary — reliable.",
  kana: "Kana reads exactly as written.",
  kanji: "Single kanji read on its own. In a compound word it is often read differently.",
  unknown: "Not in the bundled vocabulary, so no reading is shown rather than a guess.",
  other: "",
};

/** Japanese text with its reading above it, the way furigana is printed. */
function Furigana({ tokens, size = "lg" }: { tokens: Token[]; size?: "lg" | "sm" }) {
  return (
    <p className={cn("flex flex-wrap items-end gap-x-0.5 gap-y-2", size === "lg" ? "text-2xl" : "text-lg")}>
      {tokens.map((token, index) => {
        const showReading =
          token.source !== "other" && token.source !== "kana" && token.reading !== token.surface;
        return (
          <span
            key={index}
            title={SOURCE_NOTE[token.source] || undefined}
            className={cn(
              "inline-flex flex-col items-center rounded border-b-2 px-0.5",
              SOURCE_STYLE[token.source],
            )}
          >
            {showReading ? (
              <span className="text-[0.5em] font-bold leading-tight text-[var(--muted)]">
                {token.reading || "?"}
              </span>
            ) : null}
            <span className="font-extrabold leading-snug">{token.surface}</span>
          </span>
        );
      })}
    </p>
  );
}

export function JapaneseTranslator() {
  const [direction, setDirection] = React.useState<Direction>("en-ja");
  const [input, setInput] = React.useState("");
  const [result, setResult] = React.useState<TranslationResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const reported = React.useRef(false);
  const hydrated = useIsHydrated();

  // The Japanese side of the pair, whichever box it is in.
  const japanese = direction === "en-ja" ? result?.text ?? "" : input;
  const reading = React.useMemo(() => (japanese ? annotate(japanese) : null), [japanese]);
  const typing = React.useMemo(() => (japanese ? typingSteps(japanese) : []), [japanese]);

  const canSpeak =
    hydrated && typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";

  React.useEffect(() => () => abortRef.current?.abort(), []);

  async function run() {
    const text = input.trim();
    if (!text) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setError(null);
    try {
      const translated = await translate(text, direction, controller.signal);
      setResult(translated);
      if (!reported.current) {
        reported.current = true;
        track("tool_complete", { tool: "japanese-translator" });
      }
    } catch (caught) {
      if ((caught as Error).name === "AbortError") return;
      setResult(null);
      setError(
        caught instanceof TranslationError
          ? caught.message
          : "Something went wrong reaching the translation service.",
      );
    } finally {
      setBusy(false);
    }
  }

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
    setDirection(next);
    if (result?.text) {
      setInput(result.text);
      setResult(null);
    }
    setError(null);
  }

  const confidence = result ? describeMatch(result.match) : null;
  const inputIsJapanese = hasJapanese(input);
  const directionLooksWrong =
    input.trim().length > 2 &&
    ((direction === "ja-en" && !inputIsJapanese) || (direction === "en-ja" && inputIsJapanese));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        <span className="rounded-2xl border-2 border-[var(--border)] px-4 py-2 text-sm font-extrabold">
          {direction === "en-ja" ? "English 🇬🇧" : "日本語 🇯🇵"}
        </span>
        <Button size="sm" tone="panel" onClick={swap} aria-label="Swap translation direction">
          ⇄
        </Button>
        <span className="rounded-2xl border-2 border-[var(--border)] px-4 py-2 text-sm font-extrabold">
          {direction === "en-ja" ? "日本語 🇯🇵" : "English 🇬🇧"}
        </span>
      </div>

      <Card>
        <label htmlFor="jt-in" className="sr-only">
          Text to translate
        </label>
        <Textarea
          id="jt-in"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") run();
          }}
          placeholder={
            direction === "en-ja"
              ? "Type English here. For example: Where is the nearest station?"
              : "日本語をここに入力してください。"
          }
          className="min-h-[140px] rounded-2xl border-0 text-lg focus:border-0"
          lang={direction === "en-ja" ? "en" : "ja"}
        />
      </Card>

      {directionLooksWrong ? (
        <p className="flex items-center gap-2 rounded-2xl border-2 border-[var(--fire)] bg-[var(--fire-soft)] px-4 py-3 text-sm font-bold">
          <span aria-hidden>💡</span>
          That looks like {inputIsJapanese ? "Japanese" : "English"} — did you mean to swap the
          direction?
          <button type="button" onClick={swap} className="underline underline-offset-2">
            Swap
          </button>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={busy || !input.trim()}>
          {busy ? "Translating…" : "Translate"}
        </Button>
        <Button
          tone="ghost"
          onClick={() => {
            setInput("");
            setResult(null);
            setError(null);
          }}
          disabled={!input && !result}
        >
          Clear
        </Button>
        <span className="self-center text-xs font-bold text-[var(--muted)]">
          or press {typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl"}+Enter
        </span>
      </div>

      {error ? <ErrorState message={error} /> : null}

      {result?.text ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Translation
            </p>
            {confidence ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-extrabold",
                  `bg-[var(--${confidence.tone}-soft)]`,
                )}
              >
                {confidence.label}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-2xl font-extrabold leading-relaxed" lang={direction === "en-ja" ? "ja" : "en"}>
            {result.text}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyButton value={result.text} label="Copy" />
            {canSpeak && direction === "en-ja" ? (
              <Button size="sm" tone="sky" onClick={speak} disabled={speaking}>
                {speaking ? "🔊 Speaking…" : "🔊 Hear it"}
              </Button>
            ) : null}
          </div>

          {result.alternatives.length > 0 ? (
            <div className="mt-4 border-t-2 border-[var(--border)] pt-3">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Other translations on record
              </p>
              <ul className="mt-2 space-y-1">
                {result.alternatives.map((alternative) => (
                  <li key={alternative} className="text-sm font-semibold text-[var(--muted)]">
                    {alternative}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      {reading && japanese ? (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                How to read it
              </p>
              {canSpeak && direction === "ja-en" ? (
                <Button size="sm" tone="sky" onClick={speak} disabled={speaking}>
                  {speaking ? "🔊 Speaking…" : "🔊 Hear it"}
                </Button>
              ) : null}
            </div>

            <div className="mt-3" lang="ja">
              <Furigana tokens={reading.tokens} />
            </div>

            <dl className="mt-5 space-y-3">
              <div>
                <dt className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  Hiragana
                </dt>
                <dd className="text-lg font-extrabold" lang="ja">{reading.hiragana}</dd>
              </div>
              <div>
                <dt className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  Katakana
                </dt>
                <dd className="text-lg font-extrabold" lang="ja">{reading.katakana}</dd>
              </div>
              <div>
                <dt className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  Romaji (Hepburn)
                </dt>
                <dd className="text-lg font-extrabold">{reading.romaji}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <CopyButton value={reading.hiragana} label="Copy hiragana" />
              <CopyButton value={reading.romaji} label="Copy romaji" />
            </div>

            <ul className="mt-4 flex flex-wrap gap-3 border-t-2 border-[var(--border)] pt-3 text-xs font-bold text-[var(--muted)]">
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-[var(--grass)]" /> known word
              </li>
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-[var(--sky)]" /> kana (exact)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-[var(--fire)]" /> single kanji (approximate)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-[var(--cherry)]" /> not in the vocabulary
              </li>
            </ul>

            {reading.tokens.some((t) => t.source === "kanji") || reading.unknown.length > 0 ? (
              <p className="mt-3 rounded-2xl bg-[var(--sun-soft)] px-4 py-3 text-sm font-semibold">
                Some readings here are approximate. A kanji read on its own often takes a
                different reading inside a compound word, and the bundled vocabulary covers
                common words rather than everything. Anything marked in red was left unread
                rather than guessed.
              </p>
            ) : null}
          </Card>

          {reading.tokens.some((token) => token.meaning) ? (
            <Card className="p-5">
              <p className="text-sm font-extrabold">Word by word</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {reading.tokens
                  .filter((token) => token.meaning)
                  .map((token, index) => (
                    <li
                      key={index}
                      className="rounded-2xl border-2 border-[var(--border)] p-3"
                    >
                      <p className="text-lg font-extrabold" lang="ja">
                        {token.surface}
                        <span className="ml-2 text-sm font-bold text-[var(--muted)]">
                          {token.reading} · {token.romaji}
                        </span>
                      </p>
                      <p className="text-sm font-semibold text-[var(--muted)]">{token.meaning}</p>
                      {token.kanji && token.kanji.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {token.kanji.map((entry) => (
                            <li key={entry.kanji} className="text-xs font-bold text-[var(--muted)]">
                              <span className="text-base font-extrabold text-[var(--ink)]" lang="ja">
                                {entry.kanji}
                              </span>{" "}
                              {entry.meaning}
                              {entry.on.length ? ` · on: ${entry.on.join("、")}` : ""}
                              {entry.kun.length ? ` · kun: ${entry.kun.join("、")}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </Card>
          ) : null}

          {typing.length > 0 ? (
            <Card className="p-5">
              <p className="text-sm font-extrabold">How to type it on a keyboard</p>
              <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                With a Japanese IME switched on, type these letters. Kanji are not typed
                directly — you type the reading and press space to convert.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {typing.map((step, index) => (
                  <li
                    key={index}
                    className="rounded-2xl border-2 border-[var(--border)] px-3 py-2 text-center"
                    title={step.note}
                  >
                    <span className="block text-lg font-extrabold" lang="ja">{step.kana}</span>
                    <span className="block font-mono text-sm font-bold text-[var(--sky-dark)] dark:text-[var(--sky)]">
                      {step.keys || "space"}
                    </span>
                    {step.alternatives.length > 0 ? (
                      <span className="block text-[10px] font-bold text-[var(--muted)]">
                        or {step.alternatives.join(", ")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-semibold text-[var(--muted)]">
                <strong className="font-extrabold text-[var(--ink)]">Switching the IME on:</strong>{" "}
                on macOS add Japanese under System Settings → Keyboard → Input Sources, then
                press Control+Space. On Windows add the Japanese language pack, then press the
                Windows key + Space. Press F7 to force katakana, F6 for hiragana.
              </p>
            </Card>
          ) : null}
        </>
      ) : null}

      <InfoNote icon="🌐">
        <strong className="font-extrabold">This one tool sends text to a translation service.</strong>{" "}
        Machine translation needs a model far too large to run in a page, so the
        translate button calls MyMemory, a free public API, directly from your
        browser. Your text goes to them; treat it as you would any website and do
        not paste anything confidential. Everything else on this page — the readings,
        romaji, kanji breakdown and typing guide — runs entirely on your device and
        keeps working even when the translation service is rate-limited.
      </InfoNote>
    </div>
  );
}
