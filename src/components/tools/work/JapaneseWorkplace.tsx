"use client";

import * as React from "react";
import Link from "next/link";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { downloadBlob, fileName, toDocx } from "@/lib/worktools/export";
import {
  analyseMessage, AUDIENCES, buildReply, CATEGORY_LABELS, PHRASES, replyText, SITUATIONS, toRomaji,
  type Audience, type PhraseCategory, type ReplySlots, type Situation,
} from "@/lib/worktools/jp-business";
import { CopyText, HowItWorks, useToday } from "./shared";

const SAMPLE = `山田様

いつもお世話になっております。
株式会社サクラの田中でございます。

先日お送りいただいたお見積りの件ですが、社内で前向きに検討させていただいております。
恐れ入りますが、納期について念のため確認させてください。
お手数ですが、明日までにご教示いただけますでしょうか。

何卒よろしくお願い申し上げます。`;

const EMPTY_SLOTS: ReplySlots = { recipient: "", recipientCompany: "", me: "", myCompany: "", topic: "", date: "", details: "" };

/**
 * Understand a Japanese work message — what it really means and what they
 * want back — and write a reply in the right register, with romaji and English.
 */
export function JapaneseWorkplace() {
  const now = useToday();
  const [tab, setTab] = React.useState("read");
  const [message, setMessage] = React.useState("");
  const [situation, setSituation] = React.useState<Situation>("accept");
  const [audience, setAudience] = React.useState<Audience>("client");
  const [slots, setSlots] = React.useState<ReplySlots>(EMPTY_SLOTS);
  const [guideQuery, setGuideQuery] = React.useState("");

  const analysis = React.useMemo(() => (message.trim() && now ? analyseMessage(message, now) : null), [message, now]);
  const lines = buildReply(situation, audience, slots);
  const email = replyText(lines, audience);
  const setSlot = (key: keyof ReplySlots, value: string) => setSlots((s) => ({ ...s, [key]: value }));

  const replyTo = (next: Situation) => {
    setSituation(next);
    if (analysis?.formality === "internal") setAudience("colleague");
    if (analysis?.formality === "external") setAudience("client");
    if (analysis?.deadline && !slots.date) {
      const [, m, d] = analysis.deadline.date.split("-").map(Number);
      setSlot("date", `${m}月${d}日`);
    }
    setTab("write");
  };

  const guide = PHRASES.filter((p) => {
    const q = guideQuery.trim().toLowerCase();
    return !q || p.jp.includes(q) || p.meaning.toLowerCase().includes(q) || p.literal.toLowerCase().includes(q) || toRomaji(p.kana).includes(q);
  });

  return (
    <div className="space-y-5">
      <Tabs
        ariaLabel="Mode"
        value={tab}
        onChange={setTab}
        items={[
          { id: "read", label: "Understand a message" },
          { id: "write", label: "Write a reply" },
          { id: "guide", label: `Phrase guide (${PHRASES.length})` },
        ]}
      />

      {tab === "read" ? (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="jw-msg" className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">Japanese message</label>
              <button type="button" className="text-xs font-extrabold underline" onClick={() => setMessage(SAMPLE)}>Try an example</button>
            </div>
            <Textarea id="jw-msg" rows={10} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Paste the email, chat or Slack message in Japanese…" lang="ja" />
          </div>

          {analysis ? (
            <>
              <div className="rounded-2xl border-2 border-[var(--sky)] bg-[var(--sky-soft)] px-4 py-3">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">What this message wants</p>
                <ul className="mt-1 space-y-1 text-sm font-semibold">
                  {analysis.summary.map((s) => <li key={s}>• {s}</li>)}
                </ul>
                <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                  Register: {analysis.formality === "external" ? "external / client (formal)" : analysis.formality === "internal" ? "internal / colleague" : "not clear"}
                </p>
              </div>

              <section>
                <h3 className="mb-2 text-base font-extrabold">Phrases in this message ({analysis.found.length})</h3>
                {analysis.found.length === 0 ? (
                  <p className="text-sm font-semibold text-[var(--muted)]">None of the {PHRASES.length} business phrases in the guide appear here. For a full translation, see the <Link href="/tools/japanese-translator" className="underline">Japanese translator</Link>.</p>
                ) : (
                  <ul className="space-y-2">
                    {analysis.found.map(({ phrase }) => (
                      <li key={phrase.jp} className="rounded-2xl border-2 border-[var(--border)] px-4 py-3">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span lang="ja" className="text-lg font-extrabold">{phrase.jp}</span>
                          <span className="text-sm font-semibold text-[var(--muted)]">{toRomaji(phrase.kana)}</span>
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${phrase.category === "refusal" ? "bg-[var(--cherry-soft)] text-[var(--cherry-dark)]" : "bg-[var(--panel-2)] text-[var(--muted)]"}`}>
                            {CATEGORY_LABELS[phrase.category]}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">Literally: “{phrase.literal}”</p>
                        <p className="mt-1 text-sm font-semibold">{phrase.meaning}</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--grass-dark)] dark:text-[var(--grass)]">→ {phrase.respond}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div>
                <p className="mb-2 text-sm font-extrabold">Reply to it</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.suggested.map((s) => (
                    <button key={s} type="button" onClick={() => replyTo(s)} className="rounded-xl border-2 border-[var(--grass)] bg-[var(--grass-soft)] px-3 py-1.5 text-xs font-extrabold">
                      {SITUATIONS.find((x) => x.id === s)?.label} →
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === "write" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="jw-situation">What you want to say</Label>
              <Select id="jw-situation" value={situation} onChange={(e) => setSituation(e.target.value as Situation)}>
                {SITUATIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="jw-audience">Writing to</Label>
              <Select id="jw-audience" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
                {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </Select>
              <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{AUDIENCES.find((a) => a.id === audience)?.note}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label htmlFor="jw-r">Their name</Label><Input id="jw-r" lang="ja" value={slots.recipient} onChange={(e) => setSlot("recipient", e.target.value)} placeholder="山田" /></div>
            {audience === "client" ? <div><Label htmlFor="jw-rc">Their company</Label><Input id="jw-rc" lang="ja" value={slots.recipientCompany} onChange={(e) => setSlot("recipientCompany", e.target.value)} placeholder="株式会社ABC" /></div> : null}
            <div><Label htmlFor="jw-me">Your name</Label><Input id="jw-me" lang="ja" value={slots.me} onChange={(e) => setSlot("me", e.target.value)} placeholder="リー" /></div>
            {audience === "client" ? <div><Label htmlFor="jw-mc">Your company</Label><Input id="jw-mc" lang="ja" value={slots.myCompany} onChange={(e) => setSlot("myCompany", e.target.value)} placeholder="DO商事" /></div> : null}
            <div><Label htmlFor="jw-topic" hint="in Japanese if you can">The task or topic</Label><Input id="jw-topic" lang="ja" value={slots.topic} onChange={(e) => setSlot("topic", e.target.value)} placeholder="見積書、資料、会議" /></div>
            <div><Label htmlFor="jw-date">Date</Label><Input id="jw-date" lang="ja" value={slots.date} onChange={(e) => setSlot("date", e.target.value)} placeholder="9月30日、明日、来週金曜日" /></div>
          </div>
          {situation === "answer" ? (
            <div>
              <Label htmlFor="jw-details" hint="in Japanese">Your answer</Label>
              <Textarea id="jw-details" lang="ja" rows={3} value={slots.details ?? ""} onChange={(e) => setSlot("details", e.target.value)} placeholder="例：納期は10月5日を予定しております。" />
            </div>
          ) : null}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-extrabold">Your email</h3>
              <CopyText text={email} label="Copy Japanese email" />
            </div>
            <pre lang="ja" className="whitespace-pre-wrap rounded-2xl border-2 border-[var(--border)] bg-[var(--panel)] p-4 text-base leading-relaxed">{email}</pre>
          </section>

          <section>
            <h3 className="mb-2 text-base font-extrabold">Line by line</h3>
            <ol className="space-y-2">
              {lines.map((l, i) => (
                <li key={i} className="rounded-xl bg-[var(--panel)] px-3 py-2">
                  <p lang="ja" className="font-extrabold">{l.jp}</p>
                  <p className="text-xs font-semibold text-[var(--muted)]">{toRomaji(l.kana)}</p>
                  <p className="text-sm font-semibold">{l.en}</p>
                </li>
              ))}
            </ol>
          </section>

          <button
            type="button"
            className="do-btn rounded-xl px-4 py-2 text-xs [--btn-bg:var(--panel)] [--btn-fg:var(--ink)] [--btn-shadow:var(--border-strong)]"
            onClick={async () => downloadBlob(await toDocx([
              { type: "title", text: "Reply" },
              { type: "paragraph", text: email },
              { type: "heading", text: "Line by line", level: 2 },
              { type: "table", rows: [["Japanese", "Romaji", "English"], ...lines.map((l) => [l.jp, toRomaji(l.kana), l.en])] },
            ], { title: "Japanese reply" }), fileName("japanese reply", "docx"))}
          >
            📝 Download as Word (with romaji and English)
          </button>
        </div>
      ) : null}

      {tab === "guide" ? (
        <div className="space-y-3">
          <Input value={guideQuery} onChange={(e) => setGuideQuery(e.target.value)} placeholder="Search: 検討, soft no, deadline, sorry…" aria-label="Search the phrase guide" />
          {(Object.keys(CATEGORY_LABELS) as PhraseCategory[]).map((category) => {
            const list = guide.filter((p) => p.category === category);
            if (!list.length) return null;
            return (
              <section key={category}>
                <h3 className="mb-2 mt-4 text-base font-extrabold">{CATEGORY_LABELS[category]}</h3>
                <div className="do-scroll overflow-x-auto rounded-2xl border-2 border-[var(--border)]">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-[var(--panel)] text-left text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                      <tr><th className="px-3 py-2">Phrase</th><th className="px-3 py-2">What it really means</th><th className="px-3 py-2">How to respond</th></tr>
                    </thead>
                    <tbody>
                      {list.map((p) => (
                        <tr key={p.jp} className="border-t border-[var(--border)] align-top">
                          <td className="px-3 py-2"><p lang="ja" className="font-extrabold">{p.jp}</p><p className="text-xs text-[var(--muted)]">{toRomaji(p.kana)}</p></td>
                          <td className="px-3 py-2 font-semibold">{p.meaning}</td>
                          <td className="px-3 py-2 text-[var(--muted)]">{p.respond}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      <HowItWorks>
        <p>
          Business Japanese leans on set phrases whose meaning is not the sum of their words. This recognises {PHRASES.length} of
          the most common ones and explains what each really means and what the sender expects — including the
          indirect refusals (前向きに検討します, 難しいです) that trip up almost everyone new to working in Japan. Deadlines like
          明日まで or 本日中 are picked up and dated.
        </p>
        <p>
          Replies are built from hand-written templates in three registers: client, boss and colleague. It does not
          translate whole sentences — that needs a translation service, and this tool uses none, so what you paste stays
          on your device. For a full translation, the <Link href="/tools/japanese-translator" className="underline">Japanese translator</Link> uses a free external service.
        </p>
      </HowItWorks>
    </div>
  );
}
