/**
 * d2-une-transaction-par-geste.spec.ts — la règle D2, rendue EXÉCUTABLE (axe proposé en fin d'A195)
 * ==================================================================================================
 * Règle non négociable du dépôt : « aucun changement d'état sans événement outbox dans la MÊME
 * transaction ». Elle était écrite dans `CLAUDE.md`, dans l'en-tête du service, dans le registre — et
 * violée à trois endroits pendant des mois (proposer un rendez-vous, l'accepter, révéler un numéro
 * écrivaient leur état, PUIS l'événement dans une seconde transaction).
 *
 * Pourquoi personne ne l'a vu : les mocks de test font
 *
 *     $transaction: jest.fn(async (fn) => fn(prismaMock))
 *
 * c'est-à-dire qu'ils passent LE MÊME client à l'intérieur de la transaction. Dedans et dehors
 * deviennent alors indiscernables, et une écriture sortie de la transaction ne change aucune
 * assertion. Les tests vérifiaient QUELS événements partent — jamais OÙ ils sont écrits.
 *
 * Cette fiche corrige l'angle mort : le client de transaction est un client DISTINCT, chaque appel est
 * journalisé avec l'endroit d'où il vient, et deux propriétés sont vérifiées pour chaque geste du fil :
 *
 *   1. aucun `outboxEvent.create` hors transaction ;
 *   2. un geste = UNE transaction, qui contient l'écriture d'état ET son événement.
 *
 * Elle est délibérément écrite comme une règle, pas comme un scénario : un geste ajouté demain au
 * tableau `GESTES` est couvert sans qu'on y pense.
 */
type Appel = { modele: string; methode: string; transaction: number | null };

const appels: Appel[] = [];
let transactionCourante: number | null = null;
let transactionsOuvertes = 0;

/** Un modèle Prisma qui JOURNALISE d'où il est appelé (hors transaction = `transaction: null`). */
function modele(nom: string, retours: Record<string, unknown> = {}) {
  const methodes = ["create", "createMany", "update", "updateMany", "delete", "deleteMany", "findUnique", "findUniqueOrThrow", "findFirst", "findMany", "count"];
  const objet: Record<string, unknown> = {};
  for (const methode of methodes) {
    objet[methode] = jest.fn(async () => {
      appels.push({ modele: nom, methode, transaction: transactionCourante });
      return retours[methode] ?? retourParDefaut(nom, methode);
    });
  }
  return objet;
}

function retourParDefaut(nom: string, methode: string): unknown {
  if (methode.startsWith("findMany")) return [];
  if (methode === "count") return 0;
  if (methode.startsWith("update") || methode.startsWith("delete")) return { count: 1 };
  if (nom === "message" && methode === "create") return { id: MESSAGE, conversationId: CONV, kind: "TEXT", authorId: SHIPPER, authorRole: "SHIPPER", body: "bonjour", photoUrls: [], systemKey: null, systemData: null, flaggedContact: false, createdAt: T0 };
  return {};
}

const MESSAGE = "64b00000000000000000dd01";
const CONV = "64b00000000000000000c001";
const BOOKING = "64b00000000000000000b001";
const SHIPPER = "64b0000000000000000000a1";
const CARRIER = "64b0000000000000000000b1";
const MEETUP = "64b00000000000000000ee01";
const T0 = new Date("2026-09-17T08:00:00.000Z");
const DEPART = new Date("2026-09-17T09:00:00.000Z");

const prismaMock: Record<string, unknown> = {
  conversation: modele("conversation"),
  booking: modele("booking"),
  user: modele("user"),
  message: modele("message"),
  meetup: modele("meetup"),
  phoneReveal: modele("phoneReveal"),
  outboxEvent: modele("outboxEvent"),
  report: modele("report"),
  // Le client de transaction est un client À PART : c'est tout l'intérêt de cette fiche.
  $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const precedente = transactionCourante;
    transactionCourante = ++transactionsOuvertes;
    try {
      return await fn(prismaMock);
    } finally {
      transactionCourante = precedente;
    }
  }),
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));

import { makeConversationService } from "./conversation.service";

const settings = { get: async () => ({ "messaging.writeDaysAfterEnd": 14, "messaging.phoneRevealLeadHours": 2 }) } as never;
const service = makeConversationService(() => T0, settings);

/** Les modèles dont une écriture EST un changement d'état du domaine « messagerie ». */
const ETAT = new Set(["meetup", "phoneReveal", "message"]);
const ECRITURES = new Set(["create", "createMany", "update", "updateMany", "delete", "deleteMany"]);

/** Les gestes qui émettent un événement de domaine, donc soumis à D2. */
const GESTES: Array<{ nom: string; jouer: () => Promise<unknown> }> = [
  { nom: "poster un message", jouer: () => service.postMessage(SHIPPER, CONV, { body: "bonjour" } as never) },
  {
    nom: "proposer un rendez-vous",
    jouer: () =>
      service.proposeMeetup(SHIPPER, CONV, { kind: "PICKUP", placeLabel: "Gare de Lyon", startAt: "2026-09-17T08:30:00.000Z", endAt: "2026-09-17T08:45:00.000Z" } as never),
  },
  { nom: "accepter un rendez-vous", jouer: () => service.acceptMeetup(CARRIER, CONV, MEETUP) },
  { nom: "révéler le numéro", jouer: () => service.revealPhone(SHIPPER, CONV) },
];

