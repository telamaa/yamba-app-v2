/**
 * BookingClient.tsx
 * =================
 * Routeur desktop/mobile du wizard de réservation — sur le VRAI trajet
 * (GET /trips/:id/public), plus de mock. Le poids saisi en recherche
 * (localStorage) pré-remplit le colis.
 */

"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import BookingMobile from "@/components/booking/BookingMobile";
import BookingWizard from "@/components/booking/BookingWizard";
import { mapPublicTripToContext } from "@/components/booking/trip-context.mapper";
import { useIsMobile } from "@/hooks/useIsMobile";
import { usePublicTrip } from "@/hooks/usePublicTrip";
import { useRouter } from "@/i18n/navigation";
import useUser from "@/hooks/useUser";

type Props = {
  tripId: string;
};

export default function BookingClient({ tripId }: Props) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const t = useTranslations("tripDetail");
  const tLoc = useTranslations("booking.locationKinds");
  const { data: publicTrip, isLoading, isError } = usePublicTrip(tripId);
  const { user, isLoading: userLoading } = useUser();
  const tErrors = useTranslations("booking.step4.errors");

  const trip = useMemo(
    () => (publicTrip ? mapPublicTripToContext(publicTrip, (k, v) => tLoc(k, v)) : null),
    [publicTrip, tLoc]
  );

  const handleClose = useCallback(() => {
    router.push(`/trips/${tripId}`);
  }, [router, tripId]);

  if (isMobile === null || isLoading || userLoading) {
    return <BookingFallback />;
  }

  // CNF-05 — identité requise dès la 1re réservation : pas de wizard sans compte.
  // A58/A63 — mais la porte s'ouvre AU-DESSUS DU TRAJET, jamais sur une page vide.
  // Cette route n'est atteinte sans session que par un chemin détourné (lien
  // partagé, retour arrière après déconnexion, session expirée dans le tunnel) :
  // il n'y a alors rien derrière quoi poser une modale. On renvoie donc à la
  // fiche trajet avec `?auth=book`, qui ouvre LA MÊME modale que le bouton
  // « Réserver » — un seul composant, un seul texte, une seule règle de retour
  // (`bookingRedirectFor`). `replace` et non `push` : cette étape ne doit pas
  // s'inscrire dans l'historique du navigateur.
  if (!user) {
    router.replace(`/trips/${tripId}?auth=book`);
    return <BookingFallback />;
  }

  // ANO-WEB-35 (recette 5.12) — l'auteur du trajet ne peut pas le réserver : on le dit à l'OUVERTURE
  // (le serveur le refuse de toute façon à l'intention de paiement, code OWN_TRIP).
  // ANO-WEB-38 (recette 5.12) — un trajet déjà parti n'accepte plus de demandes : on le dit à l'OUVERTURE
  // (le serveur le refuse à l'intention de paiement, code TRIP_NOT_BOOKABLE « already departed »).
  const parti = !!publicTrip?.dates.departureAt && new Date(publicTrip.dates.departureAt).getTime() <= Date.now();
  if (trip && parti) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center dark:bg-slate-950">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{tErrors("TRIP_NOT_BOOKABLE")}</p>
        {/* Recette 01-WEB chapitre 7 (regard d'expert, WEB-NRG-4) : le refus ne proposait aucune suite. La recherche
            reprend les critères que la barre garde en session. */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/search")}
            className="rounded-full bg-[#FF9900] px-4 py-2 text-sm font-bold text-slate-950"
          >
            {t("findAnother")}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            {t("back")}
          </button>
        </div>
      </div>
    );
  }
  if (trip && user.id === trip.carrier.id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center dark:bg-slate-950">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{tErrors("OWN_TRIP")}</p>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-full bg-[#FF9900] px-4 py-2 text-sm font-bold text-slate-950"
        >
          {t("back")}
        </button>
      </div>
    );
  }
  if (isError || !trip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center dark:bg-slate-950">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{t("notFound.title")}</p>
        <button
          type="button"
          onClick={() => router.push("/search")}
          className="rounded-full bg-[#FF9900] px-4 py-2 text-sm font-bold text-slate-950"
        >
          {t("back")}
        </button>
      </div>
    );
  }

  if (isMobile) {
    return <BookingMobile trip={trip} onCloseAction={handleClose} />;
  }

  return <BookingWizard trip={trip} onCloseAction={handleClose} />;
}

function BookingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#FF9900]" />
    </div>
  );
}
