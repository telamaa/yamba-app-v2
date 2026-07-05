/**
 * RatingComment.tsx
 * =================
 * Commentaire optionnel · public · max 280 caractères.
 * Compteur : gris → amber warning à partir de 240 (bloqué à 280).
 */

"use client";

import { useTranslations } from "next-intl";
import { RATING_COMMENT_MAX_LENGTH } from "./rating.types";

const WARNING_THRESHOLD = RATING_COMMENT_MAX_LENGTH - 40;

type Props = {
  value: string;
  placeholder: string;
  onChangeAction: (value: string) => void;
  compact?: boolean;
};

export default function RatingComment({
                                        value,
                                        placeholder,
                                        onChangeAction,
                                        compact = false,
                                      }: Props) {
  const t = useTranslations("rating");

  const count = value.length;
  const isWarning = count >= WARNING_THRESHOLD;

  const counterClass =
    "mt-1.5 text-right " +
    (compact ? "text-[10px]" : "text-[11px]") +
    " " +
    (isWarning
      ? "font-medium text-amber-700 dark:text-amber-400"
      : "text-slate-400 dark:text-slate-500");

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3
          className={
            "font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 " +
            (compact ? "text-[10px]" : "text-[11px]")
          }
        >
          {compact ? t("comment.labelShort") : t("comment.label")}
        </h3>
        <span
          className={
            "text-slate-400 dark:text-slate-500 " +
            (compact ? "text-[10px]" : "text-[11px]")
          }
        >
          {compact
            ? t("comment.optionalShort", { max: RATING_COMMENT_MAX_LENGTH })
            : t("comment.optional", { max: RATING_COMMENT_MAX_LENGTH })}
        </span>
      </div>

      <textarea
        value={value}
        onChange={(e) =>
          onChangeAction(e.target.value.slice(0, RATING_COMMENT_MAX_LENGTH))
        }
        placeholder={placeholder}
        rows={compact ? 3 : 4}
        className={
          "w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#FF9900] focus:outline-none focus:ring-2 focus:ring-[#FF9900]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 " +
          (compact ? "text-[13px]" : "text-[14px]")
        }
      />
      <div className={counterClass} aria-live="polite">
        {isWarning
          ? t("comment.counterWarning", {
            count,
            max: RATING_COMMENT_MAX_LENGTH,
          })
          : t("comment.counter", { count, max: RATING_COMMENT_MAX_LENGTH })}
      </div>
    </div>
  );
}
