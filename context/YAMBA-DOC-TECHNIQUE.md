

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

## Tests

Plateforme inchangée (**1000** + auth 230) : aucun code de service touché. `apps/e2e` : **332 scénarios** (321 + 11).
web-mob 10/10 et web-msg 21/21 rejoués après l'extraction des gardes et l'assouplissement du page object. Typecheck
user-ui et harnais verts.
