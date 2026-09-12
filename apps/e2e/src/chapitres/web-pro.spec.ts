/**
 * web-pro.spec.ts — cahier 01-WEB, chapitre 5.5 « Profil, avatar et page publique »
 * ================================================================================
 * L'écran « Profil » du tableau de bord (Expéditeur pur vs Voyageur), les bornes du prénom et de
 * la date de naissance, l'avatar (garde-fou de poids), la page publique `/u/<slug>` et sa
 * visibilité.
 *
 * Les fiches qui MODIFIENT un compte du seed (prénom, date de naissance, nom affiché, bascules)
 * prennent un instantané du profil au départ (`GET /auth/me/profile`) et le RESTAURENT en
 * `finally` (`PATCH`) : le seed n'est pas rejoué entre les chapitres, un compte laissé modifié
 * fausserait la suite.
 *
 * WEB-PRO-5 (téléversement) et WEB-PRO-6 (remplacement/retrait) écrivent sur ImageKit (service
 * externe réel) : le harnais joue le seul garde-fou SANS écriture externe — le refus côté
 * navigateur d'un fichier de plus de 2 Mo — et laisse le reste `⏭` (à jouer à la main).
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";

type Page = Navigateur["page"];
type Contexte = Navigateur["contexte"];

interface Profil {
  firstName: string;
  lastName: string;
  birthDate: string | null;
  profilePublic: boolean;
  showCity: boolean;
  carrier: { displayName: string; bio: string | null } | null;
}

const lireProfil = async (contexte: Contexte): Promise<Profil> => (await (await contexte.request.get(`${adresseDeLApi()}/auth/me/profile`)).json()) as Profil;
async function ecrireProfil(contexte: Contexte, body: Record<string, unknown>): Promise<number> {
  const r = await contexte.request.patch(`${adresseDeLApi()}/auth/me/profile`, { data: body });
  return r.status();
}
/** Remet un compte du seed dans l'état capturé au départ (prénom, nom, date, bascules, page). */
async function restaurer(contexte: Contexte, p: Profil): Promise<void> {
  const body: Record<string, unknown> = { firstName: p.firstName, lastName: p.lastName, birthDate: p.birthDate, profilePublic: p.profilePublic, showCity: p.showCity };
  if (p.carrier) body.displayName = p.carrier.displayName, (body.bio = p.carrier.bio);
  await contexte.request.patch(`${adresseDeLApi()}/auth/me/profile`, { data: body });
}

