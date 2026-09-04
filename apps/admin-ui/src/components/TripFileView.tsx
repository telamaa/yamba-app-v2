"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch, del, post } from "@/lib/api";
import { ACTION_LABEL, TICKET_REASON_LABEL, TICKET_STATUS_LABEL, dateTime, money } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { AdminMe, AdminTripFile } from "@/lib/types";

const MIN_REASON = 20;

export default function TripFileView({ tripId }: { tripId: string }) {
  const [file, setFile] = useState<AdminTripFile | null>(null);
  const [me, setMe] = useState<AdminMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    apiFetch<AdminTripFile>(`/admin/trips/${tripId}`).then(setFile).catch((e) => setError(e instanceof ApiError ? `${e.status} : ${e.message}` : "Chargement impossible."));
  }, [tripId]);
  useEffect(() => {
    load();
    apiFetch<AdminMe>("/admin/me").then(setMe).catch(() => undefined);
  }, [load]);
  if (error) return <p className="text-[13px] text-red-700">{error}</p>;
  if (!file) return <p className="text-[13px] text-slate-500">Chargement…</p>;
  const isMine = me?.id === file.carrier.id;

  return (
    <div className="max-w-5xl">
      <Link href="/trips" className="text-[12.5px] text-slate-500 hover:underline">← Trajets</Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-bold">{file.originCity} → {file.destinationCity}</h1>
        <span className="text-[13px] text-slate-500">{dateTime(file.departureAt)} · {file.transportMode ?? "—"} · {file.status}</span>
        {file.hidden && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">masqué par Yamba</span>}
      </div>
      {file.hidden && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">Masqué le {dateTime(file.hidden.at)} par {file.hidden.byAdmin} — motif : {file.hidden.reason}</div>}
      {file.hideProposal && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">Masquage proposé par {file.hideProposal.byAdmin} le {dateTime(file.hideProposal.at)} : {file.hideProposal.reason}</div>}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card title="Trajet">
          <Row k="Capacité / réservé" v={`${file.capacityKg ?? "—"} kg / ${file.reservedKg ?? 0} kg`} />
          <Row k="Créé" v={dateTime(file.createdAt)} />
          <Row k="Publié" v={dateTime(file.publishedAt)} />
          {file.cancelledAt && <Row k="Annulé" v={dateTime(file.cancelledAt)} />}
          <Row k="Billet" v={TICKET_STATUS_LABEL[file.ticketVerificationStatus] ?? file.ticketVerificationStatus} />
        </Card>
        <Card title="Voyageur">
          <Row k="Nom" v={`${file.carrier.firstName} ${file.carrier.lastName}`} />
          <Row k="Email" v={file.carrier.email} />
          <Row k="Compte" v={`${file.carrier.accountStatus} · Voyageur ${file.carrier.carrierStatus}`} />
          <Link href={`/users/${file.carrier.id}`} className="text-[12.5px] underline">Voir la fiche</Link>
        </Card>
        <HideCard file={file} canPropose={can(me?.adminRoles, "trips.hide.propose") && !isMine} canApply={can(me?.adminRoles, "trips.hide.apply") && !isMine} onDone={load} />
        <Card title={`Documents (${file.documents.length})`}>
          {file.documents.length === 0 ? <p className="text-[12.5px] text-slate-500">Aucun document.</p> : file.documents.map((d) => (
            <div key={d.id} className="flex justify-between gap-2 text-[12.5px]">
              <span>{d.type} · {d.originalName ?? d.id.slice(-6)}</span>
              <span className="text-right">{d.status}{d.rejectionReason ? ` · ${TICKET_REASON_LABEL[d.rejectionReason] ?? d.rejectionReason}` : ""}{d.reviewedAt ? ` · ${dateTime(d.reviewedAt)}` : ""}</span>
            </div>
          ))}
        </Card>
      </div>

      <Card title={`Réservations (${file.bookings.length})`} className="mt-5">
        {file.bookings.length === 0 ? <p className="text-[12.5px] text-slate-500">Aucune.</p> : (
          <table className="w-full text-[12.5px]">
            <tbody>
              {file.bookings.map((b) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="py-1">{b.shipperFirstName}</td><td className="py-1">{b.weightKg} kg</td><td className="py-1 font-mono text-[11px]">{b.status}{b.disputeTicket ? ` · ${b.disputeTicket}` : ""}</td>
                  <td className="py-1 text-right tabular-nums">{money(b.totalShipperCents, b.currencyCode)} / net {money(b.transportCents, b.currencyCode)}</td><td className="py-1 whitespace-nowrap">{dateTime(b.requestedAt)}</td>
                  <td className="py-1 whitespace-nowrap">{b.disputeTicket ? <Link href={`/disputes/${b.id}`} className="underline">dossier</Link> : ""} <Link href={`/deals/${b.id}`} className="underline">argent</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title="Actions admin sur ce trajet" className="mt-5">
        {file.adminActions.length === 0 ? <p className="text-[12.5px] text-slate-500">Aucune.</p> : (
          <ul className="space-y-1 text-[12.5px]">{file.adminActions.map((a) => <li key={a.id}>{dateTime(a.at)} · {a.admin} · <b>{ACTION_LABEL[a.action] ?? a.action}</b>{a.after ? <span className="ml-1 font-mono text-[11px] text-slate-500">{JSON.stringify(a.after)}</span> : null}</li>)}</ul>
        )}
      </Card>
    </div>
  );
}

function HideCard({ file, canPropose, canApply, onDone }: { file: AdminTripFile; canPropose: boolean; canApply: boolean; onDone: () => void }) {
  const [reason, setReason] = useState(file.hideProposal?.reason ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run(action: "propose" | "hide" | "unhide") {
    setBusy(true); setMsg(null);
    try {
      if (action === "propose") await post(`/admin/trips/${file.id}/hide/propose`, { reason: reason.trim() });
      if (action === "hide") await post(`/admin/trips/${file.id}/hide`, { reason: reason.trim() });
      if (action === "unhide") await del(`/admin/trips/${file.id}/hide`, { reason: reason.trim() });
      setMsg("Fait."); onDone();
    } catch (e) { setMsg(e instanceof ApiError ? `${e.status} : ${e.message}` : "Action impossible."); } finally { setBusy(false); }
  }
  if (!canPropose && !canApply) return <Card title="Masquage"><p className="text-[12.5px] text-slate-500">Ton profil ne propose ni n'exécute de masquage.</p></Card>;
  const ok = reason.trim().length >= MIN_REASON && !busy;
  return (
    <Card title="Masquage">
      <p className="text-[12px] text-slate-500">Retire le trajet de la recherche et de sa page publique, sans l'annuler. Réservations en cours préservées, Voyageur prévenu.</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 2000))} rows={3} placeholder={`Motif (${MIN_REASON} caractères au moins)`} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-[12.5px]" />
      <div className="mt-2 flex flex-wrap gap-2">
        {canPropose && !canApply && !file.hidden && <button disabled={!ok} onClick={() => run("propose")} className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Proposer</button>}
        {canApply && !file.hidden && <button disabled={!ok} onClick={() => run("hide")} className="rounded-lg bg-red-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Masquer</button>}
        {canApply && file.hidden && <button disabled={!ok} onClick={() => run("unhide")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Rétablir</button>}
      </div>
      {msg && <p className="mt-2 text-[12px] text-slate-600">{msg}</p>}
    </Card>
  );
}
function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}><h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h2><div className="mt-2 space-y-1.5">{children}</div></section>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4 text-[13px]"><span className="text-slate-500">{k}</span><span className="text-right font-medium">{v}</span></div>;
}
