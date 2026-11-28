/**
 * argent-dans-la-langue.spec.ts — D123, le symbole fait partie du nombre.
 * =======================================================================
 * Le défaut, vu à l'écran le 28/11/2026 sur l'application en ANGLAIS :
 *
 *     You earn 23.00 €
 *
 * Le nombre suivait bien la langue — D108 avait fait ce travail — mais le
 * symbole était collé derrière lui, dans tous les cas. L'anglais écrit
 * « €23.00 » : le symbole PRÉCÈDE. La moitié du travail de localisation d'un
 * montant n'avait jamais été faite, et elle est invisible depuis le français,
 * où la place du symbole est précisément celle qu'on produit par accident.
 *
 * Cette fiche tient trois choses :
 *   ① le COMPORTEMENT du module partagé, dans les deux langues ;
 *   ② qu'aucun écran ne recompose un montant à la main (balayage du code) ;
 *   ③ qu'aucune PHRASE de dictionnaire ne porte le symbole (balayage des
 *     messages) — c'est là que la moitié du défaut se cachait : onze clés
 *     anglaises écrivaient « {amount} € » et « {price} €/kg ».
 *
 * Les balayages DÉPOUILLENT les commentaires avant de chercher, et COMPTENT
 * ce qu'ils ont balayé : viser un mot qui vit aussi dans le commentaire qui
 * l'explique est le défaut le plus fréquent de ce dépôt, et un balayage qui
 * ne balaye rien est vert pour la pire raison.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  DEFAULT_CURRENCY,
  formatMoney,
  formatMoneyCompact,
  formatMoneyFromCents,
  formatPerKg,
} from '@/lib/pricing-example';

const RACINE = resolve(__dirname, '../..');

function fichiers(dossier: string, extensions: string[]): string[] {
  const trouves: string[] = [];
  const parcourir = (chemin: string) => {
    for (const entree of readdirSync(chemin)) {
      const complet = join(chemin, entree);
      if (statSync(complet).isDirectory()) parcourir(complet);
      else if (extensions.some((e) => entree.endsWith(e)) && !entree.endsWith('.spec.ts'))
        trouves.push(complet);
    }
  };
  parcourir(join(RACINE, dossier));
  return trouves;
}

function sansCommentaires(source: string): string {
  const net = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // Le garde du dépouilleur : il doit retirer les commentaires, pas le code.
  // On ne mesure PAS un ratio — plusieurs fichiers de ce dépôt sont surtout
  // du commentaire, et un seuil de longueur rougissait sur eux pour rien.
  // Ce qui prouve qu'il reste du code, c'est qu'il reste une déclaration.
  expect(net).toMatch(/\b(import|export|const|function|return)\b/);
  return net;
}

/* ══ ① Le comportement ═══════════════════════════════════════════════════ */

