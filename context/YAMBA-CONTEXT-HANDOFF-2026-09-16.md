# Handoff — 16/09/2026 · la campagne de recette est terminée et mergée

> ⚠️ **Ce document n'est plus le point d'entrée.** Voir `YAMBA-CONTEXT-HANDOFF-2026-09-17.md` : la passe
> concurrence MEMBRE (§ 2 c ci-dessous) est FAITE (A195), le cahier 02-ADMIN est à jour (§ 2 a, réserve levée) et
> les arbitrages du § 2 b sont tranchés (A198). Ce handoff reste la mémoire de la campagne de recette.

*Ce document sert à REPRENDRE le chantier après une pause. Il dit où en est le dépôt, ce qui tourne sur le poste, ce qui
reste à faire, et les pièges déjà payés qu'il ne faut pas repayer. Il remplace, comme point d'entrée, les handoffs de
campagne (`…-RECETTE-WEB-2026-09-09.md`, `…-RECETTE-API-2026-09-07.md`), qui restent la mémoire détaillée de chaque
campagne.*

---

## 1. L'état du dépôt, en une ligne

**Tout est dans `dev`. Zéro PR ouverte.** `dev` = `131276b` (Merge PR #330), **200 commits** ajoutés le 16/09, CI **verte**.

| Repère | Valeur |
|---|---|
| PR mergées | #1 → **#330** (le 16/09 : #270 → #329 = les 59 PR de la campagne, #271 = D78, #330 = suivi) |
| Tests | trip **293**, deal **644**, notification **122**, message **57**, auth **376** — mesurés sur l'arbre de `dev` |
| Harnais navigateur | **543 scénarios** dans 75 fichiers (`apps/e2e`, hors CI) |
| Registre | décisions D1 → D78 gravées · arbitrages A1 → **A194** |
| Dernière anomalie | **ANO-ADM-92** (cahier 02-ADMIN) · **ANO-WEB-105** (cahier 01-WEB) |
| Dernier chapitre d'apprentissage | **187** (D78 ; le 186 est ADM-NRG) |
| Schéma Prisma | inchangé depuis le 16/09 (deux champs optionnels ajoutés sur `User` : `suspensionCategory`, `suspensionProposedCategory`) |

### Les quatre cahiers de recette sont joués et consignés

| Cahier | Verdict | Où c'est écrit |
|---|---|---|
| 01-WEB (membre) | joué jusqu'au § 7 | `context/YAMBA-RECETTE-WEB-RESULTATS.md` |
| 02-ADMIN | **conforme avec réserves documentaires** (§ 8 consigné le 16/09) | même fichier, sections « Cahier 02-ADMIN » |
| 03-API | acceptée (08/09, 146 fiches, 22 anomalies closes) | `context/YAMBA-RECETTE-API-RESULTATS.md` |
| 04-CRONS | joué | `context/YAMBA-RECETTE-CRONS-RESULTATS.md` |

Bilan admin : 31 chapitres, 196 scénarios du cahier (211 au harnais), **92 anomalies trouvées, 92 closes, aucune
ouverte** (5 bloquantes, 48 majeures, 38 mineures, 1 cosmétique). Un seul scénario non joué : **ADM-RAP-2** (divergences
Stripe réelles — le poste tourne sur le fournisseur FAKE ; couverture de substitution livrée, à rejouer le jour où Stripe
est branché en pré-production).

---

## 2. Ce qui reste — rien n'est engagé, tout est à décider

### (a) Mettre le cahier 02-ADMIN à jour — la seule réserve du § 8

`docs/recette/RECETTE-02-ADMIN.md` décrit encore des états d'avant correction. Trois points relevés :

1. **§ 7, écart documentaire n° 4** : « la tuile Sanctions proposées mène à `/users` sans filtre » — **levé** par A194
   (elle ouvre `/users?proposal=1`).
2. **§ 7, écart documentaire n° 5** : « aucun écran pour régénérer des codes de secours » — **partiellement levé** par
   A190 a (« Régénérer mes codes de secours » existe dans « Mes sessions ») ; seule la réinitialisation de la 2FA d'un
   AUTRE administrateur reste absente.
3. **ADM-NRG-6, étape 3** : « un identifiant de cible trop court est ignoré » — faux depuis ANO-ADM-74 : un identifiant
   court est une valeur légitime (clé de paramètre, `maintenance`) ; seul un caractère interdit fait un filtre ignoré.

Attention : le `.pdf` du cahier diverge dès qu'on touche le `.md`. Décider si on régénère le PDF ou si le `.md` fait foi.

### (b) Les arbitrages accumulés pendant la recette

Chacun est décrit dans la section « Proposé, non fait » ou « À trancher » de son chapitre, dans
`YAMBA-RECETTE-WEB-RESULTATS.md` :

- **journaliser un refus d'effacement RGPD** (aujourd'hui inscrit au seul registre `DataRequest`) — le registre suffit-il
  comme preuve vis-à-vis d'un régulateur ?
