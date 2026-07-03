/**
 * DealTrackingClient.tsx
 * ======================
 * Orchestrateur de la vue tracking (PICKED_UP). Tient le state des
 * événements confirmés (toggle add/remove pour supporter l'undo du
 * Spotlight) et rend Desktop ou Mobile.
 */

"use client";

import { useCallback, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";
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

  const [confirmedEvents, setConfirmedEvents] = useState<DealTrackingEventId[]>(
    deal.trackingEvents?.map((e) => e.id) ?? []
  );

  // Toggle : ajoute si absent (confirmation), retire si présent (undo)
  const handleEventConfirmed = useCallback(
    (id: DealTrackingEventId) => {
      setConfirmedEvents((prev) => {
        if (prev.includes(id)) {
          return prev.filter((e) => e !== id);
        }
        // Fire-and-forget : le mock log l'événement (le vrai backend gèrera
        // l'annulation dans la fenêtre d'undo via un débounce serveur)
        confirmTrackingEvent(deal.id, id).catch(() => {
          /* silencieux en mock */
        });
        return [...prev, id];
      });
    },
    [deal.id]
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
  onDeliverAction: () => void;
};
