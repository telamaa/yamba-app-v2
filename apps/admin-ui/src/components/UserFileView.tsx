/**
 * UserFileView.tsx — la fiche d'un utilisateur et la suspension (C-PR3, D56)
 * ==========================================================================
 * SUPPORT propose ; MEDIATOR / SUPER_ADMIN exécute ou lève. Jamais sur soi.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch, del, post } from "@/lib/api";
import { ACTION_LABEL, auditDetail, SANCTION_CATEGORY_LABEL, STATUS_LABEL, TRUST_LEVEL_LABEL, dateTime, erasureBlockerLabel, money } from "@/lib/format";
import { can, isSuperAdmin, rolesLabel } from "@/lib/permissions";
import type { AdminMe, AdminUserFile, ErasureBlocker, SanctionCategory } from "@/lib/types";

const MIN_REASON = 20;
/** Recette § 5.5 — un motif inconnu (`UNKNOWN`) n'est plus affiché « rebond dur ». */
const SUPPRESSION_REASON_LABEL: Record<string, string> = { HARD_BOUNCE: "rebond dur", COMPLAINT: "plainte" };

/** Recette 02-ADMIN § 5.4 — un refus se lit par son code (A146), pas par son statut ; le message anglais reste un repli. */
const SANCTION_REFUS: Record<string, string> = {
  DATE_IN_PAST: "La date de fin doit être dans le futur.",
  ACCOUNT_NOT_RESTRICTED: "Ce compte n'a pas de sanction à lever.",
  ADMIN_IS_SELF: "Aucune action sur ton propre compte.",
  SUPER_ADMIN_ONLY: "Seul un super administrateur agit sur un compte admin.",
  ADMIN_PERMISSION_DENIED: "Ton profil n'a pas ce droit.",
  ACCOUNT_STATE_CHANGED: "Un autre administrateur vient d'agir sur ce compte : la fiche est rechargée, relis-la avant de recommencer.", // ANO-ADM-89
};
function refusDeSanction(e: unknown): string {
  if (!(e instanceof ApiError)) return "Action impossible.";
  const code = (e.data as { details?: { code?: string } } | undefined)?.details?.code;
  if (code && SANCTION_REFUS[code]) return SANCTION_REFUS[code];
  return e.status === 400 ? `Demande refusée : choisis une catégorie et écris un motif interne de ${MIN_REASON} caractères au moins.` : "Action impossible pour le moment. Réessaie.";
}
/**
 * Recette § 5.4 — « jusqu'au 20 septembre » se lit INCLUS : `new Date("2026-09-20")` valait minuit UTC, soit une
 * sanction levée à 2 h du matin le 20 à Paris. La fin est posée à 23:59:59 du jour choisi, heure de l'écran.
 */
const finDeJournee = (jour: string) => new Date(`${jour}T23:59:59`).toISOString();
/** Le lendemain, au format du champ date : une sanction datée finit au plus tôt demain. */
const demain = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

