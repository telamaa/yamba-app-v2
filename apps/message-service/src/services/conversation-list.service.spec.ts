/**
 * conversation-list.service.spec.ts — D124 : un fil existe parce que le DEAL le dit.
 * ==================================================================================
 * Le défaut, mesuré EN BASE le 28/11/2026 sur un compte réel : trois deals
 * engagés (un `PICKED_UP`, deux `COMPLETED`), **zéro conversation**, et l'onglet
 * Messages qui affiche « Aucune conversation » — juste au-dessus de sa propre
 * phrase, « Un fil s'ouvre dès qu'une demande est acceptée ».
 *
 * Les deux mécanismes étaient corrects pris séparément :
 *
 *   • `conversationExists` dit que le fil existe pour SIX statuts de deal ;
 *   • la ligne `Conversation` n'est écrite qu'à la PREMIÈRE ouverture du fil
 *     (création paresseuse, assumée, son commentaire le dit).
 *
 * Mais `list()` n'interrogeait que la collection. **La règle disait « il
 * existe », le stockage disait « pas encore », et c'est le stockage qui parlait
 * à l'écran.** C'est le piège null-vs-absent de ce dépôt, transposé à un écran :
 * le vide d'une collection voulait dire deux choses.
 *
 * Cette fiche tient les quatre promesses du lot : la liste part des DEALS, elle
 * n'ÉCRIT rien, un fil jamais ouvert se présente sans identifiant (on l'ouvre
 * par son deal), et l'ordre ne dépend plus d'un dernier message qui peut ne pas
 * exister.
 */
const prismaMock = {
  conversation: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  booking: { findMany: jest.fn(), findFirst: jest.fn() },
  user: { findMany: jest.fn(), findUnique: jest.fn() },
  meetup: { findMany: jest.fn() },
  message: { findMany: jest.fn(), count: jest.fn() },
  phoneReveal: { findUnique: jest.fn() },
  outboxEvent: { create: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));

import { makeConversationService } from "./conversation.service";
import { CONVERSATION_OPEN_STATUSES } from "../lib/conversation.rules";

const T0 = new Date("2026-11-28T08:00:00.000Z");
const MOI = "64b0000000000000000000a1";
const AUTRE = "64b0000000000000000000b1";

const settings = { get: async () => ({ "messaging.writeDaysAfterEnd": 14, "messaging.phoneRevealLeadHours": 2 }) } as never;
const service = makeConversationService(() => T0, settings);

function deal(extra: Record<string, unknown> = {}) {
  return {
    id: "64b00000000000000000b001",
    status: "PICKED_UP",
    shipperId: AUTRE,
    carrierId: MOI,
    acceptedAt: new Date("2026-11-20T08:00:00.000Z"),
    createdAt: new Date("2026-11-19T08:00:00.000Z"),
    completedAt: null,
    closedAt: null,
    deliveryCodeHash: null,
    trip: { originCity: "Paris", destinationCity: "Brazzaville", departureAt: new Date("2026-12-02T08:00:00.000Z") },
    ...extra,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.conversation.findMany.mockResolvedValue([]);
  prismaMock.user.findMany.mockResolvedValue([{ id: AUTRE, isDeleted: false, firstName: "Aminata", avatar: null }]);
  prismaMock.meetup.findMany.mockResolvedValue([]);
  prismaMock.message.findMany.mockResolvedValue([]);
  prismaMock.message.count.mockResolvedValue(0);
});

describe("① la liste part des DEALS, pas des lignes en base", () => {
  it("trois deals engagés et zéro conversation donnent TROIS fils", async () => {
    // Le défaut exact, reproduit : c'est l'état du compte mesuré le 28/11.
    prismaMock.booking.findMany.mockResolvedValue([
      deal({ id: "64b00000000000000000b001", status: "PICKED_UP" }),
      deal({ id: "64b00000000000000000b002", status: "COMPLETED" }),
      deal({ id: "64b00000000000000000b003", status: "COMPLETED" }),
    ]);

    const lu = await service.list(MOI);

    expect(lu.items).toHaveLength(3);
    expect(lu.items.map((i) => i.bookingId)).toEqual([
      "64b00000000000000000b001",
      "64b00000000000000000b002",
      "64b00000000000000000b003",
    ]);
  });

  it("elle demande les SIX statuts de la règle, pas une liste recopiée", async () => {
    prismaMock.booking.findMany.mockResolvedValue([]);
    await service.list(MOI);

    const where = prismaMock.booking.findMany.mock.calls[0][0].where;
    // La règle a UN domicile : si quelqu'un ajoute un septième statut à
    // `CONVERSATION_OPEN_STATUSES`, la liste doit le suivre sans qu'on y pense.
    expect(where.status.in).toEqual([...CONVERSATION_OPEN_STATUSES]);
    expect(where.isDeleted).toBe(false);
    expect(where.OR).toEqual([{ shipperId: MOI }, { carrierId: MOI }]);
  });

  it("un deal qui n’a pas atteint un statut de fil n’est jamais demandé", async () => {
    // `PENDING` n'est pas dans la règle : le serveur ne doit même pas avoir à
    // le filtrer après coup, il ne le demande pas.
    expect([...CONVERSATION_OPEN_STATUSES]).not.toContain("PENDING");
  });
});

