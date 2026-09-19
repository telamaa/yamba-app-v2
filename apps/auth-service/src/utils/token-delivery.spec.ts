/**
 * token-delivery.spec.ts — A201 : la livraison des jetons est un opt-in strict.
 * Le défaut est TOUJOURS cookies : une valeur inattendue, absente ou non-string
 * ne doit jamais faire fuiter des jetons dans un corps de réponse.
 */
import {
  ACCESS_TOKEN_TTL_SECONDS,
  bearerTokenOf,
  resolveTokenDelivery,
  sessionTokensBody,
} from "./token-delivery";

describe("resolveTokenDelivery (A201)", () => {
  it("bascule en body sur la valeur exacte", () => {
    expect(resolveTokenDelivery("body")).toBe("body");
  });

  it("tolère la casse et les espaces", () => {
    expect(resolveTokenDelivery("  Body ")).toBe("body");
    expect(resolveTokenDelivery("BODY")).toBe("body");
  });

  it("défaut sûr : absent, vide, autre valeur, non-string → cookies", () => {
    expect(resolveTokenDelivery(undefined)).toBe("cookies");
    expect(resolveTokenDelivery("")).toBe("cookies");
    expect(resolveTokenDelivery("cookies")).toBe("cookies");
    expect(resolveTokenDelivery("body;q=1")).toBe("cookies");
    expect(resolveTokenDelivery(["body"])).toBe("cookies");
    expect(resolveTokenDelivery(1)).toBe("cookies");
  });
});

describe("bearerTokenOf", () => {
  it("extrait le jeton d'un Bearer bien formé", () => {
    expect(bearerTokenOf("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("refuse les autres schémas et les en-têtes dégénérés", () => {
    expect(bearerTokenOf("Basic abc")).toBeUndefined();
    expect(bearerTokenOf("Bearer ")).toBeUndefined();
    expect(bearerTokenOf("Bearer")).toBeUndefined();
    expect(bearerTokenOf(undefined)).toBeUndefined();
    expect(bearerTokenOf(42)).toBeUndefined();
  });
});

describe("sessionTokensBody", () => {
  it("porte les deux jetons et le TTL d'accès, rien d'autre (DTO strict)", () => {
    const body = sessionTokensBody("acc", "ref");
    expect(body).toEqual({
      accessToken: "acc",
      refreshToken: "ref",
      accessTokenExpiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
    });
    expect(Object.keys(body).sort()).toEqual([
      "accessToken",
      "accessTokenExpiresInSeconds",
      "refreshToken",
    ]);
  });
});
