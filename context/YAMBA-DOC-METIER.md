# YAMBA — DOCUMENTATION MÉTIER ET RÈGLES DE GESTION (cumulative)

> **Règle d'équipe (29/08/2026)** : ce document est **complété à chaque PR** — le besoin, les **règles de gestion numérotées** (RG-G gouvernance, RG-B Voyageur, RG-S recherche, RG-C réservation, puis RG-B2… par lot), la recette. Jamais de nouveau fichier. Les ~50 règles fondatrices restent dans `YAMBA-REGLES-METIER-V2.md`, les décisions dans le registre (D1–D36). La logique de prix est détaillée dans `YAMBA-MOTEUR-PRIX.md`.

## Sommaire

- [#78 — Nx / next-intl](#78-nx-next-intl)
- [#79 — context/ versionné + CLAUDE.md](#79-context-versionn-claude-md)
- [#80 — ThemeProvider au root layout](#80-themeprovider-au-root-layout)
- [#81 — Build de production réparé](#81-build-de-production-r-par)
- [#82 — PR-B : formulaire pricing Voyageur (PER_KG)](#82-pr-b-formulaire-pricing-voyageur-per-kg)
- [#83 — Recherche et page trajet au kilo](#83-recherche-et-page-trajet-au-kilo)
- [#85 — PR-C : wizard de réservation au kilo](#85-pr-c-wizard-de-r-servation-au-kilo)

---

## #78 — Nx / next-intl

### Besoin
L'application front (`user-ui`) ne pouvait plus être lancée ni testée via l'outillage du monorepo : blocage total de l'équipe sur le front, sans lien avec une fonctionnalité.

### Règle de gestion
Aucune — correctif d'infrastructure de développement. Aucun impact utilisateur, aucun impact sur les traductions FR/EN (la configuration i18n est la même, seule la façon de la localiser change).

### Recette
| # | Cas | Attendu |
|---|---|---|
| R1 | `npm run user-ui` depuis la racine | Le front démarre sur http://localhost:3000 |
| R2 | Ouvrir `/fr/...` puis `/en/...` | Les deux langues s'affichent comme avant |
| R3 | CI : les 13 checks | Tous verts, comptés |


---

## #79 — context/ versionné + CLAUDE.md

### Besoin
Le produit se construit sur des décisions numérotées (registre D1–Dn), des règles métier et des spécifications. Tant qu'elles n'étaient pas dans le dépôt, le code pouvait diverger sans que personne ne le voie (exemple réel : la décision D31 « gate Stripe à l'acceptation » avait été prise en session mais jamais écrite au registre).

### Règle de gestion (gouvernance)
- **RG-G-01** — Toute décision d'architecture ou de règle métier est **écrite au registre avant le code**, dans la PR qui l'implémente.
- **RG-G-02** — En cas de divergence : le code et ses tests font foi, puis le registre, puis les règles métier, puis les synthèses.
- **RG-G-03** — Chaque PR livre une fiche technique (lisible par un développeur junior) et une fiche métier (besoin + règles de gestion + recette).

### Recette
| # | Cas | Attendu |
|---|---|---|
| R1 | Ouvrir `context/` sur n'importe quelle branche après merge | Les 6 documents + `fiches-pr/` + le mockup sont présents |
| R2 | Ouvrir `context/mockup-pricing-yamba.html` dans un navigateur | La maquette interactive fonctionne (curseurs, calculs) |
| R3 | CI « secrets anti-leak » | Vert |


---

## #80 — ThemeProvider au root layout

### Besoin
Supprimer une erreur console permanente en développement (bascule de langue) et garantir que le thème clair/sombre ne « clignote » ni ne se perd au changement de langue.

### Règle de gestion
Aucune règle produit. Invariant technique : **les providers indépendants de la langue vivent au-dessus du segment `[locale]`**.

### Recette
| # | Cas | Attendu |
|---|---|---|
| R1 | `/fr/search` → EN → FR (dev) | Aucune erreur console « script tag » |
| R2 | Thème sombre actif, bascule de langue | Reste sombre, sans flash blanc |
| R3 | Préférence « système » | Suit l'OS après la bascule |


---

## #81 — Build de production réparé

### Besoin
L'application ne pouvait plus être construite pour la production (échec silencieux au pré-rendu de 4 pages). Sans build, pas de mise en ligne — bloquant absolu pour le lancement.

### Règle de gestion
Aucune règle produit. Invariant : **ce qui est mergé doit se construire** — la CI doit exécuter le build de production du front (proposition de check requis).

### Recette
| # | Cas | Attendu |
|---|---|---|
| R1 | `npx nx build user-ui` | Succès, « Generating static pages (57/57) » |
| R2 | `/fr/refresh`, `/fr/carrier/onboarding`, `/fr/carrier/onboarding/stripe/callback`, `/fr/trips/create?edit=<id>` en prod | Pages fonctionnelles, comportement identique au dev |


---

## #82 — PR-B : formulaire pricing Voyageur (PER_KG)

---

### 1. Le besoin

#### 1.1 Le problème d'avant

Le Voyageur devait fixer un prix **par catégorie** de colis (vêtements, téléphone, livres… 12 catégories). C'était :
- **long** (12 cases, ou un « prix par défaut » qui aplatissait tout) ;
- **incohérent** : un « téléphone » et un « livre » de même poids n'ont aucune raison de coûter différemment à transporter — ce qui diffère, c'est le **risque** (casse, douane, valeur), pas le coût ;
- **incomparable** entre trajets pour l'Expéditeur.

#### 1.2 La décision (registre D13 → D16, D19)

Le Voyageur vend des **kilos** : **un seul prix, en €/kg**, et **une capacité** en kg. La catégorie devient une **famille de risque** sur laquelle il prend position (accepter / surcharger / refuser). Le prix de l'Expéditeur = poids × €/kg (× coefficient de taille, × surcharge éventuelle) + service Yamba — ce calcul côté Expéditeur est l'objet de PR-C.

#### 1.3 Ce que PR-B livre

L'écran « Conditions » du parcours « Créer un trajet », côté Voyageur, en desktop et mobile, FR et EN :
1. Prix au kilo, avec une **aide à la décision** (« prix juste »).
2. Capacité en kg.
3. Position sur 8 familles de colis.
4. Forfaits optionnels pour bagage entier.
5. Projection du **gain net**.
Plus la mise à jour du résumé, de l'écran de vérification et de l'aperçu public.

---

### 2. Règles de gestion

Numérotation locale `RG-B-xx` ; renvoi vers les règles métier V2 / décisions quand elles existent.

#### Prix au kilo (D13, PRC-01)
- **RG-B-01** — Le Voyageur fixe **un seul** prix au kilo pour le trajet. Aucun prix par famille.
- **RG-B-02** — Le prix est **obligatoire** et strictement positif pour passer à l'étape suivante et pour publier.
- **RG-B-03** — Saisie guidée par curseur de 5 à 20 €/kg (pas de 0,50) ; la saisie libre au clavier reste possible (aucun plafond côté formulaire ; le serveur exige seulement > 0).
- **RG-B-04** — Le prix est **le net** du Voyageur : la commission Yamba est portée par l'Expéditeur (D16). Le libellé « ton prix = ton net » est affiché.

#### Suggestion et « prix juste » (D15, PRC-05 — version 1)
- **RG-B-05** — Une fourchette **basse / médiane / haute** est affichée. Médiane V1 = 11 €/kg de base, +5 % si vol direct, **−5 % si départ ≤ 3 jours (−2 % si ≤ 7 jours)** — côté offre, un départ imminent laisse moins de temps pour remplir. Basse = médiane −10 %, haute = médiane +15 %. Les facteurs appliqués sont **expliqués** au Voyageur (« Pourquoi ce prix ? »).
- **RG-B-05bis** — Le prix au kilo est **pré-rempli** à la médiane arrondie au 0,50 €, et la capacité à 12 kg ; le Voyageur ajuste librement. Un dépôt sans ajustement est un dépôt au « prix juste ».
- **RG-B-06** — Verdict : prix < basse → « Sous le marché — tu laisses de l'argent » ; prix > haute → « Au-dessus — moins de demandes probables » ; sinon « Prix juste ».
- **RG-B-07** — La suggestion est **indicative** : elle ne bloque jamais la saisie ni la publication.
- **RG-B-08** — Limite assumée V1 : pas encore de base par corridor ni de signal de demande (SavedRoutes) ; ces entrées arriveront sans changer l'écran.

#### Capacité (D19, CAP-01)
- **RG-B-09** — La capacité en kg est **obligatoire** et strictement positive (curseur 2 → 30 kg, saisie libre possible).
- **RG-B-10** — Elle sera **réservée** au fil des demandes (compteur serveur `reservedKg`, jamais saisi par le Voyageur) et **immuable après publication** — hors périmètre de cet écran, mais le texte d'aide l'annonce.
- **RG-B-11** — Information affichée : au pickup, un écart de poids ≤ 10 % est toléré ; au-delà, renégociation ou refus sans pénalité (paramètre serveur, valeur indicative).

#### Familles de colis (D14, CAT-02)
- **RG-B-12** — Liste **figée** de 8 familles : Documents & papiers · Vêtements & textile · Alimentaire sec & scellé · Électronique & appareils · Cosmétiques & soins · Pièces & outillage · Jouets & puériculture · Accessoires & divers.
- **RG-B-13** — Pour chaque famille : **Accepté** ou **Refusé** (interrupteur), et pour une famille acceptée un **supplément** optionnel en %. Par défaut : tout accepté, aucun supplément — la section est repliée avec le résumé « Toutes les familles acceptées ».
- **RG-B-14** — Une surcharge est un pourcentage **entier entre 1 et 100** (curseur 5 → 50 % par pas de 5 ; 20 % par défaut). Elle s'applique au prix de transport de l'Expéditeur pour cette famille (calcul en PR-C).
- **RG-B-15** — Une famille **refusée** n'est pas proposée à l'Expéditeur pour ce trajet ; une famille **avec supplément** lui est annoncée avec son % (transparence : refus ET suppléments visibles dans l'aperçu public).
- **RG-B-16** — La famille **ne porte jamais de prix** : elle qualifie le risque, pas le tarif.

#### Bagages entiers — forfait (PRC-04)
- **RG-B-17** — Deux offres optionnelles : **bagage soute 23 kg** et **bagage cabine 12 kg**, chacune à un **prix forfaitaire** hors logique €/kg.
- **RG-B-18** — Si un forfait est renseigné, il doit être strictement positif ; vide = non proposé.
- **RG-B-19** — Un bagage entier réservé **consomme sa franchise** de la capacité (23 kg ou 12 kg) — affiché sous chaque ligne ; la consommation effective est gérée à la réservation (hors PR-B).
- **RG-B-29** — **Un forfait bagage n'est proposable que si la capacité déclarée peut le contenir** (≥ 23 kg pour la soute, ≥ 12 kg pour la cabine). Si la capacité descend sous la franchise **après** la saisie du forfait, celui-ci est **suspendu** : ligne grisée avec l'explication, montant masqué mais mémorisé (il revient si la capacité remonte), **jamais envoyé** au serveur, non compté dans « N forfaits proposés ». Le serveur refuse de toute façon une offre incohérente (brouillon compris) — dernier rempart.
- **RG-B-30** — À côté d'un forfait, le Voyageur voit son **équivalent au kilo** (« ≈ 4,35 €/kg ») pour mesurer l'écart avec son prix au kilo.

#### Gain net (D16)
- **RG-B-20** — Dès que prix et capacité sont saisis, l'écran affiche « Si tes N kg sont réservés — Tu gagnes N × prix ». C'est une projection au remplissage complet, sans les forfaits bagages.
- **RG-B-21** — Mention affichée : versement à J+4 après livraison confirmée.

#### Coexistence avec l'ancien moteur (A28 — « bi-moteur tolérant »)
- **RG-B-22** — Les trajets déjà publiés avec un prix par catégorie **restent valides et visibles** ; rien n'est invalidé.
- **RG-B-23** — Le formulaire ne permet **plus** de saisir un prix par catégorie. Un ancien trajet rouvert en édition doit fixer un prix au kilo et une capacité pour être **re**publié.
- **RG-B-24** — À la publication, le serveur exige **un moteur complet** : soit (prix au kilo ET capacité), soit (≥ 1 prix par catégorie, ancien moteur). Si les deux sont présents, le moteur au kilo prime.
- **RG-B-25** — **Nouveau dans PR-B** : l'exigence historique « au moins une catégorie acceptée pour publier » ne s'applique **qu'à l'ancien moteur**. Un trajet au kilo publie sans catégorie (la famille la remplace).

#### Acceptation des demandes (D20)
- **RG-B-31** — En v1, **toute demande passe par l'accord du Voyageur** (réponse sous 24 h). L'option « Réservation instantanée » n'est plus proposée dans le formulaire ; le champ reste à `false` côté données.

#### Visibilité de l'offre (recherche et page trajet)
- **RG-B-32** — Un trajet au kilo s'affiche partout avec **son prix au kilo** (« 12,00 €/kg ») et ses **kilos disponibles** — jamais « 0 € » ni « à partir de ». L'Expéditeur comprend d'emblée qu'il paiera poids × prix.
- **RG-B-33** — Le **créateur** d'un trajet qui consulte sa propre page publique ne voit pas « Réserver » mais **« C'est votre trajet » + Modifier** (même écran d'édition que depuis le tableau de bord). Un Voyageur ne se réserve pas lui-même.

- **RG-B-34** — Sous un prix au kilo, l'Expéditeur voit un **exemple concret** : « ex. colis 2 kg ≈ 27 € » (transport `max(max(poids, 0,5) × €/kg, 8 €)` + service `max(12 %, 3 €)` — D13/D16/D32). Indicatif ; le prix réel est figé côté serveur à la réservation (D17, PR-C).
- **RG-B-35** — La recherche **ne propose plus** le filtre ni le badge « Réservation instantanée » (D20 v1).

#### Transverse
- **RG-B-26** — Toutes ces règles sont **appliquées par le serveur** ; le formulaire les reflète pour guider, il ne décide pas.
- **RG-B-27** — Montants stockés et transmis en **centimes entiers** ; l'écran affiche des euros au format français (« 11,50 €/kg »).
- **RG-B-28** — Un **brouillon** peut être sauvegardé incomplet (aucune de ces règles ne bloque le brouillon).

---

### 3. Parcours utilisateur (Voyageur)

1. Étape 1 « Trajet » inchangée (mode, villes, dates, type de vol…).
2. Étape 2 « Conditions » :
   - fixe son prix au kilo → la jauge et le badge réagissent instantanément ;
   - fixe sa capacité → la carte « Tu gagnes » apparaît ;
   - ajuste les familles (ex. Électronique +20 %, Alimentaire Non) ;
   - propose éventuellement un forfait bagage ;
   - lieux de remise / livraison, options, message : comme avant.
3. Étape 3 « Vérification » : carte « Prix & capacité » (prix, kg dispo, gain, familles surchargées/refusées, forfaits) + aperçu public tel que vu par l'Expéditeur.
4. Publier — sous réserve du gate profil/Stripe existant (voir §5).

---

### 4. Plan de recette

| # | Cas | Attendu |
|---|---|---|
| R1 | Arriver sur l'étape 2 | Prix pré-rempli à la médiane arrondie (ex. 11,50), capacité 12 kg, badge « Prix juste », carte « Si tes 12 kg partent · 138,00 € » ; familles / bagages / options repliés |
| R1b | Vider le prix et la capacité, « Continuer » | Erreurs « Fixez votre prix au kilo » et « Indiquez votre capacité en kg » ; pas d'avancement |
| R2 | Prix 8 €/kg, vol direct, départ dans 3 semaines | Badge « Sous le marché » ; ancre « médiane 11,55 €/kg (fourchette 10,40–13,28) » |
| R3 | Prix 11,50 | Badge « Prix juste » |
| R4 | Prix 15 | Badge « Au-dessus » |
| R5 | Même prix, vol avec escale | Médiane 11,00 (le +5 % direct disparaît) |
| R6 | Prix 11,50 + capacité 23 | Carte « Si tes 23 kg sont réservés — Tu gagnes 264,50 € » ; bandeau résumé « 11,50 €/kg · 23 kg · 264,50 € » |
| R7 | Familles → Ajuster → Électronique « + Ajouter un supplément » | Curseur à 20 %, badge « +20 % » ; ✕ le retire ; résumé de l'accordéon « Électronique & appareils : +20 % » |
| R8 | Alimentaire → interrupteur sur Refusé | Nom barré, icône grisée ; résumé « … Alimentaire sec & scellé : refusé » ; étape 3 et aperçu public : « Alimentaire · refusé » ET « Électronique · +20 % » |
| R9 | Forfait soute 0 € | Erreur « Le forfait doit être supérieur à 0 » ; vider le champ → plus d'erreur |
| R9b | Capacité 5 kg, ouvrir Bagage entier | Les deux lignes désactivées : « Monte ta capacité à 23 kg / 12 kg pour proposer ce forfait » ; capacité 23 → actives ; forfait 100 € → « ≈ 4,35 €/kg » |
| R9c | Capacité 20, forfait cabine 30 €, puis capacité 5 | Ligne cabine grisée « Monte ta capacité à 12 kg… », montant masqué, résumé « Aucun forfait proposé » ; étape 3 sans forfait ; remonter à 12 → le 30 € réapparaît. Côté API, un `POST /trips` incohérent est refusé (400) même en brouillon |
| R9d | ⓘ à côté de « Prix au kilo » / « Pourquoi ce prix ? » | Popover au tap ; Échap ou tap dehors le ferme ; liste « Base du corridor 11,00 · Vol direct +5 % · Départ imminent −5 % » |
| R10 | Publier un trajet au kilo sans aucune catégorie (Voyageur avec Stripe complet) | Publication acceptée |
| R11 | Rouvrir le trajet seed `bzv-perkg` en édition | Formulaire pré-rempli : 11,50 €/kg · 23 kg · Électronique +20 % · Alimentaire Non · soute 230 € |
| R12 | Rouvrir un ancien trajet « par catégorie » | Étape 3 montre encore ses catégories ; l'étape 2 exige prix + capacité pour continuer |
| R13 | Mobile 375 px | Tout tient en une colonne ; ligne famille : icône + nom tronqué + toggle ; curseur de supplément sous le nom ; popover ⓘ ne déborde pas ; barre de progression : 25 % par jalon (prix, capacité, remise, livraison) |
| R17 | Recherche, trajet au kilo | Carte : « prix au kilo · 12,00 €/kg · 12 kg dispo · ex. colis 2 kg ≈ 27 € » ; durée « 2 h » ; pas de popover par catégorie ; pas de badge ⚡ Instant ni de filtre « Réservation instantanée » ; tri « prix le plus bas » ne le liste pas (attendu, PR search) |
| R18 | Page détail du trajet au kilo, visiteur | Carte de réservation : « Prix au kilo · 12,00 €/kg · 12 kg encore disponibles · l'Expéditeur paie poids × prix » |
| R19 | Page détail, connecté en tant que créateur | Carte « C'est votre trajet » + « Modifier le trajet » → formulaire pré-rempli ; « Gérer dans mon tableau de bord » ; barre mobile idem ; pas de bouton Réserver |
| R16 | Options & message | « Réservation instantanée » absente ; texte « Chaque demande passe par ton accord — tu réponds sous 24 h » |
| R14 | Dark mode | Teal / mango / slate lisibles ; aucune couleur rouge/orange hors charte |
| R15 | Passer en EN | Tous les libellés du pricing traduits |

---

### 5. Limites connues et suites

- **Publication bloquée par le KYC** : un Voyageur sans onboarding Stripe complet ne peut pas publier (message « Carrier profile must be completed »). Décision **D31** : ce contrôle sera déplacé au moment de l'**acceptation** d'une demande (micro-PR dédiée). En attendant, la recette R10 exige un compte Voyageur Stripe complet.
- **Recherche** : le filtre par catégorie de la recherche ne voit pas les trajets au kilo (à traiter dans la PR recherche : filtre par famille).
- **Suggestion V1** : base unique tous corridors ; à alimenter par une table par corridor et le signal de demande (D15).
- **Colis légers (enveloppe, passeport, lunettes)** : décision **D32** gravée — poids facturable minimum 0,5 kg ET prix minimum 8 € par colis (le plus élevé s'applique), paramètres serveur §13. Implémenté en PR-C (calcul Expéditeur + snapshot deal-service), pas dans PR-B.
- **PR-C** (prochaine) : côté Expéditeur — poids déclaré, taille S/M/L « sans mesurer », famille filtrée par les positions du Voyageur, total en 2 lignes (transport + service & protection), ancre « vs ~85 € chez DHL », protection Garantie Yamba (D22).


---

## #83 — Recherche et page trajet au kilo

### 1. Le besoin
L'Expéditeur cherche un trajet pour un colis précis. Avec le moteur au kilo (D13/D14), la bonne question n'est plus « quelle catégorie est acceptée ? » mais **« que voulez-vous envoyer ? »** (une famille) et **« combien ça coûte pour un colis comme le mien ? »**. La recherche doit montrer tous les trajets compatibles — anciens et nouveaux — et les rendre **comparables**.

### 2. Règles de gestion

#### Comparabilité (D33)
- **RG-S-01** — Chaque trajet porte un **prix comparable** = coût de transport d'un colis de référence de **2 kg** : trajet au kilo → `max(2 × prix/kg, 8 €)` ; ancien trajet → son prix par catégorie le plus bas.
- **RG-S-02** — Le tri **« Prix le plus bas »** s'appuie sur ce prix comparable et mélange les deux types de trajets ; il est libellé « pour un colis de 2 kg ». Un trajet sans aucun prix n'y apparaît pas.

- **RG-S-02bis** — L'Expéditeur peut indiquer **le poids de son colis** (0,5 → 30 kg). Dès lors : chaque trajet affiche **son prix pour ce colis** (« ≈ 40 € tout compris pour 3 kg »), le tri par prix se fait **pour ce poids**, et les trajets au kilo qui n'ont pas assez de place sont exclus (capacité) ou signalés « Plus assez de place » (kilos restants). Le poids est mémorisé sur l'appareil et pré-remplira la réservation.

#### Familles (D14)
- **RG-S-03** — Le filtre **« Que voulez-vous envoyer ? »** propose les 8 familles. Cocher une famille **exclut** les trajets dont le Voyageur **refuse** cette famille. Plusieurs familles cochées = le trajet doit accepter toutes.
- **RG-S-04** — Un trajet sans position sur les familles (ancien moteur, ou Voyageur qui accepte tout) est compatible avec toutes les familles.
- **RG-S-05** — Si le Voyageur applique un **supplément** sur une famille cochée, la carte l'annonce (« Électronique : +20 % ») **avant** le clic — jamais de surprise sur la page trajet.
- **RG-S-06** — Chaque chip affiche le **nombre de trajets compatibles** ; une chip à 0 est désactivée. Les comptes ne dépendent pas des familles déjà cochées.
- **RG-S-07** — L'ancien filtre par catégorie n'est plus proposé. S'il arrive par une URL ancienne, il ne s'applique qu'aux anciens trajets et ne cache jamais un trajet au kilo.

#### Page trajet
- **RG-S-09** — La page d'un trajet au kilo affiche **l'offre complète** : prix au kilo, kilos disponibles, exemple de prix pour le colis de l'Expéditeur (poids mémorisé), les 8 familles avec leur statut, les forfaits bagage. Un visiteur ne réserve jamais sans avoir vu supplément ou refus.
- **RG-S-10** — Le propriétaire ne se voit pas proposer de discuter avec lui-même.
- **RG-S-11** — Le CO₂ évité est calculé **pour le poids du colis**, jamais présenté comme un chiffre par trajet.
- **RG-S-12** — La politique d'annulation affichée est **celle du registre (ANN-01)** : 100 % jusqu'à 48 h · partiel < 48 h · aucune après remise (litige). Toute autre formulation est une erreur.

- **RG-S-13** — Le **plancher par colis (D32 : 8 € minimum, 0,5 kg facturable minimum)** n'est pas seulement appliqué dans les calculs, il est **annoncé** partout où un prix au kilo est présenté : formulaire de création (« aucun envoi ne te rapporte moins de 8 € »), curseur de poids en recherche, bloc Offre et carte Réserver de la page trajet (« Colis léger (enveloppe, passeport, lunettes…) : 8 € minimum, quel que soit le poids »).

#### Lisibilité
- **RG-S-08** — Un filtre de confiance (Super tripper, Profil vérifié, Billet vérifié) dont le compte est 0 est **masqué**, pas grisé.

### 3. Recette

| # | Cas | Attendu |
|---|---|---|
| R1 | Tri « Prix le plus bas » avec un trajet 12 €/kg et un trajet legacy 15 € | Ordre : legacy 15 € (comparable 15 €) puis 12 €/kg (comparable 24 €) ; libellé « pour un colis de 2 kg » |
| R2 | Tri « Prix le plus bas », trajet 3 €/kg | Comparable = 8 € (plancher) — classé comme un colis à 8 € |
| R3 | Cocher « Alimentaire sec & scellé » | Le trajet seed `bzv-perkg` (alimentaire refusé) disparaît ; le compteur de la chip = trajets non refusants |
| R4 | Cocher « Électronique & appareils » | `bzv-perkg` reste, sa carte affiche « Électronique & appareils : +20 % » |
| R5 | Cocher deux familles dont une refusée par un trajet | Ce trajet disparaît |
| R6 | Décocher tout | Tous les trajets reviennent, « Tout effacer » disparaît |
| R7 | Chips à 0 | Désactivées, non cliquables |
| R8 | Aucun Super tripper dans la base | La ligne « Super tripper » n'est pas affichée |
| R9 | Ancienne URL `?categories=clothes` | Les trajets au kilo restent visibles |
| R11 | « Votre colis » : 3 kg | Cartes « ≈ 40 € tout compris pour 3 kg » (12 €/kg : 36 + 4,32) ; tri « pour votre colis de 3 kg » ; hint « Prix et tri calculés pour 3 kg… » |
| R12 | « Votre colis » : 25 kg | Trajets au kilo de capacité < 25 kg absents ; un trajet à 12 kg restants sur 30 de capacité affiche « Plus assez de place » |
| R13 | Poids 1 kg, un legacy 15 € et un 12 €/kg, tri prix | 12 €/kg (12 €) avant legacy (15 €) ; à 2 kg l'ordre s'inverse |
| R14 | Recharger la page | Le poids saisi est conservé ; « Tout effacer » le remet à la référence 2 kg |
| R15 | Page trajet au kilo, poids 3 kg mémorisé | Bloc « Ce que vous pouvez envoyer » : 12,00 €/kg · 12 kg · « Votre colis de 3 kg ≈ 40,32 € tout compris » ; chips familles ; forfaits |
| R16 | Page trajet, propriétaire | Pas de bouton « Discuter » ; carte « C'est votre trajet » |
| R17 | CO₂ | « 0,6 kg de CO₂ évités vs fret express · pour 2 kg » (ordre de grandeur crédible) |
| R18 | Conditions | Texte ANN-01 (100 % / partiel < 48 h / litige après remise) |
| R19 | Desktop 1440×900 | Lieux + conditions à droite sous la carte ; page sans scroll ou presque |
| R10 | Mobile (feuille « Filtres ») | Mêmes chips famille, mêmes comptes ; carte mobile : pill supplément en 9 px sous « kg dispo » |


---

## #85 — PR-C : wizard de réservation au kilo

### 1. Le besoin
L'Expéditeur a trouvé un trajet au kilo ; il doit pouvoir réserver **sans mesurer son colis**, en comprenant son prix **avant** de payer, et le prix qu'il voit doit être **exactement** celui que Yamba lui débitera à l'acceptation. Le wizard existant raisonnait encore en catégories et sur un trajet fictif.

### 2. Règles de gestion

#### Ce qu'on envoie
- **RG-C-01** — L'Expéditeur choisit un **produit** : un colis (au kilo) ou, si le Voyageur les propose, un **bagage entier** (soute 23 kg / cabine 12 kg) à prix forfaitaire (PRC-04).
- **RG-C-02** — Pour un colis, il indique sa **famille** (8, D14). Une famille **refusée** par le Voyageur est visible mais non sélectionnable, avec le motif ; une famille **surchargée** affiche son supplément avant tout choix (CAT-03).
- **RG-C-03** — Il déclare le **poids** (kg). Le poids saisi lors de la recherche est **pré-rempli**. Un colis > 30 kg ou > kilos restants est refusé dès l'étape 1 ; la réservation revérifie (CAP-01).
- **RG-C-04** — Il qualifie la **taille à l'œil** (PRC-03) : S « de l'enveloppe à la boîte à chaussures » (×1), M « tient dans un sac cabine » (×1,1), L « occupe une demi-valise » (×1,25). Jamais de dimensions.

#### Le prix (D34 — un seul moteur)
- **RG-C-05** — `transport = max(€/kg × max(poids, 0,5 kg) × coef taille × (1 + supplément), 8 €)` — plancher par colis D32 **affiché** quand il s'applique (« Minimum par colis appliqué : 8,00 € »).
- **RG-C-06** — `Service & protection = max(12 % du transport, 3 €) + prime de Garantie (6 € si Garantie 500)` — **deux lignes maximum** (COM-03), jamais de frais Stripe visibles (COM-01).
- **RG-C-07** — Le récap détaille le transport (« 3 kg × 12,00 €/kg × S · +20 % ») pour que le calcul soit vérifiable par l'Expéditeur.
- **RG-C-08** — Le **net du Voyageur = le transport** ; la commission et la prime sont côté Expéditeur (D16).
- **RG-C-09** — Le devis calculé côté Expéditeur est **le même code** que celui qui figera le snapshot à la réservation (D17) : aucune divergence possible entre l'écran et la base.

#### Protection (D22 / GAR)
- **RG-C-10** — Deux niveaux : « Protection de base » (incluse : non-livraison couverte, paiement bloqué jusqu'à la remise) et « **Garantie Yamba — jusqu'à 500 €** » (+6 €, perte/vol/casse, exclusions affichées avant validation). Le mot « assurance » n'apparaît **pas** tant que le contrat assureur n'est pas signé (GAR-02).

#### Accès et confort
- **RG-C-12** — **Réserver exige un compte** (CNF-05 : identité requise dès la 1re réservation). Un visiteur non connecté voit « Connecte-toi pour réserver » **dans une fenêtre au-dessus du trajet** (sans quitter la page), avec retour automatique **dans le formulaire de réservation** de ce trajet après connexion ou inscription. Un accès direct par URL au formulaire montre la même porte en pleine page. *(précisé le 03/09, A58)*
- **RG-C-13** — Le wizard ne montre **jamais « 0 € »** : sans poids, un indice (« Indique le poids… ») ; par défaut, le poids est celui de la recherche, sinon 2 kg (colis de référence). Le lieu de remise et de retrait sont pré-sélectionnés quand il n'y a qu'un choix évident.
- **RG-C-14** — Un Voyageur sans historique est présenté « Nouveau Tripper », jamais « 0.0 · 0 deals ».

- **RG-C-15** — Le **téléphone du destinataire** est saisi en premier (c'est le canal du code de livraison), avec un **indicatif pays** (défaut +33, 20 pays de lancement/diasporas) ; il est normalisé en **E.164** (zéro national retiré, `00` et indicatif retapé tolérés) avant validation et envoi.
- **RG-C-16** — Les deux « retours » ont des libellés distincts : « Retour au trajet » (quitter) et « Étape précédente » (revenir dans le wizard).

#### Trajets anciens
- **RG-C-11** — Un trajet sans prix au kilo (ancien moteur) reste réservable avec son prix par catégorie ; la commission suit D16.

### 3. Recette

| # | Cas | Attendu |
|---|---|---|
| R1 | Recherche poids 3 kg → trajet 12 €/kg → Réserver | Étape 1 : poids « 3 », famille acceptée pré-sélectionnée, taille S |
| R2 | Récap (sidebar desktop / feuille mobile) | « Transport · 3 kg × 12,00 €/kg × S 36,00 € » · « Service & protection 4,32 € » · Total 40,32 € |
| R3 | Taille L | Transport 45,00 € (× 1,25), service 5,40 €, total 50,40 € |
| R4 | Famille surchargée +20 % (ex. Électronique) | Ligne transport « … × S · +20 % », montant × 1,2 |
| R5 | Famille refusée | Chip grisée barrée, info-bulle « {Prénom} ne prend pas cette famille » ; non sélectionnable |
| R6 | Poids 0,2 | Transport 8,00 € + note « Minimum par colis appliqué », service 3,00 €, total 11,00 € |
| R7 | Poids 40 ou > kg restants | Erreur explicite sous le champ ; « Continuer » bloqué |
| R8 | Garantie 500 | Ligne « Garantie Yamba 500 € 6,00 € », service = commission + 6 € ; photos obligatoires |
| R9 | Produit « bagage soute 23 kg » (trajet qui le propose) | Poids/taille masqués, transport = forfait, commission 12 % |
| R10 | Trajet introuvable | Écran « introuvable » + retour recherche |
| R11 | Ancien trajet (catégories) | Sélecteur de catégorie, prix par colis, service 12 % min 3 € |
| R12 | Mots | Aucun « assurance » à l'écran ; « Garantie Yamba » partout |
| R13 | Visiteur non connecté ouvre /book | Écran « Connecte-toi pour réserver » ; après connexion, retour sur le wizard du même trajet |
| R14 | Arrivée sur l'étape 1 sans poids mémorisé | Poids « 2 », lieux pré-sélectionnés, récap 28,75 € / 3,45 € / 32,20 € (11,50 €/kg) — jamais 0 € |
| R15 | Vider le poids | Récap : « Indique le poids du colis pour voir le prix », lignes à 0 masquées de sens |
| R17 | Étape 2, téléphone « 06 42 18 81 12 » avec +33 | Accepté ; le stub d'envoi trace `+33642188112` ; « 12 » → erreur |
| R18 | Étape 2, indicatif +242 et « 06 421 88 12 » | `+242642188 12` normalisé `+24264218812` |
| R16 | Desktop | Colonne droite : récap + « Continuer » en haut, protection dessous ; règles d'or repliées ; 1 case photo puis une de plus à chaque ajout |


---


---

# B2-PR1 — La demande de transport naît avec l'argent bloqué

### 1. Le besoin
Quand l'Expéditeur clique « Payer », trois choses doivent être vraies en même temps : le prix est exactement celui qu'il a vu, la place sur le trajet est à lui, et l'argent est bloqué (pas débité). Si l'une manque, rien ne doit se passer — ni deal sans argent, ni argent sans deal.

### 2. Règles de gestion (RG-D = demande)
- **RG-D-01 — Autoriser, ne pas débiter.** À la demande, le montant total est **autorisé** (empreinte) ; le débit n'a lieu qu'à l'acceptation par le Voyageur (D31). Si le Voyageur refuse ou laisse expirer, l'empreinte est libérée : l'Expéditeur ne voit jamais de débit.
- **RG-D-02 — Le prix vu est le prix figé.** Le serveur recalcule le devis avec le même moteur que l'écran ; s'il diffère du total affiché, la demande est refusée (« Le prix a changé ») et un nouveau devis est présenté. Jamais de débit d'un montant non vu.
- **RG-D-03 — Une demande = un paiement.** Une autorisation ne peut servir qu'à une seule demande ; toute réutilisation est refusée.
- **RG-D-04 — L'autorisation doit correspondre à la demande** : même montant, même devise, même trajet, même Expéditeur. Sinon refus.
- **RG-D-05 — La place est prise à la demande (CAP-01).** Les kilos du colis (poids déclaré) ou la franchise du bagage sont réservés dès l'envoi, de façon atomique : deux Expéditeurs ne peuvent pas prendre le dernier kilo. Si la place a disparu entre le devis et l'envoi, la demande est refusée et l'empreinte libérée.
- **RG-D-06 — Le plancher 0,5 kg (D32) est un prix, pas une place** : un colis de 0,2 kg est facturé 0,5 kg mais ne réserve que 0,2 kg.
- **RG-D-07 — Un trajet n'accepte une demande que s'il est en ligne, non supprimé et pas encore parti.** On ne réserve jamais son propre trajet.
- **RG-D-08 — Famille refusée = demande refusée** ; famille « avec supplément » = le supplément du Voyageur entre dans le prix (CAT-03).
- **RG-D-09 — La demande expire 24 h après son envoi (DEA-01)** ; la date limite est figée à la création et transmise au Voyageur dans la notification.
- **RG-D-10 — Cinq photographies figées (D17)** : trajet (villes, pays, fuseaux, départ, mode), prix (tout le détail du devis : poids facturable, coefficient de taille, supplément, plancher, transport, commission, prime, total), colis (famille + description + valeur déclarée), destinataire (E.164), lieux de remise et de retrait choisis. Aucune n'est recalculée depuis le trajet ensuite.
- **RG-D-11 — La charte et les conditions sont acceptées explicitement** (`true` obligatoire) ; la demande sans charte est refusée.
- **RG-D-12 — Le Voyageur est prévenu par l'événement `booking.requested`** (avec la date limite) ; `booking.payment_authorized` déclenche le reçu Expéditeur. Les deux sont écrits dans la même transaction que le deal : pas de deal sans notification possible.
- **RG-D-13 — Un seul système de paiement à l'écran** (carte, Apple Pay, Google Pay dans le même composant Stripe). Aucune promesse de moyen non branché.
- **RG-D-14 — Hors production, sans prestataire configuré, le paiement est simulé** et l'écran le dit (« Mode test »). En production, l'application refuse de démarrer sans prestataire.

### 3. Messages à l'écran (codes → phrases)
| Code | Expéditeur voit |
|---|---|
| QUOTE_DIVERGENCE | « Le prix a changé depuis ton devis. Le nouveau total est affiché — vérifie-le avant de payer. » |
| CAPACITY_EXCEEDED | « Il ne reste plus assez de place sur ce trajet pour ton colis. » |
| FAMILY_REFUSED | « Le voyageur n'accepte pas ce type de colis sur ce trajet. » |
| TRIP_NOT_BOOKABLE / OWN_TRIP | « Ce trajet n'accepte plus de demandes. » / « Tu ne peux pas réserver ton propre trajet. » |
| PAYMENT_NOT_AUTHORIZED / MISMATCH / ALREADY_USED | paiement pas encore autorisé / ne correspond plus (nouvelle autorisation) / déjà utilisé |

### 4. Recette
| # | Scénario | Attendu |
|---|---|---|
| D1 | Colis 2 kg M à 12 €/kg, « Payer » | Autorisation 29,57 € ; deal PENDING ; « Demande envoyée ! Le voyageur a 24 h pour accepter » ; tracker ouvert |
| D2 | Modifier le poids après l'arrivée en étape 4 puis payer | Nouveau total affiché ; ancienne autorisation abandonnée ; pas de débit |
| D3 | Deux Expéditeurs sur le dernier kilo | Le second : « plus assez de place », aucune empreinte conservée |
| D4 | Carte refusée (4000 0000 0000 0002) | Message Stripe, pas de deal |
| D5 | Sans clés Stripe (dev) | Bandeau « Mode test », « Payer » crée le deal |
| D6 | Compte Voyageur sur son propre trajet | « Tu ne peux pas réserver ton propre trajet » |

---

# B2-PR2 — Accepter, refuser, annuler, expirer : l'argent suit la décision

### 1. Le besoin
Une demande PENDING doit pouvoir se dénouer dans les quatre directions prévues par le workflow : le Voyageur accepte (et l'argent est réellement débité), il refuse (et l'Expéditeur récupère tout), l'Expéditeur annule (récupération selon le moment), ou personne ne répond en 24 h (le système rend tout). Et si l'empreinte de paiement meurt toute seule chez le prestataire, le deal ne doit plus être acceptable.

### 2. Règles de gestion (RG-V = vie du deal)
- **RG-V-01 — L'argent est débité à l'acceptation, pas avant, pas après (D39).** Le « oui » du Voyageur (charte cochée) déclenche la capture immédiate. Techniquement, une empreinte carte expire en ~7 jours : attendre la veille du départ casserait les deals acceptés tôt.
- **RG-V-02 — Pas de KYC, pas d'acceptation (D31).** Le profil Voyageur complété + le compte Stripe configuré sont exigés au moment d'accepter — plus à la publication du trajet. Message : « 29,57 € t'attendent — finalise ton profil pour accepter ». Un trajet se publie donc librement ; l'argent, lui, ne va qu'à un Voyageur identifié.
- **RG-V-03 — La charte du Voyageur est un engagement explicite** (vérification du colis, interdits, ponctualité) : acceptation refusée sans elle.
- **RG-V-04 — Le refus a 5 raisons optionnelles** (catégorie non transportée / trop lourd / lieux incompatibles / timing / autre) — analytiques, jamais bloquantes. Refus = libération TOTALE de l'empreinte + place rendue au trajet (CAP-02).
- **RG-V-05 — Annulation Expéditeur (ANN-01, barème D39)** : demande PENDING → récupération intégrale (rien n'a été débité) ; deal ACCEPTED → remboursement 100 % jusqu'à 48 h avant le départ, **50 %** en deçà (la retenue revient au Voyageur qui a réservé sa capacité — versée avec l'infrastructure de paiement B4). Après la prise en charge du colis : plus d'annulation, seule voie le litige.
- **RG-V-06 — L'expiration 24 h est automatique et intégrale** : un système (cron, toutes les 5 minutes) passe les demandes périmées en EXPIRED, rend l'argent et la place. Avant même son passage, une demande périmée refuse déjà l'acceptation (le serveur fait foi, pas l'horloge du cron).
- **RG-V-07 — Deux décisions simultanées : une seule gagne.** Accepter et refuser en même temps (deux appareils, un cron) ne peut pas produire deux vérités : la base n'accepte qu'une transition depuis l'état attendu, et le prestataire de paiement tranche l'argent (on ne capture pas un paiement libéré, on ne libère pas un paiement capturé).
- **RG-V-08 — Le prestataire de paiement a raison (D40).** S'il nous apprend qu'une empreinte est morte (expirée, annulée), la demande PENDING correspondante est annulée par le système : personne ne doit pouvoir accepter un deal sans argent derrière. L'Expéditeur n'est pas débité (l'empreinte n'existait plus).
- **RG-V-09 — Chaque dénouement laisse une trace complète** : montant rendu (`refundAmountCents`), qui a fermé et quand, raison éventuelle — et les événements (`booking.accepted/declined/expired/cancelled/refund_issued`) partent dans la même transaction que le changement d'état : pas de décision sans notification possible.

### 3. Messages à l'écran (codes → phrases)
| Code | L'utilisateur voit |
|---|---|
| TRANSITION_NOT_ALLOWED | « Ce deal a changé entre-temps — actualise la page. » (ou la raison exacte : expiré, déjà accepté…) |
| CARRIER_ONBOARDING_REQUIRED | « Finalise ton profil (ou ta configuration Stripe) pour accepter ce deal. » |
| PAYMENT_STATE_CONFLICT | « Le paiement de l'expéditeur n'est plus valable » / « Le remboursement n'a pas pu partir, réessaie. » |

### 4. Recette
| # | Scénario | Attendu |
|---|---|---|
| V1 | Voyageur (profil + Stripe OK) accepte, charte cochée | Débit réel 29,57 € ; deal ACCEPTED ; Expéditeur notifié « Thomas a accepté » |
| V2 | Voyageur sans KYC accepte | Refus « finalise ton profil » ; rien débité ; le deal reste PENDING |
| V3 | Voyageur refuse (« trop lourd ») | Deal DECLINED ; empreinte libérée (aucun débit ne paraît) ; 2 kg rendus au trajet ; Expéditeur notifié |
| V4 | Expéditeur annule une demande PENDING | CANCELLED ; récupération intégrale ; Voyageur notifié |
| V5 | Expéditeur annule un deal ACCEPTED, départ dans 4 jours | Remboursement 100 % |
| V6 | Expéditeur annule un deal ACCEPTED, départ dans 12 h | Remboursement 50 % (ex. 29,57 € → 14,79 €), retenue tracée pour le Voyageur |
| V7 | Personne ne répond pendant 24 h | EXPIRED automatiquement ; récupération intégrale ; place rendue |
| V8 | Accept et decline au même instant | Un seul gagne ; l'autre voit « ce deal a changé entre-temps » ; l'argent suit le gagnant |
| V9 | L'empreinte expire chez Stripe (7 j) sans décision | Le deal PENDING passe CANCELLED (système) ; l'acceptation devient impossible |

---

# B2-PR3 — Décider à l'écran : le Voyageur répond, l'Expéditrice peut se rétracter

### 1. Le besoin
Le serveur savait accepter, refuser et annuler (B2-PR2) — mais personne ne pouvait le lui demander depuis l'application. Le Voyageur voyait un écran de démonstration (les boutons faisaient semblant), et l'Expéditrice n'avait aucun bouton d'annulation. Cette PR branche les vrais écrans, avec une exigence : **tout ce qui est promis à l'écran est tenu par le serveur, et rien de plus**.

### 2. Règles de gestion (RG-F, front des transitions)
- **RG-F-01 — L'écran ne propose que ce que le serveur permet.** Les boutons Accepter/Refuser (Voyageur) et Annuler (Expéditrice) n'apparaissent que si l'action figure dans `allowedActions`, calculé par la machine d'état serveur. Une demande expirée dont le cron n'est pas encore passé n'affiche plus rien.
- **RG-F-02 — Avant de confirmer une annulation, l'Expéditrice voit le montant exact qui lui revient** — calculé et SERVI par le serveur (A31) : 100 % tant que la demande n'est pas acceptée ou jusqu'à 48 h du départ, retenue de 50 % en deçà, retenue expliquée (« elle dédommage le Voyageur »). Le front n'invente jamais un montant.
- **RG-F-03 — Le refus se motive par une raison fermée, optionnelle** (catégorie non transportée / trop lourd / lieux incompatibles / délais / autre) — les mêmes cinq valeurs que le serveur enregistre. Le champ de texte libre du prototype a disparu : un champ que le serveur ne reçoit pas est un mensonge (A32).
- **RG-F-04 — Le Voyageur ne voit que SON gain** (net + « versé à J+4 »). Le prix payé par l'Expéditrice, la commission, les frais : jamais (A13). L'ancien « détail des gains » du prototype violait cette frontière.
- **RG-F-05 — Après une décision, l'écran relit le serveur** (jamais de « ça a dû marcher ») : si deux décisions se croisent, le perdant voit « ce deal a changé entre-temps » et la page se met à jour d'elle-même.
- **RG-F-06 — Un Voyageur au profil incomplet est emmené finir son onboarding** (gate D31) au moment où il tente d'accepter — pas avant, pas en silence.

### 3. Recette
| # | Scénario | Attendu |
|---|---|---|
| F1 | Voyageur ouvre une demande PENDING seedée, coche la charte, accepte | Toast succès ; l'écran passe en vue « accepté » (relu du serveur) |
| F2 | Voyageur refuse avec « trop lourd » | Toast « demande refusée » ; retour à l'accueil ; la demande rouverte affiche « Tu as refusé cette demande » |
| F3 | Voyageur sans onboarding Stripe accepte (provider STRIPE) | Toast explicite + redirection vers l'onboarding ; le deal reste PENDING |
| F4 | Expéditrice ouvre Mes envois : demande PENDING | Bouton « Annuler » discret sur la ligne ; modale : remboursement intégral affiché |
| F5 | Expéditrice annule un deal ACCEPTED à moins de 48 h du départ | Modale : montant à 50 % + retenue expliquée AVANT confirmation ; après : toast avec le montant réellement remboursé |
| F6 | Deux onglets : accept ici, decline là-bas | Un seul gagne ; l'autre voit « ce deal a changé entre-temps » et la page actualisée |
| F7 | Ligne Mes envois d'un colis PICKED_UP | AUCUN bouton Annuler (la machine ne le permet plus) |

### 4. Addendum 01/09 — RG-D complétées après le premier paiement réel (A34)
- **RG-D-15 — Ce que le formulaire accepte, le serveur l'accepte.** L'email du destinataire est **optionnel** (« pour notifications si renseigné », spec É1) et la description exige au moins 5 caractères — les MÊMES seuils à l'écran et dans le contrat. Avant ce correctif, un envoi avec email vide (autorisé à l'écran) échouait APRÈS l'autorisation de la carte, avec un message générique : la carte de l'Expéditrice restait « empreinte posée » sans demande créée (rien n'était débité — l'empreinte expire seule, mais l'expérience était cassée).
- **RG-D-16 — Un trajet publié avant l'arrivée du compteur de kilos reste réservable.** Les trajets créés avant B2-PR1 n'avaient pas le compteur `reservedKg` en base : la réservation les refusait à tort (« plus assez de place » sur un trajet vide). Corrigé par une reprise de données (27 trajets), à rejouer sur chaque environnement.
- Recette : F8 — réserver avec l'email destinataire VIDE → `201`, demande visible dans Mes envois ; F9 — réserver le trajet Paris → New York (créé avant B2-PR1) → plus de faux « plus assez de place ».

---

# B2-PR4 — Prévenir par email : la trace écrite des moments d'argent

### 1. Le besoin
Jusqu'ici, tout se passait DANS l'application : un Voyageur qui ne l'ouvrait pas ne découvrait une demande (et son compte à rebours de 24 h) qu'en se connectant ; une Expéditrice débitée ou remboursée n'avait aucune preuve écrite hors plateforme. Les moments où l'argent bouge exigent un email : c'est la trace que l'utilisateur garde, transfère à sa banque, retrouve dans 6 mois.

### 2. Règles de gestion (RG-N = notifications email)
- **RG-N-01 — Chaque moment d'argent laisse un email.** Autorisation posée → reçu à l'Expéditeur ; remboursement émis → confirmation avec le montant exact et les délais bancaires (5–10 j ouvrés, ou simple disparition de l'empreinte si rien n'a été débité).
- **RG-N-02 — Le Voyageur est prévenu d'une nouvelle demande avec sa date limite** (24 h) et **ses gains s'il accepte** — jamais le prix payé par l'Expéditeur (frontière des rôles, A13).
- **RG-N-03 — L'Expéditeur est prévenu de chaque dénouement** : accepté (paiement confirmé, prochaine étape), refusé (raison si donnée, « tu n'es pas débité·e »), expiré (« le Voyageur n'a pas répondu »), annulé.
- **RG-N-04 — Le Voyageur n'est prévenu d'une annulation QUE s'il avait accepté** (ses kilos sont restitués) ; une demande retirée avant sa réponse ne le dérange pas par email (l'in-app suffit).
- **RG-N-05 — Jamais d'email de tracking** (anti-spam : le suivi est dans l'app) ; jamais le code de livraison dans un email (règle plateforme, vérifiée par test).
- **RG-N-06 — Un email par personne et par événement, au maximum.** En cas d'incident technique, la plateforme préfère PERDRE un email (l'information reste dans l'app) plutôt que d'en envoyer deux — un doublon de reçu ou de remboursement sème le doute.
- **RG-N-07 — L'email est un canal best-effort** : sa panne ne bloque jamais le deal, la notification in-app, ni le flux des autres utilisateurs. Les échecs sont tracés et rejouables à la main.
- **RG-N-08 — Un utilisateur supprimé (RGPD) n'est jamais écrit** : l'envoi est sauté silencieusement.

### 3. Recette
| # | Scénario | Attendu |
|---|---|---|
| N1 | Expéditrice réserve (carte autorisée) | Voyageur : email « Nouvelle demande » avec gains + date limite ; Expéditrice : reçu « Paiement autorisé » avec montant |
| N2 | Voyageur accepte | Expéditrice : « Ta demande est acceptée », montant confirmé |
| N3 | Voyageur refuse (« délais ») | Expéditrice : « non acceptée » + raison + « tu n'es pas débité·e » ; PAS d'email au Voyageur |
| N4 | 24 h sans réponse | Expéditrice : « Ta demande a expiré » puis « Remboursement émis » |
| N5 | Expéditrice annule une demande PENDING | Elle : « annulée » ; Voyageur : RIEN (il n'avait pas accepté) |
| N6 | Expéditrice annule un deal ACCEPTED | Elle : « annulée » + « Remboursement émis » (montant du barème) ; Voyageur : « Deal annulé, tes kilos sont restitués » |
| N7 | Le même événement est re-livré (incident technique) | AUCUN second email |
| N8 | SMTP en panne au moment d'un envoi | Le deal et l'in-app vivent normalement ; l'échec est tracé |

---

# B2-PR5 — Suivre son envoi : la page de suivi dit toujours la vérité

### 1. Le besoin
L'Expéditrice avait une page de suivi… de démonstration : quelle que soit sa demande réelle, l'écran racontait un scénario inventé — et pour une demande refusée, il affichait « Ton Voyageur a accepté ». La page `/bookings/[id]` doit refléter l'état RÉEL du deal, à chaque instant, pour chaque statut.

### 2. Règles de gestion (RG-T = tracker Expéditeur)
- **RG-T-01 — Une seule adresse, l'état pilote l'écran.** L'URL du suivi ne change jamais ; c'est le statut réel du deal qui choisit la vue (attente, accepté, pris en charge, en voyage, livré, terminé, refusé, expiré, annulé, litige).
- **RG-T-02 — La page ne ment JAMAIS.** Aucun statut ne retombe sur un écran « par défaut » d'un autre statut : un état sans écran riche a un écran sobre qui dit l'essentiel (quoi, quand, et ce qu'il advient de l'argent).
- **RG-T-03 — Chaque état terminal rappelle le sort de l'argent** : refusé/expiré → « tu n'es pas débité·e » ; annulé → renvoi vers l'email de confirmation du remboursement ; terminé → « le paiement du Voyageur est libéré ».
- **RG-T-04 — On n'affiche jamais une donnée qu'on n'a pas.** Pas de fausse note « ⭐ 0.0 » pour un Voyageur (les statistiques arrivent avec la réputation), pas de fausse carte « Visa •••• », pas d'heure d'arrivée estimée inventée : la ligne disparaît, elle ne se remplit pas de vraisemblable.
- **RG-T-05 — Le code de livraison apparaît dès la prise en charge** (« disponible ») ; son ré-affichage chiffré arrive avec le chantier transport — d'ici là, la page n'invente pas de code.
- **RG-T-06 — L'annulation se fait depuis Mes envois** (avec l'aperçu du remboursement servi par le serveur) — le tracker y ramène, il ne duplique pas l'action.

### 3. Recette
| # | Scénario | Attendu |
|---|---|---|
| T1 | Ouvrir le suivi d'une demande PENDING réelle | Écran « En attente du Voyageur » : paiement autorisé, date d'expiration, CTA Mes envois |
| T2 | Le Voyageur accepte, on recharge la page | Écran É3 réel : bannière acceptée, montant réellement payé, Voyageur réel (SANS ligne de notation) |
| T3 | Suivi d'une demande refusée / expirée | Écran sobre « non acceptée » / « expirée » + « tu n'es pas débité·e » — JAMAIS l'écran accepté |
| T4 | Deal seedé PICKED_UP sans / avec événements de voyage | É4b (code « disponible ») / É6 (timeline réelle des confirmations) |
| T5 | Deal seedé DELIVERED | É8 : compte à rebours J+4 sur la vraie date de versement |
| T6 | Deal seedé COMPLETED | Écran « Envoi terminé, paiement libéré » |
| T7 | Ouvrir le suivi d'un deal d'un AUTRE utilisateur | Écran d'erreur neutre (introuvable) — on ne révèle pas l'existence |
| T8 | Bloc paiement, partout | Total réel en euros ; AUCUNE ligne carte tant que la donnée n'existe pas |

---

# B3-PR1 — Le transport : prendre en charge, suivre, remettre contre un code

### 1. Le besoin
Une fois la demande acceptée et l'argent bloqué, il faut que le colis voyage AVEC des preuves : le Voyageur inspecte et photographie à la remise, l'Expéditrice reçoit un code qu'elle transmet au destinataire, et la livraison n'est validée que quand ce code est présenté au Voyageur. Tout cela existait à l'écran sur des mocks ; le serveur ne savait rien faire après « accepté ». Cette PR rend le serveur seul juge de chaque étape.

### 2. Règles de gestion (RG-P = prise en charge & transport)
- **RG-P-01 — Pas de prise en charge sans inspection complète.** Les 5 points (contenu conforme, poids, rien d'interdit, emballage, articles identifiés) doivent TOUS être cochés et au moins une photo jointe (5 max). Un formulaire incomplet est refusé par le serveur, pas seulement grisé à l'écran (CNF-04).
- **RG-P-02 — La checklist et les photos sont figées avec la date serveur.** Elles constituent l'attestation d'inspection du Voyageur (RGP-03) et le dossier de preuve d'un éventuel litige.
- **RG-P-03 — Le code naît à la prise en charge, jamais avant.** 6 chiffres générés par le serveur ; l'Expéditrice le voit dans son suivi dès que le colis est pris en charge, et seulement tant qu'il voyage.
- **RG-P-04 — Le Voyageur ne voit jamais le code.** Ni dans son écran, ni dans une notification, ni dans un email : seul le destinataire le lui donne, en main propre. Un email peut dire « ton code est prêt », jamais le contenir.
- **RG-P-05 — Le code se régénère au plus 5 fois, par l'Expéditrice seule, tant que le colis voyage.** L'ancien code meurt immédiatement ; un email de sécurité prévient (« un nouveau code a été généré ») ; le compteur d'essais du Voyageur repart à zéro.
- **RG-P-06 — Trois essais, puis quinze minutes.** Un code faux compte un essai ; au troisième, la saisie est bloquée 15 minutes, puis trois nouveaux essais. Le compteur vit sur le serveur : fermer l'application ne le remet pas à zéro.
- **RG-P-07 — Le bon code, et lui seul, vaut livraison.** La remise validée démarre la fenêtre de vérification de l'Expéditrice : le versement du Voyageur est programmé à J+4.
- **RG-P-08 — Refuser à la remise est un droit sans pénalité.** Tout doute (contenu différent, suspect, surpoids, emballage, autre) permet au Voyageur de refuser : le deal est annulé, l'Expéditrice est remboursée intégralement, les kilos redeviennent disponibles, aucune trace réputationnelle (CNF-07).
- **RG-P-09 — Les jalons de voyage sont facultatifs et ordonnés.** Aéroport → décollage → atterrissage, confirmés dans l'ordre, une seule fois chacun ; ils rassurent l'Expéditrice (notification dans l'application, jamais d'email) et ne conditionnent aucune étape.
- **RG-P-10 — Un jalon confirmé ne se dé-confirme pas.** Les 5 secondes de « Annuler » sont un délai AVANT l'envoi ; passé ce délai, le jalon est acquis.
- **RG-P-11 — Le code est stocké de façon à ne pouvoir être ni deviné ni lu en base.** Haché pour la vérification, chiffré pour le ré-affichage, avec une clé qui ne vit pas dans la base.
- **RG-P-12 — Les photos sont téléversées par l'application, pas par le serveur métier.** Le serveur enregistre des adresses d'images (1 à 5), rien d'autre.

### 3. Recette
| # | Scénario | Attendu |
|---|---|---|
| P1 | Prise en charge avec 4 points cochés / 1 photo | Refus (400) — rien n'est écrit |
| P2 | Prise en charge 5/5 + 1 photo + notes par le Voyageur | Deal « pris en charge », checklist et photos figées, code créé |
| P3 | L'Expéditrice tente la prise en charge | Refus (403) |
| P4 | Suivi Expéditrice après P2 | Code à 6 chiffres affiché, 5 régénérations restantes |
| P5 | Écran Voyageur après P2 / liste Mes envois | Aucun code (ni chiffré, ni compteur) / code absent en liste |
| P6 | Jalon Aéroport, puis Aéroport à nouveau, puis Atterrissage | OK · refus « déjà confirmé » · refus « hors séquence » |
| P7 | Régénération par le Voyageur / par l'Expéditrice | 403 / nouveau code, 4 restantes, l'ancien code ne livre plus |
| P8 | Livraison : ancien code, puis 2 faux | « code incorrect, 2 essais » → 1 → « bloqué 15 min » |
| P9 | Bon code pendant le blocage | Refus (le blocage prime) |
| P10 | Régénération pendant le blocage, puis bon code | Blocage levé · livré, versement programmé à J+4 |
| P11 | Suivi Expéditrice après livraison | Statut livré, code masqué, régénération impossible |
| P12 | Refus à la remise (raison « surpoids ») sur un deal accepté | Deal annulé, remboursement intégral, kilos restitués, raison visible côté Expéditrice |
| P13 | Emails reçus par l'Expéditrice (pris en charge, refus, nouveau code, livré) | Présents, sans jamais le code |
| P14 | Deal de démonstration « pris en charge » (seed) | Code `742891` visible côté Expéditrice, livrable côté Voyageur |

---

# B3-PR2 — Le transport à l'écran : le Voyageur et l'Expéditrice agissent sur le réel

### 1. Le besoin
Les écrans de prise en charge, de suivi du voyage et de remise du colis existaient mais « jouaient » : un code accepté était toujours `742891`, les essais se comptaient dans le navigateur, l'annulation d'un jalon n'annulait rien. Chaque bouton doit maintenant produire l'effet réel décrit en B3-PR1, et l'écran ne doit afficher que ce que le serveur dit.

### 2. Règles de gestion (compléments RG-P, côté écran)
- **RG-P-13 — Les photos sont envoyées avant de confirmer.** Si une photo ne part pas, la prise en charge n'est pas tentée et le Voyageur le sait immédiatement ; rien n'est à moitié fait.
- **RG-P-14 — Le refus ne demande que la raison.** Pas de texte libre promis puis perdu : ce que l'écran propose est ce que le serveur enregistre.
- **RG-P-15 — Les 5 secondes d'« Annuler » précèdent l'envoi.** Un jalon annulé pendant ce délai n'a jamais existé pour l'Expéditrice ; passé ce délai, il est envoyé et acquis.
- **RG-P-16 — L'écran de saisie affiche les essais et le blocage tels que le serveur les connaît**, y compris à la réouverture de la page (fermer l'application ne redonne pas d'essai).
- **RG-P-17 — Le code affiché à l'Expéditrice est toujours celui du serveur** : après une régénération, la page relit avant d'afficher ; un code n'est jamais fabriqué côté écran.

### 3. Recette
| # | Scénario | Attendu |
|---|---|---|
| F1 | Prise en charge 5/5 + 2 photos (Voyageur seed, deal accepté) | Photos envoyées puis « prise en charge confirmée » ; la page Deal montre le suivi du voyage |
| F2 | Même chose avec une photo qui échoue (connexion coupée) | Message « téléversement échoué », rien n'est envoyé, formulaire intact |
| F3 | Refus avec raison « contenu suspect » | Toast de refus, retour à l'accueil ; côté Expéditrice : annulé + raison |
| F4 | Jalon « Je suis à l'aéroport » puis « Annuler » dans les 5 s | Rien n'est envoyé ; côté Expéditrice, aucune notification |
| F5 | Jalon confirmé sans annuler | Envoyé après 5 s ; timeline Expéditrice mise à jour |
| F6 | Saisie : 3 mauvais codes | « Tentative 1/3 … » puis « Saisie bloquée 15 min » avec compte à rebours ; recharger la page conserve le blocage |
| F7 | Expéditrice : « Régénérer » pendant le blocage, puis Voyageur saisit le nouveau code | Nouveau code affiché (relu du serveur) ; saisie débloquée ; livraison validée, écran de succès |
| F8 | Deal de démonstration « pris en charge » | Code `742891` visible côté Expéditrice, livrable côté Voyageur |

---

# B3-PR3 — Le Voyageur retrouve ses demandes là où il les cherche

### 1. Le besoin
Un Voyageur qui vient de recevoir une demande doit la voir sans chercher : depuis son accueil, depuis « Mes trajets », depuis la notification, depuis la page de son trajet. Jusqu'ici, seul le lien de l'email y menait.

### 2. Règles de gestion (RG-P, suite — visibilité côté Voyageur)
- **RG-P-18 — Une demande appartient à son trajet.** Elle s'affiche sous le trajet concerné dans « Mes trajets » et sur la page du trajet ; il n'existe pas d'onglet « demandes » séparé.
- **RG-P-19 — « À traiter » ne montre que ce qui attend une action du Voyageur**, dans l'ordre de l'urgence : répondre (avec le temps restant avant expiration), prendre en charge, remettre le colis après l'atterrissage. Ce qui n'attend rien (en transit, livré, terminé) n'y figure pas.
- **RG-P-20 — Les compteurs disent la vérité du serveur.** Badge de la sidebar, pastille mobile, « +N demandes » : tous dérivés des demandes réelles, jamais d'un compteur estimé.
- **RG-P-21 — Une notification mène toujours quelque part** : au deal pour le Voyageur, au suivi pour l'Expéditrice ; l'ouvrir la marque lue.
- **RG-P-22 — Le Voyageur ne voit jamais le total payé par l'Expéditrice** : ses lignes affichent son gain net seulement (règle existante, reconduite).

### 3. Recette
| # | Scénario | Attendu |
|---|---|---|
| V1 | Voyageur avec une demande en attente, ouvrir l'accueil du dashboard | Bande « À traiter » : « Répondre à {prénom} · expire dans … », lien vers le deal |
| V2 | « Mes trajets » | Sous-titre « 1 action à traiter · N trajets à venir » ; bande en tête ; sous le trajet, la demande avec badge « En attente » et gain net ; « +1 demande » sur la ligne du trajet |
| V3 | Même chose sur mobile | Pastille « 1 » sur l'onglet Activité ; badge et « 1 colis » sous le titre du trajet ; ligne de deal pleine largeur, cliquable |
| V4 | Replier / déplier « N colis » | La liste se replie sans quitter la page ; l'historique est replié par défaut |
| V5 | Accepter la demande, revenir à « Mes trajets » | La bande passe à « Prise en charge », le badge de demandes disparaît, la sidebar se met à jour |
| V6 | Après la prise en charge, jalon « atterri » | La bande propose « Valider la livraison » |
| V7 | Page du trajet (`/dashboard/trips/[id]`) | Section « Demandes et colis » en tête avec les mêmes lignes |
| V8 | Notifications : cliquer « Nouvelle demande » | Ouvre le deal, la notification passe lue ; côté Expéditrice, « Demande acceptée » ouvre le suivi |
| V9 | Compte Expéditeur seul (pas Voyageur) | Aucun appel aux deals reçus, aucune pastille |

---

# B3-PR4 — La demande vue par le Voyageur dit vrai, sur tous les écrans

### 1. Le besoin
Le Voyageur décide d'accepter un colis sur trois choses : qui l'envoie, ce qu'il y a dedans, ce qu'il gagne. La page lui cachait les photos du colis (jamais envoyées), les boutons sur tablette, et employait un mot juridiquement faux.

### 2. Règles de gestion (RG-P, suite)
- **RG-P-23 — Les photos déclarées à la réservation sont visibles du Voyageur dès la demande.** Elles sont envoyées avant le paiement : si l'envoi échoue, la réservation n'est pas tentée et la carte n'est pas débitée.
- **RG-P-24 — Accepter et Refuser sont toujours accessibles**, quelle que soit la largeur d'écran, tant que la demande est ouverte.
- **RG-P-25 — Le mot « assurance » n'apparaît nulle part avant la signature avec un assureur** (GAR-02) : on dit « Garantie Yamba » et « Protection étendue ».
- **RG-P-26 — Le téléphone du destinataire est annoncé pour la prise en charge**, pas pour l'acceptation (RGP-02).
- **RG-P-27 — « Voir profil » mène au profil public de l'Expéditrice**, ou n'est pas proposé.

### 3. Recette
| # | Scénario | Attendu |
|---|---|---|
| D1 | Réserver avec 2 photos (contenu, emballé), carte test | Demande créée ; côté Voyageur, bloc « Photos du colis » avec les 2 images |
| D2 | Réserver avec une photo, connexion coupée pendant l'envoi | Message « téléversement échoué, carte non débitée » ; rien n'est créé |
| D3 | Ouvrir la demande à 900 px de large | Colonne droite : gains, couverture, Accepter/Refuser |
| D4 | Ouvrir la demande sur mobile | Une colonne, gains en tête, barre Accepter/Refuser en bas |
| D5 | Lire la carte couverture | « Garantie Yamba incluse » ou « Protection étendue 500 € incluse » — jamais « assurance » |
| D6 | Bloc livraison | « Téléphone du destinataire communiqué à la prise en charge » |
| D7 | « Voir profil » | Ouvre `/u/[slug]` de l'Expéditrice ; absent si elle n'a pas de profil public |

# Fix recette auth (#116, 03/09) — l'inscription explique, l'OTP pardonne

### 1. Le besoin
Une personne qui s'inscrit doit savoir QUOI corriger (« le mot de passe contient ton prénom », pas « ne respecte pas tous les critères »), dans SA langue. Une personne qui se trompe en tapant un code à 6 chiffres ne doit pas être bloquée 24 heures. Et l'email ne doit pas contredire l'écran (5 minutes contre 10).

### 2. Règles de gestion (RG-A, authentification)
- **RG-A-01 — Échecs de code OTP par paliers de 5.** Quatre erreurs annoncent le nombre d'essais restants. La 5e invalide le code et bloque la saisie 1 minute : il faut redemander un code. La 10e invalide, bloque 30 minutes et déclenche l'email « activité suspecte ». La 15e, et chacune après, bloque 24 heures. Le compteur vit 24 heures et un renvoi de code ne le remet pas à zéro.
- **RG-A-02 — Une règle de mot de passe = un code = une phrase.** Longueur ≥ 8, une minuscule, une majuscule, un chiffre, un caractère spécial, pas une date, pas de suite ni de répétition, pas le prénom / nom / e-mail (accents ignorés, fragments ≥ 3 caractères). Le message nomme LA règle violée, dans la langue de l'interface, sur le champ concerné. Même principe pour « un compte existe déjà avec cet e-mail ».
- **RG-A-03 — La fenêtre d'inscription couvre toujours le code en cours.** L'inscription en attente vit 30 minutes et chaque renvoi de code la prolonge de 30 minutes.
- **RG-A-04 — L'email et l'écran annoncent la même durée de validité** (10 minutes aujourd'hui, valeur unique côté serveur).
- **RG-A-05 — Le sujet d'un email est dans la langue de son corps** (français aujourd'hui ; langue de l'utilisateur avec D44).

### 3. Recette
| # | Scénario | Attendu |
|---|---|---|
| A1 | Inscription avec le prénom dans le mot de passe | Sous le champ : « Le mot de passe ne doit pas contenir le prénom, le nom ni l'adresse e-mail. » |
| A2 | Inscription avec `Ab1!` | « Le mot de passe doit contenir au moins 8 caractères. » |
| A3 | Inscription avec un e-mail déjà utilisé | Sous le champ e-mail : « Un compte existe déjà avec cet e-mail… » — en français sur l'interface FR |
| A4 | OTP : 4 mauvais codes | « Code incorrect. » + « 4 / 3 / 2 / 1 essai(s) restant(s) avant invalidation du code », jamais de texte anglais |
| A5 | OTP : 5e mauvais code | Message « ce code n'est plus valable », compte à rebours 1 min ; le bon code saisi après le délai est refusé (il faut « Renvoyer le code ») |
| A6 | Renvoyer le code à la 12e minute, saisir le bon code à la 17e | Inscription validée (fenêtre prolongée) |
| A7 | Ouvrir l'email « Ton code d'activation Yamba » | « Ce code expire dans 10 minutes », écran « Code valable 10:00 » au départ |
| A8 | Login et inscription, 5 chargements | Jamais de texte alternatif à la place du visuel ; œil centré dans le champ mot de passe |

# feat/email-locale — chaque email dans la langue de celui qui le lit, et avec les vrais prénoms

### 1. Le besoin
Une personne qui utilise Yamba en anglais reçoit des emails en anglais, sujet compris, même quand c'est un utilisateur francophone qui a déclenché l'envoi. Et un email parle de « Thomas », pas du « Voyageur », parce que c'est ainsi que l'application le nomme partout.

### 2. Règles de gestion (RG-A, suite)
- **RG-A-06 — La langue d'un email est celle de son destinataire.** Avec un compte : la langue préférée du compte. Sans compte (code d'inscription, mot de passe oublié, alerte de sécurité) : la langue de l'écran d'où vient la demande. Le sujet et le corps sont toujours dans la même langue.
- **RG-A-07 — La langue préférée suit la bascule de langue.** Un utilisateur connecté qui passe l'interface en anglais recevra ses prochains emails en anglais, sans passer par un écran de profil. À l'inscription, la langue de l'écran devient la langue du compte.
- **RG-A-08 — Les personnes sont nommées par leur prénom dans les emails.** Le mot de rôle (« ton Voyageur », « un Expéditeur ») n'apparaît que si le prénom est inconnu (compte supprimé).
- Rappel D44 : ajouter une langue à Yamba = l'ajouter à la liste unique et fournir son dictionnaire d'emails ; la plateforme n'est pas conçue pour deux langues mais pour N.

### 3. Recette
| # | Scénario | Attendu |
|---|---|---|
| L1 | Interface en EN, s'inscrire | Email « Your Yamba activation code », corps en anglais, « expires in 10 minutes » |
| L2 | Compte créé depuis l'interface EN, puis connexion | `GET /auth/me` renvoie `preferredLocale: "en"` ; email de bienvenue en anglais |
| L3 | Connecté, basculer FR → EN dans le header, puis se faire accepter une demande | Email « Your request … was accepted » en anglais |
| L4 | Voyageur EN accepte la demande d'une Expéditrice FR | Elle reçoit « Ta demande … est acceptée » en français ; lui, ses notifications en anglais |
| L5 | Email d'acceptation reçu par l'Expéditrice | « Bonne nouvelle : Thomas a accepté ta demande … » — jamais « le Voyageur » |
| L6 | Compte du Voyageur supprimé avant l'envoi | « ton Voyageur a accepté » — jamais « null » |
| L7 | `PATCH /auth/me/locale` avec `de` | 400, code `LOCALE_UNSUPPORTED`, langue inchangée |
| L8 | Interface FR, mot de passe oublié | Sujet « Ton code de réinitialisation Yamba », sans emoji, expéditeur « Yamba <adresse SMTP> » |

# feat/booking-auth-modal — réserver sans perdre le trajet, revenir là où on était

### 1. Le besoin
Au moment où un visiteur clique « Réserver », il est décidé : lui demander de se connecter ne doit pas lui faire perdre le trajet, le prix et l'élan. Et quiconque clique « Connexion » dans le header doit revenir sur la page qu'il lisait.

### 2. Règles de gestion
- **RG-C-12** (précisée ci-dessus) : la porte de réservation est une fenêtre au-dessus du trajet ; retour dans le formulaire de réservation après connexion.
- **RG-C-17 — « Connexion » et « Créer un compte » ramènent sur la page en cours.** Exceptions : depuis une page d'authentification (pas de boucle) et depuis l'accueil (retour par défaut). Seuls des chemins internes sont acceptés (anti open redirect, #114).
- **RG-C-18 — La fenêtre se referme sans conséquence** (« Plus tard », touche Échap, fond) : le visiteur reste sur le trajet, rien n'est réservé, rien n'est mémorisé.

### 3. Recette
| # | Scénario | Attendu |
|---|---|---|
| G1 | Non connecté, page trajet desktop, « Réserver » | Fenêtre centrée « Connecte-toi pour réserver », le trajet reste visible derrière, focus sur « Se connecter » |
| G2 | Idem sur mobile | Feuille du bas avec poignée, mêmes boutons, « Plus tard » referme |
| G3 | « Se connecter » puis connexion | Atterrissage direct dans le formulaire de réservation du trajet |
| G4 | « Créer un compte » → OTP → connexion | Même atterrissage (retour conservé, #114) |
| G5 | Échap ou tap sur le fond | Fenêtre fermée, page inchangée |
| G6 | URL `/trips/:id/book` tapée à la main, non connecté | Porte pleine page (inchangée) |
| G7 | Non connecté sur `/search?…`, « Connexion » dans le header | Retour sur la même recherche après connexion |
| G8 | Sur `/login`, lien « Inscrivez-vous » ; sur `/`, « Connexion » | Aucun `redirect` ajouté ; retour à l'accueil après connexion |

# feat/trip-favorites — mettre un trajet de côté

### 1. Le besoin
Un Expéditeur compare plusieurs trajets avant de réserver. Il doit pouvoir en mettre de côté d'un geste, depuis la recherche ou la fiche, et les retrouver dans son espace — sans que le Voyageur en soit informé.

### 2. Règles de gestion (RG-FAV)
- **RG-FAV-01 — Un favori est privé.** Le Voyageur n'est pas notifié, aucun compteur public n'existe.
- **RG-FAV-02 — Seul un trajet publié peut être ajouté.** Un trajet en brouillon, en pause, terminé, annulé ou archivé ne peut pas être mis en favori (le retrait, lui, est toujours possible).
- **RG-FAV-03 — On ne met pas son propre trajet en favori.** Le cœur n'apparaît pas sur sa propre fiche ; le serveur refuse dans tous les cas.
- **RG-FAV-04 — Un favori survit à la fin du trajet.** « Mes favoris » continue de le montrer, avec ses informations, tant que l'utilisateur ne le retire pas.
- **RG-FAV-05 — Il faut un compte.** Un visiteur qui touche le cœur est invité à se connecter et revient sur la page où il était.
- **RG-FAV-06 — Le geste est immédiat et réversible.** Le cœur change à l'instant du clic ; si le serveur refuse, il revient à son état et la raison est affichée.

### 3. Recette
| # | Scénario | Attendu |
|---|---|---|
| H1 | Connecté, recherche, cœur d'une carte | Cœur plein immédiatement, la carte ne s'ouvre pas ; rechargement : toujours plein |
| H2 | Même trajet, sa fiche | Pilule « Retirer des favoris » ; clic → cœur vide, disparaît de « Mes favoris » |
| H3 | « Mes favoris » (sidebar, onglet Activité mobile, menu utilisateur) | Liste du plus récent au plus ancien, même carte que la recherche, cœur plein |
| H4 | Aucun favori | État vide avec « Chercher un trajet » |
| H5 | Visiteur, cœur sur une carte | Toast « Connecte-toi… », page de connexion, retour sur la recherche après connexion |
| H6 | Sa propre fiche de trajet | Aucun cœur |
| H7 | `POST /trips/:id/favorite` sur un trajet en pause | 409 `TRIP_NOT_FAVORITABLE`, cœur revenu à vide, toast « n'est plus disponible » |
| H8 | Trajet en favori qui passe COMPLETED | Toujours listé dans « Mes favoris » ; retrait possible |
| H9 | Voyageur du trajet | Aucune notification, aucun email, aucun compteur visible |

# feat/auth-pages-ux — Yamba te tutoie, ne ment pas sur ses chiffres, et te demande ton identité au bon moment

### 1. Le besoin
Une seule voix (tutoiement, D45) sur tout le parcours d'entrée ; un panneau d'accueil qui dit ce que le produit garantit vraiment ; et « Partager un trajet » qui, comme « Réserver », demande l'identité sans faire perdre la page.

### 2. Règles de gestion
- **RG-C-19 — Toute action réservée aux membres ouvre la même porte d'identité, avec les mots de l'action.** « Connecte-toi pour réserver », « Connecte-toi pour partager un trajet » : même fenêtre, même retour à l'intention de départ, jamais une redirection sèche.
- Rappel D45 : tutoiement sur l'interface, les emails et les erreurs ; aucun chiffre ni témoignage inventé ; les textes juridiques restent au vouvoiement.

### 3. Recette
| # | Scénario | Attendu |
|---|---|---|
| I1 | Visiteur, « Partager un trajet » (desktop, mobile, icône +) | Fenêtre « Connecte-toi pour partager un trajet », page inchangée derrière |
| I2 | « Se connecter » puis connexion | Atterrissage sur le formulaire de création de trajet |
| I3 | « Plus tard » / Échap | Fenêtre fermée, page inchangée |
| I4 | Connecté, « Partager un trajet » | Formulaire de création directement |
| I5 | Pages login / inscription / OTP / mot de passe | Aucun « vous », « votre », « veuillez » ; boutons et erreurs au tutoiement |
| I6 | Panneau gauche (desktop) | Trois promesses (compte vérifié, débité à l'acceptation, Garantie Yamba) ; plus de « 12k+ », « 4.8 », ni de témoignage |
| I7 | iPhone, focus sur un champ de connexion | Pas de zoom automatique |
| I8 | Réserver, visiteur | Fenêtre inchangée par rapport à #118 (mêmes boutons, retour wizard) |
| I9 | Visiteur, cœur sur une carte de recherche ou sur la fiche | Fenêtre « Connecte-toi pour enregistrer un favori », la carte ne s'ouvre pas ; retour sur la même page après connexion |

# feat/auth-google — entrer avec son compte Google, sans renoncer au consentement

### 1. Le besoin
Se connecter ou s'inscrire en un clic avec Google, sans mot de passe ni code par email, tout en gardant les règles de Yamba : une identité vérifiée, un consentement enregistré, un seul compte par personne.

### 2. Règles de gestion (RG-A, suite)
- **RG-A-09 — Google atteste l'identité, Yamba vérifie l'attestation.** Le serveur refuse tout jeton qu'il ne peut pas vérifier et toute adresse Google non vérifiée.
- **RG-A-10 — Un compte existant avec la même adresse vérifiée est relié, jamais dupliqué.** La personne se connecte à son compte habituel ; elle pourra ensuite entrer par Google ou par mot de passe.
- **RG-A-11 — Aucun compte n'est créé sans accord explicite** aux CGU et à la politique de confidentialité ; l'accord est journalisé comme pour l'inscription classique.
- **RG-A-12 — Tant que Google n'est pas configuré, le bouton est visible mais inactif** (« bientôt disponible ») ; rien ne casse.

### 3. Recette (après configuration de l'ID client Google)
| # | Scénario | Attendu |
|---|---|---|
| J1 | Sans client ID | Bouton « Connexion Google bientôt disponible », inactif |
| J2 | Nouveau, « Continuer avec Google » | Fenêtre Google, puis « Finalise ton compte » avec l'adresse confirmée ; sans cocher → « Tu dois accepter… » ; coché → compte créé, connecté, email de bienvenue, retour sur la page visée |
| J3 | Re-connexion Google | Connexion directe, « Content de te revoir, … » |
| J4 | Compte créé par e-mail, puis Google avec la même adresse | Connexion au compte existant, toast « relié à Google » ; les deux chemins fonctionnent ensuite |
| J5 | Adresse Google non vérifiée | Message « adresse non vérifiée », rien créé |
| J6 | Interface en anglais, création par Google | `preferredLocale: "en"`, email de bienvenue en anglais |
| J7 | « Mot de passe oublié » sur un compte Google seul | Code envoyé, mot de passe créé, les deux chemins fonctionnent |
| J8 | Annuler l'écran de consentement | Rien créé, page inchangée |

# fix/session-remember-default — une session qui se termine, sauf si tu le demandes

### Règles de gestion
- **RG-A-13 — Sans action de ta part, la session se ferme après 60 minutes sans activité** (et au plus tard 7 jours après la connexion).
- **RG-A-14 — « Rester connecté sur cet appareil » est un choix explicite**, décoché par défaut : coché, la session tient 7 jours sans activité (30 jours au plus). La case explique ces durées.

### Recette
| # | Scénario | Attendu |
|---|---|---|
| K1 | Connexion sans cocher, 61 minutes sans rien faire, action | Déconnecté, retour à la connexion |
| K2 | Connexion sans cocher, fermer le navigateur, rouvrir | Déconnecté |
| K3 | Connexion en cochant, revenir le lendemain | Toujours connecté |
| K4 | Formulaire de connexion | Case décochée par défaut, aide « Coché : 7 jours sans activité. Sinon : déconnexion après 60 minutes sans activité. » |

# feat/auth-gate-inline-login — se connecter sans quitter la page

### Règle de gestion
- **RG-C-20 — La fenêtre d'identité permet de se connecter sur place** (e-mail et mot de passe, Google) et reprend le geste engagé : le favori est enregistré, la réservation s'ouvre, la création de trajet s'ouvre. Créer un compte reste une page, avec retour.

### Recette
| # | Scénario | Attendu |
|---|---|---|
| M1 | Visiteur, cœur d'une carte, connexion par e-mail dans la fenêtre | Fenêtre fermée, cœur plein, toujours sur la recherche |
| M2 | Idem par Google | Même résultat, toast de bienvenue |
| M3 | Visiteur, « Réserver », connexion dans la fenêtre | Arrivée dans le formulaire de réservation |
| M4 | Visiteur, « Partager un trajet », connexion dans la fenêtre | Arrivée sur la création de trajet |
| M5 | Mauvais mot de passe dans la fenêtre | Erreur sous le champ, fenêtre ouverte |
| M6 | « Inscris-toi » dans la fenêtre | Page d'inscription, retour sur la page d'origine après OTP et connexion |

# feat/follow-auth-gate — suivre un Voyageur sans quitter son profil

### Le besoin
Sur le profil public d'un Voyageur (`/u/:slug`), le bouton « Suivre » envoyait le visiteur non connecté vers la page de connexion, puis le ramenait sur le profil : rupture de contexte, alors que réserver et mettre en favori passent déjà par la fenêtre d'identité. Recette 03/09 : même comportement demandé sur « Suivre ».

### Règle de gestion
- **RG-C-21 — « Suivre » ouvre la fenêtre d'identité pour un visiteur** (« Connecte-toi pour suivre {prénom} », formulaire de connexion sur place, Google inclus). Après connexion, le suivi est appliqué immédiatement avec l'alerte « prochain trajet » activée, et le visiteur reste sur le profil. Le serveur reste seul juge : pas de session → 401, se suivre soi-même → refusé.

### Recette
| # | Scénario | Attendu |
|---|---|---|
| S1 | Visiteur, `/u/seed-ines`, clic « Suivre » | Fenêtre « Connecte-toi pour suivre Inès » par-dessus le profil, aucune navigation |
| S2 | Connexion par e-mail dans la fenêtre | Fenêtre fermée, bouton « Suivi », toggle « M'alerter de son prochain trajet » coché, compteur d'abonnés + 1, toujours sur le profil |
| S3 | « Plus tard » ou Échap | Fenêtre fermée, bouton « Suivre » inchangé, profil intact |
| S4 | « Inscris-toi » dans la fenêtre, inscription, OTP, connexion | Retour sur `/u/seed-ines` |
| S5 | Connexion dans la fenêtre avec le compte du profil lui-même | Le bouton « Suivre » laisse place à « Modifier mon profil », aucun suivi créé |

# B4-PR1 — l'argent sortant : confirmer, verser, signaler

### Le besoin
Après la remise contre code, l'argent de l'Expéditeur était capturé mais rien ne le libérait : ni confirmation, ni versement au Voyageur, ni recours. Ce lot ferme la boucle : l'Expéditeur confirme ou laisse courir 4 jours, le Voyageur est versé, un signalement gèle tout. Décisions utilisateur du 03/09 après challenge métier/UX : litige possible pour un colis jamais livré, transfert rattaché à la charge, copie honnête sur les délais bancaires, rappel la veille de l'échéance, aucun bouton « Noter » avant la notation (B5).

### Règles de gestion — versement (PAY)
- **RG-PAY-01 — Aucun versement avant la fin de transaction** (INV-2). Le Voyageur n'est payé qu'une fois le deal COMPLETED : confirmation anticipée de l'Expéditeur, ou fin de la période de vérification (J+4 après la remise).
- **RG-PAY-02 — Le montant versé est le net du Voyageur figé à la réservation** (snapshot), dans sa devise. Jamais recalculé, jamais le total payé par l'Expéditeur.
- **RG-PAY-03 — La fin de transaction précède le versement.** Le deal passe COMPLETED d'abord, le transfert part ensuite ; un transfert refusé ne défait jamais la complétion : il est « en attente » et rejoué automatiquement (toutes les 5 minutes, 10 essais).
- **RG-PAY-04 — Un versement ne part jamais deux fois.** Rejeu ou double clic : même clé chez le fournisseur, même transfert.
- **RG-PAY-05 — Le transfert est rattaché à la charge de l'Expéditeur.** Il attend que ces fonds soient disponibles au lieu d'échouer sur la trésorerie de la plateforme.
- **RG-PAY-06 — Sans compte de paiement prêt (compte Connect absent ou virements non activés), le versement reste en attente** avec un motif lisible ; le Voyageur devra finaliser son compte (état visible côté front en B4-PR3).
- **RG-PAY-07 — Les deux parties lisent l'état du versement** (en attente, envoyé le …, en échec, gelé) ; l'identifiant du transfert n'est servi à personne.
- **RG-PAY-08 — « Versement envoyé » n'est pas « argent reçu ».** Toute copie dit : parti vers ton compte, sur ton compte bancaire sous 2 à 7 jours.
- **RG-PAY-09 — La confirmation anticipée est définitive** (INV-3) : elle libère le versement immédiatement et retire le droit de signaler.
- **RG-PAY-10 — La veille de l'échéance, l'Expéditeur reçoit un rappel** (in-app + email) : dernier jour pour vérifier ou signaler. Une seule fois par deal.
- **RG-PAY-11 — La retenue d'annulation tardive revient au Voyageur au prorata de sa part nette** (décision 03/09, D50) — versée par le même mécanisme, PR dédiée.

### Règles de gestion — litige (LIT)
- **RG-LIT-01 — Qui, quand.** Seul l'Expéditeur signale : après la remise, jusqu'à J+4 (INV-4) ; ou pendant le transport, pour un colis jamais livré, dès que le départ du trajet est dépassé de 48 h.
- **RG-LIT-02 — En transit, seul le motif « non livré » est recevable** ; le contenu ne se constate qu'après la remise.
- **RG-LIT-03 — Un dossier complet ou rien** : motif parmi six, description d'au moins 50 caractères, engagement sur l'honneur coché ; photos (5 max) et solution souhaitée facultatives.
- **RG-LIT-04 — Le signalement gèle le versement** (INV-5) quand un versement était programmé ; il n'est ni modifiable ni retirable ; le deal devient DISPUTED, état terminal jusqu'à la médiation (chantier C, lancé juste après B4).
- **RG-LIT-05 — Un ticket unique `YAM-XXXX`** est remis à l'Expéditeur et rappelé dans chaque échange.
- **RG-LIT-06 — Le Voyageur est informé calmement** : un signalement est ouvert, son motif (catégorie), le paiement est en attente, on recueillera sa version. Jamais la description ni les photos avant la médiation.
- **RG-LIT-07 — Chaque moment laisse un email** (RG-N-01) : fin de transaction → Expéditeur ; versement → Voyageur ; signalement → les deux ; rappel J+3 → Expéditeur. Aucun bouton « Noter » tant que la notation n'existe pas.

### Recette (API, en attendant les écrans B4-PR2/PR3)
| # | Scénario | Attendu |
|---|---|---|
| PAY1 | Expéditrice, deal DELIVERED, `POST /deals/:id/confirm` | 200, `status COMPLETED`, `payoutStatus SENT` (Fake) ou `FAILED` (Stripe sans compte prêt) ; emails « Transaction terminée » (Expéditrice) et « paiement parti » (Voyageur, si SENT) ; in-app des deux côtés |
| PAY2 | Même appel une 2e fois | 409 TRANSITION_NOT_ALLOWED |
| PAY3 | Le Voyageur appelle `/confirm` | 403 |
| PAY4 | Deal DELIVERED avec `payoutDueAt` dépassé, cron (≤ 5 min) | COMPLETED par SYSTEM, versement tenté, email « libéré automatiquement » |
| PAY5 | Deal DELIVERED à moins de 24 h de l'échéance, cron | UN rappel in-app + email « Dernier jour », jamais un second |
| PAY6 | Voyageur sans compte Stripe prêt (Stripe réel) | `payoutStatus FAILED`, motif `CARRIER_ACCOUNT_NOT_READY`, rejoué au cron suivant ; après onboarding complet → SENT |
| LIT1 | Expéditrice, deal DELIVERED avant J+4, `POST /deals/:id/dispute` complet | 200, ticket `YAM-XXXX`, deal DISPUTED, `payoutStatus FROZEN` ; email accusé (Expéditrice) + information (Voyageur, catégorie) ; in-app des deux côtés |
| LIT2 | Description < 50 caractères ou `pledgeAccepted` absent | 400, erreurs par champ |
| LIT3 | Après J+4 | 409 « verification period has ended » |
| LIT4 | Deal PICKED_UP, départ < 48 h | 409 « 48 hours after the trip departure » |
| LIT5 | Deal PICKED_UP, départ ≥ 48 h, catégorie ≠ NOT_DELIVERED | 400 |
| LIT6 | Deal PICKED_UP, départ ≥ 48 h, `NOT_DELIVERED` | 200, DISPUTED, pas de gel (rien n'était programmé) |
| LIT7 | `GET /deals/:id` en DISPUTED | Expéditrice : `dispute` complet ; Voyageur : `disputeCategory` seul, ni description ni photos |
| LIT8 | Cron J+4 sur un deal DISPUTED | Rien : jamais de versement automatique (INV-5) |

# B4-PR2 — l'Expéditeur confirme, laisse courir, ou signale : les écrans

### Le besoin
Le serveur sait clore une transaction, verser et geler (B4-PR1) ; l'Expéditeur, lui, avait encore des boutons factices, une carte « Noter » vers une page vide et un lien « Signaler » toujours actif. Décisions utilisateur du 03/09 (1A à 7A) : bouton de confirmation secondaire, vraie vue de fin, dossier de litige lisible, « Signaler » en transit désactivé avec la date, motif « non livré » verrouillé, photos envoyées à la sélection, accès direct interdit.

### Règles de gestion (E = Expéditeur)
- **RG-E-01 — La confirmation anticipée ne se présente jamais comme LE geste attendu** : bouton secondaire, confirmation en ligne qui dit « définitif », conseil d'ouvrir le colis avant. Le geste par défaut est de ne rien faire.
- **RG-E-02 — Chaque bouton reflète `allowedActions`** : « Confirmer » n'existe que si le serveur permet `confirmEarly`, « Signaler » que s'il permet `dispute`. Le front ne calcule aucune fenêtre.
- **RG-E-03 — En transit, « Signaler un colis non livré » est visible mais fermé avant la date servie par l'API** (départ + 48 h), avec la date affichée. Ouvert : motif verrouillé sur « non livré », le reste du formulaire inchangé.
- **RG-E-04 — Les photos de preuve partent dès la sélection** vers le stockage des preuves de litige ; le signalement ne peut pas être envoyé tant qu'une photo est en cours ou en échec.
- **RG-E-05 — L'écran de fin dit le sort de l'argent** (« le paiement de {prénom} est libéré », confirmé par toi ou automatiquement à J+4) et ferme la porte (« transaction close, plus de signalement possible »). L'Expéditeur ne voit jamais un échec de versement du Voyageur.
- **RG-E-06 — L'écran de litige montre le dossier déposé** (ticket, motif, description, solution souhaitée, photos, date), les 4 étapes et le contact support avec le numéro à rappeler.
- **RG-E-07 — Sans droit de signaler, la page de signalement renvoie au suivi** avec un message, jamais une page « impossible ».
- **RG-E-08 — Aucun bouton « Noter » tant que la notation n'existe pas** (B5) ; une note calme annonce qu'il viendra.

### Recette
| # | Scénario | Attendu |
|---|---|---|
| E1 | Deal DELIVERED (seed `bzv-delivered`), écran livré | Compte à rebours J+4, carte « Tout s'est bien passé ? » avec bouton contour et conseil, carte « Signaler un problème », AUCUNE carte « Noter » |
| E2 | Clic « Confirmer la livraison » | Confirmation en ligne « définitif », Annuler referme |
| E3 | « Oui, tout est OK » | Toast sans emoji, écran « Envoi terminé » : bannière « Tu as confirmé le … », « le paiement de {prénom} est libéré », carte paiement « Libéré », note « bientôt noter » sans bouton |
| E4 | Deal COMPLETED par le cron (seed `bzv-completed`) | Même écran, bannière « Période de vérification terminée le … » |
| E5 | Deal PICKED_UP, départ < 48 h | Lien « Signaler un colis non livré » grisé avec « à partir du {date} » ; `/report` en direct → retour au suivi + toast |
| E6 | Deal PICKED_UP, départ ≥ 48 h | Lien actif ; formulaire avec bandeau « colis encore en transit », motif « non livré » seul et coché, barre latérale « colis en transit » |
| E7 | Deal DELIVERED, formulaire complet, ajout de 2 photos | Vignettes « envoi… » puis nettes ; bouton Envoyer inactif pendant l'envoi ; photo trop lourde → vignette rouge « retire-la » et Envoyer inactif |
| E8 | Envoi confirmé | Écran succès avec le ticket `YAM-XXXX` du serveur ; retour au suivi → écran « Signalement en cours » |
| E9 | Écran DISPUTED (seed `bzv-disputed`) | Bannière ticket + date, dossier complet, 4 étapes, paiement « Gelé », support `mailto:` avec le ticket |
| E10 | Deal DELIVERED après J+4 (cron pas encore passé) | Ni « Confirmer » ni « Signaler » (allowedActions vides), compte à rebours à zéro |
| E11 | Deux onglets : confirmer dans l'un, signaler dans l'autre | Le second reçoit « ce deal a changé » et revient au suivi à jour |
| E12 | Mobile (≤ 640 px) sur E1, E3, E6, E9 | Mêmes contenus en une colonne, boutons pleine largeur |

# B4-PR3 — le Voyageur voit son argent : versement, blocage, litige, photo de remise

### Le besoin
Après la remise, le Voyageur tombait sur une ligne (« Deal terminé — paiement libéré ») et des promesses inexactes (« virés sur ton compte Stripe le {date} »). Un versement bloqué par un compte Stripe incomplet restait invisible. Décisions utilisateur du 03/09 (1A, 2A, 3A, 4B, 5A).

### Règles de gestion (VOY = Voyageur)
- **RG-VOY-01 — L'état du versement est au centre de l'écran** après la remise : programmé après la vérification (avec la date servie), en cours, parti le … (2 à 7 jours pour arriver), en attente avec cause, gelé.
- **RG-VOY-02 — Une cause grossière, jamais un message technique.** Compte de paiement non prêt → « finalise ton compte Stripe » avec le bouton ; toute autre erreur → « en cours de traitement, rien à faire ». Le message du fournisseur ne sort jamais du serveur.
- **RG-VOY-03 — Un versement bloqué par le compte se voit partout** : sur le deal et en bandeau en tête de « Mes trajets » (somme des montants bloqués), tant qu'il reste un deal concerné. Une erreur fournisseur ne déclenche aucun bandeau.
- **RG-VOY-04 — « Versement envoyé » n'est jamais « argent reçu »** (RG-PAY-08) : partout, « parti vers ton compte, sur ton compte bancaire sous 2 à 7 jours ».
- **RG-VOY-05 — Photo de remise optionnelle, jamais obligatoire** : 2 au plus, envoyées avant la saisie du code, visibles par l'Expéditeur et par la médiation. Sans photo, rien ne change.
- **RG-VOY-06 — Le litige est annoncé calmement** : ticket, motif (catégorie seule), « ce n'est pas une décision », les 3 étapes, et un moyen de donner sa version (email support, ticket en objet).
- **RG-VOY-07 — Aucun bouton « Noter » avant la notation** (B5) ; une note calme l'annonce.

### Recette
| # | Scénario | Attendu |
|---|---|---|
| V10 | Voyageur, deal DELIVERED (seed `bzv-delivered`) | Bannière « colis remis à … », carte « {net} après la vérification » avec la date, note « {prénom} peut confirmer plus tôt ou signaler », parcours à l'étape versement |
| V11 | Deal COMPLETED avec versement SENT (seed `bzv-completed`) | Carte verte « {net} partis vers ton compte », « envoyés le … 2 à 7 jours », bannière « terminé », note « bientôt noter » sans bouton |
| V12 | Deal COMPLETED, versement FAILED cause compte (Stripe réel, compte incomplet) | Carte ambre « en attente : finalise ton compte Stripe » + bouton vers l'onboarding ; bandeau en tête de « Mes trajets » avec la somme ; ligne « en attente : finalise ton compte Stripe » |
| V13 | Après onboarding complet, cron (≤ 5 min) | Carte passe à « partis vers ton compte », bandeau disparaît, ligne « partis le … » |
| V14 | Deal COMPLETED, versement FAILED cause fournisseur | Carte « en cours de traitement, rien à faire », AUCUN bandeau |
| V15 | Deal DISPUTED (seed `bzv-disputed`) | Ticket, motif « contenu manquant », « ce n'est pas une décision », 3 étapes, bouton « Donner ma version » ouvrant un email avec le ticket en objet, versement « en attente » |
| V16 | Livraison : ajout d'une photo puis du code | Vignette « envoi… » puis nette ; bouton « Valider » inactif pendant l'envoi ; après validation, l'Expéditeur voit la photo dans son récap « À la livraison » |
| V17 | Livraison sans photo | Comportement inchangé ; écran de succès sans bouton « Noter », texte « partiront … le {date} au plus tard, puis 2 à 7 jours » |
| V18 | Photo trop lourde ou mauvais format | Vignette rouge « retire-la et réessaye », validation bloquée tant qu'elle reste |
| V19 | Mobile (≤ 640 px) sur V10, V11, V15, V16 | Mêmes contenus en une colonne, carte Expéditeur en bas |

# Retenue ANN-01 — l'annulation tardive dédommage le Voyageur

### Le besoin
D39 promettait que la retenue de 50 % d'une annulation tardive reviendrait au Voyageur « avec l'infrastructure payout ». Elle restait chez Yamba. Décisions utilisateur du 03/09 (1A à 6A) : prorata de la part nette, versement immédiat, pas de compensation automatique après le départ, rien de rétroactif, arrondi au centime, notification et écrans.

### Règles de gestion (ANN)
- **RG-ANN-01 — La compensation est la retenue au prorata de la part nette du Voyageur** : retenue × net ÷ total payé, arrondie au centime, sans minimum ; le reste d'arrondi et la part de commission restent à Yamba. Tant que la protection (D22) n'est pas réelle, la prime vaut 0 ; le jour où elle le sera, elle est remboursée à 100 % et sort du prorata.
- **RG-ANN-02 — Elle part immédiatement**, dès l'annulation, par le même mécanisme que le versement d'une livraison ; un échec devient « en attente » et est rejoué automatiquement. Le Voyageur n'a rien à demander.
- **RG-ANN-03 — Annulation après le départ sans prise en charge : pas de compensation automatique.** La retenue est conservée par Yamba « à arbitrer » ; la médiation (chantier C) décidera qui a fait défaut.
- **RG-ANN-04 — Rien de rétroactif** : les deals annulés avant cette règle gardent leur trace, sans versement.
- **RG-ANN-05 — Chaque compensation laisse un email** au Voyageur (« ta compensation est partie », 2 à 7 jours) ; l'Expéditeur lit dans sa confirmation de remboursement que la retenue revient au Voyageur, et déjà avant d'annuler.
- **RG-ANN-06 — Le Voyageur voit la compensation là où il regarde** : page du deal annulé (montant, état, bouton Stripe si compte non prêt) et ligne « Mes trajets ».

### Recette
| # | Scénario | Attendu |
|---|---|---|
| ANN1 | Expéditrice annule un deal ACCEPTED à moins de 48 h du départ (Fake) | Remboursement 50 % ; deal CANCELLED avec `retentionDisposition CARRIER`, `payoutStatus SENT`, `payoutAmountCents` = retenue × net ÷ total ; événements `refund_issued` puis `payout_sent` (motif LATE_CANCELLATION) |
| ANN2 | Modale d'annulation, à moins de 48 h | Note « retenue … reversée au Voyageur » |
| ANN3 | Email Expéditrice de remboursement | Montant remboursé + phrase « la retenue revient au Voyageur » |
| ANN4 | Email Voyageur | « Ta compensation est partie », montant de la compensation, 2 à 7 jours |
| ANN5 | Page du deal annulé côté Voyageur ; ligne « Mes trajets » | Carte verte « {montant} de compensation partis vers ton compte » ; ligne « Annulée tardivement · … partis » |
| ANN6 | Même chose, Stripe réel, compte Voyageur non prêt | Carte ambre « en attente : finalise ton compte Stripe », bandeau en tête de « Mes trajets », rejeu au cron après onboarding |
| ANN7 | Annulation APRÈS le départ (pas de prise en charge) | Remboursement 50 %, `HELD_FOR_MEDIATION`, aucun versement ; côté Voyageur « retenue conservée, on te contacte » ; ligne « Annulée après le départ » |
| ANN8 | Annulation à plus de 48 h | Remboursement intégral, aucune retenue, rien côté Voyageur |

# Finances — le portefeuille du Voyageur et les paiements de l'Expéditeur

### Le besoin
La section Finances était une promesse : deux onglets vides et une maquette aux chiffres inventés. Chaque membre doit savoir où est son argent, sans rien estimer. Décisions utilisateur du 03/09 (1A à 5A) : les deux rôles, totaux calculés par le serveur, accès au tableau de bord Stripe, trois cartes et une liste, traduction.

### Règles de gestion (FIN)
- **RG-FIN-01 — Un seul calcul, côté serveur.** Les totaux et l'état de chaque ligne sont servis par l'API ; aucun écran ne recalcule un montant. Deux écrans montrent toujours le même chiffre.
- **RG-FIN-02 — Le Voyageur lit ses versements par état** : à venir (livraison en vérification, avec la date), en cours d'envoi, en attente (compte Stripe à finaliser, avec le bouton), gelé (signalement), parti le … (2 à 7 jours), retenue conservée (annulation après le départ). Une compensation d'annulation tardive est nommée comme telle.
- **RG-FIN-03 — L'Expéditeur lit ses paiements par état** : autorisé mais pas débité, bloqué chez Yamba (jusqu'au … quand la livraison est faite), libéré, jamais débité (empreinte disparue), remboursé de … le …, remboursé partiellement avec la retenue reversée au Voyageur.
- **RG-FIN-04 — Trois cartes par onglet** : Voyageur = à venir · envoyés (avec « ce mois ») · en attente ; Expéditeur = bloqué chez Yamba · dépensé · remboursé. « Dépensé » inclut les retenues d'annulation ; « remboursé » ne compte que l'argent réellement rendu.
- **RG-FIN-05 — La date d'arrivée sur le compte bancaire n'est jamais promise** : le portefeuille dit « parti le … », et renvoie au tableau de bord Stripe du Voyageur pour le reste (RIB, calendrier, historique).

### Recette
| # | Scénario | Attendu |
|---|---|---|
| FIN1 | Voyageur seed (`ines`), onglet Portefeuille | Cartes À venir / Envoyés / En attente non nulles selon les deals seed ; lignes triées par date, badge par état ; clic → page du deal |
| FIN2 | Deal COMPLETED avec versement SENT | Ligne verte « Parti le … · 2 à 7 jours », montant en +, compté dans « Envoyés » |
| FIN3 | Deal COMPLETED bloqué (compte Stripe) | Bandeau « finalise ton compte Stripe » en tête, ligne ambre, montant compté dans « En attente » |
| FIN4 | Annulation tardive compensée | Ligne « Compensation · annulation tardive de {prénom} », montant de la compensation |
| FIN5 | Bouton « Voir mes virements sur Stripe » | Nouvel onglet sur le tableau de bord Stripe Express ; sans compte : toast « finalise d'abord ton compte » |
| FIN6 | Expéditrice seed (`aminata`), onglet Paiements | Cartes Bloqué / Dépensé / Remboursé ; ligne « bloqué jusqu'au … » sur un deal livré ; ligne remboursement partiel avec « retenue … reversée au Voyageur » |
| FIN7 | Membre sans aucun deal | États vides honnêtes ; non-Voyageur : « Devenir Voyageur » |
| FIN8 | Mobile (≤ 640 px), onglet Finances de la barre du bas | Même contenu en une colonne, cartes empilées |

# Fix recette 03/09 — le suivi du voyage marche sur de vrais deals

### Règle
- **RG-P-14 — Un jalon de voyage confirmé est écrit, sur tout deal réel** : la garde de concurrence ne dépend jamais de la présence d'un champ ; un deal créé avant le correctif est réparé une fois.

### Recette
| # | Scénario | Attendu |
|---|---|---|
| J1 | Voyageur, deal réel PICKED_UP (`6a983c…`), « À l'aéroport » puis 5 s | Jalon écrit, timeline Expéditrice + in-app ; plus de « Erreur, réessaye » |
| J2 | « Décollage » puis « Atterrissage » dans l'ordre | Écrits ; « Décollage » avant « Aéroport » → refus propre (ordre) |
| J3 | Double clic sur un jalon | Un seul jalon écrit, le second refusé sans erreur visible |
| J4 | Expéditrice, « Régénérer le code » | Nouveau code affiché, email « nouveau code » ; sinon relever la ligne `POST …/code/regenerate` du gateway |

# Durcissement B4 — aucun argent bloqué en silence, aucune session expirée déguisée en bug

### Règles de gestion (H)
- **RG-H-01 — Un versement en échec est rejoué jusqu'à 100 fois** (toutes les 5 minutes) ; au-delà, il reste visible et remonte au support chaque matin.
- **RG-H-02 — Un compte Stripe déclaré prêt paie tout de suite** : Stripe prévient Yamba, les drapeaux du Voyageur suivent, ses versements bloqués repartent sans qu'il clique.
- **RG-H-03 — Un transfert renversé par Stripe n'est jamais renvoyé automatiquement** : il passe « sous examen », le Voyageur le voit calmement, le support tranche.
- **RG-H-04 — Un virement bancaire refusé est dit au Voyageur** (in-app + email « vérifie ton RIB »), sans le message brut de la banque, avec le chemin vers son tableau de bord Stripe.
- **RG-H-05 — Une session expirée ouvre la fenêtre de connexion sur place**, jamais un « Erreur, réessaye » ; après connexion, l'utilisateur refait son geste sur la même page.

### Recette
| # | Scénario | Attendu |
|---|---|---|
| H1 | Seed `bzv-completed-blocked`, Voyageur Inès | Page du deal : carte ambre « en attente : finalise ton compte Stripe » + bouton ; bandeau en tête de « Mes trajets » et de Finances ; ligne « en attente : finalise ton compte » |
| H2 | Stripe test : compte Voyageur complété (webhook `account.updated` reçu) | Drapeaux mis à jour en base, versement FAILED reparti dans la foulée (log « account.updated processed », `retried` ≥ 1), carte verte « partis vers ton compte » |
| H3 | Stripe test : renverser un transfert (dashboard → transfer → reverse) | Deal en `REVERSED`, carte « versement sous examen », ligne Finances « sous examen », présent dans le récapitulatif du lendemain |
| H4 | Stripe test : `payout.failed` sur le compte connecté (RIB de test en échec) | Notification in-app « Virement bancaire refusé : vérifie ton RIB » + email calme avec bouton Finances |
| H5 | 08:00 UTC (ou déclenchement manuel du cron) avec un FAILED > 24 h | Email « Argent à surveiller » à `SUPPORT_EMAIL` avec les liens ; rien à dire → pas d'email |
| H6 | Session Expéditrice inactive > 60 min, puis « Régénérer le code » | Fenêtre « Ta session a expiré » par-dessus le suivi ; après connexion, la régénération fonctionne |
| H7 | Même chose côté Voyageur sur un jalon | Idem, jalon confirmable après reconnexion |
| H8 | Notification in-app d'un versement | Libellé « Versement parti vers ton compte » |

# Notifications vivantes — elles se rafraîchissent, elles nomment, elles disent quoi faire

### Règles de gestion (NOT)
- **RG-NOT-01 — La cloche dit vrai** : le compteur et la liste se rafraîchissent seuls (au plus 30 s de retard, tout de suite au retour sur l'onglet et après un geste).
- **RG-NOT-02 — Chaque notification nomme l'autre partie et le trajet**, et dit ce qui se passe pour MOI : la même livraison se lit « Colis remis · vérifie avant le … » pour l'Expéditrice et « Livraison validée · versement après vérification » pour le Voyageur.
- **RG-NOT-03 — Un jalon de voyage est nommé** (à l'aéroport, décollé, atterri) ; l'atterrissage dit à l'Expéditrice de prévenir le destinataire.
- **RG-NOT-04 — Une action, pas dix** : « Tout marquer lu » depuis la cloche et la page ; ouvrir une notification la marque lue et mène au deal ou au suivi.
- **RG-NOT-05 — Un seul jalon envoie un email** : l'atterrissage, à l'Expéditrice (« préviens le destinataire, le code est dans ton suivi »). Les autres jalons restent dans l'application.

### Recette
| # | Scénario | Attendu |
|---|---|---|
| N1 | Voyageur confirme « à l'aéroport » ; Expéditrice sur une autre page, sans recharger | Sous 30 s, badge +1 ; menu de la cloche : « {prénom} est à l'aéroport · {route} » |
| N2 | Atterrissage confirmé | Notification « {prénom} a atterri · préviens le destinataire » + email « {prénom} a atterri » à l'Expéditrice ; aucun email pour aéroport / décollage |
| N3 | Ouvrir une notification depuis le menu | Marquée lue, arrivée sur le suivi ou le deal, badge −1 |
| N4 | « Tout marquer lu » (menu ou page) | Badge à 0, lignes en blanc |
| N5 | Livraison validée | Expéditrice : « Colis remis · vérifie avant le {date} » ; Voyageur : « Livraison validée · versement après vérification » |
| N6 | Versement parti / compensation | Voyageur : « {montant} partis vers ton compte » ou « {montant} de compensation partis » |
| N7 | Notification système « virement refusé » (seed impossible, Stripe test) | Listée sans lien, titre « Virement bancaire refusé : vérifie ton RIB » ; la liste ne casse pas |
| N8 | Mobile | Badge sur la cloche, lien vers la page, mêmes titres |

# B5-PR1 — la notation mutuelle, double-aveugle, et la réputation qui s'explique

### Règles de gestion (NOTE)
- **RG-NOTE-01 — Chaque partie note l'autre, une fois, sur un deal terminé, dans les 14 jours.** Une note de 1 à 5 suffit ; critères et commentaire sont facultatifs. Pas de note sur un deal annulé ni en litige.
- **RG-NOTE-02 — La note reste secrète jusqu'à ce que les deux aient noté, ou 14 jours.** Personne ne peut répondre à une note par une autre. À l'échéance, les notes déposées sont révélées même si une seule existe.
- **RG-NOTE-03 — Seules les notes révélées sont publiques et comptent** dans la moyenne, le nombre d'avis et le niveau.
- **RG-NOTE-04 — Deux rappels, puis silence** : J+5 et J+7 après la fin de transaction, aux seuls rôles qui n'ont pas noté, dans l'application et par email. « Plus tard » toujours possible.
- **RG-NOTE-05 — Un commentaire est public, attribué au prénom, non modifiable**, 280 caractères au plus.
- **RG-NOTE-06 — Les critères appartiennent au rôle noté** (Voyageur : ponctualité, communication, soin du colis ; Expéditeur : clarté de la déclaration, réactivité, ponctualité) ; un critère hors rôle est ignoré.
- **RG-NOTE-07 — La réputation s'explique** : un niveau avec ses critères affichés (Nouveau, Confirmé, Top Voyageur / Expéditeur fiable) et des faits (deals terminés, annulations fautives, moyenne des avis révélés). Jamais de score opaque, et aucun effet sur le prix pour l'instant.

### Recette (API, en attendant PR2)
| # | Scénario | Attendu |
|---|---|---|
| NOTE1 | Expéditrice, deal COMPLETED (seed `bzv-completed`), `POST /deals/:id/rating {rating:5, comment}` | 201 `revealed:false` ; `GET /deals/:id/rating` : `myRating` présent, `counterpartRating` null, `canRate` false « already rated » |
| NOTE2 | Voyageur, même deal, `GET` | `counterpartHasRated:true`, `counterpartRating` null (secret), `canRate:true` |
| NOTE3 | Voyageur note à son tour | 201 `revealed:true` ; les deux `GET` montrent la note de l'autre ; in-app « Les notes sont révélées » des deux côtés ; profil public : moyenne, nombre, niveau mis à jour |
| NOTE4 | Une seconde note du même rôle | 409 « already rated » |
| NOTE5 | Deal DISPUTED ou CANCELLED | 409 « Only a completed deal can be rated » |
| NOTE6 | Deal COMPLETED depuis 5 jours, une seule partie a noté, cron | Rappel in-app + email « Pense à noter … » au rôle muet seulement ; à J+7 « Dernier rappel » ; rien ensuite |
| NOTE7 | Deal COMPLETED depuis 14 jours, une seule note | Note révélée (événement WINDOW_ELAPSED), visible sur le profil ; sans aucune note : fenêtre fermée en silence |
| NOTE8 | Profil public d'un Voyageur avec 10 deals terminés, moyenne révélée ≥ 4,8, 0 annulation | `reputation.carrier.level = TOP`, badge « Top Voyageur » (`isSuperCarrier`) sur les cartes de recherche |

# B5-PR2 — noter sans harceler, comprendre sa réputation

### Règles de gestion (NOTE, suite)
- **RG-NOTE-08 — Le bouton « Noter » vit sur le deal terminé, pas dans une fenêtre bloquante.** Il apparaît sur l'écran terminé des deux rôles, en mention sur la ligne de liste et en action « à traiter » sur l'accueil, tant que le serveur dit que la note est possible. « Plus tard » ramène au deal sans question.
- **RG-NOTE-09 — On ne montre jamais la note moyenne de la personne AVANT de la noter** (biais d'ancrage) : prénom, initiale, corridor et date de fin seulement.
- **RG-NOTE-10 — Après la note, l'écran dit pourquoi on ne voit pas encore celle de l'autre** : « révélée quand {prénom} aura noté, ou le {date} ». Une fois révélées, les deux notes s'affichent côte à côte sur le deal.
- **RG-NOTE-11 — Le niveau se lit avec ses raisons** : badge (Nouveau / Confirmé / Top Voyageur ; Nouvel / fiable / Top Expéditeur) avec les critères en info-bulle, ligne de faits (Deals terminés, moyenne sur N avis, annulations tardives) et le critère du niveau suivant. Seuils : Confirmé = 3 Deals ; Top = 10 Deals Voyageur ou 5 envois Expéditeur, moyenne ≥ 4,8, 0 annulation tardive.
- **RG-NOTE-12 — Chaque avis public porte les pouces de ses critères et un lien « Signaler cet avis »** (email au support avec la référence) jusqu'à la file de signalements de l'admin.

### Recette (écrans)
| # | Scénario | Attendu |
|---|---|---|
| NOTE9 | Expéditrice, deal terminé non noté (seed), écran du deal | Carte « Comment s'est passé ton Deal avec {prénom} ? » + échéance + bouton « Noter {prénom} » ; ligne de liste « Livré · Note {prénom} » ; accueil : action « à traiter » |
| NOTE10 | Clic « Noter » | Écran de notation : prénom, initiale, corridor, date — **pas** de moyenne ni de nombre de deals ; bannière sans montant |
| NOTE11 | « Plus tard » | Retour au deal, la carte « Noter » reste, aucune fenêtre |
| NOTE12 | Publier 5 ★ + pouces + commentaire | « Merci ! … révélée quand {prénom} aura noté, ou le {date} » → retour au deal : carte « Note envoyée · révélée quand … » ; la ligne de liste repasse au repos |
| NOTE13 | Voyageur, même deal | Carte « Noter {prénom} » (il ne voit pas la note de l'expéditrice) ; ligne « … · pense à noter {prénom} » ; après sa note : « {prénom} t'avait déjà noté : vos deux avis sont visibles » ; les deux écrans terminé montrent les deux notes et le commentaire reçu |
| NOTE14 | Ouvrir `/bookings/:id/rate` sur un deal déjà noté, en litige ou d'un autre compte | Écran « Ta note est envoyée » / « Ce Deal ne peut pas être noté pour le moment » + retour — jamais d'erreur brute |
| NOTE15 | Profil public du Voyageur après révélation | Badge de niveau (info-bulle des critères), ligne de faits, « prochain niveau », avis avec pouces et « Signaler cet avis » (ouvre l'email support avec la référence) |
| NOTE16 | Profil public de l'Expéditrice | Même chose côté « En tant qu'expéditeur » : faits, badge « Expéditeur fiable » à partir de 3 envois |

# C-PR1 — un back-office qui ne s'ouvre pas sans preuve, et qui se souvient de tout

### Règles de gestion (ADM)
- **RG-ADM-01 — Le rôle ADMIN ne s'obtient que par un script sur le poste de l'opérateur**, jamais par l'inscription ni par une route.
- **RG-ADM-02 — Aucune session admin sans double authentification.** Mot de passe puis code TOTP (application d'authentification) ; à la première connexion, l'activation est imposée avant tout accès. Un compte ADMIN sans 2FA active ne voit rien.
- **RG-ADM-03 — Huit codes de secours, montrés une seule fois**, à usage unique chacun ; l'admin est prévenu quand il en reste deux ou moins.
- **RG-ADM-04 — Un code ne sert jamais deux fois** : un code TOTP intercepté est refusé s'il a déjà servi dans le même pas de 30 s ; cinq échecs → quinze minutes d'attente.
- **RG-ADM-05 — La session admin est courte** : 15 min d'accès renouvelés en silence, déconnexion après 45 min d'inactivité, 12 h de vie au plus, pas de « rester connecté ». Elle est distincte de la session utilisateur du même compte.
- **RG-ADM-06 — Chaque geste est journalisé** (qui, quoi, sur quoi, quand, d'où), y compris ouvrir un dossier de médiation. Un geste dont le journal ne s'écrit pas n'a pas lieu.
- **RG-ADM-07 — Une seule file « à arbitrer »** : les litiges ouverts et les retenues en attente, les plus anciens d'abord, avec l'ancienneté en jours (rouge à partir de J+5, le délai promis).
- **RG-ADM-08 — Le dossier montre tout ce que les deux parties ont déclaré et prouvé** (photos de déclaration, prise en charge et checklist, jalons, remise, signalement) et l'état de l'argent — **jamais le code de livraison**, même à Yamba.

### Recette (ADM)
| # | Scénario | Attendu |
|---|---|---|
| ADM1 | `grant-admin.ts <ton email>` puis `http://localhost:3001/login`, mauvais mot de passe | « Email ou mot de passe incorrect », aucune session |
| ADM2 | Bon mot de passe, première fois | Écran QR + secret ; scanner avec Google Authenticator / Aegis ; mauvais code → « Code invalide » ; bon code → 8 codes de secours affichés une fois → « J'ai enregistré mes codes » → file « À arbitrer » |
| ADM3 | Se déconnecter, se reconnecter | Mot de passe puis code TOTP ; le même code saisi deux fois dans la même demi-minute est refusé la seconde fois |
| ADM4 | Connexion avec un code de secours | Acceptée, « il te reste 7 codes » ; le même code rejoué → refusé |
| ADM5 | Cinq codes faux d'affilée | « Trop de tentatives » pendant 15 min |
| ADM6 | Ouvrir `http://localhost:3000` (user-ui) connecté comme utilisateur, puis `http://localhost:3001/disputes` sans connexion admin | Renvoi vers `/login` : la session utilisateur n'ouvre pas l'admin (et la connexion admin ne déconnecte pas l'utilisateur) |
| ADM7 | File « À arbitrer » avec le seed | Les litiges YAM-XXXX du seed (motif, corridor, parties, montant payé, J+n) ; une annulation après le départ apparaît en « Retenue » avec le montant retenu |
| ADM8 | Ouvrir un dossier | Chronologie, argent (payé, net, commission, versement gelé), Expéditeur et Voyageur avec leurs faits, colis déclaré + photos, prise en charge + checklist + photos, jalons, photos de remise, signalement (description, solution souhaitée, photos) ; aucun code de livraison nulle part |
| ADM9 | Journal | Chaque connexion, activation 2FA, code de secours utilisé, dossier consulté, déconnexion — avec le prénom de l'admin et l'IP |
| ADM10 | Laisser l'onglet 50 min sans rien faire, puis naviguer | Retour à `/login` (inactivité 45 min) |

# C-PR2 — la médiation : entendre les deux, trancher une fois, laisser une trace

### Règles de gestion (MED)
- **RG-MED-01 — Le Voyageur donne sa version dans l'application, une seule fois**, tant que le dossier est ouvert : texte d'au moins 50 caractères, jusqu'à 5 photos. L'Expéditeur apprend qu'une version a été donnée, jamais son contenu.
- **RG-MED-02 — Une décision n'est possible qu'après la version du Voyageur, ou 72 h après l'ouverture.** Le dossier affiche l'échéance ; l'API refuse avant (409 avec la date).
- **RG-MED-03 — Trois issues pour un litige** : rejet (Voyageur payé en entier), remboursement partiel (montant libre entre 1 centime et le total moins 1, le Voyageur reçoit son net moins ce montant, plancher zéro, Yamba conserve le reste), remboursement total (commission comprise, Voyageur rien).
- **RG-MED-04 — Deux issues pour une retenue à arbitrer**, aux montants calculés par le serveur : compensation au Voyageur (prorata de sa part nette) ou restitution à l'Expéditeur.
- **RG-MED-05 — Toute décision porte un motif d'au moins 50 caractères, lu par les deux parties**, et passe par un récapitulatif des flux avant validation. Elle est définitive dans l'application ; le recours est la médiation conventionnelle par email.
- **RG-MED-06 — L'argent suit l'ordre remboursement puis versement** ; un versement qui échoue est rejoué par le cron, jamais bloquant pour la décision.
- **RG-MED-07 — Un deal clos par médiation ne se note pas.** Le litige tranché incrémente un compteur interne « litiges perdus » sur la partie condamnée (Expéditeur si rejet, Voyageur dès qu'il y a remboursement), visible de l'admin seul.
- **RG-MED-08 — Les deux parties sont prévenues de la décision** (écran, notification, email) avec l'issue, le montant qui les concerne et le motif.

### Recette (MED) — rejouer `seed-deals.ts` avant (deux litiges YAM-2041 / YAM-2042 et une retenue « à arbitrer »)
| # | Scénario | Attendu |
|---|---|---|
| MED1 | Voyageur (Thomas), deal YAM-2041 | Carte « Donne ta version » avec l'échéance ; texte < 50 → bouton inactif ; photos jusqu'à 5 ; envoi → « Version envoyée le … » ; le bouton ne revient pas |
| MED2 | Expéditrice (Chinwe), même deal | Processus : « Thomas a donné sa version » ; jamais son texte ni ses photos |
| MED3 | Admin, file | YAM-2041 « version reçue · à trancher », YAM-2042 « attend le Voyageur · N h », retenue « à trancher » |
| MED4 | Admin, YAM-2042 sans version | Dossier : « décision possible à partir du … » ; formulaire absent |
| MED5 | Admin, YAM-2041, partiel 15,00 € | Récapitulatif : remboursé 15 €, versé (net − 15 €), conservé (commission) ; validation → « Décision enregistrée », dossier sorti de la file |
| MED6 | Expéditrice après | Écran « Envoi terminé » avec « Décision rendue » : remboursement partiel, 15 € sous 5 à 10 jours, motif ; aucune carte « Noter » ; email et notification reçus |
| MED7 | Voyageur après | Écran terminé : « Décision rendue », versement net − 15 € parti, motif ; portefeuille au bon montant ; aucune carte « Noter » |
| MED8 | Admin, retenue `bzv-held` | Deux issues avec montants : compensation (prorata) / restitution (retenue entière) ; motif ; validation → Voyageur : compensation partie ou « retenue restituée » ; Expéditrice : « la retenue te revient, X remboursés » |
| MED9 | Admin, remboursement total sur un litige | Deal CANCELLED, Expéditeur remboursé en entier, Voyageur « aucun versement », écrans des deux côtés |
| MED10 | Journal | `Litige tranché` / `Retenue arbitrée` avec l'issue et les montants ; seconde tentative sur le même dossier refusée |

# C-PR3 — qui peut faire quoi dans le back-office, et ce qu'une sanction change vraiment

### Règles de gestion (ADM, suite)
- **RG-ADM-09 — Quatre profils à l'origine, six aujourd'hui** *(révisée le 06/09/2026 : Exploitation (OPS) est arrivé avec les paramètres et l'état des services — D62, D64 —, Données personnelles (PRIVACY) avec le RGPD — D63)*, **un seul super administrateur minimum.** Super administrateur (tout, comptes admin, journal), Médiateur (tranche les litiges, applique les sanctions), Support (lit les fiches, propose une sanction), Finance (lecture, journal). Le dernier super administrateur ne peut être ni rétrogradé ni retiré ; personne n'agit sur son propre compte.
- **RG-ADM-10 — Un compte admin créé par invitation naît sans rôle client** : il ne publie pas de trajet et n'envoie pas de colis tant qu'il ne passe pas par le parcours client. Il définit son mot de passe par le lien reçu (48 h) et active la 2FA à sa première connexion.
- **RG-ADM-11 — Conflit d'intérêts** : un admin ne tranche jamais un deal dont il est partie et ne sanctionne jamais son contradicteur ni un autre admin (sauf super administrateur). Le serveur refuse.
- **RG-ADM-12 — Deux niveaux de sanction, toujours motivés (20 caractères au moins), réversibles.** Restreint : ni publier ni réserver, les deals en cours continuent. Suspendu : connexion refusée, sessions fermées, trajets invisibles, deals en cours signalés au support. Durée optionnelle.
- **RG-ADM-13 — Le Support propose, le Médiateur ou le super administrateur exécute** (deux clics, ou deux personnes).
- **RG-ADM-14 — Le membre sanctionné reçoit un email avec le motif générique**, jamais le contenu d'un signalement, et l'adresse pour contester ; un email « compte rétabli » à la levée.
- **RG-ADM-15 — La fiche montre tout ce qui sert à opérer, rien de secret** : identité, rôles, Stripe (identifiant masqué, encaissements et versements), réputation et compteurs internes, trajets, deals, litiges, actions admin le concernant, sessions actives. Jamais de mot de passe, de secret 2FA, de code de livraison.
- **RG-ADM-16 — Chaque ouverture de session admin déclenche une alerte email** ; l'admin voit ses sessions et peut les révoquer.
- **RG-ADM-17 — Les erreurs serveur remontent à Sentry** avec le service et l'identifiant de corrélation, dès qu'un DSN est posé.

### Recette (ADM, suite) — `grant-admin.ts <ton email> --role SUPER_ADMIN`
| # | Scénario | Attendu |
|---|---|---|
| ADM11 | Super admin, « Comptes admin », inviter `support@…` (Support) | Email d'invitation avec lien `…/invite?token=` ; le compte apparaît « invitation en attente » ; il n'a aucun rôle client |
| ADM12 | Ouvrir le lien, mot de passe faible puis fort | Refus motivé, puis « Enregistrer et me connecter » → `/login` → mot de passe → écran QR 2FA |
| ADM13 | Connecté en Support | Menu : À arbitrer, Utilisateurs, Mes sessions ; pas de Journal ni Comptes admin ; sur un dossier de litige, pas de formulaire de décision ; sur une fiche, bouton « Proposer » seulement |
| ADM14 | Support propose une restriction (motif < 20 caractères puis valide) | Bouton inactif, puis « Fait » ; la fiche montre la proposition |
| ADM15 | Médiateur ou super admin sur la même fiche | Proposition visible, boutons Appliquer ; appliquer « Restreint » → email « compte restreint » au membre ; le membre ne peut plus publier ni réserver (403), ses deals en cours continuent |
| ADM16 | Appliquer « Suspendu » | Le membre est déconnecté partout, « Ton compte est suspendu » à la connexion, ses trajets disparaissent de la recherche, email au support s'il a des deals en cours |
| ADM17 | Lever la sanction (motif) | Compte actif, email « rétabli », connexion possible, trajets de nouveau visibles |
| ADM18 | Tenter d'agir sur sa propre fiche, ou de trancher un litige où l'on est partie | 403 explicite |
| ADM19 | Super admin : rétrograder le dernier super admin, retirer son propre accès | Refus ; retirer un autre admin → sa 2FA et ses sessions admin tombent |
| ADM20 | Mes sessions | Chaque connexion admin envoie un email d'alerte ; la liste montre les sessions ; révoquer la session courante renvoie à `/login` |

# C-PR4 — vérifier un billet, masquer un trajet, compter ce qui attend

## Le besoin
Avant d'avoir du volume, Yamba ne bloque rien sans billet vérifié : le badge « billet vérifié » est un signal de confiance, pas une barrière. Mais l'équipe doit pouvoir regarder les billets déposés, dire oui ou non avec un motif clair, et retirer de la recherche un trajet douteux sans le détruire — annuler un trajet est un geste d'argent (remboursements, réservations) qui reste au Voyageur. L'accueil du back-office doit dire d'un coup d'œil ce qui attend chaque profil.

### Règles de gestion (ADM, suite)
- **RG-ADM-18 — La file des billets ne montre que des trajets à venir**, les plus anciens dépôts d'abord. Un billet resté en attente sur un trajet déjà parti sort de la file (statut « expiré ») : il n'a plus rien à prouver.
- **RG-ADM-19 — Ouvrir un billet est journalisé** (qui, quand, quel document) : c'est une donnée personnelle du Voyageur.
- **RG-ADM-20 — Une décision sur un billet est valider, ou rejeter avec un motif fermé** : illisible, dates différentes du trajet, nom différent du compte, document non recevable. Le Voyageur reçoit un email dans sa langue ; rejeté, il peut redéposer un billet, qui revient dans la file. Une décision est unique par document (un second clic est refusé).
- **RG-ADM-21 — Le billet reste informatif** : aucune publication, aucune réservation n'est bloquée faute de billet vérifié (à revoir avec le volume).
- **RG-ADM-22 — « Masqué par Yamba » n'est pas une pause ni une annulation.** Le trajet disparaît de la recherche et de sa page publique et ne peut plus être réservé, même par un appel direct ; ses réservations en cours continuent ; le Voyageur le voit toujours dans son espace avec un bandeau, et reçoit un email au motif générique (le motif interne, 20 caractères au moins, reste dans le journal). C'est réversible, avec un motif.
- **RG-ADM-23 — Yamba n'annule jamais un trajet à la place du Voyageur.**
- **RG-ADM-24 — Le Support vérifie les billets et propose un masquage ; le Médiateur ou le super administrateur masque et rétablit.** Personne n'agit sur son propre trajet ni son propre billet.
- **RG-ADM-25 — L'accueil compte ce qui attend, selon le profil** : chaque compteur n'apparaît que si le profil peut ouvrir la file correspondante ; le super administrateur voit tout. Ce sont des compteurs opérationnels, pas du pilotage (courbes et finances : C-PR6).

### Recette (ADM, suite) — `seed-deals.ts` pose un billet en attente sur Paris → Brazzaville (`bzv-upcoming`)
| # | Scénario | Attendu |
|---|---|---|
| ADM21 | Connexion admin | Atterrissage sur `/home` : tuiles « À traiter » (ambrées si > 0) et « État de la plateforme » ; un Support ne voit ni « Invitations admin » ni « Sanctions proposées » |
| ADM22 | Support, « Billets » | Le billet seedé apparaît ; « Ouvrir le billet » ouvre le document dans un onglet et écrit « Document ouvert » dans le journal |
| ADM23 | Rejeter sans motif, puis avec « Les dates ne correspondent pas » | Bouton inactif sans motif ; puis email « Billet non validé » au Voyageur avec le motif en clair, fiche trajet : billet « rejeté », document REJECTED |
| ADM24 | Le Voyageur (user-ui) redépose un billet sur ce trajet | Le trajet repasse « à vérifier » et revient dans la file |
| ADM25 | Valider | Email « Billet vérifié », badge « vérifié » sur la page publique du trajet ; un second clic sur le même document → 400 |
| ADM26 | Un trajet parti avec un billet en attente (`bzv-inflight` après dépôt manuel) | Absent de la file, mention « n billet(s) de trajets partis sortis de la file », document EXPIRED |
| ADM27 | Support, fiche trajet, « Proposer » un masquage (motif < 20 puis valide) | Bouton inactif, puis bandeau « Masquage proposé par … » ; tuile « Masquages proposés » = 1 ; rien ne change pour le Voyageur |
| ADM28 | Médiateur, même fiche, « Masquer » | Trajet absent de la recherche et 404 sur sa page publique ; réservation directe refusée (`TRIP_NOT_BOOKABLE`) ; réservations acceptées inchangées ; email générique au Voyageur ; bandeau rouge sur le détail du trajet côté Voyageur ; journal « Trajet masqué » avec le motif interne |
| ADM29 | « Rétablir » (motif) | Trajet de retour dans la recherche, email « de nouveau visible », journal « Trajet rétabli » |
| ADM30 | Admin qui est aussi Voyageur, sur son propre trajet / billet | Carte Masquage sans bouton ; API 403 |

# C-PR5a — l'argent tel qu'il est : ce qui a échoué, ce qui est revenu, ce que Stripe dit vraiment

## Le besoin
L'argent réel est chez le fournisseur de paiement ; la base ne fait que le refléter. Quand un versement échoue, quand Stripe renvoie un transfert, quand un remboursement est parti sans être écrit, l'équipe finance doit le VOIR, comparer les deux mondes et agir avec un motif — sans jamais recalculer un montant ni renvoyer de l'argent par accident.

### Règles de gestion (FIN, suite)
- **RG-FIN-06 — Un versement en échec est rejoué tout seul, de plus en plus espacé, sans jamais se taire** : toutes les 5 minutes la première demi-heure, puis toutes les 30 minutes, puis toutes les 2 heures, puis chaque jour. Il reste visible dans la file « Versements en échec » tant qu'il n'est pas parti.
- **RG-FIN-07 — « Relancer » est le même versement, pas un nouveau** : même montant figé, même clé chez le fournisseur ; un double clic ne verse pas deux fois.
- **RG-FIN-08 — Un transfert renversé par Stripe ne repart jamais seul.** Il attend une décision motivée (20 caractères au moins) : re-verser (un nouveau transfert, tracé) ou abandonner (manque à gagner assumé, tracé).
- **RG-FIN-09 — La fiche argent d'un deal montre tout ce qui a été posé, rien d'inféré** : prix figé, débit, remboursements, versement, retenue, avec les identifiants fournisseur en clair pour la finance et le compte Stripe du Voyageur masqué.
- **RG-FIN-10 — Le rapprochement compare, il ne corrige pas.** Il lit l'état réel chez le fournisseur et liste les écarts (remboursement parti sans écriture, transfert introuvable, renversé non marqué…). Toute correction est un geste humain, journalisé.
- **RG-FIN-11 — Personne n'agit sur un deal dont il est partie** ; Finance et Médiateur relancent et clôturent, le Support ne voit pas les finances.
- **RG-FIN-12 — Chaque lecture d'une fiche argent, chaque rapprochement, chaque relance, chaque clôture laisse une ligne au journal.**
- **RG-FIN-13 — Le message brut du fournisseur n'est lu que par l'admin** ; le Voyageur continue de ne voir que « compte à finaliser » ou « en cours ».

### Recette (FIN) — `seed-deals.ts` : `bzv-completed-blocked` (échec, relance échue), `bzv-reversed` (renversé), `bzv-held` (retenue)
| # | Scénario | Attendu |
|---|---|---|
| FIN01 | Connexion Finance (ou Médiateur), accueil | Tuiles « Versements en échec » = 1, « Transferts renversés » = 1 ; « Finances » dans le menu ; un Support ne voit ni la tuile ni le menu |
| FIN02 | Finances, onglet « Versements en échec » | Ligne Paris → Brazzaville, « compte Stripe du Voyageur non prêt », 4 tentatives, badge « Stripe non prêt » |
| FIN03 | « Relancer » | Sans Stripe réel (Fake) : « Versement envoyé », la ligne disparaît, journal « Versement rejoué » ; avec Stripe et compte non prêt : « Toujours en échec », 5 tentatives, prochaine relance affichée |
| FIN04 | Onglet « Transferts renversés », « Décider » | Fiche argent : état « renversé », formulaire ambre ; boutons inactifs sous 20 caractères |
| FIN05 | « Abandonner » avec motif | « Renversement abandonné, clos » ; la ligne sort de la file ; fiche : « Renversement clos : abandonné par … » ; journal « Renversement clos » |
| FIN06 | Rejouer le seed, « Re-verser » avec motif | Nouveau transfert (Fake : envoyé), état « envoyé », journal ; un second clic → 400 « not an open reversal » |
| FIN07 | Fiche argent d'un deal terminé, « Rapprocher maintenant » | Fake : « Base et fournisseur concordent » ou divergences libellées (un deal seedé sans intent Fake réel → « Paiement introuvable chez le fournisseur ») ; journal « Rapprochement Stripe » ; rien ne change en base |
| FIN08 | Deal réel Stripe test : annuler après acceptation, puis rapprocher | Aucune divergence ; `refundId` visible dans « Paiement de l'Expéditeur » |
| FIN09 | Onglet « Retenues à arbitrer », « Arbitrer » | Renvoie au dossier de médiation (C-PR2) |
| FIN10 | Admin partie au deal (son propre deal) | Aucun bouton « Relancer » / clôture ; API 403 |

# C-PR5b — compter le mois, sortir le fichier, rendre l'argent avec un motif

## Le besoin
Chaque mois, savoir ce qui est entré, ce qui est ressorti, ce qui a été versé et ce que Yamba a gagné — par devise, sans grand livre ni tableur maison. Donner au comptable un fichier par deal avec les identifiants Stripe. Et pouvoir faire un geste commercial (rendre une partie du prix à un Expéditeur mécontent) sans passer par un litige, sans toucher au Voyageur, et sans qu'un seul clic malheureux coûte deux fois.

### Règles de gestion (FIN, suite)
- **RG-FIN-14 — Le rapport date chaque fait à sa propre date** : encaissé au débit, remboursé au remboursement, versé à l'envoi, revenu à la fin du deal, retenue à l'annulation. Un deal peut compter dans deux mois. Par devise, mois UTC.
- **RG-FIN-15 — Le revenu reconnu est la commission plus la prime des deals terminés** ; une retenue conservée, un versement dû, un transfert renversé ou un remboursement proposé sont des passifs, jamais du revenu. Les frais du fournisseur ne sont pas dans Yamba : le comptable les rapproche avec l'export Stripe.
- **RG-FIN-16 — L'export est réservé au profil Finance, borné à un an, et chaque export laisse une ligne au journal** (période, nombre de lignes). Une ligne par deal ayant bougé dans la période, avec les identifiants Stripe.
- **RG-FIN-17 — Un remboursement manuel est un geste commercial, pas une décision de litige** : deal terminé ou annulé seulement, argent débité, plafond = payé − déjà remboursé, motif de 50 caractères au moins. Finance ou Support propose, seul un super administrateur applique. Le Voyageur garde son versement : Yamba porte le geste.
- **RG-FIN-18 — L'Expéditeur est prévenu par l'email standard de remboursement et le voit dans son portefeuille** (part gardée « dépensée », part rendue « remboursée »), y compris pour un remboursement partiel décidé en médiation.

### Recette (FIN, suite)
| # | Scénario | Attendu |
|---|---|---|
| FIN11 | Finance, « Finances » → « Rapport mensuel et export » | Passifs du jour par devise (dû aux Voyageurs = `bzv-completed-blocked`, renversé = `bzv-reversed`, retenues = `bzv-held`) ; tableau par mois avec encaissé / remboursé / versé / revenu / retenues ; « 3 mois » et « 24 mois » changent la période |
| FIN12 | Export CSV du mois courant | Fichier `yamba-finances-<du>-<au>.csv` téléchargé, ouvrable dans Excel (accents corrects), une ligne par deal du seed ayant bougé ; journal « Export finances » avec le nombre de lignes ; Médiateur : pas de bloc export, API 403 |
| FIN13 | Export sur 2 ans | Refusé (400 « 366 days ») |
| FIN14 | Support, fiche argent de `bzv-completed` (versé), carte « Remboursement manuel » | Plafond = total payé ; « Proposer » inactif sous 50 caractères ou au-dessus du plafond ; proposer 5 € → bandeau ambre, tuile « Remboursements proposés » = 1, file « Remboursements proposés » |
| FIN15 | Médiateur sur la même fiche | Voit la proposition, aucun bouton (ni proposer ni appliquer) |
| FIN16 | Super admin, « Rembourser maintenant » 5 € | « Remboursé 5,00 € (cumul 5,00 €) » ; la proposition disparaît ; « Dernier remboursement manuel » affiché ; chronologie : « Remboursé à l'Expéditeur » ; journal « Remboursement manuel appliqué » ; email « Remboursement émis » à l'Expéditeur (`mai`) ; portefeuille Expéditeur : ligne « partiellement remboursé » |
| FIN17 | Rembourser de nouveau au-delà du restant | 400 « At most … cents » ; deal DISPUTED (`bzv-disputed`) : carte « Aucun remboursement manuel possible » |
| FIN18 | Rapprocher `bzv-completed` après FIN16 (Fake) | « Paiement introuvable chez le fournisseur » (intent seedé, hors mémoire du Fake) — attendu ; sur un deal réel Stripe test : aucune divergence, le remboursement apparaît dans « Remboursements » |

# C-PR6a — voir la plateforme bouger : courbes, corridors, et la vie d'un deal

## Le besoin
Savoir chaque semaine si Yamba avance (inscriptions, trajets, demandes, livraisons), où la demande existe sans offre (le corridor cherché qui n'a aucun trajet), et pouvoir dérouler tout ce qui est arrivé à un deal quand un membre appelle — sans passer par les logs. Et donner aux Expéditeurs un signal de popularité honnête sur chaque trajet.

### Règles de gestion (PIL)
- **RG-PIL-01 — Une courbe par mesure, chaque fait à sa date** : une inscription compte à sa date, une demande à sa demande, une livraison à sa livraison. Par semaine (lundi, UTC) ou par mois, périodes vides comprises.
- **RG-PIL-02 — Un corridor est une ville de départ et une ville d'arrivée**, sans distinction de casse ni d'accents. Le tableau montre les trajets publiés, les demandes et leur taux d'acceptation, le prix moyen au kilo, les litiges, les vues et les recherches.
- **RG-PIL-03 — Une recherche sans aucun trajet est comptée comme « demande sans offre »** ; un corridor cherché sans trajet apparaît dans le tableau même s'il n'a jamais eu de trajet. C'est là qu'on recrute des Voyageurs.
- **RG-PIL-04 — Une vue de trajet compte une fois par visiteur et par jour** ; le visiteur n'est jamais identifié (compte connecté ou empreinte technique), rien n'est conservé de son adresse. Le compteur s'affiche sur les cartes de recherche et le détail du trajet ; zéro vue n'affiche rien.
- **RG-PIL-05 — Un compteur ne casse jamais une page** : si Redis est indisponible, la recherche et le détail répondent sans compteur.
- **RG-PIL-06 — « Tout ce qui est arrivé à ce deal » est une lecture** : événements (avec leur état d'envoi : publié, en attente, bloqué), actions admin, notifications, emails, dans l'ordre. Jamais le code de livraison, jamais une photo, jamais une adresse. Consulter est journalisé.
- **RG-PIL-07 — Le pilotage se lit par Finance et Médiateur** ; la chronologie d'un deal par les trois profils. Les chiffres sont rafraîchis au plus toutes les 60 secondes.

### Recette (PIL)
| # | Scénario | Attendu |
|---|---|---|
| PIL01 | Visiteur non connecté, ouvrir deux fois la page publique d'un trajet, puis depuis un autre navigateur | « 1 vue » puis toujours « 1 vue », puis « 2 vues » ; la carte du trajet dans la recherche montre le même nombre |
| PIL02 | Rechercher « Paris → Kinshasa » (aucun trajet) trois fois | Pilotage → Corridors (7 jours) : ligne « paris → kinshasa », 0 trajet, 3 recherches, 3 sans résultat, badge « demande sans offre » (fond ambre) |
| PIL03 | Rechercher « Paris → Brazzaville » | Corridor Paris (FR) → Brazzaville (CG) : trajets, demandes du seed, taux d'acceptation, €/kg moyen, vues, 1 recherche, 0 sans résultat |
| PIL04 | Pilotage, par semaine sur 3 mois | Huit courbes + une par devise ; survol : repère, période et valeur ; « Voir le tableau » : mêmes chiffres ; passer « par mois » ramène 12 mois |
| PIL05 | Recharger dans la minute | Mention « (cache) » ; après 60 s, recalcul |
| PIL06 | Support connecté | Ni « Pilotage » dans le menu ni accès à `/pilotage` (403) ; mais sur une fiche argent, « Charger la chronologie » fonctionne |
| PIL07 | Fiche argent de `bzv-completed`, « Charger la chronologie » | Événements du seed dans l'ordre avec leur état, actions admin (« Fiche argent consultée »…), notifications et emails s'il y en a ; journal « Chronologie consultée » |
| PIL08 | Couper Redis, ouvrir la recherche et un trajet | Pages normales sans compteur ; Pilotage : courbes présentes, corridors sans vues ni recherches |

# C-PR6c — des courbes qu'on ouvre, des finances qu'on voit, une popularité qu'on lit

### Règles de gestion (PIL, suite)
- **RG-PIL-08 — Toute courbe s'agrandit** : en grand, le tableau des valeurs et des variations apparaît dessous, et chaque point ouvre la liste des éléments de la période (comptes, trajets ou deals) avec un lien vers leur fiche ; la liste est bornée à 200 et le dit. Ouvrir une liste d'inscriptions est journalisé.
- **RG-PIL-09 — Le pilotage a un onglet Finances** : encaissé, remboursé, versé, revenu reconnu, retenues nées, par période et par devise, calculés par les mêmes règles que le rapport mensuel ; le rapport reste la référence comptable.
- **RG-PIL-11 — Les périodes se lisent en dates** : une semaine s'affiche « 29 juin → 5 juil. 2026 » (lundi → dimanche), un mois « Juillet 2026 » ; le code ISO (« 2026-W27 ») reste en rappel discret dans le tableau.
- **RG-PIL-10 — La popularité d'un trajet est un badge** : « n vues » sur les cartes et le détail, « Populaire » à partir de 20 vues ; rien n'est affiché à zéro.

### Recette (PIL, suite)
| # | Scénario | Attendu |
|---|---|---|
| PIL09 | Pilotage, courbe « Demandes », « Agrandir » | Courbe pleine largeur, tableau période / valeur / variation dessous, message « Clique un point » |
| PIL10 | Cliquer un point (ou une ligne du tableau) | Panneau « Éléments · 2026-W36 » : deals de la semaine avec statut, montant, date, lien vers la fiche argent ; ligne « n élément(s) » |
| PIL11 | Même geste sur « Inscriptions » | Liste des comptes (prénom + initiale, statut) avec lien vers la fiche ; journal « Liste d'inscriptions consultée (pilotage) » |
| PIL12 | Onglet « Finances » | Cinq courbes en devise (axe en euros), sélecteur de devise s'il y en a plusieurs, mêmes gestes d'agrandissement et de drill-down (deals avec montant) |
| PIL13 | Recherche (desktop et mobile) sur un trajet vu au moins une fois | Pastille grise « n vues » (icône œil) dans la rangée des badges ; à partir de 20 vues, pastille mango « Populaire » |
| PIL14 | Détail public du même trajet | Sous le nom du Voyageur : pastille « n vues » (+ « Populaire » à partir de 20) et « Billet vérifié » si c'est le cas |

# C-PR3bis — un compte, plusieurs casquettes

### Règles de gestion (ADM, suite)
- **RG-ADM-26 — Un compte admin cumule des profils** (au moins un) : ses droits sont l'union des profils ; le super administrateur garde tout. Le profil affiché en premier est le principal (super administrateur d'abord).
- **RG-ADM-27 — L'invitation et la modification cochent les profils** ; l'email d'accès les nomme tous (« Médiateur + Finance »). Retirer l'accès vide tous les profils.
- **RG-ADM-28 — Les gardes ne changent pas** : jamais le dernier super administrateur rétrogradé ou retiré, jamais soi-même ; un compte admin, quel que soit son profil, n'est sanctionné que par un super administrateur.
- **RG-ADM-29 — Les comptes d'avant continuent de fonctionner** ; la reprise pose la liste exacte une fois pour toutes.

### Recette (ADM, suite)
| # | Scénario | Attendu |
|---|---|---|
| ADM31 | Super admin, « Comptes admin », inviter avec Support + Finance cochés | Invitation envoyée ; l'email nomme « Support + Finance » ; la ligne montre les deux cases cochées |
| ADM32 | Connecté avec ce compte | Menu : À arbitrer, Billets, Trajets, Finances, Pilotage, Utilisateurs, Journal ; export finances possible, décision de litige impossible (403) |
| ADM33 | Décocher tous les profils d'une ligne | Impossible (au moins un reste coché) ; décocher SUPER_ADMIN du dernier super admin → 403 « last super administrator » |
| ADM34 | Ajouter Médiateur au compte Support + Finance, se reconnecter | Le formulaire de décision apparaît sur un litige ; libellé « Médiateur + Support + Finance » |
| ADM35 | `grant-admin.ts <email> --roles MEDIATOR,FINANCE` | Profils posés, `adminRole` = Médiateur (principal), `adminRoles` = [Médiateur, Finance] |
| ADM36 | Compte d'avant C-PR3bis (sans liste), avant et après `backfill-admin-roles.ts` | Fonctionne dans les deux cas ; après reprise, la liste est visible et exacte |

# C-PR7a — filtrer, trier, exporter — et savoir qui a exporté quoi

### Règles de gestion (ADM, suite)
- **RG-ADM-30 — Chaque liste admin se filtre côté serveur** (utilisateurs : rôle, état du compte, statut Voyageur, compte Stripe prêt, période d'inscription ; trajets : villes, statut, masqués, masquage proposé, billet à vérifier, Voyageur, période de départ ; billets : villes, période de dépôt, âge ; à arbitrer : type, villes, âge, décidables maintenant), se trie et se charge par pages. Une recherche par identifiant de deal ou ticket renvoie les deux parties, sans autre filtre.
- **RG-ADM-31 — Un export est un fichier CSV des lignes filtrées, borné à 5 000, journalisé** (domaine, filtres, nombre de lignes, qui, quand).
- **RG-ADM-32 — Les exports de trajets, billets et dossiers ne portent ni email ni téléphone** : identifiants seulement. Finance et Médiateur les téléchargent.
- **RG-ADM-33 — L'export des utilisateurs est nominatif : super administrateur seul, motif de 20 caractères au moins écrit au journal.** Le tableur ne peut pas exécuter une formule glissée dans une cellule (préfixes neutralisés).

### Recette (ADM, suite)
| # | Scénario | Attendu |
|---|---|---|
| ADM37 | Utilisateurs : rôle Voyageur + Stripe prêt + tri nom A→Z | Liste filtrée, total affiché, « Charger la suite » si plus de 50 |
| ADM38 | Utilisateurs : « YAM-… » avec des filtres actifs | Les deux parties du dossier, filtres ignorés |
| ADM39 | Finance : bouton d'export sur Utilisateurs | Absent (données personnelles) ; présent sur Trajets, Billets, À arbitrer → fichier téléchargé, journal « Export CSV » avec les filtres et le nombre de lignes |
| ADM40 | Super admin : export Utilisateurs sans motif / motif court | Bouton « Télécharger » inactif ; avec 20 caractères → fichier avec email et téléphone, journal avec le motif |
| ADM41 | Ouvrir un export dans Excel | Accents corrects ; une cellule commençant par « = » ne s'exécute pas |
| ADM42 | Trajets : origine « Paris », départ du 1er au 30, « masquage proposé » | Liste et export cohérents (mêmes filtres) ; le CSV n'a pas d'email |
| ADM43 | Billets : « déposé il y a + de 3 j » | Seuls les billets anciens ; export identique |
| ADM44 | À arbitrer : « décidables maintenant » | Seuls les dossiers tranchables ; compteurs de la file entière inchangés |

# F-PR1 — se retrouver, pas seulement s'écrire

## Le besoin
Après l'acceptation, deux inconnus doivent se retrouver deux fois : pour la remise et pour la livraison. Souvent dans un aéroport, parfois sans données mobiles à l'arrivée. Un fil de discussion seul transfère toute la charge sur eux et produit vingt messages pour fixer un rendez-vous. Yamba structure d'abord le rendez-vous, garde le fil pour le reste, et ouvre le téléphone au bon moment.

### Règles de gestion (FCH)
- **RG-FCH-01 — Un fil par deal, ouvert à l'acceptation.** Avant, la demande porte déjà un message. Un tiers n'y accède jamais.
- **RG-FCH-02 — Le rendez-vous est un objet, pas une phrase** : lieu, créneau, proposé par l'un, accepté par l'autre. Une nouvelle proposition du même type remplace la précédente. On n'accepte pas sa propre proposition. Chaque geste laisse une trace dans le fil.
- **RG-FCH-03 — Un créneau se propose au moins 30 minutes à l'avance**, au plus 90 jours, et dure au maximum 12 heures.
- **RG-FCH-04 — Le code de livraison ne s'écrit jamais** : un message qui le contient est refusé, avec l'explication. Se donne en main propre, jamais par écrit.
- **RG-FCH-05 — Les coordonnées sont repérées, jamais bloquées** : le message part, il est signalé pour l'équipe.
- **RG-FCH-06 — Le numéro de l'autre partie s'ouvre au plus tôt deux heures avant le rendez-vous de remise** (à défaut, avant le départ du trajet), une seule fois, et la révélation est écrite dans le fil.
- **RG-FCH-07 — Pendant un litige, le fil passe en lecture seule** : les échanges passent par la médiation. Après la fin du deal, on peut encore écrire 14 jours, puis le fil reste consultable.
- **RG-FCH-08 — Des réponses rapides sont proposées dans la langue du lecteur** : les mêmes idées existent en français et en anglais.

### Recette (FCH) — `seed-deals.ts` pose un fil sur le deal accepté Paris → Brazzaville
| # | Scénario | Attendu |
|---|---|---|
| FCH01 | Expéditeur `pauline`, ouvrir le fil du deal accepté | Deux messages et une proposition de rendez-vous du Voyageur au terminal 2E |
| FCH02 | Accepter la proposition | Rendez-vous accepté, trace dans le fil ; le Voyageur ne peut pas accepter sa propre proposition (400) |
| FCH03 | Écrire « le code est 742891 » sur un deal pris en charge | Refus 400 avec le motif : le code se donne en main propre |
| FCH04 | Écrire « appelle-moi au 06 12 34 56 78 » | Message envoyé, signalé pour l'équipe |
| FCH05 | Demander le numéro plus de deux heures avant le rendez-vous | Refus, avec l'heure d'ouverture ; après cette heure, le numéro s'affiche et le fil le note |
| FCH06 | Un tiers tente d'ouvrir le fil | 403, pas 404 |
| FCH07 | Fil d'un deal en litige | Lecture possible, écriture refusée |
| FCH08 | Fil d'un deal terminé depuis plus de 14 jours | Lecture seule, date de fermeture affichée |
| FCH09 | Réponses rapides en anglais | Mêmes clés, textes traduits |
| FCH10 | Redpanda arrêté, écrire un message | Le message part, l'événement attend ; au redémarrage il est publié, aucun message perdu, aucun événement parqué |
# C-PR6b — être prévenu avant que ça déborde

### Règles de gestion (ALR)
- **RG-ALR-01 — Neuf règles** *(seuils réglables depuis D62, valeurs d'origine ci-dessous)* : versement en échec depuis plus de 48 h ; litige tranchable sans décision depuis plus de 72 h ; retenue conservée depuis plus de 7 jours ; transfert renversé sans décision depuis plus de 48 h ; événement bloqué après 10 tentatives ; relais en retard de plus de 15 minutes ; emails en échec sur 24 h ; aucun trajet publié depuis 7 jours ; moins de 30 % d'acceptation sur 7 jours (au moins 5 demandes).
- **RG-ALR-02 — Une alerte n'a pas d'état** : elle s'affiche en tête de l'accueil admin tant que sa cause existe, avec un lien vers la file où agir, et disparaît d'elle-même.
- **RG-ALR-03 — Le support reçoit un email à la première apparition d'une règle dans la journée**, jamais plus d'une fois par règle et par jour. Le récapitulatif quotidien « argent à surveiller » continue.
- **RG-ALR-04 — Les seuils sont affichés dans la réponse.** *(Révisée le 06/09/2026 : ils étaient versionnés dans le code ; ils sont **réglables** depuis D62, groupe « Alertes d'exploitation » de la page Paramètres. Les identifiants de règle gardent leur seuil d'origine dans leur nom — `PAYOUT_FAILED_48H` — même après un changement de valeur.)*

### Recette (ALR)
| # | Scénario | Attendu |
|---|---|---|
| ALR01 | Accueil admin après le seed | Bandeau « Alertes de seuil » : au moins « Versements en échec depuis plus de 48 h » (`bzv-completed-blocked`, terminé il y a 3 j) et « Transferts renversés sans décision » ; chaque ligne mène à la file concernée |
| ALR02 | Relancer le versement en échec (Fake → envoyé), revenir à l'accueil | L'alerte a disparu |
| ALR03 | Couper Redpanda (ou le relais), créer une réservation, attendre 16 min | « Relais outbox en retard » ; la relancer fait disparaître l'alerte |
| ALR04 | Cron horaire (à h+5) avec SMTP configuré | Un seul email « Yamba — n alerte(s) » listant les règles nouvelles ; à l'heure suivante, rien tant qu'aucune règle nouvelle n'apparaît |
| ALR05 | Le lendemain, même alerte toujours active | Un nouvel email (une fois par jour) |
| ALR06 | `OPS_ALERTS_CRON_ENABLED=false` | Log « Ops alerts cron disabled » ; l'accueil continue d'afficher les alertes |

# F-PR2 — la messagerie, côté membres

### Règles de gestion (FCH, suite)
- **RG-FCH-09 — La messagerie vit dans le tableau de bord** : la liste des conversations à gauche, le fil à droite, une seule colonne sur mobile.
- **RG-FCH-10 — La bulle du header compte les conversations non lues**, pas les messages : ce qui compte est le nombre d'échanges qui attendent une réponse.
- **RG-FCH-11 — Le fil s'actualise tout seul** pendant qu'on le lit, et s'arrête quand l'onglet passe en arrière-plan.
- **RG-FCH-12 — Quand l'écriture est fermée, l'écran dit pourquoi** : litige en cours, ou fenêtre de quatorze jours écoulée.
- **RG-FCH-13 — Le destinataire reçoit une notification dans l'application dès qu'un message arrive** ; l'email de relance des messages non lus arrive avec le lot suivant.

### Recette (FCH, suite)
| # | Scénario | Attendu |
|---|---|---|
| FCH11 | Se connecter en `pauline`, ouvrir Tableau de bord puis Messages | Le fil seedé apparaît avec le Voyageur, le corridor, le dernier message et le rendez-vous proposé |
| FCH12 | Ouvrir le fil | Deux messages groupés par jour, le panneau « Rendez-vous » en haut avec « À confirmer par vous » |
| FCH13 | Accepter le rendez-vous | Le panneau passe en « Confirmé », une ligne apparaît dans le fil |
| FCH14 | Écrire un message, puis regarder l'autre compte | Le message part ; côté Voyageur, la bulle du header s'incrémente et une notification arrive dans la boîte |
| FCH15 | Utiliser une réponse rapide, changer la langue en anglais | Le texte part comme un message ordinaire ; en anglais, les mêmes propositions sont traduites |
| FCH16 | Écrire « le code est 742891 » | Refus affiché sous la saisie, avec l'explication ; le message n'est pas envoyé |

---

# F-PR2b — les écrans de deal mènent à la conversation

## Le besoin
La messagerie existait, mais rien n'y menait depuis les écrans où l'on en a besoin : les boutons « Message » et « Appeler » des écrans de deal, dessinés dès les lots B3/B4, ne faisaient rien. Un Voyageur qui vient d'accepter un colis doit pouvoir écrire à l'Expéditeur depuis la page du deal, en un geste.

### Règles de gestion (FCH, suite)
- **RG-FCH-14 — Chaque écran de deal mène à la conversation du deal** : « Message » ouvre le fil (ou le crée) et l'affiche, quel que soit le rôle et l'étape (accepté, remise, en transit, livraison, suivi).
- **RG-FCH-15 — « Appeler » ne compose jamais un numéro depuis l'écran de deal** : il ouvre la conversation en mettant le numéro en avant s'il est révélé, ou en expliquant quand il le sera (deux heures avant le rendez-vous confirmé ou le départ). La règle de révélation ne se contourne pas par un bouton.
- **RG-FCH-16 — Tant que le deal n'est pas accepté, le bouton explique** que la conversation s'ouvrira à l'acceptation, et l'utilisateur reste sur sa page.

### Recette (FCH, suite)
| # | Scénario | Attendu |
|---|---|---|
| FCH17 | En `pauline`, ouvrir le tracker du deal `bzv-accepted`, cliquer « Envoyer un message » | La messagerie s'ouvre directement sur le fil du deal, l'URL porte `?conversation=` |
| FCH18 | En Voyageur, ouvrir le deal accepté, cliquer « Appeler » | Le fil s'ouvre avec un bandeau ambre : « Voir le numéro » si la fenêtre est ouverte, sinon l'heure d'ouverture ou l'invitation à confirmer un rendez-vous |
| FCH19 | Une fois le numéro révélé, refaire « Appeler » | Le bandeau montre le numéro, cliquable sur mobile (`tel:`) |

---

# F-PR3 — relance, modération et durée de vie de la messagerie

## Le besoin
Un message non lu doit finir par atteindre son destinataire même s'il n'a pas l'application ouverte ; le support doit pouvoir lire une conversation quand un dossier l'exige, et être alerté quand un membre signale un propos ; et une conversation ne doit pas vivre éternellement.

### Règles de gestion (FCH, suite)
- **RG-FCH-17 — Un message non lu depuis quinze minutes déclenche un email de relance à son destinataire**, au plus un par heure et par conversation, jamais deux fois pour le même message, jamais pour l'auteur ni pour un message automatique.
- **RG-FCH-18 — L'email de relance ne cite jamais le message** : il dit qui a écrit, sur quel trajet, et mène à la conversation.
- **RG-FCH-19 — Un membre peut signaler un message texte de l'autre partie**, une seule fois par message, avec un motif (sortie de Yamba, arnaque, propos déplacés, autre) et des précisions.
- **RG-FCH-20 — Le support et le médiateur peuvent lire une conversation entière depuis un dossier** ; chaque lecture est journalisée ; le numéro de téléphone n'y apparaît jamais, seules les révélations sont tracées.
- **RG-FCH-21 — Un signalement se traite** (« Traité » ou « Sans suite », avec une note) ; la décision est journalisée et un signalement traité ne se retraite pas.
- **RG-FCH-22 — Une conversation est effacée un an après la fin du deal** ou la dernière activité du fil, la plus tardive des deux ; un deal en cours ou en litige n'est jamais purgé ; les signalements survivent à la purge.

### Recette (FCH, suite)
| # | Scénario | Attendu |
|---|---|---|
| FCH20 | En Voyageur (`thomas`), écrire à `pauline` ; ne pas ouvrir le fil côté `pauline` ; attendre 15 à 20 min (cron 5 min, SMTP configuré) | `pauline` reçoit un email « Thomas t'a écrit à propos de Brazzaville → Paris » sans le texte du message, avec un bouton vers le fil |
| FCH21 | Ouvrir le fil côté `pauline` avant les 15 minutes | Aucun email |
| FCH22 | Après l'email, laisser 30 min sans lire, puis Thomas écrit encore | Pas de second email avant une heure après le premier |
| FCH23 | En `pauline`, survoler le message du Voyageur, cliquer le drapeau, choisir « Veut sortir de Yamba », envoyer | « Merci, le signalement est transmis » ; second envoi sur le même message → « Tu as déjà signalé ce message » |
| FCH24 | Admin SUPPORT : accueil | Tuile « Messages signalés » ≥ 1 (le seed en crée un) ; menu « Signalements » ; la file montre le message, le motif, l'auteur |
| FCH25 | Cliquer « Lire la conversation » | Le fil entier, les noms, le rendez-vous, « Personne n'a encore vu le numéro » ; le Journal porte « Conversation consultée » |
| FCH26 | Traiter le signalement avec une note, puis relire la file | Il disparaît de « à traiter », apparaît dans « traité » ; le Journal porte « Message signalé traité » avec la note ; admin FINANCE : ni menu ni tuile |

---

# Fix recette messagerie (#174)

## Le besoin
Première recette de la messagerie sur `dev` : la page des messages ne s'ouvrait pas (erreur de catalogue de traductions) et le service ne démarrait pas (dossier manquant au build). Aucune règle métier nouvelle ; deux lignes de recette pour ne plus repartir sans les vérifier.

### Recette (FCH, suite)
| # | Scénario | Attendu |
|---|---|---|
| FCH31 | Après `npm run dev`, ouvrir `/fr/dashboard/messages` puis `/en/dashboard/messages` | La page s'affiche dans les deux langues, aucun `INVALID_KEY` dans la console |
| FCH32 | Dans le terminal Nx, vérifier la ligne `message-service:build` | ✔ (jamais ✖) et `GET /api/messages/conversations` répond 200 dans le gateway |

---

# F-PR3b — la réponse rapide se relit avant de partir (A142)

## Le besoin
En recette, choisir une réponse rapide envoyait le message aussitôt : un clic sur la mauvaise puce, et le message était parti. Le membre doit rester maître du dernier geste. La question de la suppression d'un message envoyé (« pour moi » / « pour tout le monde ») a été posée en même temps et tranchée : non retenue, le fil est une pièce du dossier de médiation.

### Règles de gestion (FCH, suite)
- **RG-FCH-23 — Aucun message ne part sans un geste d'envoi explicite** : une réponse rapide remplit la zone de saisie (et lui donne le focus) ; le membre relit, modifie s'il veut, puis envoie par le bouton ou la touche Entrée.
- **RG-FCH-24 — Un message envoyé ne se supprime pas**, ni pour soi ni pour l'autre partie : ce qui a été écrit reste lisible par les deux membres, le support et la médiation. Si un retrait est un jour introduit, il sera limité à deux minutes, en effacement logique, sans jamais retirer le texte au dossier (A142).

### Recette (FCH, suite)
| # | Scénario | Attendu |
|---|---|---|
| FCH27 | Dans un fil ouvert, cliquer une réponse rapide | Le texte apparaît dans la zone de saisie, le curseur y est, rien n'est envoyé ; le compteur de l'autre partie ne bouge pas |
| FCH28 | Modifier le texte proposé puis Entrée (ou le bouton) | Le message modifié part ; la zone se vide |
| FCH29 | Cliquer une réponse rapide alors que la zone contient déjà un brouillon | Le brouillon est remplacé par la réponse rapide (pas concaténé) |
| FCH30 | Sur téléphone (ou fenêtre < 1024 px), ouvrir un fil où l'on a écrit | Ses propres bulles (mango, à droite) sont visibles ; le titre du rendez-vous passe à la ligne ; le bouton « Voir le numéro » est dans l'écran ; rien ne déborde à droite |

---

# C-PR8a — les paramètres de la plateforme (D62)

## Le besoin
Le jalon 2 dit « Telama peut ajuster un paramètre seul ». Jusqu'ici, la commission, les planchers, les fenêtres d'annulation et de notation, les délais de la messagerie et les seuils d'alerte étaient des constantes dans le code : chaque réglage était un déploiement. Le back-office doit permettre de régler ce qui est un curseur métier, avec des explications qui évitent les erreurs, sans jamais exposer ce qui protège la plateforme, et sans faux boutons.

### Règles de gestion (PAR)
- **RG-PAR-01 — Trois classes de paramètres.** A : réglable en ligne (les curseurs métier lus par le code et figés dans un snapshot). B : visible dans l'admin mais modifiable par déploiement seulement (sessions, blocages OTP / 2FA / code de livraison, longueurs de motif). C : absent de la page tant que le code ne le lit pas. Un curseur n'existe que si le code le lit.
- **RG-PAR-02 — Deux portées.** Métier (commission, planchers, coefficients, Garantie, annulation, notation, litige, réputation, fenêtres du fil) : super administrateur seul. Exploitation (seuils d'alerte, relance email, conservation des conversations, documents) : profil Exploitation ou super administrateur. La lecture est ouverte à tous les profils.
- **RG-PAR-03 — Les bornes et la cohérence sont refusées par le serveur**, quel que soit le profil : commission 5 à 20 %, plancher 1 à 10 €, S ≤ M ≤ L, plafond de Garantie ≥ prime, niveau top ≥ niveau confirmé, intervalle de relance ≥ délai de relance.
- **RG-PAR-04 — Chaque modification porte un motif de 20 caractères au moins**, s'écrit au journal clé par clé (avant, après, motif, version), et est annoncée par email à tous les super administrateurs. Rien ne se change en silence.
- **RG-PAR-05 — Jamais rétroactif.** Une réservation garde le prix figé à sa création ; un litige ouvert garde son échéance calculée ; le prix comparable d'un trajet déjà publié se recalcule par script.
- **RG-PAR-06 — Le défaut est la valeur du code.** Remettre par défaut, clé par clé ou globalement, est une modification comme une autre (diff affiché, motif, journal, email). Une base de paramètres vide ou illisible reproduit exactement le comportement d'origine.
- **RG-PAR-07 — Une modification se voit dans les 30 secondes** sur tous les services ; deux administrateurs qui écrivent en même temps : le second relit (verrou de version).
- **RG-PAR-08 — Le wizard de réservation calcule avec les valeurs du serveur** ; si un paramètre change entre l'affichage et le paiement, le total attendu ne correspond plus et l'Expéditeur revoit le prix.
- **RG-PAR-09 — Le profil Exploitation** règle les paramètres d'exploitation, lit les indicateurs, et ne touche jamais un paramètre d'argent ni un compte.
- **RG-PAR-10 — Les paramètres qui figurent dans les CGU** (retenue et fenêtre d'annulation, prime et plafond de Garantie, commission, fenêtre de notation) sont marqués : la page prévient qu'il faut mettre le texte à jour.

### Recette (PAR)
| # | Scénario | Attendu |
|---|---|---|
| PAR1 | Super administrateur : menu « Paramètres » | Neuf groupes, chaque ligne avec valeur en vigueur, défaut, portée ; tout est « par défaut » sur une base neuve (version 0) |
| PAR2 | Cliquer le libellé « Commission Yamba » | Panneau d'explication : texte, exemple, bornes, services lecteurs, mention CGU |
| PAR3 | Saisir 15 pour la commission, 4 € pour le plancher | Panneau « À valider » avec le diff (12 % → 15 %, 3,00 € → 4,00 €) et l'aperçu chiffré ; bouton inactif tant que le motif fait moins de 20 caractères |
| PAR4 | Enregistrer avec un motif | « 2 paramètre(s) modifié(s) — version 1 » ; Journal : deux lignes `SETTING_CHANGED` (avant / après / motif) ; chaque super administrateur reçoit l'email « Paramètres de la plateforme modifiés » ; l'accueil admin affiche « Paramètres modifiés le … » |
| PAR5 | Saisir 25 % de commission | Refus 400 « entre 5 et 20 » ; rien n'est écrit |
| PAR6 | Mettre S = 1,5 avec M = 1,1 | Refus 400 « S ≤ M ≤ L » ; rien n'est écrit |
| PAR7 | Deux onglets : modifier dans l'un, puis dans l'autre sans recharger | Le second reçoit 409, la page se recharge, la modification est à refaire |
| PAR8 | Compte OPS (`grant-admin.ts <email> --role OPS`) : page Paramètres | Les lignes métier sont en lecture seule (« super administrateur seul ») ; le seuil « Relais en retard depuis » est modifiable ; enregistrer → version +1, journal |
| PAR9 | Compte FINANCE : page Paramètres | Visible, aucune saisie possible |
| PAR10 | « Tout réinitialiser » | La liste exacte des clés qui vont changer, motif, confirmation ; Journal : `SETTINGS_RESET` par clé ; « toutes les valeurs sont celles par défaut » |
| PAR11 | Commission à 15 % ; côté membre, ouvrir le wizard sur un trajet au kilo | Le récapitulatif affiche 15 % (le total change) ; `GET /api/trips/pricing/params` répond `commissionPct: 15, version: n` |
| PAR12 | Relance messagerie à 5 min / intervalle 10 min ; envoyer un message et ne pas le lire | L'email de relance part entre 5 et 10 min (cron 5 min) au lieu de 15–20 |

---

# C-PR8b — mes données : télécharger, supprimer, être oublié (D63)

## Le besoin
Le règlement donne à chaque membre le droit de récupérer ses données et de faire effacer son compte ; Yamba doit y répondre dans le mois, avec une preuve. Mais un compte n'est pas une page blanche : il porte des réservations payées, des litiges, des avis et des messages qui appartiennent aussi à d'autres. Et le destinataire d'un colis, qui n'a jamais eu de compte, ne doit pas rester dans la base indéfiniment.

### Règles de gestion (RGP)
- **RG-RGP-01 — Un geste sensible se confirme par un code reçu par email** (export, suppression), valable dix minutes, avec les mêmes blocages progressifs qu'un code d'inscription. Il marche pour tous les comptes, avec ou sans mot de passe.
- **RG-RGP-02 — Le membre télécharge un fichier de ce qui lui appartient** : profil, adresses, consentements, préférences, trajets, réservations (son rôle et ses montants), avis donnés et avis reçus révélés, messages écrits, rendez-vous, révélations de numéro, alertes, favoris, abonnements, notifications, signalements faits. Jamais les coordonnées de l'autre partie, jamais le code de livraison, jamais les signalements qui le visent ni les dossiers de médiation. Une fois par 24 heures.
- **RG-RGP-03 — La suppression est immédiate et irréversible**, après le code et le mot SUPPRIMER tapé. Elle est refusée tant qu'un deal vit (accepté, en transit, livré, en litige), qu'une demande attend une réponse, qu'un versement est dû ou en échec, qu'une retenue est en médiation, qu'un trajet est publié ou en pause, ou que le compte porte un profil administrateur. Les motifs sont dits au membre.
- **RG-RGP-04 — Supprimer, c'est anonymiser sans casser le dossier** : identité, coordonnées, mot de passe, date de naissance, adresses, avatar, connexions Google, alertes, favoris, abonnements, notifications et justificatifs sont effacés ; les réservations, litiges, avis, messages, rendez-vous, signalements et le journal admin restent, l'auteur devenant « Membre supprimé ». Le compte Stripe Connect n'est pas supprimé par Yamba (obligations comptables) ; son identifiant est conservé à part, sans nom.
- **RG-RGP-05 — Après la suppression, plus rien ne part** : aucune session, aucun email, aucune relance. Un email de confirmation, sans lien ni code, est envoyé à l'ancienne adresse.
- **RG-RGP-06 — Le destinataire d'un colis est oublié 30 jours après la fin du deal** (nom, téléphone, email effacés de la réservation), jamais avant : un litige ou une preuve de remise peut en avoir besoin. Le délai est un paramètre d'exploitation.
- **RG-RGP-07 — Chaque demande est inscrite au registre** (export ou effacement, par le membre ou par l'admin, faite ou refusée avec ses motifs, date, adresse IP) : c'est la preuve du délai légal.
- **RG-RGP-08 — Le profil Données personnelles** lit le registre, efface un compte à la demande d'un membre reçue par email (motif au journal, mêmes refus) et fait l'export nominatif (au lieu du super administrateur seul, A143). Il se confie comme un super administrateur. Personne n'efface son propre compte depuis le back-office.
- **RG-RGP-09 — Le membre choisit de ne plus recevoir la relance email** des messages non lus (bascule dans Sécurité) ; la notification in-app reste.

### Recette (RGP)
| # | Scénario | Attendu |
|---|---|---|
| RGP1 | Membre : Sécurité → « Télécharger mes données » → « M'envoyer le code » | Email « Ton code de confirmation Yamba » ; saisir le code → un fichier `yamba-mes-donnees-<date>.json` se télécharge |
| RGP2 | Ouvrir le fichier | `format: yamba-data-export/1` ; ses réservations avec `role` ; côté Voyageur aucune clé `recipient` ; aucun `deliveryCode` ; ses messages seulement |
| RGP3 | Recommencer dans l'heure | Refus « One export per 24 hours » |
| RGP4 | Membre avec un deal accepté : « Supprimer mon compte » | Bandeau ambre « Impossible pour l'instant » avec « Un deal est en cours » ; pas de saisie de code |
| RGP5 | Membre sans deal vivant : code + SUPPRIMER | Déconnexion immédiate, retour à l'accueil ; la connexion avec l'ancien email/mot de passe échoue ; email « Ton compte Yamba a été supprimé » |
| RGP6 | Admin : fiche du membre effacé | Nom « Membre supprimé », email `erased+…@anonymised.invalid`, aucune adresse ni justificatif ; ses deals toujours listés |
| RGP7 | L'autre partie ouvre la conversation du deal | Le fil est intact, la contrepartie s'affiche « Membre supprimé » ; « Voir le numéro » n'a plus de numéro à montrer |
| RGP8 | Admin PRIVACY (`grant-admin.ts <email> --role PRIVACY`) : menu « Données personnelles » | Registre avec l'export (faite), l'effacement refusé (deal en cours) et l'effacement fait ; Journal : « Registre RGPD consulté » |
| RGP9 | PRIVACY : fiche d'un membre, carte « Effacer ce compte (RGPD) », motif + EFFACER | Effacé ; Journal « Compte effacé (RGPD) » avec le motif ; registre : canal « par l'admin (Prénom I.) » |
| RGP10 | PRIVACY : Utilisateurs → export nominatif | Autorisé (A143), motif au journal ; FINANCE : refusé |
| RGP11 | Sécurité → bascule « Relance par email » désactivée ; recevoir un message et ne pas le lire 20 min | Aucun email de relance ; la notification in-app est là |
| RGP12 | `seed-deals.ts` puis passer `privacy.recipientRetentionDays` à 7 j et lancer le cron (ou attendre 03:40) | Les deals terminés depuis plus de 7 j ont `recipient` = « — / — / +00000000000 » et `recipientRedactedAt` ; les deals vivants sont intacts |

---

# C-PR8c — voir une panne avant l'utilisateur, fermer proprement, ne rien garder pour rien (D64)

## Le besoin
Le jalon 2 dit « voir une erreur avant l'utilisateur » et « opérer seul ». Il manquait trois choses : savoir en un coup d'œil si les services et leurs crons vivent, pouvoir fermer la plateforme proprement le temps d'une intervention (sans couper la lecture ni le back-office), et enfin chiffrer ce qu'on garde et combien de temps.

### Règles de gestion (MNT)
- **RG-MNT-01 — Deux interrupteurs de maintenance.** L'état planifié se règle dans l'admin (profil Exploitation ou super administrateur, motif au journal, email aux super administrateurs) ; l'environnement du gateway l'emporte le jour où la base elle-même est en panne.
- **RG-MNT-02 — La maintenance est une lecture seule.** Les membres consultent, rien ne s'écrit (réservation, publication, message : refus « réessaie dans quelques minutes ») ; la connexion et le back-office restent ouverts pour pouvoir la lever.
- **RG-MNT-03 — Une maintenance s'annonce.** Une date d'annonce affiche un bandeau sur les deux fronts avant la coupure, sans rien bloquer.
- **RG-MNT-04 — Chaque service dit s'il est en forme** : joignable, base et Redis accessibles, version, démarré depuis. Un service qui répond « dégradé » est vivant mais à surveiller.
- **RG-MNT-05 — Un cron laisse une trace de chaque passage** (quand, combien de temps, ce qu'il a fait, ou l'erreur). Un cron sans battement depuis deux fois son intervalle est signalé « en retard ».
- **RG-MNT-06 — La page d'état n'est pas une supervision.** Elle répond à « est-ce nous, et où » quand on l'a sous les yeux ; un moniteur externe reste nécessaire avant le lancement pour être prévenu quand personne ne regarde.
- **RG-MNT-07 — Conservation chiffrée** : notifications in-app 1 an, traces d'emails 1 an, événements consommés 90 jours, événements d'outbox publiés 90 jours (jamais un événement parqué), conversations 1 an (D61), tiers destinataire 30 jours (D63), journal admin jamais. Toutes réglables par le profil Exploitation.

### Recette (MNT)
| # | Scénario | Attendu |
|---|---|---|
| MNT1 | Admin : menu « État des services » | Six cartes vertes (gateway, auth, trip, deal, notification, message) avec Mongo et Redis « ✓ », version, démarré depuis ; outbox et emails 24 h ; relu toutes les 30 s |
| MNT2 | Arrêter le message-service, attendre 30 s | Sa carte passe rouge « Injoignable », le bandeau du haut liste le service |
| MNT3 | Couper Redis, attendre 30 s | Les cartes passent ambre « Dégradé » avec « ✗ redis » |
| MNT4 | Après un passage de cron (ex. relance à H:00 ou H:05) | Ligne dans « Crons — dernier battement » avec la durée et le résumé (« 0 relance(s), 0 échec ») |
| MNT5 | OPS : annoncer une maintenance pour dans 1 h avec un message FR/EN et un motif | Les deux fronts affichent le bandeau ambre avec la date et le message ; rien n'est bloqué ; Journal « État de maintenance modifié » ; email aux super administrateurs |
| MNT6 | OPS : activer la lecture seule | Bandeau rouge côté membres ; un membre peut chercher et lire un fil, mais réserver / envoyer un message répond « La plateforme est en maintenance » (503) ; la connexion marche ; l'admin fonctionne |
| MNT7 | Lever la maintenance | Écritures possibles dans les 10 s, bandeau disparu |
| MNT8 | `MAINTENANCE_MODE=on` dans l'environnement du gateway, redémarrer le gateway | Lecture seule immédiate, badge « forcée par l'environnement » sur la page d'état, l'admin ne peut pas la lever depuis la page |
| MNT9 | FINANCE : page « État des services » | Visible ; l'éditeur de maintenance dit « Profil Exploitation ou super administrateur pour modifier » |
| MNT10 | Paramètres : `retention.notificationsDays` à 30, puis lancer le cron du notification-service (03:50) | Les notifications de plus de 30 jours disparaissent ; les événements d'outbox parqués sont intacts ; battement « retention » avec les trois compteurs |

---

# D35 — un fournisseur d'email, et savoir quand un email n'arrive pas

## Le besoin
Jusqu'ici Yamba envoyait ses emails par un serveur SMTP nu (Gmail en recette) et n'apprenait jamais qu'une adresse était morte ou qu'un membre s'était plaint : on continuait d'écrire dans le vide, au détriment de la réputation d'envoi. Pour le lancement, il faut un fournisseur transactionnel qui livre, qui dit ce qu'il advient de chaque email, et une règle pour cesser d'écrire à qui ne veut plus ou ne peut plus lire.

### Règles de gestion (EML)
- **RG-EML-01 — Un fournisseur derrière une interface** : Resend en production (Europe), un serveur SMTP si l'entreprise en impose un, un faux en développement et en tests. Le faux est refusé en production : la plateforme ne démarre pas sans fournisseur réel.
- **RG-EML-02 — Chaque email envoyé garde l'identifiant du fournisseur** et une clé d'idempotence : un événement rejoué n'envoie jamais deux fois.
- **RG-EML-03 — Le fournisseur nous dit ce qu'il advient** : livré, rebondi, plainte. Un message signé et daté ; un message non signé ou de plus de cinq minutes est refusé ; un message inconnu ou déjà appliqué est accepté sans effet.
- **RG-EML-04 — Un rebond dur ou une plainte met l'adresse sur la liste de suppression** : plus aucun email ne part vers ce compte (notifications de deal, relance de messages, alertes route, versements, sanctions), la notification in-app continue. Un rebond transitoire (boîte pleine) ne supprime rien.
- **RG-EML-05 — Le support lève une suppression** après correction de l'adresse, geste journalisé. Une adresse supprimée se voit sur la fiche du membre avec son motif.
- **RG-EML-06 — Les rebonds comptent dans l'alerte « emails en échec »** (D59) : une vague de rebonds est un incident, pas un bruit.
- **RG-EML-07 — En recette, les emails se lisent dans Mailpit**, jamais sur une vraie boîte.

### Recette (EML)
| # | Scénario | Attendu |
|---|---|---|
| EML1 | `docker compose up -d`, `EMAIL_PROVIDER=smtp`, `SMTP_HOST=localhost`, `SMTP_PORT=1025` ; s'inscrire | Le code OTP apparaît dans http://localhost:8026 |
| EML2 | Sans variable email, en développement, accepter un deal | Le service log « [email:fake] → … » ; `EmailDelivery` en SENT avec `provider: FAKE` |
| EML3 | `NODE_ENV=production` sans `RESEND_API_KEY` ni `SMTP_HOST` | Le service refuse de démarrer (« FAKE provider is refused in production ») |
| EML4 | `EMAIL_PROVIDER=resend` avec une clé de test ; accepter un deal | L'email arrive à l'adresse du compte Resend ; `EmailDelivery` porte `provider: RESEND` et `providerMessageId` |
| EML5 | Depuis le tableau Resend, rejouer le webhook `email.delivered` | `EmailDelivery` passe DELIVERED avec `deliveredAt` ; rejouer une seconde fois → 200 sans changement |
| EML6 | Envoyer à `bounced@resend.dev` (adresse de test) | Webhook `email.bounced` : trace BOUNCED, `User.emailSuppressedAt` posé, fiche admin avec le bandeau ambre « rebond dur » |
| EML7 | Relancer un message non lu vers ce membre | Aucun email ; la notification in-app est là |
| EML8 | Fiche admin (SUPPORT) : « Lever (adresse corrigée) » | Bandeau disparu, Journal « Suppression d'adresse levée », les emails repartent |

---

# D65 — mes appareils, mon mot de passe, mon adresse (solde D27)

## Le besoin
Un membre doit voir où son compte est connecté, couper un appareil qu'il ne reconnaît pas, et changer son mot de passe ou son adresse sans passer par le support — mais un geste aussi sensible ne doit jamais être possible à quelqu'un qui aurait simplement trouvé une session ouverte. D27 l'avait décidé (sudo, visibilité des sessions) ; l'écran Sécurité était encore une maquette.

### Règles de gestion (SES)
- **RG-SES-01 — Un geste sensible exige un code reçu par email**, même en session active : changer le mot de passe, changer l'adresse, ouvrir le tableau de bord Stripe (IBAN), télécharger ses données, supprimer son compte. Le code ouvre une fenêtre de 15 minutes sur cet appareil seulement.
- **RG-SES-02 — Le membre voit ses appareils** : navigateur et système, dernière activité, adresse IP, « connexion mémorisée », celui en cours. Il en déconnecte un, ou tous les autres. Un appareil déconnecté doit se reconnecter.
- **RG-SES-03 — Changer de mot de passe ferme tous les autres appareils** et envoie un email de confirmation. Le nouveau mot de passe respecte les règles de force et diffère de l'actuel. Un compte créé avec Google peut se donner un mot de passe.
- **RG-SES-04 — Changer d'adresse se fait en deux temps** : la nouvelle adresse reçoit un code (valable 10 minutes), la confirmation applique le changement, ferme les autres appareils et prévient l'ancienne adresse. Une adresse déjà utilisée par un autre compte est refusée. La connexion Google, si elle existe, continue de fonctionner.
- **RG-SES-05 — Les appareils connectés avant ce lot** apparaissent « Appareil inconnu » jusqu'à leur prochaine connexion.

### Recette (SES)
| # | Scénario | Attendu |
|---|---|---|
| SES1 | Sécurité → « Appareils connectés » | Cet appareil est listé (navigateur · système, dernière activité, « cet appareil ») |
| SES2 | Se connecter depuis un second navigateur, revenir sur le premier | Deux appareils ; « Déconnecter » sur le second → il est renvoyé à la connexion à sa prochaine action |
| SES3 | « Déconnecter les autres appareils » | Message « n appareil(s) déconnecté(s) » ; seul cet appareil reste |
| SES4 | Mot de passe → « Changer » sans code | La porte s'ouvre : « M'envoyer le code » ; email « Ton code de confirmation Yamba » ; le code accepté ouvre la fenêtre et le changement passe |
| SES5 | Dans les 15 minutes, changer l'adresse email | Aucun nouveau code demandé (fenêtre ouverte) ; la nouvelle adresse reçoit « Confirme ta nouvelle adresse » |
| SES6 | Saisir le code reçu sur la nouvelle adresse | Adresse changée, `/auth/me` renvoie la nouvelle ; l'ancienne reçoit « L'adresse email de ton compte a changé » ; les autres appareils sont déconnectés |
| SES7 | Demander une adresse déjà prise par un autre compte | Refus « déjà utilisée par un autre compte » |
| SES8 | Mot de passe identique à l'actuel, ou trop faible | Refus explicite (code A51) |
| SES9 | Finances → « Ouvrir Stripe Dashboard » après 15 minutes | La porte s'ouvre ; après le code, le tableau de bord s'ouvre dans un nouvel onglet |
| SES10 | Mes données → « Télécharger » | Même porte ; plus de saisie de code dans le formulaire lui-même |

---

# D66 — mesurer l'usage, avec l'accord du membre (met en œuvre D5)

## Le besoin
Le jalon 2 et le chantier H attendent des chiffres réels : où les visiteurs abandonnent entre la recherche et le paiement, quels corridors sont regardés, combien de trajets publiés aboutissent. Le pilotage admin (D59) donne l'exploitation, pas le funnel. Il faut une mesure d'audience — et elle ne se fait qu'avec l'accord de la personne, sans jamais transmettre qui elle est.

### Règles de gestion (ANA)
- **RG-ANA-01 — Rien ne se mesure sans accord.** Une bannière propose « Accepter » et « Refuser » à égalité, avec un lien vers la politique de confidentialité. Le choix vaut six mois sur l'appareil ; pour un membre, il est écrit sur son compte et tracé (accord et retrait).
- **RG-ANA-02 — Refuser ne coûte rien** : aucun script de mesure n'est chargé, aucune requête ne part, le site fonctionne à l'identique.
- **RG-ANA-03 — Le membre change d'avis quand il veut** dans Sécurité › Mes données ; le retrait est tracé comme l'accord.
- **RG-ANA-04 — Jamais une donnée personnelle** : le membre est désigné par son identifiant technique, jamais par son nom, son email ou son téléphone ; les événements portent des corridors, des montants, des statuts. Le destinataire d'un colis et le code de livraison n'y figurent jamais.
- **RG-ANA-05 — Deux sources, deux usages** : les chiffres d'exploitation (pilotage admin) sont calculés par Yamba ; la mesure d'audience sert aux funnels, à la rétention et aux cohortes. On ne compare pas l'un à l'autre.
- **RG-ANA-06 — Données en Europe** (PostHog Cloud EU), sans enregistrement de session ni carte de chaleur.

### Recette (ANA)
| # | Scénario | Attendu |
|---|---|---|
| ANA1 | Navigateur neuf, `NEXT_PUBLIC_POSTHOG_KEY` posée, ouvrir le site | Bannière « Mesure d'audience » en bas, deux boutons de même poids, lien « En savoir plus » |
| ANA2 | « Refuser » puis naviguer, rechercher | Aucune requête vers `eu.i.posthog.com` (onglet réseau), bannière disparue |
| ANA3 | Vider le stockage, « Accepter », rechercher Paris → Dakar, ouvrir un trajet, commencer une réservation | Requêtes vers PostHog : `$pageview`, `search_performed` (origine, destination, nombre de résultats), `trip_viewed`, `booking_step_viewed` ; aucune propriété ne contient un nom ou un email |
| ANA4 | Se connecter (membre ayant accepté) | `identify` avec l'identifiant du compte uniquement ; le compte porte `analyticsOptIn: true` et une ligne ConsentLog COOKIES |
| ANA5 | Sécurité › Mes données → bascule « Mesure d'audience » désactivée | Plus aucune requête ; le compte passe à `false`, la ligne COOKIES est révoquée |
| ANA6 | Membre ayant accepté, sur un autre appareil neuf | Pas de bannière : le choix du compte est repris |
| ANA7 | Serveur avec `POSTHOG_API_KEY` : accepter un deal dont l'Expéditeur a consenti et le Voyageur non | Un seul événement `booking.accepted` (rôle SHIPPER) chez PostHog ; rejouer l'événement outbox ne crée pas de doublon |
| ANA8 | Sans clé PostHog | Aucune bannière, aucun envoi, aucun log d'erreur |

---

# D67 — le membre tient son profil (chantier E)

## Le besoin
La page publique d'un membre (D28) est lue par les autres avant de réserver ou d'accepter un deal, mais son propriétaire ne pouvait rien y changer : l'écran « Profil » du tableau de bord était une maquette. Le membre doit pouvoir mettre une photo, corriger son nom, se présenter s'il voyage, et décider ce qu'il montre — sans jamais pouvoir se faire passer pour un autre ni casser les liens vers sa page.

### Règles de gestion (PRO)
- **RG-PRO-01 — Le membre modifie prénom et nom** (2 à 40 caractères chacun). Son adresse de page (`/u/<slug>`) ne change jamais : les liens partagés restent valides (D28).
- **RG-PRO-02 — Nom affiché et présentation sont réservés aux Voyageurs** : ils décrivent la page Voyageur (présentation de 300 caractères au plus). Un Expéditeur pur n'a pas ces champs.
- **RG-PRO-03 — La date de naissance est privée** : jamais affichée, elle doit être passée et donner 16 ans au moins ; elle pré-remplit l'identité Stripe du Voyageur.
- **RG-PRO-04 — La photo est la sienne** : image de 2 Mo au plus (JPEG, PNG, WebP), hébergée chez Yamba ; une URL étrangère est refusée ; changer ou retirer la photo supprime l'ancien fichier ; l'effacement RGPD la supprime aussi.
- **RG-PRO-05 — Page masquée** : le membre peut rendre sa page invisible ; les autres reçoivent « page introuvable », lui la voit avec la mention « masquée ». Ses trajets publiés restent visibles avec son prénom — masquer sa page n'est pas se cacher d'un deal.
- **RG-PRO-06 — Ville facultative** : le membre choisit d'afficher ou non sa ville sur sa page.
- **RG-PRO-07 — Le membre voit ce que les autres voient** : « Voir mon profil public » ouvre sa page telle qu'elle est servie.

### Recette (PRO)
| # | Scénario | Attendu |
|---|---|---|
| PRO1 | Tableau de bord › Profil, Expéditeur pur | Avatar (initiale), prénom, nom, date de naissance, deux bascules ; pas de « nom affiché » ni de « présentation » |
| PRO2 | Même écran, Voyageur avec page | Champs « nom affiché » et « présentation » (compteur /300) en plus, bouton « Voir mon profil public » |
| PRO3 | Prénom « A » puis Enregistrer | Erreur sous le champ, rien n'est écrit |
| PRO4 | Date de naissance il y a 12 ans | « Il faut avoir 16 ans au moins », rien n'est écrit |
| PRO5 | Ajouter une photo de 3 Mo | « Photo trop lourde », aucune requête serveur ; une photo de 500 Ko → avatar affiché ici, sur la page publique et dans le header |
| PRO6 | Changer la photo puis la retirer | L'ancien fichier n'existe plus chez ImageKit ; l'initiale revient |
| PRO7 | Désactiver « Page publique », ouvrir `/u/<slug>` depuis un autre compte et depuis le sien | Autre compte : « page introuvable » (404) ; soi-même : page avec la mention « masquée » ; un trajet publié reste ouvrable |
| PRO8 | Désactiver « Afficher ma ville » | La ville disparaît de la page publique ; réactiver la remet |

---

# D68 — signaler un trajet ou un membre (micro-PR confiance, lot 1)

## Le besoin
Les règles SIG-01 à SIG-04 existaient depuis D26, la file admin depuis D61 pour les messages, mais un membre qui tombait sur une annonce louche ou un profil douteux cliquait « Signaler » dans le vide. Il faut que le geste existe, qu'il soit signé, qu'il n'ait aucun effet automatique et que le support le voie avec ce qu'il faut pour décider.

### Règles de gestion (SIG, complétées)
- **RG-SIG-05 — Un seul geste, deux cibles** : depuis une annonce ou un profil public, un membre connecté signale avec un motif fermé propre à la cible (annonce : contenu illicite, arnaque, inapproprié, autre ; profil : arnaque, inapproprié, usurpation, autre) et des précisions facultatives. Un visiteur est invité à se connecter : un signalement est toujours signé.
- **RG-SIG-06 — Pas de signalement contre soi-même**, et pas deux signalements ouverts du même auteur sur la même cible. Une cible invisible (annonce supprimée, membre effacé ou page masquée) est « introuvable ».
- **RG-SIG-07 — Accusé de réception, jamais la suite** : l'auteur reçoit un email « merci, on regarde » ; il n'apprend pas la décision, et la personne signalée n'apprend jamais qui l'a signalée.
- **RG-SIG-08 — Revue prioritaire à trois** : à partir de trois signalements ouverts sur une même cible, la ligne est marquée prioritaire dans la file. Aucune sanction automatique : masquer l'annonce ou sanctionner le compte reste une décision du support, journalisée.
- **RG-SIG-09 — Le support décide en deux gestes** : « Traité » quand il a agi, « Sans suite » sinon, avec une note au journal. Un signalement traité ne se retraite pas.
- **RG-PRO-08 (D28) — Les statuts d'un trajet disent son effet** : « En ligne » (visible des Expéditeurs) et « Masqué » (invisible), actions « Masquer » et « Remettre en ligne ».

### Recette (SIG)
| # | Scénario | Attendu |
|---|---|---|
| SIG1 | Visiteur non connecté, annonce publique, « Signaler cette annonce » | Porte « Connecte-toi pour signaler » ; après connexion, retour sur l'annonce |
| SIG2 | Membre connecté, annonce d'un autre, motif « Arnaque suspectée » + précisions, envoyer | « Merci, ton signalement est bien reçu », email « Ton signalement a bien été reçu » dans sa langue ; rien ne change sur l'annonce |
| SIG3 | Même membre, même annonce, signaler à nouveau | « Tu as déjà signalé cet élément » |
| SIG4 | Propriétaire de l'annonce | Aucun bouton « Signaler » sur sa propre annonce ; sur son propre profil non plus |
| SIG5 | Profil public d'un membre, « Signaler ce profil », motif « Usurpation d'identité » | Reçu ; le profil signalé ne voit rien, aucune notification pour lui |
| SIG6 | Admin SUPPORT, `/reports` | Deux files : « Trajets et membres » (corridor cliquable, « publié par … », auteur, motif) et « Messages » ; carte d'accueil « Trajets et membres signalés » |
| SIG7 | Trois membres différents signalent la même annonce | La ligne porte « Prioritaire · 3 ouverts » ; l'annonce reste en ligne tant que le support ne la masque pas |
| SIG8 | « Sans suite » avec une note, puis retenter | Journal `REPORT_REVIEWED` avec la note ; deuxième décision refusée (409) |
| PRO9 | Mes trajets, un trajet publié puis masqué | Badges « En ligne » puis « Masqué », actions « Masquer » / « Remettre en ligne », toasts « Trajet masqué » / « Trajet remis en ligne » (EN : Online / Hidden) |

---

# D69 — la page destinataire (micro-PR confiance, lot 2)

## Le besoin
Le destinataire d'un colis n'a pas de compte : il apprend l'arrivée par l'Expéditeur, souvent par un message improvisé, et Yamba ne lui dit jamais d'où viennent son prénom et son numéro alors que RGP-02 l'exige. Il faut un lien de suivi que l'Expéditeur partage, qui montre la progression sans rien révéler de sensible, qui meurt avec l'effacement du tiers, et qui présente Yamba à quelqu'un qui ne la connaît pas encore.

### Règles de gestion (DES)
- **RG-DES-01 — Un lien par envoi, créé par l'Expéditeur** dès l'acceptation, jusqu'à la fin du deal. Le Voyageur ne le crée pas. Avant l'acceptation ou après une annulation, il n'y a rien à suivre.
- **RG-DES-02 — Le destinataire voit peu** : les prénoms, le prénom et l'initiale du Voyageur, le corridor, les dates, et où en est le colis (pris en charge, récupéré, en route, arrivé, remis, ou annulé). Jamais une adresse, un numéro, le code de livraison, une photo ou un montant.
- **RG-DES-03 — Le lien meurt avec l'effacement** : dès que le tiers est effacé de la réservation (30 jours après la fin, paramètre `privacy.recipientRetentionDays`), le lien répond « plus valide ». Même réponse pour une réservation supprimée ou un lien retiré : on ne distingue pas.
- **RG-DES-04 — Yamba n'envoie rien au destinataire** : l'Expéditeur partage lui-même (WhatsApp vers le numéro qu'il a saisi, SMS, copie). Un SMS sortant par Yamba est une porte.
- **RG-DES-05 — La page dit d'où viennent les données** (RGP-02) : « {Expéditeur} a confié ton prénom et ton numéro à Yamba pour cette livraison, et à personne d'autre », avec le lien vers la politique de confidentialité.
- **RG-DES-06 — La page présente Yamba** : elle se termine par « Toi aussi, envoie ou transporte » vers la recherche et l'inscription Voyageur. Elle n'est pas indexée par les moteurs.
- **RG-VOC-01 (A144) — Un mot par rôle, partout** : Voyageur et Expéditeur en français, Traveler et Shipper en anglais, écrans, emails et messages pré-remplis compris.

### Recette (DES)
| # | Scénario | Attendu |
|---|---|---|
| DES1 | Expéditeur, deal accepté, carte « Partage le suivi à {prénom} », « Copier le message » | Message avec le lien `/track/…` copié ; le même lien au second clic |
| DES2 | « WhatsApp » | WhatsApp s'ouvre sur le numéro saisi à la réservation, message pré-rempli |
| DES3 | Ouvrir le lien dans une fenêtre privée (aucun compte) | Page « Ton colis arrive, {prénom} », corridor, dates, jalon « Colis pris en charge », frise, mention RGP-02, bloc « Toi aussi » |
| DES4 | Voyageur : récupération, puis jalons de transit, puis remise avec le code | La page passe à « récupéré », « en route », « arrivé » (avec le conseil du code), « remis », avec les heures |
| DES5 | Le Voyageur appelle `POST /deals/:id/tracking-link` | 403 ; un deal en attente → 409 `TRACKING_NOT_AVAILABLE` |
| DES6 | Chercher dans la page une adresse, un numéro, le code | Absents de la page et de la réponse API |
| DES7 | Après le cron d'effacement du tiers (ou `recipientRedactedAt` posé à la main) | « Ce lien de suivi n'est plus valide », bloc « Toi aussi » conservé |
| DES8 | Tracker en transit, carte destinataire | Le vrai numéro saisi à la réservation (Appeler / WhatsApp), plus le numéro factice |
| VOC1 | Email « profil actif » d'un Voyageur, parcours de réservation en anglais, Mes trajets | « Voyageur » / « traveler » partout, plus aucun « Tripper », « traveller » ni « transporteur » |

---

# D70 — savoir que Yamba est tombé (moniteur externe)

## Le besoin
La page d'état admin dit comment vont les services à qui la regarde. Personne ne la regarde à 3 h du matin, et Sentry ne voit que les erreurs, pas le silence. Avant le lancement, il faut qu'un tiers sonde Yamba en permanence et prévienne quand elle ne répond plus, quand un service a perdu sa base, ou quand un cron qui verse l'argent s'est arrêté sans bruit.

### Règles de gestion (MON)
- **RG-MON-01 — Une adresse publique dit si Yamba va bien** : `/api/status` répond « ok », « maintenance », « dégradé » ou « en panne ». Les deux premiers valent 200, les deux derniers 503 : le moniteur alerte sur le code, pas sur le texte.
- **RG-MON-02 — Une maintenance planifiée n'est pas une panne** : pendant la lecture seule décidée par l'admin, la sonde répond 200 « maintenance » et personne n'est réveillé.
- **RG-MON-03 — La sonde ne révèle rien** : ni adresse interne, ni message d'erreur, ni quelle dépendance manque. Elle est publique et mise en cache 10 secondes.
- **RG-MON-04 — Les fronts comptent aussi** : le site et l'admin répondent chacun à `/api/health`.
- **RG-MON-05 — Un cron mort se voit** : chaque cron enveloppé peut envoyer un battement au moniteur après un tour réussi ; l'absence de battement déclenche l'alerte. Quatre crons sont prioritaires : versement J+4, expiration 24 h, relance des messages non lus, alertes de seuil.
- **RG-MON-06 — Le compte et les alertes sont à la main du fondateur** ; Yamba fournit les adresses, les codes attendus et le runbook.

### Recette (MON)
| # | Scénario | Attendu |
|---|---|---|
| MON1 | `curl -i http://localhost:8080/api/status`, tout tourne | 200, `status: "ok"`, cinq services `reachable: true`, aucun champ `url` ni `error` |
| MON2 | Arrêter message-service, rappeler après 10 s | 503, `status: "down"`, `message-service.reachable: false` |
| MON3 | Couper Redis (ou `REDIS_DATABASE_URI` faux) sur un service | 503, `status: "degraded"` |
| MON4 | Activer la maintenance depuis l'admin, service arrêté ou non | 200, `status: "maintenance"` |
| MON5 | `curl -i http://localhost:3000/api/health` et `:3001/api/health` | 200, `app` = user-ui / admin-ui |
| MON6 | `CRON_HEARTBEAT_PING_URLS` vers une URL de test (webhook.site), attendre un tick de `expire-bookings` | Un GET reçu à chaque tour ; sans la variable, aucun appel sortant |

---

# A145 — le contrat d'auth-service, écrit et vérifié

## Le besoin
Quatre services sur cinq publiaient leur contrat OpenAPI depuis les schémas Zod ; auth-service, le premier que tout client appelle (inscription, connexion, session), n'avait plus rien depuis le retrait du Swagger historique. Le chantier mobile (D36) se construira sur un client généré : sans ce contrat, il ne démarre pas, et un partenaire ou un nouveau développeur devait lire les contrôleurs.

### Règles de gestion (API)
- **RG-API-01 — Chaque route montée est documentée, aucune route documentée n'est inventée** : un test lit les routeurs et refuse l'écart dans les deux sens.
- **RG-API-02 — Le contrat dit la vérité des erreurs** : 401 session, 403 sudo requis ou permission manquante, 404 qui ne révèle rien (page masquée, membre effacé), 409 conflit typé, 429 verrou OTP.
- **RG-API-03 — Chaque route admin porte sa permission** (`x-permission`), la même que la matrice qui la garde.
- **RG-API-04 — Le document est généré, jamais édité** : `npm run generate:openapi`, et la CI refuse un document en retard.

### Recette (API)
| # | Scénario | Attendu |
|---|---|---|
| API1 | Ouvrir `http://localhost:6001/docs` | Visionneuse Scalar, huit groupes (auth, me, carrier, saved-routes, users, reports, admin-auth, admin), 86 opérations |
| API2 | `curl :6001/openapi.json \| jq '.paths \| length'` | 75 |
| API3 | Ajouter une route dans un routeur sans la documenter, lancer les tests | Le test « documente chaque route montée » échoue en nommant la route |
| API4 | Modifier un schéma sans régénérer, pousser | Le check « OpenAPI contracts generate+diff » échoue |

---

# D71 — le TrustScore interne : contrôler le risque sans juger les membres

## Le besoin
La réputation visible (D29 ①) dit aux membres à qui faire confiance. Elle ne dit rien à Yamba sur le risque qu'un compte fait courir à la plateforme : un compte créé hier qui déclare 2 000 € de colis, un membre qui perd ses médiations, un profil signalé plusieurs fois. Il faut un signal interne, explicable, qui plafonne les comptes neufs ou à risque et qui éclaire le support, sans jamais sanctionner tout seul.

### Règles de gestion (TRU)
- **RG-TRU-01 — Deux objets, jamais fusionnés** (REP-01) : le score interne n'apparaît sur aucun écran membre, aucun email, aucune page publique.
- **RG-TRU-02 — Un score explicable** : chaque point vient d'un fait nommé (litige perdu, annulation tardive, signalement ouvert ou retenu, vélocité, ancienneté ; deals terminés et bons avis en sens inverse). Ni fréquence de connexion ni volume de trajets (REP-05).
- **RG-TRU-03 — Compte neuf** : moins de 30 jours et moins de trois deals terminés. Il est plafonné : 300 € déclarés, 10 kg, 5 envois par mois civil (paramètres, groupe « Confiance »).
- **RG-TRU-04 — Compte à risque** : un score de 60 ou plus garde les mêmes plafonds quel que soit l'âge du compte. Entre 30 et 59 : « à surveiller », sans plafond.
- **RG-TRU-05 — Le refus est expliqué** : une réservation au-delà d'un plafond est refusée avant tout paiement, avec un message qui dit que le plafond se lève avec les premiers envois terminés.
- **RG-TRU-06 — Aucune sanction automatique** : le score éclaire la fiche membre et la file des signalements (un membre à risque y passe en priorité). Masquer, restreindre ou suspendre reste un geste humain, journalisé.

### Recette (TRU)
| # | Scénario | Attendu |
|---|---|---|
| TRU1 | Compte créé aujourd'hui, réserver un colis de 450 € déclarés | Refus « Ton compte est récent … » avant paiement ; à 250 € la demande passe |
| TRU2 | Même compte, 5 demandes ce mois, en tenter une sixième | Refus (plafond envois / mois) |
| TRU3 | Même compte, colis de 12 kg | Refus (plafond poids) ; 8 kg passe |
| TRU4 | Compte de 6 mois avec 3 deals terminés, colis de 450 € et 12 kg | Aucun plafond |
| TRU5 | Admin › fiche membre | Carte « Risque interne » : niveau, score, facteurs avec leurs points, plafonds et raison, rappel « ne sanctionne rien » |
| TRU6 | Membre avec 3 litiges perdus (via seed ou médiation), signalé une fois | Fiche « À risque » ; file des signalements : badge « À risque », ligne prioritaire avec un seul signalement |
| TRU7 | Paramètres › Confiance : passer les envois par mois à 2, réessayer TRU2 avec 2 demandes | Refus au troisième envoi dans les 30 s |

---

# D72 — annuler un trajet sans abandonner ses colis

## Le besoin
Un Voyageur dont le vol est annulé doit pouvoir retirer son trajet. Jusqu'ici, l'annulation passait sans condition : le trajet disparaissait, mais les colis déjà acceptés restaient attachés à un trajet mort. Personne n'était remboursé, personne n'était prévenu, et l'Expéditeur qui finissait par annuler lui-même se voyait appliquer la retenue prévue pour une annulation de sa part. La règle métier existait depuis l'origine ; le code ne l'avait jamais portée.

### Règles de gestion
- **RG-ANN-10 — Un trajet ne s'annule pas tant qu'un deal y est vivant.** Le Voyageur annule d'abord chaque deal, puis le trajet. Le refus indique combien de deals restent.
- **RG-ANN-11 — Annuler un deal reste imputé au Voyageur** : l'Expéditeur est remboursé intégralement, l'annulation compte dans la réputation du Voyageur. C'est la règle ANN-02, désormais réellement empruntée.
- **RG-ANN-12 — Un colis déjà récupéré ne bloque pas éternellement** : le Voyageur ne peut plus l'annuler, et le trajet se termine tout seul un jour après l'arrivée prévue.
- **RG-ERR-01 — Un code d'erreur est fait pour être lu** : tout refus métier porteur d'un code le transmet au client, en production comme ailleurs, pour que celui-ci l'explique dans la langue du membre.

### Recette (ANN, suite)
| # | Scénario | Attendu |
|---|---|---|
| ANN20 | Trajet publié sans aucune demande, « Annuler le trajet » | Trajet annulé, message de confirmation |
| ANN21 | Trajet portant une demande en attente, « Annuler le trajet » | Refus expliqué : « Ce trajet porte encore un deal en cours », le trajet reste publié |
| ANN22 | Refuser la demande, puis annuler le trajet | Annulation acceptée |
| ANN23 | Trajet portant un deal accepté, annuler le deal depuis « Mes deals », puis le trajet | Expéditeur remboursé intégralement, annulation comptée au Voyageur, puis trajet annulé |
| ANN24 | Trajet portant un colis déjà récupéré | L'annulation du trajet reste refusée ; le trajet se termine seul après l'arrivée |
| ERR1 | En production, déclencher un geste sensible sans fenêtre ouverte (changer son mot de passe) | La porte de confirmation s'ouvre, au lieu d'une erreur muette |

---

# D74 — savoir si le modèle fonctionne, pas seulement ce qu'il faut traiter

## Le besoin

Le back-office savait dire ce qu'il fallait traiter aujourd'hui : les litiges à trancher, les versements en échec, les signalements ouverts. Il ne savait pas dire si l'entreprise marchait.

Cinq questions, posées avant l'ouverture commerciale, restaient sans réponse chiffrée. Les Voyageurs acceptent-ils les demandes qu'on leur envoie ? Sur cent colis livrés, combien finissent en litige ? Combien la plateforme gagne-t-elle réellement par colis ? Quels types de sinistres coûtent, et combien ? Et surtout : ces chiffres seront exigés par un assureur, qui ne se contentera pas d'une réponse approximative.

Les données existaient toutes. Le revenu du mois et le nombre de deals terminés étaient même affichés côte à côte, sans que personne ne fasse la division.

## Ce qui change

Deux endroits du back-office.

**Pilotage, nouvelle section « Taux ».** Deux tuiles pour la période entière, puis un tableau par semaine ou par mois : demandes décidées, acceptées, refusées, expirées, taux d'acceptation, livraisons, litiges, taux de litige.

**Finances, deux ajouts.** Une colonne « Revenu moyen / deal » dans le rapport mensuel, et une section « Sinistralité » : les litiges tranchés, par mois de décision, catégorie et devise, avec le nombre retenu en faveur de l'Expéditeur et la somme remboursée.

### Règles de gestion

- **RG-PIL-10 — Un taux se calcule sur la cohorte.** Le sort d'une demande est compté dans la période où elle a été **faite**, jamais dans celle de la réponse. Une demande de fin août acceptée début septembre compte dans août.
- **RG-PIL-11 — Une demande non décidée par le Voyageur n'entre dans aucun taux.** Une demande encore en attente, ou annulée par l'Expéditeur avant réponse, est exclue des trois compteurs : elle ne dit rien du comportement du Voyageur.
- **RG-PIL-12 — Un dénominateur vide affiche « — », jamais « 0 % ».** Un mois sans livraison n'a pas un taux de litige de zéro : il n'a pas de taux.
- **RG-PIL-13 — Le taux de litige porte sur les colis livrés.** Un litige ouvert pour un colis jamais remis n'est pas à son numérateur ; il figure dans la sinistralité, catégorie « colis non livré ».
- **RG-FIN-20 — Le revenu moyen par deal est le revenu reconnu du mois divisé par le nombre de deals terminés du mois**, et vaut « — » si aucun deal n'a été terminé.
- **RG-SIN-01 — Un litige n'est un sinistre qu'une fois tranché.** Le registre est daté du mois de la **décision**, pas de l'ouverture : c'est la date à laquelle l'argent bouge. Un litige ouvert n'y figure pas.
- **RG-SIN-02 — « En faveur de l'Expéditeur » regroupe le remboursement partiel et le remboursement intégral.** Le montant retenu est celui effectivement remboursé par la décision.
- **RG-SIN-03 — La devise vient du deal**, un litige n'en portant pas. Un litige dont le deal a disparu est ignoré plutôt que rattaché à une devise supposée.

### Ce qui reste hors du back-office

La part d'Expéditeurs qui reviennent, les cohortes et les entonnoirs restent mesurés par l'outil d'audience, conformément à l'arbitrage déjà rendu. Le délai entre une recherche et une demande acceptée n'est pas mesurable côté serveur : les recherches ne sont qu'un compteur journalier, sans horodatage ni visiteur.

### Recette (PIL, suite)

| # | Scénario | Attendu |
|---|---|---|
| PIL20 | Pilotage, section « Taux », sur une période sans aucune demande | Les deux tuiles affichent « — », le tableau affiche « — » dans les colonnes de taux |
| PIL21 | Créer 3 demandes : une acceptée, une refusée, une laissée en attente | Décidées 2, acceptées 1, refusées 1, expirées 0, taux d'acceptation 50 % |
| PIL22 | Annuler une demande en attente côté Expéditeur, recharger | Le compteur « Décidées » ne bouge pas, le taux non plus |
| PIL23 | Laisser expirer une demande (24 h, ou forcer le cron) | Expirées passe à 1, le taux d'acceptation se recalcule |
| PIL24 | Demande faite en fin de semaine, acceptée la semaine suivante | Comptée comme acceptée dans la semaine de la **demande** ; la courbe « Acceptations » la montre la semaine suivante |
| PIL25 | Livrer 4 colis, ouvrir un litige sur l'un d'eux | Livraisons 4, litiges 1, taux de litige 25 %, la valeur s'affiche en ambre au-delà de 5 % |
| PIL26 | Ouvrir un litige depuis un colis récupéré mais jamais livré | Le taux de litige ne change pas ; le litige apparaît dans la sinistralité une fois tranché |
| FIN30 | Rapport financier, mois avec 2 deals terminés | « Revenu moyen / deal » = revenu du mois divisé par 2 |
| FIN31 | Rapport financier, mois sans deal terminé mais avec une capture | « Revenu moyen / deal » affiche « — » |
| SIN1 | Trancher un litige « Colis endommagé » en remboursement partiel | Ligne « Colis endommagé » : tranchés 1, en faveur de l'Expéditeur 1, remboursé = le montant décidé |
| SIN2 | Trancher un second litige de la même catégorie en rejet | La même ligne passe à tranchés 2, rejetés 1, le montant remboursé ne bouge pas |
| SIN3 | Ouvrir un litige sans le trancher | Aucune ligne n'apparaît dans la sinistralité |
| SIN4 | Trancher deux litiges de catégories différentes | Deux lignes distinctes, triées par mois puis par catégorie |

# Recette API — non-divulgation et robustesse de la recherche (ANO-API-01, ANO-API-02)

## Le besoin

Deux promesses faites aux membres étaient tenues **en apparence** seulement.

La première : « ce que Yamba a masqué n'existe plus pour les autres ». Un trajet retiré par la
modération et un profil rendu privé répondaient bien « introuvable » — mais mettaient presque trois
fois plus de temps à le dire qu'une adresse réellement inexistante. Un curieux muni d'un chronomètre
pouvait donc dresser la liste de ce qui lui était caché : quels trajets la modération a retirés,
quels membres ont rendu leur profil privé. La promesse de discrétion n'était pas tenue.

La seconde : « une erreur de l'appelant reçoit une réponse claire ». Une recherche dont le curseur
de pagination était mal formé provoquait une erreur technique 500, la seule forme de réponse que la
plateforme s'interdit, au lieu d'un refus explicite.

## Les règles

- **RG-PUB-01** — Une ressource publique **invisible** (trajet masqué par Yamba, trajet dépublié ou
  supprimé, profil privé) est indiscernable d'une ressource **inexistante** : même statut HTTP, même
  corps, **et même temps de réponse**. Aucun travail supplémentaire n'est effectué pour une
  ressource que l'appelant n'a pas le droit de voir.
- **RG-PUB-02** — Un membre voit toujours **son propre** profil, même rendu privé (rappel de D67 1A,
  inchangé) : c'est la seule exception à RG-PUB-01, et elle porte sur l'identité de l'appelant,
  jamais sur la ressource visée.
- **RG-SRCH-09** — Le curseur de pagination de la recherche est un identifiant technique : mal
  formé, il est refusé par un **400** explicite, jamais par une erreur technique. Le curseur
  **vide** signifie « première page » et reste accepté.

## Tests d'acceptation

| Réf | Scénario | Attendu |
|---|---|---|
| PUB1 | Consulter un trajet masqué par Yamba, puis un identifiant inexistant | Deux 404 au corps identique, et des temps de réponse indiscernables (médianes à moins de 2 ms l'une de l'autre sur 25 mesures) |
| PUB2 | Consulter un profil privé, puis un slug inexistant | Idem |
| PUB3 | Consulter son propre profil, rendu privé, en étant connecté | 200 — le propriétaire se voit toujours |
| PUB4 | Consulter ce même profil privé avec un autre compte connecté | 404 |
| PUB5 | Consulter un trajet publié normal | 200 (non-régression) |
| SRCH9a | Rechercher avec `cursor=null`, `cursor=abc` | 400, message « Identifiant MongoDB invalide (24 hex attendus) » |
| SRCH9b | Rechercher avec `cursor=` (vide) | 200, première page |
| SRCH9c | Rechercher avec un curseur bien formé | 200 |

Tous joués le 8 septembre 2026 sur l'environnement de recette (base `development`, paiement FAKE,
Mailpit) — voir `context/YAMBA-RECETTE-API-RESULTATS.md`.

# Recette API — ce que « mes informations » ne doit jamais contenir (ANO-API-06)

## Le besoin

Un membre qui demande ses propres informations reçoit son profil. Il ne doit pas recevoir, au
passage, ce qui protège son compte ni ce que la modération écrit à son sujet avant de décider.

Deux fuites cohabitaient. La première : le secret du second facteur (chiffré) et les codes de
secours d'un compte **administrateur** partaient dans la réponse — un vol de session livrait donc de
quoi s'attaquer, hors ligne, à la protection même des accès administrateur. La seconde : un membre
visé par une **proposition** de suspension lisait le motif rédigé par l'administrateur et son
identifiant, avant même qu'une décision soit prise.

## Les règles

- **RG-ME-01** — La réponse « mes informations » est une **liste blanche** : un champ nouveau du
  modèle n'y entre que sur décision explicite, jamais par défaut.
- **RG-ME-02** — N'en font jamais partie : les secrets d'authentification (mot de passe, secret du
  second facteur même chiffré, codes de secours), les compteurs techniques anti-rejeu, et les
  éléments de modération **avant décision** (niveau proposé, motif proposé, administrateur
  auteur de la proposition).
- **RG-ME-03** — En font partie, à dessein : une sanction **prononcée** (date, motif, échéance),
  parce qu'un membre sanctionné doit pouvoir lire sa sanction, et l'information « le second facteur
  est actif », qui ne livre rien d'exploitable.

## Tests d'acceptation

| Réf | Scénario | Attendu |
|---|---|---|
| ME1 | Lire ses informations avec un compte dont la 2FA est active | Aucun champ de secret ni de code de secours dans la réponse |
| ME2 | Lire ses informations alors qu'une suspension est **proposée** contre soi | Ni le motif proposé, ni le niveau proposé, ni l'administrateur auteur |
| ME3 | Lire ses informations alors qu'une suspension est **prononcée** | La sanction est lisible : date, motif, échéance |
| ME4 | Ajouter un champ au modèle des membres sans le classer | La suite de tests d'auth-service échoue |

Joués le 8 septembre 2026 — voir `context/YAMBA-RECETTE-API-RESULTATS.md`, fiche `ANO-API-06`.

# Recette API — ce qu'un refus doit dire, et ce qu'il ne doit pas laisser deviner (lot auth)

## Le besoin

Cinq promesses du service des comptes n'étaient pas tenues.

1. **« Vous pouvez récupérer vos données. »** L'export ne fonctionnait pas du tout : le membre
   recevait une erreur technique. C'est une obligation légale, pas une commodité.
2. **« Nous ne dirons jamais si cette adresse a un compte. »** La réponse était bien muette, mais
   elle mettait cinq fois plus de temps quand le compte existait : le silence était mesurable.
3. **« Déconnectez cet appareil. »** L'appareil restait connecté un quart d'heure.
4. **« Corrigez les champs en rouge. »** L'inscription n'en signalait qu'un à la fois.
5. **« Cette adresse est déjà utilisée. »** Le message était juste, mais le code technique de la
   réponse annonçait une simple erreur de saisie, pas un conflit.

## Les règles

- **RG-EXP-01** — Un membre peut obtenir l'export de ses données à tout moment (fenêtre sensible
  ouverte). L'export contient ce qu'il a saisi et ce qui le concerne ; **jamais** le code de
  livraison, jamais l'identité de l'autre partie, jamais les signalements le visant, jamais les
  dossiers de médiation.
- **RG-SEC-04** — Un point d'entrée public qui envoie un email selon l'existence d'un compte répond
  **de la même façon et dans le même temps** dans les deux cas. L'envoi et ses contrôles anti-abus
  ne conditionnent jamais la réponse.
- **RG-SES-05** — Couper un appareil, se déconnecter ou changer son mot de passe **coupe l'accès
  immédiatement**, pas à l'expiration du jeton. La session courante, elle, reste vivante.
- **RG-INS-03** — Le formulaire d'inscription signale **tous** ses champs fautifs en une fois, avec
  un code par champ que le client traduit.
- **RG-API-02** — Le statut HTTP d'un refus est celui que le contrat public annonce : conflit
  (409), authentification (401), trop d'essais (429). Le code métier accompagne le statut, il ne le
  remplace pas.

## Tests d'acceptation

| Réf | Scénario | Attendu |
|---|---|---|
| EXP1 | Demander l'export, fenêtre sensible ouverte | 200, fichier téléchargeable, 20 rubriques |
| EXP2 | Chercher dans l'export le code de livraison, l'email ou le téléphone du Voyageur | Aucune occurrence |
| SEC4 | Demander un code « mot de passe oublié » pour un compte existant, puis inconnu | Même corps, même statut, temps indiscernables |
| SES5a | Couper un autre appareil, puis l'utiliser | 401 `SESSION_REVOKED`, session courante intacte |
| SES5b | Se déconnecter, puis rejouer avec les cookies d'avant | 401 `SESSION_REVOKED` |
| SES5c | Changer son mot de passe, puis utiliser l'autre appareil | 401 `SESSION_REVOKED` |
| INS3 | S'inscrire avec un email invalide **et** un mot de passe trop court | 400, les deux champs signalés |
| API2a | S'inscrire avec une adresse déjà prise | **409** `EMAIL_ALREADY_USED` |
| API2b | Se tromper de code cinq fois | **401** ×4 puis **429**, compteur et verrou inchangés |

Tous joués le 8 septembre 2026 — voir `context/YAMBA-RECETTE-API-RESULTATS.md`.

# Recette API — deux clics ne valent qu'un geste (lot idempotence et concurrence)

## Le besoin

Un client mobile rejoue. Le réseau bégaie, l'utilisateur double-clique, deux onglets sont ouverts,
deux Expéditeurs visent les mêmes kilos au même instant. Ce n'est pas un cas limite : c'est le
comportement ordinaire d'une place de marché. Trois promesses n'étaient pas tenues jusqu'au bout.

1. **« Vous ne serez jamais débité deux fois, ni compté deux fois. »** Tenue — les gardes métier
   font toutes leur travail. Mais quand deux réservations se croisaient sur les derniers kilos, le
   perdant recevait **une panne** au lieu d'un refus : « Something went wrong ». Il ne savait ni
   pourquoi, ni s'il devait recommencer. Même chose sur un double clic de régénération du code.
2. **« Nous vous dirons toujours pourquoi c'est refusé. »** Sur toute la messagerie, les refus
   partaient **sans code exploitable** : la raison lisible par la machine était collée dans une
   phrase anglaise, que l'application ne peut ni traduire ni interpréter.
3. **« Un rejeu ne coûte rien. »** Tenue partout : dates de jalon figées, aucune tentative de code
   consommée, un seul lien de suivi, aucun doublon de favori ou d'abonnement.

## Les règles

- **RG-CNC-01** — Un conflit d'écriture de la base de données n'est **jamais** une réponse rendue
  au membre. Il est rejoué ; au second essai, la plateforme rend soit le succès, soit le refus
  métier qui correspond réellement à l'état des choses (« il ne reste plus assez de kilos »,
  « ce deal a changé »). Une panne technique ne se transforme pas en information métier fausse,
  et un refus métier ne se déguise pas en panne.
- **RG-CNC-02** — Le rejeu ne s'applique qu'au conflit d'écriture identifié comme tel. Toute autre
  erreur remonte telle quelle : rejouer un geste qu'on ne comprend pas risque de le produire deux
  fois.
- **RG-API-03** — **Tout** refus métier porte un code exploitable par le client, quel que soit le
  statut HTTP (400, 403, 404, 409). La raison n'est jamais cachée dans la phrase du message :
  la phrase est pour l'humain, le code est pour le programme, et c'est le programme qui choisit ce
  que l'humain lira dans sa langue.
- **RG-CNC-03** — Deux gestes simultanés sur le même objet ne comptent qu'une fois : une seule
  capture de paiement, un seul décrément de capacité, un seul décompte de régénération, une seule
  acceptation de rendez-vous, une seule session vivante après deux rafraîchissements.

## Tests d'acceptation

| Réf | Scénario | Attendu |
|---|---|---|
| CNC1 | Deux Expéditeurs réservent en même temps les 5 derniers kilos, 4 kg chacun | Un 201, un refus **« capacité dépassée »** — jamais une panne ; capacité finale 1 kg |
| CNC2 | Double clic sur « régénérer le code de livraison » | Un succès, un refus « ce deal a changé » ; le compteur ne baisse **que d'une unité** |
| CNC3 | Deux acceptations simultanées du même rendez-vous | Un succès, un refus portant le code `MEETUP_NOT_ACCEPTABLE` et sa raison ; une seule date d'acceptation |
| CNC4 | Écrire dans une conversation gelée par un litige | Refus portant `CONVERSATION_READ_ONLY` et la raison `DISPUTE_OPEN` |
| CNC5 | Rejouer une acceptation, puis une remise | 409 à chaque fois ; dates de jalon inchangées, une seule capture, aucune tentative de code consommée |
| CNC6 | Rejouer le même événement email signé | Effet appliqué une seule fois ; 200 dans les deux cas |
| CNC7 | Deux rafraîchissements simultanés de la même session | Une seule session utilisable ensuite |

Joués le 8 septembre 2026 — voir `context/YAMBA-RECETTE-API-RESULTATS.md`, fiches `ANO-API-19`,
`ANO-API-20` et `ANO-API-21`.

# Recette API — ce que le monde extérieur nous apprend (lot webhooks)

## Le besoin

Deux acteurs extérieurs nous parlent sans jamais ouvrir de session : **Stripe**, qui sait avant nous
qu'un paiement est mort ou qu'un compte de Voyageur est bloqué, et **le fournisseur d'emails**, qui
sait avant nous qu'une adresse n'existe plus. Ce sont les deux seules portes de la plateforme
ouvertes sur l'extérieur ; leur unique défense est la signature du message.

Rien n'était en défaut. Ce chapitre ne corrige pas, il **atteste** — et complète les tests.

## Les règles

- **RG-HOOK-01** — Un message extérieur n'est traité que si sa **signature** est valide et
  **récente**. Sans secret configuré, la plateforme **refuse** (503 côté email, 501 côté Stripe) :
  elle n'accepte jamais un message qu'elle ne peut pas vérifier.
- **RG-HOOK-02** — Un type de message dont nous ne faisons rien reçoit tout de même une réponse
  positive : un refus ferait retenter l'émetteur indéfiniment pour rien.
- **RG-HOOK-03** — Un échec de notre côté (base indisponible) répond en **erreur serveur**, pour que
  l'émetteur réessaie. Répondre « reçu » perdrait l'information définitivement.
- **RG-HOOK-04** — Le même message reçu deux fois ne produit **qu'un seul effet** : une seule
  annulation, une seule mise sur liste de suppression.
- **RG-HOOK-05** — Sur l'argent, **c'est Stripe qui fait foi** : l'état de Yamba converge vers le
  sien. Un compte de Voyageur qui redevient conforme voit ses versements bloqués **repartir seuls**,
  sans qu'il refasse son inscription.
- **RG-EMAIL-05** — Une adresse qui rebondit durement, ou dont le titulaire signale un abus, est
  **mise en retrait** : plus aucun email ne part vers elle, sur aucun flux, jusqu'à ce qu'un
  administrateur lève le retrait. Un rebond passager (boîte pleine) ne déclenche rien.

## Tests d'acceptation

| Réf | Scénario | Attendu |
|---|---|---|
| HK1 | Message Stripe sans signature, ou mal signé | Refusé ; aucun effet |
| HK2 | Stripe annonce une autorisation morte sur une demande en attente | La demande est annulée par le système, l'Expéditeur n'est pas débité |
| HK3 | Le même message Stripe arrive deux fois | Une seule annulation, un seul événement |
| HK4 | Le compte du Voyageur redevient conforme | Ses drapeaux suivent, ses versements en attente repartent |
| HK5 | Le fournisseur d'emails signale un rebond dur | L'adresse est mise en retrait ; **la transition suivante n'envoie plus rien** à ce membre, l'autre partie reçoit normalement le sien |
| HK6 | Le même rebond est rejoué | Aucun second effet |
| HK7 | Un message d'un type dont nous ne faisons rien | Accepté et ignoré, jamais une erreur |

Joués le 8 septembre 2026 — voir `context/YAMBA-RECETTE-API-RESULTATS.md`, chapitre 8. Aucun écart.

# Recette API — un refus qui dit ce qu'il faut faire ensuite (lot consignation)

## Le besoin

Une plateforme refuse en permanence : « ce trajet est complet », « ce deal a déjà été accepté »,
« ce n'est pas votre rôle ». Un refus n'est utile que si l'application peut **le comprendre** et
dire à la personne quoi faire ensuite. Or la moitié des anomalies de cette campagne ne sont pas des
fautes de logique : ce sont des refus **mal formulés**. Le serveur savait ce qu'il faisait ; il ne
savait pas le dire.

Le cas emblématique : quand un Voyageur acceptait un deal déjà accepté (deux clics, deux onglets),
la réponse disait, en anglais, « cette action n'est pas permise depuis le statut ACCEPTED ».
L'application ne pouvait ni traduire cette phrase, ni savoir que le deal était **déjà accepté**,
donc ni proposer la bonne suite (« rechargez, c'est déjà fait »).

## Les règles

- **RG-API-04** — Tout refus dit **trois choses** : un code stable que le programme reconnaît, une
  phrase lisible pour le journal, et — quand c'est un refus d'état — **l'état réellement vu par le
  serveur** ainsi que les états depuis lesquels l'action reste possible. La personne doit pouvoir
  être renseignée sans que le développeur analyse un texte anglais.
- **RG-API-05** — Un refus de droit dit **quelle habilitation manque**, jamais seulement « interdit ».
  C'est vrai pour un membre (« seul le Voyageur peut accepter ») comme pour un administrateur
  (« votre profil n'a pas la permission `audit.read` »).
- **RG-REC-01** — Une campagne de recette n'est close que si **chaque fiche a un verdict écrit**.
  Une fiche sans verdict est une couverture manquante, pas un succès ; une fiche bloquante non
  jouée interdit la mise en production, même si rien n'a été trouvé ailleurs.

## Tests d'acceptation

| Réf | Scénario | Attendu |
|---|---|---|
| REF1 | Accepter un deal déjà accepté | Refus indiquant que le deal est **ACCEPTED** et que l'acceptation n'était possible qu'en **PENDING** |
| REF2 | Remettre un colis déjà livré | Même forme : état vu, états possibles |
| REF3 | Un tiers consulte un deal qui n'est pas le sien | Refus « vous n'êtes pas partie à ce deal », code exploitable |
| REF4 | Un identifiant de deal inexistant | Refus « deal introuvable », code exploitable — et rien qui révèle l'existence d'un autre deal |
| REF5 | Un administrateur SUPPORT ouvre une page réservée | Refus **nommant la permission manquante** ; ses propres pages restent accessibles |
| REF6 | Un administrateur lit un fil de discussion | Lecture possible, **journalisée** (qui, quand, quel fil), et le code de livraison n'y figure jamais |

Joués le 8 septembre 2026 — voir `context/YAMBA-RECETTE-API-RESULTATS.md`, chapitre 9.

# Recette API — pourquoi un refus doit se distinguer d'un autre (dette D-4)

## Le besoin

Trois refus qui se ressemblent n'appellent pas la même conduite :

- « ce trajet n'existe pas » → il a été supprimé, inutile de réessayer ;
- « ce trajet n'est pas le vôtre » → il existe, mais vous n'y avez pas droit ;
- « votre saisie est incorrecte » → corrigez et renvoyez.

La plateforme rendait les trois de la même façon : un **400**, avec une phrase anglaise et aucun
code. L'application ne pouvait ni les distinguer, ni les traduire, ni décider quoi proposer. Même
chose du côté des sessions : « pas de jeton », « session expirée », « compte suspendu » et
« session révoquée » arrivaient tous en 401, et quatre d'entre eux sans rien pour les différencier
— alors qu'ils appellent respectivement : se connecter, rafraîchir, contacter le support, se
reconnecter.

## Les règles

- **RG-API-06** — Le **statut** d'un refus dit sa nature : 404 « cela n'existe pas », 403 « cela ne
  vous appartient pas », 401 « vous n'êtes pas identifié », 400 « votre saisie est à corriger ».
  Un statut n'est jamais choisi par commodité.
- **RG-API-07** — Deux refus qui appellent une conduite différente portent des **codes différents**.
  Un code unique posé partout satisfait la lettre de la règle et en manque l'objet.
- **RG-SES-06** — Un membre déconnecté doit savoir **pourquoi** : sa session a été coupée depuis un
  autre appareil, son compte est suspendu, ou son jeton a simplement expiré. Ces trois situations ne
  se racontent pas de la même façon.

## Tests d'acceptation

| Réf | Scénario | Attendu |
|---|---|---|
| SEM1 | Modifier un trajet qui n'existe pas | **404**, code « trajet introuvable » |
| SEM2 | Modifier le trajet d'un autre membre | **403**, code « vous n'êtes pas le propriétaire » |
| SEM3 | Appeler une route protégée sans être connecté | **401**, code « jeton absent » |
| SEM4 | Utiliser une session coupée depuis un autre appareil | **401**, code « session révoquée » — pas le même que SEM3 |
| SEM5 | Se connecter avec un mauvais mot de passe | **401**, code « identifiants invalides » |
| SEM6 | Se suivre soi-même | **400**, code dédié |

Joués le 8 septembre 2026 — voir `context/YAMBA-RECETTE-API-RESULTATS.md`, « Solde de la dette D-4 ».

# Recette API — la vitrine était fermée (ANO-API-23)

## Le besoin

Deux pages seulement se partagent à l'extérieur de Yamba : le **profil public d'un membre** et la
**page d'un trajet**. C'est ce qu'un Voyageur envoie pour se faire connaître, ce qu'un Expéditeur
ouvre avant de réserver. Elles répondaient « introuvable » :

- pour **22 comptes sur 26** ;
- pour **24 trajets publiés sur 37**.

Rien ne le signalait : dans le tableau de bord, le profil s'affichait bien « public », et le trajet
bien « publié ». Seul un visiteur extérieur voyait la porte close — et personne ne teste sa propre
plateforme en visiteur.

## Les règles

- **RG-PUB-01** — Un profil déclaré public et un trajet publié sont consultables par **tout le
  monde**, sans compte. Si l'un des deux ne l'est pas, c'est un défaut bloquant : c'est la vitrine.
- **RG-PUB-02** — Ce qu'un membre voit de son propre profil (« public », « publié ») doit
  correspondre à ce qu'un visiteur obtient. Un écart entre les deux est un défaut, même si chaque
  écran pris séparément semble juste.
- **RG-DON-01** — Un compte ou un trajet créé **avant** l'ajout d'une option ne doit pas disparaître
  des listes et des pages publiques pour autant : la valeur par défaut de l'option s'applique à
  lui comme aux autres.

## Tests d'acceptation

| Réf | Scénario | Attendu |
|---|---|---|
| PUB1 | Ouvrir le profil public d'un membre ancien, sans être connecté | **200**, le profil s'affiche |
| PUB2 | Ouvrir la page d'un trajet publié par un membre ancien | **200**, le trajet s'affiche |
| PUB3 | Ouvrir le profil d'un membre qui l'a rendu privé | **404**, identique à un profil inexistant |
| PUB4 | Ouvrir un trajet masqué par la modération | **404**, identique à un trajet inexistant |
| PUB5 | Le propriétaire ouvre son propre profil masqué | **200**, marqué « masqué » |

Joués le 8 septembre 2026 — voir `context/YAMBA-RECETTE-API-RESULTATS.md`, `ANO-API-23`.

# Recette API — supprimer deux fois, c'est supprimer une fois (dette D-3)

## Le besoin

Un Voyageur retire le billet qu'il avait joint à son trajet. Il clique deux fois — parce que la
page a mis une seconde, parce qu'il est revenu en arrière, parce que le réseau a bégayé. Le second
clic répondait **« Document introuvable »**, en annonçant une erreur de saisie. Le geste avait
pourtant parfaitement fonctionné.

La même plateforme faisait déjà bien les choses juste à côté : supprimer un fichier deux fois
répondait « ce fichier était déjà supprimé », sans erreur. Deux gestes voisins, deux réponses
opposées.

## Les règles

- **RG-SUP-01** — Supprimer est un geste **rejouable** : la deuxième fois répond comme la première,
  en indiquant simplement que c'était déjà fait. Une suppression ne se solde jamais par une erreur
  pour la seule raison qu'il n'y avait plus rien à supprimer.
- **RG-SUP-02** — La plateforme ne dit **jamais** si un identifiant a existé. « Déjà supprimé » et
  « n'a jamais existé » reçoivent la même réponse : sans quoi, en essayant des identifiants au
  hasard, on apprendrait lesquels sont réels.
- **RG-SUP-03** — Quand une suppression touche deux endroits (la fiche et le fichier joint), c'est
  **la fiche qui part d'abord**. Si le reste échoue, il subsiste au pire un fichier inutile chez le
  prestataire — jamais une fiche qui renvoie vers un document disparu.

## Tests d'acceptation

| Réf | Scénario | Attendu |
|---|---|---|
| SUP1 | Retirer un document, puis recliquer deux fois | Trois fois **la même réponse positive**, la seconde et la troisième précisant « déjà retiré » |
| SUP2 | Retirer un document qui appartient à un autre trajet | Même réponse positive, **rien n'est touché** |
| SUP3 | Retirer un document sur le trajet de quelqu'un d'autre | Refus « ce trajet n'est pas le vôtre » |
| SUP4 | Supprimer une alerte de trajet déjà supprimée | Réponse positive |
| SUP5 | Le prestataire de fichiers est indisponible | Le document est retiré quand même |

Joués le 9 septembre 2026 — voir `context/YAMBA-RECETTE-API-RESULTATS.md`, « Solde de la dette D-3 ».

# Recette API — dans quelle langue Yamba nous parle (dette D-1)

## Le besoin

Un membre a choisi l'anglais. Il ouvre l'application depuis un téléphone réglé en français. Dans
quelle langue Yamba lui répond ?

La décision était prise depuis le 3 septembre — **la langue est celle du compte, pas de l'appareil**
(registre, D44) : on choisit sa langue une fois, elle vaut partout, y compris dans les emails. Mais
elle n'était appliquée qu'à un endroit sur trois. Les favoris suivaient l'appareil, et la
**recherche répondait toujours en français** à qui ne demandait pas explicitement autre chose — ce
que l'application fait, mais qu'un autre programme branché sur l'API ne faisait pas.

## Les règles

- **RG-LANG-01** — La langue d'une réponse est celle du **compte** du lecteur. On choisit sa langue
  une fois ; elle vaut sur tous les écrans et dans tous les emails, quel que soit l'appareil.
- **RG-LANG-02** — Un visiteur **sans compte** est servi dans la langue de son appareil.
- **RG-LANG-03** — Un lien qui porte explicitement une langue (`?locale=`) l'emporte : une adresse
  qu'on s'envoie doit afficher la même chose chez les deux personnes.
- **RG-LANG-04** — Changer de langue dans l'application enregistre le choix **immédiatement** : il
  n'y a pas d'écran de préférences à aller chercher.
- **RG-LANG-05** — Une langue demandée que Yamba ne parle pas est **ignorée**, pas remplacée par le
  français : on retombe sur la langue du lecteur, jamais sur le défaut.

## Tests d'acceptation

| Réf | Scénario | Attendu |
|---|---|---|
| LANG1 | Membre en anglais, téléphone en français | Réponses **en anglais** |
| LANG2 | Le membre bascule en anglais dans l'application | La réponse suivante est déjà en anglais |
| LANG3 | Visiteur sans compte, navigateur en anglais | Résultats de recherche **en anglais** |
| LANG4 | Membre anglais, recherche **sans** préciser de langue | Dates en anglais (avant : toujours en français) |
| LANG5 | Lien de recherche portant `locale=fr`, ouvert par un membre anglais | La page s'affiche **en français** |
| LANG6 | Une langue inconnue est demandée | La langue du lecteur s'applique |

Joués le 9 septembre 2026 — voir `context/YAMBA-RECETTE-API-RESULTATS.md`, « Solde de la dette D-1 ».

---

# Recette « tâches planifiées » — ce que le métier attend des mécaniques invisibles

*(cahier n° 4, 09/09/2026 — 90 fiches, 9 anomalies closes, décisions **D76** et **D77**.)*

## Le besoin

Quinze tâches tournent la nuit, deux relais publient les événements, deux consommateurs les
transforment en notifications et en emails. **Aucune de ces mécaniques n'a d'écran.** Personne ne
se plaint quand elles s'arrêtent : les emails cessent simplement d'arriver, les remboursements
attendent, les données ne se purgent plus. Le besoin métier est donc double — qu'elles fassent leur
travail, et qu'on **sache** quand elles ne le font pas.

## Les règles

**RG-CRON-01 — Un événement en attente de publication n'est jamais supprimé.** Un événement qui
n'est pas encore parti est une piste d'audit et une notification due. Aucune purge, quelle que soit
son ancienneté, ne peut l'effacer. *(ANO-CRON-05 : la purge nocturne les supprimait tous, chaque
nuit.)*

**RG-CRON-02 — Une panne d'infrastructure fait du retard, jamais une perte.** Courtier arrêté,
sujet absent, base injoignable : l'événement attend, il n'est ni parqué ni consommé de travers. Le
signal est le **retard** (alerte au-delà de quinze minutes d'attente), jamais la disparition.
*(ANO-CRON-06, D76.)*

**RG-CRON-03 — Un composant qui tombe se relève, ou se voit.** Un consommateur arrêté rend le
service **dégradé** sur la page « État des services » et sur la sonde publique. Un service qui
répond « en forme » alors qu'il ne consomme plus rien est un défaut à part entière. *(ANO-CRON-08,
D76.)*

**RG-CRON-04 — Un message illisible n'est jamais sauté.** On rejoue, bruyamment et de plus en plus
espacé. Sauter un message qu'on n'a pas su lire, c'est le perdre.

**RG-CRON-05 — Un message hors contrat ne bloque pas les autres.** Il est marqué en échec
définitif, la file continue d'avancer. Une seule ligne malformée ne doit jamais arrêter les
notifications de toute la plateforme.

**RG-CRON-06 — Rejouer un événement ne produit ni doublon d'email, ni doublon de notification.**
La réclamation se fait par identifiant d'événement, et l'email par destinataire : un rejeu retrouve
ce qui existe au lieu de le recréer.

**RG-CRON-07 — Chaque purge reste dans son domaine.** Une tâche ne supprime que ses propres
collections. Aucune ne touche aux réservations, aux trajets, aux comptes, aux litiges, aux avis ni
aux signalements.

**RG-CRON-08 — La conservation efface le propos, jamais le dossier de modération.** Quand la purge
d'un fil emporte un message signalé, le signalement **reste visible et traitable** par
l'administrateur, sans son contenu. Un dossier ouvert ne doit jamais sortir de la file autrement
que par une décision humaine. *(ANO-CRON-09, D77.)*

**RG-CRON-09 — Aucun email ne part vers un compte effacé ou une adresse supprimée.** La règle vaut
pour **tous** les flux issus d'une tâche planifiée : rappel d'inscription, relance des messages non
lus, rappel de vérification, relance de notation. La notification interne, elle, reste créée : la
suppression porte sur l'email, pas sur le domaine.

**RG-CRON-10 — Une tâche planifiée est un acteur comme un autre.** Elle passe par la machine à
états (`SYSTEM`), elle ne recopie pas la règle dans un `if`. Un trajet portant un deal vivant n'est
pas complété, une demande non périmée n'est pas expirée, une réservation en litige n'est pas versée.

**RG-CRON-11 — Un montant versé est celui de l'instantané, jamais du trajet.** Modifier le prix
d'un trajet n'a aucun effet sur les réservations déjà prises. Les montants sont des centimes
entiers.

**RG-CRON-12 — Le code de livraison ne quitte jamais la base.** Ni dans un événement, ni dans un
email, ni dans une notification, ni dans la mesure d'audience. En base il n'existe que sous deux
formes : une empreinte (validation) et un chiffré (réaffichage à l'Expéditeur).

**RG-CRON-13 — Le jeu d'essai respecte les règles qu'il sert à éprouver.** Un seed qui écrit un cas
que l'API refuse fabrique de fausses anomalies et fait perdre du temps. *(ANO-CRON-07.)*

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 1 | Trois événements non publiés (10 j, 200 j, 2 ans), toutes les purges passées | les trois survivent, intacts | oui |
| 2 | Courtier arrêté 100 s, un événement sain en file | `attempts` reste à 0 ; publié seul au retour | oui |
| 3 | Sujet supprimé du courtier | rejeu sans fin, alerte de retard à 15 min, jamais parqué | oui |
| 4 | Message que le transport ne sait pas décoder | le service passe **dégradé**, réessaie 5 s → 10 s → 20 s → 40 s, et se remet seul une fois le message retiré | oui |
| 5 | Message hors contrat, puis message suivant | échec définitif tracé, retard du groupe à 0, le suivant est traité | oui |
| 6 | Même événement rejoué | aucun email, aucune notification en double | oui |
| 7 | Consommateur arrêté, 6 événements publiés, puis redémarré | retard 6 → 0, chacun traité une fois, dans l'ordre par réservation | oui |
| 8 | Base injoignable pendant l'arrivée d'un message | l'offset n'avance pas ; base revenue, message relivré et traité **une** fois | oui |
| 9 | Cinq tâches de suppression, seize collections comptées | chacune ne fait varier que ses propres collections | oui |
| 10 | Signalement dont le message a été purgé | dossier visible dans la file, marqué « contenu purgé », toujours traitable | oui |
| 11 | Compte effacé et adresse supprimée, quatre flux d'emails | zéro email, notification interne conservée | oui |
| 12 | Effacement du tiers à 29 / 30 / 31 jours | 29 intact, 30 et 31 effacés ; aucune réservation vivante touchée | oui |
| 13 | Prix du trajet modifié après réservation, puis versement | le versement vaut l'instantané, pas le prix courant | oui |

---

# Recette navigateur — les règles que le harnais fait respecter

*(cahiers 01-WEB et 02-ADMIN, campagne ouverte le 09/09/2026.)*

## Le besoin

Un membre ne voit ni les services, ni les événements, ni les tâches de nuit : il voit **des
écrans**. Deux cahiers décrivent 438 scénarios navigateur. Les jouer à la main coûte plusieurs
jours et ne protège que le jour où on les joue. Le harnais les exécute — et chaque défaut trouvé
y laisse un scénario qui interdit sa réapparition.

## Les règles

**RG-WEB-01 — Une session qui n'a jamais existé ne peut pas expirer.** Un visiteur ne reçoit
jamais le message « ta session a expiré » : il n'a rien perdu. L'annonce est réservée à un
membre dont la session a réellement pris fin. *(ANO-WEB-01.)*

**RG-WEB-02 — Rien ne se pose devant l'écran de connexion.** Sur `/login`, `/register`,
`/password` et `/refresh`, aucune fenêtre modale ne recouvre le formulaire : ce sont les écrans
où l'on vient précisément régler sa session. Une fenêtre au fond opaque y rend le produit
inutilisable. *(ANO-WEB-01.)*

**RG-WEB-03 — Un écran n'affiche jamais une clé de traduction.** Un libellé manquant est un
défaut visible par l'utilisateur, pas un détail technique — et il n'est pas rattrapé par la
comparaison des langues entre elles, puisque deux langues peuvent être incomplètes de la même
façon. *(ANO-WEB-02.)*

**RG-WEB-04 — Ce qu'un rôle ne voit pas est aussi important que ce qu'il voit.** Chaque scénario
du harnais joue les rôles dans des navigateurs séparés : Expéditeur, Voyageur, visiteur. Une
session partagée rendrait vertes, pour de mauvaises raisons, la moitié des vérifications des
cahiers.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 1 | Un visiteur ouvre l'écran de connexion | aucune fenêtre parasite, formulaire cliquable, connexion possible | oui |
| 2 | Un visiteur ouvre l'accueil, la recherche, l'inscription | aucune annonce d'expiration de session | oui |
| 3 | Un membre connecté ouvre son tableau de bord | le marqueur de session existe ; il n'existe pas pour un visiteur | oui |
| 4 | Un visiteur clique « Réserver » sans compte | la porte propose « Se connecter » et « Créer un compte », en clair | oui |
| 5 | La même porte en anglais | « Sign in » et « Create an account » | oui |
| 6 | Le bouton « Se connecter » de la porte | mène à la connexion **et** revient sur la réservation | oui |

---

# Le parcours nominal complet — ce que WEB-E2E-1 fait respecter

*(PR `chore/e2e-parcours`, 09/09/2026 — cahier 01-WEB chapitre 6.)*

## Le besoin

Le parcours bloquant du cahier est la chaîne de valeur entière : un colis réservé, accepté, remis
sur rendez-vous, transporté, livré contre un code, confirmé, puis noté des deux côtés. Chacune de
ses vingt-neuf étapes énonce une promesse faite à un rôle — et souvent une chose qu'un autre rôle
**ne doit pas** voir. Le harnais les tient toutes, en une minute et demie, à chaque exécution.

## Les règles

**RG-WEB-05 — Un bouton de deal ouvre le fil de CE deal.** Sur grand écran comme sur mobile,
« Envoyer un message » et « Appeler » mènent à la conversation du deal d'où l'on vient, jamais
au premier fil de la liste. *(ANO-WEB-03.)*

**RG-WEB-06 — Le numéro de l'autre partie ne s'affiche qu'à partir de deux heures avant le
rendez-vous de remise confirmé.** Avant, l'écran dit à partir de quand, et le serveur refuse avec
un code (`TOO_EARLY`) — le bouton ne fait rien d'autre. *(D61.)*

**RG-WEB-07 — La page du destinataire ne révèle rien.** Le lien `/track/<jeton>` montre le
prénom du destinataire, le corridor, les dates et les jalons ; **jamais** le code, un numéro de
téléphone ni un montant. *(D69.)*

**RG-WEB-08 — Le code de livraison naît à la prise en charge et ne voyage jamais par email.**
L'Expéditeur le lit dans son suivi ; l'email qui l'y invite en parle sans le contenir, ni en
clair ni avec l'espace de lecture (« 742 891 »). *(D43, invariant B3/A41.)*

**RG-WEB-09 — Un seul jalon écrit : l'atterrissage.** L'aéroport et le décollage restent dans les
notifications ; seul « a atterri — préviens le destinataire » part par email.

**RG-WEB-10 — Le versement est annoncé à J+4 au Voyageur dès la remise validée**, et
l'Expéditeur dispose de trois jours pour confirmer ou signaler ; la confirmation anticipée est
définitive et fait disparaître la carte de signalement.

**RG-WEB-11 — Les avis restent secrets jusqu'à ce que les deux parties aient noté.** Le premier
notant lit qu'il attend l'autre, et son avis n'est pas sur le profil public ; le second lit que
« vos deux avis sont maintenant visibles » ; chacun reçoit la notification « Les notes sont
révélées » ; l'avis public est signé du prénom et de l'initiale de son auteur. *(D53.)*

**RG-WEB-12 — Le jeu d'essai promet des profils publics.** Tout compte du seed répond sur
`/u/seed-<clé>` : le cahier s'y réfère (§ 2.3, chapitre 5.24).

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 7 | Le Voyageur clique « Envoyer un message » depuis un deal, avec six conversations | le fil ouvert est celui du deal, vide | oui |
| 8 | Le Voyageur propose un rendez-vous dans 3 jours ; l'Expéditrice accepte | « Un rendez-vous a été proposé. » → « Confirmé », « Le rendez-vous est confirmé. » | oui |
| 9 | L'Expéditrice demande le numéro plus de 2 h avant | bandeau « à partir du … », refus 400 `TOO_EARLY`, aucun numéro | oui |
| 10 | Le destinataire ouvre le lien de suivi, avant et après la prise en charge, après l'atterrissage, après la remise | jalons justes ; ni code, ni numéro, ni montant, à chaque fois | oui |
| 11 | Le Voyageur confirme la prise en charge (5/5, 2 photos) | code visible côté Expéditrice ; email sans le code ; numéro du destinataire visible côté Voyageur | oui |
| 12 | Trois jalons | un seul email, l'atterrissage | oui |
| 13 | Remise avec le code lu par l'Expéditrice | « Livraison validée ! », versement à J+4 | oui |
| 14 | Confirmation anticipée | « Transaction close », plus de signalement possible, deux emails de clôture avec le montant qui concerne chacun | oui |
| 15 | Notation croisée | secret puis révélé, notification aux deux, avis public signé « Aminata D. » | oui |
| 16 | Un second navigateur du même compte | aucune requête de connexion, session vivante | oui |
| 17 | Un administrateur (médiateur) ouvre le back-office | mot de passe puis code TOTP calculé, cookies `admin_*` seuls | oui |

---

# Le parcours avec litige — ce que WEB-E2E-2 fait respecter

*(PR `chore/e2e-parcours-2`, 09/09/2026 — cahier 01-WEB chapitre 6, cahier 02-ADMIN § 5.9.)*

## Le besoin

Un litige est le moment où la confiance se joue. Chaque partie doit pouvoir dire sa version ;
aucune ne doit lire celle de l'autre avant la décision ; le back-office doit tout voir sauf le
code de livraison ; et la décision doit revenir à chacun avec **son** montant. Le harnais joue
cette chaîne en trente secondes.

## Les règles

**RG-WEB-13 — Le Voyageur ne lit que la catégorie du signalement.** Ni le récit, ni les photos,
ni la solution souhaitée par l'Expéditeur — à l'écran comme dans l'email. *(A68.)*

**RG-WEB-14 — L'Expéditeur apprend que le Voyageur a répondu, jamais ce qu'il a dit.** La
version du Voyageur ne sert qu'à la médiation. *(D55 5A.)*

**RG-WEB-15 — La version se donne une fois, en cinquante caractères au moins ; elle n'écrit à
personne.** Après l'envoi, le formulaire ne revient pas, même au rechargement ; aucun email ne
part ni vers l'un ni vers l'autre.

**RG-WEB-16 — Un deal clos par la médiation le dit, et ne se note pas.** Le suivi de
l'Expéditeur annonce « Clos par la médiation », jamais « sans signalement de ta part » ; aucun
des deux ne peut noter l'autre. *(ANO-WEB-04, D54 4B.)*

**RG-WEB-17 — La décision revient à chacun avec son montant seul.** L'Expéditeur lit le
remboursement, le Voyageur son versement ; ni l'écran ni l'email de l'un ne porte le montant de
l'autre ; le motif de la médiation est lu par les deux.

**RG-WEB-18 — Le jeu d'essai capture ce qu'un vrai deal capture.** Tout deal accepté du seed
porte `capturedAt` et un `chargeId` : le portefeuille et les files finances lisent la même
vérité que sur un deal réel. *(ANO-WEB-05.)*

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 18 | L'Expéditeur signale avec un récit de 12 caractères | compteur « n / minimum 50 caractères », envoi impossible | oui |
| 19 | Le dossier complet est envoyé | numéro `YAM-XXXX`, fil fermé, accusé avec dossier, gel et 48 h ouvrées | oui |
| 20 | Le Voyageur ouvre le deal et reçoit l'email | catégorie seule ; le récit et les photos n'apparaissent nulle part | oui |
| 21 | Le Voyageur donne sa version (photo) | « Version envoyée », bouton disparu après rechargement, aucun email | oui |
| 22 | La médiatrice tranche 15,00 € de remboursement partiel | récapitulatif 15,00 / 40,00 / 6,60 €, « Décision enregistrée », le code de livraison absent du dossier | oui |
| 23 | Chacun relit son deal et son email | son montant seul, le même motif, « Clos par la médiation », aucun « Noter » | oui |
| 24 | Finances › Paiements de l'Expéditeur | « Remboursé 15,00 € le … », « + 15,00 € » | oui |

---

# L'annulation tardive — ce que WEB-E2E-3 fait respecter

*(PR `chore/e2e-parcours-3`, 09/09/2026 — cahier 01-WEB chapitre 6, ANN-01 / D50.)*

## Le besoin

Annuler à moins de 48 h du départ coûte la moitié du prix : le Voyageur avait réservé sa
capacité. L'Expéditrice doit lire ce montant AVANT de confirmer, pouvoir renoncer sans
conséquence, et retrouver ensuite les mêmes chiffres partout — son remboursement, la
compensation du Voyageur, les kilos rendus au trajet, les emails.

## Les règles

**RG-WEB-19 — La fenêtre d'annulation dit le montant remboursé et la retenue avant tout geste.**
À moins de 48 h : « Tu seras remboursée de » la moitié, « Une retenue de 50 % … reversée au
Voyageur ». « Garder l'envoi » ne déclenche rien.

**RG-WEB-20 — L'arithmétique est la même à l'écran, dans la réponse du serveur, dans les
Finances des deux côtés et dans les emails.** Remboursement = total ÷ 2 ; compensation du
Voyageur = arrondi(retenue × transport ÷ total) ; écart toléré : un centime.

**RG-WEB-21 — Les kilos annulés reviennent au trajet immédiatement.**

**RG-WEB-22 — Un message reçu se présente comme tel.** La notification dit « Nouveau message »,
montre l'extrait, et mène au fil. *(ANO-WEB-06.)*

**RG-WEB-23 — Le fil d'un deal annulé reste lisible, et ouvert à l'écriture quatorze jours.**

**RG-WEB-24 — Un refus doit conseiller un geste possible.** Le refus d'annuler un trajet qui
porte un deal vivant (D72) doit renvoyer vers un écran qui existe et vers un geste que le
Voyageur peut faire. *(ANO-WEB-07, ouverte.)*

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 25 | Réservation de 3 kg (S, 100 €) sur un trajet à 9,50 €/kg | 31,92 € ; Finances « Autorisé, pas débité » puis « Bloqué chez Yamba » à l'acceptation | oui |
| 26 | Deux messages échangés | chacun reçoit « Nouveau message » | oui |
| 27 | Fenêtre d'annulation à moins de 48 h | 15,96 € remboursés, retenue 15,96 € reversée, « Garder » sans effet | oui |
| 28 | Annulation confirmée | toast, ligne « Annulée », Finances des deux côtés (15,96 € / 14,25 €), kilos rendus, quatre emails | oui |
| 29 | Le Voyageur tente d'annuler son trajet | refus 409 avec le nombre de deals vivants | oui (conseil inapplicable : ANO-WEB-07) |

---

# Le compte neuf — ce que WEB-E2E-4 fait respecter

*(PR `chore/e2e-parcours-4`, 09/09/2026 — cahier 01-WEB chapitre 6, CNF-06 / D71, D63, D65, SES-01.)*

## Le besoin

Un compte neuf est plafonné pendant trente jours, et ces plafonds doivent tomber **avant** tout
argent — jamais après une autorisation bancaire. Le score qui les décide ne se montre à
personne : ni à l'écran, ni dans l'export des données. Et la vie ordinaire du compte doit tenir
ses promesses : une session qui expire, ses appareils, une suppression bloquée tant qu'un deal
est en cours.

## Les règles

**RG-WEB-25 — Un plafond refuse avant tout paiement.** Valeur déclarée, poids et nombre
d'envois du mois sont contrôlés à la demande d'intention de paiement ; rien n'est autorisé, aucune
ligne Finances, aucun email. *(ANO-WEB-08.)*

**RG-WEB-26 — Le score de confiance n'existe pour personne.** Aucune page du membre, aucune page
publique, aucun export ne le mentionne. *(D71.)*

**RG-WEB-27 — L'export des données passe par la porte, puis se télécharge.** Le refus
`SUDO_REQUIRED` ouvre la porte, quel que soit le format de réponse demandé. *(ANO-WEB-09.)*

**RG-WEB-28 — Une session expirée se rattrape sur place.** La fenêtre se pose par-dessus la
page, la reconnexion ne la quitte pas, et le membre refait son geste.

**RG-WEB-29 — La suppression est bloquée avant toute porte.** Un deal en cours ou une demande en
attente affichent le bandeau et les motifs ; aucun code n'est demandé ni envoyé.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 30 | Inscription, code, connexion sans « Rester connecté » | compte activé, bienvenue, cookie de session sans expiration | oui |
| 31 | 450 € / 12 kg / sixième demande du mois | refus à l'intention, message unique, rien nulle part | oui |
| 32 | Profil, tableau de bord, page publique, export | aucun score, aucun niveau de risque, aucun point | oui |
| 33 | Session expirée puis un geste | fenêtre par-dessus la page, reconnexion sur place, geste refait | oui |
| 34 | Supprimer mon compte avec un deal en cours | bandeau, motifs, aucune porte, aucun email | oui |

---

# Le refus au pickup — ce que WEB-E2E-5 fait respecter

*(PR `chore/e2e-parcours-5`, 10/09/2026 — cahier 01-WEB chapitre 6, A40, D39, D29 ①.)*

## Le besoin

Au rendez-vous de prise en charge, le Voyageur ouvre le colis. S'il ne correspond pas à ce qui a
été déclaré, il doit pouvoir le **refuser sans se pénaliser** : c'est la garantie qui rend la
vérification possible. L'Expéditrice est remboursée en entier, tout de suite, et prévenue ; les
kilos reviennent au trajet ; et rien de ce refus ne vient noircir la page publique du Voyageur.

## Les règles

**RG-WEB-30 — Un refus au pickup rembourse tout.** Le paiement capturé à l'acceptation est
remboursé intégralement, avant toute écriture en base ; « Mes envois » dit « Annulée »,
Finances « Remboursé {total} le {date} », sans retenue. *(A40, D39.)*

**RG-WEB-31 — Le refus est expliqué, dans l'ordre.** L'Expéditrice reçoit d'abord l'email du
refus, avec la raison choisie par le Voyageur traduite dans sa langue, puis celui du remboursement
émis, du montant intégral.

**RG-WEB-32 — Un refus au pickup n'est pas une annulation fautive.** La ligne de faits du Voyageur
(« n annulations tardives ») ne bouge pas, ni maintenant ni au prochain recalcul de réputation.
*(ANO-WEB-10.)*

**RG-WEB-33 — Les kilos refusés reviennent au trajet**, immédiatement, sans geste du Voyageur.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 35 | Deal accepté, « Refuser le colis », raison, confirmation | fenêtre avec le rappel « ne pénalise jamais ta réputation », toast, statut CANCELLED, remboursement = total | oui |
| 36 | Mes envois, Finances de l'Expéditrice | « Annulée » ; « Remboursé {total} le … », aucune retenue | oui |
| 37 | Emails de l'Expéditrice | refus avec la raison traduite, puis remboursement intégral, sans le mot « retenue » | oui |
| 38 | Page publique du Voyageur avant / après | ligne de faits identique | oui |
| 39 | Trajet du Voyageur | kilos rendus, ligne du deal « Annulé » | oui |

---

# Le destinataire — ce que WEB-E2E-6 fait respecter

*(PR `chore/e2e-parcours-6`, 10/09/2026 — cahier 01-WEB chapitre 6, D69, RGP-02.)*

## Le besoin

Le destinataire n'a pas de compte, n'a rien demandé, et n'a qu'un lien que l'Expéditeur lui a
transmis. Il doit savoir où en est le colis et quoi préparer — et ne rien apprendre d'autre :
ni adresse, ni numéro, ni code, ni photo, ni montant. Yamba ne lui écrit jamais.

## Les règles

**RG-WEB-34 — La page de suivi ne dit que l'essentiel.** Prénoms, corridor, dates, frise et
aide de l'étape ; rien d'autre, ni à l'écran, ni dans le code source, ni dans l'API (liste de
clés fermée). *(D69.)*

**RG-WEB-35 — L'aide change avec l'étape.** À l'atterrissage, elle demande de préparer le code ;
à la remise, elle dit « Bonne réception ! ».

**RG-WEB-36 — L'origine des données est dite.** La mention de confidentialité nomme
l'Expéditeur, ce qu'il a confié, à qui, et quand c'est effacé ; elle mène à la politique de
confidentialité. *(RGP-02.)*

**RG-WEB-37 — Un lien altéré ne révèle rien.** « Ce lien de suivi n'est plus valide », sans
prénom ni corridor ; l'API répond la même chose pour un jeton altéré et un jeton inventé.

**RG-WEB-38 — Yamba n'écrit jamais au destinataire.** Aucun email, aucun SMS ; le lien est
partagé par l'Expéditeur seul.

**RG-WEB-39 — Le bloc d'acquisition mène à de vrais écrans.** « Envoyer un colis » ouvre la
recherche ; « Devenir Voyageur » ouvre l'onboarding (la porte de connexion d'abord, sans compte).
*(ANO-WEB-11.)*

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 40 | Lien ouvert à chaque jalon | frise et aide qui progressent, cinq jalons datés à la remise | oui |
| 41 | Écran, source, API | aucun code, numéro, montant, lieu, photo ; huit clés exactement | oui |
| 42 | Mention de confidentialité | texte exact, lien vers la politique | oui |
| 43 | Bloc d'acquisition | recherche ; porte de connexion puis onboarding | oui |
| 44 | Jeton altéré d'un caractère | « plus valide », sans rien de plus, 404 identique à un jeton inventé | oui |
| 45 | Boîte du destinataire | aucun email ; tous les emails vont à des membres | oui |

---

# L'accueil du visiteur — ce que le chapitre 5.1 fait respecter

*(PR `chore/recette-web-5-1`, 10/09/2026 — cahier 01-WEB chapitre 5.1, WEB-ACC-1 à 12.)*

## Le besoin

Un visiteur arrive sur l'accueil sans compte. Il doit comprendre le produit en une page, chercher
un trajet en trois champs, changer de langue et de thème, lire les textes légaux, et n'être
trompé par rien : ni par un bouton qui ne fait rien, ni par une icône qui mène ailleurs. C'est le
premier geste de tout le monde, et aucun parcours du chapitre 6 ne le couvrait (ils entrent par
l'adresse d'un trajet).

## Les règles

**RG-WEB-40 — « Rechercher » cherche.** Depuis l'accueil, deux villes et « Rechercher » ouvrent
la page de résultats, qui interroge exactement ce qui a été saisi — sans second clic.
*(ANO-WEB-12.)*

**RG-WEB-41 — Une ville choisie dans la liste est cherchée par son nom.** Le libellé « Ville,
Pays » est une aide à la lecture ; la recherche compare la ville. Le pays tapé à la main reste
cherché tel quel. *(ANO-WEB-13.)*

**RG-WEB-42 — La première liste de suggestions vient, quel que soit le rythme de frappe.**
*(ANO-WEB-14.)*

**RG-WEB-43 — Ce qui n'existe pas encore est annoncé comme tel.** Les réseaux sociaux portent
« Bientôt disponible » et ne mènent nulle part tant que les comptes n'existent pas. *(ANO-WEB-15.)*

**RG-WEB-44 — La langue affichée est la langue déclarée.** `<html lang>` suit la bascule, au
rendu comme après un clic. *(ANO-WEB-16.)*

**RG-WEB-45 — La porte d'identité se referme sans conséquence.** « Plus tard », Échap et le
fond referment ; la page est intacte, rien n'est parti vers le serveur.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 46 | Accueil visiteur | en-tête, barre, pied de page, aucun squelette, console propre hors sonde | oui |
| 47 | FR → EN → FR, rechargement | `/en` puis `/fr`, `lang` fidèle, aucune clé brute | oui |
| 48 | Thème sombre | conservé au rechargement, contraste AA, retour au clair | oui |
| 49 | CGU, confidentialité | un texte, un seul `main` | oui |
| 50 | Icônes sociales | « Bientôt disponible », aucun onglet | oui |
| 51 | « Partager un trajet » puis trois fermetures | porte par-dessus la page, refermée sans requête | oui |
| 52 | Paris → Brazzaville depuis l'accueil | `/search`, titre, deux trajets du seed | oui |
| 53 | Inversion puis « Rechercher » | Brazzaville → Paris, aucun trajet | oui |
| 54 | Accueil connecté, déconnexion | menu utilisateur ; puis « Connexion », cookies absents | oui |

---

# L'inscription — ce que le chapitre 5.2 fait respecter

*(PR `chore/recette-web-5-2`, 10/09/2026 — cahier 01-WEB chapitre 5.2, WEB-INS-1 à 16.)*

## Le besoin

Une personne crée son compte avec une adresse email et un code à six chiffres. Elle doit savoir
ce qu'on attend d'elle (champ par champ, règle par règle), ne pas pouvoir s'inscrire sans avoir
accepté les conditions, être protégée contre quelqu'un qui devinerait son code, et pouvoir se
tromper d'adresse sans conséquence. Le produit garde la trace de son consentement et de sa
langue. Le parcours Google existe mais reste fermé tant que la clé n'est pas posée.

## Les règles

**RG-WEB-46 — Pas de compte sans consentement.** La case d'acceptation est obligatoire ; sans
elle, rien ne part vers le serveur et un message le dit. Avec elle, deux lignes `ConsentLog`
(`TERMS`, `PRIVACY`) portent la version des textes, l'horodatage serveur, l'adresse IP et le
navigateur.

**RG-WEB-47 — La langue de l'écran devient la langue du compte.** Un compte créé sur `/fr` porte
`preferredLocale: "fr"` ; c'est elle qui choisit la langue des emails (D44).

**RG-WEB-48 — Le code vaut dix minutes, à l'écran comme dans l'email.** Le compte à rebours
démarre à 10:00 et l'email annonce la même validité ; un renvoi repart de 10:00 avec un NOUVEAU
code.

**RG-WEB-49 — Cinq codes faux bloquent la saisie une minute, côté serveur.** Les quatre premiers
échecs annoncent les essais restants ; le cinquième bloque, l'écran désactive la saisie, et le
blocage survit à un rechargement (le compteur vit sur le serveur, `OTP_LOCKED`). **Un renvoi de
code ne rouvre pas le compteur** : le sixième échec est le sixième.

**RG-WEB-50 — Une règle violée, une phrase.** Le mot de passe est jugé règle par règle dans
l'ordre du produit (longueur, minuscule, majuscule, chiffre, spécial, date, suite, données
personnelles) ; le message nomme la PREMIÈRE règle manquante, en une phrase, jamais « tous les
critères ». Un indicateur de force accompagne la saisie.

**RG-WEB-51 — Une adresse déjà connue est refusée sans rien envoyer.** Ni code, ni inscription
en attente, ni email à l'adresse existante ; le message sous le champ tutoie (ANO-WEB-18).

**RG-WEB-52 — Se tromper d'adresse ne coûte rien.** « Recommencer » demande confirmation, annule
l'inscription en attente et rend un formulaire vide.

**RG-WEB-53 — L'adresse en attente est affichée masquée.** L'écran du code montre
`n*********5@r***.dev` ; un écran photographié ou partagé ne livre pas l'adresse. *(Écart de
cahier consigné, décision recommandée : garder le masquage.)*

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 55 | Écran d'inscription | mention de confiance, titre, cinq champs et indices, case unique à deux liens, Google et Facebook, « Connecte-toi » | oui |
| 56 | Facebook | inerte : aucune fenêtre, requête ou erreur | oui |
| 57 | Formulaire vide | quatre messages nommés, rien ne part | oui |
| 58 | `pas-un-email` | « Saisis un e-mail valide. » au blur | oui |
| 59 | Six mots de passe fautifs | une phrase chacun, une règle chacun ; indicateur de force | oui (cas e : « minuscule », écart consigné) |
| 60 | Sans la case, puis avec | refus expliqué ; puis écran du code, 10:00 décroissant, email avec code et « 10 minutes » | oui (adresse masquée, écart consigné) |
| 61 | Cinq codes faux, rechargement | 4 → 1 restants, blocage d'une minute, saisie désactivée, `OTP_LOCKED` après rechargement | oui |
| 62 | Renvoi après la minute | « Code renvoyé », bouton temporisé, nouvel email, 10:00 ; 6e et 7e échecs : 4 puis 3 restants | oui |
| 63 | Collage du bon code | six cases remplies, `/login?verified=1`, « Compte activé », email Bienvenue ; en base TERMS + PRIVACY, `fr`, mot de passe | oui |
| 64 | Adresse d'Aminata | refus sous le champ, aucun email | oui |
| 65 | « Recommencer » | confirmation exacte, `cancel`, formulaire vide | oui |
| 66 | Google sans clé | « Connexion Google bientôt disponible », désactivé, sur les deux écrans | oui |
| 67 | Parcours Google | ⏭ sans clé ; à la main quand elle sera posée | ⏭ |

---

# Connexion et sessions — ce que le chapitre 5.3 fait respecter

*(PR `chore/recette-web-5-3`, 11/09/2026 — cahier 01-WEB chapitre 5.3, WEB-CNX-1 à 13.)*

## Le besoin

Un membre se connecte, choisit ou non de rester connecté, voit ses appareils, en déconnecte,
et confirme ses gestes sensibles par un code. Le tout sans jamais révéler si un compte existe,
sans perdre sa page quand la session expire, et sans qu'un compte suspendu puisse entrer.

## Les règles

**RG-WEB-54 — Le même refus, que le compte existe ou non.** Un mauvais mot de passe et une
adresse inconnue donnent le même statut (401) et le même message, au corps près (temps constant).

**RG-WEB-55 — Deux profils de session.** Sans « Rester connecté » : déconnexion après 60 minutes
sans activité (cookie de session). Avec : 7 jours d'inactivité, 30 jours de vie absolue (cookie
persistant). La case est **décochée** par défaut.

**RG-WEB-56 — La session expirée se rouvre sur place.** Quand la session meurt pendant qu'une
page est ouverte, une fenêtre de reconnexion se pose PAR-DESSUS ; après reconnexion, la page
reprend là où elle était. Jamais d'écran d'erreur ni de renvoi brutal.

**RG-WEB-57 — Les appareils se listent et se déconnectent.** La rubrique Sécurité liste chaque
session (navigateur + système, dernière activité, IP, « cet appareil »), permet d'en déconnecter
une (message de confirmation) ou toutes les autres ; la session déconnectée meurt à sa prochaine
action.

**RG-WEB-58 — Un geste sensible passe par une porte, et un code ouvre une fenêtre de 15 minutes.**
Changer le mot de passe, l'adresse, exporter ou effacer ses données répond 403 `SUDO_REQUIRED` ;
un code envoyé par email ouvre une fenêtre de 15 minutes, **liée à l'appareil**, qui couvre les
gestes suivants sans nouveau code — sauf le changement de mot de passe (ou d'adresse), qui la
referme.

**RG-WEB-59 — Un compte suspendu ne se connecte plus.** La connexion est refusée
(« Ton compte est suspendu… »), les sessions vivantes sont révoquées, et un email l'explique.

**RG-WEB-60 — (dette) La connexion par mot de passe doit avoir un verrou anti-force-brute.**
*(ANO-WEB-19, ouverte : à ce jour aucun verrou par compte ; décision et PR dédiées.)*

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 68 | Écran de connexion | mentions, champs, « Afficher le mot de passe », « Oublié ? », case décochée + aide, Google/Facebook, « Inscris-toi » | oui |
| 69 | Mauvais mot de passe / adresse inconnue | même 401, même corps, aucun cookie | oui |
| 70 | Connexion standard | en-tête membre, prénom, cookies ; refresh = cookie de session | oui |
| 71 | Douze mauvais essais | un verrou (429) | **non — ANO-WEB-19** |
| 72 | Cookies supprimés + action serveur | « Ta session a expiré » sur place, formulaire dans la fenêtre, reprise | oui |
| 73 | « Rester connecté » | cookie persistant (≈ 30 j), « connexion mémorisée » sur la session | oui |
| 74 | Appareils connectés | navigateur+système, activité, IP, « cet appareil » | oui |
| 75 | Déconnecter un appareil / tous les autres | message, ligne(s) disparue(s), B perd sa session | oui |
| 76 | Geste sensible | 403 SUDO_REQUIRED, porte, code, geste rejoué | oui |
| 77 | Second geste dans les 15 min | aucun nouveau code | oui (fenêtre dédiée, cf. écart) |
| 78 | Fenêtre sudo depuis un autre appareil | code redemandé | oui |
| 79 | Compte suspendu | refus, sessions révoquées, email | oui |

---

# Mot de passe et adresse email — ce que le chapitre 5.4 fait respecter

*(PR `chore/recette-web-5-4`, 11/09/2026 — cahier 01-WEB chapitre 5.4, WEB-MDP-1 à 6.)*

## Le besoin

Un visiteur qui a oublié son mot de passe le réinitialise par un code, sans qu'on lui dise si son
compte existe. Un membre change son mot de passe et son adresse email en confirmant son identité,
et ces gestes ferment ses autres sessions.

## Les règles

**RG-WEB-61 — « Mot de passe oublié » ne révèle rien.** La réponse est la même pour une adresse
connue et une adresse inconnue ; aucun email ne part pour une adresse inconnue.

**RG-WEB-62 — La réinitialisation passe par un code de 10 minutes.** Le code arrive par email,
les règles de force du mot de passe s'appliquent, et l'ancien mot de passe cesse de fonctionner.

**RG-WEB-63 — Un nouveau mot de passe doit différer de l'actuel.** Le changement est refusé sinon
(`PASSWORD_SAME_AS_CURRENT`).

**RG-WEB-64 — Changer son mot de passe ferme les autres sessions.** Un email de confirmation
part ; toutes les autres sessions tombent ; la session courante reste.

**RG-WEB-65 — Le code de changement d'adresse va sur la NOUVELLE adresse.** Une adresse déjà prise
est refusée avant tout envoi ; l'adresse du compte ne change qu'après confirmation du code reçu
sur la nouvelle adresse.

**RG-WEB-66 — L'ancienne adresse est informée, jamais sollicitée.** Après le changement, l'ancienne
reçoit une information « …a changé » sans lien ni code ; les autres sessions tombent ; la connexion
se fait avec la nouvelle adresse.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 80 | Oublié : adresse inconnue | écran avance, aucun email | oui |
| 81 | Réinitialisation | code 10 min, règles de force, nouveau OK / ancien KO | oui |
| 82 | « Retour à la connexion » | retour à /login | oui |
| 83 | Changer le mot de passe : identique | refus PASSWORD_SAME_AS_CURRENT | oui |
| 84 | Changer le mot de passe : valide | email, autres sessions fermées, courante ouverte | oui |
| 85 | Changer l'adresse : prise / libre | refus EMAIL_ALREADY_USED ; code sur la nouvelle ; compte inchangé | oui |
| 86 | Confirmer l'adresse | adresse changée, ancienne informée sans code, autres sessions fermées, connexion sur la nouvelle | oui |

---

# Profil, avatar et page publique — ce que le chapitre 5.5 fait respecter

*(PR `chore/recette-web-5-5`, 11/09/2026 — cahier 01-WEB chapitre 5.5, WEB-PRO-1 à 10.)*

## Le besoin

Un membre tient son profil (nom, date de naissance, avatar) et décide de ce qui est public.
Un Voyageur a en plus un nom affiché et une présentation. La page publique montre une identité
lisible et une réputation honnête, sans jamais exposer la date de naissance ni inventer une note.

## Les règles

**RG-WEB-67 — Les champs Voyageur sont réservés aux Voyageurs.** « Nom affiché » et « présentation »
(≤ 300 caractères) n'existent que pour un compte qui a une page Voyageur.

**RG-WEB-68 — Prénom et nom : de 2 à 40 caractères.** Hors bornes, refus sous le champ, rien n'est
écrit ; un prénom valide se reflète aussitôt dans le menu utilisateur.

**RG-WEB-69 — 16 ans au moins, et la date de naissance ne s'affiche jamais.** Moins de 16 ans
(`TOO_YOUNG`) ou date future (`IN_THE_FUTURE`) sont refusés ; la date sert Stripe, jamais la page
publique.

**RG-WEB-70 — L'avatar : 2 Mo au plus, formats image.** Un fichier trop lourd est refusé côté
navigateur, sans requête ; le retrait rend l'initiale par défaut partout et l'ancien fichier
devient introuvable chez l'hébergeur.

**RG-WEB-71 — La réputation est honnête ou tait sa jeunesse.** Un Voyageur sans avis est
« Nouveau Voyageur » (« Moins de 3 Deals terminés. »), jamais « ⭐ 0.0 · 0 deals ».

**RG-WEB-72 — L'adresse publique ne change jamais.** `/u/<slug>` est stable : un lien partagé ne
meurt pas, même après un changement de profil.

**RG-WEB-73 — Masquer sa page n'est pas se cacher d'un deal.** Masquée, la page renvoie 404 aux
autres ; le propriétaire la voit avec une mention « masquée » (ANO-WEB-21) ; ses trajets publiés
restent visibles, avec son prénom.

**RG-WEB-74 — La ville est affichée sur choix.** « Afficher ma ville » la montre puis la cache,
sans toucher au reste.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 87 | Profil Expéditeur pur | champs de base, deux bascules, pas de champs Voyageur | oui |
| 88 | Profil Voyageur | nom affiché, présentation /300, « Voir mon profil public » | oui |
| 89 | Prénom 1 / 41 / valide | refus sous le champ ; valide reflété dans le menu | oui |
| 90 | Date 12 ans / future / 30 ans | TOO_YOUNG / IN_THE_FUTURE / accepté ; jamais affichée | oui |
| 91 | Avatar > 2 Mo | refus navigateur, aucune requête | oui |
| 92 | Avatar réel (upload/retrait) | affiché puis retiré, ancien fichier introuvable | ⏭ (ImageKit) |
| 93 | Page publique Voyageur | identité, niveau nommé, pas de « 0.0 », Suivre, Signaler | oui |
| 94 | Adresse stable | `/u/slug` répond après un changement ; identité « Prénom N. » | oui (écart : nom affiché non montré) |
| 95 | Masquer la page | 404 visiteur, bannière propriétaire, trajet visible | oui |
| 96 | Afficher / masquer la ville | apparaît puis disparaît | ⏭ (seed sans ville) |

---

# Devenir Voyageur : onboarding et Stripe — ce que le chapitre 5.6 fait respecter

*(PR `chore/recette-web-5-6`, 11/09/2026 — cahier 01-WEB chapitre 5.6, WEB-VOY-1 à 7.)*

## Le besoin

Un membre devient Voyageur en deux étapes : son profil (nom affiché, présentation, téléphone,
adresse), puis la connexion de son compte de paiement via Stripe. Il peut publier des trajets dès
le profil fait ; l'argent n'est exigé qu'au moment d'accepter un deal.

## Les règles

**RG-WEB-75 — L'onboarding a deux étapes nommées.** « Votre profil » puis « Paiement » ; la
seconde ne s'ouvre qu'après la première.

**RG-WEB-76 — Le téléphone est contrôlé.** Un numéro mal formé est refusé sous le champ ; le
profil enregistré fait passer le badge du menu à « Profil à compléter ».

**RG-WEB-77 — Publier n'exige pas Stripe.** Un Voyageur au profil fait, sans Stripe, publie ses
trajets. Le verrou profil+Stripe (D31) est au moment d'**accepter** une demande.

**RG-WEB-78 — Le RIB se saisit chez Stripe, jamais chez Yamba.** L'étape Paiement mène à Stripe
Connect (Express) ; aucun IBAN n'est demandé dans un formulaire Yamba.

**RG-WEB-79 — Le retour de Stripe active le profil.** Une fois Stripe complété, le statut devient
« Voyageur actif » et un email « Ton profil Voyageur est actif » part. *(Vérifié manuellement :
la complétion Express passe par le flux hébergé de Stripe, non automatisable.)*

**RG-WEB-80 — Accepter sans onboarding complet est refusé.** Le serveur répond
`CARRIER_ONBOARDING_REQUIRED` ; rien n'est débité, la demande reste en attente. *(Verrou D31,
testé unitairement ; recette de bout en bout avec le chapitre 5.12.)*

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 97 | Entrée « Devenir Voyageur » | wizard, deux étapes, Profil active | oui |
| 98 | Étape Profil | téléphone mal formé refusé ; badge « Profil à compléter » | oui |
| 99 | Publier sans Stripe | trajet PUBLISHED | oui |
| 100 | Étape Paiement | « Connecter avec Stripe », aucun IBAN, redirection stripe.com | oui |
| 101 | Retour de Stripe | « Voyageur actif » + email | ⏭ manuel (Express hébergé) |
| 102 | Accepter sans onboarding | refus, rien débité | ⏭ (5.12 ; D31 unit-testé) |
| 103 | Voir mes virements sur Stripe | tableau de bord (nouvel onglet) / « Finalise d'abord » | ⏭ manuel |


---

# Publier un trajet et son cycle de vie — ce que le chapitre 5.7 fait respecter

*(PR `chore/recette-web-5-7` (#272), 11/09/2026 — cahier 01-WEB chapitre 5.7, WEB-TRJ-1 à 21.)*

## Le besoin

Un Voyageur décrit son trajet en trois étapes (trajet, conditions, vérification), le garde en
brouillon aussi longtemps qu'il veut, le publie quand il est complet, puis le pilote : masquer,
remettre en ligne, annuler, restaurer, archiver, dupliquer. Ce qu'il peut faire dépend de l'état
du trajet et de ce qu'il porte ; c'est le serveur qui le dit, l'écran ne fait que le refléter.

## Les règles

**RG-WEB-81 — Trois étapes, un brouillon à tout moment.** « Trajet », « Conditions »,
« Vérification » ; « Brouillon » est disponible dès l'ouverture. Les justificatifs se déposent
dès l'étape 1.

**RG-WEB-82 — Le prix au kilo est pré-rempli et borné, la suggestion ne bloque jamais.** Curseur
de 5 à 20 €/kg ; une ancre de marché (basse / médiane / haute) et un verdict (« Prix juste »,
« Sous le marché », « Au-dessus ») ; tout prix reste enregistrable.

**RG-WEB-83 — Le gain net suit la capacité et le prix.** Curseur de 2 à 30 kg ; « Si tes N kg
partent — N × prix — net, versé à J+4 après livraison » ; plancher de 8 € par envoi ; tolérance de
poids ≤ 10 % au pickup.

**RG-WEB-84 — Huit familles, toutes acceptées par défaut.** Chaque famille est acceptée,
surchargée (en %) ou refusée ; le résumé replié nomme exactement les écarts.

**RG-WEB-85 — Un forfait bagage exige la capacité correspondante et un montant positif.** Soute
23 kg, cabine 12 kg : sous le seuil la ligne est grisée (« Monte ta capacité à … ») ; au-dessus,
un équivalent au kilo est affiché ; un forfait à 0 € est refusé par le serveur. L'incohérence
forfait / capacité est refusée **brouillon compris** (RG-WEB-88).

**RG-WEB-86 — Les lieux dépendent du mode de transport, et il en faut un de chaque pour publier.**
Avion : aéroport et ville ; train : gare et ville. Modes « Exact », « Rayon n km », « Ville
entière ». Sans lieu de remise ou de livraison, la publication est refusée avec son code.

**RG-WEB-87 — Il n'y a pas de réservation instantanée.** Chaque demande passe par l'accord du
Voyageur, sous 24 h.

**RG-WEB-88 — Le brouillon accepte l'incomplet, sauf l'incohérence bagage.** Un brouillon avec
le seul itinéraire est enregistré ; un forfait soute avec 5 kg de capacité est refusé même en
brouillon.

**RG-WEB-89 — Chaque garde de publication a un code, et le trajet reste en brouillon.** Date
manquante, date passée, prix ou capacité manquants, lieu de remise ou de livraison manquant :
refus avec `details.code`, statut inchangé.

**RG-WEB-90 — Masquer et remettre en ligne sont réversibles et visibles.** Masqué = hors
recherche, badge « Masqué » / « Hidden » ; remis en ligne = réapparaît, « En ligne » / « Online ».
Jamais les libellés d'une version antérieure.

**RG-WEB-91 — L'écran n'offre que ce que le serveur permet.** `allowedActions` fait foi : un
brouillon ne se masque ni ne s'annule ; un trajet réservé ne se modifie pas (`TRIP_NOT_EDITABLE`
si l'on force) ; un archivé ne se restaure pas.

**RG-WEB-92 — Annuler un trajet qui porte un deal vivant est refusé (D72).** À l'écran comme par
l'API : `409 TRIP_HAS_ACTIVE_DEALS`, le nombre de deals est nommé, le trajet reste en ligne. Un
trajet libre s'annule, se restaure en brouillon si son départ n'est pas passé, s'archive
irréversiblement ; dupliquer est toujours permis et crée un nouveau brouillon.

**RG-WEB-93 — Le Voyageur ne réserve pas son propre trajet.** Sur sa page publique : « C'est
votre trajet », modifier / gérer, aucun « Réserver ».

**RG-WEB-94 — « Masqué par Yamba » s'impose au Voyageur.** Bandeau sur le détail ; page publique
introuvable pour les autres ; hors recherche ; le Voyageur ne lève pas le masquage.

**RG-WEB-95 — Modifier un trajet rouvre TOUTES ses valeurs, quel que soit le canal qui l'a
créé.** Les dates et heures sont dérivées de l'instant enregistré quand les chaînes saisies
manquent (ANO-WEB-22).

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 104 | Ouvrir « Créer un trajet » | trois étapes, « Brouillon », trois modes | oui |
| 105 | Étape 1 : mode, itinéraire, dates | heures locales à chaque lieu | ⏭ Google ; ANO-WEB-23 ouverte |
| 106 | Prix au kilo | pré-rempli, 5–20, ancre et verdict | oui (« Ton prix = ton net » à trancher) |
| 107 | Capacité et gain | 2–30, 23 × 11,50 = 264,50, J+4, 8 €, ≤ 10 % | oui |
| 108 | Huit familles | résumé exact ; les huit dépliées | oui |
| 109 | Forfaits bagage | grisés sous 23 / 12 kg ; ≈ €/kg ; 0 refusé | oui |
| 110 | Lieux | rendus ; cartes par mode ; Exact / Rayon / Ville entière | oui |
| 111 | Réservation instantanée | absente ; « ton accord sous 24 h » | oui |
| 112 | Vérification | « Prix & capacité », « Aperçu public » | oui |
| 113 | Publier | PUBLISHED, « En ligne », trouvable | oui |
| 114 | Brouillon incomplet / incohérence bagage | 201 DRAFT / refus brouillon compris | oui |
| 115 | Gardes a → f | code par garde, reste DRAFT | oui |
| 116 | Masquer / remettre en ligne | PAUSED hors recherche, PUBLISHED de retour, badges FR/EN | oui |
| 117 | Actions permises | selon l'état ; `edit` absent si réservé | oui |
| 118 | Trajet réservé | `TRIP_NOT_EDITABLE` | oui |
| 119 | Annuler avec deal vivant | 409, message, reste en ligne (écran + API) | oui |
| 120 | Annuler un trajet libre | CANCELLED, hors recherche | oui |
| 121 | Restaurer puis archiver | DRAFT ; ARCHIVED irréversible | oui |
| 122 | Dupliquer | nouveau brouillon, original inchangé | oui |
| 123 | Sa propre page publique | « C'est votre trajet », pas de « Réserver » | oui |
| 124 | Masqué par Yamba | bandeau ; introuvable ; hors recherche | oui (email non vérifié) |


---

# Justificatifs et billet vérifié — ce que le chapitre 5.8 fait respecter

*(PR `chore/recette-web-5-8` (#273), 11/09/2026 — cahier 01-WEB chapitre 5.8, WEB-DOC-1 à 6.)*

## Le besoin

Un Voyageur joint des justificatifs à son trajet (billet, itinéraire…). Le billet suit un cycle
de vérification par l'équipe : en vérification, vérifié (badge public « Billet vérifié »), ou
rejeté avec un motif expliqué — et il peut être redéposé. Le badge rassure l'Expéditeur ; il
n'est jamais une condition pour publier ni pour réserver.

## Les règles

**RG-WEB-96 — Au plus 5 documents par trajet, 5 Mo chacun, PDF / JPG / PNG / HEIC.** Le
navigateur refuse avant tout envoi et le dit (« Le fichier dépasse 5 Mo. ») ; à la limite, l'écran
l'explique ; le serveur refuse de toute façon (`DOCUMENT_LIMIT_REACHED`, `DOCUMENT_TOO_LARGE`).

**RG-WEB-97 — Quatre statuts de billet.** « Non soumis » → « En vérification » dès qu'un billet
est déposé → « Vérifié » ou « Rejeté » par l'équipe ; un nouveau dépôt après rejet repasse « En
vérification ». Retirer le dernier billet ramène à « Non soumis ».

**RG-WEB-98 — Seule l'équipe valide ou rejette.** Permission `tickets.review` (SUPPORT,
MEDIATOR) ; jamais son propre billet ; un document déjà examiné ne se réexamine pas.

**RG-WEB-99 — Un rejet a toujours un motif fermé, expliqué en clair.** Illisible, dates
différentes, nom différent, document non recevable ; l'email au Voyageur nomme le motif dans sa
langue, jamais un code.

**RG-WEB-100 — La validation se voit et s'annonce.** Statut « Vérifié » pour le Voyageur, badge
« Billet vérifié » sur la page publique et dans la recherche, email de confirmation dans la langue
du Voyageur.

**RG-WEB-101 — Le billet ne bloque rien.** Publier et réserver fonctionnent sans billet vérifié ;
un trajet rejeté reste en ligne.

**RG-WEB-102 — Un email métier qui ne part pas laisse une trace.** Aucun envoi best-effort n'est
silencieux : l'échec est journalisé.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 125 | Déposer deux justificatifs | listés ; « En vérification » | oui (type non choisissable : ANO-WEB-24 ouverte) |
| 126 | > 5 Mo ; 6ᵉ document | refus dit, rien envoyé ; limite dite ; 400 serveur | oui |
| 127 | Statut du billet de `bzv-upcoming` | « En vérification » | oui |
| 128 | Billet validé | « Vérifié », badge public, email FR | oui |
| 129 | Billet rejeté (motif) | « Rejeté », email en clair, nouveau dépôt → « En vérification » | oui |
| 130 | Sans billet vérifié | publiable, réservable, badge absent | oui |


---

# Recherche, filtres, tri, état vide — ce que le chapitre 5.9 fait respecter

*(PR `chore/recette-web-5-9` (#274), 11/09/2026 — cahier 01-WEB chapitre 5.9, WEB-RCH-1 à 15.)*

## Le besoin

Un Expéditeur trouve un trajet : liste complète ou corridor, prix lisible pour SON colis, tris,
familles acceptées, filtres de confiance ; et quand il n'y a rien, une alerte. La page publique
d'un trajet dit tout ce qu'il faut pour réserver. Ce qui a disparu ou est sanctionné disparaît
sans rien révéler.

## Les règles

**RG-WEB-103 — La liste complète a un titre, un sous-titre et des onglets de mode.** « Tous les
trajets disponibles » ; seuls les trajets EN LIGNE à venir y sont ; « Charger plus » au-delà de
dix.

**RG-WEB-104 — Le titre suit les critères.** Départ seul, arrivée seule, date seule, corridor.

**RG-WEB-105 — Une carte au kilo dit le prix, la place et un exemple.** « prix au kilo »,
« n €/kg », « n kg dispo », « ex. 2 kg ≈ … € tout compris » ; jamais un prix à zéro, jamais un
tiret d'heure, jamais une note à 0,0 ; un compteur de vues seulement au-dessus de zéro.

**RG-WEB-106 — Le poids du colis recalcule prix et tri.** Curseur 0,5–30 kg ; « Prix et tri
calculés pour n kg · trajets sans assez de place exclus » ; « Plus assez de place » quand les
kilos restants manquent ; exclusion quand la capacité totale manque ; poids mémorisé sur
l'appareil et repris par la réservation.

**RG-WEB-107 — Sans poids, le prix comparable est celui d'un colis de 2 kg.** transport
`max(2 × €/kg, 8 €)` + service `max(12 %, 3 €)`.

**RG-WEB-108 — Trois tris, calculés par le serveur.** Départ le plus tôt, prix le plus bas (pour
le poids en cours, trajets sans prix exclus), mieux notés (jamais de note fictive).

**RG-WEB-109 — Le filtre famille exclut les refus et annonce les suppléments avant le clic.**
Plusieurs familles = toutes acceptées ; un trajet sans position accepte tout ; chaque puce porte
son compte, une puce à 0 est désactivée.

**RG-WEB-110 — Un filtre de confiance sans candidat est masqué, pas grisé.**

**RG-WEB-111 — Une recherche sans résultat propose une alerte.** « Aucun trajet ne correspond ? »
+ « Créer une alerte pour ce trajet ». *(Écart consigné : le titre « Aucun trajet trouvé » et le
message « filtres » sont alors remplacés — à trancher.)*

**RG-WEB-112 — Une erreur de chargement est dite sans jargon et se réessaie.**

**RG-WEB-113 — La page publique d'un trajet dit tout pour réserver.** Voyageur, mode, ancienneté,
prix au kilo, place, familles avec leur statut, forfaits, estimation (2 kg ou poids mémorisé) tout
compris, plancher, lieux, politique d'annulation, objets interdits, « Réserver », « Signaler » ;
jamais « Réservation bientôt disponible ».

**RG-WEB-114 — Une vue par visiteur et par jour.** Rien n'est affiché à zéro.

**RG-WEB-115 — Un trajet disparu répond « introuvable » sans rien révéler.** Annulé, masqué ou
inexistant : même page, même 404.

**RG-WEB-116 — La suspension d'un compte retire ses trajets par lecture.** Aucune écriture sur le
trajet ; la levée les fait revenir.

**RG-WEB-117 — Un avatar distant ne fait pas tomber une page** (ANO-WEB-27) ; **tout membre peut
poser son avatar** (ANO-WEB-28, ouverte).

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 131 | Liste complète | titre, sous-titre, onglets, trajets à venir | oui (compteur « Résultats disponibles » absent : à trancher) |
| 132 | Titres dynamiques | quatre formes | oui |
| 133 | Carte au kilo | 11,50 €/kg · 23 kg · ex. 2 kg ≈ 26 € · rien à zéro | oui |
| 134 | Poids 3 kg | 38,64 € (API) / ≈ 39 € (carte), exclusions, mémorisé | oui |
| 135 | Tout effacer | 2 kg, 26 € / 22 € | oui |
| 136 | Trois tris | ordre = API | oui |
| 137 | Familles | refus exclu, +20 % annoncé, comptes | oui |
| 138 | Confiance | lignes à 0 masquées | oui (branche « proposé » non exercée) |
| 139 | État vide | bloc alerte | oui (titre remplacé : à trancher) |
| 140 | Vide par filtres | message + Tout effacer | oui (jamais avec un corridor : à trancher) |
| 141 | Erreur | message, Réessayer | oui |
| 142 | Page publique | tout le bloc, Réserver, pas de « bientôt » | oui (statuts en infobulle : à trancher) |
| 143 | Vues | une par visiteur/jour | oui |
| 144 | Trajet annulé | introuvable, 404 | oui |
| 145 | Compte suspendu | trajet absent, intact en base | oui |
| 146 | Avatar distant | la page tient | oui (ANO-WEB-27 close) |
| 147 | Second avatar | 200 | **non** — 500 P2002 (ANO-WEB-28 ouverte, `test.fail`) |


---

# Alertes de route — ce que le chapitre 5.10 fait respecter

*(PR `chore/recette-web-5-10` (#275), 11/09/2026 — cahier 01-WEB chapitre 5.10, WEB-ALR-1 à 9.)*

## Le besoin

Un Expéditeur qui ne trouve pas son trajet aujourd'hui veut être prévenu le jour où un Voyageur
le publie : il pose une alerte (corridor, période, email, villes proches), et Yamba lui écrit dès
qu'un trajet correspond — sans le harceler, sans prévenir le Voyageur de sa propre publication.

## Les règles

**RG-WEB-118 — Une alerte = un corridor, une période, deux options.** Départ et arrivée
différents, période « 3 mois » (recommandée), « 6 mois », « Sans limite » ou personnalisée ;
« Recevoir un email » et « Inclure les trajets proches » actives par défaut.

**RG-WEB-119 — Une alerte incomplète ou en double est refusée.** Sans les deux villes, rien ne
part ; même ville → refus ; même corridor déjà actif → refus.

**RG-WEB-120 — Une publication qui correspond déclenche UN email, dans la langue du membre.**
« Nouveau trajet {départ} → {arrivée} », lien vers le trajet ; la période de l'alerte borne le
départ du trajet.

**RG-WEB-121 — Jamais au Voyageur lui-même.** Une alerte portée par l'auteur du trajet ne le
notifie pas.

**RG-WEB-122 — Jamais deux fois en 24 heures** pour une même alerte.

**RG-WEB-123 — Les villes proches (< 50 km, même pays) ne comptent que si l'option est activée ;
au-delà de 50 km, jamais.** Le niveau exact (place ou ville + pays) compte toujours.

**RG-WEB-124 — Une alerte se prolonge de 6 mois et se supprime en deux gestes.** « Prolonger »
proposé quand elle expire sous 7 jours ; « Supprimer » puis « Confirmer » ; chaque geste est
confirmé par un message et le compteur suit.

**RG-WEB-125 — Au plus 20 alertes actives par membre.** La 21ᵉ est refusée avec le plafond
nommé.

**RG-WEB-126 — La recherche propose l'alerte.** Bloc « Créer une alerte » sans résultat, bannière
« Reste informé·e des futurs trajets » en fin de liste.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 148 | Écran vide | titres, état vide, « Créer ma première alerte » | oui |
| 149 | Créer une alerte | panneau, périodes, bascules, carte avec badges | oui (villes par l'API) |
| 150 | Refus | sans villes, même ville, doublon | oui |
| 151 | Publication correspondante | email FR à l'Expéditrice, rien au Voyageur | oui |
| 152 | Second trajet sous 24 h | aucun email | oui |
| 153 | Trajets proches | rien sans l'option, email avec, jamais au-delà de 50 km | oui |
| 154 | Prolonger / supprimer | +6 mois, suppression confirmée, compteur | oui (ANO-WEB-29 close) |
| 155 | Plafond | 21ᵉ refusée, plafond nommé | oui |
| 156 | Bannière de recherche | en fin de liste | oui |


---

# Favoris et Voyageurs suivis — ce que le chapitre 5.11 fait respecter

*(PR `chore/recette-web-5-11` (#276), 11/09/2026 — cahier 01-WEB chapitre 5.11, WEB-FAV-1 à 12.)*

## Le besoin

Un Expéditeur met un trajet de côté (favori privé, lié à son compte) et suit un Voyageur pour être
prévenu de ses prochains trajets. Les deux gestes sont immédiats, réversibles, et ne concernent
jamais son propre trajet ni sa propre page.

## Les règles

**RG-WEB-127 — Le cœur d'un visiteur ouvre la porte d'identité et REPREND le geste.** Après
connexion dans la fenêtre, le favori est enregistré et l'on reste sur la même page.

**RG-WEB-128 — Un favori s'ajoute et se retire immédiatement.** Le cœur change sans attendre ;
« Mes favoris » liste le trajet avec la même carte que la recherche ; un favori est privé.

**RG-WEB-129 — Jamais son propre trajet.** Refus dit (`OWN_TRIP`).

**RG-WEB-130 — Un trajet indisponible ne s'ajoute pas ; le retrait reste toujours possible.**
Non publié, annulé ou masqué par Yamba : `TRIP_NOT_FAVORITABLE` ; le favori existant survit et sa
fiche répond « introuvable ».

**RG-WEB-131 — Un favori survit à la fin du trajet, avec le badge « Trajet passé ».**

**RG-WEB-132 — Suivre un Voyageur active, par défaut, l'email à sa prochaine publication.**
Bouton « Suivre » → « Suivi », compteur d'abonnés, bascule « Me notifier au prochain trajet ».

**RG-WEB-133 — La publication d'un Voyageur suivi envoie un email à ses abonnés notifiés**, dans
leur langue ; l'alerte de route est un mécanisme distinct (deux emails possibles).

**RG-WEB-134 — Couper la notification ne désabonne pas.** Aucun email, abonnement conservé.

**RG-WEB-135 — Se désabonner se confirme et se dit.** « Ne plus suivre » → « Confirmer » → « Tu
ne suis plus ce voyageur » ; le compteur d'abonnés suit.

**RG-WEB-136 — On ne se suit pas soi-même.** Pas de bouton ; appel forcé refusé
(`CANNOT_FOLLOW_SELF`).

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 157 | Cœur d'un visiteur | porte, connexion dans la fenêtre, favori enregistré, même page | oui |
| 158 | Ajouter / retirer | immédiat, liste, info-bulles | oui |
| 159 | Propre trajet | refus dit, 403 | oui |
| 160 | Trajet annulé | introuvable, ré-ajout 409, retrait 200 | oui |
| 161 | Trajet masqué | ajout 409 | oui (ANO-WEB-32 close) |
| 162 | Trajet passé | listé + « Trajet passé » | oui (ANO-WEB-30 close) |
| 163 | Favoris vides | état vide + CTA | oui |
| 164 | Suivre | Suivi, abonnés +1, bascule cochée, liste | oui |
| 165 | Email d'abonné | « vient de publier un nouveau trajet », FR | oui |
| 166 | Notification coupée | aucun email, abonnement gardé | oui |
| 167 | Se désabonner | toast, ligne retirée, abonnés −1 | oui (ANO-WEB-31 close) |
| 168 | Soi-même / vide | pas de Suivre, 400 ; état vide | oui |


---

# Réserver : l'assistant en quatre étapes et le devis — ce que le chapitre 5.12 fait respecter

*(PR `chore/recette-web-5-12` (#277), 11/09/2026 — cahier 01-WEB chapitre 5.12, WEB-RSV-1 à 22.)*

## Le besoin

Un Expéditeur décrit son colis, désigne le destinataire, s'engage, autorise le paiement. Le prix
qu'il voit est celui que le serveur figera ; rien n'est débité avant l'accord du Voyageur ; il ne
peut réserver ni son propre trajet, ni un trajet parti, masqué ou plein.

## Les règles

**RG-WEB-137 — La porte de réservation reprend le colis et le trajet après connexion.**

**RG-WEB-138 — Quatre étapes nommées, deux retours distincts, un récapitulatif toujours visible.**

**RG-WEB-139 — Les lieux du trajet sont proposés ; un lieu unique est pré-sélectionné ; sans lieu,
l'écran le dit.**

**RG-WEB-140 — Les règles d'or et la liste des produits interdits sont à portée de clic.**

**RG-WEB-141 — Le produit dépend de l'offre du trajet** (colis au kilo, bagage soute si proposé,
cabine si proposé) ; **une famille refusée est visible, barrée et expliquée** ; un supplément
s'annonce avant le choix.

**RG-WEB-142 — Le poids est pré-rempli (2 kg ou poids mémorisé), jamais vide ; 30 kg maximum ;
jamais plus que les kilos restants.**

**RG-WEB-143 — Le devis suit la note de calcul au centime** : taille (S ×1, M ×1,1, L ×1,25),
supplément de famille, plancher 8 € (0,5 kg facturé minimum), service max(12 %, 3 €).

**RG-WEB-144 — La description fait 5 caractères au moins ; au plus 5 photos de 10 Mo, refusées
dès la sélection ; les deux premières sont « Contenu » et « Emballé ».**

**RG-WEB-145 — Deux protections : de base (incluse) et Garantie Yamba 500 € (+6 €, photo
obligatoire). Le mot « assurance » n'apparaît jamais.**

**RG-WEB-146 — Un bagage entier est un forfait** : ni poids ni taille, service 12 %.

**RG-WEB-147 — Le récapitulatif ne montre jamais zéro** : sans poids ou sans taille, un indice.

**RG-WEB-148 — Le destinataire n'a pas de compte** ; téléphone d'abord (indicatif, numéro
valide), email facultatif ; le code de livraison lui sera transmis.

**RG-WEB-149 — Une seule case vaut Charte, CGV et Contrat de transport ; sans elle, pas de
paiement.**

**RG-WEB-150 — Le paiement est une autorisation** (débit à l'acceptation, sous 24 h) ; un seul
composant de paiement ; « Payer {montant} ».

**RG-WEB-151 — La demande envoyée réserve les kilos et prévient chacun de ce qui le concerne**
(l'Expéditrice son total, le Voyageur son gain net, jamais l'inverse).

**RG-WEB-152 — Le serveur a le dernier mot** : devis divergent → nouveau total affiché, rien de
posé ; dernier kilo → refus sans trace ; son propre trajet, un trajet parti ou masqué → refus à
l'ouverture ; l'assistant survit à un rechargement.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 169 | Porte visiteur | par-dessus la page, puis pleine page | oui |
| 170 | Entrée | étapes, titres, retours, colonne collante | oui |
| 171 | Lieux | pré-sélectionnés, types en clair | oui |
| 172 | Règles d'or | quatre puces + liste | oui |
| 173 | Produit / famille refusée | soute 230 €, cabine absent, refus expliqué, +20 % | oui |
| 174 | Poids | 2 par défaut, 35 refusé, borne des kilos restants | oui (ANO-WEB-34 close) |
| 175 | Taille | S 32,20 · L 40,25 | oui |
| 176 | Supplément / plancher | 38,64 · 11 | oui |
| 177 | Description / photos | min. 5 ; tags ; > 10 Mo refusé à la sélection | oui (ANO-WEB-39 close) |
| 178 | Protection | 38,20 ; photo requise ; jamais « assurance » | oui (ANO-WEB-33 close) |
| 179 | Bagage entier | 257,60, champs masqués | oui |
| 180 | Jamais zéro | indices seuls | oui (ANO-WEB-37 close) |
| 181 | Destinataire | téléphone d'abord, 12 refusé, email optionnel | oui |
| 182 | Engagement | une case, bloqué sans elle | oui |
| 183 | Paiement | textes, Payer 32,20 €, un seul composant | oui |
| 184 | Carte refusée | erreur, rien créé | ⏭ (FAKE ; recette API) |
| 185 | Demande envoyée | suivi, −2,5 kg, deux emails | oui |
| 186 | Devis divergent | message, 42 €, rien créé | oui (ANO-WEB-36 close) |
| 187 | Dernier kilo | A créée, B refusée sans trace | oui |
| 188 | Propre trajet | refus à l'ouverture | oui (ANO-WEB-35 close) |
| 189 | Parti / masqué | refus à l'ouverture / introuvable | oui (ANO-WEB-38 close) |
| 190 | Rechargement | saisies retrouvées | oui |

---

# Les plafonds du compte neuf — ce que le chapitre 5.13 fait respecter

*(PR `chore/recette-web-5-13` (#278), 11/09/2026 — cahier 01-WEB chapitre 5.13, WEB-TRU-1 à 5.)*

## Le besoin

Un compte de moins de 30 jours qui n'a pas trois envois terminés ne peut pas engager la plateforme
au-delà de ce qu'un premier essai justifie : 300 € déclarés, 10 kg, cinq envois par mois. Le refus
tombe avant tout argent, avec un message unique et sans jugement ; un compte ancien n'a aucun
plafond ; le score interne qui fonde ces niveaux ne se voit jamais.

## Les règles

**RG-WEB-153 — Trois plafonds pour un compte neuf** (moins de 30 jours ET moins de trois envois
terminés) : 300 € déclarés par colis, 10 kg par colis, cinq demandes par mois civil — les trois
sont des paramètres de la plateforme (`trust.newAccount.*`, D62).

**RG-WEB-154 — Le refus tombe à l'autorisation de paiement**, avant tout débit, toute empreinte,
tout email : rien n'est créé, « Mes envois » et Finances restent vides.

**RG-WEB-155 — Un seul message pour les trois plafonds**, tutoyé, qui dit que le plafond se lève
avec les premiers envois terminés ; à côté, « Réessayer » — et jamais un bouton « Payer » actif.

**RG-WEB-156 — La valeur ou le poids corrigés juste sous le plafond passent** ; la cinquième demande
du mois passe, la sixième est refusée.

**RG-WEB-157 — Un paramètre modifié par le back-office prend effet en moins de 30 secondes**, est
journalisé (`SETTING_CHANGED`, motif ≥ 20 caractères, verrou de version) et prévient les super
administrateurs par email ; il n'est jamais rétroactif.

**RG-WEB-158 — Un compte ancien n'a aucun plafond** : 12 kg à 450 € passent sans refus.

**RG-WEB-159 — Le score interne n'est jamais visible ni servi au membre** : ni sur un écran, ni dans
l'export de ses données, ni dans une réponse d'API ; le seul signal est le message de plafond.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 191 | 450 € déclarés, compte neuf | refus à l'intention, message, rien nulle part ; 250 € passe | oui (ANO-WEB-40 close) |
| 192 | 12 kg, compte neuf | refus, même message ; 8 kg passe | oui |
| 193 | Sixième demande du mois | refusée dès l'autorisation ; plafond relevé par l'OPS → passe en 6 s ; remis | oui |
| 194 | Compte de 90 jours, 12 kg à 450 € | aucun refus | oui |
| 195 | Écrans, API, export du compte neuf | aucun score, niveau, point, plafond chiffré | oui |

---

# La demande côté Voyageur : accepter, refuser, expirer — ce que le chapitre 5.14 fait respecter

*(PR `chore/recette-web-5-14` (#279), 11/09/2026 — cahier 01-WEB chapitre 5.14, WEB-DEA-1 à 9.)*

## Le besoin

Un Voyageur qui reçoit une demande la voit partout où il agit (accueil, ses trajets, la cloche), lit
tout ce qu'il doit savoir avant de s'engager — et rien de ce qui ne le regarde pas —, s'engage par la
Charte, accepte (l'argent est capturé, l'Expéditrice prévenue) ou refuse sans pénalité ; une demande
expirée ne s'accepte plus ; deux décisions concurrentes ne créent jamais deux vérités.

## Les règles

**RG-WEB-160 — Une demande reçue apparaît sur l'accueil, dans « Mes trajets » (bande « À traiter »,
badge « Demande » sur le trajet) et dans la cloche**, avec le gain net, le poids et le délai restant ;
il n'existe pas d'onglet « demandes » séparé.

**RG-WEB-161 — Le Voyageur lit le net (« TU GAGNES »), jamais le total payé par l'Expéditrice ni la
commission**, ni à l'écran ni dans ce que l'API lui répond ; le mot « assurance » n'apparaît jamais.

**RG-WEB-162 — La demande dit d'où elle vient, ce qu'elle contient (catégorie, poids, valeur,
description, photos), où remettre et livrer, et le délai de réponse** ; la puce du délai devient une
alerte à moins de deux heures.

**RG-WEB-163 — La Charte Voyageur est obligatoire** : sans la case, refus explicite ; six engagements et
la phrase de responsabilité sont lus avant d'accepter.

**RG-WEB-164 — Accepter capture le paiement et prévient l'Expéditrice** (notification, email avec le
montant), ouvre « Mon Deal accepté » (cinq jalons, contact, paiement à J+4) et le fil de messagerie.

**RG-WEB-165 — Refuser ne pénalise pas** : cinq raisons fermées, aucun texte libre, l'Expéditrice est
prévenue (bandeau, email avec la raison), l'autorisation est levée, les kilos rendus, la réputation
intacte.

**RG-WEB-166 — Une demande dont la date limite est passée ne s'accepte plus, avant même le cron** (409)
; le cron prévient ensuite l'Expéditrice (bandeau, email « a expiré »).

**RG-WEB-167 — Deux décisions concurrentes** : la seconde est refusée (409), l'écran le dit et se relit
sur l'état réel ; un seul débit.

**RG-WEB-168 — Un deal fermé nomme son état et n'offre aucune action** ; le code de livraison
n'apparaît jamais côté Voyageur, ni à l'écran ni dans le DTO.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 196 | Où la demande apparaît | accueil, Mes trajets, cloche, dates justes | oui (ANO-WEB-41 close) |
| 197 | L'écran de la demande | blocs, net seul, puce ambre/rouge | oui (ANO-WEB-42 close ; ANO-WEB-43 ouverte) |
| 198 | Charte obligatoire | refus sans case, six engagements | oui |
| 199 | Accepter | écran accepté, notification, email, capture, fil | oui |
| 200 | Refuser | cinq raisons, aucun texte libre, email, kilos, aucune pénalité | oui |
| 201 | Expirée | 409 avant le cron, bandeau et email après | oui |
| 202 | Deux onglets | 409, toast, relecture, un débit | oui |
| 203 | États fermés | bandeau + aucune action | oui |
| 204 | Mon Deal accepté | blocs, code secret nommé Clarisse, aucun code | oui (ANO-WEB-44 close) |

---

# Messagerie, rendez-vous et numéro de téléphone — ce que le chapitre 5.15 fait respecter

*(PR `chore/recette-web-5-15` (#280), 11/09/2026 — cahier 01-WEB chapitre 5.15, WEB-MSG-1 à 22.)*

## Le besoin

Une fois le deal accepté, les deux parties s'organisent dans un fil unique par deal : messages,
rendez-vous proposés et confirmés, numéro de téléphone révélé au bon moment. Le code de livraison n'y
circule jamais, les coordonnées y sont repérées sans être bloquées, un message se signale mais ne se
supprime pas, le fil est une pièce du dossier de médiation.

## Les règles

**RG-WEB-169 — Un fil par deal, créé à l'acceptation, jamais avant** (403 `CONVERSATION_NOT_OPEN`) ; la
liste montre l'interlocuteur, le corridor, le dernier message et le rendez-vous à confirmer ; un compte
sans deal engagé lit un état vide expliqué.

**RG-WEB-170 — Un message part et arrive sans rechargement** (actualisation ≈ 3 s), à droite chez
l'auteur, groupé par jour, avec une notification in-app ; les réponses rapides (neuf, dans la langue du
compte) remplissent la saisie sans envoyer.

**RG-WEB-171 — Le code de livraison ne s'écrit jamais**, collé (« 742891 ») ou aéré (« 742 891 »,
« 74-28-91 ») : le message est refusé avec un texte en français, rien n'entre dans le fil ; un autre
groupe de six chiffres passe.

**RG-WEB-172 — Les coordonnées (téléphone, email) sont repérées, pas bloquées** : le message part sans
alerte pour l'auteur, l'équipe le voit marqué.

**RG-WEB-173 — Le rendez-vous est un objet** : proposé par l'un, accepté par l'autre (jamais par son
auteur), au moins 30 minutes à l'avance, au plus 90 jours, 12 heures au plus — les refus se lisent en
français ; une contre-proposition remplace la proposition ouverte du même type ; une proposition
postérieure à une confirmation prime et, acceptée, remplace le confirmé ; chaque étape laisse une ligne
système.

**RG-WEB-174 — Le numéro s'ouvre 2 heures avant le rendez-vous de remise confirmé (ou le départ)**,
jamais avant (400 `TOO_EARLY`, heure d'ouverture annoncée) ; révélé, il laisse UNE ligne système par
lecteur ; « Appeler » ouvre le fil, ne compose jamais ; les sept boutons de contact mènent au même fil.

**RG-WEB-175 — Un message de l'autre partie se signale** (quatre motifs, jamais deux fois, l'auteur
n'est pas prévenu) ; ses propres messages ne se signalent pas ; aucun message ne se supprime ni ne se
modifie.

**RG-WEB-176 — Le fil est en lecture seule pendant un litige et 14 jours après la fin du deal** ; il
reste lisible ; un tiers ne l'ouvre pas (403, « La conversation n'a pas pu être ouverte. »).

**RG-WEB-177 — La relance email des messages non lus** part après 15 minutes, au plus une par heure et
par conversation, sans citer le message ; la notification in-app, elle, est immédiate.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 205 | Liste, état vide, pas de fil avant acceptation | conforme, 403 | oui (écart : pas de bouton sur une demande en attente) |
| 206 | Envoyer, réponses rapides FR/EN | bulle, notification, saisie remplie | oui |
| 207 | Code de livraison collé ou aéré | refusé, texte FR, jamais dans le fil | oui (ANO-WEB-46 BLOQUANTE close, ANO-WEB-45 close) |
| 208 | Coordonnées | passent, repérées côté équipe | oui |
| 209 | Rendez-vous : proposer, bornes, contre-proposer, accepter | états, lignes système, une seule proposition | oui (ANO-WEB-45 close) |
| 210 | Numéro trop tôt / à l'heure / « Appeler » / sept boutons | 400 puis 200, une ligne, jamais `tel:` hors du fil | oui (ANO-WEB-47 close) |
| 211 | Signaler, jamais le sien, aucune suppression | 201 puis 409, rien ne change | oui |
| 212 | Litige, 14 jours, tiers | lecture seule, fermé, 403 + phrase | oui (ANO-WEB-48 close) |
| 213 | Relance email | un email sans le texte, pas deux par heure | oui (écart : la bulle compte les messages) |

---

# Prise en charge et jalons de transit — ce que le chapitre 5.16 fait respecter

*(PR `chore/recette-web-5-16` (#281), 11/09/2026 — cahier 01-WEB chapitre 5.16, WEB-PIC-1 à 10.)*

## Le besoin

Le Voyageur qui reçoit le colis compare ce qu'on lui remet à ce qui a été déclaré, le documente (cinq
points, photos), puis s'engage — ou refuse sans pénalité, l'Expéditrice étant intégralement remboursée. La
prise en charge fait naître le code de livraison chez l'Expéditrice seule. Pendant le transport, trois
jalons facultatifs, ordonnés, non répétables, rassurent l'Expéditrice sans la noyer d'emails.

## Les règles

**RG-WEB-178 — L'écran de prise en charge montre la déclaration à comparer** (catégorie, poids, valeur),
l'avertissement de responsabilité, cinq points à cocher, au moins une photo, une note libre ; le bouton
inactif dit ce qui manque.

**RG-WEB-179 — Une photo trop lourde ou d'un format inconnu est refusée à la sélection** ; un
téléversement en échec arrête tout : aucune prise en charge n'est enregistrée.

**RG-WEB-180 — Confirmer fait naître le code chez l'Expéditrice** (notification, email qui renvoie au suivi
SANS le code, code lisible dans son suivi) ; le code n'apparaît jamais côté Voyageur ; le téléphone du
destinataire s'ouvre au Voyageur.

**RG-WEB-181 — Refuser le colis annule le deal, rembourse intégralement, rend les kilos et ne pénalise
pas** : cinq raisons fermées, deux emails (refus avec la raison, remboursement avec le montant).

**RG-WEB-182 — L'écran de transit propose une seule action : le prochain jalon logique** (aéroport,
décollage, atterrissage, puis la remise) ; les jalons sont optionnels, ordonnés, non répétables, et
chacun offre cinq secondes de repentir avant de partir.

**RG-WEB-183 — Chaque jalon prévient l'Expéditrice à l'écran et dans la cloche ; seul l'atterrissage
envoie un email** (« préviens le destinataire »), sans le code.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 214 | L'écran de prise en charge | déclaration, avertissement, cartes, boutons | oui (ANO-WEB-49, 50 closes) |
| 215 | Trois points sur cinq, aucune photo | bouton inactif qui explique | oui (ANO-WEB-51 close) |
| 216 | Photo > 10 Mo, réseau coupé | refus explicite, rien d'enregistré | oui (ANO-WEB-52 close) |
| 217 | Confirmer | toast, transit, numéro ; code chez l'Expéditrice seule | oui |
| 218 | Refuser | cinq raisons, remboursement intégral, kilos, aucune pénalité | oui |
| 219 | Transit et jalons | une carte, ordre, cinq secondes, non répétables | oui |
| 220 | Côté Expéditrice | bannières, cloche, un seul email | oui (ANO-WEB-54 close ; ANO-WEB-53 ouverte) |

---

# Le code de livraison — ce que le chapitre 5.17 fait respecter

*(PR `chore/recette-web-5-17` (#282), 11/09/2026 — cahier 01-WEB chapitre 5.17, WEB-COD-1 à 8.)*

## Le besoin

Le code à six chiffres est la clé de la remise : il naît à la prise en charge, chez l'Expéditrice seule,
qui le transmet au destinataire par le canal de son choix. Elle peut le régénérer si elle pense qu'il a
fuité (cinq fois au plus), et le Voyageur ne le voit jamais — ni à l'écran, ni dans une notification, ni
dans un email, ni dans le fil. Après la remise, il disparaît.

## Les règles

**RG-WEB-184 — Avant la prise en charge, aucun chiffre** : la carte « Ton code de livraison » porte le badge
« En attente » et explique quand le code viendra et à qui le transmettre.

**RG-WEB-185 — Le code n'est lisible que par l'Expéditrice** (« CODE À TRANSMETTRE À {destinataire} »,
« Copier le code », « Régénérer le code », l'avertissement de confidentialité) ; côté Voyageur, il n'apparaît
sur aucun écran, dans aucune notification, dans aucune réponse d'API.

**RG-WEB-186 — Copier dit ce qui s'est passé** : « Code copié ! » (six chiffres, sans espace) ; en cas
d'échec de copie, un message qui parle de copie.

**RG-WEB-187 — Partager, c'est pré-remplir vers le bon destinataire** : le message (« Bonjour {destinataire} !
Ton colis arrive avec {Voyageur} ({route})… ») ; WhatsApp et SMS s'ouvrent sur le numéro saisi à la
réservation ; l'email a pour objet « Code de retrait de ton colis Yamba ».

**RG-WEB-188 — Régénérer demande confirmation, prévient et compte** : « L'ancien code ne fonctionnera plus.
Pense à renvoyer le nouveau à {destinataire}. », toast, compteur toujours visible (« 4 régénérations
restantes »), l'écran relit le serveur, un email de sécurité SANS le code.

**RG-WEB-189 — Cinq régénérations, pas une de plus, côté serveur** : « Aucune régénération restante », bouton
inactif ; un essai forcé (API ou onglet en retard) reçoit 409 `CODE_REGENERATION_LIMIT` et l'écran dit « Tu as
atteint la limite de régénérations. Contacte le support si besoin. » Le Voyageur n'a jamais de bouton.

**RG-WEB-190 — Après la remise, le code disparaît** : « Code de livraison saisi par {Voyageur} et validé »,
badge « Code validé », ni copie ni régénération.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 221 | Deal accepté, pas encore pris en charge | carte « En attente », aucun chiffre | oui |
| 222 | Deal pris en charge, côté Expéditrice puis Voyageur | code et boutons chez elle ; nulle part chez lui (neuf sources) | oui |
| 223 | Copier le code, avec et sans presse-papiers | « Code copié ! » / message d'échec juste | oui (ANO-WEB-55, 59 closes) |
| 224 | Partager | message pré-rempli, WhatsApp sur le numéro, objet de l'email | oui (ANO-WEB-56 close) |
| 225 | Régénérer | confirmation, toast, compteur, relecture, email sans le code | oui (ANO-WEB-57 close) |
| 226 | Sixième régénération (API, onglet en retard) | 409, message du plafond, code inchangé | oui (ANO-WEB-58 close) |
| 227 | Quatre écrans Voyageur | aucun bouton de régénération | oui |
| 228 | Deal livré | « saisi par … et validé », badge, plus de code | oui |

---

# La remise du colis — ce que le chapitre 5.18 fait respecter

*(PR `chore/recette-web-5-18` (#283), 12/09/2026 — cahier 01-WEB chapitre 5.18, WEB-REM-1 à 7.)*

## Le besoin

Devant le destinataire, le Voyageur saisit le code à six chiffres ; trois erreurs bloquent la saisie un quart
d'heure (le compteur vit sur le serveur, pas dans l'écran), l'Expéditrice peut débloquer en régénérant, une
photo de la remise est son assurance mais jamais une obligation, et le bon code vaut livraison : l'Expéditrice
est prévenue (cloche + email), le Voyageur aussi (cloche seule), et le versement suit la période de
vérification. Après la prise en charge, plus personne n'annule : la seule voie est le signalement.

## Les règles

**RG-WEB-191 — La remise est accessible depuis le suivi de transit à tout moment** ; les jalons de vol sont
optionnels et ne conditionnent jamais l'accès à l'écran du code.

**RG-WEB-192 — L'écran du code dit tout** : « Livraison à {destinataire} » / « {ville} · à valider avec le
code », l'encart, six cases en 3 + 3 sous « CODE DE LIVRAISON REÇU PAR {destinataire} », le bouton inactif
tant que le code est incomplet, l'aide repliable (WhatsApp / SMS, appeler l'Expéditrice, 3 essais = 15 min).

**RG-WEB-193 — Chaque code faux est compté et dit** : « Ce code n'est pas le bon… », « {n} tentatives
restantes » puis « Dernière tentative », « Tentative n sur 3 » à la ressaisie ; les cases se vident à chaque
échec ; un essai raté ne prévient personne.

**RG-WEB-194 — Trois erreurs verrouillent 15 minutes, côté serveur** : le message et le compte à rebours,
les cases inertes, le verrou survit au rechargement, et même le BON code est refusé (409 `DELIVERY_LOCKED`).

**RG-WEB-195 — Une régénération par l'Expéditrice lève le verrou et remet les essais à zéro** ; l'ancien code
ne vaut plus rien.

**RG-WEB-196 — La photo de remise est facultative, deux au plus, envoyée avant la saisie** ; elle est visible
de l'Expéditeur et de Yamba en cas de litige.

**RG-WEB-197 — Le bon code vaut livraison** : écran de succès, versement annoncé (montant net, date au plus
tard, 2 à 7 jours), pas de « Noter » avant la complétion ; l'Expéditrice reçoit cloche + email « 3 jours »
sans le code, le Voyageur une cloche sans email.

**RG-WEB-198 — Aucune annulation après la prise en charge**, ni à l'écran (liste, suivi, Voyageur) ni par
l'API ; la seule voie est le signalement.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 229 | Suivi de transit, un seul jalon confirmé | « Valider la livraison » disponible, l'écran complet | oui (ANO-WEB-60 close) |
| 230 | Deux codes faux | messages, compteur, ressaisie, cases vidées, aucune notification | oui (ANO-WEB-61 close) |
| 231 | Troisième code faux, rechargement, bon code | verrou 15 min persistant, 409 même pour le bon code | oui |
| 232 | Régénération par l'Expéditrice | verrou levé, essais à zéro, ancien code refusé | oui |
| 233 | Photos de remise | optionnel, deux au plus, envoyées à la sélection | oui |
| 234 | Bon code | livraison, succès, notifications, email sans le code, pas d'email Voyageur | oui |
| 235 | Deal pris en charge | aucune annulation, écran et API | oui |

---

# Confirmation, complétion et versement — ce que le chapitre 5.19 fait respecter

*(PR `chore/recette-web-5-19` (#284), 12/09/2026 — cahier 01-WEB chapitre 5.19, WEB-CNF-1 à 11.)*

## Le besoin

Après la remise, l'Expéditeur a trois jours pour vérifier ; le geste par défaut est de ne rien faire, la
confirmation anticipée est définitive, le signalement gèle le paiement. Passé J+4, le système clôt et verse.
Le Voyageur voit l'état exact de son versement (à venir, parti, bloqué par son compte Stripe, gelé,
renversé) ; l'Expéditeur, lui, ne voit JAMAIS l'état du versement du Voyageur — seulement « le paiement est
libéré ». Les écrans « Finances » ne recalculent rien : tout vient du serveur, et rien n'est inventé (pas de
fausse carte, pas de données de maquette).

## Les règles

**RG-WEB-199 — Le suivi d'un colis livré lit avant d'agir** : bandeau, période de vérification, compte à
rebours sobre (jamais rouge), « Tout s'est bien passé ? » avec un bouton SECONDAIRE et un conseil, le récap,
« Comment ça marche » (confirmer / ne rien faire / signaler), une carte sobre de signalement.

**RG-WEB-200 — La confirmation anticipée est définitive** : avertissement avant, confirmation en ligne
(« Oui, tout est OK » / « Annuler »), toast, « Envoi terminé » / « Transaction close », la carte de
signalement disparaît ; l'Expéditeur reçoit « Transaction terminée », le Voyageur une cloche et un email
« {montant} en route vers ton compte ».

**RG-WEB-201 — À J+4 sans action, le système clôt** : « Période de vérification terminée le {date}, sans
signalement de ta part », versement lancé, les mêmes emails ; la note du paiement dit la vérification
terminée, jamais « tu as confirmé ».

**RG-WEB-202 — Le rappel de la veille est envoyé une seule fois** (cloche + email « Dernier jour pour
vérifier ton colis »).

**RG-WEB-203 — Après J+4, ni confirmation ni signalement** ; un signalement forcé est refusé (409). *(La
confirmation reste permise jusqu'au passage du cron — ANO-WEB-63, à trancher.)*

**RG-WEB-204 — L'Expéditeur ne voit jamais un échec de versement** : « Envoi terminé » / « Le paiement de
{prénom} est libéré », aucune mention d'échec, d'attente ou de Stripe, ni au suivi ni dans Paiements. *(La
réponse brute de l'API porte encore `payoutStatus` — ANO-WEB-62, à trancher.)*

**RG-WEB-205 — Le versement bloqué est dit au Voyageur partout, en langage grossier** : carte ambre sur le
deal avec « Finaliser mon compte Stripe », bandeau en tête de « Mes trajets » qui totalise, carte « En
attente » et ligne dans le portefeuille ; jamais le message technique du prestataire.

**RG-WEB-206 — Le versement renversé est « sous examen »** : rien n'est perdu, Yamba contacte, aucun renvoi
automatique n'est proposé.

**RG-WEB-207 — Le portefeuille du Voyageur** : trois cartes (À venir / Envoyés / En attente) et des lignes à
état fermé (à venir, en cours d'envoi, en attente Stripe, gelé, parti, retenue conservée, sous examen),
libellées « Transport pour {prénom} » ou « Compensation · annulation tardive de {prénom} » ; le bloc Stripe ;
jamais une donnée de maquette.

**RG-WEB-208 — Les paiements de l'Expéditeur** : trois cartes (Bloqué chez Yamba / Dépensé / Remboursé) et des
lignes à état fermé (autorisé, bloqué, bloqué jusqu'au, libéré, jamais débité, remboursé, remboursé
partiellement avec la retenue) ; un remboursement porte toujours une date ; les totaux viennent du serveur.

**RG-WEB-209 — « TON PAIEMENT » n'affiche que ce qui est connu** : le montant débité et l'état ; jamais une
carte, un relevé ou un intitulé inventés.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 236 | Deal livré, Expéditeur | l'écran complet, bouton secondaire, compte à rebours sobre | oui |
| 237 | Confirmer la livraison | avertissement, confirmation, toast, transaction close, signalement disparu, emails + cloche | oui |
| 238 | J+4 atteint (cron) | clos par le système, versement lancé, emails, note « vérification terminée » | oui (ANO-WEB-64 close) |
| 239 | Échéance dans moins de 24 h (cron) | rappel cloche + email, une seule fois | oui |
| 240 | Échéance passée, cron pas passé | pas de signalement (écran + 409) ; confirmation encore proposée | avec réserve (ANO-WEB-63 ouverte) |
| 241 | Versement en échec, Expéditrice | aucune fuite à l'écran ; l'API brute porte encore `payoutStatus` | écrans oui, API non (ANO-WEB-62 ouverte) |
| 242 | Versement en échec, Voyageur | carte, bandeau Mes trajets, portefeuille, rien de technique | oui (ANO-WEB-66 close) |
| 243 | Transfert renversé | sous examen, aucun renvoi | oui |
| 244 | Portefeuille | cartes = serveur, 7 états, aucune maquette | oui |
| 245 | Paiements | cartes = serveur, 6 états, remboursement daté | oui (ANO-WEB-67 close) |
| 246 | Bloc « TON PAIEMENT » avec le FAKE | aucune fausse carte | oui |

---

# Les annulations — ce que le chapitre 5.20 fait respecter

*(PR `chore/recette-web-5-20` (#285), 12/09/2026 — cahier 01-WEB chapitre 5.20, WEB-ANN-1 à 9.)*

## Le besoin

L'Expéditeur peut annuler tant que le colis n'est pas pris en charge, selon un barème que le serveur calcule et
annonce avant le geste : tout (demande en attente, ou accepté à 48 h ou plus du départ), la moitié à moins de
48 h (la retenue revient au Voyageur), la moitié après le départ (la retenue est conservée à arbitrer). Le
Voyageur qui annule rembourse tout et le porte sur son profil (ANN-02). Après la prise en charge, personne
n'annule. Le suivi ne duplique pas le geste, et deux onglets ne remboursent pas deux fois.

## Les règles

**RG-WEB-210 — La fenêtre d'annulation dit le montant servi par le serveur**, la raison (intégral / retenue de
50 %), et offre « Garder l'envoi » / « Confirmer l'annulation » ; ouvrir la fenêtre ne recalcule rien.

**RG-WEB-211 — Une demande en attente s'annule sans frais** : rien n'a été débité, le toast dit « Envoi annulé. »
sans parler de remboursement, les kilos sont rendus, l'Expéditeur reçoit un email, le Voyageur une cloche seule.

**RG-WEB-212 — Un deal accepté à 48 h ou plus du départ est remboursé intégralement** : toast avec le montant,
kilos rendus, emails « annulée » puis « Remboursement émis » (montant, 5 à 10 jours ouvrés) à l'Expéditeur,
email au Voyageur, ligne « Remboursé {montant} le {date} ».

**RG-WEB-213 — À moins de 48 h, la moitié est remboursée et la retenue revient au Voyageur** : la fenêtre
l'explique, Paiements l'écrit (« retenue … reversée au Voyageur »), le Voyageur reçoit une compensation =
arrondi(retenue × net ÷ total), cloche + ligne de portefeuille.

**RG-WEB-214 — Après le départ sans prise en charge, la moitié est remboursée et la retenue est conservée à
arbitrer** : aucun versement automatique ; le Voyageur lit « Retenue conservée · on te contacte » partout. *(La
fenêtre et Paiements disent encore « reversée au Voyageur » — ANO-WEB-69.)*

**RG-WEB-215 — Le Voyageur peut annuler un deal accepté** : remboursement intégral, kilos rendus, annulation
comptée sur son profil. *(Non implémenté — ANO-WEB-68.)*

**RG-WEB-216 — Aucune annulation après la prise en charge**, d'aucun côté, ni à l'écran ni par l'API.

**RG-WEB-217 — Le suivi ramène vers « Mes envois »** et ne propose pas une seconde annulation.

**RG-WEB-218 — Une annulation refusée recharge la liste** : toast explicite, état réel, jamais un double
remboursement.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 247 | Demande en attente | fenêtre, montant intégral servi, « Envoi annulé. », kilos, email / cloche | oui (ANO-WEB-71 close) |
| 248 | Accepté à > 48 h | total, toast, kilos, trois emails, Paiements | oui |
| 249 | Accepté à < 48 h | moitié, retenue au Voyageur, compensation au centime | oui |
| 250 | Ouvrir la fenêtre | aucun appel, montant de la liste servie | oui |
| 251 | Accepté, trajet parti | moitié, retenue conservée, aucun versement, écrans Voyageur | avec réserve (ANO-WEB-69) |
| 252 | Le Voyageur annule | remboursement intégral, compteur | NON (ANO-WEB-68 ouverte) |
| 253 | PICKED_UP, DELIVERED | aucune annulation, 409 | oui |
| 254 | Suivi d'un deal annulable | pas de doublon, lien vers « Mes envois » | oui (ANO-WEB-70 close) |
| 255 | Deux onglets | 409, toast, liste relue, un seul remboursement | oui |

---

# Litige et médiation, vue membre — ce que le chapitre 5.21 fait respecter

*(PR `chore/recette-web-5-21` (#286), 12/09/2026 — cahier 01-WEB chapitre 5.21, WEB-LIT-1 à 13.)*

## Le besoin

L'Expéditeur signale un problème (en transit : « non livré » seulement, 48 h après le départ ; après la remise :
six motifs, pendant la période de vérification), une seule fois, sans retour possible ; le paiement du Voyageur est
gelé, le fil passe en lecture seule. Le Voyageur apprend la catégorie seule, donne sa version une seule fois.
L'équipe tranche (rejet, partiel, total) ; chacun lit la décision et le motif, et SON montant seulement ; personne ne
note un deal clos par la médiation. Un accès sans droit ne révèle rien.

## Les règles

**RG-WEB-219 — Le signalement « non livré » s'ouvre 48 h après le départ**, à une date servie par le serveur ; avant,
le lien est fermé et dit quand il s'ouvre ; en transit, le motif est verrouillé sur « non livré ».

**RG-WEB-220 — L'écran de signalement dit tout** : quatre blocs (motif, récit ≥ 50 caractères, photos ≤ 5, solution
souhaitée), leurs badges, l'engagement sur l'honneur, la fenêtre de signalement.

**RG-WEB-221 — Un dossier incomplet ne part pas** : bouton inactif tant qu'un motif, 50 caractères ou l'engagement
manquent, ou qu'une photo est en cours ou en échec ; un refus serveur est dit.

**RG-WEB-222 — L'envoi est confirmé, irréversible, numéroté** (`YAM-XXXX` servi par le serveur) ; le versement est
gelé, le fil fermé ; l'Expéditeur reçoit l'accusé, le Voyageur un email calme avec la catégorie seule.

**RG-WEB-223 — Un signalement ne se modifie ni ne se retire ; un second est refusé.**

**RG-WEB-224 — Chaque partie lit le dossier à sa mesure** : l'Expéditeur son dossier complet et le FAIT de la version
du Voyageur ; le Voyageur la catégorie, jamais le récit, les photos ni la solution souhaitée.

**RG-WEB-225 — La version du Voyageur est unique, immuable, datée**, avec une échéance servie.

**RG-WEB-226 — La décision est lue par les deux** (titre, motif, définitive, recours) **et chacun ne voit que son
montant** — à l'écran, dans la cloche et par email. *(L'API des notifications sert encore les deux montants —
ANO-WEB-74.)*

**RG-WEB-227 — Un deal clos par la médiation ne se note pas**, et son suivi dit « Clos par la médiation », jamais
« Demande annulée » ni « Tu as confirmé ».

**RG-WEB-228 — Deux onglets, une vérité** : signaler après une confirmation est refusé et renvoie au suivi.

**RG-WEB-229 — L'accès direct au signalement sans droit renvoie au suivi sans rien révéler.**

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 256 | Transit < 48 h / > 48 h | lien fermé avec date / actif | oui |
| 257 | Signaler en transit | motif verrouillé, explications | oui |
| 258 | Écran après livraison | quatre blocs, badges, six motifs, fenêtre | oui |
| 259 | Dossier incomplet, photo en cours / en échec, refus serveur | bouton inactif, messages | oui |
| 260 | Envoyer | confirmation, ticket, gel, fil fermé, emails | oui |
| 261 | Modifier / retirer / second signalement | impossible, 409, toast | oui |
| 262 | Dossier Expéditeur / Voyageur | chacun à sa mesure, aucune fuite | oui |
| 263 | Version du Voyageur | une fois, échéance, l'Expéditeur apprend le fait | oui |
| 264 | Rejet / partiel / total | textes, montants par rôle, cloche, emails | oui (ANO-WEB-72, 73, 75 closes ; 74 ouverte) |
| 265 | Après une décision | aucun « Noter » | oui |
| 266 | Deux onglets | 409, retour au suivi | oui |
| 267 | Accès sans droit | retour au suivi, aucune fuite | oui |

---

# La notation croisée — ce que le chapitre 5.22 fait respecter

*(PR `chore/recette-web-5-22` (#287), 12/09/2026 — cahier 01-WEB chapitre 5.22, WEB-NOT-1 à 11.)*

## Le besoin

Après un deal terminé, chacun peut noter l'autre pendant 14 jours : une note globale seule requise, des critères par
rôle, un commentaire court. La notation est toujours facultative et jamais bloquante ; la personne notée est
présentée sans sa moyenne (pas d'ancrage) ; les deux avis restent secrets jusqu'à ce que les deux aient noté ou que
les 14 jours passent ; on ne note qu'une fois ; les relances ne vont qu'au rôle muet, deux fois puis silence ;
l'avis révélé devient public, signé du prénom, signalable.

## Les règles

**RG-WEB-230 — « Noter » apparaît partout où le deal terminé apparaît** (accueil « À traiter », « Mes envois » ou
« Mes trajets », le deal), jamais dans une fenêtre bloquante.

**RG-WEB-231 — L'écran de notation ne montre ni la moyenne ni le volume de la personne notée** ; il propose cinq
étoiles nommées, des critères propres au rôle noté (Voyageur : ponctualité, communication, soin du colis ;
Expéditeur : clarté de la déclaration, réactivité, ponctualité), un commentaire de 280 caractères au plus.

**RG-WEB-232 — La note globale est le seul champ requis** ; le bouton reste inactif tant qu'elle manque.

**RG-WEB-233 — Le double-aveugle est absolu** : rien n'est public avant la réciprocité ou l'échéance ; le second
notant apprend la révélation ; les deux reçoivent une notification, jamais un email.

**RG-WEB-234 — Une seule note par deal et par rôle** ; un deal en litige n'est pas notable (« indisponible », pas
« fermée ») ; un étranger n'obtient rien.

**RG-WEB-235 — Les relances vont au seul rôle muet, à J+5 puis J+7, puis silence.**

**RG-WEB-236 — À 14 jours, un avis unique est révélé** et la fenêtre se ferme des deux côtés.

**RG-WEB-237 — L'avis public porte l'auteur (prénom, initiale), la note (nommée), le commentaire et les critères**,
met la ligne de faits à jour, et se signale par email au support avec sa référence.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 268 | Deal terminé non noté | « Noter » à l'accueil, dans la liste, sur le deal ; aucune fenêtre bloquante | oui (ANO-WEB-76 close) |
| 269 | Écran de notation | sans moyenne ni volume ; étoiles, critères, commentaire, publication | oui |
| 270 | Rôle noté | critères Voyageur / Expéditeur | oui |
| 271 | Sans étoile / étoiles seules | inactif / publié | oui |
| 272 | 275 puis 281 caractères | alerte, blocage à 280 | oui |
| 273 | Deux navigateurs | secret, révélation au second, « Vos avis », cloche sans email | oui |
| 274 | Une seule partie a noté | « Note envoyée · Révélée quand … » | oui |
| 275 | Déjà noté / litige / étranger | « envoyée » / « indisponible » / rien | oui (ANO-WEB-77 close) |
| 276 | J+5, J+7, puis | relance, dernier rappel, silence ; jamais au rôle qui a noté | oui |
| 277 | 14 jours, avis unique | révélé, fenêtre fermée, public | oui |
| 278 | Page publique, sans session | auteur, note nommée, pouces, faits, signalement | oui (ANO-WEB-78 close) |

---

# La page destinataire — ce que le chapitre 5.23 fait respecter

*(PR `chore/recette-web-5-23`, 12/09/2026 — cahier 01-WEB chapitre 5.23, WEB-DES-1 à 9.)*

## Le besoin

Le destinataire n'a pas de compte : l'Expéditeur lui partage un lien (créé une fois, par WhatsApp, SMS ou copie) qui
dit où en est le colis — et rien d'autre : ni adresse, ni numéro, ni code, ni photo, ni montant, ni indexation. La page
suit les jalons publics du Voyageur, ne s'ouvre qu'après l'acceptation, n'appartient qu'à l'Expéditeur, et devient
« plus valide » sans distinguer ses causes. Le Voyageur, lui, voit le vrai numéro du destinataire.

## Les règles

**RG-WEB-238 — Le lien de suivi est créé une fois par deal, par l'Expéditeur seul, après l'acceptation** ; un second
clic ne le régénère pas ; le Voyageur n'a ni carte ni droit ; une demande en attente n'en a pas.

**RG-WEB-239 — Les canaux de partage visent le numéro saisi à la réservation** (WhatsApp, SMS) avec le message
pré-rempli « Bonjour {destinataire} ! Ton colis arrive avec {Voyageur}. Suis-le ici : {lien} ».

**RG-WEB-240 — La page publique dit le prénom, l'expéditeur, le Voyageur (prénom, initiale), le corridor, les dates,
le jalon courant et son aide, la mention de confidentialité, et invite à rejoindre Yamba.**

**RG-WEB-241 — La page publique ne révèle rien d'autre**, ni à l'écran, ni dans son code source, ni par son API (liste
fermée de clés) ; elle n'est pas indexée.

**RG-WEB-242 — La page suit les jalons publics** (acceptation, prise en charge, en route, arrivée, remise) ; l'aéroport
reste privé.

**RG-WEB-243 — Un lien invalide (jeton altéré, destinataire effacé) donne le même message et le même 404** ; le bloc
d'acquisition reste.

**RG-WEB-244 — Le Voyageur voit le vrai numéro du destinataire**, cliquable (appel, WhatsApp).

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 279 | Copier deux fois, recharger | un POST, même lien, même jeton | oui |
| 280 | WhatsApp, SMS | numéro de la réservation, message pré-rempli | oui |
| 281 | Fenêtre privée | la page complète | oui |
| 282 | Écran, source, API, robots | rien de révélé, 8 clés, noindex | oui |
| 283 | Jalons confirmés par le Voyageur | la frise et ses aides, rien de révélé | oui |
| 284 | Voyageur / demande en attente | aucune carte, 403 / 409 | oui |
| 285 | Jeton altéré / destinataire effacé | même message, même 404 | oui |
| 286 | Écran de transit du Voyageur | le vrai numéro, appel, WhatsApp | oui |

---

# Signaler un trajet, un profil, un message — ce que le chapitre 5.24 fait respecter

*(PR `chore/recette-web-5-24`, 12/09/2026 — cahier 01-WEB chapitre 5.24, WEB-SIG-1 à 8.)*

## Le besoin

Tout membre connecté peut signaler une annonce ou un profil (jamais le sien), une fois par cible tant que le dossier
est ouvert, avec un motif propre à la cible et une précision facultative ; il reçoit un accusé (écran + email) et
n'apprend jamais la suite ; la personne signalée n'apprend rien, rien ne change sur la cible, et trois signalements
rendent la revue prioritaire sans sanction automatique. Une cible invisible (supprimée, masquée, privée) répond
« introuvable ». Un avis se signale par email au support.

## Les règles

**RG-WEB-245 — Un signalement est toujours signé** : un visiteur passe par la porte d'identité et revient sur la cible.

**RG-WEB-246 — La fenêtre de signalement dit le titre de la cible, l'introduction, les motifs de la cible** (annonce :
illicite, arnaque, inapproprié, autre ; profil : les mêmes + usurpation), une précision facultative, puis l'accusé
« Merci, ton signalement est bien reçu. » et un email dans la langue de l'auteur.

**RG-WEB-247 — Un doublon ouvert est refusé** (« Tu as déjà signalé cet élément, notre équipe s'en occupe. »).

**RG-WEB-248 — On ne signale pas son propre contenu** : aucun bouton, et l'API refuse.

**RG-WEB-249 — La personne signalée n'apprend rien** : ni cloche, ni email, ni bandeau, ni sanction automatique.

**RG-WEB-250 — Une cible invisible (supprimée, masquée par Yamba, profil privé) est introuvable** — son existence n'est
pas révélée.

**RG-WEB-251 — Trois signalements ouverts rendent la revue prioritaire** au back-office, sans rien changer côté membre.

**RG-WEB-252 — Un avis se signale par email au support, avec sa référence** ; il n'y a pas de file dédiée.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 287 | Visiteur | porte d'identité, retour sur l'annonce après connexion | oui |
| 288 | Annonce d'un autre membre | fenêtre, quatre motifs, accusé, email, annonce en ligne | oui |
| 289 | Second signalement | 409 traduit | oui |
| 290 | Sa propre annonce / son profil | aucun bouton, API refuse | oui |
| 291 | Profil d'un autre membre | cinq motifs, accusé, le signalé n'apprend rien | oui |
| 292 | Annonce masquée / profil privé | introuvable (page, bouton, API) | oui (ANO-WEB-79 close) |
| 293 | Trois auteurs | trois accusés, rien côté propriétaire, revue prioritaire, aucune sanction | oui |
| 294 | Avis public | mailto au support avec la référence | oui |

---

# Données personnelles : export et effacement — ce que le chapitre 5.25 fait respecter

*(PR `chore/recette-web-5-25` (#290), 12/09/2026 — cahier 01-WEB chapitre 5.25, WEB-RGP-1 à 9.)*

## Le besoin

Un membre voit ce que Yamba garde, règle ses deux préférences (relances de messagerie, mesure d'audience), télécharge
ses données une fois par 24 heures derrière une porte par code, et supprime son compte — immédiatement, irréversiblement,
mais seulement quand plus rien n'est en cours. Ce qui reste (réservations, litiges, avis, messages) reste **sans son
nom**. Le tiers destinataire, lui, est effacé 30 jours après la fin d'un deal terminal.

## Les règles

**RG-WEB-253 — L'écran « Mes données » montre deux bascules et deux cartes** ; chaque bascule reflète la préférence du
**compte** (elle suit le membre d'un appareil à l'autre et gouverne aussi la mesure côté serveur).

**RG-WEB-254 — L'export passe par la porte par code** (403 `SUDO_REQUIRED`, code à six chiffres, fenêtre de 15 minutes)
et livre un fichier daté.

**RG-WEB-255 — L'export ne contient que ce qui appartient au membre** : son rôle et ses montants, jamais un code de
livraison, jamais les coordonnées de l'autre partie ni du destinataire quand il est Voyageur, jamais les signalements
qui le visent ni les compteurs internes ; les avis reçus n'y sont que révélés.

**RG-WEB-256 — Un seul export par 24 heures** : le refus est dit dans la langue du membre, avant la porte, sans fichier
ni code.

**RG-WEB-257 — La suppression est refusée tant que quelque chose est en cours** : les motifs viennent d'une liste
fermée servie par le serveur, seuls les motifs applicables s'affichent, et **aucun code n'est envoyé**.

**RG-WEB-258 — L'avertissement dit ce qui part et ce qui reste**, y compris que Stripe n'est pas supprimé par Yamba.

**RG-WEB-259 — La suppression demande un mot de confirmation et un code**, puis déconnecte immédiatement ; l'ancienne
adresse ne se connecte plus ; un email sans lien confirme.

**RG-WEB-260 — L'autre partie garde un fil lisible où le compte effacé s'affiche « Membre supprimé »**, sans numéro.

**RG-WEB-261 — Le tiers destinataire est effacé après le délai de conservation**, jamais sur un deal encore en litige ;
son lien de suivi devient invalide.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 295 | Écran « Mes données » | deux bascules servies par le compte, deux cartes | oui (ANO-WEB-81 close) |
| 296 | Télécharger | porte par code, fichier daté | oui (ANO-WEB-82 close) |
| 297 | Contenu du fichier | rôle, montants, aucune fuite, avis révélés seulement | oui |
| 298 | Second téléchargement | refus en français, aucun fichier, aucun code | oui (ANO-WEB-84 close) |
| 299 | Supprimer avec un deal vivant | bandeau, motifs servis, aucun code | oui |
| 300 | Avertissement | le texte exact | oui |
| 301 | Supprimer un compte libre | mot + code, déconnexion, connexion refusée, email sans lien | oui |
| 302 | Fil de la contrepartie | « Membre supprimé », aucun numéro | oui (ANO-WEB-83, 85 closes) |
| 303 | Deal terminal + 30 jours / deal en litige | destinataire effacé, lien invalide / rien touché | oui |

---

# Préférences, langue et relances — ce que le chapitre 5.26 fait respecter

*(PR `chore/recette-web-5-26`, 12/09/2026 — cahier 01-WEB chapitre 5.26, WEB-PRF-1 à 6.)*

## Le besoin

Un membre choisit sa langue une fois : l'interface la garde, et **ses emails la suivent** — même quand le geste qui
déclenche l'email vient de l'autre partie. Avant d'avoir un compte, c'est la langue de l'écran qui décide. Il peut
couper la relance des messages non lus sans perdre la notification correspondante. Et l'écran « Paramètres » ne lui
promet **que** des réglages qui existent : une bascule qui n'enregistre rien fait croire à un réglage, ce qui est pire
que l'absence de réglage.

## Les règles

**RG-WEB-262 — La langue est une préférence du COMPTE.** La bascule de l'interface l'écrit (`PATCH /auth/me/locale`) :
elle survit au rechargement, à la déconnexion et à un autre appareil.

**RG-WEB-263 — La langue d'un email est celle de son DESTINATAIRE**, jamais celle de l'auteur du geste : une demande
acceptée par un Voyageur francophone part en anglais vers une Expéditrice anglophone, et la demande reçue par le
Voyageur part en français.

**RG-WEB-264 — Sans compte, la langue de l'email est celle de la requête** (l'écran d'où part le geste) : inscription,
mot de passe oublié, renvoi de code. La préférence du compte créé naît de cette même langue.

**RG-WEB-265 — La relance des messages non lus se coupe, la notification non.** Préférence coupée, le cron n'envoie
aucun email ; la notification in-app « Nouveau message » reste — c'est l'information, pas la relance, qui est due.

**RG-WEB-266 — Un contrôle affiché est un contrôle qui écrit.** Chaque réglage de l'écran « Paramètres » a un effet
observable et une portée annoncée : la langue et la relance email vivent sur le compte, le thème dans le navigateur.
Un réglage qui n'existe pas (le push) s'affiche en lecture, sans bascule.

**RG-WEB-267 — Les emails d'un Deal en cours ne se coupent pas** (demande, paiement, livraison) : ils sont
contractuels. Le libellé de la préférence email le dit, au lieu de laisser croire le contraire.

**RG-WEB-268 — Une adresse inconnue rend la page introuvable DU PRODUIT**, dans une langue prise en charge : jamais une
page d'outil, jamais une langue à moitié traduite, jamais une erreur brute.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 304 | Bascule de langue, puis reconnexion dans un contexte neuf | interface et compte en anglais | oui |
| 305 | Expéditrice anglophone, Voyageur francophone | chacun reçoit son email dans SA langue | oui |
| 306 | Inscription depuis l'interface anglaise | code d'activation en anglais, compte créé en anglais | oui (ANO-WEB-87 close) |
| 307 | Relance coupée, message non lu, passe du cron | aucun email, notification présente | oui |
| 308 | Écran « Paramètres » | langue → compte, thème → écran, email → compte et persiste, push en lecture | oui (ANO-WEB-86 close) |
| 309 | Adresse `/es` puis `/en/es` | 404 avec la page introuvable de Yamba, dans la langue de l'URL | oui (ANO-WEB-88 close) |

## Ce qui reste à trancher

- **Préférences email par famille d'événement** (demandes, messages, paiements, rappels de notation) : il n'en existe
  qu'une. La liste des familles **coupables** doit être fermée explicitement, puisque les emails d'un Deal en cours ne
  le sont pas (RG-WEB-267) — candidat au registre.
- **Notifications push** : rien n'est branché. À arbitrer dans le même geste, avant de remettre une ligne active.
- **Le thème ne suit pas le compte** : un autre appareil repart sur « Automatique ». Assumé, mais à dire au membre.

---

# Le consentement à la mesure d'audience — ce que le chapitre 5.27 fait respecter

*(PR `chore/recette-web-5-27`, 12/09/2026 — cahier 01-WEB chapitre 5.27, WEB-ANA-1 à 6.)*

## Le besoin

Yamba veut savoir comment son site est utilisé — quels corridors sont cherchés, où une réservation s'arrête — sans
jamais savoir **qui** a fait quoi. La mesure ne démarre donc qu'après un accord explicite, elle ne transporte aucune
donnée personnelle, le choix suit le compte d'un appareil à l'autre, il se retire en un geste, et sans clé de mesure
rien ne s'affiche ni ne part. Et la demande d'accord ne doit pas gêner l'usage du site : une bannière qui recouvre le
bouton « Se connecter » transforme un consentement en péage.

## Les règles

**RG-WEB-269 — Rien ne se charge avant l'accord.** Le SDK de mesure n'est chargé qu'après « Accepter » : un refus ne
déclenche aucune requête, aucun script utile, aucun stockage de mesure.

**RG-WEB-270 — Les deux issues ont le même poids.** « Accepter » et « Refuser » sont deux vrais boutons, de même
taille et de même typographie, au même endroit. Un « Refuser » discret est une anomalie majeure.

**RG-WEB-271 — La demande d'accord ne condamne aucune action.** La bannière réserve sa place : le contenu de la page
reste atteignable (au pire d'un défilement), et la place est rendue dès qu'on a répondu.

**RG-WEB-272 — Ce qui part est une liste fermée d'événements sans donnée personnelle** : page vue, recherche
effectuée (origine, destination, poids, nombre de résultats), trajet consulté, étape de réservation, paiement
autorisé, demande créée, lien de suivi partagé, trajet publié. Jamais un nom, un prénom, une adresse email, un
numéro de téléphone, un code de livraison ni l'identité d'un destinataire. L'identité d'un membre n'est transmise que
par son **identifiant**.

**RG-WEB-273 — La recherche mesurée dit quel corridor a été cherché** : origine et destination réelles, et le nombre
de résultats obtenus (c'est la matière du pilotage).

**RG-WEB-274 — Le choix vit sur le COMPTE.** Un membre qui a répondu sur un appareil n'est pas redemandé sur un
autre ; la bascule de « Mes données » retire l'accord, et ce retrait vaut immédiatement.

**RG-WEB-275 — Sans clé de mesure, rien** : aucune bannière, aucun envoi, aucune erreur. (La bascule de « Mes
données » reste, elle, toujours affichée : elle gouverne aussi la mesure côté serveur — RG de 5.25.)

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 310 | Visiteur neuf | bannière « Mesure d'audience », texte exact, trois éléments, deux boutons de même poids | oui |
| 311 | Bannière affichée sur la page de connexion | le bouton principal reste atteignable, la place est rendue après la réponse | oui (ANO-WEB-89 close) |
| 312 | « Refuser » puis navigation | aucune requête, aucun événement, aucun stockage de mesure, la bannière ne revient pas | oui |
| 313 | « Accepter » puis recherche, trajet, réservation | les événements attendus partent, avec origine et destination réelles, et aucune donnée personnelle | oui (ANO-WEB-90 close) |
| 314 | Même compte, second navigateur neuf | aucune bannière, choix repris | oui |
| 315 | Retrait dans « Mes données » | enregistré sur le compte, plus rien n'est mesuré ensuite | oui |
| 316 | Sans clé de mesure | aucune bannière, aucun envoi, aucune erreur de console | oui |

## Ce qui reste à trancher

- **La page où l'on accepte n'est pas comptée** (l'effet des pages vues ne se rejoue qu'à la navigation suivante) :
  le taux d'entrée est donc faux. À corriger avant de lire les chiffres.
- **Le retrait ne jette pas ce qui est déjà en file** : jusqu'à un lot d'événements déjà capturés part après le
  retrait. Défendable (ils l'ont été sous consentement) — à dire ou à jeter.
- **La page publique du destinataire porte un jeton dans son URL** (`/track/<jeton>`), et la page vue transporte
  l'URL complète : si un destinataire accepte la mesure, le jeton partirait au collecteur. Normaliser le chemin
  avant capture — **candidat au registre**, à trancher avant toute activation en production.
- **En développement, chaque page vue part en double** (effets rejoués par React en `StrictMode`) : à vérifier sur
  le build de production avant d'interpréter les volumes.

---

# Le mode maintenance vu du membre — ce que le chapitre 5.28 fait respecter

*(PR `chore/recette-web-5-28`, 13/09/2026 — cahier 01-WEB chapitre 5.28, WEB-MNT-1 à 4.)*

## Le besoin

Yamba doit pouvoir s'arrêter d'écrire — le temps d'une intervention — sans mentir à ses membres ni perdre d'argent
en route. On l'annonce avant, on bascule en lecture seule, on laisse tout le monde consulter, on refuse les
écritures **en le disant**, et on lève. Une réservation entamée pendant la bascule ne doit rien autoriser ni rien
débiter.

## Les règles

**RG-WEB-276 — Une annonce n'est qu'une annonce.** Une maintenance planifiée affiche un bandeau ambre daté et ne
bloque rien : recherche, réservation, message et publication fonctionnent normalement.

**RG-WEB-277 — La lecture seule laisse TOUT lire.** Recherche, page d'un trajet, fil de messagerie, « Mes envois » :
aucune consultation n'est empêchée, et un bandeau rouge dit l'état en toutes lettres.

**RG-WEB-278 — Toute écriture est refusée, et le refus est DIT.** Réserver, écrire, publier répondent 503
`MAINTENANCE` ; le membre lit « La plateforme est en maintenance : réessaie dans quelques minutes. » — jamais une
erreur générique, jamais un échec muet.

**RG-WEB-279 — L'authentification n'est jamais bloquée.** Se connecter, se reconnecter et rafraîchir sa session
restent possibles pendant la maintenance (comme l'accès du back-office, qui doit pouvoir la lever).

**RG-WEB-280 — La levée est immédiate à l'échelle de la plateforme** : les écritures reprennent dans les dix
secondes, sans rechargement forcé au-delà.

**RG-WEB-281 — Une réservation prise dans la bascule ne laisse rien derrière elle** : « Payer » refusé n'autorise
aucun montant et ne crée aucune demande ; après la levée, le même geste aboutit normalement.

## Tests d'acceptation

| # | Situation | Attendu | Vérifié |
|---|---|---|---|
| 317 | Maintenance annoncée dans 1 h | bandeau ambre daté, rien n'est bloqué | oui |
| 318 | Lecture seule, consultation | toutes les lectures passent, bandeau rouge | oui |
| 319 | Lecture seule, écritures | 503 pour réserver / écrire / publier, refus dit à l'écran | oui (ANO-WEB-91 close) |
| 320 | Lecture seule, connexion | connexion et rafraîchissement possibles | oui |
| 321 | Levée | écritures reprises en moins de 15 s, bandeau parti | oui |
| 322 | « Payer » pendant la bascule, puis après la levée | rien d'autorisé ni créé, puis réservation normale | oui |

## Ce qui reste à trancher

- Le code de refus de la passerelle vit à la **racine** de la réponse, pas dans `details` (A146) : aligner.
- Le bandeau peut arriver avec jusqu'à 60 s de retard pour un membre déjà sur sa page (rattrapé désormais par le
  premier refus d'écriture).
- Le message personnalisé de l'administrateur complète le bandeau mais pas le refus d'écriture.
- Une annonce n'a pas de date de FIN : le membre ne sait pas combien de temps durera l'intervention.
