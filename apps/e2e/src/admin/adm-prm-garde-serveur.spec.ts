/**
 * adm-prm-garde-serveur.spec.ts — cahier 02-ADMIN, § 4.3, ADM-PRM-9 « Le bouton caché ne remplace pas la garde serveur »
 * ===================================================================================================================
 * Le cahier fait appeler « depuis la console » une dizaine de routes choisies à la main. Le harnais va plus loin et
 * plus sûr : il LIT les routeurs des quatre services (chaque `router.<verbe>("/admin/…", …,
 * requireAdminPermission("…"))`), le contrat des permissions (`ADMIN_PERMISSIONS`, `adminRolesAllow`) et les profils
 * des sept comptes de recette, puis appelle CHAQUE route avec CHAQUE compte :
 *
 *  - la permission manque → **403 `ADMIN_PERMISSION_DENIED`**, et la permission refusée est nommée ;
 *  - la permission est là → **jamais ce 403-là** (un 400 ou un 404 sur un identifiant inexistant est normal).
 *
 * Une route ajoutée demain est donc éprouvée sans toucher la spec ; une route qui perd sa garde (200, 400 ou 404 là où
 * le 403 est dû) est une anomalie bloquante (cahier § 4.3).
 *
 * Sécurité de la fiche : tous les identifiants sont INEXISTANTS (un ObjectId valide que rien ne porte) ; une ÉCRITURE
 * sans identifiant (réinitialiser les paramètres, poser la maintenance, inviter un admin) n'est appelée QUE par un
 * compte à qui elle est refusée — un appel autorisé pourrait l'exécuter.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "../fixtures/yamba";
import { COMPTES_ADMIN } from "../fixtures/comptes";
import { adresseDeLApiAdmin } from "../fixtures/adresses";
import { lireLeJournal, maintenantMoinsUneSeconde } from "../pages/journal-admin";
import { adminRolesAllow, type AdminPermission, type AdminRole } from "../../../../packages/libs/api-contracts/src/admin/admin-users.schema";

const RACINE = join(__dirname, "../../../..");
const INEXISTANT = "0123456789abcdef01234567";

interface RouteAdmin {
  verbe: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  chemin: string;
  permission: AdminPermission;
  source: string;
}

/** Les routes admin telles que les services les déclarent, avec le préfixe sous lequel chacun les monte. */
function routesAdmin(): RouteAdmin[] {
  const sources: Array<[string, string]> = [
    ["apps/auth-service/src/routes/admin.router.ts", ""],
    ["apps/deal-service/src/routes/deal.routes.ts", ""],
    ["apps/trip-service/src/routes/admin.router.ts", "/admin"],
    ["apps/message-service/src/routes/admin.router.ts", "/admin/conversations"],
  ];
  const routes: RouteAdmin[] = [];
  for (const [fichier, prefixe] of sources) {
    const code = readFileSync(join(RACINE, fichier), "utf-8");
    for (const m of code.matchAll(/router\.(get|post|patch|put|delete)\(\s*"([^"]+)"\s*,[^;]*?requireAdminPermission\(\s*"([a-z.]+)"\s*\)/g)) {
      const chemin = `${prefixe}${m[2]}`;
      if (!chemin.startsWith("/admin")) continue;
      routes.push({ verbe: m[1].toUpperCase() as RouteAdmin["verbe"], chemin, permission: m[3] as AdminPermission, source: fichier.split("/")[1] });
    }
  }
  return routes;
}

