# Dossier de présentation aux assureurs et courtiers

> **Destinataires** : courtiers, assureurs affinitaires, acteurs de l'assurance embarquée.
> **Objet** : obtenir un avis de faisabilité et une cotation sur trois couvertures, avant
> l'ouverture commerciale du service.
>
> **Éditeur** : Telama, structure en cours de constitution. **Produit** : Yamba.
> **Version** : septembre 2026.
>
> **Note de méthode.** Ce dossier distingue systématiquement ce qui est **en production**,
> ce qui est **spécifié mais non implémenté**, et ce qui **manque**. La partie 13 liste sans
> détour les écarts que nous connaissons. Nous préférons qu'un assureur les découvre ici
> plutôt qu'en audit.

---

## Sommaire

1. Ce que nous demandons, en une page
2. L'entreprise et l'état réel du projet
3. Le service, décrit de bout en bout
4. Le modèle économique et les flux d'argent
5. La protection actuelle : ce qui existe, ce qui n'existe pas
6. Les mesures de prévention en production
7. La chaîne de preuve mobilisable
8. Le traitement des litiges
9. Sinistralité, volumes et équilibre économique
10. Scénarios de sinistre
11. Le périmètre technique : web, back-office, mobile
12. Les trois couvertures demandées
13. Les écarts que nous connaissons
14. Questions ouvertes au courtier
15. Annexes

---

## 1. Ce que nous demandons, en une page

Yamba est une plateforme de transport collaboratif de colis. Des particuliers qui voyagent
déjà, les **Voyageurs**, transportent dans leurs bagages le colis d'un **Expéditeur** qu'ils
ne connaissent pas, contre rémunération. La plateforme met en relation, séquestre le
paiement, encadre la remise par un code, et arbitre les litiges.

Nous cherchons trois couvertures distinctes.

| # | Couverture | Bénéficiaire | Priorité |
|---|---|---|---|
| A | Responsabilité civile professionnelle de la plateforme | Telama | Avant toute ouverture |
| B | Marchandises transportées : perte, vol, dommage, non-remise | L'Expéditeur | Avant la montée en volume |
| C | Cyber et atteinte aux données personnelles | Telama et ses membres | Souhaitable dès l'ouverture |

Pour la couverture B, notre cible est l'**assurance embarquée** : l'assureur porte l'agrément
et le produit, la plateforme distribue colis par colis et reverse la prime. Ce choix a été
inscrit dans notre registre de décisions **avant l'écriture du code**, et l'architecture a été
construite pour l'accueillir sans refonte.

Deux arguments distinguent ce dossier d'une demande de devis ordinaire.

**Les contrôles de prévention sont déjà écrits et bloquants.** Ils sont décrits en partie 6.
Nous acceptons qu'ils deviennent contractuellement opposables ; une règle interne prévoit
d'ailleurs déjà que le respect des contrôles de conformité conditionne la couverture et que
toute évolution de ces règles vous soit notifiée.

**La prime est un flux comptable séparé depuis la première ligne de code.** Elle n'a jamais
été mélangée à la commission, précisément pour permettre ce partenariat.

---

## 2. L'entreprise et l'état réel du projet

### 2.1 Situation

| Élément | État |
|---|---|
| Éditeur | Telama, en cours de constitution |
| Produit | Plateforme web complète, développée et testée |
| Ouverture commerciale | Non effectuée |
| Transactions réelles | **Aucune** |
| Sinistres | **Aucun** |
| Applications mobiles | Non développées, chantier planifié |
| Contact assureur antérieur | **Aucun** : ce dossier est notre première démarche |

L'absence d'historique de sinistralité est la difficulté principale de ce dossier. La
partie 9 propose deux façons de la traiter.

### 2.2 Ce qui est construit

Six services applicatifs, deux interfaces web, cent soixante-treize opérations
d'interface de programmation documentées, plus de mille tests automatisés rejoués à chaque
modification.

Les éléments qui intéressent directement un assureur sont en production :

- Le paiement est **autorisé à la demande, capturé à l'acceptation, séquestré jusqu'à la
  livraison, versé quatre jours après.**
- La remise est prouvée par un **code à six chiffres** détenu par le destinataire.
- L'inspection du colis ouvert est un **passage obligé technique** : sans liste de contrôle
  complète et sans photo, le serveur refuse d'enregistrer la prise en charge.
- L'ouverture d'un litige **gèle immédiatement le versement**.
- Chaque geste d'opérateur est **journalisé dans la même transaction** que le geste lui-même.

### 2.3 Périmètre géographique

**Le service est mondial par conception.** Aucun corridor n'est codé en dur : dès qu'un
Voyageur publie un trajet, la liaison existe, quels que soient le pays de départ et le pays
d'arrivée. Le produit est bilingue et les montants sont traités en euros dans cette première
version.

La **mise en marché**, en revanche, commencera sur un corridor unique afin d'atteindre la
liquidité, puis s'étendra. Ce choix commercial n'emporte aucune limite technique.

