

---

# Ce qui a déjà cassé ne recasse pas — ce que le chapitre 7 fait respecter

*(PR `chore/recette-web-7`, 13/09/2026 — cahier 01-WEB chapitre 7, WEB-NRG-1 à 12.)*

## Le besoin

Douze défauts ont déjà atteint un membre : un prix à zéro, une fenêtre sans croix sur téléphone, une réservation en
écran blanc, un geste sensible muet… Chacun se rejoue avant de déclarer une recette terminée, et chacun est désormais
gardé par un scénario automatique.

## Les règles

**RG-WEB-309 — Un Voyageur accède à ses virements Stripe depuis Finances**, derrière la porte par code ; c'est le
serveur qui dit si le compte existe, jamais une supposition de l'écran.

**RG-WEB-310 — Finances s'ouvre sur ce qui concerne le membre** : le portefeuille pour un Voyageur, les paiements pour
un Expéditeur — dès le premier affichage, y compris à l'ouverture directe de la page.

**RG-WEB-311 — Un bouton raccourci garde un nom complet** : « Partager » à l'écran, « Partager un trajet » pour un
lecteur d'écran.

**RG-WEB-312 — Une navigation normale ne rencontre jamais la limitation** — mesurée sur les plafonds de production,
pas sur ceux d'un poste de test.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 356 | Cartes de résultat, desktop et téléphone | une heure réelle ou rien | oui |
| 357 | Recherche, 8 pages de trajet, étape 1 sans poids | aucun prix à zéro, aucune note « 0.0 » | oui |
| 358 | Quatre portes d'identité sur téléphone | croix visible qui ferme | oui (ANO-WEB-105 close) |
| 359 | Étape 1 sur les 8 trajets | jamais un écran blanc | oui |
| 360 | Messagerie sur téléphone, message envoyé, rendez-vous long | tout tient dans l'écran | oui |
| 361 | 10 écrans × 2 langues | aucun avertissement, aucun texte manquant | oui |
| 362 | Cinq gestes sensibles | la porte par code s'ouvre | oui (ANO-WEB-103, 104 closes) |
| 363 | « Mes trajets » FR/EN, masquer puis remettre en ligne | libellés et toasts exacts | oui |
| 364 | Annuler un trajet qui porte des deals | refus nommant le nombre de deals | oui |
| 365 | Cinq minutes de navigation | aucune limitation ; ≈ 56 % du plafond de production | oui |
| 366 | Origines du poste | autorisées ; une origine étrangère refusée | oui |

## Ce qui reste à trancher

- Le plafond des visiteurs (100 requêtes par quart d'heure, partagé par adresse IP) : à mesurer sur un build de
  production avant de décider.
- Une origine refusée répond « erreur serveur » (500) au lieu d'un refus (403).
- L'écran « Devenir Voyageur » lit encore un champ que le serveur ne fournit pas pour dire « configuration
  incomplète ».
