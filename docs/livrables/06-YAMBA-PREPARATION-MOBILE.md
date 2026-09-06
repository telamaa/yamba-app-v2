# YAMBA — Préparer le chantier mobile

> Ce document répond à une question simple : **de quoi ai-je besoin, quand, et combien ça coûte** avant d'écrire la première ligne de l'application. Il consigne les décisions D36 et D73 et les échanges du 06/09/2026. Relevé fait sur le poste réel : **Mac Intel, macOS 13.7.8, environnement Apple 15.2**.

## Sommaire

1. En une page
2. Les outils à installer, avec les commandes
3. Ce qui est déjà là
4. Tester sur un vrai téléphone : ce qui est gratuit, ce qui ne l'est pas
5. Le point bloquant du poste, et comment le contourner
6. Les comptes développeur : individuel ou organisation
7. Utiliser le compte d'un tiers pendant le développement
8. Le calendrier des dépenses
9. Rappel de l'approche gravée
10. Vérification finale

---

## 1. En une page

| Question | Réponse courte |
|---|---|
| Faut-il payer pour commencer ? | Non. Les premières semaines ne coûtent rien |
| Faut-il payer pour tester sur mon Android ? | Non, jamais |
| Faut-il payer pour tester sur mon iPhone ? | Pas pour afficher des écrans. Oui dès qu'on teste notifications, paiement ou liens profonds |
| Puis-je publier depuis ce Mac ? | Sur Google Play oui. Sur l'App Store non, la compilation distante s'en charge |
| Un compte pour plusieurs applications ? | Oui, un compte héberge autant d'applications que voulu, sans surcoût |
| Individuel ou organisation ? | Organisation dès que Telama est enregistrée. Même prix chez Apple, et cela évite une contrainte de test chez Google |
| Le compte d'un ami ? | Possible et légitime sur Google, et sur Apple seulement si son compte est de type organisation. Jamais en partageant ses identifiants |

---

## 2. Les outils à installer, avec les commandes

À exécuter dans l'ordre. Aucun ne demande de compte payant.

```sh
# Surveillance de fichiers — sans elle le rechargement à chaud est lent et parfois muet
brew install watchman

# Java 17 — l'outil de compilation Android vise cette version.
# Le poste a Java 20 et 19, connus pour casser certaines compilations Android.
# On INSTALLE À CÔTÉ, on ne désinstalle rien.
brew install --cask temurin@17

# CocoaPods récent — le poste a la 1.11, les versions actuelles de React Native attendent 1.15+
sudo gem install cocoapods

# Interface de compilation distante — indispensable ici (voir chapitre 5)
npm install -g eas-cli
```

Sélectionner Java 17 pour les compilations Android, en ajoutant ceci à `~/.zshrc` :

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

Puis recharger : `source ~/.zshrc`.

---

## 3. Ce qui est déjà là

Relevé sur le poste, rien à faire pour ces éléments.

| Outil | Version constatée | Rôle |
|---|---|---|
| Node et npm | 22.23 et 10.9 | Socle commun avec le reste du projet |
| Environnement Apple | 15.2 | Compilation et simulateur iOS |
| Android Studio et son kit | présent | Émulateur et compilation Android |
| Outils de débogage Android | 1.0.41 | Installation sur un téléphone réel |
| Docker | 27.4 | Déjà utilisé par la plateforme |
| Homebrew | 6.0 | Sert aux installations ci-dessus |

---

## 4. Tester sur un vrai téléphone : ce qui est gratuit, ce qui ne l'est pas

### Android : gratuit, sans condition

Branche le téléphone en USB, active le débogage dans les options développeur, puis :

```sh
adb devices                    # le téléphone doit apparaître
adb install chemin/vers/app.apk
```

Aucun compte, aucun paiement. Le fichier peut aussi être envoyé par lien à un proche, qui l'installe en autorisant les sources inconnues.

**Les 25 dollars de Google ne servent qu'à publier sur le magasin**, y compris pour les canaux de test interne qui passent par la console.

### iOS : gratuit, mais très limité

