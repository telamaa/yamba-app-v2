

---

# Chapitre 7 du cahier 01-WEB : la non-régression — douze gardes, et deux fonctions mortes retrouvées

*(PR `chore/recette-web-7`, 13/09/2026.)*

## Ce qui a été fait

Le chapitre « Non-régression » du cahier 01-WEB : douze points qui ont déjà cassé, joués en un fichier
(`web-nrg.spec.ts`, 11 scénarios — NRG-6 et 12 partagent un relevé). Tous conformes, trois après correction ; trois
anomalies closes (`ANO-WEB-103` à `105`).

```
apps/e2e/src/chapitres/web-nrg.spec.ts                                   11 scénarios, non séquentiels
apps/e2e/src/pages/ecran.ts                                              NOUVEAU — gardes d'écran + écoute de console
apps/e2e/src/chapitres/web-mob.spec.ts                                   importe les gardes au lieu de les définir
apps/e2e/src/fixtures/jeu-essai.ts                                       tousLesTrajets()
apps/e2e/src/pages/mes-trajets.ts, fil-messagerie.ts                     actionDuMenu() ; « Proposer un autre »
apps/user-ui/src/components/dashboard/sections/FinancesSection.tsx       ANO-WEB-103 (onglet dérivé) + ANO-WEB-104 (le serveur décide)
apps/user-ui/src/components/layout/header/HeaderShareTripCTA.tsx         ANO-WEB-105 (nom accessible complet)
```

## ANO-WEB-104 : un front qui décidait à la place du serveur

```tsx
// Avant
const stripeAccountReady = Boolean(user?.carrierPage?.stripeAccountId);
<button onClick={stripeAccountReady ? openStripe : () => toast.info(t("stripeMissing"))}>
```

`/auth/me` sert `carrierPage` par une **liste blanche** (règle non négociable des DTO) : `stripeOnboardingComplete`,
`stripeChargesEnabled`… jamais `stripeAccountId`. La condition était donc toujours fausse — pour tous les
Voyageurs, et sans aucune erreur : un toast d'information poli, un serveur jamais appelé. Le serveur, lui, fait déjà
le bon contrôle, dans le bon ordre :

```ts
await requireSudo(req);                       // 403 SUDO_REQUIRED → la porte par code
if (!carrierPage?.stripeAccountId) return next(new ConflictError("…", { type: "carrier", code: "STRIPE_ACCOUNT_MISSING" }));
```

Correction : `onClick={openStripe}` toujours, et le front traduit les deux codes (`SUDO_REQUIRED` → la porte,
`STRIPE_ACCOUNT_MISSING` → « Finalise d'abord ton compte Stripe »). C'est A146 appliquée : le code de refus arrive au
client, le client ne devine pas.

## ANO-WEB-103 : `useState` n'est pas réactif

```tsx
// Avant : évalué UNE fois, au montage — `user` n'est pas encore chargé, isCarrier vaut false
const [tab, setTab] = useState<FinancesTab>(isCarrier ? "wallet" : "payments");
// Après : dérivé tant que le membre n'a pas choisi
const [choix, setTab] = useState<FinancesTab | null>(null);
const tab: FinancesTab = choix ?? (isCarrier ? "wallet" : "payments");
```

L'argument de `useState` est une valeur **initiale** : ce qui change ensuite (ici, l'arrivée du membre) ne la met pas
à jour. En navigation interne, le cache de TanStack Query sert `user` dès le premier rendu et le défaut disparaît ;
à l'ouverture directe de `/dashboard/finances`, il est systématique.

## NRG-10 : mesurer contre la production, pas contre le poste

