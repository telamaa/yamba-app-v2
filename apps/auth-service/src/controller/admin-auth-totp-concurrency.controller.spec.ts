/**
 * admin-auth-totp-concurrency.controller.spec.ts — ANO-ADM-88 : un code TOTP ne sert qu'une fois, même envoyé trois fois au
 * même instant (recette 02-ADMIN § 7, engagement du § 5.19).
 *
 * `totpLastUsedStep` était lu AVANT l'écriture : trois requêtes simultanées portant le même code passaient toutes la garde
 * anti-rejeu et ouvraient trois sessions ; l'activation émettait trois jeux de codes de secours (deux déjà invalides à
 * l'affichage) ; un P2034 répondait 500. L'écriture est conditionnelle et rejouée : un gagnant, les autres lisent le refus
 * d'un code rejoué.
 */
import jwt from "jsonwebtoken";
import { creerPrismaJournalise } from "@packages/test-prisma";

const store = new Map<string, string>();
const redisMock = {
  get: jest.fn(async (k: string) => store.get(k) ?? null),
  set: jest.fn(async (k: string, v: string, ...opts: unknown[]) => {
    if (opts.includes("NX") && store.has(k)) return null;
    store.set(k, v);
    return "OK";
  }),
  incr: jest.fn(async () => 1),
  expire: jest.fn(async () => 1),
  del: jest.fn(async () => 1),
  exists: jest.fn(async (k: string) => (store.has(k) ? 1 : 0)),
  pexpire: jest.fn(async () => 1),
  ttl: jest.fn(async () => 3600),
  pttl: jest.fn(async () => 3600000),
  scan: jest.fn(async () => ["0", []]),
};

type Etat = { id: string; updatedAt: Date; totpEnabledAt: Date | null; totpLastUsedStep: number | null; totpBackupCodeHashes: string[]; [k: string]: unknown };
let etat: Etat;
type Where = { id: string; updatedAt?: Date; OR?: Array<Record<string, unknown>> };
/** Évalue les deux gardes utilisées par le contrôleur (null / absent / `lt`, et verrou `updatedAt`). */
function matches(where: Where): boolean {
  if (where.id !== etat.id) return false;
  if (where.updatedAt && where.updatedAt.getTime() !== etat.updatedAt.getTime()) return false;
  if (!where.OR) return true;
  return where.OR.some((clause) => {
    const [field, cond] = Object.entries(clause)[0] as [keyof Etat, unknown];
    const v = etat[field];
    if (cond === null) return v === null;
    if (typeof cond === "object" && cond !== null && "isSet" in cond) return v === undefined;
    if (typeof cond === "object" && cond !== null && "lt" in cond) return typeof v === "number" && v < (cond as { lt: number }).lt;
    return false;
  });
}
/** L'état lu par TOUTES les requêtes simultanées : elles ont lu AVANT la première écriture. */
let lu: Etat;

// Le client de test vient de `@packages/test-prisma`. Deux bénéfices ici : plus de `prismaMock` qui se
// référence dans son propre initialiseur (TS7022 / TS7024 au `nx typecheck`), et les retours passent
// par `retours` — donc chaque appel reste JOURNALISÉ, ce qu'un `mockImplementation` posé après coup
// ferait silencieusement perdre.
const journal = creerPrismaJournalise({
  modeles: ["user"],
  retours: {
    "user.findUnique": async () => lu,
    // Le verrou optimiste, simulé : l'écriture ne passe que si le `where` décrit encore l'état réel.
    "user.updateMany": async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
      if (!matches(where)) return { count: 0 };
      etat = { ...etat, ...data, updatedAt: new Date(etat.updatedAt.getTime() + 1) } as Etat;
      return { count: 1 };
    },
  },
});
const prismaMock = journal.prisma as { user: Record<string, jest.Mock>; $transaction: jest.Mock };
const auditMock = { recordAdminAction: jest.fn(async () => undefined), recordAdminRead: jest.fn(async () => undefined) };
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));
jest.mock("@packages/libs/redis", () => ({ __esModule: true, default: redisMock }));
jest.mock("@packages/admin-audit", () => auditMock);
jest.mock("../emails/send-auth-email", () => ({ sendAuthEmail: jest.fn(async () => undefined) }));

process.env.REFRESH_TOKEN_SECRET = "refresh-secret-de-test";
process.env.ACCESS_TOKEN_SECRET = "access-secret-de-test";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ctrl = require("./admin-auth.controller") as typeof import("./admin-auth.controller");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const totp = require("@packages/totp") as typeof import("@packages/totp");

const ID = "aaaaaaaaaaaaaaaaaaaaaaa1";
const preauth = () => jwt.sign({ id: ID, stage: "admin-preauth" }, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: 300 });

