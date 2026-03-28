"use client";

import { CreateTripCopy, Draft } from "./create-trip.types";
import { SummaryCard } from "./TripFormUi";

export default function TripSummarySidebar({
                                             copy,
                                             draft,
                                             isFr,
                                             pathTypeLabel,
                                           }: {
  copy: CreateTripCopy;
  draft: Draft;
  isFr: boolean;
  pathTypeLabel: string;
}) {
  const routeSummary = [draft.from, draft.to].filter(Boolean).join(" → ") || copy.emptyValue;

  const scheduleSummary =
    draft.departureDate || draft.arrivalDate || draft.departureTime || draft.arrivalTime
      ? `${draft.departureDate ? draft.departureDate.toLocaleDateString(isFr ? "fr-FR" : "en-US") : "—"}${
        draft.departureTime ? ` • ${draft.departureTime}` : ""
      } → ${draft.arrivalDate ? draft.arrivalDate.toLocaleDateString(isFr ? "fr-FR" : "en-US") : "—"}${
        draft.arrivalTime ? ` • ${draft.arrivalTime}` : ""
      }`
      : copy.emptyValue;

  const categoriesSummary =
    draft.acceptedCategories.length > 0
      ? draft.acceptedCategories.length.toString()
      : copy.emptyValue;

  return (
    <aside className="lg:sticky lg:top-[176px]">
      <div className="rounded-[15px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      {/*<div className="p-0">*/}
        <div className="mb-4 text-lg font-black tracking-tight text-slate-900 dark:text-white">
          {copy.summary}
        </div>

        <div className="space-y-3">
          <SummaryCard title={copy.reviewRoute} value={routeSummary} />
          <SummaryCard title={copy.reviewSchedule} value={scheduleSummary} />
          <SummaryCard title={copy.tripPathType} value={pathTypeLabel} />
          <SummaryCard title={copy.categories} value={categoriesSummary} />

          {draft.travelReference ? (
            <SummaryCard title={copy.travelReference} value={draft.travelReference} />
          ) : null}

          {draft.transportMode === "plane" && draft.flightLayoverCities ? (
            <SummaryCard title={copy.flightLayoverCities} value={draft.flightLayoverCities} />
          ) : null}

          {draft.transportMode === "train" && draft.trainStopCities ? (
            <SummaryCard title={copy.trainStopCities} value={draft.trainStopCities} />
          ) : null}
        </div>
      </div>
    </aside>
  );
}
