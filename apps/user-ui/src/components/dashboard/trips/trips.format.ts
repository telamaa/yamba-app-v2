import { useTranslations } from "next-intl";
import type { ParcelCategory } from "@/components/booking/booking.types";
// Réutilisé depuis le module shipments — à remonter dans un lib/ partagé
// si un 3e module en a besoin.
export { formatRemaining } from "@/components/dashboard/shipments/shipments.types";

export type Translator = ReturnType<typeof useTranslations>;

export function intlLocale(locale: string): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}

export function formatMoney(locale: string, amount: number): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatWeight(locale: string, kg: number): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "unit",
    unit: "kilogram",
    maximumFractionDigits: 1,
  }).format(kg);
}

export function formatDateShort(locale: string, iso: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function formatDayMonth(locale: string, iso: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

/** FR "14h00" / EN "2:00 PM" */
export function formatTimeShort(locale: string, iso: string): string {
  const date = new Date(iso);
  if (locale === "fr") {
    const h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, "0");
    return h + "h" + m;
  }
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** "il y a 3 h" / "hier" — relatif auto */
export function formatRelativePast(
  locale: string,
  iso: string,
  nowMs: number
): string {
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), {
    numeric: "auto",
  });
  const diffMs = new Date(iso).getTime() - nowMs;
  const diffHours = Math.round(diffMs / 3_600_000);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  return rtf.format(Math.round(diffHours / 24), "day");
}

export function isSameDay(iso: string, nowMs: number): boolean {
  const a = new Date(iso);
  const b = new Date(nowMs);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Mapping statique (clés i18n dynamiques interdites — convention §4.5) */
export function categoryLabel(t: Translator, category: ParcelCategory): string {
  switch (category) {
    case "CLOTHES":
      return t("categories.CLOTHES");
    case "SHOES":
      return t("categories.SHOES");
    case "COSMETICS":
      return t("categories.COSMETICS");
    case "BOOKS":
      return t("categories.BOOKS");
    case "ELECTRONICS_SMALL":
      return t("categories.ELECTRONICS_SMALL");
    case "DOCUMENTS":
      return t("categories.DOCUMENTS");
    case "FOOD_DRY":
      return t("categories.FOOD_DRY");
    case "GIFTS":
      return t("categories.GIFTS");
    case "CHECKED_BAG_23KG":
      return t("categories.CHECKED_BAG_23KG");
    case "CABIN_BAG_12KG":
      return t("categories.CABIN_BAG_12KG");
    case "OTHER":
      return t("categories.OTHER");
  }
}
