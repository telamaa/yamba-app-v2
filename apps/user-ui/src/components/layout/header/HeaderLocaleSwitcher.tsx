// apps/user-ui/src/components/layout/header/HeaderLocaleSwitcher.tsx
"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";

type Props = {
  /** Variante : `header` segmented compact, `inline` plus aéré pour bottom sheet. */
  variant?: "header" | "inline";
};

/**
 * Sélecteur de langue dédié au Header (sans le globe inutile).
 *
 * Aligne FR/EN dans un segmented control compact, qui sert à la fois en
 * desktop (top bar) et en bottom sheet (variante inline plus aérée).
 */
export default function HeaderLocaleSwitcher({ variant = "header" }: Props) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleChange = (newLocale: Locale) => {
    if (newLocale === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  };

  const labels: Record<Locale, { label: string; short: string }> = {
    fr: { label: "Français", short: "FR" },
    en: { label: "English", short: "EN" },
  };

  const trackClass =
    variant === "header"
      ? "flex rounded-full bg-slate-100 p-0.5 dark:bg-slate-900"
      : "flex rounded-full bg-slate-100 p-0.5 dark:bg-slate-900";

  const itemBase =
    variant === "header"
      ? "rounded-full px-3 py-1 text-[12px] font-semibold transition-colors"
      : "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors";

  return (
    <div className={trackClass}>
      {routing.locales.map((loc) => {
        const isActive = loc === locale;
        return (
          <button
            key={loc}
            type="button"
            disabled={isPending}
            onClick={() => handleChange(loc as Locale)}
            aria-label={labels[loc as Locale].label}
            className={`${itemBase} ${
              isActive
                ? "bg-white text-slate-900 shadow-sm dark:bg-white dark:text-slate-900"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            } ${isPending ? "opacity-50" : ""}`}
          >
            {labels[loc as Locale].short}
          </button>
        );
      })}
    </div>
  );
}
