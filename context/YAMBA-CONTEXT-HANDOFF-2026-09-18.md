# Handoff — 18/09/2026 · la passe cahiers est close, les quatre cahiers disent le code

*Ce document sert à REPRENDRE le chantier après une pause. Il dit où en est le dépôt, ce qui a été décidé, ce qui
reste, et les pièges payés qu'il ne faut pas repayer. Il remplace, comme point d'entrée, le handoff du 17/09 —
qui reste la mémoire de la dette de concurrence et du dossier d'arbitrages.*

---

## 1. L'état du dépôt, en une ligne

**Tout est dans `dev`. Zéro PR ouverte.** `dev` = `61df9d3`, CI **verte** (17 checks comptés, pas seulement leur
couleur, sur chacune des trois PR du jour).

| Repère | Valeur |
|---|---|
| PR mergées | #1 → **#347** (le 18/09 : #345, #346, #347) |
| Tests | trip **308** · deal **659** · notification **122** · message **79** · auth **395** — **1563** au total. **Inchangés** : la journée n'a touché aucun code |
| Registre | décisions D1 → D78 · arbitrages A1 → A199 — **aucune nouvelle** |
| Apprentissage | derniers chapitres **192, 193, 194** |
| Schéma Prisma | **inchangé** depuis le 16/09 |
| Cahiers de recette | les **quatre** sont à l'état du code (01-WEB, 02-ADMIN, 03-API, 04-CRONS) |

---

## 2. Ce qui a été fait le 18/09, et pourquoi

Une seule chose : la piste que le handoff du 17/09 laissait ouverte — *« les cahiers 01-WEB, 03-API et 04-CRONS
n'ont pas eu la passe du 02-ADMIN »*.

### La méthode, qui est le vrai livrable

Trois règles, et elles se sont toutes les trois révélées payantes :

1. **La source n'est pas le résumé.** Les écarts sont consignés **au fil des chapitres** dans les fichiers de
   résultats, pas dans le handoff. Sur le 02-ADMIN, le handoff en annonçait 3 pour 14. Le 18/09 : 1 pour **12**
   sur le 04-CRONS.
2. **Chaque écart est vérifié DANS LE CODE, jamais recopié.** Recopier propage l'état du *jour de la campagne*,
   pas l'état du code. C'est ce qui a permis d'en refermer deux (04-CRONS) et d'en rejeter un (03-API).
3. **La correction elle-même se vérifie.** Le premier jet d'une correction visait le mauvais trajet du jeu
   d'essai — rattrapé avant le commit, en comptant.

### Le compte, cahier par cahier

| PR | Cahier | Annoncé | Trouvé |
|---|---|---|---|
| **#345** | 04-CRONS | 1 écart (`DIV-3`) | **12** |
| **#346** | 03-API | 11 écarts | **9 reportés · 1 qui ne tient pas · 1 déjà fait · 2 nouveaux** |
| **#347** | 01-WEB | — (écarts **en ligne**, pas en sections) | **17 fiches + 11 étapes** de parcours |

### Les quatre trouvailles qui valent plus qu'une correction de texte

**(a) Un nom de fichier qui casse la CI.** Le 04-CRONS demandait de créer `scripts/recette-secret-audit.ts`. Le
contrôle `Anti-fuite (fichiers sensibles)` refuse **tout fichier suivi** dont le chemin contient `secret` :

```sh
git ls-files | grep -iE '(^|/)\.env($|\.)|secret|\.pem$|\.key$' | grep -vE '\.(example|template)$'
```

Le fichier réel s'appelle `audit-code-livraison.ts` pour cette raison — écrite jusqu'ici dans son **seul
en-tête**. Un contournement connu d'un seul développeur n'en est pas un.

**(b) Un outil de recette qui fabriquait la panne qu'il devait observer.** La commande `rpk topic produce` du
cahier, sans `-z none`, publie en **snappy** que kafkajs ne sait pas décompresser : c'est **elle** qui a provoqué
`ANO-CRON-08` (bloquante — consommateur arrêté définitivement, processus vivant, `/health` vert, plus une seule
notification sur la plateforme). Le défaut trouvé était réel et il est corrigé ; mais un poison de **transport**
et un poison de **contrat** ne s'éprouvent pas avec la même fiche.

**(c) Un contrat enseigné faux, par une fiche qui passait.** `API-AUTH-12` envoyait `currentPassword`, que le
contrat ne porte pas (`ChangePasswordRequestSchema = z.object({ newPassword })` — D65 : c'est la **fenêtre
sensible** qui remplace le mot de passe actuel). **Zod n'est pas strict par défaut** : le champ était retiré en
silence, le serveur répondait 200, le testeur cochait « conforme ». Un intégrateur construit son client dessus
sans jamais recevoir de plainte.