Avec un simple identifiant Apple, sans payer, l'environnement Apple installe l'application sur ton propre iPhone. Trois limites sérieuses :

- La signature **expire au bout de sept jours**, il faut réinstaller chaque semaine.
- **Ni notifications, ni Apple Pay, ni liens profonds** — précisément trois fonctions de Yamba.
- Trois applications signées ainsi au maximum, en même temps.

Le gratuit permet donc de vérifier que les écrans s'affichent et que les gestes répondent. Il ne permet pas de tester ce qui fait l'application.

### Le chemin gratuit qui va le plus loin

Pendant les premières semaines, l'application compagnon d'Expo suffit sur les deux systèmes. Elle s'installe depuis les magasins, charge le code à distance, et se recharge instantanément. Rien à signer, rien à payer.

```sh
npx expo start          # affiche un code à scanner avec l'application compagnon
```

**Le moment de bascule est précis** : quand arrivent les modules natifs, c'est-à-dire la caméra pour les photos de récupération, la feuille de paiement et les notifications. À partir de là, il faut une vraie compilation, et donc un compte payant du côté d'Apple.

---

## 5. Le point bloquant du poste, et comment le contourner

**Ce Mac ne pourra pas déposer sur l'App Store en local.** Apple impose de compiler avec une version récente de son environnement, laquelle réclame un macOS plus récent que celui installé. La version présente est la dernière possible sur ce système.

Trois conséquences, par ordre de gravité :

1. **Le développement iOS n'est pas bloqué.** Le simulateur fonctionne, les écrans se testent, l'adaptation par système se fait normalement.
2. **La compilation de production et le dépôt passeront par la compilation distante.** C'est la pratique recommandée de toute façon : elle compile sur des machines à jour et évite d'immobiliser le poste.
3. **Installer sur un iPhone réel** demandera soit cette compilation distante avec un profil de développement, ce qui suppose le compte payant, soit une mise à jour de macOS.

Une contrainte proche : la version d'environnement installée ne sait installer que sur des iPhone jusqu'à iOS 17. Si ton téléphone est plus récent, l'installation locale sera refusée même en gratuit.

```sh
# Compiler et installer à distance, quand le compte Apple sera ouvert
eas build --platform ios --profile development
eas build --platform android --profile development
```

**Deux remarques.** Ce Mac est à processeur Intel : les deux émulateurs fonctionnent mais restent lents. Et les budgets de performance exigés par D36 devront de toute façon être mesurés sur un téléphone réel, jamais sur un émulateur.

---

## 6. Les comptes développeur : individuel ou organisation

Un compte, quel qu'il soit, héberge **autant d'applications que voulu**, sans surcoût. Le choix porte sur trois autres points.

| | Individuel | Organisation |
|---|---|---|
| Prix Apple | 99 dollars par an | le même |
| Prix Google | 25 dollars une fois | le même |
| Nom du vendeur affiché | ton nom civil | Telama |
| Ajouter quelqu'un à l'équipe | impossible chez Apple | oui, avec des rôles par application |
| Prérequis | rien | société enregistrée et identifiant d'entreprise |

Chez Apple, **le prix est identique** : la différence est donc gratuite si la condition est remplie.

### Un argument fort du côté de Google

Un compte développeur **personnel** créé récemment doit, avant de pouvoir publier en production, mener un test fermé avec au moins douze testeurs pendant quatorze jours consécutifs. Les comptes organisation en sont dispensés. Cela représente deux semaines de délai et douze personnes à recruter, au moment précis du lancement. *Règle à revérifier au moment de l'inscription : elle a évolué récemment.*

### Recommandation

**Si Telama est enregistrée, ou le sera avant le lancement** : compte organisation des deux côtés. Nom de vendeur cohérent avec le compte de paiement, ajout possible d'un développeur, pas de test forcé, et le même compte servira les autres applications.

**Si Telama n'existe pas encore juridiquement** : le compte organisation est impossible, la condition est ferme. Or une entité sera de toute façon nécessaire pour encaisser des commissions et déclarer l'activité. La vraie question n'est donc pas le type de compte, mais la date d'immatriculation.

