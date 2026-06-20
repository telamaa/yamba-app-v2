/**
 * DealStepper.tsx
 * ===============
 * Stepper horizontal générique pour visualiser le parcours d'un Deal.
 * Cross-feature : utilisé côté Voyageur (post-acceptation) et Expéditeur (Phase 3).
 *
 * Standards mobile natif :
 *  - Dots ≥ 28px desktop / 22px mobile
 *  - Connector bar entre les étapes
 *  - Done = vert emerald (#0F6E56-like), Active = mango Yamba (#FF9900) avec ring
 */

"use client";

import { Check } from "lucide-react";

export type StepperStep = {
  id: string;
  label: string;
};

type Props = {
  steps: StepperStep[];
  /** 1-based index. Step 1 = current. Steps < current sont marqués done. */
  currentStep: number;
  /** Compact = mobile (dots plus petits, labels plus courts) */
  compact?: boolean;
  title?: string;
};

export default function DealStepper({
                                      steps,
                                      currentStep,
                                      compact = false,
                                      title,
                                    }: Props) {
  const dotSize = compact ? 22 : 28;
  const checkSize = compact ? 11 : 14;
  const progressPercent =
    steps.length > 1
      ? Math.max(0, Math.min(100, ((currentStep - 1) / (steps.length - 1)) * 100))
      : 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 sm:rounded-2xl sm:p-5">
      {title && (
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:text-[11px]">
          {title}
        </div>
      )}

      <div className="relative">
        {/* Connector bars */}
        <div
          className="absolute left-0 right-0 h-px bg-slate-200 dark:bg-slate-700"
          style={{
            top: `${dotSize / 2}px`,
            marginLeft: `${dotSize / 2}px`,
            marginRight: `${dotSize / 2}px`,
          }}
          aria-hidden="true"
        />
        <div
          className="absolute left-0 h-px bg-emerald-600 transition-all duration-300 dark:bg-emerald-500"
          style={{
            top: `${dotSize / 2}px`,
            marginLeft: `${dotSize / 2}px`,
            width: `calc(${progressPercent}% - ${dotSize / 2}px)`,
            maxWidth: `calc(100% - ${dotSize}px)`,
          }}
          aria-hidden="true"
        />

        <ol className="relative flex items-start justify-between">
          {steps.map((step, i) => {
            const stepNumber = i + 1;
            const isDone = stepNumber < currentStep;
            const isActive = stepNumber === currentStep;

            return (
              <li
                key={step.id}
                className="flex flex-1 flex-col items-center gap-1.5 sm:gap-2"
              >
                <span
                  className={`relative flex items-center justify-center rounded-full transition-colors ${
                    isDone
                      ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
                      : isActive
                        ? "border-[#FF9900] bg-[#FF9900] text-white shadow-[0_0_0_4px_rgba(255,153,0,0.15)]"
                        : "border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                  }`}
                  style={{
                    width: `${dotSize}px`,
                    height: `${dotSize}px`,
                    borderWidth: "1px",
                    borderStyle: "solid",
                  }}
                >
                  {isDone ? (
                    <Check size={checkSize} strokeWidth={3} aria-hidden="true" />
                  ) : (
                    <span
                      className={`font-semibold ${
                        compact ? "text-[10px]" : "text-[12px]"
                      }`}
                    >
                      {stepNumber}
                    </span>
                  )}
                </span>
                <span
                  className={`text-center leading-tight ${
                    compact
                      ? "max-w-[56px] text-[9px]"
                      : "max-w-[72px] text-[11px]"
                  } ${
                    isActive
                      ? "font-semibold text-slate-900 dark:text-white"
                      : isDone
                        ? "text-slate-600 dark:text-slate-400"
                        : "text-slate-500 dark:text-slate-500"
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