**(d) Quatre chaînes de traduction mortes.** `header.toggleLanguage`, `dashboardHome.demandsTitle` /
`ctaRespond`, `carrierDealRequest.coverage.title`, plus `netGainSub` hors `messages/`. Présentes, miroitées
FR/EN — et **aucun composant ne les rend**. C'est le mécanisme même qui fabrique un cahier faux : quelqu'un lit
la traduction, en déduit l'écran, et l'écran a changé depuis.

### Les deux fois où la source n'a pas été suivie

- **03-API, écart n° 3** : « le jeu d'essai ne publie que deux trajets dans le futur ». Il en publie **cinq**
  (`yul` J+3, `gru` J+5, `fih` J+7, `bzv-upcoming` J+10, `bzv-perkg` J+15), et `git log` sur `seed-deals.ts`
  montre qu'aucun n'a été ajouté depuis la campagne : la mesure du 08/09 portait sur une base **usée par les
  fiches précédentes**. Le cahier reçoit un **prérequis de données**, pas une fausse contrainte.
- **Ma propre correction d'`API-TRIP-13`** visait `bzv-perkg` pour prouver la garde « trajet réservé =
  intouchable ». Ce trajet porte **zéro** réservation. C'est `bzv-upcoming`. Rattrapé en comptant, avant commit.

### Le classement des écarts — la partie réutilisable

Un écart de cahier n'a pas toujours le même remède, et le testeur doit pouvoir trancher **au premier coup
d'œil**. Les encadrés du 01-WEB portent l'une de deux mentions :

| Mention | Ce que ça veut dire | Quoi faire à la passe suivante |
|---|---|---|
| **le code a raison** | l'attendu du cahier était faux, ou trop littéral | corriger sa lecture, **ne rien consigner** |
| **décision de produit en attente** | l'écart est réel, la question a été posée le 09/09, **rien n'a été changé** | **ne rien consigner non plus** — c'est déjà tranché *comme question ouverte* |

La seconde ligne est la moins intuitive et la plus importante : un écart **instruit et laissé tel quel** n'est
pas un oubli, c'est une décision de ne pas décider tout de suite. Si le cahier ne le dit pas, chaque passe le
rouvre. Sur les 17 fiches du 01-WEB, **une seule** cachait une anomalie (`ANO-WEB-43`).

### Ce qui a aussi été corrigé dans les fichiers de résultats

Le journal de campagne n'était pas exempt : `ANO-CRON-07`, `-08` et `-09` portaient `ÉTAT : OUVERTE` dans leur
fiche et `close` au tableau final (les trois corrections sont bien dans le code, vérifié) ; ce même tableau
nommait **cinq fiches qui ne sont pas celles des chapitres**, dont `CRON-TRAJ-5` qui n'existe nulle part, et
comptait « quatre majeures » pour trois. **Une table de synthèse est une source secondaire** : quand elle
contredit le corps du document, c'est le corps qui a raison — il a été écrit au moment des faits.

---

## 3. Ce qui reste

### (a) Les deux actions hors dépôt

1. **Activer « Restrict unsigned URLs » dans le tableau de bord ImageKit** (Settings → Images/Security). Sans ce
   réglage, les URL signées livrées en A198 ter fonctionnent… **et les URL nues aussi**. C'est écrit dans
   `docs/livrables/05-YAMBA-CONFIGURATION.md`. **Toujours en attente depuis le 17/09.**
2. Les **sauvegardes Atlas** (à ta main), dernier reste du Jalon 2 avec le point ci-dessus.

### (b) Le hors-recette — rien n'est engagé

Voir `context/YAMBA-SUIVI-PROJET.md` § 9 :

1. **Jalon 4 mobile** : graver **D36** (stack + périmètre) pour que les contrats soient conçus « mobile-ready ».
2. **`chore/deps`** : Prisma 7 / Express 5 — **PR dédiée, jamais dans une PR de fonctionnalité**. `npm audit`
   est attendu à 0, et `imagekit` reste pinné **6.0.0** (le « fix » de l'audit le rétrograde à la version de
   2016, la refuser).
3. **Le ménage des mocks `$transaction`** : A197 l'a corrigé sur les deux écrivains qui portent les invariants ;
   il ment partout où il subsiste, simplement sans conséquence connue.
4. UX différées, en attente des chiffres PostHog.

### (c) Deux idées nées de la journée, non engagées

- **Un contrôle CI « clé i18n orpheline »** — chaque clé de `messages/**` apparaît-elle dans une source ? Il
  aurait attrapé les quatre chaînes mortes du 01-WEB pour un coût proche de zéro. **À arbitrer** : ``t(`status.${s}`)``
  compose la clé à l'exécution, un contrôle naïf la déclarerait morte ; il faudrait une liste d'exceptions, **et
  une liste d'exceptions qui grossit est un contrôle qui meurt**.
- **`ANO-WEB-43`** (mineure, ouverte) : le bloc « DE LA PART DE » de la demande ne porte ni « {n} envois » ni
  « Membre depuis » — le DTO ne transporte pas ces compteurs.

---

