/**
 * Vecteurs officiels RFC 6238 (annexe B, SHA-1, secret ASCII "12345678901234567890").
 * Les 8 chiffres de la RFC tronqués à 6 (HOTP tronque par modulo, les 6 derniers sont identiques).
 */
import {
  base32Decode,
  base32Encode,
  consumeBackupCode,
  decryptTotpSecret,
  encryptTotpSecret,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  isBackupCodeFormat,
  otpauthUrl,
  totpCode,
  verifyTotp,
} from "@packages/totp";

const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));
const KEY = Buffer.alloc(32, 7);

describe("@packages/totp — RFC 6238", () => {
  it("base32 : aller-retour et vecteur connu", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(RFC_SECRET).toString("ascii")).toBe("12345678901234567890");
  });

  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ])("T=%s → %s", (seconds, expected) => {
    expect(totpCode(RFC_SECRET, seconds * 1000)).toBe(expected);
  });

  it("verifyTotp : fenêtre ±1 pas, rejet hors fenêtre, anti-rejeu par pas", () => {
    const t = 1111111111 * 1000; // pas 37037037
    expect(verifyTotp(RFC_SECRET, "050471", { timeMs: t })).toEqual({ ok: true, step: 37037037 });
    expect(verifyTotp(RFC_SECRET, "081804", { timeMs: t })).toEqual({ ok: true, step: 37037036 }); // pas précédent
    expect(verifyTotp(RFC_SECRET, "050471", { timeMs: t + 120_000 })).toEqual({ ok: false }); // 4 pas plus tard
    expect(verifyTotp(RFC_SECRET, "050471", { timeMs: t, lastUsedStep: 37037037 })).toEqual({ ok: false }); // rejeu
    expect(verifyTotp(RFC_SECRET, "05 04 71", { timeMs: t })).toEqual({ ok: true, step: 37037037 }); // espaces tolérés
    expect(verifyTotp(RFC_SECRET, "abcdef", { timeMs: t })).toEqual({ ok: false });
  });

  it("secret généré : 32 caractères base32, URL otpauth conforme", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    const url = otpauthUrl({ issuer: "Yamba Admin", account: "telama@yamba.app", secret: s });
    expect(url.startsWith("otpauth://totp/Yamba%20Admin%3Atelama%40yamba.app?")).toBe(true);
    expect(url).toContain(`secret=${s}`);
    expect(url).toContain("issuer=Yamba+Admin");
  });

  it("chiffrement du secret : aller-retour, mauvaise clé → null, format inconnu → null", () => {
    const s = generateTotpSecret();
    const enc = encryptTotpSecret(s, KEY);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(decryptTotpSecret(enc, KEY)).toBe(s);
    expect(decryptTotpSecret(enc, Buffer.alloc(32, 9))).toBeNull();
    expect(decryptTotpSecret("v0.a.b.c", KEY)).toBeNull();
  });

  it("codes de secours : 8 codes XXXXX-XXXXX sans caractères ambigus, consommation unique", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(8);
    for (const c of codes) {
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
      expect(isBackupCodeFormat(c)).toBe(true);
    }
    const hashes = codes.map(hashBackupCode);
    const after = consumeBackupCode(codes[2].toLowerCase(), hashes);
    expect(after).toHaveLength(7);
    expect(consumeBackupCode(codes[2], after!)).toBeNull(); // déjà consommé
    expect(consumeBackupCode("ZZZZZ-ZZZZZ", hashes)).toBeNull();
  });
});
