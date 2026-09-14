/**
 * reservation.ts — l'assistant de réservation en quatre étapes (cahier 01-WEB, chapitre 5.12)
 * ===========================================================================================
 * Un objet de page par écran traversé : le parcours raconte l'histoire, l'objet de page connaît
 * les boutons. Quand un libellé change, une seule ligne bouge.
 *
 * Les sélecteurs privilégient ce que le cahier lui-même décrit — un libellé visible, un rôle —
 * plutôt qu'une classe CSS. Deux exceptions assumées, faute de libellé stable : les trois
 * champs de l'étape 1 et ceux de l'étape 2 sont visés par leur **exemple de saisie**
 * (`placeholder`), qui est du texte de produit, relu par les mêmes yeux que les libellés.
 */
import { expect, type Page } from "@playwright/test";

/** Les familles de colis proposées par le trajet de démonstration (§ 2.4 du cahier). */
export type Famille =
  | "Documents & papiers"
  | "Vêtements & textile"
  | "Alimentaire sec & scellé"
  | "Électronique & appareils"
  | "Cosmétiques & soins"
  | "Pièces & outillage"
  | "Jouets & puériculture"
  | "Accessoires & divers";

export type Taille = "S" | "M" | "L";

export interface Colis {
  famille: Famille;
  taille?: Taille;
  poidsKg: string;
  valeurEuros: string;
  description: string;
}

export interface Destinataire {
  prenom: string;
  nom: string;
  indicatif: string;
  telephone: string;
  email?: string;
}

export class AssistantReservation {
  constructor(private readonly page: Page) {}

  /** Ouvre l'assistant directement — le clic « Réserver » est éprouvé ailleurs (WEB-TRJ). */
  async ouvrir(tripId: string): Promise<void> {
    await this.page.goto(`/fr/trips/${tripId}/book`, { waitUntil: "networkidle" });
    // L'assistant garde son brouillon et son étape en `sessionStorage` (useBookingDraft) : après
    // une tentative refusée, il rouvre à l'étape 4. Le cahier repart d'une description neuve :
    // on oublie le brouillon et on recharge — comme un membre qui rouvre un nouvel onglet.
    const reprise = await this.page.evaluate(() => {
      const cles = Object.keys(window.sessionStorage).filter((k) => k.startsWith("booking"));
      cles.forEach((k) => window.sessionStorage.removeItem(k));
      return cles.length;
    });
    if (reprise > 0) await this.page.reload({ waitUntil: "networkidle" });
    await expect(this.page.getByText("Décris ton colis")).toBeVisible({ timeout: 60_000 });
  }

  /** Étape 1 — le colis. */
  async decrireLeColis(colis: Colis): Promise<void> {
    await this.page.getByRole("button", { name: new RegExp(echapper(colis.famille)) }).first().click();
    if (colis.taille) {
      await this.page.getByRole("button", { name: new RegExp(`^${colis.taille}\\b`) }).first().click();
    }
    await this.page.locator('input[placeholder="2,5"]').fill(colis.poidsKg);
    await this.page.locator('input[placeholder="150"]').fill(colis.valeurEuros);
    await this.page.locator("textarea").first().fill(colis.description);
  }

  /** Étape 2 — le destinataire. Il n'a pas de compte Yamba : c'est tout l'objet de l'écran. */
  async decrireLeDestinataire(d: Destinataire): Promise<void> {
    await expect(this.page.getByText("À qui livrer ?")).toBeVisible({ timeout: 30_000 });
    await this.page.locator("select").first().selectOption(d.indicatif);
    await this.page.locator('input[type="tel"]').fill(d.telephone);
    await this.page.locator('input[placeholder="Marie"]').fill(d.prenom);
    await this.page.locator('input[placeholder="Mboungou"]').fill(d.nom);
    if (d.email) await this.page.locator('input[type="email"]').fill(d.email);
  }

  /** Étape 3 — la Charte Expéditeur. Une seule case, mais elle engage juridiquement. */
  async accepterLaCharte(): Promise<void> {
    await expect(this.page.getByText("Ton engagement")).toBeVisible({ timeout: 30_000 });
    await this.page.locator('input[type="checkbox"]').first().check();
  }

  async continuer(): Promise<void> {
    await this.page.getByRole("button", { name: /^(Continuer|Passer au paiement)$/ }).first().click();
  }

  /**
   * Le montant porté par le bouton de paiement — le cahier vérifie ce chiffre au centime.
   * Les espaces sont NORMALISÉES : la typographie française insère une espace fine insécable
   * avant le symbole monétaire (U+202F), invisible à l'œil et fatale à une comparaison de
   * chaînes. Un « 32,20 € » attendu et un « 32,20 € » obtenu s'affichent à l'identique dans
   * un rapport d'échec — on ne cherche pas cette panne deux fois.
   */
  async montantAPayer(): Promise<string> {
    const bouton = this.page.getByRole("button", { name: /^Payer / });
    await expect(bouton).toBeVisible({ timeout: 30_000 });
    const brut = (await bouton.innerText()).match(/Payer\s+([\s\S]+)$/)?.[1] ?? "";
    return normaliserEspaces(brut);
  }

