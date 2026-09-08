# Dossier identité, vérification et parcours d'inscription du Voyageur

> **Destinataires** : direction produit, développeurs, assureurs (compléter le dossier 08),
> juristes et délégué à la protection des données (compléter le dossier 09).
> **Objet** : arrêter la politique de vérification des membres et des voyages, et raccourcir le
> parcours d'inscription du Voyageur sans perdre en sécurité.
> **Version** : 8 septembre 2026.
>
> **Note de méthode.** Établi par revue du code (chemins et lignes cités), de la base de données et
> des règles internes, plus des mesures faites sur la plateforme de recette. Le document distingue
> **ce qui existe déjà**, **ce qui est spécifié mais non branché**, et **ce qui reste à décider**.
> Il ne remplace aucun document existant : il renvoie vers `YAMBA-REGLES-METIER-V2.md` (CNF-05),
> le registre des décisions (D22, D31, D57, D71), le dossier assurance (08) et le dossier
> juridique (09).

---

## 1. Le point de départ : quatre briques déjà en place

La première conclusion de l'analyse est qu'il ne s'agit pas de « mettre en place le KYC » : une
grande partie existe, et une partie de ce qui existe n'est **pas exploitée**.

| Brique | État réel | Où |
|---|---|---|
| **Vérification d'identité du Voyageur** | **Faite et payée.** Stripe Connect impose une vérification réglementaire (pièce, parfois selfie) à quiconque reçoit des fonds. Aucun Voyageur ne peut être payé sans l'avoir passée. | `carrier.controller.ts` (création du compte Express) |
| **Règle métier CNF-05** | **Écrite** : « Voyageur : KYC Stripe Connect (existant). Expéditeur : Stripe Identity avant la première réservation, seuil paramétrable. » | `YAMBA-REGLES-METIER-V2.md` §CNF-05 |
| **Paramètre `IDENTITY_REQUIRED_FROM`** | **Au catalogue, en classe C** — présent, documenté, **aucun consommateur dans le code**. | `platform-settings.schema.ts`, `YAMBA-PARAMETRES.md` |
| **Vérification du billet (D57)** | **En place, mais humaine** : `TripDocument`, `ticketVerificationStatus` (NOT_SUBMITTED / PENDING / VERIFIED / REJECTED), file d'attente admin, badge `verifiedTicket` filtrable dans la recherche. | `prisma/schema.prisma:551,622` · `admin-trips.rules.ts:19` |
| **Types de justificatifs** | `TICKET_PROOF`, `ITINERARY_PROOF`, **`VEHICLE_PROOF`**, **`IDENTITY_PROOF`** — les deux derniers **ne sont utilisés nulle part**. | `prisma/schema.prisma:1236` |
| **TrustScore (D71)** | **Calculé**, jamais servi à un membre, utilisé seulement par la fiche admin et la file de signalements. Il agrège déjà l'ancienneté, les litiges perdus, les annulations tardives, les signalements. | `packages/libs/trust` |

**Conséquence immédiate** : le badge « Voyageur vérifié » ne demande **aucun outil nouveau ni aucune
dépense**. L'information est déjà là ; elle n'est simplement pas remontée comme un signal de
confiance. C'est la première action à mener, et la moins chère.

---

## 2. Métier — qui vérifier, quand, et pourquoi

### 2.1 Le Voyageur : déjà couvert, à valoriser

Le KYC Stripe Connect est un prérequis pour encaisser : il est donc **universel** chez les Voyageurs
actifs, et **inclus dans les frais** déjà payés. Deux gestes suffisent :

