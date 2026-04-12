"use client";

import type { Step } from "../create-trip.types";

const MANGO = "#FF9900";
const TEAL = "#0F766E";

export default function MobileBottomBar({
  step,
  canContinue,
  isPublishing,
  onBack,
  onNext,
  onPublish,
  onSaveDraft,
  backLabel,
  continueLabel,
  publishLabel,
  draftLabel,
}: {
  step: Step;
  canContinue: boolean;
  isPublishing: boolean;
  onBack: () => void;
  onNext: () => void;
  onPublish: () => void;
  onSaveDraft: () => void;
  backLabel: string;
  continueLabel: string;
  publishLabel: string;
  draftLabel: string;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-4 pb-[env(safe-area-inset-bottom)] pt-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-[13px] text-slate-600 dark:border-slate-700 dark:text-slate-400"
            >
              {backLabel}
            </button>
          )}
          {step === 1 && (
            <button
              type="button"
              onClick={onSaveDraft}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-[13px] text-slate-500 dark:border-slate-700 dark:text-slate-400"
            >
              {draftLabel}
            </button>
          )}
        </div>

        {step < 3 ? (
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg px-6 py-2.5 text-[13px] font-medium text-slate-900 transition-transform active:scale-[0.97]"
            style={{ backgroundColor: MANGO }}
          >
            {continueLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onPublish}
            disabled={isPublishing}
            className="rounded-lg px-6 py-2.5 text-[13px] font-medium text-white transition-transform active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: TEAL }}
          >
            {isPublishing ? "..." : publishLabel}
          </button>
        )}
      </div>

      {/* Step indicator dots */}
      <div className="mt-2 flex justify-center gap-1.5 pb-1">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: n === step ? 20 : 6,
              backgroundColor: n <= step ? MANGO : "rgba(148,163,184,0.3)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
