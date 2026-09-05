/** email-provider.spec.ts — D35 : fabrique par environnement, fournisseur Resend sur fetch simulé, signature Svix, interprétation des événements. */
import { createHmac } from "node:crypto";
import { FakeEmailProvider, ResendEmailProvider, createEmailProviderFromEnv, interpretEmailEvent, resolveEmailProviderName, svixSign, verifySvixSignature } from "@packages/email";

describe("resolveEmailProviderName (D35 2A)", () => {
  it("explicite, sinon déduit : clé Resend → RESEND, hôte SMTP → SMTP, rien → FAKE", () => {
    expect(resolveEmailProviderName({ EMAIL_PROVIDER: "smtp", SMTP_HOST: "localhost" })).toBe("SMTP");
    expect(resolveEmailProviderName({ RESEND_API_KEY: "re_x" })).toBe("RESEND");
    expect(resolveEmailProviderName({ SMTP_HOST: "smtp.example" })).toBe("SMTP");
    expect(resolveEmailProviderName({})).toBe("FAKE");
  });
  it("en production, FAKE est refusé ; un fournisseur explicite sans sa clé aussi", () => {
    expect(() => resolveEmailProviderName({ NODE_ENV: "production" })).toThrow(/refused in production/);
    expect(() => resolveEmailProviderName({ EMAIL_PROVIDER: "resend" })).toThrow(/RESEND_API_KEY/);
    expect(createEmailProviderFromEnv({ RESEND_API_KEY: "re_x" }).name).toBe("RESEND");
    expect(createEmailProviderFromEnv({}).name).toBe("FAKE");
  });
});

describe("ResendEmailProvider", () => {
  const email = { to: "awa@example.com", from: "Yamba <no-reply@yamba.app>", subject: "Sujet", html: "<p>x</p>", tags: { template: "booking/accepted", service: "notification service" }, idempotencyKey: "evt1:user1" };
  it("POST /emails avec Bearer, Idempotency-Key, destinataire en tableau, étiquettes assainies ; renvoie l'id", async () => {
    const calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body: string } }> = [];
    const fetchImpl = async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ id: "msg_123" }), text: async () => "" }; };
    const r = await new ResendEmailProvider("re_key", fetchImpl).send(email);
    expect(r).toEqual({ provider: "RESEND", providerMessageId: "msg_123" });
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].init.headers).toMatchObject({ Authorization: "Bearer re_key", "Idempotency-Key": "evt1:user1" });
    expect(JSON.parse(calls[0].init.body)).toEqual({ from: email.from, to: ["awa@example.com"], subject: "Sujet", html: "<p>x</p>", tags: [{ name: "template", value: "booking_accepted" }, { name: "service", value: "notification_service" }] });
  });
  it("erreur HTTP → EmailSendError, retriable sur 429 / 5xx, pas sur 4xx", async () => {
    const mk = (status: number) => new ResendEmailProvider("k", async () => ({ ok: false, status, json: async () => ({}), text: async () => "nope" }));
    await expect(mk(422).send(email)).rejects.toMatchObject({ name: "EmailSendError", status: 422, retriable: false });
    await expect(mk(429).send(email)).rejects.toMatchObject({ retriable: true });
    await expect(mk(503).send(email)).rejects.toMatchObject({ retriable: true });
  });
  it("le faux fournisseur garde les envois en mémoire", async () => {
    const fake = new FakeEmailProvider(() => undefined);
    const r = await fake.send(email);
    expect(r.providerMessageId).toBe("fake_1");
    expect(fake.sent[0].to).toBe("awa@example.com");
  });
});

describe("verifySvixSignature (D35 3A)", () => {
  const secret = "whsec_" + Buffer.from("super-secret-key-32-bytes-long!!").toString("base64");
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "m1" } });
  const now = new Date("2026-09-05T12:00:00.000Z");
  const ts = String(Math.floor(now.getTime() / 1000));
  it("signature valide (format v1,<base64>, plusieurs candidates) → ok ; signature fausse → BAD_SIGNATURE", () => {
    const sig = svixSign(secret, "msg_1", ts, body);
    expect(sig).toBe(createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`msg_1.${ts}.${body}`).digest("base64"));
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: ts, signature: `v1,${sig}`, body, now })).toEqual({ ok: true });
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: ts, signature: `v1,AAAA v1,${sig}`, body, now })).toEqual({ ok: true });
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: ts, signature: "v1,AAAA", body, now })).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
    expect(verifySvixSignature({ secret, id: "msg_2", timestamp: ts, signature: `v1,${sig}`, body, now })).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });
  it("en-têtes manquants → MISSING_HEADERS ; horodatage à plus de 5 min → STALE", () => {
    expect(verifySvixSignature({ secret, id: undefined, timestamp: ts, signature: "x", body, now })).toEqual({ ok: false, reason: "MISSING_HEADERS" });
    const old = String(Math.floor(now.getTime() / 1000) - 600);
    expect(verifySvixSignature({ secret, id: "msg_1", timestamp: old, signature: `v1,${svixSign(secret, "msg_1", old, body)}`, body, now })).toEqual({ ok: false, reason: "STALE" });
  });
});

describe("interpretEmailEvent (D35 4A)", () => {
  it("livré → DELIVERED sans suppression ; rebond dur → BOUNCED + HARD_BOUNCE ; rebond transitoire → BOUNCED sans suppression ; plainte → COMPLAINED + COMPLAINT ; ouvert → null", () => {
    expect(interpretEmailEvent({ type: "email.delivered", data: { email_id: "m1", to: ["a@x.com"] } })).toEqual({ status: "DELIVERED", suppress: null, recipient: "a@x.com", messageId: "m1" });
    expect(interpretEmailEvent({ type: "email.bounced", data: { email_id: "m1", to: "a@x.com", bounce: { type: "Permanent" } } })).toMatchObject({ status: "BOUNCED", suppress: "HARD_BOUNCE" });
    expect(interpretEmailEvent({ type: "email.bounced", data: { email_id: "m1", to: ["a@x.com"], bounce: { type: "Transient" } } })).toMatchObject({ status: "BOUNCED", suppress: null });
    expect(interpretEmailEvent({ type: "email.complained", data: { email_id: "m1", to: ["a@x.com"] } })).toMatchObject({ status: "COMPLAINED", suppress: "COMPLAINT" });
    expect(interpretEmailEvent({ type: "email.opened", data: { email_id: "m1" } })).toBeNull();
  });
});
