# Handoff — recette navigateur (cahiers 01-WEB / 02-ADMIN) · 09/09/2026

*Ce document sert à REPRENDRE le chantier après une pause. Il dit où en est la campagne, ce qui
tourne sur le poste, ce qui reste à faire, et les pièges déjà payés qu'il ne faut pas repayer.*

> **CONSIGNE DE REPRISE (donnée le 09/09/2026).** Dans cet ordre, sans rien intercaler :
> **1.** corriger le harnais avec `storageState` (§ 4 bis) ; **2.** finir **WEB-E2E-1** en entier
> (étapes 11 à 29), puis ouvrir la PR de la branche `chore/e2e-parcours`.
>
> Puis **finir TOUTE la recette** : le reste du cahier 01-WEB (32 chapitres, 326 fiches) et le
> cahier 02-ADMIN (110 fiches).
>
> **La question Elasticsearch vient APRÈS la recette** — consigne explicite du 09/09/2026. Rien
> ne se touche du côté de la recherche tant que les deux cahiers ne sont pas clos. L'analyse est
> prête au § 8 (réponse proposée : **non**, avec une correction ciblée et Atlas Search comme voie
> de sortie) ; elle attend son tour.

---

## 1. Où en est la journée

| Livraison | État |
|---|---|
| **Cahier n° 4 — tâches planifiées** (90 fiches) | **CLOS.** 9 anomalies, 9 closes. PR **#256** + docs **#257**, mergées. Décisions **D76** et **D77** gravées au registre. Rapport : `context/YAMBA-RECETTE-CRONS-RESULTATS.md` |
| **Harnais de recette navigateur** (Playwright) | **MERGÉ** — PR **#258**. Avec `ANO-WEB-01` (bloquante) et `ANO-WEB-02` (majeure), toutes deux closes |
| **Parcours transactionnels** | **EN COURS**, branche `chore/e2e-parcours` **poussée** (commit `9e87ae8`), PR non ouverte : le parcours WEB-E2E-1 doit d'abord passer en entier |

Rapport de la campagne navigateur : `context/YAMBA-RECETTE-WEB-RESULTATS.md`.

## 2. Ce qui tourne sur le poste (à reconstituer après redémarrage)

**Yamba n'a besoin que de DEUX conteneurs Docker.** Vérifié le 09/09 en lisant le `.env` :
MongoDB est sur **Atlas** et Redis sur **Upstash** — tous deux distants. Les conteneurs locaux
`mongodb_container*`, `redis_container*`, `postgres_container*`, `mysql_container*`,
`elasticsearch_container*`, `rabbitmq_container*`, `*notification_container`, `odoo-*` et
`leko-app-mailhog-1` (dix-sept en tout) **n'ont aucun rôle dans Yamba** : ils appartiennent à
d'autres projets ou à une ancienne pile. Ils ont été arrêtés proprement avant le redémarrage.

```sh
# 1. L'infrastructure : DEUX conteneurs, pas dix-neuf
docker start yamba-redpanda yamba-mailpit

# 2. Les six services + les deux fronts
npm run dev                            # NX_SKIP_NX_CACHE=true npm run dev après un changement de code serveur

# 3. POUR LES PARCOURS SEULEMENT — deal-service avec le fournisseur de paiement FAKE
#    (voir § 4 : le Payment Element de Stripe ne se monte pas sur l'origine du poste)
kill -9 $(lsof -nP -iTCP:6003 -sTCP:LISTEN -t)
cd apps/deal-service && STRIPE_SECRET_KEY= node --env-file=../../.env dist/main.js
```

Vérification rapide : `bash scripts/smoke-services.sh`, puis `curl -s localhost:8080/api/status | jq`.

**Le harnais** : `npx nx e2e e2e` (tout), ou
`npx playwright test --config=apps/e2e/playwright.config.ts src/parcours/web-e2e-1.spec.ts`.

