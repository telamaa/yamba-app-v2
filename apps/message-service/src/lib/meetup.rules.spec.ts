import { canAcceptMeetup, nextMeetupOf, validateMeetupSlot } from "./meetup.rules";

const NOW = new Date("2026-09-04T10:00:00.000Z");
const h = (n: number) => new Date(NOW.getTime() + n * 3_600_000);

describe("meetup.rules (chantier F, D61 1A)", () => {
  it("créneau : futur d'au moins 30 minutes, fin après début, fenêtre bornée", () => {
    expect(validateMeetupSlot({ startAt: h(2), endAt: h(3) }, NOW)).toEqual({ ok: true, reason: null });
    expect(validateMeetupSlot({ startAt: h(2), endAt: h(1) }, NOW).reason).toBe("END_BEFORE_START");
    expect(validateMeetupSlot({ startAt: h(0.25), endAt: h(1) }, NOW).reason).toBe("TOO_SOON");
    expect(validateMeetupSlot({ startAt: h(24 * 100), endAt: h(24 * 100 + 1) }, NOW).reason).toBe("TOO_FAR");
    expect(validateMeetupSlot({ startAt: h(2), endAt: h(20) }, NOW).reason).toBe("WINDOW_TOO_LONG");
    expect(validateMeetupSlot({ startAt: new Date("nope"), endAt: h(1) }, NOW).reason).toBe("INVALID_DATES");
  });
  it("accepter : réservé à l'autre partie, sur une proposition ouverte", () => {
    expect(canAcceptMeetup({ status: "PROPOSED", proposedByRole: "SHIPPER" }, "CARRIER")).toEqual({ ok: true, reason: null });
    expect(canAcceptMeetup({ status: "PROPOSED", proposedByRole: "SHIPPER" }, "SHIPPER").reason).toBe("OWN_PROPOSAL");
    expect(canAcceptMeetup({ status: "ACCEPTED", proposedByRole: "SHIPPER" }, "CARRIER").reason).toBe("NOT_PROPOSED");
  });
  it("le rendez-vous qui compte : le prochain accepté, sinon la dernière proposition", () => {
    const accepted = { status: "ACCEPTED", startAt: h(5), createdAt: h(-10) };
    const acceptedPast = { status: "ACCEPTED", startAt: h(-5), createdAt: h(-20) };
    const proposedOld = { status: "PROPOSED", startAt: h(8), createdAt: h(-3) };
    const proposedNew = { status: "PROPOSED", startAt: h(9), createdAt: h(-1) };
    expect(nextMeetupOf([acceptedPast, proposedOld, accepted, proposedNew], NOW)).toBe(accepted);
    expect(nextMeetupOf([acceptedPast, proposedOld, proposedNew], NOW)).toBe(proposedNew);
    expect(nextMeetupOf([acceptedPast], NOW)).toBeNull();
    expect(nextMeetupOf([], NOW)).toBeNull();
  });
});
