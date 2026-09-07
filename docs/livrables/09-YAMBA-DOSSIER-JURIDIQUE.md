# Dossier de présentation aux juristes

> **Destinataires** : avocats en droit du numérique, des plateformes, du transport et de la
> consommation ; délégué à la protection des données.
> **Objet** : obtenir une qualification de l'activité, la rédaction des documents contractuels
> manquants, et une mise en conformité avant l'ouverture commerciale.
>
> **Éditeur** : Telama, **structure non encore immatriculée**. **Produit** : Yamba.
> **Version** : septembre 2026.
>
> **Note de méthode.** Ce dossier a été établi par revue systématique du code et des règles
> internes. Il distingue ce qui est **en production**, ce qui est **spécifié mais non
> construit**, et ce qui **manque**. La partie 14 recense sans ménagement les
> non-conformités que nous avons nous-mêmes identifiées. Nous préférons vous les remettre
> plutôt que vous les laisser découvrir.

---

## Sommaire

1. Ce que nous demandons, et dans quel ordre
2. L'entreprise et l'état du projet
3. Le service, décrit de bout en bout
4. Le modèle contractuel et financier
5. L'état des documents contractuels
6. Les données personnelles
7. Les sous-traitants et les transferts
8. Conformité du transport et objets interdits
9. Modération, signalements, sanctions
10. La messagerie
11. Sécurité et traçabilité
12. Mineurs et âge minimum
13. Web, back-office et mobile
14. Les non-conformités que nous avons identifiées
15. Les questions posées
16. Livrables attendus

---

## 1. Ce que nous demandons, et dans quel ordre

Trois missions, par ordre d'urgence.

**Mission 1, bloquante avant toute ouverture.** Qualifier juridiquement l'activité, puis
rédiger le corpus contractuel. Aujourd'hui, l'utilisateur coche une case qui vaut acceptation
de trois documents qui **n'existent pas**. Aucune ouverture n'est envisageable dans cet état.

**Mission 2, avant l'ouverture également.** Mettre en conformité le traitement des données
personnelles : registre des traitements, durées de conservation manquantes, contrats de
sous-traitance, information des personnes, politique de cookies.

**Mission 3, à court terme.** Sécuriser les points de risque du métier : objets interdits,
douane, statut des Voyageurs, litiges transfrontaliers, articulation avec l'assurance en cours
de négociation.

Nous cherchons un conseil qui connaisse **le droit des plateformes et le transport**, pas un
généraliste. Le service est mondial, ce qui rend la question de la loi applicable et de la
juridiction compétente centrale, et non accessoire.

---

## 2. L'entreprise et l'état du projet

| Élément | État |
|---|---|
| Éditeur | **Telama, non immatriculée à ce jour** |
| Forme sociale envisagée | Non arrêtée, à décider avec un expert-comptable |
| Produit | Plateforme web complète, développée et testée |
| Ouverture commerciale | Non effectuée |
| Transactions réelles | Aucune |
| Applications mobiles | Non développées |
| Documents contractuels | **Deux brouillons non validés, quatre documents manquants** |
| Mentions légales | **Inexistantes** |

L'absence d'entité est un préalable connu. Elle conditionne l'encaissement des commissions,
le compte de paiement de la plateforme, les comptes développeur mobiles et la validité même
des documents que nous vous demandons de rédiger.

Deux incohérences à signaler tout de suite. Les brouillons citent des adresses de contact en
`yamba.com` alors que le produit utilise `yamba.app`. L'adresse postale de la politique de
confidentialité est littéralement un champ à compléter.

---

## 3. Le service, décrit de bout en bout

### 3.1 Les acteurs

**Le Voyageur** est un particulier qui a déjà prévu un déplacement. Il publie son trajet, la
capacité en kilogrammes qu'il cède, son prix au kilogramme et les points de rendez-vous. Il
ne se déplace pas pour le colis et n'est pas un professionnel du transport.

**L'Expéditeur** est un particulier qui envoie un colis. Il décrit le colis, déclare sa valeur,
choisit un niveau de protection, paie, et désigne un destinataire.

**Le destinataire** est un tiers, **sans compte sur la plateforme**, dont l'Expéditeur
communique le nom, le téléphone et parfois l'adresse électronique. Il détient le code qui
autorise la remise.

**La plateforme** met en relation, encaisse, séquestre, encadre la remise, arbitre les
litiges et reverse.

### 3.2 Le périmètre géographique

**Le service est mondial par conception.** Aucun corridor n'est codé en dur : dès qu'un
Voyageur publie un trajet, la liaison existe, quels que soient les pays de départ et
d'arrivée. La mise en marché commencera sur un corridor unique pour des raisons commerciales,
mais rien dans le produit ne l'y restreint.

Cette universalité est un choix produit assumé. Elle a une conséquence juridique directe que
nous vous soumettons : la loi applicable, la juridiction compétente, les règles douanières et
les régimes de responsabilité varient d'un corridor à l'autre, et notre corpus contractuel
doit tenir dans ce cadre. Si la seule voie praticable est de restreindre les corridors
ouverts, nous savons techniquement le faire.

### 3.3 Le parcours

