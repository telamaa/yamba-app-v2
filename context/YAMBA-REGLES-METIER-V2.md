# 📗 YAMBA — Règles métier V2
## Pricing, capacité, annulation, conformité, protection, session, fuseaux, signalement

> **Version** 1.2 · 16 juillet 2026 — *révisions : CAT-02 finalisé (8 familles + mapping), PRC-09/10 (forfait bagages, ancre express), nouvelle section 10bis REP (D29), paramètres actés au mockup*
> **Portée** : règles métier issues du registre de décisions (`YAMBA-REGISTRE-DECISIONS-ROADMAP.md`). Complète — sans les remplacer — les règles RG-01→RG-27 (`DOC-METIER-TRIP-LIFECYCLE.md`) et la spec workflow (`SPECIFICATIONS-WORKFLOW-BOOKING-YAMBA.md`).
> **Convention de numérotation** : préfixe par domaine — PRC (pricing), CAT (catégories), COM (commission), CAP (capacité), ANN (annulation), CNF (conformité), GAR (protection du colis), FUS (fuseaux), SES (session), SIG (signalement), DEV (devises), RGP (données personnelles).
> **Principe transverse** : toute limite ou règle de ce document est **appliquée côté serveur** — le front n'est qu'indicatif (D4).

---

# 1. PRC — Pricing

**PRC-01 — Le prix du transport se calcule au kilo.** Le Voyageur fixe un tarif unique en €/kg par trajet. Prix du transport = tarif × poids déclaré du colis, ajusté par la classe de taille (PRC-03). *(Source : D13)*

**PRC-02 — Le Voyageur déclare sa capacité en kg** (`capacityKg`) par trajet. C'est la marchandise vendue : des kilos de franchise bagage.

**PRC-03 — Classes de taille S / M / L.** L'Expéditeur qualifie le volume par une classe visuelle, jamais par des dimensions : **S** = tient dans une boîte à chaussures (modificateur ×1,0) ; **M** = tient dans un sac cabine (×1,1) ; **L** = occupe une demi-valise (×1,25). Les coefficients sont des paramètres serveur ajustables. *(Adaptation UX du poids volumétrique — D13)*

**PRC-04 — Les bagages entiers sont des produits forfaitaires.** CHECKED_BAG_23KG et CABIN_BAG_12KG se vendent à prix fixe défini par le Voyageur, hors logique €/kg : on loue la franchise complète. Un bagage entier consomme sa franchise nominale (23 kg / 12 kg) de la capacité du trajet.

**PRC-05 — Suggestion de prix (V1 déterministe).** `prixSuggéré(€/kg) = base_corridor × Π(modificateurs)`. Base_corridor : table seedée par corridor (étude marché GP). Modificateurs : vol direct vs escales ; proximité de la date de départ ; saisonnalité (fêtes) ; réputation du Voyageur ; demande latente (nombre de SavedRoutes actives sur le corridor). Affichage : fourchette basse–médiane–haute + ancre « les trajets similaires partent à Y €/kg ». Le Voyageur reste libre de son prix. *(D15)*

**PRC-06 — Badge « prix juste ».** Côté Expéditeur, un trajet dont le €/kg est dans la fourchette du moteur porte un badge de confiance. Un prix hors fourchette n'est ni bloqué ni pénalisé en v1.

**PRC-07 — Tolérance de poids au pickup : ±10 %.** Si le poids constaté au pickup dépasse le poids déclaré de plus de 10 %, le Voyageur peut exiger une renégociation ou refuser le pickup (flux refus existant → annulation + remboursement). L'écart ≤ 10 % est toléré sans ajustement. Le seuil est un paramètre serveur.

**PRC-08 — Snapshot immuable.** Au moment de la réservation, le Booking enregistre la photographie complète du calcul : €/kg appliqué, poids, classe, modificateurs, total Expéditeur, commission, **prime de protection (ligne distincte — GAR-04)**, net Voyageur, devise. Aucune modification ultérieure du Trip ne modifie un Booking existant. *(D17)*

