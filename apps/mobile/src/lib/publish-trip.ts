/**
 * publish-trip.ts — publier un trajet : les règles, loin de tout écran.
 * ======================================================================
 * Le site compose « Créer un trajet » en 6 436 lignes réparties sur vingt et
 * un fichiers, dont la moitié des règles vit À L'INTÉRIEUR des composants
 * (`create-trip.config.ts` en garde une partie, `StepTrip.tsx` le reste).
 * Ici elles vivent DEHORS, pour la raison d'A223 : une règle qu'on veut
 * tester sort de l'écran. Ce fichier n'importe RIEN — ni `react-native`, ni
 * le contrat Zod, ni même une constante de thème — parce que le harnais
 * (`testEnvironment: node`) ne sait traverser ni `expo-constants` ni Metro.
 *
 * ⚠️ IL NE LIT PAS L'HORLOGE. Toute fonction qui dépend du temps reçoit
 * `maintenant` en argument : une règle qui appelle `new Date()` se teste à la
 * seconde près, donc ne se teste pas (la leçon des fiches de `search-date`).
 *
 * LE BROUILLON PARLE LA LANGUE DU CONTRAT, pas celle de l'écran. Le site
 * garde `"plane"` / `"oneWay"` puis convertit en `PLANE` / `ONE_WAY` dans un
 * mapper de 318 lignes (`create-trip.mapper.ts`) : une table de traduction
 * est un endroit où des défauts se logent, et elle existait seulement parce
 * que le formulaire web était plus vieux que le contrat. Le téléphone écrit
 * d'emblée `PLANE`, `WITH_LAYOVER`, `CITY_AREA` — les mots que le serveur
 * attend (`createTripSchema`, trip-service).
 *
 * CE QUI N'EST PAS ICI, ET POURQUOI :
 *   • « Aller simple / Aller-retour » — le site propose le choix, le mapper
 *     envoie `returnDepartureAt: null` DANS TOUS LES CAS et aucun second
 *     trajet n'est créé : « Aller-retour » n'ajoute qu'un mot sur la fiche du
 *     Voyageur. Un contrôle qui affirme ce que le produit ne fait pas est le
 *     défaut de D100 ; on ne le transpose pas. Le tunnel natif publie un
 *     trajet, et le retour se publie comme un second trajet ;
 *   • le prix suggéré (corridor × modificateurs) — il a besoin du code pays
 *     et des coordonnées du lieu, que le relais Places (A211) ne rend pas
 *     encore. Lot suivant, avec la décision qui va avec.
 */

/* ── Le vocabulaire du contrat ─────────────────────────────────────────── */

export type TransportMode = 'PLANE' | 'TRAIN' | 'CAR';

/**
 * Le sous-type du voyage — UN champ ici, TROIS côté serveur
 * (`flightType`, `trainTripType`, `carTripFlexibility`), qui s'excluent
 * mutuellement. Trois champs dont deux sont toujours nuls, c'est trois
 * occasions de se tromper : l'écran n'en manipule qu'un, et
 * `sousTypePourLApi` rend les trois au moment de l'envoi.
 */
export type SousType = 'DIRECT' | 'WITH_LAYOVER' | 'WITH_CONNECTION' | 'DETOUR_BY_AGREEMENT';

/** Les sous-types proposés par mode, dans l'ordre d'affichage. */
export const SOUS_TYPES: Record<TransportMode, readonly SousType[]> = {
  PLANE: ['DIRECT', 'WITH_LAYOVER'],
  TRAIN: ['DIRECT', 'WITH_CONNECTION'],
  CAR: ['DIRECT', 'DETOUR_BY_AGREEMENT'],
};

/** Les trois modes, dans l'ordre d'affichage (celui du site). */
export const MODES: readonly TransportMode[] = ['PLANE', 'TRAIN', 'CAR'];

/** Le sous-type, éclaté dans les trois champs du contrat. */
export function sousTypePourLApi(
  mode: TransportMode | null,
  sousType: SousType | null
): { flightType: string | null; trainTripType: string | null; carTripFlexibility: string | null } {
  const vide = { flightType: null, trainTripType: null, carTripFlexibility: null };
  if (mode === null || sousType === null) return vide;
  if (!SOUS_TYPES[mode].includes(sousType)) return vide;
  if (mode === 'PLANE') return { ...vide, flightType: sousType };
  if (mode === 'TRAIN') return { ...vide, trainTripType: sousType };
  return { ...vide, carTripFlexibility: sousType };
}

