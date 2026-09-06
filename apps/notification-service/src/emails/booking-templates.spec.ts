/**
 * booking-templates.spec.ts — les 12 gabarits EJS se RENDENT vraiment
 * ==================================================================
 * Le spec du dispatcher mocke @packages/email : sans ce fichier, une
 * erreur de syntaxe EJS ou une variable manquante n'exploserait qu'en
 * production, en FAILED silencieux (A36). Ici on rend chaque gabarit
 * avec des données représentatives, dans les DEUX locales, et on
 * vérifie qu'aucun « undefined » ne fuit dans le HTML.
 *
 * Garde-fou majeur : AUCUN gabarit ne mentionne le code de livraison.
 */
import ejs from "ejs";
import path from "path";

const TEMPLATES_DIR = path.join(__dirname, "templates");

/** Une suite de 6 chiffres isolée — hors couleurs hexadécimales (#334155). */
const SIX_DIGITS = /(?<![#0-9A-Za-z])\d{6}(?![0-9A-Za-z])/;

const BASE = {
  subject: "Sujet de test",
  firstName: "Naomi",
  counterpartFirstName: "Thomas",
  route: "Paris → Brazzaville",
  weightKg: 2.5,
  ctaUrl: "http://localhost:3000/fr/bookings/64b000000000000000000001",
};

/** Gabarit → données spécifiques (en plus du socle). */
const TEMPLATE_DATA: Record<string, Record<string, unknown>> = {
  "booking/booking-requested-carrier": {
    earnings: "30,00 €",
    expiresAt: "lundi 20 juillet à 10:00",
  },
  "booking/payment-authorized-shipper": { amount: "39,00 €" },
  "booking/booking-accepted-shipper": {
    total: "39,00 €",
    acceptedAt: "dimanche 19 juillet à 12:00",
  },
  "booking/booking-declined-shipper": { reason: "Le calendrier ne convient pas" },
  "booking/booking-expired-shipper": {},
  "booking/booking-cancelled-shipper": { cancelledBy: "SHIPPER" },
  "booking/booking-cancelled-carrier": { cancelledBy: "SHIPPER" },
  "booking/refund-issued-shipper": { amount: "39,00 €" },
  // B3 (A41)
  "booking/booking-picked-up-shipper": { pickedUpAt: "samedi 19 juillet à 12:00", photoCount: 2 },
  "booking/pickup-refused-shipper": { reason: "Le colis dépasse le poids déclaré", total: "39,00 €" },
  "booking/code-regenerated-shipper": { regenerationsLeft: 3 },
  "booking/booking-delivered-shipper": {
    deliveredAt: "samedi 19 juillet à 12:00",
    payoutDueAt: "mercredi 23 juillet",
    transport: "30,00 €",
  },
};

async function render(
  template: string,
  locale: "fr" | "en",
  extra: Record<string, unknown> = {}
): Promise<string> {
  return ejs.renderFile(
    path.join(TEMPLATES_DIR, `${template}.ejs`),
    { ...BASE, locale, ...TEMPLATE_DATA[template], ...extra },
    { async: true }
  );
}

describe("rendu réel des gabarits booking", () => {
  for (const template of Object.keys(TEMPLATE_DATA)) {
    it(`${template} : FR et EN se rendent, sans fuite ni undefined`, async () => {
      for (const locale of ["fr", "en"] as const) {
        const html = await render(template, locale);
        expect(html).toContain(BASE.firstName);
        expect(html).toContain(BASE.ctaUrl);
        expect(html).not.toContain("undefined");
        // Le code de livraison ne voyage JAMAIS dans un email : ni la
        // locution, ni (A41) une suite de 6 chiffres.
        expect(html.toLowerCase()).not.toContain("code de livraison");
        expect(html.toLowerCase()).not.toContain("delivery code");
        // (les couleurs CSS #334155 sont exclues par le lookbehind « # »)
        expect(html).not.toMatch(SIX_DIGITS);
      }
    });
  }

  it("pickup-refused sans raison : le bloc raison disparaît proprement", async () => {
    const html = await render("booking/pickup-refused-shipper", "fr", { reason: null });
    expect(html).not.toContain("Raison indiquée");
    expect(html).not.toContain("undefined");
    expect(html).toContain("39,00");
  });

  it("delivered : la date J+4 et le net du Voyageur sont rendus", async () => {
    const html = await render("booking/booking-delivered-shipper", "en");
    expect(html).toContain("mercredi 23 juillet");
    expect(html).toContain("30,00");
  });

  it("méta-test : le garde-fou 6 chiffres attrape un code injecté", async () => {
    const html = await render("booking/booking-picked-up-shipper", "fr", { firstName: "742891" });
    expect(html).toMatch(SIX_DIGITS);
  });

  it("declined sans raison : le bloc raison disparaît proprement", async () => {
    const html = await render("booking/booking-declined-shipper", "fr", {
      reason: null,
    });
    expect(html).not.toContain("Raison indiquée");
    expect(html).not.toContain("undefined");
  });

  it("cancelled-shipper SYSTEM : variante « autorisation expirée »", async () => {
    const html = await render("booking/booking-cancelled-shipper", "fr", {
      cancelledBy: "SYSTEM",
    });
    // <%= %> échappe le HTML : l'apostrophe sort en &#39;.
    expect(html).toContain("plus valide");
  });
});

describe("D45 — la contrepartie est nommée par son prénom, le rôle n'est qu'un repli", () => {
  const NAMED = [
    "booking/booking-accepted-shipper",
    "booking/payment-authorized-shipper",
    "booking/booking-requested-carrier",
    "booking/booking-picked-up-shipper",
    "booking/booking-delivered-shipper",
  ];

  it.each(NAMED)("%s : le prénom apparaît, dans les deux langues", async (template) => {
    for (const locale of ["fr", "en"] as const) {
      const html = await render(template, locale, { counterpartFirstName: "Thomas" });
      expect(html).toContain("Thomas");
    }
  });

  it("compte effacé (prénom null) : repli sur le mot de rôle, jamais « null »", async () => {
    const fr = await render("booking/booking-accepted-shipper", "fr", { counterpartFirstName: null });
    expect(fr).toContain("ton Voyageur a accepté");
    expect(fr).not.toContain("null");
    const en = await render("booking/booking-requested-carrier", "en", { counterpartFirstName: null });
    expect(en).toContain("A shipper wants");
  });
});
