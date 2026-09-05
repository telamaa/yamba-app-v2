"use client";

/**
 * ReportsQueue.tsx — la file des trajets et membres signalés (D68 3A)
 * ====================================================================
 * Les plus anciens d'abord ; « prioritaire » dès 3 signalements ouverts sur la même cible
 * (SIG-03 : aucune sanction automatique — masquer le trajet ou sanctionner le compte se fait
 * depuis la fiche cible, puis on revient « Traité »). Chaque décision est journalisée avec sa note.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch, patch } from "@/lib/api";
import { REPORT_REASON_LABEL, REPORT_STATUS_LABEL, REPORT_TARGET_LABEL, dateTime } from "@/lib/format";
import type { AdminReportItem, AdminReportsResponse, MessageReportStatus } from "@/lib/types";

export default function ReportsQueue() {
  const [status, setStatus] = useState<MessageReportStatus>("OPEN");
  const [data, setData] = useState<AdminReportsResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    apiFetch<AdminReportsResponse>(`/admin/reports?status=${status}`).then(setData).catch((e) => setMsg(e.message));
  }, [status]);
  useEffect(load, [load]);

  async function review(item: AdminReportItem, decision: "REVIEWED" | "DISMISSED") {
    try {
      await patch(`/admin/reports/${item.id}`, { decision, ...(notes[item.id]?.trim() ? { note: notes[item.id].trim() } : {}) });
      setMsg(decision === "REVIEWED" ? "Signalement traité (journalisé)." : "Signalement classé sans suite (journalisé).");
      load();
    } catch (e) {
      setMsg(e instanceof ApiError ? `${e.status} : ${e.message}` : "Décision impossible.");
    }
  }

  const targetHref = (item: AdminReportItem) => (item.targetType === "TRIP" ? `/trips/${item.targetId}` : `/users/${item.targetId}`);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        {(["OPEN", "REVIEWED", "DISMISSED"] as MessageReportStatus[]).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-lg border px-3 py-1.5 ${status === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}>
            {REPORT_STATUS_LABEL[s]}
          </button>
        ))}
        {data && <span className="text-slate-500">{data.total} signalement{data.total > 1 ? "s" : ""}</span>}
      </div>
      {msg && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-[12.5px] text-slate-700">{msg}</p>}
      {!data ? (
        <p className="mt-4 text-[13px] text-slate-500">Chargement…</p>
      ) : data.items.length === 0 ? (
        <p className="mt-4 text-[13px] text-slate-500">Aucun signalement {REPORT_STATUS_LABEL[status]}.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.items.map((item) => (
            <li key={item.id} className={`rounded-xl border bg-white p-4 ${item.priority ? "border-red-300" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px] text-slate-500">
                <span>
                  {item.priority && <span className="mr-2 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700">Prioritaire · {item.openCountOnTarget} ouverts</span>}
                  <span className="font-semibold text-red-700">{REPORT_REASON_LABEL[item.reason] ?? item.reason}</span> · signalé par {item.reporter.firstName} le {dateTime(item.createdAt)}
                </span>
                <span>{REPORT_TARGET_LABEL[item.targetType]}</span>
              </div>
              <p className="mt-2 text-[13.5px] font-medium text-slate-900">
                <Link href={targetHref(item)} className="text-[#185FA5] hover:underline">
                  {item.targetLabel} →
                </Link>
                {item.targetOwner && (
                  <span className="ml-2 text-[12.5px] font-normal text-slate-500">
                    publié par{" "}
                    <Link href={`/users/${item.targetOwner.id}`} className="text-[#185FA5] hover:underline">
                      {item.targetOwner.firstName}
                    </Link>
                  </span>
                )}
              </p>
              {item.details && <p className="mt-2 text-[12.5px] text-slate-600">Précisions : {item.details}</p>}
              {item.status === "OPEN" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={notes[item.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                    placeholder="Note pour le journal (facultatif)"
                    className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-[12.5px]"
                  />
                  <button onClick={() => review(item, "REVIEWED")} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white">
                    Traité
                  </button>
                  <button onClick={() => review(item, "DISMISSED")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px]">
                    Sans suite
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
