import type { CategoryCondition, ParcelCategory } from "./create-trip.types";

export type CategoryPriceRule = {
  currency: "EUR";
  minSuggestedPrice: number;
  maxAllowedPrice: number;
};

export const CATEGORY_PRICE_RULES: Record<ParcelCategory, CategoryPriceRule> = {
  clothes: { currency: "EUR", minSuggestedPrice: 8, maxAllowedPrice: 25 },
  shoes: { currency: "EUR", minSuggestedPrice: 10, maxAllowedPrice: 30 },
  fashionAccessories: { currency: "EUR", minSuggestedPrice: 8, maxAllowedPrice: 25 },
  otherAccessories: { currency: "EUR", minSuggestedPrice: 8, maxAllowedPrice: 25 },
  books: { currency: "EUR", minSuggestedPrice: 10, maxAllowedPrice: 30 },
  documents: { currency: "EUR", minSuggestedPrice: 5, maxAllowedPrice: 20 },
  smallToys: { currency: "EUR", minSuggestedPrice: 8, maxAllowedPrice: 25 },
  phone: { currency: "EUR", minSuggestedPrice: 15, maxAllowedPrice: 60 },
  computer: { currency: "EUR", minSuggestedPrice: 20, maxAllowedPrice: 90 },
  otherElectronics: { currency: "EUR", minSuggestedPrice: 15, maxAllowedPrice: 70 },
  checkedBag23kg: { currency: "EUR", minSuggestedPrice: 25, maxAllowedPrice: 100 },
  cabinBag12kg: { currency: "EUR", minSuggestedPrice: 15, maxAllowedPrice: 60 },
};

export function getDefaultPriceForCategory(categoryKey: ParcelCategory): number {
  return CATEGORY_PRICE_RULES[categoryKey].minSuggestedPrice;
}

export function clampCategoryPrice(
  categoryKey: ParcelCategory,
  price: number
): number {
  const rule = CATEGORY_PRICE_RULES[categoryKey];

  if (price < rule.minSuggestedPrice) {
    return rule.minSuggestedPrice;
  }

  if (price > rule.maxAllowedPrice) {
    return rule.maxAllowedPrice;
  }

  return price;
}

export function isCategoryPriceValid(
  categoryKey: ParcelCategory,
  price: number | ""
): boolean {
  if (price === "") return false;

  const rule = CATEGORY_PRICE_RULES[categoryKey];

  return price >= rule.minSuggestedPrice && price <= rule.maxAllowedPrice;
}

export function createDefaultCategoryCondition(
  categoryKey: ParcelCategory
): CategoryCondition {
  return {
    categoryKey,
    priceAmount: getDefaultPriceForCategory(categoryKey),
    handoffMoments: [],
    pickupMoments: [],
  };
}
