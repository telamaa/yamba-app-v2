export function getDashboardCopy(isFr: boolean) {
  return {
    // Home
    home: {
      title: isFr ? "Accueil" : "Home",
      sub: "",
    },

    // Section titles & subtitles
    trips: {
      title: isFr ? "Mes trajets" : "My trips",
      sub: isFr ? "Gérez vos trajets publiés et en cours" : "Manage your published and active trips",
    },
    shipments: {
      title: isFr ? "Mes envois" : "My shipments",
      sub: isFr ? "Suivez vos colis confiés aux transporteurs" : "Track parcels entrusted to carriers",
    },
    create: {
      title: isFr ? "Créer un trajet" : "Create a trip",
      sub: isFr ? "Publiez un nouveau trajet et recevez des demandes" : "Publish a new trip and receive requests",
    },
    messages: {
      title: "Messages",
      sub: isFr ? "Vos conversations" : "Your conversations",
    },
    notifications: {
      title: "Notifications",
      sub: isFr ? "Alertes et mises à jour" : "Alerts and updates",
    },
    savedRoutes: {
      title: isFr ? "Mes alertes route" : "My route alerts",
      sub: isFr
        ? "Soyez prévenu·e dès qu'un trajet correspondant est publié"
        : "Get notified when a matching trip is published",
    },
    following: {
      title: isFr ? "Voyageurs suivis" : "Followed travelers",
      sub: isFr
        ? "Restez à l'affût des publications de vos trippers favoris"
        : "Stay tuned for posts from your favorite trippers",
    },
    payments: {
      title: isFr ? "Paiements" : "Payments",
      sub: isFr ? "Historique de toutes vos transactions" : "All your transaction history",
    },
    wallet: {
      title: isFr ? "Portefeuille" : "Wallet",
      sub: isFr ? "Votre compte Stripe Connect" : "Your Stripe Connect account",
    },
    profile: {
      title: isFr ? "Profil" : "Profile",
      sub: isFr ? "Informations personnelles et vérifications" : "Personal info and verifications",
    },
    yamber: {
      title: isFr ? "Devenir Voyageur" : "Become a Traveler",
      sub: isFr ? "Rejoignez la communauté des voyageurs Yamba" : "Join the Yamba travelers community",
    },
    security: {
      title: isFr ? "Sécurité" : "Security",
      sub: isFr ? "Mot de passe, sessions et confidentialité" : "Password, sessions and privacy",
    },
    settings: {
      title: isFr ? "Paramètres" : "Settings",
      sub: isFr ? "Langue, thème et préférences" : "Language, theme and preferences",
    },
    help: {
      title: isFr ? "Aide" : "Help",
      sub: isFr ? "FAQ, guides et contact" : "FAQ, guides and contact",
    },

    // Quick actions (Home)
    qaCreateTrip: isFr ? "Créer un trajet" : "Create a trip",
    qaMessages: "Messages",
    qaPayments: isFr ? "Paiements" : "Payments",
    qaYamber: isFr ? "Devenir Voyageur" : "Become a Traveler",
    qaSecurity: isFr ? "Sécurité" : "Security",
    qaProfile: isFr ? "Mon profil" : "My profile",
    qaSettings: isFr ? "Paramètres" : "Settings",
    qaHelp: isFr ? "Aide" : "Help",

    // Shared labels
    active: isFr ? "Actif" : "Active",
    completed: isFr ? "Terminé" : "Completed",
    draft: isFr ? "Brouillon" : "Draft",
    pending: isFr ? "En attente" : "Pending",
    inTransit: isFr ? "En transit" : "In transit",
    delivered: isFr ? "Livré" : "Delivered",
    received: isFr ? "Reçu" : "Received",
    inProgress: isFr ? "En cours" : "In progress",
    revenue: isFr ? "Revenus" : "Revenue",
    spent: isFr ? "Dépensés" : "Spent",
    qaSavedRoutes: isFr ? "Créer une alerte" : "Create alert",
    edit: isFr ? "Modifier" : "Edit",
    manage: isFr ? "Gérer" : "Manage",
    change: isFr ? "Changer" : "Change",
    createTrip: isFr ? "Créer un trajet" : "Create a trip",
    newTrip: isFr ? "Nouveau trajet" : "New trip",
    newTripDesc: isFr
      ? "Publiez votre prochain voyage et gagnez de l'argent en transportant des colis"
      : "Publish your next trip and earn money carrying parcels",
    openStripe: isFr ? "Ouvrir Stripe Dashboard" : "Open Stripe Dashboard",
    stripeDesc: isFr
      ? "Gérez vos virements et coordonnées bancaires"
      : "Manage your transfers and bank details",
    emailVerified: isFr ? "Email vérifié" : "Email verified",
    phoneVerified: isFr ? "Tél vérifié" : "Phone verified",
    onboardingDone: isFr ? "Onboarding terminé · Stripe Connect actif" : "Onboarding done · Stripe Connect active",
    password: isFr ? "Mot de passe" : "Password",
    passwordSub: isFr ? "Modifié il y a 3 mois" : "Changed 3 months ago",
    twoFa: isFr ? "Double authentification" : "Two-factor authentication",
    twoFaSub: isFr ? "Ajoutez une couche de sécurité" : "Add an extra layer of security",
    activeSessions: isFr ? "Sessions actives" : "Active sessions",
    activeSessionsSub: isFr ? "2 appareils connectés" : "2 connected devices",
    publicProfile: isFr ? "Profil public" : "Public profile",
    publicProfileSub: isFr ? "Visible par les autres utilisateurs" : "Visible to other users",
    showCity: isFr ? "Afficher ma ville" : "Show my city",
    showCitySub: isFr ? "Votre ville apparaît sur votre profil" : "Your city appears on your profile",
    language: isFr ? "Langue" : "Language",
    theme: isFr ? "Thème" : "Theme",
    themeSub: isFr ? "Automatique" : "Automatic",
    emailNotif: isFr ? "Notifications email" : "Email notifications",
    emailNotifSub: isFr ? "Demandes, messages, paiements" : "Requests, messages, payments",
    pushNotif: isFr ? "Notifications push" : "Push notifications",
    pushNotifSub: isFr ? "Alertes en temps réel" : "Real-time alerts",
    thisMonth: isFr ? "ce mois" : "this month",
    // C-PR8b (D63) — mes données
    privacy: {
      title: isFr ? "Mes données" : "My data",
      sub: isFr ? "Ce que Yamba garde, ce que tu peux télécharger ou supprimer" : "What Yamba keeps, what you can download or delete",
      reminders: isFr ? "Relance par email des messages non lus" : "Email reminders for unread messages",
      remindersSub: isFr ? "Un email si un message reste sans lecture 15 minutes, au plus un par heure" : "An email if a message stays unread for 15 minutes, at most one per hour",
      export: isFr ? "Télécharger mes données" : "Download my data",
      exportSub: isFr ? "Un fichier JSON avec ton profil, tes trajets, tes réservations, tes messages… Une fois par 24 h." : "A JSON file with your profile, trips, bookings, messages… Once per 24 hours.",
      exportAction: isFr ? "Télécharger" : "Download",
      exportConfirm: isFr ? "Télécharger le fichier" : "Download the file",
      exportDone: isFr ? "Ton fichier est téléchargé." : "Your file has been downloaded.",
      erase: isFr ? "Supprimer mon compte" : "Delete my account",
      eraseSub: isFr ? "Immédiat et irréversible. Tes réservations et litiges restent, sans ton nom." : "Immediate and irreversible. Your bookings and disputes remain, without your name.",
      eraseAction: isFr ? "Supprimer" : "Delete",
      eraseConfirm: isFr ? "Supprimer définitivement mon compte" : "Permanently delete my account",
      eraseExplain: isFr
        ? "Ton identité, tes coordonnées, tes adresses, tes alertes, tes favoris et tes justificatifs seront effacés. L'historique de tes réservations et de tes litiges reste (obligations comptables), ainsi que les avis et les messages déjà échangés, sans ton nom. Ton compte Stripe n'est pas supprimé par Yamba."
        : "Your identity, contact details, addresses, alerts, favourites and documents will be erased. Your booking and dispute history remains (accounting obligations), as do reviews and messages already exchanged, without your name. Your Stripe account is not deleted by Yamba.",
      blocked: isFr ? "Impossible pour l'instant : termine d'abord ce qui est en cours." : "Not possible yet: finish what is in progress first.",
      blockers: {
        ACTIVE_DEAL: isFr ? "Un deal est en cours (accepté, en transit, livré ou en litige)." : "A deal is in progress (accepted, in transit, delivered or disputed).",
        PENDING_REQUEST: isFr ? "Une demande de réservation attend une réponse." : "A booking request is awaiting an answer.",
        PAYOUT_PENDING: isFr ? "Un versement t'est encore dû ou a échoué." : "A payout is still owed to you or has failed.",
        RETENTION_HELD: isFr ? "Une retenue d'annulation est en médiation." : "A cancellation retention is under mediation.",
        PUBLISHED_TRIP: isFr ? "Un trajet est encore publié ou en pause : annule-le d'abord." : "A trip is still published or paused: cancel it first.",
        ADMIN_ACCOUNT: isFr ? "Ce compte porte un profil administrateur : demande sa révocation." : "This account holds an admin profile: ask for it to be revoked.",
      } as Record<string, string>,
      codeExplain: isFr ? "Par sécurité, on t'envoie un code à six chiffres par email." : "For security, we send you a six-digit code by email.",
      codeSend: isFr ? "M'envoyer le code" : "Send me the code",
      codeResend: isFr ? "Renvoyer le code" : "Resend the code",
      codeSent: isFr ? "Code envoyé : regarde ta boîte mail (et les spams)." : "Code sent: check your inbox (and spam).",
      codeLabel: isFr ? "Code reçu par email" : "Code received by email",
      confirmLabel: isFr ? "Tape SUPPRIMER pour confirmer" : "Type SUPPRIMER to confirm",
      cancel: isFr ? "Annuler" : "Cancel",
      error: isFr ? "Impossible pour le moment, réessaie." : "Not possible right now, try again.",
    },
  };
}

export type DashboardCopy = ReturnType<typeof getDashboardCopy>;
