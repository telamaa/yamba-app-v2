import { SUPPORTED_LOCALES } from "@packages/api-contracts";
import { renderTransactionalEmail } from "@packages/email";
import {
  AUTH_EMAILS,
  AUTH_EMAIL_KEYS,
  getAuthEmails,
  formatLockDurationLocalized,
} from "./auth-emails";

const PARAMS = {
  verifyEmail: { firstName: "Awa", otp: "483920", expiresInMinutes: 10 },
  resetPassword: { firstName: "Awa", otp: "112233", expiresInMinutes: 10 },
  passwordChanged: {
    firstName: "Awa",
    changedAt: "3 septembre 2026",
    ip: "10.0.0.1",
    userAgent: "Safari",
    securityUrl: "https://app.test/security",
    supportEmail: "support@yamba.com",
  },
  accountCreated: { firstName: "Awa", loginUrl: "https://app.test/login", supportEmail: "support@yamba.com" },
  securityAlert: { scope: "forgot" as const, attemptCount: 10, lockSeconds: 1800, supportEmail: "support@yamba.com" },
  carrierOnboardingComplete: { name: "Thomas", city: "Dakar", stripeReady: false, appUrl: "https://app.test" },
  carrierOnboardingReminder: { name: "Thomas", step: 1 as const, currentStep: "PROFILE", appUrl: "https://app.test" },
};

const EMOJI = /\p{Extended_Pictographic}/u;

describe("auth-emails (D44/D45) — dictionnaires miroir, gabarit partagé", () => {
  it("chaque locale supportée a un dictionnaire complet (miroir)", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(AUTH_EMAILS[locale]).sort()).toEqual([...AUTH_EMAIL_KEYS].sort());
    }
  });

  it.each(SUPPORTED_LOCALES)("%s : chaque email a un sujet sans emoji et un contenu complet", (locale) => {
    const dict = AUTH_EMAILS[locale];
    for (const key of AUTH_EMAIL_KEYS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const email = (dict[key] as (p: any) => { subject: string; content: any })(PARAMS[key]);
      expect(email.subject.length).toBeGreaterThan(5);
      expect(EMOJI.test(email.subject)).toBe(false);
      expect(email.content.title.length).toBeGreaterThan(3);
      expect(email.content.greeting.length).toBeGreaterThan(2);
      expect(email.content.paragraphs.length).toBeGreaterThan(0);
      expect(email.content.reason.length).toBeGreaterThan(10);
    }
  });

  it("l'OTP et la durée d'expiration réelle sont rendus, dans la langue demandée", () => {
    const fr = getAuthEmails("fr").verifyEmail(PARAMS.verifyEmail);
    const en = getAuthEmails("en-US").verifyEmail(PARAMS.verifyEmail);
    const htmlFr = renderTransactionalEmail({ locale: "fr", ...fr });
    const htmlEn = renderTransactionalEmail({ locale: "en", ...en });
    expect(htmlFr).toContain("483920");
    expect(htmlFr).toContain("10 minutes");
    expect(htmlFr).toContain("Bonjour Awa,");
    expect(htmlEn).toContain("483920");
    expect(htmlEn).toContain("Hi Awa,");
    expect(htmlEn).toContain('<html lang="en">');
  });

  it("locale inconnue → repli fr (jamais d'email sans dictionnaire)", () => {
    expect(getAuthEmails("de").verifyEmail(PARAMS.verifyEmail).subject).toBe(
      getAuthEmails("fr").verifyEmail(PARAMS.verifyEmail).subject
    );
  });

  it("l'alerte sécurité annonce le verrou du palier atteint (A50), pas « 24 heures » en dur", () => {
    const fr = getAuthEmails("fr").securityAlert({ ...PARAMS.securityAlert, lockSeconds: 1800 });
    expect(fr.content.paragraphs.join(" ")).toContain("30 minutes");
    const en = getAuthEmails("en").securityAlert({ ...PARAMS.securityAlert, lockSeconds: 86400 });
    expect(en.content.paragraphs.join(" ")).toContain("24 hours");
    expect(formatLockDurationLocalized(60, "fr")).toBe("1 minute");
  });

  it("le gabarit partagé rend le bloc code, l'encadré et le CTA quand ils sont fournis", () => {
    const email = getAuthEmails("fr").passwordChanged(PARAMS.passwordChanged);
    const html = renderTransactionalEmail({ locale: "fr", ...email });
    expect(html).toContain("https://app.test/security");
    expect(html).toContain("Adresse IP : 10.0.0.1");
    expect(html).not.toContain("<%");
  });
});
