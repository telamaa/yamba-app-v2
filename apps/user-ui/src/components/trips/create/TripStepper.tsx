"use client";

import { Check } from "lucide-react";
import type { Step } from "./create-trip.types";

const MANGO = "#FF9900";

export default function TripStepper({
                                      step,
                                      labels,
                                      onGoTo,
                                    }: {
  step: Step;
  labels: string[];
  onGoTo: (step: Step) => void;
}) {
  return (
    <div className="mb-8 flex items-center">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const isDone = n < step;
        const isActive = n === step;
        const isUpcoming = n > step;

        return (
          <div key={label} className="flex flex-1 items-center">
            <button
              type="button"
              onClick={() => isDone && onGoTo(n)}
              className="flex items-center gap-2"
              disabled={isUpcoming}
            >
              <div
                className={[
                  "grid h-7 w-7 place-items-center rounded-full text-[12px] font-medium transition-all",
                  isUpcoming
                    ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                    : "",
                ].join(" ")}
                style={
                  isDone || isActive
                    ? { backgroundColor: MANGO, color: "#1a1a1a" }
                    : undefined
                }
              >
                {isDone ? <Check size={14} strokeWidth={3} /> : n}
              </div>

              <span
                className={[
                  "hidden text-[13px] sm:block",
                  isActive
                    ? "font-medium text-slate-900 dark:text-white"
                    : isDone
                      ? "text-slate-600 dark:text-slate-400"
                      : "text-slate-400 dark:text-slate-500",
                ].join(" ")}
              >
                {label}
              </span>
            </button>

            {/* Connector line */}
            {i < labels.length - 1 && (
              <div className="mx-3 h-[2px] flex-1 rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: isDone ? "100%" : "0%",
                    backgroundColor: MANGO,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