/** Un sous-type qui réclame de nommer les villes traversées. */
export function demandeDesEscales(mode: TransportMode | null, sousType: SousType | null): boolean {
  if (mode === 'PLANE') return sousType === 'WITH_LAYOVER';
  if (mode === 'TRAIN') return sousType === 'WITH_CONNECTION';
  return false;
}

/* ── Les familles de colis (D14 / CAT-02) ──────────────────────────────── */

export type ParcelFamily =
  | 'DOCUMENTS_PAPERS'
  | 'CLOTHES_TEXTILE'
  | 'FOOD_DRY_SEALED'
  | 'ELECTRONICS_DEVICES'
  | 'COSMETICS_CARE'
  | 'PARTS_TOOLS'
  | 'TOYS_CHILDCARE'
  | 'MISC_ACCESSORIES';

export type FamilyMode = 'ACCEPT' | 'SURCHARGE' | 'REFUSE';

export type ConditionFamille = { mode: FamilyMode; surchargePct: number };

/** Le supplément proposé par défaut quand on bascule une famille (site : 20 %). */
export const SURCHARGE_PAR_DEFAUT = 20;

/* ── Les lieux (le Voyageur dit où l'échange se fait) ──────────────────── */

export type LocationKind = 'AIRPORT' | 'TRAIN_STATION' | 'CITY_AREA';
export type LocationFlexibility = 'EXACT' | 'RADIUS' | 'CITY_WIDE';

export type LieuBrouillon = {
  kind: LocationKind;
  actif: boolean;
  details: string;
  flexibility: LocationFlexibility;
  radiusKm: number | null;
};

/**
 * Les lieux proposés d'office selon le mode — mêmes cartes que le site :
 * avion → aéroport (actif) + ville (en réserve) ; train → gare + ville ;
 * voiture → la ville seule, dans un rayon.
 *
 * Les cartes ÉTEINTES restent dans la liste (et non supprimées) : c'est ce
 * qui permet de les rallumer d'un geste sans rien reconstruire, et c'est
 * aussi ce qui garde l'état stable quand on change d'avis deux fois.
 */
export function lieuxParDefaut(mode: TransportMode): LieuBrouillon[] {
  if (mode === 'CAR') {
    return [{ kind: 'CITY_AREA', actif: true, details: '', flexibility: 'RADIUS', radiusKm: 10 }];
  }
  const principal: LocationKind = mode === 'PLANE' ? 'AIRPORT' : 'TRAIN_STATION';
  return [
    { kind: principal, actif: true, details: '', flexibility: 'EXACT', radiusKm: null },
    { kind: 'CITY_AREA', actif: false, details: '', flexibility: 'RADIUS', radiusKm: 10 },
  ];
}

/**
 * Les souplesses proposées pour un lieu, selon sa NATURE.
 *
 * Un aéroport ou une gare est un point : « exact » y veut dire quelque chose,
 * et un rayon de 20 km autour d'une gare n'est plus une gare. Une zone de
 * ville, elle, n'a pas de point : lui proposer « exact » serait proposer un
 * choix qui ne veut rien dire — c'est pour cela que la liste dépend du lieu
 * plutôt que d'être la même partout (le site propose les cinq au même
 * endroit, dont deux absurdes selon la carte).
 */
export function flexibilitesPour(
  kind: LocationKind
): readonly { flexibility: LocationFlexibility; radiusKm: number | null }[] {
  if (kind === 'CITY_AREA') {
    return [
      { flexibility: 'RADIUS', radiusKm: 5 },
      { flexibility: 'RADIUS', radiusKm: 10 },
      { flexibility: 'RADIUS', radiusKm: 20 },
      { flexibility: 'CITY_WIDE', radiusKm: null },
    ];
  }
  return [
    { flexibility: 'EXACT', radiusKm: null },
    { flexibility: 'RADIUS', radiusKm: 5 },
    { flexibility: 'RADIUS', radiusKm: 10 },
  ];
}