Nous posons donc d'emblée la question qui vous intéresse : nous aurons besoin de savoir
**quels pays vous couvrez et lesquels vous excluez**, afin de décider si nous restreignons
l'ouverture des corridors dans le produit pour rester dans le périmètre assurable. C'est une
restriction que nous savons appliquer, mais nous ne l'appliquerons pas au hasard.

---

## 3. Le service, décrit de bout en bout

### 3.1 Les acteurs

**Le Voyageur** est un particulier qui a déjà prévu un déplacement. Il publie son trajet, la
capacité en kilogrammes qu'il cède, son prix au kilogramme et les points de rendez-vous. Il
n'est pas un professionnel du transport et ne se déplace pas pour le colis.

**L'Expéditeur** est un particulier qui envoie un colis. Il décrit le colis, déclare sa
valeur, choisit un niveau de protection, paie et désigne un destinataire.

**Le destinataire** est un tiers qui n'est pas nécessairement inscrit. Il détient le code de
remise.

### 3.2 Le parcours

| Étape | Ce qui se passe | Preuve conservée |
|---|---|---|
| 1 | Le Voyageur publie trajet et capacité | Trajet horodaté |
| 2 | L'Expéditeur trouve le trajet | — |
| 3 | Demande : description, valeur déclarée, charte acceptée | Attestation horodatée, empreinte de prix figée |
| 4 | Autorisation de la carte, **sans débit** | Référence du prestataire |
| 5 | Le Voyageur accepte sous 24 heures, sinon expiration | Horodatage serveur |
| 6 | **Capture** du paiement à l'acceptation | Référence de capture |
| 7 | Rendez-vous convenu dans la messagerie | Fil de conversation, objet rendez-vous |
| 8 | **Inspection du colis ouvert**, liste en cinq points, photos, scellement devant le Voyageur | Photos, liste, horodatage |
| 9 | Transport dans les bagages du Voyageur | Trajet déclaré, jalons facultatifs |
| 10 | Le destinataire donne le code, le Voyageur le saisit | Validation serveur, photos facultatives |
| 11 | Confirmation par l'Expéditeur, ou automatique à quatre jours | Horodatage |
| 12 | Versement du transport au Voyageur | Référence du virement |

**Le moment clé est l'étape 8.** Le colis n'est pas scellé avant la rencontre. Il est présenté
ouvert, inspecté, puis scellé devant le Voyageur. Le serveur refuse la prise en charge sans
liste complète et sans au moins une photo.

### 3.3 Les neuf états

| État | Signification | Argent | Kilos |
|---|---|---|---|
| `PENDING` | En attente, expire en 24 h | Autorisé, non débité | Réservés |
| `ACCEPTED` | Acceptée | **Capturé, détenu** | Réservés |
| `PICKED_UP` | Colis inspecté et pris en charge | Détenu | Réservés |
| `DELIVERED` | Code validé | Détenu, versement programmé | Réservés |
| `COMPLETED` | Confirmée | Versé au Voyageur | Libérés |
| `DECLINED` | Refusée par le Voyageur | Remboursé | Libérés |
| `EXPIRED` | Non traitée en 24 h | Remboursé | Libérés |
| `CANCELLED` | Annulée | Selon la politique d'annulation | Libérés |
| `DISPUTED` | Litige ouvert | **Versement gelé** | Réservés |

Seize transitions sont autorisées, chacune réservée à un acteur précis, et aucune autre n'est
possible. L'état `DISPUTED` gèle le versement : tant que le litige n'est pas tranché, l'argent
est encore chez la plateforme. **Une décision de remboursement n'exige donc jamais de
récupérer des fonds déjà versés au Voyageur.**

---

## 4. Le modèle économique et les flux d'argent

### 4.1 La formule de prix, telle qu'elle est codée

```
poids facturable = max(poids réel ; 0,5 kg)
transport        = max( arrondi(prix/kg × poids facturable × coef taille × (1 + supplément famille)) ; 8,00 € )
commission       = max( arrondi(transport × 12 %) ; 3,00 € )
prime            = 6,00 € si protection étendue, sinon 0
total Expéditeur = transport + commission + prime
net Voyageur     = transport
```

| Paramètre | Valeur |
|---|---|
| Taux de commission | 12 % |
| Plancher de commission | 3,00 € |
| Transport minimum | 8,00 € |
| Poids facturable minimum | 0,5 kg |
| Coefficients de taille, petit, moyen, grand | 1 ; 1,1 ; 1,25 |
| Prime de la protection étendue | 6,00 € |
| Plafond annoncé de la protection étendue | 500,00 € |

Deux produits au forfait existent également, le bagage en soute de 23 kg et le bagage cabine
de 12 kg, où le transport est un prix fixe du Voyageur.

Tous les montants sont manipulés en **centimes entiers**, jamais en nombres décimaux. C'est
une règle d'architecture non négociable, destinée à supprimer toute dérive d'arrondi.

