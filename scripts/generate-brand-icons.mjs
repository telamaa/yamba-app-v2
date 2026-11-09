#!/usr/bin/env node
/**
 * generate-brand-icons.mjs — les icônes de Yamba, depuis UNE source vectorielle.
 * ==============================================================================
 * Le symbole « Porter » (D84bis) existe en trois cadrages, et ce n'est pas de
 * la coquetterie : une icône n'est pas un logo mis à l'échelle.
 *
 *   • le FAVICON (`src/app/icon.svg`) est vu à 16 px : coins arrondis, trait
 *     épais, colis gros — il est écrit à la main et n'est PAS généré ici ;
 *   • l'ICÔNE D'APP (apple-icon, 192, 512, 1024) a un fond PLEIN sans arrondi :
 *     c'est le système qui masque les coins, et un arrondi déjà dessiné
 *     produirait un double arrondi sur iOS ;
 *   • l'icône MASKABLE d'Android est encore plus resserrée : le système peut
 *     rogner jusqu'à 20 % de chaque bord (cercle, goutte, carré arrondi), donc
 *     le dessin tient dans la « zone de sécurité » centrale de 80 %.
 *
 * Usage :
 *     npm i -D sharp
 *     node scripts/generate-brand-icons.mjs
 *
 * Le script est IDEMPOTENT : il réécrit les mêmes octets à partir des mêmes
 * sources. Le lancer deux fois ne produit aucun diff.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const UI = resolve(ICI, "..", "apps", "user-ui");
const MOBILE = resolve(ICI, "..", "apps", "mobile");

/* ── Les sources vectorielles ─────────────────────────────────────────────── */

const MANGO = "#FF9900";
const TEAL = "#0F766E";

/** Le fond PLEIN, sans arrondi : c'est le système qui masque les coins. */
const fond = `<rect width="240" height="240" fill="${MANGO}"/>`;

const trait = (d, w, couleur = "#FFFFFF") =>
  `<path fill="none" stroke="${couleur}" stroke-width="${w}" stroke-linecap="round" ` +
  `stroke-linejoin="round" d="${d}"/>`;

const colis = (cy, r) => `<circle cx="120" cy="${cy}" r="${r}" fill="${TEAL}"/>`;

const svg = (corps) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" ` +
  `viewBox="0 0 240 240">${corps}</svg>`;

/** Icône d'app : le dessin occupe tout le carré. */
const APP = svg(
  fond +
    trait("M60 60 C69 108 91 130 120 130 C149 130 171 108 180 60 M120 130 V186", 22) +
    colis(86, 15)
);

/**
 * Icône maskable Android : MÊME fond, dessin RESSERRÉ dans les 80 % centraux.
 * Sans ce resserrement, le masque en cercle couperait les bras du Y.
 */
const MASKABLE = svg(
  fond +
    trait("M72 72 C79 111 97 128 120 128 C143 128 161 111 168 72 M120 128 V174", 18) +
    colis(94, 12)
);

/* ── Les sources de l'application native (D86) ────────────────────────────── */

/**
 * Android compose son icône adaptative en DEUX couches : un fond et un
 * premier plan, chacun en 108 dp dont seuls les **72 dp centraux** sont
 * garantis visibles (le système anime et masque le reste). Le premier plan
 * est donc TRANSPARENT et son dessin tient dans ces 66 % centraux — plus
 * resserré encore que le maskable du web.
 */
const ANDROID_PREMIER_PLAN = svg(
  trait("M78 78 C84 114 100 129 120 129 C140 129 156 114 162 78 M120 129 V168", 16) +
    colis(98, 11)
);

/** Le fond : une couleur pleine, rien d'autre. C'est la règle d'Android. */
const ANDROID_FOND = svg(`<rect width="240" height="240" fill="${MANGO}"/>`);

/**
 * L'icône MONOCHROME d'Android 13+ (« icônes thématiques ») : le système ne
 * lit QUE la silhouette et la recolore avec le fond d'écran. Tout doit donc
 * être de la même couleur — le colis compris, sans quoi il disparaîtrait.
 */
