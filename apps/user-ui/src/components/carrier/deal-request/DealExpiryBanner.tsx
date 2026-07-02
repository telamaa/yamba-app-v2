/**
 * DealExpiryBanner.tsx
 * ====================
 * Compteur d'expiration compact.
 *
 * - Variant "inline" : chip rounded-lg (desktop, dans le flow principal)
 * - Variant "banner" : chip rounded-xl pleine largeur du conteneur (mobile,
 *   posé dans le scrollable content avec le même padding que les cards).
 *
 * Couleurs adaptatives : ambre par défaut, rouge si <2h, slate si expiré.
 * Layout interne compact : icône → label → temps, sans justify-between
 * (les éléments restent rapprochés pour une meilleure lisibilité).
 */

"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useExpiryCountdown } from "@/hooks/useExpiryCountdown";

type Props = {
  expiresAtIso: string;
  variant?: "inline" | "banner";
};

export default function DealExpiryBanner({
                                           expiresAtIso,
                                           variant = "inline",
                                         }: Props) {
  const t = useTranslations("carrierDealRequest");
  const { hoursLeft, minutesLeft, isExpired, isUrgent } =
    useExpiryCountdown(expiresAtIso);

  const tone = isExpired ? "expired" : isUrgent ? "urgent" : "normal";

  const styles = {
    normal: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-200 dark:border-amber-900/50",
      icon: "text-amber-700 dark:text-amber-400",
      label: "text-amber-900 dark:text-amber-200",
      time: "text-amber-900 dark:text-amber-100",
    },
    urgent: {
      bg: "bg-red-50 dark:bg-red-950/30",
      border: "border-red-200 dark:border-red-900/50",
      icon: "text-red-700 dark:text-red-400",
      label: "text-red-900 dark:text-red-200",
      time: "text-red-900 dark:text-red-100",
    },
    expired: {
      bg: "bg-slate-100 dark:bg-slate-800/60",
      border: "border-slate-200 dark:border-slate-700",
      icon: "text-slate-500 dark:text-slate-400",
      label: "text-slate-600 dark:text-slate-400",
      time: "text-slate-700 dark:text-slate-300",
    },
  }[tone];

  const timeText = formatTime(hoursLeft, minutesLeft, t);
  const label = isExpired ? t("expiry.expired") : t("expiry.labelShort");

  if (variant === "banner") {
    return (
      <div
        className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 ${styles.bg} ${styles.border}`}
        role={isUrgent ? "alert" : undefined}
      >
        <Clock size={14} className={`flex-shrink-0 ${styles.icon}`} />
        <span className={`text-[12px] font-medium ${styles.label}`}>{label}</span>
        {!isExpired && (
          <span className={`text-[13px] font-bold tabular-nums ${styles.time}`}>
            {timeText}
          </span>
        )}
      </div>
    );
  }

  // inline (desktop) — chip plus petit
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${styles.bg} ${styles.border}`}
      role={isUrgent ? "alert" : undefined}
    >
      <Clock size={13} className={`flex-shrink-0 ${styles.icon}`} />
      <span className={`text-[12px] font-medium ${styles.label}`}>{label}</span>
      {!isExpired && (
        <span className={`text-[13px] font-bold tabular-nums ${styles.time}`}>
          {timeText}
        </span>
      )}
    </div>
  );
}

function formatTime(
  hours: number,
  minutes: number,
  t: ReturnType<typeof useTranslations>
): string {
  if (hours > 0) {
    return t("expiry.timeFormatLong", { hours, minutes });
  }
  return t("expiry.timeFormatMinutesOnly", { minutes });
}
