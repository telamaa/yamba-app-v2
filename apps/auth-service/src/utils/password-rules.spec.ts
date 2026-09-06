import { ValidationError } from "@packages/error-handler";
import {
  findPasswordRuleViolation,
  validatePasswordStrength,
  type PasswordErrorDetails,
} from "./password-rules";

describe("password-rules — un code stable par règle (RG-A-02)", () => {
  it("accepte un mot de passe conforme", () => {
    expect(findPasswordRuleViolation("Tr0mb0ne!Vert", { firstName: "Aminata" })).toBeNull();
  });

  it.each([
    ["", "PASSWORD_REQUIRED"],
    ["Ab1!", "PASSWORD_TOO_SHORT"],
    ["ABCDEFG1!", "PASSWORD_NO_LOWERCASE"],
    ["abcdefg1!", "PASSWORD_NO_UPPERCASE"],
    ["Abcdefgh!", "PASSWORD_NO_DIGIT"],
    ["Abcdefgh1", "PASSWORD_NO_SPECIAL"],
    ["Ab!19901225", "PASSWORD_LOOKS_LIKE_DATE"],
    ["Azerty1!Xy", "PASSWORD_PREDICTABLE"],
    ["Xzzz!Aa1b", "PASSWORD_PREDICTABLE"],
  ])("%p → %s", (password, code) => {
    expect(findPasswordRuleViolation(password)).toBe(code);
  });

  it("refuse le prénom, le nom ou la partie locale de l'email (accents ignorés)", () => {
    const ctx = { firstName: "Amélie", lastName: "Diallo", email: "ami.d@yamba.io" };
    expect(findPasswordRuleViolation("XAmelie9!q", ctx)).toBe("PASSWORD_CONTAINS_PERSONAL_INFO");
    expect(findPasswordRuleViolation("Xdiallo9!q", ctx)).toBe("PASSWORD_CONTAINS_PERSONAL_INFO");
    expect(findPasswordRuleViolation("Xami.d9!qz", ctx)).toBe("PASSWORD_CONTAINS_PERSONAL_INFO");
  });

  it("ignore les fragments d'identité de moins de 3 caractères", () => {
    expect(findPasswordRuleViolation("Lo!Vert2026", { firstName: "Lo" })).toBeNull();
  });

  it("validatePasswordStrength lève une ValidationError 400 avec details typés", () => {
    try {
      validatePasswordStrength("Xdiallo9!q", { lastName: "Diallo" });
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const details = (error as ValidationError).details as PasswordErrorDetails;
      expect((error as ValidationError).statusCode).toBe(400);
      expect(details).toEqual({
        type: "password",
        code: "PASSWORD_CONTAINS_PERSONAL_INFO",
        field: "password",
      });
    }
  });
});
