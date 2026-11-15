/**
 * regles-d-acces.spec.ts — mot de passe, webmail, code à usage unique (A224 lot 4).
 * ==================================================================================
 * Trois modules de `lib/auth/` qui décident de la SÉCURITÉ d'un compte ou en
 * touchent la surface. Aucun n'était gardé.
 *
 * Le critère de priorité tenu depuis le lot 2 — un accès, un prix, la vie
 * privée — place celui-ci en tête de ce qui restait.
 */
import {
  getPasswordChecks,
  getPasswordLevel,
  getPasswordScore,
  isPasswordValid,
} from "@/lib/auth/password-strength";
import { webmailUrl } from "@/lib/auth/webmail";
import {
  HELP_AFTER_SECONDS,
  OTP_EXPIRY_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  resendPhase,
  showValidity,
} from "@/lib/auth/otp-display";

describe("getPasswordChecks — les huit critères", () => {
  const BON = "Yamba-Dev-2026!";

  it("un mot de passe solide satisfait tout", () => {
    expect(isPasswordValid(getPasswordChecks(BON))).toBe(true);
  });

  it("chaque critère de COMPOSITION se refuse séparément", () => {
    expect(getPasswordChecks("Abc1!").minLength).toBe(false);
    expect(getPasswordChecks("ABCDEF1!").lowercase).toBe(false);
    expect(getPasswordChecks("abcdef1!").uppercase).toBe(false);
    expect(getPasswordChecks("Abcdefg!").number).toBe(false);
    expect(getPasswordChecks("Abcdefg1").special).toBe(false);
  });

  it("il refuse le PRÉNOM, le NOM et la part locale de l’e-mail", () => {
    // Le défaut qu'on ne veut pas : « Marven2026! » passe tous les critères
    // de composition et se devine en trois essais.
    const ctx = { firstName: "Marven", lastName: "Mabiala", email: "marven.m@gmail.com" };
    expect(getPasswordChecks("Marven2026!", ctx).personalInfo).toBe(false);
    expect(getPasswordChecks("Mabiala2026!", ctx).personalInfo).toBe(false);
    expect(getPasswordChecks("Marven.m2026!", ctx).personalInfo).toBe(false);
  });

  it("il ne se laisse pas tromper par la casse ni les accents", () => {
    // `normalizeForComparison` est la seule défense contre « MARVEN » ou
    // « Élodie » écrits autrement.
    const ctx = { firstName: "Élodie" };
    expect(getPasswordChecks("elodie2026!", ctx).personalInfo).toBe(false);
    expect(getPasswordChecks("ELODIE2026!", ctx).personalInfo).toBe(false);
  });

  it("un fragment TROP COURT ne disqualifie pas", () => {
    // Un prénom de deux lettres rendrait presque tout mot de passe invalide :
    // le module exige trois caractères avant d'interdire.
    expect(getPasswordChecks("Lixyz2026!", { firstName: "Li" }).personalInfo).toBe(true);
  });

  it("il refuse les suites évidentes et les répétitions", () => {
    expect(getPasswordChecks("Abcdef12!").predictable).toBe(false);
    expect(getPasswordChecks("Aaaa2026!").predictable).toBe(false);
  });

  it("il refuse ce qui ressemble à une date", () => {
    const checks = getPasswordChecks("Marie01012000!");
    expect(checks.simpleDate).toBe(false);
  });

  it("sans contexte, aucun critère personnel ne se déclenche à tort", () => {
    // Le formulaire de connexion n'a ni prénom ni nom : les trois champs sont
    // optionnels et leur absence ne doit rien interdire.
    expect(getPasswordChecks(BON, {}).personalInfo).toBe(true);
    expect(getPasswordChecks(BON).personalInfo).toBe(true);
  });
});

