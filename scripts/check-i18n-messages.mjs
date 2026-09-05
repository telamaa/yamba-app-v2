#!/usr/bin/env node
/**
 * ⭐ D10 — Vérification des messages i18n (apps/user-ui/messages).
 *
 * 1. Chaque fichier de chaque locale doit être du JSON valide.
 * 2. Chaque locale doit avoir exactement les mêmes fichiers que la
 *    locale de référence (fr).
 * 3. Chaque fichier doit avoir exactement le même arbre de clés que
 *    son homologue fr (miroir bidirectionnel) — toute clé manquante
 *    en EN fait planter useTranslations au runtime.
 * 4. Aucune clé ne contient de point ni n'est vide : next-intl réserve
 *    le point à l'imbrication et refuse TOUT le namespace au rendu
 *    (INVALID_KEY, #174) — la CI ne charge pas next-intl, elle applique
 *    la même règle à la source.
 *
 * Usage : node scripts/check-i18n-messages.mjs
 * Sort avec le code 1 et un rapport détaillé à la moindre divergence.
 *
 * Quand une nouvelle locale est ajoutée (es, pt...), il n'y a RIEN à
 * changer ici : toute locale présente dans le dossier est vérifiée
 * contre la référence.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MESSAGES_DIR = "apps/user-ui/messages";
const REFERENCE_LOCALE = "fr";

/** Clés interdites par next-intl (règle 4) : point ou clé vide, à tous les niveaux. */
function invalidKeys(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (k === "" || k.includes(".")) out.push(path);
    if (v !== null && typeof v === "object" && !Array.isArray(v)) out.push(...invalidKeys(v, path));
  }
  return out;
}

/** Aplati l'arbre de clés d'un objet JSON en chemins pointés. */
function keyPaths(obj, prefix = "") {
  const out = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.add(path);
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const child of keyPaths(v, path)) out.add(child);
    }
  }
  return out;
}

function fail(msg) {
  errors.push(msg);
}

const errors = [];

if (!existsSync(MESSAGES_DIR)) {
  console.error(`Dossier introuvable : ${MESSAGES_DIR}`);
  process.exit(1);
}

const locales = readdirSync(MESSAGES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

if (!locales.includes(REFERENCE_LOCALE)) {
  console.error(`Locale de référence "${REFERENCE_LOCALE}" absente de ${MESSAGES_DIR}`);
  process.exit(1);
}

const refDir = join(MESSAGES_DIR, REFERENCE_LOCALE);
const refFiles = readdirSync(refDir).filter((f) => f.endsWith(".json")).sort();

/* ── 1. Parse de la référence ── */
const refTrees = new Map();
for (const file of refFiles) {
  const p = join(refDir, file);
  try {
    const tree = JSON.parse(readFileSync(p, "utf8"));
    refTrees.set(file, tree);
    for (const key of invalidKeys(tree)) fail(`Clé refusée par next-intl (point ou vide) : ${p} → "${key}"`);
  } catch (e) {
    fail(`JSON invalide : ${p} — ${e.message}`);
  }
}

/* ── 2. Chaque autre locale : mêmes fichiers, parse, miroir de clés ── */
for (const locale of locales) {
  if (locale === REFERENCE_LOCALE) continue;
  const dir = join(MESSAGES_DIR, locale);
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();

  for (const f of refFiles) {
    if (!files.includes(f)) fail(`[${locale}] fichier manquant : ${f} (présent en ${REFERENCE_LOCALE})`);
  }
  for (const f of files) {
    if (!refFiles.includes(f)) fail(`[${locale}] fichier orphelin : ${f} (absent de ${REFERENCE_LOCALE})`);
  }

  for (const file of files) {
    if (!refTrees.has(file)) continue;
    const p = join(dir, file);
    let tree;
    try {
      tree = JSON.parse(readFileSync(p, "utf8"));
    } catch (e) {
      fail(`JSON invalide : ${p} — ${e.message}`);
      continue;
    }
    const refKeys = keyPaths(refTrees.get(file));
    const locKeys = keyPaths(tree);
    for (const k of refKeys) {
      if (!locKeys.has(k)) fail(`[${locale}/${file}] clé manquante : ${k}`);
    }
    for (const k of locKeys) {
      if (!refKeys.has(k)) fail(`[${locale}/${file}] clé orpheline : ${k} (absente de ${REFERENCE_LOCALE})`);
    }
  }
}

/* ── Rapport ── */
if (errors.length > 0) {
  console.error(`✗ i18n check — ${errors.length} problème(s) :\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const totalFiles = refFiles.length * locales.length;
console.log(
  `✓ i18n check — ${locales.length} locale(s) [${locales.join(", ")}], ` +
  `${refFiles.length} namespace(s), ${totalFiles} fichiers : parse OK, miroir parfait.`
);
