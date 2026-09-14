/**
 * decision-lock.spec.ts — un seul geste d'argent à la fois par deal (ANO-ADM-22, A159)
 */
import { decisionLockKey, withDecisionLock, type DecisionLockStore } from "./decision-lock";

/** Un Redis en mémoire : SET NX PX + compare-and-delete (le script RELEASE). */
function memoire(): DecisionLockStore & { valeurs: Map<string, string> } {
  const valeurs = new Map<string, string>();
  return {
    valeurs,
    async set(key, value, _mode, _ttl, _flag) {
      if (valeurs.has(key)) return null;
      valeurs.set(key, value);
      return "OK";
    },
    async eval(_script, _n, key, token) {
      if (valeurs.get(key) !== token) return 0;
      valeurs.delete(key);
      return 1;
    },
  };
}

describe("withDecisionLock (ANO-ADM-22)", () => {
  it("deux décisions simultanées : une seule exécute son geste, l'autre est refusée sans rien émettre", async () => {
    const store = memoire();
    const emis: string[] = [];
    let liberer!: () => void;
    const lent = new Promise<void>((r) => (liberer = r));
    const premiere = withDecisionLock(store, "d1", async () => { emis.push("refund A"); await lent; return "A"; });
    const seconde = withDecisionLock(store, "d1", async () => { emis.push("refund B"); return "B"; });
    await expect(seconde).rejects.toMatchObject({ statusCode: 409, details: { code: "DECISION_IN_PROGRESS" } });
    liberer();
    await expect(premiere).resolves.toBe("A");
    expect(emis).toEqual(["refund A"]);
  });

  it("le verrou est libéré après le geste, même en cas d'échec", async () => {
    const store = memoire();
    await expect(withDecisionLock(store, "d2", async () => { throw new Error("fournisseur indisponible"); })).rejects.toThrow("fournisseur indisponible");
    expect(store.valeurs.has(decisionLockKey("d2"))).toBe(false);
    await expect(withDecisionLock(store, "d2", async () => "ok")).resolves.toBe("ok");
  });

  it("ne libère jamais le verrou d'un autre (le sien a expiré entre-temps)", async () => {
    const store = memoire();
    await withDecisionLock(store, "d3", async () => {
      store.valeurs.set(decisionLockKey("d3"), "jeton-d-un-autre"); // expiration + reprise par un autre processus
    });
    expect(store.valeurs.get(decisionLockKey("d3"))).toBe("jeton-d-un-autre");
  });

  it("deux deals différents ne se bloquent pas", async () => {
    const store = memoire();
    const [a, b] = await Promise.all([withDecisionLock(store, "x", async () => 1), withDecisionLock(store, "y", async () => 2)]);
    expect([a, b]).toEqual([1, 2]);
  });
});
