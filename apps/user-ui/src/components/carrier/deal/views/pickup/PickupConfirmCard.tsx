/**
 * PickupConfirmCard.tsx
 * =====================
 * Card sidebar "CONFIRMATION" (desktop) : indicateur de progression
 * (vérification X/5 · photos min 1) + info code + boutons Refuser/Confirmer.
 * Le disabled devient pédagogique : on voit ce qui manque.
 */

"use client";

import { Check, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  shipperFirstName: string;
  recipientFirstName: string;
  checkedCount: number;
  totalChecks: number;
  photoCount: number;
  canConfirm: boolean;
  isSubmitting?: boolean;
  onRefuseAction: () => void;
  onConfirmAction: () => void;
};

export default function PickupConfirmCard({
                                            shipperFirstName,
                                            recipientFirstName,
                                            checkedCount,
                                            totalChecks,
                                            photoCount,
                                            canConfirm,
                                            isSubmitting = false,
                                            onRefuseAction,
                                            onConfirmAction,
                                          }: Props) {
  const t = useTranslations("carrierDealPickup");

  const checklistDone = checkedCount === totalChecks;
  const photosDone = photoCount >= 1;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("confirmCard.label")}
      </h3>

      {/* Progression */}
      <div className="space-y-2">
        <ProgressRow
          done={checklistDone}
          label={t("confirmCard.checklistLabel")}
          value={`${checkedCount}/${totalChecks}`}
        />
        <ProgressRow
          done={photosDone}
          label={t("confirmCard.photosLabel")}
          value={
            photosDone
              ? String(photoCount)
              : t("confirmCard.photosMin", { count: photoCount })
          }
        />
      </div>

      {/* Info code */}
      <div className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-4 text-[12px] leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-400">
        <Info
          size={14}
          className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <span>{t("final.info", { shipperFirstName, recipientFirstName })}</span>
      </div>

      {/* Boutons */}
      <div className="mt-4 space-y-2.5">
        <button
          type="button"
          onClick={onConfirmAction}
          disabled={!canConfirm || isSubmitting}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#FF9900] px-4 text-[14px] font-bold text-slate-950 transition-colors hover:bg-[#F08700] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
        >
          <Check size={15} strokeWidth={3} aria-hidden="true" />
          {isSubmitting ? t("final.submitting") : t("final.confirm")}
        </button>
        <button
          type="button"
          onClick={onRefuseAction}
          disabled={isSubmitting}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <X size={13} aria-hidden="true" />
          {t("final.refuse")}
        </button>
      </div>
    </section>
  );
}

function ProgressRow({
                       done,
                       label,
                       value,
                     }: {
  done: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-4.5 w-4.5 h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full transition-colors ${
            done
              ? "bg-emerald-700 text-white dark:bg-emerald-600"
              : "border-[1.5px] border-slate-300 dark:border-slate-600"
          }`}
          aria-hidden="true"
        >
          {done && <Check size={11} strokeWidth={3} />}
        </span>
        <span
          className={
            done
              ? "text-slate-900 dark:text-white"
              : "text-slate-600 dark:text-slate-400"
          }
        >
          {label}
        </span>
      </div>
      <span
        className={`font-semibold tabular-nums ${
          done
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
