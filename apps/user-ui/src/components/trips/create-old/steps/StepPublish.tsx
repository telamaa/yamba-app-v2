"use client";

import { CategoryOption, CreateTripCopy, Draft, HandoffMoment, PickupMoment } from "../create-trip.types";
import { SectionTitle, SummaryCard } from "../TripFormUi";

function formatHandoffLabel(copy: CreateTripCopy, value: HandoffMoment) {
  if (value === "beforeDeparture") return copy.beforeDeparture;
  return copy.atDeparture;
}

function formatPickupLabel(copy: CreateTripCopy, value: PickupMoment) {
  if (value === "onArrival") return copy.onArrival;
  return copy.laterAtAddress;
}

export default function StepPublish({
                                      copy,
                                      draft,
                                      isFr,
                                      pathTypeLabel,
                                      categoryOptions,
                                    }: {
  copy: CreateTripCopy;
  draft: Draft;
  isFr: boolean;
  pathTypeLabel: string;
  categoryOptions: CategoryOption[];
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

  const categoryLabelMap = new Map(categoryOptions.map((item) => [item.key, item.label]));

  return (
    <>
      <SectionTitle title={copy.step3Title} subtitle={copy.step3Sub} />

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
          {copy.summary}
        </div>

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

      <div className="mt-6">
        <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          {copy.reviewCategoryConditions}
        </div>

        {draft.acceptedCategories.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {draft.acceptedCategories.map((categoryKey) => {
              const condition = draft.categoryConditions[categoryKey];

              if (!condition) return null;

              return (
                <div
                  key={categoryKey}
                  className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {categoryLabelMap.get(categoryKey) ?? categoryKey}
                    </div>
                    <div className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      {condition.priceAmount === "" ? "—" : `${condition.priceAmount} €`}
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="mb-1 font-semibold text-slate-700 dark:text-slate-300">
                        {copy.handoffMoments}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {condition.handoffMoments.length > 0
                          ? condition.handoffMoments
                            .map((value) => formatHandoffLabel(copy, value))
                            .join(" • ")
                          : copy.emptyValue}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 font-semibold text-slate-700 dark:text-slate-300">
                        {copy.pickupMoments}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {condition.pickupMoments.length > 0
                          ? condition.pickupMoments
                            .map((value) => formatPickupLabel(copy, value))
                            .join(" • ")
                          : copy.emptyValue}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            {copy.emptyValue}
          </div>
        )}
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
