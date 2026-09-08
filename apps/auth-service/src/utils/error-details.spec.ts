/** error-details.spec.ts — un code d'erreur est public par contrat (A146). */
import { errorMiddleware } from "@packages/error-handler/error-middleware";
import { AppError, AuthError, ForbiddenError } from "@packages/error-handler";

type Sent = { status: number; body: Record<string, unknown> };
function run(err: unknown, nodeEnv: string): Sent {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  const sent: Sent = { status: 0, body: {} };
  const res = {
    status(code: number) {
      sent.status = code;
      return { json: (body: Record<string, unknown>) => { sent.body = body; return body; } };
    },
  };
  try {
    (errorMiddleware as unknown as (e: unknown, req: unknown, res: unknown, next: unknown) => void)(err, { url: "/x", method: "GET", headers: {} }, res, () => undefined);
  } finally {
    process.env.NODE_ENV = previous;
  }
  return sent;
}

describe("errorMiddleware — exposition de details (A146)", () => {
  it("un details PORTEUR D'UN CODE passe en production : la porte du mode sensible ne casse plus (D65)", () => {
    const err = new ForbiddenError("Sudo required.") as ForbiddenError & { details?: unknown };
    err.details = { code: "SUDO_REQUIRED", windowMinutes: 15 };
    const prod = run(err, "production");
    expect(prod.status).toBe(403);
    expect(prod.body.details).toEqual({ code: "SUDO_REQUIRED", windowMinutes: 15 });
  });
  it("les codes métier typés continuent de passer (409 du deal-service)", () => {
    const prod = run(new AppError("Cap exceeded.", 409, true, { type: "booking", code: "NEW_ACCOUNT_CAP", limit: 30000 }), "production");
    expect(prod.status).toBe(409);
    expect(prod.body.details).toMatchObject({ code: "NEW_ACCOUNT_CAP", limit: 30000 });
  });
  it("un details SANS code ni type sûr reste caché en production, visible en développement", () => {
    const err = new AppError("Boom.", 400, true, { internalHint: "collection users" });
    expect(run(err, "production").body.details).toBeUndefined();
    expect(run(err, "development").body.details).toEqual({ internalHint: "collection users" });
  });
  it("un details { errors } continue d'alimenter les formulaires", () => {
    const prod = run(new AppError("Invalid.", 400, true, { errors: { firstName: "TOO_SHORT" } }), "production");
    expect(prod.body.errors).toEqual({ firstName: "TOO_SHORT" });
  });
});

describe("errorMiddleware — le code est aussi servi en tête (dette D-5)", () => {
  /**
   * Plusieurs middlewares écrivaient leur réponse eux-mêmes, avec le code au PREMIER niveau, et
   * des clients le lisent là. Pour qu'ils puissent enfin passer par le middleware d'erreur — une
   * seule forme de corps pour toute la plateforme — celui-ci recopie `details.code` en tête.
   * Sans cette recopie, la dette D-5 se soldait en cassant des écrans.
   */
  it("recopie `details.code` au premier niveau, en production comme en développement", () => {
    const err = new AuthError("Session revoked.", { code: "SESSION_REVOKED" });
    for (const env of ["production", "development"]) {
      const sent = run(err, env);
      expect(sent.status).toBe(401);
      expect(sent.body.code).toBe("SESSION_REVOKED");
      expect(sent.body.details).toEqual({ code: "SESSION_REVOKED" });
    }
  });

  it("n'invente pas de code quand il n'y en a pas", () => {
    expect(run(new AppError("Boom.", 500, true), "production").body.code).toBeUndefined();
    expect(run(new AppError("Boom.", 400, true, { type: "otp", attemptsLeft: 2 }), "production").body.code).toBeUndefined();
  });

  it("garde les autres champs de `details` — la permission manquante, par exemple (API-SEC-05)", () => {
    const sent = run(new ForbiddenError("Denied.", { code: "ADMIN_PERMISSION_DENIED", permission: "audit.read" }), "production");
    expect(sent.body.code).toBe("ADMIN_PERMISSION_DENIED");
    expect(sent.body.details).toEqual({ code: "ADMIN_PERMISSION_DENIED", permission: "audit.read" });
  });
});
