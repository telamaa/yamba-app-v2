"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "@/lib/api";
import { dateTime, money } from "@/lib/format";
import type { CorridorsResponse, PilotageDrilldownResponse, PilotageMetric, PilotageSeriesPoint, PilotageSeriesResponse } from "@/lib/types";

/* Une courbe = une mesure, une couleur (slot 1 de la palette validée), un seul axe. Agrandie : tableau dessous, clic = drill-down (D60 3A). */
type Metric = { key: PilotageMetric; label: string; hint: string; money?: boolean };
const ACTIVITY: Metric[] = [
  { key: "signups", label: "Inscriptions", hint: "comptes créés" },
  { key: "tripsPublished", label: "Trajets publiés", hint: "date de publication" },
  { key: "requests", label: "Demandes", hint: "réservations demandées" },
  { key: "accepted", label: "Acceptations", hint: "acceptées par le Voyageur" },
  { key: "delivered", label: "Livraisons", hint: "code de livraison validé" },
  { key: "completed", label: "Deals terminés", hint: "fin de transaction" },
  { key: "cancelled", label: "Annulations", hint: "deals annulés" },
  { key: "disputes", label: "Litiges", hint: "litiges ouverts" },
];
const FINANCE: Metric[] = [
  { key: "captured", label: "Encaissé", hint: "débits (captures)", money: true },
  { key: "refunded", label: "Remboursé", hint: "aux Expéditeurs, toutes causes", money: true },
  { key: "paidOut", label: "Versé aux Voyageurs", hint: "transferts partis", money: true },
  { key: "revenue", label: "Revenu reconnu", hint: "commission + prime des deals terminés", money: true },
  { key: "retention", label: "Retenues nées", hint: "annulations tardives", money: true },
];
const LINE = "#2a78d6";

function valueOf(p: PilotageSeriesPoint, m: Metric, currency: string | null): number {
  if (!m.money) return p[m.key as keyof PilotageSeriesPoint] as number;
  const f = p.finance.find((x) => x.currencyCode === currency);
  if (!f) return 0;
  const map: Record<string, number> = { captured: f.capturedCents, refunded: f.refundedCents, paidOut: f.paidOutCents, revenue: f.revenueCents, retention: f.retentionCents };
  return map[m.key] ?? 0;
}

