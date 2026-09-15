/**
 * suivi-destinataire.ts — la page publique de suivi, `/track/[token]` (cahier 01-WEB, 5.20 et WEB-E2E-6)
 * ======================================================================================================
 * Le destinataire n'a pas de compte : il ouvre un lien. La page dit où en est le colis et rien
 * d'autre — **ni code, ni numéro, ni montant, ni adresse, ni photo**. La moitié de ce que le
 * cahier vérifie ici, c'est une absence ; le harnais l'affirme sur le texte entier de la page,
 * sur son code source, et sur la réponse de l'API, dont les clés sont une liste FERMÉE (D69).
 *
 * Les libellés des jalons sont ceux du produit (`tracking.milestones.*`) : le cahier parle de
 * « Colis pris en charge » pour la prise en charge, la page l'appelle « Colis récupéré par
 * {prénom} » — « Colis pris en charge » y désigne l'acceptation. On suit le produit.
 */
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { adresseDeLApi } from "../fixtures/adresses";
import { normaliserEspaces } from "./reservation";

/** Les clés que `GET /track/:token` a le droit de servir — et rien d'autre (contrat `PublicTrackingResponse`). */
export const CLES_PUBLIQUES_DU_SUIVI = ["arrivalAt", "carrier", "corridor", "departureAt", "milestone", "recipientFirstName", "shipperFirstName", "steps"] as const;

export class SuiviDestinataire {
  constructor(private readonly page: Page) {}

  async ouvrir(url: string, prenom: string): Promise<void> {
    await this.page.goto(url, { waitUntil: "networkidle" });
    await expect(this.page.getByRole("heading", { level: 1, name: `Ton colis arrive, ${prenom}` })).toBeVisible({ timeout: 60_000 });
  }

  /** La section « Où en est le colis », ligne à ligne : l'intitulé, le jalon courant, son aide, puis la frise. */
  private async lignesDeLaSection(): Promise<string[]> {
    const section = this.page.locator("section").filter({ hasText: "Où en est le colis" });
    await expect(section).toBeVisible({ timeout: 30_000 });
    return (await section.innerText()).split("\n").map((l) => normaliserEspaces(l)).filter(Boolean);
  }

  /** Le jalon courant, tel que la page le met en avant sous « Où en est le colis ». */
  async jalonCourant(): Promise<string> {
    return (await this.lignesDeLaSection())[1] ?? "";
  }

  /** L'aide sous le jalon courant — elle change à chaque étape (WEB-E2E-6 § 3). */
  async aideCourante(): Promise<string> {
    return (await this.lignesDeLaSection())[2] ?? "";
  }

  /** Un jalon de la frise est-il atteint ? (une date s'affiche à côté de lui) */
  async jalonAtteint(libelle: string | RegExp): Promise<boolean> {
    const ligne = this.page.locator("ol > li").filter({ hasText: libelle });
    await expect(ligne).toHaveCount(1);
    return (await ligne.locator("span").count()) >= 3;
  }

  /** Les jalons atteints de la frise, dans l'ordre de la page. */
  async jalonsAtteints(): Promise<string[]> {
    const lignes = this.page.locator("ol > li");
    const atteints: string[] = [];
    for (let i = 0; i < (await lignes.count()); i++) {
      const li = lignes.nth(i);
      if ((await li.locator("span").count()) >= 3) atteints.push(normaliserEspaces((await li.locator("span").nth(1).innerText())));
    }
    return atteints;
  }

  /**
   * Ni code, ni numéro, ni montant, ni adresse, ni photo : la page entière est passée au crible,
   * son texte ET son code source (`page.content()`), avec les valeurs précises du deal quand on
   * les connaît (le code, le numéro, le montant, les mots de l'adresse de remise).
   */
  async neReveleRien(secrets: { code?: string; telephone?: string; montant?: string; motsDAdresse?: string[] } = {}): Promise<void> {
    const corps = await this.page.locator("body").innerText();
    const source = await this.page.content();
    expect(corps, "aucun code à six chiffres").not.toMatch(/\b\d{3} ?\d{3}\b/);
    expect(corps, "aucun numéro de téléphone").not.toMatch(/\+\d{6,}/);
    expect(corps, "aucun montant").not.toMatch(/€/);
    expect(source, "aucune photo de la médiathèque").not.toContain("ik.imagekit.io");
    expect(await this.page.locator("main img, section img").count(), "aucune image dans le contenu").toBe(0);
    for (const [nom, valeur] of Object.entries(secrets)) {
      if (!valeur) continue;
      for (const v of Array.isArray(valeur) ? valeur : [valeur]) {
        expect(corps, `${nom} absent de l'écran`).not.toContain(v);
        expect(source, `${nom} absent du code source`).not.toContain(v);
      }
    }
  }

  /** La réponse brute de l'API : ses clés sont exactement la liste fermée du contrat. */
  static async clesServiesParLApi(contexte: BrowserContext, token: string): Promise<string[]> {
    const r = await contexte.request.get(`${adresseDeLApi()}/track/${token}`);
    if (!r.ok()) throw new Error(`/track/${token} : ${r.status()} ${await r.text()}`);
    return Object.keys((await r.json()) as Record<string, unknown>).sort();
  }

  /** WEB-E2E-6 § 6 — la mention de confidentialité, et son lien vers la politique. */
  async mentionDeConfidentialite(): Promise<string> {
    const mention = this.page.getByText(/a confié ton prénom et ton numéro à Yamba/);
    await expect(mention).toBeVisible({ timeout: 30_000 });
    return normaliserEspaces(await mention.innerText());
  }

  async ouvrirLaPolitiqueDeConfidentialite(): Promise<void> {
    await this.page.getByRole("link", { name: "Politique de confidentialité" }).click();
    await expect(this.page).toHaveURL(/\/fr\/legal\/privacy$/, { timeout: 30_000 });
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
  }

  /**
   * WEB-E2E-6 § 7 — le bloc d'acquisition : « Envoyer un colis » et « Devenir Voyageur ».
   * Un `Link` Next navigue côté client : « networkidle » ne dit rien de la navigation, on attend
   * l'URL attendue. Le lien est visé DANS le bloc (l'en-tête du site porte les mêmes libellés).
   */
  async suivreLeLienDAcquisition(libelle: "Envoyer un colis" | "Devenir Voyageur", urlAttendue: RegExp): Promise<void> {
    const bloc = this.page.locator("section").filter({ hasText: "Toi aussi, envoie ou transporte avec Yamba" });
    await expect(bloc).toBeVisible({ timeout: 30_000 });
    await bloc.getByRole("link", { name: libelle, exact: true }).click();
    await expect(this.page).toHaveURL(urlAttendue, { timeout: 30_000 });
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
  }

  /** WEB-E2E-6 § 8 — un jeton altéré : « Ce lien de suivi n'est plus valide », sans autre information. */
  async lienInvalide(url: string): Promise<string> {
    await this.page.goto(url, { waitUntil: "networkidle" });
    await expect(this.page.getByRole("heading", { level: 1, name: "Ce lien de suivi n'est plus valide" })).toBeVisible({ timeout: 60_000 });
    return normaliserEspaces(await this.page.locator("main, body").first().innerText());
  }

  /** Le 404 de l'API sur un jeton, tel quel — pour comparer un jeton altéré à un jeton inventé (404 uniforme). */
  static async refusDeLApi(contexte: BrowserContext, token: string): Promise<{ statut: number; corps: string }> {
    const r = await contexte.request.get(`${adresseDeLApi()}/track/${token}`);
    return { statut: r.status(), corps: await r.text() };
  }
}
