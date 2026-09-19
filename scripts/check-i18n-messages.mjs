#!/usr/bin/env node
/**
 * ⭐ D10 — Vérification des messages i18n (apps/user-ui/messages,
 * et depuis le lot i18n mobile D36 : apps/mobile/messages, mêmes règles 1-6).
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
 * 6. Le vocabulaire des valeurs (lexique `scripts/lexique-yamba.json`, recette 5.32).
 * 7. Chaque type d'événement de réservation a son texte de notification (recette 5.32).
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

/* ── Règle 6 : le vocabulaire (recette 5.32, WEB-VOC) ──
 * Les VALEURS des messages ne portent ni mot de rôle refusé, ni « assurance », ni vouvoiement, ni texte
 * vide ou « — » à la place d'une phrase. Mesuré en recette : « carrier » dans 23 chaînes anglaises (le rôle
 * s'appelle « Traveler », A144), 41 chaînes françaises au vouvoiement, « ton assurance » sur l'écran de
 * remise, une notification rédigée « — » / « — ». Le miroir FR/EN ne voit rien de tout cela : les deux
 * locales peuvent être également fausses.
 * Portée : les fichiers de messages seulement. Les textes écrits en dur dans les composants (`isFr ? … : …`)
 * y échappent — c'est la dette que ce garde-fou pousse à résorber, pas une exemption.
 */
/** Le lexique vit dans `scripts/lexique-yamba.json` : la recette (web-voc.spec.ts) lit LE MÊME fichier. */
const LEXIQUE = JSON.parse(readFileSync("scripts/lexique-yamba.json", "utf8"));
const VOCABULAIRE = Object.fromEntries(
  ["fr", "en"].map((l) => [
    l,
    LEXIQUE[l].map((r) => ({ motif: new RegExp(r.motif, r.drapeaux), raison: r.raison, sauf: r.sauf ? new RegExp(r.sauf, "i") : undefined })),
  ])
);
function valeurs(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.push([path, v]);
    else if (v !== null && typeof v === "object") out.push(...valeurs(v, path));
  }
  return out;
}
{
  let lues = 0;
  for (const locale of locales) {
    const regles = VOCABULAIRE[locale] ?? [];
    for (const file of readdirSync(join(MESSAGES_DIR, locale)).filter((f) => f.endsWith(".json"))) {
      let tree;
      try {
        tree = JSON.parse(readFileSync(join(MESSAGES_DIR, locale, file), "utf8"));
      } catch {
        continue; // déjà signalé par la règle 1
      }
      for (const [chemin, texte] of valeurs(tree)) {
        lues += 1;
        if (/^\s*[—–-]?\s*$/.test(texte)) fail(`[${locale}/${file}] texte vide ou « — » à la place d'une phrase : ${chemin}`);
        for (const { motif, raison, sauf } of regles) {
          if (motif.test(texte) && !(sauf && sauf.test(texte))) fail(`[${locale}/${file}] ${raison} : ${chemin} = « ${texte.slice(0, 90)} »`);
        }
      }
    }
  }
  if (lues < 1000) fail(`[vocabulaire] seulement ${lues} texte(s) lu(s) : la règle 6 ne lit plus les messages`);
}