| Étape | Ce qui se passe | Trace conservée |
|---|---|---|
| 1 | Le Voyageur publie trajet et capacité | Trajet horodaté |
| 2 | L'Expéditeur trouve le trajet | — |
| 3 | Demande : description, valeur déclarée, **deux acceptations obligatoires** | Consentement horodaté avec version du texte |
| 4 | Autorisation de la carte, sans débit | Référence du prestataire |
| 5 | Le Voyageur accepte sous 24 heures, sinon expiration | Horodatage serveur |
| 6 | **Capture** du paiement à l'acceptation | Référence de capture |
| 7 | Rendez-vous convenu dans la messagerie | Fil de conversation |
| 8 | Inspection du colis ouvert, liste en cinq points, photos, scellement | Photos, liste, horodatage |
| 9 | Transport dans les bagages du Voyageur | Trajet déclaré |
| 10 | Le destinataire donne le code, le Voyageur le saisit | Validation serveur |
| 11 | Confirmation par l'Expéditeur, ou automatique à quatre jours | Horodatage |
| 12 | Versement du transport au Voyageur | Référence du virement |

### 3.4 Les neuf états

`PENDING`, `ACCEPTED`, `PICKED_UP`, `DELIVERED`, `COMPLETED`, `DECLINED`, `EXPIRED`,
`CANCELLED`, `DISPUTED`. Seize transitions sont autorisées, chacune réservée à un acteur
précis. L'ouverture d'un litige gèle le versement.

---

## 4. Le modèle contractuel et financier

### 4.1 La position que nous affirmons aujourd'hui

Le brouillon de conditions générales affirme que la plateforme **ne réalise pas les
transports** et **agit uniquement comme intermédiaire technique de mise en relation**. Il
écarte sa responsabilité en cas de litige entre les parties, ainsi qu'en cas de perte, de vol
ou de détérioration d'un colis.

**Nous vous demandons de vérifier si cette position tient**, compte tenu de ce que la
plateforme fait réellement : elle fixe la formule de prix, encaisse la totalité du prix,
détient les fonds, impose une procédure d'inspection, détient la preuve de remise, tranche les
litiges, et décide seule des remboursements. Ce faisceau nous paraît difficilement compatible
avec la qualification de simple intermédiaire technique, et nous préférons poser la question
plutôt que d'en faire l'économie.

### 4.2 Le circuit financier

| Moment | Mouvement |
|---|---|
| Demande | Autorisation sur la carte de l'Expéditeur, **sans débit** |
| Acceptation par le Voyageur | **Capture du montant total** par la plateforme |
| Entre acceptation et livraison | Fonds détenus par la plateforme |
| Quatre jours après la livraison | Virement du transport au Voyageur, via un compte du prestataire de paiement ouvert à son nom |
| Litige | Versement gelé jusqu'à la décision |

Une conséquence assumée en interne : la capture intervenant dès l'acceptation, **toute
annulation ultérieure est un remboursement**, non une libération d'empreinte.

Le Voyageur dispose d'un compte de paiement dédié, ouvert à son nom chez le prestataire, qui
opère sa vérification d'identité. La plateforme ne détient ni ses coordonnées bancaires ni ses
pièces d'identité.

### 4.3 La rémunération

```
transport        = prix du Voyageur, calculé au kilogramme ou au forfait
commission       = max( 12 % du transport ; 3,00 € )
prime            = 6,00 € si protection étendue choisie, sinon 0
total Expéditeur = transport + commission + prime
net Voyageur     = transport
```

Les frais du prestataire de paiement sont absorbés dans la commission. L'Expéditeur ne voit
que deux lignes, « Transport » et « Service et protection ». Le Voyageur ne voit que son net.

L'empreinte de prix est **immuable** : un changement de tarif ou de paramètre n'a jamais
d'effet rétroactif sur une réservation existante.

### 4.4 L'annulation

Remboursement intégral jusqu'à quarante-huit heures avant le départ. Au-delà, une retenue de
cinquante pour cent s'applique, répartie entre le Voyageur au prorata de sa part nette et la
plateforme pour la part de commission. Une retenue peut être mise en attente d'arbitrage et
tranchée par un opérateur.

Après la prise en charge du colis, aucune annulation n'est possible : le litige est la seule
voie.

### 4.5 La protection du colis

Deux niveaux sont vendus dans le tunnel de réservation : une protection de base incluse, et
une protection étendue à six euros annoncée jusqu'à cinq cents euros.

Il ne s'agit **pas d'une assurance** et une règle interne interdit ce mot tant qu'aucun
contrat n'est signé avec un assureur. Il s'agit d'un engagement commercial de remboursement
plafonné, porté par la plateforme.

**Trois difficultés que nous vous soumettons.** Cet engagement n'est décrit dans **aucun
document contractuel** : ni les conditions générales, ni la politique de confidentialité ne le
mentionnent, alors que le paramètre est marqué en interne comme devant y figurer. Le lien
« Voir les conditions » présenté avant le choix ne mène à **aucun contenu**. Et la règle
d'indemnisation annoncée, plafonnée au plus petit de la valeur déclarée, du plafond souscrit
et de la valeur justifiée, **n'est pas implémentée** : le montant remboursable n'est
aujourd'hui borné que par le total payé.

Une démarche est engagée en parallèle auprès de courtiers et d'assureurs, avec un dossier
dédié. Nous aurons besoin de votre avis sur le statut de distribution et sur l'information
précontractuelle.

### 4.6 Le statut du Voyageur

**Nous n'avons rien prévu, et c'est une lacune que nous assumons.** Aucune distinction entre
particulier et professionnel n'existe dans le produit. Aucun seuil, aucune déclaration, aucune
attestation annuelle, aucune facture, aucun traitement de la taxe sur la valeur ajoutée.

