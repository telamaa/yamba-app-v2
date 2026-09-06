/**
 * RatingDone.tsx — « note envoyée » / « fenêtre close » / révélé (B5-PR2, décision 1A)
 * ====================================================================================
 * Quand `canRate` est faux, l'écran dit l'état au lieu de proposer un formulaire :
 *  - ma note existe, l'autre n'a pas noté : « révélée quand {prénom} aura noté, ou le {date} »
 *  - révélé : les deux notes côte à côte
 *  - fenêtre close sans note : « la période de notation est terminée »
 */
"use client";

import { Lock, Star } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { MyRating, RatingContext } from "./rating.types";

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={14} className={i < value ? "fill-[#FF9900] text-[#FF9900]" : "text-slate-300 dark:text-slate-700"} aria-hidden="true" />
      ))}
    </span>
  );
}

function RatingLine({ label, rating }: { label: string; rating: MyRating }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-left dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <Stars value={rating.rating} />
      </div>
      {rating.comment && <p className="mt-2 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">{rating.comment}</p>}
    </div>
  );
}

export function RatingDone({ context, onBackAction }: { context: RatingContext; onBackAction: () => void }) {
  const t = useTranslations("rating.done");
  const format = useFormatter();
  const name = context.person.firstName;
  const windowEnd = context.windowEndsAt ? format.dateTime(new Date(context.windowEndsAt), { day: "numeric", month: "long" }) : "";
  const revealed = !!context.revealedAt;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg">
          {revealed ? <Star size={30} fill="currentColor" aria-hidden="true" /> : <Lock size={26} aria-hidden="true" />}
        </div>
        <h1 className="mt-5 text-[24px] font-black tracking-tight text-slate-900 dark:text-white">
          {revealed ? t("revealedTitle") : context.myRating ? t("sentTitle") : t("closedTitle")}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
          {revealed
            ? t("revealedText", { name })
            : context.myRating
              ? t("sentText", { name, date: windowEnd })
              : t("closedText", { name })}
        </p>
        <div className="mt-6 space-y-2.5">
          {context.myRating && <RatingLine label={t("mine", { name })} rating={context.myRating} />}
          {revealed && context.counterpartRating && <RatingLine label={t("theirs", { name })} rating={context.counterpartRating} />}
          {revealed && !context.counterpartRating && (
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">{t("theirsMissing", { name })}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onBackAction}
          className="mt-6 inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#FF9900] px-4 text-[14px] font-bold text-slate-950 hover:bg-[#F08700]"
        >
          {t("back")}
        </button>
      </div>
    </div>
  );
}

export function RatingUnavailable({ onBackAction }: { onBackAction: () => void }) {
  const t = useTranslations("rating.done");
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="max-w-sm text-center">
        <p className="text-[14px] text-slate-600 dark:text-slate-400">{t("unavailable")}</p>
        <button type="button" onClick={onBackAction} className="mt-4 inline-flex items-center justify-center rounded-full bg-[#FF9900] px-5 py-2 text-[13px] font-bold text-slate-950 hover:bg-[#F08700]">
          {t("back")}
        </button>
      </div>
    </div>
  );
}
