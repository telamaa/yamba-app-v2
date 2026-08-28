# Fiche technique — chore « le build de production passe à nouveau »

> Branche `chore/prod-build-suspense` · base `dev` · 4 pages · **PR #81** (mergée dans `dev`)

## Symptôme
`npx nx build user-ui` (= `next build`) sortait en **échec** à l'étape « Generating static pages » :
`useSearchParams() should be wrapped in a suspense boundary at page "/[locale]/refresh"` → `Export encountered an error … exiting the build`. Aucun `prerender-manifest.json`, donc `next start` impossible : **l'app n'était pas déployable**. Invisible en CI (elle ne fait que `tsc`) et en dev (`next dev` ne pré-rend pas).

## Cause
Next.js pré-rend statiquement les pages sans données dynamiques. Un composant client qui appelle `useSearchParams()` force un rendu côté client (« CSR bailout ») ; Next exige alors une **frontière `<Suspense>`** au-dessus pour pouvoir livrer le reste de la page en statique. Quatre pages rendaient un tel composant sans frontière : `(auth)/refresh` (`RefreshGate`), `carrier/onboarding` (`CarrierOnboardingWizard`), `carrier/onboarding/stripe/callback` (`StripeCallbackPage`), `trips/create` (`useEditTrip` lit `?edit=`). Les pages auth (login, verify…) sont `force-dynamic` : non pré-rendues, non concernées.

## Correctif
`<Suspense fallback={null}>` autour du composant dans chacune des 4 `page.tsx` — aucun changement de comportement à l'exécution (le fallback ne s'affiche qu'au pré-rendu).

## Vérification (faite)
`npx nx build user-ui` → exit 0, 57 pages générées ; `next start -p 3001` démarre ; `/fr/search`, `/en/search`, `/fr` répondent en **6–11 ms**.

## À faire (registre / CI)
Ajouter **`next build` de user-ui aux checks requis** (un 14ᵉ check) : c'est le seul moyen d'attraper cette classe d'erreur avant un déploiement. Proposé comme D-next « la CI construit ce qu'elle déploie ».
