# Handoff — 13 et 14 novembre 2026

*État exact du chantier au moment d'éteindre le Mac. Trois décisions gravées et fusionnées dans
`dev` en deux jours : **D93**, **D98**, **D99** (+ son amendement). `dev` est propre, aucune PR
ouverte, rien en attente.*

---

## 1. Où en est le dépôt, en une ligne

```
dev = 024a6cc1  (Merge pull request #410)   — à jour avec origin/dev, aucune PR ouverte
```

| Référence de tests | Avant ces deux jours | Maintenant |
|---|---|---|
| mobile | 665 / 35 suites | **755 / 37 suites** |
| trip-service | 409 / 30 suites | **414 / 30 suites** |

Les autres services n'ont pas bougé (auth 407, deal 740, notification 136, message 79).
`CLAUDE.md` porte ces chiffres : toute dérive devra s'expliquer.

---

## 2. Ce qui a été fusionné

| PR | Décision | En une phrase |
|---|---|---|
| **#408** | **D93** — « un tunnel n'offre pas la sortie » | Les six pages d'auth ne gardent que le logo, la langue et le thème. La règle devient une donnée de la route (`lib/layout/tunnel.ts`, pur, trois régimes) au lieu d'une regex en dur dans le `Header`. |
| **#408** | **D98** — l'attente des boutons | La vague de trois points remplace le libellé pendant l'attente, sur les deux fronts, aux mêmes chiffres (900 ms, décalage 150 ms, montée 4 px, 0,85→1,15, opacité 0,35→1). |
| **#409** | **D99** — la carte de résultat | Le gros chiffre devient ce que l'envoi coûte ; `estimateKg` estime sans filtrer ; « Nouveau Voyageur » quitte les listes ; les cartes sont aplaties ; le bleu passe au teal. |
| **#410** | **D99 5A/5B/5C** | La mention sous le prix disait un seuil (« pour 2 kg ») → « estimation pour 2 kg » / « pour ton colis de N kg » ; l'ordre s'aligne sur le téléphone ; le pays recule à 12 px. |

Défauts corrigés **au passage**, trouvés en vérifiant et non demandés :

- `/refresh` manquait à la copie de la liste des préfixes d'auth tenue par `login-redirect.ts` (depuis le 28/08) ;
- `HeaderSkeleton`, monté en permanence, faisait clignoter le CTA mangue **dans le tunnel de paiement** depuis le 17/10 ;
- « Réservation sécurisée » ne nommait personne alors que D91 1A l'exige → « Paiement sécurisé par Stripe » ;
- **trois** mises en forme d'un même prix coexistaient (site, natif, et la règle nulle part) — d'où « ≈ 25 € » contre « ≈ 24,85 € » pour le même trajet ;
- `pricing-example.ts` existait en double sans que rien ne compare les copies.

---

## 3. Ce qui tourne, et comment le relancer après le redémarrage

**Tout était allumé au moment du handoff** : les six services, Redpanda, le site et Metro.
Rien n'est perdu à l'arrêt — Mongo (Atlas) et Redis (Upstash) sont **dans le cloud**, et le
volume Redpanda survit à un `stop`.

```sh
# 1. Docker, puis le courtier (le SEUL conteneur de la pile)
open -a Docker && docker compose up -d redpanda

# 2. Les services, chacun dans son terminal (jamais `npm run dev` par réflexe : 16 Go)
npx nx serve api-gateway        # 8080
npx nx serve auth-service       # 6001
npx nx serve trip-service       # 6002
npx nx serve deal-service       # 6003
npx nx serve notification-service   # 6004 — à relancer APRÈS Redpanda
npx nx serve message-service    # 6005

# 3. Les fronts
npx nx dev user-ui              # 3000  (LAN : http://192.168.1.155:3000)
npx nx start @yamba-app/mobile  # Metro 8081, `--go` déjà dans le script

# 4. Le simulateur (iPhone 15 Pro, Expo Go 57.0.9 déjà installé)
open -a Simulator
xcrun simctl openurl booted "exp://127.0.0.1:8081"
```

