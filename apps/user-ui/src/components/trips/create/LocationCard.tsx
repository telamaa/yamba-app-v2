"use client";

import { Plane, Train, Building2 } from "lucide-react";
import type {
  CreateTripCopy,
  LocationFlexibility,
  LocationKind,
  TripLocationPoint,
} from "./create-trip.types";

const TEAL = "#0F766E";

/* ── Helpers ──────────────────────────────────────── */

function getKindIcon(kind: LocationKind) {
  switch (kind) {
    case "AIRPORT":
      return Plane;
    case "TRAIN_STATION":
      return Train;
    case "CITY_AREA":
      return Building2;
  }
}

function getKindLabel(kind: LocationKind, copy: CreateTripCopy): string {
  switch (kind) {
    case "AIRPORT":
      return copy.atAirport;
    case "TRAIN_STATION":
      return copy.atTrainStation;
    case "CITY_AREA":
      return copy.inTheCity;
  }
}

type FlexOption = {
  flexibility: LocationFlexibility;
  radiusKm: number | null;
  label: string;
};

function getFlexOptions(kind: LocationKind, copy: CreateTripCopy): FlexOption[] {
  if (kind === "CITY_AREA") {
    return [
      { flexibility: "RADIUS", radiusKm: 5, label: copy.flexRadius5 },
      { flexibility: "RADIUS", radiusKm: 10, label: copy.flexRadius10 },
      { flexibility: "RADIUS", radiusKm: 15, label: copy.flexRadius15 },
      { flexibility: "RADIUS", radiusKm: 20, label: copy.flexRadius20 },
      { flexibility: "CITY_WIDE", radiusKm: null, label: copy.flexCityWide },
    ];
  }
  // AIRPORT or TRAIN_STATION
  return [
    { flexibility: "EXACT", radiusKm: null, label: copy.flexExact },
    { flexibility: "RADIUS", radiusKm: 5, label: copy.flexRadius5 },
    { flexibility: "RADIUS", radiusKm: 10, label: copy.flexRadius10 },
  ];
}

function isFlexOptionActive(
  opt: FlexOption,
  current: TripLocationPoint
): boolean {
  if (opt.flexibility !== current.flexibility) return false;
  if (opt.flexibility === "RADIUS") return opt.radiusKm === current.radiusKm;
  return true;
}

/* ── Component ────────────────────────────────────── */

export default function LocationCard({
                                       location,
                                       onChangeAction,
                                       copy,
                                     }: {
  location: TripLocationPoint;
  onChangeAction: (next: TripLocationPoint) => void;
  copy: CreateTripCopy;
}) {
  const Icon = getKindIcon(location.kind);
  const label = getKindLabel(location.kind, copy);
  const flexOptions = getFlexOptions(location.kind, copy);
  const enabled = location.enabled;

  const toggleEnabled = () => {
    onChangeAction({ ...location, enabled: !enabled });
  };

  const updateDetails = (details: string) => {
    onChangeAction({ ...location, details });
  };

  const updateFlexibility = (opt: FlexOption) => {
    onChangeAction({
      ...location,
      flexibility: opt.flexibility,
      radiusKm: opt.radiusKm,
    });
  };

  return (
    <div
      className={[
        "rounded-lg border p-3 transition-all",
        enabled
          ? "border-[#FF9900] bg-[#FF9900]/[0.04] dark:bg-[#FF9900]/[0.06]"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
      ].join(" ")}
    >
      {/* Header: icon + label + toggle */}
      <button
        type="button"
        onClick={toggleEnabled}
        className="flex w-full items-center justify-between gap-2"
        aria-pressed={enabled}
      >
        <span className="flex items-center gap-2 text-[13px] font-medium text-slate-900 dark:text-white">
          <Icon
            size={14}
            className={enabled ? "text-[#FF9900]" : "text-slate-400 dark:text-slate-500"}
          />
          {label}
        </span>
        <span
          className={[
            "relative inline-block h-[14px] w-[26px] flex-shrink-0 rounded-full border-[0.5px] transition-colors",
            enabled
              ? "border-[#FF9900] bg-[#FF9900]"
              : "border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-[1px] h-[10px] w-[10px] rounded-full bg-white shadow-sm transition-all",
              enabled ? "left-[13px]" : "left-[1px]",
            ].join(" ")}
          />
        </span>
      </button>

      {/* Body: details + flexibility — only when enabled */}
      {enabled && (
        <div className="mt-3 animate-[fadeSlide_0.15s_ease]">
          <input
            type="text"
            value={location.details ?? ""}
            onChange={(e) => updateDetails(e.target.value)}
            placeholder={copy.locationDetailsPlaceholder}
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:border-[#FF9900] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
            maxLength={120}
          />

          <div className="mt-2.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {copy.flexibility}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {flexOptions.map((opt) => {
              const active = isFlexOptionActive(opt, location);
              return (
                <button
                  key={`${opt.flexibility}-${opt.radiusKm ?? "x"}`}
                  type="button"
                  onClick={() => updateFlexibility(opt)}
                  className={[
                    "rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors",
                    active
                      ? "border-transparent text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600",
                  ].join(" ")}
                  style={active ? { backgroundColor: TEAL } : undefined}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
