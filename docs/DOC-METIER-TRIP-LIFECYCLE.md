# 📗 Documentation métier — Cycle de vie d'un Trajet (Trip)

> **Public visé** : produit, support, développeurs — toute personne devant comprendre *pourquoi* le système se comporte comme il le fait.
> **Document jumeau** : `DOC-DEV-TRIP-LIFECYCLE.md` (implémentation technique et guide de test).

---

## 1. Glossaire

| Terme | Définition |
|---|---|
| **Yamber / Tripper** | Le voyageur qui publie un trajet et transporte des colis. "Tripper" en UI/marketing, `carrier` dans le code et la base. |
| **Expéditeur (Shipper)** | La personne qui confie un colis à un Yamber. |
| **Trip (Trajet)** | L'**annonce** publiée par un Yamber : itinéraire, dates, mode de transport, catégories acceptées, prix, lieux de remise/livraison. |
| **Deal / Booking (Réservation)** | La **transaction** entre un Expéditeur et un Yamber pour un colis donné sur un trajet donné. Un trajet peut porter plusieurs deals. *(Modèle en cours de construction — chantier suivant.)* |
| **Pool public** | L'ensemble des trajets comptés comme "publiés" pour les statistiques du Yamber : statuts PUBLISHED **et** PAUSED. |
| **Escrow** | Le mécanisme de séquestre Stripe : l'argent de l'Expéditeur est encaissé à la réservation (J0) et reversé au Yamber à J+4, après la période de vérification de 3 jours. |

