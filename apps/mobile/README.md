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

> Les scripts portent `NODE_PATH=./node_modules` : la génération des types de routes du CLI
> (`@expo/router-server`, installé à la RACINE du workspace) fait un `require('expo-router/…')`
> alors qu'`expo-router` est NICHÉ ici (ses pairs — react 19.2.3, expo — y vivent) ; sans ce
> repli de résolution CJS, `expo start` meurt à froid en `MODULE_NOT_FOUND`. `expo export`
> ne passe pas par cette génération — c'est pourquoi le défaut a survécu aux preuves du socle.

Le poste (simulateurs, comptes, EAS) est décrit dans
`docs/livrables/06-YAMBA-PREPARATION-MOBILE.md`.

## Build de développement (EAS) — pour les moyens de paiement réels

Expo Go ne contient aucun module natif : la feuille de paiement Stripe, Apple Pay et
Google Pay **ne s'y ouvriront jamais**. Elles demandent un *build de développement*
(`expo-dev-client`), compilé **à distance** par EAS — ce Mac ne peut pas compiler iOS
localement (livrable 06, § 5). C'est l'objet de D82.

```sh
npx nx start @yamba-app/mobile           # Expo Go (recette courante, inchangée)
cd apps/mobile && npm run start-dev-client   # Metro pour le build de developpement
```

> `npm start` porte désormais `--go` EXPRÈS : installer `expo-dev-client` fait basculer
> `expo start` en mode build natif par défaut, et le code à scanner cesse de fonctionner
> dans Expo Go. Les deux modes restent donc accessibles, chacun par son script.

Le premier build, une fois (il écrit `extra.eas.projectId` dans `app.json`) :

```sh
npx eas login
npx eas init
npx eas build --platform android --profile development   # ~20 min, rend un .apk a installer
```

Trois faits à connaître avant de lancer :

- **L'identifiant applicatif est `com.telama.yamba`** (Android `package`, iOS
  `bundleIdentifier`). Il est **définitif** dès la première publication sur un magasin.
- **Google Pay ne se teste que sur un appareil Android physique** (jamais un émulateur),
  et l'API Google Pay est activée par le plugin de configuration Stripe (`enableGooglePay`).
- **Apple Pay n'est pas encore configurable** : il réclame un compte développeur Apple
  (99 $/an), un *merchant ID* et un certificat. Le `merchantIdentifier` du plugin reste
  donc ABSENT tant que ce compte n'existe pas — iOS vient après Android (D82 2A, D73).

La clé publiable (`EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`) vit dans le `.env` **RACINE** :
mesuré le 21/10/2026, `npx nx start @yamba-app/mobile` le charge, `npm start` lancé à la
main non. Sans elle, l'écran de paiement répond `UNAVAILABLE` — et le dit.

## État du socle

- Scaffold Expo 57 intégré au workspace npm (react est niché sous
  `apps/mobile/node_modules` — voulu : Metro résout depuis l'app).
- Identité : nom, scheme `yamba`, thème mangue `#FF9900` / teal `#0F766E`, clair/sombre.
- Client API par jetons (A201) : Bearer + refresh en SecureStore, base URL dérivée du
  `hostUri` de Metro — téléphone et émulateur joignent le gateway sans config (`src/lib/api/`).
- i18n (A202) : `use-intl` — le moteur de next-intl —, dictionnaires `messages/{fr,en}/`
  vérifiés par LE MÊME contrôle CI que le web ; langue = préférence du compte sinon
  l'appareil (D44), envoyée en `x-locale`. Pas de `metro.config.js` : la « sticky
  resolution » d'Expo 57 dédoublonne react, les `paths` du tsconfig suffisent à Metro.
- **Restent des placeholders** : icônes et splash (images du template Expo) — vrais
  assets à produire avant tout build de store ; identifiant applicatif
  (`android.package` / `ios.bundleIdentifier`) à trancher avant le premier `prebuild`.
- Onglets natifs faits (A203) ; `expo-dev-client` + `eas.json` posés (D82, build de
  développement ci-dessus). À venir (socle) : push et liens profonds.