L'Expéditeur ne voit que deux lignes : « Transport » et « Service et protection ». Le
Voyageur ne voit que son net. Les frais du prestataire de paiement sont absorbés dans la
commission.

### 4.2 La prime est déjà séparée de la commission

Dès la première version, la prime est un flux comptable distinct. Elle a sa propre ligne dans
l'empreinte de prix figée à la réservation et ses propres champs en base :

```
protectionProvider   "YAMBA_GUARANTEE" aujourd'hui, le code de l'assureur demain
protectionTier       "BASIC" ou "EXTENDED_500"
premiumCents         montant de la prime, en centimes
```

Cette séparation a été décidée par avance pour qu'une prime reversée à un assureur ne se
mélange jamais à la commission. **Le passage de la garantie commerciale à une assurance
portée par un tiers est un changement de valeur dans un champ existant, pas une refonte.**

Le rapport financier du back-office distingue déjà commission et prime.

### 4.3 Le circuit de l'argent

| Moment | Mouvement |
|---|---|
| Demande | Autorisation sur la carte, **aucun débit** |
| Acceptation par le Voyageur | Capture du montant total |
| Entre acceptation et livraison | Fonds détenus par la plateforme |
| Quatre jours après la livraison | Virement du transport au Voyageur |
| Litige ouvert | Versement gelé jusqu'à décision |

L'empreinte de prix est **immuable**. Si le Voyageur modifie son tarif, les réservations déjà
passées ne bougent pas. Un changement de paramètre de la plateforme n'est jamais rétroactif.
Toute contestation de montant est donc vérifiable sur pièce.

---

## 5. La protection actuelle : ce qui existe, ce qui n'existe pas

### 5.1 Deux niveaux

| Niveau | Prime | Plafond annoncé | Nature |
|---|---|---|---|
| Protection de base | Incluse | **Non fixé** | Engagement commercial de la plateforme |
| Protection étendue | 6,00 € | 500,00 € | Engagement commercial de la plateforme |

**Ce n'est pas une assurance et nous nous interdisons de l'appeler ainsi.** Une règle interne,
écrite avant le code, interdit le mot « assurance » dans l'interface, les emails et les
conditions générales tant qu'aucun contrat n'est signé avec un assureur. Avant signature,
seuls « Garantie Yamba » et « protection » sont employés. Une correction a d'ailleurs été
menée dans tout le produit pour retirer les occurrences fautives du mot.

Ce que le produit promet aujourd'hui à l'Expéditeur :

- **Protection de base** : protection contre la non-livraison, le paiement étant bloqué
  jusqu'à la remise au destinataire.
- **Protection étendue** : perte, vol, casse pendant le transport, exclusions affichées avant
  validation, dont la saisie douanière d'un colis non conforme.

### 5.2 Le mode d'indemnisation prévu par nos règles

L'indemnisation est plafonnée au plus petit des trois montants suivants : la valeur déclarée
par l'Expéditeur, le plafond du niveau souscrit, la valeur justifiée lors de l'examen du
litige. Elle n'est versée qu'à l'issue d'un litige tranché en faveur de l'Expéditeur.

### 5.3 Quatre écarts que nous portons à votre connaissance

Nous les énonçons ici parce qu'ils changent la nature de la conversation.

**Le risque est aujourd'hui porté par l'éditeur.** En cas de perte, c'est Telama qui paie sur
ses fonds propres. C'est la raison première de ce dossier.

**La règle d'indemnisation n'est pas implémentée.** Le plafond de 500 € et la valeur déclarée
ne bornent aujourd'hui **aucun** calcul dans le code. La seule limite effective d'un
remboursement de litige est le montant total payé par l'Expéditeur pour ce colis, ce qui est
en pratique très inférieur au plafond annoncé. Autrement dit, notre exposition réelle est
aujourd'hui plus faible que notre promesse commerciale. **Cet écart doit être résolu, et la
manière de le résoudre dépend de votre réponse.**

**La valeur déclarable dépasse massivement le plafond annoncé.** Le formulaire accepte une
valeur déclarée allant jusqu'à 50 000 €, contre un plafond de garantie de 500 €. Sur un
compte récent, un plafond de 300 € s'applique, mais il disparaît ensuite. Cet écart est un
défaut de conception que nous corrigerons, soit en alignant la valeur déclarable sur le
plafond assurable, soit en introduisant des paliers de couverture.

**Le document d'exclusions n'existe pas.** Le lien « Voir les conditions » présenté à
l'Expéditeur avant son choix ne pointe aujourd'hui vers aucun contenu. Sous régime
d'assurance, nous savons qu'un document d'information normalisé devra être remis avant
souscription. Nous attendons votre modèle plutôt que d'en rédiger un qui serait faux.

---

## 6. Les mesures de prévention en production

Cette partie est le cœur du dossier. Sauf mention contraire explicite, tout ce qui suit est
écrit, testé et bloquant.

Nous acceptons par avance que ces contrôles deviennent une **condition contractuelle de la
couverture**. Une règle interne le prévoit déjà.

