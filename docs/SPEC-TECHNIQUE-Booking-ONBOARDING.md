# 🛠 Yamba — Spécification technique & guide d'onboarding développeur
## Toutes les notions techniques de la phase « Deal lifecycle frontend »

> **Version** 1.0 · 5 juillet 2026
> **Public** : Telama (fondateur) + tout développeur rejoignant le projet.
> **Objectif** : expliquer **pourquoi** et **comment** chaque techno et chaque pattern est utilisé, avec les pièges réels rencontrés pendant le build (section 12 — à lire absolument).
> **Document jumeau** : `SPECIFICATIONS-WORKFLOW-YAMBA.md` (les règles métier) — ce document-ci couvre le **comment technique**.

---

# 0. Vue d'ensemble de la stack

| Couche | Techno | Rôle |
|---|---|---|
| Monorepo | **Nx** | Un seul repo pour toutes les apps et libs partagées |
| Frontend | **Next.js 16 (App Router) + Turbopack** | Framework React full-stack, rendu hybride serveur/client |
| Langage | **TypeScript** (strict) | Typage statique — le contrat entre les modules |
| Styles | **Tailwind CSS** | Utilitaires CSS, dark mode par classe |
| i18n | **next-intl** | Traductions FR/EN, formats ICU |
| État serveur | **React Query** (TanStack) | Cache des données API (auth, listes) |
| Toasts | **Sonner** | Notifications éphémères + pattern undo |
| Icônes | **Lucide React** | Icônes SVG en composants |
| Backend (existant) | **Express TypeScript** (`auth-service` :6001, `trip-service` :6002, `api-gateway` :8080) | Microservices |
| BDD | **Prisma + MongoDB** · **Redis/Upstash** | ORM + sessions/rate-limit |
| Paiements | **Stripe Connect Express** (API `2026-03-25.dahlia`) | Séquestre + versements |
| Fichiers | **Cloudflare R2** | Stockage photos (à brancher) |
| Cartes | **Google Maps Places API** | Autocomplete lieux |

**Structure du monorepo** :

```
yamba-app/
├── apps/
│   ├── user-ui/          ← TOUTE la phase décrite ici vit là
│   ├── auth-service/
│   ├── trip-service/
│   └── api-gateway/
└── packages/libs/prisma/ ← schéma partagé
```

Commandes clés : `npx nx dev user-ui` (dev server port 3000) · `npx tsc --noEmit --project apps/user-ui` (vérification TypeScript, **la source de vérité**, cf. §12.5).

---

# 1. Next.js 16 — App Router

## 1.1 Le concept : le système de fichiers EST le routeur

Dans `apps/user-ui/src/app/`, **chaque dossier = un segment d'URL** et chaque `page.tsx` = une page. Les crochets `[param]` créent des segments dynamiques :

```
src/app/[locale]/bookings/[bookingId]/page.tsx        → /fr/bookings/abc123
src/app/[locale]/bookings/[bookingId]/report/page.tsx → /fr/bookings/abc123/report
src/app/[locale]/carrier/deals/[dealId]/deliver/page.tsx → /fr/carrier/deals/x/deliver
```

Le premier segment `[locale]` capture la langue (`fr`/`en`) — c'est next-intl qui l'exploite (§4).

> 💡 **Piège shell** : les crochets sont des caractères spéciaux en zsh. Toujours quoter les chemins : `mkdir -p 'src/app/[locale]/bookings/[bookingId]/rate'`.

## 1.2 Server Components vs Client Components

Par défaut, tout composant App Router est un **Server Component** : il s'exécute sur le serveur, n'embarque pas de JavaScript côté navigateur, et **ne peut pas** utiliser `useState`, `useEffect`, les événements (`onClick`)…

Dès qu'un composant a besoin d'interactivité, on le marque **`"use client"`** (première ligne du fichier). Chez nous, la répartition est systématique :

```tsx
// page.tsx — SERVER component : mince, il ne fait que router
import DealDeliverClient from "@/components/carrier/deal/views/deliver/DealDeliverClient";

type Props = { params: Promise<{ locale: string; dealId: string }> };

export default async function CarrierDealDeliverPage({ params }: Props) {
  const { dealId } = await params;          // ⚠️ params est une PROMISE en Next 15+
  return <DealDeliverClient dealId={dealId} />;
}
```

```tsx
// DealDeliverClient.tsx — CLIENT component : tout le state et l'interactivité
"use client";
export default function DealDeliverClient({ dealId }: Props) { ... }
```

**Règle maison** : les `page.tsx` sont toujours minces (extraire les params, rendre le Client). Toute la logique vit dans `src/components/`.

> ⚠️ **`params` est une Promise** depuis Next 15 : il faut `await params` dans un composant `async`. Oublier le `await` produit des erreurs cryptiques.