> **Hygiène du poste.** Ce qui charge la machine, ce sont les **huit processus Node** de
> `npm run dev` (six services + deux fronts Next en mode développement, qui recompilent à chaque
> route visitée), plus Docker, plus le navigateur. Le harnais, lui, referme ses contextes :
> vérifié au moment du handoff, **aucun** navigateur de test ne restait. Pour rendre la main à la
> machine entre deux sessions : arrêter `npm run dev`, et ne relancer que les services utiles
> (`npx nx serve auth-service` + `trip-service` + `deal-service` + la passerelle suffisent pour
> les parcours de réservation).
>
> Attention : le harnais pilote le **Chrome du poste**. Ne jamais faire `pkill -f Chrome` pendant
> une session — cela ferme aussi le navigateur personnel.

## 3. État exact de la branche `chore/e2e-parcours`

Elle contient :

- `apps/e2e/src/pages/reservation.ts` — l'assistant de réservation en quatre étapes, **complet et
  éprouvé** (famille, taille, poids, valeur, description → destinataire → Charte → paiement) ;
- `apps/e2e/src/pages/deal-voyageur.ts` — la demande côté Voyageur (gain annoncé, Charte,
  accepter / refuser) ;
- `apps/e2e/src/chapitres/web-rsv-assistant.spec.ts` — **2 scénarios verts** : le nominal
  (montants du cahier au centime : 28,75 € + 3,45 € = **32,20 €**, deal réellement créé, emails
  vérifiés des deux côtés) et les conditions du trajet (famille refusée, supplément affiché) ;
- `apps/e2e/src/parcours/web-e2e-1.spec.ts` — le **premier tiers** du parcours bloquant du
  cahier, étapes 2 à 10. Les étapes 2 à 9 sont **vertes** (le visiteur, la réservation, les
  montants, les deux emails). La dernière exécution s'est arrêtée à l'étape 10, sur la connexion
  du Voyageur — et la cause est identifiée, voir ci-dessous : **le limiteur de débit de la
  passerelle répond 429**. Ce n'est pas un défaut du produit.
- `apps/e2e/playwright.config.ts` — `navigationTimeout` porté à 120 s (Next en développement
  compile la route à la première visite : `/carrier/deals/[dealId]` a pris plus de 30 s).

## 4. Les pièges déjà payés — ne pas les repayer

1. **Les cookies sont liés à l'hôte.** Le poste sert le front sur `http://192.168.1.155:3000`
   (recette mobile). Ouvrir `localhost:3000` donne une connexion **200 sans un seul cookie**. Le
   harnais déduit l'adresse de `NEXT_PUBLIC_API_BASE_URL` — ne pas la forcer à la main.
2. **`networkidle` ne dit rien de React.** Cliquer avant l'hydratation envoie le formulaire en
   **GET**, mot de passe dans l'URL. Le helper de connexion attend un appel d'API fait par le
   client, puis réessaie une fois.
3. **Le Payment Element de Stripe ne se monte pas sur une origine non sécurisée.** Le bouton
   « Payer » reste cliquable et ne fait **rien**. D'où le fournisseur **FAKE** pour les parcours
   (§ 2). Le harnais le détecte et le dit, au lieu d'échouer trente secondes plus loin.
4. **L'espace fine insécable avant le « € ».** `"32,20 €"` attendu et `"32,20 €"` obtenu
   s'affichent à l'identique dans un rapport d'échec. `normaliserEspaces()` existe pour ça.
5. **Les cases à cocher sont habillées** : cliquer le libellé, jamais `check()` sur l'`input`.
6. **Chromium n'est plus publié pour macOS 13** : le harnais pilote le Chrome du poste.
7. **Une assertion doit pouvoir échouer.** La première version du parcours cherchait un texte
   déjà présent avant le clic : elle passait pour rien. La preuve retenue est l'URL du suivi de
   la réservation créée.

## 4 bis. LE POINT DE REPRISE — le harnais épuise le limiteur de débit

Vérifié à la main au moment du handoff :

```
POST /api/auth/login → 429 {"error":"Too many requests, please try again later!"}
```

