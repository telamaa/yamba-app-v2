# Stratégie de financement et de lancement

> Document de travail, septembre 2026. Il consigne l'analyse et les recommandations
> échangées avant l'ouverture du chantier mobile. Ce n'est ni un conseil juridique,
> ni un conseil financier réglementé : les points marqués **[À FAIRE VALIDER]**
> exigent un professionnel (avocat, expert-comptable, courtier).

---

## 1. Le point de départ

Yamba est une place de marché à deux versants. D'un côté des **Expéditeurs** qui veulent
envoyer un colis. De l'autre des **Voyageurs** qui ont déjà un trajet prévu et acceptent
d'emporter ce colis contre rémunération. La plateforme met en relation, séquestre le
paiement, encadre la remise par un code de livraison, arbitre les litiges et reverse
le Voyageur après livraison.

**Le produit est mondial par conception.** Rien dans la plateforme ne restreint les
corridors : n'importe quel départ, n'importe quelle destination, dès qu'un Voyageur publie
un trajet. Le choix d'un corridor de démarrage, développé plus loin, est une décision
commerciale de mise en marché, pas une limite du produit.

Au moment où ce document est écrit, le produit est construit et le corridor n'est pas
encore ouvert. C'est exactement la situation qui rend la question du financement
piégeuse, et c'est pour cela qu'elle mérite d'être posée dans le bon ordre.

### Ce qui est fait

| Élément | État |
|---|---|
| Plateforme web membres et back-office administrateur | Livrés |
| Six services applicatifs, paiement séquestré, médiation des litiges | Livrés |
| Conformité RGPD outillée : export, effacement, conservation, consentement | Livrée |
| Documentation de transmission, six livrables | Livrée |
| Cahiers de recette de bout en bout, quatre documents | Livrés |
| Applications mobiles | Non commencées, préparation documentée |

### Ce qui n'est pas fait

| Élément | Conséquence |
|---|---|
| Recette globale non terminée | On ne sait pas encore ce qui casse en conditions réelles |
| Sauvegardes de la base non vérifiées | Un incident de données serait irréversible |
| Entité juridique non créée | Impossible d'encaisser une commission |
| Assurance non contractée | Le risque de perte repose sur le fondateur |
| Conditions générales non rédigées | Aucun cadre contractuel opposable |
| Premier corridor non amorcé | Zéro transaction, donc zéro preuve de marché |

---

## 2. La thèse centrale

**Une place de marché ne meurt pas par manque d'argent. Elle meurt par manque de liquidité.**

Le premier Expéditeur qui arrive sur un corridor vide ne trouve aucun Voyageur, s'en va,
et ne revient pas. Aucun montant levé ne répare cela. À l'inverse, un corridor où l'offre
et la demande se rencontrent en moins de vingt-quatre heures se finance presque tout seul,
parce qu'il produit des transactions, donc de la commission, donc des chiffres.

Il en découle une conséquence directe. **Le travail des prochains mois n'est pas de lever
des fonds, c'est de produire les trente premières livraisons réussies sur un seul corridor.**
Le financement viendra ensuite, et il viendra mieux.

Deuxième conséquence, moins agréable. Ce qui a été construit ces derniers mois, la
plateforme, représente la partie du problème qui coûte cher chez les concurrents mais qui
n'est pas la partie difficile. La partie difficile commence maintenant.

---

## 3. Ce qu'il faut réellement financer

Le besoin de trésorerie pour ouvrir est faible. Il tient en une page.

| Poste | Ordre de grandeur | Nature |
|---|---|---|
| Immatriculation de la société | 200 à 500 € | Une fois |
| Compte développeur Apple | 99 € / an | Récurrent |
| Compte développeur Google Play | 25 € | Une fois |
| Hébergement, base de données, envoi d'emails, mesure d'audience | 50 à 150 € / mois | Récurrent |
| Nom de domaine et certificats | ~20 € / an | Récurrent |
| Consultation juridique sérieuse et rédaction des conditions générales | 1 000 à 3 000 € | Une fois **[À FAIRE VALIDER]** |
| Courtage et prime d'assurance | À chiffrer | Récurrent **[À FAIRE VALIDER]** |
| Réserve de garantie, pour indemniser sans assureur au démarrage | 1 000 à 3 000 € | Provision |

On parle de quelques milliers d'euros, pas de centaines de milliers. Le vrai coût caché
n'est pas dans ce tableau : c'est le **temps du fondateur**, et donc son revenu.

