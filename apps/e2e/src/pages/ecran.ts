/**
 * ecran.ts — gardes d'écran partagées : débordement, cadre, console
 * =================================================================
 * Nées dans le chapitre 5.30 (web-mob), extraites au chapitre 7 (web-nrg) : WEB-NRG-3 et 5 rejouent des
 * régressions mobiles avec les MÊMES règles — une garde copiée dans deux specs finit par diverger.
 */
import { expect, type Page } from "@playwright/test";

/**
 * La règle du chapitre. En cas de débordement, on rend l'élément fautif : son sélecteur, sa largeur et son bord
 * droit — de quoi corriger sans chercher.
 */
export async function aucunDebordement(page: Page, ou: string): Promise<void> {
  const verdict = await page.evaluate(() => {
    const largeur = document.documentElement.clientWidth;
    const deborde = document.documentElement.scrollWidth - largeur;
    if (deborde <= 1) return { deborde, coupable: null as string | null };
    let pire: { nom: string; droite: number } | null = null as { nom: string; droite: number } | null;
    document.querySelectorAll<HTMLElement>("body *").forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const dejaVu: { nom: string; droite: number } | null = pire;
      if (r.right > largeur + 1 && (!dejaVu || r.right > dejaVu.droite)) {
        const classe = typeof n.className === "string" ? n.className.slice(0, 60) : "";
        pire = { nom: `${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ""}${classe ? `.${classe.trim().split(/\s+/).slice(0, 3).join(".")}` : ""}`, droite: Math.round(r.right) };
      }
    });
    const fautif: { nom: string; droite: number } | null = pire;
    return { deborde, coupable: fautif ? `${fautif.nom} (bord droit ${fautif.droite} px pour ${largeur} px d'écran)` : "inconnu" };
  });
  expect(verdict.deborde, `${ou} : la page déborde de ${verdict.deborde} px — ${verdict.coupable}`).toBeLessThanOrEqual(1);
}

/** Un élément tient-il dans l'écran ? (bord droit et bord gauche compris dans la fenêtre) */
export async function tientDansLEcran(page: Page, cible: ReturnType<Page["locator"]>, quoi: string): Promise<void> {
  const largeur = await page.evaluate(() => document.documentElement.clientWidth);
  const boite = await cible.boundingBox();
  expect(boite, `${quoi} : élément absent`).toBeTruthy();
  expect(boite!.x, `${quoi} : déborde à gauche`).toBeGreaterThanOrEqual(-1);
  expect(boite!.x + boite!.width, `${quoi} : déborde à droite (${Math.round(boite!.x + boite!.width)} px pour ${largeur} px)`).toBeLessThanOrEqual(largeur + 1);
}

/**
 * Rien ne sort du cadre — sauf ce qui défile DANS son propre cadre.
 *
 * La règle du cahier n'interdit pas le contenu large : elle interdit qu'il pousse la PAGE. Une
 * rangée de réponses rapides, une frise, un tableau ont le droit de dépasser à condition qu'un
 * ancêtre les fasse défiler horizontalement (`overflow-x: auto|scroll`). On ignore donc ces
 * éléments-là, et on ne garde que les débordements francs.
 */
export async function rienNeSortDuCadre(page: Page, ou: string): Promise<void> {
  const sortis = await page.evaluate(() => {
    const largeur = document.documentElement.clientWidth;
    const hors: string[] = [];
    const defileDansSonCadre = (n: HTMLElement): boolean => {
      let parent: HTMLElement | null = n.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1) return true;
        parent = parent.parentElement;
      }
      return false;
    };
    document.querySelectorAll<HTMLElement>("main *").forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.width <= 40 || r.height <= 10 || r.right <= largeur + 1) return;
      if (defileDansSonCadre(n)) return;
      hors.push(`${n.tagName.toLowerCase()} « ${(n.innerText ?? "").slice(0, 40)} » → ${Math.round(r.right)} px`);
    });
    return hors.slice(0, 5);
  });
  expect(sortis, `${ou} : rien ne sort à droite (${sortis.join(" | ")})`).toHaveLength(0);
}

/**
 * La console d'une page : erreurs, avertissements et exceptions non rattrapées, rangés à part. Le bruit du poste
 * (favicon, cookies tiers, 401 de la sonde de session du visiteur, outils de `next dev`) est écarté ici une fois
 * pour toutes.
 */
export function ecouterLaConsole(page: Page): { erreurs: () => string[]; avertissements: () => string[] } {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const bruit = /favicon|third-party cookie|status of 401|\[Fast Refresh\]|\[HMR\]|Download the React DevTools|webpack-hmr/i;
  page.on("console", (m) => {
    const t = m.text();
    if (bruit.test(t)) return;
    if (m.type() === "error") erreurs.push(t);
    else if (m.type() === "warning") avertissements.push(t);
  });
  page.on("pageerror", (e) => erreurs.push(`pageerror: ${e.message}`));
  return { erreurs: () => erreurs, avertissements: () => avertissements };
}
