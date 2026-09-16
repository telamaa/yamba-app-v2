"use client";

/**
 * MessageReportsQueue.tsx — la file des messages signalés (F-PR3, D61 7A)
 * =========================================================================
 * Les plus anciens d'abord. Deux gestes : « Traité » (le support a agi : rappel à l'ordre,
 * sanction proposée côté Utilisateurs…) ou « Sans suite ». Chaque décision est journalisée
 * avec sa note. Le fil complet se lit depuis la page conversation (lecture journalisée).
 * Recette § 5.19 : un double clic ne part qu'une fois, un refus se dit en français et recharge une file périmée.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, patch } from "@/lib/api";
import { CHAT_ROLE_LABEL, REPORT_REASON_LABEL, REPORT_STATUS_LABEL, dateTime, reportRefusalMessage } from "@/lib/format";
import type { AdminMessageReportItem, AdminMessageReportsResponse, MessageReportStatus } from "@/lib/types";

export default function MessageReportsQueue() {
  const [status, setStatus] = useState<MessageReportStatus>("OPEN");
  const [data, setData] = useState<AdminMessageReportsResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    apiFetch<AdminMessageReportsResponse>(`/admin/conversations/reports?status=${status}`).then((d) => { setData(d); setFailed(false); })
      .catch((e) => { setMsg(reportRefusalMessage(e).text); setFailed(true); }); // recette § 5.19 : un 403 se dit en français, jamais « 403 : … »
  }, [status]);
  useEffect(load, [load]);

  async function review(item: AdminMessageReportItem, decision: "REVIEWED" | "DISMISSED") {
    if (busy) return; // un double clic ne part pas deux fois
    setBusy(item.id);
    try {
      await patch(`/admin/conversations/reports/${item.id}`, { decision, ...(notes[item.id]?.trim() ? { note: notes[item.id].trim() } : {}) });
      setMsg(decision === "REVIEWED" ? "Signalement traité (journalisé)." : "Signalement classé sans suite (journalisé).");
      load();
    } catch (e) {
      const r = reportRefusalMessage(e as { status?: number; data?: unknown });
      setMsg(r.text);
      if (r.reload) load();
    } finally {
      setBusy(null);
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
        !failed && <p className="mt-4 text-[13px] text-slate-500">Chargement…</p>
      ) : data.items.length === 0 ? (
        <p className="mt-4 text-[13px] text-slate-500">Aucun signalement {REPORT_STATUS_LABEL[status]}.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.items.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px] text-slate-500">
                <span>
                  <span className="font-semibold text-red-700">{REPORT_REASON_LABEL[item.reason] ?? item.reason}</span> · signalé par {item.reporter.firstName}
                  {item.reporter.role ? ` (${CHAT_ROLE_LABEL[item.reporter.role]})` : ""} le {dateTime(item.createdAt)}
                </span>
                <span>
                  {item.corridor ? `${item.corridor.originCity} → ${item.corridor.destinationCity}` : "corridor inconnu"}
                </span>
              </div>
              {/* ANO-CRON-09 — dossier dont le message a été purgé : il reste traitable, sans son contenu. */}
              {item.purged ? (
                <p className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">
                  Contenu purgé par la conservation : le message et son fil n'existent plus. Le dossier reste ouvert et peut être clos ici.
                </p>
              ) : (
                <blockquote className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-800">
                  <span className="text-[11.5px] uppercase tracking-wide text-slate-500">
                    {item.author?.firstName} ({item.author ? CHAT_ROLE_LABEL[item.author.role] : "—"}) · {dateTime(item.message.createdAt ?? item.createdAt)}
                  </span>
                  <p className="mt-1 whitespace-pre-wrap">{item.message.body}</p>
                </blockquote>
              )}
              {item.details && <p className="mt-2 text-[12.5px] text-slate-600">Précisions : {item.details}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {item.bookingId && (
                  <Link href={`/conversations/${item.bookingId}`} className="text-[12.5px] font-medium text-[#185FA5] hover:underline">
                    Lire la conversation →
                  </Link>
                )}
                {item.author && (
                  <Link href={`/users/${item.author.id ?? ""}`} className="text-[12.5px] font-medium text-[#185FA5] hover:underline">
                    Fiche de {item.author.firstName} →
                  </Link>
                )}
                {item.status === "OPEN" && (
                  <>
                    <input
                      value={notes[item.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                      placeholder="Note pour le journal (facultatif)"
                      className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-[12.5px]"
                    />
                    <button onClick={() => review(item, "REVIEWED")} disabled={busy !== null} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">
                      Traité
                    </button>
                    <button onClick={() => review(item, "DISMISSED")} disabled={busy !== null} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] disabled:opacity-50">
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
