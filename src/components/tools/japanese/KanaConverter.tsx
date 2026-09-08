"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Tabs } from "@/components/ui/Tabs";
import { InfoNote, EmptyState } from "@/components/ui/Feedback";
import {
  hasJapanese, kanaToRomaji, romajiToKana, toHiragana, toKatakana, typingSteps,
} from "@/lib/japanese/kana";
import { useIsHydrated } from "@/lib/utils/use-local";
import { cn } from "@/lib/utils/cn";

type Mode = "auto" | "toKana" | "toRomaji";

/** The kana chart, laid out the way it is taught. */
const CHART: Array<{ row: string; cells: Array<[kana: string, romaji: string]> }> = [
  { row: "", cells: [["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"]] },
  { row: "k", cells: [["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"]] },
  { row: "s", cells: [["さ", "sa"], ["し", "shi"], ["す", "su"], ["せ", "se"], ["そ", "so"]] },
  { row: "t", cells: [["た", "ta"], ["ち", "chi"], ["つ", "tsu"], ["て", "te"], ["と", "to"]] },
  { row: "n", cells: [["な", "na"], ["に", "ni"], ["ぬ", "nu"], ["ね", "ne"], ["の", "no"]] },
  { row: "h", cells: [["は", "ha"], ["ひ", "hi"], ["ふ", "fu"], ["へ", "he"], ["ほ", "ho"]] },
  { row: "m", cells: [["ま", "ma"], ["み", "mi"], ["む", "mu"], ["め", "me"], ["も", "mo"]] },
  { row: "y", cells: [["や", "ya"], ["", ""], ["ゆ", "yu"], ["", ""], ["よ", "yo"]] },
  { row: "r", cells: [["ら", "ra"], ["り", "ri"], ["る", "ru"], ["れ", "re"], ["ろ", "ro"]] },
  { row: "w", cells: [["わ", "wa"], ["", ""], ["", ""], ["", ""], ["を", "wo"]] },
  { row: "", cells: [["ん", "n"], ["", ""], ["", ""], ["", ""], ["", ""]] },
  { row: "g", cells: [["が", "ga"], ["ぎ", "gi"], ["ぐ", "gu"], ["げ", "ge"], ["ご", "go"]] },
  { row: "z", cells: [["ざ", "za"], ["じ", "ji"], ["ず", "zu"], ["ぜ", "ze"], ["ぞ", "zo"]] },
  { row: "d", cells: [["だ", "da"], ["ぢ", "ji"], ["づ", "zu"], ["で", "de"], ["ど", "do"]] },
  { row: "b", cells: [["ば", "ba"], ["び", "bi"], ["ぶ", "bu"], ["べ", "be"], ["ぼ", "bo"]] },
  { row: "p", cells: [["ぱ", "pa"], ["ぴ", "pi"], ["ぷ", "pu"], ["ぺ", "pe"], ["ぽ", "po"]] },
];

