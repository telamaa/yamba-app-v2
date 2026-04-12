import { CategoryOption, CreateTripCopy } from "./create-trip.types";

export function getCreateTripCopy(isFr: boolean): CreateTripCopy {
  return {
    title: isFr ? "Créer un trajet" : "Create a trip",
    subtitle: isFr
      ? "Un parcours simple, clair et rapide pour publier votre trajet."
      : "A simple, clear and fast flow to publish your trip.",
    steps: [
      isFr ? "Trajet" : "Trip",
      isFr ? "Conditions" : "Conditions",
      isFr ? "Publication" : "Publish",
    ],
    back: isFr ? "Retour" : "Back",
    continue: isFr ? "Continuer" : "Continue",
    saveDraft: isFr ? "Enregistrer le brouillon" : "Save draft",
    publish: isFr ? "Publier le trajet" : "Publish trip",
    summary: isFr ? "Résumé du trajet" : "Trip summary",
    close: isFr ? "Fermer" : "Close",
    emptyValue: isFr ? "À compléter" : "To complete",

    step1Title: isFr ? "Trajet" : "Trip",
    step1Sub: isFr
      ? "Choisissez le mode de transport et renseignez l’itinéraire."
      : "Choose the transport mode and fill in the route.",
    step2Title: isFr ? "Conditions" : "Conditions",
    step2Sub: isFr
      ? "Définissez un prix, la remise et le retrait pour chaque catégorie sélectionnée."
      : "Set pricing, handoff and pickup for each selected category.",
    step3Title: isFr ? "Publication" : "Publish",
    step3Sub: isFr
      ? "Vérifiez les informations avant publication."
      : "Review the details before publishing.",

    plane: isFr ? "Avion" : "Plane",
    train: isFr ? "Train" : "Train",
    car: isFr ? "Voiture" : "Car",
    oneWay: isFr ? "Aller simple" : "One way",
    roundTrip: isFr ? "Aller-retour" : "Round trip",

    from: isFr ? "Départ" : "From",
    to: isFr ? "Destination" : "To",
    date: isFr ? "Date de départ" : "Departure date",
    arrivalDate: isFr ? "Date d’arrivée" : "Arrival date",
    departureTime: isFr ? "Heure de départ" : "Departure time",
    arrivalTime: isFr ? "Heure d'arrivée" : "Arrival time",

    tripPathType: isFr ? "Type de parcours" : "Trip type",
    directFlight: isFr ? "Vol direct" : "Direct flight",
    withLayover: isFr ? "Vol avec escale" : "Flight with layover",
    directTrain: isFr ? "Train direct" : "Direct train",
    withConnection: isFr ? "Train avec correspondance" : "Train with connection",
    withIntermediateStops: isFr ? "Avec arrêts intermédiaires" : "With intermediate stops",
    directTrip: isFr ? "Trajet direct" : "Direct trip",
    detourByAgreement: isFr ? "Détour possible selon accord" : "Detour possible by agreement",

    flightLayoverCities: isFr ? "Ville(s) d’escale" : "Layover city/cities",
    trainStopCities: isFr
      ? "Ville(s) de correspondance / arrêt(s)"
      : "Connection / stop city/cities",
    travelReference: isFr ? "Référence voyage" : "Travel reference",

    categories: isFr ? "Catégories acceptées" : "Accepted categories",
    openCategories: isFr ? "Choisir les catégories" : "Choose categories",

    price: isFr ? "Prix" : "Price",
    handoffMoments: isFr
      ? "Remise du colis au voyageur"
      : "Parcel handoff to the traveler",
    pickupMoments: isFr
      ? "Retrait du colis par le destinataire"
      : "Parcel pickup by the recipient",
    beforeDeparture: isFr ? "Avant le départ" : "Before departure",
    atDeparture: isFr ? "Au départ" : "At departure",
    onArrival: isFr ? "À l'arrivée du voyageur" : "At traveler arrival",
    laterAtAddress: isFr
      ? "Après l'arrivée, à une adresse convenue"
      : "Later after arrival, at an agreed address",
    pickupInfo: isFr
      ? "Indique quand le destinataire peut récupérer le colis : soit dès l’arrivée du voyageur au point d’arrivée, soit plus tard à une adresse précisée par le voyageur."
      : "Specify when the recipient can collect the parcel: either upon the traveler’s arrival at the arrival point, or later at an address provided by the traveler.",

    options: isFr ? "Options complémentaires" : "Additional options",
    handOnly: isFr ? "Remise en main propre uniquement" : "Hand delivery only",
    instantBooking: isFr ? "Réservation instantanée" : "Instant booking",

    notes: isFr ? "Message complémentaire" : "Additional notes",
    notesPlaceholder: isFr
      ? "Ex. remise possible à l’arrivée ou plus tard à une adresse convenue."
      : "E.g. pickup possible upon arrival or later at an agreed address.",
    uploadTitle: isFr ? "Justificatif" : "Proof document",
    uploadSub: isFr
      ? "Zone prête pour brancher l'upload billet / itinéraire."
      : "Area ready to plug ticket / itinerary upload.",

    reviewMode: isFr ? "Mode de transport" : "Transport mode",
    reviewRoute: isFr ? "Itinéraire" : "Route",
    reviewSchedule: isFr ? "Calendrier" : "Schedule",
    reviewCategoryConditions: isFr ? "Catégories et conditions" : "Categories and conditions",

    /**
     * Legacy
     */
    smallDetourPossible: isFr ? "Petit détour possible" : "Small detour possible",
    stopoverCount: isFr ? "Nombre d'escales" : "Number of layovers",
    detourRadius: isFr ? "Rayon de détour accepté" : "Accepted detour radius",
    transportReference: isFr ? "Référence transport" : "Transport reference",
    maxParcelCount: isFr ? "Nombre maximum de colis" : "Maximum parcel count",
    maxWeight: isFr ? "Poids maximum" : "Maximum weight",
    volume: isFr ? "Volume disponible" : "Available volume",
    small: isFr ? "Petit" : "Small",
    medium: isFr ? "Moyen" : "Medium",
    large: isFr ? "Grand" : "Large",
    constraints: isFr ? "Contraintes" : "Constraints",
    fragile: isFr ? "Objets fragiles acceptés" : "Fragile items allowed",
    urgentDocs: isFr ? "Documents urgents acceptés" : "Urgent documents allowed",
    handoffFlexibility: isFr ? "Souplesse de remise" : "Handoff flexibility",
    duringTrip: isFr ? "Pendant trajet" : "During trip",
    reviewCapacity: isFr ? "Capacité" : "Capacity",
    reviewConditions: isFr ? "Conditions & prix" : "Conditions & pricing",
    flexible: isFr ? "Flexible" : "Flexible",
    fixedTime: isFr ? "Horaire précis" : "Fixed time",
    byAppointment: isFr ? "Sur rendez-vous" : "By appointment",
    ticketVerified: isFr ? "Billet vérifié" : "Verified ticket",
  };
}

export function getCategoryOptions(isFr: boolean): CategoryOption[] {
  return [
    { key: "clothes", label: isFr ? "Vêtements" : "Clothes" },
    { key: "shoes", label: isFr ? "Chaussures" : "Shoes" },
    { key: "fashionAccessories", label: isFr ? "Accessoires de mode" : "Fashion accessories" },
    { key: "otherAccessories", label: isFr ? "Autres accessoires" : "Other accessories" },
    { key: "books", label: isFr ? "Livres" : "Books" },
    { key: "documents", label: isFr ? "Documents" : "Documents" },
    { key: "smallToys", label: isFr ? "Petits jouets" : "Small toys" },
    { key: "phone", label: isFr ? "Téléphone" : "Phone" },
    { key: "computer", label: isFr ? "Ordinateur" : "Computer" },
    { key: "otherElectronics", label: isFr ? "Électronique" : "Electronics" },
    { key: "checkedBag23kg", label: isFr ? "Valise soute 23 kg" : "Checked bag 23 kg" },
    { key: "cabinBag12kg", label: isFr ? "Valise cabine 12 kg" : "Cabin bag 12 kg" },
  ];
}