**Ordre qui compte** : Redpanda **avant** notification-service. Sinon son consommateur épuise
ses tentatives (`kafkajs` renvoie ses erreurs de connexion en `retriable: false`) et il faut le
relancer.

**Pour l'Android** : `~/Library/Android/sdk/emulator/emulator -avd Pixel_6_API_33` (le binaire
est hors du PATH).

### Deux contrôles qui disent la vérité

```sh
curl -s http://localhost:8080/api/status | python3 -m json.tool   # 200 + "ok" = les cinq services répondent
curl -s -o /tmp/b.js -w "%{http_code}\n" \
  "http://localhost:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false"
grep -o "__workletHash" /tmp/b.js | wc -l     # 551 attendus — le seul contrôle qui prouve qu'une app RN se construit
```

L'entrée n'est **pas** `/index.bundle` (expo-router utilise une entrée virtuelle). Et un
`GET /` sur le port 8081 provoque un rendu statique web non configuré : la pile d'erreurs qui
en sort n'est **pas** un défaut de l'app.

---

## 4. Ce qu'il faut savoir avant de rallumer

**Les e-mails partent pour de vrai.** `EMAIL_PROVIDER=smtp` sur `smtp.gmail.com:465` — pas
Mailpit. Quatorze crons tournent dès que les services sont up, dont quatre passent par le
mailer (`ops-alerts`, `ops-digest` deal-service ; `unread-reminder` message-service ;
`onboarding-reminder` auth-service). Laisser la pile allumée sans surveiller n'abîme rien, mais
ce n'est pas neutre : des tâches de fond écrivent dans la base `development` d'Atlas et peuvent
envoyer de vrais messages.

**Le paiement est sur le vrai Stripe en mode test** (`sk_test_`), `PAYMENT_PROVIDER` étant
absent du `.env`. Carte de test `4242 4242 4242 4242`. Pour jouer la recette Playwright il
faudra `PAYMENT_PROVIDER=fake` (A220) — non posé, volontairement.

**Comptes du jeu d'essai** — mot de passe commun **`Yamba-Dev-2026!`** (écrit en clair dans
`apps/e2e/src/fixtures/comptes.ts` et `seed-deals.ts`, il ne vaut que sur une base de
développement) :

| Expéditeurs | Voyageurs (onboarding + Stripe complets) |
|---|---|
| `aminata.shipper@seed.yamba.dev` | `thomas.carrier@seed.yamba.dev` |
| `pauline.shipper@seed.yamba.dev` | `marc.carrier@seed.yamba.dev` |
| `joao.shipper@seed.yamba.dev` | `ines.carrier@seed.yamba.dev` |
| `chinwe.shipper@seed.yamba.dev` | `adebayo.carrier@seed.yamba.dev` |
| `mai.shipper@seed.yamba.dev` | `linh.carrier@seed.yamba.dev` |
| `marieclaire.shipper@seed.yamba.dev` | `josephine.carrier@seed.yamba.dev` |

Code de livraison de tout deal déjà pris en charge : **`742891`**.

**61 fichiers non suivis** traînent dans l'arbre (dossiers `apps/e2e/resultats-*`, les
`AGENTS.md` / `CLAUDE.md` des apps, `.expo/`, `apps/yamba-logo-kit/`). C'est **voulu** — ne
jamais faire `git add apps/<app>` nu, toujours des pathspecs explicites.

---

## 5. Ce qui reste ouvert, par ordre de valeur

### Sur la page de résultats (nommé au registre dans D99)

1. **L'ancrage de prix.** Rien ne dit si 24,85 € est cher. Une comparaison à un transporteur
   classique (« DHL : ~85 € pour 2 kg ») transformerait la page de « combien ça coûte » en
   « combien tu économises ». **Le plus fort levier de conversion restant**, et la donnée
   existe déjà côté tarification.
2. **Les filtres de mode à 0 résultat** (« Train 0 », « Voiture 0 ») : un geste sans issue.
3. **Le titre « Confiance et sécurité »** rendu sans condition par
   `SearchFiltersSidebar.tsx:364` alors que son contenu est filtré à `count > 0` — titre
   orphelin dès qu'aucune option n'a de résultat.
