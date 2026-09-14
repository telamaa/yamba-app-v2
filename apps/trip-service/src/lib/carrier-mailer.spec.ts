import { makeCarrierMailer, type CarrierRecipient } from "./carrier-mailer";

const mail = () => ({ subject: "Billet vérifié pour ton trajet Paris → Brazzaville", content: { title: "t", paragraphs: [] } as never });
const base: CarrierRecipient = { firstName: "Thomas", email: "thomas@example.test", preferredLocale: "fr", isDeleted: false, emailSuppressedAt: null };

function monte(user: CarrierRecipient | null, opts: { configured?: boolean; sendFails?: boolean } = {}) {
  const sent: string[] = [];
  const logs: string[] = [];
  const emailCarrier = makeCarrierMailer({
    isConfigured: () => opts.configured ?? true,
    findUser: async () => user,
    send: async (m) => {
      if (opts.sendFails) throw new Error("SMTP down");
      sent.push(m.to);
    },
    log: (l) => logs.push(l),
  });
  return { emailCarrier, sent, logs };
}

describe("makeCarrierMailer (ANO-ADM-10, D35 4A)", () => {
  it("envoie à un Voyageur joignable", async () => {
    const m = monte(base);
    expect(await m.emailCarrier("u1", mail)).toBe("SENT");
    expect(m.sent).toEqual(["thomas@example.test"]);
  });

  it("n'écrit JAMAIS à une adresse sur la liste de suppression, et le journalise", async () => {
    const m = monte({ ...base, emailSuppressedAt: new Date() });
    expect(await m.emailCarrier("u1", mail)).toBe("UNREACHABLE");
    expect(m.sent).toEqual([]);
    expect(m.logs[0]).toMatch(/liste de suppression/);
  });

  it("n'écrit pas à un compte effacé", async () => {
    const m = monte({ ...base, isDeleted: true });
    expect(await m.emailCarrier("u1", mail)).toBe("UNREACHABLE");
    expect(m.logs[0]).toMatch(/compte effacé/);
  });

  it("transport absent ou compte introuvable : rien, sans erreur", async () => {
    expect(await monte(base, { configured: false }).emailCarrier("u1", mail)).toBe("NOT_CONFIGURED");
    expect(await monte(null).emailCarrier("u1", mail)).toBe("NO_ACCOUNT");
  });

  it("un envoi qui échoue ne remonte pas mais se lit dans le journal", async () => {
    const m = monte(base, { sendFails: true });
    expect(await m.emailCarrier("u1", mail)).toBe("FAILED");
    expect(m.logs[0]).toMatch(/non envoyé à thomas@example\.test : SMTP down/);
  });
});
