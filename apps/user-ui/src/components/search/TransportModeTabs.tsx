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
    { key: "plane", label: copy.plane, icon: <Plane size={18} />, count: counts.plane },
    { key: "train", label: copy.train, icon: <Train size={18} />, count: counts.train },
    { key: "car", label: copy.car, icon: <Car size={18} />, count: counts.car },
  ];

  return (
    <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="grid grid-cols-2 md:grid-cols-4">
        {tabs.map((tab) => {
          const isActive = active === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={[
                "flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-[#FFF6E8] text-slate-950 dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/60 dark:hover:text-white",
              ].join(" ")}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className="text-slate-400">· {tab.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
