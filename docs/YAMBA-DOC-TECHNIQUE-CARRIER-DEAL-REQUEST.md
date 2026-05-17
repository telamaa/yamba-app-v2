# Yamba — Doc Technique : Écran de Réception d'une Demande de Deal (Voyageur)

> **Version** : 1.0
> **Date** : 17 mai 2026
> **Branche Git** : `feat/carrier-deal-wizard`
> **Audience** : Développeurs (y compris novices)
> **Périmètre** : Frontend Next.js uniquement (backend mocké, à brancher dans une PR séparée)

---

## Sommaire

1. [Vue d'ensemble technique](#1-vue-densemble-technique)
2. [Stack technologique](#2-stack-technologique)
3. [Structure des fichiers](#3-structure-des-fichiers)
4. [Patterns architecturaux clés](#4-patterns-architecturaux-clés)
5. [Catalogue détaillé des fichiers](#5-catalogue-détaillé-des-fichiers)
6. [Conventions à respecter](#6-conventions-à-respecter)
7. [Comment évoluer](#7-comment-évoluer)
8. [Pièges à éviter](#8-pièges-à-éviter)
9. [Tests et debug](#9-tests-et-debug)
10. [Glossaire technique](#10-glossaire-technique)

---

## 1. Vue d'ensemble technique

Cet écran est un **module frontend autonome** au sein du monorepo `apps/user-ui` (Next.js 16 App Router). Il consomme une API REST (actuellement mockée côté client) pour récupérer les données d'une demande de Deal entrante et déclencher les actions accept / decline.

### Choix architecturaux fondamentaux

| Choix | Raison |
|-------|--------|
| **Server Component pour la route, Client Components pour le contenu** | Permet le SEO de la route + interactivité riche (state, hooks, animations) |
| **Mocks côté client (pas de MSW)** | Simplicité MVP, on remplacera par de vrais fetchs dans la PR backend |
| **Lightbox custom (pas de lib)** | Évite une dépendance pour 50 lignes de code, contrôle total du style |
| **Modale + bottom-sheet faits maison** | Idem, plus rapide à itérer que `@radix-ui/dialog` au stade actuel |
| **next-intl pour i18n** | Déjà utilisé partout dans l'app, support ICU plural natif |
| **Skeleton pur CSS (pas de lib)** | `animate-pulse` de Tailwind suffit largement |

### Flux global

```
URL /[locale]/carrier/deals/[dealId]
        │
        ▼
   page.tsx (Server Component)
        │
        │  passe dealId
        ▼
DealRequestClient.tsx (Client Component, router)
        │
        ├── isMobile === null OU loading ?  → DealRequestSkeleton
        ├── erreur ?                         → DealRequestError
        ├── isMobile ?                        → DealRequestMobile
        └── desktop                          → DealRequestDesktop
                                                       │
                                                       └── Composition de 13 atoms UI
```

---

## 2. Stack technologique

### Frontend

| Techno | Version | Rôle |
|--------|---------|------|
| **Next.js** | 16 (App Router) | Framework React full-stack |
| **React** | 19 | Bibliothèque UI |
| **TypeScript** | 5.x | Typage statique |
| **Tailwind CSS** | 4.x | Styling utility-first |
| **next-intl** | 4.x | Internationalisation (FR/EN) |
| **lucide-react** | 0.383+ | Icônes (Clock, Check, X, etc.) |
| **sonner** | latest | Toasts succès/erreur |

### Composants partagés du monorepo

- `@/components/booking/BookingFormUi` — IconButton, TipBlock, CharterBlock, CharterCheckbox (réutilisés)
- `@/hooks/useIsMobile` — Hook utilitaire de détection de viewport
- `@/i18n/navigation` — Wrapper de `next-intl` autour de `useRouter` et `Link`

### Pas (encore) utilisé sur ce module

- **React Query** : on n'a qu'un fetch unique, pas besoin de cache pour l'instant
- **Zustand / Redux** : pas de state global, tout est local au composant
- **react-hook-form** : pas de gros formulaire ici

---

## 3. Structure des fichiers

```
apps/user-ui/
├── messages/
│   ├── fr/
│   │   └── carrierDealRequest.json          ← Copies françaises (ICU plural, apostrophes doublées)
│   └── en/
│       └── carrierDealRequest.json          ← Copies anglaises
│
├── src/
│   ├── app/
│   │   └── [locale]/
│   │       └── carrier/
│   │           └── deals/
│   │               └── [dealId]/
│   │                   └── page.tsx          ← Route Next.js (Server Component)
│   │
│   ├── components/
│   │   └── carrier/
│   │       └── deal-request/
│   │           ├── DealRequestClient.tsx     ← Routeur desktop/mobile + fetch
│   │           ├── DealRequestDesktop.tsx    ← Layout 2 cols + sidebar sticky
│   │           ├── DealRequestMobile.tsx     ← Layout 1 col + bottom-bar
│   │           ├── DealRequestHeader.tsx     ← Header mobile (back + titre)
│   │           ├── DealRequestSkeleton.tsx   ← Skeleton chargement
│   │           ├── DealExpiryBanner.tsx      ← Compteur expiration (chip)
│   │           ├── DealEarningsHero.tsx      ← Hero gain (mobile uniquement)
│   │           ├── DealShipperCard.tsx       ← Card identité Expéditeur
│   │           ├── DealParcelDetails.tsx     ← Catégorie/poids/valeur/description
│   │           ├── DealParcelPhotos.tsx      ← Grid photos + lightbox
│   │           ├── DealLocationsBlock.tsx    ← Pickup + Delivery
│   │           ├── DealEarningsBreakdown.tsx ← Sidebar earnings (hero + breakdown)
│   │           ├── DealCoverageCard.tsx      ← Couverture assurance
│   │           ├── DealAcceptTip.tsx         ← Tip bleu "Avant d'accepter"
│   │           ├── DealCarrierCharter.tsx    ← Charte amber + case acceptation
│   │           ├── DealActionsFooter.tsx     ← CTAs Refuser/Accepter
│   │           ├── DealDeclineModal.tsx      ← Modale refus (desktop)
│   │           ├── DealDeclineSheet.tsx      ← Bottom-sheet refus (mobile)
│   │           ├── deal-request.types.ts     ← Types TypeScript partagés
│   │           ├── deal-request.state.ts     ← Mock data (mockDealRequest)
│   │           └── deal-request.api.ts       ← Fonctions API mockées
│   │
│   ├── hooks/
│   │   └── useExpiryCountdown.ts             ← Hook compte à rebours live
│   │
│   └── i18n/
│       └── request.ts                         ← Modifié pour ajouter le namespace
```

**Total** : 24 nouveaux fichiers + 1 modification (`i18n/request.ts`).

---

## 4. Patterns architecturaux clés

### 4.1 Server Component → Client Component

```tsx
// page.tsx (Server Component, par défaut dans App Router)
export default async function CarrierDealPage({ params }: Props) {
  const { dealId } = await params;
  return <DealRequestClient dealId={dealId} />;
}
```

Le Server Component ne fait que **récupérer les params de l'URL** et passer le `dealId` au Client Component. Pas de logique métier ici. Cela permet :
- Le rendu côté serveur du shell HTML (SEO + performance)
- L'isolation de la logique d'interaction dans le Client Component

### 4.2 Routeur desktop / mobile via `useIsMobile`

```tsx
// DealRequestClient.tsx
const isMobile = useIsMobile();

if (isMobile === null || (!deal && !loadError)) {
  return <DealRequestSkeleton />; // pendant l'hydration ou le fetch
}

if (isMobile) {
  return <DealRequestMobile deal={deal} onCloseAction={handleClose} />;
}

return <DealRequestDesktop deal={deal} onCloseAction={handleClose} />;
```

**Pourquoi cette approche plutôt qu'un seul composant responsive ?**
- Les layouts desktop et mobile sont **fondamentalement différents** (sidebar sticky vs bottom-bar, modale vs bottom-sheet)
- Faire un seul composant avec `lg:hidden` / `hidden lg:block` partout serait illisible
- Cela permet de **dupliquer la logique d'orchestration** (state, handlers) avec une légère redondance acceptable

### 4.3 Convention `Action` suffix (Next.js 16 strict mode)

**Règle** : tous les props de type fonction dans un Client Component doivent se terminer par `Action`. Sinon Next.js 16 lève l'erreur TypeScript `TS71007`.

```tsx
// ❌ Mauvais (TS71007)
type Props = {
  onBack: () => void;
  onChange: (v: string) => void;
}

// ✅ Bon
type Props = {
  onBackAction: () => void;
  onChangeAction: (v: string) => void;
}
```

Appliqué partout dans le module : `onCloseAction`, `onConfirmAction`, `onClickAction`, `onChangeAction`, etc.

### 4.4 Compte à rebours via hook custom

```tsx
// useExpiryCountdown.ts
export function useExpiryCountdown(expiresAtIso: string): ExpiryStatus {
  const [status, setStatus] = useState<ExpiryStatus>(() =>
    computeStatus(expiresAtIso)
  );

  useEffect(() => {
    setStatus(computeStatus(expiresAtIso));
    const tick = () => setStatus(computeStatus(expiresAtIso));
    const interval = setInterval(tick, UPDATE_INTERVAL_MS); // 30s
    return () => clearInterval(interval);
  }, [expiresAtIso]);

  return status;
}
```

**Pourquoi 30 s et pas 1 s ?**
- L'affichage est en heures + minutes, pas en secondes
- Un refresh par seconde gaspillerait des cycles CPU pour rien
- 30 s garantit qu'on ne « rate » pas une bascule h → min (drift max de 30 s)

### 4.5 Sidebar sticky avec fix overflow

**Problème classique** : `position: sticky` ne marche pas si un ancêtre a `overflow: hidden`.

```tsx
// ❌ Cassé (sticky ne marche pas)
<div className="overflow-hidden rounded-2xl">  ← coupe le sticky
  <div className="grid">
    <aside className="sticky top-[88px]"> ... </aside>
  </div>
</div>

// ✅ Fonctionnel (pattern booking shipper appliqué ici)
<div className="max-w-7xl mx-auto">
  <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
    <aside className="sticky top-[88px]"> ... </aside>
  </div>
</div>
```

**Comment debug** :
- Inspecter la sidebar dans DevTools
- Remonter les ancêtres jusqu'à trouver `overflow: hidden`, `overflow: auto`, ou `overflow: scroll`
- Soit retirer cet overflow, soit utiliser `overflow: clip` (qui n'interfère pas avec sticky)

### 4.6 Modale et bottom-sheet sans dépendance

**Modale desktop** :
- `position: fixed; inset: 0` pour couvrir tout l'écran
- Backdrop semi-transparent avec `bg-black/50 backdrop-blur-sm`
- Clic backdrop → `onCloseAction()` via propagation arrêtée sur le contenu
- Esc → écoute `keydown` au montage, cleanup au démontage
- Body scroll lock : `document.body.style.overflow = "hidden"`

**Bottom-sheet mobile** :
- Idem mais positionné `bottom-0` avec `translate-y-full` → `translate-y-0` au mount
- Animation `transition-transform duration-200 ease-out`
- Pas de gestion de drag-to-dismiss (trop complexe, peu de valeur)

### 4.7 Lightbox photos custom

```tsx
function Lightbox({ photos, index, onCloseAction, onNextAction, onPrevAction }) {
  // Navigation clavier
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseAction();
      if (e.key === "ArrowRight") onNextAction();
      if (e.key === "ArrowLeft") onPrevAction();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [...]);
  // ...
}
```

50 lignes de code, support clavier complet, fond noir, navigation < >, X de fermeture. Pas besoin de lib type `yet-another-react-lightbox`.

---

## 5. Catalogue détaillé des fichiers

### 5.1 `app/[locale]/carrier/deals/[dealId]/page.tsx`

**Type** : Server Component
**Rôle** : Définit la route Next.js, extrait `dealId` depuis l'URL, le transmet au Client Component.

```tsx
type Props = {
  params: Promise<{ locale: string; dealId: string }>;
};

export default async function CarrierDealPage({ params }: Props) {
  const { dealId } = await params;
  return <DealRequestClient dealId={dealId} />;
}
```

**Pourquoi `await params` ?**
Dans Next.js 16, `params` est une Promise (changement breaking depuis Next.js 15). Il faut `await` pour accéder à ses propriétés.

### 5.2 `components/carrier/deal-request/DealRequestClient.tsx`

**Type** : Client Component (`"use client"`)
**Rôle** : Orchestrateur. Fetch les données, gère les états (loading, error, success), route vers Desktop ou Mobile selon viewport.

**Logique clé** :
```tsx
useEffect(() => {
  let cancelled = false;
  setDeal(null);
  setLoadError(false);
  getDealRequest(dealId)
    .then((d) => { if (!cancelled) setDeal(d); })
    .catch(() => { if (!cancelled) setLoadError(true); });
  return () => { cancelled = true; };
}, [dealId]);
```

**Pattern `cancelled`** : protège contre les fetchs obsolètes si le `dealId` change avant que le précédent ne réponde. Idiomatique en React.

**Quand on branchera le backend** : remplacer `getDealRequest` par un appel React Query :
```tsx
const { data: deal, isLoading, isError } = useQuery({
  queryKey: ["deal", dealId],
  queryFn: () => getDealRequest(dealId),
});
```

### 5.3 `components/carrier/deal-request/DealRequestDesktop.tsx`

**Type** : Client Component
**Rôle** : Layout 2 colonnes pour écrans `≥ 1024 px`.

**État local** :
```tsx
const [charterAccepted, setCharterAccepted] = useState(false);
const [charterError, setCharterError] = useState(false);
const [isSubmittingAccept, setIsSubmittingAccept] = useState(false);
const [isSubmittingDecline, setIsSubmittingDecline] = useState(false);
const [declineModalOpen, setDeclineModalOpen] = useState(false);
```

**Handlers principaux** :
- `handleAccept` : vérifie la charte cochée → si non cochée, scroll vers la charte + erreur orange ; si OK, appelle `acceptDeal()` et redirige
- `handleDeclineConfirm` : appelle `declineDeal()` avec payload, ferme la modale, redirige

**Sous-titre dynamique** (au lieu d'une section "Ton trajet" séparée) :
```tsx
const subtitleParts = [
  t("receivedAgo", { time: formatReceivedAgo(deal.createdAt) }),
  `${deal.trip.originCity} → ${deal.trip.destinationCity}`,
  formatDate(deal.trip.departureDate, locale),
];
if (deal.trip.durationHours) {
  subtitleParts.push(
    deal.trip.isDirect
      ? t("tripCard.directFlight", { hours: deal.trip.durationHours })
      : `${deal.trip.durationHours}h`
  );
}
const subtitle = subtitleParts.join(" · ");
```

### 5.4 `components/carrier/deal-request/DealRequestMobile.tsx`

**Type** : Client Component
**Rôle** : Layout 1 colonne pour écrans `< 1024 px`. Bottom-bar sticky pour les CTAs.

**Différences avec Desktop** :
- Pas de sidebar : le breakdown earnings et la couverture sont en inline dans le flow
- Bottom-bar fixe en bas pour les CTAs (toujours accessibles)
- Bottom-sheet pour le refus (au lieu de modale)
- Hero earnings compact en haut du content (au lieu de sidebar)

### 5.5 `components/carrier/deal-request/DealRequestHeader.tsx`

**Type** : Client Component
**Rôle** : Header mobile uniquement (back + titre + sous-titre temporel).

Le desktop n'utilise pas ce composant — il a son propre H1 + sous-titre directement dans `DealRequestDesktop`.

### 5.6 `components/carrier/deal-request/DealRequestSkeleton.tsx`

**Type** : Client Component
**Rôle** : Skeleton de chargement affiché avant l'arrivée des données.

**Pourquoi responsive pure CSS plutôt que via `useIsMobile` ?**
Le skeleton sert pendant l'hydration React. À ce moment, `useIsMobile()` peut retourner `null`. Pour éviter le layout shift, on utilise `lg:hidden` / `hidden lg:block` qui s'évaluent par le navigateur dès le premier render.

**Animation** : `animate-pulse` de Tailwind sur le conteneur racine, propage à tous les enfants `bg-slate-200`.

### 5.7 `components/carrier/deal-request/DealExpiryBanner.tsx`

**Type** : Client Component
**Rôle** : Affiche le compte à rebours d'expiration, change de couleur selon urgence.

**Variants** :
- `inline` : chip rounded-lg en `inline-flex`, pour le desktop (placé dans le flow)
- `banner` : chip rounded-xl en `flex` pleine largeur du parent, pour le mobile (placé dans le content scrollable avec `px-4`)

**Couleurs adaptatives** :
```tsx
const tone = isExpired ? "expired" : isUrgent ? "urgent" : "normal";

const styles = {
  normal: { bg: "bg-amber-50 ...", border: "border-amber-200 ...", /* ... */ },
  urgent: { bg: "bg-red-50 ...", border: "border-red-200 ...", /* ... */ },
  expired: { bg: "bg-slate-100 ...", border: "border-slate-200 ...", /* ... */ },
}[tone];
```

### 5.8 `components/carrier/deal-request/DealEarningsHero.tsx`

**Type** : Client Component
**Rôle** : Bandeau "Tu gagnes 89,30 €" compact, **utilisé en mobile uniquement** (en haut du content).

Sur desktop, le hero est intégré dans `DealEarningsBreakdown` (sidebar).

### 5.9 `components/carrier/deal-request/DealShipperCard.tsx`

**Type** : Client Component
**Rôle** : Carte d'identité de l'Expéditeur.

**Affichage conditionnel** :
- Mobile : avatar, nom, badge vérifié, note + nombre d'envois
- Desktop : ajoute "Membre depuis nov. 2024" (prop `showMemberSince`)

**Avatar coloré aux initiales** :
```tsx
<div
  className="..."
  style={{ background: "linear-gradient(135deg, #534AB7, #7F77DD)" }}
>
  {initials}
</div>
```

Pas d'image réelle pour l'instant (mock), donc gradient violet hardcodé. À remplacer par `next/image` pointant sur Cloudflare R2 quand on aura les vraies photos de profil.

### 5.10 `components/carrier/deal-request/DealParcelDetails.tsx`

**Type** : Client Component
**Rôle** : Catégorie, poids déclaré, valeur déclarée (en 3 colonnes), puis description en pleine largeur.

**Réutilise les catégories du booking** :
```tsx
const tBooking = useTranslations("booking");
// ...
value={tBooking(`categories.${category}`)}
```

Cela évite de redéfinir les labels (`Vêtements`, `Chaussures`, etc.) à 2 endroits.

### 5.11 `components/carrier/deal-request/DealParcelPhotos.tsx`

**Type** : Client Component
**Rôle** : Grid responsive de photos + lightbox au clic.

**Layout responsive** :
- `grid-cols-2` : mobile (2 photos lisibles ~170 px)
- `sm:grid-cols-3` : tablet
- `md:grid-cols-4` : desktop

**Pourquoi 2 cols sur mobile** ? Pour qu'un Voyageur puisse distinguer le contenu déclaré (3 cols donnerait des photos ~105 px, trop petites pour juger).

**Placeholder graphique si l'image ne charge pas** :
```tsx
const [loadError, setLoadError] = useState(false);
// ...
<img ... onError={() => setLoadError(true)} />
{loadError && <div className="..." style={{ background: "linear-gradient(...)" }}>...</div>}
```

### 5.12 `components/carrier/deal-request/DealLocationsBlock.tsx`

**Type** : Client Component
**Rôle** : Affiche les lieux de remise et livraison avec icônes contextuelles.

**Icônes selon type de lieu** :
- `AIRPORT` → ✈ Plane
- `STATION` → 🚉 Train
- `ADDRESS` → 🏢 Building2
- `POI` → 📍 MapPin

**Note "Téléphone communiqué après acceptation"** affichée pour le lieu de delivery quand `detail` est vide (fallback).

### 5.13 `components/carrier/deal-request/DealEarningsBreakdown.tsx`

**Type** : Client Component
**Rôle** : Détail du gain. **Composant à 2 variants** :

- `sidebar` (desktop) : card emerald complète avec "TU GAGNES" + montant gros + payout note + breakdown
- `mobile` : juste le breakdown détaillé (sans le hero — celui-ci est déjà affiché par `DealEarningsHero`)

C'est l'un des composants les plus complexes du module car il combine plusieurs niveaux d'information :
```
TU GAGNES
89,30 €
Versé 4 jours après livraison validée par code confidentiel
─────────────────
CE QUE TU TOUCHES
Prix total payé        103,75 €
Commission Yamba       − 12,75 €
Frais Stripe           − 1,70 €
```

### 5.14 `components/carrier/deal-request/DealCoverageCard.tsx`

**Type** : Client Component
**Rôle** : Affiche le niveau de couverture d'assurance.

**Variants** :
- `sidebar` : card avec icône bouclier vert + label + note
- `inline` : bandeau emerald compact pour mobile

### 5.15 `components/carrier/deal-request/DealAcceptTip.tsx`

**Type** : Client Component
**Rôle** : Tip block bleu pédagogique. **Réutilise `TipBlock` du booking shipper** (cohérence visuelle).

**2 versions de copies** :
- `compact: false` (desktop, plus long) : 4 conseils détaillés
- `compact: true` (mobile, plus court) : versions raccourcies

### 5.16 `components/carrier/deal-request/DealCarrierCharter.tsx`

**Type** : Client Component
**Rôle** : Charte Voyageur + case d'acceptation unique.

**Réutilise `CharterBlock` + `CharterCheckbox` du booking** (composants génériques pour les engagements légaux).

**Gestion d'erreur** :
```tsx
<CharterCheckbox
  checked={accepted}
  onChangeAction={onChangeAction}
  // ...
  hasError={hasError}
/>
{hasError && errorMessage && (
  <div className="mt-2 text-[12px] font-medium" style={{ color: "#FF9900" }}>
    {errorMessage}
  </div>
)}
```

### 5.17 `components/carrier/deal-request/DealActionsFooter.tsx`

**Type** : Client Component
**Rôle** : Boutons Accept / Decline + indicateur d'état charte + footer note.

**Variants** :
- `desktop` : card avec indicateur en haut, CTAs verticaux, footer note dessous
- `mobile` : bottom-bar sticky avec indicateur au-dessus, CTAs côte à côte

**Indicateur d'état charte** :
```tsx
const charterIndicator = charterAccepted ? (
  <div className="text-emerald-600">✓ Charte acceptée</div>
) : (
  <div className="text-amber-600">Coche la Charte pour confirmer</div>
);
```

C'est une **astuce UX importante** : au lieu de désactiver le bouton (frustrant), on le laisse actif mais on indique clairement l'état. Au clic sans charte cochée, on scroll vers la charte avec un message d'erreur.

### 5.18 `components/carrier/deal-request/DealDeclineModal.tsx`

**Type** : Client Component
**Rôle** : Modale de confirmation pour le refus (desktop).

**Mécanismes** :
- Body scroll lock pendant l'ouverture
- Esc key listener avec cleanup
- Reset du state quand `isOpen === false`
- Click backdrop ferme (sauf si `isSubmitting`)

**Pattern reset** :
```tsx
useEffect(() => {
  if (!isOpen) {
    setReason("");
    setDetails("");
    setDetailsExpanded(false);
  }
}, [isOpen]);
```

### 5.19 `components/carrier/deal-request/DealDeclineSheet.tsx`

**Type** : Client Component
**Rôle** : Bottom-sheet pour le refus (mobile).

**Animation** :
```tsx
className={`... transition-transform duration-200 ease-out ${
  isOpen ? "translate-y-0" : "translate-y-full"
}`}
```

**Subtilité** : le composant reste monté quand `isOpen === false` (juste translaté hors écran), pour que l'animation de fermeture se joue correctement. Le state reset est aussi tempo-différé de 200 ms pour ne pas voir le contenu changer pendant que ça se ferme.

### 5.20 `components/carrier/deal-request/deal-request.types.ts`

**Type** : Module TypeScript (pas de composant)
**Rôle** : Types partagés.

Types principaux :
- `DealRequest` — La demande complète (shipper, trip, parcel, locations, earnings...)
- `DealStatus` — `PENDING | ACCEPTED | DECLINED | EXPIRED | CANCELLED`
- `DeclineReason` — 5 codes pour les raisons de refus
- `DeclinePayload` — `{ reason?: DeclineReason; details?: string }`
- `AcceptPayload` — `{ charterAccepted: boolean }`
- `ExpiryStatus` — Retour du hook `useExpiryCountdown`

### 5.21 `components/carrier/deal-request/deal-request.state.ts`

**Type** : Module TypeScript
**Rôle** : Mock data pour le développement.

Exporte `mockDealRequest` représentant la demande d'Aminata T. vers Brazzaville (catégorie Vêtements, 2.5 kg, 150 €, assurance étendue, 89,30 € net pour le Voyageur).

**Quand on aura le backend** : ce fichier deviendra obsolète et sera supprimé.

### 5.22 `components/carrier/deal-request/deal-request.api.ts`

**Type** : Module TypeScript
**Rôle** : Wrappers d'appels API (mockés pour l'instant).

Trois fonctions :
- `getDealRequest(dealId)` : retourne le mock après 800 ms
- `acceptDeal(dealId, payload)` : retourne `{ dealId, deliveryCode }` après 800 ms
- `declineDeal(dealId, payload)` : retourne `{ dealId }` après 800 ms

**Pour brancher le vrai backend**, remplacer chaque fonction par un `fetch` :
```tsx
export async function getDealRequest(dealId: string): Promise<DealRequest> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/carrier/deals/${dealId}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("Failed to fetch deal request");
  return res.json();
}
```

### 5.23 `messages/{fr,en}/carrierDealRequest.json`

**Type** : JSON i18n
**Rôle** : Toutes les copies du module, séparées par contexte (`title`, `expiry`, `earnings`, etc.).

**Conventions** :
- Apostrophes doublées en FR : `d''or`, `n''es`
- Plural ICU : `"{count, plural, =1 {# envoi} other {# envois}}"`
- Variables d'interpolation : `{shipperFirstName}`, `{hours}`, `{minutes}`, `{days}`

### 5.24 `i18n/request.ts` (modifié)

**Rôle** : Configure les namespaces chargés par next-intl.

**Modification** : ajout du namespace `carrierDealRequest` à la liste des imports.

### 5.25 `hooks/useExpiryCountdown.ts`

**Type** : Hook React custom
**Rôle** : Calcule le temps restant jusqu'à une deadline ISO, refresh toutes les 30 s.

**Retour** :
```tsx
{
  hoursLeft: number;
  minutesLeft: number;
  isExpired: boolean;
  isUrgent: boolean;        // < 2 h
  totalMinutesLeft: number;
}
```

**Optimisation possible** : si le composant n'est plus visible (`document.hidden`), on pourrait pauser le `setInterval` pour économiser des cycles. Pas critique au MVP.

---

## 6. Conventions à respecter

### 6.1 Suffix `Action` sur les props callback

```tsx
// ❌ TS71007
type Props = { onClick: () => void; }

// ✅
type Props = { onClickAction: () => void; }
```

### 6.2 Composants Client uniquement quand nécessaire

Par défaut, App Router rend en Server Component. Marquer `"use client"` **seulement si** :
- On utilise des hooks React (`useState`, `useEffect`, etc.)
- On gère des événements (`onClick`, `onChange`)
- On a besoin du DOM (`document`, `window`)

**Le `page.tsx` reste Server Component** car il ne fait que router.

### 6.3 Imports ordonnés

```tsx
// 1. React / Next
import { useState } from "react";
// 2. Libs externes
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
// 3. Composants internes (alias @/)
import { TipBlock } from "@/components/booking/BookingFormUi";
// 4. Imports relatifs
import type { DealRequest } from "./deal-request.types";
import DealShipperCard from "./DealShipperCard";
```

### 6.4 Tailwind : valeurs arbitraires acceptables

Pour les couleurs Yamba (`#FF9900` mango, `#0F766E` teal, `#185FA5` blue), on utilise les valeurs hex en CSS-in-JS ou en class :
```tsx
className="bg-[#FF9900] text-slate-950"
style={{ color: "#FF9900" }}
```

Plutôt que de polluer `tailwind.config.js` avec des couleurs custom pour chaque feature.

### 6.5 Réutilisation des atoms du booking shipper

Avant de coder un nouveau composant, vérifier si `BookingFormUi.tsx` exporte déjà quelque chose qui marche :
- `IconButton`
- `TipBlock`
- `CharterBlock`
- `CharterCheckbox`
- `PrimaryButton`, `SecondaryButton`

---

## 7. Comment évoluer

### 7.1 Brancher le backend réel

**Étapes** :
1. Créer le service `deal-service` (Express + Prisma) avec endpoints :
   - `GET /carrier/deals/:dealId` → retourne `DealRequest`
   - `POST /carrier/deals/:dealId/accept` → corps `{ charterAccepted: true }`, retourne `{ dealId, deliveryCode }`
   - `POST /carrier/deals/:dealId/decline` → corps `{ reason?, details? }`, retourne `{ dealId }`
2. Plug à l'api-gateway (`apps/api-gateway/`)
3. Modifier `deal-request.api.ts` pour faire de vrais `fetch` avec `credentials: "include"`
4. Supprimer `deal-request.state.ts` (mock devenu obsolète)
5. Wrapper avec React Query dans `DealRequestClient.tsx` (cache, retries, refetch)
6. Implémenter la logique de génération du code à 6 chiffres côté backend
7. Brancher la capture Stripe à l'acceptation (deferred capture)
8. Notifier l'Expéditeur (email + push + in-app) sur accept/decline

### 7.2 Ajouter l'inbox "Mes deals"

Future PR : créer `apps/user-ui/src/app/[locale]/carrier/deals/page.tsx` (sans `[dealId]`) avec :
- Liste paginée des demandes de Deal du Voyageur
- Filtres : `PENDING` / `ACCEPTED` / `DECLINED` / `EXPIRED`
- Carte deal compacte par item (avatar Expéditeur, trajet, gain, état, expiration)
- Clic → navigation vers `/carrier/deals/[dealId]`

### 7.3 Ajouter l'onglet "Demandes" dans le détail trajet

Future PR : enrichir le composant détail trajet du dashboard avec un onglet "Demandes en attente" qui filtre les deals de ce trajet précis.

### 7.4 Brancher la décision Stripe deferred capture

Comportement actuel : pas de capture Stripe à l'acceptation (juste un toast).

Comportement cible :
1. À la réservation (côté shipper), Stripe crée un PaymentIntent avec `capture_method: "manual"`
2. À l'acceptation (côté carrier), backend appelle `paymentIntents.capture()` → fonds débités du shipper
3. Le money est en escrow Yamba jusqu'à livraison
4. À la livraison validée (code), transfer Stripe vers le compte connecté du carrier (Stripe Connect Express)
5. Versement J+4 après transfer

### 7.5 Améliorer le compte à rebours

Idées :
- Pauser le `setInterval` quand `document.hidden === true`
- Afficher les secondes quand `< 1 minute restante`
- Notification web push quand `< 30 minutes`

---

## 8. Pièges à éviter

### 8.1 `overflow: hidden` casse `position: sticky`

Vu plusieurs fois. Si la sidebar ne stick pas, inspecter les ancêtres avec DevTools, chercher `overflow: hidden`, le remplacer par `overflow: clip` ou le retirer.

### 8.2 Apostrophes ICU en JSON

```json
// ❌ Plante au parsing ICU
"intro": "En acceptant ce Deal, je m'engage à :"

// ✅
"intro": "En acceptant ce Deal, je m''engage à :"
```

### 8.3 `flex-shrink-0` avec grid

Si on met `flex-shrink-0` sur un élément qui est dans un `grid` (pas un `flex`), c'est ignoré. Bug rencontré lors de la conversion `flex-wrap` → `grid` sur les photos.

### 8.4 `params` est une Promise dans Next.js 16

```tsx
// ❌ Next.js 15 et avant
export default function Page({ params }: { params: { dealId: string } }) {
  return <Client dealId={params.dealId} />;
}

// ✅ Next.js 16
export default async function Page({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  return <Client dealId={dealId} />;
}
```

### 8.5 Variables `NEXT_PUBLIC_*` inlinées au build

Si on ajoute une env var (ex: `NEXT_PUBLIC_API_BASE_URL`), il faut **redémarrer Next.js** pour qu'elle soit visible côté client. Pas de hot reload pour ces variables.

### 8.6 Casse des fichiers : macOS vs Linux/Turbopack

macOS est insensitive (`MyComponent.tsx` == `myComponent.tsx`), Linux/Turbopack sont sensitives. Toujours respecter la casse exacte des imports, sinon le build CI plante alors que local marche.

### 8.7 Toast `sonner` doit être monté dans le layout

Si `toast.success(...)` ne déclenche rien visuellement, vérifier que `<Toaster />` est bien dans `app/[locale]/layout.tsx`.

---

## 9. Tests et debug

### 9.1 Tester sans backend

Le mock retourne `mockDealRequest` après 800 ms peu importe le `dealId`. Donc n'importe quelle URL marche :
- `http://localhost:3000/fr/carrier/deals/abc123`
- `http://localhost:3000/fr/carrier/deals/test`
- `http://localhost:3000/en/carrier/deals/whatever`

### 9.2 Tester le skeleton

Pour forcer le skeleton à s'afficher plus longtemps, augmenter le délai du mock :
```tsx
// deal-request.api.ts
const MOCK_DELAY_MS = 3000; // au lieu de 800
```

### 9.3 Tester le compte à rebours

Pour passer en mode urgent (< 2 h), modifier `mockDealRequest` :
```tsx
const expiresInMs = 1.5 * 60 * 60 * 1000; // 1h30
```

Pour tester l'expiration :
```tsx
const expiresInMs = -1; // déjà expiré
```

### 9.4 Tester le mode décline avec / sans raison

Sans raison : laisser le dropdown vide, ne pas ouvrir détails, clic "Refuser le Deal" → toast OK.
Avec raison : sélectionner "Délais trop courts", ouvrir détails, écrire un message, clic "Refuser le Deal" → console log la payload.

### 9.5 DevTools React

Installer l'extension React DevTools pour inspecter le state local de `DealRequestDesktop` / `DealRequestMobile` :
- `charterAccepted`
- `isSubmittingAccept`
- `declineModalOpen`

### 9.6 Tester en mobile réel via Wi-Fi local

Procédure dans `YAMBA-TEST-MOBILE-WIFI.md`. Permet de vérifier la bottom-bar sticky, le bottom-sheet de refus, la lightbox tactile.

---

## 10. Glossaire technique

| Terme | Définition |
|-------|-----------|
| **App Router** | Système de routing fichier-based de Next.js 13+, basé sur le dossier `app/` |
| **Server Component** | Composant React rendu côté serveur, sans JS envoyé au client. Par défaut dans App Router. |
| **Client Component** | Composant React rendu côté client (interactif), marqué `"use client"` |
| **Hydration** | Phase où React attache les event listeners au HTML rendu par le serveur |
| **Sticky positioning** | `position: sticky` — élément qui reste à un offset défini lors du scroll, jusqu'à ce que son ancêtre sorte de la viewport |
| **ICU plural** | Syntaxe i18n pour gérer les pluriels selon des règles linguistiques (`{count, plural, ...}`) |
| **Skeleton screen** | Placeholder visuel pendant le chargement, mimant la structure finale |
| **Body scroll lock** | Empêcher le scroll du body pendant qu'une modale est ouverte |
| **Backdrop** | Voile semi-transparent derrière une modale ou un bottom-sheet |
| **Mock** | Fausse implémentation utilisée à la place d'une vraie API pour les tests/dev |
| **React Query** | Lib pour gérer le state serveur (cache, refetch, retries) dans React |
| **Stripe Connect Express** | Mode Stripe permettant à des "Connected Accounts" de recevoir des paiements via la plateforme |
| **Deferred capture** | Stripe : autoriser le paiement à un instant T, mais ne débiter qu'à un instant T+n |
| **Escrow** | Compte tampon où les fonds sont retenus en attendant un événement (ex: livraison validée) |
| **Turbopack** | Bundler de Next.js (alternative à Webpack), beaucoup plus rapide en dev |
| **next-intl** | Lib d'internationalisation pour Next.js 13+ avec App Router |
| **JTI** | « JWT ID » — identifiant unique d'un JWT, utilisé pour les sessions multi-appareils |

---

## Notes de version

| Version | Date | Auteur | Notes |
|---------|------|--------|-------|
| 1.0 | 17 mai 2026 | Telama + Claude | Première version, écran réception demande de Deal, frontend complet avec backend mocké |

---

**Fin du document technique.**
