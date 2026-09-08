# YAMBA — Cahier de résultats, recette API (cahier n° 3)

> Document de campagne, rempli au fil des chapitres. Il complète le tableau de suivi du §9.1 de
> `docs/recette/RECETTE-03-API.md` : celui-ci porte le verdict, celui-là porte **le pourquoi, la
> recommandation et le commentaire**. Les anomalies sont numérotées `ANO-API-<nn>` (format §9.2).

## En-tête de campagne

| Champ | Valeur |
|---|---|
| Date | 8 septembre 2026 |
| Testeur | Gomab (assisté) |
| Branche / version | `dev` — `99bc1fc` (après PR #230) |
| Base de données | MongoDB Atlas, base `development` (distante) |
| Fournisseur de paiement | **`FAKE`** — deal-service lancé depuis son bundle, `STRIPE_SECRET_KEY` vidée (§2.9). Preuve : `POST /deals/payment-intents` → `{"provider":"FAKE","clientSecret":null}` |
| Broker d'événements | **actif** — Redpanda `yamba-redpanda`, topics `booking-events` et `messaging-events` |
| Fournisseur d'email | **`smtp` (Mailpit)** — bascule de recette, interface sur `http://localhost:8026` (le port 8025 est pris par un autre projet, cf. PR #230) |
| Jeu d'essai rejoué à | 8 septembre 2026, `seed-deals.ts` — 22 bookings couvrant les 9 statuts |
| `smoke-services.sh` | **6/6 ✅** (build `--skip-nx-cache` préalable) |
| Services servis | les six depuis leurs bundles (`node --env-file`), pas `nx serve` |

## Chapitre 4 — Scénarios transverses

**22 fiches jouées, 0 ⏭.** 17 OK, 2 PARTIEL, 3 KO — dont **une KO au critère bloquant** du cahier.

| Fiche | Intitulé | Gravité | Verdict | Pourquoi | Recommandation |
|---|---|---|---|---|---|
| API-GW-01 | Sonde publique `ok` | majeure | **OK** | 200, `status:"ok"`, cinq services `reachable:true`, `ms` numérique. `Cache-Control: no-store` posé, cache de 10 s vérifié (deux appels rapprochés → même `at`). Aucune URL interne ni trace dans le corps. | — |
| API-GW-02 | Sonde `down` | majeure | **OK** | message-service coupé → 503, `status:"down"`, l'entrée muette en `reachable:false` / `status:null`, les quatre autres intactes. Retour à `ok` après redémarrage. | — |
| API-GW-03 | Santé passerelle | mineure | **OK** | 200, `service:"api-gateway"`, `uptimeSeconds` entier, contrôle `maintenance.ok:true` — et `false` avec le motif `"maintenance (env)"` une fois le mode activé. | — |
| API-GW-04 | `/health` des cinq | mineure | **OK** | 200 pour les cinq, chaque corps portant `mongo` et `redis` avec `ok` / `ms` / `error`. | — |
| API-GW-05 | État public de maintenance | mineure | **OK** | 200, `{"enabled":false,"message":{"fr":"","en":""},"scheduledAt":null}`, `no-store`, sans session. | — |
| API-GW-06 | Écriture refusée en maintenance | majeure | **OK** | 503, corps `MAINTENANCE` avec `messages.fr` / `.en` et `retryAfterSeconds:300`, en-tête `Retry-After: 300`. Effet de bord vérifié : **aucun favori créé** après la levée. | — |
| API-GW-07 | Lectures et exceptions en maintenance | majeure | **OK** | recherche 200, `POST /auth/login` 200, `/maintenance` 200 avec `enabled:true`. **Aucun 503 sur les quatre**, ce qui est le point de la fiche. | Le (d) admin a répondu **401** faute de session admin (la 2FA TOTP n'est pas ouvrable en API pure) — à rejouer au cahier Admin. |
| API-GW-08 | Plafonds 100 / 1 000 | majeure | **OK** | `RateLimit-Limit` : anonyme **100**, jeton valide **1000**, jeton forgé `Bearer aaa.bbb.ccc` **100**. Franchissement joué : 93×200 puis **17×429**, corps `{"error":"Too many requests, please try again later!"}` (forme n° 4). | Compteurs remis à zéro par redémarrage de la passerelle (store en mémoire, pas Redis) avant la suite. |
| API-GW-09 | Identifiant de corrélation | majeure | **OK** | Sans en-tête fourni : UUID v4 généré et renvoyé. Avec `recette-api-0001` : **le même** est renvoyé. | — |
| API-GW-10 | `x-locale` pilote le formatage | mineure | **PARTIEL** | Dates serveur conformes (`18 septembre 2026` / `September 18, 2026`). Mais `/messages/quick-replies` renvoie **le même texte français** quel que soit `x-locale` : le contrôleur lit `preferredLocale ?? x-locale` (`message.controller.ts:29`). Contre-épreuve décisive : `preferredLocale` passé à `en` → le texte devient `"I'm on my way."`. | **Le code a raison, le cahier a tort** : la route est documentée « dans la langue du lecteur » et c'est la doctrine du projet (la langue suit le destinataire, pas l'appelant). Corriger l'attendu de la fiche. |
| API-GW-11 | Langue non supportée | mineure | **OK** | 400, `details.type:"locale"`, `details.code:"LOCALE_UNSUPPORTED"`. Contre-épreuve `en` : 200 puis `preferredLocale:"en"`. Remis à `fr`. | — |
| API-GW-12 | Locales exotiques | mineure | **OK** | `fr-FR`, `FR`, `en-US,en;q=0.9`, `zz`, vide → **200** pour les cinq. | — |
| API-GW-13 | **`details.code` arrive au client** | **bloquante** | **OK** | (a) 409 `type:"booking"` / `code:"FAMILY_REFUSED"` · (b) 403 `code:"SUDO_REQUIRED"`, `windowMinutes:15` · (c) 400 `code:"DELIVERY_CODE_IN_MESSAGE"`. `details` présent dans les trois. | **La cible (c) du cahier est fausse** : `bzv-accepted` est ACCEPTED et n'a **pas encore** de `deliveryCodeHash` (vérifié en base), donc la garde n'a rien à comparer et le 201 était légitime. Rejoué sur `bzv-picked` (hash présent) → 400 attendu. Remplacer la cible par un deal post-pickup. |
| API-GW-14 | Erreurs par champ | mineure | **KO** | 400 obtenu mais corps `{"status":"error","message":"Invalid email format!"}` — **pas d'objet `errors`**, une seule erreur, message anglais. `validateRegistrationData` (`auth.helper.ts:163-181`) valide en séquence et jette au premier échec. | Brancher le schéma Zod `RegisterRequestSchema` sur le contrôleur, comme le fait déjà message-service (`zodErrors()`) et comme le prouve deal-service, qui renvoie bien `errors: {family, expectedTotalCents}`. Incohérence de contrat **entre services**, pas seulement un écart au cahier. |
| API-GW-15 | Aucune erreur non gérée | **bloquante** | **KO le 08/09** → corrigé le 08/09 | **Une occurrence trouvée** — voir `ANO-API-01`. Aucun autre corps collecté ne porte la forme n° 2. | Voir la fiche d'anomalie. |
| API-GW-16 | 401 sans session | **bloquante** | **OK** | 401 pour les quatre routes, corps **plat** `{"message":"Unauthorized! Token missing."}` — clé unique `message`, ni `status` ni `details`. | — |
| API-GW-17 | 403 non partie prenante | **bloquante** | **OK** | 403 `{"status":"error","message":"You are not a party to this deal."}`. **Zéro donnée du deal** dans le corps (recherche de statut, montants, nom du destinataire : 0 occurrence). Contre-épreuve : expéditrice 200, voyageur 200. | — |
| API-GW-18 | 404 sans divulgation | **bloquante** | **KO le 08/09** → corrigé le 08/09 | Les corps sont irréprochables — (a) 404, (b) 400, (c) 404 `PublicNotFound`, (d) 404, (e) 404, et un trajet **masqué** comme un profil **privé** rendent un corps **identique** à celui de l'inexistant. Mais le **temps de réponse distingue les deux états** — voir `ANO-API-02`. | Voir la fiche d'anomalie. |
| API-GW-19 | 409 conflit typé | majeure | **PARTIEL** | 409, `details.type:"booking"`, `details.code:"TRANSITION_NOT_ALLOWED"` ✅, et `allowedActions: []` sur un deal COMPLETED ✅. Mais **`details.reason` est absent** : le motif (`Action "accept" is not allowed from status COMPLETED.`) n'existe que dans le `message` anglais. | Le cahier interdit lui-même de juger sur le `message` anglais : ajouter `reason` (ou `from` / `action`) dans `details`, sinon un client ne peut pas expliquer le refus. À défaut, corriger l'attendu de la fiche. |
| API-GW-20 | Pagination recherche | majeure | **OK** | Avec `limit=1` : page 1 → 1 trajet + `nextCursor`, page 2 → l'autre, `nextCursor:null` en dernière page, `totalCount` stable à 2, **aucun identifiant commun**. Enveloppe sans `success` (documenté). | Le jeu d'essai n'expose que **2 trajets cherchables** (les autres sont passés) : la fiche est vraie mais peu démonstrative. Prévoir un trajet futur de plus au seed pour paginer sur trois pages. |
| API-GW-21 | Pagination du fil | mineure | **OK** | Fil rendu du plus ancien au plus récent, curseur = plus ancien message chargé → page antérieure **vide**, `nextCursor:null`. | Le fil contenait 3 messages et non 2 : le message de la fiche API-GW-13c y a été ajouté. Sans effet sur le verdict. |
| API-GW-22 | Listes bornées | mineure | **OK** | 3 notifications, `unreadCount:3`, et `?limit=1000` **ignoré** (toujours 3) — c'est le point de la fiche. | La borne de 50 n'est pas *démontrée* faute de volume : à rejouer sur un compte à plus de 50 notifications, ou à borner explicitement au seed. |

### Anomalies du chapitre 4

```
ANO-API-01
Fiche          : API-GW-15 (révélée en jouant API-GW-20)
Gravité        : bloquante au critère du cahier (§4.6 : toute forme n° 2 est bloquante)
                 — majeure en impact réel : lecture publique, aucune donnée exposée
Environnement  : dev 99bc1fc · Atlas development · paiement FAKE · Redpanda actif · Mailpit
Appel exact    : curl -s "http://localhost:8080/api/trips/search?limit=1&sort=earliest&cursor=null"
Corps envoyé   : — (GET)
Attendu        : 400 « Invalid query parameters: cursor », comme pour limit=51
Obtenu         : 500 {"status":"error","error":"Something went wrong, please try again!"}
                 Journal trip-service : PrismaClientKnownRequestError P2023
                 « Malformed ObjectID: invalid character 'n' … "null" » dans searchTrips
Reproductible  : oui (3/3) — cursor="null", "abc", "pas-un-objectid" ; 200 avec un ObjectId
                 bien formé mais inexistant, et 200 avec cursor vide
Impact         : un client qui renvoie littéralement son nextCursor (null sérialisé en "null" —
                 le bug d'intégration le plus courant sur une pagination par curseur) reçoit un
                 500 au lieu d'une page vide ou d'un 400. Une entrée non validée atteint Prisma ;
                 chaque appel produit une alerte Sentry et pollue la surveillance.
Piste          : apps/trip-service/src/dto/trip-search.dto.ts:110 — `cursor: z.string().optional()`
                 sans contrainte de format, alors que `limit` juste en dessous est borné (ligne 111).
                 Correction d'une ligne : `.regex(/^[a-f0-9]{24}$/i)` ou l'ObjectIdSchema partagé.

CORRECTION       : 08/09/2026 — apps/trip-service/src/dto/trip-search.dto.ts
                   `cursor` validé au format ObjectId, la chaîne VIDE valant « pas de
                   curseur » (un client qui envoie toujours `?cursor=` demande la page 1 :
                   la première rédaction du correctif la refusait, régression rattrapée
                   avant la PR et couverte par un test).
                   Tests : apps/trip-service/src/dto/trip-search.dto.spec.ts (9 cas).
CONTRE-ÉPREUVE   : cursor="null" → 400 « Identifiant MongoDB invalide (24 hex attendus) »
                   cursor="abc"  → 400 · cursor="" → 200 (page 1, 1 trajet)
                   cursor=ObjectId bien formé → 200 · aucune trace P2023 au journal
ÉTAT             : CLOSE
```

```
ANO-API-02
Fiche          : API-GW-18
Gravité        : bloquante au critère du cahier (« temps de réponse notablement différent »)
                 — à arbitrer : majeure en pratique, le canal exige des mesures répétées
Environnement  : idem
Appel exact    : # trajet masqué par Yamba (hiddenByAdminAt posé en base) contre inexistant
                 curl -s -o /dev/null -w '%{time_total}\n' "$BASE/trips/<id-masqué>/public"
                 curl -s -o /dev/null -w '%{time_total}\n' "$BASE/trips/000000000000000000000000/public"
Attendu        : même statut, même corps ET temps indiscernables
Obtenu         : statut et corps IDENTIQUES ✅ — mais, sur 25 mesures chacun :
                 · trajet masqué     médiane 32,8 ms (min 30,2 / max 64,7)
                 · trajet inexistant médiane 12,2 ms (min 11,2 / max 20,4)
                 · profil privé      médiane 26,5 ms (min 22,8 / max 30,7)
                 · profil inexistant médiane 11,3 ms (min 10,2 / max 15,2)
                 Distributions DISJOINTES dans les deux cas (min du masqué > max de l'inexistant).
Reproductible  : oui (25/25 sur deux routes de deux services différents)
Impact         : un tiers peut énumérer les ressources qui existent mais lui sont cachées —
                 trajets masqués par la modération, profils privés — par la seule mesure du
                 temps, sans jamais lire une donnée. C'est exactement ce que la règle 403/404
                 cherche à empêcher.
Piste          : trip.controller.ts:1098-1135 — le findUnique charge le trip ET trois jointures
                 (user, avatar, carrierPage) AVANT de tester isDeleted / status / hiddenByAdminAt
                 ligne 1133. L'inexistant ne paie aucune jointure, le masqué les paie toutes.
                 Correctif : porter la visibilité dans le `where` de la requête, en respectant le
                 piège maison Prisma+Mongo sur les champs ABSENTS
                 (`OR: [{hiddenByAdminAt: null}, {hiddenByAdminAt: {isSet: false}}]`).
                 Même schéma à corriger sur le profil public (auth-service).

CORRECTION       : 08/09/2026 — la visibilité descend dans la REQUÊTE, des deux côtés :
                   · apps/trip-service/src/lib/public-visibility.rules.ts → publicTripWhere()
                     (publié + non supprimé + non masqué, avec le OR isSet:false du piège Mongo)
                   · apps/auth-service/src/utils/public-visibility.ts → publicProfileWhere()
                     (non supprimé + public OU consulté par son propriétaire — D67 1A préservée)
                   Les deux contrôleurs passent de `findUnique` à `findFirst` (un critère non
                   unique est interdit sur findUnique). Le test applicatif est conservé en
                   ceinture et bretelles. Tests : les deux .spec.ts voisins (7 cas).
CONTRE-ÉPREUVE   : mêmes 25 mesures, après correction —
                   · trajet masqué     médiane 13,6 ms (min 12,3 / max 29,6)
                   · trajet inexistant médiane 13,5 ms (min 11,8 / max 18,1)
                   · profil privé      médiane 12,5 ms (min 10,4 / max 17,6)
                   · profil inexistant médiane 12,3 ms (min 10,6 / max 21,6)
                   Distributions désormais SUPERPOSÉES, corps toujours identiques.
                   Non-régressions vérifiées : trajet publié → 200 · profil masqué vu par un
                   tiers → 404 · profil masqué vu par SON propriétaire → 200 (D67 1A).
ÉTAT             : CLOSE
```

```
ANO-API-03
Fiche          : API-GW-14
Gravité        : mineure
Appel exact    : curl -s -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
                   -H 'x-locale: fr' -d '{"firstName":"A","lastName":"B","email":"pas-un-email",
                   "password":"123","termsAccepted":true,"termsVersion":"2026-06-01",
                   "privacyVersion":"2026-06-01"}'
Attendu        : 400 + objet `errors` au premier niveau ({"email": "…", "password": "…"})
Obtenu         : 400 {"status":"error","message":"Invalid email format!"} — aucun `errors`,
                 seule la PREMIÈRE erreur rencontrée est signalée
Reproductible  : oui
Impact         : le front ne peut pas afficher les erreurs sous chaque champ à l'inscription ;
                 l'utilisateur corrige une erreur à la fois. Incohérence avec deal-service et
                 message-service, qui renvoient bien un `errors` champ par champ.
Piste          : apps/auth-service/src/utils/auth.helper.ts:163-181 (validation séquentielle
                 legacy). Le contrat Zod existe déjà mais ne garde pas encore ces contrôleurs
                 (dette connue, member-auth.schema.ts).
CORRECTION       : 08/09/2026 — la règle sort du contrôleur : apps/auth-service/src/utils/
                   registration-rules.ts (`collectRegistrationErrors`), pure, sans Redis ni
                   Prisma, testable telle quelle comme password-rules et otp-policy à côté.
                   TOUS les champs sont examinés ; l'erreur porte `details.errors`
                   { champ → code } (REQUIRED, INVALID_FORMAT, TERMS_NOT_ACCEPTED). Le mot de
                   passe garde ses règles propres : quand il est le SEUL fautif, son erreur
                   typée (`details.type: "password"` + code) est relayée telle quelle.
CONTRE-ÉPREUVE   : email invalide + mot de passe court → 400
                   {"errors":{"email":"INVALID_FORMAT","password":"PASSWORD_TOO_SHORT"}}
                   mot de passe seul fautif → 400 {"type":"password","code":"PASSWORD_TOO_SHORT"}
ÉTAT             : CLOSE
```

```
ANO-API-04
Fiche          : API-GW-19
Gravité        : mineure
Appel exact    : curl -s -X POST "$BASE/deals/<deal COMPLETED>/accept" -b carrier.txt \
                   -H 'Content-Type: application/json' -d '{"charterAccepted":true}'
Attendu        : 409 + details.type + details.code + details.reason (motif de la machine à états)
Obtenu         : 409 {"status":"error","message":"Action \"accept\" is not allowed from status
                 COMPLETED.","details":{"type":"booking","code":"TRANSITION_NOT_ALLOWED"}}
                 — le motif n'existe que dans le `message` anglais, `details.reason` absent
Reproductible  : oui
Impact         : le cahier interdit de juger un refus sur le message anglais ; un client ne peut
                 donc pas expliquer POURQUOI la transition est refusée sans parser de l'anglais.
Piste          : la machine à états connaît `from`, `to` et `action` — les exposer dans `details`.
```

### Écarts du cahier (à corriger dans le cahier, pas dans le code)

1. **API-GW-13 (c)** vise `bzv-accepted`, un deal ACCEPTED **sans code de livraison** : la garde ne peut pas se déclencher et le 201 obtenu est correct. Cible à remplacer par un deal post-pickup (`bzv-picked`), où le refus 400 `DELIVERY_CODE_IN_MESSAGE` est bien au rendez-vous.
2. **API-GW-10** attend des réponses rapides traduites par `x-locale` alors que le service suit — délibérément et conformément à la doctrine — la langue **du lecteur** (`preferredLocale`).
3. **API-GW-20** suppose plus de deux trajets cherchables ; le jeu d'essai n'en publie que deux dans le futur.

### Commentaire de chapitre

Les gardes qui protègent l'argent et les données tiennent : `details.code` arrive au client dans les
trois familles de refus (API-GW-13, bloquante), le 401 est plat et muet, le 403 ne laisse **rien**
filtrer du deal, la maintenance bloque les écritures sans jamais bloquer la connexion, et le
limiteur distingue un jeton **vérifié** d'un simple cookie présent — la correction A147 tient.

Les deux vrais défauts sont d'une autre nature : ce sont des **fuites par le canal secondaire** et
des **entrées non validées**. `ANO-API-02` est le plus intéressant du chapitre : le corps est
parfait, le statut est parfait, et pourtant la ressource cachée se trahit par 20 ms d'écart, sur
deux services indépendants — signe que la règle « vérifier la visibilité dans la requête, pas
après » n'est écrite nulle part. `ANO-API-01` rappelle qu'un paramètre de pagination est une entrée
utilisateur comme une autre.

Aucune de ces deux anomalies n'est un défaut de conception : les deux se corrigent dans une PR
courte, respectivement une ligne de schéma et deux clauses `where`.

## Suivi des anomalies

L'historique est conservé : un KO reste écrit KO, sa correction s'ajoute en dessous.

| Anomalie | Fiche | Gravité | Constat | État | Correction |
|---|---|---|---|---|---|
| ANO-API-01 | API-GW-15 / 20 | bloquante (critère cahier) | 08/09/2026 | **close** | validation du curseur + test — même campagne |
| ANO-API-02 | API-GW-18 | bloquante (critère cahier) | 08/09/2026 | **close** | visibilité dans le `where`, deux services + tests |
| ANO-API-03 | API-GW-14 | mineure | 08/09/2026 | **close** | règle pure `collectRegistrationErrors` + tests |
| ANO-API-04 | API-GW-19 | mineure | 08/09/2026 | ouverte | à grouper avec le domaine deal (chapitre 5.3) |
| ANO-API-05 | API-AUTH-03 / 05 | majeure | 08/09/2026 | **close** | 409 / 401 / 429, classes d'erreur enrichies |
| ANO-API-06 | API-AUTH-09 | **bloquante** | 08/09/2026 | **close** | liste blanche + test lisant le schéma Prisma |
| ANO-API-07 | API-AUTH-11 / 12 / 13 | majeure | 08/09/2026 | **close** | `jti` dans le jeton d'accès — registre **D75 candidate** |
| ANO-API-08 | API-AUTH-14 | **bloquante** | 08/09/2026 | **close** | envoi détaché de la réponse (forgot ET resend) |
| ANO-API-09 | API-AUTH-22 / 24 / 25 | **bloquante** | 08/09/2026 | **close** | champ corrigé + test lisant le schéma ; API-AUTH-24 enfin jouée (OK) |

**Huit anomalies sur neuf sont closes.** Seule `ANO-API-04` (mineure, `details.reason` absent du
409 de transition) reste ouverte : elle appartient au domaine **deal**, et sera groupée avec le
chapitre 5.3 comme le demande le cahier. État du critère de sortie n° 1 du §9.3 (« zéro anomalie bloquante ouverte ») : tenu pour le
chapitre 4 ; **trois bloquantes ouvertes** au
chapitre 5.1 — `ANO-API-08`, `ANO-API-09`, et la bloquante `API-AUTH-24` reste **sans verdict** tant
que l'export ne fonctionne pas.

**Référence de tests après corrections** : trip-service 209 → **221**, auth-service 183 → **192**
(plateforme 860 → **877**), `CLAUDE.md` mis à jour.

## Chapitre 5.1 — auth-service (terminé)

**34 fiches : 32 jouées, 2 ⏭.** 24 OK, 8 KO — dont **trois bloquantes** (une close, deux ouvertes).
Les deux ⏭ (API-AUTH-24 et 25) ne sont pas un choix : elles portent sur le contenu de l'export,
et l'export lui-même échoue (`ANO-API-09`).

| Fiche | Intitulé | Gravité | Verdict | Pourquoi | Recommandation |
|---|---|---|---|---|---|
| API-AUTH-01 | Démarrer une inscription | majeure | **OK** | 200, `verificationToken` de 64 caractères. **Rien en base** : `POST /auth/login` sur ce compte répond 401. Le code à six chiffres est arrivé dans Mailpit, en français, expéditeur `no-reply@yamba.test`, objet « Ton code d'activation Yamba » (tutoiement conforme aux décisions du 03/09). | — |
| API-AUTH-02 | Consentement obligatoire | majeure | **OK** | `termsAccepted:false` → 400 ; sans `termsVersion` → 400 avec un motif distinct. | — |
| API-AUTH-03 | Email déjà pris | majeure | **KO** | `details.code:"EMAIL_ALREADY_USED"` et `details.type:"register"` sont bien là, mais le statut est **400**, pas 409. | Voir `ANO-API-05` — l'OpenAPI documente 409. |
| API-AUTH-04 | Mot de passe faible | mineure | **OK** | 400, `details.type:"password"`, `details.code:"PASSWORD_TOO_SHORT"`, `details.field:"password"`. | — |
| API-AUTH-05 | Code faux, compteur | majeure | **KO** | La mécanique est **exacte** : `attemptsLeft` 4→3→2→1, puis `OTP_INVALIDATED` avec `locked:true` et `lockUntilSeconds:60` (premier palier), puis `OTP_LOCKED` — et le **bon** code est refusé pendant le verrou, ce qui est le comportement voulu. Mais les statuts sont **400** partout, au lieu de 401 (code faux) et 429 (verrou). | Voir `ANO-API-05`. |
| API-AUTH-06 | Bon code, sans session | majeure | **OK** | 201, `{"success":true}`, et **`grep -c access_token` = 0** : aucune session n'est ouverte à la vérification. | — |
| API-AUTH-07 | Jetons en cookies seulement | **bloquante** | **OK** | 200. Le corps ne porte que `message` et `user` (id, email, firstName, lastName, roles) — **aucun** `accessToken`, `refreshToken` ni `passwordHash`. Deux `Set-Cookie` **HttpOnly** + `SameSite=Lax` : `access_token` Max-Age **900 s**, `refresh_token` Max-Age **2 592 000 s** (30 j avec `rememberMe`). Les anciens cookies sont expirés avant d'être réécrits. | — |
| API-AUTH-08 | 401 indistinguable | **bloquante** | **OK** | Mot de passe faux et compte inconnu : **401 tous les deux**, corps rigoureusement identiques (`Invalid email or password`). | — |
| API-AUTH-09 | `/auth/me` sans secret | **bloquante** | **KO le 08/09** → corrigé le 08/09 | `passwordHash` est bien retiré, mais quatre champs TOTP sortent : `totpSecretEncrypted`, `totpBackupCodeHashes`, `totpEnabledAt`, `totpLastUsedStep` — plus les champs de modération `suspensionProposed*`. | Voir `ANO-API-06`. |
| API-AUTH-10 | Rotation de session | majeure | **OK** | `POST /auth/refresh` → 200 `{success:true}` sans jeton dans le corps ; le pot mis à jour ouvre `/auth/me` (200) ; **l'ancien pot répond 401** (« Session expired or invalid »). Un jeton de rafraîchissement ne sert bien qu'une fois. | — |
| API-AUTH-11 | Mes appareils | majeure | **KO** | La liste est juste (deux sessions, une seule `current:true`, `device` / `ip` / dates) et la révocation répond 200 `{ok:true}` — mais la session révoquée **continue d'ouvrir `/auth/me` (200)**. Seul `/auth/refresh` est coupé (401). | Voir `ANO-API-07`. Écart de cahier au passage : la réponse s'appelle `items[]`, pas `sessions[]`. |
| API-AUTH-12 | Mot de passe révoque les sessions | majeure | **KO** | La chaîne complète marche : `sudo/request` → code lu dans Mailpit → `sudo/verify` (200, `active:true`) → changement accepté ; l'ancien mot de passe répond 401, le nouveau 200. Mais **les autres sessions gardent l'accès** : `/auth/me` répond encore 200 sur l'autre appareil, seul `/auth/refresh` est coupé. | Voir `ANO-API-07` — c'est la troisième surface touchée. Écart de cahier : `sudo/verify` attend le champ **`code`**, pas `otp`. |
| API-AUTH-13 | Déconnexion | majeure | **KO** | 200 puis 401, et le pot ne porte plus de cookie — mais avec **une copie du pot prise avant** le logout, `/auth/me` répond toujours **200**. Seul le rafraîchissement est révoqué : la déconnexion est côté client, pas côté serveur. | Voir `ANO-API-07`. |
| API-AUTH-14 | Mot de passe oublié muet | **bloquante** | **KO** | Corps et statut rigoureusement identiques pour un compte existant et un compte inconnu ✅ — mais le **temps** trahit : **95,7 ms contre 18,8 ms** (15 mesures, min 87,0 > max 23,6). | Voir `ANO-API-08`. |
| API-AUTH-15 | Profil éditable, slug stable | mineure | **OK** | 200 sur les champs du membre, `publicSlug` **identique avant et après**. | La fiche envoie `displayName` et `bio` sur une **Expéditrice** : ces champs appartiennent à la page Voyageur, d'où un 400 `NO_CARRIER_PAGE` champ par champ — refus correct. Rejoué sur un Voyageur : 200. Cible à corriger dans le cahier. |
| API-AUTH-16 | Date de naissance invalide | mineure | **OK** | 400 avec `errors: {"birthDate":"IN_THE_FUTURE"}` puis `"TOO_YOUNG"`. **Les erreurs sont ici champ par champ** — ce qui confirme que `ANO-API-03` est propre à `/auth/register` et à sa validation historique, pas au service entier. | — |
| API-AUTH-17 | Avatar signé, URL gardée | majeure | **OK** | `/uploads/imagekit-auth` : 200 avec `token` (36), `signature` (40), `expire`, plus `publicKey` et `urlEndpoint` — l'environnement ImageKit est bien configuré. **La garde tient** : une URL étrangère est refusée en 400 (« must belong to Yamba's media endpoint »). | Étapes 2 et 3 (téléversement réel) **⏭** : elles écrivent un fichier chez un prestataire tiers, ce qui n'a pas sa place dans une campagne API. À couvrir au cahier Web. |
| API-AUTH-18 | Profil public / masqué | **bloquante** | **OK** | **Jamais 401** : sans session, avec un tiers, avec un jeton forgé, sur `/reviews` et `/trips` → 200 partout quand le profil est public. Masqué : un tiers reçoit **404**, le propriétaire **200 avec `hidden:true`**. La seule asymétrie autorisée est bien la seule présente — et elle valide au passage le correctif `ANO-API-02` en conditions réelles. | — |
| API-AUTH-19 | Abonnements | mineure | **OK** | Abonnement 200, **rejeu sans doublon** (la liste ne porte qu'une entrée), désabonnement 200 et liste vide ensuite, refus 400 sur soi-même. | — |
| API-AUTH-20 | Préférences et consentement | mineure | **OK** | 200 sur `analyticsOptIn` et `messagingReminderEmails`. Effet de bord vérifié **en base** : une ligne `ConsentLog` `COOKIES` version `cookies-2026-09` est écrite — le consentement est tracé, pas seulement stocké. | — |
| API-AUTH-21 | Geste sensible sans fenêtre | **bloquante** | **OK** | `/auth/me/sudo` → `{active:false, expiresAt:null}` ; export, effacement et lien Stripe → **403 `SUDO_REQUIRED`** avec `windowMinutes:15`. | — |
| API-AUTH-22 | Ouvrir la fenêtre puis exporter | **bloquante** | **KO** | La fenêtre s'ouvre parfaitement (code lu dans Mailpit, `verify` 200, `active:true` avec `expiresAt` à +15 min) — puis **l'export répond 500**. | Voir `ANO-API-09`. |
| API-AUTH-23 | La fenêtre est liée à UNE session | **bloquante** | **OK** | La session d'origine a `active:true` ; l'autre appareil du **même membre** voit `active:false` et reçoit 403 `SUDO_REQUIRED` sur l'export. Un appareil compromis n'hérite de rien. | — |
| API-AUTH-24 | Export sans données d'autrui | **bloquante** | **⏭** | Non jouable : l'export échoue (`ANO-API-09`). **À rejouer en priorité après correction** — c'est une bloquante qui n'a pas encore de verdict. | — |
| API-AUTH-25 | Export trop fréquent | mineure | **⏭** | Idem. | — |
| API-AUTH-26 | Bloqueurs d'effacement | majeure | **OK** | 200, `blockers: [ACTIVE_DEAL, PENDING_REQUEST, RETENTION_HELD, ADMIN_ACCOUNT]` et `counts` détaillés ; la liste fermée est respectée. | — |
| API-AUTH-27 | Effacement bloqué | majeure | **OK** | 409, `code:"ERASURE_BLOCKED"` **à la racine** comme documenté, avec `blockers` et `counts`. | — |
| API-AUTH-28 | Effacement effectif | **bloquante** | **OK** | 200 `{success:true, erased:true}` puis **401 `ACCOUNT_DELETED`** : la session tombe immédiatement. En base : `email` et `emailNormalized` → `erased+<id>@anonymised.invalid`, `publicSlug` → `deleted-<id>`, `firstName`/`lastName` → « Membre »/« supprimé », `isDeleted:true`, `deletedAt` posé, ligne `DataRequest` `ERASURE`/`DONE`. **Aucun champ unique à `null`** (`phoneE164` l'est, mais il n'est qu'indexé — vérifié au schéma). | — |
| API-AUTH-29 | Alertes de route | mineure | **OK** | 201 avec `isActive:true` et `expiresAt` **à six mois** jour pour jour ; lecture 200 ; suppression 200. | — |
| API-AUTH-30 | Gardes des alertes | majeure | **OK** | Origine = destination → 400. Plafond : **20 créations acceptées, la 21e refusée** en 400 avec un message explicite. Nettoyage vérifié (0 restante). | — |
| API-AUTH-31 | Signaler un trajet | majeure | **OK** | 201 avec `reportId` et `createdAt`. | — |
| API-AUTH-32 | Gardes du signalement | majeure | **OK** | Les quatre gardes tiennent : 400 `OWN_TARGET`, 400 `REASON_NOT_ALLOWED` (motif d'une autre cible), **404** pour un slug inexistant, **409** sur le doublon du même auteur. | — |
| API-AUTH-33 | Onboarding Voyageur | majeure | **OK** | (1) 200, `onboardingStep` passe à `STRIPE` ; (2) 200 avec une `url` Stripe ; (3) 200 `status:"pending"` et les trois drapeaux à `false` ; (4) 200. | Deux précisions pour le cahier : le rôle `CARRIER` n'apparaît dans `roles` **qu'après renouvellement de la session** (les rôles vivent dans le jeton) ; et l'étape (4) réussit malgré un Stripe incomplet — ce n'est pas un défaut, la garde D31 est **en aval** (`deal-lifecycle.service.ts:151` refuse l'acceptation d'un deal sans `stripeOnboardingComplete` ni `stripeChargesEnabled`). |
| API-AUTH-34 | Tableau de bord sans compte Connect | mineure | **OK** | 403 `SUDO_REQUIRED` sans fenêtre, puis **409 `STRIPE_ACCOUNT_MISSING`** une fois la fenêtre ouverte : l'ordre des gardes est le bon. | — |

### Anomalies du chapitre 5.1

```
ANO-API-05
Fiches         : API-AUTH-03, API-AUTH-05
Gravité        : majeure
Constat        : auth-service répond 400 pour des refus que son PROPRE contrat OpenAPI
                 documente autrement.
                 · POST /auth/register, email déjà pris   → 400 obtenu, 409 documenté
                 · POST /auth/register/verify, code faux  → 400 obtenu, 401 documenté
                 · POST /auth/register/verify, verrouillé → 400 obtenu, 429 documenté
                 (statuts lus dans apps/auth-service/openapi.json, généré depuis les
                 contrats Zod — A145)
Reproductible  : oui, systématique
Impact         : le front web actuel décide sur `details.code` et n'est pas gêné. Un client
                 GÉNÉRÉ depuis l'OpenAPI — le client mobile de D36 est le cas prévu — code
                 des branches 409 et 429 qui ne seront jamais atteintes, et traite ces refus
                 comme de simples erreurs de saisie. Un 429 manquant prive aussi les clients
                 et les proxys de la sémantique « ralentis », la seule qu'un intermédiaire
                 comprend sans lire le corps.
Piste          : les contrôleurs d'inscription lèvent tous une ValidationError (400).
                 Il existe déjà des erreurs typées côté @packages/error-handler ; le code de
                 refus (`EMAIL_ALREADY_USED`, `OTP_INCORRECT`, `OTP_LOCKED`) est présent et
                 juste — seul le statut porté par l'erreur est à corriger.
CORRECTION       : 08/09/2026 — les trois classes de @packages/error-handler acceptent
                   désormais un `details` (AuthError, RateLimitError, ConflictError) : sans
                   lui, il fallait passer par ValidationError, donc répondre 400, pour ne pas
                   perdre le code métier. Puis EMAIL_ALREADY_USED → ConflictError (409, trois
                   sites) ; OTP_INCORRECT → AuthError (401) ; OTP_INVALIDATED et OTP_LOCKED →
                   RateLimitError (429), les deux portant un verrou.
CONTRE-ÉPREUVE   : email déjà pris → 409 `EMAIL_ALREADY_USED` ; essais OTP → 401, 401, 401,
                   401 (compteur 4→1), puis 429 OTP_INVALIDATED, puis 429 OTP_LOCKED.
                   Codes, compteurs et verrous inchangés.
ÉTAT             : CLOSE
```

```
ANO-API-06
Fiche          : API-AUTH-09
Gravité        : BLOQUANTE
Appel exact    : curl -s -b shipper.txt "$BASE/auth/me" | jq '.user | keys'
Attendu        : le document User SANS passwordHash ni aucun secret (fuites: [])
Obtenu         : 200, `passwordHash` bien retiré — mais le corps porte
                 `totpSecretEncrypted`, `totpBackupCodeHashes`, `totpEnabledAt`,
                 `totpLastUsedStep`, ainsi que `suspensionProposedReason`,
                 `suspensionProposedLevel`, `suspensionProposedByAdminId`,
                 `invitedByAdminId`, `emailSuppressedReason`, `emailNormalized`.
PREUVE         : sur un compte du jeu d'essai sans 2FA ces champs valent null / [] — ce qui
                 pouvait faire croire à un faux positif. Des valeurs factices ont donc été
                 posées en base, puis retirées : /auth/me a bien renvoyé au membre
                 `"totpSecretEncrypted":"FAKE-AES-GCM:…"`, les deux hachages de codes de
                 secours, et `"suspensionProposedReason":"Motif interne rédigé par un
                 administrateur…"`. Base restaurée après la mesure.
Reproductible  : oui
Impact         : 1. Le secret du second facteur (chiffré) et les hachages des codes de
                 secours d'un compte ADMINISTRATEUR sont lisibles par toute session de ce
                 compte : un vol de cookie ou un XSS donne de quoi attaquer le 2FA hors
                 ligne, alors que D54 en fait la garde des accès admin. La clé de
                 déchiffrement a un repli de développement hors production — deux moitiés
                 qu'il vaut mieux ne pas laisser voyager ensemble.
                 2. Un membre lit le MOTIF de modération rédigé contre lui et l'identité de
                 l'administrateur, avant même toute décision de suspension.
Piste          : apps/auth-service/src/controller/auth.controller.ts:672
                 `const { passwordHash, ...safeUser } = fullUser;`
                 C'est le `spread + delete` que les règles non négociables du projet
                 interdisent explicitement : tout champ ajouté au modèle User part vers le
                 client sans que personne ait à y penser — c'est ainsi que les champs TOTP
                 de D54, écrits bien après, sont sortis. Correctif : une liste blanche
                 explicite (`select` Prisma ou DTO), et un test qui échoue si un champ
                 inconnu apparaît dans la réponse.

CORRECTION       : 08/09/2026 — apps/auth-service/src/utils/me-projection.ts
                   `ME_USER_SELECT` (liste blanche passée en `select` Prisma) et
                   `ME_EXCLUDED_FIELDS`, où chaque exclusion porte SA RAISON en clair.
                   Le `spread + delete` disparaît du contrôleur. Sont conservés à dessein :
                   `totpEnabledAt` (dire « la 2FA est active » ne livre rien),
                   `suspendedAt` / `suspensionReason` / `suspensionUntil` (une sanction
                   PRONONCÉE est notifiée au membre, contrairement à une proposition).
                   Aucun des champs retirés n'était utilisé par user-ui ni admin-ui
                   (vérifié par recherche avant correction).
TEST             : apps/auth-service/src/utils/me-projection.spec.ts (5 cas). Le premier
                   LIT prisma/schema.prisma et échoue tant qu'un champ du modèle `User`
                   n'est pas classé — renvoyé ou explicitement exclu. Un test qui se
                   contenterait de vérifier l'absence de `totpSecretEncrypted` raterait le
                   prochain champ sensible ; celui-ci ne peut pas le rater.
CONTRE-ÉPREUVE   : mêmes valeurs factices reposées en base, /auth/me renvoie désormais
                   `fuites: []` et aucun des champs sensibles n'apparaît, tandis que
                   `totpEnabledAt`, `avatar`, `carrierPage`, `roles`, `adminRoles`,
                   `accountStatus`, `preferredLocale` restent servis. Base restaurée.
ÉTAT             : CLOSE
```

```
ANO-API-07
Fiche          : API-AUTH-11
Gravité        : majeure
Appel exact    : DELETE "$BASE/auth/me/sessions/<jti>" -b shipper.txt      → 200 {ok:true}
                 GET    "$BASE/auth/me"  -b autre-appareil.txt             → 200  (attendu 401)
                 POST   "$BASE/auth/refresh" -b autre-appareil.txt         → 401  (correct)
Attendu        : « la révocation est immédiate et côté serveur »
Obtenu         : la révocation coupe le RAFRAÎCHISSEMENT mais pas l'accès en cours : le
                 jeton d'accès reste accepté jusqu'à son expiration naturelle (15 min).
Reproductible  : oui
Impact         : « Couper cet appareil » ne coupe rien pendant un quart d'heure. C'est
                 exactement la fonction qu'un membre utilise quand il PENSE avoir été
                 compromis : pendant 15 minutes, l'attaquant garde la lecture de son profil,
                 de ses deals et de ses messages. Même limite pour le changement de mot de
                 passe (API-AUTH-12, à jouer).
Piste          : packages/middleware/isAuthenticated.ts vérifie la signature du jeton puis
                 lit l'utilisateur en base — ce qui rend d'ailleurs la SUSPENSION de compte
                 immédiate, elle — mais ne consulte aucune liste de révocation. Le `jti` est
                 déjà dans le jeton (la liste des sessions l'affiche) et Redis est déjà là :
                 un test d'existence par requête authentifiée, avec un TTL calé sur la durée
                 de vie du jeton d'accès, suffit. À défaut, raccourcir le jeton d'accès.
ÉTENDUE        : trois surfaces mesurées, toutes avec le même symptôme (accès conservé,
                 rafraîchissement coupé) —
                 · API-AUTH-11 « couper cet appareil »
                 · API-AUTH-13 « se déconnecter » (avec une copie du pot prise avant)
                 · API-AUTH-12 « changer de mot de passe », qui doit couper les autres sessions
                 La gravité tient à ce troisième cas : on change son mot de passe précisément
                 quand on se croit compromis, et l'intrus garde la lecture un quart d'heure.
CORRECTION       : 08/09/2026 — décision d'architecture proposée au registre en **D75
                   (candidate)**, comme l'exige la règle du projet. Le jeton d'accès porte
                   désormais le `jti` de sa session (émission ET rotation), et
                   `isAuthenticated` vérifie que `refresh_jti:<userId>:<jti>` existe encore —
                   la clé que auth-service posait déjà. La décision est isolée dans
                   packages/middleware/session-revocation.ts : pas de `jti` (jeton émis avant
                   le déploiement) → accepté jusqu'à expiration ; Redis muet → laissé passer
                   (une panne de cache ne déconnecte pas la plateforme, et le compte suspendu
                   ou effacé reste refusé par la lecture Mongo).
CONTRE-ÉPREUVE   : les trois surfaces, la session courante restant vivante à chaque fois —
                   · couper un appareil      → l'autre session  : 401 SESSION_REVOKED
                   · se déconnecter          → le pot d'AVANT   : 401 SESSION_REVOKED
                   · changer de mot de passe → l'autre appareil : 401 SESSION_REVOKED
ÉTAT             : CLOSE
```

```
ANO-API-08
Fiche          : API-AUTH-14
Gravité        : BLOQUANTE (« toute différence est bloquante », §5.1.3)
Appel exact    : for i in $(seq 1 15); do curl -s -o /dev/null -w '%{time_total}\n' \
                   -X POST "$BASE/auth/password/forgot" -H 'Content-Type: application/json' \
                   -d '{"email":"<adresse>"}'; done | sort -n
Attendu        : aucune différence observable entre un compte existant et un compte inconnu
Obtenu         : statut 200 et corps identiques ✅ (« If an account exists, an OTP has been
                 sent to the email. ») — mais, sur 15 mesures :
                 · compte existant   médiane 95,7 ms (min 87,0 / max 113,6)
                 · compte inexistant médiane 18,8 ms (min 12,1 /  max 23,6)
                 Distributions DISJOINTES : un seul appel suffit à trancher.
Reproductible  : oui (15/15)
Impact         : énumération de comptes. Savoir qu'une adresse a un compte Yamba est une
                 donnée personnelle en soi, et c'est le point de départ classique du bourrage
                 d'identifiants. Le soin pris à rendre le corps identique est annulé par la
                 mesure du temps — c'est le même motif qu'ANO-API-02, sur une autre surface.
Piste          : l'envoi de l'email est fait DANS la requête (SMTP synchrone) : le compte
                 existant paie l'aller-retour au serveur d'envoi, l'inconnu ne paie rien.
                 Correctif : répondre d'abord, envoyer ensuite (l'envoi ne conditionne pas la
                 réponse, qui est volontairement muette) — ou aligner les deux chemins.
                 Le même raisonnement vaut pour `/auth/register/resend` et pour tout point
                 d'entrée public qui envoie un email selon l'existence d'un compte.
CORRECTION       : 08/09/2026 — compteurs anti-abus ET envoi partent en arrière-plan dans
                   `envoyerSansRienReveler` : la réponse ne dépend plus de rien de ce qui
                   suit, ni par son corps, ni par son statut, ni par son temps. Appliqué à
                   /auth/password/forgot ET /auth/password/resend, qui portait la même fuite.
                   Effet voulu : un compte existant en cooldown recevait une erreur là où un
                   compte inconnu recevait 200 — cette seconde fuite, non temporelle, se
                   referme aussi (le cooldown est désormais journalisé).
CONTRE-ÉPREUVE   : 15 mesures — existant 21,6 ms (13,9 / 41,3), inexistant 19,3 ms
                   (12,9 / 24,8) : plages largement superposées. Corps identiques, et les
                   emails arrivent toujours dans Mailpit.
ÉTAT             : CLOSE
```

```
ANO-API-09
Fiche          : API-AUTH-22 (bloque aussi API-AUTH-24 et 25)
Gravité        : BLOQUANTE
Appel exact    : curl -s -X POST "$BASE/auth/me/data-export" -b shipper.txt   (fenêtre sudo ouverte)
Attendu        : 200, l'export des données du membre, en-tête Content-Disposition,
                 et une ligne DataRequest de type EXPORT
Obtenu         : **500** {"status":"error","error":"Something went wrong, please try again!"}
                 Journal auth-service : PrismaClientValidationError sur db.booking.findMany()
                 dans buildDataExport — « Unknown field `ticketNumber` for select statement
                 on model `Booking` ».
Reproductible  : oui, systématique — la fonction ne peut PAS marcher
Cause          : apps/auth-service/src/services/privacy.service.ts:155 sélectionne
                 `ticketNumber` sur `Booking`. Vérifié au schéma : **`Booking` n'a pas ce
                 champ** (il porte `disputeTicket`, « copie du Dispute.ticketNumber ») ;
                 `ticketNumber` appartient au modèle `Dispute`. La ligne 180 lit ensuite
                 `b.ticketNumber`.
Impact         : le droit d'accès du RGPD (D63) est **entièrement inopérant** : aucun membre
                 ne peut obtenir ses données. C'est une obligation légale, et le geste est
                 mis en avant dans l'interface. S'y ajoute un 500 de forme n° 2, que le §4.6
                 qualifie de bloquant à lui seul.
Pourquoi les tests ne l'ont pas vu : privacy.service.spec.ts existe et passe — il injecte un
                 faux Prisma, qui ne valide aucun nom de champ. C'est le piège déjà consigné
                 au chapitre 100 de l'apprentissage (« ces objets ne signalent jamais ce qui
                 leur manque »), rencontré ici dans l'autre sens : le mock accepte un champ
                 qui n'existe pas.
Piste          : corriger le select (`disputeTicket`) et la projection, puis se donner un
                 garde-fou qui ne dépende pas du mock — par exemple un test qui confronte les
                 champs demandés au modèle de prisma/schema.prisma, comme le fait déjà
                 me-projection.spec.ts depuis ANO-API-06.
CORRECTION       : 08/09/2026 — `ticketNumber` → `disputeTicket` dans le select et dans la
                   projection (privacy.service.ts:155 et 180).
TEST             : apps/auth-service/src/services/privacy-export-fields.spec.ts — il ne mocke
                   rien : il LIT le source de l'export, en extrait chaque `db.<modèle>… select`
                   et confronte les champs à prisma/schema.prisma. Vérifié qu'il échoue bien
                   quand on réintroduit le bug (« Booking.ticketNumber »).
CONTRE-ÉPREUVE   : export → 200, 14 269 octets, en-tête `content-disposition: attachment;
                   filename="yamba-mes-donnees-2026-09-08.json"`, 20 rubriques.
                   **API-AUTH-24, la fiche bloquante restée sans verdict, est enfin jouable et
                   PASSE** : code de livraison absent, VOYAGEUR (l'autre partie) totalement
                   absent — ni nom, ni email, ni téléphone —, signalements visant le membre et
                   dossiers de médiation absents. Les destinataires présents sont ceux que le
                   membre a saisis lui-même.
ÉTAT             : CLOSE
```

### Écarts du cahier (chapitre 5.1)

4. **API-AUTH-11** annonce une réponse `{ "sessions": [...] }` ; l'API renvoie `{ "items": [...] }`.
6. **API-AUTH-12** : `sudo/verify` attend le champ **`code`**, le cahier écrit `otp`.
7. **API-AUTH-15** applique `displayName` et `bio` à une **Expéditrice** : ces champs sont ceux de la page Voyageur (refus correct `NO_CARRIER_PAGE`).
8. **API-AUTH-33** : le rôle `CARRIER` n'apparaît qu'après **renouvellement de la session**.
9. **API-AUTH-11** annonce `sessions[]`, l'API renvoie `items[]`.
5. **API-AUTH-01** cite un corps `"OTP sent to your email…"` ; le service dit « OTP sent to email. Please verify your account. » (sans portée : on ne juge jamais sur le message).

## Challenge expert — auth-service (au-delà des anomalies de recette)

La recette juge des fiches ; ce qui suit est un regard d'ingénierie sur le service tel qu'il est
apparu pendant la campagne. **Rien n'est corrigé ici** : ce sont des propositions, classées par
rapport valeur / risque, à arbitrer.

### 1. `isAuthenticated` charge tout le document membre, à chaque requête, sur les six services

```ts
const user = await prisma.user.findUnique({ where: { id: decoded.id } });   // 60 champs
```

Le middleware n'utilise que `isDeleted`, `accountStatus` et `roles`. Il rapatrie pourtant les
**soixante** champs du modèle depuis Atlas (distant), à **chaque requête authentifiée de chaque
service** — `passwordHash` et `totpSecretEncrypted` compris, qui transitent donc en mémoire dans
trip-service, deal-service, message-service et notification-service sans qu'aucun n'en ait l'usage.
C'est la même racine que `ANO-API-06` : charger tout par défaut.

**Proposition** — un `select` explicite. Attention, ce n'est pas une correction de trois lignes :
`req.user` est exposé aux contrôleurs, qui lisent aussi `email` (11 usages), `preferredLocale` (7),
`firstName` (6), `emailNormalized` (4), `lastName` (2), `analyticsOptIn` (1) et — le point dur —
**`passwordHash` (3 usages)**. La bonne cible est un `select` d'une dizaine de champs, les trois
appelants de `passwordHash` relisant l'utilisateur eux-mêmes. Gain : moins de trafic sur le chemin
le plus chaud de la plateforme, et plus aucun secret hors d'auth-service. **PR dédiée**, avec la
liste des usages en preuve.

### 2. Aucune protection anti-force brute par compte sur `/auth/login`

L'OTP a des paliers de verrou soignés (1 min → 30 min → 24 h) et une alerte de sécurité par email.
La **connexion par mot de passe**, elle, n'a rien : seul le limiteur de la passerelle protège, à
100 requêtes / 15 min **par IP**. Un attaquant qui vise un compte précis depuis quelques adresses
dispose donc de plusieurs centaines d'essais par heure, et le titulaire n'est jamais prévenu.

**Proposition** — réutiliser la mécanique OTP, qui existe déjà : compteur par
`emailNormalized`, paliers, et email d'alerte au titulaire au deuxième palier. Le refus doit rester
**indistinguable** (`ANO-API-08` vient de rappeler que la fuite passe aussi par le temps) : même
corps, même statut, verrou silencieux.

### 3. La journalisation d'auth-service est en retard sur le reste de la plateforme

deal-service et message-service émettent du **pino** structuré (`{"level":30,"name":"deal-service"}`).
auth-service n'utilise pino nulle part : `user-public.controller.ts` compte **25 `console.log`** de
débogage, avec emojis et données personnelles :

```
[getUserPublic] 👀 slug=seed-aminata currentUserId=6a5c1d3b8faeca66b436c0eb
[followUser] 🎬 START - slug=… userId=…
```

Ces lignes partent en clair dans les journaux de production, sans niveau, sans corrélation, et
portent des identifiants de membres. **Proposition** : adopter pino comme les autres services, et
supprimer les traces de débogage (ou les passer en `debug`, désactivé par défaut).

### 4. Deux fichiers de 900 lignes portent l'essentiel du service

`auth.controller.ts` (900 lignes) et `user-public.controller.ts` (895) mélangent HTTP, règles
métier et accès aux données. La campagne l'a montré à ses dépens : la fuite d'`ANO-API-06` était
une ligne perdue au milieu de 900, et aucun contrôleur du service n'a de test — **il n'existe pas
un seul `*.spec.ts` de contrôleur dans auth-service**. Toute la logique HTTP n'est vérifiée que par
la recette manuelle.

**Proposition** — poursuivre le mouvement amorcé dans cette PR : sortir les règles en modules purs
(`registration-rules`, `me-projection`, `session-revocation` viennent de l'être) et les tester
unitairement. C'est ce découpage qui a permis d'écrire quatre tests là où il n'y en avait aucun.

### 5. Les rôles vivent dans le jeton, donc ils ont jusqu'à 15 minutes de retard

Constaté en jouant API-AUTH-33 : après l'octroi du rôle `CARRIER`, `roles` reste `["SHIPPER"]`
jusqu'à la reconnexion. Symétriquement, un rôle **retiré** (ou un profil admin révoqué) reste actif
jusqu'à l'expiration du jeton. Or, depuis `ANO-API-07`, le middleware lit déjà l'utilisateur en base
à chaque requête — `user.roles` est là, à jour, gratuitement.

**Proposition** — faire autorité sur les rôles lus en base plutôt que sur ceux du jeton (le jeton
les garde en repli). Coût nul, cohérence immédiate, et une révocation de privilège devient aussi
rapide qu'une révocation de session.

### 6. Deux détails à faible coût

- **`emailRegex` maison** pour valider les adresses, là où le projet a Zod partout ailleurs.
  Uniformiser éviterait les écarts entre ce que le contrat annonce et ce que le service accepte.
- **La fenêtre sensible est consommée par le changement de mot de passe** (constaté : il faut la
  rouvrir pour enchaîner un export). C'est défendable, mais ce n'est écrit nulle part — à graver
  dans D65 ou à documenter dans le cahier, sinon chaque testeur le redécouvrira.

## Challenge expert — l'argent du membre : compte Stripe du Voyageur et finances du tableau de bord

Sujet soulevé hors recette, et point aveugle réel : la campagne API vérifie que l'argent est
**correctement calculé** ; personne ne vérifiait qu'il est **correctement montré**. Inventaire
factuel (chemins et lignes vérifiés), puis propositions classées.

### A — Le parcours Stripe du Voyageur : quatre défauts qui s'enchaînent

**A1. « Configurer plus tard » clôt l'onboarding sans Stripe.** `completeCarrierOnboarding`
(`apps/auth-service/src/controller/carrier.controller.ts:396-441`) pose `onboardingStep = COMPLETE`
et `carrierStatus = ACTIVE` **sans lire un seul drapeau Stripe**, et le front propose explicitement
le bouton (`CarrierOnboardingWizard.tsx:318`, libellé « Configurer plus tard »). Constaté en recette
sur API-AUTH-33 : l'étape 4 répond **200 « Carrier onboarding complete! »** avec
`stripeOnboardingComplete: false`, `chargesEnabled: false`, `payoutsEnabled: false`.

Le Voyageur est donc « actif », publie ses trajets, reçoit des demandes — et découvre le blocage
au moment d'accepter son premier deal, face à un Expéditeur qui attend. C'est le pire moment
possible : la garde D31 (`deal-lifecycle.service.ts:151`) refuse alors avec
`CARRIER_ONBOARDING_REQUIRED`.

**Proposition** : garder le bouton (interrompre un tunnel est légitime) mais **cesser de mentir sur
l'état**. `carrierStatus` reste `ONBOARDING` tant que Stripe n'est pas opérationnel, et l'écran
« Mes trajets » porte un bandeau permanent « il vous reste une étape avant de pouvoir accepter une
demande ». Le bandeau existe déjà (`MyTripsList.tsx:611-617`) mais sa condition
(`onboardingStep !== STRIPE/COMPLETE` **et** `draftCount > 0`) ne se déclenche jamais dans ce cas.

**A2. Un compte qui redevient incomplet ne redescend jamais.** Le webhook `account.updated`
(`apps/deal-service/src/controllers/stripe-webhook.controller.ts:89-104`) écrit **exactement trois
booléens** et ne touche ni `onboardingStep` ni `carrierStatus`. Si Stripe désactive un compte
(pièce expirée, vérification échouée), le Voyageur reste `COMPLETE` / `ACTIVE`, **sans aucune
notification** — l'écriture est silencieuse. Il l'apprendra par un refus d'acceptation.

**Proposition** : sur passage à `false`, repasser `carrierStatus` à `ONBOARDING` et **prévenir par
email** — le canal existe déjà (`payout.failed` déclenche `notifyCarrierPayoutFailed`, ligne 108).

**A3. Stripe dit POURQUOI, et personne ne l'écoute.** `account.requirements` (`currently_due`,
`past_due`, `eventually_due`, `disabled_reason`) : **zéro occurrence dans tout le dépôt**. Seuls
`charges_enabled`, `payouts_enabled` et `details_submitted` sont lus
(`packages/libs/payments/src/index.ts:427-432`). La plateforme sait donc dire « ça ne marche pas »
mais **jamais** « il manque votre pièce d'identité ».

**Proposition** : stocker `requirements.currently_due` et `disabled_reason` sur `CarrierPage`, et
les traduire en une phrase actionnable. C'est le seul de ces quatre points qui demande une décision
de modèle (deux champs de plus), les autres sont du câblage.

**A4. La garde D31 ignore `stripePayoutsEnabled`.** `deal-lifecycle.service.ts:151` vérifie
`stripeOnboardingComplete` et `stripeChargesEnabled` — **pas** `payoutsEnabled`. Conséquence : un
deal peut être accepté, **l'argent de l'Expéditeur capturé** (ligne 180), pour un Voyageur qui ne
peut pas être payé. L'argent est encaissé, la prestation faite, et le versement échouera.

**Proposition** : ajouter `stripePayoutsEnabled` à la garde. Une ligne, et elle empêche d'encaisser
ce qu'on ne pourra pas reverser.

### B — Le bouton « tableau de bord Stripe » ne fonctionne pour personne

`FinancesSection.tsx:84` calcule `stripeAccountReady = Boolean(user?.carrierPage?.stripeAccountId)`.
Or `GET /auth/me` **ne projette pas `stripeAccountId`** (ni `stripePayoutsEnabled`) dans
`carrierPage`. Vérifié en conditions réelles sur un Voyageur pleinement onboardé :

```json
{"champs":["bio","id","name","onboardingStep","phoneE164","primaryAddress",
           "stripeChargesEnabled","stripeOnboardingComplete"],
 "stripeAccountId":null,"stripeOnboardingComplete":true,"stripeChargesEnabled":true}
```

Le bouton affiche donc **toujours** le toast « compte Stripe manquant », y compris pour un Voyageur
irréprochable. `useUser.ts:10` type pourtant le champ comme présent : le front et le serveur ne sont
pas d'accord, et rien ne l'a signalé. **Le défaut est antérieur à la campagne** (vérifié sur le
commit D65 `339ecc1` : le `select` ne l'a jamais porté).

**Proposition** : ajouter `stripeAccountId` à la projection — ou mieux, exposer un booléen
`stripeAccountReady` plutôt que l'identifiant d'un compte externe, que le front n'a aucune raison de
connaître. À traiter au cahier Web, c'est une anomalie front/API.

### C — Ce que le Voyageur voit de son argent, et ce qui lui manque

**Ce qui existe et fonctionne** : `GET /me/wallet` (`wallet.service.ts:91-107`) renvoie
`upcomingCents`, `pendingCents`, `blockedCents`, `sentCents`, `sentThisMonthCents` et un historique
par deal. Vérifié en recette : `{upcoming: 5500, pending: 2800, blocked: 0, sent: 6100}` avec le
corridor, la contrepartie et la date pour chaque ligne. Le socle est bon.

**C1. La commission n'est pas cachée par négligence, c'est un choix — mais il mérite d'être
réexaminé.** Le DTO Voyageur (`booking-view.mapper.ts:466-475`) est une liste blanche explicite,
commentée « GAINS uniquement — ni commission ni total Shipper » (A13). Le Voyageur voit
`transportCents`, jamais `totalShipperCents` ni `commissionCents`.

Il faut être précis sur le modèle : d'après le catalogue de paramètres, la commission est
**calculée sur le transport et payée par l'Expéditeur**, en plus. Le Voyageur touche donc
l'intégralité de `transportCents` — « ce qui reste après commission » **est** son gain affiché.
Cacher la commission n'est donc pas un vol dissimulé, et l'afficher ne changerait pas son revenu.

Mais l'argument de transparence tient quand même : un Voyageur qui ignore le prix payé par
l'Expéditeur ne peut pas juger si la plateforme est chère, ni vérifier qu'on ne rogne pas sa part.
**Proposition** : afficher au Voyageur, sur le deal terminé, une ligne « l'Expéditeur a payé X, dont
Y de frais Yamba — votre gain : Z, intégralement ». C'est plus honnête que le silence, et cela
protège Yamba de la suspicion inverse. À arbitrer, car cela touche une décision existante (A13).

**C2. Le vrai manque n'est pas la commission, c'est l'écart et la date.** Trois questions qu'un
Voyageur se pose et auxquelles rien ne répond aujourd'hui :

- *« Pourquoi mon versement est-il inférieur à mon gain annoncé ? »* — `retentionCents` (retenue
  d'annulation tardive) peut réduire le montant, et `retentionDisposition` est exposé au Voyageur
  sans explication chiffrée.
- *« Quand serai-je payé ? »* — `payoutDueAt` est servi, mais en cas d'échec **`payoutNextRetryAt`
  n'est jamais exposé au membre** : ses seuls lecteurs sont l'admin et les crons. Le Voyageur voit
  « bloqué », sans horizon.
- *« Pourquoi est-ce bloqué ? »* — `payoutFailureReason` est lu (`wallet.controller.ts:35`) puis
  **réduit à deux états grossiers** (`BLOCKED` / `PENDING`, `wallet.service.ts:77-79`). Le motif
  n'est jamais traduit pour le membre.

**C3. `blockedCents` est calculé et jamais affiché.** Le contrat le documente comme « drives the
banner » (`booking-wallet.schema.ts:51`), mais `WalletTab` n'affiche que upcoming / sent / pending
(`FinancesSection.tsx:119-128`). Le bandeau réellement utilisé s'appuie sur `useMyDeals`, pas sur ce
total. Travail serveur payé, jamais consommé.

**C4. Aucun relevé, aucun justificatif — et c'est un sujet réglementaire.** Il n'existe **aucun
export côté membre** : `/admin/finances/export` et `/admin/finances/report` sont réservés à
l'administration. Or un Voyageur perçoit des revenus qu'il doit déclarer, et une plateforme de mise
en relation européenne relève de **DAC7** : obligation de déclarer les revenus des prestataires
**et de leur en remettre une copie**. Le dossier juridique (livrable 09) mérite d'être confronté à
ce point avant l'ouverture commerciale.

**Proposition** : un relevé annuel téléchargeable (le calcul existe déjà côté admin, il faut
l'exposer au membre pour ses propres données), plus un reçu par versement.

**C5. Trou d'historique.** `toPayoutItem` (`wallet.service.ts:85`) renvoie `null` pour les deals
COMPLETED antérieurs à B4 qui n'ont pas de `payoutStatus` : ils **disparaissent** du portefeuille.
Un Voyageur de la première heure ne voit pas ses premiers gains. À traiter par une migration, sinon
la somme affichée ne réconcilie pas avec la réalité.

### D — Côté Expéditeur

Le DTO est complet (`booking-view.mapper.ts:372-393` : transport, commission, prime, total, plus
`refundAmountCents` et `retentionCents`). Il manque en revanche, comme pour le Voyageur, **tout
justificatif téléchargeable** : ni reçu de paiement, ni justificatif de remboursement. Pour un
service payé d'avance et parfois remboursé partiellement, c'est la première réclamation attendue au
support.

### E — Code mort à retirer au passage

- `apps/user-ui/src/components/dashboard/sections/WalletSection.tsx` — ancienne section, **plus
  aucun import**.
- `apps/user-ui/src/components/carrier/OnboardingBanner.tsx` — **jamais importé** (le bandeau utilisé
  est celui de `MyTripsList`).
- `apps/user-ui/src/app/[locale]/dashboard/finances/preview/page.tsx` — page **mock** accessible par
  URL, hors navigation.

### Priorisation proposée

| # | Sujet | Effort | Pourquoi maintenant |
|---|---|---|---|
| 1 | **A4** — `payoutsEnabled` dans la garde D31 | une ligne | On encaisse aujourd'hui de l'argent qu'on ne pourra pas reverser |
| 2 | **B** — le bouton Stripe mort | une ligne de projection | Un Voyageur onboardé ne peut pas ouvrir son tableau de bord |
| 3 | **A1 + A2** — l'état affiché dit la vérité, et le webhook rétrograde | petit | Le Voyageur découvre le blocage face à un client |
| 4 | **C2** — date de prochain essai, motif de blocage, explication de la retenue | moyen | Ce sont les trois questions du support |
| 5 | **A3** — lire `requirements` de Stripe | moyen (2 champs) | Transforme « ça ne marche pas » en « il manque ceci » |
| 6 | **C4** — relevé membre | moyen | Sujet **réglementaire** (DAC7) avant ouverture commerciale |
| 7 | **C1** — transparence de la commission au Voyageur | décision | Touche A13 : à arbitrer, pas à coder d'emblée |
| 8 | **C3, C5, E** — `blockedCents`, trou d'historique, code mort | petit | Dette visible, à solder en passant |

### F — L'onboarding est-il trop long ? Ce qu'on peut retirer sans rien perdre

**Ce qui est déjà bien fait, et qu'il ne faut pas casser** : le compte Stripe est créé
**prérempli** (`carrier.controller.ts:238-291`) — prénom, nom, email, téléphone, date de naissance
et adresse postale sont envoyés à `accounts.create`. Le Voyageur ne ressaisit donc pas ces champs
chez Stripe. C'est le gros du travail d'allègement, et il est fait.

Restent trois sources de frottement, par ordre de gain.

**F1. Le front exige quatre champs, le serveur en exige deux.** L'écran annonce « Tous les champs
sont obligatoires » et refuse de continuer sans **nom, bio, adresse et téléphone**
(`CarrierOnboardingWizard.tsx:228-238`). Or `validateCarrierOnboardingData`
(`auth.helper.ts:201-213`) n'exige que **`phone_number` et `country`**.

La **bio** est le champ le plus coûteux du formulaire — un texte libre, à rédiger, devant lequel on
abandonne — et c'est le seul qui ne sert **ni à Stripe, ni à encaisser, ni à accepter un deal**.
Elle n'alimente que la page publique.

**Proposition** : la rendre facultative dans le tunnel et la demander **au moment où elle sert** :
à la publication du premier trajet, quand le Voyageur cherche justement à convaincre. Gain
immédiat : le tunnel passe de quatre saisies à trois, dont deux triviales.

**F2. Expliquer pourquoi l'adresse est demandée.** Elle est nécessaire (elle préremplit Stripe et
lui évite une saisie), mais rien ne le dit : l'écran demande une adresse postale à quelqu'un qui
veut juste transporter un colis, ce qui ressemble à de la collecte gratuite. Une phrase — « pour ne
pas avoir à la ressaisir à l'étape suivante » — coûte zéro et supprime une hésitation.

**F3. Le vrai levier n'est pas le nombre de champs, c'est le MOMENT.** Aujourd'hui, un membre qui
veut devenir Voyageur doit fournir une pièce d'identité et un IBAN **avant d'avoir publié un seul
trajet**, donc avant de savoir s'il recevra la moindre demande. C'est l'effort maximal au moment de
motivation le plus faible.

Or la garde D31 ne se déclenche **qu'à l'acceptation d'un deal**
(`deal-lifecycle.service.ts:151`) — le verrou a d'ailleurs déjà migré depuis la publication de
trajet. Techniquement, rien n'oblige à faire Stripe si tôt.

Trois moments possibles :

| Moment | Effet |
|---|---|
| **Aujourd'hui** — avant tout | Effort maximal, motivation minimale : c'est là qu'on perd les Voyageurs |
| **À la première demande reçue** | Motivation maximale… mais la demande **expire** pendant que la vérification Stripe traîne : on perd le deal ET l'Expéditeur |
| **À la publication du premier trajet** *(recommandé)* | Le Voyageur est engagé, il a du temps devant lui avant les demandes, et le KYC a le temps d'aboutir |

**Proposition** : découpler. Profil minimal → publication → « avant de recevoir des demandes,
finalisez votre compte de paiement ». Cela suppose que l'état affiché soit honnête (voir **A1**) :
c'est la même correction, vue par l'autre bout. Sans elle, décaler Stripe ne ferait qu'aggraver la
surprise du refus au premier deal.

**Ce qu'il ne faut PAS raccourcir** : les étapes Stripe elles-mêmes (identité, IBAN) ne sont pas
négociables — elles sont imposées par la réglementation et par Stripe. Le seul levier est de les
préremplir (fait) et de les demander au bon moment (à faire).

## Chapitre 5.2 — trip-service (17 fiches jouées sur 18)

**13 OK · 2 PARTIEL · 1 KO · 1 ⏭.** Les deux fiches bloquantes du chapitre passent.

| Fiche | Intitulé | Gravité | Verdict | Pourquoi | Recommandation |
|---|---|---|---|---|---|
| API-TRIP-01 | Recherche publique et personnalisée | majeure | **OK** | 200 avec et sans session, enveloppe `{trips, nextCursor, totalCount}` **sans `success`** (documenté), `isFavorite` reflète bien les favoris du membre. | `rating` et `reviewCount` sont **absents** du JSON (le jeu d'essai n'a pas d'avis) : à confirmer au cahier Web, la carte les annonce. |
| API-TRIP-02 | **Filtres durs** | **bloquante** | **OK** | Aucun trajet non publié, aucun départ passé, et une borne `dateFrom=2000-01-01` ne contourne rien. **Contre-épreuve** : un trajet masqué par Yamba disparaît de la recherche (2 → 1) et revient après restauration. | — |
| API-TRIP-03 | Filtres invalides ignorés | mineure | **KO** | `categories=inventee` et `departureBuckets=matin,morning` sont bien **tolérés** (200), mais `mode=teleportation` renvoie **400**. | Voir `ANO-API-10`. |
| API-TRIP-04 | Devis et paramètres publics | majeure | **OK** | `/trips/pricing/params` lisible **sans session** (commission 12 %, plancher 8 €, kilo de référence 2 kg, prime Garantie 6 €) ; avec `weightKg`, chaque carte porte `transportForWeight` et `totalForWeight`. | — |
| API-TRIP-05 | Facettes | majeure | **OK** | 200 avec `familyCounts`, `modeCount`, `instantBookingCount`, `superTripperCount`, `profileVerifiedCount`, `verifiedTicketCount`, `totalCount`. | — |
| API-TRIP-06 | Vue publique d'un trajet | majeure | **OK** | 200, DTO public complet (lieux, dates, prix, conditions par famille, `isFavorite`). | — |
| API-TRIP-07 | Favori idempotent et gardé | majeure | **OK** | Ajout 200 puis rejeu **sans doublon** (liste = 1), retrait **idempotent** (200 deux fois). Les deux exceptions annoncées tiennent : **404** sur un trajet inexistant, **403 `OWN_TRIP`** sur son propre trajet. | — |
| API-TRIP-08 | Brouillon puis publication | majeure | **OK** | 201 `DRAFT` puis 200. **Le point de la fiche est prouvé** : `departureHourLocal` envoyé à `"03:00"` est **recalculé à 21**, et `minPriceCents` envoyé à 1 est ignoré. | — |
| API-TRIP-09 | Portes de publication | majeure | **OK** | 400 avec le motif de la machine : « A complete pricing engine is required to publish… (D13) ». | — |
| API-TRIP-10 | `allowedActions` | majeure | **OK** | Les actions varient réellement : un trajet portant des deals vivants n'expose **ni `edit` ni `cancel`**, les autres oui. | — |
| API-TRIP-11 | Cycle de vie complet | majeure | **⏭** | Non joué isolément ; ses transitions sont couvertes par 08 (publication), 12 (annulation refusée) et 15 (annulation, suppression). | À jouer pour compléter. |
| API-TRIP-12 | **Annulation refusée, deal vivant** | **bloquante** | **OK** | **409** `{"type":"trip","code":"TRIP_HAS_ACTIVE_DEALS","activeDeals":4}` — la règle **D72** tient exactement. | — |
| API-TRIP-13 | Modification, capacité immuable | majeure | **PARTIEL** | La modification partielle fonctionne (seul le champ envoyé est écrit). Mais la capacité **est modifiable après publication** (50 accepté), alors que la fiche l'annonce immuable. | **Le code a raison, le cahier est trop strict.** La vraie garde est plus fine et plus juste : **toute** modification est refusée dès qu'une réservation active existe — « Cannot edit a trip with active bookings » (vérifié : réduire la capacité à 1 kg sur un trajet à 18 kg réservés est **refusé en 400**). Le cas dangereux est donc impossible ; corriger l'attendu de la fiche. |
| API-TRIP-14 | **Trajet d'autrui** | **bloquante** | **OK** | 400 « Unauthorized. » sur lecture, modification et annulation — l'écart de sémantique annoncé par le cahier. **Ce qui compte est tenu** : aucune des trois ne réussit, le corps ne divulgue rien, et le prix reste à 1150. | — |
| API-TRIP-15 | Suppression / annulation | mineure | **OK** | « Draft deleted. » et « Trip cancelled. », puis **404** sur les deux vues publiques. | — |
| API-TRIP-16 | Déclarer un billet | majeure | **OK** | 201 « 1 document(s) added. », `ticketVerificationStatus` passe à **PENDING** ; après retrait du document il revient à **NOT_SUBMITTED**. | — |
| API-TRIP-17 | Signature de téléversement | majeure | **OK** | **401** sans session, 200 avec (token de 36 caractères + `expire`). | — |
| API-TRIP-18 | Suppression idempotente | mineure | **PARTIEL** | Le retrait d'un document répond 200, mais **le rejeu répond 400 « Document not found. »** au lieu d'être idempotent. | Aligner sur le favori et sur la session, qui sont idempotents : un second retrait doit répondre 200. À rejouer aussi sur `/uploads/:fileId`, que cette fiche vise en propre. |

### Anomalies du chapitre 5.2

```
ANO-API-10
Fiche          : API-TRIP-03
Gravité        : mineure
Appel exact    : curl -s "$BASE/trips/search?limit=3&mode=teleportation"
Attendu        : 200 — les valeurs de filtre inconnues sont ignorées silencieusement
Obtenu         : 400 « Invalid query parameters: mode: Invalid option: expected one of
                 "all"|"plane"|"train"|"car" »
Reproductible  : oui — et l'incohérence est nette : categories=inventee et
                 departureBuckets=matin,morning passent en 200, seul `mode` rejette.
Impact         : rupture de compatibilité. Un lien partagé, un favori de navigateur ou une
                 ancienne version de l'application mobile portant un mode retiré du
                 catalogue affiche une erreur au lieu d'une recherche. Les autres filtres,
                 eux, dégradent proprement.
Piste          : apps/trip-service/src/dto/trip-search.dto.ts — `mode` est un z.enum strict
                 là où les listes passent par `csvOf`, qui filtre les valeurs inconnues.
                 Un `.catch("all")` suffit à aligner le comportement.
ÉTAT           : ouverte
```

```
ANO-API-11
Fiche          : API-TRIP-01 / 04 (révélée en jouant le tri par prix)
Gravité        : majeure — masque des trajets aux Expéditeurs
Appel exact    : curl -s "$BASE/trips/search?sort=lowestPrice&limit=10" | jq '.totalCount'
                 curl -s "$BASE/trips/search?sort=earliest&limit=10"   | jq '.totalCount'
Attendu        : le tri change l'ORDRE, pas le nombre de résultats
Obtenu         : sort=earliest → 3 trajets · sort=lowestPrice → **1 trajet**, totalCount
                 passant de 3 à 1. Mesure en base : **7 trajets cherchables, 5 sans
                 `comparablePriceCents`** — donc exclus du tri.
Cause          : le tri par prix s'appuie sur `comparablePriceCents` (D33) et EXCLUT les
                 trajets qui ne l'ont pas (`where.comparablePriceCents = { not: null }`,
                 trip-search.controller.ts:259). Le code de création le calcule
                 correctement — le trajet créé pendant la recette l'avait (2400 = 1200 × 2 kg).
                 Ce sont les trajets ANTÉRIEURS à D33 qui ne l'ont pas.
Reproductible  : oui
Impact         : un Expéditeur qui trie par prix — le tri le plus utilisé d'une place de
                 marché — ne voit qu'une fraction de l'offre, et `totalCount` le lui cache.
                 Les Voyageurs concernés sont invisibles sans le savoir.
Correction     : le script `packages/libs/prisma/scripts/backfill-comparable-price.ts`
                 EXISTE (il était prévu par D33). Joué sur la base de recette :
                 « 37 trips lus, 8 mis à jour ». Après quoi sort=lowestPrice renvoie bien
                 3 trajets, ordonnés 9,50 → 11,50 → 12,00 €.
À TRANCHER     : ce script a-t-il été joué sur la base de PRODUCTION ? Si non, la même
                 amputation du tri par prix y est active aujourd'hui.
Reste à faire  : (a) le seed ne pose PAS `comparablePriceCents` — toute recette du tri par
                 prix est donc faussée tant qu'on ne rejoue pas le backfill après un seed ;
                 (b) sur le fond, exclure silencieusement est discutable : un trajet sans
                 prix comparable devrait être rangé en fin de liste, pas retiré, et
                 `totalCount` ne devrait jamais varier selon le tri.
ÉTAT           : corrigée en donnée sur la recette ; décision produit et vérification en
                 production restant à faire
```

### Écarts du cahier (chapitre 5.2)

10. **API-TRIP-13** annonce la capacité « immuable après publication » : elle ne l'est pas, et la garde réelle (aucune modification dès qu'une réservation existe) est meilleure.
11. **API-TRIP-01** liste `rating` et `reviewCount` parmi les champs d'une carte : ils n'apparaissent pas sur un jeu d'essai sans avis.
