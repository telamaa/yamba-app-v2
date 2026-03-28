"use client";

import { CreateTripCopy, Draft } from "../create-trip.types";
import { SectionTitle, SummaryCard } from "../TripFormUi";

export default function StepReview({
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
    draft.departureDate || draft.departureTime
      ? `${draft.departureDate ? draft.departureDate.toLocaleDateString(isFr ? "fr-FR" : "en-US") : "—"}${
        draft.departureTime ? ` • ${draft.departureTime}` : ""
      }`
      : copy.emptyValue;

  return (
    <>
      <SectionTitle title={copy.step5Title} subtitle={copy.step5Sub} />

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          title={copy.reviewMode}
          value={
            draft.transportMode
              ? draft.transportMode === "plane"
                ? copy.plane
                : draft.transportMode === "train"
                  ? copy.train
                  : copy.car
              : copy.emptyValue
          }
        />
        <SummaryCard title={copy.tripPathType} value={pathTypeLabel} />
        <SummaryCard title={copy.reviewRoute} value={routeSummary} />
        <SummaryCard title={copy.reviewSchedule} value={scheduleSummary} />
        <SummaryCard
          title={copy.reviewCapacity}
          value={`${draft.maxParcelCount || "—"} • ${draft.maxWeightKg || "—"} kg`}
        />
        <SummaryCard
          title={copy.reviewConditions}
          value={`${draft.priceAmount || "—"} € • ${
            draft.instantBooking ? copy.instantBooking : "—"
          }`}
        />
      </div>

      <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          {copy.notes}
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {draft.notes || copy.emptyValue}
        </div>
      </div>
    </>
  );
}