**PRC-09 — Suggestion de forfait bagage.** `forfait suggéré = médiane_corridor (€/kg) × franchise (kg) × 0,9` — remise de gros : la franchise complète se vend le kilo légèrement moins cher. Le Voyageur reste libre du forfait final. *(D13 v1.2)*

**PRC-10 — L'express comme ancre, jamais comme entrée.** Les tarifs des transporteurs express (DHL, La Poste/Colissimo) n'entrent pas dans le calcul de la suggestion (le marché de référence est le GP). Ils servent : ① d'**ancre comparative** affichée côté Expéditeur (« Total 28 € — vs ~85 € chez DHL ») ; ② de **plafond de sécurité** : la suggestion ne dépasse jamais un pourcentage (paramètre serveur) du tarif express équivalent sur le corridor. *(D15 v1.2)*

---

# 2. CAT — Catégories (familles de risque)

**CAT-01 — La catégorie ne porte jamais le prix.** Elle qualifie la nature du contenu pour : la conformité (CNF), le risque, la protection du colis (GAR), la déclaration douane. *(D14)*

**CAT-02 — Familles de risque (✅ liste finale actée v1.2).** Huit familles + les deux formats bagage :

| # | Famille (enum) | Raison d'être | Mapping ancien enum |
|---|---|---|---|
| 1 | DOCUMENTS_PAPERS | régime douanier distinct, sans valeur marchande | DOCUMENTS, BOOKS |
| 2 | CLOTHES_TEXTILE | le volume du corridor, risque faible | CLOTHES, SHOES, FASHION_ACCESSORIES |
| 3 | FOOD_DRY_SEALED | le volume réel du GP (épices, sec) — **strictement encadrée CNF** : scellé d'origine uniquement, jamais de périssable, inspection renforcée au pickup | *(nouvelle)* |
| 4 | ELECTRONICS_DEVICES | valeur, risque vol, douane | PHONE, COMPUTER, OTHER_ELECTRONICS |
| 5 | COSMETICS_CARE | contraintes liquides cabine/soute | *(nouvelle)* |
| 6 | PARTS_TOOLS | lourd, fréquent sur le corridor | *(nouvelle)* |
| 7 | TOYS_CHILDCARE | faible risque | SMALL_TOYS |
| 8 | MISC_ACCESSORIES | fallback | OTHER_ACCESSORIES |
| — | CHECKED_BAG_23KG / CABIN_BAG_12KG | formats forfaitaires (PRC-04), hors familles | inchangés |

Migration : mapping ci-dessus livré avec la refonte pricing (front + JSON i18n bloc `families` + script de migration des données existantes).

**CAT-03 — Surcharges et exclusions par famille.** Le Voyageur peut, par trajet : exclure une famille (« je ne prends pas d'électronique ») ou lui appliquer une surcharge en % (paramètre libre, suggéré ≤ 30 %). Appliqué dans le calcul PRC-01 et visible avant réservation.

---

# 3. COM — Commission

**COM-01 — Commission unique, côté Expéditeur.** Yamba prélève un pourcentage du prix du transport, payé par l'Expéditeur en sus. Les frais du prestataire de paiement sont absorbés dans la commission — jamais affichés séparément. *(D16)*

**COM-02 — Plancher de commission.** La commission ne descend jamais sous un montant fixe (paramètre serveur), pour couvrir les coûts incompressibles des petits colis.

**COM-03 — Affichage en deux lignes maximum.** Expéditeur : « Transport X € » + « Service & protection Y € » = Total. Voyageur : son net, uniquement (« Tu gagnes Z € »).

**COM-04 — La commission est figée dans le snapshot** (PRC-08) : un changement de barème ne s'applique qu'aux réservations postérieures.

---

# 4. CAP — Capacité

**CAP-01 — Réservation des kilos dès PENDING.** À la création d'une demande, les kg du colis (ou la franchise nominale d'un bagage entier) sont décrémentés de `remainingKg` — de façon atomique (transaction MongoDB). Une demande dont le poids excède `remainingKg` est refusée à la création. *(D19)*

