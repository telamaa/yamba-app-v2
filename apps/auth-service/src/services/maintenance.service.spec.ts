/**
 * maintenance.service.spec.ts — recette 02-ADMIN § 5.23 (A181, A182) : les transitions de la maintenance.
 * Lever clôt l'annonce, une nouvelle annonce est à venir, l'email suit la transition, deux écritures simultanées donnent un
 * 409 (jamais un 500), et l'interrupteur d'environnement du gateway ferme l'écriture.
 */
import { DEFAULT_MAINTENANCE, maintenanceChangeKind, makeMaintenanceService, resolveMaintenanceWrite, type MaintenanceDb, type MaintenanceValues } from "./maintenance.service";
import { getAdminEmails } from "../emails/admin-emails";

const NOW = new Date("2026-09-15T12:00:00.000Z");
const plus = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();
const annonce: MaintenanceValues = { enabled: false, messageFr: "ce soir", messageEn: "", scheduledAt: plus(2) };
const lectureSeule: MaintenanceValues = { ...annonce, enabled: true };

function fakeDb(initial: { values: MaintenanceValues; version: number } | null) {
  const state = { row: initial ? { values: initial.values as unknown, version: initial.version, updatedAt: NOW, updatedByAdminId: "adm-0" as string | null } : null, actions: [] as Array<Record<string, unknown>> };
  const db: MaintenanceDb = {
    platformSettings: {
      findUnique: async () => (state.row ? { ...state.row } : null),
      create: async ({ data }) => { state.row = { values: data.values, version: data.version, updatedAt: NOW, updatedByAdminId: data.updatedByAdminId }; return state.row; },
      updateMany: async ({ where, data }) => {
        if (!state.row || state.row.version !== where.version) return { count: 0 };
        state.row = { values: data.values, version: data.version, updatedAt: NOW, updatedByAdminId: data.updatedByAdminId };
        return { count: 1 };
      },
    },
    adminAction: { create: async ({ data }) => { state.actions.push(data); return data; } },
    user: { findUnique: async () => ({ firstName: "Olga", lastName: "Exploitation" }) },
    $transaction: async (fn) => fn(db),
  };
  return { db, state };
}
const actor = { id: "adm-1", ip: "10.0.0.1", userAgent: "jest" };
const corps = (v: Partial<MaintenanceValues>, expectedVersion: number) => ({ enabled: false, messageFr: "", messageEn: "", scheduledAt: null, reason: "Motif de recette § 5.23 suffisamment long", expectedVersion, ...v });

describe("resolveMaintenanceWrite (A181)", () => {
  it("ANO-ADM-63 — lever la lecture seule clôt l'annonce, même si le formulaire renvoie encore la date", () => {
    expect(resolveMaintenanceWrite(lectureSeule, { enabled: false, messageFr: "ce soir", messageEn: "", scheduledAt: annonce.scheduledAt }, NOW)).toEqual({ enabled: false, messageFr: "ce soir", messageEn: "", scheduledAt: null });
  });
  it("ANO-ADM-67 — une NOUVELLE date passée hors lecture seule → 400 MAINTENANCE_SCHEDULE_IN_PAST", () => {
    expect(() => resolveMaintenanceWrite(DEFAULT_MAINTENANCE, { enabled: false, messageFr: "", messageEn: "", scheduledAt: plus(-1) }, NOW)).toThrow(expect.objectContaining({ statusCode: 400, details: { code: "MAINTENANCE_SCHEDULE_IN_PAST" } }));
  });
  it("une date déjà enregistrée (devenue passée) ne bloque pas une autre modification ; activer ignore la règle", () => {
    const passee = { ...annonce, scheduledAt: plus(-1) };
    expect(resolveMaintenanceWrite(passee, { enabled: false, messageFr: "autre", messageEn: "", scheduledAt: passee.scheduledAt }, NOW).messageFr).toBe("autre");
    expect(resolveMaintenanceWrite(DEFAULT_MAINTENANCE, { enabled: true, messageFr: "", messageEn: "", scheduledAt: plus(-1) }, NOW).enabled).toBe(true);
  });
});

