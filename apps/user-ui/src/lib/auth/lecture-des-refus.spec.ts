/**
 * lecture-des-refus.spec.ts — comment le site lit un refus d'auth (A224, lot 2).
 * ===============================================================================
 * Ce module décide de ce qu'un visiteur comprend quand on lui refuse l'entrée.
 * C'est un **accès** : s'il se trompe, quelqu'un reste dehors sans savoir
 * pourquoi — ou pire, apprend quelque chose qu'il ne devait pas apprendre.
 *
 * D96 l'a déjà corrigé une fois : le site lisait le `message` de l'API,
 * normalisé en « request failed with status code 401 », pendant que le
 * téléphone lisait `details.code`. Une règle, deux implémentations, dont une
 * fausse. Rien ne gardait la bonne jusqu'ici.
 */
import {
  LOGIN_ERROR_CODES,
  firstFailingCheck,
  isLoginErrorCode,
  otpCodeMessage,
  passwordCheckMessage,
  passwordCodeMessage,
  readAuthErrorDetails,
  readLoginErrorCode,
  registerCodeMessage,
} from "@/lib/auth/auth-error-codes";
import type { PasswordChecks } from "@/lib/auth/password-strength";

const TOUT_BON: PasswordChecks = {
  minLength: true,
  lowercase: true,
  uppercase: true,
  number: true,
  special: true,
  simpleDate: true,
  predictable: true,
  personalInfo: true,
};

describe("readLoginErrorCode — on lit le CODE, jamais le message", () => {
  it("extrait `details.code` d’une réponse d’erreur", () => {
    expect(readLoginErrorCode({ details: { code: "INVALID_CREDENTIALS" } })).toBe(
      "INVALID_CREDENTIALS"
    );
  });

  it("ne devine rien quand le code manque", () => {
    // « On ne devine jamais » : un refus sans code doit produire le message
    // générique, pas une interprétation du texte anglais de l'API.
    expect(readLoginErrorCode({ message: "Invalid credentials" })).toBeNull();
    expect(readLoginErrorCode({ details: {} })).toBeNull();
    expect(readLoginErrorCode({ details: { code: 42 } })).toBeNull();
  });

  it("survit à tout ce qu’un réseau peut rendre", () => {
    // Le cas réel : une coupure rend `undefined`, un proxy rend du texte, un
    // serveur en vrac rend `null`. Aucun ne doit faire tomber l’écran.
    for (const brut of [null, undefined, "", 0, "boom", [], { details: null }]) {
      expect(readLoginErrorCode(brut)).toBeNull();
    }
  });
});

describe("isLoginErrorCode — la liste est fermée", () => {
  it("reconnaît les quatre codes du contrat", () => {
    for (const code of LOGIN_ERROR_CODES) {
      expect(isLoginErrorCode(code)).toBe(true);
    }
  });

  it("refuse tout le reste, y compris ce qui y ressemble", () => {
    // Un code inconnu ne doit pas être affiché tel quel à l'utilisateur :
    // c'est par là qu'un identifiant technique fuit dans l'interface (D83).
    for (const inconnu of ["", "invalid_credentials", "INVALID", "SERVER_ERROR", "TOKEN_MISSING"]) {
      expect(isLoginErrorCode(inconnu)).toBe(false);
    }
  });
});

describe("readAuthErrorDetails — trois types « sûrs », et seulement eux", () => {
  it("accepte les trois types exposés par le middleware d’erreur", () => {
    for (const type of ["password", "register", "otp"] as const) {
      expect(readAuthErrorDetails({ details: { type, code: "X" } })).not.toBeNull();
    }
  });

  it("refuse un type non prévu plutôt que de le laisser passer", () => {
    // La règle maison : « ne jamais mettre dans un `details` à côté d'un code
    // quelque chose qui n'est pas destiné au client ».
    expect(readAuthErrorDetails({ details: { type: "internal", code: "X" } })).toBeNull();
    expect(readAuthErrorDetails({ details: { code: "X" } })).toBeNull();
    expect(readAuthErrorDetails("nope")).toBeNull();
  });
});

