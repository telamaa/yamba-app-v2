"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { CATEGORY_LABEL, dateTime, daysSince, hoursUntil, money } from "@/lib/format";
import type { AdminMe, ArbitrationQueueResponse } from "@/lib/types";
import ExportButton from "./ExportButton";

export default function QueueTable() {
  const [data, setData] = useState<ArbitrationQueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // C-PR7a (D60 2A) — filtres serveur + export
  const [f, setF] = useState({ kind: "", originCity: "", destinationCity: "", olderThanDays: "", decidable: "" });
  const [me, setMe] = useState<AdminMe | null>(null);
  const params = () => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(f)) if (v) p.set(k, v); return p; };
  useEffect(() => { apiFetch<AdminMe>("/admin/me").then(setMe).catch(() => undefined); }, []);
  useEffect(() => {
    const h = setTimeout(() => { apiFetch<ArbitrationQueueResponse>(`/admin/disputes?${params().toString()}`).then(setData).catch((e) => setError(e.message)); }, 250);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);

  if (error) return <p className="mt-6 text-[13px] text-red-700">{error}</p>;

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5"><option value="">litiges et retenues</option><option value="DISPUTE">litiges</option><option value="RETENTION">retenues</option></select>
        <input value={f.originCity} onChange={(e) => setF({ ...f, originCity: e.target.value })} placeholder="origine" className="w-32 rounded-lg border border-slate-300 px-3 py-1.5" />
        <input value={f.destinationCity} onChange={(e) => setF({ ...f, destinationCity: e.target.value })} placeholder="destination" className="w-32 rounded-lg border border-slate-300 px-3 py-1.5" />
        <select value={f.olderThanDays} onChange={(e) => setF({ ...f, olderThanDays: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5"><option value="">tout âge</option><option value="3">ouvert il y a + de 3 j</option><option value="7">+ de 7 j</option><option value="14">+ de 14 j</option></select>
        <select value={f.decidable} onChange={(e) => setF({ ...f, decidable: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5"><option value="">décidables ou non</option><option value="1">décidables maintenant</option><option value="0">en attente du Voyageur</option></select>
        <span className="ml-auto"><ExportButton me={me} path="/admin/disputes/export" params={params()} /></span>
      </div>
      {!data && <p className="mt-4 text-[13px] text-slate-500">Chargement…</p>}
      {data && data.items.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-[13px] text-slate-500">Rien à arbitrer avec ces filtres.</p>}
      {data && data.items.length > 0 && (<>
      <p className="mt-3 text-[12.5px] text-slate-500">{data.items.length} affiché(s) · file entière : {data.counts.disputes} litige(s) · {data.counts.retentions} retenue(s)</p>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2">Dossier</th>
              <th className="px-3 py-2">Motif</th>
              <th className="px-3 py-2">Corridor</th>
              <th className="px-3 py-2">Parties</th>
              <th className="px-3 py-2 text-right">Montant</th>
              <th className="px-3 py-2">Ouvert</th>
              <th className="px-3 py-2">Décision</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it) => {
              const age = daysSince(it.openedAt);
              return (
                <tr key={it.bookingId} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={`/disputes/${it.bookingId}`} className="font-semibold text-slate-900 underline-offset-2 hover:underline">
                      {it.kind === "DISPUTE" ? it.ticketNumber ?? "Litige" : "Retenue"}
                    </Link>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${it.kind === "DISPUTE" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                      {it.kind === "DISPUTE" ? "Litige" : "Retenue"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{it.category ? CATEGORY_LABEL[it.category] ?? it.category : "Annulation après le départ"}</td>
                  <td className="px-3 py-2">{it.originCity} → {it.destinationCity}</td>
                  <td className="px-3 py-2">{it.shipperFirstName} (Exp.) · {it.carrierFirstName} (Voy.)</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(it.amountCents, it.currencyCode)}</td>
                  <td className="px-3 py-2">
                    {dateTime(it.openedAt)}
                    <span className={`ml-2 text-[11px] ${age >= 5 ? "font-semibold text-red-600" : "text-slate-400"}`}>J+{age}</span>
                  </td>
                  <td className="px-3 py-2">
                    {it.kind === "RETENTION" ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">à trancher</span>
                    ) : it.carrierResponded ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">version reçue · à trancher</span>
                    ) : hoursUntil(it.decidableAt) <= 0 ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">sans réponse · à trancher</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">attend le Voyageur · {hoursUntil(it.decidableAt)} h</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>)}
    </div>
  );
}
