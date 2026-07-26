# Yamba — PR4bis `feat/notification-service` : le guide métier
### Comprendre ce qui a été construit, pourquoi, et comment le vérifier soi-même · Juillet 2026

Ce document explique, sans jargon, ce que la PR4bis apporte à Yamba. Son jumeau technique (`PR4BIS-EXPLICATION-TECHNIQUE.md`) détaille le « comment » pour les développeurs.

---

## 1. Ce qui existe maintenant : la boîte aux lettres de Yamba

Avant cette PR, Yamba savait **raconter** ce qui arrive à un colis (la PR4 publiait les événements — « demande créée », « colis récupéré », « livré »… — sur un canal interne). Mais personne n'écoutait.

Depuis cette PR, un nouveau service — le **notification-service** — écoute ce canal en permanence et transforme chaque événement en **notification dans l'application** pour la ou les bonnes personnes. C'est la boîte aux lettres de la plateforme : chaque utilisateur peut demander « mes notifications » et marquer chacune comme lue.

Le chemin complet, désormais vivant de bout en bout :

```
un fait métier se produit  →  il est écrit en base (l'outbox)
    →  le facteur (relay) le publie sur le canal
        →  la boîte aux lettres (notification-service) l'écoute
            →  la bonne personne trouve sa notification dans l'app
```

**Le point capital : personne n'appelle personne.** Le service des réservations ne connaît pas le service des notifications. Il raconte ce qui se passe ; quiconque veut réagir s'abonne. Demain, un service d'analyse, un moteur de recommandation ou un chat s'abonneront au même canal **sans qu'on touche à une ligne du code existant**. C'est la promesse de la décision D2, et cette PR en est la première preuve complète.

## 2. Qui est prévenu, et quand — la matrice des 17 événements

La règle « qui reçoit quoi » a été gravée dès la PR3 (matrice A15). Cette PR l'implémente pour le canal *in-app* :

| L'événement | Qui voit une notification |
|---|---|
| Demande de transport créée | Le Voyageur (il doit répondre sous 24 h) |
| Demande acceptée / refusée / expirée / annulée avant prise en charge | L'Expéditeur |
| Annulation après acceptation | **Les deux** |
| Colis pris en charge, jalon de vol, refus au pickup | L'Expéditeur |
| Colis livré, transaction terminée, litige ouvert, notes révélées | **Les deux** |
| Versement envoyé | Le Voyageur |
| Rappel de notation (J+5 / J+7) | **Celui qui n'a pas encore noté** — l'événement transporte cette information |
| Reçu de paiement, remboursement émis, code régénéré | Personne in-app : ce sont des **emails** (documents à conserver, sécurité) — ils arriveront avec les chantiers qui créent ces événements (B2+) |

## 3. Les deux garanties qui comptent

**Rien ne se perd.** Si la base est indisponible une seconde, le message n'est pas jeté : il sera re-livré et retraité. Si le canal lui-même tombe, l'API du service reste vivante et le service se reconnecte tout seul (testé en coupant Docker en pleine session).

**Rien n'arrive en double.** La re-livraison est donc *normale* dans ce système — le service tient un registre de tout ce qu'il a déjà traité (le « claim-first » : je note que je m'en occupe, je traite, je note que c'est fait). Un même événement livré deux fois produit exactement une notification. Prouvé en conditions réelles : 12 événements → 12 traitements → zéro doublon.

Et un message **malformé** (qui ne respecte pas le contrat) ne bloque jamais la file : il est mis de côté avec son erreur, consultable, rejouable — les messages suivants continuent de couler.

## 4. Une anecdote de session qui prouve le système

Au comptage final, il « manquait » 4 notifications par rapport au calcul naïf. Enquête : un booking du jeu de données de démonstration a le **même utilisateur** comme Expéditeur ET Voyageur (auto-expédition — une bizarrerie du seed, déjà consignée au backlog). Les événements « livré » et « terminé » visaient donc deux fois la même personne… et le garde anti-doublon a silencieusement fusionné. Le compte tombait juste à l'unité près. Le système n'avait pas un bug ; il a **révélé** celui du jeu de données. La correction du seed est notée en priorité.

## 5. Ce que cette PR ne fait PAS (et où ça se fera)

- **Les emails** : l'infrastructure d'envoi existe déjà (trip-service, auth-service) ; chaque email de la matrice naîtra **avec le chantier qui crée son événement** (B2 pour le paiement, B3 pour le transport…). Livrer 13 gabarits aujourd'hui sur des données de démonstration serait du travail à refaire.
- **L'écran de notifications** dans l'application : la maquette visuelle existe (NotificationsPreview) ; le branchement réel viendra avec le front (PR5+).
- **Les notifications des trajets** (alertes SavedRoutes, abonnés d'un Voyageur) : elles continuent de vivre dans le trip-service, comme avant — décision A26 : on ne migre pas un flux qui marche dans la PR qui fait naître un service.

## 6. Vérifier soi-même en cinq minutes

1. Lancer l'infrastructure locale (Docker) puis les deux services : `deal-service` (le facteur) et `notification-service` (la boîte).
2. Injecter le jeu d'essai : `npx tsx packages/libs/prisma/scripts/seed-outbox.ts` — 6 événements réalistes entrent dans l'outbox.
3. Regarder les journaux : côté facteur, 6 × « Event published » ; côté boîte, 6 × « Event materialized » avec le nombre de destinataires — environ un dixième de seconde plus tard.
4. Compter en base : `npx tsx packages/libs/prisma/scripts/check-notifications.ts` — tout doit être « PROCESSED », zéro échec.
5. Interroger la boîte sans être connecté : `curl localhost:6004/me/notifications` → refus poli (401). La boîte existe, et elle est fermée à clé.

---

**En une phrase** : un fait métier écrit dans la base devient, sans qu'aucun service n'en appelle un autre, une notification dans la poche de la bonne personne — la colonne vertébrale nerveuse de Yamba est branchée, et tout ce qui suivra (emails, analytics, recommandations) s'y branchera de la même façon.