**Principe fondateur** : le **Trajet** (l'annonce), le **Deal** (le colis) et l'**Argent** (l'escrow) ont trois cycles de vie distincts. Ne jamais les confondre — c'est la source de la plupart des questions traitées dans ce document.

---

## 2. Les 6 statuts d'un trajet

| Statut | Libellé UI (FR) | Signification |
|---|---|---|
| `DRAFT` | Brouillon | Créé mais pas visible. Le Yamber peut le compléter, le publier ou le supprimer. |
| `PUBLISHED` | Actif | Visible dans la recherche, réservable par les Expéditeurs. |
| `PAUSED` | En pause | Retiré temporairement de la recherche. Les réservations déjà prises **continuent leur vie normalement**. |
| `COMPLETED` | Terminé | Le voyage est physiquement fini et plus aucune livraison n'est attendue. État atteint **automatiquement** (cron), jamais par une action du Yamber. |
| `CANCELLED` | Annulé | Le Yamber a annulé le trajet. Restaurable en brouillon tant que la date de départ n'est pas passée. |
| `ARCHIVED` | Archivé | Rangé définitivement par le Yamber pour nettoyer son historique. Irréversible (MVP). |

À ces statuts s'ajoute un état transversal : **supprimé** (soft delete). Il ne concerne que les brouillons et rend le trajet invisible partout, définitivement, sans effacer les données (traçabilité).

---

## 3. Le workflow complet

```
                    publier
   ┌────────┐  ─────────────────▶  ┌───────────┐
   │ DRAFT  │                      │ PUBLISHED │ ◀──┐
   └────────┘  ◀─────────────────  └───────────┘    │ reprendre
     │  ▲        repasser en           │   │        │
     │  │        brouillon (*)         │   │ pause  │
     │  │                              │   ▼        │
     │  │                              │  ┌────────┐│
     │  └──────────────────────────────┼──┤ PAUSED ├┘
     │            restaurer (**)       │  └────┬───┘
     │                                 │       │
     ▼                             annuler  annuler
  supprimé                             │       │
  (soft delete,                        ▼       ▼
   définitif)                      ┌───────────────┐
                                   │   CANCELLED   │──┐
                                   └───────────────┘  │
                                                      │ archiver
        cron quotidien                                ▼
   PUBLISHED/PAUSED ────────▶ ┌───────────┐    ┌───────────┐
   (voyage terminé)           │ COMPLETED │───▶│ ARCHIVED  │
                              └───────────┘    └───────────┘
                                     archiver
```

(*) Repasser en brouillon : depuis PUBLISHED ou PAUSED, interdit dès qu'il existe une réservation active.
(**) Restaurer : depuis CANCELLED vers DRAFT, uniquement si la date de départ n'est pas passée.

**Il n'existe aucun autre chemin.** En particulier : COMPLETED et ARCHIVED sont des états dont on ne revient jamais (hormis COMPLETED → ARCHIVED), et un trajet supprimé ne réapparaît jamais.

---

## 4. Matrice des actions par statut

| Action | DRAFT | PUBLISHED | PAUSED | COMPLETED | CANCELLED | ARCHIVED |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Voir le détail | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voir en tant qu'expéditeur | — | ✅ | ✅ | ✅ | — | — |
| Modifier | ✅ | ✅ ¹ | ✅ ¹ | — | — | — |
| Publier / Activer | ✅ ² | — | — | — | — | — |
| Mettre en pause | — | ✅ | — | — | — | — |
| Reprendre | — | — | ✅ ² | — | — | — |
| Repasser en brouillon | — | ✅ ¹ | ✅ ¹ | — | — | — |
| Annuler | — | ✅ | ✅ | — | — | — |
| Restaurer en brouillon | — | — | — | — | ✅ ² | — |
| Archiver | — | — | — | ✅ | ✅ | — |
| Supprimer | ✅ | — | — | — | — | — |
| Dupliquer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

¹ Uniquement **sans réservation active**.
² Uniquement si la **date de départ n'est pas passée**.

Cette matrice est appliquée **côté serveur** (state machine) : le menu affiché dans l'interface n'est qu'un reflet, et toute tentative de contournement (appel API direct) est rejetée avec un message explicite.

---

## 5. Règles de gestion

### Publication

- **RG-01 — Gates de publication.** Un trajet ne peut être publié que si : le profil transporteur est complété, Stripe est configuré (charges activées), le mode de transport, l'origine, la destination et la date de départ sont renseignés, au moins une catégorie de colis est acceptée, et au moins un lieu de remise **et** un lieu de livraison sont définis.
- **RG-02 — Date de départ future.** On ne publie pas, ne reprend pas et ne restaure pas un trajet dont la date de départ est passée. Un trajet est une promesse de transport ; passé le départ, la promesse n'a plus de sens.

### Pause

- **RG-03 — La pause masque, elle n'annule pas.** Un trajet en pause disparaît de la recherche mais reste "publié" au sens des statistiques (pool public) et **les réservations déjà prises continuent normalement** : le Yamber a toujours l'obligation de transporter les colis acceptés.
- **RG-04 — Usage attendu.** La pause sert au Yamber qui a atteint sa capacité, attend une confirmation de billet, ou veut suspendre les nouvelles demandes sans renoncer au trajet.

### Retour en brouillon

- **RG-05 — Interdit avec réservations.** Repasser en brouillon retire le trajet du monde. C'est impossible dès qu'un Expéditeur a réservé : on ne fait pas disparaître un trajet sur lequel quelqu'un a payé. La seule sortie dans ce cas est l'**annulation** (qui assume ses conséquences : remboursements, notifications).
- **RG-06 — Effets.** Le retour en brouillon remet le compteur de publication à zéro pour ce trajet (`publishedAt` effacé) et le sort du pool public.

### Annulation

- **RG-07 — Portée.** L'annulation est réservée aux trajets PUBLISHED ou PAUSED. C'est un acte engageant : il est comptabilisé dans `totalTripsCancelled`, statistique qui alimentera la réputation du Yamber.
- **RG-08 — Un brouillon ne s'annule pas, il se supprime.** Annuler un brouillon n'a pas de sens métier (rien n'a été promis à personne) et polluerait l'historique. *(Durcissement volontaire : l'ancien système l'autorisait.)*
- **RG-09 — Avec réservations (à venir, chantier Booking).** Annuler un trajet réservé déclenchera le remboursement intégral de chaque Expéditeur et leur notification immédiate. Une pénalité de réputation est envisagée en V2.
- **RG-10 — Restauration.** Un trajet annulé peut être restauré **en brouillon** (pas directement publié : le Yamber doit revalider ses informations) tant que la date de départ n'est pas passée.

### Suppression

- **RG-11 — Réservée aux brouillons.** Seul un brouillon peut être supprimé. Dès qu'un trajet a été publié, il a pu être vu, mis en favori, partagé : il ne disparaît jamais de la base.
- **RG-12 — Soft delete.** La suppression est logique (marquage), jamais physique. Le trajet devient invisible partout — y compris pour son propriétaire — mais les données restent auditables. Un trajet supprimé est traité comme *inexistant* par l'API.
- **RG-13 — Définitif.** Il n'existe pas de corbeille ni de restauration d'un brouillon supprimé (MVP). La confirmation en deux temps côté interface est la seule protection.

### Archivage

- **RG-14 — Rangement, pas suppression.** L'archivage permet au Yamber de nettoyer son historique. Il ne s'applique qu'aux trajets **terminés ou annulés** — jamais à un trajet encore "vivant".
- **RG-15 — One-way.** Pas de désarchivage (décision MVP, principe YAGNI : mémoriser le statut d'origine pour un besoin marginal n'est pas justifié). **Dupliquer** reste disponible sur un trajet archivé : c'est la réponse au Yamber qui veut "refaire le même trajet".

### Complétion (passage à Terminé)

- **RG-16 — Automatique, jamais manuelle.** Le Yamber ne "termine" pas son trajet lui-même : le système le fait quand les conditions objectives sont réunies. Cela évite les complétions prématurées (colis encore en transit) comme les trajets zombies.
- **RG-17 — Règle composite.**
  - *Trajet sans aucune réservation* : terminé automatiquement **24h après la date d'arrivée** (à défaut, la date de départ). La grâce de 24h absorbe retards et fuseaux horaires.
  - *Trajet avec réservations* (dès que le modèle Booking existera) : terminé quand **tous les deals sont en état terminal logistique** — livré confirmé par l'Expéditeur, auto-confirmé après la période de vérification de 3 jours, annulé, **ou en litige**.
- **RG-18 — Les litiges ne bloquent pas la complétion.** Le voyage est physiquement fini ; le litige est une affaire du deal concerné (et de son paiement), pas de l'annonce. Il bloque le versement de **ce deal-là**, rien d'autre.
- **RG-19 — Le paiement est totalement découplé.** Le versement au Yamber (escrow J+4, `transfers.create()` par deal) n'a **aucune influence** sur le statut du trajet. Un trajet peut être Terminé avec un payout encore gelé par un litige — c'est normal et voulu.
- **RG-20 — Filet de sécurité (à venir, chantier Booking).** Si un deal traîne dans un état intermédiaire 7 jours après l'arrivée, le système force la complétion du trajet et lève une alerte pour investigation manuelle.

### Modification

- **RG-21 — Brouillon : liberté totale.** Un DRAFT se modifie sans restriction.
- **RG-22 — Publié/En pause : uniquement sans réservation.** Dès la première réservation active, le trajet est **intouchable** (pattern BlaBlaCar strict) : un Expéditeur a payé sur la base de dates, d'un prix et de conditions précises. La seule issue pour un Yamber qui doit changer ses plans est l'annulation. *(Décision MVP : l'édition partielle de champs "cosmétiques" sera envisagée si la demande émerge.)*
- **RG-23 — Terminé/Annulé/Archivé : lecture seule.** Ces trajets sont des archives ; on les consulte, on les duplique, on ne les réécrit pas.

### Statistiques du Yamber

- **RG-24 — `totalTripsPublished` = taille du pool public.** Le compteur reflète les trajets actuellement Actifs **ou** En pause. Il évolue à chaque entrée/sortie du pool, quel que soit le chemin emprunté (publication, annulation, retour en brouillon, complétion).
- **RG-25 — `totalTripsCancelled` s'incrémente à chaque annulation** (depuis Actif comme depuis En pause). Il ne se décrémente jamais, même après restauration : l'annulation a eu lieu, elle compte.

### Sécurité et confidentialité

- **RG-26 — Le détail privé d'un trajet n'est visible que par son propriétaire.** Les autres utilisateurs passent par la fiche publique, qui expose une version filtrée (prénom + initiale, pas de coordonnées) et uniquement pour les trajets Actifs.
- **RG-27 — On ne révèle pas l'existence d'un trajet supprimé.** Toute tentative d'accès renvoie le même message qu'un trajet inexistant.

---

## 6. Questions fréquentes (support)

**« J'ai supprimé mon brouillon par erreur, on peut le récupérer ? »**
Non (RG-13). Les données existent techniquement en base, mais aucune restauration n'est prévue au MVP. Le Yamber doit recréer le trajet — le suggérer via Dupliquer si un trajet similaire existe.

**« Mon trajet est en pause, est-ce que je dois quand même transporter le colis réservé la semaine dernière ? »**
Oui, absolument (RG-03). La pause n'affecte que les *nouvelles* demandes.

**« Pourquoi je ne peux pas modifier la date de mon trajet ? »**
Un Expéditeur a réservé (RG-22). Les options : contacter l'Expéditeur via la messagerie pour s'arranger, ou annuler le trajet (avec remboursement automatique).

**« Mon trajet affiche Terminé mais je n'ai pas encore reçu mon argent. »**
Normal (RG-19) : le statut du trajet et le versement sont indépendants. Le versement de chaque colis suit son propre calendrier (J+4 après livraison, ou à la résolution du litige le cas échéant).

**« Je veux remettre en ligne mon trajet archivé. »**
Impossible (RG-15) — proposer Dupliquer, qui recrée un brouillon identique à ajuster.

**« Pourquoi mon compteur de trajets publiés a baissé ? »**
Un trajet est sorti du pool public : annulé, repassé en brouillon, ou terminé automatiquement par le système (RG-24).

---

## 7. Décisions produit — trace et justification

| Décision | Alternative écartée | Justification |
|---|---|---|
| Suppression = soft delete, brouillons uniquement | Hard delete ; suppression de trajets publiés | Traçabilité, intégrité des références (messages, liens partagés), obligations d'audit dès qu'il y a paiement |
| Archive one-way | Désarchivage avec mémoire du statut précédent | YAGNI : complexité disproportionnée pour un besoin marginal ; Dupliquer couvre le vrai besoin |
| Complétion automatique par règle composite | (a) 24h après l'arrivée seul ; (b) après paiement du Yamber | (a) marquerait Terminé des trajets avec colis encore en transit ; (b) lierait le statut de l'annonce aux aléas financiers (litiges = trajets "Actifs" des semaines après l'atterrissage) |
| Litiges non bloquants pour la complétion | Attendre la résolution des litiges | Le litige est un événement du deal ; un litige peut durer des semaines et ne change rien au fait que le voyage est fini |
| Édition verrouillée dès la 1ère réservation | Édition partielle par liste de champs autorisés | Simplicité et prévisibilité (pattern BlaBlaCar) ; l'édition partielle est un nid à bugs de validation — réévaluable en V2 |
| Un brouillon ne s'annule pas | Statu quo (annulation possible depuis DRAFT) | Rien n'a été promis à personne ; l'annulation d'un brouillon polluait l'historique et les statistiques |
| `DELETE /trips/:id` conservé en alias d'annulation | Suppression de l'ancienne route | Backward-compatibilité (même philosophie que les alias de sections du dashboard) |

---

## 8. Périmètre à venir (chantier Deal lifecycle)

Les règles suivantes sont **déjà écrites dans le système** mais dormantes tant que le modèle Booking n'existe pas :

- verrouillage de l'édition dès la première réservation (RG-22) ;
- interdiction du retour en brouillon avec réservations (RG-05) ;
- complétion conditionnée aux deals terminaux (RG-17, règle 2) ;
- side-effects de l'annulation avec réservations : remboursements et notifications (RG-09).

Leur activation ne demandera **aucune modification** de ces règles : uniquement le branchement de la détection des réservations actives.