/* ── Règle 7 : chaque événement de réservation a son texte de notification (recette 5.32) ──
 * Le front compose `notifications.copy.<type avec _>.<RÔLE>.{title,line}` DYNAMIQUEMENT : la règle 5 (clés
 * littérales) ne le voit pas, et une clé absente afficherait son chemin. La liste des types vient du contrat
 * (`BOOKING_EVENT_TYPES`, api-contracts) ; un type ajouté sans texte fait échouer la CI.
 */
{
  const contrat = readFileSync("packages/libs/api-contracts/src/booking/booking-events.schema.ts", "utf8");
  const liste = contrat.match(/BOOKING_EVENT_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  const types = liste ? [...liste[1].matchAll(/"([a-z_.]+)"/g)].map((m) => m[1]) : [];
  if (types.length < 10) fail(`[notifications] ${types.length} type(s) d'événement lu(s) dans le contrat : la règle 7 ne lit plus BOOKING_EVENT_TYPES`);
  const complet = (n) =>
    n && typeof n === "object" && ((typeof n.title === "string" && typeof n.line === "string") || Object.values(n).some((x) => x && typeof x === "object" && typeof x.title === "string"));
  for (const locale of locales) {
    let copie;
    try {
      copie = JSON.parse(readFileSync(join(MESSAGES_DIR, locale, "notifications.json"), "utf8")).copy ?? {};
    } catch {
      continue;
    }
    for (const type of types) {
      const cle = type.replace(/\./g, "_");
      for (const role of ["SHIPPER", "CARRIER"]) {
        if (!complet(copie[cle]?.[role])) fail(`[${locale}/notifications.json] événement « ${type} » sans texte complet pour ${role} : copy.${cle}.${role}.{title,line}`);
      }
    }
  }
}

/* ── Le MOBILE (lot i18n D36) : les règles 1 à 6 sur apps/mobile/messages ──
 *
 * Les dictionnaires du mobile vivent près de l'app, pas dans user-ui — mais ils obéissent aux
 * mêmes règles : parse, miroir FR/EN, clés sans point, lexique, clés littérales. La carte des
 * espaces de noms se lit dans `src/i18n/messages.ts` (imports STATIQUES : Metro ne sait pas
 * composer `messages/${locale}/…` comme next-intl côté serveur) : une ligne d'import par fichier,
 * une liaison `espace: variable` par entrée du bloc `fr`. La règle 7 (textes de notification)
 * reste propre au web tant que le mobile n'a pas de centre de notifications.
 */
{
  const DOSSIER = "apps/mobile/messages";
  const SOURCES = "apps/mobile/src";
  const CHARGEUR = "apps/mobile/src/i18n/messages.ts";

  if (!existsSync(DOSSIER)) {
    fail(`[mobile] dossier introuvable : ${DOSSIER} — le mobile a perdu ses messages`);
  } else {
    const localesMobiles = readdirSync(DOSSIER, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    /* Règles 1 à 4 : parse, mêmes fichiers, miroir de clés, clés sans point. */
    const refDirMobile = join(DOSSIER, REFERENCE_LOCALE);
    const refFichiers = existsSync(refDirMobile)
      ? readdirSync(refDirMobile).filter((f) => f.endsWith(".json")).sort()
      : [];
    if (refFichiers.length === 0) fail(`[mobile] aucun fichier de messages en ${REFERENCE_LOCALE}`);

    const refArbres = new Map();
    for (const file of refFichiers) {
      const p = join(refDirMobile, file);
      try {
        const tree = JSON.parse(readFileSync(p, "utf8"));
        refArbres.set(file, tree);
        for (const key of invalidKeys(tree)) fail(`Clé refusée (point ou vide) : ${p} → "${key}"`);
      } catch (e) {
        fail(`JSON invalide : ${p} — ${e.message}`);
      }
    }
    for (const locale of localesMobiles) {
      if (locale === REFERENCE_LOCALE) continue;
      const dir = join(DOSSIER, locale);
      const fichiers = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
      for (const f of refFichiers) {
        if (!fichiers.includes(f)) fail(`[mobile ${locale}] fichier manquant : ${f} (présent en ${REFERENCE_LOCALE})`);
      }
      for (const f of fichiers) {
        if (!refFichiers.includes(f)) fail(`[mobile ${locale}] fichier orphelin : ${f} (absent de ${REFERENCE_LOCALE})`);
      }
      for (const file of fichiers) {
        if (!refArbres.has(file)) continue;
        const p = join(dir, file);
        let tree;
        try {
          tree = JSON.parse(readFileSync(p, "utf8"));
        } catch (e) {
          fail(`JSON invalide : ${p} — ${e.message}`);
          continue;
        }
        for (const key of invalidKeys(tree)) fail(`Clé refusée (point ou vide) : ${p} → "${key}"`);
        const refKeys = keyPaths(refArbres.get(file));
        const locKeys = keyPaths(tree);
        for (const k of refKeys) {
          if (!locKeys.has(k)) fail(`[mobile ${locale}/${file}] clé manquante : ${k}`);
        }
        for (const k of locKeys) {
          if (!refKeys.has(k)) fail(`[mobile ${locale}/${file}] clé orpheline : ${k} (absente de ${REFERENCE_LOCALE})`);
        }
      }
    }

    /* Règle 6 : le lexique s'applique aussi aux valeurs du mobile. */
    let luesMobile = 0;
    for (const locale of localesMobiles) {
      const regles = VOCABULAIRE[locale] ?? [];
      for (const file of readdirSync(join(DOSSIER, locale)).filter((f) => f.endsWith(".json"))) {
        let tree;
        try {
          tree = JSON.parse(readFileSync(join(DOSSIER, locale, file), "utf8"));
        } catch {
          continue; // déjà signalé
        }
        for (const [chemin, texte] of valeurs(tree)) {
          luesMobile += 1;
          if (/^\s*[—–-]?\s*$/.test(texte)) fail(`[mobile ${locale}/${file}] texte vide ou « — » : ${chemin}`);
          for (const { motif, raison, sauf } of regles) {
            if (motif.test(texte) && !(sauf && sauf.test(texte))) fail(`[mobile ${locale}/${file}] ${raison} : ${chemin} = « ${texte.slice(0, 90)} »`);
          }
        }
      }
    }
    if (luesMobile < 10) fail(`[mobile vocabulaire] seulement ${luesMobile} texte(s) lu(s) : le bloc mobile ne lit plus les messages`);

    /* Règle 5 : chaque clé LITTÉRALE utilisée dans apps/mobile/src existe.
     * Mêmes motifs que le web, guillemets simples compris (style de l'app). */
    function carteMobile() {
      if (!existsSync(CHARGEUR)) return null;
      const code = readFileSync(CHARGEUR, "utf8");
      const importsParVariable = new Map();
      for (const m of code.matchAll(/import (\w+) from '\.\.\/\.\.\/messages\/fr\/([\w.-]+\.json)'/g)) {
        importsParVariable.set(m[1], m[2]);
      }
      const blocFr = code.match(/\bfr:\s*\{([^}]*)\}/);
      if (!blocFr) return null;
      const carte = new Map();
      for (const m of blocFr[1].matchAll(/(\w+):\s*(\w+)/g)) {
        const fichier = importsParVariable.get(m[2]);
        if (fichier) carte.set(fichier, m[1]);
      }
      return carte.size > 0 ? carte : null;
    }
    const carteM = carteMobile();
    if (carteM === null) {
      fail(`[mobile source] carte des espaces de noms illisible dans ${CHARGEUR} (règle 5 inopérante)`);
    } else {
      for (const file of refFichiers) {
        if (!carteM.has(file)) fail(`[mobile source] ${file} n'est chargé par aucun espace de noms de ${CHARGEUR}`);
      }
      const connuesMobile = new Set();
      for (const locale of localesMobiles) {
        for (const f of readdirSync(join(DOSSIER, locale)).filter((x) => x.endsWith(".json"))) {
          let tree;
          try {
            tree = JSON.parse(readFileSync(join(DOSSIER, locale, f), "utf8"));
          } catch {
            continue;
          }
          const ns = carteM.get(f) ?? f.replace(/\.json$/, "");
          for (const k of keyPaths(tree)) connuesMobile.add(`${ns}.${k}`);
        }
      }
      let verifieesMobile = 0;
      for (const fichier of fichiersSources(SOURCES)) {
        const code = readFileSync(fichier, "utf8");
        const liaisons = new Map();
        for (const m of code.matchAll(/(?:const|let)\s+(\w+)\s*=\s*useTranslations\(\s*['"]([^'"]+)['"]\s*\)/g)) {
          if (liaisons.has(m[1])) {
            liaisons.set(m[1], null);
            continue;
          }
          liaisons.set(m[1], { ns: m[2], depuis: m.index });
        }
        const espaces = new Map([...liaisons].filter(([, v]) => v !== null));
        if (espaces.size === 0) continue;
        for (const [variable, { ns, depuis }] of espaces) {
          const appel = new RegExp(`\\b${variable}(?:\\.rich)?\\(\\s*['"]([^'"]+)['"]`, "g");
          for (const m of code.matchAll(appel)) {
            if (m.index < depuis) continue;
            if (m[1].endsWith(".")) continue;
            const chemin = `${ns}.${m[1]}`;
            verifieesMobile += 1;
            if (!connuesMobile.has(chemin)) {
              fail(`[mobile source] clé absente de toutes les locales : ${chemin} — ${fichier.replace(SOURCES + "/", "")}`);
            }
          }
        }
      }
      if (verifieesMobile < 5) {
        fail(`[mobile source] seulement ${verifieesMobile} clé(s) littérale(s) analysée(s) : le motif ne reconnaît plus les appels du mobile (règle 5 inopérante)`);
      }
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
  `${refFiles.length} namespace(s), ${totalFiles} fichiers (+ mobile) : parse OK, miroir parfait.`
);
