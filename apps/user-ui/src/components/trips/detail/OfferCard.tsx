"use client";

/**
 * OfferCard — « Ce que vous pouvez envoyer avec {prénom} » (moteur PER_KG).
 * ========================================================================
 * Le cœur de la page trajet : prix au kilo, kilos disponibles, exemple pour
 * LE poids de l'Expéditeur (mémorisé depuis la recherche), les 8 familles
 * (acceptée / supplément / refusée — D14), les forfaits bagage entier
 * (PRC-04). Pour un trajet legacy (sans €/kg) : rien — `CategoriesCard`
 * prend le relais.
 */

import { useLocale, useTranslations } from "next-intl";
import {
  Baby,
  Backpack,
  Check,
  FileText,
  Luggage,
  Package,
  ShoppingBag,
  Shirt,
  Smartphone,
  Sparkles,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import type { PublicTrip } from "@/lib/public-trip.types";
import { formatPrice, getPricePerKgCents } from "@/lib/public-trip.helpers";
import { MIN_PARCEL_PRICE_EUR, estimateShipperTotalCents } from "@/lib/pricing-example";

const FAMILIES: Array<{ key: string; icon: LucideIcon }> = [
  { key: "DOCUMENTS_PAPERS", icon: FileText },
  { key: "CLOTHES_TEXTILE", icon: Shirt },
  { key: "FOOD_DRY_SEALED", icon: Package },
  { key: "ELECTRONICS_DEVICES", icon: Smartphone },
  { key: "COSMETICS_CARE", icon: Sparkles },
  { key: "PARTS_TOOLS", icon: Wrench },
  { key: "TOYS_CHILDCARE", icon: Baby },
  { key: "MISC_ACCESSORIES", icon: ShoppingBag },
];

type Props = { trip: PublicTrip; weightKg: number | null };

export default function OfferCard({ trip, weightKg }: Props) {
  const t = useTranslations("tripDetail");
  const locale = useLocale() as "fr" | "en";

  const perKgCents = getPricePerKgCents(trip);
  if (!perKgCents) return null;

  const kg = weightKg ?? 2;
  const kgLabel = kg.toLocaleString(locale === "fr" ? "fr-FR" : "en-US");
  const example = estimateShipperTotalCents(perKgCents, kg).totalCents;
  const conditions = new Map((trip.familyConditions ?? []).map((c) => [c.familyKey, c]));
  const remaining = typeof trip.remainingKg === "number" ? trip.remainingKg : null;
  const notEnough = remaining !== null && weightKg !== null && remaining < weightKg;

  return (
    <section>
      <header className="px-5 pt-4 pb-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          {t("offer.title", { firstName: trip.tripper.firstName })}
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{t("offer.hint")}</p>
      </header>

      {/* Prix · capacité · estimation — deux stats aérées, puis l'estimation sur sa ligne */}
      <div
        className="mx-5 mb-5 rounded-2xl border border-[#0F766E]/20 px-5 py-4"
        style={{ background: "linear-gradient(135deg, rgba(15,118,110,0.07) 0%, rgba(255,153,0,0.05) 100%)" }}
      >
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("offer.perKg")}
            </div>
            <div className="mt-1.5 text-2xl font-black tabular-nums leading-none text-slate-900 dark:text-white">
              {formatPrice(perKgCents, trip.currencyCode, locale)}
              <span className="ml-0.5 text-sm font-semibold text-slate-500 dark:text-slate-400">/kg</span>
            </div>
          </div>
          {remaining !== null && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("offer.available")}
              </div>
              <div className={`mt-1.5 text-2xl font-black tabular-nums leading-none ${notEnough ? "text-slate-400 dark:text-slate-500" : "text-[#0F766E] dark:text-teal-400"}`}>
                {remaining.toLocaleString(locale === "fr" ? "fr-FR" : "en-US")}
                <span className="ml-0.5 text-sm font-semibold text-slate-500 dark:text-slate-400">kg</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-[#0F766E]/15 pt-3.5 dark:border-slate-700">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {notEnough ? t("offer.estimateLabel") : weightKg ? t("offer.estimateLabelFromSearch", { kg: kgLabel }) : t("offer.estimateLabel2", { kg: kgLabel })}
          </div>
          {notEnough ? (
            <div className="mt-1 text-[13px] font-semibold text-slate-600 dark:text-slate-300">{t("offer.notEnough", { kg: kgLabel })}</div>
          ) : (
            <>
              <div className="mt-1 text-lg font-bold tabular-nums leading-tight text-slate-900 dark:text-white">
                ≈ {formatPrice(example, trip.currencyCode, locale)}
                <span className="ml-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">{t("offer.allIn")}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t("offer.finalAtBooking")}</div>
            </>
          )}
          {/* D32 — annoncé, pas seulement appliqué */}
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            {t("offer.lightParcel", { min: MIN_PARCEL_PRICE_EUR })}
          </div>
        </div>
      </div>

      {/* Familles */}
      <div className="px-5 pb-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {t("offer.families")}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FAMILIES.map(({ key, icon: Icon }) => {
            const c = conditions.get(key);
            const refused = c?.mode === "REFUSE";
            const surcharged = c?.mode === "SURCHARGE";
            return (
              <span
                key={key}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  refused
                    ? "border-slate-200 bg-slate-50 text-slate-400 line-through dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500"
                    : surcharged
                      ? "border-[#FF9900]/40 text-slate-900 dark:text-[#FFB84D]"
                      : "border-[#0F766E]/25 text-slate-700 dark:text-slate-200",
                ].join(" ")}
                style={
                  surcharged
                    ? { backgroundColor: "rgba(255,153,0,0.10)" }
                    : refused
                      ? undefined
                      : { backgroundColor: "rgba(15,118,110,0.08)" }
                }
                title={refused ? t("offer.refused") : surcharged ? t("offer.surcharge", { pct: c?.surchargePct ?? 0 }) : t("offer.accepted")}
              >
                <Icon size={12} strokeWidth={1.75} />
                {t(`offer.family.${key}`)}
                {refused ? <X size={11} /> : surcharged ? <span className="font-bold">+{c?.surchargePct} %</span> : <Check size={11} className="text-[#0F766E] dark:text-teal-400" />}
              </span>
            );
          })}
        </div>
      </div>

      {/* Bagages entiers */}
      {(trip.checkedBag23PriceCents || trip.cabinBag12PriceCents) && (
        <div className="px-5 pb-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t("offer.bags")}
          </div>
          <div className="flex flex-wrap gap-2">
            {trip.checkedBag23PriceCents ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-[12px] text-slate-700 dark:border-slate-600 dark:text-slate-200">
                <Luggage size={13} /> {t("offer.checkedBag")} · <b>{formatPrice(trip.checkedBag23PriceCents, trip.currencyCode, locale)}</b>
              </span>
            ) : null}
            {trip.cabinBag12PriceCents ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-[12px] text-slate-700 dark:border-slate-600 dark:text-slate-200">
                <Backpack size={13} /> {t("offer.cabinBag")} · <b>{formatPrice(trip.cabinBag12PriceCents, trip.currencyCode, locale)}</b>
              </span>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
