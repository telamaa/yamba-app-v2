/**
 * @packages/libs/csv — export CSV sûr (C-PR7a, D60 2A)
 * ====================================================
 * Pur, zéro dépendance. Cellules échappées (RFC 4180), préfixes de formule neutralisés
 * (injection tableur), BOM UTF-8 pour Excel. Utilisé par les exports admin de chaque service.
 *
 * Recette 02-ADMIN § 5.6 :
 *  - ANO-ADM-14 — la file Finances avait sa PROPRE copie de `csvCell`, sans la tabulation ni le retour chariot :
 *    une seule implémentation, ici ;
 *  - un NOMBRE n'est jamais une formule : `-500` reste numérique (seules les chaînes sont neutralisées) ;
 *  - borne de volume commune (`EXPORT_MAX_ROWS`) et troncature DITE (`X-Truncated`, journal), jamais silencieuse.
 */
export const CSV_BOM = "﻿";

/** Plafond de lignes d'un export admin (D60 2A). Au-delà, le fichier est tronqué ET le dit. */
export const EXPORT_MAX_ROWS = 5000;

/** Premier caractère qu'un tableur interprète comme le début d'une formule (OWASP « CSV injection »). */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  let s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join("|") : String(v);
  if (FORMULA_PREFIX.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** `columns` fixe l'en-tête et l'ordre ; chaque ligne est lue par nom de colonne. */
export function buildCsv<T extends Record<string, unknown>>(columns: readonly (keyof T & string)[], rows: readonly T[]): string {
  const lines = [columns.join(",")];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}

export function csvFilename(domain: string, now: Date): string {
  return `yamba-${domain}-${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
}

/**
 * Lire `EXPORT_MAX_ROWS + 1` lignes puis passer ici : on sait s'il en restait sans compter la collection.
 * `truncated` va au journal ET dans l'en-tête `X-Truncated` — un export incomplet qui se tait fait croire à un total.
 */
export function capExportRows<T>(rows: readonly T[], max: number = EXPORT_MAX_ROWS): { rows: T[]; truncated: boolean } {
  return rows.length > max ? { rows: rows.slice(0, max), truncated: true } : { rows: [...rows], truncated: false };
}

/** Les en-têtes d'une réponse d'export (le front lit le nom, le nombre de lignes et la troncature). */
export function csvResponseHeaders(filename: string, rowCount: number, truncated: boolean): Record<string, string> {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "X-Row-Count": String(rowCount),
    "X-Truncated": truncated ? "true" : "false",
    "Access-Control-Expose-Headers": "Content-Disposition, X-Row-Count, X-Truncated",
  };
}
