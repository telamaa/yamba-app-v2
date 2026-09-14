# Yamba — Cahier de résultats : recette n° 1 (navigateur, cahiers 01-WEB et 02-ADMIN)

*Campagne ouverte le 09/09/2026. Cahiers : `docs/recette/RECETTE-01-WEB.md` (328 fiches) et
`docs/recette/RECETTE-02-ADMIN.md` (110 fiches).*

---

## En-tête de campagne

| | |
|---|---|
| Poste | macOS 13.7.8, Chrome du poste piloté par Playwright 1.63 |
| Environnement | `npm run dev` (six services), Mongo Atlas, Redis, Redpanda, Mailpit |
| Jeu d'essai | `seed-deals.ts` — 12 comptes, 8 trajets, 23 réservations · `seed-admins.ts` — 7 comptes du back-office, 2FA enrôlée (cahier 02-ADMIN § 2.5) |
| Harnais | `apps/e2e` — `npx nx e2e e2e` · sessions mémorisées (`.sessions/`), paiement FAKE et ImageKit interposé pour les parcours |
| Fiches | **438** (328 + 110) |

## Méthode

Les cahiers 01 et 02 se jouent **au navigateur**. À la main, c'est plusieurs jours de travail —
et surtout, cela ne se **rejoue** pas : un cahier joué une fois ne protège de rien le mois
suivant. Cette campagne pose donc un harnais Playwright qui exécute les scénarios, avec trois
principes repris de la campagne « tâches planifiées » :

1. **Contre l'environnement réel.** Six services, un vrai courtier, une vraie base, une vraie
   boîte mail. Un parcours qui ne traverse pas la pile ne prouve rien.
2. **Trois navigateurs, comme le cahier les décrit** — l'Expéditeur, le Voyageur, le visiteur —
   chacun avec ses propres cookies. La moitié des vérifications portent sur ce qu'un rôle **ne
   voit pas** : une session partagée les rendrait toutes vertes pour de mauvaises raisons.
3. **Une anomalie se corrige avec sa contre-épreuve**, et la contre-épreuve reste dans le
   harnais. Chaque défaut trouvé devient un scénario qui interdit sa réapparition.

Le harnais **n'est pas branché à la CI**, délibérément : il lui faudrait six services, trois
bases et un courtier. La CI garde ses 17 vérifications ; le harnais se lance sur un poste où
l'environnement tourne.

---

## Deux pièges de poste, désarmés avant le premier scénario

Ils ne sont pas des anomalies du produit, mais ils ont coûté du temps et méritent d'être écrits :
le prochain qui monte le harnais ne doit pas les repayer.

**Les cookies sont liés à l'hôte.** Le poste est configuré pour la recette mobile
(`NEXT_PUBLIC_API_BASE_URL=http://192.168.1.155:8080/api`). Ouvrir le front sur `localhost:3000`
donne alors une connexion qui répond **200 sans poser un seul cookie** — et tout le reste du
parcours échoue sans que rien n'explique pourquoi. C'est exactement le piège écrit dans
`CLAUDE.md`, vérifié ici en conditions réelles. Le harnais lit donc la configuration du front et
en déduit l'adresse à ouvrir.

**`networkidle` ne dit rien de React.** Sur une adresse de réseau local, Next 16 sert d'abord un
squelette ; cliquer avant l'hydratation envoie le formulaire de connexion en **GET**, mot de
passe dans l'URL, et la connexion n'a jamais lieu. Le signal fiable est un appel d'API fait par
le **client** : tant qu'il n'est pas parti, le JavaScript n'a pas pris la main.

---

## Anomalies

```
ANO-WEB-01
Fiche          : chapitre 5.3 (WEB-CNX) · Gravité : BLOQUANTE · ÉTAT : CLOSE
Attendu        : un visiteur ouvre l'écran de connexion et se connecte.
Obtenu         : un visiteur qui n'a JAMAIS eu de session recevait, sur `/fr/login`, la fenêtre
                 modale « Ta session a expiré » — et son fond opaque **interceptait les clics** :

                     <button aria-label="Plus tard" class="absolute inset-0 bg-slate-900/50 …">
                     … subtree intercepts pointer events

                 Le formulaire de connexion était donc **inutilisable** tant que la fenêtre
                 n'était pas fermée à la main. Trouvé par le harnais avant le premier scénario
                 du cahier, en tentant simplement de se connecter.
Impact         : la porte d'entrée du produit. Tout visiteur, à chaque première visite, sur
                 l'écran de connexion comme sur les pages publiques.
Cause          : deux défauts qui se cumulent. (1) `api-client` traite TOUT 401 suivi d'un
                 rafraîchissement raté comme une **expiration** — alors qu'un visiteur n'a rien
                 à faire expirer ; `/auth/me` répond 401, le rafraîchissement échoue, l'événement
                 part. (2) L'en-tête de `SessionExpiredGate` affirmait « sur les pages publiques,
                 la fenêtre reste fermée » : **le code ne le faisait pas**. Encore un commentaire
                 qui décrit une intention que rien n'implémente — le troisième de la campagne
                 précédente.
Correction     : `apps/user-ui/src/lib/session-marker.ts` — une requête authentifiée qui RÉUSSIT
                 pose un marqueur ; la déconnexion et l'expiration l'effacent. `api-client` ne
                 signale une expiration que si le marqueur existe. Et l'écran refuse désormais de
                 s'ouvrir sur `/login`, `/register`, `/password`, `/refresh` — là où l'on vient
                 précisément pour s'occuper de sa session.
Contre-épreuve : `apps/e2e/src/chapitres/web-cnx.spec.ts` — aucune fenêtre parasite sur l'écran
                 de connexion ni sur les pages publiques, le formulaire redevient cliquable, et
                 le marqueur n'existe que pour un membre connecté.
```

```
ANO-WEB-02
Fiche          : chapitre 5.12 (WEB-RSV) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : la porte « Connecte-toi pour réserver » propose deux actions lisibles.
Obtenu         : ses deux boutons s'intitulaient **`booking.authGate.login`** et
                 **`booking.authGate.register`** — les clés de traduction elles-mêmes, faute de
                 messages, **dans les deux langues**. `BookingClient.tsx` appelait `tBooking("login")`
                 et `tBooking("register")` ; `booking.json` ne portait que `title` et `subtitle`.
Impact         : l'écran que voit tout visiteur non connecté qui clique « Réserver ». Les deux
                 seules actions possibles y sont illisibles.
Cause          : la vérification i18n de la CI compare les locales **entre elles** (miroir FR/EN)
                 et refuse les clés à points. Elle ne voyait pas une clé **utilisée** qu'AUCUNE
                 locale ne définit : les deux langues étaient également incomplètes, donc le
                 miroir était parfait.
Correction     : les deux messages ajoutés (fr / en), **et** une cinquième règle dans
                 `scripts/check-i18n-messages.mjs` : toute clé LITTÉRALE utilisée dans les
                 sources doit exister. Le garde-fou lit la carte des espaces de noms dans
                 `src/i18n/request.ts` (un fichier ne porte pas forcément le nom de son
                 espace : `trip-detail.json` → `tripDetail`), ne juge que ce qui est certain
                 — une liaison `useTranslations("ns")` non ambiguë, un appel littéral situé
                 APRÈS elle — et ignore tout ce qui est calculé.
Contre-épreuve : clé retirée → le garde-fou nomme exactement
                 `booking.authGate.login — BookingClient.tsx` ; clé remise → vert. Et deux
                 scénarios `web-rsv.spec.ts` vérifient la porte en français et en anglais.
```


```
ANO-WEB-03
Fiche          : chapitre 5.15 (WEB-MSG) · parcours WEB-E2E-1 étape 11 · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : le bouton « Envoyer un message » d'un deal ouvre LE fil de ce deal.
Obtenu         : sur grand écran (≥ 1024 px), le tableau de bord ouvrait le PREMIER fil de la
                 liste — celui d'un autre deal, avec un autre Expéditeur — alors que l'URL
                 demandait `?conversation=<id>`. Le Voyageur pouvait proposer un rendez-vous, ou
                 écrire, dans la mauvaise conversation.
Impact         : tout membre qui a plus d'une conversation et arrive par un bouton de deal, sur
                 ordinateur. Le harnais l'a vu au premier passage : Thomas a six deals dans le
                 jeu d'essai.
Cause          : deux effets React posent `selectedId` dans le MÊME rendu — l'un depuis l'URL,
                 l'autre « ouvre le premier fil pour ne pas laisser une colonne vide ». Quand la
                 liste des conversations est déjà en cache (le badge de l'en-tête la charge), les
                 deux tirent au même instant et le dernier gagne : le premier fil.
Correction     : `apps/user-ui/src/components/dashboard/sections/Messages.tsx` — l'ouverture
                 automatique s'abstient dès que l'URL a choisi.
Contre-épreuve : WEB-E2E-1 étape 11 — le fil ouvert porte le prénom de l'Expéditrice du deal
                 et n'a « Pas encore de message » ; la proposition de rendez-vous y atterrit.
```


```
ANO-WEB-04
Fiche          : parcours WEB-E2E-2 étape 15 (chapitre 5.21) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : après une décision de médiation, le suivi de l'Expéditeur dit que le deal a été
                 clos par la médiation et montre la décision.
Obtenu         : le bandeau « Envoi terminé » disait « Période de vérification terminée le …,
                 **sans signalement de ta part** » — à un membre qui venait précisément d'ouvrir
                 un signalement, tranché en remboursement partiel.
Impact         : tout deal clos par la médiation ; et, en creux, tout deal confirmé par
                 l'Expéditeur lui-même lisait aussi la phrase « du système ».
Cause          : deux étages. La vue Expéditeur de l'API ne servait PAS `completedBy` (le
                 mapper ne sérialisait que `completedAt`), donc le front ne savait jamais QUI
                 avait clos ; et l'adaptateur front ne gardait de toute façon que SHIPPER /
                 SYSTEM, sans cas pour ADMIN. Le bandeau retombait toujours sur « bySystem ».
Correction     : `completedBy` ajouté à la whitelist des jalons du contrat
                 (`packages/libs/api-contracts/src/booking/booking.schema.ts`, OpenAPI
                 régénéré), servi par `booking-view.mapper.ts` ; l'adaptateur conserve ADMIN ;
                 nouvelle ligne « Clos par la médiation le {date} : la décision est ci-dessous. »
                 (`completed.banner.byMediation`, FR + EN).
Contre-épreuve : WEB-E2E-2 étape 15 — la phrase « sans signalement de ta part » est absente, la
                 ligne de médiation est là, la carte « Décision rendue » suit.
Reste ouvert   : le reste de l'écran « Transaction close » ignore encore la médiation — voir
                 les observations (arbitrage de copie à rendre).
```

```
ANO-WEB-05
Fiche          : parcours WEB-E2E-2 étape 19 (chapitre 5.26 Finances) · Gravité : MINEURE (jeu d'essai) · ÉTAT : CLOSE
Attendu        : Finances › Paiements porte la ligne « Remboursé 15,00 € le … » après la décision.
Obtenu         : « Libéré le 9 sept. · transaction close − 61,60 € » — le remboursement partiel
                 invisible.
Cause          : le service pose `capturedAt` + `chargeId` à l'ACCEPTATION (D31, capture
                 manuelle) ; `seed-deals.ts` ne le faisait pour aucun de ses deals acceptés, et
                 la règle du portefeuille (`wallet.service.ts`) exige `capturedAt` pour lire un
                 remboursement. Le jeu d'essai est du code (ANO-CRON-07) : ici il ne disait pas
                 la vérité sur l'argent, pour tous les deals au-delà de PENDING — les files
                 finances du back-office lisaient le même mensonge.
Correction     : le seed pose `capturedAt = acceptedAt` et un `chargeId` factice dès qu'un deal
                 a été accepté. `seed-integrity.spec.ts` inchangé, vert.
Contre-épreuve : WEB-E2E-2 étape 19 — « Remboursé 15,00 € le … », montant « + 15,00 € ».
```


```
ANO-WEB-06
Fiche          : parcours WEB-E2E-3 étape 4 (chapitre 5.16 notifications) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : « notification in-app à chaque envoi » d'un message.
Obtenu         : la cloche et la page des notifications affichaient « Notification » — le titre
                 de repli — et le corridor, sans rien dire d'un message ; le lien menait au deal,
                 pas au fil.
Cause          : `conversation.message_posted` n'avait ni présentation ni copie
                 (`notifications.types.ts`, `notifications.json`) : l'événement était « inconnu ».
Correction     : présentation dédiée (icône message), copie « Nouveau message » / « {route} ·
                 « {extrait} » » en FR et EN (l'extrait est celui que l'événement porte, jamais
                 le message entier), et le lien d'une notification de conversation ouvre le fil.
Contre-épreuve : WEB-E2E-3 étape 4 — « Nouveau message » chez chacun des deux après l'échange.
```

```
ANO-WEB-07
Fiche          : parcours WEB-E2E-3 étape 15 (chapitre 5.7, D72) · Gravité : MAJEURE · ÉTAT : TRANCHÉE le 09/09 — message corrigé (« Mes trajets »), annulation par le Voyageur = lot à part (registre)
Attendu        : le refus d'annuler un trajet qui porte un deal vivant dit au Voyageur quoi faire.
Obtenu         : « Ce trajet porte encore 2 deals en cours : annule-les d'abord depuis « Mes
                 deals ». Chaque Expéditeur sera remboursé intégralement. » — or **« Mes deals »
                 n'existe pas** (la chaîne n'apparaît que dans ce message), et **le Voyageur ne
                 peut pas annuler un deal** : la machine d'états prévoit `ACCEPTED + cancel +
                 CARRIER` (ANN-02) mais le service refuse tout appelant qui n'est pas
                 l'Expéditeur (`deal-lifecycle.service.ts`, 403 `SHIPPER_ONLY`) et aucun écran
                 ne propose le geste.
Impact         : un Voyageur bloqué sur un trajet qu'il ne peut ni annuler ni vider ; le conseil
                 affiché est inapplicable.
Proposition    : (1) tout de suite, le message renvoie vers « Mes trajets » (où les deals sont
                 listés) ; (2) l'annulation d'un deal par le Voyageur (ANN-02 : remboursement
                 intégral, annulation à sa charge, réputation) — un lot à part, à graver au
                 registre. Décision attendue.
```


```
ANO-WEB-08
Fiche          : parcours WEB-E2E-4 étape 3 (chapitre 5.13, CNF-06 / D71) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : un compte neuf qui déclare 450 € est refusé « AVANT tout paiement ».
Obtenu         : l'assistant n'envoyait pas la valeur déclarée à la demande d'intention de
                 paiement (`createPaymentIntent` postait les seuls champs du devis) : le plafond
                 « valeur déclarée » n'était vérifié qu'à la création du deal, APRÈS le clic
                 « Payer » — donc après l'autorisation bancaire avec Stripe. Les deux autres
                 plafonds (poids, nombre par mois) tombaient bien à l'intention.
Cause          : le contrat prévoit `declaredValueCents` sur l'intention depuis ANO-API-12
                 (« l'assistant connaît cette valeur avant de payer : il l'envoie ») ; le front
                 ne l'envoyait pas. Régression de l'anomalie de la campagne API.
Correction     : `apps/user-ui/src/services/booking.api.ts` — l'intention part avec la valeur
                 déclarée (même conversion que la création du deal, factorisée).
Contre-épreuve : WEB-E2E-4 étape 3 — 450 € : refus dans la carte de l'étape 4 (409 à
                 l'intention), aucune ligne Finances, aucun email ; étapes 5 et 8 inchangées.
```

```
ANO-WEB-09
Fiche          : parcours WEB-E2E-4 étape 10 (chapitre 5.30, RGPD D63 / sudo D65) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : « Télécharger mes données » ouvre la porte par code, puis télécharge le JSON.
Obtenu         : « Impossible pour le moment, réessaie. » — la porte ne s'ouvrait JAMAIS :
                 l'export est inutilisable pour tout membre (le droit d'accès RGPD, en pratique).
Cause          : l'export demande la réponse en `blob` ; le refus 403 `SUDO_REQUIRED` arrive lui
                 aussi en blob, et `isSudoRequired` ne lisait pas le code dans un blob. Même
                 sort pour le 429 « une fois par 24 h ».
Correction     : `apps/user-ui/src/services/privacy.api.ts` — un corps d'erreur en blob est
                 relu en JSON avant d'être relancé ; la porte s'ouvre, le code arrive par email,
                 le fichier se télécharge.
Contre-épreuve : WEB-E2E-4 étape 10 — porte, code « Ton code de confirmation Yamba », fichier
                 `yamba-mes-donnees-….json` (format `yamba-data-export/1`, 5 réservations,
                 aucune trace de score).
```

```
ANO-WEB-10
Fiche          : parcours WEB-E2E-5 étape 7 (chapitre 5.27, D29 ①, A40) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : un refus au pickup n'ajoute AUCUNE annulation à la ligne de faits du Voyageur
                 (« Refuser un colis non conforme ne pénalise jamais ta réputation. »).
Obtenu         : la ligne de faits comptait comme « annulation tardive » TOUT deal CANCELLED
                 clos par le Voyageur après acceptation — c'est-à-dire, aujourd'hui, chaque
                 refus au pickup et rien d'autre (l'annulation ANN-02 par le Voyageur n'est pas
                 encore ouverte, ANO-WEB-07). Le refus ne déclenchait pas de recalcul : la page
                 restait juste, jusqu'au prochain fait de réputation (un deal terminé, un avis),
                 où le refus surgissait comme une annulation fautive. Le parcours passait « pour
                 rien » avant correction ; en base, l'ancien filtre comptait 1, le nouveau 0.
Cause          : `reputation.service.ts` (`carrierFacts`) filtrait sur `status: CANCELLED,
                 closedBy: CARRIER, acceptedAt ≠ null`, sans distinguer le refus au pickup —
                 la raison du refus étant facultative, rien en base ne le marquait à coup sûr.
                 La machine, elle, dit « sans pénalité » (effets de `refusePickup`, A40).
Correction     : `prisma/schema.prisma` — `Booking.pickupRefusedAt` (marque du refus, posée par
                 `refusePickup` avec `now`) ; `reputation.service.ts` — les annulations tardives
                 du Voyageur excluent la marque, champ ABSENT compris (`OR` + `isSet: false`,
                 piège Mongo) ; `deal-transport.service.ts` — le refus recalcule la réputation
                 des deux parties (comme l'annulation), pour que la page publique dise vrai tout
                 de suite. Tests : deal-service 575 → 576 (la requête, la marque, le recalcul).
Contre-épreuve : WEB-E2E-5 étape 7 — ligne de faits lue AVANT la réservation et APRÈS le refus :
                 identiques (« 0 annulation tardive ») ; en base, sur le deal refusé :
                 `pickupRefusedAt` posé, ancien filtre 1 → nouveau filtre 0.
```

```
ANO-WEB-11
Fiche          : parcours WEB-E2E-6 étape 7 (chapitres 5.20, 5.6 et 5.31) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : « Devenir Voyageur », dans le bloc d'acquisition de la page destinataire, mène à
                 l'écran « Devenir Voyageur » (WEB-VOY-1 : l'assistant d'onboarding — et, sans
                 compte, la porte de connexion d'abord).
Obtenu         : une page bouchon, en anglais : « Become a carrier (UI only) ». Même sort pour
                 `/become/shipper` (« Become a seller (UI only) »). Et le « Devenir Voyageur » du
                 pied de page et du menu « Découvrir » (visiteur) visait `/become-yamber`, qui
                 répond 404 (« futur » depuis la migration i18n).
Impact         : le premier geste d'acquisition d'un futur Voyageur — depuis la page destinataire,
                 l'accueil (appel final), le pied de page et le menu visiteur — aboutit sur du
                 vide. Aucun cahier ne le couvrait avant ce parcours (5.6 se joue connecté).
Cause          : `apps/user-ui/src/app/[locale]/become/{carrier,shipper}/page.tsx` sont des
                 bouchons de la migration next-intl (commit « migrate to next-intl ») jamais
                 remplacés ; la page marketing `/become-yamber` n'a jamais été écrite. Quatre
                 liens pointaient dessus.
Correction     : les deux bouchons deviennent des redirections (`redirect` de next-intl) vers
                 l'écran réel — `/carrier/onboarding` et `/search` — pour les liens déjà
                 partagés ; les quatre liens (page destinataire, accueil, pied de page, menu
                 visiteur) visent directement `/carrier/onboarding`. L'assistant envoie un
                 visiteur à `/login?redirect=/carrier/onboarding`, puis le ramène.
Contre-épreuve : WEB-E2E-6 étape 7 — « Envoyer un colis » → `/fr/search` ; « Devenir Voyageur »
                 → `/fr/login?redirect=/carrier/onboarding`. `curl` : `/fr/become/carrier` 307
                 → `/fr/carrier/onboarding`, `/fr/become/shipper` 307 → `/fr/search`.
```

```
ANO-WEB-12
Fiche          : WEB-ACC-9 (chapitre 5.1) · Gravité : BLOQUANTE · ÉTAT : CLOSE
Attendu        : sur l'accueil, deux villes choisies, « Rechercher » ouvre `/search` avec le titre
                 « Trajets pour Paris → Brazzaville » et les trajets du jeu d'essai.
Obtenu         : rien. Le bouton « Rechercher » de l'accueil ne faisait qu'un `console.log`
                 (« [TripSearchBar] Search: … ») : le visiteur restait sur l'accueil, sans message.
                 Et même en ouvrant `/search` à la main, la page interrogeait un brouillon VIDE
                 (« 0 résultats » sous une barre qui affichait pourtant Paris → Brazzaville) : il
                 fallait cliquer « Rechercher » une seconde fois.
Impact         : le premier geste du produit pour tout visiteur desktop. Aucun parcours du
                 chapitre 6 ne le couvrait : ils entrent par l'adresse d'un trajet.
Cause          : `HeroSection` montait `<TripSearchBar>` sans `onSearchAction` (le composant
                 documente ce défaut comme « comportement par défaut : log ») ; et
                 `SearchResultsView` initialisait son brouillon interrogé par `useState` vide, sans
                 lire le brouillon que la barre mémorise en `sessionStorage` (`trip-search`).
Correction     : `onSearchAction={() => router.push("/search")}` sur l'accueil ; la clé, le
                 brouillon initial et la version du brouillon sont exportés par `TripSearchBar`
                 (`TRIP_SEARCH_STORAGE_KEY`) et `SearchResultsView` interroge CE brouillon
                 (`usePersistedFormState`, même clé) — en arrivant, les résultats correspondent à
                 la saisie, sans second clic.
Contre-épreuve : WEB-ACC-9 — `/fr/search`, « Trajets pour Paris → Brazzaville, République du
                 Congo », 2 cartes. WEB-ACC-10 — inversion, « Rechercher », « Trajets pour
                 Brazzaville, République du Congo → Paris », 0 carte (état vide, WEB-RCH-9).
```

```
ANO-WEB-13
Fiche          : WEB-ACC-9 (chapitre 5.1 ; touche 5.9 et 5.10) · Gravité : BLOQUANTE · ÉTAT : CLOSE
Attendu        : une ville choisie dans la liste de l'autocomplétion trouve les trajets qui en
                 partent ou y arrivent.
Obtenu         : « 0 résultats » pour Paris → Brazzaville alors que l'API en rend deux pour
                 `to=Brazzaville`. La liste pose le libellé normalisé « Ville, Pays »
                 (« Brazzaville, République du Congo ») dans le champ, et c'est ce libellé entier
                 que la recherche comparait à `destinationCity` ET `destinationCountry` par un
                 `contains` : il n'est contenu dans aucun des deux. Toute ville ÉTRANGÈRE choisie
                 dans la liste donnait zéro résultat — Paris passait parce que Google omet le pays
                 du domicile (« Paris » tout court).
Impact         : la recherche par autocomplétion, c'est-à-dire la recherche telle qu'on l'utilise.
                 Les alertes de route (5.10) portent le même libellé.
Cause          : `apps/trip-service/src/controllers/trip-search.controller.ts`, `buildBaseWhere` :
                 `contains: params.to` sur le texte brut.
Correction     : `apps/trip-service/src/lib/place-text.ts`, `placeSearchTerm(text)` : le terme
                 cherché est le premier segment avant une virgule (la ville) ; le pays qui suit est
                 une aide à la lecture, pas un critère — il dépend de la langue de l'écran
                 (« République du Congo » / « Republic of the Congo ») alors que la base porte le
                 pays dans la langue du Voyageur qui a publié. Un texte tapé à la main (« Congo »)
                 reste cherché tel quel. Trois tests unitaires (trip-service 257 → 260).
Contre-épreuve : `GET /api/trips/search?from=Paris&to=Brazzaville%2C%20République%20du%20Congo`
                 → `totalCount` 0 avant, 2 après. WEB-ACC-9 vert.
```

```
ANO-WEB-14
Fiche          : WEB-ACC-9 (chapitre 5.1 ; touche 5.7, 5.9, 5.10, 5.12) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : taper « Paris » dans un champ de ville fait apparaître des propositions.
Obtenu         : sur une page fraîche, un visiteur qui tape « Paris » d'une traite (5 frappes à
                 60 ms) ne voit RIEN — ni liste, ni sablier, ni message — tant qu'il ne frappe pas
                 une lettre de plus. À 250 ms par frappe, la liste vient. Mesuré quatre fois.
Impact         : la première recherche de chaque visite, pour quiconque tape vite : le champ
                 paraît mort. Les mêmes champs servent à publier un trajet et à créer une alerte.
Cause          : `apps/user-ui/src/lib/googlePlaces.ts` chargeait l'API Google avec
                 `loading=async` et attendait l'événement `load` du `<script>` — qui arrive AVANT
                 que `google.maps.importLibrary` n'existe. La toute première requête de
                 suggestions (celle qui déclenche le chargement) échouait sur
                 « importLibrary is not a function » ; les suivantes trouvaient la bibliothèque
                 prête. Et `CityAutocomplete` avalait l'erreur (`catch {}`) : aucune trace nulle
                 part, ni pour l'utilisateur ni pour le développeur.
Correction     : le chargeur passe `callback=__yambaGoogleMapsReady` (le contrat de Google pour
                 `loading=async`) et ne se résout que là ; « prêt » se lit sur
                 `typeof google.maps.importLibrary === "function"`, pas sur `window.google.maps` ;
                 un chargeur déjà posé est attendu par sondage (15 s) ; un échec de chargement
                 laisse retenter. Le `catch` du composant journalise (`console.warn`).
Contre-épreuve : les quatre rythmes de frappe donnent 5 propositions ; WEB-ACC-9 et 10 verts.
```

```
ANO-WEB-15
Fiche          : WEB-ACC-6 (chapitre 5.1) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : les icônes sociales du pied de page portent « Bientôt disponible » et ne mènent
                 nulle part.
Obtenu         : elles ouvraient un nouvel onglet vers `https://instagram.com/yamba`,
                 `https://x.com/yamba`, `https://facebook.com/yamba` — des comptes qui ne sont pas
                 ceux de Yamba.
Cause          : `apps/user-ui/src/components/layout/Footer.tsx`, `SOCIAL_LINKS_ENABLED = true`.
                 L'état « inactif » (info-bulle, curseur, aucun lien) était écrit, pas activé.
Correction     : `SOCIAL_LINKS_ENABLED = false` — le jour où les comptes existent, une constante
                 et trois adresses.
Contre-épreuve : WEB-ACC-6 — `title="Bientôt disponible"` sur les trois, aucun `window.open`,
                 aucun onglet, adresse inchangée.
```

```
ANO-WEB-16
Fiche          : WEB-ACC-2 (chapitre 5.1 ; touche 5.31 et 5.32) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : sur `/en`, la page est en anglais — jusqu'à l'attribut `lang` du document, que
                 les lecteurs d'écran (voix), les correcteurs et la traduction automatique lisent.
Obtenu         : `<html lang="fr">` sur `/en`, au rendu serveur comme après la bascule.
Cause          : `app/layout.tsx` écrivait `lang="fr"` en dur, avec un commentaire promettant
                 que « le layout de locale le mettra à jour » — rien ne le faisait. Et une bascule
                 FR ⇄ EN est une navigation côté client : le layout racine, partagé, ne se
                 re-rend pas.
Correction     : le layout racine lit `getLocale()` (next-intl) pour le rendu serveur ;
                 `components/layout/HtmlLang.tsx` (client, monté dans le layout de locale) aligne
                 `document.documentElement.lang` après chaque bascule.
Contre-épreuve : `curl /en` → `lang="en"`, `/fr` → `lang="fr"` ; WEB-ACC-2 lit `lang="en"` après
                 le clic.
```

```
ANO-WEB-17
Fiche          : WEB-ACC-5 (chapitre 5.1 ; touche 5.31) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : une page = un repère « contenu principal » (`<main>`).
Obtenu         : deux `<main>` imbriqués sur `/legal/terms` et `/legal/privacy` : celui du
                 groupe `(marketing)` et celui du cadre `legal/layout.tsx`. Invalide en HTML, et
                 un lecteur d'écran annonce deux « contenus principaux ».
Correction     : le cadre légal devient un `<div>`.
Contre-épreuve : WEB-ACC-5 compte UN `main` sur chacune des deux pages.
```

```
ANO-WEB-18
Fiche          : WEB-INS-10 (chapitre 5.2) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : le tutoiement partout (décision du 03/09/2026), jusque dans un message d'erreur.
Obtenu         : sous le champ e-mail : « Un compte existe déjà avec cet e-mail. Connectez-vous ou
                 utilisez « Mot de passe oublié ». »
Cause          : `registerCodeMessage` (`apps/user-ui/src/lib/auth/auth-error-codes.ts`) est
                 antérieur à la décision ; les phrases voisines (règles de mot de passe) sont
                 impersonnelles et n'ont donc jamais eu à changer — celle-ci, la seule à
                 s'adresser à la personne, avait échappé au passage au tutoiement.
Correction     : « Un compte existe déjà avec cet e-mail. Connecte-toi ou utilise « Mot de passe
                 oublié ». » (la version anglaise est inchangée).
Contre-épreuve : WEB-INS-10 exige « Un compte existe déjà avec cet e-mail » sous le champ et
                 refuse `Connectez-vous|utilisez`.
```

```
ANO-WEB-19
Fiche          : WEB-CNX-4 (chapitre 5.3) · Gravité : MAJEURE · ÉTAT : OUVERTE (déjà relevée en
                 recette API, « aucune protection anti-force brute par compte sur /auth/login »)
Attendu        : au bout d'une dizaine d'essais de connexion sur un même compte, un verrou ralentit
                 l'attaquant — « Trop de tentatives. Réessaie dans quelques instants. »
Obtenu         : rien. La connexion par mot de passe (`loginUser`) n'a aucun compteur par compte
                 ni par adresse. Le seul rempart est le limiteur de la passerelle (100 requêtes /
                 15 min par IP) — et il est déclaré `skipFailedRequests: true` : une tentative qui
                 échoue (401) N'EST PAS comptée. Douze mauvais mots de passe d'affilée : douze 401,
                 jamais un 429. Un attaquant qui vise un compte dispose de centaines d'essais par
                 heure, et le titulaire n'est jamais prévenu.
Cause          : l'OTP a ses paliers de verrou (1 min → 30 min → 24 h) et son email d'alerte ; la
                 connexion par mot de passe n'a jamais reçu l'équivalent. `skipFailedRequests`
                 sur le limiteur est fait pour ne pas pénaliser un membre maladroit, mais il ouvre
                 la porte à l'essai en masse.
Proposition    : réutiliser la mécanique OTP (compteur par `emailNormalized`, paliers, email
                 d'alerte au deuxième palier), refus indistinguable (même corps, même statut,
                 verrou silencieux — ANO-API-08/18). Une PR dédiée, hors recette (décision produit).
État recette   : la fiche WEB-CNX-4 est jouée et marquée `test.fail` dans le harnais — le jour où
                 le verrou existe, elle « passe » et Playwright le signale (retirer la marque).
```

```
ANO-WEB-20
Fiche          : WEB-CNX-8 (chapitre 5.3) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : « Déconnecter » un autre appareil affiche un message de confirmation (le cahier
                 le demande explicitement), comme « Déconnecter les autres appareils » en a un.
Obtenu         : la ligne disparaissait sans un mot. Un geste de sécurité réussi sans retour
                 laisse un doute (« est-ce bien parti ? »).
Cause          : `doRevoke` (Security.tsx) rechargeait la liste sans poser de message ; seul
                 `doRevokeOthers` en posait un.
Correction     : un message « Appareil déconnecté. » (clé `securityPage.sessionRevoked`, FR/EN)
                 après une révocation à l'unité réussie — jamais quand c'est la session courante
                 (là, on quitte la page).
Contre-épreuve : WEB-CNX-8 lit « Appareil déconnecté. » après la révocation, et la ligne a disparu.
```

```
ANO-WEB-21
Fiche          : WEB-PRO-9 (chapitre 5.5) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : quand un membre masque sa page publique, LUI la voit encore, avec une mention
                 « masquée » (le cahier le demande explicitement).
Obtenu         : le propriétaire voyait bien sa page (les autres reçoivent 404), mais SANS aucune
                 mention : rien ne lui disait qu'elle était masquée.
Cause          : l'API `getUserPublic` renvoie déjà `hidden: true` au seul propriétaire d'une page
                 masquée (D67 1A), mais le front ne portait pas ce drapeau (absent du type
                 `PublicUser`) et ne l'affichait nulle part — encore une intention côté serveur que
                 le rendu ignorait.
Correction     : `hidden` ajouté au type `PublicUser` (déjà présent dans la réponse), et une
                 bannière d'avertissement en tête de `UserProfileView` quand `user.hidden`
                 (clé i18n `userProfile.hiddenBanner`, FR/EN).
Contre-épreuve : WEB-PRO-9 lit « Cette page est masquée… » sur la page du propriétaire, et le
                 visiteur reçoit toujours « Profil introuvable ».
```

```
ANO-WEB-22
Fiche          : WEB-TRJ-3 à 9 (chapitre 5.7) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : « Modifier » un trajet rouvre l'assistant avec TOUTES ses valeurs, dates et heures
                 comprises, et « Continuer » mène à l'étape « Conditions ».
Obtenu         : sur un trajet créé par l'API (comme ceux du seed), l'édition s'ouvrait avec
                 « 4 champs à compléter », « Date requise » ×2, « Heure requise » ×2 — alors que
                 `departureAt` et `arrivalAt` sont bien en base. « Continuer » restait bloqué à
                 l'étape 1 ; enregistrer aurait réécrit les dates à vide.
Cause          : `create-trip.reverse-mapper.ts` ne lisait que `departureDateLocal` /
                 `departureTimeLocal` (et leurs jumeaux d'arrivée), des chaînes que SEUL le wizard
                 écrit à la création. Le mapper inverse ne savait relire que ce que son propre
                 mapper avait écrit : tout trajet venu d'un autre canal (API, seed, futur client
                 mobile) perdait ses dates à l'édition.
Correction     : repli sur l'instant absolu — `localDateTimeParts(departureAt, originTimezone)`
                 dérive la date et l'heure avec `Intl.DateTimeFormat(...).formatToParts` dans le
                 fuseau du lieu quand il est connu, sinon dans celui du navigateur (le fuseau que le
                 mapper d'écriture utilise). Les chaînes locales gardent la priorité quand elles
                 existent ; un fuseau inconnu du moteur retombe sur le navigateur, jamais d'erreur.
Contre-épreuve : WEB-TRJ-3 à 9 ouvre un brouillon créé par l'API : aucun « Date requise » /
                 « Heure requise », aucun « champs à compléter », et l'étape 2 s'ouvre.
```

```
ANO-WEB-23
Fiche          : WEB-TRJ-2 (chapitre 5.7) · Gravité : MINEURE · ÉTAT : OUVERTE (lecture du code,
                 la fiche est ⏭ Google Places)
Attendu        : « les heures sont locales à chaque lieu : 14:00 signifie 14 h à Bruxelles,
                 06:00 signifie 6 h à Kinshasa » (cahier).
Obtenu         : le wizard n'envoie aucun fuseau (`originTimezone` / `destinationTimezone` absents
                 de `create-trip.mapper.ts`) et calcule `departureAt` / `arrivalAt` avec
                 `Date.setHours` — c'est-à-dire dans le fuseau du NAVIGATEUR du Voyageur. Les heures
                 saisies sont conservées telles quelles (`departureTimeLocal`) et c'est elles que
                 les écrans affichent : à l'écran tout semble juste. L'instant absolu, lui, est
                 faux dès que le lieu n'est pas dans le fuseau du navigateur (arrivée à Kinshasa
                 saisie depuis Paris en été : une heure d'écart), et le serveur retombe sur
                 `Europe/Paris` pour `departureHourLocal` (`computeDenormalizedFields`). Ce sont
                 les crons (expiration au départ, complétion automatique) et la garde « départ
                 passé » qui lisent l'instant absolu.
Impact         : faible aujourd'hui (Voyageurs francophones, écarts d'une à deux heures) ; réel
                 pour un Voyageur qui publie depuis un autre continent.
Proposition    : dériver le fuseau CÔTÉ SERVEUR des coordonnées du lieu (`originLat/Lng` viennent
                 déjà de Google Places ; une table hors-ligne type `tz-lookup`, aucun appel réseau),
                 puis calculer `departureAt` = date + heure saisies DANS ce fuseau, et remplir
                 `originTimezone` / `destinationTimezone` — les mappers d'affichage et
                 `computeDenormalizedFields` les consomment déjà. Candidat au registre (D-next),
                 PR dédiée hors recette : décision produit.
État recette   : WEB-TRJ-2 est ⏭ (Google) avec cette lecture dans son motif ; à rejouer après
                 correction en vérifiant l'instant en base, pas seulement l'affichage.
```

```
ANO-WEB-24
Fiche          : WEB-DOC-1 (chapitre 5.8) · Gravité : MINEURE · ÉTAT : OUVERTE (décision produit)
Attendu        : au dépôt d'un justificatif, un TYPE se choisit — au moins billet, itinéraire,
                 véhicule, identité, autre (cahier) ; seul le billet entre dans le cycle de
                 vérification.
Obtenu         : aucun sélecteur. `TripDocumentsManager` (détail du trajet) et le wizard envoient
                 TOUJOURS `type: "TICKET_PROOF"` : un itinéraire ou une pièce d'identité devient
                 un « billet », passe le trajet « En vérification » et atterrit dans la file
                 « Billets » du back-office. L'API, elle, connaît les cinq types
                 (`TripDocumentType`) et ne fait passer le billet en vérification que pour
                 `TICKET_PROOF`.
Cause          : le formulaire n'a jamais reçu le champ ; le serveur est prêt, l'écran non.
Proposition    : un sélecteur de type (cinq entrées, FR/EN) dans les deux composants de dépôt,
                 « Billet » par défaut ; les documents non-billet s'affichent sans statut de
                 vérification. Petit lot front, PR dédiée après arbitrage.
État recette   : WEB-DOC-1 est jouée conforme sur le dépôt et le statut ; elle CONSTATE que les
                 deux documents déposés sont `TICKET_PROOF`.
```

```
ANO-WEB-25
Fiche          : WEB-DOC-2 (chapitre 5.8) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : tenter un sixième document donne un « refus explicite » (au plus 5 par trajet).
Obtenu         : à cinq documents, la zone de dépôt disparaissait simplement (`canAddMore`
                 faux) — rien ne disait pourquoi on ne peut plus rien ajouter.
Cause          : les deux composants de dépôt rendaient la zone sous condition, sans branche
                 « limite atteinte ».
Correction     : un message « 5 documents maximum par trajet — supprime un document pour en
                 ajouter un autre. » (FR/EN) quand la limite est atteinte : `TripDocumentsManager`
                 (détail) et `DocumentUpload` (wizard, via la prop `limitHint` et la clé
                 `docLimitReached` du copy). Le serveur refuse le sixième de toute façon
                 (`DOCUMENT_LIMIT_REACHED`).
Contre-épreuve : WEB-DOC-2 lit le message à cinq documents, et l'absence de « Ajouter un billet
                 ou justificatif » ; l'API répond 400 au sixième.
```

```
ANO-WEB-26
Fiche          : WEB-DOC-2 (chapitre 5.8) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : un fichier de plus de 5 Mo est refusé avec un message ; rien n'est envoyé.
Obtenu         : rien n'était envoyé (le hook `useImageKitUpload` refuse avant tout réseau), mais
                 le message « Le fichier dépasse 5 Mo. » n'apparaissait JAMAIS : l'utilisateur
                 choisissait un fichier et… rien. Même chose pour « Format non supporté ».
Cause          : `handleFiles` appelait `reset()` du hook juste après la boucle d'envoi — et
                 `reset()` remet l'erreur à `null`. L'erreur de validation était effacée dans le
                 même tour de boucle que sa pose.
Correction     : plus de `reset()` après les envois (le hook remet déjà l'erreur à zéro au DÉBUT
                 de chaque envoi, et `isUploading` à faux dans son `finally`) — dans
                 `TripDocumentsManager` et `DocumentUpload`.
Contre-épreuve : WEB-DOC-2 dépose un PDF de 5 Mo + 1 octet : le message est visible et aucune
                 requête (jeton ImageKit, téléversement, enregistrement) ne part.
```

```
ANO-WEB-27
Fiche          : WEB-RCH-1, 10, 11 (chapitre 5.9) · Gravité : BLOQUANTE · ÉTAT : CLOSE
Attendu        : `/search` liste les trajets, quel que soit l'avatar des Voyageurs.
Obtenu         : « Cette page n'a pas pu s'afficher » (page d'incident, référence, « Réessayer »)
                 dès que la liste contenait un trajet dont le Voyageur a un avatar — la première
                 fiche du chapitre est tombée dessus, puis « Tout effacer », puis « Réessayer ».
                 Console : « Invalid src prop (https://ik.imagekit.io/…/avatars/….jpg) on
                 `next/image`, hostname "ik.imagekit.io" is not configured under images in your
                 next.config.js ». Le composant JETTE, la page entière tombe. Même carte sur la
                 page publique du trajet et sur le profil (`UserHero`).
Cause          : `apps/user-ui/next.config.js` n'avait aucune section `images` : `next/image`
                 refuse tout hôte distant non déclaré. Les avatars viennent d'ImageKit (téléversement)
                 et de Google (`payload.picture` à la connexion Google) — deux hôtes distants. Le
                 seed n'a aucun avatar, la recette n'en avait jamais rencontré ; le poste en avait
                 un (le compte du développeur, listé dans « Tous les trajets »).
Correction     : `images.remotePatterns` : `ik.imagekit.io` et `lh3.googleusercontent.com`
                 (`next.config.js`, redémarrage du front nécessaire — la config n'est pas
                 rechargée à chaud).
Contre-épreuve : scénario « ANO-WEB-27 » : un avatar ImageKit est posé EN BASE sur Thomas (référence
                 seule, aucun téléversement), Paris → Brazzaville s'affiche avec sa carte, la page
                 publique aussi, aucune erreur `next/image`, aucune page d'incident ; l'avatar est
                 retiré quoi qu'il arrive. WEB-RCH-1 vérifie aussi l'absence de la page d'incident.
```

```
ANO-WEB-28
Fiche          : (contre-épreuve d'ANO-WEB-27, chapitre 5.9) · Gravité : BLOQUANTE · ÉTAT : OUVERTE
Attendu        : chaque membre peut poser son avatar.
Obtenu         : `POST /auth/me/avatar` répond **500** (« Something went wrong ») pour le SECOND
                 membre de la plateforme qui pose un avatar — vérifié avec Joséphine pendant qu'un
                 autre compte en a un. Erreur serveur : `P2002 … Image_carrierPageId_key`.
Cause          : le modèle `Image` porte deux clés étrangères OPTIONNELLES et `@unique`
                 (`userId` pour l'avatar d'un membre, `carrierPageId` pour celui d'une page
                 Voyageur). Sur MongoDB, Prisma crée pour `@unique` un index unique NON ÉPARS
                 (vérifié par `listIndexes` : `unique: true`, pas de `sparse`) : deux documents
                 à `carrierPageId: null` entrent en collision. Le premier avatar de membre passe,
                 le second échoue ; symétriquement pour les avatars de page Voyageur. C'est le
                 piège « nullable unique fields on Mongo collide on null (P2002) » de CLAUDE.md,
                 jamais payé ici parce que la recette 5.5 n'avait pas joué le téléversement réel
                 (WEB-PRO-5/6 ⏭) et que le seed n'a aucun avatar.
Proposition    : Prisma ne sait pas déclarer un index épars ou partiel sur Mongo. Deux voies :
                 (A) scinder `Image` en deux modèles 1-1 sans FK optionnelle (`UserAvatar` avec
                 `userId @unique` requis, `CarrierAvatar` avec `carrierPageId @unique` requis) —
                 propre, une migration de données (un document aujourd'hui), les deux écrivains
                 (`profile.controller.ts`, page Voyageur) et les lecteurs à ajuster ; (B) garder
                 `Image`, retirer les deux `@unique` du schéma et poser à la main deux index
                 uniques PARTIELS (`partialFilterExpression: { userId: { $type: "objectId" } }`)
                 par script — fragile (`prisma db push` ne les connaît pas). **Recommandation :
                 (A)**, candidat au registre (D-next), PR dédiée hors recette.
État recette   : scénario « ANO-WEB-28 » en `test.fail` — il attend 200 ; le jour où c'est
                 corrigé, Playwright signale que la fiche passe (retirer la marque). La
                 contre-épreuve d'ANO-WEB-27 contourne le piège en posant `carrierPageId` (la page
                 Voyageur de Thomas) sur l'image de test.
```

```
ANO-WEB-29
Fiche          : WEB-ALR-7 (chapitre 5.10) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : après « Supprimer » puis « Confirmer », le toast « Alerte supprimée ».
Obtenu         : la carte disparaissait, le compteur passait à « 1 alerte active », et AUCUN
                 toast — deux exécutions sur deux. Le geste réussissait sans retour.
Cause          : la suppression est OPTIMISTE (`useDeleteSavedRoute.onMutate` retire la carte de
                 la liste avant la réponse) : le composant `SavedRouteCard` est démonté pendant
                 que la requête court. Or les callbacks passés à `mutate(id, { onSuccess })`
                 sont portés par l'observateur du composant, que TanStack Query détache au
                 démontage — ils ne sont jamais appelés. Les callbacks déclarés dans les options
                 du hook (`useMutation({ onSuccess })`), eux, sont portés par la mutation et
                 survivent. « Prolonger » et « Email activé » ne démontent pas la carte : leurs
                 toasts passaient.
Correction     : `useDeleteSavedRoute({ onSuccess, onError })` accepte les retours et les
                 appelle depuis les options du hook ; la carte lui passe ses deux toasts et
                 appelle `deleteSavedRoute(id)` sans callbacks.
Contre-épreuve : WEB-ALR-7 exige le toast « Alerte supprimée » (avant : « non vu » deux fois).
```

```
ANO-WEB-30
Fiche          : WEB-FAV-5 (chapitre 5.11) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : un favori dont le trajet est parti reste listé, avec le badge « Trajet passé ».
Obtenu         : il reste listé, sans aucun badge — la carte d'un trajet parti depuis deux jours
                 ressemble à toutes les autres.
Cause          : la clé `favorites.list.pastTrip` existait dans les textes FR/EN mais n'était
                 rendue nulle part ; et la carte de recherche (`YambaTripResult`) n'expose qu'une
                 date FORMATÉE (« 12 juin 2026 ») — rien qu'un client puisse comparer à
                 « maintenant » sans réinterpréter une chaîne selon la locale.
Correction     : le contrat `YambaTripResult` porte `departureAt` (ISO 8601, optionnel — les cinq
                 `openapi.json` sont régénérés, le registre de schémas est partagé) ; le mapper
                 trip-service le renseigne ; `FavoriteTripsList` rend « Trajet passé » quand
                 `departureAt < maintenant`.
Contre-épreuve : WEB-FAV-5 met `los` (Londres → Lagos, parti depuis 2 jours, toujours PUBLISHED)
                 en favori et lit le badge dans « Mes favoris ».
```

```
ANO-WEB-31
Fiche          : WEB-FAV-10 (chapitre 5.11) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : « Ne plus suivre » puis « Confirmer » → toast « Tu ne suis plus ce voyageur ».
Obtenu         : la ligne disparaissait, le compteur d'abonnés baissait, aucun toast.
Cause          : même classe qu'ANO-WEB-29 (5.10) : `useUnfollowUser.onMutate` retire la carte de
                 « Voyageurs suivis » avant la réponse ; `FollowedTripperCard` est démonté ; les
                 callbacks passés à `mutate(slug, { onSuccess })` sont portés par l'observateur
                 du composant, que TanStack Query détache au démontage.
Correction     : `useUnfollowUser({ onSuccess, onError })` accepte les retours et les appelle
                 depuis les options du hook ; la carte lui passe ses toasts et appelle
                 `unfollow(slug)` nu. (`FollowSidebar`, sur la page publique, ne démonte pas son
                 bouton : inchangé.)
Contre-épreuve : WEB-FAV-10 exige le toast.
Règle tirée    : tout retour utilisateur d'une mutation OPTIMISTE qui retire l'élément se déclare
                 au niveau du hook, jamais dans `mutate(...)` — troisième occurrence du motif
                 (5.10 alertes, 5.11 suivis) : à passer en revue sur tous les `mutate(x, { onSuccess })`
                 du front (regard d'expert).
```

```
ANO-WEB-32
Fiche          : WEB-FAV-4 (chapitre 5.11) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : « tente d'ajouter un trajet masqué » → « Ce trajet n'est plus disponible ».
Obtenu         : `POST /trips/:id/favorite` sur `yul` masqué par la médiation répondait **200** :
                 un trajet que personne ne peut plus voir (404 public, hors recherche) se mettait
                 encore en favori.
Cause          : `addFavorite` ne regardait que `status !== "PUBLISHED"` ; le masquage
                 administratif (D57, `hiddenByAdminAt`) laisse le statut PUBLISHED — c'est
                 précisément ce qui le distingue de la pause.
Correction     : `loadTripForFavorite` lit `hiddenByAdminAt` ; posé → 409 `TRIP_NOT_FAVORITABLE`
                 (« This trip is no longer available. »), le même code que pour un trajet non
                 publié, donc le même message à l'écran. Le retrait reste toujours possible.
                 Test unitaire ajouté (`trip-favorite.service.spec.ts`, trip-service 260 → 261).
Contre-épreuve : WEB-FAV-4 masque `yul` par le back-office, exige 409 à l'ajout et 200 au
                 retrait, puis lève le masquage.
```

```
ANO-WEB-33
Fiche          : WEB-RSV-10 (chapitre 5.12) · Gravité : MAJEURE (le cahier : « sa présence est une
                 anomalie majeure ») · ÉTAT : CLOSE
Attendu        : le mot « assurance » n'apparaît nulle part — Yamba vend une « Garantie », pas une
                 assurance (cadre réglementaire).
Obtenu         : « Au moins 1 photo requise avec l'assurance 500 € » (erreur de validation quand la
                 garantie étendue est choisie sans photo) ; et cinq chaînes mortes du copy legacy
                 (« Assurance jusqu'à 500 € », « Assurance 500 € », « Assurance », « Obligatoire avec
                 l'assurance », « Assurance optionnelle ») prêtes à ressurgir.
Correction     : « … avec la Garantie Yamba 500 € » (`booking.config.ts`) ; le copy legacy dit
                 « Garantie Yamba » / « Protection » (`booking.copy.ts`).
Contre-épreuve : WEB-RSV-10 lit le message corrigé et exige l'absence du mot dans toute la page.
```

```
ANO-WEB-34
Fiche          : WEB-RSV-6 (chapitre 5.12) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : « Poids (kg) » pré-rempli à 2 (ou au poids mémorisé en recherche). Jamais vide.
Obtenu         : le champ s'ouvrait VIDE (et le récapitulatif affichait « 0 € », cf. ANO-WEB-37).
Cause          : `buildInitialDraft(trip)` (poids 2 kg ou mémorisé, première famille acceptée, lieu
                 unique pré-sélectionné) existait dans `booking.state.ts`… et n'était appelée par
                 personne : `BookingWizard` et `BookingMobile` faisaient `useBookingDraft()` avec le
                 brouillon vide `initialDraft`.
Correction     : les deux wizards passent `useMemo(() => buildInitialDraft(trip), [trip])` au hook ; la
                 reprise `sessionStorage` garde la priorité.
Contre-épreuve : WEB-RSV-5/6 exige « 2 » à l'ouverture (poids mémorisé effacé).
```

```
ANO-WEB-35
Fiche          : WEB-RSV-20 (chapitre 5.12) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : ouvrir `/trips/<son trajet>/book` → « Tu ne peux pas réserver ton propre trajet. »
Obtenu         : l'assistant s'ouvrait normalement ; le refus (`OWN_TRIP`) ne tombait qu'à l'intention
                 de paiement, quatre étapes plus loin.
Correction     : `BookingClient` compare `user.id` à `trip.carrier.id` et affiche le message à
                 l'ouverture (le serveur garde son refus).
Contre-épreuve : WEB-RSV-20.
```

```
ANO-WEB-36
Fiche          : WEB-RSV-18 (chapitre 5.12) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : après « Le prix a changé depuis ton devis. Le nouveau total est affiché — vérifie-le
                 avant de payer. », le nouveau total EST affiché.
Obtenu         : le message, mais le récapitulatif et le bouton « Payer » gardaient l'ancien total
                 (32,20 €) alors que la nouvelle intention portait 42 € : le texte mentait.
Cause          : `useBookingCheckout` ne rafraîchissait que l'intention de paiement ; le devis
                 affiché est calculé côté client à partir du TRAJET en cache (`["public-trip", id]`),
                 jamais relu.
Correction     : sur `QUOTE_DIVERGENCE` / `PAYMENT_MISMATCH`, `queryClient.invalidateQueries(["public-trip", tripId])`
                 avant de redemander l'intention : le récapitulatif recalcule (42 €).
Contre-épreuve : WEB-RSV-18 (Joséphine passe le prix de 11,50 à 15,00 pendant qu'Aminata est à
                 l'étape 4) : 409 `QUOTE_DIVERGENCE`, message, « Payer 42 € », aucun deal créé.
```

```
ANO-WEB-37
Fiche          : WEB-RSV-12 (chapitre 5.12) · Gravité : MAJEURE (WEB-NRG-2) · ÉTAT : CLOSE
Attendu        : poids vidé → l'indice « Indique le poids du colis pour voir le prix. » et JAMAIS
                 « 0 € », « 0,00 € » ou « — ».
Obtenu         : l'indice… sous « Transport 0 € », « Service & protection 0 € », « Total 0 € ».
Cause          : `computeTotal` renvoie un `PriceBreakdown` à zéros avec `quoteError` ; la colonne
                 (`BookingSummarySidebar`) et la feuille mobile (`BookingBottomSheet`) rendaient les
                 lignes de prix dans tous les cas, l'indice en plus.
Correction     : quand `quote === null && quoteError`, seul l'indice est rendu (lignes et total
                 masqués ; en mobile, l'indice remplace le montant « Total à payer »).
Contre-épreuve : WEB-RSV-12.
```

```
ANO-WEB-38
Fiche          : WEB-RSV-21 (chapitre 5.12) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : réserver un trajet parti → « Ce trajet n'accepte plus de demandes. » (ou introuvable).
Obtenu         : `bzv-inflight` (parti depuis 6 jours, toujours PUBLISHED) ouvrait l'assistant ; le
                 refus (`TRIP_NOT_BOOKABLE`, « already departed ») ne tombait qu'au paiement.
Correction     : `BookingClient` lit `publicTrip.dates.departureAt` et affiche le message à
                 l'ouverture quand le départ est passé. (Un trajet masqué par Yamba répond 404 en
                 public : « Trajet introuvable », déjà conforme.)
Contre-épreuve : WEB-RSV-21.
```

```
ANO-WEB-39
Fiche          : WEB-RSV-9 (chapitre 5.12) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : une photo de plus de 10 Mo → refus explicite, aucun envoi.
Obtenu         : la photo entrait dans la grille comme une autre ; le refus (« Une photo dépasse
                 10 Mo… ») ne venait qu'à l'étape 4, au clic « Payer » (les photos partent au
                 paiement). Aucun envoi, mais trois étapes plus tard.
Correction     : `StepParcel.handleAddPhotos` filtre sur `PHOTO_MAX_SIZE_BYTES` dès la sélection et
                 affiche le message de l'étape 4 (`step4.errors.UPLOAD_TOO_LARGE`).
Contre-épreuve : WEB-RSV-9 : le message, deux photos toujours, aucune requête ImageKit.
```

```
ANO-WEB-40
Fiche          : WEB-TRU-1 (chapitre 5.13) — observation consignée au chapitre 5.12 · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : après un refus de plafond (compte neuf, D71), la carte de paiement dit le refus et
                 rien n'invite à payer ; « Payer » n'est actif que lorsqu'une autorisation existe.
Obtenu         : le bouton « Payer {montant} » restait actif à côté de l'encadré de refus (et avant
                 le retour de l'intention : un clic muet, piège 18 du handoff). Sans danger — le
                 serveur refuse aussi la demande — mais l'écran se contredisait.
Correction     : `BookingWizard` et `BookingMobile` grisent le bouton principal à l'étape 4 tant que
                 `checkout.intent` est absent (`ctaDisabled = isSubmitting || (step === 4 && !intent)`) :
                 en attente de l'autorisation, et après un refus (l'encadré et « Réessayer » restent
                 les seules issues).
Contre-épreuve : WEB-TRU-1 et WEB-TRU-2 : « Payer » `disabled` à côté de l'encadré, « Réessayer » visible.
```

```
ANO-WEB-41
Fiche          : WEB-DEA-1 (chapitre 5.14) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : l'accueil et « Mes trajets » datent chaque ligne (« Paris → Brazzaville · sam. 26 sept. »),
                 rangent un trajet parti dans l'historique et trient par date de départ.
Obtenu         : « jeu. 1 janv. » sur TOUTES les lignes « À traiter », « trajet du 1 janv. » sur les
                 remises, un trajet parti depuis six jours rangé dans « à venir » : `TripListItem` ne
                 lisait que `departureDateLocal` / `departureTimeLocal`, des chaînes que SEUL le wizard
                 de création écrit — absentes des trajets créés par l'API, le seed ou un futur client
                 mobile (même famille qu'ANO-WEB-22, côté tableau de bord). Le repli était l'époque
                 Unix (`new Date(0)`), et `isTripPastDeparture(null)` répondait « pas parti ».
Correction     : `apps/user-ui/src/components/trips/list/trip-local-dates.ts` (pure) dérive les quatre
                 chaînes locales de `departureAt` / `arrivalAt` dans le fuseau du lieu (`originTimezone`,
                 `destinationTimezone`, repli navigateur) quand le wizard ne les a pas écrites ; appliquée
                 UNE fois, dans les hooks de lecture `useMyTrips` et `useTrip` — tous les consommateurs
                 (accueil, « Mes trajets », fiche du trajet, badge de navigation, tri, groupes) en héritent.
Contre-épreuve : WEB-DEA-1 : « Demande de Aminata · Paris → Brazzaville · sam. 26 sept. », aucun « 1 janv. »,
                 le trajet du 5 sept. dans « Historique ».
```

```
ANO-WEB-42
Fiche          : WEB-DEA-2 (chapitre 5.14) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : le bloc « MODALITÉS DE REMISE ET LIVRAISON » écrit chaque lieu une fois, et porte la
                 mention « Téléphone du destinataire communiqué à la prise en charge ».
Obtenu         : « Terminal départ · Paris / Terminal départ · Paris » (le détail répété sous le nom) et
                 la mention absente : `toLocation` (deal.adapter) posait `name = details || city` ET
                 `detail = details` ; la ligne de repli de la livraison (la mention) ne s'affichant que
                 sans `detail`, elle n'apparaissait jamais.
Correction     : `detail` n'est gardé que s'il diffère de `name` (deal.adapter.ts) : un lieu, une ligne ;
                 la mention de la livraison revient. Même famille sur « Mon Deal accepté » : « LIVRAISON À
                 Hall d'arrivée · Brazzaville · Brazzaville » (la ville ajoutée à un lieu qui la porte déjà) —
                 `DealAcceptedRecap` n'ajoute la ville que si le lieu ne la contient pas.
Contre-épreuve : WEB-DEA-2 : « Terminal départ · Paris » une seule fois, la mention présente ; WEB-DEA-9 :
                 jamais « Brazzaville · Brazzaville ».
```

```
ANO-WEB-43
Fiche          : WEB-DEA-2 (chapitre 5.14) · Gravité : MINEURE · ÉTAT : OUVERTE
Attendu        : le bloc « DE LA PART DE » dit « {n} envois » et « Membre depuis {mois} {année} ».
Obtenu         : « AD Aminata D. Voir profil » seul. Les libellés (`shipperCard.shipmentCount`,
                 `memberSince`) et le composant existent ; le DTO Voyageur (`toCounterpart`, deal-service)
                 ne porte ni le compteur ni la date d'inscription — l'adapter le documente en tête.
Proposition    : `memberSince` = `User.createdAt` (gratuit), `shipmentCount` = deals terminés de
                 l'Expéditeur (un `count`, ou le compteur dénormalisé du TrustScore D71) dans le DTO
                 Voyageur ; contrat OpenAPI à régénérer. PR dédiée.
```

```
ANO-WEB-44
Fiche          : WEB-DEA-9 (chapitre 5.14) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : « Le code reste secret. … Aminata le révèle à Clarisse quand tu confirmes le pickup. » et
                 « Tu rencontres Clarisse, elle te donne le code à 6 chiffres ».
Obtenu         : « Aminata le révèle à Hall … », « Tu rencontres Hall » : l'écran « Mon Deal accepté »
                 (desktop ET mobile) prenait pour prénom du destinataire le PREMIER MOT du lieu de
                 livraison (`deliveryLocation.name.split(" ")[0]` — un « TODO Phase backend » vieux de
                 la maquette). L'API sert pourtant le prénom dès la création (`recipientForCarrier` ne
                 retient que le téléphone avant le pickup) ; l'adapter ne l'exposait qu'après le pickup.
Correction     : `DealDetail.recipientFirstName` (toujours servi) posé par l'adapter ; les deux vues
                 acceptées et la vue « close » le lisent ; `recipient` (avec téléphone) attend toujours
                 le pickup.
Contre-épreuve : WEB-DEA-9 : la phrase du cahier mot pour mot avec « Clarisse » ; jamais « révèle à Hall ».
```

```
ANO-WEB-45
Fiche          : WEB-MSG-6, WEB-MSG-10 (chapitre 5.15) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : un refus de la messagerie (code de livraison dans le message, créneau hors bornes) se lit
                 en français sous la saisie : « le code se donne en main propre », « au moins 30 minutes »…
Obtenu         : « This message contains the delivery code. Give it in person, never in writing. » et
                 « Invalid meeting slot. » : le fil et le panneau de rendez-vous affichaient le `message`
                 ANGLAIS de l'API (`err.response.data.message`) tel quel.
Correction     : les deux composants traduisent le `details.code` du refus (A146) — `DELIVERY_CODE_IN_MESSAGE`,
                 `INVALID_MEETUP_SLOT` + `reason` (`TOO_SOON` / `TOO_FAR` / `WINDOW_TOO_LONG`), `MEETUP_CHANGED`,
                 `CONVERSATION_READ_ONLY` — nouvelles clés `messaging.errors.*` (FR + EN), repli sur le
                 message générique existant.
Contre-épreuve : WEB-MSG-6 : « Ce message contient le code de livraison. Il se donne en main propre, jamais
                 par écrit. » ; WEB-MSG-10 : « …au moins 30 minutes à l'avance. », « …dans les 90 jours. »,
                 « …12 heures au plus. ».
```

```
ANO-WEB-46
Fiche          : WEB-MSG-6 (chapitre 5.15) · Gravité : BLOQUANTE · ÉTAT : CLOSE
Attendu        : le code de livraison ne circule JAMAIS par écrit (D43 / D61 4A) : « Le code : 742 891 » est
                 refusé comme « le code est 742891 ».
Obtenu         : « Le code : 742 891 » PASSAIT (201, dans le fil) : `sixDigitCandidates` ne lisait que les
                 six chiffres collés (`\b\d{6}\b`) ; un espace, un tiret ou un point entre les chiffres
                 suffisait à contourner la garde — l'invariant était rompu.
Correction     : `message-guard.rules.ts` retire les séparateurs entre chiffres (espace, point, tiret,
                 apostrophe, barre) avant une seconde lecture : « 742 891 », « 74-28-91 », « 7 4 2 8 9 1 »
                 deviennent des candidats (toujours trois au plus, bcrypt) ; un téléphone (dix chiffres)
                 ou une date (huit) n'en produisent pas. +1 test unitaire (message-service 43).
Contre-épreuve : WEB-MSG-6 : les deux formes refusées (400 `DELIVERY_CODE_IN_MESSAGE`), « mon numéro de vol
                 est 123456 » passe.
```

```
ANO-WEB-47
Fiche          : WEB-MSG-13 (chapitre 5.15) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : après un rendez-vous confirmé, l'un des deux peut en proposer un autre (changer l'heure ou
                 le lieu) et l'autre l'accepter — le raccourci du cahier (un rendez-vous dans 40 minutes
                 après celui de MSG-11) le suppose.
Obtenu         : la nouvelle proposition était INVISIBLE : le panneau n'affiche que « le rendez-vous qui
                 compte » (`nextMeetupOf`), et la règle préférait toujours le prochain ACCEPTÉ ; l'autre
                 partie ne voyait jamais « À confirmer par vous » — impossible de replanifier.
Correction     : `nextMeetupOf` fait primer une proposition PLUS RÉCENTE que l'acceptation (une
                 re-proposition) ; accepter une re-proposition annule le précédent confirmé du même type
                 (un seul rendez-vous confirmé par type : l'ancre du numéro et la liste ne balancent plus).
                 +1 test unitaire (message-service 44). Candidat registre : compléter D61 1A.
Contre-épreuve : WEB-MSG-13 : Pauline propose à +40 min, Thomas lit « À confirmer par vous », accepte ;
                 « Voir le numéro » répond 200.
```

```
ANO-WEB-48
Fiche          : WEB-MSG-22 (chapitre 5.15) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : un tiers qui ouvre l'adresse d'un fil lit « La conversation n'a pas pu être ouverte. » ;
                 rien du fil n'est révélé.
Obtenu         : l'API refuse bien (403 `NOT_A_PARTY`, aucun contenu) mais l'écran restait sur
                 « Chargement… » sans fin : `ConversationThread` ne rendait que `isLoading || !data`.
Correction     : `isError` → « La conversation n'a pas pu être ouverte. » (clé `open.failed`, déjà là).
Contre-épreuve : WEB-MSG-22 : Aminata sur le fil de Pauline — l'API 403, la phrase à l'écran, aucun message.
```

```
ANO-WEB-49
Fiche          : WEB-PIC-1, WEB-PIC-2 (chapitre 5.16) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : « Ce que Pauline a déclaré », « la déclaration de Pauline » — et « qu'Aminata », « d'Aminata ».
Obtenu         : « Ce qu'Pauline a déclaré », « la déclaration d'Pauline », « Le contenu correspond à ce
                 qu'Pauline… » : l'élision était ÉCRITE dans le message (`qu''{prénom}`, `d''{prénom}`),
                 juste devant une voyelle, fausse devant une consonne (cinq textes : prise en charge ×4,
                 livraison ×1). Le cahier a la même faute (« ce qu'{prénom} a déclaré »).
Correction     : `apps/user-ui/src/lib/elision.ts` (`elider("que"|"de", nom)` : voyelle ou h → élision)
                 ; les cinq messages reçoivent `{queShipper}` / `{deShipper}` calculés par le composant.
Contre-épreuve : WEB-PIC-1 : « Ce que Pauline a déclaré », « la déclaration de Pauline », jamais « qu'Pauline ».
```

```
ANO-WEB-50
Fiche          : WEB-PIC-1 (chapitre 5.16) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : « Tu deviens officiellement responsable du colis jusqu'à la remise à Clarisse. »
Obtenu         : « …jusqu'à la remise à Brazzaville. » — les deux vues de prise en charge (desktop, mobile)
                 prenaient le premier mot du lieu de livraison pour prénom (même `split(" ")[0]` qu'ANO-WEB-44).
Correction     : `deal.recipientFirstName` (servi à toute étape depuis ANO-WEB-44), repli sur la ville.
Contre-épreuve : WEB-PIC-1 : la phrase avec « Clarisse ».
```

```
ANO-WEB-51
Fiche          : WEB-PIC-2, WEB-PIC-3 (chapitre 5.16) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : le bouton « Confirmer la prise en charge » inactif EXPLIQUE ce qui manque : « Coche les 5
                 points de vérification avant de confirmer », « Ajoute au moins 1 photo avant de confirmer ».
Obtenu         : le bouton était gris et muet ; les deux textes existaient (`validation.*`) et aucun
                 composant ne les affichait — même motif que la carte « demandes en attente » (5.14) :
                 de la copie écrite, jamais branchée.
Correction     : `PickupConfirmCard` (écran large) et `PickupFooter` (mobile, via `blockingHint` calculé
                 par `DealPickupMobile`) rendent l'indice sous le bouton tant qu'il est inactif.
Contre-épreuve : WEB-PIC-2 (3/5 → « Coche les 5 points… »), WEB-PIC-3 (5/5 sans photo → « Ajoute au
                 moins 1 photo… », puis actif avec une photo).
```

```
ANO-WEB-52
Fiche          : WEB-PIC-4 (chapitre 5.16) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : une photo de plus de 10 Mo est refusée à la sélection : « Une photo dépasse 10 Mo. Réduis-la
                 ou choisis-en une autre — rien n'a été envoyé. »
Obtenu         : la photo entrait dans la grille (« Retirer cette photo », « Photos 1 ») ; les photos ne
                 partent qu'à la confirmation, le refus serait venu au clic « Confirmer » (ANO-WEB-39, la
                 même dette sur l'assistant de réservation).
Correction     : `addPhoto` (DealPickupClient) filtre taille et format à la sélection, avec les textes de
                 `errors.uploadTooLarge` / `errors.uploadInvalidType`.
Contre-épreuve : WEB-PIC-4 : le message, aucune vignette, aucun appel de prise en charge.
```

```
ANO-WEB-53
Fiche          : WEB-PIC-10 (chapitre 5.16) · Gravité : MINEURE · ÉTAT : OUVERTE
Attendu        : après le décollage, le suivi Expéditeur dit « Thomas a décollé à 17:06 · arrivée prévue à
                 {heure} » et la frise « vol de {durée} ».
Obtenu         : « arrivée prévue à — », « vol de — » : l'instantané du trajet figé dans la réservation
                 (`BookingTripSnapshot`) porte `departureAt` mais pas `arrivalAt` ; le DTO Expéditeur ne
                 peut rien en dériver.
Proposition    : `arrivalAt` dans l'instantané (schéma, écrit à la réservation), servi par le mapper et le
                 contrat (`ShipperBookingView.trip.arrivalAt`, OpenAPI régénéré), lu par la bannière ; les
                 réservations existantes gardent « — ». PR dédiée.
```

```
ANO-WEB-54
Fiche          : WEB-PIC-10 (chapitre 5.16) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : la carte « Partage le suivi à Clarisse » explique : « Un lien sans compte : Clarisse voit où
                 en est le colis, sans ton adresse ni le code. »
Obtenu         : la clé brute « bookingTracker.trackingLink.subtitle » à l'écran : `t("subtitle")` sans la
                 variable `{recipientFirstName}` — next-intl rend alors le chemin de la clé.
Correction     : la variable est passée (`BookingTrackingLinkCard`).
Contre-épreuve : WEB-PIC-8/9/10 : aucun texte commençant par « bookingTracker. » sur le suivi.
```

```
ANO-WEB-55
Fiche          : WEB-COD-3, WEB-COD-4 (chapitre 5.17) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : « Copier le code » → toast « Code copié ! » ; « Copier le message » → toast « Message copié ! ».
Obtenu         : « Code copié ! » existait au catalogue (`pickedUp.code.copied`) et n'était JAMAIS rendu : seule
                 l'icône du bouton changeait deux secondes, l'`aria-label` restait « Copier le code ». Le message,
                 lui, ne changeait que le libellé du bouton. Même famille qu'ANO-WEB-51 : de la copie écrite,
                 jamais branchée.
Correction     : `BookingCodeCard` — toast + `aria-label` / `title` basculés sur « Code copié ! » ;
                 `BookingShareCode` — toast « Message copié ! » en plus du libellé.
Contre-épreuve : WEB-COD-3 (le toast, le presse-papiers = six chiffres), WEB-COD-4 (le libellé).
```

```
ANO-WEB-56
Fiche          : WEB-COD-4 (chapitre 5.17) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : « WhatsApp » s'ouvre SUR LE NUMÉRO SAISI À LA RÉSERVATION, message pré-rempli ; « SMS » de même.
Obtenu         : `https://wa.me/?text=…` et `sms:?&body=…` — sans destinataire : l'Expéditrice devait chercher
                 Clarisse dans ses contacts, alors que `recipient.phoneE164` est servi à l'Expéditeur (D69) et que
                 la carte du lien de suivi (`BookingTrackingLinkCard`) le faisait déjà. Idem pour « Repartager »
                 de la phase voyage (`SenderCodeCard`).
Correction     : `BookingShareCode` et `SenderCodeCard` : `wa.me/<chiffres>?text=` et `sms:<numéro>?&body=` ;
                 sans numéro, le lien reste ouvert (l'utilisatrice choisit le contact).
Contre-épreuve : WEB-COD-4 : `window.open` capturé → `wa.me/242061234567`, `text` = le message copié.
```

```
ANO-WEB-57
Fiche          : WEB-COD-5, WEB-COD-6 (chapitre 5.17) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : après une régénération, « 4 régénérations restantes » ; après la cinquième, « Aucune
                 régénération restante » et le bouton inactif.
Obtenu         : le compteur ne vivait QUE dans la boîte de confirmation (« Régénérer le code ? … · 4
                 régénérations restantes ») : invisible après le geste, et « Aucune régénération restante »
                 impossible à lire — le bouton inactif n'ouvre plus la boîte. La forme plurielle `=0` du
                 message était inatteignable.
Correction     : le compteur est rendu en permanence sous l'avertissement de confidentialité
                 (`BookingCodeCard`) et sous l'aide de la carte compacte (`SenderCodeCard`).
Contre-épreuve : WEB-COD-5 (« 5 » puis « 4 régénérations restantes »), WEB-COD-6 (4 → 3 → 2 → 1 → « Aucune »).
```

```
ANO-WEB-58
Fiche          : WEB-COD-6 (chapitre 5.17) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : un essai forcé au-delà du plafond → « Tu as atteint la limite de régénérations. Contacte le
                 support si besoin. »
Obtenu         : le serveur refuse bien (409, `details.code = CODE_REGENERATION_LIMIT`, prouvé par l'API) et
                 `booking-tracker.api.ts` le traduit en `BookingApiError.code` — mais les deux cartes
                 ignoraient ce code et affichaient « Erreur lors de la régénération. Réessaye. » Le message
                 du plafond ne sortait que du garde-fou CLIENT (`regenerationsLeft <= 0`), inatteignable
                 puisque le bouton est déjà inactif. Cas réel : un second onglet resté sur « 1 régénération
                 restante ».
Correction     : `catch (e)` des deux cartes : `CODE_REGENERATION_LIMIT` → `toastMaxReached`, et la boîte
                 de confirmation se ferme.
Contre-épreuve : WEB-COD-6 : l'onglet en retard clique « Oui, régénérer », 409 relu, le message du cahier,
                 le code inchangé après rechargement, « Aucune régénération restante ».
```

```
ANO-WEB-59
Fiche          : WEB-COD-3 (chapitre 5.17) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : quand la copie échoue (pas de `navigator.clipboard` hors HTTPS — le LAN de recette en http),
                 l'échec est dit, et dit juste.
Obtenu         : « Copier le code » en échec affichait « Erreur lors de la régénération. Réessaye. » (le
                 `toastError` d'une autre action) ; « Copier le message » échouait en silence.
Correction     : clé `pickedUp.code.copyFailed` (FR / EN) : « Copie impossible sur ce navigateur — sélectionne le
                 code et copie-le à la main. » sur les deux boutons.
Contre-épreuve : WEB-COD-3, second navigateur sans presse-papiers : le message, jamais « régénération ».
```

```
ANO-WEB-60
Fiche          : WEB-REM-1 (chapitre 5.18) · Gravité : MAJEURE · ÉTAT : CLOSE
Attendu        : « Depuis le suivi de transit, clique « Valider la livraison » » — sur tout deal pris en charge ; les
                 jalons (aéroport, décollage, atterrissage) portent le badge « Optionnel » et l'API livre depuis
                 PICKED_UP quel que soit l'avancement.
Obtenu         : la carte-projecteur ne proposait « Valider la livraison » qu'APRÈS le troisième jalon (`getNextEvent`
                 → DELIVER) : trois jalons « optionnels » de fait obligatoires pour atteindre l'écran du code par
                 l'interface (seule l'URL `/deliver` tapée à la main y menait). Un Voyageur qui ne coche rien en
                 vol arrivait devant le destinataire sans chemin vers la remise.
Correction     : `TrackingSpotlight`, variante « jalon optionnel » : sous le bouton du jalon, « {destinataire} est
                 déjà devant toi ? Tu peux passer directement à la remise : Valider la livraison » (clé
                 `spotlight.deliverEarly`, FR / EN) — le chemin direct est toujours ouvert.
Contre-épreuve : WEB-REM-1 : `sgn-picked` (aéroport confirmé, « Ton vol décolle ? » proposé) → « Valider la
                 livraison » → `/deliver`.
```

```
ANO-WEB-61
Fiche          : WEB-REM-2 (chapitre 5.18) · Gravité : MINEURE · ÉTAT : CLOSE
Attendu        : après un code faux, « {n} tentatives restantes » puis « Dernière tentative » ; reprendre la saisie
                 ramène « Tentative 2 sur 3 » ; chaque échec secoue et vide les cases.
Obtenu         : (1) `otp.attemptsLeft` existait au catalogue et n'était JAMAIS rendu (même famille qu'ANO-WEB-51/55) ;
                 (2) l'erreur remplaçait la ligne « Tentative n sur 3 » et restait affichée pendant la ressaisie —
                 « Tentative 2 sur 3 » ne revenait jamais ; (3) l'effet « secousse + cases vidées » était déclenché
                 par le TEXTE de l'erreur, identique d'un essai à l'autre : au deuxième code faux, rien ne bougeait
                 et les six chiffres faux restaient dans les cases.
Correction     : `DeliverOtpInput` — le compteur est rendu sous l'erreur et à côté de « Tentative n sur 3 » ; l'erreur
                 s'efface dès le premier chiffre ressaisi (`erreurMasquee`) ; l'effet est rearmé par le compteur
                 d'essais (`[errorMessage, attemptsUsed]`), pas par le texte.
Contre-épreuve : WEB-REM-2 : « 2 tentatives restantes », « Tentative 2 sur 3 » à la ressaisie, « Dernière
                 tentative », « Tentative 3 sur 3 ».
```

---

## Chapitre 5.1 — Découverte, accueil et navigation · **CONFORME** (12 fiches, 1 min 24)

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-ACC-1 | L'accueil du visiteur : en-tête, barre de recherche, pied de page, aucun squelette, console | **Conforme** — logo, « Partager un trajet », « Connexion » ; deux villes et une date ; « Découvrir / Entreprise / Légal » et la phrase de marque ; aucun `animate-pulse` après 5 s. Console : deux lignes 401 (sonde de session, voir observations), rien d'autre. **Écart** : l'en-tête desktop ne porte ni « Rechercher un trajet » ni « Créer un compte » (ils n'existent que dans la feuille mobile) — décision à prendre, voir « à trancher » |
| WEB-ACC-2 | Bascule FR → EN | **Conforme après correction** → `ANO-WEB-16` ; `/en`, `lang="en"`, en-tête, barre et pied de page en anglais, **aucune clé brute** dans les deux langues (balayage de tous les nœuds de texte). **Écart** : le sélecteur est un « FR \| EN » segmenté (libellés « Français » / « English »), sans info-bulle « Changer de langue » — la clé `header.toggleLanguage` existe et n'est pas utilisée |
| WEB-ACC-3 | Retour au français, persistance | **Conforme** — `/fr` après rechargement ; la racine `/` revient sur `/fr` |
| WEB-ACC-4 | Thème clair / sombre | **Conforme** — classe `dark` posée, conservée au rechargement, retirée au retour ; contraste titre / fond mesuré en sombre : **20,2:1** (AA ≥ 4,5). Le bouton de l'en-tête est une bascule (une icône) ; « Mode clair / Mode sombre » nommés vivent dans le menu mobile |
| WEB-ACC-5 | Les textes légaux | **Conforme après correction** → `ANO-WEB-17` ; `/fr/legal/terms` et `/fr/legal/privacy`, un titre, plus de 500 caractères, un seul `main` |
| WEB-ACC-6 | Réseaux sociaux inactifs | **Conforme après correction** → `ANO-WEB-15` |
| WEB-ACC-7 | « Partager un trajet » ouvre la porte | **Conforme** — fenêtre par-dessus l'accueil (adresse inchangée), titre et sous-titre exacts, e-mail + mot de passe + Google, « Plus tard » et la croix |
| WEB-ACC-8 | « Plus tard », Échap, clic sur le fond | **Conforme** — les trois gestes ferment ; adresse inchangée, aucune écriture vers l'API, aucune erreur |
| WEB-ACC-9 | La recherche depuis l'accueil | **Conforme après correction** → `ANO-WEB-12`, `ANO-WEB-13`, `ANO-WEB-14` ; « Trajets pour Paris → Brazzaville, République du Congo », **2 cartes** (le cahier en annonce trois : `bzv-inflight` est parti, la recherche ne le montre pas — cahier à corriger) |
| WEB-ACC-10 | Intervertir départ et destination | **Conforme** — les deux champs s'échangent ; **écart** : les résultats se recalculent au clic « Rechercher », pas d'office (le cahier les attendait recalculés) ; puis « Trajets pour Brazzaville → Paris », 0 carte |
| WEB-ACC-11 | L'accueil connecté | **Conforme** — plus de « Connexion » ni « Créer un compte » ; cloche, « Messages », « Menu utilisateur » ; le menu porte Mon compte, Mes envois, Mes trajets, Mes favoris, Notifications, Messages, Centre d'aide, Déconnexion. **Écarts** : « Centre d'aide » (le cahier dit « Aide ») ; les intitulés de section et les préférences langue / apparence ne sont rendus que dans la feuille mobile — sur desktop, la langue et le thème sont dans l'en-tête à côté du menu |
| WEB-ACC-12 | La déconnexion | **Conforme** — `POST /auth/logout` 200, « Connexion » de retour, cookies `access_token` / `refresh_token` absents, le rechargement ne réouvre rien |

### À trancher (produit)

- **L'en-tête desktop d'un visiteur** ne propose que « Partager un trajet » et « Connexion ».
  Pas de « Créer un compte » (il faut passer par l'écran de connexion), pas de « Rechercher un
  trajet » (la barre de l'accueil est le seul chemin ; depuis une autre page, le logo). Le cahier
  attend les deux. Recommandation : un « Créer un compte » plein (mangue) à droite de
  « Connexion », comme la feuille mobile le fait déjà ; « Rechercher un trajet » en lien texte à
  gauche. Une décision de produit, pas une régression : rien n'a été changé.

### Pièges de poste payés ici

- **La clé Google Maps est restreinte par référent HTTP à `localhost`.** Sur l'adresse LAN du
  poste (`http://192.168.1.155:3000`), Places répond 403 « Requests from referer … are blocked »
  et le champ reste muet — sans message (voir ANO-WEB-14 pour le `catch` muet). Les deux fiches
  d'autocomplétion se jouent en visiteur : le harnais ouvre le même front par `localhost`
  (`E2E_GOOGLE_ORIGIN` pour un poste monté autrement). Pour tester depuis un téléphone, ajouter
  l'origine LAN aux référents autorisés de la clé.
- **`fill()` ne déclenche aucune requête d'autocomplétion** ; la liste ne vient qu'au fil des
  frappes (`pressSequentially`).

## Chapitre 5.2 — Inscription par code email, consentement, Google · **CONFORME** (16 fiches : 12 jouées, 4 ⏭ · 5 min 27)

Le compte neuf est créé à chaque exécution sous une adresse unique (`neuf-<horodatage>@recette.yamba.dev`,
`compteNeuf()`) — jamais `recette+neuf@…` en dur : un compte créé la veille ferait tomber la fiche 6
du lendemain sur « adresse déjà utilisée ». Les fiches 6 à 9 forment UNE histoire (le même compte :
créé, bloqué, code renvoyé, activé) et se jouent dans un seul scénario ; le blocage d'une minute est
**attendu**, pas simulé.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-INS-1 | L'écran d'inscription | **Conforme** — `/fr/register`, « Inscription sécurisée », « Deviens Voyageur », le sous-titre, cinq champs et leurs indices (Aminata, Diallo, prenom@email.com), une case unique dont les deux textes en gras sont des liens vers `/legal/terms` et `/legal/privacy`, « Créer mon compte », « ou par e-mail », Google, « Continuer avec Facebook », « Déjà membre ? Connecte-toi ». **Écarts** : pas de « Créer un compte » dans l'en-tête desktop (même décision que 5.1 : le harnais passe par « Connexion » puis le lien de l'écran de connexion) ; le titre « Deviens Voyageur » sur un écran générique (note du cahier : écart de libellé mineur, à trancher) |
| WEB-INS-2 | Le bouton Facebook est inerte | **Conforme** — aucune fenêtre, aucune requête vers Facebook ou un OAuth, aucune erreur de page, adresse inchangée, aucune alerte dans le produit. Le premier passage l'avait déclaré ✘ à tort : le `role="alert"` visible est l'indicateur « Open Next.js Dev Tools », hors `<main>` (voir pièges) |
| WEB-INS-3 | Les champs obligatoires sont nommés un par un | **Conforme** — les quatre messages exacts sous leur champ, rien ne part au serveur, aucun message global |
| WEB-INS-4 | L'adresse email est contrôlée | **Conforme** — « Saisis un e-mail valide. » dès que le champ perd le focus |
| WEB-INS-5 | Le mot de passe : une règle violée, une phrase | **Conforme** — six cas, une seule phrase à chaque fois, nommant une seule règle (8 caractères, majuscule, caractère spécial, prénom, minuscule, suite simple), jamais « tous les critères » ; rien ne part au serveur ; l'indicateur de force accompagne la saisie. **Écart** : cas e `01/01/2000!` — la phrase dit « minuscule », pas « date » : la valeur n'a aucune lettre et la minuscule vient avant la date dans l'ordre du produit (`CHECK_ORDER`) ; à trancher |
| WEB-INS-6 | Création du compte neuf jusqu'au code | **Conforme** — sans la case : « Tu dois accepter les conditions pour continuer. », rien ne part ; avec : `POST /auth/register` 2xx, `/fr/register/verify`, « Vérification sécurisée », « Plus qu'une étape ! », « Nous avons envoyé un code à 6 chiffres à : », « Code valable » de 10:00 qui décroît (mesuré à 2 s d'écart), six cases, l'astuce du collage, « Valider mon code » ; Mailpit : « Ton code d'activation Yamba », un code à six chiffres, « 10 minutes ». **Écart** : l'adresse est affichée **masquée** (`n*********5@r***.dev`), le cahier attendait l'adresse saisie — voir « à trancher » |
| WEB-INS-7 | Le barème de blocage sur code erroné | **Conforme** — quatre codes faux : « Code incorrect. » puis « 4 / 3 / 2 essais restants avant invalidation du code » et « 1 essai restant … » ; le cinquième : « Saisie bloquée temporairement. », « Réessaie dans », l'explication, les six cases et le bouton désactivés. Après rechargement, une sixième saisie répond `OTP_LOCKED` avec `lockUntilSeconds` = 58 : le compteur vit sur le serveur |
| WEB-INS-8 | « Renvoyer le code » et son délai | **Conforme** — après la vraie minute, `POST /auth/register/resend` 2xx, « Code renvoyé », « Un nouveau code a été envoyé. Vérifie ta boîte mail. », bouton « Renvoyer dans … » désactivé, compte à rebours reparti à 10:00, un email de plus dans Mailpit. Le compteur d'essais **ne repart pas** : le 6e échec annonce « 4 essais restants », le 7e « 3 » (un nouveau lot de cinq aurait dit 4 puis 3 aussi… la preuve est que le serveur n'a pas rouvert un blocage entre les deux) |
| WEB-INS-9 | Activation du compte avec le bon code | **Conforme** — le dernier email porte un code différent du premier ; le collage (un vrai événement `paste`) remplit les six cases ; `POST /auth/register/verify` 2xx, `/fr/login?verified=1`, bandeau « Compte activé » / « Ton adresse est vérifiée. Connecte-toi avec ton mot de passe pour commencer. », email « Bienvenue ». **En base** (`inspect-user.ts`) : deux lignes `ConsentLog`, `TERMS` et `PRIVACY`, version `2026-04-26`, horodatage serveur (même milliseconde que la création), IP et navigateur portés ; `preferredLocale: "fr"` ; une empreinte de mot de passe présente |
| WEB-INS-10 | Une adresse déjà utilisée est refusée | **Conforme après correction** → `ANO-WEB-18` ; refus serveur (≥ 400), « Un compte existe déjà avec cet e-mail » sous le champ, adresse inchangée, aucun email ni pour l'adresse existante ni pour la nouvelle |
| WEB-INS-11 | « Recommencer » abandonne l'inscription en attente | **Conforme** — « Trompé d'adresse e-mail ? » puis « Recommencer » : la confirmation exacte « Sûr·e ? Tu devras recommencer toute l'inscription depuis le début. », `POST /auth/register/cancel` 2xx, retour sur `/fr/register`, les cinq champs vides, la case décochée |
| WEB-INS-12 | Le bouton Google sans configuration | **Conforme** — sur `/fr/register` et `/fr/login` : « Connexion Google bientôt disponible », désactivé, un clic forcé ne change pas l'adresse |
| WEB-INS-13 à 16 | Le parcours Google (nouvelle personne, accord, rattachement, adresse non vérifiée) | **⏭** — `NEXT_PUBLIC_GOOGLE_CLIENT_ID` absente (cahier § 2.6, état voulu). Et même posée, la fenêtre de consentement Google ne se pilote pas : ces quatre fiches se jouent **à la main** le jour où la clé est renseignée ; le spec les déclare pour que le compte reste juste |

### À trancher (produit)

- **L'écran du code masque l'adresse.** « Nous avons envoyé un code à 6 chiffres à :
  `n*********5@r***.dev` » — `maskEmail` (`lib/auth/email-mask.ts`), premier et dernier caractère
  de la partie locale, première lettre du domaine, motif d'Apple / Stripe / Wise. Le cahier
  attendait « l'adresse saisie ». Le masquage est un choix délibéré (l'écran peut être photographié
  ou partagé) et la personne vient de taper l'adresse : recommandation, **garder le masquage** et
  corriger le cahier. Le spec vérifie premier caractère, `@` et domaine.
- **La phrase du cas e.** `01/01/2000!` n'a aucune lettre : la première règle manquante, dans
  l'ordre du produit, est la minuscule ; la règle « date » (`simpleDate`) vient après. Le cahier
  attendait « ce n'est pas une date valable ». Deux lectures possibles : l'ordre actuel est
  cohérent (on nomme d'abord ce qui manque) ; ou une saisie qui ressemble à une date mérite la
  phrase « date » d'abord, plus parlante. Le spec accepte les deux ; à trancher.
- **« Deviens Voyageur » comme titre d'un écran d'inscription générique** (note du cahier) — un
  Expéditeur qui s'inscrit ne devient pas Voyageur. « Crée ton compte Yamba » serait plus juste ;
  écart de libellé mineur.
- **« Créer un compte » absent de l'en-tête desktop** — déjà posé au chapitre 5.1.

### Pièges de poste payés ici

- **Le `role="alert"` qui n'est pas le tien.** En développement, Next 16 monte son indicateur
  « Open Next.js Dev Tools » avec `role="alert"`, hors du `<main>`. Une assertion « aucune alerte
  visible » sur toute la page est fausse sur tout poste de développement : viser
  `page.locator("main")` avant `[role="alert"]`. Premier passage de WEB-INS-2 : ✘ pour cette
  seule raison.
- **Un script appelé par le harnais ne se vérifie qu'en l'exécutant.** `inspect-user.ts` est
  lancé par `execFileSync` (`tsx`, sans typecheck) : un `select` sur un champ que le modèle n'a
  pas (`isVerified`) ne casse qu'à l'exécution — au bout de trois minutes de scénario, sur la
  dernière assertion. Lancer le script seul sur un compte du seed avant de le brancher.
- **Les comptes `neuf-<horodatage>@recette.yamba.dev` restent en base** (un par exécution des
  fiches 6, 10, 11 — la fiche 10 n'en crée pas, la 11 laisse une inscription en attente
  annulée). Sans conséquence (piège 22 du handoff) ; le cahier réserve « le compte neuf » au
  chapitre 5.13 : ce sera celui de la dernière exécution, ou un compte créé pour l'occasion.

---

## Chapitre 5.3 — Connexion, « Rester connecté », session, appareils · **CONFORME** (13 fiches + 3 vérifications ANO-WEB-01 · 1 anomalie majeure ouverte)

Le chapitre le plus « session » du cahier : deux profils (standard 60 min / mémorisé 7 jours), la
fenêtre « Ta session a expiré » qui se pose sur place, la liste des appareils, la porte sudo et sa
fenêtre de 15 minutes. Les navigateurs **A** et **B** sont deux contextes connectés au MÊME compte
(Aminata), seule façon de prouver qu'une session tuée depuis A meurt dans B. Le fichier ouvre par
les trois vérifications d'`ANO-WEB-01` (la fenêtre de session qui bloquait l'écran de connexion,
close le 09/09), puis les treize fiches.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-CNX-1 | L'écran de connexion | **Conforme** — « Connexion sécurisée », « Connecte-toi », le sous-titre, les deux champs et leurs indices, « Afficher le mot de passe » (qui bascule le champ en `text` puis `password`), « Oublié ? » vers `/password/forgot`, la case « Rester connecté » **décochée** avec son aide « 7 jours / 60 minutes », « Se connecter », Google, Facebook, « Pas encore membre ? Inscris-toi » |
| WEB-CNX-2 | Identifiants incorrects, même message | **Conforme** — mauvais mot de passe et adresse inconnue : le même 401 et « E-mail ou mot de passe incorrect. » La preuve va au corps de la réponse, identique au caractère près (temps constant, ANO-API-08/18) ; aucun cookie |
| WEB-CNX-3 | Connexion réussie, session standard | **Conforme** — en-tête membre (menu, cloche, Messages), prénom « Aminata » dans le menu, cookies `access_token` + `refresh_token`. Le cookie de rafraîchissement est un cookie de **session** (sans date) : le profil « 60 min » vit côté serveur. **Écart** : l'atterrissage est l'accueil connecté (`/fr`), pas le tableau de bord — le cahier dit « l'espace membre » |
| WEB-CNX-4 | Trop de tentatives | **NON CONFORME** → `ANO-WEB-19` (majeure, ouverte) ; douze mauvais mots de passe : douze 401, jamais un 429. Aucun verrou par compte sur la connexion. Fiche `test.fail` dans le harnais |
| WEB-CNX-5 | Session expirée : la fenêtre s'ouvre sur place | **Conforme** — cookies supprimés sans rechargement, une action serveur ouvre « Ta session a expiré » PAR-DESSUS le tableau de bord (adresse inchangée, pas d'écran d'erreur, pas de renvoi vers `/login`), le formulaire est DANS la fenêtre, et après reconnexion la fenêtre se ferme et la page reprend |
| WEB-CNX-6 | « Rester connecté » ouvre l'autre profil | **Conforme** — la case cochée rend le `refresh_token` **persistant** (≈ 30 jours de vie absolue, D27/SES-02 ; l'inactivité de 7 jours vit côté serveur), là où la session standard a un cookie de session. La rubrique Sécurité de A porte « connexion mémorisée » ; celle de B (sans la case) ne la porte pas ; vu de B, la session de A la porte |
| WEB-CNX-7 | La liste des appareils connectés | **Conforme** — au moins une ligne : « Chrome · macOS » (dérivé de l'agent utilisateur ; le cahier écrit « Chrome sur macOS »), « Dernière activité » + date, l'adresse IP, « cet appareil » sur la session courante. **Écart** : la rubrique s'appelle « Sessions actives », le cahier dit « Appareils connectés » |
| WEB-CNX-8 | Déconnecter un autre appareil | **Conforme après correction** → `ANO-WEB-20` ; A voit deux appareils, révoque celui qui n'est pas le sien (« Appareil déconnecté. »), la ligne disparaît, et B perd sa session : sa prochaine action serveur ouvre « Ta session a expiré » |
| WEB-CNX-9 | « Déconnecter les autres appareils » | **Conforme** — B reconnecté, A clique « Déconnecter les autres appareils » : « n appareil(s) déconnecté(s) », seule « cet appareil » reste, B perd sa session |
| WEB-CNX-10 | La porte de confirmation d'un geste sensible | **Conforme** — changer le mot de passe répond 403 `SUDO_REQUIRED`, la porte « Confirme que c'est bien toi » s'ouvre, « M'envoyer le code » envoie « Ton code de confirmation Yamba », le code accepté **rejoue** le geste. **Écarts** : la porte se présente au moment du geste (le cahier l'attendait AVANT le formulaire) ; et le code REJOUE le geste au lieu d'« ouvrir le formulaire » — deux formulations, le fond (aucun geste sans code) tient |
| WEB-CNX-11 | La fenêtre de 15 minutes couvre un second geste | **Conforme** — une fenêtre sudo (≈ 15 min, mesurée) couvre l'export puis le rétablissement du mot de passe SANS nouveau code. **Écart** : un changement de mot de passe FERME la fenêtre (`closeSudoWindow`) — donc l'ordre littéral du cahier (mot de passe puis export dans la même fenêtre) redemanderait un code ; la propriété « un code, plusieurs gestes » est prouvée avec des gestes qui ne la ferment pas |
| WEB-CNX-12 | La fenêtre sudo est liée à l'appareil | **Conforme** — A ouvre sa fenêtre ; B (même compte, autre appareil) tente un geste sensible et se voit redemander un code (403 `SUDO_REQUIRED`, porte affichée). La fenêtre vaut pour un appareil, jamais pour le compte |
| WEB-CNX-13 | Un compte suspendu ne se connecte plus | **Conforme** — la médiation suspend Marie-Claire (back-office, `users.suspension.apply`) ; sa session vivante ailleurs est **révoquée** ; l'écran refuse « Ton compte est suspendu. Consulte l'email reçu… » (401 `ACCOUNT_SUSPENDED`, aucune session), l'email « Ton compte Yamba est suspendu » arrive ; la levée rouvre la connexion. (Marie-Claire est Expéditrice : aucun trajet à retirer de la recherche) |

### À trancher (produit)

- **La connexion par mot de passe n'a aucun verrou anti-force-brute** (`ANO-WEB-19`). C'est le
  point dur du chapitre, déjà relevé en recette API. Décision et PR dédiées attendues : réutiliser
  la mécanique OTP (compteur par compte, paliers, email d'alerte), refus indistinguable.
- **L'atterrissage après connexion** est l'accueil connecté (`/fr`), pas le tableau de bord.
  Cohérent avec le reste du produit (le menu mène partout) ; le cahier disait « l'espace membre ».
- **« Sessions actives » vs « Appareils connectés »** — même chose, libellé différent. Le libellé
  actuel est correct (une session = un appareil ici) ; à harmoniser avec le cahier si l'on veut.
- **La porte sudo se présente au moment du geste**, après le formulaire, et le code REJOUE le
  geste plutôt que d'« ouvrir » un formulaire. Le résultat (aucun geste sans code, fenêtre de
  15 min) est conforme ; ce sont des écarts de formulation du cahier.

### Pièges de poste payés ici

- **Le changement de mot de passe FERME la fenêtre sudo** (`closeSudoWindow`, D65) — l'export ne
  la ferme pas. Bonne sécurité, mais elle défait l'ordre littéral de WEB-CNX-11 (le harnais
  ouvre une fenêtre dédiée et y enchaîne les gestes qui ne la ferment pas).
- **Six demandes de code sudo par heure, une par minute** (OTP anti-spam). Un harnais qui
  redemande un code en rafale grille le quota (1 h de verrou). Règle : demander UNE fois, attendre
  le cooldown d'une minute, redemander UNE fois — et une fenêtre couvre plusieurs gestes, donc on
  n'en ouvre qu'une. Nouveau `packages/libs/prisma/scripts/clear-sudo-locks.ts` pour repartir
  propre entre deux exécutions.
- **Deux profils de cookie de rafraîchissement.** Session standard : cookie de session (`expires`
  = −1), le « 60 min » vit côté serveur. Mémorisé : cookie persistant, `expires` ≈ +30 jours (la
  vie ABSOLUE, pas l'inactivité de 7 jours). La distinction se lit sur le cookie ; la mention
  « connexion mémorisée » se lit sur la session.

---

## Chapitre 5.4 — Mot de passe et adresse email · **CONFORME** (6 fiches, aucune anomalie)

Tout se joue sur des comptes **neufs**, créés et activés par le harnais (`compteNeuf()` +
activation par code) — jamais le seed : le chapitre change des mots de passe ET une adresse email
de façon définitive. Six fiches jouées en quatre scénarios ; aucune anomalie.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-MDP-1 | Mot de passe oublié ne révèle rien | **Conforme** — une adresse inexistante fait avancer l'écran vers `/password/verify` (le serveur répond OK sans dire si le compte existe), et **aucun email** ne part |
| WEB-MDP-2 | Réinitialisation complète | **Conforme** — code « Ton code de réinitialisation Yamba » (validité 10 min annoncée), les règles de force s'appliquent (`abc` → « au moins 8 caractères »), le nouveau mot de passe passe et l'ancien échoue (401) |
| WEB-MDP-3 | « Retour à la connexion » | **Conforme** — depuis l'écran « Mot de passe oublié ? », le lien ramène à `/fr/login` |
| WEB-MDP-4 | Changer son mot de passe | **Conforme** — sous la fenêtre sudo : le nouveau doit différer de l'actuel (400 `PASSWORD_SAME_AS_CURRENT`), puis un mot de passe valide passe, l'email « Ton mot de passe Yamba a été modifié » arrive, les AUTRES sessions sont fermées (le second navigateur meurt) et la courante reste ouverte |
| WEB-MDP-5 | Changer son adresse : première étape | **Conforme** — une adresse déjà prise est refusée (`EMAIL_ALREADY_USED`) avant tout envoi ; une adresse libre reçoit « Confirme ta nouvelle adresse email Yamba » **sur la nouvelle adresse**, et l'adresse du compte ne change pas encore |
| WEB-MDP-6 | Changer son adresse : confirmation | **Conforme** — le code confirme, l'adresse du compte devient la nouvelle, l'**ancienne** reçoit « L'adresse email de ton compte Yamba a changé » **sans aucun code**, les autres sessions sont fermées, et la connexion se fait désormais avec la nouvelle adresse |

### À trancher (produit)

- Aucun écart de produit relevé sur ce chapitre : le comportement suit le cahier.

### Pièges de poste payés ici

- **Le mot de passe d'essai ne doit contenir aucune donnée personnelle du compte.** Un premier
  jet (`Yamba-Recette-…`) contenait le prénom « Recette » du compte neuf → refus
  `PASSWORD_CONTAINS_PERSONAL_INFO`. La règle de force regarde prénom, nom et adresse : un mot de
  passe de test se choisit à l'écart de ces valeurs.
- **Méthode.** Les gestes derrière la porte sudo (changement de mot de passe et d'adresse) sont
  déclenchés par l'API une fois la fenêtre ouverte, la porte elle-même ayant été éprouvée à
  l'écran au chapitre 5.3 ; l'écran Sécurité est bien ouvert et la fenêtre sudo obtenue par les
  endpoints autonomes (un code par minute). Les preuves qui comptent — refus, emails, sessions
  fermées, adresse du compte — sont toutes vérifiées.

---

## Chapitre 5.5 — Profil, avatar et page publique · **CONFORME** (10 fiches : 8 jouées, 2 ⏭ · 1 anomalie mineure close)

Les fiches qui modifient un compte du seed (prénom, date de naissance, nom affiché, bascules)
prennent un instantané du profil au départ (`GET /auth/me/profile`) et le restaurent en `finally` —
le seed n'est pas rejoué entre les chapitres.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-PRO-1 | Profil d'un Expéditeur pur | **Conforme** — avatar (initiale, aucune image cassée), prénom/nom/date de naissance, deux bascules (Profil public, Afficher ma ville) ; **aucun** « nom affiché » ni « présentation » (réservés aux Voyageurs) |
| WEB-PRO-2 | Profil d'un Voyageur | **Conforme** — en plus : « nom affiché », « présentation » avec compteur `…/300`, et « Voir mon profil public » |
| WEB-PRO-3 | Bornes du prénom | **Conforme** — 1 et 41 caractères refusés (rien n'est écrit), un message sous le champ à l'écran ; un prénom valide passe et se lit dans le menu utilisateur |
| WEB-PRO-4 | Date de naissance : 16 ans, jamais affichée | **Conforme** — 12 ans → `TOO_YOUNG`, date future → `IN_THE_FUTURE`, 30 ans accepté ; la page publique n'affiche ni le mot « naissance » ni l'année de naissance |
| WEB-PRO-5 | Avatar : poids | **Conforme (garde-fou)** — un fichier de 2,05 Mo est refusé côté navigateur (« Photo trop lourde (2 Mo au plus). ») **sans aucune requête** de téléversement. Le téléversement réel (500 Ko) est `⏭` (écriture ImageKit) |
| WEB-PRO-6 | Changer / retirer l'avatar | **⏭** — écrit puis supprime un fichier sur ImageKit (service externe) : joué à la main. La suppression de l'ancien fichier (« introuvable ») est le piège des clés ImageKit du `.env` racine |
| WEB-PRO-7 | Page publique d'un Voyageur | **Conforme** — « Thomas N. », « Membre depuis », « En tant que Voyageur » avec un niveau nommé, **aucune** note « 0.0 · 0 deals » inventée (WEB-NRG-2), « Suivre », « Signaler ce profil ». (Le bloc « Réseau » ne s'affiche qu'avec ≥ 1 abonné — Thomas n'en a aucun dans le seed) |
| WEB-PRO-8 | Adresse publique stable | **Conforme** — après un changement de nom affiché, `/u/seed-thomas` répond toujours. **Écart** : la page publique montre l'identité « Prénom N. », JAMAIS le « nom affiché » (`CarrierPage.name`) — le cahier l'attendait « à jour » sur la page publique |
| WEB-PRO-9 | Masquer sa page publique | **Conforme après correction** → `ANO-WEB-21` ; masquée : le visiteur reçoit « Profil introuvable » (+ « Retour à l'accueil »), le propriétaire voit sa page avec la bannière « Cette page est masquée… », et un trajet publié par Thomas reste visible et porte son prénom |
| WEB-PRO-10 | Afficher / masquer sa ville | **⏭** — le seed ne pose aucune ville sur l'adresse Voyageur de Thomas : la bascule n'a pas de donnée à faire apparaître (observation ci-dessous). Le test lit la ville via `/auth/me` et se saute proprement si elle manque |

### À trancher (produit)

- **La page publique affiche « Prénom N. », pas le « nom affiché ».** Le « nom affiché »
  (`CarrierPage.name`) se règle au profil et sert ailleurs (deals) ; la page publique, elle,
  identifie par prénom + initiale. Le cahier attendait le nom affiché « à jour » sur la page
  publique. À trancher : soit la page publique adopte le nom affiché, soit le cahier acte que
  l'identité publique est prénom + initiale (recommandé : c'est cohérent avec la vie privée).

### Observations

- **Le seed ne pose pas de ville sur l'adresse des Voyageurs** (seules les villes de trajet
  existent). « Afficher ma ville » n'a donc rien à montrer pour Thomas — WEB-PRO-10 se saute. À
  compléter dans `seed-deals.ts` (une adresse principale par Voyageur) pour rendre la fiche jouable.

### Pièges de poste payés ici

- **La page publique n'existe que masquée pour son propriétaire** : l'API renvoie `hidden` au seul
  propriétaire (les autres reçoivent 404). C'est ce drapeau, jusque-là non rendu, qui a mené à
  ANO-WEB-21.
- **Le réseau et les actions vivent dans l'`<aside>`, pas dans `<main>`** : une assertion scopée à
  `main` sur « abonnés » / « Signaler » échoue à tort.

---

## Chapitre 5.6 — Devenir Voyageur : onboarding et Stripe · **CONFORME** (7 fiches : 4 jouées, 3 ⏭ · aucune anomalie)

Tout se joue sur un compte NEUF (l'onboarding transforme un compte en Voyageur, et la partie Stripe
crée un compte Express de TEST) — jamais le seed, dont les Voyageurs portent un `acct_fake_*`
factice. Clé Stripe du poste : `sk_test_`, Connect Express **réel** en mode test.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-VOY-1 | L'entrée « Devenir Voyageur » | **Conforme** — le menu mène à la section « Devenir Voyageur » du tableau de bord, dont l'appel à l'action ouvre le wizard `/carrier/onboarding` : deux étapes « Votre profil » (active) et « Paiement » |
| WEB-VOY-2 | L'étape « Profil » | **Conforme** — champs nom d'affichage et présentation ; un téléphone mal formé (« 12 ») est refusé sous le champ (« Numéro de téléphone invalide »). Le passage effectif se fait par l'API (l'adresse principale passe par l'autocomplétion Google et le téléphone par un composant à sélecteur de pays, hors périmètre ; le contrat serveur `POST /carrier/onboarding/profile` est vérifié) ; le badge du menu devient « Profil à compléter » |
| WEB-VOY-3 | Publier reste possible sans onboarding complet | **Conforme** — profil fait, Stripe non : `POST /trips` (publish) répond 201 et le trajet est **PUBLISHED**. Le verrou est au moment d'accepter, pas de publier (la doc `DOC-METIER-TRIP-LIFECYCLE.md` RG-01 disait le contraire ; le code fait foi, divergence déjà tranchée) |
| WEB-VOY-4 | « Configurer Stripe » | **Conforme** — l'étape Paiement porte « Connecter avec Stripe » et **aucun champ IBAN** dans un formulaire Yamba ; le clic crée un **vrai lien Connect** et redirige vers `connect.stripe.com` (le RIB et l'identité se saisissent chez Stripe) |
| WEB-VOY-5 | Retour de Stripe : profil actif | **⏭** — compléter un compte Connect **Express** exige le flux HÉBERGÉ de Stripe : la plateforme ne peut pas soumettre les conditions/justificatifs par l'API (« You cannot accept the Terms of Service on behalf of Express accounts » — vérifié). Le flux hébergé est externe, lent (~7 min) et instable : hors périmètre du harnais. Manuel en mode test (voir ci-dessous) |
| WEB-VOY-6 | Accepter sans onboarding complet est refusé | **⏭** — nécessite une demande de réservation en attente sur le trajet d'un Voyageur non finalisé (parcours de réservation, chapitre 5.12). Le verrou **D31** est vérifié côté serveur : `deal-lifecycle.service.ts` refuse l'accept avec `CARRIER_ONBOARDING_REQUIRED`, couvert par `deal-lifecycle.service.spec.ts` |
| WEB-VOY-7 | « Voir mes virements sur Stripe » | **⏭** — la branche « tableau de bord » exige un compte Stripe COMPLET (`createLoginLink`) ; la branche « compte non finalisé » n'est pas reproductible sur un profil seul (le Portefeuille y affiche « Devenir Voyageur », pas le bouton « Voir mes virements »). Manuel |

### À trancher (produit)

- Aucun écart de produit : le comportement suit le cahier (et confirme que publier n'exige pas
  Stripe — la divergence documentaire RG-01 est tranchée en faveur du code).

### Automatisation Stripe — ce qui est couvert, ce qui ne l'est pas

- **Couvert automatiquement (côté Yamba)** : la création d'un **vrai** compte Stripe Express de
  test et de son lien Connect, la redirection vers `connect.stripe.com`, et l'absence de tout
  formulaire IBAN chez Yamba (WEB-VOY-4).
- **Non automatisé (côté Stripe)** : la complétion de l'onboarding Express. Stripe l'impose par
  son flux hébergé (la plateforme ne peut ni accepter les CGU ni soumettre les justificatifs par
  l'API pour un compte Express — erreur vérifiée). Le flux hébergé change souvent et prend
  plusieurs minutes : l'inclure rendrait la recette lente et instable. **Procédure manuelle
  (mode test)** : depuis l'étape Paiement, « Connecter avec Stripe », compléter avec un numéro de
  test et les données de test proposées par Stripe, revenir sur
  `/carrier/onboarding/stripe/callback` → « Voyageur actif » + email « Ton profil Voyageur est
  actif » ; puis Finances › Portefeuille › « Voir mes virements sur Stripe » → porte sudo →
  tableau de bord Stripe Express (nouvel onglet).

### Pièges de poste payés ici

- **Le seed pose des `acct_fake_*`** : toute fiche qui appelle une vraie API Stripe sur un
  Voyageur du seed échoue. La partie Stripe se joue sur un compte neuf qui crée un vrai compte
  Express de test.
- **L'entrée « Devenir Voyageur » du menu** mène à `/dashboard/yamber` (récapitulatif), pas
  directement au wizard : c'est l'appel à l'action de cette section qui ouvre `/carrier/onboarding`.
- **Le champ téléphone du wizard** n'a pas de libellé associé accessible : le viser par
  `input[type="tel"]`.


## Chapitre 5.7 — Publier un trajet et son cycle de vie · **CONFORME** (21 fiches : 20 jouées, 1 ⏭ · 1 anomalie mineure close, 1 mineure ouverte · 14 scénarios, 1 min 36)

Le cœur du chapitre — la machine à états (`getAllowedActions`, gardes d'édition / annulation /
publication, D72) — est déjà prouvé par un test unitaire de 500 lignes
(`trip-state-machine.spec.ts`). La recette l'**exerce** contre le système : de vrais trajets créés
par l'API, les gestes tentés, `allowedActions` et les statuts lus, la visibilité vérifiée par la
recherche publique. Les valeurs du wizard (prix, gain, familles, forfaits, lieux) sont éprouvées à
l'écran en ouvrant l'assistant **en édition** (`/trips/create?edit=<id>`) sur un brouillon créé par
l'API : l'étape 1 (Google Places) est contournée, l'étape 2 et la « Vérification » sont réelles.
Compte : Joséphine (trajet libre) ; Thomas pour `bzv-upcoming` (réservé) et `bzv-perkg` ; Marc et
le médiateur pour le masquage administratif.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-TRJ-1 | Ouvrir « Créer un trajet » | **Conforme** — « Votre trajet », trois étapes « Trajet », « Conditions », « Vérification », bouton « Brouillon » d'emblée, modes « Avion », « Train », « Voiture », accordéon « Référence & justificatif » dès l'étape 1 |
| WEB-TRJ-2 | Étape 1 : mode, itinéraire et dates | **⏭** — l'itinéraire passe par l'autocomplétion Google Places (hors périmètre, comme 5.2 et 5.6). Les modes sont vus en TRJ-1, les dates par l'édition (TRJ-3…9). Lecture du code sur « heures locales à chaque lieu » → `ANO-WEB-23` (ouverte) |
| WEB-TRJ-3 | Le prix au kilo et sa suggestion | **Conforme** — prix rendu tel qu'enregistré (11,50), jamais 0 ; curseur `min=5` `max=20` ; « Les trajets similaires partent à 12,60 €/kg en médiane (fourchette 11,34–14,49). », verdict « ✓ Prix juste », infobulle « Pourquoi ce prix ? ». **Écart** : « Ton prix = ton net » n'est pas affiché — la carte de gain dit « net, versé à J+4 après livraison » (la phrase existe dans `create-trip.copy.ts`, `netGainSub`, la refonte de l'étape 2 ne la rend plus) |
| WEB-TRJ-4 | La capacité et le gain net | **Conforme** — curseur `min=2` `max=30` ; « Si tes 23 kg partent — 264,50 € — net, versé à J+4 après livraison » (23 × 11,50) ; plancher « aucun envoi ne te rapporte moins de 8 € » ; « écart de poids ≤ 10 % » dans l'infobulle « Ta capacité ». La valeur pré-remplie à la création (12 kg) n'est pas vue en édition |
| WEB-TRJ-5 | Les huit familles de colis | **Conforme** — résumé replié « Alimentaire sec & scellé : refusé · Électronique & appareils : +20 % » ; dépliée, les huit familles du cahier, du « Documents & papiers » à « Accessoires & divers » |
| WEB-TRJ-6 | Les forfaits bagage et leur garde | **Conforme** — capacité 5 kg : lignes grisées « Monte ta capacité à 23 kg pour proposer ce forfait » et « … 12 kg … », « Aucun forfait proposé » ; 23 kg + 230 € : « ≈ 10,00 €/kg », « 1 forfait proposé », plus de ligne grisée ; un forfait à 0 € est refusé par le serveur (entier strictement positif). Le « mémorisé mais masqué » du curseur (étape 6) n'est pas joué |
| WEB-TRJ-7 | Les lieux de remise et de livraison | **Conforme** — les deux lieux du brouillon sont rendus dans leurs champs, carte « À l'aéroport » enfoncée, modes « Exact » (le cahier écrit « Lieu exact »), « Rayon 5 km », « Rayon 10 km » ; activer « Dans la ville » révèle « Rayon 20 km » et « Ville entière », « 2 lieux ». **Les cartes dépendent du mode** : en avion, aéroport + ville ; en train, « À la gare » (vérifié sur un brouillon TRAIN) — le cahier attend les trois à la fois |
| WEB-TRJ-8 | « Réservation instantanée » n'existe plus | **Conforme** — aucune bascule, aucun vestige du libellé ; « Chaque demande passe par ton accord — tu réponds sous 24 h. » dans « Options & message » |
| WEB-TRJ-9 | La vérification et l'aperçu public | **Conforme** — carte « Prix & capacité » (11,50 €/kg, 23 kg dispo, « Tu gagnes 264,50 € », familles refusée / surchargée), « Aperçu public — Tel que vu par les expéditeurs ». Les justificatifs se déposent à l'étape 1 et l'étape 3 ne les LISTE que s'il y en a (formulation du cahier) |
| WEB-TRJ-10 | Publier le trajet | **Conforme** — `POST /trips/:id/publish` → **PUBLISHED**, badge « En ligne » dans « Mes trajets », trouvable par `GET /trips/search?from=Bruxelles&to=Kinshasa`. La carte de recherche (« jamais 0,00 € ») relève du chapitre 5.9 |
| WEB-TRJ-11 | Le brouillon accepte l'incomplet, sauf l'incohérence bagage | **Conforme** — brouillon minimal (mode + villes) : `201`, **DRAFT** ; forfait soute avec 5 kg de capacité : refusé (`400`) brouillon compris — c'est le schéma Zod (`checkBagCapacity`) qui le tient, avant tout contrôleur |
| WEB-TRJ-12 | Les gardes de publication (a → f) | **Conforme** — a `PUBLISH_DEPARTURE_REQUIRED` · b date passée `TRIP_TRANSITION_NOT_ALLOWED` (garde de la machine) · c et d `PRICING_INCOMPLETE` · e `PUBLISH_PICKUP_REQUIRED` · f `PUBLISH_DELIVERY_REQUIRED` ; le trajet reste **DRAFT** à chaque refus |
| WEB-TRJ-13 | Masquer et remettre en ligne | **Conforme** — pause → **PAUSED**, absent de la recherche, badge « Masqué » ; resume → **PUBLISHED**, réapparaît, « En ligne » ; en anglais « Online » puis « Hidden » ; jamais « Actif » / « En pause » / « Active » / « Paused » |
| WEB-TRJ-14 | Le menu n'offre que le permis | **Conforme** — lu dans `allowedActions` (le front ne décide jamais) : brouillon → `edit`, `publish`, `duplicate`, sans `cancel` ni `archive` ; en ligne libre → `edit`, `pause`, `cancel` ; `bzv-upcoming` (réservé) → **`edit` absent** ; archivé → sans `restore`. « Terminé » n'a pas de trajet dans le seed |
| WEB-TRJ-15 | Un trajet réservé est intouchable | **Conforme** — `PUT /trips/:id` sur `bzv-upcoming` : `400` `TRIP_NOT_EDITABLE`, « Cannot edit a trip with active bookings. Cancel the trip instead. » |
| WEB-TRJ-16 | Annuler un trajet qui porte un deal est refusé | **Conforme** — **à l'écran** : « Mes trajets » → menu « … » → « Annuler » → « Annuler ce trajet ? » → `409`, toast « Ce trajet porte encore N deals en cours … remboursé … » ; **par l'API** : `409` `TRIP_HAS_ACTIVE_DEALS`, `activeDeals > 0` ; le trajet reste **PUBLISHED** (D72) |
| WEB-TRJ-17 | Annuler un trajet libre | **Conforme** — `POST /trips/:id/cancel` → **CANCELLED**, absent de la recherche |
| WEB-TRJ-18 | Restaurer puis archiver | **Conforme** — `restore` (départ futur) → **DRAFT** ; republié, annulé, `archive` → **ARCHIVED** ; `restore` sur un archivé refusé, `allowedActions` sans `restore` |
| WEB-TRJ-19 | Dupliquer | **Conforme** — `duplicate` est permis dans tous les états ; la duplication est un `createTrip` depuis les conditions : le jumeau est un nouveau brouillon (`201`), l'original inchangé |
| WEB-TRJ-20 | Le Voyageur sur sa propre page publique | **Conforme** — « C'est votre trajet », aucun bouton « Réserver », « Modifier » / « Gérer » présents |
| WEB-TRJ-21 | « Masqué par Yamba » vu du Voyageur | **Conforme** — le médiateur masque `yul` (`POST /admin/trips/:id/hide`, motif) : Marc voit le bandeau « masqué par Yamba » sur le détail ; le visiteur reçoit « introuvable » sur la page publique ; absent de Paris → Montréal ; masquage levé par la fiche (`DELETE …/hide`). L'email Mailpit n'est pas vérifié |

### À trancher (produit)

- **« Ton prix = ton net »** (TRJ-3) : le cahier attend la phrase (« la commission est payée par
  l'Expéditeur ») ; l'écran ne dit plus que « net, versé à J+4 après livraison ». Rétablir la
  phrase complète sous la carte de gain (`netGainSub` existe déjà) ou amender le cahier.
- **« Lieu exact »** (TRJ-7) : le mode s'appelle « Exact » à l'écran. Formulation.
- **Les cartes de lieu par mode de transport** (TRJ-7) : le cahier attend « À l'aéroport »,
  « À la gare » et « Dans la ville » ensemble ; le produit ne propose que les cartes du mode
  (aéroport en avion, gare en train, ville toujours). Cohérent ; amender le cahier.
- **Les justificatifs** (TRJ-9) : déposés à l'étape 1 (« Référence & justificatif »), seulement
  listés à l'étape 3. Amender le cahier.
- **Les heures locales à chaque lieu** (TRJ-2, `ANO-WEB-23`) : fuseau du navigateur aujourd'hui ;
  fuseau du lieu dérivé côté serveur proposé. Décision produit, PR dédiée.

### Observations

- **Un trajet créé hors wizard perdait ses dates à l'édition** (`ANO-WEB-22`, close) : le
  correctif touche le front (`create-trip.reverse-mapper.ts`), pas l'API. Les trajets du seed
  sont dans ce cas — « Modifier » sur l'un d'eux s'ouvrait avec quatre champs vides.
- **Le résumé « Familles de colis » replié** dit exactement ce qui a été changé (« Alimentaire sec
  & scellé : refusé · Électronique & appareils : +20 % ») — l'étape 2 reste lisible sans déplier.
- **Les deals d'un trajet sont dépliés par défaut** dans « Mes trajets » (« 8 colis », « 5 colis »
  `[expanded]`) : le menu « … » d'une ligne réservée est en bas d'une longue liste.

### Pièges de poste payés ici

- **`innerText` rend le texte transformé par le CSS** : « Aperçu public » est en capitales
  (`uppercase`) → « APERÇU PUBLIC ». Toute comparaison sur `innerText` est insensible à la casse ;
  `getByText` cherche le DOM et n'a pas ce problème.
- **L'infobulle de l'étape 2 se referme sur tout défilement** (`scroll` capturé) — et le clic de
  Playwright fait défiler l'élément juste avant de cliquer. `scrollIntoViewIfNeeded()` d'abord,
  puis clic avec reprise (`expect.poll` sur `aria-expanded`), et lecture par `aria-controls`.
- **Le menu « … » d'une ligne peut se refermer** si la liste se re-rend juste après le clic
  (rafraîchissement TanStack Query après les mutations des fiches précédentes) : la page-objet
  réessaie jusqu'à voir l'entrée « Annuler ».
- **Thomas a trois trajets Paris → Brazzaville** : la ligne se vise par l'`href` du lien
  (`/dashboard/trips/<id>`), jamais par le corridor seul.
- **`getByDisplayValue` n'existe pas en Playwright** (c'est Testing Library) : `getByRole("textbox",
  { name })` + `toHaveValue`.
- **Le wizard en édition n'a pas besoin de Google** : « Bruxelles » et « Kinshasa » sont rendus
  depuis le trajet, l'étape 1 est valide, « Continuer » ouvre l'étape 2 — c'est ce qui rend les
  fiches 3 à 9 automatisables.

---


## Chapitre 5.8 — Justificatifs et billet vérifié · **CONFORME** (6 fiches jouées · 2 anomalies mineures closes, 1 mineure ouverte · 6 scénarios, 1 min 00)

Le front téléverse chaque justificatif **directement chez ImageKit** puis n'envoie au trip-service
que les URL rendues (`POST /trips/:id/documents`). Comme pour les photos de colis, le harnais
intercepte l'appel tiers (`intercepterImageKit`) : jeton signé demandé à trip-service, contrôle du
type et de la taille côté client, enregistrement, statut du billet — toute la chaîne Yamba est
traversée, sans rien écrire dans la médiathèque. Les gestes d'administration (valider, rejeter)
passent par l'API du back-office avec le compte **SUPPORT** (permission `tickets.review`). Le jeu
d'essai est rejoué en tête de fichier : le chapitre consomme le billet en attente de `bzv-upcoming`.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-DOC-1 | Déposer un justificatif | **Conforme** — trajet neuf : « Non soumis » ; deux PDF déposés depuis le détail du trajet (section « Documents ») : `201`, listés avec leur nom, « En vérification » ; `ticketVerificationStatus` `NOT_SUBMITTED → PENDING`. **Constat** : aucun sélecteur de type, les deux documents sont `TICKET_PROOF` → `ANO-WEB-24` (ouverte) |
| WEB-DOC-2 | Les bornes de dépôt | **Conforme après correction** → `ANO-WEB-26` (le refus > 5 Mo était muet) et `ANO-WEB-25` (la limite de 5 se dit) ; un PDF de 5 Mo + 1 : « Le fichier dépasse 5 Mo. » et **aucune requête** ; à cinq documents : « 5 documents maximum par trajet… », plus de zone de dépôt ; le serveur refuse le sixième (`400 DOCUMENT_LIMIT_REACHED`) et le trop lourd (`400 DOCUMENT_TOO_LARGE`) |
| WEB-DOC-3 | Les statuts du billet | **Conforme** — `bzv-upcoming` (Thomas) : « En vérification » à l'écran, `PENDING` à l'API, un document `TICKET_PROOF` en attente. Les quatre statuts sont vus : « Non soumis » (DOC-1), « En vérification », « Vérifié » (DOC-4), « Rejeté » (DOC-5) |
| WEB-DOC-4 | Billet validé par l'équipe | **Conforme** — SUPPORT : `POST /admin/tickets/:documentId/review` `{ decision: "VERIFY" }` → `{ status: VERIFIED, tripTicketStatus: VERIFIED }` ; Thomas recharge : « Vérifié » ; la page publique (visiteur) porte **« Billet vérifié »** et le DTO public `ticketVerified: true` ; email **« Billet vérifié pour ton trajet Paris → Brazzaville »** en français ; un second examen répond `400 TICKET_ALREADY_REVIEWED` |
| WEB-DOC-5 | Billet rejeté avec motif | **Conforme** — un rejet sans motif est refusé (`400`) ; `REJECT` + `DATES_MISMATCH` → « Rejeté », le trajet reste **PUBLISHED** ; email **« Billet non validé pour ton trajet Bruxelles → Kinshasa »** : « les dates ne correspondent pas au trajet », « Déposer un autre billet », jamais le code interne ; un nouveau dépôt à l'écran repasse « En vérification » (`PENDING`) |
| WEB-DOC-6 | Le billet ne bloque rien | **Conforme** — trajet sans billet : `publish` → **PUBLISHED**, DTO public `ticketVerified: false` ; Aminata voit « Réserver » (et pas le badge), le clic ouvre `/trips/:id/book` |

### À trancher (produit)

- **Le type de document** (`ANO-WEB-24`) : cinq types côté API, aucun à l'écran. Ajouter le
  sélecteur (petit lot front) ou assumer « tout justificatif est un billet » et amender le cahier.

### Piège de poste — un `.env` de projet qui envoyait de vrais emails

**`apps/trip-service/.env`** (13/05, gitignoré, un reliquat) portait un **SMTP Gmail réel**
(`SMTP_HOST=smtp.gmail.com`, un compte personnel) et des clés ImageKit. Nx fusionne l'env racine
et celui du projet : trip-service — et lui seul — envoyait ses emails (billet vérifié / rejeté,
« masqué par Yamba », alertes de route) **par Gmail**, à des adresses `@seed.yamba.dev` qui
n'existent pas, pendant que les autres services parlaient à Mailpit. Et l'échec ou le succès
était invisible : `emailCarrier` avalait tout (`.catch(() => undefined)`), rien dans les journaux.
Diagnostic par élimination — la bibliothèque d'email fonctionne en processus isolé (sonde `tsx`),
le fournisseur est « configuré », l'utilisateur est trouvé, aucune erreur… puis `ps eww` sur le
processus : `SMTP_HOST=smtp.gmail…`. C'est le piège déjà payé une fois avec ImageKit (CLAUDE.md :
« un `.env` de projet est un reliquat à supprimer »), payé une seconde fois avec l'email.

- **Remède** : le fichier est déplacé hors du dépôt (`~/.yamba-leftovers/trip-service.env.2026-09-11`,
  il contient un mot de passe d'application Gmail — à révoquer si le compte n'en a plus l'usage) ;
  le `catch` de `emailCarrier` journalise désormais l'échec. Après ce déplacement, `nx run-many`
  DOIT être relancé : le processus parent avait déjà lu l'env du projet et le réinjectait à chaque
  redémarrage de trip-service (un `kill` du service ne suffit pas).
- **Conséquence** : pendant 5.7 (WEB-TRJ-21, masquage / levée) et les premiers tours de 5.8,
  quelques emails sont partis par le compte Gmail vers `marc.carrier@`, `thomas.carrier@` et
  `josephine.carrier@seed.yamba.dev` — ils rebondissent dans cette boîte Gmail. Aucun email n'est
  parti vers une personne réelle.
- **Reste à faire, hors recette** : le contrôle de bon démarrage (§ 2.2 du cahier) devrait lire
  `SMTP_HOST` vu par CHAQUE service (le `/health` ou le `/api/status` pourraient l'exposer en
  développement), et `emailCarrier` pourrait remonter à Sentry (`captureServerError`).

### Observations

- **Les justificatifs déposés au wizard (étape 1) et au détail** passent par le même hook
  `useImageKitUpload` (5 Mo, PDF / JPG / PNG / HEIC) et la même limite de 5 ; les deux composants
  avaient les deux mêmes défauts (ANO-WEB-25/26), corrigés aux deux endroits.
- **Le rejet exige un motif fermé** (`ILLEGIBLE`, `DATES_MISMATCH`, `NAME_MISMATCH`,
  `SUSPICIOUS`) et l'email en donne le libellé humain dans la langue du Voyageur — le code
  interne ne sort jamais.
- **Un administrateur ne peut pas examiner son propre billet** (`ADMIN_IS_OWNER`) : non joué
  (aucun compte du seed n'est à la fois Voyageur et administrateur).

### Pièges de poste payés ici

- **Le `.env` de projet** (ci-dessus). Règle : `ls apps/*/.env` doit être vide ; tout va dans le
  `.env` racine.
- **Un `catch` vide sur un email métier** cache un environnement faux pendant des semaines. Un
  best-effort se journalise, il ne se tait pas.
- **`setInputFiles` avec un tampon de 5 Mo + 1** suffit pour la borne de taille ; le PDF minimal
  (en-tête, `xref`, `%%EOF`) passe le filtre `accept` et `application/pdf` du hook.
- **Le chapitre consomme le seed** (le billet en attente de `bzv-upcoming` est validé en DOC-4) :
  `test.beforeAll(() => new JeuEssai().rejouer())`, comme les parcours du chapitre 6.

---


## Chapitre 5.9 — Recherche, filtres, tri, état vide · **CONFORME** (15 fiches jouées, 3 après correction · 1 anomalie BLOQUANTE close, 1 BLOQUANTE ouverte · 16 scénarios, 2 min 06)

> **Contexte donné le 11/09** : la recherche et l'accueil sont des chantiers **non terminés**. Les
> écarts de cahier relevés ici alimentent ce chantier ; ils sont consignés « à trancher », pas
> corrigés dans la recette (sauf ce qui casse : ANO-WEB-27).

La barre de recherche s'appuie sur l'autocomplétion Google Places (hors périmètre du harnais).
Mais ce que `/search` interroge, c'est le **brouillon persistant** de la barre (`sessionStorage`,
`yamba:form:trip-search`, version 2) : le harnais le pose avant d'ouvrir la page, et l'écran
cherche exactement ce qu'il aurait cherché après une saisie. Chaque ordre, chaque prix, chaque
compte de facette est **confronté à l'API** (`/trips/search`, `/trips/search/facets`) plutôt qu'à
une valeur codée. Le poids du colis vit en `localStorage` (`yamba.search.weightKg`). Jeu d'essai
rejoué en tête de fichier (identifiants neufs : compteurs de vues à zéro).

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-RCH-1 | La liste complète et son titre | **Conforme après correction** → `ANO-WEB-27` (la page tombait) ; « Tous les trajets disponibles », sous-titre, onglets « Tout / Avion / Train / Voiture » (avec leurs comptes), autant de cartes que `totalCount` (9 : les cinq trajets à venir du seed + les trajets du poste ; les trois partis absents), pas de « Charger plus » sous dix, jamais « 0 vue ». **Constat** : ni « Résultats disponibles » ni « n/n résultats affichés » (les clés `search.title` / `resultsShown` existent, rien ne les rend) |
| WEB-RCH-2 | Les titres dynamiques | **Conforme** — « Trajets au départ de Paris », « Trajets à destination de Brazzaville », « Trajets le 23 septembre 2026 », « Trajets pour Paris → Brazzaville » |
| WEB-RCH-3 | La carte d'un trajet au kilo | **Conforme** — « prix au kilo », « 11,50 €/kg », « 23 kg dispo », « ex. 2 kg ≈ 26 € tout compris » (23,00 + service plancher 3,00), « Direct », cœur « Ajouter aux favoris », aucun compteur à zéro vue, ni « — », ni « 0,00 € », ni « 0,0 » ; plancher « Colis léger … : 8 € minimum. » dans le panneau |
| WEB-RCH-4 | « Votre colis » : 3 kg | **Conforme** — curseur à 3 : « Prix et tri calculés pour 3 kg · trajets sans assez de place exclus » ; l'API donne `totalForWeight` **38,64** (34,50 + 12 % = 4,14) et la carte l'arrondit : « ≈ 39 € tout compris pour 3 kg » (le cahier écrit 38,64 : la page publique, elle, affiche « ≈ 38,64 € ») ; « Plus assez de place » ssi `remainingKg < 3` (aucun sur le seed, capacités ≥ 15 kg) ; après rechargement : 3 kg toujours, `localStorage` = « 3 », tri « pour votre colis de 3 kg » |
| WEB-RCH-5 | Le prix comparable sans poids | **Conforme** — « Tout effacer » : 2 kg, « Indiquez le poids… », « pour un colis de 2 kg », `bzv-perkg` « ≈ 26 € », un trajet à 9,50 €/kg « ≈ 22 € », `localStorage` vidé |
| WEB-RCH-6 | Les trois tris | **Conforme** — chaque radio coché (`aria-checked`) donne à l'écran **l'ordre exact de l'API** pour `sort=lowestPrice` / `bestRated` / `earliest` ; départs croissants vérifiés ; tous les trajets ont un prix (rien à exclure sur le seed) ; « Mieux notés » sans note fictive |
| WEB-RCH-7 | « Que voulez-vous envoyer ? » | **Conforme** — chaque puce porte le compte des facettes ; « Alimentaire sec & scellé » coché → `bzv-perkg` (qui le refuse) disparaît ; décoché + « Électronique & appareils » → il revient avec « Électronique & appareils : +20 % » **avant le clic** ; + « Documents & papiers » → il reste (accepte les deux) ; `bzv-upcoming` (sans position) reste compatible avec tout. Aucune puce à 0 sur ce corridor (règle « désactivée » non exercée) |
| WEB-RCH-8 | Les filtres de confiance | **Conforme** — sur le seed les trois comptes sont à **0** (`superTripperCount`, `profileVerifiedCount`, `verifiedTicketCount`) : les trois lignes sont **masquées**, pas grisées. La branche « proposé » n'est pas exercée (aucun Super Voyageur ni profil vérifié dans le seed ; le billet validé en 5.8 a été effacé par le rejeu) |
| WEB-RCH-9 | L'état vide | **Conforme** — Brazzaville → Paris : « Trajets pour Brazzaville → Paris », zéro carte, bloc « Aucun trajet ne correspond ? » / « Crée une alerte et reçois un email dès qu'un voyageur publie ce trajet. » / « Créer une alerte pour ce trajet ». **Constat** : « Aucun trajet trouvé » et sa phrase sont **remplacés** par ce bloc dès qu'un corridor est saisi (à trancher) |
| WEB-RCH-10 | L'état vide dû aux filtres | **Conforme après correction** (ANO-WEB-27) — sans corridor, 30 kg au curseur : « Aucun trajet trouvé », « Aucun résultat ne correspond à vos filtres. Essayez d'en retirer pour voir plus de trajets. », « Tout effacer » ramène les cartes. **Constat** : avec un corridor saisi, le bloc alerte prend le pas et ce message ne se montre jamais |
| WEB-RCH-11 | L'état d'erreur | **Conforme après correction** (ANO-WEB-27) — la recherche coupée au navigateur (`route.abort`) : « Une erreur est survenue », « Impossible de charger les trajets. Vérifie ta connexion et réessaie. », aucune trace technique ; le service « revenu », « Réessayer » recharge les cartes |
| WEB-RCH-12 | La page publique d'un trajet | **Conforme** — « Trajet proposé par Thomas N. », « Avion », « Membre depuis juin 2026 », « Ce que vous pouvez envoyer avec Thomas », « Prix au kilo 11,50 €/kg », « Disponible 23 kg », huit familles (statuts en **infobulle** : « Refusé par le Voyageur » sur l'alimentaire, « Supplément de 20 % (risque) » sur l'électronique, six « Accepté »), « Bagage entier — forfait · Soute 23 kg · 230,00 € », « Estimation pour un colis de 2 kg ≈ 26,00 € tout compris (transport + service Yamba) », « Le prix définitif est fixé à la réservation. », plancher 8 €, lieux, politique d'annulation (trois lignes), objets interdits, **« Réserver »**, « Signaler cette annonce », **aucun** « Réservation bientôt disponible » ; avec 3 kg mémorisés : « Estimation pour votre colis de 3 kg (poids de votre recherche) ≈ 38,64 € ». **Constats** : « Vol direct » absent (le seed ne pose pas `flightType`), bloc CO₂ absent (le seed n'a pas de coordonnées), et un « Discuter avec Thomas · Bientôt disponible » |
| WEB-RCH-13 | Le compteur de vues | **Conforme** — six ouvertures par le même visiteur : au plus **une** vue de plus ; un membre connecté (autre empreinte) : exactement une de plus ; la carte affiche « n vues ». Jamais 0 |
| WEB-RCH-14 | Un trajet annulé répond « introuvable » | **Conforme** — trajet publié puis annulé par Joséphine : « Trajet introuvable », « Ce trajet n'existe pas ou n'est plus disponible. », « Retour à la recherche » ; rien ne dit « annulé » ni « masqué » ; `GET /trips/:id/public` → **404** (masquage administratif : WEB-TRJ-21) |
| WEB-RCH-15 | Le trajet d'un compte suspendu | **Conforme** — la médiation suspend Marc : `yul` sort de Paris → Montréal (écran et API) ; en base il reste **PUBLISHED**, non masqué (`GET /admin/trips/:id`) ; levée → il revient |

### À trancher (produit) — matière pour le chantier recherche / accueil

- **Le compteur de résultats** (RCH-1) : « Résultats disponibles » et « {n}/{n} résultats
  affichés » sont dans `search.json` et nulle part à l'écran. Les rendre (petit) ou retirer les
  clés et amender le cahier.
- **L'état vide avec un corridor** (RCH-9, RCH-10) : le bloc « Créer une alerte » remplace le
  titre « Aucun trajet trouvé » ET le message « Aucun résultat ne correspond à vos filtres… ».
  Afficher les deux (titre + cause + alerte), et distinguer « aucun trajet » de « aucun avec ces
  filtres » — petit.
- **Le prix pour un poids donné sur la carte** (RCH-4) : arrondi à l'euro (« ≈ 39 € ») là où le
  cahier attend 38,64 € et où la page publique dit 38,64 €. Une seule règle d'affichage — petit.
- **Les statuts des familles sur la page publique** (RCH-12) : seulement en `title` (infobulle)
  et par le style (barré, puce « +20 % ») — invisibles au toucher et aux lecteurs d'écran. Un
  badge texte « Refusé » / « +20 % » — petit.
- **« Discuter avec Thomas · Bientôt disponible »** (RCH-12) : vestige d'avant D61 (la
  conversation ne s'ouvre qu'à ACCEPTED). Le retirer, ou l'expliquer — petit.
- **« Lieu exact »** vs « Exact » (déjà relevé en 5.7).

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

*(Consigne du 11/09 : pour chaque test, ce qui pourrait être meilleur, pourquoi, et l'effort —
petit / moyen / chantier.)*

- **RCH-1** — Le DOM porte **deux listes complètes** (arbre mobile masqué par CSS + arbre
  desktop) : deux fois le rendu, deux fois les cartes pour les lecteurs d'écran, des sélecteurs
  ambigus (le harnais a dû viser « la copie visible »). Une seule liste responsive, ou un rendu
  conditionné à `useIsMobile` — **moyen**. Les onglets de mode portent leurs comptes : bien ;
  ajouter `aria-current` / `role="tab"` — petit.
- **RCH-2** — Les titres suivent la locale ; le `<title>` de l'onglet et la balise `<h1>`
  devraient dire la même chose (partage, SEO) et l'URL devrait porter les critères (`?from&to`) :
  aujourd'hui une recherche ne se partage pas, elle vit en `sessionStorage` — **moyen**, et
  c'est le vrai sujet du chantier recherche.
- **RCH-3** — « ex. 2 kg ≈ 26 € » est calculé **côté front** (`pricing-example.ts`, paramètres
  « §13 du mockup ») alors que l'API sait déjà `comparablePriceCents` (D33) et que les paramètres
  sont des réglages (D62) : un jour les deux divergeront. Servir le prix d'exemple depuis l'API —
  **petit**.
- **RCH-4/5** — Le curseur seul ne permet pas 2,5 kg ; un champ numérique jumeau (comme le
  wizard) — petit. Le poids en `localStorage` ne se partage pas (voir RCH-2). Les trajets
  « exclus » pour capacité totale insuffisante disparaissent sans un mot : un compteur « n
  trajets masqués pour ce poids » — petit.
- **RCH-6** — « Mieux notés » sans aucune note trie… stablement : préciser le critère de
  départage (date de départ) et afficher « (aucun avis) » sur le radio quand c'est le cas ;
  laisser le tri « Prix le plus bas » exclure les trajets sans prix est bien, le dire — petit.
- **RCH-7** — Les comptes des puces viennent des facettes calculées sur le corridor **sans** les
  autres filtres actifs (poids, familles déjà cochées) : une puce peut annoncer 3 et donner 0.
  Facettes conditionnées à l'état courant (« faceted search ») — **moyen**.
- **RCH-8** — Le seed n'a ni Super Voyageur, ni profil vérifié : la branche « proposé » de ces
  filtres n'est jamais exercée par la recette. Donner ces signaux à un Voyageur du seed — petit.
- **RCH-9** — Le bouton « Créer une alerte » pour un VISITEUR : vérifier qu'il mène à la
  connexion (non joué) ; proposer l'alerte aussi quand il y a des résultats mais aucun à la date
  voulue — petit.
- **RCH-10** — Le message « filtres » ne se montre jamais avec un corridor (voir « à trancher »)
  ; ajouter « n résultats masqués par vos filtres » à côté de « Tout effacer » — petit.
- **RCH-11** — L'erreur est propre. Distinguer « hors ligne » (`navigator.onLine`) de « service
  indisponible » et réessayer seul avec un délai croissant (TanStack `retry` avec backoff) —
  petit. L'erreur des **facettes** est silencieuse (compteurs à 0) : un état dégradé visible —
  petit.
- **RCH-12** — Le seed ne pose ni `flightType` ni coordonnées : « Vol direct » et le CO₂ ne sont
  jamais vus par la recette — compléter le seed (petit). Le CO₂ est calculé côté front à partir
  des coordonnées : le servir depuis l'API (qui sait déjà la distance pour le prix) — petit.
  Statuts des familles accessibles (voir « à trancher »).
- **RCH-13** — Le visiteur est une empreinte **IP + agent** : tout un bureau derrière une même
  IP compte pour une vue par jour ; un identifiant anonyme de première partie (cookie, sans
  donnée personnelle) serait plus juste et plus stable — **moyen**. Les vues sont lues carte par
  carte dans Redis (`markViewsAndCountSearch`) : un `MGET` groupé si ce n'est pas déjà le cas —
  petit.
- **RCH-14** — Bon : 404 indistinct pour annulé / masqué / inexistant. Garder les critères de
  recherche au retour (c'est le cas via le brouillon) et proposer « trajets similaires » sur la
  404 — petit.
- **RCH-15** — La sanction agit par lecture dans la recherche ; **vérifier** qu'elle agit aussi
  sur la page publique (`GET /trips/:id/public` d'un Voyageur suspendu — non joué) et sur les
  favoris / alertes qui pointent vers ce trajet — petit à vérifier, moyen si absent.
- **ANO-WEB-27** — Un garde-fou durable : un test unitaire du `next.config.js` (les hôtes
  d'avatars y sont) ou `unoptimized` pour les avatars (ImageKit sert déjà des transformations) —
  petit ; et une **page d'erreur locale** autour des cartes (error boundary par carte) pour qu'un
  composant qui jette ne tue pas la liste — moyen.
- **ANO-WEB-28** — Au-delà du correctif : un test d'intégration Prisma+Mongo qui crée DEUX
  documents pour chaque modèle portant une FK optionnelle `@unique` — le piège est connu, il
  mérite un garde automatique — petit ; et `repair-absent-scalars` / `listIndexes` en revue de
  schéma : tout `? @unique` est suspect — règle de relecture.
- **Harnais** — Poser le brouillon de recherche en `sessionStorage` évite Google et rend les
  fiches déterministes ; un `data-testid` sur les cartes et un seul arbre (voir RCH-1) rendraient
  les sélecteurs triviaux — petit côté front.

### Pièges de poste payés ici

- **Deux copies de chaque carte** (mobile masqué + desktop) : `first()` tombe sur la copie
  `hidden`. Toujours `.filter({ visible: true })` sur les cartes, le panneau de filtres, « Tout
  effacer ».
- **« Départ le plus tôt » est le tri par défaut** : cliquer dessus en premier ne déclenche
  aucune requête (`waitForResponse` expire) — jouer les deux autres tris d'abord.
- **La page d'incident masque tout** : trois fiches « échouaient » sur des symptômes différents
  (onglet introuvable, zéro carte après « Tout effacer », zéro carte après « Réessayer ») pour la
  même cause (ANO-WEB-27). Devant plusieurs échecs disparates sur une même page : lire
  `pageerror` / la console AVANT de corriger les sélecteurs.
- **Le brouillon persistant sérialise les dates avec un marqueur** (`{ __yamba_date__: iso }`,
  `usePersistedFormState`) : à reproduire tel quel pour le titre « Trajets le … ».
- **`innerText` et les espaces fines** : « ≈ 38,64 € » porte une espace insécable fine ;
  comparer avec `\s*`.
- **La 404 et la page publique n'ont pas de `<main>`** : lire `body`.

---


## Chapitre 5.10 — Alertes de route · **CONFORME** (9 fiches jouées, 1 après correction · 1 anomalie mineure close · 9 scénarios en série, 1 min 45)

Les villes du formulaire passent par l'autocomplétion Google (hors périmètre du harnais). L'écran
est éprouvé pour tout ce qui n'en dépend pas — état vide, panneau, périodes, bascules, refus,
cartes, prolonger, supprimer, compteur, bannière — et les alertes sont **créées par l'API**
(`POST /saved-routes`, le contrat même du formulaire). Les publications qui déclenchent les
emails viennent de Joséphine, par l'API du trip-service ; les emails sont lus dans Mailpit
(trip-service sur l'env racine depuis le piège de 5.8). Les fiches s'enchaînent en série : chacune
part de l'état laissé par la précédente, et la première remet Aminata à zéro alerte.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-ALR-1 | « Mes alertes route » vide | **Conforme** — « Mes alertes route », « Sois prévenu·e dès qu'un trajet correspondant à tes critères est publié. », « Aucune alerte pour l'instant », « Crée ta première alerte et reçois un email dès qu'un trajet correspond à tes critères. », « Créer ma première alerte » |
| WEB-ALR-2 | Créer une alerte | **Conforme** — panneau « Nouvelle alerte » / « Reçois un email dès qu'un trajet correspond » ; périodes « 3 mois ★ », « 6 mois », « Sans limite », « Personnalisé » (→ « À partir du », « Jusqu'au ») ; bascules « Recevoir un email » et « Inclure les trajets proches » actives, avec leurs aides ; alerte Bruxelles → Kinshasa créée par l'API (3 mois, email, proches) : carte avec **« Email activé »** et **« Villes proches incluses »**, « 1 alerte active », « Nouvelle alerte ». Le toast « Alerte créée ! » n'est pas observé (création par l'API) |
| WEB-ALR-3 | Les refus de création | **Conforme** — sans ville, « Créer l'alerte » est **désactivé** (le message « Sélectionne les deux villes » du cahier existe dans le code mais n'est pas atteignable : formulation) ; aucune requête ; départ = arrivée → `400 ROUTE_ALERT_INVALID` (« Origin and destination must be different. ») ; même corridor actif → `400 ROUTE_ALERT_DUPLICATE` ; toujours une seule alerte |
| WEB-ALR-4 | L'alerte se déclenche à la publication | **Conforme** — Joséphine (qui porte la MÊME alerte) publie Bruxelles → Kinshasa (J+20) : email **« Nouveau trajet Bruxelles → Kinshasa »** à Aminata, en français, « Un nouveau trajet correspond à votre alerte », lien vers le trajet ; **rien** pour Joséphine (jamais le Voyageur lui-même). **Constat** : l'email vouvoie |
| WEB-ALR-5 | L'anti-spam de 24 heures | **Conforme** — un second Bruxelles → Kinshasa dans la foulée : **aucun** email pour Aminata (boîte vidée, 10 s d'attente) |
| WEB-ALR-6 | Les trajets proches | **Conforme** — Paris → Brazzaville **sans** « proches » : Orly → Brazzaville (≈ 15 km, coordonnées sur l'alerte et le trajet) ne déclenche rien ; option activée (alerte jamais notifiée) : un autre Orly → Brazzaville → email « Nouveau trajet Orly → Brazzaville », « Un trajet proche de votre alerte a été publié » ; Lille → Brazzaville (≈ 204 km) sur une alerte NEUVE (Pauline, pour ne pas confondre avec l'anti-spam) : rien. Villes : Paris 48.8566/2.3522 · Orly 48.7262/2.3652 · Lille 50.6292/3.0573 · Brazzaville −4.2634/15.2429 |
| WEB-ALR-7 | Prolonger et supprimer | **Conforme après correction** → `ANO-WEB-29` ; « Prolonger » n'apparaît que sur une alerte **« Expire bientôt »** (< 7 jours) — échéance rapprochée par l'API (« jusqu'au » J+3) : « Alerte prolongée de 6 mois », échéance ≈ J+6 mois, badge disparu ; « Supprimer » → « Confirmer » (3 s pour se raviser) → **« Alerte supprimée »**, « 1 alerte active » |
| WEB-ALR-8 | Le plafond de 20 alertes | **Conforme** — 20 alertes actives, la 21ᵉ → `400 ROUTE_ALERT_LIMIT`, message « maximum of 20 active route alerts » ; « 20 alertes actives » à l'écran ; tout est supprimé ensuite |
| WEB-ALR-9 | La bannière en fin de liste | **Conforme** — Paris → Brazzaville, en bas des résultats : « Reste informé·e des futurs trajets », « Crée une alerte pour être prévenu·e dès qu'un nouveau trajet correspondant est publié. », « Créer une alerte » |

### À trancher (produit)

- **« Prolonger » seulement sous 7 jours** (ALR-7) : le cahier l'attend sur toute carte. Choix
  raisonnable (une alerte à 5 mois n'a rien à prolonger) ; amender le cahier ou proposer le bouton
  partout avec un libellé « Prolonger jusqu'au … ».
- **« Sélectionne les deux villes »** (ALR-3) : le bouton désactivé remplace le message. Garder
  le bouton désactivé et retirer la branche morte du code, ou activer le bouton et afficher le
  message (plus explicite pour un lecteur d'écran).
- **L'email d'alerte vouvoie** (« Un nouveau trajet correspond à votre alerte ») : le gabarit
  `trip-published.ejs` prédate la décision du 03/09 (tutoiement). Un passage sur les trois
  gabarits de `trip-notifications` — petit.
- **Le message du plafond est en anglais** (« You can have a maximum of 20 … ») : c'est le
  message API (anglais par contrat) ; l'écran devrait le traduire à partir du code
  `ROUTE_ALERT_LIMIT` — vérifier ce que la modale affiche (non joué : création par l'API).

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **ALR-1** — L'état vide est bon. Proposer directement un corridor à partir de la dernière
  recherche (le brouillon `sessionStorage` existe) : « Créer une alerte Paris → Brazzaville » —
  petit.
- **ALR-2** — Le formulaire dépend de Google pour les villes : le même `CityAutocomplete` que la
  recherche, avec les mêmes limites (référent `localhost`). Un repli « ville + pays » saisis à la
  main quand Google est absent rendrait la fonction disponible partout et testable — moyen. La
  période « 3 mois ★ » est recommandée : dire pourquoi (infobulle) — petit.
- **ALR-3** — La règle « même ville » est dupliquée (écran + `validateSavedRoutePayload`) sans
  code d'erreur distinct côté serveur (`ROUTE_ALERT_INVALID` + message anglais) : un code par
  cause (`SAME_CITY`, `MISSING_CITY`, `DATE_RANGE_INVALID`) et une traduction par code — petit.
- **ALR-4** — Le dispatch est déclenché `setImmediate` après la réponse, sans outbox : si le
  processus tombe entre les deux, l'alerte n'est jamais notifiée et rien ne le sait. Passer par
  l'outbox du trip-service (D-outbox : « aucun changement d'état sans événement dans la même
  transaction ») et un consommateur notification-service — **moyen**, mais c'est la règle
  d'architecture du projet. Journaliser le résultat (n candidats, n envoyés) — petit.
- **ALR-5** — L'anti-spam est par ALERTE (`lastNotifiedAt`) : deux alertes proches (Paris →
  Brazzaville et Orly → Brazzaville) du même membre reçoivent deux emails pour le même trajet.
  Un regroupement par membre et par jour (« 3 nouveaux trajets correspondent à tes alertes ») —
  moyen. Et l'email raté n'est pas rejoué : `lastNotifiedAt` est posé avant confirmation d'envoi ?
  (à vérifier : l'ordre `sendTripPublishedEmail(...).catch` puis `update lastNotifiedAt`).
- **ALR-6** — L'appariement à trois niveaux est solide (placeId, ville + pays, haversine).
  Point faible : sans coordonnées sur le TRAJET (le wizard n'en envoie pas toujours, cf. 5.7
  ANO-WEB-23), le niveau 3 est inerte — le serveur devrait géocoder à la création (même chantier
  que le fuseau). Le rayon de 50 km est une constante : un réglage `alerts.nearbyRadiusKm`
  (catalogue D62) — petit.
- **ALR-7** — « Confirmer » se rétracte après 3 s sans le dire : un compte à rebours visible ou
  une vraie boîte de confirmation — petit. Après « Prolonger », dire la nouvelle date — petit.
- **ALR-8** — Le plafond de 20 est une constante : réglage de plateforme `alerts.maxActive`
  (D62) — petit ; et l'écran ne montre pas « 18/20 » — un compteur avant le refus — petit.
- **ALR-9** — La bannière n'apparaît qu'en fin de liste (`!hasMore`) : sur une liste de 40
  trajets elle est invisible avant trois « Charger plus ». La montrer aussi en tête quand la
  recherche porte une date sans résultat exact — petit.
- **Harnais** — Les fiches en série partagent l'état (par construction : ALR-7 consomme ce
  qu'ALR-2 et 6 ont créé) ; une fiche qui échoue arrête les suivantes. C'est voulu (le cahier
  est une histoire), mais chaque fiche nettoie ce qu'elle crée (Pauline, le plafond).

### Pièges de poste payés ici

- **Un bouton nommé avec son ornement** : « 3 mois ★ » — viser par préfixe (`/^3 mois/`).
- **Les fiches en série et un tour partiel** : rejouer une fiche isolée après un échec la fait
  partir d'un état déjà modifié (une alerte de moins) — rejouer le fichier entier.
- **Un toast peut ne jamais exister** (ANO-WEB-29) : quand un retour visuel manque, regarder si
  le composant qui devait l'émettre existe encore au moment de la réponse.

---


## Chapitre 5.11 — Favoris et Voyageurs suivis · **CONFORME** (12 fiches jouées, 3 après correction · 3 anomalies mineures closes · 12 scénarios en série, 1 min 50)

Le cœur et le suivi sont deux mécanismes distincts (favori privé sur un trajet ; abonnement à un
Voyageur avec email à sa prochaine publication). Aminata joue les deux ; Thomas est le Voyageur
suivi (et l'auteur des trajets publiés par l'API pour déclencher l'email) ; Joséphine fournit le
trajet annulé ; la médiation masque `yul`. Les recherches sont posées par le brouillon
`sessionStorage` (page-objet `recherche.ts`), les emails lus dans Mailpit.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-FAV-1 | Le cœur ouvre la porte d'identité | **Conforme** — visiteur : « Connecte-toi pour enregistrer un favori » + « Tes favoris sont liés à ton compte : ils te suivent sur tous tes appareils. Ce trajet t'attend après connexion. » ; connexion **dans la fenêtre** : `POST /trips/:id/favorite` part après la connexion, on reste sur `/fr/search`, le cœur est rempli, `GET /trips/favorites` contient le trajet — **le geste n'est pas perdu** |
| WEB-FAV-2 | Ajouter et retirer | **Conforme** — cœur rempli en moins de 1,5 s (mise à jour optimiste), API à jour ; « Mes favoris » : sous-titre, la même carte (11,50 €/kg), « 1 trajet » ; retour à la recherche : « Retirer des favoris », clic → vide, « Ajouter aux favoris », API à jour |
| WEB-FAV-3 | Pas son propre trajet | **Conforme** — Thomas sur `bzv-perkg` : le cœur est présent, le clic répond par le toast « Tu ne peux pas mettre ton propre trajet en favori » (variante « info-bulle » du cahier), `403 OWN_TRIP` |
| WEB-FAV-4 | Un trajet indisponible | **Conforme après correction** → `ANO-WEB-32` ; favori d'un trajet annulé depuis : toujours listé, sa fiche répond « Trajet introuvable » / « Ce trajet n'existe pas ou n'est plus disponible. », ré-ajout `409 TRIP_NOT_FAVORITABLE`, retrait `200` ; trajet **masqué par Yamba** : ajout `409`, retrait `200` |
| WEB-FAV-5 | Un favori survit à la fin du trajet | **Conforme après correction** → `ANO-WEB-30` ; `los` (parti depuis 2 jours, PUBLISHED) : ajout `200`, listé avec **« Trajet passé »** |
| WEB-FAV-6 | L'état vide des favoris | **Conforme** — retraits par le cœur depuis la liste, rechargement : « Aucun favori pour l'instant », « Touche le cœur d'un trajet dans la recherche ou sur sa fiche pour le retrouver ici. », « Chercher un trajet » |
| WEB-FAV-7 | Suivre un Voyageur | **Conforme** — page `/u/<slug>` de Thomas : « Suivre » → « Suivi », « n abonnés » +1 (écran et API), bascule « Me notifier au prochain trajet » cochée, « Recevoir un email dès que Thomas publie un nouveau trajet. » ; « Voyageurs suivis » : « 1 voyageur suivi », Thomas N., « 7 trajets publiés », « Prochain trajet à venir » (Paris → Brazzaville, date), badge « Voyageur », « Notifications activées ». **Constat** : la note s'écrit « 5.0 » (point) ici, « 5,0 » sur la carte de recherche |
| WEB-FAV-8 | L'email d'abonné | **Conforme** — Thomas publie Paris → Brazzaville : email **« Thomas N. vient de publier un nouveau trajet »** à Aminata, en français, lien vers le trajet |
| WEB-FAV-9 | Notification coupée, abonnement gardé | **Conforme** — « Notifications activées » → « Notifications désactivées », `notifyNextTrip: false` à l'API ; Thomas publie : **aucun** email (10 s) ; l'abonnement reste |
| WEB-FAV-10 | Se désabonner | **Conforme après correction** → `ANO-WEB-31` ; « Ne plus suivre » → « Confirmer » → **« Tu ne suis plus ce voyageur »**, la ligne disparaît, abonnés −1 |
| WEB-FAV-11 | Pas soi-même | **Conforme** — sur sa page : « Modifier mon profil », aucun « Suivre » ; appel forcé `400 CANNOT_FOLLOW_SELF` |
| WEB-FAV-12 | L'état vide des Voyageurs suivis | **Conforme** — « Aucun voyageur suivi », « Découvre les voyageurs de la communauté… », « Découvrir des Voyageurs » |

### À trancher (produit)

- **Le refus « propre trajet »** (FAV-3) est un toast après le clic ; le cahier accepte aussi
  l'absence du cœur ou une info-bulle. Cacher le cœur sur ses propres cartes (l'API sait
  `tripper.id`, le front sait `user.id`) éviterait un geste qui ne peut que échouer — petit.
- **La note « 5.0 »** (FAV-7) : `toFixed(1)` sans locale sur la carte « Voyageurs suivis », là où
  la carte de recherche écrit « 5,0 ». Un seul formateur — petit.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **FAV-1** — La porte reprend le geste (A63) : très bien. Mais « Ce trajet t'attend après
  connexion » n'est vrai que si l'on se connecte DANS la fenêtre ; « Créer un compte » navigue,
  et l'intention est perdue (non joué : inscription = chapitre 5.2). Persister l'intention
  (`sessionStorage`) pour la reprendre après inscription — petit.
- **FAV-2** — Le cœur est optimiste et le compteur de « Mes favoris » suit. La liste n'est pas
  paginée (`totalCount` = tout) : au-delà de 50 favoris, charger par pages — petit ; et « Un favori
  est privé » : le dire aussi sur la carte (info-bulle du cœur) — petit.
- **FAV-3** — Voir « à trancher » ; et le code `OWN_TRIP` est 403 alors que `TRIP_NOT_FAVORITABLE`
  est 409 : deux statuts pour deux refus métier — un seul (409) rendrait l'API plus régulière — petit.
- **FAV-4** — Le favori d'un trajet annulé reste listé mais sa carte ne le dit pas (elle ressemble
  à un trajet vivant jusqu'au clic → 404). Un état « Plus disponible » sur la carte, comme
  « Trajet passé » — petit (l'API `listFavoriteTrips` a `status` et `hiddenByAdminAt` sous la main).
- **FAV-5** — « Trajet passé » est rendu ; le cœur reste actif dessus (retrait) : bien. Proposer
  « Chercher un trajet similaire » — petit.
- **FAV-6** — Bon. Le CTA « Chercher un trajet » pourrait reprendre la dernière recherche — petit.
- **FAV-7** — Le compteur « n abonnés » n'apparaît qu'au-dessus de zéro (`followersCount > 0`) :
  cohérent avec « jamais 0 vue ». Le nombre de trajets publiés vient de `carrierPage.totalTripsPublished`
  (compteur dénormalisé, D-stats) : vérifier qu'il suit les annulations (regard 5.7) — moyen à
  auditer.
- **FAV-8** — L'email suit le même dispatch sans outbox que les alertes (5.10, ALR-4) : même
  remarque, même remède (outbox + consommateur) — moyen. Sujet « vient de publier un nouveau
  trajet » : dire le corridor dans le sujet (comme pour l'alerte) — petit.
- **FAV-9** — La bascule est un bouton texte « Notifications activées / désactivées » : un vrai
  `role="switch"` (comme sur la page publique) pour l'accessibilité — petit.
- **FAV-10** — Voir ANO-WEB-31 ; et « Confirmer » se rétracte en 3 s sans le dire (même remarque
  qu'en 5.10) — petit.
- **FAV-11** — Bon (`CANNOT_FOLLOW_SELF`). Le bouton « Discuter · Bientôt » sur sa propre page
  (vu en 5.9) : à retirer aussi ici — petit.
- **FAV-12** — Bon. « Découvrir des Voyageurs » mène où ? (non joué) — vérifier qu'une page de
  découverte existe, sinon pointer la recherche — petit.
- **Transversal** — Troisième `mutate(x, { onSuccess: toast })` perdu par une mise à jour optimiste
  (5.10 alertes, 5.11 suivis) : passer en revue tous les `mutate(` du front avec des callbacks
  et un `onMutate` qui retire l'élément — petit, systématique.

### Pièges de poste payés ici

- **Le cœur est DANS le lien de la carte** : `carte.locator("xpath=..")` remonte au conteneur de
  la liste et `.first()` prend le cœur de la PREMIÈRE carte — le favori partait sur
  `bzv-upcoming` au lieu de `bzv-perkg`. Viser `carte.getByRole("button", …)`. La fiche 5.9 (RCH-3)
  avait le même sélecteur, inoffensif là (présence seulement) — corrigé aussi.
- **`GET /users/:slug/public`** (pas `/users/:slug`) pour le DTO public d'un membre.
- **`nx serve trip-service` est retombé sur « Recursive task invocation »** (piège 17) après deux
  modifications rapprochées (mapper + contrat) : port 6002 muet, passerelle en `AggregateError`.
  Relancer `nx serve trip-service`.
- **Capitales CSS** (« PROCHAIN TRAJET À VENIR », « VOYAGEUR ») : comparaisons sans casse.

---

---

## Chapitre 5.12 — Réserver : l'assistant en quatre étapes et le devis · **CONFORME** (22 fiches : 21 jouées, 7 après correction, 1 ⏭ · 7 anomalies closes · 12 scénarios, 2 min 05)

Complète les deux fichiers du chapitre 6 (`web-rsv.spec.ts` : la porte, ANO-WEB-02 ;
`web-rsv-assistant.spec.ts` : le nominal 32,20 € et la famille refusée) avec `web-rsv-devis.spec.ts`.
Trajet de démonstration `bzv-perkg` (11,50 €/kg, Électronique +20 %, Alimentaire refusé, soute
230 €), compte Aminata ; Joséphine fournit les trajets « jetables » (devis divergent, dernier kilo) ;
deal-service sur le fournisseur **FAKE**. Le devis est vérifié **au centime** contre la note de
calcul du cahier — et il est exact partout.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-RSV-1 | La porte pour un visiteur | **Conforme** — « Connecte-toi pour réserver » + sous-titre, par-dessus la page du trajet (« Trajet proposé par Thomas N. » toujours là) ; `/book` direct : la même porte en pleine page, « Se connecter » (la suite est dans `web-rsv.spec.ts`) |
| WEB-RSV-2 | L'entrée | **Conforme** — « Réservation », quatre étapes numérotées « 1 Colis 2 Destinataire 3 Engagement 4 Paiement », « Décris ton colis » / sous-titre, colonne de droite `sticky`, « Retour au trajet » et « Étape précédente » (dès l'étape 2). **Constat** : « étape 1 sur 4 » est l'indicateur MOBILE |
| WEB-RSV-3 | Les lieux de rendez-vous | **Conforme** — « Tu remets le colis à Thomas » / « Le destinataire récupère le colis », un lieu de chaque côté pré-sélectionné (« Lieu convenu avec le voyageur »), « À l'aéroport », « Lieu exact » |
| WEB-RSV-4 | Les règles d'or | **Conforme** — un `<details>` (« Voir ») : les quatre puces, « Voir la liste complète » (bouton) |
| WEB-RSV-5 | Le produit et la famille refusée | **Conforme** — « Un colis (au kilo) », « Un bagage soute 23 kg 230 € » ; le cabine **absent** (non offert) ; « Alimentaire sec & scellé » visible, barrée (✕), désactivée, `title` « Thomas ne prend pas cette famille sur ce trajet » ; « Électronique & appareils +20 % » avant le choix |
| WEB-RSV-6 | Le poids et sa borne | **Conforme après correction** → `ANO-WEB-34` (s'ouvrait vide) ; « 2 » à l'ouverture ; « n kg encore disponibles sur ce trajet » ; 35 → « 30 kg maximum par colis », on reste à l'étape 1 ; 30 → « Il ne reste que n kg… » ; 2,5 accepté ; infobulle « Poids déclaré… 0.5 kg minimum et jamais moins de 8 €… ≤ 10 % ». **Constats** : les erreurs se montrent à la TENTATIVE de continuer (pas au blur, le bouton n'est pas grisé) ; « 15.5 kg » et « 0.5 kg » avec un **point** |
| WEB-RSV-7 | La taille et son coefficient | **Conforme** — libellés S / M / L (« ×1 », « ×1,1 », « ×1,25 »), « Transport · 2,5 kg × 11,50 €/kg × S 28,75 € », S = 28,75 / 3,45 / **32,20** ; L = 35,94 / 4,31 / **40,25** ; retour S |
| WEB-RSV-8 | Le supplément et le plancher | **Conforme** — Électronique : « × S · +20 % 34,50 € » / 4,14 / **38,64** ; 0,1 kg : « 0,5 kg × 11,50 €/kg × S 8 € », « Minimum par colis appliqué : 8 € », 3 € / **11 €**. **Constat** : décimales nulles omises (« 8 € », « 11 € » ; le cahier écrit « 8,00 € ») |
| WEB-RSV-9 | Valeur, description, photos | **Conforme après correction** → `ANO-WEB-39` ; infobulle de la valeur ; « abc » → « Décris brièvement le contenu (min. 5 caractères) » à la tentative ; deux photos → « Contenu », « Emballé » ; aide « JPEG ou PNG, max 10 Mo par photo » ; > 10 Mo → « Une photo dépasse 10 Mo… », deux photos toujours, aucune requête. **Constat** : au plus **5** photos (`MAX_PHOTOS`), le cahier écrit 6 |
| WEB-RSV-10 | La protection du colis | **Conforme après correction** → `ANO-WEB-33` ; « Protection de base · Inclus » et « Garantie Yamba 500 € · +6 € » avec leurs textes ; garantie : transport 28,75, **« Service & protection 3,45 € » + ligne « Garantie Yamba 500 € 6 € »**, total **38,20** (le cahier cumule 9,45 : constat) ; sans photo : « Au moins 1 photo requise avec la Garantie Yamba 500 € », bloqué à l'étape 1, badge « Obligatoire avec la protection étendue » ; le mot « assurance » absent de la page |
| WEB-RSV-11 | Le bagage entier | **Conforme** — poids et taille disparaissent ; « Transport 230 € », « Service & protection 27,60 € », **Total 257,60 €** |
| WEB-RSV-12 | Jamais zéro | **Conforme après correction** → `ANO-WEB-37` ; poids vidé : « Indique le poids du colis pour voir le prix. » seul ; sans taille : « Choisis une taille (S, M ou L). » |
| WEB-RSV-13 | Le destinataire | **Conforme** — « À qui livrer ? » / sous-titre ; encart « Comment se passera la livraison » (trois puces) ; le téléphone est le **premier** champ, indicatif `+33` par défaut ; `12` refusé (on reste à l'étape 2) ; `061234567` accepté ; email « (optionnel) » |
| WEB-RSV-14 | L'engagement | **Conforme** — « Ton engagement » / « Tu certifies sur l'honneur… » ; encart de remise (vérification visuelle, refus possible « Tu seras remboursé mais le trajet sera perdu », photos croisées) ; Charte (illicite, déclaré, douanes, phrase de responsabilité) ; **une seule case** (CGV + Contrat de transport) ; sans elle on reste ; cochée → Paiement |
| WEB-RSV-15 | Le paiement | **Conforme** — sous-titre « Le montant est autorisé maintenant… (sous 24 h) », bandeau « Mode test : aucun prestataire… L'autorisation de 32,20 € est simulée… », « Après ton paiement » (« 24h pour accepter », « 3 jours après la livraison validée… »), « Paiement sécurisé par Stripe… », « Payer 32,20 € », aucun `iframe` Stripe (un seul composant) |
| WEB-RSV-16 | Une carte refusée | **⏭** — fournisseur FAKE (le Payment Element ne se monte pas sur l'origine `http` du poste) ; la carte `4000 0000 0000 0002` est rejouée par la recette API |
| WEB-RSV-17 | La demande est envoyée | **Conforme** — « Demande envoyée ! Le voyageur a 24 h pour accepter. », suivi `/bookings/<id>` : « En attente du Voyageur », « Ta demande est envoyée et ton paiement est autorisé — rien n'est débité… », « Sans réponse, elle expire le … » ; kilos **−2,5** (DTO public) ; Mailpit : « Reçu : paiement autorisé… » avec 32,20 pour Aminata ; « Nouvelle demande de transport… » avec **28,75** pour Thomas, jamais 32,20. **Constat** : la date limite est « jusqu'au {date} », pas « 24 h » |
| WEB-RSV-18 | Le devis change | **Conforme après correction** → `ANO-WEB-36` ; Joséphine passe 11,50 → 15,00 pendant qu'Aminata est à l'étape 4 : `409 QUOTE_DIVERGENCE`, « Le prix a changé depuis ton devis… », **« Payer 42 € »**, aucun deal créé |
| WEB-RSV-19 | Le dernier kilo | **Conforme** — trajet à 2 kg, Aminata et João à l'étape 4 : A crée sa demande ; B → `409 CAPACITY_EXCEEDED`, « Il ne reste plus assez de place sur ce trajet pour ton colis. », aucune trace dans ses réservations |
| WEB-RSV-20 | Son propre trajet | **Conforme après correction** → `ANO-WEB-35` ; Thomas sur `/book` de `bzv-perkg` : « Tu ne peux pas réserver ton propre trajet. » ; intention forcée refusée |
| WEB-RSV-21 | Parti ou masqué | **Conforme après correction** → `ANO-WEB-38` ; `bzv-inflight` : « Ce trajet n'accepte plus de demandes. » ; `yul` masqué par la médiation : « Trajet introuvable » |
| WEB-RSV-22 | Reprise après rechargement | **Conforme** — étapes 1 et 2 remplies, rechargement : étape 2 retrouvée, Clarisse / Mabiala, puis « Étape précédente » : 2,5 kg et la description |

### À trancher (produit)

- **Le format des montants et des kilos** : « 8 € » / « 42 € » (décimales nulles omises) là où la
  page publique écrit « 26,00 € », et « 15.5 kg » / « 0.5 kg » avec un **point** en français. Un
  seul formateur (`Intl.NumberFormat("fr-FR")`) partout — petit, mais visible à chaque écran.
- **La protection étendue** : ventilée (3,45 + 6) à l'écran, cumulée (9,45) au cahier. La
  ventilation est plus honnête ; amender le cahier.
- **Cinq photos** (`MAX_PHOTOS`) contre six au cahier. Trancher, aligner l'aide.
- **Les erreurs à la tentative** (« Continuer » n'est jamais grisé, l'erreur vient au clic) : c'est
  un choix (ne pas bloquer un bouton sans dire pourquoi) ; le cahier attend un bouton inactif —
  amender le cahier.
- **« étape 1 sur 4 »** n'existe que sur mobile ; sur écran large les étapes numérotées le
  remplacent. Amender le cahier.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **RSV-1** — La porte par-dessus la page est bonne ; « Créer un compte » navigue et perd le colis
  (même remarque qu'en 5.11) — petit.
- **RSV-2** — Le formulaire vit en `sessionStorage` par onglet : un membre qui rouvre dans un
  nouvel onglet repart de zéro. `localStorage` + identifiant du trajet + date — petit.
- **RSV-3** — Le lieu unique est pré-sélectionné sans possibilité de dire « je préfère un autre
  point » : un champ « précision » libre pour l'Expéditeur (rendez-vous exact) — moyen.
- **RSV-4** — « Voir la liste complète » est un bouton qui ouvre… quoi ? (non vérifié : une modale
  probable). Un lien vers `/legal/prohibited` partageable — petit.
- **RSV-5** — La famille refusée dit pourquoi en `title` (invisible au toucher) : un texte sous la
  puce — petit. Le cabine absent : afficher « non proposé par Thomas » grisé (cohérent avec la
  famille refusée) — petit.
- **RSV-6** — Le poids par défaut est maintenant 2 kg ; ajouter des raccourcis (1 · 2 · 5 kg) —
  petit. La borne 30 kg est une constante front : réglage D62 (`pricing.maxParcelKg`) — petit.
- **RSV-7/8** — Le devis client (`computeTotal`) et le devis serveur (`QUOTE_DIVERGENCE`) sont
  deux implémentations de la même règle (D17) : partager le calcul (`packages/libs/pricing`) ou
  servir le devis par l'API à chaque changement — **moyen**, mais c'est la source de toute
  divergence future.
- **RSV-9** — Les photos partent au paiement : un échec de téléversement après l'autorisation
  (« ta carte n'a pas été débitée ») est un cas limite à surveiller ; téléverser à la sélection
  (avec suppression côté ImageKit si abandon) — moyen.
- **RSV-10** — « Voir les conditions » de la garantie : vérifier qu'il mène à l'IPID (non joué) ;
  et la case « exclusions affichées avant validation » : les afficher AVANT « Payer », pas seulement
  les nommer — petit.
- **RSV-11** — Bagage entier : dire « 23 kg consommés sur la capacité » et masquer aussi la
  famille ? (elle reste affichée) — petit.
- **RSV-12** — Bon après correction ; l'indice pourrait pointer le champ (focus) — petit.
- **RSV-13** — Le numéro accepté est-il normalisé E.164 côté serveur ? (non vérifié à l'écran) ;
  afficher « +242 61 23 45 67 » formaté dans le récap — petit.
- **RSV-14** — Une seule case pour trois documents : exiger l'ouverture de la Charte avant de
  cocher (scroll) — moyen ; horodater l'acceptation dans le deal (D-preuve) — vérifier.
- **RSV-15** — En FAKE, le bandeau est clair. En Stripe, l'iframe ne se monte pas sur `http` :
  documenter `https` en LAN (mkcert) pour rejouer RSV-16 sur le poste — moyen (outillage).
- **RSV-17** — Emails OK ; le sujet du Voyageur pourrait porter le gain (« 28,75 € à gagner ») — petit.
- **RSV-18** — Après divergence, dire explicitement l'ancien et le nouveau total (« 32,20 € →
  42 € ») — petit.
- **RSV-19** — `CAPACITY_EXCEEDED` est verrouillé par `updatedAt` (optimiste) ; un second essai
  de B après rafraîchissement dit « Plus assez de place » — bon. Proposer le trajet suivant du
  même corridor — petit.
- **RSV-20/21** — Les gardes d'ouverture sont maintenant côté front ; la même liste de raisons
  devrait venir de l'API (`bookable: { ok, reason }` dans le DTO public) pour ne pas dupliquer la
  règle `checkTripBookable` — moyen.
- **RSV-22** — Bon. Ajouter un « Reprendre ma réservation » sur la page du trajet quand un
  brouillon existe — petit.
- **Transversal** — Sept anomalies sur un écran « cœur du produit » : trois d'entre elles (poids
  vide, 0 €, total non rafraîchi) sont des DÉFAUTS DE BRANCHEMENT entre une fabrique / un cache
  et l'écran, pas des règles fausses. Un test de composant (Vitest + Testing Library) sur le
  wizard avec un trajet fixture les aurait pris avant la recette — **moyen**, et le plus rentable.

### Pièges de poste payés ici

- **« Payer » n'existe qu'à l'étape 4** : aux étapes 1–3, le total se lit dans la colonne
  (« Total 32,20 € »), et le libellé de transport porte le détail (« × S · +20 % 34,50 € »).
- **Décimales nulles et point décimal** : `eur("8,00")` → `8(,00)? €`, `15[.,]5 kg`.
- **Les kilos restants ne sont pas constants** : chaque tour de RSV-17 en prend 2,5 sur
  `bzv-perkg` ; lire le DTO public (`GET /trips/:id/public`, `remainingKg`) — le DTO propriétaire
  répond 403 à l'Expéditrice.
- **Les erreurs viennent à la tentative** : cliquer « Continuer » puis lire l'erreur et vérifier
  qu'on est resté sur l'étape.
- **Un `<details>`** : cliquer son intitulé, pas un bouton « Voir » (il disparaît une fois ouvert).
- **Une photo trop lourde entrait dans la grille** (ANO-WEB-39) : le « supprimer toutes les
  photos » de la fiche 10 doit boucler tant qu'il en reste.

## Chapitre 5.13 — Les plafonds du compte neuf · **CONFORME** (5 fiches jouées, 1 après correction · 1 anomalie mineure close · 5 scénarios en série, 2 min 00)

`web-tru.spec.ts`. Le parcours WEB-E2E-4 couvrait déjà le cœur (450 €, 12 kg, cinq puis six) ; le
chapitre le découpe fiche par fiche et ajoute ce que le parcours ne prouvait pas : la valeur et le
poids **corrigés qui passent**, le compte ancien (Aminata) qui réserve 12 kg à 450 € sans refus, le
**levier du back-office** (`[TRU7]` : un OPS touche le plafond mensuel, l'effet est mesuré en
secondes, la valeur est remise), le suivi d'envoi parmi les écrans fouillés, et les **réponses brutes
de l'API** au membre. Le compte neuf est créé par l'écran d'inscription en fiche 1
(`neuf-20260911124709@recette.yamba.dev` à cette exécution) et sert aux fiches suivantes ;
deal-service sur le fournisseur FAKE.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-TRU-1 | Le plafond de valeur déclarée | **Conforme après correction** → `ANO-WEB-40` ; 450 € : refus **à l'intention de paiement** (`POST /deals/payment-intents` 409, avant tout argent), message exact du cahier dans la carte de paiement, « Réessayer » ; « Payer » **grisé** à côté de l'encadré ; `GET /me/bookings` = 0, Finances « Aucun paiement pour l'instant », aucun email ; 250 € : la demande passe, suivi `/bookings/<id>`, « Reçu : paiement autorisé… » dans Mailpit |
| WEB-TRU-2 | Le plafond de poids | **Conforme** — 12 kg (`fih`) : même message, même moment (l'intention), « Payer » grisé, toujours 1 demande ; 8 kg : passe (2 demandes) |
| WEB-TRU-3 | Le plafond d'envois par mois, puis le levier | **Conforme** — trois demandes de plus (`gru`, `yul`, `bzv-upcoming`) → 5 dans le mois ; la sixième (`bzv-perkg`) refusée **dès l'autorisation**, même message, toujours 5. Levier `[TRU7]` : l'OPS (Olivier) écrit `trust.newAccount.maxShipmentsPerMonth` 5 → 6 par `PATCH /admin/settings` (motif ≥ 20, verrou de version) ; « Réessayer » toutes les 5 s : l'intention passe, la sixième est créée **≈ 6 s après l'écriture** (journal `SETTING_CHANGED` 12:48:24,3 → demande 12:48:29,9 ; contrainte « < 30 s » tenue) ; remise à 5 à 12:48:30,6, relue à 5 ; deux emails « Paramètres de la plateforme modifiés » chez le super administrateur |
| WEB-TRU-4 | Un compte ancien n'a aucun plafond | **Conforme** — Aminata (90 jours) : 12 kg, 450 €, taille M sur `bzv-perkg` → aucun refus, suivi « En attente du Voyageur » ; le DTO de l'Expéditrice porte `weightKg: 12` et `declaredValueCents: 45000` |
| WEB-TRU-5 | Le score interne n'est jamais visible | **Conforme** — cinq écrans du compte neuf (tableau de bord, profil, Mes envois, le suivi d'un envoi, la page publique) : aucun « score », « niveau de risque », « compte à risque », « trust », aucun « n points » ; le message de plafond n'est pas là sans tentative ; **trois réponses d'API** (`/auth/me`, `/me/bookings`, `/deals/:id`) sans `trustScore` / `riskLevel` / `caps` / `capsReason` ; export par la porte sudo : `yamba-data-export/1`, six réservations, aucune trace du score |

### À trancher (produit)

- **Le message de plafond est générique** (« valeur déclarée, poids et nombre par mois ») alors que
  l'API dit lequel (`details.cap`, `limit`, `value`) et que le catalogue des paramètres écrit « le
  membre lit le plafond dans le message ». Le cahier attend le message générique ; un message ciblé
  (« pour l'instant, 300 € déclarés au plus par colis ») éviterait trois essais à l'aveugle. Trancher
  entre le cahier et le catalogue ; s'il faut cibler, c'est une clé i18n par `cap` — petit.
- **Le compteur mensuel compte les demandes créées**, y compris refusées par le Voyageur, expirées ou
  annulées : cinq demandes déclinées bloquent un compte neuf jusqu'au mois suivant. Compter les
  demandes **vivantes ou abouties** (ou exclure les déclinées) est un choix à graver (D71) — moyen.
- **Le levier a été joué en relevant le plafond** (5 → 6) et non en l'abaissant comme la note du
  cahier le suggère : le compte avait déjà cinq demandes, et c'est le sens qui prouve un effet
  (une demande qui passe). L'abaissement se rejoue tel quel au cahier 02-ADMIN (`[TRU7]`).
- **Le compte de travail** : le cahier nomme `recette+neuf@seed.yamba.dev` ; le harnais crée
  `neuf-<horodatage>@recette.yamba.dev` à chaque exécution (piège 22). Amender le cahier.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **TRU-1** — Le refus tombe à l'étape 4, après trois étapes de saisie : servir les plafonds du
  membre (pas le score — les plafonds ne sont pas le score) dans `/auth/me` (`limits: { maxDeclaredValueCents,
  maxWeightKg, shipmentsLeftThisMonth }`) permettrait de borner la valeur à l'étape 1 et de le dire
  avant. **Décision de registre** (D71 dit « jamais servi au membre » pour le score ; les plafonds
  sont une autre donnée) — moyen.
- **TRU-2** — Même levier : le champ poids pourrait s'arrêter à 10 kg pour un compte neuf, avec
  l'indice « 10 kg au plus pour l'instant ». Et « Réessayer » après un refus de plafond redemande la
  même intention (même refus) : le bouton devrait ramener à l'étape 1 — petit.
- **TRU-3** — Le lecteur de paramètres (cache 30 s) a répondu en 6 s : bon. Le score est recalculé à
  chaque intention (`loadTrustSignals` : quatre `count` Mongo) ; un cache par membre de 60 s côté
  deal-service épargnerait trois requêtes par tentative — petit. La page admin des paramètres
  pourrait afficher « effet sous 30 s » à côté du bouton — petit.
- **TRU-4** — Aminata n'est « ancienne » que par `createdAt` (90 j) : un compte de 31 jours sans
  aucun envoi terminé n'est plus plafonné non plus (`isNew` = âge seul dès que `completedDeals` < 3
  est vrai des deux côtés). Vérifier que c'est voulu (CNF-06 dit « moins de 30 jours ET moins de 3
  envois ») — c'est le cas, mais un compte dormant de 31 jours a les mêmes droits qu'un compte prouvé
  ; un seuil « au moins 1 envoi terminé OU 30 jours » serait plus sûr — moyen, registre.
- **TRU-5** — La preuve par liste de mots interdits est fragile par nature ; la vraie garde est la
  whitelist des DTO. Ajouter un test de contrat deal-service qui affirme que le DTO Expéditeur ne
  contient AUCUNE clé de `TrustAssessment` (`score`, `level`, `factors`, `caps`, `capsReason`) — petit,
  et il tient pour toujours.
- **Transversal** — Les six demandes du compte neuf restent en base (piège 22) et comptent dans les
  files du back-office (« demandes en attente » de Thomas ×2, Joséphine, Inès, Marc) : le seed les
  efface au prochain rejeu, mais une exécution isolée du chapitre laisse ces traces — documenté.

### Pièges de poste payés ici

- **Le levier du back-office se prouve dans le sens qui crée quelque chose** : relever le plafond et
  voir une demande passer ; l'abaisser sur un compte déjà plein ne change rien d'observable.
- **Mesurer l'effet par le bouton du produit** (« Réessayer » toutes les 5 s, `waitForResponse` sur
  l'intention) plutôt que d'attendre 31 s : la mesure est réelle (6 s), et le scénario dure moins.
- **Toujours remettre le paramètre dans un `finally`** avec un nouveau `expectedVersion` (le verrou
  optimiste a bougé) — et relire la valeur après.
- **Le journal du chapitre 5.12** disait « Payer » actif à côté du refus : la contre-épreuve d'ANO-WEB-40
  est une assertion `toBeDisabled()` sur le bouton **visible** (`filter({ visible: true })` — la
  feuille mobile est aussi dans le DOM sur écran large).
- **`--reporter=list` remplace le rapport HTML** : les annotations (`test.info().annotations`) ne sont
  plus écrites nulle part ; la preuve horaire du levier a été relue dans `AdminAction` et `Booking`.

## Chapitre 5.14 — La demande côté Voyageur : accepter, refuser, expirer · **CONFORME** (9 fiches jouées, 3 après correction · 3 anomalies closes dont 2 MAJEURES, 1 mineure ouverte · 9 scénarios en série, 2 min 20)

`web-dea.spec.ts`. Le pendant de l'assistant de réservation : où la demande apparaît chez Thomas, l'écran
« Nouvelle demande de Deal » bloc par bloc, la Charte, l'acceptation (capture, notification, email, fil),
le refus sans pénalité, l'expiration (avant et après le cron), deux décisions concurrentes, les états
fermés, « Mon Deal accepté » en détail. Les demandes vivantes sont créées par l'assistant (Aminata sur
`bzv-perkg`, 2,5 kg S 150 € avec photos : 32,20 € payés, 28,75 € nets — les chiffres du chapitre 5.12) ;
le refus se joue sur `bzv-pending`, l'expiration sur `gru-pending` (manœuvre consignée + passe forcée
`scripts/recette/expire.ts`), les états fermés sur les trois deals clos du seed. deal-service en FAKE.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-DEA-1 | Où la demande apparaît | **Conforme après correction** → `ANO-WEB-41` (MAJEURE : « jeu. 1 janv. » sur toutes les lignes, trajet parti rangé « à venir ») ; accueil : « À traiter · 7 », « Demande de Aminata · Paris → Brazzaville · sam. 26 sept. », « Vêtements · 2,5 kg · tu gagnes 28,75 € · reçue cette heure-ci », « Expire dans 23 h », « Répondre » ; « Mes trajets » : la même bande, le trajet « 26 sept. 2026 · Avion · En ligne · 1 demande », la section dépliée « Aminata D · Vêtements · 2,5 kg · Demande en attente de ta réponse · expire dans 23 h · Demande · + 28,75 € » ; fiche du trajet : « Demandes et colis · 1 demande » ; cloche : « Nouvelle demande de Aminata » / « Paris → Brazzaville · 2,5 kg · réponds sous 24 h » ; aucun onglet « Demandes ». **Écart** : pas de carte « {n} demandes en attente » / « À répondre » / « Voir les demandes » (copie présente dans `dashboardHome.json`, jamais rendue) — une ligne par demande à la place |
| WEB-DEA-2 | L'écran « Nouvelle demande de Deal » | **Conforme après correction** → `ANO-WEB-42` (lieu écrit deux fois, mention du téléphone jamais affichée) ; « Reçue il y a 0min · Paris → Brazzaville · sam. 26 sept. », puce « Expire dans 23h 59min » **ambre**, **rouge et `role="alert"` à +90 min** (manœuvre `deal-eligible.ts`, remise à +23 h) ; « DE LA PART DE Aminata D. Voir profil » ; « DÉTAILS DU COLIS » (CATÉGORIE Vêtements, POIDS DÉCLARÉ 2,5 kg, VALEUR DÉCLARÉE 150 €, description) ; « PHOTOS DÉCLARÉES PAR Aminata », visionneuse (Fermer / Suivant / Précédent) ; « MODALITÉS DE REMISE ET LIVRAISON », « Téléphone du destinataire communiqué à la prise en charge » ; « Garantie Yamba incluse », jamais « assurance » ; « Avant d'accepter… » et ses quatre puces ; « TU GAGNES 28,75 € » ; **jamais 32,20, jamais « commission »**, ni à l'écran ni dans le DTO (`totalShipperCents` absent). **Écarts** : ni « {n} envois » ni « Membre depuis » (→ `ANO-WEB-43` ouverte), pas de ligne « État : demande reçue… », pas d'intitulé « COUVERTURE DU COLIS », note du gain « Versé 4 jours après livraison validée par code confidentiel » (le cahier écrit « Versement à J+4 … sur ton compte Stripe ») |
| WEB-DEA-3 | La Charte est obligatoire | **Conforme** — sans la case : « Tu dois accepter la Charte pour confirmer ce Deal », on reste sur la demande, « Coche la Charte pour confirmer » ; les six engagements et la phrase de responsabilité ; cochée : « ✓ Charte acceptée », bouton actif |
| WEB-DEA-4 | Accepter | **Conforme** — « Mon Deal accepté », « Tu es engagé sur ce Deal » / « Aminata est prévenue · à toi de fixer le rendez-vous pour le pickup », cinq jalons, « Contacte Aminata pour fixer le rendez-vous », « Envoyer un message », « Appeler », « TON PAIEMENT · Net pour toi · Versé à J+4 · Ton compte de paiement » ; Aminata : notification « Thomas a accepté ta demande », email « Ta demande … est acceptée » avec 32,20, Finances « Bloqué chez Yamba » ; le fil s'ouvre des deux côtés (même `conversationId`) |
| WEB-DEA-5 | Refuser | **Conforme** — « Refuser cette demande ? » / « Aminata sera notifiée et pourra contacter un autre Voyageur. Ton taux d'acceptation reste intact. », « RAISON (OPTIONNEL) », **exactement cinq** radios, aucun champ libre, « Cette action est définitive », « Refuser le Deal » ; toast « Demande refusée. Aminata a été notifiée. », « Tu as refusé cette demande » ; Aminata : « Demande non acceptée » + phrase, email « n'a pas pu être acceptée » avec « Raison indiquée : Le colis est trop lourd pour la capacité restante. » ; kilos rendus (+3), profil public de Thomas identique (aucune pénalité). **Constat** : la raison est REFORMULÉE pour l'Expéditrice (le Voyageur a choisi « Poids ou volume trop important ») |
| WEB-DEA-6 | Expirée | **Conforme** — `expiresAt` −25 h : « Cette demande a expiré » / « Expirée », plus aucun bouton ; `POST /deals/:id/accept` → **409 `TRANSITION_NOT_ALLOWED`** avant le cron ; passe forcée : `status: EXPIRED`, João : « Demande expirée » + phrase, email « Ta demande … a expiré » |
| WEB-DEA-7 | Deux onglets | **Conforme** — onglet 1 accepte ; onglet 2 (figé sur sa lecture) refuse → **409**, toast « Ce deal a changé entre-temps. La page vient d'être actualisée. », relu sur « Tu es engagé sur ce Deal » ; DTO `ACCEPTED`, un seul débit « Bloqué chez Yamba » |
| WEB-DEA-8 | États fermés | **Conforme** — « Tu as refusé cette demande » / « Cette demande a expiré » / « Cette demande a été annulée » + « Il n'y a plus d'action à faire ici. », seul « Retour » |
| WEB-DEA-9 | « Mon Deal accepté » en détail | **Conforme après correction** → `ANO-WEB-44` (MAJEURE : « Aminata le révèle à **Hall** ») ; « DÉTAILS DU DEAL » (EXPÉDITEUR, CONTENU DÉCLARÉ, PICKUP — CHOISI PAR Aminata, LIVRAISON À) ; « Le code reste secret. Tu ne vois pas le code de livraison. Aminata le révèle à Clarisse quand tu confirmes le pickup. » ; « Le versement part après la période de vérification … sous 2 à 7 jours. » ; « Le jour J : la prise en charge » + « Confirmer la prise en charge » ; aucune suite de six chiffres à l'écran, aucun `deliveryCode` dans le DTO |

### À trancher (produit)

- **L'accueil** : une ligne par demande (« Demande de Aminata … Répondre ») plutôt qu'une carte par trajet
  (« {n} demandes en attente » / « Voir les demandes »). La ligne est plus actionnable ; la copie morte
  de `dashboardHome.json` (`liveTrip.demands*`) est à retirer ou à brancher. Amender le cahier.
- **Le bloc « DE LA PART DE »** sans « {n} envois » ni « Membre depuis » : ANO-WEB-43 (DTO à enrichir).
- **La note du gain** : « Versé 4 jours après livraison validée par code confidentiel » vs « Versement à
  J+4 après livraison validée · sur ton compte Stripe » (les deux existent en JSON) ; et l'intitulé
  « COUVERTURE DU COLIS », la ligne « État : demande reçue… » — trois textes du cahier non rendus.
- **La raison du refus reformulée** dans l'email (« Le colis est trop lourd pour la capacité restante »)
  : plus utile pour l'Expéditrice que le libellé du choix, mais le cahier dit « avec la raison ». Garder,
  amender le cahier.
- **« Reçue il y a 0min »** à la première minute : « à l'instant » — petit.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **DEA-1** — La ligne « Pickup avec Pauline · RDV · · checklist + photos » a un RDV vide (aucun rendez-vous
  fixé) : masquer le segment ou écrire « rendez-vous à fixer » — petit. Le badge de navigation compte
  les demandes ; un badge sur « Notifications » pour les seules non lues — petit.
- **DEA-2** — Le compte à rebours est calculé sur `expiresAt` côté client : un poste à l'heure fausse
  ment ; servir aussi `secondsLeft` — petit. La visionneuse : l'image interceptée ne se charge pas et
  l'icône de repli reste sans message ; une vignette cassée devrait le dire — petit.
- **DEA-3** — La Charte se coche sans avoir été déroulée ; exiger le défilement (comme proposé en RSV-14)
  ou horodater l'acceptation dans le deal — vérifier que `charterAccepted` est bien persisté avec
  `acceptedAt` — moyen.
- **DEA-4** — La capture du paiement est synchrone à l'acceptation : un échec de capture après l'écriture
  ACCEPTED ? Vérifier l'ordre (capture puis transaction, comme les remboursements manuels) — moyen,
  revue de code deal-lifecycle.
- **DEA-5** — « Ton taux d'acceptation reste intact » : ce taux n'existe nulle part à l'écran (ni profil
  public, ni réputation) — soit le calculer et l'afficher, soit reformuler (« sans pénalité ») — petit.
- **DEA-6** — Le cron passe toutes les 5 minutes ; entre-temps l'Expéditrice voit encore « En attente du
  Voyageur » alors que le Voyageur voit « Expirée » : servir `isExpired` dans le DTO Expéditeur pour
  afficher « expirée » dès la date, sans attendre le cron (l'argent, lui, attend la passe) — moyen.
- **DEA-7** — Le verrou tient ; le message « la page vient d'être actualisée » arrive AVANT le rendu
  actualisé (invalidation asynchrone) : afficher le toast à la fin du refetch — petit.
- **DEA-8** — Un deal fermé sans lien vers l'historique ni vers le trajet : ajouter « Voir mes trajets »
  — petit.
- **DEA-9** — Un « TODO Phase backend » vieux de la maquette a survécu jusqu'à la recette (ANO-WEB-44) :
  bannir les `split(" ")[0]` sur des libellés — un `grep "TODO Phase"` dans le front pour lister les
  autres survivants — petit, et le plus rentable.
- **Transversal** — Deux MAJEURES sur des données que l'API sert déjà (`departureAt`, `recipient.firstName`)
  mais que le front ne lisait pas : une règle de revue « toute dérivation d'un libellé (split, premier
  mot, date locale) est suspecte » vaut plus qu'un test — et un test de composant des vues acceptées
  avec un deal fixture aurait pris DEA-9.

### Pièges de poste payés ici

- **Toute la ligne « À traiter » est un lien** : « Répondre » n'est pas un bouton, c'est le libellé de
  l'action ; viser `a[href="/fr/carrier/deals/<id>"]` et filtrer sur le texte.
- **`innerText` respecte `text-transform`** : « RAISON (OPTIONNEL) », « PICKUP — CHOISI PAR AMINATA »
  arrivent en capitales ; comparer sans casse.
- **Le titre et sa méta sont deux nœuds adjacents** (« Demande de Aminata· Paris → … » sans espace) :
  ` ?·` dans le motif.
- **Une puce se vise par son libellé et son parent** (`getByText("Expire dans").locator("xpath=..")`),
  pas par un `div` filtré sur le texte (les ancêtres correspondent aussi).
- **Deux onglets « sans recharger »** : TanStack relit le deal au retour du focus ; figer la réponse
  (`page.route` qui rejoue la première lecture) jusqu'au clic de confirmation, puis `unroute`.
- **Un script de recette qui importe un service** (`expire.ts`) a une sortie qui ne se lit pas de
  façon fiable depuis `execFileSync` ; la preuve est l'état relu par l'API (`status: EXPIRED`).
- **Un deal fermé n'a pas de titre** : attendre « Il n'y a plus d'action à faire ici. » plutôt qu'un
  `heading`.
- **Les vignettes photo sont des boutons** ; l'image interceptée (ImageKit) ne se charge pas, l'icône de
  repli reste : cliquer le bouton, pas l'`img`.
- **`nx typecheck user-ui` / `admin-ui`** : la cible inférée par `@nx/js/typescript` a disparu sur le
  poste en cours de session (les services l'ont encore) ; la CI lance `tsc -p apps/user-ui` directement —
  `npx tsc --noEmit -p apps/user-ui/tsconfig.json` est l'équivalent.

## Chapitre 5.15 — Messagerie, rendez-vous et numéro de téléphone · **CONFORME** (22 fiches jouées, 4 après correction · 4 anomalies closes dont 1 BLOQUANTE et 1 MAJEURE · 21 scénarios en série, 3 min 24)

`web-msg.spec.ts`. Le fil par deal (D61) de bout en bout, deux navigateurs (A = Pauline, B = Thomas) sur
`bzv-accepted` ; les gardes sur `bzv-picked` (Aminata ↔ Thomas, code 742891), le litige sur
`bzv-disputed`, la fenêtre de 14 jours sur `bzv-completed` (manœuvre consignée), la relance par les
scripts de recette `relance-eligible.ts` + `relance.ts` (le cron des 5 minutes, forcé). deal-service en
FAKE ; la passerelle relancée en bundle en cours de campagne (limiteur, voir pièges).

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-MSG-1 | La liste des conversations | **Conforme** — « Thomas », « Paris → Brazzaville », le dernier message (« Bonjour, parfait. Je propose le terminal 2E… »), le rendez-vous « · à confirmer » ; écran large : liste à gauche, premier fil ouvert à droite ; bulle de l'en-tête « 1 » chez Thomas (un message non lu), vide chez Pauline (à jour). **Constats** : pas le RÔLE de l'interlocuteur sur la ligne ; « Choisissez une conversation. » ne s'affiche que sans aucun fil (le premier s'ouvre seul) |
| WEB-MSG-2 | L'état vide | **Conforme** — Mai : « Aucune conversation » / « Une conversation s'ouvre dès qu'un Voyageur accepte votre colis, ou dès que vous acceptez une demande. », « Choisissez une conversation. » |
| WEB-MSG-3 | Pas de fil avant l'acceptation | **Conforme (écart)** — `GET /conversations/by-deal/<bzv-pending>` → **403 `CONVERSATION_NOT_OPEN`**, aucun fil créé. **Écart** : le suivi d'une demande en attente n'a AUCUN bouton de message (le cahier attend un bouton qui explique) |
| WEB-MSG-4 | Envoyer un message | **Conforme** — bulle à droite chez l'auteur, fil groupé par jour (« jeudi 11 septembre »), placeholder « Écrire un message… », « Le code de livraison se donne en main propre, jamais par écrit. » ; chez Thomas le message arrive **sans rechargement** (≈ 3 s), à gauche ; notification « Nouveau message » / « Paris → Brazzaville · « Bonjour Thomas, le colis est prêt. » » ; Thomas répond, Pauline le voit |
| WEB-MSG-5 | Les réponses rapides | **Conforme** — les neuf puces du cahier ; « Je suis en route. » remplit la saisie, aucune requête, aucune bulle ; bascule **par le sélecteur de l'en-tête** (préférence enregistrée, D44) : « I'm on my way. », « Call me when you arrive. », « Write a message… », puis retour FR. **Constat** : la langue est celle du COMPTE, pas de l'adresse (`/en` seul ne change rien) ; après la bascule, la liste des réponses reste en français jusqu'au rechargement (cache non invalidé) |
| WEB-MSG-6 | Le code ne s'écrit jamais | **Conforme après correction** → `ANO-WEB-46` (BLOQUANTE : « Le code : 742 891 » passait) et `ANO-WEB-45` (texte anglais sous la saisie) ; « le code est 742891 » et « Le code : 742 891 » → **400 `DELIVERY_CODE_IN_MESSAGE`**, « Ce message contient le code de livraison. Il se donne en main propre, jamais par écrit. », aucune bulle ; « mon numéro de vol est 123456 » passe |
| WEB-MSG-7 | Coordonnées repérées, pas bloquées | **Conforme** — « appelle-moi au 06 12 34 56 78 » et « écris-moi à moi@exemple.fr » partent, aucune alerte, aucun toast ; côté équipe (`GET /admin/conversations/by-deal`, session SUPPORT) : les deux messages portent `flaggedContact: true` |
| WEB-MSG-8 | Proposer un rendez-vous | **Conforme** — Thomas (« Proposer un autre », une proposition du seed existe) : type Remise du colis, lieu, précisions, J+3 10:00–11:00 → « En attente de l'autre personne », ligne système « Un rendez-vous a été proposé. » ; Pauline : « À confirmer par vous » + « Accepter » |
| WEB-MSG-9 | Pas d'auto-acceptation | **Conforme** — chez l'auteur : aucun « Accepter », « Proposer un autre » seul |
| WEB-MSG-10 | Les bornes | **Conforme après correction** → `ANO-WEB-45` ; +10 min → 400 `INVALID_MEETUP_SLOT` `TOO_SOON` « Le rendez-vous doit commencer au moins 30 minutes à l'avance. » ; +120 j → `TOO_FAR` « …dans les 90 jours. » ; 20 h → `WINDOW_TOO_LONG` « Un rendez-vous dure 12 heures au plus. » |
| WEB-MSG-11 | Contre-proposer puis accepter | **Conforme** — Pauline 12:00–13:00 : **une seule** proposition PICKUP ouverte (la précédente annulée, DTO), « En attente de l'autre personne » ; Thomas accepte : « Confirmé », « Le rendez-vous est confirmé. » |
| WEB-MSG-12 | Le numéro s'ouvre tard | **Conforme** — « Voir le numéro » à J+3 : 400 `TOO_EARLY`, « Le numéro s'affiche à partir du {jour} {heure} (2 h avant le rendez-vous confirmé ou le départ). », aucun numéro. **Constat** : sans rendez-vous confirmé (yul-accepted), l'ancre de repli est le DÉPART (« à partir du lundi 14 septembre 14:43 ») ; le message « Proposez et confirmez un rendez-vous ci-dessous » n'apparaît que sans départ connu |
| WEB-MSG-13 | Le numéro à l'heure, trace unique | **Conforme après correction** → `ANO-WEB-47` (MAJEURE : une proposition après confirmation était invisible) ; Pauline propose +40 min, Thomas accepte ; « Voir le numéro » → 200, « Numéro de Thomas : +33612345601 » (lien `tel:`), **une** ligne « Le numéro de téléphone a été affiché. », bouton désactivé, toujours une ligne après rechargement |
| WEB-MSG-14 | « Appeler » ne compose jamais | **Conforme** — aucun `tel:` sur « Mon Deal accepté » ; « Appeler » → `/dashboard/messages?conversation=…&focus=phone`, bandeau du numéro (ou de son heure) en avant |
| WEB-MSG-15 | Les sept boutons | **Conforme** — « Envoyer un message à Thomas » (accepté), « Message à Thomas » (pris en charge), « Envoyer un message » (transit), côté Voyageur « Envoyer un message » (accepté), « Message » (pickup), « Envoyer un message » (transit), « Écrire à Aminata » (livraison) : chacun ouvre **le fil du deal** (`conversation=` = `by-deal`), jamais un second |
| WEB-MSG-16 | Signaler un message | **Conforme** — « Signaler un message » / intro ; **quatre** motifs (liste déroulante) ; « Merci, le signalement est transmis à notre équipe. » (201) ; le même message : **409** « Tu as déjà signalé ce message. » ; le fil inchangé ; Thomas ne reçoit rien qui parle de signalement |
| WEB-MSG-17 | Pas ses propres messages | **Conforme** — aucun bouton de signalement sur ses bulles |
| WEB-MSG-18 | Aucune suppression | **Conforme** — ni supprimer, ni modifier |
| WEB-MSG-19 | Lecture seule en litige | **Conforme** — Chinwe : « Un litige est en cours : les échanges passent par la médiation. », saisie absente, fil lisible |
| WEB-MSG-20 | Fermé 14 jours après la fin | **Conforme** — terminé il y a 2 jours : ouvert ; fin reculée à J−15 (manœuvre) : « Cette conversation est fermée à l'écriture. Vous pouvez toujours la relire. », saisie absente |
| WEB-MSG-21 | L'email de relance | **Conforme** — deux messages de Thomas, Pauline n'ouvre pas ; passe forcée : `sent: 1`, « Thomas t'a écrit à propos de Paris → Brazzaville », **sans le texte** ; seconde passe : `sent: 0`, un seul email ; notification in-app immédiate. **Écart** : la bulle de l'en-tête dit « 8 » = MESSAGES non lus d'une seule conversation (le cahier attend les CONVERSATIONS) |
| WEB-MSG-22 | Un tiers ne voit pas le fil | **Conforme après correction** → `ANO-WEB-48` ; API 403 sans contenu ; « La conversation n'a pas pu être ouverte. », aucun message |

### À trancher (produit)

- **La bulle de l'en-tête compte les messages** (`totalUnread` = somme des `unreadCount`), le cahier
  veut les **conversations** non lues. Une ligne : `items.filter(i => i.unreadCount > 0).length`.
- **Pas de bouton « message » sur une demande en attente** : le cahier attend un bouton qui explique
  (« La conversation s'ouvre une fois le deal accepté. ») ; la clé existe (`open.notOpenYet`), le
  suivi « pending » ne l'affiche pas. Ajouter le bouton grisé avec ce texte — petit.
- **La langue des réponses rapides suit le compte** (D44), pas l'adresse : le cahier dit « bascule en
  anglais », ce qui marche par le sélecteur (qui enregistre) ; amender le cahier. Et invalider la
  liste au changement de langue — petit.
- **Le rôle de l'interlocuteur** absent de la liste (« Thomas » sans « Voyageur ») — petit.
- **Sans rendez-vous, l'ancre du numéro est le départ** : cohérent avec la règle (D61 3A « ou le
  départ »), mais le message « Proposez et confirmez… » du cahier n'existe alors jamais pour un vrai
  trajet. Amender le cahier.
- **La re-proposition après confirmation** (ANO-WEB-47) est une décision : compléter D61 1A
  (« une proposition plus récente que l'acceptation prime ; l'accepter remplace le confirmé »).

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **MSG-1** — La liste ne dit pas le rôle ni l'état du deal (accepté, pris en charge) : un sous-titre
  « Voyageur · pris en charge » — petit. Le premier fil s'ouvre seul sur écran large et se marque lu :
  un membre qui ouvre « Messages » « lit » sans lire — ne marquer lu qu'à la visibilité réelle du fil
  (IntersectionObserver) — moyen.
- **MSG-2** — Bon. Un bouton « Voir mes envois / mes trajets » sous l'état vide — petit.
- **MSG-3** — Servir `conversation: { canOpen, reason }` dans le DTO du deal pour que CHAQUE écran
  affiche le bon bouton sans deviner — petit.
- **MSG-4** — Le fil se rafraîchit toutes les 3 s en polling : sur mobile, coûteux en batterie et en
  requêtes ; WebSocket ou SSE à partir d'un seuil (D61 le prévoit) ; en attendant, ralentir hors
  focus (`refetchIntervalInBackground: false`) — petit.
- **MSG-5** — Les réponses rapides sont fixes ; les filtrer par étape (`kind` PICKUP / DELIVERY existe
  déjà dans la liste) selon le statut du deal — petit.
- **MSG-6** — La garde compare jusqu'à trois candidats en bcrypt (≈ 3 × 70 ms) à chaque message avec
  chiffres ; garder une empreinte rapide (HMAC du code) à côté du bcrypt pour un premier tri — moyen.
  Et écrire « sept-quatre-deux… » passe toujours : la garde couvre l'écrit courant, pas la ruse ;
  c'est la règle (D61 4A), à rappeler dans le cahier.
- **MSG-7** — Les messages repérés ne remontent que dans la lecture admin d'un dossier ; une file
  « coordonnées repérées » (comme les signalements) éviterait de les chercher — moyen.
- **MSG-8** — Le formulaire de rendez-vous n'a pas de valeur par défaut (type, lieu du deal) :
  pré-remplir le lieu avec le lieu de remise choisi à la réservation — petit.
- **MSG-9** — Bon. Dire à l'auteur « Pauline n'a pas encore répondu » avec l'heure de la proposition — petit.
- **MSG-10** — Les bornes vivent dans `meetup.rules.ts` (constantes) : en faire des réglages D62
  (`messaging.meetupMinLeadMinutes`…) — petit ; les messages d'erreur devraient lire la borne
  courante plutôt que « 30 minutes » en dur — petit (lié).
- **MSG-11** — Une contre-proposition annule silencieusement la précédente : une ligne système
  « la proposition de 10:00 a été remplacée » — petit.
- **MSG-12** — Le bandeau annonce l'heure d'ouverture sans compte à rebours ; réutiliser
  `useExpiryCountdown` — petit.
- **MSG-13** — La révélation est tracée côté serveur (`phoneReveal`) : la faire figurer dans
  l'historique admin du deal (`/admin/deals/:id/history`) — petit.
- **MSG-14** — Bon : jamais de `tel:` hors du fil. Le libellé « Appeler » promet un appel ; « Voir le
  numéro » serait plus honnête — petit.
- **MSG-15** — Sept libellés différents pour le même geste (« Envoyer un message à Thomas », « Message
  à Thomas », « Écrire à Aminata »…) : un composant `ContactThreadButton` partagé — petit, et il
  supprime la classe de défaut « bouton qui ne mène nulle part ».
- **MSG-16** — Le signalement ne prévient pas l'auteur (bien) ni le signaleur d'une suite : un email
  « ton signalement est clos » à la revue admin — moyen.
- **MSG-17/18** — Bon. Prévoir « modifier dans les 2 minutes » (typo) sans supprimer, avec historique ?
  À trancher, pas urgent.
- **MSG-19** — Le fil en lecture seule pendant un litige n'offre pas de lien vers la médiation : un
  bouton « Donner ma version » (dossier) — petit.
- **MSG-20** — La fenêtre de 14 jours est un réglage D62 (`messaging.writeDaysAfterEnd`) : l'afficher
  dans le bandeau (« fermée depuis le … ») — petit.
- **MSG-21** — La relance ne cite pas le message (bon, D61 6A) ; elle pourrait citer le prénom et
  l'heure du dernier message — petit. `relance-eligible` remet `lastReadAt` à null : le compteur
  de non-lus grimpe (8) — c'est l'outil de recette, pas le produit.
- **MSG-22** — Le 403 est propre ; l'écran pourrait proposer « Retour à mes conversations » — petit.
- **Transversal** — Quatre anomalies dont une BLOQUANTE sur une garde de sécurité (ANO-WEB-46) :
  la règle pure avait ses tests, mais aucun test n'essayait la forme « 742 891 » ; règle de revue :
  **tout filtre de sécurité se teste avec ses contournements évidents** (séparateurs, casse, accents,
  homoglyphes). Et deux fois le même motif (ANO-WEB-45) : le `message` anglais de l'API affiché au
  membre — un `grep "response?.data?.message"` dans le front en trouvera d'autres.

### Pièges de poste payés ici

- **La bulle de l'en-tête se lit AVANT d'ouvrir la messagerie** : sur écran large, le premier fil
  s'ouvre seul et se marque lu.
- **`getByText` compte la zone de saisie** (sa valeur) : « le message n'apparaît pas dans le fil » se
  prouve par l'absence de BULLE (`.justify-end, .justify-start`), pas par un compte de textes.
- **Les motifs de signalement sont une liste déroulante** (`selectOption`), pas des radios.
- **Deux fils confirment deux fois** : après une re-proposition acceptée, deux lignes « Le
  rendez-vous est confirmé. » — `.last()`.
- **Le limiteur de la passerelle** : après treize passages d'un chapitre à trois comptes connectés
  par l'écran, `POST /auth/login` répond 429 — relancer la passerelle (en bundle : `cd apps/api-gateway
  && node --env-file=../../.env dist/main.js`) remet les compteurs à zéro.
- **Les crons du poste écrivent aux comptes du seed** (versement « 26,00 € en route… ») : « il n'est
  pas prévenu » se prouve sur le SUJET des emails, pas sur leur absence.
- **`nx serve` recompile message-service à chaud** ; la passe `relance.ts` importe le service : elle
  tourne avec le code du disque, pas avec le bundle servi.

## Chapitre 5.16 — Prise en charge et jalons de transit · **CONFORME** (10 fiches jouées, 5 après correction · 5 anomalies closes dont 1 MAJEURE, 1 mineure ouverte · 8 scénarios en série, 1 min 48)

`web-pic.spec.ts`. `bzv-accepted` (Pauline ↔ Thomas) pour la prise en charge puis le transit,
`yul-accepted` (Marie-Claire ↔ Marc) pour le refus ; ImageKit intercepté, deal-service en FAKE ; les
jalons sont attendus sur la REQUÊTE (cinq secondes de repentir chacun), jamais sur un délai.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-PIC-1 | L'écran « Prise en charge du colis » | **Conforme après correction** → `ANO-WEB-49` (« qu'Pauline »), `ANO-WEB-50` (« la remise à Brazzaville ») ; depuis « Mon Deal accepté », « Confirmer la prise en charge » → `/pickup` ; titre, avertissement et sa phrase ; « Ce que Pauline a déclaré » (Catégorie Vêtements, Poids 5 kg, Valeur 120 €) ; « CONFIRMATION » avec « Vérification » et « Photos » ; les deux boutons. **Constat** : le sous-titre sur écran large est « Paris · le 21 sept. · 16h00 · face à Pauline L. » (la phrase du cahier est le sous-titre mobile) |
| WEB-PIC-2 | La checklist en cinq points | **Conforme après correction** → `ANO-WEB-51` ; les cinq textes exacts (« …à ce que Pauline a déclaré », « (5 kg) »), « Coche chaque point après vérification physique », cinq `aria-pressed` ; 3/5 : bouton inactif + « Coche les 5 points de vérification avant de confirmer » |
| WEB-PIC-3 | Les photos obligatoires | **Conforme après correction** → `ANO-WEB-51` ; 5/5 sans photo : inactif + « Ajoute au moins 1 photo avant de confirmer », badge « Au moins 1 obligatoire », aide « Recommandé : 1 photo du contenu déballé et 1 photo du colis emballé prêt au transport. » ; une photo → actif |
| WEB-PIC-4 | L'échec d'un téléversement | **Conforme après correction** → `ANO-WEB-52` ; > 10 Mo : « Une photo dépasse 10 Mo… — rien n'a été envoyé. », aucune vignette ; réseau coupé (ImageKit abandonné) : « Le téléversement d'une photo a échoué… — rien n'a été envoyé. » au clic « Confirmer », aucun appel de prise en charge, le deal reste ACCEPTED. **Constat** : les photos partent à la CONFIRMATION, pas à l'ajout (l'intention « rien n'est enregistré » est tenue) |
| WEB-PIC-5 | Confirmer la prise en charge | **Conforme** — tags « Contenu » / « Emballé », note ; toast « Prise en charge confirmée ! Pauline a reçu son code de livraison. » ; suivi de transit, « Clarisse Mabiala · Destinataire » avec le **vrai numéro** ; Pauline : notification « Thomas a pris ton colis en charge » / « …ton code de livraison est prêt dans ton suivi », email « Ton colis Paris → Brazzaville est pris en charge » **sans le code**, le code à six chiffres dans son suivi ; le code **nulle part côté Voyageur** |
| WEB-PIC-6 | Refuser le colis | **Conforme** — « Refuser ce colis ? » / « Le Deal sera annulé et Marie-Claire intégralement remboursée. Refuser un colis non conforme ne pénalise jamais ta réputation. » ; **cinq** raisons (radios), aucun texte libre ; toast « Colis refusé. Marie-Claire a été notifiée et sera remboursée. » ; `CANCELLED`, `refundAmountCents` = total payé ; emails « n'a pas pu être pris en charge » (raison traduite) puis « Remboursement émis » avec le montant intégral ; kilos +7 ; profil public de Marc identique |
| WEB-PIC-7 | L'écran de transit | **Conforme** — « En transit vers Brazzaville » / « Colis pris en charge il y a … · vol prévu à … » ; une seule carte « Tu es à l'aéroport ? » / « Je suis à l'aéroport » (aucun autre jalon) ; « ÉTAPES DU VOYAGE » + « Optionnel » ; carte du destinataire avec le numéro et « WhatsApp » ; « TON PAIEMENT · Versé à J+4 après livraison ». **Constat** : le bouton d'appel porte le numéro (« +242061234567 »), pas « Appeler » |
| WEB-PIC-8 | Jalons ordonnés, non répétables | **Conforme** — aéroport → « Ton vol décolle ? » → décollage → « Tu as atterri ? » → atterrissage → « Clarisse t'a donné le code ? » + « Valider la livraison » ; après rechargement, aucun jalon passé n'est proposé, aucune dé-confirmation |
| WEB-PIC-9 | Les cinq secondes | **Conforme** — « Annuler » dans le toast → « Annulé, rien n'a été envoyé. », aucune requête, le jalon reproposé ; puis « C'est noté ! Pauline a été prévenue. » et la requête part |
| WEB-PIC-10 | Côté Expéditrice | **Conforme après correction** → `ANO-WEB-54` (clé i18n brute) ; aéroport : « Thomas est à l'aéroport » / « Prêt à embarquer · vol prévu à … », cloche, **aucun email** ; décollage : « En vol vers Brazzaville » / « Thomas a décollé à 17h06 · arrivée prévue à — » (→ `ANO-WEB-53` ouverte), cloche, **aucun email** ; atterrissage : « Thomas est arrivé à Brazzaville » / « Atterri à … · la remise à Clarisse approche », cloche « Thomas a atterri · préviens le destinataire », **un seul email** « Thomas a atterri… », sans le code |

### À trancher (produit)

- **Le délai de versement s'écrit de deux façons** : « payé 3 jours après la livraison validée » (suivi
  Expéditeur, plusieurs textes en dur) et « Versé à J+4 après livraison » (Voyageur, réglage). Une seule
  formule tirée du réglage `payout.delayDays` — petit, mais visible aux deux bouts.
- **Le sous-titre de la prise en charge** : « {lieu} · le {date} · {heure} · face à … » sur écran large ; la
  phrase du cahier n'est que mobile. Amender le cahier.
- **Le bouton d'appel du destinataire porte le numéro**, pas « Appeler » — amender le cahier ou le libellé.
- **Les photos partent à la confirmation** (pas à l'ajout) : l'échec réseau se voit au clic « Confirmer ».
  Cohérent avec « rien n'est enregistré » ; amender le cahier.
- **Le cahier élide lui-même** (« ce qu'{prénom} a déclaré ») : le corriger avec ANO-WEB-49.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **PIC-1** — Un « TODO Phase backend » survivait encore (ANO-WEB-50) : `grep -rn "split(\" \")\[0\]"
  apps/user-ui/src` pour lister les derniers — petit, définitif.
- **PIC-2** — Les cinq points sont cochables sans contrainte de temps ; horodater chaque coche
  (`checklist: [{ id, at }]`) donnerait une preuve de diligence en médiation — moyen.
- **PIC-3** — Une photo obligatoire, cinq au plus : suggérer la seconde (« et le colis emballé ? ») quand
  une seule est là — petit.
- **PIC-4** — Téléverser à la sélection (avec suppression ImageKit si retrait) plutôt qu'à la
  confirmation : l'échec se voit tout de suite, la confirmation devient instantanée — moyen (même
  proposition qu'en 5.12).
- **PIC-5** — Le code naît à la prise en charge et l'email renvoie au suivi (bon, D43) ; l'email
  pourrait porter un lien profond vers le suivi avec le prénom du destinataire — petit.
- **PIC-6** — Le refus rembourse intégralement et ne pénalise pas (prouvé) ; la raison choisie n'est
  pas visible du Voyageur après coup (écran fermé) — l'afficher dans le bandeau « Tu as refusé ce
  colis (raison) » — petit.
- **PIC-7** — La carte d'action unique est excellente ; le bandeau « vol prévu à » lit le départ du
  trajet ; ajouter le compte à rebours (`flightIn` existe en JSON) — petit.
- **PIC-8** — Les jalons sont ordonnés côté serveur (409 sinon) ; un jalon en retard (atterrissage
  confirmé 30 h après le vol) devrait au moins avertir — petit.
- **PIC-9** — Les cinq secondes vivent dans le client : fermer l'onglet perd la confirmation (dit par
  le cahier). Une file locale (`localStorage`) rejouée à la réouverture — petit.
- **PIC-10** — Un seul email (atterrissage) : bon. « arrivée prévue à — » (ANO-WEB-53) : figer
  `arrivalAt` dans l'instantané, comme `departureAt` — petit côté données, contrat à régénérer.
- **Transversal** — Quatre des six anomalies sont de la **copie non branchée ou dérivée** (textes
  jamais rendus, élision écrite dans le message, clé sans variable, prénom tiré d'un lieu) : un test
  de rendu des vues Voyageur avec un deal fixture (et `onError` de next-intl en échec dur en
  développement) les aurait toutes prises — moyen, le plus rentable de la campagne.

### Pièges de poste payés ici

- **La croix de fermeture d'une fenêtre porte aussi « Annuler » en `aria-label`** : viser le bouton
  texte (`exact: true`, `.last()`).
- **Le bouton d'appel du destinataire s'appelle par son numéro** (`getByRole("button", { name: "+242…" })`).
- **Le rapport HTML de Playwright** (`apps/e2e/rapport/index.html`) est écrasé à chaque passage et
  ne garde que le dernier fichier joué : lire les annotations tout de suite, ou les consigner dans le
  rapport de recette au fil de l'eau.
- **Les crons du poste écrivent aux comptes du seed** : « aucun email » se prouve sur le SUJET.

## Chapitre 5.17 — Le code de livraison · **CONFORME** (8 fiches jouées, 4 après correction · 5 anomalies closes dont 1 MAJEURE · 8 scénarios en série, 1 min 48)

`web-cod.spec.ts`. `bzv-accepted` (Pauline ↔ Thomas) pour « pas encore de code », `bzv-picked` (Aminata ↔
Thomas, code `742891`) pour tout le reste, `bzv-delivered` (João ↔ Thomas) pour l'après-remise. Le
presse-papiers est observé en mémoire de page, `window.open` est capturé (WhatsApp) ; les liens `sms:` /
`mailto:` ne sont pas cliqués (ils ouvriraient Messages / Mail du poste).

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-COD-1 | Le code n'existe pas avant la prise en charge | **Conforme** — carte « Ton code de livraison », badge « En attente », « Tu recevras ton code à 6 chiffres dès que Thomas confirmera la prise en charge de ton colis. Tu le transmettras à Clarisse pour valider la livraison. » ; aucun groupe de chiffres, aucun bloc à six chiffres, ni « Copier » ni « Régénérer », le code du seed absent de la source |
| WEB-COD-2 | Le code apparaît chez l'Expéditrice seule | **Conforme** — Aminata : « CODE À TRANSMETTRE À CLARISSE », « 742 891 », « Copier le code », « Régénérer le code », « Garde ce code confidentiel. Tu peux le régénérer si tu penses qu'il a fuité. » ; Thomas : **neuf sources fouillées** (deal, écran de livraison, notifications — texte ET source HTML —, fil de messagerie, `GET /deals/:id`, `GET /notifications`) : aucune occurrence de `742891` ni de « 742 891 » |
| WEB-COD-3 | Copier le code | **Conforme après correction** → `ANO-WEB-55`, `ANO-WEB-59` ; toast « Code copié ! », presse-papiers = `742891` (sans espace) ; sans presse-papiers : « Copie impossible sur ce navigateur — sélectionne le code et copie-le à la main. » |
| WEB-COD-4 | Partager le code au destinataire | **Conforme après correction** → `ANO-WEB-56` ; « Partage le code à Clarisse » / « Le message est pré-rempli, tu n'as qu'à envoyer » ; message copié = « Bonjour Clarisse ! Ton colis arrive avec Thomas (Paris → Brazzaville). Pour le récupérer, donne-lui ce code : 742891. Bisous ! », « Message copié ! » ; WhatsApp → `wa.me/242061234567?text=<le message>` ; SMS et Email présents, objet « Code de retrait de ton colis Yamba » lu au catalogue. **Constat** : « Message copié ! » est un libellé de bouton (et depuis ANO-WEB-55 un toast) ; `sms:` / `mailto:` non cliqués |
| WEB-COD-5 | Régénérer le code | **Conforme après correction** → `ANO-WEB-57` ; « 5 régénérations restantes » ; « Régénérer le code ? » / « L'ancien code ne fonctionnera plus. Pense à renvoyer le nouveau à Clarisse. » / « Annuler » (referme) / « Oui, régénérer » ; toast « Nouveau code généré ! N'oublie pas de le renvoyer à Clarisse. » ; nouveau code à six chiffres ≠ 742891 ; « 4 régénérations restantes » ; après rechargement le code affiché est le nouveau, l'ancien absent ; email « Nouveau code pour ton envoi Paris → Brazzaville » (« Un nouveau code a été généré », « Il te reste 4 régénération(s) ») **sans l'ancien ni le nouveau code** ; Thomas : aucun email de régénération |
| WEB-COD-6 | Le plafond de cinq régénérations | **Conforme après correction** → `ANO-WEB-57`, `ANO-WEB-58` ; 4 → 3 → 2 → 1 régénération restante, puis « Aucune régénération restante » et le bouton inactif ; essai forcé par l'API : 409 `CODE_REGENERATION_LIMIT` ; essai forcé par l'écran (second onglet resté sur « 1 restante ») : 409 relu, « Tu as atteint la limite de régénérations. Contacte le support si besoin. », le code inchangé après rechargement |
| WEB-COD-7 | Le Voyageur ne régénère pas | **Conforme** — quatre écrans (deal, livraison, accepté, prise en charge) : aucun bouton ni lien de régénération, le mot n'est pas rendu, l'appel `code/regenerate` absent de la page. **Constat** : la SOURCE des pages Voyageur porte tout le catalogue `bookingTracker` (textes de l'Expéditeur compris) — sérialisation next-intl |
| WEB-COD-8 | Après la remise, le code disparaît | **Conforme** — « Code de livraison saisi par Thomas et validé », badge « Code validé » (nom accessible), plus de « CODE À TRANSMETTRE », aucun bloc à six chiffres, ni « Copier » ni « Régénérer », le code du seed absent de la source |

### À trancher (produit)

- **« Message copié ! » / « Code copié ! »** : le cahier attend des toasts ; l'écran changeait le libellé ou
  l'icône. Les deux existent désormais (ANO-WEB-55) — amender le cahier ou retenir une seule forme.
- **SMS et Email** ne sont pas cliqués par le harnais (ils ouvrent les applications du poste) ; l'objet est
  vérifié au catalogue. Des liens `<a href="sms:…">` / `<a href="mailto:…">` les rendraient prouvables sans
  clic (regard d'expert COD-4).
- **Le badge « Code validé »** est une icône dont « Code validé » est le nom accessible (`aria-label`,
  `title`), pas un texte visible — amender le cahier ou rendre le texte.
- **« Livraison estimée — »** sur le suivi d'Aminata (bzv-picked) : même cause qu'ANO-WEB-53 (instantané sans
  `arrivalAt`), déjà ouverte.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **COD-1** — La carte « En attente » est juste ; son en-tête de fichier dit encore « plus tard ce
  composant affichera le code » alors qu'une autre carte le fait : rafraîchir le commentaire, et proposer
  dès ce stade « prévenir Clarisse qu'un code va arriver » (le numéro est déjà là) — petit.
- **COD-2** — Neuf sources fouillées à la main ; la vraie garantie est la liste blanche du DTO Voyageur :
  un test qui énumère les clés INTERDITES (`deliveryCode`, `deliveryCodeEncrypted`, `deliveryCodeHash`)
  sur chaque DTO non-Expéditeur, s'il n'existe pas déjà, vaut plus que toute fouille — petit.
- **COD-3** — `navigator.clipboard` n'existe qu'en contexte sécurisé : sur le LAN en http, la copie est
  impossible (ANO-WEB-59 dit désormais pourquoi). Un repli par sélection du texte (`Selection` +
  `execCommand("copy")`, encore supporté) rendrait la copie possible partout — petit.
- **COD-4** — Quatre boutons JS pour quatre liens : des `<a href>` (`wa.me`, `sms:`, `mailto:`) donnent
  le clic droit, l'appui long, le clavier, aucun JS, et un harnais qui lit l'`href` sans ouvrir Mail —
  petit ; et si l'email du destinataire est saisi à la réservation, le mettre dans `mailto:` — petit.
- **COD-5** — L'email de sécurité est bon (D43 : jamais le code) ; la régénération n'a PAS de
  notification dans la cloche (`booking.code_regenerated: "NONE"`) — un événement de sécurité mérite
  une ligne en cloche — petit.
- **COD-6** — Le plafond `MAX_CODE_REGENERATIONS = 5` est une constante partagée front / serveur : la
  porter au catalogue des réglages (`delivery.maxCodeRegenerations`, D62) et la servir dans le DTO
  Expéditeur (`codeRegenerationsLeft`) pour que le front n'écrive plus « 5 » — moyen.
- **COD-7** — next-intl sérialise TOUT l'espace `bookingTracker` dans chaque page, écrans Voyageur
  compris (textes de l'Expéditeur, mots-clés de l'autre rôle) : sélectionner les espaces par route
  (`getMessages` + `pick`) allège les pages et cloisonne la copie — moyen.
- **COD-8** — Le badge « Code validé » n'est lisible que par un lecteur d'écran : rendre le texte à
  côté de l'icône — petit.
- **Transversal** — Trois des cinq anomalies sont encore de la copie non branchée ou du **retour
  d'action qui n'existe que dans un état transitoire** (toast jamais rendu, compteur enfermé dans une
  boîte de confirmation, erreur serveur traduite puis ignorée). Règle à tenir : tout retour du serveur
  qui porte un `details.code` traduit DOIT avoir un lecteur ; le test de rendu des vues avec un deal
  fixture (proposé en 5.16) prendrait les deux premiers en une seconde — moyen.

### Pièges de poste payés ici

- **Les toasts s'empilent cinq secondes** : deux régénérations rapprochées = deux « Nouveau code
  généré ! » — viser `.last()`.
- **Le client rejoue une requête après un 401** (jeton de la session mémorisée expiré, rafraîchi par
  `api-client`) : `waitForResponse` doit ignorer le 401 et attendre la réponse définitive, sinon le test
  lit « 401 » pour un geste qui a réussi.
- **Un bouton dé-grisé à la main n'est pas un essai forcé** : React ré-applique `disabled` au rendu
  suivant. L'essai forcé honnête est un second onglet resté sur l'état d'avant.
- **« Absent de la source » ne vaut rien sur une page next-intl** : le catalogue entier y est sérialisé.
  Viser le chemin d'API (`code/regenerate`) et l'interface rendue, pas un libellé.
- **Ne jamais cliquer `sms:` / `mailto:`** sur le Chrome du poste : Messages et Mail s'ouvrent.
- **Les crons écrivent aux comptes du seed** (versement à Thomas pendant l'attente) : l'absence d'email
  se prouve sur le SUJET.

## Chapitre 5.18 — La remise du colis · **CONFORME** (7 fiches jouées, 2 après correction · 2 anomalies closes dont 1 MAJEURE · 7 scénarios en série, 55 s)

`web-rem.spec.ts`. `sgn-picked` (Mai ↔ Linh, destinataire Đức, code `742891`, un jalon confirmé) pour la
remise ; `bzv-picked` (Aminata ↔ Thomas) pour l'absence d'annulation. ImageKit intercepté (aucun envoi
réel) ; le verrou de 15 minutes n'est jamais attendu : c'est la régénération côté Expéditrice qui le lève
(règle serveur, D43).

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-REM-1 | L'écran « Livraison à Đức » | **Conforme après correction** → `ANO-WEB-60` ; depuis le suivi de transit (« Ton vol décolle ? » proposé), « Valider la livraison » → `/deliver` ; « Livraison à Đức » / « Hô Chi Minh-Ville · à valider avec le code » ; l'encart exact (« …le code de livraison que Mai lui a communiqué… ») ; « CODE DE LIVRAISON REÇU PAR ĐỨC », six cases « Chiffre 1 » à « Chiffre 6 » en 3 · 3, bouton inactif tant que vide ; l'aide « Đức ne se souvient plus du code ? » et ses trois puces ; « Tentative 1 sur 3 ». **Constat** : l'encart et l'aide accordent le destinataire au féminin (« Si elle… », « qu'elle… ») quel que soit le prénom |
| WEB-REM-2 | Un code faux et le compteur d'essais | **Conforme après correction** → `ANO-WEB-61` ; `000000` → 409 `DELIVERY_CODE_INVALID`, « Ce code n'est pas le bon. Vérifie avec Đức et réessaye. », « 2 tentatives restantes » ; ressaisie → « Tentative 2 sur 3 » ; `111111` → « Dernière tentative » ; « Tentative 3 sur 3 ». Côté Mai : `GET /me/notifications` identique avant / après — un essai raté n'est pas un événement |
| WEB-REM-3 | Le verrou de 15 minutes | **Conforme** — troisième faux → 409 `DELIVERY_LOCKED`, « Trop de tentatives. Saisie bloquée pendant 15 min pour des raisons de sécurité. », « Réessaye dans 14:5x », cases inertes ; **après rechargement, le verrou est toujours là** (le compteur vit sur le serveur) ; le BON code `742891` par l'API → 409 `DELIVERY_LOCKED` avec `lockedUntil`, le deal reste `PICKED_UP` |
| WEB-REM-4 | Une régénération lève le verrou (deux navigateurs) | **Conforme** — Mai régénère (carte compacte de la phase voyage) ; Linh recharge : plus de verrou, « Tentative 1 sur 3 », cases actives ; l'ancien code est refusé (« 2 tentatives restantes ») |
| WEB-REM-5 | La photo de remise est facultative | **Conforme** (ImageKit intercepté, le cahier dit ⏭) — « Une photo de la remise ? », badge « Optionnel », le texte « …cette photo parle pour toi. », « Jusqu'à 2 photos. Elles sont visibles par l'Expéditeur dans son suivi et par Yamba en cas de litige. » ; deux photos envoyées à la sélection (avant toute saisie), plus d'« Ajouter », une troisième sélection ignorée, aucun « Échec d'envoi » |
| WEB-REM-6 | Le bon code vaut livraison | **Conforme** — nouveau code + une photo → 200, « Livraison validée ! » / « Bravo, tu as remis le colis à Đức. Mai vient d'être prévenue. » ; « Ton versement arrive » / « 28 € partiront vers ton compte après la période de vérification de l'Expéditeur, le mercredi 16 septembre au plus tard, puis arriveront sur ton compte bancaire sous 2 à 7 jours. » ; « Voir le récap du Deal », « Retour à l'accueil », **aucun « Noter »** ; `DELIVERED` ; Mai : cloche « Colis remis · vérifie avant le … », email « Ton colis Paris → Hô Chi Minh-Ville a été livré » avec « 3 jours », sans le code ; Linh : cloche « Livraison validée » / « versement après la vérification de Mai », **aucun email** |
| WEB-REM-7 | Aucune annulation après la prise en charge | **Conforme** — « Mes envois » : la ligne du deal pris en charge n'a pas d'« Annuler » (les envois en attente / acceptés le gardent) ; suivi : aucun « Annuler », « Signaler un colis non livré » seul ; Voyageur : aucun ; API : 409 `TRANSITION_NOT_ALLOWED` (Expéditrice), 403 (Voyageur), statut inchangé |

### À trancher (produit)

- **Le destinataire est toujours « elle »** (« Si elle ne le retrouve pas », « Vérifie qu'elle a bien Mai »,
  « (Đức absente, refus, etc.) ») : le cahier a la même forme. Neutraliser (« Si le destinataire ne le
  retrouve pas ») ou porter un genre à la réservation.
- **L'email de remise** a pour objet « Ton colis … a été livré » ; « 3 jours pour confirmer ou signaler » est
  dans le corps. Le cahier nomme l'email par cette phrase — amender le cahier, ou porter l'action dans l'objet.
- **La photo de remise part à la sélection** (l'inverse de la prise en charge, 5.16) : aligner les deux écrans.
- **Refus d'annulation** : 409 pour l'Expéditrice, 403 pour le Voyageur — deux codes pour le même « non ».

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **REM-1** — Six cases avec `autocomplete="one-time-code"` sur la première et collage géré : bien.
  Grouper les cases (`role="group"`, `aria-describedby` vers l'erreur) pour qu'un lecteur d'écran lise
  « Ce code n'est pas le bon » au bon moment — petit.
- **REM-2** — Le serveur compte (A38) et le client ne fait que refléter : juste. Journaliser les essais
  ratés dans l'historique admin du deal (horodatage, jamais le code saisi) donnerait une preuve en
  médiation « il a tenté trois codes avant de signaler » — moyen.
- **REM-3** — `MAX_DELIVERY_ATTEMPTS = 3` et `DELIVERY_LOCK_MINUTES = 15` sont des constantes : les
  porter au catalogue des réglages (`delivery.maxAttempts`, `delivery.lockMinutes`, D62) et les servir
  dans le DTO Voyageur pour que l'écran n'écrive plus « 15 » — moyen (même famille que COD-6).
- **REM-4** — Régénérer lève le verrou et remet les essais à zéro : voulu (D43), mais invisible pour
  l'Expéditrice. Le dire dans la boîte de confirmation (« …et débloque la saisie du Voyageur ») — petit.
- **REM-5** — Photos envoyées à la sélection ici, à la confirmation en 5.16 : un seul composant de
  photos pour les deux écrans (upload à la sélection, retrait = suppression ImageKit) — moyen.
- **REM-6** — La date du versement est calculée dans le client à partir de `payoutDelayDays` du DTO :
  correct, mais `payoutDueAt` existe côté serveur — le servir et l'afficher tel quel évite deux
  horloges — petit. L'objet de l'email devrait porter l'action attendue (« 3 jours pour confirmer »)
  — petit.
- **REM-7** — Le refus d'annulation répond 409 à l'une et 403 à l'autre ; les deux sont parties au deal,
  un seul `details.code` (`TRANSITION_NOT_ALLOWED`, 409) suffirait et ne révèle rien — petit.
- **Transversal** — Les deux anomalies sont des **impasses d'état** : une étape « optionnelle » qui
  verrouillait le chemin principal (REM-1), une erreur qui ne se libérait jamais et un effet déclenché
  par un texte identique (REM-2). Règle : tout état qui masque l'action principale doit avoir une
  sortie explicite ; un test unitaire de `DeliverOtpInput` (deux erreurs identiques → deux secousses,
  ressaisie → l'erreur s'efface) l'aurait dit — moyen.

### Pièges de poste payés ici

- **La liste des notifications est `GET /me/notifications`**, pas `/notifications` — et la fiche COD-2
  gardait ce chemin derrière un `if (ok)` qui rendait la preuve silencieuse. Ne jamais garder une preuve
  derrière une condition : corrigé dans les deux chapitres.
- **Le suivi Expéditrice change de forme avec un jalon confirmé** : carte compacte, code en texte
  « 742 891 », bouton « Régénérer » — le page object lit les deux formes.
- **Après une régénération, la carte relit le serveur** (`invalidateQueries`) : attendre que le code
  affiché CHANGE (`expect.poll`), pas seulement le toast.
- **« le mercredi 16 septembre »** : la date du versement porte le jour de la semaine, pas l'année.
- **« Mes envois » porte « Annuler » sur les autres lignes** : viser la ligne par son lien.
- **L'`input[type=file]` caché survit au plafond** : prouver « deux au plus » par une troisième sélection
  ignorée, pas par l'absence de l'input.
- **Le statut du deal n'est pas à la racine de la réponse** : lire le texte brut (`"status":"PICKED_UP"`).

## Chapitre 5.19 — Confirmation, complétion et versement · **CONFORME** (11 fiches jouées, 4 après correction · 6 anomalies dont 4 closes (1 MAJEURE) et 2 ouvertes (1 MAJEURE, API) · 13 scénarios en série dont 2 `test.fail`, 2 min 54)

`web-cnf.spec.ts`. `bzv-delivered` (João ↔ Thomas, destinataire Clarisse) pour la lecture et la confirmation
anticipée ; `yul-delivered` (Aminata ↔ Marc) pour le rappel, l'après-J+4 et la complétion automatique ;
`bzv-completed-blocked` (Aminata ↔ Thomas, versement en échec « compte Stripe incomplet ») et `bzv-reversed`
(Pauline ↔ Thomas). Les deux passes du cron `payout-bookings` sont FORCÉES (`scripts/recette/payout.ts
reminder` / `due`) sur le fournisseur FAKE, après une manœuvre de date (`scripts/recette/livraison-ancienne.ts
<id> <jours>` recule `deliveredAt` ET `payoutDueAt`). L'ordre de jeu diffère du cahier (un seul deal livré par
rôle) : 1, 11, 2 puis 4, 5, 3 puis 6, 7, 8, 9, 10.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-CNF-1 | Le suivi d'un colis livré | **Conforme** — « Ton colis a été livré à Clarisse » / « Confirmé hier à 9h07 par Thomas avec le code à 6 chiffres » ; « Période de vérification » / « Tu as 3 jours pour t'assurer… » ; « VERSEMENT AUTOMATIQUE DANS 2 jours · 23h », carte slate (aucune classe rouge) ; « Tout s'est bien passé ? » avec un bouton **secondaire** (`border-emerald-300 bg-white`, jamais le mango ni un fond plein) et le conseil ; « RÉCAP DE LA LIVRAISON » / « COLIS LIVRÉ » / « REMIS À CLARISSE MABIALA » / « Code de livraison saisi par Thomas et validé » / « PHOTOS DE TRAÇABILITÉ » ; « Comment ça marche » et ses trois cas ; « Quelque chose ne va pas avec ce colis ? » / « Signaler un problème » — le geste par défaut est bien de ne rien faire |
| WEB-CNF-2 | La confirmation anticipée est définitive | **Conforme** — l'avertissement « Cette action est définitive… » lisible AVANT le clic ; « Confirmer définitivement ? » / « Thomas sera payé immédiatement… » / « Oui, tout est OK » / « Annuler » ; `POST /confirm` → 200 `COMPLETED`, `payoutStatus: SENT` (FAKE), net 55,00 € ; toast « Merci ! Thomas va recevoir son paiement. » ; « Envoi terminé » / « Tu as confirmé la livraison le … » / « Transaction close » ; la carte de signalement et le bouton ont disparu, « Cette transaction est close… » ; João : email « Transaction terminée pour ton envoi Paris → Brazzaville » ; Thomas : cloche « 55,00 € partis vers ton compte » et email « 55,00 € en route vers ton compte pour Paris → Brazzaville » (« sous 2 à 7 jours ») |
| WEB-CNF-3 | La complétion automatique à J+4 (cron) | **Conforme** (passe `due` forcée) — `COMPLETED` par `SYSTEM` ; « Envoi terminé » / « Période de vérification terminée le 8 septembre à 04:37, sans signalement de ta part. » / « Transaction close » / « Le paiement de Marc est libéré » ; note du paiement « La période de vérification est terminée — les fonds sont en cours de versement à Marc. » (ANO-WEB-64) ; Marc : « Deal terminé », « 18,00 € partis vers ton compte » ; emails « Transaction terminée » (Aminata, « …terminée sans signalement de ta part ») et « 18,00 € en route vers ton compte » (Marc) |
| WEB-CNF-4 | Le rappel de la veille (cron) | **Conforme** (passe `reminder` forcée deux fois : 1 puis 0) — cloche « Dernier jour pour vérifier ton colis » / « Paris → Montréal · sans action, le paiement de Marc part le … », UNE seule pour ce deal ; email « Dernier jour pour vérifier ton colis Paris → Montréal » (« Si tout va bien, tu n'as rien à faire »), un seul ; le deal reste `DELIVERED` |
| WEB-CNF-5 | Après J+4, ni confirmation ni signalement | **Conforme avec réserve** → `ANO-WEB-63` ; « Signaler un problème » et sa carte absents, compte à rebours « 0h », `allowedActions` sans `dispute` ; signalement forcé → 409 `TRANSITION_NOT_ALLOWED` « The verification period has ended » ; **mais « Confirmer la livraison » reste proposé** (`allowedActions = ["confirmEarly"]`, scénario 5 bis en `test.fail`) |
| WEB-CNF-6 | L'Expéditrice ne voit jamais un échec de versement | **Conforme après correction** (écrans) → `ANO-WEB-64`, `ANO-WEB-65` ; suivi : « Envoi terminé » / « Transaction close » / « Le paiement de Thomas est libéré », aucun « échec », « en attente », « Stripe », « compte de paiement » (la description du colis du seed, qui dit elle-même « compte Stripe incomplet », est retirée avant la chasse) ; Paiements : « Envoi Paris → Brazzaville · Thomas » / « Libéré le 9 sept. · transaction close », la page ne parle jamais de Stripe. **Mais l'API brute sert `"payoutStatus":"FAILED"` à l'Expéditrice** → `ANO-WEB-62` (scénario 6 bis en `test.fail`) |
| WEB-CNF-7 | Le versement en attente vu du Voyageur | **Conforme après correction** → `ANO-WEB-66` ; deal : « Deal terminé » / « Transaction close », carte ambre « 26,00 € en attente : finalise ton compte Stripe » + le texte exact + bouton « Finaliser mon compte Stripe » ; Mes trajets : bandeau `role=status` « 26,00 € en attente : finalise ton compte Stripe » / « Finaliser mon compte » (total = `blockedCents` du serveur), ligne « Terminé · 26,00 € en attente : finalise ton compte Stripe » ; Portefeuille : carte « En attente 54,00 € Compte Stripe, signalement ou envoi en cours », ligne « Transport pour Aminata · Paris → Brazzaville » / « En attente : finalise ton compte Stripe » / « + 26,00 € » ; aucune chaîne technique (`NOT_READY`, `payouts_enabled`, `capabilit`, `account_`) sur les trois écrans |
| WEB-CNF-8 | Le versement renversé | **Conforme** — « 30,00 € : versement sous examen » / « Le transfert a été renversé par notre prestataire de paiement. Rien n'est perdu : nous te contactons pour le régulariser. » ; aucun « renvoyer / réessayer / relancer », aucun CTA Stripe ; Portefeuille : « Transport pour Pauline · Paris → Brazzaville » / « Sous examen · transfert renversé, on te contacte » |
| WEB-CNF-9 | Le portefeuille du Voyageur | **Conforme** — « Finances » / « Tes paiements, gains et versements — tout vient de tes deals, rien n'est estimé. » ; « À venir 0,00 € Livraisons en vérification », « Envoyés 90,00 € + 90,00 € ce mois », « En attente 54,00 € Compte Stripe, signalement ou envoi en cours » = `GET /me/wallet` ; six lignes, chacune à son état exact (SENT « Parti le … · 2 à 7 jours » ×2, BLOCKED, FROZEN « Gelé · signalement en cours », HELD « Retenue conservée · on te contacte », REVERSED), libellés « Transport pour {prénom} » et « Compensation · annulation tardive de Aminata » (montant « — ») ; « Voir mes virements sur Stripe » + « Dates d'arrivée, RIB et historique… » ; aucune donnée de maquette (89,30, Aminata T., Josué, IBAN) |
| WEB-CNF-10 | Les paiements de l'Expéditrice | **Conforme après correction** → `ANO-WEB-67` ; « Bloqué chez Yamba {n} Libéré à la fin de chaque transaction », « Dépensé », « Remboursé » = serveur ; six lignes : AUTHORIZED « Autorisé, pas débité · en attente du Voyageur », HELD « Bloqué chez Yamba », RELEASED « Libéré le … · transaction close » ×2, PARTIALLY_REFUNDED « Remboursé 14,56 € le … · retenue 14,56 € reversée au Voyageur », REFUNDED « Remboursé 33,60 € le … » ; `heldCents` = Σ des lignes HELD (rien n'est recalculé à l'écran) |
| WEB-CNF-11 | Aucune fausse carte bancaire | **Conforme** — « TON PAIEMENT » : « Débité 61,60 € », « État Bloqué jusqu'à J+4 », la note ; jamais « Visa », « Mastercard », « •• », « 4242 », « Sur ton relevé », « CB » (le mapper laisse `cardBrand` / `cardLast4` / `statementDescriptor` vides tant que Stripe ne les sert pas) |

### Anomalies

- **ANO-WEB-62 (MAJEURE, OUVERTE — API)** — la vue Expéditeur de `GET /deals/:id` porte `payoutStatus` /
  `payoutSentAt` (`FAILED` sur `bzv-completed-blocked`), et `ConfirmDealResponse` rend `payoutStatus` à
  l'Expéditeur qui confirme. Les écrans n'en montrent rien (fiche 6 conforme), mais le cahier qualifie de
  bloquante « toute fuite de l'état du versement du Voyageur vers l'Expéditeur », et une réponse brute est
  une fuite. Le contrat le dit voulu (« both roles read it », A68) : à trancher au registre — proposition :
  retirer les deux champs de la vue Expéditeur et de la réponse de confirmation (le front Expéditeur ne les
  lit pas), OpenAPI régénéré, PR dédiée (D-next).
- **ANO-WEB-63 (mineure, OUVERTE — machine)** — après `payoutDueAt`, la machine retire `dispute` mais laisse
  `confirmEarly` : « Confirmer la livraison » reste proposé (avec « Tu n'as pas besoin d'attendre 3 jours »
  alors que les trois jours sont passés) tant que le cron n'est pas passé (≤ 5 min). Le cahier n'attend ni
  confirmation ni signalement. Proposition : garde `beforePayoutDue` sur `confirmEarly` (la transition
  appartient alors au SYSTÈME), test de machine, registre.
- **ANO-WEB-64 (mineure, close)** — sur un deal clos PAR LE SYSTÈME, le bloc « TON PAIEMENT » disait « Tu as
  confirmé la livraison — les fonds sont en cours de versement » : la note suit `completedBy`
  (`noteReleasedAuto` FR / EN : « La période de vérification est terminée — … »).
- **ANO-WEB-65 (mineure, close)** — « Comment s'est passé ton Deal avec Thomas ? Tu as jusqu'au . » :
  `RatingStatusCard` formatait une échéance absente ; sans date, la phrase sans date (`promptTextNoDate`), et
  le seed pose `ratingWindowEndsAt` sur les deals `-blocked` / `-reversed` comme sur les autres.
- **ANO-WEB-66 (MAJEURE, close)** — le bandeau « {montant} en attente : finalise ton compte Stripe » (A75)
  n'était rendu que par l'ancien `TripsClient` (et seulement sur sa page VIDE) ; la page réelle
  `/dashboard/trips` (`MyTripsList`) ne le posait jamais : un Voyageur au versement bloqué ne le voyait pas.
  Posé en tête de la liste (et sur la page pleine de `TripsClient`).
- **ANO-WEB-67 (mineure, close)** — Paiements : « Remboursé 33,60 € le » sans date pour un envoi annulé
  sans `refundedAt` (seed `bzv-cancelled`) ; `wallet.service` replie sur `updatedAt` (REFUNDED et
  PARTIALLY_REFUNDED), +1 test deal-service = **577**.

### À trancher (produit)

- **`payoutStatus` servi aux deux rôles** (A68) contre « aucune fuite vers l'Expéditeur » (cahier) — voir
  ANO-WEB-62.
- **Confirmer après J+4** — voir ANO-WEB-63 ; si la confirmation reste permise, amender le cahier et changer
  le texte de la carte (« Tu n'as pas besoin d'attendre 3 jours ») après l'échéance.
- **Deux horloges** : le compte à rebours et « J+n » sont calculés dans le navigateur à partir de
  `deliveredAt` + 4 jours, alors que `payoutDueAt` est servi ; une manœuvre qui ne bouge que `payoutDueAt`
  fait mentir l'écran (d'où `livraison-ancienne.ts` qui recule les deux). Servir et afficher `payoutDueAt`.
- **L'objet des emails de complétion** porte le corridor (« Transaction terminée pour ton envoi Paris →
  Brazzaville ») ; le cahier les nomme par leur titre. Amender le cahier.
- **« Versement parti » côté Expéditeur** : le catalogue front a une entrée `booking_payout_sent.SHIPPER`
  (« Versement parti ») que le consommateur ne sert jamais (CARRIER seul, D52) — clé morte à retirer, ou
  décision de prévenir l'Expéditeur (ce serait une fuite de plus).

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **CNF-1** — Le bouton secondaire et la lecture d'abord : juste. Le compte à rebours recalcule chaque
  minute côté client à partir de `deliveredAt` ; afficher `payoutDueAt` servi (« versement le mardi 16
  septembre à 9h ») dit la même chose sans dérive d'horloge et sans arithmétique locale — petit.
- **CNF-2** — La réponse de confirmation rend `payoutStatus` à l'Expéditeur (SENT / FAILED) ; l'écran ne
  s'en sert pas — la retirer ferme ANO-WEB-62 pour cette route sans rien perdre — petit. Le toast et l'écran
  « Transaction close » arrivent dans le même rendu : bien.
- **CNF-3** — La complétion automatique et la confirmation manuelle partagent les effets (transfert, notif,
  invitation à noter) : une seule fonction de règlement, deux acteurs — bonne architecture. Journaliser
  « cron passé à {heure}, {n} deals » dans l'historique admin du deal donnerait la preuve « le système a
  clos » sans lire les logs — moyen.
- **CNF-4** — Le rappel est idempotent par `verificationReminderSentAt` avec un `where` d'exclusion (OR
  isSet) : le bon motif Mongo. Le libellé « Dernier jour » à 24 h est vrai à 23 h 59 comme à 0 h 01 :
  planifier l'envoi à `payoutDueAt − 24 h` exactement (file datée) plutôt qu'au premier tick sous l'horizon
  — moyen.
- **CNF-5** — `allowedActions` est la seule source de vérité de l'écran : bien. La garde `beforePayoutDue`
  manque sur `confirmEarly` (ANO-WEB-63) ; sa jumelle existe pour `dispute`, la symétrie coûte trois lignes
  et un test de machine — petit.
- **CNF-6** — Les écrans sont étanches, l'API ne l'est pas (ANO-WEB-62). La bonne coupe : le mapper
  Expéditeur ne connaît pas `payoutStatus` (liste blanche stricte, règle « jamais spread + delete ») — petit,
  mais contrat + OpenAPI + registre.
- **CNF-7** — Le bandeau vivait dans un composant orphelin (ANO-WEB-66) : un test de rendu de `MyTripsList`
  avec un deal `payoutBlocker` l'aurait dit. Plus largement, `TripsClient` (preview + section du tableau de
  bord) et `MyTripsList` (page réelle) sont deux listes de trajets : en garder une — chantier.
- **CNF-8** — « Sous examen » sans bouton : juste (A87). Dire au Voyageur le délai attendu (« nous te
  contactons sous 48 h ouvrées ») et un lien « Nous écrire » avec le numéro de deal — petit.
- **CNF-9** — Les cartes viennent du serveur et chaque ligne porte un état fermé (7 états) : très bien. La
  ligne HELD (« Retenue conservée · on te contacte ») affiche « — » comme montant : afficher le montant
  retenu en attente serait plus honnête — petit. Le lien Stripe passe par la porte sudo : bien.
- **CNF-10** — Même qualité côté Expéditeur ; ANO-WEB-67 tenait à une donnée absente, le repli est en place.
  Les cartes « Dépensé » / « Remboursé » n'ont pas de sous-titre : « Total des envois clos » / « Retours
  après annulation » alignerait les trois — petit.
- **CNF-11** — Le bloc n'invente rien : `cardBrand` / `cardLast4` / `statementDescriptor` sont absents du
  mapper « en attendant Stripe » (A37). Quand Stripe les servira, les faire passer par le DTO Expéditeur
  (jamais côté Voyageur) et ajouter le test « jamais 4242 avec FAKE » au serveur — petit.
- **Transversal** — Quatre anomalies sur six sont des **textes qui ne suivent pas la donnée** : une note qui
  suppose l'acteur (64), une date absente formatée (65, 67), un bandeau posé au mauvais endroit (66). Règle :
  chaque texte qui cite une donnée a un repli explicite quand elle manque, et chaque composant « transversal »
  (bandeau) est posé par la page, pas par une liste parmi d'autres. Un test de rendu par état (`completedBy`,
  `windowEndsAt: null`, `payoutBlocker`) coûte moins qu'une fiche de recette — moyen.

### Pièges de poste payés ici

- **Le deal-service FAKE rejoue les versements en échec** : le cron des 5 minutes fait PARTIR le versement
  « bloqué » du seed (transfert fictif toujours accepté) — `scripts/recette/versement-bloque.ts` refige
  `FAILED` / `CARRIER_ACCOUNT_NOT_READY` et repousse `payoutNextRetryAt` d'un jour, juste après le seed
  puis avant les fiches 6 / 7. Symétriquement, une échéance passée est complétée par le vrai cron dans les
  cinq minutes : la fiche 5 se joue tout de suite après la manœuvre, la fiche 3 accepte que le cron l'ait
  devancée.
- **Playwright pose `FORCE_COLOR`** : `console.log("x →", 0)` d'un script de recette imprime
  `[33m0[39m` et « 0 » se lit « 33 ». `FORCE_COLOR=0` + retrait des séquences ANSI dans
  `scriptDeRecette()`.
- **`tsx --env-file=.env` laisse gagner l'environnement du processus** : `STRIPE_SECRET_KEY=""` force le
  FAKE dans `payout.ts` même avec la clé réelle dans le `.env` (le même mécanisme que le bundle).
- **Les notifications survivent au seed** (les comptes ne sont pas recréés) : « une seule notification » se
  compte sur le lien du deal (`a[href*="<id>"]`), pas sur le texte.
- **L'espace avant « € » est FINE INSÉCABLE (U+202F)** dans les cloches et les objets d'email : un motif
  ` ?€` ne matche pas ; `[\s  ]?€`.
- **Les pages de suivi n'ont pas de `<main>`** : lire `body`, et retirer la description du colis du seed
  (« compte Stripe incomplet ») avant une chasse aux mots interdits.
- **`/dashboard/trips` rend `MyTripsList`, pas `TripsClient`** (qui ne sert que la prévisualisation et la
  section du tableau de bord) : corriger l'un sans l'autre ne change rien à l'écran.
- **Les deals sont repliés par trajet** (« n colis ») : un deal terminé vit sous un trajet de l'historique,
  `MesTrajets.ligneDuDeal()` déplie chaque trajet jusqu'à voir la ligne.

## Chapitre 5.20 — Les annulations · **CONFORME** (9 fiches jouées, 2 après correction, 1 avec réserve · 4 anomalies dont 2 closes et 2 ouvertes (1 MAJEURE : aucune annulation Voyageur) · 9 scénarios en série dont 1 `test.fail`, 3 min 18)

`web-ann.spec.ts`. `bzv-pending` (Aminata ↔ Thomas), `bzv-accepted` (Pauline ↔ Thomas, départ J+10),
`yul-accepted` (Marie-Claire ↔ Marc, trajet `yul` ramené à +24 h), un deal CRÉÉ PAR L'API sur `bzv-perkg`
(Aminata ↔ Thomas, accepté par l'API, trajet ramené à −24 h), `bzv-picked` / `bzv-delivered`, `gru-pending`
(João ↔ Inês). Les manœuvres de date déplacent le trajet ET l'instantané `booking.trip.departureAt` (le barème
lit l'instantané). Ordre de jeu : 8, 6, 1, 2, 4, 3, 5, 7, 9.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-ANN-1 | Annuler une demande en attente | **Conforme après correction** → `ANO-WEB-71` ; « Annuler cet envoi ? » / « Ta demande Paris → Brazzaville auprès de Thomas sera annulée définitivement. » / « Tu seras remboursée de 28,00 € » (= `cancellationPreview.refundCents` du serveur, retenue 0) / « Remboursement intégral : le paiement n'a pas encore été débité… » / « Garder l'envoi » + « Confirmer l'annulation » ; toast « Envoi annulé. », ligne « Annulée », kilos rendus (20 → 23) ; Aminata : email « Ta demande Paris → Brazzaville est annulée » ; Thomas : cloche « Aminata a annulé · … ta capacité est libérée », **aucun email** |
| WEB-ANN-2 | Annuler un deal accepté à plus de 48 h | **Conforme** — total intégral 39,20 € annoncé et remboursé ; toast « Envoi annulé. Remboursement de 39,20 € en cours. » ; kilos rendus ; Pauline : « …est annulée » puis « Remboursement émis pour ton envoi Paris → Brazzaville » (montant exact, « 5 à 10 jours ouvrés ») ; Thomas : « Le deal Paris → Brazzaville a été annulé » (kilos / capacité) ; Paiements : « Remboursé 39,20 € le … » |
| WEB-ANN-3 | Annuler à moins de 48 h | **Conforme** — total 47,04 € (net 42,00 €) : fenêtre « Tu seras remboursée de 23,52 € » + « Une retenue de 50 % (23,52 €) s'applique car le départ est dans moins de 48 h : elle est reversée au Voyageur… » ; remboursé 23,52 €, Paiements « Remboursé 23,52 € le … · retenue 23,52 € reversée au Voyageur » ; Marc : cloche « 21,00 € de compensation partis vers ton compte », portefeuille « Compensation · annulation tardive de Marie-Claire » « + 21,00 € », `payoutAmountCents` = arrondi(retenue × net ÷ total) au centime ; l'exemple du cahier par la même formule : 16,10 € / 14,38 € |
| WEB-ANN-4 | Le montant annoncé vient du serveur | **Conforme** — `cancellationPreview` est servi DANS `GET /me/bookings` ; ouvrir la fenêtre ne déclenche **aucun appel** (0 requête `/deals`, `/bookings`) et affiche le montant de la réponse déjà lue ; « Garder l'envoi » n'envoie rien |
| WEB-ANN-5 | Annuler après le départ, sans prise en charge | **Conforme avec réserve** → `ANO-WEB-69` ; deal créé et accepté par l'API (38,64 €), trajet parti ; remboursé 19,32 €, `retentionDisposition = HELD_FOR_MEDIATION`, `payoutStatus` null (**aucun versement automatique**) ; Thomas : portefeuille « Compensation · annulation tardive de Aminata » / « Retenue conservée · on te contacte », écran du deal « Annulation après le départ : la retenue de l'Expéditeur est conservée par Yamba… », Mes trajets « Annulée après le départ · retenue conservée, on te contacte » ; **mais la fenêtre et Paiements disent « reversée au Voyageur »** |
| WEB-ANN-6 | Le Voyageur annule un deal accepté | **NON CONFORME** → `ANO-WEB-68` MAJEURE ouverte ; aucune action d'annulation à l'écran du deal ni dans « Mes trajets » ; `POST /deals/:id/cancel` par le Voyageur → 403 `SHIPPER_ONLY` (la machine connaît pourtant `cancel` par le CARRIER, effets ANN-02) ; scénario en `test.fail` |
| WEB-ANN-7 | Aucun bouton d'annulation après la prise en charge | **Conforme** — `PICKED_UP` et `DELIVERED` : ligne de « Mes envois » sans « Annuler », suivi sans annulation, écran Voyageur sans annulation, API 409 `TRANSITION_NOT_ALLOWED`, statuts inchangés |
| WEB-ANN-8 | L'annulation ne se duplique pas sur le suivi | **Conforme après correction** → `ANO-WEB-70` ; le suivi d'un deal accepté n'a aucune action d'annulation ; « Voir le Deal dans mon dashboard → » est un lien vers `/dashboard/shipments`, où la ligne porte « Annuler » |
| WEB-ANN-9 | L'annulation échouée recharge la liste (deux onglets) | **Conforme** — l'onglet 2 garde sa liste (route figée), l'onglet 1 annule ; l'onglet 2 ouvre la fenêtre, confirme → 409 `TRANSITION_NOT_ALLOWED`, toast « L'annulation n'a pas abouti — la liste vient d'être actualisée. », ligne « Annulée », fenêtre fermée ; un seul `refundAmountCents`, kilos rendus une seule fois |

### Anomalies

- **ANO-WEB-68 (MAJEURE, OUVERTE — serveur + front)** — l'annulation par le Voyageur (ANN-02 : remboursement
  intégral, kilos rendus, compteur d'annulations) n'existe nulle part : le service répond 403 `SHIPPER_ONLY`
  (`deal-lifecycle.service.ts`, « Only the shipper can cancel this deal ») alors que la machine déclare la
  transition `ACCEPTED --cancel(CARRIER)--> CANCELLED` avec `PENALIZE_CARRIER`, et aucun écran ne la
  propose — le refus D72 renvoie pourtant le Voyageur vers « Mes trajets » pour « annuler ses deals ».
  Chantier dédié : branche CARRIER du service (remboursement intégral par le fournisseur, kilos, `closedBy`
  CARRIER, événement + emails « annulée » / « Remboursement émis » à l'Expéditeur, compteur du profil
  public), écran (bouton + confirmation sur le deal accepté et sur la ligne de « Mes trajets »), tests de
  service et de machine, registre (D-next).
- **ANO-WEB-69 (mineure, OUVERTE — contrat)** — après le départ, la retenue est CONSERVÉE à arbitrer, mais
  la fenêtre dit « elle est reversée au Voyageur, qui avait réservé sa capacité pour toi » et Paiements
  « retenue 19,32 € reversée au Voyageur ». `cancellationPreview` et la ligne de paiement ne portent pas la
  destination de la retenue : ajouter `retentionDisposition` aux deux (contrat, OpenAPI), deux textes
  (`retentionNoteHeld`, `PARTIALLY_REFUNDED_HELD`). PR dédiée.
- **ANO-WEB-70 (mineure, close)** — « Voir le Deal dans mon dashboard → » était un `<button>` dont le seul
  effet était `console.info` (suivi Expéditeur ET écran Voyageur du deal accepté) : liens vers
  `/dashboard/shipments` et `/dashboard/trips`.
- **ANO-WEB-71 (mineure, close)** — annuler une demande EN ATTENTE affichait « Envoi annulé. Remboursement de
  28,00 € en cours. » alors que rien n'a été débité (l'empreinte est levée, Paiements dit « Jamais débité ») :
  le remboursement ne se dit qu'après un débit (`item.status !== "PENDING"`).

### À trancher (produit)

- **Le barème lit le départ figé dans le deal** (`booking.trip.departureAt`, instantané), pas le trajet : si
  le Voyageur repousse son vol après l'acceptation, la fenêtre des 48 h de l'Expéditeur reste calculée sur
  l'ancienne date. Voulu (le deal est un contrat) ou à recalculer ?
- **Les objets des emails** : « Le deal Paris → Brazzaville a été annulé » (cahier : « Deal annulé, tes kilos
  sont restitués ») ; amender le cahier.
- **« Annuler » est un bouton** sur la ligne, pas un « lien discret » ; la forme est sobre, amender le cahier.
- **ANN-02 dans son ensemble** (ANO-WEB-68) : quel compteur (annulations « tardives » ? toute annulation
  après acceptation ?), quel texte à l'Expéditeur, quelle sanction — le registre doit le dire avant le code.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **ANN-1** — Le serveur sert l'aperçu avec la liste : bien (aucun appel à l'ouverture). L'email « Ta
  demande … est annulée » à une Expéditrice qui vient de cliquer est un accusé sans information neuve : le
  garder, mais le rendre utile (« rien n'a été débité, l'empreinte disparaît sous 7 jours ») — petit.
- **ANN-2** — Deux emails à quelques secondes (« annulée » puis « Remboursement émis ») : un seul email qui
  porte le remboursement, ou le second seulement quand le remboursement part réellement (webhook Stripe)
  — moyen. « 5 à 10 jours ouvrés » est écrit dans l'email et nulle part à l'écran : l'écrire dans le toast
  ou sur la ligne Paiements — petit.
- **ANN-3** — L'arithmétique est au centime et la compensation part par l'exécuteur unique : très bien. La
  fenêtre pourrait dire le montant que le Voyageur recevra (« dont 21,00 € pour Marc ») : le net est connu
  du serveur — petit.
- **ANN-4** — `cancellationPreview` n'est calculé que quand `cancel` est permis et vit dans la liste : juste
  et économe. Le figer avec un horodatage (« calculé à 10 h 42 ») éviterait la fenêtre ouverte dix minutes
  qui bascule de 100 % à 50 % à l'insu de l'Expéditrice ; le 409 la rattrape, mais après le clic — moyen.
- **ANN-5** — La retenue « à arbitrer » est un vrai état de la machine (A81) : bien. Le texte de la fenêtre
  et de Paiements ne le connaissent pas (ANO-WEB-69) ; plus largement, une retenue conservée mérite un
  délai promis (« sous 5 jours ouvrés ») des deux côtés — petit, une fois le contrat porteur.
- **ANN-6** — La transition existe, le service la refuse, l'écran l'ignore : trois couches en désaccord
  (ANO-WEB-68). Un test de machine « toute transition déclarée a une route et un écran » (inventaire des
  `action × actor` contre les `allowedActions` servis) l'aurait dit — moyen, structurel.
- **ANN-7** — Refus d'état 409 des deux côtés maintenant que le Voyageur n'a pas de transition (403 en
  5.18 sur PICKED_UP) : cohérent. Servir `allowedActions` aussi au Voyageur pour la liste « Mes trajets »
  (aujourd'hui elle ne propose rien, faute d'actions) — moyen.
- **ANN-8** — Un lien mort depuis la maquette (ANO-WEB-70), dans deux fichiers jumeaux : un composant
  « retour au tableau de bord » partagé, et une règle de revue « aucun `onClick` qui n'écrit que dans la
  console » (`grep console.info` en CI) — petit.
- **ANN-9** — Le 409 est traduit, la liste rechargée, la fenêtre fermée : exactement le cahier. Rejouer la
  liste au retour du focus est déjà là (TanStack) ; ajouter `refetchOnWindowFocus` court sur l'aperçu suffit
  pour que la fenêtre de l'onglet 2 s'ouvre déjà à jour — petit.
- **Transversal** — Deux anomalies closes sont des **restes de maquette** (un bouton console, un toast qui
  suppose un débit) ; les deux ouvertes sont des **désaccords entre couches** (machine ≠ service ≠ écran,
  état serveur ≠ texte). Règle : chaque texte qui affirme un fait d'argent (« remboursé », « reversée »)
  lit la donnée qui le porte ; chaque transition déclarée est routée ou retirée — moyen.

### Pièges de poste payés ici

- **`GET /trips/:id` n'est servi qu'au propriétaire** (403 `NOT_TRIP_OWNER`) : les kilos restants se lisent
  avec la session du Voyageur, pas de l'Expéditrice.
- **Le barème lit l'instantané du deal** : déplacer `trip.departureAt` ne suffit pas, il faut aussi
  `booking.trip.departureAt` (composite : `update: { trip: { update: { departureAt } } }`) — WEB-E2E-3
  contournait en déplaçant le trajet AVANT de réserver.
- **Créer un deal par l'API en deux appels** : `POST /deals/payment-intents` avec `expectedTotalCents: 1`
  répond 409 `QUOTE_DIVERGENCE` avec `actualTotalCents` ; le second appel porte le vrai total, puis
  `POST /deals` (FAKE : `clientSecret` null) et `POST /deals/:id/accept` par le Voyageur — trente secondes
  au lieu de l'assistant.
- **Le toast « Envoi annulé. »** est aussi préfixe de « Envoi annulé. Remboursement de … » : le motif du
  page object accepte les deux (`.last()`).
- **Deux onglets** : figer `GET /me/bookings*` de l'onglet 2 avec la réponse lue (`page.route`), libérer
  avant le clic de confirmation.

## Chapitre 5.21 — Litige et médiation, vue membre · **CONFORME** (13 fiches jouées, 3 après correction · 4 anomalies dont 3 closes (1 MAJEURE) et 1 ouverte (MAJEURE, API) · 14 scénarios en série dont 1 `test.fail`, 4 min 42)

`web-lit.spec.ts`. `sgn-picked` (Mai, départ J−1) et `los-picked` (Chinwe ↔ Adebayo, départ J−2) pour le transit ;
`bzv-delivered` (João ↔ Thomas) pour le signalement puis le REMBOURSEMENT TOTAL ; `bzv-disputed` (Chinwe ↔ Thomas,
YAM-2041) pour le dossier, la version, puis le REMBOURSEMENT PARTIEL ; `los-disputed` (Mai ↔ Adebayo, YAM-2042) pour le
REJET ; `yul-delivered` (Aminata) pour les deux onglets ; `bzv-completed` (Mai) pour l'accès sans droit. Les trois
décisions sont prises par la médiatrice dans le back-office (port 3001) ; une décision n'est possible qu'après la
version du Voyageur (ou 72 h) : les versions manquantes sont données par l'API. ImageKit intercepté.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-LIT-1 | Le lien de signalement pendant le transit | **Conforme** — `sgn-picked` : « Colis non livré ? Tu pourras le signaler à partir du … (48 h après le départ du trajet). », aucun bouton actif, `allowedActions` sans `dispute`, `disputeOpensAt` SERVI ; `los-picked` : « Signaler un colis non livré » actif, `dispute` permis |
| WEB-LIT-2 | Le motif verrouillé pendant le transit | **Conforme** — le bouton mène à `/report` ; le groupe « Quel est le problème ? » n'offre QUE « Le colis n'a jamais été livré à Ngozi », coché ; l'explication « Ton colis est encore en transit : tu peux uniquement signaler… Adebayo sera informé. » ; la barre latérale « Colis en transit : le signalement « non livré » est ouvert depuis 48 h après le départ du trajet. Adebayo n'a pas encore validé la remise. » |
| WEB-LIT-3 | L'écran de signalement après une livraison | **Conforme** — « On est là pour t'aider » / « …le paiement de Thomas reste bloqué. » ; badges « Requis », « Recommandé », « Optionnel » ; les six motifs exacts ; « 0 / minimum 50 caractères » ; « Ajoute des photos » (« Jusqu'à 5 photos, max 10 Mo par photo ») ; les quatre solutions dont « Remboursement intégral (61,60 €) » ; « Ce qui va se passer après ton signalement » ; l'engagement et « Pourquoi cet engagement ? » ; « FENÊTRE DE SIGNALEMENT » / « Tu peux signaler jusqu'au … » |
| WEB-LIT-4 | Les refus de validation | **Conforme** — rien : bouton inactif ; motif + « Ça ne va pas » → « 1x / minimum 50 caractères », inactif ; 50 caractères sans engagement → inactif, « n caractères ✓ » ; photo en cours (ImageKit ralenti 4 s) → « Envoi de la photo… », inactif ; photo en échec (500) → « Échec d'envoi — retire-la et réessaye », inactif, retirée → actif ; refus serveur simulé (400) → « Le serveur a refusé le signalement : vérifie la description (50 caractères minimum) et l'engagement. ». **Constat** : les manques ne sont pas « nommés sur leur bloc » au clic — le clic est impossible (bouton inactif, badges « Requis ») |
| WEB-LIT-5 | Envoyer le signalement | **Conforme** — motif, récit, deux photos, « Remboursement intégral », engagement ; « Envoyer le signalement ? » / « Le paiement de Thomas sera gelé et notre équipe médiation prendra le relais. Cette action est irréversible. » ; `POST /dispute` 200 ; « Signalement envoyé » / « On prend le relais… », « NUMÉRO DE DOSSIER YAM-xxxx », « Le paiement de Thomas est gelé… », « Retour au suivi de mon envoi » → « Signalement en cours · dossier YAM-xxxx » ; `DISPUTED`, `payoutStatus FROZEN`, portefeuille Thomas « Gelé · signalement en cours » ; fil en lecture seule (« Un litige est en cours… ») ; emails : accusé « Signalement YAM-xxxx enregistré… » (« gelé ») à João, « Un signalement a été ouvert sur ton transport… » à Thomas avec « contenu manquant » seul (ni le récit ni les photos) |
| WEB-LIT-6 | Ni modifiable ni retirable | **Conforme** — aucun « modifier / retirer » ni « Signaler un problème » sur le suivi ; second signalement par l'API → 409 `TRANSITION_NOT_ALLOWED` ; `/report` → toast « Ce deal ne peut plus être signalé. » + retour au suivi ; le dossier reste le premier |
| WEB-LIT-7 | Le dossier côté Expéditeur | **Conforme** — « Signalement en cours · dossier YAM-2041 » / « Ouvert le …. Le paiement du Voyageur est gelé le temps de l'examen. » ; « TON DOSSIER » : numéro, motif « Contenu manquant… », récit, « Remboursement partiel… », « Envoyé le … » ; « Une question sur ton dossier ? » + « …en rappelant le numéro YAM-2041 : on te répond sous 48 h ouvrées. » ; « État Gelé » + « Aucun versement ne sera fait à Thomas… confirmé par email. » ; « Nous avons demandé sa version à Thomas (72 h). » ; jamais la version du Voyageur |
| WEB-LIT-8 | Le dossier côté Voyageur | **Conforme** — « …Ton versement est mis en attente le temps de l'examen. » ; « Un signalement a été ouvert » / « Chinwe a signalé un problème sur ce colis… » ; « Ce n'est pas une décision : … Nous entendons les deux parties. » ; « MOTIF contenu manquant » (la catégorie seule — ni le récit « deux des trois jouets », ni la solution souhaitée) ; les trois étapes ; la carte « Donne ta version ». **Constat** : pas de bouton « Donner ma version », le formulaire est ouvert dans la carte (comme WEB-E2E-2) |
| WEB-LIT-9 | Donner sa version, une seule fois | **Conforme** — « Explique ce qui s'est passé… Une seule fois, jusqu'au …. Nous décidons après avoir lu les deux versions. » ; « Ta version ne pourra plus être modifiée une fois envoyée. » ; « Colis remis fermé. » → « Au moins 50 caractères. », inactif ; version + photo → `POST /dispute/statement` 201, toast « Ta version est enregistrée. », « Version envoyée » / « Envoyée le …. Nous décidons sous 5 jours ouvrés… », plus de champ après rechargement ; Chinwe : « Thomas a donné sa version. La décision arrive sous 5 jours ouvrés. » sans le contenu |
| WEB-LIT-10 | La décision rendue, trois issues | **Conforme après correction** → `ANO-WEB-72`, `ANO-WEB-73`, `ANO-WEB-75` ; REJET (YAM-2042) : Mai « Ton signalement n'a pas été retenu : le Voyageur est payé en entier. », « Envoi terminé », aucune carte de notation ; Adebayo « Le signalement n'a pas été retenu : tu es payé en entier. » + « 40,00 € partent vers ton compte, sur ton compte bancaire sous 2 à 7 jours. » ; PARTIEL (YAM-2041, 10,00 €) : Chinwe « …retenu en partie : remboursement partiel. » + « 10,00 € te sont remboursés, sur ta carte sous 5 à 10 jours. », jamais 18,00 € ; Thomas « …une part du prix est remboursée à l'Expéditeur. » + « 18,00 € partent vers ton compte », jamais 10,00 € ; TOTAL (ticket de João, 61,60 €) : João « …remboursement total. » + « 61,60 € te sont remboursés… », Thomas « …remboursé en totalité. » + « Aucun versement ne te revient sur ce deal. », jamais 61,60 € ; partout « Décision rendue », « MOTIF DE LA DÉCISION » + le texte lu par les deux, « Cette décision est définitive dans l'application. », « Désaccord ? Demander une médiation conventionnelle par email. » ; cloche « Décision rendue · YAM-… » aux six (après ANO-WEB-75), emails « Décision rendue sur ton envoi / transport » aux six, chacun son montant (les deux décisions de Thomas visées par leur ticket). **Mais l'API des notifications porte les deux montants** → `ANO-WEB-74` (10 bis en `test.fail`) |
| WEB-LIT-11 | Un deal clos par médiation ne se note pas | **Conforme** — sur les trois deals, aucun « Noter » ni « Donner mon avis » des deux côtés ; `rating.canRate = false` |
| WEB-LIT-12 | Confirmer dans un onglet, signaler dans l'autre | **Conforme** — l'onglet 2 a son dossier prêt ; l'onglet 1 confirme ; l'onglet 2 envoie → 409, toast « Ce deal a changé entre-temps — retour au suivi. », retour au suivi « Envoi terminé » ; `COMPLETED`, aucun litige |
| WEB-LIT-13 | Accès direct au signalement sans droit | **Conforme** — Pauline sur le `/report` de João : `GET /deals/:id` 403, retour au suivi, « Cette réservation n'existe pas ou a été annulée. », aucune donnée du deal ni erreur brute ; Mai sur un deal terminé : toast « Ce deal ne peut plus être signalé. » + retour au suivi « Envoi terminé » |

### Anomalies

- **ANO-WEB-75 (MAJEURE, close)** — quatre événements avaient leur texte dans le catalogue (`copy.*`) mais pas
  d'entrée dans la table de présentation (`isKnownNotificationType`) : « Décision rendue · YAM-… », « Code de
  livraison renouvelé », « Remboursement émis », « Paiement autorisé » s'affichaient **« Notification »** sans
  titre ni ligne. Les quatre entrées sont ajoutées (`booking.dispute_resolved`, `booking.code_regenerated`,
  `booking.refund_issued`, `booking.payment_authorized`).
- **ANO-WEB-74 (MAJEURE, OUVERTE — API)** — `GET /me/notifications` sert le payload brut de
  `booking.dispute_resolved` : `refundCents` ET `carrierPayoutCents` à chaque partie (Mai lit
  `carrierPayoutCents: 4000`). L'écran n'affiche aucun montant, mais la réponse brute contredit « chaque partie
  voit uniquement le montant qui la concerne ». Même famille qu'ANO-WEB-62 : projection par rôle du payload
  des notifications (liste blanche par événement), registre, PR dédiée. Scénario 10 bis en `test.fail`.
- **ANO-WEB-73 (mineure, close)** — un remboursement total clôt le deal en `CANCELLED` (D55) et le suivi
  titrait « Demande annulée · Cette demande est close. Si un remboursement s'applique… Annulée le … » au-dessus
  de la décision — sur un colis livré. `BookingStatusNotice` a un texte de clôture par la médiation (« Clos par
  la médiation » / « Ton signalement a été tranché : la décision et son motif sont ci-dessous. » / « Clos le … »).
- **ANO-WEB-72 (mineure, close)** — sur un deal clos par la médiation (rejet, partiel), « TON PAIEMENT » disait
  « La période de vérification est terminée — les fonds sont en cours de versement à … » (le texte d'ANO-WEB-64) :
  la note suit `completedBy = ADMIN` (« Clos par la médiation — le sort des fonds est celui de la décision
  ci-dessus. »).

### À trancher (produit)

- **« Donner ma version »** : le cahier décrit un bouton ; le produit ouvre le formulaire dans la carte (constat
  déjà fait en WEB-E2E-2). Amender le cahier.
- **Les manques « nommés sur leur bloc »** (LIT-4) : le produit désactive le bouton et marque les blocs
  « Requis » ; aucun message n'apparaît au clic puisque le clic est impossible. Amender le cahier, ou rendre le
  bouton actif avec un message par bloc (moins bien).
- **Un remboursement total = `CANCELLED`** (D55) : le titre est corrigé (ANO-WEB-73), mais « Mes envois » et
  Paiements classent le deal comme une annulation ; un statut de clôture par la médiation (`CLOSED_BY_MEDIATION`)
  ou un `closedBy = ADMIN` lu par les listes serait plus juste — registre.
- **Codes de réponse** : `POST /dispute` répond 200, `POST /dispute/statement` 201 — aligner (201 pour les deux
  créations).
- **Libellés en capitales** (« NUMÉRO DE DOSSIER », « MOTIF DE LA DÉCISION ») : `text-transform` — le cahier écrit en
  minuscules, le harnais lit en capitales.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **LIT-1** — `disputeOpensAt` servi, le front reflète : exemplaire. Afficher aussi le compte à rebours
  (« ouvre dans 22 h ») plutôt qu'une date-heure — petit.
- **LIT-2** — Un seul motif rendu quand le colis est en transit : bien (pas un radio grisé qui invite au clic).
  Dire pourquoi les autres motifs manquent est fait ; renvoyer vers le fil de messagerie (« demande d'abord des
  nouvelles à Adebayo ») avant de signaler — petit.
- **LIT-3** — Quatre blocs, badges, compteur, fenêtre : conforme au pixel. « Remboursement intégral (61,60 €) »
  montre le total ; « Remboursement partiel » pourrait annoncer sa borne (« jusqu'à 55,00 € ») — petit.
- **LIT-4** — Le bouton inactif est le bon refus. La photo en échec bloque l'envoi : juste (rien à moitié fait).
  Un test de composant qui couvre les quatre états (`uploading`, `error`, `pledge`, `min length`) coûte moins
  qu'une fiche — moyen.
- **LIT-5** — Le ticket vient du serveur et l'écran le relit : bien. L'email « calme » au Voyageur ne porte que
  la catégorie : bien. Le fil passe en lecture seule au même instant : bien. Le succès pourrait proposer
  « Ajouter une preuve plus tard » (photos oubliées) sans rouvrir un signalement — moyen.
- **LIT-6** — 409 partout, l'écran renvoie au suivi : juste. Le message « Ce deal ne peut plus être signalé. »
  vaut pour trois causes (déjà signalé, fenêtre close, terminé) : dire laquelle — petit.
- **LIT-7** — « Nous avons demandé sa version (72 h) » puis « a donné sa version » : la bonne dose
  d'information. Le compte à rebours des 72 h (échéance servie) serait plus honnête que « 72 h » — petit.
- **LIT-8** — La catégorie seule, jamais le récit : bien (A68). La solution souhaitée de l'Expéditrice n'est pas
  servie au Voyageur : bien aussi. Une phrase « ce que tu peux joindre » (photos de prise en charge déjà au
  dossier) éviterait un doublon — petit.
- **LIT-9** — Une seule version, immuable, échéance servie : bien. Le 201 sur la version et le 200 sur le
  signalement (même famille de créations) : aligner — petit.
- **LIT-10** — Trois issues, chaque partie SON montant à l'écran et dans l'email : bien. L'API des
  notifications, elle, sert les deux (ANO-WEB-74) : projeter le payload par rôle à la lecture (une liste
  blanche par événement, comme `analyticsEventsFor`) — moyen, structurel. Quatre événements sans présentation
  (ANO-WEB-75) : un test qui aligne `copy.*` et `PRESENTATION` en CI — petit.
- **LIT-11** — Pas de note après une médiation : juste (`canRate = false` servi). Dire pourquoi à l'écran
  (« Un deal clos par la médiation ne se note pas ») plutôt qu'une absence silencieuse — petit.
- **LIT-12** — Le 409 est traduit, l'onglet revient au suivi : exactement le cahier. Relire le deal au focus de
  l'écran de signalement (comme le suivi) éviterait de remplir un dossier pour rien — petit.
- **LIT-13** — 403 traduit en « n'existe pas ou a été annulée » : bonne étanchéité (pas de 403 vs 404 visible). Le
  message est celui de l'introuvable pour un étranger : voulu (ne rien révéler) — RAS.
- **Transversal** — Trois anomalies closes sont des **textes qui ignorent la cause de la clôture** (72 : note du
  paiement, 73 : titre « Demande annulée ») ou une **table de présentation en retard sur le catalogue** (75) ;
  l'ouverte est une **projection manquante** (74 : payload brut servi aux deux rôles). Règle : un état a autant
  de textes que de causes (`completedBy`, `closedBy`, `resolution`), et tout ce qui sort par une API de lecture
  passe par une liste blanche par rôle — moyen.

### Pièges de poste payés ici

- **Une décision n'est possible qu'après la version du Voyageur (ou 72 h)** : `POST /deals/:id/dispute/statement`
  par l'API (201) sur les dossiers du seed avant de trancher.
- **Le back-office doit tourner** (`npx nx dev admin-ui`, port 3001) : la fixture `navigateurAdmin("mediateur")`
  et `MediationAdmin` (file → dossier → trancher) font le reste.
- **« Autre problème » est un sous-texte de « … a un autre problème avec le voyageur »** : `exact: true` sur les
  motifs.
- **En transit, un seul radio est rendu** : « verrouillé » se prouve par le compte des radios du groupe, pas par
  `disabled`.
- **Les libellés sont en capitales à l'écran** (« NUMÉRO DE DOSSIER », « MOTIF DE LA DÉCISION », « MOTIF ») :
  motifs insensibles à la casse.
- **Le total de l'Expéditeur ne vit que dans SA vue** (A13) : `dealBrut` avec la session du bon rôle.
- **Thomas reçoit deux « Décision rendue » sur le même corridor** : viser chaque email par son ticket dans le
  corps (`emailsPour` + `ouvrir`).
- **`POST /dispute` 200, `POST /dispute/statement` 201** : ne pas généraliser un code.

## Chapitre 5.22 — La notation croisée · **CONFORME** (11 fiches jouées, 3 après correction · 3 anomalies closes dont 1 MAJEURE, + une purge du jeu d'essai · 11 scénarios en série, 3 min 18)

`web-not.spec.ts`. `bzv-completed` (Mai ↔ Thomas) pour le double-aveugle et la page publique ; `gru-completed`
(João ↔ Inês) pour la note seule requise, l'état intermédiaire, les relances et la révélation sans réciprocité ;
`bzv-disputed` (Chinwe) et le deal d'un autre compte pour « on ne note qu'une fois ». Le cron `rating` est forcé
(`scripts/recette/notation-eligible.ts <id> r1|r2|reveal` puis `notation.ts relances|reveal`). La page publique se lit
dans un contexte neuf, sans session (fenêtre privée).

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-NOT-1 | Où « Noter » apparaît | **Conforme après correction** → `ANO-WEB-76` ; accueil : « À traiter » avec la ligne « Terminé · … Noter Thomas » ; « Mes envois » : ligne « Terminé » + « Noter Thomas » ; le deal : « Comment s'est passé ton Deal avec Thomas ? » / « Tu as jusqu'au …. Ta note ne sera visible qu'une fois les deux avis publiés. » / « Noter Thomas » ; aucune fenêtre bloquante sur les trois écrans |
| WEB-NOT-2 | L'écran « Donne ton avis » | **Conforme** (bureau : motif barre latérale, constat) — h1 « Comment Thomas s'est-il comporté ? », carte « Thomas N. · Voyageur · Paris → Brazzaville · Terminé » — **ni moyenne ni nombre de deals** ; les cinq étoiles « Décevant » … « Excellent » ; « SUR CES POINTS PRÉCIS » avec « Bien » / « À améliorer » ; « TON COMMENTAIRE » « Optionnel · max 280 caractères » ; « PUBLICATION », « Plus tard », « Publier mon avis ». **Constat** : sur bureau, pas de titre « Donne ton avis » ni de bandeau « Ton Deal avec Thomas est terminé » (motif documenté dans `RatingDesktop`) ; l'en-tête du cahier est celui du mobile |
| WEB-NOT-3 | Les critères dépendent du rôle noté | **Conforme** — Voyageur noté : Ponctualité au rendez-vous, Communication, Soin du colis (jamais les deux autres) ; Expéditrice notée : Clarté de la déclaration, Réactivité, Ponctualité au rendez-vous |
| WEB-NOT-4 | La note globale est le seul champ requis | **Conforme** — sans étoile : bouton inactif + « Choisis d'abord ta note globale » ; 5 étoiles seules → « Merci pour ton retour ! », `ratedByMe`, non révélé |
| WEB-NOT-5 | La limite du commentaire | **Conforme** — 275 → « 275 / 280 — bientôt la limite » ; 281 saisis → 280 gardés, « 280 / 280 — bientôt la limite » |
| WEB-NOT-6 | Le double-aveugle (deux navigateurs) | **Conforme** — A publie (5 ★, trois pouces, commentaire) : « Merci pour ton retour ! » / « …voyager en confiance. » / « Thomas recevra aussi une invitation à te noter. Vos avis seront révélés une fois les deux publiés, ou le … au plus tard. » ; la page publique de Thomas ne porte pas l'avis, `revealedAt` null ; B publie : « Mai t'avait déjà noté : vos deux avis sont maintenant visibles. » ; A recharge : « Vos avis » / « Ta note pour Thomas » / « La note de Thomas » + son commentaire ; cloche « Les notes sont révélées » aux deux, **aucun email** |
| WEB-NOT-7 | L'état intermédiaire | **Conforme** — « Note envoyée » / « Révélée quand Inês aura noté, ou le … au plus tard. », plus de « Noter » |
| WEB-NOT-8 | On ne note qu'une fois | **Conforme après correction** → `ANO-WEB-77` ; déjà noté : « Ta note est envoyée » / « Elle sera révélée quand Inês aura noté… », plus de formulaire ; en litige : « Notation indisponible » / « Ce Deal ne peut pas être noté pour le moment. » ; autre compte : l'API refuse (403 `NOT_A_PARTY`), l'écran rend « Ce Deal ne peut pas être noté pour le moment. » + « Retour au Deal », aucune donnée du deal ni erreur brute |
| WEB-NOT-9 | Les relances (cron) | **Conforme** — J+5 : cloche « Pense à noter João » + email « Pense à noter João » à Inês, rien à João ; J+7 : « Dernier rappel : note João » ; troisième passe : plus rien (deux emails en tout, aucun au rôle qui a noté) |
| WEB-NOT-10 | La révélation à 14 jours sans réciprocité (cron) | **Conforme** — `revealedAt` posé, `canRate` false ; côté muet : « Vos avis · Tu n'as pas noté ce Deal. · La note de João », plus de « Noter » ; la page publique d'Inês porte « ★ 5,0 sur 1 avis » et « João S. ». **Constat** : le cahier attend « La fenêtre de notation est fermée — tu n'as pas noté João. » ; le produit montre la note reçue (ce texte ne sert que sans aucun avis) |
| WEB-NOT-11 | L'avis révélé sur la page publique (fenêtre privée) | **Conforme après correction** → `ANO-WEB-78` ; sans session : le commentaire de Mai, « Mai T. », la note « 5/5 » (aria-label), les pouces « Ponctualité », « Communication », « Soin du colis » ; la ligne de faits « n Deals terminés · ★ x sur n avis » ; « Signaler cet avis » = `mailto:` avec « Signalement d'un avis (#id) » en objet |

### Anomalies

- **ANO-WEB-76 (MAJEURE, close)** — l'accueil réel (`HomeLive`) ne dérivait que les actions VOYAGEUR (deals reçus,
  trajets en brouillon / en pause) : un Expéditeur ne voyait jamais « À traiter » (noter, transmettre le code,
  vérifier la livraison) et lisait « Tout est à jour, rien à traiter. » — alors que la prévisualisation
  (`deriveHomeActions`) le faisait. Les envois réels sont lus (`getMyShipments`) et fusionnés en tête.
- **ANO-WEB-77 (mineure, close)** — l'écran de notation d'un deal en litige disait « La notation est fermée · La
  fenêtre de 14 jours est passée » : `RatingDone` confondait « pas de note » et « fenêtre passée ». Sans échéance
  passée : « Notation indisponible » / « Ce Deal ne peut pas être noté pour le moment. ».
- **ANO-WEB-78 (mineure, close)** — sur la page publique, la note d'un avis était cinq icônes colorées sans nom
  accessible ; le groupe porte `role="img"` + `aria-label="5/5"` (Voyageur et Expéditeur).
- **Jeu d'essai** — les avis survivaient au seed (les bookings sont effacés, pas leurs `Review`) : 25 avis
  orphelins révélés polluaient les profils publics des comptes du seed et faisaient passer « l'avis n'est pas
  public avant la réciprocité » pour un faux. `seed-deals.ts` purge les avis des comptes du seed (auteur ou sujet)
  avec les bookings.

### À trancher (produit)

- **L'en-tête de l'écran de notation sur bureau** : ni « Donne ton avis » ni bandeau « Ton Deal avec … est
  terminé » (motif barre latérale, documenté) ; le cahier décrit le mobile. Amender le cahier ou unifier.
- **Le côté muet après la révélation à 14 jours** : « Vos avis · Tu n'as pas noté ce Deal. · La note de … » (avec
  la note reçue) plutôt que « La fenêtre de notation est fermée — tu n'as pas noté … » ; amender le cahier.
- **Un étranger sur `/rate`** : « Ce Deal ne peut pas être noté pour le moment. » + « Retour au Deal » (qui mène à
  un suivi « n'existe pas ») ; le cahier dit « un renvoi ». Acceptable ; un renvoi direct vers « Mes envois » serait
  plus net.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **NOT-1** — Deux accueils (`HomeLive` réel, `HomePreview` de démonstration) avec deux dérivations d'actions
  (ANO-WEB-76) : garder `deriveHomeActions` comme seule source pour les deux, la prévisualisation ne changeant que
  les données — moyen.
- **NOT-2** — Aucun biais d'ancrage (ni moyenne ni volume) : bien. Le bureau et le mobile n'ont pas le même
  en-tête ; un seul composant d'en-tête, deux mises en page — petit.
- **NOT-3** — Les critères viennent du serveur par rôle noté (`criteria` du contexte) : bien. Les descriptions
  accordent au féminin pour l'Expéditrice (« était-elle ») quel que soit le prénom (même famille que 5.18) — petit.
- **NOT-4** — Bouton inactif + indication : juste. « Plus tard » ne dit pas jusqu'à quand : « Plus tard (jusqu'au
  24 septembre) » — petit.
- **NOT-5** — La limite est bloquante à 280 et annoncée à l'approche : bien. Le seuil d'alerte (275 ?) est dans le
  code : le porter en constante nommée avec la limite — petit.
- **NOT-6** — Le double-aveugle est serveur (révélation atomique, `revealedAt`) : bien. Pas d'email à la
  révélation : voulu (D52). La notification pourrait porter la note reçue (« Thomas t'a mis 4 ★ ») — petit.
- **NOT-7** — L'échéance servie est affichée : bien. Un rappel « tu pourras relire ta note ici » — petit.
- **NOT-8** — Le 403 est traduit par l'état « indisponible » (ANO-WEB-77 a séparé « fermée » et « indisponible ») ;
  servir `cannotRateReason` en clé (DISPUTED, NOT_COMPLETED, WINDOW_CLOSED) plutôt qu'en phrase anglaise, et le
  traduire — petit.
- **NOT-9** — Relances au seul rôle muet, marquées par `ratingRemindersSent` : bien. Les J+5 / J+7 sont des
  constantes : catalogue des réglages (`rating.reminderDays`, D62) — moyen.
- **NOT-10** — Révélation d'un avis unique à 14 jours : conforme à D53. Un test de service « aucune note → aucune
  révélation, aucun événement » existe-t-il ? Le vérifier — petit.
- **NOT-11** — La page publique lit les avis révélés seulement : bien. La note en icônes sans nom (ANO-WEB-78) et
  l'auteur en « Prénom I. » : bien ; ajouter la date absolue au survol de « aujourd'hui » — petit. Le seed
  laissait des avis orphelins : un test du seed « zéro avis étranger aux bookings créés » — petit.
- **Transversal** — Une anomalie majeure est encore un **écran réel en retard sur sa prévisualisation** (76, comme
  le bandeau de 5.19) ; deux mineures sont des **états sans nom** (77 : deux causes, un texte ; 78 : une valeur
  visible mais non nommée). Règle : une prévisualisation partage la logique du réel, jamais une copie ; toute
  valeur affichée a un nom accessible — moyen.

### Pièges de poste payés ici

- **Les avis survivaient au seed** (`Review` non purgés avec les bookings) : le premier passage du chapitre a vu
  « l'avis de Mai » public avant la réciprocité — c'était l'avis du passage précédent. Le seed purge désormais ;
  un commentaire unique par passage reste une bonne pratique (WEB-E2E-1 suffixe par l'id du deal).
- **La page publique se lit sans session** (`browser.newContext()`), pas avec un compte connecté.
- **Les étoiles sont des icônes** : la note se lit dans l'aria-label (« 5/5 »), jamais dans le texte.
- **L'accueil réel n'est pas la prévisualisation** (`/dashboard/home` = `HomeLive`) : une preuve sur la page de
  démonstration ne vaut rien.
- **Le cron `rating` se force en deux temps** : `notation-eligible.ts <id> r1|r2|reveal` (dates) puis
  `notation.ts relances|reveal` ; `FORCE_COLOR=0` comme en 5.19.
- **Le contexte de notation d'un étranger est un 403** : l'écran rend « indisponible », pas l'introuvable du suivi.

## Chapitre 5.23 — La page destinataire · **CONFORME** (9 fiches jouées · aucune anomalie · 9 scénarios en série, 2 min 24)

`web-des.spec.ts`. `bzv-picked` (Aminata ↔ Thomas, destinataire Clarisse Mabiala, +242 06 123 45 67, code `742891`)
pour tout le chapitre ; `bzv-pending` pour « pas de lien avant l'acceptation ». La page publique se lit dans un contexte
sans session (`navigateurVisiteur`) ; le presse-papiers et `window.open` (WhatsApp) sont observés en mémoire de page ;
le schéma `sms:` n'est pas cliqué (il ouvrirait Messages du poste) — le numéro qu'il vise est prouvé par la réponse de
l'API que les deux canaux partagent. Ordre de jeu : 7, 6, 9, 1, 2, 3, 4, 5, 8 (le deal est livré en fiche 5, clos puis
son destinataire effacé pour la fiche 8).

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-DES-1 | Créer et partager le lien | **Conforme** — carte « Partage le suivi à Clarisse » / « Un lien sans compte : Clarisse voit où en est le colis, sans ton adresse ni le code. » ; « Copier le message » → un seul `POST /tracking-link`, le presse-papiers porte « Bonjour Clarisse ! Ton colis arrive avec Thomas. Suis-le ici : …/track/… », bouton « Copié ! » ; second clic : le même message, **aucun nouvel appel** ; après rechargement, le POST rend **le même jeton** (créé une fois par deal) |
| WEB-DES-2 | Le partage par WhatsApp et SMS | **Conforme** — WhatsApp : `window.open("https://wa.me/242061234567?text=…")`, le numéro saisi à la réservation, le message pré-rempli ; SMS : bouton actif, cible `sms:+242061234567` (le numéro servi par l'API, `recipientPhoneE164`, est celui de la réservation — le schéma externe n'est pas cliqué) |
| WEB-DES-3 | La page vue par le destinataire (fenêtre privée) | **Conforme** — « Ton colis arrive, Clarisse » / « Aminata t'envoie un colis avec Thomas N., Voyageur Yamba, de Paris à Brazzaville. » ; « Départ », « Arrivée prévue », « Où en est le colis » ; la frise : « Colis pris en charge », « Colis récupéré par Thomas », « En route », « Arrivé à Brazzaville », « Colis remis » ; la mention « Aminata a confié ton prénom et ton numéro à Yamba pour cette livraison, et à personne d'autre. Ils sont effacés après la remise. » + « Politique de confidentialité » ; « Toi aussi, envoie ou transporte avec Yamba » avec « Envoyer un colis » et « Devenir Voyageur » ; aucun compte connecté |
| WEB-DES-4 | Ce que la page ne montre jamais | **Conforme** — écran : aucun code, numéro, montant, photo, mot de l'adresse ; code source : ni `742891`, ni `+242061234567` / `061234567`, ni « Mabiala », ni le montant ; `<meta name="robots">` avec `noindex` ; `GET /track/:token` sert exactement les 8 clés fermées du contrat (arrivalAt, carrier, corridor, departureAt, milestone, recipientFirstName, shipperFirstName, steps) |
| WEB-DES-5 | La page suit la progression (deux navigateurs) | **Conforme** — « Colis récupéré par Thomas » / « Le colis voyage avec Thomas. » ; l'aéroport ne bouge rien (jalon non public) ; décollage → « En route » / « Thomas est en route vers Brazzaville. » ; atterrissage → « Arrivé à Brazzaville » / « Thomas est arrivé. Il te contacte pour convenir de la remise : prépare le code que Aminata t'a donné. » ; remise contre `742891` → « Colis remis » / « Le colis t'a été remis. Bonne réception ! », cinq jalons atteints ; rien de révélé à aucune étape |
| WEB-DES-6 | Le Voyageur ne crée pas le lien | **Conforme** — aucune carte de partage sur le suivi ni sur l'écran de remise du Voyageur ; `POST /tracking-link` par le Voyageur → 403 |
| WEB-DES-7 | Pas de lien avant l'acceptation | **Conforme** — aucune carte sur le suivi d'une demande en attente ; l'API refuse aussi (409) |
| WEB-DES-8 | Un lien invalide | **Conforme** — jeton altéré : « Ce lien de suivi n'est plus valide » / « Le colis a été remis il y a un moment, ou le lien a été retiré. Rapproche-toi de la personne qui te l'a envoyé. », le bloc « Toi aussi » reste, ni prénom ni ville ; destinataire effacé (deal clos, `destinataire-eligible.ts` + `destinataire.ts`) : **le même message**, et l'API répond le même 404 (corps identique) — les deux causes ne se distinguent pas |
| WEB-DES-9 | Le vrai numéro du destinataire côté Voyageur | **Conforme** — carte « Clarisse Mabiala · Destinataire », le bouton d'appel nommé « +242061234567 » (le numéro saisi à la réservation, celui de l'API), « WhatsApp » ; aucun numéro factice |

### À trancher (produit)

- **« Colis pris en charge »** est, sur la page publique, le jalon de l'ACCEPTATION ; la prise en charge physique
  s'appelle « Colis récupéré par {Voyageur} ». Le cahier (5.23 comme WEB-E2E-6) emploie « pris en charge » pour les
  deux ; amender le cahier, ou renommer le premier jalon (« Deal accepté »).
- **Le bouton d'appel porte le numéro comme nom** (pas « Appeler ») : lisible, mais un lecteur d'écran annonce un
  numéro sans verbe ; « Appeler +242… » serait plus clair (même remarque en 5.16).
- **Le SMS assigne `window.location.href`** (schéma externe) là que WhatsApp ouvre une fenêtre : un `<a href="sms:…">`
  serait observable, accessible et cohérent avec 5.17 (SenderCodeCard).

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **DES-1** — Un jeton par deal, créé une fois, jamais régénéré : bien (D69). Offrir « Retirer le lien » à l'Expéditrice
  (révocation, `revokedAt` existe) pour un message envoyé au mauvais numéro — petit.
- **DES-2** — Le numéro des deux canaux vient de la réponse serveur (`recipientPhoneE164`) : bien. Le SMS en lien
  `href` plutôt qu'en assignation (observable, accessible) — petit.
- **DES-3** — La page publique est complète et sobre ; « Arrivée prévue » vaut « — » tant que l'instantané ne porte pas
  `arrivalAt` (ANO-WEB-53, ouverte) : la fermer rendrait la page entière — moyen, PR dédiée déjà proposée.
- **DES-4** — Liste fermée de clés côté API, `noindex`, aucune image : exemplaire. Ajouter un test de contrat qui
  échoue si une clé s'ajoute à `PublicTrackingResponse` sans décision (D69) — petit.
- **DES-5** — Les jalons publics sont un sous-ensemble des jalons du Voyageur (l'aéroport reste privé) : bon choix.
  Un rafraîchissement automatique de la page (polling doux, 60 s) éviterait « recharge à chaque étape » — petit.
- **DES-6** — Le Voyageur n'a ni carte ni droit (403) : juste. Rien à ajouter.
- **DES-7** — Rien à suivre avant l'acceptation : l'API refuse (409), la carte n'existe pas — juste. Dire à l'Expéditrice
  « le lien de suivi apparaîtra à l'acceptation » sur la demande en attente — petit.
- **DES-8** — 404 uniforme (jeton altéré = destinataire effacé) et le bloc d'acquisition qui reste : très bien. Le
  cron d'effacement (`recipient-redaction`) pourrait aussi révoquer le lien (`revokedAt`) pour tracer la cause côté
  admin sans la révéler côté public — petit.
- **DES-9** — Le numéro réel, cliquable, au bon endroit : bien. Nommer le bouton « Appeler {numéro} » — petit.
- **Transversal** — Aucune anomalie : ce chapitre est le plus étanche de la campagne (contrat fermé, 404 uniforme,
  aucune fuite dans la source). La seule dette est de nommage (jalons, bouton d'appel) et d'observabilité (SMS).

### Pièges de poste payés ici

- **Le code source d'une page next-intl porte tout le catalogue** : chercher les VALEURS du deal (code, numéro, nom,
  montant formaté), jamais un symbole (« € » y figure dans des textes génériques).
- **Le schéma `sms:` n'est ni journalisé ni cliquable** dans le harnais : prouver le numéro par la réponse de l'API
  (`recipientPhoneE164`) que les deux canaux partagent, et `window.open` pour WhatsApp.
- **Le bouton d'appel s'appelle par son numéro** (`getByRole("button", { name: "+242061234567" })`).
- **La page publique se lit sans session** (`navigateurVisiteur`) et le jalon courant est la 2e ligne de la section
  « Où en est le colis » (page object).
- **Le destinataire s'efface en deux temps** : `destinataire-eligible.ts <id> 40` (deal clos il y a 40 jours) puis
  `destinataire.ts` (la passe) — le lien tombe alors sur le même 404 qu'un jeton altéré.

## Chapitre 5.24 — Signaler un trajet, un profil, un message · **CONFORME** (8 fiches jouées, 2 après correction · 2 anomalies closes dont 1 MAJEURE, + une purge du jeu d'essai · 8 scénarios en série, 2 min 54)

`web-sig.spec.ts`. Cibles : le trajet `bzv-upcoming` de Thomas (SIG-1 à 4), `bzv-perkg` de Thomas (SIG-7), le profil
`seed-thomas` (SIG-4, 5, 8), le trajet `fih` de Joséphine masqué par le back-office et le profil `seed-josephine` rendu
privé par manœuvre (SIG-6, remis en l'état dans un `finally`). Le signalement d'un message est joué en 5.15. La file
du back-office est lue par l'API admin (`GET /admin/reports?status=OPEN`, profil SUPPORT) ; les avis pour SIG-8 sont
créés par l'API des deux côtés (révélés) sur `bzv-completed`.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-SIG-1 | Un visiteur voit la porte d'identité | **Conforme** — « Signaler cette annonce » en fenêtre privée → « Connecte-toi pour signaler » / « Un signalement est toujours signé : cela protège tout le monde des abus. » ; connexion DANS la fenêtre (Aminata) → `POST /auth/login` 200, la porte se ferme, l'annonce reste ouverte avec son bouton |
| WEB-SIG-2 | Signaler une annonce | **Conforme** — « Signaler cette annonce » / « Dis-nous ce qui ne va pas. Notre équipe regarde chaque signalement ; la personne concernée ne saura jamais qui l'a signalée. » ; les quatre motifs exacts (« Usurpation d'identité » absente) ; « Précisions (facultatif) » / « Ce que tu as vu, quand… » ; « Arnaque suspectée » + précision → `POST /reports` 201, « Merci, ton signalement est bien reçu. » / « Un email de confirmation t'a été envoyé. Nous ne communiquons pas la suite donnée. » ; l'annonce reste en ligne (fenêtre privée) ; email « Ton signalement a bien été reçu » (« Bonjour Aminata ») |
| WEB-SIG-3 | Le doublon est refusé | **Conforme** — second signalement → 409, « Tu as déjà signalé cet élément, notre équipe s'en occupe. » ; API 409 `ALREADY_REPORTED` |
| WEB-SIG-4 | On ne se signale pas soi-même | **Conforme** — Thomas : aucun bouton sur sa propre annonce ni sur son profil ; appels forcés (TRIP, USER) → 400 `OWN_TARGET` (« Tu ne peux pas signaler ton propre contenu. » à l'écran) |
| WEB-SIG-5 | Signaler un profil | **Conforme** — « Signaler ce profil », « Usurpation d'identité » disponible → 201, accusé ; Thomas : aucune cloche de signalement, aucun email, rien sur son accueil |
| WEB-SIG-6 | Une cible invisible répond « introuvable » | **Conforme après correction** → `ANO-WEB-79` ; annonce masquée par Yamba : page « Trajet introuvable », aucun bouton, `POST /reports` → 404 `TRIP_NOT_FOUND` (répondait **201** avant) ; profil masqué : « Profil introuvable », aucun bouton, 404 `USER_NOT_FOUND` |
| WEB-SIG-7 | Trois signalements ne changent rien côté membre | **Conforme** — Aminata, João, Chinwe signalent `bzv-perkg` (« Comportement inapproprié ») : trois accusés, trois emails ; l'annonce reste en ligne (fenêtre privée) ; Thomas : aucune cloche de signalement, aucun email, ni bandeau ni sanction sur son annonce et « Mes trajets » ; back-office : trois lignes OPEN sur la cible, `openCountOnTarget = 3`, `priority = true` (« Prioritaire · 3 ouverts ») ; l'annonce reste publique après la revue prioritaire |
| WEB-SIG-8 | Signaler un avis | **Conforme** — sur l'avis révélé de Mai (page publique de Thomas) : « Signaler cet avis » = `mailto:support…?subject=Signalement d'un avis (#id)` ; aucune fenêtre, aucune file (choix assumé) |

### Anomalies

- **ANO-WEB-79 (MAJEURE, close)** — une annonce MASQUÉE par Yamba (`hiddenByAdminAt`, C-PR4) se signalait : le service
  ne vérifiait que `isDeleted`, `POST /reports` répondait 201 et révélait l'existence de la cible (le cahier veut
  « introuvable », l'existence n'est pas révélée). `report.service.ts` exige `hiddenByAdminAt` null OU absent (pitfall
  Mongo, `OR isSet`) ; +1 test auth-service = **230**.
- **ANO-WEB-80 (mineure, close)** — la fenêtre traduisait un 404 par « Le signalement n'a pas pu être envoyé. Réessaie. »
  — réessayer ne sert à rien quand la cible a disparu. Nouveau texte `report.notFound` : « Cet élément est introuvable :
  il n'existe plus ou n'est plus visible. » (FR / EN).
- **Jeu d'essai** — les signalements survivaient au seed : un signalement OUVERT d'Aminata sur `seed-thomas` (passage
  précédent) rendait « Signaler ce profil » 409 au premier clic. `seed-deals.ts` purge les `Report` des comptes du
  seed (auteur, ou membre visé) avec les bookings et les avis.

### À trancher (produit)

- **« Tu ne peux pas signaler ton propre contenu » répond 400** (`OWN_TARGET`) : c'est un refus de droit, pas une
  requête mal formée — 403 serait plus juste ; le front mappe `status === 400` → aligner sur `details.code`.
- **Une annonce en pause ou annulée reste signalable** (seule la suppression et le masquage la rendent introuvable) ;
  voulu (elle a été visible) ou à fermer comme le masquage ?
- **Le doublon ne vaut que pour un signalement OUVERT** : après traitement, le même auteur peut signaler à nouveau la
  même cible — cohérent avec « notre équipe s'en occupe », à confirmer au registre.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **SIG-1** — La porte reprend le geste après connexion (A63) pour le favori ; ici elle se contente de rester sur la
  page — rouvrir la fenêtre de signalement après connexion (`onSignedInAction`) éviterait un second clic — petit.
- **SIG-2** — Les motifs par cible viennent du contrat (`REPORT_REASONS_BY_TARGET`) et l'accusé part dans la langue de
  l'auteur : bien. Le champ « Précisions » est limité à 500 sans compteur — petit.
- **SIG-3** — 409 traduit, sans révéler l'état du dossier : juste. Rien à ajouter.
- **SIG-4** — Le bouton disparaît ET l'API refuse : la double barrière. Le code 400 pour un refus de droit (voir « à
  trancher ») — petit.
- **SIG-5** — Le membre signalé n'apprend rien (ni cloche, ni email, ni bandeau) : conforme à SIG-01. Le profil offre
  cinq motifs dont « Usurpation d'identité » : bien.
- **SIG-6** — La visibilité d'une cible a trois causes (supprimée, masquée, privée) et le service n'en connaissait
  qu'une (ANO-WEB-79) : centraliser « est-ce visible ? » dans une règle partagée avec la page publique et la
  recherche (trip-service la connaît déjà) — moyen.
- **SIG-7** — Trois signalements = revue prioritaire, jamais une sanction : la règle SIG-03 tient (`priority` calculé
  à la lecture). Le seuil `REPORT_REVIEW_THRESHOLD` au catalogue des réglages (D62) — petit.
- **SIG-8** — Un `mailto:` avec la référence de l'avis : sobre et assumé. Ajouter l'auteur et le deal en corps du mail
  pré-rempli épargnerait une recherche au support — petit.
- **Transversal** — L'anomalie majeure est une **règle de visibilité dupliquée** (SIG-6) : quand plusieurs services
  décident « visible ou non », l'un finit par oublier une cause ; une seule fonction, testée, importée partout. La
  mineure est un **code HTTP traduit à la hache** (404 = « réessaie ») : traduire par `details.code`, jamais par le
  seul statut — petit.

### Pièges de poste payés ici

- **Les signalements survivaient au seed** (comme les avis en 5.22) : un OPEN du passage précédent fait 409 le premier
  clic ; le seed purge désormais `Report` (auteur ou cible du seed).
- **Le cron FAKE écrit au propriétaire pendant la fiche** (versements rejoués) : « aucune notification » se prouve sur
  les cloches NOUVELLES qui parlent d'un signalement ou de la cible, et « aucun email » sur un sujet, jamais sur le
  total.
- **`GET /trips/:id` est réservé au propriétaire** (401 / 403 pour un autre membre) : « l'annonce reste en ligne » se
  prouve par la page publique en fenêtre privée, pas par cette route.
- **Le masquage d'une annonce passe par l'API admin** (`adresseDeLApiAdmin()` + contexte `navigateurAdmin("mediateur")`,
  `POST … /hide` puis `DELETE`), le profil privé par manœuvre (`profilePublic: false`) — les deux dans un `finally`.
- **Une session `contexte.request` peut expirer** au fil d'une longue fiche (401) : préférer une preuve par l'écran
  ou un contexte fraîchement connecté.

## Chapitre 5.25 — Données personnelles : export et effacement · **CONFORME** (9 fiches jouées, 5 après correction · 5 anomalies closes dont 1 MAJEURE, + deux purges du jeu d'essai · 9 scénarios en série, 1 min 24)

`web-rgp.spec.ts`. Aminata (écran, export, blocage), Thomas (blocage « versement dû », contrepartie du compte effacé),
un compte **NEUF créé par l'écran** pour l'avertissement, la suppression réelle et « Membre supprimé » (il réserve sur
`bzv-perkg` par l'API, Thomas accepte, un message part, le deal est annulé à plus de 48 h — remboursement intégral —
puis le compte est effacé) ; `gru-completed` (João) et `bzv-disputed` (Chinwe) pour l'effacement du destinataire.
**La suppression ne touche jamais un compte du jeu d'essai.** Le quota de codes (6 par heure) est levé au démarrage
par `scripts/recette/otp-debloquer.ts` — sans quoi rejouer le chapitre dans l'heure n'envoie aucun code, en silence.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-RGP-1 | L'écran « Mes données » | **Conforme après correction** → `ANO-WEB-81` ; « Mes données » / « Ce que Yamba garde, ce que tu peux télécharger ou supprimer » ; bascule « Relance par email des messages non lus » / « Un email si un message reste sans lecture 15 minutes, au plus un par heure » ; bascule « Mesure d'audience » / « Pages vues, recherches, étapes de réservation — pour améliorer Yamba, jamais pour la publicité » ; les deux reflètent la préférence **du compte** servie par `/auth/me` ; carte « Télécharger mes données » (« …Une fois par 24 h. ») + « Télécharger » ; carte « Supprimer mon compte » (« Immédiat et irréversible… ») + « Supprimer » |
| WEB-RGP-2 | Télécharger ses données | **Conforme** — `POST /auth/me/data-export` → 403 `SUDO_REQUIRED`, la porte « Confirme que c'est bien toi » / « Pour ce geste sensible, on t'envoie un code à six chiffres par email. Il ouvre une fenêtre de 15 minutes sur cet appareil. » ; email « Ton code de confirmation Yamba » ; code saisi → le fichier se télécharge et l'écran dit « Ton fichier est téléchargé. (yamba-mes-donnees-2026-09-12.json) » |
| WEB-RGP-3 | Le contenu du fichier | **Conforme** — `format: "yamba-data-export/1"` ; 20 sections (profil, préférences, adresses, consentements, profil Voyageur, trajets, réservations, avis donnés/reçus, messages, rendez-vous, révélations de numéro, routes, favoris, suivis, notifications, signalements faits, demandes RGPD) ; chaque réservation porte `role` (SHIPPER pour Aminata) et SES montants ; **aucun code de livraison** (ni `deliveryCode`, ni `742891`, ni la forme chiffrée) ; aucun `reportsReceived`, `adminNote`, `disputesLostCount`, `trustScore`, `resolution` ; les avis reçus n'y sont que **révélés** ; l'export d'un VOYAGEUR (Thomas, 13 réservations) ne porte **aucune clé `recipient`**, ni « Clarisse », ni « +242061234567 », ni l'email de l'Expéditrice |
| WEB-RGP-4 | Un export par 24 heures | **Conforme après correction** → `ANO-WEB-84` ; second téléchargement → 400 `EXPORT_RATE_LIMITED` (`nextAt` servi), **aucun second fichier**, aucun nouveau code envoyé, et l'écran dit « Un seul export par 24 heures : tu pourras en redemander un demain. » (le message anglais du serveur n'apparaît plus). **Bon point** : le refus tombe AVANT la porte — pas de code envoyé pour rien |
| WEB-RGP-5 | La suppression bloquée par un deal vivant | **Conforme** — Aminata : `ACTIVE_DEAL`, `PENDING_REQUEST`, `RETENTION_HELD`, `ADMIN_ACCOUNT` ; Thomas : + `PAYOUT_PENDING`, `PUBLISHED_TRIP` ; le bandeau « Impossible pour l'instant : termine d'abord ce qui est en cours. » et **seulement** les motifs servis, dans la liste fermée ; ni « M'envoyer le code » ni le bouton de suppression ; **aucun code envoyé** |
| WEB-RGP-6 | Le texte d'avertissement | **Conforme** — sur le compte neuf (aucun bloqueur) : le texte exact du cahier, mot pour mot, sans bandeau de blocage |
| WEB-RGP-7 | Supprimer son compte | **Conforme avec constat** — « supprime » → bouton inactif ; « supprimer » → le champ **met en majuscules à la frappe** et le bouton s'active (le cahier attendait un refus) ; le geste → 403 `SUDO_REQUIRED`, la porte, le code, puis 200 ; déconnexion immédiate (retour `/fr`, plus de menu utilisateur, `/auth/me` 401) ; reconnexion refusée (401) ; email « Ton compte Yamba a été supprimé » **sans aucun lien** |
| WEB-RGP-8 | L'autre partie voit « Membre supprimé » | **Conforme après correction** → `ANO-WEB-83`, `ANO-WEB-85` ; le fil est intact et lisible (le message du compte effacé est là), la contrepartie s'affiche « **Membre supprimé** » (elle disait « Membre » — le prénom anonymisé seul), ni l'ancien prénom ni l'ancienne adresse nulle part ; « Voir le numéro » → 400 `TOO_EARLY` et le refus est **dit à l'écran** (il ne vivait que dans l'attribut `title`) ; aucun chiffre de téléphone ; le deal reste |
| WEB-RGP-9 | Le tiers destinataire effacé à 30 jours | **Conforme** — `destinataire-eligible.ts <id> 40` + `destinataire.ts` → `{examined: 1, redacted: 1}` ; le récapitulatif ne porte plus ni nom, ni téléphone, ni email (« — », `+00000000000`, `null`) ; le lien de suivi répond « Ce lien de suivi n'est plus valide » ; **le deal en litige n'est pas touché** (Clarisse et son numéro intacts) |

### Anomalies

- **ANO-WEB-81 (MAJEURE, close)** — la bascule « Mesure d'audience » n'était rendue **que si le FRONT portait une clé
  PostHog** (`analyticsConfigured()`), et son état venait du `localStorage` du navigateur. Or `analyticsOptIn` est une
  préférence **du compte** qui gouverne aussi la capture **serveur** (D66) : sur un déploiement où seul le serveur
  mesure, le membre ne pouvait plus se retirer, et sur un autre appareil la bascule mentait. La ligne est toujours
  rendue, son état vient de `/auth/me`, l'écriture est confirmée (et annulée si le serveur refuse) ; l'initialisation
  du PostHog navigateur reste conditionnée à la clé.
- **ANO-WEB-83 (mineure, close)** — la messagerie affichait « Membre » pour un compte effacé (le prénom anonymisé
  seul, qui se lit comme un prénom ordinaire) : `nomDeLaContrepartie` (message-service) rend « Membre supprimé », le
  libellé déjà employé par le back-office ; +3 tests message-service = **47**.
- **ANO-WEB-84 (mineure, close)** — le refus « un export par 24 h » s'affichait en **anglais** (le `message` brut du
  serveur) ; le front le dit par son `details.code` (A146).
- **ANO-WEB-85 (mineure, close)** — dans un fil, « Voir le numéro » refusé (trop tôt, contrepartie effacée) ne disait
  **rien** : le motif ne vivait que dans l'attribut `title` du bouton, et le bandeau n'apparaît qu'en arrivant par
  « Appeler » (`?focus=phone`). Un refus affiche désormais la même phrase.
- **ANO-WEB-82 (mineure, close)** — le fichier d'export se téléchargeait sous le nom de repli `yamba-mes-donnees.json`
  (sans la date) : CORS n'expose que six en-têtes par défaut, et `Content-Disposition` n'en fait pas partie — le
  navigateur le **cachait** au client. La passerelle l'expose (`exposedHeaders`, avec `x-correlation-id`).
- **Jeu d'essai** — deux fuites de plus : le **journal des demandes RGPD** (un export réussi bloquait le suivant
  pendant 24 h au passage d'après) et, avant lui, les avis (5.22) et les signalements (5.24) : `seed-deals.ts` purge
  désormais `DataRequest` des comptes du seed.

### À trancher (produit)

- **« Tape SUPPRIMER » accepte les minuscules** : le champ met en majuscules à la frappe, donc « supprimer » active le
  bouton. Le cahier veut un refus. Garder la commodité (et amender le cahier) ou refuser strictement ?
- **Le quota de codes (6 par heure, 1 min entre deux)** n'est jamais dit à l'écran : quand il est atteint, « M'envoyer
  le code » ne produit **rien de visible**. Un message (« trop de codes demandés, réessaie dans une heure ») manque.
- **Le refus de révélation du numéro sur un deal annulé** renvoie `TOO_EARLY` avec une date de départ future : le motif
  exact serait « ce deal est clos ». À préciser côté message-service.
- **L'ordre des clés de l'export** : le cahier dit « le fichier commence par `format` » ; il commence par `exportedAt`,
  puis `format`.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **RGP-1** — Deux bascules, deux sources de vérité auparavant (compte / navigateur) : maintenant une seule. Ajouter
  la date du dernier consentement (`consents` est déjà dans l'export) sous la bascule d'audience — petit.
- **RGP-2** — La porte au moment du geste (et non avant le formulaire) est le bon choix ; le fichier part en une
  requête. Pour un gros compte, servir un export **asynchrone** (email avec lien signé) éviterait un JSON de plusieurs
  mégaoctets dans la mémoire du navigateur — chantier.
- **RGP-3** — La liste blanche par rôle est nette (aucun `recipient` côté Voyageur). Les `notifications` (185 lignes
  ici) gonflent le fichier sans grand intérêt : les borner (90 jours) ou les documenter — petit.
- **RGP-4** — Le refus AVANT la porte évite un code inutile : très bien. Servir `nextAt` à l'écran (« demain à 16 h »)
  plutôt que « demain » — petit.
- **RGP-5** — Les bloqueurs sont une liste fermée servie par l'API et le front n'en invente aucun : exemplaire.
  Ajouter le **compte** par motif (« 3 deals en cours ») que le service calcule déjà (`counts`) — petit.
- **RGP-6** — Le texte dit ce qui reste et ce qui part, et nomme Stripe : rien à redire. Le lier à la politique de
  confidentialité — petit.
- **RGP-7** — Deux barrières (mot + code) pour un geste irréversible : bien. Le champ qui met en majuscules annule la
  première : soit on l'assume, soit on cesse de transformer la saisie — petit.
- **RGP-8** — Le fil survit au compte et l'identité disparaît : conforme au RGPD. Le libellé vient maintenant d'une
  règle pure et testée ; l'appliquer aussi aux avis publics et aux écrans de deal (mêmes comptes effacés) — moyen.
- **RGP-9** — L'effacement du tiers est piloté par un réglage (`privacy.recipientRetentionDays`) et respecte les états
  terminaux : très bien. Révoquer le lien de suivi dans la même passe (`revokedAt`) tracerait la cause côté admin
  sans la révéler côté public — petit (déjà proposé en 5.23).
- **Transversal** — Trois anomalies sur cinq sont des **vérités dupliquées** : un consentement lu dans le navigateur
  plutôt qu'au compte (81), un nom recomposé à l'écran plutôt que nommé par une règle (83), un refus traduit par son
  statut plutôt que par son code (84). La quatrième est une **couche de transport qui masque une donnée** (82 :
  CORS). Règle : une préférence a une seule source (le compte), un refus se dit par son `details.code`, et tout
  en-tête utile au client doit être exposé explicitement — moyen.

### Pièges de poste payés ici

- **Le quota de codes OTP (6 par heure, 1 minute entre deux)** grille au troisième rejeu du chapitre : plus aucun
  email ne part, **sans message à l'écran**, et la fiche échoue sur « aucun email ». `scripts/recette/otp-debloquer.ts
  <email>` lève les clés Redis ; le chapitre l'appelle dans son `beforeAll` pour Aminata et Thomas.
- **La fenêtre sudo est liée au `jti` de la session** : une session mémorisée d'un passage précédent peut encore en
  porter une ouverte, et la porte ne se présente pas. `navigateurConnecte(..., { parEcran: true })` donne un jti neuf.
- **Playwright efface le téléchargement à la fin de SA fiche** : lire le contenu du fichier dans la fiche qui le
  télécharge, jamais dans la suivante (le chemin pointe sur un artefact supprimé).
- **`GET /trips/:id` est réservé au propriétaire** (déjà payé en 5.24) et **une session `contexte.request` expire** au
  fil d'une longue fiche : préférer la preuve par l'écran.
- **`nx serve` a lâché message-service** après une édition (le port 6005 muet, la passerelle en 500 de 2 ms) : relancer
  en bundle (`node --env-file=../../.env dist/main.js`) et vérifier que le bundle porte bien la correction.
- **Le journal des demandes RGPD survit au seed** : sans purge, « un export par 24 h » refuse dès la première fiche du
  passage suivant.

## Chapitre 5.26 — Préférences, langue et relances · **CONFORME** (6 fiches jouées, 3 après correction · 3 anomalies closes dont 1 MAJEURE · 6 scénarios en série, 1 min 24)

`web-prf.spec.ts`. Aminata (bascule de langue, emails, écran « Paramètres »), Thomas (le Voyageur francophone qui
accepte), Pauline et `bzv-accepted` pour la relance des messages non lus (cron `unread-reminder` forcé par
`scripts/recette/relance-eligible.ts <fil> SHIPPER` puis `relance.ts`), une adresse libre pour l'inscription en
anglais. **Les préférences d'un compte survivent au seed** (il recrée trajets et deals, pas les réglages) : le
chapitre les pose lui-même dans son `beforeAll` — Aminata en français **avec la relance coupée**, Thomas en français
— et remet celles d'Aminata dans un `afterAll`.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| WEB-PRF-1 | La bascule de langue met à jour le compte | **Conforme** — `PATCH /auth/me/locale` → 200, l'URL passe en `/en/`, `/auth/me` sert `preferredLocale: "en"` ; après rechargement **puis déconnexion / reconnexion dans un contexte neuf** (navigateur en `fr-FR`), le compte est toujours en anglais et l'interface répond en anglais |
| WEB-PRF-2 | L'email suit la langue du destinataire (deux navigateurs) | **Conforme** — Aminata en anglais réserve `bzv-perkg` (devis exact par `payment-intents`, puis `POST /deals`), Thomas francophone accepte : Thomas reçoit « **Nouvelle demande de transport Paris → Brazzaville** » (aucun « request »), Aminata reçoit « **Your request Paris → Brazzaville was accepted** » (aucun « acceptée »), corps en « Hello » — la langue est celle du **destinataire**, jamais celle de l'auteur du geste |
| WEB-PRF-3 | Les emails sans compte suivent la langue de l'écran | **Conforme après correction** → `ANO-WEB-87` ; inscription réelle depuis `/en/register` → « **Your Yamba activation code** » (il partait « Ton code d'activation Yamba ») |
| WEB-PRF-4 | Désactiver la relance des messages non lus `[RGP11]` | **Conforme** — Pauline coupe la bascule dans « Mes données » (`PATCH /auth/me/preferences`, `messagingReminderEmails: false` relu par `/auth/me`), Thomas écrit, le fil reste non lu, la passe de relance est forcée : **aucun email à Pauline**, et la notification in-app « Nouveau message » est bien là |
| WEB-PRF-5 | L'écran « Paramètres » | **Conforme après correction** → `ANO-WEB-86` ; les quatre entrées du cahier sont là ; la bascule email affiche l'état **du serveur** (relance coupée en précondition) ; « Langue » → `PATCH /auth/me/locale` 200 dans les deux sens ; « Thème » → la classe `dark` de `<html>` apparaît puis disparaît, « Automatique » reste sélectionnable ; « Notifications email » → `PATCH /auth/me/preferences`, valeur relue côté serveur et **état conservé après rechargement** ; « Notifications push » → aucune bascule, aucun bouton |
| WEB-PRF-6 | Une langue non prise en charge est refusée | **Conforme après correction** → `ANO-WEB-88` ; `/es` → le middleware retient une langue connue (`/fr/es`) et répond **404** avec la page introuvable de Yamba (« Cette page n'existe pas », « Chercher un trajet », « Retour à l'accueil ») ; `/en/es` donne la même page traduite (« This page does not exist ») ; plus aucune trace du 404 interne de Next, aucune clé brute |

### Anomalies

- **ANO-WEB-87 (MAJEURE, close)** — les flux **sans compte** (code d'activation, mot de passe oublié, renvoi du code)
  passent par `authApi`, un client axios dédié qui ne posait **pas** l'en-tête `x-locale` — contrairement à
  `apiClient`. Conséquence double : l'email d'activation partait **toujours en français**, et le compte naissait avec
  `preferredLocale: "fr"` même pour une inscription faite en anglais — donc *tous* ses emails suivants aussi, jusqu'à
  ce que le membre trouve la bascule. Le client pose désormais la même interception (D44).
- **ANO-WEB-86 (mineure, close)** — l'écran « Paramètres » était un **reste de maquette** : « Langue » et « Thème »
  affichaient un bouton « Changer » sans gestionnaire (`onAction` optionnel, jamais passé), et « Notifications
  email » / « Notifications push » étaient deux bascules à `useState` local — elles bougeaient, rien n'était
  enregistré, et l'état repartait à sa valeur d'origine au rechargement. Un membre pouvait croire avoir coupé ses
  emails. Chaque ligne porte maintenant le réglage réel, **là où il a un effet** : la langue écrit le compte
  (sélecteur de l'en-tête réutilisé, D44), le thème passe par next-themes avec ses trois choix (Automatique / Clair /
  Sombre — une préférence d'affichage, sans effet serveur, donc le navigateur), « Notifications email » est branchée
  sur `messagingReminderEmails` (D61) et le libellé dit ce qu'elle couvre **et ce qu'elle ne couvre pas** (« les
  emails d'un Deal en cours ne se coupent pas »), « Notifications push » devient une ligne en lecture. `ToggleRow`
  est désormais **contrôlée** (`checked` + `onChangeAction`, `role="switch"`, `aria-checked`) et `SettingRow`
  n'affiche son bouton que si un gestionnaire existe : une bascule ou un bouton décoratif ne peut plus se glisser.
- **ANO-WEB-88 (mineure, close)** — une adresse qui ne correspond à **aucune route** (`/es`, réécrit `/fr/es` par le
  middleware next-intl) ne déclenche jamais `notFound()` : Next n'avait rien à afficher dans le segment `[locale]` et
  servait son **404 interne** — « This page could not be found. », en anglais quelle que soit la langue de l'URL, sans
  en-tête, sans pied de page et sans un lien pour revenir. La page introuvable du produit existait déjà
  (`[locale]/not-found.tsx`, soignée en 5.3) mais restait inatteignable. Une route attrape-tout
  `[locale]/[...rest]/page.tsx` qui appelle `notFound()` lui rend la main (façon documentée par next-intl ; les
  routes réelles, plus spécifiques, gagnent toujours contre elle).

### À trancher (produit)

- **Le cahier décrit l'ancien écran** : WEB-PRF-5 attendait « Notifications email · Demandes, messages, paiements » et
  « Notifications push · Alertes en temps réel ». Les libellés disent maintenant la vérité (relance des messages non
  lus ; push indisponible) — **le cahier doit être amendé** (§ 5.26), ou le produit doit livrer ces deux réglages.
- **Préférences email par famille d'événement** (demandes, messages, paiements, rappels de notation) : il n'en existe
  qu'une, `messagingReminderEmails`. Faut-il une granularité par famille, sachant que les emails d'un Deal en cours
  sont **contractuels** et ne doivent pas pouvoir être coupés ? **Candidat au registre (D-next)**, avec la liste
  fermée des familles coupables.
- **Notifications push** : rien n'est branché (ni service worker, ni abonnement, ni transport). À arbitrer avant de
  remettre une ligne active — **candidat au registre**, dans le même geste que ci-dessus.
- **Le thème n'est pas une préférence du compte** : il vit dans le navigateur (next-themes). Cohérent (aucun effet
  serveur), mais un membre qui change d'appareil retrouve « Automatique ». À assumer explicitement.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **PRF-1** — La bascule écrit le compte en *best-effort* (`.catch()` silencieux) et **ne fait rien si le profil n'est
  pas encore chargé** : la navigation a déjà eu lieu, la préférence est perdue sans que personne ne le sache (payé
  ici : la fiche a échoué une fois pour cette raison exacte). Rejouer l'écriture après le chargement du profil, ou
  poser la préférence côté serveur à partir du cookie `NEXT_LOCALE` — petit.
- **PRF-2** — La langue du destinataire est respectée jusque dans le sujet : exemplaire, et c'est la conséquence
  directe de D44 (un seul point de résolution, `resolveLocale`). Ajouter au harnais une garde qui **échoue** si un
  nouveau modèle d'email n'a pas ses deux langues — moyen (le miroir i18n de la CI ne couvre que les `messages/`).
- **PRF-3** — Le défaut venait d'un **second client HTTP** qui avait oublié une convention du premier. Il n'y a
  aucune raison d'avoir deux clients axios : `authApi` n'existe que pour ne pas rejouer le refresh sur les routes
  publiques — un `requireAuth: false` sur `apiClient` suffirait, et la convention ne pourrait plus se perdre — moyen.
- **PRF-4** — La préférence est lue par le cron **au moment de l'envoi** (pas au moment du message) : bon choix, elle
  vaut donc immédiatement. Elle mériterait un lien « me désabonner » dans le pied de l'email de relance lui-même —
  petit, et c'est la voie que les clients email attendent (`List-Unsubscribe`).
- **PRF-5** — Trois réglages, trois portées différentes (compte, navigateur, contractuel) sur un seul écran : le dire
  à l'écran (un mot sous le titre : « ce qui suit ton compte, ce qui suit cet appareil ») éviterait la question —
  petit. Et `SettingRow` / `ToggleRow` sont maintenant les deux seuls endroits où une ligne de réglage se dessine :
  y ajouter un état « enregistré » / « échec » unique (au lieu du message local) — petit.
- **PRF-6** — Le 404 du produit existait et n'était **jamais atteint** : le cas « aucune route » n'est pas couvert par
  les fiches d'une page. Ajouter au harnais une fiche transversale qui balaie une poignée d'adresses inconnues
  (`/es`, `/fr/inconnu`, `/fr/trips/inconnu`) et vérifie qu'aucune ne sert une page d'outil — petit.
- **Transversal** — Les trois anomalies sont trois **conventions non portées jusqu'au bout** : un en-tête posé par un
  client et pas par l'autre (87), un composant de maquette laissé en place et pris pour un composant de produit (86),
  une page d'erreur écrite mais pas branchée (88). Aucune n'est un défaut de règle métier : ce sont des **surfaces
  oubliées**. Deux gardes rendraient ces trois classes visibles : un seul client HTTP (une seule place pour les
  conventions), et une fiche « aucune page décorative » qui refuse un `role="switch"` ou un bouton sans effet
  réseau — moyen.

### Pièges de poste payés ici

- **Les préférences d'un compte survivent au seed** : Aminata arrivait avec sa relance déjà coupée par un passage
  précédent, et la fiche 5 échouait sur son premier constat. Un chapitre qui éprouve des réglages doit **poser son
  état de départ** (ici dans le `beforeAll`, et le remettre dans l'`afterAll`).
- **Trois `npx tsx` de suite dépassent les 60 s** sur un poste qui recompile le front en même temps
  (`spawnSync npx ETIMEDOUT`) : un seul processus pour tous les réglages, et un délai de 180 s.
- **Atlas a coupé en cours de session** (`Server selection timeout: No available servers`, réplique sans primaire) :
  le harnais échoue alors dans le `beforeAll`, et `GET /api/status` reste « down » jusqu'à 10 s après le retour (son
  cache). Vérifier `npx tsx --env-file=.env -e "…user.count()"` avant de conclure à une régression.
- **Le front Next finit par ne plus hydrater** après une longue série de passages (page servie en 200, formulaire
  inerte, « le formulaire n'a jamais envoyé sa requête ») : relancer `npx nx dev user-ui` suffit.
- **Docker Desktop relance les dix-sept conteneurs étrangers** à chaque démarrage (deux Elasticsearch à eux seuls
  tiennent 4 Gio) : la charge moyenne monte à 6–7 et c'est ce qui produit les délais d'attente ci-dessus. Les arrêter
  avant une campagne.

## Chapitre 5.27 — Le consentement à la mesure d'audience · **CONFORME** (6 fiches jouées + 1 contre-épreuve, 2 après correction · 2 anomalies closes · 7 scénarios, 2 passes, 1 min 36 + 19 s)

`web-ana.spec.ts`. Le chapitre exige `NEXT_PUBLIC_POSTHOG_KEY` et `NEXT_PUBLIC_POSTHOG_HOST` posées (cahier § 5.27,
sinon tout est `⏭`). **Il ne s'est donc pas contenté du `⏭`** : la clé de recette `phc_recette_web_5_27` et l'hôte
`http://127.0.0.1:9977` ont été posés dans `apps/user-ui/.env.local`, et le chapitre démarre **son propre
collecteur** — `scripts/recette/collecteur-audience.ts`, un faux PostHog local qui répond comme le vrai
(configuration distante, drapeaux, extensions inertes) et écrit chaque événement reçu dans un fichier. Rien ne sort
du poste, et la fiche 3 lit **exactement** ce que le navigateur aurait envoyé. La mesure SERVEUR (`POSTHOG_API_KEY`)
reste absente : elle n'est pas du ressort de ce chapitre, et elle ne serait pas observable de la même façon.

**Deux passes, chacune honnête sur sa précondition** : les fiches 1 à 5 avec la clé, la fiche 6 (« sans clé ») après
l'avoir retirée et redémarré le front. Chaque fiche se saute d'elle-même si sa précondition n'est pas remplie — le
chapitre est donc rejouable dans les deux états du poste. **État laissé au poste : les deux lignes sont COMMENTÉES**
dans `.env.local` (pas de bannière pour les chapitres suivants ni pour les parcours) ; les décommenter et redémarrer
le front suffit à rejouer 1 à 5.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| WEB-ANA-1 | La bannière s'affiche | **Conforme** — `role="dialog"` « Mesure d'audience », le texte du cahier **mot pour mot**, les trois éléments (« En savoir plus » lien, « Accepter », « Refuser ») ; **même poids visuel** mesuré : même hauteur (à 2 px), largeurs comparables, même taille de police, et « Refuser » est un vrai `<button>` (jamais un lien de bas de page) |
| **ANO-WEB-89** | La bannière ne condamne aucun bouton (contre-épreuve) | **Conforme après correction** — sur `/fr/login`, la bannière recouvrait « Se connecter » et « Inscris-toi » et le clic était **intercepté par le dialogue** (mesuré en 1280×720, sans défilement possible) ; elle publie maintenant sa hauteur (`--yamba-consent-space` = 187 px ici), la page peut défiler d'au moins sa hauteur, un défilement libère le bouton (`elementFromPoint` renvoie le bouton), et la place est **rendue** dès qu'on a répondu |
| WEB-ANA-2 | Refuser ne charge rien | **Conforme** — après « Refuser » : **aucune** requête vers l'hôte de mesure sur accueil → recherche → page d'un trajet → accueil, **aucun** événement au collecteur, **aucune** clé `ph_…` (le SDK n'a jamais démarré), et la bannière ne revient pas, même après rechargement. *Constat : en développement, `next dev` précharge le chunk `node_modules_posthog-js_…js` — vérifié absent du build de production (HTML servi et scripts chargés après un refus), c'est un artefact du serveur de développement, pas un chargement du SDK.* |
| WEB-ANA-3 | Accepter, et vérifier ce qui part | **Conforme après correction** → `ANO-WEB-90` ; le SDK démarre après l'accord (clé `ph_…`), puis partent `$pageview`, `search_performed` (**`origin: "Paris"`, `destination: "Brazzaville"`, `resultsCount` numérique** — les deux premiers partaient toujours à `null`), `trip_viewed` (avec `tripId`), `booking_step_viewed`, `$identify` (l'**identifiant** du compte, jamais autre chose) ; **aucune donnée personnelle** dans ce qui part : ni prénom, ni nom, ni email du membre, ni code de livraison (`742891`, `742 891`), ni prénom/nom/numéro du destinataire |
| WEB-ANA-4 | Le choix suit le compte | **Conforme** — `analyticsOptIn: true` relu au serveur, puis un **second navigateur neuf** connecté au même compte : aucune bannière, et le choix est recopié dans le navigateur (`yamba.analytics.consent` = `granted`) |
| WEB-ANA-5 | Retirer son accord | **Conforme** — bascule « Mesure d'audience » dans « Mes données » → `PATCH /auth/me/preferences`, `analyticsOptIn: false` relu au serveur ; ensuite, recherche + accueil + rechargement : **aucune requête, aucun événement**. *Constat : le retrait n'annule pas ce qui était déjà capturé — le SDK vide sa file dans la seconde qui suit (ici les deux pages vues de l'écran « Sécurité », capturées quand l'accord tenait encore).* |
| WEB-ANA-6 | Sans clé, rien ne s'affiche | **Conforme** (seconde passe, clés retirées, front redémarré) — aucune bannière, aucun envoi, aucune clé `ph_…`, la page est normale, et **aucune erreur de console** hors les deux 401 du sondage de session (ANO-WEB-01, connus depuis 5.3) |

### Anomalies

- **ANO-WEB-89 (mineure, close)** — la bannière de consentement est `fixed` en bas d'écran et **ne réservait aucune
  place**. Sur les pages calées sur la hauteur de la fenêtre (les onze écrans d'authentification, la vitrine, le
  tableau de bord), elle recouvrait le bas de la carte : sur la page de connexion, en 1280×720, « Se connecter » et
  « Inscris-toi » étaient sous le dialogue, le clic **intercepté**, et la page ne défilait pas — il fallait répondre à
  la bannière pour pouvoir se connecter. Correction en deux temps : la bannière publie sa hauteur dans
  `--yamba-consent-space`, et `global.css` en déduit `--yamba-viewport` (`calc(100vh - var(--yamba-consent-space))`)
  dont les **quatorze** mises en page en `calc(100vh-…)` se servent désormais. Résultat : le contenu se recentre
  au-dessus de la bannière, la page peut défiler de sa hauteur, et tout est rendu dès qu'on a répondu.
- **ANO-WEB-90 (mineure, close)** — `search_performed`, le premier événement du funnel (D66 3A), lisait
  `params.origin` et `params.destination`. Ces deux clés **n'existent pas** dans `SearchTripsParams` : les critères
  s'appellent `from` et `to`. L'événement partait donc toujours avec `origin: null, destination: null` — la mesure
  n'a jamais pu dire **quel corridor** était cherché, alors que c'est précisément le signal dont le pilotage (D59,
  D74) et la « demande visible » (chantier proposé au handoff) ont besoin. Les noms de propriétés ne changent pas
  (contrat de la mesure, en anglais) : seule la lecture est corrigée. Un défaut que le typage ne pouvait pas
  attraper — les deux lectures étaient **castées** (`(params as { origin?: string }).origin`).

### À trancher (produit)

- **La page où l'on accepte n'est jamais comptée.** L'effet des pages vues (`AnalyticsProvider`) ne dépend que du
  chemin : au moment du clic sur « Accepter » il a déjà renoncé, et il ne repasse qu'à la navigation suivante. La
  première page d'une visite manque donc systématiquement à la mesure. Sans conséquence pour la vie privée, mais le
  taux d'entrée est faux : ajouter le consentement aux dépendances de l'effet (ou capturer la page courante dans
  `choose("granted")`).
- **Le retrait ne jette pas ce qui est déjà en file.** `disableAnalytics()` appelle `opt_out_capturing()` +
  `reset()`, mais la file du SDK se vide quand même (mesuré : deux pages vues parties juste après le retrait).
  Défendable — ces événements avaient été capturés **sous consentement** — mais à dire dans la politique de
  confidentialité, ou à jeter explicitement.
- **En développement, chaque page vue part en DOUBLE** (deux `$pageview` identiques, `$prev_pageview_duration` de
  0,036 s) : c'est le double appel des effets de React en `StrictMode`. À vérifier sur le build de production avant
  de lire les chiffres — sinon toute la mesure est à diviser par deux.
- **Le `$pageview` porte l'URL complète** (`$current_url`, `$pathname`). Aujourd'hui sans conséquence, mais la page
  publique du destinataire vit sous `/fr/track/<jeton>` : si un destinataire accepte la mesure sur cette page, **le
  jeton du lien de suivi partirait au collecteur**. Le jeton est une capacité (il ouvre le suivi sans compte) :
  normaliser le chemin (`/fr/track/:jeton`) avant capture. À trancher avant d'activer la mesure en production —
  **candidat au registre**.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **ANA-1** — Le texte de la bannière est dans `messages/*/consent.json` et la fiche le compare mot pour mot : bonne
  chaîne de garde. La bannière n'a ni `aria-modal` ni piège de focus, et elle n'est pas la première chose lue par un
  lecteur d'écran : la poser en `role="region"` annoncé (ou la rendre focalisable à l'ouverture) serait plus juste —
  petit.
- **ANO-WEB-89** — La correction a créé une variable de mise en page (`--yamba-viewport`) : c'est le bon endroit
  pour toutes les bannières à venir (maintenance, lecture seule, cookies) — et le bandeau de maintenance (D64), qui
  est en flux, n'a pas ce défaut. Y ajouter la même mesure pour la barre mobile éventuelle — petit.
- **ANA-2** — « Aucun script chargé » est la seule phrase du cahier qui n'est pas vérifiable telle quelle en
  développement (Next précharge le module). La preuve retenue est meilleure : aucune requête, aucun événement,
  aucune clé `ph_…`. À reprendre dans le cahier — petit.
- **ANA-3** — La liste des événements est courte et lisible (`search_performed`, `trip_viewed`,
  `booking_step_viewed`, `booking_payment_started`, `booking_created`, `tracking_link_shared`, `trip_published`), et
  aucune ne porte de donnée personnelle. Elle mériterait un **test unitaire** côté front qui interdit d'ajouter une
  propriété hors liste blanche — l'équivalent de `analyticsEventsFor` côté serveur (D66), qui, lui, est protégé —
  moyen.
- **ANA-4** — Reprendre le choix du compte sans redemander est exactement ce qu'il faut ; le consentement est écrit
  en *best-effort* (`.catch(() => undefined)`) : un échec réseau laisse le navigateur en accord et le compte sans
  rien, et la bannière reviendra sur l'autre appareil. Rejouer l'écriture (ou la confirmer comme la bascule de
  « Mes données ») — petit.
- **ANA-5** — Le retrait passe par la préférence du compte (leçon d'ANO-WEB-81) et vaut immédiatement : très bien.
  Jeter la file du SDK au retrait, et journaliser le retrait dans `ConsentLog` comme l'acceptation — petit.
- **ANA-6** — « Aucune clé, aucune bannière » est correct, mais c'est aussi ce qui a produit ANO-WEB-81 : la bascule
  de « Mes données » ne doit **pas** disparaître avec la clé du front (elle gouverne la mesure serveur). C'est déjà
  le cas depuis 5.25 ; la fiche 6 le confirme indirectement — rien à faire.
- **Transversal** — Les deux anomalies sont de la même famille que celles de 5.26 : **une convention qui ne va pas
  jusqu'au bout** (une bannière fixe qui ne réserve pas sa place) et **une lecture de champ jamais vérifiée** (un
  cast qui ment). La parade générique existe pour la seconde : interdire les `as { … }` sur des objets dont le type
  est connu — un `origin` inexistant serait devenu une erreur de compilation. À porter comme règle de revue — moyen.

### Pièges de poste payés ici

- **Un faux collecteur qui répond mal rend la mesure muette, sans un mot.** Sans configuration distante crédible, ou
  avec les extensions (sondages) servies **vides**, la fin de `init()` échoue : `capture()` est appelé, rien ne part,
  et l'on conclurait « aucune mesure » alors qu'on a cassé le SDK soi-même. Le collecteur sert donc des extensions
  inertes mais **bien formées**, et refuse `config.js` en 404 pour que le SDK retombe sur la variante JSON.
- **posthog-js REFUSE de capturer depuis un navigateur automatisé** : `_is_bot()` renvoie `!!navigator.webdriver` et
  `capture()` s'arrête là, en silence (1.427.2, `opt_out_useragent_filter` non posé). Diagnostic obtenu en lisant le
  `dist` du SDK après trois impasses. Le harnais masque ce **seul** drapeau ; sans lui, les fiches « rien ne part »
  seraient vraies pour la mauvaise raison.
- **`storageState` mémorise aussi le `localStorage`** : dès qu'une fiche a accepté, la session enregistrée d'Aminata
  porte `yamba.analytics.consent` et la bannière ne se présente plus — dans ce chapitre **comme dans les suivants**.
  Chaque fiche repart donc « sans choix » (`partirSansChoix`), et l'`afterAll` oublie la session mémorisée.
- **`networkidle` n'arrive jamais quand le SDK tourne** (le collecteur est sollicité en continu) : `page.goto` en
  délai d'attente de 120 s. Tout le chapitre navigue en `domcontentloaded` et attend ensuite ce qu'il vise.
- **Un événement se rate en naviguant trop vite** : `search_performed` et `trip_viewed` manquaient parce que la
  fiche était déjà sur l'écran suivant. Chaque étape attend SON événement (`expect.poll` sur le journal).
- **Le poste a lâché deux fois** : Atlas (réplique sans primaire) a fait échouer le seed en 180 s, et la charge
  moyenne montait à 10 avec les dix-sept conteneurs Docker étrangers relancés par Docker Desktop. Le back-office
  (3001) a été arrêté pour ce chapitre — il n'y sert pas.

## Chapitre 5.28 — Le mode maintenance vu du membre · **CONFORME** (4 fiches jouées, 1 après correction · 1 anomalie close · 4 scénarios en série, 1 min 42)

`web-mnt.spec.ts`. L'état vit dans UN document `PlatformSettings` (clé `maintenance`, D64 1A) écrit par un **OPS**
(Olivier Exploitation) avec un motif d'au moins 20 caractères ; la passerelle le relit **toutes les 10 s** et refuse
alors toute ÉCRITURE (`503 MAINTENANCE`) sauf `/api/auth/*` et `/api/admin/*` ; les deux fronts lisent
`GET /api/maintenance` (sondage 60 s) pour leurs bandeaux. **L'annonce est posée par l'écran du back-office**
(« État des services », `npx nx dev admin-ui` requis) — c'est le geste du cahier — et les bascules suivantes par
l'API d'administration, plus rapides. Le `beforeAll` et l'`afterAll` remettent le document **à plat directement en
base** : une fiche qui échoue au mauvais moment laisserait la plateforme en lecture seule pour tous les chapitres
suivants.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| WEB-MNT-1 | Le bandeau d'annonce | **Conforme** — l'OPS annonce une maintenance dans 1 h **depuis l'écran** (PUT `/admin/maintenance` 200, relu : `enabled: false`, `scheduledAt` posée) ; côté membre, bandeau **ambre** (`rgb(251, 191, 36)`) « Maintenance prévue le {date} : la plateforme passera en lecture seule pendant l'intervention. » ; **rien n'est bloqué** — un message part (2xx) |
| WEB-MNT-2 | La lecture seule | **Conforme après correction** → `ANO-WEB-91` ; bandeau **rouge** (`rgb(220, 38, 38)`) au texte exact du cahier ; **lectures intactes** (recherche Paris → Brazzaville avec résultats, page d'un trajet, fil de messagerie, « Mes envois ») ; **écritures refusées** : intention de paiement `503`, message `503`, publication de trajet `503`, chacune avec `MAINTENANCE` ; **le refus est dit à l'écran** (« La plateforme est en maintenance : réessaie dans quelques minutes. » — il ne l'était nulle part) ; **connexion et rafraîchissement intacts** (une connexion par l'écran aboutit pendant la maintenance) |
| WEB-MNT-3 | La levée | **Conforme** — la passerelle applique la levée en **moins de 15 s** (mesuré), l'écriture reprend immédiatement (message 2xx), et le bandeau a disparu au rechargement |
| WEB-MNT-4 | La maintenance pendant une réservation | **Conforme** — assistant mené jusqu'à l'étape 4 (autorisation demandée AVANT la bascule), puis lecture seule : « Payer » → `503`, refus **dit à l'écran**, on reste sur l'assistant, **aucune réservation créée, rien d'autorisé** ; après la levée, le même bouton crée la demande et l'écran passe sur `/bookings/<id>` |

### Anomalies

- **ANO-WEB-91 (mineure, close)** — la passerelle refuse proprement les écritures (`503 MAINTENANCE` +
  `Retry-After`), mais **le membre ne l'apprenait pas** : chaque écran affichait son erreur générique (mesuré dans un
  fil : « Le message n'a pas pu être envoyé. »), et la phrase prévue pour ce cas — `maintenance.writeRefused`,
  présente dans les deux dictionnaires depuis D64 — n'était rendue **nulle part**. Corrigé comme la session expirée
  (A89) : `api-client` émet un signal global `yamba:maintenance-refused` sur un 503 dont le code vaut `MAINTENANCE`
  (à la racine **ou** dans `details`), et le bandeau de maintenance l'écoute — il dit la raison et **relit son état
  sans attendre son sondage de 60 s**. Effet secondaire heureux : un membre déjà sur la page voit le bandeau rouge
  dans la seconde où sa première écriture est refusée, au lieu d'attendre une minute.

### À trancher (produit)

- **La passerelle ne suit pas la convention maison pour son code de refus** : elle rend `{ code: "MAINTENANCE" }` à
  la racine, alors que tout le reste de la plateforme passe par `details.code` (A146) — c'est pour cela qu'aucun
  écran ne le reconnaissait. Le correctif accepte les deux formes ; aligner la passerelle serait plus propre.
- **Le bandeau arrive avec un retard pouvant aller jusqu'à 60 s** pour un membre déjà sur une page (sondage du
  front). Acceptable, et désormais rattrapé par le premier refus d'écriture ; un événement serveur (SSE) le rendrait
  immédiat, au prix d'une connexion permanente.
- **Rien n'empêche d'activer la lecture seule pendant qu'un membre est à l'étape de paiement** (c'est le sujet de
  MNT-4, et le comportement est correct : rien n'est autorisé). Le back-office pourrait afficher le nombre de
  réservations en cours d'autorisation avant de basculer — confort d'exploitation.
- **Le message personnalisé de l'admin s'ajoute à la phrase du bandeau mais pas au refus d'écriture** : le toast dit
  la phrase générique. À unifier si l'on veut expliquer la cause (« mise à jour de la base, retour à 23 h 30 »).

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **MNT-1** — L'annonce et la lecture seule sont **le même document** avec deux champs : c'est simple et lisible, et
  le back-office le dit en clair (« le bandeau est affiché, rien n'est bloqué »). Il manque une date de FIN prévue :
  le membre lit « prévue le … » sans savoir combien de temps — petit.
- **MNT-2** — La liste des exemptions (`/api/auth/`, `/api/admin/`, `/api/maintenance`) est une constante pure,
  testée côté auth-service : exactement au bon endroit. Ajouter `GET` explicitement dans le nom de la règle
  (`MAINTENANCE_WRITE_METHODS`) évite de croire qu'un `GET` vers `/api/deals` pourrait être bloqué — cosmétique.
- **MNT-3** — Dix secondes de sondage côté passerelle, soixante côté front : les deux chiffres sont dans le code et
  dans la documentation, et la fiche mesure le premier. Exposer l'instant du dernier rafraîchissement dans
  `GET /api/maintenance` aiderait l'exploitation à savoir quand la bascule sera effective — petit.
- **MNT-4** — Le cas le plus délicat du chapitre est le mieux traité : l'autorisation n'est demandée qu'au montage
  de l'étape 4, et la création du deal est un second appel — la maintenance tombe donc entre les deux sans laisser
  d'argent en suspens. Le harnais garde la preuve qu'aucune réservation n'est créée.
- **Transversal** — L'anomalie est la même famille que celles de 5.26 et 5.27 : **une convention qui ne va pas
  jusqu'au bout** (un code de refus qui n'emprunte pas le chemin que tous les écrans lisent). Le remède retenu — un
  signal global écouté par la surface concernée — est le deuxième de ce genre après la session expirée (A89) : cela
  commence à faire un patron, à documenter comme tel.

### Pièges de poste payés ici

- **Une fixture de navigateur vit le temps d'UNE fiche** : ouvrir le navigateur d'administration dans un `beforeAll`
  donne « Target page, context or browser has been closed » à la fiche suivante. Chaque fiche ouvre le sien (la
  session est mémorisée, donc c'est peu coûteux), et le filet de sécurité passe par la base, pas par une session.
- **L'éditeur de maintenance du back-office se remonte à chaque sondage (30 s)** : remplir ses champs trop tôt, c'est
  remplir un formulaire qui sera remplacé — l'annonce partait alors **sans date**, et le PUT répondait quand même
  200. On attend la phrase qui ne s'affiche qu'avec les données, puis on **vérifie que la saisie a tenu**
  (`inputValue`) avant de cliquer.
- **`input[type="text"]` ne matche pas un `<input>` sans attribut `type`** : les champs « Message FR / EN » du
  back-office s'écrivent sans type, et un sélecteur trop littéral les manque.
- **La passerelle garde son état 10 s** : charger l'écran du membre juste après l'écriture, c'est le charger dans la
  fenêtre de cache et conclure « pas de bandeau ». Chaque fiche attend d'abord que `GET /api/maintenance` ait
  basculé.
- **Le fil de `bzv-accepted` appartient à Pauline** (et à Thomas) : c'est son navigateur qui doit tenter l'écriture
  refusée, pas celui d'Aminata — sinon il n'y a même pas de zone de saisie à l'écran.
- **Les résultats de recherche arrivent après le titre** : lire le corps de la page juste après la navigation ne
  montre que l'en-tête (« Tous les trajets disponibles »). On attend le contenu (`expect.poll`).

## Chapitre 5.29 — Pages d'erreur et page introuvable · **CONFORME** (5 fiches jouées, 1 après correction · 1 anomalie close · 5 scénarios en série, 2 min 06)

`web-err.spec.ts`. **Comment on déclenche un incident** : le cahier prévoit de « demander à un développeur un moyen
sûr de déclencher l'erreur » — c'est fait. Deux routes de recette lèvent une panne volontaire,
`/fr/dev/erreur` (hors tunnel) et `/fr/bookings/dev-erreur` (dedans, car la frontière n'ajoute la phrase sur le
paiement que sous `/book` ou `/bookings`) ; elles répondent **page introuvable en production**
(`notFound()` dès que `NODE_ENV === "production"`). `?type=chunk` lève une erreur portant la signature d'un morceau
de code manquant — ce que produit une version publiée pendant la navigation.

**Les autres méthodes ont été essayées, et leur échec est un résultat** : couper la passerelle ne fait pas tomber la
frontière d'erreur (les écrans se chargent côté navigateur et affichent leurs propres états d'erreur), pas plus
qu'une charge d'API malformée (`{"notifications": 42}`, `{"booking": null}`…), ni un morceau de code coupé sur une
page qui n'en charge pas, ni une charge RSC en 500. **L'application est gardée partout où on l'a poussée** — ce qui
est excellent, et qui explique pourquoi la fiche 3 avait besoin d'une porte dédiée.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| WEB-ERR-1 | La page introuvable | **Conforme** — `/fr/cette-page-nexiste-pas` répond **404** avec « Cette page n'existe pas », le texte exact du cahier et les trois actions (« Chercher un trajet », « Publier un trajet », « Retour à l'accueil ») ; **aucune trace technique**, et plus jamais le 404 interne de Next (acquis d'`ANO-WEB-88`, chapitre 5.26) |
| WEB-ERR-2 | Trajet et profil inexistants | **Conforme** — `/fr/trips/000000000000000000000000` → « Trajet introuvable » / « Ce trajet n'existe pas ou n'est plus disponible. » ; `/fr/u/slug-inexistant` → « Profil introuvable » / « Ce profil n'existe pas ou a été supprimé. » ; aucun indice sur l'existence réelle, aucune trace |
| WEB-ERR-3 | La page d'erreur générale | **Conforme après correction** → `ANO-WEB-92` ; hors tunnel : titre, message de réassurance, « Réessayer » et « Retour à l'accueil », **pas** la phrase du paiement ; **référence d'incident** présente (le `digest` de Next suffit, même sans Sentry), copiable — le **contenu du presse-papiers est vérifié** — avec « Communique-la au support si le problème se répète. » et « Écrire au support » ; dans le tunnel (`/fr/bookings/…`) : la phrase « Aucun paiement n'a été effectué. Ta carte n'a pas été débitée et aucune demande n'a été envoyée au Voyageur. » s'affiche **avant les actions** ; aucune trace de pile nulle part |
| WEB-ERR-4 | La version publiée pendant la navigation | **Conforme** — `?type=chunk` : le message devient « Une nouvelle version de Yamba vient d'être publiée. Recharge la page pour la récupérer. », le bouton devient « **Recharger la page** » et « Réessayer » disparaît ; le message d'incident ordinaire et la réassurance paiement s'effacent |
| WEB-ERR-5 | Une erreur ne montre jamais de code | **Conforme** — cinq situations (trajet inexistant, service de recherche muet, session expirée, formulaire refusé, refus métier **codé** : réserver son propre trajet) : dans aucune le membre ne lit un chemin de fichier, une trace, `QUOTE_DIVERGENCE` / `SUDO_REQUIRED` / `P2002` / `PrismaClient`, ni un message anglais brut (« Not Found », « Bad Request », « Something went wrong »…) |

### Anomalies

- **ANO-WEB-92 (mineure, close)** — la référence d'incident se copie par `navigator.clipboard`, qui **n'existe pas
  hors contexte sécurisé** : le `catch` de la page d'erreur ne faisait rien, le bouton ne répondait pas, et le
  membre ne savait pas s'il tenait la référence à donner au support — au pire moment, celui où il en a besoin. Même
  règle qu'`ANO-WEB-59` (code de livraison, chapitre 5.17) : un échec se dit. `errors.boundary.copyFailed` est
  ajoutée en FR et en EN, et la page l'affiche en cas d'échec.

### À trancher (produit)

- **Le lien « Écrire au support » vit à l'intérieur du bloc de référence** : s'il n'y a ni `digest` ni Sentry, tout
  le bloc disparaît — et avec lui l'action que le cahier compte parmi les trois. Sortir le lien du bloc (le support
  doit être joignable même sans référence) — petit, mais c'est un vrai trou fonctionnel.
- **Le cahier parle d'un « toast “Référence copiée” »** ; l'implémentation change le **libellé du bouton** pendant
  deux secondes. C'est équivalent à l'usage (et plus discret) : amender le cahier plutôt que le produit.
- **La référence fait 8 caractères quand elle vient de Sentry, mais la longueur du `digest` de Next varie** : la
  fiche accepte 6 à 12 caractères. Normaliser (toujours 8) éviterait qu'un membre et le support ne parlent pas de la
  même chaîne.
- **Les deux routes de panne sont livrées dans l'application** (inertes en production). C'est assumé et documenté :
  elles donnent à la recette un moyen **stable** de revérifier la page d'erreur à chaque campagne. À retirer le jour
  où un environnement de préproduction permet de couper une dépendance serveur pour de vrai.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **ERR-1** — La page introuvable est complète et branchée (5.26) ; il lui manque la seule chose qu'un membre
  cherche parfois : un champ de recherche directement dans la page, plutôt qu'un lien vers `/search` — petit.
- **ERR-2** — Deux écrans différents pour deux ressources introuvables, avec des textes propres : très bien. Ils ne
  répondent pas **404** au niveau HTTP (la page existe, la ressource non) — sans importance pour le membre, mais
  un `notFound()` rendrait le statut cohérent pour les robots et le référencement — moyen.
- **ERR-3** — La hiérarchie de l'information est juste : la question d'argent d'abord, la référence ensuite, la
  trace jamais. Deux améliorations : sortir « Écrire au support » du bloc de référence, et joindre au courriel
  pré-rempli le chemin de la page (le `mailto:` ne porte que la référence) — petit.
- **ERR-4** — Reconnaître un déploiement à la signature de l'erreur (`ChunkLoadError`, « Loading chunk ») est la
  bonne heuristique, et le bouton change vraiment de geste. Recharger **automatiquement** après trois secondes
  (avec un compte à rebours visible) éviterait au membre de comprendre ce qui s'est passé — moyen.
- **ERR-5** — Aucun code technique ne fuit, y compris sur un refus métier qui, lui, en porte un (`details.code`) :
  la chaîne « code serveur → phrase traduite » tient. La garde mériterait d'être **automatique** : un test qui
  balaie les écrans d'erreur et refuse toute chaîne en majuscules_avec_underscores — moyen.
- **Transversal** — Ce chapitre est le seul où **rien n'a été trouvé côté produit sauf un échec silencieux** : les
  pages d'erreur, écrites après un constat de recette, tiennent. La leçon est ailleurs — dans ce qu'il a fallu pour
  les éprouver : une application bien gardée ne tombe pas sur commande, et il faut alors une **porte de panne**
  explicite plutôt qu'une astuce fragile.

### Pièges de poste payés ici

- **`innerText` sur un `body` CLONÉ (détaché) retombe sur `textContent`** : on récupère alors le contenu des
  `<script>`, charge RSC comprise — des milliers de caractères qui ressemblent à une fuite technique. Le `body`
  **vivant** ne rend que ce qui est affiché, et la fenêtre d'erreur de Next (un `nextjs-portal` à racine fantôme)
  n'en fait pas partie : c'est la bonne lecture.
- **`waitUntil: "domcontentloaded"` rend la main avant le rendu** : lire le corps tout de suite donne une chaîne
  vide. Chaque fiche attend son titre avant de lire.
- **Le presse-papiers n'existe pas sur l'adresse LAN du poste** (contexte non sécurisé) : le harnais en interpose un
  en mémoire de page (`observerLePressePapiers`, déjà employé aux chapitres 5.17 et 5.23) — et c'est en le posant
  qu'on découvre l'anomalie inverse, l'absence de message quand il n'y en a pas.
- **Une application bien gardée résiste aux pannes simulées** : quatre méthodes (passerelle coupée, charge d'API
  malformée, morceau de code coupé, charge RSC en 500) n'ont produit aucune frontière d'erreur. Ne pas s'acharner :
  demander la porte de panne, et **consigner** que les gardes tiennent.

## Chapitre 5.30 — Responsive mobile · **CONFORME** (10 fiches jouées, 1 après correction · 1 anomalie close · 10 scénarios en série, 1 min 06)

`web-mob.spec.ts`. Tout se joue en **émulation iPhone 14 (390 × 844, tactile)** — sauf `WEB-MOB-7`, à 800 px. Le
harnais a gagné pour l'occasion une option `{ mobile: true }` sur ses deux fabriques de navigateur : ce n'est pas un
`viewport` étroit, c'est `isMobile` + `hasTouch` + un agent utilisateur de téléphone, **parce que le produit rend des
arbres différents** (feuilles du bas, barres collantes, `useIsMobile`). Sans cela, le chapitre aurait éprouvé
l'arbre desktop dans une fenêtre étroite — et n'aurait rien prouvé.

**La règle générale du cahier** (la page ne défile jamais horizontalement) est portée par deux garde-fous partagés :
`aucunDebordement()`, qui **nomme l'élément fautif** (sélecteur, bord droit, largeur d'écran) plutôt que de dire
« ça déborde » ; et `rienNeSortDuCadre()`, qui exempte ce qui défile **dans son propre cadre**
(`overflow-x: auto|scroll`) — une rangée de réponses rapides a le droit de dépasser, pas de pousser la page.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| WEB-MOB-1 | Accueil et en-tête | **Conforme** — aucun débordement, le bouton de recherche tient dans l'écran, le menu s'ouvre en panneau (« Fermer le menu ») et se referme par le voile |
| WEB-MOB-2 | Recherche et filtres en feuille du bas | **Conforme après correction** → `ANO-WEB-93` ; les cartes portent prix et kilos, la feuille s'ouvre, tient dans l'écran, s'applique par « **Voir 5 trajets** » et se ferme **par Échap** (qui ne faisait rien) |
| WEB-MOB-3 | Barre de réservation mobile | **Conforme** — prix et « Réserver » dans une barre du bas, **toujours là après défilement**, dans l'écran |
| WEB-MOB-4 | Assistant en feuille du bas | **Conforme** — « Détail » ouvre le récapitulatif, « Masquer » le referme, aucun champ de l'étape ne sort de l'écran, aucun débordement |
| WEB-MOB-5 | Bulles de messagerie `[FCH30]` | **Conforme** — **aucune bulle ne sort du cadre** (la régression #175 / WEB-NRG-5 ne réapparaît pas), les réponses rapides défilent dans **leur** cadre et non dans la page, « Voir le numéro » tient dans l'écran |
| WEB-MOB-6 | Croix de la porte d'identité `[NRG3]` | **Conforme** — la croix est **visible sur téléphone**, en haut à droite, dans l'écran, et ferme réellement la feuille. *Constat : son nom accessible est « Plus tard » — comme le lien du bas ET le voile : trois contrôles pour un seul nom.* |
| WEB-MOB-7 | L'écran du deal entre 768 et 1024 px | **Conforme** — à 800 px, les gains du Voyageur et le bouton principal sont **présents et dans la fenêtre** : la colonne de droite ne disparaît plus dans la zone intermédiaire |
| WEB-MOB-8 | Les six cases du code | **Conforme** — six cases `inputmode="numeric"` (clavier chiffres), **toutes sur la même ligne** et dans l'écran, et un collage de `742891` remplit les six d'un coup |
| WEB-MOB-9 | Listes du tableau de bord | **Conforme** — « Mes envois », « Mes trajets » et « Finances » : aucun débordement de page, rien ne sort à droite (les montants restent visibles) |
| WEB-MOB-10 | Page destinataire | **Conforme** — lien créé par l'Expéditrice, ouvert **sans session** sur téléphone : frise des jalons lisible, bloc d'acquisition dans l'écran, aucun débordement |

### Anomalies

- **ANO-WEB-93 (mineure, close)** — le panneau **plein écran** des filtres de recherche n'était pas annoncé comme
  une fenêtre : ni `role="dialog"`, ni `aria-modal`, ni nom accessible, et la touche Échap ne le fermait pas. Un
  lecteur d'écran continuait donc de parcourir la page **en dessous**, et le clavier n'avait aucune porte de sortie.
  Les deux autres feuilles de la recherche (`MobileSearchExperience`, `MobileFieldFullScreen`) portent déjà
  `role="dialog"` : celle-ci l'avait oublié. Trois attributs et un `keydown` — la même famille que les anomalies des
  chapitres précédents : **une convention qui ne va pas jusqu'au bout**.

### À trancher (produit)

- **Trois contrôles, un seul nom** : dans la porte d'identité, la croix de fermeture, le voile et le lien du bas
  portent tous le nom accessible « Plus tard ». Nommer la croix « Fermer » (et le voile « Fermer la fenêtre »)
  lèverait l'ambiguïté pour un lecteur d'écran — petit, à voir avec le chapitre 5.31.
- **Le piège de focus n'est pas posé** sur les feuilles mobiles : `aria-modal` annonce une fenêtre modale, mais la
  tabulation peut encore sortir vers la page. À trancher au chapitre 5.31 (accessibilité clavier).
- **La rangée de réponses rapides déborde volontairement** (défilement horizontal dans son cadre) : c'est conforme à
  la règle du cahier, mais rien n'indique visuellement qu'elle défile (pas de dégradé de bord). Confort — petit.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **MOB-1** — Le menu mobile se ferme par le voile, qui porte son propre nom accessible : bien. La feuille ne piège
  pas le focus — même remarque que pour les filtres, à traiter en 5.31 — moyen.
- **MOB-2** — Le bouton d'application porte le **nombre de résultats** (« Voir 5 trajets ») : excellent (le membre
  sait ce qu'il obtient avant de fermer). Ajouter un compteur de filtres actifs sur le bouton « Filtres » de la
  barre — petit.
- **MOB-3** — La barre collante est une vraie barre du bas, pas un bouton qui suit le défilement : rien à redire.
  Y afficher le prix **pour le poids saisi** (déjà connu de la recherche) éviterait un aller-retour — moyen.
- **MOB-4** — Le total permanent + « Détail » est le bon patron pour un tunnel sur téléphone. Le cahier demande
  aussi que « le clavier ne masque pas le bouton de validation » : non vérifiable en émulation (le clavier virtuel
  n'existe pas dans Chrome émulé) — **à jouer sur un vrai téléphone** au montage LAN, et consigné comme tel.
- **MOB-5** — La régression #175 est morte et **le harnais la garde** : c'est le meilleur usage d'une contre-épreuve.
  La garde est générique (rien ne sort du cadre, sauf ce qui défile dans le sien) : elle protégera aussi les écrans
  à venir — rien à faire.
- **MOB-6** — La croix existe et ferme ; c'est son **nom** qui pèche. Voir « à trancher » — petit.
- **MOB-7** — La zone 768–1024 px est le point aveugle classique des grilles Tailwind (`md:` / `lg:`) : la fiche la
  vise explicitement, et elle est saine. Ajouter la même vérification pour l'écran de suivi Expéditeur — petit.
- **MOB-8** — `inputmode="numeric"` et le collage réparti sur six cases sont deux détails que l'on oublie neuf fois
  sur dix : ils sont là. Ajouter `autocomplete="one-time-code"` ferait proposer le code par le téléphone lui-même —
  petit, et c'est le geste attendu sur iOS.
- **MOB-9** — Trois listes, aucun débordement : la mise en page des listes tient. La garde par élément (et pas
  seulement par page) attrape les cas où un enfant sort sans agrandir le document — rien à faire.
- **MOB-10** — La page destinataire est lisible sur téléphone, ce qui est sa cible principale (elle arrive par
  WhatsApp ou SMS). Y vérifier le contraste des jalons sous le soleil est hors portée du harnais — pour mémoire.
- **Transversal** — Le chapitre n'a trouvé qu'**une** anomalie, et c'est la même famille que partout ailleurs :
  une convention (annoncer une fenêtre) appliquée à deux feuilles sur trois. Une garde automatique — « tout
  conteneur `fixed inset-0` qui capte l'écran porte `role="dialog"` » — la rendrait impossible à oublier : moyen,
  et c'est le meilleur candidat d'outillage de cette campagne.

### Pièges de poste payés ici

- **Un `viewport` étroit ne suffit pas** : sans `isMobile` / `hasTouch`, le produit rend son arbre desktop et le
  chapitre mesure la mauvaise interface. L'option `{ mobile: true }` du harnais pose les trois (taille, tactile,
  agent utilisateur).
- **« Fermer le menu » est le VOILE plein écran**, dont le centre est couvert par la feuille : le clic doit viser le
  haut (`{ position: { x: 8, y: 8 } }`) — c'est d'ailleurs le geste réel d'un doigt qui tape à côté.
- **Un élément peut dépasser sans que ce soit un défaut** : s'il vit dans un cadre qui défile horizontalement, la
  règle du cahier est respectée. Une garde naïve échoue sur les réponses rapides de la messagerie.
- **Le titre d'une page de résultats s'affiche avant les cartes** : attendre « Brazzaville » ne prouve rien, il faut
  attendre ce qui n'existe que sur une carte (un prix).
- **La croix de la porte d'identité s'appelle « Plus tard »** : la chercher par « Fermer » ne la trouve pas. On la
  reconnaît à sa **position** dans la feuille (et l'on consigne le problème de nom).
- **`POST /deals/:id/tracking-link` rend un chemin RELATIF** : `new URL(...)` lève « Invalid URL ».

## Chapitre 5.31 — Accessibilité clavier de base · **CONFORME** (8 fiches jouées, 4 après correction · 4 anomalies closes · 8 scénarios en série, 2 min)

`web-a11y.spec.ts`. Le cahier le dit lui-même : ce n'est **pas** un audit d'accessibilité complet, c'est le minimum
vérifiable sans outil spécialisé. Le harnais le joue donc **au clavier réel** (`keyboard.press("Tab")`,
`Escape`, `Space`, `Enter`), jamais par des clics déguisés, et mesure ce qu'un lecteur d'écran lirait
(`aria-label`, `aria-labelledby`, `aria-invalid`, `aria-describedby`). Trois choix de méthode, écrits en tête de
spec : le focus visible = un contour **ou** une ombre portée (`focus-visible:ring-*` de Tailwind pose une ombre) ;
le contraste = calcul WCAG 2.1 en **composant** les fonds semi-transparents jusqu'au premier fond opaque ; le zoom
à 200 % = une fenêtre **divisée par deux** (640 × 420), ce que voit un navigateur zoomé à densité égale.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| WEB-A11Y-1 | Parcourir l'accueil au clavier | **Conforme** — chaque arrêt de tabulation se voit (contour ou anneau), l'ordre suit la lecture **en-tête → contenu → pied** sans jamais revenir en arrière, et `Maj+Tab` quitte l'élément courant (aucun piège) |
| WEB-A11Y-2 | Connexion au clavier | **Conforme** — e-mail, mot de passe, « Rester connecté » coché par `Espace`, « Se connecter » par `Entrée` : `POST /auth/login` 200. *Constat : « Oublié ? » s'intercale entre les deux champs (le lien vit dans la ligne du libellé) — ordre lisible, motif courant.* |
| WEB-A11Y-3 | Fermer par Échap, focus rendu | **Conforme après correction** → `ANO-WEB-94`, `ANO-WEB-95` ; les **quatre** fenêtres du cahier — porte d'identité, signalement, confirmation d'annulation, feuille des filtres (sur téléphone : elle n'existe pas sur grand écran) — s'ouvrent à `Entrée`, reçoivent le focus, se ferment à `Échap` **et rendent le focus à l'élément exact qui les a ouvertes** |
| WEB-A11Y-4 | Focus piégé dans la fenêtre | **Conforme après correction** → `ANO-WEB-94` ; douze tabulations dans la porte d'identité, **aucune** ne sort vers la page |
| WEB-A11Y-5 | Libellés des contrôles sans texte | **Conforme après correction** → `ANO-WEB-96` ; cœur « Ajouter aux favoris », langue « Français » / « English », thème « Changer de thème », croix du signalement « Annuler », croix de la porte **« Fermer »** (elle s'appelait « Plus tard », constat du 5.30 réglé), œil « Afficher le mot de passe », cloche « Notifications », visionneuse « Fermer » / « Photo précédente » / « Photo suivante » — après une **vraie** prise en charge à deux photos par Thomas |
| WEB-A11Y-6 | Champs en erreur annoncés | **Conforme** — à vide, chaque champ en erreur porte `aria-invalid="true"` **et** un `aria-describedby` qui pointe sur SON message ; un champ en erreur est atteint au clavier |
| WEB-A11Y-7 | Contraste en mode sombre | **Conforme après correction** → `ANO-WEB-97` ; accueil, recherche, **suivi d'un envoi**, **fil de messagerie** (avec ses bulles) et « Mes envois » : aucun texte sous 3:1 |
| WEB-A11Y-8 | Zoom à 200 % | **Conforme** — accueil et suivi d'un envoi : aucun défilement horizontal, contenu présent |

### Anomalies

- **ANO-WEB-94 (majeure, close)** — **aucune fenêtre modale ne gérait le focus.** Dix-neuf `role="dialog"` dans
  l'application, zéro ligne qui lise `document.activeElement` : à l'ouverture, le focus restait sur la page ;
  pendant, `Tab` sortait de la fenêtre vers la page masquée par le voile ; à la fermeture, il retombait sur
  `<body>` — le membre au clavier recommençait la page depuis le haut. `aria-modal="true"` **promettait** une
  fenêtre modale que rien ne tenait. Pire, quatre feuilles **toujours montées** (fondu ou glissement :
  `DealDeclineSheet`, `PickupRefuseDialog` en tiroir, `MobileSearchExperience`, `MobileFieldFullScreen`) laissaient
  leurs boutons **atteignables à la tabulation une fois fermées**, invisibles ou hors écran. Correction : un
  crochet partagé `useDialogFocus(ref, active, onEscape?)` (entrée, boucle `Tab` / `Maj+Tab`, restitution, pile
  pour les fenêtres empilées) posé sur **les quatorze** fenêtres modales, et `inert` sur les feuilles fermées.
- **ANO-WEB-95 (majeure, close)** — **la fenêtre de signalement ne se fermait pas avec Échap** (ni celle du
  signalement d'un message) : aucun gestionnaire. C'est la fenêtre qu'on ouvre quand quelque chose ne va pas — la
  seule sortie clavier était de tabuler jusqu'à la croix. Correction : l'option `onEscape` du même crochet, qui
  ne ferme **que la fenêtre du dessus**.
- **ANO-WEB-96 (mineure, close)** — **chaque vignette de photo s'annonçait « photo »**, en dur, non traduit, et
  identique pour toutes : un lecteur d'écran entendait « photo, photo » sans savoir laquelle il ouvrait ; le
  bouton « +N » s'annonçait « +2 ». Correction : « Agrandir la photo 1 sur 2 » (précédé de la légende si elle
  existe) et « Voir 2 photos de plus », en français et en anglais.
- **ANO-WEB-97 (mineure, close)** — **les compteurs des en-têtes de groupe étaient illisibles** : « · 3 » en
  `slate-600` sur `slate-900` (2,36:1) en sombre — et en `slate-300` sur blanc (**1,5:1**) en clair, que la fiche
  ne mesure pas mais qui saute aux yeux une fois le motif repéré. Mêmes classes dans quatre listes
  (« Mes envois », « Mes trajets », accueil du tableau de bord, liste des trajets). Correction : libellé et
  compteur en `slate-500` / `dark:slate-400` (≥ 4,5:1 dans les deux thèmes).
- **Constat du 5.30 réglé** — dans la porte d'identité, la croix, le voile et le lien du bas portaient tous le
  nom « Plus tard ». La croix s'appelle désormais « Fermer » ; le voile (clic souris) sort de la tabulation et de
  l'arbre d'accessibilité — il était le **premier arrêt** du piège de focus.

### Deux faux positifs de l'instrument, corrigés avant de conclure

- **Le contraste d'un fond semi-transparent.** La première mesure donnait « Tout » à **1,25:1** et « Départ le plus
  tôt » à 2,14:1 : le calcul prenait `bg-[#FF9900]/15` pour de l'orange **plein**. Le fond réel est une teinte à
  15 % composée sur le blanc ou le noir du dessous. La mesure empile désormais les couches jusqu'au premier fond
  opaque et les compose — les deux « anomalies » ont disparu, la vraie (les compteurs) est restée.
- **Des frappes perdues avant l'hydratation.** WEB-A11Y-2 envoyait `per@seed.yamba.dev` alors que le champ
  affichait l'adresse complète : les douze premiers caractères, tapés avant que React n'attache ses écouteurs,
  n'étaient jamais entrés dans l'état du formulaire. Ce n'est pas un défaut observable en production (hydratation
  en quelques dizaines de millisecondes), c'est le piège n° 2 de l'en-tête de campagne — rejoué ici **au clavier**.

### Non-régression rejouée, et trois fiches anciennes remises d'aplomb

Les correctifs touchent quatorze fenêtres : les chapitres qui les ouvrent ont été rejoués — **web-sig 8/8,
web-ann 9/9, web-mob 10/10, web-rch 16/16, web-msg 21/21, web-fav 12/12, web-not 11/11, web-dea 9/9, web-acc 12/12,
web-pic 8/8** (les `test.fail` d'ANO-WEB-28 et 68 restent attendus). Trois échecs sont apparus, **aucun dû au
5.31** — preuve faite en rejouant web-dea et web-pic sur le produit **sans** les correctifs :

- **WEB-DEA-1** attendait « 26 sept. » écrit en dur, alors que le jeu d'essai place le trajet à J+15 **du rejeu** :
  la fiche cassait dès le lendemain de son écriture. La date attendue se calcule désormais.
- **WEB-PIC-7** interdisait tout bouton « Valider la livraison » sur l'écran de transit — mais le correctif
  d'ANO-WEB-60 (chapitre 5.18) y a volontairement ajouté le raccourci « Clarisse est déjà devant toi ? ». Assertion
  périmée depuis le 5.18, jamais revue parce que la fiche échouait AVANT (PIC-8 n'avait donc plus été joué).
  Mise à jour ; et **WEB-PIC-8** lisait le suivi avant son rendu client (corps vide) : lecture par sondage.
- **WEB-ACC-5** cliquait « Confidentialité » juste après `goBack`, parfois avant que la page restaurée reprenne la
  main (intermittent, 1 sur 2) : geste réessayé, borné.

### À trancher (produit)

- **Le sélecteur de langue** est un contrôle segmenté « FR / EN » dont chaque bouton porte le nom de SA langue
  (« Français », « English ») ; le cahier attendait « Changer de langue ». Le choix actuel est meilleur (on
  annonce la destination, pas l'action) — à acter dans le cahier.
- **La croix du signalement s'appelle « Annuler »** (clé `cancel` réutilisée) quand celles de la porte et de la
  visionneuse s'appellent « Fermer » : harmoniser — petit.
- **Le contraste en thème clair** n'est mesuré par aucune fiche ; `text-slate-400` sur blanc (2,56:1) sert encore
  à des libellés d'information ailleurs. Une fiche « contraste en clair » ou une passe `axe-core` est le prochain
  pas — moyen.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **A11Y-1** — L'ordre et la visibilité du focus sont sains. Ajouter un lien « Aller au contenu » (premier arrêt,
  visible au focus) épargnerait la traversée de l'en-tête à chaque page — petit, standard.
- **A11Y-2** — Parcours clavier complet. `enterKeyHint` est déjà posé (« suivant » / « go ») : rien à faire.
  Déplacer « Oublié ? » sous le champ mot de passe rendrait l'ordre strictement linéaire — confort, petit.
- **A11Y-3** — Le retour du focus est vérifié sur l'**élément** (attribut posé sur l'ouvreur), pas sur un texte :
  deux « Annuler » cohabitent sur « Mes envois ». Généraliser `ouvrirPuisEchap()` à toute nouvelle fenêtre — petit.
- **A11Y-4** — Le crochet est partagé : une nouvelle fenêtre qui l'oublie est le prochain défaut. Une garde de
  source (« tout `aria-modal` appelle `useDialogFocus` ») dans le script i18n/CI le rendrait impossible — moyen, et
  c'est la suite logique de la garde proposée au 5.30.
- **A11Y-5** — Les libellés sont en français et parlants. Le cœur pourrait annoncer son état par `aria-pressed`
  plutôt que par un changement de libellé — petit.
- **A11Y-6** — Liaison champ ↔ message exemplaire. Déplacer le focus sur le **premier** champ en erreur à la
  validation (aujourd'hui il reste sur le bouton) éviterait de le chercher — petit, fort effet au clavier.
- **A11Y-7** — Mesure calculée, pas « à l'œil » : elle a trouvé un défaut que le mode clair avait aussi. Voir « à
  trancher » pour le thème clair — moyen.
- **A11Y-8** — Tient à 200 %. Jouer aussi 400 % (320 px de large, critère WCAG 1.4.10) coûte une ligne — petit.
- **Transversal** — Trois anomalies sur quatre sont **la même** : une convention d'accessibilité posée à moitié
  (`aria-modal` sans piège, `role="dialog"` sans Échap, `aria-label` générique). Le correctif n'est pas quatorze
  rustines mais **un crochet** ; la prochaine étape est une garde qui oblige à s'en servir.

### Pièges de poste payés ici

- **Taper avant l'hydratation perd des frappes** au clavier aussi (pas seulement au clic) : attendre le premier
  appel d'API du client avant de saisir.
- **Un fond `…/15` n'est pas un fond** : composer les couches semi-transparentes avant de calculer un contraste.
- **La feuille des filtres n'existe que sur téléphone** (`md:hidden`) : sur grand écran, le bouton est absent et
  une fiche qui écrit `if (await filtres.count())` passe **sans rien éprouver**.
- **Les feuilles de recherche restent montées hors écran** : un « dialog visible » peut désigner la mauvaise
  fenêtre. On vise celle qui **contient le focus**.
- **`document.activeElement` sur `<body>` rend le texte des scripts** (`((e, i, s, u…`) : c'est la signature d'un
  focus perdu, pas d'un bug de mesure.
- **Le suivi d'un envoi n'a pas de photos dans le jeu d'essai** : pour la visionneuse, il faut une vraie prise en
  charge (Thomas, deux photos, ImageKit interposé).

## Chapitre 5.32 — Vocabulaire et cohérence de langue · **CONFORME** (6 fiches jouées, 4 après correction · 5 anomalies closes · 7 scénarios, 16 min)

`web-voc.spec.ts`. Le cahier demande de **relire** les écrans déjà parcourus, pas de refaire les parcours. Le harnais
le prend au mot : un relevé commun (`WEB-VOC-0`) ouvre **31 écrans** du cahier — visiteur, Expéditrice (Aminata),
Voyageur (Thomas) — en **français puis en anglais** (62 relevés), et garde leur texte visible *plus* les libellés
qu'entend un lecteur d'écran (`aria-label`, `placeholder`, `title`, `alt`). Chaque fiche interroge ce relevé avec sa
règle et rend la liste exacte « [langue] écran (compte) : « …extrait… » ». Les emails sont relus dans Mailpit, dont
deux **en anglais** provoqués pour l'occasion (Pauline passe en anglais, Thomas prend son colis en charge).

Deux garde-fous d'instrument, payés avant de conclure : un écran « introuvable » a aussi 200 caractères (le relevé
refuse désormais tout écran qui dit « n'existe pas ») ; et deux lectures identiques à une seconde d'écart peuvent
tomber dans le **squelette** de chargement (« Mes envois » relevé vide) — stable = trois lectures identiques et plus
aucun `animate-pulse`.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| WEB-VOC-1 | « Voyageur » / « Expéditeur » partout | **Conforme après correction** → `ANO-WEB-98` ; 62 écrans + la boîte Mailpit : aucun « transporteur », « tripper », « yamber », « Shipper » en français ; aucun « carrier », « traveller » en anglais ; aucun « Voyageur » sur un écran anglais. Le point d'attention connu est vérifié **explicitement** : l'assistant, vu par Aminata (pas encore Voyageuse), s'intitule « Devenir Voyageur » / « Become a Traveler » |
| WEB-VOC-2 | « assurance » absent | **Conforme après correction** → `ANO-WEB-99` ; « Protection » et « Garantie Yamba » bien affichés ; les libellés de la « seconde source » (« Assurance optionnelle », « IPID ») n'existent plus nulle part |
| WEB-VOC-3 | Un même nom pour le bagage en soute | **Conforme après correction** → `ANO-WEB-100` ; aucun envoi « soute » vivant dans le jeu d'essai (le seul est refusé, donc invisible) : la fiche **en crée un** (Aminata, trajet au kilo de Thomas, paiement FAKE) puis relit page du trajet, réservation, « Mes envois », « Mes trajets » — « Bagage en soute 23 kg » / « Checked bag 23 kg » partout. *Constat : la carte de recherche ne détaille pas les forfaits.* |
| WEB-VOC-4 | Tutoiement constant | **Conforme après correction** → `ANO-WEB-101` ; les « vous » **pluriels** (« vous aurez tous les deux noté », « vous conviendrez ensemble ») sont légitimes et exemptés, « rendez-vous » aussi |
| WEB-VOC-5 | Aucun texte de démonstration | **Conforme** — Finances, Notifications, Messages, Mes envois : aucune des 13 mentions guettées. *Constat corrigé : les vitrines `/dashboard/*/preview` qui les portent étaient atteignables en production par URL.* |
| WEB-VOC-6 | Aucun libellé vide ni clé technique | **Conforme** — aucune clé (`a.b.c`), aucun `{variable}`, `undefined`, `NaN`, aucune ligne « — » seule. Le point connu (notification « le Voyageur a donné sa version » rédigée « — ») est **dormant** : l'événement est configuré « aucune notification membre » (D55) — il ne s'affiche pas, mais il est rédigé désormais |

### Anomalies

- **ANO-WEB-98 (majeure, close)** — **le vocabulaire des rôles fuyait de partout.**
  - Le point d'attention du cahier **subsistait** : l'assistant s'intitulait « Devenir transporteur », son étape « Créez
    votre espace transporteur » (« Become a carrier », « Create your carrier space »), et le toast de création de
    trajet « Configurez votre profil transporteur ».
  - En anglais, le rôle s'appelait **« carrier »** dans 23 messages (suivi, finances, favoris, annulation, conditions)
    et 22 phrases d'**emails** de notification — dont la mention systématique « You are receiving this email because
    the carrier of your Yamba shipment… ».
  - Sur l'accueil **français**, deux étiquettes codées en dur « 📦 **Shipper** » et, en **anglais**, « ✈️ **Voyageur** » ;
    le badge d'avatar « Voyageur vérifié » et les textes alternatifs de l'image d'accueil, en français sur les écrans
    anglais ; « tripper » dans deux messages d'erreur de l'assistant.
  - Correction : A144 appliquée partout (« Traveler » avec majuscule), étiquettes et textes alternatifs traduits.
- **ANO-WEB-99 (majeure, close)** — **« ton assurance » sur l'écran de remise du colis** (« Optionnel, mais c'est ton
  assurance… », « your insurance in a dispute ») : figuré, mais c'est exactement le mot que le cahier interdit, sur
  un écran qu'il cite. → « ta meilleure preuve » / « your best proof ».
- **ANO-WEB-100 (mineure, close)** — **six noms pour le bagage en soute** : « Bagage 23kg » (filtres), « Valise soute
  23 Kg » (commun), « Bagage soute 23 kg » (mes envois, mes trajets), « Bagage en soute 23 kg » (réservation),
  « Soute 23 kg » (page du trajet), « Un bagage soute 23 kg » (étape 1) ; en anglais « Checked 23 kg », « A 23 kg
  checked bag », « Checked bag 23kg ». Même désordre pour la cabine. → « Bagage en soute 23 kg » / « Bagage cabine
  12 kg », « Checked bag 23 kg » / « Cabin bag 12 kg ».
- **ANO-WEB-101 (mineure, close)** — **le vouvoiement** : 41 messages (accueil, recherche, page de trajet,
  messagerie, mes trajets), environ 70 textes codés en dur (création de trajet, assistant Voyageur, tableau de bord,
  retour de Stripe, aide) et les **emails d'alerte de trajet** (« Votre alerte a expiré », « Voulez-vous la
  prolonger ? »). Tous au tutoiement.
- **ANO-WEB-102 (mineure, close, trouvée en relisant)** — sur la page d'un trajet, **« Voir les avis » menait à
  `/tripper/<id>`**, une route qui n'existe pas (page introuvable). → `/u/<slug>`, et la contre-épreuve vit dans le
  relevé.

### Le garde-fou qui empêche le retour

`scripts/check-i18n-messages.mjs` (check CI « i18n messages ») gagne une **règle 6** : aucune valeur de message ne
porte un mot de rôle refusé, « assurance », du vouvoiement (hors pluriel « tous les deux / ensemble »), ni un texte
vide ou « — ». Contre-épreuve jouée : « Become a carrier » et « Votre colis » réintroduits → le check nomme
`en/finances.json wallet.empty.cta` et `fr/search.json filters.yourParcel`, et sort en erreur. Sa limite est écrite
dans son en-tête : les textes codés en dur dans les composants lui échappent.

### À trancher (produit)

- ~~**« expéditeurs » / « voyageurs » en minuscule**~~ → **tranché le 13/09 : « Voyageur » / « Traveler » partout, avec majuscule** — 71 valeurs de messages, 33 textes écrits dans le code, un email ; règle `role-majuscule` ajoutée au lexique partagé (CI + recette), contre-épreuve jouée ; 12 citations du harnais mises à jour ; web-fav, web-rch, web-rsv-devis, web-lit verts. *(Texte d'origine :)* « expéditeurs » / « voyageurs » en minuscule au sens générique (« Yamba connecte les expéditeurs aux
  voyageurs ») : laissés tels quels — le rôle prend la majuscule, la foule non. À acter.
- **Des dizaines de textes encore écrits en dur** (`isFr ? … : …`, une douzaine de fichiers rien que pour ce chapitre) hors des fichiers de messages : corrigés ici, mais
  invisibles au garde-fou. Les migrer vers `messages/` est la seule protection durable — moyen.
- **La carte de recherche ne dit pas qu'un trajet propose le forfait soute** : un Expéditeur qui cherche à envoyer
  une valise doit ouvrir chaque trajet — petit, utile.
- **Les messages d'erreur de l'API** disent « carrier » (surface publique en anglais, vocabulaire du code) : laissés
  tels quels ; ils ne doivent jamais être affichés bruts à un membre (A146 : le client traduit `details.code`).

### Améliorations faites au GO du 13/09 (regard d'expert, produit ET test)

| # | Amélioration | Où | Preuve |
|---|---|---|---|
| 1 | VOC-3 **annule** la réservation qu'elle crée (bloc `finally`) : chaque exécution consommait 23 kg de `bzv-perkg` jusqu'au prochain rejeu | `web-voc.spec.ts` | annulation 200 à chaque passage |
| 2 | VOC-4 relit aussi les **emails français** de la boîte (la fiche ne relisait que les écrans — c'est dans les emails d'alerte que le vouvoiement se cachait) | `web-voc.spec.ts` | emails relus > 0, aucun vouvoiement |
| 3 | **Règle 7** du contrôle i18n : chaque type de `BOOKING_EVENT_TYPES` a un texte de notification complet (titre + ligne, deux rôles). Le front compose la clé dynamiquement : la règle 5 ne la voyait pas, et un texte absent des DEUX langues échappait au miroir | `check-i18n-messages.mjs` | contre-épreuve : ligne retirée en FR et EN → refus nommé |
| 4 | VOC-6 : une clé technique à **un seul point** (`status.pending`) est désormais détectée ; « e.g. », « i.e. », « etc. » exemptés | `web-voc.spec.ts` | 0 clé sur 70 écrans |
| 5 | **Lexique en source unique** `scripts/lexique-yamba.json`, lu par la CI (règle 6) ET par la recette : une exemption ajoutée vaut partout | `lexique-yamba.json` | contre-épreuve « Sélectionnez votre date » → refus |
| 6 | Revue des **dates en dur** du harnais : la garde ANO-WEB-41 de DEA-1 (`toContain("1 janv.")`) aurait échoué à tort chaque janvier (« 11 janv. » la contient) → `(?<!\d)1 janv\.` | `web-dea.spec.ts` | web-dea 9/9 |
| 8 | Relevé **en parallèle** (un onglet par compte), langues tirées de `SUPPORTED_LOCALES`, **quatre écrans ajoutés** (mot de passe oublié, page destinataire sans compte, signaler un problème, noter le Voyageur) | `web-voc.spec.ts` | 70 écrans en 8 min 06 (62 en 11 min 30 avant) |

**Écart honnête sur l'item 8** : le gain est d'environ 40 % par écran, pas le « ~4 min » annoncé — le goulot est le serveur
`next dev` unique, qui compile chaque page à la demande ; trois onglets ne compilent pas trois fois plus vite.

**Item 7 retiré, et pourquoi.** Conditionner le `POST /auth/refresh` du visiteur au marqueur de session (localStorage)
aurait déconnecté de VRAIS membres : marqueur absent (navigation privée restrictive, stockage nettoyé, session ouverte
avant ANO-WEB-01) mais cookie de rafraîchissement valide → plus aucune tentative, déconnexion à chaque expiration du
jeton d'accès. La bonne réponse est serveur (un indice non sensible « a une session » posé par auth-service, lisible
par le front) : **décision d'architecture à proposer au registre**, pas un petit correctif.

Une garde de l'instrument corrigée en chemin : l'écran « mot de passe oublié » dit « le message est identique même si
le compte n'existe pas » — la garde « écran introuvable » vise désormais les PHRASES d'absence du produit, pas les mots.

### Regard d'expert — optimisations et améliorations (une ligne par fiche)

- **VOC-1** — Le relevé multi-comptes × deux langues est réutilisable tel quel pour tout futur chapitre de
  relecture. Jouer aussi une troisième locale le jour où elle arrive ne demande qu'une entrée de tableau — rien à faire.
- **VOC-2** — Le mot figuré (« c'est ton assurance ») est le piège : un lexique interdit doit viser le mot, pas le
  sens. La règle 6 le fait — rien à faire.
- **VOC-3** — Le libellé d'un produit devrait avoir **une seule source** (`api-contracts` ou un seul fichier de
  messages) : six fichiers portaient six variantes. Centraliser — moyen.
- **VOC-4** — Le tutoiement s'est perdu surtout dans les textes **codés en dur** : c'est l'argument le plus concret
  pour finir la migration i18n — moyen.
- **VOC-5** — Les vitrines de démonstration sont maintenant introuvables en production ; les supprimer une fois le
  chantier Stripe backend fini — petit.
- **VOC-6** — Une notification « — » dormante reste un piège pour le jour où D55 change : la règle 6 refuse
  désormais toute valeur vide ou « — » — rien à faire.
- **Transversal** — Cinq anomalies, une seule cause : **deux sources de texte** (fichiers de messages et chaînes en
  dur) dont une seule est gardée. Le garde-fou ferme la première ; la migration fermera la seconde.

### Pièges de poste payés ici

- **Une adresse contient le mot** : `aminata.shipper@seed.yamba.dev` n'est pas un libellé « Shipper ».
- **Une URL contient le mot** : `/fr/carrier/deals/…` dans un email est un chemin, pas un rôle.
- **Un écran « introuvable » passe un seuil de longueur** : vérifier aussi qu'il n'annonce pas son absence (le deal
  `bzv-delivered` est à João, pas à Aminata).
- **Un squelette peut être stable une seconde** : exiger trois lectures identiques et zéro `animate-pulse`.
- **Un Voyageur ne voit pas l'assistant « Devenir Voyageur »** (écran de succès) : le relire avec un membre qui ne
  l'est pas.
- **Un envoi refusé n'apparaît ni dans « Mes envois » ni dans « Mes trajets »** : pour comparer un libellé, il faut un
  envoi vivant.
- **Corriger un texte casse les fiches qui le citent** : 20 citations mises à jour (web-rch, web-msg, fil-messagerie,
  web-rsv-devis, web-rem, web-dea, web-trj, web-voy) trouvées par inventaire automatique — et deux de plus qu'il
  n'a pas vues (web-alr : « correspond à votre alerte ») parce que le texte d'un gabarit EJS n'est pas entre
  guillemets. La non-régression les a trouvées.

### Non-régression rejouée

web-rch 16/16, web-msg 21/21, web-rsv-devis 11/11, web-rsv 3/3, web-rem 7/7, web-dea 9/9, web-trj 13 (⏭ inchangés),
web-voy 1 (⏭ Stripe inchangés), web-cnf 13/13, web-alr 9/9 (après mise à jour des deux citations ; le constat
« l'email vouvoie » du 5.10 est devenu une assertion), web-not 11/11, web-mob 10/10, web-a11y 8/8, web-acc 12/12.
**WEB-ACC-8** échouait une fois sur deux sur un `POST /auth/refresh` : rejouée **sans** les correctifs, elle échoue
pareil — c'est la sonde de session du visiteur, pas la fermeture de la porte. Exclue de la fiche, raison écrite.
*Axe : un visiteur qui n'a jamais eu de session ne devrait pas tenter de rafraîchissement (le marqueur
d'ANO-WEB-01 le sait) — une requête inutile par visite, petit.*

## Chapitre 7 — Non-régression · **CONFORME** (12 fiches jouées, 3 après correction · 3 anomalies closes · 11 scénarios)

`web-nrg.spec.ts`. Douze points qui ont **déjà cassé** : le cahier les veut rejoués à chaque session, avant de déclarer
une recette terminée. Ils vivent donc dans UN fichier, à lancer seul. Trois partis pris écrits en tête de spec :
chaque fiche joue le cahier **en entier** (« chaque trajet », « les quatre portes », « écris et envoie un message ») ;
la **console est un témoin** (erreurs, avertissements React, erreurs next-intl) ; les gestes sensibles **s'arrêtent à la
porte** (aucun code demandé : quota OTP). Les fiches ne sont pas en série : une régression qui revient ne masque pas
les onze autres.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| WEB-NRG-1 | Heure d'arrivée sur les cartes | **Conforme** — desktop puis téléphone, chaque carte visible : une heure réelle ou rien, jamais « — » |
| WEB-NRG-2 | Jamais un prix à zéro | **Conforme** — recherche sans critère, la page des **8 trajets** du jeu d'essai (chaque trajet au kilo porte un exemple chiffré « ≈ … € »), étape 1 sans poids → « Indique le poids du colis pour voir le prix. » ; aucune note « ⭐ 0.0 » |
| WEB-NRG-3 | La croix des quatre portes, sur téléphone | **Conforme après correction** → `ANO-WEB-105` ; « Réserver », le cœur, « Suivre », « Partager un trajet » : croix « Fermer » visible, dans l'écran, qui ferme ; « Plus tard » présent |
| WEB-NRG-4 | L'étape 1 sur chaque trajet | **Conforme** — 8 trajets : l'étape 1, ou un refus explicite (« Ce trajet n'accepte plus de demandes. » pour le trajet parti) ; aucune exception dans la console |
| WEB-NRG-5 | Les bulles de l'autrice sur téléphone | **Conforme** — Pauline **écrit et envoie** un message (sa bulle tient dans l'écran), propose un rendez-vous au **lieu long** (le lieu passe à la ligne), la rangée des réponses rapides défile **dans son cadre**, « Voir le numéro » dans l'écran, aucun défilement horizontal |
| WEB-NRG-6 / 12 | Console et textes, FR et EN | **Conforme** — 10 écrans à listes × 2 langues (recherche, mes envois, mes trajets, finances, notifications, messages, détail d'un trajet, étape 1, demande reçue, suivi) : aucun avertissement « unique key », aucune erreur next-intl (`MISSING_MESSAGE`, `INVALID_KEY`), aucune section vide, aucune clé affichée |
| WEB-NRG-7 | Les cinq gestes sensibles | **Conforme après correction** → `ANO-WEB-103`, `ANO-WEB-104` ; mot de passe, adresse email, données, **tableau de bord Stripe**, suppression du compte : 403 `SUDO_REQUIRED` et la porte « Confirme que c'est bien toi » / « M'envoyer le code », sans demander de code |
| WEB-NRG-8 | Libellés des statuts et toasts | **Conforme** — « En ligne » / « Online », jamais « Actif », « En pause », « Active », « Paused » ; par le menu d'un trajet créé pour la fiche : toasts « **Trajet masqué** » puis « **Trajet remis en ligne** », badge « Masqué » entre les deux |
| WEB-NRG-9 | Annuler un trajet qui porte des deals | **Conforme** — 409, « Ce trajet porte encore … deals en cours », le trajet reste « PUBLISHED » |
| WEB-NRG-10 | Cinq minutes de navigation | **Conforme** — aucun 429, aucun « Trop de tentatives ». **Mesuré** : 77 pages, 475 appels en 5 min, soit **6,2 appels d'API par page** ; projeté sur les plafonds **de production** (le poste les relève : 5000 / 2000) : un membre actif (90 pages / 15 min) ≈ 555 appels, **56 %** du plafond de 1000 ; un visiteur atteint son plafond de 100 en ≈ 16 pages |
| WEB-NRG-11 | Les origines du poste (CORS) | **Conforme** — `localhost:3000`, `localhost:3001` et l'adresse LAN : réponse < 500 et `Access-Control-Allow-Origin` égal à l'origine ; contre-épreuve : une origine étrangère n'est pas autorisée |

### Anomalies

- **ANO-WEB-104 (majeure, close)** — **le tableau de bord Stripe était inaccessible à TOUS les Voyageurs.** Le bouton
  « Voir mes virements sur Stripe » testait `user.carrierPage.stripeAccountId` ; or `/auth/me` ne sert jamais ce champ
  (liste blanche du DTO, à juste titre). Chaque Voyageur voyait « Finalise d'abord ton compte Stripe », le serveur
  n'était jamais appelé, la porte par code jamais atteinte. Exactement la famille que WEB-NRG-7 garde : « une fonction
  entière morte, sans erreur visible ». Correction : le bouton appelle toujours le serveur, qui décide (porte par code,
  puis `STRIPE_ACCOUNT_MISSING`) ; le front traduit ce code. Vérifié sur `/auth/me` de Thomas : `carrierPage` porte
  `stripeOnboardingComplete`, jamais `stripeAccountId`.
- **ANO-WEB-103 (mineure, close)** — **Finances s'ouvrait sur « Paiements » chez un Voyageur.** `useState(isCarrier ?
  "wallet" : "payments")` n'est évalué qu'au montage, avant que le membre soit chargé : `isCarrier` vaut `false`,
  l'onglet reste « Paiements » (vide), les gains et le lien Stripe sont un clic plus loin. Invisible en navigation
  interne (cache chaud), systématique à l'ouverture directe. Correction : onglet **dérivé** tant que le membre n'a
  rien choisi.
- **ANO-WEB-105 (mineure, close)** — **sur téléphone, le bouton de l'en-tête s'annonçait « Partager »** : partager
  quoi ? Le libellé visible est raccourci ; il porte désormais le nom complet « Partager un trajet », qui contient le
  mot visible (WCAG 2.5.3).

### Défauts de l'instrument, corrigés avant de conclure

- **« 230,00 € » contient « 0,00 € »** : la garde des prix nuls a d'abord accusé le forfait soute. Garde « aucun
  chiffre avant ».
- **`\bMasqué\b` ne matche jamais** : `\b` ne connaît pas « é ». La leçon du chapitre 5.32, repayée ici — frontières
  `(?<![\p{L}])…(?![\p{L}])` avec le drapeau `u`.
- **« Proposer » ou « Proposer un autre »** : le fil de `bzv-accepted` porte déjà un rendez-vous de Thomas. Le page
  object `FilMessagerie.proposerRendezVous` accepte désormais les deux.
- **Un `count()` immédiat** tombait avant l'hydratation, ouvrait le menu, qui recouvrait l'en-tête : on attend le
  bouton.
- **Le cinquième geste est destructeur** : taper « SUPPRIMER » puis confirmer effacerait VRAIMENT le compte si une
  fenêtre sudo était déjà ouverte. La fiche le joue sur un **compte neuf jetable**, jamais sur un compte du jeu
  d'essai.

### Ce que le harnais a gagné

- `apps/e2e/src/pages/ecran.ts` : les gardes `aucunDebordement`, `tientDansLEcran`, `rienNeSortDuCadre` (sorties de
  web-mob, qui les importe) et `ecouterLaConsole` (erreurs ET avertissements, bruit du poste écarté).
- `JeuEssai.tousLesTrajets()` : « chaque trajet du jeu d'essai » sans liste écrite en dur.
- `MesTrajets.actionDuMenu()` : n'importe quelle entrée du menu d'un trajet, confirmée si besoin, avec son toast.
- `FilMessagerie.proposerRendezVous()` accepte « Proposer » et « Proposer un autre ».

### À trancher (produit)

- ~~**Une origine refusée répond 500**~~ → **fait au GO** : 403 `ORIGIN_NOT_ALLOWED` (P1).
- ~~**`BecomeYamber` teste encore `stripeAccountId`**~~ → **fait au GO** (P2), avec le bandeau figé en français trouvé en
  chemin, et le champ retiré du type `useUser` (P3).
- **Le plafond des VISITEURS (100 / 15 min) à mesurer sur un build de production.** La mesure du poste dit ≈ 16 pages
  par quart d'heure — mais elle est **pessimiste** : chaque `page.goto` recharge tout, et `next dev` monte deux fois
  chaque effet (StrictMode). Répartition relevée : `GET /api/maintenance` **1,99 par page** (un seul composant, le
  bandeau du layout, qui lit au montage — le double est l'artefact de développement), `/auth/me` 0,96,
  `/messages/conversations` 0,88, `/me/notifications` 0,84, `/trips/my` 0,42, `/trips/:id/public` 0,35. Un visiteur qui
  compare des trajets depuis un bureau ou un réseau mobile partagé (même IP) reste le vrai risque : rejouer la
  mesure sur `next build && next start` en navigation par liens avant de trancher le plafond. Moyen.

### Améliorations faites au GO du 13/09 (les « petits » du regard d'expert, produit ET test)

**Produit**

| # | Amélioration | Où |
|---|---|---|
| P1 | **Une origine refusée répond 403 `ORIGIN_NOT_ALLOWED`**, plus 500 « Not allowed by CORS ». Le refus reste FRANC : un middleware placé avant `cors()` coupe la requête — se contenter de ne pas poser `Access-Control-Allow-Origin` laisserait un POST d'un site tiers atteindre les services (le navigateur bloque la LECTURE de la réponse, pas l'envoi). Liste des origines extraite dans une fonction pure. | `apps/api-gateway/src/libs/origins.ts`, `main.ts` |
| P2 | **`BecomeYamber`** : « Configuration incomplète » dépendait de `stripeAccountId`, jamais servi → dérivé de `onboardingStep`. Et **trouvé en chemin** : `const isFr = true` figeait tout le bandeau en français, y compris en anglais → `useLocale()`. | `BecomeYamber.tsx` |
| P3 | **Le champ menteur retiré du type** : `CarrierPage.stripeAccountId?` n'existe pas dans `/auth/me`. Sans lui, TypeScript refuse toute nouvelle lecture — la famille d'ANO-WEB-104 ne peut plus revenir par ce champ. Le dernier usage (état de l'en-tête) suit l'étape d'onboarding. | `hooks/useUser.ts`, `useHeaderUserState.ts` |
| P4 | **« Ce trajet n'accepte plus de demandes. »** propose une suite : « Chercher un autre trajet » (la barre garde les critères en session). | `BookingClient.tsx`, `trip-detail.json` |
| P5 | **Le refus d'annulation d'un trajet mène aux deals** : action « Voir ses deals » dans le toast → la page du trajet. | `MyTripsList.tsx`, `myTrips.json` |

**Tests**

| # | Amélioration | Preuve |
|---|---|---|
| T1 | NRG-1 compare les cartes affichées à **celles que sert l'API** (identifiants), desktop et téléphone — « au moins une carte » passait sur une recherche à moitié vide | ensembles égaux |
| T2 | NRG-2 relit aussi la recherche et la page d'un trajet **sur téléphone** (autres arbres de composants) | aucun zéro |
| T3 | NRG-3 joue les quatre portes **sur téléphone ET sur grand écran** (« sur mobile comme sur desktop ») | 8 croix |
| T4 | NRG-4 vérifie que le refus propose « Chercher un autre trajet » | contre-épreuve de P4 |
| T5 | NRG-7 **purge son compte jetable** (manœuvre consignée, par l'adresse exacte) | aucun compte `neuf-*` laissé par la fiche |
| T6 | NRG-9 clique « Voir ses deals » et trouve les deals du trajet | contre-épreuve de P5 |
| T7 | NRG-10 mesure en deux temps : **3 min par rechargement** (pessimiste) puis **2 min par liens** de la barre latérale (réaliste) | par rechargement 6,0 appels par page ; **par liens 0,8** — un membre actif ≈ 72 appels / 15 min, **7 %** de son plafond |
| T8 | NRG-11 exige **403 `ORIGIN_NOT_ALLOWED`** et vérifie qu'un **POST** d'une origine étrangère est refusé avant les services | contre-épreuve de P1 |
| T9 | MOB-5 (chapitre 5.30) allégée : son saut silencieux `if (count)` sur « Voir le numéro » est retiré, NRG-5 jouant le fil en entier | web-mob vert |

**Non fait, et pourquoi.** « Relire l'origine de production » (NRG-11) : elle n'existe pas encore. « Le rôle en minuscule »
(≈ 35 messages, « le voyageur ») : c'est le point **à trancher** du chapitre 5.32 — pas de réécriture sans décision.

**Ce que la mesure « par liens » change.** Le « visiteur plafonné en ≈ 16 pages » de la première mesure ne vaut que
pour un visiteur qui ouvre CHAQUE page par un lien externe ou un nouvel onglet (rechargement complet). En navigation
par liens, une page coûte 0,8 appel : le plafond de 100 couvre alors une centaine de pages par quart d'heure. Le point
« à trancher » se réduit au cas des visiteurs derrière une même adresse IP (bureau, réseau mobile partagé) qui
arrivent par des liens partagés — à suivre, pas à corriger en aveugle.

### Regard d'expert — optimisations et améliorations (produit ET test, une ligne par fiche)

- **NRG-1** — *Produit* : rien. *Test* : compter les cartes attendues (API de recherche) plutôt que « au moins une » —
  une recherche vide passerait. Petit.
- **NRG-2** — *Produit* : un prix nul devrait être refusé en base (garde de publication ET contrainte de lecture),
  pas seulement masqué à l'affichage. Moyen. *Test* : relire aussi la carte mobile et le récapitulatif mobile. Petit.
- **NRG-3** — *Produit* : ANO-WEB-105 réglée ; aligner les autres libellés raccourcis sur téléphone (« Réserver »
  seul dans la barre du bas). Petit. *Test* : jouer aussi en desktop (le cahier dit « sur mobile comme sur
  desktop »). Petit.
- **NRG-4** — *Produit* : le refus « Ce trajet n'accepte plus de demandes. » ne propose aucune suite (trajets
  similaires). Petit. *Test* : forcer un trajet SANS lieu en base (manœuvre consignée) pour éprouver réellement le
  message du cahier — aucun trajet du jeu d'essai n'en est dépourvu. Moyen.
- **NRG-5** — *Produit* : rien. *Test* : MOB-5 (chapitre 5.30) n'envoyait aucun message et sautait « Voir le numéro »
  en silence — NRG-5 le fait ; MOB-5 peut être allégée d'autant. Petit.
- **NRG-6/12** — *Produit* : rien. *Test* : la console ne voit que les avertissements du DÉVELOPPEMENT ; en
  production React les tait — c'est donc bien sur `next dev` qu'il faut la jouer (écrit dans l'en-tête). Élargir aux
  écrans de l'admin. Moyen.
- **NRG-7** — *Produit* : ANO-WEB-103 et 104 réglées ; auditer tous les `user.carrierPage.*` du front contre la liste
  blanche de `/auth/me` (une garde de type : exposer un type `MeCarrierPage` généré depuis le contrat). Moyen, c'est la
  vraie protection. *Test* : un compte jetable par exécution s'accumule en base (piège 22) — les purger. Petit.
- **NRG-8** — *Produit* : rien. *Test* : les six libellés ne sont pas tous portés par un trajet de Thomas ; créer un
  trajet par statut rendrait la fiche exhaustive. Moyen.
- **NRG-9** — *Produit* : le refus nomme le nombre de deals ; y ajouter un lien direct vers la liste des deals à
  annuler. Petit.
- **NRG-10** — *Produit* : `useUser`, notifications et conversations rechargés à chaque page : un
  `staleTime` TanStack Query de 30 s en couperait une bonne part. Moyen. *Test* : la fiche projette désormais sur les
  plafonds de production et publie la répartition par route — un écran qui se met à sonder en rafale se voit AVANT
  le 429. Reste à la jouer en **navigation par liens** (et sur un build de production) pour une mesure réaliste,
  sans rechargements ni double montage. Petit.
- **NRG-11** — *Produit* : 403 au lieu de 500 (à trancher). *Test* : ajouter l'origine de production quand elle
  existera. Petit.
- **Transversal** — Deux des trois anomalies sont des **fonctions mortes sans erreur visible** : un front qui décide à
  la place du serveur (A146 dit l'inverse). La garde qui manque : relire, à chaque PR front, tout champ lu sur `user`
  contre la réponse réelle de `/auth/me`.

## Chapitre 6 — WEB-E2E-1, le nominal complet · **CONFORME** (29 étapes, 1 min 24)

| Étape du cahier | Ce qui est éprouvé | Verdict |
|---|---|---|
| 2 – 3 | Le visiteur voit le trajet, mais la porte se ferme sur « Réserver » | **Conforme** |
| 4 – 8 | L'Expéditrice réserve : colis, destinataire, Charte, autorisation | **Conforme** — total 32,20 € |
| 9 | Mailpit : chacun reçoit le sien | **Conforme** — l'Expéditrice lit **32,20 €**, le Voyageur **28,75 €**, et l'email du Voyageur **ne contient jamais** ce que l'Expéditrice a payé |
| 10 | Le Voyageur accepte, Charte comprise | **Conforme** — « Coche la Charte pour confirmer » tant qu'elle n'est pas cochée, puis « Tu es engagé sur ce Deal » ; email « a accepté ta demande » |
| 11 | Le Voyageur propose un rendez-vous de remise dans 3 jours, 10 h – 11 h | **Conforme après correction** → `ANO-WEB-03` ; « Un rendez-vous a été proposé. », « En attente de l'autre personne » |
| 12 | L'Expéditrice accepte | **Conforme** — « À confirmer par vous » → « Confirmé », « Le rendez-vous est confirmé. » (le fil se rafraîchit seul, 3 s) |
| 13 | « Voir le numéro » plus de 2 h avant | **Conforme** — bandeau « Le numéro s'affiche à partir du … », refus serveur **400 `TOO_EARLY`** (un refus métier porte un code, A146), aucun numéro dans la page |
| 14 | Le lien de suivi pour Clarisse | **Conforme** — `POST /deals/:id/tracking-link`, lien `/track/<jeton>` affiché dans la carte et présent dans le message copié |
| 15 | Le destinataire ouvre le lien | **Conforme** — « Ton colis arrive, Clarisse », jalon courant « Colis pris en charge », « Colis récupéré par Thomas » pas encore atteint, **ni code, ni numéro, ni montant** (page entière passée au crible) |
| 16 | Prise en charge : 5 points, 2 photos, une note | **Conforme** — bouton actif seulement à 5/5 + 1 photo ; toast « Prise en charge confirmée ! Aminata a reçu son code de livraison. » ; le numéro de Clarisse apparaît côté Voyageur |
| 17 | Le code apparaît côté Expéditrice ; l'email n'en dit rien | **Conforme** — six chiffres lus sur la carte ; email « est pris en charge » qui parle du code **sans jamais le contenir** (ni `742891`, ni `742 891`) |
| 18 | « Copier le message » du code | **Conforme** — le message porte le code et le prénom du destinataire |
| 19 | Aéroport, décollage, atterrissage, 5 s de repentir chacun | **Conforme** — le harnais attend la REQUÊTE (`POST /deals/:id/events`) et son 200, pas le temps ; le suivi du destinataire passe à « Arrivé à Brazzaville » |
| 20 | Un SEUL email de jalon | **Conforme** — un email « a atterri » ; aucun sujet « aéroport » ni « décollage » |
| 21 | Remise contre le code, avec une photo | **Conforme** — six cases « Chiffre 1 … 6 », « Livraison validée ! », « Ton versement arrive » daté **J+4** (`samedi 13 septembre`) |
| 22 | Période de vérification côté Expéditrice | **Conforme** — titre, compte à rebours « Versement automatique dans », carte « Signaler un problème » ; email « a été livré » avec « 3 jours » |
| 23 | Le destinataire recharge | **Conforme** — jalon « Colis remis », toujours rien de révélé |
| 24 | « Confirmer la livraison » puis « Oui, tout est OK » | **Conforme** — « Envoi terminé », « Transaction close », la carte de signalement a disparu |
| 25 | Mailpit | **Conforme** — Aminata : « Transaction terminée … » ; Thomas : « 28,75 € en route vers ton compte … » |
| 26 | L'Expéditrice note (5 étoiles, trois pouces, commentaire) | **Conforme** — « Merci pour ton retour ! », l'écran annonce que l'avis attend l'autre, et **le profil public de Thomas ne le montre pas encore** |
| 27 | Le Voyageur note à son tour | **Conforme** — « Aminata t'avait déjà noté : vos deux avis sont maintenant visibles. » |
| 28 | Les deux rechargent | **Conforme** — carte « Vos avis » avec le commentaire de l'autre, notification « Les notes sont révélées » chez les deux |
| 29 | La page publique de Thomas | **Conforme après correction du seed** — l'avis est public, signé « Aminata D. », puce « Ponctualité », ligne de faits « … Deals terminés · ★ … » (voir observations : `publicSlug` absent des comptes du seed) |

### Trois écarts assumés, écrits dans le parcours

- Le cahier fait **publier un trajet** à l'étape 1 ; le harnais réserve sur `bzv-perkg`, que le
  cahier lui-même désigne comme « le trajet de démonstration : c'est lui qu'on réserve dans tous
  les scénarios de réservation » (§ 2.4) — son Voyageur est donc Thomas, pas Joséphine. La
  publication d'un trajet est éprouvée par le chapitre 5.7, à sa place.
- Le paiement passe par le fournisseur **FAKE** (D11/D38), pour la raison technique décrite
  ci-dessous. Le paiement par carte reste éprouvé par la campagne API, avec la vraie CLI Stripe.
- Les photos **ne partent pas chez ImageKit** : le harnais interpose le fournisseur
  (`fixtures/photos.ts`, `E2E_IMAGEKIT=real` pour le vrai téléversement). Le jeton
  d'authentification est bien demandé à trip-service, la validation client (types, 10 Mo) est
  traversée, et les URL rendues sont enregistrées sur le deal — mais une recette qui déposerait
  trois vraies images dans la médiathèque de production à chaque exécution n'est pas une recette.

## Chapitre 6 — WEB-E2E-2, le parcours avec litige · **CONFORME** (19 étapes, 30 s)

| Étape du cahier | Ce qui est éprouvé | Verdict |
|---|---|---|
| 1 – 2 | Le suivi livré, « Signaler un problème », l'écran et ses quatre blocs | **Conforme** |
| 3 | Motif « Contenu manquant ou différent de la déclaration » | **Conforme** — radios habillées, `aria-checked` |
| 4 | « Ça ne va pas » : refusé | **Conforme** — compteur « n / minimum 50 caractères », bouton inactif (12 ou 13 selon la forme du Ç : le harnais ne parie pas) |
| 5 | Récit ≥ 50, deux photos, « Remboursement intégral », engagement | **Conforme** — le bouton s'active seulement alors |
| 6 | « Envoyer » puis « Oui, envoyer » | **Conforme** — « Signalement envoyé », numéro `YAM-XXXX`, identique à celui de la réponse serveur |
| 7 | Le fil est fermé | **Conforme** — « Un litige est en cours : les échanges passent par la médiation. », aucune saisie rendue |
| 8 | Mailpit | **Conforme** — accusé au signalant (dossier, « gelé », « 48 h ouvrées ») ; email calme au Voyageur avec la catégorie seule, sans le récit ni les photos |
| 9 – 10 | Le Voyageur voit le dossier | **Conforme** — « Signalement en cours · dossier … », versement « mis en attente », motif « contenu manquant » seul, jamais le récit |
| 11 | Sa version trop courte | **Conforme** — « Au moins 50 caractères. », bouton inactif (pas de bouton « Donner ma version » : le formulaire est déjà ouvert, voir écarts) |
| 12 | Sa version, une photo | **Conforme** — « Ta version est enregistrée. », « Version envoyée », le bouton ne revient pas après rechargement ; **aucun** email de plus ni pour l'un ni pour l'autre |
| 13 | L'Expéditeur apprend le fait | **Conforme** — « a donné sa version. La décision arrive sous 5 jours ouvrés. », jamais le contenu |
| 14 | La médiatrice tranche | **Conforme** — file « À arbitrer », dossier avec les deux versions et sans le code de livraison, récapitulatif « 15,00 € / 40,00 € / 6,60 € », « Décision enregistrée » |
| 15 | L'Expéditeur lit la décision | **Conforme après correction** → `ANO-WEB-04` ; « retenu en partie », « 15,00 € te sont remboursés », le motif |
| 16 | Le Voyageur lit la décision | **Conforme** — « une part du prix est remboursée à l'Expéditeur », « 40,00 € partent vers ton compte », le même motif, **jamais 15,00 €** |
| 17 | Aucun « Noter » | **Conforme** — des deux côtés |
| 18 | Mailpit | **Conforme** — « Décision rendue sur ton envoi » avec 15,00 € et sans 40,00 € ; « … sur ton transport » avec 40,00 € et sans 15,00 € |
| 19 | Finances › Paiements | **Conforme après correction du seed** → `ANO-WEB-05` ; « Remboursé 15,00 € le … », « + 15,00 € » |

### Deux écarts assumés, écrits dans le parcours

- Étape 11 : il n'y a pas de bouton « Donner ma version » dans le produit — le formulaire est
  déjà ouvert dans la carte « Donne ta version » ; le libellé du cahier est celui de l'email.
- Étape 12 : l'endpoint est `POST /deals/:id/dispute/statement` (le cahier n'en nomme aucun).

## Chapitre 6 — WEB-E2E-3, l'annulation tardive · **CONFORME** (15 étapes, 38 s)

| Étape du cahier | Ce qui est éprouvé | Verdict |
|---|---|---|
| 1 | Le trajet part dans moins de 48 h | **Manœuvre consignée** — `yul` part à J+3 dans le seed ; départ ramené à +24 h AVANT la réservation (le barème lit le départ figé dans le deal) |
| 2 | 3 kg, taille S, 100 € | **Conforme** — transport 28,50 € + service 3,42 € = **31,92 €** ; Finances : « Autorisé, pas débité » |
| 3 | Marc accepte | **Conforme** — net 28,50 €, paiement capturé (« Bloqué chez Yamba »), 3 kg réservés |
| 4 | Deux messages, notification à chaque envoi | **Conforme après correction** → `ANO-WEB-06` (« Nouveau message ») |
| 5 – 7 | « Annuler cet envoi ? » et son arithmétique | **Conforme** — « Tu seras remboursée de 15,96 € », retenue de 50 % (15,96 €) reversée au Voyageur ; remboursement = total ÷ 2, compensation = arrondi(retenue × net ÷ total) = 14,25 €, écart 0 |
| 8 | « Garder l'envoi » | **Conforme** — la fenêtre se ferme, aucune requête ne part, le deal reste accepté |
| 9 | « Confirmer l'annulation » | **Conforme** — réponse `CANCELLED`, toast « Envoi annulé. Remboursement de 15,96 € en cours. », ligne « Annulée » |
| 10 | Finances › Paiements | **Conforme** — « Remboursé 15,96 € le … · retenue 15,96 € reversée au Voyageur » |
| 11 | Finances › Portefeuille de Marc | **Conforme** — « Compensation · annulation tardive de Marie-Claire », « Parti le … · 2 à 7 jours », + 14,25 € |
| 12 | Mes trajets, kilos rendus | **Conforme** — « Annulée tardivement · 14,25 € de compensation … » ; kilos vérifiés par l'API (13 → 10), l'écran ne les affiche pas (voir écarts) |
| 13 | Mailpit | **Conforme** — Marie-Claire : « est annulée » puis « Remboursement émis … » avec la retenue qui « revient au Voyageur » ; Marc : « a été annulé » puis « 14,25 € de compensation en route vers ton compte » |
| 14 | Le fil reste lisible et ouvert | **Conforme** — saisie présente, aucun bandeau (fermeture à J+14) |
| 15 | Marc tente d'annuler le trajet | **Conforme sur le refus** (409, « Ce trajet porte encore 2 deals en cours … ») — mais le conseil affiché est inapplicable → `ANO-WEB-07` (ouverte) |

### Trois écarts assumés, écrits dans le parcours

- Étape 12 : « Mes trajets » n'affiche pas les kilos restants du trajet ; ils sont vérifiés par
  l'API (`capacityKg − reservedKg`), avant et après. Chapitre 5.7 à reprendre pour l'écran.
- Étape 15 : « sinon, l'annulation passe » n'est pas atteignable sur `yul` (un deal DELIVERED
  d'Aminata y reste vivant et n'est pas annulable) ; seule la branche du refus est jouée.
- Étape 4 : le libellé « Nouveau message » est celui posé par la correction ANO-WEB-06 (le
  cahier ne nommait pas le titre).

## Chapitre 6 — WEB-E2E-4, le compte neuf plafonné · **CONFORME** (14 étapes, 1 min 06)

| Étape du cahier | Ce qui est éprouvé | Verdict |
|---|---|---|
| 1 | Inscription, code reçu, activation, bienvenue | **Conforme** — « Ton code d'activation Yamba », « Compte activé », « Bienvenue sur Yamba » |
| 2 | Connexion sans « Rester connecté » | **Conforme** — cookie de rafraîchissement de session (sans date d'expiration) |
| 3 – 4 | 450 € déclarés | **Conforme après correction** → `ANO-WEB-08` ; refus à l'intention, « Aucun paiement pour l'instant », aucun email |
| 5 | 12 kg | **Conforme** — refus à l'intention (plafond de poids) |
| 6 – 7 | Cinq demandes dans le mois (bzv-perkg, fih, gru, yul, bzv-upcoming) | **Conforme** |
| 8 | La sixième | **Conforme** — refusée, même message |
| 9 | Profil, tableau de bord, page publique | **Conforme** — aucun « score », « niveau de risque », « points » |
| 10 | Export de mes données par la porte | **Conforme après correction** → `ANO-WEB-09` ; JSON `yamba-data-export/1`, aucune trace du score |
| 11 | Thomas accepte | **Conforme** — email « est acceptée », notification |
| 12 | Session inactive plus d'une heure, puis un geste | **Conforme** (manœuvre SES-01 consignée) — fenêtre « Ta session a expiré » par-dessus la page, reconnexion sur place, page inchangée, session de retour ; le geste est refait à la main (voir écarts) |
| 13 | Appareils connectés | **Conforme** — « Chrome · … · cet appareil », « Dernière activité … · ::1 » (l'écran s'intitule « Sessions actives », voir écarts) |
| 14 | Supprimer mon compte | **Conforme** — bandeau ambre, les deux motifs (deal en cours, demande en attente), aucune porte, aucun email |

### Trois écarts assumés, écrits dans le parcours

- Étape 12 : « le geste reprend » — le produit ne rejoue pas l'action qui a échoué ; il
  rafraîchit les données de la page. Le harnais vérifie l'URL inchangée, la session de retour, et
  que le même geste refait passe. Copie du cahier à ajuster, ou évolution produit à décider.
- Étape 12 : l'heure d'inactivité est simulée (SES-01 : le délai d'inactivité EST la durée de vie
  de la clé Redis de la session ; la supprimer, c'est l'avoir laissée expirer), consignée.
- Étape 13 : le cahier dit « Appareils connectés », l'écran s'intitule « Sessions actives »
  (sous-titre « Les appareils connectés à ton compte »). Le cahier à aligner.

---

## Chapitre 6 — WEB-E2E-5, le refus au pickup et le remboursement · **CONFORME** (8 étapes, 1 min 06)

| Étape du cahier | Ce qui est éprouvé | Verdict |
|---|---|---|
| 1 | Aminata réserve 2 kg, taille S sur `fih` (Bruxelles → Kinshasa, tarif par catégorie) | **Conforme** — total lu à l'écran (22,00 €), suivi ouvert |
| 2 | Joséphine accepte | **Conforme** — « Bloqué chez Yamba », email « est acceptée », kilos réservés (API) |
| 3 | « Refuser le colis » depuis la prise en charge | **Conforme** — « Refuser ce colis ? », « Refuser un colis non conforme ne pénalise jamais ta réputation. », « Le Deal sera annulé et Aminata intégralement remboursée. » |
| 4 | Raison « Le contenu ne correspond pas à la déclaration », confirmation | **Conforme** — toast « Colis refusé. Aminata a été notifiée et sera remboursée. », 200 `CANCELLED`, `refundAmountCents` = total |
| 5 | Mes envois, Finances | **Conforme** — « Annulée » ; « Remboursé 22,00 € le … », sans retenue |
| 6 | Mailpit | **Conforme** — « Ton colis Bruxelles → Kinshasa n'a pas pu être pris en charge » avec la raison traduite, puis « Remboursement émis … » du montant intégral, sans un mot de retenue, dans cet ordre |
| 7 | Page publique de Joséphine | **Conforme après correction** → `ANO-WEB-10` ; ligne de faits identique avant / après |
| 8 | Mes trajets | **Conforme** — ligne du deal « Annulé », kilos rendus (API) |

### Deux écarts assumés, écrits dans le parcours

- Étape 6 : le cahier dit « refus à la remise » ; le sujet réel est « Ton colis … n'a pas pu
  être pris en charge » — la raison traduite est dans le corps. Copie du cahier à aligner.
- Étape 8 : « Mes trajets » n'affiche pas les kilos restants (écart déjà consigné en WEB-E2E-3) ;
  ils sont lus à l'API du trajet, avant, après l'acceptation, après le refus.

---

## Chapitre 6 — WEB-E2E-6, le parcours du destinataire · **CONFORME** (9 étapes, 1 min 00)

Le tronc de WEB-E2E-1 est rejoué (réservation, acceptation, lien de suivi, prise en charge,
jalons, remise) et la page du destinataire — un visiteur, navigateur C — est rechargée à chaque pas.

| Étape du cahier | Ce qui est éprouvé | Verdict |
|---|---|---|
| 1 | Le lien reçu | **Conforme** — « Ton colis arrive, Clarisse », « Aminata t'envoie un colis avec Thomas N., Voyageur Yamba, de Paris à Brazzaville. », Départ / Arrivée prévue, frise de cinq jalons, aide de l'étape |
| 2 | Adresse, numéro, code, photo, montant | **Conforme** — absents de l'écran ET du code source (numéro du destinataire, montant payé, lieux de remise du trajet, `ik.imagekit.io`, aucune image) ; l'API sert exactement les huit clés du contrat `PublicTrackingResponse` |
| 3 | La frise après chaque jalon | **Conforme** — « Colis récupéré par Thomas » / « Le colis voyage avec Thomas. », puis « En route » au décollage ; l'aéroport ne fait pas bouger la page (voir écarts) ; le code de livraison, connu du harnais, n'apparaît nulle part |
| 4 | L'atterrissage | **Conforme** — « Arrivé à Brazzaville » · « Thomas est arrivé. Il te contacte pour convenir de la remise : prépare le code que Aminata t'a donné. » |
| 5 | La remise | **Conforme** — « Colis remis » · « Le colis t'a été remis. Bonne réception ! », cinq jalons datés |
| 6 | La mention de confidentialité | **Conforme** — texte exact, lien vers `/fr/legal/privacy` |
| 7 | Le bloc d'acquisition | **Conforme après correction** → `ANO-WEB-11` ; « Envoyer un colis » → recherche, « Devenir Voyageur » → porte de connexion puis onboarding |
| 8 | Un caractère du jeton altéré | **Conforme** — « Ce lien de suivi n'est plus valide », sans prénom ni corridor ; le 404 de l'API est identique pour un jeton altéré et un jeton inventé |
| 9 | Rien n'a été envoyé au destinataire | **Conforme** — adresse email déclarée exprès à la réservation : aucun email ; chaque email de la campagne va à un compte membre ; aucun émetteur de SMS n'existe sur la plateforme |

### Deux écarts assumés, écrits dans le parcours

- Étape 3 : « Je suis à l'aéroport » n'est pas un jalon public (D69 : `IN_TRANSIT` naît au
  décollage, `ARRIVED` à l'atterrissage). La page ne bouge pas à l'aéroport ; le cahier dit « à
  chaque jalon confirmé » — à préciser.
- Étape 9 : « aucun SMS » est un fait de plateforme (aucune dépendance, aucun appel), pas une
  observation de recette ; le harnais prouve l'absence d'email et l'adressage exclusif aux membres.

**Le chapitre 6 est clos** : six parcours, 100 étapes, tous conformes, quatre anomalies
majeures corrigées en chemin (ANO-WEB-08 à 11).



---

## Cahier 02-ADMIN — § 4.1 Connexion en deux étapes · **CONFORME** (6 fiches jouées, 1 après correction · 1 anomalie close · 1 écart documentaire · 7 scénarios, 17 min)

`apps/e2e/src/admin/adm-sec-connexion.spec.ts`. Premier chapitre du cahier du back-office : tout le reste suppose qu'une
session admin s'ouvre correctement. La règle centrale de ce cahier est appliquée à chaque fiche (§ 3.4) — **un geste se
vérifie à l'écran ET dans le journal d'audit** — par un outil nouveau, `pages/journal-admin.ts`, qui relit le journal
par l'API de l'écran `/audit` avec une session super administrateur (jamais en base : la recette prouve ce qu'un
administrateur peut effectivement relire), borné dans le temps (le journal n'est jamais purgé).

Un **compte admin jetable** porte les fiches qui consomment ou immobilisent : un membre neuf promu par `grant-admin.ts`
(réponse du script vérifiée), enrôlé, puis révoqué et effacé en fin de chapitre — les sept comptes de recette restent
intacts. Les **codes TOTP sont calculés** à partir du secret affiché ou enrôlé, comme le ferait une application
d'authentification. Les **attentes réelles** (5 et 15 minutes) s'emboîtent : SEC-6 se joue pendant le blocage de SEC-5.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-SEC-1 | Email et mot de passe | **Conforme** — la racine renvoie à `/login` ; titre et sous-titre exacts ; mot de passe faux ET compte inexistant → le même « Email ou mot de passe incorrect. » (aucune énumération) ; bon mot de passe → l'écran du code ; cookie `admin_preauth` httpOnly ≈ 5 min, **aucun** `admin_access_token` ; **aucune** ligne de journal |
| ADM-SEC-2 | Premier enrôlement | **Conforme** — l'écran d'enrôlement (pas le champ du code) ; QR (`alt` « QR code TOTP ») et secret base32 en chasse fixe ; code calculé → « 2FA activée. Codes de secours, montrés une seule fois : », **8** codes `ABCDE-FGHIJ` sur **deux colonnes**, la mention ; « J'ai enregistré mes codes » → `/home` ; ✉ « Nouvelle connexion au back-office Yamba » avec IP, appareil, date ; en base `totpSecretEncrypted` posé et différent du secret, secret absent de toute ligne `AdminAction` ; journal `ADMIN_TOTP_ENABLED` (USER · id) puis `ADMIN_LOGIN` |
| ADM-SEC-3 | Code courant et anti-rejeu | **Conforme** — connexion → `/home` ; « Se déconnecter » ; le **même code** dans le même pas de 30 s → « Code invalide. » ; le code suivant passe ; journal `ADMIN_LOGIN`, `ADMIN_LOGOUT`, rien pour le refus, `ADMIN_LOGIN` |
| ADM-SEC-4 | Code de secours | **Conforme** — un code de secours ouvre la session (journal `ADMIN_BACKUP_CODE_USED` puis `ADMIN_LOGIN`) ; réutilisé → « Code invalide. » ; 7 codes restants → aucun avertissement ; **consommés jusqu'à deux** → « Il te reste 2 code(s) de secours » dans la barre latérale |
| ADM-SEC-5 | Blocage après cinq échecs | **Conforme après correction** → `ANO-ADM-01` ; cinq codes faux → « Code invalide. » ; le **vrai** code refusé (`TOO_MANY_ATTEMPTS`) avec désormais « Trop de tentatives : ce compte est bloqué pendant 15 minutes… » ; un **autre navigateur** bloqué aussi (compteur par compte) ; clé Redis `admin_totp_fail:<id>`, TTL ≤ 900 s ; aucune ligne de journal ; **15 minutes plus tard**, le vrai code passe (seule ligne : `ADMIN_LOGIN`) |
| ADM-SEC-6 | Délai de pré-authentification | **Conforme** — 5 min 15 s sans rien saisir, puis un code valide → « Délai dépassé : recommence depuis le mot de passe. », retour au formulaire ; aucune ligne |

### Anomalie

- **ANO-ADM-01 (bloquante par la fiche, close)** — **un compte bloqué affichait « Code invalide. », même avec le bon
  code.** Le serveur refuse proprement (401 `TOO_MANY_ATTEMPTS`, « Too many attempts. Try again in 15 minutes. ») mais
  l'écran traduisait TOUT 401 en « Code invalide. » : l'administrateur se croyait fautif et réessayait pendant quinze
  minutes. Correction (`apps/admin-ui/src/components/LoginFlow.tsx`) : l'écran lit `details.code` (A146) —
  `TOO_MANY_ATTEMPTS` → « Trop de tentatives : ce compte est bloqué pendant 15 minutes. Réessaie ensuite avec un
  nouveau code. », et le délai dépassé se reconnaît à `ADMIN_PREAUTH_EXPIRED` / `_REQUIRED` (le message anglais reste un
  repli : un libellé n'est pas un contrat).

### Écart documentaire

- **La cible de `ADMIN_LOGIN` est `SESSION`, sans identifiant**, là où le cahier écrit `USER · <id>` (SEC-2, 3, 4, 5).
  Le code fait foi. Conséquence pratique à connaître : filtrer `/audit` par **cible** ne retrouve pas les connexions
  d'un admin ; filtrer par **auteur** (`adminUserId`) les retrouve toutes. À corriger dans le cahier, ou à trancher
  (poser `targetId` = l'admin rendrait le filtre par cible utile).

### Regard d'expert — produit ET test, une ligne par fiche

- **SEC-1** — *Produit* : conforme et sobre. Un délai progressif sur les mots de passe faux répétés (aujourd'hui
  seul le limiteur du gateway freine) serait une défense de plus contre le bourrage d'identifiants — moyen. *Test* :
  vérifier aussi `SameSite` et `Secure` du cookie en production (ils ne peuvent pas l'être en `http` local) — petit.
- **SEC-2** — *Produit* : l'alerte de connexion ne dit pas **comment réagir** si ce n'est pas soi (lien vers « Mes
  sessions ») — petit. *Test* : le secret est lu à l'écran ; décoder aussi le QR (`otpauth://`) prouverait que QR et
  secret disent la même chose — petit.
- **SEC-3** — *Produit* : conforme. *Test* : la fiche démarre au début d'un pas de 30 s pour tenir connexion,
  déconnexion et rejeu dans le même pas — c'est la seule façon honnête de prouver l'anti-rejeu — rien à faire.
- **SEC-4** — *Produit* : aucun écran pour **régénérer** les codes de secours (le cahier le dit) : un admin à deux codes
  n'a que `grant-admin.ts --revoke` — un bouton « Régénérer mes codes » derrière un code TOTP est le vrai manque —
  moyen. *Test* : consomme six codes sur un compte jetable, jamais sur un compte de recette — rien à faire.
- **SEC-5** — *Produit* : ANO-ADM-01 réglée ; afficher l'heure de levée (« jusqu'à 14 h 32 ») plutôt que « 15 minutes »
  — petit ; une alerte email au titulaire lors d'un blocage (tentatives sur SON compte) — moyen. *Test* : la levée est
  vérifiée par une vraie attente, pas en effaçant la clé Redis — rien à faire.
- **SEC-6** — *Produit* : conforme. *Test* : cinq minutes d'attente réelle ; un contrôle du TTL du cookie (déjà fait
  en SEC-1) permettrait de réduire la fiche à une vérification de l'expiration côté serveur par jeton forgé — petit.
- **Transversal** — Le même défaut qu'aux chapitres web (ANO-WEB-104) : **un écran qui décide sans lire le code du
  serveur**. `describeError` traduit un statut HTTP ; il devrait d'abord lire `details.code`, partout dans admin-ui —
  moyen, à étendre avant le § 5.

---

## Cahier 02-ADMIN — § 4.2 Sessions et durée de vie · **CONFORME** (4 fiches, 1 après correction · 1 anomalie close · 1 fiche partielle · 4 scénarios, 49 min dont 46 d'attente)

`apps/e2e/src/admin/adm-sec-sessions.spec.ts`. Une session admin est un objet à part : cookies `admin_*`, préfixe Redis
`admin_jti:`, 45 minutes d'inactivité, 12 heures de vie absolue, révocable. Les fiches lisent **Redis** (TTL, existence
de la clé, `createdAt`) par un script `tsx` consigné, en plus de l'écran et du journal.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-SEC-7 | La session membre n'ouvre aucune route admin | **Conforme** — le super administrateur connecté sur le site (`/auth/me` 200) ; `/home` du back-office → `/login` ; `GET /api/admin/kpis` avec les seuls cookies membre → **401** ; connexion admin dans le même navigateur ; `/auth/me` toujours 200, les **quatre** cookies coexistent ; journal : un seul `ADMIN_LOGIN` |
| ADM-SEC-8 | Expiration par inactivité | **Conforme** (attente réelle) — TTL de la clé à l'ouverture > 43 min ; onglet fermé (`about:blank`), **46 minutes** ; la clé Redis a expiré d'elle-même ; `/alerts` → `/login` ; journal : **aucune** ligne |
| ADM-SEC-9 | Vie absolue de 12 h | **Conforme, ⏭ partiel** (12 h ne tiennent pas dans une journée) — session neuve : TTL ≈ 45 min ; `refresh` → le `jti` **tourne**, l'ancien n'existe plus, `createdAt` **conservé** ; manœuvre consignée : session vieillie à 11 h 59 → renouvelée avec un TTL **≤ 60 s** ; vieillie à 12 h 01 → `refresh` **401**, l'écran renvoie à `/login` |
| ADM-SEC-10 | Révoquer une session | **Conforme après correction** → `ANO-ADM-04` ; deux vraies sessions du Support (deux navigateurs, deux `jti` lus dans leurs jetons) ; deux emails « Nouvelle connexion au back-office Yamba » ; « Mes sessions admin », texte d'aide exact, une ligne « cette session », « ouverte le … · active le … » ; révocation de B depuis A → le jeton d'accès de B est refusé **immédiatement** (`401 ADMIN_SESSION_REVOKED`), B navigue → `/login` ; A révoque la sienne par le bouton → `/login` ; journal : `ADMIN_SESSION_REVOKED` `SESSION · jtiB` puis `SESSION · jtiA` |

### Anomalie

- **ANO-ADM-04 (majeure, close)** — **révoquer une session admin ne coupait pas l'accès.** La révocation supprimait
  l'enregistrement Redis, ce qui bloquait le *renouvellement* ; mais le jeton d'accès (JWT de 15 minutes) ne désignait
  aucune session et restait accepté : `GET /admin/kpis` avec le jeton de B, juste après sa révocation, répondait
  **200**. Un navigateur volé gardait donc jusqu'à quinze minutes de back-office après que son titulaire l'avait
  révoqué. Correction : le jeton d'accès porte le `jti` (ouverture et renouvellement, `admin-auth.controller.ts`) ;
  `isAdminAuthenticated` vérifie à chaque requête que `admin_jti:<id>:<jti>` existe (`session-revocation.ts`,
  `adminSessionKey` partagée avec l'écrivain) ; Redis injoignable → **refus** (échec fermé, voir DOC-TECHNIQUE). Les
  jetons émis avant la correction (sans `jti`) restent acceptés jusqu'à leur expiration.

### Regard d'expert — produit ET test, une ligne par fiche

- **SEC-7** — *Produit* : conforme. *Test* : vérifier aussi que les cookies membre et admin n'ont pas le même `Path`
  ni le même nom de domaine en production (ici `localhost`) — petit.
- **SEC-8** — *Produit* : la session expire sans prévenir ; un avertissement « ta session expire dans 2 minutes »
  éviterait de perdre un motif de décision saisi pendant 40 minutes (le formulaire « Trancher » en demande 50
  caractères) — moyen. *Test* : 46 minutes d'attente réelle, la fiche la plus chère du cahier ; la jouer seule ou en
  dernière, jamais au milieu d'un chapitre qui utilise le compte Médiateur — rien à faire.
- **SEC-9** — *Produit* : conforme. *Test* : la manœuvre Redis prouve la borne sans attendre ; ce qu'elle ne prouve pas,
  c'est qu'un renouvellement ne **ré-écrit** jamais `createdAt` sur une longue durée — couvert par l'assertion
  « createdAt conservé » — rien à faire.
- **SEC-10** — *Produit* : ANO-ADM-04 réglée. La page « Mes sessions » ne montre ni appareil ni adresse IP (le cahier
  le note) : l'administrateur révoque « la ligne du dessous » à l'aveugle — les enregistrements admin devraient porter
  `device` / `ip` comme ceux des membres (D65) — **moyen, c'est le vrai manque de l'écran**. Un bouton « Révoquer
  toutes les autres » — petit. *Test* : la révocation de B passe par l'API de l'écran faute de pouvoir distinguer les
  lignes ; l'ajout de l'appareil permettrait de cliquer la bonne ligne — dépend du produit.

---

## Cahier 02-ADMIN — § 4.3 La matrice des permissions · **CONFORME** (9 fiches + 1 fiche de contrôle, 2 après correction · 2 anomalies closes · 3 écarts documentaires · 10 scénarios, 6 min)

`apps/e2e/src/admin/adm-prm-profils.spec.ts` et `adm-prm-garde-serveur.spec.ts`. Pour chaque profil : **le menu**
(déduit du contrat `ADMIN_PERMISSIONS` ET comparé à la liste du cahier — un écart contrat/écran est fonctionnel, un écart
contrat/cahier documentaire), **un geste réussi et journalisé**, **des refus du serveur** (un bouton caché ne prouve
rien). Les gestes d'écriture dont le formulaire relève du § 5 passent par l'API de l'écran, et sont défaits.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-PRM-0 | Le miroir front de la matrice | **Conforme** (fiche ajoutée) — `apps/admin-ui/src/lib/permissions.ts` lu et comparé permission par permission à `ADMIN_PERMISSIONS` : identiques |
| ADM-PRM-1 | Super administrateur | **Conforme** — les quinze entrées dans l'ordre ; 18 écrans ouverts, **aucun** 403 ; sa propre fiche : « (c'est toi : aucune action possible) », sanction sur soi → 403 « You cannot act on your own account. » ; journal `DATA_REQUESTS_VIEWED`, `DEAL_MONEY_VIEWED`, `USER_VIEWED` |
| ADM-PRM-2 | Médiateur | **Conforme après correction** → `ANO-ADM-02` ; menu = contrat = cahier ; YAM-2041 : la section de décision (jamais « Ton profil lit ce dossier mais ne tranche pas ») ; fiche de Thomas : « Appliquer » ; `/admins`, `/privacy` → 403 ; `PATCH /admin/settings` d'une clé métier → 403 « Your admin profile cannot change… » ; **remise à zéro** d'une clé métier déjà par défaut → **403** (était 400) ; preuve forte : commission modifiée par le super administrateur, remise à zéro par le Médiateur **refusée**, valeur **inchangée**, puis rétablie ; `/admin/audit` et l'export nominatif → 403 ; pas de bouton d'export ; journal `DISPUTE_VIEWED BOOKING · id`, `USER_VIEWED USER · id`, rien pour les refus |
| ADM-PRM-3 | Support | **Conforme** — menu = contrat = cahier ; le billet en attente ouvert puis **validé** ; fiche membre : « Proposer », jamais « Appliquer » ; conversation du deal lue ; `/finances`, `/pilotage`, `/audit` → 403 ; appliquer une sanction → 403 ; remise à zéro globale → 403 ; YAM-2041 : « Ton profil lit ce dossier mais ne tranche pas » ; journal `DOCUMENT_VIEWED TRIP`, `TICKET_VERIFIED TRIP`, `USER_VIEWED`, `CONVERSATION_VIEWED`, aucune sanction ni paramètre |
| ADM-PRM-4 | Exploitation (OPS) | **Conforme** — menu = contrat = cahier ; `/settings` : « super administrateur seul » sur les clés métier ; `alerts.payoutFailedHours` modifiée puis remise ; `/status` sans 403 ; `/users`, `/disputes`, `/finances`, `/audit` → 403 ; clé métier → 403 « Your admin profile cannot change: pricing.commissionPct. » ; journal `SETTING_CHANGED SETTINGS · alerts.payoutFailedHours` avec clé et motif |
| ADM-PRM-5 | Finance | **Conforme** — menu = contrat = cahier ; `/finances`, fiche argent, rapport mensuel, `/audit`, dossier de médiation sans 403 ; export CSV **200** `text/csv` ; conversation → 403 (vie privée) ; trancher → 403 ; jamais « Rembourser maintenant » ; journal `DEAL_MONEY_VIEWED`, `FINANCE_EXPORTED`, `DISPUTE_VIEWED` |
| ADM-PRM-6 | Données personnelles (PRIVACY) | **Conforme après correction** → `ANO-ADM-03` / **A153** ; menu = contrat, **« Utilisateurs » en plus** du cahier ; accueil : `GET /admin/kpis` 403 (attendu) ; `/privacy` ; `/users` avec « Exporter en CSV (données personnelles) » ; fiche de Thomas avec « Effacer ce compte (RGPD) » ; proposer une sanction → 403 ; `/disputes`, `/finances`, `/trips`, `/settings` → 403 ; journal `DATA_REQUESTS_VIEWED USER` (sans id), `USER_VIEWED USER · id` |
| ADM-PRM-7 | Cumul Support + Finance | **Conforme** — libellé « Support + Finance » ; menu = union du contrat = cahier ; `/finances`, `/tickets`, dossier sans 403 ; remboursement manuel **proposé** (100 cts) ; trancher → 403 (l'union ne crée aucun droit) ; journal `REFUND_MANUAL_PROPOSED BOOKING · id`, `after.amountCents = 100` ; jeu d'essai rejoué ensuite (aucune proposition laissée ouverte) |
| ADM-PRM-8 | Conflits d'intérêts | **Conforme, ⏭ partiel** (cas 3, 4, 5 : aucun compte admin du jeu d'essai n'est partie à un deal — le cahier l'autorise) — cas 1 : sur soi → 403 ; cas 2 : Médiateur sur un compte admin → 403 « Only a super administrator can act on an admin account. » ; cas 6 : s'effacer → 403 ; cas 7 : retirer son accès → 403 ; cas 8 : se rétrograder → 403 « You cannot change your own profile. » ; aucune ligne de sanction, d'effacement ni de profil |
| ADM-PRM-9 | La garde serveur, route par route | **Conforme** — **56 routes** lues dans les quatre routeurs × **7 comptes** : **377 appels**, 15 écritures sans identifiant non appelées par un compte autorisé ; **aucune** garde absente, **aucune** permission mal nommée, **aucun** refus à tort ; journal : ni écriture ni export nominatif (seulement des exports opérationnels et `DATA_REQUESTS_VIEWED`) ; export nominatif sans motif → 400 |

### Anomalies

- **ANO-ADM-02 (mineure, close)** — **un refus déguisé en « rien à faire ».** `POST /admin/settings/reset` sur des clés
  déjà à leur valeur par défaut répondait **400 « Nothing to reset »** à un Médiateur, qui n'a aucune portée
  d'écriture : la vérification de portée ne portait que sur les clés qui *changent*. Rien n'était écrit, mais la réponse
  mentait sur la raison. Correction (`platform-settings.service.ts`) : si aucune clé visée n'est à la portée du profil,
  403 ; un profil qui peut en écrire au moins une garde le 400.
- **ANO-ADM-03 (majeure par la fiche, close par A153)** — **le profil Données personnelles ne pouvait pas atteindre ses
  propres gestes.** L'export nominatif (`exports.personal`) et l'effacement (`users.erase`) vivent sur `/users` et
  `/users/:id`, gardés par `users.read`, que PRIVACY n'avait pas ; `/privacy` renvoyait à « sa fiche », que le profil ne
  pouvait pas ouvrir. Tranché pendant la recette : `users.read` s'ouvre à PRIVACY (contrat + miroir), lecture seule.
  Alternative écartée : une garde « l'une de ces permissions » sur deux routes (deux régimes de permissions).

### Écarts documentaires

- **Menu PRIVACY** : « Utilisateurs » s'ajoute (A153) — le cahier écrit « le menu le plus court ».
- **YAM-2041 (PRM-2)** : le cahier attend le formulaire « Trancher » ; le jeu d'essai ouvre le litige il y a un jour et
  le Voyageur a 72 heures pour répondre, l'écran affiche donc l'échéance à la place du formulaire. La permission est
  prouvée (section de décision, jamais le texte du lecteur).
- **Cas 8 (PRM-8)** : le cahier attend « The last super administrator cannot be downgraded » ; le seul acteur qui puisse
  viser le dernier super administrateur est lui-même, arrêté avant par « You cannot change your own profile. ». Le 403
  tient ; le message du cahier est inatteignable.

### Regard d'expert — produit ET test, une ligne par fiche

- **PRM-0** — *Produit* : la matrice existe en deux copies manuelles ; faire importer le contrat par admin-ui (alias
  `@packages/api-contracts` dans son `tsconfig` / `next.config`) supprimerait la copie — moyen. *Test* : tant que la copie
  existe, la fiche la tient — rien à faire.
- **PRM-1** — *Produit* : conforme. *Test* : les 18 écrans ne vérifient que l'absence de 403 ; y ajouter « aucune erreur
  console » attraperait un écran cassé pour une autre raison — petit.
- **PRM-2** — *Produit* : ANO-ADM-02 réglée ; la route `/admin/settings/reset` n'est gardée que par `settings.read` —
  une garde « au moins une portée d'écriture » au routeur rendrait le refus lisible dans la matrice PRM-9 — petit.
  *Test* : poser un litige ouvert depuis plus de 72 h dans le jeu d'essai permettrait de voir le vrai formulaire — petit.
- **PRM-3** — *Produit* : conforme. *Test* : le billet validé modifie le jeu d'essai ; le chapitre suivant le rejoue
  (`beforeAll`) — rien à faire.
- **PRM-4** — *Produit* : conforme. *Test* : la remise de la valeur n'est pas dans un `finally` (contrairement à PRM-2) ;
  un échec entre les deux laisserait le seuil modifié — petit, à aligner.
- **PRM-5** — *Produit* : conforme. *Test* : l'export n'est vérifié que par son type ; lire la ligne d'en-tête du CSV et
  l'absence d'email prouverait « identifiants seulement » — petit.
- **PRM-6** — *Produit* : A153 confie au profil RGPD la fiche entière (TrustScore, historique des sanctions) ; une vue
  « fiche réduite » pour PRIVACY serait plus juste au principe de minimisation — moyen, à trancher. L'accueil de PRIVACY
  affiche le message anglais de l'API en rouge — voir § 5.1.
- **PRM-7** — *Produit* : conforme. *Test* : rejouer tout le seed pour effacer une proposition coûte ~1 min ; une route
  « retirer la proposition » serait aussi utile au produit (une proposition erronée reste dans la file) — petit.
- **PRM-8** — *Produit* : un jeu d'essai sans admin partie à un deal laisse trois cas non joués ; un compte admin qui est
  aussi Voyageur dans `seed-admins.ts` les rendrait jouables — moyen.
- **PRM-9** — *Produit* : 56 routes, aucune garde manquante. *Test* : la lecture par expression régulière suppose la garde
  sur la même instruction que la route ; un routeur écrit autrement échapperait à la lecture — la « garde du garde »
  (> 50 routes) ne verrait pas la perte d'une seule — petit : compter par service.

---

## Cahier 02-ADMIN — § 5.1 Accueil et compteurs · **CONFORME** (3 fiches · 0 anomalie produit · 3 écarts documentaires · 3 scénarios, 2 min)

`apps/e2e/src/admin/adm-acc-accueil.spec.ts` et l'outil `pages/ecran-admin.ts` (`tuilesDeLaSection` lit libellé,
valeur, lien et couleur de chaque tuile ; `lireCoteServeur` compte en base). Trois preuves par tuile : **écran = API**
(`GET /admin/kpis`), **API = cahier** sur les files que le jeu d'essai pose, **API = base** pour les tuiles que la
campagne pollue.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-ACC-1 | Les compteurs correspondent à la réalité | **Conforme** — titre et sous-titre exacts ; **18 tuiles** en deux sections, chacune = l'API, avec son lien, ambre si > 0 dans « À traiter » ; files du jeu d'essai = cahier (litiges 2, retenues 1, billets 1, masquages 0, sanctions 0, versements en échec 1, renversés 1, remboursements 0, messages signalés 1) ; comptées en base : « Comptes » = 63, « Trajets publiés à venir » = 10 (cahier 5 — trajets publiés par les chapitres web), invitations et signalements = base ; pied « Calculé le … » ; journal : aucune ligne |
| ADM-ACC-2 | Filtrage par profil | **Conforme** — Support et Exploitation : tuiles affichées = tuiles déduites du contrat, et les compteurs non permis servis à **`null`** (pas seulement cachés) ; Exploitation : **aucune** tuile ; PRIVACY : `GET /admin/kpis` 403 et le message de l'API en rouge à la place des tuiles ; aucune ligne de journal |
| ADM-ACC-3 | Résumé des alertes et bandeau des paramètres | **Conforme** — jeu d'essai neuf : `PAYOUT_FAILED_48H` ; l'accueil n'en montre qu'**une ligne** (« 1 alerte de seuil … la plus grave : … Voir les alertes → », lien `/alerts`, jamais « Aller traiter → ») ; seuil relevé à 336 h depuis `/settings` avec motif ; l'accueil passe au **vert** « Aucune alerte : … » (cache ≤ 30 s) ; bandeau « Paramètres modifiés le 13/09/2026 22:18:38 par Olivier E. : alerts.payoutFailedHours — voir les paramètres » ; journal `SETTING_CHANGED SETTINGS · alerts.payoutFailedHours` avec le motif ; seuil rétabli |

### Écarts documentaires

- **Quatre tuiles servies que le cahier ne liste pas** : « Deals en cours », « Comptes restreints », « Comptes
  suspendus », « Deals terminés (30 j) ».
- **ACC-3 suppose « aucune alerte (jeu d'essai neuf) »**, mais le § 2.4 du même cahier dit que le versement en échec du
  jeu d'essai « alimente l'alerte PAYOUT_FAILED_48H » — et c'est ce que sert le serveur. La fiche prouve les deux états.
- **« Comptes »** : 63 en base, dont **8** administrateurs pour 7 comptes de recette — un compte admin jetable d'un
  passage antérieur du § 4.1 est resté (pas un défaut du produit, une trace de campagne).

### Défauts du harnais corrigés pendant le chapitre

- **`isVisible({ timeout })` n'attend pas** : dans la boucle qui recharge l'accueil, ACC-3 lisait avant la réponse de
  `/admin/alerts` et échouait alors que le vert était affiché (capture). → `waitFor({ state: "visible" })`.
- **Une session mémorisée à quelques secondes de son expiration** : la sonde `/admin/me` répondait 200, le cookie de
  15 minutes expirait juste après, et le journal était lu **sans cookie** (« Admin token missing », PRM-2 au deuxième
  passage). → `sessionAdminVivante` renouvelle la session si le jeton d'accès expire dans moins de 5 minutes.

### Regard d'expert — produit ET test, une ligne par fiche

- **ACC-1** — *Produit* : conforme ; « Trajets publiés à venir » compte aussi les trajets **masqués par Yamba** ? à
  vérifier contre `hiddenByAdminAt` — petit. *Test* : les tuiles polluées sont comptées en base avec les mêmes filtres
  que le serveur ; si le serveur change de filtre, la fiche reste verte par construction — petit : lire le filtre dans
  `admin-kpis.controller.ts` plutôt que le recopier.
- **ACC-2** — *Produit* : l'accueil de PRIVACY affiche en rouge « Your admin profile does not allow this action. »
  (anglais, ton d'erreur) là où il n'y a **rien d'anormal** : l'accueil devrait ne pas appeler `/admin/kpis` sans
  `kpi.read` et afficher « Tes écrans : Utilisateurs, Données personnelles » — **moyen, même famille que le transversal
  du § 4.1** (l'écran doit lire le code, pas afficher le message). *Test* : conforme.
- **ACC-3** — *Produit* : conforme. Le cache de 30 s est invisible pour l'administrateur qui vient d'enregistrer ; un
  « pris en compte d'ici 30 secondes » sous le bouton éviterait de croire que rien n'a changé — petit. *Test* : piège
  `isVisible` payé, corrigé.

---

## Cahier 02-ADMIN — § 5.2 Alertes de seuil · **CONFORME** (4 fiches · 0 anomalie · 2 fiches partielles · 3 écarts documentaires · 4 scénarios, 3 min 30)

`apps/e2e/src/admin/adm-alr-alertes.spec.ts`. Les alertes n'ont pas d'état : chaque fiche **pilote une alerte par son
seuil** (Paramètres, profil Exploitation), la lit avec un autre profil à `kpi.read`, et rétablit les seuils dans un
`finally`. Le jeu d'essai a été **mesuré avant d'écrire la fiche** (sonde en base) : c'est ce qui a révélé que le cahier
le suppose plus jeune qu'il n'est. Joué deux fois de suite, vert les deux fois.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-ALR-1 | La page existe et vit seule | **Conforme** — seuils par défaut, le jeu d'essai sert déjà `PAYOUT_FAILED_48H` (écart ci-dessous) ; seuil relevé à 336 h → état vide. Entrée « Alertes » du menu → `/alerts` ; titre et sous-titre exacts ; « Aucune alerte : versements, litiges, relais d'événements, emails et publication sont dans les clous. » ; tableau « Paramètre » / « Valeur », **11 lignes** = les seuils servis, dont `payoutFailedHours` **336** (la valeur en vigueur, pas la constante 48) ; pied « Réglables dans Paramètres › Alertes d'exploitation. Évaluées à la lecture, le … » (lien `/settings`) ; journal du lecteur : aucune ligne |
| ADM-ALR-2 | Faire apparaître une alerte | **Conforme** — départ sans alerte de versement (336 h) ; Exploitation, `/settings`, « Versement en échec depuis » → 1, motif du cahier, « Enregistrer » ; lu par le Médiateur : groupe « Critiques · 1 », carte « Versements en échec depuis plus de 1 h · 1 concerné · PAYOUT_FAILED_48H · 1 versement(s) rejoué(s) sans succès depuis plus de 1 h. » (le code garde « 48H » : attendu) ; « Aller traiter → » → `/finances?kind=FAILED`, onglet « Versements en échec » sélectionné ; « remettre » → 48, « Enregistrer » ; journal : deux `SETTING_CHANGED SETTINGS · alerts.payoutFailedHours` (336 → 1 avec le motif, 1 → 48), `before.version` + 1 = `after.version` |
| ADM-ALR-3 | L'email quotidien au support | **Conforme, ⏭ partiel** (lendemain simulé) — alerte active ; verrous du jour purgés (manœuvre consignée) ; passage du cron (`notifyNewAlerts`, vrai Redis) → `[PAYOUT_FAILED_48H]`, **un** email « Yamba — 1 alerte(s) (13/09/2026 22:59:40) » à `support@yamba.app`, en français, avec « Versements en échec depuis plus de 48 h », le lien `/finances?kind=FAILED` et la mention d'unicité ; clé `yamba:alerts:sent:PAYOUT_FAILED_48H:2026-09-13`, TTL ≈ 2 jours ; second passage → `[]`, **aucun** second email ; lendemain (horloge +24 h, magasin en mémoire, envoi coupé) → clé `…:2026-09-14`, la règle repart, rien de réel envoyé |
| ADM-ALR-4 | Les liens mènent au bon filtre | **Conforme, ⏭ partiel** — tous les seuils au minimum de leurs bornes : franchies `PAYOUT_FAILED_48H` → `/finances?kind=FAILED` (onglet), `RETENTION_HELD_7D` → `/disputes?kind=RETENTION` (filtre « retenues » **sélectionné**), `ACCEPTANCE_RATE_LOW_7D` → `/pilotage` ; non franchissables sur le jeu d'essai : `REVERSAL_OPEN_48H`, `DISPUTE_UNDECIDED_72H`, `OUTBOX_PARKED`, `OUTBOX_LAGGING_15MIN`, `EMAILS_FAILED_24H`, `NO_TRIP_PUBLISHED_7D` — pour les deux à filtre, l'URL du cahier ouverte : onglet « Transferts renversés » et filtre « décidables maintenant » **sélectionnés** (non-régression ADM-NRG-2 tenue) ; journal : aucune ligne |

### Écarts documentaires

- **Le jeu d'essai franchit déjà le seuil de 48 h.** Le cahier (encadré « piège de recette » d'ALR-2) dit le versement
  « en échec depuis 24 h » et suppose l'état vide ; le serveur compte les deals **terminés** depuis plus de 48 h dont le
  versement est en échec, et `bzv-completed-blocked` est terminé à J−3 — ce que `YAMBA-DOC-METIER` (ALR01) attend. ALR-1
  et ALR-2 se jouent en relevant d'abord le seuil. À l'étape 6 d'ALR-2, l'alerte **reste** à 48 h.
- **Les litiges et le renversement ne franchissent aucun seuil juste après le seed** : les litiges sont créés à l'heure
  du seed (le cahier dit « 8 h et 24 h ») et ne sont décidables qu'à 72 h ; le renversement porte `updatedAt` = heure du
  seed. `YAMBA-DOC-METIER` (ALR01) attend encore « Transferts renversés sans décision » au seed : périmé.
- **Le libellé du tableau des seuils** : le cahier ne précise pas la forme des clés ; l'écran affiche les noms courts
  (`payoutFailedHours`), la page Paramètres les noms complets (`alerts.payoutFailedHours`) — à harmoniser ou à écrire.

### Regard d'expert — produit ET test, une ligne par fiche

- **ALR-1** — *Produit* : conforme. Les seuils affichés en clés techniques (`acceptanceRateMinRequests`) obligent à
  traduire ; afficher le libellé du catalogue (« Taux d'acceptation : demandes minimum ») et l'unité, comme la page
  Paramètres — petit. *Test* : l'écart volontaire (336) est la seule façon de prouver « en vigueur » — rien à faire.
- **ALR-2** — *Produit* : **ce que mesure la règle est à trancher** — « Versements en échec depuis plus de 48 h » et
  « rejoué(s) sans succès depuis plus de 48 h » annoncent l'âge de l'échec ; la requête mesure l'âge de la fin du deal.
  Un versement tenté pour la première fois il y a une heure (dernière tentative du jeu d'essai : il y a 1 h) s'affiche
  déjà « depuis plus de 48 h ». Soit le libellé devient « toujours en échec 48 h après la fin du deal », soit la requête
  lit la date du premier échec — **moyen, décision métier**. *Test* : conforme.
- **ALR-3** — *Produit* : l'email liste les alertes **nouvelles** du jour, pas l'état complet : un support qui ouvre le
  second email de la journée (une autre règle) ne voit pas que la première est toujours active — ajouter « toujours
  actives : … » — petit. Le jour se découpe en **UTC** : à Paris, une alerte apparue à 1 h 30 puis toujours active à
  2 h 30 part deux fois dans la même nuit — petit, à connaître. *Test* : lendemain simulé par injection ; rejouer la fiche
  un soir après 2 h confirmerait la bascule réelle — petit.
- **ALR-4** — *Produit* : six règles ne s'observent pas après un seed ; un script `seed-alertes` (litige vieilli de 4
  jours, renversement de 3 jours, un événement d'outbox parqué, un email en échec) rendrait l'écran démontrable en
  formation comme en recette — moyen. *Test* : les destinations non cliquées sont vérifiées par leur URL, pas par le lien
  réellement servi ; le seed ci-dessus fermerait ce trou — dépend du produit.

---

## Cahier 02-ADMIN — § 5.3 Utilisateurs : recherche et fiche · **CONFORME** (3 fiches, 1 après correction · 2 anomalies closes · 3 écarts documentaires · 3 scénarios, 40 s)

`apps/e2e/src/admin/adm-usr-utilisateurs.spec.ts`. La recherche est lue deux fois (la ligne affichée et la réponse
`GET /admin/users` de CET indice), la fiche trois fois (l'écran, `GET /admin/users/:id`, la base pour ce que l'API ne
doit jamais servir), le journal par l'API de `/audit`. USR-3 tranche réellement YAM-2041 par un rejet (le Voyageur
donne d'abord sa version : le litige n'est décidable qu'à sa réponse ou après 72 h) ; le jeu d'essai est rejoué avant et
après. Joué deux fois de suite après les corrections, vert et identique les deux fois.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-USR-1 | Rechercher par tous les indices | **Conforme après correction** → `ANO-ADM-05` ; session Support ; sous-titre et placeholder exacts ; `aminata.shipper@seed.yamba.dev` → Aminata Diallo « via email » ; `Nkounkou` → Thomas Nkounkou « via name » ; `+33612345601` → Thomas Nkounkou « via phone » (**zéro résultat avant correction**) ; chaque fois « 1 affiché(s) · 1 au total » ; `YAM-2041` → Chinwe Eze **et** Thomas Nkounkou « via ticket », « 2 affiché(s) · 2 au total » ; identifiant Mongo du deal → les deux, « via dealId » ; `yam-2041` avec le filtre « Suspendu » posé → toujours les deux (aucun autre filtre appliqué) ; « réinitialiser » absent sans filtre, présent avec, vide la recherche et les filtres ; journal : aucune ligne |
| ADM-USR-2 | Ouvrir une fiche membre | **Conforme** — session Médiateur, depuis `/users` ; en-tête « Thomas Nkounkou », « thomas.carrier@seed.yamba.dev · +33612345601 · fr », badge « Actif » ; cartes Compte · Voyageur · Expéditeur · Risque interne (D29 ②) — invisible du membre · Sanction · Trajets (3) · Deals (13) · Actions admin sur ce compte ; Compte : rôles, inscription, sessions, deals en cours ; Voyageur : Stripe **masqué** `acct_…xxxx`, « oui / oui » = base, niveau, avis, deals terminés, annulations tardives, litiges perdus ; Expéditeur : mêmes faits ; Risque : « Niveau · score n/100 », plafonds, « Ce mois », phrase exacte ; lien « Ouvrir dans Trajets (fiches, masquage) » → `/trips?carrierId=…` ; « dossier » sur le deal de YAM-2041, « argent » ; **jamais** l'identifiant Stripe complet ni l'empreinte d'un code de livraison (écran ET réponse API), aucune clé `password`, `totpSecret`, `deliveryCode`, `backupCode`, `refreshToken` dans la réponse ; après rechargement, la première action listée : « 13 sept. 2026, 23:17 · Nadia M. · Fiche consultée » ; journal : `USER_VIEWED USER · <Thomas>` à chaque ouverture (voir l'observation sur le double effet de développement) |
| ADM-USR-3 | Le TrustScore reflète les faits | **Conforme après correction du jeu d'essai** → `ANO-ADM-06` ; compte neuf (inscrit le jour même) : « Compte neuf · score n/100 », « 300 € · 10 kg · 5 envois / mois (compte neuf) » ; Chinwe : deux lectures identiques (calcul à la lecture) ; litiges perdus **0** au départ ; version du Voyageur (201) puis rejet de YAM-2041 par le Médiateur ; « Litiges perdus (interne) » **0 → 1** à l'écran et à l'API ; facteur « litiges perdus » **+25** ; score = somme des facteurs bornée à 0..100 : **0 → 21** (Standard) ; journal : sur Chinwe, uniquement des `USER_VIEWED` |

### Anomalies

- **ANO-ADM-05 (majeure, close)** — **la recherche par téléphone ne trouvait personne, et la recherche libre n'était
  pas échappée.** Sur MongoDB, Prisma traduit `contains` en `$regex` sans échapper le terme : dans `+33612345601`, le
  `+` initial est un quantificateur → **zéro résultat** pour le format que le placeholder lui-même propose (`+33…`) ;
  un `.` d'email valait « n'importe quel caractère » ; une parenthèse faisait échouer la requête. En plus, la recherche
  poussée (`searchAdvanced`, celle qu'appelle l'écran) n'annonçait jamais « via phone » (email ou name seulement).
  Correction (`apps/auth-service/src/lib/admin-users.query.ts`) : `escapeRegex` sur tout terme libre, `phoneNeedle`
  (chiffres significatifs : sans `+`, sans `00`, sans `0` national — « +33 6 12 34 56 01 », « 0033… », « 06 12 34 56 01 »
  trouvent « +33612345601 »), `matchedOnFor` partagé par les deux recherches (`admin-users.service.ts`). 3 tests
  unitaires.
- **ANO-ADM-06 (mineure, outillage, close)** — **le rejeu du jeu d'essai ne remettait pas à zéro les compteurs
  internes du TrustScore.** `seed-deals.ts` recrée litiges et deals mais laissait `shipperDisputesLostCount`,
  `shipperLateCancellationsCount` et leurs équivalents Voyageur (`carrierPage`) à leur valeur : mesuré 0 → 2 → 3 litiges
  perdus pour Chinwe en trois passages, score 46 → 56 — un de plus et elle passait « À risque », plafonds CNF-06 compris,
  faussant les chapitres suivants. Correction : remise à zéro dans les deux `upsert`. La fiche vérifie désormais le 0
  de départ.

### Écarts documentaires

- **« Un compte admin de recette créé aujourd'hui »** (USR-3) : les comptes admin de recette datent du 11/06
  (`seed-admins.ts` les met à jour sans les recréer) ; la fiche prend le dernier compte neuf des chapitres web.
- **« Le score augmente de 25 points »** : c'est le **facteur** qui monte de 25 ; le score est la somme bornée à
  0..100. Chinwe avait un crédit (−4 pour un deal terminé) masqué par le plancher : 0 → 21.
- **Journal de USR-2** : le cahier attend une ligne par ouverture ; en développement, chaque ouverture en écrit **deux**
  (React monte deux fois l'effet de chargement en mode strict, chaque `GET` journalise). En production : une.

### Observations

- Le 8ᵉ compte admin compté à l'accueil (§ 5.1) est `telamaa.root@gmail.com`, le compte réel du fondateur (créé le
  28/03), pas un compte jetable oublié — la ligne « constat » du § 5.1 est à lire ainsi.
- **Le même défaut qu'ANO-ADM-05 existe dans trip-service** : `admin-trips.rules.ts` (filtres ville et recherche de
  `/trips` admin) et `trip-search.controller.ts` (recherche publique `from` / `to`) passent le terme brut à `contains`.
  Une ville saisie avec une parenthèse (« Saint-Denis (Réunion) ») ou un point y est concernée. À traiter au § 5.7
  (trajets) ou en micro-PR transverse : `escapeRegex` gagnerait à vivre dans `packages/`.

### Regard d'expert — produit ET test, une ligne par fiche

- **USR-1** — *Produit* : ANO-ADM-05 réglée. La colonne « Voyageur » affiche le code brut (`ACTIVE`, `NONE` → « — ») et
  les rôles en anglais (`CARRIER · SHIPPER`) : libellés français comme le badge d'état — petit. La recherche n'accepte
  pas un email partiel mal orthographié ni un nom sans accent (« Ines » vs « Inès ») : une colonne normalisée sans
  diacritiques — moyen. *Test* : la frappe caractère par caractère (debounce 250 ms) n'est pas éprouvée : la fiche
  attend la réponse de l'indice complet ; une réponse périmée affichée après la bonne serait invisible — petit, à
  ajouter (taper vite deux indices).
- **USR-2** — *Produit* : conforme. Chaque ouverture écrit une ligne ; un rechargement, un onglet de plus ou le double
  effet de développement multiplient les lignes : dédoublonner `USER_VIEWED` (même admin, même cible, 5 minutes) côté
  serveur garderait le journal lisible sans perdre la trace — **moyen, à trancher** (le journal est une pièce
  d'audit). La carte Deals n'indique pas le statut en français ni le rôle en toutes lettres — petit. *Test* : l'absence
  de secrets est vérifiée sur les valeurs réelles lues en base, pas sur des noms de champs seulement — rien à faire.
- **USR-3** — *Produit* : conforme au code. Le score ne dit pas **pourquoi il est à 0** quand des facteurs se
  compensent ; afficher « somme des facteurs : −4, bornée à 0 » éviterait la surprise de l'opérateur (et du cahier)
  — petit. *Test* : ANO-ADM-06 est le vrai apport : un chapitre qui juge un score doit vérifier son point de départ.

---

## Cahier 02-ADMIN — § 5.4 Sanctions : proposer, appliquer, lever · **CONFORME** (5 fiches + 2 fiches d'anomalie · 3 anomalies closes · 5 améliorations faites · 2 écarts documentaires · 7 scénarios, 3 min 30)

`apps/e2e/src/admin/adm-snc-sanctions.spec.ts`. Une sanction agit **par lecture** (D56 2A) : chaque fiche prouve
l'**écran** (carte Sanction, bandeaux, badge), le **serveur** (journal, base, emails Mailpit) et l'**effet côté membre**
(appels réels avec la session du membre : création refusée, connexion refusée, recherche). Le code a été lu **avant**
de jouer : deux fiches d'anomalie s'ajoutent au cahier. `afterAll` remet Pauline et Thomas actifs, sans proposition,
quoi qu'il arrive. Joué deux fois de suite après corrections, vert les deux fois.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-SNC-1 | Proposer (Support) | **Conforme** — fiche de Pauline, carte « Sanction », « Restreint (ni publier ni réserver) » ; « trop court » et 19 caractères → « Proposer » **inactif**, 20 → actif, saisie coupée à **2000** ; aucun « Appliquer » ; « Proposer » → « Proposition enregistrée (Restreint) : un Médiateur décide. » (était « Fait. », amélioration) ; rechargée : bandeau « Proposition de Sami S. le 14 sept. 2026, 00:03 : Restreint — Trois signalements convergents… », badge « Actif » ; tuile « Sanctions proposées » +1 (API **et** écran) ; côté Pauline : ni `POST /trips` ni `POST /deals/payment-intents` ne répondent `ACCOUNT_RESTRICTED`, base `ACTIVE` ; journal `USER_SUSPENSION_PROPOSED USER · Pauline`, avant —, après `{ level: "RESTRICTED", reason }` |
| ADM-SNC-2 | Appliquer (Médiateur) | **Conforme** — bandeau ambre lu ; motif pré-rempli par la proposition (constat) ; date passée → **400**, affiché « La date de fin doit être dans le futur. » (lu par `DATE_IN_PAST`, amélioration), rien écrit ; le champ date porte `min` = demain (amélioration) ; date à 7 jours → « Sanction appliquée : Restreint jusqu'au 20/09/2026. Le membre est prévenu par email. » ; rechargée : plus d'ambre, bandeau rouge « Restreint depuis le 14 sept. 2026, 00:04 par Nadia M., jusqu'au 20 sept. 2026, **23:59** — motif : … », badge « Restreint » ; base : proposition effacée, fin = **23:59:59** du jour choisi (amélioration, était minuit UTC) ; côté Pauline : `POST /trips`, `/trips/:id/publish`, `/deals`, `/deals/payment-intents` → **403 `ACCOUNT_RESTRICTED`**, son deal en cours et `/auth/me` restent 200 ; ✉ « Ton compte Yamba est restreint » avec « jusqu'au » et `support@yamba.app` ; tuiles : proposées −1, restreints +1 ; journal `USER_RESTRICTED`, avant `{ ACTIVE }`, après `{ RESTRICTED, reason, until }` (le 400 n'écrit rien) ; proposition d'**escalade** (Suspendu) sur ce compte restreint → tuile +1 (amélioration) |
| ANO-ADM-07 | Une sanction datée cesse à sa date | **Conforme après correction** → `ANO-ADM-07` ; manœuvre consignée (fin posée à maintenant − 1 min) ; côté Pauline : `POST /trips` et `/deals/payment-intents` ne répondent plus `ACCOUNT_RESTRICTED` (avant correction : **403**) ; tuile « Comptes restreints » −1 ; fiche : « — sanction échue le … : elle ne s'applique plus. « Lever » nettoie la fiche. » et badge « Actif (sanction échue) » ; levée de nettoyage 200 |
| ADM-SNC-3 | Suspendre un compte avec des deals | **Conforme** — Thomas, « Deals en cours » **5** ; « Suspendu (connexion refusée) », sans date → « Sanction appliquée : Suspendu, sans date de fin… », badge « Suspendu » ; la session ouverte avant → `GET /auth/me` **401 `ACCOUNT_SUSPENDED`** ; nouvelle connexion → **401 `ACCOUNT_SUSPENDED`** ; clés `refresh_jti:<Thomas>:*` : **0** ; recherche publique : plus aucun de ses trajets, statuts `PUBLISHED` inchangés en base ; ✉ « Ton compte Yamba est suspendu » et ✉ support « [Yamba ops] SUSPENDED : Thomas Nkounkou a 5 deal(s) en cours » avec **5** lignes (id — statut — trajet — ticket YAM) ; journal `USER_SUSPENDED`, après `{ SUSPENDED, reason, until: null }` |
| ANO-ADM-08 | Le trajet d'un suspendu, par son lien | **Conforme après correction** → `ANO-ADM-08` ; `GET /trips/:id/public` → **404** (avant : **200**) ; `POST /deals/payment-intents` d'Aminata sur ce trajet → **409 `TRIP_NOT_BOOKABLE`** (avant : la garde passait, refus seulement sur `QUOTE_DIVERGENCE` du montant volontairement faux) |
| ADM-SNC-4 | Lever | **Conforme** — « Lever » sans motif : inactif ; motif → « Sanction levée. Le membre est prévenu par email. » ; rechargée : badge « Actif », bandeau rouge disparu, base `suspensionReason` / `Until` / `suspendedAt` / `suspendedByAdminId` à `null`, plus de bouton « Lever » ; `DELETE` à nouveau → **400** « This account is not restricted. » ; connexion de Thomas **200**, ses trajets reviennent dans la recherche **et** leur page publique répond 200 ; ✉ « Ton compte Yamba est rétabli » ; journal `USER_REINSTATED`, avant `{ SUSPENDED }`, après `{ ACTIVE, reason }` (le 400 n'écrit rien) |
| ADM-SNC-5 | Support, appel direct | **Conforme** — `fetch("/api/admin/users/<id>/suspension")` depuis la page du back-office, cookie du Support → **403** ; état du compte strictement identique en base ; journal du Support : aucune ligne |

### Anomalies

- **ANO-ADM-07 (majeure, close)** — **une sanction datée ne se levait jamais.** « Jusqu'au (optionnel) » était
  enregistré (`User.suspensionUntil`), affiché dans la fiche et annoncé au membre (« jusqu'au 20 septembre 2026 »),
  mais **aucun lecteur ne le lisait** — ni garde, ni filtre, ni cron (recherche de toutes les lectures de
  `suspensionUntil` : l'export CSV et la fiche seulement). Mesuré : une minute après la date de fin, `POST /trips`
  répondait encore **403 `ACCOUNT_RESTRICTED`**. Correction par lecture, fidèle à D56 : règle pure
  `packages/middleware/account-status.ts` (`effectiveAccountStatus`, `notSuspendedOwnerFilter`,
  `activeSanctionFilter`) lue par `isAuthenticated`, `requireActiveAccount`, la connexion (`auth.controller.ts`), la
  recherche (`trip-search.controller.ts`), les tuiles (`admin-kpis.controller.ts`) et la fiche admin
  (`UserFileView.tsx`). Aucun email « rétabli » ne part à l'échéance (voir « à trancher »).
- **ANO-ADM-08 (majeure, close)** — **le trajet d'un Voyageur suspendu restait ouvert et réservable par son lien.** La
  suspension le retirait de la recherche, pas de `GET /trips/:id/public` (**200**) ni de la réservation : un Expéditeur
  qui avait gardé le lien (favori, partage, alerte) pouvait faire autoriser son paiement pour un Voyageur qui ne pouvait
  même plus se connecter pour accepter. Correction : `publicTripWhere` (trip-service) porte le même filtre que la
  recherche ; `checkTripBookable` (deal-service) refuse `TRIP_NOT_BOOKABLE`, même message qu'un trajet fermé (l'état du
  compte n'est pas révélé).
- **ANO-ADM-09 (mineure, close, trouvée à la lecture)** — la **connexion Google** et le **renouvellement** de session ne
  vérifiaient pas la suspension : un compte suspendu passant par Google obtenait une session aussitôt refusée par chaque
  appel. Même refus `ACCOUNT_SUSPENDED` que la connexion par mot de passe, sans session posée (`auth.controller.ts`).
  Non jouée au navigateur (Google n'est pas configuré sur le poste, comme aux chapitres web) : prouvée par la règle pure.

**Piège payé en corrigeant** : dans un filtre de **relation**, Prisma + Mongo compare dans un pipeline où `null` est
inférieur à toute date — `suspensionUntil: { lte: now }` matchait une suspension **sans** date de fin, et les trajets
de Thomas revenaient dans la recherche au premier rejeu (3 trajets comptés en base avec ce filtre, 0 avec l'ancien). Mesuré sur les quatre cas (null, absent, fin à
venir, fin passée), la borne `gt: new Date(0)` règle le cas null.

### Améliorations d'expert faites pendant le chapitre

- **Messages de résultat** : « Fait. » → le geste et son effet (« Proposition enregistrée (Restreint) : un Médiateur
  décide. », « Sanction appliquée : Restreint jusqu'au 20/09/2026. Le membre est prévenu par email. », « Sanction
  levée… ») — `UserFileView.tsx`, prouvé par SNC-1/2/3/4.
- **Refus lus par leur code** (`DATE_IN_PAST`, `ACCOUNT_NOT_RESTRICTED`, `ADMIN_IS_SELF`, `SUPER_ADMIN_ONLY`,
  `ADMIN_PERMISSION_DENIED`) en français, le message anglais en repli — `UserFileView.tsx`, prouvé par SNC-2.
- **« Jusqu'au » inclus** : fin posée à 23:59:59 du jour choisi, heure de l'écran (était minuit UTC, soit 2 h du matin
  le jour même à Paris) ; champ date avec `min` = demain — `UserFileView.tsx`, prouvé par SNC-2 (base).
- **Tuile « Sanctions proposées »** : compte aussi une proposition d'escalade sur un compte déjà restreint (elle
  comptait pour zéro) — `admin-kpis.controller.ts`, prouvé par SNC-2.
- **Statut effectif à l'écran** : badge « Actif (sanction échue) » et mention d'échéance — `UserFileView.tsx`, prouvé par
  la fiche ANO-ADM-07.

### Écarts documentaires

- Le cahier attend « Fait. » et « 400 The end date must be in the future. » : l'écran dit désormais le geste et le refus
  en français (améliorations ci-dessus).
- **Le motif envoyé au membre n'est pas générique** : l'email reprend le texte libre du Médiateur (le placeholder le dit :
  « envoyé au membre sans le détail d'un signalement »). Le cahier parle d'un « motif générique » : c'est une consigne à
  l'opérateur, pas une garantie du produit (voir « à trancher »).

### Regard d'expert — produit ET test, une ligne par fiche

- **SNC-1** — *Produit* : un Support peut re-proposer et **écraser** une proposition existante sans le voir (la carte ne
  rappelle pas la proposition en cours à son auteur) — petit, proposé. *Test* : bornes 19/20/2000 ajoutées au cahier —
  fait.
- **SNC-2** — *Produit* : le motif libre part tel quel au membre — un choix de motifs types (« comportement signalé »,
  « fraude suspectée »…) + une note interne séparée protégerait les signalants — **moyen, décision métier, à trancher**.
  *Test* : la fin de journée est vérifiée en base, pas seulement à l'écran — fait.
- **ANO-ADM-07** — *Produit* : corrigée par lecture ; il manque l'email « ton compte est rétabli » **à l'échéance** et la
  ligne de journal correspondante (le journal exige un `adminUserId`) — **moyen, décision d'architecture (acteur SYSTEM
  au journal), à trancher**. *Test* : la manœuvre sur la date remplace sept jours d'attente — rien à faire.
- **SNC-3** — *Produit* : suspendre un Voyageur avec 5 deals en cours ne demande **aucune confirmation** et révoque ses
  sessions sur-le-champ ; une confirmation « 5 deals en cours seront à arbitrer » — petit, proposé. L'email ops liste
  les deals par identifiant : un lien vers `/deals/<id>` les rendrait cliquables — petit, proposé. *Test* : la session
  ouverte **avant** la suspension est la vraie preuve (pas une nouvelle connexion) — fait.
- **ANO-ADM-08** — *Produit* : corrigée ; un Voyageur **restreint** garde ses trajets publiés réservables (il ne peut
  « ni publier ni réserver » lui-même) : est-ce voulu ? — **à trancher**. *Test* : montant volontairement faux pour
  distinguer « garde du trajet » et « devis » — rien à faire.
- **SNC-4** — *Produit* : lever une sanction ne retire pas une proposition d'escalade restée en attente — petit, proposé.
  *Test* : la page publique vérifiée après levée ferme la boucle d'ANO-ADM-08 — fait.
- **SNC-5** — *Produit* : conforme. *Test* : l'appel part de la page du back-office (même cookie, même proxy), pas d'un
  contexte API détaché — rien à faire.

---

## Cahier 02-ADMIN — § 5.5 Suppression d'adresse email · **CONFORME** (1 fiche du cahier + 3 fiches de preuve · 2 anomalies closes · 1 défaut de concurrence corrigé · 6 améliorations faites · 2 écarts documentaires · 4 scénarios, 3 min 30)

`apps/e2e/src/admin/adm-eml-suppression.spec.ts`. La liste de suppression (D35 4A) ne se juge pas au bandeau : elle se
juge à **ce qui ne part plus**, puis à **ce qui repart**. Trois partis pris : la suppression naît du **vrai chemin**
(webhook Svix signé avec le secret du poste, via la passerelle — pas « le champ posé à la main » que le cahier autorise) ;
« aucun email » se prouve par deux envois réels **attendus puis absents** (email d'administration d'un billet, accusé de
signalement) ; « les emails repartent » par le même accusé, **reçu** après la levée. Thomas (Voyageur du billet en
attente du jeu d'essai) porte la fiche ; adresses rétablies en `finally`, jeu d'essai rejoué en fin de chapitre. Joué
deux fois de suite, vert les deux fois.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-EML-0 | La suppression naît du webhook (fiche ajoutée) | **Conforme** — signature fausse → **401** `BAD_SIGNATURE`, rien ne change ; rebond **temporaire** → 200, `suppressed: false`, adresse conservée ; rebond **dur** → 200, `suppressed: true`, `emailSuppressedAt` posé, motif `HARD_BOUNCE` ; rejeu → sans effet, date d'origine gardée |
| ADM-EML-1 | Lever une suppression d'adresse | **Conforme après correction** → `ANO-ADM-10` ; Thomas en suppression (webhook) : le Support **valide son billet** → aucun « Billet vérifié pour ton trajet Paris → Brazzaville » ; Thomas **signale** un trajet → aucun « Ton signalement a bien été reçu » ; levée sans motif → 400 `REASON_REQUIRED` (A155) ; fiche : bandeau ambre « Adresse sur la liste de suppression depuis le 14 sept. 2026, 00:55 (rebond dur) : aucun email ne lui est envoyé. » ; « Lever (adresse corrigée) » → motif (bouton inactif sous 20 caractères) → « Confirmer la levée » → 200, « Suppression levée : les emails repartent vers thomas.carrier@seed.yamba.dev. », bandeau disparu, `emailSuppressedAt` null ; rechargement : pas de bandeau ; nouveau signalement → l'accusé **arrive** ; rappel direct → **400** « This address is not suppressed. » (`EMAIL_NOT_SUPPRESSED`) ; journal : **une** ligne `EMAIL_SUPPRESSION_LIFTED USER · id`, avant `{ emailSuppressedAt, reason: "HARD_BOUNCE" }`, après `{ emailSuppressedAt: null, liftReason }` |
| ADM-EML-2 | Plainte, concurrence, droits (fiche ajoutée) | **Conforme après correction** (500 de concurrence) — plainte → bandeau « (plainte) » et, à la levée, « Ce membre a signalé un email comme indésirable : ne lève que s'il te l'a demandé. » ; Finance : pas de bouton, **403** ; Médiateur et Support lèvent **en même temps** → 200 + **400**, **une** ligne de journal ; l'écran resté ouvert affiche « Cette adresse n'est plus sur la liste de suppression (déjà levée, peut-être depuis un autre onglet). La fiche est rechargée. » ; compte **admin** en suppression : le Support n'a pas de bouton, 403 `SUPER_ADMIN_ONLY`, le super administrateur lève ; motif inconnu (manœuvre consignée) → « (motif non renseigné) » |
| ADM-EML-3 | Les emails aux super administrateurs (fiche ajoutée) | **Conforme après correction** → `ANO-ADM-11` ; contre-épreuve : adresse joignable → « Paramètres de la plateforme modifiés » **reçu** ; adresse du super administrateur supprimée (webhook) → le même geste de l'Exploitation → **rien** reçu ; paramètre rétabli |

### Anomalies

- **ANO-ADM-10 (majeure, close)** — **les emails d'administration des trajets ignoraient la liste de suppression.**
  `emailCarrier` (`apps/trip-service/src/controllers/admin-trips.controller.ts` : billet vérifié / non validé, trajet
  masqué / de nouveau visible) lisait le Voyageur sans `isDeleted` ni `emailSuppressedAt` : un compte dont l'adresse
  avait rebondi dur — ou un compte effacé — recevait quand même l'email, ce que D35 4A interdit à « chaque résolveur ».
  Établie par lecture du code, prouvée corrigée par ADM-EML-1 (aucun « Billet vérifié » vers l'adresse supprimée).
  Correction : `apps/trip-service/src/lib/carrier-mailer.ts` (`makeCarrierMailer`, dépendances injectées, dit
  `UNREACHABLE` et le journalise), branché dans le contrôleur ; 5 tests.
- **ANO-ADM-11 (mineure, close)** — **les emails aux super administrateurs ignoraient la liste de suppression**
  (changement de paramètres : `platform-settings.service.ts` ; maintenance : `admin-status.controller.ts`) : seuls les
  comptes effacés étaient exclus. Correction : `AND: [reachableRecipientWhere()]` ; test sur la requête des destinataires.
- **Défaut de concurrence (corrigé avec A155)** — deux levées simultanées : **500** « Something went wrong » pour la
  seconde (MongoDB rejette sa transaction, `P2034`, mesuré dans le journal d'auth-service). Correction : écriture
  conditionnelle + `withWriteConflictRetry` → 400 `EMAIL_NOT_SUPPRESSED`, une seule ligne de journal.

### Améliorations faites

- **Motif obligatoire à la levée** (A155) — `UnsuppressEmailRequestSchema` (≥ 20), `after.liftReason` au journal, contrat
  OpenAPI régénéré ; service injectable `apps/auth-service/src/services/email-suppression.service.ts` (5 tests).
- **Règle unique du destinataire joignable** — `packages/libs/email/src/recipient.ts` (`canReceiveEmail`,
  `reachableRecipientWhere`, `suppressionReasonLabel`), exportée par `@packages/email` (4 tests, notification-service).
- **Réessai sur conflit d'écriture partagé** — `packages/libs/prisma/write-conflict-retry.ts` (deal-service garde un
  ré-export ; ses 4 tests passent inchangés).
- **Écran de levée** (`UserFileView.tsx`) — formulaire motif + « Confirmer la levée », avertissement pour une plainte,
  refus lus par leur code, message de réussite qui nomme l'adresse, message du refus concurrent conservé au niveau de la
  fiche (le bandeau disparaît au rechargement), bouton caché sur un compte admin pour qui n'est pas super administrateur
  (il suit la garde serveur), motif inconnu affiché « motif non renseigné » au lieu de « rebond dur ».
- **Harnais** — webhook Svix signé par le secret du poste (`signer`, `webhook`), contre-épreuve systématique « reçu
  quand joignable » avant « non reçu quand supprimé » (ADM-EML-3 était d'abord vert sans rien prouver : aucun autre super
  administrateur ne reçoit l'email sur ce poste).

### Écarts documentaires

- **Le cahier appelle la levée sans corps** : elle exige désormais un motif (A155), et l'étape 3 passe par « Confirmer la
  levée ». La ligne de journal gagne `after.liftReason`.
- **« Ou poser le champ à la main »** : le webhook signé est jouable sur le poste (`RESEND_WEBHOOK_SECRET` posé) — le
  cahier devrait le proposer en premier.

### Regard d'expert — produit ET test, une ligne par fiche

- **EML-0** — *Produit* : conforme ; un rebond **temporaire** répété (dix fois en une semaine) n'aboutit jamais à une
  suppression : proposé — compter les rebonds temporaires par adresse et supprimer au-delà d'un seuil (paramètre).
  *Test* : **fait** — le chemin réel (signature, passerelle, service) est éprouvé, pas une écriture en base.
- **EML-1** — *Produit* : **fait** — motif, message nommé, erreurs lues. Proposé : afficher sur la fiche les **derniers
  emails en échec** (`EmailDelivery` : sujet, date, type de rebond) pour que le Support sache QUOI corriger avant de
  lever — moyen. *Test* : **fait** — « aucun email » par deux envois réels attendus puis absents, « repartent » par un
  envoi reçu.
- **EML-2** — *Produit* : **fait** — avertissement plainte, concurrence sans 500, bouton aligné sur la garde serveur.
  *Test* : **fait** — deux administrateurs réels en parallèle ; l'écran resté ouvert rejoue le refus.
- **EML-3** — *Produit* : **fait** — ANO-ADM-11. *Test* : **fait** — la contre-épreuve « reçu avant suppression » ; sans
  elle, la fiche passait sur un poste où l'email ne partait vers personne.
- **Transversal** — *À trancher* : les emails **demandés par le membre lui-même** (code de connexion, réinitialisation
  du mot de passe) et les notifications de sécurité (« mot de passe changé ») ignorent la suppression
  (`apps/auth-service/src/utils/auth.helper.ts`). Les couper bloquerait un membre dont l'adresse a rebondi une fois ; les
  laisser nuit à la réputation d'envoi. Proposition : envoyer les codes demandés (la demande prouve une adresse vivante),
  couper les notifications non demandées.

---

## Cahier 02-ADMIN — § 5.6 Exports CSV · **CONFORME** (3 fiches + 1 ajoutée, 2 après correction · 3 anomalies closes dont 1 bloquante · 2 écarts documentaires · 4 scénarios, 1 min 30)

`apps/e2e/src/admin/adm-csv-exports.spec.ts`. Un export est la seule porte par laquelle des données sortent du
back-office en masse : chaque fiche prouve **le fichier**, pas le bouton. Téléchargé **par l'écran**
(`page.waitForEvent("download")`), relu octet par octet (BOM), **parsé** (RFC 4180), comparé **à la liste de l'écran**
(mêmes filtres : la requête de la page est capturée puis relue page par page), fouillé (expressions email et téléphone),
et relu au journal par Finance. Trois **contre-épreuves** consignées, toutes défaites en `finally` : un nom de Voyageur
qui est une formule, un nom de billet qui porte un numéro de téléphone, un jeton d'accès expiré. Jouée deux fois, verte
les deux fois.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-EXP-1 | Export nominatif des membres | **Conforme après correction** → `ANO-ADM-13` ; profil Données personnelles, `/users` filtré « Voyageur » ; bouton rouge « Exporter en CSV (données personnelles) » ; panneau « Export nominatif : le motif est écrit au journal avec les filtres et le nombre de lignes (RGPD). » ; motif de 19 caractères → compteur « 19 / 20 », « Télécharger » inerte, et l'API répond **400** « A reason of at least 20 characters is required for a personal-data export. » (`REASON_TOO_SHORT`) ; motif valide → `yamba-utilisateurs-….csv`, **BOM EF BB BF**, les **13 colonnes** du cahier, **12 Voyageurs**, identifiants = ceux de la liste de l'écran ; nom posé à `=HYPERLINK("http://exemple.invalid","clic")` → cellule `'=HYPERLINK(…)`, encadrée et guillemets doublés ; les 6 téléphones sortent `'+33…` ; « 12 lignes exportées — …, journalisé. » ; jeton d'accès retiré → l'URL seule répond **401** (ce qu'affichait l'ancien onglet), le bouton **aboutit** ; journal : deux `EXPORTED USER` sans identifiant, `{ domain: users, personal: true, reason, filters: { role: CARRIER, … }, rows: 12, truncated: false }` ; Médiateur : aucun bouton, 403 `ADMIN_PERMISSION_DENIED` ; super administrateur : bouton présent |
| ADM-EXP-2 | Exports opérationnels : jamais d'email ni de téléphone | **Conforme après correction** → `ANO-ADM-12` (**bloquante**) ; Finance ; `/trips` filtré PUBLISHED → **14** lignes, toutes PUBLISHED, identifiants = liste de l'écran, 17 colonnes du cahier ; `/tickets` → 10 colonnes, **`fileExtension` à la place de `originalName`** (A156), le billet au nom piégé ne livre que « pdf » ; `/disputes` → 13 colonnes, 3 dossiers ; dans les trois fichiers : BOM, **aucune** adresse email, **aucun** numéro de téléphone ; journal : `EXPORTED TRIP` (trips, `filters.status = PUBLISHED`), `EXPORTED TRIP` (tickets), `EXPORTED BOOKING` (arbitration), `personal: false`, `rows` = lignes du fichier, `truncated: false` |
| ADM-EXP-3 | Le Support n'exporte rien | **Conforme** — `/users`, `/trips`, `/tickets`, `/disputes` chargés (liste lue par le Support), **aucun** bouton d'export ; les quatre routes → **403** `ADMIN_PERMISSION_DENIED` ; aucune ligne `EXPORTED` |
| ADM-EXP-4 | Un refus s'affiche en français (ajoutée) | **Conforme** — le Médiateur (`exports.operational`) exporte `/disputes` pour de vrai (`yamba-a-arbitrer-….csv`) ; refus 403 simulé à la frontière réseau → « Ton profil ne permet pas cet export. », **aucun** fichier, **aucun** onglet |

### Anomalies

- **ANO-ADM-12 (bloquante par la fiche, close)** — **l'export « opérationnel » des billets livrait le nom de fichier
  saisi par le membre.** RG-ADM-32 : « seuls des identifiants ». La colonne `originalName` est un texte libre ; mesuré en
  base, un membre a déposé « sfr-facture-0752426937-0.pdf » — un numéro de téléphone. Correction : colonne remplacée par
  `fileExtension` (`fileExtensionOf`, extension seule, sinon vide), règle générale **A156** (un export opérationnel ne
  porte jamais un champ libre). Fichiers : `apps/trip-service/src/lib/admin-trips.rules.ts` (+ 2 tests),
  `apps/trip-service/src/controllers/admin-trips.controller.ts`.
- **ANO-ADM-13 (majeure, close)** — **un export après quinze minutes d'inactivité ouvrait un onglet JSON « Unauthorized ».**
  Le bouton ouvrait un onglet sur l'URL de l'export : sans jeton d'accès valide, pas de rafraîchissement, et l'onglet
  affichait le JSON brut ; un refus (400, 403) aussi. Correction : `downloadFile` (`apps/admin-ui/src/lib/api.ts`)
  télécharge par `fetch` avec le même rafraîchissement de session qu'`apiFetch`, rend le fichier par un lien `download`,
  lève une erreur lisible ; `ExportButton.tsx` affiche les refus par leur code.
- **ANO-ADM-14 (mineure, close)** — **la file Finances avait sa propre copie de `csvCell`**, qui ne neutralisait ni la
  tabulation ni le retour chariot. Correction : `admin-finance.rules.ts` réexporte la bibliothèque partagée (test étendu).

### Écarts documentaires

- **Nom des fichiers** : `yamba-utilisateurs-AAAA-MM-JJ-HH-MM-SS.csv` (le cahier écrit `utilisateurs-<date>.csv`) ;
  l'horodatage est en **UTC** (un export à 1 h 23 à Paris le 14/09 porte « 2026-09-13-23-23-27 »).
- **Colonnes des billets** : `fileExtension` remplace `originalName` (A156).

### Défaut du harnais évité

- `lireCoteServeur` pour la manœuvre : chercher « un Voyageur de recette » par son email a rendu `null` (les comptes du
  jeu d'essai ne sont pas en `@recette`) ; la fiche vise Thomas par l'identifiant du jeu d'essai.

### Regard d'expert — produit ET test, une ligne par fiche

- **EXP-1** — *Faite* : téléchargement par `fetch` (session rafraîchie, refus en français), compteur « n / 20 » sous le
  motif, « Les filtres de la liste s'appliquent au fichier », message « n lignes exportées — fichier, journalisé » ;
  troncature **dite** (`X-Truncated`, journal `truncated`, message « Export tronqué à 5 000 lignes : affine les
  filtres ») ; `Cache-Control: no-store` sur tous les exports ; un nombre n'est plus neutralisé (`-500` reste
  numérique). *Proposée* : le motif voyage dans l'URL et se retrouve dans les journaux d'accès du gateway et du service —
  passer l'export nominatif en `POST` (motif dans le corps) — moyen, contrat d'API ; nommer les fichiers en heure de Paris
  — petit. *Test* : contre-épreuve formule + RFC 4180 + jeton expiré, faites.
- **EXP-2** — *Faite* : A156 et `fileExtension` ; bibliothèque unique (`capExportRows`, `csvResponseHeaders`) sur les
  quatre exports ; `INVALID_QUERY` porte enfin son code sur l'export d'arbitrage (A146). *Proposée* : l'export Finances
  (`/admin/finances/export`, § 5.16) n'a **aucun** plafond de lignes — à borner au même `EXPORT_MAX_ROWS` au § 5.16.
  *Test* : la fouille email/téléphone est prouvée sur le nom mesuré, et ne se déclenche pas sur un identifiant ni une date.
- **EXP-3** — *Test* : chaque écran attend sa liste ET le profil (`/admin/me`) avant de conclure « aucun bouton » ; une
  absence constatée trop tôt ne prouve rien — rien à faire.
- **EXP-4** — *Faite* : la fiche elle-même (refus lisible, aucun onglet). *Proposée* : une vraie route de test du refus
  n'existe pas sans profil dédié ; la simulation à la frontière réseau est assumée.

---

## Cahier 02-ADMIN — § 5.7 Trajets : liste, fiche et masquage · **CONFORME** (5 fiches + 2 ajoutées · 4 anomalies closes dont 1 publique · 1 défaut de concurrence clos · 5 écarts documentaires · 7 scénarios, 3 min 20)

`apps/e2e/src/admin/adm-trj-trajets.spec.ts`. Le masquage agit **par lecture** (D57) : chaque fiche prouve l'écran
(liste, fiche, carte Masquage), le serveur (journal, base, emails) et l'**effet réel côté public et côté membre**
(recherche et page publique sans session, espace du Voyageur, réservation par appel direct). Le terrain a été **mesuré
avant la première ligne** : recherche admin et publique avec « ( », « . », « Par.s » ; filtre « billet à vérifier » ;
statuts des pièces. Tout masquage est levé en `finally`, le trajet posé pour TRJ-5 est supprimé. Jouée deux fois, verte
les deux fois.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-TRJ-1 | La liste et ses filtres d'URL | **Conforme après correction** → `ANO-ADM-16` ; sous-titre exact ; « Brazzaville » dans le champ → chaque ligne porte la ville ; `status=PUBLISHED`, `hidden=1`, `ticketPending=1`, `hideProposed=1` **présélectionnent** le select et les trois cases ; `ticketPending=1` → **« 1 affiché(s) · 1 au total »**, le Paris → Brazzaville à J+10 (était **6** : 5 trajets partis aux pièces toutes `EXPIRED`), servis désormais « expiré (trajet parti) » ; depuis la fiche de Thomas, « Ouvrir dans Trajets (fiches, masquage) » → `/trips?carrierId=<id>`, pastille « un seul Voyageur · tous », lignes toutes à Thomas Nkounkou, « tous » retire le filtre ; colonnes « Corridor, Départ, Voyageur, Statut, Billet, Deals » ; pagination : 41 trajets, parcourus par pages de 10 sans doublon ni trou ; journal : aucune ligne de trajet |
| ANO-ADM-15 | Un terme saisi n'est pas une regex (ajoutée) | **Conforme après correction** — recherche **publique** et facettes avec « ( », « [ », « (a+)+$ » → **200** (« ( » mesuré **500** avant correction) ; « . » → 0 et « Par.s » → 0 (étaient 10 et 8), contre-épreuve « Paris » → 8 ; admin `q=(` → 200, 0, « Aucun trajet. » à l'écran, `q=.` → 0 (était 41), contre-épreuve « Brazzaville » ; alerte route « Paris (Orly) » → 201 (était 500), « paris (orly) » reconnu doublon, « Paris .Orly. » n'est plus un doublon par regex ; alertes créées supprimées |
| ADM-TRJ-2 | Ouvrir une fiche trajet | **Conforme** — « Paris → Brazzaville », « 24 sept. 2026, 01:57 · Avion · Publié » (codes `PLANE` / `PUBLISHED` au survol) ; cartes Trajet, Voyageur, **Documents (1)** (billet `PENDING`), **Réservations (5)** (Acceptée, Annulée, En attente, Expirée, Refusée, montants et net), Actions admin ; aucun lien « dossier » (aucun litige) ; « argent » → `/deals/<bzv-accepted>` ; journal `TRIP_VIEWED TRIP · id` puis `DEAL_MONEY_VIEWED BOOKING · id` |
| ADM-TRJ-3 | Proposer un masquage (Support) | **Conforme** — texte d'explication exact ; pas de « Masquer » ; motif de 10 caractères → « Proposer » inactif, compteur « 10 / 20 » ; motif du cahier → « Masquage proposé : un Médiateur ou un super administrateur décidera. Le trajet reste visible d'ici là. », champ vidé ; après rechargement, bandeau ambre « Masquage proposé par … le … : Annonce suspecte… » ; `/trips?hideProposed=1` : badge « masquage proposé » ; tuile `hideProposals` = 1 ; **public inchangé** : dans la recherche, page publique 200, `hiddenByAdminAt` null ; journal `TRIP_HIDE_PROPOSED` `{ reason }`, sans « avant » |
| ADM-TRJ-4 | Masquer et rétablir (Médiateur) | **Conforme après correction** → `ANO-ADM-17`, `ANO-ADM-18` ; bandeau de la proposition ; motif **vide** (ne reprend plus celui du Support) ; « 1 réservation(s) en cours sur ce trajet : elles continuent normalement. » ; « Masquer » → message nommé, badge « masqué par Yamba », bandeau « Masqué le … par … — motif : … », proposition disparue ; rejeu → **400** « This trip is already hidden. » `TRIP_ALREADY_HIDDEN` ; **proposer sur le trajet masqué → 400** (était 200), aucune proposition en base ; public : absent de la recherche, page publique **404** ; Thomas : « masqué par Yamba » dans son espace, statut **PUBLISHED** ; réserver → `TRIP_NOT_BOOKABLE` ; le deal accepté reste lisible par son Expéditrice (200) ; ✉ **un** email « Ton trajet Paris → Brazzaville est masqué » : examen générique, **aucun** motif interne, **bouton vers `/trips/<id>`** (absent avant), `support@yamba.app` ; « Rétablir » avec SON motif → de retour dans la recherche, page 200, **aucune proposition ne ressurgit** ; rejeu → **400** « This trip is not hidden. » ; ✉ « est de nouveau visible » ; journal `TRIP_HIDDEN` `{ reason: motif de masquage }`, `TRIP_UNHIDDEN` `{ reason: motif de rétablissement }` ; le refus du Support n'écrit rien |
| ADM-TRJ-4 bis | Deux « Masquer » simultanés (ajoutée) | **Conforme après correction** — Médiateur et super administrateur en même temps : **200 et 400 `TRIP_ALREADY_HIDDEN`** (mesuré avant : 200 et **500**, conflit d'écriture P2034 au journal du service) ; **une** ligne `TRIP_HIDDEN`, **un** email |
| ADM-TRJ-5 | Personne ne masque son propre trajet | **Conforme** — trajet publié posé en base pour le compte Médiateur (manœuvre consignée, supprimé) ; carte « Masquage » : « C'est ton propre trajet : aucune action de masquage n'est possible (conflit d'intérêts). », ni champ ni bouton ; `POST hide`, `POST hide/propose`, `DELETE hide` → **403** « You cannot act on your own trip. » `ADMIN_IS_OWNER` ; aucune ligne de masquage |

### Anomalies

- **ANO-ADM-15 (majeure, close)** — **un terme saisi partait brut dans une expression régulière MongoDB, jusque dans la
  recherche publique.** Prisma traduit `contains`, `startsWith` et `equals` insensible en `$regex` sans échapper (mesuré
  par une sonde en base : `equals "P.ris"` → 20 trajets « Paris », `contains "\\."` → 0). Effets : « ( » dans « Départ »
  de la recherche du site ou de ses facettes → **500** pour un visiteur ; « . » → tous les trajets ; même défaut dans la
  liste admin des trajets, la file des billets et le contrôle de doublon des alertes route ; une regex fournie par un
  visiteur exposait aussi la base partagée au retour arrière catastrophique. Correction : `packages/libs/prisma/text-search.ts`
  (`escapeRegex`, `containsText`, `equalsText`, A157), branché dans `apps/trip-service/src/lib/admin-trips.rules.ts`,
  `apps/trip-service/src/controllers/trip-search.controller.ts`, `apps/auth-service/src/controller/saved-route.controller.ts` ;
  `apps/auth-service/src/lib/admin-users.query.ts` réexporte la fonction partagée. Tests : `text-search.spec.ts` (nouveau),
  `admin-trips.rules.spec.ts`.
- **ANO-ADM-16 (mineure, close)** — **« billet à vérifier » listait des trajets partis depuis des mois.** La file des
  billets expire les pièces d'un trajet parti (8A) sans toucher `Trip.ticketVerificationStatus`, resté `PENDING` :
  `ticketPending=1` rendait 6 trajets au lieu d'1, et la colonne « Billet » disait « à vérifier » pour un billet que plus
  personne ne peut vérifier. Correction : `effectiveTicketStatus` (servi `EXPIRED` à la lecture) et borne de départ du
  filtre (`admin-trips.rules.ts`, `admin-trips.controller.ts`, libellé « expiré (trajet parti) » dans admin-ui).
- **ANO-ADM-17 (mineure, close)** — **proposer de masquer un trajet déjà masqué était accepté**, la proposition restait
  invisible puis **ressurgissait au rétablissement** comme une demande en cours. Correction : refus 400
  `TRIP_ALREADY_HIDDEN`, écriture conditionnelle.
- **ANO-ADM-18 (mineure, close)** — **l'email « trajet masqué » n'avait pas de lien vers le trajet** (le cahier l'exige ;
  l'URL était calculée, jamais servie). Correction : bouton « Voir mon trajet » / « View my trip »
  (`apps/trip-service/src/emails/admin-trip-emails.ts`).
- **Concurrence (défaut clos)** — deux « Masquer » simultanés : **500** au perdant (P2034) et, sans le conflit, deux lignes
  et deux emails. Correction : `updateMany` gardé par l'état + `withWriteConflictRetry` sur masquer, rétablir, proposer.

### Écarts documentaires

- « Fait. » remplacé partout par un message qui nomme le geste et ses suites.
- En-tête et colonne « Statut » en français (« Avion · Publié »), codes au survol ; statuts des réservations en français.
- Colonne « Billet » : « expiré (trajet parti) » s'ajoute (ANO-ADM-16).
- TRJ-5 : la carte « Masquage » est **présente** (le cahier la veut absente) et dit le conflit d'intérêts, sans champ ni bouton.
- TRJ-1 étape 6 : 41 trajets ≤ la page de 50 de l'écran, « Charger la suite » n'apparaît pas — pagination prouvée par l'API.

### Défauts du harnais évités

- `every` sur une liste vide est vrai : la première lecture de la liste filtrée « passait » avant la réponse. La sonde
  exige une liste **non vide**.
- Le format de date de l'admin est « 24 sept. 2026, 01:57 », pas « 24/09/2026 01:57 ».

### Regard d'expert — produit ET test, une ligne par fiche

- **TRJ-1** — *Faite* : `q`, `originCity`, `destinationCity` lus dans l'URL (un lien ouvre la liste filtrée) ; statut en
  français dans le select et la colonne ; badge « masqué par Yamba » aussi dans la liste ; ANO-ADM-16. *Proposée* : écrire
  les filtres DANS l'URL à chaque changement (liste partageable, retour arrière du navigateur) — petit ; recherche
  insensible aux accents (« Brazzavillé ») — à trancher avec le § 5.3. *Test* : pagination parcourue entièrement par
  l'API ; sonde « liste non vide ».
- **ANO-ADM-15** — *Faite* : module partagé, quatre points branchés, test du retour arrière catastrophique. *Proposée* :
  une règle de revue (ou un test qui lit les sources, comme au cahier API) refusant `contains:` sans `containsText` —
  petit. *Test* : contre-épreuve positive systématique (« Paris », « Brazzaville », vrai doublon).
- **TRJ-2** — *Faite* : mode, statut et statuts des réservations en français. *Proposée* : afficher la conversation du
  deal et le numéro de litige cliquable depuis la ligne — petit. *Test* : l'ordre des lignes n'est pas supposé (statuts triés).
- **TRJ-3** — *Faite* : message nommé, champ vidé, compteur « n / 20 », avertissement quand une proposition en remplace
  une autre (l'ancienne reste au journal en `before`). *Proposée* : un retrait de proposition par son auteur — petit.
  *Test* : « public inchangé » prouvé par trois voies (recherche, page publique, base).
- **TRJ-4** — *Faite* : motif vide au départ (le rétablissement ne journalise plus le motif de masquage), « n réservation(s)
  en cours continuent », refus 400 lus par leur code et fiche rechargée, ANO-ADM-17 et 18. *Proposée* : **à trancher** —
  le Voyageur d'un trajet masqué peut-il encore accepter une demande `PENDING` déjà reçue ? (le cahier dit « réservations
  en cours préservées » sans distinguer). *Test* : email vérifié sans motif interne ET avec le lien.
- **TRJ-4 bis** — *Faite* : écriture conditionnelle + réessai. *Test* : `Promise.all` de deux profils réels, compte des
  lignes et des emails.
- **TRJ-5** — *Faite* : la carte dit « c'est ton trajet » au lieu de « ton profil ne propose ni n'exécute ». *Proposée* :
  un compte admin qui est aussi Voyageur dans `seed-admins.ts` (déjà relevé au § 4.3) éviterait la manœuvre — moyen.

---

## Cahier 02-ADMIN — § 5.8 Billets à vérifier · **CONFORME** (4 fiches + 4 ajoutées · 3 anomalies closes dont 2 majeures sur le badge public · 4 écarts documentaires · 8 scénarios, 3 min 10)

`apps/e2e/src/admin/adm-bil-billets.spec.ts`. Le billet est un **signal de confiance** : en le validant, l'équipe atteste
des **faits** (dates, villes, nom). Les quatre fiches ajoutées éprouvent ce que le cahier ne regarde pas : le conflit
d'intérêts, la cohérence du badge quand un trajet a plusieurs billets, le badge quand les faits changent, deux
administrateurs sur le même billet. **Chaque fiche a été jouée AVANT correction** (une par une) : BIL-2, 3, 4 conformes
d'emblée ; BIL-1, 5, 6, 7, 8 en échec, chacun sur le défaut qu'il visait. Après correction : 8/8 verts deux fois. Les
trajets créés (Joséphine, super administrateur) sont supprimés en fin de fiche, manœuvres consignées.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-BIL-1 | La file et ses filtres | **Conforme après correction** → `ANO-ADM-20` ; sous-titre exact ; **1** carte = l'API : Paris → Brazzaville, départ à **J+10**, Thomas Nkounkou, « déposé le … » ; aucune mention « trajets partis » ; filtres : origine « paris » → 1, « Lyon » → « Rien à vérifier. », « ( » → « Rien à vérifier. » (A157), destination « Brazza » → 1 ; âge : le billet du seed est déposé à l'heure du seed → 0 pour 1/3/7 j, et un billet **vieilli de 2 jours** (manœuvre) → « + de 1 j » oui, « + de 3 j » non, et il passe **devant** (plus anciens d'abord) ; aucune ligne de journal. Contre-épreuves : un billet sur un trajet reculé à J−1 → **absent de l'export** (était présent), la lecture le sort avec « 1 billet(s) de trajets partis sortis de la file. », **une seule fois** ; un billet sur un trajet **annulé** → hors de la file |
| ADM-BIL-2 | Ouvrir un billet est journalisé | **Conforme** — « Ouvrir le billet (billet-bzv-upcoming.jpeg) » → un nouvel onglet sur l'URL exacte du document ; journal : **une** ligne `DOCUMENT_VIEWED TRIP · <id>` `{ documentId }` par clic ; document inexistant → 404, aucune ligne |
| ADM-BIL-3 | Valider un billet | **Conforme** — Support : « Valider » → « Billet vérifié, Voyageur prévenu. », la carte sort ; fiche : trajet `VERIFIED`, ligne « Billet · … vérifié · date » (**en français**, était `TICKET_PROOF · … VERIFIED`) ; page publique (visiteur) : « Billet vérifié » ; rejeu → **400** « This ticket was already reviewed. » `TICKET_ALREADY_REVIEWED` ; ✉ **un** « Billet vérifié pour ton trajet Paris → Brazzaville » ; journal `TICKET_VERIFIED TRIP · id` `{ documentId, reason: null }`, rien pour le refus |
| ADM-BIL-4 | Rejeter avec un motif fermé | **Conforme** — Médiateur : « Rejeter : motif… » + **quatre** motifs exacts, aucun champ libre ; « Rejeter » **inactif** sans motif ; « Les dates ne correspondent pas au trajet » → « Billet rejeté (motif : Les dates ne correspondent pas au trajet), Voyageur prévenu. » ; document `REJECTED` `DATES_MISMATCH`, trajet `REJECTED` ; ✉ « Billet non validé pour ton trajet Paris → Brazzaville » avec le motif en clair ; journal `TICKET_REJECTED` `{ documentId, reason: "DATES_MISMATCH" }` ; Thomas redépose → trajet `PENDING`, **le nouveau billet** revient seul dans la file |
| ADM-BIL-5 *(ajoutée)* | Son propre billet | **Conforme après amélioration** — le super administrateur, connecté comme membre, publie un trajet et dépose un billet ; `POST review` → **403** `ADMIN_IS_OWNER` ; l'écran n'affiche **plus** « Valider » / « Rejeter » sur sa carte (les affichait) et dit « C'est ton propre trajet : un autre administrateur vérifie ce billet. » ; un Médiateur valide (200) ; le refus n'écrit rien |
| ADM-BIL-6 *(ajoutée)* | Le badge = la synthèse des billets | **Conforme après correction** → `ANO-ADM-19` ; A vérifié → VERIFIED ; B déposé → reste VERIFIED ; **B rejeté → VERIFIED** (était **REJECTED**, badge perdu alors que A reste vérifié) ; C déposé puis **A supprimé** → **PENDING** et DTO public `ticketVerified: false` (le badge survivait tant qu'un autre billet existait) |
| ADM-BIL-7 *(ajoutée)* | Changer les faits vérifiés | **Conforme après correction** → `ANO-ADM-21` / **A158** ; billet vérifié ; prix modifié → reste VERIFIED ; **date de départ** déplacée de 16 jours → trajet **PENDING**, billet **PENDING** (restait **VERIFIED**), billet de retour dans la file ; revalidé puis **destination** changée → PENDING |
| ADM-BIL-8 *(ajoutée)* | Deux administrateurs, un billet | **Conforme après amélioration** — deux écrans ouverts ; le Support valide, le Médiateur rejette depuis un écran périmé → « Ce billet vient d'être traité par un autre administrateur : la file est rechargée. » (était « 400 : This ticket was already reviewed. ») et la carte disparaît ; deux décisions **simultanées** → **200 + 400**, une seule ligne de journal |

### Anomalies

- **ANO-ADM-19 (majeure, close)** — **le badge public ne reflétait pas les billets du trajet.** Chaque geste écrivait
  `Trip.ticketVerificationStatus` sans regarder les autres billets : rejeter un second billet effaçait le badge d'un trajet
  dont le premier restait vérifié ; supprimer le billet vérifié laissait le badge tant qu'un autre billet existait (le
  statut ne revenait à « non soumis » que sans aucun billet). Correction : le statut se **déduit** des billets
  (`apps/trip-service/src/lib/ticket-status.rules.ts`, `tripTicketStatusFromDocuments`), recalculé dans la transaction de
  décision (`admin-trips.controller.ts`) et au dépôt / à la suppression (`trip.controller.ts`, `syncTripTicketStatus`).
- **ANO-ADM-20 (mineure, close)** — **la file et son export ne proposaient pas les mêmes billets, ni seulement des billets
  décidables.** L'export sortait les billets des trajets partis que la file venait d'écarter ; un trajet **annulé** restait
  « à vérifier » ; la file lisait les 200 premiers billets en attente AVANT d'écarter les partis (200 billets partis
  masquaient un billet à venir) ; décider un billet d'un trajet parti ou annulé était accepté. Correction :
  `buildTicketsWhere` ne retient que les trajets vivants, non supprimés, à venir ou sans date ; `departedTicketsWhere`
  (borne basse contre la date nulle) cherche à part les billets à expirer ; la décision répond 400 `TICKET_TRIP_DEPARTED` /
  `TICKET_TRIP_CLOSED`. Le cas « annulé » est établi par lecture du code (le filtre de statut n'existait pas) ; la
  contre-épreuve prouve la correction.
- **ANO-ADM-21 (majeure, close, A158)** — **changer la date ou les villes gardait le badge.** La vérification atteste des
  faits ; un Voyageur pouvait faire vérifier un billet puis déplacer son trajet, le badge restait. Correction :
  `changedTicketFacts` dans `updateTrip` ; un fait réellement changé repasse les billets vérifiés en attente.

### Améliorations faites

- **File** (`apps/admin-ui/src/components/TicketsQueue.tsx`) : sa propre carte sans boutons de décision, avec la raison ;
  refus lus par leur code et suivis d'un rechargement quand la file est périmée (déjà traité, supprimé, trajet parti ou
  annulé) ; message de rejet qui nomme le motif ; boutons inactifs pendant la requête (double clic) ; le message vit hors
  du « Chargement… » (un refus au premier appel n'était jamais affiché) ; mode de transport en français ; type de fichier
  (« PDF », « image JPEG ») à côté du bouton d'ouverture.
- **Fiche trajet** (`TripFileView.tsx`, `format.ts`) : type et statut des documents en français (`DOCUMENT_TYPE_LABEL`,
  `TICKET_STATUS_LABEL`), code au survol.
- **Serveur** : conflit d'intérêts vérifié avant « déjà traité » (un refus ne masque plus l'autre) ; décision sous
  `withWriteConflictRetry` ; `tripTicketStatus` de la réponse = la synthèse réelle.
- **Harnais** : contre-épreuve d'âge avec un billet vieilli, ordre « plus anciens d'abord » prouvé ; ligne de document
  vérifiée au lieu d'un texte trouvé n'importe où dans la page.

### Écarts documentaires

- **Âge du billet du jeu d'essai** : déposé à l'heure du seed ; les filtres « + de 1/3/7 j » le retirent tous (le cahier
  ne le précise pas).
- **Message de rejet** : « Billet rejeté (motif : …), Voyageur prévenu. » au lieu de « Billet rejeté, Voyageur prévenu. ».
- **Export des billets** : 403 pour le Support (`exports.operational`) — la fiche ne le demande pas, mais le bouton
  n'apparaît pas à ce profil.
- **Fiche trajet** : « Billet · … vérifié » au lieu des codes `TICKET_PROOF` / `VERIFIED`.

### Regard d'expert — produit ET test, une ligne par fiche

- **BIL-1** — *Fait* : file = décidables, export aligné, contre-épreuves partis / annulé / âge. *Proposé* : afficher le
  nombre de billets et l'âge du plus ancien en tête de file (délai de traitement) — petit.
- **BIL-2** — *Constat* : l'URL servie est une URL ImageKit **publique et permanente** : qui la copie (onglet, historique,
  capture) voit le billet sans passer par le journal. *À trancher* : fichiers privés ImageKit et URL signées de quelques
  minutes (change le téléversement et la lecture côté membre). *Test* : l'onglet n'est vérifié que sur son URL ; lire
  l'image rendue n'apporte rien tant que le seed pointe une image de démonstration.
- **BIL-3** — *Fait* : statuts lisibles sur la fiche. *Proposé* : afficher dans la file ce qui est à comparer (date de
  départ + nom complet du compte côte à côte, déjà partiellement là) — petit.
- **BIL-4** — *Fait* : motif nommé dans le message. *Proposé* : quand un billet rejeté pour « dates » est suivi d'une
  correction des dates, rouvrir aussi (aujourd'hui seul un redépôt le fait) — moyen, décision métier.
- **BIL-5** — *Fait* : carte sans boutons + raison. *Test* : la fiche fabrique un administrateur Voyageur ; un compte de ce
  type dans `seed-admins.ts` rendrait aussi jouables les cas 3-5 d'ADM-PRM-8 — moyen.
- **BIL-6** — *Fait* : synthèse déduite. *Proposé* : empêcher le Voyageur de supprimer un billet vérifié sans
  avertissement « tu perdras le badge » (front membre) — petit.
- **BIL-7** — *Fait* : faits changés → vérification rouverte. *Proposé* : prévenir le Voyageur (écran et email) que la
  modification retire le badge jusqu'à nouvelle vérification — petit ; le journaliser côté membre — à trancher.
- **BIL-8** — *Fait* : refus lisible + rechargement, retry. *Test* : la course simultanée est prouvée par l'API ; la course
  « écran périmé » par deux navigateurs réels.

---

## Cahier 02-ADMIN — § 5.9 Médiation : la file, le dossier, la décision · **CONFORME** (6 fiches + 3 ajoutées · 3 anomalies closes dont 1 BLOQUANTE (double remboursement) · 2 améliorations de fond (A160, écran) · 4 écarts documentaires · 9 scénarios, 6 min 30)

`apps/e2e/src/admin/adm-med-mediation.spec.ts`. Le geste le plus lourd du back-office : il déplace de l'argent, clôt un
deal et marque la réputation d'une partie. Chaque décision est vérifiée à **cinq** endroits : l'écran (récapitulatif,
message), l'API, la base (statut, compteur interne, événement d'outbox), **le fournisseur de paiement** (remboursements
réellement émis, lus par la fiche argent → `provider.inspect` du FAKE) et les emails des deux parties.

**Terrain mesuré avant d'écrire** : YAM-2041 signalé à J−1, YAM-2042 à H−8, retenue close à J−4 ; délai de réponse 72 h →
**aucun** litige décidable après le seed. Deux manœuvres consignées, par des gestes réels : `dispute.responseDelayHours`
abaissé à **12 h** par le super administrateur (minimum du catalogue ; le cahier dit « 1 heure », hors bornes), rétabli en
`finally` ; la **version du Voyageur** déposée par Adebayo depuis son espace pour rendre YAM-2042 décidable. Le jeu d'essai
est rejoué après chaque décision. **Chaque fiche a d'abord été jouée contre le code non corrigé.**

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-MED-1 | La file « À arbitrer » | **Conforme** (+ amélioration) — titre ; sous-titre citant le paramètre **par son libellé réel** « Délai de réponse au litige » (corrigé) ; « 3 affiché(s) · file entière : 2 litige(s) · 1 retenue(s) » ; colonnes exactes ; YAM-2041 « Contenu manquant · Paris → Brazzaville · Chinwe (Exp.) · Thomas (Voy.) · J+1 », YAM-2042 « Londres → Lagos · Mai (Exp.) · Adebayo (Voy.) · attend le Voyageur · n h », retenue « Annulation après le départ · à trancher », J+4 pas rouge ; délai à 12 h → YAM-2041 « sans réponse · à trancher », YAM-2042 « attend le Voyageur · ≤ 4 h » ; filtres type / origine / destination / âge / décidabilité, compteurs de la file entière **inchangés**, y compris quand un filtre ne rend rien (corrigé) ; `?kind=RETENTION` et `?decidable=1` présélectionnent ; aucune ligne de journal |
| ADM-MED-2 | Ouvrir un dossier | **Conforme** (+ amélioration) — « YAM-2041 », « Paris → Brazzaville · DISPUTED », « ← À arbitrer » ; bandeau « Version du Voyageur attendue jusqu'au … — décision possible dès sa réponse ou à l'échéance. » ; blocs Chronologie, Argent, Expéditeur, Voyageur, Colis déclaré, Prise en charge, Signalement (description, « Remboursement partiel », engagement) ; catégorie « Petits jouets » et versement « gelé (litige) » **en français** (corrigé) ; code `742891` absent de la page **et de la réponse de l'API** ; lien « Lire la conversation des deux parties → · Lecture journalisée. » pour le Médiateur, absent pour la Finance ; journal `DISPUTE_VIEWED BOOKING · id`, `{ kind: "DISPUTE", ticketNumber: "YAM-2041" }` |
| ADM-MED-3 | Les gardes du formulaire | **Conforme** (+ amélioration) — Support : « Ton profil lit ce dossier mais ne tranche pas (médiateur ou super administrateur). » ; YAM-2042 avant l'échéance : « Décision possible à partir du … », appel direct **409** `TRANSITION_NOT_ALLOWED` portant `decidableAt` ; partiel 0 et total → « entre 0,01 et {total − 1 centime} », serveur 400 `PARTIAL_REFUND_OUT_OF_BOUNDS` ; motif de 30 caractères → bouton inactif, « 30 / 50 min » ; Finance → 403 ; un refus du serveur s'affiche **en français par son code** (« Le délai de réponse du Voyageur court encore : décision possible à partir du … ») au lieu de « 409 : The carrier still has time… » (corrigé) ; aucune décision |
| ADM-MED-4 | Rejet | **Conforme** — indice « Voyageur : 28,00 € · Yamba garde … » ; récapitulatif « Remboursé à l'Expéditeur (Chinwe) : 0,00 € · Versé au Voyageur (Thomas) : 28,00 € · Conservé par Yamba : commission + prime » ; « Décision enregistrée · … deal COMPLETED · remboursé 0,00 € · versé 28,00 € (versement envoyé) » (statut du versement en français, corrigé) ; base : COMPLETED, `completedBy: ADMIN`, versement parti (FAKE : SENT) ; **Chinwe** +1 litige perdu, Thomas inchangé ; **un** `booking.dispute_resolved` à l'horodatage exact de la transition ; **aucun** remboursement émis chez le fournisseur ; seconde décision → 409 ; deux emails « Décision rendue » (un par partie, montant propre, motif intégral, jamais le code) ; aucune fenêtre de notation ; journal `DISPUTE_RESOLVED` avant/après exacts |
| ADM-MED-5 | Remboursement partiel | **Conforme** — version d'Adebayo déposée → « Version du Voyageur reçue le … — décision possible. » ; montant = moitié du total (< net) ; récapitulatif dont les trois lignes totalisent **exactement** le payé ; COMPLETED ; **Adebayo** +1 litige perdu, Mai inchangée ; **un** remboursement du montant saisi chez le fournisseur ; `refundedAt` ≤ `completedAt` (l'argent d'abord) ; portefeuille de Mai : `PARTIALLY_REFUNDED`, part rendue = montant, part gardée = total − montant ; journal exact |
| ADM-MED-6 | Remboursement total | **Conforme** — indice « Expéditeur : {total} (commission comprise) · Voyageur : 0 » ; CANCELLED, `closedBy: ADMIN`, remboursé = total, versement nul ; Thomas +1 ; **un** remboursement du total ; journal `FULL_REFUND` exact |
| ADM-MED-7 (ajoutée) | Deux décisions simultanées | **Conforme après correction** → `ANO-ADM-22` ; Médiateur et super administrateur valident au même instant deux partiels différents : **200 + 409 `DECISION_IN_PROGRESS`**, **un** remboursement émis, base = ce remboursement, **une** ligne de journal. Avant : 200 + 500 au premier passage, puis 200 + 409 **avec deux remboursements émis (7,84 € et 15,68 €)** |
| ADM-MED-8 (ajoutée) | Un dossier tranché se relit | **Conforme après amélioration** → **A160** ; après un rejet, la Finance ouvre YAM-2041 : bloc « Décision rendue » (issue, motif), « Ce dossier est déjà tranché. », plus de bandeau d'attente, relecture journalisée `DISPUTE_VIEWED` ; la file ne le montre plus ; un deal jamais passé en médiation → 404. Avant : « Ce deal n'est pas en attente d'arbitrage. » |
| ADM-MED-9 (ajoutée) | Partiel supérieur au net | **Conforme après correction** → `ANO-ADM-23` ; Chinwe lit « nous te remboursons 29,68 €. Le Voyageur ne reçoit rien sur ce deal. », Thomas « Aucun versement ne te revient sur ce deal. ». Avant : « Le reste est versé au Voyageur. » alors qu'il ne reçoit rien (le « avant » est prouvé par le test unitaire : notification-service, lancé sous `nx serve`, avait déjà rechargé la correction quand la fiche a été jouée) |

### Anomalies

- **ANO-ADM-22 (BLOQUANTE, close)** — **deux décisions simultanées remboursaient deux fois.** La médiation fait partir le
  remboursement avant la transaction (D39) ; les deux requêtes passaient les vérifications, émettaient chacune leur
  remboursement, et seul le second enregistrement échouait (500, puis 409 selon le moment). Mesuré : deux remboursements
  FAKE sur le même paiement, un seul en base. Correction (**A159**) : verrou Redis par deal pris AVANT toute lecture
  (`apps/deal-service/src/lib/decision-lock.ts`, câblé dans `deal.routes.ts`, gestes `resolveDispute` et
  `resolveRetention` de `deal-mediation.service.ts`), code 409 `DECISION_IN_PROGRESS` ajouté au contrat
  (`booking-lifecycle.schema.ts`). 4 tests unitaires (`decision-lock.spec.ts`).
- **ANO-ADM-23 (mineure, close)** — **l'email de l'Expéditeur mentait sur un partiel supérieur au net** : « Le reste est
  versé au Voyageur. » quand le Voyageur ne reçoit rien et que Yamba garde la différence. Correction
  (`apps/notification-service/src/emails/settlement-emails.ts`, FR et EN) : « Le Voyageur reçoit {montant}. » ou « Le
  Voyageur ne reçoit rien sur ce deal. » ; test unitaire (`booking-emails.spec.ts`).
- **ANO-ADM-24 (mineure, close, établie par lecture du code)** — **l'alerte « litiges décidables sans décision » ignorait
  le paramètre de délai** : elle codait 72 h en dur et partait de la création de la fiche `Dispute`, là où l'écran de
  médiation lit `dispute.responseDelayHours` et `Booking.disputedAt`. Avec un délai abaissé à 24 h, l'alerte arrivait
  48 h trop tard. Correction : règle pure `countUndecidedDisputes` (`ops-alerts.rules.ts`), branchée dans
  `ops-alerts.service.ts` avec le paramètre ; 3 tests unitaires.

### Écarts documentaires

- **Délai « abaissé à 1 heure »** (MED-3) : hors bornes, le minimum de `dispute.responseDelayHours` est 12 h.
- **Blocs « Trancher », « Jalons du voyage », « Remise »** (MED-2) : avant l'échéance, « Trancher » cède la place à la
  date de décision ; les deux autres n'apparaissent qu'avec des jalons ou des photos de remise, que le jeu d'essai ne pose
  pas.
- **Sous-titre de la file** : le cahier et l'écran citaient « Litige : délai de réponse » ; le paramètre s'appelle « Délai
  de réponse au litige » (écran corrigé, cahier à aligner).
- **Messages** : statut du versement en français dans le message de succès ; un dossier tranché affiche la décision au lieu
  d'un 404.

### Améliorations faites

- **A160** — dossier tranché relisible (`admin-dispute.service.ts` `fileKindOf`, test unitaire ; `DecisionForm.tsx` :
  « déjà tranché » avant la permission).
- **Écran de décision** (`DecisionForm.tsx`) : refus lus par leur code et traduits (délai, verrou, bornes, fournisseur,
  conflit d'intérêts, permission — chacun dit si **rien n'est parti**) ; montant accepté avec espaces (« 1 234,50 ») ;
  dossier rechargé après la décision (bloc « Décision rendue » affiché, bandeau retiré) ; statut du versement en français.
- **Dossier** (`DisputeFileView.tsx`, `format.ts`) : catégorie du colis et statut du versement en français
  (`PARCEL_CATEGORY_LABEL`, mêmes libellés que le site).
- **File** (`QueueTable.tsx`, `disputes/page.tsx`) : compteurs de la file entière visibles même sans résultat ; libellé réel
  du paramètre ; erreur de chargement explicite.

### Regard d'expert — produit ET test, une ligne par fiche

- **MED-1** — *Fait* : compteurs toujours visibles, libellé du paramètre. *Proposé* : trier par **échéance de décision**
  plutôt que par ouverture (un litige où le Voyageur a répondu est décidable avant un plus ancien sans réponse) — petit.
  *Test* : le rouge à J+5 n'est prouvé que dans le sens « pas rouge » (J+4) ; une retenue vieillie le prouverait — petit.
- **MED-2** — *Fait* : libellés français. *Proposé* : le numéro de téléphone et l'adresse du destinataire manquent au
  dossier alors que le litige « non livré » les appelle — à trancher (données personnelles). *Test* : le code de livraison
  est cherché dans la page ET dans la réponse de l'API — rien à faire.
- **MED-3** — *Fait* : refus traduits. *Proposé* : afficher le compte à rebours du délai dans le formulaire plutôt qu'une
  date — petit.
- **MED-4** — *Constat* : le versement part immédiatement (FAKE : SENT) ; en réel, un compte Stripe du Voyageur non prêt le
  mettrait en échec sans bloquer la décision — c'est voulu. *Proposé* : le récapitulatif pourrait prévenir « compte de
  paiement du Voyageur non prêt : le versement sera rejoué » — petit.
- **MED-5** — *Proposé* : afficher dans le récapitulatif **qui perd le litige** (compteur interne) : c'est une conséquence de
  la décision que le médiateur ne voit nulle part — petit.
- **MED-6** — *Constat* : le remboursement total rend les kilos au trajet (`releaseKg`), sur un trajet déjà parti — sans
  effet visible, à connaître.
- **MED-7** — *Fait* : verrou (A159). *Proposé* : passer le **remboursement manuel appliqué** (§ 5.15) et les annulations
  remboursées sous le même verrou — même risque, non mesuré ici ; ajouter une clé d'idempotence Stripe
  (`idempotencyKey` sur `refunds.create`) pour qu'une reprise après panne entre le remboursement et la transaction ne
  rembourse pas deux fois — moyen.
- **MED-8** — *Fait* : A160. *Proposé* : un lien « Dossier de médiation » depuis la fiche argent d'un deal tranché — petit.
- **MED-9** — *Fait* : email juste. *Test* : piège de poste — un service lancé sous `nx serve` recharge le code modifié
  PENDANT le passage « avant correction » ; la preuve « avant » d'un défaut côté notification-service doit être unitaire.

---

## Cahier 02-ADMIN — § 5.10 Retenue d'annulation tardive · **CONFORME** (2 fiches + 2 ajoutées · 2 anomalies closes dont 1 régression du § 5.9 · 3 améliorations · 2 écarts documentaires · 4 scénarios, 2 min)

`apps/e2e/src/admin/adm-ret-retenue.spec.ts`. Une retenue « à arbitrer » (`HELD_FOR_MEDIATION`) se verse au Voyageur au
prorata de sa part nette, ou se restitue en entier à l'Expéditeur ; le deal reste CANCELLED. Chaque arbitrage est vérifié
à six endroits : écran (indice, récapitulatif, panneau de décision, dossier relu), API, base (disposition, montants,
outbox), fournisseur (remboursement ou transfert RÉELLEMENT émis, par le rapprochement, en différence), journal, et ce que
lisent les deux parties (emails, portefeuilles). Jouée d'abord contre le code non corrigé, puis 4/4 verts deux fois.

Terrain mesuré : `bzv-held` (Aminata → Thomas, Paris → Brazzaville) payé 29,12 € (net 26,00 €, commission 3,12 €), annulé
à J−4, remboursé 14,56 €, retenue 14,56 € → compensation round(1456 × 2600 / 2912) = **13,00 €**, Yamba **1,56 €**.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-RET-1 | Compensation au Voyageur | **Conforme** — file filtrée « retenues » → dossier « Retenue à arbitrer » ; bloc Argent « Remboursé 14,56 € », « Retenue 14,56 € · en attente d'arbitrage » (était le code) ; indice « Voyageur : 13,00 € (prorata de sa part nette) · Yamba garde 1,56 € (sa commission) », prorata = `proposedAmounts` = formule ; récapitulatif 0,00 / 13,00 / 1,56 ; 200 `COMPENSATE_CARRIER`, versement **SENT** ; panneau « statut final : Annulée … Le deal reste annulé » ; dossier relu « Ce dossier est déjà tranché. » ; base : CANCELLED, disposition `CARRIER`, motif, `payoutAmountCents` 1300, remboursement inchangé, **un** `booking.dispute_resolved` (acteur ADMIN, kind RETENTION) ; fournisseur : aucun remboursement, transfert 13,00 € ; fiche argent « 14,56 € · compensation versée au Voyageur » ; hors des files « À arbitrer » et « Retenues à arbitrer » ; journal `RETENTION_ARBITRATED BOOKING · id`, avant `{HELD_FOR_MEDIATION, 1456}`, après `{COMPENSATE_CARRIER, 0, 1300}` |
| ADM-RET-2 | Restitution à l'Expéditeur | **Conforme** — indice « Expéditeur : 14,56 € remboursés · remboursé en tout : 29,12 € · Voyageur : 0 » ; récapitulatif 14,56 / 0,00 / 0,00 ; 200 `RESTITUTE_SHIPPER` ; base : disposition `SHIPPER`, remboursé 29,12 €, `refundId` gardé, aucun versement ; fournisseur : **un** remboursement de 14,56 € de plus ; portefeuille d'Aminata : `PARTIALLY_REFUNDED` (14,56 / retenue 14,56) → `REFUNDED` 29,12 € ; journal après `{RESTITUTE_SHIPPER, 1456, 0}` ; dossier « 14,56 € · restituée à l'Expéditeur » |
| ADM-RET-3 | Les gardes (ajoutée) | **Conforme d'emblée** — Support : « Ton profil lit ce dossier mais ne tranche pas » et 403 ; motif < 50, issue inconnue, issue de litige (`FULL_REFUND`) → 400 ; deal sans retenue → 409 `TRANSITION_NOT_ALLOWED` ; **deux restitutions simultanées → 200 + 409 `DECISION_IN_PROGRESS`, UN seul remboursement émis** (le verrou A159 couvrait déjà la retenue) ; second arbitrage → refusé, rien émis, aucun versement ; une seule ligne de journal |
| ADM-RET-4 | Ce que lisent les parties (ajoutée) | **Conforme après correction** → `ANO-ADM-25`, `ANO-ADM-26` ; ✉ Aminata « La retenue d'annulation ne t'est pas restituée : le Voyageur en reçoit une part en compensation, le reste correspond à la commission Yamba. », le motif du Médiateur, aucune promesse de remboursement, **jamais « 13,00 € »** ; ✉ Thomas « Une compensation de 13,00 € … », **jamais « 14,56 € »** ; portefeuille de Thomas `LATE_CANCELLATION` **SENT 13,00 €** ; portefeuille d'Aminata inchangé `PARTIALLY_REFUNDED`, retenue 14,56 € |

### Anomalie

- **ANO-ADM-25 (mineure, close)** — **l'email d'une compensation inventait sa justification et taisait la part de Yamba.**
  L'Expéditeur lisait « La retenue d'annulation est versée au Voyageur : personne n'a pu attester de la prise en charge, et
  il s'était déplacé. » — un fait que le Médiateur n'a pas écrit (le jeu d'essai dit même l'inverse : « Le Voyageur ne
  s'est pas présenté »), et un fait faux : seuls 13,00 € sur 14,56 € vont au Voyageur. Correction
  (`apps/notification-service/src/emails/settlement-emails.ts`, FR et EN) : la part de Yamba nommée, SANS le montant du
  Voyageur (règle « chacun son montant », ci-dessous) ; le motif du Médiateur, déjà présent, est la seule justification.
  Côté Voyageur, « La retenue te revient » devient « Une compensation de 13,00 € te revient ». Test `booking-emails.spec.ts`.
- **ANO-ADM-26 (majeure, close — régression introduite par ANO-ADM-23 au § 5.9, PR #310)** — **l'Expéditeur lisait
  le montant versé au Voyageur.** Trouvée en rejouant WEB-E2E-2 (étape 18 « Décision rendue, chacun son montant » :
  « jamais 40,00 € dans l'email de João ») après une modification voisine : la correction d'ANO-ADM-23 avait remplacé
  « le reste est versé au Voyageur » par « Le Voyageur reçoit 40,00 € ». Le parcours WEB-E2E-2 n'avait pas été rejoué au
  § 5.9. Correction : « Le reste du prix de transport est versé au Voyageur. » (FR/EN), sans montant ; « Le Voyageur ne
  reçoit rien sur ce deal. » garde le cas au-delà du net. Tests unitaires : l'email Expéditeur ne contient jamais le
  montant du Voyageur, l'email Voyageur jamais le montant remboursé ; WEB-E2E-2, ADM-MED-4 et ADM-MED-9 rejoués verts.

### Écarts documentaires

- Les issues s'appellent `COMPENSATE_CARRIER` / `RESTITUTE_SHIPPER` dans l'API et le journal (le cahier :
  `CARRIER_COMPENSATION` / `SHIPPER_RESTITUTION`).
- Indices et panneau de décision enrichis (part de Yamba, total remboursé, « statut final : Annulée ») : le cahier cite
  l'ancien texte.

### Regard d'expert — produit ET test, une ligne par fiche

- **RET-1** — *Fait* : disposition en français (`RETENTION_DISPOSITION_LABEL`, dossier et fiche argent) ; indice qui dit
  la part de Yamba ; panneau « le deal reste annulé ». *Proposé* : afficher dans le dossier que la retenue vient d'une
  annulation « Le Voyageur ne s'est pas présenté » (motif saisi par l'Expéditeur) à côté des deux issues : c'est
  l'argument décisif de l'arbitrage — petit. *Test* : le transfert est lu chez le fournisseur, pas seulement en base.
- **RET-2** — *Fait* : indice « remboursé en tout ». *Proposé* : la restitution émet le remboursement AVANT la transaction,
  sans clé d'idempotence chez le fournisseur — même réserve qu'au § 5.9 (reprise après panne) — moyen, à trancher.
- **RET-3** — *Constat* : le verrou A159 tient déjà pour la retenue ; aucune correction. *Test* : la concurrence est
  prouvée par la somme des remboursements émis, pas par le code HTTP.
- **RET-4** — *Fait* : ANO-ADM-25 et ANO-ADM-26 (et ses assertions « jamais le montant de l'autre » dans la fiche).
  *Test* : une correction de gabarit d'email se prouve contre TOUS les parcours qui lisent ce gabarit — le rejeu de
  WEB-E2E-2 a trouvé la régression que les fiches admin ne voyaient pas. *Proposé* : le portefeuille de l'Expéditeur montre « partiellement remboursé » pendant
  l'arbitrage, sans dire qu'une décision est attendue sur la retenue — ajouter un état « retenue en cours d'arbitrage »
  (contrat du portefeuille + écran membre + i18n) — moyen, à trancher avec l'écran membre.

---

## Cahier 02-ADMIN — § 5.11 Finances : les files d'exception · **CONFORME** (2 fiches + 3 ajoutées · 2 anomalies closes · 10 améliorations · 2 écarts documentaires · 5 scénarios, 1 min 30)

`apps/e2e/src/admin/adm-fin-files.spec.ts`. `/finances` montre ce qui n'a pas suivi son cours. Chaque ligne se prouve
deux fois : **l'écran = l'API de l'écran** (`GET /admin/finances/queue?kind=…`), **l'API = la base** (tuiles de
l'accueil, jeu d'essai). Les gestes d'argent des files (Relancer, Décider, Arbitrer) ont leurs chapitres (§ 5.14, 5.15,
5.10). Jouée d'abord contre le code non corrigé (FIN-1, 2, 4, 5 rouges, chacune sur ce qu'elle vise ; FIN-3 vert
d'emblée), puis 5/5 verts deux fois ; ADM-ALR et ADM-ACC rejouées vertes (7/7) après les changements partagés.

Terrain mesuré : files 1 · 1 · 1 · 0 (cahier : 1 · 1 · 1 · vide) — versement en échec `bzv-completed-blocked` 26,00 €,
4 tentatives, motif `CARRIER_ACCOUNT_NOT_READY` **alors que le compte de Thomas est prêt** ; renversement `bzv-reversed`
30,00 € ; retenue `bzv-held` 14,56 €. Le rejeu « Relancer » ne peut pas doubler l'argent : l'exécuteur unique passe une clé
d'idempotence (`payout:<id>`), respectée par le fournisseur FAKE comme par Stripe ; la preuve de concurrence est laissée
au § 5.14.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-FIN-1 | Les quatre onglets et leur contenu | **Conforme après améliorations** — sous-titre exact (corrigé : il disait le rapport « plus bas ») ; lien « Rapport mensuel et export → » ; pour chaque onglet : adresse `?kind=…` écrite au clic, indice exact, compteur de l'onglet = compte servi par l'API, colonnes « Deal / Parties / Montant / État / Depuis », lignes = API (liens deal et membres, montant, statut du deal en français, jamais le code) ; FAILED : « compte Stripe du Voyageur non prêt », « 4 tentative(s) · prochaine … », « Le compte est prêt depuis : « Relancer » peut aboutir. », « fin du deal », « Relancer » ; REVERSED : « transfert renversé par Stripe », « Décider » → `/deals/<id>` ; HELD : « retenue conservée », « annulé le », « Arbitrer » → `/disputes/<id>` ; PROPOSED_REFUNDS : « Rien à traiter. » ; pied « n ligne(s) · calculé le … » ; `?kind=REVERSED/HELD/PROPOSED_REFUNDS/NIMPORTEQUOI` → bon onglet / « Versements en échec » ; l'onglet survit au rechargement ; le Médiateur lit la file ; journal : aucune ligne |
| ADM-FIN-2 | Le Support ne voit pas les finances | **Conforme après correction** → `ANO-ADM-28` ; pas d'entrée « Finances » ; `payoutsFailed`, `payoutsReversed`, `manualRefundProposals` servis à `null`, aucune tuile ; `/alerts` : la carte `PAYOUT_FAILED_48H` sans lien, « Ton profil n'ouvre pas cette file : transmets à Finance ou Médiateur. » ; `/finances` : « Ton profil ne donne pas accès aux finances. » ; `GET /admin/finances/queue` → 403 `ADMIN_PERMISSION_DENIED` (`finances.read`) ; le chemin du cahier `/api/admin/finances` → 404 **JSON** `ROUTE_NOT_FOUND` (`ANO-ADM-27`) ; journal : aucune ligne |
| ADM-FIN-3 *(ajoutée)* | Le message brut du fournisseur reste à l'admin | **Conforme** (d'emblée) — manœuvre consignée : `payoutFailureReason = PROVIDER_ERROR:No such destination: 'acct_1RecetteSecret42'` ; l'admin lit « refus du fournisseur » et le message en chasse fixe, sans l'indice « compte prêt » ; Thomas et Aminata, `GET /deals/<id>` et `/me/wallet` : ni le message ni `PROVIDER_ERROR` ; jeu d'essai rejoué |
| ADM-FIN-4 *(ajoutée)* | Tuiles de l'accueil = files | **Conforme après amélioration** — jeu d'essai : `payoutsFailed`, `payoutsReversed`, `retentionsHeld`, `manualRefundProposals` = comptes des quatre files, identiques quel que soit l'onglet lu ; Finance propose un remboursement de 1,50 € sur `bzv-completed` → tuile et file passent à 1, la ligne « 1,50 € · remboursement proposé · proposé le … · Décider » ; journal `REFUND_MANUAL_PROPOSED BOOKING · id` ; rejeu → retour à l'égalité |
| ADM-FIN-5 *(ajoutée)* | Une erreur de l'API reste une erreur de l'API | **Conforme après correction** → `ANO-ADM-27` ; `kind=NIMPORTEQUOI` → 400 `INVALID_QUEUE_KIND` (était sans code) ; `/nexistepas-recette`, `/admin/finances`, `/trips/nexistepas-recette/zz/yy`, `/me/notifications/nexistepas/zz`, `/messages/nexistepas/zz/yy` par la passerelle → 404 JSON, aucune page HTML ; les cinq services en direct (6001 à 6005) → 404 `ROUTE_NOT_FOUND` |

### Anomalies

- **ANO-ADM-27 (mineure, close — A161)** — **une route inconnue répondait la page HTML d'Express.** Les cinq services
  (et donc la passerelle, dont le repli mène à auth-service) servaient `<!DOCTYPE html>… Cannot GET /admin/finances` :
  le framework et le chemin exposés, et un corps qu'aucun client JSON ne sait lire. Correction : `notFoundHandler`
  (`packages/error-handler/error-middleware.ts`), monté après les routes et avant `errorMiddleware` dans les cinq
  `main.ts` → 404 `{ status, message: "Route not found.", code: "ROUTE_NOT_FOUND", details: { code } }` ; test unitaire
  dans `apps/auth-service/src/utils/error-details.spec.ts`.
- **ANO-ADM-28 (mineure, close)** — **une alerte menait un profil vers un écran qui lui répond 403.** Le Support
  (`kpi.read`, sans `finances.read`) lisait l'alerte « Versements en échec depuis plus de 48 h » ; la carte « Aller
  traiter → » ouvrait `/finances`, refusé. Correction (`apps/admin-ui/src/components/AlertsView.tsx`) : l'alerte reste
  lisible (tout profil de pilotage doit savoir que la plateforme souffre), le lien n'est offert qu'au profil qui ouvre la
  destination ; les autres lisent à qui transmettre.

### Améliorations faites

- **Un seul filtre par file** (`financeQueueWhere`, `packages/libs/api-contracts/src/admin/admin-finances.schema.ts`) lu
  par la file (deal-service) et les tuiles (auth-service `admin-kpis.controller.ts`) — la tuile comptait tout
  `payoutStatus: FAILED`, la file seulement les deals terminés ou annulés (A161).
- **Compte de chaque file** dans la réponse (`counts`) et **troncature signalée** (`truncated`, page de 200) ; test unitaire
  (`admin-finance.service.spec.ts`) ; contrats OpenAPI régénérés.
- **Onglets** : compteur sur chaque onglet (nom accessible inchangé), onglet écrit dans l'adresse (`router.replace`).
- **Lignes** : statut du deal en français ; « Depuis » qui dit quelle date (fin du deal / annulé le / proposé le) ;
  indice « Le compte est prêt depuis : « Relancer » peut aboutir. » quand le motif date d'un compte depuis finalisé.
- **Refus** : « Ton profil ne donne pas accès aux finances. » (plus de « Chargement… » éternel sous l'erreur) ; « Relancer »
  sans double envoi, message qui nomme le montant et le Voyageur, file rechargée quand il n'y a plus rien à relancer.
- **API** : `INVALID_QUEUE_KIND` (avec les valeurs admises).
- **Sous-titre** exact (quatre files, rapport à droite des onglets).

### Écarts documentaires

- **Badge « Stripe non prêt » absent** : le jeu d'essai pose l'échec « compte non prêt » sur un Voyageur dont le compte
  est prêt ; le badge dit l'état ACTUEL du compte (l'écran le signale désormais par l'indice « prêt depuis »).
- **`/api/admin/finances` n'existe pas** : l'appel direct du cahier répond 404 `ROUTE_NOT_FOUND` ; la garde se prouve sur
  `/api/admin/finances/queue` (403).

### Regard d'expert — produit ET test, une ligne par fiche

- **FIN-1** — *Produit, fait* : compteurs, adresse, « Depuis » explicite, indice « compte prêt ». *Proposé* : trier
  FAILED par ancienneté de l'ÉCHEC (première tentative) plutôt que par dernière écriture — demande un champ
  `payoutFirstFailedAt` (même question que l'alerte du § 5.2, à trancher ensemble). *Test* : la fiche parcourt les lignes
  servies par l'API au lieu de supposer une ligne — elle tiendra une file plus longue — rien à faire.
- **FIN-2** — *Produit, fait* : refus en français, carte d'alerte sans lien mort. *Proposé* : l'accueil du Support
  pourrait taire les alertes d'argent au lieu de les nommer — à trancher (un profil de pilotage doit-il voir toute la
  santé de la plateforme ?). *Test* : la fiche prouve la garde sur la route réelle ET le 404 JSON du chemin du cahier.
- **FIN-3** — *Produit* : conforme ; *proposé* : afficher aussi la date de la dernière tentative à côté du message brut
  (elle est servie, pas montrée) — petit. *Test* : contre-épreuve sur les deux parties et les deux écrans membres.
- **FIN-4** — *Produit, fait* : un filtre partagé. *Proposé* : une proposition de remboursement devenue impossible (deal
  remboursé entre-temps) reste dans la file — la file pourrait la marquer « caduque » — petit. *Test* : l'égalité est
  vérifiée à trois instants (seed, après geste, après rejeu), pas une fois.
- **FIN-5** — *Produit, fait* : 404 JSON partout. *Proposé* : la passerelle pourrait répondre elle-même un 404 pour les
  préfixes qu'elle ne route pas, au lieu de les confier à auth-service — petit. *Test* : les cinq services sont appelés en
  direct, la passerelle ne masque donc aucun oubli.

---

## Cahier 02-ADMIN — § 5.12 Fiche argent d'un deal · **CONFORME** (2 fiches + 3 ajoutées · 2 anomalies closes · 9 améliorations · 3 écarts documentaires · 5 scénarios, 1 min 20)

`apps/e2e/src/admin/adm-arg-fiche-argent.spec.ts`. La fiche argent répond à « où est l'argent de ce deal ? ». Trois
preuves : **écran = API = base** sur la fiche du cahier ; **des invariants comptables sur les 23 deals du jeu d'essai**
(une fiche d'argent qui additionne faux, ou un deal clos dont l'argent n'a pas de destination, se voit à l'échelle du jeu
d'essai, pas sur une fiche choisie) ; **ce qui ne sort jamais** (code de livraison, photos, coordonnées du destinataire),
cherché dans la page ET dans les réponses d'API. Le terrain a été **sondé en base avant la spec** (prix figé, débit,
remboursements, versement, retenue de chaque deal). Chaque fiche a d'abord été jouée contre le code non corrigé :
ARG-1 conforme d'emblée ; ARG-2, 3, 4 et 5 rouges, chacune sur le défaut qu'elle visait. Puis 5/5 verts deux fois ;
ADM-RET et ADM-FIN (qui lisent la même fiche) rejouées.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-ARG-1 | Ce que montre la fiche argent | **Conforme** — ouverte depuis `/finances?kind=FAILED` ; les dix cartes du cahier **dans l'ordre** (la carte ajoutée « Bilan de l'argent » est tolérée et consignée) ; prix figé = snapshot (29,12 € = 26,00 € + 3,12 € + 0) ; versement « en échec », 26,00 €, « compte Stripe du Voyageur non prêt », « 4 · prochaine 15 sept. 2026, 04:15 » ; compte Stripe masqué `acct_…xxxx` + « virements activés » ; **aucune** trace du code `742891`, des photos `r2.seed…`, du destinataire (nom, email, téléphone) dans la page ni dans la réponse, aucune clé `deliveryCode*` ; `pi_…` et `ch_…` en clair ici, compte masqué sur la fiche membre ; journal `DEAL_MONEY_VIEWED BOOKING · id` |
| ADM-ARG-2 | La chronologie complète | **Conforme après amélioration** (l'état de relais s'affichait en anglais, « published ») — faits récents : Aminata annule `bzv-pending` par l'API membre, attente du relais, de la notification et de l'email ; texte d'avertissement exact ; « Charger la chronologie » → « 2 événement(s) · 3 action(s) admin · 2 notification(s) · 2 email(s) » ; étiquettes « événement », « notification », « email » ; `booking.cancelled` « publié » ; ni photo, ni destinataire, ni code dans la carte ni dans `/history` ; la chronologie de l'argent dit « Empreinte libérée » ; journal `DEAL_HISTORY_VIEWED BOOKING · id` |
| ADM-ARG-3 *(ajoutée)* | Invariants comptables, 23 deals | **Conforme après correction** → `ANO-ADM-30` — pour chaque deal : payé = net + commission + prime, remboursé ≤ payé, jamais de remboursement sans débit, bilan qui additionne, **aucune anomalie** ; constat par deal (ex. `bzv-completed` détient 4,20 € = sa commission, `bzv-held` 14,56 € · attend `RETENTION_HELD`, `bzv-reversed` 33,60 € · attend `REVERSAL_OPEN`) ; **contre-épreuve** : le défaut d'origine remis en base (remboursement retiré de `bzv-cancelled`, manœuvre consignée) → bilan `UNALLOCATED_FUNDS`, message rouge à l'écran |
| ADM-ARG-4 *(ajoutée)* | Bilan et libellés | **Conforme après amélioration** — `bzv-completed-blocked` : carte « Bilan de l'argent », « En attente · versement en échec » ; « Terminée » au lieu de `COMPLETED`, « au colis (catégorie) », « Terminé … (automatique) » ; `bzv-completed` : « Soldé » ; `bzv-declined` : « Empreinte libérée (jamais débitée) … (par le Voyageur) » ; identifiant inconnu → « Deal introuvable. » |
| ADM-ARG-5 *(ajoutée)* | Le Support lit la chronologie | **Conforme après correction** → `ANO-ADM-29` — serveur : `/money` 403, `/history` 200 ; écran : depuis le dossier de médiation, le lien « Chronologie du deal » → `/deals/:id` sans message d'erreur brut, carte chargée ; journal `DEAL_HISTORY_VIEWED`, jamais `DEAL_MONEY_VIEWED` |

### Anomalies

- **ANO-ADM-29 (majeure par la fiche, close)** — **le Support ne pouvait pas lire la chronologie que sa permission lui
  ouvre.** `deals.history.read` est donnée au Support (cahier ARG-2 : « Médiateur, Support, Finance ») mais la seule carte
  qui la montre vit sur `/deals/:id`, dont l'API `/money` exige `finances.read` : la page affichait « 403 : Your admin
  profile does not allow this action. » et rien d'autre ; le dossier de médiation proposait pourtant au Support le lien
  « Fiche argent complète (chronologie, rapprochement Stripe) ». Correction (`DealMoneyView.tsx`) : un 403 sur l'argent
  ouvre une **vue réduite** « Chronologie du deal » (la carte seule, avec la raison) pour qui a `deals.history.read` ; le
  lien du dossier dit ce qu'il ouvre selon le profil (`DisputeFileView.tsx`).
- **ANO-ADM-30 (mineure, jeu d'essai, close)** — **un deal débité, annulé, jamais remboursé.** `bzv-cancelled` (accepté
  donc capturé, puis annulé par l'Expéditrice onze jours avant le départ) n'avait ni `refundAmountCents` ni `refundedAt` : sa fiche
  argent montrait 33,60 € encaissés sur un deal clos, sans destination. `deal-lifecycle.service.ts` rembourse en entier
  dans ce cas (ANN-01) ; le jeu d'essai posait le débit sans le remboursement. Correction : `seed-deals.ts` pose le
  remboursement intégral de tout deal accepté puis annulé (hors retenue). Détectée par la sonde en base ; désormais
  **tenue** par le bilan (ARG-3 et sa contre-épreuve).

### Écarts documentaires

- **Une carte de plus** : « Bilan de l'argent » (en tête), hors de la liste du cahier.
- **« 4 tentative(s) »** : l'écran affiche « Tentatives · 4 · prochaine … » (libellé à gauche, nombre à droite).
- **L'état de relais** : le cahier écrit « publié / en attente / parqué » — l'écran l'affichait en anglais minuscule
  (`published`) ; c'est désormais le libellé du cahier.

### Regard d'expert — produit ET test, une ligne par fiche

- **ARG-1** — *Produit, fait* : statut du deal, modèle de prix et acteurs (« automatique », « par l'Expéditeur ») en
  français ; actions admin résumées en clair (montants en euros, issue traduite) au lieu du JSON brut ; erreurs de
  chargement nommées (« Deal introuvable. », jamais `404 : …`). *Proposé* : la ligne « Remboursé » ne montre que le
  CUMUL et la date du dernier ; un deal remboursé deux fois (annulation puis restitution de retenue) perd la trace du
  premier — lister chaque remboursement depuis les événements `booking.refund_issued` — moyen. *Test* : l'ordre des
  cartes est vérifié en tolérant une carte ajoutée (consignée), et les interdits sont cherchés dans la réponse d'API
  autant que dans la page.
- **ARG-2** — *Produit, fait* : états de relais, de notification et d'email en français, rebonds et plaintes en rouge ;
  **les erreurs techniques ne citent plus l'adresse ou le numéro du destinataire** (`redactContacts` : « 550 5.1.1
  <aminata@…> » → « [adresse masquée] ») — la chronologie est lue par des profils sans accès aux coordonnées.
  *Proposé* : les types d'événements restent techniques (`booking.cancelled`) — un libellé par type — petit. *Test* :
  les faits sont produits par un vrai geste membre relayé, pas insérés en base.
- **ARG-3** — *Produit, fait* : **le bilan de l'argent** (`moneyBalance`, règle pure, 6 tests) — débité, remboursé,
  versé, détenu par la plateforme, attentes, et une **anomalie** levée sur un deal clos sans attente qui détient plus
  que sa commission (ou a versé plus qu'il n'a reçu sans geste commercial). *Proposé* : exposer ce bilan en file
  « Argent sans destination » dans `/finances` et en alerte de seuil — **à trancher** (une file de plus). *Test* :
  l'invariant a sa contre-épreuve (défaut remis en base), sans quoi « aucune anomalie » ne prouvait rien.
- **ARG-4** — *Produit, fait* : « Empreinte libérée (jamais débitée) » dans la chronologie de l'argent d'un deal refusé,
  expiré ou annulé avant acceptation — sans elle, la dernière ligne était « Empreinte posée 67,20 € ». *Test* : trois
  deals de natures différentes (échec, soldé, refusé).
- **ARG-5** — *Produit, fait* : vue réduite et lien qui dit ce qu'il ouvre. *Proposé* : la même carte « Tout ce qui est
  arrivé » directement dans le dossier de médiation, pour ne pas changer d'écran — petit. *Test* : la preuve serveur
  (403 / 200) précède la preuve écran ; le journal prouve qu'aucune lecture d'argent n'a eu lieu.

## Cahier 02-ADMIN — § 5.13 Rapprochement avec le fournisseur · **CONFORME** (1 fiche + 1 partielle + 1 ajoutée · 2 anomalies closes · 8 améliorations · 3 écarts documentaires · 3 scénarios, 1 min 30)

`apps/e2e/src/admin/adm-rap-rapprochement.spec.ts`. La promesse de l'écran tient en une phrase — « Rien n'est modifié » —
et la fiche la prouve trois fois : le **document Mongo** du deal relu avant et après, la **fiche argent** identique (hors
journal, qui ne gagne que des lectures), et le **fournisseur** : un intent qu'il ne connaît pas doit rester inconnu
après la lecture. Terrain **sondé** avant la spec : les 26 deals rapprochés un par un par l'API (le Fake vit dans la
mémoire du processus deal-service). Garde de sécurité : chaque geste qui émet de l'argent est précédé d'un rapprochement
qui exige `provider: "FAKE"` (un lanceur `nx serve --all` peut reprendre le port 6003 avec la clé Stripe). Fiches jouées
contre le code non corrigé (RAP-1 rouge sur son défaut), puis vertes deux fois de suite ; ADM-ARG, FIN, RET (adaptée) et
MED rejouées vertes (27/27).

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-RAP-1 | Rapprocher avec le Fake (local) | **Conforme après correction** → `ANO-ADM-31` ; texte de la carte (nomme désormais « le fournisseur de test (Fake) ») ; « Rapprocher maintenant » → `INTENT_NOT_FOUND`, `live` nul, « Paiement introuvable chez le fournisseur » avec son explication en français ; **second** rapprochement : toujours introuvable ; document du deal identique octet pour octet ; fiche argent identique, journal enrichi de `DEAL_MONEY_VIEWED` et `DEAL_RECONCILED` seulement ; deux lignes `DEAL_RECONCILED BOOKING · id` `{ provider: "FAKE", divergences: ["INTENT_NOT_FOUND"] }` ; deal sans paiement (manœuvre sur `bzv-declined`) : « Aucun paiement à rapprocher. », pas de bouton, 400 « This deal has no payment to reconcile. » `NO_PAYMENT_TO_RECONCILE`, rien au journal |
| ADM-RAP-2 | Détecter une divergence réelle | **⏭ partiel, conforme** — substitut du cahier **vérifié** : les neuf codes figurent dans les tests unitaires du deal-service. En plus, sur la pile locale : versement relancé (transfert Fake réel) et remboursement manuel de 1 € appliqué par le super administrateur (le Fake connaît alors l'intent), puis base décalée par manœuvres consignées → **`REFUND_NOT_RECORDED`** (le code bloquant du cahier, base L−100 · fournisseur L), `REFUND_RECORDED_NOT_LIVE` (L+400 · L), `TRANSFER_AMOUNT_MISMATCH` (2 700 · 2 600), `TRANSFER_MARKED_REVERSED_BUT_LIVE_OK` ; à l'écran : libellé, deux montants, geste en français, « empreinte posée », « réussi » ; aucune lecture n'a écrit ; jeu d'essai rejoué |
| ADM-RAP-3 (ajoutée) | Les gardes | **Conforme** — Support : 403 `ADMIN_PERMISSION_DENIED` et vue « Chronologie du deal » sans bouton ; Médiateur (`finances.read`) rapproche ; deal inexistant 404, identifiant invalide 400 ; une seule ligne de journal (le Médiateur) |

### Anomalies

- **ANO-ADM-31 (majeure, close — A163)** — **la lecture créait l'état qu'elle lisait.** `FakePaymentProvider.inspect`
  passait par `retrieve`, qui « adopte » tout intent `pi_fake_seed_*` inconnu en le matérialisant AUTHORIZED à 0 €. Le
  rapprochement d'un deal du jeu d'essai répondait donc `CAPTURE_RECORDED_NOT_LIVE` + `TRANSFER_MISSING` (mesuré sur
  22 deals) au lieu de `INTENT_NOT_FOUND`, et laissait derrière lui un intent que la base n'avait jamais eu chez le
  fournisseur. Correction (`packages/libs/payments/src/index.ts`) : `inspect` lit la mémoire sans adopter ; un intent
  jamais vu est introuvable, comme chez Stripe. Tests : `payment-provider.spec.ts`.
- **ANO-ADM-32 (majeure, close — A163)** — **une panne se lisait « paiement introuvable ».** Le service classait toute
  erreur du fournisseur en `INTENT_NOT_FOUND` (message anglais brut en prime) et Stripe `transfers.retrieve` avalait toute
  erreur en « transfert manquant » : une clé révoquée ou un réseau coupé faisaient accuser un paiement et un transfert
  parfaitement réels. Établie par lecture du code (le Fake ne tombe pas en panne). Correction : `PaymentIntentNotFoundError`
  et `isStripeResourceMissing` (seule l'absence vaut « introuvable ») ; toute autre erreur → **503 `PROVIDER_UNAVAILABLE`**,
  tentative journalisée, rien comparé (`admin-finance.service.ts`, contrat OpenAPI). Tests : `admin-finance.service.spec.ts`,
  `payment-provider.spec.ts`.

### Écarts documentaires

- « Lecture seule chez **Stripe** » : l'écran nomme le fournisseur réellement interrogé (« le fournisseur de test (Fake) »
  en local).
- « Un deal `PENDING` » n'a pas de paiement selon le cahier : tous les deals du jeu d'essai portent un intent ; l'état
  « sans paiement » est posé par manœuvre.
- ADM-RAP-2 annonçait trois codes injouables en local : quatre divergences (dont `REFUND_NOT_RECORDED`) le sont, par un
  geste d'argent réel sur le Fake puis une manœuvre sur la base.

### Regard d'expert — produit ET test, une ligne par fiche

- **RAP-1** — *Faites* : texte qui nomme le fournisseur ; explication et geste en français sous chaque divergence (le
  message anglais du serveur passe en infobulle) ; statuts de paiement et de remboursement en français ; refus lus par
  leur code dans la carte (`PROVIDER_UNAVAILABLE`, `NO_PAYMENT_TO_RECONCILE`, 403, 404) ; « Rapprochement en cours… »
  et plus de double envoi ; « rien n'a été modifié en base » sous le résultat ; journal « Rapprochement fournisseur » au
  lieu de « Rapprochement Stripe ». *Test* : la comparaison « avant / après » exclut le journal de la fiche et vérifie
  qu'il ne gagne QUE des lectures — plus fort qu'une égalité brute. *Proposée* : les libellés de divergence disent encore
  « chez Stripe » — petit.
- **RAP-2** — *Faite* : la lecture d'un transfert ne confond plus absence et panne. *Proposées* : sur `INTENT_NOT_FOUND`,
  vérifier quand même le transfert connu en base (un transfert sans paiement est l'écart le plus grave) — moyen ; le seed
  pourrait déclarer ses intents au Fake avec leur montant et leur capture, pour que le bruit `CAPTURE_RECORDED_NOT_LIVE`
  disparaisse des rapprochements locaux — moyen. *Test* : la mémoire du Fake survit au rejeu du jeu d'essai — la fiche
  constate l'état initial au lieu de l'exiger, et RAP-1 choisit un deal dont l'intent est encore inconnu.
- **RAP-3** — *Proposée* : un délai minimal entre deux rapprochements d'un même deal (chaque clic appelle Stripe trois
  fois) — petit. *Test* : conforme.

---

## Cahier 02-ADMIN — § 5.14 Versements : rejeu et renversement · **CONFORME** (3 fiches + 4 ajoutées · 1 anomalie bloquante close · 7 améliorations · 2 écarts documentaires · 7 scénarios, 3 min)

`apps/e2e/src/admin/adm-ver-versements.spec.ts`. La question du chapitre n'est pas « le bouton marche-t-il » mais
**« l'argent peut-il partir deux fois ? »**. Preuves lues dans les faits durables : le **même `transferId`** dans toutes les
réponses (le Fake, comme Stripe, rend le transfert existant pour une clé déjà vue), **un seul** événement d'outbox
`booking.payout_sent`, un compteur de tentatives à +1. La concurrence est **réelle** : appels lancés ensemble
(`Promise.all`) par l'API de l'écran. Jeu d'essai rejoué avant chaque fiche. Les six premiers scénarios ont été joués
contre le code non corrigé : **tous verts** — la protection locale tenait, le défaut était ailleurs (course avec une erreur
fournisseur, clé expirée), établi à la lecture du code et prouvé en tests unitaires. Après corrections : 7/7 verts deux
fois ; ADM-ARG, FIN, RET, RAP, MED rejouées avec le second passage (33/33, 17 min).

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-VER-1 | Relancer un versement en échec | **Conforme** — avant : 4 tentatives, montant figé 26,00 € ; « Relancer » depuis `/finances?kind=FAILED` → `200 SENT`, « Versement de 26,00 € envoyé à Thomas. » ; fiche : tentatives 5, montant 26,00 €, transfert = celui rendu, bouton disparu ; un `booking.payout_sent` ; deal `ACCEPTED` → 400 « Only a completed or late-cancelled deal has a payout. » ; versement `SENT` → 400 « Nothing to retry… » ; journal `PAYOUT_RETRIED BOOKING · id`, `after { outcome: SENT, transferId }`. ⏭ admin partie au deal : aucun compte admin partie (tests unitaires) |
| ADM-VER-1 bis (ajoutée) | Le double clic, à l'écran | **Conforme** — double clic natif sur « Relancer le versement » : **une** requête, un transfert, un événement, tentatives +1 ; le message nomme montant, Voyageur et transfert (amélioration), jamais un code HTTP brut |
| ADM-VER-1 ter (ajoutée) | Quatre relances simultanées par l'API | **Conforme** — Finance, Médiateur, Finance, Médiateur ensemble → 4 × `200 SENT` portant **le même** `tr_fake_…` ; un seul `booking.payout_sent` ; compteur +1 (pas +4) ; jamais de 500 ; 4 lignes `PAYOUT_RETRIED` (une par relance exécutée, conforme au cahier) |
| ADM-VER-2 | Re-verser | **Conforme** — « Décider » depuis `/finances?kind=REVERSED` ; texte « Transfert renversé par **le fournisseur de test (Fake)** : … » (amélioration : le fournisseur réel) ; motif de 11 caractères → compteur « 11 / 20 », boutons inactifs ; motif du cahier, « Re-verser » → `200 RESENT / SENT`, « Nouveau transfert envoyé : 26,00 €, renversement clos. » ; **nouveau** transfert (≠ `tr_fake_seed_bzv-reversed`), +1 `booking.payout_sent` ; carte « Renversement clos : re-versé par … — motif » ; ligne sortie de la file ; second envoi → 400 « This payout is not an open reversal. », aucun envoi de plus ; journal `PAYOUT_REVERSAL_RESOLVED` `{ outcome: RESENT, reason, previousTransferId: tr_fake_seed_bzv-reversed }` |
| ADM-VER-2 bis (ajoutée) | Deux « Re-verser » simultanés | **Conforme** — `200 + 400`, un seul nouveau transfert, une seule clôture journalisée |
| ADM-VER-3 | Abandonner | **Conforme** — « Renversement abandonné, clos : le manque à gagner est tracé au journal. » ; versement toujours `REVERSED`, transfert inchangé, aucun envoi ; carte « abandonné par … » ; sortie de la file ; journal `{ outcome: WRITTEN_OFF, reason }` |
| ADM-VER-4 (ajoutée) | Un écran périmé | **Conforme après amélioration** — fiche de renversement ouverte, le Médiateur abandonne entre-temps ; « Re-verser » → 400, « Ce renversement est déjà clos (un autre administrateur vient de décider ?). La fiche est rechargée. », formulaire disparu, « abandonné par », rien d'envoyé. File des échecs ouverte, le Médiateur relance d'abord ; « Relancer » → « Rien à relancer : ce versement n'est plus en échec (envoyé ou traité entre-temps). La fiche est rechargée. », la ligne disparaît. Avant : `400 : This payout is not an open reversal.` et un formulaire resté affiché (lecture du code) |

### Anomalie

- **ANO-ADM-33 (bloquante, close — A164)** — **un échec pouvait écraser un versement envoyé, et le rejeu suivant verser une
  seconde fois.** `markPayoutFailed` (`apps/deal-service/src/services/deal-settlement.service.ts`) écrivait `FAILED` sous la
  seule condition du statut du deal. Deux exécuteurs sur le même versement (un admin qui relance pendant le cron, deux
  admins) : l'un obtient le transfert et écrit `SENT` ; l'autre, dont la requête croise la première, reçoit de Stripe une
  erreur 409 « clé en cours » et écrit `FAILED` **par-dessus**, argent parti compris. Stripe n'honorant une clé
  d'idempotence que 24 h et le rejeu passant à une tentative par jour, le transfert suivant partait pour de bon.
  Établie à la lecture du code, prouvée par tests unitaires (le Fake ne simule ni la clé « en cours » ni l'oubli d'une
  clé). Correction : échec conditionnel `payoutStatus ∈ {PENDING, FAILED}` + relecture (l'issue rendue est `SENT`) ;
  **A164** : après une tentative, `findTransfers` interroge le fournisseur (Stripe `transfers.list` par `transfer_group`) et
  le transfert vivant du deal est adopté au lieu d'être réémis ; recherche en panne → rien n'est émis.

### Écarts documentaires

- **Messages** : le cahier attend « Versement envoyé. », « Nouveau transfert envoyé. », « Renversement abandonné, clos. » ;
  l'écran nomme désormais le montant, le Voyageur et le transfert, et le formulaire nomme le fournisseur réel.
- **« Versement en échec immédiatement rejouable (prochaine relance datée d'hier) »** : depuis la recette du § 5.1, le jeu
  d'essai pose la prochaine relance à +23 h (le cron FAKE vidait la file) ; « Relancer » n'attend pas l'échéance, la fiche
  est jouable.

### Regard d'expert — produit ET test, une ligne par fiche

- **VER-1** — *Fait* : motif d'échec lisible (`payoutReasonLabel`) dans la file et la fiche, refus en français par code.
  *Proposé* : afficher dans la fiche la date et l'issue de chaque tentative (aujourd'hui, seul le compteur et la dernière
  raison) — petit.
- **VER-1 bis** — *Fait* : garde synchrone `useRef` (un `disabled` ne s'applique qu'au rendu suivant). *Test* : le double
  clic natif ne partait déjà qu'une fois sur ce poste ; la garde protège les postes lents — rien à faire de plus.
- **VER-1 ter** — *Fait* : ANO-ADM-33 et A164. *Proposé* : une ligne de journal par **versement** plutôt que par clic quand
  plusieurs relances concluent sur le même transfert — à trancher (le cahier veut une ligne par clic).
- **VER-2** — *Fait* : fournisseur réel nommé, compteur n/20, conséquence de chaque bouton écrite, `previousTransferId`
  au journal. *Proposé* : afficher le transfert renversé dans la carte après re-versement (il n'est plus qu'au journal) —
  petit.
- **VER-2 bis** — *Constat* : conforme d'emblée (clôture conditionnelle). *Test* : rien à faire.
- **VER-3** — *À trancher* : « Abandonner » n'écrit aucun événement d'outbox et ne prévient pas le Voyageur, alors que
  l'argent ne viendra jamais ; la règle « pas de changement d'état sans événement dans la même transaction » est à
  confronter à ce sous-état de versement.
- **VER-4** — *Fait* : lecteur de refus unique (`payoutRefusalMessage`) qui recharge sur `PAYOUT_NOT_RETRYABLE` et
  `REVERSAL_NOT_OPEN`, et qui ne promet pas « rien n'est parti » sur une erreur réseau. *Test* : fiche ajoutée, deux profils.
- **Transversal** — *Test* : un Fake qui honore l'idempotence mais ne sait ni échouer en course ni oublier une clé fait
  passer au vert les scénarios de concurrence ; les aides `findTransfers` et `_forgetIdempotencyKeysForTest` permettent
  désormais le scénario complet en test unitaire. *Proposé* : un mode « chaos » du Fake piloté par variable
  d'environnement (409 sur clé en cours, réponse perdue) pour le jouer aussi en e2e — moyen.

## Cahier 02-ADMIN — § 5.15 Remboursement manuel en deux gestes · **CONFORME après correction** (3 fiches + 3 ajoutées · 3 anomalies closes dont 1 bloquante · 9 améliorations · 3 écarts documentaires · 6 scénarios, 6 min)

`apps/e2e/src/admin/adm-rmb-remboursement.spec.ts`. Trois questions au-delà des boutons : **l'argent peut-il partir deux
fois ?** (appels simultanés, remboursements comptés **chez le fournisseur** par le rapprochement, qui lit sans écrire —
§ 5.13) ; **l'Expéditeur lit-il la vérité ?** (email et portefeuille) ; **une proposition peut-elle devenir fausse ?**
Jeu d'essai rejoué avant chaque fiche ; la mémoire du Fake survivant au rejeu, les remboursements se comptent par
différence avec un relevé pris juste avant le geste. Deux manœuvres base consignées (ADM-REM-5, 6 : un autre
remboursement simulé entre la proposition et l'application). **Contre-épreuve** : ADM-REM-2 et ADM-REM-4 rejouées contre
deal-service et notification-service construits depuis `5b35ef9` (worktree séparé, écran corrigé) — **rouges** toutes
les deux, sur les trois anomalies. Après correction : 6/6 verts, deux passages.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-REM-1 | Proposer (Finance) | **Conforme** — texte exact et plafond = payé − déjà remboursé ; au-dessus du plafond, « Proposer » inactif et message « Au-dessus du plafond : … au plus. » (amélioration), appel direct → 400 « At most n cents can still be refunded… » ; motif court → bouton inactif, compteur `n / 50` ; motif valide → « Remboursement proposé, en attente d'un super administrateur. (5,00 €) » ; rechargement → bandeau « Proposé : 5,00 € par … le … — motif » ; file `PROPOSED_REFUNDS` = [ce deal], 500 ; `/admin/kpis.manualRefundProposals` = 1 ; aucun « Rembourser maintenant » pour Finance ni Support ; journal `REFUND_MANUAL_PROPOSED BOOKING · id`, `after { amountCents: 500, reason }` |
| ADM-REM-2 | Appliquer (super administrateur) | **Conforme après correction** — formulaire prérempli « 5,00 » ; « Rembourser maintenant » → 200, « Remboursé 5,00 € (cumul 5,00 €). L'Expéditeur est prévenu par email. Remboursement re_fake_… » ; fiche : cumul 500, `refundId` = celui rendu, proposition effacée, **versement du Voyageur identique** ; **un** remboursement de plus chez le fournisseur, **un** `booking.refund_issued` ; portefeuille de Mai `PARTIALLY_REFUNDED` « Remboursé 5,00 € le 14 sept. · 34,20 € ont réglé ton envoi » ; ✉ « Remboursement émis pour ton envoi Paris → Brazzaville » avec 5,00 €, sans « retenue » ni « Annulation à moins de 48 h », sans le montant du Voyageur ; chronologie : `booking.refund_issued` ; journal `REFUND_MANUAL_APPLIED { amountCents, totalRefundedCents, refundId, reason }`. **Avant** (contre-épreuve) : portefeuille « retenue 34,20 € reversée au Voyageur » (ANO-ADM-36), email « Annulation à moins de 48 h du départ : une retenue de 34,20 € s'applique… Elle revient au Voyageur » (ANO-ADM-35) |
| ADM-REM-3 | Finance applique par appel direct | **Conforme** — 403 `ADMIN_PERMISSION_DENIED` ; paiement en base identique ; aucun remboursement de plus chez le fournisseur ; aucune ligne de journal |
| ADM-REM-4 (ajoutée) | Trois « Rembourser maintenant » simultanés | **Conforme après correction** — `200 re_fake_… · 409 DECISION_IN_PROGRESS · 409 DECISION_IN_PROGRESS` ; **un** remboursement chez le fournisseur ; cumul 700 ; un événement, une ligne de journal. **Avant** : `200 · 409 TRANSITION_NOT_ALLOWED · 409 TRANSITION_NOT_ALLOWED` et **3 remboursements chez le fournisseur** pour un seul en base (ANO-ADM-34) |
| ADM-REM-5 (ajoutée) | Proposition devenue impossible | **Conforme après amélioration** — proposition 30,00 €, puis 20,00 € remboursés ailleurs (manœuvre base) : fiche `stale: true`, bandeau rouge « caduque : elle dépasse ce qui reste remboursable (il reste 19,20 €). Ne l'applique pas telle quelle. » ; appel au montant proposé → 400 `REFUND_ABOVE_MAX`, rien d'émis ; badge « caduque » dans la file |
| ADM-REM-6 (ajoutée) | Saisie à la française et écran périmé | **Conforme après amélioration** — « 1 234,50 » lu 1 234,50 € → « Au-dessus du plafond » ; « douze » → « Montant illisible : écris par exemple 12,50. » ; « 12,50 » accepté ; deal remboursé en totalité sous l'écran (manœuvre base) puis clic → « Plus aucun remboursement manuel possible sur ce deal (déjà remboursé en totalité, ou deal pas fermé). Rien n'a été émis ; la fiche est rechargée. », jamais « 400 : … » ; la fiche rechargée n'offre plus le geste ; rien d'émis |

### Anomalies

- **ANO-ADM-34 (bloquante, close — A165)** — **trois clics simultanés, trois remboursements.** `applyManualRefund`
  (`apps/deal-service/src/services/admin-finance.service.ts`) lit les bornes, appelle `provider.refund` **puis** écrit le
  cumul sous condition (`refundAmountCents` inchangé). Trois requêtes lisent le même état, passent toutes les bornes et
  émettent toutes leur remboursement ; une seule écriture réussit, les deux autres répondent 409
  `TRANSITION_NOT_ALLOWED` — l'argent est parti, la base ne le sait pas, l'écran dit « refus ». Le verrou conditionnel
  protégeait la base, pas l'argent. Mesurée en contre-épreuve (3 remboursements Fake pour 1 en base). Correction : verrou
  de décision du deal (A159) avant toute lecture, `DECISION_IN_PROGRESS` au perdant, échec fermé sans verrou ; clé
  d'idempotence fournisseur sur **tous** les remboursements (manuel, annulation, refus au pickup, médiation, restitution
  de retenue, retour de capture).
- **ANO-ADM-35 (majeure, close)** — **l'email d'un geste commercial annonçait une annulation tardive et une retenue.**
  `buildBookingEmail` (`apps/notification-service/src/emails/booking-emails.ts`) posait `retainedForCarrier` dès que le
  montant remboursé était inférieur au total : « Annulation à moins de 48 h du départ : une retenue de 34,20 € s'applique…
  Elle revient au Voyageur » à une Expéditrice dont l'envoi avait été livré. Correction : acteur `ADMIN` →
  `commercialGesture: true`, pas de retenue ; paragraphe « C'est un geste de l'équipe Yamba sur ton envoi. Il ne change
  rien pour le Voyageur, et ton envoi reste réglé. » (FR/EN).
- **ANO-ADM-36 (majeure, close)** — **le portefeuille de l'Expéditeur appelait « retenue reversée au Voyageur » tout
  remboursement partiel après la fin du deal** (geste commercial, médiation partielle) : `toPaymentItem`
  (`apps/deal-service/src/services/wallet.service.ts`) réutilisait le calcul de l'annulation tardive. Correction :
  `partialKind` (`LATE_CANCELLATION` | `AFTER_COMPLETION`) et `keptCents` au contrat ; `retentionCents` n'existe plus que
  pour l'annulation tardive ; libellé « Remboursé {montant} le {date} · {gardé} ont réglé ton envoi » ; « Dépensé » compte
  la part gardée. Clôt aussi l'observation « la ligne Finances d'un remboursement de médiation parle de retenue ».

### Écarts documentaires

- **Étape 3** : l'écran ne laisse pas cliquer « Proposer » au-dessus du plafond (bouton inactif, raison écrite) ; le 400
  « At most n cents… » du cahier est prouvé par appel direct.
- **Étape 7, tuile d'accueil** : lue par `/admin/kpis` (même définition de file, A161), pas à l'écran `/home`.
- **Messages** : le succès d'application nomme en plus l'identifiant du remboursement ; celui de la proposition, le montant
  et, le cas échéant, la proposition remplacée. Le cahier ne dit rien d'un second clic simultané : fiches REM-4 à 6 à
  ajouter au cahier.

### Regard d'expert — produit ET test, une ligne par fiche

- **REM-1** — *Fait* : raison du refus sous le montant, compteur de motif, avertissement « en proposer une autre la
  remplace (l'ancienne reste au journal) ». *Proposé* : historique des propositions remplacées dans la fiche (aujourd'hui
  au seul journal) — petit.
- **REM-2** — *Fait* : ANO-ADM-35, ANO-ADM-36, identifiant du remboursement dans le message, rappel « le motif reste au
  journal, il ne lui est pas envoyé ». *À trancher* : faut-il dire à l'Expéditeur **pourquoi** il est remboursé (motif
  libre = risque de fuite interne ; une liste de motifs publics serait plus sûre).
- **REM-3** — *Constat* : conforme d'emblée. *Test* : rien à faire.
- **REM-4** — *Fait* : ANO-ADM-34, A165, garde de double clic synchrone (`useRef`). *Proposé* : `commercialGesture` repose
  sur `actor === "ADMIN"` — seul le remboursement manuel émet aujourd'hui `refund_issued` en acteur ADMIN ; un champ
  explicite `refundKind` dans l'événement éviterait qu'un futur geste admin hérite du texte — moyen.
- **REM-5** — *Fait* : caducité servie par le serveur (fiche + file). *À trancher* : effacer automatiquement une
  proposition caduque, ou exiger une nouvelle proposition (aujourd'hui elle reste visible, marquée).
- **REM-6** — *Fait* : `parseEurosToCents` partagé avec la décision de médiation, lecteur de refus par code
  (`manualRefundRefusal`) qui recharge la fiche quand l'état a changé et ne promet pas « rien n'est parti » sur une
  erreur inconnue. *Test* : fiche ajoutée.
- **Transversal** — *Test* : la contre-épreuve a exigé un worktree à l'état précédent (écraser le répertoire de travail
  est refusé) ; le Fake honorant désormais les clés de remboursement, `_forgetIdempotencyKeysForTest` couvre aussi les
  remboursements. *Harnais* : WEB-CNF-10 recopie la table des libellés du portefeuille, cas `AFTER_COMPLETION` ajouté.

---

## Observations (pas des anomalies, mais à savoir)

- **`/become-yamber` reste « futur »** (commentaire du layout marketing) : la page de présentation
  « Devenir Voyageur » n'existe pas ; depuis ANO-WEB-11, ses quatre entrées mènent à l'onboarding.
  Le jour où la page marketing s'écrit, les liens y reviennent.

- **Depuis ANO-WEB-05, le cron de rejeu des versements paie les deals terminés du seed restés
  « en attente »** (ils portent désormais `capturedAt`) : c'est le comportement réel du produit,
  mais un deal du seed qui devait montrer « À venir » dans le Portefeuille passe « Parti » à
  l'heure suivante, et son email « … en route vers ton compte » arrive au Voyageur en plein
  parcours (WEB-E2E-1 étape 25 vise désormais le montant de SON deal). À garder en tête pour le
  chapitre 5.26 : rejouer le seed juste avant.
- **L'assistant de réservation garde son brouillon et son étape en `sessionStorage`** : après
  un refus à l'étape 4, rouvrir `/trips/[id]/book` rouvre directement l'étape 4 avec l'ancien
  colis. Pratique pour un membre qui revient ; à connaître pour la recette (le harnais oublie le
  brouillon à l'ouverture). Chapitre 5.12.
- **Après un refus de plafond, la carte de paiement montre encore un bouton « Payer »** à côté
  de l'encadré de refus. Il ne mène nulle part de dangereux (le serveur refuse aussi le deal),
  mais il contredit l'encadré. Mineure, chapitre 5.13 → **`ANO-WEB-40`, close** (le bouton est
  grisé tant qu'aucune autorisation n'existe — ce qui règle aussi l'observation suivante).
- **« Payer » cliqué avant le retour de l'intention de paiement ne fait rien**, sans message :
  le bouton est actif dès l'affichage de l'étape 4, l'intention arrive une seconde plus tard.
  Le harnais attend le texte du mode test (qui porte le montant de l'intention) ; un humain
  rapide obtiendrait un clic muet. Chapitre 5.12, avec l'observation sur le message générique.
- **La ligne « Annulée le {date} » de « Mes envois » affiche la date de la demande**, pas celle
  de l'annulation (`ShipmentRow` passe `requestedAt`). Mineure, chapitre 5.11.
- **Poste : `nx serve` s'arrête sur un changement de bibliothèque partagée.** La recompilation
  déclenchée par `api-contracts` a levé « Recursive task invocation detected » et trois
  services (trip, notification, message) sont restés arrêtés alors que webpack avait compilé.
  Ils tournent désormais en bundle (`node --env-file=../../.env dist/main.js`), comme la
  passerelle et deal-service ; consigné au handoff.
- **L'écran « Transaction close » ignore encore la médiation** (suite d'ANO-WEB-04, à
  arbitrer) : sous la ligne corrigée, « Tout est en ordre : le paiement de ton Voyageur est
  libéré », « Yamba verse à {prénom} le montant convenu pour ce transport » et, dans « Ton
  paiement », « Tu as confirmé la livraison — les fonds sont en cours de versement » — trois
  phrases fausses après un remboursement partiel. Proposition : quand `completedBy === "ADMIN"`,
  un sous-titre « La médiation a tranché : voir la décision ci-dessous. », une carte paiement
  « Remboursé {montant} · versé {montant} au Voyageur », et pas de carte « paiement libéré ».
- **La ligne Finances d'un remboursement de médiation parle de « retenue … reversée au
  Voyageur »** : un libellé conçu pour l'annulation tardive (`finances.state.PARTIALLY_REFUNDED`)
  réutilisé tel quel. Exact sur les montants, trompeur sur le mot. Même arbitrage de copie.
  → **close au § 5.15 du cahier 02-ADMIN (ANO-ADM-36)** : `partialKind: AFTER_COMPLETION`, libellé « {gardé} ont réglé
  ton envoi ».
- **Deux formulaires de connexion coexistent dans le DOM** dès qu'une fenêtre de connexion est
  montée, avec les **mêmes identifiants** `#email` et `#password`. C'est un défaut de validité
  HTML (un `id` est unique dans un document) et une gêne pour l'accessibilité : un `label
  for="email"` ne désigne plus un champ unique. Le harnais contourne en visant le formulaire de
  la page. À reprendre dans le chapitre 5.31 (accessibilité).
- **Le Payment Element de Stripe ne se monte pas sur l'origine du poste de recette.**
  `http://192.168.1.155:3000` n'est pas une origine sécurisée ; Stripe.js n'y monte pas ses
  `iframe`. Conséquence observée : le bouton « Payer 32,20 € » reste cliquable et **ne fait
  rien** — `useBookingCheckout` constate qu'aucune fonction de confirmation n'a été enregistrée,
  affiche un message générique et sort. Ce n'est pas un défaut du produit (l'origine est une
  contrainte du poste), mais **le message mériterait de nommer la cause** : « le module de
  paiement n'a pas pu se charger » plutôt qu'une erreur générique. À reprendre au chapitre 5.12.
- **Le limiteur de débit de la passerelle et le harnais — réglé en deux temps.** (1) Chaque
  navigateur ouvrait une vraie session par l'écran ; au bout de quelques exécutions
  `POST /api/auth/login` répondait **429**. Le harnais **mémorise désormais les sessions**
  (`storageState`, `apps/e2e/.sessions/`, jamais versionné) : une connexion par compte, sondée
  avant réutilisation, rendue à la fermeture (le rafraîchissement fait une rotation du `jti`).
  (2) Cela n'a pas suffi : le plafond **anonyme** (100 requêtes réussies par quart d'heure et
  par adresse) était épuisé par les seuls **visiteurs** des parcours — page du trajet, porte de
  réservation, suivi destinataire, profil public — après trois exécutions. Le plafond est
  désormais **surchargeable par l'environnement** (`RATE_LIMIT_ANONYMOUS_MAX`,
  `RATE_LIMIT_AUTHENTICATED_MAX`, défauts inchangés, poste de recette seulement).
  **Point d'attention produit**, hors harnais : 100 requêtes anonymes par quart d'heure et par
  adresse IP, c'est une trentaine de pages de trajet ; derrière un NAT partagé (bureau, réseau
  mobile en CGNAT) plusieurs visiteurs partagent une adresse. À observer sur les premiers
  chiffres réels avant de toucher au défaut.
- **Les comptes du seed n'avaient pas de profil public.** `publicSlug` (page `/u/[slug]`) est
  posé à l'inscription pour tout nouveau membre, mais les comptes du seed lui sont antérieurs et
  `seed-deals.ts` ne le posait qu'à la CRÉATION : `/fr/u/seed-thomas` répondait « Profil
  introuvable ». Le seed pose désormais `seed-<clé>` à chaque rejeu. Le cahier (§ 2.3) et le
  chapitre 5.24 supposent ces adresses.
- **Le refus de révélation anticipée du numéro est un 400 `TOO_EARLY`**, pas un 403 : le
  serveur le traite comme une validation (le moment n'est pas venu), avec un code que le client
  reçoit. Cohérent avec A146 ; noté ici parce que l'exploration du code l'avait d'abord lu 403.
- **L'annonce « ta session a expiré » ne survient que si la session meurt pendant que la page est
  ouverte.** Au rechargement d'une page dont la session est déjà morte, l'événement part avant
  que l'écran n'ait posé son écoute : l'utilisateur voit simplement l'interface déconnectée.
  Comportement acceptable, mais non documenté — et il explique pourquoi le scénario « je reviens
  le lendemain » ne montre jamais la fenêtre.
- **Deux lignes rouges 401 dans la console de tout visiteur** (`/auth/me` puis
  `/auth/refresh`) à chaque page : c'est le front qui demande « qui suis-je ? ». Depuis
  ANO-WEB-01, un marqueur `yamba:session` distingue le membre du visiteur ; il permettrait de ne
  pas sonder quand il est absent — une requête de moins par page, et une console propre.
  Chapitre 5.3.
- **Quatre `role="dialog" aria-modal="true"` vivent en permanence dans le DOM** (les feuilles de
  la recherche mobile : « Modifier la recherche », « Départ », « Destination », « Quand
  partez-vous ? »), montées fermées et masquées par CSS (`translateX(100%)`, `md:hidden`).
  Masquées visuellement, pas pour l'arbre d'accessibilité sur mobile (`aria-hidden` absent) : un
  lecteur d'écran peut y entrer. Chapitre 5.31.
- **Le cahier annonce « au moins les trois trajets Paris → Brazzaville » en WEB-ACC-9** ;
  `bzv-inflight` est parti (J−6) et la recherche ne montre que l'avenir : deux cartes. À corriger
  dans le cahier (§ 2.4 le dit déjà).