describe("maintenanceChangeKind (A181)", () => {
  it("la transition, pas l'état d'arrivée", () => {
    expect(maintenanceChangeKind(DEFAULT_MAINTENANCE, annonce)).toBe("SCHEDULED");
    expect(maintenanceChangeKind(annonce, lectureSeule)).toBe("ENABLED");
    expect(maintenanceChangeKind(lectureSeule, { ...annonce, scheduledAt: null })).toBe("LIFTED");
    expect(maintenanceChangeKind(annonce, DEFAULT_MAINTENANCE)).toBe("UNSCHEDULED");
    expect(maintenanceChangeKind(lectureSeule, { ...lectureSeule, messageFr: "nouveau" })).toBe("UPDATED");
    expect(maintenanceChangeKind(annonce, { ...annonce, messageFr: "nouveau" })).toBe("UPDATED");
  });
  it("ANO-ADM-63 — l'email d'une levée dit « levée », jamais « planifiée » (FR et EN)", () => {
    const p = { firstName: "Sacha", byName: "Olga E.", enabled: false, scheduledAt: null, message: "", reason: "motif", statusUrl: "http://x/status" };
    expect(getAdminEmails("fr").maintenanceChanged({ ...p, kind: "LIFTED" }).subject).toBe("Maintenance levée sur Yamba");
    expect(getAdminEmails("en").maintenanceChanged({ ...p, kind: "LIFTED" }).subject).toBe("Maintenance lifted on Yamba");
    expect(getAdminEmails("fr").maintenanceChanged({ ...p, kind: "SCHEDULED", scheduledAt: plus(2) }).subject).toBe("Maintenance planifiée sur Yamba");
    expect(getAdminEmails("fr").maintenanceChanged({ ...p, kind: "ENABLED", enabled: true }).subject).toBe("Maintenance activée sur Yamba");
    expect(getAdminEmails("fr").maintenanceChanged({ ...p, kind: "UNSCHEDULED" }).subject).toBe("Annonce de maintenance retirée sur Yamba");
    expect(getAdminEmails("en").maintenanceChanged({ ...p, kind: "UPDATED", enabled: true }).subject).toBe("Maintenance updated on Yamba");
  });
});

describe("makeMaintenanceService.update", () => {
  it("lever : annonce effacée en base, journal avant/après, notification LIFTED", async () => {
    const { db, state } = fakeDb({ values: lectureSeule, version: 4 });
    const notify = jest.fn(async () => undefined);
    const svc = makeMaintenanceService({ db, notify, forcedByEnvironment: async () => false, now: () => NOW });
    const res = await svc.update(actor, corps({ enabled: false, messageFr: "ce soir", scheduledAt: annonce.scheduledAt }, 4));
    expect(res).toMatchObject({ enabled: false, scheduledAt: null, version: 5, envOverride: false });
    expect(state.actions).toHaveLength(1);
    expect(state.actions[0]).toMatchObject({ action: "MAINTENANCE_CHANGED", before: { enabled: true, version: 4 }, after: { enabled: false, scheduledAt: null, version: 5 } });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "LIFTED" }));
  });
  it("A182 — forcé par l'environnement du gateway : 409 MAINTENANCE_FORCED_BY_ENVIRONMENT, rien d'écrit, personne prévenu ; read le dit", async () => {
    const { db, state } = fakeDb({ values: DEFAULT_MAINTENANCE, version: 2 });
    const notify = jest.fn(async () => undefined);
    const svc = makeMaintenanceService({ db, notify, forcedByEnvironment: async () => true, now: () => NOW });
    await expect(svc.update(actor, corps({}, 2))).rejects.toMatchObject({ statusCode: 409, details: { code: "MAINTENANCE_FORCED_BY_ENVIRONMENT" } });
    expect(state.actions).toEqual([]);
    expect(state.row?.version).toBe(2);
    expect(notify).not.toHaveBeenCalled();
    expect((await svc.read()).envOverride).toBe(true);
    expect((await svc.read({ envOverride: false })).envOverride).toBe(false);
  });
  it("ANO-ADM-65 — conflit d'écriture (P2034) : rejoué ; au réessai la version a bougé → 409 STALE_VERSION, jamais 500", async () => {
    const { db, state } = fakeDb({ values: DEFAULT_MAINTENANCE, version: 7 });
    const transaction = db.$transaction;
    let essais = 0;
    db.$transaction = async (fn) => {
      essais++;
      if (essais === 1) {
        state.row!.version = 8; // l'autre administrateur a gagné pendant ce premier essai
        throw Object.assign(new Error("Transaction failed due to a write conflict or a deadlock."), { code: "P2034" });
      }
      return transaction(fn);
    };
    const svc = makeMaintenanceService({ db, forcedByEnvironment: async () => false, now: () => NOW });
    await expect(svc.update(actor, corps({ scheduledAt: plus(1) }, 7))).rejects.toMatchObject({ statusCode: 409, details: { code: "STALE_VERSION" } });
    expect(essais).toBe(2);
    expect(state.actions).toEqual([]);
  });
  it("ANO-ADM-65 — deux créations du document (clé unique, P2002) : 409 STALE_VERSION", async () => {
    const { db } = fakeDb(null);
    db.platformSettings.create = async () => { throw Object.assign(new Error("Unique constraint failed on the constraint: `PlatformSettings_key_key`"), { code: "P2002" }); };
    const svc = makeMaintenanceService({ db, forcedByEnvironment: async () => false, now: () => NOW });
    await expect(svc.update(actor, corps({ scheduledAt: plus(1) }, 0))).rejects.toMatchObject({ statusCode: 409, details: { code: "STALE_VERSION" } });
  });
  it("une date passée est refusée AVANT toute écriture", async () => {
    const { db, state } = fakeDb({ values: DEFAULT_MAINTENANCE, version: 1 });
    const svc = makeMaintenanceService({ db, forcedByEnvironment: async () => false, now: () => NOW });
    await expect(svc.update(actor, corps({ scheduledAt: plus(-2) }, 1))).rejects.toMatchObject({ statusCode: 400 });
    expect(state.actions).toEqual([]);
    expect(state.row?.version).toBe(1);
  });
});
