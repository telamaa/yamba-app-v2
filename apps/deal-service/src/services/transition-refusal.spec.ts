import { canPerform } from "./booking-state-machine";

/**
 * ANO-API-04 — le refus de transition dit maintenant CE QUI a été refusé, et DEPUIS QUEL ÉTAT.
 *
 * La phrase reste pour l'humain ; ces champs-ci sont le contrat avec le client :
 * il doit pouvoir afficher « ce deal a déjà été accepté » et recharger, sans analyser une
 * phrase anglaise qui changera à la première relecture éditoriale.
 */
describe("machine à états — le motif structuré d'un refus (ANO-API-04)", () => {
  const now = new Date("2026-09-08T12:00:00.000Z");
  const deal = (status: string) =>
    ({ status, isDeleted: false, expiresAt: new Date("2026-09-30T00:00:00.000Z") }) as never;

  it("dit le statut d'où l'action a été tentée, et ceux d'où elle reste possible", () => {
    const check = canPerform(deal("ACCEPTED"), "accept", "CARRIER", { now });
    expect(check.allowed).toBe(false);
    if (check.allowed) throw new Error("attendu : refus");
    expect(check.details).toEqual({
      refusal: "WRONG_STATUS",
      action: "accept",
      actor: "CARRIER",
      from: "ACCEPTED",
      allowedFrom: ["PENDING"],
    });
  });

  it("distingue un rôle qui n'a JAMAIS ce droit d'un statut devenu incompatible", () => {
    const roleFautif = canPerform(deal("PENDING"), "accept", "SHIPPER", { now });
    if (roleFautif.allowed) throw new Error("attendu : refus");
    expect(roleFautif.details.refusal).toBe("WRONG_ROLE");
    expect(roleFautif.details.allowedFrom).toEqual([]);

    const statutFautif = canPerform(deal("DELIVERED"), "accept", "CARRIER", { now });
    if (statutFautif.allowed) throw new Error("attendu : refus");
    expect(statutFautif.details.refusal).toBe("WRONG_STATUS");
    expect(statutFautif.details.from).toBe("DELIVERED");
  });

  it("un deal effacé refuse tout, sans révéler de statut", () => {
    const check = canPerform({ status: "PENDING", isDeleted: true } as never, "accept", "CARRIER", { now });
    if (check.allowed) throw new Error("attendu : refus");
    expect(check.details).toMatchObject({ refusal: "DELETED", from: null, allowedFrom: [] });
  });

  it("une action inconnue est refusée comme telle, jamais confondue avec un mauvais statut", () => {
    const check = canPerform(deal("PENDING"), "teleporter" as never, "CARRIER", { now });
    if (check.allowed) throw new Error("attendu : refus");
    expect(check.details.refusal).toBe("UNKNOWN_ACTION");
  });

  it("une garde qui tombe est distinguée du mauvais statut (le statut, lui, était bon)", () => {
    // `accept` est légale depuis PENDING, mais la garde refuse un deal expiré.
    const check = canPerform(
      { status: "PENDING", isDeleted: false, expiresAt: new Date("2026-09-01T00:00:00.000Z") } as never,
      "accept",
      "CARRIER",
      { now }
    );
    if (check.allowed) throw new Error("attendu : refus");
    expect(check.details.refusal).toBe("GUARD");
    expect(check.details.from).toBe("PENDING");
  });
});