4. **Le bouton flottant BLEU du mobile**, hors charte (mangue + teal), posé par-dessus la
   rangée de filtres. Il se lit comme un outil de développement resté visible.

### Dette nommée, et c'est la plus lourde

**`apps/user-ui` n'a AUCUNE cible de test, aucun `jest.config`, zéro fiche.** La plus grosse
application du dépôt, invisible aux dix-neuf contrôles. C'est mot pour mot le constat qui a
justifié A223 pour le mobile. Lot à part, nommé **« l'A223 du site »**.

En attendant, deux fiches du harnais mobile couvrent le web par ricochet : `pricing-example.spec.ts`
compare les deux copies du fichier **à l'octet près**, et une autre confronte la copie du mobile
au moteur partagé — donc la copie du site est validée par transitivité.

### Sur la passe de finitions d'auth

- La variante **modale** de la connexion monte le même composant (donc le parcours de D96) mais
  n'a jamais été revue pour elle-même.
- Les **~100 ternaires `fr ? … : …`** restants des formulaires d'auth : ces pages restent
  invisibles au contrôle i18n de la CI tant qu'ils y sont.
- Le disque de 11 px du lien « Renvoyer le code » (`OtpVerifyView`) garde sa forme : ce n'est
  pas un CTA, mais c'est le seul indicateur du produit qui ne soit pas une vague.

### Ménage

Deux branches distantes fusionnées traînent : `feat/carte-resultat-prix` et
`feat/carte-resultat-mention`. Rien ne s'y perd, GitHub garde un bouton « Restore » sur les PR.
`feat/finitions-tunnel` a déjà été supprimée.

---

## 6. Les leçons de ces deux jours, pour ne pas les repayer

**Un effet d'interface ne se raisonne pas, il se regarde** (D98). D95 était argumentée, mesurée,
et portait trois défauts nommés à son actif — son effet a été rejeté à la seconde où il a été vu
à l'écran, un mois plus tard. Cinq dispositions ont été posées et jugées dans la même journée.
D98 est donc gravée **après** le code, par exception assumée.

**Quand un retour de recette ne colle pas au code sous vos yeux, cherchez ce qui a été
SUPPRIMÉ.** `git log -S "LoadingDots" -- apps/mobile` a retrouvé le mot de l'utilisateur
(« points pulsés ») dans le commit qui les avait posés un mois plus tôt.

**Un contrôle qui affiche une valeur qu'il n'applique pas est pire qu'un contrôle vide** (D99).
`weightKg ?? 2` à l'affichage, `null` dans l'état : rien n'était envoyé, la carte retombait sur
un 2 kg codé en dur, et les deux nombres coïncidaient **par hasard**.

**Un paramètre peut porter deux pouvoirs.** `weightKg` enrichissait *et* filtrait : un défaut
hérité du filtrage aurait retiré des trajets d'une page intitulée « Tous les trajets
disponibles », sans erreur, sans log.

**Deux fronts corrigés dans la même passe divergent quand même**, si l'un garde une structure
que l'autre n'a jamais eue. La fiche de parité comparait les règles, pas l'**ordre** — c'est
l'utilisateur qui l'a vu en ouvrant les deux écrans côte à côte.

**Une fiche doit épingler ce qui survit à un changement d'avis** : taille du bouton figée, nom
accessible préservé, mêmes chiffres des deux côtés — et non l'effet du jour, qui a changé cinq
fois en vingt-quatre heures.

**`slice(a.indexOf(x), a.indexOf(y))` sans l'offset de départ rend une chaîne VIDE**, qui passe
toutes les assertions `not.toContain` : une fiche verte pour la pire des raisons.

**On vise l'usage, jamais le mot.** `not.toContain('ActivityIndicator')` échoue sur le
commentaire qui explique sa disparition — et un fichier bien écrit explique ce qu'il a cessé de
faire. Payé trois fois en deux jours.