describe("le niveau annoncé ne surestime jamais", () => {
  it("un champ vide n’est pas « faible », il est vide", () => {
    expect(getPasswordLevel("", 0)).toBe("empty");
  });

  it("« excellent » exige TOUS les critères", () => {
    const checks = getPasswordChecks("Yamba-Dev-2026!");
    expect(getPasswordScore(checks)).toBe(8);
    expect(getPasswordLevel("Yamba-Dev-2026!", 8)).toBe("excellent");
  });

  it("le niveau monte avec le score, sans jamais redescendre", () => {
    // Une barre de force qui recule pendant qu'on ajoute des caractères est
    // la pire des interfaces : elle fait croire qu'on s'est trompé.
    const ordre = ["weak", "weak", "weak", "weak", "weak", "medium", "medium", "strong", "excellent"];
    for (let score = 0; score <= 8; score++) {
      expect(getPasswordLevel("xxxxxxxx", score)).toBe(ordre[score]);
    }
  });

  it("un mot de passe INVALIDE ne peut pas être annoncé « excellent »", () => {
    const checks = getPasswordChecks("Abcdefg1");
    expect(isPasswordValid(checks)).toBe(false);
    expect(getPasswordLevel("Abcdefg1", getPasswordScore(checks))).not.toBe("excellent");
  });
});

describe("webmailUrl — on ne devine JAMAIS un domaine", () => {
  it("un fournisseur connu donne son lien", () => {
    expect(webmailUrl("marie@gmail.com")).toBe("https://mail.google.com");
    expect(webmailUrl("marie@outlook.com")).toContain("outlook");
  });

  it("tolère la casse et les espaces — ce que l’utilisateur a tapé", () => {
    expect(webmailUrl("  Marie@GMAIL.com  ")).toBe("https://mail.google.com");
  });

  it("un domaine inconnu rend null, il n’est pas DEVINÉ", () => {
    // Le commentaire du module le dit : deviner « https://webmail.<domaine> »
    // enverrait vers une page qui n'existe pas, ou pire, vers autre chose.
    expect(webmailUrl("marie@yamba.app")).toBeNull();
    expect(webmailUrl("marie@entreprise-inconnue.fr")).toBeNull();
  });

  it("refuse tout ce qui n’est pas une adresse", () => {
    for (const brut of ["", "marie", "@gmail.com", "marie@", "a@b@gmail.com", "   "]) {
      expect(webmailUrl(brut)).toBeNull();
    }
  });

  it("chaque lien de la table est en https, et aucun n’est relatif", () => {
    // Une entrée mal recopiée enverrait le membre sur une page du SITE
    // portant un nom de fournisseur — la confusion parfaite.
    for (const domaine of ["gmail.com", "outlook.com", "yahoo.fr", "orange.fr", "laposte.net"]) {
      const url = webmailUrl(`x@${domaine}`);
      expect(url).not.toBeNull();
      expect(url as string).toMatch(/^https:\/\//);
    }
  });
});

describe("le code à usage unique — ce que l’écran montre, et quand", () => {
  it("les quatre durées sont cohérentes entre elles", () => {
    // Un délai de renvoi plus long que la validité rendrait le code
    // inutilisable avant d'être renouvelable.
    expect(RESEND_COOLDOWN_SECONDS).toBeLessThan(OTP_EXPIRY_SECONDS);
    expect(HELP_AFTER_SECONDS).toBeLessThan(RESEND_COOLDOWN_SECONDS);
  });

  it("la validité se montre quand elle a quelque chose à dire", () => {
    expect(showValidity(600)).toBe(false);
    expect(showValidity(45)).toBe(true);
    // Expiré compris : c'est PRÉCISÉMENT le moment où elle compte.
    expect(showValidity(0)).toBe(true);
  });

  it("les trois phases du renvoi arrivent dans l’ordre du temps", () => {
    expect(resendPhase(55)).toBe("early");
    expect(resendPhase(20)).toBe("waiting");
    expect(resendPhase(0)).toBe("ready");
  });

  it("le geste n’est JAMAIS proposé avant son délai", () => {
    // Proposer « Renvoyer » pendant le délai produit un refus serveur que
    // l'Expéditeur lit comme une panne.
    for (let s = RESEND_COOLDOWN_SECONDS; s > 0; s--) {
      expect(resendPhase(s)).not.toBe("ready");
    }
  });

  it("un compteur négatif vaut « disponible », pas une quatrième phase", () => {
    expect(resendPhase(-5)).toBe("ready");
  });
});