C'est là que se situe la seule vraie question de financement à court terme. Il ne s'agit
pas de financer l'entreprise, il s'agit de financer la personne qui la construit, assez
longtemps pour atteindre la liquidité du premier corridor.

---

## 4. Les trois verrous à lever avant d'encaisser un euro

Ces trois points ne sont pas des formalités administratives. Ce sont des conditions
d'existence, et deux d'entre eux sont des risques qui peuvent détruire l'entreprise.

### 4.1 L'entité juridique

Sans société, il n'y a ni encaissement de commission, ni compte Stripe de place de marché,
ni compte développeur Apple ou Google au nom de Yamba, ni contrat opposable avec un membre.

La forme retenue conditionne aussi la suite : une structure qui pourra accueillir des
investisseurs plus tard ne se choisit pas au hasard, et la transformer coûte du temps et
de l'argent. **[À FAIRE VALIDER]** avec un expert-comptable, en lui disant explicitement
que l'entreprise pourrait ouvrir son capital dans deux à trois ans.

Une question annexe déjà identifiée lors de la préparation du chantier mobile : créer
l'entité au nom de **Telama**, une structure qui porterait plusieurs applications, plutôt
qu'au nom du seul produit Yamba. Cela simplifie les comptes développeur et évite d'avoir
à tout recréer pour un deuxième produit.

### 4.2 La responsabilité et l'assurance

C'est le risque numéro un, et il est plus grand que n'importe quel risque technique.

Aujourd'hui, la protection offerte aux Expéditeurs est portée par la plateforme elle-même.
Autrement dit, en cas de perte ou de dommage, **c'est le fondateur qui paie**. Tant que le
volume est de quelques colis par mois, c'est une décision assumable. À cent colis par mois,
ce n'est plus une décision, c'est une exposition qui peut emporter l'entreprise et
potentiellement le patrimoine personnel selon la forme sociale retenue.

Deux chantiers en découlent, traités dans le dossier assurance qui accompagne ce document :
souscrire une responsabilité civile professionnelle, et négocier une couverture des
marchandises transportées, en propre ou adossée à un assureur affinitaire.

### 4.3 La conformité du transport

Un Voyageur franchit une frontière avec des marchandises qu'il n'a ni achetées ni emballées.
Les règles douanières et celles des compagnies aériennes s'appliquent, et l'ignorance ne
protège personne.

La plateforme a déjà des garde-fous : une charte, des familles d'objets refusées, des
catégories déclarées, un code de livraison qui prouve la remise. Est-ce suffisant sur le
plan juridique ? **[À FAIRE VALIDER]**. Il faut un avocat qui connaît le transport et
l'intermédiation, pas un généraliste. C'est l'objet du dossier juridique qui accompagne
ce document.

---

## 5. Le lancement

### 5.1 Ne pas « lancer »

Le mot « lancement » induit en erreur. Il évoque une date, une annonce, un pic de trafic.
Pour une place de marché, c'est le pire scénario : de l'audience qui arrive sur un service
vide, se déçoit une fois, et ne revient jamais. On ne récupère pas une première impression.

Ce qu'il faut, c'est un **démarrage contrôlé sur un seul corridor, dans un seul sens**.
Le produit dessert le monde entier, mais la mise en marché ne peut pas commencer partout à la
fois. Le premier corridor doit être celui où le réseau personnel du fondateur est le plus
dense, parce que la confiance y préexiste. Ce choix est réversible et ne ferme aucune porte :
les corridors suivants s'ouvrent sans développement supplémentaire.

Un corridor unique, c'est aussi ce qui rend le problème soluble. Il faut concentrer la
totalité de l'offre et de la demande au même endroit pour qu'elles se rencontrent. Ouvrir
cinq corridors avec le même nombre d'utilisateurs, c'est garantir que chacun reste vide.

### 5.2 L'offre avant la demande

L'ordre n'est pas symétrique, et se tromper coûte cher.

Un Voyageur qui publie un trajet et ne reçoit aucune demande n'a **rien perdu**. Il allait
voyager de toute façon. Il republiera peut-être au voyage suivant.

Un Expéditeur qui cherche et ne trouve personne a **perdu son temps** sur un besoin réel
et urgent. Il ira ailleurs, et il ne reviendra pas.

Donc : recruter les Voyageurs d'abord. Objectif avant d'ouvrir la demande :

