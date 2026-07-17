/**
 * Génère apps/trip-service/openapi.json sur disque.
 * =================================================
 * Usage : npm run generate:openapi
 * Sortie versionnée dans git : c'est l'artefact consommé par les
 * générateurs de clients mobiles (D3). Toute PR qui modifie les
 * contrats doit régénérer ce fichier.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildOpenApiDocument } from "../apps/trip-service/src/openapi/build-openapi";

const outPath = resolve(__dirname, "../apps/trip-service/openapi.json");
const document = buildOpenApiDocument();

writeFileSync(outPath, JSON.stringify(document, null, 2) + "\n", "utf-8");

const schemaCount = Object.keys(
  (document.components?.schemas as object) ?? {}
).length;
console.log(`✅ OpenAPI 3.1 écrit : ${outPath}`);
console.log(`   ${schemaCount} schémas dans components.schemas`);