Un Voyageur peut aujourd'hui, sans obstacle technique, transporter des colis de manière
répétée et en tirer un revenu régulier. Nous ignorons à partir de quel moment cette activité
change de nature, quelles obligations déclaratives pèsent alors sur lui et lesquelles pèsent
sur la plateforme. C'est l'une des questions les plus importantes de ce dossier.

---

## 5. L'état des documents contractuels

C'est la partie la plus critique. Nous la présentons sans atténuation.

### 5.1 Ce qui existe

| Document | État |
|---|---|
| Conditions générales d'utilisation, français et anglais | **Brouillon portant en tête la mention « version bêta, document non validé juridiquement, à valider par un avocat avant mise en production »** |
| Politique de confidentialité, français et anglais | **Même mention, à valider par un avocat spécialisé ou un délégué à la protection des données** |

Ces deux documents sont versionnés et la version acceptée est enregistrée avec chaque
consentement. Un point à corriger : le bandeau d'avertissement affiché autour du document est
masqué en production, mais **la mention d'avertissement figure dans le texte lui-même** et
serait donc affichée aux utilisateurs.

Aucun mécanisme de **ré-acceptation** n'existe en cas de nouvelle version.

### 5.2 Ce qui n'existe pas

| Document | Référencé dans le produit | État |
|---|---|---|
| Mentions légales | Lien en pied de page | **Inexistant** |
| Politique de cookies | Renvoi depuis la politique de confidentialité | **Inexistant** |
| Conditions générales de vente | **Case d'acceptation obligatoire à la réservation** | **Inexistant** |
| Contrat de transport | **Case d'acceptation obligatoire à la réservation** | **Inexistant** |
| Charte Expéditeur complète | Lien « voir la charte complète et les produits interdits » | **Inexistant** |
| Charte Voyageur complète | Lien annoncé, non branché | **Inexistant** |
| Registre des traitements | Prévu par nos règles internes | **Inexistant** |
| Politique de conformité des colis | Prévue par nos décisions internes | **Inexistant** |

### 5.3 La conséquence, énoncée clairement

À l'étape trois du tunnel de réservation, l'Expéditeur coche une case unique valant acceptation
de **la charte Expéditeur, des conditions générales de vente et du contrat de transport**.
Aucun de ces trois documents n'existe. Le même schéma se répète côté Voyageur au moment
d'accepter un colis.

Autrement dit, **nous recueillons aujourd'hui un consentement à des documents inexistants**.
C'est la première chose à corriger, et c'est bloquant.

Ce que le produit affiche réellement à l'utilisateur, à défaut de ces documents, ce sont des
engagements sur l'honneur résumés à l'écran, décrits en partie 8.

---

## 6. Les données personnelles

### 6.1 Ce qui est collecté

**Sur le membre** : prénom, nom, adresse électronique, mot de passe chiffré, téléphone, genre,
date de naissance facultative, langue, identifiant public, photo de profil, adresses postales
avec coordonnées géographiques.

**Sur son activité** : trajets, réservations, empreintes de prix, descriptions et photos de
colis, valeur déclarée, avis, favoris, abonnements à d'autres membres, notifications.

**Sur son comportement** : notes moyennes, nombre de livraisons, annulations tardives, litiges
perdus, signalements reçus. Ces compteurs sont marqués internes et ne sont jamais publics.

**Sur sa réputation et ses sanctions** : statut du compte, motif et durée de suspension,
identifiant de l'opérateur ayant décidé.

**Documents justificatifs** : justificatifs de trajet et **pièces d'identité**, avec nom du
fichier, type, taille, statut de vérification et identifiant de l'opérateur qui a examiné.

**Consentements** : type, version du texte, date, **adresse réseau, agent du navigateur**,
langue, date de révocation.

**Communications** : corps des messages, photos, drapeau de détection de coordonnées, lieux et
horaires de rendez-vous, traces de révélation d'un numéro de téléphone.

**Journal d'audit des opérateurs** : auteur, action, cible, état avant et après, adresse
réseau, agent du navigateur.

**Sur le tiers destinataire, qui n'a pas de compte** : prénom, nom, téléphone, adresse
électronique facultative, lieu de remise.

### 6.2 Les durées de conservation

Ce qui est **défini et appliqué automatiquement** :

| Donnée | Durée |
|---|---|
| Coordonnées du tiers destinataire | 30 jours après la fin du dossier, puis effacement automatique |
| Conversations et rendez-vous | 1 an après la fin du dossier |
| Notifications | 1 an |
| Traces de délivrabilité des emails, jamais le contenu | 1 an |
| Événements techniques consommés | 90 jours |
| Événements techniques publiés | 90 jours, un événement jamais publié n'est jamais supprimé |

Ce qui n'a **aucune durée définie**, et croît donc sans limite :

le journal d'audit des opérateurs, les consentements, les réservations, les litiges, les avis,
les signalements, le registre des demandes d'exercice de droits, les comptes effacés, les
justificatifs d'identité en dehors d'une suppression de compte.

Nos règles internes prévoient une politique de conservation par type de donnée. **Ce document
n'a jamais été écrit.** Nous vous demandons de le rédiger, en distinguant ce qui relève de la
valeur probatoire, de l'obligation comptable et de la simple commodité.

### 6.3 Le droit d'accès et la portabilité

Un membre exporte ses données lui-même, au format structuré, après avoir rouvert une fenêtre
d'authentification renforcée par code envoyé par courrier électronique. Un export par
vingt-quatre heures. Chaque export est inscrit dans un registre.

L'export contient le profil, les préférences, les adresses, les consentements, le profil
Voyageur, les trajets, les réservations, les avis donnés et reçus, les messages, les
rendez-vous, les révélations de numéro, les itinéraires enregistrés, les favoris, les
abonnements, les notifications, les signalements émis et les demandes d'exercice de droits.

