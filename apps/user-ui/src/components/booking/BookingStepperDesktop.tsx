/**
 * BookingStepperDesktop.tsx
 * =========================
 * Horizontal stepper with numbered circles + labels.
 * Pulls its own labels from i18n.
 */

"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { MANGO, TEAL_DONE } from "./BookingFormUi";
import type { Step } from "./booking.types";

type Props = {
  current: Step;
  onStepClickAction?: (step: Step) => void;
};

const STEP_KEYS = ["parcel", "recipient", "charter", "payment"] as const;

export default function BookingStepperDesktop({
                                                current,
                                                onStepClickAction,
                                              }: Props) {
  const t = useTranslations("booking");
  const steps: Step[] = [1, 2, 3, 4];

  return (
    <div className="flex items-center justify-center gap-0 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
      {steps.map((step, index) => {
        const isActive = step === current;
        const isDone = step < current;
        const isFuture = step > current;
        const isClickable = !isFuture && step !== current && onStepClickAction;
        const label = t(`steps.${STEP_KEYS[index]}`);

        return (
          <div key={step} className="flex items-center">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClickAction(step)}
              className={[
                "flex items-center gap-2.5",
                isClickable ? "cursor-pointer" : "cursor-default",
              ].join(" ")}
              aria-current={isActive ? "step" : undefined}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-medium transition-colors"
                style={{
                  backgroundColor: isActive
                    ? MANGO
                    : isDone
                      ? TEAL_DONE
                      : "transparent",
                  borderColor: isActive
                    ? MANGO
                    : isDone
                      ? TEAL_DONE
                      : "rgba(148, 163, 184, 0.5)",
                  color: isActive || isDone ? "white" : "#94A3B8",
                }}
              >
                {isDone ? <Check size={14} /> : step}
              </span>
              <span
                className={[
                  "text-[13px] transition-colors",
                  isActive
                    ? "font-medium text-slate-900 dark:text-white"
                    : isDone
                      ? "text-slate-600 dark:text-slate-300"
                      : "text-slate-400 dark:text-slate-500",
                ].join(" ")}
              >
                {label}
              </span>
            </button>
            {index < steps.length - 1 && (
              <span
                className="mx-4 h-px w-12"
                style={{
                  backgroundColor:
                    step < current ? TEAL_DONE : "rgba(148, 163, 184, 0.3)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
