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
 * 5. Toute clé LITTÉRALE utilisée dans les sources existe (ANO-WEB-02).
 *    Le miroir FR/EN ne voit qu'une chose : que les deux locales disent
 *    la même chose. Il ne voit pas une clé utilisée qu'AUCUNE locale ne
 *    définit — next-intl affiche alors le CHEMIN DE LA CLÉ à l'écran.
 *    Mesuré en recette navigateur : la porte « Connecte-toi pour
 *    réserver » affichait deux boutons intitulés « booking.authGate.login »
 *    et « booking.authGate.register », dans les deux langues.
 *
 * Usage : node scripts/check-i18n-messages.mjs
 * Sort avec le code 1 et un rapport détaillé à la moindre divergence.
 *
 * Quand une nouvelle locale est ajoutée (es, pt...), il n'y a RIEN à
 * changer ici : toute locale présente dans le dossier est vérifiée
 * contre la référence.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const MESSAGES_DIR = "apps/user-ui/messages";
const REFERENCE_LOCALE = "fr";
const SOURCES_DIR = "apps/user-ui/src";

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

/* ── Règle 5 : une clé utilisée dans les sources existe-t-elle ? (ANO-WEB-02) ──
 *
 * On ne cherche que ce qui est CERTAIN : `useTranslations("ns")` avec un littéral, puis les
 * `t("clé")` du même fichier, littéraux eux aussi. Tout ce qui est calculé — `t(variable)`,
 * `t(`préfixe.${x}`)` — est ignoré : un garde-fou qui crie sur du code juste finit désactivé,
 * et on perd la règle avec le test (leçon de la campagne API).
 */
function fichiersSources(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...fichiersSources(p));
    else if (/\.tsx?$/.test(p) && !/\.spec\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

/**
 * Le nom d'un espace de noms n'est PAS le nom du fichier : `request.ts` monte
 * `trip-detail.json` sous `tripDetail`, `user-profile.json` sous `userProfile`. La carte se lit
 * donc à la source — les imports et le bloc `messages` sont dans le même ordre.
 */
function espacesDeNoms() {
  const chemin = join(SOURCES_DIR, "i18n/request.ts");
  if (!existsSync(chemin)) return null;
  const code = readFileSync(chemin, "utf8");
  const fichiers = [...code.matchAll(/messages\/\$\{locale\}\/([\w.-]+\.json)/g)].map((m) => m[1]);
  const noms = [...code.matchAll(/^\s*(\w+):\s*\w+\.default,?\s*(?:\/\/.*)?$/gm)].map((m) => m[1]);
  if (fichiers.length === 0 || fichiers.length !== noms.length) return null;
  return new Map(fichiers.map((f, i) => [f, noms[i]]));
}

/** Toutes les clés de toutes les locales, en chemins complets « namespace.a.b ». */
function clesConnues(carte) {
  const connues = new Set();
  for (const locale of locales) {
    const dir = join(MESSAGES_DIR, locale);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      let tree;
      try {
        tree = JSON.parse(readFileSync(join(dir, f), "utf8"));
      } catch {
        continue;
      }
      const ns = carte.get(f) ?? f.replace(/\.json$/, "");
      for (const k of keyPaths(tree)) connues.add(`${ns}.${k}`);
    }
  }
  return connues;
}

const carteEspaces = espacesDeNoms();
if (existsSync(SOURCES_DIR) && carteEspaces === null) {
  fail("[source] carte des espaces de noms illisible dans src/i18n/request.ts (règle 5 inopérante)");
}
if (existsSync(SOURCES_DIR) && carteEspaces !== null) {
  const connues = clesConnues(carteEspaces);
  let verifiees = 0;
  for (const fichier of fichiersSources(SOURCES_DIR)) {
    const code = readFileSync(fichier, "utf8");
    // `const t = useTranslations("ns")` → { t: "ns" }. Le nom de la variable compte : un
    // fichier utilise souvent deux ou trois espaces de noms (t, tGate, tBooking…).
    // Un même nom de variable peut être lié à DEUX espaces de noms dans un même fichier
    // (deux composants, deux portées). On ne peut alors plus attribuer un `t("…")` à coup sûr :
    // on renonce pour cette variable-là, plutôt que de crier sur du code juste.
    const liaisons = new Map();
    for (const m of code.matchAll(/(?:const|let)\s+(\w+)\s*=\s*useTranslations\(\s*"([^"]+)"\s*\)/g)) {
      if (liaisons.has(m[1])) {
        liaisons.set(m[1], null); // deux espaces pour un même nom : on ne peut plus attribuer
        continue;
      }
      liaisons.set(m[1], { ns: m[2], depuis: m.index });
    }
    const espaces = new Map([...liaisons].filter(([, v]) => v !== null));
    if (espaces.size === 0) continue;
    for (const [variable, { ns, depuis }] of espaces) {
      const appel = new RegExp(`\\b${variable}(?:\\.rich)?\\(\\s*"([^"]+)"`, "g");
      for (const m of code.matchAll(appel)) {
        // Une liaison ne gouverne que ce qui la SUIT : un `t("…")` situé plus haut dans le
        // fichier appartient à une autre fonction, qui reçoit souvent `t` en paramètre.
        if (m.index < depuis) continue;
        // Une clé qui se termine par un point est un PRÉFIXE concaténé (`t("cat." + x)`) :
        // elle n'existe pas telle quelle et n'a pas à exister.
        if (m[1].endsWith(".")) continue;
        const chemin = `${ns}.${m[1]}`;
        verifiees += 1;
        if (!connues.has(chemin)) {
          fail(`[source] clé absente de toutes les locales : ${chemin} — ${fichier.replace(SOURCES_DIR + "/", "")}`);
        }
      }
    }
  }
  // Garde-fou du garde-fou : si le motif ne trouve plus rien, la règle 5 ne garde plus rien.
  if (verifiees < 200) {
    fail(`[source] seulement ${verifiees} clé(s) littérale(s) analysée(s) : le motif de recherche ne reconnaît plus les appels (règle 5 inopérante)`);
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
