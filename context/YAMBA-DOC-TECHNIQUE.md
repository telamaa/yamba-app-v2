

---

# Chapitre 5.32 du cahier 01-WEB : le vocabulaire — relire 62 écrans, et garder le lexique à la source

*(PR `chore/recette-web-5-32`, 13/09/2026.)*

## Ce qui a été fait

Le dernier chapitre du § 5 du cahier 01-WEB : `WEB-VOC` (mots de rôle, « assurance », noms de catégories,
tutoiement, textes de démonstration, libellés vides ou clés techniques). Six fiches conformes (quatre après
correction), cinq anomalies closes (`ANO-WEB-98` à `102`), une règle de CI ajoutée.

```
apps/e2e/src/chapitres/web-voc.spec.ts                          relevé commun (62 écrans FR/EN) + 6 fiches
apps/e2e/src/chapitres/web-{rch,msg,rsv-devis,rem,dea,trj,voy}   20 citations d'anciens textes mises à jour
apps/e2e/src/pages/fil-messagerie.ts                            idem
scripts/check-i18n-messages.mjs                                 RÈGLE 6 — le vocabulaire des messages
apps/user-ui/messages/{fr,en}/*.json                            ANO-WEB-98/99/100/101 — ~90 valeurs réécrites
apps/user-ui/src/**  (≈ 20 fichiers)                            textes en dur : tutoiement, rôles, étiquettes traduites
apps/user-ui/src/components/trips/detail/ReviewsCard.tsx        ANO-WEB-102 — le lien des avis
apps/user-ui/src/app/[locale]/dashboard/*/preview/page.tsx      vitrines de démo introuvables en production
apps/notification-service/src/emails/**                         emails anglais : « Traveler »
apps/trip-service/src/utils/templates/trip-notifications/*.ejs  emails d'alerte : tutoiement
```

## Relire, pas refaire : un relevé commun

Le cahier dit « en relisant les écrans déjà parcourus ». Une fiche par écran aurait rejoué 62 navigations six
fois. Le harnais fait donc UN relevé (`WEB-VOC-0`) et six requêtes dessus :

```ts
async function texteVisible(page: Page): Promise<string> {
  // innerText (ce qui est rendu) + ce qu'entend un lecteur d'écran, sur les éléments qui ont une boîte
  document.querySelectorAll("[aria-label], [placeholder], [title], img[alt]") …
}
function occurrences(motif: RegExp, filtre = (e: Ecran) => true, exclure?: RegExp): string[]
  // → « [en] finances (aminata) : « …retention passed on to the carrier + €14.56… » »
```

Le relevé est écrit sur disque (`resultats/releve-web-voc.json`) : après l'échec d'une fiche, Playwright remplace
le processus de travail, et un relevé gardé en mémoire serait perdu pour les suivantes. Le chapitre n'est donc
**pas en série** — une fiche qui échoue n'empêche pas les autres de rendre leur inventaire.

Trois garde-fous d'instrument, tous payés : un écran « introuvable » est refusé (sinon il passe le seuil de
longueur) ; la stabilité exige trois lectures identiques et zéro `.animate-pulse` ; les adresses (`…shipper@…`) et
les chemins d'URL (`/carrier/deals/`) ne sont pas des mots.

## VOC-3 : créer la donnée que la fiche doit relire

Le jeu d'essai n'a aucun envoi « bagage en soute » VIVANT (le seul est refusé, et un envoi refusé n'apparaît dans
aucune liste). Une fiche « verte » sur des écrans qui ne montrent pas l'objet ne prouve rien — c'est ce qu'a fait la
première version. La fiche réserve donc un bagage en soute sur `bzv-perkg` (assistant, paiement FAKE) et exige que
chaque écran **nomme** l'objet avant de comparer les formulations.

## La règle 6 du contrôle i18n

