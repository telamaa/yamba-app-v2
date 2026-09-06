"use client";

/**
 * TripDealRow.tsx — UNE ligne de deal sous un trajet (vue Voyageur)
 * ==================================================================
 * Extraite de TripCard (vitrine mock /dashboard/trips/preview) pour
 * servir AUSSI la liste réelle « Mes trajets » et la page trajet
 * propriétaire (A44). Badge + sous-titre dérivés du statut, ligne
 * entière cliquable vers /carrier/deals/[id] — aucun CTA imbriqué.
 */

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { CarrierDealItem, CarrierDealStatus } from "./trips.types";
import {
  categoryLabel,
  formatMoney,
  formatRemaining,
  formatTimeShort,
  formatWeight,
  type Translator,
} from "./trips.format";

/* ── Badges deal (mapping statique) ─────────────────────────────── */

export const BADGE_BASE =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ";

export const BADGE_TONES = {
  slate: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  teal: "bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  emerald:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  red: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
} as const;

type DealBadge = { label: string; tone: keyof typeof BADGE_TONES; pulse: boolean };

export function buildDealBadge(
  deal: CarrierDealItem,
  t: Translator
): DealBadge {
  switch (deal.status) {
    case "PENDING":
      return { label: t("deal.badgePending"), tone: "amber", pulse: true };
    case "ACCEPTED":
      return { label: t("deal.badgeAccepted"), tone: "teal", pulse: false };
    case "PICKED_UP":
      if (deal.lastTrackingStep === "FLIGHT_ARRIVED") {
        return { label: t("deal.badgeReady"), tone: "emerald", pulse: true };
      }
      return { label: t("deal.badgeInTransit"), tone: "teal", pulse: false };
    case "DELIVERED":
      return { label: t("deal.badgeDelivered"), tone: "emerald", pulse: false };
    case "COMPLETED":
      return { label: t("deal.badgeCompleted"), tone: "emerald", pulse: false };
    case "DISPUTED":
      return { label: t("deal.badgeDisputed"), tone: "red", pulse: false };
    case "DECLINED":
    case "EXPIRED":
    case "CANCELLED":
      return { label: t("trip.statusCancelled"), tone: "slate", pulse: false };
  }
}

export function buildDealSub(
  deal: CarrierDealItem,
  t: Translator,
  locale: string,
  nowMs: number
): string {
  switch (deal.status) {
    case "PENDING":
      return t("deal.pendingSub", {
        remaining: deal.expiresAt
          ? formatRemaining(deal.expiresAt, nowMs, locale) ?? "—"
          : "—",
      });
    case "ACCEPTED":
      return t("deal.acceptedSub", {
        when: deal.pickupMeetingAt
          ? formatTimeShort(locale, deal.pickupMeetingAt)
          : "",
        location: deal.pickupLocationName ?? "",
      });
    case "PICKED_UP":
      if (deal.lastTrackingStep === "FLIGHT_ARRIVED") {
        return t("deal.readySub", {
          recipientFirstName: deal.recipientFirstName ?? "",
        });
      }
      return t("deal.pickedUpSub");
    case "DELIVERED":
      return t("deal.deliveredSub");
    case "COMPLETED": {
      // B4-PR3 (A77) : la ligne dit l'état RÉEL du versement, jamais « versés » par défaut.
      // B5 : « pense à noter {prénom} » tant que le serveur le permet.
      const rateHint = deal.hasRated ? "" : " · " + t("deal.rateHint", { firstName: deal.shipper.firstName });
      const earnings = formatMoney(locale, deal.netEarningsEur);
      if (deal.payoutStatus === "SENT") {
        return t("deal.completedSentSub", {
          earnings,
          date: deal.payoutSentAt ? new Date(deal.payoutSentAt).toLocaleDateString(locale, { day: "numeric", month: "short" }) : "",
        }) + rateHint;
      }
      if (deal.payoutStatus === "FAILED" && deal.payoutBlocker === "ACCOUNT_NOT_READY") {
        return t("deal.completedBlockedSub", { earnings }) + rateHint;
      }
      return t("deal.completedPendingSub", { earnings }) + rateHint;
    }
    case "DISPUTED":
      return t("deal.disputedSub", { ticket: deal.disputeTicket ?? "" });
    case "CANCELLED": {
      // D50/A82 — annulation tardive : la compensation (ou la retenue « à arbitrer ») se lit sur la ligne.
      if (deal.retentionDisposition === "CARRIER" && deal.payoutAmountCents != null) {
        const compensation = formatMoney(locale, deal.payoutAmountCents / 100);
        if (deal.payoutStatus === "SENT") return t("deal.cancelledCompensationSentSub", { amount: compensation });
        if (deal.payoutStatus === "FAILED" && deal.payoutBlocker === "ACCOUNT_NOT_READY") return t("deal.cancelledCompensationBlockedSub", { amount: compensation });
        return t("deal.cancelledCompensationPendingSub", { amount: compensation });
      }
      if (deal.retentionDisposition === "HELD_FOR_MEDIATION") return t("deal.cancelledHeldSub");
      return "";
    }
    default:
      return "";
  }
}

export const ENGAGED_STATUSES: CarrierDealStatus[] = [
  "ACCEPTED",
  "PICKED_UP",
  "DELIVERED",
  "COMPLETED",
];

/* ── Sous-composant : deal row (Link, pas de CTA imbriqué) ──────── */

export default function TripDealRow({
                       deal,
                       nowMs,
                     }: {
  deal: CarrierDealItem;
  nowMs: number;
}) {
  const t = useTranslations("myTrips");
  const locale = useLocale();

  const badge = buildDealBadge(deal, t);
  const sub = buildDealSub(deal, t, locale, nowMs);

  const line = deal.recipientFirstName
    ? t("deal.lineWithRecipient", {
      firstName: deal.shipper.firstName,
      lastInitial: deal.shipper.lastInitial,
      category: categoryLabel(t, deal.category),
      weight: formatWeight(locale, deal.weightKg),
      recipientFirstName: deal.recipientFirstName,
    })
    : t("deal.line", {
      firstName: deal.shipper.firstName,
      lastInitial: deal.shipper.lastInitial,
      category: categoryLabel(t, deal.category),
      weight: formatWeight(locale, deal.weightKg),
    });

  const isEngaged = ENGAGED_STATUSES.includes(deal.status);
  const moneyClass =
    "flex-none text-[13px] font-medium " +
    (isEngaged
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-slate-400 dark:text-slate-500");
  const moneyLabel =
    (isEngaged ? "" : "+ ") + formatMoney(locale, deal.netEarningsEur);

  const initials =
    deal.shipper.firstName.charAt(0) + deal.shipper.lastInitial.charAt(0);

  return (
    <Link
      href={"/carrier/deals/" + deal.id}
      className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:hover:bg-slate-100 dark:hover:bg-slate-800/60"
    >
      <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-teal-700 text-[11px] font-bold text-white">
        {initials.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-slate-900 dark:text-white">
          {line}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-slate-500 dark:text-slate-400">
          {sub}
        </div>
      </div>
      <span className={BADGE_BASE + BADGE_TONES[badge.tone]}>
        {badge.pulse && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        )}
        {badge.label}
      </span>
      <span className={moneyClass}>{moneyLabel}</span>
    </Link>
  );
}

