/**
 * mes-envois.ts — « Mes envois » et l'annulation d'un deal par l'Expéditeur (cahier 01-WEB, 5.11)
 * =============================================================================================
 * L'annulation se fait depuis la LISTE (aucun bouton dans le suivi du deal). La fenêtre
 * « Annuler cet envoi ? » dit le montant remboursé et, à moins de 48 h du départ, la retenue
 * de 50 % reversée au Voyageur (ANN-01, D50). « Garder l'envoi » ne fait aucun appel réseau ;
 * « Confirmer l'annulation » fait tout d'un coup : remboursement, kilos rendus, compensation.
 *
 * Une même Expéditrice peut avoir plusieurs lignes sur le même corridor : on vise la ligne par
 * le lien vers SON deal, jamais par son texte.
 */
import { expect, type Page } from "@playwright/test";
import { normaliserEspaces } from "./reservation";

export class MesEnvois {
  constructor(private readonly page: Page) {}

  private ligne(dealId: string) {
    return this.page.locator(`a[href="/fr/bookings/${dealId}"]`).first();
  }

  async ouvrir(): Promise<void> {
    await this.page.goto("/fr/dashboard/shipments", { waitUntil: "networkidle" });
    await expect(this.page.getByRole("heading", { level: 1, name: "Mes envois" })).toBeVisible({ timeout: 60_000 });
  }

  /** Le badge / sous-titre de la ligne du deal, espaces normalisées. */
  async texteDeLaLigne(dealId: string): Promise<string> {
    const ligne = this.ligne(dealId);
    await expect(ligne).toBeVisible({ timeout: 30_000 });
    return normaliserEspaces(await ligne.innerText());
  }

  /** Attend que la ligne du deal porte un texte (la liste se recharge après une action). */
  async attendreSurLaLigne(dealId: string, texte: string | RegExp): Promise<void> {
    await expect(this.ligne(dealId)).toContainText(texte, { timeout: 30_000 });
  }

  /** Étape 5 — « Annuler » sur la ligne : la fenêtre s'ouvre ; rend son texte entier. */
  async ouvrirLAnnulation(dealId: string): Promise<string> {
    await this.ligne(dealId).getByRole("button", { name: "Annuler", exact: true }).last().click();
    const dialogue = this.page.getByRole("dialog");
    await expect(dialogue.getByRole("heading", { name: "Annuler cet envoi ?" })).toBeVisible({ timeout: 15_000 });
    return normaliserEspaces(await dialogue.innerText());
  }

  /** Étape 8 — « Garder l'envoi » : la fenêtre se ferme, rien ne part. */
  async garderLEnvoi(): Promise<void> {
    const requetes: string[] = [];
    const ecoute = (r: { url(): string; method(): string }) => {
      if (r.method() === "POST" && r.url().includes("/cancel")) requetes.push(r.url());
    };
    this.page.on("request", ecoute);
    await this.page.getByRole("dialog").getByRole("button", { name: "Garder l'envoi" }).click();
    await expect(this.page.getByRole("dialog")).toHaveCount(0);
    this.page.off("request", ecoute);
    expect(requetes, "« Garder l'envoi » n'envoie rien").toHaveLength(0);
  }

  /** Étape 9 — « Confirmer l'annulation » : la réponse du serveur et le toast. */
  async confirmerLAnnulation(): Promise<{ refundAmountCents: number; toast: string }> {
    const reponse = this.page.waitForResponse((r) => /\/deals\/[^/]+\/cancel$/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
    await this.page.getByRole("dialog").getByRole("button", { name: "Confirmer l'annulation" }).click();
    const r = await reponse;
    if (!r.ok()) throw new Error(`Annulation refusée : ${r.status()} ${await r.text()}`);
    const corps = (await r.json()) as { status?: string; refundAmountCents?: number };
    expect(corps.status).toBe("CANCELLED");
    // PENDING (rien n'a été débité) : « Envoi annulé. » ; ACCEPTED : « … Remboursement de {montant} en cours. » (5.20).
    const toast = this.page.getByText(/^Envoi annulé\.( Remboursement de .+ en cours\.)?$/).last();
    await expect(toast).toBeVisible({ timeout: 15_000 });
    return { refundAmountCents: corps.refundAmountCents ?? 0, toast: normaliserEspaces(await toast.innerText()) };
  }
}

/** « 31,92 € » → 3192. Tolère l'espace fine insécable et le symbole. */
export function enCentimes(montant: string): number {
  const nombre = normaliserEspaces(montant).replace(/[^\d,.-]/g, "").replace(",", ".");
  return Math.round(Number(nombre) * 100);
}

/** 3192 → « 31,92 € », comme le front (fr-FR), espaces normalisées. */
export function enEuros(cents: number): string {
  return normaliserEspaces(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100));
}
