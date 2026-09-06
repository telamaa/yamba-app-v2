"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { TICKET_STATUS_LABEL, dateTime } from "@/lib/format";
import type { AdminMe, AdminTripSummary, AdminTripsResponse } from "@/lib/types";
import ExportButton from "./ExportButton";

const STATUSES = ["", "DRAFT", "PUBLISHED", "PAUSED", "COMPLETED", "CANCELLED", "ARCHIVED"];
type Filters = { q: string; status: string; hidden: boolean; ticketPending: boolean; hideProposed: boolean; carrierId: string; from: string; to: string; originCity: string; destinationCity: string; sort: string; dir: string };

function toParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status) p.set("status", f.status);
  if (f.hidden) p.set("hidden", "1");
  if (f.ticketPending) p.set("ticketPending", "1");
  if (f.hideProposed) p.set("hideProposed", "1");
  if (f.carrierId) p.set("carrierId", f.carrierId);
  if (f.from) p.set("from", new Date(f.from + "T00:00:00Z").toISOString());
  if (f.to) p.set("to", new Date(new Date(f.to + "T00:00:00Z").getTime() + 86_400_000).toISOString());
  if (f.originCity) p.set("originCity", f.originCity);
  if (f.destinationCity) p.set("destinationCity", f.destinationCity);
  p.set("sort", f.sort); p.set("dir", f.dir);
  return p;
}

export default function TripsList() {
  const sp = useSearchParams();
  const [f, setF] = useState<Filters>({ q: "", status: sp.get("status") ?? "", hidden: sp.get("hidden") === "1", ticketPending: sp.get("ticketPending") === "1", hideProposed: sp.get("hideProposed") === "1", carrierId: sp.get("carrierId") ?? "", from: "", to: "", originCity: "", destinationCity: "", sort: "departureAt", dir: "desc" });
  const [items, setItems] = useState<AdminTripSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<AdminMe | null>(null);
  useEffect(() => { apiFetch<AdminMe>("/admin/me").then(setMe).catch(() => undefined); }, []);
  const load = useCallback((after: string | null) => {
    setLoading(true);
    const p = toParams(f);
    if (after) p.set("cursor", after);
    apiFetch<AdminTripsResponse>(`/admin/trips?${p.toString()}`)
      .then((r) => { setItems((prev) => (after ? [...prev, ...r.items] : r.items)); setTotal(r.total); setCursor(r.nextCursor ?? null); })
      .catch(() => { if (!after) { setItems([]); setTotal(0); } setCursor(null); })
      .finally(() => setLoading(false));
  }, [f]);
  useEffect(() => { const h = setTimeout(() => load(null), 250); return () => clearTimeout(h); }, [load]);
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <input value={f.q} onChange={set("q")} placeholder="ville ou identifiant" className="w-48 rounded-lg border border-slate-300 px-3 py-1.5" />
        <input value={f.originCity} onChange={set("originCity")} placeholder="origine" className="w-32 rounded-lg border border-slate-300 px-3 py-1.5" />
        <input value={f.destinationCity} onChange={set("destinationCity")} placeholder="destination" className="w-32 rounded-lg border border-slate-300 px-3 py-1.5" />
        <select value={f.status} onChange={set("status")} className="rounded-lg border border-slate-300 px-2 py-1.5">{STATUSES.map((s) => <option key={s} value={s}>{s || "tous statuts"}</option>)}</select>
        <label className="flex items-center gap-1"><input type="checkbox" checked={f.hidden} onChange={set("hidden")} /> masqués</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={f.hideProposed} onChange={set("hideProposed")} /> masquage proposé</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={f.ticketPending} onChange={set("ticketPending")} /> billet à vérifier</label>
        <label className="flex items-center gap-1">départ du <input type="date" value={f.from} onChange={set("from")} className="rounded border border-slate-300 px-2 py-1" /></label>
        <label className="flex items-center gap-1">au <input type="date" value={f.to} onChange={set("to")} className="rounded border border-slate-300 px-2 py-1" /></label>
        <select value={`${f.sort}:${f.dir}`} onChange={(e) => { const [sort, dir] = e.target.value.split(":"); setF({ ...f, sort, dir }); }} className="rounded-lg border border-slate-300 px-2 py-1.5">
          <option value="departureAt:desc">départ ↓</option><option value="departureAt:asc">départ ↑</option><option value="publishedAt:desc">publiés récemment</option><option value="createdAt:desc">créés récemment</option>
        </select>
        {f.carrierId && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">un seul Voyageur · <button onClick={() => setF({ ...f, carrierId: "" })} className="underline">tous</button></span>}
        <span className="ml-auto"><ExportButton me={me} path="/admin/trips/export" params={toParams(f)} /></span>
      </div>
      <p className="mt-2 text-[12px] text-slate-500">{loading ? "Chargement…" : `${items.length} affiché(s) · ${total} au total`}</p>
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
            {items.length === 0 && !loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Aucun trajet.</td></tr>}
          </tbody>
        </table>
      </div>
      {cursor && <button disabled={loading} onClick={() => load(cursor)} className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] disabled:opacity-50">Charger la suite</button>}
    </div>
  );
}
