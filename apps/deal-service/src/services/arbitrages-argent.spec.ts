/**
 * arbitrages-argent.spec.ts — A198 (c) et (d) : dire ce qu'on mesure, prévenir qui est concerné
 * ==============================================================================================
 * Deux arbitrages issus de la recette admin, instruits puis tranchés le 17/09.
 *
 * (c) « Versements en échec depuis plus de 48 h » ne mesurait PAS ce que son libellé annonçait : la requête
 *     compte des deals TERMINÉS depuis plus de 48 h dont le versement est encore en échec — quelle que soit
 *     l'ancienneté de l'échec. Un opérateur qui lit « ça échoue depuis 48 h » cherche une panne durable et
 *     trouve un incident de la minute ; il finit par ne plus croire l'alerte. La mesure est la bonne (c'est
 *     l'argent dû au Voyageur qui est en retard) : c'est le MOT qu'on corrige.
 *
 * (d) « Abandonner » un renversement était la SEULE décision d'argent muette pour la personne concernée : le
 *     Voyageur voyait passer un virement, puis son renversement, et n'apprenait jamais qu'on renonçait à le
 *     refaire. Le motif interne, lui, ne sort pas (principe d'A191).
 */
const prismaMock = {
  booking: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  notification: { upsert: jest.fn() },
};
const sendTransactionalEmail = jest.fn(async () => ({ provider: "fake", providerMessageId: "x" }));
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));
jest.mock("@packages/email", () => ({ isEmailConfigured: () => true, sendTransactionalEmail }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { evaluateAlerts } = require("./ops-alerts.rules") as typeof import("./ops-alerts.rules");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { notifyCarrierReversalWrittenOff } = require("./ops-notify.service") as typeof import("./ops-notify.service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { OPS_EMAILS } = require("../emails/ops-emails") as typeof import("../emails/ops-emails");

const T0 = new Date("2026-09-17T08:00:00.000Z");
const BOOKING = "64b00000000000000000b001";
const CARRIER = "64b0000000000000000000b1";

const snapshot = (over: Record<string, unknown> = {}) =>
  ({
    failedPayoutsOverThreshold: 0,
    undecidedDisputesOverThreshold: 0,
    heldRetentionsOverThreshold: 0,
    openReversalsOverThreshold: 0,
    parkedOutbox: 0,
    oldestUnpublishedAt: null,
    failedEmailsInWindow: 0,
    lastTripPublishedAt: T0,
    ...over,
  }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.notification.upsert.mockResolvedValue({});
  prismaMock.booking.findUnique.mockResolvedValue({ id: BOOKING, carrierId: CARRIER, payoutAmountCents: 2600, pricing: { currencyCode: "EUR" } });
  prismaMock.user.findUnique.mockResolvedValue({ id: CARRIER, email: "thomas@example.test", firstName: "Thomas", preferredLocale: "fr", isDeleted: false, emailSuppressedAt: null });
});

describe("A198 (c) — l'alerte dit ce que la requête mesure", () => {
  it("le titre parle de la FIN DU DEAL, pas de l'ancienneté de l'échec", () => {
    const [alerte] = evaluateAlerts(snapshot({ failedPayoutsOverThreshold: 3 }), T0);

    expect(alerte.title).toBe("Versements non partis 48 h après la fin du deal");
    expect(alerte.detail).toBe("3 deal(s) terminé(s) depuis plus de 48 h dont le versement est toujours en échec.");
    expect(alerte.title).not.toMatch(/en échec depuis/); // l'ancien libellé, celui qui mentait
  });

  it("le NOM de la règle ne bouge pas : c'est un identifiant, pas une phrase (journaux, emails déjà partis)", () => {
    const [alerte] = evaluateAlerts(snapshot({ failedPayoutsOverThreshold: 1 }), T0);
    expect(alerte.rule).toBe("PAYOUT_FAILED_48H");
    expect(alerte.severity).toBe("critical");
    expect(alerte.href).toBe("/finances?kind=FAILED");
  });

  it("le seuil affiché suit le paramètre, pas une constante en dur", () => {
    const [alerte] = evaluateAlerts(snapshot({ failedPayoutsOverThreshold: 1 }), T0, { ...({} as never), payoutFailedHours: 6, disputeUndecidedHours: 72, retentionHeldDays: 7, reversalOpenHours: 48, outboxParkedAttempts: 10, outboxLagMinutes: 15, emailsFailedWindowHours: 24, noTripPublishedDays: 7 } as never);
    expect(alerte.title).toBe("Versements non partis 6 h après la fin du deal");
  });
});

describe("A198 (d) — le Voyageur apprend qu'on renonce à refaire son virement", () => {
  it("notification in-app + email, dans la langue du membre", async () => {
    const envoye = await notifyCarrierReversalWrittenOff(BOOKING);

    expect(envoye).toBe(true);
    expect(prismaMock.notification.upsert).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    const email = sendTransactionalEmail.mock.calls[0][0] as unknown as { to: string; locale: string; subject: string };
    expect(email.to).toBe("thomas@example.test");
    expect(email.locale).toBe("fr");
    expect(email.subject).toBe("Au sujet du virement de tes gains");
  });

  it("l'identifiant de notification est DÉTERMINISTE : deux clics ne font pas deux notifications", async () => {
    await notifyCarrierReversalWrittenOff(BOOKING);
    await notifyCarrierReversalWrittenOff(BOOKING);

    const cles = prismaMock.notification.upsert.mock.calls.map((c) => (c[0] as { where: { eventId_userId: { eventId: string } } }).where.eventId_userId.eventId);
    expect(new Set(cles).size).toBe(1);
    expect(cles[0]).toBe(`reversal-written-off:${BOOKING}`);
  });

  it("compte effacé ou adresse supprimée : aucune notification par email (D35 4A / D63 4A)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: CARRIER, email: "erased+x@anonymised.invalid", firstName: "Membre", preferredLocale: "fr", isDeleted: true, emailSuppressedAt: null });
    await notifyCarrierReversalWrittenOff(BOOKING);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();

    jest.clearAllMocks();
    prismaMock.notification.upsert.mockResolvedValue({});
    prismaMock.user.findUnique.mockResolvedValue({ id: CARRIER, email: "thomas@example.test", firstName: "Thomas", preferredLocale: "fr", isDeleted: false, emailSuppressedAt: T0 });
    await notifyCarrierReversalWrittenOff(BOOKING);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("le deal n'existe plus : la fonction rend `false` sans lever (elle est best effort)", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(null);
    await expect(notifyCarrierReversalWrittenOff(BOOKING)).resolves.toBe(false);
  });
});

describe("A198 (d) — ce que l'email dit, et ce qu'il ne dit JAMAIS", () => {
  const motifInterne = "Compte suspecté de fraude, dossier interne n° 42 ouvert par Nadia";
  const params = { firstName: "Thomas", amount: "26,00 €", dealRef: "00B001", supportEmail: "support@yamba.app" };

  it.each(["fr", "en"] as const)("%s : le montant, la référence du deal, une voie de recours", (locale) => {
    const { subject, content } = OPS_EMAILS[locale].reversalWrittenOffCarrier(params);
    const texte = [subject, content.title, content.preheader, ...(content.paragraphs ?? []), content.notice?.text ?? "", content.cta?.label ?? ""].join(" ");

    expect(texte).toContain("26,00 €");
    expect(texte).toContain("00B001");
    expect(content.cta?.url).toBe("mailto:support@yamba.app");
    // A191 — le motif interne peut nommer un signalant ou un collègue : il ne sort jamais vers le membre.
    expect(texte).not.toContain(motifInterne);
    expect(texte.toLowerCase()).not.toContain("fraude");
    expect(texte.toLowerCase()).not.toContain("fraud");
  });

  it("le ton reste factuel : la décision ne met en cause ni le compte, ni les autres virements", () => {
    const { content } = OPS_EMAILS.fr.reversalWrittenOffCarrier(params);
    expect(content.notice?.text).toContain("ni ton compte");
  });
});

export {};
