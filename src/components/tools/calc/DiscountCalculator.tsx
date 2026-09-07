"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { CopyButton } from "@/components/ui/CopyButton";
import { Stat, ErrorState } from "@/components/ui/Feedback";
import { calculateDiscount, discountFromPrices } from "@/lib/calculators/discount";
import { formatNumber } from "@/lib/utils/format";
import { track } from "@/lib/analytics";

export function DiscountCalculator() {
  const [mode, setMode] = React.useState<"forward" | "reverse">("forward");
  const [price, setPrice] = React.useState("100");
  const [percent, setPercent] = React.useState("20");
  const [second, setSecond] = React.useState("");
  const [tax, setTax] = React.useState("");
  const [salePrice, setSalePrice] = React.useState("72");

  const forward = React.useMemo(() => {
    if (mode !== "forward") return null;
    const p = Number(price);
    const d = Number(percent);
    if (price === "" || percent === "" || !Number.isFinite(p) || !Number.isFinite(d)) return null;
    return calculateDiscount({
      price: p,
      percent: d,
      secondPercent: second ? Number(second) : 0,
      taxPercent: tax ? Number(tax) : 0,
    });
  }, [mode, price, percent, second, tax]);

  const reverse = React.useMemo(() => {
    if (mode !== "reverse") return null;
    const original = Number(price);
    const sale = Number(salePrice);
    if (price === "" || salePrice === "") return null;
    return discountFromPrices(original, sale);
  }, [mode, price, salePrice]);

  React.useEffect(() => {
    if (forward || reverse !== null) track("tool_complete", { tool: "discount", mode });
  }, [forward, reverse, mode]);

  return (
    <div className="space-y-4">
      <Tabs
        ariaLabel="Discount mode"
        value={mode}
        onChange={(v) => setMode(v as "forward" | "reverse")}
        items={[
          { id: "forward", label: "Price after discount" },
          { id: "reverse", label: "Find the % off" },
        ]}
      />

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="dc-price">Original price</Label>
            <Input
              id="dc-price"
              type="number"
              inputMode="decimal"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="text-lg"
            />
          </div>

          {mode === "forward" ? (
            <>
              <div>
                <Label htmlFor="dc-percent">Discount (%)</Label>
                <Input
                  id="dc-percent"
                  type="number"
                  inputMode="decimal"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  className="text-lg"
                />
              </div>
              <div>
                <Label htmlFor="dc-second" hint="optional">
                  Extra discount (%)
                </Label>
                <Input
                  id="dc-second"
                  type="number"
                  inputMode="decimal"
                  value={second}
                  onChange={(e) => setSecond(e.target.value)}
                  placeholder="e.g. an extra 10% at checkout"
                />
              </div>
              <div>
                <Label htmlFor="dc-tax" hint="optional">
                  Tax / VAT (%)
                </Label>
                <Input
                  id="dc-tax"
                  type="number"
                  inputMode="decimal"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                  placeholder="Applied after the discount"
                />
              </div>
            </>
          ) : (
            <div>
              <Label htmlFor="dc-sale">Sale price</Label>
              <Input
                id="dc-sale"
                type="number"
                inputMode="decimal"
                min={0}
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="text-lg"
              />
            </div>
          )}
        </div>
      </Card>

      {mode === "forward" && forward ? (
        <>
          <Card className="do-pop bg-[var(--fire-soft)] p-6 text-center">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
              You pay
            </p>
            <p className="mt-2 text-5xl font-extrabold tabular-nums">
              {formatNumber(forward.finalPrice, 2)}
            </p>
            <p className="mt-2 text-base font-extrabold text-[var(--grass)]">
              You save {formatNumber(forward.saved, 2)} ({formatNumber(forward.effectivePercent, 1)}
              % off)
            </p>
            <div className="mt-4 flex justify-center">
              <CopyButton
                value={`${formatNumber(forward.finalPrice, 2)} (saved ${formatNumber(forward.saved, 2)})`}
                label="Copy result"
                tone="fire"
              />
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Before tax" value={formatNumber(forward.priceBeforeTax, 2)} />
            <Stat label="Tax added" value={formatNumber(forward.tax, 2)} tone="sky" />
            <Stat
              label="True discount"
              value={`${formatNumber(forward.effectivePercent, 1)}%`}
              tone="grass"
              hint={second ? "Stacked discounts multiply" : undefined}
            />
          </div>

          {second ? (
            <p className="rounded-2xl bg-[var(--panel)] px-4 py-3 text-sm font-semibold">
              Stacked discounts multiply rather than add: {percent}% then {second}% is{" "}
              {formatNumber(forward.effectivePercent, 1)}% off in total, not{" "}
              {Number(percent) + Number(second)}%.
            </p>
          ) : null}
        </>
      ) : null}

      {mode === "reverse" ? (
        reverse === null ? (
          <ErrorState message="Enter an original price above zero and the price you were quoted." />
        ) : (
          <Card className="do-pop bg-[var(--fire-soft)] p-6 text-center">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
              That is
            </p>
            <p className="mt-2 text-5xl font-extrabold tabular-nums">
              {formatNumber(reverse, 2)}%
            </p>
            <p className="mt-2 text-base font-bold">
              {reverse >= 0 ? "off the original price" : "more than the original price"}
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-[var(--muted)]">
              ({price} − {salePrice}) ÷ {price} × 100
            </p>
          </Card>
        )
      ) : null}
    </div>
  );
}
