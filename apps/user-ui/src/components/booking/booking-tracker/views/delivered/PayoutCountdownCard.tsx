/**
 * PayoutCountdownCard.tsx
 * =======================
 * "VERSEMENT AUTOMATIQUE DANS · 2 jours · 14h" — countdown SOBRE
 * (jamais de rouge, pas d'anxiété) + barre de progression fine +
 * steps Livraison ✓ / J+1 / J+2 / J+3 / J+4 versement.
 * Tick à la minute.
 */

"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  PAYOUT_DAY,
  type Booking,
} from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  compact?: boolean;
};

export default function PayoutCountdownCard({ booking, compact = false }: Props) {
  const t = useTranslations("bookingTracker");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const deliveredMs = booking.delivery
    ? new Date(booking.delivery.deliveredAt).getTime()
    : nowMs;
  const payoutMs = deliveredMs + PAYOUT_DAY * 24 * 3600 * 1000;

  const remainingMs = Math.max(0, payoutMs - nowMs);
  const totalMs = PAYOUT_DAY * 24 * 3600 * 1000;
  const progress = Math.min(100, Math.max(2, ((totalMs - remainingMs) / totalMs) * 100));

  const remainingDays = Math.floor(remainingMs / (24 * 3600 * 1000));
  const remainingHours = Math.floor((remainingMs % (24 * 3600 * 1000)) / (3600 * 1000));

  // Jour courant depuis la livraison (J+1, J+2...)
  const currentDay = Math.min(
    PAYOUT_DAY,
    Math.max(1, Math.ceil((nowMs - deliveredMs) / (24 * 3600 * 1000)))
  );

  const steps = [
    { key: "delivered", label: t("delivered.countdown.delivered"), done: true },
    ...Array.from({ length: PAYOUT_DAY }, (_, i) => {
      const day = i + 1;
      const isPayout = day === PAYOUT_DAY;
      const label = isPayout
        ? "J+" + day + " · " + t("delivered.countdown.payout")
        : "J+" + day;
      return {
        key: "day" + day,
        label:
          day === currentDay && !isPayout
            ? label + " · " + t("delivered.countdown.today")
            : label,
        done: false,
        active: day === currentDay,
      };
    }),
  ];

  return (
    <section
      className={`rounded-2xl bg-slate-100 dark:bg-slate-900 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
            compact ? "text-[10px]" : "text-[11px]"
          }`}
        >
          {compact
            ? t("delivered.countdown.labelShort")
            : t("delivered.countdown.label")}
        </span>
        <span
          className={`font-bold tabular-nums text-slate-900 dark:text-white ${
            compact ? "text-[13px]" : "text-[14px]"
          }`}
        >
          {t("delivered.countdown.value", {
            days: remainingDays,
            hours: remainingHours,
          })}
        </span>
      </div>

      {/* Barre de progression */}
      <div
        className={`overflow-hidden rounded-full bg-white dark:bg-slate-800 ${
          compact ? "mt-2.5 h-1" : "mt-3.5 h-1.5"
        }`}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-emerald-600 transition-all dark:bg-emerald-500"
          style={{ width: progress + "%" }}
        />
      </div>

      {/* Steps */}
      <div
        className={`flex items-center justify-between ${
          compact ? "mt-2 text-[10px]" : "mt-2.5 text-[11px]"
        }`}
      >
        {steps.map((step) => (
          <span
            key={step.key}
            className={`inline-flex items-center gap-0.5 whitespace-nowrap ${
              step.done
                ? "font-semibold text-emerald-700 dark:text-emerald-400"
                : "active" in step && step.active
                  ? "font-semibold text-slate-900 dark:text-white"
                  : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {step.label}
            {step.done && <Check size={10} strokeWidth={3} aria-hidden="true" />}
          </span>
        ))}
      </div>
    </section>
  );
}
