# Yamba — Plan de recette : workflow de réservation Expéditeur

> **Audience** : testeur QA, développeur, product owner avant mise en production.
> **Version** : 1.0 — Mai 2026
> **Hypothèse de travail** : ce plan suppose que **le backend `deal-service` et l'intégration Stripe Connect sont fonctionnels**. Pour le périmètre actuel (mock backend), les scénarios marqués 🔒 sont à reporter à la PR d'intégration backend.
> **Objectif** : valider de bout en bout que le workflow Expéditeur fonctionne dans toutes les configurations (devices, navigateurs, locales, modes), avec gestion correcte des cas d'erreur.

---

## 1. Périmètre du test

### Inclus dans cette recette

✅ Wizard de réservation Expéditeur (4 étapes)
✅ Navigation entre les étapes (avant, arrière, stepper cliquable)
✅ Validation des champs et affichage des erreurs
✅ Calcul du prix total selon catégorie + assurance
✅ Intégration Stripe Elements (saisie carte, validation)
✅ Persistance de l'état (sessionStorage, changement de viewport)
✅ Bilinguisme FR / EN
✅ Mode sombre / clair
✅ Responsive desktop / mobile

### Hors périmètre (recette séparée)

❌ Recherche de trajets (déjà recettée)
❌ Page détail trajet (déjà recettée — seul le bouton "Réserver" est revérifié ici)
❌ Création de trajet côté voyageur
❌ Workflow de réception du deal côté voyageur (recette séparée future)
❌ Tests de charge / performance backend
❌ Tests de sécurité (penetration testing)

### Critères d'acceptation globaux

1. Aucun bug bloquant (P0).
2. Aucun bug majeur (P1) sans contournement.
3. Tous les scénarios nominaux passent à 100 %.
4. Tous les scénarios d'erreur affichent des messages clairs et orientés solution.
5. Aucune fuite de données sensibles (notamment : clés API, IPs internes) côté client.
6. Compatibilité confirmée sur la liste des devices/navigateurs cibles.

---

## 2. Pré-requis

### Comptes de test

| Rôle | Email | Mot de passe | Notes |
|------|-------|--------------|-------|
| Expéditeur "Aïcha" | `aicha.test@yamba.dev` | `Test1234!` | Compte standard, aucune réservation antérieure |
| Expéditeur "Marc" | `marc.test@yamba.dev` | `Test1234!` | Compte standard, a déjà 2 réservations passées |
| Expéditeur sans Stripe | `nostripe.test@yamba.dev` | `Test1234!` | Pour vérifier le fallback |

### Données de test

- **Voyageur "Thomas K."** : trajet Paris (CDG) → Brazzaville (Maya-Maya), Jeudi 28 mai, 5h45 de vol, direct, note 4,8/5, 23 deals
- Tarifs : Vêtements 50 €, Chaussures 60 €, Électronique 80 €, Bagage cabine 12 kg 90 €
- Catégories acceptées : Vêtements, Chaussures, Électronique, Documents, Cabin Bag 12kg
- 2 lieux de remise : Aéroport Paris-CDG Terminal 2E, Gare du Nord Hall principal
- 2 lieux de retrait : Aéroport Maya-Maya Hall arrivées, Marché Total Avenue Foch

### Cartes de test Stripe

| Numéro | Comportement attendu |
|--------|----------------------|
| `4242 4242 4242 4242` | Carte valide, paiement réussit |
| `4000 0000 0000 0002` | Carte refusée par la banque |
| `4000 0025 0000 3155` | Nécessite authentification 3D Secure |
| `4000 0000 0000 9995` | Fonds insuffisants |
| `4000 0000 0000 0341` | Carte volée (refus immédiat) |

Date d'expiration : n'importe quelle date future (ex. `12/30`). CVC : n'importe quoi à 3 chiffres (ex. `123`). Code postal : `75001` (ou n'importe quoi en France).

### Environnement de test

- **URL** : `https://staging.yamba.app` (ou `http://localhost:3000` pour dev local)
- Services backend démarrés : `auth-service`, `trip-service`, `deal-service`, `api-gateway`
- Base de données : pré-populée avec les comptes et trajets ci-dessus
- Stripe : compte test (`pk_test_...` côté frontend)

### Devices et navigateurs cibles

#### Desktop

| OS | Navigateur | Versions |
|----|------------|----------|
| macOS 14+ | Safari | Dernière + N-1 |
| macOS 14+ | Chrome | Dernière |
| macOS 14+ | Firefox | Dernière |
| Windows 11 | Chrome | Dernière |
| Windows 11 | Edge | Dernière |