**CAP-02 — Libération sur états terminaux sans transport.** DECLINED, EXPIRED, CANCELLED (avant pickup) restituent les kg réservés. ACCEPTED, PICKED_UP, DELIVERED, COMPLETED, DISPUTED les conservent.

**CAP-03 — Un booking = un colis.** Pas de multi-colis par deal en v1. Deux colis = deux réservations distinctes (deux codes, deux litiges potentiels, deux notations). *(D23)*

**CAP-04 — Tout deal passe par PENDING en v1.** Aucun mécanisme ne court-circuite l'acceptation du Voyageur : elle est le point de contrôle de confiance et de conformité. `instantBooking` n'a pas d'effet sur la machine d'états v1. *(D20)*

---

# 5. ANN — Annulation & remboursement

**ANN-01 — Matrice Expéditeur** *(seuils = paramètres serveur ; source D21)* :

| Moment de l'annulation | Remboursement Expéditeur | Note |
|---|---|---|
| Statut PENDING | 100 % | Le Voyageur n'a rien engagé |
| ACCEPTED, jusqu'à J-2 du départ | 100 % | |
| ACCEPTED, moins de 48 h du départ | Partiel (retenue X %, versée au Voyageur) | Le Voyageur a réservé sa capacité |
| Après PICKED_UP | Aucune annulation | Seule voie : le litige (DISPUTED) |

**ANN-02 — Annulation par le Voyageur après acceptation** : remboursement **intégral** de l'Expéditeur, quel que soit le moment + impact sur la réputation du Voyageur (compteur d'annulations visible / effet sur badge). C'est lui qui fait défaut.

**ANN-03 — Annulation d'un trajet avec deals actifs** : l'annulation du Trip (RG lifecycle) déclenche l'annulation en cascade de tous ses deals non terminaux selon ANN-02 (défaut Voyageur).

**ANN-04 — Remboursements automatiques.** DECLINED et EXPIRED remboursent intégralement et automatiquement (déjà spécifié §2.2 workflow) ; les remboursements ANN-01/02 sont exécutés par le serveur sans intervention manuelle, avec trace dans l'audit trail.

---

# 6. CNF — Conformité du colis *(le risque existentiel — D9 ; détails opérationnels dans POLITIQUE-CONFORMITE-YAMBA.md à rédiger)*

**CNF-01 — Liste des interdits, bloquante au wizard.** Sont interdits à la déclaration (liste non exhaustive, en dur dans le produit) : stupéfiants et substances contrôlées ; armes et munitions ; batteries lithium hors équipement ; liquides et aérosols au-delà des règles cabine ; espèces et instruments monétaires ; médicaments hors prescription personnelle ; denrées périssables ; contrefaçons. Base : réglementation IATA + douanes des corridors desservis.

**CNF-02 — Attestation Expéditeur.** À chaque réservation, l'Expéditeur atteste sur l'honneur (case + horodatage serveur, conservés) que le contenu correspond à la déclaration et ne contient aucun interdit CNF-01.

**CNF-03 — Le colis voyage non scellé jusqu'au pickup.** Il est présenté ouvert au Voyageur, scellé devant lui après inspection.

**CNF-04 — L'inspection au pickup est un rituel obligatoire.** La checklist 5/5 inclut explicitement : « J'ai vu le contenu ouvert et il correspond à la déclaration ». La photo du colis ouvert fait partie des preuves PICKUP. Sans checklist complète + ≥ 1 photo, pas de transition PICKED_UP (règle serveur existante, renforcée).

**CNF-05 — Vérification d'identité forte des deux côtés.** Voyageur : KYC Stripe Connect (existant). Expéditeur : Stripe Identity avant la première réservation (seuil d'activation paramétrable : dès la 1re réservation ou au-delà d'une valeur déclarée).

**CNF-06 — Plafonds compte neuf** *(paramètres serveur)* : valeur déclarée max par colis ; poids max par colis ; nombre d'envois par mois. Relevés progressivement avec l'historique du compte.

