# Yamba — Le cycle de vie d'un deal, expliqué simplement
### Document métier · PR3 « lecture des deals » · Juillet 2026

Ce document explique ce que fait la plateforme autour d'un « deal » (une réservation de transport de colis), ce que la PR3 vient de livrer — une PR (Pull Request) est un lot de modifications relu puis intégré au produit —, et ce qui arrive ensuite. Le vocabulaire du produit est conservé, mais chaque terme est expliqué à sa première apparition. Il est écrit pour qu'une personne qui découvre Yamba comprenne les règles du jeu et puisse en discuter, les challenger ou les faire évoluer.

---

## 1. L'histoire de base : Aminata et Thomas

Aminata vit à Vitry-sur-Seine et veut envoyer un téléphone à sa cousine Clarisse à Brazzaville. Thomas prend l'avion Paris → Brazzaville dans dix jours et a de la place dans sa valise. Yamba les met en relation : Aminata paie en ligne, Thomas transporte, Clarisse reçoit, Thomas est payé. Le « deal » est le contrat numérique qui encadre toute cette histoire — qui paie quoi, qui a le colis à quel moment, comment on prouve la livraison, et que se passe-t-il si quelque chose tourne mal.

Trois rôles gravitent autour d'un deal. L'**Expéditeur** (Aminata) déclare le colis, paie, et garde le contrôle de la preuve de livraison. Le **Voyageur** (Thomas — appelé « Tripper » dans l'application) accepte ou refuse, transporte, et livre. Le **destinataire** (Clarisse) n'a pas de compte : il reçoit le colis et communique le code de livraison au Voyageur.

## 2. La vie d'un deal, étape par étape

Un deal traverse des « états », comme les statuts d'une commande en ligne. En voici le récit complet.

**La demande (PENDING).** Aminata choisit le trajet de Thomas, décrit son colis (catégorie, poids, valeur, photos), indique le destinataire, et paie. Son argent est immédiatement mis **sous séquestre** : Yamba le garde en réserve, Thomas ne touche rien tant que la livraison n'est pas confirmée. Thomas a **24 heures** pour répondre. S'il ne répond pas, la demande **expire** (EXPIRED) et Aminata est intégralement remboursée, automatiquement.

**La réponse du Voyageur.** Thomas peut **accepter** (ACCEPTED — le contrat de transport est scellé) ou **refuser** (DECLINED — remboursement intégral immédiat, avec éventuellement une raison : plus de place, catégorie non acceptée…). Aminata peut aussi **annuler** elle-même (CANCELLED) ; si elle annule après l'acceptation, un barème d'annulation s'applique.

**La remise du colis (PICKED_UP).** Le jour J, Aminata remet le colis à Thomas. Thomas photographie le colis et confirme la prise en charge. À cet instant précis, le système génère un **code de livraison à 6 chiffres** et le montre à Aminata — et à elle seule. C'est la clé de voûte de la confiance : Thomas ne connaît pas ce code, il ne l'obtiendra que de la bouche de Clarisse, à destination. Aminata transmet le code à Clarisse par le canal de son choix (elle peut le régénérer jusqu'à 5 fois en cas de doute). Pendant le voyage, Thomas peut signaler des jalons optionnels — à l'aéroport, vol décollé, vol atterri — qu'Aminata voit en temps réel.

**La livraison (DELIVERED).** Thomas retrouve Clarisse, lui remet le colis, et Clarisse lui donne le code. Thomas le saisit dans l'application : s'il est correct, la livraison est enregistrée. Il a droit à 3 tentatives ; au-delà, la saisie est verrouillée 15 minutes (protection contre les tentatives de deviner le code).

**La vérification (3 jours) puis la clôture (COMPLETED).** Aminata dispose de **3 jours** pour vérifier auprès de Clarisse que tout est en ordre. Elle peut confirmer immédiatement (le deal se clôt tout de suite) ou ne rien faire (à J+4, le deal se clôt automatiquement). À la clôture, **le versement part vers Thomas** : le prix du transport, net. La commission Yamba (figée au moment de la réservation) reste à la plateforme. Les deux parties sont ensuite invitées à se noter mutuellement, en double aveugle (chacun note sans voir la note de l'autre, révélation quand les deux ont noté ou après 14 jours), avec des rappels à J+5 et J+7.

**Le litige (DISPUTED).** Si le colis est endommagé ou si quelque chose cloche, Aminata peut **signaler** pendant la fenêtre de 3 jours (photos, description). Le versement à Thomas est **gelé**, un ticket de médiation est ouvert (numéro YAM-XXXX), Aminata reçoit un accusé sous 48 h ouvrées et Thomas est invité à donner sa version. Point important : un litige n'empêche pas le trajet de Thomas d'être considéré comme terminé — le voyage a bien eu lieu — mais l'argent reste bloqué jusqu'à la résolution.

En résumé, neuf états possibles : PENDING, ACCEPTED, PICKED_UP, DELIVERED, COMPLETED (les cinq du chemin heureux), DECLINED, EXPIRED, CANCELLED (les trois sorties sans transport), et DISPUTED (la voie de médiation).

## 3. Ce que la PR3 vient de livrer : voir ses deals, chacun sa vérité

Jusqu'ici, la machinerie des états existait « sous le capot » mais personne ne pouvait la consulter. La PR3 ouvre trois fenêtres de lecture dans l'API (l'interface par laquelle l'application interroge le serveur — chaque « fenêtre » est un endpoint, une adresse précise qui répond à une question précise), et c'est là que se joue une décision métier fondamentale : **l'Expéditeur et le Voyageur ne voient pas la même chose**, volontairement.

L'Expéditeur consulte « Mes envois » : chacun de ses deals avec tout le détail — le prix total payé et sa décomposition (transport + commission), le code de livraison (sa surface d'affichage est prête ; le ré-affichage effectif arrive au prochain chantier), le nombre de régénérations restantes, le suivi, les jalons.

Le Voyageur consulte les deals rattachés à l'un de **ses** trajets : ses **gains** pour chaque colis, les infos du colis et du destinataire (il en a besoin pour livrer), son compteur de tentatives de code. En revanche, il ne voit **jamais** le code de livraison ni quoi que ce soit qui permettrait de le retrouver, et il ne voit pas non plus ce que l'Expéditeur a payé au total ni la commission — il voit sa rémunération, point. C'est le même principe que chez les grandes plateformes : chacun sa vérité économique, et la preuve de livraison reste entre les mains de celui qui paie.

Autre principe gravé : **les boutons d'action affichés à l'écran sont dictés par le serveur**, jamais décidés par l'application. Si le serveur dit qu'Aminata peut « annuler » et rien d'autre, l'écran montre « annuler » et rien d'autre. Impossible qu'un écran propose une action que les règles interdisent.

Enfin, la PR3 livre un **jeu de démonstration international** : une vingtaine de deals répartis sur six corridors (Paris→Brazzaville, Paris→Montréal, Lisbonne→São Paulo, Londres→Lagos, Paris→Hô Chi Minh-Ville, Bruxelles→Kinshasa), couvrant tous les états possibles, avec les deux modèles de tarification (prix par catégorie, prix au kilo). Pourquoi international ? Parce que la cible de Yamba est l'ensemble des diasporas, pas un seul corridor — et parce que tester des fuseaux horaires exotiques (Montréal à −6 h, Hô Chi Minh-Ville à +7 h) débusque les bugs de dates avant les clients.

## 4. Les notifications et emails : qui est prévenu, quand

Chaque moment de la vie d'un deal déclenchera une information adaptée. La grille complète a été gravée dans cette PR (les tuyaux techniques qui l'exécuteront arrivent aux deux prochaines étapes). En voici la lecture métier :

| Moment | Qui est prévenu, et comment |
|---|---|
| Nouvelle demande | Le Voyageur (notification + email, avec le compte à rebours 24 h) ; l'Expéditeur reçoit son reçu de paiement |
| Acceptation / refus / expiration | L'Expéditeur (notification + email ; en cas de refus ou d'expiration, confirmation du remboursement) |
| Annulation | Les deux si elle survient après acceptation |
| Prise en charge du colis | L'Expéditeur — l'email l'invite à ouvrir l'application pour voir le code, mais **le code ne circule jamais dans un email** (un email peut être lu par un tiers) |
| Jalons de voyage | L'Expéditeur, en notification seulement (pas d'email : trois emails « l'avion a décollé » seraient du spam) |
| Régénération du code | L'Expéditeur, email de sécurité (sans le code) |
| Livraison | L'Expéditeur (« vous avez 3 jours pour confirmer ou signaler ») et le Voyageur (« versement programmé ») |
| Clôture | Les deux : récapitulatif, versement en route, invitation à noter |
| Versement effectué | Le Voyageur |
| Litige | L'Expéditeur (accusé ≤ 48 h ouvrées) et le Voyageur (demande de version) |
| Rappels de notation | À J+5 puis J+7, à celui qui n'a pas encore noté — puis on arrête |