Trois exclusions volontaires : **l'identité de l'autre partie** à un dossier, **le code de
remise**, et **les signalements dont le membre est la cible**. Les avis reçus ne sont exportés
qu'une fois rendus publics.

### 6.4 Le droit à l'effacement

L'effacement est **une transaction unique** qui anonymise le compte champ par champ plutôt que
de le supprimer.

Ce qui est **anonymisé** : le prénom devient « Membre », le nom « supprimé », l'adresse
électronique devient une adresse technique unique non délivrable, l'identifiant public devient
un identifiant neutre. Le mot de passe, le téléphone, le genre et la date de naissance sont
effacés. Les rôles, les secrets d'authentification forte et les motifs de sanction sont
supprimés. Le compte est marqué supprimé et daté.

Ce qui est **supprimé** : adresses, photo de profil, identités de connexion externe,
abonnements, itinéraires enregistrés, favoris, notifications, justificatifs de trajet.

Ce qui est **conservé mais dépouillé** : les consentements, dont l'adresse réseau et l'agent
du navigateur sont effacés, la preuve du consentement demeurant.

Ce qui est **conservé tel quel** : réservations, litiges, avis, messages, rendez-vous,
signalements, journal d'audit, trajets.

Ce qui est **déplacé** : l'identifiant du compte de paiement est transféré dans un registre
séparé qui ne contient jamais de nom, d'adresse électronique ni de téléphone, au motif des
obligations comptables et des litiges de paiement.

**L'effacement est refusé**, avec un motif explicite, dans six situations : dossier en cours,
demande en attente, versement non exécuté, retenue en attente d'arbitrage, trajet publié,
compte portant un rôle d'opérateur. Chaque refus est inscrit au registre.

Après la transaction, les jetons de session sont révoqués, les fichiers hébergés sont
supprimés et un courrier de confirmation est envoyé à l'ancienne adresse.

**Nous vous demandons de valider cet équilibre** entre le droit à l'effacement et la
conservation des dossiers pour la preuve, la comptabilité et les litiges, ainsi que la liste
fermée des motifs de refus.

### 6.5 Le tiers destinataire

C'est le point de conformité le plus délicat du produit.

Le destinataire **n'a pas de compte** et ne consent à rien. Ses données sont fournies par
l'Expéditeur. Elles sont effacées automatiquement trente jours après la fin du dossier, le
snapshot étant remplacé par des valeurs neutres et le lien public de suivi cessant de
fonctionner.

Il est informé **uniquement s'il ouvre le lien de suivi que l'Expéditeur lui a transmis**.
Cette page lui indique que ses coordonnées ont été confiées pour cette livraison et qu'elles
seront effacées après la remise, et renvoie à la politique de confidentialité. **Aucun envoi
automatique ne l'informe**, faute de canal de message court.

Nous vous demandons : quelle base légale, quelle information, et cette information est-elle
suffisante lorsqu'elle dépend d'un geste de l'Expéditeur ?

### 6.6 La mesure d'audience et les cookies

La mesure d'audience repose sur un opt-in strict. La bannière propose deux boutons de même
poids, accepter et refuser. Le choix est conservé cent quatre-vingts jours, enregistré sur le
compte et inscrit dans le registre des consentements avec possibilité de révocation.

L'outil de mesure n'est **chargé qu'après acceptation**. Sa configuration désactive la capture
automatique, l'enregistrement de session, et respecte le signal de refus de suivi du
navigateur. L'hébergement est en Union européenne.

Côté serveur, seule une **liste blanche de propriétés** est transmise : identifiants
techniques, catégorie, poids, montants, statut. Ni nom, ni adresse électronique, ni téléphone,
ni adresse, ni photo, ni code de remise ne peuvent y figurer, par construction.

Les cookies strictement applicatifs sont un jeton d'accès de quinze minutes et un jeton de
renouvellement, de session ou de trente jours si le membre a demandé à rester connecté.

**Aucune politique de cookies n'existe.** Le renvoi depuis la politique de confidentialité
pointe vers une page absente.

---

## 7. Les sous-traitants et les transferts

Onze prestataires interviennent dans le traitement.

| Prestataire | Finalité | Données concernées |
|---|---|---|
| Base de données infogérée | Stockage de l'ensemble des données | Toutes |
| Prestataire de paiement | Paiement, séquestre, vérification d'identité des Voyageurs, versements | Identité, coordonnées bancaires, transactions |
| Service d'envoi de courriers électroniques | Courriers transactionnels et suivi de délivrabilité | Adresse électronique, contenu du courrier |
| Service d'hébergement d'images | Photos de colis, de prise en charge, de remise, avatars, **justificatifs d'identité** | Images, dont pièces d'identité |
| Service de cartographie | Autocomplétion de villes et d'adresses | Saisies d'adresse |
| Service d'identité tiers | Connexion par compte externe | Adresse électronique, identifiant, profil |
| Mesure d'audience | Statistiques d'usage | Identifiants techniques, événements |
| Supervision des erreurs | Diagnostic des incidents | Traces techniques, identifiants |
| Bus d'événements | Communication interne entre services | Événements applicatifs |
| Cache et sessions | Sessions, verrous, compteurs | Jetons, compteurs |
| Supervision de disponibilité | Surveillance externe | Aucune donnée de membre |

