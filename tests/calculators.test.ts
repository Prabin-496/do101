import { describe, it, expect } from "vitest";
import { calculateAge } from "@/lib/calculators/age";
import { percentOf, isWhatPercent, percentChange } from "@/lib/calculators/percentage";
import { calculateDiscount, discountFromPrices } from "@/lib/calculators/discount";
import { calculateBmi, bmiCategory, imperialToMetric } from "@/lib/calculators/bmi";

describe("age calculator", () => {
  it("computes a whole number of years on a birthday", () => {
    const result = calculateAge(new Date(2000, 0, 15), new Date(2026, 0, 15));
    expect(result).toMatchObject({ years: 26, months: 0, days: 0 });
  });

  it("does not round up the day before a birthday", () => {
    const result = calculateAge(new Date(2000, 0, 15), new Date(2026, 0, 14));
    expect(result?.years).toBe(25);
    expect(result?.months).toBe(11);
  });

  it("borrows days from the correct calendar month, not a flat 30", () => {
    // 31 Jan → 1 March 2025 (February has 28 days in 2025)
    const result = calculateAge(new Date(2025, 0, 31), new Date(2025, 2, 1));
    expect(result?.months).toBe(1);
    expect(result?.days).toBe(1);
  });

  it("handles a 29 February birth date", () => {
    const result = calculateAge(new Date(2020, 1, 29), new Date(2024, 1, 29));
    expect(result?.years).toBe(4);
    expect(result?.days).toBe(0);
  });

  it("counts leap days in the total day count", () => {
    // 2024 is a leap year, so this span is 366 days.
    const result = calculateAge(new Date(2024, 0, 1), new Date(2025, 0, 1));
    expect(result?.totalDays).toBe(366);
  });

  it("returns null when the birth date is in the future", () => {
    expect(calculateAge(new Date(2030, 0, 1), new Date(2026, 0, 1))).toBeNull();
  });

  it("counts days until the next birthday", () => {
    const result = calculateAge(new Date(2000, 0, 20), new Date(2026, 0, 15));
    expect(result?.nextBirthdayInDays).toBe(5);
    expect(result?.turningAge).toBe(26);
  });
});

describe("percentage calculator", () => {
  it("finds X% of Y", () => {
    expect(percentOf(15, 480).value).toBe(72);
  });

  it("handles zero percent", () => {
    expect(percentOf(0, 480).value).toBe(0);
  });

  it("handles a percentage above 100", () => {
    expect(percentOf(150, 200).value).toBe(300);
  });

  it("finds what percentage one number is of another", () => {
    expect(isWhatPercent(25, 200)?.value).toBe(12.5);
  });

  it("refuses to divide by zero", () => {
    expect(isWhatPercent(5, 0)).toBeNull();
    expect(percentChange(0, 10)).toBeNull();
  });

  it("computes an increase and a decrease", () => {
    expect(percentChange(80, 100)?.value).toBe(25);
    expect(percentChange(100, 75)?.value).toBe(-25);
  });

  it("uses the absolute base for negative starting values", () => {
    expect(percentChange(-100, -50)?.value).toBe(50);
  });
});

describe("discount calculator", () => {
  it("computes a simple discount", () => {
    const result = calculateDiscount({ price: 100, percent: 20 });
    expect(result?.finalPrice).toBe(80);
    expect(result?.saved).toBe(20);
  });

  it("stacks discounts multiplicatively, not additively", () => {
    const result = calculateDiscount({ price: 100, percent: 20, secondPercent: 10 });
    expect(result?.finalPrice).toBeCloseTo(72, 10);
    expect(result?.effectivePercent).toBeCloseTo(28, 10);
  });

  it("applies tax after the discount", () => {
    const result = calculateDiscount({ price: 100, percent: 50, taxPercent: 10 });
    expect(result?.priceBeforeTax).toBe(50);
    expect(result?.tax).toBeCloseTo(5, 10);
    expect(result?.finalPrice).toBeCloseTo(55, 10);
  });

  it("handles a zero discount", () => {
    expect(calculateDiscount({ price: 40, percent: 0 })?.finalPrice).toBe(40);
  });

  it("rejects a negative price", () => {
    expect(calculateDiscount({ price: -5, percent: 10 })).toBeNull();
  });

  it("works backwards from two prices", () => {
    expect(discountFromPrices(100, 72)).toBeCloseTo(28, 10);
  });

  it("returns null when the original price is zero", () => {
    expect(discountFromPrices(0, 10)).toBeNull();
  });
});

describe("BMI calculator", () => {
  it("uses kg ÷ m²", () => {
    const result = calculateBmi(70, 175);
    expect(result?.bmi).toBeCloseTo(22.857, 3);
    expect(result?.category).toBe("Healthy weight");
  });

  it("puts boundary values in the right band", () => {
    expect(bmiCategory(18.4)).toBe("Underweight");
    expect(bmiCategory(18.5)).toBe("Healthy weight");
    expect(bmiCategory(24.9)).toBe("Healthy weight");
    expect(bmiCategory(25)).toBe("Overweight");
    expect(bmiCategory(30)).toBe("Obese class I");
    expect(bmiCategory(41)).toBe("Obese class III");
  });

  it("rejects zero or negative measurements", () => {
    expect(calculateBmi(0, 175)).toBeNull();
    expect(calculateBmi(70, 0)).toBeNull();
    expect(calculateBmi(-70, 175)).toBeNull();
  });

  it("converts imperial input to metric", () => {
    const { heightCm, weightKg } = imperialToMetric(5, 9, 154);
    expect(heightCm).toBeCloseTo(175.26, 2);
    expect(weightKg).toBeCloseTo(69.85, 2);
  });

  it("gives the same answer through either unit system", () => {
    const { heightCm, weightKg } = imperialToMetric(5, 9, 154);
    expect(calculateBmi(weightKg, heightCm)?.bmi).toBeCloseTo(22.7, 1);
  });
});