```js
const VOCABULAIRE = {
  fr: [
    { motif: /\b(trippers?|yambers?|transporteurs?|travell?ers?|carriers?|shippers?)\b/i, raison: "mot de rôle refusé" },
    { motif: /\b(assurances?|IPID)\b/i, raison: "« assurance »" },
    { motif: /(?<![-\p{L}])(vous|votre|vos)(?![-\p{L}])/iu, raison: "vouvoiement",
      sauf: /tous les deux|ensemble|vos deux|vos avis|vos profils|vous organiser|vous devez convenir/i },
  ],
  en: [ /\b(carriers?|trippers?|yambers?|travellers?)\b/i, /\b(insurance|insured|IPID)\b/i ],
};
// + toute valeur vide ou « — » ; + garde du garde : moins de 1000 textes lus → erreur
```

`(?<![-\p{L}])vous(?![-\p{L}])` : un `\b` ASCII ne suffit pas en français (« rendez-vous » contient « vous » entre
deux frontières de mot, et `\b` ne connaît pas les lettres accentuées) ; les assertions arrière/avant avec `\p{L}`
(drapeau `u`) excluent le trait d'union et toute lettre Unicode.

## La non-régression, et ce qu'un inventaire de citations ne voit pas

Avant de jouer, un script liste chaque chaîne RETIRÉE par le diff (`git diff -U0 | grep "^-"`, littéraux entre
guillemets ou accents graves) et la cherche dans le harnais (`grep -rnF`) : vingt citations trouvées et mises à
jour. Il en a manqué deux, dans `web-alr.spec.ts` : le texte d'un gabarit EJS (« Un nouveau trajet correspond à
votre alerte ») n'est pas un littéral, le script ne pouvait pas l'extraire. La non-régression les a trouvées — la
preuve qu'un inventaire aide mais ne remplace pas le rejeu.

WEB-ACC-8 est tombée sur un `POST /auth/refresh` intermittent ; rejouée sans les correctifs (`git stash push --
apps/user-ui/src apps/user-ui/messages`), elle tombait aussi. La requête est la sonde de session du visiteur ; la
fiche l'exclut avec sa raison.

## Améliorations au GO : un lexique, une règle 7, et des fiches qui nettoient derrière elles

- **`scripts/lexique-yamba.json`** : les motifs (source + drapeaux) et leurs exceptions de sens, lus par
  `check-i18n-messages.mjs` (`new RegExp(r.motif, r.drapeaux)`) et par `web-voc.spec.ts` (`regle("fr", "vouvoiement")`).
  Avant, la liste des « vous » pluriels existait en deux copies — la première divergence aurait donné une CI verte et
  une recette rouge.
- **Règle 7** : `BOOKING_EVENT_TYPES` est lu dans le contrat (`api-contracts`) par expression régulière, et chaque type
  doit avoir `copy.<type_avec_underscores>.<SHIPPER|CARRIER>.{title,line}` (ou des sous-étapes pour
  `tracking_event`). Garde du garde : moins de 10 types lus → erreur.
- **VOC-3** crée une réservation puis l'annule dans un `finally` (`POST /deals/:id/cancel`) : une fiche qui
  consomme la capacité d'un trajet du jeu d'essai fausse silencieusement les chapitres joués après elle.
- **Relevé parallèle** : `await Promise.all([lireVisiteur(), lireExpeditrice(), lireVoyageur()])`, un onglet par
  compte ; `LANGUES = SUPPORTED_LOCALES` importé en relatif depuis `api-contracts/src/locale.ts` (fichier sans zod).
- **Refresh du visiteur : non fait**, voir le rapport — le marqueur localStorage n'est pas une preuve d'absence de
  session.

## Ce qui n'a PAS été touché, volontairement

Les messages d'erreur de l'API (deal-service) et l'OpenAPI disent « carrier » : c'est la surface publique en
anglais et le vocabulaire du code (CLAUDE.md). Le client ne les affiche jamais bruts (A146 : il traduit
`details.code`).

## Tests

Plateforme inchangée en nombre (**1000** + auth 230) ; notification-service 115 et trip-service 261 rejoués verts
après la réécriture des emails. `apps/e2e` : **321 scénarios** (314 + WEB-VOC ×7). Typecheck user-ui et harnais
verts ; i18n : règle 6 verte, contre-épreuve rouge comme attendu.
