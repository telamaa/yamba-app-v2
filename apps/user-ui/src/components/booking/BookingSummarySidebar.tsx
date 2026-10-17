/**
 * BookingSummarySidebar.tsx
 * =========================
 * Desktop sticky sidebar : le trajet, le prix, le bouton. RIEN à décider ici —
 * la garantie est remontée dans le formulaire (revue UX 17/10).
 */

"use client";

import { ArrowLeft, ArrowRight, Bus, Calendar, Car, Clock, Lock, Plane, Route, Star, Train } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { countryFlag } from "@/lib/country-name";
import { useLocale, useTranslations } from "next-intl";
import type { Draft, PriceBreakdown, Step, TripContext } from "./booking.types";

type Props = {
  trip: TripContext;
  draft: Draft;
  setDraftAction: (updater: (prev: Draft) => Draft) => void;
  price: PriceBreakdown;
  currentStep: Step;

  ctaPrimaryLabel: string;
  ctaPrimaryDisabled?: boolean;
  ctaIsLock?: boolean;
  onCtaPrimaryAction: () => void;
  showBackButton: boolean;
  onBackAction?: () => void;
};

/**
 * L'icone du trajet SUIT son mode. Elle etait cablee sur `Plane` : un trajet en
 * train s'affichait avec un avion, et la duree se lisait « de vol » (retour de
 * recette du 17/10). Les quatre modes du TripContext sont couverts, BUS compris
 * — un mode non reconnu n'a pas d'icone plutot qu'une fausse.
 */
const TRAVEL_MODE_ICONS: Record<string, LucideIcon> = {
  PLANE: Plane,
  TRAIN: Train,
  CAR: Car,
  BUS: Bus,
};

export default function BookingSummarySidebar({
                                                trip,
                                                draft,
                                                setDraftAction,
                                                price,
                                                currentStep,
                                                ctaPrimaryLabel,
                                                ctaPrimaryDisabled,
                                                ctaIsLock,
                                                onCtaPrimaryAction,
                                                showBackButton,
                                                onBackAction,
                                              }: Props) {
  return (
    <div className="space-y-4">
      {/* Le prix et le CTA d'abord (ce que je paie), la protection ensuite */}
      <RecapCard
        trip={trip}
        price={price}
        currentStep={currentStep}
        ctaPrimaryLabel={ctaPrimaryLabel}
        ctaPrimaryDisabled={ctaPrimaryDisabled}
        ctaIsLock={ctaIsLock}
        onCtaPrimaryAction={onCtaPrimaryAction}
        showBackButton={showBackButton}
        onBackAction={onBackAction}
      />
    </div>
  );
}

// ============================================================
// RECAP CARD
// ============================================================

