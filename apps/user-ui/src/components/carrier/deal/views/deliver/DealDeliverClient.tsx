/**
 * DealDeliverClient.tsx
 * =====================
 * Orchestrateur de l'écran de saisie du code. Tient le state :
 * tentatives, verrouillage 15 min (countdown), succès.
 * Succès → DeliverSuccess (célébration) puis retour au Deal (DELIVERED).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";
import {
  getDealRequest,
  MAX_DELIVERY_ATTEMPTS,
  validateDeliveryCode,
} from "../../deal.api";
import type { DealRequest } from "../../deal.types";
import DealSkeleton from "../../DealSkeleton";
import DealDeliverDesktop from "./DealDeliverDesktop";
import DealDeliverMobile from "./DealDeliverMobile";
import DeliverSuccess from "./DeliverSuccess";

type Props = {
  dealId: string;
};

export default function DealDeliverClient({ dealId }: Props) {
  const t = useTranslations("carrierDealDeliver");
  const isMobile = useIsMobile();
  const router = useRouter();

  const [deal, setDeal] = useState<DealRequest | null>(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [lockCountdown, setLockCountdown] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveredAt, setDeliveredAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDealRequest(dealId).then((d) => {
      if (!cancelled) setDeal(d);
    });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  // Countdown du verrouillage (tick 1s)
  useEffect(() => {
    if (!lockedUntil) return;
    const update = () => {
      const remainingMs = new Date(lockedUntil).getTime() - Date.now();
      if (remainingMs <= 0) {
        setLockedUntil(null);
        setAttemptsUsed(0);
        setErrorMessage(null);
        setLockCountdown("");
        return;
      }
      const totalSec = Math.ceil(remainingMs / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      setLockCountdown(min + ":" + sec.toString().padStart(2, "0"));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const handleBack = useCallback(() => {
    router.push("/carrier/deals/" + dealId);
  }, [router, dealId]);

  const handleSubmit = useCallback(
    async (code: string) => {
      if (!deal || isSubmitting || lockedUntil) return;
      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        const result = await validateDeliveryCode(deal.id, code, attemptsUsed);

        if (result.ok) {
          setDeliveredAt(result.deliveredAt);
          return;
        }

        if (result.reason === "LOCKED") {
          setAttemptsUsed(MAX_DELIVERY_ATTEMPTS);
          setLockedUntil(result.lockedUntil);
          setErrorMessage(null);
          return;
        }

        // WRONG_CODE
        setAttemptsUsed((prev) => prev + 1);
        setErrorMessage(
          t("otp.wrongCode", {
            recipientFirstName: deal.recipient?.firstName ?? "",
          })
        );
      } catch {
        toast.error(t("error.toastGeneric"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [deal, isSubmitting, lockedUntil, attemptsUsed, t]
  );

  if (isMobile === null || !deal) return <DealSkeleton />;

  // Écran de succès 🎉
  if (deliveredAt) {
    return (
      <DeliverSuccess
        deal={deal}
        deliveredAt={deliveredAt}
        onBackToDealAction={handleBack}
        onBackToDashboardAction={() => router.push("/")}
      />
    );
  }

  const shared = {
    deal,
    attemptsUsed,
    maxAttempts: MAX_DELIVERY_ATTEMPTS,
    errorMessage,
    isLocked: lockedUntil !== null,
    lockCountdown,
    isSubmitting,
    onBackAction: handleBack,
    onSubmitAction: handleSubmit,
  };

  return isMobile ? (
    <DealDeliverMobile {...shared} />
  ) : (
    <DealDeliverDesktop {...shared} />
  );
}

export type DealDeliverViewProps = {
  deal: DealRequest;
  attemptsUsed: number;
  maxAttempts: number;
  errorMessage: string | null;
  isLocked: boolean;
  lockCountdown: string;
  isSubmitting: boolean;
  onBackAction: () => void;
  onSubmitAction: (code: string) => void;
};
