/**
 * DealDeliverClient.tsx
 * =====================
 * Orchestrateur de l'écran de saisie du code. Le SERVEUR compte (A38) :
 * `attemptsUsed` et `lockedUntil` s'initialisent depuis la vue Carrier
 * (deliveryAttemptsLeft / deliveryLockedUntil) et se mettent à jour depuis
 * les `details` des 409 (DELIVERY_CODE_INVALID.attemptsLeft,
 * DELIVERY_LOCKED.lockedUntil). Le countdown local n'est qu'un affichage :
 * à l'expiration, le serveur a déjà remis le compteur à zéro.
 * Succès → DeliverSuccess (célébration) puis retour au Deal (DELIVERED).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";
import { dealQueryKey } from "../../DealClient";
import { MY_DEALS_QUERY_KEY } from "@/hooks/useMyDeals";
import {
  DealApiError,
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
  const queryClient = useQueryClient();

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
      if (cancelled) return;
      setDeal(d);
      // A38 — état SERVEUR de la saisie : essais déjà consommés, verrou en cours.
      setAttemptsUsed(MAX_DELIVERY_ATTEMPTS - (d.deliveryAttemptsLeft ?? MAX_DELIVERY_ATTEMPTS));
      const lock = d.deliveryLockedUntil ?? null;
      setLockedUntil(lock && new Date(lock).getTime() > Date.now() ? lock : null);
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
        const result = await validateDeliveryCode(deal.id, code);
        setDeliveredAt(result.deliveredAt);
        // La vérité est en base : la page Deal relira DELIVERED.
        void queryClient.invalidateQueries({ queryKey: dealQueryKey(deal.id) });
        void queryClient.invalidateQueries({ queryKey: MY_DEALS_QUERY_KEY });
      } catch (e) {
        if (e instanceof DealApiError) {
          if (e.code === "DELIVERY_CODE_INVALID") {
            const left = typeof e.details.attemptsLeft === "number" ? e.details.attemptsLeft : 0;
            setAttemptsUsed(MAX_DELIVERY_ATTEMPTS - left);
            setErrorMessage(
              t("otp.wrongCode", {
                recipientFirstName: deal.recipient?.firstName ?? "",
              })
            );
            return;
          }
          if (e.code === "DELIVERY_LOCKED") {
            setAttemptsUsed(MAX_DELIVERY_ATTEMPTS);
            setLockedUntil(typeof e.details.lockedUntil === "string" ? e.details.lockedUntil : null);
            setErrorMessage(null);
            return;
          }
          if (e.code === "DELIVERY_CODE_UNAVAILABLE") {
            toast.error(t("error.codeUnavailable"), { duration: 6000 });
            return;
          }
          if (e.code === "TRANSITION_NOT_ALLOWED") {
            // Verrou actif côté serveur ou deal déjà passé ailleurs : on relit.
            toast.error(t("error.dealChanged"));
            const fresh = await getDealRequest(deal.id).catch(() => null);
            if (fresh) {
              setDeal(fresh);
              setAttemptsUsed(MAX_DELIVERY_ATTEMPTS - (fresh.deliveryAttemptsLeft ?? MAX_DELIVERY_ATTEMPTS));
              setLockedUntil(fresh.deliveryLockedUntil ?? null);
            }
            return;
          }
        }
        toast.error(t("error.toastGeneric"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [deal, isSubmitting, lockedUntil, queryClient, t]
  );

  if (isMobile === null || !deal) return <DealSkeleton />;

  // Écran de succès 🎉
  // Écran de succès 🎉
  if (deliveredAt) {
    return (
      <DeliverSuccess
        deal={deal}
        deliveredAt={deliveredAt}
        onRateShipperAction={() =>
          router.push("/carrier/deals/" + deal.id + "/rate")
        }
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
