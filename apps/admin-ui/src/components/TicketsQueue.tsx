"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch, post } from "@/lib/api";
import { DOCUMENT_MIME_LABEL, TICKET_REASON_LABEL, TRANSPORT_MODE_LABEL, dateTime } from "@/lib/format";
import type { AdminMe, TicketQueueItem, TicketQueueResponse, TicketRejectionReason } from "@/lib/types";
import ExportButton from "./ExportButton";
import { isPermissionRefusal, useDenyPage } from "./PageAccess";

/**
 * Recette § 5.8 — un refus se dit dans les mots de l'écran, et dit la suite. `reload` : la file affichée est périmée
 * (un autre administrateur a traité le billet, le Voyageur l'a supprimé, le trajet est parti ou annulé).
 */
const REFUS: Record<string, { text: string; reload: boolean }> = {
  TICKET_ALREADY_REVIEWED: { text: "Ce billet vient d'être traité par un autre administrateur : la file est rechargée.", reload: true },
  ADMIN_IS_OWNER: { text: "C'est ton propre trajet : un autre administrateur vérifie ce billet.", reload: false },
  TICKET_TRIP_DEPARTED: { text: "Ce trajet est parti : le billet n'a plus rien à prouver, il sort de la file.", reload: true },
  TICKET_TRIP_CLOSED: { text: "Ce trajet est annulé, terminé ou supprimé : le billet sort de la file.", reload: true },
  TICKET_NOT_FOUND: { text: "Ce billet n'existe plus (supprimé par le Voyageur ?) : la file est rechargée.", reload: true },
  DOCUMENT_NOT_FOUND: { text: "Ce billet n'existe plus (supprimé par le Voyageur ?) : la file est rechargée.", reload: true },
  ADMIN_PERMISSION_DENIED: { text: "Ton profil ne vérifie pas les billets.", reload: false },
};
function refus(e: unknown, defaut: string): { text: string; reload: boolean } {
  if (!(e instanceof ApiError)) return { text: defaut, reload: false };
  const code = (e.data as { details?: { code?: string } } | undefined)?.details?.code;
  return (code ? REFUS[code] : undefined) ?? { text: `${e.status} : ${e.message}`, reload: false };
}

