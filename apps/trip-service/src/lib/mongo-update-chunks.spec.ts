import { chunkUpdateData } from "./mongo-update-chunks";

describe("chunkUpdateData — limite Atlas 50 étapes de pipeline", () => {
  const big = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`f${i}`, i]));

  it("découpe 65 champs en paquets ≤ 40", () => {
    const chunks = chunkUpdateData(big, 40);
    expect(chunks.map((c) => Object.keys(c).length)).toEqual([40, 25]);
    expect(Object.assign({}, ...chunks)).toEqual(big);
  });

  it("status / publishedAt vont dans le DERNIER paquet", () => {
    const chunks = chunkUpdateData({ ...big, status: "PUBLISHED", publishedAt: "now" }, 40);
    const last = chunks[chunks.length - 1];
    expect(last.status).toBe("PUBLISHED");
    expect(last.publishedAt).toBe("now");
    expect(chunks[0]).not.toHaveProperty("status");
  });

  it("transition seule, paquet précédent plein → paquet dédié en dernier", () => {
    const forty = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`f${i}`, i]));
    const chunks = chunkUpdateData({ ...forty, status: "PUBLISHED" }, 40);
    expect(chunks).toHaveLength(2);
    expect(chunks[1]).toEqual({ status: "PUBLISHED" });
  });

  it("petit update → un seul paquet inchangé", () => {
    expect(chunkUpdateData({ notes: "x", status: "DRAFT" }, 40)).toEqual([{ notes: "x", status: "DRAFT" }]);
  });
});
