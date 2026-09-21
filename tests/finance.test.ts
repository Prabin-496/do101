import { describe, it, expect } from "vitest";
import { compound, effectiveAnnualRate } from "@/lib/calculators/compound";
import { emi, loan, yearly } from "@/lib/calculators/loan";
import {
  CURRENCIES, convert, historyUrl, parseHistory, parseLatest, rate, withMargin, PEGGED, RateError,
} from "@/lib/currency/rates";
import { quoteToAccount, sizePosition, valuePerPipPerLot } from "@/lib/trading/risk";
import { getInstrument } from "@/lib/trading/types";

const base = { principal: 0, annualRate: 0, years: 0, compounding: 12 as const, monthlyContribution: 0, contributeAtStart: false, inflation: 0 };

describe("compound interest", () => {
  it("matches P(1 + r/n)^(nt) when nothing is added", () => {
    const yearly = compound({ ...base, principal: 10_000, annualRate: 5, years: 10, compounding: 1 });
    expect(yearly.finalBalance).toBeCloseTo(10_000 * 1.05 ** 10, 6);
    const monthly = compound({ ...base, principal: 10_000, annualRate: 5, years: 10, compounding: 12 });
    expect(monthly.finalBalance).toBeCloseTo(10_000 * (1 + 0.05 / 12) ** 120, 6);
    const quarterly = compound({ ...base, principal: 5_000, annualRate: 8, years: 7, compounding: 4 });
    expect(quarterly.finalBalance).toBeCloseTo(5_000 * (1 + 0.08 / 4) ** 28, 6);
  });

  it("values monthly deposits as an annuity, end or start of month", () => {
    // 100 a month at 12% compounded monthly for a year: the textbook annuity.
    const end = compound({ ...base, annualRate: 12, years: 1, monthlyContribution: 100 });
    expect(end.finalBalance).toBeCloseTo(100 * ((1.01 ** 12 - 1) / 0.01), 6);
    const start = compound({ ...base, annualRate: 12, years: 1, monthlyContribution: 100, contributeAtStart: true });
    expect(start.finalBalance).toBeCloseTo(100 * ((1.01 ** 12 - 1) / 0.01) * 1.01, 6);
    expect(end.totalContributed).toBeCloseTo(1200);
  });

  it("reports the effective annual rate and the doubling time", () => {
    expect(effectiveAnnualRate(12, 12) * 100).toBeCloseTo(12.6825, 3);
    const result = compound({ ...base, principal: 1, annualRate: 7.2, years: 1, compounding: 1 });
    expect(result.doublingYears).toBeCloseTo(Math.log(2) / Math.log(1.072), 8);
  });

  it("keeps the yearly table consistent with the totals", () => {
    const result = compound({ ...base, principal: 1000, annualRate: 6, years: 5, monthlyContribution: 50 });
    expect(result.years).toHaveLength(5);
    const last = result.years.at(-1)!;
    expect(last.balance).toBeCloseTo(result.finalBalance, 8);
    expect(result.years.reduce((a, y) => a + y.interestThisYear, 0)).toBeCloseTo(result.totalInterest, 6);
  });

  it("deflates to today's money when an inflation rate is given", () => {
    const result = compound({ ...base, principal: 1000, annualRate: 0, years: 10, inflation: 3 });
    expect(result.realBalance).toBeCloseTo(1000 / 1.03 ** 10, 6);
    expect(compound({ ...base, principal: 1000, years: 1 }).realBalance).toBeNull();
  });

  it("does nothing strange at zero", () => {
    const result = compound({ ...base, principal: 1000, annualRate: 0, years: 3 });
    expect(result.finalBalance).toBeCloseTo(1000);
    expect(result.doublingYears).toBeNull();
  });
});

describe("loan repayments", () => {
  it("computes the standard EMI", () => {
    expect(emi(100_000, 12, 12)).toBeCloseTo(8884.88, 2);
    expect(emi(200_000, 6, 360)).toBeCloseTo(1199.1, 2);
    expect(emi(12_000, 0, 12)).toBeCloseTo(1000);
  });

  it("pays the loan off exactly, with interest that adds up", () => {
    const result = loan({ principal: 100_000, annualRate: 12, months: 12, extraMonthly: 0 })!;
    expect(result.monthsTaken).toBe(12);
    expect(result.schedule.at(-1)!.balance).toBeCloseTo(0, 6);
    expect(result.totalInterest).toBeCloseTo(8884.88 * 12 - 100_000, 0);
    const principalRepaid = result.schedule.reduce((a, r) => a + r.principal, 0);
    expect(principalRepaid).toBeCloseTo(100_000, 6);
  });

  it("shows what overpaying saves", () => {
    const plain = loan({ principal: 200_000, annualRate: 6, months: 360, extraMonthly: 0 })!;
    const extra = loan({ principal: 200_000, annualRate: 6, months: 360, extraMonthly: 200 })!;
    expect(extra.monthsTaken).toBeLessThan(plain.monthsTaken);
    expect(extra.monthsSaved).toBe(plain.monthsTaken - extra.monthsTaken);
    expect(extra.interestSaved).toBeCloseTo(plain.totalInterest - extra.totalInterest, 6);
    expect(extra.interestSaved).toBeGreaterThan(0);
    expect(extra.schedule.at(-1)!.balance).toBeCloseTo(0, 6);
  });

  it("makes the last payment only what is left", () => {
    const result = loan({ principal: 1000, annualRate: 10, months: 12, extraMonthly: 300 })!;
    const last = result.schedule.at(-1)!;
    expect(last.payment).toBeLessThanOrEqual(result.emi + 300 + 1e-9);
    expect(last.balance).toBeCloseTo(0, 9);
  });

  it("rolls the schedule up by year", () => {
    const result = loan({ principal: 50_000, annualRate: 8, months: 60, extraMonthly: 0 })!;
    const years = yearly(result.schedule);
    expect(years).toHaveLength(5);
    expect(years.reduce((a, y) => a + y.interest, 0)).toBeCloseTo(result.totalInterest, 6);
    expect(years.at(-1)!.balance).toBeCloseTo(0, 6);
  });

  it("refuses nonsense rather than returning a number", () => {
    expect(loan({ principal: 0, annualRate: 5, months: 12, extraMonthly: 0 })).toBeNull();
    expect(loan({ principal: 1000, annualRate: 5, months: 0, extraMonthly: 0 })).toBeNull();
    expect(loan({ principal: 1000, annualRate: -1, months: 12, extraMonthly: 0 })).toBeNull();
  });
});

