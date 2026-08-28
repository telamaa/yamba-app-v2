"use client";

/**
 * TripPricingUi.tsx — briques du formulaire PER_KG (mockup-pricing-yamba.html)
 * ============================================================================
 * Curseur + valeur, jauge « prix juste » (D15), ligne famille Accepté/Refusé
 * + supplément (D14), forfait bagage entier (PRC-04), carte gain net (D16),
 * accordéon et popover ⓘ.
 *
 * Mobile-first : cibles tactiles ≥ 44 px, lignes qui se replient, popover au
 * tap (jamais hover-only), sections fermées NON montées (DOM léger), lignes
 * famille mémoïsées (React.memo) pour ne pas re-rendre 8 lignes à chaque
 * frappe. Aucune logique métier ici : tout vient de create-trip.config.
 */

import React, { memo, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Baby,
  Backpack,
  ChevronDown,
  FileText,
  Info,
  Luggage,
  Package,
  ShoppingBag,
  Shirt,
  Smartphone,
  Sparkles,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import type { FairPriceVerdict, FamilyIconKey, PriceSuggestion } from "./create-trip.config";
import type { FamilyConditionDraft } from "./create-trip.types";
import { FieldError, Toggle } from "@/components/trips/create/TripFormUi";

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

/* ── Icônes des familles / bagages (Lucide, colorables) ─────────── */

const FAMILY_ICONS: Record<FamilyIconKey, LucideIcon> = {
  "file-text": FileText,
  shirt: Shirt,
  package: Package,
  smartphone: Smartphone,
  sparkles: Sparkles,
  wrench: Wrench,
  baby: Baby,
  "shopping-bag": ShoppingBag,
};

export const BAG_ICONS = { checked: Luggage, cabin: Backpack } as const;

export function IconBadge({ icon: Icon, muted }: { icon: LucideIcon; muted?: boolean }) {
  return (
    <span
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: muted ? "rgba(148,163,184,0.15)" : TEAL_10 }}
      aria-hidden="true"
    >
      <Icon size={16} strokeWidth={1.75} style={{ color: muted ? "#94a3b8" : TEAL }} />
    </span>
  );
}

/* ── Popover ⓘ — ouverture au tap/clic, fermeture Échap / clic dehors ── */

export function InfoHint({ label, children }: { label: string; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const open = pos !== null;

  // Rendu dans un portal en position FIXE : aucun overflow parent ne peut
  // le rogner ; borné aux bords de l'écran (mobile compris).
  const toggle = () => {
    if (open) return setPos(null);
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(320, window.innerWidth - 32);
    const left = Math.max(16, Math.min(r.left, window.innerWidth - width - 16));
    setPos({ top: r.bottom + 6, left, width });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || document.getElementById(id)?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, id]);

  return (
    <span ref={ref} className="inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className="-m-2 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
      >
        <Info size={15} />
      </button>
      {open &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
            className="z-[500] block rounded-xl border border-slate-200 bg-white p-3 text-[12px] font-normal normal-case tracking-normal leading-relaxed text-slate-600 shadow-lg animate-[fadeSlide_0.15s_ease] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {children}
          </span>,
          document.body
        )}
    </span>
  );
}

/* ── Accordéon — le contenu n'est monté qu'ouvert ─────────────────── */