beforeEach(() => {
  appels.length = 0;
  transactionCourante = null;
  transactionsOuvertes = 0;
  jest.clearAllMocks();

  const conversation = { id: CONV, bookingId: BOOKING, shipperLastReadAt: null, carrierLastReadAt: null };
  (prismaMock.conversation as Record<string, jest.Mock>).findUnique.mockImplementation(async () => {
    appels.push({ modele: "conversation", methode: "findUnique", transaction: transactionCourante });
    return conversation;
  });
  (prismaMock.booking as Record<string, jest.Mock>).findFirst.mockImplementation(async () => {
    appels.push({ modele: "booking", methode: "findFirst", transaction: transactionCourante });
    return { id: BOOKING, status: "ACCEPTED", shipperId: SHIPPER, carrierId: CARRIER, acceptedAt: T0, completedAt: null, closedAt: null, deliveryCodeHash: null, trip: { originCity: "Paris", destinationCity: "Brazzaville", departureAt: DEPART } };
  });
  (prismaMock.message as Record<string, jest.Mock>).findUniqueOrThrow.mockImplementation(async () => {
    appels.push({ modele: "message", methode: "findUniqueOrThrow", transaction: transactionCourante });
    return retourParDefaut("message", "create");
  });
  const rdv = { id: MEETUP, conversationId: CONV, bookingId: BOOKING, kind: "PICKUP", status: "PROPOSED", proposedByRole: "SHIPPER", proposedById: SHIPPER, placeLabel: "Gare de Lyon", placeDetails: null, startAt: new Date("2026-09-17T08:30:00.000Z"), endAt: new Date("2026-09-17T08:45:00.000Z"), acceptedAt: null, cancelledAt: null, createdAt: T0 };
  for (const m of ["findFirst", "findUniqueOrThrow", "create"]) {
    (prismaMock.meetup as Record<string, jest.Mock>)[m].mockImplementation(async () => {
      appels.push({ modele: "meetup", methode: m, transaction: transactionCourante });
      return rdv;
    });
  }
  (prismaMock.meetup as Record<string, jest.Mock>).findMany.mockImplementation(async () => {
    appels.push({ modele: "meetup", methode: "findMany", transaction: transactionCourante });
    return [{ ...rdv, status: "ACCEPTED" }];
  });
  (prismaMock.user as Record<string, jest.Mock>).findUniqueOrThrow.mockImplementation(async () => {
    appels.push({ modele: "user", methode: "findUniqueOrThrow", transaction: transactionCourante });
    return { firstName: "Thomas", phoneE164: "+33612345678" };
  });
  (prismaMock.phoneReveal as Record<string, jest.Mock>).findUnique.mockImplementation(async () => {
    appels.push({ modele: "phoneReveal", methode: "findUnique", transaction: transactionCourante });
    return null;
  });
});

describe("D2, exécutable — un geste, une transaction, l'état et son événement dedans", () => {
  it.each(GESTES)("$nom", async ({ jouer }) => {
    await jouer();

    const evenements = appels.filter((a) => a.modele === "outboxEvent" && a.methode === "create");
    const ecrituresEtat = appels.filter((a) => ETAT.has(a.modele) && ECRITURES.has(a.methode));

    // 1. Un geste du domaine écrit son événement — et JAMAIS hors transaction.
    expect(evenements).toHaveLength(1);
    expect(evenements[0].transaction).not.toBeNull();

    // 2. Tout changement d'état est dans une transaction, et dans LA MÊME que l'événement.
    expect(ecrituresEtat.length).toBeGreaterThan(0); // un geste qui n'écrit rien n'est pas un geste
    for (const ecriture of ecrituresEtat) {
      // Le message dit QUELLE écriture a fui, sinon un échec est illisible.
      expect({ ecriture: `${ecriture.modele}.${ecriture.methode}`, transaction: ecriture.transaction }).toEqual({
        ecriture: `${ecriture.modele}.${ecriture.methode}`,
        transaction: evenements[0].transaction,
      });
    }

    // 3. Une seule transaction ouverte : deux transactions, c'est un état commité sans son événement
    //    si la seconde échoue — exactement le défaut trouvé en A195.
    expect(transactionsOuvertes).toBe(1);
  });

  it("le marqueur de lecture n'est PAS un changement d'état du domaine : aucune transaction, aucun événement", async () => {
    await service.markRead(SHIPPER, CONV);

    expect(appels.filter((a) => a.modele === "outboxEvent")).toHaveLength(0);
    expect(transactionsOuvertes).toBe(0);
  });

  it("la fiche elle-même est honnête : le client de transaction se distingue du client de base", async () => {
    // Si ce test tombait, toutes les assertions ci-dessus seraient creuses (c'est ce qui a permis
    // à la violation de D2 de vivre des mois dans le dépôt).
    await service.markRead(SHIPPER, CONV);
    const horsTransaction = appels.filter((a) => a.transaction === null);
    expect(horsTransaction.length).toBeGreaterThan(0);

    appels.length = 0;
    await service.postMessage(SHIPPER, CONV, { body: "bonjour" } as never);
    expect(appels.some((a) => a.transaction !== null)).toBe(true);
  });
});
