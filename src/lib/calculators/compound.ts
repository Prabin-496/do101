/**
 * Compound interest, with regular contributions.
 *
 * The awkward case every simple formula gets wrong is a monthly deposit into
 * an account that compounds at some other frequency. This simulates month by
 * month using the monthly rate *equivalent* to the stated compounding, so a
 * 6% rate compounded quarterly grows exactly as a bank would compound it, and
 * the deposits still land every month. With no deposits it reduces to the
 * textbook P(1 + r/n)^(nt), which the tests hold it to.
 */

export type Compounding = 1 | 2 | 4 | 12 | 365;

export const COMPOUNDING_LABELS: Record<Compounding, string> = {
  1: "Yearly",
  2: "Half-yearly",
  4: "Quarterly",
  12: "Monthly",
  365: "Daily",
};

export interface CompoundInput {
  principal: number;
  /** Nominal annual rate, in percent. */
  annualRate: number;
  years: number;
  compounding: Compounding;
  /** Added every month. */
  monthlyContribution: number;
  /** Deposits at the start of each month earn that month's interest. */
  contributeAtStart: boolean;
  /** Annual inflation, in percent, for the today's-money figure. Zero to skip. */
  inflation: number;
}

export interface CompoundYear {
  year: number;
  balance: number;
  contributed: number;
  interest: number;
  /** Interest earned in this year alone. */
  interestThisYear: number;
}

export interface CompoundResult {
  finalBalance: number;
  totalContributed: number;
  totalInterest: number;
  /** The final balance in today's money, after inflation. */
  realBalance: number | null;
  /** Annual rate actually earned once compounding is counted. */
  effectiveAnnualRate: number;
  years: CompoundYear[];
  /** Years for the starting sum alone to double, at this rate. */
  doublingYears: number | null;
}

export function effectiveAnnualRate(annualRatePercent: number, compounding: Compounding): number {
  const r = annualRatePercent / 100;
  return (1 + r / compounding) ** compounding - 1;
}

export function compound(input: CompoundInput): CompoundResult {
  const months = Math.max(0, Math.round(input.years * 12));
  const ear = effectiveAnnualRate(input.annualRate, input.compounding);
  const monthly = (1 + ear) ** (1 / 12) - 1;

  let balance = Math.max(0, input.principal);
  let contributed = balance;
  let lastYearInterest = 0;
  const years: CompoundYear[] = [];

  for (let m = 1; m <= months; m++) {
    if (input.contributeAtStart) {
      balance += input.monthlyContribution;
      contributed += input.monthlyContribution;
    }
    balance *= 1 + monthly;
    if (!input.contributeAtStart) {
      balance += input.monthlyContribution;
      contributed += input.monthlyContribution;
    }
    if (m % 12 === 0 || m === months) {
      const interest = balance - contributed;
      years.push({
        year: Math.ceil(m / 12),
        balance,
        contributed,
        interest,
        interestThisYear: interest - lastYearInterest,
      });
      lastYearInterest = interest;
    }
  }

  const realBalance =
    input.inflation > 0 ? balance / (1 + input.inflation / 100) ** input.years : null;

  return {
    finalBalance: balance,
    totalContributed: contributed,
    totalInterest: balance - contributed,
    realBalance,
    effectiveAnnualRate: ear * 100,
    years,
    doublingYears: ear > 0 ? Math.log(2) / Math.log(1 + ear) : null,
  };
}
