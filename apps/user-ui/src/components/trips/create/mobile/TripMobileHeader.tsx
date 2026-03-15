"use client";

import { CreateTripCopy, Draft, Step } from "../create-trip.types";

export default function TripMobileHeader({
                                           copy,
                                           draft,
                                           isFr,
                                           step,
                                           pathTypeLabel,
                                         }: {
  copy: CreateTripCopy;
  draft: Draft;
  isFr: boolean;
  step: Step;
  pathTypeLabel: string;
}) {
  const progress = (step / 3) * 100;

  const routeSummary =
    [draft.from, draft.to].filter(Boolean).join(" → ") || copy.emptyValue;

  const categoriesSummary =
    draft.acceptedCategories.length > 0
      ? isFr
        ? `${draft.acceptedCategories.length} catégorie${
          draft.acceptedCategories.length > 1 ? "s" : ""
        }`
        : `${draft.acceptedCategories.length} categor${
          draft.acceptedCategories.length > 1 ? "ies" : "y"
        }`
      : copy.emptyValue;

  const showPathType = pathTypeLabel && pathTypeLabel !== copy.emptyValue;

  return (
    <div className="fixed inset-x-0 top-0 z-[140] border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              {copy.title}
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {isFr ? `Étape ${step}/3` : `Step ${step}/3`} — {copy.steps[step - 1]}
            </div>
          </div>

          <div className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {step}/3
          </div>
        </div>

        <div className="mt-3 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-1.5 rounded-full bg-[#FF9900] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {routeSummary}
          </span>

          {showPathType ? (
            <span className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
              {pathTypeLabel}
            </span>
          ) : null}

          <span className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {categoriesSummary}
          </span>
        </div>
      </div>
    </div>
  );
}
