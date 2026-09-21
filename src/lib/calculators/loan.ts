/**
 * Loan repayments — EMI, amortisation and what overpaying saves.
 *
 * The EMI is the standard annuity formula, P·r·(1+r)^n / ((1+r)^n − 1) with a
 * monthly rate, which is what banks quote for home, car and personal loans.
 * The schedule is then built payment by payment rather than from the formula,
 * so rounding, a final short payment and any overpayment all come out as they
 * would on a real statement.
 */

export interface LoanInput {
  principal: number;
  /** Nominal annual rate, in percent. */
  annualRate: number;
  months: number;
  /** Paid on top of the EMI every month, straight off the principal. */
  extraMonthly: number;
}

export interface LoanRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface LoanResult {
  emi: number;
  totalPaid: number;
  totalInterest: number;
  /** Months it actually takes, which is shorter with overpayments. */
  monthsTaken: number;
  schedule: LoanRow[];
  /** Against the same loan with no overpayment. */
  interestSaved: number;
  monthsSaved: number;
  /** Interest as a share of what was borrowed. */
  interestShare: number;
}

export function emi(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 100 / 12;
  // An interest-free loan is simply the principal split evenly.
  if (r === 0) return principal / months;
  const growth = (1 + r) ** months;
  return (principal * r * growth) / (growth - 1);
}

function schedule(principal: number, annualRate: number, payment: number, cap: number): LoanRow[] {
  const r = annualRate / 100 / 12;
  const rows: LoanRow[] = [];
  let balance = principal;
  for (let month = 1; month <= cap && balance > 1e-9; month++) {
    const interest = balance * r;
    // The last payment only covers what is left.
    const pay = Math.min(payment, balance + interest);
    const towardPrincipal = pay - interest;
    balance = Math.max(0, balance - towardPrincipal);
    rows.push({ month, payment: pay, interest, principal: towardPrincipal, balance });
  }
  return rows;
}

export function loan(input: LoanInput): LoanResult | null {
  const { principal, annualRate, months } = input;
  if (!(principal > 0) || !(months > 0) || annualRate < 0) return null;

  const base = emi(principal, annualRate, months);
  const extra = Math.max(0, input.extraMonthly);
  const plain = schedule(principal, annualRate, base, months);
  const actual = extra > 0 ? schedule(principal, annualRate, base + extra, months) : plain;

  const sum = (rows: LoanRow[], key: keyof LoanRow) => rows.reduce((a, row) => a + row[key], 0);
  const totalInterest = sum(actual, "interest");
  const plainInterest = sum(plain, "interest");

  return {
    emi: base,
    totalPaid: sum(actual, "payment"),
    totalInterest,
    monthsTaken: actual.length,
    schedule: actual,
    interestSaved: plainInterest - totalInterest,
    monthsSaved: plain.length - actual.length,
    interestShare: (totalInterest / principal) * 100,
  };
}

/** Collapses the monthly schedule into one row per year, for a readable table. */
export function yearly(rows: LoanRow[]): { year: number; paid: number; interest: number; principal: number; balance: number }[] {
  const out: { year: number; paid: number; interest: number; principal: number; balance: number }[] = [];
  for (const row of rows) {
    const year = Math.ceil(row.month / 12);
    const current = out[year - 1] ?? { year, paid: 0, interest: 0, principal: 0, balance: 0 };
    current.paid += row.payment;
    current.interest += row.interest;
    current.principal += row.principal;
    current.balance = row.balance;
    out[year - 1] = current;
  }
  return out;
}
