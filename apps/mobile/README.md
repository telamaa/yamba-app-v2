# Yamba mobile

Client mobile Android / iOS de Yamba (jalon 4, D36 / D73) : React Native + Expo SDK 57
(nouvelle architecture, Expo Router, TypeScript strict). Une seule base pour les deux OS,
construite pour les deux dès le socle, publiée Android d'abord (D73).

Le mobile est **un client de plus des mêmes API** : mêmes contrats
(`@packages/api-contracts`), même moteur de prix, mêmes règles serveur. Auth par tokens
(refresh) — pas de cookies ; push via notification-service ; paiement Stripe Payment Sheet.

## Lancer

```sh
npx nx start @yamba-app/mobile      # ou : cd apps/mobile && npm start
npm run android                     # simulateur / appareil Android
npm run ios                         # simulateur iOS
```

Le poste (simulateurs, comptes, EAS) est décrit dans
`docs/livrables/06-YAMBA-PREPARATION-MOBILE.md`.

## État du socle

- Scaffold Expo 57 intégré au workspace npm (react est niché sous
  `apps/mobile/node_modules` — voulu : Metro résout depuis l'app).
- Identité : nom, scheme `yamba`, thème mangue `#FF9900` / teal `#0F766E`, clair/sombre.
- **Restent des placeholders** : icônes et splash (images du template Expo) — vrais
  assets à produire avant tout build de store ; identifiant applicatif
  (`android.package` / `ios.bundleIdentifier`) à trancher avant le premier `prebuild`.
- À venir (socle) : client API tokens + stockage sécurisé, i18n (messages JSON partagés),
  navigation par onglets natifs, `expo-dev-client` + EAS.
