# 🗺 Yamba — Workflow complet de bout en bout (guide de démo)

> Guide de démonstration du parcours frontend complet, du wizard de réservation à la notation mutuelle.
> Tous les écrans fonctionnent en **mock** (aucun backend requis) grâce au pattern des "IDs magiques".
>
> Prérequis : `npx nx dev user-ui` → http://localhost:3000

---

## 📖 L'histoire : Aminata envoie un colis à Marie via Thomas

| Persona | Rôle | Détails |
|---|---|---|
| **Aminata T.** | Expéditrice (Paris) | ⭐ 4.8 · 12 envois · avatar **violet** dans les vues carrier |
| **Thomas M.** | Voyageur / Tripper | ⭐ 4.9 · 23 deals · vol Paris → Brazzaville, départ 14h00 |
| **Marie Mboungou** | Destinataire (Brazzaville) | +242 06 421 88 12 |

**Colis** : Vêtements · 2,5 kg · 150 € déclarés · « 3 t-shirts, 1 pull, du chocolat français »
**Argent** : Aminata paye **103,75 €** → Thomas reçoit **89,30 €** à J+4 après livraison validée
**Code de livraison mock** : **`742891`**

---

## 🎬 Le parcours chronologique

### Phase 1 — Réservation (J-1)

| # | Écran | Acteur | URL de test |
|---|---|---|---|
| 1 | **Wizard de booking** — colis, photos (violettes), lieux, assurance, paiement | Aminata | via recherche de trajet → booking |
| 2 | **Demande reçue** — PENDING, countdown 24h, accepter/refuser + charte | Thomas | `/fr/carrier/deals/abc123` |
| 3 | **Confirmation d'acceptation** — récap + prochaines étapes | Thomas | accepter depuis l'écran 2 |
| 3b | **Suivi ACCEPTED** — stepper 5 étapes, code 🔒 « En attente », checklist colis | Aminata | `/fr/bookings/abc123` |

### Phase 2 — Jour J : la prise en charge (12h14)

| # | Écran | Acteur | URL de test |
|---|---|---|---|
| 4 | **Pickup** — checklist 5 points obligatoires, photos amber (min 1, upload réel), sidebar confirmation avec progression pédagogique | Thomas | `/fr/carrier/deals/abc123/pickup` |
| 5 | **Code révélé** 🔑 — banner emerald, code `742 891` hero + icônes copier/régénérer (max 5×), partage WhatsApp/SMS/Email pré-rempli, photos pickup | Aminata | `/fr/bookings/picked123` |

→ *Aminata transmet le code à Marie par WhatsApp. Thomas ne connaît jamais le code.*

### Phase 3 — Le voyage (14h → 22h)

