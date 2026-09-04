/**
 * @packages/libs/csv — export CSV sûr (C-PR7a, D60 2A)
 * ====================================================
 * Pur, zéro dépendance. Cellules échappées (RFC 4180), préfixes de formule neutralisés
 * (injection tableur), BOM UTF-8 pour Excel. Utilisé par les exports admin de chaque service.
 */
export const CSV_BOM = "﻿";

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join("|") : typeof v === "boolean" ? (v ? "true" : "false") : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
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