  /**
   * Étape 4 — l'autorisation. Le montant est autorisé, pas débité : le Voyageur a 24 h.
   *
   * PRÉREQUIS D'ENVIRONNEMENT. Avec le fournisseur **Stripe**, cette étape passe par le
   * Payment Element, un `iframe` de Stripe.js qui **refuse de se monter sur une origine non
   * sécurisée** — or le poste de recette sert le front sur `http://192.168.1.155:3000`
   * (contrainte de la recette mobile, cf. la configuration du harnais). Le bouton reste alors
   * cliquable et ne fait rien d'autre qu'un message d'erreur générique.
   *
   * Les parcours tournent donc avec le fournisseur **FAKE** (D11/D38), qui est prévu pour cela :
   *
   *     cd apps/deal-service && STRIPE_SECRET_KEY= node --env-file=../../.env dist/main.js
   *
   * Le paiement par carte lui-même reste éprouvé par la campagne API (fiches Stripe rejouées
   * avec la vraie CLI) : ce n'est pas une zone d'ombre, c'est un partage de responsabilité.
   */
  async payer(): Promise<void> {
    // Un `iframe` Stripe visible signifie que le fournisseur STRIPE est actif : on le dit
    // franchement plutôt que de laisser le parcours échouer trente secondes plus loin sur un
    // symptôme incompréhensible.
    if ((await this.page.locator('iframe[name^="__privateStripeFrame"]').count()) > 0) {
      throw new Error(
        "Le fournisseur STRIPE est actif : le Payment Element ne se monte pas sur une origine non sécurisée.\n" +
          "Relance deal-service avec le fournisseur FAKE :\n" +
          "  cd apps/deal-service && STRIPE_SECRET_KEY= node --env-file=../../.env dist/main.js"
      );
    }
    // L'intention de paiement est demandée au montage de l'étape 4 ; cliquer AVANT sa réponse ne
    // fait rien (mesuré sur WEB-E2E-3 : le bouton est cliquable, la demande ne part jamais). Le
    // texte du mode test porte le montant de l'intention : quand il est là, l'intention l'est.
    await expect(this.page.getByText(/Mode test : aucun prestataire de paiement/)).toBeVisible({ timeout: 30_000 });
    for (let essai = 0; essai < 2; essai++) {
      const reponse = this.page
        .waitForResponse((r) => /\/deals$/.test(r.url()) && r.request().method() === "POST", { timeout: 20_000 })
        .catch(() => null);
      await this.page.getByRole("button", { name: /^Payer / }).click();
      const r = await reponse;
      if (r) {
        if (!r.ok()) throw new Error(`Réservation refusée : ${r.status()} ${await r.text()}`);
        return;
      }
    }
    throw new Error("« Payer » a été cliqué deux fois sans qu'aucune demande de réservation ne parte.");
  }

  /**
   * Une réservation qui PEUT être refusée par un plafond (compte neuf, CNF-06 / D71). On déroule
   * jusqu'à l'étape 4, puis on lit ce qui arrive : le refus dans la carte de paiement (le plafond
   * tombe à l'intention de paiement — avant tout argent), le refus en toast (au clic « Payer »),
   * ou la demande créée. Rend le refus tel qu'il est écrit, ou l'identifiant du deal.
   */
  async tenterDeReserver(tripId: string, colis: Colis, destinataire: Destinataire): Promise<{ refus: string | null; dealId: string | null; intentionRefusee: boolean }> {
    await this.ouvrir(tripId);
    await this.decrireLeColis(colis);
    await this.continuer();
    await this.decrireLeDestinataire(destinataire);
    await this.continuer();
    await this.accepterLaCharte();
    const intention = this.page
      .waitForResponse((r) => r.url().includes("/deals/payment-intents") && r.request().method() === "POST", { timeout: 60_000 })
      .catch(() => null);
    await this.continuer();
    const refus = this.page.getByText(/^Ton compte est récent : pour l'instant/);
    const r = await intention;
    if (r && !r.ok()) {
      await expect(refus.first()).toBeVisible({ timeout: 15_000 });
      return { refus: normaliserEspaces(await refus.first().innerText()), dealId: null, intentionRefusee: true };
    }
    await expect(this.page.getByText(/Mode test : aucun prestataire de paiement/)).toBeVisible({ timeout: 30_000 });
    const demande = this.page.waitForResponse((rr) => /\/deals$/.test(rr.url()) && rr.request().method() === "POST", { timeout: 60_000 });
    await this.page.getByRole("button", { name: /^Payer / }).click();
    const d = await demande;
    if (!d.ok()) {
      await expect(refus.first()).toBeVisible({ timeout: 15_000 });
      return { refus: normaliserEspaces(await refus.first().innerText()), dealId: null, intentionRefusee: false };
    }
    await expect.poll(() => this.page.url(), { timeout: 90_000 }).toMatch(/\/bookings\/[0-9a-f]{24}$/);
    return { refus: null, dealId: this.page.url().split("/bookings/")[1], intentionRefusee: false };
  }

  /**
   * Le parcours complet, tel que le cahier l'enchaîne. Rend le montant affiché à l'étape 4,
   * pour que l'appelant le confronte à ce que le cahier annonce.
   */
  async reserver(tripId: string, colis: Colis, destinataire: Destinataire): Promise<string> {
    await this.ouvrir(tripId);
    await this.decrireLeColis(colis);
    await this.continuer();
    await this.decrireLeDestinataire(destinataire);
    await this.continuer();
    await this.accepterLaCharte();
    await this.continuer();
    const montant = await this.montantAPayer();
    await this.payer();
    return montant;
  }
}

/** Toute espace Unicode (fine, insécable, fine insécable) devient une espace ordinaire. */
export function normaliserEspaces(texte: string): string {
  return texte.replace(/[\s\u00a0\u202f\u2009]+/g, " ").trim();
}

/** Un libellé de produit peut contenir `&`, `+20 %`, `✕`… : on ne le laisse pas devenir une regex. */
function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
