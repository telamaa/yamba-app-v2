/**
 * booking-templates.spec.ts — les 8 gabarits EJS se RENDENT vraiment
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

const BASE = {
  subject: "Sujet de test",
  firstName: "Naomi",
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
        // Le code de livraison ne voyage JAMAIS dans un email.
        expect(html.toLowerCase()).not.toContain("code de livraison");
        expect(html.toLowerCase()).not.toContain("delivery code");
      }
    });
  }

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