1. exposer un badge « identité vérifiée » sur la page publique et sur les cartes de résultat ;
2. cesser d'afficher comme « actif » un Voyageur dont Stripe n'a pas terminé la vérification
   (voir §6, le parcours d'inscription).

### 2.2 L'Expéditeur : le vrai sujet, pour une raison qui n'est pas la fraude

Sur une place de marché ordinaire, on vérifie l'identité pour sécuriser **l'argent**. Chez Yamba
l'argent est déjà couvert : l'Expéditeur paie par carte avec authentification forte (3-D Secure),
le Voyageur est vérifié par Stripe, et les fonds sont capturés puis reversés par la plateforme.

Le motif réel est **spécifique au métier** : **le Voyageur traverse une frontière avec le colis
d'un tiers**. Si le contenu est illicite, c'est lui qui est interpellé, lui qui doit prouver sa
bonne foi. Un Expéditeur anonyme, c'est un Voyageur sans recours — et pour la plateforme une
exposition pénale et réputationnelle sans commune mesure avec un impayé.

La vérification de l'Expéditeur est donc une mesure de **traçabilité**, pas d'anti-fraude. Cette
requalification a trois conséquences pratiques :

- elle **justifie la dépense** auprès de la direction : ce n'est pas un coût de conformité, c'est la
  contrepartie de la promesse faite au Voyageur ;
- elle **change le seuil** : ce n'est pas le montant qui compte d'abord, c'est le risque de contenu
  (catégorie, corridor, valeur déclarée, antécédents) ;
- elle **s'adresse aux assureurs** (§4) et aux juristes (§5), qui poseront exactement cette question.

### 2.3 Les niveaux de vérification proposés

| Niveau | Ce qui est prouvé | Coût | Quand |
|---|---|---|---|
| **N0 — compte** | Email possédé | 0 | Inscription |
| **N1 — joignable** | Téléphone (OTP) | ~0 | Avant la première mise en relation |
| **N2 — bancaire** | Porteur de carte authentifié (3DS) | 0 (déjà payé) | Première réservation |
| **N3 — identité** | Pièce officielle + selfie | ~1,50 $/vérification | **Au déclenchement** (§2.4) |
| **N4 — voyage** | Le déplacement existe et appartient au Voyageur | 0 (avion, train) | À la publication du trajet |

### 2.4 Le déclenchement : un faisceau, pas un mur

Exiger une pièce d'identité à l'inscription détruirait la conversion sans réduire le risque réel.
CNF-05 prévoit déjà un **seuil paramétrable** ; la recommandation est de ne pas le réduire à un
montant, mais de le calculer sur un **faisceau**, en réutilisant le **TrustScore D71** qui agrège
déjà les bons signaux :

- valeur déclarée élevée, ou catégorie sensible ;
- corridor identifié comme à risque ;
- compte récent, ou score `WATCH` / `HIGH_RISK` ;
- signalement reçu, litige tranché contre le membre, colis refusé en douane.

Ainsi la dépense suit le risque, et la grande majorité des envois n'en supporte pas le coût. C'est
aussi ce qui rend `IDENTITY_REQUIRED_FROM` réellement utile : il devient le **curseur** que
l'administration ajuste sans redéploiement (paramètre de classe A, portée métier).

---

## 3. Technique — ce qu'on peut vérifier par machine

### 3.1 L'identité : Stripe Identity, pour une raison d'architecture

Plusieurs prestataires sérieux existent (Veriff, Onfido, Sumsub, IDnow, Ubble…), à des tarifs
comparables (ordre de grandeur : 0,50 € à 2,50 € selon volume et profondeur, **à revérifier avant
signature**). Certains éditeurs annoncent une offre gratuite ; à traiter avec prudence, car une
vérification qu'un assureur regardera doit être traçable et contractuellement solide.

La recommandation est **Stripe Identity**, non parce qu'il serait le moins cher, mais parce que :

- c'est **le fournisseur déjà en place** pour le paiement et pour le KYC des Voyageurs : pas de
  contrat supplémentaire, pas de sous-traitant supplémentaire à déclarer, une seule intégration à
  maintenir ;
- les identités des deux côtés du marché sont alors **vérifiées par le même acteur**, ce qui
  simplifie la démonstration faite à l'assureur ;
- l'abstraction existe déjà côté paiement (`PaymentProvider`, D11/D38) : le même schéma —
  une interface, deux implémentations, un faux pour les tests — s'applique tel quel.

### 3.2 Le « voyage vérifié » : le gain le plus important, et il est gratuit

Aujourd'hui un modérateur regarde une capture de billet (D57). Cela ne passe pas à l'échelle, et un
montage passe inaperçu. Or **une carte d'embarquement est un objet vérifiable par machine**.

**Avion — le levier principal.** Les cartes d'embarquement portent un code-barres (PDF417 ou Aztec)
au format **BCBP**, normalisé par l'IATA. Il contient le **nom du passager**, le **numéro de vol**,
la **date**, l'**origine et la destination**, le PNR. Le décodage est **gratuit**, **local** et
instantané (bibliothèques ouvertes ; aucun appel à un tiers, donc aucun transfert de données).

On vérifie alors automatiquement deux choses :

1. le **nom du passager correspond au titulaire du compte** — dont l'identité est déjà vérifiée par
   Stripe : la chaîne est complète ;
2. le **vol, la date et le corridor correspondent au trajet publié**.

C'est une preuve **plus forte** que l'œil d'un modérateur, et elle **supprime une file d'attente
administrative**. En complément facultatif, une API de statut de vol confirme l'existence réelle du
vol et permet de prévenir l'Expéditeur en cas d'annulation.

**Train.** Les billets ferroviaires européens suivent la spécification **UIC 918.3** : les
codes-barres sont **signés numériquement** par l'émetteur, donc une contrefaçon est détectable. Les
formats sont plus hétérogènes que dans l'aérien ; à traiter en second.

**Voiture.** Il n'existe **rien à vérifier** : pas de billet, pas d'émetteur tiers. Trois options,
par ordre de préférence :

1. **ne pas décerner de badge « voyage vérifié »** pour la voiture, et le dire dans l'interface —
   mieux vaut pas de badge qu'un badge qui ne prouve rien ;
2. vérifier le **véhicule et le conducteur** (`VEHICLE_PROOF` existe déjà au modèle : carte grise et
   permis), ce qui prouve l'identité et le moyen, pas le déplacement ;
3. compenser par l'**historique** : dix livraisons terminées et bien notées valent mieux qu'un
   document.

### 3.3 Modèle de données et impacts

Le modèle actuel suffit presque : `TripDocument` porte déjà les types nécessaires, et
`ticketVerificationStatus` porte déjà les quatre états. À ajouter :

- l'**origine de la vérification** (humaine ou automatique) et la **date**, pour distinguer un badge
  décerné par un modérateur d'un badge prouvé par décodage ;
- sur le membre, l'**état de vérification d'identité** et sa date, alimentés par Stripe ;
- rien d'autre : voir §5, on conserve la **conclusion**, pas les pièces.

---

## 4. Assurance — ce que la vérification change dans le dossier

Le dossier 08 présente la sinistralité et les garanties. La politique de vérification l'affecte sur
quatre points, qu'un assureur demandera explicitement :

1. **Qui sont les parties ?** Aujourd'hui la réponse est « le Voyageur est vérifié par un
   établissement de paiement agréé, l'Expéditeur est un porteur de carte authentifié ». Avec le N3
   au-dessus du seuil, elle devient « les deux parties sont vérifiées dès que le risque le
   justifie » — c'est une réponse qui se plaide.
2. **Le déplacement a-t-il eu lieu ?** Un badge « voyage vérifié » **prouvé par le code-barres du
   billet** est une pièce opposable ; une capture d'écran validée à l'œil ne l'est pas. C'est
   probablement l'apport le plus concret de ce dossier pour l'assureur.
3. **La sélection des risques est-elle documentée ?** Le TrustScore (D71) et les plafonds
   progressifs (CNF-06) montrent une politique **écrite, calculée et journalisée** — pas une
   appréciation au cas par cas.
4. **La sinistralité est-elle mesurée ?** Elle l'est déjà (D74 : registre par mois de décision,
   catégorie, devise, montants remboursés). La vérification vient nourrir la même série : on pourra
   comparer la sinistralité **avant et après** son activation, et négocier sur des chiffres.