### 6.1 Les objets interdits

La liste, fondée sur la réglementation du transport aérien et les règles douanières des
corridors desservis, est la suivante :

stupéfiants et substances contrôlées, armes et munitions, batteries au lithium hors
équipement, liquides et aérosols au-delà des règles de cabine, espèces et instruments
monétaires, médicaments hors prescription personnelle, denrées périssables, contrefaçons.

Les conditions générales y ajoutent les animaux vivants, les matières dangereuses et les
objets volés.

**Précision importante.** Cette liste est aujourd'hui **déclarative, non bloquante**. Elle est
affichée sur la page du trajet, rappelée dans la charte acceptée par l'Expéditeur, et reprise
dans la liste de contrôle du Voyageur au moment de l'inspection. Elle ne filtre pas encore
automatiquement le formulaire de réservation. Nos règles écrites prévoient qu'elle le fasse ;
ce n'est pas encore construit. Le contrôle réel est donc double et humain : l'attestation de
l'Expéditeur, et l'inspection du colis ouvert par le Voyageur, elle-même bloquante.

### 6.2 La charte et les attestations

À chaque réservation, l'Expéditeur doit cocher **deux acceptations obligatoires**, refusées
par le serveur si elles sont absentes : la charte de conformité et les conditions générales.
La charte porte trois engagements sur l'honneur : aucun produit illicite, dangereux ou
interdit ; conformité de la catégorie, du poids et du contenu déclarés ; respect des
obligations douanières. Elle précise que toute déclaration mensongère engage la seule
responsabilité civile et pénale de l'Expéditeur.

Chaque acceptation est conservée avec **la version du texte accepté et un horodatage serveur**.

Nous signalons que les documents de rang contractuel visés par ces cases, charte complète,
conditions de vente et contrat de transport, **restent à rédiger**. Ce point est traité dans
le dossier juridique remis en parallèle, et il sera résolu avant l'ouverture.

### 6.3 La classification du contenu

Le colis est rangé dans une **famille de risque** parmi huit : documents et papiers,
vêtements et textile, alimentaire sec et scellé, appareils électroniques, cosmétiques et
soins, pièces et outils, jouets et puériculture, accessoires divers. La famille répond à la
question « qu'est-ce que c'est » du point de vue de la conformité et du risque, jamais du
prix.

L'alimentaire sec et scellé est strictement encadré : scellé d'origine uniquement, jamais de
périssable, inspection renforcée à la prise en charge.

Le Voyageur déclare pour chaque famille s'il l'accepte, la surtaxe ou la refuse. Une famille
refusée bloque la réservation.

Une seconde taxonomie de douze catégories plus fines coexiste pour l'affichage. Aucune des
deux ne comporte de rubrique « divers » permettant de masquer un contenu non déclarable.

### 6.4 L'inspection au moment de la prise en charge

Notre mesure la plus forte, et elle est **techniquement bloquante**.

- Le colis n'est pas scellé avant la rencontre.
- Il est présenté ouvert au Voyageur.
- Le Voyageur remplit une liste de contrôle en cinq points, dont « j'ai vu le contenu ouvert
  et il correspond à la déclaration » et « aucun produit interdit n'est présent ».
- **Une à cinq photos sont exigées, au moins une est obligatoire.**
- Le colis est scellé devant le Voyageur.
- **Sans liste complète et sans photo, le serveur répond par une erreur et la prise en charge
  n'est pas enregistrée.**

Le Voyageur dispose d'un **droit de refus inconditionnel** à ce moment. Tout doute autorise le
refus, sans pénalité de réputation, avec remboursement intégral de l'Expéditeur et
signalement facultatif.

### 6.5 La preuve de la remise

Code à **six chiffres**, tiré par un générateur cryptographique, remis au destinataire, jamais
au Voyageur, généré uniquement au moment de la prise en charge.

- Stocké sous forme d'**empreinte irréversible** pour la validation, et sous forme
  **chiffrée** séparément pour le réaffichage au seul Expéditeur, uniquement pendant le
  transport. Le code en clair n'est jamais en base.
- **Il ne circule jamais** dans un email, un événement technique, un message, un dossier
  d'opérateur ou un export. La messagerie détecte et refuse activement l'envoi d'un groupe de
  six chiffres correspondant au code.
- Trois tentatives de saisie, puis un verrouillage de quinze minutes.
- Cinq régénérations au maximum.

Le Voyageur peut joindre jusqu'à deux photos à la remise. **Elles sont facultatives.**

### 6.6 La vérification d'identité

| Partie | Contrôle | État |
|---|---|---|
| Voyageur | Vérification d'identité complète par le prestataire de paiement | **En production**, obligatoire pour accepter un colis et pour être payé |
| Expéditeur | Vérification d'identité | **Spécifiée, non implémentée**. Réserver n'exige aujourd'hui qu'un compte |
| Les deux | Vérification de l'adresse email par code à six chiffres, avec paliers anti-force brute | **En production** |
| Les deux | Numéro de téléphone au format international | Format contrôlé, **mais aucune vérification par message** |
| Les deux | Âge minimum | **Aucune vérification à l'inscription.** Un seuil de seize ans s'applique si le membre renseigne sa date de naissance, facultative |