**Ce qui manque, et que nous vous demandons.** Il n'existe **aucun registre de sous-traitants**,
**aucun contrat de sous-traitance identifié**, et **aucune analyse des transferts hors Union
européenne**. La politique de confidentialité ne cite que deux de ces onze prestataires et
affirme l'existence de garanties contractuelles sans qu'aucun document ne les soutienne.

Deux points appellent une attention particulière. L'hébergement des images reçoit des
**pièces d'identité**, ce qui en fait le traitement le plus sensible du dispositif. Et
l'hébergement de la base de données n'a pas de localisation documentée.

---

## 8. Conformité du transport et objets interdits

### 8.1 La liste

Nos règles internes, fondées sur la réglementation du transport aérien et les règles
douanières, interdisent : stupéfiants et substances contrôlées, armes et munitions, batteries
au lithium hors équipement, liquides et aérosols au-delà des règles de cabine, espèces et
instruments monétaires, médicaments hors prescription personnelle, denrées périssables,
contrefaçons. Le brouillon de conditions générales y ajoute les animaux vivants, les matières
dangereuses et les objets volés.

### 8.2 Ce qui est réellement mis en œuvre

**La liste est déclarative, pas bloquante.** Nos règles prévoient un filtrage automatique du
formulaire ; il n'est pas construit. Ce qui existe réellement est le suivant.

**Côté Expéditeur**, une charte affichée à l'écran, avec trois engagements sur l'honneur :
aucun produit illicite, dangereux ou interdit ; conformité exacte à la catégorie, au poids et
au contenu déclarés ; respect des obligations douanières du pays de destination. Elle est
suivie d'une clause selon laquelle toute déclaration mensongère engage sa seule responsabilité
civile et pénale, à l'exclusion de celle du Voyageur et de la plateforme.

**Côté Voyageur**, une charte à six engagements : vérifier visuellement, refuser tout colis
non conforme ou suspect, transporter avec diligence, remettre uniquement au destinataire après
vérification du code, respecter les obligations douanières, signaler tout incident. Elle est
suivie d'une clause selon laquelle sa seule responsabilité serait engagée en cas de transport
d'un produit illicite, **y compris en l'absence de vérification préalable**.

**Nous vous demandons expressément de vous prononcer sur ces deux clauses.** Elles font peser
la totalité du risque pénal sur des particuliers, et nous ignorons si elles sont opposables,
utiles, ou au contraire contre-productives.

**À la prise en charge**, une procédure bloquante : le colis n'est pas scellé avant la
rencontre, il est présenté ouvert, le Voyageur remplit une liste de contrôle en cinq points
dont « aucun produit interdit n'est présent », au moins une photo est obligatoire, et le colis
est scellé devant lui. Sans liste complète et sans photo, le système refuse d'enregistrer la
prise en charge. Le Voyageur dispose d'un droit de refus inconditionnel, sans pénalité, avec
remboursement intégral de l'Expéditeur.

### 8.3 La douane

**Aucune déclaration douanière n'est produite par la plateforme.** Il n'existe ni formulaire,
ni document, ni champ dédié. Seules la valeur déclarée et la catégorie du colis sont saisies.

Nous vous demandons qui est déclarant, quelle information doit être fournie au Voyageur avant
son départ, et si la plateforme engage sa responsabilité en s'abstenant.

### 8.4 Les transporteurs aériens

**Aucune mention contractuelle n'existe** sur les conditions de transport des compagnies
aériennes. Nous savons que le fait de porter le bagage ou le colis d'un tiers est
généralement encadré, voire prohibé, par les conditions générales des transporteurs et par les
questions de sûreté posées à l'enregistrement.

Nous vous demandons quelle est l'exposition réelle de la plateforme et du Voyageur sur ce
point, et quelle information doit figurer dans nos documents.

---

## 9. Modération, signalements, sanctions

### 9.1 Les signalements

Tout membre peut signaler un trajet, un profil, une réservation ou un message. Les motifs sont
fermés : contenu illicite, escroquerie, contenu inapproprié, usurpation d'identité, autre.
Pour un message, des motifs spécifiques s'appliquent, dont la sortie de plateforme et le
harcèlement. Un commentaire libre de cinq cents caractères au plus est possible.

Un signalement est traité par un opérateur, avec deux issues, examiné ou écarté, une note
interne, et l'écriture du journal dans la même transaction. Un dossier déjà traité ne peut pas
l'être deux fois.

**Un signalement ne suspend rien automatiquement.** Cette règle est écrite et respectée. Seuls
des seuils déclenchent une revue prioritaire, à partir de trois signalements ouverts sur la
même cible ou d'un niveau de risque élevé. **L'identité de l'auteur d'un signalement n'est
jamais révélée à la cible**, y compris dans un export de données.

### 9.2 Les sanctions

Deux niveaux, avec une procédure à deux mains : un opérateur propose, un autre exécute. Le
motif fait au moins vingt caractères et est journalisé.

**Restriction** : le membre ne peut plus publier de trajet ni réserver. Ses dossiers en cours
se poursuivent et il peut se connecter.

**Suspension** : toute route authentifiée est refusée, toutes les sessions sont révoquées, et
ses trajets sont retirés des résultats de recherche. Un courrier l'informe, un autre informe
le support en listant ses dossiers en cours.

La levée d'une sanction remet le compte en état actif et efface les champs correspondants,
avec journalisation.

### 9.3 Le score de confiance et l'absence de décision automatisée

Un score interne, **invisible du membre**, **calculé à la lecture et jamais stocké**, agrège
des signaux pondérés : litiges perdus, annulations tardives, signalements reçus et confirmés,
vitesse d'activité anormale sur un compte récent, ancienneté. Les livraisons réussies et les
bonnes notes le font baisser.

