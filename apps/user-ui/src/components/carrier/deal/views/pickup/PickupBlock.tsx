/**
 * PickupBlock.tsx
 * ===============
 * Wrapper commun des blocs numérotés de l'écran pickup.
 * Numéro avec 3 états : default (gris), active (mango), done (emerald).
 */

"use client";

import type { ReactNode } from "react";

type Props = {
  num: number;
  state?: "default" | "active" | "done";
  title: ReactNode;
  sub?: ReactNode;
  compact?: boolean;
  children: ReactNode;
};

export default function PickupBlock({
                                      num,
                                      state = "default",
                                      title,
                                      sub,
                                      compact = false,
                                      children,
                                    }: Props) {
  const numClass =
    state === "done"
      ? "bg-emerald-700 text-white dark:bg-emerald-600"
      : state === "active"
        ? "bg-[#FF9900] text-white"
        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl ${
        compact ? "p-3.5" : "p-4 sm:p-5"
      }`}
    >
      <div className={`flex items-start gap-3 ${compact ? "mb-2.5" : "mb-3.5"}`}>
        <div
          className={`flex flex-shrink-0 items-center justify-center rounded-full font-semibold transition-colors ${numClass} ${
            compact ? "h-6 w-6 text-[12px]" : "h-7 w-7 text-[13px]"
          }`}
          aria-hidden="true"
        >
          {num}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`font-semibold text-slate-900 dark:text-white ${
              compact ? "text-[14px]" : "text-[14px] sm:text-[15px]"
            }`}
          >
            {title}
          </h3>
          {sub && (
            <p
              className={`mt-0.5 leading-snug text-slate-500 dark:text-slate-400 ${
                compact ? "text-[11px]" : "text-[12px]"
              }`}
            >
              {sub}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