/** Deux souplesses sont la même quand leur nature ET leur rayon coïncident. */
export function memeFlexibilite(
  a: { flexibility: LocationFlexibility; radiusKm: number | null },
  b: { flexibility: LocationFlexibility; radiusKm: number | null }
): boolean {
  return a.flexibility === b.flexibility && (a.radiusKm ?? null) === (b.radiusKm ?? null);
}

/* ── Le brouillon ──────────────────────────────────────────────────────── */

/**
 * Une ville choisie. Le relais Places (A211) ne rend que deux chaînes —
 * « Paris » et son contexte « France » —, jamais de `placeId`, de code pays
 * ni de coordonnées, là où le site les obtient du SDK Google qu'il charge
 * dans le navigateur. Le téléphone envoie donc ville + pays + libellé, et
 * laisse les champs géographiques nuls : ce que le client ne SAIT pas, il ne
 * l'invente pas.
 */
/** Ce que `POST /trips/:id/documents` attend — rendu par le téléversement. */
export type DocumentDuBillet = {
  url: string;
  fileId: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
};

export type VilleChoisie = {
  /** « Paris » — c'est ce champ que le serveur exige (`originCity`). */
  ville: string;
  /** « France » — tel que Google le nomme, dans la langue du lecteur. */
  pays: string;
  /** « Paris, France » — le libellé affiché, tel quel. */
  libelle: string;
  /** L'identifiant Google, vide pour une saisie libre. */
  placeId: string;
  /**
   * D111 ter — ce que `GET /places/details` ajoute APRÈS le choix, et qui
   * ouvre la fourchette de prix : le code pays donne la ZONE du corridor,
   * les coordonnées donnent la distance.
   *
   * Tout est nullable, et c'est le point : une saisie libre, un service muet
   * ou une ville sans pays laissent ces champs à `null`, et le calcul
   * retombe sur sa base de repli. Ce que le client ne SAIT pas, il ne
   * l'invente pas — et l'écran le dit plutôt que de présenter une médiane
   * qui aurait l'air mesurée.
   */
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
};

export type PublishDraft = {
  mode: TransportMode | null;
  sousType: SousType | null;
  /** Villes traversées, telles que tapées (« Istanbul, Dubaï ») — séparées à l'envoi. */
  escales: string;

  depart: VilleChoisie | null;
  arrivee: VilleChoisie | null;

  /** `yyyy-mm-dd`, jamais un `Date` : une date de calendrier n'a pas d'heure,
   *  et un `Date` en traîne une qui dérive d'un fuseau à l'autre. */
  dateDepart: string | null;
  /** `HH:mm`. */
  heureDepart: string;
  dateArrivee: string | null;
  heureArrivee: string;

  /** La référence du billet (optionnelle) — elle ouvre le badge « Voyage vérifié ». */
  reference: string;
  /** Le billet déjà TÉLÉVERSÉ (ImageKit), prêt à être attaché au trajet.
   *  Il est envoyé dès qu'il est choisi, pas au moment de publier : un échec
   *  d'image doit se voir quand on l'ajoute, pas sous le bouton « Publier ». */
  billet: DocumentDuBillet | null;

  /* ── Conditions (lot suivant) ── */
  prixParKiloEur: number | null;
  capaciteKg: number | null;
  forfaitSouteEur: number | null;
  forfaitCabineEur: number | null;
  familles: Record<ParcelFamily, ConditionFamille>;
  lieuxRemise: LieuBrouillon[];
  lieuxLivraison: LieuBrouillon[];
  remiseEnMainPropre: boolean;
  reservationInstantanee: boolean;
  notes: string;
};

export const FAMILLES: readonly ParcelFamily[] = [
  'DOCUMENTS_PAPERS',
  'CLOTHES_TEXTILE',
  'FOOD_DRY_SEALED',
  'ELECTRONICS_DEVICES',
  'COSMETICS_CARE',
  'PARTS_TOOLS',
  'TOYS_CHILDCARE',
  'MISC_ACCESSORIES',
];

export function famillesParDefaut(): Record<ParcelFamily, ConditionFamille> {
  const toutes = {} as Record<ParcelFamily, ConditionFamille>;
  for (const famille of FAMILLES) {
    toutes[famille] = { mode: 'ACCEPT', surchargePct: SURCHARGE_PAR_DEFAUT };
  }
  return toutes;
}