**Recommandation** : activer la vérification **avant** la négociation d'assurance, et non après. Une
prime se négocie sur des chiffres constatés ; trois mois de données post-activation valent mieux
qu'un engagement de bonne conduite.

---

## 5. RGPD — la règle est simple : décoder puis jeter

La vérification d'identité et le décodage d'un billet manipulent des données sensibles par nature.
Les principes retenus :

**Base légale.** Exécution du contrat pour la mise en relation, **intérêt légitime** documenté pour
la lutte contre les usages illicites et la protection du Voyageur, obligation légale pour ce qui
relève de la lutte anti-blanchiment côté paiement. À faire confirmer par le conseil (dossier 09).

**Minimisation — le point le plus important.** Une carte d'embarquement contient le nom, le PNR, le
siège, l'itinéraire. On ne conserve **que le résultat** :

- concordance du nom avec le titulaire : oui / non ;
- concordance du vol, de la date et du corridor : oui / non ;
- horodatage et méthode (automatique / humaine).

**L'image du billet n'est pas conservée** au-delà du délai de contestation, et le PNR n'est pas
stocké. C'est exactement le raisonnement déjà appliqué au code de livraison (D43) : on garde la
**preuve**, jamais le **secret**.

Pour l'identité, la pièce elle-même **ne transite ni ne réside chez Yamba** : elle est déposée chez
le prestataire, qui renvoie un verdict. Yamba stocke le verdict, sa date et l'identifiant de la
vérification — rien d'autre.

