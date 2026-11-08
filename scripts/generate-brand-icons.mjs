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

/* ── Les sources vectorielles ─────────────────────────────────────────────── */

const MANGO = "#FF9900";
const TEAL = "#0F766E";

/** Le fond PLEIN, sans arrondi : c'est le système qui masque les coins. */
const fond = `<rect width="240" height="240" fill="${MANGO}"/>`;

const trait = (d, w) =>
  `<path fill="none" stroke="#FFFFFF" stroke-width="${w}" stroke-linecap="round" ` +
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

/* ── Ce qu'on produit ─────────────────────────────────────────────────────── */

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
