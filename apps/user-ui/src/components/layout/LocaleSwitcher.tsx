"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { Globe } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";

/**
 * Sélecteur de langue qui met à jour l'URL
 * Exemple : /fr/dashboard → /en/dashboard
 */
export default function LocaleSwitcher() {
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

  return (
    <div className="relative inline-flex items-center">
      <Globe size={16} className="mr-2 text-slate-500 dark:text-slate-400" />
      <div className="flex items-center gap-1 rounded-full border border-slate-200 p-0.5 dark:border-slate-700">
        {routing.locales.map((loc) => {
          const isActive = loc === locale;
          return (
            <button
              key={loc}
              type="button"
              disabled={isPending}
              onClick={() => handleChange(loc as Locale)}
              className={[
                "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                isPending ? "opacity-50" : "",
              ].join(" ")}
              aria-label={labels[loc as Locale].label}
            >
              {labels[loc as Locale].short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
