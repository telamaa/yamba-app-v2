# Handoff — 17/09/2026 · la dette de concurrence est soldée, les arbitrages sont tranchés

*Ce document sert à REPRENDRE le chantier après une pause. Il dit où en est le dépôt, ce qui a été décidé, ce qui
reste, et les pièges payés qu'il ne faut pas repayer. Il remplace, comme point d'entrée, le handoff du 16/09 —
qui reste la mémoire de la campagne de recette.*

---

## 1. L'état du dépôt, en une ligne

**Tout est dans `dev`. Zéro PR ouverte.** `dev` = `da44c96`, CI **verte** (17 checks comptés, pas seulement leur couleur).

| Repère | Valeur |
|---|---|
| PR mergées | #1 → **#343** (le 17/09 : #334, #335, #336, #337, #339, #340, #341, #342, #343) |
| Tests | trip **308** · deal **659** · notification **122** · message **79** · auth **395** — **1563** au total (**1168** dans la base annoncée par `CLAUDE.md`, qui exclut auth) |
| Registre | décisions D1 → D78 · arbitrages A1 → **A199** |
| Apprentissage | dernier chapitre **191** |
| Schéma Prisma | **inchangé** depuis le 16/09 |
| Recette | les quatre cahiers joués ; **la réserve documentaire du cahier 02-ADMIN est LEVÉE** |

---

## 2. Ce qui a été fait le 17/09 (et pourquoi)

### (a) Le cahier 02-ADMIN remis à l'état du code — #334

La recette admin était « conforme **avec réserves documentaires** ». Le handoff nommait **trois** écarts ; il y en
avait **quatorze**. La source exacte n'était pas le résumé mais les sections « Écarts avec le cahier » consignées
chapitre par chapitre dans `YAMBA-RECETTE-WEB-RESULTATS.md` — **c'est là qu'il faut aller chercher**, toujours.

Trouvés en plus : deux renvois vers des fichiers **inexistants** (`RECETTE-01-MEMBRE`, `RECETTE-04-EXPLOITATION`)
et deux vers des scénarios absents. Ajouté : `ADM-SES-2` (125 → **126** scénarios). **Tranché** : le `.md` fait
foi, le `.pdf` du 06/09 n'est plus régénéré à chaque passe (il avait divergé dès le 09/09 : la question était
réglée par les faits).

### (b) A196 — une transition s'écrit sur l'état qu'elle a LU — #335

Les huit transitions du trajet lisaient, jugeaient par la machine à états, puis écrivaient **sans condition**.
Conséquences : double clic sur « Publier » = deux compteurs **et deux vagues de notifications** ; surtout **D72
tombait** (un deal né entre la garde et l'écriture laissait le trajet annulé avec un deal vivant).

Le témoin qui manquait existait déjà : la réservation d'un deal écrit `reservedKg` sur le **même document Trip**
(CAP-01). **Inventaire** : deal-service n'avait rien à corriger (tout passe par `booking-write`, déjà sous rejeu).

### (c) A197 — D2 devient exécutable — #336

Pourquoi 57 tests n'avaient rien vu : `$transaction: (fn) => fn(prismaMock)` rend **dedans et dehors
indiscernables**. Deux fiches structurelles (client de transaction **distinct**, journal des appels avec leur
provenance). **Contre-épreuve faite** : défaut réintroduit → fiche rouge → code restauré.

### (d) A198, A198 bis, A198 ter — les six « oui » du dossier — #340, #341, #342

| Point | Décision |
|---|---|
| (c) libellé | La mesure est **gardée**, le mot corrigé : « Versements non partis 48 h après la fin du deal ». Le nom `PAYOUT_FAILED_48H` ne bouge pas (identifiant, pas phrase) |
| (d) renversement abandonné | Notification + email FR/EN (montant, référence, recours), **jamais** le motif interne, best effort, identifiant déterministe |
| (a) refus d'effacement | `ACCOUNT_ERASURE_REFUSED` dans la **même transaction** que le registre ; pas de transaction quand il n'y a qu'une écriture |
| (f) motif sous les yeux | Signalements ouverts sur la fiche membre, **uniquement** pour `reports.review` ; `null` ≠ « aucun » ; on montre, on ne pré-coche pas |
| (g) doublon | Conflit **matérialisé** côté message (document froid) ; **refusé** côté auth (Trip/User chauds) → on corrige la conséquence : « prioritaire » compte des **signalants distincts** |
| (e) justificatifs | URL **signée** posée à la lecture. ⚠️ La moitié du dispositif est **hors du dépôt** |

**Le seul « non »** : (b) l'écran de réinitialisation de la 2FA d'un **autre** administrateur — il créerait
exactement le pouvoir qu'un attaquant cherche, et le détour « retirer / réinviter » est devenu rare depuis A190 a.

### (e) A199 — la suite de tests redevient déterministe — #339

**Trouvé en livrant A198**, donc pas cherché : la suite est tombée sur un fichier non touché, puis sur un autre au
passage suivant. `virtual: true` sur un module qui **se résout réellement** → substitution intermittente sous
workers parallèles → **le vrai `PrismaClient` partait en base** au milieu d'un test unitaire. Retiré des **30
fiches** concernées ; trois passages parallèles verts pour le prouver.

---

## 3. Ce qui reste

### (a) Une action à faire hors du dépôt — la seule chose « en attente » de cette journée

**Activer « Restrict unsigned URLs » dans le tableau de bord ImageKit** (Settings → Images/Security). Sans ce
réglage, les URL signées livrées en A198 ter fonctionnent… **et les URL nues aussi**. C'est écrit dans
`docs/livrables/05-YAMBA-CONFIGURATION.md`. Une mesure de sécurité à moitié déployée rassure sans protéger.

### (b) Le hors-recette — rien n'est engagé

Voir `context/YAMBA-SUIVI-PROJET.md` § 9 :

1. **Jalon 4 mobile** : graver **D36** (stack + périmètre) pour que les contrats soient conçus « mobile-ready ».
2. **`chore/deps`** : Prisma 7 / Express 5 — **PR dédiée, jamais dans une PR de fonctionnalité**. Rappel :
   `npm audit` est attendu à 0, et `imagekit` reste pinné **6.0.0** (le « fix » de l'audit le rétrograde à la
   version de 2016, la refuser).
3. UX différées, en attente des chiffres PostHog.

### (c) Deux idées nées de la journée, non engagées

- **Les cahiers 01-WEB, 03-API et 04-CRONS n'ont pas eu la passe du 02-ADMIN.** Le même exercice (relire les
  « Écarts avec le cahier » et reporter) y trouverait probablement des états d'avant correction.
