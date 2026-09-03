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
