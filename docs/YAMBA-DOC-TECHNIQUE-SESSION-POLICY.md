# Yamba — Documentation TECHNIQUE : Politique de session (D27)

> Public : dev backend (junior inclus). Prérequis de lecture : la doc métier (le pourquoi) ; ici, le comment.
> Fichiers de la PR `feat/session-policy` : `session-policy.ts` + spec (nouveau), `auth.helper.ts` et `auth.controller.ts` (modifiés), infra Jest auth-service, `main.ts` (retrait swagger), `ci.yml` (job tests en matrice), `.env.example`.

---

## 1. Architecture d'ensemble

Trois couches, du pur vers l'impur :

```
session-policy.ts        →  auth.helper.ts             →  auth.controller.ts
(calculs purs,               (Redis : store/get/revoke      (endpoints login /
 zéro dépendance,             du record de session)          refresh / logout)
 19 tests unitaires)
```

Le principe hérité de la trip state machine : **la logique décisionnelle est pure et testée, les couches d'I/O sont minces**. Toute la politique (fenêtres, plafonds, calcul de TTL) vit dans `session-policy.ts` sans un seul import de Redis ou d'Express — c'est ce qui permet les 19 tests avec horloge injectée.

## 2. Le modèle de données Redis

### 2.1 Avant / après

```
AVANT :  refresh_jti:{userId}:{jti} → "1"                          TTL fixe 7j/30j
APRÈS :  refresh_jti:{userId}:{jti} → {"createdAt":1752834000000,  TTL calculé
                                       "lastActivityAt":1752837600000,
                                       "rememberMe":false}
```

Une clé par session (le multi-session existant est conservé : PC, téléphone et tablette ont chacun leur jti et leur clé). Les trois champs :

- **`createdAt`** (epoch ms) — la date de création de la SESSION, pas du jti courant. C'est LE champ du fix : il est transporté de rotation en rotation et borne la vie absolue (SES-02).
- **`lastActivityAt`** — mis à jour à chaque rotation. Aucune logique ne le lit aujourd'hui ; il prépare SES-05 (affichage « actif il y a 2 h » dans le dashboard Sécurité).
- **`rememberMe`** — le profil de la session. Lu depuis Redis (source de vérité) et non depuis le JWT, sauf pour les sessions legacy.

### 2.2 L'astuce centrale : le TTL fait double emploi

```
TTL Redis = min( fenêtre d'inactivité , vie absolue restante depuis createdAt )
```

Deux règles métier, un seul mécanisme :

