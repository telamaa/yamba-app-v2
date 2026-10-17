/**
 * useBookingExit — la sortie du tunnel de réservation (revue UX du 17/10)
 * =======================================================================
 * Un seul comportement, partagé par le wizard desktop et l'écran mobile :
 *
 *  1. rien de saisi → on sort sans rien demander (une confirmation sur un
 *     formulaire vierge n'est que de la friction) ;
 *  2. quelque chose de saisi → la feuille de confirmation, « Reprendre » par
 *     défaut ;
 *  3. on sort → le brouillon est EFFACÉ. L'arbitrage du 17/10 est « toujours
 *     repartir de zéro » : conserver une saisie obligerait à rouvrir, au
 *     retour, tout ce qui a pu changer entre-temps (trajet parti, annulé ou
 *     masqué, kilos restants, prix du Voyageur, paramètres de plateforme D62).
 *     La reprise de brouillon est parquée au backlog, pas abandonnée ;
 *  4. et on propose le FAVORI (D46) — côté serveur, lié au compte, il suit
 *     l'utilisateur sur tous ses appareils. C'est la seule chose qui ait
 *     besoin de survivre à la sortie : retrouver le trajet.
 */
"use client";

import { useCallback, useState } from "react";
import { useToggleFavorite } from "@/hooks/useFavoriteMutations";
import { usePublicTrip } from "@/hooks/usePublicTrip";
import { hasUserInput } from "./booking.config";
import type { Draft, TripContext } from "./booking.types";

type Args = {
  trip: TripContext;
  draft: Draft;
  /** Le brouillon de départ pour CE trajet (`buildInitialDraft`). */
  initialDraft: Draft;
  /** Efface le brouillon persisté (sessionStorage) et l'étape courante. */
  clearAction: () => void;
  /** Ce que « quitter » veut dire pour l'écran appelant (retour à la fiche). */
  onCloseAction: () => void;
};

export function useBookingExit({ trip, draft, initialDraft, clearAction, onCloseAction }: Args) {
  const [confirming, setConfirming] = useState(false);
  const toggleFavorite = useToggleFavorite();
  const { data: publicTrip } = usePublicTrip(trip.tripId);
  const alreadyFavorite = publicTrip?.isFavorite === true;

  const leave = useCallback(
    (keepFavorite: boolean) => {
      // Le cœur est optimiste (D46) : on peut naviguer sans attendre l'API.
      if (keepFavorite && !alreadyFavorite) {
        toggleFavorite.mutate({ tripId: trip.tripId, next: true });
      }
      clearAction();
      setConfirming(false);
      onCloseAction();
    },
    [alreadyFavorite, clearAction, onCloseAction, toggleFavorite, trip.tripId]
  );

  const requestExit = useCallback(() => {
    if (!hasUserInput(draft, initialDraft)) {
      clearAction();
      onCloseAction();
      return;
    }
    setConfirming(true);
  }, [clearAction, draft, initialDraft, onCloseAction]);

  return {
    /** À brancher sur la croix / la flèche de retour. */
    requestExit,
    /** Props de `BookingExitDialog`. */
    dialog: {
      open: confirming,
      alreadyFavorite,
      onResumeAction: () => setConfirming(false),
      onLeaveAction: leave,
    },
  };
}
