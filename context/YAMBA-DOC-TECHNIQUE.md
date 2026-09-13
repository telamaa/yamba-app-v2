

---

# Cahier 02-ADMIN, § 4.1 : la connexion en deux étapes — et un outil pour relire le journal

*(PR `chore/recette-admin-4-1`, 13/09/2026.)*

## Ce qui a été fait

Le premier chapitre du cahier du back-office : six fiches (ADM-SEC-1 à 6), conformes, une après correction
(`ANO-ADM-01`).

```
apps/e2e/src/admin/adm-sec-connexion.spec.ts        7 scénarios en série (compte admin jetable, attentes réelles)
apps/e2e/src/pages/journal-admin.ts                 NOUVEAU — lireLeJournal / actionsDuJournal (API de /audit)
apps/admin-ui/src/components/LoginFlow.tsx          ANO-ADM-01 — le code du refus d'abord
```

## Relire le journal comme un administrateur

`GET /admin/audit` (permission `audit.read`) est l'API de l'écran `/audit`. L'outil pagine par `nextCursor`, borne par
`from` (le journal n'est jamais purgé : sans borne, il rend les exécutions précédentes) et retourne la liste dans l'ordre
**chronologique** — le serveur la sert du plus récent au plus ancien. Piège payé : une borne « maintenant moins une
seconde » a ramassé la dernière connexion de la fiche précédente ; la borne se pose après deux secondes de silence
quand la fiche d'avant a agi sur le même compte.

## Un compte admin jetable

```ts
await new Inscription(page).creer(neuf, mailpit);                        // un membre normal
grantAdmin(neuf.email, "--role", "OPS");                                 // § 2.5, sortie du script vérifiée
// … enrôlement : le secret lu à l'écran, totpCode(secret) calculé …
// afterAll : grantAdmin(email, "--revoke") puis suppression du compte
```

Le blocage de SEC-5 dure quinze minutes et SEC-4 consomme six codes de secours : sur un compte de recette, les
chapitres suivants seraient bloqués.

## ANO-ADM-01 : un 401 n'est pas une explication

```tsx
const code = codeDuRefus(err);                // (err.data as { details?: { code } }).details.code
if (code === "TOO_MANY_ATTEMPTS") setError("Trop de tentatives : ce compte est bloqué pendant 15 minutes. …");
else if (code === "ADMIN_PREAUTH_EXPIRED" || code === "ADMIN_PREAUTH_REQUIRED" || /expired|required/i.test(err.message)) …
else setError(err.status === 401 ? "Code invalide." : …);
```

Le serveur servait déjà le bon code (A146) ; l'écran ne le lisait pas et rangeait tout 401 sous « Code invalide. ».

## Tests

`apps/e2e` : **339 scénarios** (332 + 7). Plateforme inchangée (1000 + auth 230). Typecheck admin-ui et harnais verts.