export default function PilotageView() {
  const [tab, setTab] = useState<"activity" | "finance">("activity");
  const [granularity, setGranularity] = useState<"week" | "month">("week");
  const [months, setMonths] = useState(3);
  const [days, setDays] = useState(30);
  const [currency, setCurrency] = useState<string | null>(null);
  const [series, setSeries] = useState<PilotageSeriesResponse | null>(null);
  const [corridors, setCorridors] = useState<CorridorsResponse | null>(null);
  const [expanded, setExpanded] = useState<PilotageMetric | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setSeries(null);
    apiFetch<PilotageSeriesResponse>(`/admin/pilotage/series?granularity=${granularity}&months=${months}`).then(setSeries).catch((e) => setErr(e instanceof ApiError ? `${e.status} : ${e.message}` : "Chargement impossible."));
  }, [granularity, months]);
  useEffect(() => {
    setCorridors(null);
    apiFetch<CorridorsResponse>(`/admin/pilotage/corridors?days=${days}`).then(setCorridors).catch((e) => setErr(e instanceof ApiError ? `${e.status} : ${e.message}` : "Chargement impossible."));
  }, [days]);
  const currencies = useMemo(() => [...new Set((series?.points ?? []).flatMap((p) => p.finance.map((f) => f.currencyCode)))].sort(), [series]);
  useEffect(() => { if (!currency && currencies.length) setCurrency(currencies[0]); }, [currencies, currency]);

  if (err) return <p className="mt-4 text-[13px] text-red-700">{err}</p>;
  const metrics = tab === "activity" ? ACTIVITY : FINANCE;
  const cur = currency ?? currencies[0] ?? "EUR";
  const points = series?.points ?? [];
  const expandedMetric = expanded ? [...ACTIVITY, ...FINANCE].find((m) => m.key === expanded) ?? null : null;

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
        <div className="flex gap-1 rounded-lg border border-slate-300 p-0.5">
          <button onClick={() => { setTab("activity"); setExpanded(null); }} className={`rounded-md px-3 py-1 ${tab === "activity" ? "bg-slate-900 text-white" : ""}`}>Activité</button>
          <button onClick={() => { setTab("finance"); setExpanded(null); }} className={`rounded-md px-3 py-1 ${tab === "finance" ? "bg-slate-900 text-white" : ""}`}>Finances</button>
        </div>
        <label className="ml-2 flex items-center gap-1">par
          <select value={granularity} onChange={(e) => { const g = e.target.value as "week" | "month"; setGranularity(g); setMonths(g === "week" ? 3 : 12); }} className="rounded-lg border border-slate-300 px-2 py-1.5">
            <option value="week">semaine</option><option value="month">mois</option>
          </select>
        </label>
        <label className="flex items-center gap-1">sur
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="rounded-lg border border-slate-300 px-2 py-1.5">
            {[1, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} mois</option>)}
          </select>
        </label>
        {tab === "finance" && currencies.length > 1 && (
          <label className="flex items-center gap-1">devise
            <select value={cur} onChange={(e) => setCurrency(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5">{currencies.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          </label>
        )}
        {series && <span className="text-[11px] text-slate-400">calculé le {dateTime(series.generatedAt)}{series.cached ? " (cache)" : ""}</span>}
      </div>

      {!series ? <p className="mt-4 text-[13px] text-slate-500">Chargement…</p> : expandedMetric ? (
        <ExpandedChart metric={expandedMetric} points={points} currency={cur} granularity={granularity} onClose={() => setExpanded(null)} />
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {metrics.map((m) => (
            <LineChart key={m.key} title={m.label} hint={m.hint} points={points.map((p) => ({ x: p.period, y: valueOf(p, m, cur) }))} unit={m.money ? cur : undefined} height={220} onExpand={() => setExpanded(m.key)} />
          ))}
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

/** Vue agrandie : courbe pleine largeur, tableau dessous, clic sur un point → liste des éléments (drill-down). */
function ExpandedChart({ metric, points, currency, granularity, onClose }: { metric: Metric; points: PilotageSeriesPoint[]; currency: string; granularity: "week" | "month"; onClose: () => void }) {
  const data = points.map((p) => ({ x: p.period, y: valueOf(p, metric, currency) }));
  const [selected, setSelected] = useState<string | null>(null);
  const [drill, setDrill] = useState<PilotageDrilldownResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!selected) { setDrill(null); return; }
    setBusy(true); setErr(null);
    apiFetch<PilotageDrilldownResponse>(`/admin/pilotage/drilldown?metric=${metric.key}&granularity=${granularity}&period=${encodeURIComponent(selected)}`).then(setDrill).catch((e) => setErr(e instanceof ApiError ? `${e.status} : ${e.message}` : "Chargement impossible.")).finally(() => setBusy(false));
  }, [selected, metric.key, granularity]);
  const unit = metric.money ? currency : undefined;
  const fmt = (y: number) => (unit ? money(y, unit) : String(y));
  const href = (it: { kind: string; id: string }) => (it.kind === "USER" ? `/users/${it.id}` : it.kind === "TRIP" ? `/trips/${it.id}` : `/deals/${it.id}`);
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px]">← Toutes les courbes</button>
        <span className="text-[12px] text-slate-500">Clique un point pour voir les éléments de la période.</span>
      </div>
      <div className="mt-3">
        <LineChart title={metric.label} hint={metric.hint} points={data} unit={unit} height={360} big onSelect={(x) => setSelected(x)} selected={selected} />
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-2">Période</th><th className="px-3 py-2 text-right">{metric.label}</th><th className="px-3 py-2 text-right">Variation</th></tr></thead>
            <tbody>
              {data.map((d, i) => {
                const prev = i > 0 ? data[i - 1].y : null;
                const delta = prev == null ? null : d.y - prev;
                return (
                  <tr key={d.x} onClick={() => setSelected(d.x)} className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${selected === d.x ? "bg-blue-50" : ""}`}>
                    <td className="px-3 py-1.5 font-semibold">{d.x}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(d.y)}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${delta == null ? "text-slate-400" : delta > 0 ? "text-emerald-700" : delta < 0 ? "text-red-700" : "text-slate-400"}`}>{delta == null ? "—" : `${delta > 0 ? "+" : ""}${unit ? money(delta, unit) : delta}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{selected ? `Éléments · ${selected}` : "Éléments de la période"}</h3>
          {!selected && <p className="mt-2 text-[12.5px] text-slate-500">Sélectionne un point ou une ligne du tableau.</p>}
          {busy && <p className="mt-2 text-[12.5px] text-slate-500">Chargement…</p>}
          {err && <p className="mt-2 text-[12px] text-red-700">{err}</p>}
          {drill && !busy && (
            <>
              <p className="mt-1 text-[11.5px] text-slate-500">{drill.total} élément(s){drill.truncated ? " · 200 premiers affichés" : ""} · du {dateTime(drill.periodStart)} au {dateTime(drill.periodEnd)}</p>
              {drill.items.length === 0 ? <p className="mt-2 text-[12.5px] text-slate-500">Rien sur cette période.</p> : (
                <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto text-[12.5px]">
                  {drill.items.map((it) => (
                    <li key={`${it.kind}-${it.id}`} className="flex flex-wrap items-baseline gap-x-2 border-t border-slate-100 py-1">
                      <span className="rounded bg-slate-100 px-1.5 text-[10px] font-semibold uppercase">{it.kind === "USER" ? "compte" : it.kind === "TRIP" ? "trajet" : "deal"}</span>
                      <Link href={href(it)} className="font-semibold underline-offset-2 hover:underline">{it.label}</Link>
                      {it.status && <span className="font-mono text-[11px] text-slate-500">{it.status}</span>}
                      {it.amountCents != null && <span className="tabular-nums">{money(it.amountCents, it.currencyCode ?? "EUR")}</span>}
                      <span className="ml-auto text-[11px] text-slate-400">{dateTime(it.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Courbe à une série : marques fines, axe unique, grille discrète, survol avec repère et infobulle, dernier point étiqueté, clic = sélection. */
function LineChart({ title, hint, points, unit, height, big, onExpand, onSelect, selected }: { title: string; hint?: string; points: Array<{ x: string; y: number }>; unit?: string; height: number; big?: boolean; onExpand?: () => void; onSelect?: (x: string) => void; selected?: string | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = big ? 900 : 480, H = height, PL = unit ? 64 : 40, PR = 16, PT = 16, PB = 26;
  const max = Math.max(1, ...points.map((p) => p.y));
  const n = points.length;
  const px = (i: number) => PL + (n <= 1 ? 0 : (i * (W - PL - PR)) / (n - 1));
  const py = (y: number) => PT + (H - PT - PB) * (1 - y / max);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  const fmt = (y: number) => (unit ? money(y, unit) : String(y));
  const axis = (y: number) => (unit ? `${Math.round(y / 100)}` : String(Math.round(y)));
  const total = points.reduce((a, p) => a + p.y, 0);
  const last = points[n - 1];
  const fs = big ? 12 : 10;
  const nearest = (clientX: number, el: SVGSVGElement) => { const r = el.getBoundingClientRect(); const x = ((clientX - r.left) / r.width) * W; let best = 0; for (let i = 0; i < n; i++) if (Math.abs(px(i) - x) < Math.abs(px(best) - x)) best = i; return best; };
  const labelEvery = Math.max(1, Math.ceil(n / (big ? 12 : 6)));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div><p className="text-[13px] font-semibold text-slate-800">{title}</p>{hint && <p className="text-[11px] text-slate-500">{hint}</p>}</div>
        <div className="flex items-center gap-2"><p className="text-[11.5px] text-slate-500">total {fmt(total)}</p>{onExpand && <button onClick={onExpand} className="rounded-md border border-slate-300 px-2 py-0.5 text-[11px]">Agrandir</button>}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" style={{ minHeight: height }} role="img" aria-label={`${title} : ${points.map((p) => `${p.x} ${fmt(p.y)}`).join(", ")}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => setHover(nearest(e.clientX, e.currentTarget))}
        onClick={(e) => { if (onSelect && n > 0) onSelect(points[nearest(e.clientX, e.currentTarget)].x); }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={PL} x2={W - PR} y1={py(max * f)} y2={py(max * f)} stroke="#e5e7eb" strokeWidth={1} /><text x={PL - 6} y={py(max * f) + 4} fontSize={fs} textAnchor="end" fill="#6b7280">{axis(max * f)}{unit && f === 1 ? ` ${unit}` : ""}</text></g>)}
        {n > 0 && <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p, i) => (selected === p.x ? <circle key={p.x} cx={px(i)} cy={py(p.y)} r={6} fill="#fff" stroke={LINE} strokeWidth={2} /> : null))}
        {last && n > 0 && <circle cx={px(n - 1)} cy={py(last.y)} r={4} fill={LINE} stroke="#fff" strokeWidth={2} />}
        {last && <text x={px(n - 1)} y={py(last.y) - 8} fontSize={fs + 1} textAnchor="end" fill="#0b0b0b" fontWeight={600}>{fmt(last.y)}</text>}
        {points.map((p, i) => (i % labelEvery === 0 || i === n - 1 ? <text key={p.x} x={px(i)} y={H - 8} fontSize={fs - 1} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fill="#6b7280">{p.x}</text> : null))}
        {hover != null && points[hover] && (
          <g>
            <line x1={px(hover)} x2={px(hover)} y1={PT} y2={H - PB} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={px(hover)} cy={py(points[hover].y)} r={5} fill={LINE} stroke="#fff" strokeWidth={2} />
            <rect x={Math.min(px(hover) + 8, W - 150)} y={PT} width={140} height={38} rx={6} fill="#0b0b0b" opacity={0.92} />
            <text x={Math.min(px(hover) + 14, W - 144)} y={PT + 15} fontSize={fs} fill="#fff">{points[hover].x}</text>
            <text x={Math.min(px(hover) + 14, W - 144)} y={PT + 31} fontSize={fs + 1} fill="#fff" fontWeight={700}>{fmt(points[hover].y)}</text>
          </g>
        )}
      </svg>
    </div>
  );
}
