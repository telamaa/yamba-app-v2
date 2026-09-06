# CAHIER DE RECETTE — PARTIE 1 : LE SITE MEMBRE (WEB)

> **Document de recette fonctionnelle.** Il se déroule du premier écran au dernier, sans connaissance préalable du projet. Chaque scénario dit quoi faire, ce qui doit apparaître, et comment le vérifier. Un testeur qui suit ce cahier doit pouvoir écrire « conforme » ou « non conforme » sans interpréter.
>
> **Périmètre : `apps/user-ui`** — le site que voient les Expéditeurs, les Voyageurs et les destinataires, sur `http://localhost:3000`.
>
> Version du document : 1.0 — 6 septembre 2026. Branche de référence : `dev` (chantiers B1→B5, C-PR1→C-PR8c, F-PR1→F-PR3, D35, D65→D72 livrés).

---

## 1. Objet et périmètre

### 1.1 Ce que fait la plateforme, en trois phrases

Yamba est une place de marché entre particuliers pour le transport de colis légers. Un **Voyageur** vend les kilos de franchise bagage qu'il n'utilise pas sur un trajet qu'il publie ; un **Expéditeur** lui confie un colis, le paie en ligne, suit la livraison. Le **destinataire**, qui n'a pas de compte, récupère le colis à l'arrivée contre un code à six chiffres.

Deux mots seulement pour les rôles : **Voyageur** (celui qui transporte) et **Expéditeur** (celui qui confie). Les mots « Tripper », « Yamber » et « transporteur » ne doivent apparaître nulle part : leur présence est une anomalie à consigner (voir WEB-VOC).

### 1.2 Ce que ce cahier couvre

Ce cahier couvre **tout ce qu'un membre ou un visiteur peut faire depuis un navigateur sur le site public et l'espace membre**, dans l'ordre de vie du produit :

| Chapitre | Domaine | Code des scénarios |
|---|---|---|
| 5.1 | Découverte, accueil, navigation, recherche depuis l'accueil | `WEB-ACC` |
| 5.2 | Inscription par code email, consentement, Google | `WEB-INS` |
| 5.3 | Connexion, « Rester connecté », session expirée, appareils connectés | `WEB-CNX` |
| 5.4 | Mot de passe oublié, changement de mot de passe et d'adresse | `WEB-MDP` |
| 5.5 | Profil, avatar, page publique et sa visibilité | `WEB-PRO` |
| 5.6 | Devenir Voyageur : onboarding et Stripe Connect | `WEB-VOY` |
| 5.7 | Publier un trajet et son cycle de vie | `WEB-TRJ` |
| 5.8 | Justificatifs et billet vérifié | `WEB-DOC` |
| 5.9 | Recherche, filtres, tri, état vide | `WEB-RCH` |
| 5.10 | Alertes de route | `WEB-ALR` |
| 5.11 | Favoris et Voyageurs suivis | `WEB-FAV` |
| 5.12 | Réservation en quatre étapes et devis | `WEB-RSV` |
| 5.13 | Plafonds du compte neuf | `WEB-TRU` |
| 5.14 | Acceptation, refus et expiration côté Voyageur | `WEB-DEA` |
| 5.15 | Messagerie, rendez-vous, numéro de téléphone | `WEB-MSG` |
| 5.16 | Prise en charge, jalons de transit | `WEB-PIC` |
| 5.17 | Code de livraison | `WEB-COD` |
| 5.18 | Remise du colis et période de vérification | `WEB-REM` |
| 5.19 | Confirmation, complétion, versement, finances | `WEB-CNF` |
| 5.20 | Annulations des deux côtés | `WEB-ANN` |
| 5.21 | Litige et médiation, vue membre | `WEB-LIT` |
| 5.22 | Notation croisée double-aveugle | `WEB-NOT` |
| 5.23 | Page destinataire | `WEB-DES` |
| 5.24 | Signalement d'un trajet, d'un profil, d'un message | `WEB-SIG` |
| 5.25 | Données personnelles : export, effacement | `WEB-RGP` |
| 5.26 | Préférences, langue, relance email | `WEB-PRF` |
| 5.27 | Consentement à la mesure d'audience | `WEB-ANA` |
| 5.28 | Mode maintenance vu du membre | `WEB-MNT` |
| 5.29 | Pages d'erreur et page introuvable | `WEB-ERR` |
| 5.30 | Responsive mobile | `WEB-MOB` |
| 5.31 | Accessibilité clavier de base | `WEB-A11Y` |
| 5.32 | Vocabulaire et cohérence de langue | `WEB-VOC` |
| 6 | Parcours de bout en bout | `WEB-E2E` |
| 7 | Non-régression | `WEB-NRG` |

### 1.3 Ce que ce cahier NE couvre PAS

Quatre sujets sont traités dans d'autres cahiers. Quand un scénario du présent cahier a besoin d'un geste d'administration (masquer un trajet, trancher un litige, activer la maintenance), il le dit et renvoie au cahier concerné ; le testeur web n'a alors qu'à **constater l'effet côté membre**.

| Hors périmètre | Cahier concerné | Exemples de ce qui y est traité |
|---|---|---|
| Le back-office (`apps/admin-ui`, port 3001) | **RECETTE-02-ADMIN** | Connexion administrateur à deux facteurs, files de signalements, arbitrage des litiges, page Paramètres de la plateforme, journal d'audit, masquage d'un trajet, sanctions de compte, activation de la maintenance, exports CSV, registre RGPD. |
| Les contrats d'API et les codes d'erreur | **RECETTE-03-API** | Schémas OpenAPI, codes HTTP, DTO par rôle, idempotence, pagination, sécurité des routes, `GET /api/status`. |
| Les traitements automatiques | **RECETTE-04-CRONS** | Expiration des demandes à 24 h, versement à J+4, relance des messages non lus, révélation des notes à 14 jours, complétion automatique des trajets, effacement du tiers destinataire à 30 jours, purges de conservation, battements de cron. |
| L'infrastructure et l'exploitation | **RECETTE-04-CRONS**, annexe | Sauvegardes Atlas, moniteurs externes, Sentry, webhooks Stripe et Resend rejoués depuis les tableaux de bord des fournisseurs. |

**Cas particulier des crons.** Plusieurs scénarios web attendent l'effet d'un traitement automatique (versement, expiration, relance). Le cahier indique alors soit le délai réel d'attente, soit la manœuvre de raccourci autorisée (modifier une date en base, ou abaisser un paramètre depuis le back-office). Ces scénarios sont marqués **« dépend d'un cron »** : s'ils ne peuvent pas être joués dans la session, ils passent en `⏭` et sont repris dans le cahier des crons.

### 1.4 À qui s'adresse ce document

Au testeur fonctionnel, qui n'a pas besoin de lire une ligne de code. Les références techniques (chemins de fichiers, noms d'événements, identifiants d'erreur comme `QUOTE_DIVERGENCE`) apparaissent seulement dans la colonne « vérification complémentaire », pour permettre une consignation précise d'anomalie ; elles ne sont jamais nécessaires pour prononcer un verdict.

---

## 2. Prérequis

### 2.1 Poste de test

| Élément | Attendu |
|---|---|
| Navigateur principal | Chrome ou Edge à jour, fenêtre **1440 × 900** au moins |
| Second navigateur | Firefox **ou** un profil Chrome distinct — indispensable pour tous les scénarios à deux comptes simultanés (voir §3.5) |
| Fenêtre privée | Utilisée systématiquement pour les scénarios « visiteur non connecté » et pour la page destinataire |
| Émulation mobile | Outils de développement, profil **iPhone 14 (390 × 844)** — chapitre 5.30 |
| Onglet réseau | Ouvert pendant les scénarios de mesure d'audience et de maintenance |
| Résolution intermédiaire | Une largeur **800 px** est demandée par un scénario (bascule desktop / mobile à 768 px) |

Le testeur doit avoir accès à :

- **Mailpit — http://localhost:8025** : toute vérification d'email passe par là. C'est la boîte aux lettres commune de tous les comptes de test.
- **Le back-office — http://localhost:3001** : uniquement pour les gestes d'administration qu'un scénario web exige (masquer un trajet, trancher un litige, activer la maintenance). Le détail de ces écrans est dans **RECETTE-02-ADMIN**.
- **La base de données** (Compass, Studio, ou `npx prisma studio`) : pour les vérifications complémentaires « ligne en base ». Optionnel : leur absence ne fait jamais échouer un scénario, elle réduit la précision de la consignation.

### 2.2 Montage de l'environnement

Dans l'ordre. Chaque commande est lancée depuis la racine du dépôt.

```sh
# 1. Dépendances
npm ci

# 2. Redpanda (bus d'événements) et Mailpit (boîte mail locale)
docker compose up -d
./scripts/redpanda-bootstrap.sh          # une seule fois par machine

# 3. Base de données (Mongo Atlas, replica set) et cache (Redis) : fournis par la configuration,
#    ils ne sont PAS dans docker compose. Vérifier DATABASE_URL et REDIS_DATABASE_URI dans .env
npx prisma generate
npx prisma db push

# 4. Jeu d'essai — remet trajets, deals, conversations et litiges à zéro
npx tsx --env-file=.env packages/libs/prisma/scripts/seed-deals.ts

# 5. Paramètres de la plateforme aux valeurs par défaut
npx tsx --env-file=.env packages/libs/prisma/scripts/seed-settings.ts
npx tsx --env-file=.env packages/libs/prisma/scripts/seed-settings.ts --show   # contrôle

# 6. Un compte d'administration, pour les gestes du §2.6
npx tsx --env-file=.env packages/libs/prisma/scripts/grant-admin.ts <votre-email> --role SUPER_ADMIN

# 7. Démarrage
npm run dev              # les six services + le site sur :3000
npx nx dev admin-ui      # dans un second terminal, le back-office sur :3001
```

**Contrôle de bon démarrage, avant le premier scénario :**

| Contrôle | Attendu |
|---|---|
| `curl -i http://localhost:8080/api/status` | `200`, `status: "ok"`, cinq services `reachable: true` |
| `curl -i http://localhost:3000/api/health` | `200`, `app: "user-ui"` |
| http://localhost:3000 s'ouvre | L'accueil s'affiche, pas un squelette figé |
| http://localhost:8025 s'ouvre | Boîte Mailpit accessible, vide ou non |

Si `npm run dev` échoue sur un service avec `ENOENT … src/assets`, c'est un dossier `assets` manquant : le signaler comme **anomalie bloquante d'environnement**, pas comme anomalie fonctionnelle.

**Jamais `source .env`** : le mot de passe Mongo contient des caractères que le shell interprète. Toujours `npx tsx --env-file=.env …`.

### 2.3 Les comptes du jeu d'essai

**Mot de passe commun à tous les comptes : `Yamba-Dev-2026!`**
Toutes les adresses sont sur le domaine `@seed.yamba.dev`. Tous ces comptes ont été créés **il y a 90 jours** : ils ne sont donc **pas** des « comptes neufs » au sens des plafonds (chapitre 5.13).

#### Les six Voyageurs — onboarding et Stripe déjà complets

Ils portent une page Voyageur en statut `COMPLETE` et un compte de paiement fictif aux encaissements et virements activés : ils peuvent **accepter** une demande sans passer par Stripe.

| Compte | Email | Ce qu'il porte |
|---|---|---|
| **Thomas Nkounkou** | `thomas.carrier@seed.yamba.dev` | Le compte central de la recette. Trois trajets Paris → Brazzaville et **seize deals** dans presque tous les états : en attente, accepté, refusé, expiré, annulé, pris en charge, livré, en litige, terminé, versement échoué, versement renversé, retenue à arbitrer. |
| **Marc Tremblay** | `marc.carrier@seed.yamba.dev` | Trajet Paris → Montréal (départ J+3), un deal accepté et un deal livré. |
| **Inês Ferreira** | `ines.carrier@seed.yamba.dev` | Trajet Lisbonne → São Paulo (J+5), un deal en attente et un deal terminé **avec fenêtre de notation ouverte**. |
| **Adebayo Okonkwo** | `adebayo.carrier@seed.yamba.dev` | Trajet Londres → Lagos (parti depuis 2 jours), un colis en transit et un litige `YAM-2042`. |
| **Linh Nguyễn** | `linh.carrier@seed.yamba.dev` | Trajet Paris → Hô Chi Minh-Ville (parti hier), un colis en transit, une demande expirée. |
| **Joséphine Ilunga** | `josephine.carrier@seed.yamba.dev` | Trajet Bruxelles → Kinshasa (J+7), **aucun kilo réservé** : trajet libre. Un refus et une annulation à l'historique. |

#### Les six Expéditeurs — aucun profil Voyageur

Ce sont les bons comptes pour tester l'onboarding Voyageur **depuis zéro** (chapitre 5.6) : rien n'est pré-rempli chez eux.

| Compte | Email | Ce qu'il porte |
|---|---|---|
| **Aminata Diallo** | `aminata.shipper@seed.yamba.dev` | L'Expéditrice de référence. Six envois : une demande en attente, une annulation, un colis en transit, un envoi terminé, un envoi dont le versement du Voyageur est en échec, une annulation après départ avec retenue à arbitrer. |
| **Pauline Lemaire** | `pauline.shipper@seed.yamba.dev` | Porte **le seul deal accepté avec une conversation ouverte**, un rendez-vous proposé et un message signalé. C'est le compte à utiliser pour toute la messagerie. |
| **João Santos** | `joao.shipper@seed.yamba.dev` | Une demande refusée, une demande en attente, un colis **livré** (donc une confirmation ou un signalement possible). |
| **Chinwe Eze** | `chinwe.shipper@seed.yamba.dev` | Une demande expirée, un colis en transit, et **le litige `YAM-2041`** en cours. |
| **Mai Trần** | `mai.shipper@seed.yamba.dev` | Un envoi terminé avec **fenêtre de notation ouverte**, un colis en transit, et le litige `YAM-2042`. |
| **Marie-Claire Bouchard** | `marieclaire.shipper@seed.yamba.dev` | Un deal accepté sur Montréal, une annulation. |

**Compte à créer par le testeur** : un compte neuf, créé pendant la recette, sert aux chapitres 5.2 (inscription) et 5.13 (plafonds du compte neuf). Le mode d'emploi est donné en tête de chaque chapitre.

### 2.4 Les trajets du jeu d'essai

Tous sont **En ligne**, en avion, avec un lieu de remise et un lieu de livraison. Sauf mention, le prix est **9,50 €/kg**.

| Repère | Voyageur | Corridor | Départ | Capacité | Kilos déjà réservés | Particularité |
|---|---|---|---|---|---|---|
| `bzv-upcoming` | Thomas | Paris → Brazzaville | **J+10** | 23 kg | 8 kg | Porte un **billet en attente de vérification** |
| `bzv-perkg` | Thomas | Paris → Brazzaville | **J+15** | 23 kg | **0 kg** | **11,50 €/kg** · forfait soute 23 kg à **230 €** · **Électronique +20 %** · **Alimentaire refusé**. C'est le trajet de démonstration : **c'est lui qu'on réserve** dans tous les scénarios de réservation. |
| `bzv-inflight` | Thomas | Paris → Brazzaville | **J−6 (parti)** | 23 kg | 18 kg | Porte les colis en transit, livrés, en litige et terminés |
| `yul` | Marc | Paris → Montréal | J+3 | 20 kg | 10 kg | Fuseau America/Toronto |
| `gru` | Inês | Lisbonne → São Paulo | J+5 | 18 kg | 5 kg | |
| `los` | Adebayo | Londres → Lagos | J−2 (parti) | 23 kg | 10 kg | Départ dépassé de plus de 48 h : le signalement « jamais livré » y est ouvert |
| `sgn` | Linh | Paris → Hô Chi Minh-Ville | J−1 (parti) | 15 kg | 4 kg | |
| `fih` | Joséphine | Bruxelles → Kinshasa | J+7 | 23 kg | **0 kg** | Trajet entièrement libre, second choix pour une réservation |

### 2.5 Les deals du jeu d'essai qu'il faut connaître

Le **code de livraison est `742891`** sur **tout deal déjà pris en charge**. Il ne s'affiche jamais côté Voyageur : le testeur le connaît parce qu'il est de recette, pas parce que l'écran le lui donne.

| Repère | Statut | Expéditeur → Voyageur | À quoi il sert dans ce cahier |
|---|---|---|---|
| `bzv-pending` | En attente | Aminata → Thomas | Acceptation, refus, annulation avant acceptation |
| `bzv-accepted` | Accepté | **Pauline** → Thomas | **Toute la messagerie** : conversation, rendez-vous proposé, message signalé |
| `bzv-picked` | En transit | Aminata → Thomas | Suivi Expéditeur, carte du code, régénération, partage du suivi |
| `bzv-tracking` | En transit | Pauline → Thomas | Les trois jalons déjà confirmés (aéroport, décollage, atterrissage) |
| `los-picked` | En transit | Chinwe → Adebayo | Signalement « jamais livré » (départ + 48 h dépassé) |
| `sgn-picked` | En transit | Mai → Linh | Remise avec le code `742891` |
| `bzv-delivered` | Livré | João → Thomas | Confirmation anticipée **ou** ouverture d'un litige |
| `yul-delivered` | Livré | Aminata → Marc | Second deal livré, période de vérification |
| `bzv-disputed` | Litige | Chinwe → Thomas | Dossier **`YAM-2041`**, versement gelé |
| `los-disputed` | Litige | Mai → Adebayo | Dossier **`YAM-2042`** |
| `bzv-completed` | Terminé | Mai → Thomas | **Fenêtre de notation ouverte**, versement envoyé |
| `gru-completed` | Terminé | Inês → Inês | Seconde fenêtre de notation ouverte |
| `bzv-completed-blocked` | Terminé | Aminata → Thomas | **Versement en échec** « finalise ton compte Stripe » côté Voyageur |
| `bzv-reversed` | Terminé | Pauline → Thomas | **Versement renversé**, « sous examen » |
| `bzv-held` | Annulé | Aminata → Thomas | Annulation **après le départ** : retenue à arbitrer |

### 2.6 Variables de configuration et scénarios non testables

Le tableau ci-dessous est à remplir **avant** de commencer. Chaque case « absente » impose un verdict `⏭` sur les scénarios listés.

| Fonction | Variables à poser | Où | Sans elles |
|---|---|---|---|
| **Téléversement de photos** | `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT` (racine) + `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY`, `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` (`apps/user-ui/.env.local`) | racine + front | **Aucun repli.** Avatar, photos de colis, photos de prise en charge, photos de remise, photos de litige, justificatifs : tout échoue. `⏭` sur WEB-PRO-5, WEB-PRO-6, WEB-DOC-*, WEB-RSV-9, WEB-PIC-4, WEB-REM-5, WEB-LIT-4. Les clés doivent être **dans le `.env` racine** : si elles ne sont que dans `apps/trip-service/.env`, l'envoi marche mais la **suppression** échoue en silence. |
| **Saisie de carte** | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `apps/user-ui/.env.local` | Le composant de paiement ne s'affiche pas. `⏭` sur WEB-RSV-16 (carte refusée). Le reste du parcours reste jouable grâce au fournisseur fictif. |
| **Autorisation et capture** | `STRIPE_SECRET_KEY` | racine | **Repli disponible et recommandé** : sans cette clé, un fournisseur de paiement **fictif** joue tout le parcours (autorisation, capture, remboursement, versement) sans argent réel. Le jeu d'essai est déjà posé sur ce fournisseur. Un bandeau « Mode test » doit alors apparaître à l'étape 4 de la réservation. |
| **Onboarding Voyageur réel** | `STRIPE_SECRET_KEY` + Connect activé sur le compte Stripe | racine | Le bouton « Configurer Stripe » ne mène nulle part. `⏭` sur WEB-VOY-4 à WEB-VOY-7. Le **contournement de recette** est d'utiliser un Voyageur du jeu d'essai, déjà complet, pour tout ce qui suit l'onboarding. |
| **Connexion Google** | `GOOGLE_CLIENT_ID` (racine) **et** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (front), **même valeur** ; origines JavaScript autorisées dans la console Google : `http://localhost:3000` | racine + front | Le bouton affiche « Connexion Google bientôt disponible » et reste inactif — **c'est le comportement voulu**, pas une anomalie. `⏭` sur WEB-INS-9 à WEB-INS-12. Le scénario WEB-INS-8 (bouton inactif) reste, lui, testable et **doit** être joué. |
| **Autocomplétion d'adresses** | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (APIs Places et Maps JavaScript activées) | front | **Aucun repli.** Aucune ville ne se propose : la création de trajet et la création d'alerte de route deviennent impossibles. `⏭` sur WEB-TRJ-2 à WEB-TRJ-14, WEB-ALR-*, WEB-VOY-2. |
| **Mesure d'audience** | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (front, région **EU**) ; `POSTHOG_API_KEY`, `POSTHOG_HOST` (racine) | front + racine | **Aucune bannière de consentement ne s'affiche.** `⏭` sur tout le chapitre 5.27 (WEB-ANA-*). Le front doit être **redémarré** après ajout. |
| **Emails** | `EMAIL_PROVIDER=smtp`, `SMTP_HOST=localhost`, `SMTP_PORT=1025` | racine | **Repli disponible** : sans aucune variable, un fournisseur fictif garde les emails en mémoire — ils n'arrivent jamais dans Mailpit. Toutes les vérifications « email dans Mailpit » deviennent `⏭`. **Poser ces trois variables est fortement recommandé** : une grande partie de la valeur de ce cahier est dans la vérification des emails. |
| **Événements** | Redpanda démarré (`docker compose up -d`), `OUTBOX_RELAY_ENABLED`, `MESSAGING_RELAY_ENABLED`, `NOTIFICATION_CONSUMER_ENABLED` non désactivés | racine | Sans Redpanda, l'application fonctionne mais **aucune notification in-app ni email déclenché par un événement de deal n'arrive**. C'est la panne la plus trompeuse de la recette : un scénario « email attendu » échouerait à tort. Vérifier ce point **avant** de consigner une anomalie d'email. |
| **Code de livraison** | `DELIVERY_CODE_ENCRYPTION_KEY` | racine | Hors production, une clé de développement est dérivée automatiquement : pas de blocage. |
| **Erreurs** | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | racine + front | Sans elles, la page d'erreur affiche une référence d'incident **vide**. Le scénario WEB-ERR-3 (référence copiable) passe alors en `⏭`. |

### 2.7 Données à préparer avant de commencer

1. **Un compte neuf.** Créé au chapitre 5.2 (WEB-INS-6) avec une adresse libre, par exemple `recette+neuf@seed.yamba.dev`. Il sert au chapitre 5.13. Ne pas le réutiliser pour autre chose.
2. **Un second compte neuf**, créé le même jour, pour les scénarios de suppression de compte (chapitre 5.25) — la suppression est irréversible et interdirait toute reprise.
3. **Un fichier image de 500 Ko** (JPEG ou PNG) et **un fichier image de plus de 2 Mo**, sous la main, pour l'avatar.
4. **Trois fichiers image de 1 à 2 Mo** pour les photos de colis et de prise en charge, et **un fichier de plus de 10 Mo** pour tester le refus.
5. **Un fichier PDF de moins de 5 Mo** pour le justificatif de billet.
6. **La date du jour notée en tête de la fiche de consignation** : plusieurs scénarios raisonnent en J+n par rapport au jour du seed.

---

## 3. Conventions

### 3.1 Numérotation

Chaque scénario porte un identifiant **`WEB-<DOMAINE>-<n>`**, où `<DOMAINE>` est le code à trois lettres du chapitre (voir le tableau du §1.2) et `<n>` un numéro qui ne change jamais. Un scénario retiré laisse son numéro vacant ; un scénario ajouté prend le numéro suivant, jamais un numéro libéré.

Quand un scénario reprend une ligne d'une grille de recette déjà existante dans `context/YAMBA-DOC-METIER.md` ou dans `context/YAMBA-RECETTE-GLOBALE-2026-09.md`, l'identifiant d'origine est rappelé entre crochets, par exemple **`[SES2]`** ou **`[FCH30]`**. Les deux références désignent le même test : consigner sous l'identifiant `WEB-…`, et reporter le verdict dans la grille d'origine si elle est encore utilisée.

### 3.2 Verdicts

| Symbole | Signification | Quand l'employer |
|---|---|---|
| ✅ | **Conforme** | Tout le résultat attendu est observé, sans exception ni écart de libellé. |
| ❌ | **Non conforme** | Au moins un point du résultat attendu manque, diffère ou plante. Ouvre obligatoirement une ligne dans la table des anomalies (§8.2). |
| ⏭ | **Non testable** | Le scénario dépend d'une configuration absente (§2.6), d'un cron non joué, ou d'un accès manquant. La note **doit dire pourquoi** — un `⏭` sans motif vaut un `❌`. |
| ⬜ | **À faire** | État initial. Aucun scénario ne doit rester `⬜` à la clôture. |

Les `⏭` sont **exclus** du calcul du taux de conformité. Les `⬜` ne le sont pas : ils comptent comme non joués et empêchent la sortie.

### 3.3 Gravité

La gravité est portée par le **scénario**, pas par l'anomalie : elle dit ce que coûte son échec. Elle est fixée dans ce cahier et ne se renégocie pas pendant la session.

| Gravité | Définition | Conséquence d'un ❌ |
|---|---|---|
| **Bloquant** | Le parcours principal est impossible, ou de l'argent, un code de livraison, une donnée personnelle sont en jeu. | Interdit la sortie de recette. Correction avant toute autre chose. |
| **Majeur** | Une fonction annoncée ne marche pas, ou un membre est induit en erreur, mais un contournement existe. | Interdit la sortie de recette si plus de trois anomalies majeures sont ouvertes. |
| **Mineur** | Défaut d'affichage, de libellé, de confort. | N'interdit pas la sortie ; entre au journal des correctifs. |

### 3.4 Une étape = une action observable

Chaque ligne d'étape décrit **un seul geste** (un clic, une saisie, un chargement de page) et se termine par quelque chose que l'œil peut constater. Trois règles d'écriture, que le testeur peut opposer au cahier lui-même s'il les trouve enfreintes :

