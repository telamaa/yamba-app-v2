"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { KeyRound, Mail, Package, Star } from "lucide-react";
import type { CarrierAction, CarrierActionKind } from "./trips.types";
import {
  categoryLabel,
  formatDateShort,
  formatDayMonth,
  formatMoney,
  formatRelativePast,
  formatRemaining,
  formatTimeShort,
  formatWeight,
  isSameDay,
  type Translator,
} from "./trips.format";

const MANGO = "#FF9900";

type Props = {
  action: CarrierAction;
  nowMs: number;
};

/* ── Styles par type d'action ───────────────────────────────────── */

const ICON_WRAPPER_CLASSES: Record<CarrierActionKind, string> = {
  RESPOND:
    "bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300",
  PICKUP:
    "bg-violet-50 text-violet-700 dark:bg-violet-900/25 dark:text-violet-300",
  DELIVER:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300",
  RATE: "bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300",
};

const BADGE_AMBER =
  "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
const BADGE_EMERALD =
  "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";

/* ── Contenu par type d'action ──────────────────────────────────── */

type ActionLabels = {
  title: string;
  meta: string;
  sub: string;
  badge: string;
  badgeClass: string;
  cta: string;
  pulse: boolean;
};

function buildLabels(
  action: CarrierAction,
  t: Translator,
  locale: string,
  nowMs: number
): ActionLabels {
  const { deal, trip } = action;
  const category = categoryLabel(t, deal.category);
  const weight = formatWeight(locale, deal.weightKg);
  const earnings = formatMoney(locale, deal.netEarningsEur);
  const firstName = deal.shipper.firstName;

  const tripMeta =
    isSameDay(trip.departureAt, nowMs)
      ? t("action.tripMetaToday", {
        origin: trip.originCity,
        destination: trip.destinationCity,
      })
      : t("action.tripMeta", {
        origin: trip.originCity,
        destination: trip.destinationCity,
        date: formatDateShort(locale, trip.departureAt),
      });

  switch (action.kind) {
    case "RESPOND": {
      const remaining = action.deadlineAt
        ? formatRemaining(action.deadlineAt, nowMs, locale)
        : null;
      return {
        title: t("action.respondTitle", { firstName }),
        meta: tripMeta,
        sub: t("action.respondSub", {
          category,
          weight,
          earnings,
          when: deal.expiresAt
            ? formatRelativePast(
              locale,
              new Date(
                new Date(deal.expiresAt).getTime() - 24 * 3_600_000
              ).toISOString(),
              nowMs
            )
            : "",
        }),
        badge: t("actionBadge.expiresIn", { remaining: remaining ?? "—" }),
        badgeClass: BADGE_AMBER,
        cta: t("actionCta.respond"),
        pulse: true,
      };
    }

    case "PICKUP": {
      const meetingAt = action.deadlineAt;
      const badge = meetingAt
        ? isSameDay(meetingAt, nowMs)
          ? t("actionBadge.todayAt", {
            time: formatTimeShort(locale, meetingAt),
          })
          : t("actionBadge.meetingAt", {
            date: formatDateShort(locale, meetingAt),
          })
        : "";
      return {
        title: t("action.pickupTitle", { firstName }),
        meta: tripMeta,
        sub: t("action.pickupSub", {
          when: meetingAt ? formatTimeShort(locale, meetingAt) : "",
          location: deal.pickupLocationName ?? "",
        }),
        badge,
        badgeClass: BADGE_AMBER,
        cta: t("actionCta.pickup"),
        pulse: false,
      };
    }

    case "DELIVER":
      return {
        title: t("action.deliverTitle", {
          recipientFirstName: deal.recipientFirstName ?? "",
        }),
        meta: t("action.tripMetaPast", {
          destination: trip.destinationCity,
          date: formatDayMonth(locale, trip.departureAt),
        }),
        sub: t("action.deliverSub", {
          shipperFirstName: firstName,
          recipientFirstName: deal.recipientFirstName ?? "",
          earnings,
        }),
        badge: t("actionBadge.readyToDeliver"),
        badgeClass: BADGE_EMERALD,
        cta: t("actionCta.deliver"),
        pulse: true,
      };

    case "RATE":
      return {
        title: t("action.rateTitle", { firstName }),
        meta: t("action.tripMetaPast", {
          destination: trip.destinationCity,
          date: formatDayMonth(locale, trip.departureAt),
        }),
        sub: t("action.rateSub", {
          category,
          weight,
          date: deal.deliveredAt
            ? formatDayMonth(locale, deal.deliveredAt)
            : "",
        }),
        badge: t("actionBadge.toRate"),
        badgeClass: BADGE_AMBER,
        cta: t("actionCta.rate", { firstName }),
        pulse: false,
      };
  }
}

/* ── Composant ──────────────────────────────────────────────────── */

export default function TripActionRow({ action, nowMs }: Props) {
  const t = useTranslations("myTrips");
  const locale = useLocale();

  const labels = buildLabels(action, t, locale, nowMs);
  const Icon =
    action.kind === "RESPOND"
      ? Mail
      : action.kind === "PICKUP"
        ? Package
        : action.kind === "DELIVER"
          ? KeyRound
          : Star;

  const isPrimaryCta = action.kind !== "RATE";

  const ctaClass = isPrimaryCta
    ? "inline-flex items-center whitespace-nowrap rounded-lg px-3 py-1.5 " +
    "text-xs font-medium text-slate-900 transition-[filter] hover:brightness-95"
    : "inline-flex items-center whitespace-nowrap rounded-lg border px-3 py-1.5 " +
    "text-xs font-medium transition-colors border-amber-400 text-amber-700 " +
    "hover:bg-amber-50 dark:border-amber-500/60 dark:text-amber-300 " +
    "dark:hover:bg-amber-900/20";

  const badgeClass =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full " +
    "px-2.5 py-0.5 text-[11px] font-medium " +
    labels.badgeClass;

  return (
    <Link
      href={action.href}
      className="group relative mb-1.5 flex w-full items-center gap-3 rounded-lg bg-white px-4 py-3 transition-colors hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800/60"
    >
      {/* Liseré urgence */}
      <span
        aria-hidden
        className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r bg-amber-400"
      />

      {/* Icône du moment */}
      <div
        className={
          "grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl " +
          ICON_WRAPPER_CLASSES[action.kind]
        }
      >
        <Icon size={18} />
      </div>

      {/* Titre + sous-titre */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-slate-900 dark:text-white">
          {labels.title}
          <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">
            · {labels.meta}
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
            style={isPrimaryCta ? { backgroundColor: MANGO } : undefined}
          >
            {labels.cta}
          </span>
        </div>
      </div>

      {/* Desktop : badge + CTA en ligne */}
      <div className="hidden flex-shrink-0 items-center gap-3 md:flex">
        <span className={badgeClass}>
          {labels.pulse && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
          )}
          {labels.badge}
        </span>
        <span
          className={ctaClass}
          style={isPrimaryCta ? { backgroundColor: MANGO } : undefined}
        >
          {labels.cta}
        </span>
      </div>
    </Link>
  );
}
