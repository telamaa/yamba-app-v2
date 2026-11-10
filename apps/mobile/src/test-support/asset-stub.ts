/**
 * asset-stub.ts — ce que `require('…​.ttf')` rend sous jest (D95).
 * ================================================================
 * Metro transforme un actif binaire en IDENTIFIANT NUMÉRIQUE ; Node, lui, ne
 * sait pas lire un `.ttf` et jette. Le harnais est volontairement
 * `testEnvironment: node` et ne rend aucun composant (A223) — mais depuis que
 * la police de la marque est embarquée (D95), un module de constantes
 * parfaitement pur importe cinq fichiers de police.
 *
 * Ce bouchon rend donc ce que Metro rendrait : un nombre. Les fiches peuvent
 * ainsi vérifier que CHAQUE niveau pointe un actif, sans rien savoir de son
 * contenu — ce qui est exactement la frontière du harnais.
 */
export default 1;
