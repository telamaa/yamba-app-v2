/**
 * DealDeliverMobile.tsx
 * =====================
 * Mobile : header sticky · banner flush · info box · Marie · OTP (CTA intégré,
 * pas de bottom-bar : le bouton Valider vit dans la card OTP) · aide · signaler.
 */

"use client";

import { AlertTriangle, ArrowLeft, HelpCircle, PlaneLanding } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DealDeliverViewProps } from "./DealDeliverClient";
import DeliverHelpCard from "./DeliverHelpCard";
import { DeliverInfoBox, DeliverRecipientRow } from "./DeliverInfoBox";
import DeliverOtpInput from "./DeliverOtpInput";

export default function DealDeliverMobile(props: DealDeliverViewProps) {
  const t = useTranslations("carrierDealDeliver");
  const { deal } = props;

  const recipientFirstName = deal.recipient?.firstName ?? "";
  const shipperFirstName = deal.shipper.firstName;
  const city = deal.recipient?.city ?? deal.trip.destinationCity;

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 flex h-14 items-center gap-1 border-b border-slate-200 bg-white px-2 dark:border-slate-800 dark:bg-slate-950">
        <button
          type="button"
          onClick={props.onBackAction}
          aria-label={t("back")}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">
            {t("title", { recipientFirstName })}
          </div>
          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {t("subtitleShort", { city })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => console.info("[deliver] open help")}
          aria-label={t("help")}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <HelpCircle size={19} />
        </button>
      </div>

      {/* Banner flush */}
      <div className="flex items-center gap-3 border-y border-teal-300 bg-teal-50 px-4 py-3 dark:border-teal-900/50 dark:bg-teal-950/30">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-teal-700 text-white dark:bg-teal-600">
          <PlaneLanding size={14} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-teal-950 dark:text-teal-100">
            {t("banner.titleNoEvent")}
          </div>
          <div className="text-[11px] text-teal-800 dark:text-teal-300">
            {t("banner.subtitleNoEvent", { recipientFirstName })}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 px-4 pb-10 pt-4">
        <header>
          <h2 className="text-[19px] font-black tracking-tight text-slate-900 dark:text-white">
            {t("h1")}
          </h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {t("h1SubtitleShort", { recipientFirstName })}
          </p>
        </header>

        <DeliverInfoBox
          shipperFirstName={shipperFirstName}
          recipientFirstName={recipientFirstName}
          compact
        />

        {deal.recipient && (
          <DeliverRecipientRow recipient={deal.recipient} compact />
        )}

        <DeliverOtpInput
          recipientFirstName={recipientFirstName}
          attemptsUsed={props.attemptsUsed}
          maxAttempts={props.maxAttempts}
          errorMessage={props.errorMessage}
          isLocked={props.isLocked}
          lockCountdown={props.lockCountdown}
          isSubmitting={props.isSubmitting}
          onSubmitAction={props.onSubmitAction}
          compact
        />

        <DeliverHelpCard
          shipper={deal.shipper}
          recipientFirstName={recipientFirstName}
          compact
        />

        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={() => console.info("[deliver] report issue")}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500 hover:text-red-700 dark:text-slate-400"
          >
            <AlertTriangle size={13} aria-hidden="true" />
            {t("reportShort")}
          </button>
        </div>
      </div>
    </div>
  );
}