#### Mobile

| OS | Navigateur | Modèles testés |
|----|------------|----------------|
| iOS 17+ | Safari | iPhone 13, 15 Pro |
| iOS 17+ | Chrome | iPhone 13 |
| Android 13+ | Chrome | Samsung Galaxy S23, Pixel 8 |

#### Tablette

| OS | Navigateur | Modèles |
|----|------------|---------|
| iPadOS 17+ | Safari | iPad Air, iPad Pro 12,9" |

---

## 3. Scénarios de recette

### Légende

- ✅ **PASS** : comportement conforme attendu
- ❌ **FAIL** : bug détecté → ouvrir un ticket
- ⚠️ **PARTIAL** : fonctionne mais à améliorer
- 🔒 : nécessite backend complet
- ⏱ : timing critique à mesurer

---

### 3.1 Accès et initialisation

#### TC-001 — Accès depuis la page détail (utilisateur connecté)

| # | Action | Attendu |
|---|--------|---------|
| 1 | Se connecter avec le compte Aïcha | Redirection vers la home, badge utilisateur visible |
| 2 | Aller sur `/fr/trips/<tripId>` | La page détail s'affiche, voyageur Thomas K. visible |
| 3 | Cliquer sur le bouton "Réserver" (desktop : dans la card de prix à droite ; mobile : dans la bottom-bar fixée) | Redirection vers `/fr/trips/<tripId>/book`, wizard sur l'étape 1 |
| 4 | Vérifier le titre de la page | "Réservation" (FR) ou "Booking" (EN) selon locale |
| 5 | Vérifier le sous-titre | "Paris → Brazzaville · jeu. 28 mai" (FR) ou équivalent EN |

🔒 **TC-002 — Accès direct par URL (non connecté)**

| # | Action | Attendu |
|---|--------|---------|
| 1 | En navigation privée, aller directement sur `/fr/trips/abc/book` | Redirection vers `/fr/login?redirect=/fr/trips/abc/book` |
| 2 | Se connecter avec un compte valide | Retour automatique sur le wizard de booking, étape 1 |

#### TC-003 — Reprise d'un draft existant

| # | Action | Attendu |
|---|--------|---------|
| 1 | Lancer le wizard, remplir partiellement l'étape 1 (poids 2,5 kg, description "Vêtements pour ma mère") | Champs saisis |
| 2 | Fermer l'onglet **sans fermer le navigateur** | — |
| 3 | Ré-ouvrir le wizard à la même URL | L'étape 1 affiche les valeurs saisies précédemment |
| 4 | Fermer **entièrement** le navigateur, le rouvrir | L'étape 1 affiche les valeurs par défaut (sessionStorage effacé) |

---

### 3.2 Étape 1 — Colis

#### TC-101 — Affichage initial

| # | Action | Attendu |
|---|--------|---------|
| 1 | Arriver sur l'étape 1 | Stepper indique étape 1 active (cercle orange #FF9900) |
| 2 | Vérifier les sections | "Lieux de rendez-vous" (2 colonnes : remise/retrait), "Règles d'or", "Catégorie", "Poids" + "Valeur déclarée", "Description", "Photos" |
| 3 | Vérifier les options de lieu | 2 options de remise affichées (CDG + Gare du Nord), 2 options de retrait (Maya-Maya + Marché Total) |
| 4 | Vérifier la card d'assurance (desktop dans la sidebar, mobile en bas de la page) | "Basique 0 €" et "Étendue 500 € +5 €" visibles |

#### TC-102 — Sélection des lieux

| # | Action | Attendu |
|---|--------|---------|
| 1 | Cliquer sur "Aéroport Paris-CDG" puis "Aéroport Maya-Maya" | Les 2 options sélectionnées passent en vert/teal (ring + background) |
| 2 | Cliquer sur "Gare du Nord" | Désélectionne CDG, sélectionne Gare du Nord |
| 3 | Vérifier l'état visuel | Une seule option de remise sélectionnée à la fois ; idem pour retrait |

#### TC-103 — Sélection de catégorie

| # | Action | Attendu |
|---|--------|---------|
| 1 | Ouvrir le dropdown de catégorie | 5 options listées (uniquement celles acceptées par Thomas) |
| 2 | Vérifier le format des options | "Vêtements — 50 €", "Chaussures — 60 €", etc. |
| 3 | Sélectionner "Vêtements" | Sélection appliquée ; prix `transport` dans la sidebar = 50 € |
| 4 | Changer pour "Électronique" | Prix mis à jour à 80 €, frais Yamba à 12 € (15 %) |

