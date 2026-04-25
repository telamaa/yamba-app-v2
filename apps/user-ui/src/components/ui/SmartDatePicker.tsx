"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { DayPicker } from "react-day-picker";
import { enUS, fr } from "date-fns/locale";
import { useTranslations, useFormatter, useLocale } from "next-intl";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";

/**
 * SmartDatePicker — Composant de sélection de date intelligent.
 *
 * Modes:
 *  - "exact": calendrier uniquement, sélection d'une date précise (auto-close)
 *  - "flex": 3 chips de plage (semaine/mois/3 mois) + calendrier avec highlight
 *
 * Types de flexibilité:
 *  - "thisWeek": semaine courante (lundi-dimanche FR, dimanche-samedi EN)
 *  - "thisMonth": tout le mois courant
 *  - "next3Months": mois courant + 2 mois suivants
 *
 * Convention Next.js :
 *  - Le callback `onChangeAction` doit suivre la convention "Action" requise
 *    pour les props de fonctions dans les "use client" entry files.
 */

export type DateMode = "exact" | "flex";
export type FlexType = "thisWeek" | "thisMonth" | "next3Months";

export type DateValue = {
  mode: DateMode;
  date: Date;
  flexType?: FlexType;
  rangeStart?: Date;
  rangeEnd?: Date;
};

type TriggerVariant = "enriched" | "minimal";

type Props = {
  value: DateValue | null;
  /** Callback déclenché à chaque changement de sélection. Suffixe "Action" requis par Next.js. */
  onChangeAction: (value: DateValue | null) => void;
  defaultMode?: DateMode;
  minDate?: Date;
  maxDate?: Date;
  triggerVariant?: TriggerVariant;
  className?: string;
  showLabel?: boolean;
};

// ── Helpers ──

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(d: Date): Date {
  const copy = startOfDay(d);
  copy.setDate(1);
  return copy;
}

function endOfMonth(d: Date): Date {
  const copy = startOfDay(d);
  copy.setMonth(copy.getMonth() + 1, 0);
  return copy;
}

