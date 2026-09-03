"use client";

import { useTranslations, useLocale } from "next-intl";
import { Send, Star, ThumbsUp, ThumbsDown, Flag } from "lucide-react";
import type {
  PublicShipperBlock,
  PublicRating,
  PublicReview,
  PublicReputation,
} from "@/lib/public-user.types";
import { formatRelativeDate, getInitials } from "@/lib/public-user.helpers";

type Props = {
  shipper: PublicShipperBlock;
  shipperRating: PublicRating;
  parcelsSentCount: number;
  /** B5 / D29① — faits de réputation Expéditeur, calculés serveur. */
  reputation?: PublicReputation | null;
  firstName: string;
};

export default function ShipperBlock({
                                       shipper,
                                       shipperRating,
                                       parcelsSentCount,
                                       reputation,
                                       firstName,
                                     }: Props) {
  const t = useTranslations("userProfile.shipperBlock");

  // Mode adaptive : si aucune activité, mode compact
  const hasActivity = parcelsSentCount > 0 || shipperRating.count > 0;

  if (!hasActivity) {
    return <CompactShipperBlock firstName={firstName} />;
  }

  // Mode complet : activité présente
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.04)] dark:border-slate-800 dark:bg-slate-950 dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3),0_2px_8px_-2px_rgba(0,0,0,0.2)]">
      <header className="mb-5 flex items-center gap-2">
        <Send size={18} className="text-[#0F766E]" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {t("title")}
        </h2>
      </header>

      {reputation && <ReputationFacts reputation={reputation} />}

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/40">
          <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("parcelsSent")}
          </p>
          <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
            {parcelsSentCount}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/40">
          <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("rating")}
          </p>
          <p className="inline-flex items-center gap-1 text-xl font-bold tabular-nums text-slate-900 dark:text-white">
            {shipperRating.count > 0 ? (
              <>
                <Star size={17} className="fill-[#0F766E] text-[#0F766E]" />
                {shipperRating.average.toFixed(1).replace(".", ",")}
              </>
            ) : (
              <span className="text-sm font-medium italic text-slate-400 dark:text-slate-500">
                —
              </span>
            )}
          </p>
        </div>
      </div>

      {shipper.reviewsPreview.length > 0 ? (
        <div>
          <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Star size={12} className="fill-[#0F766E] text-[#0F766E]" />
            {t("reviewsHeader", { count: shipper.reviewsCount })}
          </p>
          <div className="space-y-3">
            {shipper.reviewsPreview.map((review) => (
              <ShipperReviewCard key={review.id} review={review} />
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
          {t("noReviews", { firstName })}
        </p>
      )}
    </section>
  );
}

/* ============================================================ */
/*                   MODE COMPACT (0 activité)                  */
/* ============================================================ */

function CompactShipperBlock({ firstName }: { firstName: string }) {
  const t = useTranslations("userProfile.shipperBlock");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2.5">
        <Send size={15} className="shrink-0 text-[#0F766E]" />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {t("title")}
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">·</span>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("compactNoActivity", { firstName })}
        </p>
      </div>
    </section>
  );
}

function ShipperReviewCard({ review }: { review: PublicReview }) {
  const locale = useLocale() as "fr" | "en";
  const initials = getInitials(
    review.author.firstName,
    review.author.lastInitial
  );

  return (
    <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-900/40">
      <div className="mb-2 flex items-center gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-100 text-[10px] font-bold text-teal-900 dark:bg-teal-500/20 dark:text-teal-300">
          {initials}
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-900 dark:text-white">
            {review.author.firstName} {review.author.lastInitial}.
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {formatRelativeDate(review.createdAt, locale)}
          </p>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={11}
              className={
                i < Math.round(review.rating)
                  ? "fill-[#0F766E] text-[#0F766E]"
                  : "text-slate-300 dark:text-slate-700"
              }
            />
          ))}
        </div>
      </div>
      {review.comment && (
        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          {review.comment}
        </p>
      )}
      <ReviewCriteriaChips criteria={review.criteria} />
      <ReportReviewLink reviewId={review.id} />
    </div>
  );
}

/* B5 — critères (pouces) publics + « Signaler cet avis » (décision 6A : mailto support). */
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@yamba.app";

function ReviewCriteriaChips({ criteria }: { criteria: PublicReview["criteria"] }) {
  const t = useTranslations("userProfile.reviews");
  if (!criteria) return null;
  const entries = Object.entries(criteria);
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            value === "UP"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          }`}
        >
          {value === "UP" ? <ThumbsUp size={10} aria-hidden="true" /> : <ThumbsDown size={10} aria-hidden="true" />}
          {t(`criteria.${key}` as never)}
        </span>
      ))}
    </div>
  );
}

function ReportReviewLink({ reviewId }: { reviewId: string }) {
  const t = useTranslations("userProfile.reviews");
  const subject = encodeURIComponent(t("reportSubject", { id: reviewId }));
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}
      className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
    >
      <Flag size={10} aria-hidden="true" />
      {t("report")}
    </a>
  );
}

function ReputationFacts({ reputation }: { reputation: PublicReputation }) {
  const t = useTranslations("userProfile.reputation");
  const nextKey = reputation.level === "NEW" ? "nextConfirmed" : reputation.level === "CONFIRMED" ? "nextTop" : null;
  return (
    <div className="mb-5 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
      <p className="text-[12.5px] text-slate-700 dark:text-slate-300">
        {t("facts", {
          deals: reputation.completedDealsCount,
          avg: reputation.ratingsCount > 0 ? reputation.ratingsAvg.toFixed(1).replace(".", ",") : "—",
          count: reputation.ratingsCount,
          late: reputation.lateCancellationsCount,
        })}
      </p>
      {nextKey && (
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t(`shipper.${nextKey}`)}</p>
      )}
    </div>
  );
}
