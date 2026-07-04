/**
 * ReportSuccess.tsx
 * =================
 * Atterrissage post-envoi : "Signalement envoyé" + N° de dossier YAM-XXXX
 * + rappels (paiement gelé, accusé email) + retour au suivi.
 * Ton rassurant — c'est le moment où Aminata a le plus besoin de calme.
 */

"use client";

import { Check, Mail, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  ticketNumber: string;
  carrierFirstName: string;
  onBackToTrackingAction: () => void;
};

export default function ReportSuccess({
                                        ticketNumber,
                                        carrierFirstName,
                                        onBackToTrackingAction,
                                      }: Props) {
  const t = useTranslations("bookingTracker");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-700 text-white shadow-lg dark:bg-blue-600">
          <Check size={38} strokeWidth={3} aria-hidden="true" />
        </div>

        <h1 className="mt-6 text-[26px] font-black tracking-tight text-slate-900 dark:text-white sm:text-[30px]">
          {t("report.success.title")}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
          {t("report.success.subtitle")}
        </p>

        {/* Numéro de dossier */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("report.success.ticketLabel")}
          </div>
          <div className="mt-1 text-[28px] font-black tabular-nums tracking-wide text-slate-900 dark:text-white">
            {ticketNumber}
          </div>
        </div>

        {/* Rappels */}
        <div className="mt-4 space-y-2.5 text-left">
          <div className="flex items-start gap-2.5 rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-900">
            <ShieldCheck
              size={15}
              className="mt-0.5 flex-shrink-0 text-slate-600 dark:text-slate-400"
              aria-hidden="true"
            />
            <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400">
              {t("report.success.frozenNote", { carrierFirstName })}
            </p>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-900">
            <Mail
              size={15}
              className="mt-0.5 flex-shrink-0 text-slate-600 dark:text-slate-400"
              aria-hidden="true"
            />
            <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400">
              {t("report.success.emailNote")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToTrackingAction}
          className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#FF9900] px-4 text-[14px] font-bold text-slate-950 transition-colors hover:bg-[#F08700]"
        >
          {t("report.success.backToTracking")}
        </button>
      </div>
    </div>
  );
}