export default function UserFileView({ userId }: { userId: string }) {
  const [file, setFile] = useState<AdminUserFile | null>(null);
  const [me, setMe] = useState<AdminMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null); // recette § 5.5 — le geste réussi se nomme
  const [erasure, setErasure] = useState<string | null>(null); // recette § 5.21 — l'issue d'un effacement survit au rechargement de la fiche

  const load = useCallback(() => {
    apiFetch<AdminUserFile>(`/admin/users/${userId}`).then(setFile).catch((e) => setError(e instanceof ApiError ? `${e.status} : ${e.message}` : "Chargement impossible."));
  }, [userId]);
  useEffect(() => {
    load();
    apiFetch<AdminMe>("/admin/me").then(setMe).catch(() => undefined);
  }, [load]);

  if (error) return <p className="text-[13px] text-red-700">{error}</p>;
  if (!file) return <p className="text-[13px] text-slate-500">Chargement…</p>;

  const isAdminTarget = file.adminRoles.length > 0 || !!file.adminRole;
  const sanctionEchue = !!file.suspension?.until && new Date(file.suspension.until).getTime() <= Date.now(); // ANO-ADM-07
  const canPropose = can(me?.adminRoles, "users.suspension.propose") && !file.isMe && (!isAdminTarget || isSuperAdmin(me?.adminRoles));
  const canApply = can(me?.adminRoles, "users.suspension.apply") && !file.isMe && (!isAdminTarget || isSuperAdmin(me?.adminRoles));
  const canErase = can(me?.adminRoles, "users.erase") && !file.isMe && !file.isDeleted; // C-PR8b (D63 6A)

  return (
    <div className="max-w-5xl">
      <Link href="/users" className="text-[12.5px] text-slate-500 hover:underline">← Utilisateurs</Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-bold">{file.firstName} {file.lastName}</h1>
        <span className="text-[13px] text-slate-500">{file.email}{file.phoneE164 ? ` · ${file.phoneE164}` : ""} · {file.preferredLocale}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${file.accountStatus === "ACTIVE" || sanctionEchue ? "bg-emerald-50 text-emerald-700" : file.accountStatus === "RESTRICTED" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>{sanctionEchue ? "Actif (sanction échue)" : STATUS_LABEL[file.accountStatus]}</span>
        {isAdminTarget && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">{rolesLabel(file.adminRoles.length ? file.adminRoles : file.adminRole ? [file.adminRole] : [])}</span>}
        {file.isMe && <span className="text-[11px] text-slate-500">(c'est toi : aucune action possible)</span>}
      </div>

      {erasure && <p role="status" className="mt-3 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-[12.5px] text-slate-800">{erasure}</p>}
      {flash && !file.emailSuppression && <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">{flash}</p>}
      {file.emailSuppression && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
          <span>Adresse sur la liste de suppression depuis le {dateTime(file.emailSuppression.at)} ({SUPPRESSION_REASON_LABEL[file.emailSuppression.reason] ?? "motif non renseigné"}) : aucun email ne lui est envoyé.</span>
          {/* Recette § 5.5 — le bouton suit la garde serveur : jamais sur soi, et un compte admin n'est levé que par un super administrateur. */}
          {can(me?.adminRoles, "users.email.unsuppress") && !file.isMe && (!isAdminTarget || isSuperAdmin(me?.adminRoles)) && <UnsuppressButton userId={file.id} email={file.email} complaint={file.emailSuppression.reason === "COMPLAINT"} onDone={load} onLifted={setFlash} />}
        </div>
      )}
      {file.suspension && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
          {STATUS_LABEL[file.suspension.level]} depuis le {dateTime(file.suspension.at)} par {file.suspension.byAdmin}{file.suspension.until ? `, jusqu'au ${dateTime(file.suspension.until)}` : ""} — catégorie envoyée au membre : {SANCTION_CATEGORY_LABEL[file.suspension.category]} · motif interne : {file.suspension.reason}
          {/* ANO-ADM-07 — passé sa date de fin, la sanction ne s'applique plus (lecture) : on le dit, « Lever » nettoie la fiche. */}
          {sanctionEchue && <span className="ml-1 font-semibold"> — sanction échue le {dateTime(file.suspension.until!)} : elle ne s&apos;applique plus. « Lever » nettoie la fiche.</span>}
        </div>
      )}
      {file.suspensionProposal && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
          Proposition de {file.suspensionProposal.byAdmin} le {dateTime(file.suspensionProposal.at)} : {STATUS_LABEL[file.suspensionProposal.level]} · {SANCTION_CATEGORY_LABEL[file.suspensionProposal.category]} — {file.suspensionProposal.reason}
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
        <TrustCard t={file.trust} />
        <SuspensionCard file={file} canPropose={canPropose} canApply={canApply} onDone={load} />
        {canErase && <EraseCard file={file} onDone={load} onOutcome={setErasure} />}
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
              <li key={a.id}>{dateTime(a.at)} · {a.admin} · <b>{ACTION_LABEL[a.action] ?? a.action}</b>{auditDetail(a.after) ? <span className="ml-1 text-[11.5px] text-slate-500">— {auditDetail(a.after)}</span> : null /* ANO-ADM-73 */}</li>
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
  // A193 — aucune catégorie présélectionnée hors proposition : l'admin la choisit, c'est ce que le membre lira.
  const [category, setCategory] = useState<SanctionCategory | "">(file.suspensionProposal?.category ?? (file.accountStatus !== "ACTIVE" ? file.suspension?.category ?? "" : ""));
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(action: "propose" | "apply" | "lift") {
    setBusy(true);
    setMsg(null);
    try {
      if (action === "propose") await post(`/admin/users/${file.id}/suspension/propose`, { level, category, reason: reason.trim() });
      if (action === "apply") await post(`/admin/users/${file.id}/suspension`, { level, category, reason: reason.trim(), ...(until ? { until: finDeJournee(until) } : {}) });
      if (action === "lift") await del(`/admin/users/${file.id}/suspension`, { reason: reason.trim() });
      // Recette § 5.4 — « Fait. » ne disait pas CE qui était fait : le message nomme le geste et son effet.
      setMsg(
        action === "propose"
          ? `Proposition enregistrée (${STATUS_LABEL[level]}) : un Médiateur décide.`
          : action === "apply"
            ? `Sanction appliquée : ${STATUS_LABEL[level]}${until ? ` jusqu'au ${new Date(until).toLocaleDateString("fr-FR")}` : ", sans date de fin"}. Le membre est prévenu par email.`
            : "Sanction levée. Le membre est prévenu par email."
      );
      onDone();
    } catch (e) {
      setMsg(refusDeSanction(e));
      if (e instanceof ApiError && e.status === 409) onDone(); // l'état a changé : la fiche montre la décision gagnante
    } finally {
      setBusy(false);
    }
  }
  if (!canPropose && !canApply) return <Card title="Sanction"><p className="text-[12.5px] text-slate-500">{file.isMe ? "Aucune action sur ton propre compte." : "Ton profil ne propose ni n'exécute de sanction."}</p></Card>;
  const ok = reason.trim().length >= MIN_REASON && !busy;
  const okSanction = ok && category !== ""; // proposer / appliquer exigent la catégorie ; lever n'en a pas
  return (
    <Card title="Sanction">
      <div className="flex gap-3 text-[12.5px]">
        <label className="flex items-center gap-1"><input type="radio" checked={level === "RESTRICTED"} onChange={() => setLevel("RESTRICTED")} /> Restreint (ni publier ni réserver)</label>
        <label className="flex items-center gap-1"><input type="radio" checked={level === "SUSPENDED"} onChange={() => setLevel("SUSPENDED")} /> Suspendu (connexion refusée)</label>
      </div>
      <label className="mt-2 block text-[12px] text-slate-600">
        Catégorie envoyée au membre
        <select value={category} onChange={(e) => setCategory(e.target.value as SanctionCategory | "")} className="ml-2 rounded border border-slate-300 px-2 py-1 text-[12px]">
          <option value="">— choisir —</option>
          {(Object.keys(SANCTION_CATEGORY_LABEL) as SanctionCategory[]).map((c) => <option key={c} value={c}>{SANCTION_CATEGORY_LABEL[c]}</option>)}
        </select>
      </label>
      {/* A193 c (recette § 7) — le placeholder disait « envoyé au membre » : faux depuis ANO-ADM-87, et c'est l'erreur qui pousse à écrire ce qu'on ne doit pas envoyer. */}
      <label className="mt-2 block text-[12px] text-slate-600">
        Motif interne (jamais envoyé au membre)
        <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 2000))} rows={3} placeholder={`${MIN_REASON} caractères au moins : faits, signalements, deals concernés — reste au journal et sur cette fiche`} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[12.5px]" />
      </label>
      {canApply && (
        <label className="mt-2 block text-[12px] text-slate-600">Jusqu'au (optionnel) <input type="date" min={demain()} value={until} onChange={(e) => setUntil(e.target.value)} className="ml-2 rounded border border-slate-300 px-2 py-1 text-[12px]" /></label>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {canPropose && !canApply && <button disabled={!okSanction} onClick={() => run("propose")} className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Proposer</button>}
        {canApply && file.accountStatus === "ACTIVE" && <button disabled={!okSanction} onClick={() => run("apply")} className="rounded-lg bg-red-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Appliquer</button>}
        {canApply && file.accountStatus !== "ACTIVE" && (
          <>
            <button disabled={!okSanction} onClick={() => run("apply")} className="rounded-lg bg-red-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Modifier la sanction</button>
            <button disabled={!ok} onClick={() => run("lift")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Lever</button>
          </>
        )}
      </div>
      {msg && <p className="mt-2 text-[12px] text-slate-600">{msg}</p>}
    </Card>
  );
}

/** D71 — TrustScore interne : aide à la décision, jamais une sanction automatique (REP-04). */
function TrustCard({ t }: { t: AdminUserFile["trust"] }) {
  if (!t) return null;
  return (
    <Card title="Risque interne (D29 ②) — invisible du membre">
      <Row k="Niveau" v={`${TRUST_LEVEL_LABEL[t.level] ?? t.level} · score ${t.score}/100${t.level === "HIGH_RISK" ? " ⚠" : ""}`} />
      {t.factors.length === 0 ? <Row k="Facteurs" v="aucun signal" /> : t.factors.map((f) => <Row key={f.key} k={f.detail} v={`${f.points > 0 ? "+" : ""}${f.points}`} />)}
      <Row k="Plafonds CNF-06" v={t.caps ? `${(t.caps.maxDeclaredValueCents / 100).toLocaleString("fr-FR")} € · ${t.caps.maxWeightKg} kg · ${t.caps.maxShipmentsPerMonth} envois / mois (${t.capsReason === "NEW_ACCOUNT" ? "compte neuf" : "à risque"})` : "aucun"} />
      <Row k="Ce mois" v={`${t.signals.bookingsThisMonth} demande(s), ${t.signals.bookingsLast24h} sur 24 h · compte de ${t.signals.accountAgeDays} j`} />
      <p className="pt-1 text-[11.5px] text-slate-500">Un score ne sanctionne rien : il éclaire une décision humaine (masquage, sanction) qui reste journalisée.</p>
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

/** C-PR8b (D63 6A) — effacement à la demande d'un membre (reçue par email) : mêmes garde-fous que côté membre, motif au journal. */
function EraseCard({ file, onDone, onOutcome }: { file: AdminUserFile; onDone: () => void; onOutcome: (text: string) => void }) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<ErasureBlocker[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  // A179 (recette § 5.22) — les bloqueurs se lisent AVANT le clic ; le serveur les recompte de toute façon dans la transaction.
  useEffect(() => {
    apiFetch<{ blockers: ErasureBlocker[]; counts?: Record<string, number> }>(`/admin/users/${file.id}/erasure-blockers`).then((r) => { setBlockers(r.blockers.length ? r.blockers : null); setCounts(r.counts ?? {}); }).catch(() => undefined);
  }, [file.id]);
  async function run() {
    setBusy(true);
    setMsg(null);
    setBlockers(null);
    try {
      await post(`/admin/users/${file.id}/erase`, { reason: reason.trim() });
      // ANO-ADM-59 — la carte disparaît avec le compte effacé : le message vit dans la fiche, pas dans la carte.
      onOutcome("Compte effacé : identité et coordonnées supprimées, réservations conservées sans nom, journal écrit, email de confirmation envoyé à l'ancienne adresse.");
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && (e.data as { blockers?: ErasureBlocker[] })?.blockers) {
        setBlockers((e.data as { blockers: ErasureBlocker[] }).blockers);
        setCounts((e.data as { counts?: Record<string, number> }).counts ?? {});
      }
      // ANO-ADM-60 (recette 02-ADMIN § 5.21) — un refus s'affichait « 404 : User not found. » ; il se lit en français, et la
      // fiche se recharge quand le compte vient d'être effacé par un autre admin (la carte disparaît avec lui).
      else if (e instanceof ApiError && e.status === 404) {
        onOutcome("Ce compte n'existe plus ou vient d'être effacé par un autre administrateur.");
        onDone();
      } else if (e instanceof ApiError && e.status === 403) setMsg("Ton profil n'efface pas de compte.");
      else if (e instanceof ApiError && e.status === 400) setMsg("Motif refusé : 20 caractères au moins, 500 au plus.");
      else setMsg("Effacement impossible pour le moment. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  }
  const ok = reason.trim().length >= MIN_REASON && confirm === "EFFACER" && !busy && !blockers;
  return (
    <Card title="Effacer ce compte (RGPD)">
      <p className="text-[12.5px] text-slate-600">Immédiat et irréversible. Anonymise l'identité et les coordonnées, supprime adresses, alertes, favoris, justificatifs ; conserve réservations, litiges, avis et messages sans le nom. Refusé tant qu'un deal vit. Le motif (demande reçue le…, canal) part au journal et au registre des demandes.</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} rows={2} placeholder={`Motif (${MIN_REASON} caractères au moins) : demande reçue par email le …`} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-[12.5px]" />
      <label className="mt-2 block text-[12px] text-slate-600">Tape EFFACER pour confirmer <input value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} className="ml-2 w-32 rounded border border-slate-300 px-2 py-1" /></label>
      {blockers && (
        <div role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
          Effacement impossible pour l'instant : {blockers.map((b) => erasureBlockerLabel(b, counts[b])).join(", ")}.
        </div>
      )}
      <p className="mt-2 text-[12px]"><Link href={`/privacy?userId=${file.id}`} className="underline">Demandes de ce membre au registre</Link></p>
      <div className="mt-3">
        <button disabled={!ok} onClick={run} className="rounded-lg bg-red-800 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Effacer définitivement</button>
      </div>
      {msg && <p className="mt-2 text-[12px] text-slate-600">{msg}</p>}
    </Card>
  );
}

/** D35 4A — lever la suppression après correction de l'adresse (journalisé).
 *  A155 (recette § 5.5) : un motif ≥ 20 caractères, un avertissement pour une plainte, le refus lu par son code, et un
 *  message qui dit ce qui vient de changer — l'ancien bouton levait d'un clic et avalait toute erreur. */
const SUPPRESSION_REFUS: Record<string, string> = {
  EMAIL_NOT_SUPPRESSED: "Cette adresse n'est plus sur la liste de suppression (déjà levée, peut-être depuis un autre onglet). La fiche est rechargée.",
  REASON_REQUIRED: `Le motif doit faire au moins ${MIN_REASON} caractères.`,
  ADMIN_IS_SELF: "Aucune action sur ton propre compte.",
  SUPER_ADMIN_ONLY: "Seul un super administrateur agit sur un compte admin.",
  ADMIN_PERMISSION_DENIED: "Ton profil n'a pas ce droit.",
};
function UnsuppressButton({ userId, email, complaint, onDone, onLifted }: { userId: string; email: string; complaint: boolean; onDone: () => void; onLifted: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg border border-amber-400 bg-white px-2.5 py-1 text-[12px] font-medium">
        Lever (adresse corrigée)
      </button>
    );
  }
  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      await del(`/admin/users/${userId}/email-suppression`, { reason: reason.trim() });
      setOpen(false);
      setReason("");
      onLifted(`Suppression levée : les emails repartent vers ${email}.`);
      onDone();
    } catch (e) {
      const code = e instanceof ApiError ? (e.data as { details?: { code?: string } } | undefined)?.details?.code : undefined;
      const texte = (code && SUPPRESSION_REFUS[code]) ?? (e instanceof ApiError ? `${e.status} : ${e.message}` : "Levée impossible.");
      // Déjà levée ailleurs : le bandeau va disparaître au rechargement — le message vit donc au niveau de la fiche.
      if (code === "EMAIL_NOT_SUPPRESSED") { onLifted(texte); onDone(); } else setMsg(texte);
    } finally {
      setBusy(false);
    }
  }
  const ok = reason.trim().length >= MIN_REASON;
  return (
    <div className="w-full rounded-lg border border-amber-300 bg-white p-2 text-[12.5px] text-slate-800">
      {complaint && <p className="mb-1 font-medium text-amber-900">Ce membre a signalé un email comme indésirable : ne lève que s'il te l'a demandé.</p>}
      <label className="block">
        Motif (journalisé, {MIN_REASON} caractères minimum)
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5" placeholder="Adresse corrigée, demande du membre…" />
      </label>
      <p className="mt-1 text-[11px] text-slate-500">Les emails repartiront vers {email}.</p>
      <div className="mt-2 flex gap-2">
        <button disabled={busy || !ok} onClick={run} className="rounded-lg bg-slate-900 px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-40">Confirmer la levée</button>
        <button onClick={() => { setOpen(false); setMsg(null); }} className="rounded-lg border border-slate-300 px-2.5 py-1 text-[12px]">Annuler</button>
      </div>
      {msg && <p className="mt-1 text-[12px] text-red-700">{msg}</p>}
    </div>
  );
}
