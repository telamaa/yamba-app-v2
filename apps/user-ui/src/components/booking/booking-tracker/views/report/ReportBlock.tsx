/**
 * ReportBlock.tsx
 * ===============
 * Wrapper de bloc numéroté à états pour le formulaire de signalement :
 * numéro gris (idle) / mango (actif) / ✓ emerald (rempli).
 * Badge Requis (rouge) / Recommandé / Optionnel (gris).
 */

"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

type BlockState = "idle" | "active" | "done";
type BadgeKind = "required" | "recommended" | "optional";

type Props = {
  num: number;
  state: BlockState;
  title: string;
  badge?: BadgeKind;
  badgeLabel?: string;
  sub?: string;
  compact?: boolean;
  children: ReactNode;
};

export default function ReportBlock({
                                      num,
                                      state,
                                      title,
                                      badge,
                                      badgeLabel,
                                      sub,
                                      compact = false,
                                      children,
                                    }: Props) {
  const numBase =
    "flex flex-shrink-0 items-center justify-center rounded-full font-semibold " +
    (compact ? "h-6 w-6 text-[12px]" : "h-7 w-7 text-[13px]");
  const numClass =
    numBase +
    " " +
    (state === "done"
      ? "bg-emerald-700 text-white dark:bg-emerald-600"
      : state === "active"
        ? "bg-[#FF9900] text-white"
        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400");

  const badgeClass =
    "inline-flex items-center rounded-full px-2 py-0.5 font-medium " +
    (compact ? "text-[10px]" : "text-[11px]") +
    " " +
    (badge === "required"
      ? "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300"
      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400");

  return (
    <section
      className={
        "rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl " +
        (compact ? "p-4" : "p-4 sm:p-5")
      }
    >
      <div className="mb-3.5 flex items-start gap-3">
        <span className={numClass} aria-hidden="true">
          {state === "done" ? <Check size={compact ? 13 : 14} strokeWidth={3} /> : num}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={
                "font-semibold text-slate-900 dark:text-white " +
                (compact ? "text-[14px]" : "text-[15px]")
              }
            >
              {title}
            </h3>
            {badge && badgeLabel && <span className={badgeClass}>{badgeLabel}</span>}
          </div>
          {sub && (
            <p
              className={
                "mt-0.5 leading-snug text-slate-500 dark:text-slate-400 " +
                (compact ? "text-[11px]" : "text-[12px]")
              }
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
