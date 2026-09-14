/**
 * web-voc.spec.ts — cahier 01-WEB, chapitre 5.32 « Vocabulaire et cohérence de langue »
 * =====================================================================================
 * Le chapitre se joue « en relisant les écrans déjà parcourus, pas en refaisant les parcours ». Le harnais le
 * prend au mot : UN relevé commun ouvre chaque écran du cahier (visiteur, Expéditrice, Voyageur), en français
 * PUIS en anglais, et garde son texte VISIBLE — `innerText` + les libellés que lit un lecteur d'écran
 * (`aria-label`, `placeholder`, `title`, `alt`). Chaque fiche interroge ensuite ce relevé avec sa règle, et
 * rend la liste exacte « écran → extrait » de ce qu'elle refuse. Les emails sont relus dans Mailpit.
 *
 * Deux choix, assumés :
 *  - **on juge ce qui s'affiche**, pas les fichiers de traduction : une clé morte n'est pas une anomalie
 *    d'écran (elle est consignée à part, comme risque dormant) ;
 *  - **on nomme le coupable** : un échec dit l'écran, la langue et vingt caractères de contexte de chaque
 *    côté — une liste d'occurrences se corrige, un « vocabulaire incorrect » ne se corrige pas.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { COMPTES } from "../fixtures/comptes";
import { adresseDeLApi } from "../fixtures/adresses";
import { normaliserEspaces } from "../pages/reservation";
import { poserLaRecherche } from "../pages/recherche";
import { FilMessagerie } from "../pages/fil-messagerie";
import { TransportVoyageur } from "../pages/transport-voyageur";
import { AssistantReservation } from "../pages/reservation";
// Sans zod, importable tel quel : la liste des langues du produit, et le lexique partagé avec la CI (règle 6).
import { SUPPORTED_LOCALES, type SupportedLocale } from "../../../../packages/libs/api-contracts/src/locale";

const LANGUES = SUPPORTED_LOCALES;
interface RegleDuLexique { id: string; motif: string; drapeaux: string; raison: string; sauf?: string }
const LEXIQUE = JSON.parse(readFileSync(join(__dirname, "../../../../scripts/lexique-yamba.json"), "utf-8")) as Record<SupportedLocale, RegleDuLexique[]>;
/** Une règle du lexique, compilée : le motif (drapeau global pour `matchAll`) et ses exceptions de sens. */
function regle(langue: SupportedLocale, id: string): { motif: RegExp; sauf?: RegExp } {
  const r = LEXIQUE[langue].find((x) => x.id === id);
  if (!r) throw new Error(`lexique-yamba.json : règle « ${id} » absente pour ${langue}`);
  return { motif: new RegExp(r.motif, r.drapeaux), sauf: r.sauf ? new RegExp(r.sauf, "i") : undefined };
}

type Page = Navigateur["page"];
type Langue = SupportedLocale;
interface Ecran {
  nom: string;
  langue: Langue;
  compte: "visiteur" | "aminata" | "thomas";
  texte: string;
}

/** Le relevé partagé par les fiches. Il est AUSSI écrit sur disque : après l'échec d'une fiche, Playwright
    remplace le processus de travail — un relevé gardé en mémoire seule serait perdu pour les fiches suivantes. */
const releve: Ecran[] = [];
const fichierDuReleve = () => join(test.info().project.outputDir, "releve-web-voc.json");
function chargerLeReleve(): void {
  if (releve.length === 0 && existsSync(fichierDuReleve())) releve.push(...(JSON.parse(readFileSync(fichierDuReleve(), "utf-8")) as Ecran[]));
  expect(releve.length, "le relevé WEB-VOC-0 existe (jouer le chapitre en entier)").toBeGreaterThan(0);
}

