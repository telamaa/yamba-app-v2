/**
 * DisputeInTransitLink.tsx — « Signaler un colis non livré » pendant le transit (B4-PR2, A72)
 * ============================================================================================
 * Le serveur n'accepte le litige « non livré » que 48 h après le départ du
 * trajet (D51). Le front REFLÈTE : actif quand `dispute ∈ allowedActions`,
 * sinon visible mais désactivé avec la date d'ouverture SERVIE par l'API
 * (`disputeOpensAt`, jamais calculée ici — décision utilisateur 4A).
 */
"use client";

import { AlertTriangle, Clock3 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Booking } from "../booking-tracker.types";

type Props = {
  booking: Booking;
  align?: "left" | "center";
};

export default function DisputeInTransitLink({ booking, align = "left" }: Props) {
  const t = useTranslations("bookingTracker");
  const format = useFormatter();
  const router = useRouter();
  const allowed = booking.allowedActions?.includes("dispute") ?? false;
  const opensAt = booking.disputeOpensAt ? new Date(booking.disputeOpensAt) : null;
  const wrap = align === "center" ? "pt-1 text-center" : "";

  if (allowed) {
    return (
      <div className={wrap}>
        <button
          type="button"
          onClick={() => router.push("/bookings/" + booking.id + "/report")}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500 transition-colors hover:text-red-700 dark:text-slate-400 dark:hover:text-red-400"
        >
          <AlertTriangle size={13} aria-hidden="true" />
          {t("senderTracking.reportNotDelivered")}
        </button>
      </div>
    );
  }

  if (!opensAt) return null;

  return (
    <div className={wrap}>
      <p
        className="inline-flex items-start gap-1.5 text-[12px] leading-snug text-slate-400 dark:text-slate-500"
        aria-disabled="true"
      >
        <Clock3 size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        <span>
          {t("senderTracking.reportLocked", {
            date: format.dateTime(opensAt, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
          })}
        </span>
      </p>
    </div>
  );
}
