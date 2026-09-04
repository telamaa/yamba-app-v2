import { canReportMessage } from "./message-report.rules";

describe("canReportMessage (D61 7A)", () => {
  it("un message texte de l'autre partie se signale", () => {
    expect(canReportMessage("SHIPPER", { kind: "TEXT", authorRole: "CARRIER" }, false)).toEqual({ allowed: true, reason: null });
  });
  it("jamais son propre message", () => {
    expect(canReportMessage("CARRIER", { kind: "TEXT", authorRole: "CARRIER" }, false).reason).toBe("OWN_MESSAGE");
  });
  it("ni un message système ou un rendez-vous", () => {
    expect(canReportMessage("SHIPPER", { kind: "SYSTEM", authorRole: "SYSTEM" }, false).reason).toBe("NOT_A_TEXT");
    expect(canReportMessage("SHIPPER", { kind: "MEETUP", authorRole: "CARRIER" }, false).reason).toBe("NOT_A_TEXT");
  });
  it("pas deux fois le même message par le même lecteur", () => {
    expect(canReportMessage("SHIPPER", { kind: "TEXT", authorRole: "CARRIER" }, true).reason).toBe("ALREADY_REPORTED");
  });
});
