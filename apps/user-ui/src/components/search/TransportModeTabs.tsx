"use client";

import { useMemo } from "react";
import { Car, Plane, Train } from "lucide-react";
import { useTranslations } from "next-intl";
import { TransportMode, YambaTripResult } from "./search-results.types";

type FilterMode = "all" | TransportMode;

type Props = {
  active: FilterMode;
  items: YambaTripResult[];
  onChange: (value: FilterMode) => void;
};

export default function TransportModeTabs({ active, items, onChange }: Props) {
  const t = useTranslations("common");

  const counts = useMemo(
    () => ({
      all: items.length,
      plane: items.filter((i) => i.transportMode === "plane").length,
      train: items.filter((i) => i.transportMode === "train").length,
      car: items.filter((i) => i.transportMode === "car").length,
    }),
    [items]
  );

  const tabs: Array<{
    key: FilterMode;
    label: string;
    icon?: React.ReactNode;
    count: number;
  }> = [
    { key: "all", label: t("transportTabs.all"), count: counts.all },
    {
      key: "plane",
      label: t("transportTabs.plane"),
      icon: <Plane size={13} strokeWidth={2} />,
      count: counts.plane,
    },
    {
      key: "train",
      label: t("transportTabs.train"),
      icon: <Train size={13} strokeWidth={2} />,
      count: counts.train,
    },
    {
      key: "car",
      label: t("transportTabs.car"),
      icon: <Car size={13} strokeWidth={2} />,
      count: counts.car,
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Pills — scrollables sur mobile */}
      <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = active === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={[
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors",
                isActive
                  ? "bg-white text-slate-950 shadow-sm dark:bg-white dark:text-slate-950"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900",
              ].join(" ")}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              <span
                className={[
                  "inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                  isActive
                    ? "bg-slate-950/10 text-slate-950"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                ].join(" ")}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Compteur total (caché si trop peu de place) */}
      <div className="hidden text-[12px] text-slate-500 dark:text-slate-400 md:block">
        <span className="font-semibold text-slate-900 dark:text-white">
          {counts.all}
        </span>{" "}
        {t("transportTabs.resultsCount")}
      </div>
    </div>
  );
}