describe("currency conversion", () => {
  const table = parseLatest({ base: "EUR", date: "2026-09-18", rates: { USD: 1.1, INR: 100, JPY: 160 } });

  it("builds cross rates through the euro", () => {
    expect(rate("EUR", "USD", table)).toBeCloseTo(1.1);
    expect(rate("USD", "INR", table)).toBeCloseTo(100 / 1.1, 10);
    expect(convert(250, "USD", "JPY", table)).toBeCloseTo((250 / 1.1) * 160, 10);
    // A round trip comes back to where it started.
    expect(convert(convert(123, "USD", "INR", table)!, "INR", "USD", table)).toBeCloseTo(123, 10);
  });

  it("derives the Nepalese rupee from its official peg to the Indian rupee", () => {
    expect(PEGGED.NPR.to).toBe("INR");
    expect(rate("INR", "NPR", table)).toBeCloseTo(1.6, 12);
    expect(rate("USD", "NPR", table)).toBeCloseTo((100 / 1.1) * 1.6, 10);
    expect(CURRENCIES).toContain("NPR");
  });

  it("says nothing rather than something wrong for an unknown currency", () => {
    expect(convert(1, "USD", "XYZ", table)).toBeNull();
  });

  it("rejects a reply it cannot read", () => {
    expect(() => parseLatest({ nope: true })).toThrow(RateError);
    expect(() => parseLatest({ base: "USD", date: "x", rates: {} })).toThrow(RateError);
  });

  it("reads a history series, pegged currencies included", () => {
    const points = parseHistory(
      { rates: { "2026-09-02": { USD: 1.2, INR: 100 }, "2026-09-01": { USD: 1.1, INR: 100 } } },
      "USD",
      "NPR",
    );
    expect(points.map((p) => p.date)).toEqual(["2026-09-01", "2026-09-02"]);
    expect(points[0].rate).toBeCloseTo((100 / 1.1) * 1.6, 10);
  });

  it("asks for the anchor when a pegged currency is charted", () => {
    const url = historyUrl("USD", "NPR", 30, new Date(Date.UTC(2026, 8, 21)));
    expect(url).toContain("symbols=INR,USD");
    expect(url).not.toContain("NPR");
    expect(url).toContain("2026-08-22..2026-09-21");
  });

  it("shows what a retail margin costs", () => {
    expect(withMargin(1000, 3)).toBeCloseTo(970);
  });
});

describe("pip value in your own currency", () => {
  it("needs no conversion when the pair is quoted in the account currency", () => {
    expect(quoteToAccount(getInstrument("EURUSD"), 1.1, "USD")).toEqual({ rate: 1, how: "same" });
    expect(quoteToAccount(getInstrument("XAUUSD"), 2000, "USD")).toEqual({ rate: 1, how: "same" });
  });

  it("inverts the pair's own price when the account currency is the base", () => {
    // USD/JPY at 150 for a USD account: one yen is worth 1/150 of a dollar.
    const result = quoteToAccount(getInstrument("USDJPY"), 150, "USD");
    expect(result.how).toBe("inverted");
    expect(result.rate).toBeCloseTo(1 / 150, 12);
    // So a pip on a standard lot is 100,000 × 0.01 ÷ 150 ≈ $6.67.
    expect(valuePerPipPerLot(getInstrument("USDJPY"), result.rate!)).toBeCloseTo(6.6667, 3);
  });

  it("asks for a cross rate when neither side is the account currency", () => {
    expect(quoteToAccount(getInstrument("EURGBP"), 0.86, "USD")).toEqual({ rate: null, how: "needed" });
    const withRate = quoteToAccount(getInstrument("EURGBP"), 0.86, "USD", 1.27);
    expect(withRate).toEqual({ rate: 1.27, how: "cross" });
    expect(valuePerPipPerLot(getInstrument("EURGBP"), 1.27)).toBeCloseTo(12.7, 6);
  });

  it("sizes a USD/JPY position correctly for a dollar account", () => {
    const instrument = getInstrument("USDJPY");
    const conversion = quoteToAccount(instrument, 150, "USD");
    const sizing = sizePosition({
      balance: 10_000, riskPercent: 1, entry: 150, stop: 149.5, instrument,
      leverage: 100, quoteToAccountRate: conversion.rate!, roundLots: false, minLot: 0.01, lotStep: 0.01,
    });
    // $100 over 50 pips at ≈$6.67 a pip per lot is 0.3 lots.
    expect(sizing.lots).toBeCloseTo(100 / (50 * (100_000 * 0.01) / 150), 6);
    expect(sizing.actualRisk).toBeCloseTo(100, 6);
  });
});
