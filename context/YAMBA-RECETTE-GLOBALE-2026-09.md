# Recette globale — septembre 2026 (avant le chantier mobile)

Fiche de consignation : une ligne par scénario, verdict `✅` / `❌` / `⏭` (non testable dans l'environnement) / `⬜` (à faire), une note courte. Les scénarios viennent des grilles de `YAMBA-DOC-METIER.md` (lots livrés sans recette par lot depuis le 05/09) ; une anomalie ouvre une ligne dans « Anomalies » et se corrige en PR groupée par domaine ; une décision découverte va au registre.

## 0. Préparation

| # | Étape | Verdict | Note |
|---|---|---|---|
| P1 | `chore/deps` mergée (0 vulnérabilité), `dev` à jour, `npm ci` propre | ⬜ | |
| P2 | `docker compose up -d` (Redpanda) + Mailpit sur `localhost:1025` / `:8025`, `.env` : `EMAIL_PROVIDER=smtp`, `SMTP_HOST=localhost`, `SMTP_PORT=1025` | ⬜ | |
| P3 | `npx tsx --env-file=.env packages/libs/prisma/scripts/seed-deals.ts` (membres datés de 90 jours), `seed-settings.ts --show` | ⬜ | |
| P4 | `grant-admin.ts <email> --role SUPER_ADMIN` + un second admin SUPPORT (pour SIG / TRU) | ⬜ | |
| P5 | Clé PostHog de test dans `apps/user-ui/.env.local` (`NEXT_PUBLIC_POSTHOG_KEY`) — sinon ANA2–ANA7 en `⏭` | ⬜ | |
| P6 | URL de battement (Better Stack ou webhook.site) dans `CRON_HEARTBEAT_PING_URLS` — sinon MON6 en `⏭` | ⬜ | |
| P7 | `npm run dev` : six services + user-ui + admin-ui, `curl :8080/api/status` → 200 `ok` | ⬜ | |

## 1. PAR — Paramètres de la plateforme (C-PR8a, D62) (12 scénarios)

| # | Scénario | Attendu | Verdict | Note |
|---|---|---|---|---|
| PAR1 | Super administrateur : menu « Paramètres » | Neuf groupes, chaque ligne avec valeur en vigueur, défaut, portée ; tout est « par défaut » sur une base neuve (version 0) | ⬜ | |
| PAR2 | Cliquer le libellé « Commission Yamba » | Panneau d'explication : texte, exemple, bornes, services lecteurs, mention CGU | ⬜ | |
| PAR3 | Saisir 15 pour la commission, 4 € pour le plancher | Panneau « À valider » avec le diff (12 % → 15 %, 3,00 € → 4,00 €) et l'aperçu chiffré ; bouton inactif tant que le motif fait moins de 20 caractères | ⬜ | |
| PAR4 | Enregistrer avec un motif | « 2 paramètre(s) modifié(s) — version 1 » ; Journal : deux lignes `SETTING_CHANGED` (avant / après / motif) ; chaque super administrateur reçoit l'email « Paramètres de la plateforme modifiés » ; l'accueil admin affiche « Paramètres modifiés le … » | ⬜ | |
| PAR5 | Saisir 25 % de commission | Refus 400 « entre 5 et 20 » ; rien n'est écrit | ⬜ | |
| PAR6 | Mettre S = 1,5 avec M = 1,1 | Refus 400 « S ≤ M ≤ L » ; rien n'est écrit | ⬜ | |
| PAR7 | Deux onglets : modifier dans l'un, puis dans l'autre sans recharger | Le second reçoit 409, la page se recharge, la modification est à refaire | ⬜ | |
| PAR8 | Compte OPS (`grant-admin.ts <email> --role OPS`) : page Paramètres | Les lignes métier sont en lecture seule (« super administrateur seul ») ; le seuil « Relais en retard depuis » est modifiable ; enregistrer → version +1, journal | ⬜ | |
| PAR9 | Compte FINANCE : page Paramètres | Visible, aucune saisie possible | ⬜ | |
| PAR10 | « Tout réinitialiser » | La liste exacte des clés qui vont changer, motif, confirmation ; Journal : `SETTINGS_RESET` par clé ; « toutes les valeurs sont celles par défaut » | ⬜ | |
| PAR11 | Commission à 15 % ; côté membre, ouvrir le wizard sur un trajet au kilo | Le récapitulatif affiche 15 % (le total change) ; `GET /api/trips/pricing/params` répond `commissionPct: 15, version: n` | ⬜ | |
| PAR12 | Relance messagerie à 5 min / intervalle 10 min ; envoyer un message et ne pas le lire | L'email de relance part entre 5 et 10 min (cron 5 min) au lieu de 15–20 | ⬜ | |

## 2. MNT — Maintenance, état des services, conservation (C-PR8c, D64) (10 scénarios)

| # | Scénario | Attendu | Verdict | Note |
|---|---|---|---|---|
| MNT1 | Admin : menu « État des services » | Six cartes vertes (gateway, auth, trip, deal, notification, message) avec Mongo et Redis « ✓ », version, démarré depuis ; outbox et emails 24 h ; relu toutes les 30 s | ⬜ | |
| MNT2 | Arrêter le message-service, attendre 30 s | Sa carte passe rouge « Injoignable », le bandeau du haut liste le service | ⬜ | |
| MNT3 | Couper Redis, attendre 30 s | Les cartes passent ambre « Dégradé » avec « ✗ redis » | ⬜ | |
| MNT4 | Après un passage de cron (ex. relance à H:00 ou H:05) | Ligne dans « Crons — dernier battement » avec la durée et le résumé (« 0 relance(s), 0 échec ») | ⬜ | |
| MNT5 | OPS : annoncer une maintenance pour dans 1 h avec un message FR/EN et un motif | Les deux fronts affichent le bandeau ambre avec la date et le message ; rien n'est bloqué ; Journal « État de maintenance modifié » ; email aux super administrateurs | ⬜ | |
| MNT6 | OPS : activer la lecture seule | Bandeau rouge côté membres ; un membre peut chercher et lire un fil, mais réserver / envoyer un message répond « La plateforme est en maintenance » (503) ; la connexion marche ; l'admin fonctionne | ⬜ | |
| MNT7 | Lever la maintenance | Écritures possibles dans les 10 s, bandeau disparu | ⬜ | |
| MNT8 | `MAINTENANCE_MODE=on` dans l'environnement du gateway, redémarrer le gateway | Lecture seule immédiate, badge « forcée par l'environnement » sur la page d'état, l'admin ne peut pas la lever depuis la page | ⬜ | |
| MNT9 | FINANCE : page « État des services » | Visible ; l'éditeur de maintenance dit « Profil Exploitation ou super administrateur pour modifier » | ⬜ | |
| MNT10 | Paramètres : `retention.notificationsDays` à 30, puis lancer le cron du notification-service (03:50) | Les notifications de plus de 30 jours disparaissent ; les événements d'outbox parqués sont intacts ; battement « retention » avec les trois compteurs | ⬜ | |

## 3. MON — Moniteur externe (D70) (6 scénarios)

| # | Scénario | Attendu | Verdict | Note |
|---|---|---|---|---|
| MON1 | `curl -i http://localhost:8080/api/status`, tout tourne | 200, `status: "ok"`, cinq services `reachable: true`, aucun champ `url` ni `error` | ⬜ | |
| MON2 | Arrêter message-service, rappeler après 10 s | 503, `status: "down"`, `message-service.reachable: false` | ⬜ | |
| MON3 | Couper Redis (ou `REDIS_DATABASE_URI` faux) sur un service | 503, `status: "degraded"` | ⬜ | |
| MON4 | Activer la maintenance depuis l'admin, service arrêté ou non | 200, `status: "maintenance"` | ⬜ | |
| MON5 | `curl -i http://localhost:3000/api/health` et `:3001/api/health` | 200, `app` = user-ui / admin-ui | ⬜ | |
| MON6 | `CRON_HEARTBEAT_PING_URLS` vers une URL de test (webhook.site), attendre un tick de `expire-bookings` | Un GET reçu à chaque tour ; sans la variable, aucun appel sortant | ⬜ | |

## 4. API — OpenAPI auth-service (A145) (4 scénarios)

| # | Scénario | Attendu | Verdict | Note |
|---|---|---|---|---|
| API1 | Ouvrir `http://localhost:6001/docs` | Visionneuse Scalar, huit groupes (auth, me, carrier, saved-routes, users, reports, admin-auth, admin), 86 opérations | ⬜ | |
| API2 | `curl :6001/openapi.json \ | jq '.paths \ | ⬜ | |
| API3 | Ajouter une route dans un routeur sans la documenter, lancer les tests | Le test « documente chaque route montée » échoue en nommant la route | ⬜ | |
| API4 | Modifier un schéma sans régénérer, pousser | Le check « OpenAPI contracts generate+diff » échoue | ⬜ | |

## 5. EML — Emails : Resend, webhooks, suppression (D35) (8 scénarios)

| # | Scénario | Attendu | Verdict | Note |
|---|---|---|---|---|
| EML1 | `docker compose up -d`, `EMAIL_PROVIDER=smtp`, `SMTP_HOST=localhost`, `SMTP_PORT=1025` ; s'inscrire | Le code OTP apparaît dans http://localhost:8025 | ⬜ | |
| EML2 | Sans variable email, en développement, accepter un deal | Le service log « [email:fake] → … » ; `EmailDelivery` en SENT avec `provider: FAKE` | ⬜ | |
| EML3 | `NODE_ENV=production` sans `RESEND_API_KEY` ni `SMTP_HOST` | Le service refuse de démarrer (« FAKE provider is refused in production ») | ⬜ | |
| EML4 | `EMAIL_PROVIDER=resend` avec une clé de test ; accepter un deal | L'email arrive à l'adresse du compte Resend ; `EmailDelivery` porte `provider: RESEND` et `providerMessageId` | ⬜ | |
| EML5 | Depuis le tableau Resend, rejouer le webhook `email.delivered` | `EmailDelivery` passe DELIVERED avec `deliveredAt` ; rejouer une seconde fois → 200 sans changement | ⬜ | |
| EML6 | Envoyer à `bounced@resend.dev` (adresse de test) | Webhook `email.bounced` : trace BOUNCED, `User.emailSuppressedAt` posé, fiche admin avec le bandeau ambre « rebond dur » | ⬜ | |
| EML7 | Relancer un message non lu vers ce membre | Aucun email ; la notification in-app est là | ⬜ | |
| EML8 | Fiche admin (SUPPORT) : « Lever (adresse corrigée) » | Bandeau disparu, Journal « Suppression d'adresse levée », les emails repartent | ⬜ | |

## 6. SES — Sessions membre, sudo, mot de passe, email (D65) (10 scénarios)

| # | Scénario | Attendu | Verdict | Note |
|---|---|---|---|---|
| SES1 | Sécurité → « Appareils connectés » | Cet appareil est listé (navigateur · système, dernière activité, « cet appareil ») | ⬜ | |
| SES2 | Se connecter depuis un second navigateur, revenir sur le premier | Deux appareils ; « Déconnecter » sur le second → il est renvoyé à la connexion à sa prochaine action | ⬜ | |
| SES3 | « Déconnecter les autres appareils » | Message « n appareil(s) déconnecté(s) » ; seul cet appareil reste | ⬜ | |
| SES4 | Mot de passe → « Changer » sans code | La porte s'ouvre : « M'envoyer le code » ; email « Ton code de confirmation Yamba » ; le code accepté ouvre la fenêtre et le changement passe | ⬜ | |
| SES5 | Dans les 15 minutes, changer l'adresse email | Aucun nouveau code demandé (fenêtre ouverte) ; la nouvelle adresse reçoit « Confirme ta nouvelle adresse » | ⬜ | |
| SES6 | Saisir le code reçu sur la nouvelle adresse | Adresse changée, `/auth/me` renvoie la nouvelle ; l'ancienne reçoit « L'adresse email de ton compte a changé » ; les autres appareils sont déconnectés | ⬜ | |
| SES7 | Demander une adresse déjà prise par un autre compte | Refus « déjà utilisée par un autre compte » | ⬜ | |
| SES8 | Mot de passe identique à l'actuel, ou trop faible | Refus explicite (code A51) | ⬜ | |
| SES9 | Finances → « Ouvrir Stripe Dashboard » après 15 minutes | La porte s'ouvre ; après le code, le tableau de bord s'ouvre dans un nouvel onglet | ⬜ | |
| SES10 | Mes données → « Télécharger » | Même porte ; plus de saisie de code dans le formulaire lui-même | ⬜ | |

## 7. PRO — Profil éditable (D67) (8 scénarios)

| # | Scénario | Attendu | Verdict | Note |
|---|---|---|---|---|
| PRO1 | Tableau de bord › Profil, Expéditeur pur | Avatar (initiale), prénom, nom, date de naissance, deux bascules ; pas de « nom affiché » ni de « présentation » | ⬜ | |
| PRO2 | Même écran, Voyageur avec page | Champs « nom affiché » et « présentation » (compteur /300) en plus, bouton « Voir mon profil public » | ⬜ | |
| PRO3 | Prénom « A » puis Enregistrer | Erreur sous le champ, rien n'est écrit | ⬜ | |
| PRO4 | Date de naissance il y a 12 ans | « Il faut avoir 16 ans au moins », rien n'est écrit | ⬜ | |
| PRO5 | Ajouter une photo de 3 Mo | « Photo trop lourde », aucune requête serveur ; une photo de 500 Ko → avatar affiché ici, sur la page publique et dans le header | ⬜ | |
| PRO6 | Changer la photo puis la retirer | L'ancien fichier n'existe plus chez ImageKit ; l'initiale revient | ⬜ | |
| PRO7 | Désactiver « Page publique », ouvrir `/u/<slug>` depuis un autre compte et depuis le sien | Autre compte : « page introuvable » (404) ; soi-même : page avec la mention « masquée » ; un trajet publié reste ouvrable | ⬜ | |
| PRO8 | Désactiver « Afficher ma ville » | La ville disparaît de la page publique ; réactiver la remet | ⬜ | |

## 8. RGP — Données personnelles : export, effacement (C-PR8b, D63) (12 scénarios)

| # | Scénario | Attendu | Verdict | Note |
|---|---|---|---|---|
| RGP1 | Membre : Sécurité → « Télécharger mes données » → « M'envoyer le code » | Email « Ton code de confirmation Yamba » ; saisir le code → un fichier `yamba-mes-donnees-<date>.json` se télécharge | ⬜ | |
| RGP2 | Ouvrir le fichier | `format: yamba-data-export/1` ; ses réservations avec `role` ; côté Voyageur aucune clé `recipient` ; aucun `deliveryCode` ; ses messages seulement | ⬜ | |
| RGP3 | Recommencer dans l'heure | Refus « One export per 24 hours » | ⬜ | |
| RGP4 | Membre avec un deal accepté : « Supprimer mon compte » | Bandeau ambre « Impossible pour l'instant » avec « Un deal est en cours » ; pas de saisie de code | ⬜ | |
| RGP5 | Membre sans deal vivant : code + SUPPRIMER | Déconnexion immédiate, retour à l'accueil ; la connexion avec l'ancien email/mot de passe échoue ; email « Ton compte Yamba a été supprimé » | ⬜ | |
| RGP6 | Admin : fiche du membre effacé | Nom « Membre supprimé », email `erased+…@anonymised.invalid`, aucune adresse ni justificatif ; ses deals toujours listés | ⬜ | |
| RGP7 | L'autre partie ouvre la conversation du deal | Le fil est intact, la contrepartie s'affiche « Membre supprimé » ; « Voir le numéro » n'a plus de numéro à montrer | ⬜ | |
| RGP8 | Admin PRIVACY (`grant-admin.ts <email> --role PRIVACY`) : menu « Données personnelles » | Registre avec l'export (faite), l'effacement refusé (deal en cours) et l'effacement fait ; Journal : « Registre RGPD consulté » | ⬜ | |
| RGP9 | PRIVACY : fiche d'un membre, carte « Effacer ce compte (RGPD) », motif + EFFACER | Effacé ; Journal « Compte effacé (RGPD) » avec le motif ; registre : canal « par l'admin (Prénom I.) » | ⬜ | |
| RGP10 | PRIVACY : Utilisateurs → export nominatif | Autorisé (A143), motif au journal ; FINANCE : refusé | ⬜ | |
| RGP11 | Sécurité → bascule « Relance par email » désactivée ; recevoir un message et ne pas le lire 20 min | Aucun email de relance ; la notification in-app est là | ⬜ | |
| RGP12 | `seed-deals.ts` puis passer `privacy.recipientRetentionDays` à 7 j et lancer le cron (ou attendre 03:40) | Les deals terminés depuis plus de 7 j ont `recipient` = « — / — / +00000000000 » et `recipientRedactedAt` ; les deals vivants sont intacts | ⬜ | |

## 9. SIG — Signalement d'un trajet ou d'un membre (D68) (9 scénarios)

| # | Scénario | Attendu | Verdict | Note |
|---|---|---|---|---|
| SIG1 | Visiteur non connecté, annonce publique, « Signaler cette annonce » | Porte « Connecte-toi pour signaler » ; après connexion, retour sur l'annonce | ⬜ | |
| SIG2 | Membre connecté, annonce d'un autre, motif « Arnaque suspectée » + précisions, envoyer | « Merci, ton signalement est bien reçu », email « Ton signalement a bien été reçu » dans sa langue ; rien ne change sur l'annonce | ⬜ | |
| SIG3 | Même membre, même annonce, signaler à nouveau | « Tu as déjà signalé cet élément » | ⬜ | |
| SIG4 | Propriétaire de l'annonce | Aucun bouton « Signaler » sur sa propre annonce ; sur son propre profil non plus | ⬜ | |
| SIG5 | Profil public d'un membre, « Signaler ce profil », motif « Usurpation d'identité » | Reçu ; le profil signalé ne voit rien, aucune notification pour lui | ⬜ | |
| SIG6 | Admin SUPPORT, `/reports` | Deux files : « Trajets et membres » (corridor cliquable, « publié par … », auteur, motif) et « Messages » ; carte d'accueil « Trajets et membres signalés » | ⬜ | |
| SIG7 | Trois membres différents signalent la même annonce | La ligne porte « Prioritaire · 3 ouverts » ; l'annonce reste en ligne tant que le support ne la masque pas | ⬜ | |
| SIG8 | « Sans suite » avec une note, puis retenter | Journal `REPORT_REVIEWED` avec la note ; deuxième décision refusée (409) | ⬜ | |
| PRO9 | Mes trajets, un trajet publié puis masqué | Badges « En ligne » puis « Masqué », actions « Masquer » / « Remettre en ligne », toasts « Trajet masqué » / « Trajet remis en ligne » (EN : Online / Hidden) | ⬜ | |

## 10. TRU — TrustScore interne et plafonds (D71) (7 scénarios)

| # | Scénario | Attendu | Verdict | Note |
|---|---|---|---|---|
| TRU1 | Compte créé aujourd'hui, réserver un colis de 450 € déclarés | Refus « Ton compte est récent … » avant paiement ; à 250 € la demande passe | ⬜ | |
| TRU2 | Même compte, 5 demandes ce mois, en tenter une sixième | Refus (plafond envois / mois) | ⬜ | |
| TRU3 | Même compte, colis de 12 kg | Refus (plafond poids) ; 8 kg passe | ⬜ | |
| TRU4 | Compte de 6 mois avec 3 deals terminés, colis de 450 € et 12 kg | Aucun plafond | ⬜ | |
| TRU5 | Admin › fiche membre | Carte « Risque interne » : niveau, score, facteurs avec leurs points, plafonds et raison, rappel « ne sanctionne rien » | ⬜ | |
| TRU6 | Membre avec 3 litiges perdus (via seed ou médiation), signalé une fois | Fiche « À risque » ; file des signalements : badge « À risque », ligne prioritaire avec un seul signalement | ⬜ | |
| TRU7 | Paramètres › Confiance : passer les envois par mois à 2, réessayer TRU2 avec 2 demandes | Refus au troisième envoi dans les 30 s | ⬜ | |

## 11. DES — Page destinataire (D69) (9 scénarios)

| # | Scénario | Attendu | Verdict | Note |
|---|---|---|---|---|
| DES1 | Expéditeur, deal accepté, carte « Partage le suivi à {prénom} », « Copier le message » | Message avec le lien `/track/…` copié ; le même lien au second clic | ⬜ | |
| DES2 | « WhatsApp » | WhatsApp s'ouvre sur le numéro saisi à la réservation, message pré-rempli | ⬜ | |
| DES3 | Ouvrir le lien dans une fenêtre privée (aucun compte) | Page « Ton colis arrive, {prénom} », corridor, dates, jalon « Colis pris en charge », frise, mention RGP-02, bloc « Toi aussi » | ⬜ | |
| DES4 | Voyageur : récupération, puis jalons de transit, puis remise avec le code | La page passe à « récupéré », « en route », « arrivé » (avec le conseil du code), « remis », avec les heures | ⬜ | |
| DES5 | Le Voyageur appelle `POST /deals/:id/tracking-link` | 403 ; un deal en attente → 409 `TRACKING_NOT_AVAILABLE` | ⬜ | |
| DES6 | Chercher dans la page une adresse, un numéro, le code | Absents de la page et de la réponse API | ⬜ | |
| DES7 | Après le cron d'effacement du tiers (ou `recipientRedactedAt` posé à la main) | « Ce lien de suivi n'est plus valide », bloc « Toi aussi » conservé | ⬜ | |
| DES8 | Tracker en transit, carte destinataire | Le vrai numéro saisi à la réservation (Appeler / WhatsApp), plus le numéro factice | ⬜ | |
| VOC1 | Email « profil actif » d'un Voyageur, parcours de réservation en anglais, Mes trajets | « Voyageur » / « traveler » partout, plus aucun « Tripper », « traveller » ni « transporteur » | ⬜ | |

## 12. ANA — Mesure d'audience PostHog (D66) (8 scénarios)

| # | Scénario | Attendu | Verdict | Note |
|---|---|---|---|---|
| ANA1 | Navigateur neuf, `NEXT_PUBLIC_POSTHOG_KEY` posée, ouvrir le site | Bannière « Mesure d'audience » en bas, deux boutons de même poids, lien « En savoir plus » | ⬜ | |
| ANA2 | « Refuser » puis naviguer, rechercher | Aucune requête vers `eu.i.posthog.com` (onglet réseau), bannière disparue | ⬜ | |
| ANA3 | Vider le stockage, « Accepter », rechercher Paris → Dakar, ouvrir un trajet, commencer une réservation | Requêtes vers PostHog : `$pageview`, `search_performed` (origine, destination, nombre de résultats), `trip_viewed`, `booking_step_viewed` ; aucune propriété ne contient un nom ou un email | ⬜ | |
| ANA4 | Se connecter (membre ayant accepté) | `identify` avec l'identifiant du compte uniquement ; le compte porte `analyticsOptIn: true` et une ligne ConsentLog COOKIES | ⬜ | |
| ANA5 | Sécurité › Mes données → bascule « Mesure d'audience » désactivée | Plus aucune requête ; le compte passe à `false`, la ligne COOKIES est révoquée | ⬜ | |
| ANA6 | Membre ayant accepté, sur un autre appareil neuf | Pas de bannière : le choix du compte est repris | ⬜ | |
| ANA7 | Serveur avec `POSTHOG_API_KEY` : accepter un deal dont l'Expéditeur a consenti et le Voyageur non | Un seul événement `booking.accepted` (rôle SHIPPER) chez PostHog ; rejouer l'événement outbox ne crée pas de doublon | ⬜ | |
| ANA8 | Sans clé PostHog | Aucune bannière, aucun envoi, aucun log d'erreur | ⬜ | |

## 13. E2E — parcours de bout en bout sur le seed (wording D28, glossaire A144 relus à chaque écran)

| # | Scénario | Attendu | Verdict | Note |
|---|---|---|---|---|
| E2E1 | Expéditeur : recherche Paris → Dakar, ouvrir un trajet, réserver (colis 3 kg, 120 € déclarés), payer (provider FAKE) | Demande créée, 24 h d'acceptation, email « demande envoyée » dans Mailpit | ⬜ | |
| E2E2 | Voyageur : accepter depuis Mes trajets | Deal ACCEPTED, conversation ouverte, emails aux deux, notification in-app | ⬜ | |
| E2E3 | Messagerie : proposer un rendez-vous, l'accepter, révéler le numéro à l'heure d'ouverture | Rendez-vous accepté, numéro visible, message système | ⬜ | |
| E2E4 | Voyageur : récupération (5 points, photos), jalons de transit | Tracker Expéditeur à jour, page destinataire (DES) à jour | ⬜ | |
| E2E5 | Voyageur : remise avec le code, Expéditeur : confirmation | DELIVERED puis COMPLETED, versement programmé J+4 (FAKE) | ⬜ | |
| E2E6 | Notation croisée | Révélée quand les deux ont noté, réputation mise à jour sur les profils | ⬜ | |
| E2E7 | Mes trajets : publier, masquer, remettre en ligne | Badges « En ligne » / « Masqué », actions « Masquer » / « Remettre en ligne » | ⬜ | |
| E2E8 | Relecture du vocabulaire sur tous les écrans du parcours + emails reçus | « Voyageur » / « Expéditeur » partout, aucun « Tripper », « Yamber », « transporteur » | ⬜ | |

## 14. Hors code — à la main du fondateur

| # | Étape | Attendu | Verdict | Note |
|---|---|---|---|---|
| ATL1 | Atlas › Backup : palier du cluster et politique de snapshots | Un palier avec sauvegardes (M10+ continu ; M2/M5 quotidien) ; politique activée, rétention notée | ⬜ | |
| ATL2 | Restauration d'essai vers un cluster temporaire, un service local pointé dessus | Comptes de documents (users, trips, bookings) égaux à la source à la date du snapshot | ⬜ | |
| ATL3 | Cluster temporaire supprimé, procédure notée dans DOC-TECHNIQUE | | ⬜ | |
| MONX | Better Stack : 3 moniteurs, 4 battements, contacts ; couper un service 5 min | Première alerte reçue, puis « résolu » | ⬜ | |

## Anomalies

| # | Grille | Description | Gravité (bloquant / majeur / mineur) | PR de correction | État |
|---|---|---|---|---|---|

## Décisions candidates découvertes

- (aucune)

## Sortie

Le chantier mobile s'ouvre quand : aucune anomalie bloquante ouverte, ≥ 95 % des scénarios `✅` (les `⏭` exclus du calcul), ATL2 réussie, MONX : première alerte reçue.
