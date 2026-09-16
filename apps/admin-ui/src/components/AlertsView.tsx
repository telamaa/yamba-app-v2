"use client";

/**
 * AlertsView.tsx — la page des alertes de seuil (A150)
 * =====================================================
 * Les neuf règles s'affichaient toutes sur l'accueil : avec plusieurs alertes ouvertes,
 * la page devenait un mur qu'il fallait dérouler avant d'atteindre les compteurs. L'accueil
 * ne garde qu'un résumé d'une ligne ; le détail vit ici, groupé par gravité, avec les seuils
 * qui ont servi au calcul.
 */
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { can, type AdminPermission } from "@/lib/permissions";
import type { AdminMe, OpsAlertsResponse } from "@/lib/types";
import { isPermissionRefusal, useDenyPage } from "./PageAccess";

/**
 * Recette 02-ADMIN § 5.11 — une alerte de versement menait le Support (kpi.read, sans finances.read) vers un écran qui
 * lui répond 403. L'alerte reste visible (tout profil à kpi.read doit savoir que la plateforme souffre), mais le lien
 * n'est offert qu'au profil qui peut ouvrir la destination ; les autres lisent à qui la transmettre.
 */
const DESTINATION: Array<{ prefix: string; permission: AdminPermission; who: string }> = [
  { prefix: "/finances", permission: "finances.read", who: "Finance ou Médiateur" },
  { prefix: "/disputes", permission: "disputes.read", who: "Médiateur, Support ou Finance" },
  { prefix: "/pilotage", permission: "pilotage.read", who: "Finance ou Médiateur" },
];
const destinationOf = (href: string) => DESTINATION.find((d) => href.startsWith(d.prefix)) ?? null;

export default function AlertsView() {
  const [data, setData] = useState<OpsAlertsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deny = useDenyPage(); // décision du 15/09 : un refus de permission remplace la page entière
  const [me, setMe] = useState<AdminMe | null>(null);

  useEffect(() => {
    apiFetch<AdminMe>("/admin/me").then(setMe).catch(() => undefined);
  }, []);

  useEffect(() => {
    apiFetch<OpsAlertsResponse>("/admin/alerts").then(setData).catch((e) => (isPermissionRefusal(e) ? deny("Ton profil ne lit pas les alertes de seuil.") : setError("Alertes indisponibles pour le moment. Recharge la page.")));
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
              <Card
                href={a.href}
                actionable={!me || !destinationOf(a.href) || can(me.adminRoles, destinationOf(a.href)!.permission)}
                className={`block rounded-xl border px-3 py-2.5 ${tone === "critical" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <b className="text-[13.5px]">{a.title}</b>
                  {a.count !== null && <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10.5px] font-semibold">{a.count} concerné{a.count > 1 ? "s" : ""}</span>}
                  <span className="ml-auto text-[11px] opacity-70">{a.rule}</span>
                </div>
                <p className="mt-0.5 text-[12.5px]">{a.detail}</p>
                {!me || !destinationOf(a.href) || can(me.adminRoles, destinationOf(a.href)!.permission) ? (
                  <p className="mt-1 text-[11px] underline underline-offset-2">Aller traiter →</p>
                ) : (
                  <p className="mt-1 text-[11px]">Ton profil n&apos;ouvre pas cette file : transmets à {destinationOf(a.href)!.who}.</p>
                )}
              </Card>
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

/** Une carte d'alerte : un lien quand le profil peut agir, un simple bloc sinon (jamais un lien vers un 403). */
function Card({ href, actionable, className, children }: { href: string; actionable: boolean; className: string; children: ReactNode }) {
  return actionable ? <Link href={href} className={`${className} hover:opacity-90`}>{children}</Link> : <div className={className}>{children}</div>;
}
