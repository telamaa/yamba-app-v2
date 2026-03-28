"use client";

import { CreateTripCopy, Step } from "../create-trip.types";

export default function TripMobileBottomBar({
                                              copy,
                                              step,
                                              canContinue,
                                              onBack,
                                              onNext,
                                              onPublish,
                                            }: {
  copy: CreateTripCopy;
  step: Step;
  canContinue: boolean;
  onBack: () => void;
  onNext: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[120] border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950 md:hidden">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={step === 1}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
        >
          {copy.back}
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={onNext}
            disabled={!canContinue}
            className="inline-flex h-12 flex-[1.3] items-center justify-center rounded-2xl bg-[#FF9900] text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.continue}
          </button>
        ) : (
          <button
            type="button"
            onClick={onPublish}
            className="inline-flex h-12 flex-[1.3] items-center justify-center rounded-2xl bg-[#FF9900] text-sm font-semibold text-slate-900"
          >
            {copy.publish}
          </button>
        )}
      </div>
    </div>
  );
}