export function KanaConverter() {
  const [text, setText] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("auto");
  const [chartKatakana, setChartKatakana] = React.useState(false);
  const hydrated = useIsHydrated();

  const japanese = hasJapanese(text);
  const effective: Exclude<Mode, "auto"> =
    mode === "auto" ? (japanese ? "toRomaji" : "toKana") : mode;

  const output = React.useMemo(() => {
    if (!text.trim()) return { hiragana: "", katakana: "", romaji: "" };
    if (effective === "toKana") {
      const hiragana = romajiToKana(text);
      return { hiragana, katakana: toKatakana(hiragana), romaji: text };
    }
    return { hiragana: toHiragana(text), katakana: toKatakana(text), romaji: kanaToRomaji(text) };
  }, [text, effective]);

  const steps = React.useMemo(
    () => (output.hiragana ? typingSteps(effective === "toKana" ? output.hiragana : text) : []),
    [output.hiragana, text, effective],
  );

  const canSpeak = hydrated && typeof window !== "undefined" && "speechSynthesis" in window;

  function speak(value: string) {
    if (!canSpeak || !value) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = "ja-JP";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="space-y-4">
      <Tabs
        ariaLabel="Conversion direction"
        value={mode}
        onChange={(id) => setMode(id as Mode)}
        items={[
          { id: "auto", label: "Detect automatically" },
          { id: "toKana", label: "Romaji → Kana" },
          { id: "toRomaji", label: "Kana → Romaji" },
        ]}
      />

      <Card>
        <label htmlFor="kc-in" className="sr-only">Text to convert</label>
        <Textarea
          id="kc-in"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            effective === "toKana"
              ? "Type romaji: konnichiwa, arigatou, tokyou, ramen"
              : "Paste kana: こんにちは、ありがとう、ラーメン"
          }
          className="min-h-[120px] rounded-2xl border-0 text-lg focus:border-0"
          lang={effective === "toKana" ? "en" : "ja"}
        />
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button tone="ghost" onClick={() => setText("")} disabled={!text}>Clear</Button>
        {canSpeak ? (
          <Button
            tone="sky"
            onClick={() => speak(output.hiragana)}
            disabled={!output.hiragana}
          >
            🔊 Hear it
          </Button>
        ) : null}
      </div>

      {text.trim() ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["Hiragana", output.hiragana, "grass"],
            ["Katakana", output.katakana, "sky"],
            ["Romaji", output.romaji, "grape"],
          ] as const).map(([label, value, tone]) => (
            <Card key={label} className={cn("p-4", `bg-[var(--${tone}-soft)]`)}>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                {label}
              </p>
              <p className="mt-1 break-words text-xl font-extrabold" lang={label === "Romaji" ? "en" : "ja"}>
                {value || "—"}
              </p>
              <div className="mt-3">
                <CopyButton value={value} label="Copy" disabled={!value} />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="あ"
          title="Type romaji or paste kana"
          description="It works out which direction you want, or pick one above. Everything runs on your device."
        />
      )}

      {steps.length > 0 ? (
        <Card className="p-5">
          <p className="text-sm font-extrabold">Keystrokes on a Japanese IME</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {steps.map((step, index) => (
              <li
                key={index}
                className="rounded-xl border-2 border-[var(--border)] px-2.5 py-1.5 text-center"
                title={step.note}
              >
                <span className="block text-base font-extrabold" lang="ja">{step.kana}</span>
                <span className="block font-mono text-xs font-bold text-[var(--sky-dark)] dark:text-[var(--sky)]">
                  {step.keys || "space"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-extrabold">The kana chart</p>
          <Button size="sm" tone="panel" onClick={() => setChartKatakana((v) => !v)}>
            Showing {chartKatakana ? "katakana" : "hiragana"} — switch
          </Button>
        </div>
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
          Click any character to add it to the box above.
        </p>
        <div className="do-scroll mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse">
            <tbody>
              {CHART.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.cells.map(([kana, romaji], cellIndex) => (
                    <td key={cellIndex} className="p-1">
                      {kana ? (
                        <button
                          type="button"
                          onClick={() =>
                            setText((current) => current + (chartKatakana ? toKatakana(kana) : kana))
                          }
                          className="flex w-full flex-col items-center rounded-xl border-2 border-[var(--border)] py-2 transition hover:border-[var(--sky)] hover:bg-[var(--sky-soft)]"
                        >
                          <span className="text-xl font-extrabold" lang="ja">
                            {chartKatakana ? toKatakana(kana) : kana}
                          </span>
                          <span className="text-[10px] font-bold text-[var(--muted)]">{romaji}</span>
                        </button>
                      ) : (
                        <span className="block py-2" aria-hidden />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <InfoNote icon="🔒">
        <strong className="font-extrabold">This one is entirely offline.</strong>{" "}
        Kana map to sounds one-to-one, so conversion is a lookup rather than a
        guess — it is exact, and it needs no server. Nothing you type here is sent
        anywhere, and the page keeps working with no connection at all.
      </InfoNote>
    </div>
  );
}