Le poste relève les plafonds du limiteur (`RATE_LIMIT_ANONYMOUS_MAX=2000`, `RATE_LIMIT_AUTHENTICATED_MAX=5000`) pour
que la recette ne se bloque pas elle-même. « Aucun 429 sur le poste » ne dit donc rien de la production. La fiche
importe les défauts du code (`RATE_LIMIT_ANONYMOUS`, `RATE_LIMIT_AUTHENTICATED` de
`packages/middleware/rate-limit-tier.ts`), mesure le coût d'une page (6,2 appels) et projette à un rythme humain.
La répartition par route est publiée : `GET /api/maintenance` à 1,99 par page — un seul composant qui lit au montage,
doublé par `page.goto` (rechargement) et le StrictMode de `next dev`. La mesure est donc pessimiste, et écrite comme
telle.

## Les gestes sensibles sans griller le quota, ni un compte

NRG-7 attend la réponse (`403` + `details.code === "SUDO_REQUIRED"`) et la porte à l'écran, puis s'arrête : aucun
« M'envoyer le code ». La suppression se joue sur un compte neuf créé par la fiche : confirmer « SUPPRIMER » sur un
compte du jeu d'essai qui aurait une fenêtre sudo ouverte l'effacerait pour de bon.

## Améliorations au GO : refuser franchement, et un type qui ne ment plus

- **CORS** (`apps/api-gateway/src/libs/origins.ts`) : `origineAutorisee(origin)` (pure), et un middleware AVANT `cors()`
  qui répond `403 { details: { code: "ORIGIN_NOT_ALLOWED" } }`. Pourquoi pas simplement `callback(null, false)` ? Parce
  que CORS protège la LECTURE de la réponse par le navigateur, pas l'EXÉCUTION de la requête : un formulaire d'un site
  tiers enverrait son POST, et le service l'exécuterait. Le refus doit couper la requête avant le proxy — NRG-11 le
  vérifie par un `POST /auth/login` d'une origine étrangère, refusé en 403.
- **`useUser`** : `stripeAccountId?` retiré du type `CarrierPage`. Un champ « optionnel » dans le type d'une réponse
  est une promesse que le compilateur ne peut pas vérifier ; retiré, toute lecture future échoue au typecheck.
- **NRG-10** mesure en deux phases : 6,0 appels par page par rechargement, **0,8 par liens** — la seconde est celle
  d'un membre réel.

## Tests

Plateforme inchangée (**1000** + auth 230) : aucun code de service touché. `apps/e2e` : **332 scénarios** (321 + 11).
web-mob 10/10 et web-msg 21/21 rejoués après l'extraction des gardes et l'assouplissement du page object. Typecheck
user-ui et harnais verts.

---

# Décision du 13/09 : le rôle prend la majuscule — « Voyageur », « Traveler », partout

*(PR `chore/recette-voyageur-majuscule`, 13/09/2026 — le point « à trancher » du chapitre 5.32.)*

Le produit écrivait tantôt « Voyageur » (le rôle), tantôt « le voyageur » (souvent le même rôle) ; en anglais,
« Traveler » et « the traveler ». Décision : **le rôle prend toujours la majuscule**, dans les deux langues.

- **Messages** : 71 valeurs réécrites par une expression qui ne touche QUE la valeur (le texte après `"clé": `) —
  aucune clé ne change, le miroir FR/EN reste parfait.
- **Code** : 33 lignes, uniquement dans les littéraux de chaîne et le texte JSX ; les commentaires (`// le voyageur a
  refusé`) ne sont pas du texte affiché et restent tels quels.
- **Emails** : une phrase de l'email d'accueil anglais (auth-service).
- **Garde** : règle `role-majuscule` dans `scripts/lexique-yamba.json`, avec des frontières Unicode
  (`(?<![\p{L}-])voyageu(r|rs|se|ses)(?![\p{L}])`, drapeau `u`, SANS `i` : c'est la minuscule qui est refusée). Contre-épreuve :
  « Lieu convenu avec le voyageur » réintroduit → refusé, clé nommée.
- **Harnais** : 12 citations mises à jour (web-fav, web-rch, web-rsv-devis, web-lit).