Nous signalons ces deux manques sans les minimiser. Ils figurent dans nos règles écrites et
n'ont pas encore été construits.

### 6.7 Les plafonds sur les comptes récents et à risque

Un score de confiance interne, invisible des membres, calculé à la lecture et jamais stocké,
agrège des signaux pondérés : litiges perdus, annulations tardives, signalements reçus et
confirmés, vitesse d'activité anormale sur un compte récent, ancienneté. Les livraisons
réussies et les bonnes notes font baisser le score.

Quatre niveaux existent : nouveau, standard, sous surveillance, risque élevé.

Pour un compte **nouveau** ou en **risque élevé**, trois plafonds s'appliquent
automatiquement et sont refusés par le serveur :

| Plafond | Valeur |
|---|---|
| Valeur déclarée par colis | 300 € |
| Poids par colis | 10 kg |
| Envois par mois civil | 5 |

Le poids et le nombre d'envois sont vérifiés **dès l'autorisation de paiement**, donc avant
tout débit.

**Aucune sanction n'est automatique.** Le score sert à plafonner, à prioriser la file de revue
et à éclairer une décision humaine. Un opérateur décide et son geste est journalisé.

### 6.8 Signalement et sanction

Tout membre peut signaler un profil, un trajet, une réservation ou un message. Les
signalements alimentent une file traitée par des opérateurs. Un compte peut être **restreint**
ou **suspendu** : un compte suspendu ne peut plus se connecter, publier ni réserver.

---

## 7. La chaîne de preuve mobilisable

| Élément | Disponible | Obligatoire |
|---|---|---|
| Identité vérifiée du Voyageur | Oui | Oui |
| Identité de l'Expéditeur | Compte et email vérifiés seulement | Non |
| Déclaration du colis : famille, catégorie, poids, taille, description | Oui | Oui |
| Valeur déclarée | Oui | Oui, **sans justificatif demandé** |
| Charte de conformité acceptée, avec version du texte | Oui | Oui |
| Conditions générales acceptées, avec version | Oui | Oui |
| Photos du colis déclarées par l'Expéditeur, jusqu'à cinq | Oui | Exigées avec la protection étendue |
| **Photos du colis ouvert à la prise en charge, une à cinq** | Oui | **Oui** |
| **Liste de contrôle d'inspection en cinq points** | Oui | **Oui** |
| Horodatage serveur de la prise en charge | Oui | Oui |
| Trajet déclaré : villes, dates | Oui | Oui |
| Jalons de transit : à l'aéroport, décollage, atterrissage | Oui | Non |
| Fil de conversation entre les parties | Oui, conservé un an | — |
| Lieu et heure du rendez-vous convenu | Oui | — |
| Validation du code de remise, horodatée | Oui | Oui |
| Photos de remise, jusqu'à deux | Oui | **Non** |
| Dossier de litige : description, photos, réponse du Voyageur | Oui | — |
| Décision motivée, son auteur, son horodatage | Oui | Oui |
| Journal des gestes d'opérateur | Oui | Oui |
| Historique des mouvements d'argent | Oui | Oui |

Trois points d'honnêteté.

**Aucune géolocalisation n'est collectée**, à aucune étape. Le colis voyage dans les bagages
d'une personne ; il n'est pas suivi et ne peut pas l'être.

**Les photos de remise sont facultatives.** Si vous en faites une condition de couverture,
nous les rendrons obligatoires.

**Les photos hébergées sont accessibles à qui connaît leur adresse**, et leur identifiant
n'est pas conservé, ce qui empêche aujourd'hui leur suppression sur demande d'effacement.
C'est une dette technique identifiée, qui touche à la fois la valeur probatoire et la
protection des données. Elle est en cours de traitement.

---

## 8. Le traitement des litiges

### 8.1 Qui, quand

**Seul l'Expéditeur** peut ouvrir un litige, dans deux fenêtres :

- depuis l'état livré, **avant l'échéance de versement de quatre jours** ;
- depuis l'état pris en charge, **à partir de quarante-huit heures après le départ**, lorsque
  le colis n'a jamais été livré. La catégorie est alors imposée.

Après le versement, la réservation ne peut plus être contestée. Après la prise en charge,
aucune annulation n'est possible : le litige est la seule voie.

### 8.2 L'ouverture

Six catégories : non livré, contenu manquant, endommagé, retard important, problème avec le
destinataire, autre.

L'ouverture exige une description de **cinquante à deux mille caractères**, jusqu'à cinq
photos, et un **engagement sur l'honneur horodaté** destiné à décourager les demandes
abusives. Le dossier reçoit un numéro unique.

Effets immédiats : **gel du versement**, passage en état litigieux, fil de conversation en
lecture seule. Un litige n'est **ni modifiable ni retirable**.

