"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, Package } from "lucide-react";
import {
  formatRemaining,
  getShipmentPresentation,
  type ShipmentBadgeTone,
  type ShipmentCtaKind,
  type ShipmentListItem,
  type ShipmentTrackingStep,
} from "./shipments.types";

const MANGO = "#FF9900";

type Translator = ReturnType<typeof useTranslations>;

type Props = {
  item: ShipmentListItem;
  /** Horloge partagée (tick 60s dans le Client) pour les countdowns */
  nowMs: number;
  /** Ouvre la confirmation d'annulation — rendu seulement si item.canCancel
   *  (allowedActions serveur : le front reflète, ne décide jamais). */
  onCancelAction?: (item: ShipmentListItem) => void;
};

/* ─────────────────────── Styles (concaténation, convention projet) ─── */

const BADGE_CLASSES: Record<ShipmentBadgeTone, string> = {
  slate:
    "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  teal: "bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  amber:
    "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  emerald:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  red: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const CTA_CLASSES: Record<ShipmentCtaKind, string> = {
  primary:
    "text-slate-900 font-medium hover:brightness-95",
  outlineAmber:
    "border border-amber-400 text-amber-700 hover:bg-amber-50 " +
    "dark:border-amber-500/60 dark:text-amber-300 dark:hover:bg-amber-900/20",
  ghost:
    "border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 " +
    "dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white",
};

/* ─────────────────────── Helpers i18n (mapping statique) ───────────── */

function categoryLabel(t: Translator, category: ShipmentListItem["category"]): string {
  switch (category) {
    case "CLOTHES":
      return t("categories.CLOTHES");
    case "SHOES":
      return t("categories.SHOES");
    case "FASHION_ACCESSORIES":
      return t("categories.FASHION_ACCESSORIES");
    case "OTHER_ACCESSORIES":
      return t("categories.OTHER_ACCESSORIES");
    case "BOOKS":
      return t("categories.BOOKS");
    case "DOCUMENTS":
      return t("categories.DOCUMENTS");
    case "SMALL_TOYS":
      return t("categories.SMALL_TOYS");
    case "PHONE":
      return t("categories.PHONE");
    case "COMPUTER":
      return t("categories.COMPUTER");
    case "OTHER_ELECTRONICS":
      return t("categories.OTHER_ELECTRONICS");
    case "CHECKED_BAG_23KG":
      return t("categories.CHECKED_BAG_23KG");
    case "CABIN_BAG_12KG":
      return t("categories.CABIN_BAG_12KG");
  }
}

function trackingStepLabel(t: Translator, step: ShipmentTrackingStep): string {
  switch (step) {
    case "AT_AIRPORT":
      return t("trackingSteps.AT_AIRPORT");
    case "FLIGHT_DEPARTED":
      return t("trackingSteps.FLIGHT_DEPARTED");
    case "FLIGHT_ARRIVED":
      return t("trackingSteps.FLIGHT_ARRIVED");
  }
}

/* ─────────────────────── Helpers formatage (Intl) ──────────────────── */

function intlLocale(locale: string): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}

function formatWeight(locale: string, kg: number): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "unit",
    unit: "kilogram",
    maximumFractionDigits: 1,
  }).format(kg);
}

