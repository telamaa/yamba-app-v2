/**
 * retour-de-trajet.ts — préparer le RETOUR à partir de l'aller (D111).
 * =====================================================================
 * Le formulaire proposait « Aller simple / Aller-retour ». Le choix partait
 * bien au serveur (`tripType: "ROUND_TRIP"`), mais le mapper envoie
 * `returnDepartureAt: null` DANS LES DEUX CAS et aucun second trajet n'est
 * créé : le Voyageur croyait avoir annoncé son retour, et aucun Expéditeur
 * ne pouvait le trouver — le mot n'apparaissait que sur sa propre fiche.
 *
 * C'est le défaut nommé par D100 : un contrôle qui AFFIRME ce que le produit
 * ne fait pas. Le choix disparaît donc, et le retour devient ce qu'il aurait
 * toujours dû être : **un second trajet, publié en un geste**, proposé
 * APRÈS la publication de l'aller.
 *
 * Module PUR (aucun React, aucun réseau) : c'est une transformation de
 * brouillon, et le harnais du site (A224) doit pouvoir la jouer.
 */
import type { Draft, TripLocationPoint } from "@/components/trips/create/create-trip.types";

/** Un lieu change de CÔTÉ : ce qui se remettait à Paris s'y récupère. */
function inverserLeContexte(point: TripLocationPoint): TripLocationPoint {
  return {
    ...point,
    context: point.context === "PICKUP" ? "DELIVERY" : "PICKUP",
  };
}

/**
 * Le brouillon du retour.
 *
 * **S'INVERSENT** : les deux villes (libellé ET lieu Google), et les deux
 * listes de points d'échange — avec le `context` de chaque point. Un lieu de
 * remise à Paris devient un lieu de livraison à Paris : même terminal, même
 * café, autre sens de l'échange. L'oublier ferait proposer l'aéroport de
 * départ comme point de récupération à l'arrivée.
 *
 * **SE GARDENT** : le mode, le type de trajet, les villes traversées, le
 * prix au kilo, la capacité, les forfaits, les familles, les options et les
 * notes. C'est tout l'intérêt du geste — il ne reste que les dates.
 *
 * **S'EFFACENT** : les dates, les heures, la référence du billet et les
 * justificatifs. Un retour est un autre billet.
 */
export function preparerLeRetour(aller: Draft): Draft {
  return {
    ...aller,
    from: aller.to,
    to: aller.from,
    fromPlace: aller.toPlace,
    toPlace: aller.fromPlace,

    pickupLocations: aller.deliveryLocations.map(inverserLeContexte),
    deliveryLocations: aller.pickupLocations.map(inverserLeContexte),

    departureDate: undefined,
    arrivalDate: undefined,
    departureTime: "",
    arrivalTime: "",

    travelReference: "",
    tripDocuments: [],
    ticketVerificationStatus: "not_submitted",
  };
}

/** Un retour n'a de sens que si l'aller portait ses deux villes. */
export function retourPossible(aller: Draft): boolean {
  return aller.from.trim().length > 0 && aller.to.trim().length > 0;
}
