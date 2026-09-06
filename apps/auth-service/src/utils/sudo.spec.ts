/** sudo.spec.ts — D65 1A : une fenêtre par session, qui expire, et rien sans elle. */
import { closeSudoWindow, openSudoWindow, sudoKey, sudoStatus } from "./sudo";

function fakeStore() {
  const m = new Map<string, number>(); // clé → expiration epoch s
  let nowSec = 1_000_000;
  return {
    tick: (s: number) => { nowSec += s; },
    async set(key: string, _v: string, _m: "EX", seconds: number) { m.set(key, nowSec + seconds); },
    async ttl(key: string) { const e = m.get(key); if (e === undefined) return -2; const t = e - nowSec; return t > 0 ? t : -2; },
    async del(key: string) { m.delete(key); },
  };
}

describe("fenêtre sudo", () => {
  it("fermée par défaut, ouverte 15 min pour la session courante seulement, puis expirée", async () => {
    const store = fakeStore();
    expect(await sudoStatus(store, "u1", "j1")).toEqual({ active: false, expiresAt: null });
    expect(await sudoStatus(store, "u1", null)).toEqual({ active: false, expiresAt: null });
    await openSudoWindow(store, "u1", "j1");
    expect((await sudoStatus(store, "u1", "j1")).active).toBe(true);
    expect((await sudoStatus(store, "u1", "j2")).active).toBe(false); // une autre session du même membre
    expect((await sudoStatus(store, "u2", "j1")).active).toBe(false);
    store.tick(15 * 60 + 1);
    expect((await sudoStatus(store, "u1", "j1")).active).toBe(false);
  });
  it("se ferme explicitement (changement de mot de passe) ; la clé est nommée par membre et session", async () => {
    const store = fakeStore();
    await openSudoWindow(store, "u1", "j1");
    await closeSudoWindow(store, "u1", "j1");
    expect((await sudoStatus(store, "u1", "j1")).active).toBe(false);
    expect(sudoKey("u1", "j1")).toBe("sudo:u1:j1");
  });
});
