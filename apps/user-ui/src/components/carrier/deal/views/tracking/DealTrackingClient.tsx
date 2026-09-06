/**
 * DealTrackingClient.tsx
 * ======================
 * Orchestrateur de la vue tracking (PICKED_UP). Tient le state OPTIMISTE
 * des événements confirmés (toggle add/remove pour supporter l'undo du
 * Spotlight) ; l'appel réel POST /deals/:id/events ne part qu'à la fin de
 * la fenêtre d'undo (`onEventCommittedAction` — A39). Échec serveur
 * (séquence, deal changé, réseau) → rollback + toast + relecture.
 */

"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";
import { dealQueryKey } from "../../DealClient";
import { confirmTrackingEvent } from "../../deal.api";
import type { DealRequest, DealTrackingEventId } from "../../deal.types";
import DealTrackingDesktop from "./DealTrackingDesktop";
import DealTrackingMobile from "./DealTrackingMobile";

type Props = {
  deal: DealRequest;
  onCloseAction: () => void;
};

export default function DealTrackingClient({ deal, onCloseAction }: Props) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("carrierDealTracking");

  const [confirmedEvents, setConfirmedEvents] = useState<DealTrackingEventId[]>(
    deal.trackingEvents?.map((e) => e.id) ?? []
  );

  // Toggle OPTIMISTE : ajoute si absent (confirmation), retire si présent (undo).
  // Aucun appel réseau ici — il part à la fin de la fenêtre (handleEventCommitted).
  const handleEventConfirmed = useCallback((id: DealTrackingEventId) => {
    setConfirmedEvents((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  }, []);

  // Fenêtre d'undo écoulée : l'appel réel. Le serveur vérifie la séquence
  // et l'absence de doublon ; sur refus on retire l'événement et on relit.
  const handleEventCommitted = useCallback(
    (id: DealTrackingEventId) => {
      confirmTrackingEvent(deal.id, id)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: dealQueryKey(deal.id) });
        })
        .catch(() => {
          setConfirmedEvents((prev) => prev.filter((e) => e !== id));
          toast.error(t("spotlight.errorToast"));
          void queryClient.invalidateQueries({ queryKey: dealQueryKey(deal.id) });
        });
    },
    [deal.id, queryClient, t]
  );

  const handleDeliver = useCallback(() => {
    // Sous-route de saisie du code (chantier suivant de cette PR)
    router.push(`/carrier/deals/${deal.id}/deliver`);
  }, [router, deal.id]);

  if (isMobile === null) return null;

  const shared = {
    deal,
    confirmedEvents,
    onBackAction: onCloseAction,
    onEventConfirmedAction: handleEventConfirmed,
    onEventCommittedAction: handleEventCommitted,
    onDeliverAction: handleDeliver,
  };

  return isMobile ? (
    <DealTrackingMobile {...shared} />
  ) : (
    <DealTrackingDesktop {...shared} />
  );
}

export type DealTrackingViewProps = {
  deal: DealRequest;
  confirmedEvents: DealTrackingEventId[];
  onBackAction: () => void;
  onEventConfirmedAction: (id: DealTrackingEventId) => void;
  onEventCommittedAction: (id: DealTrackingEventId) => void;
  onDeliverAction: () => void;
};
