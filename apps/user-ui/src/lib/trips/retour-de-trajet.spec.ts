/**
 * retour-de-trajet.spec.ts — le retour est un VRAI second trajet (D111).
 * ========================================================================
 * Le formulaire a longtemps proposé « Aller-retour » sans jamais créer de
 * second trajet : le Voyageur croyait avoir annoncé son retour, aucun
 * Expéditeur ne pouvait le trouver. Ces fiches gardent le remplacement —
 * et surtout l'inversion la plus facile à rater : les LIEUX.
 */
import { initialDraft } from "@/components/trips/create/create-trip.state";
import { getDefaultLocationsForMode } from "@/components/trips/create/create-trip.config";
import type { Draft } from "@/components/trips/create/create-trip.types";

import { preparerLeRetour, retourPossible } from "@/lib/trips/retour-de-trajet";

function aller(): Draft {
  const lieux = getDefaultLocationsForMode("plane");
  return {
    ...initialDraft,
    transportMode: "plane",
    flightType: "direct",
    from: "Paris, France",
    to: "Berlin, Allemagne",
    fromPlace: { ...vide(), city: "Paris", countryCode: "FR" },
    toPlace: { ...vide(), city: "Berlin", countryCode: "DE" },
    departureDate: new Date(2026, 10, 28),
    arrivalDate: new Date(2026, 10, 28),
    departureTime: "10:00",
    arrivalTime: "13:12",
    travelReference: "AF1234",
    pricePerKg: 10,
    capacityKg: 12,
    pickupLocations: lieux.pickupLocations.map((l) => ({ ...l, details: "T2E" })),
    deliveryLocations: lieux.deliveryLocations.map((l) => ({ ...l, details: "BER T1" })),
    notes: "Je réponds vite.",
  };
}

function vide() {
  return {
    formattedAddress: "",
    placeId: "",
    lat: null,
    lng: null,
    streetLine1: null,
    city: null,
    region: null,
    country: null,
    cityCode: null,
    regionCode: null,
    countryCode: null,
    postalCode: null,
  };
}

describe("le retour inverse ce qui doit l'être", () => {
  it("les deux villes changent de place, libellé ET lieu Google", () => {
    const retour = preparerLeRetour(aller());
    expect(retour.from).toBe("Berlin, Allemagne");
    expect(retour.to).toBe("Paris, France");
    expect(retour.fromPlace?.city).toBe("Berlin");
    expect(retour.toPlace?.city).toBe("Paris");
  });

  it("les LIEUX suivent les villes — et leur `context` avec eux", () => {
    // L'inversion la plus facile à oublier : sans elle, l'aéroport de départ
    // est proposé comme point de récupération à l'arrivée. Et un point qui
    // garderait `context: "PICKUP"` dans la liste des livraisons serait une
    // incohérence que le serveur ne rattraperait pas (il ne lit que la liste).
    const retour = preparerLeRetour(aller());
    expect(retour.pickupLocations[0].details).toBe("BER T1");
    expect(retour.deliveryLocations[0].details).toBe("T2E");
    expect(retour.pickupLocations.every((l) => l.context === "PICKUP")).toBe(true);
    expect(retour.deliveryLocations.every((l) => l.context === "DELIVERY")).toBe(true);
  });

  it("l'offre est GARDÉE — c'est tout l'intérêt du geste", () => {
    const retour = preparerLeRetour(aller());
    expect(retour.pricePerKg).toBe(10);
    expect(retour.capacityKg).toBe(12);
    expect(retour.transportMode).toBe("plane");
    expect(retour.flightType).toBe("direct");
    expect(retour.notes).toBe("Je réponds vite.");
  });

  it("les dates, la référence et les justificatifs sont EFFACÉS", () => {
    const retour = preparerLeRetour(aller());
    expect(retour.departureDate).toBeUndefined();
    expect(retour.arrivalDate).toBeUndefined();
    expect(retour.departureTime).toBe("");
    expect(retour.arrivalTime).toBe("");
    expect(retour.travelReference).toBe("");
    expect(retour.tripDocuments).toEqual([]);
    // Un justificatif validé pour l'ALLER ne vaut pas pour le retour.
    expect(retour.ticketVerificationStatus).toBe("not_submitted");
  });

  it("l'aller n'est pas MODIFIÉ au passage", () => {
    // La transformation rend un nouvel objet : le trajet publié ne doit pas
    // changer sous les pieds de l'écran qui l'affiche encore.
    const depart = aller();
    preparerLeRetour(depart);
    expect(depart.from).toBe("Paris, France");
    expect(depart.pickupLocations[0].details).toBe("T2E");
  });

  it("sans villes, il n'y a pas de retour à proposer", () => {
    expect(retourPossible(initialDraft)).toBe(false);
    expect(retourPossible(aller())).toBe(true);
    expect(retourPossible({ ...aller(), to: "   " })).toBe(false);
  });
});