Ses seuls effets automatiques sont des **plafonds** appliqués aux comptes récents ou à risque :
trois cents euros de valeur déclarée, dix kilogrammes, cinq envois par mois. Il sert par
ailleurs à prioriser la file de revue.

Une règle interne, écrite avant le code, pose qu'**aucune sanction n'est automatique** : un
opérateur décide et son geste est journalisé. Nous avons construit ce garde-fou en pensant à
l'encadrement des décisions automatisées. **Nous vous demandons de vérifier que le
raisonnement tient**, en particulier pour les plafonds, qui sont eux appliqués sans
intervention humaine.

---

## 10. La messagerie

### 10.1 Les garde-fous

**Le code de remise est refusé.** Le service extrait les groupes de six chiffres isolés d'un
message et les compare à l'empreinte du code du dossier. En cas de correspondance, le message
est **rejeté** avec un message explicite invitant à donner le code de vive voix.

**Les coordonnées sont détectées mais non bloquées.** Les adresses électroniques et les suites
de chiffres ressemblant à un numéro sont repérées et le message est marqué. Le choix de ne pas
bloquer est motivé en interne : bloquer casserait des usages légitimes et se contournerait
trivialement.

**Le numéro de téléphone se révèle tard.** Il n'est accessible qu'à partir de deux heures avant
le rendez-vous de remise accepté, ou à défaut avant le départ du trajet. Chaque révélation est
tracée nominativement.

### 10.2 La conservation

Les fils sont purgés un an après la fin d'un dossier terminé. **Un dossier vivant ou en litige
n'est jamais purgé**, quel que soit son âge, parce que la médiation a besoin du fil. La purge
supprime les messages, les rendez-vous et les traces de révélation. Les signalements
subsistent en tant que dossiers de modération, privés de leur contenu.

L'écriture dans un fil reste ouverte quatorze jours après la fin du dossier, puis le fil passe
en lecture seule.

### 10.3 La lecture par un opérateur

Un opérateur du support ou de la médiation peut lire un fil entier depuis un dossier. Cette
lecture est **un geste volontaire et journalisé**, avec le nombre de messages consultés,
l'adresse réseau et l'agent du navigateur. Le profil finance n'y a pas accès. Le numéro de
téléphone n'est jamais affiché, seulement l'information de qui l'a consulté et quand.

**Nous vous demandons de valider cette lecture et son encadrement**, ainsi que l'information
qui doit en être donnée aux membres, aujourd'hui absente des documents contractuels.

---

## 11. Sécurité et traçabilité

### 11.1 L'authentification

Jetons en cookies inaccessibles au script, jeton d'accès de quinze minutes, jeton de
renouvellement révocable, rotation à chaque usage. Vérification de l'adresse électronique par
code à six chiffres avec paliers anti-force brute. Connexion par compte externe possible, avec
vérification du jeton côté serveur.

Une **fenêtre d'authentification renforcée** de quinze minutes, ouverte par code envoyé par
courrier électronique, est exigée pour les gestes sensibles : changement de mot de passe ou
d'adresse, accès au compte de paiement, export de données, effacement du compte.

Les sessions sont listées par le membre, avec appareil, adresse réseau et navigateur, et
révocables une par une.

**Les opérateurs relèvent d'un dispositif entièrement séparé** : cookies distincts, session de
douze heures, inactivité de quarante-cinq minutes, et **double authentification obligatoire**.
Un compte sans double authentification active ne peut pas ouvrir de session d'administration.

### 11.2 Le chiffrement

Le **code de remise** est stocké sous deux formes : une empreinte irréversible pour la
validation et un chiffrement réversible pour le seul réaffichage à l'Expéditeur pendant le
transport. Le code en clair n'est jamais en base, ne circule dans aucun courrier, aucun
message, aucun événement technique, aucun export.

Le **secret de la double authentification** des opérateurs est chiffré, avec comparaison à
temps constant, protection contre le rejeu, et codes de secours stockés sous forme d'empreinte.

Les mots de passe sont chiffrés de manière irréversible.

### 11.3 Le journal d'audit

Cinquante-neuf actions d'opérateur sont journalisées, dont la connexion, la consultation d'un
dossier, la lecture d'un fil de messagerie, la consultation d'un justificatif, la décision de
litige, la suspension d'un compte, le remboursement manuel, l'effacement d'un compte, la
modification d'un paramètre et tout export.

Chaque ligne porte l'auteur, l'action, la cible, l'état avant et après, l'adresse réseau et
l'agent du navigateur.

La doctrine interne est explicite : le journal est écrit **dans la même transaction que le
geste**, jamais après coup, jamais au mieux. Un geste dont le journal échoue n'a pas eu lieu.

**Une limite que nous signalons** : l'immuabilité est une propriété du code, non une contrainte
de la base. Aucune modification ni suppression n'est possible depuis l'application, mais rien
n'empêche techniquement une intervention directe en base. Il n'existe ni horodatage par un
tiers, ni chaînage cryptographique. Si un niveau de preuve supérieur est requis, dites-le nous.

### 11.4 Les profils d'opérateur

Six profils avec des permissions distinctes : administrateur général, médiateur, support,
finance, exploitation, **et un profil dédié à la protection des données**. Ce dernier détient
seul, avec l'administrateur général, le droit d'accéder au registre des demandes, d'effacer un
compte et d'exporter des données nominatives.

