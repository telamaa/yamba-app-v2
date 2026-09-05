"use client";

/**
 * MaintenanceBanner.tsx — annonce et lecture seule (C-PR8c, D64 2A)
 * =================================================================
 * Lit `GET /api/maintenance` (public, servi par le gateway) toutes les 60 s. Rouge en lecture seule,
 * ambre pour une annonce à venir ; le message personnalisé de l'admin, dans la langue de la page,
 * complète la phrase traduite.
 */
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import apiClient from "@/lib/api-client";

type PublicMaintenance = { enabled: boolean; message: { fr: string; en: string }; scheduledAt: string | null };

export default function MaintenanceBanner() {
  const t = useTranslations("maintenance");
  const locale = useLocale();
  const [state, setState] = useState<PublicMaintenance | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => apiClient.get<PublicMaintenance>("/maintenance").then((r) => { if (alive) setState(r.data); }).catch(() => undefined);
    load();
    const timer = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  if (!state) return null;
  const scheduled = !state.enabled && state.scheduledAt && new Date(state.scheduledAt).getTime() > Date.now();
  if (!state.enabled && !scheduled) return null;
  const custom = locale === "en" ? state.message.en || state.message.fr : state.message.fr || state.message.en;
  return (
    <div role="status" className={`px-4 py-2 text-center text-[13px] ${state.enabled ? "bg-red-600 text-white" : "bg-amber-400 text-slate-950"}`}>
      {state.enabled ? t("readOnly") : t("scheduled", { date: new Date(state.scheduledAt as string).toLocaleString(locale === "en" ? "en-GB" : "fr-FR", { dateStyle: "medium", timeStyle: "short" }) })}
      {custom ? ` ${custom}` : ""}
    </div>
  );
}
