# Yamba — Documentation d'utilisation de l'API de bout en bout

> **Lot 3 des livrables.** Ce document explique comment un client — le front web `user-ui`, le back-office `admin-ui`, une future application mobile (D36) ou un simple script `curl` — utilise l'API Yamba de bout en bout : par quelle porte entrer, comment s'authentifier, comment lire une erreur, et dans quel ordre appeler les routes pour vivre un parcours complet (inscription, publication d'un trajet, réservation, transport, remise, notation, messagerie, signalement, RGPD, back-office). La **référence exhaustive des 173 endpoints** (méthode, chemin, authentification, permission, paramètres, corps, réponses, schémas) est générée automatiquement depuis les cinq documents OpenAPI 3.1 des services et insérée au chapitre 7 ; les chapitres 1 à 6 et les annexes sont la partie narrative et pratique, écrite à la main à partir du code réel.
>
> Conventions de lecture : les surfaces publiques de l'API (chemins, clés d'événements, codes d'erreur, messages) sont en **anglais**, la documentation est en **français**. Le symbole 🚪 signale une **porte** : un point où le comportement actuel est volontairement non figé, incomplet ou à durcir avant un usage donné (par exemple la mise en production ou le client mobile). Les identifiants de décisions (D2, D3, D36…) renvoient au registre `context/YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md` ; les identifiants A-xxx aux arbitrages de chantier.
>
> Précédence en cas de divergence : le code et ses tests > le registre des décisions > ce document. Les exemples `curl` de ce document correspondent à des routes réelles montées dans les routeurs des services, vérifiées contre la référence générée.

## Sommaire

1. [Vue d'ensemble : le gateway, les cinq services, les documents OpenAPI](#1-vue-densemble)
2. [Conventions transverses](#2-conventions-transverses) — authentification membre et admin, fenêtre sudo, locale, corrélation, format des erreurs, sémantique des statuts, limiteur, maintenance, pagination, montants, dates, idempotence, CORS
3. [Guides pas à pas (`curl`)](#3-guides-pas-à-pas) — inscription → connexion ; devenir Voyageur ; publier ; rechercher ; réserver et vivre le deal ; messagerie ; lien de suivi ; signalement ; alertes de route ; profil et avatar ; RGPD ; session admin
4. [Catalogue des codes d'erreur métier](#4-catalogue-des-codes-derreur-métier)
5. [Webhooks entrants et événements sortants](#5-webhooks-entrants-et-événements-sortants)
6. [Bonnes pratiques d'intégration, sécurité, compatibilité](#6-bonnes-pratiques-dintégration)
7. [Référence exhaustive des endpoints (générée)](#7-référence-exhaustive-des-endpoints)
8. [Annexes](#8-annexes) — schémas de sécurité, variables d'environnement côté client, glossaire, recommandations d'expert hors périmètre

---

## 1. Vue d'ensemble

### 1.1 Une seule porte d'entrée : le gateway

Toute requête d'un client passe par **l'API gateway** (`apps/api-gateway/src/main.ts`), un serveur Express qui écoute sur le **port 8080** et expose l'ensemble de la plateforme sous le préfixe **`/api`**. Le gateway ne contient aucune logique métier : il applique le CORS, pose un identifiant de corrélation, applique un limiteur de débit, refuse les écritures en mode maintenance, puis **proxifie** chaque requête vers le microservice propriétaire du chemin, en réécrivant le préfixe. Un client n'a donc jamais besoin de connaître les ports des services : il parle à `http://localhost:8080/api/...` en développement, et à l'URL du gateway de l'environnement en recette ou en production.

Trois adresses « système » vivent directement au gateway, hors proxy :

| Route | Rôle | Particularités |
|---|---|---|
| `GET /api/status` | Sonde publique pour un moniteur externe (D70). Interroge le `/health` des cinq services (2 s chacun) et agrège : `ok`, `maintenance`, `degraded`, `down`. | Déclarée **avant** le limiteur, mise en cache 10 s. HTTP **200** pour `ok` / `maintenance`, **503** pour `degraded` / `down`. Le corps ne contient jamais d'URL interne ni d'erreur brute : `{ status, services: [{ name, reachable, status, ms }], at }`. |
| `GET /gateway-health` | Santé du gateway lui-même, même forme que les `/health` des services. | Sans préfixe `/api`. Le contrôle `maintenance` est `ok: false` quand le mode lecture seule est actif. |
| `GET /api/maintenance` | État public du mode maintenance : `{ enabled, message: { fr, en }, scheduledAt }`. | Sert les bandeaux des deux fronts ; exempté du blocage. |

### 1.2 Table de routage : préfixe → service → chemin réécrit

L'ordre de déclaration compte : les préfixes les plus spécifiques sont déclarés avant le « catch-all » vers l'auth-service. La table ci-dessous est l'image exacte du fichier `main.ts` du gateway.

| Préfixe côté client (`/api/...`) | Service cible | Chemin reçu par le service | Domaine |
|---|---|---|---|
| `/api/trips/*` | trip-service `:6002` | `/trips/*` | trajets, recherche, favoris, documents, paramètres de prix |
| `/api/uploads/*` | trip-service `:6002` | `/uploads/*` | signature ImageKit, suppression d'un fichier |
| `/api/deals/*` | deal-service `:6003` | `/deals/*` | demandes, transitions, transport, remise, litige, notation, lien de suivi |
| `/api/me/bookings/*` | deal-service `:6003` | `/me/bookings/*` | « Mes envois » (Expéditeur) |
| `/api/me/deals/*` | deal-service `:6003` | `/me/deals/*` | deals reçus (Voyageur, tous trajets) |
| `/api/me/wallet/*` | deal-service `:6003` | `/me/wallet/*` | portefeuille Voyageur et paiements Expéditeur |
| `/api/track/*` | deal-service `:6003` | `/track/*` | page destinataire sans compte (D69) |
| `/api/admin/disputes/*` | deal-service `:6003` | `/admin/disputes/*` | file de médiation |
| `/api/admin/alerts` | deal-service `:6003` | `/admin/alerts` | alertes de seuil (D59) |
| `/api/admin/finances/*` | deal-service `:6003` | `/admin/finances/*` | files d'exception, rapport, export |
| `/api/admin/deals/*` | deal-service `:6003` | `/admin/deals/*` | fiche argent, rapprochement, rejeu, chronologie |
| `/api/admin/trips/*` | trip-service `:6002` | `/admin/trips/*` | trajets, masquage |
| `/api/admin/tickets/*` | trip-service `:6002` | `/admin/tickets/*` | vérification des billets |
| `/api/admin/conversations/*` | message-service `:6005` | `/admin/conversations/*` | lecture journalisée d'un fil, signalements de messages |
| `/api/messages/*` | message-service `:6005` | `/messages/*` | conversations, rendez-vous, numéro |
| `/api/me/notifications/*` | notification-service `:6004` | `/me/notifications/*` | notifications in-app |
| `/api/webhooks/email/*` | notification-service `:6004` | `/webhooks/email/*` | webhook du fournisseur d'email (Resend) |
| tout le reste (`/api/auth/*`, `/api/carrier/*`, `/api/saved-routes/*`, `/api/users/*`, `/api/me/following`, `/api/reports`, `/api/admin/*` restant) | auth-service `:6001` | chemin **inchangé** (`/api/...`) | comptes, sessions, profils, alertes de route, signalements, back-office transverse |

Deux subtilités à retenir :

- **L'auth-service est le seul service qui reçoit le chemin complet**, préfixe `/api` inclus : ses routeurs sont montés sous `app.use("/api", …)`. Les autres services reçoivent un chemin réécrit sans `/api`. Quand on lit la référence générée, les chemins sont exprimés **du point de vue du service** (`/auth/login`, `/trips/search`, `/deals/{id}`) : il suffit de préfixer par `/api` pour obtenir l'URL client.
- **Le webhook Stripe ne passe pas par le gateway.** Il est monté directement sur le deal-service (`POST http://localhost:6003/webhooks/stripe`) car la signature Stripe porte sur les octets bruts du corps, que le gateway re-sérialise (voir §5.1).

### 1.3 Les cinq services et leurs ports

| Service | Port | Responsabilité | Particularités d'infrastructure |
|---|---|---|---|
| **auth-service** | 6001 | inscription par OTP email, connexion (mot de passe, Google), rotation des sessions, fenêtre sudo, profil et avatar, onboarding Voyageur + Stripe Connect, alertes de route, profils publics et abonnements, signalements, export / effacement RGPD, tout le back-office transverse (KPIs, pilotage, journal, paramètres, statut, maintenance, comptes admin, utilisateurs, sanctions) | Redis pour les OTP, les sessions (`jti`) et les fenêtres sudo ; crons (rappels, expirations) ; emails par dictionnaires de locale |
| **trip-service** | 6002 | trajets (brouillon, publication, pause, annulation, archivage), recherche publique paginée, facettes, favoris, documents de trajet, signature d'upload ImageKit, paramètres de prix publics, back-office trajets et billets | machine à états du trajet ; portes de publication (onboarding, Stripe) ; compteurs de demande en Redis |
| **deal-service** | 6003 | le cœur transactionnel : intention de paiement, création de la demande, machine à états du deal (9 statuts), transport (récupération, jalons, code de livraison, remise), règlement (confirmation, versement), litiges, notation double-aveugle, lien de suivi destinataire, portefeuille, files financières admin | `PaymentProvider` (Stripe capture manuelle / Fake), **outbox transactionnelle** + relais Kafka (topic `booking-events`), crons (expiration 24 h, versements, rappels, alertes, rétention) ; webhook Stripe direct |
| **notification-service** | 6004 | boîte aux lettres : deux consommateurs Kafka (`booking-events`, `messaging-events`) qui matérialisent les notifications in-app et envoient les emails, webhook Resend, purge nocturne | dédoublonnage par `eventId` (modèle `ConsumedEvent`), offsets commités après traitement, analytics PostHog par projection en liste blanche |
| **message-service** | 6005 | coordination Expéditeur ↔ Voyageur (D61) : une conversation par deal ouverte à l'acceptation, rendez-vous comme objet métier, fil avec messages système, numéro révélé au plus tôt 2 h avant le rendez-vous, signalement d'un message, lecture admin journalisée | propre outbox + relais sur le topic `messaging-events`, relance email des non-lus, purge à un an |

Les cinq services partagent **une seule base MongoDB** (schéma Prisma à la racine `prisma/schema.prisma`) et un Redis. Chacun expose `GET /health` (toujours HTTP 200, corps `ok` ou `degraded`, contrôles Mongo + Redis en 2 s), et chacun appelle `initSentry("<service>")` au démarrage : un 5xx est capturé, tagué du service et de l'identifiant de corrélation.

### 1.4 Les documents OpenAPI vivants

Chaque service **génère son document OpenAPI 3.1 au démarrage** à partir des schémas Zod du paquet `@packages/api-contracts` (décision D3 : le même objet Zod valide les requêtes et produit la spécification ; la documentation ne peut pas dériver du code). Les documents sont aussi versionnés dans le dépôt (`apps/<service>/openapi.json`) et la CI vérifie qu'ils sont identiques à ce que le code génère (`generate + diff`).

| Service | Document vivant | Visionneuse | Version du document | Fichier versionné |
|---|---|---|---|---|
| auth-service | `http://localhost:6001/openapi.json` | `http://localhost:6001/docs` (Scalar) | `1.0.0` | `apps/auth-service/openapi.json` |
| trip-service | `http://localhost:6002/openapi.json` | `http://localhost:6002/docs` | `0.3.0` | `apps/trip-service/openapi.json` |
| deal-service | `http://localhost:6003/openapi.json` | `http://localhost:6003/docs` | `0.1.0` | `apps/deal-service/openapi.json` |
| notification-service | `http://localhost:6004/openapi.json` | `http://localhost:6004/docs` | `0.1.0` | `apps/notification-service/openapi.json` |
| message-service | `http://localhost:6005/openapi.json` | — (pas de route `/docs` ; ouvrir le JSON dans une visionneuse externe) 🚪 | `1.0.0` | `apps/message-service/openapi.json` |

Les visionneuses Scalar sont servies depuis un CDN et lisent le document vivant : elles sont « incapables de mentir ». Un test de l'auth-service exige que **chaque route montée soit documentée et qu'aucune route documentée n'existe pas** (A145) ; les schémas de l'auth-service décrivent les contrôleurs historiques au réel mais **ne gardent pas encore l'entrée** en `safeParse` — c'est une porte 🚪 explicitement gravée pour le chantier mobile.

Les numéros de version des documents sont **indépendants les uns des autres** et ne suivent pas (encore) une politique de compatibilité formelle ; voir §6.3.

### 1.5 Comment lire la suite

Le chapitre 2 pose les conventions valables partout ; il faut le lire une fois. Le chapitre 3 déroule les parcours avec des appels `curl` complets : chaque appel indique quel service répond réellement derrière le gateway, les erreurs possibles et la réaction attendue du client. Le chapitre 4 est le catalogue des codes métier à traduire côté client. Le chapitre 5 décrit ce qui entre par webhook et ce qui sort par Kafka. Le chapitre 6 s'adresse à qui écrit un client (mobile en particulier). Le chapitre 7 est la référence générée. Les annexes ferment le document.

---

## 2. Conventions transverses

### 2.1 Authentification d'un membre : cookies, jetons, rotation

Un membre (rôle `USER`, éventuellement `CARRIER`) s'authentifie auprès de l'auth-service, qui émet **deux JWT** :

- **`access_token`** — jeton d'accès signé avec `ACCESS_TOKEN_SECRET`, porteur de `{ id, roles }`, durée de vie **15 minutes**. C'est lui que vérifient les middlewares de toutes les routes protégées.
- **`refresh_token`** — jeton de rafraîchissement signé avec `REFRESH_TOKEN_SECRET`, porteur de `{ id, jti, rememberMe, createdAt }`. Le **`jti`** est l'identifiant unique de la session, enregistré dans Redis avec ses métadonnées (`device`, `ip`, `userAgent`, D65 2A).

Ils sont posés en **cookies `httpOnly`** par `POST /auth/login`, `POST /auth/register/verify`, `POST /auth/google` et `POST /auth/refresh` : `path=/`, `sameSite=lax` hors production, `sameSite=none` + `secure` en production. Le cookie `access_token` vit 15 minutes ; le cookie `refresh_token` est un **cookie de session** (disparaît à la fermeture du navigateur) sauf si la connexion a été faite avec `rememberMe: true`, auquel cas il vit **30 jours** (A62).

La politique de session côté serveur (D27, `session-policy.ts`) borne la vie réelle de la session, indépendamment du cookie : **standard = 60 min d'inactivité, 7 jours de vie absolue ; rememberMe = 7 jours d'inactivité, 30 jours de vie absolue**. Le TTL Redis de la clé de session est recalculé à chaque rotation comme `min(fenêtre d'inactivité, vie absolue restante depuis createdAt)` : la rotation ne peut jamais repousser la session au-delà du plafond.

**Rotation.** `POST /auth/refresh` lit le cookie `refresh_token`, vérifie sa signature, cherche le `jti` en Redis (clé absente = session expirée ou révoquée → 401), **révoque l'ancien `jti`** et émet une nouvelle paire avec un nouveau `jti` et le **même `createdAt`**. Le libellé d'appareil de la connexion est conservé. Un refresh ne renvoie rien d'autre qu'un `{ success, message }` : les nouveaux jetons sont dans les cookies de la réponse.

**Révocation.** `POST /auth/logout` supprime le `jti` courant et efface les cookies. `GET /auth/me/sessions` liste les sessions du membre (la courante est marquée `current: true`), `DELETE /auth/me/sessions/{jti}` en coupe une (la sienne = déconnexion), `DELETE /auth/me/sessions` coupe toutes les autres. Le changement de mot de passe et le changement d'email révoquent toutes les autres sessions. Une sanction `SUSPENDED` révoque les sessions et fait répondre 401 à chaque lecture.

**Le mode Bearer (mobile, D36).** Les middlewares `isAuthenticated` et `isOptionallyAuthenticated` acceptent indifféremment le cookie `access_token` **ou** un en-tête `Authorization: Bearer <access_token>` (le cookie a priorité s'il est présent). C'est la porte prévue pour un client natif qui n'a pas de jar de cookies. 🚪 **Porte importante :** aujourd'hui, `POST /auth/login` et `POST /auth/refresh` ne renvoient les jetons **que dans des cookies `Set-Cookie`** ; le corps de la réponse ne contient pas les jetons, et `/auth/refresh` lit exclusivement le cookie `refresh_token`. Un client mobile devra donc, au choix, gérer un jar de cookies (ce que font les clients HTTP natifs d'iOS et d'Android) ou attendre la variante « jetons dans le corps » gravée pour le jalon 4 (D36 : « auth par tokens (refresh) — pas de cookies »). Un intégrateur `curl` utilise simplement un jar (`-c jar -b jar`), comme dans tous les exemples du chapitre 3.

**Ce que le middleware vérifie à chaque requête protégée** (`packages/middleware/isAuthenticated.ts`) : signature et expiration du JWT, existence du compte en base, `isDeleted` (→ 401 `ACCOUNT_DELETED`), `accountStatus === "SUSPENDED"` (→ 401 `ACCOUNT_SUSPENDED`). La requête est enrichie de `req.user` (le document `User` complet) et `req.roles`. Le corps des 401 de ce middleware est **plat** : `{ "message": "Unauthorized! Token missing." }`, éventuellement avec `code`.

**Compte restreint.** Le middleware `requireActiveAccount` est posé après `isAuthenticated` sur les seules routes de **création** : `POST /trips`, `POST /trips/{id}/publish`, `POST /deals/payment-intents`, `POST /deals`. Un compte `RESTRICTED` ou `SUSPENDED` y reçoit **403 `{ message, code: "ACCOUNT_RESTRICTED" }`** ; ses deals en cours continuent (les autres routes ne sont pas bloquées). Les sanctions ne font jamais l'objet d'une écriture inter-services : elles n'agissent que par les lectures.

**Authentification optionnelle.** `GET /users/{slug}/public`, `GET /trips/search` et `GET /trips/{id}/public` passent par `isOptionallyAuthenticated` : sans jeton, ou avec un jeton expiré, la route répond en mode « non connecté » (jamais 401) ; avec un jeton valide, la réponse est personnalisée (`isFavorite`, état d'abonnement, `hidden: true` pour le propriétaire d'un profil masqué).

### 2.2 Authentification du back-office : cookies `admin_*` et TOTP

Les sessions admin sont **séparées** des sessions membre (D54) : autres cookies, autre préfixe Redis (`admin_jti:`), autres revendications JWT. Un compte ADMIN connecté comme membre n'ouvre **aucune** route `/admin/*`.

Le parcours est en deux étapes :

1. `POST /auth/admin/login { email, password }` — exige `User.adminRoles` non vide ; pose le cookie **`admin_preauth`** (5 minutes) et répond `{ next: "TOTP" }` si la 2FA est déjà active, `{ next: "SETUP" }` sinon. Un compte sans profil admin reçoit 401.
2. `POST /auth/admin/totp/verify { code }` (code TOTP à 6 chiffres ou code de secours) — ou, au premier accès, `POST /auth/admin/totp/setup` (renvoie `secret` + `otpauthUrl` à scanner) puis `POST /auth/admin/totp/enable { code }`. En cas de succès, pose **`admin_access_token`** (15 min) et **`admin_refresh_token`** ; le JWT porte `adm: true` et `amr: ["pwd", "totp"]`.

`isAdminAuthenticated` (`packages/middleware/isAdminAuthenticated.ts`) lit **uniquement** `admin_access_token` (ou un Bearer), exige `adm === true` et `"totp" ∈ amr`, puis vérifie en base : compte non supprimé, rôle `ADMIN`, 2FA active (`totpEnabledAt`). Jeton absent, expiré ou incomplet → **401** ; compte qui ne remplit plus les conditions → **403** « Access denied. ». Il charge `req.adminRoles` (profils cumulés, union des permissions, D60 1A).

`requireAdminPermission("<permission>")` applique ensuite la **matrice `ADMIN_PERMISSIONS`** (`packages/libs/api-contracts/src/admin/admin-users.schema.ts`) : `SUPER_ADMIN` passe partout ; les autres profils (`MEDIATOR`, `SUPPORT`, `FINANCE`, `OPS`, `PRIVACY`) sont bornés permission par permission. Un refus est un **403 explicite** `{ message, code: "ADMIN_PERMISSION_DENIED", permission }` — jamais un 404 : la route existe, c'est le profil qui manque. Chaque route admin de la référence générée affiche sa permission (`x-permission`). Rotation et déconnexion : `POST /auth/admin/refresh`, `POST /auth/admin/logout` ; sessions : `GET /admin/me/sessions`, `DELETE /admin/me/sessions/{jti}`.

### 2.3 La fenêtre sudo : 403 `SUDO_REQUIRED` et rejeu

Les gestes sensibles d'un membre — changer son mot de passe (`POST /auth/me/password`), changer son email (`POST /auth/me/email/request`), ouvrir le tableau de bord Stripe (`POST /carrier/stripe/dashboard-link`), télécharger ses données (`POST /auth/me/data-export`), effacer son compte (`POST /auth/me/erasure`) — exigent une **fenêtre sudo** ouverte (D65 1A) :

1. `POST /auth/me/sudo/request` — envoie un code par email (portée OTP `sudo`).
2. `POST /auth/me/sudo/verify { code }` — ouvre une fenêtre de **15 minutes liée à la session courante** (`sudo:<userId>:<jti>` en Redis, le `jti` étant lu dans le cookie `refresh_token`). Une autre session du même membre n'en hérite pas. Réponse : `{ active: true, expiresAt }`.
3. `GET /auth/me/sudo` — état : `{ active, expiresAt | null }`.

Un geste sensible appelé sans fenêtre répond **403** via `requireSudo` (`apps/auth-service/src/utils/sudo.ts`) :

```json
{ "status": "error", "message": "Sudo required: confirm with the code sent by email.", "details": { "code": "SUDO_REQUIRED", "windowMinutes": 15 } }
```

Le client ouvre alors la porte (demande + vérification du code), puis **rejoue exactement le même appel**. C'est ce que fait le composant `SudoGate` du front. 🚪 **Porte de durcissement :** le middleware d'erreurs n'expose `details` en production que si `details.type` appartient à la liste « safe » (§2.6) ; l'erreur `SUDO_REQUIRED` porte un `code` mais pas de `type`. Hors production le client reçoit bien `details.code` ; **avant la mise en production**, il faudra soit ajouter un `type` reconnu à cette erreur, soit étendre la liste — sans quoi le front ne pourrait plus distinguer ce 403 d'un autre. La même remarque vaut pour les codes `DELIVERY_CODE_IN_MESSAGE` et `TOO_EARLY` du message-service (§4).

### 2.4 Locale : `x-locale` et `preferredLocale`

La liste des langues est unique (`packages/libs/api-contracts/src/locale.ts`) : `SUPPORTED_LOCALES = ["fr", "en"]`, défaut `fr`. Le client envoie la langue de son interface dans l'en-tête **`x-locale`** à chaque requête (le client axios du front le fait par un intercepteur ; `apiFetch` par `localeHeaders()`). `resolveLocale` est tolérant : `fr-FR`, `FR`, `en-US,en;q=0.9` sont ramenés à `fr` / `en` ; absent ou inconnu → `fr`.

Règle d'usage : **la langue d'un email est celle du destinataire** (`User.preferredLocale`), jamais celle de l'appelant. L'en-tête `x-locale` ne sert que pour les flux **sans compte** (OTP d'inscription, mot de passe oublié) et pour initialiser `preferredLocale` à l'inscription. Le membre change sa langue par `PATCH /auth/me/locale { locale }` (400 `LOCALE_UNSUPPORTED` sinon). La recherche accepte en plus un paramètre `locale` (`fr` | `en`) qui pilote le **formatage serveur des dates** dans les cartes de résultat.

### 2.5 Identifiant de corrélation

Le gateway pose l'en-tête **`x-correlation-id`** (UUID v4) sur toute requête qui n'en apporte pas ; `express-http-proxy` le transmet aux services. Le deal-service, le notification-service et le message-service le reprennent comme identifiant de requête (pino-http) et **le renvoient dans la réponse** ; il est copié dans chaque événement outbox (`correlationId`) et suit donc la transition jusqu'aux consommateurs Kafka, et jusqu'à Sentry en cas de 5xx. Un client qui veut corréler ses propres journaux avec le support peut fournir son propre identifiant ; il doit surtout **journaliser celui de la réponse** à côté de toute erreur remontée aux utilisateurs.

### 2.6 Format des erreurs : quatre formes, une seule à traduire

La plateforme a **quatre formes** d'erreur, toutes fidèles au code réel (`packages/error-handler`, `common.ts`) :

1. **`ErrorResponse`** — toute `AppError` sérialisée par `errorMiddleware` : `ValidationError` 400, `AuthError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409, `RateLimitError` 429, `DatabaseError` 500.
   ```json
   { "status": "error", "message": "…", "errors": { "champ": "message" }, "details": { "type": "booking", "code": "QUOTE_DIVERGENCE", "…": "…" } }
   ```
   - `errors` (facultatif) : erreurs par champ, exposé quand `details.errors` est présent — pour les formulaires.
   - `details` (facultatif) : contexte structuré. **En production, il n'est exposé que si `details.type` appartient à la liste safe** : `otp`, `booking`, `password`, `register`, `locale`, `favorite`, `oauth`. Hors production, tout `details` est exposé (débogage). Les traces de pile ne sortent jamais.
2. **`UnhandledError`** — exception hors `AppError` : `{ "status": "error", "error": "Something went wrong, please try again!" }` (champ `error`, pas `message`). Capturée par Sentry.
3. **`UnauthorizedResponse`** — les 401 et 403 émis **directement** par les middlewares d'authentification, hors `errorMiddleware` : `{ "message": "…" }`, parfois avec `code` (`ACCOUNT_DELETED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_RESTRICTED`, `ADMIN_PERMISSION_DENIED` + `permission`).
4. **Réponses du gateway** — 429 du limiteur `{ "error": "Too many requests, please try again later!" }` ; 503 de maintenance `{ "code": "MAINTENANCE", "message", "messages": { "fr", "en" }, "retryAfterSeconds": 300 }`.

À cela s'ajoutent deux réponses typées renvoyées hors middleware par des contrôleurs : `PublicNotFound` (404 de `GET /trips/{id}/public`) et `ErasureBlockedResponse` (409 de `POST /auth/me/erasure` : `{ code: "ERASURE_BLOCKED", blockers, counts }`).

**Règle d'or pour un client : ne jamais afficher `message` tel quel.** Les messages sont en anglais et techniques. Le client construit ses propres libellés, dans la langue de l'utilisateur, à partir du **statut HTTP**, de **`details.code`** (ou `code`) et des données structurées (`attemptsLeft`, `lockUntilSeconds`, `blockers`, `cap`, `limit`…). Le catalogue du chapitre 4 est fait pour cela.

⚠️ **Note sémantique du trip-service** : ses contrôleurs historiques lèvent `ValidationError` (→ **400**) pour presque tout, y compris « Trip not found. » et « Unauthorized. » (propriété). Un client du trip-service doit donc traiter un 400 comme « la demande est refusée » et lire `message` pour distinguer, en attendant la PR de bascule vers 403/404 (🚪 `fix/error-semantics`, cataloguée). Les autres services respectent la sémantique ci-dessous.

### 2.7 Sémantique des statuts

| Statut | Sens dans Yamba | Réaction attendue du client |
|---|---|---|
| **200 / 201** | Succès. 201 pour une création (`POST /deals`, `POST /trips`, `POST /reports`, un message posté, une notation…). | Lire le corps ; pour un deal, se fier à `allowedActions`. |
| **400** | Requête malformée (Zod), `ObjectId` invalide, règle de forme (photo manquante, description trop courte), et — trip-service — toute erreur métier. Codes typés possibles : `OWN_TARGET`, `REASON_NOT_ALLOWED`, `DELIVERY_CODE_IN_MESSAGE`, `LOCALE_UNSUPPORTED`, OTP (`OTP_INCORRECT`…). | Corriger la saisie ; afficher `errors` par champ ; ne pas réessayer à l'identique. |
| **401** | Pas de session valide : jeton absent, expiré, révoqué ; compte effacé ou suspendu ; OTP faux ou expiré ; identifiants invalides. | Si la requête exigeait une session : tenter **un** refresh puis rejouer ; si le refresh échoue, considérer l'utilisateur déconnecté (voir §6.1). Pour un OTP : proposer de redemander un code. |
| **403** | Authentifié mais interdit : pas partie au deal, pas propriétaire du trajet, compte restreint (`ACCOUNT_RESTRICTED`), fenêtre sudo fermée (`SUDO_REQUIRED`), profil admin sans permission, conversation inexistante avant l'acceptation. | Ne jamais réessayer aveuglément. `SUDO_REQUIRED` → ouvrir la porte puis rejouer ; sinon expliquer et rediriger. |
| **404** | Ressource inexistante, supprimée, invisible pour l'appelant (trajet masqué, profil masqué, lien de suivi révoqué). **Un 404 ne dit jamais si la ressource existe pour quelqu'un d'autre.** | Page « introuvable » ; retirer l'élément du cache local. |
| **409** | Conflit métier : la machine à états a refusé, une écriture concurrente a gagné, une limite est atteinte, un doublon existe. Presque toujours porteur d'un `details.code` (`type: "booking"`). | Recharger la ressource (`GET /deals/{id}`), afficher le libellé du code, proposer l'action que `allowedActions` autorise désormais. |
| **429** | Trop de requêtes (limiteur du gateway) ou trop de tentatives OTP (`RateLimitError`, verrou par paliers). | Respecter `RateLimit-Reset` / `lockUntilSeconds` ; ne pas boucler. |
| **501** | Webhook Stripe non configuré (`STRIPE_WEBHOOK_SECRET` absent). | Configuration serveur, pas une erreur client. |
| **503** | Maintenance (écritures bloquées, `code: "MAINTENANCE"`, `Retry-After: 300`) ; plateforme dégradée sur `/api/status` ; webhook email non configuré. | Afficher le bandeau (`messages.fr` / `.en`), garder la saisie, réessayer après `retryAfterSeconds`. |

### 2.8 Limiteur de débit

Le gateway applique `express-rate-limit` **après** `/api/status` et avant tout proxy : fenêtre de **15 minutes**, **100 requêtes** par adresse IP (`trust proxy` activé). Les réponses en échec ne sont pas comptées (`skipFailedRequests`), et les en-têtes standards `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` sont renvoyés. Au-delà : **429** `{ "error": "Too many requests, please try again later!" }`. 🚪 Le limiteur prévoit 1 000 requêtes pour une requête « authentifiée » (`req.user`), mais le gateway ne décode pas les jetons : cette branche est inerte aujourd'hui, la limite effective est 100 pour tous. Un client qui charge une page riche (liste + notifications + conversations) doit **mutualiser** ses appels et **ne pas boucler** sur un 401 (le disjoncteur du front existe précisément pour cela, §6.1).

Des limiteurs **métier** s'ajoutent côté services : verrou OTP par paliers (5 essais → 1 min, puis 30 min, puis 24 h ; email d'alerte de sécurité dès le deuxième palier ; 6 renvois de code par heure), verrou du code de livraison (3 échecs → 15 min), relance email des messages non lus (au plus une par heure et par conversation), 20 alertes de route par membre, 5 régénérations de code par deal.

### 2.9 Mode maintenance (503 `MAINTENANCE`)

Le gateway relit toutes les 10 s le document `PlatformSettings` clé `maintenance` (réglé par l'admin via `PUT /admin/maintenance`), avec repli sur la dernière valeur connue ; la variable `MAINTENANCE_MODE=on` l'emporte sur la base (pour le jour où Mongo est la panne). En maintenance, **seules les écritures** (`POST`, `PUT`, `PATCH`, `DELETE`) sont refusées, **sauf** sous `/api/auth/`, `/api/admin/` et `/api/maintenance` — un membre peut donc se connecter et l'admin lever la maintenance. Réponse : **503**, `Retry-After: 300`, corps `{ code: "MAINTENANCE", message, messages: { fr, en }, retryAfterSeconds: 300 }`. Les lectures continuent normalement.

### 2.10 Pagination par curseur

Il n'y a **jamais** de pagination par numéro de page. Trois formes coexistent :

- **Recherche de trajets** — `GET /trips/search?…&cursor=<nextCursor>&limit=<n>` : la réponse porte `nextCursor` (id du dernier trajet de la page, `null` en dernière page) et `totalCount`.
- **Journal admin** — `GET /admin/audit?cursor=<id du dernier élément>` : plus récents en premier.
- **Fil de conversation** — `GET /messages/conversations/{id}?cursor=<id du plus ancien message chargé>` : le curseur charge les messages **plus anciens** ; la page est rendue du plus ancien au plus récent.

Les listes sans curseur sont bornées côté serveur (par exemple `GET /me/notifications` : les **50** dernières + `unreadCount`) ou filtrées (`?status=`).

### 2.11 Montants, devises, dates, identifiants

- **Tout montant est un entier en centimes**, accompagné d'un code de devise (`currencyCode`, ISO 4217) : `totalShipperCents`, `transportCents`, `pricePerKgCents`, `refundAmountCents`, `payoutAmountCents`… Jamais de flottant. **Exception assumée et documentée** : les **cartes de résultat de recherche** (`YambaTripResult`) exposent des prix en **unités** (`minPrice`, `pricePerKg`, `totalForWeight`, en euros, déjà divisés par 100) et un **symbole** de devise (`currency`) : c'est un DTO d'affichage, pas une donnée de calcul.
- Le **devis** d'une réservation est **recalculé côté serveur** (D34) et **figé** dans le `Booking` (D17) : le client envoie `expectedTotalCents` (ce qu'il a affiché) et le serveur refuse toute divergence (409 `QUOTE_DIVERGENCE`).
- Les **dates** sont des chaînes **ISO 8601 en UTC** (`2026-09-20T08:30:00.000Z`), sauf les champs explicitement « locaux » d'un trajet (`departureDateLocal`, `departureTimeLocal` + fuseau `originTimezone`) et les dates **formatées serveur** des cartes de recherche (`travelDate`, `departureTime`, pilotées par `locale`).
- Les **identifiants** sont des `ObjectId` MongoDB sérialisés (24 caractères hexadécimaux) ; un identifiant malformé donne 400. Les membres sont désignés publiquement par leur **slug** (`/users/{slug}/public`, `targetRef` d'un signalement), jamais par leur id.

### 2.12 Idempotence et rejeu

- **Intention de paiement** : `POST /deals/payment-intents` ne persiste rien ; une intention abandonnée expire chez le fournisseur. `POST /deals` consomme `paymentIntentId` **une seule fois** : rejouer la création avec la même intention donne 409 `PAYMENT_ALREADY_USED`. Un client qui perd la réponse d'un `POST /deals` doit **relire `GET /me/bookings`** plutôt que recréer.
- **Versement** : le transfert Stripe au Voyageur porte une clé d'idempotence égale à l'id du deal ; un rejeu par le cron ne paie jamais deux fois.
- **Emails** : `sendTransactionalEmail` accepte `idempotencyKey` ; les envois déclenchés par les événements sont dédoublonnés par `eventId` (§5.3).
- **Favoris** : `POST` / `DELETE /trips/{id}/favorite` sont idempotents.
- **Lien de suivi** : un seul par deal, `POST /deals/{id}/tracking-link` renvoie l'existant.
- **Lecture d'une conversation** : `GET /messages/conversations/by-deal/{bookingId}` **crée** la conversation au premier accès et la renvoie ensuite.
- **Transitions** : toute transition d'un deal est une **écriture conditionnelle** (statut attendu + verrou optimiste sur `updatedAt`) ; un rejeu concurrent perd et reçoit 409 `TRANSITION_NOT_ALLOWED`. Rejouer une transition déjà appliquée n'est donc jamais destructif.

### 2.13 CORS, même origine et test en réseau local

Le gateway autorise les origines `http://localhost:3000` (user-ui), `http://localhost:3001` (admin-ui), et les mêmes ports sur `192.168.x.x` et `10.x.x.x` — avec `credentials: true`. **Les requêtes sans en-tête `Origin` (curl, serveur à serveur) sont acceptées.** Un front servi depuis une autre origine reçoit une erreur « Not allowed by CORS » (500).

En développement et en recette, la configuration recommandée (D48) est la **même origine** : `next.config.js` proxifie `/api/*` vers le gateway quand `API_PROXY_TARGET=http://localhost:8080` est posé, et le navigateur appelle `NEXT_PUBLIC_API_BASE_URL=/api`. Les cookies sont alors first-party sur n'importe quel hôte (poste, IP LAN, téléphone) ; l'en-tête `Origin` du navigateur traverse le proxy, d'où la présence des IP privées dans la liste. La configuration historique (URL absolue `http://<hôte>:8080/api`) reste possible, à condition que **tous** les appareils utilisent le même hôte pour le front et l'API : un front sur `localhost` avec une API sur l'IP LAN donne un login 200 suivi d'un `/auth/me` 401 (cookies liés à l'hôte).

---

## 3. Guides pas à pas

Conventions communes à tous les exemples de ce chapitre :

- `BASE=http://localhost:8080/api` (le gateway). Les chemins sont donnés **côté client** ; la mention « répond : *service* » indique le service réellement atteint derrière le proxy.
- Les sessions membres sont tenues dans un **jar de cookies** : `-c jar.txt` pour enregistrer les `Set-Cookie`, `-b jar.txt` pour les renvoyer. Un client natif ferait la même chose avec un jar, ou (porte D36) avec un en-tête `Authorization: Bearer …`.
- Chaque appel envoie `x-locale` : c'est la langue des emails **sans compte** et de la première `preferredLocale`.
- Les identifiants (`665f…`) et les codes (`482913`) sont des exemples ; les vraies valeurs viennent des réponses précédentes ou des emails reçus (Mailpit en local).
- Les réponses sont abrégées (`…`) quand la référence du chapitre 7 en donne la forme complète.

### 3.1 Inscription → vérification OTP → connexion → `/auth/me`

**Étape 1 — démarrer l'inscription** (répond : auth-service). Le consentement est obligatoire : versions des CGU et de la politique de confidentialité. La demande vit **10 minutes en Redis** ; rien n'est écrit en base avant la vérification.

```bash
curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" -H "x-locale: fr" \
  -d '{
    "firstName": "Awa", "lastName": "Diallo",
    "email": "awa.diallo@example.com", "password": "Kinshasa-2026!",
    "termsAccepted": true, "termsVersion": "2026-06-01", "privacyVersion": "2026-06-01"
  }'
```

Réponse `200` :

```json
{ "message": "OTP sent to your email. Please verify your account.", "verificationToken": "3f1c…" }
```

Erreurs : `400` (champ manquant, mot de passe trop faible — `details.type: "password"` avec un code de règle tel que `PASSWORD_CONTAINS_PERSONAL_INFO`, ou `details.type: "register"`), `409` (email déjà utilisé — proposer la connexion ou le mot de passe oublié), `429` (verrou anti-spam : 6 envois de code par heure ; lire `details.lockUntilSeconds`).

**Étape 2 — vérifier le code reçu par email** (répond : auth-service). Le `verificationToken` identifie la demande en attente ; l'`otp` est le code à six chiffres.

```bash
curl -s -X POST "$BASE/auth/register/verify" \
  -H "Content-Type: application/json" -H "x-locale: fr" \
  -d '{ "verificationToken": "3f1c…", "otp": "482913" }'
```

Réponse `201` : `{ "success": true, "message": "Account created successfully" }` — le `User` et le `ConsentLog` sont écrits, l'email de bienvenue part ; **aucune session n'est ouverte** à cette étape (le membre se connecte ensuite). Erreurs : `401` code faux ou expiré avec `details.type: "otp"` — c'est le cas à traiter avec soin :

```json
{ "status": "error", "message": "Incorrect code. 4 attempt(s) left before this code is invalidated.",
  "details": { "type": "otp", "code": "OTP_INCORRECT", "attemptsLeft": 4, "locked": false } }
```

Le client construit son message depuis `code`, `attemptsLeft`, `lockUntilSeconds` et `otpInvalidated` — jamais depuis `message`. Après 5 échecs le code est **invalidé** (`OTP_INVALIDATED`) et un verrou d'une minute s'applique (`OTP_LOCKED`, 429 avec `lockUntilSeconds`), puis 30 minutes, puis 24 heures ; un email d'alerte de sécurité part dès le deuxième palier. Pour recevoir un nouveau code : `POST /auth/register/resend { verificationToken }` ; pour abandonner : `POST /auth/register/cancel { verificationToken }`.

**Étape 3 — se connecter** (répond : auth-service). `rememberMe: true` allonge le cookie de rafraîchissement à 30 jours (session rememberMe : 7 jours d'inactivité, 30 jours de vie absolue).

```bash
curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" -H "x-locale: fr" -c jar.txt \
  -d '{ "email": "awa.diallo@example.com", "password": "Kinshasa-2026!", "rememberMe": true }'
```

Réponse `200` :

```json
{ "message": "Login successful!",
  "user": { "id": "665f1c2ab3d4e5f6a7b8c9d0", "email": "awa.diallo@example.com", "firstName": "Awa", "lastName": "Diallo", "roles": ["USER"] } }
```

Les jetons sont dans les en-têtes `Set-Cookie` (`access_token` 15 min, `refresh_token` 30 jours), pas dans le corps. Erreurs : `401` identifiants invalides **ou compte suspendu** (même statut : ne pas révéler lequel), `400` corps invalide. Variante Google (D47) : `POST /auth/google { credential, rememberMe?, consent? }` — un nouveau compte sans `consent` reçoit `status: "CONSENT_REQUIRED"` sans rien créer ; le client redemande le consentement puis rappelle avec `consent: { termsVersion, privacyVersion }`.

**Étape 4 — lire le membre courant** (répond : auth-service).

```bash
curl -s "$BASE/auth/me" -b jar.txt -H "x-locale: fr"
```

Réponse `200` : `{ "success": true, "user": { …le document User sans passwordHash… }, "roles": ["USER"] }`. Un `401` ici signifie que le jeton d'accès a expiré (15 min) : le client appelle `POST /auth/refresh` **une fois**, puis rejoue :

```bash
curl -s -X POST "$BASE/auth/refresh" -b jar.txt -c jar.txt
curl -s "$BASE/auth/me" -b jar.txt
```

Si le refresh répond `401` (« Session expired or invalid »), la session est finie : inactivité dépassée, plafond absolu atteint, `jti` révoqué depuis un autre appareil, mot de passe changé. Le client passe à l'état « déconnecté » et n'insiste pas (disjoncteur de 30 s dans le front, §6.1). Déconnexion : `POST /auth/logout -b jar.txt`.

**Mot de passe oublié**, même mécanique OTP : `POST /auth/password/forgot { email }` répond **toujours 200** (ne révèle pas l'existence du compte), puis `POST /auth/password/verify { email, otp }` → jeton de réinitialisation, puis `POST /auth/password/reset { … }` ; `POST /auth/password/resend` renvoie un code.

### 3.2 Devenir Voyageur : profil, Stripe Connect, activation

Un membre publie des trajets une fois son **onboarding Voyageur** terminé. Trois routes (répondent : auth-service), toutes sous session :

```bash
# 1. Le profil public de transporteur (crée ou met à jour la CarrierPage)
curl -s -X POST "$BASE/carrier/onboarding/profile" -b jar.txt \
  -H "Content-Type: application/json" \
  -d '{ "name": "Awa D.", "bio": "Paris ⇄ Kinshasa tous les mois.", "phoneE164": "+33612345678",
        "address": { "formattedAddress": "12 rue de la Paix, 75002 Paris, France", "city": "Paris", "country": "France", "countryCode": "FR", "lat": 48.8687, "lng": 2.3312 } }'
# → 200 { "success": true, "message": "…", "carrierPage": { "onboardingStep": "…", "stripeOnboardingComplete": false, … } }

# 2. Le lien d'onboarding Stripe Connect (compte Express créé au premier appel ; URL à usage unique, jamais stockée)
curl -s -X POST "$BASE/carrier/onboarding/stripe" -b jar.txt
# → 200 { "success": true, "url": "https://connect.stripe.com/setup/e/acct_…/…" }

# 3. Après le retour de Stripe : l'état du compte
curl -s "$BASE/carrier/onboarding/stripe/status" -b jar.txt
# → 200 { "success": true, "status": "complete", "chargesEnabled": true, "payoutsEnabled": true, "detailsSubmitted": true }

# 4. Terminer : accorde le rôle CARRIER et envoie l'email de fin d'onboarding
curl -s -X POST "$BASE/carrier/onboarding/complete" -b jar.txt
# → 200 { "success": true, "message": "…" }
```

Le client redirige l'utilisateur vers l'URL Stripe (navigateur système sur mobile), puis **interroge `stripe/status`** au retour. `status` vaut `not_started`, `pending` ou `complete`. Les drapeaux (`chargesEnabled`, `payoutsEnabled`) sont ensuite **maintenus par le webhook Stripe `account.updated`** (§5.1) sans que le Voyageur repasse par l'onboarding. Plus tard, le tableau de bord Express (IBAN, historique) s'ouvre par `POST /carrier/stripe/dashboard-link` — **sous sudo** (403 `SUDO_REQUIRED` sinon, 409 `STRIPE_ACCOUNT_MISSING` s'il n'y a pas encore de compte).

Deux portes métier dépendent de cet état : la **publication d'un trajet** (le trip-service exige onboarding + `chargesEnabled`) et surtout **l'acceptation d'un deal** (D31 : la porte est vérifiée à l'acceptation, 409 `CARRIER_ONBOARDING_REQUIRED`).

### 3.3 Publier un trajet

Le trajet naît en **brouillon**, éventuellement incomplet, puis est **publié** ; ou est créé directement publié avec `publish: true` si les portes passent. Répond : trip-service (`/api/trips` → `/trips`). Les montants sont en **centimes**.

```bash
curl -s -X POST "$BASE/trips" -b jar.txt -H "Content-Type: application/json" -d '{
  "transportMode": "PLANE", "tripType": "ONE_WAY",
  "originLabel": "Paris-Charles de Gaulle (CDG)", "originCity": "Paris", "originCountry": "France", "originCountryCode": "FR",
  "originLat": 49.0097, "originLng": 2.5479, "originTimezone": "Europe/Paris",
  "destinationLabel": "Kinshasa N'djili (FIH)", "destinationCity": "Kinshasa", "destinationCountry": "RD Congo", "destinationCountryCode": "CD",
  "destinationLat": -4.3857, "destinationLng": 15.4446, "destinationTimezone": "Africa/Kinshasa",
  "departureAt": "2026-10-12T20:30:00.000Z", "arrivalAt": "2026-10-13T05:10:00.000Z",
  "flightType": "DIRECT",
  "acceptedCategories": ["CLOTHES", "DOCUMENTS", "BOOKS", "PHONE"],
  "pricePerKgCents": 1200, "capacityKg": 15,
  "checkedBag23PriceCents": null, "cabinBag12PriceCents": 6000,
  "familyConditions": [{ "familyKey": "ELECTRONICS_DEVICES", "mode": "SURCHARGE", "surchargePct": 20 }],
  "pickupLocations": [{ "kind": "AIRPORT", "details": "Terminal 2E, hall de départ", "flexibility": "EXACT" }],
  "deliveryLocations": [{ "kind": "AIRPORT", "details": "Arrivées, sortie principale", "flexibility": "EXACT" },
                        { "kind": "CITY_AREA", "details": "Gombe", "flexibility": "RADIUS", "radiusKm": 5 }],
  "instantBooking": false, "maxSlots": null, "publish": false
}'
```

Réponse `201` : `{ "success": true, "message": "…", "trip": { "id": "66a0…", "status": "DRAFT", "pricingModel": "PER_KG", "minPriceCents": …, … } }` (`minPriceCents` et `departureHourLocal` sont recalculés côté serveur). Puis :

```bash
curl -s -X POST "$BASE/trips/66a0…/publish" -b jar.txt
# → 200 { "success": true, "message": "Trip published" }
```

Portes de publication, toutes refusées en **400** avec le message de la machine (`canPerform`) : onboarding Voyageur incomplet, Stripe sans `chargesEnabled`, champs requis manquants (mode, villes, départ futur, ≥ 1 catégorie), moins d'un point de récupération ou de remise, `capacityKg` absent avec `pricePerKgCents` (porte A28). Un compte `RESTRICTED` reçoit **403 `ACCOUNT_RESTRICTED`** (middleware, avant le contrôleur). Le cycle de vie continue par `pause`, `resume`, `unpublish`, `cancel`, `restore`, `archive` ; `GET /trips/my?status=PUBLISHED` liste ses trajets **avec `allowedActions`** — le client n'affiche que les boutons présents dans cette liste. `PUT /trips/{id}` modifie (la capacité est immuable après publication). Les documents de trajet (billet à vérifier) passent par un upload direct ImageKit puis `POST /trips/{id}/documents` ; la vérification est faite par le support (`/admin/tickets`).

### 3.4 Rechercher, lire un trajet public, le mettre en favori

La recherche est **publique** (répond : trip-service) ; connecté, elle personnalise `isFavorite`. Filtres durs non négociables : `status=PUBLISHED`, départ futur, trajets masqués par Yamba exclus.

```bash
curl -s "$BASE/trips/search?from=Paris&to=Kinshasa&dateFrom=2026-10-01&mode=plane&categories=clothes,documents&sort=earliest&locale=fr&limit=20" \
  -H "x-locale: fr" -b jar.txt
```

Réponse `200` (enveloppe **sans** `success`) :

```json
{ "trips": [ { "id": "66a0…", "fromCity": "Paris", "toCity": "Kinshasa", "travelDate": "dim. 12 oct.", "departureTime": "22:30",
               "pricePerKg": 12, "remainingKg": 15, "minPrice": 0, "currency": "€", "transportMode": "plane",
               "allowedCategories": ["clothes","documents","books","phone"], "travelerFirstName": "Awa", "travelerLastName": "D.",
               "rating": 4.8, "reviewCount": 12, "isFavorite": false, "viewsCount": 37 } ],
  "nextCursor": null, "totalCount": 1 }
```

Les catégories et le mode sont en **convention UI** (`clothes`, `plane`) et non en enum Prisma (`CLOTHES`, `PLANE`) ; les valeurs invalides sont ignorées silencieusement. Avec `weightKg=3`, chaque carte porte en plus `transportForWeight` et `totalForWeight` (en euros). `GET /trips/search/facets` donne les compteurs par filtre ; `GET /trips/pricing/params` (public) donne commission, planchers, coefficients — le wizard calcule le même devis que le serveur (D34).

```bash
curl -s "$BASE/trips/66a0…/public" -H "x-locale: fr" -b jar.txt
# → 200 { "success": true, "trip": { origin, destination, dates, tripper: { firstName, lastInitial, … }, pricing, locations, … } }
# → 404 { PublicNotFound } si inexistant, supprimé, non publié ou masqué par Yamba ; 400 si l'id n'est pas un ObjectId
curl -s -X POST "$BASE/trips/66a0…/favorite" -b jar.txt     # idempotent ; 409 OWN_TRIP / TRIP_NOT_FAVORITABLE (details.type "favorite")
curl -s "$BASE/trips/favorites" -b jar.txt
```

### 3.5 Réserver et vivre le deal : de l'intention de paiement à la notation

C'est le parcours central. Tous les appels de cette section répondent : **deal-service**. Deux acteurs : l'**Expéditeur** (jar `shipper.txt`) et le **Voyageur** propriétaire du trajet (jar `carrier.txt`). Le deal traverse les statuts `PENDING → ACCEPTED → PICKED_UP → DELIVERED → COMPLETED` (fins alternatives : `DECLINED`, `EXPIRED`, `CANCELLED`, `DISPUTED`). Règle absolue : **le client reflète `allowedActions`, il ne décide jamais** ; toute limite est appliquée côté serveur.

**Étape 1 — l'intention de paiement (D37, étape 1 de 2).** Le serveur recalcule le devis avec le moteur unique et **autorise** le montant chez le fournisseur (capture manuelle). Rien n'est persisté. `expectedTotalCents` est ce que l'Expéditeur a **vu** à l'écran.

```bash
curl -s -X POST "$BASE/deals/payment-intents" -b shipper.txt -H "Content-Type: application/json" -d '{
  "tripId": "66a0…", "product": "PARCEL", "family": "CLOTHES_TEXTILE", "sizeClass": "M", "weightKg": 3,
  "protection": "BASIC", "expectedTotalCents": 4032
}'
```

Réponse `201` :

```json
{ "provider": "STRIPE", "paymentIntentId": "pi_3P…", "clientSecret": "pi_3P…_secret_…",
  "amountCents": 4032, "currencyCode": "EUR",
  "quote": { "pricingModel": "PER_KG", "weightKg": 3, "pricePerKgCents": 1200, "sizeClass": "M", "sizeCoef": 1.1,
             "transportCents": 3600, "commissionPct": 12, "commissionCents": 432, "premiumCents": 0,
             "serviceCents": 432, "totalShipperCents": 4032, "currencyCode": "EUR" } }
```

Le client confirme ensuite le paiement avec `clientSecret` (Payment Element sur le web, Payment Sheet sur mobile). Avec le fournisseur `FAKE` (hors production seulement), `clientSecret` est `null` et l'autorisation est immédiate. Erreurs `409` (`details.type: "booking"`) : `QUOTE_DIVERGENCE` (le prix a changé : **rafraîchir le devis et ré-afficher, jamais débiter un montant non vu**), `FAMILY_REFUSED`, `CAPACITY_EXCEEDED`, `TRIP_NOT_BOOKABLE`, `OWN_TRIP`, `NEW_ACCOUNT_CAP` (plafond progressif D71 : `details.cap` ∈ `DECLARED_VALUE` | `WEIGHT` | `SHIPMENTS_PER_MONTH`, `limit`, `value`). `403 ACCOUNT_RESTRICTED` pour un compte restreint. `400` si le devis est impossible (`errors.quote` porte le code du moteur).

**Étape 2 — créer la demande (`PENDING`).** Même saisie + `paymentIntentId` + description, valeur déclarée, destinataire, lieux choisis parmi ceux du trajet, chartes acceptées. En **une transaction Mongo** : réservation conditionnelle des kilos (CAP-01), `Booking` avec cinq instantanés figés (trajet, prix, colis, destinataire, lieux), deux événements outbox (`booking.requested`, `booking.payment_authorized`).

```bash
curl -s -X POST "$BASE/deals" -b shipper.txt -H "Content-Type: application/json" -d '{
  "tripId": "66a0…", "paymentIntentId": "pi_3P…", "expectedTotalCents": 4032,
  "product": "PARCEL", "family": "CLOTHES_TEXTILE", "sizeClass": "M", "weightKg": 3, "protection": "BASIC",
  "description": "Deux pagnes et un boubou brodé, emballés sous vide.",
  "declaredValueCents": 15000, "photoUrls": ["https://ik.imagekit.io/yamba/parcels/pagne-1.jpg"],
  "recipient": { "firstName": "Marie", "lastName": "Kabeya", "phoneE164": "+243812345678", "email": "marie.k@example.com" },
  "pickupPlace": { "kind": "AIRPORT", "details": "Terminal 2E" }, "deliveryPlace": { "kind": "CITY_AREA", "details": "Gombe" },
  "charterAccepted": true, "termsAccepted": true
}'
```

Réponse `201` : `{ "bookingId": "66b1…", "status": "PENDING", "expiresAt": "2026-09-07T10:15:00.000Z", "totalShipperCents": 4032, "currencyCode": "EUR" }`. Le Voyageur est notifié par le relais (push + email avec l'échéance) ; la **fenêtre d'acceptation de 24 h** court (DEA-01) — passée, un cron ferme le deal en `EXPIRED` et libère l'autorisation. Erreurs `409` supplémentaires : `PAYMENT_NOT_AUTHORIZED` (le paiement n'a pas été confirmé côté client), `PAYMENT_MISMATCH` (montant ou devise différents de l'autorisation), `PAYMENT_ALREADY_USED` (intention déjà consommée : **relire `GET /me/bookings`** plutôt que recréer).

**Étape 3 — lire le deal, dans la vue de son rôle.** La forme du DTO dépend du rôle de l'appelant ; les deux vues sont des listes blanches strictes.

```bash
curl -s "$BASE/deals/66b1…" -b shipper.txt
# → 200 { "success": true, "viewerRole": "SHIPPER", "deal": { "status": "PENDING", "pricing": {…complet…}, "recipient": {…},
#          "carrier": { firstName, … }, "expiresAt", "allowedActions": ["cancel"], "cancellationPreview": {…}, "deliveryCode": null, … } }
curl -s "$BASE/deals/66b1…" -b carrier.txt
# → 200 { "success": true, "viewerRole": "CARRIER", "deal": { "status": "PENDING", "pricing": { "transportCents": 3600, "currencyCode": "EUR", … }, "shipper": {…}, "allowedActions": ["accept","decline"], … } }
#   (jamais de code de livraison, jamais de hash, jamais les totaux Expéditeur dans la vue Voyageur)
```

`403` si l'appelant n'est ni l'Expéditeur ni le Voyageur ; `404` si le deal n'existe pas. Listes : `GET /me/bookings?status=PENDING` (Expéditeur), `GET /me/deals` (Voyageur, tous trajets), `GET /deals?tripId=66a0…` (Voyageur, un trajet), `GET /me/wallet` (portefeuille).

**Étape 4 — accepter (Voyageur).** La charte du transporteur doit être cochée ; la **porte D31** (profil complet + Stripe) est vérifiée ici ; le paiement est **capturé** maintenant (une autorisation expire en ~7 jours), puis, en une transaction conditionnelle, `PENDING → ACCEPTED` + outbox `booking.accepted`. La **conversation** du deal devient disponible (§3.6).

```bash
curl -s -X POST "$BASE/deals/66b1…/accept" -b carrier.txt -H "Content-Type: application/json" -d '{ "charterAccepted": true }'
# → 200 { "bookingId": "66b1…", "status": "ACCEPTED", "refundAmountCents": null, "currencyCode": "EUR" }
```

Erreurs `409` : `TRANSITION_NOT_ALLOWED` (déjà accepté, expiré, annulé, ou écriture concurrente — `details.reason` porte le motif de la machine), `CARRIER_ONBOARDING_REQUIRED` (envoyer le Voyageur terminer son onboarding, §3.2), `PAYMENT_STATE_CONFLICT` (l'autorisation n'est plus capturable : l'Expéditeur doit refaire une demande). Alternatives : `POST /deals/{id}/decline { "reason": "TIMING" }` (motif facultatif parmi 5 ; remboursement intégral), et côté Expéditeur `POST /deals/{id}/cancel { "reason": "…" }` — remboursement intégral tant que le deal est `PENDING` ou dans les 48 h suivant l'acceptation, retenue de 50 % au-delà (ANN-01, valeurs réglables par l'admin) ; `cancellationPreview` dans la vue Expéditeur annonce le montant **avant** le geste, et la réponse rend `refundAmountCents`.

**Étape 5 — récupérer le colis (Voyageur).** Les 5 points d'inspection sont **tous** obligatoires (CNF-04) et 1 à 5 photos doivent déjà être sur ImageKit (upload direct signé, §3.10 ; aucun octet ne passe par l'API). `ACCEPTED → PICKED_UP`, et le serveur **génère le code de livraison** à six chiffres, stocké deux fois (bcrypt pour la validation, AES-256-GCM pour le ré-affichage à l'Expéditeur — D43).

```bash
curl -s -X POST "$BASE/deals/66b1…/pickup" -b carrier.txt -H "Content-Type: application/json" -d '{
  "checklist": ["CONTENT_MATCHES", "WEIGHT_OK", "NO_FORBIDDEN", "PACKAGING_OK", "ITEMS_IDENTIFIED"],
  "photoUrls": ["https://ik.imagekit.io/yamba/pickups/66b1-1.jpg", "https://ik.imagekit.io/yamba/pickups/66b1-2.jpg"],
  "notes": "Colis conforme, 2,9 kg à la pesée."
}'
# → 200 { "bookingId": "66b1…", "status": "PICKED_UP", "refundAmountCents": null, "currencyCode": "EUR" }
```

**Le code n'est jamais dans cette réponse, jamais dans un événement, jamais dans un email, jamais dans une vue Voyageur.** L'Expéditeur le lit sur `GET /deals/{id}` (vue Shipper, champ `deliveryCode`, statut `PICKED_UP` uniquement, jamais dans les listes) et le transmet au destinataire **de vive voix**. En cas de doute : `POST /deals/{id}/code/regenerate` (Expéditeur, 5 régénérations maximum → 409 `CODE_REGENERATION_LIMIT` ; la réponse est la **seule** surface d'écriture qui rend le nouveau code : `{ bookingId, deliveryCode, codeRegenerationsLeft }`). Refus à la récupération : `POST /deals/{id}/pickup/refuse { "reason": "OVERWEIGHT" }` (annulation + remboursement).

**Étape 6 — jalons de suivi facultatifs (Voyageur).** Séquence stricte `AT_AIRPORT → FLIGHT_DEPARTED → FLIGHT_ARRIVED`, sans saut ni doublon ; pas de changement de statut ; notification in-app à l'Expéditeur, sans email. L'annulation « 5 secondes » est **côté client** : appeler la route après la fenêtre d'annulation, il n'y a pas d'annulation serveur.

```bash
curl -s -X POST "$BASE/deals/66b1…/events" -b carrier.txt -H "Content-Type: application/json" -d '{ "step": "AT_AIRPORT" }'
# → 200 { "bookingId": "66b1…", "step": "AT_AIRPORT", "confirmedAt": "…", "trackingEvents": [ { "step": "AT_AIRPORT", "confirmedAt": "…" } ] }
# → 409 TRACKING_STEP_NOT_ALLOWED si l'ordre n'est pas respecté ou si le deal n'est pas PICKED_UP
```

**Étape 7 — remettre le colis avec le code (Voyageur).** Le code donné par le destinataire est comparé avec bcrypt. `PICKED_UP → DELIVERED`, `payoutDueAt = deliveredAt + 4 jours` (fenêtre de vérification de l'Expéditeur), outbox `booking.delivered`.

```bash
curl -s -X POST "$BASE/deals/66b1…/deliver" -b carrier.txt -H "Content-Type: application/json" \
  -d '{ "code": "742891", "photoUrls": ["https://ik.imagekit.io/yamba/deliveries/66b1-1.jpg"] }'
# → 200 { "bookingId": "66b1…", "status": "DELIVERED", "deliveredAt": "…", "payoutDueAt": "…+4 jours" }
```

Erreurs `409` à traiter finement : `DELIVERY_CODE_INVALID` avec `details.attemptsLeft` (afficher « il reste N essais »), `DELIVERY_LOCKED` avec `details.lockedUntil` (3 échecs → verrou de 15 minutes ; désactiver la saisie jusqu'à cette date — le serveur refuse de toute façon toute comparaison pendant le verrou), `DELIVERY_CODE_UNAVAILABLE` (enregistrement antérieur au chantier B3, sans code : contacter le support), `TRANSITION_NOT_ALLOWED`.

**Étape 8 — confirmer (Expéditeur) ou laisser courir.** Pendant la fenêtre `DELIVERED`, l'Expéditeur peut **confirmer** (versement libéré immédiatement, geste irréversible : le droit de contester disparaît) ou **contester** ; à `payoutDueAt`, le cron confirme automatiquement (`completedBy: SYSTEM`) et déclenche le versement.

```bash
curl -s -X POST "$BASE/deals/66b1…/confirm" -b shipper.txt
# → 200 { "bookingId": "66b1…", "status": "COMPLETED", "completedAt": "…", "payoutStatus": "SENT", "payoutAmountCents": 3600, "currencyCode": "EUR" }
```

`payoutStatus` vaut `SENT` si le transfert Stripe a réussi en ligne, `FAILED` si le fournisseur a refusé (le cron réessaie toutes les 5 minutes, jusqu'à 10 fois ; l'admin voit la file `/admin/finances/queue`). `409 TRANSITION_NOT_ALLOWED` si le deal n'est pas `DELIVERED` ou si la fenêtre est passée.

**Litige** (Expéditeur) : depuis `DELIVERED` avant `payoutDueAt`, ou depuis `PICKED_UP` si le départ du trajet date de plus de 48 h sans remise (catégorie obligatoirement `NOT_DELIVERED`).

```bash
curl -s -X POST "$BASE/deals/66b1…/dispute" -b shipper.txt -H "Content-Type: application/json" -d '{
  "category": "DAMAGED", "pledgeAccepted": true, "desiredOutcome": "PARTIAL_REFUND",
  "description": "Le colis est arrivé avec l emballage déchiré et le boubou taché sur la manche gauche ; photos jointes.",
  "photoUrls": ["https://ik.imagekit.io/yamba/disputes/66b1-1.jpg"]
}'
# → 200 { "bookingId": "66b1…", "status": "DISPUTED", "ticketNumber": "YAM-2041", "disputedAt": "…" }
```

Le versement est **gelé**, un dossier de médiation est ouvert (le Voyageur donne sa version par `POST /deals/{id}/dispute/statement`, une seule fois), et la décision revient au médiateur (`POST /admin/disputes/{id}/resolve`) : les deux parties reçoivent l'issue, leur montant et le motif. La description fait **au moins 50 caractères** (400 sinon).

**Étape 9 — noter l'autre partie (double aveugle, D53).** Une fois par rôle, statut `COMPLETED`, dans les **14 jours**. Les avis restent cachés jusqu'à ce que les deux aient noté, ou jusqu'à la fin de la fenêtre.

```bash
curl -s "$BASE/deals/66b1…/rating" -b shipper.txt
# → 200 { "canRate": true, "ratedRole": "CARRIER", "windowEndsAt": "…", "myRating": null, "counterpartHasRated": false, "revealedAt": null, … }
curl -s -X POST "$BASE/deals/66b1…/rating" -b shipper.txt -H "Content-Type: application/json" \
  -d '{ "rating": 5, "criteria": { "PUNCTUALITY": "UP", "COMMUNICATION": "UP", "PARCEL_CARE": "UP" }, "comment": "Ponctuelle et soigneuse, je recommande." }'
# → 201 { "bookingId": "66b1…", "submittedAt": "…", "revealed": false, "revealedAt": null }
# → 409 TRANSITION_NOT_ALLOWED si déjà noté, hors fenêtre, ou deal non COMPLETED
```

Les critères hors du rôle noté sont ignorés (`PUNCTUALITY`, `COMMUNICATION`, `PARCEL_CARE` pour noter un Voyageur ; `DECLARATION_CLARITY`, `RESPONSIVENESS`, `PUNCTUALITY` pour noter un Expéditeur). Seuls les avis révélés nourrissent la réputation publique (`GET /users/{slug}/public/reviews`).

### 3.6 Messagerie : fil, rendez-vous, numéro

Répond : **message-service** (`/api/messages` → `/messages`). La conversation d'un deal **existe à partir de l'acceptation** (D61 2A) : avant, la demande porte déjà une description et ouvrir un fil inviterait à sortir de la plateforme. Elle est **créée au premier accès** par la route « by-deal ».

```bash
# Le fil d'un deal (créé au premier accès ; 403 avant ACCEPTED ou si l'appelant n'est pas partie)
curl -s "$BASE/messages/conversations/by-deal/66b1…" -b shipper.txt -H "x-locale: fr"
```

Réponse `200` (`ConversationThreadResponse`) :

```json
{ "conversation": { "id": "66c2…", "bookingId": "66b1…", "role": "SHIPPER",
                    "counterpart": { "id": "…", "firstName": "Awa", "avatarUrl": null },
                    "corridor": { "originCity": "Paris", "destinationCity": "Kinshasa", "departureAt": "2026-10-12T20:30:00.000Z" },
                    "bookingStatus": "ACCEPTED", "lastMessage": null, "unreadCount": 0, "nextMeetup": null,
                    "access": { "canRead": true, "canWrite": true, "reason": null, "writeClosesAt": null } },
  "messages": [ { "id": "…", "kind": "SYSTEM", "authorRole": "SYSTEM", "authorId": null, "body": "deal.accepted",
                  "systemKey": "deal.accepted", "systemData": {}, "photoUrls": [], "flaggedContact": false, "createdAt": "…" } ],
  "meetups": [], "nextCursor": null,
  "phone": { "revealed": false, "phoneE164": null, "opensAt": "2026-10-12T18:30:00.000Z" } }
```

`access.reason` est une **clé stable** que le client traduit : `NOT_ACCEPTED_YET`, `DISPUTE_OPEN` (lecture seule pendant un litige — les échanges passent par la médiation), `DEAL_CLOSED`, `WRITE_WINDOW_OVER` (14 jours après la fin du deal, `writeClosesAt` annonce la date). Les messages `SYSTEM` et `MEETUP` portent une `systemKey` : le client affiche **sa propre copie traduite**, `body` n'est qu'un repli. `GET /messages/conversations` liste les fils (`{ items, totalUnread }`) ; `GET /messages/conversations/{id}?cursor=<plus ancien id chargé>` remonte l'historique.

```bash
# Poster un message (texte ≤ 2000 caractères, ≤ 5 photos ImageKit)
curl -s -X POST "$BASE/messages/conversations/66c2…/messages" -b shipper.txt -H "Content-Type: application/json" \
  -d '{ "body": "Bonjour Awa, je serai au terminal 2E vers 19h avec le colis." }'
# → 201 { Message } — ou 400 { details: { code: "DELIVERY_CODE_IN_MESSAGE" } } si un groupe de six chiffres correspond au code du deal
# → 400 « This conversation is read-only (DISPUTE_OPEN). » si l'écriture est fermée

# Marquer lu
curl -s -X POST "$BASE/messages/conversations/66c2…/read" -b carrier.txt

# Proposer un rendez-vous (objet métier, pas un message) : ≥ 30 min à l'avance, ≤ 90 jours, créneau ≤ 12 h
curl -s -X POST "$BASE/messages/conversations/66c2…/meetups" -b carrier.txt -H "Content-Type: application/json" -d '{
  "kind": "PICKUP", "placeLabel": "CDG Terminal 2E, porte 8", "placeDetails": "Devant le comptoir Air France",
  "startAt": "2026-10-12T17:30:00.000Z", "endAt": "2026-10-12T18:30:00.000Z" }'
# → 201 { "id": "66d3…", "kind": "PICKUP", "status": "PROPOSED", "proposedByRole": "CARRIER", … }
#   Une nouvelle proposition du même type REMPLACE la précédente (contre-proposition) ; 400 « Invalid meeting slot (TOO_SOON) » sinon.

# Accepter (l'AUTRE partie seulement ; garde optimiste : un changement concurrent répond 400 « This meeting was just changed »)
curl -s -X POST "$BASE/messages/conversations/66c2…/meetups/66d3…/accept" -b shipper.txt
# → 200 { "id": "66d3…", "status": "ACCEPTED", "acceptedAt": "…", … }

# Réponses rapides traduites dans la langue du lecteur
curl -s "$BASE/messages/quick-replies" -b shipper.txt -H "x-locale: fr"
# → 200 { "items": [ { "key": "…", "kind": "PICKUP", "text": "Je suis arrivé(e), où êtes-vous ?" }, … ] }
```

**Le numéro de l'autre partie** ne s'ouvre qu'**au plus tôt 2 heures avant le rendez-vous de récupération accepté** (à défaut, avant le départ du trajet — D61 4A), une fois par lecteur, tracé (`PhoneReveal`) et signalé dans le fil par un message système. Le client montre un bouton « Appeler » qui mène au fil (`?focus=phone`), jamais un `tel:` direct avant l'heure.

```bash
curl -s -X POST "$BASE/messages/conversations/66c2…/phone" -b shipper.txt
# → 200 { "phoneE164": "+33612345678", "firstName": "Awa", "revealedAt": "…" }
# → 400 { "message": "The phone number opens 2026-10-12T15:30:00.000Z.", "details": { "code": "TOO_EARLY" } } avant l'heure
# → 400 { details: { code: "NO_ANCHOR" } } sans rendez-vous ni date de départ
```

Le client lit `phone.opensAt` dans le fil pour afficher l'heure d'ouverture plutôt que de tenter l'appel. **Signaler un message** de l'autre partie (texte seulement, une fois par signaleur) : `POST /messages/conversations/{id}/messages/{messageId}/report { "reason": "OFF_PLATFORM", "details": "…" }` → 201 `{ reportId, createdAt }` ; `409` si déjà signalé ; `400 OWN_MESSAGE` / `NOT_A_TEXT`. C'est un dossier de modération, pas une transition : aucun événement n'est émis ; le support le voit dans sa file (`GET /admin/conversations/reports`).

Les coordonnées (email, téléphone) écrites dans un message sont **détectées et marquées** (`flaggedContact: true`), jamais bloquées : le client peut afficher un rappel discret. Un message non lu depuis 15 minutes déclenche un email de relance (au plus un par heure et par conversation, sans le texte du message ; désactivable par `PATCH /auth/me/preferences { "messagingReminderEmails": false }`).

### 3.7 Lien de suivi pour le destinataire (sans compte)

Le destinataire est un tiers sans compte. L'Expéditeur crée **un** lien par deal et le partage lui-même (D69). Répond : deal-service.

```bash
curl -s -X POST "$BASE/deals/66b1…/tracking-link" -b shipper.txt
# → 200 { "token": "k3Jf…", "path": "/track/k3Jf…", "recipientFirstName": "Marie", "recipientPhoneE164": "+243812345678" }
# → 403 pour le Voyageur ; 409 TRACKING_NOT_AVAILABLE avant l'acceptation ou après une fin sans livraison
```

`path` est le chemin **côté front** (`https://<hôte du front>/track/k3Jf…`) ; la page appelle la route publique, **sans session**, soumise au limiteur anonyme du gateway :

```bash
curl -s "$BASE/track/k3Jf…"
# → 200 { "milestone": "IN_TRANSIT",
#          "steps": [ { "key": "ACCEPTED", "at": "…" }, { "key": "PICKED_UP", "at": "…" }, { "key": "IN_TRANSIT", "at": "…" } ],
#          "recipientFirstName": "Marie", "shipperFirstName": "Paul", "carrier": { "firstName": "Awa", "lastInitial": "D" },
#          "corridor": { "originCity": "Paris", "destinationCity": "Kinshasa" }, "departureAt": "…", "arrivalAt": "…" }
# → 404 une fois le destinataire anonymisé (rétention), le lien révoqué ou le deal supprimé
```

Le contenu est **minimal par construction** : jamais l'adresse, un numéro, le code de livraison, des photos ni des montants. Jalons : `ACCEPTED`, `PICKED_UP`, `IN_TRANSIT`, `ARRIVED`, `DELIVERED`, `CLOSED`.

### 3.8 Signaler un trajet ou un membre

Répond : auth-service (D68). `targetRef` est l'**identifiant public** de la cible : l'id d'un trajet, ou le **slug** d'un membre (le DTO public d'un membre ne porte pas son id). Les motifs sont **fermés par cible** : trajet → `ILLEGAL_CONTENT`, `SCAM`, `INAPPROPRIATE`, `OTHER` ; membre → `SCAM`, `INAPPROPRIATE`, `IMPERSONATION`, `OTHER`.

```bash
curl -s -X POST "$BASE/reports" -b shipper.txt -H "Content-Type: application/json" \
  -d '{ "targetType": "TRIP", "targetRef": "66a0…", "reason": "SCAM", "details": "Le prix affiché change après contact et demande un paiement hors plateforme." }'
# → 201 { "reportId": "66e4…", "createdAt": "…" }
# → 400 OWN_TARGET (sa propre annonce / son propre profil) · 400 REASON_NOT_ALLOWED (motif hors liste pour cette cible)
# → 404 cible invisible (trajet supprimé, membre effacé, page masquée) · 409 doublon ouvert du même auteur
```

Le signaleur reçoit un accusé par email ; la cible n'apprend **jamais** qui l'a signalée ni même qu'elle l'a été. La décision est prise par le support (`PATCH /admin/reports/{id}`), sans sanction automatique.

### 3.9 Alertes de route (`saved-routes`)

Un membre enregistre jusqu'à **20** corridors surveillés ; il est prévenu (email et/ou in-app) des nouveaux trajets publiés. Origine et destination sont des instantanés Google Places ; même ville + même pays des deux côtés est refusé ; expiration à **6 mois**, prolongeable. Répond : auth-service.

```bash
curl -s -X POST "$BASE/saved-routes" -b shipper.txt -H "Content-Type: application/json" -d '{
  "originCity": "Paris", "originCountry": "France", "originCountryCode": "FR", "originPlaceId": "ChIJD7fiBh9u5kcRYJSMaMOCCwQ", "originLat": 48.8566, "originLng": 2.3522,
  "destinationCity": "Kinshasa", "destinationCountry": "RD Congo", "destinationCountryCode": "CD", "destinationLat": -4.4419, "destinationLng": 15.2663,
  "earliestDate": "2026-10-01", "latestDate": "2026-12-31", "emailEnabled": true, "inAppEnabled": true, "includeNearby": true }'
# → 201 { "success": true, "savedRoute": { "id": "66f5…", "expiresAt": "2027-03-06T…", "isActive": true, … } }
# → 409 « Limit of 20 alerts reached »
curl -s "$BASE/saved-routes" -b shipper.txt                                   # → { success, savedRoutes: [...] }
curl -s -X PATCH "$BASE/saved-routes/66f5…" -b shipper.txt -H "Content-Type: application/json" -d '{ "emailEnabled": false }'
curl -s -X POST "$BASE/saved-routes/66f5…/extend" -b shipper.txt              # repousse l'expiration
curl -s -X DELETE "$BASE/saved-routes/66f5…" -b shipper.txt
```

### 3.10 Profil et avatar (téléversement ImageKit signé)

**Aucun octet d'image ne transite par l'API Yamba** (D42) : le client demande une **signature** au trip-service, téléverse **directement** chez ImageKit, puis déclare l'URL obtenue. Le même mécanisme sert aux photos de colis, de récupération, de remise, de litige, de message et aux documents de trajet.

```bash
# 1. La signature (trip-service, ~30 min de validité)
curl -s "$BASE/uploads/imagekit-auth" -b shipper.txt
# → 200 { "success": true, "token": "…", "expire": 1760000000, "signature": "…", "publicKey": "public_…", "urlEndpoint": "https://ik.imagekit.io/yamba" }

# 2. Le téléversement direct chez ImageKit (hors Yamba) — multipart, dossier /avatars pour un avatar
curl -s -X POST "https://upload.imagekit.io/api/v1/files/upload" \
  -F "file=@portrait.jpg" -F "fileName=portrait.jpg" -F "folder=/avatars" \
  -F "publicKey=public_…" -F "signature=…" -F "expire=1760000000" -F "token=…"
# → { "fileId": "66g6…", "url": "https://ik.imagekit.io/yamba/avatars/portrait_abc.jpg", … }

# 3. Déclarer l'avatar (auth-service) — l'URL doit appartenir à IMAGEKIT_URL_ENDPOINT ; l'ancien fichier est supprimé
curl -s -X POST "$BASE/auth/me/avatar" -b shipper.txt -H "Content-Type: application/json" \
  -d '{ "fileId": "66g6…", "url": "https://ik.imagekit.io/yamba/avatars/portrait_abc.jpg" }'
# → 200 { MyProfileResponse } ; DELETE /auth/me/avatar pour le retirer
```

Le profil éditable (D67) : `GET /auth/me/profile` → `{ firstName, lastName, publicSlug, avatarUrl, birthDate, profilePublic, showCity, carrier }` ; `PATCH /auth/me/profile { "displayName": "Awa D.", "bio": "…", "profilePublic": true, "showCity": false }`. Le **slug public ne change jamais**. Le profil public est lu par tous sur `GET /users/{slug}/public` (404 si masqué ou effacé, sauf pour le propriétaire qui voit `hidden: true`), avec `…/public/reviews` et `…/public/trips` ; abonnement par `POST` / `DELETE /users/{slug}/follow` et `GET /me/following`. Préférences : `PATCH /auth/me/preferences { "analyticsOptIn": true }` (écrit un `ConsentLog`), `PATCH /auth/me/locale { "locale": "en" }`.

### 3.11 RGPD : export et effacement (sous sudo)

Les deux gestes exigent la **fenêtre sudo** (§2.3). Répond : auth-service.

```bash
# Ouvrir la fenêtre (code reçu par email)
curl -s -X POST "$BASE/auth/me/sudo/request" -b shipper.txt
curl -s -X POST "$BASE/auth/me/sudo/verify" -b shipper.txt -H "Content-Type: application/json" -d '{ "code": "391045" }'
# → 200 { "active": true, "expiresAt": "…+15 min" }

# Export : un JSON en pièce jointe (Content-Disposition: attachment), une DataRequest EXPORT est journalisée
curl -s -X POST "$BASE/auth/me/data-export" -b shipper.txt -o mes-donnees-yamba.json -D -
# → 200, corps DataExport { exportedAt, format, profile, preferences, consents, trips, bookings, reviewsGiven, reviewsReceived, messages, meetups, phoneReveals, savedRoutes, favorites, following, notifications, reportsMade, dataRequests, … }
# → 403 SUDO_REQUIRED sans fenêtre · refus `EXPORT_RATE_LIMITED` si un export récent existe déjà

# Effacement : d'abord ce qui bloque
curl -s "$BASE/auth/me/erasure/blockers" -b shipper.txt
# → 200 { "blockers": ["ACTIVE_DEAL"], "counts": { "ACTIVE_DEAL": 1 } }   (vide = effaçable)

# Puis le geste, avec le mot de confirmation exact
curl -s -X POST "$BASE/auth/me/erasure" -b shipper.txt -H "Content-Type: application/json" -d '{ "confirmation": "SUPPRIMER" }'
# → 200 { "success": true, "erased": true }  — la session est terminée
# → 409 { "code": "ERASURE_BLOCKED", "blockers": ["ACTIVE_DEAL"], "counts": { "ACTIVE_DEAL": 1 } }
```

L'export ne contient **jamais** les coordonnées de l'autre partie, le code de livraison, les signalements visant le membre, ni les dossiers de médiation. L'effacement est **une transaction** qui anonymise le `User` champ par champ (les uniques deviennent `erased+<id>@anonymised.invalid` / `deleted-<id>`) ; deals, litiges, avis et messages sont conservés (obligations comptables et de médiation). Liste fermée des bloqueurs : `ACTIVE_DEAL`, `PENDING_REQUEST`, `PAYOUT_PENDING`, `RETENTION_HELD`, `PUBLISHED_TRIP`, `ADMIN_ACCOUNT` — le client traduit chacun et propose l'action qui le lève (attendre la fin du deal, dépublier le trajet…).

### 3.12 Session admin : connexion → TOTP → KPIs → un geste journalisé

Répond : auth-service pour la session et les KPIs ; le service propriétaire pour chaque geste. Jar séparé `admin.txt` : les cookies s'appellent `admin_preauth`, `admin_access_token`, `admin_refresh_token`. Le compte doit avoir été promu par `grant-admin.ts` ou par une invitation (`POST /admin/admins/invite` → `POST /auth/admin/invite/accept { token, password }`).

```bash
# 1. Mot de passe → cookie admin_preauth (5 min)
curl -s -X POST "$BASE/auth/admin/login" -c admin.txt -H "Content-Type: application/json" \
  -d '{ "email": "support@yamba.example", "password": "…" }'
# → 200 { "next": "TOTP" }   (ou { "next": "SETUP" } au premier accès : totp/setup → scanner otpauthUrl → totp/enable { code })

# 2. Code TOTP → session admin
curl -s -X POST "$BASE/auth/admin/totp/verify" -b admin.txt -c admin.txt -H "Content-Type: application/json" -d '{ "code": "203911" }'
# → 200 { "ok": true, "usedBackupCode": false, "remainingBackupCodes": 8 }
# → 401 code faux (verrou OTP par paliers, 429)

# 3. Qui suis-je, avec quels profils
curl -s "$BASE/admin/me" -b admin.txt
# → 200 { "id": "…", "email": "…", "adminRole": "SUPPORT", "adminRoles": ["SUPPORT"], "remainingBackupCodes": 8 }

# 4. Les compteurs d'accueil — null = non visible pour ce profil
curl -s "$BASE/admin/kpis" -b admin.txt
# → 200 { "ticketsToVerify": 3, "hideProposals": 1, "suspensionProposals": 0, "reportsOpen": 2, "messageReportsOpen": 1,
#          "disputesToDecide": null, "payoutsFailed": null, …, "generatedAt": "…" }

# 5. Un geste journalisé : décider d'un signalement (permission reports.review)
curl -s -X PATCH "$BASE/admin/reports/66e4…" -b admin.txt -H "Content-Type: application/json" \
  -d '{ "decision": "REVIEWED", "note": "Annonce vérifiée, prix conforme ; signalement infondé." }'
# → 200 { "id": "66e4…", "status": "REVIEWED" } · 409 déjà décidé · 403 { code: "ADMIN_PERMISSION_DENIED", permission: "reports.review" }

# 5 bis. Un geste en deux temps : SUPPORT propose une sanction, MEDIATOR / SUPER_ADMIN l'applique
curl -s -X POST "$BASE/admin/users/665f…/suspension/propose" -b admin.txt -H "Content-Type: application/json" \
  -d '{ "level": "RESTRICTED", "reason": "Trois signalements SCAM concordants sur des annonces différentes en 7 jours." }'
# → 200 { "ok": true, "proposedAt": "…" }
# (puis, avec un profil MEDIATOR) POST /admin/users/665f…/suspension { "level": "RESTRICTED", "reason": "…", "until": "2026-10-06T00:00:00.000Z" }

# 6. Le journal (permission audit.read) — la ligne du geste y est écrite DANS LA MÊME TRANSACTION que le geste
curl -s "$BASE/admin/audit" -b admin.txt
# → 200 { "items": [ { "id": "…", "at": "…", "admin": "support@…", "action": "REPORT_REVIEWED", "targetType": "REPORT", "targetId": "66e4…", "before": null, "after": {…}, "ip": "…" }, … ], "nextCursor": … }
```

Les routes admin sont réparties par service propriétaire (deal-service pour les litiges et l'argent, trip-service pour les trajets et billets, message-service pour les conversations et signalements de messages, auth-service pour le reste) mais le client n'en sait rien : le gateway route sur le préfixe. Chaque écriture admin exige un **motif** (souvent ≥ 20 caractères) et produit une ligne de journal ; les lectures sensibles (fiche d'un membre, fil d'une conversation, drill-down portant des personnes) sont journalisées aussi. Les exports CSV sont encadrés : opérationnels (identifiants seulement) pour `exports.operational`, personnels pour `exports.personal` (SUPER_ADMIN / PRIVACY, motif obligatoire).

---

## 4. Catalogue des codes d'erreur métier

Les codes sont **stables** et en anglais ; ils voyagent dans `details.code` (erreurs passées par `errorMiddleware`), dans `code` (réponses directes des middlewares et du gateway) ou dans `errors.<champ>` (validation de formulaire). Le client les traduit ; il n'affiche jamais `message`. La colonne « Où » indique le service et le statut HTTP.

### 4.1 Demande de réservation (`details.type: "booking"`, 409, deal-service)

| Code | Cause | Remède côté client |
|---|---|---|
| `QUOTE_DIVERGENCE` | Le total recalculé par le serveur diffère de `expectedTotalCents` (prix du trajet modifié, paramètres de plateforme changés, saisie altérée). | Rafraîchir le trajet et les paramètres de prix, recalculer, **ré-afficher** le nouveau total, laisser l'utilisateur reconfirmer. Ne jamais reprendre avec l'ancien montant. |
| `CAPACITY_EXCEEDED` | Plus assez de kilos disponibles sur le trajet (`remainingKg`). | Proposer un poids inférieur ou un autre trajet ; recharger la carte du trajet. |
| `FAMILY_REFUSED` | Le Voyageur refuse cette famille de colis (`familyConditions`, mode `REFUSE`). | Griser la famille dans le wizard (les conditions sont dans le DTO public du trajet). |
| `TRIP_NOT_BOOKABLE` | Trajet non publié, parti, en pause, masqué ou supprimé. | Retour à la recherche. |
| `OWN_TRIP` | L'Expéditeur est le propriétaire du trajet. | Masquer le bouton « Réserver » sur ses propres trajets. |
| `PAYMENT_NOT_AUTHORIZED` | L'intention n'est pas au statut « autorisée » chez le fournisseur (confirmation client non faite, carte refusée). | Relancer la confirmation du paiement, puis rejouer `POST /deals`. |
| `PAYMENT_MISMATCH` | Le montant ou la devise de l'intention ne correspondent pas au devis. | Recréer une intention (`POST /deals/payment-intents`) puis `POST /deals`. |
| `PAYMENT_ALREADY_USED` | L'intention a déjà servi à créer un deal. | Relire `GET /me/bookings` : le deal existe sûrement déjà. |
| `NEW_ACCOUNT_CAP` | Plafond progressif d'un compte récent (D71) : `details.cap` ∈ `DECLARED_VALUE`, `WEIGHT`, `SHIPMENTS_PER_MONTH`, avec `limit` et `value`. | Expliquer le plafond et sa valeur ; proposer de réduire la valeur déclarée / le poids ou d'attendre. |

### 4.2 Cycle de vie, transport, règlement (`details.type: "booking"`, 409, deal-service)

| Code | Cause | Remède |
|---|---|---|
| `TRANSITION_NOT_ALLOWED` | La machine à états a refusé : statut, rôle ou garde (`details.reason` porte le motif), **ou une écriture concurrente a gagné** (verrou optimiste). | Recharger `GET /deals/{id}` et n'afficher que `allowedActions`. Ne pas réessayer sans relecture. |
| `CARRIER_ONBOARDING_REQUIRED` | Porte D31 à l'acceptation : profil Voyageur incomplet ou Stripe non prêt. | Emmener le Voyageur terminer l'onboarding (§3.2), puis réessayer. |
| `PAYMENT_STATE_CONFLICT` | L'état du paiement chez le fournisseur interdit l'opération (capture impossible, remboursement impossible). | Informer ; pour une acceptation, l'Expéditeur doit refaire une demande ; sinon contacter le support avec l'`x-correlation-id`. |
| `DELIVERY_CODE_INVALID` | Mauvais code de livraison ; `details.attemptsLeft`. | Afficher les essais restants ; inviter à revérifier avec le destinataire. |
| `DELIVERY_LOCKED` | 3 échecs → verrou ; `details.lockedUntil`. | Désactiver la saisie jusqu'à `lockedUntil` ; proposer à l'Expéditeur de régénérer le code. |
| `DELIVERY_CODE_UNAVAILABLE` | Deal antérieur au chantier B3, sans code. | Support. |
| `TRACKING_STEP_NOT_ALLOWED` | Jalon hors séquence, doublon, ou deal non `PICKED_UP`. | Recharger `trackingEvents` et ne proposer que le jalon suivant. |
| `CODE_REGENERATION_LIMIT` | 5 régénérations atteintes, ou deal non `PICKED_UP`. | Masquer le bouton ; support si nécessaire. |
| `TRACKING_NOT_AVAILABLE` | Lien de suivi demandé avant l'acceptation ou après une fin sans livraison. | Masquer « Partager le suivi » hors des statuts `ACCEPTED`, `PICKED_UP`, `DELIVERED`, `COMPLETED`. |

### 4.3 Compte, session, sudo (auth-service)

| Code | Où | Cause | Remède |
|---|---|---|---|
| `ACCOUNT_DELETED` | 401 middleware | Compte effacé (RGPD). | Déconnecter, purger le stockage local. |
| `ACCOUNT_SUSPENDED` | 401 middleware | Sanction `SUSPENDED`. | Déconnecter ; page d'information avec l'adresse du support. |
| `ACCOUNT_RESTRICTED` | 403 `requireActiveAccount` | Sanction `RESTRICTED` (ou `SUSPENDED`) sur une route de création. | Expliquer que la publication / réservation est suspendue ; les deals en cours continuent. |
| `SUDO_REQUIRED` | 403, `details` (+ `windowMinutes`) | Geste sensible sans fenêtre sudo. | Ouvrir la porte (`/auth/me/sudo/request` + `/verify`) puis rejouer. 🚪 exposition en production à vérifier (§2.3). |
| `OTP_INCORRECT` / `OTP_INVALIDATED` / `OTP_LOCKED` / `OTP_EXPIRED` | 401 / 429, `details.type: "otp"` (`attemptsLeft`, `locked`, `lockUntilSeconds`, `otpInvalidated`) | Code faux, code invalidé après 5 échecs, verrou par palier (1 min / 30 min / 24 h), code périmé. | Construire le message depuis les champs ; proposer « renvoyer un code » quand `otpInvalidated` ou `OTP_EXPIRED` ; compte à rebours sur `lockUntilSeconds`. |
| `PASSWORD_CONTAINS_PERSONAL_INFO`, `PASSWORD_SAME_AS_CURRENT` | 400, `details.type: "password"` | Règles de force / de nouveauté. | Message de règle sous le champ. |
| `EMAIL_ALREADY_USED`, `EMAIL_SAME`, `EMAIL_CHANGE_EXPIRED` | 400 / 409 | Changement d'email : adresse prise, identique, ou demande périmée (10 min). | Proposer une autre adresse ; relancer la demande. |
| `LOCALE_UNSUPPORTED` | 400, `details.type: "locale"` | Locale hors `SUPPORTED_LOCALES`. | N'envoyer que `fr` / `en`. |
| `GOOGLE_TOKEN_INVALID`, `GOOGLE_EMAIL_UNVERIFIED`, `GOOGLE_NOT_CONFIGURED`, `CONSENT_REQUIRED` | 401 / 400 / 200, `details.type: "oauth"` ou `status` | Jeton Google invalide, email non vérifié chez Google, client non configuré, consentement manquant pour un nouveau compte. | Redemander le jeton ; afficher l'écran de consentement puis rappeler avec `consent`. |
| `STRIPE_ACCOUNT_MISSING` | 409 | Tableau de bord Stripe demandé sans compte Connect. | Envoyer vers l'onboarding. |
| `ERASURE_BLOCKED` | 409 (corps `ErasureBlockedResponse`) | Effacement impossible : `blockers` ∈ `ACTIVE_DEAL`, `PENDING_REQUEST`, `PAYOUT_PENDING`, `RETENTION_HELD`, `PUBLISHED_TRIP`, `ADMIN_ACCOUNT` + `counts`. | Lister les bloqueurs traduits avec l'action qui les lève ; `GET /auth/me/erasure/blockers` pour anticiper. |
| `EXPORT_RATE_LIMITED` | 400 `data-export`, `details.code` + `details.nextAt` | Un export a déjà été produit dans l'intervalle minimal (un par période). | Proposer de réutiliser le fichier déjà téléchargé ; afficher `nextAt`. |
| `OWN_TARGET`, `REASON_NOT_ALLOWED` | 400 `POST /reports` | Signalement de sa propre cible ; motif hors liste pour ce type de cible. | Masquer le bouton sur ses propres contenus ; ne proposer que les motifs de la cible. |

### 4.4 Trajets et favoris (trip-service)

| Code | Où | Cause | Remède |
|---|---|---|---|
| `OWN_TRIP`, `TRIP_NOT_FAVORITABLE` | 409, `details.type: "favorite"` | Mise en favori de son propre trajet ; trajet non publié. | Masquer l'étoile. |
| *(messages de la machine, sans code)* | 400 | Transition refusée (`canPerform`), trajet introuvable, non-propriétaire, portes de publication. | Lire `message` (🚪 sémantique 403/404 à venir) ; recharger `allowedActions` de `GET /trips/my`. |

### 4.5 Messagerie (message-service)

| Code | Où | Cause | Remède |
|---|---|---|---|
| `DELIVERY_CODE_IN_MESSAGE` | 400, `details.code` | Un groupe de six chiffres du message correspond au code de livraison du deal. | Refuser l'envoi ; rappeler que le code se donne de vive voix. 🚪 exposition en production (§2.3). |
| `access.reason` : `NOT_ACCEPTED_YET`, `DISPUTE_OPEN`, `DEAL_CLOSED`, `WRITE_WINDOW_OVER` | 200 (champ du DTO) puis 400 « read-only (…) » à l'écriture | Fenêtre d'écriture fermée. | Désactiver la saisie **avant** l'envoi, avec le motif traduit et `writeClosesAt`. |
| `TOO_SOON`, `TOO_FAR`, `WINDOW_TOO_LONG`, `END_BEFORE_START`, `INVALID_DATES` | 400 « Invalid meeting slot (…) » | Créneau de rendez-vous hors règles (≥ 30 min, ≤ 90 j, ≤ 12 h). | Valider le créneau dans le formulaire avec les mêmes bornes. |
| `NOT_PROPOSED`, `OWN_PROPOSAL` | 400 « This meeting cannot be accepted (…) » | Rendez-vous déjà traité ; on n'accepte pas sa propre proposition. | Recharger le fil. |
| `TOO_EARLY` (+ `opensAt` dans le message), `NO_ANCHOR` | 400, `details.code` | Numéro demandé trop tôt ; aucun rendez-vous ni date de départ. | Afficher `phone.opensAt` du fil ; proposer de fixer un rendez-vous. |
| `OWN_MESSAGE`, `NOT_A_TEXT` | 400 `report` | On ne signale que les textes de l'autre partie. | Masquer l'action. |
| *(409 sans code)* | `report` | Déjà signalé par cet utilisateur. | Marquer « signalé ». |

### 4.6 Gateway et back-office

| Code | Où | Cause | Remède |
|---|---|---|---|
| `MAINTENANCE` | 503 gateway, `Retry-After: 300` | Mode lecture seule sur une écriture hors `/api/auth/`, `/api/admin/`. | Bandeau `messages.<locale>` ; conserver la saisie ; réessayer après `retryAfterSeconds`. |
| *(429 `{ error }`)* | gateway | 100 requêtes / 15 min / IP. | Attendre `RateLimit-Reset` ; réduire les appels. |
| `ADMIN_PERMISSION_DENIED` (+ `permission`) | 403 `requireAdminPermission` | Profil admin sans la permission de la route. | Masquer l'action selon `adminRoles` de `GET /admin/me` ; ne jamais retenter. |
| `TRANSITION_NOT_ALLOWED` (médiation) | 409 deal-service admin | Litige déjà décidé, deal non `DISPUTED`, déclaration déjà enregistrée. | Recharger le dossier. |
| Rapprochement : `INTENT_NOT_FOUND`, `CAPTURE_NOT_RECORDED`, `CAPTURE_RECORDED_NOT_LIVE`, `REFUND_NOT_RECORDED`, `REFUND_RECORDED_NOT_LIVE`, `TRANSFER_MISSING`, `TRANSFER_AMOUNT_MISMATCH`, `TRANSFER_REVERSED_NOT_MARKED`, `TRANSFER_MARKED_REVERSED_BUT_LIVE_OK` | 200 (`divergences[]` de `POST /admin/deals/{id}/money/reconcile`) | Écarts entre la base et le fournisseur, **lecture seule**. | Afficher ; la correction est un geste séparé (rejeu, renversement, remboursement manuel). |

---

## 5. Webhooks entrants et événements sortants

### 5.1 Webhook Stripe — `POST :6003/webhooks/stripe` (direct, jamais via le gateway)

Le webhook est **la source de vérité de l'état du paiement** : entre la base et Stripe, c'est Stripe qui a l'argent, et l'état de Yamba converge vers le sien (D40). Contraintes de câblage, visibles dans `apps/deal-service/src/main.ts` :

- la route est montée **avant** `express.json()`, avec `express.raw({ type: "application/json" })` : la signature `stripe-signature` porte sur les **octets bruts** du corps, qu'un JSON re-sérialisé casserait ; c'est pourquoi le gateway (qui parse et re-sérialise) n'est jamais sur le chemin ;
- en développement : `stripe listen --forward-to localhost:6003/webhooks/stripe` ;
- **deux endpoints Stripe, une URL** (A87) : les événements de la plateforme (`STRIPE_WEBHOOK_SECRET`) et ceux des comptes connectés (`STRIPE_CONNECT_WEBHOOK_SECRET`) ; la signature est essayée avec l'un puis l'autre.

| Réponse | Sens |
|---|---|
| `200 { received: true }` | Traité (ou ignoré volontairement) : Stripe ne renverra pas. |
| `400` | En-tête absent ou signature invalide : pas de retry utile. |
| `501` | `STRIPE_WEBHOOK_SECRET` absent (fournisseur FAKE) : l'endpoint existe mais refuse plutôt que d'accepter sans signature. |
| `500` | Échec transitoire (base indisponible) : **Stripe réessaie**, c'est le filet voulu. |

Événements traités (tout autre type répond 200 sans effet) :

| Type Stripe | Effet dans Yamba |
|---|---|
| `payment_intent.canceled` | L'empreinte est morte (expiration ~7 j, annulation fournisseur) : un `Booking` `PENDING` qui la porte est **annulé par `SYSTEM`** via la machine à états. Idempotent. |
| `payment_intent.amount_capturable_updated` | Accusé simple : l'autorisation est posée. La création du deal reste pilotée par `POST /deals` (D37). |
| `account.updated` (Connect) | Les drapeaux du Voyageur (`chargesEnabled`, `payoutsEnabled`, `detailsSubmitted`) suivent Stripe sans repasser par l'onboarding ; compte devenu prêt → ses **versements bloqués repartent** tout de suite. |
| `transfer.reversed` | Le transfert au Voyageur a été renversé : le deal est marqué (file `REVERSED` de `/admin/finances/queue`). |
| `payout.failed` (compte connecté) | La banque du Voyageur a refusé le virement : il est prévenu (RIB à corriger). |

### 5.2 Webhook email (Resend) — `POST /api/webhooks/email/resend`

Passe par le gateway (`/api/webhooks/email/*` → notification-service `/webhooks/email/*`), le corps brut étant conservé par `express.json({ verify })` pour la **signature Svix** (`svix-id`, `svix-timestamp`, `svix-signature`, secret `RESEND_WEBHOOK_SECRET`). Réponses : `503` si le secret n'est pas configuré ; `401 { message, reason }` si la signature est invalide ; `200 { ok, status, suppressed }` sinon — **idempotent** : un événement inconnu ou déjà appliqué répond 200 sans effet (`{ ok: true, ignored: <type> }`).

| Type Resend | Effet |
|---|---|
| `email.delivered` | `EmailDelivery.status = DELIVERED` (par `providerMessageId`). |
| `email.bounced` | `BOUNCED` ; si le rebond est **dur**, l'adresse du compte est mise sur la **liste de suppression** (`User.emailSuppressedAt`, raison `HARD_BOUNCE`). |
| `email.complained` | `COMPLAINED` ; suppression (`COMPLAINT`). |
| autres (`email.sent`, `email.opened`, `email.clicked`, `email.delivery_delayed`) | Ignorés. |

Conséquence pour tout flux d'email : **chaque résolveur de destinataires doit ignorer `isDeleted` et `emailSuppressedAt`** — un nouveau flux qui l'oublie est un bug. Le support peut lever une suppression (`DELETE /admin/users/{id}/email-suppression`).

### 5.3 Événements sortants : outbox, topics, garanties

Aucune transition n'existe sans son événement : **l'événement est écrit dans la collection `OutboxEvent` dans la même transaction Mongo que le changement d'état** (D2). Un relais par service (`OutboxRelay` du deal-service, `MessagingOutboxRelay` du message-service), protégé par un bail d'exclusivité, lit les lignes non publiées **de son seul `aggregateType`** (`booking` / `conversation`), valide chaque ligne contre le schéma Zod de son union discriminée, et la publie sur Redpanda (Kafka) :

| Topic | Producteur | Clé de partition | Contrat | Événements |
|---|---|---|---|---|
| `booking-events` | deal-service | `aggregateId` (= id du deal) | `BookingDomainEventSchema` | `booking.requested`, `payment_authorized`, `accepted`, `declined`, `expired`, `cancelled`, `refund_issued`, `picked_up`, `pickup_refused`, `tracking_event`, `code_regenerated`, `delivered`, `completed`, `payout_sent`, `disputed`, `verification_reminder`, `rating_reminder`, `rating_revealed`, `dispute_carrier_responded`, `dispute_resolved` |
| `messaging-events` | message-service | id de la conversation | `MessagingDomainEventSchema` | `conversation.message_posted`, `meetup_proposed`, `meetup_accepted`, `phone_revealed` |

Un topic par **domaine**, jamais par type d'événement : l'ordre par agrégat est l'invariant, le dispatch par type est fait par les consommateurs. Les topics sont créés explicitement (12 partitions, rétention 7 jours) ; l'auto-création est désactivée côté cluster et côté producteur. Le message Kafka porte l'en-tête **`event-id`** (= `_id` de la ligne outbox), et sa valeur est l'événement JSON :

```json
{ "aggregateType": "booking", "aggregateId": "66b1…", "eventType": "booking.picked_up",
  "occurredAt": "2026-10-12T17:52:10.412Z", "correlationId": "8b1c…", "schemaVersion": 1,
  "payload": { "bookingId": "66b1…", "tripId": "66a0…", "shipperId": "…", "carrierId": "…",
               "corridor": { "originCity": "Paris", "originCountryCode": "FR", "destinationCity": "Kinshasa", "destinationCountryCode": "CD" },
               "category": "CLOTHES", "categoryFamily": "CLOTHES_TEXTILE", "weightKg": 3,
               "transportCents": 3600, "totalShipperCents": 4032, "currencyCode": "EUR", "actor": "CARRIER",
               "pickedUpAt": "2026-10-12T17:52:10.412Z", "photoCount": 2 } }
```

Garanties :

- **Enveloppe commune** : `aggregateType`, `aggregateId`, `occurredAt` (horloge serveur à la transition), `correlationId` (né au gateway), `schemaVersion` (entier ; toute évolution incompatible = nouvelle valeur, jamais de mutation d'un schéma publié).
- **Payloads riches** : chaque événement booking porte le socle `BookingEventBasePayload` (corridor, catégorie, poids, montants, acteur) pour que l'historique rejoué nourrisse à jamais notifications, analytics et médiation.
- **Ce qui ne voyage jamais dans un payload** : le **code de livraison** (`booking.picked_up` porte `photoCount`, `booking.code_regenerated` porte des compteurs), les **coordonnées du destinataire**, les emails, le numéro de téléphone (`conversation.phone_revealed` porte `revealedUserId`, pas le numéro), le texte complet d'un message (`preview` ≤ 140 caractères). Le dossier de litige n'est jamais dans `booking.disputed` (catégorie seulement).
- **Au moins une fois + dédoublonnage** : le relais marque `publishedAt` après l'accusé du broker ; une panne entre les deux rejoue l'événement. Le consommateur (`notification-service`, groupes `notification-service` et `messaging-notifications`, **jamais partagés, jamais renommés**) revendique l'`event-id` dans `ConsumedEvent` (unique par `[consumerGroup, eventId]`) **avant** tout traitement ; un doublon est ignoré ; la matérialisation des notifications est un `upsert [eventId, userId]` ; l'offset n'est commité qu'après traitement ; un échec définitif marque la ligne `FAILED` sans bloquer la partition.
- **Poison** : une ligne outbox qui échoue à la validation ou à la publication voit `attempts` incrémenté ; à 10, elle est **parquée** (exclue du relais, jamais supprimée : piste d'audit) et la suite de l'agrégat continue. Une panne transitoire du broker n'incrémente pas `attempts` : le relais passe en backoff. Un événement parqué n'est jamais purgé par la rétention.
- **Vie sans broker** : les services démarrent sans Redpanda ; les événements s'accumulent et partent à son retour ; le consommateur retente sa connexion toutes les 5 s.
- **Analytics** : seuls les événements des membres `analyticsOptIn: true` sont projetés vers PostHog, par une **liste blanche** de champs (`analyticsEventsFor`), jamais par étalement du payload.

Ces topics sont **internes** : ils ne sont pas exposés à des intégrateurs tiers (voir les recommandations en annexe pour des webhooks sortants).

---

## 6. Bonnes pratiques d'intégration

### 6.1 Écrire un client : jetons, rafraîchissement, 401 / 403, reprise après 503

Le client de référence est `apps/user-ui/src/lib/api-client.ts` (axios). Ses règles valent pour tout client, mobile compris (D36) :

1. **Toujours `credentials: include` / un jar de cookies**, et `x-locale` sur chaque requête. Base URL = `NEXT_PUBLIC_API_BASE_URL` (`/api` en même origine, ou l'URL absolue du gateway).
2. **Un seul refresh à la fois.** Sur un 401 d'une requête qui exigeait une session (`requireAuth`), le client appelle `POST /auth/refresh` **une fois**, met les requêtes concurrentes **en file d'attente**, puis les rejoue toutes après succès. Une requête marquée `skipAuthRefresh` (le refresh lui-même, la connexion) n'entre jamais dans cette boucle. Une requête déjà rejouée (`_retry`) ne l'est pas deux fois.
3. **Disjoncteur de 30 secondes.** Quand un refresh échoue, le client mémorise l'instant et **rejette directement** les 401 suivants pendant 30 s sans retenter ; une page qui monte dix composants authentifiés ne génère pas dix cycles « 401 → refresh → 401 ». Un refresh réussi (ou une connexion) remet le disjoncteur à zéro (`resetAuthRefreshCircuitBreaker`). L'état « déconnecté » est signalé **une fois** globalement (événement `yamba:session-expired` → fenêtre « ta session a expiré »), jamais par un toast par écran.
4. **401 n'est pas 403.** Un 403 ne se rejoue jamais après refresh : `SUDO_REQUIRED` ouvre la porte sudo puis rejoue ; `ACCOUNT_RESTRICTED` explique ; `ADMIN_PERMISSION_DENIED` masque l'action ; les autres 403 renvoient vers la page adéquate.
5. **409 = relire avant d'agir.** Sur un deal, un 409 signifie que la réalité a changé : `GET /deals/{id}` puis rendu à partir de `allowedActions`. Le client ne « devine » jamais l'action suivante.
6. **503 `MAINTENANCE`** : afficher `messages.<locale>`, **conserver la saisie en local**, réessayer après `retryAfterSeconds` ou sur action de l'utilisateur ; les lectures continuent, la connexion aussi. `GET /api/maintenance` (public, 200) alimente un bandeau préventif avec `scheduledAt`.
7. **429** : respecter `RateLimit-Reset` ; mutualiser les appels d'une page (une liste de deals + les notifications + le compteur de messages non lus font trois requêtes, pas trente).
8. **Sessions visibles** : proposer l'écran « mes appareils » (`GET /auth/me/sessions`) et la déconnexion à distance ; après un changement de mot de passe ou d'email, les autres sessions sont révoquées : le client doit s'attendre à un 401 sur les autres appareils.
9. **Paiement** : le `clientSecret` sert une seule fois ; sur mobile, Payment Sheet (Apple Pay / Google Pay natifs) ; ne jamais appeler `POST /deals` avant la confirmation du paiement côté fournisseur (sinon `PAYMENT_NOT_AUTHORIZED`).
10. **Images** : téléversement direct ImageKit avec la signature de `GET /uploads/imagekit-auth` ; n'envoyer à l'API que des URL du domaine `IMAGEKIT_URL_ENDPOINT`.
11. **Corrélation** : journaliser `x-correlation-id` de chaque réponse d'erreur ; c'est la clé que le support et Sentry partagent.
12. **Mobile (D36)** 🚪 : utiliser le jar de cookies natif tant que la variante « jetons dans le corps » n'est pas livrée ; prévoir le stockage sécurisé (Keychain / Keystore) du `refresh_token` le jour où elle l'est ; réutiliser `@packages/pricing` et un client **généré** depuis les cinq documents OpenAPI (D3) plutôt qu'un client écrit à la main.

### 6.2 Sécurité : ce qu'un client ne doit jamais faire

- **Ne jamais décider une règle métier côté client** (poids maximal, fenêtre d'annulation, droit de contester, plafond d'un compte) : afficher ce que `allowedActions`, `cancellationPreview`, `access`, `canRate`, `phone.opensAt` disent. Le serveur applique tout ; le client reflète.
- **Ne jamais écrire le code de livraison** dans un message, un email, un SMS, un presse-papiers partagé, une notification push, un journal : il se donne de vive voix. Le message-service refuse d'ailleurs un texte qui le contient.
- **Ne jamais exposer un `tel:` direct** avant l'ouverture du numéro ; le bouton « Appeler » mène au fil (`?focus=phone`).
- **Ne jamais stocker les jetons ailleurs que dans les cookies `httpOnly`** (web) ou le stockage sécurisé de l'OS (mobile) ; ne jamais les mettre dans une URL ; ne jamais les journaliser.
- **Ne jamais appeler un service par son port** (`:6001`…) depuis un client : seul le gateway applique CORS, limiteur, maintenance et corrélation. Exception unique : le webhook Stripe, qui est un appel serveur à serveur.
- **Ne jamais recréer un deal après une réponse perdue** : relire les listes.
- **Ne jamais afficher `message` brut** ni interpréter des textes anglais : traduire les codes.
- **Ne jamais interroger un profil ou un trajet par un identifiant deviné** en espérant un 403 « révélateur » : la plateforme répond 404 sans distinguer inexistant et invisible.
- **Ne jamais contourner la porte sudo** en mémorisant un code ; un code par geste, valable 15 minutes pour cette session.
- Côté admin : ne jamais partager une session admin entre deux personnes (le journal porte l'auteur et l'IP) ; ne jamais copier un code de livraison depuis la base — l'admin ne l'affiche nulle part par décision (D43).

### 6.3 Versionnement et compatibilité

- **Le contrat est le schéma Zod** (`@packages/api-contracts`) ; les documents OpenAPI en sont dérivés et diffés en CI. Une modification de contrat est donc toujours visible dans une PR, dans les cinq `openapi.json`.
- **Règles suivies aujourd'hui** : ajouter un champ **optionnel** à une réponse ou à une requête est compatible ; renommer, retirer, ou rendre obligatoire ne l'est pas et se fait par un nouveau champ plus une dépréciation. Les DTO par rôle sont des **listes blanches** : un champ nouveau doit être **ajouté explicitement** à la vue qui le mérite (jamais par étalement).
- **Événements** : `schemaVersion` par événement ; un consommateur tolère les champs absents des événements anciens (ex. `reason` de `booking.payout_sent` absent = `DELIVERY`).
- **Énumérations fermées** (statuts, motifs, bloqueurs, codes) : un client doit prévoir un **cas par défaut** pour une valeur inconnue plutôt que planter — les listes s'allongent (`ReportReason`, `ErasureBlocker`, `NotificationType` est d'ailleurs `BookingEventType | string`).
- **Numéros de version des documents** (`1.0.0`, `0.3.0`, `0.1.0`) : ils datent la surface, ils ne promettent pas encore une politique de rupture ; 🚪 aucune version n'est portée par l'URL (`/api/v1`) ni par un en-tête. Voir les recommandations en annexe.
- **Portes connues qui feront bouger le contrat** : sémantique 403/404 du trip-service, jetons dans le corps pour le mobile, `safeParse` des schémas d'auth-service, `type` des `details` de `SUDO_REQUIRED` et du message-service, route `/docs` du message-service.

---

## 7. Référence exhaustive des endpoints

La référence ci-dessous est **générée** depuis les cinq documents OpenAPI 3.1 (173 endpoints) et insérée à l'assemblage du livrable. Les chemins sont ceux **du service** ; préfixer par `/api` pour l'URL client (§1.2). Les schémas sont listés à la fin de chaque service.

<!-- API_REFERENCE -->

---

## 8. Annexes

### 8.1 Schémas de sécurité (tels que déclarés dans les documents OpenAPI)

| Schéma | Type | Où le jeton voyage | Émis par | Vérifié par | Portée |
|---|---|---|---|---|---|
| `cookieAuth` | apiKey / cookie `access_token` | cookie `httpOnly`, 15 min | `/auth/login`, `/auth/google`, `/auth/refresh` | `isAuthenticated`, `isOptionallyAuthenticated` | toutes les routes membre |
| `bearerAuth` | http bearer (JWT) | `Authorization: Bearer <access_token>` | idem (🚪 le jeton n'est aujourd'hui lisible que dans le cookie) | idem | toutes les routes membre |
| cookie `refresh_token` | cookie `httpOnly`, session ou 30 j | `POST /auth/refresh`, `requireSudo` (lecture du `jti`) | `/auth/login`… | `refreshAuthTokens` + Redis (`jti`) | rotation, fenêtre sudo |
| `adminCookieAuth` | apiKey / cookie `admin_access_token` | cookie `httpOnly`, 15 min ; JWT `adm: true`, `amr: ["pwd","totp"]` | `POST /auth/admin/totp/verify` (ou `enable`) | `isAdminAuthenticated` puis `requireAdminPermission` | routes `/admin/*` (+ `x-permission`) |
| cookie `admin_preauth` | cookie `httpOnly`, 5 min | entre le mot de passe et le TOTP | `POST /auth/admin/login` | routes `totp/*` | étape 2 de la connexion admin |
| cookie `admin_refresh_token` | cookie `httpOnly` | `POST /auth/admin/refresh` | `totp/verify` | Redis `admin_jti:` | rotation admin |
| fenêtre sudo | clé Redis `sudo:<userId>:<jti>`, 15 min | aucune donnée client : liée à la session | `POST /auth/me/sudo/verify` | `requireSudo` | 5 gestes sensibles |
| signature Stripe | en-tête `stripe-signature` sur le corps brut | — | Stripe | `constructStripeWebhookEvent` (deux secrets) | `POST :6003/webhooks/stripe` |
| signature Svix | `svix-id`, `svix-timestamp`, `svix-signature` | — | Resend | `verifySvixSignature` | `POST /api/webhooks/email/resend` |
| jeton de suivi | segment d'URL `/track/{token}` (32 octets CSPRNG, base64url) | — | `POST /deals/{id}/tracking-link` | `GET /track/{token}` (404 si révoqué) | page destinataire |
| jeton d'invitation admin | corps de `POST /auth/admin/invite/accept` | — | `POST /admin/admins/invite` | acceptation | création d'un compte admin |
| `verificationToken` OTP | corps des routes `register/*`, `password/*` | — | `POST /auth/register`, `/auth/password/verify` | Redis (10 min) | inscription, réinitialisation |

Toutes les routes publiques (recherche, trajet public, profil public, paramètres de prix, page destinataire, statut, maintenance, inscription, connexion) sont déclarées « Authentification : aucune » dans la référence.

### 8.2 Variables d'environnement côté client

| Variable | Application | Rôle |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | user-ui, admin-ui | Base des appels API : `/api` (même origine, D48, recommandé) ou `http://<hôte>:8080/api`. Le client axios tolère les deux formes. |
| `API_PROXY_TARGET` | user-ui, admin-ui (`next.config.js`) | Cible du proxy Next `/api/*` → gateway (`http://localhost:8080`). Sans elle, comportement historique (URL absolue). |
| `NEXT_PUBLIC_SERVER_URI` | user-ui | Adresse historique du serveur (héritage, à ne plus utiliser pour de nouveaux appels). |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | user-ui | Autocomplétion Google Places (adresses des trajets et alertes). |
| `NEXT_PUBLIC_SENTRY_DSN` | user-ui, admin-ui | Sentry front (`instrumentation-client.ts`). Inerte si absent. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | user-ui | PostHog, chargé **après** acceptation du bandeau de consentement seulement. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | user-ui | Adresse affichée dans les pages d'erreur et de sanction. |
| `NEXT_PUBLIC_USER_UI_LINK` | admin-ui | Lien vers le front membre depuis le back-office. |
| `allowedDevOrigins` (`next.config.js`) | user-ui | Requis pour tester depuis une IP LAN avec Next 16 (sinon 403 sur `/_next/*`). |

Côté serveur, les variables qui **changent le comportement observable par un client** : `MAINTENANCE_MODE`, `MAINTENANCE_MESSAGE_FR/EN` (503), `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` (501 sinon), `RESEND_WEBHOOK_SECRET` (503 sinon), `SESSION_INACTIVITY_TIMEOUT_MINUTES`, `SESSION_STANDARD_LIFETIME_DAYS`, `SESSION_REMEMBER_INACTIVITY_DAYS`, `SESSION_ABSOLUTE_LIFETIME_DAYS` (politique de session), `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_URL_ENDPOINT` (absents → `publicKey` / `urlEndpoint` manquent dans la signature), `KAFKA_BROKERS`, `OUTBOX_RELAY_ENABLED`, `NOTIFICATION_CONSUMER_ENABLED` (pipeline d'événements), `APP_VERSION` / `GIT_SHA` (champ `version` des `/health`).

### 8.3 Glossaire

| Terme | Définition |
|---|---|
| **Expéditeur** (shipper) | Membre qui réserve l'acheminement d'un colis. Vue `ShipperBookingView`. |
| **Voyageur** (carrier, « Yamber » / « Tripper » dans l'interface) | Membre qui publie un trajet et transporte ; rôle `CARRIER` obtenu à la fin de l'onboarding. Vue `CarrierBookingView`. |
| **Destinataire** (recipient) | Tiers sans compte qui reçoit le colis ; connu par un instantané dans le deal, informé par le lien de suivi. |
| **Trajet** (trip) | Annonce d'un Voyageur : corridor, dates, capacité en kg, prix au kilo, catégories, points de récupération et de remise. Statuts `DRAFT`, `PUBLISHED`, `PAUSED`, `COMPLETED`, `CANCELLED`, `ARCHIVED`. |
| **Deal** (booking) | La réservation d'un colis sur un trajet ; machine à 9 statuts ; cinq instantanés figés. |
| **Devis** (quote) | Calcul du prix par le moteur unique (`@packages/pricing`, D34), recalculé côté serveur et figé dans le deal (D17). |
| **Intention de paiement** | Autorisation du montant chez le fournisseur avant la demande (capture manuelle à l'acceptation, D31/D37). |
| **Code de livraison** | Six chiffres générés à la récupération, donnés de vive voix par l'Expéditeur au destinataire, saisis par le Voyageur à la remise (D43). |
| **Fenêtre de vérification** | 4 jours après la remise pendant lesquels l'Expéditeur confirme ou conteste ; à l'échéance, confirmation automatique et versement. |
| **Versement** (payout) | Transfert Stripe Connect du net Voyageur (`transportCents`) ; statuts `PENDING`, `SENT`, `FAILED`, `FROZEN`… |
| **Litige** (dispute) | Contestation de l'Expéditeur, ticket `YAM-XXXX`, versement gelé, décision par un médiateur. |
| **Double aveugle** | Notation révélée quand les deux parties ont noté, ou à 14 jours. |
| **Conversation / Rendez-vous / Révélation du numéro** | Objets du message-service (D61) : un fil par deal dès l'acceptation, un rendez-vous comme objet, un numéro ouvert au plus tôt 2 h avant. |
| **Fenêtre sudo** | 15 minutes de « présence prouvée » liées à la session, exigées avant un geste sensible (D65). |
| **Outbox / relais / topic** | Événement écrit dans la transaction du changement d'état, relayé vers Kafka (`booking-events`, `messaging-events`) et consommé avec dédoublonnage (D2). |
| **Instantané** (snapshot) | Copie figée d'une donnée (prix, trajet, destinataire) dans le deal, jamais recalculée depuis la source. |
| **`allowedActions`** | Liste, calculée par le serveur, des transitions permises à l'appelant sur un trajet ou un deal ; seule source des boutons du client. |
| **Porte** 🚪 | Point de décision volontairement laissé ouvert ou à durcir, tracé dans le registre. |
| **Profils admin** | `SUPER_ADMIN`, `MEDIATOR`, `SUPPORT`, `FINANCE`, `OPS`, `PRIVACY` ; cumulables (union des permissions). |
| **Compte restreint / suspendu** | Sanctions `RESTRICTED` (plus de création) et `SUSPENDED` (plus de session), appliquées par les lectures seulement. |
| **Liste de suppression** | Adresses email marquées après rebond dur ou plainte ; plus aucun envoi. |

### 8.4 Recommandations d'expert (hors périmètre livré)

Cette section est **clairement séparée** de la description de l'existant : rien de ce qui suit n'est implémenté, et chaque point devrait, s'il est retenu, faire l'objet d'une entrée du registre des décisions avant tout code.

1. **Jetons dans le corps pour le mobile** — livrer la variante gravée par D36 : `POST /auth/login` et `POST /auth/refresh` acceptant `Accept: application/json` avec `{ accessToken, refreshToken, expiresIn }` et un `refresh_token` accepté dans le corps, en gardant les cookies pour le web. Prérequis du jalon 4.
2. **Liste « safe » des `details`** — remplacer la liste blanche par type par une **classe d'erreur typée** (`BusinessError` avec `code` toujours exposé, `debug` jamais exposé) : la porte `SUDO_REQUIRED` / message-service en production disparaît structurellement.
3. **Sémantique 403/404 du trip-service** — la PR `fix/error-semantics` cataloguée ; un client générique ne peut pas distinguer aujourd'hui une saisie invalide d'un trajet introuvable.
4. **Versionnement d'API explicite** — un préfixe `/api/v1` au gateway (réécriture transparente vers les services) et une politique écrite : champs optionnels seulement en mineur, dépréciation annoncée par un en-tête `Deprecation` / `Sunset`, suppression en majeur. Coût nul aujourd'hui, très cher à introduire après un client mobile publié.
5. **Document OpenAPI unifié** — un `openapi.json` agrégé au gateway (fusion des cinq documents, chemins préfixés `/api`, un seul espace de noms de schémas — déjà le cas par le registre commun A22), servi sur `/api/docs`. C'est la source naturelle d'un **SDK généré** (orval / openapi-generator, D3) pour TypeScript, Kotlin et Swift, avec les types de `details.code` exposés comme unions littérales.
6. **`ETag` / `If-None-Match` sur les lectures chaudes** (`GET /deals/{id}`, `GET /messages/conversations/{id}`, `GET /me/notifications`) et **`If-Match` sur les transitions** (à partir de `updatedAt`) : le verrou optimiste existe déjà côté serveur ; l'exposer par en-tête standardise le « 409 = relire ».
7. **Clés d'idempotence client** (`Idempotency-Key`) sur `POST /deals`, `POST /deals/{id}/pickup`, `/deliver`, `/dispute` et `POST /messages/.../messages` : le rejeu réseau d'un mobile en zone blanche ne créerait jamais de doublon de message ni de tentative de code comptée deux fois.
8. **Limiteur conscient de la session** — décoder le JWT au gateway (sans le vérifier en base) pour appliquer la limite de 1 000 prévue aux membres authentifiés et une limite stricte par jeton de suivi sur `/api/track/*`.
9. **Webhooks sortants pour partenaires** et **clés d'API partenaires** (par exemple un transitaire ou une boutique qui crée des demandes pour ses clients) : un `ApiKey` haché avec portées (`deals:read`, `deals:write`), un abonnement aux événements `booking.*` filtrés et re-signés (HMAC, retry exponentiel, `event-id` pour le dédoublonnage) — les payloads existants sont déjà conçus pour cela (riches, sans secret).
10. **Temps réel** — un canal SSE ou WebSocket au gateway (`/api/stream`) alimenté par les mêmes consommateurs Kafka, pour le fil de conversation et le compteur de non-lus, à la place du polling.
11. **Journal des refus** — tracer côté serveur les 403 `SUDO_REQUIRED`, `ACCOUNT_RESTRICTED` et les 409 par code (compteurs Redis) pour que la page de pilotage montre où les utilisateurs butent.
12. **Route `/docs` du message-service** et **test de couverture des routes** (comme A145) étendu aux quatre autres services : la référence générée listerait alors aussi les exports CSV admin montés dans les routeurs (`/admin/disputes/export`, `/admin/trips/export`, `/admin/tickets/export`) qui n'apparaissent pas aujourd'hui dans les documents OpenAPI. 🚪
13. **Contrat de rétention exposé** — publier dans `GET /trips/pricing/params` (ou un `GET /platform/params`) les durées que les clients affichent (fenêtre d'acceptation 24 h, vérification 4 j, notation 14 j, écriture du fil 14 j, ouverture du numéro 2 h) : elles sont réglables par l'admin (D62) et ne devraient pas être codées en dur dans les fronts.

---

*Fin du document. Les chapitres 1 à 6 et 8 sont rédigés à la main à partir du code de la branche courante ; le chapitre 7 est généré. Toute divergence constatée entre ce document et le comportement observé doit être traitée comme un défaut du document ou du code, jamais comme une interprétation.*