Trois permissions sont réservées à l'administrateur général : la gestion des opérateurs,
l'application d'un remboursement manuel, et la modification des paramètres contractuels. Les
gestes les plus lourds sont construits en deux temps, un opérateur propose, un autre applique.

Les exports nominatifs exigent un motif d'au moins vingt caractères et sont journalisés. Les
exports opérationnels ne contiennent que des identifiants, jamais d'adresse électronique ni de
téléphone.

---

## 12. Mineurs et âge minimum

**Il n'existe aucune vérification d'âge à l'inscription.** Le formulaire ne demande pas de date
de naissance. Celle-ci est facultative et ne peut être renseignée que plus tard, dans le
profil.

Lorsqu'elle l'est, la règle appliquée par le code est de **seize ans**.

Le brouillon de conditions générales exige quant à lui d'être **majeur**.

Nous avons donc trois régimes contradictoires : aucun contrôle à l'entrée, seize ans en
option, dix-huit ans annoncés. C'est une non-conformité claire, que nous ne savons pas
corriger seuls : nous ignorons quel âge minimum retenir, quel niveau de vérification est exigé,
et quelle est la responsabilité de la plateforme si un mineur transporte ou expédie un colis.

---

## 13. Web, back-office et mobile

### 13.1 L'application web des membres

Interface des Expéditeurs et des Voyageurs, en français et en anglais. **Aucune limite n'est
décidée par l'interface** : le serveur est seul juge et l'interface ne fait que refléter les
actions qu'il déclare autorisées. Une manipulation du navigateur ne contourne aucun contrôle.

### 13.2 Le back-office

Interface séparée, réservée aux opérateurs, avec authentification distincte et double
authentification obligatoire. Elle donne accès aux litiges, aux signalements, aux dossiers
financiers, aux comptes et sanctions, aux paramètres, au registre des demandes d'exercice de
droits et au journal d'audit.

Les paramètres marqués comme contractuels, dont la commission, les plafonds de protection et
les règles d'annulation, sont modifiables en ligne, avec motif obligatoire, journalisation et
notification. **Ils ne sont jamais rétroactifs** : une réservation existante conserve les
conditions en vigueur au moment où elle a été conclue.

Nous attirons votre attention sur ce mécanisme : il signifie que des conditions contractuelles
peuvent évoluer sans nouvelle rédaction, ce qui suppose que les documents que vous rédigerez
renvoient correctement à ces paramètres plutôt que d'en figer les valeurs.

### 13.3 Le mobile

**Aucun code mobile n'existe.** Le chantier est planifié : construire pour les deux systèmes
dès le socle, publier Android en premier.

Quatre conséquences juridiques sont déjà identifiées.

**Une entité juridique est indispensable.** Un compte développeur d'organisation exige une
société enregistrée et un identifiant d'entreprise. Publier sous le nom d'une personne
physique tierce créerait une incohérence entre le vendeur affiché et l'entité qui encaisse.

**Une seconde méthode de connexion deviendra obligatoire** sur le magasin d'applications
d'Apple dès lors qu'une connexion par compte externe existe.

**La commission d'achat intégré ne s'applique pas**, la plateforme vendant un service du monde
réel. La contrepartie inscrite dans nos décisions est de ne jamais vendre d'option numérique
dans l'application.

**Un manifeste de confidentialité sera exigé**, déclarant ce que la mesure d'audience collecte.

Les applications consommeront la **même interface de programmation** que le site, donc les
contrôles et les traitements décrits dans ce dossier s'y appliqueront à l'identique, sans
divergence possible.

---

## 14. Les non-conformités que nous avons identifiées

Classées par gravité. Nous les remettons telles quelles.

### Bloquantes avant toute ouverture

| # | Point | Nature |
|---|---|---|
| 1 | Conditions générales de vente, contrat de transport et chartes complètes inexistants, alors qu'une case d'acceptation obligatoire les vise | Consentement à des documents inexistants |
| 2 | Conditions générales et politique de confidentialité à l'état de brouillon non validé | Corpus contractuel non opposable |
| 3 | Mentions légales inexistantes | Obligation d'identification de l'éditeur |
| 4 | Entité juridique non immatriculée | Encaissement, contrats, comptes développeur |
| 5 | Politique de cookies inexistante, alors qu'elle est référencée | Information sur les traceurs |
| 6 | Aucune vérification d'âge, seize ans en option contre dix-huit annoncés | Contradiction et absence de contrôle |
| 7 | La protection du colis est vendue sans qu'aucun document n'en décrive les conditions ni les exclusions | Vente d'un engagement non documenté |

### Importantes, à traiter avant ou juste après l'ouverture

| # | Point | Nature |
|---|---|---|
| 8 | Aucun registre des traitements | Obligation de documentation |
| 9 | Aucun registre de sous-traitants, aucun contrat identifié, aucune analyse de transfert | Encadrement de la sous-traitance |
| 10 | La politique de confidentialité ne cite que deux prestataires sur onze | Information incomplète |
| 11 | Durées de conservation non définies pour le journal d'audit, les consentements, les dossiers, les avis, les signalements, les justificatifs | Conservation sans limite |
| 12 | Statut fiscal et social des Voyageurs entièrement absent | Qualification, obligations déclaratives |
| 13 | Aucune déclaration douanière, aucune information sur les règles des transporteurs aériens | Exposition du Voyageur et de la plateforme |
| 14 | Le tiers destinataire n'est informé que s'il ouvre un lien transmis par l'Expéditeur | Information des personnes |
| 15 | Aucun mécanisme de ré-acceptation lors d'un changement de version | Opposabilité des évolutions |
| 16 | La mention d'avertissement « document non validé » figure dans le texte publié | Affichage en production |