**Durées.** Aligner sur les règles de rétention existantes (`packages/libs/retention`) : le verdict
suit la vie du compte ; les concordances de voyage suivent le délai de contestation du deal ; les
images ne sont pas conservées.

**Sous-traitance et transferts.** Un prestataire de vérification est un sous-traitant : contrat
article 28, inscription au registre, mention dans la politique de confidentialité, vérification du
lieu d'hébergement et des garanties de transfert hors UE. Choisir le prestataire **déjà utilisé**
pour le paiement réduit d'autant cette charge.

**Analyse d'impact (AIPD).** Vérification d'identité systématique au-delà d'un seuil + profilage de
risque (TrustScore) : la conduite d'une AIPD est à considérer comme probable, et à faire trancher
par le conseil. Le fait que le TrustScore soit **calculé à la lecture, jamais stocké, jamais servi
au membre et ne déclenche aucune sanction automatique** (D71) est un élément favorable à documenter.

**Droits des personnes.** L'export de données (D63) doit inclure le **verdict** de vérification et
les concordances, pas les pièces. L'effacement doit les traiter comme le reste : anonymisation, en
conservant ce qu'impose la comptabilité et la médiation.

---

## 6. Juridique — trois questions à poser au conseil

Le dossier 09 pose la qualification de l'activité. Ce dossier-ci y ajoute trois questions précises :

