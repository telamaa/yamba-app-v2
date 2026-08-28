"use client";

/**
 * TripPricingUi.tsx — briques du formulaire PER_KG (mockup-pricing-yamba.html)
 * ============================================================================
 * Curseur + valeur, jauge « prix juste » (D15), ligne famille OK / +% / Non
 * (D14), forfait bagage entier (PRC-04), carte gain net (D16).
 * Aucune logique métier ici : les verdicts viennent de create-trip.config.
 */

import React from "react";
import type { FairPriceVerdict, PriceSuggestion } from "./create-trip.config";
import type { FamilyConditionDraft, FamilyConditionMode } from "./create-trip.types";
import { FieldError } from "@/components/trips/create/TripFormUi";

const MANGO = "#FF9900";
const MANGO_10 = "rgba(255,153,0,0.10)";
const TEAL = "#0F766E";
const TEAL_10 = "rgba(15,118,110,0.10)";

export function formatEur(n: number, digits = 2): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/* ── Curseur + saisie numérique synchronisés ─────────── */

export function SliderField({
  value,
  min,
  max,
  step,
  unit,
  onChangeAction,
  error,
  ariaLabel,
}: {
  value: number | "";
  min: number;
  max: number;
  step: number;
  unit: string;
  onChangeAction: (value: number | "") => void;
  error?: string;
  ariaLabel: string;
}) {
  const sliderValue = typeof value === "number" ? value : min;
  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={sliderValue}
          aria-label={ariaLabel}
          onChange={(e) => onChangeAction(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer"
          style={{ accentColor: MANGO }}
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={step}
            value={value}
            aria-label={ariaLabel}
            onChange={(e) => {
              const v = e.target.value;
              onChangeAction(v === "" ? "" : Number(v));
            }}
            className={[
              "w-20 rounded-lg border bg-white px-2 py-1.5 text-right text-[14px] font-bold tabular-nums text-slate-900",
              "focus:outline-none focus:ring-1 focus:ring-[#FF9900]/20 dark:bg-slate-900 dark:text-white",
              error
                ? "border-[#FF9900]"
                : "border-slate-200 focus:border-[#FF9900] dark:border-slate-700",
            ].join(" ")}
          />
          <span className="min-w-[34px] text-[12px] font-semibold text-slate-500 dark:text-slate-400">
            {unit}
          </span>
        </div>
      </div>
      <FieldError error={error} />
    </div>
  );
}

/* ── Jauge « prix juste » (D15) ──────────────────────
 * Échelle : [low − 45 % de l'écart … high + 45 %] — miroir du mockup.
 * ──────────────────────────────────────────────────── */

export function FairPriceGauge({
  price,
  suggestion,
  verdict,
  labels,
}: {
  price: number | "";
  suggestion: PriceSuggestion;
  verdict: FairPriceVerdict | null;
  labels: { low: string; median: string; high: string; ok: string; tooLow: string; tooHigh: string };
}) {
  const span = suggestion.high - suggestion.low;
  const gMin = suggestion.low - span * 0.45;
  const gMax = suggestion.high + span * 0.45;
  const pct = (v: number) =>
    Math.min(97, Math.max(3, ((v - gMin) / (gMax - gMin)) * 100));

  const lowPct = pct(suggestion.low);
  const highPct = pct(suggestion.high);

  // Charte : sous le marché = neutre slate, juste = teal, au-dessus = mango
  const verdictStyle =
    verdict === "low"
      ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      : verdict === "high"
        ? "text-slate-900 dark:text-[#FFB84D]"
        : "text-[#0F766E] dark:text-teal-400";
  const verdictBg =
    verdict === "high" ? MANGO_10 : verdict === "ok" ? TEAL_10 : undefined;

  return (
    <div className="mt-6">
      <div
        className="relative h-8 rounded-lg border border-slate-200 dark:border-slate-700"
        style={{
          background: `linear-gradient(90deg,
            rgba(148,163,184,.14) 0%, rgba(148,163,184,.14) ${lowPct}%,
            ${TEAL_10} ${lowPct}%, ${TEAL_10} ${highPct}%,
            ${MANGO_10} ${highPct}%, ${MANGO_10} 100%)`,
        }}
      >
        {(
          [
            [suggestion.low, labels.low],
            [suggestion.median, labels.median],
            [suggestion.high, labels.high],
          ] as const
        ).map(([v, label]) => (
          <span
            key={label}
            className="absolute top-full -translate-x-1/2 whitespace-nowrap pt-1 text-[10px] text-slate-400 dark:text-slate-500"
            style={{ left: `${pct(v)}%` }}
          >
            {formatEur(v)} · {label}
          </span>
        ))}

        {typeof price === "number" && price > 0 && (
          <div
            className="absolute -top-2 -bottom-2 w-[3px] rounded bg-slate-900 transition-[left] duration-150 dark:bg-white"
            style={{ left: `${pct(price)}%` }}
          >
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">
              {formatEur(price)}
            </span>
          </div>
        )}
      </div>

      {verdict && (
        <div
          className={`mt-6 inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold ${verdictStyle}`}
          style={verdictBg ? { backgroundColor: verdictBg } : undefined}
        >
          {verdict === "low" ? labels.tooLow : verdict === "high" ? labels.tooHigh : labels.ok}
        </div>
      )}
    </div>
  );
}

/* ── Ligne famille : OK / +% / Non (D14) ─────────────── */

/** Charte : accepter = teal, surcharger = mango (actif), refuser = neutre slate. */
const MODE_STYLES: Record<FamilyConditionMode, { className: string; bg?: string }> = {
  ACCEPT: { className: "border-[#0F766E]/40 text-[#0F766E] dark:text-teal-400", bg: TEAL_10 },
  SURCHARGE: { className: "border-[#FF9900] text-slate-900 dark:text-[#FFB84D]", bg: MANGO_10 },
  REFUSE: { className: "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300" },
};

export function FamilyConditionRow({
  icon,
  label,
  condition,
  surchargeRange,
  labels,
  onChangeAction,
  error,
}: {
  icon: string;
  label: string;
  condition: FamilyConditionDraft;
  surchargeRange: { min: number; max: number; step: number };
  labels: { accept: string; surcharge: string; refuse: string };
  onChangeAction: (next: FamilyConditionDraft) => void;
  error?: string;
}) {
  const modes: Array<{ mode: FamilyConditionMode; label: string }> = [
    { mode: "ACCEPT", label: labels.accept },
    { mode: "SURCHARGE", label: labels.surcharge },
    { mode: "REFUSE", label: labels.refuse },
  ];

  return (
    <div>
      <div
        className={[
          "flex flex-wrap items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 dark:bg-slate-900",
          condition.mode === "SURCHARGE"
            ? "border-[#FF9900]/40"
            : "border-slate-200 dark:border-slate-700",
          condition.mode === "REFUSE" ? "opacity-60" : "",
        ].join(" ")}
      >
        <span className="w-6 text-center text-[16px]" aria-hidden="true">
          {icon}
        </span>
        <span className="flex-1 text-[13px] font-semibold text-slate-800 dark:text-slate-200">
          {label}
        </span>

        {condition.mode === "SURCHARGE" && (
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={surchargeRange.min}
              max={surchargeRange.max}
              step={surchargeRange.step}
              value={condition.surchargePct}
              aria-label={`${label} %`}
              onChange={(e) =>
                onChangeAction({ ...condition, surchargePct: Number(e.target.value) })
              }
              className="h-1 w-20 cursor-pointer"
              style={{ accentColor: MANGO }}
            />
            <b className="min-w-[38px] text-right text-[12px] tabular-nums text-slate-800 dark:text-slate-200">
              +{condition.surchargePct}%
            </b>
          </div>
        )}

        <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
          {modes.map((m) => {
            const on = condition.mode === m.mode;
            return (
              <button
                key={m.mode}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChangeAction({ ...condition, mode: m.mode })}
                className={[
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                  on
                    ? MODE_STYLES[m.mode].className
                    : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600",
                ].join(" ")}
                style={on && MODE_STYLES[m.mode].bg ? { backgroundColor: MODE_STYLES[m.mode].bg } : undefined}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
      <FieldError error={error} />
    </div>
  );
}

/* ── Forfait bagage entier (PRC-04) ───────────────────── */

export function BagFlatRateRow({
  icon,
  label,
  hint,
  value,
  onChangeAction,
  error,
}: {
  icon: string;
  label: string;
  hint: string;
  value: number | "";
  onChangeAction: (value: number | "") => void;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 px-3.5 py-3 dark:border-slate-600">
        <span className="text-[18px]" aria-hidden="true">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">
            {label}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</div>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={value}
            aria-label={label}
            placeholder="—"
            onChange={(e) => {
              const v = e.target.value;
              onChangeAction(v === "" ? "" : Number(v));
            }}
            className={[
              "w-20 rounded-lg border bg-white px-2 py-1.5 text-right text-[13px] font-semibold text-slate-900",
              "focus:outline-none dark:bg-slate-900 dark:text-white",
              error
                ? "border-[#FF9900]"
                : "border-slate-200 focus:border-[#FF9900] dark:border-slate-700",
            ].join(" ")}
          />
          <span className="text-[12px] text-slate-400">€</span>
        </div>
      </div>
      <FieldError error={error} />
    </div>
  );
}

/* ── Carte gain net (D16 : ton prix = ton net) ─────────── */

export function NetGainCard({
  title,
  amount,
  label,
  sub,
}: {
  title: string;
  amount: number;
  label: string;
  sub: string;
}) {
  return (
    <div
      className="rounded-xl border border-[#0F766E]/20 px-4 py-3.5"
      style={{
        background:
          "linear-gradient(135deg, rgba(15,118,110,0.08) 0%, rgba(255,153,0,0.06) 100%)",
      }}
    >
      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{title}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </span>
        <span className="text-[22px] font-bold tabular-nums dark:text-teal-400" style={{ color: TEAL }}>
          {formatEur(amount)} €
        </span>
      </div>
      <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{sub}</div>
    </div>
  );
}
