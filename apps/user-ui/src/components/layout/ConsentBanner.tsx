"use client";

/**
 * ConsentBanner.tsx — la bannière de mesure d'audience (D66 2A)
 * =============================================================
 * Deux boutons de même poids. Le choix vit dans le navigateur ; un membre connecté le voit aussi
 * écrit sur son compte (ConsentLog COOKIES). Rien ne se charge avant « Accepter ».
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import useUser from "@/hooks/useUser";
import { analyticsConfigured, ensureAnalytics, readConsent, writeConsent, type ConsentChoice } from "@/lib/analytics";
import { updateMyPreferences } from "@/services/privacy.api";

export default function ConsentBanner() {
  const t = useTranslations("consent");
  const { user } = useUser();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!analyticsConfigured()) return;
    const local = readConsent();
    if (local) return;
    // Un membre qui a déjà choisi sur un autre appareil : on reprend son choix sans redemander.
    const remote = (user as { analyticsOptIn?: boolean | null } | undefined)?.analyticsOptIn;
    if (typeof remote === "boolean") { writeConsent(remote ? "granted" : "denied"); if (remote) void ensureAnalytics(); return; }
    setVisible(true);
  }, [user]);
  if (!visible) return null;
  async function choose(choice: ConsentChoice) {
    writeConsent(choice);
    setVisible(false);
    if (choice === "granted") void ensureAnalytics();
    if (user) updateMyPreferences({ analyticsOptIn: choice === "granted" }).catch(() => undefined);
  }
  return (
    <div role="dialog" aria-label={t("title")} className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[14px] font-bold text-slate-900 dark:text-white">{t("title")}</p>
      <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-300">{t("text")} <Link href="/legal/privacy" className="underline">{t("more")}</Link></p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => choose("denied")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] font-medium dark:border-slate-600">{t("refuse")}</button>
        <button type="button" onClick={() => choose("granted")} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-semibold text-white dark:bg-white dark:text-slate-900">{t("accept")}</button>
      </div>
    </div>
  );
}
