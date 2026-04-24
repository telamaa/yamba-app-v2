"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, Search } from "lucide-react";
import { useTranslations, useFormatter, useLocale } from "next-intl";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { usePersistedFormState } from "@/hooks/usePersistedFormState";
import CityAutocomplete from "./CityAutocomplete";
import Calendar from "@/components/ui/Calendar";
import MobileSearchExperience from "./MobileSearchExperience";

const capitalizeFirst = (s: string, localeTag: string) =>
  s ? s.charAt(0).toLocaleUpperCase(localeTag) + s.slice(1) : s;

type Props = {
  overlap?: boolean;
};

type SearchDraft = {
  from: string;
  to: string;
  // Date stockée en ISO string (sérialisable en JSON)
  dateIso: string | null;
};

const initialSearchDraft: SearchDraft = {
  from: "",
  to: "",
  dateIso: null,
};

const SEARCH_VERSION = 1;

export default function TripSearchBar({ overlap = true }: Props) {
  const t = useTranslations("common");
  const format = useFormatter();
  const locale = useLocale();

  // ── Persistance du draft de recherche ──
  const [draft, setDraft] = usePersistedFormState<SearchDraft>(
    "trip-search",
    initialSearchDraft,
    { version: SEARCH_VERSION }
  );

  // Convertir ISO string → Date pour l'UI
  const date = useMemo(
    () => (draft.dateIso ? new Date(draft.dateIso) : undefined),
    [draft.dateIso]
  );

  const [dateOpen, setDateOpen] = useState(false);
  const dateRef = useRef<HTMLDivElement | null>(null);
  useOnClickOutside(dateRef, () => setDateOpen(false), dateOpen);

  // Setters adaptés
  const setFrom = (v: string) => setDraft((d) => ({ ...d, from: v }));
  const setTo = (v: string) => setDraft((d) => ({ ...d, to: v }));
  const setDate = (d: Date | undefined) =>
    setDraft((prev) => ({ ...prev, dateIso: d ? d.toISOString() : null }));

  const dateLabel = useMemo(() => {
    if (!date) return t("fields.today");
    const localeTag = locale === "fr" ? "fr-FR" : "en-US";
    const raw = format.dateTime(date, {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
    return capitalizeFirst(raw, localeTag);
  }, [date, t, format, locale]);

  const onSearch = () => {
    console.log({ from: draft.from, to: draft.to, date });
  };

  return (
    <section className="mx-auto max-w-7xl overflow-visible px-4">
      <div className="md:hidden">
        <MobileSearchExperience
          mode="card"
          from={draft.from}
          to={draft.to}
          date={date}
          onFromChange={setFrom}
          onToChange={setTo}
          onDateChange={setDate}
          onSearch={onSearch}
        />
      </div>

      <div className="hidden md:block">
        <div className={["relative overflow-visible", overlap ? "-mt-10" : ""].join(" ")}>
          <div className="relative z-[80] overflow-visible rounded-[12px] border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
            <div className="grid gap-3 p-3 md:grid-cols-[1.2fr_1.2fr_0.9fr_auto] md:gap-0 md:p-0">
              <div className="relative z-[90] px-4 py-3 md:py-4">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t("fields.from")}
                </div>
                <div className="mt-1">
                  <CityAutocomplete
                    value={draft.from}
                    action={setFrom}
                    placeholder={t("fields.from")}
                    language={locale === "fr" ? "fr" : "en"}
                  />
                </div>
              </div>

              <div className="relative z-[90] px-4 py-3 md:py-4">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t("fields.to")}
                </div>
                <div className="mt-1">
                  <CityAutocomplete
                    value={draft.to}
                    action={setTo}
                    placeholder={t("fields.to")}
                    language={locale === "fr" ? "fr" : "en"}
                  />
                </div>
              </div>

              <div ref={dateRef} className="relative z-[95] px-4 py-3 md:py-4">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t("fields.date")}
                </div>

                <button
                  type="button"
                  onClick={() => setDateOpen((v) => !v)}
                  aria-expanded={dateOpen}
                  className="mt-1 flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900/40"
                >
                  <CalendarDays className="text-slate-400" size={18} />
                  <span className="text-slate-900 dark:text-slate-50">{dateLabel}</span>
                </button>

                {dateOpen && (
                  <div className="absolute left-0 top-full z-[120] mt-2">
                    <Calendar
                      lang={locale === "fr" ? "fr" : "en"}
                      mode="single"
                      selected={date}
                      onSelect={(d) => {
                        setDate(d);
                        setDateOpen(false);
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="relative z-[90] flex items-center justify-end md:px-3 md:py-3">
                <button
                  type="button"
                  onClick={onSearch}
                  className={[
                    "inline-flex items-center justify-center gap-2",
                    "rounded-xl bg-[#FF9900] text-slate-900 shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00]",
                    "h-10 px-6 text-sm font-semibold",
                    "w-full md:w-auto",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900]/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
                  ].join(" ")}
                >
                  <Search size={18} />
                  {t("actions.search")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