## 4. Le poste, tel qu'il est maintenant

Rien n'a bougé côté exécution : la journée est **documentaire**, aucun service n'a été redémarré, aucun bundle
reconstruit. Pour repartir, la procédure du handoff du 17/09 est inchangée :

```sh
open -a Docker && docker start yamba-redpanda yamba-mailpit      # Mailpit est publié sur 8026, PAS 8025
# les six services en bundles DÉTACHÉS (reconstruire d'abord si les sources ont bougé : npx nx build <svc> --skip-sync)
(cd apps/auth-service     && nohup node --env-file=../../.env dist/main.js > /tmp/auth-bundle.log 2>&1 &)
(cd apps/trip-service     && nohup node --env-file=../../.env dist/main.js > /tmp/trip-bundle.log 2>&1 &)
(cd apps/deal-service     && nohup env STRIPE_SECRET_KEY= node --env-file=../../.env dist/main.js > /tmp/deal.log 2>&1 &)
(cd apps/api-gateway      && nohup node --env-file=../../.env dist/main.js > /tmp/gateway.log 2>&1 &)
(cd apps/notification-service && nohup node --env-file=../../.env dist/main.js > /tmp/notification.log 2>&1 &)
(cd apps/message-service  && nohup node --env-file=../../.env dist/main.js > /tmp/message.log 2>&1 &)
npx nx dev user-ui    # 3000
npx nx dev admin-ui   # 3001
curl -s -m 180 -o /dev/null http://localhost:3001/login && curl -s -m 180 -o /dev/null http://localhost:3000/fr/login   # préchauffage
```

**Ménage possible**, inchangé : `apps/e2e/resultats-*/` (une cinquantaine de répertoires de sorties) et
`rapport/` ne sont pas versionnés. Restent non suivis **à dessein** :
`apps/{admin-ui,user-ui}/{AGENTS.md,CLAUDE.md}`.

**Et une nouveauté utile** : les **45 scripts de `scripts/recette/`** sont versionnés et le cahier 04-CRONS le
dit maintenant. Ils rendent la campagne rejouable sans rien réécrire — trois exceptions signalées sur place
(`conservation-eligible.ts`, `payload-audit.ts`, `purgeout-eligible.ts`) restent à créer.

---

## 5. Pièges payés le 18/09 — ne pas les repayer

- **Aucun des 17 checks de CI ne relit les `.md`.** Un marqueur de conflit (`<<<<<<< HEAD`) dans un cahier de
  recette partirait sur `dev` en toute discrétion : ni TypeScript, ni les tests, ni le build, ni l'i18n, ni
  l'anti-fuite, ni les contrats OpenAPI ne le verraient. Après toute résolution de conflit sur un document :
  `git grep -n -E '^(<<<<<<< |={7}$|>>>>>>> )'`.
- **Un script de résolution de conflit doit gérer le côté VIDE.** Le motif
  `<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>>` exige un saut de ligne avant `>>>>>>>` : il **ne voit pas** un
  bloc dont un côté est vide, et son compte de blocs est alors faux. Il a déclaré « 1 conflit, traité » en en
  laissant un. Le motif juste ne met pas le `\n` dans l'exigence : `=======\n(.*?)>>>>>>> `.
- **Trois branches qui ajoutent en fin des mêmes documents cumulatifs = conflit garanti** sur les deuxième et
  troisième. C'est le prix, connu, de la règle « ajout seul » — pas une raison de l'abandonner, mais une raison
  de résoudre **dans l'ordre chronologique** (chapitre 192, puis 193, puis 194).
- **Un `assert` qui passe ne prouve pas que le script a tout traité** : il prouve que ce qu'il a trouvé
  correspond à ce qu'il attendait. La vérification qui compte est celle qui regarde le **résultat**, pas le
  retour du script.
- **Vérifier même la source qu'on est venu chercher.** Un journal de campagne est une source primaire, mais il
  date d'un **état de base** qu'il ne décrit pas toujours. Compter coûte une ligne de `grep`.
- **Une fiche de test peut décrire une garde moins bonne que la vraie.** Deux cas ce jour (`API-TRIP-13`,
  `WEB-DEA-2`) où le code disait mieux que le cahier. Quand un écart apparaît, la première question n'est pas
  « qui corrige ? » mais **« lequel des deux a raison ? »**.

---

## 6. Par où reprendre

1. `git checkout dev && git pull` — puis lire ce fichier, l'entrée du 18/09 de `context/YAMBA-CONTEXT.md`, et
   le § 9 de `context/YAMBA-SUIVI-PROJET.md`.
2. **Une minute d'action hors dépôt** : activer « Restrict unsigned URLs » chez ImageKit (§ 3 a).
3. Choisir : **jalon 4 mobile (graver D36)**, **`chore/deps`**, le **ménage des mocks `$transaction`**, ou le
   **contrôle CI « clé i18n orpheline »** (§ 3 c — à arbitrer avant d'écrire une ligne).
