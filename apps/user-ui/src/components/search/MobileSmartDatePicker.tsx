"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { enUS, fr } from "date-fns/locale";
import { useTranslations, useFormatter, useLocale } from "next-intl";
import type { DateMode, DateValue, FlexType } from "@/components/ui/SmartDatePicker";

type Props = {
  value: DateValue | null;
  /** Callback déclenché à chaque changement de sélection. Suffixe "Action" requis par Next.js. */
  onChangeAction: (value: DateValue | null) => void;
  /** Mode par défaut à l'ouverture si value est null */
  defaultMode?: DateMode;
  /** Date minimum sélectionnable (par défaut aujourd'hui) */
  minDate?: Date;
  /** Date maximum sélectionnable */
  maxDate?: Date;
};

// ── Helpers (copiés de SmartDatePicker pour cohérence stricte) ──

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
    weekStartsOn === 1 ? (day === 0 ? 6 : day - 1) : day;
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

/**
 * Version mobile du SmartDatePicker.
 *
 * Reproduit fidèlement la logique du desktop :
 *  - Toggle Exact / Flexible
 *  - 3 chips en mode flex (thisWeek / thisMonth / next3Months)
 *  - Calendrier react-day-picker partagé
 *  - Tap sur une date du calendrier → passe en mode exact
 *  - Range surligné en orange clair en mode flex
 *
 * Convention Next.js :
 *  - Le callback `onChangeAction` doit suivre la convention "Action".
 */
export default function MobileSmartDatePicker({
                                                value,
                                                onChangeAction,
                                                defaultMode = "exact",
                                                minDate,
                                                maxDate,
                                              }: Props) {
  const t = useTranslations("common");
  const format = useFormatter();
  const locale = useLocale();
  const localeTag = locale === "fr" ? "fr-FR" : "en-US";
  const dfnsLocale = locale === "fr" ? fr : enUS;
  const weekStartsOn: 0 | 1 = locale === "fr" ? 1 : 0;

  const [mode, setMode] = useState<DateMode>(value?.mode ?? defaultMode);
  const today = useMemo(() => startOfDay(new Date()), []);
  const effectiveMinDate = useMemo(() => minDate ?? today, [minDate, today]);

  const [displayMonth, setDisplayMonth] = useState<Date>(value?.date ?? today);

  useEffect(() => {
    if (value) setMode(value.mode);
  }, [value]);

  // ── Handlers ──

  const handleDateSelect = useCallback(
    (selected: Date | undefined) => {
      if (!selected) return;
      const d = startOfDay(selected);
      onChangeAction({ mode: "exact", date: d });
      setMode("exact");
    },
    [onChangeAction]
  );

  const handleFlexChipClick = useCallback(
    (flexType: FlexType) => {
      const { rangeStart, rangeEnd } = computeFlexRange(
        flexType,
        today,
        weekStartsOn
      );
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
        onChangeAction({ mode: "exact", date: today });
      } else if (newMode === "flex") {
        const { rangeStart, rangeEnd } = computeFlexRange(
          "thisWeek",
          today,
          weekStartsOn
        );
        onChangeAction({
          mode: "flex",
          date: rangeStart,
          flexType: "thisWeek",
          rangeStart,
          rangeEnd,
        });
        setDisplayMonth(rangeStart);
      }
    },
    [value, onChangeAction, today, weekStartsOn]
  );

  // ── Calendar config ──

  const showOutsideDays =
    value?.mode === "flex" && value.flexType !== "thisWeek";

  const flexRangeModifier = useMemo(() => {
    if (value?.mode !== "flex" || !value.rangeStart || !value.rangeEnd)
      return undefined;
    return { from: value.rangeStart, to: value.rangeEnd };
  }, [value]);

  // ── Render ──

  return (
    <div className="px-4 pb-4 pt-3">
      <div className="mb-4 flex gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => handleModeChange("exact")}
          className={[
            "flex-1 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors",
            mode === "exact"
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white"
              : "text-slate-500 dark:text-slate-400",
          ].join(" ")}
        >
          {t("datePicker.exact")}
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("flex")}
          className={[
            "flex-1 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors",
            mode === "flex"
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white"
              : "text-slate-500 dark:text-slate-400",
          ].join(" ")}
        >
          {t("datePicker.flexible")}
        </button>
      </div>

      {mode === "flex" && (
        <div className="mb-4 flex flex-wrap gap-2">
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
                  "rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors",
                  active
                    ? "border-[#FF9900] bg-[#FF9900] text-slate-950"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => {
            const prev = new Date(displayMonth);
            prev.setMonth(prev.getMonth() - 1);
            setDisplayMonth(prev);
          }}
          aria-label="Previous month"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>
        <div className="text-[15px] font-semibold text-slate-900 dark:text-white">
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
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      </div>

      <DayPicker
        locale={dfnsLocale}
        mode="single"
        selected={value?.mode === "exact" ? value.date : undefined}
        onSelect={handleDateSelect}
        month={displayMonth}
        onMonthChange={setDisplayMonth}
        disabled={{
          before: effectiveMinDate,
          ...(maxDate ? { after: maxDate } : {}),
        }}
        modifiers={
          flexRangeModifier ? { flexRange: flexRangeModifier } : undefined
        }
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
            "h-8 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500",
          week: "grid grid-cols-7 gap-1 mt-1",
          day: "flex h-11 items-center justify-center p-0",
          day_button:
            "h-11 w-11 rounded-xl text-[15px] font-medium text-slate-800 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors",
          selected:
            "[&>button]:bg-[#FF9900] [&>button]:!text-slate-950 [&>button]:font-bold [&>button:hover]:bg-[#F08700] [&>button:hover]:!text-slate-950 dark:[&>button]:bg-[#FF9900] dark:[&>button]:!text-slate-950",
          today:
            "[&>button]:font-bold [&>button]:text-[#FF9900] [&>button]:ring-1 [&>button]:ring-[#FF9900]/40 dark:[&>button]:text-[#FFB84D]",
          outside:
            "[&>button]:text-slate-300 [&>button]:opacity-50 dark:[&>button]:text-slate-700",
          disabled:
            "[&>button]:text-slate-300 [&>button]:opacity-30 dark:[&>button]:text-slate-700 [&>button]:cursor-not-allowed [&>button:hover]:bg-transparent",
        }}
        modifiersClassNames={{
          flexRange:
            "[&>button:not([aria-selected='true'])]:bg-[#FFF6E8] [&>button:not([aria-selected='true'])]:text-[#B45309] dark:[&>button:not([aria-selected='true'])]:bg-[#FF9900]/15 dark:[&>button:not([aria-selected='true'])]:text-[#FFB84D]",
        }}
      />
    </div>
  );
}
