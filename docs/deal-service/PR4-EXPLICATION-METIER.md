# Yamba — Comment aucun événement ne se perd jamais, expliqué simplement
### Document métier · PR4 « outbox relay » · Juillet 2026

Ce document explique ce que la PR4 vient de construire : la machinerie qui garantit que **chaque moment important de la vie d'un deal sera connu de tous ceux qui doivent le savoir — sans exception, sans perte, pour toujours**. C'est une PR invisible à l'écran (aucun bouton, aucune page nouvelle) et pourtant c'est l'une des fondations les plus importantes de la plateforme. Chaque terme technique est expliqué à sa première apparition.

---

## 1. Le problème : le messager qui peut mourir en chemin

Reprenons Aminata et Thomas. Thomas accepte le deal d'Aminata. À cet instant, deux choses doivent se produire : le deal passe à l'état ACCEPTED dans la base de données, **et** Aminata doit être prévenue (« Thomas a accepté ! »).

La façon naïve de faire : le serveur enregistre l'acceptation, puis envoie la notification. Mais que se passe-t-il si le serveur **plante entre les deux** ? Une coupure de courant, un redémarrage, un bug — n'importe quoi. Résultat : le deal est accepté… et Aminata ne le saura jamais. Elle attend, s'inquiète, perd confiance. À l'échelle de milliers de deals, ce genre de perte silencieuse est un poison lent pour une plateforme dont le produit EST la confiance.

L'inverse est tout aussi mauvais : envoyer la notification d'abord, puis enregistrer — et si l'enregistrement échoue, Aminata a été félicitée pour une acceptation qui n'existe pas.

Le problème a un nom en informatique : on ne peut pas faire deux choses dans deux systèmes différents (la base de données ET le système de messages) en garantissant que les deux réussissent ou qu'aucune ne se produit. Il faut ruser.

## 2. La ruse : la boîte d'envoi du greffier

Imaginez un greffier de tribunal. Quand il enregistre un acte, il rédige **dans le même geste** l'acte officiel ET la lettre qui annoncera la nouvelle — et il pose la lettre dans une **boîte d'envoi** posée sur son bureau. L'acte et la lettre sont indissociables : soit les deux existent, soit aucun. C'est ce qu'on appelle une **transaction** : un lot d'écritures « tout ou rien ».

Puis, indépendamment, un **facteur** passe toutes les secondes relever la boîte. Il prend les lettres non postées, les dépose au bureau de poste, et tamponne chaque lettre « postée » **seulement après** que le bureau de poste a confirmé la prise en charge. Si le facteur meurt en chemin ? La lettre est toujours dans la boîte, sans tampon — le facteur suivant la prendra. **Rien ne peut se perdre.**

C'est exactement l'architecture livrée :

- La **boîte d'envoi** s'appelle l'**outbox** : une collection de la base de données (`OutboxEvent`) où chaque changement d'état d'un deal dépose sa « lettre » — l'**événement** — dans la même transaction que le changement lui-même.
- Le **facteur** s'appelle le **relay** (relais) : un petit programme qui tourne à l'intérieur du deal-service et relève la boîte toutes les secondes.
- Le **bureau de poste** s'appelle **Redpanda** : un « journal central des événements » où les messages sont conservés dans l'ordre et où plusieurs abonnés peuvent venir les lire (le service de notifications demain, les statistiques après-demain).

## 3. Les promesses, en langage humain

**« Au moins une fois » (at-least-once).** Le système promet que chaque événement sera livré au journal **au moins** une fois — jamais zéro. La contrepartie honnête : dans de rares cas de panne au mauvais moment, un événement peut partir **deux** fois (le facteur a posté la lettre, puis est mort avant de la tamponner ; son successeur la reposte). C'est un choix délibéré : entre « parfois deux fois » et « parfois jamais », une plateforme de confiance choisit toujours la première option.