function addMonths(d: Date, months: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function startOfWeek(d: Date, weekStartsOn: 0 | 1): Date {
  const copy = startOfDay(d);
  const day = copy.getDay();
  const diff =
    weekStartsOn === 1
      ? day === 0
        ? 6
        : day - 1
      : day;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function endOfWeek(d: Date, weekStartsOn: 0 | 1): Date {
  const start = startOfWeek(d, weekStartsOn);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

function capitalizeFirst(s: string, localeTag: string): string {
  return s ? s.charAt(0).toLocaleUpperCase(localeTag) + s.slice(1) : s;
}

function computeFlexRange(
  flexType: FlexType,
  today: Date,
  weekStartsOn: 0 | 1
): { rangeStart: Date; rangeEnd: Date } {
  if (flexType === "thisWeek") {
    return {
      rangeStart: startOfWeek(today, weekStartsOn),
      rangeEnd: endOfWeek(today, weekStartsOn),
    };
  }
  if (flexType === "thisMonth") {
    return {
      rangeStart: startOfMonth(today),
      rangeEnd: endOfMonth(today),
    };
  }
  return {
    rangeStart: startOfMonth(today),
    rangeEnd: endOfMonth(addMonths(today, 2)),
  };
}

// ── Component ──

export default function SmartDatePicker({
                                          value,
                                          onChangeAction,
                                          defaultMode = "exact",
                                          minDate,
                                          maxDate,
                                          triggerVariant = "enriched",
                                          className = "",
                                          showLabel = true,
                                        }: Props) {
  const t = useTranslations("common");
  const format = useFormatter();
  const locale = useLocale();
  const localeTag = locale === "fr" ? "fr-FR" : "en-US";
  const dfnsLocale = locale === "fr" ? fr : enUS;
  const weekStartsOn: 0 | 1 = locale === "fr" ? 1 : 0;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DateMode>(value?.mode ?? defaultMode);
  const today = useMemo(() => startOfDay(new Date()), []);
  const effectiveMinDate = useMemo(() => minDate ?? today, [minDate, today]);

  const [displayMonth, setDisplayMonth] = useState<Date>(value?.date ?? today);

  useEffect(() => {
    if (value) setMode(value.mode);
  }, [value]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(wrapperRef, () => setOpen(false), open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setDisplayMonth(value?.date ?? today);
    }
  }, [open, value?.date, today]);

  // ── Handlers ──

  const handleDateSelect = useCallback(
    (selected: Date | undefined) => {
      if (!selected) return;
      const d = startOfDay(selected);

      // Dans les 2 modes, cliquer une date précise → passe en mode exact + auto-close
      onChangeAction({ mode: "exact", date: d });
      setMode("exact");
      setOpen(false);
    },
    [onChangeAction]
  );

  const handleFlexChipClick = useCallback(
    (flexType: FlexType) => {
      const { rangeStart, rangeEnd } = computeFlexRange(flexType, today, weekStartsOn);
      onChangeAction({
        mode: "flex",
        date: rangeStart,
        flexType,
        rangeStart,
        rangeEnd,
      });
      setDisplayMonth(rangeStart);
    },
    [onChangeAction, today, weekStartsOn]
  );

  const handleModeChange = useCallback(
    (newMode: DateMode) => {
      setMode(newMode);
      if (newMode === "exact" && value?.mode === "flex") {
        // Passer en exact avec aujourd'hui comme référence
        onChangeAction({ mode: "exact", date: today });
      } else if (newMode === "flex") {
        // Passer en flex avec "Cette semaine" par défaut
        const { rangeStart, rangeEnd } = computeFlexRange("thisWeek", today, weekStartsOn);
        onChangeAction({ mode: "flex", date: rangeStart, flexType: "thisWeek", rangeStart, rangeEnd });
        setDisplayMonth(rangeStart);
      }
    },
    [value, onChangeAction, today, weekStartsOn]
  );

  const handleApply = useCallback(() => {
    if (!value) {
      onChangeAction({ mode: "exact", date: today });
    }
    setOpen(false);
  }, [value, today, onChangeAction]);

  const handleClear = useCallback(() => {
    onChangeAction(null);
    setMode("exact");
    setOpen(false);
  }, [onChangeAction]);

  // ── Trigger label ──

  const triggerContent = useMemo(() => {
    if (!value) {
      return { main: t("datePicker.selectDate") };
    }

    if (value.mode === "exact") {
      const dayDate = format.dateTime(value.date, {
        weekday: "short",
        day: "2-digit",
        month: "short",
      });
      return { main: capitalizeFirst(dayDate, localeTag) };
    }

    // Mode flex
    if (value.flexType === "thisWeek") {
      return { main: t("datePicker.flexThisWeek") };
    }
    if (value.flexType === "thisMonth") {
      const monthYear = format.dateTime(value.date, {
        month: "long",
        year: "numeric",
      });
      return { main: capitalizeFirst(monthYear, localeTag) };
    }
    // next3Months
    const start = value.rangeStart ?? value.date;
    const end = value.rangeEnd ?? addMonths(start, 3);
    const startMonth = format.dateTime(start, { month: "short" });
    const endMonth = format.dateTime(end, { month: "short", year: "numeric" });
    return {
      main: `${capitalizeFirst(startMonth, localeTag)} → ${capitalizeFirst(endMonth, localeTag)}`,
    };
  }, [value, format, t, localeTag]);

  // ── Calendar config ──

  const showOutsideDays = value?.mode === "flex" && value.flexType !== "thisWeek";

  const flexRangeModifier = useMemo(() => {
    if (value?.mode !== "flex" || !value.rangeStart || !value.rangeEnd) return undefined;
    return { from: value.rangeStart, to: value.rangeEnd };
  }, [value]);

  // ── Render ──

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* ── Trigger ── */}
      {triggerVariant === "enriched" ? (
        <div>
          {showLabel && (
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("fields.date")}
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="dialog"
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900/40"
          >
            <CalendarDays className="shrink-0 text-slate-400" size={18} />
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate font-medium text-slate-900 dark:text-slate-50">
                {triggerContent.main}
              </span>
            </span>
            <ChevronDown
              size={14}
              className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
        >
          <CalendarDays size={16} className="text-slate-400" />
          <span className="font-medium text-slate-900 dark:text-white">{triggerContent.main}</span>
          <ChevronDown
            size={12}
            className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}

      {/* ── Popover ── */}
      {open && (
        <div
          role="dialog"
          aria-label={t("datePicker.selectDate")}
          className="absolute left-0 top-full z-[130] mt-2 w-[400px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950"
        >
          {/* ── Header: Tabs ── */}
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => handleModeChange("exact")}
                className={[
                  "flex-1 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
                  mode === "exact"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                ].join(" ")}
              >
                {t("datePicker.exact")}
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("flex")}
                className={[
                  "flex-1 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
                  mode === "flex"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                ].join(" ")}
              >
                {t("datePicker.flexible")}
              </button>
            </div>
          </div>

          {/* ── Flex chips (only in flex mode) ── */}
          {mode === "flex" && (
            <div className="px-4 pt-3">
              <div className="flex flex-wrap gap-2">
                {(["thisWeek", "thisMonth", "next3Months"] as FlexType[]).map((ft) => {
                  const active = value?.flexType === ft;
                  const label =
                    ft === "thisWeek"
                      ? t("datePicker.flexThisWeek")
                      : ft === "thisMonth"
                        ? t("datePicker.flexThisMonth")
                        : t("datePicker.flexNext3Months");
                  return (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => handleFlexChipClick(ft)}
                      className={[
                        "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                        active
                          ? "border-[#FF9900] bg-[#FF9900] text-slate-950"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Custom calendar header (month nav) ── */}
          <div className="mt-3 flex items-center justify-between px-4">
            <button
              type="button"
              onClick={() => {
                const prev = new Date(displayMonth);
                prev.setMonth(prev.getMonth() - 1);
                setDisplayMonth(prev);
              }}
              aria-label="Previous month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <div className="text-[14px] font-semibold text-slate-900 dark:text-white">
              {capitalizeFirst(
                format.dateTime(displayMonth, { month: "long", year: "numeric" }),
                localeTag
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                const next = new Date(displayMonth);
                next.setMonth(next.getMonth() + 1);
                setDisplayMonth(next);
              }}
              aria-label="Next month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* ── Calendar grid ── */}
          <div className="px-3 pb-2 pt-2">
            <DayPicker
              locale={dfnsLocale}
              mode="single"
              selected={value?.mode === "exact" ? value.date : undefined}
              onSelect={handleDateSelect}
              month={displayMonth}
              onMonthChange={setDisplayMonth}
              disabled={{ before: effectiveMinDate, ...(maxDate ? { after: maxDate } : {}) }}
              modifiers={flexRangeModifier ? { flexRange: flexRangeModifier } : undefined}
              showOutsideDays={showOutsideDays}
              weekStartsOn={weekStartsOn}
              hideNavigation
              classNames={{
                months: "flex flex-col",
                month: "space-y-2",
                month_caption: "hidden",
                nav: "hidden",
                month_grid: "w-full border-collapse",
                weekdays: "grid grid-cols-7",
                weekday:
                  "h-7 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500",
                week: "grid grid-cols-7 gap-0.5 mt-1",
                day: "flex h-9 items-center justify-center p-0",
                day_button:
                  "h-9 w-9 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900]/40",
                selected:
                  "[&>button]:bg-[#FF9900] [&>button]:!text-slate-950 [&>button]:font-bold [&>button]:shadow-sm [&>button:hover]:bg-[#F08700] [&>button:hover]:!text-slate-950 dark:[&>button]:bg-[#FF9900] dark:[&>button]:!text-slate-950",
                today:
                  "[&>button]:font-bold [&>button]:text-[#FF9900] [&>button]:ring-1 [&>button]:ring-[#FF9900]/40 dark:[&>button]:text-[#FFB84D]",
                outside:
                  "[&>button]:text-slate-300 [&>button]:opacity-50 dark:[&>button]:text-slate-700",
                disabled:
                  "[&>button]:text-slate-300 [&>button]:opacity-30 dark:[&>button]:text-slate-700 [&>button]:cursor-not-allowed [&>button:hover]:bg-transparent [&>button:hover]:!text-slate-300 dark:[&>button:hover]:!text-slate-700",
              }}
              modifiersClassNames={{
                flexRange:
                  "[&>button:not([aria-selected='true'])]:bg-[#FFF6E8] [&>button:not([aria-selected='true'])]:text-[#B45309] dark:[&>button:not([aria-selected='true'])]:bg-[#FF9900]/15 dark:[&>button:not([aria-selected='true'])]:text-[#FFB84D]",
              }}
            />
          </div>

          {/* ── Footer actions ── */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
            <button
              type="button"
              onClick={handleClear}
              className="text-[12px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {t("datePicker.clear")}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-[#FF9900] px-5 py-2 text-[13px] font-semibold text-slate-950 transition-colors hover:bg-[#F08700]"
            >
              {t("datePicker.apply")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
