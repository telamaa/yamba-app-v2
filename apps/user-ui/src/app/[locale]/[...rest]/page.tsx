/**
 * [...rest]/page.tsx — toute URL inconnue sous une langue tombe sur LA page introuvable de Yamba
 * ==============================================================================================
 * ANO-WEB-88 (recette 5.26). Une adresse qui ne correspond à aucune route (`/es`, réécrit `/fr/es`
 * par le middleware next-intl) ne déclenche jamais `notFound()` : Next n'a alors rien à afficher
 * dans le segment `[locale]` et sert son 404 INTERNE — « This page could not be found. », en
 * anglais, sans en-tête, sans pied de page et sans un lien pour revenir. Un visiteur français
 * voyait donc une page brute d'outil, jamais celle du produit.
 *
 * Cette route attrape-tout est la façon documentée par next-intl de rendre la main à
 * `[locale]/not-found.tsx` : les routes réelles, plus spécifiques, gagnent toujours contre elle.
 */
import { notFound } from "next/navigation";

export default function PageInconnue() {
  notFound();
}
