"use client";

import React from "react";
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
  const hasDate = !!draft.departureDate;
  const catCount = draft.acceptedCategories.length;

  /* ── Build items array ──
   * Each item is rendered with a separator only IF it's not the first.
   * This guarantees we never render an orphan dot.
   */
  const items: { key: string; node: React.ReactNode }[] = [];

  if (Icon) {
    items.push({
      key: "mode",
      node: (
        <div className="flex items-center gap-1.5">
          <Icon size={15} style={{ color: MANGO }} />
          <span className="text-[12px] font-medium text-slate-700 dark:text-slate-300">
            {draft.transportMode === "plane"
              ? "Avion"
              : draft.transportMode === "train"
                ? "Train"
                : "Voiture"}
          </span>
        </div>
      ),
    });
  }

  if (hasRoute) {
    items.push({
      key: "route",
      node: (
        <div className="flex items-center gap-1">
          <MapPin size={13} className="text-slate-400" />
          <span className="text-[12px] text-slate-600 dark:text-slate-400">
            {draft.from} → {draft.to}
          </span>
        </div>
      ),
    });
  }

  if (hasDate) {
    items.push({
      key: "date",
      node: (
        <div className="flex items-center gap-1">
          <CalendarDays size={13} className="text-slate-400" />
          <span className="text-[12px] text-slate-600 dark:text-slate-400">
            {formatDate(draft.departureDate)}
            {draft.arrivalDate &&
              draft.arrivalDate !== draft.departureDate &&
              ` → ${formatDate(draft.arrivalDate)}`}
          </span>
        </div>
      ),
    });
  }

  if (catCount > 0) {
    items.push({
      key: "cats",
      node: (
        <div className="flex items-center gap-1">
          <Package size={13} className="text-slate-400" />
          <span className="text-[12px] text-slate-600 dark:text-slate-400">
            {catCount} cat.
          </span>
        </div>
      ),
    });
  }

  // Don't render anything if there's nothing to show
  if (items.length === 0) return null;

  return (
    <div
      className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-[#FF9900]/15 px-4 py-2.5 animate-[fadeSlide_0.2s_ease]"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,153,0,0.06) 0%, rgba(15,118,110,0.06) 100%)",
      }}
    >
      {items.map((item, idx) => (
        <React.Fragment key={item.key}>
          {idx > 0 && (
            <span
              className="text-slate-300 dark:text-slate-600"
              aria-hidden="true"
            >
              ·
            </span>
          )}
          {item.node}
        </React.Fragment>
      ))}
    </div>
  );
}
