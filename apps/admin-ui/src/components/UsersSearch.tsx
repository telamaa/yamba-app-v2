"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { STATUS_LABEL, dateTime } from "@/lib/format";
import { rolesLabel } from "@/lib/permissions";
import type { AdminMe, AdminUserSummary, AdminUsersResponse } from "@/lib/types";
import ExportButton from "./ExportButton";

type Filters = { q: string; role: string; accountStatus: string; carrierStatus: string; stripeReady: string; createdFrom: string; createdTo: string; sort: "createdAt" | "lastName"; dir: "asc" | "desc" };
const EMPTY: Filters = { q: "", role: "", accountStatus: "", carrierStatus: "", stripeReady: "", createdFrom: "", createdTo: "", sort: "createdAt", dir: "desc" };

function toParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.role) p.set("role", f.role);
  if (f.accountStatus) p.set("accountStatus", f.accountStatus);
  if (f.carrierStatus) p.set("carrierStatus", f.carrierStatus);
  if (f.stripeReady) p.set("stripeReady", f.stripeReady);
  if (f.createdFrom) p.set("createdFrom", new Date(f.createdFrom + "T00:00:00Z").toISOString());
  if (f.createdTo) p.set("createdTo", new Date(new Date(f.createdTo + "T00:00:00Z").getTime() + 86_400_000).toISOString());
  p.set("sort", f.sort); p.set("dir", f.dir);
  return p;
}

export default function UsersSearch() {
  const [f, setF] = useState<Filters>(EMPTY);
  const [items, setItems] = useState<AdminUserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<AdminMe | null>(null);
  useEffect(() => { apiFetch<AdminMe>("/admin/me").then(setMe).catch(() => undefined); }, []);

  const load = useCallback((after: string | null) => {
    setLoading(true);
    const p = toParams(f);
    if (after) p.set("cursor", after);
    apiFetch<AdminUsersResponse>(`/admin/users?${p.toString()}`)
      .then((r) => { setItems((prev) => (after ? [...prev, ...r.items] : r.items)); setTotal(r.total); setCursor(r.nextCursor ?? null); })
      .catch(() => { if (!after) { setItems([]); setTotal(0); } setCursor(null); })
      .finally(() => setLoading(false));
  }, [f]);
  useEffect(() => { const h = setTimeout(() => load(null), 250); return () => clearTimeout(h); }, [load]);

  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const filtersActive = Object.entries(f).some(([k, v]) => v && !["sort", "dir"].includes(k));
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <input value={f.q} onChange={set("q")} placeholder="email, nom, +33…, 64b…, YAM-2041" className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-[13px]" autoFocus />
        <select value={f.role} onChange={set("role")} className="rounded-lg border border-slate-300 px-2 py-1.5"><option value="">tous rôles</option><option value="SHIPPER">Expéditeur</option><option value="CARRIER">Voyageur</option><option value="ADMIN">Admin</option></select>
        <select value={f.accountStatus} onChange={set("accountStatus")} className="rounded-lg border border-slate-300 px-2 py-1.5"><option value="">tout état</option><option value="ACTIVE">Actif</option><option value="RESTRICTED">Restreint</option><option value="SUSPENDED">Suspendu</option></select>
        <select value={f.stripeReady} onChange={set("stripeReady")} className="rounded-lg border border-slate-300 px-2 py-1.5"><option value="">Stripe : tous</option><option value="1">Stripe prêt</option><option value="0">Stripe non prêt</option></select>
        <label className="flex items-center gap-1">inscrit du <input type="date" value={f.createdFrom} onChange={set("createdFrom")} className="rounded border border-slate-300 px-2 py-1" /></label>
        <label className="flex items-center gap-1">au <input type="date" value={f.createdTo} onChange={set("createdTo")} className="rounded border border-slate-300 px-2 py-1" /></label>
        <select value={`${f.sort}:${f.dir}`} onChange={(e) => { const [sort, dir] = e.target.value.split(":") as [Filters["sort"], Filters["dir"]]; setF({ ...f, sort, dir }); }} className="rounded-lg border border-slate-300 px-2 py-1.5">
          <option value="createdAt:desc">plus récents</option><option value="createdAt:asc">plus anciens</option><option value="lastName:asc">nom A→Z</option><option value="lastName:desc">nom Z→A</option>
        </select>
        {filtersActive && <button onClick={() => setF(EMPTY)} className="text-[12px] text-slate-500 underline">réinitialiser</button>}
        <span className="ml-auto"><ExportButton me={me} path="/admin/users/export" params={toParams(f)} personal /></span>
      </div>
      <p className="mt-2 text-[12px] text-slate-500">{loading ? "Recherche…" : `${items.length} affiché(s) · ${total} au total`}</p>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr><th className="px-3 py-2">Nom</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Rôles</th><th className="px-3 py-2">Voyageur</th><th className="px-3 py-2">Compte</th><th className="px-3 py-2">Inscrit</th></tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2"><Link href={`/users/${u.id}`} className="font-semibold underline-offset-2 hover:underline">{u.firstName} {u.lastName}</Link>{u.matchedOn && <span className="ml-2 text-[10px] text-slate-400">via {u.matchedOn}</span>}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2 text-[11.5px]">{u.roles.filter((r) => r !== "ADMIN").join(" · ") || "—"}{(u.adminRoles.length > 0 || u.adminRole) && <span className="ml-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">{rolesLabel(u.adminRoles.length ? u.adminRoles : u.adminRole ? [u.adminRole] : [])}</span>}</td>
                <td className="px-3 py-2 text-[11.5px]">{u.carrierStatus === "NONE" ? "—" : u.carrierStatus}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.accountStatus === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : u.accountStatus === "RESTRICTED" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>{STATUS_LABEL[u.accountStatus] ?? u.accountStatus}</span></td>
                <td className="px-3 py-2 whitespace-nowrap">{dateTime(u.createdAt)}</td>
              </tr>
            ))}
            {items.length === 0 && !loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Aucun compte.</td></tr>}
          </tbody>
        </table>
      </div>
      {cursor && <button disabled={loading} onClick={() => load(cursor)} className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] disabled:opacity-50">Charger la suite</button>}
    </div>
  );
}
