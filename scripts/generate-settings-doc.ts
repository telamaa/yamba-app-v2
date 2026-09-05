/**
 * generate-settings-doc.ts — `context/YAMBA-PARAMETRES.md` depuis le catalogue (C-PR8a, D62 1A)
 * ==============================================================================================
 *   npx tsx scripts/generate-settings-doc.ts
 * Le document de gouvernance et la page admin lisent la même source : ce script est la seule
 * façon d'écrire le fichier (il est régénéré à chaque PR qui touche le catalogue).
 */
import { writeFileSync } from "node:fs";
import { FIXED_PARAMETERS, PLANNED_PARAMETERS, SETTINGS_CATALOG, SETTING_GROUP_LABEL, type SettingGroup } from "../packages/libs/api-contracts/src/admin/platform-settings.schema";

const ORDER: SettingGroup[] = ["pricing", "protection", "cancellation", "rating", "dispute", "reputation", "messaging", "alerts", "documents"];

function fmt(unit: string, v: number): string {
  if (unit === "cents") return `${(v / 100).toFixed(2).replace(".", ",")} €`;
  if (unit === "percent") return `${v} %`;
  if (unit === "coef") return `× ${v}`;
  if (unit === "rating") return `${v} / 5`;
  const u: Record<string, string> = { kg: "kg", hours: "h", days: "j", minutes: "min", count: "", mb: "Mo" };
  return `${v}${u[unit] ? " " + u[unit] : ""}`.trim();
}

let out = `# YAMBA — PARAMÈTRES DE LA PLATEFORME (généré, D62)

> Fichier GÉNÉRÉ par \`npx tsx scripts/generate-settings-doc.ts\` depuis le catalogue
> \`packages/libs/api-contracts/src/admin/platform-settings.schema.ts\`. Ne pas éditer à la main :
> la page admin « Paramètres », ses info-bulles, l'OpenAPI et ce document lisent la même source.
> Les valeurs ci-dessous sont les **défauts** (= le code au moment de la gravure) ; les valeurs
> en vigueur se lisent dans l'admin ou par \`seed-settings.ts --show\`.

## Trois classes (D62 2A)

- **A — réglable en ligne** : ${SETTINGS_CATALOG.length} clés ci-dessous. Portée **métier** = super administrateur seul ; portée **exploitation** = profil Exploitation (OPS) ou super administrateur. Lecture ouverte à tous les profils.
- **B — modifiable par déploiement seulement** : les invariants de sécurité (liste en fin de document).
- **C — prévue, pas encore lue par le code** : nommée au §13 des règles métier, absente de la page tant qu'aucun consommateur n'existe.

Règles communes : motif ≥ 20 caractères, une ligne de journal par clé (avant / après), email à tous les super administrateurs, effet dans les 30 s, **jamais rétroactif** (snapshot de réservation, COM-04 / PRC-08). Bornes et cohérence (S ≤ M ≤ L, intervalle de relance ≥ délai, plafond de Garantie ≥ prime, top ≥ confirmé) refusées côté serveur quel que soit le rôle.

`;
for (const g of ORDER) {
  const defs = SETTINGS_CATALOG.filter((d) => d.group === g);
  if (!defs.length) continue;
  out += `## ${SETTING_GROUP_LABEL[g]}\n\n| Clé | Libellé | Défaut | Bornes | Portée | Règle | Lu par |\n|---|---|---|---|---|---|---|\n`;
  for (const d of defs) {
    out += `| \`${d.key}\` | ${d.label}${d.contractual ? " *(CGU)*" : ""} | **${fmt(d.unit, d.default)}** | ${fmt(d.unit, d.min)} → ${fmt(d.unit, d.max)} | ${d.scope === "BUSINESS" ? "métier" : "exploitation"} | ${d.rule} | ${d.consumers.join(", ")} |\n`;
  }
  out += "\n";
  for (const d of defs) {
    out += `- **${d.label}** (\`${d.key}\`) — ${d.description}${d.example ? ` *Exemple : ${d.example}*` : ""}\n`;
  }
  out += "\n";
}
out += `## Classe B — modifiables par déploiement seulement\n\n| Paramètre | Valeur | Règle |\n|---|---|---|\n`;
for (const f of FIXED_PARAMETERS) out += `| ${f.label} | ${f.value} | ${f.rule} |\n`;
out += `\n## Classe C — prévues, pas encore lues par le code\n\n| Clé (§13) | Règle |\n|---|---|\n`;
for (const p of PLANNED_PARAMETERS) out += `| \`${p.key}\` | ${p.rule} |\n`;

writeFileSync("context/YAMBA-PARAMETRES.md", out);
console.log(`context/YAMBA-PARAMETRES.md écrit — ${SETTINGS_CATALOG.length} clés de classe A, ${FIXED_PARAMETERS.length} de classe B, ${PLANNED_PARAMETERS.length} de classe C.`);
