/**
 * delivery-code.spec.ts — @packages/delivery-code : génération, bcrypt, AES-256-GCM, révélation (D43)
 * =====================================================================================================
 * Testé depuis le deal-service (son premier consommateur), comme @packages/payments.
 * Logique pure (aucune base) : le code naît ici, ses deux formes doivent
 * être cohérentes, et le clair ne doit sortir QUE par decrypt/reveal.
 */
import {
  DeliveryCodeKeyError,
  decryptDeliveryCode,
  encryptDeliveryCode,
  generateDeliveryCode,
  hashDeliveryCode,
  isDeliveryCodeFormat,
  issueDeliveryCode,
  resolveDeliveryCodeKey,
  revealDeliveryCode,
  verifyDeliveryCode,
} from "@packages/delivery-code";

const KEY = Buffer.alloc(32, 7);
const OTHER_KEY = Buffer.alloc(32, 9);

describe("génération", () => {
  it("6 chiffres dans 100000–999999, jamais de zéro en tête (200 tirages)", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateDeliveryCode();
      expect(code).toMatch(/^[1-9]\d{5}$/);
      expect(isDeliveryCodeFormat(code)).toBe(true);
    }
  });

  it("isDeliveryCodeFormat refuse tout ce qui n'est pas 6 chiffres", () => {
    expect(isDeliveryCodeFormat("12345")).toBe(false);
    expect(isDeliveryCodeFormat("1234567")).toBe(false);
    expect(isDeliveryCodeFormat("12a456")).toBe(false);
    expect(isDeliveryCodeFormat("")).toBe(false);
  });
});

describe("bcrypt (validation)", () => {
  it("hash ≠ clair, vérifie le bon code, refuse un mauvais", async () => {
    const hash = await hashDeliveryCode("742891");
    expect(hash).not.toContain("742891");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyDeliveryCode("742891", hash)).toBe(true);
    expect(await verifyDeliveryCode("742892", hash)).toBe(false);
  });

  it("un code mal formé est refusé AVANT la comparaison", async () => {
    const hash = await hashDeliveryCode("742891");
    expect(await verifyDeliveryCode("74289", hash)).toBe(false);
  });
});

describe("AES-256-GCM (ré-affichage)", () => {
  it("aller-retour avec la même clé, format versionné v1 en 4 segments", () => {
    const enc = encryptDeliveryCode("742891", KEY);
    expect(enc.split(".")).toHaveLength(4);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain("742891");
    expect(decryptDeliveryCode(enc, KEY)).toBe("742891");
  });

  it("deux chiffrements du même code diffèrent (IV aléatoire)", () => {
    expect(encryptDeliveryCode("742891", KEY)).not.toBe(encryptDeliveryCode("742891", KEY));
  });

  it("mauvaise clé → null (jamais de throw, jamais de faux clair)", () => {
    const enc = encryptDeliveryCode("742891", KEY);
    expect(decryptDeliveryCode(enc, OTHER_KEY)).toBeNull();
  });

  it("chiffré altéré (tag ou données) → null", () => {
    const enc = encryptDeliveryCode("742891", KEY);
    const parts = enc.split(".");
    const tampered = [parts[0], parts[1], parts[2], parts[3].replace(/^./, (c) => (c === "A" ? "B" : "A"))].join(".");
    expect(decryptDeliveryCode(tampered, KEY)).toBeNull();
  });

  it("format inconnu (version, segments) → null", () => {
    expect(decryptDeliveryCode("v2.a.b.c", KEY)).toBeNull();
    expect(decryptDeliveryCode("garbage", KEY)).toBeNull();
    expect(decryptDeliveryCode("", KEY)).toBeNull();
  });
});

describe("résolution de la clé (env)", () => {
  it("clé base64 de 32 octets → utilisée telle quelle", () => {
    const key = resolveDeliveryCodeKey({ DELIVERY_CODE_ENCRYPTION_KEY: KEY.toString("base64") } as NodeJS.ProcessEnv);
    expect(key.equals(KEY)).toBe(true);
  });

  it("clé de mauvaise longueur → DeliveryCodeKeyError", () => {
    expect(() =>
      resolveDeliveryCodeKey({ DELIVERY_CODE_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString("base64") } as NodeJS.ProcessEnv)
    ).toThrow(DeliveryCodeKeyError);
  });

  it("absente en production → DeliveryCodeKeyError (miroir D38)", () => {
    expect(() => resolveDeliveryCodeKey({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(DeliveryCodeKeyError);
  });

  it("absente hors production → clé de dev déterministe (32 octets)", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const a = resolveDeliveryCodeKey({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
    const b = resolveDeliveryCodeKey({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
    expect(a.length).toBe(32);
    expect(a.equals(b)).toBe(true);
    warn.mockRestore();
  });
});

describe("issueDeliveryCode + revealDeliveryCode", () => {
  it("les deux formes sont cohérentes avec le clair", async () => {
    const m = await issueDeliveryCode(KEY);
    expect(m.code).toMatch(/^\d{6}$/);
    expect(await verifyDeliveryCode(m.code, m.deliveryCodeHash)).toBe(true);
    expect(decryptDeliveryCode(m.deliveryCodeEncrypted, KEY)).toBe(m.code);
  });

  it("revealDeliveryCode : PICKED_UP avec chiffré → code ; autres statuts ou sans chiffré → null", async () => {
    const m = await issueDeliveryCode(KEY);
    expect(revealDeliveryCode({ status: "PICKED_UP", deliveryCodeEncrypted: m.deliveryCodeEncrypted }, KEY)).toBe(m.code);
    expect(revealDeliveryCode({ status: "DELIVERED", deliveryCodeEncrypted: m.deliveryCodeEncrypted }, KEY)).toBeNull();
    expect(revealDeliveryCode({ status: "ACCEPTED", deliveryCodeEncrypted: null }, KEY)).toBeNull();
    expect(revealDeliveryCode({ status: "PICKED_UP", deliveryCodeEncrypted: null }, KEY)).toBeNull();
    expect(revealDeliveryCode({ status: "PICKED_UP" }, KEY)).toBeNull();
  });
});
