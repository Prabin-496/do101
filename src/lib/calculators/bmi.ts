export type BmiCategory =
  | "Underweight"
  | "Healthy weight"
  | "Overweight"
  | "Obese class I"
  | "Obese class II"
  | "Obese class III";

export interface BmiResult {
  bmi: number;
  category: BmiCategory;
  healthyMinKg: number;
  healthyMaxKg: number;
}

export const BMI_BANDS: Array<{ label: BmiCategory; min: number; max: number; accent: string }> = [
  { label: "Underweight", min: 0, max: 18.5, accent: "sky" },
  { label: "Healthy weight", min: 18.5, max: 25, accent: "grass" },
  { label: "Overweight", min: 25, max: 30, accent: "sun" },
  { label: "Obese class I", min: 30, max: 35, accent: "fire" },
  { label: "Obese class II", min: 35, max: 40, accent: "fire" },
  { label: "Obese class III", min: 40, max: Infinity, accent: "cherry" },
];

export function bmiCategory(bmi: number): BmiCategory {
  return (BMI_BANDS.find((b) => bmi >= b.min && bmi < b.max)?.label ?? "Healthy weight");
}

/** Metric BMI: kg ÷ m². Adult scale only — not valid for children. */
export function calculateBmi(weightKg: number, heightCm: number): BmiResult | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) return null;
  if (weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  if (!Number.isFinite(bmi)) return null;
  return {
    bmi,
    category: bmiCategory(bmi),
    healthyMinKg: 18.5 * heightM * heightM,
    healthyMaxKg: 24.9 * heightM * heightM,
  };
}

export const LB_PER_KG = 2.2046226218;
export const CM_PER_INCH = 2.54;

export function imperialToMetric(
  feet: number,
  inches: number,
  pounds: number,
): { heightCm: number; weightKg: number } {
  const totalInches = (feet || 0) * 12 + (inches || 0);
  return {
    heightCm: totalInches * CM_PER_INCH,
    weightKg: (pounds || 0) / LB_PER_KG,
  };
}
