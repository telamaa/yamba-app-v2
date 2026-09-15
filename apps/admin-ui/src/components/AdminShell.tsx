/**
 * AdminShell.tsx — garde de session + navigation du back-office
 * =============================================================
 * Charge /admin/me au montage : 401 → /login (après une tentative de refresh
 * par le client). Session courte (15 min d'accès, 45 min d'inactivité) :
 * chaque navigation re-vérifie.
 *
 * Décision du § 5.23 (recette 02-ADMIN § 5.24, lot a) : SEUL un 401 renvoie à /login. auth-service arrêté (502
 * UPSTREAM_UNREACHABLE), une 5xx ou le réseau coupé renvoyaient aussi à /login — l'admin retapait mot de passe et TOTP
 * sur un écran qui ne pouvait pas répondre, alors que sa session était intacte. Toute autre erreur affiche un écran
 * d'indisponibilité avec « Réessayer » ; la session (cookies) n'est pas touchée.
 *
 * A188 c (recette § 5.26, ANO-ADM-82) — « Se déconnecter » ignorait l'échec de l'appel et affichait /login : le service
 * injoignable, la session restait ouverte (cookies httpOnly, que seul le serveur efface) et revenir sur /home rouvrait le
 * back-office. /login seulement après un 200 (ou un 401 : la session était déjà fermée) ; sinon l'écran le dit.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, apiFetch, post } from "@/lib/api";
import type { AdminMe } from "@/lib/types";
import { can, rolesLabel } from "@/lib/permissions";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import { backupCodesWarning } from "@/lib/format";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch<AdminMe>("/admin/me")
      .then((m) => {
        if (!alive) return;
        setMe(m);
        setUnavailable(false);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setUnavailable(true);
      })
      .finally(() => alive && setRetrying(false));
    return () => {
      alive = false;
    };
  }, [router, pathname, attempt]);

  async function logout() {
    setLoggingOut(true);
    setLogoutError(false);
    try {
      await post("/auth/admin/logout");
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        setLogoutError(true);
        setLoggingOut(false);
        return;
      }
    }
    router.replace("/login");
  }

  if (unavailable) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <p className="text-[15px] font-bold">Yamba · Admin</p>
        <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900">
          <p className="font-semibold">Back-office momentanément injoignable</p>
          <p className="mt-1">Le service qui vérifie ta session ne répond pas. Ta session n&apos;est pas fermée : réessaie dans un instant.</p>
          <button type="button" disabled={retrying} onClick={() => { setRetrying(true); setAttempt((n) => n + 1); }} className="mt-3 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-60">
            {retrying ? "Nouvel essai…" : "Réessayer"}
          </button>
        </div>
      </div>
    );
  }
  if (!me) return <div className="p-8 text-[13px] text-slate-500">Vérification de la session…</div>;

  const nav = [
    { href: "/home", label: "Accueil" },
    ...(can(me.adminRoles, "kpi.read") ? [{ href: "/alerts", label: "Alertes" }] : []), // A150
    ...(can(me.adminRoles, "disputes.read") ? [{ href: "/disputes", label: "À arbitrer" }] : []),
    ...(can(me.adminRoles, "tickets.review") ? [{ href: "/tickets", label: "Billets" }] : []),
    ...(can(me.adminRoles, "trips.read") ? [{ href: "/trips", label: "Trajets" }] : []),
    ...(can(me.adminRoles, "reports.review") ? [{ href: "/reports", label: "Signalements" }] : []),
    ...(can(me.adminRoles, "finances.read") ? [{ href: "/finances", label: "Finances" }] : []),
    ...(can(me.adminRoles, "pilotage.read") ? [{ href: "/pilotage", label: "Pilotage" }] : []),
    ...(can(me.adminRoles, "users.read") ? [{ href: "/users", label: "Utilisateurs" }] : []),
    ...(can(me.adminRoles, "audit.read") ? [{ href: "/audit", label: "Journal" }] : []),
    ...(can(me.adminRoles, "settings.read") ? [{ href: "/settings", label: "Paramètres" }] : []),
    ...(can(me.adminRoles, "privacy.requests.read") ? [{ href: "/privacy", label: "Données personnelles" }] : []),
    ...(can(me.adminRoles, "status.read") ? [{ href: "/status", label: "État des services" }] : []),
    ...(can(me.adminRoles, "admins.manage") ? [{ href: "/admins", label: "Comptes admin" }] : []),
    { href: "/sessions", label: "Mes sessions" },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4">
        <p className="text-[15px] font-bold">Yamba · Admin</p>
        <p className="mt-0.5 text-[12px] text-slate-500">{me.firstName} {me.lastName}</p>
        <p className="text-[11px] font-semibold text-slate-700">{rolesLabel(me.adminRoles)}</p>
        <nav className="mt-6 space-y-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={`block rounded-lg px-3 py-2 text-[13.5px] font-medium ${pathname.startsWith(n.href) ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        {me.remainingBackupCodes <= 2 && <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">{backupCodesWarning(me.remainingBackupCodes)}</p>}
        <button onClick={logout} disabled={loggingOut} className="mt-6 text-[12.5px] text-slate-500 underline-offset-2 hover:underline disabled:opacity-60">{loggingOut ? "Déconnexion…" : "Se déconnecter"}</button>
        {logoutError && (
          <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-800">Déconnexion impossible : le service ne répond pas, ta session est toujours ouverte. Réessaie dans un instant.</p>
        )}
      </aside>
      <main className="min-w-0 flex-1 p-6">
        <MaintenanceBanner />
        {children}
      </main>
    </div>
  );
}
