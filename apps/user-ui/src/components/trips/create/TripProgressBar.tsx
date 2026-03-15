"use client";

import { cn } from "./TripFormUi";

export default function TripProgressBar({
                                          step,
                                          steps,
                                        }: {
  step: number;
  steps: string[];
}) {
  const percent = (step / steps.length) * 100;

  return (
    <>
      <div className="mt-5 hidden flex-wrap gap-4 lg:flex">
        {steps.map((label, index) => {
          const current = index + 1;
          const active = step === current;
          const completed = step > current;

          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                  completed
                    ? "bg-[#FF9900] text-slate-950"
                    : active
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                )}
              >
                {current}
              </div>
              <span
                className={cn(
                  "text-sm font-semibold",
                  active
                    ? "text-slate-900 dark:text-white"
                    : "text-slate-500 dark:text-slate-400"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-2 rounded-full bg-[#FF9900] transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </>
  );
}