Chaque navigateur du harnais ouvre une **vraie session par l'écran de connexion**. C'est un choix
délibéré (cela éprouve la porte d'entrée à chaque parcours), mais à raison de deux ou trois
connexions par scénario et de plusieurs exécutions par heure, la limite de la passerelle est
atteinte — et le parcours échoue alors sur un symptôme trompeur : « la page reste sur /login ».

**La correction à faire en premier à la reprise** : mémoriser l'état de session par compte
(`storageState` de Playwright). Une connexion par compte et par exécution au lieu d'une par
scénario ; le reste repart des cookies enregistrés. Garder **un** scénario qui se connecte
vraiment par l'écran (`harnais.spec.ts` le fait déjà) pour ne pas perdre la vérification de la
porte. Effet secondaire appréciable : chaque parcours gagne une vingtaine de secondes.

Contournement immédiat, si l'on veut relancer sans attendre : redémarrer la passerelle
(`api-gateway`) remet les compteurs à zéro.

## 5. Ce qui reste à faire, dans l'ordre

0. **Mémoriser les sessions du harnais** (§ 4 bis) — sans quoi les parcours longs échoueront par
   intermittence, pour une raison qui n'a rien à voir avec le produit.
1. **Finir WEB-E2E-1** — étapes 11 à 29 : rendez-vous proposé et accepté, numéro révélé au plus
   tôt 2 h avant, lien de suivi (page destinataire sans code ni montant), prise en charge en cinq
   points + photos, **code à six chiffres** côté Expéditrice, jalons (un SEUL email, celui de
   l'atterrissage), remise contre le code, période de vérification, confirmation anticipée,
   notation croisée et révélation.
2. **Les cinq autres parcours du chapitre 6** : litige (E2E-2), annulation tardive (E2E-3), compte
   neuf plafonné (E2E-4), refus au pickup (E2E-5), parcours du destinataire (E2E-6).
3. **Les chapitres 5.x** du cahier 01-WEB, par famille (32 chapitres, 326 fiches).
4. **Le cahier 02-ADMIN** (110 fiches) — il faudra une fixture de session administrateur :
   `grant-admin.ts` puis connexion en deux temps avec un code TOTP **calculé** par
   `packages/libs/totp` (la campagne API l'a déjà fait, le code est réutilisable).

## 6. Deux observations à traiter un jour

- Le message d'erreur quand le module de paiement ne se charge pas est **générique** : il devrait
  nommer la cause. Chapitre 5.12.
- **Deux formulaires de connexion coexistent dans le DOM** dès qu'une fenêtre de connexion est
  montée, avec les **mêmes `id`** (`#email`, `#password`) : défaut de validité HTML et gêne
  d'accessibilité (`label for=` ne désigne plus un champ unique). Chapitre 5.31.

## 7. Documents de référence

| Document | Ce qu'il contient |
|---|---|
| `context/YAMBA-RECETTE-WEB-RESULTATS.md` | La campagne navigateur : méthode, anomalies, verdicts par chapitre |
| `context/YAMBA-RECETTE-CRONS-RESULTATS.md` | La campagne « tâches planifiées », close |
| `docs/recette/RECETTE-01-WEB.md` | Le cahier (328 fiches) — § 2.3 les comptes, § 2.4 les trajets, § 2.5 les deals, § 6 les parcours |
| `docs/recette/RECETTE-02-ADMIN.md` | Le cahier back-office (110 fiches) |
| `context/YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md` | D76 et D77, gravées aujourd'hui |
| `CLAUDE.md` | La commande du harnais et ses contraintes de poste |

---

## 8. Faut-il ajouter Elasticsearch ? — analyse du 09/09/2026

**Recommandation : non.** Pas maintenant, et probablement jamais sous cette forme.

### Ce que fait la recherche aujourd'hui

`apps/trip-service/src/controllers/trip-search.controller.ts` (517 lignes) interroge MongoDB par
Prisma : filtres composables (mode de transport, dates, tranches horaires, familles et
catégories, prix, note), tris (départ le plus tôt, prix le plus bas, mieux notés), facettes, et
un tri par prix pour un poids donné calculé sur une fenêtre de résultats.

Le modèle `Trip` porte **vingt index**, dont `[status, departureAt, transportMode]`,
`[originCity]`, `[destinationCity]`, `[originPlaceId]`, `[comparablePriceCents]`.

### Le vrai défaut, et il est précis

```ts
{ originCity: { contains: params.from, mode: "insensitive" } }
```

`contains` insensible à la casse devient une **expression régulière non ancrée** : MongoDB ne
peut PAS utiliser `@@index([originCity])`, et fait un balayage de collection. Quatre champs sont
concernés (ville et pays, au départ et à l'arrivée). C'est le seul endroit de la recherche qui ne
passe pas par un index — tout le reste est indexé correctement.

Ce défaut est **réel**, et il grandira avec le nombre de trajets. Mais Elasticsearch n'est pas la
réponse proportionnée.

### Ce que coûterait Elasticsearch

1. **Une sixième brique d'infrastructure**, en développement ET en production, à côté de Mongo
   Atlas, Redis Upstash et Redpanda. Un cluster à dimensionner, surveiller, mettre à jour.
2. **Une seconde vérité.** Le registre en fait une règle : un index de recherche est une
   *projection*, donc il dérive. Il faut le peupler (l'outbox ne porte aujourd'hui que
   `booking` et `conversation` — il faudrait un agrégat `trip`, son relais, son consommateur),
   le réindexer, et détecter la dérive. C'est un chantier, pas une dépendance.
3. **Un décalage assumé** entre l'écriture et la visibilité en recherche, à expliquer au
   Voyageur qui vient de publier son trajet et ne le trouve pas.

### Ce qui règle le problème réel, à moindre coût

**(a) Chercher par identifiant de lieu.** Le front utilise déjà l'autocomplétion Google Places,
et le schéma porte `@@index([originPlaceId])` / `@@index([destinationPlaceId])`. Une recherche
par `placeId` est **exacte et indexée** — zéro balayage. Le texte libre ne resterait que le
repli.

**(b) Un champ normalisé et un préfixe.** Stocker `originCitySlug` (minuscules, accents retirés)
et interroger en `startsWith` : une expression régulière **ancrée à gauche** utilise l'index. Cela
couvre exactement l'usage réel — on tape « par », on veut « Paris ».

**(c) Si le besoin grandit : Atlas Search, pas Elasticsearch.** MongoDB Atlas embarque Lucene.
Recherche floue, repli d'accents, autocomplétion — **sans nouvelle infrastructure, sans
synchronisation, sans seconde vérité**, l'index vivant dans la base qui détient déjà la donnée.
C'est la voie de sortie naturelle, et elle ne se décide que le jour où (a) et (b) ne suffisent
plus.

### Le déclencheur qui changerait le verdict

Elasticsearch se justifierait si l'on voulait de la recherche **plein texte sur du contenu
rédigé** (descriptions, messages, avis) avec pertinence, synonymes et surlignage — ou de
l'agrégation analytique lourde sur des millions de documents. Rien de tel n'est au programme : le
pilotage est déjà servi par `/admin/pilotage` et la mesure d'audience (D66, D74).

**À graver en D78 si l'arbitrage est retenu** : « la recherche reste dans la base qui détient la
donnée ; pas de second moteur tant qu'un index Mongo bien posé suffit ».

**Quand ?** *Après la recette*, et pas avant (consigne du 09/09/2026). Deux raisons de fond, en
plus de la consigne : une campagne de recette qui se déroule pendant qu'on change le moteur de
recherche ne prouve plus rien de stable ; et le harnais navigateur, une fois les deux cahiers
joués, deviendra précisément le filet qui permettra de toucher à la recherche sans rien casser —
le bon ordre est donc celui-là, pas l'inverse.
