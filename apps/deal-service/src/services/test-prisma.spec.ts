/**
 * test-prisma.spec.ts — l'outil de test se teste lui-même
 * ========================================================
 * `@packages/test-prisma` porte un invariant du dépôt (D2). Une garde qu'on n'a jamais vue ÉCHOUER
 * n'est pas une garde, c'est un commentaire exécutable — cette fiche la met donc au rouge
 * délibérément, cas par cas, avant de vérifier qu'elle est verte sur le comportement correct.
 *
 * Elle vit dans `apps/deal-service` par la convention du dépôt : une lib partagée est éprouvée depuis
 * un service qui la consomme (comme `@packages/totp` l'est depuis `apps/auth-service`).
 */
import { creerPrismaJournalise, manquementsD2, ECRITURES_PRISMA, METHODES_PRISMA } from "@packages/test-prisma";

const ETAT = new Set(["booking"]);

describe("creerPrismaJournalise — dedans et dehors deviennent distinguables", () => {
  it("un appel hors transaction porte `transaction: null`, un appel dedans porte son numéro", async () => {
    const j = creerPrismaJournalise({ modeles: ["booking", "outboxEvent"] });
    const p = j.prisma as never as { booking: { update: (a: unknown) => Promise<unknown> }; $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> };

    await p.booking.update({ where: { id: "b1" } });
    await p.$transaction(async () => {
      await p.booking.update({ where: { id: "b2" } });
    });

    expect(j.appels.map((a) => a.transaction)).toEqual([null, 1]);
    expect(j.horsTransaction("booking", "update")).toHaveLength(1);
    expect(j.dansTransaction(1, "booking", "update")).toHaveLength(1);
  });

  it("les transactions sont numérotées, et une imbrication restaure la précédente", async () => {
    const j = creerPrismaJournalise({ modeles: ["booking"] });
    const p = j.prisma as never as { booking: { create: () => Promise<unknown> }; $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> };

    await p.$transaction(async () => {
      await p.booking.create();
      await p.$transaction(async () => { await p.booking.create(); });
      await p.booking.create();
    });

    expect(j.appels.map((a) => a.transaction)).toEqual([1, 2, 1]);
    expect(j.transactionsOuvertes()).toBe(2);
  });

  it("une transaction qui LÈVE restaure quand même l'état : les appels suivants sont hors transaction", async () => {
    const j = creerPrismaJournalise({ modeles: ["booking"] });
    const p = j.prisma as never as { booking: { create: () => Promise<unknown> }; $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> };

    await expect(p.$transaction(async () => { await p.booking.create(); throw new Error("boom"); })).rejects.toThrow("boom");
    await p.booking.create();

    expect(j.appels.map((a) => a.transaction)).toEqual([1, null]);
  });

  it("les retours sont déclarables, par valeur ou par fonction des arguments", async () => {
    const j = creerPrismaJournalise({
      modeles: ["booking"],
      retours: {
        "booking.findUnique": { id: "b1", status: "ACCEPTED" },
        "booking.updateMany": (args: unknown) => ({ count: (args as { where: { id: string } }).where.id === "b1" ? 1 : 0 }),
      },
    });
    const p = j.prisma as never as { booking: { findUnique: () => Promise<unknown>; updateMany: (a: unknown) => Promise<unknown>; count: () => Promise<unknown> } };

    expect(await p.booking.findUnique()).toEqual({ id: "b1", status: "ACCEPTED" });
    expect(await p.booking.updateMany({ where: { id: "b1" } })).toEqual({ count: 1 });
    expect(await p.booking.updateMany({ where: { id: "b9" } })).toEqual({ count: 0 });
    expect(await p.booking.count()).toBe(0); // défaut raisonnable, non déclaré
  });

  it("`reinitialiser` vide le journal ET remet la numérotation à zéro", async () => {
    const j = creerPrismaJournalise({ modeles: ["booking"] });
    const p = j.prisma as never as { booking: { create: () => Promise<unknown> }; $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> };
    await p.$transaction(async () => { await p.booking.create(); });
    j.reinitialiser();
    expect(j.appels).toHaveLength(0);
    expect(j.transactionsOuvertes()).toBe(0);
    await p.$transaction(async () => { await p.booking.create(); });
    expect(j.appels[0].transaction).toBe(1); // et non 2
  });

  it("toutes les méthodes déclarées existent sur chaque modèle", () => {
    const j = creerPrismaJournalise({ modeles: ["booking", "trip"] });
    for (const modele of ["booking", "trip"]) {
      for (const methode of METHODES_PRISMA) {
        expect(typeof (j.prisma[modele] as Record<string, unknown>)[methode]).toBe("function");
      }
    }
  });
});

