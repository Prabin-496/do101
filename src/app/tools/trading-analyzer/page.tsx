import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { TradingAnalyzer } from "@/components/tools/trading/TradingAnalyzer";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";

const tool = getTool("trading-analyzer")!;
export const metadata: Metadata = toolMetadata(tool);

const HONEST: [string, string][] = [
  [
    "A score is agreement, not a probability",
    "When the panel says 72, it means rules worth 72% of the weight you gave them point the same way. It does not mean 72% of such trades have worked, because nothing on this page could know that.",
  ],
  [
    "The next bar's open, never this bar's close",
    "A signal read at a close is filled at the following open. Filling at the closing price that produced the signal is the most common way a backtest invents money that was never available.",
  ],
  [
    "The stop wins a tie",
    "When one bar contains both your stop and your target, the order they happened in is unknowable from OHLC data, so the engine takes the stop. Pessimism is the only safe assumption there.",
  ],
  [
    "Costs are charged, not assumed away",
    "Half the spread on entry, half on exit, plus any commission and slippage you set. Fixed spreads are still optimistic: real ones widen exactly when a breakout rule wants to trade.",
  ],
  [
    "A period the tuning never saw",
    "Parameters are chosen on one stretch of history and reported on a later one the search never looked at, alongside the rank agreement between the two and whether the winner sits on a plateau or a spike.",
  ],
  [
    "Nothing here can place an order",
    "There is no broker connection and no order endpoint in this application. The MetaTrader bridge calls three read-only functions. The paper account is a number in your browser's storage.",
  ],
];

export default function Page() {
  return (
    <>
      <JsonLd
        data={[
          toolSchema(tool),
          faqSchema(tool.faqs)!,
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "Learn", href: "/tools?category=learn" },
            { name: tool.name, href: tool.route },
          ]),
        ]}
      />
      <ToolShell
        tool={tool}
        wide
        extraContent={
          <>
            <section aria-labelledby="honest-heading">
              <h2 id="honest-heading" className="mb-3 text-xl sm:text-2xl">
                How this tool avoids lying to you
              </h2>
              <p className="mb-3 text-sm font-semibold text-[var(--muted)]">
                A backtester is easy to write and easy to fool. These are the decisions that make the numbers
                worth reading — each one makes the results look worse, which is the point.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {HONEST.map(([title, detail]) => (
                  <li key={title} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
                    <p className="text-sm font-extrabold">{title}</p>
                    <p className="text-xs font-semibold text-[var(--muted)]">{detail}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="gold-heading">
              <h2 id="gold-heading" className="mb-3 text-xl sm:text-2xl">
                Why gold gets its own desk
              </h2>
              <div className="space-y-2 rounded-2xl bg-[var(--panel)] px-4 py-3">
                <p className="text-sm font-semibold">
                  XAU/USD is not a currency pair wearing a different name. A standard lot is 100 ounces, so a
                  one-dollar move is a hundred dollars a lot; a &ldquo;pip&rdquo; is a cent; and the daily range
                  is measured in whole dollars rather than fractions of one. A stop that would be enormous on
                  EUR/USD is ordinary on gold, and position sizes are routinely hundredths of a lot.
                </p>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  Gold also keeps office hours. Most of its range happens once London is open and again when New
                  York joins — the Gold desk tab measures that from the bars you loaded rather than asserting it,
                  so you can check whether it holds in the period you are testing. The presets, the default
                  spread assumption and the contract details all follow from that, and the MetaTrader bridge
                  replaces every assumption with your own broker&rsquo;s real figures.
                </p>
              </div>
            </section>

            <section aria-labelledby="free-heading">
              <h2 id="free-heading" className="mb-3 text-xl sm:text-2xl">
                What makes it free, and what that costs you
              </h2>
              <div className="space-y-2 rounded-2xl bg-[var(--panel)] px-4 py-3">
                <p className="text-sm font-semibold">
                  There is no DO101 server in the middle of any of this. Price requests go from your browser
                  straight to the source you picked, every calculation runs on your own device, and your
                  settings and paper account live in your browser&rsquo;s storage. That is why there is no
                  account to make and no limit on how much you can test.
                </p>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  The trade-off is honest about itself: free public sources are either daily-only, or track gold
                  through a proxy instrument rather than quoting XAU/USD directly. Each source states what it is
                  next to the chart. For bars that match your own platform exactly, the MetaTrader bridge and
                  CSV import are both free and both use data you already have.
                </p>
              </div>
            </section>
          </>
        }
      >
        <TradingAnalyzer />
      </ToolShell>
    </>
  );
}
