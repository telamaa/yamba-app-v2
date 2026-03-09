"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { enUS, fr } from "date-fns/locale";

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  lang?: "fr" | "en";
};

export default function Calendar({
                                   className,
                                   classNames,
                                   showOutsideDays = false,
                                   lang = "fr",
                                   ...props
                                 }: CalendarProps) {
  const locale = lang === "fr" ? fr : enUS;

  return (
    <div
      className={cn(
        "rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)]",
        "dark:border-slate-800 dark:bg-slate-950 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
      )}
    >
      <DayPicker
        locale={locale}
        showOutsideDays={showOutsideDays}
        className={cn("w-full", className)}
        classNames={{
          months: "flex flex-col gap-4",
          month: "space-y-4",

          // Ligne du mois avec vraie hauteur pour bien aligner les flèches
          month_caption:
            "relative flex min-h-[56px] items-center justify-center px-16 py-1",

          caption_label:
            "text-[1.05rem] font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-xl",

          // Navigation recentrée verticalement
          nav: "absolute inset-x-8 top-1/4 flex -translate-y-1/2 items-center justify-between",

          // Boutons navigation redesignés
          button_previous: cn(
            "relative -top-8 ml-0 inline-flex h-11 w-11 items-center justify-center rounded-full",
            "border border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.10)] transition-all",
            "hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900",
            "dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200 dark:shadow-[0_8px_20px_rgba(0,0,0,0.30)] dark:hover:bg-slate-800 dark:hover:text-white"
          ),
          button_next: cn(
            "relative -top-8 mr-0 inline-flex h-11 w-11 items-center justify-center rounded-full",
            "border border-slate-200 bg-white/95 text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.10)] transition-all",
            "hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900",
            "dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200 dark:shadow-[0_8px_20px_rgba(0,0,0,0.30)] dark:hover:bg-slate-800 dark:hover:text-white"
          ),

          chevron: "h-[18px] w-[18px]",

          month_grid: "w-full border-collapse",
          weekdays: "grid grid-cols-7 gap-1",
          weekday:
            "h-10 text-center text-[0.78rem] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500",
          week: "mt-1 grid grid-cols-7 gap-1",

          day: "flex h-11 items-center justify-center p-0 text-center",

          day_button: cn(
            "h-11 w-11 rounded-2xl p-0 text-sm font-semibold transition-all",
            "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
            "dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
          ),

          selected: cn(
            "[&>button]:bg-[#FF9900] [&>button]:text-slate-950 [&>button]:shadow-[0_8px_20px_rgba(255,153,0,0.28)]",
            "[&>button:hover]:bg-[#F08700] [&>button:hover]:text-slate-950",
            "dark:[&>button]:bg-[#FF9900] dark:[&>button]:text-slate-950"
          ),

          today: cn(
            "[&>button]:bg-[#FFF6E8] [&>button]:text-slate-900 [&>button]:ring-1 [&>button]:ring-[#FF9900]/30",
            "dark:[&>button]:bg-[#2A1E05] dark:[&>button]:text-white dark:[&>button]:ring-[#FF9900]/40"
          ),

          outside: "text-slate-300 opacity-50 dark:text-slate-700",
          disabled: "text-slate-300 opacity-40 dark:text-slate-700",
          hidden: "invisible",
          ...classNames,
        }}
        components={{
          Chevron: ({ orientation, className }) => {
            if (orientation === "left") {
              return <ArrowLeft className={cn(className, "h-[18px] w-[18px]")} strokeWidth={2.2} />;
            }
            return <ArrowRight className={cn(className, "h-[18px] w-[18px]")} strokeWidth={2.2} />;
          },
        }}
        {...props}
      />
    </div>
  );
}
