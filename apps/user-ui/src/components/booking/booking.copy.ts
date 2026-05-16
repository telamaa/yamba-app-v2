import type { ParcelCategory } from "./booking.types";

export function getBookingCopy(isFr: boolean) {
  return {
    // ----- Navigation -----
    back: isFr ? "Retour" : "Back",
    backToTrip: isFr ? "Retour au trajet" : "Back to trip",
    continueLabel: isFr ? "Continuer" : "Continue",
    goToPayment: isFr ? "Passer au paiement" : "Continue to payment",
    pay: (amount: string) => (isFr ? `Payer ${amount}` : `Pay ${amount}`),
    cancel: isFr ? "Annuler" : "Cancel",

    // ----- Header -----
    bookingTitle: isFr ? "Réservation" : "Booking",

    // ----- Stepper -----
    stepParcel: isFr ? "Colis" : "Parcel",
    stepRecipient: isFr ? "Destinataire" : "Recipient",
    stepCharter: isFr ? "Engagement" : "Commitment",
    stepPayment: isFr ? "Paiement" : "Payment",
    stepIndicator: (current: number, total: number) =>
      isFr ? `étape ${current} sur ${total}` : `step ${current} of ${total}`,

    // ============================================================
    // STEP 1 — Parcel & locations
    // ============================================================
    step1Title: isFr ? "Décris ton colis" : "Describe your parcel",
    step1Subtitle: isFr
      ? "Précision et photos garantissent un envoi sans accroc"
      : "Accuracy and photos protect everyone",

    locationsTitle: isFr ? "Lieux de rendez-vous" : "Meeting locations",
    pickupBlockTitle: (carrierFirstName: string) =>
      isFr
        ? `Tu remets le colis à ${carrierFirstName}`
        : `You hand the parcel to ${carrierFirstName}`,
    deliveryBlockTitle: isFr
      ? "Le destinataire récupère le colis"
      : "The recipient picks up the parcel",
    locationSingleHint: isFr ? "Lieu convenu avec le voyageur" : "Set by the tripper",

    goldenRulesTitle: isFr
      ? "Les règles d'or pour un envoi qui se passe bien"
      : "Golden rules for a smooth shipment",
    goldenRules: isFr
      ? [
        "**Emballe soigneusement.** Sac ou boîte solide, papier bulle pour le fragile, scotche correctement.",
        "**Pèse précisément.** Le poids déclaré doit correspondre au poids réel à la remise.",
        "**Décris fidèlement.** Thomas vérifiera le contenu avant d'accepter ton colis.",
        "**Aucun produit interdit.**",
      ]
      : [
        "**Pack carefully.** Sturdy bag or box, bubble wrap if fragile, properly taped.",
        "**Weigh precisely.** Declared weight must match actual weight at handover.",
        "**Describe accurately.** Thomas will inspect the content before accepting.",
        "**No prohibited items.**",
      ],
    prohibitedItemsLink: isFr ? "Voir la liste complète" : "See the full list",

    categoryLabel: isFr ? "Catégorie" : "Category",
    categoryOptions: getCategoryLabels(isFr),
    weightLabel: isFr ? "Poids (kg)" : "Weight (kg)",
    valueLabel: isFr ? "Valeur déclarée (€)" : "Declared value (€)",
    declaredValueTooltip: isFr
      ? "La valeur déclarée détermine le plafond d'indemnisation en cas de litige. Indique le prix d'achat du contenu."
      : "The declared value sets the compensation ceiling in case of dispute. Enter the purchase price of the content.",
    descriptionLabel: isFr ? "Description courte" : "Short description",
    descriptionPlaceholder: isFr
      ? "Ex : 3 t-shirts, 1 pull, du chocolat"
      : "Ex: 3 t-shirts, 1 jumper, chocolate",

    photosLabel: isFr ? "Photos du colis" : "Parcel photos",
    photosRequiredBadge: isFr ? "Obligatoire avec l'assurance" : "Required with insurance",
    photosHint: isFr
      ? "Idéalement : une photo du contenu déballé + une du colis emballé. JPEG ou PNG, max 10 Mo par photo."
      : "Ideally: one photo of unpacked content + one of the packed parcel. JPEG or PNG, max 10 MB per photo.",
    photoAdd: isFr ? "Ajouter" : "Add",
    photoTagContent: isFr ? "Contenu" : "Content",
    photoTagPackaged: isFr ? "Emballé" : "Packed",
    photoRemove: isFr ? "Supprimer cette photo" : "Remove this photo",

    insuranceTitle: isFr ? "Assurance optionnelle" : "Optional insurance",
    insuranceBasicTitle: isFr ? "Protection de base" : "Basic protection",
    insuranceBasicPrice: isFr ? "Inclus" : "Included",
    insuranceBasicDesc: isFr
      ? "Tu es protégé contre la non-livraison. Le paiement est bloqué jusqu'à la remise au destinataire."
      : "You're covered against non-delivery. Payment is held until the parcel reaches the recipient.",
    insuranceExtendedTitle: isFr ? "Assurance jusqu'à 500 €" : "Insurance up to €500",
    insuranceExtendedPrice: "+ 6 €",
    insuranceExtendedDesc: isFr
      ? "Perte, vol, casse pendant le transport. Vol partiel du contenu couvert."
      : "Loss, theft, damage during transport. Partial theft of content covered.",
    insuranceIpidLink: isFr ? "Voir la fiche IPID" : "See the IPID sheet",

    // ============================================================
    // STEP 2 — Recipient
    // ============================================================
    step2Title: isFr ? "À qui livrer ?" : "Who is the recipient?",
    step2Subtitle: isFr
      ? "Pas besoin de compte Yamba pour le destinataire. Tu lui transmettras le code."
      : "The recipient doesn't need a Yamba account. You'll share the code with them.",

    deliveryFlowTitle: isFr
      ? "Comment se passera la livraison"
      : "How the delivery will work",
    deliveryFlowItems: isFr
      ? [
        "**Un code à 6 chiffres** te sera donné après le paiement.",
        "**Tu le transmets** au destinataire par SMS, WhatsApp ou oralement.",
        "**Il le donne au voyageur** à la livraison. Sans ce code, le colis ne peut pas être remis.",
      ]
      : [
        "**A 6-digit code** will be given to you after payment.",
        "**You share it** with the recipient by SMS, WhatsApp or in person.",
        "**They give it to the tripper** at delivery. Without this code, the parcel cannot be released.",
      ],

    recipientFirstName: isFr ? "Prénom" : "First name",
    recipientLastName: isFr ? "Nom" : "Last name",
    recipientPhone: isFr ? "Téléphone" : "Phone",
    recipientPhoneHint: isFr
      ? "Pour transmettre le code par SMS / WhatsApp"
      : "Used to send the code via SMS / WhatsApp",
    recipientEmail: isFr ? "Email" : "Email",
    recipientEmailOptional: isFr ? "(optionnel)" : "(optional)",
    recipientEmailHint: isFr
      ? "Pour notifier le destinataire de l'arrivée du colis"
      : "To notify the recipient when the parcel arrives",

    // ============================================================
    // STEP 3 — Charter
    // ============================================================
    step3Title: isFr ? "Ton engagement" : "Your commitment",
    step3Subtitle: isFr
      ? "Tu certifies sur l'honneur le contenu du colis"
      : "You certify on your honor the content of the parcel",

    handoverFlowTitle: isFr
      ? "À la remise du colis, voici ce qui se passera"
      : "What will happen when you hand over the parcel",
    handoverFlowItems: isFr
      ? [
        "**Vérification visuelle obligatoire.** Le voyageur examinera ton colis avant d'accepter — ne sois pas surpris.",
        "**Refus possible si non-conforme.** Si le contenu diffère de ta déclaration, le voyageur peut refuser. Tu seras remboursé mais le trajet sera perdu.",
        "**Photos croisées.** Le voyageur prendra ses propres photos qui feront foi en cas de litige.",
      ]
      : [
        "**Mandatory visual inspection.** The tripper will examine your parcel before accepting — don't be surprised.",
        "**Refusal possible if non-compliant.** If the content differs from your declaration, the tripper can refuse. You'll be refunded but the trip is lost.",
        "**Cross-referenced photos.** The tripper will take their own photos as evidence in case of dispute.",
      ],

    charterTitle: isFr ? "Charte Expéditeur" : "Shipper Charter",
    charterSubtitle: isFr
      ? "Engagement juridique — à lire attentivement"
      : "Legal commitment — read carefully",
    charterIntro: isFr
      ? "En validant ce deal, je déclare et garantis sur l'honneur que mon colis :"
      : "By confirming this deal, I declare and guarantee on my honor that my parcel:",
    charterItems: isFr
      ? [
        "ne contient **aucun produit illicite**, dangereux ou interdit",
        "correspond exactement à la **catégorie, au poids et au contenu déclarés**",
        "respecte les **obligations douanières** du pays de destination",
      ]
      : [
        "contains **no illicit**, dangerous or prohibited products",
        "matches exactly the **declared category, weight and content**",
        "complies with the **customs regulations** of the destination country",
      ],
    charterDisclaimer: isFr
      ? "Toute déclaration mensongère engage ma seule responsabilité civile et pénale, à l'exclusion de celle du voyageur et de Yamba."
      : "Any false declaration engages my sole civil and criminal liability, to the exclusion of the tripper and Yamba.",
    charterFullLink: isFr
      ? "Voir la charte complète et les produits interdits"
      : "See the full charter and prohibited items",

    charterAcceptTitle: isFr
      ? "J'accepte la Charte Expéditeur"
      : "I accept the Shipper Charter",
    charterAcceptCgv: isFr ? "CGV" : "Terms",
    charterAcceptContract: isFr ? "Contrat de transport" : "Transport Contract",
    charterAcceptDescPrefix: isFr ? "J'ai lu et j'accepte également les " : "I have also read and accept the ",
    charterAcceptDescJoin: isFr ? " et le " : " and the ",
    charterAcceptDescSuffix: ".",

    // ============================================================
    // STEP 4 — Payment
    // ============================================================
    step4Title: isFr ? "Paiement" : "Payment",
    step4Subtitle: isFr
      ? "Tu n'es débité qu'à acceptation par le voyageur (sous 24h max)"
      : "You're only charged when the tripper accepts (within 24h max)",

    paymentMethodTitle: isFr ? "Moyen de paiement" : "Payment method",
    paymentCard: isFr ? "Carte bancaire" : "Card",
    paymentCardDesc: isFr
      ? "Visa, Mastercard, Amex · Cartes internationales acceptées"
      : "Visa, Mastercard, Amex · International cards accepted",
    paymentApplePay: "Apple Pay",
    paymentApplePayDesc: isFr
      ? "Touch ID ou Face ID · pas de saisie de carte"
      : "Touch ID or Face ID · no card entry",
    paymentGooglePay: "Google Pay",
    paymentGooglePayDesc: isFr
      ? "Paiement en un clic depuis ton compte Google"
      : "One-click payment from your Google account",

    afterPaymentTitle: isFr ? "Après ton paiement" : "After your payment",
    afterPaymentItems: isFr
      ? [
        "Le voyageur reçoit ta demande et a **24h pour accepter**. Tu n'es débité qu'à acceptation.",
        "Tu reçois ton **code à 6 chiffres**, à transmettre au destinataire.",
        "Rendez-vous avec le voyageur pour la **remise du colis**, qu'il vérifiera et photographiera.",
        "Le destinataire communique le code au voyageur à l'arrivée, qui le saisit pour valider la livraison.",
        "**3 jours après** la livraison validée, le voyageur reçoit son paiement.",
      ]
      : [
        "The tripper receives your request and has **24h to accept**. You're only charged on acceptance.",
        "You receive your **6-digit code**, to share with the recipient.",
        "Meet the tripper for the **handover**, where they'll inspect and photograph the parcel.",
        "The recipient gives the code to the tripper at arrival, who enters it to confirm delivery.",
        "**3 days after** confirmed delivery, the tripper receives their payment.",
      ],

    trustStripe: isFr
      ? "Paiement sécurisé par Stripe. Yamba ne stocke jamais tes données bancaires."
      : "Payment secured by Stripe. Yamba never stores your card details.",
    paymentLoadingMessage: isFr ? "Préparation du paiement…" : "Preparing payment…",

    // ============================================================
    // SUMMARY / SIDEBAR / BOTTOM-SHEET
    // ============================================================
    tripSelectedTitle: isFr ? "Trajet sélectionné" : "Selected trip",
    summaryCompactTitle: isFr ? "Récap" : "Summary",
    summaryToPayTitle: isFr ? "Tu paies" : "You pay",
    transport: isFr ? "Transport" : "Transport",
    serviceYamba: isFr ? "Service Yamba" : "Yamba service",
    insurance: isFr ? "Assurance" : "Insurance",
    insurance500: isFr ? "Assurance 500 €" : "Insurance €500",
    total: isFr ? "Total" : "Total",
    totalNote: isFr
      ? "Débité à acceptation par le voyageur"
      : "Charged when the tripper accepts",
    totalNoteLong: isFr
      ? "Le montant est autorisé maintenant et débité uniquement quand le voyageur accepte."
      : "The amount is authorized now and only charged when the tripper accepts.",
    totalLabel: isFr ? "Total à payer" : "Total to pay",
    sidebarCtaHint: isFr
      ? "Tu n'es débité qu'à acceptation par le voyageur"
      : "You're only charged when the tripper accepts",
    bottomSheetDetail: isFr ? "Détail" : "Detail",
    bottomSheetHide: isFr ? "Masquer" : "Hide",

    parcelSummary: isFr ? "Colis" : "Parcel",
    photosSummary: isFr ? "Photos" : "Photos",
    photosCountSummary: (count: number) =>
      isFr ? `${count} ajoutée${count > 1 ? "s" : ""}` : `${count} added`,
    pickupSummary: isFr ? "Remise" : "Handover",
    deliverySummary: isFr ? "Retrait" : "Pickup",
    recipientSummary: isFr ? "Destinataire" : "Recipient",
    charterSummary: isFr ? "Engagement" : "Commitment",
    insuranceSummary: isFr ? "Assurance" : "Insurance",
    dateSummary: isFr ? "Date" : "Date",
    routeSummary: isFr ? "Trajet" : "Route",
    directFlight: isFr ? "Direct" : "Direct",
    durationSummary: (hours: number) =>
      isFr ? `${hours}h de vol` : `${hours}h flight`,
    starsLabel: isFr ? "étoile" : "star",
    dealsLabel: (count: number) =>
      isFr
        ? `${count} deal${count > 1 ? "s" : ""}`
        : `${count} deal${count > 1 ? "s" : ""}`,

    formGenericError: isFr
      ? "Merci de corriger les erreurs avant de continuer."
      : "Please fix the errors before continuing.",
  } as const;
}

