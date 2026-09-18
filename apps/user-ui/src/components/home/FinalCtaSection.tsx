"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Package, Plane } from "lucide-react";

const SKELETON_DURATION = 300;

function FinalCtaSkeleton() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-tr from-[#FFF6EA] via-white to-[#ECFAF7] py-16 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 md:py-24">
      <div className="mx-auto max-w-5xl px-4">
        {/* Title skeleton */}
        <div className="mx-auto mb-10 max-w-xl space-y-3 text-center">
          <div className="mx-auto h-10 w-3/4 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10 md:h-14" />
          <div className="mx-auto h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
        </div>

        {/* 2 cards skeleton */}
        <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
          <div className="h-[200px] animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
          <div className="h-[200px] animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
        </div>
      </div>
    </section>
  );
}

export default function FinalCtaSection() {
  const t = useTranslations("home.finalCta");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), SKELETON_DURATION);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) return <FinalCtaSkeleton />;

  return (
    <section className="relative overflow-hidden bg-gradient-to-tr from-[#FFF6EA] via-white to-[#ECFAF7] py-16 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 md:py-24">
      <div className="mx-auto max-w-5xl px-4">
        {/* Title */}
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold leading-[1.05] tracking-tight text-slate-900 dark:text-white md:text-5xl">
            {t("titleStart")}{" "}
            <span className="yamba-grad-text">{t("titleHighlight")}</span>
            {t("titleEnd")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 dark:text-slate-300">
            {t("subtitle")}
          </p>
        </div>

        {/* 2 cards Shipper + Yamber */}
        <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
          {/* Shipper */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/[0.08]">
            <div className="mb-4 flex items-center gap-3">
              {/* Icône filaire lucide, comme partout ailleurs — pas d'emoji-image */}
              <div className="yamba-grad-bg grid h-10 w-10 place-items-center rounded-xl text-slate-950">
                <Package size={20} strokeWidth={2} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#FF9900]">
                  {t("shipper.tag")}
                </p>
                <p className="text-base font-bold text-slate-900 dark:text-white">{t("shipper.title")}</p>
              </div>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t("shipper.description")}
            </p>
            <Link
              href="/search"
              className="yamba-grad-bg mt-auto pt-0 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-slate-950 transition-transform hover:scale-[1.02]"
            >
              {t("shipper.cta")}
              <span>→</span>
            </Link>
          </div>

          {/* Yamber */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/[0.08]">
            <div className="mb-4 flex items-center gap-3">
              <div className="yamba-grad-bg grid h-10 w-10 place-items-center rounded-xl text-slate-950">
                <Plane size={20} strokeWidth={2} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#FF9900]">
                  {t("yamber.tag")}
                </p>
                <p className="text-base font-bold text-slate-900 dark:text-white">{t("yamber.title")}</p>
              </div>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t("yamber.description")}
            </p>
            <Link
              href="/carrier/onboarding"
              className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            >
              {t("yamber.cta")}
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
