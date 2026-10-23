/**
 * BookingStatusNotice.tsx — vue d'état neutre (A37)
 * =================================================
 * Remplace le fallback menteur (statut inconnu → vue « accepté »).
 * Sert les statuts sans écran dédié : AWAITING_CARRIER (É3b hors
 * périmètre v1 — Mes envois porte l'annulation), DECLINED, EXPIRED,
 * CANCELLED, VERIFIED (É10 notation = B5), DISPUTED.
 * Une URL directe /bookings/[id] ne doit jamais mentir : elle dit
 * l'état, la suite, et ramène vers Mes envois.
 * Responsive une seule colonne — pas de double arbre desktop/mobile
 * pour un écran d'information.
 */
"use client";

import MediationDecisionCard from "@/components/shared/mediation/MediationDecisionCard";

import { useFormatter, useTranslations } from "next-intl";
import { CheckCircle2, Clock3, Info, ShieldAlert, XCircle } from "lucide-react";
import type { Booking, BookingStatus } from "../../booking-tracker.types";

type NoticeStatus = Extract<
  BookingStatus,
  "AWAITING_CARRIER" | "DECLINED" | "EXPIRED" | "CANCELLED" | "VERIFIED" | "DISPUTED"
>;

type Props = {
  booking: Booking;
  onBackAction: () => void;
};

const ICONS: Record<NoticeStatus, typeof Info> = {
  AWAITING_CARRIER: Clock3,
  DECLINED: XCircle,
  EXPIRED: Clock3,
  CANCELLED: XCircle,
  VERIFIED: CheckCircle2,
  DISPUTED: ShieldAlert,
};

// Charte : teal = engagement/argent tenu, slate = neutre/refus.
const ICON_CLASSES: Record<NoticeStatus, string> = {
  AWAITING_CARRIER: "bg-amber-50 text-[#B45309] dark:bg-amber-950/40",
  DECLINED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  EXPIRED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  CANCELLED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  VERIFIED: "bg-teal-50 text-[#0F766E] dark:bg-teal-950/40",
  DISPUTED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const MESSAGE_KEYS: Record<NoticeStatus, string> = {
  AWAITING_CARRIER: "awaiting",
  DECLINED: "declined",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  VERIFIED: "verified",
  DISPUTED: "disputed",
};

export default function BookingStatusNotice({ booking, onBackAction }: Props) {
  const t = useTranslations("bookingTracker.statusNotice");
  const format = useFormatter();
  // Les montants sont des CENTS entiers (A2) : la conversion n'a lieu qu'ici.
  // EUR en dur suit le view-model de ce module, qui ne porte pas la devise
  // (`payment.totalPaidEur`, et « {value} € » partout ailleurs). Ce n'est pas
  // une décision : c'est la dette de ce module, et elle se solde en faisant
  // remonter `pricing.currencyCode` jusqu'ici — pas dans cette ligne.
  const formatCents = (cents: number) =>
    format.number(cents / 100, { style: "currency", currency: "EUR" });
  const status = booking.status as NoticeStatus;
  // ANO-WEB-73 (5.21) : un remboursement total tranché par la médiation clôt le deal en CANCELLED — « Demande
  // annulée · Cette demande est close » titrait une décision rendue sur un colis livré. La clôture par la
  // médiation a son propre texte.
  const closParLaMediation = status === "CANCELLED" && !!(booking.dispute?.resolution || booking.retentionDecision);
  // Jumeau natif (A221) : un colis REFUSÉ au rendez-vous est un `CANCELLED`
  // côté machine, mais ce n'est pas l'Expéditeur qui s'est désisté. Lui
  // titrer « Demande annulée » lui impute un geste qu'il n'a pas fait.
  const refuseAuRendezVous = status === "CANCELLED" && !closParLaMediation && !!booking.pickupRefusalReason;
  const key = closParLaMediation
    ? "cancelledByMediation"
    : refuseAuRendezVous
      ? "pickupRefused"
      : MESSAGE_KEYS[status];
  const Icon = ICONS[status];

  const dateIso =
    status === "AWAITING_CARRIER"
      ? booking.expiresAt
      : status === "VERIFIED"
        ? booking.delivery?.deliveredAt
        : booking.closedAt;
  const date = dateIso
    ? format.dateTime(new Date(dateIso), {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${ICON_CLASSES[status]}`}
        >
          <Icon className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="mt-5 text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-white">
          {t(`${key}.title`)}
        </h1>
        <p className="mt-1 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
          {booking.trip.originCity} → {booking.trip.destinationCity} ·{" "}
          {booking.parcel.weightKg} kg
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
          {t(`${key}.message`)}
          {date ? " " + t(`${key}.dateLine`, { date }) : ""}
        </p>
        {/* A221 — « si un remboursement s'applique, il t'a été confirmé par
            email » était la seule information donnée sur l'argent d'un envoi
            clos : le montant est SERVI (`refundAmountCents`), il se lit ici.
            0 et `null` ne disent pas la même chose — on n'affiche que ce qui
            a vraiment été rendu. */}
        {typeof booking.refundAmountCents === "number" && booking.refundAmountCents > 0 ? (
          <p className="mt-2 text-[13px] font-bold text-slate-700 dark:text-slate-300">
            {t("refundLine", { amount: formatCents(booking.refundAmountCents) })}
          </p>
        ) : null}
        {typeof booking.retentionCents === "number" && booking.retentionCents > 0 ? (
          <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">
            {t("retainedLine", { amount: formatCents(booking.retentionCents) })}
          </p>
        ) : null}
        {/* Le motif du refus : le Voyageur l'a écrit, l'Expéditeur ne le
            voyait nulle part. Il explique une fin qui, sans lui, est muette. */}
        {booking.pickupRefusalReason || booking.declineReason ? (
          <p className="mt-2 text-[13px] text-slate-600 dark:text-slate-400">
            {t("reasonLine", { reason: booking.pickupRefusalReason ?? booking.declineReason ?? "" })}
          </p>
        ) : null}
        {status === "DISPUTED" && booking.disputeTicket ? (
          <p className="mt-2 text-[13px] font-bold text-slate-700 dark:text-slate-300">
            {t("ticketLine", { ticket: booking.disputeTicket })}
          </p>
        ) : null}
        {/* C-PR2 (D55) — annulé par décision de médiation, ou retenue arbitrée : la décision se lit ici. */}
        {status === "CANCELLED" && (booking.dispute?.resolution || booking.retentionDecision) ? (
          <div className="mt-5 text-left">
            <MediationDecisionCard
              role="SHIPPER"
              ticket={booking.dispute?.ticketNumber ?? null}
              resolution={booking.dispute?.resolution ?? null}
              retentionDecision={booking.retentionDecision ?? null}
              retentionCents={booking.retentionCents ?? null}
              compact
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={onBackAction}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#FF9900] px-6 py-2.5 text-[13px] font-bold text-slate-950 hover:bg-[#F08700]"
        >
          {t("backToShipments")}
        </button>
      </div>
    </div>
  );
}
