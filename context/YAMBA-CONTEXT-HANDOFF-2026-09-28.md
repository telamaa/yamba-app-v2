# Handoff — 28/09/2026 au soir · lot auth mobile LIVRÉ et validé, DEUX PR à merger (#381 puis #382)

*Point d'entrée de reprise — remplace le handoff du 21/09. Journée dense : le lot
bienvenue/recherche-first (#381) a été validé le matin et documenté (A207), puis le lot AUTH
mobile a été construit et itéré QUATRE fois sur captures utilisateur jusqu'à validation
visuelle le soir (A208 + A209). Tout est poussé, documenté, CI verte — il ne manque que les
merges.*

---

## 1. L'état, en une ligne

`dev` = `2d941a3` (#380). **PR #381 OUVERTE** (`feat/mobile-welcome`, 18/18 verte, A207 au
registre + docs) — **l'utilisateur a cliqué merge SANS effet mesuré** (§ 4). **PR #382
OUVERTE** (`feat/mobile-auth`, EMPILÉE sur #381), lot auth complet validé sur iPhone.
Tests plateforme INCHANGÉS (1576 + auth 406) : tout le chantier est dans `apps/mobile`
(+ docs). Le merge m'est refusé par le classifieur : c'est l'utilisateur qui merge.

## 2. Ce que contient #382 (l'ordre de lecture : A208 puis A209 au registre)

- **A208 (la mécanique, survit en entier)** : feuille modale `(auth)` à pile interne, MÊMES
  endpoints que le web, `ApiError.details` complet, `auth-flow-state` (le sessionStorage du
  natif), login CHAÎNÉ après l'OTP d'inscription, OTP à champ unique invisible (autofill,
  collage), trois compteurs sur échéance absolue, 3ᵉ miroir des règles de mot de passe,
  `rememberMe` réel branché.
- **A209 (les écrans finaux, réf. Revolut — captures `context/captures/auth{,/2,/3}`)** :
  atterrissage de marque (froid + anonyme, X à droite → Rechercher avec recherche large
  AUTO-lancée, motif Airbnb), connexion IDENTIFIER-FIRST (adresse → CONFIRMATION → méthode),
  pont HONNÊTE vers l'étape mot de passe tant que le serveur du « code par e-mail » n'existe
  pas (le point de bascule est UNE navigation commentée dans `login.tsx`), doctrine du bouton
  désactivé (RG-MOB-39), points en vague pendant l'envoi, échec plein écran réutilisable,
  logos officiels G/f en SVG, PAS de confirmation de mot de passe (divergence mobile assumée).
- **Docs COMPLÉTÉES** (ajout seul) : registre A207/A208/A209 ; DOC-TECHNIQUE (3 sections) ;
  DOC-MÉTIER (RG-MOB-25→40, fiches MOB39→66, notes de caducité) ; APPRENTISSAGE ch. 208-210.

## 3. Décisions produit du jour (à ne pas perdre)

1. **« Code par e-mail » : OUI, les deux méthodes, serveur PLUS TARD** — D-next à instruire
   APRÈS le lot Google natif ; l'UI identifier-first est déjà prête pour la bascule.
2. **Le mot de passe n'est pas vieillot** : la boîte mail est déjà la clé maîtresse (reset) —
   le choix est UX, pas sécurité. Passkeys = le vrai état de l'art, pour après.
3. **Inscription par téléphone** (capture Revolut) : attendra un lot serveur SMS.
4. Boutons sociaux : dessinés FONCTIONNELS (logos officiels), inertes en attendant leurs
   flux ; le jour du Google natif, **Apple exigera « Sign in with Apple »** (guideline 4.8).

## 4. ⚠️ Le merge de #381 qui n'a pas pris

L'utilisateur a dit avoir mergé #381 ; l'API GitHub la donnait toujours `OPEN`,
`mergedAt: null`, état `CLEAN`, 18/18 vertes (revérifié deux fois à 20 min d'écart). Le clic
n'a probablement pas abouti (réseau ? double confirmation ?). **À la reprise : re-merger
#381 D'ABORD** (en supprimant la branche, GitHub reciblera #382 sur `dev` tout seul), puis
merger #382, puis la PR d'état (`chore/etat-381-382` : CONTEXT + SUIVI, jalon 4 à réestimer —
l'app a splash, atterrissage, recherche-first, page trajet, ET toute l'auth).

## 5. Le poste

- Metro : côté utilisateur, port 8081 (`npx nx start @yamba-app/mobile` — JAMAIS un
  `expo start` nu : sans le `NODE_PATH=./node_modules` du target il plante sur
  `expo-router/_ctx-shared`).
- Les six services + Docker (Redpanda, Mailpit) : nécessaires pour tester l'auth (les OTP
  arrivent dans Mailpit, `localhost:8025`).
- `context/captures/auth{,/2,/3}` : les références design du lot, NON versionnées, à garder.
- Branche locale `chore/etat-381` créée puis abandonnée (le merge n'avait pas eu lieu) — à
  supprimer ou recycler en `chore/etat-381-382`.

## 6. Pièges payés aujourd'hui (ne pas repayer)

- `expo export` SANS `--platform` tente le rendu web et échoue APRÈS les bundles natifs →
  toujours `--platform ios --platform android`.
- Un CTA désactivé en couleur primaire délavée rend BOUEUX sur fond sombre → doctrine
  RG-MOB-39 (gris neutre, et seulement quand un champ unique l'explique).
- `.expo/types` (routes typées) : le Metro qui TOURNE les régénère à chaud — sans Metro,
  seul `expo start` le fait (A205).
- Le contrôle i18n refuse une clé VIDE — ne pas créer de clés « pour plus tard ».
- Purger les clés i18n au fil des itérations (cinq clés mortes retirées aujourd'hui) : la
  preuve bundle sait vérifier qu'un libellé a bien DISPARU des binaires.

## 7. Par où reprendre

1. Merger #381 puis #382 (§ 4), PR d'état, mettre à jour CONTEXT + SUIVI.
2. Prochain lot mobile à arbitrer : Google natif (A201 — avec Sign in with Apple), ou le
   wizard de réservation (la fiche trajet renvoie encore vers le site), ou le D-next « code
   par e-mail » côté serveur.
3. Android toujours non vu (D73 : Android publié d'abord !) — date Material, autofill
   `sms-otp`, repli emoji des symboles à valider au premier poste Android.
