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
      isFr ? "Vérification" : "Review",
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
      ? "Catégories, prix et lieux de rendez-vous."
      : "Categories, pricing and meeting points.",
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
    withConnection: isFr ? "Avec correspondance" : "With connection",
    directTrip: isFr ? "Direct" : "Direct",
    detourByAgreement: isFr ? "Détour possible" : "Detour possible",

    flightLayoverCities: isFr ? "Ville d'escale" : "Layover city",
    trainStopCities: isFr ? "Ville de correspondance" : "Connection city",
    travelReference: isFr ? "Réf. voyage" : "Travel ref.",

    docUpload: isFr ? "Justificatif" : "Proof",
    docUploadSub: isFr ? "Billet, itinéraire..." : "Ticket, itinerary...",
    docUploadHint: isFr
      ? "Badge « Voyage vérifié » après validation"
      : "'Verified trip' badge after review",
    docPending: isFr ? "En attente de vérification" : "Pending verification",
    docVerified: isFr ? "Vérifié" : "Verified",
    docCount: isFr ? "fichier(s)" : "file(s)",

    // ── Pricing PER_KG (D13/D14/D15/D19) ──
    pricePerKg: isFr ? "Ton prix au kilo" : "Your price per kg",
    pricePerKgSub: isFr
      ? "Un seul nombre à fixer — la famille du colis ne change pas le prix"
      : "One number to set — the parcel family never changes the price",
    capacity: isFr ? "Ta capacité" : "Your capacity",
    capacitySub: isFr
      ? "Kilos que tu peux transporter — réservés dès qu'une demande arrive"
      : "Kilos you can carry — reserved as soon as a request comes in",
    capacityTolerance: isFr
      ? "Au pickup, un écart de poids ≤ 10 % est toléré. Au-delà : renégociation ou refus sans pénalité."
      : "At pickup, a weight gap ≤ 10% is tolerated. Beyond: renegotiation or refusal without penalty.",
    fairPriceOk: isFr ? "✓ Prix juste" : "✓ Fair price",
    fairPriceLow: isFr ? "↓ Sous le marché — tu laisses de l'argent" : "↓ Below market — you're leaving money",
    fairPriceHigh: isFr ? "↑ Au-dessus — moins de demandes probables" : "↑ Above — fewer requests likely",
    priceAnchor: (median: string, low: string, high: string) =>
      isFr
        ? `Les trajets similaires partent à ${median} €/kg en médiane (fourchette ${low}–${high}).`
        : `Similar trips go for ${median} €/kg on median (range ${low}–${high}).`,
    gaugeLow: isFr ? "basse" : "low",
    gaugeMedian: isFr ? "médiane" : "median",
    gaugeHigh: isFr ? "haute" : "high",
    families: isFr ? "Familles de colis" : "Parcel families",
    familiesSub: isFr
      ? "Accepter, surcharger (risque) ou refuser — jamais un prix par famille"
      : "Accept, surcharge (risk) or refuse — never a price per family",
    familyAccept: "OK",
    familySurcharge: "+%",
    familyRefuse: isFr ? "Non" : "No",
    bags: isFr ? "Bagages entiers — forfait" : "Whole bags — flat rate",
    bagsSub: isFr
      ? "Optionnel : tu loues ta franchise complète, hors logique €/kg"
      : "Optional: rent your full allowance, outside the €/kg logic",
    checkedBag23: isFr ? "Bagage soute 23 kg" : "Checked bag 23 kg",
    cabinBag12: isFr ? "Bagage cabine 12 kg" : "Cabin bag 12 kg",
    bagConsumes: (kg: number) =>
      isFr ? `consomme ${kg} kg de ta capacité` : `uses ${kg} kg of your capacity`,
    netGain: isFr ? "Tu gagnes" : "You earn",
    netGainIfFull: (kg: number) =>
      isFr ? `Si tes ${kg} kg sont réservés` : `If your ${kg} kg get booked`,
    netGainSub: isFr
      ? "Versé à J+4 après livraison confirmée · la commission est côté Expéditeur, ton prix = ton net"
      : "Paid at D+4 after confirmed delivery · commission is on the sender's side, your price = your net",
    reviewPricing: isFr ? "Prix & capacité" : "Price & capacity",
    perKgUnit: "€/kg",
    kgUnit: "kg",
    availableKg: (kg: number) => (isFr ? `${kg} kg dispo` : `${kg} kg available`),
    refusedFamilies: isFr ? "Refusé" : "Refused",

    categories: isFr ? "Catégories acceptées" : "Accepted categories",
    globalPrice: isFr ? "Prix par défaut" : "Default price",
    globalPriceSub: isFr
      ? "Appliqué à toutes les catégories"
      : "Applied to all categories",
    adjustPrices: isFr ? "Ajuster par catégorie" : "Adjust per category",
    pricePerCategory: isFr ? "Prix par catégorie" : "Price per category",
    price: isFr ? "Prix" : "Price",

    // ── Locations ─────────────────────────
    pickupLocations: isFr ? "Lieux de remise" : "Pickup locations",
    pickupLocationsSub: isFr
      ? "Où l'expéditeur dépose le colis"
      : "Where the sender drops off the parcel",
    deliveryLocations: isFr ? "Lieux de livraison" : "Delivery locations",
    deliveryLocationsSub: isFr
      ? "Où l'expéditeur récupère le colis"
      : "Where the sender collects the parcel",
    atAirport: isFr ? "À l'aéroport" : "At the airport",
    atTrainStation: isFr ? "À la gare" : "At the train station",
    inTheCity: isFr ? "Dans la ville" : "In the city",
    locationDetailsPlaceholder: isFr
      ? "Précisions (ex. T2E hall départ, café de la gare…)"
      : "Details (e.g. T2E departures hall, café at the station…)",
    flexibility: isFr ? "Flexibilité" : "Flexibility",
    flexExact: isFr ? "Exact" : "Exact",
    flexRadius5: isFr ? "Rayon 5 km" : "5 km radius",
    flexRadius10: isFr ? "Rayon 10 km" : "10 km radius",
    flexRadius15: isFr ? "Rayon 15 km" : "15 km radius",
    flexRadius20: isFr ? "Rayon 20 km" : "20 km radius",
    flexCityWide: isFr ? "Ville entière" : "Whole city",
    locationsCount: (n: number) =>
      isFr ? `${n} lieu${n > 1 ? "x" : ""}` : `${n} location${n > 1 ? "s" : ""}`,

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
    reviewLocations: isFr ? "Lieux de remise & livraison" : "Pickup & delivery",
    reviewDocuments: isFr ? "Justificatifs" : "Documents",
    edit: isFr ? "Modifier" : "Edit",

    publicPreview: isFr ? "Aperçu public" : "Public preview",
    asSeenByShippers: isFr
      ? "Tel que vu par les expéditeurs"
      : "As seen by senders",

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
