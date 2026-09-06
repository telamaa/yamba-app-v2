"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ACTION_LABEL, dateTime } from "@/lib/format";
import type { AuditItem, AuditResponse } from "@/lib/types";

export default function AuditTable() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(after?: string | null) {
    setLoading(true);
    const r = await apiFetch<AuditResponse>(`/admin/audit${after ? `?cursor=${after}` : ""}`);
    setItems((prev) => (after ? [...prev, ...r.items] : r.items));
    setCursor(r.nextCursor);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2">Quand</th>
            <th className="px-3 py-2">Qui</th>
            <th className="px-3 py-2">Action</th>
            <th className="px-3 py-2">Cible</th>
            <th className="px-3 py-2">Détail</th>
            <th className="px-3 py-2">IP</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-t border-slate-100">
              <td className="whitespace-nowrap px-3 py-2">{dateTime(a.at)}</td>
              <td className="px-3 py-2">{a.admin}</td>
              <td className="px-3 py-2 font-medium">{ACTION_LABEL[a.action] ?? a.action}</td>
              <td className="px-3 py-2 font-mono text-[11px]">{a.targetType}{a.targetId ? ` · ${a.targetId}` : ""}</td>
              <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{a.after ? JSON.stringify(a.after) : ""}</td>
              <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{a.ip ?? ""}</td>
            </tr>
          ))}
          {!loading && items.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Aucune action journalisée.</td></tr>
          )}
        </tbody>
      </table>
      {cursor && (
        <button onClick={() => load(cursor)} disabled={loading} className="m-3 rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] disabled:opacity-60">
          {loading ? "Chargement…" : "Charger la suite"}
        </button>
      )}
    </div>
  );
}
