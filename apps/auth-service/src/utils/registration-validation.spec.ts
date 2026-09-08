import { AuthError, ConflictError, RateLimitError, ValidationError } from "@packages/error-handler";
import { collectRegistrationErrors } from "./registration-rules";
import { validatePasswordStrength } from "./password-rules";

/**
 * ANO-API-03 (fiche API-GW-14) — l'inscription s'arrêtait au PREMIER champ fautif et ne
 * renvoyait qu'un message anglais, là où deal-service et message-service rendent déjà un
 * objet `errors` champ par champ.
 *
 * ANO-API-05 (fiches API-AUTH-03 / 05) — auth-service répondait 400 pour des refus que son
 * propre contrat OpenAPI documente en 409, 401 et 429. Le code métier était juste, le statut
 * ne l'était pas : les trois classes d'erreur devaient d'abord savoir porter un `details`.
 */
const base = {
  firstName: "Recette",
  lastName: "Api",
  email: "recette.api@seed.yamba.dev",
  password: "Kinshasa-2026!",
  termsAccepted: true,
  termsVersion: "2026-06-01",
  privacyVersion: "2026-06-01",
};

/** Ce que le contrôleur agrège : les fautes de champs, plus celle du mot de passe. */
const erreursDe = (data: Record<string, unknown>): Record<string, string> => {
  const errors: Record<string, string> = collectRegistrationErrors(data as never);
  if (data.password) {
    try {
      validatePasswordStrength(data.password as string, {
        firstName: data.firstName as string,
        lastName: data.lastName as string,
        email: (data.email as string) ?? "",
      });
    } catch (e) {
      errors.password = ((e as ValidationError).details as { code?: string })?.code ?? "PASSWORD_WEAK";
    }
  }
  return errors;
};

describe("validateRegistrationData — tous les champs sont examinés, pas seulement le premier", () => {
  it("un formulaire valide ne produit aucune erreur", () => {
    expect(erreursDe(base)).toEqual({});
  });

  it("email invalide ET mot de passe faible : les DEUX sont signalés", () => {
    const errors = erreursDe({ ...base, email: "pas-un-email", password: "123" });
    expect(errors).toEqual({ email: "INVALID_FORMAT", password: "PASSWORD_TOO_SHORT" });
  });

  it("les champs manquants sont tous listés d'un coup", () => {
    const errors = erreursDe({ termsAccepted: true, termsVersion: "v", privacyVersion: "v" });
    expect(Object.keys(errors).sort()).toEqual(["email", "firstName", "lastName", "password"]);
  });

  it("le consentement et les versions ont leurs propres codes", () => {
    expect(erreursDe({ ...base, termsAccepted: false }).termsAccepted).toBe("TERMS_NOT_ACCEPTED");
    expect(erreursDe({ ...base, termsVersion: undefined }).termsVersion).toBe("REQUIRED");
    expect(erreursDe({ ...base, privacyVersion: undefined }).privacyVersion).toBe("REQUIRED");
  });

  it("la règle de champs ne juge PAS le mot de passe : il garde ses propres règles", () => {
    // Le contrôleur relaie l'erreur typée du mot de passe (details.type + code) quand elle
    // est seule — format historique préservé pour les clients qui la lisent.
    expect(collectRegistrationErrors({ ...base, password: "123" } as never)).toEqual({});
    expect(() => validatePasswordStrength("123", { firstName: "A", lastName: "B", email: "a@b.c" })).toThrow();
  });
});

describe("les classes d'erreur portent un statut ET un code métier (ANO-API-05)", () => {
  it.each([
    [new ConflictError("x", { code: "EMAIL_ALREADY_USED" }), 409, "EMAIL_ALREADY_USED"],
    [new AuthError("x", { code: "OTP_INCORRECT" }), 401, "OTP_INCORRECT"],
    [new RateLimitError("x", { code: "OTP_LOCKED" }), 429, "OTP_LOCKED"],
  ])("statut %#", (erreur, statut, code) => {
    expect((erreur as { statusCode: number }).statusCode).toBe(statut);
    expect((erreur.details as { code: string }).code).toBe(code);
  });

  it("les valeurs par défaut restent inchangées (aucun appelant existant ne casse)", () => {
    expect((new ConflictError() as { statusCode: number }).statusCode).toBe(409);
    expect(new AuthError().details).toBeUndefined();
  });
});
