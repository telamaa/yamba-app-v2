"use client";

import * as React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { fr, enUS } from "date-fns/locale";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Lang = "fr" | "en";

/**
 * ✅ IMPORTANT:
 * DayPickerProps est une union (single/range/multiple/default).
 * Omit<T, K> casse l'union si on l'applique directement.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends any ? Omit<T, K> : never;

type Props = DistributiveOmit<DayPickerProps, "locale" | "weekStartsOn"> & {
  lang?: Lang;
  className?: string;
};

function cap(s: string, localeTag: string) {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase(localeTag) + s.slice(1);
}

export default function Calendar({ lang = "fr", className, ...rest }: Props) {
  const locale = lang === "fr" ? fr : enUS;
  const localeTag = lang === "fr" ? "fr-FR" : "en-US";

  const mergedComponents = {
    ...(rest.components ?? {}),
    Chevron: ({ orientation, className: cn }: { orientation?: string; className?: string }) =>
      orientation === "left" ? (
        <ChevronLeft size={18} className={cn} />
      ) : (
        <ChevronRight size={18} className={cn} />
      ),
  };

  const baseClassNames: DayPickerProps["classNames"] = {
    months: "flex justify-center",
    month: "space-y-4",

    caption: "relative flex items-center justify-center",
    caption_label: "text-lg font-extrabold tracking-tight text-slate-900 dark:text-white",
    nav: "absolute inset-x-0 flex items-center justify-between",
    nav_button: "h-9 w-9 rounded-full grid place-items-center transition-colors select-none",
    nav_button_previous: "text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-900/60",
    nav_button_next: "text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-900/60",

    head_row: "flex justify-between px-1",
    head_cell: "w-10 text-center text-[15px] font-bold text-slate-700 dark:text-slate-200",

    table: "w-full border-collapse",
    row: "flex justify-between",
    cell: "w-10 h-10 p-0 grid place-items-center",

    // v9 : day_button est le bouton réel -> hover/selected bien centré
    day: "w-10 h-10",
    day_button:
      "w-10 h-10 rounded-full grid place-items-center text-[15px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors",

    day_today: "ring-2 ring-blue-200 dark:ring-blue-500/30",
    day_selected: "bg-blue-600 text-white hover:bg-blue-600 dark:bg-blue-600 dark:text-white",
    day_outside: "text-slate-300 dark:text-slate-700",
    day_disabled: "opacity-40",
  };

  const mergedClassNames = { ...baseClassNames, ...(rest.classNames ?? {}) };

  return (
    <div
      className={[
        "w-[360px] max-w-[calc(100vw-24px)]",
        "rounded-2xl border border-slate-200 bg-white shadow-xl",
        "dark:border-slate-800 dark:bg-slate-950",
        "p-4",
        // police plus clean (utilise celle du layout si tu as next/font)
        "font-sans",
        className ?? "",
      ].join(" ")}
    >
      <DayPicker
        {...rest}
        locale={locale}
        weekStartsOn={lang === "fr" ? 1 : 0}
        showOutsideDays={false}
        components={mergedComponents as any}
        classNames={mergedClassNames}
        formatters={{
          formatCaption: (month) => cap(format(month, "LLLL", { locale }), localeTag),
          formatWeekdayName: (day) => cap(format(day, "EEE", { locale }).replace(".", ""), localeTag),
          ...(rest.formatters ?? {}),
        }}
      />
    </div>
  );
}
