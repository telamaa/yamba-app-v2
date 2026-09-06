"use client";

/**
 * AlertsView.tsx — la page des alertes de seuil (A150)
 * =====================================================
 * Les neuf règles s'affichaient toutes sur l'accueil : avec plusieurs alertes ouvertes,
 * la page devenait un mur qu'il fallait dérouler avant d'atteindre les compteurs. L'accueil
 * ne garde qu'un résumé d'une ligne ; le détail vit ici, groupé par gravité, avec les seuils
 * qui ont servi au calcul.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { OpsAlertsResponse } from "@/lib/types";

export default function AlertsView() {
  const [data, setData] = useState<OpsAlertsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<OpsAlertsResponse>("/admin/alerts").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="mt-4 text-[13px] text-red-700">{error}</p>;
  if (!data) return <p className="mt-4 text-[13px] text-slate-500">Chargement…</p>;

  const critical = data.alerts.filter((a) => a.severity === "critical");
  const warning = data.alerts.filter((a) => a.severity !== "critical");

  const group = (title: string, list: typeof data.alerts, tone: "critical" | "warning") =>
    list.length === 0 ? null : (
      <section className="mt-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {title} · {list.length}
        </h2>
        <ul className="mt-2 space-y-2">
          {list.map((a) => (
            <li key={a.rule}>
              <Link
                href={a.href}
                className={`block rounded-xl border px-3 py-2.5 hover:opacity-90 ${tone === "critical" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <b className="text-[13.5px]">{a.title}</b>
                  {a.count !== null && <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10.5px] font-semibold">{a.count} concerné{a.count > 1 ? "s" : ""}</span>}
                  <span className="ml-auto text-[11px] opacity-70">{a.rule}</span>
                </div>
                <p className="mt-0.5 text-[12.5px]">{a.detail}</p>
                <p className="mt-1 text-[11px] underline underline-offset-2">Aller traiter →</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <>
      {data.alerts.length === 0 ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
          Aucune alerte : versements, litiges, relais d&apos;événements, emails et publication sont dans les clous.
        </p>
      ) : (
        <>
          {group("Critiques", critical, "critical")}
          {group("À surveiller", warning, "warning")}
        </>
      )}

      <section className="mt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Seuils utilisés</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-3 py-2">Paramètre</th><th className="px-3 py-2">Valeur</th></tr>
            </thead>
            <tbody>
              {Object.entries(data.thresholds).map(([k, v]) => (
                <tr key={k} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-mono text-[11.5px]">{k}</td>
                  <td className="px-3 py-1.5 tabular-nums">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Réglables dans <Link href="/settings" className="underline">Paramètres › Alertes d&apos;exploitation</Link>. Évaluées à la lecture, le {new Date(data.evaluatedAt).toLocaleString("fr-FR")} ; le support reçoit un email à la première apparition d&apos;une règle dans la journée.
        </p>
      </section>
    </>
  );
}
