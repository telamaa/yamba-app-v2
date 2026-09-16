/**
 * admin-emails.spec.ts — ANO-ADM-53 (recette 02-ADMIN § 5.20) : les valeurs de paramètres dans l'email aux super
 * administrateurs parlent la langue du destinataire. Avant : « 48 hours → 50 hours », « 3.00 € » dans un email français.
 */
import { SANCTION_CATEGORIES, SETTINGS_CATALOG, sanctionCategoryOf } from "@packages/api-contracts";
import { SANCTION_CATEGORY_LABELS, formatSettingValue, getAdminEmails } from "./admin-emails";

describe("formatSettingValue — une valeur de paramètre, dans la langue du destinataire", () => {
  it("français : unités françaises, virgule décimale, espace avant le pourcentage", () => {
    expect(formatSettingValue("fr", "hours", 48)).toBe("48 h");
    expect(formatSettingValue("fr", "days", 7)).toBe("7 j");
    expect(formatSettingValue("fr", "minutes", 15)).toBe("15 min");
    expect(formatSettingValue("fr", "cents", 300)).toBe("3,00 €");
    expect(formatSettingValue("fr", "percent", 12.5)).toBe("12,5 %");
    expect(formatSettingValue("fr", "coef", 1.1)).toBe("× 1,1");
    expect(formatSettingValue("fr", "rating", 4.8)).toBe("4,8 / 5");
    expect(formatSettingValue("fr", "mb", 5)).toBe("5 Mo");
    expect(formatSettingValue("fr", "kg", 0.5)).toBe("0,5 kg");
    expect(formatSettingValue("fr", "count", 3)).toBe("3");
  });
  it("anglais : unités anglaises, point décimal", () => {
    expect(formatSettingValue("en", "days", 7)).toBe("7 d");
    expect(formatSettingValue("en", "cents", 300)).toBe("3.00 €");
    expect(formatSettingValue("en", "percent", 12.5)).toBe("12.5%");
    expect(formatSettingValue("en", "mb", 5)).toBe("5 MB");
  });
  it("aucune unité brute du catalogue ne sort telle quelle, pour aucune clé ni aucune locale", () => {
    for (const locale of ["fr", "en"]) {
      for (const d of SETTINGS_CATALOG) expect(formatSettingValue(locale, d.unit, d.default)).not.toMatch(/\b(hours|days|minutes|percent|cents|coef|rating|mb|count)\b/);
    }
  });
  it("l'email « Paramètres de la plateforme modifiés » rend les lignes telles que formatées", () => {
    const email = getAdminEmails("fr").settingsChanged({ firstName: "Sacha", byName: "Olivier E.", at: "15/09/2026 11:17", reason: "Recette ADM-PAR-3 : trois seuils.", changes: [{ label: "Versement en échec depuis", before: formatSettingValue("fr", "hours", 48), after: formatSettingValue("fr", "hours", 50) }], settingsUrl: "http://localhost:3001/settings", reset: false });
    expect(email.subject).toBe("Paramètres de la plateforme modifiés");
    expect(email.content.paragraphs).toContain("• Versement en échec depuis : 48 h → 50 h");
  });
});

describe("A189 c — l'admin dont les accès changent est prévenu, sans porte d'entrée ni motif interne", () => {
  const liens = (e: { content: { cta?: unknown; paragraphs: string[]; footnotes?: string[] } }) => JSON.stringify(e.content).match(/https?:\/\//g) ?? [];
  it.each(["fr", "en"] as const)("%s : profils modifiés (avant → après, auteur) et accès retiré — aucun lien, aucun bouton", (locale) => {
    const d = getAdminEmails(locale);
    const changed = d.adminRolesChanged({ firstName: "Sami", changedBy: "Sacha S.", before: "Support", after: "Support + Finance", supportEmail: "support@yamba.app" });
    const revoked = d.adminAccessRevoked({ firstName: "Sami", revokedBy: "Sacha S.", supportEmail: "support@yamba.app" });
    for (const e of [changed, revoked]) {
      expect(e.content.cta).toBeUndefined();
      expect(liens(e)).toEqual([]);
    }
    expect(changed.content.paragraphs.join(" ")).toContain("Support + Finance");
    expect(changed.content.paragraphs.join(" ")).toContain("Sacha S.");
    expect(revoked.content.paragraphs.join(" ")).toContain("Sacha S.");
  });
  it("français : sujets lisibles", () => {
    expect(getAdminEmails("fr").adminAccessRevoked({ firstName: "Sami", revokedBy: "Sacha S.", supportEmail: "s@y.app" }).subject).toBe("Ton accès au back-office Yamba a été retiré");
    expect(getAdminEmails("fr").adminRolesChanged({ firstName: "Sami", changedBy: "Sacha S.", before: "Support", after: "Finance", supportEmail: "s@y.app" }).subject).toBe("Tes profils sur le back-office Yamba ont changé");
  });
});

describe("ANO-ADM-87 (recette § 6, ADM-E2E-2) — l'email de sanction ne transporte jamais le motif interne", () => {
  const params = { firstName: "Marc", category: "OTHER" as const, until: null, supportEmail: "support@yamba.app" };
  it("français et anglais : motif générique et adresse de recours, pour la restriction comme pour la suspension", () => {
    for (const locale of ["fr", "en"]) {
      const d = getAdminEmails(locale);
      for (const email of [d.accountRestricted(params), d.accountSuspended(params)]) {
        const texte = JSON.stringify(email.content);
        expect(texte).toMatch(locale === "fr" ? /manquement aux règles d'utilisation de Yamba/ : /breach of Yamba's terms of use/);
        expect(texte).toContain("support@yamba.app");
        // A193 : la seule « raison » transmise est la catégorie fermée, jamais un texte saisi.
        expect(texte).toContain(locale === "fr" ? "Motif : Autre manquement aux règles d'utilisation." : "Reason: Other breach of the terms of use.");
      }
    }
  });
  it("A193 — la catégorie fermée arrive au membre dans SA langue, pour la restriction comme pour la suspension ; chaque catégorie a son libellé FR et EN", () => {
    for (const category of SANCTION_CATEGORIES) {
      expect(SANCTION_CATEGORY_LABELS.fr[category].length).toBeGreaterThan(5);
      expect(SANCTION_CATEGORY_LABELS.en[category].length).toBeGreaterThan(5);
    }
    const fr = JSON.stringify(getAdminEmails("fr").accountSuspended({ ...params, category: "SCAM_SUSPECTED" }).content);
    const en = JSON.stringify(getAdminEmails("en").accountRestricted({ ...params, category: "SCAM_SUSPECTED" }).content);
    expect(fr).toContain("Motif : Arnaque suspectée.");
    expect(en).toContain("Reason: Suspected scam.");
    expect(sanctionCategoryOf(undefined)).toBe("OTHER"); // compte sanctionné avant A193
    expect(sanctionCategoryOf("INCONNUE")).toBe("OTHER");
  });
  it("le type refuse un motif : le passer est une erreur de compilation", () => {
    // @ts-expect-error — `reason` n'existe plus dans AccountStatusParams
    getAdminEmails("fr").accountRestricted({ ...params, reason: "Trois signalements d'Aminata" });
  });
});
