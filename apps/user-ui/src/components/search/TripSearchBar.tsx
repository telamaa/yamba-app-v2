"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, Search } from "lucide-react";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import CityAutocomplete from "./CityAutocomplete";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import Calendar from "@/components/ui/Calendar";

const capitalizeFirst = (s: string, localeTag: string) =>
  s ? s.charAt(0).toLocaleUpperCase(localeTag) + s.slice(1) : s;

export default function TripSearchBar() {
  const { t, lang } = useUiPreferences();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [dateOpen, setDateOpen] = useState(false);

  const dateRef = useRef<HTMLDivElement | null>(null);
  useOnClickOutside(dateRef, () => setDateOpen(false), dateOpen);

  const dateLabel = useMemo(() => {
    if (!date) return t("today");

    const localeTag = lang === "fr" ? "fr-FR" : "en-US";
    const raw = new Intl.DateTimeFormat(localeTag, {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(date);

    // ex: "Sam. 14 mars" -> "Sam. 14 mars" / EN -> "Sat, Feb 14"
    return capitalizeFirst(raw, localeTag);
  }, [date, t, lang]);

  const onSearch = () => {
    // UI only
    console.log({ from, to, date });
  };

  return (
    <section className="mx-auto max-w-6xl px-4">
      <div className="relative -mt-10">
        <div className="relative z-30 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
          <div className="grid gap-3 p-3 md:grid-cols-[1.2fr_1.2fr_0.9fr_auto] md:gap-0 md:p-0">
            {/* FROM */}
            <div className="rounded-xl bg-white px-4 py-3 dark:bg-slate-950 md:rounded-none md:py-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t("from")}
              </div>
              <div className="mt-1">
                <CityAutocomplete
                  value={from}
                  action={setFrom}
                  placeholder={t("from")}
                  language={lang === "fr" ? "fr" : "en"}
                />
              </div>
            </div>

            {/* TO */}
            <div className="rounded-xl bg-white px-4 py-3 dark:bg-slate-950 md:rounded-none md:py-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t("to")}
              </div>
              <div className="mt-1">
                <CityAutocomplete
                  value={to}
                  action={setTo}
                  placeholder={t("to")}
                  language={lang === "fr" ? "fr" : "en"}
                />
              </div>
            </div>

            {/* DATE */}
            <div
              ref={dateRef}
              className="relative rounded-xl bg-white px-4 py-3 dark:bg-slate-950 md:rounded-none md:py-4"
            >
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t("date")}
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
                <div className="absolute left-0 top-20 z-[200] mt-2">
                  <Calendar
                    lang={lang === "fr" ? "fr" : "en"}
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

            {/* SEARCH */}
            <div className="flex items-center justify-end md:px-3 md:py-3">
              <button
                type="button"
                onClick={onSearch}
                className={[
                  "inline-flex items-center justify-center gap-2",
                  "rounded-xl bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-700",
                  "h-10 px-6 text-sm font-semibold",
                  "w-full md:w-auto",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
                ].join(" ")}
              >
                <Search size={18} />
                {t("search")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