/** Le texte qu'un membre voit ou entend sur la page : texte rendu + libellés d'accessibilité visibles. */
async function texteVisible(page: Page): Promise<string> {
  const { corps, libelles } = await page.evaluate(() => {
    const vus: string[] = [];
    document.querySelectorAll<HTMLElement>("[aria-label], [placeholder], [title], img[alt]").forEach((n) => {
      if (n.closest("nextjs-portal, [aria-hidden='true']")) return;
      if (n.getClientRects().length === 0) return;
      for (const a of ["aria-label", "placeholder", "title", "alt"]) {
        const v = n.getAttribute(a);
        if (v && v.trim()) vus.push(v.trim());
      }
    });
    return { corps: document.body.innerText, libelles: vus };
  });
  return normaliserEspaces(`${corps}\n${libelles.join("\n")}`);
}

/** Ouvre un écran, attend qu'il ait rendu du contenu (le texte se stabilise), et le relève. */
async function relever(page: Page, ecran: Omit<Ecran, "texte">, chemin: string): Promise<void> {
  await page.goto(chemin, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  /* Stable = TROIS lectures identiques à 1,5 s d'écart ET plus aucun squelette (`animate-pulse`). Deux lectures
     à une seconde d'écart tombaient parfois dans le squelette : « Mes envois » relevé à 241 caractères, vide. */
  let texte = "";
  let stables = 0;
  for (let i = 0; i < 30 && stables < 2; i++) {
    await page.waitForTimeout(1_500);
    const lu = await texteVisible(page);
    const squelette = await page.locator(".animate-pulse").count();
    stables = lu === texte && squelette === 0 ? stables + 1 : 0;
    texte = lu;
  }
  expect(texte.length, `${ecran.nom} (${ecran.langue}) : l'écran a rendu du texte`).toBeGreaterThan(200);
  /* Un écran « introuvable » a aussi 200 caractères (en-tête compris) : il ne relit rien du tout. */
  // Les PHRASES des écrans d'absence du produit, pas des mots isolés : « mot de passe oublié » dit, à juste titre,
  // « le message est identique même si le compte n'existe pas ».
  expect(texte, `${ecran.nom} (${ecran.langue}) : l'écran existe pour ce compte`).not.toMatch(
    /n'existe pas ou|n'existe plus ou|Cette page n'existe pas|introuvable|doesn't exist or|does not exist or|Page not found|not found|Accès refusé|Access denied/i
  );
  releve.push({ ...ecran, texte });
}

/** Chaque occurrence d'un motif, avec son contexte, écran par écran. */
function occurrences(motif: RegExp, filtre: (e: Ecran) => boolean = () => true, exclure?: RegExp): string[] {
  const trouve: string[] = [];
  for (const e of releve.filter(filtre)) {
    const global = new RegExp(motif.source, motif.flags.includes("g") ? motif.flags : motif.flags + "g");
    for (const m of e.texte.matchAll(global)) {
      const debut = Math.max(0, (m.index ?? 0) - 25);
      const extrait = e.texte.slice(debut, (m.index ?? 0) + m[0].length + 25).replace(/\n/g, " ⏎ ");
      if (exclure && exclure.test(extrait)) continue;
      trouve.push(`[${e.langue}] ${e.nom} (${e.compte}) : « …${extrait}… »`);
    }
  }
  return [...new Set(trouve)];
}

const api = () => adresseDeLApi();

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-VOC — vocabulaire et cohérence de langue (chapitre 5.32)", () => {
  /* PAS en série : une fiche qui échoue ne doit pas empêcher les autres de rendre leur inventaire. Elles
     partagent le relevé écrit sur disque par WEB-VOC-0 (qui reste la première, dans l'ordre du fichier). */

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-VOC-0 · le relevé des écrans parcourus, en français puis en anglais", async ({ navigateurVisiteur, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(20 * 60_000);
    const visiteur = await navigateurVisiteur();
    const aminata = await navigateurConnecte("aminata");
    const thomas = await navigateurConnecte("thomas");
    const trajet = jeuEssai.trajet("bzv-upcoming");
    const trajetParKilo = jeuEssai.trajet("bzv-perkg");
    const enAttente = jeuEssai.deal("bzv-pending").id;
    const enTransit = jeuEssai.deal("bzv-picked").id;
    const livre = jeuEssai.deal("yul-delivered").id; // à Aminata (bzv-delivered est à João : écran « introuvable »)
    const termine = jeuEssai.deal("bzv-completed-blocked").id;
    const litige = jeuEssai.deal("bzv-disputed").id;
    const fil = await FilMessagerie.identifiantDuFil(aminata.contexte, enTransit);

    /* Lien de suivi du destinataire (écran sans compte) : créé par l'Expéditrice. L'API rend un chemin relatif. */
    const creation = await aminata.contexte.request.post(`${api()}/deals/${enTransit}/tracking-link`);
    expect(creation.ok(), `lien de suivi : ${creation.status()}`).toBe(true);
    const servi = (await creation.json()) as { url?: string; path?: string };
    const brut = servi.url ?? servi.path ?? "";
    const suivi = (brut.startsWith("http") ? new URL(brut).pathname : brut).replace(/^\/(fr|en)(?=\/)/, "");
    expect(suivi, "un chemin /track/<jeton>").toMatch(/^\/track\/[A-Za-z0-9_-]+$/);

    /* Les TROIS comptes lisent EN PARALLÈLE (un onglet chacun), chacun ses écrans dans les deux langues : le relevé
       séquentiel prenait 11 min 30. Les langues viennent de SUPPORTED_LOCALES : une troisième sera relue sans
       toucher la spec. */
    const lireVisiteur = async () => {
      for (const l of LANGUES) {
        await poserLaRecherche(visiteur.page, { from: "Paris", to: "Brazzaville" });
        const ecrans: Array<[string, string]> = [
          ["accueil", `/${l}`],
          ["inscription", `/${l}/register`],
          ["connexion", `/${l}/login`],
          ["mot de passe oublié", `/${l}/password/forgot`],
          ["recherche", `/${l}/search`],
          ["page de trajet", `/${l}/trips/${trajet}`],
          ["page publique du Voyageur", `/${l}/u/seed-thomas`],
          ["devenir Voyageur", `/${l}/become/carrier`],
          ["aide", `/${l}/help`],
          ["page destinataire (sans compte)", `/${l}${suivi}`],
        ];
        for (const [nom, chemin] of ecrans) await relever(visiteur.page, { nom, langue: l, compte: "visiteur" }, chemin);
        /* Trouvé en relisant la page de trajet : « Voir les avis » menait à `/tripper/<id>`, une route qui n'existe pas. */
        await visiteur.page.goto(`/${l}/trips/${trajet}`, { waitUntil: "networkidle" });
        const lienAvis = visiteur.page.locator('a[href*="/tripper/"], a[href*="/u/"]').filter({ hasText: /avis|review/i }).first();
        await expect(lienAvis, "le lien vers les avis du Voyageur").toBeVisible({ timeout: 60_000 });
        expect(await lienAvis.getAttribute("href"), "il mène à la page publique, pas à une route inexistante").toMatch(/\/u\/seed-thomas$/);
      }
    };
    const lireExpeditrice = async () => {
      for (const l of LANGUES) {
        const ecrans: Array<[string, string]> = [
          ["réservation (étape 1)", `/${l}/trips/${trajetParKilo}/book`],
          ["tableau de bord", `/${l}/dashboard/home`],
          ["mes envois", `/${l}/dashboard/shipments`],
          ["suivi d'un envoi en attente", `/${l}/bookings/${enAttente}`],
          ["suivi d'un envoi en transit", `/${l}/bookings/${enTransit}`],
          ["suivi d'un envoi livré", `/${l}/bookings/${livre}`],
          ["signaler un problème", `/${l}/bookings/${livre}/report`],
          ["suivi d'un envoi terminé", `/${l}/bookings/${termine}`],
          ["noter le Voyageur", `/${l}/bookings/${termine}/rate`],
          ["messagerie (fil)", `/${l}/dashboard/messages?conversation=${fil}`],
          ["notifications", `/${l}/dashboard/notifications`],
          ["finances", `/${l}/dashboard/finances`],
          ["favoris", `/${l}/dashboard/favorites`],
          ["profil", `/${l}/dashboard/profile`],
          ["paramètres", `/${l}/dashboard/settings`],
          // Le point d'attention connu du cahier : l'assistant « Devenir Voyageur », vu par un membre qui ne l'est pas
          // encore (Thomas l'est déjà : il n'y verrait que l'écran de succès).
          ["assistant Devenir Voyageur", `/${l}/carrier/onboarding`],
        ];
        for (const [nom, chemin] of ecrans) await relever(aminata.page, { nom, langue: l, compte: "aminata" }, chemin);
      }
    };
    const lireVoyageur = async () => {
      for (const l of LANGUES) {
        const ecrans: Array<[string, string]> = [
          ["mes trajets", `/${l}/dashboard/trips`],
          ["demande reçue (deal)", `/${l}/carrier/deals/${enAttente}`],
          ["deal en transit", `/${l}/carrier/deals/${enTransit}`],
          ["remise du colis", `/${l}/carrier/deals/${enTransit}/deliver`],
          ["deal en litige", `/${l}/carrier/deals/${litige}`],
          ["créer un trajet", `/${l}/trips/create`],
          ["espace Voyageur (onboarding)", `/${l}/carrier/onboarding`],
          ["finances", `/${l}/dashboard/finances`],
          ["notifications", `/${l}/dashboard/notifications`],
        ];
        for (const [nom, chemin] of ecrans) await relever(thomas.page, { nom, langue: l, compte: "thomas" }, chemin);
      }
    };
    await Promise.all([lireVisiteur(), lireExpeditrice(), lireVoyageur()]);
    writeFileSync(fichierDuReleve(), JSON.stringify(releve));
    test.info().annotations.push({ type: "note", description: `${releve.length} écrans relevés (${releve.filter((e) => e.langue === "fr").length} FR, ${releve.filter((e) => e.langue === "en").length} EN)` });
  });

  test("WEB-VOC-1 · « Voyageur » et « Expéditeur » partout, y compris dans les emails", async ({ navigateurConnecte, mailpit, jeuEssai }) => {
    chargerLeReleve();
    test.setTimeout(8 * 60_000);
    /* Écrans. En français, les mots interdits du cahier ; en anglais, « Traveler » est le SEUL mot du rôle
       (A144) — « carrier » en est un synonyme refusé au même titre que « traveller ». */
    // Les adresses du jeu d'essai (`aminata.shipper@seed.yamba.dev`) contiennent le mot : ce n'est pas un libellé.
    const pasUneAdresse = /[\w.]+@[\w.]+/;
    // Mots refusés : `scripts/lexique-yamba.json`, la même source que la règle 6 de la CI.
    const [fr, en] = (["fr", "en"] as const).map((l) => occurrences(regle(l, "roles").motif, (e) => e.langue === l, pasUneAdresse));
    /* Le point d'attention connu : l'assistant « Devenir Voyageur ». */
    const devenir = releve.filter((e) => e.nom === "assistant Devenir Voyageur");
    expect(devenir.length, "l'assistant « Devenir Voyageur » a été relu dans les deux langues").toBe(2);
    expect(devenir.find((e) => e.langue === "fr")?.texte, "son titre dit « Voyageur »").toMatch(/Devenir Voyageur/);
    expect(devenir.find((e) => e.langue === "en")?.texte, "and in English, « Traveler »").toMatch(/Become a Traveler/);
    /* Et le français ne fuit pas sur les écrans anglais (étiquettes, textes alternatifs écrits en dur). Le prénom
       des membres n'est jamais « Voyageur » : pas de faux positif possible. */
    const francaisEnAnglais = occurrences(/\b(Voyageur|Voyageuse|Expéditeur|Expéditrice|transporteur)\b/, (e) => e.langue === "en");

    /* Emails. Deux emails en anglais sont provoqués : Pauline passe son compte en anglais, Thomas prend son colis en
       charge (email « pris en charge ») ; le reste de la boîte vient des chapitres joués avant. */
    const pauline = await navigateurConnecte("pauline");
    const versEn = await pauline.contexte.request.patch(`${api()}/auth/me/locale`, { data: { locale: "en" } });
    expect(versEn.ok(), "PATCH /auth/me/locale → en").toBe(true);
    try {
      const thomas = await navigateurConnecte("thomas");
      await new TransportVoyageur(thomas.page).prendreEnCharge(jeuEssai.deal("bzv-accepted").id, { nbPhotos: 1 });
      await mailpit.attendreEmail({ pour: COMPTES.pauline.email, sujet: /picked up|pris en charge/i }, 90_000);
    } finally {
      await pauline.contexte.request.patch(`${api()}/auth/me/locale`, { data: { locale: "fr" } });
    }
    const boite = await mailpit.lister(200);
    const emails: string[] = [];
    for (const r of boite) {
      const e = await mailpit.ouvrir(r.id);
      const corps = normaliserEspaces(`${e.sujet}\n${e.texte}`);
      const motif = new RegExp(`${regle("fr", "roles").motif.source}|${regle("en", "roles").motif.source}`, "gi");
      for (const m of corps.matchAll(motif)) {
        const i = m.index ?? 0;
        // `/fr/carrier/deals/…` est un CHEMIN d'URL (identifiant de code), pas un mot lu par le membre.
        if (corps[i - 1] === "/" || corps[i + m[0].length] === "/") continue;
        emails.push(`email « ${e.sujet} » → ${e.destinataire} : « …${corps.slice(Math.max(0, i - 25), i + m[0].length + 25).replace(/\n/g, " ⏎ ")}… »`);
      }
    }
    test.info().annotations.push({ type: "note", description: `${boite.length} emails relus` });
    const tout = [...fr, ...en, ...francaisEnAnglais, ...new Set(emails)];
    expect(tout, `mots de rôle refusés :\n${tout.join("\n")}`).toHaveLength(0);
  });

  test("WEB-VOC-2 · le mot « assurance » n'apparaît pas", async ({ mailpit }) => {
    chargerLeReleve();
    const ecrans = LANGUES.flatMap((l) => occurrences(regle(l, "assurance").motif, (e) => e.langue === l));
    const emails: string[] = [];
    for (const r of await mailpit.lister(200)) {
      const e = await mailpit.ouvrir(r.id);
      if (LANGUES.some((l) => regle(l, "assurance").motif.test(`${e.sujet} ${e.texte}`))) emails.push(`email « ${e.sujet} »`);
    }
    /* Les libellés attendus existent bien (on ne passe pas un écran vide). */
    expect(occurrences(/Garantie Yamba|Protection/i, (e) => e.langue === "fr").length, "les libellés « Protection » / « Garantie Yamba » sont affichés").toBeGreaterThan(0);
    const tout = [...ecrans, ...emails];
    expect(tout, `« assurance » affiché :\n${tout.join("\n")}`).toHaveLength(0);
  });

  test("WEB-VOC-3 · les noms de catégories sont cohérents d'un écran à l'autre", async ({ navigateurVisiteur, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(10 * 60_000);
    chargerLeReleve();
    /* Aucun envoi « bagage en soute » VIVANT dans le jeu d'essai (le seul, `fih-declined`, est refusé : ni « Mes
       envois » ni « Mes trajets » ne le montrent) et le trajet de Bruxelles ne propose pas le forfait. La fiche
       crée donc le sien : Aminata réserve un bagage en soute sur le trajet au kilo de Thomas (paiement FAKE). */
    const trajet = jeuEssai.trajet("bzv-perkg");
    const aminata = await navigateurConnecte("aminata", { parEcran: true });
    const thomas = await navigateurConnecte("thomas");
    const visiteur = await navigateurVisiteur();
    const assistant = new AssistantReservation(aminata.page);
    await assistant.ouvrir(trajet);
    await aminata.page.getByRole("button", { name: /^Un bagage (en )?soute 23 kg/ }).click();
    await aminata.page.locator('input[placeholder="150"]').fill("120");
    await aminata.page.locator("textarea").first().fill("Valise de vêtements et de livres pour la famille");
    await assistant.continuer();
    await assistant.decrireLeDestinataire({ prenom: "Clarisse", nom: "Mabiala", indicatif: "+242", telephone: "061234567" });
    await assistant.continuer();
    await assistant.accepterLaCharte();
    await assistant.continuer();
    await assistant.payer();
    await expect.poll(() => aminata.page.url(), { timeout: 90_000, message: "la demande est créée" }).toMatch(/\/bookings\/[0-9a-f]{24}$/);
    const dealCree = aminata.page.url().split("/bookings/")[1];
    try {

      const formulations = new Map<string, Set<string>>();
      const noter = (langue: Langue, ecran: string, texte: string) => {
        const motif =
          langue === "fr"
            ? /(?:un\s+)?(?:bagage|valise)(?:\s+en)?(?:\s+soute)?\s*23\s*kg|soute\s*23\s*kg/gi
            : /(?:an?\s+)?(?:23\s*kg\s+)?checked[\s-]+bag(?:\s*23\s*kg)?|hold\s+(?:bag|luggage)(?:\s*23\s*kg)?/gi;
        const vus = [...texte.matchAll(motif)].map((m) => m[0].trim().replace(/\s+/g, " ").replace(/^(un|an?)\s+/i, ""));
        for (const v of new Set(vus)) {
          const cle = `[${langue}] ${v.toLowerCase()}`;
          if (!formulations.has(cle)) formulations.set(cle, new Set());
          formulations.get(cle)!.add(ecran);
        }
        return vus.length;
      };
      const lire = async (page: Page, langue: Langue, ecran: string, chemin: string, attendu = true) => {
        const avant = releve.length;
        await relever(page, { nom: ecran, langue, compte: "aminata" }, chemin);
        const n = noter(langue, ecran, releve[avant].texte);
        releve.pop(); // ces écrans servent à la fiche 3 seulement
        if (attendu) expect(n, `[${langue}] ${ecran} : le bagage en soute est nommé`).toBeGreaterThan(0);
      };
      for (const l of ["fr", "en"] as const) {
        await poserLaRecherche(visiteur.page, { from: "Paris", to: "Brazzaville" });
        await lire(visiteur.page, l, "recherche", `/${l}/search`, false); // la carte ne détaille pas les forfaits : consigné
        await lire(visiteur.page, l, "page du trajet", `/${l}/trips/${trajet}`);
        await lire(aminata.page, l, "réservation (étape 1)", `/${l}/trips/${trajet}/book`);
        await lire(aminata.page, l, "mes envois", `/${l}/dashboard/shipments`);
        await lire(thomas.page, l, "mes trajets", `/${l}/dashboard/trips`);
      }
      const lignes = [...formulations].map(([f, ou]) => `${f} ← ${[...ou].join(", ")}`);
      test.info().annotations.push({ type: "note", description: lignes.join(" | ") });
      for (const l of ["fr", "en"] as const) {
        const distinctes = [...formulations.keys()].filter((k) => k.startsWith(`[${l}]`));
        expect(distinctes, `${l} : une seule formulation du bagage en soute\n${lignes.join("\n")}`).toHaveLength(1);
      }
    } finally {
      /* La réservation n'existe que pour être relue : annulée à la fin, même en cas d'échec. Sans cela, chaque
         exécution consommait 23 kg de `bzv-perkg` jusqu'au prochain rejeu du jeu d'essai — et faussait les
         capacités lues par les chapitres joués ensuite. */
      const annulation = await aminata.contexte.request.post(`${api()}/deals/${dealCree}/cancel`, { data: {} });
      expect(annulation.ok(), `annulation de la réservation de la fiche : ${annulation.status()}`).toBe(true);
    }
  });

  test("WEB-VOC-4 · le tutoiement est constant, à l'écran ET dans les emails", async ({ mailpit }) => {
    chargerLeReleve();
    /* « vous » / « votre » / « vos » : la règle du lexique partagé avec la CI, exceptions de sens comprises (« vous
       aurez tous les deux noté », « rendez-vous »). Les impératifs de politesse, eux, n'existent qu'ici : la CI les
       lirait dans des phrases citées. */
    const { motif, sauf } = regle("fr", "vouvoiement");
    const imperatifs = /\b(Vérifiez|Publiez|Choisissez|Indiquez|Ajoutez|Sélectionnez|Renseignez|Saisissez|Consultez|Contactez|Confirmez|Réservez|Découvrez|Envoyez|Gagnez|Recevez|Suivez|Connectez-vous|Créez|Entrez|Remplissez|Complétez|Modifiez|Cliquez|Précisez|Donnez|Laissez|Acceptez|Refusez|Téléchargez|Partagez|Proposez|Réessayez|Configurez|Rejoignez)\b/u;
    const vouvoiement = new RegExp(`${motif.source}|${imperatifs.source}`, "giu");
    const ecrans = occurrences(vouvoiement, (e) => e.langue === "fr", sauf);
    /* Les emails français de la boîte (le cahier ne cite que les écrans ; les emails d'alerte vouvoyaient). Un email
       anglais n'a pas de « vous » : le motif ne s'y applique pas. */
    const emails: string[] = [];
    let relus = 0;
    for (const r of await mailpit.lister(200)) {
      const e = await mailpit.ouvrir(r.id);
      const corps = normaliserEspaces(`${e.sujet}\n${e.texte}`);
      if (!/[àâçéèêëîïôûùœ]/i.test(corps)) continue; // email anglais
      relus += 1;
      for (const m of corps.matchAll(vouvoiement)) {
        const i = m.index ?? 0;
        const extrait = corps.slice(Math.max(0, i - 30), i + m[0].length + 30).replace(/\n/g, " ⏎ ");
        if (sauf?.test(extrait)) continue;
        emails.push(`email « ${e.sujet} » : « …${extrait}… »`);
      }
    }
    test.info().annotations.push({ type: "note", description: `${relus} emails français relus` });
    expect(relus, "des emails français ont été relus").toBeGreaterThan(0);
    const trouve = [...ecrans, ...new Set(emails)];
    expect(trouve, `vouvoiement au milieu d'écrans et d'emails tutoyés :\n${trouve.join("\n")}`).toHaveLength(0);
  });

  test("WEB-VOC-5 · aucun texte de démonstration sur un écran réel", async () => {
    chargerLeReleve();
    const demo = /Aminata T\.|Josué M\.|Léa K\.|\bSofia\b|Marc R\.|Julie D\.|IBAN\s*·+\s*6789|Visa\s*·+\s*4242|YAMBA\*COLIS|89,30\s*€|€\s*89\.30|YAM-4821|Paris → Pointe-Noire|Lyon → Nice|PREVIEW · mock/;
    const trouve = occurrences(demo);
    expect(trouve, `données de démonstration affichées :\n${trouve.join("\n")}`).toHaveLength(0);
  });

  test("WEB-VOC-6 · aucun libellé vide ni clé technique", async () => {
    chargerLeReleve();
    /* Une clé technique : identifiants reliés par des points — UN seul suffit (`status.pending` passait inaperçu avec
       l'ancien seuil de deux). Hors adresses, domaines, fichiers et abréviations (« e.g. », « i.e. », « p. ex. »). */
    const cles = occurrences(
      /(?<![@\w.\/-])[a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+(?![\w@\/-])/,
      () => true,
      /@|https?:|www\.|\.(dev|com|fr|io|app|org|net|png|jpe?g|webp|js)\b|\b(e\.g|i\.e|p\.ex|etc)\b/i
    );
    /* Un tiret seul à la place d'un texte : une LIGNE qui ne contient que « — ». */
    const tirets: string[] = [];
    for (const e of releve) {
      const lignes = e.texte.split("\n").map((x) => x.trim());
      lignes.forEach((ligne, i) => {
        if (/^[—–-]$/.test(ligne)) tirets.push(`[${e.langue}] ${e.nom} (${e.compte}) : « ${lignes[i - 1] ?? ""} ⏎ — ⏎ ${lignes[i + 1] ?? ""} »`);
      });
    }
    /* Libellés d'accessibilité vides ou génériques relevés ailleurs (chapitre 5.31) : non repris ici. */
    const accolades = occurrences(/\{[a-zA-Z_]+\}|\bundefined\b|\bnull\b|\bNaN\b|\[object Object\]/);
    test.info().annotations.push({ type: "note", description: `lignes « — » relevées (à juger) : ${tirets.length}` });
    const tout = [...cles, ...accolades];
    expect(tout, `clés techniques ou valeurs brutes :\n${tout.join("\n")}`).toHaveLength(0);
    expect(tirets, `tirets seuls à la place d'un texte :\n${tirets.join("\n")}`).toHaveLength(0);
  });
});