const ANDROID_MONOCHROME = svg(
  `<path fill="none" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round" ` +
    `stroke-linejoin="round" d="M78 78 C84 114 100 129 120 129 C140 129 156 114 162 78 M120 129 V168"/>` +
    `<circle cx="120" cy="98" r="11" fill="#FFFFFF"/>`
);

/**
 * L'écran de démarrage (revu le 09/11/2026, D90) : **le symbole seul**, sans
 * pastille mango derrière lui et sans le mot. Le Y est donc MANGO — il n'est
 * plus posé sur du mango — et le fond est celui de la PAGE, pas une couleur
 * de marque.
 *
 * Deux fichiers et non un, pour la même raison que `yamba-symbol.svg` et son
 * jumeau sombre : seul le COLIS change. Le teal #0F766E est illisible sur du
 * noir, le turquoise #2DD4BF est la valeur que l'app utilise déjà partout
 * ailleurs en thème sombre (`Colors.dark.tint`, `yamba-symbol-dark.svg`). Le Y
 * mango, lui, tient sur les deux fonds et ne change jamais.
 */
const TEAL_SOMBRE = "#2DD4BF";

const symboleSeul = (colisTeinte) =>
  svg(
    trait("M60 60 C69 108 91 130 120 130 C149 130 171 108 180 60 M120 130 V186", 22, MANGO) +
      `<circle cx="120" cy="86" r="15" fill="${colisTeinte}"/>`
  );

const SPLASH = symboleSeul(TEAL);
const SPLASH_SOMBRE = symboleSeul(TEAL_SOMBRE);

/* ── Ce qu'on produit ─────────────────────────────────────────────────────── */

/** Les PNG de l'application native. `alpha` quand la couche doit se superposer. */
const PNGS_MOBILE = [
  // iOS et le repli : fond plein, aucun arrondi (le système masque).
  { src: APP, taille: 1024, sortie: "assets/images/icon.png" },
  // Android adaptatif : deux couches qui se superposent, donc alpha des deux côtés.
  { src: ANDROID_PREMIER_PLAN, taille: 432, sortie: "assets/images/android-icon-foreground.png", alpha: true },
  { src: ANDROID_FOND, taille: 432, sortie: "assets/images/android-icon-background.png" },
  { src: ANDROID_MONOCHROME, taille: 432, sortie: "assets/images/android-icon-monochrome.png", alpha: true },
  // L'écran de démarrage et le favicon de l'export web d'Expo.
  { src: SPLASH, taille: 512, sortie: "assets/images/splash-icon.png", alpha: true },
  { src: SPLASH_SOMBRE, taille: 512, sortie: "assets/images/splash-icon-dark.png", alpha: true },
  { src: APP, taille: 64, sortie: "assets/images/favicon.png" },
];

const PNGS = [
  { src: APP, taille: 180, sortie: "src/app/apple-icon.png" },
  { src: APP, taille: 192, sortie: "public/brand/yamba-icon-192.png" },
  { src: APP, taille: 512, sortie: "public/brand/yamba-icon-512.png" },
  { src: APP, taille: 1024, sortie: "public/brand/yamba-icon-1024.png" },
  { src: MASKABLE, taille: 512, sortie: "public/brand/yamba-icon-maskable-512.png" },
];

/** Le favicon multi-tailles, à partir du cadrage ARRONDI de `src/app/icon.svg`. */
const FAVICON = svg(
  `<rect width="240" height="240" rx="52" fill="${MANGO}"/>` +
    trait("M48 48 C58 104 84 128 120 128 C156 128 182 104 192 48 M120 128 V200", 28) +
    colis(74, 22)
);
const TAILLES_ICO = [16, 32, 48];

/* ── L'encodeur ICO, écrit à la main ──────────────────────────────────────── */

/**
 * Un `.ico` est un conteneur très simple : un en-tête de 6 octets, puis une
 * entrée de 16 octets par image, puis les images bout à bout. Depuis Vista, ces
 * images peuvent être des PNG tels quels — donc aucune dépendance de plus n'est
 * nécessaire, là où `png-to-ico` en ajouterait une pour quarante lignes.
 */