export type BookingCopy = ReturnType<typeof getBookingCopy>;

function getCategoryLabels(isFr: boolean): Record<ParcelCategory, string> {
  return isFr
    ? {
      CLOTHES: "Vêtements",
      SHOES: "Chaussures",
      FASHION_ACCESSORIES: "Accessoires de mode",
      OTHER_ACCESSORIES: "Autres accessoires",
      BOOKS: "Livres",
      DOCUMENTS: "Documents",
      SMALL_TOYS: "Petits jouets",
      PHONE: "Téléphone",
      COMPUTER: "Ordinateur",
      OTHER_ELECTRONICS: "Autre électronique",
      CHECKED_BAG_23KG: "Bagage en soute 23 kg",
      CABIN_BAG_12KG: "Bagage cabine 12 kg",
    }
    : {
      CLOTHES: "Clothes",
      SHOES: "Shoes",
      FASHION_ACCESSORIES: "Fashion accessories",
      OTHER_ACCESSORIES: "Other accessories",
      BOOKS: "Books",
      DOCUMENTS: "Documents",
      SMALL_TOYS: "Small toys",
      PHONE: "Phone",
      COMPUTER: "Computer",
      OTHER_ELECTRONICS: "Other electronics",
      CHECKED_BAG_23KG: "Checked bag 23 kg",
      CABIN_BAG_12KG: "Cabin bag 12 kg",
    };
}
