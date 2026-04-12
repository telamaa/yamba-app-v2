# Create Trip UI — Documentation technique

## 1. Objectif du module

Le dossier `create/` contient l’interface de création d’un trajet côté front.

Cette feature permet à un utilisateur de créer une annonce de transport en **3 étapes** :

1. **Trajet**
2. **Conditions**
3. **Publication**

À ce stade, cette partie est principalement **UI / UX** :
- gestion du wizard,
- gestion du brouillon local,
- expérience desktop et mobile,
- résumé visuel,
- préparation du format de données pour la future API.

Cette documentation a pour but de :
- expliquer l’arborescence,
- décrire le rôle de chaque fichier,
- documenter les règles métier déjà intégrées,
- faciliter les évolutions futures.

---

## 2. Arborescence

Structure principale de la feature :

```txt
create/
├─ mobile/
│  ├─ TripMobileHeader.tsx
│  ├─ TripMobileBottomBar.tsx
│  └─ TripMobileOverlay.tsx
├─ steps/
│  ├─ StepTrip.tsx
│  ├─ StepConditionsSimple.tsx
│  └─ StepPublish.tsx
├─ create-trip.types.ts
├─ create-trip.state.ts
├─ create-trip.copy.ts
├─ create-trip.config.ts
├─ CreateTripWizard.tsx
├─ CreateTripWizardSkeleton.tsx
├─ TripFormUi.tsx
├─ TripProgressBar.tsx
└─ TripSummarySidebar.tsx
