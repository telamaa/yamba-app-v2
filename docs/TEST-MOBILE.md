# Yamba — Tester l'app sur mobile via Wi-Fi local

Procédure pour tester `user-ui` sur un vrai appareil mobile (iPhone, Android) connecté
au même réseau Wi-Fi que ton Mac de dev, avec accès complet à l'`api-gateway` et aux
services backend.

---

## 🛠 Configuration initiale (à faire une seule fois)

### 1. CORS du gateway

Dans `apps/api-gateway/src/main.ts`, remplace la config CORS hardcodée par une regex
qui accepte automatiquement n'importe quelle IP du réseau local. Plus besoin de modifier
le code à chaque changement d'IP :

```ts
app.use(
  cors({
    origin: (origin, callback) => {
      // Requêtes sans origin (curl, server-to-server) : autoriser
      if (!origin) return callback(null, true);
      const allowed = [
        /^http:\/\/localhost:3000$/,
        /^http:\/\/192\.168\.\d+\.\d+:3000$/,  // Wi-Fi domestique
        /^http:\/\/10\.\d+\.\d+\.\d+:3000$/,    // Réseau d'entreprise
      ];
      if (allowed.some((re) => re.test(origin))) return callback(null, true);
      return callback(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
    // ... autres options
  })
);
```

### 2. (Optionnel) Fichier `.env.local.mobile` à swap

Crée `apps/user-ui/.env.local.mobile` avec ton IP locale en dur. Tu pourras swap
rapidement entre les 2 configs :

```env
# .env.local.mobile — pour test sur appareil réel
NEXT_PUBLIC_API_BASE_URL=http://192.168.1.155:8080/api
NEXT_PUBLIC_SERVER_URI="http://192.168.1.155:8080"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
# Ajoute toutes les autres NEXT_PUBLIC_* nécessaires
```

Et garde ton `.env.local` actuel avec `localhost` pour le dev normal.

---

## 📱 Avant chaque session de test mobile

### 1. Récupère ton IP locale

```bash
ipconfig getifaddr en0
```

(`en0` = Wi-Fi sur Mac. Si Ethernet, essaie `en1`.) Note la valeur — appelons-la `IP_MAC`.

> ⚠️ Ton IP change parfois (redémarrage du routeur, DHCP lease, changement de réseau).
> Vérifie à chaque session.

### 2. Modifie `apps/user-ui/.env.local` pour pointer vers `IP_MAC`

```env
NEXT_PUBLIC_API_BASE_URL=http://IP_MAC:8080/api
NEXT_PUBLIC_SERVER_URI="http://IP_MAC:8080"
```

(Garde tes autres variables — Stripe key, etc. — intactes.)

Ou si tu utilises `.env.local.mobile` (config initiale step 2) :

```bash
cd apps/user-ui
mv .env.local .env.local.dev
cp .env.local.mobile .env.local
```

### 3. Démarre les services dans l'ordre

Dans 4 terminaux séparés :

```bash
# Terminal 1
npx nx serve auth-service

# Terminal 2
npx nx serve trip-service

# Terminal 3
npx nx serve api-gateway

# Terminal 4 — user-ui exposé sur le réseau
npx nx dev user-ui -H 0.0.0.0
```

Le terminal 4 doit afficher :
```
- Local:    http://localhost:3000
- Network:  http://IP_MAC:3000
```

> Les services `auth-service` et `trip-service` peuvent rester sur `localhost`
> (ils sont appelés en interne par le gateway). Seuls `api-gateway` et `user-ui`
> doivent être accessibles depuis le réseau.

### 4. Sanity-check depuis le Mac avant le mobile

```bash
# user-ui répond sur l'IP réseau ?
curl http://IP_MAC:3000/fr | head -20

# Gateway répond sur l'IP réseau et CORS OK ?
curl -v -H "Origin: http://IP_MAC:3000" http://IP_MAC:8080/api
# Cherche : Access-Control-Allow-Origin: http://IP_MAC:3000
```

Si les 2 répondent → réseau OK, sors le téléphone.

### 5. Connecte ton mobile au même Wi-Fi puis va sur

```
http://IP_MAC:3000/fr
```

---

## 🔧 Troubleshooting

