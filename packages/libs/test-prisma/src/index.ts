/**
 * @packages/test-prisma — un client Prisma de test qui JOURNALISE d'où chaque appel vient
 * ========================================================================================
 * **Outil de TEST uniquement.** Rien ici n'est importé par du code de production : aucune de ces
 * fonctions ne doit apparaître dans un fichier de `apps/<service>/src` qui ne soit pas une fiche `.spec.ts`.
 *
 * ── Le problème qu'il résout ───────────────────────────────────────────────────────────────────
 *
 * Le patron de mock le plus répandu du dépôt est celui-ci :
 *
 *     $transaction: jest.fn(async (fn) => fn(prismaMock))
 *
 * Il passe **le même client** à l'intérieur de la transaction. Dedans et dehors deviennent alors
 * **indiscernables** : une écriture sortie de la transaction ne fait tomber aucune assertion. C'est
 * ainsi que D2 (« aucun changement d'état sans événement outbox dans la MÊME transaction ») a pu être
 * violée à trois endroits pendant des mois, sous 57 tests verts (A197).
 *
 * Deux conséquences secondaires du même patron, moins graves mais réelles :
 *
 *   1. `const prismaMock = { …, $transaction: (fn) => fn(prismaMock) }` se référence dans son propre
 *      initialiseur : TypeScript ne peut plus inférer son type (`TS7022` / `TS7024`) ;
 *   2. chaque fiche réécrit son mock, donc chaque fiche réinvente ses trous.
 *
 * ── Ce que cet outil fait à la place ───────────────────────────────────────────────────────────
 *
 * Chaque méthode de modèle est une fonction espionne qui **inscrit son appel dans un journal**, avec
 * le numéro de la transaction courante — ou `null` si l'appel a lieu **hors** transaction. Dedans et
 * dehors redeviennent distinguables, et on peut écrire des assertions sur l'ENDROIT d'une écriture,
 * pas seulement sur son existence.
 *
 *     const { prisma, appels, horsTransaction } = creerPrismaJournalise({
 *       modeles: ["booking", "outboxEvent"],
 *       retours: { "booking.updateMany": { count: 1 } },
 *     });
 *     jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prisma }));
 *     …
 *     expect(horsTransaction("outboxEvent", "create")).toHaveLength(0);
 *
 * ── Deux pièges du dépôt, déjà payés, encodés ici ──────────────────────────────────────────────
 *
 * - **Jamais `virtual: true`** sur le `jest.mock` de `@packages/libs/prisma` : le resolver Nx résout
 *   réellement ce module, et sous workers parallèles un mock « virtuel » posé sur un module résolu
 *   s'appliquait par intermittence — le VRAI `PrismaClient` partait alors en base (A199).
 * - **`export {};` en pied** de toute fiche qui n'a ni `import` ni `export` : sans lui, TypeScript la
 *   traite comme un SCRIPT et ses constantes se heurtent à celles des fiches voisines (TS2451,
 *   rapporté sur le fichier VOISIN). Cet outil s'importe, donc une fiche qui l'utilise est un module.
 */

/**
 * Un espion de test, décrit **structurellement**. La lib ne référence pas les types `jest` : elle
 * serait sinon impossible à typechecker depuis un projet qui la résout sans avoir chargé ces types
 * (payé une fois : `nx typecheck auth-service` tombait sur « Cannot find name 'jest' »). À
 * l'exécution, l'espion EST un `jest.fn` — donc toute la surface jest reste disponible côté fiche.
 */
export type EspionTest = ((...args: never[]) => unknown) & {
  mockReset: () => void;
  mockClear: () => void;
  mockImplementation: (f: (...args: never[]) => unknown) => unknown;
};

/**
 * `jest` est injecté par Jest dans la portée de CHAQUE module qu'il transforme (comme `require` ou
 * `module`) — ce n'est **pas** une propriété de `globalThis` : `globalThis.jest` est `undefined`, et
 * s'en servir fait tomber toute la fiche (payé une fois ici même). On le déclare donc localement,
 * au strict nécessaire : la déclaration satisfait TypeScript sans exiger `@types/jest` du projet qui
 * résout cette lib, et la liaison réelle reste celle que Jest injecte.
 */
