/**
 * recherche.ts — l'écran `/search` visé SANS piloter Google Places
 * =================================================================
 * (cahier 01-WEB, chapitres 5.9 et 5.10.)
 *
 * La barre de recherche s'appuie sur l'autocomplétion Google pour les villes (hors périmètre du
 * harnais). Mais ce que `/search` interroge en arrivant, c'est le BROUILLON de la barre,
 * persistant en `sessionStorage` (`usePersistedFormState`, clé `yamba:form:trip-search`,
 * version 2, dates sérialisées avec le marqueur `__yamba_date__`). On le pose avant la
 * navigation : l'écran cherche exactement ce qu'il aurait cherché après une saisie.
 */
import { expect, type Page } from "@playwright/test";

export type CritereRecherche = { from?: string; to?: string; date?: Date };

/** Pose le brouillon de la barre (ce que `/search` lit en arrivant), avant la navigation. */
export async function poserLaRecherche(page: Page, critere: CritereRecherche): Promise<void> {
  const data = {
    from: critere.from ?? "",
    to: critere.to ?? "",
    dateValue: critere.date ? { mode: "exact", date: { __yamba_date__: critere.date.toISOString() } } : null,
  };
  await page.addInitScript(
    ({ cle, valeur }) => {
      try { window.sessionStorage.setItem(cle, valeur); } catch { /* stockage indisponible */ }
    },
    { cle: "yamba:form:trip-search", valeur: JSON.stringify({ version: 2, data }) }
  );
}

/** Ouvre `/fr/search` sur ces critères et attend le titre. */
export async function ouvrirLaRecherche(page: Page, critere: CritereRecherche = {}): Promise<void> {
  await poserLaRecherche(page, critere);
  await page.goto("/fr/search", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

/**
 * La carte d'un trajet dans la liste (le lien qui l'enveloppe). Chaque carte existe DEUX fois
 * dans le DOM (arbre mobile masqué par CSS + arbre desktop) : on vise la copie visible.
 */
export const carteDuTrajet = (page: Page, id: string) => page.locator(`a[href="/fr/trips/${id}"]`).filter({ visible: true }).first();
