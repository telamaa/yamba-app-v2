# Handoff — recette navigateur (cahiers 01-WEB / 02-ADMIN) · 09/09/2026 (mis à jour le 10/09 soir — chapitre 5.2 clos)

*Ce document sert à REPRENDRE le chantier après une pause. Il dit où en est la campagne, ce qui
tourne sur le poste, ce qui reste à faire, et les pièges déjà payés qu'il ne faut pas repayer.*

> **CONSIGNE DE REPRISE (donnée le 09/09/2026).** Dans cet ordre, sans rien intercaler :
>
> **1.** ~~corriger le harnais avec `storageState`~~ **FAIT** (§ 4 bis) ;
> **2.** ~~monter la fixture de session administrateur~~ **FAIT** (`seed-admins.ts` + `navigateurAdmin`) ;
> **3.** ~~finir WEB-E2E-1 en entier, ouvrir la PR~~ **FAIT — PR #259 mergée** ;
> **4.** les cinq autres parcours du chapitre 6 : ~~E2E-2~~ **FAIT, #260 mergée**, ~~E2E-3~~ **FAIT, #261 mergée**, ~~E2E-4~~ **FAIT, PR #262** (17 checks verts, à merger), ~~E2E-5~~ **FAIT, PR #263** (empilée sur #262, ANO-WEB-10 close), ~~E2E-6~~ **FAIT, PR #264** (ANO-WEB-11 close) — **le chapitre 6 est clos** ;
> **5.** les 32 chapitres du cahier **01-WEB** (326 fiches) — **5.1 FAIT** (branche `chore/recette-web-5-1`, 12 fiches conformes, ANO-WEB-12 à 17 closes, **PR #265** sur `dev`, empilée sur #264) ; **5.2 FAIT** (branche `chore/recette-web-5-2`, 16 fiches : 12 conformes + 4 ⏭ Google, ANO-WEB-18 close, **PR #266** empilée sur #265) ; **5.3 FAIT** (branche `chore/recette-web-5-3`, 13 fiches + ANO-WEB-01, ANO-WEB-19 majeure OUVERTE, ANO-WEB-20 mineure close, **PR #267** empilée sur #266) ; **5.4 FAIT** (branche `chore/recette-web-5-4`, 6 fiches, aucune anomalie, **PR #268** empilée sur #267) ; **5.5 FAIT** (branche `chore/recette-web-5-5`, 10 fiches : 8 jouees + 2 skip, ANO-WEB-21 close, **PR #269** empilee sur #268) ; **5.6 FAIT** (branche `chore/recette-web-5-6`, 7 fiches : 4 jouees + 3 skip, aucune anomalie, **PR #270** empilee sur #269) ; **5.7 FAIT** (branche `chore/recette-web-5-7`, 21 fiches : 20 jouees + 1 skip Google, ANO-WEB-22 close (edition : dates derivees de `departureAt`), ANO-WEB-23 mineure OUVERTE (fuseau du navigateur, pas du lieu), **PR #272** empilee sur #270) ; **5.8 FAIT** (branche `chore/recette-web-5-8`, 6 fiches jouees, ANO-WEB-25/26 closes, ANO-WEB-24 mineure OUVERTE (pas de type de document), piege `apps/trip-service/.env` Gmail deplace, **PR #273** empilee sur #272) ; **5.9 FAIT** (branche `chore/recette-web-5-9`, 15 fiches jouees, ANO-WEB-27 BLOQUANTE close (next/image : hotes d'avatars), ANO-WEB-28 BLOQUANTE OUVERTE (index unique non epars sur Image → un seul avatar possible, test.fail), **PR #274** empilee sur #273) ; **5.10 FAIT** (branche `chore/recette-web-5-10`, 9 fiches jouees, ANO-WEB-29 mineure close (toast de suppression), effet des alertes prouve par Mailpit, **PR #275** empilee sur #274) ; **5.11 FAIT** (branche `chore/recette-web-5-11`, 12 fiches jouees, ANO-WEB-30/31/32 mineures closes (badge « Trajet passe », toast de desabonnement, trajet masque en favori), trip-service 261, **PR #276** empilee sur #275) ; **5.12 FAIT** (branche `chore/recette-web-5-12`, 21 fiches jouees + 1 skip FAKE, SEPT anomalies closes ANO-WEB-33 a 39 (assurance, poids vide, propre trajet, total non rafraichi, 0 €, trajet parti, photo > 10 Mo), **PR #277** empilee sur #276) ; **5.13 FAIT** (branche `chore/recette-web-5-13`, 5 fiches jouees, ANO-WEB-40 mineure close (« Payer » grise sans autorisation), levier OPS du plafond mensuel prouve en 6 s, **PR #278** empilee sur #277) ; **5.14 FAIT** (branche `chore/recette-web-5-14`, 9 fiches jouees, ANO-WEB-41 MAJEURE close (dates « 1 janv. » du tableau de bord), ANO-WEB-42 mineure close (lieu en double), ANO-WEB-44 MAJEURE close (destinataire « Hall »), ANO-WEB-43 mineure OUVERTE (DTO « {n} envois » / « Membre depuis »), PR empilee sur #278) ; suite : 5.15 -> 5.32 dans l'ordre du cahier ;
> **6.** le cahier **02-ADMIN** (110 fiches) — 19 fiches de sécurité d'accès, 91 fiches d'écrans.
>
> **REPRISE DU 11/09/2026 — 5.3, 5.4 ET 5.5 CLOS.** Trois chapitres ajoutes le 11/09, chacun sa
> PR empilee : **5.3 WEB-CNX** (PR #267, 13 fiches ; ANO-WEB-19 MAJEURE OUVERTE = pas de verrou
> anti-force-brute sur la connexion par mot de passe, fiche WEB-CNX-4 en `test.fail`, correctif
> = mecanique OTP en PR dediee ; ANO-WEB-20 close), **5.4 WEB-MDP** (PR #268, 6 fiches, aucune
> anomalie, comptes neufs jetables), **5.5 WEB-PRO** (PR #269, 8 fiches + 2 skip ; ANO-WEB-21
> close = banniere « masquee » du proprietaire). Rapport, docs cumulatifs, CONTEXT, SUIVI
> (harnais **76 scenarios**) a jour. **5.6 WEB-VOY CLOS** (PR #270 : 4 jouees + 3 skip, aucune anomalie ; Stripe : VOY-4 prouve le vrai lien Connect + redirection stripe.com ; completer un compte EXPRESS n'est pas automatisable, VOY-5/7 manuels — procedure au rapport). **5.7 WEB-TRJ CLOS** (PR #272 : 20 jouees + 1 skip Google ; le wizard est eprouve EN EDITION `?edit=<id>` sur des brouillons crees par l'API ; ANO-WEB-22 close = le mapper inverse ne relisait que les chaines locales du wizard, repli sur `departureAt` ; ANO-WEB-23 OUVERTE = le wizard n'envoie aucun fuseau, `departureAt` dans le fuseau du navigateur, proposition fuseau derive cote serveur, PR dediee ; D72 verifie a l'ecran). Harnais **88 scenarios** (`playwright --list`). **5.8 WEB-DOC CLOS** (PR #273 : 6 jouees ; ImageKit intercepte, admin SUPPORT par l'API, Mailpit ; ANO-WEB-26 close = refus > 5 Mo muet (`reset()`), ANO-WEB-25 close = limite de 5 dite, ANO-WEB-24 OUVERTE = aucun type de document a l'ecran). **PIEGE PAYE : `apps/trip-service/.env` (reliquat, SMTP Gmail reel) faisait partir les emails de trip-service par Gmail et l'echec etait avale — fichier deplace dans `~/.yamba-leftovers/`, `emailCarrier` journalise, et `nx run-many` DOIT etre relance apres (le parent reinjecte l'env du projet a chaque redemarrage d'un enfant). Verifier a chaque reprise : `ls apps/*/.env` vide, et `ps eww -p $(lsof -nP -iTCP:6002 -sTCP:LISTEN -t) | tr ' ' '\n' | grep SMTP_HOST` = localhost.** Harnais **94 scenarios**. **5.9 WEB-RCH CLOS** (PR #274 : 15 jouees ; recherches posees par le brouillon `sessionStorage` de la barre, sans Google ; ANO-WEB-27 close = `next.config.js` sans `images.remotePatterns`, la page tombait sur un avatar ImageKit ; ANO-WEB-28 OUVERTE = `Image.carrierPageId? @unique` non epars → second avatar 500 P2002, scinder le modele, candidat registre). L'utilisateur precise (11/09) que la RECHERCHE et l'ACCUEIL sont des chantiers non termines : les ecarts « a trancher » du rapport les alimentent. CONSIGNE NOUVELLE (11/09) : pour CHAQUE fiche, une ligne « regard d'expert — optimisations et ameliorations » au rapport (section dediee, effort petit/moyen/chantier). Harnais **110 scenarios**. **5.10 WEB-ALR CLOS** (PR #275 : 9 jouees ; alertes par l'API, effet prouve par Mailpit — exclusion du Voyageur, anti-spam 24 h, proches < 50 km ; ANO-WEB-29 close = toast « Alerte supprimee » jamais affiche, callbacks `mutate` perdus par la suppression optimiste, retours au niveau du hook). Harnais **119 scenarios**. **5.11 WEB-FAV CLOS** (PR #276 : 12 jouees ; geste du coeur repris apres connexion dans la fenetre, suivi + email d'abonne prouve par Mailpit ; ANO-WEB-30 close = `departureAt` ISO sur la carte de recherche + badge « Trajet passe » ; ANO-WEB-31 close = toast de desabonnement (meme motif qu'ANO-WEB-29) ; ANO-WEB-32 close = un trajet masque par Yamba ne se met plus en favori, +1 test trip-service = 261). ATTENTION plateforme de tests : **994** (trip 261). Harnais **131 scenarios**. **5.12 WEB-RSV CLOS** (PR #277 : 21 jouees + 1 skip ; devis exact au centime ; sept anomalies de BRANCHEMENT corrigees — ANO-WEB-33 « assurance », 34 poids vide (`buildInitialDraft` sans appelant), 35/38 propre trajet et trajet parti refuses a l'ouverture, 36 trajet relu apres QUOTE_DIVERGENCE, 37 jamais « 0 € », 39 photo > 10 Mo refusee a la selection). A trancher : format des montants (« 8 € », point decimal « 15.5 kg »). Harnais **143 scenarios**. **5.13 WEB-TRU CLOS** (5 jouees, 2 min 00 ; compte neuf cree par l'ecran en fiche 1 ; refus A L'INTENTION, 250 € / 8 kg passent ; levier [TRU7] : l'OPS releve `trust.newAccount.maxShipmentsPerMonth` 5 -> 6, « Reessayer » toutes les 5 s, effet en 6 s, remis dans un finally ; Aminata 12 kg / 450 € sans refus ; aucune fuite du score : 5 ecrans + 3 reponses d'API brutes + export ; ANO-WEB-40 close = « Payer » actif a cote du refus et avant l'intention, `ctaDisabled` dans les deux wizards). Harnais **148 scenarios**. PIEGE : `--reporter=list` remplace le rapport HTML et perd les annotations. Poste redemarre seul le 11/09 (13 h 30) : Docker relance, dix-sept conteneurs etrangers arretes, `apps/user-ui/.env` (reliquat du 13/05 avec DATABASE_URL, ignore par git) laisse en place. **5.14 WEB-DEA CLOS** (9 jouees, 2 min 20 ; demandes creees par l'assistant ; accueil / Mes trajets / cloche ; ecran de la demande (net seul, puce ambre -> rouge + role=alert par manoeuvre `scripts/recette/deal-eligible.ts <id> 90`) ; Charte ; acceptation ; refus ; expiration (`deal-eligible.ts <id> -1500` puis `scripts/recette/expire.ts`, preuve = `status: EXPIRED` relu par l'API — la sortie du script ne se lit pas de facon fiable) ; deux onglets (figer la lecture de l'onglet 2 par `page.route`, TanStack relit au focus) ; etats fermes (pas de `heading`) ; Mon Deal accepte. ANO-WEB-41 MAJEURE close = `TripListItem` sans `departureAt` -> « jeu. 1 janv. » partout, `trip-local-dates.ts` dans useMyTrips/useTrip ; ANO-WEB-42 mineure close = lieu en double + mention telephone jamais affichee (deal.adapter) ; ANO-WEB-44 MAJEURE close = destinataire « Hall » (`split(" ")[0]` sur le lieu ; `recipientFirstName` toujours servi) ; ANO-WEB-43 OUVERTE = DTO Voyageur sans `shipmentCount` / `memberSince` (PR dediee). PIEGES : toute la ligne « A traiter » est un lien ; `innerText` en capitales (`text-transform`) ; puce visee par libelle + `xpath=..` ; vignettes photo = boutons (image interceptee non chargee). POSTE : la cible `nx typecheck` des DEUX fronts Next a disparu en cours de session (services intacts, `nx reset` sans effet) — la CI lance `tsc -p apps/user-ui` : utiliser `npx tsc --noEmit -p apps/user-ui/tsconfig.json`. Harnais **157 scenarios**. **Prochaine etape : le chapitre 5.15 (`WEB-MSG`, messagerie, rendez-vous et numero de telephone)**. Puis 5.16 -> 5.32, puis 02-ADMIN. Front user-ui redemarre apres `next.config.js` (la config n'est pas rechargee a chaud). Poste redemarre sans prevenir le 11/09 (10 h) : Docker Desktop relance (`open -a Docker`), les dix-sept conteneurs etrangers arretes, `yamba-redpanda` + `yamba-mailpit` seuls, cinq services par `nx run-many`, deal-service en bundle FAKE, les deux fronts par `nx dev` — reprise en dix minutes. La pile se relance comme au § 2 (arreter les dix-sept
> conteneurs des autres projets, ne garder que `yamba-redpanda` et `yamba-mailpit`). Comptes
> `neuf-<horodatage>@recette.yamba.dev` laisses en base (piege 22). Nouveau `clear-sudo-locks.ts`
> pour purger les verrous OTP sudo entre deux executions. Toujours AUCUNE attribution Claude.

> **La question Elasticsearch vient APRÈS la recette** — consigne explicite du 09/09/2026. Rien
> ne se touche du côté de la recherche tant que les deux cahiers ne sont pas clos. L'analyse est
> prête au § 8 (réponse proposée : **non**, avec une correction ciblée et Atlas Search comme voie
> de sortie) ; elle attend son tour. Autre sujet produit ouvert le 09/09, **également après la
> recette** : rendre la demande visible aux Voyageurs (§ 9).

---

## 1. Où en est la journée

| Livraison | État |
|---|---|
| **Cahier n° 4 — tâches planifiées** (90 fiches) | **CLOS.** 9 anomalies, 9 closes. PR **#256** + docs **#257**, mergées. Décisions **D76** et **D77** gravées au registre. Rapport : `context/YAMBA-RECETTE-CRONS-RESULTATS.md` |
| **Harnais de recette navigateur** (Playwright) | **MERGÉ** — PR **#258**. Avec `ANO-WEB-01` (bloquante) et `ANO-WEB-02` (majeure), toutes deux closes |
| **Chapitres 5.x du cahier 01-WEB** | **5.1 CONFORME** (12 fiches, 1 min 24) — branche `chore/recette-web-5-1`, six anomalies trouvées et closes : `ANO-WEB-12` (bloquante : « Rechercher » de l'accueil ne faisait rien), `ANO-WEB-13` (bloquante : une ville choisie dans la liste donnait zéro résultat), `ANO-WEB-14` (majeure : première liste de suggestions perdue), `ANO-WEB-15` à `17` (mineures : réseaux sociaux actifs, `lang` faux sur `/en`, `main` imbriqué). Une décision produit à trancher : l'en-tête desktop du visiteur (« Créer un compte », « Rechercher un trajet »). **5.2 CONFORME** (16 fiches : 12 jouées + 4 ⏭ Google) — branche `chore/recette-web-5-2`, `ANO-WEB-18` (mineure : « Connectez-vous » vouvoyait) close ; trois écarts de cahier à trancher (adresse masquée sur l'écran du code, ordre « minuscule » / « date », titre « Deviens Voyageur ») ; nouveau `inspect-user.ts` pour les preuves en base. Suite : 5.3 |
| **Parcours transactionnels** | **#259 MERGÉ** (WEB-E2E-1) · **#260 MERGÉ** (WEB-E2E-2, ANO-WEB-04, ANO-WEB-05) · **#261 MERGÉ** (WEB-E2E-3, ANO-WEB-06 ; ANO-WEB-07 tranchée) · **PR #262 ouverte, 17/17 verts** (WEB-E2E-4, ANO-WEB-08, ANO-WEB-09 closes) · **PR #263 ouverte** (WEB-E2E-5, 8 étapes, 1 min 06, ANO-WEB-10 close — la réputation comptait le refus au pickup comme une annulation tardive) · #259 : WEB-E2E-1 passe **en entier** (29 étapes, 1 min 24), sessions mémorisées, fixture admin, `ANO-WEB-03` (majeure) close, 15 scénarios verts en 3 min 06 |

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

# 2. Les six services — `npm run dev` ne lance QUE les services (nx run-many serve), pas les fronts
npm run dev                            # NX_SKIP_NX_CACHE=true npm run dev après un changement de code serveur
npx nx dev user-ui                     # port 3000
npx nx dev admin-ui                    # port 3001 — indispensable à navigateurAdmin()

# 3. POUR LES PARCOURS SEULEMENT — deal-service avec le fournisseur de paiement FAKE
#    (voir § 4 : le Payment Element de Stripe ne se monte pas sur l'origine du poste)
kill -9 $(lsof -nP -iTCP:6003 -sTCP:LISTEN -t)
cd apps/deal-service && STRIPE_SECRET_KEY= node --env-file=../../.env dist/main.js

# 4. Le plafond anonyme du limiteur (§ 4 bis) : RATE_LIMIT_ANONYMOUS_MAX=2000 est dans le .env du
#    poste ; `nx serve` lit le .env au LANCEMENT — après l'avoir ajouté, relancer la passerelle
#    (ou la faire tourner en bundle comme deal-service) :
kill -9 $(lsof -nP -iTCP:8080 -sTCP:LISTEN -t)
cd apps/api-gateway && node --env-file=../../.env dist/main.js

# 4 bis. Si nx serve a laissé tomber trip / notification / message (piège 17), les relancer en bundle :
cd apps/trip-service && node --env-file=../../.env dist/main.js
cd apps/notification-service && node --env-file=../../.env dist/main.js
cd apps/message-service && node --env-file=../../.env dist/main.js

# 5. Les comptes du back-office (une fois, ou après un scénario qui les a abîmés)
npx tsx --env-file=.env packages/libs/prisma/scripts/seed-admins.ts
```

Vérification rapide : `bash scripts/smoke-services.sh`, puis `curl -s localhost:8080/api/status | jq`.

**Poste redémarré le 10/09 (matin)** : Docker Desktop était arrêté (`open -a Docker`, puis les deux
conteneurs) ; les cinq services par `nx run-many --target=serve --projects=api-gateway,auth-service,
trip-service,notification-service,message-service`, deal-service en bundle FAKE, les deux fronts par
`nx dev`. Le limiteur (`RATE_LIMIT_ANONYMOUS_MAX`) est lu du `.env` par `nx serve` : plus besoin de
la passerelle en bundle. La clé Google Maps n'accepte que `localhost` comme référent (piège 27).

**Le harnais** : `npx nx e2e e2e` (tout), ou
`npx playwright test --config=apps/e2e/playwright.config.ts src/parcours/web-e2e-1.spec.ts` (rejoue le seed dans son `beforeAll`).

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

Tout est **vert sur le poste** (15 scénarios, 3 min 06) et prêt pour la PR. Elle contient :

- **la mémoire des sessions** — `src/fixtures/sessions.ts` (`storageState` dans
  `apps/e2e/.sessions/`, ignoré), `src/fixtures/adresses.ts` (front / API / back-office déduits
  de la config du front), `navigateurConnecte(clé, { parEcran })` qui sonde, réutilise ou repasse
  par l'écran, et rend l'état à la fermeture ;
- **le navigateur du back-office** — `packages/libs/prisma/scripts/seed-admins.ts` (sept comptes du
  cahier 02-ADMIN promus et enrôlés, secrets TOTP dans `seed-admins-output.json`, ignoré),
  `COMPTES_ADMIN`, `jeuEssai.admin(clé)` / `rejouerAdmins()`, `navigateurAdmin(clé)` (mot de
  passe, puis code calculé par `packages/libs/totp`) ;
- **les objets de page** des étapes 11 à 29 : `fil-messagerie.ts`, `transport-voyageur.ts`,
  `suivi-expediteur.ts`, `suivi-destinataire.ts`, `notation.ts` ; plus `fixtures/photos.ts`
  (ImageKit interposé, `E2E_IMAGEKIT=real`) et `fixtures/presse-papiers.ts` ;
- **`src/parcours/web-e2e-1.spec.ts`** — les 29 étapes, seed rejoué en `beforeAll` ;
- `harnais.spec.ts` : six scénarios (connexion par l'écran, mémoire des sessions, back-office) ;
- **trois corrections hors harnais** : `ANO-WEB-03` (`Messages.tsx`), `publicSlug` à la mise à
  jour dans `seed-deals.ts`, et le plafond du limiteur surchargeable
  (`packages/middleware/rate-limit-tier.ts`, gateway, `.env.example`, 4 tests → auth-service 229) ;
- les documents : rapport de recette, les trois docs cumulatifs, contexte, suivi, CLAUDE.md.

**Ne PAS mettre dans la PR** : `apps/user-ui/AGENTS.md`, `apps/user-ui/CLAUDE.md`,
`apps/admin-ui/AGENTS.md`, `apps/admin-ui/CLAUDE.md` et `apps/admin-ui/next-env.d.ts` — Next 16
les génère au lancement de `nx dev`, ils ne sont pas à nous. Les laisser hors index.

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

## 4 bis. Le limiteur de débit — réglé, et ce qu'il a appris

Deux plafonds, pas un. **(1)** Les connexions par l'écran épuisaient le plafond anonyme sur
`POST /auth/login` : réglé par la mémoire des sessions. **(2)** Une fois les connexions
disparues, les seuls **visiteurs** des parcours (page du trajet, porte, `/track`, profil public,
tous anonymes) épuisaient encore les **100 requêtes par quart d'heure et par adresse** après
trois exécutions — symptôme : « Impossible de charger ce trajet », `RateLimit-Remaining: 0` sur
la passerelle. Réglé par `RATE_LIMIT_ANONYMOUS_MAX` (défaut inchangé en production). **Point
d'attention produit** noté au rapport : derrière un NAT partagé, 100 requêtes anonymes par quart
d'heure se partagent entre plusieurs visiteurs.

Pièges payés sur les étapes 11 à 29, pour ne pas les repayer :

8. **`navigator.clipboard` n'existe pas sur `http://192.168…`** (contexte non sécurisé), et Chrome
   refuse `grantPermissions` : le harnais interpose un presse-papiers en mémoire de page.
9. **Deux effets React qui posent le même état dans le même rendu : le dernier gagne** —
   c'était `ANO-WEB-03`. Quand un parcours ouvre « le mauvais écran », chercher l'effet concurrent.
10. **Un toast de 5 s est encore là quand le suivant arrive** : `.last()` sur les toasts de jalon.
11. **Le refus « trop tôt » du numéro est un 400 `TOO_EARLY`**, pas un 403 : lire le service,
    pas la cartographie.
12. **Les comptes du seed n'avaient pas de `publicSlug`** (antérieurs au profil public) : le seed
    le pose désormais à chaque rejeu.
13. **`npm run dev` ne lance pas les fronts.**
14. **Un correctif front qui ne prend pas : remonter à la vue de l'API.** Un DTO à whitelist
    stricte fait qu'un champ oublié n'arrive jamais — `completedBy` (ANO-WEB-04).
15. **deal-service tourne en bundle** : après un changement de son code, `npx nx build
    deal-service` puis relancer le bundle FAKE (§ 2), sinon l'ancien code répond.
16. **La décision de médiation est unique** (409 au second envoi) : rejouer le seed avant.
17. **`nx serve` tombe sur un changement de bibliothèque partagée** (« Recursive task invocation
    detected ») : trois services restent arrêtés alors que webpack a compilé. Les relancer en
    bundle : `cd apps/<service> && node --env-file=../../.env dist/main.js` (le `.env` porte les
    ports : `PORT` pour trip, `NOTIFICATION_SERVICE_PORT`, `MESSAGE_SERVICE_PORT`).
18. **« Payer » cliqué avant le retour de l'intention de paiement ne fait rien** : `payer()`
    attend le texte du mode test, puis la demande de réservation.
20. **L'assistant de réservation garde brouillon et étape en `sessionStorage`** : après un refus,
    il rouvre l'étape 4 — `ouvrir()` oublie le brouillon et recharge.
21. **Une session expirée se simule en deux gestes** : supprimer la clé Redis `refresh_jti:<userId>:*`
    (manœuvre) ET retirer le cookie `access_token` ; puis un clic qui appelle l'API.
22. **Un compte neuf par exécution** (`compte-neuf.ts`) : la base en garde un de plus à chaque
    passage — sans conséquence, mais à savoir pour les compteurs du back-office.
23. **Un « inchangé » ne prouve rien si rien n'a pu le changer.** L'étape 7 de E2E-5 (ligne de
    faits identique) passait AVANT correction : le refus ne recalculait pas la réputation. Devant
    un test vert du premier coup, chercher ce qui aurait dû pouvoir le faire échouer ; au besoin,
    prouver en base avec un script jetable (`npx tsx --env-file=.env ./x.ts`, puis le supprimer).
25. **Un `Link` Next navigue côté client** : `networkidle` se résout avant la navigation ; attendre
    `toHaveURL`. Et viser un libellé DANS son bloc — l'en-tête et le pied de page portent les
    mêmes mots (« Envoyer un colis », « Devenir Voyageur »).
26. **Ce qu'un cahier « connecté » ne voit jamais, c'est l'entrée du visiteur** : les bouchons
    `/become/*` ont survécu à toute la recette parce que 5.6 se joue avec João. Les parcours sans
    compte (destinataire, visiteur) sont ceux qui trouvent ces trous.
24. **Un modèle de lecture peut contredire la machine.** Un compteur qui filtre sur un statut
    d'arrivée (`CANCELLED` + `closedBy`) voit toutes les transitions qui y mènent — y compris
    celles que la machine déclare « sans pénalité ». À chaque transition ajoutée, relire les
    requêtes qui filtrent sur son statut.
27. **La clé Google Maps est restreinte par référent HTTP à `localhost`** : sur l'adresse LAN du
    poste, Places répond 403 « Requests from referer http://192.168.1.155:3000/ are blocked » et
    le champ de ville reste muet, sans message. Les fiches d'autocomplétion se jouent en visiteur
    (aucun cookie) : le harnais ouvre le même front par `localhost` (`ORIGINE_GOOGLE`,
    `E2E_GOOGLE_ORIGIN` pour un autre poste). Pour un téléphone, ajouter l'origine LAN à la clé.
28. **`fill()` ne déclenche pas l'autocomplétion** (aucune requête) ; `pressSequentially` oui. Et
    un `catch {}` vide cache le vrai défaut : instrumenter avant de conclure « Google ne répond
    pas » — c'était `importLibrary is not a function` (ANO-WEB-14).
29. **Un libellé visible peut exister deux fois dans le DOM** (en-tête et pied de page ont un arbre
    mobile ET un arbre desktop) : `filter({ visible: true })` avant `first()`. Et quatre
    `role="dialog" aria-modal` dorment dans chaque page (feuilles de la recherche mobile) : viser
    une porte par son NOM.
19. **Une manœuvre se joue là où le produit la lit** : le barème d'annulation lit le départ figé
    dans le deal — avancer le trajet APRÈS la réservation ne change rien. Sans `nx dev admin-ui`, `navigateurAdmin` attend
    un écran qui n'existe pas.

## 5. Ce qui reste à faire, dans l'ordre

1. ~~Ouvrir la PR de `chore/e2e-parcours`~~ **FAIT, #259.** Branche suivante : `chore/e2e-parcours-2`.

2. ~~E2E-2 (litige)~~ **FAIT, PR #260 mergée** — 19 étapes, 30 s, `ANO-WEB-04` et `ANO-WEB-05` closes.
   Branche suivante : `chore/e2e-parcours-3`. Deux arbitrages de
   copie à rendre (rapport, observations : l'écran « Transaction close » après médiation, la ligne
   Finances « retenue reversée »).

3. ~~E2E-3 (annulation tardive)~~ **FAIT** — 15 étapes, 38 s, `ANO-WEB-06` close, `ANO-WEB-07`
   tranchée le 09/09 : le message D72 renvoie vers « Mes trajets » (fait, branche
   `chore/e2e-parcours-4`) ; l'annulation d'un deal par le Voyageur = lot à part. **PR #261 mergée.**

   ~~E2E-4 (compte neuf)~~ **FAIT** — 14 étapes, 1 min 06, `ANO-WEB-08` et `ANO-WEB-09` closes,
   message D72 corrigé. **PR #262 ouverte, 17 checks verts** : la merger (la fusion par le harnais
   a été refusée par le classifieur du poste — `gh pr merge 262 --merge` à la main).

   ~~E2E-5 (refus au pickup)~~ **FAIT** — 8 étapes, 1 min 06, `ANO-WEB-10` close (majeure : la
   réputation comptait tout refus au pickup comme une annulation tardive au prochain recalcul ;
   marque `Booking.pickupRefusedAt`, requête qui l'exclut, refus qui recalcule). Branche
   `chore/e2e-parcours-5`, empilée sur `chore/e2e-parcours-4` : **PR #263 ouverte sur `dev`**
   (la CI ne tourne que sur les PR vers `dev` / `main` : une base intermédiaire donnait 0 check).
   Son diff porte les deux parcours tant que #262 n'est pas mergée, et se réduit seul après.
   Merger #262 d'abord, puis compter les 17 checks de #263 et la merger.

   ~~E2E-6 (destinataire)~~ **FAIT** — 9 étapes, 1 min 00, `ANO-WEB-11` close (majeure : quatre
   entrées « Devenir Voyageur » menaient à un bouchon « Become a carrier (UI only) » ou à un 404).
   Branche `chore/e2e-parcours-6`, empilée sur `chore/e2e-parcours-5` : **PR #264 ouverte sur
   `dev`**. Merger dans l'ordre #262, #263, #264 (chaque diff se réduit seul). **Le chapitre 6 est
   clos.** Suite : les 32 chapitres 5.x du cahier 01-WEB, par famille (point 4 ci-dessous).

4. **Les 32 chapitres 5.x du cahier 01-WEB** (326 fiches), par famille. ~~5.1~~ **FAIT** (`chore/recette-web-5-1`,
   `apps/e2e/src/chapitres/web-acc.spec.ts`, rapport « Chapitre 5.1 », **PR #265** sur `dev`, empilée sur #264 —
   merger dans l'ordre #262, #263, #264, #265) — suivant : **5.2 `WEB-INS`** (inscription,
   16 fiches : `compte-neuf.ts` et `pages/inscription.ts` existent déjà). Huit d'entre eux
   s'appuient sur le back-office (tableau du handoff précédent : suspendre, masquer, valider un
   billet, abaisser un paramètre, relire les signalés, ouvrir l'arbitrage, maintenance) — la
   fixture est prête.

5. **Le cahier 02-ADMIN** (110 fiches) : 19 fiches de sécurité d'accès (le premier enrôlement
   `ADM-SEC-2` se joue sur un compte remis à neuf par `grant-admin.ts --revoke` puis une nouvelle
   attribution — le seed enrôle les sept), 91 fiches d'écrans.

## 6. Observations à traiter un jour

- Le message d'erreur quand le module de paiement ne se charge pas est **générique** : il devrait
  nommer la cause. Chapitre 5.12.
- **100 requêtes anonymes par quart d'heure et par adresse IP** (défaut du limiteur) : une
  trentaine de pages de trajet. À regarder sur les premiers chiffres réels — derrière un NAT
  partagé (bureau, CGNAT mobile), plusieurs visiteurs partagent une adresse.
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

---

## 9. Rendre la demande visible aux Voyageurs — avis du 09/09/2026 (après la recette)

Question posée : permettre aux Expéditeurs de publier une « intention d'envoi » (villes, kilos,
période) pour inciter un Voyageur hésitant à publier un trajet, avec un cron d'appariement.

**Avis : le besoin est réel, la forme publique est trop lourde.** La moitié « Expéditeur » existe
déjà : `SavedRoute` (corridor, période, appariement à trois niveaux, email anti-spam) — il lui
manque un champ `weightKg`. Ce qui manque, c'est la moitié « Voyageur », et elle ne demande pas
un nouvel objet métier : **la demande agrégée et anonyme**, à trois endroits — une page publique
« corridors demandés » (« Paris → Brazzaville : 12 Expéditeurs en attente en octobre, 35 kg »),
l'assistant de publication du trajet (« 12 Expéditeurs ont une alerte sur ce corridor à ces
dates »), et l'après-publication (« ton trajet a été envoyé à 12 Expéditeurs »). Un seuil
d'anonymat (≥ 2 ou 3 alertes) pour qu'une paire ville + dates ne désigne personne. Calcul depuis
les alertes actives, cache Redis 60 s comme le pilotage. L'annonce publique individuelle
apporterait peu de plus et coûterait la modération du contenu et le contact hors plateforme
(D61 n'ouvre la conversation qu'à ACCEPTED précisément pour cela). **Candidat au registre,
après la recette.**

