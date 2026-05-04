"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const SKELETON_DURATION = 300;

type Pillar = {
  id: "speed" | "ecology" | "savings";
  emoji: string;
  bgGradient: string;
  borderColor: string;
  iconBg: string;
  iconShadow: string;
  tagBg: string;
  tagText: string;
};

const PILLARS: Pillar[] = [
  {
    id: "speed",
    emoji: "⚡",
    bgGradient: "from-orange-50 to-white dark:from-orange-950/20 dark:to-slate-900",
    borderColor: "border-orange-100 dark:border-orange-900/30",
    iconBg: "bg-[#FF9900]",
    iconShadow: "shadow-orange-200 dark:shadow-orange-900/30",
    tagBg: "bg-orange-100 dark:bg-orange-900/30",
    tagText: "text-[#FF9900]",
  },
  {
    id: "ecology",
    emoji: "🌱",
    bgGradient: "from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900",
    borderColor: "border-emerald-100 dark:border-emerald-900/30",
    iconBg: "bg-emerald-600",
    iconShadow: "shadow-emerald-200 dark:shadow-emerald-900/30",
    tagBg: "bg-emerald-100 dark:bg-emerald-900/30",
    tagText: "text-emerald-700 dark:text-emerald-400",
  },
  {
    id: "savings",
    emoji: "💰",
    bgGradient: "from-teal-50 to-white dark:from-teal-950/20 dark:to-slate-900",
    borderColor: "border-teal-100 dark:border-teal-900/30",
    iconBg: "bg-[#0F766E]",
    iconShadow: "shadow-teal-200 dark:shadow-teal-900/30",
    tagBg: "bg-teal-100 dark:bg-teal-900/30",
    tagText: "text-[#0F766E] dark:text-teal-400",
  },
];

function PillarsSkeleton() {
  return (
    <section className="bg-white py-12 dark:bg-slate-950 md:py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="h-6 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              </div>
              <div className="h-9 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="mt-2 h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="mt-2 space-y-1.5">
                <div className="h-3 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function PillarsSection() {
  const t = useTranslations("home.pillars");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), SKELETON_DURATION);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) return <PillarsSkeleton />;

  return (
    <section className="bg-white py-12 dark:bg-slate-950 md:py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.id}
              className={`group rounded-2xl border bg-gradient-to-br p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-100/30 dark:hover:shadow-orange-900/20 ${pillar.bgGradient} ${pillar.borderColor}`}
            >
              <div className="mb-4 flex items-start justify-between">
                <div
                  className={`grid h-12 w-12 place-items-center rounded-xl text-white shadow-lg ${pillar.iconBg} ${pillar.iconShadow}`}
                >
                  <span className="text-xl">{pillar.emoji}</span>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${pillar.tagBg} ${pillar.tagText}`}
                >
                  {t(`${pillar.id}.tag`)}
                </span>
              </div>

              <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {t(`${pillar.id}.value`)}
                <span className="text-base text-slate-400 dark:text-slate-500">
                  {t(`${pillar.id}.valueUnit`)}
                </span>
              </p>

              <h3 className="mt-2 text-base font-bold tracking-tight text-slate-900 dark:text-white">
                {t(`${pillar.id}.title`)}
              </h3>

              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {t(`${pillar.id}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
