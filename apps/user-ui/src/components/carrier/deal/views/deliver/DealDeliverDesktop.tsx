/**
 * DealDeliverDesktop.tsx
 * ======================
 * Desktop : format page — back + H1 + banner teal "arrivé" · gauche =
 * info box + Marie + OTP + aide + signaler · sidebar = colis + versement.
 */

"use client";

import { AlertTriangle, ArrowLeft, PlaneLanding } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { DealDeliverViewProps } from "./DealDeliverClient";
import DeliverHelpCard from "./DeliverHelpCard";
import { DeliverInfoBox, DeliverRecipientRow } from "./DeliverInfoBox";
import DeliverOtpInput from "./DeliverOtpInput";
import DeliverPhotosBlock from "./DeliverPhotosBlock";
import PhotoThumbs from "@/components/shared/photos/PhotoThumbs";

export default function DealDeliverDesktop(props: DealDeliverViewProps) {
  const t = useTranslations("carrierDealDeliver");
  const tBooking = useTranslations("booking");
  const locale = useLocale();
  const { deal } = props;

  const recipientFirstName = deal.recipient?.firstName ?? "";
  const shipperFirstName = deal.shipper.firstName;
  const city = deal.recipient?.city ?? deal.trip.destinationCity;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
        <button
          type="button"
          onClick={props.onBackAction}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft size={14} />
          {t("back")}
        </button>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          {t("title", { recipientFirstName })}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t("subtitle", { city })}
        </p>

        {/* Banner arrivée */}
        <div className="my-5 flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4 dark:border-teal-900/40 dark:bg-teal-950/30">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-teal-700 text-white dark:bg-teal-600">
            <PlaneLanding size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-teal-950 dark:text-teal-100 sm:text-[15px]">
              {t("banner.titleNoEvent")}
            </div>
            <div className="mt-0.5 text-[12px] text-teal-800 dark:text-teal-300 sm:text-[13px]">
              {t("banner.subtitleNoEvent", { recipientFirstName })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main */}
          <div className="space-y-4">
            <header>
              <h2 className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                {t("h1")}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("h1Subtitle", { recipientFirstName })}
              </p>
            </header>

            <DeliverInfoBox
              shipperFirstName={shipperFirstName}
              recipientFirstName={recipientFirstName}
            />

            {deal.recipient && <DeliverRecipientRow recipient={deal.recipient} />}

            {/* A76 — photo optionnelle de la remise, AVANT le code (le colis est encore en main). */}
            <DeliverPhotosBlock photos={props.photos} onAddAction={props.onAddPhotoAction} onRemoveAction={props.onRemovePhotoAction} />
            <DeliverOtpInput
              recipientFirstName={recipientFirstName}
              attemptsUsed={props.attemptsUsed}
              maxAttempts={props.maxAttempts}
              errorMessage={props.errorMessage}
              isLocked={props.isLocked}
              lockCountdown={props.lockCountdown}
              isSubmitting={props.isSubmitting || !props.photosReady}
              onSubmitAction={props.onSubmitAction}
            />

            <DeliverHelpCard
              shipper={deal.shipper}
              recipientFirstName={recipientFirstName}
            />

            <button
              type="button"
              onClick={() => console.info("[deliver] report issue")}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500 transition-colors hover:text-red-700 dark:text-slate-400 dark:hover:text-red-400"
            >
              <AlertTriangle size={13} aria-hidden="true" />
              {t("report", { recipientFirstName })}
            </button>
          </div>

          {/* Sidebar */}
          <aside className="hidden md:block">
            <div className="sticky top-[88px] space-y-4">
              {/* LE COLIS À REMETTRE */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("sidebar.parcelLabel")}
                </h3>
                <div className="text-[14px] font-semibold text-slate-900 dark:text-white">
                  {t("sidebar.parcelSummary", {
                    category: tBooking("categories." + deal.parcel.category),
                    weight: formatNumber(deal.parcel.weightKg, locale),
                  })}
                </div>
                <p className="mt-1 text-[12px] leading-snug text-slate-600 dark:text-slate-400">
                  {deal.parcel.description}
                </p>
                {deal.pickup && deal.pickup.photos.length > 0 && (
                  <>
                    <PhotoThumbs photos={deal.pickup.photos} tone="amber" size="md" className="mt-3" />
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {t("sidebar.parcelPhotosNote", {
                        location: deal.pickup.locationName,
                      })}
                    </p>
                  </>
                )}
              </section>

              {/* UNE FOIS VALIDÉ */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("sidebar.payoutLabel")}
                </h3>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-slate-700 dark:text-slate-300">
                    {t("sidebar.netLabel")}
                  </span>
                  <span className="text-[20px] font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatEur(deal.earnings.netForCarrier, locale)}
                  </span>
                </div>
                <div className="my-3 border-t border-slate-100 dark:border-slate-800" />
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-slate-600 dark:text-slate-400">
                    {t("sidebar.paidAtLabel")}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {t("sidebar.paidAtValue")}
                  </span>
                </div>
                <p className="mt-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                  {t("sidebar.payoutNote")}
                </p>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function formatEur(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value);
}