## 1.3 La convention `*Action` sur les callbacks

Next.js App Router émet l'erreur **TS71007** quand on passe une fonction non-sérialisable d'un Server vers un Client component. Pour désamorcer sa détection (et par convention d'équipe), **tous les callbacks passés en props sont suffixés `Action`** :

```tsx
type Props = {
  onConfirmAction: () => void;      // ✅ convention Yamba
  onBackAction: () => void;
  onCodeRegeneratedAction: (code: string, count: number) => void;
};
```

C'est **obligatoire** dans ce projet — un `onConfirm` sans suffixe sera refusé en review.

## 1.4 Navigation

On n'utilise **jamais** `next/navigation` directement, mais le wrapper i18n :

```tsx
import { useRouter } from "@/i18n/navigation";   // préfixe la locale automatiquement
const router = useRouter();
router.push("/bookings/" + bookingId);           // → /fr/bookings/xxx
```

## 1.5 Turbopack et le cache `.next`

Turbopack (le bundler) est rapide mais son cache est parfois périmé, **surtout après modification de code serveur** (comme `i18n/request.ts`). Le réflexe :

```bash
rm -rf apps/user-ui/.next && npx nx dev user-ui
```

Quand l'appliquer : après tout ajout de namespace i18n, après un switch de branche important, quand une erreur « impossible » persiste.

---

# 2. Architecture des modules frontend

## 2.1 Le pattern « module par domaine »

Chaque grand domaine fonctionnel = un dossier autonome dans `src/components/` contenant **ses types, son API, ses mocks et ses vues** :

```
components/
├── booking/booking-tracker/          ← côté Expéditeur
│   ├── booking-tracker.types.ts      ← types + constantes métier
│   ├── booking-tracker.api.ts        ← appels (mock) + garde-fous
│   ├── booking-tracker.state.ts      ← jeux de données mock
│   ├── BookingTrackerClient.tsx      ← ORCHESTRATEUR (switch sur le statut)
│   ├── BookingTrackerSkeleton.tsx
│   ├── shared/                       ← composants réutilisés entre vues
│   └── views/
│       ├── accepted/                 ← une vue = un dossier
│       ├── picked-up/
│       ├── in-transit/
│       ├── delivered/
│       └── report/
├── carrier/deal/                     ← côté Voyageur (même structure)
│   └── views/{request, accepted, pickup, tracking, deliver}/
└── rating/                           ← module PARTAGÉ (les 2 rôles)
```

**Pourquoi** : un nouveau dev peut comprendre un domaine entier sans sortir de son dossier ; le futur backend remplacera `*.api.ts` sans toucher aux vues.

## 2.2 Le pattern « orchestrateur → Desktop/Mobile »

Chaque vue suit une hiérarchie à 3 niveaux :

```
XxxClient.tsx      ← charge les données, tient le STATE, décide desktop/mobile
├── XxxDesktop.tsx ← layout grid [1fr_320px] + sidebar sticky
└── XxxMobile.tsx  ← empilement + header sticky + éventuelle bottom-bar
```

Le Client expose un type `XxxViewProps` (données + callbacks) consommé par les deux vues :

```tsx
// Dans DealDeliverClient.tsx
const shared = { deal, attemptsUsed, isLocked, onSubmitAction: handleSubmit, ... };
return isMobile ? <DealDeliverMobile {...shared} /> : <DealDeliverDesktop {...shared} />;

export type DealDeliverViewProps = { /* le contrat des vues */ };
```

**Pourquoi séparer Desktop/Mobile** (plutôt que du CSS responsive pur) : les layouts diffèrent structurellement (sidebar vs bottom-bar, textes longs vs `*Short`), et le hook `useIsMobile` retourne `null` au premier rendu (SSR) — on affiche alors le Skeleton pour éviter tout flash.

```tsx
if (isMobile === null || !data) return <Skeleton />;   // pattern systématique
```

## 2.3 URL stable, statut pilote — sous-routes pour les actions

**Décision d'architecture centrale** : l'URL d'une entité ne change pas avec son état.

- `/bookings/[id]` affiche ACCEPTED, PICKED_UP (écran 4 **ou** 6 selon les événements), DELIVERED… Le `Client` fait un **switch sur `status`** :

```tsx
if (booking.status === "DELIVERED")  return <BookingDelivered… />;
if (booking.status === "PICKED_UP") {
  const hasEvents = (booking.trackingEvents ?? []).length > 0;
  return hasEvents ? <BookingInTransit… /> : <BookingPickedUp… />;
}
if (booking.status === "ACCEPTED")   return <BookingAccepted… />;
return <BookingRequest… />;  // PENDING par défaut
```

- Les **formulaires d'action** (moments solennels avec validation/erreurs) vivent en **sous-routes** : `/pickup`, `/deliver`, `/report`, `/rate`. Le back ramène à l'URL de l'entité.

**Pourquoi** : les liens de notifications/emails pointeront toujours vers la même URL ; le backend n'aura qu'à renvoyer le bon statut.

## 2.4 L'architecture mock — les « IDs magiques »

Tant que le backend n'existe pas, `*.api.ts` simule tout :

```tsx
const MOCK_DELAY_MS = 600;                       // latence réaliste
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function getBooking(bookingId: string): Promise<Booking> {
  await sleep(MOCK_DELAY_MS);
  const base = bookingId.includes("delivered") ? mockBookingDelivered
             : bookingId.includes("transit")   ? mockBookingInTransit
             : bookingId.includes("picked")    ? mockBookingPickedUp
             : mockBookingAccepted;
  return { ...base, id: bookingId || base.id };
}
```

Principes :
- **Les garde-fous métier sont déjà dans le mock** (max 5 régénérations, 3 tentatives, description ≥ 50…) — le backend reprendra les mêmes règles.
- **Dates relatives à `Date.now()`** dans les mocks (`departureDate: new Date(now + 75*60*1000)`) → l'état de démo est **stable à chaque reload** (« vol dans 1h15 » restera pédagogique dans 6 mois).
- **Stateless assumé** : rien ne persiste au refresh. Les mises à jour se font en state local du Client (`setBooking(prev => ...)`).
- Les `console.info("[module] action mock:", ...)` tracent ce que le backend devra faire.

## 2.5 Composants « multi-exports »

Quand plusieurs petites cards vivent toujours ensemble, elles partagent un fichier avec des **exports nommés** (jamais default) :

```tsx
// TrackingSidebarCards.tsx
export function TrackingPaymentCard({ deal }) { ... }
export function TrackingParcelCard({ deal })  { ... }
export function TrackingShipperCard({ deal }) { ... }
```

Import : `import { TrackingPaymentCard, TrackingParcelCard } from "./TrackingSidebarCards";`

> ⚠️ Corollaire : si tu vois l'erreur *« Export X doesn't exist in target module »*, c'est qu'un remplacement de fichier a écrasé des exports encore utilisés ailleurs (vécu sur `RatingBlocks.tsx`, cf. §12.7).

---

# 3. TypeScript — les notions utilisées

## 3.1 Types union littérales = machines à états

Nos statuts et énumérations sont des **unions de littéraux**, pas des enums :

```ts
export type DealStatus = "PENDING" | "ACCEPTED" | "PICKED_UP" | "DELIVERED"
                       | "DECLINED" | "EXPIRED" | "CANCELLED";
```

Avantages : sérialisable tel quel (JSON/MongoDB), autocomplete, et le compilateur **refuse** toute valeur hors liste. Un `switch` sur une union peut être vérifié exhaustivement.

## 3.2 Types discriminés (discriminated unions)

Pour des retours d'API à plusieurs formes, le champ discriminant permet le narrowing automatique :

```ts
export type ValidateCodeResult =
  | { ok: true;  dealId: string; deliveredAt: string }
  | { ok: false; reason: "WRONG_CODE"; attemptsLeft: number }
  | { ok: false; reason: "LOCKED";     lockedUntil: string };

// Usage : TypeScript sait quels champs existent dans chaque branche
if (result.ok) { result.deliveredAt }        // ✅
else if (result.reason === "LOCKED") { result.lockedUntil }  // ✅
```

## 3.3 Utilitaires : `Partial`, `Record`, `Pick`

```ts
// Un vote par critère, tous optionnels :
votes: Partial<Record<CriterionId, CriterionVote>>
// = { PUNCTUALITY?: "UP"|"DOWN", COMMUNICATION?: ..., ... }
```

`Record<K, V>` = objet dont les clés sont l'union K ; `Partial<T>` rend tout optionnel.

## 3.4 Champs optionnels progressifs

Le type `Booking`/`DealRequest` grossit avec le cycle de vie via des champs **optionnels** :

```ts
pickup?:   BookingPickupInfo;      // présent dès PICKED_UP
delivery?: BookingDeliveryInfo;    // présent dès DELIVERED
trackingEvents?: BookingTrackingEvent[];
```

Toujours garder les accès défensifs : `booking.pickup?.photos`, `(booking.trackingEvents ?? []).length`.

## 3.5 Le piège `typeof mockX` (vécu, §12.3)

```ts
// ❌ FRAGILE : si mockDealRequest n'est pas annoté, typeof capture les LITTÉRAUX
export const mockDealPickedUp: typeof mockDealRequest = { ..., status: "PICKED_UP" };
// → TS2322: "PICKED_UP" is not assignable (status figé à "PENDING")

// ✅ Toujours annoter les mocks avec le type nominal :
export const mockDealRequest: DealRequest = { ... };
export const mockDealPickedUp: DealRequest = { ...mockDealRequest, status: "PICKED_UP" };
```

## 3.6 Constantes métier co-localisées

Les nombres magiques vivent **dans les fichiers de types**, exportés, uppercase :

```ts
export const MAX_CODE_REGENERATIONS = 5;
export const DISPUTE_MIN_DESCRIPTION_LENGTH = 50;
export const RATING_COMMENT_MAX_LENGTH = 280;
```

Ils sont importés partout (UI + mock API) → une seule source de vérité, que le backend reprendra.

---

# 4. next-intl — internationalisation

## 4.1 Architecture

```
apps/user-ui/
├── messages/
│   ├── fr/bookingTracker.json     ← un fichier JSON par NAMESPACE et par locale
│   ├── fr/rating.json
│   ├── en/bookingTracker.json
│   └── en/rating.json
└── src/i18n/
    ├── request.ts                 ← CHARGE les namespaces (code SERVEUR)
    └── navigation.ts              ← useRouter/Link locale-aware
```

## 4.2 `request.ts` — le rituel des 3 lignes

Chaque **nouveau namespace** exige 3 ajouts **dans le même ordre positionnel** (destructuring de `Promise.all` !) :

```ts
const [
  common, ..., carrierDealDeliver,
  rating,                                            // 1️⃣ tableau destructuré
] = await Promise.all([
  import(`../../messages/${locale}/common.json`), ...,
  import(`../../messages/${locale}/rating.json`),    // 2️⃣ même POSITION
]);
return { locale, messages: {
  common: common.default, ...,
  rating: rating.default,                            // 3️⃣ objet messages
}};
```

> ⚠️ **Deux pièges mortels** : (a) l'ordre destructuré ↔ Promise.all doit correspondre position par position ; (b) `request.ts` est du **code serveur** → le hot-reload ne le recharge pas : `rm -rf .next` + restart obligatoires. Oublier l'un des deux = `MISSING_MESSAGE: Could not resolve 'xxx'` (vécu 3 fois).

## 4.3 Utilisation dans les composants

```tsx
const t = useTranslations("bookingTracker");         // scope sur un namespace
t("delivered.h1")                                     // clé imbriquée
t("pickedUp.banner.title", { carrierFirstName })      // placeholder ICU
t("regenerationsLeft", { count })                     // pluriel ICU
```

Pluriels ICU dans le JSON :

```json
"regenerationsLeft": "{count, plural, =0 {Aucune régénération restante} =1 {# régénération restante} other {# régénérations restantes}}"
```

## 4.4 ⚠️ La règle des apostrophes ICU (bug vécu en prod de dev)

En ICU, l'apostrophe est un caractère d'échappement. La règle **exacte** :

| La valeur contient des `{placeholders}` ? | Apostrophe à écrire |
|---|---|
| **Oui** | Doublée : `"Demande-lui le code qu''{shipperFirstName} lui a envoyé"` |
| **Non** | Simple : `"Tout s'est bien passé ?"` |

Si tu doubles dans une clé **sans** placeholder, l'utilisateur voit littéralement `s''est` à l'écran. Script de détection dans le repo (chercher `scan-icu` dans l'historique) — à lancer après tout gros ajout de JSON FR.

## 4.5 Clés dynamiques interdites — le mapping statique

next-intl type les clés. `t("spotlight." + variable + ".title")` déclenche **TS2345**. La parade maison : **mapping switch/case explicite** dans le parent, qui passe des libellés déjà traduits aux enfants :

```tsx
function buildCriteria(context, t): CriterionItem[] {
  return CARRIER_CRITERIA.map((id) => {
    switch (id) {
      case "PUNCTUALITY":   return { id, name: t("criteria.PUNCTUALITY.name"), ... };
      case "COMMUNICATION": return { id, name: t("criteria.COMMUNICATION.name"), ... };
      case "PARCEL_CARE":   return { id, name: t("criteria.PARCEL_CARE.name"), ... };
    }
  });
}
// → RatingCriteria reçoit items: {id, name, desc}[] et ne touche jamais à t() dynamiquement
```

Bénéfice secondaire : les composants de listes (radios, critères) deviennent **agnostiques de l'i18n** donc ultra-réutilisables.

## 4.6 Conventions rédactionnelles

- Variantes `*Short` pour mobile (`"h1"` / `"h1Short"`, `"subtitle"` / `"subtitleShort"`).
- Emphase `**gras**` dans les JSON, parsée côté composant par `parseBold()` (split regex sur `(\*\*[^*]+\*\*)` → `<strong>`). Jamais de HTML dans les JSON.
- Tutoiement, prénoms injectés partout, ton chaleureux.

---

# 5. Tailwind CSS — conventions du projet

## 5.1 Bases

Tailwind = classes utilitaires (`flex`, `rounded-2xl`, `text-slate-900`). Le dark mode est en **class strategy** : chaque couleur a sa variante `dark:` :

```tsx
className="bg-white text-slate-900 dark:bg-slate-950 dark:text-white"
```

Valeurs arbitraires entre crochets quand l'échelle standard ne suffit pas : `text-[13px]`, `top-[88px]`, `grid-cols-[minmax(0,1fr)_320px]`, `min-h-[46px]`.

## 5.2 La palette Yamba (rappel technique)

- Mango CTA : `bg-[#FF9900] hover:bg-[#F08700] text-slate-950` (texte foncé sur mango, jamais blanc).
- Familles sémantiques : teal (info/transit), emerald (succès), amber (code/pickup/warnings doux/notation), red (erreurs/litige), blue (pédagogie), slate (neutres).
- Les **gradients** sont réservés aux vignettes photos (violet/amber/rouge, cf. spec fonctionnelle §3.4) et appliqués en `style={{ background: "linear-gradient(...)" }}` (pas de classe Tailwind) car les hex sont précis.

## 5.3 ⚠️ Règle d'or : PAS de template literals dans les className

Les backticks + `${}` dans les attributs JSX sont **la première cause de fichiers cassés au copier-coller** (TS1382 en cascade, cf. §12.2). Convention stricte :

```tsx
// ❌ INTERDIT (fragile au collage)
className={`flex ${compact ? "p-3" : "p-4"} rounded-xl`}

// ✅ CONVENTION : concaténation + constantes nommées avant le return
const rowClass =
  "flex items-center rounded-xl border border-slate-200 " +
  (compact ? "p-3" : "p-3.5 sm:p-4");
...
<div className={rowClass}>
```

Bonus : les longues chaînes conditionnelles deviennent lisibles et testables.

## 5.4 Patterns de layout récurrents

```tsx
// Grid desktop standard (TOUTES les pages)
<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
  <div className="space-y-4">{/* main */}</div>
  <aside className="hidden lg:block">
    <div className="sticky top-[88px] space-y-4">{/* sidebar */}</div>
  </aside>
</div>

// Header mobile sticky 56px
<div className="sticky top-0 z-10 flex h-14 items-center border-b bg-white dark:bg-slate-950">

// Bottom-bar mobile avec encoche iPhone
<div className="fixed inset-x-0 bottom-0 z-10 border-t bg-white
                pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
```

> ⚠️ `position: sticky` est **cassé** par tout ancêtre en `overflow-x: hidden`. Convention projet : utiliser `overflow-x: clip` à la place (documenté dans les bugs historiques).

## 5.5 Touch targets & a11y visuelle

Minimum 42–48px de hauteur sur tout élément interactif mobile (`min-h-[44px]`, boutons ronds `h-11 w-11`). Icônes seules → toujours `aria-label`.

---

# 6. Patterns React implémentés (catalogue)

## 6.1 State local + mise à jour fonctionnelle

Le mock étant stateless, les mutations sont locales et **fonctionnelles** (jamais lire le state courant directement dans un setter asynchrone) :

```tsx
setBooking(prev => prev ? { ...prev, deliveryCode: { ...prev.deliveryCode, code } } : prev);
setVotes(prev => { const next = {...prev}; next[id] === vote ? delete next[id] : next[id] = vote; return next; });
```

## 6.2 Chargement de données avec garde d'annulation

Pattern systématique dans tous les Clients (évite le setState après démontage) :

```tsx
useEffect(() => {
  let cancelled = false;
  getBooking(bookingId)
    .then((b) => { if (!cancelled) setBooking(b); })
    .catch(() => { if (!cancelled) setLoadError(true); });
  return () => { cancelled = true; };
}, [bookingId]);
```

## 6.3 Countdowns — deux fréquences

```tsx
// Tick 60s (countdowns d'attente : vol, versement J+4) — jamais plus fréquent
useEffect(() => {
  const interval = setInterval(() => setNowMs(Date.now()), 60_000);
  return () => clearInterval(interval);
}, []);

// Tick 1s UNIQUEMENT pour le lock de saisie du code (mm:ss)
```

Le temps courant est un state (`nowMs`) initialisé par lazy init `useState(() => Date.now())` ; tout le reste (progression, jours/heures restants) est **dérivé** au render — jamais stocké.

## 6.4 Le pattern « undo dans le toast » (Sonner)

Confirmation optimiste + fenêtre d'annulation de 5s avant l'envoi effectif :

```tsx
const pendingTimers = useRef<Map<EventId, ReturnType<typeof setTimeout>>>(new Map());

const handleConfirm = (id) => {
  onEventConfirmedAction(id);                       // optimiste (toggle parent)
  const timer = setTimeout(() => {                  // l'API partirait ICI
    pendingTimers.current.delete(id);
  }, 5000);
  pendingTimers.current.set(id, timer);

  toast.success(t("confirmedToast"), {
    duration: 5000,
    action: {
      label: t("undo"),
      onClick: () => {
        clearTimeout(pendingTimers.current.get(id)!);
        pendingTimers.current.delete(id);
        onEventConfirmedAction(id);                 // re-toggle = rollback
        toast.info(t("undoneToast"));
      },
    },
  });
};
// Nettoyage des timers au démontage via useEffect return
```

Le parent implémente le callback en **toggle** (présent → retire, absent → ajoute) pour que confirmation et undo passent par le même canal.

## 6.5 Upload de photos réel (sans backend)

```tsx
const fileInputRef = useRef<HTMLInputElement>(null);
// <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={...} />
// bouton visible → fileInputRef.current?.click()

const handleFileChange = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  onAddAction({
    id: "photo_" + Date.now(),
    previewUrl: URL.createObjectURL(file),   // preview instantanée SANS upload
    file,                                    // conservé pour l'upload R2 futur
  });
  e.target.value = "";                       // permet de re-choisir le même fichier
};

// Anti memory-leak : révoquer les object URLs
useEffect(() => () => photos.forEach(p => p.previewUrl && URL.revokeObjectURL(p.previewUrl)), []);
// + révocation individuelle au retrait d'une photo
```

## 6.6 Input OTP 6 cases (saisie du code)

Les mécaniques implémentées dans `DeliverOtpInput` :

| Mécanique | Implémentation |
|---|---|
| Une ref par case | `inputsRef.current[i]` (tableau de refs via callback ref) |
| Auto-avance | après saisie d'un chiffre → `inputsRef.current[i+1]?.focus()` |
| Backspace intelligent | case vide + Backspace → focus case précédente |
| Paste distribué | `onPaste` → `preventDefault`, nettoie en `\D`, distribue sur les 6 cases, focus la suivante |
| Clavier mobile numérique | `inputMode="numeric"` |
| Autofill SMS (iOS/Android) | `autoComplete="one-time-code"` sur la 1ère case |
| Erreur | effet sur `errorMessage` : classe `animate-[shake_0.4s]` + reset des digits + refocus case 0 |
| Entrée = valider | `onKeyDown` Enter si complet |

Le keyframe `shake` vit dans le CSS global :

```css
@keyframes shake {
  0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); }
}
```

## 6.7 Confirmation inline (pas de modal)

Toute action irréversible passe par un **état local `confirming`** qui transforme la card en mini-dialogue (titre + texte + Oui/Annuler), au même endroit visuel. Utilisé pour : régénérer le code, confirmer la livraison, envoyer un signalement. Trois états possibles (ex. `ConfirmAllGoodCard`) : initial → confirming → confirmé (la card change de contenu, l'URL ne bouge pas).

## 6.8 Collapsibles maison

Pas de lib : un `useState(collapsed)` + bouton `aria-expanded` + chevron `-rotate-90` conditionnel + rendu conditionnel du contenu. (`BookingTipList`, `DeliverHelpCard`, `SenderCodeCard`, pledge « Pourquoi ? »).

## 6.9 Liens natifs device (zéro backend)

```tsx
window.open("https://wa.me/?text=" + encodeURIComponent(message), "_blank");  // WhatsApp
window.open("https://wa.me/" + phoneDigits.replace("+", ""), "_blank");       // WhatsApp direct
window.location.href = "sms:?&body=" + encodeURIComponent(message);           // SMS (iOS+Android)
window.location.href = "mailto:?subject=" + s + "&body=" + b;                 // Email
<a href={"tel:" + phoneDigits}>                                               // Appel
navigator.clipboard.writeText(code)                                           // Copier (+ état ✓ 2s)
```

Nettoyage des numéros : `phone.replace(/[^\d+]/g, "")`, et wa.me exige le numéro **sans** `+`.

## 6.10 Formatage local-aware (Intl)

Jamais de formatage manuel — toujours `Intl` avec la locale de next-intl :

```tsx
new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US",
  { style: "currency", currency: "EUR", minimumFractionDigits: amount % 1 === 0 ? 0 : 2 })
  .format(103.75);   // "103,75 €" / "€103.75"

new Intl.DateTimeFormat(..., { weekday: "long", day: "numeric", month: "long" })
// Heures FR "22h27" vs EN "22:27" : helpers formatTime/formatHour locaux aux composants
```

## 6.11 Accessibilité (checklist appliquée)

`role="radiogroup"`/`"radio"` + `aria-checked` (étoiles, radios) · `aria-pressed` (pouces toggle) · `aria-expanded` (collapsibles) · `aria-live="polite"` (compteurs, labels dynamiques) · `role="status"` (banners) · `role="alert"` (warnings) · `aria-hidden` sur les icônes décoratives · `role="progressbar"` + `aria-valuenow` (barre J+4).

---

# 7. Sonner (toasts) & Lucide (icônes)

**Sonner** : `toast.success/error/info(message, { duration, action })`. Le `<Toaster />` doit être monté **une fois** dans le layout racine (⚠️ TODO connu du projet). L'option `action` porte le pattern undo (§6.4).

**Lucide React** : import nommé par icône (`import { Check, Copy, RefreshCw } from "lucide-react"`), props `size={14}` et `strokeWidth={3}` pour les checks épais. Icônes récurrentes du domaine : `PackageCheck`, `PlaneTakeoff/Landing`, `KeyRound`, `HeartHandshake`, `ShieldCheck`, `PartyPopper`, `ThumbsUp/Down`, `AlertTriangle`.

---

# 8. React Query (périphérie)

Utilisé pour l'état serveur global (ex. `useUser` avec `retry: false`, `refetchOnMount: false` et circuit breaker 30s sur les refresh échoués). Les modules du workflow n'en dépendent **pas encore** (mock + state local) — la migration backend branchera naturellement les `*.api.ts` derrière des `useQuery`/`useMutation` sans toucher aux vues (c'est tout l'intérêt de la couche api séparée).

---

# 9. Workflow Git & GitHub

## 9.1 Le modèle : Git Flow simplifié

```
feature/* ──PR──▶ dev (défaut, intégration) ──PR release──▶ main (stable, protégée)
```

- **`dev` est la branche par défaut** du repo (GitHub Settings → Default branch) — les PRs la ciblent automatiquement.
- **`main` est protégée** par un **Ruleset** : Enforcement **Active**, target = pattern explicite **`main`** (⚠️ PAS « default branch », qui pointerait sur dev !), règle « Require a pull request », **bypass list vide**.

## 9.2 Le rituel de reprise (début de chaque chantier)

```bash
git checkout dev
git fetch origin && git merge origin/dev   # jamais `git merge dev` seul (copie locale stale)
git log --oneline -3                       # vérifier que le dernier merge attendu est là
git checkout -b feat/nom-du-chantier
```

Si des modifs non commitées traînent sur dev : `git checkout -b feat/x` **les emporte** (pas besoin de stash).

## 9.3 Le rituel de livraison

```bash
git status | grep -iE "\.env|secret"       # anti-leak AVANT tout add
git add .
git commit -m "feat(scope): titre\n\n- détails..."   # message structuré, corps en liste
git push origin feat/nom-du-chantier
# → PR vers dev avec sections : 🎯 Quoi / 📦 Contenu / 🧪 Tester / ⚠️ Limites / 🔮 Suite
```

Conventions de commit : `feat(booking):`, `feat(carrier/deal):`, `feat(rating):`, `fix:`, `docs:` — le corps documente les limitations connues (elles deviennent la roadmap).

## 9.4 Récupération d'un merge accidentel sur main (procédure vécue)

1. Bouton **Revert** sur la PR GitHub → merge de la PR de revert (jamais de force push en premier réflexe).
2. Rouvrir la PR de la feature vers **dev**.
3. Prévention : dev par défaut + Ruleset main (cf. 9.1). Test de la protection : commit vide + push sur main → attendu `GH013: Repository rule violations`.

---

# 10. Backend existant & cibles d'intégration (aperçu)

Ordre de démarrage des services : `auth-service → trip-service → api-gateway`. Auth : refresh tokens en Redis (clé `refresh_jti:{userId}:{jti}`, une par session). Le workflow décrit ici s'intégrera via un futur `booking-service` (ou extension de trip-service) exposé par le gateway — les contrats sont listés dans la spec fonctionnelle §6. Points d'attention déjà actés : bcrypt du code, compteurs de tentatives **côté serveur**, `transfers.create()` Stripe à COMPLETED, upload R2 des `File` conservés dans les drafts, crons (expiration 24h, versement J+4, relances notation).

---

# 11. Outillage & environnement

- **IDE** : IntelliJ/WebStorm + Claude Code. ⚠️ Après un switch de branche, l'IDE affiche souvent des erreurs TS fantômes (cache stale) → **`npx tsc --noEmit --project apps/user-ui` fait foi**, puis « Restart TypeScript Service » (icône TS barre de statut), en dernier recours « Invalidate Caches ».
- **Vérifications JSON** : `node -e "JSON.parse(require('fs').readFileSync('...','utf8')); console.log('OK')"` après chaque édition de messages.
- **zsh** : quoter les chemins avec `[locale]`/`[dealId]` ; le `!` déclenche l'expansion d'historique même entre guillemets doubles (`event not found`) → utiliser `=== false` au lieu de `!x`, ou passer par un fichier heredoc `<< 'EOF'`.

---

# 12. ⚠️ LE BESTIAIRE DES PIÈGES (tous vécus — à lire avant de coder)

## 12.1 Fichiers vides après collage — LE piège n°1

Symptômes : `TS2306: File ... is not a module` + erreurs runtime « Element type is invalid: got object ». Cause : le collage IDE n'a pas pris (fichier créé mais vide). **Rituel après chaque session de collage / reprise de pause** :

```bash
for f in chemin/du/module/*.{ts,tsx}; do
  [ -f "$f" ] && [ "$(wc -l < "$f")" -lt 10 ] && echo "⚠️ VIDE: $f"
done
```

## 12.2 Backtick avalée au collage

Symptômes en cascade : `TS1382: Unexpected token. Did you mean {'>'}?` + `TS2304: Cannot find name 'div'` sur des lignes valides en apparence. Cause : un backtick ou une balise ouvrante a sauté → tout ce qui suit est parsé comme une string. Fix : recoller le fichier **complet** ; prévention : convention « zéro template literal dans le JSX » (§5.3).

## 12.3 JSX dans un `.ts`

`TS2304: Cannot find name 'div'` isolé = le fichier est en `.ts` au lieu de `.tsx` (IntelliJ crée parfois du `.ts` par défaut). `ls -la` sur le dossier, puis `mv X.ts X.tsx`.

## 12.4 Namespace i18n manquant

`MISSING_MESSAGE: Could not resolve 'xxx' in messages for locale 'fr'` → checklist : (1) les 2 JSON existent et sont pleins (`wc -l`), (2) `grep -c "xxx" src/i18n/request.ts` = 3, (3) ordre positionnel destructuring↔Promise.all respecté, (4) **`rm -rf .next` + restart** (code serveur, pas de hot-reload).

## 12.5 IDE vs compilateur

L'IDE peut afficher des erreurs sur du code correct (surtout post-switch de branche) ou n'en afficher aucune sur du code cassé. **Arbitre unique** : `npx tsc --noEmit --project apps/user-ui`.

## 12.6 `t()` avec clé dynamique

`TS2345` sur `t("prefix." + variable)` → mapping statique switch/case (§4.5).

## 12.7 Écrasement d'exports lors d'un « remplace le fichier »

`Export X doesn't exist in target module` après refonte d'un fichier multi-exports : un autre composant importait encore l'ancien export. Avant de réécrire un fichier partagé : `grep -rn "from \"./LeFichier\"" src/` pour recenser les consommateurs.

## 12.8 Duplication de type lors d'un ajout

Coller un bloc « à ajouter à la fin » qui redéclare un type existant → `TS2300 Duplicate identifier`. Toujours **fusionner** dans la déclaration existante (cas vécu : `DealStatus`).

## 12.9 Apostrophes ICU

`''` affiché littéralement à l'écran (« Tout s''est bien passé ») → règle §4.4 + script de scan.

## 12.10 Sticky cassé

Sidebar qui ne colle plus → chercher un `overflow-x: hidden` sur un ancêtre, remplacer par `overflow-x: clip`.

---

# 13. Checklist d'onboarding nouveau dev

1. Cloner, `npm install`, `npx nx dev user-ui`, ouvrir http://localhost:3000.
2. Lire `docs/SPECIFICATIONS-WORKFLOW-YAMBA.md` (le métier) puis **ce document** (le comment).
3. Dérouler le tour de démo de `docs/WORKFLOW-DEMO.md` (10 min, IDs magiques).
4. Lire un module de bout en bout dans cet ordre : `booking-tracker.types.ts` → `.state.ts` → `.api.ts` → `BookingTrackerClient.tsx` → une vue Desktop.
5. Mémoriser les 4 réflexes : scan fichiers vides · `tsc --noEmit` fait foi · `rm -rf .next` après tout i18n · rituel Git dev→branche.
6. Première contribution suggérée : une clé i18n ou une card sidebar — le pattern est partout le même.

---

*Document vivant : toute nouvelle convention ou tout nouveau piège rencontré doit y être ajouté. Jumeau fonctionnel : `SPECIFICATIONS-WORKFLOW-YAMBA.md`.*
