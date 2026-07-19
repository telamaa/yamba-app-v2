/**
 * Génère les openapi.json des services sur disque.
 * ================================================
 * Usage : npm run generate:openapi
 * Sorties versionnées dans git : ce sont les artefacts consommés par
 * les générateurs de clients mobiles (D3). Toute PR qui modifie les
 * contrats doit régénérer ces fichiers (le job CI "Contrats OpenAPI"
 * diffe les deux et échoue s'ils divergent).
 *
 * PR3 : le deal-service rejoint le trip-service (spec passée de 1 à
 * 6 opérations — moment du gel). Chaque nouveau service ajoute son
 * entrée dans TARGETS.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildOpenApiDocument as buildTripDocument } from "../apps/trip-service/src/openapi/build-openapi";
import { buildOpenApiDocument as buildDealDocument } from "../apps/deal-service/src/openapi/build-openapi";

const TARGETS = [
  { name: "trip-service", out: "../apps/trip-service/openapi.json", build: buildTripDocument },
  { name: "deal-service", out: "../apps/deal-service/openapi.json", build: buildDealDocument },
];

for (const t of TARGETS) {
  const outPath = resolve(__dirname, t.out);
  const document = t.build();
  writeFileSync(outPath, JSON.stringify(document, null, 2) + "\n", "utf-8");
  const schemaCount = Object.keys(
    (document.components?.schemas as object) ?? {}
  ).length;
  console.log(`✅ OpenAPI 3.1 écrit (${t.name}) : ${outPath}`);
  console.log(`   ${schemaCount} schémas dans components.schemas`);
}
