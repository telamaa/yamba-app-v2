/**
 * useExpiryCountdown.ts
 * =====================
 * Hook qui retourne le temps restant jusqu'à une deadline ISO,
 * en se mettant à jour toutes les 30 secondes.
 *
 * Retourne aussi des flags utiles (isExpired, isUrgent < 2h).
 *
 * Utilisation :
 *   const { hoursLeft, minutesLeft, isExpired, isUrgent } =
 *     useExpiryCountdown(deal.expiresAt);
 */

"use client";

import { useEffect, useState } from "react";
import type { ExpiryStatus } from "@/components/carrier/deal-request/deal-request.types";

const UPDATE_INTERVAL_MS = 30 * 1000; // 30s — assez fin pour passer h→min sans drift
const URGENT_THRESHOLD_MINUTES = 2 * 60; // < 2h = urgent

function computeStatus(expiresAtIso: string): ExpiryStatus {
  const expiry = new Date(expiresAtIso).getTime();
  const now = Date.now();
  const diffMs = expiry - now;

  if (diffMs <= 0) {
    return {
      hoursLeft: 0,
      minutesLeft: 0,
      isExpired: true,
      isUrgent: false,
      totalMinutesLeft: 0,
    };
  }

  const totalMinutesLeft = Math.floor(diffMs / (60 * 1000));
  const hoursLeft = Math.floor(totalMinutesLeft / 60);
  const minutesLeft = totalMinutesLeft % 60;

  return {
    hoursLeft,
    minutesLeft,
    isExpired: false,
    isUrgent: totalMinutesLeft < URGENT_THRESHOLD_MINUTES,
    totalMinutesLeft,
  };
}

export function useExpiryCountdown(expiresAtIso: string): ExpiryStatus {
  const [status, setStatus] = useState<ExpiryStatus>(() =>
    computeStatus(expiresAtIso)
  );

  useEffect(() => {
    // Recalcule immédiatement quand expiresAtIso change
    setStatus(computeStatus(expiresAtIso));

    const tick = () => setStatus(computeStatus(expiresAtIso));
    const interval = setInterval(tick, UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [expiresAtIso]);

  return status;
}