| Cible avant ouverture | Valeur |
|---|---|
| Voyageurs inscrits et vérifiés sur le corridor | 15 à 20 |
| Trajets publiés couvrant les huit prochaines semaines | 10 minimum |
| Délai maximal sans aucun trajet disponible | Jamais plus de 7 jours |

### 5.3 Où trouver les premiers Voyageurs

Pas dans la publicité en ligne. Le produit vend de la confiance entre inconnus ; le moyen
le moins cher de résoudre ce problème est de commencer là où la confiance existe déjà.

- Les groupes de diaspora sur les réseaux sociaux et les messageries.
- Les associations culturelles et régionales.
- Les commerces communautaires, les agences de voyage spécialisées, les lieux de culte.
- Le réseau personnel direct, sans intermédiaire, un appel après l'autre.

Le premier Voyageur doit être quelqu'un que l'on peut appeler par son prénom. Le
centième aussi, si possible.

### 5.4 Faire les choses à la main

Au démarrage, il faut délibérément faire ce qui ne passe pas à l'échelle. Appeler chaque
Voyageur avant son premier trajet. Vérifier chaque premier colis. Résoudre chaque litige
au téléphone avant de le résoudre dans le back-office. Demander à chaque Expéditeur, après
la livraison, ce qui l'a inquiété.

Ce travail manuel n'est pas une étape provisoire à subir. C'est la seule source
d'information fiable sur ce que le produit doit devenir. Les mois passés à construire des
hypothèses vont être confrontés au réel, et une partie sera fausse.

### 5.5 Séquence proposée

| Phase | Contenu | Sortie attendue |
|---|---|---|
| 0. Verrouiller | Recette terminée, sauvegardes vérifiées, entité créée, conditions générales rédigées, assurance engagée | Le service peut légalement encaisser |
| 1. Amorcer l'offre | Recrutement manuel des Voyageurs sur un corridor | 15 Voyageurs, 10 trajets publiés |
| 2. Premières livraisons | Ouverture de la demande au réseau proche uniquement | 10 livraisons réussies, zéro litige non résolu |
| 3. Élargir la demande | Groupes de diaspora, bouche-à-oreille | 30 livraisons, premiers Expéditeurs récurrents |
| 4. Décider | Lire les chiffres, corriger ou pivoter | Un corridor liquide, ou une leçon claire |
| 5. Deuxième corridor | Répliquer la méthode, pas seulement le produit | Preuve que le modèle est reproductible sur n'importe quel corridor |

Le passage de la phase 4 à la phase 5 est le moment où lever des fonds devient une
conversation différente. Avant, on vend une intention. Après, on vend une mécanique.

---

## 6. Le financement, dans l'ordre où je le chercherais

### 6.1 D'abord, ne pas lever

Autofinancer les quelques milliers d'euros nécessaires. C'est l'option qui préserve à la
fois le capital et, surtout, la liberté de se tromper de corridor sans avoir à s'en
justifier devant un investisseur.

Lever aujourd'hui, sans transaction, reviendrait à vendre une part de l'entreprise au prix
le plus bas de toute son existence.

### 6.2 Ensuite, l'argent qui ne dilue pas

En France, il existe des dispositifs d'aide à la création et à l'innovation : subventions,
avances remboursables, prêts d'honneur accordés à la personne et non à la société, et des
dispositifs d'accompagnement du créateur d'entreprise. Les montants sont modestes à
l'échelle d'une levée, mais ils correspondent exactement au besoin réel décrit en partie 3,
et ils ne coûtent aucune part du capital.

Les conditions et les guichets évoluent. **[À FAIRE VALIDER]** auprès d'un réseau
d'accompagnement local, qui connaîtra les dispositifs en vigueur mieux que n'importe quelle
documentation écrite à l'avance.

### 6.3 Puis les incubateurs et accélérateurs

Leur intérêt n'est pas le chèque, qui est souvent symbolique. C'est le réseau, la
crédibilité, l'accès à des mentors, et parfois des crédits d'infrastructure offerts par les
fournisseurs partenaires.

Deux familles à cibler en priorité : celles spécialisées sur la logistique et les places de
marché, et celles spécialisées sur les échanges internationaux et les diasporas. La thèse de
Yamba est à l'intersection des deux, ce qui est un avantage rare dans un dossier de
candidature.

### 6.4 Les investisseurs individuels, une fois les chiffres réels

Un investisseur individuel finance une personne et une traction, pas une idée. Trente
livraisons réelles sur un corridor, avec un taux de litige connu et des Expéditeurs qui
reviennent, valent plus que n'importe quelle présentation.