export default function TicketsQueue() {
  const [data, setData] = useState<TicketQueueResponse | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const deny = useDenyPage(); // décision du 15/09 : un refus de permission remplace la page entière
  // C-PR7a (D60 2A) — filtres serveur + export
  const [f, setF] = useState({ originCity: "", destinationCity: "", olderThanDays: "" });
  const [me, setMe] = useState<AdminMe | null>(null);
  useEffect(() => { apiFetch<AdminMe>("/admin/me").then(setMe).catch(() => undefined); }, []);
  const params = useCallback(() => { const p = new URLSearchParams(); if (f.originCity) p.set("originCity", f.originCity); if (f.destinationCity) p.set("destinationCity", f.destinationCity); if (f.olderThanDays) p.set("olderThanDays", f.olderThanDays); return p; }, [f]);
  const load = useCallback(() => {
    apiFetch<TicketQueueResponse>(`/admin/tickets?${params().toString()}`).then(setData).catch((e) => (isPermissionRefusal(e) ? deny("Ton profil ne vérifie pas les billets.") : setMsg({ tone: "err", text: refus(e, "Chargement impossible.").text })));
  }, [params]);
  useEffect(() => { const h = setTimeout(load, 250); return () => clearTimeout(h); }, [load]);

  async function open(item: TicketQueueItem) {
    try {
      const d = await apiFetch<{ url: string }>(`/admin/tickets/${item.documentId}`);
      window.open(d.url, "_blank", "noopener");
    } catch (e) {
      const r = refus(e, "Ouverture impossible.");
      setMsg({ tone: "err", text: r.text });
      if (r.reload) load();
    }
  }
  async function review(item: TicketQueueItem, decision: "VERIFY" | "REJECT", reason?: TicketRejectionReason) {
    if (busy) return; // un double clic ne part pas deux fois
    setBusy(item.documentId);
    try {
      await post(`/admin/tickets/${item.documentId}/review`, { decision, ...(reason ? { reason } : {}) });
      setMsg({ tone: "ok", text: decision === "VERIFY" ? "Billet vérifié, Voyageur prévenu." : `Billet rejeté (motif : ${reason ? TICKET_REASON_LABEL[reason] : "—"}), Voyageur prévenu.` });
      load();
    } catch (e) {
      const r = refus(e, "Décision impossible.");
      setMsg({ tone: "err", text: r.text });
      if (r.reload) load();
    } finally {
      setBusy(null);
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
      {/* Recette § 5.8 — le message vit hors du chargement : un refus au premier appel n'était jamais affiché. */}
      {msg && <p role="status" className={`mt-3 mb-2 text-[12.5px] ${msg.tone === "err" ? "text-red-700" : "text-emerald-800"}`}>{msg.text}</p>}
      {!data && <p className="mt-4 text-[13px] text-slate-500">Chargement…</p>}
      {data && (<>
      {data.expiredNow > 0 && <p className="mb-2 text-[12px] text-slate-400">{data.expiredNow} billet(s) de trajets partis sortis de la file.</p>}
      {data.items.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-[13px] text-slate-500">Rien à vérifier.</p> : (
        <ul className="space-y-2">
          {data.items.map((it) => {
            const mine = me?.id === it.carrier.id;
            return (
              <li key={it.documentId} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <Link href={`/trips/${it.tripId}`} className="font-semibold underline-offset-2 hover:underline">{it.originCity} → {it.destinationCity}</Link>
                    <span className="ml-2 text-[12.5px] text-slate-500">départ {dateTime(it.departureAt)} · <span title={it.transportMode ?? ""}>{it.transportMode ? TRANSPORT_MODE_LABEL[it.transportMode] ?? it.transportMode : "—"}</span></span>
                  </div>
                  <span className="text-[12.5px]">Voyageur : <Link href={`/users/${it.carrier.id}`} className="underline-offset-2 hover:underline">{it.carrier.firstName} {it.carrier.lastName}</Link> · déposé le {dateTime(it.submittedAt)}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={() => open(it)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px]">Ouvrir le billet{it.originalName ? ` (${it.originalName})` : ""}</button>
                  {it.mimeType && <span className="text-[11px] text-slate-500">{DOCUMENT_MIME_LABEL(it.mimeType)}</span>}
                  {mine ? (
                    <span className="text-[12px] text-amber-800">C&apos;est ton propre trajet : un autre administrateur vérifie ce billet.</span>
                  ) : (
                    <>
                      <button disabled={busy !== null} onClick={() => review(it, "VERIFY")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Valider</button>
                      <RejectMenu disabled={busy !== null} onRejectAction={(r) => review(it, "REJECT", r)} />
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </>)}
    </div>
  );
}

function RejectMenu({ onRejectAction, disabled }: { onRejectAction: (r: TicketRejectionReason) => void; disabled: boolean }) {
  const [reason, setReason] = useState<TicketRejectionReason | "">("");
  return (
    <span className="inline-flex items-center gap-1">
      <select value={reason} onChange={(e) => setReason(e.target.value as TicketRejectionReason | "")} className="rounded-lg border border-slate-300 px-2 py-1.5 text-[12.5px]">
        <option value="">Rejeter : motif…</option>
        {(Object.keys(TICKET_REASON_LABEL) as TicketRejectionReason[]).map((r) => <option key={r} value={r}>{TICKET_REASON_LABEL[r]}</option>)}
      </select>
      <button disabled={disabled || !reason} onClick={() => reason && onRejectAction(reason)} className="rounded-lg bg-red-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Rejeter</button>
    </span>
  );
}
