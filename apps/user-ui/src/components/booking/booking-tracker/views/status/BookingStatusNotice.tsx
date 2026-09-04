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
  const status = booking.status as NoticeStatus;
  const key = MESSAGE_KEYS[status];
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
