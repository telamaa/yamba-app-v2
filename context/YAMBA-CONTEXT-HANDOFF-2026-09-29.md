# Handoff — 29/09/2026 · redémarrage Mac, lot « flux d'atterrissage localisé » ACTÉ (candidat D80)

*Point d'entrée de reprise — remplace le handoff du 28/09. Le Mac a redémarré seul en pleine
session le matin du 29/09 : la conversation qui avait conclu le lot feed a été perdue, l'état a
été reconstruit depuis le dépôt, puis la décision a été re-discutée et RE-VALIDÉE avec
l'utilisateur (les trois arbitrages du § 3). Rien n'a été perdu sur le disque.*

---

## 1. L'état, en une ligne

`dev` = `4280947` : **#381 ET #382 SONT MERGÉES** (le clic « sans effet » du 28/09 a fini par
aboutir). Trois chantiers en file : `feat/mobile-results` (page résultats mobile, 10 commits,
rebasée sur dev le 29/09 à 7h08, **PAS re-poussée** — origin porte la version pré-rebase — ni
PR ni docs), la **PR d'état 381/382** toujours à faire (CONTEXT + SUIVI, jalon 4 à réestimer),
et `feat/feed-relevance-server` (créée à 8h50, **vierge**) qui portera le lot ci-dessous.

## 2. Le lot acté : le flux d'atterrissage localisé (candidat D80 — à graver AVANT le code)

Le besoin, dans les mots de l'utilisateur : « afficher ces résultats intelligemment comme fait
Airbnb — des trajets au départ de sa ville, sinon à proximité, et ainsi de suite ; jamais une
version MVP ». Le doc de décision complet est en ligne (doc Claude « Pertinence par défaut »,
https://claude.ai/code/artifact/84dc71ce-0a2f-4410-b0cb-55d34ee5b538). L'essentiel :

- **Ancrage en cascade** (jamais de prompt GPS à l'atterrissage) : adresse du membre → dernière
  recherche → SavedRoutes → GPS sur geste « Autour de moi » → **IP via GeoLite2 hors-ligne**
  (c'est l'étage qui sert le NOUVEAU sans aucune data) → région de l'appareil (ancrage pays)
  → **flux découverte** (diversité : 3-4 trajets max par corridor en premières pages).
  Dès la première recherche, le visiteur a un ancrage (mémorisé côté client, aucun profil serveur).
- **Anneaux de proximité** : même ville → ~100 km → région → pays → international ; l'anneau
  domine, le **score qualité** départage dedans (départ jouable ~J+1..J+7, place restante avec
  malus massif si plein, confiance avec prior neutre sans-note, prix en percentile de fenêtre,
  fraîcheur ; JAMAIS les vues — boucle de rétroaction). Départage final par `id` (A199).
- **Sections visibles** rendues par les fronts (« Au départ de Douala », « À proximité »…) +
  chip « Autour de : X ✕ » — l'intelligence se VOIT.
- **Technique** : fonctions pures (`feed-ranking.ts`), calcul en lecture sur fenêtre bornée
  (patron D33 du même contrôleur), haversine de `saved-route-matching.helper.ts` réutilisée,
  zéro changement de schéma (`Trip.originLat/Lng` existent déjà) ; défaut du DTO → `relevance`,
  paramètre `near` optionnel, anneau annoté par résultat, OpenAPI régénéré.
- **Invariants** : ANO-API-11 (l'ordre, jamais le nombre), D71 (pur, en lecture, jamais stocké
  ni servi), D62 (poids en arguments par défaut), D78 étendue (IP jamais transmise à un tiers,
  position jamais journalisée par membre, GPS sur geste).
- Utile mesuré : le front web n'envoie `sort` que s'il diffère de `earliest`
  (`trip.api.ts:79`) — le nouveau défaut serveur coule vers le web sans changement obligé.

## 3. Les trois arbitrages rendus le 29/09 (ne pas re-demander)

1. **GeoLite2 embarqué : OUI** (licence MaxMind gratuite, ~60 Mo, hors-ligne, mise à jour périodique).
2. **Sections visibles dans la liste : OUI** (le geste Airbnb, pas une liste fluide anonyme).
3. **Ordre : `feat/mobile-results` mergée D'ABORD**, puis le feed serveur construit sur cette page.

## 4. Par où reprendre, dans l'ordre

1. `feat/mobile-results` : re-pousser la branche rebasée (`--force-with-lease`), écrire les
   docs du lot (registre A-next, cumulatifs), ouvrir la PR, CI comptée, merge par l'utilisateur.
2. PR d'état 381/382 (+ #383 résultats si mergée d'ici là) : CONTEXT + SUIVI, jalon 4 réestimé
   (l'app a splash, atterrissage, recherche-first, page trajet, auth complète, page résultats).
3. Graver **D80** au registre (contenu = § 2), puis coder le lot sur `feat/feed-relevance-server`.

## 5. Le poste (inchangé du 28/09)

- Metro : `npx nx start @yamba-app/mobile` (jamais un `expo start` nu). Six services + Docker
  (Redpanda, Mailpit) pour l'auth ; OTP dans Mailpit `localhost:8025`.
- `context/captures/filtre/` (07h06 le 29/09) : les deux captures web de référence de la feuille
  Filtres et de « Modifier la recherche » — canal design, non versionné, à garder.
- Branche locale `chore/etat-381` : à recycler en la PR d'état du § 4.2 ou à supprimer.

## 6. Pièges du jour

- Un redémarrage machine emporte la CONVERSATION mais pas le dépôt : tout ce qui est conclu à
  l'oral doit finir SUR LE DISQUE (registre, handoff, doc) dans la foulée — ce handoff existe
  pour ça.
- `feat/mobile-results` rebasée mais pas poussée : un `git push` nu sera refusé (divergence) —
  `--force-with-lease` obligatoire, et la PR n'existe pas encore.
