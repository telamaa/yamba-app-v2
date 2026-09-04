"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch, post } from "@/lib/api";
import { TICKET_REASON_LABEL, dateTime } from "@/lib/format";
import type { AdminMe, TicketQueueItem, TicketQueueResponse, TicketRejectionReason } from "@/lib/types";
import ExportButton from "./ExportButton";

export default function TicketsQueue() {
  const [data, setData] = useState<TicketQueueResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // C-PR7a (D60 2A) — filtres serveur + export
  const [f, setF] = useState({ originCity: "", destinationCity: "", olderThanDays: "" });
  const [me, setMe] = useState<AdminMe | null>(null);
  useEffect(() => { apiFetch<AdminMe>("/admin/me").then(setMe).catch(() => undefined); }, []);
  const params = useCallback(() => { const p = new URLSearchParams(); if (f.originCity) p.set("originCity", f.originCity); if (f.destinationCity) p.set("destinationCity", f.destinationCity); if (f.olderThanDays) p.set("olderThanDays", f.olderThanDays); return p; }, [f]);
  const load = useCallback(() => {
    apiFetch<TicketQueueResponse>(`/admin/tickets?${params().toString()}`).then(setData).catch((e) => setMsg(e.message));
  }, [params]);
  useEffect(() => { const h = setTimeout(load, 250); return () => clearTimeout(h); }, [load]);

  async function open(item: TicketQueueItem) {
    try {
      const d = await apiFetch<{ url: string }>(`/admin/tickets/${item.documentId}`);
      window.open(d.url, "_blank", "noopener");
    } catch (e) {
      setMsg(e instanceof ApiError ? `${e.status} : ${e.message}` : "Ouverture impossible.");
    }
  }
  async function review(item: TicketQueueItem, decision: "VERIFY" | "REJECT", reason?: TicketRejectionReason) {
    try {
      await post(`/admin/tickets/${item.documentId}/review`, { decision, ...(reason ? { reason } : {}) });
      setMsg(decision === "VERIFY" ? "Billet vérifié, Voyageur prévenu." : "Billet rejeté, Voyageur prévenu.");
      load();
    } catch (e) {
      setMsg(e instanceof ApiError ? `${e.status} : ${e.message}` : "Décision impossible.");
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <input value={f.originCity} onChange={(e) => setF({ ...f, originCity: e.target.value })} placeholder="origine" className="w-32 rounded-lg border border-slate-300 px-3 py-1.5" />
        <input value={f.destinationCity} onChange={(e) => setF({ ...f, destinationCity: e.target.value })} placeholder="destination" className="w-32 rounded-lg border border-slate-300 px-3 py-1.5" />
        <select value={f.olderThanDays} onChange={(e) => setF({ ...f, olderThanDays: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5"><option value="">tout âge</option><option value="1">déposé il y a + de 1 j</option><option value="3">+ de 3 j</option><option value="7">+ de 7 j</option></select>
        <span className="ml-auto"><ExportButton me={me} path="/admin/tickets/export" params={params()} /></span>
      </div>
      {!data && <p className="mt-4 text-[13px] text-slate-500">Chargement…</p>}
      {data && (<>
      {msg && <p className="mb-2 text-[12.5px] text-slate-600">{msg}</p>}
      {data.expiredNow > 0 && <p className="mb-2 text-[12px] text-slate-400">{data.expiredNow} billet(s) de trajets partis sortis de la file.</p>}
      {data.items.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-[13px] text-slate-500">Rien à vérifier.</p> : (
        <ul className="space-y-2">
          {data.items.map((it) => (
            <li key={it.documentId} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <Link href={`/trips/${it.tripId}`} className="font-semibold underline-offset-2 hover:underline">{it.originCity} → {it.destinationCity}</Link>
                  <span className="ml-2 text-[12.5px] text-slate-500">départ {dateTime(it.departureAt)} · {it.transportMode ?? "—"}</span>
                </div>
                <span className="text-[12.5px]">Voyageur : <Link href={`/users/${it.carrier.id}`} className="underline-offset-2 hover:underline">{it.carrier.firstName} {it.carrier.lastName}</Link> · déposé le {dateTime(it.submittedAt)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={() => open(it)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px]">Ouvrir le billet{it.originalName ? ` (${it.originalName})` : ""}</button>
                <button onClick={() => review(it, "VERIFY")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[12.5px] font-semibold text-white">Valider</button>
                <RejectMenu onReject={(r) => review(it, "REJECT", r)} />
              </div>
            </li>
          ))}
        </ul>
      )}
      </>)}
    </div>
  );
}

function RejectMenu({ onReject }: { onReject: (r: TicketRejectionReason) => void }) {
  const [reason, setReason] = useState<TicketRejectionReason | "">("");
  return (
    <span className="inline-flex items-center gap-1">
      <select value={reason} onChange={(e) => setReason(e.target.value as TicketRejectionReason | "")} className="rounded-lg border border-slate-300 px-2 py-1.5 text-[12.5px]">
        <option value="">Rejeter : motif…</option>
        {(Object.keys(TICKET_REASON_LABEL) as TicketRejectionReason[]).map((r) => <option key={r} value={r}>{TICKET_REASON_LABEL[r]}</option>)}
      </select>
      <button disabled={!reason} onClick={() => reason && onReject(reason)} className="rounded-lg bg-red-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Rejeter</button>
    </span>
  );
}
