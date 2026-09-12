/**
 * web-cnf.spec.ts — cahier 01-WEB, chapitre 5.19 « Confirmation, complétion et versement »
 * ========================================================================================
 * La période de vérification côté Expéditeur (bandeau, compte à rebours sobre, confirmation en
 * bouton SECONDAIRE, récap, « Comment ça marche », signalement), la confirmation anticipée
 * définitive (toast, « Transaction close », signalement disparu, emails et notification du
 * versement), le rappel de la veille et la complétion automatique (les deux passes du cron
 * `payout-bookings`, forcées par `scripts/recette/payout.ts` sur le fournisseur FAKE), l'après-J+4
 * sans cron, l'étanchéité de l'état du versement (l'Expéditrice ne voit jamais un échec), les
 * trois états du versement vus du Voyageur (bloqué, renversé, parti), le portefeuille et les
 * paiements — dont les totaux viennent du serveur —, et l'absence de toute fausse carte bancaire.
 *
 * Deals : `bzv-delivered` (João ↔ Thomas) pour la lecture et la confirmation anticipée ;
 * `yul-delivered` (Aminata ↔ Marc) pour le rappel, l'après-J+4 et la complétion automatique ;
 * `bzv-completed-blocked` (Aminata ↔ Thomas, versement en échec) ; `bzv-reversed` (Pauline ↔ Thomas).
 *
 * ORDRE DE JEU (≠ ordre du cahier, un seul deal livré par rôle) : 1, 11, 2 sur `bzv-delivered` ;
 * puis 4 (rappel, échéance dans 18 h), 5 (échéance passée, cron pas encore passé), 3 (le cron)
 * sur `yul-delivered` ; puis 6, 7, 8, 9, 10 sur les deals terminés.
 *
 * PIÈGE : le deal-service du poste tourne sur le fournisseur FAKE — le cron des 5 minutes
 * REJOUE le versement en échec de `bzv-completed-blocked` et le fait partir. `versement-bloque.ts`
 * refige l'échec et repousse le rejeu d'un jour, juste après le seed puis avant les fiches 6/7.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { COMPTES } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { Finances } from "../pages/finances";
import { MesTrajets } from "../pages/mes-trajets";
import { SuiviExpediteur } from "../pages/suivi-expediteur";
import { normaliserEspaces } from "../pages/reservation";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();
const RACINE = join(__dirname, "../../../..");

/* ══ L'état partagé (mode série) ═════════════════════════════════════════════════════════════ */

let bzvDelivered = ""; // João ↔ Thomas
let yulDelivered = ""; // Aminata ↔ Marc
let bzvBloque = ""; // Aminata ↔ Thomas — versement FAILED / compte Stripe incomplet
let bzvRenverse = ""; // Pauline ↔ Thomas — transfert renversé
const poser = (jeu: JeuEssai) => {
  bzvDelivered ||= jeu.deal("bzv-delivered").id;
  yulDelivered ||= jeu.deal("yul-delivered").id;
  bzvBloque ||= jeu.deal("bzv-completed-blocked").id;
  bzvRenverse ||= jeu.deal("bzv-reversed").id;
};

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());
const euros = (cents: number) => normaliserEspaces(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100));
/** « 55,00 € » ou « 55 € » — l'espace avant le symbole est FINE INSÉCABLE (U+202F) à l'écran comme dans les objets d'email. */
const ESPACE = "[\\s\\u00a0\\u202f]?";
const montant = (cents: number) => {
  const entier = Math.floor(cents / 100);
  const dec = String(cents % 100).padStart(2, "0");
  return dec === "00" ? `${entier}(,00)?${ESPACE}€` : `${entier},${dec}${ESPACE}€`;
};

/**
 * Un script de recette (scripts/recette/*.ts), exécuté avec le .env du poste — et le fournisseur FAKE
 * (la clé Stripe vidée l'emporte sur le .env). PIÈGE : Playwright pose `FORCE_COLOR`, et `console.log`
 * colore alors les nombres (`\u001b[33m1\u001b[39m`) — la couleur est coupée et les séquences retirées.
 */
