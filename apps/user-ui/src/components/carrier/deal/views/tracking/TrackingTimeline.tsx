/**
 * TrackingTimeline.tsx
 * ====================
 * "ÉTAPES DU VOYAGE" — timeline verticale à 6 étapes, ÉTAT PUR (zéro bouton,
 * on agit uniquement via le Spotlight).
 *  1. Deal accepté ✓
 *  2. Colis pris en charge ✓ (+ photos pickup amber)
 *  3. Arrivée à l'aéroport (optionnel)
 *  4. Décollage (optionnel)
 *  5. Atterrissage (optionnel)
 *  6. Livraison à Marie (obligatoire)
 * L'étape active (mango) = celle affichée dans le Spotlight.
 */

"use client";

import { Check, ImageIcon, Package } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type {
  DealRequest,
  DealTrackingEventId,
} from "@/components/carrier/deal/deal.types";
import { getNextEvent } from "./TrackingSpotlight";

type Props = {
  deal: DealRequest;
  confirmedEvents: DealTrackingEventId[];
  compact?: boolean;
};

type StepState = "done" | "active" | "upcoming";

export default function TrackingTimeline({
                                           deal,
                                           confirmedEvents,
                                           compact = false,
                                         }: Props) {
  const t = useTranslations("carrierDealTracking");
  const locale = useLocale();

  const recipientFirstName = deal.recipient?.firstName ?? "";
  const destinationCity = deal.trip.destinationCity;
  const next = getNextEvent(confirmedEvents);

  const acceptedAt = new Date(deal.createdAt);
  const pickedUpAt = deal.pickup ? new Date(deal.pickup.pickedUpAt) : null;
  const departureDate = new Date(deal.trip.departureDate);
  const arrivalDate = deal.trip.durationHours
    ? new Date(departureDate.getTime() + deal.trip.durationHours * 3600 * 1000)
    : null;

  const eventState = (id: DealTrackingEventId): StepState =>
    confirmedEvents.includes(id) ? "done" : next === id ? "active" : "upcoming";

  const steps: {
    key: string;
    state: StepState;
    num: number;
    title: string;
    sub?: string;
    optional?: boolean;
    extra?: ReactNode;
  }[] = [
    {
      key: "accepted",
      state: "done",
      num: 1,
      title: t("timeline.steps.accepted"),
      sub: `${t("timeline.yesterday")} · ${formatTime(acceptedAt, locale)}`,
    },
    {
      key: "pickedUp",
      state: "done",
      num: 2,
      title: t("timeline.steps.pickedUp"),
      sub: pickedUpAt
        ? `${t("timeline.today")} · ${formatTime(pickedUpAt, locale)} · ${
          deal.pickup?.locationName ?? ""
        }`
        : undefined,
      extra:
        deal.pickup && deal.pickup.photos.length > 0 ? (
          <div className="mt-2 flex gap-1.5">
            {deal.pickup.photos.map((photo) => (
              <div
                key={photo.id}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-white"
                style={{ background: "linear-gradient(135deg, #BA7517, #EF9F27)" }}
                aria-label={photo.label}
              >
                {photo.context === "PICKUP_PACKAGED" ? (
                  <Package size={14} aria-hidden="true" />
                ) : (
                  <ImageIcon size={14} aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        ) : null,
    },
    {
      key: "atAirport",
      state: eventState("AT_AIRPORT"),
      num: 3,
      title: t("timeline.steps.atAirport"),
      sub: t("timeline.steps.atAirportSub"),
      optional: true,
    },
    {
      key: "departed",
      state: eventState("FLIGHT_DEPARTED"),
      num: 4,
      title: t("timeline.steps.departed"),
      sub: t("timeline.steps.departedSub", {
        hour: formatHour(departureDate, locale),
      }),
      optional: true,
    },
    {
      key: "arrived",
      state: eventState("FLIGHT_ARRIVED"),
      num: 5,
      title: t("timeline.steps.arrived"),
      sub: arrivalDate
        ? t("timeline.steps.arrivedSub", {
          destinationCity,
          hour: formatHour(arrivalDate, locale),
        })
        : undefined,
      optional: true,
    },
    {
      key: "delivery",
      state: next === "DELIVER" ? "active" : "upcoming",
      num: 6,
      title: t("timeline.steps.delivery", { recipientFirstName }),
      sub: t("timeline.steps.deliverySub"),
    },
  ];

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl ${
        compact ? "p-4" : "p-4 sm:p-5"
      }`}
    >
      <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:text-[11px]">
        {t("timeline.label")}
      </h3>

      <ol className="relative">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <li key={step.key} className="relative flex gap-3.5 pb-5 last:pb-0">
              {/* Ligne verticale */}
              {!isLast && (
                <span
                  className={`absolute left-[13px] top-8 h-[calc(100%-24px)] w-px ${
                    step.state === "done"
                      ? "bg-emerald-300 dark:bg-emerald-800"
                      : "bg-slate-200 dark:bg-slate-800"
                  }`}
                  aria-hidden="true"
                />
              )}

              {/* Dot */}
              <span
                className={`relative z-10 flex h-[27px] w-[27px] flex-shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                  step.state === "done"
                    ? "bg-emerald-700 text-white dark:bg-emerald-600"
                    : step.state === "active"
                      ? "bg-[#FF9900] text-white"
                      : "border-[1.5px] border-dashed border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-500"
                }`}
                aria-hidden="true"
              >
                {step.state === "done" ? (
                  <Check size={13} strokeWidth={3} />
                ) : (
                  step.num
                )}
              </span>

              {/* Contenu */}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`font-semibold ${
                      compact ? "text-[13.5px]" : "text-[14px]"
                    } ${
                      step.state === "upcoming"
                        ? "text-slate-400 dark:text-slate-500"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {step.title}
                  </span>
                  {step.optional && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {t("timeline.optionalBadge")}
                    </span>
                  )}
                </div>
                {step.sub && (
                  <div
                    className={`mt-0.5 leading-snug ${
                      compact ? "text-[11px]" : "text-[12px]"
                    } ${
                      step.state === "done"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {step.sub}
                  </div>
                )}
                {step.extra}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function formatTime(date: Date, locale: string): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  return locale === "fr" ? `${h}h${m}` : `${h}:${m}`;
}

function formatHour(date: Date, locale: string): string {
  const h = date.getHours();
  return locale === "fr" ? `${h}h00` : `${h}:00`;
}
