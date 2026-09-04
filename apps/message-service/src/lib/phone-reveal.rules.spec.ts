import { phoneRevealWindow, revealAnchorOf } from "./phone-reveal.rules";
import { quickRepliesFor } from "./quick-replies";

const NOW = new Date("2026-09-04T10:00:00.000Z");
const h = (n: number) => new Date(NOW.getTime() + n * 3_600_000);

describe("phone-reveal.rules (chantier F, D61 4A)", () => {
  it("ancre : le rendez-vous de remise d'abord, le départ du trajet ensuite", () => {
    expect(revealAnchorOf({ pickupStartAt: h(3), departureAt: h(10) })).toEqual(h(3));
    expect(revealAnchorOf({ pickupStartAt: null, departureAt: h(10) })).toEqual(h(10));
    expect(revealAnchorOf({ pickupStartAt: null, departureAt: null })).toBeNull();
  });
  it("le numéro s'ouvre deux heures avant, pas plus tôt", () => {
    expect(phoneRevealWindow({ pickupStartAt: h(3), departureAt: null }, NOW)).toMatchObject({ allowed: false, reason: "TOO_EARLY" });
    expect(phoneRevealWindow({ pickupStartAt: h(2), departureAt: null }, NOW).allowed).toBe(true);
    expect(phoneRevealWindow({ pickupStartAt: h(-1), departureAt: null }, NOW).allowed).toBe(true);
    expect(phoneRevealWindow({ pickupStartAt: h(5), departureAt: null }, NOW).opensAt).toEqual(h(3));
    expect(phoneRevealWindow({ pickupStartAt: null, departureAt: null }, NOW)).toMatchObject({ allowed: false, reason: "NO_ANCHOR" });
  });
});

describe("quick-replies (D61 2A)", () => {
  it("servies dans la langue du lecteur, mêmes clés dans les deux langues", () => {
    const fr = quickRepliesFor("fr");
    const en = quickRepliesFor("en");
    expect(fr.map((r) => r.key)).toEqual(en.map((r) => r.key));
    expect(fr.find((r) => r.key === "whichTerminal")?.text).toContain("terminal");
    expect(quickRepliesFor(null).map((r) => r.key)).toEqual(fr.map((r) => r.key));
    expect(fr.filter((r) => r.kind === "PICKUP").length).toBeGreaterThan(2);
  });
});
