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
| ANO-API-03 | API-GW-14 | mineure | 08/09/2026 | ouverte | à grouper avec le domaine auth (chapitre 5.1) |
| ANO-API-04 | API-GW-19 | mineure | 08/09/2026 | ouverte | à grouper avec le domaine deal (chapitre 5.3) |

Les deux mineures restent ouvertes **volontairement** : le cahier demande des PR groupées par
domaine, et les chapitres 5.1 (auth) et 5.3 (deal) sont susceptibles d'en révéler d'autres au même
endroit. Aucune anomalie bloquante n'est ouverte à ce stade — critère de sortie n° 1 du §9.3 tenu
pour le chapitre 4.

**Référence de tests après correction** : trip-service 209 → **221**, auth-service 183 → **187**
(plateforme 860 → **872**), `CLAUDE.md` mis à jour.