describe('① un montant s’écrit dans la langue du lecteur, symbole compris', () => {
  it('le français met le symbole APRÈS, l’anglais AVANT', () => {
    const fr = formatMoneyFromCents(2300, 'fr-FR');
    const en = formatMoneyFromCents(2300, 'en-US');
    // Le défaut exact : « You earn 23.00 € » au lieu de « You earn €23.00 ».
    expect(fr.indexOf('€')).toBeGreaterThan(fr.indexOf('23'));
    expect(en.indexOf('€')).toBeLessThan(en.indexOf('23'));
  });

  it('le séparateur décimal suit la langue, lui aussi', () => {
    expect(formatMoneyFromCents(2485, 'fr-FR')).toContain('24,85');
    expect(formatMoneyFromCents(2485, 'en-US')).toContain('24.85');
  });

  it('deux décimales toujours — un montant rond ne perd pas sa précision', () => {
    // La variante « entier si rond » est exactement la divergence supprimée :
    // elle existait en onze copies d'un côté et trois de l'autre.
    expect(formatMoneyFromCents(300, 'fr-FR')).toContain('3,00');
    expect(formatMoney(3, 'en-US')).toContain('3.00');
  });

  it('les centimes ne sont JAMAIS perdus par un arrondi', () => {
    // Le défaut de `formatPriceShort` côté page publique : `Math.floor` rendait
    // « 24 € » pour 24,85 €.
    expect(formatMoneyFromCents(2485, 'fr-FR')).not.toContain('24 ');
    expect(formatMoneyCompact(24.85, 'fr-FR')).toContain('24,85');
  });

  it('une graduation n’affiche pas de décimales inutiles', () => {
    // Une rangée de repères se lit d'un coup d'œil ; « 8,00 € » y ajoute deux
    // caractères qui ne portent aucune information.
    expect(formatMoneyCompact(8, 'fr-FR')).not.toContain('8,00');
    expect(formatMoneyCompact(11.5, 'fr-FR')).toContain('11,5');
  });

  it('un tarif au kilo porte son unité, et elle ne se traduit pas', () => {
    expect(formatPerKg(11.5, 'fr-FR')).toContain('/kg');
    expect(formatPerKg(11.5, 'en-US')).toContain('/kg');
    expect(formatPerKg(11.5, 'en-US').startsWith('€')).toBe(true);
  });

  it('la devise est un CODE, pas un caractère', () => {
    expect(DEFAULT_CURRENCY).toBe('EUR');
    // Une autre devise doit sortir écrite, pas recopiée telle quelle à côté du
    // nombre : le dépôt avait deux tables devise→symbole à une seule entrée.
    const usd = formatMoneyFromCents(2300, 'en-US', 'USD');
    expect(usd).toContain('$');
    expect(usd).not.toContain('USD');
  });

  it('un code inconnu ne fait pas tomber l’écran', () => {
    // Hermes sans données Intl, ou un code refusé : un chiffre lisible, jamais
    // un écran blanc.
    expect(() => formatMoneyFromCents(2300, 'fr-FR', 'PAS_UNE_DEVISE')).not.toThrow();
    expect(formatMoneyFromCents(2300, 'fr-FR', 'PAS_UNE_DEVISE')).toContain('23.00');
  });
});

/* ══ ② Aucun écran ne recompose un montant ═══════════════════════════════ */

describe('② le symbole n’est jamais collé à la main dans un écran', () => {
  const SOURCES = [...fichiers('src/app', ['.tsx', '.ts']), ...fichiers('src/components', ['.tsx', '.ts'])];

  it('le balayage a bien balayé', () => {
    expect(SOURCES.length).toBeGreaterThan(40);
  });

  it.each(SOURCES.map((c) => [c.replace(RACINE + '/', ''), c]))(
    '%s ne compose pas « nombre + € »',
    (_nom, chemin) => {
      const net = sansCommentaires(readFileSync(chemin, 'utf8'));
      // Les deux formes qui existaient : `${…} €` dans un gabarit, et « {x} € »
      // en JSX. Le pas-à-pas du prix est l'exception NOMMÉE : il affiche un
      // grand nombre et, dessous, une UNITÉ (« €/kg », comme « km/h »).
      const exception = chemin.endsWith('publish-trip/price.tsx');
      const colle = /\}\s*€|€\$\{|\{\s*currency\s*\}/.test(net);
      expect(colle && !exception).toBe(false);
    }
  );

  it('aucune table devise→symbole ne survit', () => {
    for (const chemin of SOURCES) {
      const net = sansCommentaires(readFileSync(chemin, 'utf8'));
      expect(net).not.toMatch(/===\s*'EUR'\s*\?\s*'€'/);
      expect(net).not.toMatch(/currency\s*\?\?\s*'€'/);
    }
  });
});

/* ══ ③ Aucune phrase de dictionnaire ne porte le symbole ═════════════════ */

describe('③ une phrase de dictionnaire ne connaît pas le symbole', () => {
  const DICTIONNAIRES = [...fichiers('messages/fr', ['.json']), ...fichiers('messages/en', ['.json'])];

  it('les deux dictionnaires sont là', () => {
    expect(DICTIONNAIRES.length).toBeGreaterThan(20);
  });

  it.each(DICTIONNAIRES.map((c) => [c.replace(RACINE + '/', ''), c]))(
    '%s n’écrit pas « {x} € »',
    (_nom, chemin) => {
      const brut = readFileSync(chemin, 'utf8');
      // Le défaut : « {amount} € », « {price} €/kg » — la place française du
      // symbole gravée dans le dictionnaire ANGLAIS.
      expect(brut).not.toMatch(/\{[a-zA-Z]+(, *number)?\}\s*€/);
    }
  );
});
