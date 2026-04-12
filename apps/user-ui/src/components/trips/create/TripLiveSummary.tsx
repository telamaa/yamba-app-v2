"use client";

import { Plane, Train, Car, MapPin, CalendarDays, Package } from "lucide-react";
import type { Draft } from "./create-trip.types";

const MANGO = "#FF9900";

const modeIcons = {
  plane: Plane,
  train: Train,
  car: Car,
};

function formatDate(d?: Date): string {
  if (!d) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function TripLiveSummary({ draft }: { draft: Draft }) {
  const Icon = draft.transportMode ? modeIcons[draft.transportMode] : null;
  const hasRoute = draft.from && draft.to;
  const hasDate = draft.departureDate;
  const catCount = draft.acceptedCategories.length;

  const isEmpty = !draft.transportMode && !hasRoute && !hasDate && catCount === 0;
  if (isEmpty) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 dark:bg-slate-800/50">
      {Icon && (
        <div className="flex items-center gap-1.5">
          <Icon size={15} style={{ color: MANGO }} />
          <span className="text-[12px] font-medium text-slate-700 dark:text-slate-300">
            {draft.transportMode === "plane" ? "Avion" : draft.transportMode === "train" ? "Train" : "Voiture"}
          </span>
        </div>
      )}

      {Icon && hasRoute && (
        <span className="text-slate-300 dark:text-slate-600">·</span>
      )}

      {hasRoute && (
        <div className="flex items-center gap-1">
          <MapPin size={13} className="text-slate-400" />
          <span className="text-[12px] text-slate-600 dark:text-slate-400">
            {draft.from} → {draft.to}
          </span>
        </div>
      )}

      {hasDate && (
        <>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <div className="flex items-center gap-1">
            <CalendarDays size={13} className="text-slate-400" />
            <span className="text-[12px] text-slate-600 dark:text-slate-400">
              {formatDate(draft.departureDate)}
              {draft.arrivalDate && draft.arrivalDate !== draft.departureDate && ` → ${formatDate(draft.arrivalDate)}`}
            </span>
          </div>
        </>
      )}

      {catCount > 0 && (
        <>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <div className="flex items-center gap-1">
            <Package size={13} className="text-slate-400" />
            <span className="text-[12px] text-slate-600 dark:text-slate-400">
              {catCount} cat.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