Le profil à chercher : quelqu'un qui connaît soit la logistique, soit les marchés africains,
soit les places de marché. L'argent d'un investisseur qui ne comprend pas le métier est
l'argent le plus cher du marché.

### 6.5 Les fonds d'amorçage, plus tard encore

Un fonds finance l'accélération d'une machine qui tourne, pas la construction d'une machine.
Tant que le modèle n'est pas prouvé sur un corridor et répliqué sur un deuxième, la
conversation sera frustrante et se soldera par un refus poli.

Il y a aussi une question de calibrage à garder en tête : un fonds a besoin que ses
participations puissent devenir très grandes. Une entreprise rentable à taille humaine sur
trois corridors est un excellent résultat pour un fondateur, et un mauvais dossier pour un
fonds. Ces deux trajectoires ne demandent pas les mêmes décisions, et il vaut mieux savoir
laquelle on vise avant de signer.

### 6.6 Une piste souvent oubliée

Le modèle encaisse le paiement de l'Expéditeur avant de reverser le Voyageur. Autrement dit,
la croissance ne consomme pas de trésorerie, elle en génère temporairement. C'est un
avantage structurel réel par rapport à une entreprise qui doit acheter du stock.

Cela renforce la conclusion générale : ce produit peut croître longtemps sans capitaux
extérieurs, à condition que le corridor soit liquide.

---

## 7. Ce qu'il faut mesurer dès le premier colis

L'outillage existe déjà : la page de pilotage du back-office et la mesure d'audience.
Ce qui manque, c'est de regarder les bons indicateurs.

Ni le nombre d'inscrits, ni le nombre de visites ne disent quoi que ce soit d'utile sur
une place de marché.

| Indicateur | Ce qu'il révèle | Signal d'alerte |
|---|---|---|
| Part des demandes d'envoi acceptées par un Voyageur | La liquidité réelle du corridor | En dessous de la moitié |
| Délai entre la recherche d'un Expéditeur et une demande acceptée | La fluidité vécue | Plus de 72 heures |
| Part des Expéditeurs qui envoient une deuxième fois | Si le produit répond à un besoin récurrent | En dessous de 30 % à trois mois |
| Part des trajets publiés qui reçoivent au moins une demande | Si l'offre est utile ou gaspillée | En dessous de 40 % |
| Commission encaissée par colis livré | Si le modèle tient à petite échelle | En dessous du coût de traitement d'un litige |
| Litiges rapportés au nombre de livraisons | Le risque assurantiel, chiffré | Toute valeur au-dessus de 5 % |
| Colis perdus ou endommagés, et coût réel indemnisé | L'argument central face à l'assureur | À suivre dès le premier colis |

### 7.1 Ce que le back-office affiche réellement aujourd'hui

Un audit du code a été mené pour vérifier lesquels de ces sept indicateurs existent déjà.
Le back-office affiche aujourd'hui **dix-huit tuiles d'accueil, neuf règles d'alerte, treize
courbes de pilotage, neuf colonnes par corridor et un rapport financier mensuel**. Le
diagnostic sur les indicateurs qui comptent est le suivant.

L'audit a d'abord conclu qu'aucun des sept indicateurs n'était disponible sous une forme
utile, et qu'un seul était partiellement affiché. **Quatre ont depuis été construits**, les
numérateurs et les dénominateurs étant déjà calculés côté serveur. Voici l'état après ce
travail.

| Indicateur | État |
|---|---|
| Taux de demandes acceptées | **Construit.** Section « Taux » du pilotage, avec la ventilation entre refus et expiration, par semaine ou par mois, et sur la période entière |
| Litiges rapportés aux livraisons | **Construit.** Même section, avec mise en évidence au-delà de 5 % |
| Commission encaissée par colis | **Construit.** Colonne « Revenu moyen par deal » du rapport financier mensuel |
| Colis perdus ou endommagés et montant indemnisé | **Construit.** Section « Sinistralité » du rapport financier : litiges tranchés par mois de décision, catégorie et devise, avec la somme remboursée. C'est la pièce destinée au courtier |
| Part des Expéditeurs qui reviennent | **Délégué à l'outil de mesure d'audience**, conformément à un arbitrage déjà rendu. Les événements nécessaires sont émis |
| Délai entre publication et première demande | **Délégué de même** |
| Délai recherche vers demande acceptée | **Hors de portée du serveur.** Les recherches ne sont qu'un compteur journalier, sans horodatage ni visiteur. Mesurable uniquement dans l'outil d'audience |
| Part des trajets recevant au moins une demande | **Absent.** L'agrégation se fait par corridor, jamais par trajet |