1. **Pas d'étape composée.** « Remplis le formulaire et valide » n'est pas une étape ; « Saisis `3` dans le champ « Poids (kg) » » en est une.
2. **Une valeur exacte.** Quand une valeur compte, elle est écrite (`2,5`, `450`, `742891`). Quand elle est libre, le cahier le dit (« un texte quelconque d'au moins 50 caractères »).
3. **Le résultat attendu est vérifiable sans ouvrir le code.** Les textes que le membre doit voir sont cités **entre guillemets et mot pour mot**. Un écart de libellé est une anomalie **mineure** à consigner, jamais une raison de prononcer ✅.

Quand un libellé cité contient `{prénom}`, `{montant}` ou `{date}`, la valeur réelle se substitue à l'écran : le testeur vérifie la **phrase**, pas l'accolade.

### 3.5 Scénarios à deux navigateurs ou deux comptes

Certains scénarios exigent deux sessions vivantes en même temps (l'Expéditeur et le Voyageur, ou le même membre sur deux appareils). Ils portent la mention **⚠ deux navigateurs** en tête. Règle : **le navigateur A** porte toujours le compte nommé en premier, **le navigateur B** le second. Ne jamais utiliser deux onglets du même navigateur pour deux comptes différents : les cookies de session sont partagés et le second écrase le premier. Une **fenêtre privée** convient comme navigateur B, sauf pour les scénarios qui vérifient une mémoire d'appareil (poids mémorisé, choix de consentement).

Les scénarios qui exigent **deux onglets du même compte** (course entre deux actions concurrentes) portent la mention **⚠ deux onglets** : ceux-là se jouent bien dans le même navigateur.

### 3.6 Remise à zéro

Le jeu d'essai se remet à zéro par `npx tsx --env-file=.env packages/libs/prisma/scripts/seed-deals.ts`. Cette commande **détruit et recrée** les trajets, les deals, les conversations et les litiges des douze comptes de test ; elle **conserve** les comptes eux-mêmes et tout compte créé à la main.

Il est recommandé de rejouer le seed :

- avant le chapitre 5.12 (réservation), pour retrouver les kilos disponibles ;
- avant le chapitre 6 (parcours de bout en bout), obligatoirement ;
- après tout scénario d'annulation ou de litige joué sur un deal du jeu d'essai.

Chaque remise à zéro doit être **notée dans la fiche de consignation**, avec l'heure : elle explique les écarts d'un scénario au suivant.

### 3.7 Format d'un scénario

```
### WEB-XXX-n — Titre du scénario                                 [référence] · gravité
**Préconditions** — compte connecté, état requis, navigateur.
**Étapes** — 1. … 2. … 3. …
**Résultat attendu** — ce qui doit s'afficher, mot pour mot quand c'est un message.
**Vérification complémentaire** — email dans Mailpit, ligne en base, appel réseau. (Facultatif.)
**Verdict** ⬜   **Note** :
```

---

## 4. Ordre de déroulement conseillé

Le cahier suit l'ordre de vie du produit. Il se déroule de préférence dans l'ordre des chapitres : le compte créé au chapitre 5.2 sert au chapitre 5.13, le trajet publié au chapitre 5.7 sert au chapitre 5.9, la réservation du chapitre 5.12 alimente les chapitres 5.14 à 5.22.

Une session complète représente environ **deux journées de test**. Découpage conseillé :

| Demi-journée | Chapitres | Comptes principaux |
|---|---|---|
| 1 | 5.1 à 5.6 — découverte, comptes, profil, onboarding | Compte neuf créé sur place, Aminata, Joséphine |
| 2 | 5.7 à 5.11 — trajets, recherche, alertes, favoris | Thomas, Joséphine, Aminata |
| 3 | 5.12 à 5.19 — réservation, acceptation, messagerie, transport, remise | Aminata + Thomas (deux navigateurs) |
| 4 | 5.20 à 5.32 puis chapitre 6 — annulations, litige, notation, transverses, bout en bout | Tous |

---

## 5. Les scénarios

### 5.1 — `WEB-ACC` · Découverte, accueil et navigation

**Ce que couvre ce chapitre.** Ce qu'un visiteur voit avant d'avoir un compte : la page d'accueil, l'en-tête, le pied de page, la bascule de langue, le thème clair / sombre, et les chemins d'entrée dans le produit.

**Préconditions communes.** Fenêtre privée, aucun compte connecté, `http://localhost:3000`.

---

#### WEB-ACC-1 — La page d'accueil s'affiche pour un visiteur · gravité **bloquant**

**Préconditions** — Fenêtre privée. Aucune session.
**Étapes**
1. Ouvre `http://localhost:3000`.
2. Attends la fin du chargement (le squelette gris doit disparaître).

**Résultat attendu**
- La page d'accueil s'affiche en français, avec l'en-tête Yamba en haut.
- L'en-tête contient au moins : le logo Yamba, un lien « Rechercher un trajet », un lien « Partager un trajet », un bouton « Connexion » et un bouton « Créer un compte ».
- Une barre de recherche est présente avec les champs « Ville de départ », « Ville d'arrivée » et « Date ».
- Le pied de page contient les rubriques « Découvrir », « Entreprise », « Légal », et la phrase « La marketplace P2P qui repense l'envoi de colis légers entre particuliers. »
- Aucun squelette gris ne subsiste après 5 secondes.

**Vérification complémentaire** — Aucune erreur rouge dans la console du navigateur. Si la page reste un squelette, vérifier `allowedDevOrigins` dans `next.config.js` (Next répond 403 sur `/_next/*`).
**Verdict** ⬜   **Note** :

---

#### WEB-ACC-2 — Bascule de langue FR → EN pour un visiteur · gravité **majeur**

**Préconditions** — Suite de WEB-ACC-1.
**Étapes**
1. Clique le sélecteur de langue de l'en-tête (info-bulle « Changer de langue »).
2. Choisis l'anglais.

**Résultat attendu**
- L'adresse de la page passe de `/fr` à `/en`.
- Toute la page est en anglais : l'en-tête, la barre de recherche, le pied de page.
- Aucune clé technique brute (du type `home.hero.title`) n'apparaît à la place d'un texte.

**Vérification complémentaire** — Une clé affichée telle quelle signale une clé absente d'un des deux fichiers de traduction : anomalie **majeure**, préciser la clé.
**Verdict** ⬜   **Note** :

---

#### WEB-ACC-3 — Retour au français et persistance · gravité **mineur**

**Étapes**
1. Depuis `/en`, rebascule en français.
2. Recharge la page (F5).

**Résultat attendu** — La page revient sur `/fr` et **y reste** après le rechargement.
**Verdict** ⬜   **Note** :

---

#### WEB-ACC-4 — Thème clair / sombre · gravité **mineur**

**Étapes**
1. Clique le bouton de thème (info-bulle « Changer de thème »).
2. Sélectionne « Mode sombre ».
3. Recharge la page.

**Résultat attendu**
- La page passe en fond sombre, les textes restent lisibles (aucun texte foncé sur fond foncé).
- Après rechargement, le mode sombre est conservé.
- Le choix « Mode clair » revient à l'affichage d'origine.

**Verdict** ⬜   **Note** :

---

#### WEB-ACC-5 — Le pied de page mène aux textes légaux · gravité **majeur**

**Étapes**
1. Dans le pied de page, clique « Conditions générales ».
2. Reviens en arrière, clique « Confidentialité ».

**Résultat attendu** — Les deux pages s'ouvrent et affichent un texte, pas une page vide ni une page introuvable. Ce sont les textes référencés par la case d'acceptation de l'inscription.
**Verdict** ⬜   **Note** :

---

#### WEB-ACC-6 — Les réseaux sociaux annoncés comme inactifs · gravité **mineur**

**Étapes**
1. Survole les icônes sociales du pied de page (Instagram, X, Facebook).

**Résultat attendu** — Elles portent la mention « Bientôt disponible » et ne mènent nulle part. Un lien qui ouvrirait une page réelle est une anomalie **mineure**.
**Verdict** ⬜   **Note** :

---

#### WEB-ACC-7 — « Partager un trajet » ouvre la porte d'identité · gravité **majeur**

**Préconditions** — Visiteur non connecté.
**Étapes**
1. Clique « Partager un trajet » dans l'en-tête.

**Résultat attendu**
- Une fenêtre s'ouvre **par-dessus la page courante** : la page ne change pas.
- Titre : « Connecte-toi pour partager un trajet ».
- Sous-titre : « Publier un trajet engage un Voyageur identifié : Yamba a besoin de savoir qui transporte. Ton trajet t'attend après connexion. »
- La fenêtre contient un formulaire de connexion (e-mail, mot de passe) et le bouton Google.
- Un lien « Plus tard » et une croix de fermeture sont présents.

**Vérification complémentaire** — La croix de fermeture doit être visible aussi en émulation mobile (voir WEB-NRG-3).
**Verdict** ⬜   **Note** :

---

#### WEB-ACC-8 — « Plus tard », Échap et clic sur le fond referment sans conséquence · gravité **mineur**

**Étapes**
1. Rouvre la porte d'identité (WEB-ACC-7).
2. Clique « Plus tard ». Rouvre-la.
3. Appuie sur la touche `Échap`. Rouvre-la.
4. Clique sur le fond grisé, en dehors de la fenêtre.

**Résultat attendu** — Les trois gestes referment la fenêtre. La page d'origine est intacte, aucune redirection, aucun message d'erreur.
**Verdict** ⬜   **Note** :

---

#### WEB-ACC-9 — La recherche depuis l'accueil · gravité **bloquant**

**Préconditions** — `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` posée, sinon `⏭`.
**Étapes**
1. Clique le champ « Ville de départ » et saisis `Paris`.
2. Choisis une proposition de la liste.
3. Clique « Ville d'arrivée » et saisis `Brazzaville`.
4. Choisis une proposition.
5. Clique « Rechercher ».

**Résultat attendu**
- La page `/search` s'ouvre.
- Le titre affiche « Trajets pour Paris → Brazzaville ».
- Au moins les trois trajets Paris → Brazzaville du jeu d'essai apparaissent (voir §2.4).

**Vérification complémentaire** — Si aucune proposition n'apparaît à l'étape 1, la clé Google Maps est absente : `⏭`, et tous les scénarios marqués « autocomplétion » suivent.
**Verdict** ⬜   **Note** :

---

#### WEB-ACC-10 — Le bouton « Intervertir départ et destination » · gravité **mineur**

**Étapes**
1. Sur `/search`, avec Paris → Brazzaville renseigné, clique le bouton d'inversion (libellé accessible « Intervertir départ et destination »).

**Résultat attendu** — Le départ devient Brazzaville, la destination devient Paris, et les résultats sont recalculés (probablement aucun trajet : voir WEB-RCH-9).
**Verdict** ⬜   **Note** :

---

#### WEB-ACC-11 — L'accueil connecté diffère de l'accueil visiteur · gravité **mineur**

**Préconditions** — Connecté avec `aminata.shipper@seed.yamba.dev`.
**Étapes**
1. Reviens sur `/`.

**Résultat attendu**
- L'en-tête ne montre plus « Connexion » ni « Créer un compte » mais un menu utilisateur (libellé accessible « Menu utilisateur »), une cloche de « Notifications » et une entrée « Messages ».
- Le menu utilisateur contient au moins : « Mon compte », « Mes envois », « Messages », « Mes favoris », « Notifications », « Aide », « Déconnexion », plus les sections « Compte », « Préférences », « Support ».

**Verdict** ⬜   **Note** :

---

#### WEB-ACC-12 — La déconnexion · gravité **majeur**

**Étapes**
1. Depuis le menu utilisateur, clique « Déconnexion ».

**Résultat attendu** — Retour à un état visiteur : l'en-tête affiche de nouveau « Connexion » et « Créer un compte ». Un rechargement ne réouvre pas la session.
**Vérification complémentaire** — Dans les outils de développement, onglet Application, les cookies `access_token` et `refresh_token` ont disparu.
**Verdict** ⬜   **Note** :

---

### 5.2 — `WEB-INS` · Inscription par code email, consentement, Google

**Ce que couvre ce chapitre.** La création d'un compte par adresse email avec code à six chiffres, les règles de mot de passe, l'acceptation des conditions, le barème de blocage sur code erroné, et le parcours Google.

**Préconditions communes.** Fenêtre privée. Mailpit ouvert sur `http://localhost:8025`.

**Adresse de travail** — utilise `recette+neuf@seed.yamba.dev` pour le compte neuf. Si un scénario demande une seconde adresse libre, ajoute un suffixe (`recette+neuf2@…`).

---

#### WEB-INS-1 — L'écran d'inscription · gravité **bloquant**

**Étapes**
1. Depuis l'accueil, clique « Créer un compte ».

**Résultat attendu**
- L'adresse est `/fr/register`.
- L'écran porte la mention de confiance « Inscription sécurisée », le titre « Deviens Voyageur » et le sous-titre « Envoie ou transporte des colis, en toute simplicité. »
- Les champs sont : « Prénom » (indice « Aminata »), « Nom » (indice « Diallo »), « E-mail » (indice « prenom@email.com »), « Mot de passe », « Confirmer le mot de passe ».
- Une case unique d'acceptation : « J'accepte les **Conditions générales d'utilisation** et la **Politique de confidentialité** de Yamba. », les deux textes en gras étant des liens.
- Un bouton « Créer mon compte », un séparateur « ou par e-mail », un bouton Google et un bouton « Continuer avec Facebook ».
- En bas : « Déjà membre ? » suivi de « Connecte-toi ».

**Note de recette** — Le titre « Deviens Voyageur » sur un écran d'inscription générique (un Expéditeur qui s'inscrit n'a pas vocation à devenir Voyageur) est à consigner comme **écart de libellé, gravité mineure**, si l'équipe produit attendait « Crée ton compte Yamba ». Le verdict du scénario reste ✅ si tout le reste est conforme.
**Verdict** ⬜   **Note** :

---

#### WEB-INS-2 — Le bouton Facebook est inerte · gravité **mineur**

**Étapes**
1. Clique « Continuer avec Facebook ».

**Résultat attendu** — Rien ne se passe : aucune fenêtre, aucune redirection, aucune erreur affichée. C'est une décision de recette assumée ; un bouton qui déclencherait un appel réseau serait une anomalie.
**Verdict** ⬜   **Note** :

---

#### WEB-INS-3 — Les champs obligatoires sont nommés un par un · gravité **majeur**

**Étapes**
1. Laisse tous les champs vides et clique « Créer mon compte ».

**Résultat attendu** — Sous chaque champ, un message distinct :
- Prénom : « Le prénom est requis. »
- Nom : « Le nom est requis. »
- E-mail : « L'e-mail est requis. »
- Mot de passe : « Le mot de passe est requis. »
Aucun message global du type « Le formulaire est invalide ».
**Verdict** ⬜   **Note** :

---

#### WEB-INS-4 — L'adresse email est contrôlée · gravité **majeur**

**Étapes**
1. Saisis `Recette` en Prénom, `Neuf` en Nom.
2. Saisis `pas-un-email` dans « E-mail ».
3. Clique hors du champ.

**Résultat attendu** — Sous le champ : « Saisis un e-mail valide. »
**Verdict** ⬜   **Note** :

---

#### WEB-INS-5 — Le mot de passe : une règle violée, une phrase · gravité **majeur**

Chaque essai se fait avec Prénom `Recette`, Nom `Neuf`, E-mail `recette+neuf@seed.yamba.dev`.

| # | Mot de passe saisi | Message attendu sous le champ |
|---|---|---|
| a | `abc` | Une phrase nommant la longueur minimale de 8 caractères |
| b | `motdepasse` | Une phrase nommant l'absence de majuscule (ou le premier critère manquant), **pas** « ne respecte pas tous les critères » |
| c | `Motdepasse1` | Une phrase nommant l'absence de caractère spécial |
| d | `Recette-2026!` | Une phrase disant que le mot de passe **ne doit pas contenir le prénom** |
| e | `01/01/2000!` | Une phrase disant que ce n'est pas une date valable comme mot de passe |
| f | `Abcdefg1!` ou `Aaaaaaa1!` | Une phrase nommant la suite ou la répétition |

**Résultat attendu** — Pour chaque cas, **une seule** règle est nommée, dans une phrase compréhensible, en français, sous le champ « Mot de passe ». Un message générique est une anomalie **majeure**.
**Vérification complémentaire** — Un indicateur de force du mot de passe accompagne la saisie.
**Verdict** ⬜   **Note** :

---

#### WEB-INS-6 — Création du compte neuf jusqu'au code · gravité **bloquant**

**Étapes**
1. Prénom `Recette`, Nom `Neuf`, E-mail `recette+neuf@seed.yamba.dev`.
2. Mot de passe `Yamba-Dev-2026!`, puis le même dans « Confirmer le mot de passe ».
3. **Ne coche pas** la case d'acceptation. Clique « Créer mon compte ».
4. Constate le refus, puis coche la case.
5. Clique « Créer mon compte ».

**Résultat attendu**
- Étape 3 : le compte n'est **pas** créé ; un message dit que l'acceptation est nécessaire.
- Étape 5 : l'écran passe à la vérification, adresse `/fr/register/verify`.
- Le nouvel écran porte « Vérification sécurisée », le titre « Plus qu'une étape ! » et le sous-titre « Nous avons envoyé un code à 6 chiffres à : » suivi de l'adresse saisie.
- Un compte à rebours « Code valable » démarre à **10:00** et décroît seconde par seconde.
- Un champ « Saisis ton code » à six cases, l'indice « Astuce : tu peux coller le code directement. », et le bouton « Valider mon code ».

**Vérification complémentaire** — Dans Mailpit, un email dont le sujet contient « Ton code d'activation Yamba » est arrivé, avec un code à six chiffres. Le message doit annoncer la **même** validité de 10 minutes que l'écran.
**Verdict** ⬜   **Note** :

---

#### WEB-INS-7 — Le barème de blocage sur code erroné · gravité **majeur**

**Préconditions** — Suite immédiate de WEB-INS-6, code non encore saisi.
**Étapes**
1. Saisis `000000` et valide. Note le message.
2. Recommence avec `000001`, `000002`, `000003` (soit 4 erreurs au total).
3. Saisis une 5ᵉ valeur fausse, `000004`.

**Résultat attendu**
- Erreurs 1 à 4 : « Code incorrect. » suivie du nombre d'essais restants (« … essais restants avant invalidation du code », ou « … essai restant … » au singulier).
- 5ᵉ erreur : « Saisie bloquée temporairement. » avec « Réessaie dans » et un compte à rebours d'environ **1 minute**, plus l'explication « Pour ta sécurité, la saisie est bloquée après plusieurs tentatives incorrectes. »
- La saisie est désactivée pendant le blocage.

**Vérification complémentaire** — Le blocage doit **survivre à un rechargement de la page** : le compteur vit sur le serveur.
**Verdict** ⬜   **Note** :

---

#### WEB-INS-8 — « Renvoyer le code » et son délai · gravité **mineur**

**Étapes**
1. Attends la fin du blocage d'une minute.
2. Clique « Renvoyer le code ».

**Résultat attendu**
- Un message « Code renvoyé » puis « Un nouveau code a été envoyé. Vérifie ta boîte mail. »
- Le bouton devient « Renvoyer dans » suivi d'un décompte : on ne peut pas renvoyer en rafale.
- Un **nouvel** email arrive dans Mailpit ; le compte à rebours de l'écran repart à 10:00.

**Vérification complémentaire** — Le compteur d'essais **ne repart pas** à zéro après un renvoi de code : c'est la règle. Si un nouveau lot de cinq essais est offert, c'est une anomalie **majeure**.
**Verdict** ⬜   **Note** :

---

#### WEB-INS-9 — Activation du compte avec le bon code · gravité **bloquant**

**Étapes**
1. Récupère le code du **dernier** email reçu dans Mailpit.
2. Colle-le dans le champ à six cases (le collage doit remplir les six cases d'un coup).
3. Clique « Valider mon code ».

**Résultat attendu**
- Le compte est créé. L'écran de connexion s'affiche avec le message « Ton compte est activé. Connecte-toi pour commencer. » (ou le bandeau « Compte activé » / « Ton adresse est vérifiée. Connecte-toi avec ton mot de passe pour commencer. »).
- Un email « Bienvenue » est arrivé dans Mailpit.

**Vérification complémentaire** — En base, une ligne `ConsentLog` porte les versions des conditions et l'horodatage serveur ; le compte porte `preferredLocale: "fr"` (la langue de l'écran au moment de l'inscription).
**Verdict** ⬜   **Note** :

---

#### WEB-INS-10 — Une adresse déjà utilisée est refusée · gravité **majeur**

**Étapes**
1. Reviens sur `/fr/register`.
2. Saisis les mêmes prénom, nom, mot de passe, et l'adresse `aminata.shipper@seed.yamba.dev`.
3. Coche l'acceptation et valide.

**Résultat attendu** — Sous le champ e-mail : « Un compte existe déjà avec cet e-mail ». Aucun code n'est envoyé, aucune inscription en attente n'est créée.
**Vérification complémentaire** — Aucun nouvel email dans Mailpit.
**Verdict** ⬜   **Note** :

---

#### WEB-INS-11 — « Recommencer » abandonne l'inscription en attente · gravité **mineur**

**Étapes**
1. Lance une inscription avec une adresse libre jusqu'à l'écran de code.
2. Clique « Trompé d'adresse e-mail ? » puis « Recommencer ».

**Résultat attendu** — Une confirmation « Sûr·e ? Tu devras recommencer toute l'inscription depuis le début. » ; en confirmant, retour au formulaire d'inscription vide.
**Verdict** ⬜   **Note** :

---

#### WEB-INS-12 — Le bouton Google sans configuration · gravité **majeur**

**Préconditions** — `NEXT_PUBLIC_GOOGLE_CLIENT_ID` **absente** (état constaté au 6 septembre 2026).
**Étapes**
1. Sur `/fr/register` ou `/fr/login`, observe le bouton Google.

**Résultat attendu** — Le bouton affiche « Connexion Google bientôt disponible » et **ne réagit pas** au clic. C'est le comportement voulu : verdict ✅.
**Note importante** — Si la variable est posée, ce scénario passe en `⏭` et les scénarios WEB-INS-13 à WEB-INS-16 deviennent testables.
**Verdict** ⬜   **Note** :

---

#### WEB-INS-13 — Connexion Google : nouvelle personne, sans accord · gravité **majeur** · **⏭ sans `GOOGLE_CLIENT_ID`**

**Préconditions** — Identifiants Google posés (racine **et** front, même valeur), origine `http://localhost:3000` autorisée dans la console Google. Un compte Google dont l'adresse **n'existe pas** chez Yamba.
**Étapes**
1. Clique le bouton Google et choisis ce compte dans la fenêtre Google.
2. À l'écran suivant, ne coche rien et ferme la fenêtre.

**Résultat attendu**
- L'écran intermédiaire s'intitule « Finalise ton compte » avec le sous-titre « Google a confirmé ton adresse {email}. Il ne manque que ton accord. »
- Il contient la case « J'accepte les Conditions générales d'utilisation et la Politique de confidentialité de Yamba. », le bouton « Créer mon compte » et « Annuler ».
- En fermant sans cocher : **aucun compte n'est créé**, la page d'origine est inchangée, aucun email n'est envoyé.

**Vérification complémentaire** — Aucune ligne nouvelle dans la collection des utilisateurs.
**Verdict** ⬜   **Note** :

---

#### WEB-INS-14 — Connexion Google : accord donné, compte créé · gravité **majeur** · **⏭ sans `GOOGLE_CLIENT_ID`**

**Étapes**
1. Reprends le parcours Google avec le même compte.
2. Coche l'acceptation, clique « Créer mon compte ».

**Résultat attendu**
- Message « Bienvenue sur Yamba, {prénom}. »
- Le compte est créé **sans mot de passe** ; la session s'ouvre ; retour sur la page visée avant le clic.
- Un email de bienvenue arrive dans Mailpit.

**Vérification complémentaire** — Le compte porte une identité Google liée et aucune empreinte de mot de passe.
**Verdict** ⬜   **Note** :

---

#### WEB-INS-15 — Rattachement d'un compte Yamba existant à Google · gravité **majeur** · **⏭ sans `GOOGLE_CLIENT_ID`**

**Préconditions** — Un compte Google dont l'adresse **est déjà** celle d'un compte Yamba vérifié.
**Étapes**
1. Depuis `/fr/login`, clique le bouton Google et choisis ce compte.

**Résultat attendu** — Connexion directe, message « Ton compte Yamba est maintenant relié à Google. » Les deux chemins (mot de passe et Google) fonctionnent ensuite pour ce compte.
**Verdict** ⬜   **Note** :

---

#### WEB-INS-16 — Refus d'une adresse Google non vérifiée · gravité **majeur** · **⏭ sans `GOOGLE_CLIENT_ID`**

**Étapes**
1. Utilise un compte Google dont l'adresse n'est pas vérifiée chez Google.

**Résultat attendu** — Message « Ton adresse Google n'est pas vérifiée : vérifie-la chez Google ou inscris-toi par e-mail. » Aucun compte créé.
**Verdict** ⬜   **Note** :

---

### 5.3 — `WEB-CNX` · Connexion, « Rester connecté », session, appareils

**Ce que couvre ce chapitre.** La connexion par mot de passe, les deux profils de session, la réouverture d'une session expirée sans perdre la page, et la gestion des appareils connectés.

---

#### WEB-CNX-1 — L'écran de connexion · gravité **bloquant**

**Étapes**
1. Ouvre `/fr/login` en fenêtre privée.

**Résultat attendu**
- Mention « Connexion sécurisée », titre « Connecte-toi », sous-titre « Reprends là où tu t'es arrêté·e. »
- Champs « E-mail » (indice « prenom@email.com ») et « Mot de passe », avec un bouton d'affichage du mot de passe (libellé accessible « Afficher le mot de passe »).
- Le lien « Oublié ? » à côté du champ mot de passe.
- Une case **décochée** « Rester connecté sur cet appareil » avec l'aide « Coché : 7 jours sans activité. Sinon : déconnexion après 60 minutes sans activité. »
- Le bouton « Se connecter », le séparateur « ou par e-mail », le bouton Google, « Continuer avec Facebook », et en bas « Pas encore membre ? » / « Inscris-toi ».

**Vérification complémentaire** — La case « Rester connecté sur cet appareil » doit être **décochée** à l'ouverture. Cochée par défaut = anomalie **majeure**.
**Verdict** ⬜   **Note** :

---

#### WEB-CNX-2 — Identifiants incorrects · gravité **majeur**

**Étapes**
1. Saisis `aminata.shipper@seed.yamba.dev` et le mot de passe `MauvaisMotDePasse1!`.
2. Clique « Se connecter ».

**Résultat attendu** — Message « E-mail ou mot de passe incorrect. » Le message est le même pour une adresse inexistante : il ne révèle jamais si le compte existe.
**Étapes complémentaires** — Recommence avec une adresse inexistante `inconnu@seed.yamba.dev` : **le message doit être identique**. Une différence est une anomalie **majeure** (fuite d'information).
**Verdict** ⬜   **Note** :

---

#### WEB-CNX-3 — Connexion réussie, session standard · gravité **bloquant**

**Étapes**
1. Saisis `aminata.shipper@seed.yamba.dev` / `Yamba-Dev-2026!`.
2. Laisse « Rester connecté sur cet appareil » **décochée**.
3. Clique « Se connecter ».

**Résultat attendu** — Redirection vers l'espace membre. L'en-tête affiche le menu utilisateur, la cloche de notifications et « Messages ». Le prénom « Aminata » apparaît dans le menu.
**Vérification complémentaire** — Cookies `access_token` et `refresh_token` présents.
**Verdict** ⬜   **Note** :

---

#### WEB-CNX-4 — Trop de tentatives · gravité **mineur**

**Étapes**
1. Depuis une fenêtre privée, enchaîne une dizaine de tentatives de connexion avec un mauvais mot de passe.

**Résultat attendu** — À partir d'un certain nombre, le message devient « Trop de tentatives. Réessaie dans quelques instants. »
**Note** — Ce scénario peut consommer le quota du limiteur de débit pour toutes les requêtes de la fenêtre : le rejouer en dernier ou attendre un quart d'heure.
**Verdict** ⬜   **Note** :

---

#### WEB-CNX-5 — Session expirée : la fenêtre s'ouvre sur place · gravité **bloquant** · `[SES]`

**Préconditions** — Connecté en session standard, sur une page riche (par exemple le suivi d'un envoi `/fr/bookings/<id>`).
**Étapes**
1. Dans les outils de développement, onglet Application, supprime les cookies `access_token` **et** `refresh_token`.
2. Sans recharger la page, déclenche une action qui appelle le serveur (par exemple ouvrir un onglet du tableau de bord, ou cliquer un bouton d'action).

**Résultat attendu**
- **La page ne change pas** et ne se transforme pas en écran d'erreur.
- Une fenêtre s'ouvre par-dessus, titre « Ta session a expiré », sous-titre « Par sécurité, une session se ferme après une heure sans activité (coche « Rester connecté » pour 7 jours). Reconnecte-toi : tu restes sur cette page. »
- Le formulaire de connexion est **dans** la fenêtre.
- Après reconnexion, la fenêtre se ferme et la page reprend là où elle était.

**Anomalie à guetter** — Un message « Erreur, réessaye », un renvoi brutal vers `/login`, ou la perte du contexte de la page : anomalie **bloquante**.
**Verdict** ⬜   **Note** :

---

#### WEB-CNX-6 — « Rester connecté » ouvre l'autre profil de session · gravité **majeur**

**Étapes**
1. Déconnecte-toi.
2. Reconnecte-toi avec Aminata en **cochant** « Rester connecté sur cet appareil ».
3. Va dans « Sécurité » puis « Appareils connectés ».

**Résultat attendu** — La ligne de la session courante porte la mention « connexion mémorisée » (ou équivalent) **en plus** de « cet appareil ». Une session ouverte sans la case ne la porte pas.
**Verdict** ⬜   **Note** :

---

#### WEB-CNX-7 — La liste des appareils connectés · gravité **majeur** · `[SES1]`

**Préconditions** — Connecté avec Aminata.
**Étapes**
1. Ouvre le tableau de bord, section « Sécurité ».
2. Ouvre « Appareils connectés ».

**Résultat attendu** — Au moins une ligne, portant : le navigateur et le système (dérivés de l'agent utilisateur, par exemple « Chrome sur macOS »), la date de dernière activité, l'adresse IP, et la mention **« cet appareil »** sur la session courante.
**Note** — Une session ouverte avant la livraison de cette fonction s'affiche « Appareil inconnu » : ce n'est pas une anomalie, c'est documenté.
**Verdict** ⬜   **Note** :

---

#### WEB-CNX-8 — Déconnecter un autre appareil · gravité **majeur** · `[SES2]` · **⚠ deux navigateurs**

**Préconditions** — Navigateur **A** : Aminata connectée. Navigateur **B** (Firefox ou profil distinct) : Aminata connectée aussi.
**Étapes**
1. Dans A, ouvre « Sécurité » › « Appareils connectés » et recharge.
2. Vérifie que **deux** appareils sont listés.
3. Sur la ligne qui n'est pas « cet appareil », clique « Déconnecter ».
4. Bascule dans B et déclenche une action serveur (recharger le tableau de bord).

**Résultat attendu**
- Étape 2 : deux lignes, une seule portant « cet appareil ».
- Étape 3 : la ligne disparaît, un message de confirmation s'affiche.
- Étape 4 : dans B, la fenêtre « Ta session a expiré » s'ouvre ou l'utilisateur est renvoyé à la connexion.

**Verdict** ⬜   **Note** :

---

#### WEB-CNX-9 — « Déconnecter les autres appareils » · gravité **majeur** · `[SES3]` · **⚠ deux navigateurs**

**Étapes**
1. Reconnecte B.
2. Dans A, clique « Déconnecter les autres appareils ».

**Résultat attendu** — Un message annonce le nombre d'appareils déconnectés (« n appareil(s) déconnecté(s) ») ; seule la ligne « cet appareil » reste ; B perd sa session à sa prochaine action.
**Verdict** ⬜   **Note** :

---

#### WEB-CNX-10 — La porte de confirmation d'un geste sensible · gravité **bloquant** · `[SES4]`

**Préconditions** — Aminata connectée. Mailpit ouvert.
**Étapes**
1. Va dans « Sécurité », rubrique du mot de passe, et clique « Changer ».

**Résultat attendu**
- Avant tout formulaire, une porte de confirmation s'ouvre avec un bouton « M'envoyer le code ».
- En cliquant, un email dont le sujet contient « Ton code de confirmation Yamba » arrive dans Mailpit.
- Le code accepté **ouvre le formulaire** de changement de mot de passe.

**Anomalie à guetter** — Si le clic répond une erreur muette sans ouvrir la porte, c'est la régression du code d'erreur `SUDO_REQUIRED` : anomalie **bloquante** (voir WEB-NRG-7).
**Verdict** ⬜   **Note** :

---

#### WEB-CNX-11 — La fenêtre de 15 minutes couvre un second geste · gravité **majeur** · `[SES5]`

**Préconditions** — Suite immédiate de WEB-CNX-10, code saisi il y a moins de 15 minutes.
**Étapes**
1. Sans quitter la session, va dans « Sécurité » › « Mes données » et clique « Télécharger mes données ».

**Résultat attendu** — **Aucun nouveau code n'est demandé** : la fenêtre ouverte couvre ce second geste. Le téléchargement démarre.
**Verdict** ⬜   **Note** :

---

#### WEB-CNX-12 — La fenêtre est liée à l'appareil · gravité **majeur** · **⚠ deux navigateurs**

**Préconditions** — Fenêtre sudo ouverte dans le navigateur A (WEB-CNX-10).
**Étapes**
1. Dans le navigateur B, avec le même compte, tente « Télécharger mes données ».

**Résultat attendu** — B redemande un code : la fenêtre de 15 minutes vaut pour l'appareil A seulement.
**Verdict** ⬜   **Note** :

---

#### WEB-CNX-13 — Un compte suspendu ne se connecte plus · gravité **majeur** · **dépend du back-office**

**Préconditions** — Un administrateur suspend le compte `marieclaire.shipper@seed.yamba.dev` depuis le back-office (voir RECETTE-02-ADMIN).
**Étapes**
1. Tente une connexion avec ce compte.

**Résultat attendu** — Message « Ton compte est suspendu. Consulte l'email reçu ou écris au support pour contester. » Aucune session n'est ouverte.
**Vérification complémentaire** — Si le compte avait une session vivante ailleurs, elle est révoquée. Ses trajets publiés disparaissent des résultats de recherche.
**Verdict** ⬜   **Note** :

---

### 5.4 — `WEB-MDP` · Mot de passe et adresse email

**Ce que couvre ce chapitre.** Le parcours « Mot de passe oublié » pour un visiteur, le changement de mot de passe et le changement d'adresse email pour un membre.

---

#### WEB-MDP-1 — Mot de passe oublié : la réponse ne révèle rien · gravité **majeur**

**Préconditions** — Fenêtre privée, non connecté.
**Étapes**
1. Depuis `/fr/login`, clique « Oublié ? ».
2. L'écran « Mot de passe oublié ? » s'ouvre. Saisis `adresse-inexistante@seed.yamba.dev`.
3. Clique « Envoyer le code ».

**Résultat attendu** — Le serveur répond que le code est envoyé, **sans dire si le compte existe**. L'écran passe à la saisie du code.
**Vérification complémentaire** — Aucun email n'arrive dans Mailpit pour cette adresse inexistante. C'est normal : le message d'écran est volontairement identique dans les deux cas.
**Verdict** ⬜   **Note** :

---

#### WEB-MDP-2 — Réinitialisation complète d'un mot de passe · gravité **bloquant**

**Préconditions** — Le compte `recette+neuf@seed.yamba.dev` créé au chapitre 5.2.
**Étapes**
1. Depuis `/fr/login`, clique « Oublié ? ».
2. Saisis `recette+neuf@seed.yamba.dev` et clique « Envoyer le code ».
3. Dans Mailpit, ouvre l'email « Ton code de réinitialisation Yamba » et relève le code.
4. Saisis le code et valide.
5. Saisis le nouveau mot de passe `Yamba-Recette-2026!` (deux fois si demandé) et valide.

**Résultat attendu**
- Étape 3 : l'email annonce une validité de **10 minutes**.
- Étape 5 : message « Mot de passe modifié avec succès », retour à la connexion.
- La connexion avec le **nouveau** mot de passe réussit ; avec l'ancien, elle échoue avec « E-mail ou mot de passe incorrect. »

**Vérification complémentaire** — Les règles de force du mot de passe s'appliquent ici aussi : essaie `abc` à l'étape 5, une phrase nommant la règle violée doit apparaître.
**Verdict** ⬜   **Note** :

---

#### WEB-MDP-3 — Le lien « Retour à la connexion » · gravité **mineur**

**Étapes**
1. Sur l'écran « Mot de passe oublié ? », clique « Retour à la connexion ».

**Résultat attendu** — Retour à `/fr/login`, aucune donnée perdue à l'écran de connexion.
**Verdict** ⬜   **Note** :

---

#### WEB-MDP-4 — Changer son mot de passe depuis Sécurité · gravité **majeur** · `[SES4]`

**Préconditions** — Connecté avec `recette+neuf@seed.yamba.dev` (le nouveau mot de passe du scénario précédent). **⚠ deux navigateurs** recommandé pour l'étape 6.
**Étapes**
1. Ouvre le tableau de bord, section « Sécurité ».
2. Clique « Changer » sur la ligne du mot de passe.
3. Franchis la porte de confirmation (« M'envoyer le code », code reçu dans Mailpit).
4. Saisis le mot de passe **actuel** comme nouveau mot de passe et valide.
5. Saisis un nouveau mot de passe valide et différent, puis valide.
6. Dans un second navigateur, où le même compte était connecté, déclenche une action.

**Résultat attendu**
- Étape 4 : refus explicite — le nouveau mot de passe doit **différer** de l'actuel.
- Étape 5 : succès. Un email « mot de passe modifié » arrive dans Mailpit.
- Étape 6 : **toutes les autres sessions sont fermées** — le second navigateur retourne à la connexion.
- La session courante, elle, reste ouverte.

**Verdict** ⬜   **Note** :

---

#### WEB-MDP-5 — Changer son adresse email : première étape · gravité **majeur** · `[SES6]`

**Préconditions** — Connecté avec `recette+neuf@seed.yamba.dev`, fenêtre de confirmation ouverte ou prête à s'ouvrir.
**Étapes**
1. Dans « Sécurité », lance le changement d'adresse email.
2. Saisis `aminata.shipper@seed.yamba.dev` (adresse déjà prise) et valide.
3. Saisis `recette+neuf2@seed.yamba.dev` (adresse libre) et valide.

**Résultat attendu**
- Étape 2 : refus « déjà utilisée par un autre compte ». Rien n'est modifié.
- Étape 3 : un email « Confirme ta nouvelle adresse » arrive **sur la nouvelle adresse** dans Mailpit, avec un code valable 10 minutes. L'adresse du compte n'a **pas encore** changé.

**Verdict** ⬜   **Note** :

---

#### WEB-MDP-6 — Changer son adresse email : confirmation · gravité **majeur** · `[SES6]`

**Étapes**
1. Saisis le code reçu sur la nouvelle adresse.

**Résultat attendu**
- L'adresse du compte devient `recette+neuf2@seed.yamba.dev`.
- L'**ancienne** adresse reçoit un email « L'adresse email de ton compte a changé », **sans lien cliquable**.
- Les autres sessions sont fermées.
- La connexion se fait désormais avec la nouvelle adresse.

**Vérification complémentaire** — Aucun code de confirmation n'a été envoyé à l'**ancienne** adresse : le code part sur la nouvelle, l'ancienne reçoit une information.
**Verdict** ⬜   **Note** :

---

### 5.5 — `WEB-PRO` · Profil, avatar et page publique

**Ce que couvre ce chapitre.** L'écran « Profil » du tableau de bord, l'avatar, la page publique `/u/<slug>`, et sa visibilité.

---

#### WEB-PRO-1 — L'écran Profil d'un Expéditeur pur · gravité **majeur** · `[PRO1]`

**Préconditions** — Connecté avec `aminata.shipper@seed.yamba.dev` (aucune page Voyageur).
**Étapes**
1. Tableau de bord › « Profil ».

**Résultat attendu**
- L'avatar est présent (une initiale par défaut, pas d'image cassée).
- Champs : prénom, nom, date de naissance.
- Deux bascules : « Page publique » et « Afficher ma ville ».
- **Aucun** champ « nom affiché » ni « présentation » : ils sont réservés aux Voyageurs.

**Verdict** ⬜   **Note** :

---

#### WEB-PRO-2 — L'écran Profil d'un Voyageur · gravité **majeur** · `[PRO2]`

**Préconditions** — Connecté avec `thomas.carrier@seed.yamba.dev`.
**Étapes**
1. Tableau de bord › « Profil ».

**Résultat attendu** — En plus des champs du scénario précédent : « nom affiché », « présentation » avec un compteur limité à **300 caractères**, et un bouton « Voir mon profil public ».
**Verdict** ⬜   **Note** :

---

#### WEB-PRO-3 — Les bornes du prénom et du nom · gravité **majeur** · `[PRO3]`

**Étapes**
1. Remplace le prénom par `A` (un seul caractère) et enregistre.
2. Remplace-le par une chaîne de 41 caractères et enregistre.
3. Rétablis `Aminata` et enregistre.

**Résultat attendu** — Les étapes 1 et 2 sont refusées avec un message **sous le champ** ; rien n'est écrit. L'étape 3 réussit et le nouveau prénom apparaît dans le menu utilisateur.
**Verdict** ⬜   **Note** :

---

#### WEB-PRO-4 — La date de naissance : 16 ans au moins, jamais affichée · gravité **majeur** · `[PRO4]`

**Étapes**
1. Saisis une date de naissance située il y a 12 ans, enregistre.
2. Saisis une date future, enregistre.
3. Saisis une date valide (par exemple il y a 30 ans), enregistre.
4. Ouvre la page publique du compte.

**Résultat attendu** — Étapes 1 et 2 refusées avec un message explicite (« Il faut avoir 16 ans au moins » ou équivalent). Étape 3 acceptée. Étape 4 : **la date de naissance n'apparaît nulle part** sur la page publique.
**Verdict** ⬜   **Note** :

---

#### WEB-PRO-5 — L'avatar : poids et format · gravité **majeur** · `[PRO5]` · **⏭ sans ImageKit**

**Étapes**
1. Sur « Profil », ajoute la photo de **plus de 2 Mo** préparée au §2.7.
2. Ajoute la photo de **500 Ko**.

**Résultat attendu**
- Étape 1 : refus immédiat côté navigateur (« Photo trop lourde » ou équivalent), **aucune requête serveur** dans l'onglet réseau.
- Étape 2 : l'avatar s'affiche sur l'écran Profil, dans l'en-tête et sur la page publique.

**Vérification complémentaire** — Onglet réseau : confirmer qu'aucun appel de téléversement n'a été émis à l'étape 1.
**Verdict** ⬜   **Note** :

---

#### WEB-PRO-6 — Changer puis retirer l'avatar · gravité **mineur** · `[PRO6]` · **⏭ sans ImageKit**

**Étapes**
1. Remplace la photo par une autre.
2. Retire la photo.

**Résultat attendu** — L'initiale par défaut revient partout. L'ancien fichier n'est plus accessible sur l'hébergeur d'images.
**Vérification complémentaire** — Ouvrir l'adresse de l'ancienne image dans un onglet : elle doit répondre « introuvable ». Si elle répond encore, c'est le piège documenté des clés ImageKit absentes du `.env` **racine** (§2.6).
**Verdict** ⬜   **Note** :

---

#### WEB-PRO-7 — La page publique d'un Voyageur · gravité **majeur**

**Préconditions** — Fenêtre privée, non connecté.
**Étapes**
1. Ouvre la page publique de Thomas (depuis un résultat de recherche, clique son nom, ou ouvre `/fr/u/seed-thomas`).

**Résultat attendu** — La page affiche :
- Le prénom suivi de l'initiale du nom (« Thomas N. »), l'avatar, « Membre depuis {date} ».
- Un bloc « En tant que Voyageur » avec le niveau de réputation. Pour un compte sans avis, le niveau est **« Nouveau Voyageur »** avec l'explication « Moins de 3 Deals terminés. » — **jamais** « ⭐ 0.0 · 0 deals ».
- La ligne de faits « {n} Deals terminés · ★ … sur … avis · … annulations tardives », avec « Aucun Deal terminé » / « pas encore d'avis » / « 0 annulation tardive » quand la donnée manque.
- Le critère du niveau suivant, du type « Prochain niveau « Voyageur confirmé » : 3 Deals terminés. »
- Les sections « Routes fréquentes », « {n} trajets disponibles », le réseau (« {n} abonnés », « abonnements »).
- Le bouton « Suivre » et le lien « Signaler ce profil ».

**Anomalie à guetter** — Une note « 0,0 » ou un compteur inventé : anomalie **majeure** (voir WEB-NRG-2).
**Verdict** ⬜   **Note** :

---

#### WEB-PRO-8 — L'adresse de la page publique est stable · gravité **mineur**

**Étapes**
1. Note l'adresse `/fr/u/<slug>` de Thomas.
2. Change son « nom affiché » depuis son écran Profil.
3. Recharge la page publique par l'ancienne adresse.

**Résultat attendu** — L'adresse **ne change pas** : un lien partagé ne meurt jamais. Le nom affiché, lui, est à jour.
**Verdict** ⬜   **Note** :

---

#### WEB-PRO-9 — Masquer sa page publique · gravité **majeur** · `[PRO7]` · **⚠ deux navigateurs**

**Préconditions** — Navigateur A : Thomas connecté. Navigateur B : fenêtre privée.
**Étapes**
1. Dans A, désactive la bascule « Page publique » et enregistre.
2. Dans B, ouvre `/fr/u/seed-thomas`.
3. Dans A, ouvre la même adresse.
4. Dans B, ouvre la page d'un **trajet publié** par Thomas.

**Résultat attendu**
- Étape 2 : « Profil introuvable » / « Ce profil n'existe pas ou a été supprimé. » avec le bouton « Retour à l'accueil ».
- Étape 3 : le propriétaire voit sa page, avec la mention « masquée ».
- Étape 4 : **le trajet reste visible** et porte toujours le prénom de Thomas. Masquer sa page n'est pas se cacher d'un deal.

**Vérification complémentaire** — Réactive la bascule à la fin du scénario.
**Verdict** ⬜   **Note** :

---

#### WEB-PRO-10 — Afficher / masquer sa ville · gravité **mineur** · `[PRO8]`

**Étapes**
1. Active « Afficher ma ville » sur le profil de Thomas, enregistre, ouvre la page publique.
2. Désactive-la, enregistre, recharge la page publique.

**Résultat attendu** — La ville apparaît puis disparaît. Aucune autre donnée n'est affectée.
**Verdict** ⬜   **Note** :

---

#### WEB-PRO-11 — On ne discute pas avec soi-même · gravité **mineur**

**Préconditions** — Thomas connecté.
**Étapes**
1. Ouvre sa propre page publique.

**Résultat attendu** — Le bouton « Suivre » est remplacé par « Modifier mon profil ». Aucun bouton « Discuter avec Thomas », aucun lien « Signaler ce profil ».
**Verdict** ⬜   **Note** :

---

### 5.6 — `WEB-VOY` · Devenir Voyageur : onboarding et Stripe

**Ce que couvre ce chapitre.** Les deux étapes « Profil » puis « Paiements » de l'onboarding, et ce que l'onboarding conditionne réellement.

**Compte de travail** — `joao.shipper@seed.yamba.dev` (Expéditeur pur, rien de pré-rempli). Le compte `recette+neuf@seed.yamba.dev` convient aussi.

---

#### WEB-VOY-1 — L'entrée « Devenir Voyageur » · gravité **majeur**

**Préconditions** — Connecté avec João.
**Étapes**
1. Ouvre le menu utilisateur, ou le tableau de bord.
2. Clique « Devenir Voyageur ».

**Résultat attendu** — L'écran « Devenir Voyageur » s'ouvre avec deux étapes nommées « Profil » et « Paiements ». L'étape « Profil » est active, « Paiements » ne l'est pas encore.
**Verdict** ⬜   **Note** :

---

#### WEB-VOY-2 — L'étape « Profil » · gravité **majeur** · **⏭ sans clé Google Maps** (adresse principale)

**Étapes**
1. Renseigne le nom d'affichage (par exemple `João S.`).
2. Renseigne une présentation d'une ou deux phrases.
3. Renseigne le téléphone au format international, par exemple `+351912345612`.
4. Saisis une adresse principale et choisis une proposition de l'autocomplétion.
5. Enregistre.

**Résultat attendu**
- L'enregistrement réussit, l'étape passe à « Paiements ».
- Un téléphone mal formé (par exemple `12`) est refusé avec un message sous le champ.

**Vérification complémentaire** — Le badge du menu utilisateur devient « Profil à compléter ».
**Verdict** ⬜   **Note** :

---

#### WEB-VOY-3 — Publier reste possible sans onboarding complet · gravité **majeur**

**Préconditions** — João, étape « Paiements » non franchie.
**Étapes**
1. Va sur « Mes trajets » ou « Créer un trajet ».
2. Crée un trajet complet et tente de le publier (voir chapitre 5.7 pour le détail des étapes).

**Résultat attendu** — **La publication réussit**. Le profil Voyageur et Stripe **ne sont pas exigés pour publier** : le contrôle a été déplacé au moment de l'acceptation d'une demande.
**Note de recette** — Une documentation ancienne (`DOC-METIER-TRIP-LIFECYCLE.md` RG-01) affirme le contraire. Le code fait foi : si la publication est bloquée, c'est une anomalie **majeure**.
**Verdict** ⬜   **Note** :

---

#### WEB-VOY-4 — « Configurer Stripe » · gravité **majeur** · **⏭ sans `STRIPE_SECRET_KEY` et Connect activé**

**Étapes**
1. Sur l'étape « Paiements », clique « Configurer Stripe ».

**Résultat attendu** — Un parcours Stripe Connect Express s'ouvre. Le RIB, l'identité et l'activité sont saisis **chez Stripe**, jamais dans un formulaire Yamba.
**Anomalie à guetter** — Un formulaire Yamba qui demanderait un IBAN serait une anomalie **bloquante**.
**Verdict** ⬜   **Note** :

---

#### WEB-VOY-5 — Retour de Stripe : profil actif · gravité **majeur** · **⏭ sans Stripe**

**Étapes**
1. Complète le parcours Stripe en mode test jusqu'au retour sur Yamba.

**Résultat attendu**
- L'écran de retour (`/carrier/onboarding/stripe/callback`) confirme l'activation.
- L'étape passe à « terminé », le statut Voyageur devient actif, le badge du menu utilisateur devient « Voyageur actif ».
- Un email « Ton profil Voyageur est actif » arrive dans Mailpit.

**Verdict** ⬜   **Note** :

---

#### WEB-VOY-6 — Accepter sans onboarding complet est refusé · gravité **bloquant**

**Préconditions** — Un Voyageur **sans** compte de paiement prêt (João après l'étape « Profil » seulement), portant une demande en attente sur un de ses trajets. Pour créer cette demande, un autre compte réserve son trajet (voir chapitre 5.12).
**Étapes**
1. Connecté avec João, ouvre la demande reçue.
2. Coche la Charte Voyageur et clique « Accepter et confirmer ».

**Résultat attendu**
- Le message « Termine ton profil Voyageur et ta configuration Stripe pour pouvoir accepter un deal. » s'affiche.
- L'écran propose de rejoindre l'onboarding.
- **Rien n'est débité** côté Expéditeur, la demande **reste en attente**, et son compte à rebours continue de courir.

**Vérification complémentaire** — Côté Expéditeur, le suivi affiche toujours « En attente du Voyageur ». Aucun email « accepté » n'est parti.
**Verdict** ⬜   **Note** :

---

#### WEB-VOY-7 — « Voir mes virements sur Stripe » · gravité **majeur** · **⏭ sans Stripe** · `[SES9]`

**Préconditions** — Connecté avec Thomas.
**Étapes**
1. Tableau de bord › « Finances » › onglet « Portefeuille ».
2. Clique « Voir mes virements sur Stripe ».

**Résultat attendu**
- La porte de confirmation par code s'ouvre (geste sensible).
- Après le code, le tableau de bord Stripe Express s'ouvre **dans un nouvel onglet**.
- L'aide affichée est « Dates d'arrivée, RIB et historique : sur ton tableau de bord Stripe. »
- Pour un compte sans compte de paiement, le message est « Finalise d'abord ton compte Stripe. »

**Verdict** ⬜   **Note** :

---

### 5.7 — `WEB-TRJ` · Publier un trajet et son cycle de vie

**Ce que couvre ce chapitre.** Les trois étapes de création, les règles de prix et de capacité, la publication, les six statuts, et les actions autorisées.

**Compte de travail** — `josephine.carrier@seed.yamba.dev` (Voyageur complet, trajet libre) ou Thomas.
**Préconditions communes** — `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` posée, sinon tout le chapitre est `⏭`.

---

#### WEB-TRJ-1 — Ouvrir « Créer un trajet » · gravité **bloquant**

**Étapes**
1. Connecté avec Joséphine, clique « Publier un trajet » (depuis « Mes trajets » ou l'en-tête « Partager un trajet »).

**Résultat attendu** — Un assistant en trois étapes s'ouvre : « Trajet », « Conditions », « Vérification ». Un bouton permet d'enregistrer un « Brouillon » à tout moment.
**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-2 — Étape 1 : mode, itinéraire et dates · gravité **bloquant**

**Étapes**
1. Choisis le mode « Avion ».
2. Choisis « Vol direct ».
3. Choisis « Aller simple ».
4. Ville de départ : saisis `Bruxelles`, choisis une proposition.
5. Ville d'arrivée : saisis `Kinshasa`, choisis une proposition.
6. Date et heure de départ : une date située dans 20 jours, à `14:00`.
7. Date et heure d'arrivée : le lendemain à `06:00`.
8. Passe à l'étape suivante.

**Résultat attendu**
- Les trois modes proposés sont « Avion », « Train » et « Voiture », avec leurs variantes (vol direct / avec escale ; train direct / avec correspondance ; voiture directe / détour possible).
- Les heures sont **locales à chaque lieu** : `14:00` signifie 14 h à Bruxelles, `06:00` signifie 6 h à Kinshasa.
- L'étape 2 s'ouvre.

**Vérification complémentaire** — Une date de départ dans le passé doit être refusée à la publication (voir WEB-TRJ-12).
**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-3 — Étape 2 : le prix au kilo et sa suggestion · gravité **majeur**

**Étapes**
1. Observe le champ de prix au kilo à l'ouverture de l'étape.
2. Fais glisser le curseur jusqu'à `5,00`.
3. Fais-le glisser jusqu'à `20,00`.
4. Saisis `11,50` au clavier.
5. Ouvre l'explication « Pourquoi ce prix ? ».

**Résultat attendu**
- Le prix est **pré-rempli** à une médiane suggérée arrondie au demi-euro (il n'est jamais vide, jamais `0`).
- Le curseur va de **5 à 20 €/kg** par pas de **0,50**.
- Une suggestion indicative affiche une fourchette basse / médiane / haute, et un verdict du type « Prix juste », « Sous le marché — tu laisses de l'argent » ou « Au-dessus — moins de demandes probables ».
- **La suggestion ne bloque jamais** : un prix hors fourchette reste enregistrable.
- La mention « Ton prix = ton net » (la commission est payée par l'Expéditeur) est présente.

**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-4 — Étape 2 : la capacité et le gain net · gravité **majeur**

**Étapes**
1. Observe la capacité à l'ouverture.
2. Fais glisser le curseur jusqu'à `23`.
3. Lis la carte de gain.

**Résultat attendu**
- La capacité est **pré-remplie à 12 kg** ; le curseur va de **2 à 30 kg**.
- Avec 11,50 €/kg et 23 kg, la carte affiche « Si tes 23 kg sont réservés — Tu gagnes 264,50 € » (23 × 11,50).
- La mention « versé à J+4 après livraison confirmée » accompagne le gain.
- L'aide indique le plancher « Aucun envoi ne te rapporte moins de 8 € » et la tolérance de poids de ±10 % au pickup.

**Vérification complémentaire** — Passe le prix à 12,00 : le gain doit devenir 276,00 €. Un gain qui ne suit pas est une anomalie **majeure**.
**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-5 — Étape 2 : les huit familles de colis · gravité **majeur**

**Étapes**
1. Déplie la section des familles.
2. Passe « Électronique & appareils » en supplément de `20` %.
3. Passe « Alimentaire sec & scellé » sur « Refusé ».
4. Replie la section.

**Résultat attendu**
- Les huit familles sont : « Documents & papiers », « Vêtements & textile », « Alimentaire sec & scellé », « Électronique & appareils », « Cosmétiques & soins », « Pièces & outillage », « Jouets & puériculture », « Accessoires & divers ».
- Par défaut, **tout est accepté sans supplément** et la section est repliée avec la mention « Toutes les familles acceptées ».
- Le curseur de supplément va de **5 à 50 %** par pas de 5, avec 20 % par défaut.
- Le résumé replié rend compte des deux modifications.

**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-6 — Étape 2 : les forfaits bagage entier et leur garde · gravité **majeur**

**Étapes**
1. Ramène la capacité à `5` kg.
2. Ouvre la section « Bagage entier ».
3. Remonte la capacité à `23` kg.
4. Renseigne un forfait soute de `230` €.
5. Renseigne un forfait cabine de `0` €.
6. Redescends la capacité à `20` kg.

**Résultat attendu**
- Étape 2 : les deux lignes sont **grisées** avec « Monte ta capacité à 23 kg pour proposer ce forfait » et « Monte ta capacité à 12 kg pour proposer ce forfait ».
- Étape 4 : le forfait est accepté ; un équivalent au kilo s'affiche (« ≈ 10,00 €/kg » pour 230 € / 23 kg).
- Étape 5 : refus « Le forfait doit être supérieur à 0 » ; vider le champ fait disparaître l'erreur.
- Étape 6 : la ligne soute redevient grisée, le montant est **mémorisé mais masqué**, le résumé n'annonce plus ce forfait.

**Vérification complémentaire** — Remonter à 23 kg doit faire réapparaître le 230 € saisi.
**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-7 — Étape 2 : les lieux de remise et de livraison · gravité **bloquant**

**Étapes**
1. Ajoute un lieu de remise : type « À l'aéroport », précision « Bruxelles-Zaventem, hall des départs », mode « Lieu exact ».
2. Ajoute un lieu de livraison : type « À l'aéroport », précision « Kinshasa N'djili, hall d'arrivée ».

**Résultat attendu** — Les deux lieux sont enregistrés. Les types proposés sont au moins « À l'aéroport », « À la gare », « Dans la ville », et les modes « Lieu exact », « Rayon {km} km », « Ville entière ».
**Note importante** — Un trajet **sans aucun lieu** est une cause connue de plantage de l'écran de réservation : voir WEB-NRG-4.
**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-8 — « Réservation instantanée » n'existe plus · gravité **mineur**

**Étapes**
1. Parcours la section des options de l'étape 2.

**Résultat attendu** — Aucune option « Réservation instantanée ». À la place, un texte du type « Chaque demande passe par ton accord — tu réponds sous 24 h ».
**Anomalie à guetter** — La présence d'une bascule « Réservation instantanée » est une anomalie **mineure** de vestige.
**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-9 — Étape 3 : la vérification et l'aperçu public · gravité **majeur**

**Étapes**
1. Passe à l'étape « Vérification ».

**Résultat attendu**
- Une carte « Prix & capacité » récapitule : prix au kilo, kilos, gain, familles surchargées et refusées, forfaits.
- Une section « Documents » permet de déposer des justificatifs.
- Un **aperçu public** montre la fiche telle que l'Expéditeur la verra.

**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-10 — Publier le trajet · gravité **bloquant**

**Étapes**
1. Clique « Publier le trajet ».

**Résultat attendu**
- Le trajet passe au statut **« En ligne »**.
- Il apparaît dans « Mes trajets » avec ce badge.
- Il est trouvable dans la recherche Bruxelles → Kinshasa.
- Sa carte de recherche affiche « prix au kilo · 11,50 €/kg · 23 kg dispo · ex. colis 2 kg ≈ … », jamais « à partir de 0,00 € ».

**Vérification complémentaire** — Un email « nouveau trajet correspondant » part vers toute alerte de route qui correspond (chapitre 5.10), et « {Voyageur} publie un nouveau trajet » vers ses abonnés (chapitre 5.11).
**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-11 — Le brouillon accepte l'incomplet, sauf l'incohérence bagage · gravité **majeur**

**Étapes**
1. Crée un nouveau trajet, remplis seulement la ville de départ, enregistre en « Brouillon ».
2. Rouvre le brouillon, mets la capacité à `5` kg et tente d'enregistrer un forfait soute de `200` € en forçant (rechargement de page, retour arrière).

**Résultat attendu**
- Étape 1 : le brouillon est enregistré sans erreur et apparaît dans « Mes trajets » avec le badge « Brouillon ».
- Étape 2 : le serveur **refuse** l'incohérence bagage / capacité, brouillon compris.

**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-12 — Les gardes de publication · gravité **majeur**

Pour chaque ligne, part d'un brouillon complet et retire l'élément indiqué, puis tente « Publier le trajet ».

| # | Ce qui manque | Attendu |
|---|---|---|
| a | La date de départ | Refus, message explicite |
| b | Une date de départ **passée** | Refus, message nommant la date passée |
| c | Le prix au kilo (ou prix à 0) | Refus : un moteur de prix complet est exigé |
| d | La capacité (ou capacité à 0) | Refus |
| e | Le lieu de remise | Refus |
| f | Le lieu de livraison | Refus |

**Résultat attendu** — Chaque refus est expliqué, le trajet reste en brouillon, aucun trajet incomplet n'est publié.
**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-13 — Masquer et remettre en ligne · gravité **majeur** · `[PRO9]` · **⚠ deux navigateurs** conseillé

**Préconditions** — Le trajet publié en WEB-TRJ-10.
**Étapes**
1. Dans « Mes trajets », ouvre le menu d'actions du trajet et clique « Masquer ».
2. Dans une fenêtre privée, recherche Bruxelles → Kinshasa.
3. Reviens et clique « Remettre en ligne ».
4. Refais la recherche.

**Résultat attendu**
- Étape 1 : toast « Trajet masqué », badge **« Masqué »**.
- Étape 2 : le trajet **n'apparaît plus** dans les résultats.
- Étape 3 : toast « Trajet remis en ligne », badge **« En ligne »**.
- Étape 4 : le trajet réapparaît.

**Vérification complémentaire** — En anglais, les badges doivent être « Online » et « Hidden », jamais « Actif » / « En pause » (libellés d'une version antérieure).
**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-14 — Le menu d'actions ne propose que le permis · gravité **majeur**

**Étapes**
1. Ouvre le menu d'actions sur un **brouillon**.
2. Puis sur un trajet **En ligne sans réservation**.
3. Puis sur `bzv-upcoming` (En ligne **avec** des réservations).
4. Puis sur un trajet **Terminé** ou **Annulé**.

**Résultat attendu**

| État | Actions attendues | Actions **absentes** |
|---|---|---|
| Brouillon | « Voir le détail », « Modifier », « Dupliquer », « Supprimer le brouillon », publication | « Masquer », « Annuler », « Archiver » |
| En ligne sans réservation | « Modifier », « Masquer », « Repasser en brouillon », « Annuler », « Dupliquer », « Voir en tant qu'expéditeur » | « Restaurer », « Supprimer » |
| En ligne avec réservations | « Masquer », « Dupliquer », « Voir le détail » | **« Modifier » absent**, « Repasser en brouillon » absent |
| Terminé / Annulé | « Archiver », « Dupliquer » ; « Restaurer en brouillon » pour un annulé dont le départ n'est pas passé | Publication, modification |

**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-15 — Un trajet réservé est intouchable · gravité **majeur**

**Préconditions** — `bzv-upcoming` (porte une demande en attente).
**Étapes**
1. Tente « Modifier » sur ce trajet.

**Résultat attendu** — L'action n'est pas proposée. Si elle est atteinte par une adresse directe, le serveur répond « Cannot edit a trip with active bookings. Cancel the trip instead. » traduit à l'écran.
**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-16 — Annuler un trajet qui porte encore un deal est **refusé** · gravité **bloquant** · `[ANN21]`

**Préconditions** — `bzv-upcoming` (Thomas) porte au moins une demande en attente et un deal accepté.
**Étapes**
1. Connecté avec Thomas, ouvre « Mes trajets ».
2. Sur `bzv-upcoming`, clique « Annuler le trajet » et confirme.

**Résultat attendu**
- Le trajet **n'est pas annulé** : il reste « En ligne ».
- Un message précis s'affiche : « Ce trajet porte encore 2 deals en cours : annule-les d'abord depuis « Mes deals ». Chaque Expéditeur sera remboursé intégralement. » (le nombre s'adapte, et le singulier devient « un deal en cours »).

**Anomalie à guetter** — Si le trajet s'annule quand même, c'est la régression majeure corrigée par la décision D72 : anomalie **bloquante** (de l'argent reste bloqué sans que personne soit remboursé ni prévenu).
**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-17 — Annuler un trajet libre · gravité **majeur** · `[ANN20]`

**Préconditions** — `fih` (Joséphine), qui n'a **aucun** deal vivant, ou le trajet publié en WEB-TRJ-10.
**Étapes**
1. Ouvre le menu d'actions et clique « Annuler le trajet ».
2. Lis la confirmation, puis confirme.

**Résultat attendu** — Confirmation « Annuler ce trajet ? » nommant le corridor, puis toast « Trajet annulé » et badge « Annulé ». Le trajet disparaît de la recherche.
**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-18 — Restaurer puis archiver · gravité **mineur**

**Étapes**
1. Sur le trajet annulé, clique « Restaurer en brouillon ».
2. Vérifie qu'il repasse en « Brouillon ».
3. Annule-le de nouveau, puis clique « Archiver ».

**Résultat attendu**
- La restauration n'est proposée que si le départ n'est pas passé.
- Après « Archiver », le badge devient « Archivé », l'action est **irréversible**, et seul « Dupliquer » reste proposé.

**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-19 — Dupliquer un trajet · gravité **mineur**

**Étapes**
1. Sur n'importe quel trajet, clique « Dupliquer ».

**Résultat attendu** — Toast « Brouillon créé par duplication » ; un nouveau brouillon apparaît, pré-rempli avec les mêmes conditions. Le trajet d'origine est inchangé.
**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-20 — Le Voyageur sur la page publique de son propre trajet · gravité **mineur**

**Étapes**
1. Connecté avec Thomas, ouvre la page publique de `bzv-perkg`.

**Résultat attendu** — Le bloc de réservation est remplacé par « C'est votre trajet » / « Les Expéditeurs voient cette page telle quelle. » avec « Modifier le trajet » et « Gérer dans mon tableau de bord ». **Aucun bouton « Réserver »**, aucun cœur de favori.
**Verdict** ⬜   **Note** :

---

#### WEB-TRJ-21 — « Masqué par Yamba » vu du Voyageur · gravité **majeur** · **dépend du back-office**

**Préconditions** — Un administrateur masque `yul` (Marc) depuis le back-office avec un motif interne (voir RECETTE-02-ADMIN).
**Étapes**
1. Connecté avec Marc, ouvre le détail de ce trajet.
2. Dans une fenêtre privée, ouvre sa page publique.
3. Recherche Paris → Montréal.

**Résultat attendu**
- Étape 1 : un bandeau rouge « Trajet masqué par Yamba » avec le texte « Ce trajet n'apparaît plus dans la recherche ni sur sa page publique. Tes réservations en cours continuent normalement. Un email t'a été envoyé : réponds au support pour en discuter. »
- Étape 2 : la page publique répond « Trajet introuvable » / « Ce trajet n'existe pas ou n'est plus disponible. »
- Étape 3 : le trajet est absent des résultats.
- Le Voyageur **ne peut pas** lever ce masquage lui-même ; les actions « Masquer » et « Annuler » lui restent accessibles.

**Vérification complémentaire** — Un email au motif générique arrive dans Mailpit pour Marc. Le deal accepté sur ce trajet continue normalement (voir WEB-DEA).
**Verdict** ⬜   **Note** :

---

### 5.8 — `WEB-DOC` · Justificatifs et billet vérifié

**Ce que couvre ce chapitre.** Le dépôt de documents sur un trajet et le cycle de vérification du billet.
**Préconditions communes** — Clés ImageKit posées, sinon tout le chapitre est `⏭`.

---

#### WEB-DOC-1 — Déposer un justificatif · gravité **majeur** · **⏭ sans ImageKit**

**Préconditions** — Connecté avec Joséphine, sur l'étape « Vérification » d'un de ses trajets, ou sur le détail du trajet, section « Documents ».
**Étapes**
1. Dépose le PDF préparé au §2.7 en type « billet ».
2. Dépose un second document en type « itinéraire ».

**Résultat attendu** — Les deux documents apparaissent dans la liste. Le billet passe au statut **« En vérification »**.
**Vérification complémentaire** — Les types proposés sont au moins : billet, itinéraire, véhicule, identité, autre.
**Verdict** ⬜   **Note** :

---

#### WEB-DOC-2 — Les bornes de dépôt · gravité **mineur** · **⏭ sans ImageKit**

**Étapes**
1. Tente de déposer un sixième document.
2. Tente de déposer un fichier de plus de 5 Mo.

**Résultat attendu** — Refus explicite dans les deux cas (au plus **5 fichiers**, **5 Mo** chacun). Rien n'est envoyé.
**Verdict** ⬜   **Note** :

---

#### WEB-DOC-3 — Les statuts du billet · gravité **majeur**

**Étapes**
1. Sur le détail de `bzv-upcoming` (Thomas), regarde le statut du billet.

**Résultat attendu** — Le statut est **« En vérification »** (le jeu d'essai le pose ainsi). Les quatre statuts possibles sont « Non soumis », « En vérification », « Vérifié », « Rejeté ».
**Verdict** ⬜   **Note** :

---

#### WEB-DOC-4 — Billet validé par l'équipe · gravité **majeur** · **dépend du back-office**

**Préconditions** — Un administrateur valide le billet de `bzv-upcoming` (voir RECETTE-02-ADMIN).
**Étapes**
1. Connecté avec Thomas, recharge le détail du trajet.
2. Ouvre la page publique du trajet dans une fenêtre privée.

**Résultat attendu**
- Le statut passe à « Vérifié ».
- La page publique porte le badge **« Billet vérifié »**.
- Un email de confirmation arrive dans Mailpit, dans la langue de Thomas.

**Verdict** ⬜   **Note** :

---

#### WEB-DOC-5 — Billet rejeté avec motif · gravité **majeur** · **dépend du back-office**

**Préconditions** — Un administrateur rejette un billet avec un motif fermé (illisible, dates différentes, nom différent, document non recevable).
**Étapes**
1. Consulte l'email reçu et le statut du trajet.
2. Dépose un nouveau billet.

**Résultat attendu**
- Le statut est « Rejeté ». L'email nomme le motif **en clair**, dans la langue du Voyageur.
- Un nouveau dépôt est possible et repasse le statut en « En vérification ».

**Verdict** ⬜   **Note** :

---

#### WEB-DOC-6 — Le billet ne bloque rien · gravité **majeur**

**Étapes**
1. Sur un trajet **sans** billet vérifié, vérifie qu'il est publiable et réservable.

**Résultat attendu** — La publication et la réservation fonctionnent sans billet vérifié. Le badge est **informatif**. Un blocage serait une anomalie **majeure**.
**Verdict** ⬜   **Note** :

---

### 5.9 — `WEB-RCH` · Recherche, filtres, tri, état vide

**Ce que couvre ce chapitre.** L'écran `/search`, les prix affichés sur les cartes, les filtres, le tri, l'état vide et l'état d'erreur.

**Préconditions communes** — Jeu d'essai fraîchement rejoué. Certains scénarios se font en fenêtre privée (visiteur), d'autres connecté.

---

#### WEB-RCH-1 — La liste complète et son titre · gravité **bloquant**

**Étapes**
1. Ouvre `/fr/search` sans aucun critère.

**Résultat attendu**
- Titre « Tous les trajets disponibles », sous-titre « Affinez avec un départ et une destination, ou parcourez l'offre actuelle ».
- Le compteur « Résultats disponibles » et « {n}/{n} résultats affichés ».
- Les huit trajets du jeu d'essai sont listés, ou une partie avec un bouton « Charger plus de résultats ».
- Les onglets de mode « Tout », « Avion », « Train », « Voiture » sont présents.

**Verdict** ⬜   **Note** :

---

#### WEB-RCH-2 — Les titres dynamiques · gravité **mineur**

**Étapes**
1. Recherche avec départ seul (`Paris`).
2. Puis avec arrivée seule (`Brazzaville`).
3. Puis avec une date seule.
4. Puis avec départ **et** arrivée.

**Résultat attendu** — Les quatre titres respectifs : « Trajets au départ de Paris », « Trajets à destination de Brazzaville », « Trajets le {date} », « Trajets pour Paris → Brazzaville ».
**Verdict** ⬜   **Note** :

---

#### WEB-RCH-3 — La carte d'un trajet au kilo · gravité **bloquant**

**Étapes**
1. Recherche Paris → Brazzaville.
2. Observe la carte de `bzv-perkg` (départ dans 15 jours, 11,50 €/kg, 23 kg).

**Résultat attendu** — La carte affiche :
- « prix au kilo », « 11,50 €/kg », « 23 kg dispo ».
- Un exemple chiffré du type « ex. 2 kg ≈ 26 € tout compris ».
- La durée du vol, le nombre d'escales (« Direct » ou « {n} escales »).
- Le cœur de mise en favori.
- Un compteur « {n} vues » **seulement si le compteur est supérieur à zéro** ; le badge « Populaire » à partir de 20 vues.
- La mention du plancher : « Colis léger (enveloppe, passeport, lunettes…) : 8 € minimum. »

**Anomalies à guetter (régressions connues)**
- Un tiret « — » à la place d'une heure d'arrivée : anomalie **mineure** (voir WEB-NRG-1).
- « à partir de 0,00 € » ou un prix à zéro : anomalie **majeure** (voir WEB-NRG-2).
- Une note « ⭐ 0.0 » pour un Voyageur sans avis : anomalie **mineure**.
**Verdict** ⬜   **Note** :

---

#### WEB-RCH-4 — « Votre colis » : le prix pour un poids donné · gravité **majeur**

**Étapes**
1. Ouvre le panneau « Filtres ».
2. Dans la section « Votre colis », saisis un poids de `3` kg.
3. Reviens aux résultats.

**Résultat attendu**
- L'aide affiche « Prix et tri calculés pour 3 kg · trajets sans assez de place exclus ».
- Chaque carte affiche « ≈ {prix} € tout compris pour 3 kg ».
- Sur `bzv-perkg` (11,50 €/kg), le prix affiché doit être **≈ 38,64 €** : transport 3 × 11,50 = 34,50 €, service 12 % = 4,14 €, total 38,64 €.
- Les trajets dont les kilos restants sont insuffisants affichent « Plus assez de place ».
- Les trajets dont la capacité totale est insuffisante sont **exclus** de la liste.

**Vérification complémentaire** — Le poids est mémorisé sur l'appareil : recharge la page, il doit rester à 3 kg, et il doit pré-remplir l'étape 1 d'une réservation (chapitre 5.12).
**Verdict** ⬜   **Note** :

---

#### WEB-RCH-5 — Le prix comparable sans poids saisi · gravité **majeur**

**Étapes**
1. Clique « Tout effacer » dans les filtres.
2. Observe les prix des cartes.

**Résultat attendu**
- Le poids revient à **2 kg** (colis de référence).
- Le prix comparable d'un trajet au kilo est `max(2 × €/kg, 8 €)` pour le transport, plus le service :
  - `bzv-perkg` à 11,50 €/kg → transport 23,00 €, service 3,00 € (plancher), total ≈ **26,00 €**.
  - Un trajet à 9,50 €/kg → transport 19,00 €, service 3,00 €, total ≈ **22,00 €**.
- Le libellé du tri par prix devient « pour un colis de 2 kg ».

**Verdict** ⬜   **Note** :

---

#### WEB-RCH-6 — Les trois tris · gravité **majeur**

**Étapes**
1. Choisis « Départ le plus tôt ».
2. Choisis « Prix le plus bas ».
3. Choisis « Mieux notés ».

**Résultat attendu**
- Tri 1 : les trajets se rangent par date de départ croissante.
- Tri 2 : par prix croissant **pour le poids en cours** (le libellé rappelle « pour un colis de 2 kg » ou « pour votre colis de 3 kg »). Un trajet sans aucun prix n'apparaît pas dans ce tri.
- Tri 3 : les mieux notés en tête. Sur un jeu d'essai sans avis, l'ordre est stable et aucune note fictive n'apparaît.

**Verdict** ⬜   **Note** :

---

#### WEB-RCH-7 — Le filtre « Que voulez-vous envoyer ? » · gravité **majeur**

**Étapes**
1. Ouvre les filtres, section « Que voulez-vous envoyer ? ».
2. Coche « Alimentaire sec & scellé ».
3. Décoche, puis coche « Électronique & appareils ».
4. Coche en plus « Documents & papiers ».

**Résultat attendu**
- Étape 2 : `bzv-perkg` (qui **refuse** l'alimentaire) **disparaît** des résultats.
- Étape 3 : `bzv-perkg` réapparaît, et sa carte annonce le supplément **avant le clic** : « Électronique & appareils : +20 % ».
- Étape 4 : le trajet doit accepter **les deux** familles pour rester visible.
- Chaque puce affiche le nombre de trajets compatibles ; une puce à **0** est désactivée.
- Un trajet sans position sur les familles (tout accepté) reste compatible avec toutes.

**Verdict** ⬜   **Note** :

---

#### WEB-RCH-8 — Les filtres de confiance masquent leurs lignes vides · gravité **mineur**

**Étapes**
1. Ouvre la section « Confiance et sécurité ».

**Résultat attendu** — Les filtres « Super Voyageur », « Profil vérifié » et « Billet vérifié » sont proposés. **Une ligne dont le compte est 0 est masquée**, pas grisée. Sur le jeu d'essai, « Billet vérifié » n'apparaît que si un billet a été validé (WEB-DOC-4).
**Verdict** ⬜   **Note** :

---

#### WEB-RCH-9 — L'état vide · gravité **majeur**

**Étapes**
1. Recherche `Brazzaville` → `Paris` (aucun trajet dans ce sens sur le jeu d'essai).

**Résultat attendu**
- Titre « Aucun trajet trouvé ».
- Texte « Aucun trajet n'est disponible pour cette recherche. Essayez de modifier votre date ou destination. »
- Le bloc de création d'alerte : « Aucun trajet ne correspond ? » / « Crée une alerte et reçois un email dès qu'un voyageur publie ce trajet. » avec le bouton « Créer une alerte pour ce trajet ».

**Verdict** ⬜   **Note** :

---

#### WEB-RCH-10 — L'état vide dû aux filtres · gravité **mineur**

**Étapes**
1. Sur une recherche qui donne des résultats, coche des familles jusqu'à n'en avoir plus aucun.

**Résultat attendu** — Le message change : « Aucun résultat ne correspond à vos filtres. Essayez d'en retirer pour voir plus de trajets. » Le bouton « Tout effacer » est accessible.
**Verdict** ⬜   **Note** :

---

#### WEB-RCH-11 — L'état d'erreur · gravité **mineur**

**Étapes**
1. Arrête le trip-service (`Ctrl-C` sur son terminal, ou coupe le réseau du navigateur).
2. Recharge `/fr/search`.

**Résultat attendu** — « Une erreur est survenue » / « Impossible de charger les trajets. Vérifie ta connexion et réessaie. » avec un bouton « Réessayer » qui fonctionne une fois le service revenu. **Jamais** une trace technique.
**Verdict** ⬜   **Note** :

---

#### WEB-RCH-12 — La page publique d'un trajet · gravité **bloquant**

**Étapes**
1. Depuis les résultats, ouvre `bzv-perkg`.

**Résultat attendu**
- Titre « Trajet proposé par Thomas N. », mode « Avion » / « Vol direct », référence, « Membre depuis {date} ».
- Bloc « Ce que vous pouvez envoyer avec Thomas » avec « Prix au kilo » (11,50 €), « Disponible » (23 kg).
- Les huit familles avec leur statut : « Accepté », « Supplément de 20 % (risque) » pour l'électronique, « Refusé par le Voyageur » pour l'alimentaire.
- « Bagage entier — forfait » avec « Soute 23 kg » à 230 €.
- Une estimation : « Estimation pour un colis de 2 kg » ou, si un poids est mémorisé, « Estimation pour votre colis de 3 kg (poids de votre recherche) », avec « tout compris (transport + service Yamba) » et « Le prix définitif est fixé à la réservation. »
- Le plancher : « Colis léger (enveloppe, passeport, lunettes…) : 8 € minimum, quel que soit le poids. »
- Les lieux de remise et de livraison.
- Le CO₂ évité **pour le poids du colis**.
- Le bloc « Conditions » › « Politique d'annulation » avec les trois lignes : « Remboursement intégral jusqu'à 48 h avant le départ », « Moins de 48 h avant le départ : remboursement partiel (une retenue est reversée au Voyageur) », « Après la remise du colis : plus d'annulation possible, seul le litige ».
- « Objets interdits » : « Substances illicites, armes, espèces, animaux vivants, matières dangereuses ou inflammables, contrefaçons. »
- Le bouton **« Réserver »**.
- Le lien « Signaler cette annonce ».

**Anomalie à guetter** — Le texte « Réservation bientôt disponible » / « Le système de réservation sera lancé très prochainement. » **ne doit pas** s'afficher : le tunnel de réservation existe. Sa présence est une anomalie **majeure**.
**Verdict** ⬜   **Note** :

---

#### WEB-RCH-13 — Le compteur de vues · gravité **mineur**

**Étapes**
1. En fenêtre privée, ouvre la page de `bzv-perkg`, note le compteur.
2. Recharge la page cinq fois.
3. Reviens aux résultats de recherche.

**Résultat attendu** — Le compteur **n'augmente que d'une unité** : une vue par visiteur et par jour. Rien n'est affiché à zéro vue.
**Verdict** ⬜   **Note** :

---

#### WEB-RCH-14 — Un trajet supprimé ou masqué répond « introuvable » · gravité **majeur**

**Étapes**
1. Note l'adresse d'un trajet, puis fais-le annuler ou masquer par Yamba (back-office).
2. Ouvre l'adresse notée en fenêtre privée.

**Résultat attendu** — « Trajet introuvable » / « Ce trajet n'existe pas ou n'est plus disponible. » avec « Retour à la recherche ». **L'existence du trajet n'est pas révélée** : aucun message du type « ce trajet a été masqué par l'équipe ».
**Verdict** ⬜   **Note** :

---

#### WEB-RCH-15 — Le trajet d'un compte suspendu disparaît · gravité **majeur** · **dépend du back-office**

**Préconditions** — Un administrateur suspend Marc.
**Étapes**
1. Recherche Paris → Montréal en fenêtre privée.

**Résultat attendu** — Aucun trajet de Marc dans les résultats. La sanction agit par **lecture** : le trajet n'est ni annulé ni modifié en base.
**Verdict** ⬜   **Note** :

---

### 5.10 — `WEB-ALR` · Alertes de route

**Ce que couvre ce chapitre.** La création, la gestion et l'effet des alertes de route.
**Préconditions communes** — Clé Google Maps posée (autocomplétion), sinon `⏭`. Connecté avec `aminata.shipper@seed.yamba.dev`.

---

#### WEB-ALR-1 — L'écran « Mes alertes route » vide · gravité **mineur**

**Étapes**
1. Tableau de bord › « Alertes route ».

**Résultat attendu** — Titre « Mes alertes route », sous-titre « Sois prévenu·e dès qu'un trajet correspondant à tes critères est publié. » ; état vide « Aucune alerte pour l'instant » / « Crée ta première alerte et reçois un email dès qu'un trajet correspond à tes critères. » avec le bouton « Créer ma première alerte ».
**Verdict** ⬜   **Note** :

---

#### WEB-ALR-2 — Créer une alerte · gravité **majeur**

**Étapes**
1. Clique « Créer ma première alerte » (ou « Nouvelle alerte »).
2. Départ : `Bruxelles`. Arrivée : `Kinshasa`.
3. Période d'intérêt : « 3 mois ».
4. Laisse « Recevoir un email » activé.
5. Active « Inclure les trajets proches ».
6. Clique « Créer l'alerte ».

**Résultat attendu**
- Le panneau porte « Nouvelle alerte » / « Reçois un email dès qu'un trajet correspond ».
- Les périodes proposées sont « 3 mois », « 6 mois », « Sans limite », « Personnalisé » (avec « À partir du » / « Jusqu'au »).
- Les deux bascules portent leurs aides : « Tu seras notifié·e par email dès qu'un trajet correspond » et « Les villes situées à moins de 50 km déclenchent aussi une alerte ».
- Toast « Alerte créée ! » ; la carte apparaît avec les badges « Email activé » et « Villes proches incluses ».

**Verdict** ⬜   **Note** :

---

#### WEB-ALR-3 — Les refus de création · gravité **majeur**

**Étapes**
1. Ouvre « Nouvelle alerte », ne renseigne qu'une seule ville, valide.
2. Renseigne `Paris` en départ **et** en arrivée, valide.

**Résultat attendu** — « Sélectionne les deux villes » puis « Le départ et l'arrivée doivent être différents ». Aucune alerte n'est créée.
**Verdict** ⬜   **Note** :

---

#### WEB-ALR-4 — L'alerte se déclenche à la publication · gravité **majeur** · **⚠ deux navigateurs**

**Préconditions** — Navigateur A : Aminata, avec l'alerte Bruxelles → Kinshasa créée. Navigateur B : Joséphine.
**Étapes**
1. Dans B, publie un trajet Bruxelles → Kinshasa dont le départ tombe dans la période d'intérêt (chapitre 5.7).
2. Ouvre Mailpit.

**Résultat attendu** — Un email « nouveau trajet correspondant » arrive pour Aminata, dans **sa** langue.
**Vérification complémentaire** — Aucun email n'est envoyé au Voyageur lui-même s'il porte une alerte sur son propre corridor.
**Verdict** ⬜   **Note** :

---

#### WEB-ALR-5 — L'anti-spam de 24 heures · gravité **majeur** · **⚠ deux navigateurs**

**Étapes**
1. Dans B, publie un **second** trajet Bruxelles → Kinshasa immédiatement après le premier.
2. Ouvre Mailpit.

**Résultat attendu** — **Aucun second email** : une alerte n'est pas notifiée deux fois en 24 heures.
**Verdict** ⬜   **Note** :

---

#### WEB-ALR-6 — Les trajets proches · gravité **majeur** · **⚠ deux navigateurs**

**Étapes**
1. Crée une alerte `Paris` → `Brazzaville` avec « Inclure les trajets proches » **désactivé**.
2. Dans B, publie un trajet `Orly` → `Brazzaville` (à moins de 50 km de Paris).
3. Vérifie Mailpit.
4. Active « Inclure les trajets proches » sur l'alerte, publie un autre trajet `Orly` → `Brazzaville` après 24 h ou sur une nouvelle alerte.

**Résultat attendu** — Sans l'option, aucun email pour un lieu proche mais différent. Avec l'option, l'email part. Un trajet vers une ville du même pays mais **au-delà de 50 km** (par exemple Pointe-Noire) ne déclenche jamais rien.
**Note** — Ce scénario est le plus sensible aux données géographiques : consigner précisément les villes utilisées.
**Verdict** ⬜   **Note** :

---

#### WEB-ALR-7 — Prolonger et supprimer une alerte · gravité **mineur**

**Étapes**
1. Sur une carte d'alerte, clique « Prolonger ».
2. Sur une autre, clique « Supprimer » puis « Confirmer ».

**Résultat attendu** — Toast « Alerte prolongée de 6 mois » puis toast « Alerte supprimée ». Le compteur « {n} alertes actives » se met à jour.
**Verdict** ⬜   **Note** :

---

#### WEB-ALR-8 — Le plafond de 20 alertes actives · gravité **mineur**

**Étapes**
1. Crée des alertes jusqu'à en avoir 20 actives.
2. Tente d'en créer une 21ᵉ.

**Résultat attendu** — Refus explicite. Le message doit nommer le plafond.
**Note** — Scénario long ; il peut être marqué `⏭` avec le motif « non joué faute de temps » si la session est contrainte, mais il ne doit pas être oublié à la clôture.
**Verdict** ⬜   **Note** :

---

#### WEB-ALR-9 — La bannière d'alerte en fin de liste · gravité **mineur**

**Étapes**
1. Fais une recherche qui donne des résultats et fais défiler jusqu'en bas.

**Résultat attendu** — La bannière « Reste informé·e des futurs trajets » / « Crée une alerte pour être prévenu·e dès qu'un nouveau trajet correspondant est publié. » avec le bouton « Créer une alerte ».
**Verdict** ⬜   **Note** :

---

### 5.11 — `WEB-FAV` · Favoris et Voyageurs suivis

**Ce que couvre ce chapitre.** Le cœur de mise en favori, la liste des favoris, le suivi d'un Voyageur et ses notifications.

---

#### WEB-FAV-1 — Le cœur ouvre la porte d'identité pour un visiteur · gravité **majeur**

**Préconditions** — Fenêtre privée.
**Étapes**
1. Sur une carte de recherche, clique le cœur (info-bulle « Ajouter aux favoris »).

**Résultat attendu** — La fenêtre « Connecte-toi pour enregistrer un favori » s'ouvre avec le sous-titre « Tes favoris sont liés à ton compte : ils te suivent sur tous tes appareils. Ce trajet t'attend après connexion. »
**Vérification complémentaire** — Après connexion **dans cette fenêtre**, le favori doit être **effectivement enregistré** et l'utilisateur rester sur la même page. Un geste perdu est une anomalie **majeure**.
**Verdict** ⬜   **Note** :

---

#### WEB-FAV-2 — Ajouter et retirer un favori · gravité **majeur**

**Préconditions** — Connecté avec Aminata.
**Étapes**
1. Clique le cœur sur `bzv-perkg` depuis la recherche.
2. Ouvre le tableau de bord › « Mes favoris ».
3. Reviens sur la carte et clique de nouveau le cœur.

**Résultat attendu**
- Étape 1 : le cœur se remplit **immédiatement** (sans attente visible).
- Étape 2 : « Mes favoris » liste le trajet, avec la même carte que la recherche, sous le sous-titre « Les trajets que tu as mis de côté. Un favori est privé : le Voyageur n'en est pas informé. »
- Étape 3 : le cœur se vide, info-bulle « Retirer des favoris ».

**Verdict** ⬜   **Note** :

---

#### WEB-FAV-3 — On ne met pas son propre trajet en favori · gravité **mineur**

**Préconditions** — Connecté avec Thomas.
**Étapes**
1. Cherche l'un de ses propres trajets dans les résultats.

**Résultat attendu** — Le cœur est absent de sa fiche, ou porte l'info-bulle « Tu ne peux pas mettre ton propre trajet en favori ».
**Verdict** ⬜   **Note** :

---

#### WEB-FAV-4 — Un trajet non disponible ne se met pas en favori · gravité **mineur**

**Étapes**
1. Ouvre un favori dont le trajet a été annulé ou masqué depuis, ou tente d'ajouter un trajet masqué.

**Résultat attendu** — Message « Ce trajet n'est plus disponible ». Le **retrait**, lui, reste toujours possible.
**Verdict** ⬜   **Note** :

---

#### WEB-FAV-5 — Un favori survit à la fin du trajet · gravité **mineur**

**Étapes**
1. Mets en favori un trajet dont le départ est passé (par exemple `los`).
2. Ouvre « Mes favoris ».

**Résultat attendu** — Le trajet apparaît avec le badge **« Trajet passé »**. Il n'est pas supprimé de la liste.
**Verdict** ⬜   **Note** :

---

#### WEB-FAV-6 — L'état vide des favoris · gravité **mineur**

**Étapes**
1. Retire tous les favoris, recharge la page.

**Résultat attendu** — « Aucun favori pour l'instant » / « Touche le cœur d'un trajet dans la recherche ou sur sa fiche pour le retrouver ici. » avec « Chercher un trajet ».
**Verdict** ⬜   **Note** :

---

#### WEB-FAV-7 — Suivre un Voyageur · gravité **majeur**

**Préconditions** — Connecté avec Aminata.
**Étapes**
1. Ouvre la page publique de Thomas.
2. Clique « Suivre ».
3. Vérifie l'état de la bascule « Me notifier au prochain trajet ».
4. Ouvre le tableau de bord › « Voyageurs suivis ».

**Résultat attendu**
- Le bouton devient « Suivi ». Le compteur « {n} abonnés » augmente.
- La bascule « Me notifier au prochain trajet » (« Recevoir un email dès que Thomas publie un nouveau trajet. ») est **cochée par défaut**.
- « Voyageurs suivis » liste Thomas avec « {n} trajets publiés » et « Prochain trajet à venir », badge « Voyageur », et l'indicateur « Notifications activées ».

**Verdict** ⬜   **Note** :

---

#### WEB-FAV-8 — L'email d'abonné à la publication · gravité **majeur** · **⚠ deux navigateurs**

**Étapes**
1. Dans un second navigateur, Thomas publie un nouveau trajet.
2. Ouvre Mailpit.

**Résultat attendu** — Un email « {Voyageur} publie un nouveau trajet » arrive pour Aminata, dans sa langue.
**Vérification complémentaire** — Si Aminata a **aussi** une alerte de route qui correspond, elle peut recevoir deux emails distincts : c'est attendu, ce sont deux mécanismes différents.
**Verdict** ⬜   **Note** :

---

#### WEB-FAV-9 — Désactiver la notification sans se désabonner · gravité **mineur**

**Étapes**
1. Dans « Voyageurs suivis », bascule sur « Notifications désactivées ».
2. Fais publier un nouveau trajet par Thomas.

**Résultat attendu** — L'abonnement reste, mais **aucun email** n'arrive.
**Verdict** ⬜   **Note** :

---

#### WEB-FAV-10 — Se désabonner · gravité **mineur**

**Étapes**
1. Clique « Ne plus suivre » puis « Confirmer ».

**Résultat attendu** — Toast « Tu ne suis plus ce voyageur » ; la ligne disparaît ; le compteur d'abonnés de Thomas diminue.
**Verdict** ⬜   **Note** :

---

#### WEB-FAV-11 — On ne se suit pas soi-même · gravité **mineur**

**Préconditions** — Connecté avec Thomas.
**Étapes**
1. Ouvre sa propre page publique.

**Résultat attendu** — Aucun bouton « Suivre » (remplacé par « Modifier mon profil »). Un appel forcé serait refusé par le serveur.
**Verdict** ⬜   **Note** :

---

#### WEB-FAV-12 — L'état vide des Voyageurs suivis · gravité **mineur**

**Étapes**
1. Désabonne-toi de tous, recharge « Voyageurs suivis ».

**Résultat attendu** — « Aucun voyageur suivi » / « Découvre les voyageurs de la communauté et suis ceux qui correspondent à tes besoins pour être prévenu·e dès qu'ils publient un nouveau trajet. » avec « Découvrir des Voyageurs ».
**Verdict** ⬜   **Note** :

---

### 5.12 — `WEB-RSV` · Réserver : l'assistant en quatre étapes

**Ce que couvre ce chapitre.** Le tunnel de réservation complet : colis, destinataire, engagement, paiement, ainsi que le devis et ses règles de calcul.

**Trajet de travail** — `bzv-perkg` : Paris → Brazzaville, départ dans 15 jours, **11,50 €/kg**, 23 kg libres, **Électronique & appareils +20 %**, **Alimentaire sec & scellé refusé**, forfait soute 23 kg à **230 €**.
**Compte de travail** — `aminata.shipper@seed.yamba.dev`.
**Note de calcul** — Les prix attendus ci-dessous sont vérifiables à la main : `transport = max(€/kg × poids facturable × coefficient de taille × (1 + supplément), 8,00 €)`, puis `service = max(12 % du transport, 3,00 €)`, `total = transport + service`.

---

#### WEB-RSV-1 — La porte de réservation pour un visiteur · gravité **majeur**

**Préconditions** — Fenêtre privée.
**Étapes**
1. Ouvre la page de `bzv-perkg` et clique « Réserver ».

**Résultat attendu** — La fenêtre « Connecte-toi pour réserver » s'ouvre **par-dessus** la page du trajet, avec le sous-titre « Une réservation engage un Voyageur : Yamba a besoin de savoir qui envoie. Ton colis et ce trajet t'attendent après connexion. »
**Étapes complémentaires** — Ouvre directement `/fr/trips/<id>/book` en fenêtre privée : la même porte s'affiche, cette fois en pleine page. Après connexion, l'assistant s'ouvre directement.
**Verdict** ⬜   **Note** :

---

#### WEB-RSV-2 — L'entrée dans l'assistant · gravité **bloquant**

**Préconditions** — Connecté avec Aminata, poids mémorisé remis à défaut (« Tout effacer » dans les filtres).
**Étapes**
1. Ouvre `bzv-perkg` et clique « Réserver ».

**Résultat attendu**
- L'écran « Réservation » s'ouvre sur « étape 1 sur 4 », les quatre étapes nommées « Colis », « Destinataire », « Engagement », « Paiement ».
- Sur écran large : le formulaire à gauche, une colonne de droite **collante** avec le récapitulatif et le bouton principal.
- Le titre de l'étape est « Décris ton colis », le sous-titre « Précision et photos garantissent un envoi sans accroc ».
- Deux retours distincts : « Retour au trajet » (quitter) et « Étape précédente » (reculer).

**Verdict** ⬜   **Note** :

---

#### WEB-RSV-3 — Les lieux de rendez-vous · gravité **majeur**

**Étapes**
1. Observe la section « Lieux de rendez-vous ».

**Résultat attendu**
- Deux blocs : « Tu remets le colis à Thomas » et « Le destinataire récupère le colis ».
- Le trajet du jeu d'essai ne propose qu'un lieu de chaque côté : ils sont **pré-sélectionnés**.
- Les types s'affichent en clair : « À l'aéroport », « Lieu exact ».

**Anomalie à guetter** — Sur un trajet **sans aucun lieu** (cas possible via un ancien jeu de données), l'écran doit afficher « Le Voyageur n'a pas précisé de lieu pour ce trajet : vous conviendrez ensemble du point de rendez-vous dans la conversation, une fois la demande acceptée. » et **surtout pas** un écran blanc (voir WEB-NRG-4).
**Verdict** ⬜   **Note** :

---

#### WEB-RSV-4 — Les règles d'or et les produits interdits · gravité **majeur**

**Étapes**
1. Déplie l'encart « Les règles d'or pour un envoi qui se passe bien ».
2. Clique « Voir la liste complète ».

**Résultat attendu** — Quatre puces : « Emballe soigneusement. », « Pèse précisément. », « Décris fidèlement. », « **Aucun produit interdit.** » avec le lien vers la liste. Le lien ouvre une liste lisible.
**Verdict** ⬜   **Note** :

---

#### WEB-RSV-5 — Le choix du produit et la famille refusée · gravité **majeur**

**Étapes**
1. Dans « Que voulez-vous envoyer ? », vérifie les trois choix offerts.
2. Choisis « Un colis (au kilo) ».
3. Dans « Famille du colis », observe « Alimentaire sec & scellé ».
4. Observe « Électronique & appareils ».

**Résultat attendu**
- Les trois choix sont « Un colis (au kilo) », « Un bagage soute 23 kg » et « Un bagage cabine 12 kg ». Le cabine ne doit **pas** être proposé (le trajet ne l'offre pas) ; le soute doit l'être (230 €).
- « Alimentaire sec & scellé » est **visible, grisée et barrée**, avec l'info-bulle « Thomas ne prend pas cette famille sur ce trajet ».
- « Électronique & appareils » affiche **« +20 % » avant le choix**.

**Anomalie à guetter** — Une famille refusée qui serait simplement absente (au lieu d'être visible et barrée) est une anomalie **mineure** : le membre doit voir pourquoi il ne peut pas.
**Verdict** ⬜   **Note** :

---

#### WEB-RSV-6 — Le poids et sa borne · gravité **bloquant**

**Étapes**
1. Observe la valeur pré-remplie du champ « Poids (kg) ».
2. Saisis `35`.
3. Saisis `30`.
4. Saisis `2,5`.

**Résultat attendu**
- Le poids est pré-rempli à **2** (ou au poids mémorisé dans la recherche). **Jamais vide, jamais 0.**
- L'aide affiche « 23 kg encore disponibles sur ce trajet ».
- Étape 2 : erreur **sous le champ**, bouton « Continuer » inactif (au-delà de 30 kg).
- Étape 3 : accepté si les kilos restants le permettent.
- Étape 4 : accepté.

**Vérification complémentaire** — L'info-bulle du poids dit : « Poids déclaré. Un colis léger (enveloppe, passeport, lunettes…) est facturé 0,5 kg minimum et jamais moins de 8 €. Au pickup, un écart ≤ 10 % est toléré. »
**Verdict** ⬜   **Note** :

---

#### WEB-RSV-7 — La taille et son coefficient · gravité **majeur**

**Préconditions** — Poids `2,5`, famille « Vêtements & textile ».
**Étapes**
1. Choisis la taille **S**, lis le récapitulatif.
2. Choisis la taille **L**, lis le récapitulatif.
3. Reviens à **S**.

**Résultat attendu**

| Taille | Transport attendu | Service & protection | Total |
|---|---|---|---|
| S | **28,75 €** | **3,45 €** | **32,20 €** |
| L | **35,94 €** | **4,31 €** | **40,25 €** |

- Les libellés de taille sont : S « enveloppe → boîte à chaussures », M « tient dans un sac cabine », L « occupe une demi-valise », sous le titre « Taille — pas besoin de mesurer » et l'aide « À l'œil : le coefficient s'applique au prix au kilo. »
- Le récapitulatif détaille le transport : « Transport · 2,5 kg × 11,50 €/kg × S ».

**Anomalie à guetter** — Un total qui ne bouge pas, ou un arrondi différent de plus d'un centime : anomalie **bloquante** (le devis affiché doit être exactement celui que le serveur figera).
**Verdict** ⬜   **Note** :

---

#### WEB-RSV-8 — Le supplément de famille et le plancher · gravité **majeur**

**Étapes**
1. Poids `2,5`, taille **S**, famille « Électronique & appareils ». Lis le total.
2. Reviens à « Vêtements & textile », mets le poids à `0,1`. Lis le total.

**Résultat attendu**

| Cas | Transport | Service | Total |
|---|---|---|---|
| Électronique +20 %, 2,5 kg, S | **34,50 €** | **4,14 €** | **38,64 €** |
| 0,1 kg (facturé 0,5 kg → plancher) | **8,00 €** avec la mention « Minimum par colis appliqué : 8,00 € » | **3,00 €** (plancher de commission) | **11,00 €** |

**Verdict** ⬜   **Note** :

---

#### WEB-RSV-9 — La valeur déclarée, la description et les photos · gravité **majeur** · photos **⏭ sans ImageKit**

**Étapes**
1. Saisis `150` dans « Valeur déclarée (€) ».
2. Saisis `abc` (moins de 5 caractères) dans « Description courte », puis passe au champ suivant.
3. Saisis `3 t-shirts, 1 pull, du chocolat`.
4. Ajoute deux photos de colis.

**Résultat attendu**
- L'info-bulle de la valeur dit « La valeur déclarée détermine le plafond d'indemnisation en cas de litige. Indique le prix d'achat du contenu. »
- Étape 2 : refus, la description exige au moins **5 caractères**.
- Étape 4 : les deux premières photos portent les tags « Contenu » et « Emballé » ; jusqu'à **6** photos ; l'aide indique « JPEG ou PNG, max 10 Mo par photo ».

**Vérification complémentaire** — Tente une photo de plus de 10 Mo : refus explicite, aucun envoi.
**Verdict** ⬜   **Note** :

---

#### WEB-RSV-10 — La protection du colis · gravité **majeur**

**Étapes**
1. Observe le bloc « Protection du colis ».
2. Choisis « Garantie Yamba 500 € ».
3. Lis le récapitulatif.
4. Retire les photos du colis et tente de continuer.

**Résultat attendu**
- Deux choix : « Protection de base » marquée « Inclus » (« Tu es protégé contre la non-livraison. Le paiement est bloqué jusqu'à la remise au destinataire. ») et « Garantie Yamba 500 € » marquée « +6 € » (« Perte, vol, casse pendant le transport. Exclusions affichées avant validation (dont saisie douanière d'un colis non conforme). »).
- Avec la garantie et un colis de 2,5 kg taille S : transport 28,75 €, « Service & protection » = 3,45 + 6,00 = **9,45 €**, total **38,20 €**.
- Une ligne « Garantie Yamba 500 € 6,00 € » apparaît dans le détail.
- Étape 4 : les photos deviennent **obligatoires** avec la garantie étendue ; le bouton est bloqué et l'explique.
- **Le mot « assurance » n'apparaît nulle part.** Sa présence est une anomalie **majeure**.

**Verdict** ⬜   **Note** :

---

#### WEB-RSV-11 — Le bagage entier masque poids et taille · gravité **majeur**

**Étapes**
1. Choisis « Un bagage soute 23 kg ».

**Résultat attendu**
- Les champs de poids et de taille **disparaissent** : le transport est le forfait.
- Le récapitulatif affiche transport **230,00 €**, service **27,60 €** (12 %), total **257,60 €**.

**Verdict** ⬜   **Note** :

---

#### WEB-RSV-12 — Le récapitulatif ne montre jamais zéro · gravité **majeur**

**Étapes**
1. Reviens à « Un colis (au kilo) » et vide le champ « Poids (kg) ».

**Résultat attendu** — Le récapitulatif affiche l'indice « Indique le poids du colis pour voir le prix. » et **jamais** « 0 € », « 0,00 € » ou « — ».
**Étapes complémentaires** — Ne choisis aucune taille : l'indice devient « Choisis une taille (S, M ou L). »
**Anomalie à guetter** — Voir WEB-NRG-2.
**Verdict** ⬜   **Note** :

---

#### WEB-RSV-13 — Étape 2 : le destinataire et son téléphone · gravité **bloquant**

**Étapes**
1. Passe à l'étape « Destinataire ». Lis l'encart d'explication.
2. Dans « Téléphone », choisis l'indicatif du Congo et saisis `12`.
3. Corrige avec `061234567`.
4. Renseigne Prénom `Clarisse`, Nom `Mabiala`.
5. Laisse « Email » vide et continue.

**Résultat attendu**
- Le titre est « À qui livrer ? », le sous-titre « Pas besoin de compte Yamba pour le destinataire. Tu lui transmettras le code. »
- L'encart « Comment se passera la livraison » comporte trois puces : « **Un code à 6 chiffres** te sera donné après le paiement. », « **Tu le transmets** au destinataire par SMS, WhatsApp ou oralement. », « **Il le donne au voyageur** à la livraison. Sans ce code, le colis ne peut pas être remis. »
- Le champ « Téléphone » est **le premier** du bloc, avec un sélecteur « Indicatif pays » (défaut `+33`).
- Étape 2 : `12` est refusé.
- Étape 3 : le numéro est accepté et normalisé au format international.
- Étape 5 : l'email est **facultatif** (marqué « (optionnel) ») ; l'étape se valide sans lui.

**Verdict** ⬜   **Note** :

---

#### WEB-RSV-14 — Étape 3 : l'engagement · gravité **bloquant**

**Étapes**
1. Passe à l'étape « Engagement ». Lis les trois puces de l'encart de remise.
2. Lis la Charte Expéditeur.
3. Sans cocher la case, tente de continuer.
4. Coche la case et continue.

**Résultat attendu**
- Titre « Ton engagement » / « Tu certifies sur l'honneur le contenu du colis ».
- L'encart « À la remise du colis, voici ce qui se passera » contient : « **Vérification visuelle obligatoire.** … », « **Refus possible si non-conforme.** … Tu seras remboursé mais le trajet sera perdu. », « **Photos croisées.** … qui feront foi en cas de litige. »
- La Charte énonce les trois engagements (aucun produit illicite, conformité à la catégorie / poids / contenu déclarés, obligations douanières) et la phrase de responsabilité.
- **Une seule case** vaut acceptation de la Charte, des CGV et du Contrat de transport.
- Étape 3 : impossible de continuer.
- Étape 4 : l'étape « Paiement » s'ouvre.

**Verdict** ⬜   **Note** :

---

#### WEB-RSV-15 — Étape 4 : le paiement · gravité **bloquant**

**Étapes**
1. Lis le bandeau en tête de l'étape.
2. Lis l'encart « Après ton paiement ».
3. Observe le composant de paiement.

**Résultat attendu**
- Le sous-titre est « Le montant est autorisé maintenant et débité uniquement quand le voyageur accepte (sous 24 h). »
- **Sans prestataire configuré** (mode recette recommandé) : le bandeau « Mode test : aucun prestataire de paiement n'est configuré. L'autorisation de 32,20 € est simulée — clique sur « Payer » pour envoyer ta demande. »
- **Avec `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`** : un composant de paiement unique (carte, et selon l'appareil Apple Pay / Google Pay). **Jamais** plusieurs composants concurrents.
- L'encart « Après ton paiement » liste cinq puces, dont « Le voyageur reçoit ta demande et a **24h pour accepter**. Tu n'es débité qu'à acceptation. » et « **3 jours après** la livraison validée, le voyageur reçoit son paiement. »
- La mention « Paiement sécurisé par Stripe. Yamba ne stocke jamais tes données bancaires. »
- Le bouton principal porte le montant : « Payer 32,20 € ».

**Verdict** ⬜   **Note** :

---

#### WEB-RSV-16 — Une carte refusée · gravité **majeur** · **⏭ sans clé Stripe publique**

**Étapes**
1. Saisis la carte de test `4000 0000 0000 0002`, une date future et un cryptogramme quelconque.
2. Valide.

**Résultat attendu**
- Le composant de paiement affiche l'erreur de la banque.
- **Aucun deal n'est créé**, aucun kilo n'est réservé, aucun email ne part.
- L'Expéditrice reste à l'étape 4 et peut réessayer.

**Vérification complémentaire** — Le nombre de kilos disponibles sur le trajet est inchangé après l'échec.
**Verdict** ⬜   **Note** :

---

#### WEB-RSV-17 — La demande est envoyée · gravité **bloquant**

**Étapes**
1. Avec un colis de 2,5 kg taille S en vêtements (total 32,20 €), clique « Payer 32,20 € ».

**Résultat attendu**
- Le message « Demande envoyée ! Le voyageur a 24 h pour accepter » s'affiche.
- Le suivi de l'envoi s'ouvre, avec le bandeau « En attente du Voyageur » et le texte « Ta demande est envoyée et ton paiement est autorisé — rien n'est débité tant que le Voyageur n'a pas accepté. » suivi de « Sans réponse, elle expire le {date} et tu es intégralement remboursé·e. »
- Les kilos disponibles du trajet passent de 23 à **20,5 kg**.

**Vérification complémentaire (Mailpit)** — Deux emails :
- Vers Aminata : reçu « Paiement autorisé » avec le montant de 32,20 €.
- Vers Thomas : « Nouvelle demande » indiquant **son gain net (28,75 €)** et la date limite de 24 h — **jamais** le prix payé par l'Expéditrice. Un email qui montrerait 32,20 € au Voyageur est une anomalie **majeure**.
**Verdict** ⬜   **Note** :

---

#### WEB-RSV-18 — Le devis change entre l'affichage et le paiement · gravité **majeur** · **⚠ deux navigateurs**

**Préconditions** — Navigateur A : Aminata, à l'étape 4 sur un trajet **sans réservation active** (par exemple le trajet publié en WEB-TRJ-10). Navigateur B : le Voyageur de ce trajet.
**Étapes**
1. Dans A, va jusqu'à l'étape 4 et **ne paie pas**.
2. Dans B, modifie le prix au kilo du trajet (de 11,50 à 15,00 par exemple) et enregistre.
3. Dans A, clique « Payer ».

**Résultat attendu** — Le message « Le prix a changé depuis ton devis. Le nouveau total est affiché — vérifie-le avant de payer. » ; **aucune empreinte n'est posée**, aucun deal créé, le nouveau total est affiché.
**Verdict** ⬜   **Note** :

---

#### WEB-RSV-19 — Le dernier kilo · gravité **majeur** · **⚠ deux navigateurs**

**Préconditions** — Un trajet dont il reste exactement 2 kg. Deux Expéditeurs différents (Aminata dans A, João dans B), chacun à l'étape 4 avec un colis de 2 kg.
**Étapes**
1. Dans A, clique « Payer ».
2. Immédiatement après, dans B, clique « Payer ».

**Résultat attendu**
- A : la demande est créée.
- B : « Il ne reste plus assez de place sur ce trajet pour ton colis. » ; **rien n'est débité** et aucune trace de demande n'apparaît dans « Mes envois » de B.

**Verdict** ⬜   **Note** :

---

#### WEB-RSV-20 — On ne réserve pas son propre trajet · gravité **majeur**

**Préconditions** — Connecté avec Thomas.
**Étapes**
1. Ouvre `/fr/trips/<id de bzv-perkg>/book` directement.

**Résultat attendu** — Le message « Tu ne peux pas réserver ton propre trajet. » ; aucune demande créée.
**Verdict** ⬜   **Note** :

---

#### WEB-RSV-21 — Réserver un trajet parti ou masqué · gravité **majeur**

**Étapes**
1. Tente de réserver `bzv-inflight` (départ passé).
2. Tente de réserver un trajet masqué par Yamba (WEB-TRJ-21).

**Résultat attendu** — Dans les deux cas, « Ce trajet n'accepte plus de demandes. » ou « Trajet introuvable ». Aucune demande créée.
**Verdict** ⬜   **Note** :

---

#### WEB-RSV-22 — L'état de l'assistant survit à une rotation ou un rechargement · gravité **mineur**

**Étapes**
1. Remplis les étapes 1 et 2, puis recharge la page.

**Résultat attendu** — Les saisies sont retrouvées (l'état vit dans le stockage de session du navigateur). Une perte complète est une anomalie **mineure**.
**Verdict** ⬜   **Note** :

---

### 5.13 — `WEB-TRU` · Les plafonds du compte neuf

**Ce que couvre ce chapitre.** Les trois plafonds appliqués aux comptes de moins de 30 jours ayant moins de 3 envois terminés.
**Compte de travail** — `recette+neuf@seed.yamba.dev`, créé pendant cette session. Les comptes du jeu d'essai ont 90 jours : ils **n'ont pas** de plafond.

---

#### WEB-TRU-1 — Le plafond de valeur déclarée · gravité **majeur** · `[TRU1]`

**Préconditions** — Connecté avec le compte neuf.
**Étapes**
1. Réserve `bzv-perkg` : colis de 2 kg, taille S, vêtements.
2. Saisis `450` dans « Valeur déclarée (€) » et va jusqu'à « Payer ».
3. Corrige la valeur à `250` et recommence.

**Résultat attendu**
- Étape 2 : refus **avant tout paiement**, avec le message « Ton compte est récent : pour l'instant, tes envois sont plafonnés (valeur déclarée, poids et nombre par mois). Le plafond se lève avec tes premiers envois terminés. »
- Étape 3 : la demande passe.

**Vérification complémentaire** — Aucun débit, aucune empreinte, aucun email de reçu à l'étape 2.
**Verdict** ⬜   **Note** :

---

#### WEB-TRU-2 — Le plafond de poids · gravité **majeur** · `[TRU3]`

**Étapes**
1. Avec le compte neuf, tente un colis de `12` kg.
2. Puis de `8` kg.

**Résultat attendu** — Refus au-delà de **10 kg** avec le même message ; 8 kg passe.
**Verdict** ⬜   **Note** :

---

#### WEB-TRU-3 — Le plafond d'envois par mois · gravité **majeur** · `[TRU2]`

**Étapes**
1. Avec le compte neuf, crée **cinq** demandes dans le mois civil en cours (répartis sur plusieurs trajets si nécessaire).
2. Tente une sixième demande.

**Résultat attendu** — Les cinq premières passent, la sixième est refusée avec le même message. Le refus intervient **dès l'autorisation de paiement**.
**Note** — Scénario long ; peut être joué en abaissant le paramètre depuis le back-office (voir RECETTE-02-ADMIN, `[TRU7]`), ce qui doit produire l'effet en moins de 30 secondes.
**Verdict** ⬜   **Note** :

---

#### WEB-TRU-4 — Un compte ancien n'a aucun plafond · gravité **majeur** · `[TRU4]`

**Préconditions** — Connecté avec Aminata (compte de 90 jours, plusieurs envois terminés).
**Étapes**
1. Réserve un colis de `12` kg avec une valeur déclarée de `450` €.

**Résultat attendu** — **Aucun refus**. La demande passe normalement.
**Verdict** ⬜   **Note** :

---

#### WEB-TRU-5 — Le score interne n'est jamais visible · gravité **bloquant**

**Étapes**
1. Parcours l'ensemble des écrans membre du compte neuf : profil, tableau de bord, suivi d'envoi, page publique.
2. Ouvre l'export de données (chapitre 5.25).

**Résultat attendu** — **Aucune mention** d'un score, d'un niveau de risque, de « compte à risque » ou de points. Le seul signal visible est le message de plafond. Toute fuite du score est une anomalie **bloquante**.
**Verdict** ⬜   **Note** :

---

### 5.14 — `WEB-DEA` · La demande côté Voyageur : accepter, refuser, expirer

**Ce que couvre ce chapitre.** L'écran de demande reçue, la Charte Voyageur, l'acceptation, le refus, l'expiration, et l'écran du deal accepté.
**Compte de travail** — `thomas.carrier@seed.yamba.dev` ; deal `bzv-pending` (Aminata) ou la demande créée en WEB-RSV-17.

---

#### WEB-DEA-1 — Où la demande apparaît · gravité **majeur**

**Préconditions** — Connecté avec Thomas.
**Étapes**
1. Ouvre l'accueil du tableau de bord.
2. Ouvre « Mes trajets ».
3. Ouvre la cloche de notifications.

**Résultat attendu**
- Accueil : une carte « {n} demandes en attente » / « Paris → Brazzaville · réponds avant l'expiration des 24 h » avec le badge « À répondre » et le bouton « Voir les demandes ».
- « Mes trajets » : la bande « À traiter » en tête, avec « Demande de {prénom} », le sous-titre « {famille} · {poids} · tu gagnes {gain} · reçue {quand} », le badge « Expire dans {durée} » et le bouton « Répondre ».
- La ligne du trajet porte le badge « Demande » sous la section « Demandes et colis ».
- Notification in-app « Nouvelle demande de {prénom} » / « Paris → Brazzaville · {poids} · réponds sous 24 h ».
- **Il n'existe pas d'onglet « demandes » séparé** : son apparition serait une anomalie mineure.

**Verdict** ⬜   **Note** :

---

#### WEB-DEA-2 — L'écran « Nouvelle demande de Deal » · gravité **bloquant**

**Étapes**
1. Clique « Répondre » sur la demande d'Aminata.

**Résultat attendu**
- Titre « Nouvelle demande de Deal », « Reçue il y a {durée} », « État : demande reçue, en attente de réponse ».
- « Cette demande expire dans {h} » avec un compte à rebours qui se rafraîchit ; la puce passe en ambre puis en rouge à moins de 2 heures.
- Bloc « DE LA PART DE » : avatar, prénom et initiale, « {n} envois », « Membre depuis {mois} {année} », lien « Voir profil ».
- Bloc « DÉTAILS DU COLIS » : catégorie, « Poids déclaré », « Valeur déclarée », description.
- Bloc « PHOTOS DÉCLARÉES PAR {prénom} », avec la visionneuse plein écran.
- Bloc « MODALITÉS DE REMISE ET LIVRAISON » portant la mention « Téléphone du destinataire communiqué à la prise en charge ».
- Bloc « COUVERTURE DU COLIS » : « Garantie Yamba incluse » ou « Protection étendue 500 € incluse » — **jamais le mot « assurance »**.
- Encart « Avant d'accepter, lis bien ces points » avec ses quatre puces.
- Bloc « TU GAGNES » avec **le net (28,75 €)** et « Versement à J+4 après livraison validée · sur ton compte Stripe ».

**Anomalie bloquante à guetter** — Le Voyageur ne doit **jamais** voir le total payé par l'Expéditeur (32,20 €), ni la commission de Yamba.
**Verdict** ⬜   **Note** :

---

#### WEB-DEA-3 — La Charte Voyageur est obligatoire · gravité **bloquant**

**Étapes**
1. Sans cocher la case, clique « Accepter et confirmer ».
2. Lis la Charte.
3. Coche la case.

**Résultat attendu**
- Étape 1 : refus, message « Tu dois accepter la Charte pour confirmer ce Deal » ; l'indication sous le bouton dit « Coche la Charte pour confirmer ».
- La Charte énonce les six engagements (vérifier visuellement, refuser un colis non conforme, transporter avec diligence, remettre uniquement contre le code, respecter les douanes, signaler tout incident) et la phrase de responsabilité personnelle.
- Étape 3 : l'indication devient « ✓ Charte acceptée » et le bouton devient actif.

**Verdict** ⬜   **Note** :

---

#### WEB-DEA-4 — Accepter la demande · gravité **bloquant**

**Étapes**
1. Coche la Charte et clique « Accepter et confirmer ».

**Résultat attendu**
- L'écran passe à « Mon Deal accepté » avec le bandeau « Tu es engagé sur ce Deal » / « {prénom} est prévenue · à toi de fixer le rendez-vous pour le pickup ».
- Le parcours en cinq jalons s'affiche : « Deal accepté », « Pickup du colis », « Transport », « Livraison », « Versement ».
- Un bloc « Contacte {prénom} pour fixer le rendez-vous » avec les boutons « Envoyer un message » et « Appeler ».
- Le bloc « TON PAIEMENT » indique « Net pour toi », « Versé à J+4 », « Sur ton compte de paiement ».

**Vérification complémentaire**
- Côté Aminata : notification in-app « Thomas a accepté ta demande » et email « {prénom} a accepté ta demande » avec le montant confirmé.
- Le paiement est **capturé** : dans « Finances » › « Paiements » d'Aminata, la ligne passe de « Autorisé, pas débité · en attente du Voyageur » à « Bloqué chez Yamba ».
- Le fil de messagerie du deal devient accessible (chapitre 5.15).
**Verdict** ⬜   **Note** :

---

#### WEB-DEA-5 — Refuser une demande · gravité **majeur**

**Préconditions** — Une autre demande en attente (par exemple `gru-pending` avec Inês, ou une nouvelle demande créée).
**Étapes**
1. Clique « Refuser ».
2. Lis la fenêtre de confirmation.
3. Choisis la raison « Poids ou volume trop important ».
4. Confirme.

**Résultat attendu**
- La fenêtre porte « Refuser cette demande ? » / « {prénom} sera notifiée et pourra contacter un autre Voyageur. Ton taux d'acceptation reste intact. »
- Le champ est « Raison (optionnel) », avec exactement cinq choix : « Catégorie non transportée », « Poids ou volume trop important », « Lieu de remise ou livraison incompatible », « Délais trop courts », « Autre raison ». **Aucun champ de texte libre.**
- Toast « Demande refusée. {prénom} a été notifiée. »
- Le Voyageur voit ensuite « Tu as refusé cette demande ».

**Vérification complémentaire**
- Côté Expéditeur : bandeau « Demande non acceptée » / « Le Voyageur n'a pas pu accepter ta demande. Tu n'es pas débité·e : l'autorisation de paiement est levée intégralement. »
- Email « non acceptée » avec la raison.
- Les kilos sont rendus au trajet.
- **Aucune pénalité** pour le Voyageur.
**Verdict** ⬜   **Note** :

---

#### WEB-DEA-6 — Une demande expirée ne s'accepte plus · gravité **majeur** · **dépend d'un cron**

**Préconditions** — Une demande dont la date limite est dépassée. Raccourci de recette : reculer `expiresAt` en base de plus de 24 heures.
**Étapes**
1. Ouvre la demande côté Voyageur.
2. Clique « Accepter et confirmer ».

**Résultat attendu**
- Le compte à rebours affiche « Cette demande a expiré » / « Expirée ».
- L'acceptation est refusée **avant même** le passage du cron.
- Côté Expéditeur, après le passage du cron (toutes les 5 minutes) : bandeau « Demande expirée » / « Le Voyageur n'a pas répondu dans les 24 heures. Tu n'es pas débité·e : l'autorisation de paiement est levée intégralement. » et l'email « Ta demande a expiré ».

**Verdict** ⬜   **Note** :

---

#### WEB-DEA-7 — Deux décisions concurrentes ne créent pas deux vérités · gravité **majeur** · **⚠ deux onglets**

**Étapes**
1. Ouvre la même demande dans deux onglets du navigateur de Thomas.
2. Accepte dans l'onglet 1.
3. Sans recharger, refuse dans l'onglet 2.

**Résultat attendu** — L'onglet 2 affiche « Ce deal a changé entre-temps. La page vient d'être actualisée. » et se relit sur l'état réel (accepté). **Aucun double traitement**, aucun double débit.
**Verdict** ⬜   **Note** :

---

#### WEB-DEA-8 — Les états fermés du deal · gravité **mineur**

**Étapes**
1. Ouvre l'adresse d'une demande déjà refusée, expirée ou annulée.

**Résultat attendu** — Un bandeau nomme l'état (« Tu as refusé cette demande », « Cette demande a expiré », « Cette demande a été annulée ») suivi de « Il n'y a plus d'action à faire ici. » Aucun bouton d'action.
**Verdict** ⬜   **Note** :

---

#### WEB-DEA-9 — L'écran « Mon Deal accepté » en détail · gravité **majeur**

**Préconditions** — Le deal `bzv-accepted` (Pauline → Thomas), ou celui accepté en WEB-DEA-4.
**Étapes**
1. Ouvre le deal accepté côté Thomas.

**Résultat attendu**
- Bloc « DÉTAILS DU DEAL » avec « EXPÉDITEUR », « CONTENU DÉCLARÉ », « PICKUP — CHOISI PAR {prénom} », « LIVRAISON À ».
- L'encart « Comment ça va se passer ? » contient explicitement « **Le code reste secret.** Tu ne vois pas le code de livraison. {prénom} le révèle à {destinataire} quand tu confirmes le pickup. »
- Le bloc « TON PAIEMENT » annonce « Le versement part après la période de vérification de l'Expéditeur, puis arrive sur ton compte bancaire sous 2 à 7 jours. » — jamais une promesse de date d'arrivée.
- Un encart « Le jour J : la prise en charge » avec le bouton « Confirmer la prise en charge ».

**Anomalie bloquante à guetter** — Le code de livraison ne doit apparaître **nulle part** côté Voyageur.
**Verdict** ⬜   **Note** :

---

### 5.15 — `WEB-MSG` · Messagerie, rendez-vous et numéro de téléphone

**Ce que couvre ce chapitre.** Le fil par deal, le panneau de rendez-vous, les réponses rapides, les deux gardes de sécurité, l'ouverture du numéro et le signalement d'un message.

**Deal de travail** — `bzv-accepted` : **Pauline Lemaire** (Expéditrice) ↔ **Thomas** (Voyageur). Le jeu d'essai y pose déjà deux messages, un rendez-vous proposé et un message signalé.
**Note** — La plupart des scénarios de ce chapitre sont **⚠ deux navigateurs** : A = Pauline, B = Thomas.

---

#### WEB-MSG-1 — La liste des conversations · gravité **majeur** · `[FCH]`

**Préconditions** — Connecté avec Pauline.
**Étapes**
1. Tableau de bord › « Messages ».

**Résultat attendu**
- La conversation du deal apparaît, avec le rôle de l'interlocuteur, le corridor, le dernier message et le rendez-vous « à confirmer ».
- La bulle de l'en-tête compte les **conversations** non lues, pas les messages.
- Sur grand écran : liste à gauche, fil à droite. Sur mobile : une seule colonne.
- Sans conversation ouverte : « Choisissez une conversation. »

**Verdict** ⬜   **Note** :

---

#### WEB-MSG-2 — L'état vide · gravité **mineur**

**Préconditions** — Connecté avec un compte sans deal accepté (le compte neuf).
**Étapes**
1. Ouvre « Messages ».

**Résultat attendu** — « Aucune conversation » / « Une conversation s'ouvre dès qu'un Voyageur accepte votre colis, ou dès que vous acceptez une demande. »
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-3 — La conversation n'existe pas avant l'acceptation · gravité **majeur**

**Préconditions** — Connecté avec Aminata, deal `bzv-pending` (en attente).
**Étapes**
1. Ouvre le suivi de cet envoi et cherche un bouton de message.

**Résultat attendu** — Le bouton explique que la conversation s'ouvrira à l'acceptation : « La conversation s'ouvre une fois le deal accepté. » Aucun fil n'est créé.
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-4 — Envoyer un message · gravité **bloquant** · **⚠ deux navigateurs**

**Étapes**
1. Dans A (Pauline), ouvre le fil du deal.
2. Écris `Bonjour Thomas, le colis est prêt.` et clique « Envoyer ».
3. Dans B (Thomas), ouvre « Messages ».

**Résultat attendu**
- Le message apparaît immédiatement dans le fil de A, dans une bulle **à droite**.
- Le fil est groupé par jour.
- Dans B, le message apparaît sans rechargement manuel (le fil s'actualise seul environ toutes les 3 secondes quand il est ouvert).
- Une notification in-app arrive pour Thomas.

**Vérification complémentaire** — La zone de saisie porte le placeholder « Écrire un message… » et l'avertissement « Le code de livraison se donne en main propre, jamais par écrit. »
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-5 — Les réponses rapides remplissent sans envoyer · gravité **majeur**

**Étapes**
1. Dans le fil, clique une réponse rapide, par exemple « Je suis en route. ».

**Résultat attendu** — Le texte **remplit la zone de saisie** sans partir. Le membre peut le relire, le modifier, puis cliquer « Envoyer ».
**Vérification complémentaire** — Les neuf puces attendues sont : « Je suis en route. », « J'ai environ 20 minutes de retard. », « À quel terminal es-tu ? », « Je suis au terminal, près des comptoirs d'enregistrement. », « Quel est ton numéro de vol ? », « Le colis est prêt, emballé et fermé. », « J'ai atterri, je récupère mes bagages. », « Le destinataire est prévenu et disponible. », « Appelle-moi quand tu arrives. » Elles doivent être **dans la langue du lecteur** : bascule en anglais pour vérifier.
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-6 — Le code de livraison ne s'écrit jamais · gravité **bloquant**

**Préconditions** — Un deal **déjà pris en charge** dont le code est `742891` (par exemple `bzv-picked`, Aminata ↔ Thomas). Se connecter avec Aminata et ouvrir le fil de ce deal.
**Étapes**
1. Écris `le code est 742891` et clique « Envoyer ».
2. Écris `Le code : 742 891` et envoie.
3. Écris `mon numéro de vol est 123456` et envoie.

**Résultat attendu**
- Étapes 1 et 2 : le message est **refusé**, avec un message sous la saisie rappelant que le code se donne en main propre. **Le message n'apparaît pas dans le fil.**
- Étape 3 : un groupe de six chiffres qui n'est **pas** le code passe normalement.

**Anomalie bloquante à guetter** — Si le code passe, l'invariant « le code ne circule jamais par écrit » est rompu.
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-7 — Les coordonnées sont repérées, pas bloquées · gravité **majeur**

**Étapes**
1. Écris `appelle-moi au 06 12 34 56 78` et envoie.
2. Écris `écris-moi à moi@exemple.fr` et envoie.

**Résultat attendu** — Les deux messages **partent** et s'affichent normalement. **Aucune alerte visible** pour l'auteur.
**Vérification complémentaire (back-office)** — Ces messages doivent apparaître dans la file des messages signalés côté équipe (voir RECETTE-02-ADMIN).
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-8 — Proposer un rendez-vous · gravité **bloquant** · **⚠ deux navigateurs**

**Étapes**
1. Dans B (Thomas), en haut du fil, ouvre le panneau « Rendez-vous ».
2. Choisis le type « Remise du colis ».
3. Lieu : `Paris CDG, terminal 2E, comptoirs d'enregistrement`.
4. Précisions : `Devant les bornes libre-service, côté départ.`
5. Début : dans 3 jours à 10:00. Fin : le même jour à 11:00.
6. Clique « Proposer ce rendez-vous ».

**Résultat attendu**
- Le panneau affiche l'état « En attente de l'autre personne ».
- Une **ligne système** apparaît dans le fil : « Un rendez-vous a été proposé. »
- Dans A (Pauline), le panneau affiche « À confirmer par vous » avec le bouton « Accepter ».

**Verdict** ⬜   **Note** :

---

#### WEB-MSG-9 — On n'accepte pas sa propre proposition · gravité **majeur**

**Étapes**
1. Dans B (Thomas, l'auteur de la proposition), cherche un bouton « Accepter ».

**Résultat attendu** — Le bouton « Accepter » **n'est pas proposé** à l'auteur. Seuls « Proposer un autre » et l'attente sont offerts.
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-10 — Les bornes du créneau · gravité **majeur**

**Étapes**
1. Propose un rendez-vous qui commence **dans 10 minutes**.
2. Propose un rendez-vous **dans 120 jours**.
3. Propose un rendez-vous d'une **durée de 20 heures**.

**Résultat attendu** — Les trois propositions sont refusées, avec « Le rendez-vous n'a pas pu être proposé. » ou un message plus précis. Les bornes sont : au moins **30 minutes** à l'avance, au plus **90 jours**, durée **≤ 12 heures**.
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-11 — Contre-proposer puis accepter · gravité **majeur** · **⚠ deux navigateurs**

**Étapes**
1. Dans A (Pauline), clique « Proposer un autre » et propose le même jour à 12:00–13:00.
2. Dans B (Thomas), clique « Accepter ».

**Résultat attendu**
- La contre-proposition **remplace** la proposition ouverte du même type : il n'y a jamais deux propositions concurrentes de remise.
- Après acceptation, l'état devient **« Confirmé »**.
- Une ligne système apparaît : « Le rendez-vous est confirmé. »

**Verdict** ⬜   **Note** :

---

#### WEB-MSG-12 — Le numéro s'ouvre tard · gravité **bloquant**

**Préconditions** — Le rendez-vous de remise confirmé au scénario précédent, plus de 2 heures avant son début.
**Étapes**
1. Dans le fil, clique « Voir le numéro ».

**Résultat attendu** — Le numéro **ne s'affiche pas**. Un bandeau annonce l'heure d'ouverture : « Le numéro s'affiche à partir du {heure} (2 h avant le rendez-vous confirmé ou le départ). »
**Étapes complémentaires** — Sur un deal accepté **sans aucun rendez-vous confirmé**, le message doit être « Le numéro s'affiche 2 h avant le rendez-vous confirmé. Proposez et confirmez un rendez-vous ci-dessous. »
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-13 — Le numéro s'affiche à l'heure et laisse une trace · gravité **majeur**

**Préconditions** — Un rendez-vous de remise confirmé dont le début est dans **moins de 2 heures**. Raccourci de recette : proposer et accepter un rendez-vous dans 40 minutes (au-delà des 30 minutes minimales).
**Étapes**
1. Clique « Voir le numéro ».

**Résultat attendu**
- Le numéro de l'autre partie s'affiche : « Numéro de {prénom} : … ».
- Sur mobile, il est cliquable (`tel:`).
- Une **ligne système** apparaît dans le fil : « Le numéro de téléphone a été affiché. »
- La révélation est **unique par lecteur** : un second clic ne crée pas une seconde ligne.

**Verdict** ⬜   **Note** :

---

#### WEB-MSG-14 — « Appeler » ne compose jamais un numéro · gravité **majeur**

**Étapes**
1. Depuis l'écran du deal accepté (côté Voyageur ou Expéditeur), clique « Appeler ».

**Résultat attendu** — Le **fil de messagerie s'ouvre**, en mettant en avant le numéro s'il est révélé, ou son heure d'ouverture sinon. **Aucun lien `tel:` direct n'est déclenché depuis l'écran du deal.**
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-15 — Les sept boutons « Message » / « Appeler » mènent au fil · gravité **majeur**

**Étapes**
1. Parcours ces écrans et clique le bouton de contact sur chacun :
   - suivi Expéditeur « accepté »,
   - suivi Expéditeur « pris en charge »,
   - suivi Expéditeur « en transit »,
   - deal accepté côté Voyageur,
   - prise en charge côté Voyageur,
   - suivi de transit côté Voyageur,
   - écran de livraison côté Voyageur.

**Résultat attendu** — Chacun ouvre **le fil du même deal**, sans en créer un second. Aucun bouton ne mène à une page vide.
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-16 — Signaler un message · gravité **majeur**

**Préconditions** — Connecté avec Pauline ; le fil contient un message **de Thomas** (le jeu d'essai en pose un : « régler ça directement entre nous, hors appli ? »).
**Étapes**
1. Sur la bulle de Thomas, clique l'icône de signalement (« Signaler ce message »).
2. Choisis « Veut sortir de Yamba (paiement ou envoi en dehors) ».
3. Ajoute une précision et envoie.
4. Recommence sur le **même** message.

**Résultat attendu**
- La fenêtre porte « Signaler un message » / « Dis-nous ce qui ne va pas. Notre équipe lira la conversation et reviendra vers toi si besoin. »
- Les quatre motifs sont : « Veut sortir de Yamba (paiement ou envoi en dehors) », « Tentative d'arnaque », « Propos déplacés ou harcèlement », « Autre ».
- Après envoi : « Merci, le signalement est transmis à notre équipe. »
- Étape 4 : « Tu as déjà signalé ce message. »
- **Rien ne change** dans le fil ; le message signalé reste visible ; Thomas **n'est pas prévenu**.

**Verdict** ⬜   **Note** :

---

#### WEB-MSG-17 — On ne signale pas ses propres messages · gravité **mineur**

**Étapes**
1. Survole une de tes propres bulles.

**Résultat attendu** — Aucun bouton de signalement.
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-18 — Aucune suppression de message · gravité **majeur**

**Étapes**
1. Cherche une action de suppression ou de modification sur une bulle, la sienne comme celle de l'autre.

**Résultat attendu** — **Aucune**. Un message envoyé ne se supprime pas : le fil est une pièce du dossier de médiation.
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-19 — Le fil est en lecture seule pendant un litige · gravité **majeur**

**Préconditions** — Le deal `bzv-disputed` (Chinwe ↔ Thomas), en litige.
**Étapes**
1. Connecté avec Chinwe, ouvre le fil de ce deal.

**Résultat attendu** — La saisie est fermée avec le motif exact : « Un litige est en cours : les échanges passent par la médiation. » Le fil reste **lisible**.
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-20 — Le fil se ferme 14 jours après la fin du deal · gravité **mineur** · **dépend d'une date**

**Préconditions** — Un deal terminé depuis plus de 14 jours. Raccourci de recette : reculer la date de fin en base.
**Étapes**
1. Ouvre son fil.

**Résultat attendu** — « Cette conversation est fermée à l'écriture. Vous pouvez toujours la relire. » Un deal terminé depuis **moins** de 14 jours reste ouvert à l'écriture.
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-21 — L'email de relance des messages non lus · gravité **majeur** · **dépend d'un cron**

**Préconditions** — La relance activée (Sécurité › Mes données). Cron de messagerie actif (toutes les 5 minutes).
**Étapes**
1. Dans B (Thomas), envoie un message à Pauline.
2. Dans A, **n'ouvre pas** le fil.
3. Attends 15 à 20 minutes, puis ouvre Mailpit.
4. Dans B, envoie un second message dans les 30 minutes qui suivent.

**Résultat attendu**
- Étape 3 : un email « {prénom} t'a écrit à propos de {route} » est arrivé pour Pauline. **Il ne contient pas le texte du message.**
- Étape 4 : **aucun second email** avant une heure : au plus un par heure et par conversation.

**Vérification complémentaire** — La notification in-app, elle, est immédiate à chaque message.
**Verdict** ⬜   **Note** :

---

#### WEB-MSG-22 — Un tiers ne voit pas le fil · gravité **bloquant**

**Préconditions** — Note l'adresse du fil de `bzv-accepted`. Connecte-toi avec un compte étranger au deal (Aminata).
**Étapes**
1. Ouvre cette adresse.

**Résultat attendu** — Accès refusé : « La conversation n'a pas pu être ouverte. » Aucun contenu du fil n'est révélé.
**Verdict** ⬜   **Note** :

---

### 5.16 — `WEB-PIC` · Prise en charge et jalons de transit

**Ce que couvre ce chapitre.** L'écran de prise en charge (checklist, photos, refus) et les jalons facultatifs du transit.
**Deal de travail** — Le deal accepté au chapitre 5.14, ou `yul-accepted` (Marie-Claire ↔ Marc).

---

#### WEB-PIC-1 — L'écran « Prise en charge du colis » · gravité **bloquant**

**Préconditions** — Connecté avec le Voyageur, sur un deal **accepté**.
**Étapes**
1. Clique « Confirmer la prise en charge ».

**Résultat attendu**
- Le titre est « Prise en charge du colis », le sous-titre « Vérifie le contenu visuellement, prends tes photos, puis confirme. »
- L'avertissement « Vérifie attentivement avant de confirmer » / « Une fois la prise en charge confirmée, tu es responsable du colis et engagé sur le transport. Si quelque chose ne va pas, refuse plutôt que d'accepter. »
- À droite, la carte « Ce qu'{prénom} a déclaré » (catégorie, poids, valeur) — **la référence de comparaison**.
- Une carte « CONFIRMATION » avec la progression « Vérification » et « Photos ».
- Les boutons « Confirmer la prise en charge » et « Refuser le colis ».

**Verdict** ⬜   **Note** :

---

#### WEB-PIC-2 — La checklist en cinq points · gravité **bloquant**

**Étapes**
1. Lis les cinq points de la section « Vérifie le contenu ».
2. Coche-en trois seulement et tente de confirmer.

**Résultat attendu**
- Les cinq points sont exactement : « Le contenu correspond à ce qu'{prénom} a déclaré », « Le poids me semble correspondre à la déclaration ({poids} kg) », « Aucun produit interdit n'est présent (armes, drogues, contrefaçons, etc.) », « L'emballage est correct et le colis peut voyager sans risque », « J'ai vu et identifié chaque article du colis ».
- L'intitulé rappelle « Coche chaque point après vérification physique ».
- Étape 2 : le bouton reste inactif et **explique ce qui manque** : « Coche les 5 points de vérification avant de confirmer ».

**Verdict** ⬜   **Note** :

---

#### WEB-PIC-3 — Les photos sont obligatoires · gravité **bloquant** · **⏭ sans ImageKit**

**Étapes**
1. Coche les cinq points, n'ajoute **aucune** photo et tente de confirmer.
2. Ajoute une photo et confirme.

**Résultat attendu**
- Étape 1 : le bouton reste inactif avec « Ajoute au moins 1 photo avant de confirmer ». La section porte le badge « Au moins 1 obligatoire ».
- Étape 2 : la confirmation devient possible.
- L'aide recommande « 1 photo du contenu déballé et 1 photo du colis emballé prêt au transport. »

**Vérification complémentaire (garde serveur)** — La contrainte doit être **serveur**, pas seulement à l'écran : si l'appel est forcé sans photo, il doit être refusé. Ce point est vérifié dans **RECETTE-03-API**.
**Verdict** ⬜   **Note** :

---

#### WEB-PIC-4 — L'échec d'un téléversement n'envoie rien · gravité **majeur** · **⏭ sans ImageKit**

**Étapes**
1. Ajoute une photo de plus de 10 Mo.
2. Coupe le réseau et tente d'ajouter une photo valide.

**Résultat attendu**
- Étape 1 : « Une photo dépasse 10 Mo. Réduis-la ou choisis-en une autre — rien n'a été envoyé. »
- Étape 2 : « Le téléversement d'une photo a échoué. Vérifie ta connexion et réessaye — rien n'a été envoyé. »
- Dans les deux cas, **aucune prise en charge n'est enregistrée**.

**Verdict** ⬜   **Note** :

---

#### WEB-PIC-5 — Confirmer la prise en charge · gravité **bloquant**

**Étapes**
1. Coche les cinq points, ajoute deux photos (tags « Contenu » et « Emballé »), écris une note libre.
2. Clique « Confirmer la prise en charge ».

**Résultat attendu**
- Toast « Prise en charge confirmée ! {prénom} a reçu son code de livraison. »
- L'écran passe au suivi de transit.
- Le **téléphone du destinataire** devient visible côté Voyageur, dans la carte « {prénom} {nom} · Destinataire ».

**Vérification complémentaire**
- Côté Expéditeur : notification in-app « {prénom} a pris ton colis en charge » et email « ton code est prêt dans ton suivi » — **l'email ne contient pas le code**.
- Le suivi Expéditeur affiche désormais le code à six chiffres.
**Anomalie bloquante** — Un code visible dans l'email ou côté Voyageur.
**Verdict** ⬜   **Note** :

---

#### WEB-PIC-6 — Refuser le colis · gravité **bloquant**

**Préconditions** — Un **autre** deal accepté (ne pas réutiliser celui du scénario précédent).
**Étapes**
1. Sur l'écran de prise en charge, clique « Refuser le colis ».
2. Lis la fenêtre de confirmation.
3. Choisis « Le contenu ne correspond pas à la déclaration ».
4. Confirme.

**Résultat attendu**
- La fenêtre porte « Refuser ce colis ? » / « Le Deal sera annulé et {prénom} intégralement remboursée. Refuser un colis non conforme ne pénalise jamais ta réputation. »
- Les cinq raisons sont : « Le contenu ne correspond pas à la déclaration », « Contenu suspect ou interdit », « Poids ou volume trop important », « Emballage inadapté au transport », « Autre raison ». **Aucun champ de texte libre.**
- Toast « Colis refusé. {prénom} a été notifiée et sera remboursée. »

**Vérification complémentaire**
- Côté Expéditeur : deux emails, « refus à la remise » avec la raison traduite, puis « Remboursement émis » avec **le montant intégral**.
- Les kilos sont rendus au trajet.
- **Aucune pénalité** ne s'affiche sur le profil du Voyageur (le compteur d'annulations n'augmente pas).
**Verdict** ⬜   **Note** :

---

#### WEB-PIC-7 — L'écran de transit et sa carte d'action unique · gravité **majeur**

**Préconditions** — Un deal **pris en charge** (par exemple `sgn-picked`, Mai ↔ Linh).
**Étapes**
1. Connecté avec le Voyageur, ouvre le deal.

**Résultat attendu**
- Bandeau « En transit vers {ville} » / « Colis pris en charge il y a {durée} · vol prévu à {heure} ».
- **Une seule carte d'action** propose le prochain jalon logique : « Tu es à l'aéroport ? » avec le bouton « Je suis à l'aéroport ».
- La timeline « ÉTAPES DU VOYAGE » porte le badge **« Optionnel »**.
- La carte du destinataire affiche son **vrai numéro** avec « Appeler » et « WhatsApp ».
- Le bloc « TON PAIEMENT » indique « Versé à J+4 après livraison ».

**Verdict** ⬜   **Note** :

---

#### WEB-PIC-8 — Les jalons sont ordonnés et non répétables · gravité **majeur**

**Étapes**
1. Clique « Je suis à l'aéroport », attends la fin du délai d'annulation.
2. La carte propose « Ton vol décolle ? ». Clique « L'avion décolle ».
3. Puis « J'ai atterri ».
4. Recharge la page et cherche à reconfirmer un jalon déjà passé.

**Résultat attendu**
- Les trois jalons s'enchaînent dans l'ordre : aéroport → décollage → atterrissage.
- Un jalon déjà confirmé n'est plus proposé.
- Après l'atterrissage, la carte propose « {destinataire} t'a donné le code ? » avec « Valider la livraison ».

**Verdict** ⬜   **Note** :

---

#### WEB-PIC-9 — Le délai d'annulation de 5 secondes · gravité **mineur**

**Étapes**
1. Clique un jalon.
2. Dans le toast, clique « Annuler » **avant** la fin du décompte.
3. Reclique le jalon et laisse passer les 5 secondes.

**Résultat attendu**
- Étape 2 : « Annulé, rien n'a été envoyé. » Le jalon n'est pas enregistré.
- Étape 3 : « C'est noté ! {prénom} a été prévenue. » Le jalon est **acquis** : il n'existe aucune dé-confirmation ensuite.

**Note** — Fermer l'onglet pendant les 5 secondes perd la confirmation : c'est attendu, à refaire.
**Verdict** ⬜   **Note** :

---

#### WEB-PIC-10 — Les jalons côté Expéditeur : in-app partout, email seulement à l'atterrissage · gravité **majeur** · **⚠ deux navigateurs**

**Étapes**
1. Dans B (Voyageur), confirme les trois jalons l'un après l'autre.
2. Dans A (Expéditeur), observe le suivi et la cloche à chaque fois.
3. Ouvre Mailpit après chaque jalon.

**Résultat attendu**

| Jalon | Bannière du suivi Expéditeur | Notification in-app | Email |
|---|---|---|---|
| Aéroport | « {prénom} est à l'aéroport » / « Prêt à embarquer · vol prévu à {heure} » | oui | **non** |
| Décollage | « En vol vers {ville} » / « {prénom} a décollé à {heure} · arrivée prévue à {heure} » | oui | **non** |
| Atterrissage | « {prénom} est arrivé à {ville} » / « Atterri à {heure} · la remise à {destinataire} approche » | oui | **oui** : « {prénom} a atterri — préviens le destinataire de ton colis » |

**Anomalie à guetter** — Un email pour l'aéroport ou le décollage : anomalie **mineure** de sur-notification, à consigner.
**Verdict** ⬜   **Note** :

---

### 5.17 — `WEB-COD` · Le code de livraison

**Ce que couvre ce chapitre.** L'apparition du code, son partage, sa régénération, et ce qui doit rester invisible.
**Deal de travail** — `bzv-picked` (Aminata ↔ Thomas, code `742891`).

---

#### WEB-COD-1 — Le code n'existe pas avant la prise en charge · gravité **bloquant**

**Préconditions** — Un deal **accepté mais pas encore pris en charge**.
**Étapes**
1. Connecté avec l'Expéditeur, ouvre le suivi.

**Résultat attendu** — La carte « Ton code de livraison » porte le badge **« En attente »** et le texte « Tu recevras ton code à 6 chiffres dès que {prénom} confirmera la prise en charge de ton colis. Tu le transmettras à {destinataire} pour valider la livraison. » **Aucun chiffre n'est affiché.**
**Verdict** ⬜   **Note** :

---

#### WEB-COD-2 — Le code apparaît chez l'Expéditeur seul · gravité **bloquant**

**Préconditions** — `bzv-picked`.
**Étapes**
1. Connecté avec Aminata, ouvre le suivi de cet envoi.
2. Connecté avec Thomas, ouvre le même deal côté Voyageur, y compris l'écran de livraison.

**Résultat attendu**
- Étape 1 : le code **742 891** s'affiche sous le libellé « CODE À TRANSMETTRE À {destinataire} », avec les boutons « Copier le code » et « Régénérer le code », et l'avertissement « Garde ce code confidentiel. Tu peux le régénérer si tu penses qu'il a fuité. »
- Étape 2 : **le code n'apparaît nulle part** côté Voyageur — ni sur le deal, ni sur l'écran de livraison, ni dans une notification, ni dans le fil de messagerie.

**Vérification complémentaire** — Recherche `742891` dans le code source de la page côté Voyageur (Ctrl+U ou recherche dans les outils de développement) : **aucune occurrence**. Une occurrence est une anomalie **bloquante**.
**Verdict** ⬜   **Note** :

---

#### WEB-COD-3 — Copier le code · gravité **mineur**

**Étapes**
1. Clique « Copier le code ».

**Résultat attendu** — Toast « Code copié ! » ; le presse-papiers contient les six chiffres.
**Verdict** ⬜   **Note** :

---

#### WEB-COD-4 — Partager le code au destinataire · gravité **majeur**

**Étapes**
1. Dans la carte « Partage le code à {prénom} », clique « Copier le message ».
2. Colle le contenu du presse-papiers dans un éditeur de texte.
3. Clique « WhatsApp ».
4. Clique « SMS », puis « Email ».

**Résultat attendu**
- Le sous-titre est « Le message est pré-rempli, tu n'as qu'à envoyer ».
- Étape 2 : le message est du type « Bonjour {destinataire} ! Ton colis arrive avec {Voyageur} ({route}). Pour le récupérer, donne-lui ce code : {code}. Bisous ! » Toast « Message copié ! »
- Étape 3 : WhatsApp s'ouvre **sur le numéro saisi à la réservation**, message pré-rempli.
- Étape 4 : les applications SMS et email s'ouvrent, l'objet de l'email étant « Code de retrait de ton colis Yamba ».

**Verdict** ⬜   **Note** :

---

#### WEB-COD-5 — Régénérer le code · gravité **majeur**

**Étapes**
1. Clique « Régénérer le code ».
2. Lis la confirmation, puis clique « Oui, régénérer ».
3. Note le nouveau code.
4. Recharge la page.

**Résultat attendu**
- Confirmation « Régénérer le code ? » / « L'ancien code ne fonctionnera plus. Pense à renvoyer le nouveau à {destinataire}. » avec « Oui, régénérer » et « Annuler ».
- Toast « Nouveau code généré ! N'oublie pas de le renvoyer à {destinataire}. »
- Le compteur passe à « 4 régénérations restantes ».
- Après rechargement, le code affiché est **le nouveau** (l'écran relit toujours le serveur).

**Vérification complémentaire** — Un email de sécurité « un nouveau code a été généré » arrive dans Mailpit, **sans le code**.
**Verdict** ⬜   **Note** :

---

#### WEB-COD-6 — Le plafond de cinq régénérations · gravité **majeur**

**Étapes**
1. Régénère jusqu'à épuisement.

**Résultat attendu** — Après la cinquième, « Aucune régénération restante » et le bouton devient inactif. Un essai forcé donne « Tu as atteint la limite de régénérations. Contacte le support si besoin. »
**Verdict** ⬜   **Note** :

---

#### WEB-COD-7 — Le Voyageur ne régénère pas · gravité **bloquant**

**Étapes**
1. Connecté avec le Voyageur, cherche un bouton de régénération sur tous ses écrans du deal.

**Résultat attendu** — **Aucun**. La régénération appartient à l'Expéditeur seul.
**Verdict** ⬜   **Note** :

---

#### WEB-COD-8 — Après la remise, le code disparaît · gravité **majeur**

**Préconditions** — Un deal **livré** (par exemple `bzv-delivered`).
**Étapes**
1. Connecté avec l'Expéditeur, ouvre le suivi.

**Résultat attendu** — Le code n'est plus affiché ; à la place, la mention « Code de livraison saisi par {prénom} et validé » et le badge « Code validé ». Aucun bouton de régénération.
**Verdict** ⬜   **Note** :

---

### 5.18 — `WEB-REM` · La remise du colis

**Ce que couvre ce chapitre.** L'écran de saisie du code côté Voyageur, le barème d'essais et le verrou.
**Deal de travail** — `sgn-picked` (Mai ↔ Linh) ou `los-picked` (Chinwe ↔ Adebayo). Code : `742891`.

---

#### WEB-REM-1 — L'écran « Livraison à {prénom} » · gravité **bloquant**

**Préconditions** — Connecté avec le Voyageur du deal pris en charge.
**Étapes**
1. Depuis le suivi de transit, clique « Valider la livraison ».

**Résultat attendu**
- Titre « Livraison à {destinataire} » / « {ville} · à valider avec le code ».
- L'encart « **{destinataire} est devant toi ?** Demande-lui le code de livraison qu'{Expéditrice} lui a communiqué. Sans ce code, tu ne peux pas remettre le colis. Si elle ne le retrouve pas, propose-lui de contacter {Expéditrice}. »
- Six cases de saisie sous le libellé « CODE DE LIVRAISON REÇU PAR {destinataire} », en groupes de 3 + 3.
- Le bouton « Valider la livraison ».
- L'aide repliable « {destinataire} ne se souvient plus du code ? » avec ses trois puces, dont « **3 tentatives ratées** bloqueront la saisie pendant 15 minutes pour des raisons de sécurité. »

**Verdict** ⬜   **Note** :

---

#### WEB-REM-2 — Un code faux et le compteur d'essais · gravité **bloquant**

**Étapes**
1. Saisis `000000` et valide.
2. Saisis `111111` et valide.

**Résultat attendu**
- « Ce code n'est pas le bon. Vérifie avec {destinataire} et réessaye. »
- « Tentative 1 sur 3 », puis « Tentative 2 sur 3 ».
- Un compteur « {n} tentatives restantes », qui devient « Dernière tentative » au troisième essai.

**Vérification complémentaire** — Côté Expéditeur, **aucune notification** n'est déclenchée par un essai manqué : un essai raté n'est pas un événement métier.
**Verdict** ⬜   **Note** :

---

#### WEB-REM-3 — Le verrou de 15 minutes · gravité **bloquant**

**Étapes**
1. Saisis un troisième code faux.
2. Recharge la page.
3. Saisis le **bon** code `742891` pendant le verrou.

**Résultat attendu**
- Étape 1 : « Trop de tentatives. Saisie bloquée pendant 15 min pour des raisons de sécurité. » avec « Réessaye dans {décompte} ».
- Étape 2 : **le verrou survit au rechargement** — le compteur vit sur le serveur. Un verrou qui disparaît après un F5 est une anomalie **bloquante**.
- Étape 3 : le bon code est **refusé** pendant le verrou.

**Verdict** ⬜   **Note** :

---

#### WEB-REM-4 — Une régénération lève le verrou · gravité **majeur** · **⚠ deux navigateurs**

**Préconditions** — Suite du scénario précédent, verrou actif. Navigateur A : l'Expéditeur du deal.
**Étapes**
1. Dans A, régénère le code et note le nouveau.
2. Dans B, recharge l'écran de livraison et saisis le nouveau code.

**Résultat attendu** — Le verrou est levé, le compteur d'essais repart à zéro, le nouveau code est accepté.
**Verdict** ⬜   **Note** :

---

#### WEB-REM-5 — La photo de remise est facultative · gravité **mineur** · **⏭ sans ImageKit**

**Étapes**
1. Sur l'écran de livraison, observe la section photo.
2. Ajoute une photo.

**Résultat attendu**
- La section porte « Une photo de la remise ? » avec le badge « Optionnel » et le texte « Optionnel, mais c'est ton assurance : le colis fermé, dans les mains du destinataire. En cas de litige « endommagé », cette photo parle pour toi. »
- Au plus **2** photos. Elles doivent être envoyées **avant** la saisie du code.
- L'aide précise « Elles sont visibles par l'Expéditeur dans son suivi et par Yamba en cas de litige. »

**Verdict** ⬜   **Note** :

---

#### WEB-REM-6 — Le bon code vaut livraison · gravité **bloquant**

**Étapes**
1. Saisis `742891` (ou le code régénéré) et valide.

**Résultat attendu**
- Écran de succès : « Livraison validée ! » / « Bravo, tu as remis le colis à {destinataire}. {Expéditrice} vient d'être prévenue. »
- Le bloc « Ton versement arrive » annonce « {montant} partiront vers ton compte après la période de vérification de l'Expéditeur, le {date} au plus tard, puis arriveront sur ton compte bancaire sous 2 à 7 jours. »
- Les boutons « Voir le récap du Deal » et « Retour à l'accueil » ; le bouton « Noter {prénom} » n'apparaît **que lorsque la notation est réellement possible** (après la complétion, chapitre 5.22).

**Vérification complémentaire**
- Côté Expéditeur : notification in-app « Colis remis · vérifie avant le {date} » et email « 3 jours pour confirmer ou signaler ».
- Côté Voyageur : notification in-app « Livraison validée · versement après vérification », **sans email** à ce stade.
**Verdict** ⬜   **Note** :

---

#### WEB-REM-7 — Aucune annulation après la prise en charge · gravité **bloquant**

**Étapes**
1. Sur un deal **pris en charge**, cherche un bouton « Annuler » côté Expéditeur (« Mes envois », suivi) et côté Voyageur.

**Résultat attendu** — **Aucun bouton d'annulation nulle part**. La seule voie est le signalement (chapitre 5.21).
**Verdict** ⬜   **Note** :

---

### 5.19 — `WEB-CNF` · Confirmation, complétion et versement

**Ce que couvre ce chapitre.** La période de vérification côté Expéditeur, la confirmation anticipée, la complétion automatique, le versement côté Voyageur et les écrans « Finances ».
**Deal de travail** — `bzv-delivered` (João ↔ Thomas) ou `yul-delivered` (Aminata ↔ Marc).

---

#### WEB-CNF-1 — Le suivi d'un colis livré · gravité **bloquant**

**Préconditions** — Connecté avec l'Expéditeur d'un deal **livré**.
**Étapes**
1. Ouvre le suivi de l'envoi.

**Résultat attendu**
- Bandeau « Ton colis a été livré à {destinataire} » / « Confirmé {quand} par {Voyageur} avec le code à 6 chiffres ».
- Titre « Période de vérification » / « Tu as 3 jours pour t'assurer que tout va bien avant que {Voyageur} reçoive son paiement. »
- Un compte à rebours « VERSEMENT AUTOMATIQUE DANS », **sobre, jamais rouge**.
- Une carte « Tout s'est bien passé ? » avec le bouton **secondaire** « Confirmer la livraison » et le conseil « Conseil : demande à {destinataire} d'ouvrir le colis avant de confirmer. »
- Une carte « RÉCAP DE LA LIVRAISON » avec « COLIS LIVRÉ », « REMIS À {nom} », « Code de livraison saisi par {Voyageur} et validé » et les « PHOTOS DE TRAÇABILITÉ ».
- Un encart « Comment ça marche » avec les trois cas (confirmer / ne rien faire / signaler).
- Une carte sobre « Quelque chose ne va pas avec ce colis ? » avec « Signaler un problème ».

**Point de conception à vérifier** — Le geste par défaut est **de ne rien faire**. Le bouton « Confirmer la livraison » ne doit pas être le bouton principal de la page. Un bouton mis en avant plus que la lecture du récapitulatif est une anomalie **mineure** de conception.
**Verdict** ⬜   **Note** :

---

#### WEB-CNF-2 — La confirmation anticipée est définitive · gravité **bloquant**

**Étapes**
1. Clique « Confirmer la livraison ».
2. Lis la confirmation en ligne.
3. Clique « Oui, tout est OK ».
4. Cherche le bouton « Signaler un problème ».

**Résultat attendu**
- Avertissement avant : « Cette action est définitive. Tu ne pourras plus signaler de problème après confirmation. »
- Confirmation « Confirmer définitivement ? » / « {Voyageur} sera payé immédiatement et tu ne pourras plus signaler de problème. » avec « Oui, tout est OK » et « Annuler ».
- Après : toast « Merci ! {Voyageur} va recevoir son paiement. » ; l'écran passe à « Envoi terminé » / « Transaction close ».
- Étape 4 : la carte de signalement **a disparu**.

**Vérification complémentaire**
- Côté Expéditeur : email « Transaction terminée ».
- Côté Voyageur : notification « {montant} partis vers ton compte » et email « {montant} en route vers ton compte ».
**Verdict** ⬜   **Note** :

---

#### WEB-CNF-3 — La complétion automatique à J+4 · gravité **majeur** · **dépend d'un cron**

**Préconditions** — Un deal livré dont la date d'échéance est atteinte. Raccourci de recette : reculer `deliveredAt` de plus de 4 jours en base, puis attendre le passage du cron (toutes les 5 minutes).
**Étapes**
1. Attends le passage du cron.
2. Recharge le suivi côté Expéditeur.

**Résultat attendu**
- Le deal passe à « Envoi terminé », avec « Période de vérification terminée le {date}, sans signalement de ta part. »
- Le versement est lancé côté Voyageur.
- Emails : « Transaction terminée » à l'Expéditeur, « {montant} en route vers ton compte » au Voyageur.

**Verdict** ⬜   **Note** :

---

#### WEB-CNF-4 — Le rappel de la veille · gravité **mineur** · **dépend d'un cron**

**Préconditions** — Un deal livré dont l'échéance est dans moins de 24 heures.
**Résultat attendu** — Une notification in-app « Dernier jour pour vérifier ton colis » et un email du même intitulé, **une seule fois** par deal.
**Verdict** ⬜   **Note** :

---

#### WEB-CNF-5 — Après J+4, ni confirmation ni signalement · gravité **majeur**

**Préconditions** — Un deal livré dont l'échéance est **dépassée** mais dont le cron n'est pas encore passé.
**Étapes**
1. Ouvre le suivi.

**Résultat attendu** — **Ni « Confirmer la livraison » ni « Signaler un problème »** ne sont proposés ; le compte à rebours est à zéro. Un appel forcé au signalement est refusé.
**Verdict** ⬜   **Note** :

---

#### WEB-CNF-6 — L'Expéditeur ne voit jamais un échec de versement · gravité **bloquant**

**Préconditions** — Le deal `bzv-completed-blocked` (Aminata ↔ Thomas), dont le versement est en échec.
**Étapes**
1. Connecté avec Aminata, ouvre cet envoi et l'écran « Finances » › « Paiements ».

**Résultat attendu** — L'Expéditrice voit « Envoi terminé » et « Le paiement de {prénom} est libéré ». **Aucune mention d'un échec, d'une attente ou d'un problème de compte Stripe.**
**Anomalie bloquante** — Toute fuite de l'état du versement du Voyageur vers l'Expéditeur.
**Verdict** ⬜   **Note** :

---

#### WEB-CNF-7 — Le versement en attente vu du Voyageur · gravité **majeur**

**Préconditions** — Connecté avec Thomas, deal `bzv-completed-blocked`.
**Étapes**
1. Ouvre le deal terminé.
2. Ouvre « Mes trajets ».
3. Ouvre « Finances » › « Portefeuille ».

**Résultat attendu**
- Sur le deal : carte ambre « {montant} en attente : finalise ton compte Stripe » / « Ton compte de paiement n'est pas encore prêt à recevoir des virements. Termine ton onboarding Stripe : le versement partira automatiquement dans les minutes qui suivent. » avec le bouton « Finaliser mon compte Stripe ».
- Sur « Mes trajets » : un bandeau en tête totalise les versements bloqués (« {montant} en attente : finalise ton compte Stripe » / « Finaliser mon compte »).
- Sur « Finances » : la carte « En attente » et la ligne « En attente : finalise ton compte Stripe ».
- **Le message d'erreur de Stripe n'apparaît jamais** : la cause est grossière, jamais technique.

**Verdict** ⬜   **Note** :

---

#### WEB-CNF-8 — Le versement renversé · gravité **majeur**

**Préconditions** — Le deal `bzv-reversed` (Pauline ↔ Thomas).
**Étapes**
1. Connecté avec Thomas, ouvre ce deal et « Finances » › « Portefeuille ».

**Résultat attendu**
- Sur le deal : « {montant} : versement sous examen » / « Le transfert a été renversé par notre prestataire de paiement. Rien n'est perdu : nous te contactons pour le régulariser. »
- Sur « Finances » : la ligne « Sous examen · transfert renversé, on te contacte ».
- **Aucun renvoi automatique** n'est proposé au Voyageur.

**Verdict** ⬜   **Note** :

---

#### WEB-CNF-9 — Le portefeuille du Voyageur · gravité **majeur**

**Préconditions** — Connecté avec Thomas.
**Étapes**
1. Ouvre « Finances » › « Portefeuille ».

**Résultat attendu**
- Le titre « Finances » et le sous-titre « Tes paiements, gains et versements — tout vient de tes deals, rien n'est estimé. »
- Trois cartes : « À venir » / « Livraisons en vérification », « Envoyés » / « + {montant} ce mois », « En attente » / « Compte Stripe, signalement ou envoi en cours ».
- Une liste de lignes avec leurs états exacts : « À venir le {date} », « En cours d'envoi », « En attente : finalise ton compte Stripe », « Gelé · signalement en cours », « Parti le {date} · 2 à 7 jours », « Retenue conservée · on te contacte », « Sous examen · transfert renversé, on te contacte ».
- Les libellés de ligne sont « Transport pour {prénom} » ou « Compensation · annulation tardive de {prénom} ».
- Le bloc « Voir mes virements sur Stripe » / « Dates d'arrivée, RIB et historique : sur ton tableau de bord Stripe. »

**Anomalie à guetter** — Des montants de démonstration (« 89,30 € », « Aminata T. », « Josué M. », « IBAN ···6789 ») : ce sont les données de la maquette. Leur présence sur l'écran réel est une anomalie **majeure**.
**Verdict** ⬜   **Note** :

---

#### WEB-CNF-10 — Les paiements de l'Expéditeur · gravité **majeur**

**Préconditions** — Connecté avec Aminata.
**Étapes**
1. Ouvre « Finances » › « Paiements ».

**Résultat attendu**
- Trois cartes : « Bloqué chez Yamba » / « Libéré à la fin de chaque transaction », « Dépensé », « Remboursé ».
- Les lignes portent leurs états exacts : « Autorisé, pas débité · en attente du Voyageur », « Bloqué chez Yamba », « Bloqué jusqu'au {date} », « Libéré le {date} · transaction close », « Jamais débité · l'empreinte a disparu », « Remboursé {montant} le {date} », « Remboursé {montant} le {date} · retenue {retenue} reversée au Voyageur ».
- Les totaux viennent du serveur : **aucun écran ne recalcule un montant**.

**Verdict** ⬜   **Note** :

---

#### WEB-CNF-11 — Aucune fausse carte bancaire · gravité **majeur**

**Étapes**
1. Sur le suivi d'un envoi, lis le bloc « TON PAIEMENT ».

**Résultat attendu** — Le bloc n'affiche **que les données réellement connues**. Avec le fournisseur de paiement fictif, il ne doit **jamais** apparaître une ligne « Visa •••• 4242 » ni un intitulé de relevé inventé. Une donnée vraisemblable mais fausse est une anomalie **majeure**.
**Verdict** ⬜   **Note** :

---

### 5.20 — `WEB-ANN` · Les annulations

**Ce que couvre ce chapitre.** L'annulation par l'Expéditeur selon le barème, l'annulation par le Voyageur, et les cas où l'annulation est impossible.

**Règle de calcul à vérifier** — Pour un envoi de **32,20 €** (net Voyageur 28,75 €) :

| Moment | Remboursement attendu | Retenue |
|---|---|---|
| Demande en attente | **32,20 €** (rien n'a été débité) | — |
| Accepté, à 48 h ou plus du départ | **32,20 €** | — |
| Accepté, à moins de 48 h du départ | **16,10 €** | 16,10 €, dont **14,38 €** reversés au Voyageur |
| Accepté, après le départ, sans prise en charge | **16,10 €** | 16,10 € conservés à arbitrer |
| Après la prise en charge | **aucune annulation** | — |

---

#### WEB-ANN-1 — Annuler une demande en attente · gravité **majeur**

**Préconditions** — Connecté avec Aminata, deal `bzv-pending`.
**Étapes**
1. Ouvre « Mes envois ».
2. Sur la ligne de la demande en attente, clique le lien discret « Annuler ».
3. Lis la fenêtre.
4. Clique « Confirmer l'annulation ».

**Résultat attendu**
- La fenêtre porte « Annuler cet envoi ? » / « Ta demande {route} auprès de {Voyageur} sera annulée définitivement. »
- Elle annonce « Tu seras remboursée de » suivi du **montant intégral**, servi par le serveur.
- Elle explique « Remboursement intégral : le paiement n'a pas encore été débité ou tu annules plus de 48 h avant le départ. »
- Les deux boutons sont « Garder l'envoi » et « Confirmer l'annulation ».
- Après : toast « Envoi annulé. » ; le statut devient « Annulée » ; les kilos sont rendus au trajet.

**Vérification complémentaire**
- Côté Expéditeur : email « annulée ».
- Côté Voyageur : **notification in-app seulement, aucun email** — on ne dérange pas un Voyageur qui n'avait encore rien accepté.
**Verdict** ⬜   **Note** :

---

#### WEB-ANN-2 — Annuler un deal accepté à plus de 48 h du départ · gravité **bloquant**

**Préconditions** — Un deal **accepté** sur un trajet dont le départ est dans plus de 48 heures (`bzv-perkg` après réservation et acceptation, ou `bzv-accepted`).
**Étapes**
1. Depuis « Mes envois », clique « Annuler » sur ce deal.
2. Lis le montant annoncé.
3. Confirme.

**Résultat attendu**
- Le montant annoncé est **le total intégral**.
- Toast « Envoi annulé. Remboursement de {montant} en cours. »
- Les kilos sont rendus.

**Vérification complémentaire**
- Deux emails à l'Expéditeur : « annulée » puis « Remboursement émis » avec le **montant exact** et les délais bancaires (5 à 10 jours ouvrés).
- Un email au Voyageur : « Deal annulé, tes kilos sont restitués ».
- Dans « Finances » › « Paiements » : « Remboursé {montant} le {date} ».
**Verdict** ⬜   **Note** :

---

#### WEB-ANN-3 — Annuler à moins de 48 h du départ · gravité **bloquant**

**Préconditions** — Un deal accepté sur un trajet dont le départ est dans **moins de 48 heures**. Raccourci de recette : avancer la date de départ du trajet en base, ou réserver `sgn` / `los` avant leur départ.
**Étapes**
1. Clique « Annuler » et lis attentivement la fenêtre.
2. Confirme.

**Résultat attendu**
- La fenêtre annonce **la moitié** du total et l'explique : « Une retenue de 50 % ({montant}) s'applique car le départ est dans moins de 48 h : elle est reversée au Voyageur, qui avait réservé sa capacité pour toi. »
- Après confirmation, la ligne de « Finances » › « Paiements » de l'Expéditeur devient « Remboursé {montant} le {date} · retenue {retenue} reversée au Voyageur ».
- Côté Voyageur : notification « {montant} de compensation partis vers ton compte » et une ligne « Compensation · annulation tardive de {prénom} » dans le portefeuille.

**Vérification arithmétique** — Pour un total de 32,20 € et un net de 28,75 € : remboursé **16,10 €**, compensation Voyageur **14,38 €**. Un écart de plus d'un centime est une anomalie **bloquante**.
**Verdict** ⬜   **Note** :

---

#### WEB-ANN-4 — Le montant annoncé vient du serveur · gravité **majeur**

**Étapes**
1. Ouvre la fenêtre d'annulation et, dans l'onglet réseau, observe l'appel qui la précède.

**Résultat attendu** — Le montant affiché **avant** confirmation est servi par le serveur, jamais calculé par l'écran. Un montant qui apparaîtrait instantanément sans appel réseau est suspect : le consigner comme anomalie **majeure** à vérifier avec l'équipe.
**Verdict** ⬜   **Note** :

---

#### WEB-ANN-5 — Annuler après le départ, sans prise en charge · gravité **majeur**

**Préconditions** — Le deal `bzv-held` illustre déjà l'état d'arrivée. Pour rejouer le geste : un deal accepté sur un trajet **déjà parti**, sans prise en charge.
**Étapes**
1. Annule depuis « Mes envois ».

**Résultat attendu**
- Remboursement de **50 %**.
- La retenue est **conservée à arbitrer** : côté Voyageur, la ligne du portefeuille dit « Retenue conservée · on te contacte », et l'écran du deal affiche « Annulation après le départ : la retenue de l'Expéditeur est conservée par Yamba le temps de comprendre ce qui s'est passé. Nous te contacterons. »
- **Aucun versement automatique** au Voyageur.

**Vérification complémentaire (back-office)** — Le dossier apparaît dans la file d'arbitrage (voir RECETTE-02-ADMIN).
**Verdict** ⬜   **Note** :

---

#### WEB-ANN-6 — Le Voyageur annule un deal accepté · gravité **majeur**

**Préconditions** — Connecté avec le Voyageur d'un deal accepté.
**Étapes**
1. Depuis l'écran du deal, annule le deal.

**Résultat attendu**
- L'Expéditeur est remboursé **intégralement**, quel que soit le moment.
- Les kilos sont rendus.
- Le compteur d'annulations du Voyageur augmente : sur sa page publique, la ligne de faits doit refléter une annulation, et le niveau « Top Voyageur » devient inatteignable (0 annulation exigée).
- Côté Expéditeur : emails « annulée » puis « Remboursement émis » du montant intégral.

**Verdict** ⬜   **Note** :

---

#### WEB-ANN-7 — Aucun bouton d'annulation après la prise en charge · gravité **bloquant**

**Étapes**
1. Sur un deal `PICKED_UP` puis sur un deal `DELIVERED`, cherche une action d'annulation des deux côtés.

**Résultat attendu** — Aucune. La seule voie est le signalement.
**Verdict** ⬜   **Note** :

---

#### WEB-ANN-8 — L'annulation ne se duplique pas sur le suivi · gravité **mineur**

**Étapes**
1. Sur le suivi d'un envoi annulable, cherche un bouton « Annuler ».

**Résultat attendu** — Le suivi **ramène vers « Mes envois »** ; il ne propose pas une seconde action d'annulation. Une double action est une anomalie **mineure** de conception.
**Verdict** ⬜   **Note** :

---

#### WEB-ANN-9 — L'annulation échouée recharge la liste · gravité **mineur** · **⚠ deux onglets**

**Étapes**
1. Ouvre « Mes envois » dans deux onglets.
2. Annule dans l'onglet 1.
3. Annule le même envoi dans l'onglet 2.

**Résultat attendu** — L'onglet 2 affiche « L'annulation n'a pas abouti — la liste vient d'être actualisée. » et se relit sur l'état réel. Aucun double remboursement.
**Verdict** ⬜   **Note** :

---

### 5.21 — `WEB-LIT` · Litige et médiation, vue membre

**Ce que couvre ce chapitre.** L'ouverture d'un signalement par l'Expéditeur, la version du Voyageur, et l'affichage de la décision. La décision elle-même est prise dans le back-office (**RECETTE-02-ADMIN**).

---

#### WEB-LIT-1 — Le lien de signalement pendant le transit est fermé puis ouvert · gravité **majeur**

**Préconditions** — Deux deals en transit : `sgn-picked` (départ d'hier, moins de 48 h) et `los-picked` (départ il y a plus de 48 h).
**Étapes**
1. Connecté avec Mai, ouvre le suivi de `sgn-picked`.
2. Connecté avec Chinwe, ouvre le suivi de `los-picked`.

**Résultat attendu**
- Sur `sgn-picked` : le lien « Signaler un colis non livré » est visible mais **fermé**, avec « Colis non livré ? Tu pourras le signaler à partir du {date} (48 h après le départ du trajet). »
- Sur `los-picked` : le lien est **actif**.

**Verdict** ⬜   **Note** :

---

#### WEB-LIT-2 — Le motif verrouillé pendant le transit · gravité **majeur**

**Préconditions** — Chinwe, `los-picked`.
**Étapes**
1. Clique « Signaler un colis non livré ».

**Résultat attendu**
- L'écran « Signaler un problème » s'ouvre.
- Le motif est **verrouillé** sur « Le colis n'a jamais été livré à {destinataire} », avec l'explication « Ton colis est encore en transit : tu peux uniquement signaler qu'il n'a pas été livré. Les autres motifs (contenu, dommage) se constatent après la remise. {Voyageur} sera informé. »
- La barre latérale précise « Colis en transit : le signalement « non livré » est ouvert depuis 48 h après le départ du trajet. {Voyageur} n'a pas encore validé la remise. »

**Verdict** ⬜   **Note** :

---

#### WEB-LIT-3 — L'écran de signalement après une livraison · gravité **bloquant**

**Préconditions** — Connecté avec João, deal `bzv-delivered` (livré, dans la période de vérification).
**Étapes**
1. Depuis le suivi, clique « Signaler un problème ».

**Résultat attendu**
- Bandeau « On est là pour t'aider » / « Décris ce qui s'est passé, on s'occupe du reste. Pendant l'examen du dossier, le paiement de {Voyageur} reste bloqué. »
- Quatre blocs numérotés, avec leurs badges : « Requis », « Recommandé », « Optionnel ».
- Bloc 1 « Quel est le problème ? » / « Choisis la situation qui correspond le mieux », avec les six motifs : « Le colis n'a jamais été livré à {destinataire} », « Contenu manquant ou différent de la déclaration », « Colis ou contenu endommagé », « Délai significativement dépassé », « {destinataire} a un autre problème avec le voyageur », « Autre problème ».
- Bloc 2 « Raconte-nous ce qui s'est passé » avec le compteur « {n} / minimum 50 caractères ».
- Bloc 3 « Ajoute des photos » (jusqu'à 5, 10 Mo chacune).
- Bloc 4 « Ta solution souhaitée » avec les quatre choix, dont « Remboursement intégral ({montant}) ».
- L'encart « Ce qui va se passer après ton signalement » et l'engagement sur l'honneur, avec « Pourquoi cet engagement ? ».
- La barre latérale « FENÊTRE DE SIGNALEMENT » / « Tu peux signaler jusqu'au {date}. »

**Verdict** ⬜   **Note** :

---

#### WEB-LIT-4 — Les refus de validation · gravité **majeur**

**Étapes**
1. Sans motif, sans description, sans engagement, clique « Envoyer le signalement ».
2. Choisis un motif, écris `Ça ne va pas` (moins de 50 caractères) et tente d'envoyer.
3. Écris une description de plus de 50 caractères, laisse l'engagement décoché et tente d'envoyer.
4. Ajoute une photo et tente d'envoyer pendant que l'envoi de la photo est en cours.

**Résultat attendu**
- Étapes 1 à 3 : refus, chaque manque étant nommé sur son bloc. Le compteur passe de « {n} / minimum 50 caractères » à « {n} caractères ✓ » une fois le seuil atteint.
- Étape 4 : l'envoi est impossible tant qu'une photo est en cours ou en échec (« Envoi de la photo… », « Échec d'envoi — retire-la et réessaye »).
- Un refus serveur affiche « Le serveur a refusé le signalement : vérifie la description (50 caractères minimum) et l'engagement. »

**Verdict** ⬜   **Note** :

---

#### WEB-LIT-5 — Envoyer le signalement · gravité **bloquant**

**Étapes**
1. Motif « Contenu manquant ou différent de la déclaration ».
2. Description d'au moins 50 caractères.
3. Deux photos.
4. Solution souhaitée « Remboursement intégral ».
5. Coche l'engagement sur l'honneur.
6. Clique « Envoyer le signalement », puis « Oui, envoyer ».

**Résultat attendu**
- Confirmation « Envoyer le signalement ? » / « Le paiement de {Voyageur} sera gelé et notre équipe médiation prendra le relais. Cette action est irréversible. »
- Écran de succès : « Signalement envoyé » / « On prend le relais. Tu recevras un accusé de réception sous 48h ouvrées. » avec un **« Numéro de dossier »** au format `YAM-` suivi de quatre chiffres.
- La mention « Le paiement de {Voyageur} est gelé. Aucun versement ne sera fait avant la résolution. »
- Le bouton « Retour au suivi de mon envoi ».

**Vérification complémentaire**
- Le suivi affiche désormais « Signalement en cours · dossier YAM-XXXX ».
- Le versement passe en « Gelé » côté Voyageur.
- Le fil de messagerie passe en lecture seule.
- Emails : à l'Expéditeur, l'accusé avec le ticket ; au Voyageur, un email calme annonçant **la catégorie seulement**, jamais la description ni les photos.
**Verdict** ⬜   **Note** :

---

#### WEB-LIT-6 — Le signalement n'est ni modifiable ni retirable · gravité **bloquant**

**Étapes**
1. Rouvre le suivi de l'envoi signalé et cherche une action de modification ou de retrait.
2. Tente d'ouvrir un second signalement sur le même deal.

**Résultat attendu** — Aucune modification, aucun retrait. Un second signalement est refusé (« Ce deal ne peut plus être signalé. »).
**Verdict** ⬜   **Note** :

---

#### WEB-LIT-7 — L'écran du dossier côté Expéditeur · gravité **majeur**

**Préconditions** — Connecté avec Chinwe, dossier `YAM-2041` sur `bzv-disputed`.
**Étapes**
1. Ouvre le suivi de cet envoi.

**Résultat attendu**
- Bandeau « Signalement en cours · dossier YAM-2041 » / « Ouvert le {date}. Le paiement du Voyageur est gelé le temps de l'examen. »
- Bloc « TON DOSSIER » : numéro, motif, description, solution souhaitée, date, photos jointes.
- Bloc « Une question sur ton dossier ? » / « Écris-nous en rappelant le numéro YAM-2041 : on te répond sous 48 h ouvrées. »
- Le paiement affiché « Gelé » avec « Aucun versement ne sera fait à {Voyageur} avant la fin de l'examen. Si un remboursement s'applique, il te sera confirmé par email. »
- Selon l'état : « Nous avons demandé sa version à {Voyageur} (72 h). » puis « {Voyageur} a donné sa version. La décision arrive sous 5 jours ouvrés. »

**Anomalie bloquante à guetter** — L'Expéditeur ne doit **jamais** voir le contenu de la version du Voyageur.
**Verdict** ⬜   **Note** :

---

#### WEB-LIT-8 — L'écran du dossier côté Voyageur · gravité **majeur**

**Préconditions** — Connecté avec Thomas, `bzv-disputed`.
**Étapes**
1. Ouvre le deal.

**Résultat attendu**
- « Signalement en cours · dossier YAM-2041 » / « Ouvert le {date}. Ton versement est mis en attente le temps de l'examen. »
- « Un signalement a été ouvert » / « {Expéditrice} a signalé un problème sur ce colis. Nous allons recueillir ta version avant de décider. »
- La phrase de désamorçage : « Ce n'est pas une décision : le versement est simplement mis en attente pendant l'examen. Nous entendons les deux parties. »
- Le motif est affiché sous sa forme de **catégorie** (« contenu manquant »), jamais la description de l'Expéditrice.
- Les trois étapes annoncées (accusé sous 48 h ouvrées, recueil de la version, décision sous 5 jours ouvrés).
- La carte « Donne ta version dès maintenant » avec le bouton « Donner ma version ».

**Anomalie bloquante à guetter** — La description ou les photos de l'Expéditrice visibles côté Voyageur.
**Verdict** ⬜   **Note** :

---

#### WEB-LIT-9 — Donner sa version, une seule fois · gravité **majeur**

**Étapes**
1. Clique « Donner ma version ».
2. Écris moins de 50 caractères et tente d'envoyer.
3. Écris un texte d'au moins 50 caractères, ajoute une photo, envoie.
4. Rouvre l'écran.

**Résultat attendu**
- Le panneau porte « Donne ta version » / « Explique ce qui s'est passé, avec tes photos (prise en charge, remise). Une seule fois, jusqu'au {échéance}. Nous décidons après avoir lu les deux versions. »
- L'avertissement « Ta version ne pourra plus être modifiée une fois envoyée. »
- Étape 2 : refus, « Au moins 50 caractères. »
- Étape 3 : toast « Ta version est enregistrée. »
- Étape 4 : « Version envoyée » / « Envoyée le {date}. Nous décidons sous 5 jours ouvrés : tu seras prévenu ici et par email. » ; le bouton **ne revient pas**.

**Vérification complémentaire** — Côté Expéditeur, l'écran indique désormais que le Voyageur a donné sa version, **sans son contenu**.
**Verdict** ⬜   **Note** :

---

#### WEB-LIT-10 — La décision rendue, vue des deux parties · gravité **bloquant** · **dépend du back-office**

**Préconditions** — Un administrateur tranche le dossier `YAM-2041` (voir RECETTE-02-ADMIN), avec un motif d'au moins 50 caractères. Jouer les trois issues sur trois dossiers différents.
**Étapes**
1. Côté Expéditeur, recharge le suivi.
2. Côté Voyageur, recharge le deal.

**Résultat attendu**

| Issue | Côté Expéditeur | Côté Voyageur |
|---|---|---|
| **Rejet** | « Ton signalement n'a pas été retenu : le Voyageur est payé en entier. » — envoi « terminé », **sans carte de notation** | « Le signalement n'a pas été retenu : tu es payé en entier. » + « {montant} partent vers ton compte, sur ton compte bancaire sous 2 à 7 jours. » |
| **Remboursement partiel** | « Ton signalement est retenu en partie : remboursement partiel. » + « {montant} te sont remboursés, sur ta carte sous 5 à 10 jours. » | « Le signalement est retenu en partie : une part du prix est remboursée à l'Expéditeur. » |
| **Remboursement total** | « Ton signalement est retenu : remboursement total. » + le montant | « Le signalement est retenu : l'Expéditeur est remboursé en totalité. » + « Aucun versement ne te revient sur ce deal. » |

- Dans tous les cas : le titre « Décision rendue », le bloc « Motif de la décision » avec le texte de l'équipe **lu par les deux parties**, et la mention « Cette décision est définitive dans l'application. » suivie de « Désaccord ? Demander une médiation conventionnelle par email. »
- Notification in-app et email « Décision rendue » aux deux.
- **Chaque partie voit uniquement le montant qui la concerne.**

**Verdict** ⬜   **Note** :

---

#### WEB-LIT-11 — Un deal clos par médiation ne se note pas · gravité **majeur**

**Étapes**
1. Après une décision, cherche le bouton « Noter » des deux côtés.

**Résultat attendu** — Aucun bouton de notation. Un deal clos par l'équipe **ne se note jamais** : une note après litige serait une note de vengeance.
**Verdict** ⬜   **Note** :

---

#### WEB-LIT-12 — Confirmer dans un onglet, signaler dans l'autre · gravité **majeur** · **⚠ deux onglets**

**Préconditions** — Un deal livré, dans la période de vérification.
**Étapes**
1. Ouvre le suivi dans deux onglets.
2. Dans l'onglet 1, confirme la livraison.
3. Dans l'onglet 2, envoie un signalement.

**Résultat attendu** — L'onglet 2 affiche « Ce deal a changé entre-temps — retour au suivi. » et se relit. **Une seule vérité** : le deal est terminé, aucun litige n'est ouvert.
**Verdict** ⬜   **Note** :

---

#### WEB-LIT-13 — Accès direct au signalement sans droit · gravité **majeur**

**Étapes**
1. Note l'adresse `/fr/bookings/<id>/report` d'un envoi.
2. Ouvre-la avec un compte étranger au deal.
3. Ouvre-la sur un deal déjà terminé.

**Résultat attendu** — Dans les deux cas, un renvoi vers le suivi avec un message clair, **jamais une erreur brute** ni la révélation du contenu du deal.
**Verdict** ⬜   **Note** :

---

### 5.22 — `WEB-NOT` · La notation croisée

**Ce que couvre ce chapitre.** La fenêtre de 14 jours, l'écran de notation, le double-aveugle et la révélation.
**Deals de travail** — `bzv-completed` (Mai ↔ Thomas) et `gru-completed` : leur fenêtre de notation est **ouverte** dans le jeu d'essai.

---

#### WEB-NOT-1 — Où le bouton « Noter » apparaît · gravité **majeur**

**Préconditions** — Connecté avec Mai.
**Étapes**
1. Ouvre l'accueil du tableau de bord.
2. Ouvre « Mes envois ».
3. Ouvre le deal terminé.

**Résultat attendu**
- Accueil : une action « à traiter » de notation.
- « Mes envois » : la ligne porte la mention de notation et le bouton « Noter {prénom} ».
- Sur le deal : la carte « Comment s'est passé ton Deal avec {prénom} ? » / « Tu as jusqu'au {date}. Ta note ne sera visible qu'une fois les deux avis publiés. » avec le bouton « Noter {prénom} ».
- **Aucune fenêtre bloquante** ne s'impose : la notation est toujours facultative.

**Verdict** ⬜   **Note** :

---

#### WEB-NOT-2 — L'écran « Donne ton avis » · gravité **majeur**

**Étapes**
1. Clique « Noter {prénom} ».

**Résultat attendu**
- Titre « Donne ton avis » / « Deal {origine} → {destination} · terminé ».
- Bandeau « Ton Deal avec {prénom} est terminé » / « Ton retour aide la communauté à mieux choisir ses partenaires ».
- La personne notée est présentée par **prénom, initiale, corridor et date de fin** — **jamais sa moyenne ni son nombre de deals avant la note** (biais d'ancrage). Une note affichée avant la saisie est une anomalie **majeure**.
- « Ta note globale » en 1 à 5 étoiles, avec les libellés 1 « Décevant », 2 « Moyen », 3 « Correct », 4 « Très bien », 5 « Excellent ».
- « SUR CES POINTS PRÉCIS » avec des pouces « Bien » / « À améliorer ».
- « TON COMMENTAIRE » marqué « Optionnel · max 280 caractères ».
- Le bloc « PUBLICATION » et les boutons « Plus tard » et « Publier mon avis ».

**Verdict** ⬜   **Note** :

---

#### WEB-NOT-3 — Les critères dépendent du rôle noté · gravité **majeur**

**Étapes**
1. Note un **Voyageur** et relève les critères proposés.
2. Note un **Expéditeur** (depuis un compte Voyageur) et relève les critères.

**Résultat attendu**
- Voyageur noté : « Ponctualité au rendez-vous », « Communication », « Soin du colis ».
- Expéditeur noté : « Clarté de la déclaration », « Réactivité », « Ponctualité au rendez-vous ».

**Verdict** ⬜   **Note** :

---

#### WEB-NOT-4 — La note globale est le seul champ requis · gravité **majeur**

**Étapes**
1. Sans choisir d'étoile, tente « Publier mon avis ».
2. Choisis 5 étoiles, ne coche aucun pouce, n'écris aucun commentaire, publie.

**Résultat attendu**
- Étape 1 : le bouton est bloqué avec l'indication « Choisis d'abord ta note globale ».
- Étape 2 : la publication réussit.

**Verdict** ⬜   **Note** :

---

#### WEB-NOT-5 — La limite du commentaire · gravité **mineur**

**Étapes**
1. Écris un commentaire de 275 caractères, puis dépasse 280.

**Résultat attendu** — Le compteur « {n} / 280 » passe à « {n} / 280 — bientôt la limite » à l'approche du seuil et empêche le dépassement.
**Verdict** ⬜   **Note** :

---

#### WEB-NOT-6 — Le double-aveugle · gravité **bloquant** · **⚠ deux navigateurs**

**Préconditions** — Navigateur A : Mai. Navigateur B : Thomas. Deal `bzv-completed`.
**Étapes**
1. Dans A, publie une note de 5 étoiles avec un commentaire.
2. Dans A, ouvre la page publique de Thomas.
3. Dans B, ouvre le même deal et publie une note.
4. Dans A, recharge le deal.

**Résultat attendu**
- Étape 1 : écran de succès « Merci pour ton retour ! » / « Ton avis aide toute la communauté Yamba à voyager en confiance. » avec « {prénom} recevra aussi une invitation à te noter. Vos avis seront révélés une fois les deux publiés, ou le {date} au plus tard. »
- Étape 2 : **l'avis n'est pas encore public** sur la page de Thomas.
- Étape 3 : dans B, l'écran de succès dit « {prénom} t'avait déjà noté : vos deux avis sont maintenant visibles. »
- Étape 4 : la carte « Vos avis » montre **les deux notes côte à côte** (« Ta note pour {prénom} » et « La note de {prénom} »).
- Une notification in-app « Les notes sont révélées » arrive aux deux, **sans email**.

**Anomalie bloquante à guetter** — Un avis visible avant que l'autre partie ait noté (ou avant l'échéance de 14 jours) rompt le double-aveugle.
**Verdict** ⬜   **Note** :

---

#### WEB-NOT-7 — L'état intermédiaire · gravité **majeur**

**Préconditions** — Un deal où **une seule** partie a noté.
**Étapes**
1. Ouvre le deal côté auteur de la note.

**Résultat attendu** — « Note envoyée » / « Révélée quand {prénom} aura noté, ou le {date} au plus tard. »
**Verdict** ⬜   **Note** :

---

#### WEB-NOT-8 — On ne note qu'une fois · gravité **majeur**

**Étapes**
1. Rouvre l'adresse `/fr/bookings/<id>/rate` d'un deal déjà noté.
2. Ouvre l'adresse de notation d'un deal en litige.
3. Ouvre celle d'un deal appartenant à un autre compte.

**Résultat attendu** — Respectivement « Ta note est envoyée », « Ce Deal ne peut pas être noté pour le moment. » et un renvoi. **Jamais une erreur technique brute.**
**Verdict** ⬜   **Note** :

---

#### WEB-NOT-9 — Les relances de notation · gravité **mineur** · **dépend d'un cron**

**Préconditions** — Un deal terminé depuis 5 puis 7 jours, dont un rôle n'a pas noté.
**Résultat attendu** — À J+5 : notification et email « Pense à noter {prénom} ». À J+7 : « Dernier rappel : note {prénom} ». Puis **plus rien**. Les relances ne partent qu'au rôle qui n'a pas noté.
**Verdict** ⬜   **Note** :

---

#### WEB-NOT-10 — La révélation à 14 jours même sans réciprocité · gravité **majeur** · **dépend d'un cron**

**Préconditions** — Un deal noté par une seule partie, terminé depuis plus de 14 jours.
**Résultat attendu** — L'avis unique est **révélé** et devient public sur la page du membre noté ; la fenêtre se ferme. Le deal affiche « La fenêtre de notation est fermée — tu n'as pas noté {prénom}. » du côté muet.
**Verdict** ⬜   **Note** :

---

#### WEB-NOT-11 — L'avis révélé apparaît sur la page publique · gravité **majeur**

**Étapes**
1. Ouvre la page publique du membre noté, en fenêtre privée.

**Résultat attendu**
- L'avis apparaît avec l'étoile, le commentaire, le prénom de son auteur, et les pouces des critères (« Ponctualité », « Communication », « Soin du colis », « Déclaration claire », « Réactivité »).
- La ligne de faits et la moyenne sont mises à jour ; le niveau de réputation peut changer.
- Le lien « Signaler cet avis » ouvre un email au support avec la référence de l'avis en objet.

**Verdict** ⬜   **Note** :

---

### 5.23 — `WEB-DES` · La page destinataire

**Ce que couvre ce chapitre.** Le lien de suivi partagé au destinataire, ce qu'il montre et surtout ce qu'il ne montre pas.
**Deal de travail** — `bzv-picked` (Aminata ↔ Thomas), destinataire Clarisse Mabiala.

---

#### WEB-DES-1 — Créer et partager le lien · gravité **majeur** · `[DES1]`

**Préconditions** — Connecté avec Aminata, deal accepté ou en transit.
**Étapes**
1. Sur le suivi, trouve la carte « Partage le suivi à {prénom} ».
2. Clique « Copier le message ».
3. Colle le contenu dans un éditeur.
4. Reclique « Copier le message ».

**Résultat attendu**
- Le sous-titre est « Un lien sans compte : {prénom} voit où en est le colis, sans ton adresse ni le code. »
- Le message est du type « Bonjour {destinataire} ! Ton colis arrive avec {Voyageur}. Suis-le ici : {adresse} », toast « Copié ! ».
- Le **même lien** est produit au second clic (le jeton n'est pas régénéré à chaque fois).

**Verdict** ⬜   **Note** :

---

#### WEB-DES-2 — Le partage par WhatsApp et SMS · gravité **mineur** · `[DES2]`

**Étapes**
1. Clique « WhatsApp », puis « SMS ».

**Résultat attendu** — WhatsApp s'ouvre **sur le numéro saisi à la réservation**, avec le message pré-rempli. Le SMS aussi.
**Verdict** ⬜   **Note** :

---

#### WEB-DES-3 — La page vue par le destinataire · gravité **bloquant** · `[DES3]`

**Préconditions** — **Fenêtre privée, aucun compte connecté.**
**Étapes**
1. Ouvre le lien copié.

**Résultat attendu**
- Titre « Ton colis arrive, {destinataire} ».
- Sous-titre « {Expéditrice} t'envoie un colis avec {Voyageur} {initiale}., Voyageur Yamba, de {origine} à {destination}. »
- Les champs « Départ », « Arrivée prévue », « Où en est le colis ».
- La frise des jalons : « Colis pris en charge », « Colis récupéré par {Voyageur} », « En route », « Arrivé à {ville} », « Colis remis ».
- La mention de confidentialité : « {Expéditrice} a confié ton prénom et ton numéro à Yamba pour cette livraison, et à personne d'autre. Ils sont effacés après la remise. » avec le lien « Politique de confidentialité ».
- Le bloc d'acquisition « Toi aussi, envoie ou transporte avec Yamba » avec « Envoyer un colis » et « Devenir Voyageur ».

**Verdict** ⬜   **Note** :

---

#### WEB-DES-4 — Ce que la page ne montre jamais · gravité **bloquant** · `[DES6]`

**Étapes**
1. Sur la page de suivi, cherche : une adresse, un numéro de téléphone, le code à six chiffres, une photo du colis, un montant.
2. Ouvre le code source de la page (Ctrl+U) et cherche `742891`, le numéro du destinataire, et un montant en euros.

**Résultat attendu** — **Aucun de ces éléments**, ni à l'écran ni dans le code source. Toute présence est une anomalie **bloquante**.
**Vérification complémentaire** — La page doit être **non indexée** (balise `noindex`).
**Verdict** ⬜   **Note** :

---

#### WEB-DES-5 — La page suit la progression · gravité **majeur** · `[DES4]` · **⚠ deux navigateurs**

**Étapes**
1. Garde la page de suivi ouverte en fenêtre privée.
2. Dans un autre navigateur, le Voyageur confirme les jalons puis la remise.
3. Recharge la page de suivi à chaque étape.

**Résultat attendu** — Les jalons s'allument successivement avec leurs aides :
- « {Voyageur} récupère le colis chez {Expéditrice} avant le départ. »
- « Le colis voyage avec {Voyageur}. »
- « {Voyageur} est en route vers {ville}. »
- « {Voyageur} est arrivé. Il te contacte pour convenir de la remise : prépare le code que {Expéditrice} t'a donné. »
- « Le colis t'a été remis. Bonne réception ! »
**Verdict** ⬜   **Note** :

---

#### WEB-DES-6 — Le Voyageur ne crée pas le lien · gravité **majeur** · `[DES5]`

**Étapes**
1. Connecté avec le Voyageur, cherche une carte de partage de suivi sur ses écrans du deal.

**Résultat attendu** — **Aucune**. La création du lien appartient à l'Expéditeur seul.
**Verdict** ⬜   **Note** :

---

#### WEB-DES-7 — Pas de lien avant l'acceptation · gravité **majeur**

**Préconditions** — Un deal en attente (`bzv-pending`).
**Étapes**
1. Cherche la carte de partage sur le suivi.

**Résultat attendu** — Elle est absente ou inactive : il n'y a rien à suivre tant que la demande n'est pas acceptée.
**Verdict** ⬜   **Note** :

---

#### WEB-DES-8 — Un lien invalide · gravité **majeur** · `[DES7]`

**Étapes**
1. Modifie un caractère du jeton dans l'adresse et ouvre-la.
2. Ouvre le lien d'un deal dont le destinataire a été effacé (30 jours après la fin — voir chapitre 5.25).

**Résultat attendu** — Dans les deux cas, **le même message** : « Ce lien de suivi n'est plus valide » / « Le colis a été remis il y a un moment, ou le lien a été retiré. Rapproche-toi de la personne qui te l'a envoyé. » Le bloc « Toi aussi » reste affiché.
**Point important** — Les deux causes **ne se distinguent pas** : la page ne dit jamais si le deal existe.
**Verdict** ⬜   **Note** :

---

#### WEB-DES-9 — Le vrai numéro du destinataire côté Voyageur · gravité **majeur** · `[DES8]`

**Préconditions** — Un deal en transit, connecté avec le Voyageur.
**Étapes**
1. Ouvre la carte du destinataire sur l'écran de suivi.

**Résultat attendu** — Le **numéro réellement saisi à la réservation** s'affiche, avec « Appeler » et « WhatsApp ». Aucun numéro factice ni de démonstration.
**Verdict** ⬜   **Note** :

---

### 5.24 — `WEB-SIG` · Signaler un trajet, un profil, un message

**Ce que couvre ce chapitre.** Le geste de signalement depuis une annonce et depuis un profil. Le signalement d'un message est traité au chapitre 5.15.

---

#### WEB-SIG-1 — Un visiteur voit la porte d'identité · gravité **majeur** · `[SIG1]`

**Préconditions** — Fenêtre privée.
**Étapes**
1. Ouvre une annonce publique et clique « Signaler cette annonce ».

**Résultat attendu** — La fenêtre « Connecte-toi pour signaler » / « Un signalement est toujours signé : cela protège tout le monde des abus. » s'ouvre. Après connexion, retour sur l'annonce.
**Verdict** ⬜   **Note** :

---

#### WEB-SIG-2 — Signaler une annonce · gravité **majeur** · `[SIG2]`

**Préconditions** — Connecté avec Aminata, sur une annonce d'un autre membre.
**Étapes**
1. Clique « Signaler cette annonce ».
2. Lis l'introduction.
3. Choisis le motif « Arnaque suspectée ».
4. Écris une précision.
5. Clique « Envoyer le signalement ».

**Résultat attendu**
- Le titre est « Signaler cette annonce », l'introduction « Dis-nous ce qui ne va pas. Notre équipe regarde chaque signalement ; la personne concernée ne saura jamais qui l'a signalée. »
- Les motifs d'annonce sont : « Contenu illicite ou interdit », « Arnaque suspectée », « Comportement inapproprié », « Autre ». (« Usurpation d'identité » est réservée aux profils.)
- Le champ « Précisions (facultatif) » avec l'indice « Ce que tu as vu, quand… ».
- Après envoi : « Merci, ton signalement est bien reçu. » puis « Un email de confirmation t'a été envoyé. Nous ne communiquons pas la suite donnée. »
- **L'annonce reste en ligne** : rien ne change sur la cible.

**Vérification complémentaire** — Un email « Ton signalement a bien été reçu » arrive dans Mailpit, dans la langue de l'auteur.
**Verdict** ⬜   **Note** :

---

#### WEB-SIG-3 — Le doublon est refusé · gravité **majeur** · `[SIG3]`

**Étapes**
1. Signale la **même** annonce une seconde fois, avec le même compte.

**Résultat attendu** — « Tu as déjà signalé cet élément, notre équipe s'en occupe. »
**Verdict** ⬜   **Note** :

---

#### WEB-SIG-4 — On ne se signale pas soi-même · gravité **majeur** · `[SIG4]`

**Étapes**
1. Connecté avec Thomas, ouvre sa propre annonce.
2. Ouvre sa propre page publique.

**Résultat attendu** — **Aucun bouton « Signaler »** dans les deux cas. Un appel forcé répond « Tu ne peux pas signaler ton propre contenu. »
**Verdict** ⬜   **Note** :

---

#### WEB-SIG-5 — Signaler un profil · gravité **majeur** · `[SIG5]`

**Étapes**
1. Sur la page publique d'un autre membre, clique « Signaler ce profil ».
2. Choisis « Usurpation d'identité » et envoie.

**Résultat attendu** — Le titre est « Signaler ce profil ». Le signalement est reçu. **Le membre signalé n'est jamais prévenu** : aucune notification, aucun email de son côté.
**Verdict** ⬜   **Note** :

---

#### WEB-SIG-6 — Une cible invisible répond « introuvable » · gravité **majeur** · `[SIG6]`

**Étapes**
1. Tente de signaler une annonce supprimée ou masquée par Yamba (via son adresse directe).
2. Tente de signaler le profil d'un membre dont la page est masquée.

**Résultat attendu** — Dans les deux cas, « introuvable ». L'existence de la cible n'est pas révélée.
**Verdict** ⬜   **Note** :

---

#### WEB-SIG-7 — Trois signalements ne changent rien côté membre · gravité **majeur** · `[SIG7]`

**Préconditions** — Trois comptes différents (Aminata, João, Chinwe).
**Étapes**
1. Chacun signale la **même** annonce.
2. Ouvre l'annonce en fenêtre privée.
3. Connecte-toi avec son propriétaire.

**Résultat attendu**
- Les trois auteurs reçoivent le même accusé et le même email.
- **L'annonce reste en ligne** ; le propriétaire n'apprend rien.
- Aucune notification, aucun bandeau, aucune sanction automatique.

**Vérification complémentaire (back-office)** — La ligne devient « Prioritaire · 3 ouverts » dans la file de l'équipe (voir RECETTE-02-ADMIN).
**Verdict** ⬜   **Note** :

---

#### WEB-SIG-8 — Signaler un avis · gravité **mineur**

**Étapes**
1. Sur un avis public d'une page de profil, clique « Signaler cet avis ».

**Résultat attendu** — Un email s'ouvre vers le support, avec la référence de l'avis en objet. **Il n'y a pas de file dédiée** pour les avis : c'est un choix assumé.
**Verdict** ⬜   **Note** :

---

### 5.25 — `WEB-RGP` · Données personnelles : export et effacement

**Ce que couvre ce chapitre.** L'écran « Mes données », le téléchargement du fichier d'export, et la suppression de compte.
**Attention** — La suppression de compte est **immédiate et irréversible**. Elle se joue sur un compte créé pour l'occasion, **jamais** sur un compte du jeu d'essai.

---

#### WEB-RGP-1 — L'écran « Mes données » · gravité **majeur**

**Préconditions** — Connecté avec Aminata.
**Étapes**
1. Tableau de bord › « Sécurité » › « Mes données ».

**Résultat attendu**
- Titre « Mes données » / « Ce que Yamba garde, ce que tu peux télécharger ou supprimer ».
- Une bascule « Relance par email des messages non lus » / « Un email si un message reste sans lecture 15 minutes, au plus un par heure ».
- Une bascule « Mesure d'audience » / « Pages vues, recherches, étapes de réservation — pour améliorer Yamba, jamais pour la publicité ».
- Une carte « Télécharger mes données » / « Un fichier JSON avec ton profil, tes trajets, tes réservations, tes messages… Une fois par 24 h. » avec le bouton « Télécharger ».
- Une carte « Supprimer mon compte » / « Immédiat et irréversible. Tes réservations et litiges restent, sans ton nom. » avec le bouton « Supprimer ».

**Verdict** ⬜   **Note** :

---

#### WEB-RGP-2 — Télécharger ses données · gravité **majeur** · `[RGP1]`

**Étapes**
1. Clique « Télécharger ».
2. Franchis la porte de confirmation : « M'envoyer le code », relève le code dans Mailpit, saisis-le.
3. Clique « Télécharger le fichier ».

**Résultat attendu**
- La porte porte « Confirme que c'est bien toi » / « Pour ce geste sensible, on t'envoie un code à six chiffres par email. Il ouvre une fenêtre de 15 minutes sur cet appareil. »
- Un email « Ton code de confirmation Yamba » arrive.
- Un fichier `yamba-mes-donnees-<date>.json` se télécharge ; l'écran affiche « Ton fichier est téléchargé. »

**Verdict** ⬜   **Note** :

---

#### WEB-RGP-3 — Le contenu du fichier · gravité **bloquant** · `[RGP2]`

**Étapes**
1. Ouvre le fichier téléchargé dans un éditeur de texte.
2. Cherche, dans l'ordre : `format`, `role`, `deliveryCode`, `742891`, le numéro de téléphone d'un destinataire, le nom de famille complet de l'autre partie d'un deal.

**Résultat attendu**
- Le fichier commence par `"format": "yamba-data-export/1"`.
- Les réservations portent le rôle du membre (`SHIPPER` ou `CARRIER`) et **ses** montants.
- **Aucune occurrence** d'un code de livraison, en clair ou chiffré.
- **Aucune coordonnée de l'autre partie** ni du destinataire quand le membre est le Voyageur.
- Les avis reçus **révélés** sont présents ; les signalements **faits** sont présents.
- Les signalements **qui le visent**, les notes internes, les décisions de médiation détaillées et les compteurs de litiges perdus sont **absents**.

**Toute fuite est une anomalie bloquante.**
**Verdict** ⬜   **Note** :

---

#### WEB-RGP-4 — Un export par 24 heures · gravité **majeur** · `[RGP3]`

**Étapes**
1. Relance immédiatement un téléchargement.

**Résultat attendu** — Refus explicite indiquant qu'un seul export est possible par 24 heures. Aucun second fichier.
**Verdict** ⬜   **Note** :

---

#### WEB-RGP-5 — La suppression est bloquée par un deal vivant · gravité **bloquant** · `[RGP4]`

**Préconditions** — Connecté avec Aminata (qui porte un colis en transit et un envoi livré).
**Étapes**
1. Ouvre « Mes données » et clique « Supprimer ».

**Résultat attendu**
- Un bandeau ambre s'affiche **avant toute saisie de code** : « Impossible pour l'instant : termine d'abord ce qui est en cours. »
- Les motifs sont nommés, parmi la liste fermée : « Un deal est en cours (accepté, en transit, livré ou en litige). », « Une demande de réservation attend une réponse. », « Un versement t'est encore dû ou a échoué. », « Une retenue d'annulation est en médiation. », « Un trajet est encore publié ou en pause : annule-le d'abord. », « Ce compte porte un profil administrateur : demande sa révocation. »
- **Aucun code n'est envoyé.**

**Vérification complémentaire** — Refais le test connecté avec Thomas (versement en échec) : le motif « Un versement t'est encore dû ou a échoué. » doit apparaître.
**Verdict** ⬜   **Note** :

---

#### WEB-RGP-6 — Le texte d'avertissement de la suppression · gravité **majeur**

**Préconditions** — Le **second** compte neuf créé au §2.7, sans deal ni trajet.
**Étapes**
1. Clique « Supprimer » et lis l'explication.

**Résultat attendu** — Le texte exact : « Ton identité, tes coordonnées, tes adresses, tes alertes, tes favoris et tes justificatifs seront effacés. L'historique de tes réservations et de tes litiges reste (obligations comptables), ainsi que les avis et les messages déjà échangés, sans ton nom. Ton compte Stripe n'est pas supprimé par Yamba. »
**Verdict** ⬜   **Note** :

---

#### WEB-RGP-7 — Supprimer son compte · gravité **bloquant** · `[RGP5]`

**Préconditions** — Le second compte neuf. **Ce scénario détruit le compte.**
**Étapes**
1. Clique « M'envoyer le code », relève le code dans Mailpit et saisis-le.
2. Tape `supprimer` en minuscules dans le champ « Tape SUPPRIMER pour confirmer ».
3. Tape `SUPPRIMER`.
4. Clique « Supprimer définitivement mon compte ».

**Résultat attendu**
- Étape 2 : le bouton reste inactif (le mot est attendu en majuscules).
- Étape 4 : déconnexion **immédiate**, retour à l'accueil en état visiteur.
- Une tentative de connexion avec l'ancienne adresse et l'ancien mot de passe **échoue**.
- Un email « Ton compte Yamba a été supprimé » arrive à l'ancienne adresse, **sans lien**.

**Vérification complémentaire** — Aucun autre email n'arrivera jamais à cette adresse, quel que soit le flux.
**Verdict** ⬜   **Note** :

---

#### WEB-RGP-8 — L'autre partie voit « Membre supprimé » · gravité **majeur** · `[RGP7]`

**Préconditions** — Un compte effacé qui portait une conversation. À défaut, ce scénario peut être `⏭` avec le motif « aucun compte effacé porteur d'un fil ».
**Étapes**
1. Connecté avec l'autre partie, ouvre le fil de la conversation.

**Résultat attendu** — Le fil est **intact et lisible** ; la contrepartie s'affiche « Membre supprimé » ; « Voir le numéro » n'a plus rien à montrer (« Numéro indisponible »). Le deal, les avis et les messages restent.
**Verdict** ⬜   **Note** :

---

#### WEB-RGP-9 — Le tiers destinataire est effacé à 30 jours · gravité **majeur** · **dépend d'un cron** · `[RGP12]`

**Préconditions** — Un deal terminé depuis plus de 30 jours. Raccourci de recette : abaisser le paramètre de conservation depuis le back-office, ou reculer la date de fin en base, puis attendre le cron nocturne.
**Étapes**
1. Ouvre le récapitulatif de l'envoi côté Expéditeur.
2. Ouvre le lien de suivi du destinataire.

**Résultat attendu**
- Le nom, le téléphone et l'email du destinataire sont effacés de la réservation (affichés « — » ou un numéro neutre).
- Le lien de suivi répond « Ce lien de suivi n'est plus valide ».
- **Un deal encore en litige n'est pas concerné** : l'effacement attend qu'il soit terminal.

**Verdict** ⬜   **Note** :

---

### 5.26 — `WEB-PRF` · Préférences, langue et relances

**Ce que couvre ce chapitre.** La langue préférée du compte et son effet sur les emails, la relance des messages non lus, et les préférences d'affichage.

---

#### WEB-PRF-1 — La bascule de langue met à jour le compte · gravité **majeur**

**Préconditions** — Connecté avec Aminata, langue française.
**Étapes**
1. Bascule l'interface en anglais depuis l'en-tête.
2. Recharge la page, puis déconnecte-toi et reconnecte-toi.

**Résultat attendu** — L'interface reste en anglais après reconnexion : la langue est enregistrée **sur le compte**, pas seulement dans le navigateur.
**Verdict** ⬜   **Note** :

---

#### WEB-PRF-2 — L'email suit la langue du destinataire · gravité **bloquant** · **⚠ deux navigateurs**

**Préconditions** — Aminata en **anglais** (navigateur A). Thomas en **français** (navigateur B).
**Étapes**
1. Dans A, Aminata réserve un trajet de Thomas.
2. Dans B, Thomas accepte la demande.
3. Ouvre Mailpit.

**Résultat attendu**
- L'email reçu par **Aminata** est **en anglais** (« Your request … was accepted »), bien que l'action ait été déclenchée par un membre francophone.
- L'email reçu par **Thomas** (la nouvelle demande) est **en français**.
- La langue de l'email est **toujours celle du destinataire**.

**Anomalie bloquante à guetter** — Un email dans la langue de l'auteur de l'action.
**Verdict** ⬜   **Note** :

---

#### WEB-PRF-3 — Les emails sans compte suivent la langue de l'écran · gravité **majeur**

**Étapes**
1. En interface anglaise, lance une inscription avec une adresse libre.
2. Ouvre Mailpit.

**Résultat attendu** — L'email de code d'activation est en **anglais** : sans compte, c'est la langue de la requête qui décide.
**Verdict** ⬜   **Note** :

---

#### WEB-PRF-4 — Désactiver la relance des messages non lus · gravité **majeur** · `[RGP11]`

**Préconditions** — Connecté avec Pauline.
**Étapes**
1. « Sécurité » › « Mes données » : désactive « Relance par email des messages non lus ».
2. Fais envoyer un message par Thomas et n'ouvre pas le fil pendant 20 minutes.

**Résultat attendu** — **Aucun email de relance**. La notification in-app, elle, est bien présente.
**Verdict** ⬜   **Note** :

---

#### WEB-PRF-5 — L'écran « Paramètres » · gravité **mineur**

**Étapes**
1. Tableau de bord › « Paramètres ».

**Résultat attendu** — Les entrées « Langue », « Thème » (« Automatique »), « Notifications email » (« Demandes, messages, paiements ») et « Notifications push » (« Alertes en temps réel »).
**Note de recette** — Vérifier que les bascules affichées produisent réellement un effet. Une bascule décorative, sans conséquence, est une anomalie **mineure** à consigner explicitement (le membre croit avoir réglé quelque chose).
**Verdict** ⬜   **Note** :

---

#### WEB-PRF-6 — Une langue non prise en charge est refusée · gravité **mineur**

**Étapes**
1. Ouvre `http://localhost:3000/es` (ou une autre langue absente).

**Résultat attendu** — Le site renvoie vers une des langues prises en charge, ou affiche la page introuvable. **Jamais une page à moitié traduite ni une erreur brute.**
**Verdict** ⬜   **Note** :

---

### 5.27 — `WEB-ANA` · Le consentement à la mesure d'audience

**Ce que couvre ce chapitre.** La bannière de consentement, ses deux issues, et la persistance du choix.
**Préconditions communes** — `NEXT_PUBLIC_POSTHOG_KEY` et `NEXT_PUBLIC_POSTHOG_HOST` posées, front redémarré. **Sans ces clés, tout ce chapitre est `⏭`, motif « clé PostHog absente ».**

---

#### WEB-ANA-1 — La bannière s'affiche · gravité **majeur** · `[ANA1]`

**Préconditions** — Navigateur neuf ou stockage vidé, fenêtre privée.
**Étapes**
1. Ouvre `http://localhost:3000`.

**Résultat attendu**
- Une bannière « Mesure d'audience » apparaît en bas.
- Le texte est « Avec ton accord, Yamba mesure comment le site est utilisé (pages vues, recherches, étapes d'une réservation) pour l'améliorer. Aucune donnée n'est vendue ni partagée à des fins publicitaires ; tu peux changer d'avis dans Sécurité › Mes données. »
- Trois éléments : « En savoir plus », « Accepter », « Refuser ».
- **« Accepter » et « Refuser » ont le même poids visuel** : un « Refuser » discret ou en lien de bas de page est une anomalie **majeure**.

**Verdict** ⬜   **Note** :

---

#### WEB-ANA-2 — Refuser ne charge rien · gravité **bloquant** · `[ANA2]`

**Étapes**
1. Ouvre l'onglet réseau du navigateur et filtre sur `posthog`.
2. Clique « Refuser ».
3. Navigue : accueil, recherche, page d'un trajet.

**Résultat attendu** — **Aucune requête vers un domaine PostHog**, aucun script chargé. La bannière disparaît et ne revient pas.
**Verdict** ⬜   **Note** :

---

#### WEB-ANA-3 — Accepter et vérifier ce qui part · gravité **bloquant** · `[ANA3]`

**Étapes**
1. Vide le stockage du navigateur, recharge, clique « Accepter ».
2. Recherche `Paris` → `Brazzaville`.
3. Ouvre un trajet.
4. Commence une réservation.
5. Dans l'onglet réseau, examine le contenu des requêtes envoyées.

**Résultat attendu**
- Des événements partent : vue de page, recherche effectuée (origine, destination, nombre de résultats), consultation d'un trajet, étape de réservation vue.
- **Aucune propriété ne contient** : un nom, un prénom, une adresse email, un numéro de téléphone, un code de livraison, une identité de destinataire.

**Toute donnée personnelle transmise est une anomalie bloquante.**
**Verdict** ⬜   **Note** :

---

#### WEB-ANA-4 — Le choix suit le compte · gravité **majeur** · `[ANA6]`

**Étapes**
1. Connecte-toi avec un compte ayant accepté.
2. Ouvre le site depuis un **second** navigateur neuf et connecte-toi avec le même compte.

**Résultat attendu** — La bannière **ne réapparaît pas** : le choix du compte est repris.
**Verdict** ⬜   **Note** :

---

#### WEB-ANA-5 — Retirer son accord · gravité **majeur** · `[ANA5]`

**Étapes**
1. « Sécurité » › « Mes données » : désactive « Mesure d'audience ».
2. Navigue et surveille l'onglet réseau.

**Résultat attendu** — **Plus aucune requête** vers PostHog. Le retrait est enregistré sur le compte.
**Verdict** ⬜   **Note** :

---

#### WEB-ANA-6 — Sans clé, rien ne s'affiche · gravité **mineur** · `[ANA8]`

**Préconditions** — `NEXT_PUBLIC_POSTHOG_KEY` retirée, front redémarré.
**Étapes**
1. Ouvre le site en fenêtre privée.

**Résultat attendu** — **Aucune bannière**, aucun envoi, **aucune erreur** dans la console.
**Verdict** ⬜   **Note** :

---

### 5.28 — `WEB-MNT` · Le mode maintenance vu du membre

**Ce que couvre ce chapitre.** Le bandeau d'annonce, la lecture seule et sa levée. L'activation se fait dans le back-office (**RECETTE-02-ADMIN**) ou par la variable d'environnement du gateway.

---

#### WEB-MNT-1 — Le bandeau d'annonce · gravité **majeur** · `[MNT5]` · **dépend du back-office**

**Préconditions** — Un administrateur annonce une maintenance pour dans une heure.
**Étapes**
1. Recharge le site en tant que membre.

**Résultat attendu**
- Un bandeau **ambre** s'affiche : « Maintenance prévue le {date} : la plateforme passera en lecture seule pendant l'intervention. »
- **Rien n'est bloqué** : recherche, réservation, message, publication fonctionnent normalement.

**Verdict** ⬜   **Note** :

---

#### WEB-MNT-2 — La lecture seule · gravité **bloquant** · `[MNT6]` · **dépend du back-office**

**Préconditions** — Un administrateur active la lecture seule.
**Étapes**
1. Recharge le site en tant que membre (Aminata).
2. Fais une recherche, ouvre un trajet, ouvre un fil de messagerie, ouvre « Mes envois ».
3. Tente de réserver un trajet (« Payer »).
4. Tente d'envoyer un message.
5. Tente de publier un trajet (compte Voyageur).
6. Déconnecte-toi et reconnecte-toi.

**Résultat attendu**
- Un bandeau **rouge** : « Maintenance en cours : la plateforme est en lecture seule, tu peux consulter mais pas réserver, publier ni écrire. »
- Étape 2 : **toutes les lectures fonctionnent**.
- Étapes 3, 4, 5 : chaque écriture répond « La plateforme est en maintenance : réessaie dans quelques minutes. »
- Étape 6 : **la connexion reste possible** — les routes d'authentification sont exemptées.

**Verdict** ⬜   **Note** :

---

#### WEB-MNT-3 — La levée · gravité **majeur** · `[MNT7]` · **dépend du back-office**

**Étapes**
1. L'administrateur lève la maintenance.
2. Attends 10 secondes et retente une écriture.

**Résultat attendu** — Le bandeau disparaît, les écritures reprennent dans les **10 secondes**. Aucun rechargement forcé n'est nécessaire au-delà.
**Verdict** ⬜   **Note** :

---

#### WEB-MNT-4 — La maintenance pendant une réservation · gravité **majeur**

**Étapes**
1. Va jusqu'à l'étape 4 d'une réservation.
2. Fais activer la lecture seule.
3. Clique « Payer ».
4. Fais lever la maintenance et reclique « Payer ».

**Résultat attendu**
- Étape 3 : « La plateforme est en maintenance : réessaie dans quelques minutes. » ; **rien n'est autorisé, rien n'est débité**.
- Étape 4 : le paiement se déroule normalement.

**Verdict** ⬜   **Note** :

---

### 5.29 — `WEB-ERR` · Pages d'erreur et page introuvable

**Ce que couvre ce chapitre.** Ce que voit un membre quand une page n'existe pas ou quand un incident survient.

---

#### WEB-ERR-1 — La page introuvable · gravité **majeur**

**Étapes**
1. Ouvre `http://localhost:3000/fr/cette-page-nexiste-pas`.

**Résultat attendu**
- Titre « Cette page n'existe pas ».
- Texte « Le lien est peut-être erroné, ou la page a été retirée. Un trajet supprimé ou un profil masqué donne le même résultat. »
- Trois actions : « Chercher un trajet », « Publier un trajet », « Retour à l'accueil ».
- **Aucune trace technique**, aucun message de Next.

**Verdict** ⬜   **Note** :

---

#### WEB-ERR-2 — Un trajet et un profil inexistants mènent à la même réponse · gravité **majeur**

**Étapes**
1. Ouvre `/fr/trips/000000000000000000000000`.
2. Ouvre `/fr/u/slug-inexistant`.

**Résultat attendu** — Respectivement « Trajet introuvable » / « Ce trajet n'existe pas ou n'est plus disponible. » et « Profil introuvable » / « Ce profil n'existe pas ou a été supprimé. » Aucun indice sur l'existence réelle de la ressource.
**Verdict** ⬜   **Note** :

---

#### WEB-ERR-3 — La page d'erreur générale · gravité **bloquant**

**Préconditions** — Provoquer un incident de rendu. Méthode conseillée : couper le gateway (`:8080`) puis ouvrir une page qui dépend d'un chargement serveur ; sinon, demander à un développeur un moyen sûr de déclencher l'erreur.
**Étapes**
1. Provoque l'incident sur une page **hors** tunnel de réservation.
2. Provoque-le sur une page du tunnel (`/trips/<id>/book` ou `/bookings/<id>`).

**Résultat attendu**
- Titre « Cette page n'a pas pu s'afficher ».
- Texte « Un incident technique est survenu de notre côté. Rien de ce que tu as fait n'est perdu : ni ton compte, ni tes envois, ni tes trajets. »
- **Sur une page de réservation seulement**, la phrase de réassurance apparaît **en tête** : « Aucun paiement n'a été effectué. Ta carte n'a pas été débitée et aucune demande n'a été envoyée au Voyageur. »
- Une « Référence de l'incident » de huit caractères, copiable (toast « Référence copiée »), avec l'aide « Communique-la au support si le problème se répète. »
- Les actions « Réessayer », « Retour à l'accueil », « Écrire au support ».
- **Aucun chemin de fichier ni trace de pile n'est affiché.**

**Note** — Sans `NEXT_PUBLIC_SENTRY_DSN`, la référence peut être vide : le scénario passe alors en `⏭` **sur ce seul point**, le reste devant être conforme.
**Verdict** ⬜   **Note** :

---

#### WEB-ERR-4 — Le cas de la version publiée pendant la navigation · gravité **mineur**

**Préconditions** — Difficile à provoquer à la main : reconstruire le front pendant qu'une page est ouverte, puis naviguer.
**Résultat attendu** — Le message devient « Une nouvelle version de Yamba vient d'être publiée. Recharge la page pour la récupérer. » et le bouton devient « Recharger la page » au lieu de « Réessayer ».
**Note** — Si l'incident ne peut pas être reproduit : `⏭` avec le motif.
**Verdict** ⬜   **Note** :

---

#### WEB-ERR-5 — Une erreur ne montre jamais de code · gravité **bloquant**

**Étapes**
1. Provoque plusieurs erreurs : trajet inexistant, session expirée, service arrêté, formulaire refusé.

**Résultat attendu** — Dans **aucun** cas le membre ne voit un nom de fichier, un numéro de ligne, une trace de pile, un identifiant technique brut (`QUOTE_DIVERGENCE`, `SUDO_REQUIRED`, `P2002`…) ni un message en anglais non traduit.
**Anomalie bloquante** — L'affichage d'une trace technique. C'est le constat de recette qui a motivé la création des pages d'erreur ; toute réapparition est une régression.
**Verdict** ⬜   **Note** :

---

### 5.30 — `WEB-MOB` · Responsive mobile

**Ce que couvre ce chapitre.** Le rendu sur téléphone. **Tous les scénarios se jouent en émulation iPhone 14 (390 × 844)**, ou sur un vrai téléphone si le montage LAN est en place (§2.6).

**Règle générale à vérifier partout** — **La page ne défile jamais horizontalement.** Un contenu large (tableau, frise, code) doit défiler **dans son propre cadre**. Un débordement du corps de page est une anomalie **majeure**.

---

#### WEB-MOB-1 — L'accueil et l'en-tête sur téléphone · gravité **majeur**

**Étapes**
1. Ouvre l'accueil en 390 px de large.
2. Ouvre le menu (bouton « Ouvrir le menu »).

**Résultat attendu** — La barre de recherche tient dans l'écran ; le menu s'ouvre en panneau et se referme (« Fermer le menu ») ; aucun défilement horizontal.
**Verdict** ⬜   **Note** :

---

#### WEB-MOB-2 — La recherche et ses filtres en feuille du bas · gravité **majeur**

**Étapes**
1. Ouvre `/fr/search` en 390 px.
2. Clique « Filtres ».
3. Choisis un poids, coche une famille, applique.
4. Ferme la feuille.

**Résultat attendu** — Les filtres s'ouvrent en **feuille du bas**, se manipulent au doigt, et se referment. Les cartes de résultat restent lisibles : prix, kilos, durée, cœur.
**Verdict** ⬜   **Note** :

---

#### WEB-MOB-3 — La barre de réservation mobile · gravité **majeur**

**Étapes**
1. Ouvre une page de trajet en 390 px.
2. Fais défiler la page.

**Résultat attendu** — Une barre du bas affiche le prix et le bouton « Réserver », et **reste accessible** pendant le défilement.
**Verdict** ⬜   **Note** :

---

#### WEB-MOB-4 — L'assistant de réservation en feuille du bas · gravité **majeur**

**Étapes**
1. Lance une réservation en 390 px.
2. À chaque étape, ouvre le récapitulatif (« Détail ») et referme-le (« Masquer »).

**Résultat attendu** — Le total est visible en permanence dans la barre du bas ; « Détail » ouvre le récapitulatif complet ; aucun champ n'est coupé ; le clavier ne masque pas le bouton de validation.
**Verdict** ⬜   **Note** :

---

#### WEB-MOB-5 — Les bulles de messagerie tiennent dans l'écran · gravité **majeur** · `[FCH30]`

**Étapes**
1. Connecté avec Pauline, ouvre « Messages » en 390 px.
2. Ouvre un fil où **tu as écrit** au moins un message.

**Résultat attendu**
- **Tes propres bulles (alignées à droite) sont entièrement visibles.**
- Le titre du rendez-vous passe à la ligne au lieu de forcer la largeur.
- La rangée de réponses rapides défile dans son propre cadre.
- Le bouton « Voir le numéro » est dans l'écran.
- **Rien ne déborde à droite.**

**Anomalie majeure à guetter** — C'est une **régression connue** (voir WEB-NRG-5) : sur une grille sans colonne déclarée en mobile, les bulles de l'auteur sortaient du cadre et seuls les libellés de jour restaient visibles.
**Verdict** ⬜   **Note** :

---

#### WEB-MOB-6 — La croix de fermeture de la porte d'identité · gravité **majeur** · `[NRG3]`

**Étapes**
1. En 390 px, en fenêtre privée, clique « Réserver » sur un trajet.

**Résultat attendu** — La fenêtre de connexion porte **une croix de fermeture visible**, en plus de la poignée de glissement et du lien « Plus tard ».
**Anomalie majeure à guetter** — La croix n'était affichée que sur grand écran (voir WEB-NRG-3).
**Verdict** ⬜   **Note** :

---

#### WEB-MOB-7 — L'écran du deal entre 768 et 1024 px · gravité **majeur**

**Étapes**
1. Règle la fenêtre sur **800 px** de large.
2. Ouvre un deal côté Voyageur (demande reçue ou deal accepté).

**Résultat attendu** — La colonne de droite (gains, couverture, bouton principal) est **visible**. Elle ne doit pas disparaître entre la bascule mobile (768 px) et la grille large (1024 px).
**Verdict** ⬜   **Note** :

---

#### WEB-MOB-8 — Les six cases du code sur téléphone · gravité **majeur**

**Étapes**
1. En 390 px, connecté avec le Voyageur, ouvre l'écran de livraison.
2. Touche la première case.

**Résultat attendu** — Le clavier **numérique** s'ouvre ; les six cases tiennent sur une ligne ; le collage d'un code à six chiffres remplit les six cases d'un coup.
**Verdict** ⬜   **Note** :

---

#### WEB-MOB-9 — Les listes du tableau de bord sur téléphone · gravité **majeur**

**Étapes**
1. En 390 px, ouvre « Mes envois », puis « Mes trajets », puis « Finances ».

**Résultat attendu** — Chaque ligne tient dans la largeur : le titre passe à la ligne, les puces de statut ne poussent pas la colonne, les montants alignés à droite restent visibles. Aucun défilement horizontal du corps de page.
**Verdict** ⬜   **Note** :

---

#### WEB-MOB-10 — La page destinataire sur téléphone · gravité **majeur**

**Étapes**
1. En 390 px, ouvre un lien de suivi en fenêtre privée.

**Résultat attendu** — La frise des jalons est lisible ; le bloc d'acquisition tient ; aucun débordement.
**Verdict** ⬜   **Note** :

---

### 5.31 — `WEB-A11Y` · Accessibilité clavier de base

**Ce que couvre ce chapitre.** Le minimum vérifiable sans outil spécialisé : la navigation au clavier, la fermeture des fenêtres, les libellés des contrôles. Ce n'est **pas** un audit d'accessibilité complet.

---

#### WEB-A11Y-1 — Parcourir l'accueil au clavier · gravité **majeur**

**Étapes**
1. Sur l'accueil, sans toucher la souris, appuie répétitivement sur `Tab`.

**Résultat attendu**
- **Chaque élément qui prend le focus est visible** : un contour ou un fond marque l'élément actif.
- L'ordre suit la lecture de la page : en-tête, barre de recherche, contenu, pied de page.
- Aucun **piège de focus** : on peut toujours continuer avec `Tab` et revenir avec `Maj+Tab`.

**Anomalie majeure** — Un focus invisible : l'utilisateur au clavier ne sait plus où il est.
**Verdict** ⬜   **Note** :

---

#### WEB-A11Y-2 — Remplir et valider le formulaire de connexion au clavier · gravité **majeur**

**Étapes**
1. Ouvre `/fr/login`.
2. Avec `Tab`, atteins « E-mail », saisis l'adresse.
3. `Tab` vers « Mot de passe », saisis-le.
4. `Tab` vers la case « Rester connecté sur cet appareil », coche avec `Espace`.
5. `Tab` vers « Se connecter », valide avec `Entrée`.

**Résultat attendu** — Tout le parcours se fait sans souris. La case se coche avec `Espace`. Le bouton se déclenche avec `Entrée`.
**Verdict** ⬜   **Note** :

---

#### WEB-A11Y-3 — Fermer une fenêtre avec Échap · gravité **majeur**

**Étapes**
1. Ouvre successivement : la porte d'identité, la fenêtre de signalement, la confirmation d'annulation, la feuille des filtres.
2. Appuie sur `Échap` à chaque fois.

**Résultat attendu** — Chaque fenêtre se ferme. Le focus **revient à l'élément qui l'a ouverte**, pas en haut de page.
**Verdict** ⬜   **Note** :

---

#### WEB-A11Y-4 — Le focus est piégé dans une fenêtre ouverte · gravité **majeur**

**Étapes**
1. Ouvre la porte d'identité.
2. Appuie sur `Tab` une dizaine de fois.

**Résultat attendu** — Le focus **tourne à l'intérieur de la fenêtre** et n'atteint jamais la page qui est derrière. C'est le comportement attendu d'une fenêtre modale.
**Verdict** ⬜   **Note** :

---

#### WEB-A11Y-5 — Les contrôles sans texte ont un libellé · gravité **majeur**

**Étapes**
1. Passe le focus sur : le cœur de favori, la croix de fermeture, le bouton d'affichage du mot de passe, le sélecteur de langue, le bouton de thème, la cloche de notifications, les flèches de la visionneuse de photos.
2. Utilise l'inspecteur pour lire l'attribut de libellé accessible.

**Résultat attendu** — Chacun porte un libellé lisible en français : « Ajouter aux favoris », « Fermer », « Afficher le mot de passe », « Changer de langue », « Changer de thème », « Notifications », « Photo précédente » / « Photo suivante ».
**Anomalie à guetter** — Des libellés restés en anglais (« Back », « Dismiss », « Close command palette ») sur une interface française : anomalie **mineure** à consigner avec le nom du contrôle.
**Verdict** ⬜   **Note** :

---

#### WEB-A11Y-6 — Les champs en erreur sont annoncés · gravité **majeur**

**Étapes**
1. Sur l'inscription, valide avec des champs vides.
2. Navigue au clavier jusqu'à un champ en erreur.

**Résultat attendu** — Le message d'erreur est **lié au champ** (il apparaît juste dessous et le champ est marqué en erreur), pas seulement affiché ailleurs sur la page.
**Verdict** ⬜   **Note** :

---

#### WEB-A11Y-7 — Le contraste en mode sombre · gravité **mineur**

**Étapes**
1. Passe en mode sombre et parcours : accueil, recherche, suivi d'un envoi, messagerie.

**Résultat attendu** — Aucun texte illisible : pas de gris foncé sur fond noir, pas de blanc sur mango clair. Les bulles de messagerie, les badges de statut et les montants restent lisibles.
**Verdict** ⬜   **Note** :

---

#### WEB-A11Y-8 — Le zoom à 200 % · gravité **mineur**

**Étapes**
1. Sur l'accueil puis sur le suivi d'un envoi, zoome à 200 % (`Ctrl` + `+`).

**Résultat attendu** — Le contenu reste utilisable ; rien n'est coupé ni superposé ; aucun défilement horizontal du corps de page.
**Verdict** ⬜   **Note** :

---

### 5.32 — `WEB-VOC` · Vocabulaire et cohérence de langue

**Ce que couvre ce chapitre.** Le respect des deux mots de rôle et l'absence de vestiges de vocabulaire. Ce chapitre se joue **en relisant les écrans déjà parcourus**, pas en refaisant les parcours.

---

#### WEB-VOC-1 — « Voyageur » et « Expéditeur » partout · gravité **majeur** · `[VOC1]`

**Étapes**
1. Relis tous les écrans parcourus : accueil, inscription, recherche, page de trajet, réservation, deal, messagerie, tableau de bord, page publique.
2. Relis tous les emails reçus dans Mailpit.
3. Recommence en anglais.

**Résultat attendu** — Seuls les mots **« Voyageur »** et **« Expéditeur »** (« Traveler » et « Shipper » en anglais) désignent les rôles.
**Mots interdits, à consigner s'ils apparaissent** : « Tripper », « Yamber », « transporteur », « traveller ».
**Point d'attention connu** — L'assistant « Devenir Voyageur » a porté le titre « Devenir transporteur » et les libellés « espace transporteur » / « profil transporteur ». Les vérifier explicitement : c'est une anomalie **majeure** de vocabulaire si elle subsiste.
**Verdict** ⬜   **Note** :

---

#### WEB-VOC-2 — Le mot « assurance » n'apparaît pas · gravité **majeur**

**Étapes**
1. Relis l'étape 1 de la réservation, le récapitulatif de prix, l'écran de demande côté Voyageur, l'écran de livraison, et les emails de deal.

**Résultat attendu** — Le mot **« assurance »** n'apparaît nulle part. Les libellés attendus sont « Protection du colis », « Protection de base », « Garantie Yamba 500 € », « Service & protection », « Protection étendue 500 € incluse », « COUVERTURE ».
**Point d'attention connu** — Une seconde source de textes de réservation contient encore « Assurance optionnelle », « Assurance jusqu'à 500 € », « Service Yamba », « Obligatoire avec l'assurance » et « Voir la fiche IPID ». Si l'un de ces libellés s'affiche réellement, c'est une anomalie **majeure** (le contrat d'assureur n'est pas signé).
**Verdict** ⬜   **Note** :

---

#### WEB-VOC-3 — Les noms de catégories sont cohérents d'un écran à l'autre · gravité **mineur**

**Étapes**
1. Compare le nom du bagage soute sur : la recherche, la page du trajet, l'étape 1 de la réservation, « Mes envois », « Mes trajets ».

**Résultat attendu** — Le même objet porte **le même nom partout**.
**Point d'attention connu** — Trois formulations coexistent selon l'écran : « Valise soute 23 Kg », « Bagage 23kg », « Bagage en soute 23 kg ». Consigner chaque écran et son libellé : anomalie **mineure** de cohérence.
**Verdict** ⬜   **Note** :

---

#### WEB-VOC-4 — Le tutoiement est constant · gravité **mineur**

**Étapes**
1. Relis les écrans du tunnel de réservation, du tableau de bord et des deals.

**Résultat attendu** — La plateforme **tutoie** ses membres. Un vouvoiement isolé (« Votre colis », « Vérifiez », « Publiez votre trajet ») au milieu d'écrans tutoyés est une anomalie **mineure** de cohérence, à consigner écran par écran.
**Point d'attention connu** — Les écrans de création de trajet et de recherche emploient encore largement le vouvoiement (« Votre trajet », « Vos conditions », « Votre colis », « Publiez votre trajet en quelques instants. »).
**Verdict** ⬜   **Note** :

---

#### WEB-VOC-5 — Aucun texte de démonstration en production d'écran · gravité **majeur**

**Étapes**
1. Relis « Finances », « Notifications », « Messages » et « Mes envois » avec un compte du jeu d'essai.

**Résultat attendu** — Toutes les données affichées viennent du compte connecté.
**Mentions de démonstration à guetter** : « Aminata T. », « Josué M. », « Léa K. », « Sofia », « Marc R. », « Julie D. », « IBAN ···6789 », « Visa ···4242 », « YAMBA*COLIS », « 89,30 € », « YAM-4821 », « Envoi Paris → Pointe-Noire », « Trajet Lyon → Nice ». Leur présence sur un écran réel est une anomalie **majeure**.
**Verdict** ⬜   **Note** :

---

#### WEB-VOC-6 — Aucun libellé vide ni clé technique · gravité **majeur**

**Étapes**
1. Parcours la liste des notifications d'un compte actif.
2. Parcours tous les écrans en français **et** en anglais.

**Résultat attendu** — Aucun libellé vide, aucun tiret seul « — » à la place d'un texte, aucune clé technique affichée (`booking.status.pending`).
**Point d'attention connu** — La notification déclenchée quand le Voyageur donne sa version de litige a un titre et une ligne **non rédigés**. Vérifier ce cas précis : anomalie **majeure** si un « — » s'affiche à l'écran.
**Verdict** ⬜   **Note** :

---

## 6. Parcours de bout en bout

**Avant de commencer ce chapitre, rejoue impérativement le jeu d'essai** (§3.6) et note l'heure dans la fiche de consignation.

Chaque parcours indique, à chaque étape, **quel compte est connecté et dans quel navigateur**. La convention est constante :

- **Navigateur A** — l'Expéditeur (Chrome, fenêtre normale).
- **Navigateur B** — le Voyageur (Firefox, ou un second profil Chrome).
- **Navigateur C** — le destinataire ou un visiteur (fenêtre privée, aucune session).
- **Mailpit** — ouvert dans un onglet à part, jamais fermé.

Un parcours de bout en bout n'est `✅` que si **toutes** ses étapes le sont. Une étape `❌` fait échouer le parcours entier, et l'anomalie est consignée sur l'étape.

---

### WEB-E2E-1 — Le nominal complet, avec confirmation anticipée · gravité **bloquant**

**Durée estimée** : 45 minutes. **Comptes** : Aminata (A), Joséphine (B), fenêtre privée (C).

| # | Navigateur | Compte | Action | Résultat attendu |
|---|---|---|---|---|
| 1 | B | Joséphine | Publie un trajet Bruxelles → Kinshasa, départ dans 20 jours, **11,50 €/kg**, 23 kg, Électronique +20 %, Alimentaire refusé, un lieu de remise et un lieu de livraison. | « Mes trajets » : badge **En ligne**. |
| 2 | C | — | Recherche Bruxelles → Kinshasa. | Le trajet apparaît, carte « prix au kilo · 11,50 €/kg · 23 kg dispo · ex. colis 2 kg ≈ 26 € ». |
| 3 | C | — | Clique « Réserver ». | Porte « Connecte-toi pour réserver ». |
| 4 | A | Aminata | Ouvre le trajet, poids `2,5` kg dans les filtres, clique « Réserver ». | Étape 1 pré-remplie à 2,5 kg. |
| 5 | A | Aminata | Étape 1 : vêtements, taille S, valeur 150 €, description, deux photos, protection de base. | Récapitulatif : transport **28,75 €**, service **3,45 €**, total **32,20 €**. |
| 6 | A | Aminata | Étape 2 : destinataire `Clarisse` `Mabiala`, indicatif Congo, `061234567`. | Numéro normalisé, étape validée. |
| 7 | A | Aminata | Étape 3 : coche la Charte Expéditeur. | Étape 4 accessible. |
| 8 | A | Aminata | Étape 4 : clique « Payer 32,20 € ». | « Demande envoyée ! Le voyageur a 24 h pour accepter » ; suivi « En attente du Voyageur ». |
| 9 | Mailpit | — | Vérifie les emails. | Aminata : reçu « Paiement autorisé 32,20 € ». Joséphine : « Nouvelle demande » avec **28,75 €** et l'échéance de 24 h. |
| 10 | B | Joséphine | Ouvre la demande, lit les blocs, coche la Charte Voyageur, clique « Accepter et confirmer ». | Écran « Mon Deal accepté » ; Aminata reçoit notification + email « a accepté ta demande » ; kilos restants 20,5. |
| 11 | B | Joséphine | Ouvre le fil, propose un rendez-vous de remise « Bruxelles-Zaventem, hall des départs », dans 3 jours, 10:00–11:00. | Ligne système « Un rendez-vous a été proposé. » ; état « En attente de l'autre personne ». |
| 12 | A | Aminata | Ouvre le fil, clique « Accepter ». | État **« Confirmé »** ; ligne système « Le rendez-vous est confirmé. » |
| 13 | A | Aminata | Clique « Voir le numéro » (plus de 2 h avant). | Bandeau « Le numéro s'affiche à partir du {heure} ». **Pas de numéro.** |
| 14 | A | Aminata | Crée le lien de suivi (« Partage le suivi à Clarisse » › « Copier le message ») et note l'adresse. | Message copié avec le lien `/track/…`. |
| 15 | C | — | Ouvre le lien de suivi. | Page « Ton colis arrive, Clarisse » ; jalon « Colis pris en charge » pas encore atteint ; **ni code, ni numéro, ni montant**. |
| 16 | B | Joséphine | Ouvre l'écran de prise en charge : coche les 5 points, ajoute 2 photos, note libre, « Confirmer la prise en charge ». | Toast de confirmation ; le téléphone du destinataire devient visible côté Voyageur. |
| 17 | A | Aminata | Recharge le suivi. | Le **code à six chiffres** apparaît ; email « ton code est prêt dans ton suivi » **sans le code**. |
| 18 | A | Aminata | « Copier le message » dans la carte de partage du code. | Message pré-rempli contenant le code. |
| 19 | B | Joséphine | Confirme les jalons : aéroport, décollage, atterrissage (laisse passer les 5 s à chaque fois). | Timeline à jour des deux côtés ; page de suivi de C progresse. |
| 20 | Mailpit | — | Vérifie. | **Un seul email de jalon** : « a atterri — préviens le destinataire ». Aucun email pour l'aéroport ni le décollage. |
| 21 | B | Joséphine | Écran de livraison : saisis le code relevé à l'étape 17, ajoute une photo de remise. | « Livraison validée ! » ; le bloc « Ton versement arrive » annonce la date J+4. |
| 22 | A | Aminata | Recharge le suivi. | « Période de vérification » ; compte à rebours ; email « 3 jours pour confirmer ou signaler ». |
| 23 | C | — | Recharge le lien de suivi. | Jalon « Colis remis » atteint. |
| 24 | A | Aminata | Clique « Confirmer la livraison » puis « Oui, tout est OK ». | « Envoi terminé » / « Transaction close » ; carte de signalement disparue. |
| 25 | Mailpit | — | Vérifie. | Aminata : « Transaction terminée ». Joséphine : « {montant} en route vers ton compte ». |
| 26 | A | Aminata | Clique « Noter Joséphine », 5 étoiles, un commentaire, publie. | « Merci pour ton retour ! » ; l'avis n'est **pas encore public**. |
| 27 | B | Joséphine | Note Aminata à son tour. | « Aminata t'avait déjà noté : vos deux avis sont maintenant visibles. » |
| 28 | A + B | — | Rechargent le deal. | Carte « Vos avis » avec les deux notes côte à côte ; notification « Les notes sont révélées » aux deux. |
| 29 | C | — | Ouvre la page publique de Joséphine. | L'avis est public, avec le prénom de son auteur et les pouces des critères ; la ligne de faits est à jour. |

**Verdict global** ⬜   **Note** :

---

### WEB-E2E-2 — Le parcours avec litige · gravité **bloquant**

**Durée estimée** : 40 minutes. **Comptes** : João (A), Thomas (B), un administrateur (D, back-office).

| # | Navigateur | Compte | Action | Résultat attendu |
|---|---|---|---|---|
| 1 | A | João | Ouvre le suivi de `bzv-delivered` (colis livré, période de vérification ouverte). | Bandeau « Ton colis a été livré à {destinataire} » ; compte à rebours. |
| 2 | A | João | Clique « Signaler un problème ». | Écran « Signaler un problème » avec ses quatre blocs. |
| 3 | A | João | Motif « Contenu manquant ou différent de la déclaration ». | Le bloc 2 devient actif. |
| 4 | A | João | Écris `Ça ne va pas`. Tente d'envoyer. | Refus : compteur « 13 / minimum 50 caractères ». |
| 5 | A | João | Écris une description d'au moins 50 caractères, ajoute deux photos, choisis « Remboursement intégral », coche l'engagement. | Le bouton devient actif. |
| 6 | A | João | « Envoyer le signalement » puis « Oui, envoyer ». | « Signalement envoyé » avec un **numéro de dossier `YAM-XXXX`**. Note-le. |
| 7 | A | João | Ouvre le fil de messagerie du deal. | Saisie fermée : « Un litige est en cours : les échanges passent par la médiation. » |
| 8 | Mailpit | — | Vérifie. | João : accusé avec le ticket, le gel et les 48 h ouvrées. Thomas : email **calme**, catégorie seule, jamais la description ni les photos. |
| 9 | B | Thomas | Ouvre le deal. | « Signalement en cours · dossier YAM-XXXX » ; le versement passe « en attente » ; carte « Donne ta version ». |
| 10 | B | Thomas | Vérifie qu'il ne voit **pas** la description de João. | Seule la **catégorie** est affichée. |
| 11 | B | Thomas | Clique « Donner ma version », écris moins de 50 caractères. | Refus « Au moins 50 caractères. » |
| 12 | B | Thomas | Écris un texte suffisant, ajoute une photo, « Envoyer ma version ». | « Ta version est enregistrée. » puis « Version envoyée » ; **le bouton ne revient pas**. |
| 13 | A | João | Recharge son dossier. | Il apprend que Thomas a donné sa version, **jamais son contenu**. |
| 14 | D | Administrateur | Tranche le dossier en **remboursement partiel de 15,00 €**, avec un motif d'au moins 50 caractères (RECETTE-02-ADMIN). | La décision est enregistrée. |
| 15 | A | João | Recharge. | « Décision rendue » ; « Ton signalement est retenu en partie : remboursement partiel. » ; « 15,00 € te sont remboursés, sur ta carte sous 5 à 10 jours. » ; le **motif de l'équipe** est lisible. |
| 16 | B | Thomas | Recharge. | « Décision rendue » ; « Le signalement est retenu en partie : une part du prix est remboursée à l'Expéditeur. » ; son montant à lui, et le même motif. |
| 17 | A + B | — | Cherchent un bouton « Noter ». | **Aucun des deux ne peut noter** : un deal clos par médiation ne se note pas. |
| 18 | Mailpit | — | Vérifie. | Un email « Décision rendue » à chacun, avec **le montant qui le concerne**, jamais celui de l'autre. |
| 19 | A | João | Ouvre « Finances » › « Paiements ». | La ligne porte le remboursement partiel avec sa date. |

**Verdict global** ⬜   **Note** :

---

### WEB-E2E-3 — Le parcours avec annulation tardive · gravité **bloquant**

**Durée estimée** : 35 minutes. **Comptes** : Marie-Claire (A), Marc (B).

| # | Navigateur | Compte | Action | Résultat attendu |
|---|---|---|---|---|
| 1 | B | Marc | Vérifie que son trajet Paris → Montréal part dans **moins de 48 heures**. Si le départ est plus lointain, avance-le en base et note la manœuvre. | Le trajet est bien à moins de 48 h. |
| 2 | A | Marie-Claire | Ouvre le trajet et réserve un colis de 3 kg, taille S, valeur 100 €. Note le total affiché. | Total et net notés pour le contrôle arithmétique de l'étape 7. |
| 3 | B | Marc | Accepte la demande. | Deal accepté ; le paiement est **capturé** : côté A, « Finances » passe de « Autorisé, pas débité » à « Bloqué chez Yamba ». |
| 4 | A + B | — | Échangent deux messages dans le fil. | Les messages passent des deux côtés ; notification in-app à chaque envoi. |
| 5 | A | Marie-Claire | Ouvre « Mes envois » et clique « Annuler » sur ce deal. | Fenêtre « Annuler cet envoi ? ». |
| 6 | A | Marie-Claire | Lis attentivement le montant et l'explication. | « Tu seras remboursée de » **la moitié du total**, avec « Une retenue de 50 % ({montant}) s'applique car le départ est dans moins de 48 h : elle est reversée au Voyageur, qui avait réservé sa capacité pour toi. » |
| 7 | A | Marie-Claire | Vérifie l'arithmétique : remboursement = total ÷ 2 ; compensation Voyageur = arrondi(remboursement × net ÷ total). | Écart maximal toléré : **1 centime**. |
| 8 | A | Marie-Claire | Clique « Garder l'envoi ». | La fenêtre se ferme, **rien n'est annulé**. |
| 9 | A | Marie-Claire | Rouvre et clique « Confirmer l'annulation ». | Toast « Envoi annulé. Remboursement de {montant} en cours. » |
| 10 | A | Marie-Claire | Ouvre « Finances » › « Paiements ». | Ligne « Remboursé {montant} le {date} · retenue {retenue} reversée au Voyageur ». |
| 11 | B | Marc | Ouvre « Finances » › « Portefeuille ». | Ligne « Compensation · annulation tardive de Marie-Claire », état « Parti le {date} · 2 à 7 jours » ou « En cours d'envoi ». |
| 12 | B | Marc | Ouvre « Mes trajets ». | La ligne du deal porte « Annulée tardivement · {montant} de compensation … ». Les kilos sont **rendus** au trajet. |
| 13 | Mailpit | — | Vérifie. | Marie-Claire : « annulée » puis « Remboursement émis » mentionnant que la retenue revient au Voyageur. Marc : notification + email de compensation. |
| 14 | A + B | — | Rouvrent le fil de messagerie. | Le fil reste **lisible** ; il se ferme à l'écriture 14 jours après la fin du deal. |
| 15 | B | Marc | Tente d'annuler le trajet lui-même. | Si un autre deal y est vivant, refus : « Ce trajet porte encore … : annule-les d'abord depuis « Mes deals ». Chaque Expéditeur sera remboursé intégralement. » Sinon, l'annulation passe. |

**Verdict global** ⬜   **Note** :

---

### WEB-E2E-4 — Le compte neuf, plafonné de bout en bout · gravité **majeur**

**Durée estimée** : 40 minutes. **Comptes** : un compte créé sur place (A), Thomas (B).

| # | Navigateur | Compte | Action | Résultat attendu |
|---|---|---|---|---|
| 1 | A | — | Crée un compte neuf : formulaire, mot de passe conforme, case d'acceptation, code reçu dans Mailpit. | Compte activé ; email de bienvenue. |
| 2 | A | Nouveau | Se connecte **sans** cocher « Rester connecté sur cet appareil ». | Session standard. |
| 3 | A | Nouveau | Ouvre `bzv-perkg`, réserve un colis de 2 kg, valeur déclarée `450` €, va jusqu'à « Payer ». | Refus **avant tout paiement** : « Ton compte est récent : pour l'instant, tes envois sont plafonnés (valeur déclarée, poids et nombre par mois). Le plafond se lève avec tes premiers envois terminés. » |
| 4 | A | Nouveau | Vérifie dans « Finances » et dans Mailpit. | **Aucune ligne de paiement**, **aucun email** : rien n'a été autorisé. |
| 5 | A | Nouveau | Ramène la valeur à `250` €, tente un poids de `12` kg. | Refus : plafond de poids (10 kg). |
| 6 | A | Nouveau | Ramène le poids à `8` kg, valeur `250` €, paie. | La demande passe. |
| 7 | A | Nouveau | Crée quatre autres demandes dans le mois civil (sur `fih`, `gru`, `yul`, et un autre trajet). | Les cinq passent. |
| 8 | A | Nouveau | Tente une sixième demande. | Refus : plafond d'envois du mois, même message. |
| 9 | A | Nouveau | Parcours son profil, son tableau de bord, sa page publique. | **Aucune mention** d'un score, d'un niveau de risque ou de points. |
| 10 | A | Nouveau | « Sécurité » › « Mes données » › « Télécharger mes données », franchit la porte par code. | Fichier JSON téléchargé ; **aucune trace du score** à l'intérieur. |
| 11 | B | Thomas | Accepte l'une des demandes du compte neuf. | Deal accepté ; le compte neuf reçoit notification + email. |
| 12 | A | Nouveau | Laisse la session inactive plus d'une heure, puis clique une action. | Fenêtre « Ta session a expiré » **par-dessus la page courante** ; reconnexion sur place ; le geste reprend. |
| 13 | A | Nouveau | « Sécurité » › « Appareils connectés ». | Une ligne « cet appareil » avec navigateur, système, dernière activité, adresse IP. |
| 14 | A | Nouveau | Tente « Supprimer mon compte ». | Bandeau ambre « Impossible pour l'instant : termine d'abord ce qui est en cours. » avec le motif du deal en cours ; **aucun code envoyé**. |

**Verdict global** ⬜   **Note** :

---

### WEB-E2E-5 — Le refus au pickup et le remboursement · gravité **majeur**

**Durée estimée** : 20 minutes. **Comptes** : Aminata (A), Joséphine (B).

| # | Navigateur | Compte | Action | Résultat attendu |
|---|---|---|---|---|
| 1 | A | Aminata | Réserve un trajet de Joséphine (colis de 2 kg, taille S). Note le total. | Demande créée. |
| 2 | B | Joséphine | Accepte. | Deal accepté ; le paiement est capturé. |
| 3 | B | Joséphine | Ouvre l'écran de prise en charge et clique « Refuser le colis ». | Fenêtre « Refuser ce colis ? » avec le rappel « Refuser un colis non conforme ne pénalise jamais ta réputation. » |
| 4 | B | Joséphine | Choisis « Le contenu ne correspond pas à la déclaration » et confirme. | Toast « Colis refusé. {prénom} a été notifiée et sera remboursée. » |
| 5 | A | Aminata | Recharge « Mes envois » et « Finances ». | Statut « Annulée » ; ligne « Remboursé {total intégral} le {date} ». |
| 6 | Mailpit | — | Vérifie. | Deux emails : « refus à la remise » avec la raison traduite, puis « Remboursement émis » du montant **intégral**. |
| 7 | B | Joséphine | Ouvre sa page publique. | **Aucune annulation supplémentaire** n'apparaît dans la ligne de faits : un refus au pickup n'est pas une annulation fautive. |
| 8 | B | Joséphine | Ouvre « Mes trajets ». | Les kilos sont **rendus** au trajet. |

**Verdict global** ⬜   **Note** :

---

### WEB-E2E-6 — Le parcours du destinataire, de bout en bout · gravité **majeur**

**Durée estimée** : 20 minutes. Se joue **en parallèle** de WEB-E2E-1, dans le navigateur C.

| # | Navigateur | Compte | Action | Résultat attendu |
|---|---|---|---|---|
| 1 | C | — | Ouvre le lien de suivi reçu (étape 15 de WEB-E2E-1). | « Ton colis arrive, {prénom} », corridor, dates, frise. |
| 2 | C | — | Cherche une adresse, un numéro, un code, une photo, un montant. | **Aucun**, ni à l'écran, ni dans le code source de la page. |
| 3 | C | — | Recharge après chaque jalon confirmé par le Voyageur. | La frise progresse ; les aides changent à chaque étape. |
| 4 | C | — | Recharge après l'atterrissage. | « {Voyageur} est arrivé. Il te contacte pour convenir de la remise : prépare le code que {Expéditrice} t'a donné. » |
| 5 | C | — | Recharge après la remise. | « Le colis t'a été remis. Bonne réception ! » |
| 6 | C | — | Lis la mention de confidentialité et clique le lien. | « {Expéditrice} a confié ton prénom et ton numéro à Yamba pour cette livraison, et à personne d'autre. Ils sont effacés après la remise. » ; le lien ouvre la politique de confidentialité. |
| 7 | C | — | Clique « Envoyer un colis » puis « Devenir Voyageur » dans le bloc d'acquisition. | Les deux mènent aux écrans attendus. |
| 8 | C | — | Modifie un caractère du jeton dans l'adresse. | « Ce lien de suivi n'est plus valide », sans révéler l'existence du deal. |
| 9 | C | — | Vérifie que **rien n'a été envoyé** au destinataire par Yamba. | Aucun SMS, aucun email : Yamba n'écrit jamais au destinataire. Le lien est partagé par l'Expéditeur seul. |

**Verdict global** ⬜   **Note** :

---

## 7. Non-régression

Ces points ont **déjà cassé**. Ils se rejouent à chaque session de recette, quelles que soient les autres priorités, et **avant** de déclarer une recette terminée. Chacun est court : le lot entier tient en une trentaine de minutes.

---

### WEB-NRG-1 — Le tiret d'heure d'arrivée · gravité **mineur**

**Ce qui s'était passé** — Une carte de résultat affichait le caractère « — » à la place de l'heure d'arrivée quand le trajet n'en déclarait pas. Le champ est désormais **absent** : la ligne disparaît au lieu de se remplir de vraisemblable.
**Étapes**
1. Recherche Paris → Brazzaville, en desktop puis en émulation mobile (390 px).
2. Sur chaque carte, regarde la ligne d'heures sous la ville d'arrivée.

**Résultat attendu** — Soit une **heure réelle**, soit **rien**. Jamais un tiret, jamais un espace vide encadré.
**Verdict** ⬜   **Note** :

---

### WEB-NRG-2 — Le prix à zéro · gravité **majeur**

**Ce qui s'était passé** — Des trajets écrits directement en base, sans prix, s'affichaient « à partir de 0,00 € » sur des annonces pourtant publiées.
**Étapes**
1. Recherche sans critère : parcours **toutes** les cartes de résultat.
2. Ouvre la page de chaque trajet du jeu d'essai.
3. Ouvre l'étape 1 d'une réservation et vide le champ de poids.

**Résultat attendu**
- Aucune carte n'affiche « 0 € », « 0,00 € », « à partir de 0,00 € » ni « — » à la place d'un prix.
- Chaque trajet au kilo affiche son prix au kilo et un exemple chiffré.
- Le récapitulatif de réservation sans poids affiche « Indique le poids du colis pour voir le prix. », jamais un total à zéro.
- Aucun profil n'affiche « ⭐ 0.0 » : un Voyageur sans avis est **« Nouveau Voyageur »**.

**Verdict** ⬜   **Note** :

---

### WEB-NRG-3 — La croix de fermeture sur mobile · gravité **majeur**

**Ce qui s'était passé** — La porte d'identité n'affichait sa croix de fermeture que sur grand écran ; sur téléphone, la seule sortie était un lien « Plus tard » en bas d'un panneau qui défile.
**Étapes**
1. En **390 px**, en fenêtre privée, déclenche les quatre portes : « Réserver », le cœur d'un favori, « Suivre », « Partager un trajet ».
2. Sur chacune, cherche la croix.

**Résultat attendu** — La croix est **visible et cliquable** dans les quatre cas, sur mobile comme sur desktop, en plus de la poignée de glissement et du lien « Plus tard ».
**Verdict** ⬜   **Note** :

---

### WEB-NRG-4 — La réservation d'un trajet sans lieu · gravité **bloquant**

**Ce qui s'était passé** — L'étape 1 de la réservation plantait avec un écran blanc sur un trajet **sans aucun lieu** de remise ni de livraison. La garde de publication l'interdit, mais un jeu de données écrit en base la contournait.
**Étapes**
1. Ouvre l'étape 1 d'une réservation sur **chaque** trajet du jeu d'essai (8 trajets).
2. Si un trajet sans lieu existe encore, ouvre son assistant.

**Résultat attendu**
- L'étape 1 s'affiche toujours, sans écran blanc.
- Sur un trajet sans lieu, le message attendu est « Le Voyageur n'a pas précisé de lieu pour ce trajet : vous conviendrez ensemble du point de rendez-vous dans la conversation, une fois la demande acceptée. »
- La console du navigateur ne montre aucune erreur du type « Cannot read properties of undefined ».

**Verdict** ⬜   **Note** :

---

### WEB-NRG-5 — Les bulles invisibles sur mobile · gravité **majeur**

**Ce qui s'était passé** — Dans la messagerie, la grille n'avait de colonnes déclarées qu'à partir des grands écrans. Sur téléphone, la colonne implicite prenait la largeur minimale de son contenu — plus large que l'écran — et le cadre coupait tout ce qui dépassait à droite : **les bulles de l'auteur disparaissaient**, seuls les libellés de jour restaient.
**Étapes**
1. En **390 px**, connecté avec Pauline, ouvre le fil de `bzv-accepted`.
2. Écris et envoie un message.
3. Ouvre le panneau « Rendez-vous » avec un lieu long.
4. Fais défiler la rangée des réponses rapides.

**Résultat attendu**
- **Tes bulles (à droite) sont entièrement visibles.**
- Le titre du rendez-vous passe à la ligne.
- La rangée de réponses rapides défile **dans son cadre**.
- Le bouton « Voir le numéro » est dans l'écran.
- **Aucun défilement horizontal du corps de page.**

**Verdict** ⬜   **Note** :

---

### WEB-NRG-6 — L'avertissement de clé React · gravité **mineur**

**Ce qui s'était passé** — Une liste rendait ses éléments dans un fragment dont la clé était posée sur un enfant : React réclamait une clé à chaque rendu.
**Étapes**
1. Ouvre la console du navigateur.
2. Parcours les écrans à listes : recherche, « Mes envois », « Mes trajets », « Finances », « Notifications », « Messages », le détail d'un trajet, l'étape 1 d'une réservation.

**Résultat attendu** — **Aucun avertissement** du type « Each child in a list should have a unique key » ni « Warning: » dans la console.
**Note** — Consigner l'écran exact et le texte complet de l'avertissement le cas échéant.
**Verdict** ⬜   **Note** :

---

### WEB-NRG-7 — La porte de confirmation muette · gravité **bloquant**

**Ce qui s'était passé** — Un code d'erreur n'était pas transmis au navigateur : la porte de confirmation par code ne s'ouvrait jamais, et une fonction entière était morte sans erreur visible.
**Étapes**
1. Connecté, tente les cinq gestes sensibles : changer le mot de passe, changer l'adresse email, ouvrir le tableau de bord Stripe, télécharger ses données, supprimer son compte.

**Résultat attendu** — **Chacun ouvre la porte** « Confirme que c'est bien toi » avec « M'envoyer le code ». Un geste qui échoue en silence, ou qui affiche une erreur générique, est une anomalie **bloquante**.
**Verdict** ⬜   **Note** :

---

### WEB-NRG-8 — Les libellés des statuts de trajet · gravité **mineur**

**Ce qui s'était passé** — Les statuts s'appelaient « Actif » et « En pause » dans une version antérieure.
**Étapes**
1. Ouvre « Mes trajets » avec Thomas, en français puis en anglais.

**Résultat attendu** — Les six libellés français sont exactement : **Brouillon, En ligne, Masqué, Terminé, Annulé, Archivé**. En anglais : **Online** et **Hidden** pour les deux premiers états visibles. Les toasts sont « Trajet masqué » et « Trajet remis en ligne ».
**Verdict** ⬜   **Note** :

---

### WEB-NRG-9 — L'annulation d'un trajet portant des deals · gravité **bloquant**

**Ce qui s'était passé** — Un trajet s'annulait sans condition, laissant les colis acceptés attachés à un trajet mort : personne n'était remboursé ni prévenu, et l'Expéditeur qui annulait ensuite subissait la retenue prévue pour **sa** propre annulation.
**Étapes**
1. Connecté avec Thomas, tente d'annuler `bzv-upcoming` (qui porte des deals vivants).

**Résultat attendu** — **Refus explicite** nommant le nombre de deals restants, et le trajet reste « En ligne ».
**Verdict** ⬜   **Note** :

---

### WEB-NRG-10 — Le limiteur de requêtes trop serré · gravité **majeur**

**Ce qui s'était passé** — Le limiteur du gateway comptait tout le monde à 100 requêtes par quart d'heure, y compris les membres connectés, ce qu'une navigation normale atteint.
**Étapes**
1. Connecté avec Aminata, navigue activement pendant cinq minutes : recherche, ouverture de plusieurs trajets, tableau de bord, messagerie, filtres.

**Résultat attendu** — **Aucun message** « Trop de tentatives » ni erreur de limitation pendant une navigation normale.
**Verdict** ⬜   **Note** :

---

### WEB-NRG-11 — L'origine refusée par le contrôle d'accès du gateway · gravité **bloquant**

**Ce qui s'était passé** — Un nouveau front, ou un nouveau port, absent de la liste d'origines autorisées, faisait échouer **tous** les appels avec une erreur serveur.
**Étapes**
1. Ouvre le site sur `http://localhost:3000` et fais une action qui appelle le serveur.
2. Si un montage LAN est en place, refais-le depuis `http://192.168.x.x:3000`.

**Résultat attendu** — Les appels aboutissent dans les deux cas. Une erreur du type « Not allowed by CORS » est une anomalie **bloquante** d'environnement, à signaler avec l'adresse exacte utilisée.
**Verdict** ⬜   **Note** :

---

### WEB-NRG-12 — La clé de traduction refusée au rendu · gravité **majeur**

**Ce qui s'était passé** — Une clé de traduction contenant un point faisait refuser **tout un domaine de textes** au moment du rendu : une section entière s'affichait vide.
**Étapes**
1. Parcours l'ensemble des écrans, en français **et** en anglais.
2. Guette : une section entièrement vide, un bloc de texte manquant, une clé technique affichée telle quelle.

**Résultat attendu** — Aucun écran incomplet dans l'une ou l'autre langue.
**Verdict** ⬜   **Note** :

---

## 8. Consignation

### 8.1 Tableau récapitulatif

À remplir au fil de la session. Une ligne par chapitre ; le nombre de scénarios est donné, le testeur complète les colonnes de verdict.

| Chapitre | Domaine | Scénarios | ✅ | ❌ | ⏭ | ⬜ | Bloquants ouverts |
|---|---|---|---|---|---|---|---|
| 5.1 | `WEB-ACC` — Découverte et navigation | 12 | | | | | |
| 5.2 | `WEB-INS` — Inscription et Google | 16 | | | | | |
| 5.3 | `WEB-CNX` — Connexion et sessions | 13 | | | | | |
| 5.4 | `WEB-MDP` — Mot de passe et email | 6 | | | | | |
| 5.5 | `WEB-PRO` — Profil et page publique | 11 | | | | | |
| 5.6 | `WEB-VOY` — Onboarding Voyageur | 7 | | | | | |
| 5.7 | `WEB-TRJ` — Trajets et cycle de vie | 21 | | | | | |
| 5.8 | `WEB-DOC` — Justificatifs et billet | 6 | | | | | |
| 5.9 | `WEB-RCH` — Recherche et filtres | 15 | | | | | |
| 5.10 | `WEB-ALR` — Alertes de route | 9 | | | | | |
| 5.11 | `WEB-FAV` — Favoris et abonnements | 12 | | | | | |
| 5.12 | `WEB-RSV` — Réservation | 22 | | | | | |
| 5.13 | `WEB-TRU` — Plafonds du compte neuf | 5 | | | | | |
| 5.14 | `WEB-DEA` — Acceptation et refus | 9 | | | | | |
| 5.15 | `WEB-MSG` — Messagerie et rendez-vous | 22 | | | | | |
| 5.16 | `WEB-PIC` — Prise en charge et jalons | 10 | | | | | |
| 5.17 | `WEB-COD` — Code de livraison | 8 | | | | | |
| 5.18 | `WEB-REM` — Remise du colis | 7 | | | | | |
| 5.19 | `WEB-CNF` — Confirmation et versement | 11 | | | | | |
| 5.20 | `WEB-ANN` — Annulations | 9 | | | | | |
| 5.21 | `WEB-LIT` — Litige et médiation | 13 | | | | | |
| 5.22 | `WEB-NOT` — Notation croisée | 11 | | | | | |
| 5.23 | `WEB-DES` — Page destinataire | 9 | | | | | |
| 5.24 | `WEB-SIG` — Signalements | 8 | | | | | |
| 5.25 | `WEB-RGP` — Données personnelles | 9 | | | | | |
| 5.26 | `WEB-PRF` — Préférences et langue | 6 | | | | | |
| 5.27 | `WEB-ANA` — Mesure d'audience | 6 | | | | | |
| 5.28 | `WEB-MNT` — Maintenance | 4 | | | | | |
| 5.29 | `WEB-ERR` — Pages d'erreur | 5 | | | | | |
| 5.30 | `WEB-MOB` — Responsive mobile | 10 | | | | | |
| 5.31 | `WEB-A11Y` — Accessibilité clavier | 8 | | | | | |
| 5.32 | `WEB-VOC` — Vocabulaire | 6 | | | | | |
| 6 | `WEB-E2E` — Bout en bout | 6 | | | | | |
| 7 | `WEB-NRG` — Non-régression | 12 | | | | | |
| | **TOTAL** | **344** | | | | | |

**Taux de conformité** = ✅ ÷ (total − ⏭). À reporter ici : ________ %

### 8.2 Table des anomalies

Une ligne par anomalie. Un `❌` sans ligne correspondante rend la consignation invalide.

| # | Scénario | Écran / adresse | Description de l'écart (attendu vs constaté) | Gravité | Reproductible | Navigateur / taille | Capture | État |
|---|---|---|---|---|---|---|---|---|
| A1 | | | | bloquant / majeur / mineur | oui / non / aléatoire | | | ouverte |
| A2 | | | | | | | | |
| A3 | | | | | | | | |
| A4 | | | | | | | | |
| A5 | | | | | | | | |

**Comment décrire un écart** — Trois phrases suffisent : ce que le cahier annonçait, ce qui s'est réellement produit, et ce qu'il faut faire pour le revoir. Reprendre le **libellé exact** constaté à l'écran quand l'anomalie est un écart de texte.

**Captures** — Les captures ne sont **jamais versionnées** dans le dépôt. Les stocker à part et n'indiquer ici que leur nom de fichier.

### 8.3 Journal de session

| # | Heure | Événement | Conséquence |
|---|---|---|---|
| J1 | | Jeu d'essai rejoué | Les deals des chapitres précédents sont perdus |
| J2 | | | |
| J3 | | | |

Y consigner : chaque remise à zéro du jeu d'essai, chaque redémarrage de service, chaque modification de configuration ou de paramètre, chaque manœuvre en base (date reculée, paramètre abaissé). **Une manœuvre non consignée rend un verdict incontestable inexploitable.**

### 8.4 Scénarios non testables

| Scénario(s) | Motif précis | Ce qu'il faudrait pour les jouer |
|---|---|---|
| | | |
| | | |

Rappel des motifs légitimes de `⏭` (§2.6) : ImageKit absent, clé Stripe publique absente, Stripe Connect non activé, identifiants Google absents, clé Google Maps absente, clés PostHog absentes, Sentry absent, cron non joué, accès back-office manquant.

### 8.5 Critères de sortie

La recette de la partie Web est **terminée** quand les six conditions suivantes sont réunies :

1. **Aucun scénario ne reste `⬜`.** Chaque ligne porte un verdict, y compris les `⏭` motivés.
2. **Aucune anomalie bloquante ouverte.** Un bloquant corrigé doit être **rejoué** et repasser `✅` avant la clôture.
3. **Au plus trois anomalies majeures ouvertes**, chacune avec une décision explicite (corrigée, acceptée pour cette version, ou reportée avec sa date).
4. **Taux de conformité ≥ 95 %**, les `⏭` exclus du calcul.
5. **Les douze scénarios de non-régression du chapitre 7 sont tous `✅`.** Aucune exception : ce sont les points qui ont déjà cassé.
6. **Les six parcours de bout en bout du chapitre 6 sont `✅`**, en particulier `WEB-E2E-1` (nominal complet) et `WEB-E2E-2` (litige), qui couvrent l'ensemble de la chaîne de valeur et tous les moments d'argent.

**Conditions supplémentaires si la recette prépare une mise en production :**

7. Les scénarios `⏭` pour cause de configuration absente (Stripe, Google, ImageKit, PostHog) doivent être **rejoués sur l'environnement cible** avant l'ouverture au public : ce cahier ne peut pas les couvrir localement.
8. Les invariants suivants doivent avoir été vérifiés au moins une fois chacun, et être `✅` :
   - le code de livraison n'apparaît **jamais** côté Voyageur, ni dans un email, ni dans un fil (`WEB-COD-2`, `WEB-MSG-6`) ;
   - le Voyageur ne voit **jamais** le total payé par l'Expéditeur (`WEB-DEA-2`) ;
   - l'Expéditeur ne voit **jamais** un échec de versement du Voyageur (`WEB-CNF-6`) ;
   - la page destinataire ne montre **ni adresse, ni numéro, ni code, ni montant** (`WEB-DES-4`) ;
   - l'export de données ne contient **ni code de livraison, ni coordonnées de l'autre partie** (`WEB-RGP-3`) ;
   - aucune donnée personnelle ne part vers la mesure d'audience (`WEB-ANA-3`) ;
   - le score interne n'est visible sur **aucun** écran membre (`WEB-TRU-5`).

**Signature de la session**

| | |
|---|---|
| Testeur | |
| Date de début | |
| Date de fin | |
| Version testée (branche, dernier commit) | |
| Environnement | local / recette / autre : |
| Verdict global | conforme / conforme avec réserves / non conforme |

---

*Fin du cahier de recette — Partie 1 : le site membre (Web). Les parties 2 (back-office), 3 (API) et 4 (traitements automatiques) sont dans les fichiers `RECETTE-02-ADMIN.md`, `RECETTE-03-API.md` et `RECETTE-04-CRONS.md` du même dossier.*
