/**
 * web-voy.spec.ts — cahier 01-WEB, chapitre 5.6 « Devenir Voyageur : onboarding et Stripe »
 * =========================================================================================
 * Les deux etapes « Votre profil » puis « Paiement » de l'onboarding, et ce que l'onboarding
 * conditionne vraiment : publier reste possible sans Stripe (le verrou est au moment d'ACCEPTER).
 *
 * Tout se joue sur des comptes NEUFS crees et actives par le harnais : l'onboarding transforme un
 * compte en Voyageur (et, pour la partie Stripe, cree un compte Stripe Express de TEST) — jamais
 * sur le seed, dont les Voyageurs portent un `acct_fake_*` factice qui ferait echouer les vraies
 * API Stripe.
 *
 * Partie Stripe (VOY-5, VOY-7) : cle `sk_test_`, Connect Express reel en mode test. Le flux heberge
 * de Stripe (`connect.stripe.com`) est pilote au mieux ; s'il change, ces fiches le signalent.
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { compteNeuf, type CompteNeuf } from "../fixtures/compte-neuf";
import type { Mailpit } from "../fixtures/mailpit";

type Page = Navigateur["page"];
type Contexte = Navigateur["contexte"];

const SUJET_ACTIVATION = "Ton code d'activation Yamba";

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const formulaire = (page: Page) => page.locator("main form").first();
const enTete = (page: Page) => page.getByRole("banner");
const codeDe = (t: string): string => {
  const c = /\b(\d{6})\b/.exec(t)?.[1];
  if (!c) throw new Error("aucun code à six chiffres dans l'email");
  return c;
};
const attendreHydratation = (page: Page) => page.waitForResponse((r) => r.url().includes("/api/"), { timeout: 30_000 }).catch(() => undefined);

async function creerCompteActive(page: Page, mailpit: Mailpit, compte: CompteNeuf): Promise<void> {
  await page.goto("/fr/register", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Deviens Voyageur" })).toBeVisible({ timeout: 60_000 });
  await attendreHydratation(page);
  const f = formulaire(page);
  await f.locator("#firstName").fill(compte.prenom);
  await f.locator("#lastName").fill(compte.nom);
  await f.locator("#email").fill(compte.email);
  await f.locator("#password").fill(compte.motDePasse);
  await f.locator("#passwordConfirm").fill(compte.motDePasse);
  await f.locator('input[type="checkbox"]').check();
  const reg = page.waitForResponse((r) => r.url().includes("/auth/register") && !r.url().includes("/register/") && r.request().method() === "POST", { timeout: 30_000 });
  await f.getByRole("button", { name: "Créer mon compte" }).click();
  expect((await reg).ok(), "POST /auth/register").toBe(true);
  await expect(page).toHaveURL(/\/fr\/register\/verify/, { timeout: 60_000 });
  const email = await mailpit.attendreEmail({ pour: compte.email, sujet: SUJET_ACTIVATION });
  const code = codeDe(email.texte);
  for (const [i, c] of code.split("").entries()) await page.getByLabel(`OTP digit ${i + 1}`).fill(c);
  const verif = page.waitForResponse((r) => r.url().includes("/auth/register/verify") && r.request().method() === "POST", { timeout: 30_000 });
  await page.getByRole("button", { name: "Valider mon code" }).click();
  expect((await verif).ok(), "POST /auth/register/verify").toBe(true);
  await expect(page).toHaveURL(/\/fr\/login\?verified=1/, { timeout: 60_000 });
}

async function connecter(page: Page, email: string, motDePasse: string): Promise<void> {
  await page.goto("/fr/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Connecte-toi" })).toBeVisible({ timeout: 60_000 });
  await attendreHydratation(page);
  const f = formulaire(page);
  await f.locator("#email").fill(email);
  await f.locator("#password").fill(motDePasse);
  const rep = page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 30_000 });
  await f.locator("button[type=submit]").click();
  expect((await rep).ok(), `connexion de ${email}`).toBe(true);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/** Passe l'étape « Profil » de l'onboarding par l'API (name requis ; le reste optionnel, D31). */
