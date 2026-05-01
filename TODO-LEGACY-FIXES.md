# Legacy TypeScript fixes — Yamba

## Status : 81 erreurs TypeScript dans le code legacy (trips/filters/search)
## Branche : fix/legacy-typescript-errors

## Catégories à fixer

### A. Convention Next.js xxxAction (~55 erreurs TS71007)
Pour chaque composant : (1) renommer dans le type Props, (2) destructuration, (3) usage interne, (4) fichiers consommateurs.

Composants concernés :
- `CityAutocomplete` : `onSelect`, `onPlaceSelect`, `onClear`
- Steps create trip : `onBack`, `onNext`, `onPublish`, `onSaveDraft`
- `SearchBar` trips : `onFromChange`, `onToChange`, `onDateValueChange`, `onSearch`, `onOpenFilters`
- Filtres trips : `onSortChange`, `onSuperTripperChange`, `onProfileVerifiedChange`, `onInstantBookingChange`, `onVerifiedTicketChange`, `onToggleDepartureBucket`, `onToggleCategory`, `onClear`
- Wrappers trip create : `setDraft`, `toggleCategory`, `toggleHandoffMoment`, `setMobileScreen`
- Modals/UI custom : `onClose`, `onViewTrip`, `onGoTo`

### B. Types nullables (~10 erreurs TS2322)
Solution : ajouter fallback `?? ""` / `?? 0` / `?? false` sur les inputs qui reçoivent un draft partiel.

### C. Propriétés manquantes (~8 erreurs TS2339/TS2551)
- `CreateTripCopy` : ajouter `step4Title`, `step4Sub`, `step5Title`, `step5Sub`, `smallDetourPossible`
- `Draft` : ajouter `handoffMoments`
- Mobile tab : ajouter `labelFr`/`labelEn` (ou utiliser `labelKey` + mapping)

### D. Imports cassés (3 erreurs)
- `useUser` (TS2614) : default export, retirer les braces
- `ChoiceCard` (TS2305) : ajouter `export` dans `TripFormUi.tsx`
- `metadata` (TS71008) : typer avec `import type { Metadata } from "next"`

### E. Enums incomplets
- `DepartureTimeBucket` : ajouter `"night"`
- `CarTripFlexibility` : ajouter `"smallDetourPossible"`

### F. Props orphelines
- Erreur `isFr` : aligner type composant et usage parent.

## Estimation : 3-4h
## Stratégie : fix manuel par catégorie pour éviter les effets de bord d'un script