/* ── Le temps, reçu et non lu ──────────────────────────────────────────── */

/** `2026-11-25` — la date LOCALE de l'appareil, pas son UTC (d'où le découpage à la main). */
export function dateIso(jour: Date): string {
  const mois = String(jour.getMonth() + 1).padStart(2, '0');
  const quantieme = String(jour.getDate()).padStart(2, '0');
  return `${jour.getFullYear()}-${mois}-${quantieme}`;
}

/** Le départ proposé d'office : demain (le site fait le même choix). */
export function dateDepartParDefaut(maintenant: Date): string {
  const demain = new Date(maintenant.getTime());
  demain.setDate(demain.getDate() + 1);
  return dateIso(demain);
}

/** L'heure proposée d'office : la prochaine heure pleine. */
export function heureParDefaut(maintenant: Date): string {
  return `${String((maintenant.getHours() + 1) % 24).padStart(2, '0')}:00`;
}

/** Deux dates ISO se comparent comme deux chaînes — c'est pour cela qu'on les garde ISO. */
export function estDansLePasse(dateIsoJour: string, maintenant: Date): boolean {
  return dateIsoJour < dateIso(maintenant);
}

/** `HH:mm`, et rien d'autre : « 7:5 », « 25:00 » ou « ab:cd » sont refusés. */
export function heureValide(heure: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(heure)) return false;
  const [h, m] = heure.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/**
 * L'HEURE QUI SE TAPE — pourquoi pas le sélecteur de l'OS.
 *
 * Même arbitrage qu'A207 pour le calendrier : le `DateTimePicker` natif
 * ouvre un DIALOGUE sur Android et une roue en ligne sur iOS (deux parcours
 * pour une même étape), ne se teinte pas à la charte, et surtout il fait
 * FAIRE TOURNER une roue à quelqu'un qui CONNAÎT son heure de départ —
 * « 21:35 » se tape en quatre chiffres, il ne s'explore pas. Le clavier
 * numérique est donc le bon geste, à condition que la saisie se mette en
 * forme toute seule : c'est ce que fait `masqueHeure` à chaque frappe, et
 * `normaliseHeure` quand le champ perd le focus.
 *
 * Zéro dépendance ajoutée, et une règle que le harnais peut lire.
 */

/** Ce qui s'affiche PENDANT la frappe : « 2135 » → « 21:35 », « 9 » → « 9 ». */
export function masqueHeure(saisie: string): string {
  const chiffres = saisie.replace(/\D/g, '').slice(0, 4);
  if (chiffres.length <= 2) return chiffres;
  return `${chiffres.slice(0, 2)}:${chiffres.slice(2)}`;
}

/**
 * Ce qui RESTE quand on quitte le champ : toujours `HH:mm`, ou «  » si la
 * saisie ne dit rien. « 9 » devient « 09:00 », « 930 » devient « 09:30 »,
 * « 2561 » est ramené à « 23:59 » — on ne refuse pas une frappe, on la
 * ramène dans le monde réel.
 */
