"use client";

/**
 * ReportMessageDialog.tsx — signaler un message de l'autre partie (F-PR3, D61 7A)
 * ================================================================================
 * Un motif, des précisions facultatives, un envoi. Le serveur refuse son propre message,
 * un message système et le doublon (409) : le dialogue affiche ces refus tels quels.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Flag, X } from "lucide-react";
import { useReportMessage } from "@/hooks/useMessaging";
import type { ChatMessage } from "./messaging.types";
import type { ReportMessageInput } from "./messaging.api";

const REASONS: ReportMessageInput["reason"][] = ["OFF_PLATFORM", "SCAM", "HARASSMENT", "OTHER"];

export default function ReportMessageDialog({ conversationId, message, onCloseAction }: { conversationId: string; message: ChatMessage; onCloseAction: () => void }) {
  const t = useTranslations("messaging");
  const report = useReportMessage(conversationId);
  const [reason, setReason] = useState<ReportMessageInput["reason"]>("OFF_PLATFORM");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<{ done: boolean; error: string | null }>({ done: false, error: null });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ done: false, error: null });
    try {
      await report.mutateAsync({ messageId: message.id, reason, details: details.trim() || undefined });
      setState({ done: true, error: null });
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setState({ done: false, error: status === 409 ? t("report.already") : t("report.failed") });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <h2 id="report-title" className="flex items-center gap-2 text-[15px] font-semibold text-slate-900 dark:text-white">
            <Flag size={15} className="text-red-600" />
            {t("report.title")}
          </h2>
          <button type="button" onClick={onCloseAction} aria-label={t("cancel")} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>
        <blockquote className="mt-3 max-h-24 overflow-y-auto rounded-lg bg-slate-100 px-3 py-2 text-[12.5px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">{message.body}</blockquote>

        {state.done ? (
          <>
            <p className="mt-3 text-[13px] text-emerald-700 dark:text-emerald-300">{t("report.done")}</p>
            <button type="button" onClick={onCloseAction} className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-[13px] font-semibold text-white dark:bg-white dark:text-slate-900">
              {t("back")}
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-[12.5px] text-slate-500 dark:text-slate-400">{t("report.intro")}</p>
            <label className="mt-3 block text-[12px] text-slate-600 dark:text-slate-300">
              {t("report.reason")}
              <select value={reason} onChange={(e) => setReason(e.target.value as ReportMessageInput["reason"])} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[13px] dark:border-slate-700 dark:bg-slate-900">
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`report.reasons.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block text-[12px] text-slate-600 dark:text-slate-300">
              {t("report.details")}
              <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 500))} rows={2} placeholder={t("report.detailsPlaceholder")} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[13px] dark:border-slate-700 dark:bg-slate-900" />
            </label>
            {state.error && <p className="mt-2 text-[12.5px] text-red-600">{state.error}</p>}
            <div className="mt-3 flex gap-2">
              <button disabled={report.isPending} className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
                {report.isPending ? t("report.sending") : t("report.submit")}
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