### 8.3 Le contradictoire

Le Voyageur est informé et dépose **une seule fois** sa version, avec cinq photos au maximum.
L'opérateur ne peut trancher qu'après cette réponse, **ou après un délai de soixante-douze
heures** si le Voyageur ne répond pas.

Les pièces sont cloisonnées. Le Voyageur ne reçoit que la catégorie, jamais la description ni
les photos de l'Expéditeur. L'Expéditeur ne voit jamais la version du Voyageur.

### 8.4 La décision

Trois issues, prises par un opérateur portant le profil de médiateur, lequel ne peut pas être
partie au dossier.

| Issue | Effet |
|---|---|
| Rejet | Le Voyageur est payé normalement |
| Remboursement partiel | Montant libre entre un centime et le total moins un centime |
| Remboursement intégral | La totalité du montant payé, commission et prime comprises |

La décision exige une motivation d'au moins cinquante caractères, **lue par les deux parties**,
et elle est irréversible. Le remboursement chez le prestataire est exécuté **avant** l'écriture
en base, puis la transaction, puis le versement éventuel.

La partie perdante est comptabilisée dans un compteur interne de litiges perdus, jamais
public, qui alimente le score de confiance. Un dossier clos par médiation ne peut pas donner
lieu à une notation.

**Point à corriger, déjà signalé en partie 5** : le montant remboursable n'est aujourd'hui
borné ni par la valeur déclarée, ni par le plafond de garantie, mais seulement par le total
payé pour ce colis.

---

## 9. Sinistralité, volumes et équilibre économique

### 9.1 Ce que nous n'avons pas

Aucune transaction réelle, donc aucun sinistre, donc aucun taux. Les seules réservations en
base proviennent d'un jeu de données de test. Nous ne construirons pas une statistique à
partir de rien.

### 9.2 Le registre que nous ouvrons

Dès la première livraison, un registre mensuel alimenté par la plateforme, comprenant :

- colis livrés,
- litiges ouverts par catégorie,
- litiges tranchés en faveur de l'Expéditeur,
- montant total remboursé,
- valeur déclarée moyenne et maximale,
- refus au moment de la prise en charge, avec motif.

Ces données sont déjà calculables : le back-office produit un rapport mensuel et une
exportation.

### 9.3 L'équilibre économique de la garantie, tel que nous l'avons calculé

Nous avons fait le calcul et il est inconfortable. À 6 € de prime pour 500 € de plafond
annoncé, **un taux de sinistre de 1,2 % suffit à rendre la ligne déficitaire**. C'est un
argument de plus pour ne pas rester assureur de nous-mêmes, et c'est aussi une donnée dont
vous aurez besoin pour calibrer la prime réelle. Si votre cotation implique une prime
supérieure à 6 €, nous l'ajusterons : ce paramètre est modifiable en ligne et n'est jamais
rétroactif sur les réservations existantes.

### 9.4 Deux voies possibles

**Voie 1, la période probatoire.** Ouverture sous garantie commerciale, corridor unique,
plafond bas, volume plafonné. Retour vers vous après six à douze mois avec une sinistralité
réelle. Cette voie a notre préférence si elle vous convient.

**Voie 2, la couverture immédiate encadrée.** Couverture dès l'ouverture, plafond bas,
franchise, et les contrôles de la partie 6 en conditions contractuelles.

### 9.5 Volumes envisagés

| Période | Colis par mois |
|---|---|
| Trois premiers mois | 10 à 30 |
| Six premiers mois | 30 à 100 |
| Douze premiers mois | 100 à 300 |

Hypothèses de travail, pas des projections commerciales.

---

## 10. Scénarios de sinistre

| Scénario | Fréquence attendue | Traitement actuel | Question posée |
|---|---|---|---|
| Colis non remis, Voyageur injoignable | Rare | Litige possible dès 48 h après le départ, remboursement, suspension | Couvert ? Sous quelle preuve ? |
| Contenu partiellement manquant | Possible | Litige, remboursement partiel après examen des photos | Comment établir l'état au départ ? |
| Colis endommagé pendant le transport | Possible | Litige, remboursement selon examen | Franchise ? Plafond par colis ? |
| Retard important lié au vol | Fréquent | Catégorie prévue, pas de remboursement automatique | Exclusion attendue ? |
| Colis saisi en douane pour non-conformité | Rare, grave | **Exclusion déjà affichée avant souscription** | Exclusion confirmée ? |
| Colis illicite transporté à l'insu du Voyageur | Rare, très grave | Charte, liste bloquante, inspection, droit de refus, suspension | Impact sur la cotation ? |
| Vol du bagage du Voyageur | Possible | Litige | Articulation avec l'assurance bagages du Voyageur ? |
| Contestation de la valeur déclarée | Fréquente | Examen en médiation, **aucun justificatif exigé aujourd'hui** | Quel niveau de preuve exiger ? |
| Erreur de la plateforme dans un versement | Rare | Rapprochement et correction tracés | Relève de la responsabilité civile ? |
| Fuite de données personnelles | Rare, grave | Procédure écrite, notification | Relève du volet cyber ? |