- **écran de réinitialisation de la 2FA** d'un autre administrateur (aujourd'hui : retirer l'accès, réinviter) ;
- **ce que mesure « Versements en échec depuis plus de 48 h »** (relevé aux § 5.2 et § 5.11) ;
- **« Abandonner » un renversement** sans événement ni message au Voyageur (§ 5.14) ;
- **billets servis par des URL ImageKit publiques permanentes** (§ 5.8) ;
- **catégorie de sanction sur un dossier de signalement déjà tranché** (§ 7) : le Support relit le motif interne, plus long.

### (c) La passe « concurrence » côté MEMBRE — la suite directe d'A192

A192 a soldé le périmètre ADMIN : tout geste qui lit un document puis l'écrit conditionne son `updateMany` à l'état lu et
passe par `withWriteConflictRetry`. **L'inventaire des fichiers MEMBRE restants est fait** (grep à jour au 16/09) :

- `apps/auth-service/src/controller/auth.controller.ts`
- `apps/auth-service/src/controller/profile.controller.ts`
- `apps/auth-service/src/services/google-auth.service.ts`
- `apps/message-service/src/services/conversation.service.ts`
- `apps/message-service/src/services/conversation-retention.service.ts`

Le patron à copier est dans `apps/auth-service/src/controller/admin-users.controller.ts` (verrou optimiste `updatedAt`) et
`admin-auth.controller.ts` (garde métier pour l'anti-rejeu). Les tests modèles :
`admin-users-concurrency.controller.spec.ts` et `admin-auth-totp-concurrency.controller.spec.ts` (mock de `$transaction`
qui perd la course une fois, sans horloge ni hasard). Le chapitre d'apprentissage **186** explique le raisonnement.

### (d) Le reste du projet (hors recette)

Voir `context/YAMBA-SUIVI-PROJET.md` § 9 « Ordre recommandé des prochaines sessions » : jalon 4 mobile (graver D36), UX
différées en attente des chiffres PostHog, `chore/deps` (Prisma 7 / Express 5 sont des portes de PR dédiée — **jamais**
dans une PR de fonctionnalité).

---

## 3. Le poste, tel qu'il est maintenant

La pile tourne encore (lancée le 16/09 au matin) — **mais sur les bundles d'AVANT le merge de D78** : `dev` contient
maintenant la sécurité de connexion (throttling, email de nouvelle connexion). **Rebâtir auth-service avant de rejouer
quoi que ce soit.**

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
# puis PRÉCHAUFFER les deux fronts avant tout harnais (voir piège ci-dessous) :
curl -s -m 180 -o /dev/null http://localhost:3001/login && curl -s -m 180 -o /dev/null http://localhost:3000/fr/login
```

Vérifier les six `/health`, puis **qui tient chaque port** : `lsof -nP -iTCP:6003 -sTCP:LISTEN -t` puis
`ps -o command= -p <pid>` doit montrer le bundle (`dist/main.js`), deal-service avec la clé Stripe VIDE (fournisseur FAKE).

Rejouer la recette : `cd apps/e2e && npx playwright test src/admin/<fiche>.spec.ts --reporter=list --output=resultats-xxx`.

**Ménage possible** : `apps/e2e/resultats-*/` (une cinquantaine de répertoires de sorties de passages) et `rapport/` ne
sont pas versionnés — ils peuvent être supprimés sans rien perdre. Restent aussi non suivis, non commités à dessein :
`apps/{admin-ui,user-ui}/{AGENTS.md,CLAUDE.md}`.

---

## 4. Pièges payés — ne pas les repayer

**Git / CI (payés le 16/09 en faisant atterrir la pile)**

- Une PR empilée sur une branche `chore/*` **n'a aucune CI** : le workflow ne se déclenche que sur `pull_request` vers
  `dev` / `main`. « CI 17/17 » sur une PR empilée, ça n'existe pas — il n'y a rien du tout.
- **Retargeter une PR vers `dev` ne déclenche PAS la CI** : GitHub n'émet pas `synchronize` sur un changement de base. Le
  geste qui marche sans toucher à l'historique : **fermer puis rouvrir la PR** (`gh pr close` + `gh pr reopen`).
- Protection de `dev` : 17 checks requis, **aucune revue exigée**, `strict: false` → une PR verte reste mergeable même si
  `dev` a avancé, sans rejouer la CI.
- Avant de merger une PR hors pile, **fusionner à blanc** : `git merge-tree --write-tree <pile> <branche>` dit en une
  seconde s'il y aura conflit. C'est ce qui a montré qu'il fallait passer #271 en DERNIER (sinon ses 4 conflits se
  répétaient sur 50 PR).
- Un conflit sur un doc cumulatif se résout **en gardant les deux côtés** — jamais en écrasant. Et vérifier les
  **numéros de chapitre** : le chapitre D78 était numéroté 131, déjà pris depuis la campagne (renuméroté 187).

**Poste / harnais**

- `nx run-many --target=serve` a refusé de démarrer (« workspace out of sync ») même avec `--skip-sync` : les **bundles
  détachés** passent, eux. Et un service lancé en tâche de fond par un agent meurt avec l'agent → toujours `nohup … &`.
- Un front `next dev` annonce **« Ready » AVANT de savoir répondre** (première compilation) : précharger `/login` et
  `/fr/login` par un `curl` long, sinon le premier scénario du harnais échoue sur une page blanche.
- `npx nx build <svc>` **sans `--skip-sync`** peut s'arrêter sur la question des sync generators sans rien rebâtir :
  vérifier une chaîne attendue dans `dist/main.js` (`grep -c`).
- Le menu latéral du back-office porte les mêmes `href` que les tuiles d'accueil → viser `main` dans les sélecteurs.
- Un pas TOTP qui vient de servir est **brûlé** (anti-rejeu) : enchaîner deux gestes TOTP demande d'attendre le pas suivant.
- La mémoire du fournisseur FAKE survit au rejeu du jeu d'essai tant que deal-service n'est pas redémarré : comparer les
  montants à un relevé pris juste avant le geste.

---

## 5. Par où reprendre

1. `git checkout dev && git pull` — puis lire ce fichier et `context/YAMBA-CONTEXT.md` (entrées du 16/09).
2. Choisir : **(a)** cahier à mettre à jour (doc, ~1 h), **(b)** arbitrages à trancher (décisions métier, pas de code),
   **(c)** passe concurrence MEMBRE (code + tests, ~1 chantier), **(d)** suite du projet hors recette.
3. Pour (c), le chemin est balisé : inventaire ci-dessus, patron et tests modèles nommés, chapitre 186 pour le pourquoi.
