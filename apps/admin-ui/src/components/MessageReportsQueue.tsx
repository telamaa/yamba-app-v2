"use client";

/**
 * MessageReportsQueue.tsx — la file des messages signalés (F-PR3, D61 7A)
 * =========================================================================
 * Les plus anciens d'abord. Deux gestes : « Traité » (le support a agi : rappel à l'ordre,
 * sanction proposée côté Utilisateurs…) ou « Sans suite ». Chaque décision est journalisée
 * avec sa note. Le fil complet se lit depuis la page conversation (lecture journalisée).
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch, patch } from "@/lib/api";
import { CHAT_ROLE_LABEL, REPORT_REASON_LABEL, REPORT_STATUS_LABEL, dateTime } from "@/lib/format";
import type { AdminMessageReportItem, AdminMessageReportsResponse, MessageReportStatus } from "@/lib/types";

export default function MessageReportsQueue() {
  const [status, setStatus] = useState<MessageReportStatus>("OPEN");
  const [data, setData] = useState<AdminMessageReportsResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    apiFetch<AdminMessageReportsResponse>(`/admin/conversations/reports?status=${status}`).then(setData).catch((e) => setMsg(e.message));
  }, [status]);
  useEffect(load, [load]);

  async function review(item: AdminMessageReportItem, decision: "REVIEWED" | "DISMISSED") {
    try {
      await patch(`/admin/conversations/reports/${item.id}`, { decision, ...(notes[item.id]?.trim() ? { note: notes[item.id].trim() } : {}) });
      setMsg(decision === "REVIEWED" ? "Signalement traité (journalisé)." : "Signalement classé sans suite (journalisé).");
      load();
    } catch (e) {
      setMsg(e instanceof ApiError ? `${e.status} : ${e.message}` : "Décision impossible.");
    }
  }

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
            <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px] text-slate-500">
                <span>
                  <span className="font-semibold text-red-700">{REPORT_REASON_LABEL[item.reason] ?? item.reason}</span> · signalé par {item.reporter.firstName} ({CHAT_ROLE_LABEL[item.reporter.role]}) le {dateTime(item.createdAt)}
                </span>
                <span>
                  {item.corridor.originCity} → {item.corridor.destinationCity}
                </span>
              </div>
              <blockquote className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-800">
                <span className="text-[11.5px] uppercase tracking-wide text-slate-500">
                  {item.author.firstName} ({CHAT_ROLE_LABEL[item.author.role]}) · {dateTime(item.message.createdAt)}
                </span>
                <p className="mt-1 whitespace-pre-wrap">{item.message.body}</p>
              </blockquote>
              {item.details && <p className="mt-2 text-[12.5px] text-slate-600">Précisions : {item.details}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link href={`/conversations/${item.bookingId}`} className="text-[12.5px] font-medium text-[#185FA5] hover:underline">
                  Lire la conversation →
                </Link>
                <Link href={`/users/${item.author.id ?? ""}`} className="text-[12.5px] font-medium text-[#185FA5] hover:underline">
                  Fiche de {item.author.firstName} →
                </Link>
                {item.status === "OPEN" && (
                  <>
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
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
