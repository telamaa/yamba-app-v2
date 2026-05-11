"use client";

import { useTranslations, useLocale } from "next-intl";
import { Package, Plane, Train, Car, Star, ArrowRight, Heart } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type {
  PublicTripperBlock,
  PublicTripPreview,
  PublicReview,
  PublicTopRoute,
  PublicRating,
} from "@/lib/public-user.types";
import {
  formatPriceShort,
  formatShortTripDate,
  formatRelativeDate,
  getInitials,
  getTripDetailHref,
} from "@/lib/public-user.helpers";

type Props = {
  tripper: PublicTripperBlock;
  tripperRating: PublicRating | null;
  firstName: string;
  userSlug: string;
};

export default function TripperBlock({
                                       tripper,
                                       tripperRating,
                                       firstName,
                                       userSlug,
                                     }: Props) {
  const t = useTranslations("userProfile.tripperBlock");

  const ratingLabel =
    tripperRating && tripperRating.count > 0
      ? tripperRating.average.toFixed(1).replace(".", ",")
      : "—";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.04)] dark:border-slate-800 dark:bg-slate-950 dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3),0_2px_8px_-2px_rgba(0,0,0,0.2)]">
      {/* Header */}
      <header className="mb-5 flex items-center gap-2">
        <Package size={18} className="text-[#FF9900]" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {t("title")}
        </h2>
      </header>

      {/* Routes fréquentes */}
      {tripper.topRoutes.length > 0 && (
        <div className="mb-6">
          <p className="mb-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("frequentRoutes")}
          </p>
          <div className="flex flex-wrap gap-2">
            {tripper.topRoutes.map((route) => (
              <RoutePill
                key={`${route.originCity}-${route.destinationCity}`}
                route={route}
              />
            ))}
          </div>
        </div>
      )}

      {/* Trajets disponibles */}
      <div className="mb-6">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("availableTrips", { count: tripper.availableTripsCount })}
          </p>
          {tripper.availableTripsCount > tripper.availableTripsPreview.length && (
            <button
              type="button"
              className="text-xs font-semibold text-[#FF9900] transition-colors hover:text-[#F08700]"
            >
              {t("viewAllTrips")}
            </button>
          )}
        </div>

        {tripper.availableTripsPreview.length > 0 ? (
          <div className="space-y-2">
            {tripper.availableTripsPreview.map((trip) => (
              <TripPreviewCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : (
          <EmptyState
            message={t("noAvailableTrips", { firstName })}
            ctaIcon={<Heart size={13} />}
            ctaLabel={t("noAvailableTripsCta")}
            onCtaClick={() => {
              // scroll to follow button (sidebar)
              document
                .querySelector("[data-follow-cta]")
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
        )}
      </div>

      {/* Avis */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Star size={12} className="fill-[#FF9900] text-[#FF9900]" />
            {t("reviewsHeader", {
              count: tripper.reviewsCount,
              average: ratingLabel,
            })}
          </p>
          {tripper.reviewsCount > tripper.reviewsPreview.length && (
            <button
              type="button"
              className="text-xs font-semibold text-[#FF9900] transition-colors hover:text-[#F08700]"
            >
              {t("viewAllReviews")}
            </button>
          )}
        </div>

        {tripper.reviewsPreview.length > 0 ? (
          <div className="space-y-3">
            {tripper.reviewsPreview.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
            {t("noReviews", { firstName })}
          </p>
        )}
      </div>
    </section>
  );
}

/* ============================================================ */
/*                        SOUS-COMPOSANTS                       */
/* ============================================================ */

function EmptyState({
                      message,
                      ctaIcon,
                      ctaLabel,
                      onCtaClick,
                    }: {
  message: string;
  ctaIcon?: React.ReactNode;
  ctaLabel?: string;
  onCtaClick?: () => void;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/40">
      <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>
      {ctaLabel && onCtaClick && (
        <button
          type="button"
          onClick={onCtaClick}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF9900] transition-colors hover:text-[#F08700]"
        >
          {ctaIcon}
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

function RoutePill({ route }: { route: PublicTopRoute }) {
  const t = useTranslations("userProfile.tripperBlock");

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {route.originCity}
      <ArrowRight size={11} className="text-[#FF9900]" />
      {route.destinationCity}
      <span className="text-slate-500 dark:text-slate-400">
        · {t("routeCount", { count: route.count })}
      </span>
    </span>
  );
}

function TripPreviewCard({ trip }: { trip: PublicTripPreview }) {
  const locale = useLocale() as "fr" | "en";
  const TransportIcon = getTransportIcon(trip.transportMode);

  return (
    <Link
      href={getTripDetailHref(trip.id)}
      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-900 transition-colors hover:border-[#FF9900] dark:border-slate-800 dark:text-white dark:hover:border-[#FF9900]"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <TransportIcon size={16} className="shrink-0 text-[#FF9900]" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {trip.originCity} → {trip.destinationCity}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {trip.departureAt && formatShortTripDate(trip.departureAt, locale)}
          </p>
        </div>
      </div>
      <p className="shrink-0 text-sm font-bold tabular-nums">
        {trip.minPriceCents != null
          ? formatPriceShort(trip.minPriceCents, trip.currencyCode, locale)
          : "—"}
      </p>
    </Link>
  );
}

function ReviewCard({ review }: { review: PublicReview }) {
  const locale = useLocale() as "fr" | "en";
  const initials = getInitials(
    review.author.firstName,
    review.author.lastInitial
  );

  return (
    <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-900/40">
      <div className="mb-2 flex items-center gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-900 dark:bg-blue-500/20 dark:text-blue-300">
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
                  ? "fill-[#FF9900] text-[#FF9900]"
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
    </div>
  );
}

function getTransportIcon(mode: string | null) {
  if (mode === "TRAIN") return Train;
  if (mode === "CAR") return Car;
  return Plane;
}
