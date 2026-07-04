/**
 * ReportInfoBlocks.tsx
 * ====================
 * - ReportProcessInfo : bloc bleu "Ce qui va se passer" (4 étapes numérotées)
 * - ReportPledge : engagement sur l'honneur (checkbox → emerald quand coché)
 *   avec lien collapsible "Pourquoi cet engagement ?"
 */

"use client";

import { Check, GitBranch } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

// ── Process (bleu, 4 étapes) ──────────────────────────────

export function ReportProcessInfo({
                                    carrierFirstName,
                                    compact = false,
                                  }: {
  carrierFirstName: string;
  compact?: boolean;
}) {
  const t = useTranslations("bookingTracker");

  const steps = compact
    ? [
      t("report.process.step1Short"),
      t("report.process.step2Short", { carrierFirstName }),
      t("report.process.step3Short"),
      t("report.process.step4Short", { carrierFirstName }),
    ]
    : [
      t("report.process.step1"),
      t("report.process.step2", { carrierFirstName }),
      t("report.process.step3"),
      t("report.process.step4", { carrierFirstName }),
    ];

  return (
    <section
      className={
        "rounded-xl bg-blue-50 dark:bg-blue-950/30 sm:rounded-2xl " +
        (compact ? "px-4 py-3.5" : "px-5 py-4")
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <GitBranch
          size={15}
          className="flex-shrink-0 text-blue-700 dark:text-blue-400"
          aria-hidden="true"
        />
        <h3
          className={
            "font-semibold text-blue-900 dark:text-blue-200 " +
            (compact ? "text-[13px]" : "text-[14px]")
          }
        >
          {compact ? t("report.process.titleShort") : t("report.process.title")}
        </h3>
      </div>
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li
            key={i}
            className={
              "flex items-start gap-2.5 leading-relaxed text-blue-800 dark:text-blue-300 " +
              (compact ? "text-[12px]" : "text-[12.5px]")
            }
          >
            <span
              className="mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-blue-700 text-[10px] font-semibold text-white dark:bg-blue-600"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span>{parseBold(step)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── Pledge (engagement sur l'honneur) ─────────────────────

export function ReportPledge({
                               checked,
                               onToggleAction,
                               compact = false,
                             }: {
  checked: boolean;
  onToggleAction: () => void;
  compact?: boolean;
}) {
  const t = useTranslations("bookingTracker");
  const [whyOpen, setWhyOpen] = useState(false);

  const containerClass =
    "w-full rounded-xl border p-4 text-left transition-colors sm:rounded-2xl " +
    (checked
      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
      : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900");
  const boxClass =
    "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-[1.5px] transition-colors " +
    (checked
      ? "border-emerald-700 bg-emerald-700 text-white dark:border-emerald-600 dark:bg-emerald-600"
      : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-950");
  const textClass =
    "leading-relaxed " +
    (compact ? "text-[12.5px]" : "text-[13px]") +
    " " +
    (checked
      ? "text-emerald-950 dark:text-emerald-100"
      : "text-slate-700 dark:text-slate-300");

  return (
    <div>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggleAction}
        className={containerClass}
      >
        <span className="flex items-start gap-3">
          <span className={boxClass} aria-hidden="true">
            {checked && <Check size={13} strokeWidth={3} />}
          </span>
          <span className={textClass}>
            {compact ? t("report.pledge.textShort") : t("report.pledge.text")}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => setWhyOpen((o) => !o)}
        aria-expanded={whyOpen}
        className="mt-1.5 px-1 text-[11.5px] font-medium text-blue-700 hover:underline dark:text-blue-400"
      >
        {t("report.pledge.whyLink")}
      </button>
      {whyOpen && (
        <p className="mt-1 px-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
          {t("report.pledge.whyText")}
        </p>
      )}
    </div>
  );
}

// ── helper ────────────────────────────────────────────────

function parseBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-blue-900 dark:text-blue-200">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}
