"use client";

/**
 * SurchargePills — D14/D33 : quand l'Expéditeur a filtré une famille et que
 * le Voyageur applique un supplément dessus, on l'annonce sur la carte
 * (transparence avant le clic). Les refus n'arrivent jamais ici : ils sont
 * exclus par le filtre serveur.
 */

import { useTranslations } from "next-intl";
import type { SearchFamily, SearchFamilyCondition } from "./search-results.types";

export function SurchargePills({
  conditions,
  highlightedFamilies,
  size = "[10px]",
}: {
  conditions?: SearchFamilyCondition[];
  highlightedFamilies: SearchFamily[];
  size?: string;
}) {
  const t = useTranslations("search");
  if (!conditions || highlightedFamilies.length === 0) return null;
  const pills = conditions.filter(
    (c) => c.mode === "SURCHARGE" && highlightedFamilies.includes(c.familyKey as SearchFamily)
  );
  if (pills.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {pills.map((c) => (
        <span
          key={c.familyKey}
          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-${size} font-semibold text-slate-900 dark:text-[#FFB84D]`}
          style={{ backgroundColor: "rgba(255,153,0,0.12)" }}
        >
          {t("card.surcharge", { family: t(`families.${c.familyKey}`), pct: c.surchargePct ?? 0 })}
        </span>
      ))}
    </div>
  );
}
