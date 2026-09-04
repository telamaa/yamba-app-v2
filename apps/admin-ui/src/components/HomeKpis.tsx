"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { AdminHomeKpis, OpsAlertsResponse } from "@/lib/types";

type Tile = { key: keyof AdminHomeKpis; label: string; href: string; tone: "act" | "info" };
const TILES: Tile[] = [
  { key: "disputesToDecide", label: "Litiges à trancher", href: "/disputes", tone: "act" },
  { key: "retentionsHeld", label: "Retenues à arbitrer", href: "/disputes", tone: "act" },
  { key: "ticketsToVerify", label: "Billets à vérifier", href: "/tickets", tone: "act" },
  { key: "hideProposals", label: "Masquages proposés", href: "/trips?hideProposed=1", tone: "act" },
  { key: "suspensionProposals", label: "Sanctions proposées", href: "/users", tone: "act" },
  { key: "payoutsFailed", label: "Versements en échec", href: "/finances?kind=FAILED", tone: "act" },
  { key: "payoutsReversed", label: "Transferts renversés", href: "/finances?kind=REVERSED", tone: "act" },
  { key: "manualRefundProposals", label: "Remboursements proposés", href: "/finances?kind=PROPOSED_REFUNDS", tone: "act" },
  { key: "pendingAdminInvites", label: "Invitations admin en attente", href: "/admins", tone: "act" },
  { key: "activeDeals", label: "Deals en cours", href: "/trips", tone: "info" },
  { key: "publishedTrips", label: "Trajets publiés à venir", href: "/trips?status=PUBLISHED", tone: "info" },
  { key: "hiddenTrips", label: "Trajets masqués", href: "/trips?hidden=1", tone: "info" },
  { key: "restrictedUsers", label: "Comptes restreints", href: "/users", tone: "info" },
  { key: "suspendedUsers", label: "Comptes suspendus", href: "/users", tone: "info" },
  { key: "usersTotal", label: "Comptes", href: "/users", tone: "info" },
  { key: "completedDeals30d", label: "Deals terminés (30 j)", href: "/trips", tone: "info" },
];

export default function HomeKpis() {
  const [k, setK] = useState<AdminHomeKpis | null>(null);
  const [alerts, setAlerts] = useState<OpsAlertsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<AdminHomeKpis>("/admin/kpis").then(setK).catch((e) => setError(e.message));
    apiFetch<OpsAlertsResponse>("/admin/alerts").then(setAlerts).catch(() => setAlerts(null)); // C-PR6b — sans état, recalculées à chaque lecture
  }, []);
  if (error) return <p className="mt-4 text-[13px] text-red-700">{error}</p>;
  if (!k) return <p className="mt-4 text-[13px] text-slate-500">Chargement…</p>;
  const visible = TILES.filter((t) => k[t.key] !== null);
  const act = visible.filter((t) => t.tone === "act");
  const info = visible.filter((t) => t.tone === "info");
  const Grid = ({ tiles, title }: { tiles: Tile[]; title: string }) => (
    <section className="mt-5">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => {
          const v = k[t.key] as number;
          return (
            <Link key={t.key} href={t.href} className={`rounded-xl border p-4 hover:bg-slate-50 ${t.tone === "act" && v > 0 ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
              <p className="text-2xl font-black tabular-nums">{v}</p>
              <p className="mt-1 text-[12px] text-slate-600">{t.label}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
  return (
    <>
      {alerts && (
        <section className="mt-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Alertes de seuil</h2>
          {alerts.alerts.length === 0 ? (
            <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">Aucune alerte : versements, litiges, relais, emails et liquidité dans les seuils.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {alerts.alerts.map((a) => (
                <li key={a.rule}>
                  <Link href={a.href} className={`block rounded-xl border px-3 py-2 hover:opacity-90 ${a.severity === "critical" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                    <span className="mr-2 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase">{a.severity === "critical" ? "critique" : "attention"}</span>
                    <b className="text-[13px]">{a.title}</b>
                    <span className="ml-2 text-[12px]">{a.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[11px] text-slate-400">Évaluées le {new Date(alerts.evaluatedAt).toLocaleString("fr-FR")} · le support reçoit un email à la première apparition d'une règle dans la journée.</p>
        </section>
      )}
      {act.length > 0 && <Grid tiles={act} title="À traiter" />}
      {info.length > 0 && <Grid tiles={info} title="État de la plateforme" />}
      <p className="mt-4 text-[11px] text-slate-400">Calculé le {new Date(k.generatedAt).toLocaleString("fr-FR")}.</p>
    </>
  );
}
