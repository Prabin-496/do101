import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLanding, categoryMetadata, type CategoryPageConfig } from "@/components/tools/CategoryLanding";

const config: CategoryPageConfig = {
  category: "learn",
  path: "/tools/learn",
  title: "Free Learning Tools — Globe, Japanese, Trading Lab | DO101",
  description:
    "Free interactive learning tools: a 3D globe of every country, a Japanese translator with furigana and romaji, a kana converter, and a forex and gold strategy lab.",
  heading: "Learning tools",
  lead: "Interactive tools for understanding something properly — the countries of the world, Japanese script, and how trading strategies actually behave on real prices.",
  body: [
    {
      heading: "Tools you learn with, not just look things up in",
      text: (
        <>
          <p>
            A lookup gives you one answer and leaves. These are built so that using them teaches you
            something along the way. The <Link href="/tools/earth-globe">3D Earth Globe</Link> puts
            all 250 countries and territories on a globe you can spin, with each country&rsquo;s
            capital, languages, currency and neighbours a click away — and a quiz mode for when you
            want to test yourself rather than browse.
          </p>
          <p>
            For Japanese, the <Link href="/tools/japanese-translator">Japanese ⇄ English Translator</Link>{" "}
            prints the reading above every word and the romaji below it, so a sentence full of kanji
            stays readable before you can read kanji. The{" "}
            <Link href="/tools/romaji-converter">Romaji ⇄ Kana Converter</Link> handles the parts
            that trip learners up — the small tsu, contracted sounds like きゃ and the long-vowel mark
            — and shows the keystrokes for typing each character.
          </p>
        </>
      ),
    },
    {
      heading: "A trading lab that shows its working",
      text: (
        <>
          <p>
            <Link href="/tools/trading-analyzer">TradeLens</Link> is for learning how forex and gold
            strategies behave before any money is involved. Every buy or sell it shows comes with the
            exact rules that produced it, a backtest that charges realistic costs, and a held-back
            period the strategy was never tuned on — the check that tells a real edge from a curve
            fit. It is an education tool: it cannot place a real order and it is not financial
            advice.
          </p>
        </>
      ),
    },
    {
      heading: "Free, and nothing to sign up for",
      text: (
        <p>
          Everything here runs in your browser. There is no account, no trial and no upload — which
          is also why the translator, the kana converter and the trading lab keep working on your own
          device rather than on someone else&rsquo;s server.
        </p>
      ),
    },
  ],
  faqs: [
    {
      q: "Are these learning tools really free?",
      a: "Yes. There is no account, no subscription and no premium tier. They run in your browser, so there is no server cost to pass on to you.",
    },
    {
      q: "Can I use the Japanese tools as a complete beginner?",
      a: "Yes — that is who they are built for. The translator shows a reading and romaji for every word, and the kana converter includes a clickable chart, so you can read Japanese text long before you know the characters.",
    },
    {
      q: "Does TradeLens tell me what to trade?",
      a: "No. It shows what a set of rules would have done on past prices, with every rule visible. It cannot place orders, gives no personal advice, and past backtest performance does not predict future results.",
    },
  ],
};

export const metadata: Metadata = categoryMetadata(config);

export default function Page() {
  return <CategoryLanding config={config} />;
}