async function ouvrirLeProfil(page: Page): Promise<void> {
  const chargement = page.waitForResponse((r) => r.url().includes("/auth/me/profile") && r.request().method() === "GET", { timeout: 60_000 });
  await page.goto("/fr/dashboard/profile", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Profil", exact: true }).first()).toBeVisible({ timeout: 60_000 });
  await chargement;
  await expect(page.getByText("Prénom", { exact: true })).toBeVisible({ timeout: 30_000 });
}

const ilYaDesAnnees = (n: number): string => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - n);
  return d.toISOString().slice(0, 10);
};
const dansLeFutur = (): string => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-PRO — profil, avatar et page publique (chapitre 5.5)", () => {
  test("WEB-PRO-1 · l'écran Profil d'un Expéditeur pur", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("aminata", { parEcran: true });
    await ouvrirLeProfil(page);
    // Avatar : une initiale par défaut, jamais une image cassée.
    const cassee = await page.locator("main img").evaluateAll((imgs) => imgs.some((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0));
    expect(cassee, "aucune image cassée").toBe(false);
    // Les champs de base.
    await expect(page.getByText("Prénom", { exact: true })).toBeVisible();
    await expect(page.getByText("Nom", { exact: true })).toBeVisible();
    await expect(page.getByText("Date de naissance", { exact: true })).toBeVisible();
    // Deux bascules.
    await expect(page.getByText("Profil public", { exact: true })).toBeVisible();
    await expect(page.getByText("Afficher ma ville", { exact: true })).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(2);
    // Réservés aux Voyageurs : absents pour un Expéditeur pur.
    await expect(page.getByText("Nom affiché sur ta page Voyageur")).toHaveCount(0);
    await expect(page.getByText("Présentation", { exact: true })).toHaveCount(0);
  });

  test("WEB-PRO-2 · l'écran Profil d'un Voyageur", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("thomas", { parEcran: true });
    await ouvrirLeProfil(page);
    await expect(page.getByText("Nom affiché sur ta page Voyageur")).toBeVisible();
    await expect(page.getByText("Présentation", { exact: true })).toBeVisible();
    // Le compteur de présentation, borné à 300.
    await expect(page.locator("main").getByText(/\/300$/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Voir mon profil public" })).toBeVisible();
  });

  test("WEB-PRO-3 · les bornes du prénom et du nom", async ({ navigateurConnecte }) => {
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    const avant = await lireProfil(contexte);
    try {
      // Trop court (1) et trop long (41) : refusés côté serveur, rien n'est écrit.
      expect(await ecrireProfil(contexte, { firstName: "A" }), "1 caractère refusé").toBeGreaterThanOrEqual(400);
      expect(await ecrireProfil(contexte, { firstName: "A".repeat(41) }), "41 caractères refusés").toBeGreaterThanOrEqual(400);
      expect((await lireProfil(contexte)).firstName, "rien n'a été écrit").toBe(avant.firstName);

      // À l'écran, un prénom trop court est signalé sous le champ (le front reflète la règle).
      await ouvrirLeProfil(page);
      await page.getByLabel("Prénom").fill("A");
      await page.locator("main").getByRole("button", { name: "Enregistrer" }).click();
      await expect(page.locator("main p.text-red-700, main p.text-red-400").first()).toBeVisible({ timeout: 15_000 });

      // Un prénom valide passe et se lit dans le menu utilisateur.
      expect(await ecrireProfil(contexte, { firstName: "Aminatou" }), "prénom valide accepté").toBe(200);
      await page.goto("/fr/dashboard/home", { waitUntil: "domcontentloaded" });
      const menu = page.getByRole("banner").getByRole("button", { name: "Menu utilisateur" }).filter({ visible: true }).first();
      await expect(menu).toBeVisible({ timeout: 30_000 });
      await menu.click();
      await expect(page.getByText("Aminatou").first()).toBeVisible();
    } finally {
      await restaurer(contexte, avant);
    }
  });

  test("WEB-PRO-4 · la date de naissance : 16 ans au moins, jamais affichée", async ({ navigateurConnecte, navigateurVisiteur }) => {
    const { contexte } = await navigateurConnecte("aminata", { parEcran: true });
    const avant = await lireProfil(contexte);
    try {
      const api = adresseDeLApi();
      const douzeAns = await contexte.request.patch(`${api}/auth/me/profile`, { data: { birthDate: ilYaDesAnnees(12) } });
      expect(douzeAns.status(), "12 ans refusé").toBeGreaterThanOrEqual(400);
      expect(((await douzeAns.json()) as { details?: { errors?: Record<string, string> } }).details?.errors?.birthDate).toBe("TOO_YOUNG");
      const futur = await contexte.request.patch(`${api}/auth/me/profile`, { data: { birthDate: dansLeFutur() } });
      expect(futur.status(), "date future refusée").toBeGreaterThanOrEqual(400);
      expect(((await futur.json()) as { details?: { errors?: Record<string, string> } }).details?.errors?.birthDate).toBe("IN_THE_FUTURE");
      // Une date valide passe.
      expect(await ecrireProfil(contexte, { birthDate: ilYaDesAnnees(30) }), "30 ans accepté").toBe(200);

      // La page publique n'affiche NULLE PART la date de naissance (ni l'année de naissance).
      const anneeNaissance = String(new Date().getUTCFullYear() - 30);
      const { page } = await navigateurVisiteur();
      await page.goto("/fr/u/seed-aminata", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const texte = (await page.locator("body").innerText()).toLowerCase();
      expect(texte.includes("naissance"), "le mot « naissance » n'apparaît pas").toBe(false);
      expect(texte.includes(anneeNaissance), "l'année de naissance n'apparaît pas").toBe(false);
    } finally {
      await restaurer(contexte, avant);
    }
  });

  test("WEB-PRO-5 · l'avatar : un fichier de plus de 2 Mo est refusé côté navigateur, sans requête", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("aminata", { parEcran: true });
    await ouvrirLeProfil(page);
    // On surveille toute tentative de téléversement (ImageKit signé + notre API avatar).
    const requetes: string[] = [];
    page.on("request", (r) => {
      if (/imagekit|upload|\/auth\/me\/avatar/i.test(r.url())) requetes.push(r.url());
    });
    const gros = Buffer.alloc(2 * 1024 * 1024 + 50_000, 1); // 2,05 Mo
    await page.locator('input[type="file"]').setInputFiles({ name: "trop-gros.png", mimeType: "image/png", buffer: gros });
    await expect(page.locator("main").getByText("Photo trop lourde (2 Mo au plus).")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);
    expect(requetes, "aucune requête de téléversement").toEqual([]);
    // Le téléversement réel (étape 2) et WEB-PRO-6 écrivent sur ImageKit : joués à la main.
    test.info().annotations.push({ type: "note", description: "WEB-PRO-5 étape 2 et WEB-PRO-6 : téléversement ImageKit réel, non automatisé (écriture externe)." });
  });

  test.skip("WEB-PRO-6 · changer puis retirer l'avatar (téléversement ImageKit réel)", () => {
    // Écrit et supprime un fichier sur ImageKit (service externe) : joué à la main. La suppression
    // de l'ancien fichier (qui doit répondre « introuvable ») est le piège des clés ImageKit du
    // .env RACINE, déjà documenté (§ pièges).
  });

  test("WEB-PRO-7 · la page publique d'un Voyageur", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    await page.goto("/fr/u/seed-thomas", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    // Identité : prénom + initiale du nom, « Membre depuis ».
    await expect(page.getByText(/Thomas\s+N\.?/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Membre depuis/).first()).toBeVisible();
    // Le bloc Voyageur, avec un NIVEAU nommé (jamais une note « 0.0 » inventée).
    await expect(page.getByText("En tant que Voyageur")).toBeVisible();
    const niveaux = ["Nouveau Voyageur", "Voyageur confirmé", "Top Voyageur"];
    await expect(page.locator("main").getByText(new RegExp(niveaux.join("|"))).first()).toBeVisible();
    const corps = await page.locator("body").innerText();
    expect(/⭐?\s*0[.,]0\s*·\s*0\s*deals/i.test(corps), "aucune note « 0.0 · 0 deals » inventée (WEB-NRG-2)").toBe(false);
    // Actions du visiteur. (Le bloc « Réseau » ne s'affiche qu'avec au moins un abonné/abonnement
    // — Thomas n'en a aucun dans le seed : son absence est normale, pas une anomalie.)
    await expect(page.getByRole("button", { name: "Suivre" }).or(page.getByRole("link", { name: "Suivre" })).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Signaler ce profil" })).toBeVisible();
  });

  test("WEB-PRO-8 · l'adresse de la page publique est stable", async ({ navigateurConnecte, navigateurVisiteur }) => {
    const { contexte } = await navigateurConnecte("thomas", { parEcran: true });
    const avant = await lireProfil(contexte);
    try {
      const nouveauNom = `Thomas ${Date.now() % 10000}`;
      expect(await ecrireProfil(contexte, { displayName: nouveauNom }), "nom affiché changé").toBe(200);
      // L'adresse /u/seed-thomas répond toujours après un changement de profil : un lien partagé ne meurt pas.
      const { page } = await navigateurVisiteur();
      const r = await page.goto("/fr/u/seed-thomas", { waitUntil: "domcontentloaded" });
      expect(r?.status(), "l'ancienne adresse répond encore").toBeLessThan(400);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      // Écart consigné : la page publique affiche l'identité « Prénom N. » (prénom + initiale),
      // JAMAIS le « nom affiché » du dashboard (`CarrierPage.name`) — le cahier attendait ce
      // dernier « à jour » sur la page publique. L'identité, elle, reste stable et lisible.
      await expect(page.getByRole("heading", { name: /Thomas\s+N\.?/ }).first()).toBeVisible({ timeout: 30_000 });
    } finally {
      await restaurer(contexte, avant);
    }
  });

  test("WEB-PRO-9 · masquer sa page publique n'efface pas ses trajets", async ({ navigateurConnecte, navigateurVisiteur, jeuEssai }) => {
    const A = await navigateurConnecte("thomas", { parEcran: true });
    const avant = await lireProfil(A.contexte);
    try {
      // A masque sa page publique.
      expect(await ecrireProfil(A.contexte, { profilePublic: false }), "page masquée").toBe(200);

      // Un visiteur : « Profil introuvable ».
      const B = await navigateurVisiteur();
      await B.page.goto("/fr/u/seed-thomas", { waitUntil: "domcontentloaded" });
      await expect(B.page.getByText("Profil introuvable").first()).toBeVisible({ timeout: 30_000 });
      await expect(B.page.getByRole("link", { name: "Retour à l'accueil" }).or(B.page.getByRole("button", { name: "Retour à l'accueil" }))).toBeVisible();

      // Le propriétaire, lui, voit sa page AVEC la mention « masquée » (ANO-WEB-21 : le drapeau
      // `hidden` de l'API n'était pas rendu ; une bannière l'affiche désormais).
      await A.page.goto("/fr/u/seed-thomas", { waitUntil: "domcontentloaded" });
      await A.page.waitForLoadState("networkidle").catch(() => undefined);
      await expect(A.page.getByText(/Cette page est masquée/i).first()).toBeVisible({ timeout: 30_000 });

      // Un trajet publié par Thomas reste visible et porte son prénom.
      const idTrajet = jeuEssai.trajet("bzv-upcoming");
      const V = await navigateurVisiteur();
      const r = await V.page.goto(`/fr/trips/${idTrajet}`, { waitUntil: "domcontentloaded" });
      expect(r?.status(), "le trajet reste visible").toBeLessThan(400);
      await V.page.waitForLoadState("networkidle").catch(() => undefined);
      await expect(V.page.getByText(/Thomas/).first()).toBeVisible({ timeout: 30_000 });
    } finally {
      await restaurer(A.contexte, avant); // réactive la bascule
    }
  });

  test("WEB-PRO-10 · afficher puis masquer sa ville", async ({ navigateurConnecte, navigateurVisiteur }) => {
    const { contexte } = await navigateurConnecte("thomas", { parEcran: true });
    const avant = await lireProfil(contexte);
    try {
      // La ville réelle de Thomas : celle de l'adresse principale de sa page Voyageur (via /auth/me).
      const me = (await (await contexte.request.get(`${adresseDeLApi()}/auth/me`)).json()) as { user?: { carrierPage?: { primaryAddress?: { city?: string } } } };
      const ville = me.user?.carrierPage?.primaryAddress?.city ?? "";
      test.skip(!ville, "aucune ville sur l'adresse de Thomas dans le seed : bascule sans donnée à observer");
      expect(await ecrireProfil(contexte, { showCity: true }), "ville affichée").toBe(200);
      const on = await navigateurVisiteur();
      await on.page.goto("/fr/u/seed-thomas", { waitUntil: "domcontentloaded" });
      await on.page.waitForLoadState("networkidle").catch(() => undefined);
      const avecVille = (await on.page.locator("main").innerText()).includes(ville);

      expect(await ecrireProfil(contexte, { showCity: false }), "ville masquée").toBe(200);
      const off = await navigateurVisiteur();
      await off.page.goto("/fr/u/seed-thomas", { waitUntil: "domcontentloaded" });
      await off.page.waitForLoadState("networkidle").catch(() => undefined);
      const sansVille = (await off.page.locator("main").innerText()).includes(ville);

      // La bascule change bien l'affichage de la ville (elle apparaît avec, pas sans).
      expect(avecVille && !sansVille, `la ville « ${ville} » suit la bascule (avec=${avecVille}, sans=${sansVille})`).toBe(true);
    } finally {
      await restaurer(contexte, avant);
    }
  });
});