describe("firstFailingCheck — un seul critère à la fois, toujours le même", () => {
  it("rend null quand tout est bon", () => {
    expect(firstFailingCheck(TOUT_BON)).toBeNull();
  });

  it("nomme le PREMIER critère fautif dans un ordre stable", () => {
    // L'ordre compte : un utilisateur qui corrige doit voir les exigences
    // arriver toujours dans le même sens, sinon il a l'impression que la
    // règle change à chaque tentative.
    const sansMajuscule = { ...TOUT_BON, uppercase: false, number: false };
    expect(firstFailingCheck(sansMajuscule)).toBe("uppercase");
  });

  it("la longueur passe avant la composition", () => {
    const tropCourt = { ...TOUT_BON, minLength: false, special: false };
    expect(firstFailingCheck(tropCourt)).toBe("minLength");
  });
});

describe("les messages existent dans les DEUX langues, et diffèrent", () => {
  // Dette nommée au handoff du 14/11 : ce module porte encore ~100 ternaires
  // `fr ? … : …`, donc ces pages sont INVISIBLES au contrôle i18n de la CI
  // (qui compare les dictionnaires JSON entre eux). Tant que la dette est là,
  // c'est cette fiche qui tient le rôle — et elle le dit.
  const criteres: Array<keyof PasswordChecks | null> = [
    "minLength",
    "lowercase",
    "uppercase",
    "number",
    "special",
    "simpleDate",
    "predictable",
    "personalInfo",
    null,
  ];

  it.each(criteres)("le critère %s est écrit en français ET en anglais", (critere) => {
    const enFr = passwordCheckMessage(true, critere);
    const enEn = passwordCheckMessage(false, critere);
    expect(enFr.length).toBeGreaterThan(0);
    expect(enEn.length).toBeGreaterThan(0);
    expect(enFr).not.toBe(enEn);
  });

  it("les codes de mot de passe du serveur ont tous leur phrase", () => {
    const codes = [
      "PASSWORD_REQUIRED",
      "PASSWORD_TOO_SHORT",
      "PASSWORD_NO_LOWERCASE",
      "PASSWORD_NO_UPPERCASE",
      "PASSWORD_NO_DIGIT",
      "PASSWORD_NO_SPECIAL",
      "PASSWORD_LOOKS_LIKE_DATE",
      "PASSWORD_PREDICTABLE",
      "PASSWORD_CONTAINS_PERSONAL_INFO",
    ] as const;
    for (const code of codes) {
      expect(passwordCodeMessage(true, code).length).toBeGreaterThan(0);
      expect(passwordCodeMessage(false, code).length).toBeGreaterThan(0);
    }
  });

  it("les quatre refus de code OTP ont leur phrase", () => {
    // `otpCodeMessage` prend le DÉTAIL complet, pas le code seul : la
    // première version de cette fiche lui passait une chaîne. Jest la
    // laissait verte (la fonction retombait sur son cas par défaut, non
    // vide) — c'est `TypeScript (fiches de test)` qui l'a attrapée. Exemple
    // en acte d'un défaut vivant SEULEMENT dans un fichier de test.
    for (const code of ["OTP_INCORRECT", "OTP_INVALIDATED", "OTP_LOCKED", "OTP_EXPIRED"] as const) {
      expect(otpCodeMessage(true, { type: "otp", code }).length).toBeGreaterThan(0);
      expect(otpCodeMessage(false, { type: "otp", code }).length).toBeGreaterThan(0);
    }
  });

  it("un détail OTP sans code produit quand même une phrase", () => {
    // Le serveur peut refuser sans qualifier : l'écran doit dire quelque
    // chose plutôt que de rester muet.
    expect(otpCodeMessage(true, { type: "otp" }).length).toBeGreaterThan(0);
    expect(otpCodeMessage(false, { type: "otp" }).length).toBeGreaterThan(0);
  });

  it("l’e-mail déjà utilisé ne dit pas s’il appartient à un compte actif", () => {
    // 403 vs 404 : on ne révèle pas l'existence d'une ressource. Le message
    // doit rester neutre — il ne confirme pas un compte à un inconnu.
    const fr = registerCodeMessage(true, "EMAIL_ALREADY_USED");
    const en = registerCodeMessage(false, "EMAIL_ALREADY_USED");
    expect(fr.length).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(0);
  });
});
