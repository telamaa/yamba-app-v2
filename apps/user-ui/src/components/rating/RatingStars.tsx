/**
 * RatingStars.tsx
 * ===============
 * Note globale 1-5 étoiles — le SEUL champ requis.
 * Hover : prévisualisation (étoiles + label amber). Clic : sélection.
 * Label : "Décevant" → "Excellent".
 *
 * 3 layouts :
 *  - "center" : bloc vertical centré, sans card (mobile)
 *  - "hero"   : card pleine largeur, grandes étoiles (desktop, colonne main)
 *  - "row"    : rangée compacte label + étoiles + valeur (option dense)
 */

"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Props = {
  value: number; // 0 = pas encore noté
  onChangeAction: (stars: number) => void;
  compact?: boolean;
  layout?: "center" | "hero" | "row";
};

export default function RatingStars({
                                      value,
                                      onChangeAction,
                                      compact = false,
                                      layout = "center",
                                    }: Props) {
  const t = useTranslations("rating");
  const [hovered, setHovered] = useState(0);

  const displayed = hovered || value;

  const labelKeys = ["value1", "value2", "value3", "value4", "value5"] as const;
  const label = displayed >= 1 ? t("stars." + labelKeys[displayed - 1]) : "";

  // ── Layout HERO (desktop, colonne principale) ──────────
  if (layout === "hero") {
    return (
      <section
        className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-center dark:border-slate-800 dark:bg-slate-950"
        onMouseLeave={() => setHovered(0)}
      >
        <div className="mb-4 text-[13px] font-semibold text-slate-700 dark:text-slate-300">
          {t("stars.label")}
        </div>
        <div
          className="flex items-center justify-center gap-2"
          role="radiogroup"
          aria-label={t("stars.label")}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= displayed;
            return (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={value === star}
                aria-label={t("stars." + labelKeys[star - 1])}
                onClick={() => onChangeAction(star)}
                onMouseEnter={() => setHovered(star)}
                className={
                  "flex h-12 w-12 items-center justify-center rounded-xl border transition-all " +
                  (filled
                    ? "scale-105 border-amber-300 bg-amber-50 text-amber-500 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                    : "border-slate-200 bg-white text-slate-300 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-600")
                }
              >
                <Star
                  size={26}
                  fill={filled ? "currentColor" : "none"}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
        <div
          className="mt-3 min-h-[18px] text-[13px] font-semibold text-amber-700 dark:text-amber-400"
          aria-live="polite"
        >
          {label}
        </div>
      </section>
    );
  }

  // ── Layout ROW (rangée compacte) ───────────────────────
  if (layout === "row") {
    return (
      <div
        className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
        onMouseLeave={() => setHovered(0)}
      >
        <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
          {t("stars.label")}
        </span>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1"
            role="radiogroup"
            aria-label={t("stars.label")}
          >
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= displayed;
              return (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={value === star}
                  aria-label={t("stars." + labelKeys[star - 1])}
                  onClick={() => onChangeAction(star)}
                  onMouseEnter={() => setHovered(star)}
                  className={
                    "flex h-9 w-9 items-center justify-center rounded-lg border transition-all " +
                    (filled
                      ? "border-amber-300 bg-amber-50 text-amber-500 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                      : "border-slate-200 bg-white text-slate-300 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-600")
                  }
                >
                  <Star
                    size={20}
                    fill={filled ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
          <span
            className="min-w-[76px] text-right text-[12.5px] font-semibold text-amber-700 dark:text-amber-400"
            aria-live="polite"
          >
            {label}
          </span>
        </div>
      </div>
    );
  }

  // ── Layout CENTER (mobile — défaut) ────────────────────
  const starSize = compact ? 26 : 30;
  const btnSize = compact ? "h-10 w-10" : "h-11 w-11";

  return (
    <div className="py-2 text-center">
      <div
        className={
          "mb-3 text-slate-500 dark:text-slate-400 " +
          (compact ? "text-[12px]" : "text-[13px]")
        }
      >
        {t("stars.label")}
      </div>

      <div
        className="flex items-center justify-center gap-1.5"
        role="radiogroup"
        aria-label={t("stars.label")}
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= displayed;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={t("stars." + labelKeys[star - 1])}
              onClick={() => onChangeAction(star)}
              onMouseEnter={() => setHovered(star)}
              className={
                "flex items-center justify-center rounded-xl border transition-all " +
                btnSize +
                " " +
                (filled
                  ? "scale-105 border-amber-300 bg-amber-50 text-amber-500 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                  : "border-slate-200 bg-white text-slate-300 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-600")
              }
            >
              <Star
                size={starSize}
                fill={filled ? "currentColor" : "none"}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      <div
        className={
          "mt-2.5 min-h-[18px] font-semibold text-amber-700 dark:text-amber-400 " +
          (compact ? "text-[12px]" : "text-[13px]")
        }
        aria-live="polite"
      >
        {label}
      </div>
    </div>
  );
}
