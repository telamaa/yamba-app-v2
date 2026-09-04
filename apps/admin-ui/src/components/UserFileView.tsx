/**
 * UserFileView.tsx — la fiche d'un utilisateur et la suspension (C-PR3, D56)
 * ==========================================================================
 * SUPPORT propose ; MEDIATOR / SUPER_ADMIN exécute ou lève. Jamais sur soi.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch, del, post } from "@/lib/api";
import { ACTION_LABEL, STATUS_LABEL, dateTime, money } from "@/lib/format";
import { ROLE_LABEL, can } from "@/lib/permissions";
import type { AdminMe, AdminUserFile } from "@/lib/types";

const MIN_REASON = 20;

export default function UserFileView({ userId }: { userId: string }) {
  const [file, setFile] = useState<AdminUserFile | null>(null);
  const [me, setMe] = useState<AdminMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<AdminUserFile>(`/admin/users/${userId}`).then(setFile).catch((e) => setError(e instanceof ApiError ? `${e.status} : ${e.message}` : "Chargement impossible."));
  }, [userId]);
  useEffect(() => {
    load();
    apiFetch<AdminMe>("/admin/me").then(setMe).catch(() => undefined);
  }, [load]);

  if (error) return <p className="text-[13px] text-red-700">{error}</p>;
  if (!file) return <p className="text-[13px] text-slate-500">Chargement…</p>;

  const canPropose = can(me?.adminRole, "users.suspension.propose") && !file.isMe && (!file.adminRole || me?.adminRole === "SUPER_ADMIN");
  const canApply = can(me?.adminRole, "users.suspension.apply") && !file.isMe && (!file.adminRole || me?.adminRole === "SUPER_ADMIN");

  return (
    <div className="max-w-5xl">
      <Link href="/users" className="text-[12.5px] text-slate-500 hover:underline">← Utilisateurs</Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-bold">{file.firstName} {file.lastName}</h1>
        <span className="text-[13px] text-slate-500">{file.email}{file.phoneE164 ? ` · ${file.phoneE164}` : ""} · {file.preferredLocale}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${file.accountStatus === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : file.accountStatus === "RESTRICTED" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>{STATUS_LABEL[file.accountStatus]}</span>
        {file.adminRole && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">{ROLE_LABEL[file.adminRole]}</span>}
        {file.isMe && <span className="text-[11px] text-slate-500">(c'est toi : aucune action possible)</span>}
      </div>

      {file.suspension && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
          {STATUS_LABEL[file.suspension.level]} depuis le {dateTime(file.suspension.at)} par {file.suspension.byAdmin}{file.suspension.until ? `, jusqu'au ${dateTime(file.suspension.until)}` : ""} — motif : {file.suspension.reason}
        </div>
      )}
      {file.suspensionProposal && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
          Proposition de {file.suspensionProposal.byAdmin} le {dateTime(file.suspensionProposal.at)} : {STATUS_LABEL[file.suspensionProposal.level]} — {file.suspensionProposal.reason}
        </div>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card title="Compte">
          <Row k="Rôles client" v={file.roles.filter((r) => r !== "ADMIN").join(" · ") || "aucun"} />
          <Row k="Inscrit le" v={dateTime(file.createdAt)} />
          <Row k="Sessions actives" v={String(file.activity.activeSessionsCount)} />
          <Row k="Deals en cours" v={String(file.activity.activeDealsCount)} />
        </Card>
        <Card title="Voyageur">
          {file.carrier ? (
            <>
              <Row k="Statut" v={file.carrier.status} />
              <Row k="Compte Stripe" v={file.carrier.stripeAccountId ?? "aucun"} />
              <Row k="Encaissements / versements" v={`${file.carrier.stripeChargesEnabled ? "oui" : "non"} / ${file.carrier.stripePayoutsEnabled ? "oui" : "non"}`} />
              <Facts f={file.carrier} />
            </>
          ) : (
            <p className="text-[12.5px] text-slate-500">Pas de profil Voyageur.</p>
          )}
        </Card>
        <Card title="Expéditeur">
          <Facts f={file.shipper} />
        </Card>
        <SuspensionCard file={file} canPropose={canPropose} canApply={canApply} onDone={load} />
      </div>

      <Card title={`Trajets (${file.activity.trips.length})`} className="mt-5">
        {file.activity.trips.length > 0 && <Link href={`/trips?carrierId=${userId}`} className="text-[12px] underline">Ouvrir dans Trajets (fiches, masquage)</Link>}
        {file.activity.trips.length === 0 ? <p className="text-[12.5px] text-slate-500">Aucun trajet.</p> : (
          <table className="w-full text-[12.5px]">
            <tbody>
              {file.activity.trips.map((t) => (
                <tr key={t.id} className="border-t border-slate-100"><td className="py-1">{t.originCity} → {t.destinationCity}</td><td className="py-1">{dateTime(t.departureAt)}</td><td className="py-1 font-mono text-[11px]">{t.status}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title={`Deals (${file.activity.deals.length})`} className="mt-5">
        {file.activity.deals.length === 0 ? <p className="text-[12.5px] text-slate-500">Aucun deal.</p> : (
          <table className="w-full text-[12.5px]">
            <tbody>
              {file.activity.deals.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="py-1">{d.role === "SHIPPER" ? "Exp." : "Voy."}</td>
                  <td className="py-1">{d.originCity} → {d.destinationCity}</td>
                  <td className="py-1 font-mono text-[11px]">{d.status}{d.disputeTicket ? ` · ${d.disputeTicket}` : ""}</td>
                  <td className="py-1 text-right tabular-nums">{d.role === "SHIPPER" ? money(d.totalShipperCents, d.currencyCode) : money(d.transportCents, d.currencyCode)}</td>
                  <td className="py-1 whitespace-nowrap">{dateTime(d.requestedAt)}</td>
                  <td className="py-1 whitespace-nowrap">{d.disputeTicket ? <Link href={`/disputes/${d.id}`} className="underline">dossier</Link> : ""} <Link href={`/deals/${d.id}`} className="underline">argent</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title="Actions admin sur ce compte" className="mt-5">
        {file.adminActions.length === 0 ? <p className="text-[12.5px] text-slate-500">Aucune.</p> : (
          <ul className="space-y-1 text-[12.5px]">
            {file.adminActions.map((a) => (
              <li key={a.id}>{dateTime(a.at)} · {a.admin} · <b>{ACTION_LABEL[a.action] ?? a.action}</b>{a.after ? <span className="ml-1 font-mono text-[11px] text-slate-500">{JSON.stringify(a.after)}</span> : null}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SuspensionCard({ file, canPropose, canApply, onDone }: { file: AdminUserFile; canPropose: boolean; canApply: boolean; onDone: () => void }) {
  const [level, setLevel] = useState<"RESTRICTED" | "SUSPENDED">(file.suspensionProposal?.level === "SUSPENDED" ? "SUSPENDED" : "RESTRICTED");
  const [reason, setReason] = useState(file.suspensionProposal?.reason ?? "");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(action: "propose" | "apply" | "lift") {
    setBusy(true);
    setMsg(null);
    try {
      if (action === "propose") await post(`/admin/users/${file.id}/suspension/propose`, { level, reason: reason.trim() });
      if (action === "apply") await post(`/admin/users/${file.id}/suspension`, { level, reason: reason.trim(), ...(until ? { until: new Date(until).toISOString() } : {}) });
      if (action === "lift") await del(`/admin/users/${file.id}/suspension`, { reason: reason.trim() });
      setMsg("Fait.");
      onDone();
    } catch (e) {
      setMsg(e instanceof ApiError ? `${e.status} : ${e.message}` : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }
  if (!canPropose && !canApply) return <Card title="Sanction"><p className="text-[12.5px] text-slate-500">{file.isMe ? "Aucune action sur ton propre compte." : "Ton profil ne propose ni n'exécute de sanction."}</p></Card>;
  const ok = reason.trim().length >= MIN_REASON && !busy;
  return (
    <Card title="Sanction">
      <div className="flex gap-3 text-[12.5px]">
        <label className="flex items-center gap-1"><input type="radio" checked={level === "RESTRICTED"} onChange={() => setLevel("RESTRICTED")} /> Restreint (ni publier ni réserver)</label>
        <label className="flex items-center gap-1"><input type="radio" checked={level === "SUSPENDED"} onChange={() => setLevel("SUSPENDED")} /> Suspendu (connexion refusée)</label>
      </div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 2000))} rows={3} placeholder={`Motif (${MIN_REASON} caractères au moins), envoyé au membre sans le détail d'un signalement`} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-[12.5px]" />
      {canApply && (
        <label className="mt-2 block text-[12px] text-slate-600">Jusqu'au (optionnel) <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="ml-2 rounded border border-slate-300 px-2 py-1 text-[12px]" /></label>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {canPropose && !canApply && <button disabled={!ok} onClick={() => run("propose")} className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Proposer</button>}
        {canApply && file.accountStatus === "ACTIVE" && <button disabled={!ok} onClick={() => run("apply")} className="rounded-lg bg-red-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Appliquer</button>}
        {canApply && file.accountStatus !== "ACTIVE" && (
          <>
            <button disabled={!ok} onClick={() => run("apply")} className="rounded-lg bg-red-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Modifier la sanction</button>
            <button disabled={!ok} onClick={() => run("lift")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Lever</button>
          </>
        )}
      </div>
      {msg && <p className="mt-2 text-[12px] text-slate-600">{msg}</p>}
    </Card>
  );
}

function Facts({ f }: { f: AdminUserFile["shipper"] }) {
  return (
    <>
      <Row k="Niveau" v={f.reputationLevel ?? "—"} />
      <Row k="Avis révélés" v={f.ratingsCount > 0 ? `${f.ratingsAvg.toFixed(1)} sur ${f.ratingsCount}` : "aucun"} />
      <Row k="Deals terminés" v={String(f.completedDealsCount)} />
      <Row k="Annulations tardives" v={String(f.lateCancellationsCount)} />
      <Row k="Litiges perdus (interne)" v={String(f.disputesLostCount)} />
    </>
  );
}
function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      <div className="mt-2 space-y-1.5">{children}</div>
    </section>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-[13px]"><span className="text-slate-500">{k}</span><span className="text-right font-medium">{v}</span></div>
  );
}