**L'idempotence : recevoir deux fois = agir une fois.** Ce mot savant désigne une propriété simple : refaire la même opération ne change rien de plus que de la faire une fois. Un interrupteur est idempotent (appuyer trois fois sur « allumer » = la lumière est allumée). Chaque lettre porte un **numéro unique** ; le destinataire (le futur service de notifications) tiendra un registre des numéros déjà traités : une lettre reçue en double sera reconnue et ignorée. Résultat combiné : **Aminata reçoit exactement une notification**, même si la machinerie interne a dû s'y reprendre à deux fois.

**L'ordre par dossier.** Les événements d'un même deal arrivent toujours **dans l'ordre** : « demandé » avant « accepté » avant « colis remis ». On ne promet pas d'ordre entre deals différents (le deal de Fatou peut doubler celui d'Aminata, ça n'a aucune importance), mais à l'intérieur d'un dossier, la chronologie est sacrée — sinon Aminata pourrait être notifiée d'une livraison avant l'acceptation.

## 4. Les cas difficiles, prévus dès le premier jour

**Un seul facteur à la fois.** Si un jour Yamba fait tourner plusieurs copies du deal-service (pour absorber la charge), deux facteurs qui relèvent la même boîte posteraient tout en double et dans le désordre. La parade : un **bâton de relais** (techniquement un « bail » — *lease*) rangé dans la base. Seul celui qui tient le bâton poste ; il doit le re-saisir toutes les secondes ; s'il meurt, le bâton se libère en 30 secondes et un autre le ramasse. Livré et testé dès aujourd'hui, pour que la croissance de demain ne casse rien.

**Le bureau de poste fermé.** Si Redpanda est en panne, le facteur n'insiste pas frénétiquement : il espace ses tentatives (1 s, 2 s, 4 s… jusqu'à 30 s maximum — un **backoff**), et surtout **les lettres restent bien au chaud dans la boîte**. À la réouverture, tout part, dans l'ordre. Nous l'avons vérifié en conditions réelles pendant cette session : broker éteint, 6 événements en attente, broker rallumé → les 6 sont partis seuls, intacts, ordonnés. Et pendant toute la panne, le site continue de fonctionner normalement.

**La lettre illisible (le « poison »).** Si un bug produisait un jour un événement mal formé, le facteur le détecterait AVANT de le poster (chaque lettre est vérifiée contre le contrat officiel des 17 événements gravé à la PR3). Après 10 tentatives, la lettre est **mise de côté** avec un rapport d'erreur — jamais jetée — et les lettres suivantes continuent de partir. Une alerte signale qu'un humain doit regarder.

**La boîte n'est jamais vidée.** Même postées, les lettres restent archivées pour toujours. C'est un **journal d'audit** (qui s'est passé quoi, quand, déclenché par qui) précieux en cas de litige, et c'est le trésor de guerre du futur : le jour où Yamba construira ses statistiques ou son moteur de recommandation, tout l'historique depuis le premier deal sera **rejouable** — chaque événement transporte volontairement des faits riches (corridor, catégorie, montants, acteur) pour que cette relecture future soit possible sans rien redemander à personne.

## 5. Ce qui est livré, ce qui ne l'est pas encore

**Livré (PR4)** : la boîte (avec ses champs de suivi d'erreurs), le facteur complet (relais, bâton, backoff, mise de côté, arrêt propre), le bureau de poste local pour le développement, le contrat de transport des lettres, 16 vérifications automatiques du comportement du facteur, et un jeu d'essai qui simule un cycle de vie complet.

**Pas encore** : personne n'écrit dans la boîte en conditions réelles (les transitions d'état déposeront leurs lettres au chantier B2 — aujourd'hui c'est un script d'essai qui le fait), et personne ne lit le journal (le service de notifications, premier abonné, arrive en PR4bis — c'est lui qui transformera « booking.accepted » en « 🎉 Thomas a accepté votre demande ! » sur le téléphone d'Aminata).

La tuyauterie est posée et prouvée. La prochaine étape la met au service des utilisateurs.
