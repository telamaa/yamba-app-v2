# Fiche technique — chore « ThemeProvider au root layout »

> Branche `chore/theme-provider-root` · base `dev` · 2 fichiers · **PR #80** (mergée dans `dev`)

## Symptôme
En dev, à chaque bascule FR ↔ EN : `Console Error — Encountered a script tag while rendering React component…` pointant `ThemeProvider` dans `app/[locale]/layout.tsx`.

## Cause
`next-themes` (0.4.6, dernière version) rend un `<script>` inline anti-flash. Il était monté dans le layout du segment **`[locale]`** : changer de locale = nouveau segment = **remontage côté client** du layout et de son provider → React 19 recrée le `<script>` pendant un rendu client et signale (à juste titre) qu'il ne sera pas exécuté. Sans effet fonctionnel (le script avait tourné au SSR), mais bruit permanent en dev et signal d'un provider mal placé.

## Correctif
Le `ThemeProvider` monte dans **`app/layout.tsx`** (root : `<html>`/`<body>`, jamais remonté) et entoure `{children}` ; retiré de `app/[locale]/layout.tsx`. Le thème n'a aucune dépendance à la locale ; tous les consommateurs (`UiPreferencesProvider`, `Header`, pages) restent sous lui.

## Vérification
`npx tsc --noEmit --project apps/user-ui/tsconfig.json` · ouvrir `/fr/search`, basculer EN puis FR : plus d'erreur console ; le thème (clair/sombre, système) est conservé à la bascule.
