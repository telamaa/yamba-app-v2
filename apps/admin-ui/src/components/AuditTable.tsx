"use client";

/**
 * AuditTable.tsx — le journal d'audit, filtrable (A149)
 * ======================================================
 * Le journal ne se lisait que du plus récent au plus ancien : retrouver « qui a touché à
 * ce compte le 12 » demandait de dérouler des centaines de lignes. Six filtres SERVEUR sur
 * ce que Mongo indexe (période, action, type de cible, identifiant, IP) plus l'auteur, posé
 * en cliquant un nom ; la recherche libre porte sur les lignes CHARGÉES et l'écrit
 * clairement — le détail est du JSON, il ne s'indexe pas.
 *
 * Recette 02-ADMIN § 5.24 :
 *  - ANO-ADM-68 : « Filtrer sur cet auteur » remplissait la recherche libre (50 lignes chargées) → filtre serveur `adminUserId` ;
 *  - ANO-ADM-69 : « Du / Au » partaient en dates seules, lues en UTC (la journée de Paris décalée de 2 h) → bornes locales ISO ;
 *  - ANO-ADM-70 / A183 : « Type de cible » = les types réellement écrits, en français ;
 *  - ANO-ADM-71 : le select « Action » se réduisait aux lignes chargées (un filtre posé cachait toutes les autres) → catalogue ;
 *  - ANO-ADM-72 : une panne affichait « Aucune action journalisée. » → refus lisible et « Réessayer » ;
 *  - ANO-ADM-73 : détail en JSON brut → `auditDetail` ;
 *  - ANO-ADM-74 : l'identifiant d'une clé de paramètre était ignoré par le serveur, sans que l'écran le dise → accepté, et
 *    un filtre saisi mais ignoré est signalé ;
 *  - cliquer une cible sans identifiant vide le champ (un identifiant partiel restait collé) ;
 *  - une réponse plus ancienne n'écrase plus une réponse plus récente (filtres tapés vite).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ACTION_LABEL, AUDIT_FILTER_LABEL, TARGET_TYPE_LABEL, auditDetail, dateTime } from "@/lib/format";
import type { AuditItem, AuditResponse } from "@/lib/types";
import { isPermissionRefusal, useDenyPage } from "./PageAccess";

const EMPTY = { from: "", to: "", adminUserId: "", action: "", targetType: "", targetId: "", ip: "" };
type Filters = typeof EMPTY;

/** Toutes les actions du catalogue, triées par libellé : un filtre posé ne cache jamais les autres (ANO-ADM-71). */
const ACTIONS = Object.keys(ACTION_LABEL).sort((a, b) => ACTION_LABEL[a].localeCompare(ACTION_LABEL[b], "fr"));

