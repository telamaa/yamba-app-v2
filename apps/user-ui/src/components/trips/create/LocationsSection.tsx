"use client";

import { PackagePlus, PackageCheck, Check } from "lucide-react";
import type {
  CreateTripCopy,
  LocationContext,
  TripLocationPoint,
} from "./create-trip.types";
import { FieldError } from "./TripFormUi";
import LocationCard from "./LocationCard";

const TEAL = "#0F766E";

export default function LocationsSection({
                                           context,
                                           title,
                                           subtitle,
                                           locations = [],
                                           onChangeAction,
                                           copy,
                                           error,
                                         }: {
  context: LocationContext;
  title: string;
  subtitle: string;
  /**
   * Locations à afficher. Default `[]` pour rester safe quand
   * useEditTrip n'a pas (encore) peuplé draft.pickupLocations /
   * draft.deliveryLocations en mode édition.
   */
  locations?: TripLocationPoint[];
  onChangeAction: (next: TripLocationPoint[]) => void;
  copy: CreateTripCopy;
  error?: string;
}) {
  const Icon = context === "PICKUP" ? PackagePlus : PackageCheck;
  const enabledCount = locations.filter((l) => l.enabled).length;
  const hasEnabled = enabledCount > 0;

  const handleCardChange = (updated: TripLocationPoint) => {
    onChangeAction(locations.map((l) => (l.id === updated.id ? updated : l)));
  };

  return (
    <div className="mb-5">
      {/* Header: title + subtitle + status badge */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon size={14} className="text-[#FF9900] flex-shrink-0" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {title}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
            {subtitle}
          </p>
        </div>

        <span
          className={[
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
            hasEnabled
              ? "text-white"
              : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
          ].join(" ")}
          style={hasEnabled ? { backgroundColor: TEAL } : undefined}
        >
          {hasEnabled && <Check size={10} strokeWidth={3} />}
          {copy.locationsCount(enabledCount)}
        </span>
      </div>

      {/* Cards grid */}
      {locations.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {locations.map((loc) => (
            <LocationCard
              key={loc.id}
              location={loc}
              onChangeAction={handleCardChange}
              copy={copy}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[12px] text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
          {copy.emptyValue}
        </div>
      )}

      <FieldError error={error} />
    </div>
  );
}