describe("② lire n’écrit pas (CQS, D83)", () => {
  it("aucune conversation n’est créée pendant un listage", async () => {
    prismaMock.booking.findMany.mockResolvedValue([deal()]);

    await service.list(MOI);

    // La tentation évidente — matérialiser les lignes manquantes ici — rendrait
    // le nombre de lignes dépendant de qui a ouvert quel écran, et ferait d'un
    // GET une opération non idempotente.
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("deux listages de suite rendent exactement la même chose", async () => {
    prismaMock.booking.findMany.mockResolvedValue([deal()]);

    const un = await service.list(MOI);
    const deux = await service.list(MOI);

    expect(deux).toEqual(un);
  });
});

describe("③ un fil jamais ouvert se présente sans identifiant", () => {
  it("`id` est null, `bookingId` ne l’est jamais", async () => {
    prismaMock.booking.findMany.mockResolvedValue([deal()]);

    const [fil] = (await service.list(MOI)).items;

    expect(fil.id).toBeNull();
    expect(fil.bookingId).toBe("64b00000000000000000b001");
  });

  it("il porte quand même le corridor, la contrepartie et le statut", async () => {
    // Une ligne sans message n'est pas une ligne vide : elle dit avec QUI et
    // sur QUOI, et elle s'ouvre.
    prismaMock.booking.findMany.mockResolvedValue([deal()]);

    const [fil] = (await service.list(MOI)).items;

    expect(fil.counterpart.firstName).toBe("Aminata");
    expect(fil.corridor).toEqual({
      originCity: "Paris",
      destinationCity: "Brazzaville",
      departureAt: "2026-12-02T08:00:00.000Z",
    });
    expect(fil.bookingStatus).toBe("PICKED_UP");
    expect(fil.role).toBe("CARRIER");
    expect(fil.access.canRead).toBe(true);
  });

  it("il n’a ni dernier message ni non-lus, et personne ne les compte", async () => {
    prismaMock.booking.findMany.mockResolvedValue([deal()]);

    const lu = await service.list(MOI);

    expect(lu.items[0].lastMessage).toBeNull();
    expect(lu.items[0].unreadCount).toBe(0);
    expect(lu.totalUnread).toBe(0);
    // Pas de ligne, pas de message : compter serait une requête pour rien.
    expect(prismaMock.message.count).not.toHaveBeenCalled();
  });

  it("une conversation matérialisée garde son identifiant et ses non-lus", async () => {
    prismaMock.booking.findMany.mockResolvedValue([deal()]);
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: "64b00000000000000000c001",
        bookingId: "64b00000000000000000b001",
        shipperId: AUTRE,
        carrierId: MOI,
        shipperLastReadAt: null,
        carrierLastReadAt: null,
      },
    ]);
    prismaMock.message.count.mockResolvedValue(2);

    const [fil] = (await service.list(MOI)).items;

    expect(fil.id).toBe("64b00000000000000000c001");
    expect(fil.unreadCount).toBe(2);
  });
});

describe("④ l’ordre : le plus vivant d’abord, même sans message", () => {
  it("un fil qui a parlé passe devant un fil muet plus récent", async () => {
    const vieuxQuiParle = deal({ id: "64b00000000000000000b001", acceptedAt: new Date("2026-11-01T08:00:00.000Z") });
    const neufMuet = deal({ id: "64b00000000000000000b002", acceptedAt: new Date("2026-11-27T08:00:00.000Z") });
    prismaMock.booking.findMany.mockResolvedValue([vieuxQuiParle, neufMuet]);
    prismaMock.conversation.findMany.mockResolvedValue([
      { id: "64b00000000000000000c001", bookingId: "64b00000000000000000b001", shipperId: AUTRE, carrierId: MOI, shipperLastReadAt: null, carrierLastReadAt: null },
    ]);
    prismaMock.message.findMany.mockResolvedValue([
      { conversationId: "64b00000000000000000c001", body: "On se voit au Terminal 2", authorRole: "SHIPPER", createdAt: new Date("2026-11-28T07:00:00.000Z") },
    ]);

    const lu = await service.list(MOI);

    expect(lu.items.map((i) => i.bookingId)).toEqual([
      "64b00000000000000000b001",
      "64b00000000000000000b002",
    ]);
  });

  it("entre deux fils muets, c’est le deal le plus récent qui mène", async () => {
    prismaMock.booking.findMany.mockResolvedValue([
      deal({ id: "64b00000000000000000b001", acceptedAt: new Date("2026-11-01T08:00:00.000Z") }),
      deal({ id: "64b00000000000000000b002", acceptedAt: new Date("2026-11-27T08:00:00.000Z") }),
    ]);

    const lu = await service.list(MOI);

    expect(lu.items.map((i) => i.bookingId)).toEqual([
      "64b00000000000000000b002",
      "64b00000000000000000b001",
    ]);
  });

  it("un deal sans date d’acceptation prend sa date de création", async () => {
    // `acceptedAt` est nullable au schéma : un tri qui le suppose présent
    // placerait ces fils au hasard.
    prismaMock.booking.findMany.mockResolvedValue([
      deal({ id: "64b00000000000000000b001", acceptedAt: null, createdAt: new Date("2026-11-26T08:00:00.000Z") }),
      deal({ id: "64b00000000000000000b002", acceptedAt: null, createdAt: new Date("2026-11-10T08:00:00.000Z") }),
    ]);

    const lu = await service.list(MOI);

    expect(lu.items.map((i) => i.bookingId)).toEqual([
      "64b00000000000000000b001",
      "64b00000000000000000b002",
    ]);
  });
});

describe("⑤ l’écran vide redevient vrai", () => {
  it("aucun deal éligible : aucune ligne, et aucune requête inutile", async () => {
    prismaMock.booking.findMany.mockResolvedValue([]);

    const lu = await service.list(MOI);

    expect(lu).toEqual({ items: [], totalUnread: 0 });
    expect(prismaMock.conversation.findMany).not.toHaveBeenCalled();
  });
});
