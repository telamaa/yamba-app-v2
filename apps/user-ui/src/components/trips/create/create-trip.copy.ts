import type { CategoryOption, CreateTripCopy } from "./create-trip.types";

export function getCreateTripCopy(isFr: boolean): CreateTripCopy {
  return {
    title: isFr ? "Créer un trajet" : "Create a trip",
    subtitle: isFr
      ? "Publiez votre trajet en quelques instants."
      : "Publish your trip in moments.",
    firstTripTitle: isFr ? "Publiez votre premier trajet" : "Publish your first trip",
    firstTripSub: isFr
      ? "Ça prend 2 minutes, c'est gratuit."
      : "It takes 2 minutes, it's free.",
    steps: [
      isFr ? "Trajet" : "Trip",
      isFr ? "Conditions" : "Conditions",
      isFr ? "Publication" : "Publish",
    ],
    back: isFr ? "Retour" : "Back",
    continue: isFr ? "Continuer" : "Continue",
    saveDraft: isFr ? "Brouillon" : "Draft",
    publish: isFr ? "Publier le trajet" : "Publish trip",
    summary: isFr ? "Résumé" : "Summary",
    close: isFr ? "Fermer" : "Close",
    emptyValue: isFr ? "À compléter" : "To complete",

    step1Title: isFr ? "Votre trajet" : "Your trip",
    step1Sub: isFr
      ? "Mode de transport, itinéraire et dates."
      : "Transport mode, route and dates.",
    step2Title: isFr ? "Vos conditions" : "Your conditions",
    step2Sub: isFr
      ? "Catégories acceptées, prix et modalités."
      : "Accepted categories, pricing and terms.",
    step3Title: isFr ? "Vérification" : "Review",
    step3Sub: isFr
      ? "Vérifiez et publiez votre trajet."
      : "Review and publish your trip.",

    plane: isFr ? "Avion" : "Plane",
    train: isFr ? "Train" : "Train",
    car: isFr ? "Voiture" : "Car",
    oneWay: isFr ? "Aller simple" : "One way",
    roundTrip: isFr ? "Aller-retour" : "Round trip",

    from: isFr ? "Départ" : "From",
    to: isFr ? "Destination" : "To",
    date: isFr ? "Date de départ" : "Departure date",
    arrivalDate: isFr ? "Date d'arrivée" : "Arrival date",
    departureTime: isFr ? "Heure de départ" : "Departure time",
    arrivalTime: isFr ? "Heure d'arrivée" : "Arrival time",
    swap: isFr ? "Inverser" : "Swap",

    tripPathType: isFr ? "Type de parcours" : "Trip type",
    directFlight: isFr ? "Vol direct" : "Direct flight",
    withLayover: isFr ? "Avec escale" : "With layover",
    directTrain: isFr ? "Direct" : "Direct",
    withConnection: isFr ? "Correspondance" : "Connection",
    withIntermediateStops: isFr ? "Arrêts" : "Stops",
    directTrip: isFr ? "Direct" : "Direct",
    detourByAgreement: isFr ? "Détour possible" : "Detour possible",

    flightLayoverCities: isFr ? "Ville(s) d'escale" : "Layover city/cities",
    trainStopCities: isFr ? "Ville(s) de correspondance" : "Connection city/cities",
    travelReference: isFr ? "Réf. voyage" : "Travel ref.",

    docUpload: isFr ? "Justificatif" : "Proof",
    docUploadSub: isFr ? "Billet, itinéraire..." : "Ticket, itinerary...",
    docUploadHint: isFr
      ? "Badge « Voyage vérifié » après validation"
      : "'Verified trip' badge after review",
    docPending: isFr ? "En attente de vérification" : "Pending verification",
    docVerified: isFr ? "Vérifié" : "Verified",
    docCount: isFr ? "fichier(s)" : "file(s)",

    categories: isFr ? "Catégories acceptées" : "Accepted categories",
    globalPrice: isFr ? "Prix par défaut" : "Default price",
    globalPriceSub: isFr
      ? "Appliqué à toutes les catégories"
      : "Applied to all categories",
    adjustPrices: isFr ? "Ajuster par catégorie" : "Adjust per category",
    pricePerCategory: isFr ? "Prix par catégorie" : "Price per category",

    price: isFr ? "Prix" : "Price",
    handoffMoments: isFr ? "Remise" : "Handoff",
    pickupMoments: isFr ? "Retrait" : "Pickup",
    beforeDeparture: isFr ? "Avant départ" : "Before departure",
    atDeparture: isFr ? "Au départ" : "At departure",
    onArrival: isFr ? "À l'arrivée" : "At arrival",
    laterAtAddress: isFr ? "Adresse convenue" : "Agreed address",
    pickupInfo: isFr
      ? "Quand le destinataire peut récupérer le colis."
      : "When the recipient can collect the parcel.",

    options: isFr ? "Options" : "Options",
    handOnly: isFr ? "Main propre uniquement" : "Hand delivery only",
    instantBooking: isFr ? "Réservation instantanée" : "Instant booking",

    notes: isFr ? "Message (optionnel)" : "Note (optional)",
    notesPlaceholder: isFr
      ? "Détails supplémentaires pour les expéditeurs..."
      : "Additional details for senders...",

    reviewMode: isFr ? "Transport" : "Transport",
    reviewRoute: isFr ? "Itinéraire" : "Route",
    reviewSchedule: isFr ? "Dates" : "Dates",
    reviewCategoryConditions: isFr ? "Catégories & prix" : "Categories & pricing",
    reviewDocuments: isFr ? "Justificatifs" : "Documents",
    edit: isFr ? "Modifier" : "Edit",

    revenueEstimate: isFr ? "Revenu estimé" : "Estimated revenue",
    resumeDraft: isFr ? "Reprendre votre brouillon ?" : "Resume your draft?",
    resumeDraftSub: isFr
      ? "Vous aviez commencé un trajet."
      : "You had started a trip.",
    startFresh: isFr ? "Recommencer" : "Start fresh",
    popularRoute: isFr ? "Route populaire" : "Popular route",
    almostDone: isFr ? "Vous êtes presque au bout !" : "You're almost done!",
    almostDoneSub: isFr
      ? "Votre trajet est presque prêt à être publié."
      : "Your trip is almost ready to publish.",
    stayAndFinish: isFr ? "Terminer" : "Finish",
    leave: isFr ? "Quitter" : "Leave",
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
