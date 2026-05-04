"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const SKELETON_DURATION = 300;

type StepId = "find" | "book" | "sign" | "track" | "receive";

type Step = {
  id: StepId;
  number: string;
  icon: React.ReactNode;
  isExclusive?: boolean;
};

const SearchIcon = () => (
  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
);

const CardIcon = () => (
  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
  </svg>
);

const PinIcon = () => (
  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
  </svg>
);

const LockIcon = () => (
  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
);

const STEPS: Step[] = [
  { id: "find", number: "01", icon: <SearchIcon /> },
  { id: "book", number: "02", icon: <CardIcon /> },
  { id: "sign", number: "03", icon: <ShieldCheckIcon /> },
  { id: "track", number: "04", icon: <PinIcon /> },
  { id: "receive", number: "05", icon: <LockIcon />, isExclusive: true },
];

function JourneySkeleton() {
  return (
    <section className="bg-slate-50 py-14 dark:bg-slate-900 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto mb-10 max-w-xl space-y-3 text-center">
          <div className="mx-auto h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mx-auto h-9 w-2/3 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="mx-auto h-4 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="mx-auto mb-3 h-14 w-14 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="mx-auto h-3 w-8 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="mx-auto mt-1 h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="mx-auto mt-2 h-3 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function JourneySection() {
  const t = useTranslations("home.journey");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), SKELETON_DURATION);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) return <JourneySkeleton />;

  return (
    <section className="bg-slate-50 py-14 dark:bg-slate-900 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
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

        {/* Desktop : grid 5 cols avec ligne pointillée animée */}
        <div className="relative hidden md:block">
          <div className="pointer-events-none absolute left-[10%] right-[10%] top-9 h-px">
            <svg className="h-8 w-full" viewBox="0 0 1000 24" preserveAspectRatio="none">
              <path
                d="M 0 12 Q 250 -6 500 12 T 1000 12"
                fill="none"
                stroke="#FF9900"
                strokeWidth="2"
                strokeDasharray="4 6"
                opacity="0.4"
                className="yamba-animated-path"
              />
            </svg>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`group relative z-10 rounded-2xl bg-white p-4 text-center transition-all duration-300 hover:-translate-y-1 dark:bg-slate-950 ${
                  step.isExclusive
                    ? "border-2 border-[#FF9900]/30 shadow-md shadow-orange-200/30 dark:shadow-orange-900/20"
                    : "border border-slate-100 dark:border-slate-800"
                }`}
              >
                {step.isExclusive && (
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex whitespace-nowrap rounded-full bg-[#FF9900] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-950">
                      {t("exclusivityBadge")}
                    </span>
                  </div>
                )}

                <div
                  className={`mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl text-[#FF9900] transition-all duration-300 group-hover:scale-105 group-hover:bg-[#FF9900] group-hover:text-white ${
                    step.isExclusive
                      ? "bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/40 dark:to-orange-900/60"
                      : "bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-900/40"
                  }`}
                >
                  {step.icon}
                </div>

                <span className="text-[9px] font-bold tracking-[0.15em] text-[#FF9900]">
                  {step.number}
                </span>
                <h3 className="mt-1 text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  {t(`steps.${step.id}.title`)}
                </h3>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                  {t(`steps.${step.id}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile : swipe horizontal */}
        <div className="md:hidden">
          <div className="yamba-scroll-snap-x -mx-4 flex gap-3 overflow-x-auto px-4 pb-4">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`yamba-scroll-snap-item relative w-[260px] shrink-0 rounded-2xl bg-white p-5 dark:bg-slate-950 ${
                  step.isExclusive
                    ? "border-2 border-[#FF9900]/30 shadow-md shadow-orange-200/30 dark:shadow-orange-900/20"
                    : "border border-slate-100 dark:border-slate-800"
                }`}
              >
                {step.isExclusive && (
                  <div className="absolute -top-2 left-5">
                    <span className="inline-flex rounded-full bg-[#FF9900] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-950">
                      {t("exclusivityBadge")}
                    </span>
                  </div>
                )}

                <div
                  className={`mb-3 grid h-12 w-12 place-items-center rounded-xl text-[#FF9900] ${
                    step.isExclusive
                      ? "mt-2 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/40 dark:to-orange-900/60"
                      : "bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-900/40"
                  }`}
                >
                  {step.icon}
                </div>

                <span className="text-[10px] font-bold tracking-[0.15em] text-[#FF9900]">
                  {t("stepLabel")} {step.number}
                </span>
                <h3 className="mt-1 text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  {t(`steps.${step.id}.title`)}
                </h3>
                <p className="mt-1.5 text-xs leading-snug text-slate-600 dark:text-slate-400">
                  {t(`steps.${step.id}.description`)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 text-center text-[10px] text-slate-400 dark:text-slate-500">
            {t("swipeHint")}
          </div>
        </div>
      </div>
    </section>
  );
}
