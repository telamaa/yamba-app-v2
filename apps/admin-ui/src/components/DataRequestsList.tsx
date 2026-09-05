"use client";

/** DataRequestsList.tsx — le registre des demandes RGPD (C-PR8b, D63 7A) : les plus récentes d'abord, curseur. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "@/lib/api";
import { dateTime } from "@/lib/format";
import type { DataRequestItem, DataRequestsResponse } from "@/lib/types";

const TYPE: Record<string, string> = { EXPORT: "Export", ERASURE: "Effacement" };
const CHANNEL: Record<string, string> = { MEMBER: "par le membre", ADMIN: "par l'admin" };
const STATUS: Record<string, string> = { DONE: "faite", REFUSED: "refusée" };
const BLOCKER: Record<string, string> = { ACTIVE_DEAL: "deal en cours", PENDING_REQUEST: "demande en attente", PAYOUT_PENDING: "versement dû / en échec", RETENTION_HELD: "retenue en médiation", PUBLISHED_TRIP: "trajet publié", ADMIN_ACCOUNT: "profil admin" };

export default function DataRequestsList() {
  const [items, setItems] = useState<DataRequestItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback((after?: string | null) => {
    apiFetch<DataRequestsResponse>(`/admin/privacy/requests${after ? `?cursor=${after}` : ""}`)
      .then((r) => {
        setItems((prev) => (after ? [...prev, ...r.items] : r.items));
        setCursor(r.nextCursor);
        setLoaded(true);
      })
      .catch((e) => setError(e instanceof ApiError ? `${e.status} : ${e.message}` : "Chargement impossible."));
  }, []);
  useEffect(() => load(), [load]);

  if (error) return <p className="mt-4 text-[13px] text-red-700">{error}</p>;
  if (!loaded) return <p className="mt-4 text-[13px] text-slate-500">Chargement…</p>;
  return (
    <div className="mt-4">
      {items.length === 0 ? (
        <p className="text-[13px] text-slate-500">Aucune demande pour l&apos;instant.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2">Quand</th><th className="px-3 py-2">Membre</th><th className="px-3 py-2">Demande</th><th className="px-3 py-2">Canal</th><th className="px-3 py-2">Issue</th><th className="px-3 py-2">Détail</th></tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{dateTime(r.requestedAt)}</td>
                  <td className="px-3 py-2"><Link href={`/users/${r.userId}`} className="underline">{r.userLabel}</Link></td>
                  <td className="px-3 py-2">{TYPE[r.type] ?? r.type}</td>
                  <td className="px-3 py-2">{CHANNEL[r.channel] ?? r.channel}{r.requestedByAdmin ? ` (${r.requestedByAdmin})` : ""}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${r.status === "DONE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{STATUS[r.status] ?? r.status}</span></td>
                  <td className="px-3 py-2 text-slate-600">{r.status === "REFUSED" ? r.refusalReasons.map((b) => BLOCKER[b] ?? b).join(", ") : r.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor && <button type="button" onClick={() => load(cursor)} className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px]">Charger la suite</button>}
    </div>
  );
}