## 5. La suite du chantier

Ce qui vient d'être livré est la **lecture**. Les prochaines étapes, dans l'ordre : la publication des événements vers les autres briques de la plateforme (le « facteur » interne), puis le **service de notifications** qui matérialisera la grille ci-dessus (cloche in-app + emails), puis les **écritures** — accepter, refuser, confirmer la remise, saisir le code — avec les paiements Stripe réels (séquestre, remboursements, versements J+4), l'upload des photos, et les automatismes (expiration 24 h, clôture J+4, rappels). Plus loin : la messagerie intégrée, le back-office de médiation des litiges, et les briques d'analyse (statistiques par destination, par membre, par catégorie — les données nécessaires sont déjà capturées depuis le premier jour).

## 6. Petit glossaire

**Deal / Booking** : la réservation de transport d'un colis, du paiement à la clôture. **Séquestre** : l'argent est encaissé mais gardé par la plateforme jusqu'à la preuve de livraison. **Code de livraison** : 6 chiffres connus de l'Expéditeur seul, transmis au destinataire, saisis par le Voyageur pour prouver la remise. **Fenêtre de vérification** : les 3 jours entre la livraison et le versement, pendant lesquels l'Expéditeur peut signaler un problème. **Double aveugle** : chacun note sans voir la note de l'autre. **Corridor** : un axe origine → destination (ex. Paris → Brazzaville). **Snapshot** : la photographie des conditions (prix, trajet, colis) figée au moment de la réservation — si le Voyageur modifie son trajet ensuite, le deal garde sa vérité d'origine. **API / endpoint** : l'interface par laquelle l'application interroge le serveur / une adresse précise de cette interface (ex. « donne-moi mes envois »). **OAS (OpenAPI Specification)** : le document standard qui décrit toute l'API — chez Yamba il est généré automatiquement depuis le code, donc toujours exact ; consultable en direct sur les pages /docs des services. **Hash (bcrypt)** : une empreinte à sens unique du code de livraison — le serveur peut vérifier une saisie, mais personne ne peut retrouver le code depuis l'empreinte, même en lisant la base de données. **Notification in-app** : l'alerte dans la cloche de l'application, par opposition à l'email. **Seed** : le jeu de données de démonstration qui remplit la plateforme d'exemples réalistes.