declare const jest: { fn: (impl: (...args: never[]) => unknown) => EspionTest };

/** Fabrique un espion sans dépendre des TYPES jest. */
const espionner = (impl: (...args: never[]) => unknown): EspionTest => jest.fn(impl);

/** Un appel journalisé : quel modèle, quelle méthode, et dans quelle transaction (ou aucune). */
export type AppelJournalise = {
  modele: string;
  methode: string;
  /** Numéro de la transaction englobante (1, 2, …), ou `null` si l'appel a lieu HORS transaction. */
  transaction: number | null;
  /** Les arguments reçus, pour les assertions fines. */
  args: unknown[];
};

/** Les méthodes de modèle simulées. Ajouter ici profite à toutes les fiches d'un coup. */
export const METHODES_PRISMA = [
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
] as const;

/** Les méthodes dont un appel est une ÉCRITURE — donc un changement d'état potentiel. */
export const ECRITURES_PRISMA = new Set<string>([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);

export type OptionsPrismaJournalise = {
  /** Les modèles à simuler : `["booking", "trip", "outboxEvent"]`. */
  modeles: string[];
  /**
   * Les retours, par `"<modèle>.<méthode>"`. Une **fonction** est appelée avec les arguments de
   * l'appel, ce qui permet de faire dépendre le retour de l'entrée.
   * Tout ce qui n'est pas déclaré prend un défaut raisonnable (voir `retourParDefaut`).
   */
  retours?: Record<string, unknown>;
};

export type PrismaJournalise = {
  /**
   * Le client à passer à `jest.mock("@packages/libs/prisma", …)`. Chaque méthode est un **espion
   * jest** : `toHaveBeenCalledWith`, `mockResolvedValueOnce`, `mockRejectedValueOnce` fonctionnent.
   */
  prisma: Record<string, unknown>;
  /** Le journal, dans l'ordre des appels. Vidé par `reinitialiser()`. */
  appels: AppelJournalise[];
  /** Nombre de transactions ouvertes depuis la dernière réinitialisation. */
  transactionsOuvertes: () => number;
  /** Les appels correspondants, toutes transactions confondues. */
  appelsDe: (modele: string, methode?: string) => AppelJournalise[];
  /** Les appels faits **hors** de toute transaction — le cœur des assertions D2. */
  horsTransaction: (modele: string, methode?: string) => AppelJournalise[];
  /** Les appels faits dans la transaction n° `n`. */
  dansTransaction: (n: number, modele?: string, methode?: string) => AppelJournalise[];
  /** Vide le journal et remet les compteurs à zéro. À appeler dans `beforeEach`. */
  reinitialiser: () => void;
};

function retourParDefaut(modele: string, methode: string): unknown {
  if (methode === "findMany") return [];
  if (methode === "count") return 0;
  if (methode === "aggregate") return {};
  if (methode.startsWith("find")) return null;
  if (methode === "createMany" || methode.startsWith("update") || methode.startsWith("delete")) return { count: 1 };
  return { id: `${modele}-1` };
}

/**
 * Construit un client Prisma de test qui journalise la provenance de chaque appel.
 *
 * Le point décisif est `$transaction` : il incrémente un compteur AVANT d'appeler la fonction et le
 * restaure APRÈS (y compris si elle lève). Tout appel fait pendant porte ce numéro ; tout appel fait
 * avant ou après porte `null`. C'est cette seule différence qui rend D2 vérifiable.
 */
export function creerPrismaJournalise(options: OptionsPrismaJournalise): PrismaJournalise {
  const appels: AppelJournalise[] = [];
  const retours = options.retours ?? {};
  let transactionCourante: number | null = null;
  let compteur = 0;

  const prisma: Record<string, unknown> = {};

  /** L'implémentation journalisante d'une méthode — réinstallable, c'est tout l'intérêt. */
  const journalisante = (modele: string, methode: string) => async (...args: unknown[]) => {
    appels.push({ modele, methode, transaction: transactionCourante, args });
    const declare = retours[`${modele}.${methode}`];
    if (typeof declare === "function") return (declare as (...a: unknown[]) => unknown)(...args);
    return declare !== undefined ? declare : retourParDefaut(modele, methode);
  };

  const transactionnelle = () => async (fn: (tx: unknown) => Promise<unknown>) => {
    const precedente = transactionCourante;
    transactionCourante = ++compteur;
    try {
      return await fn(prisma);
    } finally {
      transactionCourante = precedente;
    }
  };

  for (const modele of options.modeles) {
    const objet: Record<string, unknown> = {};
    for (const methode of METHODES_PRISMA) {
      // De VRAIS espions jest : une fiche qui adopte cet outil garde ses `toHaveBeenCalledWith`,
      // ses `mockResolvedValueOnce` et ses `mockReset`. Le journal s'ajoute, il ne remplace rien.
      objet[methode] = espionner(journalisante(modele, methode) as (...a: never[]) => unknown);
    }
    prisma[modele] = objet;
  }

  prisma.$transaction = espionner(transactionnelle() as (...a: never[]) => unknown);

  const filtre = (modele: string, methode?: string) => (a: AppelJournalise) =>
    a.modele === modele && (methode === undefined || a.methode === methode);

  return {
    prisma,
    appels,
    transactionsOuvertes: () => compteur,
    appelsDe: (modele, methode) => appels.filter(filtre(modele, methode)),
    horsTransaction: (modele, methode) => appels.filter((a) => filtre(modele, methode)(a) && a.transaction === null),
    dansTransaction: (n, modele, methode) =>
      appels.filter((a) => a.transaction === n && (modele === undefined || filtre(modele, methode)(a))),
    reinitialiser: () => {
      appels.length = 0;
      transactionCourante = null;
      compteur = 0;
      // On RÉINSTALLE l'implémentation journalisante, on ne se contente pas de vider les compteurs.
      // Un test qui pose son propre `mockImplementation` (ou un `mockReset`) l'écraserait sinon
      // DÉFINITIVEMENT, et le test suivant hériterait d'une fermeture périmée en croyant repartir
      // de zéro. C'est la famille A199 : ce qui fuit ENTRE les fiches, pas dans l'une d'elles.
      for (const modele of options.modeles) {
        for (const methode of METHODES_PRISMA) {
          const espion = (prisma[modele] as Record<string, unknown>)[methode] as EspionTest;
          espion.mockReset();
          espion.mockImplementation(journalisante(modele, methode) as (...a: never[]) => unknown);
        }
      }
      const tx = prisma.$transaction as EspionTest;
      tx.mockReset();
      tx.mockImplementation(transactionnelle() as (...a: never[]) => unknown);
    },
  };
}

/**
 * La règle D2, sous forme de fonction : « aucun changement d'état sans son événement outbox, dans la
 * MÊME transaction ». Rend la liste des manquements, vide si la règle est tenue.
 *
 * Elle est PURE et exportée pour pouvoir être éprouvée elle-même : une garde qu'on n'a jamais vue
 * échouer n'est pas une garde, c'est un commentaire exécutable.
 */
export function manquementsD2(
  appels: AppelJournalise[],
  options: { modelesDEtat: Set<string>; modeleOutbox?: string }
): string[] {
  const outbox = options.modeleOutbox ?? "outboxEvent";
  const manquements: string[] = [];

  for (const a of appels) {
    if (a.modele === outbox && ECRITURES_PRISMA.has(a.methode) && a.transaction === null) {
      manquements.push(`${a.modele}.${a.methode} écrit HORS transaction`);
    }
    if (options.modelesDEtat.has(a.modele) && ECRITURES_PRISMA.has(a.methode) && a.transaction === null) {
      manquements.push(`${a.modele}.${a.methode} (changement d'état) écrit HORS transaction`);
    }
  }

  // Une transaction qui change un état DOIT porter l'événement qui l'annonce.
  const transactions = new Set(appels.map((a) => a.transaction).filter((t): t is number => t !== null));
  for (const t of transactions) {
    const dedans = appels.filter((a) => a.transaction === t);
    const changeUnEtat = dedans.some((a) => options.modelesDEtat.has(a.modele) && ECRITURES_PRISMA.has(a.methode));
    const porteUnEvenement = dedans.some((a) => a.modele === outbox && ECRITURES_PRISMA.has(a.methode));
    if (changeUnEtat && !porteUnEvenement) {
      manquements.push(`la transaction n° ${t} change un état sans écrire d'événement`);
    }
  }

  return manquements;
}
