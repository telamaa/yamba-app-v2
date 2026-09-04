/**
 * DecisionForm.tsx — trancher un litige ou arbitrer une retenue (C-PR2, D55 2A/3A)
 * =================================================================================
 * Issue → montant (partiel libre, bornes serveur rappelées) → motif ≥ 50 caractères
 * → RÉCAPITULATIF des flux (remboursé / versé / conservé) → validation irréversible.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, post } from "@/lib/api";
import { RESOLUTION_LABEL, money } from "@/lib/format";
import type { AdminDisputeFile, AdminResolutionResponse, DisputeResolutionOutcome, RetentionArbitrationOutcome } from "@/lib/types";

const MIN_REASON = 50;

export default function DecisionForm({ file, canDecide = true }: { file: AdminDisputeFile; canDecide?: boolean }) {
  const router = useRouter();
  const cur = file.money.currencyCode;
  const total = file.money.totalShipperCents;
  const net = file.money.transportCents;
  const isDispute = file.kind === "DISPUTE";

  const [outcome, setOutcome] = useState<DisputeResolutionOutcome | RetentionArbitrationOutcome | null>(null);
  const [refundEur, setRefundEur] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<AdminResolutionResponse | null>(null);

  const refundCents = Math.round(Number(refundEur.replace(",", ".")) * 100);
  const partialValid = Number.isInteger(refundCents) && refundCents >= 1 && refundCents <= total - 1;

  // Les flux, calculés comme le serveur (D54 3A) — le récapitulatif ne doit jamais mentir.
  let flows: { refund: number; carrier: number; yamba: number } | null = null;
  if (outcome === "REJECTED") flows = { refund: 0, carrier: net, yamba: total - net };
  if (outcome === "FULL_REFUND") flows = { refund: total, carrier: 0, yamba: 0 };
  if (outcome === "PARTIAL_REFUND" && partialValid) {
    const carrier = Math.max(0, net - refundCents);
    flows = { refund: refundCents, carrier, yamba: total - refundCents - carrier };
  }
  if (outcome === "COMPENSATE_CARRIER") flows = { refund: 0, carrier: file.proposedAmounts.compensateCarrierCents ?? 0, yamba: (file.money.retentionCents ?? 0) - (file.proposedAmounts.compensateCarrierCents ?? 0) };
  if (outcome === "RESTITUTE_SHIPPER") flows = { refund: file.proposedAmounts.restituteShipperCents ?? 0, carrier: 0, yamba: 0 };

  const ready = !!outcome && !!flows && reason.trim().length >= MIN_REASON && !busy;

  async function submit() {
    if (!ready || !outcome) return;
    setBusy(true);
    setError(null);
    try {
      const r = isDispute
        ? await post<AdminResolutionResponse>(`/admin/disputes/${file.bookingId}/resolve`, {
            outcome,
            ...(outcome === "PARTIAL_REFUND" ? { refundCents } : {}),
            reason: reason.trim(),
          })
        : await post<AdminResolutionResponse>(`/admin/disputes/${file.bookingId}/retention`, { outcome, reason: reason.trim() });
      setDone(r);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status} : ${e.message}` : "Décision impossible.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
        <h2 className="text-[13px] font-bold text-emerald-900">Décision enregistrée</h2>
        <p className="mt-1 text-[13px] text-emerald-900">
          {RESOLUTION_LABEL[done.outcome] ?? done.outcome} · deal {done.finalStatus} · remboursé {money(done.refundCents, cur)} · versé {money(done.carrierPayoutCents, cur)}
          {done.payoutStatus ? ` (versement ${done.payoutStatus})` : ""}
        </p>
        <p className="mt-1 text-[12px] text-emerald-800">Les deux parties sont prévenues (écran, notification, email).</p>
        <button onClick={() => router.push("/disputes")} className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white">Retour à la file</button>
      </section>
    );
  }

  if (!canDecide) {
    return <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-600">Ton profil lit ce dossier mais ne tranche pas (médiateur ou super administrateur).</section>;
  }
  if (!file.canDecide) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-600">
        {file.dispute?.resolution || file.retentionDecision ? "Ce dossier est déjà tranché." : `Décision possible à partir du ${file.decidableAt ? new Date(file.decidableAt).toLocaleString("fr-FR") : "—"} (72 h laissées au Voyageur), ou dès sa réponse.`}
      </section>
    );
  }

  const options: Array<{ value: DisputeResolutionOutcome | RetentionArbitrationOutcome; hint: string }> = isDispute
    ? [
        { value: "REJECTED", hint: `Voyageur : ${money(net, cur)} · Yamba garde ${money(total - net, cur)}` },
        { value: "PARTIAL_REFUND", hint: `Montant libre entre 0,01 et ${money(total - 1, cur)} · Voyageur = net − montant (plancher 0)` },
        { value: "FULL_REFUND", hint: `Expéditeur : ${money(total, cur)} (commission comprise) · Voyageur : 0` },
      ]
    : [
        { value: "COMPENSATE_CARRIER", hint: `Voyageur : ${money(file.proposedAmounts.compensateCarrierCents, cur)} (prorata de sa part nette)` },
        { value: "RESTITUTE_SHIPPER", hint: `Expéditeur : ${money(file.proposedAmounts.restituteShipperCents, cur)} remboursés` },
      ];

  return (
    <section className="rounded-xl border-2 border-slate-900 bg-white p-4">
      <h2 className="text-[13px] font-bold">Trancher</h2>
      <p className="mt-0.5 text-[12px] text-slate-500">Irréversible. Le remboursement part immédiatement, le versement suit par l'exécuteur (rejoué par le cron en cas d'échec).</p>

      <div className="mt-3 space-y-2">
        {options.map((o) => (
          <label key={o.value} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${outcome === o.value ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
            <input type="radio" name="outcome" className="mt-1" checked={outcome === o.value} onChange={() => setOutcome(o.value)} />
            <span>
              <span className="block text-[13px] font-semibold">{RESOLUTION_LABEL[o.value]}</span>
              <span className="block text-[11.5px] text-slate-500">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {outcome === "PARTIAL_REFUND" && (
        <label className="mt-3 block text-[12.5px] font-medium">
          Montant remboursé à l'Expéditeur ({cur})
          <input inputMode="decimal" value={refundEur} onChange={(e) => setRefundEur(e.target.value)} placeholder="ex. 15,00" className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-[14px] tabular-nums" />
          {refundEur && !partialValid && <span className="ml-2 text-[11.5px] text-red-600">entre 0,01 et {money(total - 1, cur)}</span>}
        </label>
      )}

      <label className="mt-3 block text-[12.5px] font-medium">
        Motif (lu par les deux parties, {MIN_REASON} caractères au moins)
        <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 2000))} rows={4} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] leading-relaxed" placeholder="Ce que les preuves montrent, ce qui a pesé, ce qui est décidé." />
        <span className="text-[11px] text-slate-500">{reason.trim().length} / {MIN_REASON} min</span>
      </label>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}

      {!confirming ? (
        <button disabled={!ready} onClick={() => setConfirming(true)} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
          Voir le récapitulatif
        </button>
      ) : (
        flows && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-[12.5px] font-bold text-amber-900">Récapitulatif des flux, avant validation définitive</p>
            <ul className="mt-2 space-y-1 text-[13px] text-amber-950">
              <li>Remboursé à l'Expéditeur ({file.shipper.firstName}) : <b>{money(flows.refund, cur)}</b></li>
              <li>Versé au Voyageur ({file.carrier.firstName}) : <b>{money(flows.carrier, cur)}</b></li>
              <li>Conservé par Yamba : <b>{money(flows.yamba, cur)}</b></li>
              <li className="text-[12px] text-amber-800">Issue : {RESOLUTION_LABEL[outcome!]}. Motif : « {reason.trim().slice(0, 120)}{reason.trim().length > 120 ? "…" : ""} »</li>
            </ul>
            <div className="mt-3 flex gap-2">
              <button disabled={busy} onClick={submit} className="rounded-lg bg-red-700 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
                {busy ? "Exécution…" : "Valider définitivement"}
              </button>
              <button disabled={busy} onClick={() => setConfirming(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-[13px]">Revenir</button>
            </div>
          </div>
        )
      )}
    </section>
  );
}
