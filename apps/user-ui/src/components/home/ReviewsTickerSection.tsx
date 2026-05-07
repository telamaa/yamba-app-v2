"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import ReviewsTickerSectionSkeleton from "@/components/home/skeleton/ReviewsTickerSectionSkeleton";

const SKELETON_DURATION = 300;

type ReviewId = "r1" | "r2" | "r3" | "r4" | "r5";

type Review = {
  id: ReviewId;
  initials: string;
  avatarGradient: string;
};

const REVIEWS: Review[] = [
  { id: "r1", initials: "AL", avatarGradient: "from-pink-400 to-orange-400" },
  { id: "r2", initials: "TF", avatarGradient: "from-blue-400 to-purple-400" },
  { id: "r3", initials: "MS", avatarGradient: "from-emerald-400 to-teal-400" },
  { id: "r4", initials: "DK", avatarGradient: "from-amber-400 to-red-400" },
  { id: "r5", initials: "SE", avatarGradient: "from-indigo-400 to-blue-400" },
];

// Duplication des avis pour boucle infinie sans saut visuel
const REVIEWS_DOUBLED: Review[] = [...REVIEWS, ...REVIEWS];

function ReviewCard({
                      review,
                      t,
                    }: {
  review: Review;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="w-[320px] shrink-0 rounded-2xl border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-2 flex items-center gap-1 text-xs text-amber-400">
        ★★★★★
      </div>
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        &ldquo;{t(`items.${review.id}.quote`)}&rdquo;
      </p>
      <div className="mt-3 flex items-center gap-2">
        <div
          className={`grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-white ${review.avatarGradient}`}
        >
          {review.initials}
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-900 dark:text-white">
            {t(`items.${review.id}.name`)}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {t(`items.${review.id}.role`)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ReviewsTickerSection() {
  const t = useTranslations("home.reviews");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), SKELETON_DURATION);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) return <ReviewsTickerSectionSkeleton />;

  return (
    <section className="bg-slate-50 py-12 dark:bg-slate-900 md:py-16">
      <div className="mx-auto max-w-7xl px-4">
        {/* Header compact */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2">
            <span className="text-base text-amber-400">★★★★★</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {t("ratingValue")}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              — {t("ratingCount")}
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">
            {t("title")}{" "}
            <span className="yamba-grad-text">{t("titleHighlight")}</span>
            {t("titleEnd")}
          </h2>
        </div>

        {/* Ticker container */}
        <div className="yamba-reviews-container relative overflow-hidden">
          {/* Fade gauche */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-16"
            style={{
              background:
                "linear-gradient(to right, var(--reviews-fade-color, #f8fafc), transparent)",
            }}
          />
          {/* Fade droite */}
          <div
            className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-16"
            style={{
              background:
                "linear-gradient(to left, var(--reviews-fade-color, #f8fafc), transparent)",
            }}
          />

          <div className="yamba-reviews-track flex gap-4">
            {REVIEWS_DOUBLED.map((review, idx) => (
              <ReviewCard key={`${review.id}-${idx}`} review={review} t={t} />
            ))}
          </div>
        </div>
      </div>

      {/* CSS variable for fade color (light/dark adaptive) */}
      <style jsx>{`
        section {
          --reviews-fade-color: #f8fafc;
        }
        :global(.dark) section {
          --reviews-fade-color: #0f172a;
        }
      `}</style>
    </section>
  );
}
