export interface DiscountResult {
  finalPrice: number;
  saved: number;
  effectivePercent: number;
  tax: number;
  priceBeforeTax: number;
}

/**
 * Discounts stack multiplicatively (20% then 10% is 28% off, not 30%).
 * Tax is applied after the discount, which is how most jurisdictions work.
 */
export function calculateDiscount({
  price,
  percent,
  secondPercent = 0,
  taxPercent = 0,
}: {
  price: number;
  percent: number;
  secondPercent?: number;
  taxPercent?: number;
}): DiscountResult | null {
  if (!Number.isFinite(price) || price < 0) return null;
  if (!Number.isFinite(percent)) return null;

  const first = price * (1 - percent / 100);
  const priceBeforeTax = first * (1 - (secondPercent || 0) / 100);
  const tax = priceBeforeTax * ((taxPercent || 0) / 100);

  return {
    priceBeforeTax,
    tax,
    finalPrice: priceBeforeTax + tax,
    saved: price - priceBeforeTax,
    effectivePercent: price === 0 ? 0 : ((price - priceBeforeTax) / price) * 100,
  };
}

/** Works backwards from the shelf price to the real percentage off. */
export function discountFromPrices(original: number, sale: number): number | null {
  if (!Number.isFinite(original) || !Number.isFinite(sale) || original <= 0) return null;
  return ((original - sale) / original) * 100;
}
