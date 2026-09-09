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

---

## Observations (pas des anomalies, mais à savoir)

- **Depuis ANO-WEB-05, le cron de rejeu des versements paie les deals terminés du seed restés
  « en attente »** (ils portent désormais `capturedAt`) : c'est le comportement réel du produit,
  mais un deal du seed qui devait montrer « À venir » dans le Portefeuille passe « Parti » à
  l'heure suivante, et son email « … en route vers ton compte » arrive au Voyageur en plein
  parcours (WEB-E2E-1 étape 25 vise désormais le montant de SON deal). À garder en tête pour le
  chapitre 5.26 : rejouer le seed juste avant.
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
