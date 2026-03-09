"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import CityAutocomplete from "./CityAutocomplete";
import Calendar from "@/components/ui/Calendar";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";

type Screen = null | "edit" | "from" | "to" | "date";

type Props = {
  from: string;
  to: string;
  date?: Date;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onDateChange: (value: Date | undefined) => void;
  onSearch?: () => void;
  mode?: "card" | "summary";
  onOpenFilters?: () => void;
};

const capitalizeFirst = (s: string, localeTag: string) =>
  s ? s.charAt(0).toLocaleUpperCase(localeTag) + s.slice(1) : s;

function SearchRow({
                     label,
                     value,
                     icon,
                     onClick,
                   }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60"
    >
      <span className="shrink-0 text-slate-400 dark:text-slate-500">{icon}</span>

      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {label}
        </span>
        <span className="block truncate text-base font-semibold text-slate-900 dark:text-white">
          {value}
        </span>
      </span>
    </button>
  );
}

export default function MobileSearchExperience({
                                                 from,
                                                 to,
                                                 date,
                                                 onFromChange,
                                                 onToChange,
                                                 onDateChange,
                                                 onSearch,
                                                 mode = "card",
                                                 onOpenFilters,
                                               }: Props) {
  const { t, lang } = useUiPreferences();

  const [screen, setScreen] = useState<Screen>(null);
  const [previousScreen, setPreviousScreen] = useState<Screen>(null);
  const [mounted, setMounted] = useState(false);

  const [fromDraft, setFromDraft] = useState(from);
  const [toDraft, setToDraft] = useState(to);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setFromDraft(from);
  }, [from]);

  useEffect(() => {
    setToDraft(to);
  }, [to]);

  const localeTag = lang === "fr" ? "fr-FR" : "en-US";

  const dateLabel = useMemo(() => {
    if (!date) return t("today");

    const raw = new Intl.DateTimeFormat(localeTag, {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(date);

    return capitalizeFirst(raw, localeTag);
  }, [date, localeTag, t]);

  const searchSummary = useMemo(() => {
    const fromLabel = from || t("from");
    const toLabel = to || t("to");
    return `${fromLabel} → ${toLabel}`;
  }, [from, to, t]);

  const copy = {
    editSearch: lang === "fr" ? "Modifier la recherche" : "Edit search",
    close: lang === "fr" ? "Fermer" : "Close",
    filter: lang === "fr" ? "Filtrer" : "Filter",
    whereFrom: lang === "fr" ? "Départ" : "From",
    whereTo: lang === "fr" ? "Destination" : "To",
    when: lang === "fr" ? "Quand partez-vous ?" : "When are you leaving?",
  };

  const openEdit = () => {
    setPreviousScreen(null);
    setScreen("edit");
  };

  const openField = (next: "from" | "to" | "date") => {
    if (next === "from") setFromDraft(from);
    if (next === "to") setToDraft(to);

    setPreviousScreen(screen === "edit" ? "edit" : null);
    setScreen(next);
  };

  const closeCurrentScreen = () => {
    if (screen === "from" || screen === "to" || screen === "date") {
      setScreen(previousScreen);
      setPreviousScreen(null);
      return;
    }

    setScreen(null);
  };

  const handleFromSelected = (value: string) => {
    onFromChange(value);
    setScreen(previousScreen);
    setPreviousScreen(null);
  };

  const handleToSelected = (value: string) => {
    onToChange(value);
    setScreen(previousScreen);
    setPreviousScreen(null);
  };

  const handleDateSelected = (value: Date | undefined) => {
    onDateChange(value);
    setScreen(previousScreen);
    setPreviousScreen(null);
  };

  const SearchCard = () => (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
      <div>
        <SearchRow
          label={t("from")}
          value={from || t("from")}
          icon={<MapPin size={18} />}
          onClick={() => openField("from")}
        />

        <SearchRow
          label={t("to")}
          value={to || t("to")}
          icon={<MapPin size={18} />}
          onClick={() => openField("to")}
        />

        <SearchRow
          label={t("date")}
          value={dateLabel}
          icon={<CalendarDays size={18} />}
          onClick={() => openField("date")}
        />
      </div>

      <div className="px-4 pb-4 pt-3">
        <button
          type="button"
          onClick={() => {
            onSearch?.();
            setScreen(null);
          }}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF9900] px-6 text-base font-semibold text-slate-900 shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00]"
        >
          <Search size={18} />
          {t("search")}
        </button>
      </div>
    </div>
  );

  const overlayContent = screen ? (
    <div className="fixed inset-0 z-[500] overflow-y-auto bg-white dark:bg-slate-950 md:hidden">
      <div className="px-4 pb-8 pt-4">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={closeCurrentScreen}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 dark:text-slate-400"
            aria-label={copy.close}
          >
            <X size={28} />
          </button>
        </div>

        {screen === "edit" && (
          <div className="space-y-5">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {copy.editSearch}
            </h2>
            <SearchCard />
          </div>
        )}

        {screen === "from" && (
          <div className="space-y-5">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {copy.whereFrom}
            </h2>

            <div className="relative z-[300] overflow-visible rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CityAutocomplete
                value={fromDraft}
                action={setFromDraft}
                onSelect={handleFromSelected}
                placeholder={t("from")}
                language={lang === "fr" ? "fr" : "en"}
                autoFocus
                inputClassName="text-base"
                dropdownInline
              />
            </div>
          </div>
        )}

        {screen === "to" && (
          <div className="space-y-5">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {copy.whereTo}
            </h2>

            <div className="relative z-[300] overflow-visible rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CityAutocomplete
                value={toDraft}
                action={setToDraft}
                onSelect={handleToSelected}
                placeholder={t("to")}
                language={lang === "fr" ? "fr" : "en"}
                autoFocus
                inputClassName="text-base"
                dropdownInline
              />
            </div>
          </div>
        )}

        {screen === "date" && (
          <div className="space-y-5">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {copy.when}
            </h2>

            <Calendar
              lang={lang === "fr" ? "fr" : "en"}
              mode="single"
              selected={date}
              onSelect={handleDateSelected}
            />
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {mode === "card" ? (
        <div className="relative z-[10] md:hidden">
          <SearchCard />
        </div>
      ) : (
        <div className="relative z-[20] flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={openEdit}
            className="min-w-0 flex-1 rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-left shadow-sm dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="flex items-center gap-3">
              <Search className="shrink-0 text-slate-400 dark:text-slate-500" size={18} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {searchSummary}
                </div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {dateLabel}
                </div>
              </div>
            </div>
          </button>

          {onOpenFilters && (
            <button
              type="button"
              onClick={onOpenFilters}
              className="inline-flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <SlidersHorizontal size={18} />
              {copy.filter}
            </button>
          )}
        </div>
      )}

      {mounted && overlayContent ? createPortal(overlayContent, document.body) : null}
    </>
  );
}
