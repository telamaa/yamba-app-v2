/**
 * RatingCriteria.tsx
 * ==================
 * "SUR CES POINTS PRÉCIS" — 3 critères diagnostiques avec pouces 👍/👎.
 * OPTIONNELS (la note globale suffit). Re-cliquer un pouce le désélectionne.
 * 👍 sélectionné = emerald · 👎 sélectionné = rouge.
 * Les libellés arrivent traduits du parent (zéro t() dynamique).
 */

"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CriterionId, CriterionVote } from "./rating.types";

export type CriterionItem = {
  id: CriterionId;
  name: string;
  desc: string;
};

type Props = {
  items: CriterionItem[];
  votes: Partial<Record<CriterionId, CriterionVote>>;
  onVoteAction: (id: CriterionId, vote: CriterionVote) => void;
  compact?: boolean;
};

export default function RatingCriteria({
                                         items,
                                         votes,
                                         onVoteAction,
                                         compact = false,
                                       }: Props) {
  const t = useTranslations("rating");

  const thumbBase =
    "flex flex-shrink-0 items-center justify-center rounded-full border transition-colors " +
    (compact ? "h-9 w-9" : "h-10 w-10");

  return (
    <div>
      <h3
        className={
          "mb-2.5 font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 " +
          (compact ? "text-[10px]" : "text-[11px]")
        }
      >
        {compact ? t("criteria.labelShort") : t("criteria.label")}
      </h3>

      <div className="space-y-2">
        {items.map((item) => {
          const vote = votes[item.id];
          const upClass =
            thumbBase +
            " " +
            (vote === "UP"
              ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
              : "border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:bg-slate-800");
          const downClass =
            thumbBase +
            " " +
            (vote === "DOWN"
              ? "border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400"
              : "border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:bg-slate-800");

          return (
            <div
              key={item.id}
              className={
                "flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl " +
                (compact ? "p-3" : "p-3.5 sm:p-4")
              }
            >
              <div className="min-w-0 flex-1">
                <div
                  className={
                    "font-semibold text-slate-900 dark:text-white " +
                    (compact ? "text-[13px]" : "text-[14px]")
                  }
                >
                  {item.name}
                </div>
                <div
                  className={
                    "mt-0.5 leading-snug text-slate-500 dark:text-slate-400 " +
                    (compact ? "text-[10.5px]" : "text-[11.5px]")
                  }
                >
                  {item.desc}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onVoteAction(item.id, "UP")}
                  aria-label={item.name + " — " + t("criteria.thumbUp")}
                  aria-pressed={vote === "UP"}
                  className={upClass}
                >
                  <ThumbsUp size={compact ? 14 : 15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onVoteAction(item.id, "DOWN")}
                  aria-label={item.name + " — " + t("criteria.thumbDown")}
                  aria-pressed={vote === "DOWN"}
                  className={downClass}
                >
                  <ThumbsDown size={compact ? 14 : 15} aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