#### TC-104 — Saisie de poids

| # | Action | Attendu |
|---|--------|---------|
| 1 | Saisir "2.5" dans Poids | Pas d'erreur |
| 2 | Saisir "abc" | Le clavier numérique mobile ne propose que des chiffres ; sur desktop le navigateur peut accepter mais validation bloque |
| 3 | Saisir "30" | Tenter de cliquer "Continuer" → erreur "Poids max 25 kg" en orange (#FF9900) sous le champ |
| 4 | Saisir "0" | Erreur "Poids minimum 0,1 kg" |
| 5 | Saisir "2,5" (virgule) | Accepté (formats fr et en) |

#### TC-105 — Saisie de valeur déclarée

| # | Action | Attendu |
|---|--------|---------|
| 1 | Saisir "150" | Pas d'erreur |
| 2 | Saisir "" (vide), cliquer Continuer | Erreur "Champ requis" |
| 3 | Saisir "1000" avec assurance basique | Erreur "Plafond 100 €" (ou message équivalent) |
| 4 | Saisir "1000" avec assurance étendue 500 € | Erreur "Plafond 500 €" |
| 5 | Cliquer sur l'icône info ⓘ à côté du label | Tooltip s'ouvre : "La valeur déclarée détermine le plafond d'indemnisation..." |
| 6 | Cliquer ailleurs ou hover out | Tooltip se ferme |

#### TC-106 — Photos

| # | Action | Attendu |
|---|--------|---------|
| 1 | Cliquer sur le slot "+ Ajouter une photo" | Ouvre le picker fichier (ou caméra sur mobile) |
| 2 | Sélectionner 1 photo | Photo affichée avec tag "Contenu" (sticky en haut à gauche) |
| 3 | Ajouter une 2e photo | Tag "Emballé" sur la 2e |
| 4 | Ajouter une 3e photo | Pas de tag, slot custom |
| 5 | Essayer d'ajouter une 7e photo | Bouton désactivé ou message "Max 6 photos" |
| 6 | Survoler une photo, cliquer sur le X | Photo retirée du grid, mémoire blob libérée (vérifier dans DevTools → Memory) |
| 7 | Passer en assurance étendue 500 € | Badge "Obligatoire" apparaît à côté du label "Photos" |
| 8 | Avec moins de 2 photos + assurance étendue, cliquer Continuer | Erreur "Au moins 2 photos requises pour l'assurance étendue" |

#### TC-107 — Choix d'assurance

| # | Action | Attendu |
|---|--------|---------|
| 1 | Vérifier la sélection par défaut | "Basique" sélectionnée (point coché) |
| 2 | Cliquer sur "Étendue 500 €" | Sélection bascule, prix dans la sidebar : +5 € sur la ligne "Assurance" |
| 3 | Cliquer sur le lien "Voir fiche IPID" (uniquement sur assurance étendue) | Console log "[booking] open IPID sheet" (ou ouverture d'un drawer/onglet, selon implémentation) |
| 4 | Vérifier que le clic sur le lien IPID **ne change pas** la sélection d'assurance (clic doit avoir `stopPropagation`) | La sélection reste sur "Étendue" |

#### TC-108 — Navigation depuis l'étape 1

| # | Action | Attendu |
|---|--------|---------|
| 1 | Sans avoir rempli quoi que ce soit, cliquer "Continuer" | Erreurs affichées en orange sur tous les champs obligatoires |
| 2 | Remplir le minimum valide + cliquer "Continuer" | Passage à l'étape 2 |
| 3 | Sur l'étape 2, cliquer sur le cercle "1" du stepper (desktop) | Retour à l'étape 1, valeurs conservées |
| 4 | Sur l'étape 2, cliquer "Retour" (bouton secondaire) | Retour à l'étape 1, valeurs conservées |

---

### 3.3 Étape 2 — Destinataire

#### TC-201 — Affichage

| # | Action | Attendu |
|---|--------|---------|
| 1 | Arriver sur l'étape 2 | Stepper indique étape 2 active, étape 1 verte (check) |
| 2 | Vérifier l'encart tip | "Comment se passera la livraison" avec 3 puces (code à 6 chiffres, transmission, remise contre code) |
| 3 | Vérifier les champs | Prénom, Nom (côte à côte), Téléphone, Email (optionnel) |

#### TC-202 — Validation des champs

| # | Action | Attendu |
|---|--------|---------|
| 1 | Saisir Prénom = "Marie", Nom = "Mboungou" | Pas d'erreur |
| 2 | Saisir Prénom = "M" (1 lettre) | Erreur "Prénom trop court" |
| 3 | Saisir Téléphone = "+242 06 421 88 12" | Pas d'erreur |
| 4 | Saisir Téléphone = "abc" | Erreur "Format invalide" |
| 5 | Laisser Email vide | Pas d'erreur (champ optionnel) |
| 6 | Saisir Email = "marie.mboungou" (sans @) | Erreur "Format email invalide" |
| 7 | Saisir Email = "marie@gmail.com" | Pas d'erreur |

#### TC-203 — Navigation depuis l'étape 2

| # | Action | Attendu |
|---|--------|---------|
| 1 | Remplir le minimum, cliquer "Continuer" | Passage à l'étape 3 |
| 2 | Retour à l'étape 2 depuis l'étape 3 | Valeurs conservées |

---

### 3.4 Étape 3 — Engagement

#### TC-301 — Affichage

| # | Action | Attendu |
|---|--------|---------|
| 1 | Arriver sur l'étape 3 | Stepper indique étape 3 active |
| 2 | Vérifier l'encart tip | "À la remise du colis, voici ce qui se passera" + 3 puces |
| 3 | Vérifier la charte amber | Encart avec icône bouclier, titre "Charte Expéditeur", 3 engagements (pas illicite, correspond, douanes), disclaimer en gris foncé |
| 4 | Vérifier la case d'acceptation | "J'accepte la Charte Expéditeur, les CGV et le Contrat de Transport" |
| 5 | Vérifier les liens dans la case | "CGV" et "Contrat de Transport" sont des liens cliquables (ouvrent dans un nouvel onglet) |

🔒 #### TC-302 — Ouverture des documents légaux

| # | Action | Attendu |
|---|--------|---------|
| 1 | Cliquer sur "CGV" dans la case d'acceptation | Ouverture de `/fr/legal/cgv` dans un nouvel onglet |
| 2 | Cliquer sur "Contrat de Transport" | Ouverture de `/fr/legal/transport-contract` |
| 3 | Cliquer sur "Lire la charte complète" dans l'encart amber | Ouverture de `/fr/legal/shipper-charter` |

#### TC-303 — Acceptation et navigation

| # | Action | Attendu |
|---|--------|---------|
| 1 | Sans cocher la case, cliquer "Passer au paiement" | Erreur "Tu dois accepter la charte et les conditions" affichée sous la case |
| 2 | Cocher la case | Pas d'erreur, bordure des éléments redevient normale |
| 3 | Cliquer "Passer au paiement" | Passage à l'étape 4 |
| 4 | Retour à l'étape 3 | Case toujours cochée |

---

### 3.5 Étape 4 — Paiement

#### TC-401 — Affichage et rendu Stripe

| # | Action | Attendu |
|---|--------|---------|
| 1 | Arriver sur l'étape 4 | Stepper indique étape 4 active, étapes 1-3 vertes |
| 2 | Vérifier le titre | "Paiement" + sous-titre "Tu n'es débité qu'à acceptation par le voyageur (sous 24h max)" |
| 3 | Vérifier les 3 options | Carte (Visa/Mastercard/Amex), Apple Pay (avec icône), Google Pay (avec icône) |
| 4 | Vérifier la sélection par défaut | "Carte" sélectionnée |
| 5 | Vérifier le rendu Stripe Elements sous l'option carte ⏱ | Le widget Stripe charge en < 2 sec (numéro, expiration, CVC, pays) |
| 6 | Vérifier le thème Stripe | Bordures et fond cohérents avec dark/light mode actif |
| 7 | Vérifier la sidebar (desktop) | Section "Vous payez" avec breakdown : Transport, Yamba service, Total |

#### TC-402 — Variation d'amount

| # | Action | Attendu |
|---|--------|---------|
| 1 | Retourner à l'étape 1, changer la catégorie pour "Électronique" (80 €), revenir à l'étape 4 | Le widget Stripe se re-render avec amount = 80 + 12 = 92 € (9200 cents) |
| 2 | Activer/désactiver l'assurance étendue → revenir à l'étape 4 | Amount Stripe ajusté |

🔒 #### TC-403 — Paiement carte standard

| # | Action | Attendu |
|---|--------|---------|
| 1 | Sélectionner "Carte" | Widget Stripe visible |
| 2 | Saisir numéro `4242 4242 4242 4242`, expiration `12/30`, CVC `123`, code postal `75001` | Pas d'erreur Stripe |
| 3 | Cliquer "Payer 57,50 €" | Spinner sur le bouton, désactivation |
| 4 | Vérifier le toast de succès | "Demande envoyée (mock — id: deal_xxx)" ou équivalent backend |
| 5 | Vérifier la redirection | Retour automatique sur `/fr/trips/<tripId>` |
| 6 | Vérifier le draft | Effacé du sessionStorage |
| 7 | Vérifier le badge "Mes demandes" | Compteur incrémenté de 1 |

🔒 #### TC-404 — Carte refusée

| # | Action | Attendu |
|---|--------|---------|
| 1 | Sélectionner "Carte", saisir `4000 0000 0000 0002` | Validation Stripe OK pendant la saisie |
| 2 | Cliquer "Payer" | Toast d'erreur "Carte refusée" ou message Stripe dans le widget |
| 3 | Vérifier l'étape | Toujours sur étape 4 |
| 4 | Vérifier la console | Pas d'erreur JavaScript non gérée |
| 5 | Réessayer avec une carte valide | Doit pouvoir payer normalement |

🔒 #### TC-405 — 3D Secure

| # | Action | Attendu |
|---|--------|---------|
| 1 | Sélectionner "Carte", saisir `4000 0025 0000 3155` | Validation Stripe OK |
| 2 | Cliquer "Payer" | Popup 3D Secure de Stripe |
| 3 | Cliquer "Complete authentication" dans la popup | Paiement validé, suite normale |
| 4 | Cliquer "Fail authentication" | Erreur 3DS, paiement bloqué, retour étape 4 |

🔒 #### TC-406 — Apple Pay (iOS Safari uniquement, HTTPS requis)

| # | Action | Attendu |
|---|--------|---------|
| 1 | Sur iPhone, sélectionner "Apple Pay" | Widget Apple Pay s'affiche (si HTTPS) |
| 2 | Authentifier avec Face ID / Touch ID | Paiement validé instantanément |

🔒 #### TC-407 — Google Pay (Android Chrome uniquement, HTTPS requis)

| # | Action | Attendu |
|---|--------|---------|
| 1 | Sur Android, sélectionner "Google Pay" | Sélecteur Google Pay s'affiche |
| 2 | Choisir une carte enregistrée | Paiement validé |

#### TC-408 — Section "Après votre paiement"

| # | Action | Attendu |
|---|--------|---------|
| 1 | Vérifier l'encart en bas de l'étape 4 | 5 étapes numérotées : voyageur reçoit, code 6 chiffres, remise, transport, réception |
| 2 | Vérifier le trust badge en bas | Logo Stripe ou texte "Paiement sécurisé par Stripe" |

---

### 3.6 Scénarios transverses

#### TC-501 — Changement de viewport en cours de wizard

| # | Action | Attendu |
|---|--------|---------|
| 1 | Sur desktop, arriver à l'étape 3, cocher la case d'acceptation | État sauvé |
| 2 | Réduire la fenêtre pour passer en mode mobile (< 1024 px) | Le wizard passe en version mobile, étape 3, case toujours cochée |
| 3 | Élargir la fenêtre | Retour version desktop, état conservé |

#### TC-502 — Reload en cours de wizard

| # | Action | Attendu |
|---|--------|---------|
| 1 | Remplir l'étape 1 et 2 | — |
| 2 | Recharger la page (F5 ou pull-to-refresh) | Wizard revient sur l'étape 2 avec les valeurs des étapes 1 et 2 |

#### TC-503 — Changement de locale en cours de wizard

| # | Action | Attendu |
|---|--------|---------|
| 1 | Commencer en FR, remplir l'étape 1 | — |
| 2 | Changer pour EN via le toggle de langue (haut de page) | Toutes les chaînes basculent en anglais, valeurs saisies conservées |
| 3 | Vérifier les options de catégorie | Affichées en anglais avec les bons prix |
| 4 | Vérifier le format de prix dans la sidebar | "€50.00" en EN, "50,00 €" en FR |
| 5 | Vérifier le format de date | "Thu, May 28" en EN, "jeu. 28 mai" en FR |

#### TC-504 — Toggle dark / light mode

| # | Action | Attendu |
|---|--------|---------|
| 1 | Commencer en light mode | — |
| 2 | Toggle vers dark mode (icône soleil/lune en header) | Toute l'UI bascule en sombre |
| 3 | Vérifier les couleurs sélectionnées | Locations sélectionnées : ring/bg emerald-500 (vert) ; payment carte sélectionnée : ring/bg orange (#FF9900) |
| 4 | Vérifier le widget Stripe | Thème "night" appliqué |
| 5 | Re-toggle vers light | Stripe repasse en thème "stripe", l'UI en clair |

#### TC-505 — Bouton Retour (header)

| # | Action | Attendu |
|---|--------|---------|
| 1 | Sur n'importe quelle étape, cliquer la flèche retour ⬅ en haut à gauche | Confirmation "Quitter ce booking ?" (à confirmer si implémenté) ou retour direct sur la page détail trajet |
| 2 | Si quitté, draft conservé en sessionStorage | Revenir au booking, l'état est intact |

#### TC-506 — Bouton Close (header)

| # | Action | Attendu |
|---|--------|---------|
| 1 | Cliquer la croix X en haut à droite | Retour sur la page détail trajet |

#### TC-507 — Stepper cliquable (desktop)

| # | Action | Attendu |
|---|--------|---------|
| 1 | À l'étape 3, cliquer sur le cercle "1" | Retour à l'étape 1 |
| 2 | Cliquer sur le cercle "4" | Pas de réaction (étapes futures non cliquables) |
| 3 | Cliquer sur le cercle "3" | Pas de réaction (étape courante non cliquable) |

---

### 3.7 Cas d'erreur et edge cases

#### TC-601 — Connexion réseau perdue pendant le wizard

| # | Action | Attendu |
|---|--------|---------|
| 1 | Couper le Wi-Fi en cours d'étape 1 | Pas d'impact, le wizard est local |
| 2 | Tenter de payer (étape 4) sans réseau 🔒 | Erreur "Connexion perdue, réessaye" ; aucune perte d'état |

#### TC-602 — Variables d'environnement absentes

| # | Action | Attendu |
|---|--------|---------|
| 1 | Retirer `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` du `.env.local` et redémarrer | Étape 4 affiche un message de fallback ("Préparation du paiement…") au lieu du widget |
| 2 | Vérifier la console | Warning `[booking] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing` |
| 3 | Aucune erreur JS bloquante | Le reste du wizard est utilisable jusqu'au step 4 |

🔒 #### TC-603 — Trajet annulé entre-temps

| # | Action | Attendu |
|---|--------|---------|
| 1 | Démarrer le booking, arriver à l'étape 4 | — |
| 2 | (Backend) Marquer le trajet comme annulé côté voyageur | — |
| 3 | Cliquer "Payer" | Erreur "Ce trajet n'est plus disponible" ; redirection vers une page d'alternative ou la home |

🔒 #### TC-604 — Voyageur a atteint son quota de deals pour ce trajet

| # | Action | Attendu |
|---|--------|---------|
| 1 | (Backend) Configurer le trajet avec `maxDeals: 0` ou tous les slots remplis | — |
| 2 | Tenter "Payer" | Erreur "Le voyageur ne peut plus accepter de nouvelle demande" |

#### TC-605 — Photo de très grande taille

| # | Action | Attendu |
|---|--------|---------|
| 1 | À l'étape 1, uploader une photo > 10 Mo | Refus avec message "Taille max 10 Mo" |
| 2 | Vérifier que la photo n'est pas ajoutée | Le grid reste inchangé |

#### TC-606 — Photo dans un format non supporté

| # | Action | Attendu |
|---|--------|---------|
| 1 | Uploader un fichier `.heic` (iPhone natif) | Conversion automatique en JPG ou message d'aide |
| 2 | Uploader un fichier `.pdf` ou `.zip` | Refus avec message "Format non supporté (JPG, PNG, WebP uniquement)" |

#### TC-607 — Caractères spéciaux dans les champs texte

| # | Action | Attendu |
|---|--------|---------|
| 1 | Saisir des emojis dans Description (étape 1) ou Prénom (étape 2) | Accepté, affiché correctement |
| 2 | Saisir des caractères de contrôle (zalgo, RTL marks) | Filtrés ou refusés selon politique de sécurité |
| 3 | Saisir une chaîne de 10 000 caractères dans Description | Tronquée à la limite définie (1 000 ou 2 000 selon spec) |

---

## 4. Accessibilité (a11y)

### Critères WCAG 2.1 niveau AA

| TC | Critère | Méthode | Statut attendu |
|----|---------|---------|----------------|
| A11Y-01 | Navigation au clavier complète | Tab à travers tous les éléments | ✅ Tous les inputs, options, boutons sont focusables |
| A11Y-02 | Indicateur de focus visible | Tab sur chaque élément | ✅ Outline ou ring visible (couleur ≠ background) |
| A11Y-03 | Labels ARIA présents | Inspecter le DOM | ✅ `aria-label` sur les IconButton (close, back), `aria-current="step"` sur le stepper |
| A11Y-04 | Contraste texte / fond | Outil Lighthouse / axe DevTools | ✅ Ratio ≥ 4.5:1 en light, ≥ 7:1 en dark |
| A11Y-05 | Lecteur d'écran (VoiceOver iOS, TalkBack Android) | Activer le lecteur, naviguer dans le wizard | ✅ Tous les champs et boutons sont annoncés correctement |
| A11Y-06 | Mode "Reduced Motion" | Activer dans les préférences OS | ✅ Transitions du stepper et bottom-sheet sont réduites (pas de mouvement excessif) |
| A11Y-07 | Tap targets ≥ 44×44 px sur mobile | Inspecter avec DevTools mobile | ✅ Boutons, options, photos de taille suffisante |
| A11Y-08 | Erreurs annoncées | Saisir un champ invalide, écouter le lecteur | ✅ L'erreur est annoncée via `aria-live="polite"` ou via `aria-describedby` |

---

## 5. Performance

### Métriques cibles

| Métrique | Cible | Outil de mesure |
|----------|-------|-----------------|
| Time to Interactive (TTI) sur l'étape 1 | < 3 s sur 4G mid-tier | Lighthouse |
| Largest Contentful Paint (LCP) | < 2.5 s | Lighthouse |
| First Input Delay (FID) | < 100 ms | Lighthouse |
| Cumulative Layout Shift (CLS) | < 0.1 | Lighthouse |
| Bundle JS booking (chunk) | < 150 KB gzippé | `next build && next analyze` |
| Chargement de Stripe.js | < 2 s sur 4G | Network tab |
| Re-render lors de changement de catégorie | < 16 ms (60 FPS) | React DevTools Profiler |

### Tests à conduire

| TC | Test | Méthode |
|----|------|---------|
| PERF-01 | Audit Lighthouse en mode mobile 4G | `lighthouse https://staging.yamba.app/fr/trips/abc/book --emulated-form-factor=mobile --throttling-method=devtools` |
| PERF-02 | Memory leak sur upload/remove photos | Upload 6 photos, supprimer les 6, répéter 20 fois, observer le heap dans DevTools Memory tab |
| PERF-03 | Pas de re-render inutile | Sur l'étape 1, taper dans le champ Poids, vérifier que les Steps 2/3/4 ne re-render pas (React DevTools Profiler) |
| PERF-04 | Lazy loading des photos | Vérifier que les photos uploadées n'apparaissent dans le DOM qu'au scroll si > 6 |

---

## 6. Sécurité

| TC | Test | Attendu |
|----|------|---------|
| SEC-01 | XSS dans Description | Saisir `<script>alert(1)</script>` dans description, soumettre, vérifier dans le backend que c'est encodé HTML |
| SEC-02 | XSS dans Prénom destinataire | Idem |
| SEC-03 | CSRF sur le submit | Backend valide le token de session (cookies) ; tester une requête forgée sans token → 401 |
| SEC-04 | Fuite de la clé Stripe secrète | Grep dans le bundle JS : `grep -r "sk_live\|sk_test" .next/` → aucun résultat |
| SEC-05 | IPs internes exposées | Grep dans le bundle JS pour des IPs privées (`10.\|192.168.`) hors variables d'env de dev |
| SEC-06 | Photos uploadées | Le backend valide le content-type réel (magic bytes), pas juste l'extension |
| SEC-07 | Manipulation du prix côté client | Modifier `draft.weightKg` via DevTools pour passer 100 kg → le backend doit re-valider et refuser |

---

## 7. Compatibilité

### Matrice de test

| Navigateur | OS | Étape 1 | Étape 2 | Étape 3 | Étape 4 | Notes |
|------------|----|---------|---------|---------|---------|-------|
| Safari 17 | macOS 14 | ✅ | ✅ | ✅ | ✅ | RAS |
| Safari 17 | iOS 17 | ✅ | ✅ | ✅ | ✅ | Apple Pay disponible si HTTPS |
| Chrome 122+ | macOS | ✅ | ✅ | ✅ | ✅ | RAS |
| Chrome 122+ | Windows | ✅ | ✅ | ✅ | ✅ | RAS |
| Chrome Mobile | Android 13+ | ✅ | ✅ | ✅ | ✅ | Google Pay disponible si HTTPS |
| Firefox 124+ | macOS | ✅ | ✅ | ✅ | ✅ | RAS |
| Firefox 124+ | Windows | ✅ | ✅ | ✅ | ✅ | RAS |
| Edge 122+ | Windows | ✅ | ✅ | ✅ | ✅ | RAS |

⚠️ **Safari 16 et antérieur** : non supporté. Afficher un message d'incompatibilité.

⚠️ **Internet Explorer** : non supporté. Aucun test à conduire.

---

## 8. Procédure de signalement de bug

### Format minimum d'un ticket

```markdown
**Titre** : [Booking][Step 2] Le champ Téléphone n'accepte pas l'indicatif +33

**Sévérité** : P0 / P1 / P2 / P3
**Étape concernée** : Étape 2 - Destinataire
**Device** : iPhone 15 Pro
**Navigateur** : Safari 17.4
**OS** : iOS 17.4.1
**Locale** : FR
**Mode** : Light

**Précondition** :
- Connecté avec aicha.test@yamba.dev
- Sur le wizard étape 2

**Étapes pour reproduire** :
1. Cliquer dans le champ Téléphone
2. Saisir "+33 6 12 34 56 78"
3. Cliquer "Continuer"

**Résultat observé** :
Erreur "Format invalide" alors que le numéro est valide.

**Résultat attendu** :
Pas d'erreur, passage à l'étape 3.

**Capture d'écran** : (joindre)
**Logs console** : (joindre si pertinent)
**URL** : https://staging.yamba.app/fr/trips/abc/book
```

### Sévérités

| Niveau | Définition | Exemple |
|--------|-----------|---------|
| **P0 — Bloquant** | Empêche complètement l'utilisation de la feature, ou risque de sécurité majeur | Stripe Elements ne se charge jamais, le paiement n'aboutit jamais |
| **P1 — Majeur** | Cas d'usage important impacté, contournement difficile | La case d'acceptation étape 3 ne se coche pas en mobile |
| **P2 — Mineur** | Cas d'usage secondaire ou ergonomie | Le tooltip valeur déclarée se ferme trop vite |
| **P3 — Cosmétique** | Affichage, texte, marge | Le subtitle de l'étape 1 a une typo |

---

## 9. Critères de sortie de recette (Definition of Done)

✅ Tous les TC marqués sans 🔒 passent en PASS
✅ Pour les TC marqués 🔒, ils sont **documentés comme reportés** à la PR backend
✅ Aucun bug P0 ouvert
✅ Aucun bug P1 ouvert sans contournement validé par le PO
✅ Lighthouse mobile sur l'étape 1 ≥ 85 sur tous les axes (perf, a11y, best practices)
✅ Recette compatibilité PASS sur la matrice ci-dessus
✅ Validation visuelle du designer sur les 4 étapes en dark + light
✅ Validation produit du PO sur les copies FR + EN

---

## 10. Annexes

### A. Cartes de test Stripe étendues

Pour plus de scénarios (cartes par pays, déclinaisons 3DS, fraud detection) : [stripe.com/docs/testing](https://stripe.com/docs/testing).

### B. Devices physiques recommandés pour le test

- **iPhone 13** : représentatif du parc iOS milieu de gamme.
- **iPhone 15 Pro** : représentatif des Dynamic Island et écrans récents.
- **Samsung Galaxy S23** : Android représentatif du parc moyen-haut de gamme.
- **iPad Air** : pour la couche tablette (qui n'a pas de breakpoint dédié actuellement, à valider).

### C. Outils recommandés

| Outil | Usage |
|-------|-------|
| **Chrome DevTools** | Inspection DOM, network, performance |
| **Safari Web Inspector** | Remote debugging iOS |
| **React DevTools** | Profiler les re-renders |
| **Lighthouse CI** | Performance + accessibilité automatisées |
| **Axe DevTools** | Audit a11y détaillé |
| **BrowserStack** | Tests cross-browser si pas d'accès aux devices physiques |
| **Stripe Dashboard (mode test)** | Vérifier les PaymentIntent côté backend |
| **Postman / Insomnia** | Tester directement les endpoints API |

### D. Glossaire technique

| Terme | Définition |
|-------|------------|
| **Smoke test** | Test rapide pour vérifier qu'une feature fonctionne globalement avant tests détaillés |
| **Regression test** | Re-test des cas qui marchaient précédemment pour vérifier qu'une nouvelle modif ne les a pas cassés |
| **End-to-end (E2E)** | Test du flow complet du point de vue utilisateur |
| **A/B test** | Comparer 2 versions d'une feature pour mesurer laquelle performe mieux |
| **Canary release** | Déploiement progressif (5 % puis 25 % puis 100 % du trafic) |

---

*Document maintenu en cohérence avec les évolutions de la feature. À ré-actualiser à chaque modification majeure du wizard.*