describe("manquementsD2 — la règle, vue ROUGE avant d'être vue verte", () => {
  /** Le cas correct : l'état et son événement, dans la même transaction. */
  it("est vide quand l'état et l'événement sont dans la MÊME transaction", async () => {
    const j = creerPrismaJournalise({ modeles: ["booking", "outboxEvent"] });
    const p = j.prisma as never as { booking: { updateMany: () => Promise<unknown> }; outboxEvent: { create: () => Promise<unknown> }; $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> };

    await p.$transaction(async () => {
      await p.booking.updateMany();
      await p.outboxEvent.create();
    });

    expect(manquementsD2(j.appels, { modelesDEtat: ETAT })).toEqual([]);
  });

  it("ROUGE — l'événement écrit HORS transaction (le défaut réel d'A197)", async () => {
    const j = creerPrismaJournalise({ modeles: ["booking", "outboxEvent"] });
    const p = j.prisma as never as { booking: { updateMany: () => Promise<unknown> }; outboxEvent: { create: () => Promise<unknown> }; $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> };

    await p.$transaction(async () => { await p.booking.updateMany(); });
    await p.outboxEvent.create(); // ← la seconde transaction du défaut historique

    const m = manquementsD2(j.appels, { modelesDEtat: ETAT });
    expect(m).toContain("outboxEvent.create écrit HORS transaction");
    expect(m).toContain("la transaction n° 1 change un état sans écrire d'événement");
  });

  it("ROUGE — l'état changé hors transaction, l'événement dedans", async () => {
    const j = creerPrismaJournalise({ modeles: ["booking", "outboxEvent"] });
    const p = j.prisma as never as { booking: { updateMany: () => Promise<unknown> }; outboxEvent: { create: () => Promise<unknown> }; $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> };

    await p.booking.updateMany();
    await p.$transaction(async () => { await p.outboxEvent.create(); });

    expect(manquementsD2(j.appels, { modelesDEtat: ETAT })).toContain("booking.updateMany (changement d'état) écrit HORS transaction");
  });

  it("ROUGE — deux transactions : l'état dans la première, l'événement dans la seconde", async () => {
    const j = creerPrismaJournalise({ modeles: ["booking", "outboxEvent"] });
    const p = j.prisma as never as { booking: { updateMany: () => Promise<unknown> }; outboxEvent: { create: () => Promise<unknown> }; $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> };

    await p.$transaction(async () => { await p.booking.updateMany(); });
    await p.$transaction(async () => { await p.outboxEvent.create(); });

    expect(manquementsD2(j.appels, { modelesDEtat: ETAT })).toContain("la transaction n° 1 change un état sans écrire d'événement");
  });

  it("une LECTURE d'état hors transaction n'est pas un manquement", async () => {
    const j = creerPrismaJournalise({ modeles: ["booking", "outboxEvent"] });
    const p = j.prisma as never as { booking: { findUnique: () => Promise<unknown>; updateMany: () => Promise<unknown> }; outboxEvent: { create: () => Promise<unknown> }; $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> };

    await p.booking.findUnique(); // charger avant d'écrire est le cas NORMAL
    await p.$transaction(async () => { await p.booking.updateMany(); await p.outboxEvent.create(); });

    expect(manquementsD2(j.appels, { modelesDEtat: ETAT })).toEqual([]);
  });

  it("une transaction qui ne change AUCUN état n'a pas à porter d'événement", async () => {
    const j = creerPrismaJournalise({ modeles: ["booking", "adminAction", "outboxEvent"] });
    const p = j.prisma as never as { adminAction: { create: () => Promise<unknown> }; $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> };

    await p.$transaction(async () => { await p.adminAction.create(); }); // journal d'une consultation

    expect(manquementsD2(j.appels, { modelesDEtat: ETAT })).toEqual([]);
  });

  it("`ECRITURES_PRISMA` ne classe pas une lecture comme une écriture", () => {
    for (const lecture of ["findUnique", "findFirst", "findMany", "count", "aggregate"]) expect(ECRITURES_PRISMA.has(lecture)).toBe(false);
    for (const ecriture of ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"]) expect(ECRITURES_PRISMA.has(ecriture)).toBe(true);
  });
});

describe("les méthodes sont de vrais espions jest — l'adoption ne casse aucune assertion", () => {
  it("`toHaveBeenCalledWith`, `mockResolvedValueOnce` et `mockRejectedValueOnce` fonctionnent", async () => {
    const j = creerPrismaJournalise({ modeles: ["booking"] });
    const booking = j.prisma.booking as Record<string, jest.Mock>;

    booking.findUnique.mockResolvedValueOnce({ id: "b1" });
    await expect((booking.findUnique as jest.Mock)({ where: { id: "b1" } })).resolves.toEqual({ id: "b1" });
    expect(booking.findUnique).toHaveBeenCalledWith({ where: { id: "b1" } });

    booking.updateMany.mockRejectedValueOnce(new Error("conflit"));
    await expect((booking.updateMany as jest.Mock)()).rejects.toThrow("conflit");
  });

  it("`reinitialiser` remet AUSSI les compteurs d'appels des espions à zéro", async () => {
    const j = creerPrismaJournalise({ modeles: ["booking"] });
    const booking = j.prisma.booking as Record<string, jest.Mock>;
    await booking.create();
    expect(booking.create).toHaveBeenCalledTimes(1);
    j.reinitialiser();
    expect(booking.create).toHaveBeenCalledTimes(0);
  });
});

describe("`reinitialiser` répare ce qu'un test précédent a écrasé — la fuite ENTRE fiches (famille A199)", () => {
  it("un `mockReset().mockImplementation(...)` posé dans un test ne survit PAS au test suivant", async () => {
    const j = creerPrismaJournalise({ modeles: ["user"], retours: { "user.findUnique": async () => ({ id: "bon" }) } });
    const user = j.prisma.user as Record<string, jest.Mock>;

    // Un test qui impose son propre retour — geste banal, et qui écrasait la journalisation.
    user.findUnique.mockReset().mockImplementation(async () => ({ id: "perime" }));
    expect(await user.findUnique()).toEqual({ id: "perime" });
    expect(j.appelsDe("user", "findUnique")).toHaveLength(0); // la journalisation est bien perdue…

    j.reinitialiser(); // …et c'est `reinitialiser` qui la répare.

    expect(await user.findUnique()).toEqual({ id: "bon" });
    expect(j.appelsDe("user", "findUnique")).toHaveLength(1);
  });

  it("`$transaction` aussi est réinstallé : la numérotation repart et journalise", async () => {
    const j = creerPrismaJournalise({ modeles: ["booking"] });
    const p = j.prisma as never as { booking: { create: () => Promise<unknown> }; $transaction: jest.Mock };

    p.$transaction.mockReset().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(j.prisma)); // le patron menteur, réintroduit
    await p.$transaction(async () => { await p.booking.create(); });
    expect(j.appels[0].transaction).toBeNull(); // le mock menteur ne numérote rien

    j.reinitialiser();

    await p.$transaction(async () => { await p.booking.create(); });
    expect(j.appels[0].transaction).toBe(1);
  });
});
