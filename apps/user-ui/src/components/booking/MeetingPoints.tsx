/**
 * MeetingPoints.tsx
 * =================
 * Les deux lieux de rendez-vous — remise au Voyageur, retrait par le
 * destinataire.
 *
 * Pourquoi ce fichier existe : le bloc vivait dans l'étape 1, en tête d'une
 * page intitulée « Décris ton colis ». Un lieu n'est pas une propriété du
 * colis, c'est un rendez-vous avec quelqu'un — il appartient à l'étape qui
 * parle du destinataire (revue UX du 17/10). Sorti ici, il ne dépend plus
 * d'une étape : si la découpe bouge encore, il suit.
 *
 * L'affichage est une LISTE À PLAT (pas des cartes encadrées) : une ligne par
 * lieu, un filet entre elles, la sélection portée par la pastille mangue.
 */
"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import {
  LocationDisplay,
  LocationList,
  LocationMissing,
  LocationOption,
  SectionTitle,
} from "./BookingFormUi";
import type { Draft, TripContext, ValidationErrors } from "./booking.types";

type Props = {
  trip: TripContext;
  draft: Draft;
  setDraftAction: (updater: (prev: Draft) => Draft) => void;
  errors: ValidationErrors;
};

export default function MeetingPoints({ trip, draft, setDraftAction, errors }: Props) {
  const t = useTranslations("booking.locations");

  const onSelectPickup = useCallback(
    (id: string) => setDraftAction((prev) => ({ ...prev, pickupLocationId: id })),
    [setDraftAction]
  );
  const onSelectDelivery = useCallback(
    (id: string) => setDraftAction((prev) => ({ ...prev, deliveryLocationId: id })),
    [setDraftAction]
  );

  const hasMultiplePickup = trip.pickupOptions.length > 1;
  const hasMultipleDelivery = trip.deliveryOptions.length > 1;

  return (
    <>
      <SectionTitle>{t("title")}</SectionTitle>
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-4 md:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-1 text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
            {t("pickupBlockTitle", { carrierFirstName: trip.carrier.firstName })}
          </div>
          {hasMultiplePickup ? (
            <>
              <LocationList>
                {trip.pickupOptions.map((loc) => (
                  <LocationOption
                    key={loc.id}
                    location={loc}
                    selected={draft.pickupLocationId === loc.id}
                    onSelectAction={() => onSelectPickup(loc.id)}
                    hasError={Boolean(errors.pickupLocationId)}
                  />
                ))}
              </LocationList>
              {errors.pickupLocationId && (
                <div className="mt-1 text-[12px] font-medium" style={{ color: "#FF9900" }}>
                  {errors.pickupLocationId}
                </div>
              )}
            </>
          ) : trip.pickupOptions.length > 0 ? (
            <LocationDisplay location={trip.pickupOptions[0]} hint={t("singleHint")} />
          ) : (
            // Un trajet publié sans lieu de remise faisait planter l'écran (lecture de
            // `pickupOptions[0].kind`). Le lieu n'est pas exigé par la réservation : on le dit.
            <LocationMissing text={t("missing")} />
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-1 text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
            {t("deliveryBlockTitle")}
          </div>
          {hasMultipleDelivery ? (
            <>
              <LocationList>
                {trip.deliveryOptions.map((loc) => (
                  <LocationOption
                    key={loc.id}
                    location={loc}
                    selected={draft.deliveryLocationId === loc.id}
                    onSelectAction={() => onSelectDelivery(loc.id)}
                    hasError={Boolean(errors.deliveryLocationId)}
                  />
                ))}
              </LocationList>
              {errors.deliveryLocationId && (
                <div className="mt-1 text-[12px] font-medium" style={{ color: "#FF9900" }}>
                  {errors.deliveryLocationId}
                </div>
              )}
            </>
          ) : trip.deliveryOptions.length > 0 ? (
            <LocationDisplay location={trip.deliveryOptions[0]} hint={t("singleHint")} />
          ) : (
            <LocationMissing text={t("missing")} />
          )}
        </div>
      </div>
    </>
  );
}
