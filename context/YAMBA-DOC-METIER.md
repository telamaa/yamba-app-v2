

---

# Parler d'une seule voix — ce que le chapitre 5.32 fait respecter

*(PR `chore/recette-web-5-32`, 13/09/2026 — cahier 01-WEB chapitre 5.32, WEB-VOC-1 à 6.)*

## Le besoin

Yamba s'adresse à des particuliers : un vocabulaire qui change d'un écran à l'autre (« transporteur » ici,
« Voyageur » là), un « vous » au milieu du « tu », ou le mot « assurance » sans contrat d'assureur, c'est de la
confiance perdue — et, pour le dernier, un risque juridique.

## Les règles

**RG-WEB-303 — Deux mots pour les rôles.** « Voyageur » et « Expéditeur » en français, « Traveler » et « Shipper »
en anglais, avec majuscule quand ils désignent le rôle. Jamais « transporteur », « tripper », « yamber »,
« carrier », « traveller » — ni dans un écran, ni dans un email, ni dans un libellé lu par un lecteur d'écran.

**RG-WEB-304 — Aucune « assurance ».** Tant qu'aucun contrat d'assureur n'est signé : « Protection », « Garantie
Yamba ». Le mot est refusé même au sens figuré.

**RG-WEB-305 — Un objet, un nom.** « Bagage en soute 23 kg » et « Bagage cabine 12 kg » (« Checked bag 23 kg »,
« Cabin bag 12 kg ») sur tous les écrans.

**RG-WEB-306 — Yamba tutoie.** Écrans et emails. Un « vous » pluriel qui s'adresse aux deux membres ensemble reste
correct.

**RG-WEB-307 — Rien de fictif en production.** Aucune donnée de démonstration n'est atteignable par un membre, même
par une adresse non liée.

**RG-WEB-308 — Aucun texte manquant.** Jamais une clé technique, un « — » ou une variable brute à la place d'une
phrase — y compris pour une notification qui ne s'affiche pas encore.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 348 | 62 écrans FR/EN + emails | seuls les mots de rôle autorisés | oui (ANO-WEB-98 close) |
| 349 | Assistant « Devenir Voyageur » | « Devenir Voyageur » / « Become a Traveler » | oui |
| 350 | Écran de remise, réservation, suivi, emails | jamais « assurance » | oui (ANO-WEB-99 close) |
| 351 | Bagage en soute sur 5 écrans, 2 langues | une seule formulation | oui (ANO-WEB-100 close) |
| 352 | Tunnel, tableau de bord, deals, création de trajet | tutoiement | oui (ANO-WEB-101 close) |
| 353 | Finances, notifications, messages, mes envois | aucune donnée de démonstration | oui |
| 354 | Tous les écrans, notifications | aucun libellé vide ni clé | oui |
| 355 | Page d'un trajet, « Voir les avis » | mène au profil public | oui (ANO-WEB-102 close) |

## Ce qui reste à trancher

- « expéditeurs » / « voyageurs » en minuscule au sens générique : conservé, à acter.
- Des dizaines de textes encore écrits dans le code plutôt que dans les fichiers de traduction : la seule garantie
  durable est de les migrer.
- La carte de recherche n'indique pas qu'un trajet accepte un bagage en soute.
