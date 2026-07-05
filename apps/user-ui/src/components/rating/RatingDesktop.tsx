/**
 * RatingDesktop.tsx
 * =================
 * Desktop — pattern sidebar-décision (cohérent wizard booking / pickup V3) :
 *  Main : titre + étoiles (hero) + critères + commentaire
 *  Sidebar sticky : card personne (avec deal + montant) + card PUBLICATION
 *  (visibilité + Publier + Plus tard). Plus de banner : son info vit en sidebar.
 */

"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RatingViewProps } from "./RatingClient";
import { RatingPersonDealCard, RatingPublishCard } from "./RatingBlocks";
import RatingComment from "./RatingComment";
import RatingCriteria from "./RatingCriteria";
import RatingStars from "./RatingStars";

export default function RatingDesktop(props: RatingViewProps) {
  const t = useTranslations("rating");
  const { context } = props;

  const firstName = context.person.firstName;
  const isCarrier = context.ratedRole === "CARRIER";

  const placeholder = isCarrier
    ? t("comment.placeholderCARRIER", { firstName })
    : t("comment.placeholderSHIPPER", { firstName });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-4 sm:px-6 sm:pt-6">
        <button
          type="button"
          onClick={props.onBackAction}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft size={14} />
          {t("back")}
        </button>

        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {isCarrier
            ? t("h1.CARRIER", { firstName })
            : t("h1.SHIPPER", { firstName })}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isCarrier ? t("h1Subtitle.CARRIER") : t("h1Subtitle.SHIPPER")}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main — l'évaluation */}
          <div className="space-y-4">
            <RatingStars
              value={props.stars}
              onChangeAction={props.onStarsAction}
              layout="hero"
            />

            <RatingCriteria
              items={props.criteria}
              votes={props.votes}
              onVoteAction={props.onVoteAction}
            />

            <RatingComment
              value={props.comment}
              placeholder={placeholder}
              onChangeAction={props.onCommentAction}
            />
          </div>

          {/* Sidebar sticky — référence + décision */}
          <aside className="hidden lg:block">
            <div className="sticky top-[88px] space-y-4">
              <RatingPersonDealCard context={context} />

              <RatingPublishCard
                context={context}
                canPublish={props.canPublish}
                isSubmitting={props.isSubmitting}
                onPublishAction={props.onPublishAction}
                onLaterAction={props.onBackAction}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
