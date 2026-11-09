/**
 * orphan-holds.rules.spec.ts — l'empreinte orpheline (D82 9A)
 * ===========================================================
 * Sections : A. « est-ce à nous ? » (le garde-fou qui empêche d'annuler l'empreinte d'un
 * autre) · B. le délai de grâce (on ne coupe pas un paiement en cours) · C. la définition de
 * l'orpheline · D. le tri d'une fenêtre.
 */
import {
  ORPHAN_HOLD_GRACE_MINUTES,
  isOrphanHold,
  isOurHold,
  isPastGrace,
  selectOrphanHolds,
  type HoldToJudge,
} from "./orphan-holds.rules";

const NOW = new Date("2026-10-21T12:00:00.000Z");
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);

const hold = (over: Partial<HoldToJudge> = {}): HoldToJudge => ({
  intentId: "pi_1",
  createdAt: minutesAgo(ORPHAN_HOLD_GRACE_MINUTES + 1),
  metadata: { tripId: "64b0000000000000000000a1", shipperId: "64b0000000000000000000e1" },
  ...over,
});

const none: ReadonlySet<string> = new Set();

describe("empreintes orphelines — A. est-ce une empreinte à NOUS ?", () => {
  it("oui quand les deux clés de rapprochement posées par authorize() sont là", () => {
    expect(isOurHold(hold())).toBe(true);
  });

  it("NON sans tripId — un compte de paiement peut servir plusieurs applications, annuler l'empreinte d'un autre serait un vol", () => {
    expect(isOurHold(hold({ metadata: { shipperId: "e1" } }))).toBe(false);
  });

  it("NON sans shipperId", () => {
    expect(isOurHold(hold({ metadata: { tripId: "a1" } }))).toBe(false);
  });

  it("NON sur des clés présentes mais vides (une chaîne d'espaces n'est pas une référence)", () => {
    expect(isOurHold(hold({ metadata: { tripId: "  ", shipperId: "e1" } }))).toBe(false);
  });

  it("NON sans aucune métadonnée", () => {
    expect(isOurHold(hold({ metadata: {} }))).toBe(false);
  });
});

describe("empreintes orphelines — B. le délai de grâce", () => {
  it("une empreinte posée à l'instant est épargnée : le membre est peut-être en train de payer", () => {
    expect(isPastGrace(hold({ createdAt: NOW }), NOW)).toBe(false);
  });

  it("une empreinte d'une heure est épargnée (grâce par défaut : deux heures)", () => {
    expect(isPastGrace(hold({ createdAt: minutesAgo(60) }), NOW)).toBe(false);
  });

  it("le délai est atteint À la minute exacte, pas une minute après", () => {
    expect(isPastGrace(hold({ createdAt: minutesAgo(ORPHAN_HOLD_GRACE_MINUTES) }), NOW)).toBe(true);
  });

  it("la grâce se resserre par argument, sans toucher à la règle", () => {
    expect(isPastGrace(hold({ createdAt: minutesAgo(10) }), NOW, 5)).toBe(true);
  });
});

describe("empreintes orphelines — C. la définition", () => {
  it("à nous, hors grâce, et aucune réservation ne la porte → orpheline", () => {
    expect(isOrphanHold(hold(), { now: NOW, knownIntentIds: none })).toBe(true);
  });

  it("une réservation la porte → ce n'est pas une orpheline, même vieille", () => {
    expect(
      isOrphanHold(hold({ createdAt: minutesAgo(10_000) }), { now: NOW, knownIntentIds: new Set(["pi_1"]) })
    ).toBe(false);
  });

  it("une réservation ANNULÉE la porte encore : son sort appartient à la machine à états, pas à ce ménage", () => {
    // La base rend le paymentIntentId quel que soit le statut de la réservation : l'ensemble
    // « connu » suffit, la règle n'a pas à connaître les statuts.
    expect(isOrphanHold(hold(), { now: NOW, knownIntentIds: new Set(["pi_1"]) })).toBe(false);
  });

  it("dans la grâce → jamais orpheline, même sans réservation", () => {
    expect(isOrphanHold(hold({ createdAt: minutesAgo(1) }), { now: NOW, knownIntentIds: none })).toBe(false);
  });

  it("pas à nous → jamais orpheline, même vieille et sans réservation", () => {
    expect(
      isOrphanHold(hold({ createdAt: minutesAgo(10_000), metadata: { source: "une-autre-application" } }), {
        now: NOW,
        knownIntentIds: none,
      })
    ).toBe(false);
  });
});

describe("empreintes orphelines — D. le tri d'une fenêtre", () => {
  it("ne garde que les orphelines, dans l'ordre reçu", () => {
    const fenetre = [
      hold({ intentId: "pi_a_nous_vieille" }),
      hold({ intentId: "pi_reservee" }),
      hold({ intentId: "pi_toute_fraiche", createdAt: NOW }),
      hold({ intentId: "pi_etranger", metadata: {} }),
      hold({ intentId: "pi_a_nous_vieille_2" }),
    ];
    const orphelines = selectOrphanHolds(fenetre, { now: NOW, knownIntentIds: new Set(["pi_reservee"]) });
    expect(orphelines.map((h) => h.intentId)).toEqual(["pi_a_nous_vieille", "pi_a_nous_vieille_2"]);
  });

  it("une fenêtre vide ne produit rien (et ne jette pas)", () => {
    expect(selectOrphanHolds([], { now: NOW, knownIntentIds: none })).toEqual([]);
  });
});
