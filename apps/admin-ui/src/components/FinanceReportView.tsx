"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "@/lib/api";
import { dateTime, money } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { AdminMe, FinanceReport } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

export default function FinanceReportView() {
  const [months, setMonths] = useState(12);
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [me, setMe] = useState<AdminMe | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [from, setFrom] = useState(() => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => {
    setReport(null);
    apiFetch<FinanceReport>(`/admin/finances/report?months=${months}`).then(setReport).catch((e) => setErr(e instanceof ApiError ? `${e.status} : ${e.message}` : "Chargement impossible."));
  }, [months]);
  useEffect(() => { apiFetch<AdminMe>("/admin/me").then(setMe).catch(() => undefined); }, []);

  function exportCsv() {
    // Téléchargement direct : le cookie admin suit (même origine via le proxy /api) ; l'export est journalisé côté serveur.
    const f = new Date(from + "T00:00:00Z").toISOString();
    const t = new Date(new Date(to + "T00:00:00Z").getTime() + 86_400_000).toISOString();
    window.open(`${API_BASE}/admin/finances/export?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`, "_blank", "noopener");
  }

  if (err) return <p className="mt-4 text-[13px] text-red-700">{err}</p>;
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <Link href="/finances" className="text-slate-500 hover:underline">← Files</Link>
        <label className="ml-2 flex items-center gap-1">période
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="rounded-lg border border-slate-300 px-2 py-1.5">
            {[3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} mois</option>)}
          </select>
        </label>
      </div>
      {!report ? <p className="mt-4 text-[13px] text-slate-500">Chargement…</p> : (
        <>
          <section className="mt-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Aujourd'hui (passifs, jamais un revenu)</h2>
            {report.snapshot.length === 0 ? <p className="mt-2 text-[12.5px] text-slate-500">Rien d'en cours.</p> : report.snapshot.map((s) => (
              <div key={s.currencyCode} className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-5">
                <Tile label="Dû aux Voyageurs" v={money(s.pendingPayoutCents, s.currencyCode)} hint="PENDING + FAILED" />
                <Tile label="Gelé par un litige" v={money(s.frozenPayoutCents, s.currencyCode)} />
                <Tile label="Renversé, à décider" v={money(s.reversedOpenCents, s.currencyCode)} />
                <Tile label="Retenues à arbitrer" v={money(s.heldRetentionCents, s.currencyCode)} />
                <Tile label="Remboursements proposés" v={money(s.proposedRefundCents, s.currencyCode)} />
              </div>
            ))}
          </section>
          <section className="mt-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Par mois</h2>
            <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-[12.5px]">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr><th className="px-3 py-2">Mois</th><th className="px-3 py-2">Devise</th><th className="px-3 py-2 text-right">Encaissé</th><th className="px-3 py-2 text-right">Remboursé</th><th className="px-3 py-2 text-right">Versé</th><th className="px-3 py-2 text-right">Revenu (commission + prime)</th><th className="px-3 py-2 text-right">Retenues nées</th><th className="px-3 py-2 text-right">Deals terminés / annulés</th></tr>
                </thead>
                <tbody>
                  {report.months.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Aucun mouvement sur la période.</td></tr>}
                  {report.months.map((m) => (
                    <tr key={`${m.month}|${m.currencyCode}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold">{m.month}</td><td className="px-3 py-2">{m.currencyCode}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(m.capturedCents, m.currencyCode)} <span className="text-[10.5px] text-slate-400">×{m.capturedCount}</span></td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(m.refundedCents, m.currencyCode)} <span className="text-[10.5px] text-slate-400">×{m.refundCount}</span></td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(m.paidOutCents, m.currencyCode)} <span className="text-[10.5px] text-slate-400">×{m.payoutCount}</span></td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(m.revenueCents, m.currencyCode)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(m.retentionCents, m.currencyCode)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.completedCount} / {m.cancelledCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Du {dateTime(report.from)} au {dateTime(report.to)} · calculé le {dateTime(report.generatedAt)}. Un deal capturé en mars et terminé en avril compte dans les deux mois, chaque fait à sa date.</p>
          </section>
          {can(me?.adminRoles, "finances.export") && (
            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Export CSV par deal (journalisé)</h2>
              <p className="mt-1 text-[12px] text-slate-500">Une ligne par deal ayant un fait d'argent dans la période (au plus 366 jours) : montants figés, remboursement, versement, retenue, identifiants Stripe pour le rapprochement comptable.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
                <label>du <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-slate-300 px-2 py-1" /></label>
                <label>au <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border border-slate-300 px-2 py-1" /></label>
                <button onClick={exportCsv} className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white">Télécharger le CSV</button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
function Tile({ label, v, hint }: { label: string; v: string; hint?: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-lg font-black tabular-nums">{v}</p><p className="text-[11.5px] text-slate-600">{label}{hint ? <span className="text-slate-400"> · {hint}</span> : null}</p></div>;
}