export function Accordion({
  title,
  summary,
  actionLabel,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary: string | null;
  actionLabel: string;
  hint?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="border-t border-slate-200/60 dark:border-slate-800/60">
      <div className="flex min-h-[56px] items-center gap-3 py-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {title}
            </div>
            {summary && (
              <div className="mt-0.5 truncate text-[13px] text-slate-700 dark:text-slate-300">
                {summary}
              </div>
            )}
          </div>
          <span className="flex flex-shrink-0 items-center gap-1 text-[12px] font-medium" style={{ color: MANGO }}>
            {open ? "" : actionLabel}
            <ChevronDown
              size={16}
              className="transition-transform duration-200"
              style={{ transform: open ? "rotate(180deg)" : undefined }}
            />
          </span>
        </button>
        {hint}
      </div>
      {open && (
        <div id={id} className="pb-4 animate-[fadeSlide_0.2s_ease]">
          {children}
        </div>
      )}
    </div>
  );
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
          className="h-11 flex-1 cursor-pointer touch-pan-x"
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
              "h-11 w-[4.5rem] rounded-lg border bg-white px-2 text-right text-[15px] font-bold tabular-nums text-slate-900",
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
 * Zones en classes Tailwind (thème-aware : alphas plus forts en dark).
 * L'espace sous la jauge (repères + badge) est TOUJOURS réservé → pas
 * de chevauchement quand le badge est absent.
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

  const verdictClass =
    verdict === "low"
      ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      : verdict === "high"
        ? "text-slate-900 dark:text-[#FFB84D]"
        : "text-[#0F766E] dark:text-teal-400";
  const verdictBg = verdict === "high" ? MANGO_10 : verdict === "ok" ? TEAL_10 : undefined;

  return (
    <div className="mt-4">
      <div className="relative h-7 rounded-lg border border-slate-200 dark:border-slate-700">
        <div
          className="absolute inset-y-0 left-0 rounded-l-lg bg-slate-400/15 dark:bg-slate-400/25"
          style={{ width: `${lowPct}%` }}
        />
        <div
          className="absolute inset-y-0 bg-[#0F766E]/10 dark:bg-[#0F766E]/35"
          style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-lg bg-[#FF9900]/10 dark:bg-[#FF9900]/25"
          style={{ width: `${100 - highPct}%` }}
        />

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
            className="absolute -top-1.5 -bottom-1.5 w-[3px] rounded bg-slate-900 transition-[left] duration-150 dark:bg-white"
            style={{ left: `${pct(price)}%` }}
          />
        )}
      </div>

      {/* hauteur stable : repères (pt-1) + badge */}
      <div className="mt-6 flex min-h-[28px] items-center">
        {verdict && (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold ${verdictClass}`}
            style={verdictBg ? { backgroundColor: verdictBg } : undefined}
          >
            {verdict === "low" ? labels.tooLow : verdict === "high" ? labels.tooHigh : labels.ok}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Ligne famille : Accepté/Refusé + supplément optionnel (D14) ──── */

type FamilyRowProps = {
  iconKey: FamilyIconKey;
  label: string;
  condition: FamilyConditionDraft;
  surchargeRange: { min: number; max: number; step: number };
  labels: {
    accepted: string;
    refused: string;
    addSurcharge: string;
    surcharge: string;
    removeSurcharge: string;
  };
  onChangeAction: (next: FamilyConditionDraft) => void;
  error?: string;
};

export const FamilyConditionRow = memo(function FamilyConditionRow({
  iconKey,
  label,
  condition,
  surchargeRange,
  labels,
  onChangeAction,
  error,
}: FamilyRowProps) {
  const Icon = FAMILY_ICONS[iconKey];
  const accepted = condition.mode !== "REFUSE";
  const surcharged = condition.mode === "SURCHARGE";

  return (
    <div>
      <div
        className={[
          "rounded-xl border bg-white px-3 py-1.5 dark:bg-slate-900",
          surcharged ? "border-[#FF9900]/40" : "border-slate-200 dark:border-slate-700",
        ].join(" ")}
      >
        <div className="flex min-h-[44px] items-center gap-3">
          <IconBadge icon={Icon} muted={!accepted} />
          <span
            className={[
              "min-w-0 flex-1 truncate text-[13px] font-semibold",
              accepted
                ? "text-slate-800 dark:text-slate-200"
                : "text-slate-400 line-through dark:text-slate-500",
            ].join(" ")}
          >
            {label}
          </span>
          {surcharged && (
            <span
              className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-slate-900 dark:text-[#FFB84D]"
              style={{ backgroundColor: MANGO_10 }}
            >
              +{condition.surchargePct} %
            </span>
          )}
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="hidden text-[11px] text-slate-400 sm:inline dark:text-slate-500">
              {accepted ? labels.accepted : labels.refused}
            </span>
            <Toggle
              label={label}
              on={accepted}
              onChange={(on) =>
                onChangeAction({ ...condition, mode: on ? "ACCEPT" : "REFUSE" })
              }
            />
          </div>
        </div>

        {accepted && !surcharged && (
          <button
            type="button"
            onClick={() => onChangeAction({ ...condition, mode: "SURCHARGE" })}
            className="ml-11 min-h-[36px] text-[12px] font-medium"
            style={{ color: MANGO }}
          >
            + {labels.addSurcharge}
          </button>
        )}

        {surcharged && (
          <div className="ml-11 flex items-center gap-2 pb-1 animate-[fadeSlide_0.15s_ease]">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{labels.surcharge}</span>
            <input
              type="range"
              min={surchargeRange.min}
              max={surchargeRange.max}
              step={surchargeRange.step}
              value={condition.surchargePct}
              aria-label={`${labels.surcharge} ${label}`}
              onChange={(e) =>
                onChangeAction({ ...condition, surchargePct: Number(e.target.value) })
              }
              className="h-9 min-w-0 flex-1 cursor-pointer touch-pan-x"
              style={{ accentColor: MANGO }}
            />
            <button
              type="button"
              aria-label={labels.removeSurcharge}
              onClick={() => onChangeAction({ ...condition, mode: "ACCEPT" })}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
      <FieldError error={error} />
    </div>
  );
});

/* ── Forfait bagage entier (PRC-04) ───────────────────── */

export function BagFlatRateRow({
  icon: Icon,
  label,
  hint,
  equivalent,
  disabledReason,
  value,
  onChangeAction,
  error,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  equivalent: string | null;
  disabledReason: string | null;
  value: number | "";
  onChangeAction: (value: number | "") => void;
  error?: string;
}) {
  const disabled = disabledReason !== null;
  return (
    <div>
      <div
        className={[
          "flex min-h-[56px] items-center gap-3 rounded-xl border border-dashed px-3 py-2.5",
          disabled
            ? "border-slate-200 opacity-70 dark:border-slate-700"
            : "border-slate-300 dark:border-slate-600",
        ].join(" ")}
      >
        <IconBadge icon={Icon} muted={disabled} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{label}</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500">
            {disabled ? disabledReason : hint}
            {!disabled && equivalent && (
              <span className="ml-1.5 font-medium text-slate-500 dark:text-slate-400">
                {equivalent}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={disabled ? "" : value}
            disabled={disabled}
            aria-label={label}
            placeholder="—"
            onChange={(e) => {
              const v = e.target.value;
              onChangeAction(v === "" ? "" : Number(v));
            }}
            className={[
              "h-11 w-[4.5rem] rounded-lg border bg-white px-2 text-right text-[14px] font-semibold text-slate-900",
              "focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800",
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

export function NetGainCard({ title, amount, sub }: { title: string; amount: number; sub: string }) {
  return (
    <div
      className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-xl border border-[#0F766E]/20 px-4 py-3"
      style={{
        background:
          "linear-gradient(135deg, rgba(15,118,110,0.08) 0%, rgba(255,153,0,0.06) 100%)",
      }}
    >
      <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{title}</span>
      <span className="text-[22px] font-bold tabular-nums dark:text-teal-400" style={{ color: TEAL }}>
        {formatEur(amount)} €
      </span>
      <span className="text-[11px] text-slate-400 dark:text-slate-500">{sub}</span>
    </div>
  );
}