### À surveiller

| # | Point | Nature |
|---|---|---|
| 17 | La liste des objets interdits est déclarative, non bloquante | Écart entre la règle écrite et le produit |
| 18 | Vérification d'identité de l'Expéditeur prévue mais non construite | Écart entre la règle écrite et le produit |
| 19 | Aucune vérification du numéro de téléphone | Fiabilité du contact et du destinataire |
| 20 | Immuabilité du journal d'audit garantie par le code, pas par la base | Niveau de preuve |
| 21 | Photos accessibles par leur adresse et non supprimables lors d'un effacement | Effacement incomplet |
| 22 | Adresses de contact incohérentes entre les textes et le produit | Cohérence formelle |

---

## 15. Les questions posées

### Qualification

1. Quelle est la qualification exacte de l'activité ? La position d'intermédiaire technique
   tient-elle, compte tenu de la maîtrise du prix, de la détention des fonds, de la procédure
   imposée et du pouvoir de trancher les litiges ?
2. La plateforme devient-elle partie au contrat de transport ?
3. Le Voyageur est-il un particulier occasionnel ? À partir de quel seuil son activité
   change-t-elle de nature, et quelles obligations en découlent pour lui et pour la plateforme ?
4. Quelles obligations d'information et de déclaration pèsent sur un opérateur de plateforme
   au titre des revenus versés à ses membres ?
5. Encaisser pour le compte de tiers et détenir des fonds entre l'acceptation et le versement
   suppose-t-il un statut réglementé, ou la relation avec le prestataire de paiement suffit-elle ?

### Corpus contractuel

6. Quels documents devons-nous produire, et dans quel ordre de priorité ?
7. Comment articuler charte, conditions générales d'utilisation, conditions de vente et contrat
   de transport, sachant qu'ils sont aujourd'hui acceptés par une case unique ?
8. Une clause limitative de responsabilité est-elle opposable à un consommateur dans ce
   contexte ? Les deux clauses de report intégral du risque pénal sur les particuliers sont-elles
   valables et opportunes ?
9. Le droit de rétractation s'applique-t-il, et sous quelle forme ?
10. Sommes-nous tenus d'adhérer à un dispositif de médiation de la consommation ?
11. Le service étant mondial, quelle loi applicable et quelle juridiction retenir ? Faut-il
    restreindre les corridors ouverts, et selon quel critère ?

### Données personnelles

12. Quelle base légale pour chacun des traitements, en particulier pour le tiers destinataire
    qui ne consent à rien ?
13. Quelles durées de conservation retenir pour le journal d'audit, les consentements, les
    dossiers, les avis, les signalements et les justificatifs d'identité ?
14. L'équilibre retenu pour l'effacement, anonymisation du compte et conservation des dossiers,
    est-il défendable ? La liste fermée des motifs de refus est-elle correcte ?
15. Les plafonds appliqués automatiquement aux comptes récents ou à risque constituent-ils une
    décision automatisée au sens de la réglementation ?
16. La lecture d'un fil de messagerie privée par un opérateur est-elle licite, et sous quelles
    conditions d'information ?
17. Faut-il conduire une analyse d'impact, compte tenu du traitement de pièces d'identité et
    du score de confiance ?
18. Quels contrats de sous-traitance devons-nous obtenir en priorité, et comment traiter les
    transferts hors Union européenne ?

### Risque métier

19. Quelle diligence est attendue de la plateforme sur les objets interdits ? La liste doit-elle
    devenir bloquante, et cela change-t-il notre exposition ?
20. Quelle est la responsabilité de la plateforme si un colis illicite est transporté ?
21. Qui est déclarant en douane, et quelle information devons-nous fournir au Voyageur ?
22. Quelle est notre exposition au regard des conditions de transport des compagnies aériennes ?
23. Quel âge minimum retenir, et quel niveau de vérification exiger ?
24. Sous quel statut pouvons-nous distribuer une garantie d'assurance, et quelle information
    précontractuelle devons-nous remettre ?

---

## 16. Livrables attendus

Par ordre de priorité.

| # | Livrable | Priorité |
|---|---|---|
| 1 | Note de qualification de l'activité et de ses conséquences | Immédiate |
| 2 | Conditions générales d'utilisation | Bloquante |
| 3 | Conditions générales de vente | Bloquante |
| 4 | Contrat de transport entre Expéditeur et Voyageur | Bloquante |
| 5 | Charte Expéditeur et charte Voyageur, avec la liste des objets interdits | Bloquante |
| 6 | Mentions légales | Bloquante |
| 7 | Politique de confidentialité | Bloquante |
| 8 | Politique de cookies | Bloquante |
| 9 | Registre des traitements | Haute |
| 10 | Politique de conservation par type de donnée | Haute |
| 11 | Modèle de contrat de sous-traitance et analyse des transferts | Haute |
| 12 | Note sur le statut des Voyageurs et les obligations déclaratives | Haute |
| 13 | Note sur la douane et les transporteurs aériens | Moyenne |
| 14 | Avis sur la distribution d'assurance et l'information précontractuelle | Moyenne |
| 15 | Analyse d'impact, si vous la jugez nécessaire | À déterminer |

Les documents suivants sont disponibles sur demande et vous seront remis pour établir votre
devis : documentation métier et fonctionnelle complète, documentation du back-office,
documentation technique de bout en bout, cahiers de recette, brouillons actuels des conditions
générales et de la politique de confidentialité, dossier remis en parallèle aux assureurs.
