"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";

export default function ConditionsCard() {
  const t = useTranslations("tripDetail");

  return (
    <section>
      <header className="px-5 pt-4 pb-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          {t("conditions.title")}
        </h2>
      </header>

      <div className="space-y-4 px-5 pb-4">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("conditions.cancellation.title")}
          </div>
          <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
            <li className="flex items-start gap-2">
              <Check size={12} className="mt-0.5 shrink-0 text-green-600 dark:text-green-500" />
              <span>{t("conditions.cancellation.full")}</span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={12} className="mt-0.5 shrink-0 text-green-600 dark:text-green-500" />
              <span>{t("conditions.cancellation.half")}</span>
            </li>
            <li className="flex items-start gap-2">
              <X size={12} className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" />
              <span className="text-slate-500 dark:text-slate-400">
                {t("conditions.cancellation.none")}
              </span>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("conditions.prohibited.title")}
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300">
            {t("conditions.prohibited.description")}
          </p>
        </div>
      </div>
    </section>
  );
}