function scriptDeRecette(nom: string, ...args: string[]): string {
  const sortie = execFileSync("npx", ["tsx", "--env-file=.env", `scripts/recette/${nom}.ts`, ...args], {
    cwd: RACINE,
    encoding: "utf-8",
    timeout: 120_000,
    env: { ...process.env, STRIPE_SECRET_KEY: "", FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  // eslint-disable-next-line no-control-regex
  return sortie.replace(/\u001b\[[0-9;]*m/g, "");
}

async function dealBrut(contexte: Contexte, id: string): Promise<{ statut: number; corps: string; deal: Record<string, unknown> }> {
  const r = await contexte.request.get(`${api()}/deals/${id}`);
  const corps = await r.text();
  return { statut: r.status(), corps, deal: r.ok() ? ((JSON.parse(corps) as { deal: Record<string, unknown> }).deal ?? {}) : {} };
}

async function notificationsBrutes(contexte: Contexte): Promise<string> {
  const r = await contexte.request.get(`${api()}/me/notifications?limit=100`);
  expect(r.ok(), "GET /me/notifications").toBe(true);
  return normaliserEspaces(await r.text());
}

type Portefeuille = {
  carrier: { upcomingCents: number; pendingCents: number; blockedCents: number; sentCents: number; sentThisMonthCents: number; items: Array<{ bookingId: string; kind: string; state: string; amountCents: number | null; counterpartFirstName: string | null; date: string | null }> };
  shipper: { heldCents: number; spentCents: number; refundedCents: number; items: Array<{ bookingId: string; bookingStatus: string; state: string; amountCents: number; refundAmountCents: number | null; retentionCents: number | null; counterpartFirstName: string | null; date: string | null }> };
};
async function portefeuille(contexte: Contexte): Promise<Portefeuille> {
  const r = await contexte.request.get(`${api()}/me/wallet`);
  expect(r.ok(), "GET /me/wallet").toBe(true);
  return (await r.json()) as Portefeuille;
}

/** Les classes CSS de l'élément et de ses trois parents — pour dire « pas rouge », « pas le bouton principal ». */
const classesAutour = (page: Page, locator: ReturnType<Page["getByText"]>) =>
  locator.first().evaluate((el) => {
    let n: HTMLElement | null = el as HTMLElement;
    const out: string[] = [];
    for (let i = 0; i < 4 && n; i++) {
      out.push(n.className ?? "");
      n = n.parentElement;
    }
    return out.join(" ");
  });

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-CNF — confirmation, complétion et versement (chapitre 5.19)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    const jeu = new JeuEssai();
    jeu.rejouer();
    // Le cron FAKE ferait partir le versement « bloqué » dans les cinq minutes : on le refige tout de suite.
    scriptDeRecette("versement-bloque", jeu.deal("bzv-completed-blocked").id);
  });

  test("WEB-CNF-1 · le suivi d'un colis livré", async ({ navigateurConnecte, jeuEssai }) => {
    poser(jeuEssai);
    const { page } = await navigateurConnecte("joao");
    const suivi = new SuiviExpediteur(page);
    await suivi.ouvrir(bzvDelivered);
    await suivi.attendrePeriodeDeVerification();
    const corps = await texte(page);

    /* Bandeau et titre. */
    expect(corps).toContain("Ton colis a été livré à Clarisse");
    expect(corps).toMatch(/Confirmé (hier|aujourd'hui|le .+?) à \d{1,2}h\d{2} par Thomas avec le code à 6 chiffres/);
    expect(corps).toContain("Tu as 3 jours pour t'assurer que tout va bien avant que Thomas reçoive son paiement.");
    /* Le compte à rebours : présent, sobre, jamais rouge. */
    expect(corps).toMatch(/VERSEMENT AUTOMATIQUE DANS (\d+ jours? · )?\d+h/);
    const classesCompteur = await classesAutour(page, page.getByText("VERSEMENT AUTOMATIQUE DANS"));
    expect(classesCompteur, "le compte à rebours n'est pas rouge").not.toMatch(/red|rose/);
    /* « Tout s'est bien passé ? » — bouton SECONDAIRE (bordé, pas la couleur d'action), le conseil. */
    expect(corps).toContain("Tout s'est bien passé ?");
    const confirmer = page.getByRole("button", { name: "Confirmer la livraison" });
    await expect(confirmer).toBeVisible();
    const classesBouton = String(await confirmer.evaluate((el) => el.className));
    expect(classesBouton, "bouton secondaire : bordé, fond blanc").toMatch(/border/);
    expect(classesBouton, "jamais le bouton principal (mango / plein)").not.toMatch(/FF9900|bg-emerald-700|bg-\[#0F766E\]/);
    expect(corps).toContain("Conseil : demande à Clarisse d'ouvrir le colis avant de confirmer.");
    /* Le récap de la livraison. */
    expect(corps).toContain("RÉCAP DE LA LIVRAISON");
    expect(corps).toContain("COLIS LIVRÉ");
    expect(corps).toContain("REMIS À CLARISSE");
    expect(corps).toContain("Code de livraison saisi par Thomas et validé");
    expect(corps).toContain("PHOTOS DE TRAÇABILITÉ");
    /* « Comment ça marche » : les trois cas. */
    expect(corps).toContain("Comment ça marche");
    expect(corps).toContain("Si tu confirmes maintenant, Thomas reçoit son paiement immédiatement.");
    expect(corps).toContain("Si tu ne fais rien, le paiement est libéré automatiquement à la fin des 3 jours.");
    expect(corps).toContain("Si tu signales un problème, le paiement est gelé et nous démarrons une médiation.");
    /* La carte sobre du signalement. */
    expect(corps).toContain("Quelque chose ne va pas avec ce colis ?");
    await expect(page.getByRole("button", { name: "Signaler un problème" })).toBeVisible();
    test.info().annotations.push({ type: "note", description: `bouton « Confirmer la livraison » : ${classesBouton.split(" ").filter((c: string) => /^(border|bg-|text-)/.test(c)).join(" ")}` });
  });

  test("WEB-CNF-11 · aucune fausse carte bancaire dans « TON PAIEMENT »", async ({ navigateurConnecte, jeuEssai }) => {
    poser(jeuEssai);
    const { page, contexte } = await navigateurConnecte("joao");
    await new SuiviExpediteur(page).ouvrir(bzvDelivered);
    await expect(page.getByText("TON PAIEMENT")).toBeVisible({ timeout: 60_000 });
    const { deal } = await dealBrut(contexte, bzvDelivered);
    const total = (deal.pricing as { totalShipperCents: number }).totalShipperCents;
    const corps = await texte(page);
    expect(corps).toContain(`Débité ${euros(total)}`);
    expect(corps).toContain("Bloqué jusqu'à J+4");
    for (const faux of ["Visa", "Mastercard", "••", "4242", "Sur ton relevé", "YAMBA*", "CB "]) {
      expect(corps, `jamais « ${faux} » avec le fournisseur fictif`).not.toContain(faux);
    }
    expect(corps).toContain("Les fonds sont en attente chez Yamba. Ils seront versés à Thomas après la période de vérification.");
  });

  test("WEB-CNF-2 · la confirmation anticipée est définitive", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    poser(jeuEssai);
    await mailpit.vider();
    const thomas = await navigateurConnecte("thomas");
    const notificationsAvant = await notificationsBrutes(thomas.contexte);

    const { page } = await navigateurConnecte("joao");
    const suivi = new SuiviExpediteur(page);
    await suivi.ouvrir(bzvDelivered);
    await suivi.attendrePeriodeDeVerification();
    /* Étape 1 — l'avertissement est lisible AVANT le clic. */
    await expect(page.getByText("Cette action est définitive. Tu ne pourras plus signaler de problème après confirmation.")).toBeVisible();
    await page.getByRole("button", { name: "Confirmer la livraison" }).click();
    /* Étape 2 — la confirmation en ligne. */
    await expect(page.getByText("Confirmer définitivement ?")).toBeVisible();
    await expect(page.getByText("Thomas sera payé immédiatement et tu ne pourras plus signaler de problème.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Annuler" })).toBeVisible();
    /* Étape 3 — « Oui, tout est OK ». */
    const reponse = page.waitForResponse((r) => /\/deals\/[^/]+\/confirm$/.test(r.url()) && r.request().method() === "POST" && r.status() !== 401, { timeout: 60_000 });
    await page.getByRole("button", { name: "Oui, tout est OK" }).click();
    const r = await reponse;
    expect(r.status(), await r.text()).toBe(200);
    const confirmation = (await r.json()) as { status: string; payoutStatus: string; payoutAmountCents: number };
    expect(confirmation.status).toBe("COMPLETED");
    await expect(page.getByText("Merci ! Thomas va recevoir son paiement.").last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Envoi terminé")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Transaction close" })).toBeVisible();
    expect(await texte(page)).toMatch(/Tu as confirmé la livraison le .+\./);
    /* Étape 4 — la carte de signalement a disparu. */
    await expect(page.getByRole("button", { name: "Signaler un problème" })).toHaveCount(0);
    await expect(page.getByText("Quelque chose ne va pas avec ce colis ?")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirmer la livraison" })).toHaveCount(0);
    expect(await texte(page)).toContain("Cette transaction est close : il n'est plus possible d'ouvrir un signalement.");
    expect(await texte(page)).toContain("État Libéré Tu as confirmé la livraison — les fonds sont en cours de versement à Thomas.");

    /* Vérification complémentaire — João : email « Transaction terminée » ; Thomas : notification + email du montant. */
    const net = confirmation.payoutAmountCents;
    const emailJoao = await mailpit.attendreEmail({ pour: COMPTES.joao.email, sujet: /Transaction terminée/ });
    expect(emailJoao.texte + emailJoao.html).toContain("Tu as confirmé la bonne réception de ton colis");
    await expect.poll(() => notificationsBrutes(thomas.contexte), { timeout: 60_000, message: "la notification du versement arrive chez Thomas" }).not.toBe(notificationsAvant);
    await thomas.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    await expect(thomas.page.getByText(new RegExp(`${montant(net)} partis vers ton compte`)).first()).toBeVisible({ timeout: 60_000 });
    const emailThomas = await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: new RegExp(`${montant(net)} en route vers ton compte`) });
    expect(emailThomas.texte + emailThomas.html).toContain("sous 2 à 7 jours");
    test.info().annotations.push({ type: "note", description: `confirmé → COMPLETED, payoutStatus ${confirmation.payoutStatus}, net ${euros(net)} ; email João « ${emailJoao.sujet} » ; email Thomas « ${emailThomas.sujet} »` });
  });

  test("WEB-CNF-4 · le rappel de la veille, une seule fois (cron forcé)", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    poser(jeuEssai);
    await mailpit.vider();
    /* Échéance dans 18 h : remise reculée de 3,25 jours (deliveredAt ET payoutDueAt). */
    const etat = JSON.parse(scriptDeRecette("livraison-ancienne", yulDelivered, "3.25")) as { status: string; payoutDueAt: string; verificationReminderSentAt: string | null };
    expect(etat.status).toBe("DELIVERED");
    expect(new Date(etat.payoutDueAt).getTime() - Date.now()).toBeLessThan(24 * 3_600_000);
    /* La passe « reminder », deux fois : la seconde ne renvoie rien. */
    const rappels = (sortie: string) => Number(sortie.match(/sendVerificationReminders[^\d]*(\d+)/)?.[1] ?? NaN);
    const premiere = rappels(scriptDeRecette("payout", "reminder"));
    const seconde = rappels(scriptDeRecette("payout", "reminder"));
    expect(seconde, "la seconde passe ne renvoie rien").toBe(0);

    const { page, contexte } = await navigateurConnecte("aminata");
    await page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    // La cloche garde les notifications des seeds précédents (les comptes survivent au seed) : on compte CE deal.
    const rappel = page.locator(`a[href*="${yulDelivered}"]`).filter({ hasText: "Dernier jour pour vérifier ton colis" });
    await expect(rappel.first()).toBeVisible({ timeout: 60_000 });
    expect(await rappel.count(), "une seule notification pour ce deal").toBe(1);
    expect(normaliserEspaces(await rappel.first().innerText())).toMatch(/sans action, le paiement de Marc part le .+/);
    const email = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /Dernier jour pour vérifier ton colis/ });
    expect(email.texte + email.html).toContain("Si tout va bien, tu n'as rien à faire");
    await new Promise((r) => setTimeout(r, 3_000));
    expect(await mailpit.compter({ pour: COMPTES.aminata.email, sujet: /Dernier jour/ }), "un seul email").toBe(1);
    const { deal } = await dealBrut(contexte, yulDelivered);
    expect(deal.status).toBe("DELIVERED");
    test.info().annotations.push({ type: "note", description: `première passe : ${premiere} rappel(s) ; seconde : ${seconde} ; email « ${email.sujet} »` });
  });

  test("WEB-CNF-5 · après J+4, ni confirmation ni signalement (cron pas encore passé)", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    poser(jeuEssai);
    await mailpit.vider(); // les emails de la complétion (fiche 3) peuvent partir dès maintenant si le vrai cron passe
    const etat = JSON.parse(scriptDeRecette("livraison-ancienne", yulDelivered, "4.1")) as { payoutDueAt: string };
    expect(new Date(etat.payoutDueAt).getTime()).toBeLessThan(Date.now());

    const { page, contexte } = await navigateurConnecte("aminata");
    const { deal } = await dealBrut(contexte, yulDelivered);
    test.skip(deal.status !== "DELIVERED", `le cron des 5 minutes est passé avant l'écran (${deal.status}) — rejouer`);
    expect(deal.allowedActions, "le signalement n'est plus permis").not.toContain("dispute");
    await new SuiviExpediteur(page).ouvrir(yulDelivered);
    await expect(page.getByRole("heading", { name: "Période de vérification" })).toBeVisible({ timeout: 60_000 });
    const corps = await texte(page);
    expect(corps).toMatch(/VERSEMENT AUTOMATIQUE DANS 0h/);
    await expect(page.getByRole("button", { name: "Signaler un problème" })).toHaveCount(0);
    await expect(page.getByText("Quelque chose ne va pas avec ce colis ?")).toHaveCount(0);
    /* Un appel forcé au signalement est refusé. */
    const force = await contexte.request.post(`${api()}/deals/${yulDelivered}/dispute`, {
      data: { category: "DAMAGED", description: "Le colis est arrivé abîmé sur un coin, le contenu est rayé et la boîte enfoncée nettement.", desiredOutcome: "YAMBA_DECIDES", pledgeAccepted: true },
    });
    expect(force.status()).toBe(409);
    const refus = (await force.json()) as { message?: string; details?: { code?: string; refusal?: string } };
    expect(refus.details?.code).toBe("TRANSITION_NOT_ALLOWED");
    expect(refus.message).toContain("The verification period has ended");
    /* Constat (ANO-WEB-63) : « Confirmer la livraison » reste proposé — l'API sert encore `confirmEarly`. */
    const confirmerEncore = await page.getByRole("button", { name: "Confirmer la livraison" }).count();
    test.info().annotations.push({ type: "constat", description: `après l'échéance : allowedActions = ${JSON.stringify(deal.allowedActions)} ; « Confirmer la livraison » ${confirmerEncore ? "ENCORE proposé (ANO-WEB-63)" : "absent"} ; signalement forcé → 409 TRANSITION_NOT_ALLOWED` });
  });

  test("WEB-CNF-5 bis · « Confirmer la livraison » ne devrait plus être proposé après J+4 (ANO-WEB-63, ouverte)", async ({ navigateurConnecte, jeuEssai }) => {
    poser(jeuEssai);
    test.fail(true, "ANO-WEB-63 : la machine laisse `confirmEarly` à l'Expéditrice après payoutDueAt — le cahier n'attend ni confirmation ni signalement");
    const { page, contexte } = await navigateurConnecte("aminata");
    const { deal } = await dealBrut(contexte, yulDelivered);
    test.skip(deal.status !== "DELIVERED", "le cron est passé");
    await new SuiviExpediteur(page).ouvrir(yulDelivered);
    await expect(page.getByRole("heading", { name: "Période de vérification" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Confirmer la livraison" })).toHaveCount(0);
  });

  test("WEB-CNF-3 · la complétion automatique à J+4 (cron forcé)", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    poser(jeuEssai);
    const sortie = scriptDeRecette("payout", "due");
    const { page, contexte } = await navigateurConnecte("aminata");
    await expect.poll(async () => (await dealBrut(contexte, yulDelivered)).deal.status, { timeout: 30_000 }).toBe("COMPLETED");
    const { deal } = await dealBrut(contexte, yulDelivered);
    expect(deal.completedBy).toBe("SYSTEM");

    /* Étape 2 — le suivi côté Expéditrice. */
    await new SuiviExpediteur(page).ouvrir(yulDelivered);
    await expect(page.getByText("Envoi terminé")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Transaction close" })).toBeVisible();
    const corps = await texte(page);
    expect(corps).toMatch(/Période de vérification terminée le .+, sans signalement de ta part\./);
    expect(corps).toContain("Le paiement de Marc est libéré");
    expect(corps, "ANO-WEB-64 : pas « Tu as confirmé » sur une complétion automatique").toContain("La période de vérification est terminée — les fonds sont en cours de versement à Marc.");
    await expect(page.getByRole("button", { name: "Signaler un problème" })).toHaveCount(0);

    /* Le versement est lancé côté Voyageur (FAKE : parti tout de suite). */
    const net = (deal.pricing as { transportCents: number }).transportCents;
    const marc = await navigateurConnecte("marc");
    await marc.page.goto(`/fr/carrier/deals/${yulDelivered}`, { waitUntil: "networkidle" });
    await expect(marc.page.getByText("Deal terminé")).toBeVisible({ timeout: 60_000 });
    const corpsMarc = await texte(marc.page);
    expect(corpsMarc).toContain("Période de vérification terminée le");
    expect(corpsMarc).toMatch(new RegExp(`${montant(net)} partis vers ton compte`));

    /* Emails : « Transaction terminée » à l'Expéditrice, « … en route vers ton compte » au Voyageur. */
    const emailAminata = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /Transaction terminée/ });
    expect(emailAminata.texte + emailAminata.html).toContain("est terminée sans signalement de ta part");
    const emailMarc = await mailpit.attendreEmail({ pour: COMPTES.marc.email, sujet: new RegExp(`${montant(net)} en route vers ton compte`) });
    test.info().annotations.push({ type: "note", description: `passe forcée : ${sortie.trim().split("\n").filter((l) => l.includes("autoCompleteDue")).join(" ") || "(le vrai cron était passé)"} ; emails « ${emailAminata.sujet} » / « ${emailMarc.sujet} »` });
  });

  test("WEB-CNF-6 · l'Expéditrice ne voit jamais un échec de versement", async ({ navigateurConnecte, jeuEssai }) => {
    poser(jeuEssai);
    scriptDeRecette("versement-bloque", bzvBloque);
    const { page, contexte } = await navigateurConnecte("aminata");
    await new SuiviExpediteur(page).ouvrir(bzvBloque);
    await expect(page.getByText("Envoi terminé")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Transaction close" })).toBeVisible();
    // La description du colis du seed dit elle-même « compte Stripe incomplet » : on la retire avant la chasse aux fuites.
    const { deal } = await dealBrut(contexte, bzvBloque);
    const suivi = (await texte(page)).replace((deal.parcel as { description: string }).description, "");
    expect(suivi).toContain("Le paiement de Thomas est libéré");
    expect(suivi).toMatch(/Période de vérification terminée le .+, sans signalement de ta part\./);
    // ANO-WEB-64 : complétion automatique → la note du paiement ne dit pas « Tu as confirmé la livraison ».
    expect(suivi).toContain("État Libéré La période de vérification est terminée — les fonds sont en cours de versement à Thomas.");
    expect(suivi).not.toContain("Tu as confirmé la livraison");
    // ANO-WEB-65 : l'invitation à noter porte une échéance (jamais « Tu as jusqu'au . »).
    expect(suivi).toMatch(/Tu as jusqu'au \d{1,2} [a-zéû]+\./);
    for (const fuite of [/échec/i, /échou/i, /en attente/i, /Stripe/, /compte de paiement/i, /FAILED/, /NOT_READY/]) {
      expect(suivi, `suivi : jamais ${fuite}`).not.toMatch(fuite);
    }
    /* Finances › Paiements : « Libéré le … · transaction close », rien d'autre sur cette ligne. */
    const finances = new Finances(page);
    await finances.ouvrir("Paiements");
    const ligne = await finances.lignePaiement(bzvBloque);
    expect(ligne).toContain("Envoi Paris → Brazzaville · Thomas");
    expect(ligne).toMatch(/Libéré le .+ · transaction close/);
    for (const fuite of [/échec/i, /attente/i, /Stripe/, /problème/i]) expect(ligne, `Paiements : jamais ${fuite}`).not.toMatch(fuite);
    expect(await texte(page), "la page Paiements ne parle jamais de Stripe").not.toMatch(/Stripe/);
  });

  test("WEB-CNF-6 bis · l'API sert `payoutStatus: FAILED` à l'Expéditrice (ANO-WEB-62, ouverte)", async ({ navigateurConnecte, jeuEssai }) => {
    poser(jeuEssai);
    test.fail(true, "ANO-WEB-62 : la vue Expéditeur de GET /deals/:id porte payoutStatus / payoutSentAt (A68 « both roles read it ») — l'état du versement du Voyageur fuit dans la réponse brute");
    const { contexte } = await navigateurConnecte("aminata");
    const { corps } = await dealBrut(contexte, bzvBloque);
    expect(corps).not.toContain('"payoutStatus":"FAILED"');
  });

  test("WEB-CNF-7 · le versement en attente vu du Voyageur", async ({ navigateurConnecte, jeuEssai }) => {
    poser(jeuEssai);
    scriptDeRecette("versement-bloque", bzvBloque);
    const { page, contexte } = await navigateurConnecte("thomas");
    const { deal } = await dealBrut(contexte, bzvBloque);
    expect(deal.payoutBlocker).toBe("ACCOUNT_NOT_READY");
    const net = (deal.pricing as { transportCents: number }).transportCents;
    const jamaisTechnique = (ecran: string, corps: string) => {
      for (const fuite of [/NOT_READY/, /payouts?_enabled/i, /capabilit/i, /account_/i, /erreur Stripe/i, /StripeError/i, /Invalid/]) expect(corps, `${ecran} : jamais ${fuite}`).not.toMatch(fuite);
    };

    /* Étape 1 — le deal terminé : la carte ambre et son bouton. */
    await page.goto(`/fr/carrier/deals/${bzvBloque}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Deal terminé")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Transaction close" })).toBeVisible();
    const carte = page.getByText(new RegExp(`${montant(net)} en attente : finalise ton compte Stripe`)).first();
    await expect(carte).toBeVisible();
    expect(await classesAutour(page, carte), "carte ambre").toMatch(/amber/);
    const corpsDeal = await texte(page);
    expect(corpsDeal).toContain("Ton compte de paiement n'est pas encore prêt à recevoir des virements. Termine ton onboarding Stripe : le versement partira automatiquement dans les minutes qui suivent.");
    await expect(page.getByRole("button", { name: "Finaliser mon compte Stripe" })).toBeVisible();
    jamaisTechnique("deal", corpsDeal);

    /* Étape 2 — « Mes trajets » : le bandeau totalise, la ligne du deal le dit. */
    const trajets = new MesTrajets(page);
    await trajets.ouvrir();
    const { carrier } = await portefeuille(contexte);
    const bandeau = page.getByRole("status").filter({ hasText: "en attente : finalise ton compte Stripe" });
    await expect(bandeau).toBeVisible({ timeout: 30_000 });
    const texteBandeau = normaliserEspaces(await bandeau.innerText());
    expect(texteBandeau).toContain(`${euros(carrier.blockedCents)} en attente : finalise ton compte Stripe`);
    await expect(bandeau.getByRole("button", { name: "Finaliser mon compte" })).toBeVisible();
    const ligneTrajet = await trajets.ligneDuDeal(bzvBloque);
    expect(ligneTrajet).toMatch(new RegExp(`Terminé · ${montant(net)} en attente : finalise ton compte Stripe`));
    jamaisTechnique("Mes trajets", await texte(page));

    /* Étape 3 — Finances › Portefeuille : la carte « En attente » et la ligne. */
    const finances = new Finances(page);
    await finances.ouvrir("Portefeuille");
    const corpsFinances = await texte(page);
    expect(corpsFinances).toContain(`En attente ${euros(carrier.pendingCents)} Compte Stripe, signalement ou envoi en cours`);
    const ligne = await finances.ligneVersement(bzvBloque);
    expect(ligne).toContain("Transport pour Aminata · Paris → Brazzaville");
    expect(ligne).toContain("En attente : finalise ton compte Stripe");
    expect(ligne).toContain(`+ ${euros(net)}`);
    jamaisTechnique("Portefeuille", corpsFinances);
    test.info().annotations.push({ type: "note", description: `bandeau : « ${texteBandeau} » ; ligne Mes trajets : « ${ligneTrajet} »` });
  });

  test("WEB-CNF-8 · le versement renversé", async ({ navigateurConnecte, jeuEssai }) => {
    poser(jeuEssai);
    const { page, contexte } = await navigateurConnecte("thomas");
    const { deal } = await dealBrut(contexte, bzvRenverse);
    expect(deal.payoutStatus).toBe("REVERSED");
    const net = (deal.pricing as { transportCents: number }).transportCents;
    await page.goto(`/fr/carrier/deals/${bzvRenverse}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Deal terminé")).toBeVisible({ timeout: 60_000 });
    const corps = await texte(page);
    expect(corps).toMatch(new RegExp(`${montant(net)} : versement sous examen`));
    expect(corps).toContain("Le transfert a été renversé par notre prestataire de paiement. Rien n'est perdu : nous te contactons pour le régulariser.");
    /* Aucun renvoi automatique proposé. */
    await expect(page.getByRole("button", { name: /renvoyer|réessayer|relancer|retenter/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /renvoyer|réessayer|relancer|retenter/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Finaliser mon compte/ }), "pas de CTA Stripe non plus").toHaveCount(0);
    const finances = new Finances(page);
    await finances.ouvrir("Portefeuille");
    const ligne = await finances.ligneVersement(bzvRenverse);
    expect(ligne).toContain("Transport pour Pauline · Paris → Brazzaville");
    expect(ligne).toContain("Sous examen · transfert renversé, on te contacte");
  });

  test("WEB-CNF-9 · le portefeuille du Voyageur", async ({ navigateurConnecte, jeuEssai }) => {
    poser(jeuEssai);
    const { page, contexte } = await navigateurConnecte("thomas");
    const { carrier } = await portefeuille(contexte);
    const finances = new Finances(page);
    await finances.ouvrir("Portefeuille");
    const corps = await texte(page);
    expect(corps).toContain("Finances Tes paiements, gains et versements — tout vient de tes deals, rien n'est estimé.");
    /* Trois cartes, valeurs = serveur. */
    expect(corps).toContain(`À venir ${euros(carrier.upcomingCents)} Livraisons en vérification`);
    expect(corps).toContain(`Envoyés ${euros(carrier.sentCents)}${carrier.sentThisMonthCents > 0 ? ` + ${euros(carrier.sentThisMonthCents)} ce mois` : ""}`);
    expect(corps).toContain(`En attente ${euros(carrier.pendingCents)} Compte Stripe, signalement ou envoi en cours`);
    /* Chaque ligne servie porte son état exact. */
    const attendu: Record<string, RegExp> = {
      UPCOMING: /À venir le .+/,
      PENDING: /En cours d'envoi/,
      BLOCKED: /En attente : finalise ton compte Stripe/,
      FROZEN: /Gelé · signalement en cours/,
      SENT: /Parti le .+ · 2 à 7 jours/,
      HELD: /Retenue conservée · on te contacte/,
      REVERSED: /Sous examen · transfert renversé, on te contacte/,
    };
    const etatsVus = new Set<string>();
    for (const item of carrier.items) {
      const ligne = await finances.ligneVersement(item.bookingId);
      expect(ligne, `ligne ${item.state}`).toMatch(attendu[item.state]);
      const libelle = item.kind === "LATE_CANCELLATION" ? `Compensation · annulation tardive de ${item.counterpartFirstName}` : `Transport pour ${item.counterpartFirstName}`;
      expect(ligne).toContain(libelle);
      expect(ligne).toContain(item.amountCents === null ? "—" : `+ ${euros(item.amountCents)}`);
      etatsVus.add(item.state);
    }
    expect(corps).toContain("Voir mes virements sur Stripe");
    expect(corps).toContain("Dates d'arrivée, RIB et historique : sur ton tableau de bord Stripe.");
    /* Jamais les données de la maquette. */
    for (const maquette of ["89,30", "Aminata T.", "Josué", "IBAN", "6789"]) expect(corps, `maquette « ${maquette} »`).not.toContain(maquette);
    test.info().annotations.push({ type: "note", description: `${carrier.items.length} lignes, états vus : ${[...etatsVus].sort().join(", ")} ; à venir ${euros(carrier.upcomingCents)}, envoyés ${euros(carrier.sentCents)}, en attente ${euros(carrier.pendingCents)}` });
  });

  test("WEB-CNF-10 · les paiements de l'Expéditrice", async ({ navigateurConnecte, jeuEssai }) => {
    poser(jeuEssai);
    const { page, contexte } = await navigateurConnecte("aminata");
    const { shipper } = await portefeuille(contexte);
    const finances = new Finances(page);
    await finances.ouvrir("Paiements");
    const corps = await texte(page);
    expect(corps).toContain(`Bloqué chez Yamba ${euros(shipper.heldCents)} Libéré à la fin de chaque transaction`);
    expect(corps).toContain(`Dépensé ${euros(shipper.spentCents)}`);
    expect(corps).toContain(`Remboursé ${euros(shipper.refundedCents)}`);
    const etatsVus = new Set<string>();
    for (const item of shipper.items) {
      const ligne = await finances.lignePaiement(item.bookingId);
      const cle = item.state === "HELD" && item.bookingStatus === "DELIVERED" && item.date ? "HELD_UNTIL" : item.state;
      const rembourse = item.refundAmountCents !== null ? euros(item.refundAmountCents) : "";
      const retenue = item.retentionCents !== null ? euros(item.retentionCents) : "";
      const attendu: Record<string, RegExp> = {
        AUTHORIZED: /Autorisé, pas débité · en attente du Voyageur/,
        HELD: /Bloqué chez Yamba/,
        HELD_UNTIL: /Bloqué jusqu'au .+/,
        RELEASED: /Libéré le .+ · transaction close/,
        RELEASED_NO_CHARGE: /Jamais débité · l'empreinte a disparu/,
        REFUNDED: new RegExp(`Remboursé ${rembourse.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} le .+`),
        PARTIALLY_REFUNDED: new RegExp(`Remboursé ${rembourse.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} le .+ · retenue ${retenue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} reversée au Voyageur`),
      };
      // ANO-WEB-67 : un remboursement porte toujours une date (repli serveur sur la dernière mise à jour).
      if (cle === "REFUNDED" || cle === "PARTIALLY_REFUNDED") expect(item.date, `${cle} : jamais « le » vide`).not.toBeNull();
      expect(ligne, `ligne ${cle}`).toMatch(attendu[cle]);
      expect(ligne).toContain(`Envoi Paris → ${item.bookingId === yulDelivered ? "Montréal" : "Brazzaville"} · ${item.counterpartFirstName}`);
      etatsVus.add(cle);
    }
    /* Les totaux viennent du serveur : la somme des lignes « Bloqué » = la carte, sans recalcul. */
    const bloques = shipper.items.filter((i) => i.state === "HELD").reduce((s, i) => s + i.amountCents, 0);
    expect(bloques, "cohérence serveur : heldCents = Σ lignes HELD").toBe(shipper.heldCents);
    test.info().annotations.push({ type: "note", description: `${shipper.items.length} lignes, états vus : ${[...etatsVus].sort().join(", ")} ; bloqué ${euros(shipper.heldCents)}, dépensé ${euros(shipper.spentCents)}, remboursé ${euros(shipper.refundedCents)}` });
  });
});
