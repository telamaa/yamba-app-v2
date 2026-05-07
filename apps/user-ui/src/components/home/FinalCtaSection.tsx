"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const SKELETON_DURATION = 300;

const TRUST_SIGNALS = ["stripe", "insurance", "speed", "ecology"] as const;

function FinalCtaSkeleton() {
  return (
    <section className="yamba-hero-mesh relative overflow-hidden py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4">
        {/* Trust signals skeleton */}
        <div className="mb-10 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-4 w-32 animate-pulse rounded bg-white/10" />
          ))}
        </div>

        {/* Title skeleton */}
        <div className="mx-auto mb-10 max-w-xl space-y-3 text-center">
          <div className="mx-auto h-10 w-3/4 animate-pulse rounded-lg bg-white/10 md:h-14" />
          <div className="mx-auto h-4 w-2/3 animate-pulse rounded bg-white/10" />
        </div>

        {/* 2 cards skeleton */}
        <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
          <div className="h-[200px] animate-pulse rounded-2xl bg-white/5" />
          <div className="h-[200px] animate-pulse rounded-2xl bg-white/5" />
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
    <section className="yamba-hero-mesh relative overflow-hidden py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4">
        {/* Trust signals au-dessus */}
        <div className="mb-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-slate-400">
          {TRUST_SIGNALS.map((signal) => (
            <div key={signal} className="flex items-center gap-1.5">
              {t(`trustSignals.${signal}`)}
            </div>
          ))}
        </div>

        {/* Title */}
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold leading-[1.05] tracking-tight text-white md:text-5xl">
            {t("titleStart")}{" "}
            <span className="yamba-grad-text">{t("titleHighlight")}</span>
            {t("titleEnd")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">
            {t("subtitle")}
          </p>
        </div>

        {/* 2 cards Shipper + Yamber */}
        <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
          {/* Shipper */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.08]">
            <div className="mb-4 flex items-center gap-3">
              <div className="yamba-grad-bg grid h-10 w-10 place-items-center rounded-xl text-lg">
                📦
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#FF9900]">
                  {t("shipper.tag")}
                </p>
                <p className="text-base font-bold text-white">{t("shipper.title")}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              {t("shipper.description")}
            </p>
            <Link
              href="/search"
              className="yamba-grad-bg mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-slate-950 transition-transform hover:scale-[1.02]"
            >
              {t("shipper.cta")}
              <span>→</span>
            </Link>
          </div>

          {/* Yamber */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.08]">
            <div className="mb-4 flex items-center gap-3">
              <div className="yamba-grad-bg grid h-10 w-10 place-items-center rounded-xl text-lg">
                ✈️
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#FF9900]">
                  {t("yamber.tag")}
                </p>
                <p className="text-base font-bold text-white">{t("yamber.title")}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              {t("yamber.description")}
            </p>
            <Link
              href="/become/carrier"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/15"
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
