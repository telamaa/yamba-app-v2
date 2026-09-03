/**
 * DisputeFileView.tsx — le dossier de médiation, lecture seule (C-PR1)
 * ====================================================================
 * Quatre blocs : chronologie, argent, les deux parties (faits de réputation),
 * preuves (déclaration → prise en charge → jalons → remise → litige).
 * La consultation est journalisée côté serveur (DISPUTE_VIEWED).
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { CATEGORY_LABEL, OUTCOME_LABEL, STEP_LABEL, dateTime, money } from "@/lib/format";
import type { AdminDisputeFile, Party } from "@/lib/types";

export default function DisputeFileView({ bookingId }: { bookingId: string }) {
  const [file, setFile] = useState<AdminDisputeFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AdminDisputeFile>(`/admin/disputes/${bookingId}`)
      .then(setFile)
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? "Ce deal n'est pas en attente d'arbitrage." : e.message));
  }, [bookingId]);

  if (error) return <p className="text-[13px] text-red-700">{error}</p>;
  if (!file) return <p className="text-[13px] text-slate-500">Chargement du dossier…</p>;

  const cur = file.money.currencyCode;
  return (
    <div className="max-w-5xl">
      <Link href="/disputes" className="text-[12.5px] text-slate-500 hover:underline">← À arbitrer</Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-bold">{file.kind === "DISPUTE" ? file.dispute?.ticketNumber ?? "Litige" : "Retenue à arbitrer"}</h1>
        <span className="text-[13px] text-slate-500">{file.corridor.originCity} → {file.corridor.destinationCity} · {file.status}</span>
      </div>
      <p className="mt-1 rounded-lg bg-slate-100 px-3 py-2 text-[12.5px] text-slate-600">Lecture seule en C-PR1. La décision (rejet, remboursement partiel ou total, compensation ou restitution de la retenue) arrive avec C-PR2.</p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Card title="Chronologie">
          <Row k="Demande" v={dateTime(file.timeline.requestedAt)} />
          <Row k="Acceptation" v={dateTime(file.timeline.acceptedAt)} />
          <Row k="Départ du trajet" v={dateTime(file.timeline.departureAt)} />
          <Row k="Prise en charge" v={dateTime(file.timeline.pickedUpAt)} />
          <Row k="Remise" v={dateTime(file.timeline.deliveredAt)} />
          {file.timeline.disputedAt && <Row k="Signalement" v={dateTime(file.timeline.disputedAt)} />}
          {file.timeline.closedAt && <Row k={`Fermé (${file.timeline.closedBy ?? "?"})`} v={dateTime(file.timeline.closedAt)} />}
          {file.timeline.cancelReason && <Row k="Motif d'annulation" v={file.timeline.cancelReason} />}
        </Card>

        <Card title="Argent">
          <Row k="Payé par l'Expéditeur" v={money(file.money.totalShipperCents, cur)} />
          <Row k="Net Voyageur" v={money(file.money.transportCents, cur)} />
          <Row k="Commission Yamba" v={money(file.money.commissionCents, cur)} />
          {file.money.premiumCents > 0 && <Row k="Prime protection" v={money(file.money.premiumCents, cur)} />}
          <Row k="Capturé" v={dateTime(file.money.capturedAt)} />
          <Row k="Versement" v={file.money.payoutStatus ?? "—"} />
          {file.money.refundAmountCents != null && <Row k="Remboursé" v={`${money(file.money.refundAmountCents, cur)} · ${dateTime(file.money.refundedAt)}`} />}
          {file.money.retentionCents != null && <Row k="Retenue" v={`${money(file.money.retentionCents, cur)} · ${file.money.retentionDisposition ?? ""}`} />}
        </Card>

        <PartyCard title="Expéditeur" p={file.shipper} unit="envois" />
        <PartyCard title="Voyageur" p={file.carrier} unit="Deals" />
      </div>

      <Card title="Colis déclaré" className="mt-5">
        <Row k="Catégorie" v={file.parcel.category} />
        <Row k="Description" v={file.parcel.description} />
        <Row k="Valeur déclarée" v={money(file.parcel.declaredValueCents, cur)} />
        <Row k="Poids" v={`${file.parcel.weightKg} kg`} />
        <Row k="Destinataire" v={`${file.recipient.firstName} ${file.recipient.lastName}`} />
        <Photos urls={file.parcel.photoUrls} label="Photos de déclaration" />
      </Card>

      {file.pickup && (
        <Card title={`Prise en charge · ${dateTime(file.pickup.confirmedAt)}`} className="mt-5">
          <Row k="Checklist" v={file.pickup.checklist.join(" · ") || "—"} />
          {file.pickup.notes && <Row k="Notes" v={file.pickup.notes} />}
          <Photos urls={file.pickup.photoUrls} label="Photos à la prise en charge" />
        </Card>
      )}

      {file.trackingEvents.length > 0 && (
        <Card title="Jalons du voyage" className="mt-5">
          {file.trackingEvents.map((e) => (
            <Row key={e.step + e.confirmedAt} k={STEP_LABEL[e.step] ?? e.step} v={dateTime(e.confirmedAt)} />
          ))}
        </Card>
      )}

      {file.deliveryPhotoUrls.length > 0 && (
        <Card title="Remise" className="mt-5">
          <Photos urls={file.deliveryPhotoUrls} label="Photos à la remise" />
        </Card>
      )}

      {file.dispute && (
        <Card title={`Signalement ${file.dispute.ticketNumber} · ${CATEGORY_LABEL[file.dispute.category] ?? file.dispute.category}`} className="mt-5 border-red-200">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800">{file.dispute.description}</p>
          <Row k="Solution souhaitée" v={file.dispute.desiredOutcome ? OUTCOME_LABEL[file.dispute.desiredOutcome] : "—"} />
          <Row k="Engagement sur l'honneur" v={dateTime(file.dispute.pledgeAcceptedAt)} />
          <Photos urls={file.dispute.photoUrls} label="Photos du litige" />
        </Card>
      )}
    </div>
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
    <div className="flex justify-between gap-4 text-[13px]">
      <span className="text-slate-500">{k}</span>
      <span className="text-right font-medium text-slate-900">{v}</span>
    </div>
  );
}

function PartyCard({ title, p, unit }: { title: string; p: Party; unit: string }) {
  return (
    <Card title={title}>
      <Row k="Nom" v={`${p.firstName} ${p.lastName}`} />
      <Row k="Email" v={p.email} />
      <Row k={`${unit} terminés`} v={String(p.completedDealsCount)} />
      <Row k="Annulations tardives" v={String(p.lateCancellationsCount)} />
      <Row k="Avis révélés" v={p.ratingsCount > 0 ? `${p.ratingsAvg.toFixed(1)} sur ${p.ratingsCount}` : "aucun"} />
    </Card>
  );
}

function Photos({ urls, label }: { urls: string[]; label: string }) {
  if (urls.length === 0) return <p className="text-[12px] text-slate-400">{label} : aucune</p>;
  return (
    <div>
      <p className="text-[12px] text-slate-500">{label}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {urls.map((u) => (
          <a key={u} href={u} target="_blank" rel="noreferrer" className="block h-24 w-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
          </a>
        ))}
      </div>
    </div>
  );
}
