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
      title: isFr ? "Devenir Yamber" : "Become a Yamber",
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
    qaYamber: isFr ? "Devenir Yamber" : "Become a Yamber",
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
  };
}

export type DashboardCopy = ReturnType<typeof getDashboardCopy>;