export function normaliseHeure(saisie: string): string {
  const chiffres = saisie.replace(/\D/g, '').slice(0, 4);
  if (chiffres.length === 0) return '';
  // 1 ou 2 chiffres = une heure pleine ; 3 chiffres = « 9h30 » écrit court.
  const [h, m] =
    chiffres.length <= 2
      ? [Number(chiffres), 0]
      : chiffres.length === 3
        ? [Number(chiffres.slice(0, 1)), Number(chiffres.slice(1))]
        : [Number(chiffres.slice(0, 2)), Number(chiffres.slice(2))];
  const heures = Math.min(Math.max(h, 0), 23);
  const minutes = Math.min(Math.max(m, 0), 59);
  return `${String(heures).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/* ── Ce qui manque, nommé ──────────────────────────────────────────────── */

/**
 * Les manques de la première phase, DANS L'ORDRE DE L'ÉCRAN.
 *
 * On rend des clés, jamais des phrases : la phrase est au dictionnaire, dans
 * les deux langues. Et on rend une LISTE plutôt qu'un booléen parce que le
 * bouton reste actif et NOMME ce qui manque (doctrine A209) — un bouton gris
 * ne dit pas pourquoi il est gris.
 */
export type Manque =
  | 'mode'
  | 'sousType'
  | 'escales'
  | 'depart'
  | 'arrivee'
  | 'memeVille'
  | 'dateDepart'
  | 'dateDepartPassee'
  | 'heureDepart'
  | 'dateArrivee'
  | 'arriveeAvantDepart'
  | 'heureArrivee';

export function manquesVoyage(draft: PublishDraft, maintenant: Date): Manque[] {
  const manques: Manque[] = [];

  if (draft.mode === null) manques.push('mode');
  else if (draft.sousType === null) manques.push('sousType');
  else if (demandeDesEscales(draft.mode, draft.sousType) && draft.escales.trim().length === 0) {
    manques.push('escales');
  }

  if (draft.depart === null) manques.push('depart');
  if (draft.arrivee === null) manques.push('arrivee');
  // Un trajet qui part et arrive au même endroit n'est pas un trajet. Le site
  // ne le vérifie nulle part — le serveur non plus.
  if (
    draft.depart !== null &&
    draft.arrivee !== null &&
    memeVille(draft.depart.ville, draft.arrivee.ville)
  ) {
    manques.push('memeVille');
  }

  if (draft.dateDepart === null) manques.push('dateDepart');
  else if (estDansLePasse(draft.dateDepart, maintenant)) manques.push('dateDepartPassee');

  if (!heureValide(draft.heureDepart)) manques.push('heureDepart');

  if (draft.dateArrivee === null) manques.push('dateArrivee');
  else if (draft.dateDepart !== null && draft.dateArrivee < draft.dateDepart) {
    manques.push('arriveeAvantDepart');
  }

  if (!heureValide(draft.heureArrivee)) manques.push('heureArrivee');

  return manques;
}

/** « paris » et « Paris » sont la même ville ; les accents, eux, restent. */
function memeVille(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/**
 * Quel écran porte quel manque.
 *
 * La liste complète est rendue par `manquesVoyage`, mais un écran ne doit
 * JAMAIS reprocher ce qui se saisit ailleurs : un bouton qui refuse d'avancer
 * en nommant un champ invisible est une impasse. La répartition est donc
 * écrite ici, une fois — et une fiche vérifie qu'elle couvre chaque manque
 * EXACTEMENT une fois : un manque oublié ne bloquerait nulle part et
 * referait surface à la publication, c'est-à-dire trop tard.
 */
export const MANQUES_PAR_ECRAN: Record<1 | 2, readonly Manque[]> = {
  // ① « Ton voyage » — le mode, son type, et les deux villes. Les écrans ①
  // et ② d'origine ont FUSIONNÉ : trois taps d'un côté, deux lignes de
  // l'autre, et les deux tiers de chaque écran vides. Du blanc est une
  // respiration quand la décision est lourde ; ici elle ne l'était pas.
  1: ['mode', 'sousType', 'escales', 'depart', 'arrivee', 'memeVille'],
  // ② « Quand pars-tu ? »
  2: [
    'dateDepart',
    'dateDepartPassee',
    'heureDepart',
    'dateArrivee',
    'arriveeAvantDepart',
    'heureArrivee',
  ],
};

/** Les manques que CET écran a le droit de reprocher, dans l'ordre. */
export function manquesDeLEcran(
  ecran: 1 | 2,
  draft: PublishDraft,
  maintenant: Date
): Manque[] {
  const permis = MANQUES_PAR_ECRAN[ecran];
  return manquesVoyage(draft, maintenant).filter((manque) => permis.includes(manque));
}

/**
 * Ce qui manque aux LIEUX (écran ⑥).
 *
 * Le serveur n'exige un lieu qu'À LA PUBLICATION (`createTripSchema`,
 * `publish === true`) : un brouillon sans lieu est accepté. L'écran, lui,
 * le réclame avant — parce qu'un Voyageur qui arrive à la dernière étape et
 * découvre qu'il lui manque un lieu quatre écrans plus tôt a parcouru le
 * tunnel pour rien.
 */
export type ManqueLieu = 'lieuRemise' | 'lieuLivraison';

export function manquesLieux(draft: Pick<PublishDraft, 'lieuxRemise' | 'lieuxLivraison'>): ManqueLieu[] {
  const manques: ManqueLieu[] = [];
  if (!draft.lieuxRemise.some((lieu) => lieu.actif)) manques.push('lieuRemise');
  if (!draft.lieuxLivraison.some((lieu) => lieu.actif)) manques.push('lieuLivraison');
  return manques;
}

/**
 * TOUT ce qui manque au trajet, écran par écran — la liste que le dernier
 * écran doit lire AVANT d'appeler le serveur.
 *
 * Pourquoi ici et pas dans `review.tsx` : le dernier écran est le seul qui
 * engage, et c'est précisément là qu'un oubli coûte le plus cher (sept
 * écrans parcourus pour un refus). La règle sort donc de l'écran, comme les
 * autres, pour qu'une fiche puisse la jouer.
 *
 * L'offre (prix, capacité) est réclamée par `manquesOffre` dans
 * `publish-pricing.ts` — elle ne remonte pas ici pour que ce fichier reste
 * sans dépendance ; l'écran de vérification concatène les deux.
 */
export function manquesDuTunnel(draft: PublishDraft, maintenant: Date): (Manque | ManqueLieu)[] {
  return [...manquesVoyage(draft, maintenant), ...manquesLieux(draft)];
}

/**
 * LE RETOUR, préparé depuis l'aller.
 *
 * Le site propose « Aller-retour » et ne crée jamais le second trajet (son
 * mapper envoie `returnDepartureAt: null` dans les deux cas) : le Voyageur
 * croit avoir annoncé son retour, et aucun Expéditeur ne le trouvera. Plutôt
 * que de transposer ce mensonge, le tunnel propose le retour APRÈS la
 * publication — et il le publie pour de vrai, comme un second trajet.
 *
 * Ce qui s'inverse : les deux villes, et les deux listes de lieux. Un lieu de
 * REMISE était à Paris, il devient un lieu de LIVRAISON à Paris : c'est la
 * même gare, le même terminal, le même café — seul le sens de l'échange
 * change. Ne pas les inverser ferait proposer l'aéroport de départ comme
 * point de récupération à l'arrivée.
 *
 * Ce qui se garde : le mode, le type, les villes traversées, le prix, la
 * capacité, les familles, les forfaits, les options et le mot. C'est tout
 * l'intérêt : il ne reste QUE les dates à poser.
 *
 * Ce qui s'efface : les dates, les heures, et la référence du billet — un
 * retour est un autre billet.
 */
export function preparerLeRetour(aller: PublishDraft): PublishDraft {
  return {
    ...aller,
    depart: aller.arrivee,
    arrivee: aller.depart,
    lieuxRemise: aller.lieuxLivraison,
    lieuxLivraison: aller.lieuxRemise,
    dateDepart: null,
    heureDepart: '',
    dateArrivee: null,
    heureArrivee: '',
    reference: '',
    billet: null,
  };
}

/** Un retour n'a de sens que si l'aller portait ses deux villes. */
export function retourPossible(aller: PublishDraft): boolean {
  return aller.depart !== null && aller.arrivee !== null;
}

/* ── Les trois phases annoncées ────────────────────────────────────────── */

/**
 * Le tunnel compte SIX écrans et n'en annonce JAMAIS le nombre — l'arbitrage
 * du parcours de réservation (A213), pour la même raison : « étape 1 sur 7 »
 * lu avant d'avoir rien saisi est un départ. Il annonce les TROIS phases du
 * site, mot pour mot, et la jauge avance à chaque écran.
 */
export const PHASES_PUBLICATION = [
  { cle: 'trip', dernierEcran: 2 },
  { cle: 'conditions', dernierEcran: 5 },
  { cle: 'review', dernierEcran: 6 },
] as const;

export const ECRANS_PUBLICATION = 6;

export function phaseDeLEcran(ecran: number): { cle: string; rang: number } {
  const rang = PHASES_PUBLICATION.findIndex((phase) => ecran <= phase.dernierEcran);
  const sur = rang === -1 ? PHASES_PUBLICATION.length - 1 : rang;
  return { cle: PHASES_PUBLICATION[sur].cle, rang: sur };
}
