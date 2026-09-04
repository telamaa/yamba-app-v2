"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { STATUS_LABEL, dateTime } from "@/lib/format";
import { rolesLabel } from "@/lib/permissions";
import type { AdminUsersResponse } from "@/lib/types";

export default function UsersSearch() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const h = setTimeout(() => {
      setLoading(true);
      apiFetch<AdminUsersResponse>(`/admin/users?q=${encodeURIComponent(q)}`)
        .then(setData)
        .catch(() => setData({ items: [], total: 0 }))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(h);
  }, [q]);

  return (
    <div className="mt-4">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="email, nom, +33…, 64b…, YAM-2041" className="w-full max-w-lg rounded-lg border border-slate-300 px-3 py-2 text-[14px]" autoFocus />
      <p className="mt-2 text-[12px] text-slate-500">{loading ? "Recherche…" : data ? `${data.items.length} affiché(s)${q ? "" : ` · ${data.total} comptes`}` : ""}</p>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Rôles</th>
              <th className="px-3 py-2">Compte</th>
              <th className="px-3 py-2">Inscrit</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link href={`/users/${u.id}`} className="font-semibold underline-offset-2 hover:underline">{u.firstName} {u.lastName}</Link>
                  {u.matchedOn && <span className="ml-2 text-[10px] text-slate-400">via {u.matchedOn}</span>}
                </td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2 text-[11.5px]">
                  {u.roles.filter((r) => r !== "ADMIN").join(" · ") || "—"}
                  {(u.adminRoles.length > 0 || u.adminRole) && <span className="ml-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">{rolesLabel(u.adminRoles.length ? u.adminRoles : u.adminRole ? [u.adminRole] : [])}</span>}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.accountStatus === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : u.accountStatus === "RESTRICTED" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>{STATUS_LABEL[u.accountStatus]}</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{dateTime(u.createdAt)}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Aucun compte.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
