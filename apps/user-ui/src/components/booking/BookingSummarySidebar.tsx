/**
 * BookingSummarySidebar.tsx
 * =========================
 * Desktop sticky sidebar. Step 1 adds an Insurance card above the recap.
 */

"use client";

import { ArrowLeft, ArrowRight, Calendar, Clock, Lock, Plane, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { InsuranceOption } from "./BookingFormUi";
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
      {currentStep === 1 && (
        <InsuranceCard draft={draft} setDraftAction={setDraftAction} />
      )}

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
// INSURANCE CARD
// ============================================================

function InsuranceCard({
                         draft,
                         setDraftAction,
                       }: {
  draft: Draft;
  setDraftAction: (updater: (prev: Draft) => Draft) => void;
}) {
  const t = useTranslations("booking");
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.04)] dark:border-slate-800 dark:bg-slate-950">
      <div className="px-5 pt-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t("insurance.title")}
        </div>
      </div>
      <div className="px-5 pb-5 pt-3">
        <InsuranceOption
          selected={draft.insurance === "BASIC"}
          onSelectAction={() =>
            setDraftAction((prev) => ({ ...prev, insurance: "BASIC" }))
          }
          title={t("insurance.basic.title")}
          price={t("insurance.basic.price")}
          priceVariant="free"
          description={t("insurance.basic.description")}
        />
        <InsuranceOption
          selected={draft.insurance === "EXTENDED_500"}
          onSelectAction={() =>
            setDraftAction((prev) => ({ ...prev, insurance: "EXTENDED_500" }))
          }
          title={t("insurance.extended.title")}
          price={t("insurance.extended.price")}
          description={t("insurance.extended.description")}
          extraLink={{
            label: t("insurance.extended.ipidLink"),
            onClickAction: () => console.info("[booking] open IPID sheet"),
          }}
        />
      </div>
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
                  {trip.carrier.rating.toFixed(1)} ·{" "}
                  {t("summary.deals", { count: trip.carrier.dealCount })}
                </span>
              </div>
            </div>
          </div>

          <div className="mx-5 mb-4 space-y-2 border-b border-slate-100 pb-4 text-[12px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <Row icon={<Plane size={13} />}>
              {trip.originCity} → {trip.destinationCity}
            </Row>
            <Row icon={<Calendar size={13} />}>
              {departureDate} · {departureTime}
            </Row>
            {trip.durationHours && (
              <Row icon={<Clock size={13} />}>
                {trip.isDirect ? `${t("summary.directFlight")}, ` : ""}
                {t("summary.duration", { hours: trip.durationHours })}
              </Row>
            )}
          </div>
        </>
      )}

      <div className="px-5">
        <PriceRow label={t("summary.transport")} amount={price.transport} locale={locale} />
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
            <span>{t("back")}</span>
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
