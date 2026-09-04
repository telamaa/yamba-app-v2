"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { dateTime, money } from "@/lib/format";
import type { CorridorsResponse, PilotageSeriesPoint, PilotageSeriesResponse } from "@/lib/types";

/* Petits multiples : une courbe = une mesure, une seule couleur (slot 1 de la palette validée), pas de double axe. */
const SERIES: Array<{ key: keyof PilotageSeriesPoint; label: string }> = [
  { key: "signups", label: "Inscriptions" },
  { key: "tripsPublished", label: "Trajets publiés" },
  { key: "requests", label: "Demandes" },
  { key: "accepted", label: "Acceptations" },
  { key: "delivered", label: "Livraisons" },
  { key: "completed", label: "Deals terminés" },
  { key: "cancelled", label: "Annulations" },
  { key: "disputes", label: "Litiges" },
];
const LINE = "#2a78d6";

export default function PilotageView() {
  const [granularity, setGranularity] = useState<"week" | "month">("week");
  const [months, setMonths] = useState(3);
  const [days, setDays] = useState(30);
  const [series, setSeries] = useState<PilotageSeriesResponse | null>(null);
  const [corridors, setCorridors] = useState<CorridorsResponse | null>(null);
  const [table, setTable] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setSeries(null);
    apiFetch<PilotageSeriesResponse>(`/admin/pilotage/series?granularity=${granularity}&months=${months}`).then(setSeries).catch((e) => setErr(e instanceof ApiError ? `${e.status} : ${e.message}` : "Chargement impossible."));
  }, [granularity, months]);
  useEffect(() => {
    setCorridors(null);
    apiFetch<CorridorsResponse>(`/admin/pilotage/corridors?days=${days}`).then(setCorridors).catch((e) => setErr(e instanceof ApiError ? `${e.status} : ${e.message}` : "Chargement impossible."));
  }, [days]);
  const currencies = useMemo(() => [...new Set((series?.points ?? []).flatMap((p) => p.volume.map((v) => v.currencyCode)))].sort(), [series]);

  if (err) return <p className="mt-4 text-[13px] text-red-700">{err}</p>;
  return (
    <div className="mt-4">
      {series && (
        <div className="grid grid-cols-3 gap-3">
          <Tile label="Comptes" v={String(series.totals.users)} />
          <Tile label="Voyageurs prêts (Stripe)" v={String(series.totals.carriersReady)} />
          <Tile label="Trajets publiés à venir" v={String(series.totals.tripsPublishedOpen)} />
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2 text-[12.5px]">
        <label className="flex items-center gap-1">par
          <select value={granularity} onChange={(e) => { const g = e.target.value as "week" | "month"; setGranularity(g); setMonths(g === "week" ? 3 : 12); }} className="rounded-lg border border-slate-300 px-2 py-1.5">
            <option value="week">semaine</option><option value="month">mois</option>
          </select>
        </label>
        <label className="flex items-center gap-1">sur
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="rounded-lg border border-slate-300 px-2 py-1.5">
            {[1, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} mois</option>)}
          </select>
        </label>
        <button onClick={() => setTable((t) => !t)} className="rounded-lg border border-slate-300 px-3 py-1.5">{table ? "Voir les courbes" : "Voir le tableau"}</button>
        {series && <span className="text-[11px] text-slate-400">calculé le {dateTime(series.generatedAt)}{series.cached ? " (cache)" : ""}</span>}
      </div>
      {!series ? <p className="mt-4 text-[13px] text-slate-500">Chargement…</p> : table ? (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wider text-slate-500"><tr><th className="px-2 py-2">Période</th>{SERIES.map((s) => <th key={s.key} className="px-2 py-2 text-right">{s.label}</th>)}{currencies.map((c) => <th key={c} className="px-2 py-2 text-right">Encaissé {c}</th>)}</tr></thead>
            <tbody>{series.points.map((p) => <tr key={p.period} className="border-t border-slate-100"><td className="px-2 py-1.5 font-semibold">{p.period}</td>{SERIES.map((s) => <td key={s.key} className="px-2 py-1.5 text-right tabular-nums">{p[s.key] as number}</td>)}{currencies.map((c) => <td key={c} className="px-2 py-1.5 text-right tabular-nums">{money(p.volume.find((v) => v.currencyCode === c)?.capturedCents ?? 0, c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SERIES.map((s) => <LineChart key={s.key} title={s.label} points={series.points.map((p) => ({ x: p.period, y: p[s.key] as number }))} />)}
          {currencies.map((c) => <LineChart key={c} title={`Encaissé (${c})`} points={series.points.map((p) => ({ x: p.period, y: (p.volume.find((v) => v.currencyCode === c)?.capturedCents ?? 0) / 100 }))} unit={c} />)}
        </div>
      )}

      <section className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Corridors</h2>
          <label className="ml-2 flex items-center gap-1 text-[12.5px]">sur
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-slate-300 px-2 py-1.5">
              {[7, 30, 90, 365].map((d) => <option key={d} value={d}>{d} jours</option>)}
            </select>
          </label>
          {corridors && <span className="text-[11px] text-slate-400">{corridors.items.length} corridor(s){corridors.cached ? " · cache" : ""}</span>}
        </div>
        <p className="mt-1 text-[12px] text-slate-500">Un corridor avec des recherches sans résultat et aucun trajet est une demande sans offre : c'est là qu'il faut recruter des Voyageurs.</p>
        {!corridors ? <p className="mt-3 text-[13px] text-slate-500">Chargement…</p> : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wider text-slate-500">
                <tr><th className="px-3 py-2">Corridor</th><th className="px-3 py-2 text-right">Trajets</th><th className="px-3 py-2 text-right">Demandes</th><th className="px-3 py-2 text-right">Acceptées</th><th className="px-3 py-2 text-right">€/kg moyen</th><th className="px-3 py-2 text-right">Litiges</th><th className="px-3 py-2 text-right">Vues</th><th className="px-3 py-2 text-right">Recherches</th><th className="px-3 py-2 text-right">Sans résultat</th></tr>
              </thead>
              <tbody>
                {corridors.items.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500">Aucune activité sur la période.</td></tr>}
                {corridors.items.map((c) => {
                  const gap = c.searchesNoResult > 0 && c.tripsPublished === 0;
                  return (
                    <tr key={c.key} className={`border-t border-slate-100 ${gap ? "bg-amber-50/60" : ""}`}>
                      <td className="px-3 py-2 font-semibold capitalize">{c.originCity}{c.originCountryCode ? ` (${c.originCountryCode})` : ""} → {c.destinationCity}{c.destinationCountryCode ? ` (${c.destinationCountryCode})` : ""}{gap && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">demande sans offre</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.tripsPublished}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.requests}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.accepted}{c.acceptanceRatePct != null ? <span className="text-[10.5px] text-slate-400"> ({c.acceptanceRatePct} %)</span> : null}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.avgPricePerKgCents != null ? money(c.avgPricePerKgCents, c.currencyCode ?? "EUR") : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.disputes}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.views}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.searches}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${c.searchesNoResult > 0 ? "font-semibold text-amber-900" : ""}`}>{c.searchesNoResult}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({ label, v }: { label: string; v: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xl font-black tabular-nums">{v}</p><p className="text-[11.5px] text-slate-600">{label}</p></div>;
}

/** Courbe à une série : marques fines, axe unique, grille discrète, survol avec repère et infobulle, dernier point étiqueté. */
function LineChart({ title, points, unit }: { title: string; points: Array<{ x: string; y: number }>; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 280, H = 110, PL = 30, PR = 10, PT = 10, PB = 20;
  const max = Math.max(1, ...points.map((p) => p.y));
  const n = points.length;
  const px = (i: number) => PL + (n <= 1 ? 0 : (i * (W - PL - PR)) / (n - 1));
  const py = (y: number) => PT + (H - PT - PB) * (1 - y / max);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  const fmt = (y: number) => (unit ? `${y.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${unit}` : String(y));
  const total = points.reduce((a, p) => a + p.y, 0);
  const last = points[n - 1];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-baseline justify-between"><p className="text-[12px] font-semibold text-slate-700">{title}</p><p className="text-[11px] text-slate-500">total {fmt(total)}</p></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label={`${title} : ${points.map((p) => `${p.x} ${fmt(p.y)}`).join(", ")}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; let best = 0; for (let i = 0; i < n; i++) if (Math.abs(px(i) - x) < Math.abs(px(best) - x)) best = i; setHover(best); }}>
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={PL} x2={W - PR} y1={py(max * f)} y2={py(max * f)} stroke="#e5e7eb" strokeWidth={1} /><text x={PL - 4} y={py(max * f) + 3} fontSize={8} textAnchor="end" fill="#6b7280">{unit ? Math.round(max * f) : Math.round(max * f)}</text></g>)}
        {n > 0 && <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {last && n > 0 && <circle cx={px(n - 1)} cy={py(last.y)} r={3} fill={LINE} stroke="#fff" strokeWidth={2} />}
        {last && <text x={px(n - 1)} y={py(last.y) - 6} fontSize={9} textAnchor="end" fill="#0b0b0b" fontWeight={600}>{fmt(last.y)}</text>}
        {n > 0 && <><text x={PL} y={H - 6} fontSize={8} fill="#6b7280">{points[0].x}</text><text x={W - PR} y={H - 6} fontSize={8} textAnchor="end" fill="#6b7280">{last?.x}</text></>}
        {hover != null && points[hover] && (
          <g>
            <line x1={px(hover)} x2={px(hover)} y1={PT} y2={H - PB} stroke="#9ca3af" strokeWidth={1} strokeDasharray="2 2" />
            <circle cx={px(hover)} cy={py(points[hover].y)} r={4} fill={LINE} stroke="#fff" strokeWidth={2} />
            <rect x={Math.min(px(hover) + 6, W - 96)} y={PT} width={90} height={26} rx={4} fill="#0b0b0b" opacity={0.92} />
            <text x={Math.min(px(hover) + 10, W - 92)} y={PT + 10} fontSize={8.5} fill="#fff">{points[hover].x}</text>
            <text x={Math.min(px(hover) + 10, W - 92)} y={PT + 21} fontSize={9} fill="#fff" fontWeight={700}>{fmt(points[hover].y)}</text>
          </g>
        )}
      </svg>
    </div>
  );
}