1. **Responsabilité en cas de contenu illicite.** Le Voyageur transporte le bien d'un tiers à
   travers une frontière. Quelle est la répartition des responsabilités entre l'Expéditeur (qui
   déclare), le Voyageur (qui transporte) et la plateforme (qui met en relation et connaît
   l'identité des deux) ? Cette réponse conditionne le **niveau de vérification exigible** et la
   rédaction des CGU.
2. **Obligations de la plateforme.** Vérification de l'identité des professionnels, obligations de
   signalement, conservation des éléments d'identification, et — sur le volet fiscal — la
   **déclaration des revenus des Voyageurs et la remise d'une copie au membre** (DAC7). Ce dernier
   point est **déjà un manque constaté** : aucun relevé n'est disponible côté membre aujourd'hui.
3. **Les CGU.** Elles sont encore un modèle non validé, et emploient un vocabulaire périmé
   (« transporteurs / Trippers » alors que la règle A144 impose « Voyageur »). Elles doivent porter
   la politique de vérification, la liste des marchandises interdites, et les conséquences d'une
   fausse déclaration.

---

## 7. Le parcours d'inscription du Voyageur : ce qu'on peut raccourcir

### 7.1 Ce qui est déjà bien fait

Le compte Stripe est créé **prérempli** : prénom, nom, email, téléphone, date de naissance et
adresse sont transmis à la création. Le Voyageur ne ressaisit donc pas ces informations chez
Stripe. C'est l'essentiel du travail d'allègement, et il est fait — **à ne pas casser**.

### 7.2 Les trois frottements restants

**(a) Le front exige quatre champs, le serveur en exige deux.** L'écran annonce « Tous les champs
sont obligatoires » et bloque sans **nom, bio, adresse et téléphone**, alors que la validation
serveur n'exige que le **téléphone** et le **pays**. La **bio** — un texte libre, le champ le plus
coûteux d'un formulaire — ne sert **ni à Stripe, ni à encaisser, ni à accepter un deal** : elle
n'alimente que la page publique. Elle doit devenir facultative et être demandée **à la publication
du premier trajet**, au moment où le Voyageur cherche justement à convaincre.

**(b) L'adresse est demandée sans être expliquée.** Elle est utile (elle préremplit Stripe), mais
rien ne le dit : une phrase suffit à supprimer l'hésitation.

**(c) Le vrai levier est le moment, pas le nombre de champs.** Aujourd'hui, pièce d'identité et IBAN
sont réclamés **avant toute publication**, donc avant que le Voyageur sache s'il recevra la moindre
demande : effort maximal, motivation minimale. Or la garde qui exige un compte opérationnel ne joue
qu'**à l'acceptation d'un deal**.

| Moment | Effet |
|---|---|
| **Aujourd'hui** — avant tout | C'est là qu'on perd les Voyageurs |
| **À la première demande reçue** | Motivation maximale, mais la demande **expire** pendant la vérification : on perd le deal et l'Expéditeur |
| **À la publication du premier trajet** *(recommandé)* | Le Voyageur est engagé, il a du temps devant lui, la vérification a le temps d'aboutir |

### 7.3 La condition qui rend ce découplage possible

Décaler la vérification n'est acceptable que si **l'état affiché dit la vérité**. Or aujourd'hui le
bouton « Configurer plus tard » clôt l'inscription en marquant le compte **COMPLETE et ACTIVE sans
lire un seul indicateur Stripe** — vérifié en recette : la plateforme répond « inscription
terminée » avec les encaissements désactivés. Le Voyageur découvre le blocage face à un Expéditeur
qui attend.

Deux corrections préalables, petites :

1. le compte reste en cours d'inscription tant que la vérification n'est pas opérationnelle, et un
   bandeau permanent le rappelle ;
2. le **retour d'information de Stripe** (le webhook) doit pouvoir **rétrograder** l'état et
   **prévenir par email** : aujourd'hui il n'écrit que trois indicateurs, sans jamais toucher au
   statut ni notifier. Un compte qui redevient incomplet reste « actif » en silence.

Et une amélioration de fond : Stripe **dit pourquoi** un compte est incomplet (`requirements`), mais
ces informations ne sont **lues nulle part**. La plateforme sait donc dire « cela ne marche pas »,
jamais « il manque votre pièce d'identité ». C'est ce qui transforme un blocage subi en une action
à faire.

---

## 8. Plan proposé

| # | Action | Coût | Gain attendu |
|---|---|---|---|
| 1 | Afficher **« Voyageur vérifié »** depuis le KYC Stripe déjà passé | quasi nul | Confiance immédiate, information déjà payée |
| 2 | L'état d'inscription dit la vérité + le webhook rétrograde et notifie | petit | Supprime la mauvaise surprise au premier deal |
| 3 | Rendre la **bio facultative**, déplacer la vérification à la publication | petit | Tunnel plus court, au bon moment |
| 4 | **Décoder le code-barres** des cartes d'embarquement (BCBP) | faible, gratuit | Une preuve remplace une revue humaine ; une file d'attente admin disparaît |
| 5 | Lire les **`requirements`** de Stripe et les traduire en action | moyen | « Il manque ceci » au lieu de « cela ne marche pas » |
| 6 | Brancher **`IDENTITY_REQUIRED_FROM`** sur le TrustScore (D71) | moyen | Le coût du KYC suit le risque |
| 7 | **Stripe Identity** pour l'Expéditeur au-dessus du seuil | ~1,50 $/vérif. | Traçabilité — l'argument des assureurs et du conseil |
| 8 | **Train** (UIC 918.3), puis décision explicite sur la **voiture** | moyen | Couvre les autres modes sans badge trompeur |

Les points 1 à 4 sont des corrections et du câblage : ils ne demandent aucune décision nouvelle.
Les points 6 et 7 mettent en œuvre CNF-05, déjà écrite. Le point 8 appelle un arbitrage explicite.

## 9. Ce que ce dossier recommande de NE PAS faire

- **Un KYC universel à l'inscription** : il détruit la conversion sans réduire le risque réel, qui
  est concentré sur une minorité d'envois.
- **Un badge « vérifié » adossé à un simple coup d'œil humain** : c'est une promesse que la
  plateforme ne pourra pas tenir au premier incident, et qui se retournera contre elle devant un
  assureur comme devant un juge.
- **Conserver les pièces** (image du billet, copie de la pièce d'identité) : le risque de fuite est
  permanent, l'utilité marginale. On garde la conclusion, pas la pièce.
- **Décerner un badge « voyage vérifié » à un trajet en voiture** sur la foi d'un document qui ne
  prouve aucun déplacement.
