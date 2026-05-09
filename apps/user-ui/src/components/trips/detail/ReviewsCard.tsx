"use client";

import { useTranslations, useLocale } from "next-intl";
import { Star, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { PublicTripper } from "@/lib/public-trip.types";

type Props = {
  tripper: PublicTripper;
};

export default function ReviewsCard({ tripper }: Props) {
  const t = useTranslations("tripDetail");
  const locale = useLocale() as "fr" | "en";

  if (!tripper.carrier || tripper.carrier.ratingsCount === 0) {
    return null;
  }

  const ratingFormatted = tripper.carrier.ratingsAvg
    .toFixed(1)
    .replace(".", locale === "fr" ? "," : ".");

  return (
    <section>
      <header className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          {t("reviews.title", { firstName: tripper.firstName })}
        </h2>
        <span className="inline-flex items-center gap-1 text-xs">
          <Star size={12} className="fill-[#FFB84D] text-[#FFB84D]" strokeWidth={0} />
          <span className="font-bold text-slate-900 dark:text-white">{ratingFormatted}</span>
          <span className="text-slate-500 dark:text-slate-400">({tripper.carrier.ratingsCount})</span>
        </span>
      </header>

      <div className="px-5 pb-3">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {t("reviews.empty", {
            firstName: tripper.firstName,
            count: tripper.carrier.ratingsCount,
          })}
        </p>
      </div>

      <div className="px-5 pb-4">
        <Link
          href={`/tripper/${tripper.id}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#B45309] transition-colors hover:text-[#FF9900] dark:text-[#FFB84D]"
        >
          {t("reviews.viewAll", { count: tripper.carrier.ratingsCount })}
          <ChevronRight size={14} />
        </Link>
      </div>
    </section>
  );
}
