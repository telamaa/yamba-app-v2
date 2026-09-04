"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { TICKET_STATUS_LABEL, dateTime } from "@/lib/format";
import type { AdminTripsResponse } from "@/lib/types";

const STATUSES = ["", "DRAFT", "PUBLISHED", "PAUSED", "COMPLETED", "CANCELLED", "ARCHIVED"];

export default function TripsList() {
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [hidden, setHidden] = useState(sp.get("hidden") === "1");
  const [ticketPending, setTicketPending] = useState(sp.get("ticketPending") === "1");
  const [from, setFrom] = useState("");
  const [data, setData] = useState<AdminTripsResponse | null>(null);
  const hideProposedOnly = sp.get("hideProposed") === "1";
  const carrierId = sp.get("carrierId") ?? "";

  useEffect(() => {
    const h = setTimeout(() => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (hidden) params.set("hidden", "1");
      if (ticketPending) params.set("ticketPending", "1");
      if (from) params.set("from", new Date(from).toISOString());
      if (carrierId) params.set("carrierId", carrierId);
      apiFetch<AdminTripsResponse>(`/admin/trips?${params.toString()}`).then(setData).catch(() => setData({ items: [], total: 0 }));
    }, 250);
    return () => clearTimeout(h);
  }, [q, status, hidden, ticketPending, from, carrierId]);

  const items = (data?.items ?? []).filter((t) => !hideProposedOnly || t.hideProposed);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ville ou identifiant" className="w-56 rounded-lg border border-slate-300 px-3 py-1.5" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5">
          {STATUSES.map((s) => <option key={s} value={s}>{s || "tous statuts"}</option>)}
        </select>
        <label className="flex items-center gap-1"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> masqués</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={ticketPending} onChange={(e) => setTicketPending(e.target.checked)} /> billet à vérifier</label>
        <label className="flex items-center gap-1">départ ≥ <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-slate-300 px-2 py-1" /></label>
        {carrierId && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">un seul Voyageur · <Link href="/trips" className="underline">tous</Link></span>}
        {hideProposedOnly && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">masquages proposés · <Link href="/trips" className="underline">tous</Link></span>}
        <span className="text-[12px] text-slate-500">{data ? `${items.length} affichés · ${data.total} au total` : ""}</span>
      </div>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr><th className="px-3 py-2">Corridor</th><th className="px-3 py-2">Départ</th><th className="px-3 py-2">Voyageur</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2">Billet</th><th className="px-3 py-2">Deals</th></tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2"><Link href={`/trips/${t.id}`} className="font-semibold underline-offset-2 hover:underline">{t.originCity} → {t.destinationCity}</Link>{t.hidden && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">masqué</span>}{t.hideProposed && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">masquage proposé</span>}</td>
                <td className="px-3 py-2 whitespace-nowrap">{dateTime(t.departureAt)}</td>
                <td className="px-3 py-2"><Link href={`/users/${t.carrier.id}`} className="underline-offset-2 hover:underline">{t.carrier.firstName} {t.carrier.lastName}</Link>{t.carrier.accountStatus !== "ACTIVE" && <span className="ml-1 text-[10px] text-red-700">{t.carrier.accountStatus}</span>}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{t.status}</td>
                <td className="px-3 py-2">{TICKET_STATUS_LABEL[t.ticketVerificationStatus] ?? t.ticketVerificationStatus}</td>
                <td className="px-3 py-2 tabular-nums">{t.activeBookingsCount}</td>
              </tr>
            ))}
            {data && items.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Aucun trajet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
