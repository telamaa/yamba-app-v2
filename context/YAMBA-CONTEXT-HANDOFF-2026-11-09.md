# Handoff — 09/11/2026 · `feat/mobile-tabbar` (PR #401 ouverte) · pile de quatre PR mobiles

*Point d'entrée de reprise — remplace le handoff du 17/10. État établi par MESURE
(`git log`, `gh pr`, `gh pr checks`, `lsof`, `curl`), jamais de mémoire. La session du 08/11
au soir a livré D88 en entier : la barre d'onglets dessinée, puis la porte d'identité.*

---

## 1. L'état, en une ligne

`feat/mobile-tabbar` porte **3 commits propres** (`1ae20c8`, `b4ca6ec`, `47c157f`), poussés,
**PR #401 ouverte sur `dev`**, 18 contrôles lancés. La branche est **empilée** sur deux PR
encore ouvertes, donc les 4 commits D85/D86 apparaissent dans #401 tant qu'elles ne sont pas
mergées.

## 2. La pile de PR, et le piège qu'elle a révélé

| PR | Branche | Base | Contenu | Contrôles |
|---|---|---|---|---|
| #399 | `feat/new-logo` | `dev` | D85 — le logo « Porter » | **18** |
| #400 | `feat/mobile-logo` | `feat/new-logo` | D86 — la marque dans l'app native | **0** ⚠️ |
| **#401** | `feat/mobile-tabbar` | **`dev`** | **D88 — barre dessinée + porte d'identité** | **18** |

> ⚠️ **#400 vole à l'aveugle.** Mesuré le 08/11 : `gh pr checks 400` → *« no checks reported on
> the 'feat/mobile-logo' branch »*. Le workflow **ne se déclenche que sur les PR qui ciblent
> `dev`** — c'est exactement la leçon déjà payée sur #263, et elle vient de se reproduire.
> **Geste à faire avant tout merge** : recibler #400 sur `dev` (`gh pr edit 400 --base dev`),
> attendre les 18 contrôles, les COMPTER. Sans ça, D86 entrerait dans `dev` sans qu'aucune CI
> ne l'ait vu.

Ordre de merge : **#399 → #400 (reciblée) → #401**. Chacune recomptée à 18.

## 3. Ce que D88 contient, par commit

| Commit | Lot |
|---|---|
| `1ae20c8` | **La barre d'onglets dessinée** (D88 0A–6A) : sortie de `NativeTabs`, escamotage par valeur partagée Reanimated, géométrie prise sur la référence, sélection en encre, « Accueil » + maison sans porte, écran de bienvenue au thème, extraction de `invite-kit` |
| `b4ca6ec` | **La porte d'identité** (D88 7A/8A) : un discours par destination, composition d'Airbnb, règle du poids des CTA, photo de profil, `signIn` qui enchaîne `me()`, **fix `getInitials`** |
| `47c157f` | **Les docs** : registre + trois cumulatifs, **+204 / +82 / +318, zéro suppression** |

### Fichiers neufs

- `apps/mobile/src/components/tab-bar.tsx` — la barre dessinée.
- `apps/mobile/src/lib/tab-bar-visibility.tsx` — la valeur partagée + `useTabBarHideOnScroll()`.
- `apps/mobile/src/components/invite-kit.tsx` — les teintes partagées + la grammaire de la
  bienvenue (elle **seule** : la porte a sa propre composition).

### Les quatre décisions à ne pas défaire sans rouvrir D88

1. **`PILL_RADIUS = PILL_HEIGHT / 2`** — une LOI, pas une valeur. Écrire `21` recréerait le
   décalage des deux bouts le jour où la hauteur change.
2. **La mangue appartient à « Publier »** — l'onglet actif se signale en encre. Une teinte de
   marque sur l'onglet actif vole au squircle le privilège qui le fait lire comme une action.
3. **Le poids du bouton épouse le poids du moment** — la bienvenue empile pleine largeur
   (écran de décision), la porte met deux boutons compacts côte à côte (interruption).
   « Harmoniser » les deux reviendrait à dire que tous les moments se valent.
4. **`invite-kit` ne porte PAS « le modèle servi partout »** — seulement les teintes, la
   typographie du corps, et la grammaire de la bienvenue.

## 4. L'environnement local, tel qu'il tourne

```
8081  Metro (expo start --go)          LANCÉ
8080  gateway                          LANCÉ
6001  auth-service   mongo 7 ms · redis 25 ms   LANCÉ
6002  trip-service   mongo 6 ms · redis 26 ms   LANCÉ
6003  deal-service          —    6004  notification   —    6005  message   —
3000  user-ui               —    3001  admin-ui       —
```

