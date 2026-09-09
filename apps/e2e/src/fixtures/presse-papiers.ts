/**
 * presse-papiers.ts — lire ce que la page a « copié »
 * ===================================================
 * Les messages « Copier le message » (lien de suivi, code de livraison) ne sont écrits nulle
 * part dans la page : ils partent au presse-papiers, et c'est tout. Or `navigator.clipboard`
 * n'existe que dans un contexte sécurisé — sur l'adresse LAN du poste de recette
 * (`http://192.168…`), le navigateur ne l'expose pas, et Chrome refuse d'accorder la permission.
 *
 * Le harnais interpose donc un presse-papiers **en mémoire de page** : le code du produit
 * appelle bien `navigator.clipboard.writeText`, et le test relit ce qui y a été écrit. À poser
 * AVANT la navigation vers l'écran qui copie (`addInitScript` ne vaut que pour les pages
 * chargées ensuite).
 */
import type { Page } from "@playwright/test";

declare global {
  interface Window {
    __pressePapiersYamba?: string;
  }
}

export async function observerLePressePapiers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const memoire = {
      writeText: (texte: string) => {
        window.__pressePapiersYamba = String(texte);
        return Promise.resolve();
      },
      readText: () => Promise.resolve(window.__pressePapiersYamba ?? ""),
    };
    Object.defineProperty(navigator, "clipboard", { value: memoire, configurable: true });
  });
}

export async function lirePressePapiers(page: Page): Promise<string> {
  return page.evaluate(() => window.__pressePapiersYamba ?? "");
}