- **SES-01 (inactivité)** : si personne ne rafraîchit pendant la fenêtre, la clé expire toute seule. Une clé absente = session morte. Pas de cron de nettoyage, pas de comparaison de `lastActivityAt` — Redis EST le timeout.
- **SES-02 (plafond absolu)** : à chaque rotation, le TTL est recalculé depuis le `createdAt` D'ORIGINE. Plus la session vieillit, plus la « vie restante » rétrécit ; en fin de vie, c'est elle (et non la fenêtre d'inactivité) qui devient le TTL. La rotation ne peut mathématiquement plus repousser l'échéance — c'est exactement l'inverse de l'ancien code qui reposait un TTL plein à chaque fois.

Exemples chiffrés (défauts) : session standard neuve → TTL = min(60 min, 7 j) = 3600 s. Session standard à J6h23 → TTL = min(60 min, 1 h restante) = ~3600 s puis décroissant. Session rememberMe à J28 → TTL = min(7 j, 2 j restants) = 2 jours.

Le check applicatif `isAbsoluteExpired` dans `/auth/refresh` est une ceinture-bretelles : le TTL garantit déjà le plafond, mais on revérifie en cas d'écriture Redis manuelle ou d'horloge farfelue.

## 3. `session-policy.ts` — l'API pure

```typescript
loadSessionPolicy(env?)                       // config depuis env injecté, défauts sinon
inactivityWindowMs(rememberMe, config)        // 60 min ou 7 j
absoluteLifetimeMs(rememberMe, config)        // 7 j ou 30 j
remainingLifetimeMs(createdAt, rm, cfg, now)  // vie restante, jamais négative
isAbsoluteExpired(createdAt, rm, cfg, now)    // SES-02, frontière : à l'instant exact = expiré
computeSessionTtlSeconds(createdAt, rm, cfg, now)  // min(inactivité, restant), arrondi sup, 0 si mort
```

Points de design gravés par les tests :

- **Env injecté** : `loadSessionPolicy({})` en test, `loadSessionPolicy()` (= process.env) en prod. Toute valeur invalide (vide, non numérique, ≤ 0, décimale) retombe sur le défaut — jamais de crash ni de NaN qui donnerait des TTL absurdes.
- **`computeSessionTtlSeconds` retourne 0** pour une session absolument expirée : l'appelant DOIT refuser (Redis rejette `EX 0`). C'est un contrat, pas un détail.
- **Arrondi supérieur** : une session à 500 ms de sa fin obtient TTL = 1, jamais 0 par troncature.

Les 4 variables d'env (défauts entre parenthèses) : `SESSION_INACTIVITY_TIMEOUT_MINUTES` (60) · `SESSION_STANDARD_LIFETIME_DAYS` (7) · `SESSION_REMEMBER_INACTIVITY_DAYS` (7) · `SESSION_ABSOLUTE_LIFETIME_DAYS` (30).

## 4. `auth.helper.ts` — la couche Redis

Trois fonctions remplacent l'ancien duo `storeRefreshJti`/`hasRefreshJti` (supprimés, plus aucune référence dans le code) :

**`storeRefreshSession(userId, jti, rememberMe, createdAt = now)`** — écrit le record avec le TTL calculé et **retourne ce TTL**. Si 0 : rien n'est écrit, l'appelant refuse. Le paramètre `createdAt` est la clé du fix : au login on le laisse défaut (nouvelle session), à la rotation on passe celui de l'ancienne session.

**`getRefreshSession(userId, jti)`** — trois retours possibles : `SessionRecord` (format D27) · `"legacy"` (ancienne valeur `"1"`, ou JSON malformé — traité pareil) · `null` (clé absente : expirée OU réutilisée, indistinguables).

**`revokeRefreshJti(userId, jti?)`** — inchangé (une session, ou toutes via SCAN).

## 5. `auth.controller.ts` — les endpoints

### 5.1 `loginUser`
`sessionCreatedAt = Date.now()` → `storeRefreshSession(...)` → le JWT refresh est signé avec `expiresIn = vie absolue entière en secondes` (plus jamais `"30d"` littéral). Le payload gagne `sca` (session created at) — purement informatif, Redis reste la source de vérité.

### 5.2 `refreshAuthTokens` — la séquence complète

1. Extraire et vérifier le JWT refresh (inchangé).
2. `getRefreshSession` → si `null` : 401 message neutre « Session expired or invalid », cookies purgés.
3. Si `"legacy"` : accepter-et-migrer — `sessionCreatedAt = Date.now()` (la fenêtre absolue repart une fois), `rememberMe` lu du JWT faute de record. **Chemin à supprimer en PR de cleanup ≤ 30 j après la mise en prod** (quand toutes les sessions pré-déploiement auront expiré).
4. Sinon : `sessionCreatedAt = session.createdAt` et `rememberMe = session.rememberMe` (Redis fait foi, pas le JWT).
5. `isAbsoluteExpired` → si oui : révoquer + 401 « Session expired ».
6. Révoquer l'ancien jti, créer le nouveau : `storeRefreshSession(userId, newJti, rememberMe, sessionCreatedAt)` — **le même createdAt voyage**. Si le TTL retourné est 0 (course improbable : la vie absolue s'éteint entre le check et l'écriture) : 401 propre, rien n'a été écrit.
7. Signer les nouveaux JWT : accès 15 min, refresh borné à `remainingLifetimeMs` — le JWT lui-même rétrécit à chaque rotation.

### 5.3 `logoutUser` — inchangé (révocation du jti + purge cookies).

## 6. Tests et infra

**19 tests** dans `session-policy.spec.ts` : chargement env (défauts, valeurs valides, 5 formes d'invalidité), fenêtres par profil, vie restante et frontières strictes (à l'instant exact du plafond = expiré, jamais négatif), TTL min(inactivité, restant) dans les deux régimes, TTL 0 pour session morte, arrondi supérieur. Horloge et env injectés — zéro `new Date()`, zéro `process.env` dans les cas.

**Infra Jest auth-service** — deux pièges rencontrés, à connaître :

1. Le service avait déjà un `jest.config.cts` (scaffolding Nx d'origine, transform **@swc/jest** + `.spec.swcrc`) — invisible tant qu'aucun spec n'existait. Poser un second `jest.config.ts` fait refuser Jest (« multiple configuration files »). Résolution : conserver le `.cts` existant, supprimer le doublon. **Réflexe avant toute infra de test : `ls apps/<service>/jest.config.*` — les scaffoldings sont hétérogènes entre services** (trip-service n'avait rien, auth-service avait le .cts).
2. SWC transpile SANS typechecker : le typage des specs repose entièrement sur `tsconfig.spec.json` (types jest + node + express, **même géométrie rootDir/include que tsconfig.app.json**, `esModuleInterop` re-déclaré — les leçons du chantier 3bis appliquées d'emblée). Les specs sont exclus de `tsconfig.app.json` : le radar de prod ne les voit jamais.

**CI** : le job `tests` est désormais une **matrice** — `Tests unitaires (trip-service)` (projet Nx `@yamba-app/trip-service`) et `Tests unitaires (auth-service)` (projet `auth-service`, sans scope : les noms de projets Nx sont hétérogènes, harmonisation possible en PR chore). Les deux sont à mettre en required checks.

## 7. Plan de test manuel (recette)

Les trois indispensables (Redis Upstash requis, `redis-cli --tls -u <url>`):

1. **Le bug est mort** : login sans rememberMe → `TTL refresh_jti:{userId}:{jti}` ≈ **3600** (avant : 604800) et la valeur est un JSON.
2. **createdAt voyage** : noter `createdAt`, appeler `/auth/refresh`, relire sur le NOUVEAU jti → `createdAt` identique, seul `lastActivityAt` a bougé. Répéter : il ne bouge jamais.
3. **Inactivité accélérée** : `SESSION_INACTIVITY_TIMEOUT_MINUTES=1` en .env local → TTL 60 → attendre 70 s → refresh = 401 message neutre, cookies purgés.

Zèle sain : falsifier `createdAt` (-8 j) en Redis → 401 plafond absolu · poser `"1"` → le refresh migre en JSON neuf · rejouer un vieux jti après rotation → 401 · login rememberMe → TTL ≈ 604800.

## 8. Dettes et suites actées

- **PR cleanup legacy** (≤ 30 j post-prod) : supprimer le chemin `"legacy"` de `getRefreshSession` et du controller.
- **SES-03 sudo mode** : chantier propre (plusieurs endpoints sensibles), le plus important restant côté sécurité.
- **SES-04 front** : modal d'avertissement + déconnexion propre — le backend expose déjà tout le nécessaire.
- **SES-05 sessions actives** : le record contient déjà createdAt/lastActivityAt ; il manquera un enrichissement (user-agent, IP approximative) et l'endpoint de liste.
- **Conversion OpenAPI d'auth-service** : les contrats Zod dans `@packages/api-contracts` (le retrait swagger de cette PR en est le prérequis) — réutilisera `ErrorResponse`/`UnauthorizedResponse` de `common.ts`.