---

## 11. Le périmètre technique : web, back-office, mobile

### 11.1 L'application web des membres

Interface des Expéditeurs et des Voyageurs, en français et en anglais, sur ordinateur et
téléphone. Tous les contrôles de la partie 6 y sont présents, mais **aucune limite n'est
décidée par l'interface** : le serveur est seul juge et l'interface ne fait que refléter les
actions qu'il déclare autorisées. Une manipulation du navigateur ne contourne donc aucun
contrôle.

### 11.2 Le back-office

Interface séparée, réservée aux opérateurs, avec une authentification distincte de celle des
membres et une **double authentification obligatoire**. Elle donne accès à la file des
litiges et à la décision de médiation, à la file des signalements, au dossier financier de
chaque réservation, aux rapprochements et remboursements, aux alertes de seuil, à la gestion
des comptes et des sanctions, aux paramètres de la plateforme et au journal d'audit.

Six profils d'opérateur existent avec des permissions distinctes : administrateur général,
médiateur, support, finance, exploitation, protection des données. Seul le médiateur peut
trancher un litige. Un remboursement manuel peut être **proposé** par le support ou la finance
mais **appliqué** par le seul administrateur général.

**Chaque geste d'opérateur est journalisé dans la même transaction que le geste**, ce qui rend
impossible une action non tracée et fiabilise la reconstitution d'un dossier de sinistre.

### 11.3 Les applications mobiles

Non développées. Le chantier est planifié : construire pour les deux systèmes dès le socle,
publier Android en premier.

Deux conséquences pour vous. Les applications **consommeront la même interface de
programmation** que le site, donc les contrôles de la partie 6 s'y appliqueront à l'identique,
sans réécriture ni divergence possible. Et l'appareil photo natif améliorera la qualité des
preuves à la prise en charge et à la remise.

---

## 12. Les trois couvertures demandées

### 12.1 Couverture A, responsabilité civile professionnelle

**Activité** : édition et exploitation d'une plateforme de mise en relation, séquestre de
paiement pour compte de tiers, médiation de litiges entre membres.

**Risques visés** : faute d'intermédiation, défaut d'information, indisponibilité du service,
erreur dans un versement ou un remboursement, préjudice causé par une décision de médiation.

**Priorité** : indispensable avant toute ouverture commerciale.

### 12.2 Couverture B, marchandises transportées

**Situation** : un colis remis par un particulier à un autre particulier, transporté dans les
bagages personnels de ce dernier sur un vol commercial, entre deux pays quelconques. Le
service est mondial ; nous attendons de vous le périmètre géographique couvert, et nous
restreindrons l'ouverture des corridors en conséquence si nécessaire.

**Périmètre souhaité** : perte totale, perte partielle, dommage, vol, non-remise.

**Déclenchement souhaité** : ouverture à l'instant de la prise en charge enregistrée,
extinction à la validation du code de remise. Ces deux instants sont horodatés par le serveur
et opposables.

**Modalité souhaitée** : garantie activable colis par colis, prime prélevée dans le prix payé
par l'Expéditeur et reversée par la plateforme, plafond aligné sur une valeur déclarée
elle-même plafonnée.

**Priorité** : indispensable avant la montée en volume.

### 12.3 Couverture C, cyber et données personnelles

**Risques visés** : violation de données, notification aux personnes concernées et à
l'autorité de contrôle, frais de gestion de crise, interruption d'activité.

**Contexte** : la plateforme traite des données d'identité, des coordonnées, des données de
paiement chez un prestataire agréé, et des données de tiers destinataires non inscrits.

---

## 13. Les écarts que nous connaissons

Énoncés sans détour, classés par importance pour un assureur.

| # | Écart | Conséquence |
|---|---|---|
| 1 | Aucune donnée de sinistralité, aucune transaction réelle | Cotation difficile, voir partie 9 |
| 2 | La règle d'indemnisation n'est pas codée : ni la valeur déclarée ni le plafond ne bornent un remboursement | Promesse commerciale et code divergent |
| 3 | Valeur déclarable jusqu'à 50 000 € contre un plafond de 500 € | À aligner, méthode à décider avec vous |
| 4 | Plafond de la protection de base non fixé | À déterminer avec vous |
| 5 | Aucun document d'exclusions, le lien vers les conditions est inactif | À produire avant l'ouverture |
| 6 | Les conditions générales excluent toute responsabilité en cas de perte, vol ou détérioration, sans mentionner la garantie | Contradiction à corriger, traitée dans le dossier juridique |
| 7 | Aucune vérification d'identité de l'Expéditeur | Spécifiée, non construite |
| 8 | Aucune vérification du numéro de téléphone | Aucun envoi de message court n'existe |
| 9 | Le poids réel n'est jamais saisi à la prise en charge | La tolérance de poids annoncée n'est pas applicable |
| 10 | Photos de remise facultatives | Peut devenir obligatoire si vous l'exigez |
| 11 | Photos accessibles par leur adresse et non supprimables | Dette technique en cours de traitement |
| 12 | Aucune politique de conformité formalisée en document | Les règles existent et sont appliquées, le document reste à écrire |
| 13 | Aucun suivi géographique du colis | Impossible par nature |
| 14 | La liste des objets interdits est déclarative, pas bloquante au formulaire | Le contrôle repose sur l'attestation et sur l'inspection |
| 15 | Aucune vérification d'âge à l'inscription | Seuil de seize ans sur une date de naissance facultative |
| 16 | Charte complète, conditions de vente et contrat de transport non rédigés | Les cases d'acceptation visent des documents inexistants |

