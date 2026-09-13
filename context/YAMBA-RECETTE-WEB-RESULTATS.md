

---

## Cahier 02-ADMIN — § 4.1 Connexion en deux étapes · **CONFORME** (6 fiches jouées, 1 après correction · 1 anomalie close · 1 écart documentaire · 7 scénarios, 17 min)

`apps/e2e/src/admin/adm-sec-connexion.spec.ts`. Premier chapitre du cahier du back-office : tout le reste suppose qu'une
session admin s'ouvre correctement. La règle centrale de ce cahier est appliquée à chaque fiche (§ 3.4) — **un geste se
vérifie à l'écran ET dans le journal d'audit** — par un outil nouveau, `pages/journal-admin.ts`, qui relit le journal
par l'API de l'écran `/audit` avec une session super administrateur (jamais en base : la recette prouve ce qu'un
administrateur peut effectivement relire), borné dans le temps (le journal n'est jamais purgé).

Un **compte admin jetable** porte les fiches qui consomment ou immobilisent : un membre neuf promu par `grant-admin.ts`
(réponse du script vérifiée), enrôlé, puis révoqué et effacé en fin de chapitre — les sept comptes de recette restent
intacts. Les **codes TOTP sont calculés** à partir du secret affiché ou enrôlé, comme le ferait une application
d'authentification. Les **attentes réelles** (5 et 15 minutes) s'emboîtent : SEC-6 se joue pendant le blocage de SEC-5.

| Fiche | Ce qui est éprouvé | Verdict · Preuve |
|---|---|---|
| ADM-SEC-1 | Email et mot de passe | **Conforme** — la racine renvoie à `/login` ; titre et sous-titre exacts ; mot de passe faux ET compte inexistant → le même « Email ou mot de passe incorrect. » (aucune énumération) ; bon mot de passe → l'écran du code ; cookie `admin_preauth` httpOnly ≈ 5 min, **aucun** `admin_access_token` ; **aucune** ligne de journal |
| ADM-SEC-2 | Premier enrôlement | **Conforme** — l'écran d'enrôlement (pas le champ du code) ; QR (`alt` « QR code TOTP ») et secret base32 en chasse fixe ; code calculé → « 2FA activée. Codes de secours, montrés une seule fois : », **8** codes `ABCDE-FGHIJ` sur **deux colonnes**, la mention ; « J'ai enregistré mes codes » → `/home` ; ✉ « Nouvelle connexion au back-office Yamba » avec IP, appareil, date ; en base `totpSecretEncrypted` posé et différent du secret, secret absent de toute ligne `AdminAction` ; journal `ADMIN_TOTP_ENABLED` (USER · id) puis `ADMIN_LOGIN` |
| ADM-SEC-3 | Code courant et anti-rejeu | **Conforme** — connexion → `/home` ; « Se déconnecter » ; le **même code** dans le même pas de 30 s → « Code invalide. » ; le code suivant passe ; journal `ADMIN_LOGIN`, `ADMIN_LOGOUT`, rien pour le refus, `ADMIN_LOGIN` |
| ADM-SEC-4 | Code de secours | **Conforme** — un code de secours ouvre la session (journal `ADMIN_BACKUP_CODE_USED` puis `ADMIN_LOGIN`) ; réutilisé → « Code invalide. » ; 7 codes restants → aucun avertissement ; **consommés jusqu'à deux** → « Il te reste 2 code(s) de secours » dans la barre latérale |
| ADM-SEC-5 | Blocage après cinq échecs | **Conforme après correction** → `ANO-ADM-01` ; cinq codes faux → « Code invalide. » ; le **vrai** code refusé (`TOO_MANY_ATTEMPTS`) avec désormais « Trop de tentatives : ce compte est bloqué pendant 15 minutes… » ; un **autre navigateur** bloqué aussi (compteur par compte) ; clé Redis `admin_totp_fail:<id>`, TTL ≤ 900 s ; aucune ligne de journal ; **15 minutes plus tard**, le vrai code passe (seule ligne : `ADMIN_LOGIN`) |
| ADM-SEC-6 | Délai de pré-authentification | **Conforme** — 5 min 15 s sans rien saisir, puis un code valide → « Délai dépassé : recommence depuis le mot de passe. », retour au formulaire ; aucune ligne |

### Anomalie

- **ANO-ADM-01 (bloquante par la fiche, close)** — **un compte bloqué affichait « Code invalide. », même avec le bon
  code.** Le serveur refuse proprement (401 `TOO_MANY_ATTEMPTS`, « Too many attempts. Try again in 15 minutes. ») mais
  l'écran traduisait TOUT 401 en « Code invalide. » : l'administrateur se croyait fautif et réessayait pendant quinze
  minutes. Correction (`apps/admin-ui/src/components/LoginFlow.tsx`) : l'écran lit `details.code` (A146) —
  `TOO_MANY_ATTEMPTS` → « Trop de tentatives : ce compte est bloqué pendant 15 minutes. Réessaie ensuite avec un
  nouveau code. », et le délai dépassé se reconnaît à `ADMIN_PREAUTH_EXPIRED` / `_REQUIRED` (le message anglais reste un
  repli : un libellé n'est pas un contrat).

### Écart documentaire

- **La cible de `ADMIN_LOGIN` est `SESSION`, sans identifiant**, là où le cahier écrit `USER · <id>` (SEC-2, 3, 4, 5).
  Le code fait foi. Conséquence pratique à connaître : filtrer `/audit` par **cible** ne retrouve pas les connexions
  d'un admin ; filtrer par **auteur** (`adminUserId`) les retrouve toutes. À corriger dans le cahier, ou à trancher
  (poser `targetId` = l'admin rendrait le filtre par cible utile).

### Regard d'expert — produit ET test, une ligne par fiche

- **SEC-1** — *Produit* : conforme et sobre. Un délai progressif sur les mots de passe faux répétés (aujourd'hui
  seul le limiteur du gateway freine) serait une défense de plus contre le bourrage d'identifiants — moyen. *Test* :
  vérifier aussi `SameSite` et `Secure` du cookie en production (ils ne peuvent pas l'être en `http` local) — petit.
- **SEC-2** — *Produit* : l'alerte de connexion ne dit pas **comment réagir** si ce n'est pas soi (lien vers « Mes
  sessions ») — petit. *Test* : le secret est lu à l'écran ; décoder aussi le QR (`otpauth://`) prouverait que QR et
  secret disent la même chose — petit.
- **SEC-3** — *Produit* : conforme. *Test* : la fiche démarre au début d'un pas de 30 s pour tenir connexion,
  déconnexion et rejeu dans le même pas — c'est la seule façon honnête de prouver l'anti-rejeu — rien à faire.
- **SEC-4** — *Produit* : aucun écran pour **régénérer** les codes de secours (le cahier le dit) : un admin à deux codes
  n'a que `grant-admin.ts --revoke` — un bouton « Régénérer mes codes » derrière un code TOTP est le vrai manque —
  moyen. *Test* : consomme six codes sur un compte jetable, jamais sur un compte de recette — rien à faire.
- **SEC-5** — *Produit* : ANO-ADM-01 réglée ; afficher l'heure de levée (« jusqu'à 14 h 32 ») plutôt que « 15 minutes »
  — petit ; une alerte email au titulaire lors d'un blocage (tentatives sur SON compte) — moyen. *Test* : la levée est
  vérifiée par une vraie attente, pas en effaçant la clé Redis — rien à faire.
- **SEC-6** — *Produit* : conforme. *Test* : cinq minutes d'attente réelle ; un contrôle du TTL du cookie (déjà fait
  en SEC-1) permettrait de réduire la fiche à une vérification de l'expiration côté serveur par jeton forgé — petit.
- **Transversal** — Le même défaut qu'aux chapitres web (ANO-WEB-104) : **un écran qui décide sans lire le code du
  serveur**. `describeError` traduit un statut HTTP ; il devrait d'abord lire `details.code`, partout dans admin-ui —
  moyen, à étendre avant le § 5.
