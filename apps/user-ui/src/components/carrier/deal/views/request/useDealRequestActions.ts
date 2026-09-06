/**
 * useDealRequestActions.ts — accept / decline, partagé desktop + mobile
 * =====================================================================
 * Même philosophie que useBookingCheckout : UNE implémentation des appels
 * et du mapping d'erreurs, les deux vues ne gardent que leur mise en page.
 *
 * Mapping des 409 du cycle de vie (BOOKING_LIFECYCLE_ERROR_CODES) :
 *  - CARRIER_ONBOARDING_REQUIRED → gate D31 : profil/Stripe incomplets,
 *    on emmène le Voyageur finir son onboarding ;
 *  - TRANSITION_NOT_ALLOWED → le deal a changé entre-temps (2 clics,
 *    1 gagnant) : on RELIT le serveur, la page bascule d'elle-même ;
 *  - PAYMENT_STATE_CONFLICT → l'empreinte n'est plus capturable/annulable :
 *    on relit aussi (le webhook D40 a pu clôturer le deal).
 */

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { dealQueryKey } from "@/components/carrier/deal/DealClient";
import { MY_DEALS_QUERY_KEY } from "@/hooks/useMyDeals";
import { acceptDeal, DealApiError, declineDeal } from "@/components/carrier/deal/deal.api";
import type { DealRequest, DeclineReason } from "@/components/carrier/deal/deal.types";

type Args = {
  deal: DealRequest;
  /** Appelé après un accept réussi (DealClient invalide et re-render). */
  onAcceptedAction: () => void;
  /** Appelé après un decline réussi (retour à l'accueil aujourd'hui). */
  onCloseAction: () => void;
};

export function useDealRequestActions({ deal, onAcceptedAction, onCloseAction }: Args) {
  const t = useTranslations("carrierDealRequest");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isSubmittingAccept, setIsSubmittingAccept] = useState(false);
  const [isSubmittingDecline, setIsSubmittingDecline] = useState(false);

  const refreshDeal = () => {
    void queryClient.invalidateQueries({ queryKey: dealQueryKey(deal.id) });
    void queryClient.invalidateQueries({ queryKey: MY_DEALS_QUERY_KEY });
  };

  const handleTransitionError = (e: unknown, fallback: string) => {
    if (e instanceof DealApiError) {
      if (e.code === "CARRIER_ONBOARDING_REQUIRED") {
        toast.error(t("errors.onboardingRequired"), { duration: 6000 });
        router.push("/carrier/onboarding");
        return;
      }
      if (e.code === "TRANSITION_NOT_ALLOWED") {
        toast.error(t("errors.dealChanged"));
        refreshDeal();
        return;
      }
      if (e.code === "PAYMENT_STATE_CONFLICT") {
        toast.error(t("errors.paymentConflict"));
        refreshDeal();
        return;
      }
    }
    toast.error(fallback);
  };

  const submitAccept = async () => {
    setIsSubmittingAccept(true);
    try {
      await acceptDeal(deal.id, { charterAccepted: true });
      toast.success(t("accept.toastSuccess"), { duration: 4500 });
      onAcceptedAction();
    } catch (e) {
      handleTransitionError(e, t("accept.toastError"));
    } finally {
      setIsSubmittingAccept(false);
    }
  };

  const submitDecline = async (payload: { reason?: DeclineReason }) => {
    setIsSubmittingDecline(true);
    try {
      await declineDeal(deal.id, payload);
      toast.success(
        t("decline.toastSuccess", { shipperFirstName: deal.shipper.firstName }),
        { duration: 4500 }
      );
      refreshDeal();
      onCloseAction();
      return true;
    } catch (e) {
      handleTransitionError(e, t("decline.toastError"));
      return false;
    } finally {
      setIsSubmittingDecline(false);
    }
  };

  return {
    submitAccept,
    submitDecline,
    isSubmittingAccept,
    isSubmittingDecline,
    isSubmitting: isSubmittingAccept || isSubmittingDecline,
  };
}
