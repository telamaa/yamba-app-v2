/**
 * RatingMobile.tsx
 * ================
 * Mobile : header sticky · banner flush · contenu compact · bottom-bar
 * fixe (Plus tard / Publier) — l'action doit rester à portée de pouce.
 */

"use client";

import { ArrowLeft, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RatingViewProps } from "./RatingClient";
import { RatingBanner, RatingPersonCard, RatingVisibilityNote } from "./RatingBlocks";
import RatingComment from "./RatingComment";
import RatingCriteria from "./RatingCriteria";
import RatingStars from "./RatingStars";

export default function RatingMobile(props: RatingViewProps) {
  const t = useTranslations("rating");
  const { context } = props;

  const firstName = context.person.firstName;
  const isCarrier = context.ratedRole === "CARRIER";

  const placeholder = isCarrier
    ? t("comment.placeholderCARRIER", { firstName })
    : t("comment.placeholderSHIPPER", { firstName });

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
            {t("title")}
          </div>
          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {t("subtitleShort")}
          </div>
        </div>
        <button
          type="button"
          onClick={props.onBackAction}
          aria-label={t("back")}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <X size={19} />
        </button>
      </div>

      <RatingBanner context={context} variant="flush" />

      <div className="flex-1 space-y-4 px-4 pb-32 pt-5">
        <header className="text-center">
          <h2 className="text-[19px] font-black tracking-tight text-slate-900 dark:text-white">
            {isCarrier
              ? t("h1.CARRIER", { firstName })
              : t("h1.SHIPPER", { firstName })}
          </h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {isCarrier ? t("h1Subtitle.CARRIER") : t("h1Subtitle.SHIPPER")}
          </p>
        </header>

        <RatingPersonCard context={context} compact />

        <RatingStars
          value={props.stars}
          onChangeAction={props.onStarsAction}
          compact
        />

        <RatingCriteria
          items={props.criteria}
          votes={props.votes}
          onVoteAction={props.onVoteAction}
          compact
        />

        <RatingComment
          value={props.comment}
          placeholder={placeholder}
          onChangeAction={props.onCommentAction}
          compact
        />

        <RatingVisibilityNote context={context} compact />
      </div>

      {/* Bottom-bar fixe */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={props.onBackAction}
            className="inline-flex min-h-[46px] items-center justify-center rounded-xl px-4 text-[12.5px] font-semibold text-slate-500 dark:text-slate-400"
          >
            {t("cta.later")}
          </button>
          <button
            type="button"
            onClick={props.onPublishAction}
            disabled={!props.canPublish || props.isSubmitting}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF9900] px-4 text-[14px] font-bold text-slate-950 transition-colors hover:bg-[#F08700] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
          >
            <Send size={14} aria-hidden="true" />
            {props.isSubmitting ? t("cta.publishing") : t("cta.publishShort")}
          </button>
        </div>
      </div>
    </div>
  );
}
