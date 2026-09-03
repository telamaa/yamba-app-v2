/**
 * RatingStatusCard.tsx — « Noter {prénom} » / « note envoyée » / révélé (B5-PR2, décision 1A)
 * ============================================================================================
 * Posée sur l'écran « terminé » des deux rôles. Trois états, servis par l'API
 * (`rating` du deal) : à noter → bouton ; notée, pas encore révélée → « révélée
 * quand {prénom} aura noté, ou le {date} » ; révélée → les deux notes côte à
 * côte (chargées à la demande). Jamais de fenêtre bloquante (3A).
 */
"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { getRatingContext } from "./rating.api";
import type { RatingContext } from "./rating.types";

export type RatingState = {
  windowEndsAt: string | null;
  ratedByMe: boolean;
  counterpartHasRated: boolean;
  revealedAt: string | null;
  canRate: boolean;
};

type Props = {
  dealId: string;
  rating: RatingState | null | undefined;
  counterpartFirstName: string;
  rateHref: string;
  compact?: boolean;
};

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={13} className={i < value ? "fill-[#FF9900] text-[#FF9900]" : "text-slate-300 dark:text-slate-700"} aria-hidden="true" />
      ))}
    </span>
  );
}

export default function RatingStatusCard({ dealId, rating, counterpartFirstName, rateHref, compact = false }: Props) {
  const t = useTranslations("rating.status");
  const format = useFormatter();
  const router = useRouter();
  const [ctx, setCtx] = useState<RatingContext | null>(null);
  const revealed = !!rating?.revealedAt;

  useEffect(() => {
    if (!revealed && !rating?.ratedByMe) return;
    let cancelled = false;
    getRatingContext(dealId).then((c) => { if (!cancelled) setCtx(c); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [dealId, revealed, rating?.ratedByMe]);

  if (!rating) return null;
  const pad = compact ? "p-4" : "p-5";
  const windowEnd = rating.windowEndsAt ? format.dateTime(new Date(rating.windowEndsAt), { day: "numeric", month: "long" }) : "";

  if (rating.canRate) {
    return (
      <section className={`rounded-2xl border border-amber-200 bg-amber-50 text-center dark:border-amber-900/40 dark:bg-amber-950/25 ${pad}`}>
        <h3 className="text-[14px] font-bold text-amber-950 dark:text-amber-100">{t("promptTitle", { name: counterpartFirstName })}</h3>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-snug text-amber-900/85 dark:text-amber-200/85">{t("promptText", { date: windowEnd })}</p>
        <button
          type="button"
          onClick={() => router.push(rateHref)}
          className="mt-3 inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#FF9900] px-5 text-[13px] font-bold text-slate-950 transition-colors hover:bg-[#F08700]"
        >
          <Star size={14} aria-hidden="true" />
          {t("promptCta", { name: counterpartFirstName })}
        </button>
      </section>
    );
  }

  if (revealed) {
    return (
      <section className={`rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${pad}`}>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("revealedTitle")}</h3>
        <div className="mt-2 space-y-2">
          {ctx?.myRating ? (
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-slate-600 dark:text-slate-400">{t("mine", { name: counterpartFirstName })}</span>
              <Stars value={ctx.myRating.rating} />
            </div>
          ) : (
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">{t("mineMissing")}</p>
          )}
          {ctx?.counterpartRating ? (
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-slate-600 dark:text-slate-400">{t("theirs", { name: counterpartFirstName })}</span>
              <Stars value={ctx.counterpartRating.rating} />
            </div>
          ) : (
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">{t("theirsMissing", { name: counterpartFirstName })}</p>
          )}
          {ctx?.counterpartRating?.comment && (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-[12.5px] leading-relaxed text-slate-700 dark:bg-slate-900 dark:text-slate-300">
              « {ctx.counterpartRating.comment} »
            </p>
          )}
        </div>
      </section>
    );
  }

  if (rating.ratedByMe) {
    return (
      <section className={`rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 ${pad}`}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[13.5px] font-bold text-slate-900 dark:text-white">{t("sentTitle")}</h3>
          {ctx?.myRating && <Stars value={ctx.myRating.rating} />}
        </div>
        <p className="mt-1 text-[12.5px] leading-snug text-slate-600 dark:text-slate-400">
          {rating.counterpartHasRated ? t("sentTextBoth") : t("sentText", { name: counterpartFirstName, date: windowEnd })}
        </p>
      </section>
    );
  }

  // Fenêtre close sans note de ma part : on ne relance plus.
  return (
    <p className="text-[12px] text-slate-500 dark:text-slate-400">{t("closed", { name: counterpartFirstName })}</p>
  );
}