function formatDateTime(locale: string, iso: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDate(locale: string, iso: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

/** "il y a 2 heures" / "hier" — relatif auto (heures < 24h, sinon jours) */
function formatRelativePast(locale: string, iso: string, nowMs: number): string {
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  const diffMs = new Date(iso).getTime() - nowMs;
  const diffHours = Math.round(diffMs / 3_600_000);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  return rtf.format(Math.round(diffHours / 24), "day");
}

/* ─────────────────────── Contenu par statut ────────────────────────── */

type RowLabels = {
  badge: string;
  sub: string;
  cta: string;
  role: string;
  pulse: boolean;
};

function buildLabels(
  item: ShipmentListItem,
  t: Translator,
  locale: string,
  nowMs: number
): RowLabels {
  const category = categoryLabel(t, item.category);
  const weight = formatWeight(locale, item.weightKg);
  const firstName = item.carrier.firstName;

  switch (item.status) {
    case "PENDING": {
      const remaining = item.expiresAt
        ? formatRemaining(item.expiresAt, nowMs, locale)
        : null;
      return {
        badge: t("badge.pending", { remaining: remaining ?? "—" }),
        sub: t("sub.pending", {
          category,
          weight,
          when: item.requestedAt
            ? formatRelativePast(locale, item.requestedAt, nowMs)
            : "",
        }),
        cta: t("cta.viewRequest"),
        role: t("roles.requested"),
        pulse: false,
      };
    }

    case "ACCEPTED":
      return {
        badge: t("badge.accepted", { firstName }),
        sub: t("sub.accepted", {
          category,
          weight,
          when: item.pickupMeetingAt
            ? formatDateTime(locale, item.pickupMeetingAt)
            : "",
          location: item.pickupLocationName ?? "",
        }),
        cta: t("cta.prepare"),
        role: t("roles.yourCarrier"),
        pulse: false,
      };

    case "PICKED_UP": {
      if (item.hasTrackingEvents) {
        const step = item.lastTrackingStep ?? "AT_AIRPORT";
        const remaining = item.arrivalEtaAt
          ? formatRemaining(item.arrivalEtaAt, nowMs, locale)
          : null;
        const badge =
          step === "FLIGHT_DEPARTED"
            ? t("badge.inFlight", { remaining: remaining ?? "—" })
            : step === "FLIGHT_ARRIVED"
              ? t("badge.landed")
              : t("badge.atAirport");
        return {
          badge,
          sub: t("sub.transit", {
            category,
            weight,
            lastStep: trackingStepLabel(t, step),
          }),
          cta: t("cta.follow"),
          role:
            step === "FLIGHT_DEPARTED"
              ? t("roles.inFlight")
              : t("roles.yourCarrier"),
          pulse: step === "FLIGHT_DEPARTED",
        };
      }
      return {
        badge: t("badge.codeToShare"),
        sub: t("sub.codeToShare", {
          category,
          weight,
          when: item.pickedUpAt
            ? formatRelativePast(locale, item.pickedUpAt, nowMs)
            : "",
        }),
        cta: t("cta.transmitCode"),
        role: t("roles.yourCarrier"),
        pulse: true,
      };
    }

    case "DELIVERED": {
      const remaining = item.payoutAt
        ? formatRemaining(item.payoutAt, nowMs, locale)
        : null;
      return {
        badge: t("badge.verification", { remaining: remaining ?? "—" }),
        sub: t("sub.verification", {
          recipientFirstName: item.recipientFirstName ?? "",
          when: item.deliveredAt
            ? formatRelativePast(locale, item.deliveredAt, nowMs)
            : "",
          carrierFirstName: firstName,
        }),
        cta: t("cta.verify"),
        role: t("roles.yourCarrier"),
        pulse: false,
      };
    }

    case "COMPLETED": {
      if (item.hasRated) {
        return {
          badge: t("badge.completedRated"),
          sub: t("sub.completedRated", {
            date: item.deliveredAt ? formatDate(locale, item.deliveredAt) : "",
            firstName,
            stars: item.ratedStars ?? 5,
          }),
          cta: t("cta.recap"),
          role: t("roles.yourCarrier"),
          pulse: false,
        };
      }
      return {
        badge: t("badge.completedUnrated"),
        sub: t("sub.completedUnrated", { category, weight, firstName }),
        cta: t("cta.rate", { firstName }),
        role: t("roles.yourCarrier"),
        pulse: false,
      };
    }

    case "DISPUTED":
      return {
        badge: t("badge.disputed", { ticket: item.disputeTicket ?? "" }),
        sub: t("sub.disputed", { category, weight }),
        cta: t("cta.viewCase"),
        role: t("roles.yourCarrier"),
        pulse: false,
      };

    case "EXPIRED":
      return {
        badge: t("badge.expired"),
        sub: t("sub.expired", {
          date: item.expiresAt ? formatDate(locale, item.expiresAt) : "",
        }),
        cta: t("cta.details"),
        role: t("roles.noReply"),
        pulse: false,
      };

    case "DECLINED":
      return {
        badge: t("badge.declined"),
        sub: t("sub.declined", {
          date: item.requestedAt ? formatDate(locale, item.requestedAt) : "",
        }),
        cta: t("cta.details"),
        role: t("roles.yourCarrier"),
        pulse: false,
      };

    case "CANCELLED":
      return {
        badge: t("badge.cancelled"),
        sub: t("sub.cancelled", {
          date: item.requestedAt ? formatDate(locale, item.requestedAt) : "",
        }),
        cta: t("cta.details"),
        role: t("roles.yourCarrier"),
        pulse: false,
      };
  }
}

/* ─────────────────────── Composant ─────────────────────────────────── */

export default function ShipmentRow({ item, nowMs, onCancelAction }: Props) {
  const t = useTranslations("shipments");
  const locale = useLocale();

  const presentation = getShipmentPresentation(item);
  const labels = buildLabels(item, t, locale, nowMs);

  const showCancel = Boolean(item.canCancel && onCancelAction);
  const handleCancelClick = (e: React.MouseEvent) => {
    // La row entière est un Link : on neutralise la navigation.
    e.preventDefault();
    e.stopPropagation();
    onCancelAction?.(item);
  };

  const cancelBtnClass =
    "inline-flex items-center whitespace-nowrap rounded-lg px-3 py-1.5 " +
    "text-xs text-slate-400 underline-offset-2 transition-colors " +
    "hover:text-slate-700 hover:underline dark:text-slate-500 dark:hover:text-slate-300";

  const rowClass =
    "group relative mb-1.5 flex w-full items-center gap-3 rounded-lg px-4 py-3 " +
    "bg-white transition-colors hover:bg-slate-100 " +
    "dark:bg-slate-950 dark:hover:bg-slate-800/60 " +
    (presentation.muted ? "opacity-70 hover:opacity-100" : "");

  const thumbClass =
    "grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl " +
    (presentation.muted
      ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
      : "text-white");

  const badgeClass =
    "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full " +
    "px-2.5 py-0.5 text-[11px] font-medium " +
    BADGE_CLASSES[presentation.badgeTone];

  const ctaClass =
    "inline-flex items-center whitespace-nowrap rounded-lg px-3 py-1.5 " +
    "text-xs transition-colors " +
    CTA_CLASSES[presentation.ctaKind];

  return (
    <Link href={presentation.href} className={rowClass}>
      {/* Liseré urgence */}
      {presentation.urgent && (
        <span
          aria-hidden
          className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r bg-amber-400"
        />
      )}

      {/* Vignette */}
      <div
        className={thumbClass}
        style={
          presentation.muted
            ? undefined
            : { background: "linear-gradient(135deg, #534AB7, #7F77DD)" }
        }
      >
        <Package size={18} />
      </div>

      {/* Route + sous-titre */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-medium text-slate-900 dark:text-white">
            {item.originCity}
            <span className="mx-1 font-normal text-slate-400">→</span>
            {item.destinationCity}
          </span>
          <span className="hidden truncate text-[11.5px] text-slate-400 lg:inline dark:text-slate-500">
            {item.carrier.firstName} {item.carrier.lastInitial} · {labels.role}
          </span>
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {labels.sub}
        </div>

        {/* Mobile : badge + CTA sous le texte */}
        <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
          <span className={badgeClass}>
            {labels.pulse && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            )}
            {labels.badge}
          </span>
          <span
            className={ctaClass}
            style={
              presentation.ctaKind === "primary"
                ? { backgroundColor: MANGO }
                : undefined
            }
          >
            {labels.cta}
          </span>
          {showCancel && (
            <button type="button" onClick={handleCancelClick} className={cancelBtnClass}>
              {t("cancel.rowCta")}
            </button>
          )}
        </div>
      </div>

      {/* Desktop : badge + CTA + chevron en ligne */}
      <div className="hidden flex-shrink-0 items-center gap-3 md:flex">
        {showCancel && (
          <button type="button" onClick={handleCancelClick} className={cancelBtnClass}>
            {t("cancel.rowCta")}
          </button>
        )}
        <span className={badgeClass}>
          {labels.pulse && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
          )}
          {labels.badge}
        </span>
        <span
          className={ctaClass}
          style={
            presentation.ctaKind === "primary"
              ? { backgroundColor: MANGO }
              : undefined
          }
        >
          {labels.cta}
        </span>
        <ChevronRight
          size={16}
          className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400 dark:text-slate-600"
        />
      </div>
    </Link>
  );
}