| Symptôme | Cause probable | Fix |
|---|---|---|
| Mobile bloqué sur "chargement" / timeout | Firewall macOS | Préférences Système → Sécurité → Pare-feu → autoriser Node.js (ou désactiver temporairement) |
| "Une erreur est survenue" silencieuse | CORS bloque le pre-flight | Vérifier que le gateway autorise `http://IP_MAC:3000` (config initiale step 1) + le gateway a bien été **redémarré** après la modif |
| Erreurs réseau sur le mobile alors que le Mac fonctionne | `.env.local` du user-ui pointe encore sur `localhost` | Vérifier `apps/user-ui/.env.local` → relancer `user-ui` (les `NEXT_PUBLIC_` sont inlinées au démarrage) |
| Apple Pay / Google Pay invisibles dans Stripe | HTTP non sécurisé | Normal — ces moyens nécessitent HTTPS. CB de test (`4242 4242 4242 4242`) fonctionne en HTTP |
| Hot reload qui ne se propage pas sur le mobile | Cache Safari/Chrome | Pull-to-refresh sur iOS, ou recharger en onglet privé |
| Console mobile inaccessible | Inspector pas activé | iPhone : Réglages → Safari → Avancé → Inspecteur Web. Mac : Safari → menu Développement → ton iPhone (connecté en USB) |

### Debug avancé : Remote Inspector Safari (iPhone)

1. iPhone → Réglages → Safari → Avancé → activer **Inspecteur Web**
2. Mac → Safari → Préférences → Avancées → cocher **Afficher le menu Développement**
3. Connecte l'iPhone en USB
4. Sur l'iPhone, ouvre la page Yamba
5. Sur le Mac, Safari → menu **Développement** → choisis ton iPhone → la page apparaît
6. Tu as la console JS + Network + Elements comme dans Chrome DevTools

### Debug avancé : Remote Inspector Chrome (Android)

1. Android → Paramètres → À propos → tape 7× sur "Numéro de build" pour activer le mode développeur
2. Paramètres → Options pour les développeurs → activer **Débogage USB**
3. Connecte en USB au Mac
4. Dans Chrome Mac : `chrome://inspect` → ton appareil apparaît → bouton **Inspect** sur la page

---

## 🧹 Cleanup — revenir au dev local normal

Quand tu as fini de tester sur mobile :

### 1. Restaure `.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api
NEXT_PUBLIC_SERVER_URI="http://localhost:8080"
```

Ou swap inversé si tu utilises `.env.local.mobile` :

```bash
cd apps/user-ui
mv .env.local .env.local.mobile
mv .env.local.dev .env.local
```

### 2. Redémarre `user-ui` une dernière fois

Pour que les variables `localhost` soient reprises.

### 3. Aucun cleanup nécessaire côté gateway

La config CORS regex accepte aussi bien `localhost:3000` que les IPs réseau, donc elle
reste en place sans effet de bord en dev local.

---

## 📋 Checklist rapide (cheatsheet)

```
☐ ipconfig getifaddr en0           → noter IP_MAC
☐ Modifier .env.local              → IP_MAC dans NEXT_PUBLIC_*
☐ Lancer auth-service              → terminal 1
☐ Lancer trip-service              → terminal 2
☐ Lancer api-gateway               → terminal 3 (sur 0.0.0.0 par défaut)
☐ Lancer user-ui sur 0.0.0.0       → terminal 4 (npx nx dev user-ui -H 0.0.0.0)
☐ curl test depuis Mac             → user-ui + gateway OK
☐ Mobile sur le même Wi-Fi         → ouvrir http://IP_MAC:3000/fr
☐ Inspector Safari/Chrome si bug   → debug réel sur l'appareil
```

---

## 💡 Notes spécifiques Yamba

- **Booking wizard** : `BookingClient.tsx` utilise actuellement `mockTrip` en dur,
  donc le `tripId` de l'URL est ignoré. Tu peux tester le flow sur n'importe quelle
  URL `/trips/<id>/book`. Pour brancher sur un vrai trip de la BDD, il faudra modifier
  `BookingClient.tsx` pour fetch via le gateway (PR séparée).

- **Stripe Elements** : `<PaymentElement>` fonctionne en HTTP avec carte de test.
  `Apple Pay` / `Google Pay` n'apparaissent qu'en HTTPS — pour les tester, il
  faudrait ajouter un tunnel type ngrok ou Cloudflare Tunnel devant `user-ui`.

- **Auth & sessions** : les refresh tokens Redis (`refresh_jti:{userId}:{jti}`) sont
  par-session, donc te connecter sur ton mobile ne déconnectera pas ton Mac. ✅
