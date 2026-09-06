# YAMBA — Documentation métier et fonctionnelle complète du back-office Admin (admin-ui, chantier C, D54 → D71)

> Lot 2 des livrables de documentation. État du code au 05/09/2026 (branche `feat/f3-messaging-admin`, base `dev`).
> Public : un futur opérateur support (médiateur, finance, exploitation, données personnelles) **et** un développeur junior qui reprend le chantier.
> Règle de rédaction : rien n'est affirmé qui n'ait été lu dans le code ou dans les documents de `context/`. Quand le code et un document divergent, le code prime et la divergence est signalée. Une **porte** (🚪) est un choix explicitement laissé ouvert par le registre des décisions, pas une lacune.

## Sommaire

1. [Le back-office en une page](#1-le-back-office-en-une-page)
2. [Principes non négociables](#2-principes-non-négociables)
3. [Profils, permissions et cumul](#3-profils-permissions-et-cumul)
4. [Comptes admin : invitation, profils, révocation](#4-comptes-admin--invitation-profils-révocation)
5. [Connexion en deux étapes, codes de secours, sessions admin](#5-connexion-en-deux-étapes-codes-de-secours-sessions-admin)
6. [Les écrans, un chapitre par écran](#6-les-écrans-un-chapitre-par-écran)
   - 6.1 Accueil · 6.2 Alertes d'exploitation · 6.3 Utilisateurs (recherche) · 6.4 Fiche utilisateur · 6.5 Trajets · 6.6 Fiche trajet · 6.7 Billets · 6.8 À arbitrer (litiges et retenues) · 6.9 Dossier de médiation et décision · 6.10 Finances (files d'exception) · 6.11 Fiche argent d'un deal · 6.12 Rapport mensuel et export · 6.13 Pilotage · 6.14 Conversation d'un deal · 6.15 Signalements · 6.16 Paramètres · 6.17 Documentation des paramètres · 6.18 Données personnelles · 6.19 État des services et maintenance · 6.20 Journal d'audit · 6.21 Comptes admin · 6.22 Mon compte admin et mes sessions
7. [Cas de bout en bout](#7-cas-de-bout-en-bout)
8. [Règles de gestion consolidées](#8-règles-de-gestion-consolidées)
9. [Catalogue des actions du journal](#9-catalogue-des-actions-du-journal)
10. [Catalogue complet des paramètres](#10-catalogue-complet-des-paramètres)
11. [Procédures d'exploitation (runbooks)](#11-procédures-dexploitation-runbooks)
12. [Divergences constatées et portes](#12-divergences-constatées-et-portes)
13. [Recommandations d'expert (hors périmètre livré)](#13-recommandations-dexpert-hors-périmètre-livré)
14. [Index des sources](#14-index-des-sources)

---

## 1. Le back-office en une page

### 1.1 À quoi il sert

Yamba est une plateforme de crowdshipping : des **Expéditeurs** confient des colis à des **Voyageurs** qui publient des trajets. La machine à états du deal (deal-service) décide seule des transitions ; l'argent réel vit chez le fournisseur de paiement (Stripe) ; la base ne fait que refléter. Le back-office existe pour ce que la machine ne peut pas décider seule :

| Besoin | Ce que fait l'admin | Ce qu'il ne fait jamais |
|---|---|---|
| Un litige entre deux membres | Lit les deux versions et les preuves, tranche une fois, avec un motif lu par les deux | Recalculer un montant, modifier une preuve |
| Un billet déposé par un Voyageur | Le regarde, le valide ou le rejette avec un motif fermé | Bloquer une publication faute de billet |
| Une annonce douteuse | La masque de la recherche (réversible) | Annuler un trajet à la place du Voyageur |
| Un membre problématique | Restreint ou suspend le compte, avec motif, réversible | Sanctionner automatiquement sur un score ou un signalement |
| Un versement qui n'est pas parti | Le relance, décide d'un renversement, compare avec Stripe | Renvoyer de l'argent par accident (idempotence) |
| Un geste commercial | Propose puis applique un remboursement partiel hors litige | Toucher au versement du Voyageur |
| Un réglage métier (commission, fenêtres, seuils) | Le change en ligne, motivé, journalisé, jamais rétroactif | Modifier une réservation existante |
| Une demande RGPD | Efface un compte à la demande, lit le registre, exporte | Effacer un compte qui porte un deal vivant |
| Une intervention technique | Annonce puis active une lecture seule, lit l'état des services | Couper la connexion ou le back-office |

### 1.2 Où il vit

- Application séparée `apps/admin-ui` (Next.js, port 3001, français seulement, pas de next-intl, pas de thème). Elle parle au gateway (`:8080`) par le proxy `/api` (D48), les cookies restent en première partie.
- Les routes `/admin/*` vivent **chez le propriétaire du domaine** (D54 2A) : auth-service (comptes, utilisateurs, paramètres, statut, RGPD, signalements de trajets et membres, pilotage, KPI), deal-service (litiges, finances, chronologie d'un deal, alertes), trip-service (trajets, billets), message-service (conversations, messages signalés). Aucune écriture croisée entre services, sauf l'exception assumée de l'effacement RGPD (D63 4A).
- Le gateway route par préfixe : `/api/admin/disputes`, `/api/admin/finances`, `/api/admin/deals`, `/api/admin/alerts` → deal-service ; `/api/admin/trips`, `/api/admin/tickets` → trip-service ; `/api/admin/conversations` → message-service ; le reste de `/api/admin/*` et `/api/auth/admin/*` → auth-service.

### 1.3 La navigation (ce que voit chaque profil)

Le menu latéral est construit à partir des permissions du compte (`AdminShell.tsx`). Une entrée n'apparaît que si l'un des profils cumulés du compte a la permission correspondante ; le super administrateur voit tout.

| Entrée du menu | Chemin | Permission requise |
|---|---|---|
| Accueil | `/home` | (toute session admin) — les tuiles sont filtrées par `kpi.read` et par la permission de chaque file |
| À arbitrer | `/disputes` | `disputes.read` |
| Billets | `/tickets` | `tickets.review` |
| Trajets | `/trips` | `trips.read` |
| Signalements | `/reports` | `reports.review` |
| Finances | `/finances` | `finances.read` |
| Pilotage | `/pilotage` | `pilotage.read` |
| Utilisateurs | `/users` | `users.read` |
| Journal | `/audit` | `audit.read` |
| Paramètres | `/settings` | `settings.read` |
| Données personnelles | `/privacy` | `privacy.requests.read` |
| État des services | `/status` | `status.read` |
| Comptes admin | `/admins` | `admins.manage` |
| Mes sessions | `/sessions` | (toute session admin) |

Pages accessibles par lien mais absentes du menu : `/users/[id]` (fiche), `/trips/[id]` (fiche trajet), `/disputes/[id]` (dossier de médiation), `/deals/[id]` (fiche argent), `/finances/report` (rapport mensuel), `/conversations/[bookingId]` (fil d'un deal), `/settings/docs` (documentation des paramètres), `/login`, `/invite`.

Sources : `apps/admin-ui/src/components/AdminShell.tsx`, `apps/api-gateway/src/main.ts` (préfixes), `CLAUDE.md` § Admin, `context/YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md` (D54 2A).

---

## 2. Principes non négociables

Ces principes sont gravés au registre (D54, D56, D58) et appliqués partout dans le code. Un futur écran qui les contourne est un bug, pas une « interprétation ».

### 2.1 L'humain dans la boucle

- Aucune sanction, aucun masquage, aucun remboursement, aucune décision de litige n'est automatique. Un signalement (D68), un score de risque (D71), une alerte (D59) **éclairent** ; le geste reste humain, motivé et journalisé.
- Là où le geste coûte (sanction, masquage, remboursement manuel), le circuit est à **deux temps** : un profil propose, un autre applique (Support → Médiateur ; Finance/Support → Super administrateur). Une seule personne cumulant les deux profils peut faire les deux clics.
- Yamba n'annule jamais un trajet ni un deal à la place d'un membre (RG-ADM-23). Elle ne recalcule jamais un montant : tout vient du snapshot figé de la réservation (RG-FIN-01, RG-FIN-09).

### 2.2 Le journal de toute action

- Chaque geste écrit une ligne `AdminAction` : **qui** (admin), **quoi** (action), **sur quoi** (type et identifiant de cible), **avant / après** (instantanés JSON), **d'où** (IP, user-agent tronqué à 200 caractères).
- La ligne est écrite **dans la même transaction Mongo** que le geste quand il y en a une (`tx.adminAction`). « Un geste dont le journal ne s'écrit pas n'a pas eu lieu » (RG-ADM-06). Jamais en best-effort.
- Les **lectures sensibles** sont aussi journalisées : ouvrir un dossier de médiation, une fiche membre, une fiche trajet, un billet, une fiche argent, une chronologie de deal, une conversation, une liste d'inscriptions du pilotage, le registre RGPD.
- Le journal n'est **jamais purgé** (RG-MNT-07 : « journal admin jamais »).

### 2.3 403 vs 404

- **403** : la session est valide mais le profil ne porte pas la permission, ou le conflit d'intérêts s'applique (agir sur son propre compte, son propre trajet, son propre billet, un deal dont on est partie, un autre admin sans être super administrateur). Le message est explicite (« You cannot act on your own account. », « Only a super administrator can act on an admin account. »).
- **404** : la ressource n'existe pas **ou** n'est pas dans l'état attendu (un deal qui n'est pas en attente d'arbitrage répond « No arbitration file for this deal. » ; un membre déjà effacé répond « User not found. » à l'effacement). On ne révèle pas l'existence d'une ressource qu'on n'a pas à voir.
- **409** : conflit d'état typé (décision déjà rendue, signalement déjà traité, version des paramètres dépassée, effacement bloqué avec la liste fermée des motifs).
- **400** : validation (motif trop court, montant hors bornes, billet déjà revu, versement sans rien à rejouer).

### 2.4 Une session admin séparée

- La session admin est **distincte** de la session utilisateur du même compte : cookies `admin_access_token`, `admin_refresh_token`, `admin_preauth` ; Redis `admin_jti:` ; JWT avec `adm: true` et `amr: ["pwd","totp"]`. Le middleware `isAdminAuthenticated` ne lit jamais `access_token`.
- Être connecté comme membre sur `localhost:3000` n'ouvre pas l'admin sur `:3001` (recette ADM6), et inversement la connexion admin ne déconnecte pas le membre.
- Session courte : accès 15 min renouvelé en silence, 45 min d'inactivité, 12 h de vie maximale, pas de « rester connecté » (RG-ADM-05, paramètre de classe B).

### 2.5 Ce que l'admin ne voit jamais

- Le **code de livraison** : jamais dans un dossier, une chronologie, un export, un email (RG-ADM-08, RG-PIL-06).
- Le **numéro de téléphone** dans une conversation : seules les révélations (qui, quand) sont tracées (RG-FCH-20).
- Un mot de passe, un secret 2FA, un identifiant Stripe complet (masqué `acct_…xxxx` sur les fiches ; en clair seulement sur la fiche argent, pour la finance).
- Le contenu d'une **version du Voyageur** n'est jamais montré à l'Expéditeur, et réciproquement ; l'admin voit les deux.

Sources : `packages/libs/admin-audit/src/index.ts`, `packages/middleware/isAdminAuthenticated.ts`, `context/YAMBA-DOC-METIER.md` (RG-ADM-01 → 08), registre D54 8A.

---

## 3. Profils, permissions et cumul

### 3.1 Les six profils

Le profil d'un compte admin est une **liste** (`User.adminRoles`, au moins un, au plus six ; `adminRole` reste le miroir du profil principal). Les droits sont l'**union** des profils. Le super administrateur passe partout.

| Profil (code) | Libellé admin-ui | Vocation | Ce qu'il ne fait jamais |
|---|---|---|---|
| `SUPER_ADMIN` | Super administrateur | Tout : comptes admin, journal, paramètres métier, remboursement manuel, export nominatif | — (il reste soumis aux conflits d'intérêts et à la garde « dernier super administrateur ») |
| `MEDIATOR` | Médiateur | Tranche les litiges et les retenues, applique et lève les sanctions, masque et rétablit un trajet, relance un versement, clôt un renversement, lit les conversations | Exporter les finances, changer un paramètre, gérer les comptes admin |
| `SUPPORT` | Support | Lit les fiches, vérifie les billets, propose une sanction ou un masquage, traite les signalements, lit les conversations, propose un remboursement manuel, lève une suppression d'adresse | Appliquer une sanction, trancher, voir les finances, exporter |
| `FINANCE` | Finance | Files d'exception, fiche argent, rapprochement, relance et clôture de versement, rapport mensuel, export finances, exports opérationnels, pilotage, journal | Trancher un litige, sanctionner, lire une conversation, exporter des données nominatives |
| `OPS` | Exploitation | Paramètres d'exploitation (seuils d'alerte, relances, conservation, documents, comptes neufs), état des services, maintenance, KPI | L'argent, les comptes, les fiches membres, les paramètres métier |
| `PRIVACY` | Données personnelles | Registre des demandes RGPD, effacement d'un compte à la demande, export nominatif des membres, levée d'une suppression d'adresse, état des services | Tout le reste ; « se confie comme un super administrateur » (RG-RGP-08) |

Le libellé affiché cumule les profils (« Médiateur + Finance ») ; le profil principal est le premier dans l'ordre canonique SUPER_ADMIN, MEDIATOR, SUPPORT, FINANCE, OPS, PRIVACY.

### 3.2 La matrice complète permissions × profils

Source unique : `ADMIN_PERMISSIONS` dans `packages/libs/api-contracts/src/admin/admin-users.schema.ts`, lue par le middleware `requireAdminPermission` (403 explicite) et par le miroir `apps/admin-ui/src/lib/permissions.ts` (qui cache les boutons et les entrées de menu — le serveur reste le juge). Le super administrateur a tout ; il n'est pas répété dans les colonnes.

| Permission | MEDIATOR | SUPPORT | FINANCE | OPS | PRIVACY | Ce qu'elle ouvre |
|---|:-:|:-:|:-:|:-:|:-:|---|
| `disputes.read` | ✓ | ✓ | ✓ | | | File « À arbitrer », dossier de médiation, KPI litiges / retenues / deals en cours |
| `disputes.decide` | ✓ | | | | | Trancher un litige, arbitrer une retenue |
| `users.read` | ✓ | ✓ | ✓ | | | Recherche et fiche utilisateur, KPI comptes |
| `users.suspension.propose` | ✓ | ✓ | | | | Proposer une sanction |
| `users.suspension.apply` | ✓ | | | | | Appliquer, modifier, lever une sanction |
| `users.email.unsuppress` | ✓ | ✓ | | | ✓ | Lever la suppression d'une adresse (rebond / plainte) |
| `users.erase` | | | | | ✓ | Effacer un compte (RGPD) depuis la fiche |
| `audit.read` | | | ✓ | | | Journal d'audit |
| `admins.manage` | | | | | | Comptes admin (invitation, profils, retrait) — super administrateur seul |
| `trips.read` | ✓ | ✓ | ✓ | | | Liste et fiche trajet, KPI trajets |
| `tickets.review` | ✓ | ✓ | | | | File des billets, ouvrir, valider, rejeter |
| `trips.hide.propose` | ✓ | ✓ | | | | Proposer un masquage |
| `trips.hide.apply` | ✓ | | | | | Masquer, rétablir |
| `kpi.read` | ✓ | ✓ | ✓ | ✓ | | Compteurs d'accueil, alertes de seuil |
| `finances.read` | ✓ | | ✓ | | | Files d'exception, fiche argent, rapprochement, rapport mensuel, KPI argent |
| `payouts.retry` | ✓ | | ✓ | | | Relancer un versement |
| `payouts.resolve` | ✓ | | ✓ | | | Clore un renversement (re-verser / abandonner) |
| `finances.export` | | | ✓ | | | Export CSV finances |
| `refunds.manual.propose` | | ✓ | ✓ | | | Proposer un remboursement manuel |
| `refunds.manual.apply` | | | | | | Appliquer un remboursement manuel — super administrateur seul |
| `pilotage.read` | ✓ | | ✓ | | | Courbes, corridors, drill-down |
| `deals.history.read` | ✓ | ✓ | ✓ | | | « Tout ce qui est arrivé à ce deal » |
| `exports.operational` | ✓ | | ✓ | | | Export CSV trajets, billets, dossiers (identifiants seulement) |
| `exports.personal` | | | | | ✓ | Export CSV nominatif des utilisateurs (motif ≥ 20) — super administrateur ou PRIVACY (A143) |
| `conversations.read` | ✓ | ✓ | | | | Lire le fil d'un deal (journalisé) |
| `reports.review` | ✓ | ✓ | | | | Files des signalements (trajets, membres, messages), décision |
| `settings.read` | ✓ | ✓ | ✓ | ✓ | | Page Paramètres et sa documentation, historique par clé |
| `settings.business.write` | | | | | | Écrire une clé de portée métier — super administrateur seul |
| `settings.operations.write` | | | | ✓ | | Écrire une clé de portée exploitation |
| `privacy.requests.read` | | | | | ✓ | Registre des demandes RGPD |
| `status.read` | ✓ | ✓ | ✓ | ✓ | ✓ | Page « État des services » |
| `maintenance.write` | | | | ✓ | | Planifier, activer, lever la maintenance |

Trois permissions n'ont **aucun profil** dans la matrice (`admins.manage`, `refunds.manual.apply`, `settings.business.write`) : elles sont réservées de fait au super administrateur.

### 3.3 Le cumul de profils (C-PR3bis, D60 1A)

- Une personne cumule des casquettes au lancement : un compte « Support + Finance » voit À arbitrer, Billets, Trajets, Finances, Pilotage, Utilisateurs, Journal, peut exporter les finances mais ne tranche pas un litige (recette ADM32).
- L'invitation et la modification cochent les profils (au moins un reste coché) ; l'email d'accès les nomme tous.
- Retirer l'accès vide **tous** les profils, supprime la 2FA et fait tomber les sessions admin.
- Les comptes d'avant C-PR3bis (liste absente) continuent de fonctionner par le miroir `adminRole` ; `backfill-admin-roles.ts` pose la liste exacte une fois.
- Le JWT admin et `/admin/me` portent `adminRoles` ; le middleware pose `req.adminRoles` (liste vide → `[adminRole]`).

### 3.4 Conflits d'intérêts (règles serveur)

| Situation | Réponse serveur | Où |
|---|---|---|
| Agir sur son propre compte (sanction, effacement) | 403 « You cannot act on your own account. » / « You cannot erase your own account from the back-office. » | `admin-users.controller.ts`, `privacy.controller.ts` |
| Sanctionner un compte qui porte un profil admin sans être super administrateur | 403 « Only a super administrator can act on an admin account. » | `admin-users.controller.ts` |
| Changer ses propres profils, retirer son propre accès | 403 | `admin-admins.controller.ts` |
| Rétrograder ou retirer le dernier super administrateur | 403 « The last super administrator cannot be downgraded / revoked. » | `admin-admins.controller.ts` |
| Trancher un deal dont on est partie | 403 (`assertNotParty`) | `deal-mediation.service.ts` |
| Relancer, clore, proposer ou appliquer un remboursement sur un deal dont on est partie | `allowedActions` à `false`, 403 à l'appel | `admin-finance.service.ts` |
| Masquer, proposer, revoir un billet sur son propre trajet | 403 « You cannot act on your own trip. » / « You cannot review your own ticket. » | `admin-trips.controller.ts` |

La fiche utilisateur affiche « (c'est toi : aucune action possible) » et cache les boutons ; la fiche trajet cache la carte Masquage quand l'admin est le Voyageur du trajet.

Sources : `packages/libs/api-contracts/src/admin/admin-users.schema.ts`, `apps/admin-ui/src/lib/permissions.ts`, `apps/auth-service/src/utils/admin-roles.ts`, registre D56 1A / 3A, D60 1A, D62 3A, D63 6A.

---

## 4. Comptes admin : invitation, profils, révocation

### 4.1 Comment on devient admin

| Voie | Qui | Mécanisme | Journal |
|---|---|---|---|
| Script sur le poste de l'opérateur | Le fondateur / un développeur | `npx tsx --env-file=.env packages/libs/prisma/scripts/grant-admin.ts <email> --role <PROFIL>` ou `--roles MEDIATOR,FINANCE` ; `--revoke` retire | Aucun (hors application) — c'est la seule voie pour le premier super administrateur (RG-ADM-01) |
| Invitation par un super administrateur | `admins.manage` | Page « Comptes admin » → formulaire « Inviter » | `ADMIN_INVITED` (`after: { adminRoles, existingAccount }`) |
| Reprise d'un compte existant | `admins.manage` | Même formulaire, l'adresse existe déjà : les profils sont posés, le rôle client est conservé | `ADMIN_INVITED` avec `existingAccount: true` |

L'inscription publique ne donne jamais le rôle ADMIN. Un compte créé par invitation **naît sans rôle client** (ni SHIPPER ni CARRIER) : il ne publie pas, ne réserve pas, tant qu'il ne passe pas par le parcours client (RG-ADM-10).

### 4.2 Le parcours d'invitation, pas à pas

| Étape | Acteur | Geste | Système | Résultat |
|---|---|---|---|---|
| 1 | Super administrateur | Saisit email, prénom, nom, coche un ou plusieurs profils, « Envoyer l'invitation » | `POST /admin/admins/invite` ; si l'email est inconnu : création du compte sans rôle client, `publicSlug` généré (jamais null), jeton Redis 48 h ; sinon pose des profils sur le compte existant | Message « Compte créé, invitation envoyée (48 h) » ou « Profils posés sur un compte existant, email envoyé » ; ligne « invitation en attente » dans la liste |
| 2 | Système | — | Email `adminInvite` (« Ton accès au back-office Yamba », lien `ADMIN_UI_URL/invite?token=…`, 48 h) ou `adminAccessGranted` (« Accès au back-office Yamba accordé », lien `/login`) dans la langue du destinataire | — |
| 3 | Invité | Ouvre le lien, saisit un mot de passe deux fois | `POST /auth/admin/invite/accept` (public) ; règles de force (8 caractères au moins, sans son nom ni son email — A51) ; jeton à usage unique | « Enregistrer et me connecter » → `/login` ; journal `ADMIN_INVITE_ACCEPTED` |
| 4 | Invité | Mot de passe → écran QR → premier code TOTP → codes de secours | Voir §5 | Accès aux écrans de ses profils |

Erreurs : lien sans jeton → « Lien d'invitation incomplet » ; jeton expiré ou rejoué → 400 « This invitation link is invalid or expired. » ; mots de passe différents → refus côté écran ; compte qui a déjà un profil admin → 400 « This account already has an admin profile. ».

### 4.3 Modifier les profils, retirer l'accès

| Geste | Règle | Effet | Journal | Email |
|---|---|---|---|---|
| Cocher / décocher un profil sur une ligne | Au moins un profil reste ; jamais sur soi ; le dernier super administrateur ne perd pas SUPER_ADMIN | `PATCH /admin/admins/:id { adminRoles }` remplace la liste entière | `ADMIN_ROLE_CHANGED` (`before` / `after` = listes) | Aucun (déduit du code) |
| « Retirer » | Confirmation navigateur ; jamais sur soi ; jamais le dernier super administrateur | Profils vidés, rôle ADMIN retiré, secret TOTP et codes de secours effacés ; les sessions admin tombent (le middleware refuse un compte sans profil) | `ADMIN_REVOKED` (`before` = profils) | Aucun (déduit du code) |

### 4.4 Ce que montre la liste

Nom, email, profils (cases à cocher cumulables, info-bulle par profil), état (« invitation en attente » tant que le compte n'a pas de mot de passe ; « 2FA active » ; « 2FA à activer »), date de création. La tuile d'accueil « Invitations admin en attente » compte les comptes admin sans mot de passe (super administrateur seul).

Sources : `apps/auth-service/src/controller/admin-admins.controller.ts`, `apps/admin-ui/src/components/AdminsManager.tsx`, `apps/admin-ui/src/components/InviteAccept.tsx`, `apps/auth-service/src/emails/admin-emails.ts`, `packages/libs/prisma/scripts/grant-admin.ts`, registre D56.

---

## 5. Connexion en deux étapes, codes de secours, sessions admin

### 5.1 Le parcours de connexion

| Étape | Écran | Appel | Règle |
|---|---|---|---|
| 1 | Email + mot de passe | `POST /auth/admin/login` → `{ next: "TOTP" \| "SETUP" }` et cookie de pré-authentification (5 min) | Un compte sans profil admin, sans mot de passe ou suspendu ne passe pas ; message unique « Email ou mot de passe incorrect » (401) |
| 2a (première fois) | QR code + secret en clair, « Activer la 2FA » | `POST /auth/admin/totp/setup` puis `POST /auth/admin/totp/enable { code }` | Le secret est chiffré AES en base ; l'activation renvoie **huit codes de secours montrés une seule fois** ; journal `ADMIN_TOTP_ENABLED` puis session ouverte |
| 2b (ensuite) | Code à six chiffres ou code de secours `ABCDE-FGHIJ` | `POST /auth/admin/totp/verify { code }` | Anti-rejeu : un code TOTP déjà utilisé dans le même pas de 30 s est refusé ; cinq échecs → quinze minutes d'attente (429/401 « Trop de tentatives ») ; un code de secours ne sert qu'une fois (journal `ADMIN_BACKUP_CODE_USED`) |
| 3 | Redirection `/home` | `GET /admin/me` | Journal `ADMIN_LOGIN` ; email `adminLoginAlert` (« Nouvelle connexion au back-office Yamba » : IP, appareil, date) à l'admin |

Le délai de pré-authentification dépassé renvoie à l'étape 1 (« Délai dépassé : recommence depuis le mot de passe »). L'écran de connexion dit la vraie cause d'une erreur réseau (« le gateway (8080) et auth-service (6001) tournent-ils ? ») et distingue le limiteur du gateway (429).

### 5.2 Codes de secours

- Huit codes, à usage unique, montrés une seule fois à l'activation ; « Range-les hors de ce poste ».
- La barre latérale avertit quand il en reste **deux ou moins** (« Il te reste n code(s) de secours », lu dans `/admin/me.remainingBackupCodes`).
- Il n'existe **pas d'écran** pour régénérer des codes ou réinitialiser la 2FA (déduit du code : aucune route). Un admin qui a perdu son application d'authentification et ses codes doit être **retiré puis réinvité** par un super administrateur (le retrait efface le secret TOTP), ou repris par script. Voir §13.

### 5.3 La session

- Accès 15 min (renouvelé par `POST /auth/admin/refresh`, rotation du `jti`, même `createdAt`), inactivité 45 min, vie 12 h. Le client admin tente **un** refresh sur 401 puis renvoie à `/login` ; `AdminShell` recharge `/admin/me` à chaque navigation.
- « Mes sessions » (`/sessions`) liste les sessions admin du compte (ouverte le, active le, « cette session ») et permet de **révoquer** chacune (`DELETE /admin/me/sessions/:jti`, journal `ADMIN_SESSION_REVOKED`) ; révoquer la session courante renvoie à `/login`.
- `POST /auth/admin/logout` écrit `ADMIN_LOGOUT`.

### 5.4 Paramètres de classe B (modifiables par déploiement seulement)

| Paramètre | Valeur | Règle |
|---|---|---|
| Session admin | accès 15 min · inactivité 45 min · 12 h de vie | D54 8A · RG-ADM-05 |
| 2FA admin : blocage | 5 échecs → 15 min | RG-ADM-04 |
| Invitation admin : validité | 48 h | D56 · RG-ADM-10 |
| Motifs au journal | 20 caractères (sanction, masquage, export, paramètre, maintenance, effacement, renversement) · 50 (décision de médiation, remboursement manuel) | D54 6A · D56 2A · D58 3A |

Sources : `apps/admin-ui/src/components/LoginFlow.tsx`, `apps/admin-ui/src/components/SessionsList.tsx`, `apps/auth-service/src/controller/admin-auth.controller.ts`, `apps/auth-service/src/routes/admin.router.ts`, `packages/libs/totp`, `context/YAMBA-PARAMETRES.md` (classe B), recette ADM1–ADM10, ADM20.

---

## 6. Les écrans, un chapitre par écran

Chaque chapitre suit le même plan : à quoi sert l'écran, qui y a accès, ce qu'on voit, chaque geste (bouton → règle → effet → journal → email), les erreurs possibles, les sources.

### 6.1 Accueil (`/home`)

**À quoi ça sert.** C'est la page d'atterrissage après connexion. Elle répond à une seule question : « qu'est-ce qui attend une action, selon mon profil ? ». Trois blocs, de haut en bas : le bandeau des alertes de seuil, la mention de la dernière modification de paramètres, puis deux grilles de tuiles (« À traiter », « État de la plateforme »).

**Qui y a accès.** Toute session admin ouvre la page. Les compteurs viennent de `GET /admin/kpis` (`kpi.read`) : chaque compteur n'est servi que si l'un des profils du compte a la permission de la file correspondante (`null` sinon, et la tuile n'est pas affichée). Le super administrateur voit tout. Un profil PRIVACY seul n'a pas `kpi.read` : la page affiche l'erreur 403 de l'API à la place des tuiles (déduit du code : `HomeKpis` affiche `error` en rouge).

**Ce qu'on voit.**

| Tuile | Compteur serveur | Permission qui la sert | Lien |
|---|---|---|---|
| Litiges à trancher | Litiges `OPEN` ou `CARRIER_RESPONDED` | `disputes.read` | `/disputes` |
| Retenues à arbitrer | Deals `CANCELLED` avec `retentionDisposition = HELD_FOR_MEDIATION` | `disputes.read` | `/disputes` |
| Billets à vérifier | Documents `TICKET_PROOF` `PENDING` sur des trajets à venir | `tickets.review` | `/tickets` |
| Masquages proposés | Trajets avec proposition et sans masquage | `trips.read` | `/trips?hideProposed=1` |
| Sanctions proposées | Comptes `ACTIVE` avec une proposition de sanction | `users.read` | `/users` |
| Versements en échec | Deals `payoutStatus = FAILED` | `finances.read` | `/finances?kind=FAILED` |
| Transferts renversés | `payoutStatus = REVERSED` sans clôture | `finances.read` | `/finances?kind=REVERSED` |
| Remboursements proposés | `manualRefundProposedCents > 0` | `finances.read` | `/finances?kind=PROPOSED_REFUNDS` |
| Invitations admin en attente | Comptes admin sans mot de passe | `admins.manage` | `/admins` |
| Trajets et membres signalés | Signalements `OPEN` de cible TRIP ou USER | `reports.review` | `/reports` |
| Messages signalés | Signalements `OPEN` de cible MESSAGE | `reports.review` | `/reports#messages` |
| Deals en cours | Deals ACCEPTED, PICKED_UP, DELIVERED, DISPUTED | `disputes.read` | `/trips` |
| Trajets publiés à venir | Trajets PUBLISHED à départ futur | `trips.read` | `/trips?status=PUBLISHED` |
| Trajets masqués | `hiddenByAdminAt` posé | `trips.read` | `/trips?hidden=1` |
| Comptes restreints / suspendus / Comptes | Par `accountStatus` ; total non supprimés | `users.read` | `/users` |
| Deals terminés (30 j) | COMPLETED depuis 30 jours | `disputes.read` | `/trips` |

Les tuiles « À traiter » passent en ambre quand leur valeur est supérieure à zéro. La date de calcul est affichée en pied de page.

**Gestes.** Aucun geste d'écriture depuis l'accueil : chaque tuile est un lien vers sa file. Le bandeau « Paramètres modifiés le … par … : clés » (lu dans `GET /admin/settings.lastChange`) mène à `/settings`.

**Erreurs possibles.** 401 → retour à `/login`. 403 sur `/admin/kpis` (profil sans `kpi.read`) → message d'erreur. Les alertes et la mention des paramètres échouent en silence (bloc absent).

⚠ Divergence : le sous-titre de la page dit encore « Les courbes et les finances arrivent avec le pilotage (C-PR6) » alors que le pilotage est livré (C-PR6a/6c). Texte obsolète, sans effet fonctionnel.

Sources : `apps/admin-ui/src/components/HomeKpis.tsx`, `apps/admin-ui/src/app/(back)/home/page.tsx`, `apps/auth-service/src/controller/admin-kpis.controller.ts`, RG-ADM-25.

### 6.2 Alertes d'exploitation (bandeau de l'accueil)

**À quoi ça sert.** Être prévenu **avant** que ça déborde : un versement en échec depuis deux jours, un litige tranchable oublié, un relais d'événements arrêté, une vague d'emails en échec, une liquidité qui s'assèche. Les alertes n'ont pas d'état : elles se recalculent à chaque lecture et disparaissent d'elles-mêmes quand la cause disparaît (RG-ALR-02).

**Qui y a accès.** `GET /admin/alerts` (deal-service) sous `kpi.read` : Médiateur, Support, Finance, Exploitation, super administrateur.

**Les neuf règles.** Les seuils sont des paramètres d'exploitation (groupe « Alertes d'exploitation », D62) ; les constantes du code ne sont que les défauts. La réponse de l'API renvoie les seuils en vigueur.

| Règle (code) | Gravité | Condition | Seuil par défaut (paramètre) | Lien d'action |
|---|---|---|---|---|
| `PAYOUT_FAILED_48H` | critique | Versement `FAILED` rejoué sans succès depuis plus de N h | 48 h (`alerts.payoutFailedHours`) | `/finances?kind=FAILED` |
| `DISPUTE_UNDECIDED_72H` | critique | Litige décidable (version reçue ou délai écoulé) sans décision depuis plus de N h | 72 h (`alerts.disputeUndecidedHours`) | `/disputes?decidable=1` |
| `RETENTION_HELD_7D` | attention | Retenue conservée non arbitrée depuis plus de N j | 7 j (`alerts.retentionHeldDays`) | `/disputes?kind=RETENTION` |
| `REVERSAL_OPEN_48H` | attention | Transfert renversé sans décision depuis plus de N h | 48 h (`alerts.reversalOpenHours`) | `/finances?kind=REVERSED` |
| `OUTBOX_PARKED` | critique | Au moins un événement d'outbox jamais publié après N tentatives | 10 (`alerts.outboxParkedAttempts`) | `/pilotage` |
| `OUTBOX_LAGGING_15MIN` | critique | Le plus ancien événement non publié attend depuis plus de N min | 15 min (`alerts.outboxLagMinutes`) | `/pilotage` |
| `EMAILS_FAILED_24H` | attention | Emails FAILED, BOUNCED ou COMPLAINED sur la fenêtre | 24 h (`alerts.emailsFailedWindowHours`) | `/pilotage` |
| `NO_TRIP_PUBLISHED_7D` | attention | Aucun trajet publié depuis plus de N j (ou jamais) | 7 j (`alerts.noTripPublishedDays`) | `/pilotage` |
| `ACCEPTANCE_RATE_LOW_7D` | attention | Sur la fenêtre, au moins M demandes et moins de P % acceptées | 7 j · 30 % · 5 demandes (`alerts.acceptanceRate*`) | `/pilotage` |

Le nom de la règle garde son seuil historique (« 48H », « 7D ») même si le paramètre a été changé : c'est un identifiant, pas une valeur.

**L'email quotidien.** Un cron horaire du deal-service (`ops-alerts`, « 5 * * * * », désactivable par `OPS_ALERTS_CRON_ENABLED=false`) évalue les règles et envoie **un email au support** (`SUPPORT_EMAIL`, défaut `support@yamba.app`, en français) listant les règles **nouvelles** de la journée, avec un lien vers chaque file. Le dédoublonnage est une clé Redis `yamba:alerts:sent:<règle>:<jour UTC>` posée par `SET NX` (TTL 2 jours) : jamais plus d'un email par règle et par jour ; le lendemain, une alerte toujours active repart (recette ALR05). Le récapitulatif quotidien « argent à surveiller » (`ops-digest`, 08:00) continue en parallèle.

**Ce qu'on voit.** Une ligne par alerte : pastille « critique » (rouge) ou « attention » (ambre), titre, détail chiffré (« 2 versement(s) rejoué(s) sans succès depuis plus de 48 h »), lien vers la file. À vide : « Aucune alerte : versements, litiges, relais, emails et liquidité dans les seuils ». Pied : date d'évaluation et rappel que le support reçoit un email à la première apparition.

⚠ Divergence (mineure) : les liens `/disputes?decidable=1` et `/disputes?kind=RETENTION` **ne sont pas lus** par la page « À arbitrer » (`QueueTable` initialise ses filtres à vide sans lire l'URL) ; l'opérateur atterrit sur la file entière et doit poser le filtre à la main. Les liens `/finances?kind=…` et `/trips?…` sont, eux, honorés.

Sources : `apps/deal-service/src/services/ops-alerts.rules.ts`, `apps/deal-service/src/services/ops-alerts.service.ts`, `apps/deal-service/src/cron/ops-alerts.cron.ts`, `packages/libs/api-contracts/src/admin/admin-alerts.schema.ts`, RG-ALR-01 → 04, recette ALR01–ALR06.

### 6.3 Utilisateurs — la recherche (`/users`)

**À quoi ça sert.** Retrouver un membre depuis n'importe quel indice (un email, un prénom, un numéro, un identifiant de deal, un ticket YAM-XXXX), filtrer une population (les Voyageurs prêts pour Stripe, les comptes suspendus, les inscrits du mois), et — pour les profils habilités — exporter le résultat.

**Qui y a accès.** `users.read` : Médiateur, Support, Finance, super administrateur.

**Ce qu'on voit.**

| Élément | Détail |
|---|---|
| Champ de recherche `q` | Email, nom, téléphone `+33…`, identifiant Mongo (`64b…`), ticket `YAM-2041`. Une recherche par identifiant de deal ou par ticket renvoie **les deux parties** du dossier, **sans autre filtre** (RG-ADM-30) ; la colonne Nom indique « via dealId / ticket / email / name / phone » |
| Filtres serveur | Rôle (Expéditeur, Voyageur, Admin), état du compte (Actif, Restreint, Suspendu), Stripe prêt / non prêt (compte Connect avec virements activés), inscrit du … au … |
| Tri | Plus récents, plus anciens, nom A→Z, nom Z→A |
| Pagination | Par curseur, 50 par page, bouton « Charger la suite » ; « n affiché(s) · total » |
| Colonnes | Nom (lien vers la fiche), Email, Rôles client + badge des profils admin, statut Voyageur, état du compte (vert / ambre / rouge), date d'inscription |
| Export | Bouton rouge « Exporter en CSV (données personnelles) » : visible seulement avec `exports.personal` (super administrateur ou PRIVACY) |

**Gestes.**

| Bouton | Règle | Effet | Journal | Email |
|---|---|---|---|---|
| Ouvrir une fiche | `users.read` | Voir §6.4 | `USER_VIEWED` | — |
| « réinitialiser » | — | Vide tous les filtres | — | — |
| « Exporter en CSV (données personnelles) » → motif ≥ 20 → « Télécharger » | `exports.personal` ; motif obligatoire, sinon 400 « A reason of at least 20 characters is required for a personal-data export. » ; borné à 5 000 lignes ; mêmes filtres que la liste | Fichier `utilisateurs-<date>.csv` (BOM UTF-8, RFC 4180, préfixes de formule neutralisés) avec les colonnes `id, firstName, lastName, email, phoneE164, roles, adminRoles, accountStatus, carrierStatus, stripeReady, suspendedAt, suspensionUntil, createdAt` | `EXPORTED` (`after: { domain: "users", personal: true, reason, filters, rows }`) | — |

**Erreurs possibles.** 400 sur une requête invalide (date mal formée, limite > 100) ; la liste se vide sans message d'erreur détaillé (déduit du code : `catch` silencieux) ; 403 pour un export sans permission (le bouton est caché, l'API refuse).

⚠ Divergence documentaire : RG-ADM-33 et `CLAUDE.md` disent « super administrateur seul » pour l'export nominatif ; depuis A143 (D63 6A) la matrice donne aussi `exports.personal` au profil PRIVACY. Le commentaire d'en-tête d'`ExportButton.tsx` dit encore « SUPER_ADMIN seul » ; le code, lui, teste la permission — PRIVACY exporte bien.

Sources : `apps/admin-ui/src/components/UsersSearch.tsx`, `apps/admin-ui/src/components/ExportButton.tsx`, `apps/auth-service/src/controller/admin-users.controller.ts`, `apps/auth-service/src/lib/admin-users.query.ts`, `packages/libs/csv`, RG-ADM-30 → 33, recette ADM37–ADM41.

### 6.4 Fiche utilisateur (`/users/[id]`)

**À quoi ça sert.** Tout ce qui sert à opérer sur un membre, rien de secret (RG-ADM-15). C'est aussi le seul écran d'où l'on sanctionne, lève une sanction, efface un compte (RGPD) ou lève une suppression d'adresse email.

**Qui y a accès.** Lecture : `users.read`. Les cartes d'action dépendent des permissions et des conflits d'intérêts (§3.4).

**Ce qu'on voit.**

| Bloc | Contenu |
|---|---|
| En-tête | Prénom, nom, email, téléphone, langue préférée, badge d'état du compte, badge des profils admin, mention « (c'est toi : aucune action possible) » |
| Bandeaux | Ambre « Adresse sur la liste de suppression depuis le … (plainte / rebond dur) : aucun email ne lui est envoyé » + bouton « Lever (adresse corrigée) » ; rouge « Restreint / Suspendu depuis le … par …, jusqu'au … — motif » ; ambre « Proposition de … le … : niveau — motif » |
| Compte | Rôles client, date d'inscription, sessions actives (comptées dans Redis), deals en cours |
| Voyageur | Statut Voyageur, compte Stripe **masqué** (`acct_…xxxx`), encaissements / versements activés, faits de réputation |
| Expéditeur | Faits de réputation : niveau, avis révélés (moyenne sur n), deals terminés, annulations tardives, **litiges perdus (interne)** |
| Risque interne (D29 ②) — invisible du membre | Niveau (Compte neuf, Standard, À surveiller, À risque) et score /100, facteurs avec leurs points, plafonds CNF-06 (valeur, poids, envois / mois, raison « compte neuf » ou « à risque »), activité du mois (demandes ce mois, sur 24 h, âge du compte), rappel « Un score ne sanctionne rien » |
| Sanction | Voir gestes |
| Effacer ce compte (RGPD) | Seulement avec `users.erase`, jamais sur soi, jamais sur un compte déjà effacé |
| Trajets (n) | Corridor, départ, statut ; lien « Ouvrir dans Trajets (fiches, masquage) » (`/trips?carrierId=`) |
| Deals (n) | Rôle (Exp. / Voy.), corridor, statut + ticket, montant (total payé côté Expéditeur, net côté Voyageur), date, liens « dossier » (si litige) et « argent » |
| Actions admin sur ce compte | Date, admin, action libellée, `after` en JSON |

**Le TrustScore, tel qu'il est calculé (D71).** Calculé à la lecture, jamais stocké. Signaux et pondérations : litige perdu +25 chacun (plafond 60), annulation tardive +10 (30), signalement ouvert reçu +8 (24), signalement retenu par le support +15 (45), vélocité d'un compte neuf (≥ 3 demandes en 24 h) +20, compte de moins de 7 jours +10 ; deals terminés −4 chacun (−40), bons avis (≥ 3 avis à ≥ 4,5) −10. Niveaux : `NEW` (moins de `trust.newAccountDays` jours **et** moins de 3 deals terminés), `STANDARD`, `WATCH` (score 30–59), `HIGH_RISK` (≥ 60). `NEW` et `HIGH_RISK` sont plafonnés à la réservation (409 `NEW_ACCOUNT_CAP` côté membre). Les deux rôles s'additionnent : le risque est celui du compte.

**Gestes.**

| Bouton | Qui | Règle | Effet | Journal | Email |
|---|---|---|---|---|---|
| « Proposer » (niveau Restreint / Suspendu + motif) | `users.suspension.propose` sans `apply` (Support) | Motif ≥ 20 (bouton inactif avant) ; jamais sur soi ; un admin n'est visé que par un super administrateur | La proposition s'affiche en bandeau ambre ; tuile d'accueil « Sanctions proposées » +1 ; **rien ne change pour le membre** | `USER_SUSPENSION_PROPOSED` (`after: { level, reason }`) | — |
| « Appliquer » / « Modifier la sanction » (+ « Jusqu'au » optionnel) | `users.suspension.apply` (Médiateur, super administrateur) | Motif ≥ 20 ; date de fin dans le futur sinon 400 « The end date must be in the future. » ; efface la proposition | **Restreint** : ni publier ni réserver (403 `ACCOUNT_RESTRICTED` sur `POST /trips`, `/trips/:id/publish`, `/deals`, `/deals/payment-intents`), les deals en cours continuent. **Suspendu** : toutes les sessions membre révoquées, connexion refusée (« Account suspended »), `isAuthenticated` répond 401 `ACCOUNT_SUSPENDED`, ses trajets sortent de la recherche par filtre de lecture ; les effets passent **par les lectures** des autres services, jamais par une écriture croisée | `USER_RESTRICTED` ou `USER_SUSPENDED` (`before: { accountStatus }`, `after: { accountStatus, reason, until }`) | Au membre (dans sa langue, sauf adresse supprimée) : « Ton compte Yamba est restreint / suspendu », motif **générique** et adresse de contestation ; au support si le membre a des deals en cours : « [Yamba ops] SUSPENDED : Prénom Nom a n deal(s) en cours » avec la liste |
| « Lever » (+ motif) | `users.suspension.apply` | Compte non actif, sinon 400 « This account is not restricted. » ; motif ≥ 20 | Compte `ACTIVE`, champs de sanction effacés ; trajets de nouveau visibles ; connexion possible | `USER_REINSTATED` | Au membre : « Ton compte Yamba est rétabli » |
| « Lever (adresse corrigée) » | `users.email.unsuppress` (Support, Médiateur, PRIVACY, super administrateur) | Adresse effectivement supprimée, sinon 400 « This address is not suppressed. » | `emailSuppressedAt` remis à null : les emails repartent | `EMAIL_SUPPRESSION_LIFTED` (`before: { emailSuppressedAt, reason }`, `after: { emailSuppressedAt: null }`) | — |
| « Effacer définitivement » (motif ≥ 20 + mot EFFACER) | `users.erase` (PRIVACY, super administrateur) | Jamais sur soi (403) ; 404 si déjà effacé ; refusé 409 `ERASURE_BLOCKED` tant qu'un bloqueur existe | Voir §6.18 : anonymisation en une transaction, réservations conservées sans nom, `DataRequest` canal ADMIN | `ACCOUNT_ERASED` | À l'ancienne adresse : « Ton compte Yamba a été supprimé » (sans lien) |

**Les bloqueurs d'effacement (liste fermée).** `ACTIVE_DEAL` (un deal en cours), `PENDING_REQUEST` (une demande en attente), `PAYOUT_PENDING` (un versement dû ou en échec), `RETENTION_HELD` (une retenue en médiation), `PUBLISHED_TRIP` (un trajet publié ou en pause), `ADMIN_ACCOUNT` (un profil admin, à révoquer d'abord). L'écran les traduit : « Refusé pour l'instant : un deal en cours, un trajet publié ou en pause. »

**Erreurs possibles.** 403 conflit d'intérêts (bouton caché, message serveur si appel direct) ; 400 motif court ou date passée ; 404 membre inconnu ; 409 effacement bloqué.

Sources : `apps/admin-ui/src/components/UserFileView.tsx`, `apps/auth-service/src/controller/admin-users.controller.ts`, `apps/auth-service/src/services/admin-users.service.ts`, `packages/libs/trust/index.ts`, `packages/libs/api-contracts/src/admin/admin-users.schema.ts`, `packages/libs/api-contracts/src/admin/trust.schema.ts`, `packages/middleware/requireActiveAccount.ts`, RG-ADM-11 → 15, RG-EML-05, RG-TRU-01 → 06, recette ADM13–ADM19, EML8, TRU5.

### 6.5 Trajets — la liste (`/trips`)

**À quoi ça sert.** Voir tous les trajets, en retrouver un, isoler ceux qui demandent un regard (masquage proposé, billet à vérifier, masqués), les exporter sans donnée personnelle.

**Qui y a accès.** `trips.read` : Médiateur, Support, Finance, super administrateur.

**Ce qu'on voit.**

| Élément | Détail |
|---|---|
| Recherche `q` | Ville ou identifiant |
| Filtres serveur | Origine, destination, statut (DRAFT, PUBLISHED, PAUSED, COMPLETED, CANCELLED, ARCHIVED), cases « masqués », « masquage proposé », « billet à vérifier », départ du … au … |
| Lus dans l'URL | `status`, `hidden=1`, `ticketPending=1`, `hideProposed=1`, `carrierId` (depuis une fiche membre : pastille « un seul Voyageur · tous ») |
| Tri | Départ ↓ / ↑, publiés récemment, créés récemment |
| Colonnes | Corridor (lien vers la fiche, badges rouge « masqué » et ambre « masquage proposé »), départ, Voyageur (lien vers sa fiche, mention rouge de l'état du compte s'il n'est pas actif), statut, billet (aucun billet / à vérifier / vérifié / rejeté), nombre de réservations actives |
| Export | « Exporter en CSV » sous `exports.operational` (Finance, Médiateur, super administrateur) |

**Gestes.** Ouvrir une fiche (journal `TRIP_VIEWED`) ; exporter : fichier `trajets-<date>.csv` avec `id, status, originCity, originCountryCode, destinationCity, destinationCountryCode, departureAt, publishedAt, cancelledAt, carrierId, transportMode, capacityKg, reservedKg, pricePerKgCents, ticketVerificationStatus, hiddenByAdminAt, createdAt` — **jamais d'email ni de téléphone** (RG-ADM-32) ; journal `EXPORTED` (`domain: "trips", personal: false, filters, rows`).

Sources : `apps/admin-ui/src/components/TripsList.tsx`, `apps/trip-service/src/controllers/admin-trips.controller.ts`, `apps/trip-service/src/lib/admin-trips.rules.ts`, recette ADM42.

### 6.6 Fiche trajet (`/trips/[id]`)

**À quoi ça sert.** Lire un trajet comme le voit Yamba (capacité, réservé, dates, billet, documents, réservations avec leurs montants) et décider d'un masquage.

**Ce qu'on voit.** En-tête (corridor, départ, mode de transport, statut, badge rouge « masqué par Yamba ») ; bandeau rouge « Masqué le … par … — motif » ou ambre « Masquage proposé par … le … : motif » ; carte Trajet (capacité / réservé, créé, publié, annulé, billet) ; carte Voyageur (nom, email, état du compte et statut Voyageur, lien vers la fiche) ; carte Masquage ; carte Documents (type, nom, statut, motif de rejet libellé, date de revue) ; Réservations (Expéditeur, poids, statut + ticket, total / net, date, liens « dossier » et « argent ») ; Actions admin sur ce trajet.

**Gestes — la carte Masquage.**

| Bouton | Qui | Règle | Effet | Journal | Email |
|---|---|---|---|---|---|
| « Proposer » | `trips.hide.propose` sans `apply` (Support) | Motif ≥ 20 ; jamais sur son propre trajet (403) ; trajet non masqué | Bandeau ambre, tuile « Masquages proposés » +1 ; rien ne change pour le Voyageur | `TRIP_HIDE_PROPOSED` (`after: { reason }`) | — |
| « Masquer » | `trips.hide.apply` (Médiateur, super administrateur) | Motif ≥ 20 ; déjà masqué → 400 « This trip is already hidden. » | `hiddenByAdminAt` posé, proposition effacée. Par **lecture** : absent de la recherche, page publique 404, réservation directe refusée `TRIP_NOT_BOOKABLE` ; les réservations en cours continuent ; le Voyageur garde le trajet dans son espace avec un bandeau rouge | `TRIP_HIDDEN` (`after: { reason }` — le motif interne reste au journal) | Au Voyageur, motif **générique**, lien vers son trajet et l'adresse support |
| « Rétablir » | `trips.hide.apply` | Motif ≥ 20 ; non masqué → 400 « This trip is not hidden. » | Trajet de retour dans la recherche | `TRIP_UNHIDDEN` (`after: { reason }`) | Au Voyageur : « de nouveau visible » |

« Masqué par Yamba » n'est ni une pause ni une annulation (RG-ADM-22) : Yamba n'annule jamais un trajet (RG-ADM-23). Le statut du trajet ne change pas ; seul le champ `hiddenByAdminAt` est lu par la recherche, la page publique et la création de réservation.

Sources : `apps/admin-ui/src/components/TripFileView.tsx`, `apps/trip-service/src/controllers/admin-trips.controller.ts`, `apps/trip-service/src/emails/admin-trip-emails.ts`, `apps/deal-service` (`checkTripBookable`), RG-ADM-22 → 24, recette ADM27–ADM30.

### 6.7 Billets à vérifier (`/tickets`)

**À quoi ça sert.** Regarder les billets (justificatifs `TICKET_PROOF`) déposés par les Voyageurs sur des trajets à venir et dire oui ou non. Le badge « billet vérifié » est un **signal de confiance, pas une barrière** : rien n'est bloqué faute de billet vérifié (RG-ADM-21).

**Qui y a accès.** `tickets.review` : Support, Médiateur, super administrateur.

**Ce qu'on voit.** Filtres origine, destination, âge du dépôt (+ de 1 / 3 / 7 j) ; export `exports.operational` (`documentId, tripId, originCity, destinationCity, departureAt, carrierId, originalName, mimeType, status, submittedAt`). Une carte par billet : corridor (lien fiche trajet), départ, mode de transport, Voyageur (lien fiche), date de dépôt. En tête : « n billet(s) de trajets partis sortis de la file » quand la lecture a fait passer des billets en `EXPIRED` (RG-ADM-18 : un billet d'un trajet parti n'a plus rien à prouver ; le passage se fait à la lecture de la file, en un seul `updateMany`).

**Gestes.**

| Bouton | Règle | Effet | Journal | Email |
|---|---|---|---|---|
| « Ouvrir le billet (nom du fichier) » | `tickets.review` | `GET /admin/tickets/:documentId` renvoie l'URL ImageKit, ouverte dans un nouvel onglet — c'est une donnée personnelle du Voyageur | `DOCUMENT_VIEWED` (`after: { documentId }`) | — |
| « Valider » | Document `PENDING` (sinon 400 « This ticket was already reviewed. ») ; jamais son propre billet (403) | Document `VERIFIED`, `ticketVerificationStatus` du trajet `VERIFIED`, badge « Billet vérifié » sur la page publique | `TICKET_VERIFIED` (`after: { documentId, reason: null }`) | Au Voyageur dans sa langue : « Billet vérifié » |
| « Rejeter : motif… » → « Rejeter » | Motif **fermé** obligatoire : `ILLEGIBLE` (document illisible), `DATES_MISMATCH` (les dates ne correspondent pas au trajet), `NAME_MISMATCH` (le nom ne correspond pas au compte), `SUSPICIOUS` (document non recevable) | Document `REJECTED`, trajet `REJECTED` ; le Voyageur peut redéposer : le nouveau dépôt repasse le trajet « à vérifier » et revient dans la file | `TICKET_REJECTED` (`after: { documentId, reason }`) | Au Voyageur : « Billet non validé » avec le libellé du motif |

Une décision est unique par document : le verrou `status: PENDING` de l'`updateMany` fait qu'un second clic répond 400.

Sources : `apps/admin-ui/src/components/TicketsQueue.tsx`, `apps/trip-service/src/controllers/admin-trips.controller.ts`, `apps/trip-service/src/lib/admin-trips.rules.ts`, RG-ADM-18 → 21, recette ADM22–ADM26, ADM43.

### 6.8 À arbitrer — litiges et retenues (`/disputes`)

**À quoi ça sert.** Une seule file pour tout ce qui attend une décision humaine sur l'argent d'un deal : les **litiges** ouverts par un Expéditeur après la livraison et les **retenues** d'annulation tardive conservées « à arbitrer » (RG-ADM-07). Les plus anciens d'abord ; l'ancienneté en jours passe en rouge à partir de J+5, le délai promis.

**Qui y a accès.** `disputes.read` : Médiateur, Support, Finance, super administrateur. La décision demande `disputes.decide` (Médiateur, super administrateur).

**Ce qu'on voit.** Filtres serveur : type (litiges / retenues), origine, destination, âge (+ de 3 / 7 / 14 j), « décidables maintenant » / « en attente du Voyageur » ; export `exports.operational` (`bookingId, kind, ticketNumber, category, openedAt, originCity, destinationCity, amountCents, currencyCode, shipperId, carrierId, carrierResponded, decidableAt`). Ligne « n affiché(s) · file entière : n litige(s) · n retenue(s) » (les compteurs de la file entière ne bougent pas avec les filtres, RG-ADM-30).

| Colonne | Contenu |
|---|---|
| Dossier | Ticket `YAM-XXXX` (litige) ou « Retenue », badge rouge / ambre |
| Motif | Catégorie du litige (Colis non livré, Contenu manquant, Colis endommagé, Retard important, Problème destinataire, Autre) ou « Annulation après le départ » |
| Corridor, Parties | Ville → ville ; prénoms (Exp.) · (Voy.) |
| Montant | Total payé par l'Expéditeur (litige) ou montant retenu (retenue) |
| Ouvert | Date + « J+n » (rouge dès 5) |
| Décision | Retenue : « à trancher » ; litige : « version reçue · à trancher », « sans réponse · à trancher » (délai écoulé), ou « attend le Voyageur · n h » |

⚠ Le sous-titre de la page et le formulaire de décision disent « 72 h » en dur ; le délai réel est le paramètre `dispute.responseDelayHours` (défaut 72 h). L'échéance affichée (`decidableAt`) est bien calculée avec le paramètre.

Sources : `apps/admin-ui/src/components/QueueTable.tsx`, `apps/deal-service/src/services/admin-dispute.service.ts`, RG-ADM-07, RG-MED-02, recette ADM7, MED3, ADM44.

### 6.9 Dossier de médiation et décision (`/disputes/[id]`)

**À quoi ça sert.** Entendre les deux, trancher une fois, laisser une trace. Le dossier montre tout ce que les deux parties ont déclaré et prouvé, et l'état de l'argent — **jamais le code de livraison** (RG-ADM-08). L'ouverture est journalisée (`DISPUTE_VIEWED`).

**Ce qu'on voit.**

| Bloc | Contenu |
|---|---|
| En-tête | Ticket ou « Retenue à arbitrer », corridor, statut du deal ; bandeau vert « Version du Voyageur reçue le … — décision possible » ou ambre « Version attendue jusqu'au … — décision possible dès sa réponse ou à l'échéance / délai passé, décision possible sans sa version » |
| Chronologie | Demande, acceptation, départ, prise en charge, remise, signalement, fermeture (par qui), motif d'annulation |
| Argent | Lien vers la fiche argent complète ; payé par l'Expéditeur, net Voyageur, commission, prime, capturé le, état du versement, remboursé, retenue et sa disposition |
| Expéditeur / Voyageur | Nom, email, deals terminés, annulations tardives, litiges perdus (interne), avis révélés |
| Lien « Lire la conversation des deux parties → » | Seulement avec `conversations.read` ; « Lecture journalisée » |
| Colis déclaré | Catégorie, description, valeur déclarée, poids, destinataire, photos de déclaration |
| Prise en charge | Date, checklist, notes, photos |
| Jalons du voyage | À l'aéroport, vol parti, vol arrivé |
| Remise | Photos à la remise |
| Signalement YAM-XXXX · catégorie | Description, solution souhaitée (Remboursement total / partiel, Être mis en relation, Laisser Yamba décider), engagement sur l'honneur, photos |
| Version du Voyageur | Texte (≥ 50 caractères, une seule fois) et photos (≤ 5) |
| Décision rendue | Issue, remboursé / versé, date, motif |
| Trancher | Le formulaire de décision (ci-dessous) |

**La décision (formulaire « Trancher »).** Visible seulement avec `disputes.decide` (sinon « Ton profil lit ce dossier mais ne tranche pas ») et seulement si `canDecide` (sinon « Décision possible à partir du … ou dès sa réponse » ou « Ce dossier est déjà tranché »).

| Issue | Flux (calculés comme le serveur, D54 3A) | Statut final du deal |
|---|---|---|
| Rejet | Expéditeur 0 · Voyageur = net · Yamba = total − net (commission + prime) | COMPLETED (`resolveDisputeKeep`, acteur ADMIN) |
| Remboursement partiel (montant libre entre 0,01 et total − 0,01) | Expéditeur = montant · Voyageur = max(0, net − montant) · Yamba = le reste | COMPLETED |
| Remboursement total | Expéditeur = total (commission comprise) · Voyageur 0 · Yamba 0 | CANCELLED fermé par ADMIN |
| Compensation au Voyageur (retenue) | Voyageur = prorata de sa part nette (montant serveur) · Yamba = retenue − compensation | Statut inchangé, `retentionDisposition = CARRIER` |
| Restitution à l'Expéditeur (retenue) | Expéditeur = retenue entière · Voyageur 0 | `retentionDisposition = SHIPPER` |

Parcours : issue → montant (partiel) → motif ≥ 50 caractères (« lu par les deux parties ») → « Voir le récapitulatif » (remboursé / versé / conservé, issue, extrait du motif) → « Valider définitivement ». Le serveur refuse : décision avant l'échéance sans version (409 avec `decidableAt`), partiel hors bornes (400), seconde décision sur le même dossier (409), admin partie au deal (403), motif court (400). L'argent suit l'ordre **remboursement puis versement** ; un versement en échec est rejoué par le cron, jamais bloquant.

Effets : outbox `booking.dispute_resolved` dans la même transaction ; compteur interne « litiges perdus » incrémenté sur la partie condamnée (Expéditeur si rejet, Voyageur dès qu'il y a remboursement) ; **pas de notation** après médiation (`rating: null`) ; les deux parties reçoivent écran + notification + email « Décision rendue » avec l'issue, le montant qui les concerne et le motif ; recours = médiation conventionnelle par email. Journal : `DISPUTE_RESOLVED` ou `RETENTION_ARBITRATED` (issue et montants). L'écran confirme « Décision enregistrée · issue · deal statut · remboursé … · versé … (versement état) ».

Sources : `apps/admin-ui/src/components/DisputeFileView.tsx`, `apps/admin-ui/src/components/DecisionForm.tsx`, `apps/deal-service/src/services/deal-mediation.service.ts`, `apps/deal-service/src/services/admin-dispute.service.ts`, RG-MED-01 → 08, registre D55, recette ADM8, MED4–MED10.

### 6.10 Finances — les files d'exception (`/finances`)

**À quoi ça sert.** Voir « ce qui n'a pas suivi son cours » : un versement en échec, un transfert renversé par Stripe, une retenue conservée, un remboursement proposé. Chaque montant vient du deal, rien n'est recalculé (RG-FIN-01). Pas de grand livre (D58 1A).

**Qui y a accès.** `finances.read` : Finance, Médiateur, super administrateur. Le Support ne voit ni le menu ni les tuiles.

**Ce qu'on voit.** Quatre onglets (le paramètre `?kind=` de l'URL est honoré) :

| Onglet (`kind`) | Contenu | Indication affichée | Action de ligne |
|---|---|---|---|
| Versements en échec (`FAILED`) | Deals `payoutStatus = FAILED` | Motif lisible (compte Stripe du Voyageur non prêt, refus du fournisseur), message brut du fournisseur en monospace (**réservé à l'admin**, RG-FIN-13), n tentative(s), prochaine relance, badge « Stripe non prêt » | « Relancer » (si `payouts.retry` et non partie) |
| Transferts renversés (`REVERSED`) | `payoutStatus = REVERSED` sans clôture | « transfert renversé par Stripe » | « Décider » → fiche argent |
| Retenues à arbitrer (`HELD`) | Annulations après le départ, retenue conservée | « retenue conservée » | « Arbitrer » → dossier de médiation |
| Remboursements proposés (`PROPOSED_REFUNDS`) | `manualRefundProposedCents > 0` | « remboursement proposé » | « Décider » → fiche argent |

Colonnes : deal (corridor, statut, ticket, départ, lien fiche argent), parties (prénoms cliquables), montant, état, depuis, action. Lien « Rapport mensuel et export → ».

**Le rejeu automatique (RG-FIN-06).** Le cron `payout-bookings` (toutes les 5 min) rejoue un versement en échec de plus en plus espacé : toutes les 5 minutes la première demi-heure, puis toutes les 30 minutes, puis toutes les 2 heures, puis chaque jour — sans jamais se taire. « Relancer » n'attend pas l'échéance.

**Geste « Relancer ».** `POST /admin/deals/:id/payout/retry` (`payouts.retry`). Règles : deal COMPLETED ou CANCELLED (sinon 400 « Only a completed or late-cancelled deal has a payout. »), versement FAILED ou PENDING (sinon 400 « Nothing to retry… »), admin non partie (403). C'est **le même versement**, même montant figé, même clé d'idempotence chez le fournisseur : un double clic ne verse pas deux fois (RG-FIN-07). Réponse : « Versement envoyé » (SENT) ou « Toujours en échec : motif » avec le compteur et la prochaine relance. Journal `PAYOUT_RETRIED` (`after: { outcome, reason, transferId }`).

Sources : `apps/admin-ui/src/components/FinanceQueues.tsx`, `apps/deal-service/src/services/admin-finance.service.ts`, `apps/deal-service/src/services/admin-finance.rules.ts`, `apps/deal-service/src/services/deal-settlement.service.ts`, RG-FIN-06 → 13, recette FIN01–FIN03, FIN09, FIN10.

### 6.11 Fiche argent d'un deal (`/deals/[id]`)

**À quoi ça sert.** Tout ce qui a été posé sur l'argent d'un deal, rien d'inféré (RG-FIN-09) ; comparer la base avec Stripe ; décider d'un renversement ; proposer ou appliquer un remboursement manuel ; dérouler tout ce qui est arrivé au deal. L'ouverture est journalisée (`DEAL_MONEY_VIEWED`). Accessible pour **tout** deal, pas seulement ceux des files (liens « argent » depuis les fiches membre, trajet et le dossier de médiation).

**Qui y a accès.** `finances.read` ; les gestes ont chacun leur permission et sont conditionnés par `allowedActions` (calculé serveur, `false` si l'admin est partie).

**Ce qu'on voit.**

| Bloc | Contenu |
|---|---|
| Prix figé à la réservation | Payé par l'Expéditeur, net Voyageur, commission, prime, modèle de prix et poids — **immuable** |
| Parties | Expéditeur et Voyageur (liens), compte Stripe masqué + virements activés ou « NON activés » |
| Paiement de l'Expéditeur | Fournisseur, `intentId`, `chargeId` **en clair** (pour la finance), capturé le, remboursé (montant, date, `refundId`) |
| Versement au Voyageur | État (en attente d'envoi, envoyé, en échec, gelé (litige), renversé), montant, envoyé le, `transferId`, motif d'échec + détail brut, tentatives et prochaine relance, clôture d'un renversement (re-versé / abandonné, par qui, motif), retenue (montant, disposition, arbitrée le) ; boutons « Relancer le versement », formulaire de renversement |
| Remboursement manuel (geste commercial) | Plafond, dernier remboursement manuel, proposition en cours, saisie |
| Chronologie de l'argent | Empreinte posée, débité, remboursé, litige ouvert, terminé, annulé, versement envoyé / en échec, transfert renversé, renversement clos, retenue conservée / arbitrée |
| Rapprochement avec le fournisseur | Bouton « Rapprocher maintenant » (ou « Aucun paiement à rapprocher »), état réel et divergences |
| Dates | Demandé, accepté, pris en charge, livré, litige, terminé (par), clos (par) |
| Tout ce qui est arrivé à ce deal | Bouton « Charger la chronologie » (`deals.history.read`) |
| Actions admin sur ce deal | Journal filtré sur ce deal |

**Gestes.**

| Geste | Qui | Règle | Effet | Journal | Email |
|---|---|---|---|---|---|
| « Rapprocher maintenant » | `finances.read` | Deal avec un `paymentIntentId` (sinon 400 « This deal has no payment to reconcile. ») | `PaymentProvider.inspect` **lecture seule** chez Stripe (ou Fake) : état de l'intent, montants autorisé / encaissé, remboursements, transfert et renversé ; liste des divergences ; **rien n'est modifié en base** (RG-FIN-10) | `DEAL_RECONCILED` (`after: { provider, divergences: [codes] }`) | — |
| « Relancer le versement » | `payouts.retry` | Voir §6.10 | Idem | `PAYOUT_RETRIED` | — |
| « Re-verser » (motif ≥ 20) | `payouts.resolve` (Finance, Médiateur) | Renversement ouvert (sinon 400 « This payout is not an open reversal. ») ; transaction avec garde optimiste | Clôture `RESENT`, **nouvelle clé d'idempotence**, même exécuteur → nouveau transfert (« Nouveau transfert envoyé » ou « Re-versement en échec : … — il sera rejoué ») | `PAYOUT_REVERSAL_RESOLVED` (`after: { outcome: "RESENT", reason }`) | — |
| « Abandonner » (motif ≥ 20) | `payouts.resolve` | Idem | Clôture `WRITTEN_OFF` : manque à gagner assumé, tracé ; la ligne sort de la file | `PAYOUT_REVERSAL_RESOLVED` (`WRITTEN_OFF`) | — |
| « Proposer » un remboursement manuel (montant + motif ≥ 50) | `refunds.manual.propose` (Finance, Support) | Deal COMPLETED ou CANCELLED, argent débité, montant entre 0,01 et plafond = payé − déjà remboursé (sinon 400 « At most n cents can still be refunded… »), non partie | Bandeau ambre « Proposé : montant par … le … — motif », tuile et file « Remboursements proposés » | `REFUND_MANUAL_PROPOSED` (`after: { amountCents, reason }`) | — |
| « Rembourser maintenant » | `refunds.manual.apply` (super administrateur seul) | Mêmes bornes ; **argent d'abord** (`provider.refund`, 400 « The refund could not be issued by the payment provider. » sinon) puis **une** transaction conditionnelle sur le cumul (D39) | Remboursement chez Stripe, `refundId`, cumul mis à jour, proposition effacée, outbox `booking.refund_issued` acteur ADMIN ; le Voyageur garde son versement : Yamba porte le geste (RG-FIN-17) ; portefeuille Expéditeur « partiellement remboursé » | `REFUND_MANUAL_APPLIED` (`after: { amountCents, totalRefundedCents, refundId, reason }`) | À l'Expéditeur : email standard « Remboursement émis » |
| « Charger la chronologie » | `deals.history.read` (Médiateur, Support, Finance) | Lecture seule | Fusion ordonnée : événements d'outbox (avec l'état de relais publié / en attente / **parqué** en rouge, nombre d'essais, dernière erreur), actions admin, notifications, emails ; compteurs par source ; jamais le code de livraison, une photo ou une adresse (charges utiles en liste blanche) | `DEAL_HISTORY_VIEWED` | — |

**Les codes de divergence du rapprochement.** `CAPTURE_NOT_RECORDED` (débit chez Stripe, non enregistré en base), `CAPTURE_RECORDED_NOT_LIVE`, `REFUND_NOT_RECORDED` (remboursement chez Stripe supérieur à la base — un remboursement parti sans écriture, D39), `REFUND_RECORDED_NOT_LIVE`, `TRANSFER_MISSING`, `TRANSFER_AMOUNT_MISMATCH`, `TRANSFER_REVERSED_NOT_MARKED`, `TRANSFER_MARKED_REVERSED_BUT_LIVE_OK`, `INTENT_NOT_FOUND` (paiement introuvable chez le fournisseur — attendu sur un deal seedé avec le Fake). Toute correction est un geste humain journalisé : le rapprochement compare, il ne corrige pas.

Sources : `apps/admin-ui/src/components/DealMoneyView.tsx`, `apps/deal-service/src/services/admin-finance.service.ts`, `apps/deal-service/src/services/admin-finance.rules.ts`, `apps/deal-service/src/services/admin-history.service.ts`, `packages/libs/payments` (`inspect`), RG-FIN-08 → 12, RG-FIN-17 → 18, RG-PIL-06, recette FIN04–FIN08, FIN14–FIN18, PIL07.

### 6.12 Rapport mensuel et export (`/finances/report`)

**À quoi ça sert.** Chaque mois, savoir ce qui est entré, ressorti, versé, et ce que Yamba a gagné — par devise, sans tableur maison. Donner au comptable un fichier par deal avec les identifiants Stripe.

**Qui y a accès.** Lecture `finances.read` ; export `finances.export` (Finance et super administrateur seulement — un Médiateur ne voit pas le bloc export et l'API répond 403).

**Ce qu'on voit.**

| Bloc | Contenu |
|---|---|
| Aujourd'hui (passifs, jamais un revenu) | Par devise : dû aux Voyageurs (PENDING + FAILED), gelé par un litige, renversé à décider, retenues à arbitrer, remboursements proposés |
| Par mois (sélecteur 3 / 6 / 12 / 24 mois) | Mois, devise, encaissé (×n), remboursé (×n), versé (×n), **revenu (commission + prime des deals terminés)**, retenues nées, deals terminés / annulés |
| Export CSV par deal (journalisé) | Du … au … (au plus 366 jours), « Télécharger le CSV » |

**Règles de datation (RG-FIN-14, 15).** Chaque fait compte à sa propre date : encaissé au débit, remboursé au remboursement, versé à l'envoi, revenu à la fin du deal, retenue à l'annulation ; un deal capturé en mars et terminé en avril compte dans les deux mois ; mois UTC. Le revenu reconnu est la commission plus la prime des deals terminés ; une retenue conservée, un versement dû, un transfert renversé ou un remboursement proposé sont des **passifs**. Les frais Stripe ne sont pas dans Yamba (le comptable rapproche avec l'export Stripe).

**Geste « Télécharger le CSV ».** `GET /admin/finances/export?from&to` ; période > 366 jours → 400 « The period cannot exceed 366 days. » ; période invalide → 400. Fichier `yamba-finances-<du>-<au>.csv` : une ligne par deal ayant un fait d'argent dans la période (`dealId, status, originCity, destinationCity, departureAt, shipperId, carrierId, currency, totalShipperCents, transportCents, commissionCents, premiumCents, capturedAt, refundAmountCents, refundedAt, refundId, payoutStatus, payoutAmountCents, payoutSentAt, transferId, retentionCents, retentionDisposition, completedAt, completedBy, closedAt, closedBy, disputeTicket, paymentIntentId, chargeId…`). Journal `FINANCE_EXPORTED` (`after: { from, to, rows, filename }`). L'en-tête `X-Row-Count` porte le nombre de lignes.

Sources : `apps/admin-ui/src/components/FinanceReportView.tsx`, `apps/deal-service/src/services/admin-finance.rules.ts` (`buildFinanceReport`, `buildFinanceSnapshot`, `FINANCE_CSV_COLUMNS`), RG-FIN-14 → 16, recette FIN11–FIN13.

### 6.13 Pilotage (`/pilotage`)

**À quoi ça sert.** Savoir chaque semaine si Yamba avance, où la demande existe sans offre, et ouvrir n'importe quelle courbe jusqu'aux éléments qui la composent. Les chiffres sont **calculés serveur** depuis les modèles (jamais depuis PostHog, qui sert les funnels — RG-ANA-05) et mis en cache Redis 60 s (mention « (cache) »).

**Qui y a accès.** `pilotage.read` : Finance, Médiateur, super administrateur. Le Support n'a ni le menu ni l'accès (403).

**Ce qu'on voit.**

| Bloc | Contenu |
|---|---|
| Tuiles | Comptes, Voyageurs prêts (Stripe), trajets publiés à venir |
| Onglet Activité | Huit courbes : inscriptions, trajets publiés, demandes, acceptations, livraisons (code validé), deals terminés, annulations, litiges — chaque fait à sa date (RG-PIL-01) |
| Onglet Finances | Cinq courbes en devise (sélecteur si plusieurs) : encaissé, remboursé, versé aux Voyageurs, revenu reconnu, retenues nées — mêmes règles que le rapport mensuel (RG-PIL-09) |
| Sélecteurs | Par semaine (lundi, UTC) ou par mois ; sur 1 / 3 / 6 / 12 / 24 mois ; périodes vides comprises |
| Courbe | Titre, indication, total, « Agrandir », survol avec repère et valeur, dernier point étiqueté ; libellés de période lisibles (« 29 juin → 5 juil. 2026 », « Juillet 2026 »), code ISO en rappel (RG-PIL-11) |
| Vue agrandie | Courbe pleine largeur, tableau période / valeur / variation (vert / rouge), panneau « Éléments de la période » |
| Corridors (7 / 30 / 90 / 365 jours) | Ville → ville (pays), trajets, demandes, acceptées (%), €/kg moyen, litiges, vues, recherches, sans résultat ; ligne ambre + badge « demande sans offre » quand il y a des recherches sans résultat et aucun trajet (RG-PIL-03) |

**Le drill-down (D60 3A).** Un clic sur un point ou une ligne du tableau appelle `GET /admin/pilotage/drilldown?metric&granularity&period` : la liste des comptes, trajets ou deals de la période (libellé, statut, montant, date, lien vers la fiche), **bornée à 200** (« 200 premiers affichés »). Ouvrir une liste d'**inscriptions** est journalisé (`PILOTAGE_DRILLDOWN_VIEWED`) : c'est une liste de personnes. Les autres mesures ne le sont pas (déduit du code).

**D'où viennent les vues et les recherches.** Redis, écrit par le trip-service : une vue de trajet compte une fois par visiteur et par jour (compte ou empreinte technique, jamais l'adresse conservée — RG-PIL-04) ; une recherche est comptée par corridor avec « sans résultat » quand elle ne renvoie aucun trajet. Si Redis est indisponible, les pages membres répondent sans compteur et le pilotage sans vues ni recherches (RG-PIL-05).

⚠ Le sous-titre de la page dit « Les alertes de seuil arrivent avec C-PR6b » : livré depuis, texte obsolète.

Sources : `apps/admin-ui/src/components/PilotageView.tsx`, `apps/auth-service/src/controller/admin-pilotage.controller.ts`, `apps/auth-service/src/lib/pilotage.rules.ts`, `packages/libs/redis/trip-stats.ts`, RG-PIL-01 → 11, recette PIL02–PIL06, PIL09–PIL12.

### 6.14 Conversation d'un deal (`/conversations/[bookingId]`)

**À quoi ça sert.** Lire le fil entier des deux parties **depuis un dossier** (litige ou signalement), quand le dossier l'exige. La lecture est un geste volontaire (un lien, jamais un panneau chargé d'office) et journalisé (`CONVERSATION_VIEWED`, RG-FCH-20).

**Qui y a accès.** `conversations.read` : Médiateur, Support, super administrateur. **Finance n'a rien à y lire.**

**Ce qu'on voit.** Liens de retour (dossier du deal, signalements) ; corridor, statut du deal, noms des deux parties ; rappel « Le numéro de téléphone n'apparaît jamais ici : seules les révélations sont tracées » ; carte Rendez-vous (remise / livraison, lieu, créneau, proposé / confirmé / annulé, par qui) ; carte Numéro révélé (« Personne n'a encore vu le numéro de l'autre » ou « Voyageur a vu le numéro le … ») ; le fil : bulles par auteur (Expéditeur à gauche, Voyageur à droite), messages système centrés (« Rendez-vous proposé », « Rendez-vous confirmé », « Numéro affiché »), badge ambre « coordonnées détectées » (détection sans blocage), messages signalés en rouge avec motif, auteur du signalement, date, statut et précisions.

**Gestes.** Aucun : lecture seule. Un deal sans conversation répond 404 « Ce deal n'a pas de conversation » (le fil naît à l'acceptation).

Sources : `apps/admin-ui/src/components/ConversationView.tsx`, `apps/message-service/src/services/admin-conversation.service.ts`, `apps/message-service/src/routes/admin.router.ts`, RG-FCH-20, RG-FCH-24, recette FCH25.

### 6.15 Signalements (`/reports`)

**À quoi ça sert.** Deux files sur une page : « Trajets et membres » (signalés depuis une annonce ou un profil public, D68) et « Messages » (signalés depuis un fil, F-PR3). Un signalement **ne sanctionne rien tout seul** : le support ouvre la cible, masque le trajet ou propose une sanction si c'est justifié, puis revient marquer « Traité » ; « Sans suite » quand rien n'est à faire. L'auteur n'est jamais révélé à la cible, et il n'apprend pas la suite (RG-SIG-07).

**Qui y a accès.** `reports.review` : Médiateur, Support, super administrateur.

**File « Trajets et membres » (`GET /admin/reports?status=`).** Onglets à traiter / traité / sans suite, total. Une carte par signalement : badge rouge « Prioritaire · n ouverts », motif (Contenu illicite, Tentative d'arnaque, Comportement inapproprié, Usurpation d'identité, Autre), auteur (prénom) et date, type de cible (Trajet / Membre), badge de **niveau de risque interne** du membre visé ou du propriétaire du trajet (« À surveiller » ambre, « À risque » rouge ; Standard et Compte neuf ne sont pas affichés), cible cliquable (corridor → fiche trajet, prénom nom → fiche membre), « publié par … » (propriétaire), précisions, note pour le journal (facultative), « Traité », « Sans suite ».

**Priorité (RG-SIG-08, RG-TRU-06).** Une ligne est prioritaire à partir de **3 signalements ouverts** sur la même cible (tous auteurs, `REPORT_REVIEW_THRESHOLD = 3`, classe C du catalogue tant qu'il n'a qu'un consommateur) **ou** dès que le membre visé est `HIGH_RISK`, même avec un seul signalement.

**File « Messages » (`GET /admin/conversations/reports?status=`).** Motif (Veut sortir de Yamba, Tentative d'arnaque, Propos déplacés / harcèlement, Autre), auteur du signalement et son rôle, corridor, citation du message signalé (auteur, rôle, date, texte), précisions, liens « Lire la conversation → » et « Fiche de … → », note, « Traité », « Sans suite ».

**Gestes.**

| Bouton | Règle | Effet | Journal |
|---|---|---|---|
| « Traité » | Signalement `OPEN`, sinon 409 « This report has already been reviewed. » ; décision + journal dans **une** transaction (`updateMany` conditionnel) | Statut `REVIEWED` ; sort de « à traiter » | `REPORT_REVIEWED` (trajets et membres) ou `MESSAGE_REPORT_REVIEWED` (messages), avec la note |
| « Sans suite » | Idem | Statut `DISMISSED` | Idem |

Un signalement de message envoyé à `PATCH /admin/reports/:id` répond 404 : il reste dans le message-service. Aucun email n'est envoyé à la décision (déduit du code ; l'accusé de réception à l'auteur part à la création côté membre).

Sources : `apps/admin-ui/src/components/ReportsQueue.tsx`, `apps/admin-ui/src/components/MessageReportsQueue.tsx`, `apps/admin-ui/src/app/(back)/reports/page.tsx`, `apps/auth-service/src/services/report.service.ts`, `packages/libs/api-contracts/src/admin/reports.schema.ts`, RG-FCH-19 → 21, RG-SIG-05 → 09, recette FCH24, FCH26, SIG6–SIG8, TRU6.

### 6.16 Paramètres de la plateforme (`/settings`)

**À quoi ça sert.** « Telama peut ajuster un paramètre seul » (jalon 2). La commission, les planchers, les fenêtres d'annulation et de notation, les délais de la messagerie, les seuils d'alerte, les durées de conservation, les plafonds des comptes neufs se règlent en ligne, avec des explications, sans jamais exposer ce qui protège la plateforme, et sans faux bouton : **un curseur n'existe que si le code le lit** (RG-PAR-01).

**Qui y a accès.** Lecture `settings.read` : tous les profils sauf PRIVACY. Écriture **par clé, selon la portée** : métier = super administrateur seul (`settings.business.write`), exploitation = OPS ou super administrateur (`settings.operations.write`). Les quatre routes sont sous `settings.read` ; la portée se juge dans le service, clé par clé, **avant toute écriture** (une requête peut mêler les deux portées : 403 « Your admin profile cannot change: clé, clé. »).

**Les trois classes (RG-PAR-01).**

| Classe | Où | Ce que l'écran en fait |
|---|---|---|
| A — réglable en ligne | `SETTINGS_CATALOG` (49 clés, 12 groupes) | Une ligne par clé, saisie bornée |
| B — modifiable par déploiement seulement | `FIXED_PARAMETERS` (invariants de sécurité) | Bloc « Modifiables par déploiement seulement », lecture seule |
| C — prévue, pas encore lue par le code | `PLANNED_PARAMETERS` (noms du §13 des règles métier) | Absente de la page, listée dans la documentation |

**Ce qu'on voit.** En tête : version du document, dernière écriture (date, admin), « toutes les valeurs sont celles par défaut » ou « n valeur(s) modifiée(s) », bouton « Tout réinitialiser (n) ». Puis, par groupe (Prix et commission, Garantie Yamba, Annulation, Notation, Litiges, Réputation, Messagerie, Alertes d'exploitation, Documents, Données personnelles, Conservation, Confiance) :

| Colonne | Contenu |
|---|---|
| Paramètre | Libellé (clic → panneau : description, exemple, bornes, services lecteurs, avertissement CGU), règle source, mention « figure dans les CGU » |
| En vigueur | Valeur formatée (12 %, 3,00 €, 0.5 kg, × 1.1, 48 h, 14 j, 15 min, 4.8 / 5, 5 Mo), badge ambre « modifiée » si différente du défaut |
| Nouvelle valeur | Saisie numérique bornée (euros pour les cents, %, unité), « annuler », aperçu chiffré ; sinon « super administrateur seul » / « Exploitation ou super administrateur » |
| Défaut | La valeur du code, lien « remettre » |
| Portée | métier / exploitation |
| historique | Le journal filtré sur la clé : date, admin, modifié / remis par défaut, avant → après, motif |

**Gestes.**

| Bouton | Règle | Effet | Journal | Email |
|---|---|---|---|---|
| Saisir une ou plusieurs valeurs → panneau « À valider — n modification(s) » (diff avant → après, mention CGU) → motif ≥ 20 → « Enregistrer (journalisé, email aux super administrateurs) » | `PATCH /admin/settings { changes, reason, expectedVersion }` : 400 hors bornes (« Some values are out of bounds. »), clé inconnue, motif court, rien à changer ; **403 par portée** ; 400 cohérence (S ≤ M ≤ L, plafond de Garantie ≥ prime, top ≥ confirmé, intervalle de relance ≥ délai) ; **409 version** (« The settings changed meanwhile: reload and try again. ») | Document `PlatformSettings` (clé `current`) mis à jour, version +1 ; effet dans les 30 s sur tous les services (cache mémoire du lecteur) ; **jamais rétroactif** : une réservation garde le prix figé à sa création, un litige ouvert garde son échéance, le prix comparable d'un trajet déjà publié se recalcule par script (`backfill-comparable-price.ts`) | **Une ligne `SETTING_CHANGED` par clé** dans la même transaction (`{ key, before, after, reason, version }`, cible `SETTINGS`) | À **tous les super administrateurs** (dans leur langue) : « Paramètres de la plateforme modifiés » ; mention « Paramètres modifiés le … » sur l'accueil |
| « remettre » (une clé) puis Enregistrer | Même chemin que ci-dessus (c'est une modification comme une autre) | La clé revient à sa valeur par défaut | `SETTING_CHANGED` | Idem |
| « Tout réinitialiser (n) » → liste exacte des clés qui vont changer (avant → après, règle) → motif ≥ 20 → « Confirmer la réinitialisation » | `POST /admin/settings/reset { keys, reason, expectedVersion }` : seules les clés que **le profil peut écrire** et qui s'écartent du défaut ; 400 si rien à remettre | Toutes ces clés reviennent au défaut, version +1 | `SETTINGS_RESET` par clé | « Paramètres de la plateforme réinitialisés » |
| Sur 409 | — | La page se recharge, les saisies en attente sont perdues, la modification est à refaire (RG-PAR-07) | — | — |

**Ce qu'il faut savoir avant de toucher une clé.**
- Les clés marquées « figure dans les CGU » (commission, plancher, prix minimum, prime et plafond de Garantie, fenêtre et retenue d'annulation, fenêtre de notation) demandent une **mise à jour du texte des CGU** : la page prévient, il n'y a pas de mécanisme de publication (RG-PAR-10).
- Le wizard de réservation lit les paramètres de prix par `GET /trips/pricing/params` (public, cache 30 s) ; si un paramètre change entre l'affichage et le paiement, le total attendu ne correspond plus et l'Expéditeur revoit le prix (RG-PAR-08).
- Une base de paramètres vide ou illisible reproduit exactement le comportement d'origine (repli sûr, RG-PAR-06) ; la remise QA se fait par `seed-settings.ts` (`--show` pour inspecter), qui **ne touche jamais le journal**.

Sources : `apps/admin-ui/src/components/PlatformSettingsEditor.tsx`, `apps/auth-service/src/services/platform-settings.service.ts`, `packages/libs/api-contracts/src/admin/platform-settings.schema.ts`, `packages/libs/settings`, RG-PAR-01 → 10, registre D62, recette PAR1–PAR12.

### 6.17 Documentation des paramètres (`/settings/docs`)

**À quoi ça sert.** Le même texte que les info-bulles, rendu comme un document, **à une seule source** (le catalogue) : « Comment ça marche » (portées, motif, journal, email, effet 30 s, jamais rétroactif, bornes et cohérence, repli sûr), puis chaque groupe avec, par clé, libellé, description, exemple, bornes, unité, portée, règle source, services lecteurs ; le bloc de classe B ; la liste de classe C. Le fichier `context/YAMBA-PARAMETRES.md` est généré du même catalogue (`npm run settings-doc`). Lecture `settings.read`, aucun geste.

Sources : `apps/admin-ui/src/components/SettingsDocumentation.tsx`, `scripts/generate-settings-doc.ts`, `context/YAMBA-PARAMETRES.md`.

### 6.18 Données personnelles (`/privacy`)

**À quoi ça sert.** Le registre des demandes RGPD (export, effacement) : **la preuve du délai légal d'un mois** (RG-RGP-07). L'effacement à la demande d'un membre se fait depuis sa fiche (§6.4) ; cette page ne fait que lire, et la consultation est journalisée (`DATA_REQUESTS_VIEWED`, `after: { rows }`).

**Qui y a accès.** `privacy.requests.read` : PRIVACY et super administrateur.

**Ce qu'on voit.** Les plus récentes d'abord, par curseur : membre (prénom + initiale, ou « Membre supprimé »), type (Export / Effacement), canal (par le membre / par l'admin — avec le nom de l'admin), statut (faite / refusée), motifs de refus traduits (deal en cours, demande en attente, versement dû / en échec, retenue en médiation, trajet publié, profil admin), motif saisi par l'admin, demandé le, terminé le.

**Ce que fait un effacement (RG-RGP-04, D63 4A).** Une seule transaction dans l'auth-service : `User` → prénom « Membre », nom « supprimé », email `erased+<id>@anonymised.invalid`, slug `deleted-<id>` (jamais null sur un unique), mot de passe, téléphones, genre, date de naissance, TOTP, rôles client effacés, `isDeleted` + `deletedAt` ; `CarrierPage` anonymisée et `stripeAccountId` **déplacé** dans `ErasedAccount` (obligations comptables ; le compte Stripe Connect n'est pas supprimé) ; supprimés : adresses, identités OAuth, avatar, abonnements, alertes route, favoris, notifications, justificatifs de trajet (fichiers ImageKit compris) ; **conservés** : réservations, litiges, avis (« Membre supprimé »), messages (pièce du dossier, RG-FCH-24), rendez-vous, révélations de numéro, signalements, journal admin ; `ConsentLog` gardé sans IP ni user-agent ; sessions révoquées ; email de confirmation sans lien à l'ancienne adresse. Après : plus aucun email ne part (`isDeleted` respecté par tous les résolveurs), la connexion répond 401 `ACCOUNT_DELETED`.

**Le tiers destinataire (RG-RGP-06).** Nom, téléphone, email du destinataire d'une réservation sont effacés par le cron `recipient-redaction` (deal-service, 03:40) `privacy.recipientRetentionDays` jours (défaut 30) après la fin du deal ; jamais avant. Le lien de suivi destinataire (D69) meurt en même temps.

Sources : `apps/admin-ui/src/components/DataRequestsList.tsx`, `apps/auth-service/src/controller/privacy.controller.ts`, `apps/auth-service/src/services/privacy.service.ts`, `packages/libs/api-contracts/src/admin/admin-privacy.schema.ts`, RG-RGP-03 → 08, recette RGP6, RGP8–RGP10, RGP12.

### 6.19 État des services et maintenance (`/status`)

**À quoi ça sert.** Répondre à « est-ce nous, et où ? » quand on a la page sous les yeux ; fermer proprement la plateforme le temps d'une intervention. **Ce n'est pas une supervision** (RG-MNT-06) : Sentry garde les erreurs, le moniteur externe (D70) prévient quand personne ne regarde.

**Qui y a accès.** Lecture `status.read` : **tous** les profils. Maintenance `maintenance.write` : OPS et super administrateur (les autres lisent « Profil Exploitation ou super administrateur pour modifier »).

**Ce qu'on voit (relu toutes les 30 s).**

| Bloc | Contenu |
|---|---|
| Bandeau | « Tous les services répondent et leurs dépendances sont saines » (vert) ou « n service(s) en difficulté : … » (rouge), « Relu il y a n s » |
| Services (six cartes : gateway, auth, trip, deal, notification, message) | Vert « OK » (version, démarré il y a n min, ✓ mongo (ms), ✓ redis (ms)) ; ambre « Dégradé » (une dépendance ✗ avec l'erreur) ; rouge « Injoignable — erreur ». Chaque `/health` répond toujours HTTP 200 avec `ok` / `degraded`, 2 s par vérification |
| Outbox | Événements non publiés, âge du plus ancien, **parqués** (≥ `alerts.outboxParkedAttempts` tentatives) en rouge |
| Emails (24 h) | Envoyés, en échec (rouge si > 0) |
| Crons — dernier battement | Service, nom + expression cron, dernier passage (« il y a … », « en retard ? » en ambre si le battement a plus de deux fois l'intervalle attendu), durée, résultat (résumé lisible ou « échec — erreur » en rouge). Vide : « Aucun battement enregistré : les crons n'ont pas encore tourné depuis le déploiement (ou Redis est vide) » |
| Maintenance | État, badge « forcée par l'environnement du gateway », dernière modification (date, admin, version), éditeur |

**Les crons qui battent (`yamba:cron:<service>:<nom>`, TTL 7 j).**

| Service | Cron | Expression | Ce qu'il fait |
|---|---|---|---|
| auth-service | `onboarding-reminder` | `0 * * * *` | Relance d'onboarding Voyageur |
| trip-service | `complete-trips` | `15 3 * * *` | Termine les trajets passés |
| deal-service | `expire-bookings` | `*/5 * * * *` | Expire les demandes sans réponse |
| deal-service | `payout-bookings` | `*/5 * * * *` | Versements J+4 et rejeu des échecs |
| deal-service | `rating` | `17 * * * *` | Relances et révélations de notes |
| deal-service | `ops-alerts` | `5 * * * *` | Alertes de seuil → email support |
| deal-service | `ops-digest` | `0 8 * * *` | Récapitulatif quotidien « argent à surveiller » |
| deal-service | `recipient-redaction` | `40 3 * * *` | Effacement du tiers destinataire |
| deal-service | `outbox-retention` | `55 3 * * *` | Purge des événements publiés (`booking`) |
| message-service | `unread-reminder` | `*/5 * * * *` | Relance email des messages non lus |
| message-service | `conversation-retention` | `30 3 * * *` | Purge des conversations |
| message-service | `outbox-retention` | `55 3 * * *` | Purge des événements publiés (`conversation`) |
| notification-service | `retention` | `50 3 * * *` | Purge notifications, traces d'emails, événements consommés |

Un nouveau cron qui n'est pas enveloppé par `withHeartbeat` est **invisible** ici (règle de `CLAUDE.md`).

**L'éditeur de maintenance (RG-MNT-01 → 03).**

| Champ / bouton | Règle | Effet | Journal | Email |
|---|---|---|---|---|
| Case « Activer la lecture seule maintenant » | `maintenance.write`, motif ≥ 20, `expectedVersion` (409 « The maintenance state changed meanwhile… » → rechargement) | Document `PlatformSettings` clé `maintenance` ; le gateway le relit **toutes les 10 s** et répond **503 `MAINTENANCE` + `Retry-After: 300`** à toute écriture (POST / PUT / PATCH / DELETE) sauf `/api/auth/*`, `/api/admin/*`, `/api/maintenance` ; les lectures, la connexion et le back-office restent ouverts ; bandeau rouge sur les deux fronts ; la sonde publique répond 200 « maintenance » (une maintenance n'est pas une panne, RG-MON-02) | `MAINTENANCE_CHANGED` (`before` / `after` avec version et motif, cible `SETTINGS`) | À tous les super administrateurs : « Maintenance activée sur Yamba » |
| « Annoncer pour le (optionnel) » + messages FR / EN (≤ 300) → « Enregistrer l'annonce » | Idem | Bandeau ambre sur les deux fronts avant la coupure, **rien n'est bloqué** | Idem | « Maintenance planifiée sur Yamba » |
| « Lever la maintenance » | Idem | Écritures possibles dans les 10 s, bandeaux disparus | Idem | « Maintenance levée sur Yamba » |

Le second interrupteur, `MAINTENANCE_MODE=on` dans l'environnement du gateway (avec `MAINTENANCE_MESSAGE_FR/EN`), **l'emporte** sur la base — pour le jour où Mongo lui-même est la panne ; la page affiche alors le badge « forcée par l'environnement » et l'admin ne peut pas la lever depuis l'écran.

Sources : `apps/admin-ui/src/components/StatusView.tsx`, `apps/admin-ui/src/components/MaintenanceBanner.tsx`, `apps/auth-service/src/controller/admin-status.controller.ts`, `apps/auth-service/src/services/maintenance.service.ts`, `packages/libs/health`, `packages/libs/maintenance`, `packages/libs/redis/cron-heartbeat.ts`, `apps/*/src/cron/*.ts`, RG-MNT-01 → 07, RG-MON-01 → 05, recette MNT1–MNT9.

### 6.20 Journal d'audit (`/audit`)

**À quoi ça sert.** « Qui a fait quoi, sur quoi, quand. Écrit dans la même transaction que chaque geste. » C'est la mémoire du back-office ; il n'est jamais purgé.

**Qui y a accès.** `audit.read` : Finance et super administrateur. (Un Médiateur ou un Support voit les actions qui concernent un membre, un trajet ou un deal sur la fiche correspondante, pas le journal global.)

**Ce qu'on voit.** Les plus récentes d'abord, par curseur (« Charger la suite ») : quand, qui (prénom + initiale de l'admin), action libellée (voir §9), cible (`USER · id`, `BOOKING · id`, `TRIP · id`, `SETTINGS · clé`, `CONVERSATION · id`, `DISPUTE`, `SESSION`), détail (`after` en JSON brut), IP. Aucun filtre ni recherche : voir §13.

Sources : `apps/admin-ui/src/components/AuditTable.tsx`, `apps/auth-service/src/controller/admin-auth.controller.ts` (`listAdminAudit`), `packages/libs/admin-audit/src/index.ts`, RG-ADM-06, recette ADM9.

### 6.21 Comptes admin (`/admins`)

Décrit au §4 : liste (nom, email, profils cumulables à cocher, état « invitation en attente / 2FA active / 2FA à activer », date), « Retirer », formulaire « Inviter » (email, prénom, nom, profils avec leurs indices). Super administrateur seulement (`admins.manage`). Journal : `ADMIN_INVITED`, `ADMIN_ROLE_CHANGED`, `ADMIN_REVOKED`.

### 6.22 Mon compte admin et mes sessions

Il n'existe pas de page « Mon compte » : l'identité de l'admin (prénom, nom, profils cumulés) est dans la barre latérale, avec l'avertissement sur les codes de secours restants et « Se déconnecter ». La page « Mes sessions » (`/sessions`) liste les sessions admin du compte (ouverte le, active le, « cette session ») et permet de révoquer chacune (journal `ADMIN_SESSION_REVOKED`) ; une alerte email part à chaque ouverture de session (RG-ADM-16). Pas de changement de mot de passe, d'email ni de régénération de codes depuis l'admin (déduit du code : aucune route sous `/admin/me` autre que `me` et `sessions`) — le mot de passe d'un compte admin se change par le parcours **membre** (D65, sous sudo) puisque c'est le même `User`.

Sources : `apps/admin-ui/src/components/AdminShell.tsx`, `apps/admin-ui/src/components/SessionsList.tsx`, `apps/auth-service/src/routes/admin.router.ts`.

---

## 7. Cas de bout en bout

Format : étape / acteur / action / système / résultat / journal. Les prénoms sont ceux du seed (`seed-deals.ts`) quand un identifiant y correspond. « — » = aucune ligne de journal.

### Cas 1 — Un membre signalé trois fois

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Trois membres différents | « Signaler ce profil » sur le profil public de Thomas, motif « Arnaque » | `POST /reports` ×3 (cible USER par slug) ; doublon du même auteur refusé 409 | Trois accusés de réception « Merci, on regarde » ; Thomas n'apprend rien | — (geste membre) |
| 2 | Support (Sami) | Ouvre `/reports` | `GET /admin/reports?status=OPEN` compte 3 ouverts sur la cible | Ligne « Prioritaire · 3 ouverts », badge de risque si `WATCH` / `HIGH_RISK` | — |
| 3 | Sami | Clique la cible → fiche de Thomas | `GET /admin/users/:id` | Fiche, TrustScore (+8 par signalement ouvert), historique | `USER_VIEWED` |
| 4 | Sami | Carte Sanction : « Proposer » Restreint, motif de 20 caractères | `POST /admin/users/:id/suspension/propose` | Bandeau ambre, tuile « Sanctions proposées » | `USER_SUSPENSION_PROPOSED` |
| 5 | Médiateur (Nadia) | Même fiche, « Appliquer » | `POST /admin/users/:id/suspension` | Thomas ne peut plus publier ni réserver (403 `ACCOUNT_RESTRICTED`) ; email « Ton compte Yamba est restreint » ; email support s'il a des deals en cours | `USER_RESTRICTED` |
| 6 | Sami | Retour sur `/reports`, note « restreint le … », « Traité » ×3 | `PATCH /admin/reports/:id` ×3 | Les trois sortent de « à traiter » | `REPORT_REVIEWED` ×3 |

### Cas 2 — Un versement en échec depuis 48 h

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Cron `payout-bookings` | Tente le versement J+4 d'`ines` (compte Stripe non prêt) | `markPayoutFailed` : compteur, `payoutNextRetryAt` espacé | Deal en `FAILED`, file « Versements en échec » | — |
| 2 | Cron `ops-alerts` (h+5) | Évalue `PAYOUT_FAILED_48H` | Clé Redis `yamba:alerts:sent:…` posée | Email « Yamba — 1 alerte » au support | — |
| 3 | Finance (Léa) | Accueil : bandeau rouge « Versements en échec depuis plus de 48 h » → lien | `GET /admin/finances/queue?kind=FAILED` | Ligne avec « compte Stripe du Voyageur non prêt », 12 tentatives, prochaine relance | — |
| 4 | Léa | Ouvre la fiche argent, écrit à `ines` par le support pour finaliser Stripe | `GET /admin/deals/:id/money` | Compte Stripe « virements NON activés » | `DEAL_MONEY_VIEWED` |
| 5 | `ines` | Finalise son compte Stripe Express | — | `stripePayoutsEnabled = true` | — |
| 6 | Léa | « Relancer le versement » | `POST …/payout/retry`, même clé d'idempotence | « Versement envoyé », ligne sortie de la file, alerte disparue | `PAYOUT_RETRIED` (`outcome: SENT`) |

### Cas 3 — Un litige non décidé à J+3

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Expéditrice (Chinwe) | Ouvre le litige YAM-2042 après la livraison | Deal `DISPUTED`, versement gelé, email au Voyageur « donne ta version, 72 h » | Ticket en file « attend le Voyageur · 71 h » | — |
| 2 | Voyageur (Thomas) | Ne répond pas | — | À J+3 (72 h), `decidableAt` atteint : « sans réponse · à trancher » | — |
| 3 | Cron `ops-alerts` | `DISPUTE_UNDECIDED_72H` dès que le dossier est décidable depuis 72 h de plus (J+6) | Email au support | Bandeau critique « Litiges décidables sans décision » | — |
| 4 | Médiateur | Ouvre le dossier | `GET /admin/disputes/:id` | Bandeau ambre « délai passé, décision possible sans sa version » | `DISPUTE_VIEWED` |
| 5 | Médiateur | Rejet ou remboursement (ici partiel 15 €), motif ≥ 50, récapitulatif, « Valider définitivement » | `POST …/resolve` : remboursement d'abord, puis transaction, puis versement | « Décision enregistrée » ; deal COMPLETED ; Chinwe remboursée 15 € ; Thomas versé net − 15 € ; compteur « litiges perdus » de Thomas +1 ; aucune notation | `DISPUTE_RESOLVED` |
| 6 | Système | Outbox `booking.dispute_resolved` | notification-service | Écran, notification, email « Décision rendue » aux deux | — |

### Cas 4 — Lever une sanction

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Membre suspendu | Écrit au support avec ses explications | — | Dossier lu hors application | — |
| 2 | Médiateur | Fiche du membre : bandeau rouge « Suspendu depuis le … par … — motif » | `GET /admin/users/:id` | Boutons « Modifier la sanction » / « Lever » | `USER_VIEWED` |
| 3 | Médiateur | Motif ≥ 20 (« Explications reçues le …, engagement écrit »), « Lever » | `DELETE /admin/users/:id/suspension` | Compte `ACTIVE`, champs de sanction effacés ; trajets de retour dans la recherche ; connexion possible | `USER_REINSTATED` (`before: SUSPENDED`, `after: ACTIVE, reason`) |
| 4 | Système | Email | `accountReinstated` dans la langue du membre (sauf adresse supprimée) | « Ton compte Yamba est rétabli » | — |

### Cas 5 — Exporter les membres (données nominatives)

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Finance | `/users`, cherche le bouton d'export | `can(exports.personal)` faux | Aucun bouton ; un appel direct répond 403 | — |
| 2 | PRIVACY (ou super administrateur) | Filtre « Voyageur + Stripe prêt », « Exporter en CSV (données personnelles) » | Panneau : motif ≥ 20 | « Télécharger » inactif tant que le motif est court | — |
| 3 | PRIVACY | Motif « Demande de la comptabilité du … pour rapprochement KYC » → « Télécharger » | `GET /admin/users/export?…&reason=` ; ≤ 5 000 lignes ; BOM ; préfixes `=`, `+`, `-`, `@` neutralisés | Fichier `utilisateurs-<date>.csv` avec email et téléphone | `EXPORTED` (`domain: users, personal: true, reason, filters, rows`) |

### Cas 6 — Passer en lecture seule pour une maintenance

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | OPS | `/status`, « Annoncer pour le » ce soir 23:00, messages FR / EN, motif | `PUT /admin/maintenance { enabled: false, scheduledAt, … }` | Bandeau ambre sur user-ui et admin-ui ; rien n'est bloqué | `MAINTENANCE_CHANGED` |
| 2 | Système | Email | `maintenanceChanged` | « Maintenance planifiée sur Yamba » aux super administrateurs | — |
| 3 | OPS, 23:00 | Coche « Activer la lecture seule maintenant », motif, « Passer en lecture seule » | `PUT /admin/maintenance { enabled: true }` ; le gateway relit sous 10 s | 503 `MAINTENANCE` sur toute écriture membre ; lecture, connexion, admin ouverts ; `/api/status` → 200 « maintenance » ; moniteur externe silencieux | `MAINTENANCE_CHANGED` |
| 4 | Développeur | Déploie, vérifie `/status` (six cartes vertes) | — | — | — |
| 5 | OPS | « Lever la maintenance », motif | `PUT { enabled: false, scheduledAt: null }` | Écritures possibles dans les 10 s, bandeaux disparus | `MAINTENANCE_CHANGED` |

### Cas 7 — Changer la commission

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | OPS | `/settings`, ligne « Commission Yamba » | Portée métier | Colonne « super administrateur seul », pas de saisie | — |
| 2 | Super administrateur | Saisit 15 (%) ; lit le panneau (exemple, bornes 5–20, « figure dans les CGU ») | Diff « 12 % → 15 % », aperçu chiffré | Panneau « À valider — 1 modification » | — |
| 3 | Super administrateur | Motif « Alignement tarifaire décidé en comité du … », « Enregistrer » | `PATCH /admin/settings` : bornes OK, cohérence OK, version OK | « 1 paramètre(s) modifié(s) — version n » | `SETTING_CHANGED` (`key, before 12, after 15, reason, version`) |
| 4 | Système | Email + accueil | `settingsChanged` | « Paramètres de la plateforme modifiés » à chaque super administrateur ; mention sur l'accueil | — |
| 5 | Expéditeur, 30 s plus tard | Ouvre le wizard | `GET /trips/pricing/params` → `commissionPct: 15` | Le récapitulatif affiche 15 % ; les réservations déjà faites gardent 12 % | — |
| 6 | Super administrateur | Met à jour le texte des CGU | Hors application | — | — |

### Cas 8 — Restaurer les paramètres par défaut

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Super administrateur | « Tout réinitialiser (3) » | `resetDiff` = clés écartées du défaut **et** écrivables par le profil | Liste « Commission : 15 % → 12 % (défaut, D16 · COM-01) », … | — |
| 2 | Super administrateur | Motif, « Confirmer la réinitialisation » | `POST /admin/settings/reset { keys, reason, expectedVersion }` | « 3 paramètre(s) remis par défaut — version n », « toutes les valeurs sont celles par défaut » | `SETTINGS_RESET` ×3 |
| 3 | Système | Email | — | « Paramètres de la plateforme réinitialisés » | — |
| Variante | OPS | Même bouton | Seules les clés d'exploitation écartées apparaissent ; les clés métier restent | — | `SETTINGS_RESET` (exploitation) |

### Cas 9 — Effacer un compte sur demande (email reçu par le support)

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Membre | Écrit « supprimez mon compte » par email | — | Demande datée | — |
| 2 | PRIVACY | Fiche du membre, carte « Effacer ce compte (RGPD) », motif « Demande reçue par email le …, canal support », tape EFFACER | `POST /admin/users/:id/erase` → `erasureBlockers` | Si bloqué : 409, bandeau « Refusé pour l'instant : un deal en cours » ; `DataRequest` REFUSED avec les motifs | — (refus inscrit au registre, pas au journal — déduit du code) |
| 3 | PRIVACY, une fois le deal terminé | Recommence | Transaction d'anonymisation | « Compte effacé : identité et coordonnées supprimées, réservations conservées sans nom, journal écrit, email envoyé » | `ACCOUNT_ERASED` |
| 4 | Système | Après commit | Sessions révoquées, fichiers ImageKit supprimés, email « Ton compte Yamba a été supprimé » | Fiche « Membre supprimé », `erased+…@anonymised.invalid` | — |
| 5 | PRIVACY | `/privacy` | `GET /admin/privacy/requests` | Ligne « Effacement · par l'admin (Prénom I.) · faite » | `DATA_REQUESTS_VIEWED` |

### Cas 10 — Inviter un nouvel admin Support + Finance et le retirer plus tard

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Super administrateur | `/admins`, « Inviter » avec Support et Finance cochés | Compte sans rôle client, jeton 48 h | « Compte créé, invitation envoyée (48 h) » ; email « Ton accès au back-office Yamba » nommant « Support + Finance » | `ADMIN_INVITED` |
| 2 | Invité | Lien → mot de passe fort | `POST /auth/admin/invite/accept` | → `/login` | `ADMIN_INVITE_ACCEPTED` |
| 3 | Invité | Mot de passe → QR → code → codes de secours | `totp/setup`, `totp/enable` | Menu : À arbitrer, Billets, Trajets, Finances, Pilotage, Utilisateurs, Journal | `ADMIN_TOTP_ENABLED`, `ADMIN_LOGIN` |
| 4 | Super administrateur, six mois plus tard | « Retirer » sur sa ligne, confirmation | `DELETE /admin/admins/:id` | Profils vidés, TOTP effacé, sessions tombées (403 à sa prochaine requête) | `ADMIN_REVOKED` |

### Cas 11 — Vérifier un billet et le rejeter pour dates différentes

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Voyageur | Dépose un billet sur Paris → Brazzaville | Document `TICKET_PROOF` `PENDING` | Trajet « à vérifier », tuile « Billets à vérifier » +1 | — |
| 2 | Support | `/tickets`, « Ouvrir le billet » | `GET /admin/tickets/:documentId` | Document dans un nouvel onglet | `DOCUMENT_VIEWED` |
| 3 | Support | « Rejeter : Les dates ne correspondent pas au trajet » → « Rejeter » | `POST …/review { REJECT, DATES_MISMATCH }` | Document et trajet `REJECTED` ; email « Billet non validé » avec le motif | `TICKET_REJECTED` |
| 4 | Voyageur | Redépose le bon billet | `addDocuments` repasse le trajet `PENDING` | De retour dans la file | — |
| 5 | Support | « Valider » | `POST …/review { VERIFY }` | Badge « Billet vérifié » public ; email « Billet vérifié » ; un second clic → 400 | `TICKET_VERIFIED` |

### Cas 12 — Masquer une annonce douteuse puis la rétablir

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Support | Fiche trajet, « Proposer » avec motif | `POST …/hide/propose` | Bandeau ambre, tuile « Masquages proposés » | `TRIP_HIDE_PROPOSED` |
| 2 | Médiateur | `/trips?hideProposed=1` → fiche → « Masquer » | `POST …/hide` | Absent de la recherche, page publique 404, réservation `TRIP_NOT_BOOKABLE` ; réservations acceptées inchangées ; email générique au Voyageur ; bandeau rouge dans son espace | `TRIP_HIDDEN` (motif interne) |
| 3 | Voyageur | Corrige l'annonce, écrit au support | — | — | — |
| 4 | Médiateur | « Rétablir », motif | `DELETE …/hide` | Trajet de retour ; email « de nouveau visible » | `TRIP_UNHIDDEN` |

### Cas 13 — Un transfert renversé par Stripe

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Stripe | Webhook `transfer.reversed` (compte Voyageur fermé) | `markTransferReversed` | `payoutStatus = REVERSED`, file « Transferts renversés », tuile, alerte après 48 h | — |
| 2 | Finance | « Décider » → fiche argent | `GET …/money` | Formulaire ambre « Transfert renversé par Stripe » | `DEAL_MONEY_VIEWED` |
| 3 | Finance | Le Voyageur a rouvert un compte : « Re-verser », motif | `POST …/payout/reversal { RESENT }` : nouvelle clé d'idempotence, exécuteur | « Nouveau transfert envoyé » ; second clic → 400 « not an open reversal » | `PAYOUT_REVERSAL_RESOLVED` |
| Variante | Finance | Compte définitivement clos : « Abandonner » | `{ WRITTEN_OFF }` | « Renversement abandonné, clos » : manque à gagner assumé | `PAYOUT_REVERSAL_RESOLVED` |

### Cas 14 — Un remboursement manuel en deux gestes

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Support | Fiche argent d'un deal terminé, carte « Remboursement manuel », 5 €, motif ≥ 50 (« Geste commercial suite au retard signalé le … »), « Proposer » | Plafond = payé − déjà remboursé | Bandeau « Proposé : 5,00 € par … » ; tuile et file « Remboursements proposés » | `REFUND_MANUAL_PROPOSED` |
| 2 | Médiateur | Même fiche | Ni `propose` ni `apply` | Voit la proposition, aucun bouton | `DEAL_MONEY_VIEWED` |
| 3 | Super administrateur | « Rembourser maintenant » | `provider.refund` d'abord, puis transaction conditionnelle, outbox `booking.refund_issued` | « Remboursé 5,00 € (cumul 5,00 €) » ; le Voyageur garde son versement | `REFUND_MANUAL_APPLIED` |
| 4 | Système | Email standard | — | « Remboursement émis » à l'Expéditeur ; portefeuille « partiellement remboursé » | — |
| 5 | Super administrateur | Tente 40 € de plus au-delà du restant | 400 « At most n cents can still be refunded… » | Rien n'est écrit | — |

### Cas 15 — Rapprocher un deal avec Stripe et trouver un remboursement parti sans écriture

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Finance | Fiche argent, « Rapprocher maintenant » | `PaymentProvider.inspect` (lecture seule) | Divergence `REFUND_NOT_RECORDED` : « base 0 € · fournisseur 20 € » | `DEAL_RECONCILED` (`divergences: [REFUND_NOT_RECORDED]`) |
| 2 | Finance | Note la divergence, ouvre « Charger la chronologie » | `GET …/history` | Un événement `booking.refund_issued` parqué, ou aucun : la cause se lit | `DEAL_HISTORY_VIEWED` |
| 3 | Développeur | Réparation manuelle documentée (hors écran) | — | Le rapprochement ne corrige jamais | — |

### Cas 16 — Une conversation à lire depuis un signalement de message

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Expéditrice | Drapeau sur un message du Voyageur, « Veut sortir de Yamba » | `POST /messages/conversations/:id/messages/:mid/report` ; doublon 409 | « Merci, le signalement est transmis » | — |
| 2 | Support | `/reports#messages` | `GET /admin/conversations/reports?status=OPEN` | Carte avec le message cité | — |
| 3 | Support | « Lire la conversation → » | `GET /admin/conversations/by-deal/:bookingId` | Fil entier, rendez-vous, « Personne n'a encore vu le numéro » ; jamais le numéro | `CONVERSATION_VIEWED` |
| 4 | Support | Retour, note « rappel à l'ordre envoyé », « Traité » | `PATCH …/reports/:id` | Sort de « à traiter » ; second traitement → 409 | `MESSAGE_REPORT_REVIEWED` |

### Cas 17 — Suspendre un membre qui a des deals en cours

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Médiateur | Fiche, « Suspendu », motif, « Appliquer » | Transaction + `revokeRefreshJti` | Déconnecté partout ; « Ton compte est suspendu » à la connexion ; trajets hors recherche | `USER_SUSPENDED` |
| 2 | Système | Deals en cours détectés (2) | `notifySupportOfActiveDeals` | Email « [Yamba ops] SUSPENDED : Prénom Nom a 2 deal(s) en cours » avec la liste (id, statut, corridor, ticket) | — |
| 3 | Support | Ouvre chaque deal (fiche argent, dossier) et arbitre au cas par cas | — | Les deals continuent ou passent en médiation selon les faits | `DEAL_MONEY_VIEWED`, … |

### Cas 18 — Un compte neuf refusé à la réservation, lu depuis la fiche

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Membre créé hier | Réserve un colis de 450 € déclarés | `assertWithinCaps` : `NEW` → 409 `NEW_ACCOUNT_CAP` avant paiement | « Ton compte est récent … le plafond se lève avec tes premiers envois terminés » | — |
| 2 | Membre | Appelle le support | — | — | — |
| 3 | Support | Fiche : carte « Risque interne » | Score calculé à la lecture | « Compte neuf · score n/100 », plafonds « 300 € · 10 kg · 5 envois / mois (compte neuf) » | `USER_VIEWED` |
| 4 | Support | Explique ; aucune levée manuelle possible (déduit du code : pas de dérogation) | — | Le plafond tombe après 3 deals terminés ou `trust.newAccountDays` jours | — |
| Variante | Super administrateur | Relève `trust.newAccount.maxDeclaredValueCents` à 500 € | `SETTING_CHANGED` | Effet dans les 30 s pour tous les comptes neufs | `SETTING_CHANGED` |

### Cas 19 — Une adresse email en rebond dur

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Resend | Webhook `email.bounced` (rebond dur) | `User.emailSuppressedAt` posé | Plus aucun email au membre ; notification in-app continue ; l'alerte « emails en échec » compte le rebond | — |
| 2 | Membre | Corrige son adresse (parcours membre D65) puis appelle le support | — | — | — |
| 3 | Support | Fiche : bandeau ambre « Adresse sur la liste de suppression … (rebond dur) », « Lever (adresse corrigée) » | `DELETE /admin/users/:id/email-suppression` | Bandeau disparu, les emails repartent | `EMAIL_SUPPRESSION_LIFTED` |

### Cas 20 — Une retenue d'annulation tardive à arbitrer

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Expéditrice | Annule après le départ, sans prise en charge | Retenue 50 % conservée « à arbitrer » | Ligne « Retenue » dans À arbitrer et dans Finances › Retenues ; alerte après 7 j | — |
| 2 | Médiateur | Dossier | `GET /admin/disputes/:id` | Deux issues aux montants serveur | `DISPUTE_VIEWED` |
| 3 | Médiateur | « Compensation au Voyageur (prorata) », motif, récapitulatif, valider | `POST …/retention { COMPENSATE_CARRIER }` | Voyageur : compensation versée ; Expéditrice : « la retenue est conservée » ; sortie de la file | `RETENTION_ARBITRATED` |

### Cas 21 — Un corridor demandé sans offre

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Visiteurs | Cherchent « Paris → Kinshasa » (aucun trajet) trois fois | `recordSearch` Redis, `hadResults = false` | — | — |
| 2 | Finance | `/pilotage`, Corridors 7 jours | `GET /admin/pilotage/corridors?days=7` | Ligne ambre « paris → kinshasa · 0 trajet · 3 recherches · 3 sans résultat · demande sans offre » | — |
| 3 | Fondateur | Recrute des Voyageurs sur ce corridor | Hors application | — | — |

### Cas 22 — Un relais outbox en retard (Redpanda arrêté)

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Membre | Réserve alors que Redpanda est arrêté | Événement écrit dans l'outbox, non publié | Aucune notification ni email ne part | — |
| 2 | Cron `ops-alerts` (16 min plus tard) | `OUTBOX_LAGGING_15MIN` | Email au support | Bandeau critique « Relais outbox en retard … Redpanda ou le relais est arrêté ? » | — |
| 3 | OPS | `/status` | Outbox « n non publié(s), le plus ancien il y a 16 min » | Diagnostic | — |
| 4 | OPS | Redémarre Redpanda | Le relais publie | Alerte disparue à la lecture suivante ; fiche « Chronologie » du deal : événements « publié » | — |

### Cas 23 — Un cron muet

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Moniteur externe | Battement `deal-service:payout-bookings` manquant | `CRON_HEARTBEAT_PING_URLS` | Alerte push / email au fondateur | — |
| 2 | OPS | `/status`, tableau des crons | `listCronRuns` | Ligne `payout-bookings` ambre « en retard ? » (dernier battement > 2 × 5 min) ou absente | — |
| 3 | OPS | Vérifie la carte deal-service (rouge « Injoignable » ?) et `BOOKING_PAYOUT_CRON_ENABLED` | — | Redémarrage du service ou correction de l'env | — |
| 4 | OPS | Attend le tick suivant | `withHeartbeat` | Ligne verte « n versement(s) … », battement externe reparti | — |

### Cas 24 — Fin de mois : rapport et export finances

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Finance | `/finances/report`, période 3 mois | `GET /admin/finances/report?months=3` | Passifs du jour par devise ; tableau par mois | — |
| 2 | Finance | Vérifie que « renversé à décider » et « retenues à arbitrer » sont à zéro ; sinon traite les files | — | Passifs soldés avant clôture | … |
| 3 | Finance | Export du 1er au dernier jour du mois, « Télécharger le CSV » | `GET /admin/finances/export?from&to` (≤ 366 j) | `yamba-finances-<du>-<au>.csv`, une ligne par deal ayant bougé, identifiants Stripe | `FINANCE_EXPORTED` (`from, to, rows, filename`) |
| 4 | Comptable | Rapproche avec l'export Stripe (frais du fournisseur) | Hors application | — | — |

### Cas 25 — Un admin qui a perdu son application d'authentification

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Admin | Connexion : mot de passe OK, plus de TOTP, plus de code de secours | 5 codes faux → 15 min de blocage | « Trop de tentatives » | `ADMIN_LOGIN` absent |
| 2 | Super administrateur | `/admins`, « Retirer » sur sa ligne | `DELETE /admin/admins/:id` : TOTP effacé | Compte sans profil | `ADMIN_REVOKED` |
| 3 | Super administrateur | « Inviter » la même adresse avec ses profils | Compte existant : profils posés, email « Accès au back-office Yamba accordé » | Le mot de passe est conservé | `ADMIN_INVITED` (`existingAccount: true`) |
| 4 | Admin | Connexion → écran QR (nouveau secret) → nouveaux codes de secours | `totp/setup`, `totp/enable` | Accès rétabli | `ADMIN_TOTP_ENABLED`, `ADMIN_LOGIN` |

### Cas 26 — Deux administrateurs modifient les paramètres en même temps

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Super administrateur A | Ouvre `/settings` (version 4), change la retenue d'annulation | — | Panneau « À valider » | — |
| 2 | OPS B | Ouvre `/settings` (version 4), change un seuil d'alerte, enregistre | `updateMany({ key, version: 4 })` → version 5 | « 1 paramètre modifié — version 5 » | `SETTING_CHANGED` |
| 3 | A | Enregistre | `expectedVersion: 4` ≠ 5 → 409 | « Les paramètres ont changé entre-temps : la page est rechargée, refais ta modification » | — |
| 4 | A | Refait sa saisie sur la version 5, enregistre | → version 6 | OK | `SETTING_CHANGED` |

### Cas 27 — Un Support tente d'appliquer une sanction par appel direct

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Support | `POST /admin/users/:id/suspension` (curl avec son cookie admin) | `requireAdminPermission("users.suspension.apply")` | 403 explicite ; rien n'est écrit | — |
| 2 | Support | `POST …/suspension/propose` sur sa propre fiche | `loadTarget` | 403 « You cannot act on your own account. » | — |
| 3 | Support | `POST …/suspension/propose` sur un compte qui porte un profil admin | `isSuperAdmin` faux | 403 « Only a super administrator can act on an admin account. » | — |

### Cas 28 — Lire tout ce qui est arrivé à un deal quand un membre appelle

| # | Acteur | Action | Système | Résultat | Journal |
|---|---|---|---|---|---|
| 1 | Support | `/users`, tape « YAM-2041 » | Recherche par ticket, filtres ignorés | Les deux parties | — |
| 2 | Support | Fiche du membre → ligne du deal → « argent » | `GET …/money` | Fiche argent | `DEAL_MONEY_VIEWED` |
| 3 | Support | « Charger la chronologie » | `GET …/history` (`deals.history.read`) | Événements avec état de relais, actions admin, notifications, emails, dans l'ordre ; « n parqué(s) — relais à réparer » en rouge s'il y en a | `DEAL_HISTORY_VIEWED` |
| 4 | Support | Répond au membre avec les dates exactes (email envoyé le …, notification lue…) | — | — | — |

---

## 8. Règles de gestion consolidées

Les règles reprennent la numérotation de `context/YAMBA-DOC-METIER.md`. Les règles marquées **(déduite du code)** ne figurent dans aucun document et ont été lues dans le code ; les règles marquées **(révisée)** ont un texte documentaire dépassé par le code.

### 8.1 Accès et comptes (RG-ADM)

| Règle | Énoncé |
|---|---|
| RG-ADM-01 | Le rôle ADMIN ne s'obtient que par un script sur le poste de l'opérateur ou par l'invitation d'un super administrateur ; jamais par l'inscription. |
| RG-ADM-02 | Aucune session admin sans double authentification (mot de passe puis TOTP) ; l'activation est imposée à la première connexion. |
| RG-ADM-03 | Huit codes de secours, montrés une seule fois, à usage unique ; avertissement à deux codes ou moins. |
| RG-ADM-04 | Un code TOTP ne sert jamais deux fois dans le même pas de 30 s ; cinq échecs → quinze minutes. |
| RG-ADM-05 | Session admin courte : 15 min d'accès, 45 min d'inactivité, 12 h de vie, pas de « rester connecté » ; distincte de la session membre. |
| RG-ADM-06 | Chaque geste est journalisé dans la même transaction (qui, quoi, sur quoi, avant, après, d'où) ; les lectures sensibles aussi ; un geste dont le journal ne s'écrit pas n'a pas lieu. |
| RG-ADM-09 (révisée) | **Six** profils cumulables (SUPER_ADMIN, MEDIATOR, SUPPORT, FINANCE, OPS, PRIVACY) ; au moins un super administrateur ; le dernier ne peut être ni rétrogradé ni retiré ; personne n'agit sur son propre compte admin. |
| RG-ADM-10 | Un compte admin créé par invitation naît sans rôle client ; mot de passe par lien de 48 h ; 2FA à la première connexion. |
| RG-ADM-11 | Conflit d'intérêts : un admin ne tranche jamais un deal dont il est partie, n'agit jamais sur son propre compte, trajet ou billet, et ne sanctionne un autre admin que s'il est super administrateur. Le serveur refuse (403). |
| RG-ADM-12 | Deux niveaux de sanction, motivés (≥ 20 caractères), réversibles, à durée optionnelle : Restreint (ni publier ni réserver, deals en cours continuent) et Suspendu (connexion refusée, sessions fermées, trajets invisibles, deals en cours signalés au support). |
| RG-ADM-13 | Le Support propose, le Médiateur ou le super administrateur exécute. |
| RG-ADM-14 | Le membre sanctionné reçoit un email au motif générique et l'adresse pour contester ; un email « rétabli » à la levée. Aucun email n'est envoyé à une adresse supprimée (D35). |
| RG-ADM-15 | La fiche montre tout ce qui sert à opérer, rien de secret : jamais un mot de passe, un secret 2FA, un code de livraison ; identifiant Stripe masqué. |
| RG-ADM-16 | Chaque ouverture de session admin déclenche une alerte email ; l'admin liste et révoque ses sessions. |
| RG-ADM-17 | Les erreurs serveur remontent à Sentry avec le service et l'identifiant de corrélation dès qu'un DSN est posé. |
| RG-ADM-18 | La file des billets ne montre que des trajets à venir ; un billet en attente sur un trajet parti passe EXPIRED à la lecture. |
| RG-ADM-19 | Ouvrir un billet est journalisé (donnée personnelle). |
| RG-ADM-20 | Une décision sur un billet est valider, ou rejeter avec un motif fermé (ILLEGIBLE, DATES_MISMATCH, NAME_MISMATCH, SUSPICIOUS) ; email dans la langue du Voyageur ; redépôt possible ; une décision par document. |
| RG-ADM-21 | Le billet reste informatif : rien n'est bloqué faute de billet vérifié. |
| RG-ADM-22 | « Masqué par Yamba » n'est ni une pause ni une annulation : invisible en recherche et page publique, non réservable, réservations en cours préservées, Voyageur prévenu au motif générique, réversible avec motif. |
| RG-ADM-23 | Yamba n'annule jamais un trajet à la place du Voyageur. |
| RG-ADM-24 | Le Support vérifie les billets et propose un masquage ; le Médiateur ou le super administrateur masque et rétablit. |
| RG-ADM-25 | L'accueil compte ce qui attend, selon le profil ; un compteur n'apparaît que si le profil peut ouvrir la file. |
| RG-ADM-26 → 29 | Cumul de profils : union des permissions, profil principal affiché, invitation et modification par cases, retrait vide tous les profils, gardes inchangées, comptes d'avant repris par script. |
| RG-ADM-30 | Chaque liste admin se filtre côté serveur, se trie et se pagine par curseur ; une recherche par identifiant de deal ou ticket renvoie les deux parties sans autre filtre. |
| RG-ADM-31 | Un export est un CSV des lignes filtrées, borné à 5 000, journalisé (domaine, filtres, nombre de lignes). |
| RG-ADM-32 | Les exports de trajets, billets et dossiers ne portent ni email ni téléphone (identifiants seulement) ; Finance et Médiateur les téléchargent. |
| RG-ADM-33 (révisée) | L'export des utilisateurs est nominatif : super administrateur **ou profil PRIVACY** (A143), motif ≥ 20 au journal ; préfixes de formule neutralisés. |
| RG-ADM-34 (déduite du code) | La tuile « Invitations admin en attente » compte les comptes admin sans mot de passe ; elle n'est servie qu'au super administrateur. |
| RG-ADM-35 (déduite du code) | Une proposition de sanction n'existe que sur un compte ACTIVE ; l'application efface la proposition ; « Modifier la sanction » réécrit niveau, motif et durée. |
| RG-ADM-36 (déduite du code) | Le retrait d'un admin efface son secret TOTP et ses codes de secours : c'est aussi la procédure de réinitialisation 2FA. |

### 8.2 Médiation (RG-MED)

| Règle | Énoncé |
|---|---|
| RG-MED-01 | Le Voyageur donne sa version dans l'application, une seule fois (≥ 50 caractères, ≤ 5 photos) ; l'Expéditeur apprend qu'une version existe, jamais son contenu. |
| RG-MED-02 (révisée) | Une décision n'est possible qu'après la version du Voyageur, ou `dispute.responseDelayHours` (défaut 72 h) après l'ouverture ; l'API refuse avant (409 avec la date). |
| RG-MED-03 | Trois issues pour un litige : rejet, remboursement partiel (0,01 à total − 0,01 ; Voyageur = net − montant, plancher 0), remboursement total (commission comprise, Voyageur rien). |
| RG-MED-04 | Deux issues pour une retenue : compensation au Voyageur (prorata de sa part nette) ou restitution à l'Expéditeur, montants calculés serveur. |
| RG-MED-05 | Toute décision porte un motif ≥ 50 caractères lu par les deux parties, passe par un récapitulatif des flux, est définitive dans l'application ; recours par email. |
| RG-MED-06 | L'argent suit l'ordre remboursement puis versement ; un versement en échec est rejoué par le cron, jamais bloquant. |
| RG-MED-07 | Un deal clos par médiation ne se note pas ; le litige tranché incrémente « litiges perdus » sur la partie condamnée, visible de l'admin seul. |
| RG-MED-08 | Les deux parties sont prévenues (écran, notification, email) avec l'issue, le montant qui les concerne et le motif. |
| RG-MED-09 (déduite du code) | Une seule décision par dossier : la seconde répond 409 ; le dossier sort de la file. |

### 8.3 Finances admin (RG-FIN)

| Règle | Énoncé |
|---|---|
| RG-FIN-06 | Un versement en échec est rejoué tout seul, de plus en plus espacé (5 min la première demi-heure, 30 min, 2 h, chaque jour), sans jamais se taire, et reste visible en file. |
| RG-FIN-07 | « Relancer » est le même versement (même montant, même clé) ; un double clic ne verse pas deux fois. |
| RG-FIN-08 | Un transfert renversé ne repart jamais seul : décision motivée (≥ 20), re-verser (nouvelle clé, tracé) ou abandonner (manque à gagner assumé, tracé). |
| RG-FIN-09 | La fiche argent montre tout ce qui a été posé, rien d'inféré ; identifiants fournisseur en clair pour la finance, compte Stripe du Voyageur masqué. |
| RG-FIN-10 | Le rapprochement compare, il ne corrige pas ; toute correction est un geste humain journalisé. |
| RG-FIN-11 | Personne n'agit sur un deal dont il est partie ; Finance et Médiateur relancent et clôturent ; le Support ne voit pas les finances. |
| RG-FIN-12 | Chaque lecture de fiche argent, rapprochement, relance, clôture laisse une ligne au journal. |
| RG-FIN-13 | Le message brut du fournisseur n'est lu que par l'admin. |
| RG-FIN-14 | Le rapport date chaque fait à sa propre date ; un deal peut compter dans deux mois ; par devise, mois UTC. |
| RG-FIN-15 | Le revenu reconnu = commission + prime des deals terminés ; retenue conservée, versement dû, renversement, remboursement proposé sont des passifs ; frais Stripe hors Yamba. |
| RG-FIN-16 | L'export finances est réservé au profil Finance, borné à 366 jours, journalisé (période, lignes). |
| RG-FIN-17 | Un remboursement manuel est un geste commercial : deal terminé ou annulé, débité, plafond = payé − déjà remboursé, motif ≥ 50 ; Finance ou Support propose, le super administrateur seul applique ; le Voyageur garde son versement. |
| RG-FIN-18 | L'Expéditeur est prévenu par l'email standard de remboursement et le voit dans son portefeuille. |
| RG-FIN-19 (déduite du code) | `allowedActions` est calculé serveur (état du deal, bornes, conflit d'intérêts) ; le front ne fait que refléter. |

### 8.4 Pilotage et alertes (RG-PIL, RG-ALR)

| Règle | Énoncé |
|---|---|
| RG-PIL-01 → 03 | Une courbe par mesure, chaque fait à sa date, semaine ISO ou mois UTC, périodes vides comprises ; corridor = ville → ville sans casse ni accents ; une recherche sans trajet = « demande sans offre ». |
| RG-PIL-04 → 05 | Une vue compte une fois par visiteur et par jour, sans identifier ni conserver l'adresse ; un compteur ne casse jamais une page. |
| RG-PIL-06 | « Tout ce qui est arrivé à ce deal » est une lecture fusionnée (outbox avec état de relais, journal, notifications, emails) ; jamais le code, une photo, une adresse ; consultation journalisée. |
| RG-PIL-07 | Pilotage pour Finance et Médiateur ; chronologie pour Médiateur, Support, Finance ; cache 60 s. |
| RG-PIL-08 → 11 | Toute courbe s'agrandit, tableau dessous, drill-down borné à 200 (inscriptions journalisées) ; onglet Finances aux mêmes règles que le rapport ; périodes en dates lisibles ; badge « Populaire » à 20 vues côté web. |
| RG-ALR-01 (révisée) | Neuf règles, seuils **réglables** (`alerts.*`, exploitation) ; les constantes du code sont les défauts. |
| RG-ALR-02 | Une alerte n'a pas d'état : affichée tant que sa cause existe, lien vers la file, disparaît d'elle-même. |
| RG-ALR-03 | Le support reçoit un email à la première apparition d'une règle dans la journée, jamais plus d'une fois par règle et par jour ; le digest quotidien continue. |
| RG-ALR-04 (révisée) | Les seuils en vigueur sont renvoyés par l'API et se règlent dans Paramètres. |

### 8.5 Messagerie côté admin (RG-FCH), signalements (RG-SIG), confiance (RG-TRU)

| Règle | Énoncé |
|---|---|
| RG-FCH-19 | Un membre signale un message texte de l'autre partie, une fois par message, avec un motif fermé et des précisions. |
| RG-FCH-20 | Support et Médiateur lisent une conversation entière depuis un dossier ; chaque lecture est journalisée ; le numéro n'y apparaît jamais, seules les révélations sont tracées. |
| RG-FCH-21 | Un signalement se traite (« Traité » / « Sans suite », note) ; journalisé ; un signalement traité ne se retraite pas (409). |
| RG-FCH-22 | Une conversation est effacée `messaging.retentionDays` (365 j) après la fin du deal ou la dernière activité ; jamais un deal en cours ou en litige ; les signalements survivent. |
| RG-FCH-24 | Un message envoyé ne se supprime pas : il reste lisible par les deux membres, le support et la médiation. |
| RG-SIG-05 → 07 | Un seul geste, deux cibles (annonce, profil), motifs fermés par cible, signalement toujours signé ; pas contre soi-même, pas deux ouverts du même auteur ; accusé de réception, jamais la suite ; la cible n'apprend jamais qui. |
| RG-SIG-08 | Revue prioritaire à trois signalements ouverts sur une même cible ; aucune sanction automatique. |
| RG-SIG-09 | Le support décide en deux gestes (Traité, Sans suite) avec une note au journal. |
| RG-SIG-10 (déduite du code) | Un membre visé `HIGH_RISK` passe en priorité même avec un seul signalement ; la file affiche le niveau de risque de la cible (ou du propriétaire du trajet). |
| RG-TRU-01 → 06 | Score interne jamais servi à un membre ; explicable (facteurs nommés) ; compte neuf plafonné (300 €, 10 kg, 5 envois / mois, paramètres) ; à risque à 60, à surveiller entre 30 et 59 ; refus expliqué avant paiement ; aucune sanction automatique. |

### 8.6 Paramètres (RG-PAR), RGPD (RG-RGP), maintenance (RG-MNT), emails (RG-EML), moniteur (RG-MON)

| Règle | Énoncé |
|---|---|
| RG-PAR-01 → 03 | Trois classes (A en ligne, B par déploiement, C absente tant que non lue) ; deux portées (métier = super administrateur, exploitation = OPS ou super administrateur ; lecture pour tous sauf PRIVACY — déduit de la matrice) ; bornes et cohérence refusées par le serveur. |
| RG-PAR-04 → 07 | Motif ≥ 20, une ligne de journal par clé, email à tous les super administrateurs ; jamais rétroactif ; le défaut est la valeur du code, la remise par défaut est une modification comme une autre ; effet sous 30 s ; verrou de version (409). |
| RG-PAR-08 → 10 | Le wizard calcule avec les valeurs du serveur ; le profil Exploitation ne touche ni l'argent ni les comptes ; les clés des CGU sont marquées. |
| RG-PAR-11 (déduite du code) | « Tout réinitialiser » ne propose que les clés que le profil peut écrire ; le journal n'est jamais touché par la remise QA (`seed-settings.ts`). |
| RG-RGP-03 → 08 | Effacement immédiat et irréversible, refusé (liste fermée de bloqueurs) tant qu'un deal vit ; anonymisation sans casser le dossier ; plus rien ne part après ; tiers destinataire oublié à 30 j ; chaque demande au registre ; le profil PRIVACY lit le registre, efface à la demande et exporte le nominatif ; personne n'efface son propre compte depuis le back-office. |
| RG-MNT-01 → 07 | Deux interrupteurs (base par l'admin, environnement du gateway qui l'emporte) ; lecture seule (connexion et admin ouverts) ; annonce par bandeau ; santé uniforme ; battement de chaque cron, « en retard » à deux fois l'intervalle ; la page d'état n'est pas une supervision ; conservation chiffrée, journal admin jamais purgé. |
| RG-EML-04 → 06 | Un rebond dur ou une plainte supprime l'adresse (plus aucun email, in-app continue) ; le support lève la suppression après correction, journalisé ; les rebonds comptent dans l'alerte « emails en échec ». |
| RG-MON-01 → 02 | `/api/status` public : 200 pour ok et maintenance, 503 pour dégradé et en panne ; une maintenance planifiée n'est pas une panne. |

---

## 9. Catalogue des actions du journal

Source : `ADMIN_ACTIONS` dans `packages/libs/admin-audit/src/index.ts` ; libellés français dans `apps/admin-ui/src/lib/format.ts` (`ACTION_LABEL`). Colonnes : qui peut la produire, quand, cible, contenu de `before` / `after` tel qu'écrit par le code.

| Action | Libellé | Qui | Quand | Cible | before / after |
|---|---|---|---|---|---|
| `ADMIN_LOGIN` | Connexion admin | Tout admin | Session ouverte (TOTP, code de secours, ou activation) | USER (soi) | — |
| `ADMIN_LOGOUT` | Déconnexion | Tout admin | `POST /auth/admin/logout` | USER | — |
| `ADMIN_TOTP_ENABLED` | 2FA activée | Tout admin | Première activation | USER | — |
| `ADMIN_BACKUP_CODE_USED` | Code de secours utilisé | Tout admin | Connexion par code de secours | USER | — |
| `ADMIN_SESSION_REVOKED` | Session révoquée | Tout admin | « Révoquer » dans Mes sessions | SESSION | — |
| `ADMIN_INVITED` | Admin invité | SUPER_ADMIN | Invitation | USER (invité) | `after: { adminRoles, existingAccount }` |
| `ADMIN_INVITE_ACCEPTED` | Invitation acceptée | L'invité (écrit sous son id) | Mot de passe posé par le lien | USER (soi) | — |
| `ADMIN_ROLE_CHANGED` | Profil admin modifié | SUPER_ADMIN | Cases de profils | USER | `before: { adminRoles }`, `after: { adminRoles }` |
| `ADMIN_REVOKED` | Accès admin retiré | SUPER_ADMIN | « Retirer » | USER | `before: { adminRoles }` |
| `USER_VIEWED` | Fiche consultée | `users.read` | Ouverture d'une fiche | USER | — |
| `USER_SUSPENSION_PROPOSED` | Suspension proposée | `users.suspension.propose` | « Proposer » | USER | `after: { level, reason }` |
| `USER_RESTRICTED` / `USER_SUSPENDED` | Compte restreint / suspendu | `users.suspension.apply` | « Appliquer » / « Modifier » | USER | `before: { accountStatus }`, `after: { accountStatus, reason, until }` |
| `USER_REINSTATED` | Compte rétabli | `users.suspension.apply` | « Lever » | USER | `before: { accountStatus }`, `after: { accountStatus: ACTIVE, reason }` |
| `EMAIL_SUPPRESSION_LIFTED` | Suppression d'adresse levée | `users.email.unsuppress` | « Lever (adresse corrigée) » | USER | `before: { emailSuppressedAt, reason }`, `after: { emailSuppressedAt: null }` |
| `ACCOUNT_ERASED` | Compte effacé (RGPD) | `users.erase` | Effacement depuis la fiche | USER | motif (dans la transaction d'effacement) |
| `DATA_REQUESTS_VIEWED` | Registre RGPD consulté | `privacy.requests.read` | Ouverture de `/privacy` | USER (sans id) | `after: { rows }` |
| `DISPUTE_VIEWED` | Dossier consulté | `disputes.read` | Ouverture d'un dossier | BOOKING | — |
| `DISPUTE_RESOLVED` | Litige tranché | `disputes.decide` | Décision sur un litige | BOOKING | issue et montants |
| `RETENTION_ARBITRATED` | Retenue arbitrée | `disputes.decide` | Décision sur une retenue | BOOKING | issue et montants |
| `TRIP_VIEWED` | Trajet consulté | `trips.read` | Ouverture d'une fiche trajet | TRIP | — |
| `TRIP_HIDE_PROPOSED` | Masquage proposé | `trips.hide.propose` | « Proposer » | TRIP | `after: { reason }` |
| `TRIP_HIDDEN` / `TRIP_UNHIDDEN` | Trajet masqué / rétabli | `trips.hide.apply` | « Masquer » / « Rétablir » | TRIP | `after: { reason }` |
| `DOCUMENT_VIEWED` | Document ouvert | `tickets.review` | « Ouvrir le billet » | TRIP | `after: { documentId }` |
| `TICKET_VERIFIED` / `TICKET_REJECTED` | Billet vérifié / rejeté | `tickets.review` | Décision | TRIP | `after: { documentId, reason }` |
| `DEAL_MONEY_VIEWED` | Fiche argent consultée | `finances.read` | Ouverture de la fiche argent | BOOKING | — |
| `DEAL_RECONCILED` | Rapprochement Stripe | `finances.read` | « Rapprocher maintenant » | BOOKING | `after: { provider, divergences }` |
| `PAYOUT_RETRIED` | Versement rejoué | `payouts.retry` | « Relancer » | BOOKING | `after: { outcome, reason, transferId }` |
| `PAYOUT_REVERSAL_RESOLVED` | Renversement clos | `payouts.resolve` | « Re-verser » / « Abandonner » | BOOKING | `after: { outcome, reason }` |
| `FINANCE_EXPORTED` | Export finances | `finances.export` | « Télécharger le CSV » | BOOKING (sans id) | `after: { from, to, rows, filename }` |
| `REFUND_MANUAL_PROPOSED` | Remboursement manuel proposé | `refunds.manual.propose` | « Proposer » | BOOKING | `after: { amountCents, reason }` |
| `REFUND_MANUAL_APPLIED` | Remboursement manuel appliqué | SUPER_ADMIN | « Rembourser maintenant » | BOOKING | `after: { amountCents, totalRefundedCents, refundId, reason }` |
| `DEAL_HISTORY_VIEWED` | Chronologie consultée | `deals.history.read` | « Charger la chronologie » | BOOKING | — |
| `PILOTAGE_DRILLDOWN_VIEWED` | Liste d'inscriptions consultée (pilotage) | `pilotage.read` | Drill-down sur « Inscriptions » | — | période |
| `EXPORTED` | Export CSV | `exports.operational` / `exports.personal` | Export utilisateurs, trajets, billets, dossiers | USER ou TRIP (sans id) | `after: { domain, personal, reason?, filters, rows }` |
| `CONVERSATION_VIEWED` | Conversation consultée | `conversations.read` | Ouverture d'un fil | CONVERSATION | `after: { bookingId, messages }` |
| `MESSAGE_REPORT_REVIEWED` | Message signalé traité | `reports.review` | Décision sur un message signalé | — | décision, note |
| `REPORT_REVIEWED` | Signalement traité (trajet / membre) | `reports.review` | Décision | — | décision, note |
| `SETTING_CHANGED` | Paramètre modifié | selon la portée | Une ligne **par clé** | SETTINGS (clé) | `{ key, before, after, reason, version }` |
| `SETTINGS_RESET` | Paramètre réinitialisé | selon la portée | Une ligne par clé remise | SETTINGS (clé) | idem |
| `MAINTENANCE_CHANGED` | État de maintenance modifié | `maintenance.write` | Planifier / activer / lever | SETTINGS (`maintenance`) | `before: { …, version }`, `after: { …, reason, version }` |

Une action du catalogue, `REPORT_REVIEWED` (D68), n'a pas de libellé dans `ACTION_LABEL` : le journal et les fiches affichent le code brut à la place d'un texte français (déduit du code — voir §12).

---

## 10. Catalogue complet des paramètres

Source unique : `SETTINGS_CATALOG` dans `packages/libs/api-contracts/src/admin/platform-settings.schema.ts` (49 clés de classe A), rendue par `context/YAMBA-PARAMETRES.md` (`npm run settings-doc`). Les valeurs ci-dessous sont les **défauts** (= le code au moment de la gravure) ; les valeurs en vigueur se lisent dans Paramètres ou par `seed-settings.ts --show`. Portée : **métier** = super administrateur seul ; **exploitation** = OPS ou super administrateur. Les montants sont des centimes entiers en base, affichés en euros.

### 10.1 Prix et commission (portée métier)

| Clé | Libellé | Défaut | Bornes | Règle | Lu par | Ce que ça change |
|---|---|---|---|---|---|---|
| `pricing.commissionPct` | Commission Yamba (CGU) | 12 % | 5 → 20 % | D16 · COM-01 | deal, trip, user-ui | Pourcentage prélevé sur le transport, payé par l'Expéditeur ; frais Stripe absorbés dedans ; jamais sur les réservations faites |
| `pricing.commissionFloorCents` | Plancher de commission (CGU) | 3,00 € | 1 → 10 € | D16 · COM-02 | deal, trip, user-ui | La commission ne descend jamais sous ce montant |
| `pricing.minBillableKg` | Poids facturable minimum | 0,5 kg | 0,1 → 2 kg | D32 · PRC-06 | deal, trip, user-ui | Un colis plus léger est facturé comme s'il pesait ce poids |
| `pricing.minTransportCents` | Prix minimum par colis (CGU) | 8,00 € | 1 → 30 € | D32 · PRC-06 | deal, trip, user-ui | Le transport ne descend jamais sous ce montant |
| `pricing.referenceKg` | Colis de référence (comparabilité) | 2 kg | 1 → 10 kg | D33 | trip | Rend les offres comparables dans la recherche ; les trajets publiés gardent leur valeur jusqu'au script de recalcul |
| `pricing.sizeCoefS` / `M` / `L` | Coefficients taille | × 1 / × 1,1 / × 1,25 | × 0,5 → × 2 | PRC-03 | deal, user-ui | Multiplicateurs du transport ; cohérence S ≤ M ≤ L refusée sinon |

### 10.2 Garantie Yamba (métier)

| Clé | Libellé | Défaut | Bornes | Règle | Lu par |
|---|---|---|---|---|---|
| `protection.extendedPremiumCents` | Prime Garantie étendue (CGU) | 6,00 € | 0 → 50 € | D22 · GAR-06 | deal, user-ui |
| `protection.extendedCapCents` | Plafond Garantie étendue (CGU) | 500,00 € | 100 → 2 000 € | D22 · GAR-03 | deal, user-ui — cohérence plafond ≥ prime |

### 10.3 Annulation, notation, litiges (métier)

| Clé | Libellé | Défaut | Bornes | Règle | Lu par | Ce que ça change |
|---|---|---|---|---|---|---|
| `cancellation.fullRefundUntilHours` | Remboursement intégral jusqu'à (CGU) | 48 h | 0 → 168 h | ANN-01 · D21 | deal | Heures avant le départ jusqu'auxquelles une annulation après acceptation est remboursée à 100 % |
| `cancellation.lateRetentionPct` | Retenue d'annulation tardive (CGU) | 50 % | 0 → 100 % | ANN-01 · D39 · D50 | deal | Part du total retenue quand l'Expéditeur annule après la fenêtre |
| `rating.windowDays` | Fenêtre de notation (CGU) | 14 j | 1 → 60 j | D53 · RG-NOTE-01 | deal | Jours pour se noter après la fin du deal |
| `dispute.responseDelayHours` | Délai de réponse au litige | 72 h | 12 → 336 h | D55 1A · RG-MED-02 | deal | Heures laissées au Voyageur avant que le litige devienne décidable sans sa version |

### 10.4 Réputation (métier)

| Clé | Libellé | Défaut | Bornes | Lu par |
|---|---|---|---|---|
| `reputation.carrier.confirmedMinDeals` | Voyageur confirmé : deals minimum | 3 | 1 → 50 | deal |
| `reputation.carrier.topMinDeals` | Voyageur top : deals minimum | 10 | 1 → 200 | deal — cohérence top ≥ confirmé |
| `reputation.carrier.topMinRating` | Voyageur top : note minimale | 4,8 / 5 | 3 → 5 | deal |
| `reputation.carrier.topMaxLateCancellations` | Voyageur top : annulations tolérées | 0 | 0 → 10 | deal |
| `reputation.shipper.confirmedMinDeals` | Expéditeur fiable : deals minimum | 3 | 1 → 50 | deal |
| `reputation.shipper.topMinDeals` | Expéditeur top : deals minimum | 5 | 1 → 200 | deal |
| `reputation.shipper.topMinRating` | Expéditeur top : note minimale | 4,8 / 5 | 3 → 5 | deal |
| `reputation.shipper.topMaxLateCancellations` | Expéditeur top : annulations tardives tolérées | 0 | 0 → 10 | deal |

Règle source : D29 ① · REP-03.

### 10.5 Messagerie

| Clé | Libellé | Défaut | Bornes | Portée | Règle | Ce que ça change |
|---|---|---|---|---|---|---|
| `messaging.writeDaysAfterEnd` | Fil ouvert après la fin du deal | 14 j | 0 → 90 j | métier | D61 2A · RG-FCH-07 | Ensuite lecture seule |
| `messaging.phoneRevealLeadHours` | Numéro révélé avant le rendez-vous | 2 h | 0 → 72 h | métier | D61 4A | À défaut de rendez-vous, avant le départ |
| `messaging.retentionDays` | Conservation des conversations | 365 j | 30 → 1 095 j | exploitation | D61 8A · RG-FCH-22 | Purge par le cron `conversation-retention` ; les signalements survivent |
| `messaging.reminderDelayMinutes` | Relance email après | 15 min | 1 → 1 440 min | exploitation | D61 6A · RG-FCH-17 | Le cron passe toutes les 5 min |
| `messaging.reminderMinIntervalMinutes` | Au plus une relance toutes les | 60 min | 5 → 1 440 min | exploitation | D61 6A | Cohérence : ≥ le délai de relance |

### 10.6 Alertes d'exploitation (exploitation, D59 3A)

| Clé | Libellé | Défaut | Bornes |
|---|---|---|---|
| `alerts.payoutFailedHours` | Versement en échec depuis | 48 h | 1 → 336 h |
| `alerts.disputeUndecidedHours` | Litige décidable sans décision depuis | 72 h | 1 → 336 h |
| `alerts.retentionHeldDays` | Retenue non arbitrée depuis | 7 j | 1 → 60 j |
| `alerts.reversalOpenHours` | Renversement ouvert depuis | 48 h | 1 → 336 h |
| `alerts.outboxParkedAttempts` | Événement parqué après | 10 | 1 → 100 |
| `alerts.outboxLagMinutes` | Relais en retard depuis | 15 min | 1 → 1 440 min |
| `alerts.emailsFailedWindowHours` | Emails en échec : fenêtre | 24 h | 1 → 168 h |
| `alerts.noTripPublishedDays` | Aucun trajet publié depuis | 7 j | 1 → 90 j |
| `alerts.acceptanceRateWindowDays` | Taux d'acceptation : fenêtre | 7 j | 1 → 90 j |
| `alerts.acceptanceRateMinPct` | Taux d'acceptation minimum | 30 % | 0 → 100 % |
| `alerts.acceptanceRateMinRequests` | Taux d'acceptation : demandes minimum | 5 | 1 → 1 000 |

Lu par deal-service (`evaluateAlerts`, `collectOpsSnapshot`) ; `alerts.outboxParkedAttempts` sert aussi le compteur « parqués » de la page d'état.

### 10.7 Documents, données personnelles, conservation (exploitation)

| Clé | Libellé | Défaut | Bornes | Règle | Lu par | Ce que ça change |
|---|---|---|---|---|---|---|
| `documents.maxDocsPerTrip` | Documents par trajet | 5 | 1 → 20 | ex-SiteConfig | trip | Justificatifs attachés à un trajet |
| `documents.maxDocSizeMb` | Taille maximale d'un document | 5 Mo | 1 → 25 Mo | ex-SiteConfig | trip | Vérifiée côté serveur |
| `privacy.recipientRetentionDays` | Effacement du destinataire après | 30 j | 7 → 365 j | D63 5A · RGP-02 | deal | Cron `recipient-redaction` ; jamais avant (litige, preuve de remise) ; le lien de suivi destinataire meurt en même temps |
| `retention.notificationsDays` | Notifications in-app | 365 j | 30 → 1 095 j | D64 6A · RGP-01 | notification | Cron `retention` |
| `retention.emailDeliveriesDays` | Traces d'envoi d'emails | 365 j | 30 → 1 095 j | D64 6A | notification | Jamais le contenu, qui n'est pas stocké |
| `retention.consumedEventsDays` | Registre des événements consommés | 90 j | 7 → 365 j | D64 6A | notification | Au-delà, un événement rejoué serait retraité |
| `retention.outboxPublishedDays` | Événements d'outbox publiés | 90 j | 7 → 365 j | D64 6A | deal, message | Un événement parqué n'est jamais supprimé |

### 10.8 Confiance — TrustScore interne (D71 · CNF-06)

| Clé | Libellé | Défaut | Bornes | Portée | Lu par | Ce que ça change |
|---|---|---|---|---|---|---|
| `trust.newAccountDays` | Compte neuf pendant | 30 j | 7 → 180 j | exploitation | deal, auth | Âge en dessous duquel un membre sans historique (< 3 deals terminés) est « neuf » |
| `trust.newAccount.maxDeclaredValueCents` | Compte neuf : valeur déclarée max par colis | 300,00 € | 50 → 5 000 € | métier | deal | Au-delà, 409 `NEW_ACCOUNT_CAP` |
| `trust.newAccount.maxWeightKg` | Compte neuf : poids max par colis | 10 kg | 1 → 30 kg | métier | deal | Idem, colis PARCEL |
| `trust.newAccount.maxShipmentsPerMonth` | Compte neuf : envois par mois civil | 5 | 1 → 50 | exploitation | deal | Demandes créées depuis le 1er du mois |

### 10.9 Classe B — modifiables par déploiement seulement

| Paramètre | Valeur | Règle |
|---|---|---|
| Session membre : inactivité | 60 min (7 j avec « rester connecté ») | D27 · RG-A-13 |
| Session membre : durée maximale | 7 j (30 j avec « rester connecté ») | D27 · RG-A-14 |
| Session admin | accès 15 min · inactivité 45 min · 12 h de vie | D54 8A · RG-ADM-05 |
| Code OTP : validité | 10 min | RG-A-01 |
| 2FA admin : blocage | 5 échecs → 15 min | RG-ADM-04 |
| Code de livraison : blocage | 3 codes faux → 15 min | D4 · RG-P-06 |
| Motifs au journal | 20 caractères (sanction, masquage, export) · 50 (décision de médiation, remboursement manuel) | D54 6A · D56 2A · D58 3A |
| Invitation admin : validité | 48 h | D56 · RG-ADM-10 |

### 10.10 Classe C — prévues, pas encore lues par le code

`WEIGHT_TOLERANCE_PCT` (PRC-07 · RG-B-11), `SUGGESTION_EXPRESS_CAP_PCT` (PRC-10), `IDENTITY_REQUIRED_FROM` (CNF-05), `PROTECTION_BASIC_CAP / PROTECTION_PROVIDER` (GAR-01/03), `REPORT_REVIEW_THRESHOLD` (SIG-03 — constante `3` avec un seul consommateur), `BAG_FORFAIT_DISCOUNT` (PRC-09), `CATEGORY_SURCHARGE_MAX_PCT` (CAT-03). Un curseur qui ne commande rien serait une illusion de contrôle : ces clés n'apparaissent pas sur la page.

---

## 11. Procédures d'exploitation (runbooks)

### 11.1 Onboarding d'un nouvel admin

| Étape | Qui | Quoi | Vérification |
|---|---|---|---|
| 1 | Super administrateur | Décider des profils selon la fonction (Support seul pour un agent de premier niveau ; Support + Finance pour un opérateur polyvalent ; Médiateur seulement pour qui tranche ; OPS pour l'exploitation technique ; PRIVACY pour le référent données personnelles) | La matrice §3.2 |
| 2 | Super administrateur | `/admins` → « Inviter » (email professionnel, prénom, nom, profils) | Ligne « invitation en attente », tuile d'accueil |
| 3 | Invité | Ouvrir le lien sous 48 h, poser un mot de passe fort, se connecter, scanner le QR avec une application d'authentification, **ranger les huit codes de secours dans un gestionnaire de mots de passe** | Ligne « 2FA active » |
| 4 | Invité | Vérifier le menu (les entrées attendues, pas plus) ; ouvrir « Mes sessions » | Email « Nouvelle connexion au back-office Yamba » reçu |
| 5 | Super administrateur | Relire le journal : `ADMIN_INVITED`, `ADMIN_INVITE_ACCEPTED`, `ADMIN_TOTP_ENABLED`, `ADMIN_LOGIN` | `/audit` |
| Si le lien a expiré | Super administrateur | « Retirer » puis réinviter (le compte existe déjà : profils posés, email « accès accordé ») | — |
| Si l'admin doit aussi être membre | L'admin | Passer par le parcours client (le compte invité n'a aucun rôle client) | — |

### 11.2 Traitement quotidien (accueil → files)

| Ordre | Écran | Ce qu'on regarde | Ce qu'on fait |
|---|---|---|---|
| 1 | Accueil, bandeau des alertes | Une alerte **critique** d'abord (versement, litige, relais outbox) | Suivre le lien ; poser le filtre à la main sur À arbitrer (les paramètres d'URL n'y sont pas lus) |
| 2 | Accueil, « Paramètres modifiés le … » | Une modification récente inattendue | Ouvrir Paramètres › historique de la clé ; le journal porte le motif |
| 3 | Finances › Versements en échec | Motif « compte Stripe non prêt » → contacter le Voyageur ; « refus du fournisseur » → lire le détail brut, rapprocher | « Relancer » une fois le compte prêt |
| 4 | Finances › Transferts renversés, Remboursements proposés | Décider avec motif | Re-verser / abandonner ; appliquer (super administrateur) |
| 5 | À arbitrer | « version reçue » ou « sans réponse » = décidable ; J+5 en rouge | Ouvrir, lire la conversation si utile, trancher |
| 6 | Billets | Comparer dates, villes, nom | Valider ou rejeter avec le motif fermé |
| 7 | Signalements | Prioritaires d'abord ; ouvrir la cible | Masquer / proposer une sanction si justifié, revenir « Traité » |
| 8 | Utilisateurs | Tuile « Sanctions proposées » (pas de filtre dédié : chercher la fiche depuis la proposition reçue) | Appliquer ou lever |
| 9 | État des services | Cartes vertes, aucun cron « en retard ? », 0 parqué, emails en échec | Voir 11.3 sinon |

### 11.3 Incident

| Symptôme | Où le voir | Diagnostic | Conduite à tenir |
|---|---|---|---|
| Moniteur externe : `/api/status` en 503 « down » | `/status` : une carte rouge « Injoignable » | Un service ne répond pas | Redémarrer le service (`npx nx serve <service>` en dev, le processus en production), lire ses logs / Sentry ; l'admin reste utilisable tant que auth-service et le gateway vivent |
| 503 « degraded » | Carte ambre « ✗ mongo » ou « ✗ redis » | Une dépendance manque à un service | Vérifier Atlas / Redis, `DATABASE_URL`, `REDIS_DATABASE_URI` ; Redis absent = compteurs et battements muets, pas de perte de données métier |
| Battement manquant (moniteur) ou « en retard ? » | Tableau des crons | Cron arrêté : service arrêté, `*_CRON_ENABLED=false`, ou erreur au tick (ligne rouge « échec — … ») | Corriger l'env, redémarrer ; attendre le tick suivant ; un versement en retard se rejoue seul |
| Alerte « Relais outbox en retard » / « Événements parqués » | Accueil, `/status` Outbox, chronologie d'un deal | Redpanda ou le relais arrêté ; un événement parqué (≥ 10 tentatives) ne sera plus rejoué automatiquement | Redémarrer Redpanda / le service ; un parqué demande une intervention développeur (il n'est jamais purgé : piste d'audit) |
| Alerte « Emails en échec » | `/status` Emails 24 h | SMTP / Resend en panne, ou vague de rebonds | Vérifier le fournisseur ; sur la fiche d'un membre, lever une suppression après correction de l'adresse |
| Base Mongo elle-même en panne | Tout est rouge, l'admin ne s'ouvre plus | — | `MAINTENANCE_MODE=on` dans l'environnement du **gateway** et redémarrer : lecture seule immédiate, badge « forcée par l'environnement » ; lever en retirant la variable |
| Intervention planifiée | — | — | Annoncer (bandeau ambre), puis activer la lecture seule, intervenir, lever (§6.19 ; cas 6) |

### 11.4 Fin de mois

| Étape | Qui | Quoi |
|---|---|---|
| 1 | Finance | Solder les files : versements en échec (relancer), renversements (décider), retenues (faire arbitrer), remboursements proposés (faire appliquer) |
| 2 | Finance | `/finances/report` : lire les passifs du jour, le tableau du mois ; vérifier que le revenu = commission + prime des deals terminés |
| 3 | Finance | Export CSV du 1er au dernier jour (≤ 366 j) ; conserver le fichier avec la ligne `FINANCE_EXPORTED` du journal comme preuve |
| 4 | Comptable | Rapprocher avec l'export Stripe (frais du fournisseur non stockés) ; pour un deal douteux, « Rapprocher maintenant » sur sa fiche argent |
| 5 | Finance / Super administrateur | Relire le journal du mois (`/audit`) : remboursements manuels, décisions, exports |

### 11.5 Demande RGPD

| Demande | Qui | Procédure |
|---|---|---|
| Export « mes données » | Le membre lui-même | Sécurité › « Télécharger mes données » (code email, un export par 24 h) ; l'admin ne fait pas d'export à la place du membre — il vérifie au registre (`/privacy`) que la demande est « faite » |
| Effacement par le membre | Le membre | Sécurité › « Supprimer mon compte » (code + mot SUPPRIMER) ; refus expliqués (deal en cours…) |
| Effacement reçu par email | PRIVACY (ou super administrateur) | Vérifier l'identité du demandeur par l'adresse du compte ; fiche du membre → « Effacer ce compte (RGPD) », motif daté avec le canal, EFFACER ; si 409, dire au membre ce qui bloque et refaire quand le deal est terminé ; le registre porte la demande refusée puis faite (preuve du délai d'un mois) ; **un profil admin doit d'abord être retiré** |
| Rectification d'adresse email / mot de passe | Le membre | Parcours membre D65 (sous sudo) ; l'admin ne modifie pas une identité |
| Adresse en rebond | Support | Après correction par le membre, « Lever (adresse corrigée) » sur sa fiche |
| Export nominatif pour un tiers légitime | PRIVACY / super administrateur | `/users` filtré → export avec motif ≥ 20 (au journal) ; conserver la trace de la demande hors application |

---

## 12. Divergences constatées et portes

### 12.1 Divergences code ↔ documents (à corriger dans les documents ou le code)

| # | Constat | Où | Gravité |
|---|---|---|---|
| 1 | Textes d'écran obsolètes : accueil « Les courbes et les finances arrivent avec le pilotage (C-PR6) », Finances « Le rapport mensuel et l'export arrivent avec C-PR5b », Pilotage « Les alertes de seuil arrivent avec C-PR6b » — tout est livré | `home/page.tsx`, `finances/page.tsx`, `pilotage/page.tsx` | Cosmétique |
| 2 | Export nominatif : RG-ADM-33, `CLAUDE.md` et le commentaire d'`ExportButton.tsx` disent « SUPER_ADMIN seul » ; la matrice donne aussi PRIVACY (A143, RG-RGP-08) | `admin-users.schema.ts` vs docs | Documentaire |
| 3 | RG-ADM-09 dit « quatre profils » ; il y en a six (OPS, PRIVACY) | `YAMBA-DOC-METIER.md` | Documentaire |
| 4 | Les liens d'alerte `/disputes?decidable=1` et `/disputes?kind=RETENTION` ne sont pas lus par `QueueTable` (filtres initialisés à vide) ; idem la tuile « Sanctions proposées » → `/users` sans filtre possible | `QueueTable.tsx`, `UsersSearch.tsx` | Fonctionnel mineur |
| 5 | « 72 h » écrit en dur dans le sous-titre d'À arbitrer et dans `DecisionForm` (« 72 h laissées au Voyageur ») alors que `dispute.responseDelayHours` est réglable ; l'échéance calculée est, elle, correcte | `disputes/page.tsx`, `DecisionForm.tsx` | Cosmétique |
| 6 | RG-ALR-01/04 disent « seuils fixes / versionnés dans le code » ; ils sont réglables depuis D62 | `YAMBA-DOC-METIER.md` | Documentaire |
| 7 | `REPORT_REVIEWED` (D68) n'a pas de libellé dans `ACTION_LABEL` : le journal affiche le code brut | `format.ts` | Cosmétique |
| 8 | Les noms de règle d'alerte portent leur seuil historique (`PAYOUT_FAILED_48H`) même si le paramètre a changé | `admin-alerts.schema.ts` | Cosmétique, assumé |
| 9 | Un refus d'effacement côté admin (409) est inscrit au registre `DataRequest` mais **pas** au journal admin (aucune ligne `ACCOUNT_ERASED` n'est écrite sur un refus) | `privacy.service.ts` | À décider (le registre suffit-il comme preuve ?) |

### 12.2 Portes (choix laissés ouverts par le registre)

| Porte | Décision d'origine |
|---|---|
| Double validation proposer / appliquer sur un paramètre ; date d'effet différée ; bases tarifaires par corridor | D62 (non retenu maintenant) |
| Délai de rétractation sur l'effacement ; suppression du compte Stripe Connect ; effacement des photos de colis / litige / message (pas de `fileId`) ; export au format CSV pour le membre | D63 |
| Alerte email à chaque nouvelle connexion membre ; liste des sessions d'un membre côté admin (le compteur de la fiche suffit) | D65 |
| Signalement d'un avis (bouton inerte conservé) ; signalement anonyme | D68 |
| Battement « échec » (`/fail`) pour distinguer cron mort et cron en erreur ; sonde authentifiée ; page de statut maison | D70 |
| Poids réel au pickup (PRC-07), identité vérifiée (KYC), score stocké avec historique, instantané du score dans le journal d'une sanction | D71 |
| Détection de doublons de billets, identité forte ; visionneuse de billet intégrée | D57 (backlog) |
| Frais Stripe du `balance_transaction` (marge par deal) ; grand livre ; filtres d'export finances | D58 (backlog) |
| Réparation d'un événement parqué depuis l'écran ; événements de trajet dans la chronologie | D59 (backlog) |
| Relance du Voyageur muet en médiation ; réparation manuelle documentée d'un remboursement parti sans transaction | C-PR2 (reste) |

---

## 13. Recommandations d'expert (hors périmètre livré)

Cette section est **séparée du livré** : rien de ce qui suit n'existe dans le code. Elle liste les manques observés en lisant les écrans avec les yeux d'un opérateur, les risques qu'ils font courir, et des évolutions classées par valeur.

### 13.1 Manques fonctionnels

| Manque | Pourquoi ça compte | Piste |
|---|---|---|
| **Recherche et filtres du journal d'audit** | `/audit` n'a ni filtre par admin, par action, par cible, par période, ni recherche ; retrouver « qui a masqué ce trajet le 3 » demande de paginer. Les fiches montrent le journal par cible, mais pas le journal global d'un admin | Filtres serveur (admin, action, cible, période) + export CSV journalisé du journal lui-même (Finance / super administrateur) |
| **Notes internes sur une fiche** | Le motif d'une sanction ou d'une décision est le seul texte libre conservé ; le contexte d'un appel téléphonique, une promesse faite au membre, un avertissement oral n'ont nulle part où vivre. Les opérateurs finiront par mettre ces notes dans le motif d'une proposition | Un modèle `AdminNote` (cible USER / TRIP / BOOKING, auteur, texte, épinglée) affiché sur les fiches, journalisé, exclu de l'export membre (D63 : « jamais les notes internes ») |
| **SLA et files vieillissantes** | Seul À arbitrer montre « J+n » et le rouge à J+5 ; billets, signalements, remboursements proposés, sanctions proposées n'ont ni délai promis ni tri par âge visible | Un « J+n » et un seuil d'alerte par file (les règles `evaluateAlerts` s'y prêtent : `TICKET_PENDING_3D`, `REPORT_OPEN_48H`, `SANCTION_PROPOSED_24H`) |
| **Tableau de bord support** | L'accueil compte ; il ne mesure pas le travail fait : décisions par admin, délai médian de traitement, volume par motif | Une vue « Activité de l'équipe » calculée depuis `AdminAction` (par semaine, par admin, par action), sous `audit.read` |
| **Filtre « Sanctions proposées » sur la liste des utilisateurs** | La tuile mène à `/users` sans filtre ; un Médiateur doit retrouver la fiche depuis un autre canal | Filtre serveur `suspensionProposed=1` (le champ existe) et lecture des paramètres d'URL sur À arbitrer |
| **Régénération des codes de secours et réinitialisation 2FA** | Le seul chemin est « retirer puis réinviter » (cas 25), qui efface aussi les profils et laisse une trace ambiguë | `POST /admin/me/totp/backup-codes` (sous re-vérification TOTP) et « Réinitialiser la 2FA » par un super administrateur, journalisés |
| **Fiche argent : lien vers Stripe** | Les identifiants sont en clair mais ne sont pas des liens vers le tableau de bord Stripe | Liens `https://dashboard.stripe.com/…/payments/<intent>` (sans secret) |
| **Visionneuse de billet intégrée** | Le billet s'ouvre dans un onglet ImageKit ; l'URL peut être partagée hors session | Visionneuse en page avec URL signée à courte durée |
| **Modèles de motif** | Les motifs libres (≥ 20 / 50) varient d'un opérateur à l'autre ; l'email au membre est générique de toute façon | Motifs types éditables (classe A, texte) avec champ libre complémentaire |
| **Double validation sur les paramètres métier** | Une seule personne change la commission ; une faute de frappe (15 → 51 est refusée par la borne, 15 → 5 ne l'est pas) part sans relecture | La porte D62 « proposer / appliquer » sur les clés CGU, au moins |

### 13.2 Risques

| Risque | Constat | Atténuation |
|---|---|---|
| **Concentration des pouvoirs** | Au lancement, une personne cumule SUPER_ADMIN et tout le reste ; les circuits à deux temps se font en deux clics | Deux super administrateurs minimum ; un compte « opérateur » distinct du compte « super administrateur » pour la même personne ; revue mensuelle du journal par un tiers |
| **Export nominatif** | Assumé et tracé, mais le fichier sort du système sans chiffrement ni expiration | Politique de conservation des exports hors ligne ; envisager un export chiffré ou à durée de vie |
| **Session admin sur poste partagé** | 45 min d'inactivité est long sur un poste de support ouvert | Réglage à 15 min en classe B pour les profils Support ; verrouillage d'écran imposé |
| **Journal en base unique** | `AdminAction` vit dans la même Mongo que les données ; une compromission de la base compromet la piste d'audit | Export périodique du journal vers un stockage en ajout seul (WORM) ; hachage chaîné des lignes |
| **Pas de rate limiting spécifique aux gestes d'argent** | Le limiteur du gateway est global ; l'idempotence protège des doublons mais pas d'une rafale de remboursements distincts | Plafond journalier de remboursements manuels par admin (paramètre), alerte au-delà |
| **Motifs génériques dans les emails** | Voulu (ne jamais révéler un signalement), mais un membre restreint « pour comportement » peut ne pas comprendre ; le support recevra l'appel | Une page d'aide « Mon compte est restreint » avec les cas types et la procédure de contestation |
| **Dépendance à Redis pour les battements et les compteurs** | Redis vidé = crons « jamais tournés », vues et recherches perdues (D59 assumé) | Persistance Redis (AOF) en production ; battement externe (D70) comme seconde source |

### 13.3 Évolutions, par valeur décroissante

1. **Journal filtrable et exportable** (§13.1) — faible coût, forte valeur pour la conformité et les recettes.
2. **Notes internes** — le premier vrai manque d'un outil de support ; tranche avec l'engagement D63 « jamais dans l'export membre ».
3. **Alertes de file** (billets, signalements, propositions) — réutilise `evaluateAlerts` et le cron existant.
4. **Réinitialisation 2FA et codes de secours** — évite la procédure « retirer / réinviter » qui brouille le journal.
5. **Recherche plein texte** (email, nom, ville, ticket, id de transfert Stripe) sur une seule barre à l'accueil — aujourd'hui trois barres (utilisateurs, trajets, dossiers) et aucune sur les identifiants Stripe.
6. **Double validation sur les clés CGU** — porte D62.
7. **Tableau de bord d'équipe** — quand il y aura plus d'un opérateur.
8. **Rôles à granularité fine** (lecture seule Finance vs action) — quand un comptable externe aura un accès.
9. **Historique du TrustScore** dans le journal d'une sanction — porte D71, utile en cas de contestation.
10. **Mobile** : l'admin-ui n'est pas pensée pour un téléphone (barre latérale fixe, tableaux larges) ; un admin d'astreinte lit les alertes depuis l'email, pas depuis l'écran.

---

## 14. Index des sources

| Domaine | Fichiers lus |
|---|---|
| Gouvernance | `CLAUDE.md` (§ Admin), `context/YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md` (D54 → D71, D35, A143–A145), `context/YAMBA-DOC-METIER.md` (C-PR1 → C-PR8c, F-PR3, D35, D65, D68, D70, D71), `context/YAMBA-DOC-TECHNIQUE.md` (mêmes sections), `context/YAMBA-PARAMETRES.md` |
| Contrats | `packages/libs/api-contracts/src/admin/admin-users.schema.ts` (matrice), `admin-alerts.schema.ts`, `admin-dispute.schema.ts`, `admin-finances.schema.ts`, `admin-pilotage.schema.ts`, `admin-privacy.schema.ts`, `admin-status.schema.ts`, `admin-trips.schema.ts`, `platform-settings.schema.ts`, `reports.schema.ts`, `trust.schema.ts` ; `apps/*/openapi.json` (opérations `admin`, `x-permission`) |
| Journal | `packages/libs/admin-audit/src/index.ts`, `apps/admin-ui/src/lib/format.ts` (`ACTION_LABEL`) |
| Front admin | `apps/admin-ui/src/components/*.tsx` (AdminShell, HomeKpis, UsersSearch, UserFileView, ExportButton, TripsList, TripFileView, TicketsQueue, QueueTable, DisputeFileView, DecisionForm, FinanceQueues, DealMoneyView, FinanceReportView, PilotageView, ConversationView, ReportsQueue, MessageReportsQueue, PlatformSettingsEditor, SettingsDocumentation, DataRequestsList, StatusView, MaintenanceBanner, AuditTable, AdminsManager, InviteAccept, LoginFlow, SessionsList), `apps/admin-ui/src/app/(back)/**/page.tsx`, `apps/admin-ui/src/lib/permissions.ts`, `apps/admin-ui/src/lib/types.ts` |
| auth-service | `routes/admin.router.ts`, `controller/admin-auth.controller.ts`, `admin-admins.controller.ts`, `admin-users.controller.ts`, `admin-kpis.controller.ts`, `admin-settings.controller.ts`, `admin-status.controller.ts`, `privacy.controller.ts`, `report.controller.ts`, `services/admin-users.service.ts`, `platform-settings.service.ts`, `maintenance.service.ts`, `privacy.service.ts`, `report.service.ts`, `lib/admin-users.query.ts`, `emails/admin-emails.ts`, `cron/onboarding-reminder.cron.ts` |
| deal-service | `routes/deal.routes.ts` (routes `/admin`), `services/admin-dispute.service.ts`, `admin-finance.service.ts`, `admin-finance.rules.ts`, `admin-history.service.ts`, `ops-alerts.rules.ts`, `ops-alerts.service.ts`, `ops-notify.service.ts`, `cron/*.ts` |
| trip-service | `routes/admin.router.ts`, `controllers/admin-trips.controller.ts`, `lib/admin-trips.rules.ts`, `cron/complete-trips.cron.ts` |
| message-service | `routes/admin.router.ts`, `services/admin-conversation.service.ts`, `cron/*.ts` |
| notification-service | `cron/retention.cron.ts` |
| Libs | `packages/libs/settings`, `packages/libs/trust`, `packages/libs/csv`, `packages/libs/health`, `packages/libs/maintenance`, `packages/libs/redis/cron-heartbeat.ts`, `packages/libs/redis/trip-stats.ts`, `packages/middleware` |

*Fin du document.*