test.describe("ADM-PRM-9 — le bouton caché ne remplace pas la garde serveur (cahier 02-ADMIN § 4.3)", () => {
  test("ADM-PRM-9 · chaque route admin, avec chaque profil : 403 si et seulement si la permission manque", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(15 * 60_000);
    const routes = routesAdmin();
    expect(routes.length, "les routeurs sont lus (garde du garde)").toBeGreaterThan(50);
    const debut = maintenantMoinsUneSeconde();
    const fautes: string[] = [];
    const sautees: string[] = [];
    let appels = 0;

    for (const cle of Object.keys(COMPTES_ADMIN) as Array<keyof typeof COMPTES_ADMIN>) {
      const profils = jeuEssai.admin(cle).profils as AdminRole[];
      const { contexte } = await navigateurAdmin(cle);
      for (const route of routes) {
        const autorise = adminRolesAllow(profils, route.permission);
        const url = `${adresseDeLApiAdmin()}${route.chemin.replace(/:[A-Za-z]+/g, INEXISTANT)}`;
        const ecritureSansIdentifiant = route.verbe !== "GET" && !route.chemin.includes(":");
        if (autorise && ecritureSansIdentifiant) {
          sautees.push(`${cle} · ${route.verbe} ${route.chemin}`);
          continue;
        }
        const r = await contexte.request.fetch(url, { method: route.verbe, data: route.verbe === "GET" ? undefined : {}, failOnStatusCode: false });
        appels += 1;
        const corps = (await r.json().catch(() => ({}))) as { details?: { code?: string; permission?: string } };
        const refusDePermission = r.status() === 403 && corps.details?.code === "ADMIN_PERMISSION_DENIED";
        if (!autorise && !refusDePermission) {
          fautes.push(`GARDE ABSENTE — ${cle} (${profils.join("+")}) · ${route.verbe} ${route.chemin} [${route.permission}] → ${r.status()} ${corps.details?.code ?? ""}`);
        } else if (!autorise && corps.details?.permission !== route.permission) {
          fautes.push(`PERMISSION MAL NOMMÉE — ${cle} · ${route.verbe} ${route.chemin} : attendu « ${route.permission} », servi « ${corps.details?.permission} »`);
        } else if (autorise && refusDePermission) {
          fautes.push(`REFUS À TORT — ${cle} (${profils.join("+")}) · ${route.verbe} ${route.chemin} [${route.permission}] → 403`);
        }
      }
    }

    test.info().annotations.push({ type: "mesure", description: `${routes.length} routes × ${Object.keys(COMPTES_ADMIN).length} comptes : ${appels} appels ; écritures sans identifiant non appelées par un compte autorisé : ${sautees.length}` });
    expect(fautes, `écarts entre la matrice des permissions et les gardes servies :\n${fautes.join("\n")}`).toHaveLength(0);
    /* Journal : les refus n'écrivent rien. Les seules lignes admises sont celles de LECTURES AUTORISÉES sans
       identifiant, qui journalisent par conception : les exports OPÉRATIONNELS (`personal: false`, identifiants
       seulement) et la lecture du registre RGPD. Mesuré au premier passage : 12 EXPORTED opérationnels et 2
       DATA_REQUESTS_VIEWED, tous par des comptes autorisés — aucun export nominatif. */
    const sup = await navigateurAdmin("super");
    const lignes = await lireLeJournal(sup.contexte.request, { from: debut });
    const parasites = lignes.filter((l) => {
      if (["ADMIN_LOGIN", "ADMIN_LOGOUT", "DATA_REQUESTS_VIEWED"].includes(l.action)) return false;
      if (l.action === "EXPORTED" && (l.after as { personal?: boolean } | null)?.personal === false) return false;
      return true;
    });
    expect(parasites.map((l) => `${l.action} par ${l.admin} ${JSON.stringify(l.after).slice(0, 80)}`), "aucune écriture ni export nominatif pendant la matrice").toEqual([]);
    /* Et l'export NOMINATIF sans motif est refusé, même à qui en a la permission (motif ≥ 20 caractères, RG-ADM). */
    const sansMotif = await sup.contexte.request.get(`${adresseDeLApiAdmin()}/admin/users/export`, { failOnStatusCode: false });
    expect(sansMotif.status(), "export nominatif sans motif : refusé (jamais un fichier)").toBe(400);
  });
});
