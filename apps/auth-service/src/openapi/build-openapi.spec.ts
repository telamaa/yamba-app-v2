/**
 * build-openapi.spec.ts — le document ne peut pas oublier une route (A145)
 * ========================================================================
 * Lit les cinq routeurs au format source, en extrait (méthode, chemin) et exige chaque paire dans
 * `paths` ; vérifie ensuite que chaque `$ref` du document pointe sur un schéma existant.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildOpenApiDocument } from "./build-openapi";

const ROUTES_DIR = join(__dirname, "..", "routes");
function mountedRoutes(): Array<{ method: string; path: string }> {
  const out: Array<{ method: string; path: string }> = [];
  for (const file of readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".router.ts"))) {
    const src = readFileSync(join(ROUTES_DIR, file), "utf-8");
    for (const m of src.matchAll(/router\.(get|post|patch|put|delete)\(\s*"([^"]+)"/g)) {
      out.push({ method: m[1], path: m[2].replace(/:([A-Za-z]+)/g, "{$1}") });
    }
  }
  return out;
}
function collectRefs(node: unknown, acc: Set<string>): void {
  if (Array.isArray(node)) return node.forEach((n) => collectRefs(n, acc));
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "$ref" && typeof v === "string") acc.add(v);
      else collectRefs(v, acc);
    }
  }
}

describe("auth-service OpenAPI (A145)", () => {
  const doc = buildOpenApiDocument();
  const paths = doc.paths as Record<string, Record<string, unknown>>;

  it("documente chaque route montée par les cinq routeurs (86 routes)", () => {
    const routes = mountedRoutes();
    expect(routes.length).toBeGreaterThanOrEqual(86);
    const missing = routes.filter((r) => !paths[r.path] || !paths[r.path][r.method]);
    expect(missing).toEqual([]);
  });
  it("ne documente aucune route qui n'existe pas", () => {
    const mounted = new Set(mountedRoutes().map((r) => `${r.method} ${r.path}`));
    const extra: string[] = [];
    for (const [p, ops] of Object.entries(paths)) for (const method of Object.keys(ops)) if (!mounted.has(`${method} ${p}`)) extra.push(`${method} ${p}`);
    expect(extra).toEqual([]);
  });
  it("chaque $ref pointe sur un schéma du registre, chaque opération a un operationId unique", () => {
    const refs = new Set<string>();
    collectRefs(doc.paths, refs);
    const schemas = doc.components.schemas as Record<string, unknown>;
    const dangling = [...refs].filter((r) => !schemas[r.replace("#/components/schemas/", "")]);
    expect(dangling).toEqual([]);
    const ids: string[] = [];
    for (const ops of Object.values(paths)) for (const op of Object.values(ops)) ids.push((op as { operationId: string }).operationId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(schemas)).toEqual(expect.arrayContaining(["MemberRegisterRequest", "PublicUserProfile", "AdminHomeKpis", "ErrorResponse"]));
  });
});
