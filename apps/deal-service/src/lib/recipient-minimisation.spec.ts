import { recipientForCarrier } from "./recipient-minimisation";

/**
 * ANO-API-15 (recette API 08/09/2026, fiche API-DEAL-06) — la vue Voyageur portait le
 * destinataire COMPLET (nom, téléphone, email) dès ACCEPTED. Le destinataire est un tiers :
 * ses coordonnées ont été confiées par l'Expéditeur pour la seule remise du colis.
 */
const destinataire = {
  firstName: "Clarisse",
  lastName: "Mabiala",
  phoneE164: "+242061234567",
  email: "clarisse@example.test",
};

describe("recipientForCarrier — ce que le Voyageur voit, et quand", () => {
  it.each(["PENDING", "ACCEPTED"])("avant la prise en charge (%s) : le nom, PAS le téléphone", (statut) => {
    expect(recipientForCarrier(destinataire, statut)).toEqual({
      firstName: "Clarisse",
      lastName: "Mabiala",
      phoneE164: null,
    });
  });

  it.each(["PICKED_UP", "DELIVERED", "COMPLETED", "DISPUTED"])(
    "à partir de la prise en charge (%s) : le téléphone s'ouvre",
    (statut) => {
      expect(recipientForCarrier(destinataire, statut)?.phoneE164).toBe("+242061234567");
    }
  );

  it("l'email n'est JAMAIS servi, à aucun statut", () => {
    for (const statut of ["PENDING", "ACCEPTED", "PICKED_UP", "DELIVERED", "COMPLETED", "DISPUTED"]) {
      const vue = recipientForCarrier(destinataire, statut) as Record<string, unknown> | null;
      expect(vue).not.toHaveProperty("email");
      expect(JSON.stringify(vue)).not.toContain("clarisse@example.test");
    }
  });

  it("un destinataire manquant donne des champs null, pas un objet absent", () => {
    // La forme du DTO ne change jamais : un client n'a pas à gérer deux cas pour un champ.
    expect(recipientForCarrier(null, "PICKED_UP")).toEqual({
      firstName: null,
      lastName: null,
      phoneE164: null,
    });
  });

  it("les champs absents ne deviennent pas `undefined` dans la réponse", () => {
    expect(recipientForCarrier({ firstName: "Clarisse" }, "PICKED_UP")).toEqual({
      firstName: "Clarisse",
      lastName: null,
      phoneE164: null,
    });
  });
});