**Deux principes ont été posés en construisant ces taux**, et ils comptent plus que les
chiffres eux-mêmes.

Un taux se calcule sur la **cohorte** : le sort d'une demande compte dans la période où elle a
été faite, jamais dans celle de la réponse. L'ancien calcul de l'alerte divisait les
acceptations d'une fenêtre par les demandes de la même fenêtre, ce qui mélange deux
populations et peut dépasser cent pour cent.

Un dénominateur vide affiche **« — », jamais « 0 % »**. À dix colis par mois, afficher un taux
de litige nul pour un mois sans livraison ferait passer une absence de données pour un bon
résultat.

**Ce qui reste à faire, et qui ne demande aucune ligne de code : poser la clé de mesure
d'audience avant la première livraison.** Les événements de parcours sont déjà émis, côté
navigateur comme côté serveur. Sans la clé, rien n'est enregistré, et cet historique ne se
reconstitue pas, contrairement aux quatre ratios ci-dessus qui se recalculent depuis la base
et sont donc rétroactifs.

Les deux dernières lignes ont une double fonction. Elles pilotent l'activité, et elles
constituent le dossier de sinistralité qui sera demandé par tout assureur lors de la
négociation d'un contrat. **Il faut donc tenir ce registre dès la première livraison**,
même si les chiffres sont minuscules, parce qu'un historique de douze mois ne se
reconstitue pas après coup.

---

## 8. Les risques, nommés

| Risque | Gravité | Ce qui le réduit |
|---|---|---|
| Le corridor ne devient jamais liquide | Fatale | Un seul corridor, offre recrutée en premier, recrutement manuel |
| Un sinistre lourd sans assurance | Fatale | Assurance avant le volume, plafond de valeur déclarée, réserve de garantie |
| Une qualification juridique défavorable de l'activité | Fatale | Consultation avocat avant l'ouverture **[À FAIRE VALIDER]** |
| Un colis illicite passe malgré la charte | Grave | Charte, catégories refusées, signalement, suspension de compte, traçabilité |
| Épuisement du fondateur seul | Grave | Financer le temps du fondateur, accepter la lenteur des phases 1 à 3 |
| Perte de données | Grave | Vérifier les sauvegardes, ce qui n'est toujours pas fait |
| Un concurrent installé arrive sur le corridor | Modérée | La confiance locale et la relation directe ne se copient pas vite |

---

## 9. Les trois questions dont dépend la suite

Les recommandations ci-dessus changent radicalement selon les réponses.

**1. Quelle est la situation personnelle du fondateur sur les douze prochains mois ?**
Temps disponible, revenu, réserve. Un fondateur à temps plein sans revenu et un fondateur
salarié qui avance le soir ne suivent pas la même stratégie, ni le même rythme, ni le même
plan de financement.

**2. Quel corridor de démarrage est réellement accessible ?**
Non pas le plus prometteur sur le papier, mais celui où il est possible d'appeler dix
personnes cette semaine. Le produit couvre le monde entier ; la question porte uniquement sur
le point d'entrée commercial.

**3. L'entité juridique existe-t-elle, et sinon, qu'est-ce qui bloque ?**
C'est le préalable de tout le reste, y compris des comptes développeur mobiles.

---

## 10. Prochaines étapes concrètes

| # | Action | Dépend de |
|---|---|---|
| 1 | Terminer la recette globale en cours | — |
| 2 | Vérifier et documenter une restauration de sauvegarde | — |
| 3 | Prendre rendez-vous avec un expert-comptable pour la forme sociale | — |
| 4 | Envoyer le dossier juridique à deux avocats pour un devis | Dossier joint |
| 5 | Envoyer le dossier assurance à deux courtiers | Dossier joint |
| 6 | Lister nominativement 20 Voyageurs potentiels sur un corridor | — |
| 7 | Ouvrir le registre de sinistralité, même vide | — |
| 8 | Créer la société | 3 |
| 9 | Faire rédiger les conditions générales et la politique de confidentialité | 4, 8 |
| 10 | Ouvrir la phase 1, le recrutement de l'offre | 8, 9 |

Les points 1, 2, 6 et 7 ne dépendent de personne d'autre que du fondateur et peuvent
commencer immédiatement. Les points 4 et 5 sont couverts par les deux dossiers livrés
avec ce document.
