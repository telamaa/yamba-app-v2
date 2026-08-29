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
- **RG-C-12** — **Réserver exige un compte** (CNF-05 : identité requise dès la 1re réservation). Un visiteur non connecté voit « Connecte-toi pour réserver » avec retour automatique sur ce trajet après connexion ou inscription.
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