async function call(handler: (rq: never, rs: never, nx: never) => Promise<unknown>, rq: Record<string, unknown>) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), cookie: jest.fn(), clearCookie: jest.fn() };
  const next = jest.fn();
  await handler({ ip: "10.0.0.7", headers: {}, cookies: {}, params: {}, body: {}, ...rq } as never, res as never, next as never);
  const error = next.mock.calls[0]?.[0] as { statusCode?: number; details?: { code?: string } } | undefined;
  return { res, error, status: error?.statusCode ?? (res.status.mock.calls[0]?.[0] as number) };
}

let secret: string;
beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  secret = totp.generateTotpSecret();
  const base = { id: ID, updatedAt: new Date("2026-09-15T10:00:00Z"), firstName: "Fanta", email: "fanta@recette.test", preferredLocale: "fr", roles: ["ADMIN"], adminRole: "FINANCE", adminRoles: ["FINANCE"], isDeleted: false, totpSecretEncrypted: totp.encryptTotpSecret(secret) };
  etat = { ...base, totpEnabledAt: new Date("2026-09-01T10:00:00Z"), totpLastUsedStep: null, totpBackupCodeHashes: [] };
  // Les requêtes simultanées ont toutes lu l'état AVANT la première écriture.
  lu = { ...etat };
  journal.reinitialiser();
});

const codes = (r: Array<{ status: number }>) => r.map((x) => x.status).sort();

describe("ANO-ADM-88 — TOTP : le même code, trois fois au même instant", () => {
  it("vérification : [200, 401, 401], UNE ligne ADMIN_LOGIN, UNE session", async () => {
    const code = totp.totpCode(secret);
    const r = await Promise.all([0, 1, 2].map(() => call(ctrl.adminTotpVerify as never, { cookies: { admin_preauth: preauth() }, body: { code } })));
    expect(codes(r)).toEqual([200, 401, 401]);
    expect(r.filter((x) => x.error).every((x) => x.error?.details?.code === "OTP_INCORRECT")).toBe(true);
    expect(auditMock.recordAdminAction).toHaveBeenCalledTimes(1);
    expect([...store.keys()].filter((k) => k.startsWith("admin_jti:"))).toHaveLength(1);
  });

  it("activation : [200, 403, 403] — un seul jeu de codes de secours, celui montré est celui enregistré", async () => {
    etat = { ...etat, totpEnabledAt: null };
    prismaMock.user.findUnique.mockReset().mockImplementation(async () => ({ ...etat, totpEnabledAt: null }));
    const code = totp.totpCode(secret);
    const r = await Promise.all([0, 1, 2].map(() => call(ctrl.adminTotpEnable as never, { cookies: { admin_preauth: preauth() }, body: { code } })));
    expect(codes(r)).toEqual([200, 403, 403]);
    const gagnant = r.find((x) => !x.error);
    const { backupCodes } = gagnant?.res.json.mock.calls[0][0] as { backupCodes: string[] };
    expect(etat.totpBackupCodeHashes).toEqual(backupCodes.map(totp.hashBackupCode));
    expect(auditMock.recordAdminAction).toHaveBeenCalledTimes(2); // ADMIN_TOTP_ENABLED + ADMIN_LOGIN, une fois
  });

  it("régénération des codes de secours : [200, 400, 400], le jeu enregistré est celui montré", async () => {
    const code = totp.totpCode(secret);
    const r = await Promise.all([0, 1, 2].map(() => call(ctrl.regenerateAdminBackupCodes as never, { user: { id: ID }, body: { code } })));
    expect(codes(r)).toEqual([200, 400, 400]);
    const { backupCodes } = r.find((x) => !x.error)?.res.json.mock.calls[0][0] as { backupCodes: string[] };
    expect(etat.totpBackupCodeHashes).toEqual(backupCodes.map(totp.hashBackupCode));
    expect(auditMock.recordAdminAction).toHaveBeenCalledTimes(1);
  });

  it("code de secours consommé deux fois en même temps : une connexion, le code ne ressuscite pas", async () => {
    const [a, b] = totp.generateBackupCodes();
    etat = { ...etat, totpBackupCodeHashes: [a, b].map(totp.hashBackupCode) };
    const lu = { ...etat };
    prismaMock.user.findUnique.mockReset().mockImplementation(async () => lu);
    const r = await Promise.all([call(ctrl.adminTotpVerify as never, { cookies: { admin_preauth: preauth() }, body: { code: a } }), call(ctrl.adminTotpVerify as never, { cookies: { admin_preauth: preauth() }, body: { code: a } })]);
    expect(codes(r)).toEqual([200, 401]);
    expect(etat.totpBackupCodeHashes).toEqual([totp.hashBackupCode(b)]);
  });

  it("P2034 au premier essai : rejoué, jamais 500", async () => {
    prismaMock.$transaction.mockImplementationOnce(async () => { throw Object.assign(new Error("write conflict"), { code: "P2034" }); });
    const r = await call(ctrl.adminTotpVerify as never, { cookies: { admin_preauth: preauth() }, body: { code: totp.totpCode(secret) } });
    expect(r.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
  });
});
