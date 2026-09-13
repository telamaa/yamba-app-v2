

---

# Back-office — entrer, et seulement si c'est bien toi (cahier 02-ADMIN § 4.1)

*(PR `chore/recette-admin-4-1`, 13/09/2026 — ADM-SEC-1 à 6.)*

## Le besoin

Un compte admin peut rembourser, sanctionner, effacer : son ouverture exige deux preuves, ne révèle rien à un
attaquant, et dit clairement à l'administrateur légitime ce qui se passe quand ça bloque.

## Les règles

**RG-ADM-SEC-01 — Deux étapes, toujours** : mot de passe, puis un code d'application ou un code de secours ; aucune
session avant le second.

**RG-ADM-SEC-02 — Un refus ne renseigne pas** : même message pour un mot de passe faux et un compte inexistant.

**RG-ADM-SEC-03 — Un code ne sert qu'une fois** (code d'application dans son pas de 30 s, code de secours pour
toujours) ; il reste huit codes de secours à l'enrôlement, un avertissement à deux.

**RG-ADM-SEC-04 — Cinq échecs bloquent le compte quinze minutes, où qu'on soit** — et l'écran le DIT, même au titulaire
qui tape enfin le bon code.

**RG-ADM-SEC-05 — Cinq minutes entre le mot de passe et le code** ; au-delà, on recommence.

**RG-ADM-SEC-06 — Chaque ouverture de session est journalisée et annoncée par email** ; les refus ne sont pas
journalisés.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| ADM-1 | Mot de passe faux / compte inexistant | même message, aucune session, aucune ligne | oui |
| ADM-2 | Premier accès d'un nouvel admin | QR, 8 codes, email, secret chiffré, deux lignes | oui |
| ADM-3 | Même code réutilisé | refusé | oui |
| ADM-4 | Code de secours, puis réutilisé, puis à deux restants | accepté, refusé, avertissement | oui |
| ADM-5 | Cinq échecs, puis le bon code, puis 15 min | refusé avec le motif, puis accepté | oui (ANO-ADM-01 close) |
| ADM-6 | Code saisi après 5 min | « Délai dépassé » | oui |

## Ce qui reste à trancher

- La cible de `ADMIN_LOGIN` (`SESSION` sans identifiant) : le filtre par cible du journal ne retrouve pas les
  connexions d'un admin.
- Aucun écran pour régénérer ses codes de secours.