**Délai à anticiper** : l'identifiant d'entreprise réclamé par Apple s'obtient gratuitement, mais il faut compter de quelques jours à quelques semaines. Lancer la démarche bien avant d'en avoir besoin ; c'est typiquement ce qui décale un lancement sans prévenir.

### Le revers de la mutualisation

Un compte partagé entre plusieurs applications, c'est un risque partagé : si l'une viole les règles, la sanction peut frapper le compte entier, donc toutes les autres. Cela ne doit pas dissuader, mais cela justifie d'être rigoureux sur chacune, même une petite application secondaire.

---

## 7. Utiliser le compte d'un tiers pendant le développement

**Google** : ton ami peut t'inviter sur sa console avec des droits précis, y compris depuis un compte individuel. C'est le mécanisme prévu.

**Apple** : l'invitation d'un membre n'existe que sur les comptes organisation. Si son compte est individuel, il ne peut pas t'ajouter, c'est techniquement impossible.

**Ce qu'il ne faut pas faire** : utiliser ses identifiants. L'engagement Apple est nominatif ; partager un accès expose **son** compte à la suspension, pas le tien.

**La limite réelle n'est pas technique.** Le nom du compte devient le vendeur affiché dans le magasin, donc l'entité qui apparaît comme responsable du service. Publier Yamba sous le nom d'un tiers crée une incohérence : le paiement passe par le compte Stripe de Telama, le magasin annonce quelqu'un d'autre. Le transfert d'une application entre comptes existe des deux côtés, mais il se prépare, prend plusieurs jours et suppose la coopération des deux parties.

**En résumé** : acceptable pour développer, jamais pour publier.

---

## 8. Le calendrier des dépenses

| Moment | Dépense | Pourquoi |
|---|---|---|
| Socle, navigation, écrans | rien | Application compagnon et simulateurs |
| Premiers modules natifs (caméra, paiement, notifications) | 99 dollars Apple | Seul moyen de tester ces fonctions sur un iPhone |
| Premier dépôt Android | 25 dollars Google | Publication et canaux de test |
| Compilation distante | offre gratuite au départ | Devient payante au-delà d'un certain volume |

Android peut être testé de bout en bout sans rien payer jusqu'au dépôt.

---

## 9. Rappel de l'approche gravée (D73)

**Construire pour les deux systèmes dès le socle, publier l'une après l'autre, Android d'abord.**

Le code est identique : ce qui se décide, c'est sur quoi l'on teste chaque jour. Chaque écran est validé sur les deux simulateurs avant d'être considéré comme fini ; ne lancer iOS qu'après trois mois accumulerait une dette invisible découverte juste avant un dépôt.

Trois conséquences iOS touchent le **serveur** et non la seule application :

1. **« Se connecter avec Apple » devient obligatoire** puisque la connexion Google existe. Le service d'authentification devra vérifier un jeton Apple comme il vérifie un jeton Google.
2. **La commission d'achat intégré ne s'applique pas** : Yamba vend le transport d'un colis, un service du monde réel. Contrepartie : ne jamais vendre d'option numérique dans l'application.
3. **Le manifeste de confidentialité** est obligatoire et doit déclarer ce que la mesure d'audience collecte.

Le délai entre les deux publications se tranchera sur la répartition réelle des systèmes chez les visiteurs actuels, lisible dans la mesure d'audience une fois sa clé posée, et non sur une moyenne de marché.

---

## 10. Vérification finale

À exécuter après les installations du chapitre 2.

```sh
watchman --version                  # attendu : une version
/usr/libexec/java_home -v 17        # attendu : un chemin, pas une erreur
pod --version                       # attendu : 1.15 ou plus
eas --version                       # attendu : une version
adb devices                         # téléphone Android branché : il apparaît
xcrun simctl list devices | grep -i booted   # simulateur iOS démarré
emulator -list-avds                 # au moins un appareil Android virtuel
```

Si l'une de ces commandes échoue, reprends la ligne correspondante du chapitre 2 avant d'ouvrir le chantier.
