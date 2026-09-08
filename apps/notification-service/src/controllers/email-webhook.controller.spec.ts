/**
 * email-webhook.controller.spec.ts — la glu du webhook email, enfin couverte
 * ==========================================================================
 * Recette API du 08/09/2026, chapitre 8 (fiches API-HOOK-05 à 08, API-SEC-12).
 *
 * Les RÈGLES du webhook étaient déjà testées — `verifySvixSignature` sur vecteurs,
 * `interpretEmailEvent` sur chaque type. Le CONTRÔLEUR, lui, ne l'était pas : c'est-à-dire
 * exactement la couche où vivaient ANO-API-16 et ANO-API-17. Or ce point d'entrée est l'un des
 * deux seuls que la plateforme expose au monde extérieur, et il décide de mettre une adresse sur
 * liste de suppression — une écriture qui coupe TOUS les emails d'un membre.
 *
 * Les quatre comportements que ce spec verrouille :
 *   1. sans secret configuré, on REFUSE (503) — jamais « on accepte sans vérifier » ;
 *   2. signature absente ou fausse → 401, et AUCUNE écriture ;
 *   3. signature valide → la trace de livraison suit, et le rebond dur supprime l'adresse ;
 *   4. la suppression n'a lieu QU'UNE FOIS (le rejeu répond 200 sans second effet), et un type
 *      non traité répond 200 `ignored` — un webhook n'est jamais une erreur pour l'émetteur,
 *      sinon il retenterait indéfiniment.
 */
const prismaMock = {
  emailDelivery: { updateMany: jest.fn() },
  user: { updateMany: jest.fn() },
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });

import { svixSign } from "@packages/email";
import { makeEmailWebhookController, type RawBodyRequest } from "./email-webhook.controller";

const SECRET = "whsec_" + Buffer.from("recette-yamba-secret").toString("base64");

const log = { warn: jest.fn(), info: jest.fn() };

/** Réponse Express minimale : on retient le statut et le corps. */
function fauxResponse() {
  const out = { statusCode: 200, body: null as unknown };
  const res = {
    status(code: number) {
      out.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      out.body = payload;
      return res;
    },
  };
  return { res, out };
}

/** Requête signée pour de vrai : le corps brut est celui qui a servi à la signature. */
function requete(event: unknown, options: { secret?: string; signature?: string; id?: string; timestamp?: string } = {}) {
  const rawBody = JSON.stringify(event);
  const id = options.id ?? "msg_test";
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = options.signature ?? `v1,${svixSign(options.secret ?? SECRET, id, timestamp, rawBody)}`;
  const headers: Record<string, string> = { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature };
  return {
    rawBody,
    body: event,
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as RawBodyRequest;
}

const bounce = {
  type: "email.bounced",
  data: { email_id: "em_1", to: ["voyageur@example.com"], bounce: { type: "Permanent" } },
};

describe("webhook email — le contrôleur", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.emailDelivery.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
  });

  it("refuse en 503 quand le secret n'est pas configuré — jamais d'acceptation sans vérification", async () => {
    const handler = makeEmailWebhookController({ secret: () => undefined, log });
    const { res, out } = fauxResponse();
    await handler(requete(bounce), res as never);
    expect(out.statusCode).toBe(503);
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it("refuse en 401 une signature absente, et n'écrit rien", async () => {
    const handler = makeEmailWebhookController({ secret: () => SECRET, log });
    const { res, out } = fauxResponse();
    const req = { rawBody: JSON.stringify(bounce), body: bounce, header: () => undefined } as unknown as RawBodyRequest;
    await handler(req, res as never);
    expect(out.statusCode).toBe(401);
    expect(out.body).toMatchObject({ reason: "MISSING_HEADERS" });
    expect(prismaMock.emailDelivery.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it("refuse en 401 une signature calculée avec un AUTRE secret (API-SEC-12)", async () => {
    const handler = makeEmailWebhookController({ secret: () => SECRET, log });
    const { res, out } = fauxResponse();
    await handler(requete(bounce, { secret: "whsec_" + Buffer.from("mauvais-secret").toString("base64") }), res as never);
    expect(out.statusCode).toBe(401);
    expect(out.body).toMatchObject({ reason: "BAD_SIGNATURE" });
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it("refuse en 401 un horodatage hors tolérance, même correctement signé (anti-rejeu)", async () => {
    const handler = makeEmailWebhookController({ secret: () => SECRET, log });
    const { res, out } = fauxResponse();
    const vieux = String(Math.floor(Date.now() / 1000) - 3600);
    await handler(requete(bounce, { timestamp: vieux }), res as never);
    expect(out.statusCode).toBe(401);
    expect(out.body).toMatchObject({ reason: "STALE" });
  });

  it("accepte une livraison signée et met la trace à jour par son identifiant fournisseur", async () => {
    const handler = makeEmailWebhookController({ secret: () => SECRET, log });
    const { res, out } = fauxResponse();
    await handler(requete({ type: "email.delivered", data: { email_id: "em_9", to: ["a@example.com"] } }), res as never);
    expect(out.statusCode).toBe(200);
    expect(out.body).toMatchObject({ ok: true, status: "DELIVERED", suppressed: false });
    expect(prismaMock.emailDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerMessageId: "em_9" } })
    );
  });

  it("supprime l'adresse sur un rebond dur — et une seule fois (le rejeu ne resupprime pas)", async () => {
    const handler = makeEmailWebhookController({ secret: () => SECRET, log });
    const premier = fauxResponse();
    await handler(requete(bounce), premier.res as never);
    expect(premier.out.body).toMatchObject({ status: "BOUNCED", suppressed: true });

    // Rejeu : l'adresse est déjà supprimée, donc le filtre « pas encore supprimée » ne matche plus.
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 });
    const second = fauxResponse();
    await handler(requete(bounce), second.res as never);
    expect(second.out.statusCode).toBe(200);
    expect(second.out.body).toMatchObject({ status: "BOUNCED", suppressed: false });
  });

  it("ne supprime PAS sur un rebond transitoire — une boîte pleine n'est pas une adresse morte", async () => {
    const handler = makeEmailWebhookController({ secret: () => SECRET, log });
    const { res, out } = fauxResponse();
    await handler(
      requete({ type: "email.bounced", data: { email_id: "em_2", to: ["b@example.com"], bounce: { type: "Transient" } } }),
      res as never
    );
    expect(out.body).toMatchObject({ status: "BOUNCED", suppressed: false });
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it("répond 200 `ignored` sur un type non traité — un 4xx ferait retenter l'émetteur sans fin", async () => {
    const handler = makeEmailWebhookController({ secret: () => SECRET, log });
    const { res, out } = fauxResponse();
    await handler(requete({ type: "email.opened", data: { email_id: "em_3" } }), res as never);
    expect(out.statusCode).toBe(200);
    expect(out.body).toEqual({ ok: true, ignored: "email.opened" });
    expect(prismaMock.emailDelivery.updateMany).not.toHaveBeenCalled();
  });
});
