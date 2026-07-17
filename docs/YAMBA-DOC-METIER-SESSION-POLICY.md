# Yamba — Documentation MÉTIER : Politique de session (D27)

> Public : produit, support, futur responsable conformité — et tout dev qui veut comprendre le POURQUOI avant le comment.
> Périmètre : PR `feat/session-policy` — règles SES-01 et SES-02 du référentiel métier v1.2. SES-03 (sudo mode), SES-04 (avertissement front) et SES-05 (liste des sessions) sont des suites planifiées, pas couvertes ici.

---

## 1. Le problème qu'on corrige

### 1.1 La session infinie

Avant cette livraison, une session Yamba ne mourait jamais tant que l'utilisateur restait vaguement actif. Le mécanisme d'authentification fonctionne par paires de jetons : un jeton d'accès court (15 minutes) et un jeton de rafraîchissement long (7 ou 30 jours). Quand le jeton d'accès expire, le navigateur en redemande un discrètement via le jeton de rafraîchissement — et à cette occasion, le système fabriquait un jeton de rafraîchissement TOUT NEUF, reparti pour 7 ou 30 jours pleins.

Conséquence : chaque rafraîchissement repoussait l'horizon. Un utilisateur qui ouvrait Yamba une fois par semaine gardait la même session pendant des années. Sur une marketplace qui manipule de l'argent (réservations payées, comptes Stripe, coordonnées bancaires), c'est inacceptable :

- **Un appareil volé ou prêté reste connecté indéfiniment.** Le téléphone oublié dans un taxi donne accès au compte tant que quelqu'un l'utilise de temps en temps.
- **Un jeton exfiltré (malware, réseau compromis) est un passe permanent.** Sa durée de validité affichée ne veut rien dire puisqu'il se renouvelle.
- **Aucun assureur ni auditeur n'accepte des sessions sans plafond.** La conformité (D9, D22) exigera de démontrer une politique de session.

### 1.2 Ce que dit le référentiel métier

Deux règles gravées au registre (décision D27) :

- **SES-01 — Timeout d'inactivité** : une session inutilisée pendant un certain temps meurt, même si son jeton est techniquement encore valide. Cible : 30 à 60 minutes.
- **SES-02 — Durée de vie absolue** : une session meurt au plus tard N jours après sa CRÉATION, quelle que soit l'activité. Cible : 30 jours. C'est le plafond que rien ne peut repousser.

## 2. La solution métier : deux profils de session

Un conflit est apparu à la conception : si le timeout d'inactivité de 30-60 minutes s'applique à tout le monde, la case « Se souvenir de moi » ne veut plus rien dire — l'utilisateur qui revient le lendemain est déconnecté quoi qu'il coche. Décision prise dans cette livraison : **deux profils**, chacun avec sa fenêtre d'inactivité et son plafond absolu.

| | Session standard | Session « Se souvenir de moi » |
|---|---|---|
| Déconnexion après inactivité | **60 minutes** | **7 jours** |
| Durée de vie maximale (plafond absolu) | **7 jours** | **30 jours** |

Lecture pratique :

- L'utilisateur standard qui travaille activement n'est jamais interrompu (chaque action réinitialise la fenêtre de 60 min). S'il ferme l'onglet et revient 2 heures plus tard : reconnexion demandée. Même actif tous les jours, au 7ᵉ jour : reconnexion.
- L'utilisateur rememberMe qui revient chaque semaine reste connecté. S'il disparaît plus de 7 jours : reconnexion. Et quoi qu'il arrive, au 30ᵉ jour : reconnexion. Le plafond absolu est la garantie qu'aucun jeton ne survit plus d'un mois.

Les quatre seuils sont des **paramètres serveur réglables** (variables d'environnement), conformément à la porte 🚪↔ du registre : le mécanisme est gravé, le curseur sécurité/conversion reste ajustable sans redéploiement de code. Si le support constate trop de plaintes de déconnexion, on desserre ; si un incident de sécurité survient, on resserre — en quelques minutes.

## 3. Décisions d'accompagnement (et leurs raisons)

**Personne n'est déconnecté le jour du déploiement.** Les sessions ouvertes avant cette livraison existent dans un ancien format. Plutôt que de forcer une reconnexion générale (friction, tickets support), elles sont acceptées une dernière fois et converties au nouveau format à leur prochain rafraîchissement — leur compteur de vie absolue repart alors de zéro, une seule fois. Ce chemin de compatibilité sera supprimé dans une livraison de nettoyage quand toutes les anciennes sessions auront naturellement expiré (au plus 30 jours après la mise en production).

**Le message de déconnexion est neutre.** Quand une session est refusée, le système ne peut pas distinguer « elle a expiré » de « quelqu'un tente de réutiliser un vieux jeton » (les deux cas laissent la même trace : plus rien en base). L'ancien message criait « réutilisation de jeton détectée » pour une simple expiration — anxiogène et faux la plupart du temps. Nouveau message : « Session expirée ou invalide, veuillez vous reconnecter. »

**La liste des appareils connectés est préparée, pas livrée.** Chaque session enregistre désormais sa date de création et sa dernière activité. C'est la fondation de SES-05 (l'écran Sécurité du dashboard qui listera « MacBook — actif il y a 2 h / iPhone — actif il y a 3 j » avec déconnexion à distance). L'écran lui-même viendra dans une livraison dédiée.

**Le grand ménage documentaire au passage.** L'ancienne documentation d'API d'auth-service (Swagger première génération) a été retirée — elle décrivait d'ailleurs encore les anciennes durées de session, donc mentait. La documentation de référence est désormais générée automatiquement depuis le code (chantier 0), et auth-service y sera converti dans un chantier ultérieur.

## 4. Impacts à connaître

**Pour les utilisateurs** : des reconnexions un peu plus fréquentes, surtout pour ceux qui ne cochent pas « Se souvenir de moi ». C'est le compromis assumé de D27 (sécurité contre friction), et il est réglable.

**Pour le support** : « je suis déconnecté alors que j'étais connecté hier » sans rememberMe = comportement NORMAL (fenêtre de 60 min dépassée). Avec rememberMe et moins de 7 jours d'absence = à investiguer.

**Pour le front (livraison SES-04 à venir)** : aujourd'hui la déconnexion est silencieuse — l'utilisateur découvre l'expiration à sa prochaine action. La modal d'avertissement avant expiration et la redirection propre avec retour à la page d'origine sont la prochaine brique.

**Pour la roadmap** : SES-03 (ré-authentification avant les actions sensibles : IBAN, email, mot de passe) reste le morceau le plus important non couvert — il protège contre l'appareil déverrouillé laissé sans surveillance, scénario que ni SES-01 ni SES-02 ne couvrent complètement.
