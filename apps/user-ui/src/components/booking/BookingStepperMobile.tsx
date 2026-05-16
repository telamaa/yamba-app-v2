/**
 * BookingStepperMobile.tsx
 * ========================
 * Compact mobile stepper. Pulls its own labels from i18n.
 */

"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { MANGO, TEAL_DONE } from "./BookingFormUi";
import type { Step } from "./booking.types";

type Props = {
  current: Step;
};

const STEP_KEYS = ["parcel", "recipient", "charter", "payment"] as const;

export default function BookingStepperMobile({ current }: Props) {
  const t = useTranslations("booking");
  const steps: Step[] = [1, 2, 3, 4];
  const currentLabel = t(`steps.${STEP_KEYS[current - 1]}`);
  const indicator = t("steps.indicator", { current, total: 4 });

  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-center gap-1 px-4 py-3.5">
        {steps.map((step, index) => {
          const isActive = step === current;
          const isDone = step < current;
          return (
            <div key={step} className="flex items-center">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-medium"
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
                aria-current={isActive ? "step" : undefined}
              >
                {isDone ? <Check size={12} /> : step}
              </span>
              {index < steps.length - 1 && (
                <span
                  className="h-px w-5"
                  style={{
                    backgroundColor:
                      step < current
                        ? TEAL_DONE
                        : "rgba(148, 163, 184, 0.3)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="pb-3 text-center text-[11px] text-slate-500 dark:text-slate-400">
        <strong className="font-medium text-slate-900 dark:text-white">
          {currentLabel}
        </strong>{" "}
        · {indicator}
      </div>
    </div>
  );
}
