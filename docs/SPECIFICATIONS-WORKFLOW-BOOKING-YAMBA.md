# 📘 Yamba — Cahier de spécifications fonctionnelles & techniques
## Workflow de transport de colis de bout en bout (Deal lifecycle)

> **Version** 1.0 · 5 juillet 2026
> **Périmètre** : parcours complet Expéditeur ↔ Voyageur, de la réservation à la notation mutuelle.
> **Source** : rétro-ingénierie du frontend implémenté (mock) — ce document fait foi pour l'implémentation backend.

---

# 1. Contexte produit

## 1.1 Vision

Yamba est une **marketplace P2P de transport de colis légers** ciblant la diaspora francophone (modèle « BlaBlaCar pour les colis »). Un **Expéditeur** confie un colis à un **Voyageur** qui effectue déjà le trajet (ex. Paris → Brazzaville), contre rémunération. Un **Destinataire** reçoit le colis à l'arrivée.

Le produit repose sur trois piliers de confiance :
1. **Le code de livraison à 6 chiffres** — preuve cryptographique de remise, jamais connu du Voyageur avant la remise.
2. **La traçabilité photographique** — déclaration (Expéditeur), prise en charge (Voyageur), preuves de litige.
3. **Le paiement séquestré** — débité à la réservation, versé au Voyageur à J+4 après livraison validée, gelable en cas de litige.

## 1.2 Terminologie

| Code / BDD | UI / Marketing | Rôle |
|---|---|---|
| `carrier` | **Voyageur** / **Tripper** (EN) | Transporte le colis sur son trajet |
| `shipper` / `sender` | **Expéditeur·rice** | Confie le colis, paye |
| `recipient` | **Destinataire** | Reçoit le colis, détient le code |
| `deal` / `booking` | **Deal** (côté Voyageur) / **Envoi** (côté Expéditeur) | La transaction |

> ⚠️ La distinction `carrier` (code) / `Voyageur`-`Tripper` (UI) est **intentionnelle** et doit être maintenue.

## 1.3 Personas de référence (jeux de données mock)

| Persona | Attributs |
|---|---|
| **Aminata T.** — Expéditrice | ⭐ 4.8 · 12 envois · vérifiée · Paris |
| **Thomas M.** — Voyageur | ⭐ 4.9 · 23 deals · vérifié · vol Paris (CDG T2E) → Brazzaville (Maya-Maya), départ 14h00, durée 8h |
| **Marie Mboungou** — Destinataire | Brazzaville · +242 06 421 88 12 |

**Transaction de référence** : Vêtements · 2,5 kg · valeur déclarée 150 € · « 3 t-shirts, 1 pull, du chocolat français » · Total payé **103,75 €** (dont commission Yamba 12,75 € + frais Stripe 1,70 €) · Net Voyageur **89,30 €** · Assurance EXTENDED_500 (500 € couverts) · Code : **742891**.

---

# 2. Machine d'états du Deal

## 2.1 Diagramme des états

```
                    ┌──────────┐
   création ───────▶│ PENDING  │──── refus Voyageur ──────▶ DECLINED
   (paiement        └────┬─────┘──── 24h sans réponse ────▶ EXPIRED
    autorisé)            │      ──── annulation Shipper ──▶ CANCELLED
                         │ acceptation (charte)
                    ┌────▼─────┐
                    │ ACCEPTED │──── refus au pickup ─────▶ CANCELLED (+ remboursement)
                    └────┬─────┘
                         │ confirmation pickup (checklist 5/5 + ≥1 photo)
                    ┌────▼──────┐
                    │ PICKED_UP │  événements optionnels :
                    └────┬──────┘  AT_AIRPORT → FLIGHT_DEPARTED → FLIGHT_ARRIVED
                         │ saisie du code valide par le Voyageur
                    ┌────▼──────┐
                    │ DELIVERED │──── signalement Sender ──▶ DISPUTED (payout gelé,
                    └────┬──────┘                            ticket, médiation)
                         │ confirmation anticipée Sender
                         │ OU expiration J+4 automatique
                    ┌────▼──────┐
                    │ COMPLETED │ → transfers.create() Stripe → notation mutuelle
                    └───────────┘
```

## 2.2 Table des transitions