async function passerLEtapeProfil(contexte: Contexte, compte: CompteNeuf): Promise<void> {
  const r = await contexte.request.post(`${adresseDeLApi()}/carrier/onboarding/profile`, {
    data: {
      name: `${compte.prenom} ${compte.nom[0]}.`,
      bio: "Voyageur de recette : je transporte des colis entre Paris et Brazzaville avec soin.",
      phoneE164: "+351912345612",
      address: { formattedAddress: "Lisboa, Portugal", city: "Lisboa", country: "Portugal", countryCode: "PT", placeId: "recette-place-lisboa" },
    },
  });
  expect(r.ok(), `POST /carrier/onboarding/profile → ${await r.text()}`).toBe(true);
}

/** Un trajet PER_KG minimal, publiable, tel que le schéma createTrip l'accepte. */
function trajetPubliable() {
  return {
    transportMode: "PLANE",
    flightType: "DIRECT",
    originCity: "Paris",
    originCountryCode: "FR",
    destinationCity: "Brazzaville",
    destinationCountryCode: "CG",
    departureAt: new Date(Date.now() + 20 * 86_400_000).toISOString(),
    pickupLocations: [{ kind: "AIRPORT", flexibility: "EXACT" }],
    deliveryLocations: [{ kind: "AIRPORT", flexibility: "EXACT" }],
    pricePerKgCents: 1200,
    capacityKg: 20,
    publish: true,
  };
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-VOY — devenir Voyageur : onboarding et Stripe (chapitre 5.6)", () => {
  test("WEB-VOY-1 à 4 · l'entrée, l'étape Profil, publier sans Stripe, et l'étape Paiement", async ({ navigateurVisiteur, mailpit }) => {
    test.setTimeout(4 * 60_000);
    const compte = compteNeuf("Recette", "Voy");
    const { page, contexte } = await navigateurVisiteur();
    await creerCompteActive(page, mailpit, compte);
    await connecter(page, compte.email, compte.motDePasse);

    await test.step("WEB-VOY-1 · l'entrée « Devenir Voyageur »", async () => {
      await page.goto("/fr/dashboard/home", { waitUntil: "domcontentloaded" });
      const menu = enTete(page).getByRole("button", { name: "Menu utilisateur" }).filter({ visible: true }).first();
      await expect(menu).toBeVisible({ timeout: 30_000 });
      await menu.click();
      await page.getByRole("link", { name: "Devenir Voyageur" }).first().click();
      // Le menu mène à la section « Devenir Voyageur » du tableau de bord…
      await expect(page).toHaveURL(/\/fr\/dashboard\/yamber/, { timeout: 30_000 });
      // …dont l'appel à l'action ouvre le wizard d'onboarding.
      await page.locator("main").getByRole("button", { name: "Devenir Voyageur" }).first().click();
      await expect(page).toHaveURL(/\/fr\/carrier\/onboarding/, { timeout: 30_000 });
      // Deux étapes nommées ; « Profil » active, « Paiement » pas encore.
      await expect(page.getByText("Votre profil", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Paiement", { exact: true })).toBeVisible();
      await expect(page.locator("#carrier-name")).toBeVisible();
    });

    await test.step("WEB-VOY-2 · l'étape Profil : champs, téléphone contrôlé, puis passage", async () => {
      // Les champs de l'étape Profil.
      await expect(page.locator("#carrier-name")).toBeVisible();
      await expect(page.locator("#carrier-bio")).toBeVisible();
      // Un téléphone mal formé est refusé sous le champ.
      await page.locator("#carrier-name").fill(`${compte.prenom} ${compte.nom[0]}.`);
      await page.locator("#carrier-bio").fill("Voyageur de recette : je transporte des colis avec soin, Paris ⇄ Brazzaville.");
      await page.locator('main input[type="tel"]').fill("12");
      await page.getByRole("button", { name: "Continuer" }).click();
      await expect(page.getByText("Numéro de téléphone invalide")).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/\/carrier\/onboarding/);

      // Le passage effectif de l'étape se fait par l'API (l'adresse principale passe par
      // l'autocomplétion Google et le téléphone par un composant à sélecteur de pays — hors du
      // périmètre « hors Google » ; le contrat serveur, lui, est vérifié).
      await passerLEtapeProfil(contexte, compte);

      // Le badge du menu utilisateur devient « Profil à compléter ».
      await page.goto("/fr/dashboard/home", { waitUntil: "domcontentloaded" });
      await enTete(page).getByRole("button", { name: "Menu utilisateur" }).filter({ visible: true }).first().click();
      await expect(page.getByText("Profil à compléter").first()).toBeVisible({ timeout: 30_000 });
    });

    await test.step("WEB-VOY-3 · publier reste possible sans onboarding complet", async () => {
      // Profil fait, Stripe NON : la publication d'un trajet doit passer (le verrou est à l'accept).
      const api = adresseDeLApi();
      const r = await contexte.request.post(`${api}/trips`, { data: trajetPubliable() });
      expect(r.status(), `POST /trips (publish) → ${await r.text()}`).toBe(201);
      const trip = (await r.json()) as { id?: string; status?: string; trip?: { id: string; status: string } };
      const statut = trip.status ?? trip.trip?.status;
      expect(statut, "le trajet est PUBLIÉ sans Stripe").toBe("PUBLISHED");
    });

    await test.step("WEB-VOY-4 · l'étape Paiement : Stripe Connect, aucun IBAN chez Yamba", async () => {
      const chargement = page.waitForResponse((r) => r.url().includes("/carrier/onboarding") || r.url().includes("/auth/me"), { timeout: 30_000 }).catch(() => undefined);
      await page.goto("/fr/carrier/onboarding", { waitUntil: "domcontentloaded" });
      await chargement;
      // On est à l'étape Paiement : le bouton Stripe est là, et AUCUN champ IBAN dans un formulaire Yamba.
      const boutonStripe = page.getByRole("button", { name: /Connecter avec Stripe|Configurer Stripe/ });
      await expect(boutonStripe).toBeVisible({ timeout: 30_000 });
      const corps = (await page.locator("main").innerText()).toLowerCase();
      expect(corps.includes("iban"), "aucun IBAN demandé dans un formulaire Yamba").toBe(false);
      await expect(page.locator('input[name*="iban" i], input[placeholder*="iban" i]')).toHaveCount(0);

      // Le clic ouvre le parcours Stripe Connect (redirection vers un domaine stripe.com).
      const redir = page.waitForURL(/stripe\.com/, { timeout: 45_000 }).then(() => true).catch(() => false);
      await boutonStripe.click();
      expect(await redir, "le bouton mène au parcours Stripe (stripe.com)").toBe(true);
    });
  });

  test("WEB-VOY-5 · retour de Stripe : profil actif (onboarding Stripe Express)", async () => {
    test.skip(true,
      "Compléter un compte Stripe Connect EXPRESS exige le flux HÉBERGÉ de Stripe : la plateforme ne peut pas " +
      "soumettre les conditions/justificatifs par l'API (« You cannot accept the Terms of Service on behalf of Express accounts » — vérifié). " +
      "Le flux hébergé (connect.stripe.com) est externe, lent (~7 min) et instable : hors périmètre du harnais. " +
      "VOY-4 prouve la création du vrai lien Connect et la redirection vers Stripe. Manuel (mode test) : compléter l'onboarding " +
      "(numéro de test, données de test), revenir sur /carrier/onboarding/stripe/callback → « Voyageur actif » + email « Ton profil Voyageur est actif ».");
  });

  test("WEB-VOY-7 · « Voir mes virements sur Stripe »", async () => {
    test.skip(true,
      "Branche « tableau de bord » : exige un compte Stripe COMPLET (createLoginLink) ; les Voyageurs du seed portent un `acct_fake_*` " +
      "qui ferait échouer la vraie API Stripe, et compléter un compte Express n'est pas automatisable (voir VOY-5). " +
      "Branche « compte non finalisé » : le Portefeuille d'un Voyageur au profil seul affiche « Devenir Voyageur » (finir l'onboarding), " +
      "pas le bouton « Voir mes virements » — l'état « compte à finaliser » avec ce bouton n'est pas reproductible sans un compte Stripe partiel. " +
      "Manuel (mode test), compte au Stripe complet : Finances › Portefeuille › « Voir mes virements sur Stripe » → porte sudo → tableau de bord Stripe Express dans un nouvel onglet ; " +
      "compte sans Stripe prêt → « Finalise d'abord ton compte Stripe. ».");
  });

  test("WEB-VOY-6 · accepter sans onboarding complet est refusé", async () => {
    test.skip(true,
      "Nécessite une demande de réservation en attente sur le trajet d'un Voyageur non finalisé (parcours de réservation, chapitre 5.12). " +
      "Le verrou D31 est vérifié côté serveur : deal-lifecycle.service.ts refuse l'accept avec `CARRIER_ONBOARDING_REQUIRED` " +
      "(profil incomplet ou Stripe non prêt), couvert par deal-lifecycle.service.spec.ts. À rejouer de bout en bout avec 5.12.");
  });
});