**CNF-07 — Droit de refus inconditionnel du Voyageur au pickup.** Tout doute sur le contenu = refus sans pénalité de réputation, remboursement intégral de l'Expéditeur, et signalement optionnel (SIG).

**CNF-08 — Les contrôles CNF sont opposables au partenaire d'assurance** (GAR) : le respect de CNF-01→07 conditionne la couverture. Toute évolution de ces règles est notifiée au partenaire.

---

# 7. GAR — Protection du colis *(D22 révisée : cible assurance réelle, transitoire Garantie Yamba)*

**GAR-01 — Stratégie à deux étages.** La **cible** est une véritable assurance souscrite en partenariat avec un assureur (modèle *embedded insurance* : le partenaire porte l'agrément et le produit, Yamba distribue — Yamba ne devient jamais assureur ni ne porte le risque). Le **transitoire au lancement**, si le contrat n'est pas signé à temps, est la **« Garantie Yamba »** : un engagement commercial de remboursement plafonné, financé par la commission, légal immédiatement.

**GAR-02 — Terminologie conditionnelle.** Le mot « assurance » n'apparaît dans l'UI, les emails et les CGU **qu'après signature du contrat avec l'assureur** — il est alors affiché avec le nom du partenaire (actif de confiance). Avant signature, seul le terme « Garantie Yamba » (ou « protection ») est employé.

**GAR-03 — Modèle extensible.** Le schéma porte un `protectionPlan` : `provider` (`YAMBA_GUARANTEE` | code de l'assureur partenaire), niveau (`BASIC` inclus / `EXTENDED_500` optionnel), plafond, prime. La bascule Garantie → assurance est un changement de `provider` et de contenu, pas de schéma.

**GAR-04 — La prime est un flux comptable distinct de la commission**, dès le jour 1, dans le snapshot (PRC-08) comme dans les écritures : une prime reversée à un assureur et une commission Yamba ne se mélangent jamais. *(La fusion des deux serait l'erreur irréversible.)*

**GAR-05 — Exclusions affichées avant souscription.** Les exclusions de couverture — dont, dans tous les cas, la **saisie douanière d'un colis non conforme** (renvoi CNF) — sont présentées à l'Expéditeur avant le choix du niveau de protection. Sous régime assurance : remise des documents d'information précontractuelle (DIC/IPID) conformément aux obligations de distribution.

**GAR-06 — Indemnisation plafonnée au minimum entre** : la valeur déclarée, le plafond du niveau souscrit, et la valeur justifiée en médiation (ou selon le processus de sinistre du partenaire sous régime assurance). Versée uniquement à l'issue d'un litige tranché en faveur de l'Expéditeur.

---

# 8. FUS — Fuseaux horaires *(D24)*

**FUS-01 — Tout horaire de trajet est local à son lieu.** Départ 14h00 = 14h00 à l'aéroport de départ ; arrivée 16h30 = 16h30 à l'aéroport d'arrivée (convention aérienne).

**FUS-02 — Le schéma stocke les deux représentations** : local (`*DateLocal`/`*TimeLocal` + `originTimezone`/`destinationTimezone` IANA, dérivés des coordonnées via Google Time Zone API à la création) et instant (`departureAtUtc`/`arrivalAtUtc`, calculés serveur).

**FUS-03 — Toute comparaison au temps réel utilise l'UTC** : cron complete-trips, `isTripPastDeparture`, expiration 24 h des demandes, période de vérification J+4, verrous de saisie. Aucune logique serveur ne compare des heures locales.

**FUS-04 — Tout affichage utilise l'heure locale du lieu**, avec mention du fuseau quand les deux extrémités diffèrent (ex. « 14:00 (Paris) → 16:30 (New York) »).

---

# 9. SES — Sessions & authentification *(D27)*

**SES-01 — Timeout d'inactivité côté serveur.** Chaque session porte un `lastActivityAt` (Redis). Le renouvellement (`/auth/refresh`) est refusé si l'inactivité dépasse le seuil (paramètre env ; cible 30-60 min). La rotation du refresh token ne prolonge plus indéfiniment la session.

**SES-02 — Durée de vie absolue.** Une session expire au plus tard N jours après sa création (paramètre ; cible 30 jours), indépendamment de l'activité.

**SES-03 — Sudo mode.** Les actions sensibles exigent une ré-authentification récente (mot de passe ou OTP), même en session active : modification de l'IBAN / du compte Stripe, de l'email, du mot de passe, suppression de compte.

**SES-04 — Expérience de fin de session.** Le front avertit avant expiration (modal) et déconnecte proprement (purge des états locaux, redirection login avec retour à la page d'origine après reconnexion).

**SES-05 — Visibilité des sessions.** La section Sécurité du dashboard liste à terme les sessions actives (appareil, dernière activité) avec révocation unitaire.

---

# 10. SIG — Signalement *(D26)*

**SIG-01 — Tout membre peut signaler un trajet ou un profil** via un bouton discret + modal : motif (enum : contenu illicite, arnaque suspectée, comportement inapproprié, autre), description libre, horodatage, reporter identifié.

**SIG-02 — Modèle générique.** Un seul modèle `Report` (`targetType` : TRIP | USER | futur MESSAGE) et un seul endpoint. Les signalements alimentent une file de traitement dans l'admin (chantier C) avec statut (reçu / en cours / traité / rejeté).

**SIG-03 — Effets.** Un signalement ne suspend rien automatiquement en v1 (pas d'arme de harcèlement) ; seuls des seuils (N signalements distincts) déclenchent une revue prioritaire. La décision (masquage du trajet, suspension du compte) appartient à l'admin et est journalisée (audit log D7).

**SIG-04 — Le reporter est protégé.** L'identité du reporter n'est jamais révélée à la cible.

---

# 10bis. REP — Réputation & score *(D29)*

**REP-01 — Deux objets, jamais fusionnés.** La **réputation visible** (signal de confiance entre membres) et le **TrustScore interne** (contrôle du risque plateforme) sont des systèmes distincts : publics différents, règles différentes, stockage différent.

**REP-02 — La réputation visible est explicable.** Elle n'agrège que des faits que l'utilisateur contrôle et peut vérifier : note moyenne (B5), deals complétés, taux d'annulation post-acceptation, délai de réponse médian, ancienneté, identité vérifiée. Présentation en **badges + statistiques** (« ★ 4,9 · 27 deals · 0 annulation ») — jamais de note globale opaque.

**REP-03 — Niveaux publics à critères affichés.** Nouveau (< 3 deals) · Confirmé · Top Yamber (≥ 10 deals, note ≥ 4,8, 0 annulation tardive — seuils = paramètres serveur). Ces niveaux alimentent le modificateur réputation du moteur de prix (PRC-05). Miroir côté Expéditeur : badge « Expéditeur fiable » (deals sans litige perdu, poids conformes au pickup).

**REP-04 — TrustScore interne.** Invisible des membres. Signaux : litiges perdus en médiation, écarts de poids répétés au pickup (PRC-07 = signal de fraude), annulations tardives, vélocité anormale (envois/jour d'un compte neuf), signalements reçus (SIG), identité, ancienneté. Usages exclusifs : pilotage des **plafonds progressifs** (CNF-06), **priorisation** de la file de revue admin, aide à la décision. **Garde-fous** : aucune sanction automatique — un humain décide (cohérent SIG-03 et RGPD sur les décisions automatisées) ; chaque variation du score référence l'événement source (journal Kafka D2).

**REP-05 — Signaux exclus des deux objets.** Fréquence de connexion et volume brut de trajets publiés : la présence n'est pas la fiabilité (le Yamber occasionnel qui honore 4 voyages/an est un excellent profil), et les récompenser créerait des incitations artificielles. Principe : **ne valoriser que des issues coûteuses à falsifier** (deal complété avec paiement réel, notation double-aveugle).

---

# 11. DEV — Devises *(D18, D25)*

**DEV-01 — Tous les montants sont stockés en centimes entiers, avec devise explicite.** Aucun montant flottant, aucun montant sans `currency`.

**DEV-02 — Devise de transaction unique en v1 : EUR.** Paiements, séquestre, remboursements, versements — tout est en euros.

**DEV-03 — L'affichage est localisé** (`Intl.NumberFormat(locale, { currency })`) : le montant ne change pas, son format suit la langue de l'utilisateur.

**DEV-04 — La multi-devise de transaction (XAF, Mobile Money) est une évolution prévue** (D11) : le schéma est prêt (DEV-01), l'implémentation attend le chantier Mobile Money.

---

# 12. RGP — Données personnelles *(D12)*

**RGP-01 — Rétention définie par type de donnée** (paramètres à figer dans POLITIQUE-CONFORMITE) : données de compte (durée de vie du compte + délai légal), photos de deals (durée de contestation + délai), attestations CNF-02 (délai légal long — valeur probatoire), sessions (SES-02), logs (durée courte).

**RGP-02 — Le destinataire est un tiers protégé.** Son téléphone et son nom sont fournis par l'Expéditeur : minimisation (révélé au Voyageur uniquement après PICKED_UP — règle existante), information du destinataire au premier SMS (lien de suivi + mention d'origine des données), effacement à la clôture du deal + délai.

**RGP-03 — Consentements tracés** : attestation conformité, charte Voyageur, CGU, information précontractuelle de protection (GAR-05) — chacun avec version du texte + horodatage serveur.

**RGP-04 — Droit à l'effacement outillé** : procédure d'anonymisation du compte préservant l'intégrité comptable (les Bookings restent, anonymisés) et les obligations légales.

---

# 13. Paramètres serveur introduits par ce document *(valeurs initiales, ajustables sans redéploiement métier)*

| Paramètre | Valeur initiale | Règle |
|---|---|---|
| `SIZE_MODIFIER_S / M / L` | 1,0 / 1,1 / 1,25 | PRC-03 |
| `WEIGHT_TOLERANCE_PCT` | 10 % | PRC-07 |
| `COMMISSION_PCT` / `COMMISSION_FLOOR_CENTS` | **12 % / 300** *(acté mockup)* | COM-01/02 |
| `BAG_FORFAIT_DISCOUNT` | 0,9 | PRC-09 |
| `SUGGESTION_EXPRESS_CAP_PCT` | à fixer (étude corridor) | PRC-10 |
| `REPUTATION_TOP_MIN_DEALS / MIN_RATING / MAX_LATE_CANCEL` | 10 / 4,8 / 0 | REP-03 |
| `CATEGORY_SURCHARGE_MAX_PCT` | 30 % | CAT-03 |
| `CANCEL_FULL_REFUND_UNTIL_HOURS` | 48 h avant départ | ANN-01 |
| `CANCEL_LATE_RETENTION_PCT` | à fixer | ANN-01 |
| `NEW_ACCOUNT_MAX_DECLARED_VALUE / MAX_WEIGHT / MAX_SHIPMENTS_PER_MONTH` | à fixer | CNF-06 |
| `IDENTITY_REQUIRED_FROM` | 1re réservation | CNF-05 |
| `PROTECTION_BASIC_CAP / EXTENDED_CAP / EXTENDED_PRICE` | à fixer / 500 € / à fixer | GAR-03/06 |
| `PROTECTION_PROVIDER` | YAMBA_GUARANTEE | GAR-01/03 |
| `SESSION_IDLE_TIMEOUT_MIN` | 45 min | SES-01 |
| `SESSION_ABSOLUTE_LIFETIME_DAYS` | 30 j | SES-02 |
| `REPORT_REVIEW_THRESHOLD` | 3 signalements distincts | SIG-03 |

---

*Toute règle marquée « paramètre serveur » vit en configuration, pas en dur dans le code. Toute évolution d'une règle de ce document se fait par mise à jour du document PUIS du code — jamais l'inverse.*
