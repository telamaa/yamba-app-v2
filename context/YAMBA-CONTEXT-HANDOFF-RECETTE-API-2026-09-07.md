# Handoff — campagne de recette, cahier n° 3 (API)

> **État : campagne NON commencée.** Aucun scénario n'a été joué, aucun verdict n'est porté.
> La session s'est arrêtée pendant la **préparation du poste**, sur une question de configuration
> restée sans réponse (§4). Ce document dit exactement où reprendre.
>
> Session du 7 septembre 2026 · `dev` = `7835a12` · rédigé avant une pause demandée.

---

## 1. Ce qui a été livré avant la recette (fait, mergé, clos)

| PR | Contenu | CI |
|---|---|---|
| **#227** | Les quatre dossiers d'ouverture commerciale (`docs/livrables/` 07 financement et lancement, 08 assureurs, 09 juristes, 10 aides publiques) **+ C-PR6d / D74**, les quatre indicateurs de santé du modèle | 17 / 17 comptés |
| **#228** | Commit de suivi : journal, suivi de projet, référence de tests | 17 / 17 comptés |

**D74 — ce que « l'ajout des indicateurs » a produit** (question posée en séance, réponse ici pour
mémoire) : taux d'acceptation par **cohorte** (`accepted / (accepted + declined + expired)`, le sort
d'une demande compte dans la période où elle a été *faite*) avec sa ventilation refus / expiration ;
taux de litige sur les livraisons ; revenu moyen par deal terminé ; **registre de sinistralité par
catégorie** (mois de décision, catégorie, devise, litiges tranchés / retenus / somme remboursée — la
pièce qu'un assureur exigera, D22). Règle transverse : un dénominateur vide donne `null`, rendu
« — », **jamais « 0 % »**.

**Corrections apportées par le commit de suivi** (elles étaient fausses, pas seulement absentes) :

- référence de tests de `CLAUDE.md` : **857 → 860** (deal 513 → 516, auth 175 → 183). Recomptés en
  local avec `--skip-nx-cache`, pas repris de mémoire : trip 209 · deal 516 · notification 99 ·
  message 36 · auth 183 ;
- quatorze PR manquaient au journal de `YAMBA-CONTEXT.md` (#214 → #227) ;
- cinq lignes du Jalon 2 du suivi étaient encore « à faire » alors qu'elles sont livrées depuis le
  05/09 (D67, D65, A145, D66/D70, D35) ; quatre lignes de la section 7 disaient « PR ouverte » pour
  des PR mergées ; l'en-tête du suivi datait du 3 septembre.

Branches `chore/docs-suivi-227` et `docs/dossiers-assurance-juridique` supprimées, locales et
distantes. Arbre de travail propre au moment de la pause.

---

## 2. Où en est la campagne de recette

L'ordre décidé est celui du `docs/recette/README.md` : **API d'abord** (il prouve que les gardes
existent côté serveur), puis Web, puis Admin, puis Crons.

| Étape | État |
|---|---|
| Lecture du cahier `docs/recette/RECETTE-03-API.md` (4 368 lignes, 146 fiches) | ✅ chapitres 1 à 4.2 lus |
| Démon Docker | ✅ démarré (était éteint) |
| Redpanda | ✅ `yamba-redpanda` **Up (healthy)**, topics `booking-events` et `messaging-events` créés (12 partitions chacun) |
| Mailpit | ❌ **n'a pas démarré** — voir §3 |
| `bash scripts/smoke-services.sh` | ⬜ **pas encore joué** |
| `seed-deals.ts` (jeu d'essai) | ⬜ **pas encore joué** |
| `npm run dev` | ⬜ pas lancé |
| Fiches jouées | **0 / 146** |

Aucun verdict n'est donc à consigner. Le tableau de suivi du chapitre 9 du cahier est vierge.

---

## 3. Ce que la préparation a révélé sur le poste

À lire avant de reprendre : **quatre écarts entre le poste réel et ce que les documents supposent.**

### 3.1 Mailpit ne peut pas démarrer — le port 8025 est pris par un autre projet

```
Error response from daemon: driver failed programming external connectivity on endpoint
yamba-mailpit: Bind for 0.0.0.0:8025 failed: port is already allocated
```

Le coupable est identifié : le conteneur **`leko-app-mailhog-1`** (un autre projet, MailHog) tient
`0.0.0.0:8025`. Le conteneur `yamba-mailpit` est resté à l'état **`Created`**, jamais démarré.

Deux sorties possibles, à trancher à la reprise :

```bash
# a) libérer le port (l'autre projet n'est pas en cours d'utilisation)
docker stop leko-app-mailhog-1 && docker compose up -d mailpit

# b) déplacer Mailpit sur un autre port d'interface (modifie docker-compose.yml)
#    "8026:8025" au lieu de "8025:8025" — la boîte se lit alors sur http://localhost:8026
```

Le poste porte **une vingtaine de conteneurs d'autres projets** (odoo, leko, elasticsearch, mysql,
postgres, rabbitmq, redis, mongodb…). Aucun autre conflit de port avec Yamba n'a été constaté, mais
c'est le premier endroit où regarder si un service refuse de se lier.

### 3.2 La question de configuration restée SANS RÉPONSE — à trancher en premier

`.env` pointe SMTP sur **Gmail** (`smtp.gmail.com:465`). Les cahiers supposent **Mailpit**
(`localhost:1025`, boîte lisible sur `http://localhost:8025`). La conséquence est double :

- plusieurs fiches exigent de **lire un code OTP reçu par email** (inscription, fenêtre sudo,
  changement d'email) : **impossible avec Gmail** ;
- les envois vers `@seed.yamba.dev` (domaine inexistant) **rebondiraient dans la boîte Gmail**
  réelle.

Trois options avaient été proposées : bascule Mailpit **le temps de la recette** (sauvegarde
`.env.backup-recette`, restauration à la fin) — c'était la recommandation ; garder Gmail et marquer
⏭ les fiches OTP ; bascule Mailpit définitive. **La question n'a pas été tranchée.** À reprendre là.

> Rappel du piège maison, il s'applique ici : une clé posée dans `apps/<service>/.env` marche pour
> ce service et **échoue en silence partout ailleurs**. Toute variable va dans le `.env` **racine**.

### 3.3 Le `.env` réel, comparé à ce que le livrable 05 annonce

**Le livrable `docs/livrables/05-YAMBA-CONFIGURATION.md` est périmé sur un point :** il dit les clés
ImageKit absentes (« tout téléversement échoue »). **Elles sont présentes.** À corriger dans le
document au prochain passage.

| Présentes | `DATABASE_URL` (Atlas, base `development`), `REDIS_DATABASE_URI` (**Upstash**, distant), `SMTP_*` (Gmail), `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `STRIPE_SECRET_KEY` (**`sk_test_…`**), `IMAGEKIT_PUBLIC_KEY` / `PRIVATE_KEY` / `URL_ENDPOINT`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `USER_APP_URL`, `CORS_ORIGIN` |
|---|---|
| **Absentes** | `KAFKA_BROKERS`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `SENTRY_DSN`, `POSTHOG_API_KEY`, `DELIVERY_CODE_ENCRYPTION_KEY`, `NODE_ENV`, `ADMIN_APP_URL`, `GOOGLE_CLIENT_ID`, `STRIPE_WEBHOOK_SECRET` |

Conséquences pour la campagne, chacune vérifiée dans le code :

- **Mongo et Redis sont distants** (Atlas + Upstash) : Docker n'est nécessaire que pour Redpanda et
  Mailpit. Utile à savoir le jour où le démon Docker refuse de démarrer.
- `KAFKA_BROKERS` absent est **sans effet** : les trois services retombent sur `localhost:9092`
  (`apps/deal-service/src/main.ts:149`, `apps/message-service/src/main.ts:68`,
  `apps/notification-service/src/main.ts:128` et `:175`). Redpanda écoute bien là.
- `DELIVERY_CODE_ENCRYPTION_KEY` absente : repli sur la clé de développement, **licite hors
  production**. Le code de livraison du jeu d'essai (`742891`) reste jouable.
- `SENTRY_DSN` et `POSTHOG_API_KEY` absentes : les deux intégrations sont **inertes**, par
  construction. Les fiches qui les visent sont ⏭.
- `STRIPE_WEBHOOK_SECRET` absente : la fiche webhook Stripe signé (chapitre 8) est ⏭ tant que la
  CLI `stripe` n'est pas configurée.

### 3.4 Le fournisseur de paiement sera **Stripe**, pas Fake

`STRIPE_SECRET_KEY` est présent → la fabrique choisit Stripe, et le parcours de bout en bout exige
un navigateur pour confirmer la carte. Les fiches du chapitre 5.3 qui créent un deal complet en
`curl` supposent le fournisseur **FAKE**. Le contournement est documenté au §2.9 du cahier, et il
tient au piège Nx (`nx serve` écrase les variables de la ligne de commande) :

```bash
npx nx build deal-service
cd apps/deal-service && STRIPE_SECRET_KEY= node --env-file=../../.env dist/main.js
# preuve : POST /deals/payment-intents répond "provider": "FAKE", "clientSecret": null
```

À décider à la reprise : jouer le chapitre 5.3 avec un deal-service lancé de cette façon, ou marquer
ces fiches ⏭.

---

## 4. Reprendre — la séquence exacte

```bash
cd /Users/gomab/Documents/Dev/Projects/yamba-app
git checkout dev && git pull --ff-only          # dev = 7835a12 au moment de la pause

# 0. Trancher la question SMTP du §3.2 AVANT tout, puis libérer le port de Mailpit (§3.1)
docker compose up -d && ./scripts/redpanda-bootstrap.sh   # redpanda est déjà up et bootstrappé

# 1. Prouver que les six bundles démarrent (un build vert n'est PAS un service démarré)
bash scripts/smoke-services.sh                  # attendu : six lignes ✅

# 2. Remise à zéro de la recette (identifiants NEUFS à chaque exécution — jamais les recopier)
npx tsx --env-file=.env packages/libs/prisma/scripts/seed-deals.ts

# 3. Un compte admin, pour les fiches qui prouvent une garde de permission
npx tsx --env-file=.env packages/libs/prisma/scripts/grant-admin.ts \
  aminata.shipper@seed.yamba.dev --role SUPPORT

# 4. Servir
npm run dev

# 5. Préparer le terminal : §2.6 du cahier (BASE, SEED, bid/tid/uid, login, show)
#    puis dérouler dans l'ordre : chapitre 4 (transverse) → 5 → 6 → 7 → 8
```

> **Ne jamais sourcer `.env` dans zsh** avant un seed : le mot de passe Mongo contient des
> caractères que le shell interprète. Toujours `--env-file=.env`.
> Mot de passe commun du jeu d'essai : `Yamba-Dev-2026!` — **entre apostrophes simples** en zsh.

**Ordre de la campagne**, tel que le cahier l'impose : le chapitre 4 (transverse : santé,
maintenance, limiteur, corrélation, contrat `details.code`, sémantique 401/403/404, pagination) se
joue **en premier**, parce que si une de ses fiches est KO, tous les chapitres suivants héritent du
défaut et leurs verdicts ne veulent plus rien dire.

**Conventions à tenir** (§3 du cahier) : numérotation `API-<SERVICE>-<n>` jamais réutilisée ;
verdicts **OK / KO / PARTIEL / ⏭** — un OK exige les **trois** colonnes (code HTTP, corps attendu,
effet de bord), un 200 dont le corps n'a pas le champ attendu est un PARTIEL ; gravités
**bloquante** (une garde de sécurité ou d'argent ne tient pas côté serveur) / **majeure** (une règle
métier n'est pas appliquée, un conflit n'est pas typé) / **mineure** (écart de forme). On ne juge
jamais un refus sur le `message` anglais : on juge sur le **statut HTTP** et sur le **code**.

---

## 5. Ce qui reste après ce cahier

1. Cahier n° 1 **Web** (344 scénarios) — le plus long.
2. Cahier n° 2 **Admin** (125) — suppose des données créées par les deux précédents.
3. Cahier n° 4 **Crons** (90) — plusieurs tâches n'ont d'objet que sur des deals déjà avancés.
4. Hors recette, à ta main : **vérification des sauvegardes Atlas**.
5. Puis le **chantier mobile** (Jalon 4) — D36 (Expo) et **D73** (Android et iOS distingués,
   « Se connecter avec Apple » comme prérequis **serveur**) gravées, poste préparé par le
   livrable 06.

Les anomalies trouvées se consignent avec identifiant de fiche, gravité et reproduction, et
**partent en PR groupées par domaine, jamais scénario par scénario**.