function encoderIco(images) {
  const entete = Buffer.alloc(6);
  entete.writeUInt16LE(0, 0); // réservé
  entete.writeUInt16LE(1, 2); // type 1 = icône
  entete.writeUInt16LE(images.length, 4);

  let decalage = 6 + images.length * 16;
  const entrees = [];
  for (const { taille, png } of images) {
    const e = Buffer.alloc(16);
    // 256 px s'écrit 0 dans ce champ d'un octet — Yamba n'y va pas, mais la
    // règle mérite d'être dans le code plutôt que dans une tête.
    e.writeUInt8(taille >= 256 ? 0 : taille, 0); // largeur
    e.writeUInt8(taille >= 256 ? 0 : taille, 1); // hauteur
    e.writeUInt8(0, 2); // palette : aucune
    e.writeUInt8(0, 3); // réservé
    e.writeUInt16LE(1, 4); // plans
    e.writeUInt16LE(32, 6); // bits par pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(decalage, 12);
    decalage += png.length;
    entrees.push(e);
  }
  return Buffer.concat([entete, ...entrees, ...images.map((i) => i.png)]);
}

/* ── Exécution ────────────────────────────────────────────────────────────── */

async function main() {
  let sharp;
  try {
    ({ default: sharp } = await import("sharp"));
  } catch {
    console.error(
      "\n  sharp est absent.\n\n" +
        "      npm i -D sharp\n\n" +
        "  (seule dépendance de ce script ; l'encodage .ico est fait à la main.)\n"
    );
    process.exit(1);
  }

  /**
   * DEUX contraintes vraies et OPPOSÉES sur le canal alpha — mesurées le
   * 08/11/2026, la seconde en cassant le site :
   *
   *   • les PNG autonomes n'en veulent PAS. L'App Store REFUSE une icône qui
   *     porte un canal alpha, et `yamba-icon-1024.png` est justement la source
   *     des stores. `flatten` l'enlève (le fond est déjà plein : rien ne
   *     change à l'œil, seul le mode couleur passe de RGBA à RGB) ;
   *
   *   • les PNG EMBARQUÉS dans le `.ico` en EXIGENT un. Le décodeur de Next
   *     (la caisse Rust `image`) refuse net :
   *         « Format error decoding Ico: The PNG is not in RGBA format! »
   *     et c'est la PAGE ENTIÈRE qui part en 500, pas seulement le favicon.
   *
   * D'où le drapeau. Ne pas le « simplifier » : les deux cas ont été payés.
   */
  const rendu = (source, taille, { alpha = false } = {}) => {
    const p = sharp(Buffer.from(source)).resize(taille, taille);
    return (alpha ? p : p.flatten({ background: MANGO }))
      .png({ compressionLevel: 9 })
      .toBuffer();
  };

  for (const { src, taille, sortie } of PNGS) {
    const chemin = join(UI, sortie);
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, await rendu(src, taille));
    console.log(`  ✓ ${sortie.padEnd(42)} ${taille}×${taille}`);
  }

  for (const { src, taille, sortie, alpha } of PNGS_MOBILE) {
    const chemin = join(MOBILE, sortie);
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, await rendu(src, taille, { alpha: Boolean(alpha) }));
    console.log(`  ✓ mobile/${sortie.padEnd(34)} ${taille}×${taille}`);
  }

  const images = [];
  for (const taille of TAILLES_ICO) {
    // alpha OBLIGATOIRE ici : voir le commentaire de `rendu`.
    images.push({ taille, png: await rendu(FAVICON, taille, { alpha: true }) });
  }
  const ico = join(UI, "src/app/favicon.ico");
  writeFileSync(ico, encoderIco(images));
  console.log(`  ✓ ${"src/app/favicon.ico".padEnd(42)} ${TAILLES_ICO.join("/")}`);

  console.log(
    "\n  `src/app/icon.svg` n'est PAS régénéré : c'est une source écrite à la main.\n"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
