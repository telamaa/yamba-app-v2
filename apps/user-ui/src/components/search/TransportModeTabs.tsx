"use client";

import { Car, Plane, Train } from "lucide-react";
import { useMemo } from "react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { TransportMode, YambaTripResult } from "./search-results.types";

type FilterMode = "all" | TransportMode;

type Props = {
  active: FilterMode;
  items: YambaTripResult[];
  onChange: (value: FilterMode) => void;
};

type Lang = "fr" | "en";

export default function TransportModeTabs({ active, items, onChange }: Props) {
  const { lang } = useUiPreferences();

  const copy = useMemo(() => {
    const isFr = (lang as Lang) === "fr";
    return {
      all: isFr ? "Tout" : "All",
      plane: isFr ? "Avion" : "Plane",
      train: isFr ? "Train" : "Train",
      car: isFr ? "Voiture" : "Car",
    };
  }, [lang]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      plane: items.filter((item) => item.transportMode === "plane").length,
      train: items.filter((item) => item.transportMode === "train").length,
      car: items.filter((item) => item.transportMode === "car").length,
    };
  }, [items]);

  const tabs: Array<{
    key: FilterMode;
    label: string;
    icon?: React.ReactNode;
    count: number;
  }> = [
    { key: "all", label: copy.all, count: counts.all },
    { key: "plane", label: copy.plane, icon: <Plane size={16} />, count: counts.plane },
    { key: "train", label: copy.train, icon: <Train size={16} />, count: counts.train },
    { key: "car", label: copy.car, icon: <Car size={16} />, count: counts.car },
  ];

  return (
    <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="grid grid-cols-4">
        {tabs.map((tab) => {
          const isActive = active === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={[
                "flex min-w-0 flex-col items-center justify-center gap-1 px-1.5 py-2.5 text-center transition-colors md:flex-row md:gap-2 md:px-4 md:py-3",
                "border-b-2 md:border-b-0",
                isActive
                  ? "border-slate-900 bg-[#FFF6E8] text-slate-950 dark:border-white dark:bg-slate-900 dark:text-white"
                  : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/60 dark:hover:text-white",
              ].join(" ")}
            >
              <span className="flex items-center gap-1.5">
                {tab.icon}
                <span className="truncate text-[11px] font-semibold leading-tight md:text-sm">
                  {tab.label}
                </span>
              </span>

              <span
                className={[
                  "text-[10px] leading-tight md:text-sm",
                  isActive
                    ? "text-slate-700 dark:text-slate-200"
                    : "text-slate-400 dark:text-slate-500",
                ].join(" ")}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