- **Le patron de mock `$transaction: (fn) => fn(prismaMock)` traîne encore ailleurs.** A197 l'a corrigé sur les
  deux écrivains qui portent les invariants ; il ment partout où il subsiste, simplement sans conséquence connue.

---

## 4. Le poste, tel qu'il est maintenant

Les bundles ont été rebâtis et bootés aujourd'hui (`bash scripts/smoke-services.sh` : 6/6 ✅). Pour redémarrer :

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

**Ménage possible** : `apps/e2e/resultats-*/` (une cinquantaine de répertoires de sorties) et `rapport/` ne sont
pas versionnés. Restent non suivis **à dessein** : `apps/{admin-ui,user-ui}/{AGENTS.md,CLAUDE.md}`.

---

## 5. Pièges payés le 17/09 — ne pas les repayer

- **`git add -A <dossier>` happe les répertoires non suivis.** Un `git add -A apps` a indexé 738 fichiers (les
  sorties de recette et les `AGENTS.md`/`CLAUDE.md` volontairement non suivis). La règle du dépôt est là pour
  ça : **pathspec explicite, toujours**, et vérifier `git diff --cached --numstat` avant de committer.
- **Une fiche de test qui n'a ni `import` ni `export` est un SCRIPT pour TypeScript** : ses constantes de tête
  tombent dans la portée globale partagée et se heurtent à celles des autres fiches (TS2451 au `nx typecheck`,
  rapporté sur le **fichier voisin**, invisible pour `nx test`). Remède : `export {};` en pied.
- **Jest ne rend pas la main** quand une fiche charge un module qui ouvre Redis ou le transport email : mocker
  les singletons d'infrastructure fait partie de la fiche, pas du confort.
- **Une fiche qui passe seule et échoue en groupe, avec un fichier différent à chaque passage** : ce n'est
  jamais le fichier qui tombe qu'il faut regarder. Lancer `--runInBand` pour confirmer, puis chercher ce qui
  fuit **entre** les fiches (ici `virtual: true`, A199).
- **Un test structurel doit avoir été vu ÉCHOUER.** Réintroduire volontairement le défaut, vérifier le rouge,
  restaurer. Sinon on n'a pas écrit un test, on a écrit un commentaire exécutable.
- **`npx jest --config apps/auth-service/jest.config.ts` n'existe pas** : ce service a un `jest.config.cts`.
  Passer par `npx nx test auth-service`.
- **Changer un libellé du catalogue de paramètres change l'OpenAPI** : `npm run settings-doc` **et**
  `npm run generate:openapi`, sinon le check « contrats » de la CI tombe.

---

## 6. Par où reprendre

1. `git checkout dev && git pull` — puis lire ce fichier, l'entrée du 17/09 de `context/YAMBA-CONTEXT.md`, et
   les arbitrages **A196 → A199** du registre.
2. **Une minute d'action hors dépôt** : activer « Restrict unsigned URLs » chez ImageKit (§ 3 a).
3. Choisir : **jalon 4 mobile (graver D36)**, **`chore/deps`**, la **passe cahiers** sur 01-WEB / 03-API /
   04-CRONS, ou la fin du ménage des mocks `$transaction`.