**Trois services seulement, délibérément** : la pile complète fige ce Mac. Conséquences
assumées pendant la recette — les badges d'onglets restent à zéro (deal et message muets, un
badge en échec vaut zéro et ne casse rien), et `GET /api/status` répond `down`, ce qui est
**exact** et non un défaut.

**Piège rencontré, à ne pas repayer** : l'app affichait « Impossible de charger les trajets »
et ce n'était pas un défaut de l'app — **aucun service ne tournait**. Vérifier `lsof -nP
-iTCP:8080 -sTCP:LISTEN` avant de chercher ailleurs.

## 5. Le seul contrôle qui prouve qu'une app RN se construit

```sh
curl -s -o /tmp/b.js -w "%{http_code}\n" \
  "http://localhost:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false"
grep -o "__workletHash" /tmp/b.js | wc -l      # 551 — le plugin de worklets a tourné
```

Deux pièges : l'entrée n'est **pas** `/index.bundle` (avec expo-router c'est une entrée
**virtuelle**, `index` renvoie une 404 d'introuvable) ; et un `nx typecheck` vert ne prouve
rien sur la résolution de modules ni sur Babel — leçon `esModuleInterop` du 05/09.

Ce projet n'a **aucun** `babel.config.js` : `babel-preset-expo` ajoute seul
`react-native-worklets/plugin` dès que le paquet est installé (vérifié dans
`configs/expo.js:97`).

## 6. Ce qui reste ouvert sur D88

| Sujet | Pourquoi ce n'est pas fait |
|---|---|
| **Le rendu Android** | Aucun simulateur iOS ne le dit, et c'est là que `LinearTransition` est le plus risqué. Le flou y est un repli translucide — une barre qui flotte au-dessus de n'importe quel écran ne peut pas désigner de `BlurTargetView` |
| **Les retours haptiques** | Non câblés |
| **Le vide du bas de la porte (~50 %)** | C'est la place exacte où **montrer** deux ou trois trajets réels estompés plutôt que de les décrire. Lot à part, non chiffré — le meilleur levier de conversion restant |
| **Le bouton secondaire plus large que le primaire** | 165 pt contre 135 : l'œil pèse la taille autant que l'aplat. Changer le mot coûterait la cohérence avec le reste de l'app |
| **La pastille de badge reste mangue** | Par la règle de la sélection elle devrait être rouge (convention des compteurs) ; 17 px, sémantique différente. **Arbitrage non rendu** |
| **Les textes des portes ne sont pas pilotables** | Dix clés par langue dans le dépôt : les changer exige une publication store. C'est **D87**, dont la bienvenue est déjà le premier consommateur en attente |

## 7. Pas de tests, et ce n'est pas un contournement de D30

`apps/mobile` n'a **pas** de harnais de tests sur `dev` : il arrive avec **#396**
(`chore/mobile-test-harness`, 336 fiches), encore ouverte. Il n'y a donc pas d'endroit où
poser des tests. Les deux règles pures qui mériteront une fiche dès que #396 sera mergée :

- **`getInitials`** — les six formes (nom complet, initiale déjà tronquée, prénom et nom
  composés, accent, espaces de tête, vide) ;
- **le seuil cumulé** de `useTabBarHideOnScroll` — la logique de cumul et de remise à zéro est
  pure, extractible, et c'est elle qui empêche le papillotement.

## 8. Les PR mobiles encore ouvertes, au-delà de la pile

#393 (D82 moyens à redirection), #394 (A221 suivi natif), #395 (A222 recours et notation),
#396 (A223 harnais de tests), #397 (D83 écran de paiement), #398 (D84 police de marque).
**Huit PR ouvertes au total** avec #399/#400/#401 — la file est longue, et plusieurs touchent
`apps/mobile`. Prévoir des résolutions de conflit sur les trois documents cumulatifs :
**toujours la même**, ajout contre ajout, les deux côtés prouvés comme des ajouts purs à
l'ancêtre avant d'être recollés, **0 suppression**.

## 9. Journal de la session du 08/11

| Heure | Action |
|---|---|
| ~21 h | Reprise : D88 gravée au registre, seul 6A codé (`welcome.tsx` au thème) |
| 22 h 09 | Barre dessinée livrée, vue à l'écran — première capture |
| 22 h 21 | Le mot passe sous l'icône, police 10, maison sans porte |
| 22 h 44 | Barre à la gouttière du haut, cinq parts égales, sélection en encre |
| 23 h 04 | Porte d'identité : un discours par destination |
| 23 h 12 | Porte en composition Airbnb, CTA côte à côte |
| 23 h 15 | Revue : `maxWidth` retiré, deux corps resserrés |
| ~00 h | Services lancés (gateway, trip, auth), fix `getInitials` |
| 00 h 30 | Docs, trois commits, push, **PR #401** (18 contrôles) |