| # | Écran | Acteur | URL de test |
|---|---|---|---|
| 6 | **Tracking Voyageur** — spotlight auto-progressif (« Tu es à l'aéroport ? » → « Décollage ? » → « Atterri ? ») avec **undo 5s** dans le toast, timeline état pur, contact Marie | Thomas | `/fr/carrier/deals/picked123` |
| 7 | **Suivi Expéditrice** — banner teal « En vol vers Brazzaville · Dans 4h58 », timeline miroir enrichie (lecture seule), code compact repliable (Repartager/Régénérer), communication Thomas + Marie | Aminata | `/fr/bookings/transit123` |

> Philosophie A+B : seuls PICKED_UP et DELIVERED sont obligatoires ; les événements intermédiaires sont optionnels et rassurent l'Expéditrice.

### Phase 4 — La livraison (22h27, face à face avec Marie)

| # | Écran | Acteur | URL de test |
|---|---|---|---|
| 8 | **Saisie du code** — OTP 6 cases (auto-avance, paste distribué, clavier numérique), 3 tentatives max puis lock 15 min avec countdown, aide « Marie ne se souvient plus ? » | Thomas | `/fr/carrier/deals/picked123/deliver` — code correct : **`742891`** · tester `111111` pour l'erreur (shake) |
| 8b | **Succès** 🎉 — « Livraison validée · 89,30 € virés le [J+4] » + CTA « Noter Aminata » | Thomas | après validation du code |

### Phase 5 — Vérification J+1 → J+4

| # | Écran | Acteur | URL de test |
|---|---|---|---|
| 9 | **Période de vérification** — countdown sobre « Versement automatique dans 2 jours · 14h » (jamais rouge), « Tout s'est bien passé ? » avec confirmation inline → « Paiement libéré ✓ », récap traçabilité (photos pickup + badge code validé), sidebar noter (amber) / signaler (sobre) | Aminata | `/fr/bookings/delivered123` |

### Phase 5-bis — Chemin alternatif : le litige

| # | Écran | Acteur | URL de test |
|---|---|---|---|
| 10 | **Signalement** — 4 blocs numérotés (catégorie, description min 50 caractères, photos **rouges** de preuve, solution souhaitée), process 4 étapes, pledge sur l'honneur, confirmation inline → ticket **YAM-XXXX** | Aminata | `/fr/bookings/delivered123/report` |

### Phase 6 — Clôture : notation mutuelle

| # | Écran | Acteur | URL de test |
|---|---|---|---|
| 11 | **Aminata note Thomas** — avatar violet · critères : Ponctualité / Communication / Soin du colis | Aminata | `/fr/bookings/delivered123/rate` |
| 12 | **Thomas note Aminata** — avatar teal · critères : Clarté de la déclaration / Réactivité / Ponctualité | Thomas | `/fr/carrier/deals/shipper123/rate` |

> Seule la note globale (étoiles) est requise — 30 secondes chrono. Avis publics, attribués, non modifiables, révélés en double-aveugle (quand les 2 ont noté, ou sous 14 jours).

---

## 🧪 Le tour de démo complet (~10 minutes)

```
1.  /fr/carrier/deals/abc123           → accepter le deal (charte)
2.  /fr/bookings/abc123                → vue ACCEPTED, code verrouillé
3.  /fr/carrier/deals/abc123/pickup    → checklist 5/5 + 1 photo → Confirmer
4.  /fr/bookings/picked123             → COPIER le code 742891 (démo partage WhatsApp)
5.  /fr/carrier/deals/picked123        → confirmer les 3 événements (tester l'undo 5s)
6.  /fr/bookings/transit123            → le miroir : « En vol · Dans Xh »
7.  → CTA emerald « Valider la livraison » (ou /picked123/deliver direct)
    → taper 111111 (shake + Tentative 2/3) puis coller 742891 → succès 🎉
8.  /fr/bookings/delivered123          → countdown → « Confirmer la livraison »
    → confirmation inline → « Paiement libéré ✓ »
9.  /fr/bookings/delivered123/rate     → 5 étoiles → Publier → Merci !
10. /fr/carrier/deals/shipper123/rate  → le miroir Voyageur (teal)

Bonus litige : /fr/bookings/delivered123 → « Signaler un problème »
              → formulaire complet → ticket YAM-XXXX
```

**Variantes à montrer** : mobile (DevTools iPhone 14 Pro — bottom-bars, sheets), dark mode, `/en/` (i18n complet).

---

## 🔑 Le pattern des IDs magiques (mock routing)

Le mock déduit le statut du Deal/Booking de son id :

| L'id contient… | → Statut chargé | Exemples |
|---|---|---|
| *(rien de spécial)* | PENDING (carrier) / ACCEPTED (sender) | `abc123` |
| `picked` | PICKED_UP sans événements | `picked123` |
| `transit` | PICKED_UP + AT_AIRPORT + FLIGHT_DEPARTED confirmés (sender) | `transit123` |
| `delivered` | DELIVERED (période de vérification, livré hier ~22h) | `delivered123` |
| `shipper` | contexte notation SHIPPER (le Voyageur note Aminata) | `shipper123` |

---

## 🎨 Le langage visuel transverse

| Couleur | Signification |
|---|---|
| **Violet** `#534AB7` | Déclaration de l'Expéditrice (photos, avatar Voyageur dans la notation) |
| **Amber** `#BA7517` | Pickup du Voyageur (photos de prise en charge, code de livraison) |
| **Rouge** `#A32D2D` | Preuves de litige |
| **Teal** `#0F766E` | Transit / information / avatar Expéditrice |
| **Emerald** | Validé / succès / paiement libéré |
| **Mango** `#FF9900` | Action primaire (CTA) |

---

## ⚠️ Périmètre non couvert (backend à venir)

- Persistance réelle — le mock est **stateless** (les confirmations ne survivent pas au refresh)
- Vue COMPLETED (récap final post-J+4)
- Vue AWAITING_CARRIER (entre paiement et acceptation)
- Machine d'états serveur (transitions, garde-fous)
- Stripe : `transfers.create()` réels, deferred capture
- Hachage bcrypt du code de livraison
- Upload R2 des photos (les `File` sont conservés dans les drafts, prêts)
- Notifications push + emails (relances J+5/J+7 notation, événements tracking)
- Règle du double-aveugle des avis (révélation quand les 2 ont noté ou 14j)

---

*Document généré le 5 juillet 2026 · Yamba frontend mock v1 — parcours complet Expéditeur ↔ Voyageur*
