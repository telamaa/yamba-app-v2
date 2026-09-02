/**
 * SenderTrackingTimeline.tsx
 * ==========================
 * "ÉTAPES DU VOYAGE" côté Expéditrice — miroir LECTURE SEULE de la
 * timeline Voyageur. Textes enrichis ("Thomas est entré dans la zone
 * d'embarquement"). L'étape active = la prochaine attendue.
 */

"use client";

import { Check, Plane } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import PhotoThumbs from "@/components/shared/photos/PhotoThumbs";
import type {
  Booking,
  BookingTrackingEventId,
} from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  compact?: boolean;
};

type StepState = "done" | "active" | "upcoming";

export default function SenderTrackingTimeline({
                                                 booking,
                                                 compact = false,
                                               }: Props) {
  const t = useTranslations("bookingTracker");
  const locale = useLocale();

  const events = booking.trackingEvents ?? [];
  const findEvent = (id: BookingTrackingEventId) =>
    events.find((e) => e.id === id);

  const carrierFirstName = booking.carrier.firstName;
  const recipientFirstName = booking.recipient.firstName;
  const destinationCity = booking.trip.destinationCity;

  const acceptedAt = booking.acceptedAt ? new Date(booking.acceptedAt) : null;
  const pickedUpAt = booking.pickup ? new Date(booking.pickup.pickedUpAt) : null;
  const departureDate = new Date(booking.trip.departureDate);
  const arrivalDate = booking.trip.durationHours
    ? new Date(departureDate.getTime() + booking.trip.durationHours * 3600 * 1000)
    : null;

  const atAirport = findEvent("AT_AIRPORT");
  const departed = findEvent("FLIGHT_DEPARTED");
  const arrived = findEvent("FLIGHT_ARRIVED");

  // Étape active = la première non franchie (côté lecture)
  const airportState: StepState = atAirport ? "done" : "active";
  const departedState: StepState = departed
    ? "done"
    : atAirport
      ? "active"
      : "upcoming";
  const arrivedState: StepState = arrived
    ? "done"
    : departed
      ? "active"
      : "upcoming";
  const deliveryState: StepState = arrived ? "active" : "upcoming";

  const durationStr = booking.trip.durationHours
    ? locale === "fr"
      ? booking.trip.durationHours + "h"
      : booking.trip.durationHours + "h"
    : "—";

  const steps: {
    key: string;
    state: StepState;
    num: number;
    title: string;
    sub?: string;
    inFlightIcon?: boolean;
    extra?: ReactNode;
  }[] = [
    {
      key: "accepted",
      state: "done",
      num: 1,
      title: compact
        ? t("senderTracking.timeline.acceptedShort")
        : t("senderTracking.timeline.accepted", { carrierFirstName }),
      sub: acceptedAt
        ? t("senderTracking.timeline.yesterday") +
        " · " +
        formatTime(acceptedAt, locale)
        : undefined,
    },
    {
      key: "pickedUp",
      state: "done",
      num: 2,
      title: compact
        ? t("senderTracking.timeline.pickedUpShort", {
          location: shortLocation(booking),
        })
        : t("senderTracking.timeline.pickedUp", {
          location: shortLocation(booking),
        }),
      sub: pickedUpAt
        ? t("senderTracking.timeline.today") +
        " · " +
        formatTime(pickedUpAt, locale) +
        (booking.pickup?.locationName && !compact
          ? " · " + booking.pickup.locationName
          : "")
        : undefined,
      extra:
        booking.pickup && booking.pickup.photos.length > 0 ? (
          <PhotoThumbs photos={booking.pickup.photos} tone="amber" size="sm" className="mt-2" />
        ) : null,
    },
    {
      key: "atAirport",
      state: airportState,
      num: 3,
      title: compact
        ? t("senderTracking.timeline.atAirportShort", {
          airport: shortLocation(booking),
        })
        : t("senderTracking.timeline.atAirport", {
          airport: shortLocation(booking),
        }),
      sub: atAirport
        ? compact
          ? t("senderTracking.timeline.atAirportSubShort", {
            time: formatTime(new Date(atAirport.at), locale),
          })
          : t("senderTracking.timeline.atAirportSub", {
            time: formatTime(new Date(atAirport.at), locale),
            carrierFirstName,
          })
        : t("senderTracking.timeline.atAirportPending", { carrierFirstName }),
    },
    {
      key: "departed",
      state: departedState,
      num: 4,
      title: compact
        ? t("senderTracking.timeline.departedShort")
        : t("senderTracking.timeline.departed", { destinationCity }),
      sub: departed
        ? t("senderTracking.timeline.departedSub", {
          time: formatTime(new Date(departed.at), locale),
          duration: durationStr,
        })
        : t("senderTracking.timeline.departedPending", {
          hour: formatHour(departureDate, locale),
        }),
      inFlightIcon: departedState === "done" || departedState === "active",
    },
    {
      key: "arrived",
      state: arrivedState,
      num: 5,
      title: compact
        ? t("senderTracking.timeline.arrivedShort", { destinationCity })
        : t("senderTracking.timeline.arrived", { destinationCity }),
      sub: arrived
        ? t("senderTracking.timeline.arrivedSub", {
          time: formatTime(new Date(arrived.at), locale),
          carrierFirstName,
        })
        : arrivalDate
          ? t("senderTracking.timeline.arrivedPending", {
            hour: formatHour(arrivalDate, locale),
            destinationCity,
          })
          : undefined,
    },
    {
      key: "delivery",
      state: deliveryState,
      num: 6,
      title: t("senderTracking.timeline.delivery", { recipientFirstName }),
      sub: compact
        ? t("senderTracking.timeline.deliverySubShort", { carrierFirstName })
        : t("senderTracking.timeline.deliverySub", { carrierFirstName }),
    },
  ];

  return (
    <section
      className={
        "rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl " +
        (compact ? "p-4" : "p-4 sm:p-5")
      }
    >
      <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:text-[11px]">
        {t("senderTracking.timeline.label")}
      </h3>

      <ol className="relative">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <li key={step.key} className="relative flex gap-3.5 pb-5 last:pb-0">
              {!isLast && (
                <span
                  className={
                    "absolute left-[13px] top-8 h-[calc(100%-24px)] w-px " +
                    (step.state === "done"
                      ? "bg-emerald-300 dark:bg-emerald-800"
                      : "bg-slate-200 dark:bg-slate-800")
                  }
                  aria-hidden="true"
                />
              )}

              <span
                className={
                  "relative z-10 flex h-[27px] w-[27px] flex-shrink-0 items-center justify-center rounded-full text-[12px] font-semibold " +
                  (step.state === "done"
                    ? "bg-emerald-700 text-white dark:bg-emerald-600"
                    : step.state === "active"
                      ? "bg-[#FF9900] text-white"
                      : "border-[1.5px] border-dashed border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-500")
                }
                aria-hidden="true"
              >
                {step.state === "done" ? (
                  <Check size={13} strokeWidth={3} />
                ) : step.inFlightIcon && step.state === "active" ? (
                  <Plane size={13} />
                ) : (
                  step.num
                )}
              </span>

              <div className="min-w-0 flex-1 pt-0.5">
                <span
                  className={
                    "font-semibold " +
                    (compact ? "text-[13.5px]" : "text-[14px]") +
                    " " +
                    (step.state === "upcoming"
                      ? "text-slate-400 dark:text-slate-500"
                      : "text-slate-900 dark:text-white")
                  }
                >
                  {step.title}
                </span>
                {step.sub && (
                  <div
                    className={
                      "mt-0.5 leading-snug " +
                      (compact ? "text-[11px]" : "text-[12px]") +
                      " " +
                      (step.state === "done"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : step.state === "active"
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-slate-500 dark:text-slate-400")
                    }
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

function shortLocation(booking: Booking): string {
  // "À l'aéroport CDG · Terminal 2E" → "CDG"
  const name = booking.pickup?.locationName ?? booking.pickupLocation.name;
  const match = name.match(/\b[A-Z]{3}\b/);
  return match ? match[0] : booking.trip.originCity;
}

function formatTime(date: Date, locale: string): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  return locale === "fr" ? h + "h" + m : h + ":" + m;
}

function formatHour(date: Date, locale: string): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const mm = m > 0 ? m.toString().padStart(2, "0") : "00";
  return locale === "fr" ? h + "h" + mm : h + ":" + mm;
}