function RecapCard({
                     trip,
                     price,
                     currentStep,
                     ctaPrimaryLabel,
                     ctaPrimaryDisabled,
                     ctaIsLock,
                     onCtaPrimaryAction,
                     showBackButton,
                     onBackAction,
                   }: {
  trip: TripContext;
  price: PriceBreakdown;
  currentStep: Step;
  ctaPrimaryLabel: string;
  ctaPrimaryDisabled?: boolean;
  ctaIsLock?: boolean;
  onCtaPrimaryAction: () => void;
  showBackButton: boolean;
  onBackAction?: () => void;
}) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const initials =
    `${trip.carrier.firstName[0] ?? ""}${trip.carrier.lastInitial}`.toUpperCase();
  const departureDate = formatDateShort(trip.departureDate, locale);
  const departureTime = formatTimeShort(trip.departureDate, locale);
  const TravelIcon = trip.travelMode ? TRAVEL_MODE_ICONS[trip.travelMode] ?? Route : Route;
  const originFlag = countryFlag(trip.originCountryCode);
  const destinationFlag = countryFlag(trip.destinationCountryCode);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.04)] dark:border-slate-800 dark:bg-slate-950">
      <div className="px-5 pb-3 pt-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {currentStep === 4 ? t("summary.toPayTitle") : t("summary.tripSelectedTitle")}
        </div>
      </div>

      {currentStep !== 4 && (
        <>
          <div className="mx-5 mb-4 flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-medium text-white"
              style={{ background: "linear-gradient(135deg, #534AB7, #7F77DD)" }}
            >
              {initials}
            </div>
            <div>
              <div className="text-[14px] font-medium text-slate-900 dark:text-white">
                {trip.carrier.firstName} {trip.carrier.lastInitial}.
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <Star size={11} fill="#BA7517" stroke="#BA7517" />
                <span>
                  {trip.carrier.dealCount > 0
                    ? `${trip.carrier.rating.toFixed(1)} · ${t("summary.deals", { count: trip.carrier.dealCount })}`
                    : t("summary.newTripper")}
                </span>
              </div>
            </div>
          </div>

          <div className="mx-5 mb-4 space-y-2 border-b border-slate-100 pb-4 text-[12px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <Row icon={<TravelIcon size={13} />}>
              {/* Drapeaux decoratifs (aria-hidden) : la ville porte deja le sens,
                  et un lecteur d'ecran annoncerait « drapeau de la France » pour rien. */}
              {originFlag && <span aria-hidden="true">{originFlag}&nbsp;</span>}
              {trip.originCity} →{" "}
              {destinationFlag && <span aria-hidden="true">{destinationFlag}&nbsp;</span>}
              {trip.destinationCity}
            </Row>
            <Row icon={<Calendar size={13} />}>
              {departureDate} · {departureTime}
            </Row>
            {trip.durationHours && (
              <Row icon={<Clock size={13} />}>
                {trip.isDirect ? `${t("summary.direct")}, ` : ""}
                {trip.travelMode
                  ? t(`summary.durationByMode.${trip.travelMode}`, { hours: trip.durationHours })
                  : t("summary.durationNeutral", { hours: trip.durationHours })}
              </Row>
            )}
          </div>
        </>
      )}

      {/* ANO-WEB-37 (recette 5.12) — devis indisponible (poids vide, taille manquante…) : l'indice, JAMAIS « 0 € » */}
      {price.quote === null && price.quoteError ? (
        <div className="px-5">
          <div className="mb-1 rounded-md bg-[#FFF6E8] px-2.5 py-1.5 text-[11px] text-[#B45309] dark:bg-[#FF9900]/10 dark:text-[#FFB84D]">
            {t(`summary.quoteHint.${price.quoteError}`)}
          </div>
        </div>
      ) : (
      <div className="px-5">
        <PriceRow
            label={
              price.quote?.pricingModel === "PER_KG"
                ? t("summary.transportDetail", {
                    kg: (price.quote.billableWeightKg ?? 0).toLocaleString(locale === "fr" ? "fr-FR" : "en-US"),
                    rate: formatPrice((price.quote.pricePerKgCents ?? 0) / 100, locale),
                    size: price.quote.sizeClass ?? "",
                  }) + (price.quote.familySurchargePct > 0 ? ` · +${price.quote.familySurchargePct} %` : "")
                : t("summary.transport")
            }
            amount={price.transport}
            locale={locale}
          />
          {price.quote === null && price.quoteError && (
            <div className="mb-1 rounded-md bg-[#FFF6E8] px-2.5 py-1.5 text-[11px] text-[#B45309] dark:bg-[#FF9900]/10 dark:text-[#FFB84D]">
              {t(`summary.quoteHint.${price.quoteError}`)}
            </div>
          )}
          {/* D81 — on ne dit plus « minimum appliqué » sans dire LEQUEL : le
              plancher du trajet et le minimum de la taille ne se corrigent pas
              de la même façon (baisser le poids, ou changer de taille). */}
          {price.quote && price.quote.billableReason && price.quote.billableReason !== "ACTUAL" && (
            <div className="-mt-0.5 mb-1 text-[11px] text-slate-500 dark:text-slate-400">
              {price.quote.billableReason === "SIZE_MIN"
                ? t("summary.billableSizeMin", { size: price.quote.sizeClass ?? "", kg: price.quote.billableWeightKg ?? 0 })
                : t("summary.billableFloor", { kg: price.quote.billableWeightKg ?? 0 })}
            </div>
          )}
        <PriceRow label={t("summary.serviceYamba")} amount={price.serviceFee} locale={locale} />
        {price.insurance > 0 && (
          <PriceRow label={t("summary.insurance500")} amount={price.insurance} locale={locale} />
        )}
        <div className="mt-2 flex justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
          <span className="text-[15px] font-medium text-slate-900 dark:text-white">
            {t("summary.total")}
          </span>
          <span className="text-[18px] font-black tabular-nums text-slate-900 dark:text-white">
            {formatPrice(price.total, locale)}
          </span>
        </div>
        <div className="mt-1.5 text-[11px] leading-[1.5] text-slate-500 dark:text-slate-400">
          {currentStep === 4 ? t("summary.totalNoteLong") : t("summary.totalNote")}
        </div>
      </div>
      )}

      <div className="mt-4 space-y-2 border-t border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
        <button
          type="button"
          onClick={onCtaPrimaryAction}
          disabled={ctaPrimaryDisabled}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#FF9900] px-4 py-3 text-[14px] font-bold text-slate-950 shadow-sm transition-all hover:bg-[#F08700] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
        >
          {ctaIsLock && <Lock size={14} />}
          <span>{ctaPrimaryLabel}</span>
          {!ctaIsLock && <ArrowRight size={14} />}
        </button>
        {showBackButton && onBackAction && (
          <button
            type="button"
            onClick={onBackAction}
            className="flex w-full items-center justify-center gap-1 rounded-full px-4 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={13} />
            <span>{t("previousStep")}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function PriceRow({
                    label,
                    amount,
                    locale,
                  }: {
  label: string;
  amount: number;
  locale: string;
}) {
  return (
    <div className="flex justify-between py-1 text-[13px] text-slate-600 dark:text-slate-400">
      <span>{label}</span>
      <span className="tabular-nums">{formatPrice(amount, locale)}</span>
    </div>
  );
}

function formatPrice(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatDateShort(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

function formatTimeShort(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