| De | Vers | Déclencheur | Acteur | Effets de bord |
|---|---|---|---|---|
| — | PENDING | Paiement du wizard autorisé | Expéditeur | Notification au Voyageur, countdown 24h démarre |
| PENDING | ACCEPTED | Acceptation + charte cochée | Voyageur | Notif Expéditeur « Thomas a accepté » |
| PENDING | DECLINED | Refus (raison optionnelle parmi 5) | Voyageur | Remboursement intégral, notif Expéditeur |
| PENDING | EXPIRED | 24h écoulées | Système | Remboursement intégral |
| PENDING/ACCEPTED | CANCELLED | Annulation | Expéditeur | Remboursement (ANN-01 : 100 % jusqu'à J-2, retenue 50 % à moins de 48 h — D39) |
| PENDING | CANCELLED | Empreinte de paiement morte (webhook `payment_intent.canceled` — D40) | Système | Kg restitués, notif Expéditeur (aucun remboursement : l'autorisation est déjà libérée) |
| ACCEPTED | PICKED_UP | Confirmation pickup (5 checks + ≥1 photo) | Voyageur | **Génération + révélation du code à l'Expéditeur**, notif |
| ACCEPTED | CANCELLED | Refus au pickup (raison parmi 5) | Voyageur | Remboursement, notif |
| PICKED_UP | PICKED_UP | Événement tracking optionnel | Voyageur | `TrackingEvent` créé, push à l'Expéditeur, timeline miroir mise à jour |
| PICKED_UP | DELIVERED | Code saisi valide (comparaison bcrypt) | Voyageur | `TrackingEvent DELIVERED`, timer J+4 démarre, notif+email Expéditeur |
| DELIVERED | COMPLETED | Confirmation anticipée « tout va bien » | Expéditeur | `transfers.create()` immédiat, notif Voyageur, invitations notation |
| DELIVERED | COMPLETED | Expiration J+4 sans action | Système (cron) | `transfers.create()`, notif « Versement effectué », invitations notation |
| DELIVERED | DISPUTED | Envoi du signalement | Expéditeur | Payout gelé, ticket `YAM-XXXX`, accusé email, notif équipe médiation |
| DISPUTED | COMPLETED / remboursé | Résolution médiation | Yamba | Selon décision (hors périmètre v1) |

## 2.3 Invariants

- **INV-1** : Le Voyageur ne peut **jamais** lire le code de livraison via l'application. Seuls l'Expéditeur (affichage) et le backend (hash) le connaissent.
- **INV-2** : Aucun versement au Voyageur avant `COMPLETED`.
- **INV-3** : La confirmation anticipée est **définitive et irréversible** : elle supprime le droit de signalement.
- **INV-4** : Un signalement est **irréversible** (non modifiable après envoi) et ne peut être émis que pendant la fenêtre DELIVERED → J+4.
- **INV-5** : Après `DISPUTED`, aucun versement automatique n'est possible tant que la médiation n'est pas résolue.
- **INV-6** : Les événements tracking optionnels ne conditionnent aucune transition d'état (philosophie A+B, cf. §3.3).

---

# 3. Règles métier transverses

## 3.1 Le code de livraison

| Règle | Spécification |
|---|---|
| Format | 6 chiffres décimaux (`100000`–`999999`) |
| Génération | À la transition ACCEPTED → PICKED_UP (jamais avant : l'Expéditeur ne voit qu'un 🔒 « En attente » tant que le colis n'est pas physiquement pris en charge) |
| Stockage | **Hash bcrypt** en base ; le clair n'est transmis qu'à l'Expéditeur |
| Révélation | Écran Expéditeur uniquement, avec actions copier / partager (WhatsApp `wa.me`, SMS `sms:?&body=`, Email `mailto:`, message pré-rempli incluant prénoms + route + code) |
| Régénération | Par l'Expéditeur uniquement · **max 5 régénérations** (`MAX_CODE_REGENERATIONS = 5`) · confirmation inline obligatoire · compteur restant affiché · l'ancien code est invalidé · toast rappelant de retransmettre |
| Validation | Par le Voyageur à la remise · **3 tentatives max** (`MAX_DELIVERY_ATTEMPTS = 3`) · au 3e échec : **verrouillage 15 minutes** (`DELIVERY_LOCK_MINUTES = 15`) avec countdown affiché · comparaison bcrypt côté serveur |
| Transmission | Hors-app assumée (Expéditeur → Destinataire par WhatsApp/SMS/oral) — l'app facilite avec messages pré-remplis |

## 3.2 Paiement & versement

| Étape | Règle |
|---|---|
| Réservation | Débit total Expéditeur (ex. 103,75 €) — Stripe Connect Express, MCC 4215, descriptor `YAMBA*COLIS` |
| Décomposition | Total = net Voyageur + commission Yamba + frais Stripe (ex. 89,30 + 12,75 + 1,70) |
| Séquestre | Fonds « en attente chez Yamba » de PENDING à COMPLETED |
| Versement | `transfers.create()` vers le compte Stripe du Voyageur à COMPLETED (J+4 auto ou confirmation anticipée) |
| Affichages d'état | Sender : « Bloqué jusqu'à livraison » (transit) → « Bloqué jusqu'à J+4 » (delivered) → « Libéré » (completed) · Carrier : « Versé à J+4 après livraison » |
| Gel | DISPUTED gèle le payout jusqu'à résolution |
| Remboursements | Intégral sur DECLINED / EXPIRED / CANCELLED pré-pickup / refus pickup ; partiel ou intégral sur décision médiation |

## 3.3 Philosophie de tracking « A+B »

- **Obligatoires** : PICKED_UP et DELIVERED (les deux seuls jalons contractuels).
- **Optionnels** : AT_AIRPORT, FLIGHT_DEPARTED, FLIGHT_ARRIVED — déclenchés volontairement par le Voyageur pour rassurer, **sans pénalité** s'ils sont omis. Chaque confirmation notifie l'Expéditeur (push) et alimente sa timeline miroir.
- **Undo** : toute confirmation d'événement optionnel est annulable pendant **5 secondes** via le toast (pattern Gmail) ; l'envoi effectif au backend n'a lieu qu'après la fenêtre.
- Séquencement strict : les événements se confirment dans l'ordre ; le « spotlight » côté Voyageur ne propose que le prochain événement logique, puis bascule sur le CTA de livraison après FLIGHT_ARRIVED.

## 3.4 Traçabilité photographique — langage visuel

| Couleur | Hex | Contexte | Qui |
|---|---|---|---|
| **Violet** | `#534AB7 → #7F77DD` | Photos déclarées à la réservation (`DECLARED_CONTENT`, `DECLARED_PACKAGED`) | Expéditeur |
| **Amber** | `#BA7517 → #EF9F27` | Photos de prise en charge (`PICKUP_CONTENT`, `PICKUP_PACKAGED`, `PICKUP_OTHER`) | Voyageur |
| **Rouge** | `#A32D2D → #E24B4A` | Photos de preuve de litige | Expéditeur (via Destinataire) |

Règles d'upload (toutes surfaces) : input file natif `accept="image/*"`, preview `URL.createObjectURL` (révoquée au démontage), objet `File` conservé dans le draft pour l'upload R2 backend, retrait possible par photo, re-sélection du même fichier autorisée (`input.value` réinitialisé).

Limites : pickup **min 1 / max 5** photos · litige **max 5** photos, 10 Mo/photo · déclaration : 2 photos types (Contenu / Emballé).

## 3.5 Période de vérification (J+1 → J+4)

- Durée : `VERIFICATION_PERIOD_DAYS = 3`, versement à `PAYOUT_DAY = 4` (J+4 après `deliveredAt`).
- Trois chemins pour l'Expéditeur : **confirmer** (versement immédiat, définitif), **ne rien faire** (versement auto J+4), **signaler** (gel + médiation).
- Ton produit : page d'attente **calme** — countdown sobre (« Versement automatique dans 2 jours · 14h »), jamais de rouge, barre de progression fine, jalons Livraison ✓ / J+1 / … / J+4.

## 3.6 Litige (DISPUTED)

- Fenêtre : de DELIVERED jusqu'à J+4 (affichée : « Tu peux signaler jusqu'au {date} »).
- Champs requis : catégorie (1 parmi 6) + description **min 50 caractères** (`DISPUTE_MIN_DESCRIPTION_LENGTH`) + pledge sur l'honneur coché.
- Champs optionnels : photos (max 5, « Recommandé »), solution souhaitée (1 parmi 4).
- Catégories : `NOT_DELIVERED`, `CONTENT_MISSING`, `DAMAGED`, `SIGNIFICANT_DELAY`, `RECIPIENT_ISSUE`, `OTHER`.
- Solutions : `FULL_REFUND` (montant affiché), `PARTIAL_REFUND`, `CONTACT_CARRIER`, `YAMBA_DECIDES`.
- Process communiqué (4 étapes) : accusé sous 48h ouvrées → contact du Voyageur (sa version + ses preuves pickup) → décision sous 5 jours ouvrés (médiation conventionnelle possible si désaccord) → paiement gelé pendant tout l'examen.
- Envoi : confirmation inline obligatoire (« irréversible, gèle le paiement ») → ticket **`YAM-` + 4 chiffres** → écran d'atterrissage (n° de dossier, rappels gel + email) → retour au suivi.
- Anti-abus : pledge avec mention de responsabilité contractuelle + lien « Pourquoi cet engagement ? » (miroir des Chartes).

## 3.7 Notation mutuelle (post-COMPLETED)

- **Double notation symétrique** : chacun note l'autre ; module unique paramétré par `ratedRole`.
- **Seul champ requis** : note globale 1–5 étoiles (labels : Décevant / Moyen / Correct / Très bien / Excellent). Publier actif dès 1 étoile — objectif 30 secondes.
- Critères optionnels (pouces 👍/👎, toggle, désélectionnables) :
  - Voyageur noté : Ponctualité au RDV · Communication · Soin du colis.
  - Expéditeur noté : Clarté de la déclaration · Réactivité · Ponctualité au RDV.
- Commentaire optionnel : **max 280 caractères** (`RATING_COMMENT_MAX_LENGTH`), compteur avec warning amber à 240, coupe dure à 280.
- Visibilité : avis **public**, **attribué** (nom du noteur), **non modifiable** après publication — avertissement affiché avant.
- **Double-aveugle** : les avis ne sont révélés que lorsque les deux parties ont noté, ou après **14 jours** (anti-représailles, règle backend).
- Relances : email+push à COMPLETED, relances **J+5 et J+7**, puis abandon (pas de spam).
- « Plus tard » toujours disponible, sans friction ni culpabilisation.

---

# 4. Spécifications par écran

> Convention de layout : **desktop** = page `max-w-7xl` avec grid `[minmax(0,1fr)_320px]`, sidebar sticky `top-[88px]`, CTA de décision dans la sidebar · **mobile** = empilement, header sticky 56px, bottom-bar fixe uniquement si action principale permanente. URL stable par entité (`/bookings/[id]`, `/carrier/deals/[id]`) : le **statut** pilote la vue ; les **formulaires d'action** vivent en sous-routes (`/pickup`, `/deliver`, `/report`, `/rate`).

## É2 — Demande de transport (Voyageur, PENDING)
**URL** `/carrier/deals/[dealId]` · **Mock** id quelconque (ex. `abc123`)
- Countdown 24h (urgence < 2h), déclaration complète du colis (photos violettes), lieux, décomposition des gains, profil Expéditrice.
- Actions : **Accepter** (charte du Voyageur à cocher — engagement de vérification, interdits, ponctualité) · **Refuser** (raison optionnelle : catégorie non transportée / trop lourd / lieux incompatibles / timing / autre).

## É3 — Post-acceptation (les deux côtés, ACCEPTED)
**URLs** `/carrier/deals/[id]` (vue acceptée) · `/bookings/[id]`
- Sender : banner « Thomas a accepté », stepper 5 étapes (Accepté ✓ · Pickup · Transport · Livraison · Vérification), **code 🔒 « En attente »** + explication, checklist de préparation du colis, card Voyageur, sidebar paiement/trajet.
- Carrier : récap + CTA d'accès au pickup le jour J (`DealPickupCta`).

## É4a — Prise en charge (Voyageur, formulaire)
**URL** `/carrier/deals/[dealId]/pickup`
- Layout page 2 colonnes. Colonne action : **1. Checklist** 5 items obligatoires (contenu conforme / poids ok / rien d'interdit / emballage ok / articles identifiés) · **2. Photos** (min 1, upload réel, tags Contenu/Emballé) · **3. Notes** libres.
- Sidebar : card « Ce qu'Aminata a déclaré » (référence de comparaison, hint 👁) · **card CONFIRMATION** avec progression pédagogique (« Vérification X/5 · Photos min 1 » — le disabled explique ce qui manque) + info « Aminata recevra son code » + CTAs Confirmer/Refuser · card contact Expéditrice.
- Refus : modal desktop / bottom-sheet mobile, 5 raisons (contenu différent / suspect / surpoids / emballage / autre) → Deal annulé + remboursement.
- Confirmation → statut PICKED_UP + génération du code.

## É4b — Code révélé (Expéditeur, PICKED_UP sans événements)
**URL** `/bookings/[id]` · **Mock** `picked123`
- Banner emerald « Thomas a pris ton colis en charge · confirmé à {h} », stepper étape 3.
- **Card code hero** (amber) : `742 891` monumental + icônes empilées **copier** (feedback ✓ 2s) et **régénérer** (confirmation inline + compteur X/5 restants, disabled à 0).
- Partage 4 canaux fonctionnels (WhatsApp/SMS/Email/Copier le message) avec message pré-rempli.
- Photos du pickup (amber) « Prises le {date} à {h} · {lieu} » · tip « Comment ça va se passer » (4 puces) · sidebar SUIVI DU COLIS (pris en charge ✓ / vol / arrivée / livraison estimée) + card Voyageur.

## É5 — Tracking Voyageur (PICKED_UP)
**URL** `/carrier/deals/[dealId]` · **Mock** `picked123` (vol dans 1h15)
- Banner teal « En transit vers {ville} » + badge countdown vol (tick 60s).
- **TrackingSpotlight** : carte d'action unique auto-progressive — AT_AIRPORT → FLIGHT_DEPARTED → FLIGHT_ARRIVED (amber, optionnels, undo 5s dans le toast) → variant **DELIVER** (emerald, CTA primaire → `/deliver`).
- **Timeline 6 étapes état pur** (zéro bouton — on n'agit que via le spotlight) : Deal accepté ✓ · Pris en charge ✓ (+ photos) · Aéroport · Décollage · Atterrissage · Livraison. Badges « Optionnel ».
- Card **Marie destinataire** (LE contact de la phase) : téléphone affiché, `tel:` + `wa.me` fonctionnels.
- Sidebar : TON PAIEMENT (net + « versé à J+4 » + note sur le déclenchement du compteur) · LE COLIS (+ photos pickup) · EXPÉDITRICE (Message).

## É6 — Suivi Expéditeur (PICKED_UP avec événements)
**URL** `/bookings/[id]` · **Mock** `transit123` (AT_AIRPORT + FLIGHT_DEPARTED confirmés, arrivée ~5h)
- **Même URL que É4b** : `trackingEvents` non vide → É6, sinon É4b (la priorité passe de « transmettre » à « suivre »).
- Banner teal **dynamique 4 états** : pickup / à l'aéroport / **en vol (+ badge « Dans 4h58 »)** / atterri — dérivé du dernier événement.
- **Timeline miroir lecture seule** (6 étapes), textes enrichis (« Thomas est entré dans la zone d'embarquement », « décollage confirmé · vol de 8h »), sous-titre amber sur l'étape active, icône ✈.
- **Card code compacte collapsible** : code lisible + **Repartager** (wa.me pré-rempli) + **Régénérer** (mêmes règles qu'É4b).
- COMMUNICATION : Thomas (« Ton Voyageur · en vol actuellement ») + Marie (Appeler/WhatsApp).
- Sidebar : LE COLIS (photos **violettes** « déclarées à la réservation ») · TON PAIEMENT (« Bloqué jusqu'à livraison » + assurance) · COUVERTURE.
- « Signaler un problème » → `/report` (le formulaire litige est accessible dès cette phase).

## É7 — Saisie du code (Voyageur, remise)
**URL** `/carrier/deals/[dealId]/deliver` · **Mock** code valide `742891`
- Contexte : banner teal « livraison finale », info box amber « Marie est devant toi ? Demande-lui le code… », bande Marie + tel.
- **OTP 6 cases** (groupes 3+3, séparateur ·) : auto-focus, auto-avance, backspace intelligent, **paste distribué**, `inputMode="numeric"` + `autocomplete="one-time-code"`.
- Erreur : animation **shake** + reset + refocus + « Ce code n'est pas le bon » + « Tentative X sur 3 ». 3 échecs → cases disabled + « Saisie bloquée 15 min » + **countdown mm:ss** (tick 1s), déblocage automatique.
- Aide collapsible « Marie ne se souvient plus du code ? » : vérifier WhatsApp/SMS, appeler Aminata ensemble, avertissement blocage. Boutons Écrire/Appeler Aminata.
- Sidebar : LE COLIS À REMETTRE (photos pickup) · UNE FOIS VALIDÉ (net, J+4, note vérification).
- Succès → **É7b** : 🎉 « Livraison validée ! », « {89,30 €} seront virés le {date J+4} », CTAs **« Noter Aminata »** (primaire) / retour Deal / accueil.

## É8 — Période de vérification (Expéditeur, DELIVERED)
**URL** `/bookings/[id]` · **Mock** `delivered123` (livré hier ~22h)
- Banner emerald « Ton colis a été livré à Marie · confirmé {quand} par Thomas avec le code ».
- **PayoutCountdownCard** : « VERSEMENT AUTOMATIQUE DANS · 2 jours · 14h » sobre (jamais rouge), barre emerald, jalons Livraison ✓ / J+1 aujourd'hui / … / J+4 versement, tick 60s.
- **ConfirmAllGoodCard** 3 états : initial (« Tout s'est bien passé ? » + warning définitif) → **confirmation inline** (« Confirmer définitivement ? » Oui/Annuler) → **« Paiement libéré ✓ »** (le countdown disparaît, l'état sidebar passe « Libéré », la card signaler disparaît).
- **DeliveryRecapCard** : colis livré · remis à Marie « hier à 22h27 » + « Code de livraison saisi par Thomas et validé » · traçabilité en 2 groupes (photos pickup amber + badge ✓ « Code validé » pour la livraison — pas de photo à la remise : le code fait preuve).
- Tip « Comment ça marche » : confirmes = payé immédiatement / rien = auto J+4 / signales = gelé + médiation 48h.
- Sidebar : TON PAIEMENT (« Bloqué jusqu'à J+4 » ↔ « Libéré ») · Voyageur · **« Pense à noter Thomas »** (amber, invitant → `/rate`) · **« Quelque chose ne va pas ? »** (sobre, hover rouge, non-invitant → `/report`, masqué après confirmation).

## É9 — Signalement de litige (Expéditeur)
**URL** `/bookings/[bookingId]/report`
- Banner bleu empathie « On est là pour t'aider… le paiement de Thomas reste bloqué ».
- **4 blocs numérotés à états** (gris → mango actif → ✓ emerald) : 1. Catégorie (radios amber, badge Requis) · 2. Description (textarea, compteur doux « X / minimum 50 » gris → « X ✓ » emerald, jamais rouge, badge Requis) · 3. Photos (rouges, upload réel, hint « Demande à Marie… max 5, 10 Mo », badge Recommandé) · 4. Solution souhaitée (radios, montant affiché sur FULL_REFUND, badge Optionnel).
- Process bleu 4 étapes numérotées + pledge (checkbox → emerald, mention responsabilité, « Pourquoi cet engagement ? » collapsible).
- CTA bar : « Une fois envoyé, non modifiable » + Annuler + **Envoyer** (disabled tant que catégorie + 50 car. + pledge non réunis) → **confirmation inline amber** → succès : n° **YAM-XXXX** + rappels (gel, accusé email) + retour au suivi.
- Sidebar : LE DEAL CONCERNÉ (route, livré le, Voyageur, Destinataire, total) · PHOTOS DÉJÀ AU DOSSIER (violettes déclarées + amber pickup — le dossier est déjà documenté) · FENÊTRE DE SIGNALEMENT.

## É10 — Notation mutuelle (les deux côtés, COMPLETED)
**URLs** `/bookings/[id]/rate` (Sender note Carrier) · `/carrier/deals/[id]/rate` (Carrier note Sender) · **Mock** rôle SHIPPER si l'id contient `shipper`
- **Module unique paramétré** (`components/rating/`). Desktop : évaluation à gauche (étoiles hero en card, critères, commentaire) ; sidebar sticky : **card personne+deal fusionnés** (avatar **violet** Voyageur / **teal** Expéditrice, rôle, ⭐, route, badge Terminé, montant versé/reçu) + **card PUBLICATION** (rappel visibilité + Publier + Plus tard ghost + hint « Choisis d'abord ta note » quand disabled). Mobile : empilé + banner amber flush (avec montant) + bottom-bar fixe.
- Succès : « Merci pour ton retour ! » + rappel réciprocité/double-aveugle → accueil.

---

# 5. Modèle de données (types de référence)

## 5.1 Statuts & événements

```ts
type DealStatus = "PENDING" | "ACCEPTED" | "PICKED_UP" | "DELIVERED"
                | "DECLINED" | "EXPIRED" | "CANCELLED";
// + DISPUTED et COMPLETED côté backend (non encore modélisés en front mock)

type TrackingEventId = "AT_AIRPORT" | "FLIGHT_DEPARTED" | "FLIGHT_ARRIVED";
type TrackingEvent = { id: TrackingEventId; at: string /* ISO */ };
```

## 5.2 Entité Deal/Booking (fusion des vues front)

```ts
{
  id: string;
  status: DealStatus;
  createdAt: string; expiresAt: string; acceptedAt?: string;

  shipper:  { id, firstName, lastInitial, rating, shipmentCount, memberSince, isVerified };
  carrier:  { id, firstName, lastInitial, rating, dealCount, isVerified };
  recipient:{ firstName, lastName, city, phone };   // phone révélé au carrier après pickup

  trip: { tripId, originCity, destinationCity, departureDate, durationHours?, isDirect };

  parcel: { category: ParcelCategory; weightKg; declaredValueEur; description;
            photos: Photo[] /* contexts DECLARED_* */ };

  pickupLocation / deliveryLocation: { id, type: "AIRPORT"|"STATION"|"ADDRESS"|"POI",
                                       name, detail?, city, flexibilityNote? };

  insurance: "BASIC" | "EXTENDED_500";

  earnings /* vue carrier */: { totalPaidByShipper, yambaCommission, stripeFees,
                                netForCarrier, payoutDelayDays };
  payment  /* vue sender  */: { totalPaidEur, cardBrand, cardLast4,
                                statementDescriptor, paymentMethod };

  deliveryCode: { status: "PENDING"|"AVAILABLE"|"VALIDATED";
                  code?: string;               // jamais exposé au carrier
                  regeneratedCount: number };   // max 5

  pickup?:   { pickedUpAt, locationName, photos: Photo[] /* PICKUP_* */, notes? };
  trackingEvents?: TrackingEvent[];
  delivery?: { deliveredAt, validatedBy: "CODE", confirmedEarlyAt? };
}
```

## 5.3 Litige & notation

```ts
SubmitDisputePayload = {
  category: "NOT_DELIVERED"|"CONTENT_MISSING"|"DAMAGED"
          | "SIGNIFICANT_DELAY"|"RECIPIENT_ISSUE"|"OTHER";
  description: string;              // >= 50 caractères
  photos: PhotoDraft[];             // <= 5, 10 Mo chacune
  desiredOutcome?: "FULL_REFUND"|"PARTIAL_REFUND"|"CONTACT_CARRIER"|"YAMBA_DECIDES";
  pledgeAccepted: boolean;          // requis true
}
// → retour : { ticketNumber: "YAM-XXXX", submittedAt }

SubmitRatingPayload = {
  overallStars: 1|2|3|4|5;          // seul requis
  criteria: Partial<Record<CriterionId, "UP"|"DOWN">>;
  comment?: string;                 // <= 280
}
// Critères CARRIER : PUNCTUALITY | COMMUNICATION | PARCEL_CARE
// Critères SHIPPER : DECLARATION_CLARITY | RESPONSIVENESS | PUNCTUALITY
```

## 5.4 Constantes métier

| Constante | Valeur |
|---|---|
| `MAX_CODE_REGENERATIONS` | 5 |
| `MAX_DELIVERY_ATTEMPTS` | 3 |
| `DELIVERY_LOCK_MINUTES` | 15 |
| `VERIFICATION_PERIOD_DAYS` / `PAYOUT_DAY` | 3 / 4 |
| `DISPUTE_MIN_DESCRIPTION_LENGTH` | 50 |
| `DISPUTE_MAX_PHOTOS` | 5 (10 Mo/photo) |
| `RATING_COMMENT_MAX_LENGTH` | 280 (warning à 240) |
| Deadline d'acceptation | 24 h (urgence UI < 2 h) |
| Fenêtre undo événement | 5 s |
| Relances notation | J+5, J+7, puis stop |
| Révélation double-aveugle | les 2 ont noté, ou 14 jours |

---

# 6. Contrats API (implémentés en mock → à porter en backend)

| Fonction (mock actuel) | Contrat backend cible |
|---|---|
| `getDealRequest(dealId)` / `getBooking(bookingId)` | `GET /deals/:id` (vue par rôle authentifié) — remplace le routage par « IDs magiques » |
| `acceptDeal` / `declineDeal` | `POST /deals/:id/accept` (charte requise) / `POST /deals/:id/decline` (raison optionnelle) |
| `confirmPickup(checklist, photos, notes)` | `POST /deals/:id/pickup` — valide 5/5 + ≥1 photo, upload R2, **génère le code (bcrypt)**, notifie |
| `refusePickup(reason, details)` | `POST /deals/:id/pickup/refuse` — annulation + remboursement |
| `regenerateDeliveryCode(id, count)` | `POST /deals/:id/code/regenerate` — garde-fou serveur ≤ 5, invalide l'ancien hash |
| `confirmTrackingEvent(id, eventId)` | `POST /deals/:id/events` — idempotent, séquencement contrôlé, débounce serveur pour l'undo 5 s, push Sender |
| `validateDeliveryCode(id, code, attempts)` | `POST /deals/:id/deliver` — compare bcrypt, compte les tentatives **côté serveur**, verrouillage 15 min serveur, transition DELIVERED + timer J+4 |
| `confirmDeliveryEarly(id)` | `POST /deals/:id/confirm` — définitif, transition COMPLETED + `transfers.create()` |
| `submitDispute(id, payload)` | `POST /deals/:id/dispute` — transition DISPUTED, gel payout, ticket, upload photos R2, emails |
| `getRatingContext(dealId)` / `submitRating` | `GET /deals/:id/rating-context` / `POST /deals/:id/rating` — unicité par (deal, auteur), non modifiable, règle double-aveugle |
| *(cron)* | Job J+4 : DELIVERED sans dispute → COMPLETED + versement + notifs + invitations notation ; relances notation J+5/J+7 |

**Exigences transverses backend** : toutes les limites (tentatives, régénérations, fenêtres) revalidées côté serveur (le front n'est qu'indicatif) ; autorisations par rôle (le carrier ne peut pas lire `deliveryCode.code`) ; idempotence des transitions ; horodatage serveur.

---

# 7. i18n & contenu

- Framework **next-intl**, locales **FR** (primaire) / **EN**. Namespaces par module : `booking`, `bookingTracker` (sections `pickedUp`, `senderTracking`, `delivered`, `report`), `carrierDealRequest`, `carrierDealAccepted`, `carrierDealPickup`, `carrierDealTracking`, `carrierDealDeliver`, `rating`.
- **Ton** : tutoiement, chaleureux, direct ; personnalisation systématique par prénoms via placeholders ICU.
- Règles rédactionnelles issues du build :
  - Apostrophe ICU : doubler (`''`) **uniquement** dans les messages contenant des `{placeholders}` ; apostrophe simple partout ailleurs (sinon affichage littéral `''`).
  - Variantes `*Short` systématiques pour mobile.
  - Emphase `**gras**` parsée côté composant (tips, pledges, encarts).
  - Clés de traduction **statiques** uniquement dans le code (mapping switch/case pour les listes — jamais de `t(variable)`).

---

# 8. Design system & conventions UI

- **Couleurs** : mango `#FF9900` (CTA primaire, texte `text-slate-950`) · teal (transit/info/avatar Sender) · emerald (succès/validé) · amber (code, pickup, avertissements doux, notation) · rouge (erreurs, litige) · violet (déclaration/avatar Carrier) · slate (neutres). Dark/light via class strategy.
- **Patterns récurrents** :
  - Grid desktop `[minmax(0,1fr)_320px]`, sidebar sticky `top-[88px]`, **le CTA de décision vit dans la sidebar** avec indicateur de progression pédagogique quand il y a des prérequis.
  - **Confirmation inline** (jamais de modal) pour toute action irréversible : régénérer le code, confirmer la livraison, envoyer un signalement, publier… avec compteurs/warnings contextuels.
  - Banners de statut : `inset` (arrondi, desktop) / `flush` (bord à bord, mobile), icône ronde + titre + sous-titre + badge countdown éventuel.
  - Blocs numérotés à états (gris idle / mango actif / ✓ emerald done) pour tous les formulaires multi-sections.
  - Countdowns **sobres** (jamais de rouge, tick 60 s ; 1 s uniquement pour le lock de saisie).
  - Toasts **Sonner** ; undo dans le toast pour les actions annulables.
  - Mobile : header sticky 56 px, bottom-bar fixe avec `safe-area-inset-bottom` seulement si action permanente ; touch targets ≥ 42 px.
- **Accessibilité** : `aria-live` sur compteurs/labels dynamiques, `role="radiogroup"/"radio"`, `aria-pressed` sur les toggles, `aria-expanded` sur les collapsibles, labels sur les icônes seules.

---

# 9. Sécurité

| Sujet | Mesure |
|---|---|
| Code de livraison | bcrypt en base ; jamais dans les payloads carrier ; régénération plafonnée ; brute-force bloqué (3 essais / 15 min, côté serveur) |
| Confiance mutuelle | Charte Voyageur à l'acceptation ; pledge sur l'honneur au litige ; avis attribués et non modifiables ; double-aveugle anti-représailles |
| Paiement | Séquestre Stripe ; aucune transition COMPLETED sans passage par DELIVERED ; gel sur DISPUTED |
| Preuves | Photos horodatées aux 3 moments clés (déclaration / pickup / litige), servies à la médiation |
| Irréversibilités explicites | Confirmation anticipée, envoi de signalement, publication d'avis — toutes protégées par confirmation inline + texte d'avertissement |

---

# 10. Notifications (spécification backend future)

| Événement | Destinataire | Canal |
|---|---|---|
| Nouvelle demande | Voyageur | push + email (avec deadline 24h) |
| Acceptation / refus | Expéditeur | push + email |
| Pickup confirmé + code disponible | Expéditeur | push + email |
| Événement tracking optionnel | Expéditeur | push |
| Livraison validée (« 3 jours pour valider ou signaler ») | Expéditeur | push + email |
| Versement effectué | Voyageur | push + email |
| Signalement reçu (accusé) | Expéditeur | email (≤ 48h ouvrées) |
| Signalement — demande de version | Voyageur | email |
| Invitation à noter + relances J+5/J+7 | Les deux | push + email |

---

# 11. Hors périmètre v1 / backlog

- Vue **COMPLETED** (récap final des deux côtés) et vue **AWAITING_CARRIER** (entre paiement et acceptation — le mock passe direct à ACCEPTED).
- Écrans DELIVERED persistants côté Voyageur (le succès de saisie n'est pas persisté, mock stateless).
- Messagerie in-app (les boutons « Message » loggent en console).
- Back-office médiation (traitement des tickets YAM-XXXX).
- Notation : page d'affichage des avis sur le profil public.
- Temps réel (polling/websocket) sur le suivi Expéditeur.
- Backend complet : Prisma (modèle Booking/Deal + state machine), endpoints ci-dessus, Stripe transfers, bcrypt, upload R2, crons (expiration 24h, versement J+4, relances), emails EJS.

---

# Annexe A — Matrice URLs de test (mock)

| URL | Vue | Statut simulé |
|---|---|---|
| `/fr/carrier/deals/abc123` | Demande (carrier) | PENDING |
| `/fr/bookings/abc123` | Suivi (sender) | ACCEPTED |
| `/fr/carrier/deals/abc123/pickup` | Formulaire pickup | ACCEPTED |
| `/fr/bookings/picked123` | Code révélé | PICKED_UP (0 événement) |
| `/fr/carrier/deals/picked123` | Tracking carrier | PICKED_UP |
| `/fr/bookings/transit123` | Suivi sender | PICKED_UP (+2 événements) |
| `/fr/carrier/deals/picked123/deliver` | Saisie code (742891) | PICKED_UP |
| `/fr/bookings/delivered123` | Vérification | DELIVERED |
| `/fr/bookings/delivered123/report` | Litige | DELIVERED |
| `/fr/bookings/delivered123/rate` | Noter le Voyageur | (COMPLETED simulé) |
| `/fr/carrier/deals/shipper123/rate` | Noter l'Expéditrice | (COMPLETED simulé) |

# Annexe B — Écrans × acteurs × états (vue synthétique)

```
             PENDING   ACCEPTED   PICKED_UP        DELIVERED      COMPLETED   DISPUTED
Expéditeur      —       É3b       É4b → É6         É8 (+É9)       É10         (suivi ticket*)
Voyageur        É2      É3        É5 (+É7/É7b)     (é. persist.*) É10         (demande version*)
                                                    * = backlog
```

---

*Document rétro-ingénieré depuis le frontend mock v1 (branches feat/post-acceptance → feat/sender-tracking). Toute divergence d'implémentation backend doit être arbitrée contre ce document, puis répercutée ici.*
