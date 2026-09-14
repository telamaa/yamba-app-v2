/**
 * csv-export.spec.ts — `@packages/libs/csv`, la bibliothèque des exports admin (recette 02-ADMIN § 5.6)
 * =====================================================================================================
 * Testée ici parce que `packages/` n'a pas de projet de test ; trip-service l'utilise pour deux exports.
 */
import { CSV_BOM, EXPORT_MAX_ROWS, buildCsv, capExportRows, csvCell, csvFilename, csvResponseHeaders } from "@packages/libs/csv";

describe("@packages/libs/csv — export sûr", () => {
  it("neutralise les six préfixes de formule d'une CHAÎNE (OWASP), y compris tabulation et retour chariot", () => {
    for (const p of ["=", "+", "-", "@", "\t", "\r"]) expect(csvCell(`${p}1+1`).replace(/^"|"$/g, "").startsWith(`'${p}`)).toBe(true);
    expect(csvCell('=HYPERLINK("http://x","clic")')).toBe(`"'=HYPERLINK(""http://x"",""clic"")"`);
  });

  it("un NOMBRE n'est jamais une formule : -500 reste numérique", () => {
    expect(csvCell(-500)).toBe("-500");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(Number.NaN)).toBe("");
    expect(csvCell("-500")).toBe("'-500"); // la même valeur en chaîne, elle, est neutralisée
  });

  it("RFC 4180 : virgule, guillemet et retour ligne encadrés ; dates ISO ; listes jointes par |", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvCell("l1\nl2")).toBe('"l1\nl2"');
    expect(csvCell(new Date("2026-09-14T08:00:00Z"))).toBe("2026-09-14T08:00:00.000Z");
    expect(csvCell(["SHIPPER", "CARRIER"])).toBe("SHIPPER|CARRIER");
    expect(csvCell(true)).toBe("true");
    expect(csvCell(null)).toBe("");
    expect(buildCsv(["a", "b"], [{ a: 1, b: "x,y" }])).toBe('a,b\r\n1,"x,y"\r\n');
  });

  it("capExportRows : au-delà du plafond, tronque ET le dit ; en deçà, rien", () => {
    const over = Array.from({ length: EXPORT_MAX_ROWS + 1 }, (_, i) => i);
    const capped = capExportRows(over);
    expect(capped.rows).toHaveLength(EXPORT_MAX_ROWS);
    expect(capped.truncated).toBe(true);
    expect(capExportRows([1, 2, 3])).toEqual({ rows: [1, 2, 3], truncated: false });
    expect(capExportRows([1, 2, 3], 2)).toEqual({ rows: [1, 2], truncated: true });
  });

  it("en-têtes : nom, nombre de lignes, troncature exposés au front, jamais mis en cache", () => {
    const h = csvResponseHeaders(csvFilename("trajets", new Date("2026-09-14T08:09:10Z")), 12, false);
    expect(h["Content-Disposition"]).toBe('attachment; filename="yamba-trajets-2026-09-14-08-09-10.csv"');
    expect(h["X-Row-Count"]).toBe("12");
    expect(h["X-Truncated"]).toBe("false");
    expect(h["Cache-Control"]).toBe("no-store");
    expect(h["Access-Control-Expose-Headers"]).toContain("X-Truncated");
    expect(CSV_BOM.charCodeAt(0)).toBe(0xfeff);
  });
});