Les points 2, 3, 4, 5 et 6 sont précisément ceux que nous souhaitons arbitrer avec vous
plutôt que seuls.

---

## 14. Questions ouvertes au courtier

1. Le transport d'un colis par un particulier non professionnel, dans ses bagages, est-il
   assurable au titre des marchandises transportées ? Si non, quel montage recommandez-vous ?
2. Le contrat doit-il être souscrit par la plateforme pour le compte de ses membres, ou
   chaque Voyageur doit-il souscrire une police ?
3. La plateforme peut-elle distribuer une garantie d'assurance, sous quel statut, et avec
   quelles obligations d'information précontractuelle ?
4. Quelle sinistralité minimale exigez-vous avant de coter, et acceptez-vous une période
   probatoire sous garantie commerciale ?
5. Quelles exclusions considérez-vous comme non négociables, afin que nous les reflétions
   fidèlement dans la charte et les conditions générales ?
6. Quel plafond par colis, quel plafond annuel, quelle franchise ?
7. Quelle prime réelle pour un plafond de 500 €, sachant que notre prime actuelle de 6 €
   devient déficitaire au-delà de 1,2 % de sinistres ?
8. Quel niveau de preuve exigez-vous ? Faut-il rendre obligatoires les photos de remise et
   exiger un justificatif de valeur ?
9. Quel périmètre géographique couvrez-vous ? Le service étant mondial, quels pays excluez-vous,
   et acceptez-vous que nous restreignions l'ouverture des corridors pour rester dans votre
   périmètre ?
10. Faut-il aligner la valeur déclarable maximale sur le plafond de couverture, ou préférez-vous
    des paliers de garantie ?
11. Quel plafond recommandez-vous pour la protection de base incluse ?
12. Faut-il exiger du Voyageur une assurance voyage ou bagages, et l'articuler à la vôtre ?
13. Quel délai prévoir entre notre accord et la mise en production de la garantie ?

---

## 15. Annexes

### Annexe A — Paramètres de tarification et de protection

| Paramètre | Valeur en centimes | Réglable en ligne |
|---|---|---|
| Taux de commission | 12 % | Oui, de 5 à 20 % |
| Plancher de commission | 300 | Oui, de 100 à 1 000 |
| Transport minimum | 800 | Oui |
| Prime de la protection étendue | 600 | Oui, de 0 à 5 000 |
| Plafond de la protection étendue | 50 000 | Oui, de 10 000 à 200 000 |
| Valeur déclarée maximale au formulaire | 5 000 000 | Non |
| Valeur déclarée maximale, compte récent | 30 000 | Oui |

Les paramètres de protection sont marqués comme **contractuels** dans notre outil
d'administration : leur modification est journalisée, motivée, et notifiée. Elle n'est jamais
rétroactive.

### Annexe B — Familles de risque

Documents et papiers, vêtements et textile, alimentaire sec et scellé, appareils
électroniques, cosmétiques et soins, pièces et outils, jouets et puériculture, accessoires
divers.

### Annexe C — Limites en production

| Limite | Valeur |
|---|---|
| Poids maximal par colis, serveur | 50 kg |
| Poids maximal par colis, formulaire | 30 kg |
| Poids maximal, compte récent ou à risque | 10 kg |
| Nombre de colis par trajet | Aucune limite en nombre, seule la capacité en kilogrammes borne |
| Un colis par réservation | Oui, pas de multi-colis |
| Expiration d'une demande | 24 heures |
| Délai de versement après livraison | 4 jours |
| Ouverture de litige après un départ sans livraison | 48 heures |
| Délai de réponse du Voyageur en litige | 72 heures |
| Code de remise | 6 chiffres, 3 essais, verrou 15 minutes, 5 régénérations |
| Photos déclarées, prise en charge, remise, litige | 5 / 1 à 5 obligatoires / 2 facultatives / 5 par partie |
| Description de litige | 50 à 2 000 caractères |
| Motivation d'une décision | 50 caractères minimum |
| Conservation des messages | 1 an |

### Annexe D — Documents disponibles sur demande

Documentation métier et fonctionnelle complète, documentation du back-office, documentation
technique de bout en bout, cahiers de recette, conditions générales actuelles, registre de
sinistralité à compter de la première livraison.
