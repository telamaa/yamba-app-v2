/** error-details.spec.ts — un code d'erreur est public par contrat (A146). */
import { errorMiddleware } from "@packages/error-handler/error-middleware";
import { AppError, ForbiddenError } from "@packages/error-handler";

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
