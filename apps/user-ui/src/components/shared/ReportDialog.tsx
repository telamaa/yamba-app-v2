"use client";

/**
 * ReportDialog.tsx — signaler un trajet ou un membre (D68, SIG-01)
 * =================================================================
 * Un motif fermé par cible, des précisions facultatives, un envoi. Visiteur non connecté :
 * la porte de connexion (reporter identifié). Le serveur refuse sa propre cible, le doublon
 * (409) et une cible invisible (404) : le dialogue affiche ces refus tels quels.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Flag, X } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import useUser from "@/hooks/useUser";
import AuthGateModal from "@/components/auth/shared/AuthGateModal";
import { createReport, REPORT_REASONS_BY_TARGET, type ReportReason, type ReportTargetType } from "@/services/report.api";

export type ReportTarget = { type: ReportTargetType; ref: string; label: string };

export default function ReportDialog({ target, onCloseAction }: { target: ReportTarget; onCloseAction: () => void }) {
  const t = useTranslations("common.report");
  const { user } = useUser();
  const pathname = usePathname();
  const reasons = REPORT_REASONS_BY_TARGET[target.type];
  const [reason, setReason] = useState<ReportReason>(reasons[0]);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<{ busy: boolean; done: boolean; error: string | null }>({ busy: false, done: false, error: null });

  if (!user) {
    return <AuthGateModal open onCloseAction={onCloseAction} title={t("gateTitle")} subtitle={t("gateSubtitle")} redirect={pathname || "/"} />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ busy: true, done: false, error: null });
    try {
      await createReport({ targetType: target.type, targetRef: target.ref, reason, details: details.trim() || undefined });
      setState({ busy: false, done: true, error: null });
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setState({ busy: false, done: false, error: status === 409 ? t("already") : status === 400 ? t("ownTarget") : t("failed") });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <h2 id="report-dialog-title" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900 dark:text-white">
            <Flag size={15} className="text-red-600" />
            {t(`title.${target.type}`)}
          </h2>
          <button type="button" onClick={onCloseAction} aria-label={t("cancel")} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>
        <p className="mt-2 truncate rounded-lg bg-slate-100 px-3 py-2 text-[12.5px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">{target.label}</p>

        {state.done ? (
          <>
            <p className="mt-3 text-[13px] text-emerald-700 dark:text-emerald-300">{t("done")}</p>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{t("doneHint")}</p>
            <button type="button" onClick={onCloseAction} className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-[13px] font-semibold text-white dark:bg-white dark:text-slate-900">
              {t("back")}
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-[12.5px] text-slate-500 dark:text-slate-400">{t("intro")}</p>
            <label className="mt-3 block text-[12px] text-slate-600 dark:text-slate-300">
              {t("reason")}
              <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[13px] dark:border-slate-700 dark:bg-slate-900">
                {reasons.map((r) => (
                  <option key={r} value={r}>
                    {t(`reasons.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block text-[12px] text-slate-600 dark:text-slate-300">
              {t("details")}
              <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 500))} rows={2} placeholder={t("detailsPlaceholder")} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[13px] dark:border-slate-700 dark:bg-slate-900" />
            </label>
            {state.error && <p className="mt-2 text-[12.5px] text-red-600">{state.error}</p>}
            <div className="mt-3 flex gap-2">
              <button disabled={state.busy} className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
                {state.busy ? t("sending") : t("submit")}
              </button>
              <button type="button" onClick={onCloseAction} className="rounded-lg border border-slate-300 px-3 py-2 text-[13px] dark:border-slate-700">
                {t("cancel")}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
