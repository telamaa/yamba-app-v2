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

---

## Chapitre 5.12 — Réserver : l'assistant en quatre étapes

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| WEB-RSV — porte | La porte de la réservation, connecté ou non | **Conforme après correction** | → `ANO-WEB-02` ; les deux libellés sont lisibles en FR et en EN, et « Se connecter » ramène bien à la réservation |
| WEB-RSV — nominal | Les quatre étapes, de la description au paiement | **Conforme** | 2,5 kg de vêtements taille S sur `bzv-perkg` : transport **28,75 €**, service **3,45 €**, total **32,20 €** — exactement les montants du cahier. Le deal est créé (`201 POST /deals`), le suivi s'ouvre sur « En attente du Voyageur » |
| WEB-RSV — conditions du trajet | Le refus de famille et le supplément sont tenus par l'écran | **Conforme** | « Alimentaire sec & scellé ✕ » et « Électronique & appareils +20 % » sont affichés **avant** la saisie, comme le trajet les déclare (§ 2.4) |

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
  mais il contredit l'encadré. Mineure, chapitre 5.13.
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
