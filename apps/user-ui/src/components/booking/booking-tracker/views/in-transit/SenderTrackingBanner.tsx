/**
 * SenderTrackingBanner.tsx
 * ========================
 * Banner teal dynamique selon le dernier événement confirmé par le Voyageur :
 *  aucun → "Colis entre les mains de Thomas" (+ countdown vol)
 *  AT_AIRPORT → "Thomas est à l'aéroport" (+ countdown vol)
 *  FLIGHT_DEPARTED → "En vol vers Brazzaville" (+ countdown arrivée)
 *  FLIGHT_ARRIVED → "Thomas est arrivé à Brazzaville"
 * Tick 60s pour le countdown.
 */

"use client";

import { Plane, PlaneLanding, PlaneTakeoff, Package } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type {
  Booking,
  BookingTrackingEventId,
} from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  variant?: "inset" | "flush";
};

export default function SenderTrackingBanner({
                                               booking,
                                               variant = "inset",
                                             }: Props) {
  const t = useTranslations("bookingTracker");
  const locale = useLocale();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const events = booking.trackingEvents ?? [];
  const findEvent = (id: BookingTrackingEventId) =>
    events.find((e) => e.id === id);

  const carrierFirstName = booking.carrier.firstName;
  const recipientFirstName = booking.recipient.firstName;
  const destinationCity = booking.trip.destinationCity;

  const departureMs = new Date(booking.trip.departureDate).getTime();
  const arrivalMs = booking.trip.durationHours
    ? departureMs + booking.trip.durationHours * 3600 * 1000
    : null;

  const departed = findEvent("FLIGHT_DEPARTED");
  const arrived = findEvent("FLIGHT_ARRIVED");
  const atAirport = findEvent("AT_AIRPORT");

  let title: string;
  let sub: string;
  let countdown: string | null = null;
  let Icon = Package;

  if (arrived) {
    Icon = PlaneLanding;
    title = t("senderTracking.banner.landedTitle", {
      carrierFirstName,
      destinationCity,
    });
    sub = t("senderTracking.banner.landedSub", {
      time: formatTime(new Date(arrived.at), locale),
      recipientFirstName,
    });
  } else if (departed) {
    Icon = Plane;
    title = t("senderTracking.banner.inFlightTitle", { destinationCity });
    sub = t("senderTracking.banner.inFlightSub", {
      carrierFirstName,
      time: formatTime(new Date(departed.at), locale),
      arrivalHour: arrivalMs ? formatHour(new Date(arrivalMs), locale) : "—",
    });
    if (arrivalMs && arrivalMs > nowMs) {
      countdown = t("senderTracking.banner.arrivalIn", {
        countdown: formatCountdown(Math.round((arrivalMs - nowMs) / 60_000), locale),
      });
    }
  } else if (atAirport) {
    Icon = PlaneTakeoff;
    title = t("senderTracking.banner.atAirportTitle", { carrierFirstName });
    sub = t("senderTracking.banner.atAirportSub", {
      flightHour: formatHour(new Date(departureMs), locale),
    });
    if (departureMs > nowMs) {
      countdown = t("senderTracking.banner.flightIn", {
        countdown: formatCountdown(Math.round((departureMs - nowMs) / 60_000), locale),
      });
    }
  } else {
    Icon = Package;
    title = t("senderTracking.banner.pickedUpTitle", { carrierFirstName });
    sub = t("senderTracking.banner.pickedUpSub", {
      time: booking.pickup
        ? formatTime(new Date(booking.pickup.pickedUpAt), locale)
        : "—",
      flightHour: formatHour(new Date(departureMs), locale),
    });
    if (departureMs > nowMs) {
      countdown = t("senderTracking.banner.flightIn", {
        countdown: formatCountdown(Math.round((departureMs - nowMs) / 60_000), locale),
      });
    }
  }

  const containerClass =
    variant === "flush"
      ? "flex items-center gap-3 border-y border-teal-300 bg-teal-50 px-4 py-3 dark:border-teal-900/50 dark:bg-teal-950/30"
      : "flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4 dark:border-teal-900/40 dark:bg-teal-950/30";

  return (
    <div className={containerClass} role="status">
      <div
        className={
          "flex flex-shrink-0 items-center justify-center rounded-full bg-teal-700 text-white dark:bg-teal-600 " +
          (variant === "flush" ? "h-7 w-7" : "h-9 w-9")
        }
      >
        <Icon size={variant === "flush" ? 14 : 18} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={
            "font-semibold text-teal-950 dark:text-teal-100 " +
            (variant === "flush" ? "text-[13px]" : "text-[14px] sm:text-[15px]")
          }
        >
          {title}
        </div>
        <div
          className={
            "text-teal-800 dark:text-teal-300 " +
            (variant === "flush" ? "text-[11px]" : "mt-0.5 text-[12px] sm:text-[13px]")
          }
        >
          {sub}
        </div>
      </div>
      {countdown && (
        <div
          className={
            "flex-shrink-0 rounded-full bg-white px-3 py-1 font-bold text-teal-800 shadow-sm dark:bg-teal-900 dark:text-teal-100 " +
            (variant === "flush" ? "text-[11px]" : "text-[12px]")
          }
        >
          {countdown}
        </div>
      )}
    </div>
  );
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

function formatCountdown(totalMin: number, locale: string): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return m + " min";
  return locale === "fr"
    ? h + "h " + m.toString().padStart(2, "0") + "min"
    : h + "h " + m + "m";
}
