"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, Search } from "lucide-react";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import CityAutocomplete from "./CityAutocomplete";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import Calendar from "@/components/ui/Calendar";

const capitalizeFirst = (s: string, localeTag: string) =>
  s ? s.charAt(0).toLocaleUpperCase(localeTag) + s.slice(1) : s;

type Props = {
  overlap?: boolean;
};

export default function TripSearchBar({ overlap = true }: Props) {
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

    return capitalizeFirst(raw, localeTag);
  }, [date, t, lang]);

  const onSearch = () => {
    console.log({ from, to, date });
  };

  return (
    <section className="mx-auto max-w-6xl px-4 overflow-visible">
      <div className={["relative overflow-visible", overlap ? "-mt-10" : ""].join(" ")}>
        <div className="relative z-[80] overflow-visible rounded-[20px] border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
          <div className="grid gap-3 p-3 md:grid-cols-[1.2fr_1.2fr_0.9fr_auto] md:gap-0 md:p-0">
            {/* FROM */}
            <div className="relative z-[90] px-4 py-3 md:py-4">
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
            <div className="relative z-[90] px-4 py-3 md:py-4">
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
            <div ref={dateRef} className="relative z-[95] px-4 py-3 md:py-4">
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
                <div className="absolute left-0 top-full z-[120] mt-2">
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
                {t("search")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
