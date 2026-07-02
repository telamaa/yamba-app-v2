/**
 * BookingNextStepsTip.tsx
 * =======================
 * Bloc bleu pédagogique "Comment ça va se passer ?" — collapsible.
 * Côté Sender : 5 étapes avec focus sur le code de livraison
 * (transmission à Marie + validation à l'arrivée + période de vérif J+3).
 *
 * À placer dans views/accepted/ (Phase 3).
 */

"use client";

import { ChevronDown, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  compact?: boolean;
  defaultCollapsed?: boolean;
};

export default function BookingNextStepsTip({
                                              booking,
                                              compact = false,
                                              defaultCollapsed = false,
                                            }: Props) {
  const t = useTranslations("bookingTracker");
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const carrierFirstName = booking.carrier.firstName;
  const recipientFirstName = booking.recipient.firstName;
  const pickupLocation = booking.pickupLocation.name;
  // Version courte du nom de lieu (ex: "CDG" au lieu de "À l'aéroport CDG · Terminal 2E")
  const pickupShortName =
    booking.pickupLocation.type === "AIRPORT"
      ? booking.pickupLocation.name.match(/CDG|ORY|JFK|LHR|[A-Z]{3}/)?.[0] ||
      "lieu de remise"
      : booking.pickupLocation.city || "lieu de remise";

  const items = compact
    ? [
      t("nextSteps.items.meetingShort", { carrierFirstName }),
      t("nextSteps.items.handoverShort", { carrierFirstName, pickupShortName }),
      t("nextSteps.items.codeArrivesShort"),
      t("nextSteps.items.deliveryShort", { recipientFirstName }),
      t("nextSteps.items.verificationShort"),
    ]
    : [
      t("nextSteps.items.meeting", { carrierFirstName, pickupLocation }),
      t("nextSteps.items.handover", { carrierFirstName }),
      t("nextSteps.items.codeArrives", { carrierFirstName, recipientFirstName }),
      t("nextSteps.items.delivery", { carrierFirstName, recipientFirstName }),
      t("nextSteps.items.verification"),
    ];

  return (
    <section className="rounded-xl bg-blue-50 px-4 py-3.5 dark:bg-blue-950/30 sm:rounded-2xl sm:px-5 sm:py-4">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 text-left"
      >
        <Lightbulb
          size={15}
          className="flex-shrink-0 text-blue-700 dark:text-blue-400"
          aria-hidden="true"
        />
        <span className="flex-1 text-[13px] font-semibold text-blue-900 dark:text-blue-200 sm:text-[14px]">
          {t("nextSteps.title")}
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-blue-700 transition-transform dark:text-blue-400 ${
            collapsed ? "-rotate-90" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {!collapsed && (
        <ul className="mt-3 space-y-1.5 sm:space-y-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[12px] leading-relaxed text-blue-800 dark:text-blue-300 sm:text-[13px]"
            >
              <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-blue-700 dark:bg-blue-400" />
              <span>{parseBold(item)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function parseBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-blue-900 dark:text-blue-200">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
