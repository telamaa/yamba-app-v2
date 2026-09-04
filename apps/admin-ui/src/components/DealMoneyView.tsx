"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch, post } from "@/lib/api";
import { ACTION_LABEL, DIVERGENCE_LABEL, PAYOUT_FAILURE_LABEL, PAYOUT_STATUS_LABEL, TIMELINE_LABEL, dateTime, money } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { AdminDealMoneyFile, AdminMe, DealHistoryResponse, PaymentReconciliation } from "@/lib/types";

const MIN_REASON = 20;

export default function DealMoneyView({ dealId }: { dealId: string }) {
  const [file, setFile] = useState<AdminDealMoneyFile | null>(null);
  const [me, setMe] = useState<AdminMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [recon, setRecon] = useState<PaymentReconciliation | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    apiFetch<AdminDealMoneyFile>(`/admin/deals/${dealId}/money`).then(setFile).catch((e) => setError(e instanceof ApiError ? `${e.status} : ${e.message}` : "Chargement impossible."));
  }, [dealId]);
  useEffect(() => { load(); apiFetch<AdminMe>("/admin/me").then(setMe).catch(() => undefined); }, [load]);
  if (error) return <p className="text-[13px] text-red-700">{error}</p>;
  if (!file) return <p className="text-[13px] text-slate-500">Chargement…</p>;
  const cur = file.pricing.currencyCode;

  async function reconcile() {
    setBusy(true); setMsg(null);
    try { setRecon(await post<PaymentReconciliation>(`/admin/deals/${dealId}/money/reconcile`)); }
    catch (e) { setMsg(e instanceof ApiError ? `${e.status} : ${e.message}` : "Rapprochement impossible."); }
    finally { setBusy(false); }
  }
  async function retry() {
    setBusy(true); setMsg(null);
    try {
      const r = await post<{ payoutStatus: string; reason: string | null }>(`/admin/deals/${dealId}/payout/retry`);
      setMsg(r.payoutStatus === "SENT" ? "Versement envoyé." : `Toujours en échec : ${r.reason ?? "motif inconnu"}.`);
      load();
    } catch (e) { setMsg(e instanceof ApiError ? `${e.status} : ${e.message}` : "Relance impossible."); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-5xl">
      <Link href="/finances" className="text-[12.5px] text-slate-500 hover:underline">← Finances</Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-bold">{file.corridor.originCity} → {file.corridor.destinationCity}</h1>
        <span className="text-[13px] text-slate-500">deal {file.id.slice(-8)} · {file.status}{file.disputeTicket ? ` · ${file.disputeTicket}` : ""} · départ {dateTime(file.corridor.departureAt)}</span>
        {file.disputeTicket && <Link href={`/disputes/${file.id}`} className="text-[12.5px] underline">dossier de médiation</Link>}
      </div>
      {msg && <p className="mt-2 text-[12.5px] text-slate-700">{msg}</p>}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card title="Prix figé à la réservation">
          <Row k="Payé par l'Expéditeur" v={money(file.pricing.totalShipperCents, cur)} />
          <Row k="Net Voyageur" v={money(file.pricing.transportCents, cur)} />
          <Row k="Commission Yamba" v={money(file.pricing.commissionCents, cur)} />
          {file.pricing.premiumCents > 0 && <Row k="Prime protection" v={money(file.pricing.premiumCents, cur)} />}
          <Row k="Modèle" v={`${file.pricing.pricingModel} · ${file.pricing.weightKg} kg`} />
        </Card>
        <Card title="Parties">
          <Row k="Expéditeur" v={<Link href={`/users/${file.shipper.id}`} className="underline">{file.shipper.firstName} {file.shipper.lastName}</Link>} />
          <Row k="Voyageur" v={<Link href={`/users/${file.carrier.id}`} className="underline">{file.carrier.firstName} {file.carrier.lastName}</Link>} />
          <Row k="Compte Stripe" v={file.carrier.stripeAccountIdMasked ? `${file.carrier.stripeAccountIdMasked} · virements ${file.carrier.stripePayoutsEnabled ? "activés" : "NON activés"}` : "aucun"} />
        </Card>
        <Card title="Paiement de l'Expéditeur">
          <Row k="Fournisseur" v={file.payment.provider ?? "—"} />
          <Row k="Intent" v={<Mono v={file.payment.intentId} />} />
          <Row k="Charge" v={<Mono v={file.payment.chargeId} />} />
          <Row k="Capturé" v={dateTime(file.payment.capturedAt)} />
          <Row k="Remboursé" v={file.payment.refundAmountCents != null ? `${money(file.payment.refundAmountCents, cur)} le ${dateTime(file.payment.refundedAt)}` : "—"} />
          {file.payment.refundId && <Row k="Remboursement" v={<Mono v={file.payment.refundId} />} />}
        </Card>
        <Card title="Versement au Voyageur">
          <Row k="État" v={file.payout.status ? (PAYOUT_STATUS_LABEL[file.payout.status] ?? file.payout.status) : "aucun versement prévu"} />
          {file.payout.amountCents != null && <Row k="Montant" v={money(file.payout.amountCents, cur)} />}
          {file.payout.sentAt && <Row k="Envoyé" v={dateTime(file.payout.sentAt)} />}
          {file.payout.transferId && <Row k="Transfert" v={<Mono v={file.payout.transferId} />} />}
          {file.payout.failureKind && <Row k="Motif" v={`${PAYOUT_FAILURE_LABEL[file.payout.failureKind] ?? file.payout.failureKind}${file.payout.failureDetail ? ` — ${file.payout.failureDetail}` : ""}`} />}
          {file.payout.status === "FAILED" && <Row k="Tentatives" v={`${file.payout.attempts}${file.payout.nextRetryAt ? ` · prochaine ${dateTime(file.payout.nextRetryAt)}` : ""}`} />}
          {file.payout.reversal && <Row k="Renversement clos" v={`${file.payout.reversal.resolution === "RESENT" ? "re-versé" : "abandonné"} par ${file.payout.reversal.byAdmin} le ${dateTime(file.payout.reversal.at)} — ${file.payout.reversal.reason}`} />}
          {file.retention && <Row k="Retenue" v={`${money(file.retention.cents, cur)} · ${file.retention.disposition ?? "—"}${file.retention.decidedAt ? ` (arbitrée le ${dateTime(file.retention.decidedAt)})` : ""}`} />}
          <div className="mt-2 flex flex-wrap gap-2">
            {file.allowedActions.retryPayout && can(me?.adminRole, "payouts.retry") && <button disabled={busy} onClick={retry} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Relancer le versement</button>}
          </div>
          {file.allowedActions.resolveReversal && can(me?.adminRole, "payouts.resolve") && <ReversalForm dealId={dealId} onDone={(m) => { setMsg(m); load(); }} />}
        </Card>
      </div>

      <ManualRefundCard file={file} me={me} onDone={(m) => { setMsg(m); load(); }} />

      <Card title="Chronologie de l'argent" className="mt-5">
        {file.timeline.length === 0 ? <p className="text-[12.5px] text-slate-500">Rien.</p> : (
          <ul className="space-y-1 text-[12.5px]">
            {file.timeline.map((e, i) => <li key={i}><span className="text-slate-500">{dateTime(e.at)}</span> · <b>{TIMELINE_LABEL[e.kind] ?? e.kind}</b>{e.amountCents != null ? ` · ${money(e.amountCents, cur)}` : ""}{e.detail ? <span className="ml-1 text-slate-500">({e.detail})</span> : null}</li>)}
          </ul>
        )}
      </Card>

      <Card title="Rapprochement avec le fournisseur" className="mt-5">
        <p className="text-[12px] text-slate-500">Lecture seule chez Stripe : l'état réel du paiement, des remboursements et du transfert, comparé à la base. Journalisé. Rien n'est modifié.</p>
        {file.allowedActions.reconcile ? <button disabled={busy} onClick={reconcile} className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] disabled:opacity-50">Rapprocher maintenant</button> : <p className="mt-2 text-[12.5px] text-slate-500">Aucun paiement à rapprocher.</p>}
        {recon && (
          <div className="mt-3 text-[12.5px]">
            <p className="text-slate-500">{recon.provider} · vérifié le {dateTime(recon.checkedAt)}</p>
            {recon.live && (
              <div className="mt-1 space-y-0.5">
                <Row k="Paiement" v={`${recon.live.intentStatus} · ${money(recon.live.amountCents, cur)} autorisés · ${money(recon.live.amountReceivedCents, cur)} encaissés`} />
                <Row k="Remboursements" v={recon.live.refunds.length === 0 ? "aucun" : recon.live.refunds.map((r) => `${money(r.amountCents, cur)} (${r.status})`).join(", ")} />
                <Row k="Transfert" v={recon.live.transfer ? `${money(recon.live.transfer.amountCents, cur)}${recon.live.transfer.reversedCents > 0 ? ` · renversé ${money(recon.live.transfer.reversedCents, cur)}` : ""}` : "aucun"} />
              </div>
            )}
            {recon.divergences.length === 0 ? <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">Base et fournisseur concordent.</p> : (
              <ul className="mt-2 space-y-1">
                {recon.divergences.map((d, i) => <li key={i} className="rounded-lg bg-red-50 px-3 py-2 text-red-800"><b>{DIVERGENCE_LABEL[d.code] ?? d.code}</b>{d.dbCents != null || d.liveCents != null ? <span className="ml-1 text-[11.5px]">(base {d.dbCents != null ? money(d.dbCents, cur) : "—"} · fournisseur {d.liveCents != null ? money(d.liveCents, cur) : "—"})</span> : null}<div className="text-[11.5px] text-red-700">{d.message}</div></li>)}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card title="Dates" className="mt-5">
        <div className="grid gap-x-6 md:grid-cols-2">
          <Row k="Demandé" v={dateTime(file.dates.requestedAt)} /><Row k="Accepté" v={dateTime(file.dates.acceptedAt)} />
          <Row k="Pris en charge" v={dateTime(file.dates.pickedUpAt)} /><Row k="Livré" v={dateTime(file.dates.deliveredAt)} />
          {file.dates.disputedAt && <Row k="Litige" v={dateTime(file.dates.disputedAt)} />}
          {file.dates.completedAt && <Row k="Terminé" v={`${dateTime(file.dates.completedAt)} (${file.dates.completedBy ?? "—"})`} />}
          {file.dates.closedAt && <Row k="Clos" v={`${dateTime(file.dates.closedAt)} (${file.dates.closedBy ?? "—"})`} />}
        </div>
      </Card>
      {can(me?.adminRole, "deals.history.read") && <DealHistoryCard dealId={dealId} />}
      <Card title="Actions admin sur ce deal" className="mt-5">
        {file.adminActions.length === 0 ? <p className="text-[12.5px] text-slate-500">Aucune.</p> : (
          <ul className="space-y-1 text-[12.5px]">{file.adminActions.map((a) => <li key={a.id}>{dateTime(a.at)} · {a.admin} · <b>{ACTION_LABEL[a.action] ?? a.action}</b>{a.after ? <span className="ml-1 font-mono text-[11px] text-slate-500">{JSON.stringify(a.after)}</span> : null}</li>)}</ul>
        )}
      </Card>
    </div>
  );
}

function ReversalForm({ dealId, onDone }: { dealId: string; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run(outcome: "RESENT" | "WRITTEN_OFF") {
    setBusy(true); setErr(null);
    try {
      const r = await post<{ outcome: string; payoutStatus: string | null; reason: string | null }>(`/admin/deals/${dealId}/payout/reversal`, { outcome, reason: reason.trim() });
      onDone(outcome === "RESENT" ? (r.payoutStatus === "SENT" ? "Nouveau transfert envoyé." : `Re-versement en échec : ${r.reason ?? "motif inconnu"} — il sera rejoué.`) : "Renversement abandonné, clos.");
    } catch (e) { setErr(e instanceof ApiError ? `${e.status} : ${e.message}` : "Action impossible."); }
    finally { setBusy(false); }
  }
  const ok = reason.trim().length >= MIN_REASON && !busy;
  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-[12px] text-amber-900">Transfert renversé par Stripe : l'argent est revenu à la plateforme. Décide, avec un motif ({MIN_REASON} caractères au moins).</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 2000))} rows={2} placeholder="Motif (RIB corrigé, compte fermé, fraude…)" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-[12.5px]" />
      <div className="mt-2 flex flex-wrap gap-2">
        <button disabled={!ok} onClick={() => run("RESENT")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Re-verser</button>
        <button disabled={!ok} onClick={() => run("WRITTEN_OFF")} className="rounded-lg bg-red-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Abandonner</button>
      </div>
      {err && <p className="mt-2 text-[12px] text-red-700">{err}</p>}
    </div>
  );
}
const SOURCE_LABEL: Record<string, string> = { OUTBOX: "événement", ADMIN: "admin", NOTIFICATION: "notification", EMAIL: "email" };
function DealHistoryCard({ dealId }: { dealId: string }) {
  const [h, setH] = useState<DealHistoryResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function load() {
    setBusy(true); setErr(null);
    try { setH(await apiFetch<DealHistoryResponse>(`/admin/deals/${dealId}/history`)); }
    catch (e) { setErr(e instanceof ApiError ? `${e.status} : ${e.message}` : "Chargement impossible."); }
    finally { setBusy(false); }
  }
  return (
    <Card title="Tout ce qui est arrivé à ce deal" className="mt-5">
      <p className="text-[12px] text-slate-500">Événements (avec leur état de relais), actions admin, notifications et emails, dans l'ordre. Lecture seule, consultation journalisée. Jamais le code de livraison.</p>
      {!h && <button disabled={busy} onClick={load} className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] disabled:opacity-50">Charger la chronologie</button>}
      {err && <p className="mt-2 text-[12px] text-red-700">{err}</p>}
      {h && (
        <>
          <p className="mt-2 text-[11.5px] text-slate-500">{h.counts.outbox} événement(s) · {h.counts.admin} action(s) admin · {h.counts.notifications} notification(s) · {h.counts.emails} email(s){h.counts.parked > 0 && <span className="ml-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">{h.counts.parked} parqué(s) — relais à réparer</span>}</p>
          <ol className="mt-2 space-y-1 text-[12.5px]">
            {h.events.map((e, i) => (
              <li key={i} className="flex flex-wrap gap-x-2">
                <span className="w-32 shrink-0 text-slate-500">{dateTime(e.at)}</span>
                <span className={`rounded px-1.5 text-[10.5px] font-semibold uppercase ${e.source === "OUTBOX" ? "bg-slate-100" : e.source === "ADMIN" ? "bg-amber-50 text-amber-800" : e.source === "EMAIL" ? "bg-sky-50 text-sky-800" : "bg-emerald-50 text-emerald-800"}`}>{SOURCE_LABEL[e.source]}</span>
                <b>{e.type}</b>
                {e.actor && <span className="text-slate-500">par {e.actor}</span>}
                {e.recipient && <span className="text-slate-500">→ {e.recipient === "SHIPPER" ? "Expéditeur" : "Voyageur"}</span>}
                {e.status && <span className={`text-[11px] ${e.status === "PARKED" || e.status === "FAILED" ? "font-semibold text-red-700" : "text-slate-400"}`}>{e.status.toLowerCase()}{e.relay && e.relay.attempts > 1 ? ` · ${e.relay.attempts} essais` : ""}</span>}
                {Object.keys(e.summary).length > 0 && <span className="font-mono text-[11px] text-slate-500">{JSON.stringify(e.summary)}</span>}
                {e.relay?.lastError && <span className="text-[11px] text-red-700">{e.relay.lastError}</span>}
              </li>
            ))}
          </ol>
        </>
      )}
    </Card>
  );
}
const REFUND_MIN_REASON = 50;
function ManualRefundCard({ file, me, onDone }: { file: AdminDealMoneyFile; me: AdminMe | null; onDone: (msg: string) => void }) {
  const cur = file.pricing.currencyCode;
  const canPropose = can(me?.adminRole, "refunds.manual.propose") && file.allowedActions.proposeRefund;
  const canApply = can(me?.adminRole, "refunds.manual.apply") && file.allowedActions.applyRefund;
  const [amount, setAmount] = useState(file.manualRefund.proposal ? (file.manualRefund.proposal.amountCents / 100).toFixed(2) : "");
  const [reason, setReason] = useState(file.manualRefund.proposal?.reason ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cents = Math.round(Number(amount.replace(",", ".")) * 100);
  const ok = !busy && Number.isFinite(cents) && cents >= 1 && cents <= file.manualRefund.maxRefundableCents && reason.trim().length >= REFUND_MIN_REASON;
  async function run(mode: "propose" | "apply") {
    setBusy(true); setErr(null);
    try {
      if (mode === "propose") { await post(`/admin/deals/${file.id}/refund/propose`, { amountCents: cents, reason: reason.trim() }); onDone("Remboursement proposé, en attente d'un super administrateur."); }
      else { const r = await post<{ refundedCents: number; totalRefundedCents: number }>(`/admin/deals/${file.id}/refund`, { amountCents: cents, reason: reason.trim() }); onDone(`Remboursé ${money(r.refundedCents, cur)} (cumul ${money(r.totalRefundedCents, cur)}). L'Expéditeur est prévenu par email.`); }
    } catch (e) { setErr(e instanceof ApiError ? `${e.status} : ${e.message}` : "Action impossible."); }
    finally { setBusy(false); }
  }
  return (
    <Card title="Remboursement manuel (geste commercial)" className="mt-5">
      <p className="text-[12px] text-slate-500">Hors litige, sur un deal fermé et débité. Le Voyageur n'est pas touché : c'est Yamba qui rend l'argent. Plafond : <b>{money(file.manualRefund.maxRefundableCents, cur)}</b> (payé − déjà remboursé). Motif de {REFUND_MIN_REASON} caractères au moins. Un super administrateur applique.</p>
      {file.manualRefund.last && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px]">Dernier remboursement manuel : {money(file.manualRefund.last.amountCents, cur)} par {file.manualRefund.last.byAdmin} le {dateTime(file.manualRefund.last.at)} — {file.manualRefund.last.reason}</p>}
      {file.manualRefund.proposal && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">Proposé : {money(file.manualRefund.proposal.amountCents, cur)} par {file.manualRefund.proposal.byAdmin} le {dateTime(file.manualRefund.proposal.at)} — {file.manualRefund.proposal.reason}</p>}
      {!canPropose && !canApply ? (
        <p className="mt-2 text-[12.5px] text-slate-500">{file.manualRefund.maxRefundableCents <= 0 || (!file.allowedActions.proposeRefund && !file.allowedActions.applyRefund) ? "Aucun remboursement manuel possible sur ce deal (état, montant, ou tu es partie)." : "Ton profil ne propose ni n'applique de remboursement manuel."}</p>
      ) : (
        <div className="mt-2">
          <div className="flex flex-wrap items-center gap-2">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Montant (ex. 12.50)" inputMode="decimal" className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px]" />
            <span className="text-[12px] text-slate-500">{cur}</span>
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 2000))} rows={2} placeholder={`Motif (${REFUND_MIN_REASON} caractères au moins)`} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-[12.5px]" />
          <div className="mt-2 flex flex-wrap gap-2">
            {canPropose && !canApply && <button disabled={!ok} onClick={() => run("propose")} className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Proposer</button>}
            {canApply && <button disabled={!ok} onClick={() => run("apply")} className="rounded-lg bg-red-700 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">Rembourser maintenant</button>}
          </div>
          {err && <p className="mt-2 text-[12px] text-red-700">{err}</p>}
        </div>
      )}
    </Card>
  );
}
function Mono({ v }: { v: string | null }) { return v ? <span className="font-mono text-[11px]">{v}</span> : <span>—</span>; }
function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}><h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h2><div className="mt-2 space-y-1.5">{children}</div></section>;
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4 text-[13px]"><span className="shrink-0 text-slate-500">{k}</span><span className="text-right font-medium">{v}</span></div>;
}
