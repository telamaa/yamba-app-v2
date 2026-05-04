"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const SKELETON_DURATION = 300;

type TimelineStep = {
  id: "day0" | "day1" | "day23" | "day4";
  emoji: string;
  isLast?: boolean;
};

const TIMELINE_STEPS: TimelineStep[] = [
  { id: "day0", emoji: "📦" },
  { id: "day1", emoji: "✅" },
  { id: "day23", emoji: "🔍" },
  { id: "day4", emoji: "💸", isLast: true },
];

function PricingSkeleton() {
  return (
    <section className="bg-white py-14 dark:bg-slate-950 md:py-20">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mx-auto mb-10 max-w-xl space-y-3 text-center">
          <div className="mx-auto h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mx-auto h-9 w-1/2 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="mx-auto h-4 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        </div>
      </div>
    </section>
  );
}

export default function PricingSection() {
  const t = useTranslations("home.pricing");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), SKELETON_DURATION);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) return <PricingSkeleton />;

  return (
    <section className="bg-white py-14 dark:bg-slate-950 md:py-20">
      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="mx-auto mb-10 max-w-xl text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            {t("label")}
          </span>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-4xl">
            {t("titleStart")}{" "}
            <span className="yamba-grad-text">{t("titleHighlight")}</span>
            {t("titleEnd")}
          </h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{t("subtitle")}</p>
        </div>

        {/* 2 colonnes */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Colonne 1 : Décomposition */}
          <div className="rounded-2xl bg-slate-50 p-6 dark:bg-slate-900">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("breakdown.title")}
            </p>

            <div className="space-y-4">
              {/* Yamber 85% */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">✈️</span>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t("breakdown.yamberLabel")}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">85%</p>
                </div>
                <div className="overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className="yamba-grad-bg h-3 rounded-full" style={{ width: "85%" }} />
                </div>
              </div>

              {/* Yamba 15% */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="grid h-5 w-5 place-items-center rounded bg-slate-900 dark:bg-slate-100">
                      <span className="text-[10px] font-bold text-white dark:text-slate-900">Y</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t("breakdown.yambaLabel")}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">15%</p>
                </div>
                <div className="overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-3 rounded-full bg-slate-700 dark:bg-slate-300"
                    style={{ width: "15%" }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {t("breakdown.yambaSubtitle")}
                </p>
              </div>
            </div>

            {/* Assurance */}
            <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🛡️</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t("breakdown.insuranceLabel")}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t("breakdown.insuranceSubtitle")}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">+3€</p>
              </div>
            </div>
          </div>

          {/* Colonne 2 : Timeline 3 jours statique */}
          <div className="rounded-2xl bg-slate-50 p-6 dark:bg-slate-900">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("timeline.label")}
            </p>
            <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              {t("timeline.titleStart")}{" "}
              <span className="yamba-grad-text">{t("timeline.titleHighlight")}</span>{" "}
              {t("timeline.titleEnd")}
            </h3>
            <p className="mb-5 mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {t("timeline.subtitle")}
            </p>

            {/* Timeline horizontale */}
            <div className="relative">
              <div
                className="absolute left-0 right-0 top-5 h-1 rounded-full"
                style={{
                  background: "linear-gradient(to right, #FF9900, #FF6B35, #2DD4BF)",
                }}
              />
              <div className="relative grid grid-cols-4 gap-1">
                {TIMELINE_STEPS.map((step) => (
                  <div key={step.id} className="text-center">
                    <div
                      className={`mx-auto grid h-11 w-11 place-items-center rounded-full text-base shadow-md ${
                        step.isLast
                          ? "border-2 border-[#2DD4BF] bg-[#2DD4BF]"
                          : "border-2 border-[#FF9900] bg-white dark:bg-slate-950"
                      }`}
                    >
                      {step.emoji}
                    </div>
                    <p
                      className={`mt-2 text-[10px] font-bold ${
                        step.isLast ? "text-[#0F766E] dark:text-teal-400" : "text-[#FF9900]"
                      }`}
                    >
                      {t(`timeline.steps.${step.id}.label`)}
                    </p>
                    <p className="text-[10px] font-semibold leading-tight text-slate-700 dark:text-slate-200">
                      {t(`timeline.steps.${step.id}.title`)}
                    </p>
                    <p className="mt-0.5 text-[9px] leading-tight text-slate-500 dark:text-slate-400">
                      {t(`timeline.steps.${step.id}.subtitle`)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bénéfices doubles */}
            <div className="mt-6 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-orange-50 p-2.5 dark:bg-orange-950/30">
                <p className="text-[10px] font-bold text-slate-900 dark:text-white">📦 Shipper</p>
                <p className="mt-0.5 text-[10px] leading-tight text-slate-600 dark:text-slate-400">
                  {t("timeline.shipperBenefit")}
                </p>
              </div>
              <div className="rounded-lg bg-teal-50 p-2.5 dark:bg-teal-950/30">
                <p className="text-[10px] font-bold text-slate-900 dark:text-white">✈️ Yamber</p>
                <p className="mt-0.5 text-[10px] leading-tight text-slate-600 dark:text-slate-400">
                  {t("timeline.yamberBenefit")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
