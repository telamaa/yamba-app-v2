/**
 * suivi-destinataire.ts — la page publique de suivi, `/track/[token]` (cahier 01-WEB, 5.20)
 * ==========================================================================================
 * Le destinataire n'a pas de compte : il ouvre un lien. La page dit où en est le colis et rien
 * d'autre — **ni code, ni numéro, ni montant**. La moitié de ce que le cahier vérifie ici, c'est
 * une absence ; le harnais l'affirme sur le texte entier de la page.
 *
 * Les libellés des jalons sont ceux du produit (`tracking.milestones.*`) : le cahier parle de
 * « Colis pris en charge » pour la prise en charge, la page l'appelle « Colis récupéré par
 * {prénom} » — « Colis pris en charge » y désigne l'acceptation. On suit le produit.
 */
import { expect, type Page } from "@playwright/test";

export class SuiviDestinataire {
  constructor(private readonly page: Page) {}

  async ouvrir(url: string, prenom: string): Promise<void> {
    await this.page.goto(url, { waitUntil: "networkidle" });
    await expect(this.page.getByRole("heading", { level: 1, name: `Ton colis arrive, ${prenom}` })).toBeVisible({ timeout: 60_000 });
  }

  /** Le jalon courant, tel que la page le met en avant sous « Où en est le colis ». */
  async jalonCourant(): Promise<string> {
    // La section se lit ligne à ligne : l'intitulé, le jalon courant, son aide, puis la frise.
    const section = this.page.locator("section").filter({ hasText: "Où en est le colis" });
    const lignes = (await section.innerText()).split("\n").map((l) => l.trim()).filter(Boolean);
    return lignes[1] ?? "";
  }

  /** Un jalon de la frise est-il atteint ? (une date s'affiche à côté de lui) */
  async jalonAtteint(libelle: string | RegExp): Promise<boolean> {
    const ligne = this.page.locator("ol > li").filter({ hasText: libelle });
    await expect(ligne).toHaveCount(1);
    return (await ligne.locator("span").count()) >= 3;
  }

  /** Ni code, ni numéro, ni montant : la page entière est passée au crible. */
  async neReveleRien(): Promise<void> {
    const corps = await this.page.locator("body").innerText();
    expect(corps, "aucun code à six chiffres").not.toMatch(/\b\d{3} ?\d{3}\b/);
    expect(corps, "aucun numéro de téléphone").not.toMatch(/\+\d{6,}/);
    expect(corps, "aucun montant").not.toMatch(/€/);
  }
}
