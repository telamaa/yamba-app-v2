/**
 * seed-settings.ts — remise à zéro des paramètres de la plateforme (C-PR8a, D62)
 * ==============================================================================
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/seed-settings.ts           → supprime le document : les services reviennent aux défauts du catalogue
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/seed-settings.ts --show    → affiche les valeurs en vigueur et celles qui s'écartent du défaut
 *
 * Le journal (AdminAction SETTINGS) n'est jamais touché : une remise à zéro par script n'est
 * pas un geste admin, elle prépare une recette. En production, on passe par la page (journalisée).
 */
import prisma from "../index";
import { SETTINGS_CATALOG, SETTINGS_DEFAULTS, mergeSettingsValues } from "../../api-contracts/src/admin/platform-settings.schema";

const KEY = "current";

async function main() {
  const show = process.argv.includes("--show");
  const row = await prisma.platformSettings.findUnique({ where: { key: KEY } });
  if (show) {
    if (!row) {
      console.log("Aucun document : toutes les valeurs sont celles par défaut (version 0).");
      return;
    }
    const values = mergeSettingsValues(row.values as Record<string, unknown>);
    console.log(`version ${row.version} — mis à jour le ${row.updatedAt.toISOString()} par ${row.updatedByAdminId ?? "?"}`);
    for (const d of SETTINGS_CATALOG) {
      const v = values[d.key];
      console.log(`${v !== SETTINGS_DEFAULTS[d.key] ? "≠" : " "} ${d.key.padEnd(44)} ${String(v).padStart(8)}  (défaut ${SETTINGS_DEFAULTS[d.key]}, ${d.unit})`);
    }
    return;
  }
  if (!row) {
    console.log("Aucun document à supprimer : les services sont déjà sur les défauts.");
    return;
  }
  await prisma.platformSettings.delete({ where: { key: KEY } });
  console.log(`Document supprimé (était en version ${row.version}) : les services reviennent aux défauts du catalogue dans les 30 s.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
