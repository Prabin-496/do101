import type { Tool } from "../types";

/**
 * Calculators. Every one shows the formula next to the answer.
 */
export const CALCULATORS_TOOLS: Tool[] = [
  {
    id: "age",
    name: "Age Calculator",
    short: "Work out an exact age in years, months and days.",
    long:
      "Enter a date of birth and DO101 works out the exact age today, or on any date you choose, down to the day. It also shows total months, weeks, days and the countdown to the next birthday.",
    category: "calculator",
    route: "/calculators/age",
    keywords: ["age calculator", "calculate age", "how old am i", "date of birth calculator", "age in days", "birthday countdown"],
    aliases: ["how old am i", "calculate my age", "birthday calculator"],
    icon: "🎂",
    accent: "fire",
    browserOnly: true,
    aiInvocable: true,
    input: "numbers",
    output: "numbers",
    related: ["percentage", "discount", "bmi", "timestamp-converter"],
    seoTitle: "Free Age Calculator — Exact Age in Years, Months & Days | DO101",
    seoDescription:
      "Calculate your exact age in years, months and days from a date of birth, plus total weeks, days, hours and a countdown to your next birthday.",
    steps: ["Enter the date of birth.", "Leave the second date as today, or pick another date.", "Read the exact age and the extra breakdowns."],
    features: ["Exact years, months and days", "Totals in months, weeks, days, hours and minutes", "Days until the next birthday", "Day of the week you were born", "Calculated locally"],
    faqs: [
      { q: "How is an exact age calculated?", a: "DO101 counts whole years first, then whole months from that anniversary, then the remaining days — the same way you would say it out loud. Calendar month lengths and leap years are handled properly." },
      { q: "Why does the day count differ from other calculators?", a: "Some tools approximate a month as 30 days. DO101 uses the real calendar, so February and 31-day months are counted correctly." },
    ],
    featured: true,
  },
  {
    id: "percentage",
    name: "Percentage Calculator",
    short: "Every percentage question in one place, with the formula shown.",
    long:
      "Work out what X% of a number is, what percentage one number is of another, and percentage increase or decrease between two values. Each answer shows the formula so you can check the working.",
    category: "calculator",
    route: "/calculators/percentage",
    keywords: ["percentage calculator", "calculate percentage", "percent of a number", "percentage increase", "percentage decrease", "percent change"],
    aliases: ["percent calculator", "work out percentage", "what percent is"],
    icon: "％",
    accent: "fire",
    browserOnly: true,
    aiInvocable: true,
    input: "numbers",
    output: "numbers",
    related: ["discount", "age", "bmi", "word-counter"],
    seoTitle: "Free Percentage Calculator — Percent Of, Change & Increase | DO101",
    seoDescription:
      "Calculate a percentage of a number, what percent one number is of another, and percentage increase or decrease. Formula shown with every answer.",
    steps: ["Pick the kind of percentage question you have.", "Type the two numbers.", "Read the answer and the formula underneath."],
    features: ["What is X% of Y", "X is what percent of Y", "Percentage increase and decrease", "Formula displayed with every result", "Instant, no page reload"],
    faqs: [
      { q: "How do I calculate a percentage increase?", a: "Subtract the old value from the new value, divide by the old value, then multiply by 100. Going from 80 to 100 is (100 − 80) / 80 × 100 = 25% increase." },
      { q: "Why is a 50% rise followed by a 50% fall not back to the start?", a: "Because each percentage applies to a different base. 100 rises to 150, then 50% of 150 is 75 — so you land at 75, not 100." },
    ],
    featured: true,
  },
  {
    id: "discount",
    name: "Discount Calculator",
    short: "See the sale price, the amount saved and the real discount.",
    long:
      "Enter an original price and a discount to see what you pay and what you save. It also works backwards: enter the original and sale prices to find the true percentage off, and stack a second discount or add tax.",
    category: "calculator",
    route: "/calculators/discount",
    keywords: ["discount calculator", "sale price calculator", "percent off calculator", "how much do i save", "double discount"],
    aliases: ["percent off", "sale price", "calculate discount"],
    icon: "🏷️",
    accent: "fire",
    browserOnly: true,
    aiInvocable: true,
    input: "numbers",
    output: "numbers",
    related: ["percentage", "age", "bmi", "qr-generator"],
    seoTitle: "Free Discount Calculator — Sale Price & Percent Off | DO101",
    seoDescription:
      "Calculate a sale price, the amount saved, stacked discounts and the true percentage off. Free discount calculator with the maths shown.",
    steps: ["Enter the original price.", "Enter the discount percentage, or the price you were quoted.", "Read the final price and your saving."],
    features: ["Discount to final price", "Final price back to true percentage off", "Stack a second discount correctly", "Optional tax on top", "Formula shown"],
    faqs: [
      { q: "How do stacked discounts work?", a: "They multiply rather than add. 20% off then a further 10% off is 0.8 × 0.9 = 0.72, so 28% off in total — not 30%." },
      { q: "Is tax applied before or after the discount?", a: "In most places the discount comes first and tax is charged on the reduced price. DO101 follows that order and shows both lines." },
    ],
  },
  {
    id: "bmi",
    name: "BMI Calculator",
    short: "Body Mass Index in metric or imperial, with the range explained.",
    long:
      "Calculate Body Mass Index from height and weight in either metric or imperial units, and see where the result sits on the standard adult scale. BMI is a rough screening number, not a diagnosis — the page explains what it does and does not tell you.",
    category: "calculator",
    route: "/calculators/bmi",
    keywords: ["bmi calculator", "body mass index", "calculate bmi", "bmi chart", "healthy weight calculator"],
    aliases: ["body mass index", "am i overweight calculator"],
    icon: "⚖️",
    accent: "fire",
    browserOnly: true,
    aiInvocable: true,
    input: "numbers",
    output: "numbers",
    related: ["percentage", "age", "discount", "timestamp-converter"],
    seoTitle: "Free BMI Calculator — Metric & Imperial Body Mass Index | DO101",
    seoDescription:
      "Calculate Body Mass Index in metric or imperial units and see the standard adult categories explained, with a clear note on BMI's limits.",
    steps: ["Choose metric or imperial.", "Enter your height and weight.", "Read your BMI and the category scale beneath it."],
    features: ["Metric (cm / kg) and imperial (ft, in / lb)", "Category scale with your position marked", "Healthy weight range for your height", "Plain-English limitations section", "Calculated on your device"],
    faqs: [
      { q: "Is BMI accurate?", a: "BMI is a population-level screening tool. It does not distinguish muscle from fat, and it can misclassify athletes, older adults, pregnant people and children. Treat it as one rough signal, not a verdict on your health." },
      { q: "What is the formula?", a: "Metric: weight in kilograms divided by height in metres squared. Imperial: 703 × weight in pounds ÷ height in inches squared." },
      { q: "Does DO101 store my measurements?", a: "No. The calculation runs in the page and nothing is transmitted or saved." },
    ],
  },
];
