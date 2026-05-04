"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeftRight,
  CalendarDays,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslations, useFormatter, useLocale } from "next-intl";
import { useBottomSheet } from "@/hooks/useBottomSheet";
import type { DateValue } from "@/components/ui/SmartDatePicker";
import CityAutocomplete from "@/components/search/CityAutocomplete";
import MobileFieldFullScreen from "@/components/search/MobileFieldFullScreen";
import MobileSmartDatePicker from "@/components/search/MobileSmartDatePicker";

type Props = {
  from: string;
  to: string;
  /** Valeur date complète (Exact ou Flex). Utilisé sur mobile pour préserver le mode. */
  dateValue: DateValue | null;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onDateValueChange: (value: DateValue | null) => void;
  onSearch?: () => void;
  /** "card" : version standalone (homepage). "summary" : version compacte sticky avec bouton Filter. */
  mode?: "card" | "summary";
  onOpenFilters?: () => void;
  /** Nombre de résultats correspondant à la recherche actuelle (pour le live counter sur le CTA) */
  resultsCount?: number;
};

const capitalizeFirst = (s: string, localeTag: string) =>
  s ? s.charAt(0).toLocaleUpperCase(localeTag) + s.slice(1) : s;

export default function MobileSearchExperience({
                                                 from,
                                                 to,
                                                 dateValue,
                                                 onFromChange,
                                                 onToChange,
                                                 onDateValueChange,
                                                 onSearch,
                                                 mode = "card",
                                                 onOpenFilters,
                                                 resultsCount,
                                               }: Props) {
  const tCommon = useTranslations("common");
  const tSearch = useTranslations("search");
  const format = useFormatter();
  const locale = useLocale();
  const isFr = locale === "fr";
  const localeTag = isFr ? "fr-FR" : "en-US";

  const sheet = useBottomSheet();
  const [activeField, setActiveField] = useState<"from" | "to" | "date" | null>(
    null
  );
  const [mounted, setMounted] = useState(false);

  const [fromDraft, setFromDraft] = useState(from);
  const [toDraft, setToDraft] = useState(to);
  const [dateDraft, setDateDraft] = useState<DateValue | null>(dateValue);

  useEffect(() => setMounted(true), []);
  useEffect(() => setFromDraft(from), [from]);
  useEffect(() => setToDraft(to), [to]);
  useEffect(() => setDateDraft(dateValue), [dateValue]);

  const dateLabel = useMemo(() => {
    if (!dateValue) return tCommon("datePicker.selectDate");

    if (dateValue.mode === "exact") {
      const raw = format.dateTime(dateValue.date, {
        weekday: "short",
        day: "2-digit",
        month: "short",
      });
      return capitalizeFirst(raw, localeTag);
    }

    if (dateValue.flexType === "thisWeek") {
      return tCommon("datePicker.flexThisWeek");
    }
    if (dateValue.flexType === "thisMonth") {
      const raw = format.dateTime(dateValue.date, {
        month: "long",
        year: "numeric",
      });
      return capitalizeFirst(raw, localeTag);
    }
    const start = dateValue.rangeStart ?? dateValue.date;
    const end = dateValue.rangeEnd ?? dateValue.date;
    const startMonth = format.dateTime(start, { month: "short" });
    const endMonth = format.dateTime(end, { month: "short", year: "numeric" });
    return `${capitalizeFirst(startMonth, localeTag)} → ${capitalizeFirst(endMonth, localeTag)}`;
  }, [dateValue, format, tCommon, localeTag]);

  const summaryRoute = useMemo(() => {
    const fromLabel = from || tCommon("fields.from");
    const toLabel = to || tCommon("fields.to");
    return `${fromLabel} → ${toLabel}`;
  }, [from, to, tCommon]);

  const ctaLabel = useMemo(() => {
    if (typeof resultsCount === "number" && resultsCount > 0) {
      return tSearch("viewTrips", { count: resultsCount });
    }
    return tCommon("actions.search");
  }, [resultsCount, tCommon, tSearch]);

  const openSheet = () => {
    setFromDraft(from);
    setToDraft(to);
    setDateDraft(dateValue);
    sheet.open();
  };

  const closeSheet = () => {
    sheet.close();
    setActiveField(null);
  };

  const handleSwap = () => {
    const tmpFrom = fromDraft;
    setFromDraft(toDraft);
    setToDraft(tmpFrom);
    onFromChange(toDraft);
    onToChange(tmpFrom);
  };

  const handleClearAll = () => {
    setFromDraft("");
    setToDraft("");
    setDateDraft(null);
    onFromChange("");
    onToChange("");
    onDateValueChange(null);
  };

  const handleApply = () => {
    onSearch?.();
    closeSheet();
  };

  const handleFromSelected = (value: string) => {
    setFromDraft(value);
    onFromChange(value);
    setActiveField(null);
  };
  const handleToSelected = (value: string) => {
    setToDraft(value);
    onToChange(value);
    setActiveField(null);
  };
  const handleDateConfirm = () => {
    onDateValueChange(dateDraft);
    setActiveField(null);
  };

  const sheetContent = (
    <>
      <div
        onClick={closeSheet}
        className="fixed inset-0 z-[480] bg-slate-950/55 transition-opacity duration-300 md:hidden"
        style={{
          opacity: sheet.isOpen ? 1 : 0,
          pointerEvents: sheet.isOpen ? "auto" : "none",
        }}
        aria-hidden
      />

      <div
        className="fixed inset-x-0 bottom-0 z-[490] flex flex-col bg-white dark:bg-slate-950 md:hidden"
        style={{
          transform: sheet.isOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 400ms cubic-bezier(0.16, 1, 0.3, 1)",
          borderRadius: "24px 24px 0 0",
          maxHeight: "92dvh",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={tSearch("mobile.editSearch")}
      >
        <div className="flex shrink-0 justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-1">
          <button
            type="button"
            onClick={closeSheet}
            className="text-[14px] font-medium text-slate-600 dark:text-slate-400"
          >
            {tCommon("actions.cancel")}
          </button>
          <div className="text-[15px] font-semibold text-slate-900 dark:text-white">
            {tSearch("mobile.editSearch")}
          </div>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[14px] font-semibold text-[#FF9900]"
          >
            {tSearch("filters.clearAll")}
          </button>
        </div>

        <div className="px-4 pb-4 pt-2">
          <div className="relative overflow-visible rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <FieldRow
              label={tCommon("fields.from")}
              value={from}
              placeholder={tCommon("placeholders.cityFrom")}
              iconBg="bg-slate-100 dark:bg-slate-800"
              iconColor="text-slate-500 dark:text-slate-400"
              onClick={() => setActiveField("from")}
            />

            <div className="h-px bg-slate-100 dark:bg-slate-800/60" />

            <div className="absolute right-4 top-[60px] z-10 -translate-y-1/2">
              <button
                type="button"
                onClick={handleSwap}
                aria-label={tCommon("actions.swap")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:border-[#FF9900] hover:text-[#FF9900] active:scale-95 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
              >
                <ArrowLeftRight size={14} strokeWidth={2.2} />
              </button>
            </div>

            <FieldRow
              label={tCommon("fields.to")}
              value={to}
              placeholder={tCommon("placeholders.cityTo")}
              iconBg="bg-[#FFEDD5] dark:bg-[#FF9900]/20"
              iconColor="text-[#9A3412] dark:text-[#FFB84D]"
              onClick={() => setActiveField("to")}
            />

            <div className="h-px bg-slate-100 dark:bg-slate-800/60" />

            <FieldRow
              label={tCommon("fields.date")}
              value={dateValue ? dateLabel : ""}
              placeholder={tCommon("datePicker.selectDate")}
              iconBg="bg-slate-100 dark:bg-slate-800"
              iconColor="text-slate-500 dark:text-slate-400"
              icon={<CalendarDays size={14} strokeWidth={2.2} />}
              onClick={() => setActiveField("date")}
            />
          </div>
        </div>

        <div
          className="shrink-0 border-t border-slate-100 bg-white px-4 dark:border-slate-800/60 dark:bg-slate-950"
          style={{
            paddingTop: 12,
            paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          }}
        >
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF9900] px-6 text-[15px] font-semibold text-slate-950 transition-colors hover:bg-[#F08700] active:bg-[#E07A00]"
          >
            <Search size={16} strokeWidth={2.4} />
            {ctaLabel}
          </button>
        </div>
      </div>

      <MobileFieldFullScreen
        isOpen={activeField === "from"}
        title={tCommon("fields.from")}
        onBack={() => setActiveField(null)}
        inputSlot={
          <CityAutocomplete
            value={fromDraft}
            action={setFromDraft}
            onSelect={handleFromSelected}
            placeholder={tCommon("placeholders.cityFrom")}
            language={isFr ? "fr" : "en"}
            autoFocus
            inputClassName="text-[15px]"
            dropdownInline
          />
        }
      >
        <div />
      </MobileFieldFullScreen>

      <MobileFieldFullScreen
        isOpen={activeField === "to"}
        title={tCommon("fields.to")}
        onBack={() => setActiveField(null)}
        inputSlot={
          <CityAutocomplete
            value={toDraft}
            action={setToDraft}
            onSelect={handleToSelected}
            placeholder={tCommon("placeholders.cityTo")}
            language={isFr ? "fr" : "en"}
            autoFocus
            inputClassName="text-[15px]"
            dropdownInline
          />
        }
      >
        <div />
      </MobileFieldFullScreen>

      <MobileFieldFullScreen
        isOpen={activeField === "date"}
        title={tSearch("mobile.whenLeaving")}
        onBack={() => setActiveField(null)}
        bottomSlot={
          <button
            type="button"
            onClick={handleDateConfirm}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#FF9900] px-6 text-[15px] font-semibold text-slate-950 transition-colors hover:bg-[#F08700]"
          >
            {tCommon("datePicker.apply")}
          </button>
        }
      >
        <MobileSmartDatePicker
          value={dateDraft}
          onChangeAction={setDateDraft}
        />
      </MobileFieldFullScreen>
    </>
  );

  if (mode === "card") {
    return (
      <>
        <div className="md:hidden">
          <SearchCard
            from={from}
            to={to}
            dateLabel={dateValue ? dateLabel : null}
            onClick={openSheet}
            tCommon={tCommon}
            tSearch={tSearch}
          />
        </div>
        {mounted && createPortal(sheetContent, document.body)}
      </>
    );
  }

  return (
    <>
      <div className="relative z-[20] flex items-center gap-2 md:hidden">
        <button
          type="button"
          onClick={openSheet}
          className="min-w-0 flex-1 rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-left shadow-sm dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="flex items-center gap-3">
            <Search
              size={18}
              className="shrink-0 text-slate-400 dark:text-slate-500"
            />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold text-slate-900 dark:text-white">
                {summaryRoute}
              </div>
              <div className="truncate text-[12px] text-slate-500 dark:text-slate-400">
                {dateValue ? dateLabel : tCommon("datePicker.selectDate")}
              </div>
            </div>
          </div>
        </button>

        {onOpenFilters && (
          <button
            type="button"
            onClick={onOpenFilters}
            className="inline-flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          >
            <SlidersHorizontal size={18} />
            {tSearch("filters.title")}
          </button>
        )}
      </div>

      {mounted && createPortal(sheetContent, document.body)}
    </>
  );
}

// ── Sub-components ──

function FieldRow({
                    label,
                    value,
                    placeholder,
                    iconBg,
                    iconColor,
                    icon,
                    onClick,
                  }: {
  label: string;
  value: string;
  placeholder: string;
  iconBg: string;
  iconColor: string;
  /** Icône custom (par défaut MapPin pour From/To) */
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  const displayedIcon = icon ?? <MapPin size={14} strokeWidth={2.2} />;
  const displayedValue = value || placeholder;
  const isPlaceholder = !value;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/40"
    >
      <span
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          iconBg,
          iconColor,
        ].join(" ")}
      >
        {displayedIcon}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {label}
        </span>
        <span
          className={[
            "truncate text-[15px] font-semibold leading-tight",
            isPlaceholder
              ? "text-slate-400 dark:text-slate-500"
              : "text-slate-900 dark:text-white",
          ].join(" ")}
        >
          {displayedValue}
        </span>
      </span>
    </button>
  );
}

function SearchCard({
                      from,
                      to,
                      dateLabel,
                      onClick,
                      tCommon,
                      tSearch,
                    }: {
  from: string;
  to: string;
  dateLabel: string | null;
  onClick: () => void;
  tCommon: ReturnType<typeof useTranslations>;
  tSearch: ReturnType<typeof useTranslations>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full overflow-hidden rounded-[24px] border border-slate-200 bg-white text-left shadow-md dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <MapPin size={16} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {tCommon("fields.from")}
          </div>
          <div
            className={[
              "truncate text-[15px] font-semibold leading-tight",
              from ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500",
            ].join(" ")}
          >
            {from || tCommon("placeholders.cityFrom")}
          </div>
        </div>
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800/60" />

      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFEDD5] text-[#9A3412] dark:bg-[#FF9900]/20 dark:text-[#FFB84D]">
          <MapPin size={16} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {tCommon("fields.to")}
          </div>
          <div
            className={[
              "truncate text-[15px] font-semibold leading-tight",
              to ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500",
            ].join(" ")}
          >
            {to || tCommon("placeholders.cityTo")}
          </div>
        </div>
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800/60" />

      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <CalendarDays size={16} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {tCommon("fields.date")}
          </div>
          <div
            className={[
              "truncate text-[15px] font-semibold leading-tight",
              dateLabel ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500",
            ].join(" ")}
          >
            {dateLabel ?? tCommon("datePicker.selectDate")}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-2">
        <div className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF9900] text-[15px] font-semibold text-slate-950">
          <Search size={16} strokeWidth={2.4} />
          {tCommon("actions.search")}
        </div>
      </div>
    </button>
  );
}