/** Une date du champ (« 2026-09-15 ») devient une borne de la journée LOCALE de l'opérateur, en ISO (ANO-ADM-69). */
function localBound(day: string, end: boolean): string {
  const d = new Date(`${day}T${end ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export default function AuditTable() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const deny = useDenyPage(); // décision du 15/09 : un refus de permission remplace la page entière
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [authorName, setAuthorName] = useState("");
  const [applied, setApplied] = useState<string[]>([]);
  const [contains, setContains] = useState("");
  const seq = useRef(0);

  const query = useCallback((f: Filters) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) {
      if (!v.trim()) continue;
      const value = k === "from" ? localBound(v, false) : k === "to" ? localBound(v, true) : v.trim();
      if (value) p.set(k, value);
    }
    return p;
  }, []);

  const load = useCallback(
    async (after: string | null, f: Filters) => {
      const mine = ++seq.current;
      setLoading(true);
      setError(null);
      try {
        const p = query(f);
        if (after) p.set("cursor", after);
        const r = await apiFetch<AuditResponse>(`/admin/audit${p.toString() ? `?${p}` : ""}`);
        if (mine !== seq.current) return; // une lecture plus récente est partie entre-temps
        setItems((prev) => (after ? [...prev, ...r.items] : r.items));
        setCursor(r.nextCursor);
        setApplied(r.appliedFilters ?? []);
      } catch (e) {
        if (mine !== seq.current) return;
        if (isPermissionRefusal(e)) deny("Ton profil ne lit pas le journal des actions admin.");
        else setError("Le journal n'a pas pu être lu : le service ne répond pas pour l'instant.");
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    },
    [query, deny]
  );

  useEffect(() => {
    const h = setTimeout(() => void load(null, filters), 300);
    return () => clearTimeout(h);
  }, [filters, load]);

  const shown = useMemo(() => {
    const needle = contains.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((a) =>
      [dateTime(a.at), a.admin, ACTION_LABEL[a.action] ?? a.action, TARGET_TYPE_LABEL[a.targetType] ?? a.targetType, a.targetId ?? "", auditDetail(a.after), a.ip ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [items, contains]);

  // Un champ rempli que le serveur n'a pas retenu (format non reconnu) : l'écran le dit au lieu de laisser croire au filtre.
  const ignored = (["adminUserId", "action", "targetType", "targetId", "ip"] as const)
    .filter((k) => filters[k].trim() && !applied.includes(k))
    .map((k) => AUDIT_FILTER_LABEL[k]);
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const cell = "rounded-lg border border-slate-300 px-2 py-1.5 text-[12.5px]";
  const hasFilters = Object.values(filters).some((v) => v.trim()) || contains.trim();

  return (
    <div className="mt-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-2 md:grid-cols-4">
          <label className="text-[11px] uppercase tracking-wider text-slate-500">Du<input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className={`mt-0.5 block w-full ${cell}`} /></label>
          <label className="text-[11px] uppercase tracking-wider text-slate-500">Au<input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className={`mt-0.5 block w-full ${cell}`} /></label>
          <label className="text-[11px] uppercase tracking-wider text-slate-500">Action
            <select value={filters.action} onChange={(e) => set({ action: e.target.value })} className={`mt-0.5 block w-full ${cell}`}>
              <option value="">toutes</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-wider text-slate-500">Type de cible
            <select value={filters.targetType} onChange={(e) => set({ targetType: e.target.value })} className={`mt-0.5 block w-full ${cell}`}>
              <option value="">tous</option>
              {Object.entries(TARGET_TYPE_LABEL).map(([t, label]) => <option key={t} value={t}>{label}</option>)}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-wider text-slate-500">Identifiant de cible<input value={filters.targetId} onChange={(e) => set({ targetId: e.target.value })} placeholder="identifiant ou clé" className={`mt-0.5 block w-full font-mono ${cell}`} /></label>
          <label className="text-[11px] uppercase tracking-wider text-slate-500">IP<input value={filters.ip} onChange={(e) => set({ ip: e.target.value })} placeholder="10.0.0.1" className={`mt-0.5 block w-full font-mono ${cell}`} /></label>
          <label className="text-[11px] uppercase tracking-wider text-slate-500 md:col-span-2">Contient (lignes chargées, détail compris)<input value={contains} onChange={(e) => setContains(e.target.value)} placeholder="mot, identifiant, motif…" className={`mt-0.5 block w-full ${cell}`} /></label>
        </div>
        {filters.adminUserId && (
          <div className="pt-2">
            <button type="button" onClick={() => { set({ adminUserId: "" }); setAuthorName(""); }} title="Retirer le filtre auteur" className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[12px] text-slate-700">
              Auteur : {authorName || filters.adminUserId} ✕
            </button>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px] text-slate-500">
          <span>{shown.length} ligne{shown.length > 1 ? "s" : ""} affichée{shown.length > 1 ? "s" : ""}{contains.trim() ? ` sur ${items.length} chargées` : ""}</span>
          {hasFilters && <button type="button" onClick={() => { setFilters(EMPTY); setAuthorName(""); setContains(""); }} className="rounded-lg border border-slate-300 bg-white px-2 py-1">Tout effacer</button>}
          {applied.length > 0 && <span>Filtres serveur : {applied.map((k) => AUDIT_FILTER_LABEL[k] ?? k).join(", ")}</span>}
          {!loading && ignored.length > 0 && <span className="font-medium text-amber-700">Ignoré (format non reconnu) : {ignored.join(", ")}</span>}
          <span className="text-slate-400">La recherche « contient » ne porte que sur les lignes déjà chargées : le détail est du JSON, il ne s&apos;indexe pas.</span>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => void load(null, filters)} disabled={loading} className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-[12.5px] disabled:opacity-60">Réessayer</button>
        </div>
      )}

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
                  <button type="button" onClick={() => { set({ adminUserId: a.adminUserId }); setAuthorName(a.admin); }} className="underline-offset-2 hover:underline" title="Filtrer sur cet auteur">{a.admin}</button>
                </td>
                <td className="px-3 py-2 font-medium">
                  <button type="button" onClick={() => set({ action: a.action })} className="text-left underline-offset-2 hover:underline" title="Filtrer sur cette action">{ACTION_LABEL[a.action] ?? a.action}</button>
                </td>
                <td className="px-3 py-2 text-[11.5px]">
                  <button type="button" onClick={() => set({ targetType: a.targetType, targetId: a.targetId ?? "" })} className="text-left underline-offset-2 hover:underline" title="Filtrer sur cette cible">
                    {TARGET_TYPE_LABEL[a.targetType] ?? a.targetType}{a.targetId ? <span className="font-mono text-[11px]"> · {a.targetId}</span> : ""}
                  </button>
                </td>
                <td className="px-3 py-2 text-[11.5px] text-slate-600">{auditDetail(a.after)}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                  {a.ip ? <button type="button" onClick={() => set({ ip: a.ip as string })} className="underline-offset-2 hover:underline" title="Filtrer sur cette IP">{a.ip}</button> : ""}
                </td>
              </tr>
            ))}
            {!loading && !error && shown.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">{hasFilters ? "Aucune action ne correspond à ces filtres." : "Aucune action journalisée."}</td></tr>
            )}
          </tbody>
        </table>
        {cursor && !error && (
          <button onClick={() => void load(cursor, filters)} disabled={loading} className="m-3 rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] disabled:opacity-60">
            {loading ? "Chargement…" : "Charger la suite"}
          </button>
        )}
      </div>
    </div>
  );
}
