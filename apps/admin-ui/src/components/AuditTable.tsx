"use client";

/**
 * AuditTable.tsx — le journal d'audit, filtrable (A149)
 * ======================================================
 * Le journal ne se lisait que du plus récent au plus ancien : retrouver « qui a touché à
 * ce compte le 12 » demandait de dérouler des centaines de lignes. Six filtres SERVEUR sur
 * ce que Mongo indexe (période, auteur, action, type de cible, identifiant, IP) ; la
 * recherche libre porte sur les lignes CHARGÉES et l'écrit clairement — le détail est du
 * JSON, il ne s'indexe pas.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ACTION_LABEL, dateTime } from "@/lib/format";
import type { AuditItem, AuditResponse } from "@/lib/types";

const TARGET_TYPES = ["USER", "BOOKING", "DISPUTE", "TRIP", "SESSION", "SETTINGS", "REPORT", "MAINTENANCE", "EXPORT"];
const EMPTY = { from: "", to: "", adminUserId: "", action: "", targetType: "", targetId: "", ip: "" };
type Filters = typeof EMPTY;

/** Le détail lisible d'une ligne : les clés du `after`, sans le bruit du JSON brut. */
function detailOf(a: AuditItem): string {
  const after = a.after as Record<string, unknown> | null;
  if (!after || typeof after !== "object") return "";
  return Object.entries(after)
    .map(([k, v]) => `${k} : ${typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default function AuditTable() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<string[]>([]);
  const [contains, setContains] = useState("");

  const query = useCallback((f: Filters) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v.trim()) p.set(k, v.trim());
    return p;
  }, []);

  const load = useCallback(
    async (after?: string | null, f: Filters = filters) => {
      setLoading(true);
      try {
        const p = query(f);
        if (after) p.set("cursor", after);
        const r = await apiFetch<AuditResponse>(`/admin/audit${p.toString() ? `?${p}` : ""}`);
        setItems((prev) => (after ? [...prev, ...r.items] : r.items));
        setCursor(r.nextCursor);
        setApplied(r.appliedFilters ?? []);
      } finally {
        setLoading(false);
      }
    },
    [filters, query]
  );

  useEffect(() => {
    const h = setTimeout(() => { void load(null, filters).catch(() => setLoading(false)); }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const actions = useMemo(() => [...new Set(items.map((a) => a.action))].sort(), [items]);

  const shown = useMemo(() => {
    const needle = contains.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((a) =>
      [dateTime(a.at), a.admin, ACTION_LABEL[a.action] ?? a.action, a.targetType, a.targetId ?? "", detailOf(a), a.ip ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [items, contains]);

  const set = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const cell = "rounded-lg border border-slate-300 px-2 py-1.5 text-[12.5px]";
  const hasFilters = Object.values(filters).some((v) => v.trim()) || contains.trim();

  return (
    <div className="mt-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-2 md:grid-cols-4">
          <label className="text-[11px] uppercase tracking-wider text-slate-500">Du<input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} className={`mt-0.5 block w-full ${cell}`} /></label>
          <label className="text-[11px] uppercase tracking-wider text-slate-500">Au<input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} className={`mt-0.5 block w-full ${cell}`} /></label>
          <label className="text-[11px] uppercase tracking-wider text-slate-500">Action
            <select value={filters.action} onChange={(e) => set("action", e.target.value)} className={`mt-0.5 block w-full ${cell}`}>
              <option value="">toutes</option>
              {actions.map((a) => <option key={a} value={a}>{ACTION_LABEL[a] ?? a}</option>)}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-wider text-slate-500">Type de cible
            <select value={filters.targetType} onChange={(e) => set("targetType", e.target.value)} className={`mt-0.5 block w-full ${cell}`}>
              <option value="">tous</option>
              {TARGET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-wider text-slate-500">Identifiant de cible<input value={filters.targetId} onChange={(e) => set("targetId", e.target.value)} placeholder="24 caractères" className={`mt-0.5 block w-full font-mono ${cell}`} /></label>
          <label className="text-[11px] uppercase tracking-wider text-slate-500">IP<input value={filters.ip} onChange={(e) => set("ip", e.target.value)} placeholder="10.0.0.1" className={`mt-0.5 block w-full font-mono ${cell}`} /></label>
          <label className="text-[11px] uppercase tracking-wider text-slate-500 md:col-span-2">Contient (lignes chargées, détail compris)<input value={contains} onChange={(e) => setContains(e.target.value)} placeholder="mot, identifiant, motif…" className={`mt-0.5 block w-full ${cell}`} /></label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px] text-slate-500">
          <span>{shown.length} ligne{shown.length > 1 ? "s" : ""} affichée{shown.length > 1 ? "s" : ""}{contains.trim() ? ` sur ${items.length} chargées` : ""}</span>
          {hasFilters && <button type="button" onClick={() => { setFilters(EMPTY); setContains(""); }} className="rounded-lg border border-slate-300 bg-white px-2 py-1">Tout effacer</button>}
          {applied.length > 0 && <span>Filtres serveur : {applied.join(", ")}</span>}
          <span className="text-slate-400">La recherche « contient » ne porte que sur les lignes déjà chargées : le détail est du JSON, il ne s&apos;indexe pas.</span>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
            {shown.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-3 py-2">{dateTime(a.at)}</td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => setContains(a.admin)} className="underline-offset-2 hover:underline" title="Filtrer sur cet auteur">{a.admin}</button>
                </td>
                <td className="px-3 py-2 font-medium">
                  <button type="button" onClick={() => set("action", a.action)} className="text-left underline-offset-2 hover:underline" title="Filtrer sur cette action">{ACTION_LABEL[a.action] ?? a.action}</button>
                </td>
                <td className="px-3 py-2 font-mono text-[11px]">
                  <button type="button" onClick={() => { set("targetType", a.targetType); if (a.targetId) set("targetId", a.targetId); }} className="text-left underline-offset-2 hover:underline" title="Filtrer sur cette cible">
                    {a.targetType}{a.targetId ? ` · ${a.targetId}` : ""}
                  </button>
                </td>
                <td className="px-3 py-2 text-[11.5px] text-slate-600">{detailOf(a)}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                  {a.ip ? <button type="button" onClick={() => set("ip", a.ip as string)} className="underline-offset-2 hover:underline" title="Filtrer sur cette IP">{a.ip}</button> : ""}
                </td>
              </tr>
            ))}
            {!loading && shown.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">{hasFilters ? "Aucune action ne correspond à ces filtres." : "Aucune action journalisée."}</td></tr>
            )}
          </tbody>
        </table>
        {cursor && (
          <button onClick={() => load(cursor)} disabled={loading} className="m-3 rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] disabled:opacity-60">
            {loading ? "Chargement…" : "Charger la suite"}
          </button>
        )}
      </div>
    </div>
  );
}
