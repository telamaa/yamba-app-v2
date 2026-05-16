/**
 * BookingBottomSheet.tsx
 * ======================
 * Mobile sticky bottom sheet with detail disclosure + CTAs.
 */

"use client";

import { ArrowRight, ChevronDown, ChevronUp, Lock, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { MANGO } from "./BookingFormUi";
import type { Draft, PriceBreakdown, Step, TripContext } from "./booking.types";

type Props = {
  trip: TripContext;
  draft: Draft;
  price: PriceBreakdown;
  currentStep: Step;

  ctaPrimaryLabel: string;
  ctaPrimaryDisabled?: boolean;
  ctaIsLock?: boolean;
  onCtaPrimaryAction: () => void;
  showBackButton: boolean;
  onBackAction?: () => void;
};

export default function BookingBottomSheet({
                                             trip,
                                             draft,
                                             price,
                                             currentStep,
                                             ctaPrimaryLabel,
                                             ctaPrimaryDisabled,
                                             ctaIsLock,
                                             onCtaPrimaryAction,
                                             showBackButton,
                                             onBackAction,
                                           }: Props) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const initials =
    `${trip.carrier.firstName[0] ?? ""}${trip.carrier.lastInitial}`.toUpperCase();

  return (
    <div
      className="sticky bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.04)] dark:border-slate-700 dark:bg-slate-950"
      style={{ borderTopLeftRadius: 14, borderTopRightRadius: 14 }}
    >
      <div
        className="mx-auto my-2 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600"
        aria-hidden="true"
      />

      <div className="px-4 pb-3 pt-1">
        <div className="mb-2.5 flex items-center justify-between">
          <div>
            <div className="text-[12px] text-slate-500 dark:text-slate-400">
              {t("summary.totalLabel")}
            </div>
            <div className="text-[18px] font-medium">
              {formatPrice(price.total, locale)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px]"
            style={{ color: "#185FA5" }}
            aria-expanded={expanded}
          >
            <span>{expanded ? t("summary.hide") : t("summary.detail")}</span>
            {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>

        <div
          className={[
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
            expanded ? "mb-3 max-h-96 opacity-100" : "max-h-0 opacity-0",
          ].join(" ")}
        >
          <div className="mb-3 flex items-center gap-2.5 border-b border-slate-200 pb-2.5 dark:border-slate-700">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-medium text-white"
              style={{ background: "linear-gradient(135deg, #534AB7, #7F77DD)" }}
            >
              {initials}
            </div>
            <div className="flex-1">
              <div className="text-[12px] font-medium">
                {trip.carrier.firstName} {trip.carrier.lastInitial}.
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                <Star size={10} fill="#BA7517" stroke="#BA7517" />
                <span>
                  {trip.carrier.rating.toFixed(1)} ·{" "}
                  {t("summary.deals", { count: trip.carrier.dealCount })} ·{" "}
                  {trip.originCity} → {trip.destinationCity}
                </span>
              </div>
            </div>
          </div>
          <PriceRow label={t("summary.transport")} amount={price.transport} locale={locale} />
          <PriceRow
            label={t("summary.serviceYamba")}
            amount={price.serviceFee}
            locale={locale}
          />
          {price.insurance > 0 && (
            <PriceRow
              label={t("summary.insurance500")}
              amount={price.insurance}
              locale={locale}
            />
          )}
          {currentStep < 4 && (
            <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
              {draft.weightKg && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t("summary.parcel")} · {draft.weightKg} kg ·{" "}
                  {draft.declaredValueEur || "—"} €
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onCtaPrimaryAction}
          disabled={ctaPrimaryDisabled}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-3.5 text-[15px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: ctaPrimaryDisabled ? "#A8A8A2" : MANGO }}
        >
          {ctaIsLock && <Lock size={14} />}
          <span>{ctaPrimaryLabel}</span>
          {!ctaIsLock && <ArrowRight size={16} />}
        </button>
        {showBackButton && onBackAction && (
          <button
            type="button"
            onClick={onBackAction}
            className="mt-1 w-full p-2 text-center text-[13px] text-slate-500 dark:text-slate-400"
          >
            {t("back")}
          </button>
        )}
      </div>
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
    <div className="flex justify-between py-1 text-[12px] text-slate-500 dark:text-slate-400">
      <span>{label}</span>
      <span>{formatPrice(amount, locale)}</span>
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
