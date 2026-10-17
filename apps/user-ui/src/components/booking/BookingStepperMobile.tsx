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
  // « Colis · étape 1 sur 4 » sous quatre pastilles numérotées dont la
  // première est déjà mangue : la même information, trois fois. Le compte part
  // de l'écran et reste pour qui ne voit pas les pastilles (lecteur d'écran).
  const indicator = t("steps.indicator", { current, total: 4 });

  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <div
        className="flex items-center justify-center gap-1 px-4 py-3"
        role="group"
        aria-label={indicator}
      >
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
      <div className="pb-2.5 text-center text-[11px] font-medium text-slate-900 dark:text-white">
        {currentLabel}
      </div>
    </div>
  );
}
